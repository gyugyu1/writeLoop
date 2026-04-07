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
    void buildDiagnosisRequestBody_usesDiagnosisModel() throws Exception {
        OpenAiFeedbackClient client = newClient();

        String requestBody = ReflectionTestUtils.invokeMethod(
                client,
                "buildDiagnosisRequestBody",
                samplePrompt(),
                "I wake up at 8 a.m.",
                List.of(),
                1,
                null
        );

        JsonNode request = objectMapper.readTree(requestBody);
        assertThat(request.path("model").asText()).isEqualTo("gpt-5.4-nano");
    }

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

    private OpenAiFeedbackClient newClient() {
        return new OpenAiFeedbackClient(
                objectMapper,
                "test-key",
                "gpt-5.4-mini",
                "gpt-5.4-nano",
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
