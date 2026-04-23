package com.writeloop.service;

import java.util.List;
import java.util.Map;

final class DiaryFeedbackPromptSupport {

    private DiaryFeedbackPromptSupport() {
    }

    static String buildPrompt(DiaryFeedbackPromptContext context) {
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
                - Pay special attention to past tense, articles, prepositions, time-flow connectors, and natural collocations.
                - Keep correctedDiary close to the learner text. Use modelDiary as a one-step more natural diary version.
                - Put optional extra emotion, reflection, and detail ideas into rewriteIdeas, not into modelDiary.
                - nextDiaryMission must be exactly one small mission that feels easy to try.

                Diary answer band rules:
                - DIARY_TOO_SHORT: fragment-level or too little English to review as a diary.
                - DIARY_NOT_ENGLISH: mostly Korean or another language, so English diary conversion is the next step.
                - DIARY_GRAMMAR_BLOCKING: events or feelings are visible, but grammar blocks meaning.
                - DIARY_FLOW_THIN: understandable English, but weak time flow, feeling, result, or reflection.
                - DIARY_CLEAR_BASIC: clear diary entry with only light naturalness or local grammar fixes needed.
                - DIARY_NATURAL_COMPLETE: natural, personal, diary-like entry with strong flow.

                Field rules:
                - schemaVersion must be "diary-feedback-v1".
                - All fields are required. Use an empty string when a text field does not apply.
                - strengths must be 1 to 3 short Korean comments.
                - fixPoints should contain the most useful required corrections, usually 1 to 5 items.
                - rewriteIdeas.title and rewriteIdeas.meaningKo must be Korean. The title should be a short Korean action label, such as "감정 문장 붙이기" or "작은 다짐 더하기".
                - rewriteIdeas.english and rewriteIdeas.exampleEn are the only places where English rewrite sentences should appear.
                - Do not put the same English sentence in both rewriteIdeas.english and rewriteIdeas.exampleEn. If rewriteIdeas.english is already a full usable sentence, set exampleEn to an empty string.
                - Use rewriteIdeas.exampleEn only when it shows a different context sentence that contains the suggested phrase.
                - rewriteIdeas.noteKo must explain in Korean where or why to add the idea.
                - usedDiaryExpressions are reusable phrases the learner already used well.
                - diaryExpressions are reusable diary expressions the learner can try next time.
                - diaryFlow.timeFlow and diaryFlow.detail should describe what worked well in the current diary flow.
                - diaryFlow.emotion, diaryFlow.reflection, and diaryFlow.connectionTips should describe what the learner can add next time to make the diary feel more personal and complete.
                - Important: diaryFlow.emotion and diaryFlow.reflection must be actionable next-step suggestions, not praise. Use soft Korean suggestion endings such as "~을 한 문장 더 붙여 보세요" or "~로 마무리해 보세요".
                - If emotion or reflection is already good, still suggest one small way to expand it next time instead of repeating that it is good.
                - diaryFlow.connectionTips must contain short connector phrases only, such as "Then", "After that", or "When I got home". Do not put full coaching sentences in connectionTips.
                - Keep each diaryFlow field short, concrete, and non-repetitive. Do not repeat the same point across good-flow and next-flow fields.
                - safetyFlags must include "NONE" when there is no safety concern.

                Entry metadata:
                - entryId: %s
                - attemptNo: %s
                - title: %s
                - entryDate: %s
                - mood: %s
                - previousDiaryText: %s

                Learner diary:
                %s
                """.formatted(
                safe(context.entryId()),
                context.attemptNo(),
                safe(context.title()),
                context.entryDate() == null ? "null" : context.entryDate(),
                safe(context.mood()),
                safe(context.previousDiaryText()),
                safe(context.diaryText())
        );
    }

    static Map<String, Object> jsonSchema() {
        Map<String, Object> stringSchema = Map.of("type", "string");
        Map<String, Object> nullableStringSchema = stringSchema;
        Map<String, Object> stringArraySchema = Map.of(
                "type", "array",
                "items", stringSchema
        );

        Map<String, Object> fixPointSchema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "kind", stringSchema,
                        "title", stringSchema,
                        "originalText", nullableStringSchema,
                        "revisedText", nullableStringSchema,
                        "reasonKo", stringSchema,
                        "exampleEn", nullableStringSchema
                ),
                "required", List.of("kind", "title", "originalText", "revisedText", "reasonKo", "exampleEn")
        );

        Map<String, Object> expressionSchema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "expression", stringSchema,
                        "meaningKo", stringSchema,
                        "exampleEn", nullableStringSchema,
                        "usageTipKo", stringSchema,
                        "tags", stringArraySchema
                ),
                "required", List.of("expression", "meaningKo", "exampleEn", "usageTipKo", "tags")
        );

        Map<String, Object> rewriteIdeaSchema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "title", stringSchema,
                        "english", nullableStringSchema,
                        "meaningKo", nullableStringSchema,
                        "noteKo", stringSchema,
                        "exampleEn", nullableStringSchema
                ),
                "required", List.of("title", "english", "meaningKo", "noteKo", "exampleEn")
        );

        Map<String, Object> diaryFlowSchema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "timeFlow", stringSchema,
                        "emotion", stringSchema,
                        "detail", stringSchema,
                        "reflection", stringSchema,
                        "commentKo", stringSchema,
                        "connectionTips", stringArraySchema
                ),
                "required", List.of("timeFlow", "emotion", "detail", "reflection", "commentKo", "connectionTips")
        );

        Map<String, Object> missionSchema = Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.of(
                        "focus", stringSchema,
                        "titleKo", stringSchema,
                        "instructionKo", stringSchema,
                        "starterEn", nullableStringSchema
                ),
                "required", List.of("focus", "titleKo", "instructionKo", "starterEn")
        );

        return Map.of(
                "type", "object",
                "additionalProperties", false,
                "properties", Map.ofEntries(
                        Map.entry("schemaVersion", stringSchema),
                        Map.entry("entryId", stringSchema),
                        Map.entry("attemptNo", Map.of("type", "integer")),
                        Map.entry("score", Map.of("type", "integer", "minimum", 0, "maximum", 100)),
                        Map.entry("finishable", Map.of("type", "boolean")),
                        Map.entry("diaryAnswerBand", Map.of("type", "string", "enum", List.of(
                                "DIARY_TOO_SHORT",
                                "DIARY_NOT_ENGLISH",
                                "DIARY_GRAMMAR_BLOCKING",
                                "DIARY_FLOW_THIN",
                                "DIARY_CLEAR_BASIC",
                                "DIARY_NATURAL_COMPLETE"
                        ))),
                        Map.entry("summaryKo", stringSchema),
                        Map.entry("strengths", stringArraySchema),
                        Map.entry("correctedDiary", nullableStringSchema),
                        Map.entry("modelDiary", nullableStringSchema),
                        Map.entry("modelDiaryKo", nullableStringSchema),
                        Map.entry("fixPoints", Map.of("type", "array", "items", fixPointSchema)),
                        Map.entry("diaryFlow", diaryFlowSchema),
                        Map.entry("rewriteIdeas", Map.of("type", "array", "items", rewriteIdeaSchema)),
                        Map.entry("usedDiaryExpressions", Map.of("type", "array", "items", expressionSchema)),
                        Map.entry("diaryExpressions", Map.of("type", "array", "items", expressionSchema)),
                        Map.entry("nextDiaryMission", missionSchema),
                        Map.entry("safetyFlags", stringArraySchema)
                ),
                "required", List.of(
                        "schemaVersion",
                        "entryId",
                        "attemptNo",
                        "score",
                        "finishable",
                        "diaryAnswerBand",
                        "summaryKo",
                        "strengths",
                        "correctedDiary",
                        "modelDiary",
                        "modelDiaryKo",
                        "fixPoints",
                        "diaryFlow",
                        "rewriteIdeas",
                        "usedDiaryExpressions",
                        "diaryExpressions",
                        "nextDiaryMission",
                        "safetyFlags"
                )
        );
    }

    private static String safe(String value) {
        return value == null || value.isBlank() ? "null" : value.trim();
    }
}
