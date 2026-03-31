package com.writeloop.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PromptTaskMetaCatalogTest {

    @Test
    void classify_supports_all_seeded_prompt_families() {
        assertThat(PromptTaskMetaCatalog.classify("prompt-routine-21", "How do you usually spend the start of your Saturday?"))
                .extracting(
                        PromptTaskMetaCatalog.TaskMetaEntry::answerMode,
                        PromptTaskMetaCatalog.TaskMetaEntry::requiredSlots,
                        PromptTaskMetaCatalog.TaskMetaEntry::optionalSlots,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedTense,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedPov
                )
                .containsExactly(
                        "ROUTINE",
                        java.util.List.of("MAIN_ANSWER", "ACTIVITY"),
                        java.util.List.of("TIME_OR_PLACE", "FEELING"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON"
                );

        assertThat(PromptTaskMetaCatalog.classify("prompt-goal-05", "Explain one skill you want to improve this year and why it matters to you."))
                .extracting(
                        PromptTaskMetaCatalog.TaskMetaEntry::answerMode,
                        PromptTaskMetaCatalog.TaskMetaEntry::requiredSlots,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedTense,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedPov
                )
                .containsExactly("GOAL_PLAN", java.util.List.of("MAIN_ANSWER", "REASON"), "FUTURE_PLAN", "FIRST_PERSON");

        assertThat(PromptTaskMetaCatalog.classify("prompt-problem-12", "Describe a problem you have with speaking in front of people and explain how you deal with it."))
                .extracting(
                        PromptTaskMetaCatalog.TaskMetaEntry::answerMode,
                        PromptTaskMetaCatalog.TaskMetaEntry::requiredSlots,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedTense
                )
                .containsExactly("PROBLEM_SOLUTION", java.util.List.of("MAIN_ANSWER", "ACTIVITY"), "PRESENT_SIMPLE");

        assertThat(PromptTaskMetaCatalog.classify("prompt-balance-17", "What are the benefits and drawbacks of online shopping, and what is your view?"))
                .extracting(
                        PromptTaskMetaCatalog.TaskMetaEntry::answerMode,
                        PromptTaskMetaCatalog.TaskMetaEntry::requiredSlots,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedPov
                )
                .containsExactly("BALANCED_OPINION", java.util.List.of("MAIN_ANSWER", "REASON"), "GENERAL_OR_FIRST_PERSON");

        assertThat(PromptTaskMetaCatalog.classify("prompt-reflection-20", "In what way has your opinion about money changed over time?"))
                .extracting(
                        PromptTaskMetaCatalog.TaskMetaEntry::answerMode,
                        PromptTaskMetaCatalog.TaskMetaEntry::requiredSlots,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedTense
                )
                .containsExactly("CHANGE_REFLECTION", java.util.List.of("MAIN_ANSWER"), "MIXED_PAST_PRESENT");

        assertThat(PromptTaskMetaCatalog.classify("prompt-general-03", "Introduce a useful app you use often and explain why you would recommend it."))
                .extracting(
                        PromptTaskMetaCatalog.TaskMetaEntry::answerMode,
                        PromptTaskMetaCatalog.TaskMetaEntry::requiredSlots,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedTense,
                        PromptTaskMetaCatalog.TaskMetaEntry::expectedPov
                )
                .containsExactly("GENERAL_DESCRIPTION", java.util.List.of("MAIN_ANSWER", "REASON"), "PRESENT_SIMPLE", "FIRST_PERSON");
    }
}
