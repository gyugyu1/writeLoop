package com.writeloop.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PromptTopicCatalogTest {

    @Test
    void allows_known_category_and_detail_combination() {
        assertThat(PromptTopicCatalog.isAllowed("Goal Plan", "Habit Building")).isTrue();
    }

    @Test
    void rejects_unknown_detail_for_category() {
        assertThat(PromptTopicCatalog.isAllowed("Goal Plan", "Favorite Food")).isFalse();
    }
}
