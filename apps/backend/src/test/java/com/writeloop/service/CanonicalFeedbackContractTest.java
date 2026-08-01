package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CanonicalFeedbackContractTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CanonicalFeedbackContract contract = new CanonicalFeedbackContract(objectMapper);

    @Test
    void schemaContainsOnlyCanonicalLlmResponsibilities() {
        JsonNode schema = objectMapper.valueToTree(contract.schema(prompt()));
        JsonNode properties = schema.path("properties");
        List<String> names = new ArrayList<>();
        properties.fieldNames().forEachRemaining(names::add);

        assertThat(names).containsExactlyInAnyOrder(
                "topicAssessment",
                "structureAssessment",
                "languageAssessment",
                "strengths",
                "refinementExpressions",
                "slotAssessments",
                "modelAnswer",
                "modelAnswerKo"
        );
        assertThat(properties.has("grammarIssues")).isFalse();
        assertThat(properties.has("correctedAnswer")).isFalse();
        assertThat(properties.has("missionDecision")).isFalse();
        assertThat(properties.path("structureAssessment").path("required"))
                .extracting(JsonNode::asText)
                .containsExactly("status");
        JsonNode languageAssessment = properties.path("languageAssessment");
        assertThat(languageAssessment.path("required"))
                .extracting(JsonNode::asText)
                .containsExactly("revisionSteps");
        assertThat(languageAssessment.path("properties").path("revisionSteps").path("maxItems").asInt())
                .isEqualTo(25);
        assertThat(languageAssessment.path("properties").path("revisionSteps")
                .path("items").path("properties").path("kind").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactly("STRUCTURE", "GRAMMAR_BLOCKING", "GRAMMAR_LOCAL");
        assertThat(languageAssessment.path("properties").path("revisionSteps")
                .path("items").path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("kind", "answerAfter", "reasonKo");
        assertThat(languageAssessment.path("properties").path("revisionSteps")
                .path("items").path("properties").has("code")).isFalse();
        assertThat(languageAssessment.path("properties").path("revisionSteps")
                .path("items").path("properties").has("instructionKo")).isFalse();
        assertThat(languageAssessment.path("properties").has("revisedAnswer")).isFalse();
        assertThat(languageAssessment.path("properties").has("issues")).isFalse();
        JsonNode refinementItem = properties.path("refinementExpressions").path("items");
        assertThat(refinementItem.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("expression", "meaningKo", "guidanceKo", "exampleEn");
        assertThat(refinementItem.path("properties").has("exampleKo")).isFalse();
        JsonNode slotSupportItem = properties.path("slotAssessments")
                .path("properties")
                .path("ACTION")
                .path("properties")
                .path("support")
                .path("items");
        assertThat(slotSupportItem.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder(
                        "title",
                        "whyKo",
                        "instructionKo",
                        "skeletonEn",
                        "skeletonKo",
                        "suggestedPhrases"
                );
        assertThat(slotSupportItem.path("properties").has("exampleEn")).isFalse();
        assertThat(slotSupportItem.path("properties").has("targetHintKo")).isFalse();
        assertThat(schema.path("required")).hasSize(names.size());
    }

    @Test
    void promptDefinesCumulativeFullAnswerRevisionSteps() {
        assertThat(contract.developerPrompt())
                .contains("languageAssessment.revisionSteps is the only authoritative language revision")
                .contains("complete learner answer")
                .contains("preserve all earlier corrections exactly")
                .contains("at most 25 steps")
                .contains("Order steps by kind")
                .contains("\"I'm like eat\" -> \"I like eating\"");
    }

    @Test
    void promptKeepsNaturalnessOutOfRequiredLanguageCorrections() {
        assertThat(contract.developerPrompt())
                .contains("If it can, do not revise it")
                .contains("practice a five-minute conversation")
                .contains("optional alternative in refinementExpressions")
                .contains("They are optional for the learner to use and never block completion");
    }

    @Test
    void schemaAndPromptRequireAtLeastTwoDiverseRefinementExpressionsWithoutMaximum() {
        JsonNode refinementExpressions = objectMapper.valueToTree(contract.schema(prompt()))
                .path("properties")
                .path("refinementExpressions");

        assertThat(refinementExpressions.path("minItems").asInt()).isEqualTo(2);
        assertThat(refinementExpressions.has("maxItems")).isFalse();
        assertThat(contract.developerPrompt())
                .contains("Always return at least two refinementExpressions")
                .contains("one useful vocabulary, collocation, or phrasal expression")
                .contains("one sentence frame, connector, emphasis, contrast, reason, result, or detail-building expression")
                .contains("do not stop at two")
                .contains("without adding new facts")
                .contains("Do not recommend wording the learner already used");
    }

    @Test
    void promptKeepsStructureTopicAndSlotRules() {
        assertThat(contract.developerPrompt())
                .contains("An imperative sentence can be structurally complete")
                .contains("changes the actor to implicit \"you\"")
                .contains("skeletonKo must be a Korean-language scaffold containing Hangul")
                .contains("Fixed context already supplied by the question")
                .contains("smallest exact learner-answer span")
                .contains("preserve the learner's incorrect original wording in evidence");
    }

    @Test
    void schemaRequiresEveryConfiguredSlotAndTwoSuggestedPhrases() {
        JsonNode properties = objectMapper.valueToTree(contract.schema(prompt())).path("properties");
        JsonNode slotAssessments = properties.path("slotAssessments");

        assertThat(slotAssessments.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("ACTION", "REASON");
        assertThat(slotAssessments.path("properties").path("ACTION").path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("evidence", "support");
        assertThat(slotAssessments.path("properties").path("ACTION")
                .path("properties").has("status")).isFalse();
        assertThat(slotAssessments.path("properties").path("REASON")
                .path("properties").path("support").path("items").path("properties")
                .path("suggestedPhrases").path("minItems").asInt()).isEqualTo(2);
    }

    @Test
    void userPromptCarriesQuestionMetadataAndNotBackendDecisions() throws Exception {
        JsonNode payload = objectMapper.readTree(contract.userPrompt(
                prompt(),
                "I take a walk.",
                List.of()
        ));

        assertThat(payload.path("learnerAnswer").asText()).isEqualTo("I take a walk.");
        assertThat(payload.path("question").path("questionEn").asText())
                .isEqualTo("What do you usually do after work and why?");
        assertThat(payload.path("questionContract").path("requiredSlots").get(0).asText())
                .isEqualTo("ACTION");
        assertThat(payload.path("questionContract").path("slotContracts").path("REASON")
                .path("semanticRole").asText())
                .isEqualTo("The learner's reason for the usual action.");
        assertThat(payload.has("attemptIndex")).isFalse();
        assertThat(payload.has("previousAnswer")).isFalse();
        assertThat(payload.has("previousCoachingSummary")).isFalse();
        assertThat(payload.has("missionDecision")).isFalse();
    }

    @Test
    void contractRetryPromptIncludesDiffContractAndFailureReason() throws Exception {
        String originalPrompt = contract.userPrompt(
                prompt(),
                "i take phill to stay focus.",
                List.of()
        );
        String rejectedOutput = """
                {
                  "languageAssessment": {
                    "revisionSteps": [{
                      "kind": "GRAMMAR_LOCAL",
                      "answerAfter": "I take a pill to stay focused.",
                      "reasonKo": "철자를 고쳐야 합니다."
                    }]
                  }
                }
                """;

        JsonNode payload = objectMapper.readTree(contract.contractRetryPrompt(
                originalPrompt,
                rejectedOutput,
                "revision step 1 revises an earlier protected range"
        ));

        assertThat(payload.path("requestType").asText()).isEqualTo("CANONICAL_CONTRACT_RETRY");
        assertThat(payload.path("retryInstruction").path("validationError").asText())
                .contains("protected range");
        assertThat(payload.path("retryInstruction").path("requiredAction").asText())
                .contains("cumulative complete answerAfter")
                .contains("Preserve every earlier correction exactly");
        assertThat(payload.path("originalInput").path("learnerAnswer").asText())
                .isEqualTo("i take phill to stay focus.");
        assertThat(payload.path("rejectedOutput").path("languageAssessment")
                .path("revisionSteps").get(0).path("answerAfter").asText())
                .isEqualTo("I take a pill to stay focused.");
    }

    @Test
    void parsesCanonicalLanguageAssessment() throws Exception {
        CanonicalLlmOutput output = contract.parse(canonicalJson("""
                "languageAssessment": {
                  "revisionSteps": [{
                    "kind": "GRAMMAR_LOCAL",
                    "answerAfter": "I go home because I am tired.",
                    "reasonKo": "I 뒤에는 동사원형이 필요해요."
                  }]
                },
                """));

        assertThat(output.diagnosis().structureAssessment().status())
                .isEqualTo(StructureStatus.COMPLETE);
        assertThat(output.diagnosis().languageAssessment().revisionSteps()).singleElement()
                .satisfies(step -> {
                    assertThat(step.kind()).isEqualTo(LanguageIssueKind.GRAMMAR_LOCAL);
                    assertThat(step.answerAfter()).isEqualTo("I go home because I am tired.");
                });
        assertThat(output.diagnosis().strongestGrammarImpact()).isEqualTo(GrammarImpact.LOCAL);
    }

    @Test
    void derivesBlockingImpactFromUnifiedLanguageIssues() throws Exception {
        CanonicalLlmOutput output = contract.parse(canonicalJson("""
                "languageAssessment": {
                  "revisionSteps": [
                    {
                      "kind": "GRAMMAR_BLOCKING",
                      "answerAfter": "I do not work today.",
                      "reasonKo": "어순 때문에 의미가 막혀요."
                    }
                  ]
                },
                """));

        assertThat(output.diagnosis().strongestGrammarImpact()).isEqualTo(GrammarImpact.BLOCKING);
    }

    @Test
    void parsesFragmentWithUnifiedStructureIssue() throws Exception {
        CanonicalLlmOutput output = contract.parse("""
                {
                  "topicAssessment": {"status": "ON_TOPIC", "reasonKo": "질문에 관련된 답이에요."},
                  "structureAssessment": {"status": "FRAGMENT"},
                  "languageAssessment": {
                    "revisionSteps": [{
                      "kind": "STRUCTURE",
                      "answerAfter": "After work, I usually eat noodles.",
                      "reasonKo": "주어와 동사가 필요해요."
                    }]
                  },
                  "strengths": [],
                  "refinementExpressions": [],
                  "slotAssessments": {
                    "ACTION": {"evidence": "noodles", "support": []},
                    "REASON": {
                      "evidence": "",
                      "support": [{
                        "title": "이유 더하기",
                        "whyKo": "이유가 필요해요.",
                        "instructionKo": "구체적인 이유를 쓰세요.",
                        "skeletonEn": "I eat noodles because ____.",
                        "skeletonKo": "저는 ____ 때문에 국수를 먹어요.",
                        "suggestedPhrases": [
                          {"phrase": "they are quick", "meaningKo": "빨리 준비돼요"},
                          {"phrase": "I like the taste", "meaningKo": "맛을 좋아해요"}
                        ]
                      }]
                    }
                  },
                  "modelAnswer": "After work, I usually eat noodles because they are quick.",
                  "modelAnswerKo": "퇴근 후에는 빨리 준비할 수 있어서 보통 국수를 먹어요."
                }
                """);

        assertThat(output.diagnosis().structureAssessment().status()).isEqualTo(StructureStatus.FRAGMENT);
        assertThat(output.diagnosis().languageAssessment().revisionSteps()).singleElement()
                .satisfies(step -> assertThat(step.kind()).isEqualTo(LanguageIssueKind.STRUCTURE));
    }

    private String canonicalJson(String languageAssessment) {
        return """
                {
                  "topicAssessment": {"status": "ON_TOPIC", "reasonKo": "Relevant answer"},
                  "structureAssessment": {"status": "COMPLETE"},
                  %s
                  "strengths": [],
                  "refinementExpressions": [],
                  "slotAssessments": {},
                  "modelAnswer": "I go home because I am tired.",
                  "modelAnswerKo": "피곤해서 집에 가요."
                }
                """.formatted(languageAssessment);
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work and why?",
                "퇴근 후 보통 무엇을 하고 왜 그렇게 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of("REASON"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        1,
                        Map.of(
                                "ACTION", new PromptSlotContractDto(
                                        "The learner's usual action after work.",
                                        "The answer states an action the learner usually performs after work.",
                                        "학습자가 퇴근 후 하는 행동.",
                                        "행동을 분명히 제시하면 충족."
                                ),
                                "REASON", new PromptSlotContractDto(
                                        "The learner's reason for the usual action.",
                                        "The answer gives a concrete motivation that explains why the learner performs the action.",
                                        "그 행동을 하는 이유.",
                                        "구체적인 이유를 제시하면 충족."
                                )
                        )
                )
        );
    }
}
