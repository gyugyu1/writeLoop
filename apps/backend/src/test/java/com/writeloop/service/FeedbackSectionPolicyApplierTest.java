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
        assertThat(applied.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains("because it is warm", "struggle to meet deadlines", "by writing a to-do list");
        assertThat(applied.modelAnswer()).startsWith("My favorite season is spring because it is warm.");
        assertThat(applied.modelAnswer()).contains("I enjoy the breeze in spring.");
        assertThat(applied.modelAnswer()).isNotEqualTo("My favorite season is spring because it is warm.");
        assertThat(applied.modelAnswerKo()).isNull();
        if (applied.summary() != null) {
            assertThat(applied.summary()).isNotBlank();
        }
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
                .contains("struggle to meet deadlines", "by writing a to-do list", "stay on track");
        assertThat(applied.rewriteChallenge()).doesNotContain(learnerAnswer);
        assertThat(applied.rewriteChallenge()).contains(minimalCorrection);
        assertThat(applied.modelAnswer()).startsWith(minimalCorrection);
        assertThat(applied.modelAnswer()).isNotEqualTo(minimalCorrection);
        assertThat(applied.rewriteChallenge()).isNotEqualTo(applied.modelAnswer());
        assertThat(applied.strengths()).allSatisfy(strength -> assertThat(strength).doesNotContain(learnerAnswer));
    }

    @Test
    void apply_for_too_short_fragment_uses_minimal_correction_before_any_invention() {
        String learnerAnswer = "I doing nothing";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-rtn-1",
                "session-5",
                1,
                48,
                false,
                null,
                "Add one complete sentence.",
                List.of("You answered directly."),
                List.of(new CorrectionDto("Complete the sentence first.", "Write one full sentence before adding detail.")),
                List.of(),
                List.of(new GrammarFeedbackItemDto("I doing nothing", "I do nothing", "Make the sentence complete.")),
                "I usually relax at home.",
                List.of(),
                "On Sunday afternoons, I usually relax at home.",
                null,
                "Write one full sentence.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.TOO_SHORT_FRAGMENT),
                new GrammarProfile(
                        GrammarSeverity.MODERATE,
                        List.of(new GrammarIssue("LOCAL_GRAMMAR", "I doing nothing", "I do nothing", false, GrammarSeverity.MODERATE)),
                        "I do nothing."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of(new StrengthSignal("CLEAR_MAIN_ANSWER", "I doing nothing"))
                ),
                new RewriteProfile(
                        "FIX_LOCAL_GRAMMAR",
                        "STATE_MAIN_ANSWER",
                        new RewriteTarget("STATE_MAIN_ANSWER", "On Sunday afternoons, I usually ...", 1),
                        null
                )
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-rtn-1", "How do you usually spend your Sunday afternoons?"),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.grammarFeedback()).hasSize(1);
        assertThat(applied.grammarFeedback().get(0).revisedText()).isEqualTo("I do nothing.");
        assertThat(applied.rewriteChallenge()).contains("I do nothing.");
        assertThat(applied.rewriteChallenge()).contains("On Sunday afternoons, I usually ...");
        assertThat(applied.modelAnswer()).contains("do nothing");
        assertThat(applied.modelAnswer()).doesNotContain("relax at home");
    }

    @Test
    void apply_hides_low_value_article_grammar_for_short_but_valid_content_answer() {
        String learnerAnswer = "My favorite season is spring because I like sunshine.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-pref-1",
                "session-6",
                1,
                82,
                false,
                null,
                "Add one more detail.",
                List.of("You answered the question clearly."),
                List.of(new CorrectionDto("Add one more detail.", "Give one more concrete reason.")),
                List.of(),
                List.of(new GrammarFeedbackItemDto("sunshine", "the sunshine", "Use an article here.")),
                learnerAnswer,
                List.of(),
                "My favorite season is spring because I like sunshine. The warm light makes me feel relaxed.",
                null,
                "Add one more detail about why you like spring.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.SHORT_BUT_VALID),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue("ARTICLE", "sunshine", "the sunshine", false, GrammarSeverity.MINOR)),
                        null
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, true, false, true, false, false),
                        List.of(new StrengthSignal("HAS_REASON", "because I like sunshine"))
                ),
                new RewriteProfile("ADD_DETAIL", null, new RewriteTarget("ADD_DETAIL", "My favorite season is spring because ...", 1), null)
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-pref-1", "What is your favorite season and why do you like it?"),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.grammarFeedback()).isEmpty();
        assertThat(applied.modelAnswer()).contains("The warm light makes me feel relaxed.");
    }

    @Test
    void apply_hides_regressive_model_answer_for_natural_but_basic_answer() {
        String learnerAnswer = "On Sunday afternoons, I usually go to church and relax at home.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-rtn-2",
                "session-7",
                1,
                90,
                false,
                null,
                "",
                List.of("You answered clearly."),
                List.of(new CorrectionDto("Make it a bit smoother.", "Use a connector if you want to sound more natural.")),
                List.of(),
                List.of(new GrammarFeedbackItemDto("at home", "at home", "No change.")),
                learnerAnswer,
                List.of(),
                "On Sunday afternoons, I usually go to church.",
                null,
                "If you want, make the sentence slightly smoother.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), null),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of(new StrengthSignal("DESCRIBES_ACTIVITY", "go to church and relax at home"))
                ),
                new RewriteProfile("IMPROVE_NATURALNESS", null, new RewriteTarget("IMPROVE_NATURALNESS", "On Sunday afternoons, I usually ... and ...", 1), null)
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-rtn-2", "How do you usually spend your Sunday afternoons?"),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.grammarFeedback()).isEmpty();
        assertThat(applied.modelAnswer()).isNull();
    }

    @Test
    void apply_replaces_english_strengths_with_korean_display_strengths() {
        String learnerAnswer = "I usually take guitar lessons.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-routine-strength-1",
                "session-10",
                1,
                78,
                false,
                null,
                "",
                List.of("Mentions a routine activity, which provides a good starting point for expanding on details. It's clear and direct."),
                List.of(new CorrectionDto("Add one more detail.", "Add one more activity from your morning routine.")),
                List.of(),
                List.of(),
                "I usually take guitar lessons in the morning.",
                List.of(),
                null,
                null,
                "Add one more activity from your weekday mornings.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), null),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of(new StrengthSignal("DESCRIBES_ACTIVITY", "take guitar lessons"))
                ),
                new RewriteProfile(
                        "IMPROVE_NATURALNESS",
                        null,
                        new RewriteTarget("IMPROVE_NATURALNESS", "On weekday mornings, I usually ...", 1),
                        null
                )
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-routine-strength-1", "Describe your routine for your weekday mornings."),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.strengths()).hasSize(1);
        assertThat(applied.strengths().get(0)).isNotBlank();
        assertThat(applied.strengths().get(0)).contains("take guitar lessons");
        assertThat(applied.strengths().get(0)).doesNotContain("Mentions a routine activity");
    }
    @Test
    void apply_aligns_minor_correction_content_expansion_sections_for_health_goal_answer() {
        String learnerAnswer = "One health goal I have this is to diet. It's important for me to stay healthy.";
        String minimalCorrection = "One health goal I have this year is to improve my diet. It's important to me because I want to stay healthy.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-goal-12",
                "session-8",
                1,
                78,
                false,
                null,
                "Add one more reason or method.",
                List.of("\"" + learnerAnswer + "\" clearly states your goal."),
                List.of(
                        new CorrectionDto("Add one more reason.", "Explain why this matters a little more."),
                        new CorrectionDto("Add one concrete habit.", "Write one habit you want to follow for this goal.")
                ),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "One health goal I have this is to diet",
                        "One health goal I have this year is to diet",
                        "Make this phrase more natural."
                )),
                "One health goal I have this year is to diet. It's important for me to stay healthy.",
                List.of(
                        new RefinementExpressionDto("One challenge I often face is...", "Use this to introduce a problem.", "One challenge I often face is managing my schedule."),
                        new RefinementExpressionDto("As a result", "Use this to explain a result.", "As a result, I feel more organized."),
                        new RefinementExpressionDto("improve my diet", "Use this to talk about your eating habits.", "I want to improve my diet this year."),
                        new RefinementExpressionDto("It matters to me because ...", "Use this to explain why the goal is important.", "It matters to me because I want to stay healthy.")
                ),
                "One of my health goals this year is to lose weight. I exercise every weekend and stick to a healthy diet.",
                null,
                "One health goal I have this is to diet because ...",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN),
                new GrammarProfile(
                        GrammarSeverity.MODERATE,
                        List.of(new GrammarIssue("LOCAL_GRAMMAR", "One health goal I have this is to diet", "One health goal I have this year is to improve my diet", false, GrammarSeverity.MODERATE)),
                        minimalCorrection
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, false, true),
                        List.of(
                                new StrengthSignal("CLEAR_MAIN_ANSWER", learnerAnswer),
                                new StrengthSignal("HAS_REASON", "It's important for me to stay healthy")
                        )
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        "FIX_LOCAL_GRAMMAR",
                        new RewriteTarget("ADD_DETAIL", minimalCorrection + " I plan to ...", 1),
                        null
                )
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-goal-12", "Explain one health goal you want to reach this year and why it matters to you."),
                learnerAnswer,
                feedback,
                answerProfile,
                1
        );

        assertThat(applied.strengths()).hasSize(1);
        assertThat(applied.strengths().get(0)).doesNotContain(learnerAnswer);
        assertThat(applied.grammarFeedback()).hasSize(1);
        assertThat(applied.grammarFeedback().get(0).revisedText()).isEqualTo(minimalCorrection);
        assertThat(applied.grammarFeedback().get(0).reasonKo()).isNotBlank();
        assertThat(applied.corrections()).hasSize(1);
        assertThat(applied.corrections().get(0).suggestion()).isNotBlank();
        assertThat(applied.rewriteChallenge()).contains(minimalCorrection);
        assertThat(applied.rewriteChallenge()).doesNotContain("I have this is to diet because");
        assertThat(applied.modelAnswer()).doesNotContain("lose weight");
        assertThat(applied.modelAnswer()).doesNotContain("exercise every weekend");
        if (applied.modelAnswer() != null) {
            assertThat(applied.modelAnswer()).startsWith(minimalCorrection);
            assertThat(applied.modelAnswer()).isNotEqualTo(learnerAnswer);
        }
        assertThat(applied.summary()).isNotBlank();
    }

    @Test
    void apply_avoids_repeating_existing_benefit_sentence_in_one_step_up_model_answer() {
        String learnerAnswer = "I work out regularly by going to gym every day to stay healthy. This helps me feel more energetic";
        String correctedAnswer = "I work out regularly by going to the gym every day to stay healthy. This helps me feel more energetic.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-goal-13",
                null,
                0,
                86,
                false,
                null,
                "Add one more concrete detail.",
                List.of("\"" + learnerAnswer + "\" explains your goal."),
                List.of(new CorrectionDto("Add one more detail.", "Add one more concrete benefit or habit.")),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "going to gym",
                        "going to the gym",
                        "Add the article to make the phrase natural."
                )),
                correctedAnswer,
                List.of(),
                null,
                null,
                "Use the corrected sentence and add one more detail.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue("ARTICLE", "going to gym", "going to the gym", false, GrammarSeverity.MINOR)),
                        correctedAnswer
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, true, false),
                        List.of(
                                new StrengthSignal("CLEAR_MAIN_ANSWER", "I work out regularly"),
                                new StrengthSignal("HAS_REASON", "This helps me feel more energetic")
                        )
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        "MAKE_IT_MORE_SPECIFIC",
                        new RewriteTarget("ADD_DETAIL", correctedAnswer, 1),
                        null
                )
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-goal-13", "Explain one health goal you want to reach this year and why it matters to you."),
                learnerAnswer,
                feedback,
                answerProfile,
                4
        );

        if (applied.modelAnswer() != null) {
            assertThat(applied.modelAnswer()).startsWith(correctedAnswer);
            assertThat(applied.modelAnswer())
                    .doesNotContain("This helps me feel more energetic. This helps me feel more energetic.");
        }
    }

    @Test
    void apply_does_not_allow_model_answer_to_drop_correct_learner_clauses() {
        String learnerAnswer = "I usually take guitar lessons in the morning. I also get ready for the commute before work. For that, I have breakfast.";
        String correctedAnswer = "I usually take guitar lessons in the morning. I also get ready for the commute before work. For that, I have breakfast.";
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-routine-8",
                null,
                0,
                84,
                false,
                null,
                "Add clearer time flow.",
                List.of("You describe your morning routine clearly."),
                List.of(new CorrectionDto("Make the sequence clearer.", "Use time markers to show the order more clearly.")),
                List.of(),
                List.of(),
                correctedAnswer,
                List.of(),
                "On weekday mornings, I usually take guitar lessons.",
                null,
                "\"" + correctedAnswer + "\" Add one clearer time marker.",
                List.of()
        );

        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN),
                new GrammarProfile(GrammarSeverity.MINOR, List.of(), correctedAnswer),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, true, false, true, false),
                        List.of(
                                new StrengthSignal("DESCRIBES_ACTIVITY", "take guitar lessons"),
                                new StrengthSignal("HAS_SEQUENCE", "get ready for the commute before work")
                        )
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        "IMPROVE_NATURALNESS",
                        new RewriteTarget("ADD_DETAIL", correctedAnswer, 1),
                        null
                )
        );

        FeedbackResponseDto applied = applier.apply(
                prompt("prompt-routine-8", "Describe your routine for your weekday mornings."),
                learnerAnswer,
                feedback,
                answerProfile,
                3
        );

        assertThat(applied.modelAnswer()).isNotNull();
        assertThat(applied.modelAnswer()).contains("guitar lessons");
        assertThat(applied.modelAnswer()).contains("commute before work");
        assertThat(applied.modelAnswer()).contains("breakfast");
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

