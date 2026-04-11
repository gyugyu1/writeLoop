package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintItemRepository;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromptServiceTest {

    @Mock
    private PromptRepository promptRepository;

    @Mock
    private PromptHintRepository promptHintRepository;

    @Mock
    private PromptHintItemRepository promptHintItemRepository;

    @Mock
    private PromptCoachProfileSupport promptCoachProfileSupport;

    @Mock
    private PromptHintItemSupport promptHintItemSupport;

    @Mock
    private PromptTaskMetaSupport promptTaskMetaSupport;

    private PromptService promptService;

    @BeforeEach
    void setUp() {
        promptService = new PromptService(
                promptRepository,
                promptHintRepository,
                promptHintItemRepository,
                promptCoachProfileSupport,
                promptHintItemSupport,
                promptTaskMetaSupport
        );
    }

    @Test
    void recommendDailyPrompts_skipsDuplicateCategories() {
        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(
                prompt("prompt-1", "Food", "Cooking", "A", 1),
                prompt("prompt-2", "Food", "Restaurants", "A", 2),
                prompt("prompt-3", "Travel", "Planning", "A", 3),
                prompt("prompt-4", "Work", "Meetings", "A", 4),
                prompt("prompt-5", "Health", "Habits", "B", 5)
        ));

        DailyPromptRecommendationDto recommendation = promptService.recommendDailyPrompts(DailyDifficultyDto.A);

        assertThat(recommendation.prompts()).hasSize(3);
        assertThat(recommendation.prompts())
                .extracting(PromptDto::topicCategory)
                .doesNotHaveDuplicates();
    }

    @Test
    void recommendDailyPrompts_returnsOnlyAvailableUniqueCategories() {
        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(
                prompt("prompt-1", "Food", "Cooking", "A", 1),
                prompt("prompt-2", "Food", "Restaurants", "A", 2),
                prompt("prompt-3", "Travel", "Planning", "A", 3)
        ));

        DailyPromptRecommendationDto recommendation = promptService.recommendDailyPrompts(DailyDifficultyDto.A);

        assertThat(recommendation.prompts()).hasSize(2);
        assertThat(recommendation.prompts())
                .extracting(PromptDto::topicCategory)
                .containsExactlyInAnyOrder("Food", "Travel");
    }

    private PromptEntity prompt(String id, String topicCategory, String topicDetail, String difficulty, int displayOrder) {
        return new PromptEntity(
                id,
                topicCategory,
                topicDetail,
                difficulty,
                "Sample question?",
                "Sample question ko",
                "Sample tip",
                displayOrder,
                true
        );
    }
}
