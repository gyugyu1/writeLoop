package com.writeloop.dto;

public record NowInEnglishReflectionExpressionDto(
        String expression,
        String meaningKo,
        String usageTip,
        String example
) {
    public NowInEnglishReflectionExpressionDto {
        expression = normalize(expression);
        meaningKo = normalize(meaningKo);
        usageTip = normalize(usageTip);
        example = normalize(example);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
