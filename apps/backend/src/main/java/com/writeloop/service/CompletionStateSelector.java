package com.writeloop.service;

final class CompletionStateSelector {

    CompletionState select(AnswerProfile answerProfile, FeedbackSectionAvailability availability) {
        AnswerBand answerBand = answerBand(answerProfile);
        if (answerBand == AnswerBand.OFF_TOPIC
                || answerBand == AnswerBand.TOO_SHORT_FRAGMENT
                || answerBand == AnswerBand.GRAMMAR_BLOCKING) {
            return CompletionState.NEEDS_REVISION;
        }

        if (taskCompletion(answerProfile) != TaskCompletion.FULL) {
            return CompletionState.NEEDS_REVISION;
        }

        if (!finishable(answerProfile)) {
            return CompletionState.NEEDS_REVISION;
        }

        if (answerBand == AnswerBand.NATURAL_BUT_BASIC
                && grammarSeverity(answerProfile).ordinal() <= GrammarSeverity.MINOR.ordinal()
                && (availability == null || !availability.hasHighValueCorrection())) {
            return CompletionState.OPTIONAL_POLISH;
        }

        return CompletionState.CAN_FINISH;
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

    private boolean finishable(AnswerProfile answerProfile) {
        return answerProfile != null
                && answerProfile.task() != null
                && answerProfile.task().finishable();
    }

    private GrammarSeverity grammarSeverity(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.grammar() == null || answerProfile.grammar().severity() == null) {
            return GrammarSeverity.NONE;
        }
        return answerProfile.grammar().severity();
    }
}
