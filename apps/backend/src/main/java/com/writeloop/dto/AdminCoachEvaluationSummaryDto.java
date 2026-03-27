package com.writeloop.dto;

public record AdminCoachEvaluationSummaryDto(
        boolean evaluatorConfigured,
        long notEvaluatedCount,
        long inReviewCount,
        long appropriateCount,
        long inappropriateCount,
        long needsReviewCount
) {
}
