package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.DiaryFeedbackResponseDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
class GeminiDiaryFeedbackEngine implements DiaryFeedbackLlmEngine {

    private static final Logger LOGGER = LoggerFactory.getLogger(GeminiDiaryFeedbackEngine.class);
    private static final int MAX_LOG_RESPONSE_BODY_LENGTH = 4000;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final Integer thinkingBudget;
    private final int requestTimeoutSeconds;
    @Autowired(required = false)
    private FeedbackTimingRecorder feedbackTimingRecorder;

    GeminiDiaryFeedbackEngine(
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.diary-model:${gemini.feedback-model:gemini-3-flash-preview}}") String model,
            @Value("${gemini.api-url:https://generativelanguage.googleapis.com/v1beta/models}") String apiUrl,
            @Value("${gemini.diary-thinking-budget:${gemini.feedback-thinking-budget:16000}}") Integer thinkingBudget,
            @Value("${gemini.diary-request-timeout-seconds:${gemini.feedback-request-timeout-seconds:120}}") int requestTimeoutSeconds
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = apiUrl;
        this.thinkingBudget = thinkingBudget;
        this.requestTimeoutSeconds = requestTimeoutSeconds;
    }

    @Override
    public String provider() {
        return "gemini";
    }

    @Override
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public DiaryFeedbackResponseDto review(DiaryFeedbackPromptContext context) {
        long startedAtNanos = System.nanoTime();
        boolean timingLogged = false;
        try {
            String requestBody = GeminiStructuredOutputSupport.buildGenerateContentRequestBody(
                    objectMapper,
                    DiaryFeedbackPromptSupport.buildPrompt(context),
                    DiaryFeedbackPromptSupport.jsonSchema(),
                    thinkingBudget
            );
            HttpRequest request = GeminiStructuredOutputSupport.buildGenerateContentRequest(
                    apiUrl,
                    apiKey,
                    model,
                    requestBody,
                    requestTimeoutSeconds
            );
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logTiming(context, response.statusCode(), false, null, startedAtNanos);
                timingLogged = true;
                LOGGER.warn("Gemini diary feedback failed status={} body={}", response.statusCode(), truncate(response.body()));
                throw new IllegalStateException("Gemini diary feedback request failed with status " + response.statusCode());
            }
            logTiming(context, response.statusCode(), true, null, startedAtNanos);
            timingLogged = true;
            String outputText = GeminiStructuredOutputSupport.extractStructuredOutputText(objectMapper, response.body());
            return objectMapper.readValue(outputText, DiaryFeedbackResponseDto.class)
                    .withIdentity(context.entryId(), context.attemptNo());
        } catch (Exception exception) {
            if (!timingLogged) {
                logTiming(context, null, false, exception, startedAtNanos);
            }
            throw new IllegalStateException("Gemini diary feedback request failed", exception);
        }
    }

    private void logTiming(
            DiaryFeedbackPromptContext context,
            Integer statusCode,
            boolean success,
            Throwable exception,
            long startedAtNanos
    ) {
        long elapsedMs = elapsedMs(startedAtNanos);
        LOGGER.info(
                "Diary feedback LLM timing provider=gemini entryId={} attemptNo={} model={} thinkingBudget={} success={} status={} exceptionClass={} elapsedMs={}",
                context.entryId(),
                context.attemptNo(),
                model,
                thinkingBudget,
                success,
                statusCode,
                exception == null ? null : exception.getClass().getName(),
                elapsedMs
        );
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.recordDiaryLlmPhase(
                    "diary_feedback",
                    context.entryId(),
                    context.attemptNo(),
                    "gemini",
                    model,
                    null,
                    thinkingBudget,
                    success,
                    statusCode,
                    exception == null ? null : exception.getClass().getName(),
                    elapsedMs
            );
        }
    }

    private static long elapsedMs(long startedAtNanos) {
        return (System.nanoTime() - startedAtNanos) / 1_000_000;
    }

    private String truncate(String value) {
        if (value == null || value.length() <= MAX_LOG_RESPONSE_BODY_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_LOG_RESPONSE_BODY_LENGTH) + "...";
    }
}
