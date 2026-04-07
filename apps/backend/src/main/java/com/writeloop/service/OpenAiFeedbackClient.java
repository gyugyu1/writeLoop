package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackPrimaryFixDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackNextStepPracticeDto;
import com.writeloop.dto.FeedbackRewriteSuggestionDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.exception.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OpenAiFeedbackClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(OpenAiFeedbackClient.class);
    private static final int MAX_LOG_RESPONSE_BODY_LENGTH = 4000;
    private static final Pattern INLINE_TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9']+|[^\\sA-Za-z0-9']+|\\s+");
    private static final Pattern PRIMARY_FIX_ENGLISH_ANCHOR_PATTERN = Pattern.compile("[A-Za-z][A-Za-z' -]{2,}");
    static final String INTERNAL_AUTHORITATIVE_SESSION_ID = "__OPENAI_HYBRID_FINAL__";
    private static final List<String> REWRITE_TARGET_ACTION_ENUM = List.of(
            "MAKE_ON_TOPIC",
            "STATE_MAIN_ANSWER",
            "FIX_BLOCKING_GRAMMAR",
            "FIX_LOCAL_GRAMMAR",
            "ADD_REASON",
            "ADD_EXAMPLE",
            "ADD_DETAIL",
            "IMPROVE_NATURALNESS"
    );
    private static final Set<String> REWRITE_TARGET_ACTION_CODES = Set.copyOf(REWRITE_TARGET_ACTION_ENUM);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String diagnosisModel;
    private final String apiUrl;
    private final String reasoningEffort;
    private final int requestTimeoutSeconds;
    private final AnswerProfileBuilder answerProfileBuilder = new AnswerProfileBuilder();
    private final SectionPolicySelector sectionPolicySelector = new SectionPolicySelector();
    private final CompletionStateSelector completionStateSelector = new CompletionStateSelector();
    private final FeedbackScreenPolicySelector feedbackScreenPolicySelector = new FeedbackScreenPolicySelector();
    private final FeedbackSectionValidators feedbackSectionValidators = new FeedbackSectionValidators();
    private final FeedbackDeterministicSectionGenerator deterministicSectionGenerator = new FeedbackDeterministicSectionGenerator();
    private final FeedbackDeterministicCorrectionResolver deterministicCorrectionResolver = new FeedbackDeterministicCorrectionResolver();
    private final FeedbackRetryPolicy feedbackRetryPolicy = new FeedbackRetryPolicy();
    private final ThreadLocal<FeedbackAnalysisSnapshot> latestAnalysisSnapshot = new ThreadLocal<>();

    private record OpenAiApiResponse(
            int statusCode,
            String body
    ) {
    }

    private record DiagnosisCallResult(
            FeedbackDiagnosisResult diagnosis,
            int statusCode,
            String rawResponseBody
    ) {
    }

    private record GenerationCallResult(
            GeneratedSections sections,
            int statusCode,
            String rawResponseBody
    ) {
    }

    private static final class OpenAiApiHttpException extends IllegalStateException {
        private final int statusCode;
        private final String responseBody;

        private OpenAiApiHttpException(int statusCode, String message, String responseBody) {
            super(message);
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        int statusCode() {
            return statusCode;
        }

        String responseBody() {
            return responseBody;
        }
    }

    private static final class OpenAiResponseParseException extends IOException {
        private final int statusCode;
        private final String responseBody;

        private OpenAiResponseParseException(String message, int statusCode, String responseBody, Throwable cause) {
            super(message, cause);
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        int statusCode() {
            return statusCode;
        }

        String responseBody() {
            return responseBody;
        }
    }

    private static final class OpenAiResponseParseRuntimeException extends IllegalStateException {
        private final int statusCode;
        private final String responseBody;

        private OpenAiResponseParseRuntimeException(String message, int statusCode, String responseBody, Throwable cause) {
            super(message, cause);
            this.statusCode = statusCode;
            this.responseBody = responseBody;
        }

        int statusCode() {
            return statusCode;
        }

        String responseBody() {
            return responseBody;
        }
    }

    private ApiException feedbackGenerationUnavailable() {
        return new ApiException(
                HttpStatus.BAD_GATEWAY,
                "FEEDBACK_GENERATION_UNAVAILABLE",
                "\uC9C0\uAE08\uC740 \uD53C\uB4DC\uBC31\uC744 \uC0DD\uC131\uD560 \uC218 \uC5C6\uC5B4\uC694."
        );
    }

    public OpenAiFeedbackClient(
            ObjectMapper objectMapper,
            @Value("${openai.api-key:}") String apiKey,
            @Value("${openai.feedback-model:${OPENAI_MODEL:gpt-5-mini}}") String model,
            @Value("${openai.diagnosis-model:${OPENAI_DIAGNOSIS_MODEL:${OPENAI_FEEDBACK_MODEL:${OPENAI_MODEL:gpt-5-mini}}}}") String diagnosisModel,
            @Value("${openai.api-url:https://api.openai.com/v1/responses}") String apiUrl,
            @Value("${openai.feedback-reasoning-effort:}") String reasoningEffort,
            @Value("${openai.feedback-request-timeout-seconds:120}") int requestTimeoutSeconds
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.apiKey = apiKey;
        this.model = model;
        this.diagnosisModel = diagnosisModel;
        this.apiUrl = apiUrl;
        this.reasoningEffort = reasoningEffort;
        this.requestTimeoutSeconds = requestTimeoutSeconds;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer) {
        return review(prompt, answer, List.of(), 1, null);
    }

    public FeedbackResponseDto review(PromptDto prompt, String answer, List<PromptHintDto> hints) {
        return review(prompt, answer, hints, 1, null);
    }

    public FeedbackResponseDto review(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    ) {
        latestAnalysisSnapshot.remove();
        try {
            return reviewHybrid(prompt, answer, hints, attemptIndex, previousAnswer);
        } catch (IOException | InterruptedException exception) {
            logOpenAiFailure("review", prompt == null ? null : prompt.id(), attemptIndex, exception);
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("OpenAI API request failed", exception);
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
                feedback.score(),
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
                feedback.ui()
        );
    }

    FeedbackAnalysisSnapshot takeLastAnalysisSnapshot() {
        FeedbackAnalysisSnapshot snapshot = latestAnalysisSnapshot.get();
        latestAnalysisSnapshot.remove();
        return snapshot;
    }

    private FeedbackResponseDto reviewHybrid(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    )
            throws IOException, InterruptedException {
        FeedbackDiagnosisResult diagnosis;
        boolean diagnosisFallbackUsed = false;
        Integer diagnosisResponseStatusCode = null;
        String diagnosisResponseBody = null;
        try {
            DiagnosisCallResult diagnosisCallResult = diagnose(prompt, answer, hints, attemptIndex, previousAnswer);
            diagnosis = diagnosisCallResult.diagnosis();
            diagnosisResponseStatusCode = diagnosisCallResult.statusCode();
            diagnosisResponseBody = diagnosisCallResult.rawResponseBody();
        } catch (OpenAiApiHttpException diagnosisFailure) {
            logOpenAiFailure("diagnosis-http", prompt.id(), attemptIndex, diagnosisFailure);
            throw feedbackGenerationUnavailable();
        } catch (IOException diagnosisFailure) {
            logOpenAiFailure("diagnosis-io", prompt.id(), attemptIndex, diagnosisFailure);
            throw feedbackGenerationUnavailable();
        } catch (InterruptedException diagnosisFailure) {
            logOpenAiFailure("diagnosis-interrupted", prompt.id(), attemptIndex, diagnosisFailure);
            Thread.currentThread().interrupt();
            throw feedbackGenerationUnavailable();
        } catch (RuntimeException diagnosisFailure) {
            logOpenAiFailure("diagnosis-runtime-fallback", prompt.id(), attemptIndex, diagnosisFailure);
            diagnosis = buildDeterministicDiagnosis(prompt, answer, hints, attemptIndex, previousAnswer);
            diagnosisFallbackUsed = true;
        }
        AnswerProfile diagnosedProfile = buildDiagnosedProfile(prompt, answer, hints, diagnosis, attemptIndex, previousAnswer);
        SectionPolicy sectionPolicy = sectionPolicySelector.select(diagnosedProfile, attemptIndex);
        FeedbackSectionAvailability generationAvailability = buildGenerationAvailability(diagnosedProfile, sectionPolicy);
        CompletionState generationCompletionState = completionStateSelector.select(diagnosedProfile, generationAvailability);
        FeedbackScreenPolicy generationScreenPolicy = feedbackScreenPolicySelector.select(
                diagnosedProfile,
                generationCompletionState,
                generationAvailability,
                attemptIndex
        );
        List<SectionKey> generationRequestedSections = requestedSections(
                diagnosedProfile,
                sectionPolicy,
                generationScreenPolicy,
                generationAvailability
        );
        GeneratedSections fallbackSections = buildDeterministicFallbackSections(
                prompt,
                answer,
                diagnosis,
                diagnosedProfile,
                sectionPolicy
        );

        try {
            Integer generationResponseStatusCode = null;
            Integer regenerationResponseStatusCode = null;
            String generationResponseBody = null;
            String regenerationResponseBody = null;
            GenerationCallResult generationCallResult = generateSections(
                    prompt,
                    answer,
                    hints,
                    diagnosis,
                    diagnosedProfile,
                    sectionPolicy,
                    attemptIndex,
                    previousAnswer,
                    generationRequestedSections,
                    List.of(),
                    null
            );
            GeneratedSections generatedSections = generationCallResult.sections();
            generationResponseStatusCode = generationCallResult.statusCode();
            generationResponseBody = generationCallResult.rawResponseBody();
            ValidationResult validation = validateGeneratedSections(
                    answer,
                    diagnosis,
                    diagnosedProfile,
                    sectionPolicy,
                    generatedSections,
                    generationRequestedSections
            );
            boolean retryAttempted = false;
            if (validation.shouldRetry()) {
                retryAttempted = true;
                RegenerationRequest retryRequest = toRegenerationRequest(validation, diagnosedProfile, sectionPolicy);
                try {
                    GenerationCallResult regenerationCallResult = generateSections(
                            prompt,
                            answer,
                            hints,
                            diagnosis,
                            diagnosedProfile,
                            sectionPolicy,
                            attemptIndex,
                            previousAnswer,
                            retryRequest.failedSections(),
                            retryRequest.failureCodes(),
                            validation.sanitizedSections()
                    );
                    GeneratedSections regenerated = regenerationCallResult.sections();
                    regenerationResponseStatusCode = regenerationCallResult.statusCode();
                    regenerationResponseBody = regenerationCallResult.rawResponseBody();
                    validation = validateGeneratedSections(
                            answer,
                            diagnosis,
                            diagnosedProfile,
                            sectionPolicy,
                            validation.sanitizedSections().merge(regenerated),
                            generationRequestedSections
                    );
                } catch (OpenAiApiHttpException apiException) {
                    logOpenAiFailure("regeneration-http", prompt.id(), attemptIndex, apiException);
                    throw feedbackGenerationUnavailable();
                } catch (IOException ioException) {
                    logOpenAiFailure("regeneration-io", prompt.id(), attemptIndex, ioException);
                    throw feedbackGenerationUnavailable();
                } catch (InterruptedException interruptedException) {
                    logOpenAiFailure("regeneration-interrupted", prompt.id(), attemptIndex, interruptedException);
                    Thread.currentThread().interrupt();
                    throw feedbackGenerationUnavailable();
                } catch (RuntimeException runtimeException) {
                    logOpenAiFailure("regeneration-runtime-fallback", prompt.id(), attemptIndex, runtimeException);
                    // Use the validated first-pass sections plus deterministic fallback for any remaining gaps.
                }
            }
            ValidationResult completed = validateGeneratedSections(
                    answer,
                    diagnosis,
                    diagnosedProfile,
                    sectionPolicy,
                    mergeWithMinimalFallback(
                            validation.sanitizedSections(),
                            fallbackSections,
                            diagnosis,
                            diagnosedProfile,
                            sectionPolicy
                    ),
                    generationRequestedSections
            );
            latestAnalysisSnapshot.set(new FeedbackAnalysisSnapshot(
                    "OPENAI",
                    model,
                    diagnosisResponseStatusCode,
                    generationResponseStatusCode,
                    regenerationResponseStatusCode,
                    diagnosisResponseBody,
                    generationResponseBody,
                    regenerationResponseBody,
                    diagnosis,
                    diagnosedProfile,
                    sectionPolicy,
                    completed.sanitizedSections(),
                    diagnosisFallbackUsed,
                    false,
                    retryAttempted
            ));
            return assembleHybridResponse(prompt.id(), answer, diagnosis, diagnosedProfile, completed.sanitizedSections());
        } catch (OpenAiApiHttpException apiException) {
            logOpenAiFailure("generation-http", prompt.id(), attemptIndex, apiException);
            throw feedbackGenerationUnavailable();
        } catch (IOException generationFailure) {
            logOpenAiFailure("generation-io", prompt.id(), attemptIndex, generationFailure);
            throw feedbackGenerationUnavailable();
        } catch (InterruptedException interruptedException) {
            logOpenAiFailure("generation-interrupted", prompt.id(), attemptIndex, interruptedException);
            Thread.currentThread().interrupt();
            throw feedbackGenerationUnavailable();
        } catch (RuntimeException runtimeException) {
            logOpenAiFailure("generation-runtime-fallback", prompt.id(), attemptIndex, runtimeException);
            // If generation fails after successful diagnosis, prefer deterministic fallback over legacy monolithic prompt.
        }
        ValidationResult fallbackValidation = validateGeneratedSections(
                answer,
                diagnosis,
                diagnosedProfile,
                sectionPolicy,
                fallbackSections,
                generationRequestedSections
        );
        latestAnalysisSnapshot.set(new FeedbackAnalysisSnapshot(
                "OPENAI",
                model,
                diagnosisResponseStatusCode,
                null,
                null,
                diagnosisResponseBody,
                null,
                null,
                diagnosis,
                diagnosedProfile,
                sectionPolicy,
                fallbackValidation.sanitizedSections(),
                diagnosisFallbackUsed,
                true,
                false
        ));
        return assembleHybridResponse(prompt.id(), answer, diagnosis, diagnosedProfile, fallbackValidation.sanitizedSections());
    }

    private DiagnosisCallResult diagnose(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    )
            throws IOException, InterruptedException {
        OpenAiApiResponse response = sendResponsesRequest(buildDiagnosisRequestBody(prompt, answer, hints, attemptIndex, previousAnswer));
        try {
            return new DiagnosisCallResult(parseDiagnosisResponse(response.body()), response.statusCode(), response.body());
        } catch (IOException exception) {
            throw new OpenAiResponseParseException(
                    "OpenAI diagnosis response parsing failed",
                    response.statusCode(),
                    response.body(),
                    exception
            );
        } catch (RuntimeException exception) {
            throw new OpenAiResponseParseRuntimeException(
                    "OpenAI diagnosis response parsing failed",
                    response.statusCode(),
                    response.body(),
                    exception
            );
        }
    }

    private GenerationCallResult generateSections(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy,
            int attemptIndex,
            String previousAnswer,
            List<SectionKey> requestedSections,
            List<ValidationFailureCode> failureCodes,
            GeneratedSections previousSections
    ) throws IOException, InterruptedException {
        OpenAiApiResponse response = sendResponsesRequest(buildGenerationRequestBody(
                prompt,
                answer,
                hints,
                diagnosis,
                answerProfile,
                sectionPolicy,
                attemptIndex,
                previousAnswer,
                requestedSections,
                failureCodes,
                previousSections
        ));
        try {
            return new GenerationCallResult(parseGeneratedSections(response.body()), response.statusCode(), response.body());
        } catch (IOException exception) {
            throw new OpenAiResponseParseException(
                    "OpenAI generation response parsing failed",
                    response.statusCode(),
                    response.body(),
                    exception
            );
        } catch (RuntimeException exception) {
            throw new OpenAiResponseParseRuntimeException(
                    "OpenAI generation response parsing failed",
                    response.statusCode(),
                    response.body(),
                    exception
            );
        }
    }

    private ValidationResult validateGeneratedSections(
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy,
            GeneratedSections generatedSections,
            List<SectionKey> requestedSections
    ) {
        List<ValidationFailure> failures = new ArrayList<>();
        boolean strengthsRequested = isRequested(requestedSections, SectionKey.STRENGTHS);
        boolean refinementRequested = isRequested(requestedSections, SectionKey.REFINEMENT);
        boolean modelAnswerRequested = isRequested(requestedSections, SectionKey.MODEL_ANSWER);
        boolean usedExpressionsRequested = isRequested(requestedSections, SectionKey.USED_EXPRESSIONS);

        List<String> strengths = strengthsRequested
                ? limit(
                resolveDisplayableStrengths(generatedSections.strengths(), diagnosis, answerProfile),
                sectionPolicy.maxStrengthCount()
        )
                : List.of();
        List<GrammarFeedbackItemDto> grammarFeedback = List.of();
        List<CorrectionDto> corrections = List.of();
        List<CoachExpressionUsageDto> usedExpressions = usedExpressionsRequested
                ? sanitizeUsedExpressions(generatedSections.usedExpressions())
                : List.of();

        List<RefinementCard> refinementExpressions = refinementRequested
                ? limit(
                sortRefinementCardsByFocus(
                        feedbackSectionValidators.validateRefinementCardsDomain(generatedSections.refinementExpressions()),
                        sectionPolicy.refinementFocus(),
                        learnerAnswer
                ),
                sectionPolicy.maxRefinementCount()
        )
                : List.of();
        List<FeedbackSecondaryLearningPointDto> rawFixPoints = resolveGeneratedFixPoints(generatedSections);
        List<FeedbackSecondaryLearningPointDto> normalizedFixPointCandidates = sanitizeSecondaryLearningPoints(rawFixPoints, null);
        FeedbackPrimaryFixDto primaryFix = sanitizePrimaryFix(
                derivePrimaryFixFromFixPoints(normalizedFixPointCandidates),
                diagnosis,
                answerProfile,
                generatedSections.nextStepPractice() == null
                        ? null
                        : firstNonBlank(
                        generatedSections.nextStepPractice().headline(),
                        generatedSections.nextStepPractice().revisedText(),
                        generatedSections.nextStepPractice().exampleEn()
                )
        );
        String modelAnswerAnchor = anchorTextForModelAnswer(diagnosis, answerProfile);
        FeedbackSectionValidators.ModelAnswerContent guardedModelAnswer = modelAnswerRequested
                ? feedbackSectionValidators.guardModelAnswer(
                learnerAnswer,
                generatedSections.modelAnswer(),
                generatedSections.modelAnswerKo(),
                sectionPolicy.maxModelAnswerSentences(),
                sectionPolicy.modelAnswerMode()
        )
                : new FeedbackSectionValidators.ModelAnswerContent(null, null);
        String protectedModelAnswer = feedbackSectionValidators.preventModelAnswerRegression(
                learnerAnswer,
                guardedModelAnswer.modelAnswer(),
                modelAnswerAnchor,
                diagnosis.answerBand(),
                sectionPolicy.modelAnswerMode()
        );
        protectedModelAnswer = feedbackSectionValidators.alignModelAnswerWithPrimaryFixReferent(
                protectedModelAnswer,
                primaryFix,
                modelAnswerAnchor
        );
        String protectedModelAnswerKo = protectedModelAnswer != null
                && protectedModelAnswer.equals(guardedModelAnswer.modelAnswer())
                ? guardedModelAnswer.modelAnswerKo()
                : null;
        if (modelAnswerRequested && protectedModelAnswer != null && modelAnswerAnchor != null) {
            boolean nearDuplicateToAnchor = feedbackSectionValidators.isNearDuplicateText(protectedModelAnswer, modelAnswerAnchor);
            boolean lacksNovelOneStepUp = !hasNovelOneStepUpDetail(protectedModelAnswer, modelAnswerAnchor);
            if (nearDuplicateToAnchor
                    && lacksNovelOneStepUp
                    && diagnosis.answerBand() == AnswerBand.NATURAL_BUT_BASIC) {
                protectedModelAnswer = null;
                protectedModelAnswerKo = null;
            }
        }
        FeedbackNextStepPracticeDto nextStepPractice = generatedSections.nextStepPractice() != null
                ? sanitizeRewritePractice(generatedSections.nextStepPractice(), diagnosis, answerProfile)
                : null;
        List<FeedbackRewriteSuggestionDto> rewriteSuggestions = sanitizeRewriteSuggestions(
                generatedSections.rewriteSuggestions(),
                nextStepPractice
        );
        List<FeedbackSecondaryLearningPointDto> laterFixPoints = sanitizeSecondaryLearningPoints(
                deriveSecondaryLearningPointsFromFixPoints(normalizedFixPointCandidates),
                primaryFix
        );
        List<FeedbackSecondaryLearningPointDto> fixPoints = toFixPoints(primaryFix, laterFixPoints);
        List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints = generatedSections.secondaryLearningPoints().isEmpty()
                ? laterFixPoints
                : sanitizeSecondaryLearningPoints(generatedSections.secondaryLearningPoints(), primaryFix);
        GeneratedSections sanitized = new GeneratedSections(
                null,
                strengths,
                null,
                primaryFix,
                grammarFeedback,
                corrections,
                refinementExpressions,
                null,
                protectedModelAnswer,
                protectedModelAnswerKo,
                usedExpressions,
                fixPoints,
                secondaryLearningPoints,
                nextStepPractice,
                rewriteSuggestions
        );

        boolean shouldRetry = failures.stream().anyMatch(failure -> feedbackRetryPolicy.shouldRetry(failure, diagnosis, sectionPolicy));
        return new ValidationResult(sanitized, failures, shouldRetry);
    }

    private RegenerationRequest toRegenerationRequest(
            ValidationResult validation,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy
    ) {
        List<SectionKey> failedSections = validation.failures().stream()
                .map(ValidationFailure::sectionKey)
                .distinct()
                .toList();
        List<ValidationFailureCode> failureCodes = validation.failures().stream()
                .map(ValidationFailure::failureCode)
                .distinct()
                .toList();
        return new RegenerationRequest(failedSections, answerProfile, sectionPolicy, failureCodes);
    }

    private FeedbackResponseDto assembleHybridResponse(
            String promptId,
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            GeneratedSections generatedSections
    ) {
        List<GrammarFeedbackItemDto> grammarFeedback = generatedSections.grammarFeedback().isEmpty()
                ? toGrammarFeedback(diagnosis)
                : generatedSections.grammarFeedback();
        String correctedAnswer = firstNonBlank(
                diagnosis.minimalCorrection(),
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                learnerAnswer
        );
        List<InlineFeedbackSegmentDto> inlineFeedback = buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, correctedAnswer);
        boolean loopComplete = isLoopComplete(
                learnerAnswer,
                diagnosis,
                answerProfile,
                generatedSections.corrections(),
                grammarFeedback
        );
        String completionMessage = buildReadableCompletionMessage(
                learnerAnswer,
                diagnosis,
                answerProfile,
                generatedSections.corrections(),
                grammarFeedback
        );
        List<FeedbackSecondaryLearningPointDto> fixPoints = resolveGeneratedFixPoints(generatedSections);
        List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints = !generatedSections.secondaryLearningPoints().isEmpty()
                ? generatedSections.secondaryLearningPoints()
                : deriveSecondaryLearningPointsFromFixPoints(fixPoints);
        FeedbackPrimaryFixDto primaryFix = generatedSections.primaryFix() != null
                ? generatedSections.primaryFix()
                : derivePrimaryFixFromFixPoints(fixPoints);
        FeedbackUiDto generatedUi = (!secondaryLearningPoints.isEmpty()
                || !fixPoints.isEmpty()
                || generatedSections.nextStepPractice() != null
                || !generatedSections.rewriteSuggestions().isEmpty())
                ? new FeedbackUiDto(
                null,
                primaryFix,
                null,
                secondaryLearningPoints,
                fixPoints,
                generatedSections.nextStepPractice(),
                generatedSections.rewriteSuggestions(),
                null,
                null
        )
                : null;
        return new FeedbackResponseDto(
                promptId,
                INTERNAL_AUTHORITATIVE_SESSION_ID,
                0,
                diagnosis.score(),
                loopComplete,
                completionMessage,
                null,
                generatedSections.strengths(),
                generatedSections.corrections(),
                inlineFeedback,
                grammarFeedback,
                correctedAnswer,
                toRefinementExpressionDtos(generatedSections.refinementExpressions()),
                generatedSections.modelAnswer(),
                generatedSections.modelAnswerKo(),
                null,
                generatedSections.usedExpressions(),
                generatedUi
        );
    }

    private List<FeedbackSecondaryLearningPointDto> toFixPoints(
            FeedbackPrimaryFixDto primaryFix,
            List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints
    ) {
        List<FeedbackSecondaryLearningPointDto> fixPoints = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();

        addFixPoint(fixPoints, seen, toFixPoint(primaryFix));
        if (secondaryLearningPoints != null) {
            for (FeedbackSecondaryLearningPointDto point : secondaryLearningPoints) {
                if (point == null || "EXPRESSION".equals(trimToNull(point.kind()))) {
                    continue;
                }
                addFixPoint(fixPoints, seen, point);
            }
        }

        return List.copyOf(fixPoints);
    }

    private List<FeedbackSecondaryLearningPointDto> resolveGeneratedFixPoints(GeneratedSections generatedSections) {
        if (generatedSections == null) {
            return List.of();
        }
        if (generatedSections.fixPoints() != null && !generatedSections.fixPoints().isEmpty()) {
            return List.copyOf(generatedSections.fixPoints());
        }
        return toFixPoints(generatedSections.primaryFix(), generatedSections.secondaryLearningPoints());
    }

    private FeedbackSecondaryLearningPointDto toFixPoint(FeedbackPrimaryFixDto primaryFix) {
        if (primaryFix == null) {
            return null;
        }

        String title = trimToNull(primaryFix.title());
        String instruction = trimToNull(primaryFix.instruction());
        String originalText = trimToNull(primaryFix.originalText());
        String revisedText = trimToNull(primaryFix.revisedText());
        String reasonKo = trimToNull(primaryFix.reasonKo());
        if (title == null
                && instruction == null
                && originalText == null
                && revisedText == null
                && reasonKo == null) {
            return null;
        }

        String kind = originalText != null && revisedText != null ? "GRAMMAR" : "CORRECTION";
        return new FeedbackSecondaryLearningPointDto(
                kind,
                title,
                instruction,
                reasonKo,
                originalText,
                revisedText,
                null,
                null,
                null,
                null
        );
    }

    private void addFixPoint(
            List<FeedbackSecondaryLearningPointDto> fixPoints,
            Set<String> seen,
            FeedbackSecondaryLearningPointDto point
    ) {
        if (point == null) {
            return;
        }
        String key = normalizeForComparison(
                firstNonBlank(point.kind(), "")
                        + "|" + firstNonBlank(point.title(), "")
                        + "|" + firstNonBlank(point.headline(), "")
                        + "|" + firstNonBlank(point.supportText(), "")
                        + "|" + firstNonBlank(point.originalText(), "")
                        + "|" + firstNonBlank(point.revisedText(), "")
        );
        if (key.isBlank() || !seen.add(key)) {
            return;
        }
        fixPoints.add(point);
    }

    private GeneratedSections buildDeterministicFallbackSections(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy
    ) {
        String correctedBase = firstNonBlank(
                diagnosis.minimalCorrection(),
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton()
        );
        AnswerBand answerBand = diagnosis.answerBand();
        List<String> strengths = sectionPolicy.showStrengths()
                ? limit(
                feedbackSectionValidators.dedupeStrengths(resolveKoreanFallbackStrengths(diagnosis, answerProfile)),
                sectionPolicy.maxStrengthCount()
        )
                : List.of();
        List<CorrectionDto> corrections = sectionPolicy.showImprovement()
                ? sanitizeCorrections(singleCorrectionList(
                deterministicSectionGenerator.buildSingleImprovement(prompt, answerProfile, answerBand, correctedBase)
        ))
                : List.of();
        List<GrammarFeedbackItemDto> grammarFeedback = sectionPolicy.showGrammar()
                ? sanitizeGrammarFeedback(toGrammarFeedback(diagnosis), diagnosis, answerProfile)
                : List.of();
        List<RefinementCard> refinementExpressions = sectionPolicy.showRefinement()
                ? limit(
                sortRefinementCardsByFocus(
                        feedbackSectionValidators.validateRefinementCardsDomain(
                                deterministicSectionGenerator.buildRepairRefinements(correctedBase, sectionPolicy.maxRefinementCount())
                        ),
                        sectionPolicy.refinementFocus(),
                        learnerAnswer
                ),
                sectionPolicy.maxRefinementCount()
        )
                : List.of();
        FeedbackSectionValidators.ModelAnswerContent modelAnswerContent = sectionPolicy.showModelAnswer()
                ? feedbackSectionValidators.guardModelAnswer(
                learnerAnswer,
                deterministicSectionGenerator.buildOneStepUpModelAnswer(
                        prompt,
                        answerProfile,
                        answerBand,
                        correctedBase,
                        null
                ),
                null,
                sectionPolicy.maxModelAnswerSentences(),
                sectionPolicy.modelAnswerMode()
        )
                : new FeedbackSectionValidators.ModelAnswerContent(null, null);
        return new GeneratedSections(null, strengths, null, null, grammarFeedback, corrections, refinementExpressions, null,
                modelAnswerContent.modelAnswer(), modelAnswerContent.modelAnswerKo(), List.of());
    }

    private GeneratedSections mergeWithMinimalFallback(
            GeneratedSections generatedSections,
            GeneratedSections fallbackSections,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy
    ) {
        if (generatedSections == null) {
            return fallbackSections;
        }
        if (fallbackSections == null) {
            return generatedSections;
        }

        List<GrammarFeedbackItemDto> grammarFeedback = generatedSections.grammarFeedback();
        if (grammarFeedback.isEmpty()
                && shouldRequireGrammarSection(diagnosis, answerProfile, sectionPolicy)) {
            grammarFeedback = fallbackSections.grammarFeedback();
        }

        return new GeneratedSections(
                null,
                generatedSections.strengths(),
                generatedSections.focusCard() != null ? generatedSections.focusCard() : fallbackSections.focusCard(),
                generatedSections.primaryFix() != null ? generatedSections.primaryFix() : fallbackSections.primaryFix(),
                grammarFeedback,
                generatedSections.corrections(),
                generatedSections.refinementExpressions(),
                null,
                generatedSections.modelAnswer(),
                generatedSections.modelAnswerKo(),
                generatedSections.usedExpressions(),
                !resolveGeneratedFixPoints(generatedSections).isEmpty()
                        ? resolveGeneratedFixPoints(generatedSections)
                        : resolveGeneratedFixPoints(fallbackSections),
                !generatedSections.secondaryLearningPoints().isEmpty()
                        ? generatedSections.secondaryLearningPoints()
                        : fallbackSections.secondaryLearningPoints(),
                generatedSections.nextStepPractice() != null
                        ? generatedSections.nextStepPractice()
                        : fallbackSections.nextStepPractice(),
                !generatedSections.rewriteSuggestions().isEmpty()
                        ? generatedSections.rewriteSuggestions()
                        : fallbackSections.rewriteSuggestions()
        );
    }

    private List<CorrectionDto> singleCorrectionList(CorrectionDto correction) {
        return correction == null ? List.of() : List.of(correction);
    }

    private List<String> resolveDisplayableStrengths(
            List<String> generatedStrengths,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        List<String> koreanStrengths = feedbackSectionValidators.filterKoreanStrengths(
                feedbackSectionValidators.dedupeStrengths(generatedStrengths)
        );
        if (!koreanStrengths.isEmpty()) {
            return koreanStrengths;
        }
        return feedbackSectionValidators.dedupeStrengths(resolveKoreanFallbackStrengths(diagnosis, answerProfile));
    }

    private List<String> resolveKoreanFallbackStrengths(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        if (diagnosis != null && diagnosis.finishable()) {
            return List.of("?꿔꺂???熬곻퐢利???꿔꺂?????롫?????????????????????怨???????ㅿ폎????醫딆┫?熬????");
        }
        if (answerProfile != null && answerProfile.content() != null && answerProfile.content().signals() != null) {
            ContentSignals signals = answerProfile.content().signals();
            if (signals.hasMainAnswer() && signals.hasReason()) {
                return List.of("???????????????????壤굿??좊㎧ ??嶺?筌???????????щ였???");
            }
            if (signals.hasMainAnswer() && signals.hasActivity()) {
                return List.of("???繹먮냱議?????β뼯爰귨㎘?????ㅻ깹壤???鶯ㅺ동????????????????ㅿ폑??????⑥ろ맖??");
            }
            if (signals.hasMainAnswer()) {
                return List.of("?꿔꺂???熬곻퐢利???꿔꺂??????????????????곗뒩泳?봺異????怨뺤퓡 ?꿔꺂???癲????ㅼ굡??");
            }
        }
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.OFF_TOPIC) {
            return List.of("?꿔꺂???熬곻퐢利???꿔꺂????????紐꾪닓 ?熬곣뫖?삥납????? ??⑤슢???????");
        }
        return List.of("?꿔꺂???熬곻퐢利???꿔꺂??????????????산뭐????熬곣뫖?삥납???????⑤슢???????");
    }

    private List<String> resolveFallbackStrengths(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        if (diagnosis != null && diagnosis.finishable()) {
            return List.of("?꿔꺂???熬곻퐢利???꿔꺂?????롫??????썹땟????????????????怨???????ㅿ폎????醫딆┫?熬????");
        }
        if (answerProfile != null && answerProfile.content() != null && answerProfile.content().signals() != null) {
            ContentSignals signals = answerProfile.content().signals();
            if (signals.hasMainAnswer() && signals.hasReason()) {
                return List.of("?꿔꺂???熬곻퐢利???꿔꺂????????雅?????????壤굿??좊㎧ ?꿔꺂??????????????щ였???");
            }
            if (signals.hasMainAnswer() && signals.hasActivity()) {
                return List.of("???戮?뜪??? ?????곗맫 ?熬곣뫖?삥납???????壤굿??좊㎧ ??嶺?筌???????????щ였???");
            }
            if (signals.hasMainAnswer()) {
                return List.of("?꿔꺂???熬곻퐢利???꿔꺂??????????????????곗뒩泳?봺異????怨뺤퓡 ?꿔꺂??????????????щ였???");
            }
        }
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.OFF_TOPIC) {
            return List.of("???????⑤슢???????嶺뚮㉡??????⑤슢???????");
        }
        return List.of("?꿔꺂???熬곻퐢利??????????紐꾪닓 ?熬곣뫖?삥납????? ????? ????⑥ろ맖??");
    }

    private FeedbackDiagnosisResult buildDeterministicDiagnosis(
            PromptDto prompt,
            String learnerAnswer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    ) {
        AnswerContext context = new AnswerContext(
                prompt.questionEn(),
                prompt.difficulty(),
                attemptIndex,
                learnerAnswer,
                previousAnswer,
                
                toPromptHintRefs(hints),
                prompt.taskMeta(),
                prompt.topicCategory(),
                prompt.topicDetail()
        );
        AnswerProfile baseProfile = answerProfileBuilder.build(context, null, List.of(), List.of());
        String minimalCorrection = deterministicCorrectionResolver.resolveMinimalCorrection(
                prompt,
                learnerAnswer,
                baseProfile,
                baseProfile.grammar() == null ? null : baseProfile.grammar().minimalCorrection()
        );
        List<InlineFeedbackSegmentDto> deterministicInline = buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, minimalCorrection);
        AnswerProfile diagnosedProfile = minimalCorrection == null
                ? baseProfile
                : answerProfileBuilder.build(context, minimalCorrection, deterministicInline, List.of());
        return new FeedbackDiagnosisResult(
                deterministicScore(diagnosedProfile),
                diagnosedProfile.task().answerBand(),
                diagnosedProfile.task().taskCompletion(),
                diagnosedProfile.task().onTopic(),
                diagnosedProfile.task().finishable(),
                diagnosedProfile.grammar().severity(),
                toDeterministicGrammarIssues(diagnosedProfile.grammar().issues()),
                firstNonBlank(minimalCorrection, diagnosedProfile.grammar().minimalCorrection()),
                diagnosedProfile.rewrite().primaryIssueCode(),
                diagnosedProfile.rewrite().secondaryIssueCode(),
                diagnosedProfile.rewrite().target(),
                diagnosedProfile.rewrite().expansionBudget(),
                diagnosedProfile.rewrite().regressionSensitiveFacts()
        );
    }

    private AnswerProfile buildDiagnosedProfile(
            PromptDto prompt,
            String learnerAnswer,
            List<PromptHintDto> hints,
            FeedbackDiagnosisResult diagnosis,
            int attemptIndex,
            String previousAnswer
    ) {
        List<GrammarFeedbackItemDto> grammarFeedback = toGrammarFeedback(diagnosis);
        AnswerContext context = new AnswerContext(
                prompt.questionEn(),
                prompt.difficulty(),
                attemptIndex,
                learnerAnswer,
                previousAnswer,
                
                toPromptHintRefs(hints),
                prompt.taskMeta(),
                prompt.topicCategory(),
                prompt.topicDetail()
        );
        AnswerProfile baseProfile = answerProfileBuilder.build(
                context,
                diagnosis.minimalCorrection(),
                buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, diagnosis.minimalCorrection()),
                grammarFeedback
        );
        TaskProfile mergedTask = new TaskProfile(
                diagnosis.onTopic(),
                diagnosis.taskCompletion(),
                diagnosis.answerBand(),
                diagnosis.finishable()
        );
        List<GrammarIssue> diagnosisIssues = toGrammarIssues(diagnosis);
        GrammarProfile mergedGrammar = new GrammarProfile(
                maxSeverity(baseProfile.grammar().severity(), diagnosis.grammarSeverity()),
                diagnosisIssues.isEmpty() ? baseProfile.grammar().issues() : diagnosisIssues,
                firstNonBlank(diagnosis.minimalCorrection(), baseProfile.grammar().minimalCorrection()),
                diagnosis.minimalCorrection() != null
        );
        RewriteProfile mergedRewrite = new RewriteProfile(
                firstNonBlank(diagnosis.primaryIssueCode(), baseProfile.rewrite().primaryIssueCode()),
                diagnosis.secondaryIssueCode() == null ? baseProfile.rewrite().secondaryIssueCode() : diagnosis.secondaryIssueCode(),
                diagnosis.rewriteTarget() == null ? baseProfile.rewrite().target() : diagnosis.rewriteTarget(),
                diagnosis.expansionBudget(),
                diagnosis.regressionSensitiveFacts(),
                baseProfile.rewrite().progressDelta()
        );
        return new AnswerProfile(mergedTask, mergedGrammar, baseProfile.content(), mergedRewrite);
    }

    private int deterministicScore(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.task() == null) {
            return 60;
        }
        return switch (answerProfile.task().answerBand()) {
            case OFF_TOPIC -> 35;
            case TOO_SHORT_FRAGMENT -> 45;
            case GRAMMAR_BLOCKING -> 58;
            case CONTENT_THIN -> 72;
            case SHORT_BUT_VALID -> 78;
            case NATURAL_BUT_BASIC -> answerProfile.task().finishable() ? 91 : 86;
        };
    }

    private int resolveDiagnosisScore(
            JsonNode scoreNode,
            AnswerBand answerBand,
            TaskCompletion taskCompletion,
            boolean onTopic,
            boolean finishable,
            GrammarSeverity grammarSeverity
    ) {
        if (scoreNode != null && scoreNode.isInt()) {
            return scoreNode.asInt();
        }
        if (!onTopic || answerBand == AnswerBand.OFF_TOPIC) {
            return 35;
        }
        if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            return 45;
        }
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING || grammarSeverity == GrammarSeverity.MAJOR) {
            return 58;
        }
        if (taskCompletion != TaskCompletion.FULL) {
            return 62;
        }
        return switch (answerBand) {
            case CONTENT_THIN -> 72;
            case SHORT_BUT_VALID -> finishable ? 82 : 78;
            case NATURAL_BUT_BASIC -> finishable ? 91 : 86;
            default -> finishable ? 80 : 70;
        };
    }

    private List<DiagnosedGrammarIssue> toDeterministicGrammarIssues(List<GrammarIssue> issues) {
        if (issues == null || issues.isEmpty()) {
            return List.of();
        }
        List<DiagnosedGrammarIssue> diagnosedIssues = new ArrayList<>();
        for (GrammarIssue issue : issues) {
            if (issue == null || issue.span().isBlank() || issue.correction().isBlank()) {
                continue;
            }
            diagnosedIssues.add(new DiagnosedGrammarIssue(
                    issue.code(),
                    issue.span(),
                    issue.correction(),
                    deterministicReasonForGrammarIssue(issue.code()),
                    issue.blocksMeaning(),
                    issue.severity()
            ));
        }
        return List.copyOf(diagnosedIssues);
    }

    private String deterministicReasonForGrammarIssue(String code) {
        String safeCode = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        return switch (safeCode) {
            case "VERB_PATTERN" -> "?????눫??癲ル슢怡녜뇡?????????????怨????꿔꺂????????녿뮝???ル튉??";
            case "PREPOSITION" -> "????썹땟???? ???癲ル슢怡녜뇡???????????怨???????ㅿ폎?????녿뮝???ル튉??";
            case "ARTICLE" -> "???援온??????嶺뚮슣?쒙쭛???? ????????怨????꿔꺂????????녿뮝???ル튉??";
            case "AGREEMENT" -> "???녿뮝???쀬쟼?? ???????癲ル슢怡녜뇡???????????怨????꿔꺂????????녿뮝???ル튉??";
            case "TENSE_ALIGNMENT" -> "??嶺뚮????????戮?뜤????꿔꺂?????롫??????????怨????꿔꺂????????녿뮝???ル튉??";
            case "POINT_OF_VIEW_ALIGNMENT" -> "???녿뮝???쀬쟼?? ??嶺뚮????????戮?뜤????꿔꺂?????롫???꿔꺂????????녿뮝???ル튉??";
            default -> "??? ??????????ㅺ강?몃벝????? ?????노덫???????낇뀘????곗뒩泳?벩竊?????????怨??????쒙쭫?????녿뮝???ル튉??";
        };
    }

    List<InlineFeedbackSegmentDto> buildPreciseInlineFeedback(String originalText, String revisedText) {
        String safeOriginalText = originalText == null ? "" : originalText;
        String safeRevisedText = revisedText == null ? "" : revisedText;

        if (safeOriginalText.isBlank() && safeRevisedText.isBlank()) {
            return List.of();
        }

        if (safeOriginalText.isBlank()) {
            return List.of(new InlineFeedbackSegmentDto("ADD", "", safeRevisedText));
        }

        if (safeRevisedText.isBlank()) {
            return List.of(new InlineFeedbackSegmentDto("REMOVE", safeOriginalText, ""));
        }

        if (safeOriginalText.equals(safeRevisedText)) {
            return List.of(new InlineFeedbackSegmentDto("KEEP", safeOriginalText, safeOriginalText));
        }

        List<InlineFeedbackSegmentDto> expanded = expandReplaceSegment(safeOriginalText, safeRevisedText);
        if (expanded != null && !expanded.isEmpty()) {
            return mergeSegments(expanded);
        }

        return List.of(new InlineFeedbackSegmentDto("REPLACE", safeOriginalText, safeRevisedText));
    }

    private String buildDiagnosisRequestBody(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    ) throws IOException {
        Map<String, Object> schema = Map.ofEntries(
                Map.entry("type", "object"),
                Map.entry("additionalProperties", false),
                Map.entry("properties", Map.ofEntries(
                        Map.entry("score", Map.of("type", List.of("integer", "null"))),
                        Map.entry("answerBand", Map.of("type", "string", "enum", List.of(
                                "TOO_SHORT_FRAGMENT",
                                "SHORT_BUT_VALID",
                                "GRAMMAR_BLOCKING",
                                "CONTENT_THIN",
                                "NATURAL_BUT_BASIC",
                                "OFF_TOPIC"
                        ))),
                        Map.entry("taskCompletion", Map.of("type", "string", "enum", List.of("FULL", "PARTIAL", "MISS"))),
                        Map.entry("onTopic", Map.of("type", "boolean")),
                        Map.entry("finishable", Map.of("type", "boolean")),
                        Map.entry("grammarSeverity", Map.of("type", "string", "enum", List.of("NONE", "MINOR", "MODERATE", "MAJOR"))),
                        Map.entry("minimalCorrection", Map.of("type", List.of("string", "null"))),
                        Map.entry("primaryIssueCode", Map.of("type", "string")),
                        Map.entry("secondaryIssueCode", Map.of("type", List.of("string", "null"))),
                        Map.entry("rewriteTarget", Map.of(
                                "type", "object",
                                "additionalProperties", false,
                                "properties", Map.of(
                                        "action", Map.of("type", "string", "enum", REWRITE_TARGET_ACTION_ENUM),
                                        "skeleton", Map.of("type", List.of("string", "null")),
                                        "maxNewSentenceCount", Map.of("type", "integer")
                                ),
                                "required", List.of("action", "skeleton", "maxNewSentenceCount")
                        )),
                        Map.entry("expansionBudget", Map.of("type", "string", "enum", List.of(
                                "NONE",
                                "ONE_DETAIL",
                                "ONE_SUPPORT_SENTENCE"
                        ))),
                        Map.entry("regressionSensitiveFacts", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        )),
                        Map.entry("grammarIssues", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "code", Map.of("type", "string"),
                                                "span", Map.of("type", "string"),
                                                "correction", Map.of("type", "string"),
                                                "reasonKo", Map.of("type", "string"),
                                                "blocksMeaning", Map.of("type", "boolean"),
                                                "severity", Map.of("type", "string", "enum", List.of("NONE", "MINOR", "MODERATE", "MAJOR"))
                                        ),
                                        "required", List.of("code", "span", "correction", "reasonKo", "blocksMeaning", "severity")
                                )
                        ))
                )),
                Map.entry("required", List.of(
                        "answerBand",
                        "taskCompletion",
                        "onTopic",
                        "finishable",
                        "grammarSeverity",
                        "minimalCorrection",
                        "primaryIssueCode",
                        "secondaryIssueCode",
                        "rewriteTarget",
                        "expansionBudget",
                        "regressionSensitiveFacts",
                        "grammarIssues"
                ))
        );
        return buildStructuredRequestBody(
                diagnosisModel,
                buildDiagnosisPrompt(prompt, answer, hints, attemptIndex, previousAnswer),
                "english_answer_diagnosis",
                schema
        );
    }

    private String buildGenerationRequestBody(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy,
            int attemptIndex,
            String previousAnswer,
            List<SectionKey> requestedSections,
            List<ValidationFailureCode> failureCodes,
            GeneratedSections previousSections
    ) throws IOException {
        Map<String, Object> schema = Map.ofEntries(
                Map.entry("type", "object"),
                Map.entry("additionalProperties", false),
                Map.entry("properties", Map.ofEntries(
                        Map.entry("strengths", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        )),
                        Map.entry("fixPoints", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "kind", Map.of("type", List.of("string", "null")),
                                                "title", Map.of("type", List.of("string", "null")),
                                                "headline", Map.of("type", List.of("string", "null")),
                                                "supportText", Map.of("type", List.of("string", "null")),
                                                "originalText", Map.of("type", List.of("string", "null")),
                                                "revisedText", Map.of("type", List.of("string", "null")),
                                                "meaningKo", Map.of("type", List.of("string", "null")),
                                                "guidanceKo", Map.of("type", List.of("string", "null")),
                                                "exampleEn", Map.of("type", List.of("string", "null")),
                                                "exampleKo", Map.of("type", List.of("string", "null"))
                                        ),
                                        "required", List.of(
                                                "kind",
                                                "title",
                                                "headline",
                                                "supportText",
                                                "originalText",
                                                "revisedText",
                                                "meaningKo",
                                                "guidanceKo",
                                                "exampleEn",
                                                "exampleKo"
                                        )
                                )
                        )),
                        Map.entry("secondaryLearningPoints", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "kind", Map.of("type", List.of("string", "null")),
                                                "title", Map.of("type", List.of("string", "null")),
                                                "headline", Map.of("type", List.of("string", "null")),
                                                "supportText", Map.of("type", List.of("string", "null")),
                                                "originalText", Map.of("type", List.of("string", "null")),
                                                "revisedText", Map.of("type", List.of("string", "null")),
                                                "meaningKo", Map.of("type", List.of("string", "null")),
                                                "guidanceKo", Map.of("type", List.of("string", "null")),
                                                "exampleEn", Map.of("type", List.of("string", "null")),
                                                "exampleKo", Map.of("type", List.of("string", "null"))
                                        ),
                                        "required", List.of(
                                                "kind",
                                                "title",
                                                "headline",
                                                "supportText",
                                                "originalText",
                                                "revisedText",
                                                "meaningKo",
                                                "guidanceKo",
                                                "exampleEn",
                                                "exampleKo"
                                        )
                                )
                        )),
                        Map.entry("usedExpressions", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "expression", Map.of("type", "string"),
                                                "usageTip", Map.of("type", "string")
                                        ),
                                        "required", List.of("expression", "usageTip")
                                )
                        )),
                        Map.entry("refinementExpressions", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "expression", Map.of("type", "string"),
                                                "guidanceKo", Map.of("type", "string"),
                                                "exampleEn", Map.of("type", "string"),
                                                "exampleKo", Map.of("type", List.of("string", "null")),
                                                "meaningKo", Map.of("type", List.of("string", "null"))
                                        ),
                                        "required", List.of("expression", "guidanceKo", "exampleEn", "exampleKo", "meaningKo")
                                )
                        )),
                        Map.entry("nextStepPractice", Map.of(
                                "type", List.of("object", "null"),
                                "additionalProperties", false,
                                "properties", Map.ofEntries(
                                        Map.entry("kind", Map.of("type", List.of("string", "null"))),
                                        Map.entry("title", Map.of("type", List.of("string", "null"))),
                                        Map.entry("headline", Map.of("type", List.of("string", "null"))),
                                        Map.entry("supportText", Map.of("type", List.of("string", "null"))),
                                        Map.entry("originalText", Map.of("type", List.of("string", "null"))),
                                        Map.entry("revisedText", Map.of("type", List.of("string", "null"))),
                                        Map.entry("meaningKo", Map.of("type", List.of("string", "null"))),
                                        Map.entry("guidanceKo", Map.of("type", List.of("string", "null"))),
                                        Map.entry("exampleEn", Map.of("type", List.of("string", "null"))),
                                        Map.entry("exampleKo", Map.of("type", List.of("string", "null"))),
                                        Map.entry("ctaLabel", Map.of("type", List.of("string", "null"))),
                                        Map.entry("optionalTone", Map.of("type", List.of("boolean", "null")))
                                ),
                                "required", List.of(
                                        "kind",
                                        "title",
                                        "headline",
                                        "supportText",
                                        "originalText",
                                        "revisedText",
                                        "meaningKo",
                                        "guidanceKo",
                                        "exampleEn",
                                        "exampleKo",
                                        "ctaLabel",
                                        "optionalTone"
                                )
                        )),
                        Map.entry("rewriteSuggestions", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "english", Map.of("type", "string"),
                                                "meaningKo", Map.of("type", List.of("string", "null")),
                                                "noteKo", Map.of("type", List.of("string", "null"))
                                        ),
                                        "required", List.of("english", "meaningKo", "noteKo")
                                )
                        )),
                        Map.entry("modelAnswer", Map.of("type", List.of("string", "null"))),
                        Map.entry("modelAnswerKo", Map.of("type", List.of("string", "null")))
                )),
                Map.entry("required", List.of(
                        "strengths",
                        "fixPoints",
                        "usedExpressions",
                        "refinementExpressions",
                        "nextStepPractice",
                        "rewriteSuggestions",
                        "modelAnswer",
                        "modelAnswerKo"
                ))
        );
        return buildStructuredRequestBody(
                model,
                buildGenerationPrompt(
                        prompt,
                        answer,
                        hints,
                        diagnosis,
                        answerProfile,
                        sectionPolicy,
                        attemptIndex,
                        previousAnswer,
                        requestedSections,
                        failureCodes,
                        previousSections
                ),
                "english_feedback_sections",
                schema
        );
    }

    private String buildStructuredRequestBody(String requestModel, String promptText, String schemaName, Map<String, Object> schema) throws IOException {
        return OpenAiStructuredOutputSupport.buildResponsesRequestBody(
                objectMapper,
                requestModel,
                promptText,
                schemaName,
                schema,
                reasoningEffort
        );
    }

    private String buildDiagnosisPrompt(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer
    ) {
        String coachProfileText = PromptOpenAiContextFormatter.formatCoachProfile(prompt);
        String coachProfileGuidance = PromptOpenAiContextFormatter.formatCoachProfileInstructions(prompt);
        String hintText = PromptOpenAiContextFormatter.formatPromptHints(hints);
        return """
                You are diagnosing an English learner answer for a rewrite-first coaching app.
                Return valid JSON only.

                Your job is diagnosis only.
                Do not generate strengths, corrections, refinement cards, rewrite guide, or model answer.

                Diagnosis rules:
                - Diagnosis should support a rewrite-first screen. Choose one dominant next step that can drive the Top Status Card and Rewrite Guide.
                - Choose exactly one answerBand from: TOO_SHORT_FRAGMENT, SHORT_BUT_VALID, GRAMMAR_BLOCKING, CONTENT_THIN, NATURAL_BUT_BASIC, OFF_TOPIC.
                - answerBand must reflect what the learner most needs next, not what sounds harshest.
                - primaryIssueCode must name the single top rewrite goal, not a vague category list.
                - minimalCorrection must preserve learner meaning and structure as much as possible.
                - minimalCorrection must fix only local grammar, usage, word form, determiner, preposition, capitalization, spacing, or punctuation.
                - Do not add new examples, new plans, or unsupported lifestyle details in minimalCorrection.
                - If the answer is already locally good enough, minimalCorrection may be null.
                - grammarIssues must explain only issues that are directly reflected in minimalCorrection or the learner answer.
                - grammarIssues.reasonKo must be concise Korean, aligned with the chosen correction, and must not mention alternative structures that you did not choose.
                - score is optional metadata only. If you include it, use a broad coarse estimate. Never let score override answerBand, finishable, or rewriteTarget decisions.
                - finishable should be true only when the learner answer already reads like an acceptable final submission, not merely a correct idea sketch.
                - Do not keep finishable false only because the answer could be longer, more polished, or could support another optional one-step-up model answer.
                - For routine or daily-life prompts, one or two clear activities with a natural time flow can already be finishable if the clauses themselves are natural enough to submit.
                - If a required reason, detail, or activity clause still needs more than one small local repair, keep finishable=false.
                - Do not set finishable=true when a required clause still has missing be-verbs, missing infinitive markers, broken complement structure, or other clearly incomplete sentence framing.
                - An answer may be on-topic and task-complete but still not finishable if the required reason/detail clause sounds malformed as a final sentence.
                - If attemptIndex >= 2 and the learner clearly added a concrete detail, activity, reason, or sequence compared with previousAnswer, prefer finishable=true only when no blocking grammar or malformed required clause still remains.
                - NATURAL_BUT_BASIC is appropriate when the answer is already clear, on-topic, complete enough for the loop to end, and needs at most one very small local cleanup.
                - rewriteTarget must give a single action and corrected skeleton for the next rewrite.
                - rewriteTarget.action must be exactly one of: MAKE_ON_TOPIC, STATE_MAIN_ANSWER, FIX_BLOCKING_GRAMMAR, FIX_LOCAL_GRAMMAR, ADD_REASON, ADD_EXAMPLE, ADD_DETAIL, IMPROVE_NATURALNESS.
                - rewriteTarget.skeleton should be starter-length and directly reusable in a rewrite guide, not a long model answer.
                - regressionSensitiveFacts must list short factual spans from the learner answer that later generations must preserve.
                - expansionBudget should be NONE, ONE_DETAIL, or ONE_SUPPORT_SENTENCE depending on how much later generation may safely add.
                - Prefer CONTENT_THIN or SHORT_BUT_VALID over GRAMMAR_BLOCKING when the answer mainly needs one minor correction plus a little expansion.
                - Prefer GRAMMAR_BLOCKING only when grammar seriously blocks meaning or sentence structure.
                - If attemptIndex >= 2, use previousAnswer only to detect progress and remaining issues. Do not repeat already-resolved grammar corrections as the primary issue.

                Attempt context:
                - attemptIndex: %s
                - previousAnswer: %s

                Prompt topic: %s
                Difficulty: %s
                Question in English: %s
                Question in Korean: %s
                Speaking tip: %s
                Prompt coaching profile:
                %s
                Prompt coaching strategy:
                %s
                Prompt hints:
                %s

                Learner answer:
                %s
                """.formatted(
                attemptIndex,
                previousAnswer == null || previousAnswer.isBlank() ? "null" : previousAnswer,
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                coachProfileText,
                coachProfileGuidance,
                hintText,
                answer
        );
    }

    private String buildGenerationPrompt(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy,
            int attemptIndex,
            String previousAnswer,
            List<SectionKey> requestedSections,
            List<ValidationFailureCode> failureCodes,
            GeneratedSections previousSections
    ) throws IOException {
        String coachProfileText = PromptOpenAiContextFormatter.formatCoachProfile(prompt);
        String coachProfileGuidance = PromptOpenAiContextFormatter.formatCoachProfileInstructions(prompt);
        String hintText = PromptOpenAiContextFormatter.formatPromptHints(hints);
        String requestedSectionText = formatRequestedSectionsForPrompt(requestedSections);
        String retryFailures = failureCodes == null || failureCodes.isEmpty()
                ? "- none"
                : "- " + failureCodes.stream().map(Enum::name).reduce((left, right) -> left + ", " + right).orElse("");
        String retrySpecificInstructions = buildRetrySpecificInstructionsV2(failureCodes, requestedSections);
        String previousSectionJson = previousSections == null ? "{}" : objectMapper.writeValueAsString(previousSections);
        String bandGuidance = generationBandGuidance(diagnosis.answerBand(), sectionPolicy);
        ProgressDelta progressDelta = answerProfile == null || answerProfile.rewrite() == null
                ? null
                : answerProfile.rewrite().progressDelta();
        String improvedAreas = progressDelta == null ? "[]" : progressDelta.improvedAreas().toString();
        String remainingAreas = progressDelta == null ? "[]" : progressDelta.remainingAreas().toString();

        return """
                You are generating only the selected feedback sections for an English learner.
                Return valid JSON only.

                Backend source of truth:
                - answerBand: %s
                - taskCompletion: %s
                - onTopic: %s
                - finishable: %s
                - grammarSeverity: %s
                - minimalCorrection: %s
                - primaryIssueCode: %s
                - secondaryIssueCode: %s
                - rewriteTarget.action: %s
                - rewriteTarget.skeleton: %s
                - rewriteTarget.maxNewSentenceCount: %s
                - expansionBudget: %s
                - regressionSensitiveFacts: %s
                - requestedSections: %s
                - attemptIndex: %s
                - previousAnswer: %s
                - progress.improvedAreas: %s
                - progress.remainingAreas: %s
                - Prioritize learner focus and clarity over section completeness. It is better to return fewer, sharper items than many overlapping ones.

                General output rules:
                - Never output placeholders such as [verb], [noun], [reason], or unresolved templates.
                - Do not reuse a broken learner phrase in strengths, refinementExpressions, nextStepPractice, or modelAnswer.
                - If requestedSections does not include a section, return [] for arrays or null for strings.
                - Keep Korean fields natural and concise.
                - If attemptIndex >= 2, keep the list focused, but still include any other distinct useful fixPoints that are clearly worth teaching.

                Strengths and usedExpressions rules:
                - strengths must be semantic praise only. Never quote the full raw learner answer unless it is already clean and necessary.
                - strengths should usually be one short Korean line that tells the learner what to keep.
                - usedExpressions should contain at most 2 short reusable learner-used chunks that are already good enough to keep.
                - usedExpressions must not contain long broken spans or whole awkward sentences.
                - usedExpressions.usageTip must be one short Korean note about why the expression is worth keeping.

                fixPoints rules:
                - Generate fixPoints as one UI-ready list instead of splitting the same lesson across multiple fields.
                - Each fixPoints item must teach exactly one concrete correction point.
                - Include every remaining distinct useful fix as a separate fixPoints item instead of stopping after one representative correction.
                - A fixPoints item may use originalText / revisedText / supportText to show a concrete correction pair, or title / headline / supportText to show one anchored instruction card.
                - If a fixPoints item has no originalText / revisedText pair, its headline must still name one concrete anchor phrase, word, connector, or slot the learner should change next.
                - Do not return placeholder-like fixPoints headlines or instructions such as "First thing to fix" or "Fix this one thing first" unless you also name the exact phrase or expression to fix.
                - Do not merge unrelated lessons into one fixPoints item, and do not split the same teaching point across multiple fixPoints items.
                - If the learner answer contains multiple distinct local errors, split them into separate fixPoints items instead of folding them into one revisedText or one broad umbrella note.
                - In particular, teach article/determiner vs plural/singular separately, and teach pronoun agreement vs connector choice separately, when both need correction.

                refinementExpressions rules:
                - refinementExpressions are optional reusable-expression cards beyond fixPoints.
                - Return only genuinely useful, distinct refinementExpressions, and keep expression, meaningKo, guidanceKo, exampleEn, and exampleKo separate.
                - exampleEn must not be identical to expression.

                nextStepPractice rules:
                - nextStepPractice is optional and should represent one genuine next step after the must-fix list, not another copy of a must-fix item.
                - Use nextStepPractice only when there is a locally acceptable base answer or one clearly optional add-on after the must-fix list; otherwise leave it null.
                - nextStepPractice may use the same flexible card fields as fixPoints and does not need to be a blank scaffold.
                - nextStepPractice.title should name one optional next move in short Korean, nextStepPractice.headline should show the actual English move when helpful, and nextStepPractice.supportText should briefly explain the add-on in Korean.
                - If nextStepPractice uses originalText / revisedText, that pair must still teach only one optional improvement point and must not repeat a must-fix lesson already covered in fixPoints.

                rewriteSuggestions rules:
                - rewriteSuggestions are optional helper ideas for nextStepPractice.
                - rewriteSuggestions do not need to fit a blank. They should support the same next step as nextStepPractice with short English phrases, clauses, or example chunks.
                - rewriteSuggestions should usually be 0-3 short English ideas, not long standalone answers.
                - Do not use rewriteSuggestions to restate the whole learner answer or to duplicate the exact same English already shown in nextStepPractice.

                modelAnswer rules:
                - modelAnswer is a one-step-up reference, not another nextStepPractice card.
                - modelAnswer must preserve learner meaning, keep the must-fix lessons from fixPoints, and, when natural, add one optional upgrade from nextStepPractice without reverting a taught correction.
                - Preserve referent, pronoun, and singular/plural agreement taught in fixPoints, and do not switch between plural they and singular it unless one fixPoint explicitly teaches that shift.

                Band-specific guidance:
                %s

                Retry notes:
                %s
                Retry-specific instructions:
                %s
                Previous generated sections JSON:
                %s

                Prompt topic: %s
                Difficulty: %s
                Question in English: %s
                Question in Korean: %s
                Speaking tip: %s
                Prompt coaching profile:
                %s
                Prompt coaching strategy:
                %s
                Prompt hints:
                %s

                Learner answer:
                %s
                """.formatted(
                diagnosis.answerBand().name(),
                diagnosis.taskCompletion().name(),
                diagnosis.onTopic(),
                diagnosis.finishable(),
                diagnosis.grammarSeverity().name(),
                diagnosis.minimalCorrection() == null ? "null" : diagnosis.minimalCorrection(),
                diagnosis.primaryIssueCode(),
                diagnosis.secondaryIssueCode() == null ? "null" : diagnosis.secondaryIssueCode(),
                diagnosis.rewriteTarget() == null ? "" : diagnosis.rewriteTarget().action(),
                diagnosis.rewriteTarget() == null || diagnosis.rewriteTarget().skeleton() == null ? "null" : diagnosis.rewriteTarget().skeleton(),
                diagnosis.rewriteTarget() == null ? 0 : diagnosis.rewriteTarget().maxNewSentenceCount(),
                diagnosis.expansionBudget().name(),
                diagnosis.regressionSensitiveFacts(),
                requestedSectionText,
                attemptIndex,
                previousAnswer == null || previousAnswer.isBlank() ? "null" : previousAnswer,
                improvedAreas,
                remainingAreas,
                bandGuidance,
                retryFailures,
                retrySpecificInstructions,
                previousSectionJson,
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                coachProfileText,
                coachProfileGuidance,
                hintText,
                answer
        );
    }

    private FeedbackDiagnosisResult parseDiagnosisResponse(String body) throws IOException {
        JsonNode node = objectMapper.readTree(extractOutputText(body));
        AnswerBand answerBand = parseAnswerBand(node.path("answerBand").asText("SHORT_BUT_VALID"));
        TaskCompletion taskCompletion = parseTaskCompletion(node.path("taskCompletion").asText("PARTIAL"));
        boolean onTopic = node.path("onTopic").asBoolean(true);
        boolean finishable = node.path("finishable").asBoolean(false);
        GrammarSeverity grammarSeverity = parseGrammarSeverity(node.path("grammarSeverity").asText("NONE"));
        List<DiagnosedGrammarIssue> grammarIssues = new ArrayList<>();
        node.path("grammarIssues").forEach(item -> grammarIssues.add(new DiagnosedGrammarIssue(
                item.path("code").asText(""),
                item.path("span").asText(""),
                item.path("correction").asText(""),
                item.path("reasonKo").asText(""),
                item.path("blocksMeaning").asBoolean(false),
                parseGrammarSeverity(item.path("severity").asText(""))
        )));
        String primaryIssueCode = node.path("primaryIssueCode").asText("");
        JsonNode rewriteTargetNode = node.path("rewriteTarget");
        RewriteTarget rewriteTarget = rewriteTargetNode.isMissingNode()
                ? null
                : new RewriteTarget(
                normalizeRewriteTargetAction(rewriteTargetNode.path("action").asText(""), primaryIssueCode),
                rewriteTargetNode.path("skeleton").isNull() ? null : rewriteTargetNode.path("skeleton").asText(null),
                rewriteTargetNode.path("maxNewSentenceCount").asInt(1)
        );
        List<String> regressionSensitiveFacts = new ArrayList<>();
        node.path("regressionSensitiveFacts").forEach(item -> regressionSensitiveFacts.add(item.asText("")));
        int score = resolveDiagnosisScore(node.path("score"), answerBand, taskCompletion, onTopic, finishable, grammarSeverity);
        return new FeedbackDiagnosisResult(
                score,
                answerBand,
                taskCompletion,
                onTopic,
                finishable,
                grammarSeverity,
                grammarIssues,
                node.path("minimalCorrection").isNull() ? null : node.path("minimalCorrection").asText(null),
                primaryIssueCode,
                node.path("secondaryIssueCode").isNull() ? null : node.path("secondaryIssueCode").asText(null),
                rewriteTarget,
                parseExpansionBudget(node.path("expansionBudget").asText("ONE_DETAIL")),
                regressionSensitiveFacts
        );
    }

    private String normalizeRewriteTargetAction(String rawAction, String primaryIssueCode) {
        String normalized = trimToNull(rawAction);
        if (normalized != null) {
            normalized = normalized
                    .toUpperCase(Locale.ROOT)
                    .replace('-', '_')
                    .replaceAll("\\s+", "_")
                    .replaceAll("[^A-Z_]", "_")
                    .replaceAll("_+", "_")
                    .replaceAll("^_+|_+$", "");
        }
        if (normalized != null && REWRITE_TARGET_ACTION_CODES.contains(normalized)) {
            return normalized;
        }
        return defaultRewriteTargetAction(primaryIssueCode);
    }

    private String defaultRewriteTargetAction(String primaryIssueCode) {
        String normalized = trimToNull(primaryIssueCode);
        if (normalized == null) {
            return "IMPROVE_NATURALNESS";
        }
        return switch (normalized.toUpperCase(Locale.ROOT)) {
            case "OFF_TOPIC_RESPONSE" -> "MAKE_ON_TOPIC";
            case "MISSING_MAIN_TASK", "STATE_MAIN_ANSWER" -> "STATE_MAIN_ANSWER";
            case "FIX_BLOCKING_GRAMMAR" -> "FIX_BLOCKING_GRAMMAR";
            case "FIX_LOCAL_GRAMMAR" -> "FIX_LOCAL_GRAMMAR";
            case "ADD_REASON" -> "ADD_REASON";
            case "ADD_EXAMPLE" -> "ADD_EXAMPLE";
            case "ADD_DETAIL", "MAKE_IT_MORE_SPECIFIC" -> "ADD_DETAIL";
            default -> "IMPROVE_NATURALNESS";
        };
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return trimToNull(node.asText(null));
    }

    private GeneratedSections parseGeneratedSections(String body) throws IOException {
        JsonNode node = objectMapper.readTree(extractOutputText(body));
        List<String> strengths = new ArrayList<>();
        node.path("strengths").forEach(item -> strengths.add(item.asText("")));
        List<FeedbackSecondaryLearningPointDto> fixPoints = new ArrayList<>();
        node.path("fixPoints").forEach(item -> fixPoints.add(new FeedbackSecondaryLearningPointDto(
                item.path("kind").isNull() ? null : item.path("kind").asText(null),
                item.path("title").isNull() ? null : item.path("title").asText(null),
                item.path("headline").isNull() ? null : item.path("headline").asText(null),
                item.path("supportText").isNull() ? null : item.path("supportText").asText(null),
                item.path("originalText").isNull() ? null : item.path("originalText").asText(null),
                item.path("revisedText").isNull() ? null : item.path("revisedText").asText(null),
                item.path("meaningKo").isNull() ? null : item.path("meaningKo").asText(null),
                item.path("guidanceKo").isNull() ? null : item.path("guidanceKo").asText(null),
                item.path("exampleEn").isNull() ? null : item.path("exampleEn").asText(null),
                item.path("exampleKo").isNull() ? null : item.path("exampleKo").asText(null)
        )));
        List<FeedbackSecondaryLearningPointDto> parsedSecondaryLearningPoints = new ArrayList<>();
        node.path("secondaryLearningPoints").forEach(item -> parsedSecondaryLearningPoints.add(new FeedbackSecondaryLearningPointDto(
                item.path("kind").isNull() ? null : item.path("kind").asText(null),
                item.path("title").isNull() ? null : item.path("title").asText(null),
                item.path("headline").isNull() ? null : item.path("headline").asText(null),
                item.path("supportText").isNull() ? null : item.path("supportText").asText(null),
                item.path("originalText").isNull() ? null : item.path("originalText").asText(null),
                item.path("revisedText").isNull() ? null : item.path("revisedText").asText(null),
                item.path("meaningKo").isNull() ? null : item.path("meaningKo").asText(null),
                item.path("guidanceKo").isNull() ? null : item.path("guidanceKo").asText(null),
                item.path("exampleEn").isNull() ? null : item.path("exampleEn").asText(null),
                item.path("exampleKo").isNull() ? null : item.path("exampleKo").asText(null)
        )));
        List<CoachExpressionUsageDto> usedExpressions = new ArrayList<>();
        node.path("usedExpressions").forEach(item -> usedExpressions.add(new CoachExpressionUsageDto(
                item.path("expression").asText(""),
                true,
                "SELF_DISCOVERED",
                null,
                "SELF_DISCOVERED",
                item.path("usageTip").asText("")
        )));
        List<RefinementCard> refinementExpressions = new ArrayList<>();
        node.path("refinementExpressions").forEach(item -> refinementExpressions.add(new RefinementCard(
                item.path("expression").asText(""),
                item.path("guidanceKo").asText(""),
                item.path("exampleEn").asText(""),
                item.path("exampleKo").isNull() ? null : item.path("exampleKo").asText(null),
                item.path("meaningKo").isNull() ? null : item.path("meaningKo").asText(null)
        )));
        List<FeedbackSecondaryLearningPointDto> parsedFixPoints = !fixPoints.isEmpty()
                ? List.copyOf(fixPoints)
                : toFixPoints(null, parsedSecondaryLearningPoints);
        FeedbackPrimaryFixDto primaryFix = derivePrimaryFixFromFixPoints(parsedFixPoints);
        List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints = parsedSecondaryLearningPoints.isEmpty() && !parsedFixPoints.isEmpty()
                ? deriveSecondaryLearningPointsFromFixPoints(parsedFixPoints)
                : parsedSecondaryLearningPoints;
        FeedbackNextStepPracticeDto nextStepPractice = node.path("nextStepPractice").isObject()
                ? new FeedbackNextStepPracticeDto(
                textOrNull(node.path("nextStepPractice").path("kind")),
                textOrNull(node.path("nextStepPractice").path("title")),
                firstNonBlank(
                        textOrNull(node.path("nextStepPractice").path("headline")),
                        textOrNull(node.path("nextStepPractice").path("starter"))
                ),
                firstNonBlank(
                        textOrNull(node.path("nextStepPractice").path("supportText")),
                        textOrNull(node.path("nextStepPractice").path("instruction"))
                ),
                textOrNull(node.path("nextStepPractice").path("originalText")),
                textOrNull(node.path("nextStepPractice").path("revisedText")),
                textOrNull(node.path("nextStepPractice").path("meaningKo")),
                textOrNull(node.path("nextStepPractice").path("guidanceKo")),
                textOrNull(node.path("nextStepPractice").path("exampleEn")),
                textOrNull(node.path("nextStepPractice").path("exampleKo")),
                textOrNull(node.path("nextStepPractice").path("ctaLabel")),
                node.path("nextStepPractice").path("optionalTone").asBoolean(false)
        )
                : null;
        List<FeedbackRewriteSuggestionDto> rewriteSuggestions = new ArrayList<>();
        node.path("rewriteSuggestions").forEach(item -> rewriteSuggestions.add(new FeedbackRewriteSuggestionDto(
                item.path("english").asText(""),
                item.path("meaningKo").isNull() ? null : item.path("meaningKo").asText(null),
                item.path("noteKo").isNull() ? null : item.path("noteKo").asText(null)
        )));
        return new GeneratedSections(
                null,
                strengths,
                null,
                primaryFix,
                List.of(),
                List.of(),
                refinementExpressions,
                null,
                node.path("modelAnswer").isNull() ? null : node.path("modelAnswer").asText(null),
                node.path("modelAnswerKo").isNull() ? null : node.path("modelAnswerKo").asText(null),
                usedExpressions,
                parsedFixPoints,
                secondaryLearningPoints,
                nextStepPractice,
                rewriteSuggestions
        );
    }

    private OpenAiApiResponse sendResponsesRequest(String requestBody) throws IOException, InterruptedException {
        HttpRequest request = OpenAiStructuredOutputSupport.buildResponsesRequest(
                apiUrl,
                apiKey,
                requestBody,
                requestTimeoutSeconds
        );

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new OpenAiApiHttpException(
                    response.statusCode(),
                    "OpenAI API request failed with status " + response.statusCode(),
                    response.body()
            );
        }
        return new OpenAiApiResponse(response.statusCode(), response.body());
    }

    private void logOpenAiFailure(String phase, String promptId, int attemptIndex, Throwable exception) {
        Integer statusCode = null;
        String responseBody = null;
        if (exception instanceof OpenAiApiHttpException httpException) {
            statusCode = httpException.statusCode();
            responseBody = httpException.responseBody();
        } else if (exception instanceof OpenAiResponseParseException parseException) {
            statusCode = parseException.statusCode();
            responseBody = parseException.responseBody();
        } else if (exception instanceof OpenAiResponseParseRuntimeException parseRuntimeException) {
            statusCode = parseRuntimeException.statusCode();
            responseBody = parseRuntimeException.responseBody();
        }

        if (statusCode != null || responseBody != null) {
            LOGGER.warn(
                    "OpenAI {} failed for promptId={}, attemptIndex={}, model={}, exceptionClass={}, status={}, body={}",
                    phase,
                    promptId,
                    attemptIndex,
                    resolveModelForPhase(phase),
                    exception.getClass().getName(),
                    statusCode,
                    abbreviateForLog(responseBody),
                    exception
            );
            return;
        }

        LOGGER.warn(
                "OpenAI {} failed for promptId={}, attemptIndex={}, model={}, exceptionClass={}, message={}",
                phase,
                promptId,
                attemptIndex,
                resolveModelForPhase(phase),
                exception.getClass().getName(),
                exception.getMessage(),
                exception
        );
    }

    private String resolveModelForPhase(String phase) {
        if (phase != null && phase.startsWith("diagnosis")) {
            return diagnosisModel;
        }
        return model;
    }

    private String abbreviateForLog(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return responseBody;
        }
        String normalized = responseBody.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= MAX_LOG_RESPONSE_BODY_LENGTH) {
            return normalized;
        }
        return normalized.substring(0, MAX_LOG_RESPONSE_BODY_LENGTH) + "...(truncated)";
    }

    private String extractOutputText(String body) throws IOException {
        return OpenAiStructuredOutputSupport.extractStructuredOutputText(objectMapper, body);
    }

    private FeedbackSectionAvailability buildGenerationAvailability(
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy
    ) {
        AnswerBand answerBand = answerProfile == null || answerProfile.task() == null || answerProfile.task().answerBand() == null
                ? AnswerBand.SHORT_BUT_VALID
                : answerProfile.task().answerBand();
        TaskCompletion taskCompletion = answerProfile == null || answerProfile.task() == null || answerProfile.task().taskCompletion() == null
                ? TaskCompletion.PARTIAL
                : answerProfile.task().taskCompletion();
        GrammarSeverity grammarSeverity = answerProfile == null || answerProfile.grammar() == null || answerProfile.grammar().severity() == null
                ? GrammarSeverity.NONE
                : answerProfile.grammar().severity();
        String primaryIssueCode = answerProfile == null || answerProfile.rewrite() == null
                ? ""
                : firstNonBlank(answerProfile.rewrite().primaryIssueCode(), "");

        boolean hasGrammarCard = sectionPolicy.showGrammar()
                && (answerBand == AnswerBand.GRAMMAR_BLOCKING
                || grammarSeverity.ordinal() >= GrammarSeverity.MINOR.ordinal()
                || "FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)
                || "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode));
        boolean hasHighValueCorrection = hasGrammarCard
                && (answerBand == AnswerBand.GRAMMAR_BLOCKING
                || grammarSeverity.ordinal() >= GrammarSeverity.MINOR.ordinal()
                || "FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)
                || "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode));
        boolean hasPrimaryFix = hasGrammarCard
                || answerBand == AnswerBand.OFF_TOPIC
                || taskCompletion != TaskCompletion.FULL
                || isDetailPromptPrimaryIssue(primaryIssueCode);

        return new FeedbackSectionAvailability(
                sectionPolicy.showStrengths(),
                hasPrimaryFix,
                hasGrammarCard,
                sectionPolicy.showRewriteGuide(),
                sectionPolicy.showModelAnswer(),
                sectionPolicy.showRefinement(),
                hasHighValueCorrection
        );
    }

    private List<SectionKey> requestedSections(
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy,
            FeedbackScreenPolicy screenPolicy,
            FeedbackSectionAvailability availability
    ) {
        return List.of(
                SectionKey.STRENGTHS,
                SectionKey.USED_EXPRESSIONS,
                SectionKey.PRIMARY_FIX,
                SectionKey.REWRITE_GUIDE,
                SectionKey.MODEL_ANSWER,
                SectionKey.REFINEMENT
        );
    }

    private String formatRequestedSectionsForPrompt(List<SectionKey> requestedSections) {
        List<SectionKey> effectiveSections = (requestedSections == null || requestedSections.isEmpty())
                ? List.of(
                SectionKey.STRENGTHS,
                SectionKey.PRIMARY_FIX,
                SectionKey.REWRITE_GUIDE,
                SectionKey.REFINEMENT,
                SectionKey.MODEL_ANSWER,
                SectionKey.USED_EXPRESSIONS
        )
                : requestedSections;

        return effectiveSections.stream()
                .map(this::formatSectionKeyForPrompt)
                .distinct()
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }

    private String formatSectionKeyForPrompt(SectionKey sectionKey) {
        if (sectionKey == null) {
            return "";
        }
        return switch (sectionKey) {
            case STRENGTHS -> "STRENGTHS";
            case PRIMARY_FIX, IMPROVEMENT -> "FIX_POINTS";
            case GRAMMAR -> "GRAMMAR_FEEDBACK";
            case REFINEMENT -> "REFINEMENT_EXPRESSIONS";
            case SUMMARY -> "SUMMARY";
            case REWRITE_GUIDE -> "NEXT_STEP_PRACTICE";
            case MODEL_ANSWER -> "MODEL_ANSWER";
            case USED_EXPRESSIONS -> "USED_EXPRESSIONS";
        };
    }

    private boolean isRequested(List<SectionKey> requestedSections, SectionKey sectionKey) {
        return requestedSections != null && requestedSections.contains(sectionKey);
    }

    private boolean isDetailPromptPrimaryIssue(String primaryIssueCode) {
        return "ADD_REASON".equals(primaryIssueCode)
                || "ADD_EXAMPLE".equals(primaryIssueCode)
                || "ADD_DETAIL".equals(primaryIssueCode)
                || "MAKE_IT_MORE_SPECIFIC".equals(primaryIssueCode);
    }

    private FeedbackPrimaryFixDto derivePrimaryFixFromFixPoints(List<FeedbackSecondaryLearningPointDto> fixPoints) {
        if (fixPoints == null || fixPoints.isEmpty()) {
            return null;
        }
        for (FeedbackSecondaryLearningPointDto point : fixPoints) {
            if (point == null || "EXPRESSION".equals(trimToNull(point.kind()))) {
                continue;
            }
            return new FeedbackPrimaryFixDto(
                    trimToNull(point.title()),
                    trimToNull(point.headline()),
                    trimToNull(point.originalText()),
                    trimToNull(point.revisedText()),
                    trimToNull(point.supportText())
            );
        }
        return null;
    }

    private List<FeedbackSecondaryLearningPointDto> deriveSecondaryLearningPointsFromFixPoints(
            List<FeedbackSecondaryLearningPointDto> fixPoints
    ) {
        if (fixPoints == null || fixPoints.isEmpty()) {
            return List.of();
        }
        List<FeedbackSecondaryLearningPointDto> derived = new ArrayList<>();
        boolean skippedFirstFix = false;
        for (FeedbackSecondaryLearningPointDto point : fixPoints) {
            if (point == null || "EXPRESSION".equals(trimToNull(point.kind()))) {
                continue;
            }
            if (!skippedFirstFix) {
                skippedFirstFix = true;
                continue;
            }
            derived.add(point);
        }
        return List.copyOf(derived);
    }

    private FeedbackPrimaryFixDto sanitizePrimaryFix(
            FeedbackPrimaryFixDto primaryFix,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String rewriteStarter
    ) {
        if (primaryFix == null) {
            return null;
        }

        String title = firstNonBlank(primaryFix.title(), "Fix this first");
        String instruction = firstNonBlank(primaryFix.instruction());
        String originalText = firstNonBlank(primaryFix.originalText());
        String revisedText = firstNonBlank(primaryFix.revisedText());
        String reasonKo = firstNonBlank(primaryFix.reasonKo());

        String primaryIssueCode = diagnosis == null ? "" : firstNonBlank(diagnosis.primaryIssueCode(), "");
        boolean grammarFirst = diagnosis != null
                && (diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                || diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MINOR.ordinal()
                || "FIX_BLOCKING_GRAMMAR".equals(primaryIssueCode)
                || "FIX_LOCAL_GRAMMAR".equals(primaryIssueCode));

        if (grammarFirst) {
            if (originalText == null || revisedText == null || reasonKo == null) {
                return null;
            }
            return new FeedbackPrimaryFixDto(title, instruction, originalText, revisedText, reasonKo);
        }

        if (instruction == null) {
            return null;
        }

        if (isGenericTaskResetInstruction(instruction) && isDetailPromptPrimaryIssue(primaryIssueCode)) {
            return null;
        }
        if (!hasConcretePrimaryFixAnchor(primaryFix) && isGenericPrimaryFixInstruction(title, instruction)) {
            return null;
        }

        return new FeedbackPrimaryFixDto(title, instruction, null, null, null);
    }

    private boolean isGenericTaskResetInstruction(String instruction) {
        if (instruction == null || instruction.isBlank()) {
            return false;
        }
        String normalized = normalizeForComparison(instruction);
        return normalized.contains("answer the prompt first")
                || normalized.contains("answer the question first")
                || normalized.contains("write one sentence first")
                || normalized.contains("answer in one sentence first");
    }

    private boolean isGenericPrimaryFixInstruction(String title, String instruction) {
        String normalizedTitle = normalizeForComparison(title);
        String normalizedInstruction = normalizeForComparison(instruction);
        if (normalizedInstruction.isBlank()) {
            return true;
        }
        return normalizedTitle.contains("fix this first")
                || normalizedTitle.contains("add one more thing")
                || normalizedInstruction.contains("fix this one thing first")
                || normalizedInstruction.contains("your sentence will become more stable")
                || normalizedInstruction.contains("add one more detail")
                || normalizedInstruction.contains("try one more sentence")
                || normalizedInstruction.contains("add one more detail")
                || normalizedInstruction.contains("try one more sentence");
    }

    private boolean hasConcretePrimaryFixAnchor(FeedbackPrimaryFixDto primaryFix) {
        if (primaryFix == null) {
            return false;
        }
        if (!normalizeForComparison(firstNonBlank(primaryFix.originalText())).isBlank()
                && !normalizeForComparison(firstNonBlank(primaryFix.revisedText())).isBlank()
                && !normalizeForComparison(firstNonBlank(primaryFix.reasonKo())).isBlank()) {
            return true;
        }
        return containsConcretePrimaryFixAnchor(primaryFix.title())
                || containsConcretePrimaryFixAnchor(primaryFix.instruction());
    }

    private boolean containsConcretePrimaryFixAnchor(String value) {
        String normalized = firstNonBlank(value);
        if (normalized == null) {
            return false;
        }
        Matcher matcher = PRIMARY_FIX_ENGLISH_ANCHOR_PATTERN.matcher(normalized);
        while (matcher.find()) {
            String anchor = normalizeForComparison(matcher.group());
            if (anchor.contains(" ") || anchor.length() >= 4 || Set.of("and", "because", "to", "in", "on", "at", "my", "they", "it").contains(anchor)) {
                return true;
            }
        }
        return normalized.contains("'") || normalized.contains("\"");
    }

    private List<CorrectionDto> sanitizeCorrections(List<CorrectionDto> corrections) {
        if (corrections == null || corrections.isEmpty()) {
            return List.of();
        }
        List<CorrectionDto> sanitized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (CorrectionDto correction : corrections) {
            if (correction == null) {
                continue;
            }
            String issue = correction.issue() == null ? "" : correction.issue().trim();
            String suggestion = correction.suggestion() == null ? "" : correction.suggestion().trim();
            if (issue.isBlank() || suggestion.isBlank()) {
                continue;
            }
            String key = normalizeForComparison(issue) + "|" + normalizeForComparison(suggestion);
            if (seen.add(key)) {
                sanitized.add(new CorrectionDto(issue, suggestion));
            }
        }
        return List.copyOf(sanitized);
    }

    private List<FeedbackSecondaryLearningPointDto> sanitizeSecondaryLearningPoints(
            List<FeedbackSecondaryLearningPointDto> secondaryLearningPoints,
            FeedbackPrimaryFixDto primaryFix
    ) {
        if (secondaryLearningPoints == null || secondaryLearningPoints.isEmpty()) {
            return List.of();
        }
        List<FeedbackSecondaryLearningPointDto> sanitized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        String primaryOriginal = primaryFix == null ? null : trimToNull(primaryFix.originalText());
        String primaryRevised = primaryFix == null ? null : trimToNull(primaryFix.revisedText());

        for (FeedbackSecondaryLearningPointDto point : secondaryLearningPoints) {
            if (point == null) {
                continue;
            }
            FeedbackSecondaryLearningPointDto cleaned = new FeedbackSecondaryLearningPointDto(
                    firstNonBlank(trimToNull(point.kind()), "CORRECTION"),
                    trimToNull(point.title()),
                    trimToNull(point.headline()),
                    trimToNull(point.supportText()),
                    trimToNull(point.originalText()),
                    trimToNull(point.revisedText()),
                    trimToNull(point.meaningKo()),
                    trimToNull(point.guidanceKo()),
                    trimToNull(point.exampleEn()),
                    trimToNull(point.exampleKo())
            );
            if (firstNonBlank(
                    cleaned.headline(),
                    cleaned.supportText(),
                    cleaned.originalText(),
                    cleaned.revisedText(),
                    cleaned.exampleEn()
            ) == null) {
                continue;
            }
            if ("GRAMMAR".equals(cleaned.kind())
                    && primaryOriginal != null
                    && primaryRevised != null
                    && normalizeForComparison(primaryOriginal).equals(normalizeForComparison(cleaned.originalText()))
                    && normalizeForComparison(primaryRevised).equals(normalizeForComparison(cleaned.revisedText()))) {
                continue;
            }
            String key = String.join("|",
                    firstNonBlank(cleaned.kind(), ""),
                    firstNonBlank(cleaned.title(), ""),
                    firstNonBlank(cleaned.headline(), ""),
                    firstNonBlank(cleaned.supportText(), ""),
                    firstNonBlank(cleaned.originalText(), ""),
                    firstNonBlank(cleaned.revisedText(), ""),
                    firstNonBlank(cleaned.exampleEn(), "")
            );
            if (seen.add(normalizeForComparison(key))) {
                sanitized.add(cleaned);
            }
        }
        return List.copyOf(sanitized);
    }

    private FeedbackNextStepPracticeDto sanitizeRewritePractice(
            FeedbackNextStepPracticeDto nextStepPractice,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        if (nextStepPractice == null) {
            return null;
        }
        String headline = sanitizeNextStepHeadline(
                firstNonBlank(nextStepPractice.headline(), nextStepPractice.revisedText(), nextStepPractice.exampleEn())
        );
        String supportText = trimToNull(nextStepPractice.supportText());
        String originalText = trimToNull(nextStepPractice.originalText());
        String revisedText = trimToNull(nextStepPractice.revisedText());
        if ((originalText == null) != (revisedText == null)) {
            originalText = null;
            revisedText = null;
        }
        String meaningKo = trimToNull(nextStepPractice.meaningKo());
        String guidanceKo = trimToNull(nextStepPractice.guidanceKo());
        String exampleEn = trimToNull(nextStepPractice.exampleEn());
        String exampleKo = trimToNull(nextStepPractice.exampleKo());
        if (firstNonBlank(headline, supportText, revisedText, meaningKo, guidanceKo, exampleEn) == null) {
            return null;
        }
        return new FeedbackNextStepPracticeDto(
                trimToNull(nextStepPractice.kind()),
                trimToNull(nextStepPractice.title()),
                headline,
                supportText,
                originalText,
                revisedText,
                meaningKo,
                guidanceKo,
                exampleEn,
                exampleKo,
                trimToNull(nextStepPractice.ctaLabel()),
                nextStepPractice.optionalTone()
        );
    }

    private List<FeedbackRewriteSuggestionDto> sanitizeRewriteSuggestions(
            List<FeedbackRewriteSuggestionDto> rewriteSuggestions,
            FeedbackNextStepPracticeDto nextStepPractice
    ) {
        if (rewriteSuggestions == null || rewriteSuggestions.isEmpty() || nextStepPractice == null) {
            return List.of();
        }
        String practiceHeadline = trimToNull(nextStepPractice.headline());
        String practiceExample = trimToNull(nextStepPractice.exampleEn());
        String practiceRevised = trimToNull(nextStepPractice.revisedText());

        List<FeedbackRewriteSuggestionDto> sanitized = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (FeedbackRewriteSuggestionDto suggestion : rewriteSuggestions) {
            if (suggestion == null) {
                continue;
            }
            String english = sanitizeRewriteSuggestionEnglish(suggestion.english());
            String normalizedEnglish = normalizeForComparison(english);
            if (english == null
                    || normalizedEnglish.equals(normalizeForComparison(practiceHeadline))
                    || normalizedEnglish.equals(normalizeForComparison(practiceExample))
                    || normalizedEnglish.equals(normalizeForComparison(practiceRevised))) {
                continue;
            }
            String key = normalizeForComparison(english);
            if (!seen.add(key)) {
                continue;
            }
            sanitized.add(new FeedbackRewriteSuggestionDto(
                    english,
                    trimToNull(suggestion.meaningKo()),
                    trimToNull(suggestion.noteKo())
            ));
        }
        return List.copyOf(sanitized);
    }

    private String sanitizeRewriteSuggestionEnglish(String english) {
        String trimmed = trimToNull(english);
        if (trimmed == null) {
            return null;
        }
        String normalized = trimmed.replaceAll("[.!?]+$", "").trim();
        if (normalized.isBlank() || normalized.contains("[") || normalized.contains("]")) {
            return null;
        }
        return normalized;
    }

    private String sanitizeNextStepHeadline(String headline) {
        String trimmed = trimToNull(headline);
        if (trimmed == null) {
            return null;
        }
        String normalized = trimmed.replaceAll("\\s+", " ").trim();
        if (normalized.contains("[") || normalized.contains("]")) {
            return null;
        }
        return normalized;
    }

    private String lastLatinWord(String text) {
        String trimmed = trimToNull(text);
        if (trimmed == null) {
            return null;
        }
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("([A-Za-z]+(?:'[A-Za-z]+)?)\\b(?!.*\\b[A-Za-z])").matcher(trimmed);
        return matcher.find() ? matcher.group(1).toLowerCase(Locale.ROOT) : null;
    }

    private boolean isConnectorWord(String token) {
        if (token == null) {
            return false;
        }
        return Set.of("because", "and", "but", "so", "or", "to", "for", "with", "in", "on", "at",
                        "about", "after", "before", "if", "when", "that")
                .contains(token.toLowerCase(Locale.ROOT));
    }

    private List<String> extractRewriteSuggestionTokens(String text) {
        String normalized = trimToNull(text);
        if (normalized == null) {
            return List.of();
        }
        List<String> tokens = new ArrayList<>();
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("[A-Za-z]+(?:'[A-Za-z]+)?").matcher(normalized.toLowerCase(Locale.ROOT));
        Set<String> stopWords = Set.of(
                "a", "an", "and", "are", "at", "be", "because", "been", "being", "but", "for", "from",
                "had", "has", "have", "he", "her", "hers", "him", "his", "i", "if", "in", "is", "it",
                "its", "me", "my", "of", "on", "or", "our", "she", "so", "that", "the", "their", "them",
                "they", "this", "to", "us", "was", "we", "were", "with", "you", "your"
        );
        while (matcher.find()) {
            String token = matcher.group();
            if (!stopWords.contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private List<GrammarFeedbackItemDto> sanitizeGrammarFeedback(
            List<GrammarFeedbackItemDto> grammarFeedback,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        String minimalCorrection = answerProfile == null || answerProfile.grammar() == null
                ? null
                : answerProfile.grammar().minimalCorrection();
        List<GrammarFeedbackItemDto> primary = feedbackSectionValidators.validateGrammarSectionFormat(grammarFeedback);
        primary = feedbackSectionValidators.filterLowValueGrammarItems(primary);
        primary = feedbackSectionValidators.alignGrammarFeedbackWithMinimalCorrection(primary, minimalCorrection);
        if (!primary.isEmpty()) {
            return List.copyOf(primary);
        }

        List<GrammarFeedbackItemDto> fallback = feedbackSectionValidators.validateGrammarSectionFormat(toGrammarFeedback(diagnosis));
        fallback = feedbackSectionValidators.filterLowValueGrammarItems(fallback);
        fallback = feedbackSectionValidators.alignGrammarFeedbackWithMinimalCorrection(fallback, minimalCorrection);
        if (!fallback.isEmpty()) {
            return List.copyOf(fallback);
        }

        if (minimalCorrection != null) {
            String originalText = diagnosis == null ? null : diagnosis.minimalCorrection();
            String revisedText = minimalCorrection;
            if (revisedText != null && !revisedText.isBlank()) {
                return List.of(new GrammarFeedbackItemDto(
                        originalText == null || originalText.isBlank() ? "" : originalText,
                        revisedText,
                        "????볥궚????熬곣뫖?삥납??????꿔꺂?????????????戮?뜤????亦껋꼨援?? ?熬곣뫖利??濚?????????⑤슢????鍮??"
                ));
            }
        }
        return List.of();
    }

    private boolean shouldRequireGrammarSection(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy
    ) {
        if (!sectionPolicy.showGrammar()) {
            return false;
        }
        if (diagnosis == null) {
            return false;
        }
        if (diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                || diagnosis.answerBand() == AnswerBand.TOO_SHORT_FRAGMENT) {
            return true;
        }
        if (diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MODERATE.ordinal()) {
            return true;
        }
        return answerProfile != null
                && answerProfile.grammar() != null
                && answerProfile.grammar().severity().ordinal() >= GrammarSeverity.MODERATE.ordinal();
    }

    private List<RefinementExpressionDto> toRefinementExpressionDtos(List<RefinementCard> cards) {
        if (cards == null || cards.isEmpty()) {
            return List.of();
        }
        List<RefinementExpressionDto> dtos = new ArrayList<>();
        for (RefinementCard card : cards) {
            if (card != null) {
                dtos.add(card.toDto());
            }
        }
        return List.copyOf(dtos);
    }

    private List<CoachExpressionUsageDto> sanitizeUsedExpressions(List<CoachExpressionUsageDto> usedExpressions) {
        if (usedExpressions == null || usedExpressions.isEmpty()) {
            return List.of();
        }
        List<CoachExpressionUsageDto> sanitized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (CoachExpressionUsageDto usage : usedExpressions) {
            if (usage == null) {
                continue;
            }
            String expression = usage.expression() == null ? "" : usage.expression().trim();
            String usageTip = usage.usageTip() == null ? "" : usage.usageTip().trim();
            if (expression.isBlank() || usageTip.isBlank()) {
                continue;
            }
            String key = normalizeForComparison(expression);
            if (seen.add(key)) {
                sanitized.add(new CoachExpressionUsageDto(
                        expression,
                        usage.matched(),
                        usage.matchType(),
                        usage.matchedText(),
                        usage.source(),
                        usageTip
                ));
            }
        }
        return List.copyOf(sanitized);
    }

    private List<RefinementCard> sortRefinementCardsByFocus(
            List<RefinementCard> refinementExpressions,
            RefinementFocus refinementFocus,
            String learnerAnswer
    ) {
        if (refinementExpressions == null || refinementExpressions.isEmpty()) {
            return List.of();
        }
        return refinementExpressions.stream()
                .sorted((left, right) -> Integer.compare(
                        refinementFocusScore(right, refinementFocus, learnerAnswer),
                        refinementFocusScore(left, refinementFocus, learnerAnswer)
                ))
                .toList();
    }

    private int refinementFocusScore(
            RefinementExpressionDto refinementExpression,
            RefinementFocus refinementFocus,
            String learnerAnswer
    ) {
        if (refinementExpression == null) {
            return Integer.MIN_VALUE;
        }
        String expression = refinementExpression.expression() == null ? "" : refinementExpression.expression().trim().toLowerCase(Locale.ROOT);
        String guidance = refinementExpression.guidanceKo() == null ? "" : refinementExpression.guidanceKo().trim();
        int score = 0;
        switch (refinementFocus) {
            case EASY_REUSABLE -> {
                if (countWords(expression) <= 4) score += 3;
                if (!expression.contains("[") && !expression.contains("]")) score += 2;
                if (expression.contains("i ") || expression.startsWith("i ")) score += 1;
            }
            case GRAMMAR_PATTERN -> {
                if (expression.contains(" to ") || expression.startsWith("to ")) score += 3;
                if (expression.startsWith("by ")) score += 3;
                if (expression.contains("because")) score += 2;
                if (expression.contains("ing")) score += 1;
            }
            case DETAIL_BUILDING -> {
                if (expression.contains("because")) score += 3;
                if (expression.contains("it helps")) score += 3;
                if (expression.contains("for example")) score += 2;
                if (expression.contains("feel")) score += 1;
            }
            case NATURALNESS -> {
                if (expression.contains("what i")) score += 3;
                if (expression.contains("during")) score += 2;
                if (expression.contains("at the same time")) score += 2;
                if (expression.contains("most")) score += 1;
            }
            case TASK_COMPLETION -> {
                if (expression.contains("my ") || expression.contains("one ")) score += 2;
                if (expression.contains("because")) score += 2;
                if (expression.contains("i usually")) score += 2;
            }
        }
        if (!guidance.isBlank()) {
            score += 1;
        }
        if (learnerAnswer != null && !learnerAnswer.isBlank() && hasTokenOverlap(expression, learnerAnswer)) {
            score += 1;
        }
        return score;
    }

    private int refinementFocusScore(
            RefinementCard refinementCard,
            RefinementFocus refinementFocus,
            String learnerAnswer
    ) {
        if (refinementCard == null) {
            return Integer.MIN_VALUE;
        }
        String expression = refinementCard.expression() == null ? "" : refinementCard.expression().trim().toLowerCase(Locale.ROOT);
        String guidance = refinementCard.guidanceKo() == null ? "" : refinementCard.guidanceKo().trim();
        int score = 0;
        switch (refinementFocus) {
            case EASY_REUSABLE -> {
                if (countWords(expression) <= 4) score += 3;
                if (!expression.contains("[") && !expression.contains("]")) score += 2;
                if (expression.contains("i ") || expression.startsWith("i ")) score += 1;
            }
            case GRAMMAR_PATTERN -> {
                if (expression.contains(" to ") || expression.startsWith("to ")) score += 3;
                if (expression.startsWith("by ")) score += 3;
                if (expression.contains("because")) score += 2;
                if (expression.contains("ing")) score += 1;
            }
            case DETAIL_BUILDING -> {
                if (expression.contains("because")) score += 3;
                if (expression.contains("it helps")) score += 3;
                if (expression.contains("for example")) score += 2;
                if (expression.contains("feel")) score += 1;
            }
            case NATURALNESS -> {
                if (expression.contains("what i")) score += 3;
                if (expression.contains("during")) score += 2;
                if (expression.contains("at the same time")) score += 2;
                if (expression.contains("most")) score += 1;
            }
            case TASK_COMPLETION -> {
                if (expression.contains("my ") || expression.contains("one ")) score += 2;
                if (expression.contains("because")) score += 2;
                if (expression.contains("i usually")) score += 2;
            }
        }
        if (!guidance.isBlank()) {
            score += 1;
        }
        if (learnerAnswer != null && !learnerAnswer.isBlank() && hasTokenOverlap(expression, learnerAnswer)) {
            score += 1;
        }
        return score;
    }

    private String sanitizeRewriteGuide(
            String rewriteGuide,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        String clean = rewriteGuide == null ? null : rewriteGuide.trim();
        if (diagnosis != null
                && diagnosis.answerBand() == AnswerBand.TOO_SHORT_FRAGMENT
                && (clean == null || clean.isBlank())) {
            return normalizeTooShortRewriteGuide(null, diagnosis);
        }
        if (clean == null || clean.isBlank()) {
            return fallbackRewriteGuide(diagnosis, answerProfile);
        }
        if (diagnosis != null
                && diagnosis.answerBand() == AnswerBand.TOO_SHORT_FRAGMENT) {
            return normalizeTooShortRewriteGuide(clean, diagnosis);
        }
        if (containsBrokenSkeleton(clean, diagnosis)) {
            return fallbackRewriteGuide(diagnosis, answerProfile);
        }
        return clean;
    }


    private String buildRetrySpecificInstructionsV2(
            List<ValidationFailureCode> failureCodes,
            List<SectionKey> requestedSections
    ) {
        if (failureCodes == null || failureCodes.isEmpty()) {
            return "- none";
        }
        List<String> instructions = new ArrayList<>();
        boolean fixWorkRequested = requestedSections != null && requestedSections.contains(SectionKey.PRIMARY_FIX);
        boolean strengthsRequested = requestedSections != null && requestedSections.contains(SectionKey.STRENGTHS);

        boolean fixPointRetryNeeded = fixWorkRequested && (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.UNALIGNED_PRIMARY_FIX)
                || failureCodes.contains(ValidationFailureCode.LOW_VALUE_SECTION)
                || failureCodes.contains(ValidationFailureCode.NEAR_DUPLICATE)
                || failureCodes.contains(ValidationFailureCode.EMPTY_IMPROVEMENT));
        if (fixPointRetryNeeded) {
            instructions.add("- Replace generic FIX_POINTS with specific ones. Each item should teach one point and name the exact phrase, word, connector, or slot to change when no original/revised pair is shown.");
            instructions.add("- If multiple distinct fixes remain, return them as separate FIX_POINTS instead of repeating the same lesson.");
        }
        if (strengthsRequested && (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.NEAR_DUPLICATE)
                || failureCodes.contains(ValidationFailureCode.LOW_VALUE_SECTION))) {
            instructions.add("- STRENGTHS should be one short Korean keep-signal that says what the learner should keep in the next rewrite.");
        }
        if (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.UNALIGNED_REWRITE_TARGET)) {
            instructions.add("- NEXT_STEP_PRACTICE should be one clearly different optional add-on or null, and REWRITE_SUGGESTIONS should be short helper ideas for that same next step.");
        }
        if (instructions.isEmpty()) {
            return "- none";
        }
        return String.join("\n", instructions);
    }


    private String fallbackRewriteGuide(FeedbackDiagnosisResult diagnosis, AnswerProfile answerProfile) {
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.TOO_SHORT_FRAGMENT) {
            String tooShortGuide = normalizeTooShortRewriteGuide(null, diagnosis);
            if (tooShortGuide != null && !tooShortGuide.isBlank()) {
                return tooShortGuide;
            }
        }
        String skeleton = diagnosis.rewriteTarget() != null ? diagnosis.rewriteTarget().skeleton() : null;
        String minimalCorrection = diagnosis.minimalCorrection();
        String base = firstNonBlank(minimalCorrection, skeleton);
        if (base == null) {
            return null;
        }
        if (diagnosis.expansionBudget() == ExpansionBudget.NONE) {
            return "\"" + base + "\"?????뚯???????Β??????⑤베鍮?????⑤슢????鍮??";
        }
        if (diagnosis.expansionBudget() == ExpansionBudget.ONE_SUPPORT_SENTENCE) {
            return "\"" + base + "\"???熬곣뫖利?嚥????Β???꿔꺂???熬곻퐢利???꿔꺂??????????????戮?뜪??????⑥쥓援????? ???戮?뜪?????β뼯援η뙴???????거?????⑤슢????鍮??";
        }
        return "\"" + base + "\"???熬곣뫖利?嚥????Β??????醫딆쓧??꿔꺂??? ????????????????쇨덫???????⑸윞???????거?????⑤슢????鍮??";
    }

    private String fallbackTooShortRewriteGuide(FeedbackDiagnosisResult diagnosis) {
        String skeleton = diagnosis == null || diagnosis.rewriteTarget() == null ? null : diagnosis.rewriteTarget().skeleton();
        String usableSkeleton = inferTooShortSkeleton(diagnosis == null ? null : diagnosis.minimalCorrection());
        if (usableSkeleton == null) {
            usableSkeleton = preferFillInSkeleton(skeleton);
        }
        if (usableSkeleton == null) {
            usableSkeleton = "I ____.";
        }
        return "\"" + usableSkeleton + "\" ?????꿔꺂??????亦껋꼨援?? ?????戮?뜪?????Β??????⑤베鍮?????쇰뮡?? ?????녈렅?????繹먮냱議???嶺뚮㉡?ｅ퐲???鶯ㅺ동???????⑤슢????鍮??";
    }

    private boolean isValidTooShortRewriteGuide(String rewriteGuide, FeedbackDiagnosisResult diagnosis) {
        String cleanGuide = rewriteGuide == null ? "" : rewriteGuide.trim();
        if (cleanGuide.isBlank()) {
            return false;
        }
        if (!containsFillInPlaceholder(cleanGuide)) {
            return false;
        }
        String normalizedGuide = normalizeForComparison(cleanGuide);
        String minimalCorrection = diagnosis == null ? "" : normalizeForComparison(diagnosis.minimalCorrection());
        if (!minimalCorrection.isBlank() && normalizedGuide.equals(minimalCorrection)) {
            return false;
        }
        return !isExpansionHeavyTooShortGuide(normalizedGuide);
    }

    private String preferFillInSkeleton(String skeleton) {
        if (skeleton == null || skeleton.isBlank()) {
            return null;
        }
        String trimmed = skeleton.trim();
        if (!containsFillInPlaceholder(trimmed)) {
            return null;
        }
        return isExpansionHeavyTooShortGuide(normalizeForComparison(trimmed)) ? null : trimmed;
    }

    private boolean containsFillInPlaceholder(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.contains("____") || text.contains("...") || text.contains("__");
    }

    private boolean containsRewriteGuidePlaceholder(String rewriteGuide) {
        if (rewriteGuide == null || rewriteGuide.isBlank()) {
            return false;
        }
        return containsFillInPlaceholder(rewriteGuide) || rewriteGuide.matches(".*\\[[^\\]]+\\].*");
    }

    private String inferTooShortSkeleton(String minimalCorrection) {
        String sanitized = minimalCorrection == null ? null : minimalCorrection.trim();
        if (sanitized == null || sanitized.isBlank()) {
            return null;
        }
        String withoutEnding = sanitized.replaceAll("[.!?]+$", "").trim();
        Matcher phraseMatcher = Pattern.compile("(?i)^(i|we|he|she|they)\\s+(go to|want to|plan to|like to)\\s+.+$").matcher(withoutEnding);
        if (phraseMatcher.find()) {
            return capitalizeSentence(
                    phraseMatcher.group(1).toLowerCase(Locale.ROOT) + " "
                            + phraseMatcher.group(2).toLowerCase(Locale.ROOT) + " ____."
            );
        }
        Matcher matcher = Pattern.compile("(?i)^(i|we|he|she|they)\\s+([a-z']+)\\s+.+$").matcher(withoutEnding);
        if (matcher.find()) {
            return capitalizeSentence(matcher.group(1).toLowerCase(Locale.ROOT) + " " + matcher.group(2).toLowerCase(Locale.ROOT) + " ____.");
        }
        return null;
    }

    private String capitalizeSentence(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        return Character.toUpperCase(text.charAt(0)) + text.substring(1);
    }

    private String normalizeTooShortRewriteGuide(String rewriteGuide, FeedbackDiagnosisResult diagnosis) {
        String preferredSkeleton = inferTooShortSkeleton(diagnosis == null ? null : diagnosis.minimalCorrection());
        if (preferredSkeleton == null) {
            preferredSkeleton = extractTooShortGuideSkeleton(rewriteGuide);
        }
        if (preferredSkeleton == null && diagnosis != null && diagnosis.rewriteTarget() != null) {
            preferredSkeleton = preferFillInSkeleton(diagnosis.rewriteTarget().skeleton());
        }
        if (preferredSkeleton == null) {
            preferredSkeleton = "I ____.";
        }
        return buildNormalizedTooShortRewriteGuideInstruction(preferredSkeleton);
    }

    private String buildNormalizedTooShortRewriteGuideInstruction(String skeleton) {
        String cleanSkeleton = skeleton == null || skeleton.isBlank() ? "I ____." : skeleton.trim();
        return "\"" + cleanSkeleton + "\" ?????꿔꺂??????亦껋꼨援?? ?????戮?뜪?????Β??????썹땟????野껊뿈?? ?????녈렅????????繹먮냱議?????ㅻ깹壤???鶯ㅺ동???????⑤슢????鍮??";
    }

    private String buildTooShortRewriteGuideInstruction(String skeleton) {
        String cleanSkeleton = skeleton == null || skeleton.isBlank() ? "I ____." : skeleton.trim();
        return "\"" + cleanSkeleton + "\" ?????꿔꺂??????亦껋꼨援?? ?????戮?뜪?????Β??????썹땟?????⑤슢????鍮??";
    }

    private String extractTooShortGuideSkeleton(String rewriteGuide) {
        if (rewriteGuide == null || rewriteGuide.isBlank()) {
            return null;
        }
        Matcher quotedMatcher = Pattern.compile("\"([^\"]+)\"").matcher(rewriteGuide);
        if (quotedMatcher.find()) {
            String quoted = quotedMatcher.group(1);
            String preferred = preferFillInSkeleton(quoted);
            if (preferred != null) {
                return preferred;
            }
        }
        String firstSentence = rewriteGuide.split("(?<=[.!?])\\s+")[0].trim();
        return preferFillInSkeleton(firstSentence);
    }

    private boolean looksExpansionHeavyTooShortGuide(String normalizedGuide) {
        if (normalizedGuide == null || normalizedGuide.isBlank()) {
            return false;
        }
        return normalizedGuide.contains(" and ...")
                || normalizedGuide.contains(" and ____")
                || normalizedGuide.contains(" because ...")
                || normalizedGuide.contains(" because ____")
                || normalizedGuide.contains(" for example")
                || normalizedGuide.contains(", and ");
    }

    private boolean isExpansionHeavyTooShortGuide(String normalizedGuide) {
        if (normalizedGuide == null || normalizedGuide.isBlank()) {
            return false;
        }
        String lower = normalizedGuide.toLowerCase(Locale.ROOT);
        return lower.contains(" and ...")
                || lower.contains(" and ____")
                || lower.contains(" because ...")
                || lower.contains(" because ____")
                || lower.contains(" then ...")
                || lower.contains(" then ____")
                || lower.contains(" for example")
                || lower.contains(", and ")
                || lower.contains("; and ");
    }

    private boolean containsBrokenSkeleton(String rewriteGuide, FeedbackDiagnosisResult diagnosis) {
        if (rewriteGuide == null || rewriteGuide.isBlank()) {
            return false;
        }
        String normalizedGuide = normalizeForComparison(rewriteGuide);
        String minimalCorrection = normalizeForComparison(diagnosis.minimalCorrection());
        if (!minimalCorrection.isBlank() && normalizedGuide.contains(minimalCorrection)) {
            return false;
        }
        String skeleton = diagnosis.rewriteTarget() == null ? "" : normalizeForComparison(diagnosis.rewriteTarget().skeleton());
        return !skeleton.isBlank() && normalizedGuide.contains(skeleton) ? false : normalizedGuide.contains("i have this is to");
    }

    private String anchorTextForModelAnswer(FeedbackDiagnosisResult diagnosis, AnswerProfile answerProfile) {
        return firstNonBlank(
                diagnosis.minimalCorrection(),
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection(),
                answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                        ? null
                        : answerProfile.rewrite().target().skeleton()
        );
    }

    private boolean hasNovelOneStepUpDetail(String modelAnswer, String anchorText) {
        if (modelAnswer == null || modelAnswer.isBlank() || anchorText == null || anchorText.isBlank()) {
            return false;
        }
        if (normalizeForComparison(modelAnswer).equals(normalizeForComparison(anchorText))) {
            return false;
        }
        String[] modelSentences = modelAnswer.trim().split("(?<=[.!?])\\s+");
        String[] anchorSentences = anchorText.trim().split("(?<=[.!?])\\s+");
        if (modelSentences.length > anchorSentences.length) {
            return true;
        }
        Set<String> modelTokens = extractComparisonTokens(modelAnswer);
        Set<String> anchorTokens = extractComparisonTokens(anchorText);
        modelTokens.removeAll(anchorTokens);
        return modelTokens.size() >= 2;
    }

    private Set<String> extractComparisonTokens(String text) {
        Set<String> tokens = new LinkedHashSet<>();
        Matcher matcher = Pattern.compile("[\\p{L}][\\p{L}'-]*").matcher(text == null ? "" : text.toLowerCase(Locale.ROOT));
        while (matcher.find()) {
            String token = matcher.group();
            if (token.length() >= 3 && !Set.of("the", "and", "for", "with", "this", "that", "because").contains(token)) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private List<PromptHintRef> toPromptHintRefs(List<PromptHintDto> hints) {
        if (hints == null || hints.isEmpty()) {
            return List.of();
        }
        List<PromptHintRef> refs = new ArrayList<>();
        for (PromptHintDto hint : hints) {
            if (hint == null || hint.items() == null || hint.items().isEmpty()) {
                continue;
            }
            List<String> items = hint.items().stream()
                    .filter(item -> item != null && item.content() != null && !item.content().isBlank())
                    .map(item -> item.content().trim())
                    .toList();
            if (!items.isEmpty()) {
                refs.add(new PromptHintRef(hint.hintType(), items));
            }
        }
        return List.copyOf(refs);
    }

    private List<GrammarFeedbackItemDto> toGrammarFeedback(FeedbackDiagnosisResult diagnosis) {
        if (diagnosis == null || diagnosis.grammarIssues().isEmpty()) {
            return List.of();
        }
        List<GrammarFeedbackItemDto> grammarFeedback = new ArrayList<>();
        for (DiagnosedGrammarIssue issue : diagnosis.grammarIssues()) {
            if (issue == null || issue.span().isBlank() || issue.correction().isBlank()) {
                continue;
            }
            grammarFeedback.add(new GrammarFeedbackItemDto(issue.span(), issue.correction(), issue.reasonKo()));
        }
        return List.copyOf(grammarFeedback);
    }

    private List<GrammarIssue> toGrammarIssues(FeedbackDiagnosisResult diagnosis) {
        if (diagnosis == null || diagnosis.grammarIssues().isEmpty()) {
            return List.of();
        }
        List<GrammarIssue> grammarIssues = new ArrayList<>();
        for (DiagnosedGrammarIssue issue : diagnosis.grammarIssues()) {
            grammarIssues.add(new GrammarIssue(
                    issue.code(),
                    issue.span(),
                    issue.correction(),
                    issue.blocksMeaning(),
                    issue.severity()
            ));
        }
        return List.copyOf(grammarIssues);
    }

    private GrammarSeverity maxSeverity(GrammarSeverity left, GrammarSeverity right) {
        GrammarSeverity safeLeft = left == null ? GrammarSeverity.NONE : left;
        GrammarSeverity safeRight = right == null ? GrammarSeverity.NONE : right;
        return safeLeft.ordinal() >= safeRight.ordinal() ? safeLeft : safeRight;
    }

    private String generationBandGuidance(AnswerBand answerBand, SectionPolicy sectionPolicy) {
        return switch (answerBand) {
            case GRAMMAR_BLOCKING -> """
                    - Prioritize the core sentence repair before extra expansion.
                    - Keep each fixPoint centered on one corrected sentence direction.
                    - Prefer leaving nextStepPractice null unless there is one clearly optional add-on after the repair.
                    - Prefer compact fixPoints that directly support the repair.
                    - Keep modelAnswer very close to learner meaning and the corrected direction.
                    """;
            case TOO_SHORT_FRAGMENT -> """
                    - Prioritize completing one full base sentence before any expansion.
                    - Keep fixPoints centered on finishing the fragment cleanly.
                    - Use nextStepPractice only if there is one clearly optional add-on after the full base sentence is complete.
                    - Avoid unsupported invention in fixPoints or modelAnswer.
                    """;
            case CONTENT_THIN, SHORT_BUT_VALID -> """
                    - Prioritize adding one more concrete reason, detail, image, or habit.
                    - Keep grammar explanation brief unless it directly blocks the next rewrite.
                    - Prefer fixPoints that help the learner support the same main idea more concretely.
                    - Keep modelAnswer close to learner meaning and add at most one step-up detail.
                    """;
            case NATURAL_BUT_BASIC -> """
                    - Prioritize optional polish and naturalness over major correction.
                    - Keep the overall tone light so the learner feels the answer is already usable.
                    - Prefer fixPoints that teach one small naturalness or phrasing upgrade.
                    - Keep modelAnswer short, close to learner meaning, and low-pressure.
                    """;
            case OFF_TOPIC -> """
                    - Prioritize getting the learner back to the actual task before polishing language.
                    - Keep fixPoints centered on answering the prompt directly.
                    - Use nextStepPractice only if there is one clearly optional add-on after task alignment.
                    - Prefer fixPoints that support task completion rather than extra polish.
                    - Keep modelAnswer as a short task-reset example.
                    """;
        };
    }

    private AnswerBand parseAnswerBand(String value) {
        return parseEnum(value, AnswerBand.SHORT_BUT_VALID, AnswerBand.class);
    }

    private TaskCompletion parseTaskCompletion(String value) {
        return parseEnum(value, TaskCompletion.PARTIAL, TaskCompletion.class);
    }

    private GrammarSeverity parseGrammarSeverity(String value) {
        return parseEnum(value, GrammarSeverity.NONE, GrammarSeverity.class);
    }

    private ExpansionBudget parseExpansionBudget(String value) {
        return parseEnum(value, ExpansionBudget.ONE_DETAIL, ExpansionBudget.class);
    }

    private <T extends Enum<T>> T parseEnum(String value, T fallback, Class<T> enumClass) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return Enum.valueOf(enumClass, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return fallback;
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean hasTokenOverlap(String left, String right) {
        if (left == null || left.isBlank() || right == null || right.isBlank()) {
            return false;
        }
        Set<String> leftTokens = extractComparisonTokens(left);
        Set<String> rightTokens = extractComparisonTokens(right);
        for (String token : leftTokens) {
            if (rightTokens.contains(token)) {
                return true;
            }
        }
        return false;
    }

    private int countWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        int count = 0;
        Matcher matcher = Pattern.compile("[\\p{L}][\\p{L}'-]*").matcher(text);
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private <T> List<T> limit(List<T> values, int maxCount) {
        if (values == null || values.isEmpty() || maxCount <= 0) {
            return List.of();
        }
        return values.size() <= maxCount ? List.copyOf(values) : List.copyOf(values.subList(0, maxCount));
    }




    List<InlineFeedbackSegmentDto> buildInlineFeedbackFromCorrectedAnswer(String originalAnswer, String correctedAnswer) {
        if (originalAnswer == null || originalAnswer.isBlank()) {
            return List.of();
        }

        List<InlineFeedbackSegmentDto> segments = buildPreciseInlineFeedback(originalAnswer, correctedAnswer);
        if (segments.isEmpty() || segments.stream().noneMatch(segment -> !"KEEP".equals(segment.type()))) {
            return List.of();
        }

        return segments;
    }

    private String buildReadableCompletionMessage(
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (!isLoopComplete(learnerAnswer, diagnosis, answerProfile, corrections, grammarFeedback)) {
            return null;
        }
        return "\uc88b\uc544\uc694. \uc9c0\uae08 \ub2e8\uacc4\uc5d0\uc11c \ub9c8\ubb34\ub9ac\ud574\ub3c4 \ucda9\ubd84\ud574\uc694. \uc6d0\ud558\uba74 \ud55c \ubc88 \ub354 \ub2e4\ub4ec\uc73c\uba74\uc11c \uc5f0\uc2b5\ud574 \ubcfc \uc218 \uc788\uc5b4\uc694.";
    }

    private List<InlineFeedbackSegmentDto> normalizeInlineFeedback(
            String originalAnswer,
            String correctedAnswer,
            List<InlineFeedbackSegmentDto> rawInlineFeedback
    ) {
        if (rawInlineFeedback == null || rawInlineFeedback.isEmpty()) {
            return List.of();
        }

        List<InlineFeedbackSegmentDto> normalized = new ArrayList<>();
        for (InlineFeedbackSegmentDto segment : rawInlineFeedback) {
            List<InlineFeedbackSegmentDto> expanded = normalizeSegment(segment);
            if (expanded == null) {
                return List.of();
            }
            normalized.addAll(expanded);
        }

        List<InlineFeedbackSegmentDto> merged = mergeSegments(normalized);
        if (!coversOriginalAnswer(originalAnswer, merged)) {
            return List.of();
        }

        if (!matchesCorrectedAnswer(correctedAnswer, merged)) {
            return List.of();
        }

        if (merged.stream().noneMatch(segment -> !"KEEP".equals(segment.type()))) {
            return List.of();
        }

        return merged;
    }

    private List<InlineFeedbackSegmentDto> normalizeSegment(InlineFeedbackSegmentDto segment) {
        String type = segment.type();
        String originalText = segment.originalText();
        String revisedText = segment.revisedText();

        if (originalText.isBlank() && revisedText.isBlank()) {
            return List.of();
        }

        return switch (type) {
            case "KEEP" -> {
                if (originalText.isBlank()) {
                    yield null;
                }
                yield List.of(new InlineFeedbackSegmentDto("KEEP", originalText, originalText));
            }
            case "ADD" -> {
                if (revisedText.isBlank() || !originalText.isBlank()) {
                    yield null;
                }
                yield List.of(new InlineFeedbackSegmentDto("ADD", "", revisedText));
            }
            case "REMOVE" -> {
                if (originalText.isBlank()) {
                    yield null;
                }
                yield List.of(new InlineFeedbackSegmentDto("REMOVE", originalText, ""));
            }
            case "REPLACE" -> {
                if (originalText.isBlank() && revisedText.isBlank()) {
                    yield List.of();
                }
                if (originalText.isBlank()) {
                    yield List.of(new InlineFeedbackSegmentDto("ADD", "", revisedText));
                }
                if (revisedText.isBlank()) {
                    yield List.of(new InlineFeedbackSegmentDto("REMOVE", originalText, ""));
                }
                if (originalText.equals(revisedText)) {
                    yield List.of(new InlineFeedbackSegmentDto("KEEP", originalText, originalText));
                }
                yield buildPreciseInlineFeedback(originalText, revisedText);
            }
            default -> null;
        };
    }

    private List<InlineFeedbackSegmentDto> expandReplaceSegment(String originalText, String revisedText) {
        int matchIndex = revisedText.indexOf(originalText);
        if (matchIndex >= 0) {
            if (!isSafeBoundary(revisedText, matchIndex) ||
                    !isSafeBoundary(revisedText, matchIndex + originalText.length())) {
                return null;
            }

            String prefix = revisedText.substring(0, matchIndex);
            String suffix = revisedText.substring(matchIndex + originalText.length());
            if (prefix.isEmpty() && suffix.isEmpty()) {
                return null;
            }

            List<InlineFeedbackSegmentDto> expanded = new ArrayList<>();
            if (!prefix.isEmpty()) {
                expanded.add(new InlineFeedbackSegmentDto("ADD", "", prefix));
            }
            expanded.add(new InlineFeedbackSegmentDto("KEEP", originalText, originalText));
            if (!suffix.isEmpty()) {
                expanded.add(new InlineFeedbackSegmentDto("ADD", "", suffix));
            }
            return expanded;
        }

        List<TokenDiffOperation> operations = buildTokenDiffOperations(
                tokenizeForInlineDiff(originalText),
                tokenizeForInlineDiff(revisedText)
        );
        List<InlineFeedbackSegmentDto> expanded = new ArrayList<>();
        StringBuilder removedBuffer = new StringBuilder();
        StringBuilder addedBuffer = new StringBuilder();
        boolean hasEqual = false;

        for (TokenDiffOperation operation : operations) {
            if (operation.kind().equals("equal")) {
                hasEqual = true;
                flushInlineChange(expanded, removedBuffer, addedBuffer);
                appendMergedSegment(expanded, new InlineFeedbackSegmentDto("KEEP", operation.text(), operation.text()));
                continue;
            }

            if (operation.kind().equals("remove")) {
                removedBuffer.append(operation.text());
                continue;
            }

            if (operation.kind().equals("add")) {
                addedBuffer.append(operation.text());
            }
        }

        flushInlineChange(expanded, removedBuffer, addedBuffer);
        return hasEqual ? expanded : null;
    }

    private boolean isSafeBoundary(String text, int boundaryIndex) {
        if (boundaryIndex <= 0 || boundaryIndex >= text.length()) {
            return true;
        }

        char previous = text.charAt(boundaryIndex - 1);
        char next = text.charAt(boundaryIndex);
        return !Character.isLetterOrDigit(previous) || !Character.isLetterOrDigit(next);
    }

    private List<String> tokenizeForInlineDiff(String text) {
        List<String> tokens = new ArrayList<>();
        Matcher matcher = INLINE_TOKEN_PATTERN.matcher(text);
        while (matcher.find()) {
            tokens.add(matcher.group());
        }

        if (tokens.isEmpty() && !text.isEmpty()) {
            tokens.add(text);
        }
        return tokens;
    }

    private List<TokenDiffOperation> buildTokenDiffOperations(List<String> originalTokens, List<String> revisedTokens) {
        int[][] dp = new int[originalTokens.size() + 1][revisedTokens.size() + 1];

        for (int originalIndex = originalTokens.size() - 1; originalIndex >= 0; originalIndex--) {
            for (int revisedIndex = revisedTokens.size() - 1; revisedIndex >= 0; revisedIndex--) {
                dp[originalIndex][revisedIndex] =
                        originalTokens.get(originalIndex).equals(revisedTokens.get(revisedIndex))
                                ? dp[originalIndex + 1][revisedIndex + 1] + 1
                                : Math.max(dp[originalIndex + 1][revisedIndex], dp[originalIndex][revisedIndex + 1]);
            }
        }

        List<TokenDiffOperation> operations = new ArrayList<>();
        int originalIndex = 0;
        int revisedIndex = 0;

        while (originalIndex < originalTokens.size() && revisedIndex < revisedTokens.size()) {
            if (originalTokens.get(originalIndex).equals(revisedTokens.get(revisedIndex))) {
                operations.add(new TokenDiffOperation("equal", originalTokens.get(originalIndex)));
                originalIndex += 1;
                revisedIndex += 1;
                continue;
            }

            if (dp[originalIndex + 1][revisedIndex] >= dp[originalIndex][revisedIndex + 1]) {
                operations.add(new TokenDiffOperation("remove", originalTokens.get(originalIndex)));
                originalIndex += 1;
            } else {
                operations.add(new TokenDiffOperation("add", revisedTokens.get(revisedIndex)));
                revisedIndex += 1;
            }
        }

        while (originalIndex < originalTokens.size()) {
            operations.add(new TokenDiffOperation("remove", originalTokens.get(originalIndex)));
            originalIndex += 1;
        }

        while (revisedIndex < revisedTokens.size()) {
            operations.add(new TokenDiffOperation("add", revisedTokens.get(revisedIndex)));
            revisedIndex += 1;
        }

        return operations;
    }

    private void appendMergedSegment(List<InlineFeedbackSegmentDto> segments, InlineFeedbackSegmentDto segment) {
        if (segments.isEmpty()) {
            segments.add(segment);
            return;
        }

        InlineFeedbackSegmentDto previous = segments.get(segments.size() - 1);
        if (!previous.type().equals(segment.type())) {
            segments.add(segment);
            return;
        }

        segments.set(segments.size() - 1, switch (segment.type()) {
            case "KEEP" -> new InlineFeedbackSegmentDto(
                    "KEEP",
                    previous.originalText() + segment.originalText(),
                    previous.revisedText() + segment.revisedText()
            );
            case "ADD" -> new InlineFeedbackSegmentDto(
                    "ADD",
                    "",
                    previous.revisedText() + segment.revisedText()
            );
            case "REMOVE" -> new InlineFeedbackSegmentDto(
                    "REMOVE",
                    previous.originalText() + segment.originalText(),
                    ""
            );
            default -> segment;
        });
    }

    private void flushInlineChange(
            List<InlineFeedbackSegmentDto> segments,
            StringBuilder removedBuffer,
            StringBuilder addedBuffer
    ) {
        if (removedBuffer.isEmpty() && addedBuffer.isEmpty()) {
            return;
        }

        if (!removedBuffer.isEmpty() && !addedBuffer.isEmpty()) {
            appendMergedSegment(segments, new InlineFeedbackSegmentDto(
                    "REPLACE",
                    removedBuffer.toString(),
                    addedBuffer.toString()
            ));
        } else if (!removedBuffer.isEmpty()) {
            appendMergedSegment(segments, new InlineFeedbackSegmentDto(
                    "REMOVE",
                    removedBuffer.toString(),
                    ""
            ));
        } else {
            appendMergedSegment(segments, new InlineFeedbackSegmentDto(
                    "ADD",
                    "",
                    addedBuffer.toString()
            ));
        }

        removedBuffer.setLength(0);
        addedBuffer.setLength(0);
    }

    private record TokenDiffOperation(String kind, String text) {
    }

    private List<InlineFeedbackSegmentDto> mergeSegments(List<InlineFeedbackSegmentDto> segments) {
        if (segments.isEmpty()) {
            return List.of();
        }

        List<InlineFeedbackSegmentDto> merged = new ArrayList<>();
        for (InlineFeedbackSegmentDto segment : segments) {
            if (segment.type().equals("KEEP") && segment.originalText().isBlank()) {
                continue;
            }
            if (segment.type().equals("ADD") && segment.revisedText().isBlank()) {
                continue;
            }
            if (segment.type().equals("REMOVE") && segment.originalText().isBlank()) {
                continue;
            }

            InlineFeedbackSegmentDto previous = merged.isEmpty() ? null : merged.get(merged.size() - 1);
            if (previous != null && previous.type().equals(segment.type())) {
                if ("KEEP".equals(segment.type())) {
                    merged.set(merged.size() - 1, new InlineFeedbackSegmentDto(
                            "KEEP",
                            previous.originalText() + segment.originalText(),
                            previous.revisedText() + segment.revisedText()
                    ));
                    continue;
                }

                if ("ADD".equals(segment.type())) {
                    merged.set(merged.size() - 1, new InlineFeedbackSegmentDto(
                            "ADD",
                            "",
                            previous.revisedText() + segment.revisedText()
                    ));
                    continue;
                }

                if ("REMOVE".equals(segment.type())) {
                    merged.set(merged.size() - 1, new InlineFeedbackSegmentDto(
                            "REMOVE",
                            previous.originalText() + segment.originalText(),
                            ""
                    ));
                    continue;
                }
            }

            merged.add(segment);
        }

        return merged;
    }

    private boolean coversOriginalAnswer(String originalAnswer, List<InlineFeedbackSegmentDto> segments) {
        int cursor = 0;

        for (InlineFeedbackSegmentDto segment : segments) {
            switch (segment.type()) {
                case "KEEP", "REPLACE", "REMOVE" -> {
                    String originalText = segment.originalText();
                    if (!originalAnswer.startsWith(originalText, cursor)) {
                        return false;
                    }
                    cursor += originalText.length();
                }
                case "ADD" -> {
                    // ADD segments do not consume original characters.
                }
                default -> {
                    return false;
                }
            }
        }

        return cursor == originalAnswer.length();
    }

    private boolean matchesCorrectedAnswer(String correctedAnswer, List<InlineFeedbackSegmentDto> segments) {
        StringBuilder reconstructed = new StringBuilder();
        for (InlineFeedbackSegmentDto segment : segments) {
            switch (segment.type()) {
                case "KEEP" -> reconstructed.append(segment.originalText());
                case "REPLACE", "ADD" -> reconstructed.append(segment.revisedText());
                case "REMOVE" -> {
                    // Skip removed text.
                }
                default -> {
                    return false;
                }
            }
        }

        return normalizeForComparison(correctedAnswer).equals(normalizeForComparison(reconstructed.toString()));
    }

    private String normalizeForComparison(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private boolean isLoopComplete(
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        TaskProfile task = answerProfile == null ? null : answerProfile.task();
        AnswerBand answerBand = diagnosis != null && diagnosis.answerBand() != null
                ? diagnosis.answerBand()
                : task == null ? null : task.answerBand();
        TaskCompletion taskCompletion = diagnosis != null && diagnosis.taskCompletion() != null
                ? diagnosis.taskCompletion()
                : task == null ? TaskCompletion.PARTIAL : task.taskCompletion();
        boolean onTopic = diagnosis != null ? diagnosis.onTopic() : task != null && task.onTopic();
        boolean finishable = diagnosis != null && diagnosis.finishable();
        GrammarSeverity grammarSeverity = answerProfile != null && answerProfile.grammar() != null
                ? answerProfile.grammar().severity()
                : diagnosis == null ? GrammarSeverity.NONE : diagnosis.grammarSeverity();
        if (!onTopic) {
            return false;
        }
        if (answerBand == AnswerBand.OFF_TOPIC || answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            return false;
        }
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING || grammarSeverity == GrammarSeverity.MAJOR) {
            return false;
        }
        if (taskCompletion != TaskCompletion.FULL) {
            return false;
        }
        if (!isSubmissionReadyForCompletion(learnerAnswer, answerProfile, grammarFeedback)) {
            return false;
        }
        return finishable;
    }

    private boolean isSubmissionReadyForCompletion(
            String learnerAnswer,
            AnswerProfile answerProfile,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (answerProfile == null || answerProfile.grammar() == null) {
            return true;
        }
        GrammarProfile grammar = answerProfile.grammar();
        if (grammar.severity().ordinal() > GrammarSeverity.MINOR.ordinal()) {
            return false;
        }
        if (estimateMinimalCorrectionEditBurden(learnerAnswer, grammar.minimalCorrection()) > 1) {
            return false;
        }
        return true;
    }

    private boolean hasRequiredSupportClause(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.content() == null || answerProfile.content().signals() == null) {
            return false;
        }
        ContentSignals signals = answerProfile.content().signals();
        return signals.hasReason()
                || signals.hasActivity()
                || signals.hasExample()
                || signals.hasFeeling()
                || signals.hasTimeOrPlace();
    }

    private int estimateMinimalCorrectionEditBurden(String learnerAnswer, String minimalCorrection) {
        if (learnerAnswer == null || learnerAnswer.isBlank() || minimalCorrection == null || minimalCorrection.isBlank()) {
            return 0;
        }
        if (normalizeForComparison(learnerAnswer).equals(normalizeForComparison(minimalCorrection))) {
            return 0;
        }

        List<InlineFeedbackSegmentDto> segments = buildInlineFeedbackFromCorrectedAnswer(learnerAnswer, minimalCorrection);
        if (segments.isEmpty()) {
            return 2;
        }

        int burden = 0;
        for (InlineFeedbackSegmentDto segment : segments) {
            if (segment == null || "KEEP".equals(segment.type())) {
                continue;
            }
            burden += completionEditBurden(segment.originalText(), segment.revisedText());
        }
        return burden;
    }

    private int countMeaningfulGrammarFixes(List<GrammarFeedbackItemDto> grammarFeedback) {
        if (grammarFeedback == null || grammarFeedback.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (GrammarFeedbackItemDto item : grammarFeedback) {
            if (item == null) {
                continue;
            }
            count += completionEditBurden(item.originalText(), item.revisedText());
        }
        return count;
    }

    private int completionEditBurden(String originalText, String revisedText) {
        String original = originalText == null ? "" : originalText.trim();
        String revised = revisedText == null ? "" : revisedText.trim();
        if (original.isBlank() && revised.isBlank()) {
            return 0;
        }
        if (isCosmeticOnlyChange(original, revised)) {
            return 0;
        }
        return 1;
    }

    private boolean isCosmeticOnlyChange(String original, String revised) {
        String normalizedOriginal = normalizeLettersAndDigits(original);
        String normalizedRevised = normalizeLettersAndDigits(revised);
        if (!normalizedOriginal.isBlank() && normalizedOriginal.equals(normalizedRevised)) {
            return true;
        }
        return normalizeForComparison(original).equals(normalizeForComparison(revised));
    }

    private String normalizeLettersAndDigits(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.replaceAll("[^\\p{L}\\p{N}]+", "").toLowerCase(Locale.ROOT).trim();
    }

    private String buildCompletionMessage(
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            List<CorrectionDto> corrections,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (isLoopComplete(learnerAnswer, diagnosis, answerProfile, corrections, grammarFeedback)) {
            return "????щ였??? ?꿔꺂???????壤굿?????????꿔꺂???熬곎듑??잙갭큔??????롪퍓梨띄댚?????ㅼ굡?? ??沃섃뫂??먮뎨?????????????諭踰???롪퍓媛????????????????????⑥ろ맖??";
        }
        if (!isLoopComplete(learnerAnswer, diagnosis, answerProfile, corrections, grammarFeedback)) {
            return null;
        }
        return "??롪퍓梨띄댚???????щ였????꿔꺂???????壤굿?????????꿔꺂???熬곎듑??잙갭큔???????⑤벡??????썹땟?? ??沃섃뫂??먮뎨?????????????諭踰????⑤슢????????????????β뼯爰??????⑥ろ맖??";
    }
}


