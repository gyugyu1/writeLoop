package com.writeloop.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SectionPolicySelectorTest {

    private final SectionPolicySelector selector = new SectionPolicySelector();

    @Test
    void select_maps_content_thin_to_detail_building_policy() {
        SectionPolicy policy = selector.select(profileWithBand(AnswerBand.CONTENT_THIN), 1);

        assertThat(policy.showStrengths()).isTrue();
        assertThat(policy.maxStrengthCount()).isEqualTo(2);
        assertThat(policy.showGrammar()).isTrue();
        assertThat(policy.maxGrammarIssueCount()).isEqualTo(5);
        assertThat(policy.showRefinement()).isTrue();
        assertThat(policy.maxRefinementCount()).isEqualTo(12);
        assertThat(policy.refinementFocus()).isEqualTo(RefinementFocus.DETAIL_BUILDING);
        assertThat(policy.modelAnswerMode()).isEqualTo(ModelAnswerMode.ONE_STEP_UP);
        assertThat(policy.maxModelAnswerSentences()).isEqualTo(2);
    }

    @Test
    void select_keeps_model_answer_for_finishable_short_but_valid() {
        SectionPolicy policy = selector.select(profileWithBandAndFinishable(AnswerBand.SHORT_BUT_VALID, true), 1);

        assertThat(policy.showModelAnswer()).isTrue();
        assertThat(policy.modelAnswerMode()).isEqualTo(ModelAnswerMode.ONE_STEP_UP);
    }

    @Test
    void select_keeps_model_answer_for_finishable_content_thin() {
        SectionPolicy policy = selector.select(profileWithBandAndFinishable(AnswerBand.CONTENT_THIN, true), 1);

        assertThat(policy.showModelAnswer()).isTrue();
        assertThat(policy.modelAnswerMode()).isEqualTo(ModelAnswerMode.ONE_STEP_UP);
    }

    @Test
    void select_uses_optional_model_answer_for_natural_but_basic() {
        SectionPolicy policy = selector.select(profileWithBandAndFinishable(AnswerBand.NATURAL_BUT_BASIC, true), 1);

        assertThat(policy.showModelAnswer()).isTrue();
        assertThat(policy.modelAnswerMode()).isEqualTo(ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD);
    }

    @Test
    void select_keeps_model_answer_for_too_short_fragment() {
        SectionPolicy policy = selector.select(profileWithBand(AnswerBand.TOO_SHORT_FRAGMENT), 1);

        assertThat(policy.showRewriteGuide()).isTrue();
        assertThat(policy.showModelAnswer()).isTrue();
    }

    @Test
    void select_applies_attempt_overlay_for_second_try() {
        SectionPolicy policy = selector.select(profileWithBand(AnswerBand.NATURAL_BUT_BASIC), 2);

        assertThat(policy.showGrammar()).isFalse();
        assertThat(policy.maxStrengthCount()).isEqualTo(1);
        assertThat(policy.maxModelAnswerSentences()).isEqualTo(1);
        assertThat(policy.modelAnswerMode()).isEqualTo(ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD);
        assertThat(policy.attemptOverlayPolicy().progressAwareStrengths()).isTrue();
        assertThat(policy.attemptOverlayPolicy().suppressResolvedGrammar()).isTrue();
        assertThat(policy.attemptOverlayPolicy().emphasizeSingleRemainingIssue()).isTrue();
    }

    @Test
    void select_does_not_reduce_grammar_issue_limit_for_second_try_content_thin() {
        SectionPolicy policy = selector.select(profileWithBand(AnswerBand.CONTENT_THIN), 2);

        assertThat(policy.showGrammar()).isTrue();
        assertThat(policy.maxGrammarIssueCount()).isEqualTo(5);
    }

    @Test
    void select_keeps_finishable_short_but_valid_grammar_limit() {
        SectionPolicy policy = selector.select(profileWithBandAndFinishable(AnswerBand.SHORT_BUT_VALID, true), 1);

        assertThat(policy.showGrammar()).isTrue();
        assertThat(policy.maxGrammarIssueCount()).isEqualTo(5);
    }

    @Test
    void select_maps_off_topic_to_task_reset_policy() {
        SectionPolicy policy = selector.select(profileWithBand(AnswerBand.OFF_TOPIC), 1);

        assertThat(policy.showRewriteGuide()).isTrue();
        assertThat(policy.refinementFocus()).isEqualTo(RefinementFocus.TASK_COMPLETION);
        assertThat(policy.modelAnswerMode()).isEqualTo(ModelAnswerMode.TASK_RESET);
        assertThat(policy.maxModelAnswerSentences()).isEqualTo(1);
    }

    private AnswerProfile profileWithBand(AnswerBand answerBand) {
        return profileWithBandAndFinishable(answerBand, false);
    }

    private AnswerProfile profileWithBandAndFinishable(AnswerBand answerBand, boolean finishable) {
        return new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, answerBand, finishable),
                new GrammarProfile(GrammarSeverity.NONE, java.util.List.of(), null),
                new ContentProfile(ContentLevel.MEDIUM, new ContentSignals(true, true, false, false, true, false), java.util.List.of()),
                new RewriteProfile("IMPROVE_NATURALNESS", null, new RewriteTarget("IMPROVE_NATURALNESS", null, 1), null)
        );
    }
}
