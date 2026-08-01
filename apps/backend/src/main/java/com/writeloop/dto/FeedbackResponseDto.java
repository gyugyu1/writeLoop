package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record FeedbackResponseDto(
        String promptId,
        String sessionId,
        int attemptNo,
        boolean loopComplete,
        String completionMessage,
        String summary,
        List<String> strengths,
        @JsonIgnore List<CorrectionDto> corrections,
        List<InlineFeedbackSegmentDto> inlineFeedback,
        @JsonIgnore List<GrammarFeedbackItemDto> grammarFeedback,
        @JsonAlias("correctedAnswer") String revisedAnswer,
        List<RefinementExpressionDto> refinementExpressions,
        String modelAnswer,
        String modelAnswerKo,
        String rewriteChallenge,
        FeedbackUiDto ui,
        FeedbackLoopDto loop,
        FeedbackCoachMoveDto coachMove,
        FeedbackRewriteWorkspaceDto rewriteWorkspace,
        FeedbackCompletionDto completion,
        FeedbackRevealLaterDto revealLater,
        VisibleFeedbackSnapshotDto visibleFeedback
) {
    public FeedbackResponseDto {
        strengths = strengths == null ? List.of() : List.copyOf(strengths);
        corrections = corrections == null ? List.of() : List.copyOf(corrections);
        inlineFeedback = inlineFeedback == null ? List.of() : List.copyOf(inlineFeedback);
        grammarFeedback = grammarFeedback == null ? List.of() : List.copyOf(grammarFeedback);
        refinementExpressions = refinementExpressions == null ? List.of() : List.copyOf(refinementExpressions);
    }

    public FeedbackResponseDto(
            String promptId,
            String sessionId,
            int attemptNo,
            boolean loopComplete,
            String completionMessage,
            String summary,
            List<String> strengths,
            List<CorrectionDto> corrections,
            List<InlineFeedbackSegmentDto> inlineFeedback,
            List<GrammarFeedbackItemDto> grammarFeedback,
            String revisedAnswer,
            List<RefinementExpressionDto> refinementExpressions,
            String modelAnswer,
            String modelAnswerKo,
            String rewriteChallenge,
            FeedbackUiDto ui,
            FeedbackLoopDto loop,
            FeedbackCoachMoveDto coachMove,
            FeedbackRewriteWorkspaceDto rewriteWorkspace,
            FeedbackCompletionDto completion,
            FeedbackRevealLaterDto revealLater
    ) {
        this(
                promptId,
                sessionId,
                attemptNo,
                loopComplete,
                completionMessage,
                summary,
                strengths,
                corrections,
                inlineFeedback,
                grammarFeedback,
                revisedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                ui,
                loop,
                coachMove,
                rewriteWorkspace,
                completion,
                revealLater,
                null
        );
    }

    public FeedbackResponseDto withUi(FeedbackUiDto nextUi) {
        return new FeedbackResponseDto(
                promptId,
                sessionId,
                attemptNo,
                loopComplete,
                completionMessage,
                summary,
                strengths,
                corrections,
                inlineFeedback,
                grammarFeedback,
                revisedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                nextUi,
                loop,
                coachMove,
                rewriteWorkspace,
                completion,
                revealLater,
                visibleFeedback
        );
    }

    public FeedbackResponseDto withLoopExperience(
            FeedbackLoopDto nextLoop,
            FeedbackCoachMoveDto nextCoachMove,
            FeedbackRewriteWorkspaceDto nextRewriteWorkspace,
            FeedbackCompletionDto nextCompletion,
            FeedbackRevealLaterDto nextRevealLater
    ) {
        return new FeedbackResponseDto(
                promptId,
                sessionId,
                attemptNo,
                loopComplete,
                completionMessage,
                summary,
                strengths,
                corrections,
                inlineFeedback,
                grammarFeedback,
                revisedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                ui,
                nextLoop,
                nextCoachMove,
                nextRewriteWorkspace,
                nextCompletion,
                nextRevealLater,
                visibleFeedback
        );
    }

    public FeedbackResponseDto withVisibleFeedback(VisibleFeedbackSnapshotDto nextVisibleFeedback) {
        return new FeedbackResponseDto(
                promptId,
                sessionId,
                attemptNo,
                loopComplete,
                completionMessage,
                summary,
                strengths,
                corrections,
                inlineFeedback,
                grammarFeedback,
                revisedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                ui,
                loop,
                coachMove,
                rewriteWorkspace,
                completion,
                revealLater,
                nextVisibleFeedback
        );
    }
}
