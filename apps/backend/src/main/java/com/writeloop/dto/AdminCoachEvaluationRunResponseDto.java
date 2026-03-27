package com.writeloop.dto;

import java.util.List;

public record AdminCoachEvaluationRunResponseDto(
        int requestedLimit,
        int processedCount,
        int appropriateCount,
        int inappropriateCount,
        int needsReviewCount,
        String evaluationModel,
        List<AdminCoachEvaluationItemDto> items
) {
}
