package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

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
    public FeedbackResponseDto {
        strengths = strengths == null ? List.of() : List.copyOf(strengths);
        corrections = corrections == null ? List.of() : List.copyOf(corrections);
        inlineFeedback = inlineFeedback == null ? List.of() : List.copyOf(inlineFeedback);
        grammarFeedback = grammarFeedback == null ? List.of() : List.copyOf(grammarFeedback);
        refinementExpressions = refinementExpressions == null ? List.of() : List.copyOf(refinementExpressions);
        usedExpressions = usedExpressions == null ? List.of() : List.copyOf(usedExpressions);
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
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                usedExpressions,
                nextUi,
                loop,
                coachMove,
                rewriteWorkspace,
                completion,
                revealLater
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
                correctedAnswer,
                refinementExpressions,
                modelAnswer,
                modelAnswerKo,
                rewriteChallenge,
                usedExpressions,
                ui,
                nextLoop,
                nextCoachMove,
                nextRewriteWorkspace,
                nextCompletion,
                nextRevealLater
        );
    }
}
