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
        ModelAnswerDisplayMode modelAnswerDisplayMode = ModelAnswerDisplayMode.SHOW_EXPANDED;
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
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? ModelAnswerDisplayMode.SHOW_EXPANDED
                        : ModelAnswerDisplayMode.HIDE;
                showFinishCta = false;
            }
            case SHORT_BUT_VALID -> {
                fixFirstMode = resolveFixFirstMode(answerBand, taskCompletion, grammarSeverity, availability, primaryIssueCode);
                fixFirstDisplayMode = availability != null
                        && availability.hasPrimaryFix()
                        && fixFirstMode != FixFirstMode.HIDE
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                rewriteGuideMode = fixFirstMode == FixFirstMode.GRAMMAR_CARD
                        ? RewriteGuideMode.CORRECTED_SKELETON
                        : RewriteGuideMode.DETAIL_SCAFFOLD;
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
                        ? ModelAnswerDisplayMode.SHOW_EXPANDED
                        : ModelAnswerDisplayMode.HIDE;
                refinementDisplayMode = availability != null && availability.hasDisplayableRefinement()
                        ? RefinementDisplayMode.SHOW_COLLAPSED
                        : RefinementDisplayMode.HIDE;
                refinementMaxCards = 1;
                showFinishCta = false;
            }
            case CONTENT_THIN -> {
                fixFirstMode = resolveFixFirstMode(answerBand, taskCompletion, grammarSeverity, availability, primaryIssueCode);
                fixFirstDisplayMode = availability != null
                        && availability.hasPrimaryFix()
                        && fixFirstMode != FixFirstMode.HIDE
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                rewriteGuideMode = fixFirstMode == FixFirstMode.GRAMMAR_CARD
                        ? RewriteGuideMode.CORRECTED_SKELETON
                        : RewriteGuideMode.DETAIL_SCAFFOLD;
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? ModelAnswerDisplayMode.SHOW_EXPANDED
                        : ModelAnswerDisplayMode.HIDE;
                refinementDisplayMode = availability != null && availability.hasDisplayableRefinement()
                        ? RefinementDisplayMode.SHOW_COLLAPSED
                        : RefinementDisplayMode.HIDE;
                refinementMaxCards = 2;
            }
            case NATURAL_BUT_BASIC -> {
                boolean hasConcreteGrammarPolish = availability != null && availability.hasGrammarCard();
                fixFirstDisplayMode = availability != null
                        && (availability.hasHighValueCorrection() || hasConcreteGrammarPolish)
                        ? SectionDisplayMode.SHOW_EXPANDED
                        : SectionDisplayMode.HIDE;
                fixFirstMode = fixFirstDisplayMode == SectionDisplayMode.SHOW_EXPANDED
                        ? resolveFixFirstMode(answerBand, taskCompletion, grammarSeverity, availability, primaryIssueCode)
                        : FixFirstMode.HIDE;
                rewriteGuideMode = fixFirstMode == FixFirstMode.GRAMMAR_CARD
                        ? RewriteGuideMode.CORRECTED_SKELETON
                        : completionState == CompletionState.OPTIONAL_POLISH
                        ? RewriteGuideMode.OPTIONAL_POLISH
                        : RewriteGuideMode.DETAIL_SCAFFOLD;
                modelAnswerDisplayMode = availability != null && availability.hasModelAnswer()
                        ? ModelAnswerDisplayMode.SHOW_COLLAPSED
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
            boolean keepConcreteGrammarPolish = availability != null
                    && availability.hasGrammarCard()
                    && fixFirstMode == FixFirstMode.GRAMMAR_CARD;
            if (!keepConcreteGrammarPolish
                    && (fixFirstMode != FixFirstMode.GRAMMAR_CARD
                    || (availability != null && !availability.hasHighValueCorrection()))) {
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

    private FixFirstMode resolveFixFirstMode(
            AnswerBand answerBand,
            TaskCompletion taskCompletion,
            GrammarSeverity grammarSeverity,
            FeedbackSectionAvailability availability,
            String primaryIssueCode
    ) {
        if (answerBand == AnswerBand.OFF_TOPIC) {
            return FixFirstMode.TASK_RESET_CARD;
        }

        int grammarScore = scoreGrammarMode(answerBand, grammarSeverity, availability, primaryIssueCode);
        int detailScore = scoreDetailMode(answerBand, taskCompletion, primaryIssueCode);
        int taskResetScore = scoreTaskResetMode(answerBand, taskCompletion, primaryIssueCode);

        int bestScore = Math.max(grammarScore, Math.max(detailScore, taskResetScore));
        if (bestScore <= 0) {
            return FixFirstMode.HIDE;
        }
        if (grammarScore >= detailScore && grammarScore >= taskResetScore) {
            return FixFirstMode.GRAMMAR_CARD;
        }
        if (detailScore >= taskResetScore) {
            return FixFirstMode.DETAIL_PROMPT_CARD;
        }
        return FixFirstMode.TASK_RESET_CARD;
    }

    private int scoreGrammarMode(
            AnswerBand answerBand,
            GrammarSeverity grammarSeverity,
            FeedbackSectionAvailability availability,
            String primaryIssueCode
    ) {
        if (availability == null || !availability.hasGrammarCard()) {
            return 0;
        }

        int score = 0;
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING) {
            score += 10;
        }
        if ("FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)) {
            score += 9;
        } else if ("FIX_LOCAL_GRAMMAR".equals(primaryIssueCode)) {
            score += 7;
        }
        score += switch (grammarSeverity) {
            case MAJOR -> 9;
            case MODERATE -> 7;
            case MINOR -> 3;
            case NONE -> 1;
        };
        if (availability.hasHighValueCorrection()) {
            score += 1;
        }
        return score;
    }

    private int scoreDetailMode(
            AnswerBand answerBand,
            TaskCompletion taskCompletion,
            String primaryIssueCode
    ) {
        int score = 0;
        if ("ADD_REASON".equals(primaryIssueCode)
                || "ADD_EXAMPLE".equals(primaryIssueCode)
                || "ADD_DETAIL".equals(primaryIssueCode)
                || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode)) {
            score += 8;
        }
        if (taskCompletion == TaskCompletion.PARTIAL) {
            score += 2;
        }
        if (answerBand == AnswerBand.CONTENT_THIN) {
            score += 2;
        } else if (answerBand == AnswerBand.SHORT_BUT_VALID || answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            score += 1;
        }
        return score;
    }

    private int scoreTaskResetMode(
            AnswerBand answerBand,
            TaskCompletion taskCompletion,
            String primaryIssueCode
    ) {
        int score = 0;
        if ("OFF_TOPIC_RESPONSE".equals(primaryIssueCode)
                || "MISSING_MAIN_TASK".equals(primaryIssueCode)
                || "STATE_MAIN_ANSWER".equals(primaryIssueCode)
                || "MAKE_ON_TOPIC".equals(primaryIssueCode)) {
            score += 8;
        }
        if (taskCompletion == TaskCompletion.MISS) {
            score += 7;
        } else if (taskCompletion == TaskCompletion.PARTIAL) {
            score += 2;
        }
        if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            score += 1;
        }
        return score;
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
