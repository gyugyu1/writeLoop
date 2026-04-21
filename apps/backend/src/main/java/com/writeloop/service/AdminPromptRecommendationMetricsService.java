package com.writeloop.service;

import com.writeloop.dto.AdminPromptRecommendationMetricsDto;
import com.writeloop.dto.AdminPromptRecommendationMetricsItemDto;
import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptRecommendationExposureEntity;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminPromptRecommendationMetricsService {

    private static final ZoneId KOREA_ZONE = ZoneId.of("Asia/Seoul");
    private static final int DEFAULT_RANGE_DAYS = 14;

    private final PromptRecommendationExposureRepository promptRecommendationExposureRepository;
    private final PromptRepository promptRepository;

    public AdminPromptRecommendationMetricsDto summarize(
            LocalDate requestedStartDate,
            LocalDate requestedEndDate,
            DailyDifficultyDto difficultyFilter
    ) {
        LocalDate today = LocalDate.now(KOREA_ZONE);
        LocalDate endDate = requestedEndDate == null ? today : requestedEndDate;
        LocalDate startDate = requestedStartDate == null ? endDate.minusDays(DEFAULT_RANGE_DAYS - 1L) : requestedStartDate;

        if (startDate.isAfter(endDate)) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_DATE_RANGE",
                    "시작일은 종료일보다 늦을 수 없어요."
            );
        }

        List<PromptRecommendationExposureEntity> exposures = loadExposures(startDate, endDate, difficultyFilter);
        Map<String, PromptEntity> promptsById = loadPromptsById(exposures);

        Map<AggregationKey, AggregationBucket> buckets = new LinkedHashMap<>();
        for (PromptRecommendationExposureEntity exposure : exposures) {
            AggregationKey key = new AggregationKey(
                    exposure.getPromptId(),
                    exposure.getDifficulty(),
                    exposure.getSlotType(),
                    exposure.getReasonCode()
            );
            buckets.computeIfAbsent(key, ignored -> new AggregationBucket()).accumulate(exposure);
        }

        List<AdminPromptRecommendationMetricsItemDto> items = buckets.entrySet().stream()
                .map(entry -> toItem(entry.getKey(), entry.getValue(), promptsById.get(entry.getKey().promptId())))
                .sorted(Comparator
                        .comparingLong(AdminPromptRecommendationMetricsItemDto::completedCount).reversed()
                        .thenComparingLong(AdminPromptRecommendationMetricsItemDto::startedCount).reversed()
                        .thenComparingLong(AdminPromptRecommendationMetricsItemDto::clickedCount).reversed()
                        .thenComparingLong(AdminPromptRecommendationMetricsItemDto::shownCount).reversed()
                        .thenComparing(AdminPromptRecommendationMetricsItemDto::promptId))
                .toList();

        long totalShownCount = items.stream().mapToLong(AdminPromptRecommendationMetricsItemDto::shownCount).sum();
        long totalClickedCount = items.stream().mapToLong(AdminPromptRecommendationMetricsItemDto::clickedCount).sum();
        long totalStartedCount = items.stream().mapToLong(AdminPromptRecommendationMetricsItemDto::startedCount).sum();
        long totalCompletedCount = items.stream().mapToLong(AdminPromptRecommendationMetricsItemDto::completedCount).sum();

        return new AdminPromptRecommendationMetricsDto(
                startDate.toString(),
                endDate.toString(),
                difficultyFilter,
                totalShownCount,
                totalClickedCount,
                totalStartedCount,
                totalCompletedCount,
                toRate(totalClickedCount, totalShownCount),
                toRate(totalStartedCount, totalShownCount),
                toRate(totalCompletedCount, totalShownCount),
                items
        );
    }

    private List<PromptRecommendationExposureEntity> loadExposures(
            LocalDate startDate,
            LocalDate endDate,
            DailyDifficultyDto difficultyFilter
    ) {
        if (difficultyFilter == null) {
            return promptRecommendationExposureRepository
                    .findByRecommendedDateBetweenOrderByRecommendedDateDescShownAtDesc(startDate, endDate);
        }
        return promptRecommendationExposureRepository
                .findByRecommendedDateBetweenAndDifficultyOrderByRecommendedDateDescShownAtDesc(
                        startDate,
                        endDate,
                        difficultyFilter.name()
                );
    }

    private Map<String, PromptEntity> loadPromptsById(List<PromptRecommendationExposureEntity> exposures) {
        Set<String> promptIds = new LinkedHashSet<>();
        for (PromptRecommendationExposureEntity exposure : exposures) {
            if (exposure.getPromptId() != null && !exposure.getPromptId().isBlank()) {
                promptIds.add(exposure.getPromptId());
            }
        }

        if (promptIds.isEmpty()) {
            return Map.of();
        }

        Map<String, PromptEntity> promptsById = new LinkedHashMap<>();
        for (PromptEntity prompt : promptRepository.findAllById(promptIds)) {
            promptsById.put(prompt.getId(), prompt);
        }
        return promptsById;
    }

    private AdminPromptRecommendationMetricsItemDto toItem(
            AggregationKey key,
            AggregationBucket bucket,
            PromptEntity prompt
    ) {
        return new AdminPromptRecommendationMetricsItemDto(
                key.promptId(),
                prompt == null ? "" : safe(prompt.getTopic()),
                prompt == null ? "" : safe(prompt.getTopicCategory()),
                prompt == null ? "" : safe(prompt.getTopicDetail()),
                key.difficulty(),
                prompt == null ? "" : safe(prompt.getQuestionEn()),
                key.slotType(),
                key.reasonCode(),
                bucket.shownCount,
                bucket.clickedCount,
                bucket.startedCount,
                bucket.completedCount,
                toRate(bucket.clickedCount, bucket.shownCount),
                toRate(bucket.startedCount, bucket.shownCount),
                toRate(bucket.completedCount, bucket.shownCount),
                toRate(bucket.completedCount, bucket.startedCount)
        );
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private double toRate(long numerator, long denominator) {
        if (denominator <= 0) {
            return 0D;
        }
        return Math.round((numerator / (double) denominator) * 10000D) / 10000D;
    }

    private record AggregationKey(
            String promptId,
            String difficulty,
            String slotType,
            String reasonCode
    ) {
    }

    private static final class AggregationBucket {
        private long shownCount;
        private long clickedCount;
        private long startedCount;
        private long completedCount;

        private void accumulate(PromptRecommendationExposureEntity exposure) {
            shownCount += 1;
            if (exposure.getClickedAt() != null) {
                clickedCount += 1;
            }
            if (exposure.getStartedSessionId() != null && !exposure.getStartedSessionId().isBlank()) {
                startedCount += 1;
            }
            if (exposure.getCompletedSessionId() != null && !exposure.getCompletedSessionId().isBlank()) {
                completedCount += 1;
            }
        }
    }
}
