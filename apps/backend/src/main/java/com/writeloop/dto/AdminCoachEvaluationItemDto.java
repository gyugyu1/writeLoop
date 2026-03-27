package com.writeloop.dto;

public record AdminCoachEvaluationItemDto(
        String interactionId,
        String promptId,
        String queryMode,
        String meaningFamily,
        String evaluationStatus,
        Integer evaluationScore,
        String evaluationVerdict,
        String evaluationSummary
) {
}
