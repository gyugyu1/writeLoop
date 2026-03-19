package com.writeloop.dto;

import java.util.List;

public record FeedbackResponseDto(
        String promptId,
        String sessionId,
        int attemptNo,
        int score,
        boolean loopComplete,
        String completionMessage,
        String summary,
        List<String> strengths,
        List<CorrectionDto> corrections,
        String modelAnswer,
        String rewriteChallenge
) {
}
