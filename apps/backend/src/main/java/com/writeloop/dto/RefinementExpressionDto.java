package com.writeloop.dto;

public record RefinementExpressionDto(
        String expression,
        String guidance,
        String example,
        String meaningKo
) {
    public RefinementExpressionDto(
            String expression,
            String guidance,
            String example
    ) {
        this(expression, guidance, example, null);
    }
}
