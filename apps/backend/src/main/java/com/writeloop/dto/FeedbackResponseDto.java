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
        List<GrammarFeedbackItemDto> grammarFeedback,
        String correctedAnswer,
        List<RefinementExpressionDto> refinementExpressions,
        String modelAnswer,
        String modelAnswerKo,
        String rewriteChallenge,
        List<CoachExpressionUsageDto> usedExpressions,
        FeedbackUiDto ui
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
            List<GrammarFeedbackItemDto> grammarFeedback,
            String correctedAnswer,
            List<RefinementExpressionDto> refinementExpressions,
            String modelAnswer,
            String modelAnswerKo,
            String rewriteChallenge,
            List<CoachExpressionUsageDto> usedExpressions
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
                grammarFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                usedExpressions,
                null
        );
    }

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
                List.of(),
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                null,
                rewriteChallenge,
                List.of(),
                null
        );
    }

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
            String rewriteChallenge,
            List<CoachExpressionUsageDto> usedExpressions
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
                List.of(),
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                null,
                rewriteChallenge,
                usedExpressions,
                null
        );
    }

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
            List<GrammarFeedbackItemDto> grammarFeedback,
            String correctedAnswer,
            List<RefinementExpressionDto> refinementExpressions,
            String modelAnswer,
            String rewriteChallenge,
            List<CoachExpressionUsageDto> usedExpressions
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
                grammarFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                null,
                rewriteChallenge,
                usedExpressions,
                null
        );
    }

    public FeedbackResponseDto withUi(FeedbackUiDto ui) {
        return new FeedbackResponseDto(
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
                grammarFeedback,
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                usedExpressions,
                ui
        );
    }
}
