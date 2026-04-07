package com.writeloop.service;

final class SectionPolicySelector {

    SectionPolicy select(AnswerProfile answerProfile, int attemptIndex) {
        AnswerBand answerBand = resolveAnswerBand(answerProfile);
        SectionPolicy policy = basePolicy(answerBand);
        if (resolveFinishable(answerProfile)) {
            policy = applyFinishableOverlay(policy, answerBand);
        }
        if (attemptIndex >= 2) {
            policy = applyAttemptOverlay(policy, answerBand);
        }
        return policy;
    }

    private AnswerBand resolveAnswerBand(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.task() == null || answerProfile.task().answerBand() == null) {
            return AnswerBand.SHORT_BUT_VALID;
        }
        return answerProfile.task().answerBand();
    }

    private boolean resolveFinishable(AnswerProfile answerProfile) {
        return answerProfile != null
                && answerProfile.task() != null
                && answerProfile.task().finishable();
    }

    private SectionPolicy basePolicy(AnswerBand answerBand) {
        return switch (answerBand) {
            case TOO_SHORT_FRAGMENT -> new SectionPolicy(
                    true, 1,
                    true, 2,
                    true,
                    true, 12, RefinementFocus.EASY_REUSABLE,
                    true,
                    true,
                    true,
                    2, ModelAnswerMode.ONE_STEP_UP,
                    AttemptOverlayPolicy.NONE
            );
            case SHORT_BUT_VALID -> new SectionPolicy(
                    true, 2,
                    true, 5,
                    true,
                    true, 12, RefinementFocus.DETAIL_BUILDING,
                    true,
                    true,
                    2, ModelAnswerMode.ONE_STEP_UP,
                    AttemptOverlayPolicy.NONE
            );
            case GRAMMAR_BLOCKING -> new SectionPolicy(
                    true, 1,
                    true, 5,
                    true,
                    true, 12, RefinementFocus.GRAMMAR_PATTERN,
                    true,
                    true,
                    2, ModelAnswerMode.MINIMAL_CORRECTION,
                    AttemptOverlayPolicy.NONE
            );
            case CONTENT_THIN -> new SectionPolicy(
                    true, 2,
                    true, 5,
                    true,
                    true, 12, RefinementFocus.DETAIL_BUILDING,
                    true,
                    true,
                    2, ModelAnswerMode.ONE_STEP_UP,
                    AttemptOverlayPolicy.NONE
            );
            case NATURAL_BUT_BASIC -> new SectionPolicy(
                    true, 2,
                    false, 0,
                    true,
                    true, 12, RefinementFocus.NATURALNESS,
                    true,
                    true,
                    true,
                    2, ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD,
                    AttemptOverlayPolicy.NONE
            );
            case OFF_TOPIC -> new SectionPolicy(
                    true, 1,
                    true, 2,
                    true,
                    true, 12, RefinementFocus.TASK_COMPLETION,
                    true,
                    true,
                    1, ModelAnswerMode.TASK_RESET,
                    AttemptOverlayPolicy.NONE
            );
        };
    }

    private SectionPolicy applyAttemptOverlay(SectionPolicy basePolicy, AnswerBand answerBand) {
        int overlayStrengthLimit = Math.min(basePolicy.maxStrengthCount(), 1);
        int overlayModelSentences = switch (answerBand) {
            case NATURAL_BUT_BASIC, OFF_TOPIC -> Math.max(1,
                    basePolicy.maxModelAnswerSentences() - AttemptOverlayPolicy.PROGRESS_AWARE.modelAnswerSentenceDelta());
            default -> basePolicy.maxModelAnswerSentences();
        };

        return basePolicy
                .withMaxStrengthCount(overlayStrengthLimit)
                .withMaxModelAnswerSentences(overlayModelSentences)
                .withAttemptOverlayPolicy(AttemptOverlayPolicy.PROGRESS_AWARE);
    }

    private SectionPolicy applyFinishableOverlay(SectionPolicy basePolicy, AnswerBand answerBand) {
        SectionPolicy policy = basePolicy;
        return switch (answerBand) {
            case SHORT_BUT_VALID, CONTENT_THIN -> policy;
            case NATURAL_BUT_BASIC -> policy;
            case TOO_SHORT_FRAGMENT -> policy;
            default -> policy;
        };
    }
}
