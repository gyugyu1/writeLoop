package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@JsonIgnoreProperties(ignoreUnknown = true)
public record FeedbackRewriteWorkspaceDto(
        String seedText,
        String placeholder,
        boolean lockMeaning
) {
    public FeedbackRewriteWorkspaceDto {
        seedText = normalize(seedText);
        placeholder = normalize(placeholder);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
