package com.writeloop.service;

import java.util.List;

final class FeedbackScreenPolicySelector {
    private static final List<FeedbackScreenSectionId> DEFAULT_SECTION_ORDER = List.of(
            FeedbackScreenSectionId.QUESTION_ANSWER,
            FeedbackScreenSectionId.TOP_STATUS,
            FeedbackScreenSectionId.KEEP_WHAT_WORKS,
            FeedbackScreenSectionId.FIX_FIRST,
            FeedbackScreenSectionId.REWRITE_GUIDE,
            FeedbackScreenSectionId.MODEL_ANSWER,
            FeedbackScreenSectionId.REFINEMENT,
            FeedbackScreenSectionId.CTA
    );

    FeedbackScreenPolicy select(
            AnswerProfile answerProfile,
            CompletionState completionState,
            FeedbackSectionAvailability availability,
            int attemptIndex
    ) {
        AnswerBand answerBand = answerBand(answerProfile);
        TaskCompletion taskCompletion = taskCompletion(answerProfile);
        GrammarSeverity grammarSeverity = grammarSeverity(answerProfile);
        String primaryIssueCode = primaryIssueCode(answerProfile);

        SectionDisplayMode keepMode = availability != null && availability.hasKeepWhatWorks()
                ? SectionDisplayMode.SHOW_EXPANDED
                : SectionDisplayMode.HIDE;
        SectionDisplayMode fixFirstDisplayMode = SectionDisplayMode.HIDE;
        FixFirstMode fixFirstMode = FixFirstMode.HIDE;
        SectionDisplayMode rewriteGuideDisplayMode = SectionDisplayMode.SHOW_EXPANDED;
        RewriteGuideMode rewriteGuideMode = RewriteGuideMode.DETAIL_SCAFFOLD;
        ModelAnswerDisplayMode modelAnswerDisplayMode = ModelAnswerDisplayMode.HIDE;
        RefinementDisplayMode refinementDisplayMode = RefinementDisplayMode.HIDE;
        int keepMaxItems = 1;
        int keepExpressionChipMaxItems = 2;
        int refinementMaxCards = 1;
        boolean showFinishCta = completionState != CompletionState.NEEDS_REVISION;
        boolean showRewriteCta = true;
        boolean showCancelCta = true;

        switch (answerBand) {
            case TOO_SHORT_FRAGMENT -> {
                fixFirstDisplayMode = availability != null && availability.hasPrimaryFix()
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                fixFirstMode = availability != null && availability.hasGrammarCard()
                        ? FixFirstMode.GRAMMAR_CARD
                        : FixFirstMode.DETAIL_PROMPT_CARD;
                rewriteGuideMode = RewriteGuideMode.FRAGMENT_SCAFFOLD;
                refinementDisplayMode = availability != null && availability.hasDisplayableRefinement()
                        ? RefinementDisplayMode.SHOW_COLLAPSED
                        : RefinementDisplayMode.HIDE;
                refinementMaxCards = 1;
                modelAnswerDisplayMode = ModelAnswerDisplayMode.HIDE;
                showFinishCta = false;
            }
            case SHORT_BUT_VALID -> {
                fixFirstDisplayMode = shouldShowGrammarFix(answerBand, grammarSeverity, taskCompletion, availability, primaryIssueCode)
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                fixFirstMode = resolveFixFirstMode(answerBand, taskCompletion, grammarSeverity, availability, primaryIssueCode);
                rewriteGuideMode = RewriteGuideMode.DETAIL_SCAFFOLD;
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? ModelAnswerDisplayMode.SHOW_EXPANDED
                        : ModelAnswerDisplayMode.HIDE;
                refinementDisplayMode = availability != null && availability.hasDisplayableRefinement()
                        ? RefinementDisplayMode.SHOW_COLLAPSED
                        : RefinementDisplayMode.HIDE;
                refinementMaxCards = 2;
            }
            case GRAMMAR_BLOCKING -> {
                fixFirstDisplayMode = availability != null && availability.hasPrimaryFix()
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                fixFirstMode = FixFirstMode.GRAMMAR_CARD;
                rewriteGuideMode = RewriteGuideMode.CORRECTED_SKELETON;
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? ModelAnswerDisplayMode.SHOW_COLLAPSED
                        : ModelAnswerDisplayMode.HIDE;
                refinementDisplayMode = availability != null && availability.hasDisplayableRefinement()
                        ? RefinementDisplayMode.SHOW_COLLAPSED
                        : RefinementDisplayMode.HIDE;
                refinementMaxCards = 1;
                showFinishCta = false;
            }
            case CONTENT_THIN -> {
                fixFirstDisplayMode = shouldShowGrammarFix(answerBand, grammarSeverity, taskCompletion, availability, primaryIssueCode)
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                fixFirstMode = resolveFixFirstMode(answerBand, taskCompletion, grammarSeverity, availability, primaryIssueCode);
                rewriteGuideMode = RewriteGuideMode.DETAIL_SCAFFOLD;
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? ModelAnswerDisplayMode.SHOW_EXPANDED
                        : ModelAnswerDisplayMode.HIDE;
                refinementDisplayMode = availability != null && availability.hasDisplayableRefinement()
                        ? RefinementDisplayMode.SHOW_COLLAPSED
                        : RefinementDisplayMode.HIDE;
                refinementMaxCards = 2;
            }
            case NATURAL_BUT_BASIC -> {
                fixFirstDisplayMode = availability != null && availability.hasHighValueCorrection()
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                fixFirstMode = fixFirstDisplayMode == SectionDisplayMode.SHOW_EXPANDED
                        ? resolveFixFirstMode(answerBand, taskCompletion, grammarSeverity, availability, primaryIssueCode)
                        : FixFirstMode.HIDE;
                rewriteGuideMode = completionState == CompletionState.OPTIONAL_POLISH
                        ? RewriteGuideMode.OPTIONAL_POLISH
                        : RewriteGuideMode.DETAIL_SCAFFOLD;
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? (completionState == CompletionState.OPTIONAL_POLISH
                                ? ModelAnswerDisplayMode.HIDE
                                : ModelAnswerDisplayMode.SHOW_COLLAPSED)
                        : ModelAnswerDisplayMode.HIDE;
                refinementDisplayMode = availability != null && availability.hasDisplayableRefinement()
                        ? RefinementDisplayMode.SHOW_COLLAPSED
                        : RefinementDisplayMode.HIDE;
                refinementMaxCards = 1;
            }
            case OFF_TOPIC -> {
                keepMode = availability != null && availability.hasKeepWhatWorks()
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                fixFirstDisplayMode = SectionDisplayMode.SHOW_EXPANDED;
                fixFirstMode = FixFirstMode.TASK_RESET_CARD;
                rewriteGuideMode = RewriteGuideMode.TASK_RESET;
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? ModelAnswerDisplayMode.TASK_RESET_EXAMPLE
                        : ModelAnswerDisplayMode.HIDE;
                refinementDisplayMode = RefinementDisplayMode.HIDE;
                refinementMaxCards = 0;
                showFinishCta = false;
            }
        }

        if (completionState == CompletionState.OPTIONAL_POLISH) {
            rewriteGuideMode = RewriteGuideMode.OPTIONAL_POLISH;
            if (fixFirstMode != FixFirstMode.GRAMMAR_CARD || (availability != null && !availability.hasHighValueCorrection())) {
                fixFirstDisplayMode = SectionDisplayMode.HIDE;
                fixFirstMode = FixFirstMode.HIDE;
            }
            if (modelAnswerDisplayMode == ModelAnswerDisplayMode.SHOW_EXPANDED) {
                modelAnswerDisplayMode = ModelAnswerDisplayMode.SHOW_COLLAPSED;
            }
            if (refinementDisplayMode == RefinementDisplayMode.SHOW_EXPANDED) {
                refinementDisplayMode = RefinementDisplayMode.SHOW_COLLAPSED;
            }
        }

        if (availability != null) {
            if (!availability.hasPrimaryFix()) {
                fixFirstDisplayMode = SectionDisplayMode.HIDE;
                fixFirstMode = FixFirstMode.HIDE;
            }
            if (!availability.hasModelAnswer()) {
                modelAnswerDisplayMode = ModelAnswerDisplayMode.HIDE;
            }
            if (!availability.hasDisplayableRefinement()) {
                refinementDisplayMode = RefinementDisplayMode.HIDE;
                refinementMaxCards = 0;
            }
            if (!availability.hasKeepWhatWorks()) {
                keepMode = SectionDisplayMode.HIDE;
            }
        }

        if (attemptIndex >= 2) {
            keepMaxItems = Math.min(keepMaxItems, 1);
            keepExpressionChipMaxItems = Math.min(keepExpressionChipMaxItems, 2);
            if (refinementMaxCards > 0) {
                refinementMaxCards = Math.min(refinementMaxCards, 1);
            }
        }

        return new FeedbackScreenPolicy(
                completionState,
                DEFAULT_SECTION_ORDER,
                keepMode,
                fixFirstDisplayMode,
                fixFirstMode,
                rewriteGuideDisplayMode,
                rewriteGuideMode,
                modelAnswerDisplayMode,
                refinementDisplayMode,
                keepMaxItems,
                keepExpressionChipMaxItems,
                refinementMaxCards,
                showFinishCta,
                showRewriteCta,
                showCancelCta
        );
    }

