package com.writeloop.dto;

import java.util.List;

public record DiaryExpressionDto(
        String expression,
        String meaningKo,
        String exampleEn,
        String usageTipKo,
        List<String> tags
) {
    public DiaryExpressionDto {
        expression = normalize(expression);
        meaningKo = normalize(meaningKo);
        exampleEn = normalize(exampleEn);
        usageTipKo = normalize(usageTipKo);
        tags = tags == null
                ? List.of()
                : tags.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
