package com.writeloop.service;

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
        return review(prompt, answer, List.of(), 1, null, null);
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer, List<PromptHintDto> hints) {
        return review(prompt, answer, hints, 1, null, null);
    }

    public FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    ) {
        return review(prompt, answer, hints, attemptIndex, previousAnswer, null);
    }

    public FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer,
            String previousCoachingSummary
    ) {
        latestAnalysisSnapshot.remove();
        if (!isConfigured()) {
            throw feedbackGenerationUnavailable();
        }

        long startedAt = System.nanoTime();
        Integer statusCode = null;
        try {
            String promptText = contract.developerPrompt()
                    + "\n\nINPUT JSON:\n"
                    + contract.userPrompt(
                    prompt,
                    answer,
                    hints,
                    attemptIndex,
                    previousAnswer,
                    previousCoachingSummary
            );
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
            statusCode = response.statusCode();
            if (statusCode < 200 || statusCode >= 300) {
                throw new IllegalStateException("Gemini returned HTTP " + statusCode);
            }
            String structuredText = GeminiStructuredOutputSupport.extractStructuredOutputText(
                    objectMapper,
                    response.body()
            );
            CanonicalLlmOutput output = contract.parse(structuredText);
            AssembledFeedback assembled = assembler.assemble(
                    INTERNAL_AUTHORITATIVE_SESSION_ID,
                    prompt,
                    answer,
                    attemptIndex,
                    output
            );
            latestAnalysisSnapshot.set(new FeedbackAnalysisSnapshot(
                    "gemini",
                    model,
                    statusCode,
                    structuredText,
                    assembled.diagnosis(),
                    assembled.sections()
            ));
            recordTiming(prompt, attemptIndex, true, statusCode, null, startedAt);
            return assembled.response();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            recordTiming(prompt, attemptIndex, false, statusCode, exception, startedAt);
            LOGGER.warn("Gemini feedback request was interrupted", exception);
            throw feedbackGenerationUnavailable();
        } catch (Exception exception) {
            recordTiming(prompt, attemptIndex, false, statusCode, exception, startedAt);
            LOGGER.warn("Gemini canonical feedback failed", exception);
            throw feedbackGenerationUnavailable();
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
                feedback.correctedAnswer(),
                feedback.refinementExpressions(),
                feedback.modelAnswer(),
                feedback.modelAnswerKo(),
                feedback.rewriteChallenge(),
                feedback.usedExpressions(),
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

    List<InlineFeedbackSegmentDto> buildInlineFeedbackFromCorrectedAnswer(String learnerAnswer, String correctedAnswer) {
        return FeedbackInlineDiffSupport.diff(learnerAnswer, correctedAnswer);
    }

    List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String learnerAnswer, String correctedAnswer) {
        return FeedbackInlineDiffSupport.diff(learnerAnswer, correctedAnswer);
    }

    private ApiException feedbackGenerationUnavailable() {
        return new ApiException(
                HttpStatus.BAD_GATEWAY,
                "FEEDBACK_GENERATION_UNAVAILABLE",
                "지금은 피드백을 생성할 수 없어요. 잠시 후 다시 시도해 주세요."
        );
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
}
