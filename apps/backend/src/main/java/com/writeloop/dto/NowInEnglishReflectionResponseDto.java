package com.writeloop.dto;

import java.util.List;

public record NowInEnglishReflectionResponseDto(
        String dateKey,
        int entryCount,
        String headlineKo,
        String summaryKo,
        List<String> highlightsKo,
        String patternKo,
        String gentleCorrectionKo,
        String nextActionKo,
        String nextActionExampleEn,
        List<NowInEnglishReflectionExpressionDto> expressions,
        String closingKo
) {
    public NowInEnglishReflectionResponseDto {
        dateKey = normalize(dateKey);
        headlineKo = normalize(headlineKo);
        summaryKo = normalize(summaryKo);
        highlightsKo = normalizeList(highlightsKo);
        patternKo = normalize(patternKo);
        gentleCorrectionKo = normalize(gentleCorrectionKo);
        nextActionKo = normalize(nextActionKo);
        nextActionExampleEn = normalize(nextActionExampleEn);
        expressions = expressions == null ? List.of() : expressions.stream()
                .filter(expression -> expression != null && !expression.expression().isBlank())
                .limit(4)
                .toList();
        closingKo = normalize(closingKo);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static List<String> normalizeList(List<String> values) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .map(NowInEnglishReflectionResponseDto::normalize)
                .filter(value -> !value.isBlank())
                .limit(4)
                .toList();
    }
}
