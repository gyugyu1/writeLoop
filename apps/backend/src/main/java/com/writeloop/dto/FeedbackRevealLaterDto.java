package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackRevealLaterDto(
        String detailLabel,
        String modelAnswerLabel
) {
    public FeedbackRevealLaterDto {
        detailLabel = normalize(detailLabel);
        modelAnswerLabel = normalize(modelAnswerLabel);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
