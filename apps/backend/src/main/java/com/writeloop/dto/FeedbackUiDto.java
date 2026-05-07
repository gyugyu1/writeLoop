package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackUiDto(
        @JsonIgnore FeedbackFocusCardDto focusCard,
        @JsonIgnore FeedbackPrimaryFixDto primaryFix,
        FeedbackMicroTipDto microTip,
        List<FeedbackSecondaryLearningPointDto> fixPoints,
        @JsonIgnore FeedbackNextStepPracticeDto nextStepPractice,
        List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
        FeedbackScreenPolicyDto screenPolicy,
        FeedbackLoopStatusDto loopStatus
) {
    public FeedbackUiDto {
        fixPoints = fixPoints == null ? List.of() : List.copyOf(fixPoints);
        rewriteSuggestions = rewriteSuggestions == null ? List.of() : List.copyOf(rewriteSuggestions);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackNextStepPracticeDto nextStepPractice
    ) {
        this(focusCard, primaryFix, null, List.of(), nextStepPractice, List.of(), null, null);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            List<FeedbackSecondaryLearningPointDto> fixPoints,
            FeedbackNextStepPracticeDto nextStepPractice
    ) {
        this(focusCard, primaryFix, microTip, fixPoints, nextStepPractice, List.of(), null, null);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            List<FeedbackSecondaryLearningPointDto> fixPoints,
            FeedbackNextStepPracticeDto nextStepPractice,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(focusCard, primaryFix, microTip, fixPoints, nextStepPractice, List.of(), screenPolicy, loopStatus);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            List<FeedbackSecondaryLearningPointDto> legacySecondaryLearningPoints,
            List<FeedbackSecondaryLearningPointDto> fixPoints,
            FeedbackNextStepPracticeDto nextStepPractice,
            List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(
                focusCard,
                primaryFix,
                microTip,
                mergeLegacyFixPoints(fixPoints, legacySecondaryLearningPoints),
                nextStepPractice,
                rewriteSuggestions,
                screenPolicy,
                loopStatus
        );
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            List<FeedbackSecondaryLearningPointDto> legacySecondaryLearningPoints,
            List<FeedbackSecondaryLearningPointDto> fixPoints,
            FeedbackNextStepPracticeDto nextStepPractice,
            List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
            List<FeedbackModelAnswerVariantDto> ignoredModelAnswerVariants,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(
                focusCard,
                primaryFix,
                microTip,
                mergeLegacyFixPoints(fixPoints, legacySecondaryLearningPoints),
                nextStepPractice,
                rewriteSuggestions,
                screenPolicy,
                loopStatus
        );
    }

    private static List<FeedbackSecondaryLearningPointDto> mergeLegacyFixPoints(
            List<FeedbackSecondaryLearningPointDto> fixPoints,
            List<FeedbackSecondaryLearningPointDto> legacySecondaryLearningPoints
    ) {
        if (fixPoints != null && !fixPoints.isEmpty()) {
            return fixPoints;
        }
        return legacySecondaryLearningPoints == null ? List.of() : legacySecondaryLearningPoints;
    }

}
