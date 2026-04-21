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
    void buildGenerationRequestBody_defines_reusable_used_expression_rules_and_example_schema() throws Exception {
        OpenAiFeedbackClient client = newClient();

        String requestBody = ReflectionTestUtils.invokeMethod(
                client,
                "buildGenerationRequestBody",
                samplePrompt(),
                "I usually watch YouTube videos and get ready for the next day.",
                List.of(),
                sampleDiagnosis(),
                sampleAnswerProfile(),
                sampleSectionPolicy(),
                1,
                null,
                List.of(SectionKey.USED_EXPRESSIONS),
                List.of(),
                null
        );

        JsonNode request = objectMapper.readTree(requestBody);
        JsonNode usedExpressionProperties = request.path("text")
                .path("format")
                .path("schema")
                .path("properties")
                .path("usedExpressions")
                .path("items")
                .path("properties");
        JsonNode rewriteIdeaProperties = request.path("text")
                .path("format")
                .path("schema")
                .path("properties")
                .path("rewriteIdeas")
                .path("items")
                .path("properties");
        String promptText = request.path("input").get(0).path("content").get(0).path("text").asText("");

        assertThat(usedExpressionProperties.path("exampleEn").isMissingNode()).isFalse();
        assertThat(usedExpressionProperties.path("tags").isMissingNode()).isFalse();
        assertThat(rewriteIdeaProperties.path("exampleEn").isMissingNode()).isFalse();
        assertThat(rewriteIdeaProperties.path("tags").isMissingNode()).isFalse();
        assertThat(promptText)
                .contains("Prefer phrase-level reusable chunks such as verb phrases, habit frames, time-flow frames, or reason connectors")
                .contains("Do not return full sentences, subject-heavy clauses, or chunks with answer-specific tail details")
                .contains("usedExpressions.exampleEn should be one short natural sentence")
                .contains("usedExpressions.tags must contain 2 to 6 tags")
                .contains("Tag the reusable expression itself, not the surrounding example sentence or answer context.")
                .contains("Do not assign `time_expression` to generic actions like `take a walk`, `read a book`, or `watch videos`")
                .contains("For reusable no-pair rewriteIdeas, include exampleEn as one short natural sentence")
                .contains("rewriteIdeas.tags must contain 2 to 6 tags");
    }

    @Test
    void parseGeneratedSections_reads_and_normalizes_tags() throws Exception {
        OpenAiFeedbackClient client = newClient();
        JsonNode payload = objectMapper.readTree("""
                {
                  "usedExpressions": [
                    {
                      "expression": "stay healthy",
                      "meaningKo": "건강을 유지하다",
                      "exampleEn": "I want to stay healthy by sleeping earlier.",
                      "usageTip": "자주 쓰는 건강 목표 표현이에요.",
                      "tags": ["used_expression", "frequency"]
                    }
                  ],
                  "rewriteIdeas": [
                    {
                      "title": "Add a reason",
                      "english": "because it helps me feel calm",
                      "meaningKo": "마음을 차분하게 해 주기 때문에",
                      "noteKo": "이유를 덧붙일 때 자연스러워요.",
                      "exampleEn": "I keep this habit because it helps me feel calm.",
                      "originalText": null,
                      "revisedText": null,
                      "optionalTone": false,
                      "tags": ["refinement", "reason"]
                    }
                  ]
                }
                """);

        GeneratedSections sections = (GeneratedSections) ReflectionTestUtils.invokeMethod(
                client,
                "parseGeneratedSections",
                payload
        );

        assertThat(sections.usedExpressions()).singleElement().satisfies(expression -> {
            assertThat(expression.expression()).isEqualTo("stay healthy");
            assertThat(expression.tags()).containsExactly("used_expression", "frequency_expression");
        });
        assertThat(sections.rewriteIdeas()).singleElement().satisfies(idea -> {
            assertThat(idea.english()).isEqualTo("because it helps me feel calm");
            assertThat(idea.tags()).containsExactly("refinement_expression", "reason_expression");
        });
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
