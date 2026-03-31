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
        assertThat(policy.maxGrammarIssueCount()).isEqualTo(1);
        assertThat(policy.showRefinement()).isTrue();
        assertThat(policy.maxRefinementCount()).isEqualTo(3);
        assertThat(policy.refinementFocus()).isEqualTo(RefinementFocus.DETAIL_BUILDING);
        assertThat(policy.modelAnswerMode()).isEqualTo(ModelAnswerMode.ONE_STEP_UP);
        assertThat(policy.maxModelAnswerSentences()).isEqualTo(2);
    }

    @Test
    void select_applies_attempt_overlay_for_second_try() {
        SectionPolicy policy = selector.select(profileWithBand(AnswerBand.NATURAL_BUT_BASIC), 2);

        assertThat(policy.showGrammar()).isFalse();
        assertThat(policy.maxStrengthCount()).isEqualTo(1);
        assertThat(policy.maxModelAnswerSentences()).isEqualTo(1);
        assertThat(policy.attemptOverlayPolicy().progressAwareStrengths()).isTrue();
        assertThat(policy.attemptOverlayPolicy().suppressResolvedGrammar()).isTrue();
        assertThat(policy.attemptOverlayPolicy().emphasizeSingleRemainingIssue()).isTrue();
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
        return new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, answerBand),
                new GrammarProfile(GrammarSeverity.NONE, java.util.List.of(), null),
                new ContentProfile(ContentLevel.MEDIUM, new ContentSignals(true, true, false, false, true, false), java.util.List.of()),
                new RewriteProfile("IMPROVE_NATURALNESS", null, new RewriteTarget("IMPROVE_NATURALNESS", null, 1), null)
        );
    }
}