    private boolean shouldShowGrammarFix(
            AnswerBand answerBand,
            GrammarSeverity grammarSeverity,
            TaskCompletion taskCompletion,
            FeedbackSectionAvailability availability,
            String primaryIssueCode
    ) {
        if (availability == null || !availability.hasPrimaryFix()) {
            return false;
        }
        if (answerBand == AnswerBand.OFF_TOPIC || taskCompletion != TaskCompletion.FULL) {
            return true;
        }
        return grammarSeverity.ordinal() >= GrammarSeverity.MINOR.ordinal()
                || "FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)
                || "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode)
                || availability.hasHighValueCorrection();
    }

    private FixFirstMode resolveFixFirstMode(
            AnswerBand answerBand,
            TaskCompletion taskCompletion,
            GrammarSeverity grammarSeverity,
            FeedbackSectionAvailability availability,
            String primaryIssueCode
    ) {
        if (answerBand == AnswerBand.OFF_TOPIC || taskCompletion != TaskCompletion.FULL) {
            return FixFirstMode.TASK_RESET_CARD;
        }
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING
                || grammarSeverity.ordinal() >= GrammarSeverity.MINOR.ordinal()
                || "FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)
                || "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode)
                || (availability != null && availability.hasGrammarCard())) {
            return FixFirstMode.GRAMMAR_CARD;
        }
        if ("ADD_REASON".equals(primaryIssueCode)
                || "ADD_EXAMPLE".equals(primaryIssueCode)
                || "ADD_DETAIL".equals(primaryIssueCode)
                || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode)) {
            return FixFirstMode.DETAIL_PROMPT_CARD;
        }
        return FixFirstMode.HIDE;
    }

    private AnswerBand answerBand(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.task() == null || answerProfile.task().answerBand() == null) {
            return AnswerBand.SHORT_BUT_VALID;
        }
        return answerProfile.task().answerBand();
    }

    private TaskCompletion taskCompletion(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.task() == null || answerProfile.task().taskCompletion() == null) {
            return TaskCompletion.PARTIAL;
        }
        return answerProfile.task().taskCompletion();
    }

    private GrammarSeverity grammarSeverity(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.grammar() == null || answerProfile.grammar().severity() == null) {
            return GrammarSeverity.NONE;
        }
        return answerProfile.grammar().severity();
    }

    private String primaryIssueCode(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.rewrite() == null) {
            return "";
        }
        return answerProfile.rewrite().primaryIssueCode();
    }
}
