package com.writeloop.dto;

public record AnswerHistoryUsedExpressionDto(
        String expression,
        String matchType,
        String matchedText,
        String source
) {
}
