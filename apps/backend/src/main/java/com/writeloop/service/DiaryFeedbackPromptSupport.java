package com.writeloop.service;

import com.writeloop.util.OrderedMaps;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class DiaryFeedbackPromptSupport {

    private DiaryFeedbackPromptSupport() {
    }

    static String buildPrompt(DiaryFeedbackPromptContext context) {
        // 교정 일기·모범 일기는 화면에 보여 주는 웹 요청에서만 생성한다(일기 3편 분량의 출력 비용).
        String fullDiaryGoals = context.includeFullDiaries()
                ? "\n- Keep correctedDiary close to the learner text. Use modelDiary as a one-step more natural diary version."
                        + "\n- Put optional extra emotion, reflection, and detail ideas into rewriteIdeas, not into modelDiary."
                : "\n- Put optional extra emotion, reflection, and detail ideas into rewriteIdeas.";
        return """
                You are WriteLoop's dedicated free English diary coach.
                Return valid JSON only. Do not return Markdown, code fences, or explanatory text outside JSON.

                Read the learner text as a personal English diary entry, not as a quiz answer.
                Preserve the learner's facts, emotion, sequence of events, people, places, and personal voice.
                Do not invent new events, emotions, medical details, diagnoses, causes, or outcomes.

                Diary feedback goals:
                - Help the learner keep writing diaries in English without feeling judged.
                - Prioritize diary readability: event flow, time order, feeling, reflection, and daily-life phrasing.
                - Correct grammar only where it improves clarity or naturalness.
                - Pay special attention to past tense, articles, prepositions, time-flow connectors, and natural collocations.%s
                - nextDiaryMission must be exactly one small mission that feels easy to try.

                Diary answer band rules:
                - DIARY_TOO_SHORT: fragment-level or too little English to review as a diary.
                - DIARY_NOT_ENGLISH: mostly Korean or another language, so English diary conversion is the next step.
                - DIARY_GRAMMAR_BLOCKING: events or feelings are visible, but grammar blocks meaning.
                - DIARY_FLOW_THIN: understandable English, but weak time flow, feeling, result, or reflection.
                - DIARY_CLEAR_BASIC: clear diary entry with only light naturalness or local grammar fixes needed.
                - DIARY_NATURAL_COMPLETE: natural, personal, diary-like entry with strong flow.

                Field rules:
                - Write fixPoints and diaryFlow first, then decide diaryAnswerBand and score from that analysis.
                - All fields are required. Use an empty string when a text field does not apply.
                - strengths must be 1 to 3 short Korean comments.
                - fixPoints: one item per sentence that needs a fix. originalText quotes that one sentence exactly, and revisedText is the fixed sentence.
                  Do not combine several sentences into one item. When more than five sentences need fixes, keep the five most useful.
                  In revisedText, change only what is wrong. Keep the learner's words and meaning; do not add actions, feelings, or details.
                - fixPoints.kind: GRAMMAR (tense, articles, agreement, prepositions, capitalization), WORD_CHOICE, NATURALNESS (correct but awkward), FLOW (connectors and order), SENTENCE_FORM (fragments or a missing subject or verb).
                - rewriteIdeas.title and rewriteIdeas.meaningKo must be Korean. The title should be a short Korean action label, such as "감정 문장 붙이기" or "작은 다짐 더하기".
                - rewriteIdeas.exampleEn is the only rewriteIdeas field where an English rewrite sentence should appear.
                - Only use the rewriteIdeas fields defined in the schema.
                - Use rewriteIdeas.exampleEn for one short usable sentence the learner can add or adapt.
                - rewriteIdeas.noteKo must explain in Korean where or why to add the idea.
                - usedDiaryExpressions are reusable phrases the learner already used well.
                - diaryExpressions are reusable diary expressions the learner can try next time.
                - diaryFlow.timeFlow and diaryFlow.detail should describe what worked well in the current diary flow.
                - diaryFlow.emotion, diaryFlow.reflection, and diaryFlow.connectionTips should describe what the learner can add next time to make the diary feel more personal and complete.
                - Important: diaryFlow.emotion and diaryFlow.reflection must be actionable next-step suggestions, not praise. Use soft Korean suggestion endings such as "~을 한 문장 더 붙여 보세요" or "~로 마무리해 보세요".
                - If emotion or reflection is already good, still suggest one small way to expand it next time instead of repeating that it is good.
                - diaryFlow.connectionTips must contain short connector phrases only, such as "Then", "After that", or "When I got home". Do not put full coaching sentences in connectionTips.
                - Keep each diaryFlow field short, concrete, and non-repetitive. Do not repeat the same point across good-flow and next-flow fields.

                How to use the entry metadata:
                - attemptNo is 1 for the first feedback on this diary, and 2 or more for a rewrite.
                - mood is the mood the learner picked for the day. Use it only to read the tone; do not add feelings the diary does not mention.
                - previousDiaryText is the learner's previous version of this diary, or null on the first attempt.
                  On a rewrite, review only the current diary, and mention one concrete improvement over the previous version in strengths.

                Entry metadata:
                - attemptNo: %s
                - title: %s
                - entryDate: %s
                - mood: %s
                - previousDiaryText: %s

                Learner diary:
                %s
                """.formatted(
                fullDiaryGoals,
                context.attemptNo(),
                safe(context.title()),
                context.entryDate() == null ? "null" : context.entryDate(),
                safe(context.mood()),
                safe(context.previousDiaryText()),
                safe(context.diaryText())
        );
    }

    // 생성 순서 = 키 순서다. 교정 포인트와 흐름 분석을 먼저 쓰고, 그다음 등급·점수를 정한다.
    // 서버가 정하는 값(스키마 버전, 일기 ID, 시도 번호, 완료 가능 여부)과 쓰지 않는 값(safetyFlags)은 생성하지 않는다.
    static Map<String, Object> jsonSchema(boolean includeFullDiaries) {
        Map<String, Object> stringSchema = OrderedMaps.of("type", "string");
        Map<String, Object> nullableStringSchema = stringSchema;
        Map<String, Object> stringArraySchema = OrderedMaps.of(
                "type", "array",
                "items", stringSchema
        );

        Map<String, Object> fixPointSchema = OrderedMaps.of(
                "type", "object",
                "additionalProperties", false,
                "properties", OrderedMaps.of(
                        "kind", OrderedMaps.of("type", "string", "enum", List.of(
                                "GRAMMAR",
                                "WORD_CHOICE",
                                "NATURALNESS",
                                "FLOW",
                                "SENTENCE_FORM"
                        )),
                        "title", stringSchema,
                        "originalText", nullableStringSchema,
                        "revisedText", nullableStringSchema,
                        "reasonKo", stringSchema,
                        "exampleEn", nullableStringSchema
                ),
                "required", List.of("kind", "title", "originalText", "revisedText", "reasonKo", "exampleEn")
        );

        Map<String, Object> expressionSchema = OrderedMaps.of(
                "type", "object",
                "additionalProperties", false,
                "properties", OrderedMaps.of(
                        "expression", stringSchema,
                        "meaningKo", stringSchema,
                        "exampleEn", nullableStringSchema,
                        "usageTipKo", stringSchema,
                        "tags", stringArraySchema
                ),
                "required", List.of("expression", "meaningKo", "exampleEn", "usageTipKo", "tags")
        );

        Map<String, Object> rewriteIdeaSchema = OrderedMaps.of(
                "type", "object",
                "additionalProperties", false,
                "properties", OrderedMaps.of(
                        "title", stringSchema,
                        "meaningKo", nullableStringSchema,
                        "noteKo", stringSchema,
                        "exampleEn", nullableStringSchema
                ),
                "required", List.of("title", "meaningKo", "noteKo", "exampleEn")
        );

        Map<String, Object> diaryFlowSchema = OrderedMaps.of(
                "type", "object",
                "additionalProperties", false,
                "properties", OrderedMaps.of(
                        "timeFlow", stringSchema,
                        "emotion", stringSchema,
                        "detail", stringSchema,
                        "reflection", stringSchema,
                        "commentKo", stringSchema,
                        "connectionTips", stringArraySchema
                ),
                "required", List.of("timeFlow", "emotion", "detail", "reflection", "commentKo", "connectionTips")
        );

        Map<String, Object> missionSchema = OrderedMaps.of(
                "type", "object",
                "additionalProperties", false,
                "properties", OrderedMaps.of(
                        "focus", stringSchema,
                        "titleKo", stringSchema,
                        "instructionKo", stringSchema,
                        "starterEn", nullableStringSchema
                ),
                "required", List.of("focus", "titleKo", "instructionKo", "starterEn")
        );

        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("fixPoints", OrderedMaps.of("type", "array", "items", fixPointSchema));
        properties.put("diaryFlow", diaryFlowSchema);
        properties.put("diaryAnswerBand", OrderedMaps.of("type", "string", "enum", List.of(
                "DIARY_TOO_SHORT",
                "DIARY_NOT_ENGLISH",
                "DIARY_GRAMMAR_BLOCKING",
                "DIARY_FLOW_THIN",
                "DIARY_CLEAR_BASIC",
                "DIARY_NATURAL_COMPLETE"
        )));
        properties.put("score", OrderedMaps.of("type", "integer", "minimum", 0, "maximum", 100));
        properties.put("summaryKo", stringSchema);
        properties.put("strengths", stringArraySchema);
        if (includeFullDiaries) {
            properties.put("correctedDiary", nullableStringSchema);
            properties.put("modelDiary", nullableStringSchema);
            properties.put("modelDiaryKo", nullableStringSchema);
        }
        properties.put("rewriteIdeas", OrderedMaps.of("type", "array", "items", rewriteIdeaSchema));
        properties.put("usedDiaryExpressions", OrderedMaps.of("type", "array", "items", expressionSchema));
        properties.put("diaryExpressions", OrderedMaps.of("type", "array", "items", expressionSchema));
        properties.put("nextDiaryMission", missionSchema);

        return OrderedMaps.of(
                "type", "object",
                "additionalProperties", false,
                "properties", properties,
                "required", List.copyOf(properties.keySet())
        );
    }

    private static String safe(String value) {
        return value == null || value.isBlank() ? "null" : value.trim();
    }
}
