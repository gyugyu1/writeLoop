package com.writeloop.dto;

public record AdminPromptRecommendationMetricsItemDto(
        String promptId,
        String topic,
        String topicCategory,
        String topicDetail,
        String difficulty,
        String questionEn,
        String slotType,
        String reasonCode,
        long shownCount,
        long clickedCount,
        long startedCount,
        long completedCount,
        double clickRate,
        double startRate,
        double completeRate,
        double completionAfterStartRate
) {
}
