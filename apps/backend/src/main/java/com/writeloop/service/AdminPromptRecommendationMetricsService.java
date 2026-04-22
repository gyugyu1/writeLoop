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
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
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

        List<PromptRecommendationExposureEntity> exposures = normalizeExposures(
                loadExposures(startDate, endDate, difficultyFilter)
        );
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

    private List<PromptRecommendationExposureEntity> normalizeExposures(
            List<PromptRecommendationExposureEntity> exposures
    ) {
        if (exposures.isEmpty()) {
            return List.of();
        }

        List<PromptRecommendationExposureEntity> ordered = new ArrayList<>(exposures);
        ordered.sort(Comparator
                .comparing(PromptRecommendationExposureEntity::getRecommendedDate)
                .thenComparing(
                        PromptRecommendationExposureEntity::getShownAt,
                        Comparator.nullsLast(Comparator.naturalOrder())
                )
                .thenComparing(PromptRecommendationExposureEntity::getId, Comparator.nullsLast(Comparator.naturalOrder())));

        Map<ExposureIdentityKey, PromptRecommendationExposureEntity> canonicalByKey = new LinkedHashMap<>();
        for (PromptRecommendationExposureEntity exposure : ordered) {
            ExposureIdentityKey key = new ExposureIdentityKey(
                    exposure.getRecommendedDate(),
                    exposure.getUserId(),
                    exposure.getGuestId(),
                    exposure.getPromptId()
            );
            PromptRecommendationExposureEntity canonical = canonicalByKey.get(key);
            if (canonical == null) {
                canonicalByKey.put(key, exposure);
                continue;
            }

            mergeDuplicateExposure(canonical, exposure);
        }

        return List.copyOf(canonicalByKey.values());
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

    private void mergeDuplicateExposure(
            PromptRecommendationExposureEntity canonical,
            PromptRecommendationExposureEntity duplicate
    ) {
        canonical.updateShownAtIfEarlier(duplicate.getShownAt());
        canonical.updateClickedAtIfEarlier(duplicate.getClickedAt());
        canonical.adoptStartedSessionId(duplicate.getStartedSessionId());
        canonical.adoptCompletedSessionId(duplicate.getCompletedSessionId());
        mergeRecommendationMetadata(
                canonical,
                duplicate.getDifficulty(),
                duplicate.getSlotType(),
                duplicate.getReasonCode(),
                duplicate.getScore(),
                duplicate.getShownAt()
        );
    }

    private boolean mergeRecommendationMetadata(
            PromptRecommendationExposureEntity exposure,
            String difficulty,
            String slotType,
            String reasonCode,
            Integer score,
            Instant candidateShownAt
    ) {
        if (slotType == null || slotType.isBlank()) {
            return false;
        }

        int currentPriority = slotPriority(exposure.getSlotType());
        int candidatePriority = slotPriority(slotType);
        boolean shouldReplace = candidatePriority > currentPriority
                || (candidatePriority == currentPriority
                && candidateShownAt != null
                && exposure.getShownAt() != null
                && candidateShownAt.isAfter(exposure.getShownAt()));

        if (!shouldReplace) {
            return false;
        }

        return exposure.updateRecommendation(difficulty, slotType, reasonCode, score);
    }

    private int slotPriority(String slotType) {
        if (slotType == null || slotType.isBlank()) {
            return 0;
        }

        if ("FEATURED".equalsIgnoreCase(slotType)) {
            return 400;
        }
        if ("PREPICK_FEATURED".equalsIgnoreCase(slotType)) {
            return 350;
        }
        if ("FRESH_ALTERNATIVE".equalsIgnoreCase(slotType)) {
            return 230;
        }
        if ("GROWTH_ALTERNATIVE".equalsIgnoreCase(slotType)) {
            return 220;
        }
        if (slotType.toUpperCase(Locale.ROOT).startsWith("ALTERNATIVE")) {
            return 200;
        }
        return 100;
    }

    private record AggregationKey(
            String promptId,
            String difficulty,
            String slotType,
            String reasonCode
    ) {
    }

    private record ExposureIdentityKey(
            LocalDate recommendedDate,
            Long userId,
            String guestId,
            String promptId
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
