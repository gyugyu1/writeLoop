package com.writeloop.dto;

import com.writeloop.persistence.SavedExpressionSourceType;

public record SaveExpressionRequestDto(
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
}
