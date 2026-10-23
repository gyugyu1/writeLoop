package com.writeloop.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DiaryFeedbackPromptSupportTest {

    @Test
    void analysisComesBeforeBandAndScore() {
        List<String> keys = topLevelKeys(DiaryFeedbackPromptSupport.jsonSchema(false));

        // 생성 순서 = 키 순서. 교정 포인트와 흐름 분석을 먼저 쓰고 등급·점수를 정한다.
        assertThat(keys.indexOf("fixPoints")).isLessThan(keys.indexOf("diaryAnswerBand"));
        assertThat(keys.indexOf("diaryFlow")).isLessThan(keys.indexOf("diaryAnswerBand"));
        assertThat(keys.indexOf("diaryAnswerBand")).isLessThan(keys.indexOf("score"));
    }

    @Test
    void doesNotGenerateServerOwnedOrUnusedFields() {
        List<String> keys = topLevelKeys(DiaryFeedbackPromptSupport.jsonSchema(true));

        assertThat(keys).doesNotContain("schemaVersion", "entryId", "attemptNo", "finishable", "safetyFlags");
    }

    @Test
    void generatesFullDiariesOnlyWhenRequested() {
        assertThat(topLevelKeys(DiaryFeedbackPromptSupport.jsonSchema(false)))
                .doesNotContain("correctedDiary", "modelDiary", "modelDiaryKo");
        assertThat(topLevelKeys(DiaryFeedbackPromptSupport.jsonSchema(true)))
                .contains("correctedDiary", "modelDiary", "modelDiaryKo");
        assertThat(DiaryFeedbackPromptSupport.buildPrompt(context(false))).doesNotContain("modelDiary");
        assertThat(DiaryFeedbackPromptSupport.buildPrompt(context(true))).contains("modelDiary");
    }

    @Test
    @SuppressWarnings("unchecked")
    void limitsFixPointKindsToAFixedSet() {
        Map<String, Object> properties = (Map<String, Object>) DiaryFeedbackPromptSupport.jsonSchema(false).get("properties");
        Map<String, Object> fixPointItem = (Map<String, Object>) ((Map<String, Object>) properties.get("fixPoints")).get("items");
        Map<String, Object> kind = (Map<String, Object>) ((Map<String, Object>) fixPointItem.get("properties")).get("kind");

        assertThat(kind.get("enum")).isEqualTo(List.of("GRAMMAR", "WORD_CHOICE", "NATURALNESS", "FLOW", "SENTENCE_FORM"));
    }

    @Test
    void requiresEveryGeneratedField() {
        Map<String, Object> schema = DiaryFeedbackPromptSupport.jsonSchema(false);

        assertThat(schema.get("required")).isEqualTo(topLevelKeys(schema));
    }

    @Test
    void explainsHowToUseMoodAndThePreviousDiary() {
        String prompt = DiaryFeedbackPromptSupport.buildPrompt(context(false));

        assertThat(prompt).contains("mood is the mood the learner picked");
        assertThat(prompt).contains("previousDiaryText is the learner's previous version");
        assertThat(prompt).doesNotContain("entryId:");
    }

    @SuppressWarnings("unchecked")
    private static List<String> topLevelKeys(Map<String, Object> schema) {
        return new ArrayList<>(((Map<String, Object>) schema.get("properties")).keySet());
    }

    private static DiaryFeedbackPromptContext context(boolean includeFullDiaries) {
        return new DiaryFeedbackPromptContext(
                "entry-1",
                2,
                "A rainy day",
                LocalDate.of(2026, 10, 22),
                "calm",
                "I walked to the park. It was raining.",
                "I walk to park.",
                includeFullDiaries
        );
    }
}
