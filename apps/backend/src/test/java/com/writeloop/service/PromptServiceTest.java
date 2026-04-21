package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
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
import static org.mockito.Mockito.verify;
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

    @Mock
    private TodayQuestionRecommendationService todayQuestionRecommendationService;

    private PromptService promptService;

    @BeforeEach
    void setUp() {
        promptService = new PromptService(
                promptRepository,
                promptHintRepository,
                promptHintItemRepository,
                promptCoachProfileSupport,
                promptHintItemSupport,
                promptTaskMetaSupport,
                todayQuestionRecommendationService
        );
    }

    @Test
    void recommendDailyPrompts_delegatesToRecommendationService() {
        DailyPromptRecommendationDto expected = new DailyPromptRecommendationDto(
                "2026-04-21",
                DailyDifficultyDto.A,
                "NEW",
                false,
                null,
                List.of(),
                List.of()
        );

        when(todayQuestionRecommendationService.recommend(DailyDifficultyDto.A, null, null))
                .thenReturn(expected);

        DailyPromptRecommendationDto recommendation = promptService.recommendDailyPrompts(DailyDifficultyDto.A);

        assertThat(recommendation).isSameAs(expected);
    }

    @Test
    void recordDailyPromptClick_delegatesToRecommendationService() {
        promptService.recordDailyPromptClick("prompt-a-1", 3L, null);

        verify(todayQuestionRecommendationService).recordClick("prompt-a-1", 3L, null);
    }
}
