package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptHintItemDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.util.OrderedMaps;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CanonicalFeedbackContract {

    private static final String DEVELOPER_PROMPT = """
            You are WriteLoop's English writing coach and diagnostic engine.
            Return only data that satisfies the supplied JSON schema.

            Fill the response in the schema's field order. Each field may rely only on what you have already written:
            1. topicAssessment: write reason first, then decide status from that reason, before grammar or slot assessment.
            2. structureAssessment: write reason first, then decide status from that reason.
            3. languageAssessment.revisionSteps: zero to 25 cumulative steps.
            4. slotAssessments: one item for every slot in questionContract.slotContracts, exactly once each.
               For each item, write slot first, then evidence, then reason, then decide verdict from that evidence and reason.
               Every reason in topicAssessment, structureAssessment, and slotAssessments is one short English sentence of at most
               20 words that names the deciding point. These reasons are never shown to the learner.
            5. missionSupport: teaching support for at most one slot, chosen by the selection order below.
            6. enrichmentSupport: an optional challenge for at most one depth slot.
            7. modelAnswer, then modelAnswerKo.
            8. refinementExpressions, selected by comparing the modelAnswer you already wrote with the learner answer.
               Fields 6 to 8 are completion-only output (see Content rules); otherwise return them empty.
            9. strengths.

            Input metadata:
            - question.difficulty is the learner's level: I = beginner (one or two very short sentences, basic words),
              A = easy (simple sentences), B = intermediate (reasons and examples), C = challenge (comparison, contrast,
              and richer linking). Match modelAnswer length and vocabulary, skeletons, suggestedPhrases, and
              refinementExpressions to this level.
            - promptHints are the hints the learner could see while writing: starter sentences, words, phrases, structures,
              details, and linkers. They are not part of the learner answer and never count as slot evidence.
              Prefer their wording in suggestedPhrases when it fits the target slot, and do not recommend a hint the learner
              already used as a refinementExpression.
            - previousAttempt appears only when this answer is a rewrite. It holds the learner's previous answer, the mission
              the learner was given for it (kind and slot), and the slot verdicts with evidence from that attempt. It is context,
              never slot evidence: judge only the current learnerAnswer.

            Authority boundaries:
            - You diagnose topic relevance, sentence structure, cumulative full-answer revision steps,
              slot evidence and verdicts, and write teaching support for the one slot the selection order picks.
            - The backend decides completion and the mission. You only follow the same selection order (Mission support rules)
              to choose which slot, if any, to write teaching support for. Do not decide scores or UI layout.
            - Do not return a separate revisedAnswer or issues array. The backend derives the final revised answer and
              visible correction cards from revisionSteps.
            - The backend recomputes the mission from your diagnosis and the question metadata, and rejects a missionSupport
              that teaches a different slot.

            Topic rules:
            - ON_TOPIC means the answer directly addresses the question or clearly contributes relevant information.
            - OFF_TOPIC means the answer is about a different subject and cannot be repaired by adding one requested detail.
            - A short but relevant answer is ON_TOPIC. A grammatically broken but relevant answer is ON_TOPIC.
            - When status is OFF_TOPIC, set every configured slot to empty evidence and verdict MISSING.
              Unrelated facts never satisfy question slots.
            - When status is OFF_TOPIC, set structureAssessment.status to COMPLETE and return an empty
              languageAssessment.revisionSteps array: an off-topic answer is redirected to the question, not corrected.

            Structure-assessment rules:
            - structureAssessment.status is COMPLETE when every answer-bearing segment forms an independent sentence.
            - structureAssessment.status is FRAGMENT when at least one answer-bearing segment cannot stand as a sentence, for example a noun phrase,
              a bare -ing phrase, a subordinate clause beginning with because, or a trailing phrase such as "At the gym."
            - An imperative sentence can be structurally complete. However, when the question asks the learner to describe the learner's own
              action or thought, an imperative reading that changes the actor to implicit "you" does not make the answer complete.
              In that case, set structureAssessment.status to FRAGMENT and minimally restore the learner as the subject.
            - Diagnose sentence structure only. A complete but short or content-thin sentence is still COMPLETE.
            - For an ON_TOPIC FRAGMENT, at least one revision step must restore the minimum structure needed
              to form complete sentences and use kind STRUCTURE.
            - Preserve the learner's meaning and facts in every answerAfter. You may use the question's sentence frame to restore
              omitted structure, but never invent learner facts.
            - When structure and grammar changes overlap in the same phrase, include them in one STRUCTURE step.
              When they affect separate phrases, use separate steps.

            Language-assessment rules:
            - languageAssessment.revisionSteps is the only authoritative language revision.
            - Each step's answerAfter must contain the complete learner answer after applying exactly one pedagogical correction group.
              It must never be a fragment, patch, example, or model answer.
            - The first answerAfter starts from the untouched learner answer. Every later answerAfter starts from the previous
              step's complete answer and must preserve all earlier corrections exactly.
            - A later step must never revise, expand, or revert text already corrected by an earlier step.
              If corrections overlap, combine them into the earlier, higher-priority step.
            - Every step must make a real change from the previous complete answer.
            - If no language correction is needed, return an empty revisionSteps array.
            - Return at most 25 steps. If more than 25 correction groups are possible, apply and explain only the first 25
              under the priority below and leave every unselected error unchanged.
            - One step may contain multiple low-level changed spans only when they form one local grammatical construction
              that needs one teaching explanation. Include the unchanged bridge words in that correction group.
            - Example: "I'm like eat" -> "I like eating" is one step even though "like" itself stays unchanged.
            - Unrelated errors, even inside one sentence, require separate cumulative steps.
            - Order steps by kind: STRUCTURE, then GRAMMAR_BLOCKING, then GRAMMAR_LOCAL.
              Within the same kind, prefer left-to-right order for readability, but never reorder a correction
              in a way that changes or reverts an earlier answerAfter.
            - Use kind STRUCTURE only for a change required to turn a fragment or broken clause connection into a complete sentence.
            - Use kind GRAMMAR_BLOCKING when a real grammar problem prevents reliable understanding.
            - Use kind GRAMMAR_LOCAL when meaning is clear but the wording is grammatically unacceptable in standard English.
            - If one correction group inseparably contains structure and grammar repairs, classify the step as STRUCTURE.
              Otherwise prefer GRAMMAR_BLOCKING over GRAMMAR_LOCAL within one overlapping group.
            - When at least one structural or blocking step exists, include local grammar steps too, up to the 25-step cap.
            - If only local grammar steps exist, still diagnose them; the selection order decides whether they become the mission.
            - Before returning a step, check whether the original wording can remain unchanged as acceptable English. If it can, do not revise it.
            - A difference in naturalness, idiomatic preference, collocation preference, register, concision, or specificity alone is not a grammar error.
              Put a useful optional alternative in refinementExpressions instead.
            - For example, "practice a five-minute conversation" is acceptable. Do not change it to "practice having a five-minute conversation"
              as a grammar correction. If useful, offer the latter only as an optional refinementExpression.
            - Real errors such as "Companies should protects workers" -> "Companies should protect workers" and
              "I am live in Seoul" -> "I live in Seoul" use GRAMMAR_LOCAL.
            - reasonKo must explain every change made by that step in concise Korean.

            Slot rules:
            - slotAssessments contains exactly one item for every slot listed in questionContract.slotContracts and no other slot.
              Do not omit, repeat, add, or rename slots. The schema lists every slot code the service knows; use only this question's.
            - verdict is SATISFIED, GENERIC, or MISSING.
            - Judge each slot using the original question together with all three values in questionContract.slotContracts:
              definition is the shared slot meaning, semanticRole is this question's exact relationship, and satisfiedWhen is the
              paraphrase-tolerant fulfillment criterion. All three must be satisfied.
            - Fixed context already supplied by the question, including time, place, situation, and referenced people or things, is inherited
              and does not need to be repeated in the learner answer.
            - The learner answer needs to supply only the new slot information requested by the question. Do not inherit question context when
              the answer explicitly contradicts it or switches to a different context.
            - Inherit only fixed context that the question supplies. Never treat the value a question asks the learner to provide as already supplied.
            - A grammatical sentence, a matching keyword, or a mentioned entity does not satisfy a slot unless the answer expresses
              the question-specific semantic relationship.
            - For concrete, learnable slot information, return a non-empty exact learner-answer substring in evidence and verdict SATISFIED.
            - Evidence must be the smallest exact learner-answer span that, when interpreted together with the original question, proves the
              slot relationship. It must remain a literal learner-answer substring; never paraphrase or invent evidence.
            - Copy slot evidence from the untouched learner answer before applying any language correction. When a language change overlaps
              the slot evidence, preserve the learner's incorrect original wording in evidence and put the correction only in languageAssessment.
              For learner answer "I usually washes the dishes.", valid ACTION evidence is "washes the dishes"; "wash the dishes" is invalid
              because it exists only after correction.
            - For "What challenge do you face at work or school?", "too many tasks" can prove PROBLEM without repeating "at work or school".
              For "Where do you live?", the question does not supply a PLACE value, so the learner answer must still identify one.
            - Concrete information may be brief. It is SATISFIED when the evidence itself gives a distinguishable answer to that slot.
            - For vague slot information, such as something, somehow, more, some problems, life changed, differently, nice, or good, return a
              non-empty exact learner-answer substring in evidence and verdict GENERIC.
            - When wording attempts the slot but only uses a placeholder, circular evaluation, or unspecified manner, use GENERIC,
              not MISSING. Use MISSING only when the answer contains no information attempting that slot.
            - Specificity contrasts:
              * REASON: "because it is nice" is GENERIC; "because blue reminds me of the ocean" is SATISFIED.
              * PLACE: "a nice area" is GENERIC; "western Seoul near a park" is SATISFIED.
              * BEFORE_STATE: "used to meet differently" is GENERIC; "used to meet in person" is SATISFIED.
            - When the answer provides no information for the slot, return an empty evidence string and verdict MISSING.
            - When previousAttempt is present, keep judgments stable: if the evidence previousAttempt recorded for a slot still appears
              unchanged in the learner answer and the surrounding words do not change its meaning, keep that slot's previous verdict.
              Re-judge a slot only when the learner changed, added, or removed the wording for it.

            Mission support rules:
            - The learner sees teaching support for one slot only, so write it for exactly the slot the backend will teach.
              Pick it with this order, using only what you have already written:
              1. topicAssessment.status is OFF_TOPIC: the first questionContract.requiredSlots slot,
                 or the first depthSlots slot when requiredSlots is empty.
              2. structureAssessment.status is FRAGMENT, or any revision step has kind GRAMMAR_BLOCKING: no slot.
              3. previousAttempt is present and steps 4 to 6 would pick a mission (the answer would not reach step 7):
                 if previousAttempt.mission.kind is SLOT, its slot is in questionContract, and that slot's verdict is not SATISFIED,
                 that slot; if previousAttempt.mission.kind is LANGUAGE_FIX and any revision step has kind GRAMMAR_LOCAL, no slot.
                 Otherwise continue with step 4.
              4. The first requiredSlots slot whose verdict is not SATISFIED.
              5. Any revision step has kind GRAMMAR_LOCAL: no slot.
              6. minimumDepthSlots is greater than 0 and fewer than minimumDepthSlots depthSlots slots are SATISFIED:
                 the first depthSlots slot whose verdict is not SATISFIED.
              7. Otherwise: no slot.
            - When a slot is picked, return exactly one missionSupport item whose slot is that slot code. When no slot is picked,
              return an empty missionSupport array. Never write support for any other slot.
            - The support must teach that exact slot, not a broader category.

            Enrichment support rules:
            - enrichmentSupport is an optional challenge shown only after the learner has a complete answer. It never blocks completion.
            - Write it only for a complete answer (completion-only output, see Content rules). Then pick the first questionContract.depthSlots slot
              whose verdict is not SATISFIED and return exactly one item for it. In every other case, and when every depth slot
              is SATISFIED, return an empty enrichmentSupport array.
            - Write it as an invitation to add that one detail to the complete answer, for example the title
              "장소를 넣어 더 풍부하게 써 보세요". Never ask the learner to fix anything else.
            - For a GENERIC depth slot, invite the learner to make that vague wording specific instead of adding a new detail.
            - Leave the new detail as a blank placeholder in skeletonEn and skeletonKo; never invent learner facts.

            Support content rules for both missionSupport and enrichmentSupport:
            - skeletonEn and skeletonKo are both required and must align in meaning.
            - skeletonKo must be a Korean-language scaffold containing Hangul, not an English scaffold copied from skeletonEn.
              Translate the fixed wording into Korean and preserve the blank placeholder.
            - suggestedPhrases must contain at least two immediately usable English choices with Korean meanings.

            Content rules:
            - strengths contains at most one specific, honest strength in Korean.
            - Completion-only output: enrichmentSupport, modelAnswer, modelAnswerKo, and refinementExpressions are shown only on the
              completion screen. Write them only when the selection order above reached step 7 (the answer is complete). In every
              other case return modelAnswer and modelAnswerKo as empty strings and enrichmentSupport and refinementExpressions as
              empty arrays.
            - modelAnswer is a useful reference answer to the original question. Do not copy it from the learner answer mechanically.
            - modelAnswerKo is the faithful Korean translation of modelAnswer.
            - For a complete answer, return two or three refinementExpressions.
              They are optional for the learner to use and never block completion,
              but they are required output so a complete answer still receives useful ways to broaden its expression.
            - modelAnswer is written before refinementExpressions. Compare that modelAnswer with the learner answer and select short,
              reusable expressions that can enrich the learner's existing meaning without adding new facts. An expression may come from
              modelAnswer only when it is compatible with the learner's stated meaning and facts.
            - The recommendations must cover different purposes. Include at least:
              1. one useful vocabulary, collocation, or phrasal expression;
              2. one sentence frame, connector, emphasis, contrast, reason, result, or detail-building expression.
              Add a third only when it gives a genuinely different, useful way to enrich this answer.
            - Do not recommend wording the learner already used, near-duplicates, an entire model answer, or an expression that requires
              the learner to claim an unstated experience, time, place, reason, feeling, or result.
            - Keep each expression appropriate for the question difficulty. exampleEn must show how the expression can be used with the
              learner's existing meaning.
            - Do not repeat a language revision step in refinementExpressions or describe an optional refinement as a required correction.
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
            List<PromptHintDto> hints
    ) throws JsonProcessingException {
        return userPrompt(prompt, answer, hints, null);
    }

    String userPrompt(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            PreviousAttemptContext previousAttempt
    ) throws JsonProcessingException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("question", OrderedMaps.of(
                "id", value(prompt == null ? null : prompt.id()),
                "difficulty", value(prompt == null ? null : prompt.difficulty()),
                "questionEn", value(prompt == null ? null : prompt.questionEn()),
                "questionKo", value(prompt == null ? null : prompt.questionKo()),
                "topicCategory", value(prompt == null ? null : prompt.topicCategory()),
                "topicDetail", value(prompt == null ? null : prompt.topicDetail())
        ));
        payload.put("questionContract", policy.promptContract(prompt));
        // 학습자 답은 사람마다 달라 캐시가 여기서 끊긴다. 맨 뒤에 두어 같은 질문의 힌트까지 캐시되게 한다.
        payload.put("promptHints", promptHints(hints));
        // 다시 쓴 답일 때만: 바로 앞 시도의 답·미션·판정. 학습자 답보다 앞에 둔다.
        if (previousAttempt != null) {
            payload.put("previousAttempt", previousAttemptPayload(previousAttempt));
        }
        payload.put("learnerAnswer", value(answer));
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
    }

    private Map<String, Object> previousAttemptPayload(PreviousAttemptContext previousAttempt) {
        List<Map<String, Object>> slotAssessments = new ArrayList<>();
        for (PreviousAttemptContext.SlotVerdict verdict : previousAttempt.slotAssessments()) {
            slotAssessments.add(OrderedMaps.of(
                    "slot", value(verdict.slot()),
                    "verdict", verdict.verdict() == null ? "" : verdict.verdict().name(),
                    "evidence", value(verdict.evidence())
            ));
        }
        return OrderedMaps.of(
                "learnerAnswer", value(previousAttempt.answer()),
                "mission", OrderedMaps.of(
                        "kind", previousAttempt.missionKind() == null ? "" : previousAttempt.missionKind().name(),
                        "slot", value(previousAttempt.targetSlot())
                ),
                "slotAssessments", slotAssessments
        );
    }

    // 힌트는 LLM이 읽을 내용(종류, 제목, 표현과 뜻)만 보낸다. id나 표시 순서 같은 내부 필드는 판단에 쓰이지 않는다.
    private List<Map<String, Object>> promptHints(List<PromptHintDto> hints) {
        List<Map<String, Object>> compact = new ArrayList<>();
        if (hints == null) {
            return compact;
        }
        for (PromptHintDto hint : hints) {
            if (hint == null || hint.items() == null) {
                continue;
            }
            List<Map<String, Object>> items = new ArrayList<>();
            for (PromptHintItemDto item : hint.items()) {
                if (item == null || item.content() == null || item.content().isBlank()) {
                    continue;
                }
                items.add(OrderedMaps.of(
                        "content", item.content().trim(),
                        "meaningKo", value(item.meaningKo()).trim()
                ));
            }
            if (!items.isEmpty()) {
                compact.add(OrderedMaps.of(
                        "type", value(hint.hintType()),
                        "title", value(hint.title()),
                        "items", items
                ));
            }
        }
        return compact;
    }

    String contractRetryPrompt(
            String originalUserPrompt,
            String rejectedOutput,
            String validationError
    ) throws JsonProcessingException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("requestType", "CANONICAL_CONTRACT_RETRY");
        payload.put("retryInstruction", OrderedMaps.of(
                "validationError", value(limit(validationError, 2_000)),
                "requiredAction", """
                        Re-evaluate the original input and return one complete canonical JSON response.
                        Fix the stated contract violation without merely patching or quoting the rejected output.
                        Every languageAssessment.revisionSteps item must contain one cumulative complete answerAfter.
                        Preserve every earlier correction exactly in each later answerAfter.
                        All slot evidence values must be copied exactly from the untouched learner answer.
                        missionSupport must teach only the slot picked by the selection order, or be empty.
                        """
        ));
        payload.put("originalInput", jsonValueOrText(originalUserPrompt));
        payload.put("rejectedOutput", jsonValueOrText(limit(rejectedOutput, 24_000)));
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(payload);
    }

    Map<String, Object> schema(PromptDto prompt) {
        // 슬롯 선택지는 질문과 관계없이 전체 슬롯 코드다. 스키마가 모든 질문에서 같아야 그 뒤의 고정 개발자 프롬프트까지
        // 프롬프트 캐시가 맞는다. 이 질문의 슬롯만 쓰는지는 백엔드가 검사한다(verifyAssessment).
        List<String> slots = FeedbackSlotCatalog.canonicalSlots();
        // 구조화 출력은 이 키 순서대로 생성된다. 근거를 쓴 뒤 판정하고, 진단을 마친 뒤 학습 자료를 쓰도록 순서를 정했다.
        // 순서를 바꾸면 모델 동작이 달라지므로 회귀 테스트와 함께 바꾼다.
        Map<String, Object> properties = new LinkedHashMap<>();
        // 주제 이유는 화면에 쓰지 않는다. 다른 판정 이유처럼 짧은 영어 한 줄이다.
        properties.put("topicAssessment", objectSchema(OrderedMaps.of(
                "reason", stringSchema(),
                "status", enumString(List.of("ON_TOPIC", "OFF_TOPIC"))
        )));
        // 판정 앞에 짧은 이유를 먼저 쓰게 해 경계 판정을 덜 흔들리게 한다. 이유는 진단 로그(원문)에만 남는다.
        properties.put("structureAssessment", objectSchema(OrderedMaps.of(
                "reason", stringSchema(),
                "status", enumString(List.of("COMPLETE", "FRAGMENT"))
        )));
        properties.put("languageAssessment", objectSchema(OrderedMaps.of(
                "revisionSteps", arraySchema(objectSchema(OrderedMaps.of(
                        "kind", enumString(List.of(
                                "STRUCTURE",
                                "GRAMMAR_BLOCKING",
                                "GRAMMAR_LOCAL"
                        )),
                        "answerAfter", stringSchema(),
                        "reasonKo", stringSchema()
                )), 0, 25)
        )));
        properties.put("slotAssessments", arraySchema(objectSchema(OrderedMaps.of(
                "slot", enumString(slots),
                "evidence", stringSchema(),
                "reason", stringSchema(),
                "verdict", enumString(List.of("SATISFIED", "GENERIC", "MISSING"))
        )), 0));
        // 지원 내용은 미션으로 보여 줄 슬롯 하나에만 쓴다. 슬롯마다 쓰게 하면 출력 대부분이 버려진다.
        properties.put("missionSupport", arraySchema(missionSupportSchema(enumString(slots)), 0, 1));
        // 완성 답변에만 붙는 "더 풍부하게 써 보기" 제안. 선택 슬롯 하나만 대상으로 한다.
        properties.put("enrichmentSupport", arraySchema(missionSupportSchema(enumString(slots)), 0, 1));
        properties.put("modelAnswer", stringSchema());
        properties.put("modelAnswerKo", stringSchema());
        properties.put("refinementExpressions", arraySchema(objectSchema(OrderedMaps.of(
                "expression", stringSchema(),
                "meaningKo", stringSchema(),
                "guidanceKo", stringSchema(),
                "exampleEn", stringSchema()
        )), 0, 3));
        properties.put("strengths", arraySchema(stringSchema(), 0, 1));
        return objectSchema(properties);
    }

    CanonicalLlmOutput parse(String json) throws JsonProcessingException {
        JsonNode root = objectMapper.readTree(json);
        TopicAssessment topicAssessment = new TopicAssessment(
                TopicRelevance.fromCode(text(root.path("topicAssessment"), "status")),
                // 주제 이유의 이름이 reasonKo에서 reason으로 바뀌었다. 옛 이름으로 온 출력도 읽는다.
                !text(root.path("topicAssessment"), "reason").isEmpty()
                        ? text(root.path("topicAssessment"), "reason")
                        : text(root.path("topicAssessment"), "reasonKo")
        );
        JsonNode structureNode = root.path("structureAssessment");
        JsonNode languageNode = root.path("languageAssessment");
        List<LanguageRevisionStep> revisionSteps = new ArrayList<>();
        for (JsonNode item : languageNode.path("revisionSteps")) {
            revisionSteps.add(new LanguageRevisionStep(
                    text(item, "kind"),
                    text(item, "answerAfter"),
                    text(item, "reasonKo")
            ));
        }
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                topicAssessment,
                new StructureAssessment(StructureStatus.fromCode(text(structureNode, "status"))),
                new LanguageAssessment(revisionSteps)
        );

        Map<String, SlotAssessmentValue> slotAssessments = new LinkedHashMap<>();
        for (JsonNode item : root.path("slotAssessments")) {
            String slot = text(item, "slot");
            SlotAssessmentValue value = new SlotAssessmentValue(
                    text(item, "evidence"),
                    SlotAssessmentStatus.fromCode(text(item, "verdict"))
            );
            if (slotAssessments.putIfAbsent(slot, value) != null) {
                throw new FeedbackContractException("Duplicate slot assessment: " + slot);
            }
        }
        MissionSupport missionSupport = null;
        JsonNode missionSupportItems = root.path("missionSupport");
        if (missionSupportItems.size() > 1) {
            throw new FeedbackContractException("missionSupport must contain at most one item");
        }
        for (JsonNode supportItem : missionSupportItems) {
            missionSupport = new MissionSupport(text(supportItem, "slot"), parseSlotSupport(supportItem));
        }
        MissionSupport enrichmentSupport = null;
        JsonNode enrichmentItem = root.path("enrichmentSupport").path(0);
        if (enrichmentItem.isObject()) {
            enrichmentSupport = new MissionSupport(text(enrichmentItem, "slot"), parseSlotSupport(enrichmentItem));
        }

        List<String> strengths = new ArrayList<>();
        root.path("strengths").forEach(item -> strengths.add(item.asText("")));
        List<RefinementExpressionDto> refinements = new ArrayList<>();
        for (JsonNode item : root.path("refinementExpressions")) {
            refinements.add(new RefinementExpressionDto(
                    text(item, "expression"),
                    text(item, "guidanceKo"),
                    text(item, "exampleEn"),
                    text(item, "meaningKo")
            ));
        }
        GeneratedContent content = new GeneratedContent(
                strengths,
                refinements,
                text(root, "modelAnswer"),
                text(root, "modelAnswerKo")
        );
        return new CanonicalLlmOutput(
                diagnosis,
                content,
                new SlotAssessments(slotAssessments, missionSupport, enrichmentSupport)
        );
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
                text(item, "skeletonEn"),
                text(item, "skeletonKo"),
                phrases
        );
    }

    private Object jsonValueOrText(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        try {
            JsonNode parsed = objectMapper.readTree(value);
            return parsed == null ? value : parsed;
        } catch (JsonProcessingException ignored) {
            return value;
        }
    }

    private String limit(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private static Map<String, Object> missionSupportSchema(Map<String, Object> slotSchema) {
        return objectSchema(OrderedMaps.of(
                "slot", slotSchema,
                "title", stringSchema(),
                "whyKo", stringSchema(),
                "instructionKo", stringSchema(),
                "skeletonEn", stringSchema(),
                "skeletonKo", stringSchema(),
                "suggestedPhrases", arraySchema(objectSchema(OrderedMaps.of(
                        "phrase", stringSchema(),
                        "meaningKo", stringSchema()
                )), 2, 4)
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
        return OrderedMaps.of("type", "string");
    }

    private static Map<String, Object> enumString(List<String> values) {
        return OrderedMaps.of("type", "string", "enum", values);
    }

    private static Map<String, Object> arraySchema(Object items, int minItems, int maxItems) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "array");
        schema.put("items", items);
        schema.put("minItems", minItems);
        schema.put("maxItems", maxItems);
        return schema;
    }

    private static Map<String, Object> arraySchema(Object items, int minItems) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "array");
        schema.put("items", items);
        schema.put("minItems", minItems);
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
