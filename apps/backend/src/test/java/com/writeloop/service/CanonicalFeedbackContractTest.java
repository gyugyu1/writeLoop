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
                "grammarIssues",
                "strengths",
                "usedExpressions",
                "refinementExpressions",
                "slotAssessments",
                "modelAnswer",
                "modelAnswerKo"
        );
        assertThat(properties.has("score")).isFalse();
        assertThat(properties.has("answerBand")).isFalse();
        assertThat(properties.has("taskCompletion")).isFalse();
        assertThat(properties.has("missionDecision")).isFalse();
        assertThat(properties.has("fixPoints")).isFalse();
        assertThat(properties.has("chosenType")).isFalse();
        assertThat(properties.has("actionType")).isFalse();
        assertThat(properties.has("grammarImpact")).isFalse();
        assertThat(properties.has("utteranceForm")).isFalse();
        assertThat(properties.has("correctedAnswer")).isFalse();
        assertThat(properties.has("structureIssues")).isFalse();
        assertThat(properties.path("grammarIssues").path("items").path("required"))
                .anySatisfy(field -> assertThat(field.asText()).isEqualTo("impact"));
        assertThat(properties.path("grammarIssues").path("items")
                .path("properties").path("impact").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactly("LOCAL", "BLOCKING");
        assertThat(schema.path("required")).hasSize(names.size());
    }

    @Test
    void promptKeepsOptionalNaturalnessOutOfGrammarIssues() {
        assertThat(contract.developerPrompt())
                .contains("grammarIssues is only for text that is grammatically unacceptable")
                .contains("Each grammarIssue has exactly one impact: LOCAL or BLOCKING")
                .contains("practice a five-minute conversation")
                .contains("Put a useful optional alternative in refinementExpressions instead")
                .contains("refinementExpressions are optional alternatives");
    }

    @Test
    void promptRejectsImperativeReadingWhenQuestionRequiresSelfDescription() {
        assertThat(contract.developerPrompt())
                .contains("An imperative sentence can be structurally complete")
                .contains("changes the actor to implicit \"you\"")
                .contains("set structureAssessment.status to FRAGMENT")
                .contains("restore the learner as the subject");
    }

    @Test
    void promptRequiresSkeletonKoToContainKorean() {
        assertThat(contract.developerPrompt())
                .contains("skeletonKo must be a Korean-language scaffold containing Hangul")
                .contains("not an English scaffold copied from skeletonEn")
                .contains("Translate the fixed wording into Korean");
    }

    @Test
    void promptContrastsVagueSlotAttemptsWithConcreteEvidence() {
        assertThat(contract.developerPrompt())
                .contains("questionContract.slotContracts")
                .contains("semanticRole is this question's exact relationship")
                .contains("smallest exact learner-answer span that, when interpreted together with the original question")
                .contains("Concrete information may be brief")
                .contains("because it is nice\" is GENERIC")
                .contains("because blue reminds me of the ocean\" is SATISFIED")
                .contains("a nice area\" is GENERIC")
                .contains("used to meet differently\" is GENERIC")
                .contains("Use MISSING only when the answer contains no information attempting that slot");
    }

    @Test
    void promptInheritsFixedQuestionContextWithoutInventingRequestedSlotValues() {
        assertThat(contract.developerPrompt())
                .contains("Assess every slot by interpreting the original question and the learner answer together")
                .contains("Fixed context already supplied by the question")
                .contains("does not need to be repeated in the learner answer")
                .contains("Do not inherit question context when")
                .contains("Never treat the value a question asks the learner to provide as already supplied")
                .contains("\"too many tasks\" can prove PROBLEM without repeating \"at work or school\"")
                .contains("the question does not supply a PLACE value");
    }

    @Test
    void promptKeepsSlotEvidenceInTheUncorrectedLearnerWording() {
        assertThat(contract.developerPrompt())
                .contains("Copy slot evidence from the untouched learner answer before applying any grammar correction")
                .contains("preserve the learner's incorrect original wording in evidence")
                .contains("valid ACTION evidence is \"washes the dishes\"")
                .contains("\"wash the dishes\" is invalid");
    }

    @Test
    void schemaRequiresEveryConfiguredSlotAndTwoSuggestedPhrases() {
        JsonNode schema = objectMapper.valueToTree(contract.schema(prompt()));
        JsonNode properties = schema.path("properties");

        JsonNode slotAssessments = properties.path("slotAssessments");
        assertThat(slotAssessments.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("ACTION", "REASON");
        assertThat(slotAssessments.path("properties").path("ACTION").path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("evidence", "support");
        assertThat(slotAssessments.path("properties").path("ACTION")
                .path("properties").has("status")).isFalse();
        assertThat(slotAssessments.path("properties").path("ACTION")
                .path("properties").path("support").path("maxItems").asInt()).isEqualTo(1);
        JsonNode structureAssessment = properties.path("structureAssessment");
        assertThat(structureAssessment.path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder("status", "repair");
        assertThat(structureAssessment.path("properties").path("status").path("enum"))
                .extracting(JsonNode::asText)
                .containsExactly("COMPLETE", "FRAGMENT");
        assertThat(structureAssessment.path("properties").path("repair").path("maxItems").asInt())
                .isEqualTo(1);
        assertThat(structureAssessment.path("properties").path("repair").path("items").path("required"))
                .extracting(JsonNode::asText)
                .containsExactlyInAnyOrder(
                        "originalText",
                        "correctedAnswer",
                        "reasonKo",
                        "instructionKo"
                );
        assertThat(slotAssessments.path("properties").path("REASON")
                .path("properties")
                .path("support")
                .path("items")
                .path("properties")
                .path("suggestedPhrases")
                .path("minItems")
                .asInt()).isEqualTo(2);
        assertThat(slotAssessments.path("properties").path("REASON")
                .path("properties").path("support").path("items").path("required"))
                .anySatisfy(field -> assertThat(field.asText()).isEqualTo("skeletonEn"))
                .anySatisfy(field -> assertThat(field.asText()).isEqualTo("skeletonKo"));
        assertThat(slotAssessments.path("properties").path("REASON")
                .path("properties").path("support").path("items").path("properties").has("slot"))
                .isFalse();
    }

    @Test
    void userPromptCarriesQuestionMetadataAndNotBackendDecisions() throws Exception {
        JsonNode payload = objectMapper.readTree(contract.userPrompt(
                prompt(),
                "I take a walk.",
                List.of(),
                1,
                null,
                null
        ));

        assertThat(payload.path("learnerAnswer").asText()).isEqualTo("I take a walk.");
        assertThat(payload.path("questionContract").path("requiredSlots").get(0).asText())
                .isEqualTo("ACTION");
        assertThat(payload.path("questionContract").path("depthSlots").get(0).asText())
                .isEqualTo("REASON");
        assertThat(payload.path("questionContract").path("slotContracts").path("REASON")
                .path("definition").asText())
                .contains("because it is nice")
                .contains("GENERIC");
        assertThat(payload.path("questionContract").path("slotContracts").path("REASON")
                .path("semanticRole").asText())
                .isEqualTo("The learner's reason for the usual action.");
        assertThat(payload.path("questionContract").path("slotContracts").path("REASON")
                .path("satisfiedWhen").asText())
                .contains("explains why");
        assertThat(payload.has("missionDecision")).isFalse();
    }

    @Test
    void parsesCanonicalDiagnosisWithoutLegacyFields() throws Exception {
        CanonicalLlmOutput output = contract.parse("""
                {
                  "topicAssessment": {"status": "ON_TOPIC", "reasonKo": "Relevant answer"},
                  "structureAssessment": {"status": "COMPLETE", "repair": []},
                  "grammarIssues": [],
                  "strengths": ["The action is clear."],
                  "usedExpressions": [],
                  "refinementExpressions": [],
                  "slotAssessments": {
                    "ACTION": {
                      "evidence": "take a walk",
                      "support": []
                    },
                    "REASON": {
                      "evidence": "",
                      "support": [{
                      "title": "Add a reason",
                      "whyKo": "A reason adds depth.",
                      "instructionKo": "Add one concrete reason.",
                      "exampleEn": "I take a walk because it helps me relax.",
                      "skeletonEn": "I take a walk because ____.",
                      "skeletonKo": "I take a walk because ____.",
                      "suggestedPhrases": [
                        {"phrase": "it helps me relax", "meaningKo": "relax"},
                        {"phrase": "I need fresh air", "meaningKo": "fresh air"}
                      ],
                      "targetHintKo": "Give one reason."
                      }]
                    }
                  },
                  "modelAnswer": "I usually take a walk after work because it helps me relax.",
                  "modelAnswerKo": "Reference translation"
                }
                """);

        assertThat(output.diagnosis().topicRelevance()).isEqualTo(TopicRelevance.ON_TOPIC);
        assertThat(output.diagnosis().structureAssessment().status()).isEqualTo(StructureStatus.COMPLETE);
        assertThat(output.diagnosis().structureAssessment().repair()).isEmpty();
        assertThat(output.diagnosis().strongestGrammarImpact()).isEqualTo(GrammarImpact.NONE);
        assertThat(output.slotAssessments().values()).containsOnlyKeys("ACTION", "REASON");
        assertThat(output.slotAssessments().values().get("ACTION").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.SATISFIED);
        assertThat(output.slotAssessments().values().get("REASON").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.MISSING);
        assertThat(output.slotAssessments().values().get("ACTION").support()).isEmpty();
        assertThat(output.slotAssessments().values().get("REASON").support()).singleElement()
                .satisfies(support -> assertThat(support.suggestedPhrases()).hasSize(2));
    }

    @Test
    void derivesStrongestGrammarImpactFromTheIssueList() throws Exception {
        CanonicalLlmOutput output = contract.parse("""
                {
                  "topicAssessment": {"status": "ON_TOPIC", "reasonKo": "Relevant answer"},
                  "structureAssessment": {"status": "COMPLETE", "repair": []},
                  "grammarIssues": [
                    {
                      "impact": "LOCAL",
                      "code": "SUBJECT_VERB",
                      "originalText": "I goes",
                      "revisedText": "I go",
                      "reasonKo": "Subject-verb agreement error",
                      "instructionKo": "Use the base verb with I"
                    },
                    {
                      "impact": "BLOCKING",
                      "code": "WORD_ORDER",
                      "originalText": "I work no",
                      "revisedText": "I do not work",
                      "reasonKo": "Meaning is blocked",
                      "instructionKo": "Restore the sentence order"
                    }
                  ],
                  "strengths": [],
                  "usedExpressions": [],
                  "refinementExpressions": [],
                  "slotAssessments": {},
                  "modelAnswer": "I do not work today.",
                  "modelAnswerKo": "Reference translation"
                }
                """);

        assertThat(output.diagnosis().strongestGrammarImpact()).isEqualTo(GrammarImpact.BLOCKING);
        assertThat(output.diagnosis().grammarIssues())
                .extracting(DiagnosedGrammarIssue::impact)
                .containsExactly(GrammarImpact.LOCAL, GrammarImpact.BLOCKING);
    }

    @Test
    void parsesOptionalNaturalnessAsRefinementWithoutGrammarIssue() throws Exception {
        CanonicalLlmOutput output = contract.parse("""
                {
                  "topicAssessment": {"status": "ON_TOPIC", "reasonKo": "질문에 맞게 답했어요."},
                  "structureAssessment": {"status": "COMPLETE", "repair": []},
                  "grammarIssues": [],
                  "strengths": ["목표와 계획이 구체적이에요."],
                  "usedExpressions": [],
                  "refinementExpressions": [{
                    "expression": "practice having a five-minute conversation",
                    "meaningKo": "5분 동안 대화하는 연습을 하다",
                    "guidanceKo": "원문도 맞고, 이렇게도 말할 수 있어요.",
                    "exampleEn": "I practice having a five-minute conversation every evening.",
                    "exampleKo": "저는 매일 저녁 5분 동안 대화하는 연습을 해요."
                  }],
                  "slotAssessments": {},
                  "modelAnswer": "I will practice a five-minute conversation every evening.",
                  "modelAnswerKo": "저는 매일 저녁 5분 대화를 연습할 거예요."
                }
                """);

        assertThat(output.diagnosis().grammarIssues()).isEmpty();
        assertThat(output.diagnosis().strongestGrammarImpact()).isEqualTo(GrammarImpact.NONE);
        assertThat(output.content().refinementExpressions()).singleElement()
                .satisfies(refinement -> assertThat(refinement.expression())
                        .isEqualTo("practice having a five-minute conversation"));
    }

    @Test
    void parsesOneAuthoritativeFragmentCorrectionAndOneRepresentativeIssue() throws Exception {
        CanonicalLlmOutput output = contract.parse("""
                {
                  "topicAssessment": {"status": "ON_TOPIC", "reasonKo": "질문에 관련된 답이에요."},
                  "structureAssessment": {
                    "status": "FRAGMENT",
                    "repair": [{
                      "originalText": "After work, maybe noodles.",
                      "correctedAnswer": "After work, I usually eat noodles.",
                      "reasonKo": "주어와 동사가 필요해요.",
                      "instructionKo": "주어와 동사를 넣어 문장을 완성해 보세요."
                    }]
                  },
                  "grammarIssues": [],
                  "strengths": [],
                  "usedExpressions": [],
                  "refinementExpressions": [],
                  "slotAssessments": {
                    "ACTION": {
                      "evidence": "noodles",
                      "support": []
                    },
                    "REASON": {
                      "evidence": "",
                      "support": [{
                      "title": "Add a reason",
                      "whyKo": "A reason adds depth.",
                      "instructionKo": "Add one concrete reason.",
                      "exampleEn": "I eat noodles because they are quick.",
                      "skeletonEn": "I eat noodles because ____.",
                      "skeletonKo": "저는 ____ 때문에 국수를 먹어요.",
                      "suggestedPhrases": [
                        {"phrase": "they are quick", "meaningKo": "빨리 준비돼요"},
                        {"phrase": "I like the taste", "meaningKo": "맛을 좋아해요"}
                      ],
                      "targetHintKo": "이유 한 가지"
                      }]
                    }
                  },
                  "modelAnswer": "After work, I usually eat noodles because they are quick.",
                  "modelAnswerKo": "퇴근 후에는 빨리 준비할 수 있어서 보통 국수를 먹어요."
                }
                """);

        assertThat(output.diagnosis().structureAssessment().repair()).singleElement()
                .satisfies(repair -> {
                    assertThat(repair.originalText()).isEqualTo("After work, maybe noodles.");
                    assertThat(repair.correctedAnswer()).isEqualTo("After work, I usually eat noodles.");
                });
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work and why?",
                "What do you usually do after work and why?",
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
                                        "The learner's action reference.",
                                        "The learner's action satisfaction reference."
                                ),
                                "REASON", new PromptSlotContractDto(
                                        "The learner's reason for the usual action.",
                                        "The answer gives a concrete motivation that explains why the learner performs the action.",
                                        "The learner's reason reference.",
                                        "The learner's reason satisfaction reference."
                                )
                        )
                )
        );
    }
}
