package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackCoachMissionDto;
import com.writeloop.dto.FeedbackRewriteSuggestionDto;
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
    void buildGenerationRequestBody_includesDiagnosisAndMissionDecisionFields() throws Exception {
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
                .contains("\"meaningClarity\"")
                .contains("\"grammarImpact\"")
                .contains("\"contentOpportunity\"")
                .contains("\"selectedMissionReason\"")
                .contains("\"missionDecision\"")
                .contains("\"chosenType\"")
                .contains("\"grammarPriority\"")
                .contains("\"addOnExampleEn\"")
                .contains("\"minorFixes\"")
                .contains("\"coachMission\"")
                .contains("\"score\"")
                .contains("Fill both the diagnosis fields and the feedback section fields");
    }

    @Test
    void buildGenerationRequestBody_pushesMissionDecisionBeforeCoachMission() throws Exception {
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
                .contains("Fill missionDecision by comparing the best content add-on mission against the best grammar/polish mission")
                .contains("Build exactly one coachMission from missionDecision.chosenType")
                .contains("Mission selection ladder:")
                .contains("missionDecision is the source of truth for selecting the top mission")
                .contains("missionDecision.chosenType must exactly match coachMission.missionType")
                .contains("If meaningClarity is CLEAR or PARTLY_CLEAR, contentNeed is not NONE")
                .contains("For add-on missions, coachMission.exampleEn should match missionDecision.addOnExampleEn")
                .contains("Do not rely on a generic backend fallback");
    }

    @Test
    void buildGenerationRequestBody_definesReusableUsedExpressionRulesAndExampleSchema() throws Exception {
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
        JsonNode refinementExpressionProperties = request.path("text")
                .path("format")
                .path("schema")
                .path("properties")
                .path("refinementExpressions")
                .path("items")
                .path("properties");
        String promptText = request.path("input").get(0).path("content").get(0).path("text").asText("");

        assertThat(usedExpressionProperties.path("exampleEn").isMissingNode()).isFalse();
        assertThat(usedExpressionProperties.path("tags").isMissingNode()).isFalse();
        assertThat(refinementExpressionProperties.path("exampleEn").isMissingNode()).isFalse();
        assertThat(refinementExpressionProperties.path("guidanceKo").isMissingNode()).isFalse();
        assertThat(promptText)
                .contains("Prefer phrase-level reusable chunks such as verb phrases, habit frames, time-flow frames, or reason connectors")
                .contains("Do not return full sentences, subject-heavy clauses, or chunks with answer-specific tail details")
                .contains("usedExpressions.exampleEn should be one short natural sentence")
                .contains("usedExpressions.tags must contain 2 to 6 tags")
                .contains("Tag the reusable expression itself, not the surrounding example sentence or answer context.")
                .contains("refinementExpressions are the single source")
                .contains("exampleEn must not be identical to expression");
    }

    @Test
    void parseGeneratedSectionsReadsMissionDecisionAndNormalizesTags() throws Exception {
        OpenAiFeedbackClient client = newClient();
        JsonNode payload = objectMapper.readTree("""
                {
                  "missionDecision": {
                    "chosenType": "DETAIL",
                    "grammarPriority": "LOW_VALUE_POLISH",
                    "contentNeed": "DETAIL",
                    "whyChosenKo": "The answer is clear, so adding one detail matters most.",
                    "whyNotGrammarFirstKo": "The grammar issue is small and does not block meaning.",
                    "addOnExampleEn": "I do it because it helps me feel calm.",
                    "addOnPlacementKo": "Add it after the main habit sentence.",
                    "minorFixes": [
                      {
                        "originalText": "sleep earlier",
                        "revisedText": "go to bed earlier",
                        "reasonKo": "A more natural verb phrase."
                      }
                    ]
                  },
                  "usedExpressions": [
                    {
                      "expression": "stay healthy",
                      "meaningKo": "stay healthy",
                      "exampleEn": "I want to stay healthy by sleeping earlier.",
                      "usageTip": "Use this for health goals.",
                      "tags": ["used_expression", "frequency"]
                    }
                  ],
                  "refinementExpressions": [
                    {
                      "expression": "because it helps me feel calm",
                      "guidanceKo": "Use this to add a reason.",
                      "meaningKo": "because it helps me feel calm",
                      "exampleEn": "I keep this habit because it helps me feel calm.",
                      "exampleKo": null
                    }
                  ]
                }
                """);

        GeneratedSections sections = ReflectionTestUtils.invokeMethod(
                client,
                "parseGeneratedSections",
                payload
        );

        assertThat(sections).isNotNull();
        assertThat(sections.usedExpressions()).singleElement().satisfies(expression -> {
            assertThat(expression.expression()).isEqualTo("stay healthy");
            assertThat(expression.tags()).containsExactly("used_expression", "frequency_expression");
        });
        assertThat(sections.refinementExpressions()).singleElement().satisfies(idea -> {
            assertThat(idea.expression()).isEqualTo("because it helps me feel calm");
            assertThat(idea.exampleEn()).isEqualTo("I keep this habit because it helps me feel calm.");
        });
        assertThat(sections.missionDecision()).isNotNull();
        assertThat(sections.missionDecision().chosenType()).isEqualTo("DETAIL");
        assertThat(sections.missionDecision().minorFixes()).singleElement().satisfies(fix -> {
            assertThat(fix.originalText()).isEqualTo("sleep earlier");
            assertThat(fix.revisedText()).isEqualTo("go to bed earlier");
        });
    }

    @Test
    void resolveMissionSourceOfTruthKeepsUsableLlmMissionInsteadOfGenericFallback() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedCorrectionMission = new FeedbackCoachMissionDto(
                "GRAMMAR_FIX",
                "끝 표현 고치기",
                "That is all",
                "That's all",
                "표현을 조금 줄일 수 있어요.",
                "마지막 표현만 바꿔 보세요.",
                "That's all.",
                "That's all.",
                "마지막 문장에 넣어 보세요.",
                "표현이 자연스러워지면 성공이에요."
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                76,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                MeaningClarity.CLEAR,
                GrammarImpact.POLISH,
                ContentOpportunity.REASON,
                "The answer is understandable but needs a reason more than a small polish.",
                GrammarSeverity.MINOR,
                List.of(),
                null,
                "ADD_REASON",
                null,
                new RewriteTarget("ADD_REASON", "I do this because ____.", 1),
                ExpansionBudget.ONE_SUPPORT_SENTENCE,
                List.of()
        );
        MissionDecision missionDecision = new MissionDecision(
                "GRAMMAR_FIX",
                "LOW_VALUE_POLISH",
                "REASON",
                "The LLM deliberately chose this repair.",
                "Grammar was chosen for a direct comparison card.",
                null,
                null,
                List.of()
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedCorrectionMission,
                missionDecision,
                diagnosis,
                sampleAnswerProfile(),
                "After grocery shopping, I usually go home. That is all.",
                List.of(),
                List.of(),
                null
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("GRAMMAR_FIX");
        assertThat(resolved.originalText()).isEqualTo("That is all");
        assertThat(resolved.revisedText()).isEqualTo("That's all");
    }

    @Test
    @SuppressWarnings("unchecked")
    void sanitizeRewriteSuggestionsKeepsDistinctItemsEvenWithoutNextStepPractice() {
        OpenAiFeedbackClient client = newClient();

        List<FeedbackRewriteSuggestionDto> sanitized =
                (List<FeedbackRewriteSuggestionDto>) ReflectionTestUtils.invokeMethod(
                        client,
                        "sanitizeRewriteSuggestions",
                        List.of(
                                new FeedbackRewriteSuggestionDto("for example", "for example", null),
                                new FeedbackRewriteSuggestionDto("for example.", "for example", null),
                                new FeedbackRewriteSuggestionDto("because it feels peaceful", "because it feels peaceful", null)
                        ),
                        null
                );

        assertThat(sanitized)
                .extracting(FeedbackRewriteSuggestionDto::english)
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
