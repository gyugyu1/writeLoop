package com.writeloop.dto;

import java.util.List;

public record DailyPromptRecommendationDto(
        String recommendedDate,
        DailyDifficultyDto difficulty,
        List<PromptDto> prompts
) {
}
