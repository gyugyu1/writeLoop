package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.persistence.FeedbackDiagnosisExecutionStatus;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FeedbackDiagnosisLogRecorder {

    private final FeedbackDiagnosisLogRepository repository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(FeedbackDiagnosisFailureEvent event) {
        if (event == null || event.executionTrace() == null || event.executionTrace().finalSuccess()) {
            return;
        }

        PromptDto prompt = event.prompt();
        FeedbackExecutionTrace trace = event.executionTrace();
        FeedbackTokenUsage tokenUsage = trace.tokenUsage();
        FeedbackProviderRetryTrace providerRetry = trace.providerRetry();
        repository.saveAndFlush(FeedbackDiagnosisLogEntity.builder()
                .executionStatus(FeedbackDiagnosisExecutionStatus.FAILED)
                .answerAttemptId(null)
                .sessionId(normalize(event.sessionId()))
                .attemptNo(event.attemptNo())
                .attemptType(normalize(event.attemptType()))
                .userId(event.userId())
                .guestId(normalize(event.guestId()))
                .promptId(value(prompt == null ? null : prompt.id()))
                .inputFingerprint(fingerprint(
                        prompt == null ? null : prompt.id(),
                        event.learnerAnswer()
                ))
                .promptTopic(value(prompt == null ? null : prompt.topic()))
                .promptTopicCategory(normalize(prompt == null ? null : prompt.topicCategory()))
                .promptTopicDetail(normalize(prompt == null ? null : prompt.topicDetail()))
                .promptDifficulty(value(prompt == null ? null : prompt.difficulty()))
                .promptQuestionEn(value(prompt == null ? null : prompt.questionEn()))
                .promptQuestionKo(value(prompt == null ? null : prompt.questionKo()))
                .promptHintsJson(toJson(event.hints() == null ? List.of() : event.hints()))
                .promptTaskMetaJson(toJson(prompt == null ? null : prompt.taskMeta()))
                .learnerAnswer(value(event.learnerAnswer()))
                .previousAnswer(normalize(event.previousAnswer()))
                .llmProvider(value(trace.provider()))
                .llmModel(normalize(trace.model()))
                .reasoningEffort(normalize(trace.reasoningEffort()))
                .thinkingBudget(trace.thinkingBudget())
                .providerRetryAttempted(providerRetry.attempted())
                .providerRetrySucceeded(providerRetry.succeeded())
                .providerInitialFailureStatusCode(providerRetry.initialFailureStatusCode())
                .providerInitialFailureBodyJson(toJsonDocument(providerRetry.initialFailureBodyJson()))
                .diagnosisResponseStatusCode(trace.initialResponseStatusCode())
                .regenerationResponseStatusCode(trace.retryResponseStatusCode())
                .diagnosisResponseBodyJson(toJsonDocument(trace.initialResponseBodyJson()))
                .regenerationResponseBodyJson(toJsonDocument(trace.retryResponseBodyJson()))
                .contractViolationDetected(trace.contractViolationDetected())
                .retryAttempted(trace.retryAttempted())
                .contractRetrySucceeded(trace.retrySucceeded())
                .contractOriginalErrorReason(normalize(trace.originalContractErrorReason()))
                .contractFinalErrorReason(normalize(trace.finalErrorReason()))
                .elapsedMs(trace.elapsedMs())
                .llmInputTokens(tokenUsage.inputTokens())
                .llmCachedInputTokens(tokenUsage.cachedInputTokens())
                .llmOutputTokens(tokenUsage.outputTokens())
                .llmReasoningTokens(tokenUsage.reasoningTokens())
                .llmTotalTokens(tokenUsage.totalTokens())
                .build());
    }

    static String fingerprint(String promptId, String learnerAnswer) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String input = value(promptId) + '\n' + value(learnerAnswer);
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize feedback diagnosis context", exception);
        }
    }

    private String toJsonDocument(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            objectMapper.readTree(value);
            return value.trim();
        } catch (JsonProcessingException ignored) {
            return toJson(value);
        }
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String value(String value) {
        return value == null ? "" : value;
    }
}

record FeedbackDiagnosisFailureEvent(
        String sessionId,
        Integer attemptNo,
        String attemptType,
        Long userId,
        String guestId,
        PromptDto prompt,
        List<PromptHintDto> hints,
        String learnerAnswer,
        String previousAnswer,
        FeedbackExecutionTrace executionTrace
) {
}
