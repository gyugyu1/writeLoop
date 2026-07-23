package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.RefinementExpressionDto;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CanonicalFeedbackContract {

    private static final String DEVELOPER_PROMPT = """
            You are WriteLoop's English writing coach and diagnostic engine.
            Return only data that satisfies the supplied JSON schema.

            Diagnose in this exact order:
            1. Decide topicAssessment.status before grammar or slot assessment.
            2. Diagnose structureAssessment and, when required, one authoritative repair.
            3. Diagnose only actual grammar errors and assign LOCAL or BLOCKING to each grammarIssue.
            4. Assess every configured slot exactly once in the fixed-key slotAssessments object.
            5. Keep each slot's evidence and teaching support together under that slot key.

            Authority boundaries:
            - You diagnose topic relevance, one atomic structure assessment and repair,
              grammar correction evidence with per-issue impact, slot evidence, and slot teaching support.
            - Do not return a slot status or decide completion, mission type, target slot, action type, score, or UI layout.
            - The backend derives slot status and those final values from your output and the question metadata.

            Topic rules:
            - ON_TOPIC means the answer directly addresses the question or clearly contributes relevant information.
            - OFF_TOPIC means the answer is about a different subject and cannot be repaired by adding one requested detail.
            - A short but relevant answer is ON_TOPIC. A grammatically broken but relevant answer is ON_TOPIC.
            - When status is OFF_TOPIC, use the MISSING shape for every configured slot: empty evidence and exactly one support item.
              Unrelated facts never satisfy question slots.

            Structure-assessment rules:
            - structureAssessment.status is COMPLETE when every answer-bearing segment forms an independent sentence.
            - structureAssessment.status is FRAGMENT when at least one answer-bearing segment cannot stand as a sentence, for example a noun phrase,
              a bare -ing phrase, a subordinate clause beginning with because, or a trailing phrase such as "At the gym."
            - An imperative sentence can be structurally complete. However, when the question asks the learner to describe the learner's own
              action or thought, an imperative reading that changes the actor to implicit "you" does not make the answer complete.
              In that case, set structureAssessment.status to FRAGMENT and minimally restore the learner as the subject.
            - Diagnose sentence structure only. A complete but short or content-thin sentence is still COMPLETE.
            - structureAssessment.repair is empty for COMPLETE and for every OFF_TOPIC answer.
            - For an ON_TOPIC FRAGMENT, return exactly one repair containing the correction and its explanation.
            - repair.originalText must equal the complete learner answer exactly, preserving case and punctuation.
            - repair.correctedAnswer must be one minimal, complete correction of the entire learner answer.
            - Preserve the learner's meaning and facts in repair.correctedAnswer. Restore only the structure needed to form a sentence.
            - You may use the question's sentence frame to restore omitted structure, but never invent learner facts.
            - repair.reasonKo and repair.instructionKo must explain the structural repair in concise Korean.

            Grammar rules:
            - Return an empty grammarIssues array when no correction is needed; the backend derives NONE.
            - grammarIssues is only for text that is grammatically unacceptable in standard English in this context.
            - Each grammarIssue has exactly one impact: LOCAL or BLOCKING.
            - LOCAL: meaning is clear, but this real grammar error should be corrected.
            - BLOCKING: this grammar problem prevents reliable understanding of the intended meaning.
            - Before returning an issue, check whether the original wording can remain unchanged as acceptable English. If it can, do not return a grammarIssue.
            - A difference in naturalness, idiomatic preference, collocation preference, register, concision, or specificity alone is not a grammar error.
              Put a useful optional alternative in refinementExpressions instead.
            - For example, "practice a five-minute conversation" is acceptable. Do not change it to "practice having a five-minute conversation"
              as a grammar correction. If useful, offer the latter only as an optional refinementExpression.
            - Real errors such as "Companies should protects workers" -> "Companies should protect workers" and
              "I am live in Seoul" -> "I live in Seoul" belong in grammarIssues with LOCAL impact.
            - The backend derives the answer-level impact from the strongest issue: BLOCKING, then LOCAL.
            - originalText must be an exact, case-sensitive substring of the learner answer.
            - revisedText must be the direct replacement for originalText, not a full invented answer.
            - reasonKo and instructionKo must explain that exact change in concise Korean.

            Slot rules:
            - slotAssessments has exactly the fixed keys supplied by the response schema. Do not omit, add, or rename keys.
            - Never return a status field inside a slot assessment. The backend derives it from evidence and support.
            - Judge each slot using the original question together with all three values in questionContract.slotContracts:
              definition is the shared slot meaning, semanticRole is this question's exact relationship, and satisfiedWhen is the
              paraphrase-tolerant fulfillment criterion. All three must be satisfied.
            - Assess every slot by interpreting the original question and the learner answer together.
            - Fixed context already supplied by the question, including time, place, situation, and referenced people or things, is inherited
              and does not need to be repeated in the learner answer.
            - The learner answer needs to supply only the new slot information requested by the question. Do not inherit question context when
              the answer explicitly contradicts it or switches to a different context.
            - Inherit only fixed context that the question supplies. Never treat the value a question asks the learner to provide as already supplied.
            - A grammatical sentence, a matching keyword, or a mentioned entity does not satisfy a slot unless the answer expresses
              the question-specific semantic relationship.
            - For concrete, learnable slot information, return a non-empty exact learner-answer substring in evidence and an empty support array.
              The backend derives SATISFIED.
            - Evidence must be the smallest exact learner-answer span that, when interpreted together with the original question, proves the
              slot relationship. It must remain a literal learner-answer substring; never paraphrase or invent evidence.
            - Copy slot evidence from the untouched learner answer before applying any grammar correction. When a grammarIssue overlaps
              the slot evidence, preserve the learner's incorrect original wording in evidence and put the correction only in grammarIssues.
              For learner answer "I usually washes the dishes.", valid ACTION evidence is "washes the dishes"; "wash the dishes" is invalid
              because it exists only after correction.
            - For "What challenge do you face at work or school?", "too many tasks" can prove PROBLEM without repeating "at work or school".
              For "Where do you live?", the question does not supply a PLACE value, so the learner answer must still identify one.
            - Concrete information may be brief. It is SATISFIED when the evidence itself gives a distinguishable answer to that slot.
            - For vague slot information, such as something, somehow, more, some problems, life changed, differently, nice, or good, return a
              non-empty exact learner-answer substring in evidence and exactly one support item. The backend derives GENERIC.
            - When wording attempts the slot but only uses a placeholder, circular evaluation, or unspecified manner, use the GENERIC shape,
              not MISSING. Use MISSING only when the answer contains no information attempting that slot.
            - Specificity contrasts:
              * REASON: "because it is nice" is GENERIC; "because blue reminds me of the ocean" is SATISFIED.
              * PLACE: "a nice area" is GENERIC; "western Seoul near a park" is SATISFIED.
              * BEFORE_STATE: "used to meet differently" is GENERIC; "used to meet in person" is SATISFIED.
            - When the answer provides no information for the slot, return an empty evidence string and exactly one support item.
              The backend derives MISSING.
            - Do not invent or rename slots. Use only the slots in questionContract.

            Slot support rules:
            - Put support inside the same slotAssessments entry; never return a separate slot list or repeat the slot code.
            - Each support must teach that exact slot, not a broader category.
            - skeletonEn and skeletonKo are both required and must align in meaning.
            - skeletonKo must be a Korean-language scaffold containing Hangul, not an English scaffold copied from skeletonEn.
              Translate the fixed wording into Korean and preserve the blank placeholder.
            - suggestedPhrases must contain at least two immediately usable English choices with Korean meanings.
            - exampleEn must demonstrate how to answer the target slot without pretending to know the learner's real facts.

            Content rules:
            - strengths contains at most one specific, honest strength in Korean.
            - modelAnswer is a useful reference answer to the original question. Do not copy it from the learner answer mechanically.
            - modelAnswerKo is the faithful Korean translation of modelAnswer.
            - refinementExpressions are optional alternatives for grammatically acceptable wording and never block completion.
            - Do not repeat a grammarIssue in refinementExpressions or describe an optional refinement as a required correction.
            - usedExpressions should include only prompt hints that the learner actually used.
            """;

    private final ObjectMapper objectMapper;
    private final FeedbackLearningContractPolicy policy = new FeedbackLearningContractPolicy();

    CanonicalFeedbackContract(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    String developerPrompt() {
        return DEVELOPER_PROMPT;
    }

    String userPrompt(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer,
            String previousCoachingSummary
    ) throws JsonProcessingException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("question", Map.of(
                "id", value(prompt == null ? null : prompt.id()),
                "difficulty", value(prompt == null ? null : prompt.difficulty()),
                "questionEn", value(prompt == null ? null : prompt.questionEn()),
                "questionKo", value(prompt == null ? null : prompt.questionKo()),
                "topicCategory", value(prompt == null ? null : prompt.topicCategory()),
                "topicDetail", value(prompt == null ? null : prompt.topicDetail())
        ));
        payload.put("questionContract", policy.promptContract(prompt));
        payload.put("learnerAnswer", value(answer));
        payload.put("promptHints", hints == null ? List.of() : hints);
        payload.put("attemptIndex", Math.max(1, attemptIndex));
        payload.put("previousAnswer", value(previousAnswer));
        payload.put("previousCoachingSummary", value(previousCoachingSummary));
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
    }

    Map<String, Object> schema(PromptDto prompt) {
        List<String> slots = policy.allowedSlots(prompt);
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("topicAssessment", objectSchema(Map.of(
                "status", enumString(List.of("ON_TOPIC", "OFF_TOPIC")),
                "reasonKo", stringSchema()
        )));
        properties.put("structureAssessment", objectSchema(Map.of(
                "status", enumString(List.of("COMPLETE", "FRAGMENT")),
                "repair", arraySchema(objectSchema(Map.of(
                        "originalText", stringSchema(),
                        "correctedAnswer", stringSchema(),
                        "reasonKo", stringSchema(),
                        "instructionKo", stringSchema()
                )), 0, 1)
        )));
        properties.put("grammarIssues", arraySchema(objectSchema(Map.of(
                "impact", enumString(List.of("LOCAL", "BLOCKING")),
                "code", stringSchema(),
                "originalText", stringSchema(),
                "revisedText", stringSchema(),
                "reasonKo", stringSchema(),
                "instructionKo", stringSchema()
        )), 0, 3));
        properties.put("strengths", arraySchema(stringSchema(), 0, 1));
        properties.put("usedExpressions", arraySchema(objectSchema(Map.of(
                "expression", stringSchema(),
                "matchedText", stringSchema(),
                "meaningKo", stringSchema(),
                "exampleEn", stringSchema(),
                "usageTip", stringSchema()
        )), 0, 3));
        properties.put("refinementExpressions", arraySchema(objectSchema(Map.of(
                "expression", stringSchema(),
                "meaningKo", stringSchema(),
                "guidanceKo", stringSchema(),
                "exampleEn", stringSchema(),
                "exampleKo", stringSchema()
        )), 0, 3));
        Map<String, Object> slotAssessmentProperties = new LinkedHashMap<>();
        for (String slot : slots) {
            slotAssessmentProperties.put(slot, objectSchema(Map.of(
                    "evidence", stringSchema(),
                    "support", arraySchema(slotSupportSchema(), 0, 1)
            )));
        }
        properties.put("slotAssessments", objectSchema(slotAssessmentProperties));
        properties.put("modelAnswer", stringSchema());
        properties.put("modelAnswerKo", stringSchema());
        return objectSchema(properties);
    }

    CanonicalLlmOutput parse(String json) throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(json);
        TopicAssessment topicAssessment = new TopicAssessment(
                TopicRelevance.fromCode(text(root.path("topicAssessment"), "status")),
                text(root.path("topicAssessment"), "reasonKo")
        );
        JsonNode structureNode = root.path("structureAssessment");
        List<StructureRepair> structureRepair = new ArrayList<>();
        for (JsonNode item : structureNode.path("repair")) {
            structureRepair.add(new StructureRepair(
                    text(item, "originalText"),
                    text(item, "correctedAnswer"),
                    text(item, "reasonKo"),
                    text(item, "instructionKo")
            ));
        }
        List<DiagnosedGrammarIssue> grammarIssues = new ArrayList<>();
        for (JsonNode item : root.path("grammarIssues")) {
            grammarIssues.add(new DiagnosedGrammarIssue(
                    text(item, "impact"),
                    text(item, "code"),
                    text(item, "originalText"),
                    text(item, "revisedText"),
                    text(item, "reasonKo"),
                    text(item, "instructionKo")
            ));
        }
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                topicAssessment,
                new StructureAssessment(
                        StructureStatus.fromCode(text(structureNode, "status")),
                        structureRepair
                ),
                grammarIssues
        );

        Map<String, SlotAssessmentValue> slotAssessments = new LinkedHashMap<>();
        root.path("slotAssessments").fields().forEachRemaining(entry -> {
            JsonNode item = entry.getValue();
            List<SlotFeedbackSupport> support = new ArrayList<>();
            for (JsonNode supportItem : item.path("support")) {
                support.add(parseSlotSupport(supportItem));
            }
            slotAssessments.put(entry.getKey(), new SlotAssessmentValue(
                    text(item, "evidence"),
                    support
            ));
        });

        List<String> strengths = new ArrayList<>();
        root.path("strengths").forEach(item -> strengths.add(item.asText("")));
        List<CoachExpressionUsageDto> usedExpressions = new ArrayList<>();
        for (JsonNode item : root.path("usedExpressions")) {
            usedExpressions.add(new CoachExpressionUsageDto(
                    text(item, "expression"),
                    true,
                    "LLM_MATCH",
                    text(item, "matchedText"),
                    "PROMPT_HINT",
                    text(item, "meaningKo"),
                    text(item, "exampleEn"),
                    text(item, "usageTip")
            ));
        }
        List<RefinementExpressionDto> refinements = new ArrayList<>();
        for (JsonNode item : root.path("refinementExpressions")) {
            refinements.add(new RefinementExpressionDto(
                    text(item, "expression"),
                    text(item, "guidanceKo"),
                    text(item, "exampleEn"),
                    text(item, "exampleKo"),
                    text(item, "meaningKo")
            ));
        }
        GeneratedContent content = new GeneratedContent(
                strengths,
                refinements,
                usedExpressions,
                text(root, "modelAnswer"),
                text(root, "modelAnswerKo")
        );
        return new CanonicalLlmOutput(diagnosis, content, new SlotAssessments(slotAssessments));
    }

    private SlotFeedbackSupport parseSlotSupport(JsonNode item) {
        List<FeedbackSuggestedPhraseDto> phrases = new ArrayList<>();
        for (JsonNode phrase : item.path("suggestedPhrases")) {
            phrases.add(new FeedbackSuggestedPhraseDto(text(phrase, "phrase"), text(phrase, "meaningKo")));
        }
        return new SlotFeedbackSupport(
                text(item, "title"),
                text(item, "whyKo"),
                text(item, "instructionKo"),
                text(item, "exampleEn"),
                text(item, "skeletonEn"),
                text(item, "skeletonKo"),
                phrases,
                text(item, "targetHintKo")
        );
    }

    private static Map<String, Object> slotSupportSchema() {
        return objectSchema(Map.of(
                "title", stringSchema(),
                "whyKo", stringSchema(),
                "instructionKo", stringSchema(),
                "exampleEn", stringSchema(),
                "skeletonEn", stringSchema(),
                "skeletonKo", stringSchema(),
                "suggestedPhrases", arraySchema(objectSchema(Map.of(
                        "phrase", stringSchema(),
                        "meaningKo", stringSchema()
                )), 2, 4),
                "targetHintKo", stringSchema()
        ));
    }

    private static Map<String, Object> objectSchema(Map<String, Object> properties) {
        Map<String, Object> schema = new LinkedHashMap<>();
        Map<String, Object> normalizedProperties = new LinkedHashMap<>(properties);
        schema.put("type", "object");
        schema.put("additionalProperties", false);
        schema.put("properties", normalizedProperties);
        schema.put("required", List.copyOf(normalizedProperties.keySet()));
        return schema;
    }

    private static Map<String, Object> stringSchema() {
        return Map.of("type", "string");
    }

    private static Map<String, Object> enumString(List<String> values) {
        return Map.of("type", "string", "enum", values);
    }

    private static Map<String, Object> arraySchema(Object items, int minItems, int maxItems) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "array");
        schema.put("items", items);
        schema.put("minItems", minItems);
        schema.put("maxItems", maxItems);
        return schema;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.path(field);
        return value == null || value.isMissingNode() || value.isNull() ? "" : value.asText("").trim();
    }

    private static String value(String value) {
        return value == null ? "" : value;
    }
}

record CanonicalLlmOutput(
        FeedbackDiagnosisResult diagnosis,
        GeneratedContent content,
        SlotAssessments slotAssessments
) {
}
