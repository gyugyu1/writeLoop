package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.persistence.PromptRecommendationTimingLogEntity;
import com.writeloop.persistence.PromptRecommendationTimingLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PromptRecommendationTimingRecorder {

    private static final ThreadLocal<TimingContext> CURRENT_CONTEXT = new ThreadLocal<>();

    private final PromptRecommendationTimingLogRepository promptRecommendationTimingLogRepository;
    private final ObjectMapper objectMapper;

    public void beginTrace(
            String endpointType,
            DailyDifficultyDto difficulty,
            Long userId,
            String guestId,
            int excludeCount
    ) {
        CURRENT_CONTEXT.set(new TimingContext(
                UUID.randomUUID().toString(),
                normalize(endpointType),
                difficulty == null ? null : difficulty.name(),
                userId,
                normalize(guestId),
                excludeCount
        ));
    }

    public void clearTrace() {
        CURRENT_CONTEXT.remove();
    }

    public void recordPhase(String phase, long elapsedMs) {
        recordPhase(phase, elapsedMs, null, null, null, null);
    }

    public void recordPhase(
            String phase,
            long elapsedMs,
            Integer candidateCount,
            Integer resultCount,
            Boolean fallbackUsed,
            Map<String, ?> metadata
    ) {
        TimingContext context = CURRENT_CONTEXT.get();
        if (context == null) {
            return;
        }

        try {
            promptRecommendationTimingLogRepository.save(PromptRecommendationTimingLogEntity.builder()
                    .traceId(context.traceId)
                    .endpointType(context.endpointType)
                    .phase(normalize(phase))
                    .difficulty(context.difficulty)
                    .userId(context.userId)
                    .guestId(context.guestId)
                    .excludeCount(context.excludeCount)
                    .candidateCount(candidateCount)
                    .resultCount(resultCount)
                    .fallbackUsed(fallbackUsed)
                    .elapsedMs(Math.max(0L, elapsedMs))
                    .metadataJson(toJson(metadata))
                    .build());
        } catch (RuntimeException exception) {
            log.warn(
                    "Failed to persist prompt recommendation timing log phase={} traceId={}",
                    phase,
                    context.traceId,
                    exception
            );
        }
    }

    private String toJson(Map<String, ?> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record TimingContext(
            String traceId,
            String endpointType,
            String difficulty,
            Long userId,
            String guestId,
            int excludeCount
    ) {
    }
}
