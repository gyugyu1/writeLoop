package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackRevealLaterDto(
        Integer score,
        String detailLabel,
        String scoreLabel,
        String modelAnswerLabel
) {
    public FeedbackRevealLaterDto {
        detailLabel = normalize(detailLabel);
        scoreLabel = normalize(scoreLabel);
        modelAnswerLabel = normalize(modelAnswerLabel);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
