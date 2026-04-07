package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;

public record FeedbackUiDto(
        @Deprecated @JsonIgnore FeedbackFocusCardDto focusCard,
        @Deprecated @JsonIgnore FeedbackPrimaryFixDto primaryFix,
        FeedbackMicroTipDto microTip,
        java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
        java.util.List<FeedbackSecondaryLearningPointDto> fixPoints,
        FeedbackRewritePracticeDto rewritePractice,
        java.util.List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
        FeedbackScreenPolicyDto screenPolicy,
        FeedbackLoopStatusDto loopStatus
) {
    public FeedbackUiDto {
        secondaryLearningPoints = secondaryLearningPoints == null ? java.util.List.of() : java.util.List.copyOf(secondaryLearningPoints);
        fixPoints = fixPoints == null ? java.util.List.of() : java.util.List.copyOf(fixPoints);
        rewriteSuggestions = rewriteSuggestions == null ? java.util.List.of() : java.util.List.copyOf(rewriteSuggestions);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackRewritePracticeDto rewritePractice
    ) {
        this(focusCard, primaryFix, null, java.util.List.of(), java.util.List.of(), rewritePractice, java.util.List.of(), null, null);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackRewritePracticeDto rewritePractice,
            java.util.List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(
                focusCard,
                primaryFix,
                microTip,
                secondaryLearningPoints,
                java.util.List.of(),
                rewritePractice,
                rewriteSuggestions,
                screenPolicy,
                loopStatus
        );
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackRewritePracticeDto rewritePractice
    ) {
        this(focusCard, primaryFix, microTip, secondaryLearningPoints, java.util.List.of(), rewritePractice, java.util.List.of(), null, null);
    }

    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackMicroTipDto microTip,
            java.util.List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackRewritePracticeDto rewritePractice,
            FeedbackScreenPolicyDto screenPolicy,
            FeedbackLoopStatusDto loopStatus
    ) {
        this(focusCard, primaryFix, microTip, secondaryLearningPoints, java.util.List.of(), rewritePractice, java.util.List.of(), screenPolicy, loopStatus);
    }
}
