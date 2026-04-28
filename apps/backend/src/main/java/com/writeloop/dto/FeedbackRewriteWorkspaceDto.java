package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackRewriteWorkspaceDto(
        String seedText,
        String placeholder,
        String targetTextHint,
        boolean lockMeaning
) {
    public FeedbackRewriteWorkspaceDto {
        seedText = normalize(seedText);
        placeholder = normalize(placeholder);
        targetTextHint = normalize(targetTextHint);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
