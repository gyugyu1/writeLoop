package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@Service
public class GeminiFeedbackClient {

    static final String INTERNAL_AUTHORITATIVE_SESSION_ID = "__GEMINI_CANONICAL_FINAL__";
    private static final Logger LOGGER = LoggerFactory.getLogger(GeminiFeedbackClient.class);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final Integer thinkingBudget;
    private final int requestTimeoutSeconds;
    private final CanonicalFeedbackContract contract;
    private final CanonicalFeedbackAssembler assembler = new CanonicalFeedbackAssembler();
    private final ThreadLocal<FeedbackAnalysisSnapshot> latestAnalysisSnapshot = new ThreadLocal<>();
    private final ThreadLocal<FeedbackExecutionTrace> latestExecutionTrace = new ThreadLocal<>();

    @Autowired(required = false)
    private FeedbackTimingRecorder feedbackTimingRecorder;

    public GeminiFeedbackClient(
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.feedback-model:gemini-3-flash-preview}") String model,
            @Value("${gemini.api-url:https://generativelanguage.googleapis.com/v1beta/models}") String apiUrl,
            @Value("${gemini.feedback-thinking-budget:16000}") Integer thinkingBudget,
            @Value("${gemini.feedback-request-timeout-seconds:120}") int requestTimeoutSeconds
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = apiUrl;
        this.thinkingBudget = thinkingBudget;
        this.requestTimeoutSeconds = requestTimeoutSeconds;
        this.contract = new CanonicalFeedbackContract(objectMapper);
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer) {
        return review(prompt, answer, List.of(), 1);
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer, List<PromptHintDto> hints) {
        return review(prompt, answer, hints, 1);
    }

    public FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex
    ) {
        latestAnalysisSnapshot.remove();
        latestExecutionTrace.remove();
        if (!isConfigured()) {
            throw feedbackGenerationUnavailable();
        }

        long startedAt = System.nanoTime();
        Integer initialStatusCode = null;
        Integer retryStatusCode = null;
        FeedbackContractException originalContractError = null;
        boolean retryAttempted = false;
        Boolean retrySucceeded = null;
        Exception finalException = null;
        boolean finalSuccess = false;
        String initialProviderBody = null;
        String initialStructuredText = null;
        String retryProviderBody = null;
        String retryStructuredText = null;
        FeedbackTokenUsage initialTokenUsage = FeedbackTokenUsage.empty();
        FeedbackTokenUsage retryTokenUsage = FeedbackTokenUsage.empty();
        try {
            String userPrompt = contract.userPrompt(
                    prompt,
                    answer,
                    hints
            );
            ProviderResponse initialResponse = requestCanonicalFeedback(prompt, userPrompt);
            initialStatusCode = initialResponse.statusCode();
            initialProviderBody = initialResponse.body();
            initialTokenUsage = FeedbackTokenUsage.fromGeminiResponse(
                    objectMapper,
                    initialProviderBody
            );
            requireSuccessfulResponse(initialResponse);

            AssembledFeedback assembled;
            try {
                initialStructuredText = extractCanonicalText(initialResponse.body());
                assembled = assemble(prompt, answer, attemptIndex, initialStructuredText);
            } catch (FeedbackContractException exception) {
                originalContractError = exception;
                if (!exception.retryable()) {
                    throw exception;
                }
                String rejectedOutput = initialStructuredText == null
                        ? initialResponse.body()
                        : initialStructuredText;
                String retryPrompt = contract.contractRetryPrompt(
                        userPrompt,
                        rejectedOutput,
                        exception.getMessage()
                );
                retryAttempted = true;
                retrySucceeded = false;
                ProviderResponse retryResponse = requestCanonicalFeedback(prompt, retryPrompt);
                retryStatusCode = retryResponse.statusCode();
                retryProviderBody = retryResponse.body();
                retryTokenUsage = FeedbackTokenUsage.fromGeminiResponse(
                        objectMapper,
                        retryProviderBody
                );
                requireSuccessfulResponse(retryResponse);
                retryStructuredText = extractCanonicalText(retryResponse.body());
                assembled = assemble(prompt, answer, attemptIndex, retryStructuredText);
                retrySucceeded = true;
            }

            Integer finalStatusCode = retrySucceeded == Boolean.TRUE ? retryStatusCode : initialStatusCode;
            String finalStructuredText = retrySucceeded == Boolean.TRUE
                    ? retryStructuredText
                    : initialStructuredText;
            FeedbackContractRetryTrace retryTrace = originalContractError == null
                    ? FeedbackContractRetryTrace.notAttempted()
                    : FeedbackContractRetryTrace.recovered(
                            originalContractError.getMessage(),
                            initialStatusCode,
                            initialStructuredText == null ? initialResponse.body() : initialStructuredText,
                            retryStatusCode,
                            retryStructuredText
                    );
            latestAnalysisSnapshot.set(new FeedbackAnalysisSnapshot(
                    "gemini",
                    model,
                    finalStatusCode,
                    finalStructuredText,
                    assembled.diagnosis(),
                    assembled.sections(),
                    retryTrace
            ));
            finalSuccess = true;
            recordTiming(prompt, attemptIndex, true, finalStatusCode, null, startedAt);
            return assembled.response();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            finalException = exception;
            Integer finalStatusCode = retryStatusCode == null ? initialStatusCode : retryStatusCode;
            recordTiming(prompt, attemptIndex, false, finalStatusCode, exception, startedAt);
            LOGGER.warn("Gemini feedback request was interrupted", exception);
            throw feedbackGenerationUnavailable();
        } catch (Exception exception) {
            finalException = exception;
            Integer finalStatusCode = retryStatusCode == null ? initialStatusCode : retryStatusCode;
            recordTiming(prompt, attemptIndex, false, finalStatusCode, exception, startedAt);
            LOGGER.warn("Gemini canonical feedback failed", exception);
            throw feedbackGenerationUnavailable();
        } finally {
            latestExecutionTrace.set(new FeedbackExecutionTrace(
                    "gemini",
                    model,
                    null,
                    thinkingBudget,
                    initialStatusCode,
                    preferredOutput(initialStructuredText, initialProviderBody),
                    retryStatusCode,
                    preferredOutput(retryStructuredText, retryProviderBody),
                    originalContractError != null,
                    retryAttempted,
                    retrySucceeded,
                    finalSuccess,
                    originalContractError == null ? null : originalContractError.getMessage(),
                    finalException == null ? null : finalException.getMessage(),
                    initialTokenUsage.plus(retryTokenUsage),
                    (System.nanoTime() - startedAt) / 1_000_000
            ));
        }
    }

    boolean isAuthoritativeFeedback(FeedbackResponseDto feedback) {
        return feedback != null && INTERNAL_AUTHORITATIVE_SESSION_ID.equals(feedback.sessionId());
    }

    FeedbackResponseDto clearInternalMetadata(FeedbackResponseDto feedback) {
        if (!isAuthoritativeFeedback(feedback)) {
            return feedback;
        }
        return new FeedbackResponseDto(
                feedback.promptId(),
                null,
                feedback.attemptNo(),
                feedback.loopComplete(),
                feedback.completionMessage(),
                feedback.summary(),
                feedback.strengths(),
                feedback.corrections(),
                feedback.inlineFeedback(),
                feedback.grammarFeedback(),
                feedback.revisedAnswer(),
                feedback.refinementExpressions(),
                feedback.modelAnswer(),
                feedback.modelAnswerKo(),
                feedback.rewriteChallenge(),
                feedback.ui(),
                feedback.loop(),
                feedback.coachMove(),
                feedback.rewriteWorkspace(),
                feedback.completion(),
                feedback.revealLater()
        );
    }

    FeedbackAnalysisSnapshot takeLastAnalysisSnapshot() {
        FeedbackAnalysisSnapshot snapshot = latestAnalysisSnapshot.get();
        latestAnalysisSnapshot.remove();
        return snapshot;
    }

    FeedbackExecutionTrace takeLastExecutionTrace() {
        FeedbackExecutionTrace trace = latestExecutionTrace.get();
        latestExecutionTrace.remove();
        return trace;
    }

    List<InlineFeedbackSegmentDto> buildInlineFeedbackFromRevisedAnswer(String learnerAnswer, String revisedAnswer) {
        return FeedbackInlineDiffSupport.diff(learnerAnswer, revisedAnswer);
    }

    List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String revisedAnswer) {
        return FeedbackInlineDiffSupport.diff(learnerAnswer, revisedAnswer);
    }

    private ApiException feedbackGenerationUnavailable() {
        return new ApiException(
                HttpStatus.BAD_GATEWAY,
                "FEEDBACK_GENERATION_UNAVAILABLE",
                "지금은 피드백을 생성할 수 없어요. 잠시 후 다시 시도해 주세요."
        );
    }

    private ProviderResponse requestCanonicalFeedback(
            PromptDto prompt,
            String userPrompt
    ) throws Exception {
        String promptText = contract.developerPrompt()
                + "\n\nINPUT JSON:\n"
                + userPrompt;
        String requestBody = GeminiStructuredOutputSupport.buildGenerateContentRequestBody(
                objectMapper,
                promptText,
                contract.schema(prompt),
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
        return new ProviderResponse(response.statusCode(), response.body());
    }

    private void requireSuccessfulResponse(ProviderResponse response) {
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Gemini returned HTTP " + response.statusCode());
        }
    }

    private String extractCanonicalText(String responseBody) {
        try {
            return GeminiStructuredOutputSupport.extractStructuredOutputText(objectMapper, responseBody);
        } catch (java.io.IOException | IllegalStateException exception) {
            throw new FeedbackContractException(
                    "Gemini response did not contain valid canonical structured output: "
                            + exception.getMessage()
            );
        }
    }

    private AssembledFeedback assemble(
            PromptDto prompt,
            String answer,
            int attemptIndex,
            String structuredText
    ) {
        CanonicalLlmOutput output;
        try {
            output = contract.parse(structuredText);
        } catch (JsonProcessingException exception) {
            throw new FeedbackContractException(
                    "Gemini canonical output could not be parsed: " + exception.getMessage()
            );
        }
        return assembler.assemble(
                INTERNAL_AUTHORITATIVE_SESSION_ID,
                prompt,
                answer,
                attemptIndex,
                output
        );
    }

    private String preferredOutput(String structuredText, String providerBody) {
        if (structuredText != null && !structuredText.isBlank()) {
            return structuredText;
        }
        return providerBody == null || providerBody.isBlank() ? null : providerBody;
    }

    private void recordTiming(
            PromptDto prompt,
            int attemptIndex,
            boolean success,
            Integer statusCode,
            Exception exception,
            long startedAt
    ) {
        if (feedbackTimingRecorder == null) {
            return;
        }
        feedbackTimingRecorder.recordAnswerLlmPhase(
                "canonical_feedback",
                prompt == null ? null : prompt.id(),
                attemptIndex,
                "gemini",
                model,
                null,
                thinkingBudget,
                success,
                statusCode,
                exception == null ? null : exception.getClass().getSimpleName(),
                (System.nanoTime() - startedAt) / 1_000_000
        );
    }

    private record ProviderResponse(
            int statusCode,
            String body
    ) {
    }
}
