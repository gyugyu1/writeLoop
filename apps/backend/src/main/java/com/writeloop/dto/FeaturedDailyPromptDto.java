package com.writeloop.dto;

public record FeaturedDailyPromptDto(
        String recommendedDate,
        DailyDifficultyDto difficulty,
        String userState,
        boolean fallbackUsed,
        PromptRecommendationItemDto featured
) {
    public FeaturedDailyPromptDto {
        userState = userState == null || userState.isBlank() ? "NEW" : userState.trim();
    }
}
