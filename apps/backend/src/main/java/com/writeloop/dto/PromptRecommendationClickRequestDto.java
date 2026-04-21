package com.writeloop.dto;

public record PromptRecommendationClickRequestDto(
        String promptId,
        String guestId
) {
}
