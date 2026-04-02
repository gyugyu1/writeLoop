package com.writeloop.service;

import java.util.List;

record FeedbackScreenPolicy(
        CompletionState completionState,
        List<FeedbackScreenSectionId> sectionOrder,
        SectionDisplayMode keepWhatWorksDisplayMode,
        SectionDisplayMode fixFirstDisplayMode,
        FixFirstMode fixFirstMode,
        SectionDisplayMode rewriteGuideDisplayMode,
        RewriteGuideMode rewriteGuideMode,
        ModelAnswerDisplayMode modelAnswerDisplayMode,
        RefinementDisplayMode refinementDisplayMode,
        int keepWhatWorksMaxItems,
        int keepExpressionChipMaxItems,
        int refinementMaxCards,
        boolean showFinishCta,
        boolean showRewriteCta,
        boolean showCancelCta
) {
    FeedbackScreenPolicy {
        completionState = completionState == null ? CompletionState.NEEDS_REVISION : completionState;
        sectionOrder = sectionOrder == null ? List.of() : List.copyOf(sectionOrder);
        keepWhatWorksDisplayMode = keepWhatWorksDisplayMode == null ? SectionDisplayMode.HIDE : keepWhatWorksDisplayMode;
        fixFirstDisplayMode = fixFirstDisplayMode == null ? SectionDisplayMode.HIDE : fixFirstDisplayMode;
        fixFirstMode = fixFirstMode == null ? FixFirstMode.HIDE : fixFirstMode;
        rewriteGuideDisplayMode = rewriteGuideDisplayMode == null
                ? SectionDisplayMode.SHOW_EXPANDED
                : rewriteGuideDisplayMode;
        rewriteGuideMode = rewriteGuideMode == null ? RewriteGuideMode.DETAIL_SCAFFOLD : rewriteGuideMode;
        modelAnswerDisplayMode = modelAnswerDisplayMode == null ? ModelAnswerDisplayMode.HIDE : modelAnswerDisplayMode;
        refinementDisplayMode = refinementDisplayMode == null ? RefinementDisplayMode.HIDE : refinementDisplayMode;
        keepWhatWorksMaxItems = Math.max(0, keepWhatWorksMaxItems);
        keepExpressionChipMaxItems = Math.max(0, keepExpressionChipMaxItems);
        refinementMaxCards = Math.max(0, refinementMaxCards);
    }
}
