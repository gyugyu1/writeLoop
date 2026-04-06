package com.writeloop.dto;

public record FeedbackSecondaryLearningPointDto(
        String kind,
        String title,
        String headline,
        String supportText,
        String originalText,
        String revisedText,
        String meaningKo,
        String guidanceKo,
        String exampleEn,
        String exampleKo
) {
    public FeedbackSecondaryLearningPointDto {
        kind = normalize(kind);
        title = normalize(title);
        headline = normalize(headline);
        supportText = normalize(supportText);
        originalText = normalize(originalText);
        revisedText = normalize(revisedText);
        meaningKo = normalize(meaningKo);
        guidanceKo = normalize(guidanceKo);
        exampleEn = normalize(exampleEn);
        exampleKo = normalize(exampleKo);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
