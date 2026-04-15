package com.writeloop.dto;

import java.util.List;

public record CoachUsageCheckRequestDto(
        String promptId,
        String answer,
        String sessionId,
        String guestId,
        Integer attemptNo,
        List<String> expressions,
        String interactionId
) {
    public CoachUsageCheckRequestDto(
            String promptId,
            String answer,
            String sessionId,
            Integer attemptNo,
            List<String> expressions
    ) {
        this(promptId, answer, sessionId, null, attemptNo, expressions, null);
    }

    public CoachUsageCheckRequestDto(
            String promptId,
            String answer,
            String sessionId,
            Integer attemptNo,
            List<String> expressions,
            String interactionId
    ) {
        this(promptId, answer, sessionId, null, attemptNo, expressions, interactionId);
    }

    public CoachUsageCheckRequestDto(
            String promptId,
            String answer,
            String sessionId,
            String guestId,
            Integer attemptNo,
            List<String> expressions
    ) {
        this(promptId, answer, sessionId, guestId, attemptNo, expressions, null);
    }
}
