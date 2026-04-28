package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.List;

public record FeedbackResponseDto(
        String promptId,
        String sessionId,
        int attemptNo,
        int score,
        boolean loopComplete,
        String completionMessage,
        @Deprecated String summary,
        List<String> strengths,
        @Deprecated @JsonIgnore List<CorrectionDto> corrections,
        @Deprecated List<InlineFeedbackSegmentDto> inlineFeedback,
        @Deprecated @JsonIgnore List<GrammarFeedbackItemDto> grammarFeedback,
        String correctedAnswer,
        List<RefinementExpressionDto> refinementExpressions,
        String modelAnswer,
        String modelAnswerKo,
        String rewriteChallenge,
        List<CoachExpressionUsageDto> usedExpressions,
        FeedbackUiDto ui,
        FeedbackLoopDto loop,
        FeedbackCoachMoveDto coachMove,
        FeedbackRewriteWorkspaceDto rewriteWorkspace,
        FeedbackCompletionDto completion,
        FeedbackRevealLaterDto revealLater
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
                null,
                null,
                null,
                null,
                null,
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
                usedExpressions
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
                null,
                null,
                null,
                null,
                null,
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
                null,
                null,
                null,
                null,
                null,
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
            String modelAnswerKo,
            String rewriteChallenge,
            List<CoachExpressionUsageDto> usedExpressions,
            FeedbackUiDto ui
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
                ui,
                null,
                null,
                null,
                null,
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
                ui,
                loop,
                coachMove,
                rewriteWorkspace,
                completion,
                revealLater
        );
    }

    public FeedbackResponseDto withLoopExperience(
            FeedbackLoopDto loop,
            FeedbackCoachMoveDto coachMove,
            FeedbackRewriteWorkspaceDto rewriteWorkspace,
            FeedbackCompletionDto completion,
            FeedbackRevealLaterDto revealLater
    ) {
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
                ui,
                loop,
                coachMove,
                rewriteWorkspace,
                completion,
                revealLater
        );
    }
}
