package com.writeloop.dto;

import java.util.List;

public record DailyPromptRecommendationDto(
        String recommendedDate,
        DailyDifficultyDto difficulty,
        String userState,
        boolean fallbackUsed,
        PromptRecommendationItemDto featured,
        List<PromptRecommendationItemDto> alternatives,
        List<PromptDto> prompts
) {
    public DailyPromptRecommendationDto {
        userState = userState == null || userState.isBlank() ? "NEW" : userState.trim();
        alternatives = alternatives == null ? List.of() : List.copyOf(alternatives);
        prompts = prompts == null ? List.of() : List.copyOf(prompts);
    }
}
