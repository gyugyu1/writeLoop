package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.persistence.PromptRecommendationTimingLogEntity;
import com.writeloop.persistence.PromptRecommendationTimingLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PromptRecommendationTimingRecorder {

    private static final int MAX_GUEST_ID_LENGTH = 64;
    private static final ThreadLocal<TimingContext> CURRENT_CONTEXT = new ThreadLocal<>();

    private final PromptRecommendationTimingLogRepository promptRecommendationTimingLogRepository;
    private final ObjectMapper objectMapper;
    private TransactionTemplate independentTransaction;

    // 로그는 호출한 쪽과 다른 트랜잭션에 저장한다. 같은 트랜잭션이면 로그 INSERT 하나가 실패해도
    // 본 트랜잭션이 롤백 전용이 되어, 이미 끝난 요청이 커밋할 때 500으로 바뀐다.
    @Autowired(required = false)
    void useIndependentTransactions(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        independentTransaction = template;
    }

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
            saveIndependently(() -> promptRecommendationTimingLogRepository.save(PromptRecommendationTimingLogEntity.builder()
                    .traceId(context.traceId)
                    .endpointType(context.endpointType)
                    .phase(normalize(phase))
                    .difficulty(context.difficulty)
                    .userId(context.userId)
                    .guestId(limit(context.guestId, MAX_GUEST_ID_LENGTH))
                    .excludeCount(context.excludeCount)
                    .candidateCount(candidateCount)
                    .resultCount(resultCount)
                    .fallbackUsed(fallbackUsed)
                    .elapsedMs(Math.max(0L, elapsedMs))
                    .metadataJson(toJson(metadata))
                    .build()));
        } catch (RuntimeException exception) {
            log.warn(
                    "Failed to persist prompt recommendation timing log phase={} traceId={}",
                    phase,
                    context.traceId,
                    exception
            );
        }
    }

    private void saveIndependently(Runnable save) {
        if (independentTransaction == null) {
            save.run();
            return;
        }
        independentTransaction.executeWithoutResult(status -> save.run());
    }

    // 게스트 id는 126자까지 허용하지만 로그 열은 64자다.
    private static String limit(String value, int maxLength) {
        return value == null || value.length() <= maxLength ? value : value.substring(0, maxLength);
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
