package com.writeloop.service;

record SectionPolicy(
        boolean showStrengths,
        int maxStrengthCount,
        boolean showGrammar,
        int maxGrammarIssueCount,
        boolean showImprovement,
        boolean showRefinement,
        int maxRefinementCount,
        RefinementFocus refinementFocus,
        boolean showSummary,
        boolean showRewriteGuide,
        boolean showModelAnswer,
        int maxModelAnswerSentences,
        ModelAnswerMode modelAnswerMode,
        AttemptOverlayPolicy attemptOverlayPolicy
) {
    SectionPolicy(
            boolean showStrengths,
            int maxStrengthCount,
            boolean showGrammar,
            int maxGrammarIssueCount,
            boolean showImprovement,
            boolean showRefinement,
            int maxRefinementCount,
            RefinementFocus refinementFocus,
            boolean showSummary,
            boolean showRewriteGuide,
            int maxModelAnswerSentences,
            ModelAnswerMode modelAnswerMode,
            AttemptOverlayPolicy attemptOverlayPolicy
    ) {
        this(
                showStrengths,
                maxStrengthCount,
                showGrammar,
                maxGrammarIssueCount,
                showImprovement,
                showRefinement,
                maxRefinementCount,
                refinementFocus,
                showSummary,
                showRewriteGuide,
                true,
                maxModelAnswerSentences,
                modelAnswerMode,
                attemptOverlayPolicy
        );
    }

    SectionPolicy {
        maxStrengthCount = Math.max(0, maxStrengthCount);
        maxGrammarIssueCount = Math.max(0, Math.min(6, maxGrammarIssueCount));
        maxRefinementCount = Math.max(0, maxRefinementCount);
        maxModelAnswerSentences = Math.max(1, maxModelAnswerSentences);
        refinementFocus = refinementFocus == null ? RefinementFocus.DETAIL_BUILDING : refinementFocus;
        modelAnswerMode = modelAnswerMode == null ? ModelAnswerMode.ONE_STEP_UP : modelAnswerMode;
        attemptOverlayPolicy = attemptOverlayPolicy == null ? AttemptOverlayPolicy.NONE : attemptOverlayPolicy;
    }

    SectionPolicy withMaxStrengthCount(int maxStrengthCount) {
        return new SectionPolicy(
                showStrengths,
                maxStrengthCount,
                showGrammar,
                maxGrammarIssueCount,
                showImprovement,
                showRefinement,
                maxRefinementCount,
                refinementFocus,
                showSummary,
                showRewriteGuide,
                showModelAnswer,
                maxModelAnswerSentences,
                modelAnswerMode,
                attemptOverlayPolicy
        );
    }

    SectionPolicy withMaxGrammarIssueCount(int maxGrammarIssueCount) {
        return new SectionPolicy(
                showStrengths,
                maxStrengthCount,
                showGrammar,
                maxGrammarIssueCount,
                showImprovement,
                showRefinement,
                maxRefinementCount,
                refinementFocus,
                showSummary,
                showRewriteGuide,
                showModelAnswer,
                maxModelAnswerSentences,
                modelAnswerMode,
                attemptOverlayPolicy
        );
    }

    SectionPolicy withMaxModelAnswerSentences(int maxModelAnswerSentences) {
        return new SectionPolicy(
                showStrengths,
                maxStrengthCount,
                showGrammar,
                maxGrammarIssueCount,
                showImprovement,
                showRefinement,
                maxRefinementCount,
                refinementFocus,
                showSummary,
                showRewriteGuide,
                showModelAnswer,
                maxModelAnswerSentences,
                modelAnswerMode,
                attemptOverlayPolicy
        );
    }

    SectionPolicy withAttemptOverlayPolicy(AttemptOverlayPolicy attemptOverlayPolicy) {
        return new SectionPolicy(
                showStrengths,
                maxStrengthCount,
                showGrammar,
                maxGrammarIssueCount,
                showImprovement,
                showRefinement,
                maxRefinementCount,
                refinementFocus,
                showSummary,
                showRewriteGuide,
                showModelAnswer,
                maxModelAnswerSentences,
                modelAnswerMode,
                attemptOverlayPolicy
        );
    }

    SectionPolicy withShowModelAnswer(boolean showModelAnswer) {
        return new SectionPolicy(
                showStrengths,
                maxStrengthCount,
                showGrammar,
                maxGrammarIssueCount,
                showImprovement,
                showRefinement,
                maxRefinementCount,
                refinementFocus,
                showSummary,
                showRewriteGuide,
                showModelAnswer,
                maxModelAnswerSentences,
                modelAnswerMode,
                attemptOverlayPolicy
        );
    }
}
