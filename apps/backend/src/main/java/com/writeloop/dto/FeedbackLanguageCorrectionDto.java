package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackLanguageCorrectionDto(
        String kind,
        String label,
        String before,
        String after,
        String reason
) {
    public FeedbackLanguageCorrectionDto {
        kind = normalize(kind);
        label = normalize(label);
        before = normalize(before);
        after = normalize(after);
        reason = normalize(reason);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
