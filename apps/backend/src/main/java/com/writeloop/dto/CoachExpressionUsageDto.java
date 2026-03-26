package com.writeloop.dto;

public record CoachExpressionUsageDto(
        String expression,
        boolean matched,
        String matchType,
        String matchedText
) {
}
