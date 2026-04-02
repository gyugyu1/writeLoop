package com.writeloop.dto;

public record FeedbackLoopStatusDto(
        String badge,
        String headline,
        String supportText,
        String rewriteCtaLabel,
        String finishCtaLabel,
        String cancelCtaLabel
) {
    public FeedbackLoopStatusDto {
        badge = normalizeNullable(badge);
        headline = headline == null ? "" : headline.trim();
        supportText = normalizeNullable(supportText);
        rewriteCtaLabel = normalizeNullable(rewriteCtaLabel);
        finishCtaLabel = normalizeNullable(finishCtaLabel);
        cancelCtaLabel = normalizeNullable(cancelCtaLabel);
    }

    private static String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
