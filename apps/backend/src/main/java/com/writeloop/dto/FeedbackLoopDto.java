package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackLoopDto(
        String status,
        String headline,
        String nextAction,
        String nextActionLabel,
        String detailToggleLabel
) {
    public FeedbackLoopDto {
        status = normalize(status);
        headline = normalize(headline);
        nextAction = normalize(nextAction);
        nextActionLabel = normalize(nextActionLabel);
        detailToggleLabel = normalize(detailToggleLabel);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
