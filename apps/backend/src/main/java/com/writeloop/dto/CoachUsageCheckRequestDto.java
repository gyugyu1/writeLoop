package com.writeloop.dto;

import java.util.List;

public record CoachUsageCheckRequestDto(
        String promptId,
        String answer,
        String sessionId,
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
        this(promptId, answer, sessionId, attemptNo, expressions, null);
    }
}
