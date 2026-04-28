package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackCoachMoveDto(
        String focus,
        String focusType,
        String why,
        String before,
        String after,
        String instruction,
        String successCheck
) {
    public FeedbackCoachMoveDto {
        focus = normalize(focus);
        focusType = normalize(focusType);
        why = normalize(why);
        before = normalize(before);
        after = normalize(after);
        instruction = normalize(instruction);
        successCheck = normalize(successCheck);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
