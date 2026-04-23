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
class OpenAiDiaryFeedbackEngine implements DiaryFeedbackLlmEngine {

    private static final Logger LOGGER = LoggerFactory.getLogger(OpenAiDiaryFeedbackEngine.class);
    private static final int MAX_LOG_RESPONSE_BODY_LENGTH = 4000;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final String reasoningEffort;
    private final int requestTimeoutSeconds;
    @Autowired(required = false)
    private FeedbackTimingRecorder feedbackTimingRecorder;

    OpenAiDiaryFeedbackEngine(
            ObjectMapper objectMapper,
            @Value("${openai.api-key:}") String apiKey,
            @Value("${openai.diary-model:${openai.feedback-model:${OPENAI_MODEL:gpt-5-mini}}}") String model,
            @Value("${openai.api-url:https://api.openai.com/v1/responses}") String apiUrl,
            @Value("${openai.diary-reasoning-effort:${openai.feedback-reasoning-effort:}}") String reasoningEffort,
            @Value("${openai.diary-request-timeout-seconds:${openai.feedback-request-timeout-seconds:120}}") int requestTimeoutSeconds
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = apiUrl;
        this.reasoningEffort = reasoningEffort;
        this.requestTimeoutSeconds = requestTimeoutSeconds;
    }

    @Override
    public String provider() {
        return "openai";
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public DiaryFeedbackResponseDto review(DiaryFeedbackPromptContext context) {
        long startedAtNanos = System.nanoTime();
        boolean timingLogged = false;
        Integer statusCode = null;
        try {
            String requestBody = OpenAiStructuredOutputSupport.buildResponsesRequestBody(
                    objectMapper,
                    model,
                    DiaryFeedbackPromptSupport.buildPrompt(context),
                    "diary_feedback_response",
                    DiaryFeedbackPromptSupport.jsonSchema(),
                    reasoningEffort
            );
            HttpRequest request = OpenAiStructuredOutputSupport.buildResponsesRequest(
                    apiUrl,
                    apiKey,
                    requestBody,
                    requestTimeoutSeconds
            );
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            statusCode = response.statusCode();
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                logTiming(context, response.statusCode(), false, null, startedAtNanos);
                timingLogged = true;
                LOGGER.warn("OpenAI diary feedback failed status={} body={}", response.statusCode(), truncate(response.body()));
                throw new IllegalStateException("OpenAI diary feedback request failed with status " + response.statusCode());
            }
            String outputText = OpenAiStructuredOutputSupport.extractStructuredOutputText(objectMapper, response.body());
            DiaryFeedbackResponseDto feedback = objectMapper.readValue(outputText, DiaryFeedbackResponseDto.class)
                    .withIdentity(context.entryId(), context.attemptNo());
            logTiming(context, statusCode, true, null, startedAtNanos);
            timingLogged = true;
            return feedback;
        } catch (Exception exception) {
            if (!timingLogged) {
                logTiming(context, statusCode, false, exception, startedAtNanos);
            }
            throw new IllegalStateException("OpenAI diary feedback request failed", exception);
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
                "Diary feedback LLM timing provider=openai entryId={} attemptNo={} model={} reasoningEffort={} success={} status={} exceptionClass={} elapsedMs={}",
                context.entryId(),
                context.attemptNo(),
                model,
                reasoningEffort == null || reasoningEffort.isBlank() ? "default" : reasoningEffort,
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
                    "openai",
                    model,
                    reasoningEffort,
                    null,
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
