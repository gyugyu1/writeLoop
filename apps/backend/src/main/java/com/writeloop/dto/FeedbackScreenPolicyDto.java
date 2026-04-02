package com.writeloop.dto;

import java.util.List;

public record FeedbackScreenPolicyDto(
        String completionState,
        List<String> sectionOrder,
        String keepWhatWorksDisplayMode,
        String fixFirstDisplayMode,
        String rewriteGuideDisplayMode,
        String rewriteGuideMode,
        String modelAnswerDisplayMode,
        String refinementDisplayMode,
        int keepWhatWorksMaxItems,
        int keepExpressionChipMaxItems,
        int refinementMaxCards,
        boolean showFinishCta,
        boolean showRewriteCta,
        boolean showCancelCta
) {
    public FeedbackScreenPolicyDto {
        completionState = normalize(completionState, "NEEDS_REVISION");
        sectionOrder = sectionOrder == null ? List.of() : List.copyOf(sectionOrder);
        keepWhatWorksDisplayMode = normalize(keepWhatWorksDisplayMode, "HIDE");
        fixFirstDisplayMode = normalize(fixFirstDisplayMode, "HIDE");
        rewriteGuideDisplayMode = normalize(rewriteGuideDisplayMode, "SHOW_EXPANDED");
        rewriteGuideMode = normalize(rewriteGuideMode, "DETAIL_SCAFFOLD");
        modelAnswerDisplayMode = normalize(modelAnswerDisplayMode, "HIDE");
        refinementDisplayMode = normalize(refinementDisplayMode, "HIDE");
        keepWhatWorksMaxItems = Math.max(0, keepWhatWorksMaxItems);
        keepExpressionChipMaxItems = Math.max(0, keepExpressionChipMaxItems);
        refinementMaxCards = Math.max(0, refinementMaxCards);
    }

    private static String normalize(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
