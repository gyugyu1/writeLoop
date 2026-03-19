package com.writeloop.dto;

public record FeedbackRequestDto(
        String promptId,
        String answer,
        String sessionId,
        String attemptType,
        String guestId
) {
}
