package com.writeloop.service;

final class FeedbackRetryPolicy {

    boolean shouldRetry(
            ValidationFailure failure,
            FeedbackDiagnosisResult diagnosis,
            SectionPolicy sectionPolicy
    ) {
        if (failure == null) {
            return false;
        }

        return switch (failure.failureCode()) {
            case EMPTY_STRENGTHS -> false;
            case EMPTY_PRIMARY_FIX, UNALIGNED_PRIMARY_FIX ->
                    failure.sectionKey() == SectionKey.PRIMARY_FIX;
            case EMPTY_GRAMMAR, INVALID_GRAMMAR ->
                    failure.sectionKey() == SectionKey.GRAMMAR
                            && sectionPolicy.showGrammar()
                            && (diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                            || diagnosis.answerBand() == AnswerBand.TOO_SHORT_FRAGMENT
                            || diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MODERATE.ordinal());
            case EMPTY_IMPROVEMENT ->
                    failure.sectionKey() == SectionKey.IMPROVEMENT
                            && sectionPolicy.showImprovement()
                            && !diagnosis.finishable();
            case EMPTY_SECTION, PLACEHOLDER, GENERIC_TEXT, BROKEN_SPAN_REUSE, LOW_VALUE_REFINEMENT -> false;
            case UNALIGNED_REWRITE_TARGET, REWRITE_DUPLICATE_MODEL_ANSWER ->
                    failure.sectionKey() == SectionKey.REWRITE_GUIDE
                            && sectionPolicy.showRewriteGuide();
            case MODEL_DUPLICATE_ANCHOR, LOW_VALUE_MODEL_ANSWER, MODEL_REGRESSION, MEANING_DRIFT ->
                    failure.sectionKey() == SectionKey.MODEL_ANSWER
                            && sectionPolicy.showModelAnswer()
                            && sectionPolicy.modelAnswerMode() != ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD;
            case NEAR_DUPLICATE ->
                    switch (failure.sectionKey()) {
                        case STRENGTHS -> sectionPolicy.showStrengths() && !diagnosis.finishable();
                        case REFINEMENT -> sectionPolicy.showRefinement();
                        case REWRITE_GUIDE -> sectionPolicy.showRewriteGuide();
                        case MODEL_ANSWER -> sectionPolicy.showModelAnswer()
                                && sectionPolicy.modelAnswerMode() != ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD;
                        default -> false;
                    };
            case SUMMARY_DUPLICATES_IMPROVEMENT -> false;
            case LOW_VALUE_SECTION -> false;
        };
    }
}
