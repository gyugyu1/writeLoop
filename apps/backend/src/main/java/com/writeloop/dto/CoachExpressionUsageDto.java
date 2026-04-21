package com.writeloop.dto;

import com.writeloop.util.ExpressionTagSupport;

import java.util.List;

public record CoachExpressionUsageDto(
        String expression,
        boolean matched,
        String matchType,
        String matchedText,
        String source,
        String meaningKo,
        String exampleEn,
        String usageTip,
        List<String> tags
) {
    public CoachExpressionUsageDto(
            String expression,
            boolean matched,
            String matchType,
            String matchedText,
            String source,
            String meaningKo,
            String exampleEn,
            String usageTip
    ) {
        this(expression, matched, matchType, matchedText, source, meaningKo, exampleEn, usageTip, List.of());
    }

    public CoachExpressionUsageDto {
        tags = ExpressionTagSupport.sanitizeTags(tags, expression);
    }
}
