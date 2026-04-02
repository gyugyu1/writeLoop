package com.writeloop.dto;

public record FeedbackUiDto(
        FeedbackFocusCardDto focusCard,
        FeedbackPrimaryFixDto primaryFix,
        FeedbackMicroTipDto microTip,
        FeedbackRewritePracticeDto rewritePractice,
        FeedbackScreenPolicyDto screenPolicy,
        FeedbackLoopStatusDto loopStatus
) {
    public FeedbackUiDto(
            FeedbackFocusCardDto focusCard,
            FeedbackPrimaryFixDto primaryFix,
            FeedbackRewritePracticeDto rewritePractice
    ) {
        this(focusCard, primaryFix, null, rewritePractice, null, null);
    }
}
