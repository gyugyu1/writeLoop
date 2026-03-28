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
        List<InlineFeedbackSegmentDto> inlineFeedback,
        String correctedAnswer,
        List<RefinementExpressionDto> refinementExpressions,
        String modelAnswer,
        String rewriteChallenge,
        List<CoachExpressionUsageDto> usedExpressions
) {
    public FeedbackResponseDto(
            String promptId,
            String sessionId,
            int attemptNo,
            int score,
            boolean loopComplete,
            String completionMessage,
            String summary,
            List<String> strengths,
            List<CorrectionDto> corrections,
            List<InlineFeedbackSegmentDto> inlineFeedback,
            String correctedAnswer,
            List<RefinementExpressionDto> refinementExpressions,
            String modelAnswer,
            String rewriteChallenge
    ) {
        this(
                promptId,
                sessionId,
                attemptNo,
                score,
                loopComplete,
                completionMessage,
                summary,
                strengths,
                corrections,
                inlineFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                rewriteChallenge,
                List.of()
        );
    }
}
