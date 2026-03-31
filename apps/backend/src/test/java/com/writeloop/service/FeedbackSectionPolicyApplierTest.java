package com.writeloop.service;

import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.RefinementExpressionDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackSectionPolicyApplierTest {

    private final FeedbackSectionPolicyApplier applier = new FeedbackSectionPolicyApplier();

    @Test
    void apply_enforces_grammar_blocking_policy_caps_and_one_step_up_model_answer() {
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-a-2",
                "session-1",
                1,
                72,
                false,
                null,
                "Your answer is understandable, but fixing the main grammar issue first will help.",
                List.of("generic 1", "generic 2", "generic 3"),
                List.of(
                        new CorrectionDto("Fix the grammar first.", "Match the subject and verb first."),
                        new CorrectionDto("Add one reason.", "Add a short because-clause.")
                ),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("season are", "season is", "Match the subject and verb."),
                        new GrammarFeedbackItemDto("it warm", "it is warm", "Complete the sentence."),
                        new GrammarFeedbackItemDto("i like", "I like", "Capitalize I.")
                ),
                "My favorite season are spring because it warm.",
                List.of(
                        new RefinementExpressionDto("struggle to meet deadlines", "Use this to describe a recurring difficulty.", "I sometimes struggle to meet deadlines at work."),
                        new RefinementExpressionDto("by writing a to-do list", "Use this to explain how you solve the problem.", "I stay organized by writing a to-do list."),
                        new RefinementExpressionDto("stay on track", "Use this when you describe keeping your plan.", "A planner helps me stay on track.")
                ),
                "My favorite season is spring because it is warm. I enjoy the breeze in spring. It helps me relax after school.",
                null,
                "Fix the main grammar issue and write it again.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING),
                new GrammarProfile(
                        GrammarSeverity.MAJOR,
                        List.of(new GrammarIssue("SUBJECT_VERB_AGREEMENT", "season are", "season is", true, GrammarSeverity.MAJOR)),
                        "My favorite season is spring because it is warm."
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, true, false, true, false, false),
                        List.of(
                                new StrengthSignal("CLEAR_MAIN_ANSWER", "My favorite season ... spring"),
                                new StrengthSignal("HAS_REASON", "because it is warm")
                        )
                ),
                new RewriteProfile("FIX_BLOCKING_GRAMMAR", null, new RewriteTarget("FIX_BLOCKING_GRAMMAR", "My favorite season is spring because ...", 1), null)
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-a-2", "What is your favorite season and why?"),
                "My favorite season are spring because it warm.",
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.strengths()).hasSize(1);
        assertThat(applied.grammarFeedback()).hasSize(1);
        assertThat(applied.corrections()).hasSize(1);
        assertThat(applied.refinementExpressions()).hasSize(2);
        assertThat(applied.modelAnswer()).startsWith("My favorite season is spring because it is warm.");
        assertThat(applied.modelAnswer()).contains("I enjoy the breeze in spring.");
        assertThat(applied.modelAnswer()).isNotEqualTo("My favorite season is spring because it is warm.");
        assertThat(applied.modelAnswerKo()).isNull();
        assertThat(applied.summary()).isNotBlank();
    }

    @Test
    void apply_drops_shorter_overlapping_refinement_when_longer_frame_exists() {
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-b-1",
                "session-2",
                1,
                80,
                false,
                null,
                "Add one concrete strategy.",
                List.of("strength"),
                List.of(new CorrectionDto("Add one more detail.", "Add one sentence about your strategy.")),
                List.of(),
                List.of(),
                "One challenge I face is procrastination.",
                List.of(
                        new RefinementExpressionDto("To address this", "Use this as a transition.", "To address this, I write a to-do list every morning."),
                        new RefinementExpressionDto("To address this, I make a daily plan.", "Use this to explain your solution.", "To address this, I make a daily plan before class."),
                        new RefinementExpressionDto("This helps me stay on track.", "Use this to explain the result.", "This helps me stay on track during the week.")
                ),
                "One challenge I face is procrastination. To address this, I write a to-do list every morning.",
                null,
                "rewrite",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), "One challenge I face is procrastination."),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, false, false),
                        List.of(new StrengthSignal("CLEAR_MAIN_ANSWER", "One challenge I face is procrastination"))
                ),
                new RewriteProfile("ADD_DETAIL", null, new RewriteTarget("ADD_DETAIL", "To address this, I ...", 1), null)
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-b-1", "What is one challenge you often face at work or school, and how do you deal with it?"),
                "One challenge I face is procrastination.",
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains("To address this, I make a daily plan.", "This helps me stay on track.")
                .doesNotContain("To address this");
    }

    @Test
    void apply_uses_semantic_strengths_and_filters_raw_used_expressions_for_grammar_blocking() {
        String learnerAnswer = "I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.";
        String minimalCorrection = "I often struggle to meet deadlines, so I write a to-do list to stay on track.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-b-1",
                "session-3",
                1,
                61,
                false,
                null,
                "Fix the main grammar issue first.",
                List.of("\"" + learnerAnswer + "\" shows your idea clearly."),
                List.of(new CorrectionDto("Fix the grammar first.", "Rewrite the sentence with correct grammar.")),
                List.of(),
                List.of(),
                minimalCorrection,
                List.of(),
                minimalCorrection,
                null,
                "raw rewrite",
                List.of(
                        new CoachExpressionUsageDto("to-do list", true, "SELF_DISCOVERED", null, "SELF_DISCOVERED", "Useful for planning."),
                        new CoachExpressionUsageDto("stay on track", true, "SELF_DISCOVERED", null, "SELF_DISCOVERED", "Useful for focus."),
                        new CoachExpressionUsageDto("I often struggle with meet the deadline", true, "SELF_DISCOVERED", null, "SELF_DISCOVERED", "Too raw.")
                )
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING),
                new GrammarProfile(
                        GrammarSeverity.MAJOR,
                        List.of(new GrammarIssue("SUBJECT_VERB_AGREEMENT", "meet the deadline", "to meet deadlines", true, GrammarSeverity.MAJOR)),
                        minimalCorrection
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of(new StrengthSignal("CLEAR_MAIN_ANSWER", learnerAnswer))
                ),
                new RewriteProfile("FIX_BLOCKING_GRAMMAR", null, new RewriteTarget("FIX_BLOCKING_GRAMMAR", minimalCorrection, 0), null)
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-b-1", "What is one challenge you often face at work or school, and how do you deal with it?"),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.strengths()).hasSize(1);
        assertThat(applied.strengths().get(0)).doesNotContain(learnerAnswer);
        assertThat(applied.grammarFeedback()).isNotEmpty();
        assertThat(applied.grammarFeedback().get(0).originalText()).isEqualTo(learnerAnswer);
        assertThat(applied.grammarFeedback().get(0).revisedText()).isEqualTo(minimalCorrection);
        assertThat(applied.grammarFeedback().get(0).reasonKo()).isNotBlank();
        assertThat(applied.usedExpressions()).hasSize(1);
        assertThat(applied.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .doesNotContain("I often struggle with meet the deadline");
    }

    @Test
    void apply_for_grammar_blocking_prioritizes_repair_chunks_and_separates_rewrite_guide_from_model_answer() {
        String learnerAnswer = "I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.";
        String minimalCorrection = "I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-b-1",
                "session-4",
                1,
                68,
                false,
                null,
                "summary",
                List.of(learnerAnswer),
                List.of(new CorrectionDto("Add one more detail.", "Explain how the to-do list helps you.")),
                List.of(),
                List.of(),
                minimalCorrection,
                List.of(
                        new RefinementExpressionDto("To stay on top of my tasks, I [verb]", "Use this to talk about task management.", "To stay on top of my tasks, I review my notes."),
                        new RefinementExpressionDto("To address this", "Use this as a transition.", "To address this, I write a to-do list."),
                        new RefinementExpressionDto("struggle to meet deadlines", "Use this to describe a repeated difficulty.", "I often struggle to meet deadlines."),
                        new RefinementExpressionDto("by writing a to-do list", "Use this to explain your method.", "I stay organized by writing a to-do list.")
                ),
                minimalCorrection,
                null,
                "\"" + minimalCorrection + "\" Add one detail about how this method helps you.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING),
                new GrammarProfile(
                        GrammarSeverity.MAJOR,
                        List.of(new GrammarIssue("PREPOSITION", "by write", "by writing", true, GrammarSeverity.MAJOR)),
                        minimalCorrection
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_BLOCKING_GRAMMAR",
                        "ADD_DETAIL",
                        new RewriteTarget("FIX_BLOCKING_GRAMMAR", minimalCorrection, 0),
                        null
                )
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-b-1", "What is one challenge you often face at work or school, and how do you deal with it?"),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .containsExactly("struggle to meet deadlines", "by writing a to-do list");
        assertThat(applied.rewriteChallenge()).doesNotContain(learnerAnswer);
        assertThat(applied.rewriteChallenge()).contains(minimalCorrection);
        assertThat(applied.modelAnswer()).startsWith(minimalCorrection);
        assertThat(applied.modelAnswer()).isNotEqualTo(minimalCorrection);
        assertThat(applied.rewriteChallenge()).isNotEqualTo(applied.modelAnswer());
        assertThat(applied.strengths()).allSatisfy(strength -> assertThat(strength).doesNotContain(learnerAnswer));
    }

    private PromptDto prompt(String id, String questionEn) {
        return new PromptDto(
                id,
                "Problem Solving - Work Challenge",
                "Problem Solving",
                "Work Challenge",
                "B",
                questionEn,
                null,
                null,
                null,
                null
        );
    }
}
