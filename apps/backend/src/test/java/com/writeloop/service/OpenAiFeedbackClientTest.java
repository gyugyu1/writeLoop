package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptDto;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OpenAiFeedbackClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void buildGenerationRequestBody_usesFeedbackModel() throws Exception {
        OpenAiFeedbackClient client = newClient();

        String requestBody = ReflectionTestUtils.invokeMethod(
                client,
                "buildGenerationRequestBody",
                samplePrompt(),
                "I wake up at 8 a.m.",
                List.of(),
                sampleDiagnosis(),
                sampleAnswerProfile(),
                sampleSectionPolicy(),
                1,
                null,
                List.of(SectionKey.STRENGTHS),
                List.of(),
                null
        );

        JsonNode request = objectMapper.readTree(requestBody);
        assertThat(request.path("model").asText()).isEqualTo("gpt-5.4-mini");
    }

    @Test
    void buildGenerationRequestBody_includesDiagnosisFieldsInCombinedSchema() throws Exception {
        OpenAiFeedbackClient client = newClient();

        String requestBody = ReflectionTestUtils.invokeMethod(
                client,
                "buildGenerationRequestBody",
                samplePrompt(),
                "I wake up at 8 a.m.",
                List.of(),
                null,
                null,
                null,
                1,
                null,
                List.of(SectionKey.STRENGTHS),
                List.of(),
                null
        );

        assertThat(requestBody)
                .contains("\"answerBand\"")
                .contains("\"taskCompletion\"")
                .contains("\"finishable\"")
                .doesNotContain("\"primaryIssueCode\"")
                .doesNotContain("\"minimalCorrection\"")
                .doesNotContain("\"grammarSeverity\"")
                .doesNotContain("\"expansionBudget\"")
                .doesNotContain("\"rewriteTarget\"")
                .doesNotContain("\"secondaryIssueCode\"")
                .doesNotContain("\"regressionSensitiveFacts\"")
                .doesNotContain("\"grammarIssues\"")
                .doesNotContain("\"score\"")
                .contains("Fill both the diagnosis fields and the feedback section fields");
    }

    @Test
    void buildGenerationRequestBody_pushes_aggressive_rewrite_suggestions_for_thin_answers() throws Exception {
        OpenAiFeedbackClient client = newClient();

        String requestBody = ReflectionTestUtils.invokeMethod(
                client,
                "buildGenerationRequestBody",
                samplePrompt(),
                "I wake up at 8 a.m.",
                List.of(),
                sampleDiagnosis(),
                sampleAnswerProfile(),
                sampleSectionPolicy(),
                1,
                null,
                List.of(SectionKey.STRENGTHS),
                List.of(),
                null
        );

        assertThat(requestBody)
                .contains("Return as many distinct, high-value rewriteIdeas as the answer supports. Do not stop at a fixed count.")
                .contains("For CONTENT_THIN and SHORT_BUT_VALID answers, actively generate multiple reason, example, detail, image, time-flow, or connector ideas when they would help the learner extend the same answer.")
                .contains("Be proactive about returning multiple distinct reason, example, detail, time-flow, or connector ideas when they would help the learner extend the same answer.")
                .contains("Prefer putting extra reasons, examples, details, time flow, imagery, and optional polish into rewriteIdeas instead of modelAnswer.");
    }

    @Test
    void llmPassThroughSectionPolicy_keeps_generation_limits_loose() {
        OpenAiFeedbackClient client = newClient();

        SectionPolicy policy = (SectionPolicy) ReflectionTestUtils.invokeMethod(client, "llmPassThroughSectionPolicy");

        assertThat(policy.maxStrengthCount()).isEqualTo(4);
        assertThat(policy.maxRefinementCount()).isEqualTo(12);
        assertThat(policy.maxModelAnswerSentences()).isEqualTo(4);
        assertThat(policy.attemptOverlayPolicy()).isEqualTo(AttemptOverlayPolicy.NONE);
    }

    @Test
    @SuppressWarnings("unchecked")
    void sanitizeRewriteSuggestions_keeps_distinct_items_even_without_next_step_practice() {
        OpenAiFeedbackClient client = newClient();

        List<com.writeloop.dto.FeedbackRewriteSuggestionDto> sanitized =
                (List<com.writeloop.dto.FeedbackRewriteSuggestionDto>) ReflectionTestUtils.invokeMethod(
                        client,
                        "sanitizeRewriteSuggestions",
                        List.of(
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto("for example", "예를 들면", null),
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto("for example.", "예를 들면", null),
                                new com.writeloop.dto.FeedbackRewriteSuggestionDto("because it feels peaceful", "평온하게 느껴져서", null)
                        ),
                        null
                );

        assertThat(sanitized)
                .extracting(com.writeloop.dto.FeedbackRewriteSuggestionDto::english)
                .containsExactly("for example", "because it feels peaceful");
    }

    private OpenAiFeedbackClient newClient() {
        return new OpenAiFeedbackClient(
                objectMapper,
                "test-key",
                "gpt-5.4-mini",
                "https://api.openai.com/v1/responses",
                "",
                120
        );
    }

    private PromptDto samplePrompt() {
        return new PromptDto(
                "prompt-1",
                "Daily routine",
                "EASY",
                "What do you do on weekday mornings?",
                "평일 아침에 무엇을 하나요?",
                "Mention one or two activities."
        );
    }

    private FeedbackDiagnosisResult sampleDiagnosis() {
        return new FeedbackDiagnosisResult(
                84,
                AnswerBand.SHORT_BUT_VALID,
                TaskCompletion.FULL,
                true,
                true,
                GrammarSeverity.MINOR,
                List.of(),
                "I wake up at 8 a.m.",
                "FIX_LOCAL_GRAMMAR",
                "ADD_DETAIL",
                new RewriteTarget("ADD_DETAIL", "I wake up at 8 a.m. and _____.", 1),
                ExpansionBudget.ONE_DETAIL,
                List.of("wake up at 8 a.m.")
        );
    }

    private AnswerProfile sampleAnswerProfile() {
        return new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.SHORT_BUT_VALID, true),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), "I wake up at 8 a.m.", true),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_LOCAL_GRAMMAR",
                        "ADD_DETAIL",
                        new RewriteTarget("ADD_DETAIL", "I wake up at 8 a.m. and _____.", 1),
                        ExpansionBudget.ONE_DETAIL,
                        List.of("wake up at 8 a.m."),
                        new ProgressDelta(List.of(), List.of("add one detail"))
                )
        );
    }

    private SectionPolicy sampleSectionPolicy() {
        return new SectionPolicy(
                true,
                2,
                true,
                2,
                true,
                true,
                2,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                true,
                2,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
    }
}
