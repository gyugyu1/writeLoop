package com.writeloop.service;

import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AnswerProfileBuilderTest {

    private final AnswerProfileBuilder answerProfileBuilder = new AnswerProfileBuilder();

    @Test
    void build_creates_profile_from_existing_feedback_signals() {
        AnswerContext context = new AnswerContext(
                "What is your favorite season and why?",
                "A",
                1,
                "My favorite season are spring because it's warm and I like the breeze and sunshine.",
                null,
                null,
                List.of()
        );

        AnswerProfile profile = answerProfileBuilder.build(
                context,
                "My favorite season is spring because it's warm and I like the breeze and sunshine.",
                List.of(
                        new InlineFeedbackSegmentDto("KEEP", "My favorite season ", "My favorite season "),
                        new InlineFeedbackSegmentDto("REPLACE", "are", "is"),
                        new InlineFeedbackSegmentDto("KEEP", " spring because it's warm and I like the breeze and sunshine.", " spring because it's warm and I like the breeze and sunshine.")
                ),
                List.of(new GrammarFeedbackItemDto("season are", "season is", "subject verb agreement"))
        );

        assertThat(profile.task().onTopic()).isTrue();
        assertThat(profile.task().taskCompletion()).isEqualTo(TaskCompletion.FULL);
        assertThat(profile.grammar().severity()).isEqualTo(GrammarSeverity.MINOR);
        assertThat(profile.grammar().issues())
                .extracting(GrammarIssue::code)
                .contains("SUBJECT_VERB_AGREEMENT");
        assertThat(profile.content().signals().hasReason()).isTrue();
        assertThat(profile.content().specificity()).isEqualTo(ContentLevel.MEDIUM);
        assertThat(profile.rewrite().primaryIssueCode()).isEqualTo("FIX_LOCAL_GRAMMAR");
    }

    @Test
    void build_uses_prompt_task_meta_for_task_completion() {
        AnswerContext context = new AnswerContext(
                "What is one habit you want to build this year?",
                "B",
                1,
                "I want to build a morning reading habit.",
                null,
                null,
                List.of(),
                new PromptTaskMetaDto("GOAL_PLAN", List.of("MAIN_ANSWER", "REASON"), List.of("ACTIVITY"))
        );

        AnswerProfile profile = answerProfileBuilder.build(
                context,
                null,
                List.of(),
                List.of()
        );

        assertThat(profile.task().onTopic()).isTrue();
        assertThat(profile.task().taskCompletion()).isEqualTo(TaskCompletion.PARTIAL);
        assertThat(profile.rewrite().primaryIssueCode()).isEqualTo("ADD_REASON");
    }

    @Test
    void build_uses_topic_metadata_for_on_topic_detection() {
        AnswerProfile profile = answerProfileBuilder.build(
                new AnswerContext(
                        "What is your favorite food, and why do you like it?",
                        "A",
                        1,
                        "Pizza because it's cheesy and delicious.",
                        null,
                        null,
                        List.of(),
                        new PromptTaskMetaDto("PREFERENCE", List.of("MAIN_ANSWER", "REASON"), List.of("FEELING", "EXAMPLE")),
                        "Preference",
                        "Favorite Food"
                ),
                null,
                List.of(),
                List.of()
        );

        assertThat(profile.task().onTopic()).isTrue();
        assertThat(profile.task().taskCompletion()).isEqualTo(TaskCompletion.FULL);
    }

    @Test
    void build_uses_prompt_task_meta_for_content_specificity_and_detail_routing() {
        String learnerAnswer = "This skill matters to me because clear communication is important.";

        AnswerProfile missingActivityProfile = answerProfileBuilder.build(
                new AnswerContext(
                        "What steps will you take for one skill you want to improve this year?",
                        "B",
                        1,
                        learnerAnswer,
                        null,
                        null,
                        List.of(),
                        new PromptTaskMetaDto("GOAL_PLAN", List.of("MAIN_ANSWER", "ACTIVITY"), List.of("REASON", "TIME_OR_PLACE"))
                ),
                null,
                List.of(),
                List.of()
        );

        AnswerProfile reasonRequiredProfile = answerProfileBuilder.build(
                new AnswerContext(
                        "Explain one skill you want to improve this year and why it matters to you.",
                        "B",
                        1,
                        learnerAnswer,
                        null,
                        null,
                        List.of(),
                        new PromptTaskMetaDto("GOAL_PLAN", List.of("MAIN_ANSWER", "REASON"), List.of("ACTIVITY", "TIME_OR_PLACE"))
                ),
                null,
                List.of(),
                List.of()
        );

        assertThat(missingActivityProfile.task().taskCompletion()).isEqualTo(TaskCompletion.PARTIAL);
        assertThat(missingActivityProfile.content().specificity()).isEqualTo(ContentLevel.LOW);
        assertThat(missingActivityProfile.rewrite().primaryIssueCode()).isEqualTo("ADD_DETAIL");

        assertThat(reasonRequiredProfile.task().taskCompletion()).isEqualTo(TaskCompletion.FULL);
        assertThat(reasonRequiredProfile.content().specificity()).isEqualTo(ContentLevel.MEDIUM);
        assertThat(reasonRequiredProfile.rewrite().primaryIssueCode()).isEqualTo("IMPROVE_NATURALNESS");
        assertThat(reasonRequiredProfile.content().strengths())
                .extracting(StrengthSignal::code)
                .contains("HAS_REASON");
    }

    @Test
    void build_uses_prompt_task_meta_for_grammar_tense_and_pov_alignment() {
        AnswerProfile tenseProfile = answerProfileBuilder.build(
                new AnswerContext(
                        "What is one habit you want to build this year?",
                        "B",
                        1,
                        "Last year I practiced piano every day after school.",
                        null,
                        null,
                        List.of(),
                        new PromptTaskMetaDto(
                                "GOAL_PLAN",
                                List.of("MAIN_ANSWER", "ACTIVITY"),
                                List.of("REASON", "TIME_OR_PLACE"),
                                "FUTURE_PLAN",
                                "FIRST_PERSON"
                        ),
                        "Goal Plan",
                        "Habit Building"
                ),
                null,
                List.of(),
                List.of()
        );

        AnswerProfile povProfile = answerProfileBuilder.build(
                new AnswerContext(
                        "What do you usually do after dinner?",
                        "A",
                        1,
                        "People usually watch TV after dinner.",
                        null,
                        null,
                        List.of(),
                        new PromptTaskMetaDto(
                                "ROUTINE",
                                List.of("MAIN_ANSWER", "ACTIVITY"),
                                List.of("TIME_OR_PLACE", "FEELING"),
                                "PRESENT_SIMPLE",
                                "FIRST_PERSON"
                        ),
                        "Routine",
                        "After Dinner"
                ),
                null,
                List.of(),
                List.of()
        );

        assertThat(tenseProfile.grammar().issues())
                .extracting(GrammarIssue::code)
                .contains("TENSE_ALIGNMENT");
        assertThat(povProfile.grammar().issues())
                .extracting(GrammarIssue::code)
                .contains("POINT_OF_VIEW_ALIGNMENT");
    }

    @Test
    void build_marks_broken_solution_sentence_as_grammar_blocking_even_without_openai_grammar_items() {
        AnswerProfile profile = answerProfileBuilder.build(
                new AnswerContext(
                        "What is one challenge you often face at work or school, and how do you deal with it?",
                        "B",
                        1,
                        "I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.",
                        null,
                        "One challenge I face is meeting deadlines. To solve this, I write a to-do list to stay on track.",
                        List.of(),
                        new PromptTaskMetaDto("PROBLEM_SOLUTION", List.of("MAIN_ANSWER", "ACTIVITY"), List.of("REASON")),
                        "Problem Solving",
                        "Work Challenge"
                ),
                null,
                List.of(),
                List.of()
        );

        assertThat(profile.task().answerBand()).isEqualTo(AnswerBand.GRAMMAR_BLOCKING);
        assertThat(profile.rewrite().primaryIssueCode()).isEqualTo("FIX_BLOCKING_GRAMMAR");
    }
}
