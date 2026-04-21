package com.writeloop.dto;

import com.writeloop.persistence.SavedExpressionSourceType;

import java.util.List;

public record SaveExpressionRequestDto(
        String expression,
        String meaningKo,
        String usageTipKo,
        String exampleEn,
        SavedExpressionSourceType sourceType,
        String promptId,
        String answerSessionId,
        Integer answerAttemptNo,
        String coachInteractionId,
        List<String> tags
) {
    public SaveExpressionRequestDto(
            String expression,
            String meaningKo,
            String usageTipKo,
            String exampleEn,
            SavedExpressionSourceType sourceType,
            String promptId,
            String answerSessionId,
            Integer answerAttemptNo,
            String coachInteractionId
    ) {
        this(expression, meaningKo, usageTipKo, exampleEn, sourceType, promptId, answerSessionId, answerAttemptNo, coachInteractionId, List.of());
    }
}
