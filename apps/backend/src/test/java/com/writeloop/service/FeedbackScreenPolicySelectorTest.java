package com.writeloop.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackScreenPolicySelectorTest {

    private final FeedbackScreenPolicySelector selector = new FeedbackScreenPolicySelector();

    @Test
    void select_prefers_detail_prompt_for_partial_reason_gap() {
        FeedbackScreenPolicy policy = selector.select(
                profile(
                        TaskCompletion.PARTIAL,
                        AnswerBand.CONTENT_THIN,
                        GrammarSeverity.NONE,
                        "ADD_REASON"
                ),
                CompletionState.NEEDS_REVISION,
                availability(true, false, false),
                1
        );

        assertThat(policy.fixFirstMode()).isEqualTo(FixFirstMode.DETAIL_PROMPT_CARD);
        assertThat(policy.fixFirstDisplayMode()).isEqualTo(SectionDisplayMode.SHOW_EXPANDED);
        assertThat(policy.rewriteGuideMode()).isEqualTo(RewriteGuideMode.DETAIL_SCAFFOLD);
    }

    @Test
    void select_prefers_grammar_card_when_grammar_signal_is_stronger() {
        FeedbackScreenPolicy policy = selector.select(
                profile(
                        TaskCompletion.PARTIAL,
                        AnswerBand.CONTENT_THIN,
                        GrammarSeverity.MODERATE,
                        "FIX_LOCAL_GRAMMAR"
                ),
                CompletionState.NEEDS_REVISION,
                availability(true, true, true),
                1
        );

        assertThat(policy.fixFirstMode()).isEqualTo(FixFirstMode.GRAMMAR_CARD);
        assertThat(policy.fixFirstDisplayMode()).isEqualTo(SectionDisplayMode.SHOW_EXPANDED);
        assertThat(policy.rewriteGuideMode()).isEqualTo(RewriteGuideMode.CORRECTED_SKELETON);
    }

    @Test
    void select_keeps_task_reset_for_off_topic_answers() {
        FeedbackScreenPolicy policy = selector.select(
                profile(
                        TaskCompletion.MISS,
                        AnswerBand.OFF_TOPIC,
                        GrammarSeverity.NONE,
                        "OFF_TOPIC_RESPONSE"
                ),
                CompletionState.NEEDS_REVISION,
                availability(true, false, false),
                1
        );

        assertThat(policy.fixFirstMode()).isEqualTo(FixFirstMode.TASK_RESET_CARD);
        assertThat(policy.fixFirstDisplayMode()).isEqualTo(SectionDisplayMode.SHOW_EXPANDED);
        assertThat(policy.rewriteGuideMode()).isEqualTo(RewriteGuideMode.TASK_RESET);
    }

    @Test
    void select_keeps_model_answer_visible_for_optional_polish_when_available() {
        FeedbackScreenPolicy policy = selector.select(
                profile(
                        TaskCompletion.FULL,
                        AnswerBand.NATURAL_BUT_BASIC,
                        GrammarSeverity.NONE,
                        "IMPROVE_NATURALNESS"
                ),
                CompletionState.OPTIONAL_POLISH,
                new FeedbackSectionAvailability(
                        true,
                        false,
                        false,
                        true,
                        true,
                        true,
                        false
                ),
                1
        );

        assertThat(policy.modelAnswerDisplayMode()).isEqualTo(ModelAnswerDisplayMode.SHOW_COLLAPSED);
    }

    @Test
    void select_keeps_concrete_minor_grammar_fix_visible_during_optional_polish() {
        FeedbackScreenPolicy policy = selector.select(
                profile(
                        TaskCompletion.FULL,
                        AnswerBand.NATURAL_BUT_BASIC,
                        GrammarSeverity.MINOR,
                        "FIX_LOCAL_GRAMMAR"
                ),
                CompletionState.OPTIONAL_POLISH,
                new FeedbackSectionAvailability(
                        true,
                        true,
                        true,
                        true,
                        true,
                        true,
                        false
                ),
                1
        );

        assertThat(policy.fixFirstMode()).isEqualTo(FixFirstMode.GRAMMAR_CARD);
        assertThat(policy.fixFirstDisplayMode()).isEqualTo(SectionDisplayMode.SHOW_EXPANDED);
        assertThat(policy.rewriteGuideMode()).isEqualTo(RewriteGuideMode.OPTIONAL_POLISH);
    }

    private AnswerProfile profile(
            TaskCompletion taskCompletion,
            AnswerBand answerBand,
            GrammarSeverity grammarSeverity,
            String primaryIssueCode
    ) {
        return new AnswerProfile(
                new TaskProfile(true, taskCompletion, answerBand, false),
                new GrammarProfile(grammarSeverity, java.util.List.of(), null, false),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, true, false, false, true, false),
                        java.util.List.of()
                ),
                new RewriteProfile(
                        primaryIssueCode,
                        null,
                        new RewriteTarget(primaryIssueCode, null, 1),
                        null
                )
        );
    }

    private FeedbackSectionAvailability availability(
            boolean hasPrimaryFix,
            boolean hasGrammarCard,
            boolean hasHighValueCorrection
    ) {
        return new FeedbackSectionAvailability(
                true,
                hasPrimaryFix,
                hasGrammarCard,
                true,
                false,
                true,
                hasHighValueCorrection
        );
    }
}
