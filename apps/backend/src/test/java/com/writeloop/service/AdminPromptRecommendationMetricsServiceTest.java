package com.writeloop.service;

import com.writeloop.dto.AdminPromptRecommendationMetricsDto;
import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptRecommendationExposureEntity;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminPromptRecommendationMetricsServiceTest {

    @Mock
    private PromptRecommendationExposureRepository promptRecommendationExposureRepository;

    @Mock
    private PromptRepository promptRepository;

    private AdminPromptRecommendationMetricsService metricsService;

    @BeforeEach
    void setUp() {
        metricsService = new AdminPromptRecommendationMetricsService(
                promptRecommendationExposureRepository,
                promptRepository
        );
    }

    @Test
    void summarize_aggregates_counts_and_rates_per_promptRecommendation() {
        LocalDate startDate = LocalDate.of(2026, 4, 1);
        LocalDate endDate = LocalDate.of(2026, 4, 21);

        PromptRecommendationExposureEntity shownOnly = exposure(LocalDate.of(2026, 4, 19), 1L, "prompt-a-1", "A", "FEATURED", "QUICK_START");
        PromptRecommendationExposureEntity started = exposure(LocalDate.of(2026, 4, 20), 1L, "prompt-a-1", "A", "FEATURED", "QUICK_START");
        started.markStartedSession("session-1");
        PromptRecommendationExposureEntity completed = exposure(LocalDate.of(2026, 4, 21), 1L, "prompt-a-1", "A", "FEATURED", "QUICK_START");
        completed.markCompletedSession("session-2");

        when(promptRecommendationExposureRepository
                .findByRecommendedDateBetweenAndDifficultyOrderByRecommendedDateDescShownAtDesc(startDate, endDate, "A"))
                .thenReturn(List.of(shownOnly, started, completed));
        when(promptRepository.findAllById(any()))
                .thenReturn(List.of(prompt("prompt-a-1", "Routine", "Free Time", "A")));

        AdminPromptRecommendationMetricsDto metrics = metricsService.summarize(startDate, endDate, DailyDifficultyDto.A);

        assertThat(metrics.totalShownCount()).isEqualTo(3);
        assertThat(metrics.totalClickedCount()).isEqualTo(2);
        assertThat(metrics.totalStartedCount()).isEqualTo(2);
        assertThat(metrics.totalCompletedCount()).isEqualTo(1);
        assertThat(metrics.clickRate()).isEqualTo(0.6667);
        assertThat(metrics.startRate()).isEqualTo(0.6667);
        assertThat(metrics.completeRate()).isEqualTo(0.3333);
        assertThat(metrics.items()).singleElement().satisfies(item -> {
            assertThat(item.promptId()).isEqualTo("prompt-a-1");
            assertThat(item.slotType()).isEqualTo("FEATURED");
            assertThat(item.reasonCode()).isEqualTo("QUICK_START");
            assertThat(item.shownCount()).isEqualTo(3);
            assertThat(item.clickedCount()).isEqualTo(2);
            assertThat(item.startedCount()).isEqualTo(2);
            assertThat(item.completedCount()).isEqualTo(1);
            assertThat(item.completionAfterStartRate()).isEqualTo(0.5);
        });
    }

    @Test
    void summarize_splits_metrics_by_reasonCode_and_slotType() {
        LocalDate startDate = LocalDate.of(2026, 4, 10);
        LocalDate endDate = LocalDate.of(2026, 4, 21);

        PromptRecommendationExposureEntity featuredQuickStart = exposure(
                LocalDate.of(2026, 4, 20),
                1L,
                "prompt-a-2",
                "A",
                "FEATURED",
                "QUICK_START"
        );
        featuredQuickStart.markClicked();
        PromptRecommendationExposureEntity alternativeReuse = exposure(
                LocalDate.of(2026, 4, 21),
                1L,
                "prompt-a-2",
                "A",
                "ALTERNATIVE_1",
                "EXPRESSION_REUSE"
        );

        when(promptRecommendationExposureRepository
                .findByRecommendedDateBetweenOrderByRecommendedDateDescShownAtDesc(startDate, endDate))
                .thenReturn(List.of(featuredQuickStart, alternativeReuse));
        when(promptRepository.findAllById(any()))
                .thenReturn(List.of(prompt("prompt-a-2", "Preference", "Movie", "A")));

        AdminPromptRecommendationMetricsDto metrics = metricsService.summarize(startDate, endDate, null);

        assertThat(metrics.items()).hasSize(2);
        assertThat(metrics.items())
                .extracting(item -> item.slotType() + ":" + item.reasonCode())
                .containsExactlyInAnyOrder(
                        "FEATURED:QUICK_START",
                        "ALTERNATIVE_1:EXPRESSION_REUSE"
                );
    }

    @Test
    void summarize_dedupes_same_day_duplicate_rows_per_prompt_and_identity() {
        LocalDate startDate = LocalDate.of(2026, 4, 21);
        LocalDate endDate = LocalDate.of(2026, 4, 21);

        PromptRecommendationExposureEntity prepick = exposure(
                LocalDate.of(2026, 4, 21),
                1L,
                "prompt-a-3",
                "A",
                "PREPICK_FEATURED",
                "QUICK_START"
        );
        PromptRecommendationExposureEntity featured = exposure(
                LocalDate.of(2026, 4, 21),
                1L,
                "prompt-a-3",
                "A",
                "FEATURED",
                "STREAK_KEEPER"
        );
        featured.markStartedSession("session-3");

        when(promptRecommendationExposureRepository
                .findByRecommendedDateBetweenAndDifficultyOrderByRecommendedDateDescShownAtDesc(startDate, endDate, "A"))
                .thenReturn(List.of(featured, prepick));
        when(promptRepository.findAllById(any()))
                .thenReturn(List.of(prompt("prompt-a-3", "Routine", "Weekend", "A")));

        AdminPromptRecommendationMetricsDto metrics = metricsService.summarize(startDate, endDate, DailyDifficultyDto.A);

        assertThat(metrics.totalShownCount()).isEqualTo(1);
        assertThat(metrics.totalClickedCount()).isEqualTo(1);
        assertThat(metrics.totalStartedCount()).isEqualTo(1);
        assertThat(metrics.items()).singleElement().satisfies(item -> {
            assertThat(item.promptId()).isEqualTo("prompt-a-3");
            assertThat(item.slotType()).isEqualTo("FEATURED");
            assertThat(item.reasonCode()).isEqualTo("STREAK_KEEPER");
            assertThat(item.shownCount()).isEqualTo(1);
            assertThat(item.clickedCount()).isEqualTo(1);
            assertThat(item.startedCount()).isEqualTo(1);
        });
    }

    private PromptRecommendationExposureEntity exposure(
            LocalDate recommendedDate,
            Long userId,
            String promptId,
            String difficulty,
            String slotType,
            String reasonCode
    ) {
        return new PromptRecommendationExposureEntity(
                recommendedDate,
                userId,
                null,
                difficulty,
                promptId,
                slotType,
                reasonCode,
                84
        );
    }

    private PromptEntity prompt(String id, String topicCategory, String topicDetail, String difficulty) {
        return new PromptEntity(
                id,
                topicCategory,
                topicDetail,
                difficulty,
                "How do you usually spend your free time at home?",
                "질문",
                "tip",
                1,
                true
        );
    }
}
