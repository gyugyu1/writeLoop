package com.writeloop.dto;

public record NowInEnglishCoachFeedbackResponseDto(
        String originalText,
        String headlineKo,
        String praiseKo,
        String suggestionEn,
        String suggestionTranslationKo,
        String suggestionKo,
        String nextQuestionKo,
        String expression,
        String expressionMeaningKo,
        String expressionExampleEn
) {
    public NowInEnglishCoachFeedbackResponseDto {
        originalText = normalize(originalText);
        headlineKo = normalize(headlineKo);
        praiseKo = normalize(praiseKo);
        suggestionEn = normalize(suggestionEn);
        suggestionTranslationKo = normalize(suggestionTranslationKo);
        suggestionKo = normalize(suggestionKo);
        nextQuestionKo = normalize(nextQuestionKo);
        expression = normalize(expression);
        expressionMeaningKo = normalize(expressionMeaningKo);
        expressionExampleEn = normalize(expressionExampleEn);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
