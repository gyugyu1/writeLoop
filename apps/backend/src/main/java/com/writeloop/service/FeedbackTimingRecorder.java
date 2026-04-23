package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.persistence.FeedbackTimingLogEntity;
import com.writeloop.persistence.FeedbackTimingLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class FeedbackTimingRecorder {

    private static final String TYPE_ANSWER = "ANSWER";
    private static final String TYPE_DIARY = "DIARY";
    private static final String SCOPE_SERVICE = "SERVICE";
    private static final String SCOPE_LLM = "LLM";
    private static final String SCOPE_POLICY = "POLICY";
    private static final ThreadLocal<TimingContext> CURRENT_CONTEXT = new ThreadLocal<>();

    private final FeedbackTimingLogRepository feedbackTimingLogRepository;
    private final ObjectMapper objectMapper;

    public void beginAnswerTrace(Long userId, String guestId, String promptId, String sessionId, Integer attemptNo) {
        CURRENT_CONTEXT.set(TimingContext.answer(userId, guestId, promptId, sessionId, attemptNo));
    }

    public void beginDiaryTrace(Long userId, String entryId, Integer attemptNo) {
        CURRENT_CONTEXT.set(TimingContext.diary(userId, entryId, attemptNo));
    }

    public void setAnswerAttemptId(Long answerAttemptId) {
        TimingContext context = CURRENT_CONTEXT.get();
        if (context != null) {
            context.answerAttemptId = answerAttemptId;
        }
    }

    public void setDiaryAttemptId(Long diaryAttemptId) {
        TimingContext context = CURRENT_CONTEXT.get();
        if (context != null) {
            context.diaryAttemptId = diaryAttemptId;
        }
    }

    public void clearTrace() {
        CURRENT_CONTEXT.remove();
    }

    public void recordServicePhase(String phase, long elapsedMs) {
        recordCurrent(SCOPE_SERVICE, phase, null, null, null, null, null, null, null, elapsedMs, null);
    }

    public void recordPolicyEvent(String phase, Map<String, ?> metadata) {
        recordCurrent(SCOPE_POLICY, phase, null, null, null, null, null, null, null, 0L, metadata);
    }

    public void recordAnswerLlmPhase(
            String phase,
            String promptId,
            Integer attemptNo,
            String provider,
            String model,
            String reasoningEffort,
            Integer thinkingBudget,
            Boolean success,
            Integer statusCode,
            String exceptionClass,
            long elapsedMs
    ) {
        TimingContext context = contextOrStandalone(TYPE_ANSWER);
        if (context.promptId == null || context.promptId.isBlank()) {
            context.promptId = normalize(promptId);
        }
        if (context.attemptNo == null) {
            context.attemptNo = attemptNo;
        }
        record(context, SCOPE_LLM, phase, provider, model, reasoningEffort, thinkingBudget, success, statusCode,
                exceptionClass, elapsedMs, null);
    }

    public void recordDiaryLlmPhase(
            String phase,
            String entryId,
            Integer attemptNo,
            String provider,
            String model,
            String reasoningEffort,
            Integer thinkingBudget,
            Boolean success,
            Integer statusCode,
            String exceptionClass,
            long elapsedMs
    ) {
        TimingContext context = contextOrStandalone(TYPE_DIARY);
        if (context.diaryEntryId == null || context.diaryEntryId.isBlank()) {
            context.diaryEntryId = normalize(entryId);
        }
        if (context.attemptNo == null) {
            context.attemptNo = attemptNo;
        }
        record(context, SCOPE_LLM, phase, provider, model, reasoningEffort, thinkingBudget, success, statusCode,
                exceptionClass, elapsedMs, null);
    }

    private void recordCurrent(
            String phaseScope,
            String phase,
            String provider,
            String model,
            String reasoningEffort,
            Integer thinkingBudget,
            Boolean success,
            Integer statusCode,
            String exceptionClass,
            long elapsedMs,
            Map<String, ?> metadata
    ) {
        TimingContext context = CURRENT_CONTEXT.get();
        if (context == null) {
            return;
        }
        record(context, phaseScope, phase, provider, model, reasoningEffort, thinkingBudget, success, statusCode,
                exceptionClass, elapsedMs, metadata);
    }

    private void record(
            TimingContext context,
            String phaseScope,
            String phase,
            String provider,
            String model,
            String reasoningEffort,
            Integer thinkingBudget,
            Boolean success,
            Integer statusCode,
            String exceptionClass,
            long elapsedMs,
            Map<String, ?> metadata
    ) {
        try {
            feedbackTimingLogRepository.save(FeedbackTimingLogEntity.builder()
                    .traceId(context.traceId)
                    .feedbackType(context.feedbackType)
                    .phaseScope(normalize(phaseScope))
                    .phase(normalize(phase))
                    .userId(context.userId)
                    .guestId(context.guestId)
                    .promptId(context.promptId)
                    .diaryEntryId(context.diaryEntryId)
                    .sessionId(context.sessionId)
                    .answerAttemptId(context.answerAttemptId)
                    .diaryAttemptId(context.diaryAttemptId)
                    .attemptNo(context.attemptNo)
                    .provider(normalize(provider))
                    .model(normalize(model))
                    .reasoningEffort(normalize(reasoningEffort))
                    .thinkingBudget(thinkingBudget)
                    .success(success)
                    .statusCode(statusCode)
                    .exceptionClass(normalize(exceptionClass))
                    .elapsedMs(Math.max(0L, elapsedMs))
                    .metadataJson(toJson(metadata))
                    .build());
        } catch (RuntimeException exception) {
            log.warn("Failed to persist feedback timing log phase={} traceId={}", phase, context.traceId, exception);
        }
    }

    private TimingContext contextOrStandalone(String feedbackType) {
        TimingContext context = CURRENT_CONTEXT.get();
        if (context != null) {
            return context;
        }
        return new TimingContext(UUID.randomUUID().toString(), feedbackType);
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

    private static final class TimingContext {
        private final String traceId;
        private final String feedbackType;
        private Long userId;
        private String guestId;
        private String promptId;
        private String diaryEntryId;
        private String sessionId;
        private Long answerAttemptId;
        private Long diaryAttemptId;
        private Integer attemptNo;

        private TimingContext(String traceId, String feedbackType) {
            this.traceId = traceId;
            this.feedbackType = feedbackType;
        }

        private static TimingContext answer(
                Long userId,
                String guestId,
                String promptId,
                String sessionId,
                Integer attemptNo
        ) {
            TimingContext context = new TimingContext(UUID.randomUUID().toString(), TYPE_ANSWER);
            context.userId = userId;
            context.guestId = normalize(guestId);
            context.promptId = normalize(promptId);
            context.sessionId = normalize(sessionId);
            context.attemptNo = attemptNo;
            return context;
        }

        private static TimingContext diary(Long userId, String entryId, Integer attemptNo) {
            TimingContext context = new TimingContext(UUID.randomUUID().toString(), TYPE_DIARY);
            context.userId = userId;
            context.diaryEntryId = normalize(entryId);
            context.attemptNo = attemptNo;
            return context;
        }
    }
}
