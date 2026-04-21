package com.writeloop.dto;

import com.writeloop.util.ExpressionTagSupport;

import java.util.List;

public record CoachExpressionDto(
        String expression,
        String meaningKo,
        String usageTip,
        String example,
        String sourceHintType,
        List<String> tags
) {
    public CoachExpressionDto(
            String expression,
            String meaningKo,
            String usageTip,
            String example,
            String sourceHintType
    ) {
        this(expression, meaningKo, usageTip, example, sourceHintType, List.of());
    }

    public CoachExpressionDto {
        tags = ExpressionTagSupport.withCoachDefaults(tags, expression);
    }
}
