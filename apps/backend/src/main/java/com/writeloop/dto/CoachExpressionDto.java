package com.writeloop.dto;

public record CoachExpressionDto(
        String expression,
        String meaningKo,
        String usageTip,
        String example,
        String sourceHintType
) {
}
