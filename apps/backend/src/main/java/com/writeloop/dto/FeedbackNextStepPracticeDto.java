package com.writeloop.dto;

public record FeedbackNextStepPracticeDto(
        String kind,
        String title,
        String headline,
        String supportText,
        String originalText,
        String revisedText,
        String meaningKo,
        String guidanceKo,
        String exampleEn,
        String exampleKo,
        String ctaLabel,
        boolean optionalTone
) {
    public FeedbackNextStepPracticeDto {
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
        ctaLabel = normalize(ctaLabel);
    }

    public FeedbackNextStepPracticeDto(
            String title,
            String headline,
            String supportText,
            String ctaLabel,
            boolean optionalTone
    ) {
        this(
                null,
                title,
                headline,
                supportText,
                null,
                null,
                null,
                null,
                null,
                null,
                ctaLabel,
                optionalTone
        );
    }

    @Deprecated
    public String starter() {
        return headline;
    }

    @Deprecated
    public String instruction() {
        return supportText;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
