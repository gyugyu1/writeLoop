package com.writeloop.dto;

public record CoachExpressionUsageDto(
        String expression,
        boolean matched,
        String matchType,
        String matchedText,
        String source,
        String meaningKo,
        String exampleEn,
        String usageTip
) {
}
