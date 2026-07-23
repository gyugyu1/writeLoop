package com.writeloop.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PromptTaskMetaCatalogTest {

    @Test
    void routineRequiresActionAndOneDistinctDepthSlot() {
        PromptTaskMetaCatalog.TaskMetaEntry entry = PromptTaskMetaCatalog.classify(
                "prompt-routine-21",
                "How do you usually spend the start of your Saturday?"
        );

        assertThat(entry.answerMode()).isEqualTo("ROUTINE");
        assertThat(entry.requiredSlots()).containsExactly("ACTION");
        assertThat(entry.optionalSlots()).startsWith("ADDITIONAL_ACTION", "SPECIFIC_TIME", "PLACE", "REASON");
        assertThat(entry.minimumDepthSlots()).isEqualTo(1);
    }

    @Test
    void preferenceSeparatesChoiceFromReason() {
        PromptTaskMetaCatalog.TaskMetaEntry explicitWhy = PromptTaskMetaCatalog.classify(
                "prompt-intro-v2-0004",
                "What is your favorite color? Why?"
        );
        PromptTaskMetaCatalog.TaskMetaEntry openPreference = PromptTaskMetaCatalog.classify(
                "prompt-intro-v2-0003",
                "What do you like about your city?"
        );

        assertThat(explicitWhy.requiredSlots()).containsExactly("CHOICE", "REASON");
        assertThat(explicitWhy.minimumDepthSlots()).isZero();
        assertThat(openPreference.requiredSlots()).containsExactly("CHOICE");
        assertThat(openPreference.optionalSlots()).startsWith("REASON", "DETAIL");
        assertThat(openPreference.minimumDepthSlots()).isEqualTo(1);
    }

    @Test
    void questionReclassificationOverridesStaleConfiguredMode() {
        PromptTaskMetaCatalog.TaskMetaEntry entry = PromptTaskMetaCatalog.classify(
                "prompt-intro-v2-test",
                "Do you like coffee or tea? Why?",
                "GENERAL_DESCRIPTION"
        );

        assertThat(entry.answerMode()).isEqualTo("PREFERENCE");
        assertThat(entry.requiredSlots()).containsExactly("CHOICE", "REASON");
    }

    @Test
    void goalAndProblemModesUseDistinctCoreAndActionSlots() {
        PromptTaskMetaCatalog.TaskMetaEntry goal = PromptTaskMetaCatalog.classify(
                "prompt-goal-05",
                "Explain one skill you want to improve this year and why it matters to you."
        );
        PromptTaskMetaCatalog.TaskMetaEntry problem = PromptTaskMetaCatalog.classify(
                "prompt-problem-12",
                "Describe a problem you have with speaking in front of people and explain how you deal with it."
        );

        assertThat(goal.requiredSlots()).containsExactly("GOAL", "REASON");
        assertThat(goal.optionalSlots()).contains("PLAN");
        assertThat(goal.expectedTense()).isEqualTo("FUTURE_PLAN");
        assertThat(problem.requiredSlots()).containsExactly("PROBLEM", "SOLUTION");
    }

    @Test
    void balancedAndChangeQuestionsPreserveTheirSemanticObligations() {
        PromptTaskMetaCatalog.TaskMetaEntry balanced = PromptTaskMetaCatalog.classify(
                "prompt-balance-17",
                "What are the benefits and drawbacks of online shopping, and what is your view?"
        );
        PromptTaskMetaCatalog.TaskMetaEntry reflection = PromptTaskMetaCatalog.classify(
                "prompt-reflection-20",
                "In what way has your opinion about money changed over time?"
        );

        assertThat(balanced.requiredSlots()).containsExactly("OPINION", "ADVANTAGE", "DISADVANTAGE");
        assertThat(reflection.requiredSlots()).containsExactly("BEFORE_STATE", "NOW_STATE");
        assertThat(reflection.expectedTense()).isEqualTo("MIXED_PAST_PRESENT");
    }

    @Test
    void generalQuestionsDistinguishPlaceTimeActionAndDetail() {
        assertThat(PromptTaskMetaCatalog.classify("prompt-x-1", "Where do you live?").requiredSlots())
                .isEqualTo(List.of("PLACE"));
        assertThat(PromptTaskMetaCatalog.classify("prompt-x-2", "What time do you usually wake up?").requiredSlots())
                .isEqualTo(List.of("ACTION", "SPECIFIC_TIME"));
        assertThat(PromptTaskMetaCatalog.classify("prompt-x-3", "Who is your best friend?").requiredSlots())
                .isEqualTo(List.of("DETAIL"));
    }
}
