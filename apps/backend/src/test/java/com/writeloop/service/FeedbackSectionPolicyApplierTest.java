package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
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
    void apply_enforces_grammar_blocking_policy_caps_and_minimal_correction_mode() {
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
                        new RefinementExpressionDto("because it's [adjective]", "Use this to explain a reason.", "because it's warm"),
                        new RefinementExpressionDto("I want to [verb].", "Use this to talk about a plan.", "I want to build a better routine."),
                        new RefinementExpressionDto("One reason is that ...", "Use this to add a reason.", "One reason is that spring feels fresh.")
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
                new PromptDto(
                        "prompt-a-2",
                        "Preference - Favorite Season",
                        "Preference",
                        "Favorite Season",
                        "A",
                        "What is your favorite season and why?",
                        "가장 좋아하는 계절과 이유를 말해 보세요.",
                        null,
                        null,
                        null
                ),
                "My favorite season are spring because it warm.",
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.strengths()).hasSize(1);
        assertThat(applied.grammarFeedback()).hasSize(2);
        assertThat(applied.corrections()).hasSize(2);
        assertThat(applied.refinementExpressions()).hasSize(3);
        assertThat(applied.modelAnswer()).isEqualTo("My favorite season is spring because it is warm.");
        assertThat(applied.modelAnswerKo()).isNull();
        assertThat(applied.summary()).contains("grammar issue");
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
                        new RefinementExpressionDto("To address this, I [action or strategy].", "Use this to explain your solution.", "To address this, I prioritize my tasks."),
                        new RefinementExpressionDto("This helps me [result or benefit].", "Use this to explain the result.", "This helps me stay on track and be more productive.")
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
                new PromptDto(
                        "prompt-b-1",
                        "Problem Solving - Work or School Challenge",
                        "Problem Solving",
                        "Work or School Challenge",
                        "B",
                        "What is one challenge you often face at work or school, and how do you deal with it?",
                        "직장이나 학교에서 자주 겪는 어려움과 해결 방법을 말해 보세요.",
                        null,
                        null,
                        null
                ),
                "One challenge I face is procrastination.",
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains("To address this, I [action or strategy].", "This helps me [result or benefit].")
                .doesNotContain("To address this");
    }

    @Test
    void apply_uses_semantic_strengths_and_filters_raw_used_expressions_for_grammar_blocking() {
        String learnerAnswer = "I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.";
        String minimalCorrection = "I often struggle to meet deadlines. To solve this, I write a to-do list to stay on track.";
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
                new PromptDto(
                        "prompt-b-1",
                        "Problem Solving - Work Challenge",
                        "Problem Solving",
                        "Work Challenge",
                        "B",
                        "What is one challenge you often face at work or school, and how do you deal with it?",
                        "질문",
                        null,
                        null,
                        null
                ),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.strengths()).hasSize(1);
        assertThat(applied.strengths().get(0)).contains("문제와 해결 방법");
        assertThat(applied.strengths().get(0)).doesNotContain(learnerAnswer);
        assertThat(applied.grammarFeedback()).isNotEmpty();
        assertThat(applied.grammarFeedback().get(0).originalText()).isEqualTo(learnerAnswer);
        assertThat(applied.grammarFeedback().get(0).revisedText()).isEqualTo(minimalCorrection);
        assertThat(applied.grammarFeedback().get(0).reasonKo()).isNotBlank();
        assertThat(applied.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("to-do list", "stay on track")
                .doesNotContain("I often struggle with meet the deadline");
    }
}
