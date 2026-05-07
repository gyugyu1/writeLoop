package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackCoachMissionDto;
import com.writeloop.dto.FeedbackRewriteSuggestionDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
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
                .contains("\"presentSlots\"")
                .contains("\"missingSlots\"")
                .contains("\"chosenSlot\"")
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
                .contains("Fill missionDecision by comparing the best missing-slot add-on mission against the best grammar/polish mission")
                .contains("Fill missionDecision.presentSlots and missionDecision.missingSlots before choosing the mission")
                .contains("Build exactly one coachMission from missionDecision.chosenType")
                .contains("Mission selection ladder:")
                .contains("missionDecision is the source of truth for selecting the top mission")
                .contains("missionDecision.chosenType must exactly match coachMission.missionType")
                .contains("missionDecision.presentSlots is the learner answer's content inventory")
                .contains("missionDecision.chosenSlot is the exact content slot the learner should add next")
                .contains("must appear in missingSlots")
                .contains("TASK_RESET is a last-resort reset")
                .contains("If the answer contains no prompt-relevant anchor, chosenType must be TASK_RESET")
                .contains("If taskCompletion is PARTIAL")
                .contains("SITUATION means adding when/where/context")
                .contains("fill missionDecision.presentSlots with content slots already present")
                .contains("Do not choose a mission that asks for a content slot already present")
                .contains("If the learner already says what they do, where/when/context, and why")
                .contains("commute, routine, or free-time answers that already include action + place/context + reason")
                .contains("broken word-order fragments")
                .contains("Never set EXPRESSION_POLISH for")
                .contains("Generic adjective reasons")
                .contains("it is delicious")
                .contains("Never return the same text for coachMission.originalText")
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
        JsonNode schemaProperties = request.path("text")
                .path("format")
                .path("schema")
                .path("properties");
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
        assertThat(schemaProperties.has("modelAnswerVariants")).isFalse();
        assertThat(promptText)
                .contains("Prefer phrase-level reusable chunks such as verb phrases, habit frames, time-flow frames, or reason connectors")
                .contains("Do not return full sentences, subject-heavy clauses, or chunks with answer-specific tail details")
                .contains("usedExpressions.exampleEn should be one short natural sentence")
                .contains("usedExpressions.tags must contain 2 to 6 tags")
                .contains("Tag the reusable expression itself, not the surrounding example sentence or answer context.")
                .contains("refinementExpressions are the single source")
                .contains("exampleEn must not be identical to expression")
                .doesNotContain("modelAnswerVariants rules");
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
                    "presentSlots": ["ACTION", "SITUATION"],
                    "missingSlots": ["DETAIL", "REASON"],
                    "chosenSlot": "DETAIL",
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
        assertThat(sections.missionDecision().presentSlots()).containsExactly("ACTION", "SITUATION");
        assertThat(sections.missionDecision().missingSlots()).containsExactly("DETAIL", "REASON");
        assertThat(sections.missionDecision().chosenSlot()).isEqualTo("DETAIL");
        assertThat(sections.missionDecision().minorFixes()).singleElement().satisfies(fix -> {
            assertThat(fix.originalText()).isEqualTo("sleep earlier");
            assertThat(fix.revisedText()).isEqualTo("go to bed earlier");
        });
    }

    @Test
    void resolveMissionSourceOfTruthRejectsDetailWhenAnswerAlreadyHasActionSituationAndReason() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "DETAIL",
                "구체적인 정보 한 문장 더하기",
                null,
                null,
                "작은 정보 하나가 붙으면 답변이 덜 막연해져요.",
                "언제, 어디서, 무엇을 하는지 구체적인 정보 하나를 더해 보세요.",
                "It helps me relax after work.",
                "It helps me ____.",
                "문장 끝에 붙여 보세요.",
                "느낌이나 효과가 한 문장 들어가면 성공이에요."
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                null,
                sampleDiagnosis(),
                sampleAnswerProfile(),
                "I usually watch YouTube videos on the bus or subway to pass the time.",
                List.of(),
                List.of(),
                null
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isIn("FEELING", "RESULT");
    }

    @Test
    void resolveMissionSourceOfTruthRejectsSituationForGenericReasonAnswer() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "SITUATION",
                "상황 한 문장 더하기",
                null,
                null,
                "언제 먹는지 말하면 더 좋아요.",
                "언제, 어디서, 어떤 상황인지 한 문장 더 붙여 보세요.",
                "I eat it on busy mornings.",
                "I eat it when ____.",
                "문장 끝에 붙여 보세요.",
                "상황을 보여 주는 정보가 한 문장 들어가면 성공이에요."
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                null,
                sampleDiagnosis(),
                sampleAnswerProfile(),
                "I eat toast for breakfast on weekdays because it is delicious.",
                List.of(),
                List.of(),
                null
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("REASON");
    }

    @Test
    void resolveMissionSourceOfTruthRejectsFlatClosingPolishMission() {
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
        assertThat(resolved.missionType()).isEqualTo("RESULT");
        assertThat(resolved.originalText()).isNull();
        assertThat(resolved.revisedText()).isNull();
    }

    @Test
    void resolveMissionSourceOfTruthRejectsSameTextComparisonAndUsesMeaningfulFixPoint() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "GRAMMAR_FIX",
                "Fix tense",
                "I go home",
                "I go home",
                "The comparison is not useful.",
                "Fix only the tense.",
                "I went home.",
                "I went home.",
                "Change the verb tense.",
                "The sentence uses past tense."
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                68,
                AnswerBand.GRAMMAR_BLOCKING,
                TaskCompletion.FULL,
                true,
                false,
                MeaningClarity.PARTLY_CLEAR,
                GrammarImpact.BLOCKING,
                ContentOpportunity.NONE,
                "A real before/after pair is needed.",
                GrammarSeverity.MAJOR,
                List.of(),
                "I went home.",
                "FIX_BLOCKING_GRAMMAR",
                null,
                new RewriteTarget("FIX_BLOCKING_GRAMMAR", "I went home.", 1),
                ExpansionBudget.NONE,
                List.of()
        );
        FeedbackSecondaryLearningPointDto fixPoint = new FeedbackSecondaryLearningPointDto(
                "GRAMMAR_FIX",
                "Fix tense",
                "Fix tense",
                "Past action needs past tense.",
                "I go home",
                "I went home",
                null,
                null,
                "I went home.",
                null
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                null,
                diagnosis,
                supportedCompleteProfile(),
                "I go home.",
                List.of(fixPoint),
                List.of(),
                "I went home."
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("GRAMMAR_FIX");
        assertThat(resolved.originalText()).isEqualTo("I go home");
        assertThat(resolved.revisedText()).isEqualTo("I went home");
    }

    @Test
    void resolveMissionSourceOfTruthPrefersContentMissionForThinGenericReasonOverPolish() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "EXPRESSION_POLISH",
                "Make it natural",
                "because it is delicious",
                "because it tastes rich and creamy",
                "A richer expression is possible.",
                "Change the expression.",
                "because it tastes rich and creamy.",
                "because it tastes rich and creamy.",
                "Replace the phrase.",
                "The expression sounds more natural."
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                78,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                MeaningClarity.CLEAR,
                GrammarImpact.POLISH,
                ContentOpportunity.REASON,
                "The answer needs a personal reason more than expression polish.",
                GrammarSeverity.MINOR,
                List.of(),
                null,
                "ADD_REASON",
                null,
                new RewriteTarget("ADD_REASON", "I like it because ____.", 1),
                ExpansionBudget.ONE_SUPPORT_SENTENCE,
                List.of()
        );
        MissionDecision missionDecision = new MissionDecision(
                "EXPRESSION_POLISH",
                "LOW_VALUE_POLISH",
                "REASON",
                "Prefer a reason.",
                "Minor polish is not the main issue.",
                "I like it because it reminds me of weekends.",
                "Add the reason at the end.",
                List.of()
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                missionDecision,
                diagnosis,
                sampleAnswerProfile(),
                "My favorite food is pasta. I like it because it is delicious.",
                List.of(),
                List.of(),
                null
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("REASON");
        assertThat(resolved.originalText()).isNull();
        assertThat(resolved.revisedText()).isNull();
    }

    @Test
    void resolveMissionSourceOfTruthPrefersReasonForGenericReasonEvenWhenLlmChoosesSituation() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "SITUATION",
                "Add a moment",
                null,
                null,
                "The answer could mention when.",
                "Add when you choose it.",
                "I like action movies because they feel exciting after a long day.",
                "When I ____, I ____.",
                "Add a situation.",
                "A situation is added."
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                72,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                MeaningClarity.CLEAR,
                GrammarImpact.NONE,
                ContentOpportunity.SITUATION,
                "The LLM chose situation, but the reason is too generic.",
                GrammarSeverity.NONE,
                List.of(),
                null,
                "ADD_SITUATION",
                null,
                new RewriteTarget("ADD_SITUATION", "I like it when ____.", 1),
                ExpansionBudget.ONE_SUPPORT_SENTENCE,
                List.of()
        );
        MissionDecision missionDecision = new MissionDecision(
                "SITUATION",
                "NONE",
                "SITUATION",
                "Add situation.",
                null,
                "I like action movies because they help me feel excited after a long day.",
                "Add it after because.",
                List.of()
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                missionDecision,
                diagnosis,
                sampleAnswerProfile(),
                "I like action movies because they are fun.",
                List.of(),
                List.of(),
                null
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("REASON");
    }

    @Test
    void resolveMissionSourceOfTruthPrefersGrammarFrameForBrokenSentenceEvenWhenLlmChoosesReason() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "REASON",
                "Add a better reason",
                null,
                null,
                "The reason is vague.",
                "Add why exercise is important.",
                "I want to make exercise a habit because it helps me stay healthy.",
                "I do this because ____.",
                "Add a reason.",
                "A reason is added."
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                58,
                AnswerBand.CONTENT_THIN,
                TaskCompletion.FULL,
                true,
                false,
                MeaningClarity.PARTLY_CLEAR,
                GrammarImpact.LOCAL,
                ContentOpportunity.REASON,
                "The sentence frame is broken enough to fix first.",
                GrammarSeverity.MINOR,
                List.of(),
                "I want to make exercise a habit because my health is important.",
                "ADD_REASON",
                null,
                new RewriteTarget("ADD_REASON", "I want to make exercise a habit because ____.", 1),
                ExpansionBudget.ONE_SUPPORT_SENTENCE,
                List.of()
        );
        FeedbackSecondaryLearningPointDto fixPoint = new FeedbackSecondaryLearningPointDto(
                "GRAMMAR_FIX",
                "Fix the sentence frame",
                "want make -> want to make",
                "The verb after want needs to.",
                "I want make exercise habit",
                "I want to make exercise a habit",
                null,
                null,
                "I want to make exercise a habit.",
                null
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                null,
                diagnosis,
                sampleAnswerProfile(),
                "I want make exercise habit because health good.",
                List.of(fixPoint),
                List.of(),
                "I want to make exercise a habit because my health is important."
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("GRAMMAR_FIX");
        assertThat(resolved.originalText()).isEqualTo("I want make exercise habit");
        assertThat(resolved.revisedText()).isEqualTo("I want to make exercise a habit");
    }

    @Test
    void resolveMissionSourceOfTruthForcesTaskResetForRomanizedKoreanAnswer() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "GRAMMAR_FIX",
                "Rewrite as English",
                "molla geunyang joa yo cafe eumryo",
                "I like to order a cafe drink when I need a boost.",
                "The answer can be rewritten.",
                "Rewrite it in English.",
                "I like to order a cafe drink when I need a boost.",
                "I like to order ____ when ____.",
                "Rewrite the answer.",
                "The sentence is in English."
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                34,
                AnswerBand.GRAMMAR_BLOCKING,
                TaskCompletion.PARTIAL,
                true,
                false,
                MeaningClarity.BLOCKED,
                GrammarImpact.BLOCKING,
                ContentOpportunity.SITUATION,
                "The model tried to repair romanized Korean.",
                GrammarSeverity.MAJOR,
                List.of(),
                "I like to order a cafe drink when I need a boost.",
                "FIX_BLOCKING_GRAMMAR",
                null,
                new RewriteTarget("FIX_BLOCKING_GRAMMAR", "I like to order ____ when ____.", 1),
                ExpansionBudget.ONE_SUPPORT_SENTENCE,
                List.of()
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                null,
                diagnosis,
                sampleAnswerProfile(),
                "molla geunyang joa yo cafe eumryo",
                List.of(),
                List.of(),
                "I like to order a cafe drink when I need a boost."
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("TASK_RESET");
        assertThat(resolved.originalText()).isNull();
        assertThat(resolved.revisedText()).isNull();
    }

    @Test
    void shouldForceTaskResetAnswerDetectsMeaninglessAndNonEnglishAnswersConservatively() {
        OpenAiFeedbackClient client = newClient();

        Boolean wordSalad = ReflectionTestUtils.invokeMethod(
                client,
                "shouldForceTaskResetAnswer",
                "banana chair blue sleep 123"
        );
        Boolean romanizedKoreanCommute = ReflectionTestUtils.invokeMethod(
                client,
                "shouldForceTaskResetAnswer",
                "beoseu tago hakgyo gayo geunyang pigon"
        );
        Boolean hangul = ReflectionTestUtils.invokeMethod(
                client,
                "shouldForceTaskResetAnswer",
                "그냥 아무거나 좋아요"
        );
        Boolean validEnglish = ReflectionTestUtils.invokeMethod(
                client,
                "shouldForceTaskResetAnswer",
                "I like banana bread because it tastes sweet."
        );

        assertThat(wordSalad).isTrue();
        assertThat(romanizedKoreanCommute).isTrue();
        assertThat(hangul).isTrue();
        assertThat(validEnglish).isFalse();
    }

    @Test
    void looksLikeBrokenSentenceFrameCatchesCommonKoreanLearnerFrames() {
        OpenAiFeedbackClient client = newClient();

        Boolean wantBuild = ReflectionTestUtils.invokeMethod(
                client,
                "looksLikeBrokenSentenceFrame",
                "I want build reading habit because it make me smart."
        );
        Boolean needWake = ReflectionTestUtils.invokeMethod(
                client,
                "looksLikeBrokenSentenceFrame",
                "I drink ice americano when I need wake up because bitter taste is good."
        );
        Boolean goCompany = ReflectionTestUtils.invokeMethod(
                client,
                "looksLikeBrokenSentenceFrame",
                "In weekday morning, I wake up and wash face then go company."
        );
        Boolean listenMusic = ReflectionTestUtils.invokeMethod(
                client,
                "looksLikeBrokenSentenceFrame",
                "I go to work by subway and listen music in the train."
        );
        Boolean washDish = ReflectionTestUtils.invokeMethod(
                client,
                "looksLikeBrokenSentenceFrame",
                "After dinner I wash dish and take a rest on sofa."
        );
        Boolean speakConfident = ReflectionTestUtils.invokeMethod(
                client,
                "looksLikeBrokenSentenceFrame",
                "I want speak confident in meeting because my idea is not hear by people."
        );
        Boolean cleanSentence = ReflectionTestUtils.invokeMethod(
                client,
                "looksLikeBrokenSentenceFrame",
                "I like comedy movies because they are fun."
        );

        assertThat(wantBuild).isTrue();
        assertThat(needWake).isTrue();
        assertThat(goCompany).isTrue();
        assertThat(listenMusic).isTrue();
        assertThat(washDish).isTrue();
        assertThat(speakConfident).isTrue();
        assertThat(cleanSentence).isFalse();
    }

    @Test
    void shouldRejectGeneratedMissionRejectsComparisonThatActuallyAddsContent() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto additiveComparison = new FeedbackCoachMissionDto(
                "GRAMMAR_FIX",
                "Add a reason",
                "After grocery shopping, I go home and put food in the refrigerator. Then I rest.",
                "After grocery shopping, I go home and put food in the refrigerator. Then I rest because I feel tired.",
                "This adds a reason, not a grammar repair.",
                "Add one reason sentence.",
                "Then I rest because I feel tired.",
                "Then I rest because ____.",
                "Add it at the end.",
                "A reason is included."
        );

        Boolean rejected = ReflectionTestUtils.invokeMethod(
                client,
                "shouldRejectGeneratedMission",
                additiveComparison,
                null,
                sampleDiagnosis(),
                sampleAnswerProfile(),
                "After grocery shopping, I go home and put food in the refrigerator. Then I rest."
        );

        assertThat(rejected).isTrue();
    }

    @Test
    void resolveMissionSourceOfTruthDowngradesReadyAnswerGrammarFixToExpressionPolish() {
        OpenAiFeedbackClient client = newClient();
        FeedbackCoachMissionDto generatedMission = new FeedbackCoachMissionDto(
                "GRAMMAR_FIX",
                "Make the phrase natural",
                "that time is easier to keep",
                "that time is easier to stick to",
                "The answer is already complete, but this phrase can be more natural.",
                "Change only the highlighted phrase.",
                "that time is easier to stick to",
                "that time is easier to stick to",
                "Change the marked phrase.",
                "The phrase sounds natural."
        );
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                93,
                AnswerBand.NATURAL_BUT_BASIC,
                TaskCompletion.FULL,
                true,
                true,
                MeaningClarity.CLEAR,
                GrammarImpact.POLISH,
                ContentOpportunity.NONE,
                "The answer is finishable; this is only a small naturalness polish.",
                GrammarSeverity.MINOR,
                List.of(),
                null,
                "IMPROVE_NATURALNESS",
                null,
                new RewriteTarget("IMPROVE_NATURALNESS", null, 0),
                ExpansionBudget.NONE,
                List.of()
        );

        FeedbackCoachMissionDto resolved = ReflectionTestUtils.invokeMethod(
                client,
                "resolveMissionSourceOfTruth",
                generatedMission,
                null,
                diagnosis,
                sampleAnswerProfile(),
                "My health goal is to build a steady walking habit. I plan to walk for twenty minutes after dinner because that time is easier to keep.",
                List.of(),
                List.of(),
                null
        );

        assertThat(resolved).isNotNull();
        assertThat(resolved.missionType()).isEqualTo("EXPRESSION_POLISH");
        assertThat(resolved.originalText()).isEqualTo("that time is easier to keep");
        assertThat(resolved.revisedText()).isEqualTo("that time is easier to stick to");
    }

    @Test
    void isLoopCompleteAllowsSupportedNaturalAnswerEvenWhenModelDoesNotMarkFinishable() {
        OpenAiFeedbackClient client = newClient();
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                88,
                AnswerBand.NATURAL_BUT_BASIC,
                TaskCompletion.FULL,
                true,
                false,
                MeaningClarity.CLEAR,
                GrammarImpact.NONE,
                ContentOpportunity.NONE,
                "The answer is clear and supported.",
                GrammarSeverity.NONE,
                List.of(),
                null,
                "IMPROVE_NATURALNESS",
                null,
                new RewriteTarget("IMPROVE_NATURALNESS", null, 0),
                ExpansionBudget.NONE,
                List.of()
        );

        Boolean complete = ReflectionTestUtils.invokeMethod(
                client,
                "isLoopComplete",
                "After grocery shopping, I go home and put the food in the refrigerator because I am tired.",
                diagnosis,
                supportedCompleteProfile(),
                List.of(),
                List.of()
        );

        assertThat(complete).isTrue();
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
                        )
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

    private AnswerProfile supportedCompleteProfile() {
        return new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC, false),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), null, true),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, true, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "IMPROVE_NATURALNESS",
                        null,
                        new RewriteTarget("IMPROVE_NATURALNESS", null, 0),
                        ExpansionBudget.NONE,
                        List.of(),
                        new ProgressDelta(List.of("answer the question"), List.of())
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
