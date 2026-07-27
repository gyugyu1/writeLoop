package com.writeloop.dto;

public record FeedbackRequestDto(
        String promptId,
        String answer,
        String sessionId,
        String attemptType,
        String guestId,
        String submissionId
) {
    public FeedbackRequestDto(
            String promptId,
            String answer,
            String sessionId,
            String attemptType,
            String guestId
    ) {
        this(promptId, answer, sessionId, attemptType, guestId, null);
    }
}
