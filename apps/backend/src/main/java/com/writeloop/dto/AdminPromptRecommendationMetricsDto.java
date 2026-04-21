package com.writeloop.dto;

import java.util.List;

public record AdminPromptRecommendationMetricsDto(
        String startDate,
        String endDate,
        DailyDifficultyDto difficultyFilter,
        long totalShownCount,
        long totalClickedCount,
        long totalStartedCount,
        long totalCompletedCount,
        double clickRate,
        double startRate,
        double completeRate,
        List<AdminPromptRecommendationMetricsItemDto> items
) {
}
