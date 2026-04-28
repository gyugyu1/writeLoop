package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackCompletionDto(
        String headline,
        String improvedPoint,
        String encouragement,
        String nextTinyGoal
) {
    public FeedbackCompletionDto {
        headline = normalize(headline);
        improvedPoint = normalize(improvedPoint);
        encouragement = normalize(encouragement);
        nextTinyGoal = normalize(nextTinyGoal);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
