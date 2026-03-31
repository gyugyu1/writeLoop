package com.writeloop.persistence;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PromptEntityTest {

    @Test
    void splitTopic_splits_combined_topic_into_category_and_detail() {
        PromptEntity.TopicParts topicParts = PromptEntity.splitTopic("Goal Plan - Habit Building");

        assertThat(topicParts.category()).isEqualTo("Goal Plan");
        assertThat(topicParts.detail()).isEqualTo("Habit Building");
        assertThat(topicParts.combined()).isEqualTo("Goal Plan - Habit Building");
    }

    @Test
    void constructor_keeps_combined_topic_and_split_fields_in_sync() {
        PromptEntity prompt = new PromptEntity(
                "prompt-b-3",
                "Goal Plan",
                "Habit Building",
                "B",
                "What is one habit you want to build this year?",
                "올해 만들고 싶은 습관은 무엇인가요?",
                "Explain the habit and why it matters.",
                6,
                true
        );

        assertThat(prompt.getTopic()).isEqualTo("Goal Plan - Habit Building");
        assertThat(prompt.getTopicCategory()).isEqualTo("Goal Plan");
        assertThat(prompt.getTopicDetail()).isEqualTo("Habit Building");
    }
}
