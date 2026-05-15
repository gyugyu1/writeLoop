package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackCoachMissionDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackRewriteSuggestionDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.exception.ApiException;
import com.writeloop.util.ExpressionTagSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class OpenAiFeedbackClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(OpenAiFeedbackClient.class);
    private static final int MAX_LOG_RESPONSE_BODY_LENGTH = 4000;
    private static final int MAX_INLINE_DIFF_TEXT_CHARS = 4_000;
    private static final int MAX_INLINE_DIFF_TOKENS = 600;
    private static final int MAX_INLINE_DIFF_CELLS = 120_000;
    private static final Pattern INLINE_TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9']+|[^\\sA-Za-z0-9']+|\\s+");
    private static final Set<String> EXPLANATION_ANCHOR_STOPWORDS = Set.of(
            "a", "an", "and", "are", "be", "been", "being", "for", "from", "had", "has", "have",
            "in", "is", "it", "its", "of", "on", "or", "that", "the", "to", "was", "were", "with"
    );
    private static final Pattern ALPHA_WORD_PATTERN = Pattern.compile("[A-Za-z]+(?:'[A-Za-z]+)?");
    private static final Set<String> ROMANIZED_KOREAN_TOKENS = Set.of(
            "annyeong", "ani", "aniya", "arasso", "eotteoke", "eotteon", "eodi", "eonje",
            "beoseu", "chingu", "eumryo", "gaja", "gayo", "geu", "geuge", "geunyang",
            "geurae", "geuraeseo", "geureom", "hago", "haeyo", "hakgyo", "haneun",
            "hanguk", "ige", "ije", "jigeum", "jinjja", "joa", "joayo", "jota",
            "keopi", "mashisseo", "masisseo", "meok", "meogeoyo", "molla", "mollayo",
            "naneun", "neomu", "pigon", "tago", "wae", "yo"
    );
    private static final Set<String> ENGLISH_SENTENCE_SIGNAL_WORDS = Set.of(
            "i", "my", "me", "we", "you", "he", "she", "it", "they", "this", "that",
            "am", "is", "are", "was", "were", "be", "been", "do", "does", "did",
            "have", "has", "had", "will", "can", "want", "wants", "need", "needs",
            "like", "likes", "go", "goes", "went", "eat", "eats", "drink", "drinks",
            "watch", "watches", "listen", "listens", "feel", "feels", "make", "makes",
            "choose", "chooses", "order", "orders", "study", "work", "works", "rest",
            "use", "uses", "because", "when", "after", "before", "usually", "often",
            "sometimes", "always", "then", "and", "but", "to", "for", "with", "in", "on", "at"
    );
    private static final Set<String> WORD_SALAD_TOKENS = Set.of(
            "banana", "chair", "blue", "computer", "table", "pencil", "rabbit", "window",
            "cloud", "pizza", "sleep", "happy", "orange", "desk", "phone"
    );
    private static final List<String> GENERIC_FIX_POINT_SUPPORT_PHRASES = List.of(
            "\uBB38\uBC95\uC774 \uB9DE\uC9C0 \uC54A",
            "\uB354 \uC790\uC5F0\uC2A4\uB7FD",
            "\uC790\uC5F0\uC2A4\uB7FD\uAC8C \uBC14\uAFB8",
            "\uBCF4\uD1B5 \uC774\uB807\uAC8C",
            "\uBC14\uAFD4\uC57C \uD569\uB2C8\uB2E4",
            "\uD45C\uD604\uC774 \uC5B4\uC0C9",
            "\uC774\uC5B4 \uC8FC\uBA74 \uC790\uC5F0\uC2A4\uB7FD"
    );
    private static final Set<String> SPECIFIC_FIX_POINT_REASON_KEYWORDS = Set.of(
            "\uC8FC\uC5B4", "\uB3D9\uC0AC", "\uC218\uC77C\uCE58", "\uC2DC\uC81C", "\uACFC\uAC70\uD615", "\uD604\uC7AC\uD615",
            "\uBCF5\uC218", "\uBCF5\uC218\uD615", "\uB2E8\uC218", "\uAD00\uC0AC", "\uAC00\uC0B0", "\uBD88\uAC00\uC0B0",
            "\uBA85\uC0AC", "\uB300\uBA85\uC0AC", "\uD615\uC6A9\uC0AC", "\uBD80\uC0AC", "\uC804\uCE58\uC0AC",
            "\uC5B4\uC21C", "\uC811\uC18D\uC0AC", "\uC5F0\uACB0\uC5B4", "\uC870\uB3D9\uC0AC", "\uB3D9\uC0AC\uC6D0\uD615",
            "\uBE44\uB3D9\uC0AC", "\uBE44\uAC00\uC0B0", "\uAD00\uC6A9", "\uCF5C\uB85C\uCF00\uC774\uC158", "\uBCF8\uB3D9\uC0AC",
            "subject", "verb", "agreement", "singular", "plural", "article", "countable", "uncountable",
            "auxiliary", "base verb", "tense", "pronoun", "preposition", "connector", "collocation"
    );
    private static final List<String> REWRITE_TARGET_ACTION_ENUM = List.of(
            "MAKE_ON_TOPIC",
            "STATE_MAIN_ANSWER",
            "FIX_BLOCKING_GRAMMAR",
            "FIX_LOCAL_GRAMMAR",
            "ADD_REASON",
            "ADD_EXAMPLE",
            "ADD_DETAIL",
            "ADD_SITUATION",
            "ADD_FEELING",
            "ADD_RESULT",
            "IMPROVE_NATURALNESS"
    );
    private static final Set<String> REWRITE_TARGET_ACTION_CODES = Set.copyOf(REWRITE_TARGET_ACTION_ENUM);
    static final String INTERNAL_AUTHORITATIVE_SESSION_ID = "__OPENAI_HYBRID_FINAL__";
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final String reasoningEffort;
    private final int requestTimeoutSeconds;
    private final AnswerProfileBuilder answerProfileBuilder = new AnswerProfileBuilder();
    private final FeedbackSectionValidators feedbackSectionValidators = new FeedbackSectionValidators();
    private final FeedbackDeterministicSectionGenerator deterministicSectionGenerator = new FeedbackDeterministicSectionGenerator();
    private final FeedbackDeterministicCorrectionResolver deterministicCorrectionResolver = new FeedbackDeterministicCorrectionResolver();
    private final FeedbackRetryPolicy feedbackRetryPolicy = new FeedbackRetryPolicy();
    private final ThreadLocal<FeedbackAnalysisSnapshot> latestAnalysisSnapshot = new ThreadLocal<>();
    @Autowired(required = false)
    private FeedbackTimingRecorder feedbackTimingRecorder;

    private record OpenAiApiResponse(
            int statusCode,
            String body
    ) {
    }

    private record GenerationCallResult(
            FeedbackDiagnosisResult diagnosis,
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
        try {
            return reviewHybrid(prompt, answer, hints, attemptIndex, previousAnswer, previousCoachingSummary);
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

    private FeedbackResponseDto reviewHybrid(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            int attemptIndex,
            String previousAnswer,
            String previousCoachingSummary
    )
            throws IOException, InterruptedException {
        try {
            Integer generationResponseStatusCode = null;
            Integer regenerationResponseStatusCode = null;
            String generationResponseBody = null;
            String regenerationResponseBody = null;
            List<SectionKey> initialRequestedSections = requestedSections(null, null, null, null);
            GenerationCallResult generationCallResult = generateSections(
                    prompt,
                    answer,
                    hints,
                    null,
                    null,
                    null,
                    attemptIndex,
                    previousAnswer,
                    previousCoachingSummary,
                    initialRequestedSections,
                    List.of(),
                    null
            );
            FeedbackDiagnosisResult diagnosis = generationCallResult.diagnosis();
            GeneratedSections generatedSections = generationCallResult.sections();
            generationResponseStatusCode = generationCallResult.statusCode();
            generationResponseBody = generationCallResult.rawResponseBody();
            AnswerProfile diagnosedProfile = buildDiagnosedProfile(prompt, answer, hints, diagnosis, attemptIndex, previousAnswer);
            SectionPolicy sectionPolicy = llmPassThroughSectionPolicy();
            List<SectionKey> generationRequestedSections = requestedSections(
                    diagnosedProfile,
                    sectionPolicy,
                    null,
                    null
            );
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
                LOGGER.info(
                        "Feedback regeneration skipped provider=openai promptId={} attemptIndex={} failureCount={} passThrough=true",
                        prompt.id(),
                        attemptIndex,
                        validation.failures().size()
                );
                if (feedbackTimingRecorder != null) {
                    feedbackTimingRecorder.recordPolicyEvent(
                            "regeneration_skipped",
                            Map.of("provider", "openai", "failureCount", validation.failures().size())
                    );
                }
            }
            latestAnalysisSnapshot.set(new FeedbackAnalysisSnapshot(
                    "OPENAI",
                    model,
                    generationResponseStatusCode,
                    generationResponseStatusCode,
                    regenerationResponseStatusCode,
                    generationResponseBody,
                    generationResponseBody,
                    regenerationResponseBody,
                    diagnosis,
                    diagnosedProfile,
                    sectionPolicy,
                    validation.sanitizedSections(),
                    false,
                    false,
                    retryAttempted
            ));
            return assembleHybridResponse(prompt.id(), answer, diagnosis, diagnosedProfile, validation.sanitizedSections());
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
            logOpenAiFailure("generation-runtime", prompt.id(), attemptIndex, runtimeException);
            throw feedbackGenerationUnavailable();
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
            String previousCoachingSummary,
            List<SectionKey> requestedSections,
            List<ValidationFailureCode> failureCodes,
            GeneratedSections previousSections
    ) throws IOException, InterruptedException {
        String phase = resolveGenerationPhase(diagnosis, previousSections);
        long startedAtNanos = System.nanoTime();
        OpenAiApiResponse response;
        try {
            response = sendResponsesRequest(buildGenerationRequestBody(
                    prompt,
                    answer,
                    hints,
                    diagnosis,
                    answerProfile,
                    sectionPolicy,
                    attemptIndex,
                    previousAnswer,
                    previousCoachingSummary,
                    requestedSections,
                    failureCodes,
                    previousSections
            ));
        } catch (IOException | InterruptedException | RuntimeException exception) {
            logLlmTiming(phase, prompt.id(), attemptIndex, null, false, exception, startedAtNanos);
            throw exception;
        }
        try {
            JsonNode node = objectMapper.readTree(extractOutputText(response.body()));
            GenerationCallResult result = new GenerationCallResult(
                    parseDiagnosisResponse(node),
                    parseGeneratedSections(node),
                    response.statusCode(),
                    response.body()
            );
            logLlmTiming(phase, prompt.id(), attemptIndex, response.statusCode(), true, null, startedAtNanos);
            return result;
        } catch (IOException exception) {
            logLlmTiming(phase, prompt.id(), attemptIndex, response.statusCode(), false, exception, startedAtNanos);
            throw new OpenAiResponseParseException(
                    "OpenAI generation response parsing failed",
                    response.statusCode(),
                    response.body(),
                    exception
            );
        } catch (RuntimeException exception) {
            logLlmTiming(phase, prompt.id(), attemptIndex, response.statusCode(), false, exception, startedAtNanos);
            throw new OpenAiResponseParseRuntimeException(
                    "OpenAI generation response parsing failed",
                    response.statusCode(),
                    response.body(),
                    exception
            );
        }
    }

    private String resolveGenerationPhase(FeedbackDiagnosisResult diagnosis, GeneratedSections previousSections) {
        if (previousSections != null) {
            return "regeneration";
        }
        if (diagnosis == null) {
            return "generation_first_pass_with_diagnosis";
        }
        return "generation";
    }

    private void logLlmTiming(
            String phase,
            String promptId,
            int attemptIndex,
            Integer statusCode,
            boolean success,
            Throwable exception,
            long startedAtNanos
    ) {
        long elapsedMs = elapsedMs(startedAtNanos);
        LOGGER.info(
                "Feedback LLM timing provider=openai phase={} promptId={} attemptIndex={} model={} reasoningEffort={} success={} status={} exceptionClass={} elapsedMs={}",
                phase,
                promptId,
                attemptIndex,
                model,
                reasoningEffort == null || reasoningEffort.isBlank() ? "default" : reasoningEffort,
                success,
                statusCode,
                exception == null ? null : exception.getClass().getName(),
                elapsedMs
        );
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.recordAnswerLlmPhase(
                    phase,
                    promptId,
                    attemptIndex,
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
        List<FeedbackSecondaryLearningPointDto> normalizedFixPointCandidates = sanitizeFixPoints(rawFixPoints);
        FeedbackSecondaryLearningPointDto referentFixPoint = firstCorrectionFixPoint(normalizedFixPointCandidates);
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
        protectedModelAnswer = feedbackSectionValidators.alignModelAnswerWithFixPointReferent(
                protectedModelAnswer,
                referentFixPoint,
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
        List<FeedbackSecondaryLearningPointDto> fixPoints = List.copyOf(normalizedFixPointCandidates);
        List<FeedbackRewriteSuggestionDto> rewriteSuggestions = sanitizeRewriteSuggestions(generatedSections.rewriteSuggestions());
        FeedbackCoachMissionDto coachMission = generatedSections.coachMission();
        failures.addAll(validateFixPointExplanationCoverage(fixPoints));
        GeneratedSections sanitized = new GeneratedSections(
                null,
                strengths,
                null,
                null,
                grammarFeedback,
                corrections,
                refinementExpressions,
                null,
                protectedModelAnswer,
                protectedModelAnswerKo,
                List.of(),
                usedExpressions,
                fixPoints,
                List.of(),
                null,
                rewriteSuggestions,
                coachMission,
                generatedSections.missionDecision()
        );

        boolean shouldRetry = failures.stream().anyMatch(failure -> feedbackRetryPolicy.shouldRetry(failure, diagnosis, sectionPolicy));
        return new ValidationResult(sanitized, failures, shouldRetry);
    }

    private FeedbackCoachMissionDto resolveMissionSourceOfTruth(
            FeedbackCoachMissionDto generatedMission,
            MissionDecision missionDecision,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer,
            List<FeedbackSecondaryLearningPointDto> fixPoints,
            List<RefinementCard> refinementExpressions,
            String modelAnswer
    ) {
        if (shouldForceTaskResetAnswer(learnerAnswer)) {
            return buildForcedTaskResetCoachMission(diagnosis, modelAnswer);
        }
        FeedbackCoachMissionDto sanitized = sanitizeCoachMission(generatedMission, diagnosis);
        sanitized = downgradeReadyAnswerGrammarMission(sanitized, diagnosis);
        FeedbackSecondaryLearningPointDto firstFixPoint = firstCorrectionFixPoint(fixPoints);
        if (isUsableMission(sanitized)
                && shouldPreferGrammarFallback(sanitized, diagnosis, learnerAnswer, firstFixPoint, modelAnswer)) {
            return buildGrammarFallbackCoachMission(
                    diagnosis,
                    answerProfile,
                    learnerAnswer,
                    firstFixPoint,
                    refinementExpressions,
                    modelAnswer
            );
        }
        if (isUsableMission(sanitized)
                && !shouldRejectGeneratedMission(sanitized, missionDecision, diagnosis, answerProfile, learnerAnswer)) {
            return sanitized;
        }
        if (!isUsableMission(sanitized)
                && shouldPreferGrammarFallback(sanitized, diagnosis, learnerAnswer, firstFixPoint, modelAnswer)) {
            return buildGrammarFallbackCoachMission(
                    diagnosis,
                    answerProfile,
                    learnerAnswer,
                    firstFixPoint,
                    refinementExpressions,
                    modelAnswer
            );
        }
        if (shouldPreferContentFallback(sanitized, missionDecision, diagnosis, answerProfile, learnerAnswer)) {
            return buildContentFallbackCoachMission(
                    diagnosis,
                    answerProfile,
                    learnerAnswer,
                    missionDecision,
                    refinementExpressions,
                    modelAnswer
            );
        }
        return buildFallbackCoachMission(
                diagnosis,
                answerProfile,
                learnerAnswer,
                firstFixPoint,
                refinementExpressions,
                modelAnswer
        );
    }

    private boolean shouldForceTaskResetAnswer(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return true;
        }

        List<String> words = alphabeticWords(normalized);
        if (words.isEmpty()) {
            return true;
        }
        if (countNonEnglishScriptLetters(learnerAnswer) >= 2) {
            return true;
        }

        long romanizedKoreanWords = words.stream()
                .filter(ROMANIZED_KOREAN_TOKENS::contains)
                .count();
        if (romanizedKoreanWords >= 3
                || (romanizedKoreanWords >= 2 && romanizedKoreanWords * 2 >= words.size())) {
            return true;
        }

        long sentenceSignals = words.stream()
                .filter(ENGLISH_SENTENCE_SIGNAL_WORDS::contains)
                .count();
        long saladWords = words.stream()
                .filter(WORD_SALAD_TOKENS::contains)
                .count();
        return words.size() >= 4
                && saladWords >= 3
                && sentenceSignals <= 1;
    }

    private List<String> alphabeticWords(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        Matcher matcher = ALPHA_WORD_PATTERN.matcher(value);
        List<String> words = new ArrayList<>();
        while (matcher.find()) {
            words.add(matcher.group().toLowerCase(Locale.ROOT));
        }
        return words;
    }

    private long countNonEnglishScriptLetters(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        return value.codePoints()
                .filter(Character::isLetter)
                .filter(this::isNonEnglishScriptLetter)
                .count();
    }

    private boolean isNonEnglishScriptLetter(int codePoint) {
        Character.UnicodeScript script = Character.UnicodeScript.of(codePoint);
        return script == Character.UnicodeScript.HANGUL
                || script == Character.UnicodeScript.HAN
                || script == Character.UnicodeScript.HIRAGANA
                || script == Character.UnicodeScript.KATAKANA
                || script == Character.UnicodeScript.CYRILLIC
                || script == Character.UnicodeScript.ARABIC
                || script == Character.UnicodeScript.DEVANAGARI;
    }

    private FeedbackCoachMissionDto buildForcedTaskResetCoachMission(
            FeedbackDiagnosisResult diagnosis,
            String modelAnswer
    ) {
        return new FeedbackCoachMissionDto(
                "TASK_RESET",
                "질문에 맞는 영어 문장으로 다시 쓰기",
                null,
                null,
                "지금 답변은 영어 문장으로 보기 어렵거나 질문과 연결되는 정보가 부족해요.",
                "질문에서 묻는 핵심을 영어 한 문장으로 다시 써 보세요.",
                null,
                "I usually ____ because ____.",
                "첫 문장에 질문의 주제와 이유나 상황을 함께 넣어 보세요.",
                "영어 문장 안에 질문의 핵심 주제와 이유나 상황이 들어가면 성공이에요."
        );
    }

    private FeedbackCoachMissionDto sanitizeCoachMission(
            FeedbackCoachMissionDto mission,
            FeedbackDiagnosisResult diagnosis
    ) {
        if (mission == null) {
            return null;
        }
        String missionType = normalizeMissionType(mission.missionType(), diagnosis);
        String whyKo = trimToNull(mission.whyKo());
        String instructionKo = trimToNull(mission.instructionKo());
        String exampleEn = trimToNull(mission.exampleEn());
        String skeletonEn = trimToNull(mission.skeletonEn());
        String skeletonKo = trimToNull(mission.skeletonKo());
        List<FeedbackSuggestedPhraseDto> suggestedPhrases = mission.suggestedPhrases();
        String placeholderEn = trimToNull(mission.placeholderEn());
        String targetHintKo = trimToNull(mission.targetHintKo());
        String successCheckKo = null;
        String originalText = trimToNull(mission.originalText());
        String revisedText = trimToNull(mission.revisedText());
        boolean comparisonMission = isComparisonMissionType(missionType);
        if (comparisonMission && !isMeaningfulComparisonPair(originalText, revisedText)) {
            originalText = null;
            revisedText = null;
        }
        if (!comparisonMission) {
            originalText = null;
            revisedText = null;
        }
        if (comparisonMission) {
            exampleEn = null;
            skeletonEn = null;
            skeletonKo = null;
            suggestedPhrases = List.of();
        }
        String title = trimToNull(mission.title());
        return new FeedbackCoachMissionDto(
                missionType,
                title,
                originalText,
                revisedText,
                whyKo,
                instructionKo,
                exampleEn,
                skeletonEn,
                skeletonKo,
                suggestedPhrases,
                placeholderEn,
                targetHintKo,
                successCheckKo
        );
    }

    private boolean isUsableMission(FeedbackCoachMissionDto mission) {
        if (mission == null) {
            return false;
        }
        if (firstNonBlank(mission.missionType(), mission.title(), mission.instructionKo()) == null) {
            return false;
        }
        if (trimToNull(mission.title()) == null || trimToNull(mission.instructionKo()) == null) {
            return false;
        }
        if (isComparisonMissionType(mission.missionType())) {
            return isMeaningfulComparisonPair(mission.originalText(), mission.revisedText());
        }
        return true;
    }

    private boolean shouldRejectGeneratedMission(
            FeedbackCoachMissionDto mission,
            MissionDecision missionDecision,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer
    ) {
        if (isAdditiveContentComparisonMission(mission)) {
            return true;
        }
        if (missionAsksForAnsweredSlot(mission, missionDecision, learnerAnswer)) {
            return true;
        }
        return shouldPreferContentFallback(mission, missionDecision, diagnosis, answerProfile, learnerAnswer);
    }

    private boolean shouldPreferContentFallback(
            FeedbackCoachMissionDto mission,
            MissionDecision missionDecision,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer
    ) {
        if (isAdditiveContentComparisonMission(mission)) {
            return true;
        }
        if (isLowValuePolishComparisonMission(mission)
                && (isThinAnswer(diagnosis, answerProfile) || !looksLikeBrokenSentenceFrame(learnerAnswer))) {
            return true;
        }
        String missionType = normalizedMissionType(mission);
        boolean blockingGrammar = diagnosis != null && (
                diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                        || diagnosis.grammarImpact() == GrammarImpact.BLOCKING
                        || diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MODERATE.ordinal()
                        || diagnosis.meaningClarity() == MeaningClarity.BLOCKED
        );
        if (hasGenericAdjectiveReason(learnerAnswer)
                && !blockingGrammar
                && ("GRAMMAR_FIX".equals(missionType)
                || "SITUATION".equals(missionType)
                || "EXPRESSION_POLISH".equals(missionType)
                || "RESULT".equals(missionType))) {
            return true;
        }
        if (hasFlatClosing(learnerAnswer)
                && !blockingGrammar
                && ("GRAMMAR_FIX".equals(missionType)
                || "EXPRESSION_POLISH".equals(missionType))) {
            return true;
        }
        if ("SITUATION".equals(missionType) && inferAnswerSlots(learnerAnswer).hasSituation()) {
            return true;
        }
        if ("SITUATION".equals(missionType) && looksLikePreferenceWithReason(learnerAnswer)) {
            return true;
        }
        if ("SITUATION".equals(missionType) && looksLikeSingleWordAnswer(learnerAnswer)) {
            return true;
        }
        if ("DETAIL".equals(missionType)
                && inferAnswerSlots(learnerAnswer).hasActionSituationReason()) {
            return true;
        }
        if ("EXAMPLE".equals(missionType) && isGoodEnoughForOptionalFallback(diagnosis, answerProfile, learnerAnswer)) {
            return true;
        }
        if (isExpressionPolishMission(mission)) {
            return isThinAnswer(diagnosis, answerProfile)
                    || countWords(learnerAnswer) < 10
                    || looksLikeThinSingleSentenceAnswer(learnerAnswer)
                    || hasFlatClosing(learnerAnswer)
                    || contentOpportunityFromMissionDecision(missionDecision) != ContentOpportunity.NONE;
        }
        return false;
    }

    private boolean missionAsksForAnsweredSlot(
            FeedbackCoachMissionDto mission,
            MissionDecision missionDecision,
            String learnerAnswer
    ) {
        ContentOpportunity opportunity = contentOpportunityFromCode(normalizedMissionType(mission));
        AnswerSlotEvidence answerSlots = inferAnswerSlots(learnerAnswer);
        if (opportunity == ContentOpportunity.NONE) {
            return false;
        }
        if (slotAlreadyPresent(missionDecision, opportunity) || answerSlotAlreadyPresent(answerSlots, opportunity)) {
            return true;
        }
        if (opportunity == ContentOpportunity.DETAIL
                && (hasCoreActionSituationReason(missionDecision) || answerSlots.hasActionSituationReason())
                && (slotMissing(missionDecision, ContentOpportunity.FEELING)
                || slotMissing(missionDecision, ContentOpportunity.RESULT)
                || !answerSlots.hasFeelingOrResult())) {
            return true;
        }
        return missionDecision != null
                && !missionDecision.missingSlots().isEmpty()
                && !slotMissing(missionDecision, opportunity)
                && firstMissingOpportunity(missionDecision) != ContentOpportunity.NONE;
    }

    private FeedbackCoachMissionDto downgradeReadyAnswerGrammarMission(
            FeedbackCoachMissionDto mission,
            FeedbackDiagnosisResult diagnosis
    ) {
        if (mission == null || !"GRAMMAR_FIX".equals(normalizedMissionType(mission)) || diagnosis == null) {
            return mission;
        }
        if (diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                || diagnosis.grammarImpact() == GrammarImpact.BLOCKING
                || diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MODERATE.ordinal()
                || diagnosis.meaningClarity() == MeaningClarity.BLOCKED) {
            return mission;
        }
        if (!diagnosis.finishable() && diagnosis.score() < 85 && diagnosis.answerBand() != AnswerBand.NATURAL_BUT_BASIC) {
            return mission;
        }
        return new FeedbackCoachMissionDto(
                "EXPRESSION_POLISH",
                mission.title(),
                mission.originalText(),
                mission.revisedText(),
                mission.whyKo(),
                mission.instructionKo(),
                mission.exampleEn(),
                mission.placeholderEn(),
                mission.targetHintKo(),
                mission.successCheckKo()
        );
    }

    private boolean isExpressionPolishMission(FeedbackCoachMissionDto mission) {
        return "EXPRESSION_POLISH".equals(normalizedMissionType(mission));
    }

    private String normalizedMissionType(FeedbackCoachMissionDto mission) {
        return mission == null ? "" : firstNonBlank(mission.missionType(), "").toUpperCase(Locale.ROOT);
    }

    private boolean shouldPreferGrammarFallback(
            FeedbackCoachMissionDto mission,
            FeedbackDiagnosisResult diagnosis,
            String learnerAnswer,
            FeedbackSecondaryLearningPointDto firstFixPoint,
            String modelAnswer
    ) {
        if (mission == null || isComparisonMissionType(mission.missionType())) {
            return false;
        }
        boolean brokenFrame = looksLikeBrokenSentenceFrame(learnerAnswer);
        if (diagnosis != null && (
                !diagnosis.onTopic()
                        || diagnosis.answerBand() == AnswerBand.OFF_TOPIC
                        || (diagnosis.answerBand() == AnswerBand.NATURAL_BUT_BASIC && !brokenFrame)
        )) {
            return false;
        }
        if (diagnosis != null && diagnosis.score() >= 80 && !brokenFrame) {
            return false;
        }
        boolean hasFixPair = isMeaningfulComparisonPair(
                firstFixPoint == null ? null : firstFixPoint.originalText(),
                firstFixPoint == null ? null : firstFixPoint.revisedText()
        );
        boolean hasModelPair = isMeaningfulComparisonPair(
                learnerAnswer,
                firstNonBlank(diagnosis == null ? null : diagnosis.minimalCorrection(), modelAnswer)
        );
        if (!hasFixPair && !hasModelPair) {
            return false;
        }
        if (diagnosis != null && (
                diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                        || diagnosis.grammarImpact() == GrammarImpact.BLOCKING
                        || diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MAJOR.ordinal()
                        || diagnosis.meaningClarity() == MeaningClarity.BLOCKED
        )) {
            return true;
        }
        return brokenFrame;
    }

    private boolean looksLikeBrokenSentenceFrame(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return false;
        }
        return normalized.matches(".*\\b(want|need|try|plan|like)\\s+(be|build|choose|do|drink|eat|exercise|feel|get|go|have|learn|listen|look|make|meet|order|play|rest|see|sleep|speak|study|take|use|visit|wake|walk|wash|watch|work|write)\\b.*")
                || normalized.matches(".*\\b(go|goes|went)\\s+(company|school|academy|home|work)\\b.*")
                || normalized.matches(".*\\b(listen|listens|listened)\\s+(music|song|songs|podcast|podcasts)\\b.*")
                || normalized.matches(".*\\b(wash|washes|washed)\\s+(dish|dishes|face|hair|hand|hands)\\b.*")
                || normalized.matches(".*\\b(look|looks|looked)\\s+(the\\s+)?(scene|scenery|view|window)\\b.*")
                || normalized.matches(".*\\bit\\s+(make|makes|made)\\s+me\\s+(exciting|boring|relaxing|interesting|tiring)\\b.*")
                || normalized.matches(".*\\b(he|she|it|hero|movie|story|drink|taste|scent|habit|goal)\\s+(make|go|save|help|feel|give|need|work)\\b.*")
                || normalized.matches(".*\\b(in night|on sofa|speak confident|is not hear by|are not hear by|body is heavy)\\b.*")
                || normalized.matches(".*\\bbecause\\s+[a-z]+\\s+(good|bad|important|fun|healthy|useful|hard|easy)\\b.*")
                || normalized.matches(".*\\b(health|english|exercise|study|work|school)\\s+(good|important|hard|easy|fun)\\b.*");
    }

    private boolean isAdditiveContentComparisonMission(FeedbackCoachMissionDto mission) {
        if (mission == null || !isComparisonMissionType(mission.missionType())) {
            return false;
        }
        String original = normalizeForComparison(mission.originalText()).toLowerCase(Locale.ROOT);
        String revised = normalizeForComparison(mission.revisedText()).toLowerCase(Locale.ROOT);
        if (original.isBlank() || revised.isBlank()) {
            return false;
        }
        int extraWords = countWords(revised) - countWords(original);
        if (countWords(original) <= 3 && extraWords >= 4) {
            return true;
        }
        String originalWithoutTerminalPunctuation = original.replaceAll("[.!?]+$", "");
        if (!revised.startsWith(original) && !revised.startsWith(originalWithoutTerminalPunctuation)) {
            return false;
        }
        return extraWords >= 3
                && revised.matches(".*\\b(because|so|when|after that|then|for example|one reason)\\b.*");
    }

    private boolean isLowValuePolishComparisonMission(FeedbackCoachMissionDto mission) {
        if (mission == null || !isComparisonMissionType(mission.missionType())) {
            return false;
        }
        String original = normalizeForComparison(mission.originalText()).toLowerCase(Locale.ROOT);
        String revised = normalizeForComparison(mission.revisedText()).toLowerCase(Locale.ROOT);
        return (original.contains("put food in the refrigerator")
                || original.contains("put the food in the refrigerator")
                || original.contains("put food in refrigerator"))
                && revised.contains("put")
                && revised.contains("food")
                && revised.contains("away");
    }

    private boolean looksLikeThinSingleSentenceAnswer(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        int wordCount = countWords(learnerAnswer);
        if (normalized.isBlank() || wordCount < 8 || wordCount > 14) {
            return false;
        }
        if (normalized.matches(".*\\b(because|so|when|if|that is why|for example)\\b.*")) {
            return false;
        }
        int sentenceCount = 0;
        Matcher matcher = Pattern.compile("[^.!?]+[.!?]*").matcher(learnerAnswer == null ? "" : learnerAnswer.trim());
        while (matcher.find()) {
            if (!matcher.group().trim().isBlank()) {
                sentenceCount++;
            }
        }
        return sentenceCount <= 1;
    }

    private boolean isThinAnswer(FeedbackDiagnosisResult diagnosis, AnswerProfile answerProfile) {
        AnswerBand answerBand = diagnosis != null && diagnosis.answerBand() != null
                ? diagnosis.answerBand()
                : answerProfile == null || answerProfile.task() == null ? null : answerProfile.task().answerBand();
        return answerBand == AnswerBand.CONTENT_THIN
                || answerBand == AnswerBand.SHORT_BUT_VALID
                || answerBand == AnswerBand.TOO_SHORT_FRAGMENT;
    }

    private boolean isMeaningfulComparisonPair(String originalText, String revisedText) {
        String original = trimToNull(originalText);
        String revised = trimToNull(revisedText);
        return original != null
                && revised != null
                && !normalizeForComparison(original).equalsIgnoreCase(normalizeForComparison(revised));
    }

    private boolean hasGenericAdjectiveReason(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return false;
        }
        return normalized.matches(".*\\bbecause\\s+(it|this|that|they|he|she)?\\s*(is|are|was|were|feels?|make[s]? me)?\\s*(very\\s+|really\\s+|so\\s+)?(good|nice|delicious|fun|interesting|exciting|excited|happy|comfortable|important|easy|convenient|warm|sweet|special|useful|healthy)\\b.*")
                || normalized.matches(".*\\bi like (it|this|that|them) because (it|this|that|they) (is|are|was|were) (good|nice|delicious|fun|interesting|exciting|warm|sweet|special|useful)\\b.*")
                || normalized.matches(".*\\b(it|this|that|they)\\s+(is|are|was|were|feels?|make[s]? me)\\s+(very\\s+|really\\s+|so\\s+)?(good|nice|delicious|fun|interesting|exciting|excited|happy|comfortable|important|easy|convenient|warm|sweet|special|useful|healthy)\\b.*");
    }

    private boolean hasFlatClosing(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        return normalized.matches(".*\\b(that is all|that's all|that s all|that all|it is all)\\b.*");
    }

    private boolean looksLikePreferenceWithReason(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        return normalized.matches(".*\\bi\\s+(really\\s+|usually\\s+)?like\\s+.+\\bbecause\\b.+")
                || normalized.matches(".*\\bmy favorite\\s+.+\\bis\\s+.+\\bbecause\\b.+");
    }

    private boolean looksLikeSingleWordAnswer(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer);
        return !normalized.isBlank()
                && countWords(normalized) <= 1
                && normalized.matches("[A-Za-z][A-Za-z'\\-]*\\.?");
    }

    private FeedbackCoachMissionDto buildFallbackCoachMission(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer,
            FeedbackSecondaryLearningPointDto firstFixPoint,
            List<RefinementCard> refinementExpressions,
            String modelAnswer
    ) {
        if (firstFixPoint != null
                && isMeaningfulComparisonPair(firstFixPoint.originalText(), firstFixPoint.revisedText())) {
            String title = firstNonBlank(
                    firstFixPoint.title(),
                    firstFixPoint.headline(),
                    "한 부분만 자연스럽게 고치기"
            );
            String reason = firstNonBlank(
                    firstFixPoint.supportText(),
                    "이 부분을 먼저 고치면 답변 전체가 더 자연스럽게 읽혀요."
            );
            return new FeedbackCoachMissionDto(
                    "GRAMMAR_FIX",
                    title,
                    firstFixPoint.originalText(),
                    firstFixPoint.revisedText(),
                    reason,
                    "위에 표시된 한 부분만 고쳐서 다시 써 보세요.",
                    null,
                    firstFixPoint.revisedText(),
                    "원래 문장에서 같은 위치에 넣어 보세요.",
                    "표시된 부분이 수정문처럼 바뀌면 성공이에요."
            );
        }

        MissionDefaults defaults = missionDefaults(diagnosis, answerProfile);
        ContentOpportunity slotAwareOpportunity = resolveContentFallbackOpportunity(
                diagnosis,
                answerProfile,
                learnerAnswer,
                null
        );
        if (slotAwareOpportunity != ContentOpportunity.NONE && !shouldProtectGrammarFallback(diagnosis)) {
            defaults = missionDefaultsForOpportunity(slotAwareOpportunity);
        }
        if (isComparisonMissionType(defaults.type())) {
            String revised = firstNonBlank(
                    diagnosis == null ? null : diagnosis.minimalCorrection(),
                    modelAnswer
            );
            if (isMeaningfulComparisonPair(learnerAnswer, revised)) {
                return new FeedbackCoachMissionDto(
                        defaults.type(),
                        defaults.titleKo(),
                        learnerAnswer,
                        revised,
                        defaults.whyKo(),
                        defaults.instructionKo(),
                        null,
                        revised,
                        defaults.targetHintKo(),
                        defaults.successCheckKo()
                );
            }
            defaults = missionDefaultsForOpportunity(resolveContentFallbackOpportunity(
                    diagnosis,
                    answerProfile,
                    learnerAnswer,
                    null
            ));
        }
        return new FeedbackCoachMissionDto(
                defaults.type(),
                defaults.titleKo(),
                null,
                null,
                defaults.whyKo(),
                defaults.instructionKo(),
                null,
                defaults.exampleEn(),
                defaults.targetHintKo(),
                defaults.successCheckKo()
        );
    }

    private boolean shouldProtectGrammarFallback(FeedbackDiagnosisResult diagnosis) {
        return diagnosis != null && (
                diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
                        || diagnosis.grammarImpact() == GrammarImpact.BLOCKING
                        || diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MODERATE.ordinal()
                        || diagnosis.meaningClarity() == MeaningClarity.BLOCKED
        );
    }

    private FeedbackCoachMissionDto buildGrammarFallbackCoachMission(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer,
            FeedbackSecondaryLearningPointDto firstFixPoint,
            List<RefinementCard> refinementExpressions,
            String modelAnswer
    ) {
        if (firstFixPoint != null
                && isMeaningfulComparisonPair(firstFixPoint.originalText(), firstFixPoint.revisedText())) {
            return buildFallbackCoachMission(
                    diagnosis,
                    answerProfile,
                    learnerAnswer,
                    firstFixPoint,
                    refinementExpressions,
                    modelAnswer
            );
        }
        String revised = firstNonBlank(
                diagnosis == null ? null : diagnosis.minimalCorrection(),
                modelAnswer
        );
        return new FeedbackCoachMissionDto(
                "GRAMMAR_FIX",
                "문장 골격 먼저 고치기",
                learnerAnswer,
                revised,
                "단어 뜻은 보이지만 문장 골격이 흔들려서, 내용을 더 붙이기 전에 한 번 자연스러운 문장으로 세우는 게 좋아요.",
                "새 내용을 더하기 전에, 같은 뜻을 주어와 동사가 분명한 한 문장으로 먼저 고쳐 보세요.",
                null,
                revised,
                "원래 말하려던 뜻은 유지하고 문장 골격만 먼저 바로잡아 보세요.",
                "같은 뜻이 자연스러운 영어 문장으로 바뀌면 성공입니다."
        );
    }

    private FeedbackCoachMissionDto buildContentFallbackCoachMission(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer,
            MissionDecision missionDecision,
            List<RefinementCard> refinementExpressions,
            String modelAnswer
    ) {
        MissionDefaults defaults = missionDefaultsForOpportunity(resolveContentFallbackOpportunity(
                diagnosis,
                answerProfile,
                learnerAnswer,
                missionDecision
        ));
        String example = missionDecision == null ? null : missionDecision.addOnExampleEn();
        return new FeedbackCoachMissionDto(
                defaults.type(),
                defaults.titleKo(),
                null,
                null,
                defaults.whyKo(),
                defaults.instructionKo(),
                example,
                defaults.exampleEn(),
                defaults.targetHintKo(),
                defaults.successCheckKo()
        );
    }

    private ContentOpportunity resolveContentFallbackOpportunity(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer,
            MissionDecision missionDecision
    ) {
        if (hasGenericAdjectiveReason(learnerAnswer)) {
            return ContentOpportunity.REASON;
        }
        if (hasFlatClosing(learnerAnswer)) {
            return ContentOpportunity.RESULT;
        }
        if (looksLikeSingleWordAnswer(learnerAnswer)) {
            return ContentOpportunity.DETAIL;
        }
        if (looksLikePreferenceWithReason(learnerAnswer)) {
            return ContentOpportunity.EXAMPLE;
        }
        ContentOpportunity slotAwareOpportunity = slotAwareFallbackOpportunity(learnerAnswer, missionDecision);
        if (slotAwareOpportunity != ContentOpportunity.NONE) {
            return slotAwareOpportunity;
        }
        if (isGoodEnoughForOptionalFallback(diagnosis, answerProfile, learnerAnswer)) {
            return ContentOpportunity.DETAIL;
        }
        ContentOpportunity decisionOpportunity = contentOpportunityFromMissionDecision(missionDecision);
        if (decisionOpportunity != ContentOpportunity.NONE) {
            return decisionOpportunity;
        }
        if (diagnosis != null && diagnosis.contentOpportunity() != ContentOpportunity.NONE) {
            return diagnosis.contentOpportunity();
        }
        AnswerBand answerBand = diagnosis != null && diagnosis.answerBand() != null
                ? diagnosis.answerBand()
                : answerProfile == null || answerProfile.task() == null ? null : answerProfile.task().answerBand();
        String action = diagnosis != null && diagnosis.rewriteTarget() != null
                ? diagnosis.rewriteTarget().action()
                : diagnosis == null ? null : diagnosis.primaryIssueCode();
        ContentOpportunity inferred = resolveContentOpportunity(diagnosis, action, answerBand);
        return inferred == ContentOpportunity.NONE ? ContentOpportunity.DETAIL : inferred;
    }

    private boolean isGoodEnoughForOptionalFallback(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            String learnerAnswer
    ) {
        AnswerBand answerBand = diagnosis != null && diagnosis.answerBand() != null
                ? diagnosis.answerBand()
                : answerProfile == null || answerProfile.task() == null ? null : answerProfile.task().answerBand();
        TaskCompletion taskCompletion = diagnosis != null && diagnosis.taskCompletion() != null
                ? diagnosis.taskCompletion()
                : answerProfile == null || answerProfile.task() == null ? null : answerProfile.task().taskCompletion();
        GrammarSeverity grammarSeverity = diagnosis != null && diagnosis.grammarSeverity() != null
                ? diagnosis.grammarSeverity()
                : answerProfile == null || answerProfile.grammar() == null ? GrammarSeverity.NONE : answerProfile.grammar().severity();
        return answerBand == AnswerBand.NATURAL_BUT_BASIC
                && taskCompletion == TaskCompletion.FULL
                && grammarSeverity.ordinal() <= GrammarSeverity.MINOR.ordinal()
                && hasRequiredSupportClause(answerProfile)
                && !hasGenericAdjectiveReason(learnerAnswer)
                && !hasFlatClosing(learnerAnswer);
    }

    private ContentOpportunity contentOpportunityFromMissionDecision(MissionDecision missionDecision) {
        if (missionDecision == null) {
            return ContentOpportunity.NONE;
        }
        ContentOpportunity chosenSlot = contentOpportunityFromCode(missionDecision.chosenSlot());
        ContentOpportunity contentNeed = contentOpportunityFromCode(missionDecision.contentNeed());
        ContentOpportunity chosenType = contentOpportunityFromCode(missionDecision.chosenType());
        ContentOpportunity opportunity = firstNonNone(chosenSlot, contentNeed, chosenType);
        if (opportunity == ContentOpportunity.NONE) {
            return firstMissingOpportunity(missionDecision);
        }
        if (slotAlreadyPresent(missionDecision, opportunity)) {
            ContentOpportunity missing = firstMissingOpportunity(missionDecision);
            return missing == ContentOpportunity.NONE ? ContentOpportunity.NONE : missing;
        }
        if (!missionDecision.missingSlots().isEmpty() && !slotMissing(missionDecision, opportunity)) {
            ContentOpportunity missing = firstMissingOpportunity(missionDecision);
            return missing == ContentOpportunity.NONE ? opportunity : missing;
        }
        return opportunity;
    }

    private ContentOpportunity contentOpportunityFromCode(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return ContentOpportunity.NONE;
        }
        return switch (normalized.toUpperCase(Locale.ROOT)) {
            case "REASON", "ADD_REASON" -> ContentOpportunity.REASON;
            case "DETAIL", "ADD_DETAIL" -> ContentOpportunity.DETAIL;
            case "EXAMPLE", "ADD_EXAMPLE" -> ContentOpportunity.EXAMPLE;
            case "SITUATION", "ADD_SITUATION" -> ContentOpportunity.SITUATION;
            case "FEELING", "ADD_FEELING" -> ContentOpportunity.FEELING;
            case "RESULT", "ADD_RESULT" -> ContentOpportunity.RESULT;
            default -> ContentOpportunity.NONE;
        };
    }

    private ContentOpportunity firstNonNone(ContentOpportunity... opportunities) {
        if (opportunities == null) {
            return ContentOpportunity.NONE;
        }
        for (ContentOpportunity opportunity : opportunities) {
            if (opportunity != null && opportunity != ContentOpportunity.NONE) {
                return opportunity;
            }
        }
        return ContentOpportunity.NONE;
    }

    private ContentOpportunity firstMissingOpportunity(MissionDecision missionDecision) {
        if (missionDecision == null || missionDecision.missingSlots().isEmpty()) {
            return ContentOpportunity.NONE;
        }
        List<ContentOpportunity> preferred = hasCoreActionSituationReason(missionDecision)
                ? List.of(
                ContentOpportunity.FEELING,
                ContentOpportunity.RESULT,
                ContentOpportunity.EXAMPLE,
                ContentOpportunity.DETAIL,
                ContentOpportunity.REASON,
                ContentOpportunity.SITUATION
        )
                : List.of(
                ContentOpportunity.REASON,
                ContentOpportunity.DETAIL,
                ContentOpportunity.EXAMPLE,
                ContentOpportunity.SITUATION,
                ContentOpportunity.FEELING,
                ContentOpportunity.RESULT
        );
        for (ContentOpportunity opportunity : preferred) {
            if (slotMissing(missionDecision, opportunity)) {
                return opportunity;
            }
        }
        return ContentOpportunity.NONE;
    }

    private boolean hasCoreActionSituationReason(MissionDecision missionDecision) {
        return missionDecision != null
                && hasSlot(missionDecision.presentSlots(), "ACTION")
                && hasSlot(missionDecision.presentSlots(), "SITUATION")
                && hasSlot(missionDecision.presentSlots(), "REASON");
    }

    private boolean slotAlreadyPresent(MissionDecision missionDecision, ContentOpportunity opportunity) {
        return missionDecision != null && slotMatches(missionDecision.presentSlots(), opportunity);
    }

    private boolean slotMissing(MissionDecision missionDecision, ContentOpportunity opportunity) {
        return missionDecision != null && slotMatches(missionDecision.missingSlots(), opportunity);
    }

    private boolean slotMatches(List<String> slots, ContentOpportunity opportunity) {
        if (slots == null || opportunity == null || opportunity == ContentOpportunity.NONE) {
            return false;
        }
        return switch (opportunity) {
            case REASON -> hasAnySlot(slots, "REASON", "WHY");
            case DETAIL -> hasAnySlot(slots, "DETAIL", "CONCRETE_DETAIL");
            case EXAMPLE -> hasAnySlot(slots, "EXAMPLE", "INSTANCE");
            case SITUATION -> hasAnySlot(slots, "SITUATION", "PLACE", "CONTEXT", "TIME", "WHERE", "WHEN");
            case FEELING -> hasAnySlot(slots, "FEELING", "REACTION", "EMOTION");
            case RESULT -> hasAnySlot(slots, "RESULT", "EFFECT", "OUTCOME");
            case NONE -> false;
        };
    }

    private boolean hasAnySlot(List<String> slots, String... candidates) {
        if (candidates == null) {
            return false;
        }
        for (String candidate : candidates) {
            if (hasSlot(slots, candidate)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasSlot(List<String> slots, String candidate) {
        if (slots == null || candidate == null) {
            return false;
        }
        String normalizedCandidate = candidate.toUpperCase(Locale.ROOT);
        return slots.stream()
                .filter(Objects::nonNull)
                .map(slot -> slot.toUpperCase(Locale.ROOT))
                .anyMatch(normalizedCandidate::equals);
    }

    private ContentOpportunity slotAwareFallbackOpportunity(
            String learnerAnswer,
            MissionDecision missionDecision
    ) {
        ContentOpportunity declaredMissing = firstMissingOpportunity(missionDecision);
        if (declaredMissing != ContentOpportunity.NONE) {
            return declaredMissing;
        }

        AnswerSlotEvidence answerSlots = inferAnswerSlots(learnerAnswer);
        if (answerSlots.hasActionSituationReason()) {
            return answerSlots.hasFeelingOrResult()
                    ? ContentOpportunity.RESULT
                    : ContentOpportunity.FEELING;
        }
        if (answerSlots.hasAction() && answerSlots.hasSituation() && !answerSlots.hasReason()) {
            return ContentOpportunity.REASON;
        }
        if (answerSlots.hasAction() && !answerSlots.hasSituation()) {
            return ContentOpportunity.SITUATION;
        }
        return ContentOpportunity.NONE;
    }

    private boolean answerSlotAlreadyPresent(AnswerSlotEvidence evidence, ContentOpportunity opportunity) {
        if (evidence == null || opportunity == null || opportunity == ContentOpportunity.NONE) {
            return false;
        }
        return switch (opportunity) {
            case REASON -> evidence.hasReason() && !evidence.hasGenericReason();
            case SITUATION -> evidence.hasSituation();
            case FEELING, RESULT -> evidence.hasFeelingOrResult();
            case DETAIL, EXAMPLE, NONE -> false;
        };
    }

    private AnswerSlotEvidence inferAnswerSlots(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return new AnswerSlotEvidence(false, false, false, false, false);
        }
        boolean hasAction = normalized.matches(".*\\b(i|we|they|he|she|it)\\s+(usually\\s+|often\\s+|sometimes\\s+|will\\s+|can\\s+|want\\s+to\\s+|like\\s+to\\s+)?[a-z]+\\b.*")
                || countWords(learnerAnswer) >= 3;
        boolean hasSituation = normalized.matches(".*\\b(on|in|at|during|before|after|when|near|inside|outside)\\b.*")
                || normalized.matches(".*\\b(bus|subway|train|car|commute|home|school|work|office|company|cafe|restaurant|morning|afternoon|evening|night|weekend|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday|breakfast|dinner)\\b.*");
        boolean hasReason = normalized.matches(".*\\b(because|so|since|to pass|to relax|to save|to improve|to get|to feel|in order to|helps? me|makes? me|for fun)\\b.*");
        boolean hasFeelingOrResult = normalized.matches(".*\\b(feel|feels|felt|happy|tired|relaxed|relaxing|calm|comfortable|better|less boring|shorter|clear my head|gives? me energy|helps? me|makes? me)\\b.*");
        boolean genericReason = hasGenericAdjectiveReason(learnerAnswer);
        return new AnswerSlotEvidence(hasAction, hasSituation, hasReason, hasFeelingOrResult, genericReason);
    }

    private record AnswerSlotEvidence(
            boolean hasAction,
            boolean hasSituation,
            boolean hasReason,
            boolean hasFeelingOrResult,
            boolean hasGenericReason
    ) {
        boolean hasActionSituationReason() {
            return hasAction && hasSituation && hasReason;
        }
    }

    private List<FeedbackSecondaryLearningPointDto> alignFixPointsWithMission(
            FeedbackCoachMissionDto mission,
            List<FeedbackSecondaryLearningPointDto> fixPoints
    ) {
        if (mission == null) {
            return fixPoints == null ? List.of() : fixPoints;
        }
        FeedbackSecondaryLearningPointDto missionPoint = missionAsLearningPoint(mission);
        if (missionPoint == null) {
            return fixPoints == null ? List.of() : fixPoints;
        }
        if ("TASK_RESET".equals(normalizedMissionType(mission))) {
            return List.of(missionPoint);
        }
        List<FeedbackSecondaryLearningPointDto> aligned = new ArrayList<>();
        aligned.add(missionPoint);
        if (fixPoints != null) {
            String missionKey = learningPointKey(missionPoint);
            for (FeedbackSecondaryLearningPointDto point : fixPoints) {
                if (point != null && !missionKey.equals(learningPointKey(point))) {
                    aligned.add(point);
                }
            }
        }
        return List.copyOf(aligned);
    }

    private FeedbackSecondaryLearningPointDto missionAsLearningPoint(FeedbackCoachMissionDto mission) {
        String title = firstNonBlank(mission.title(), "이번에 적용할 한 가지");
        String support = firstNonBlank(mission.whyKo(), mission.successCheckKo(), mission.instructionKo());
        if (trimToNull(title) == null || trimToNull(support) == null) {
            return null;
        }
        return new FeedbackSecondaryLearningPointDto(
                firstNonBlank(mission.missionType(), "MISSION"),
                title,
                firstNonBlank(mission.instructionKo(), title),
                support,
                isComparisonMissionType(mission.missionType()) ? mission.originalText() : null,
                isComparisonMissionType(mission.missionType()) ? mission.revisedText() : null,
                null,
                null,
                mission.exampleEn(),
                null
        );
    }

    private List<RefinementCard> alignRefinementsWithMission(
            FeedbackCoachMissionDto mission,
            List<RefinementCard> refinementExpressions
    ) {
        if (mission == null || refinementExpressions == null || refinementExpressions.isEmpty()) {
            return refinementExpressions == null ? List.of() : refinementExpressions;
        }
        if ("TASK_RESET".equals(normalizedMissionType(mission))) {
            return List.of();
        }
        String missionOriginal = normalizeForComparison(firstNonBlank(mission.originalText(), ""));
        String missionRevised = normalizeForComparison(firstNonBlank(mission.revisedText(), ""));
        return refinementExpressions.stream()
                .filter(card -> card != null)
                .filter(card -> {
                    String expression = normalizeForComparison(firstNonBlank(card.expression(), ""));
                    String example = normalizeForComparison(firstNonBlank(card.exampleEn(), ""));
                    return !expression.equals(missionOriginal)
                            && !expression.equals(missionRevised)
                            && !example.equals(missionRevised);
                })
                .toList();
    }

    private String normalizeMissionType(String rawType, FeedbackDiagnosisResult diagnosis) {
        String normalized = trimToNull(rawType);
        if (normalized != null) {
            normalized = normalized
                    .toUpperCase(Locale.ROOT)
                    .replace('-', '_')
                    .replaceAll("\\s+", "_")
                    .replaceAll("[^A-Z_]", "_")
                    .replaceAll("_+", "_")
                    .replaceAll("^_+|_+$", "");
        }
        if (isKnownMissionType(normalized)) {
            return normalized;
        }
        return missionDefaults(diagnosis, null).type();
    }

    private boolean isKnownMissionType(String missionType) {
        return switch (missionType == null ? "" : missionType) {
            case "REASON", "DETAIL", "SITUATION", "EXAMPLE", "FEELING", "RESULT",
                    "GRAMMAR_FIX", "TASK_RESET", "EXPRESSION_POLISH" -> true;
            default -> false;
        };
    }

    private boolean isComparisonMissionType(String missionType) {
        String normalized = trimToNull(missionType);
        if (normalized == null) {
            return false;
        }
        return switch (normalized.toUpperCase(Locale.ROOT)) {
            case "GRAMMAR_FIX", "EXPRESSION_POLISH" -> true;
            default -> false;
        };
    }

    private MissionDefaults missionDefaults(FeedbackDiagnosisResult diagnosis, AnswerProfile answerProfile) {
        AnswerBand answerBand = diagnosis == null ? null : diagnosis.answerBand();
        String action = diagnosis != null && diagnosis.rewriteTarget() != null
                ? trimToNull(diagnosis.rewriteTarget().action())
                : null;
        MissionDefaults selectedByPhilosophy = missionDefaultsByMissionPhilosophy(diagnosis, action, answerBand);
        if (selectedByPhilosophy != null) {
            return selectedByPhilosophy;
        }
        if (answerBand == AnswerBand.OFF_TOPIC || "MAKE_ON_TOPIC".equals(action) || "STATE_MAIN_ANSWER".equals(action)) {
            return new MissionDefaults(
                    "TASK_RESET",
                    "질문에 바로 답하는 문장 쓰기",
                    "질문이 묻는 핵심부터 바로 말하면 답변 방향이 또렷해져요.",
                    "질문이 묻는 행동이나 이유를 첫 문장에 바로 써 보세요.",
                    "I usually ____ because ____.",
                    "첫 문장을 질문에 대한 직접 답으로 시작해 보세요.",
                    "질문에 대한 직접 답이 첫 문장에 들어가면 성공이에요."
            );
        }
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING || "FIX_BLOCKING_GRAMMAR".equals(action) || "FIX_LOCAL_GRAMMAR".equals(action)) {
            return new MissionDefaults(
                    "GRAMMAR_FIX",
                    "가장 어색한 한 부분 고치기",
                    "한 부분만 먼저 고쳐도 문장 흐름이 훨씬 자연스러워져요.",
                    "의미를 바꾸지 말고 가장 어색한 한 부분만 자연스럽게 고쳐 보세요.",
                    "I usually ____.",
                    "틀린 표현이 있던 위치에 수정 표현을 넣어 보세요.",
                    "한 부분이 자연스러운 영어 표현으로 바뀌면 성공이에요."
            );
        }
        if ("ADD_REASON".equals(action)) {
            return new MissionDefaults(
                    "REASON",
                    "이유 한 문장 더하기",
                    "이유가 붙으면 답변이 질문에 더 충분하게 들려요.",
                    "마지막에 왜 그런지 이유를 한 문장 더 붙여 보세요.",
                    "I do this because ____.",
                    "답변 끝에 because로 시작하는 이유를 붙여 보세요.",
                    "왜 그런지 알 수 있는 이유가 한 문장 들어가면 성공이에요."
            );
        }
        if ("ADD_EXAMPLE".equals(action)) {
            return new MissionDefaults(
                    "EXAMPLE",
                    "예시 한 문장 더하기",
                    "작은 예시가 있으면 답변이 더 구체적으로 보여요.",
                    "자주 하는 행동이나 상황을 예시로 한 문장 더 써 보세요.",
                    "For example, I ____.",
                    "답변 뒤에 For example로 시작하는 문장을 붙여 보세요.",
                    "구체적인 예시가 한 문장 들어가면 성공이에요."
            );
        }
        if (answerBand == AnswerBand.NATURAL_BUT_BASIC || "IMPROVE_NATURALNESS".equals(action)) {
            return new MissionDefaults(
                    "EXPRESSION_POLISH",
                    "조금 더 자연스럽게 다듬기",
                    "지금 답도 괜찮지만 표현 하나를 다듬으면 더 매끄러워져요.",
                    "의미는 유지하고 가장 어색한 표현 하나만 자연스럽게 바꿔 보세요.",
                    "I usually ____ after that.",
                    "가장 어색하게 느껴지는 한 표현만 바꿔 보세요.",
                    "의미는 같고 표현만 더 자연스러워지면 성공이에요."
            );
        }
        return new MissionDefaults(
                "SITUATION",
                "상황 한 문장 더하기",
                "언제나 어떤 상황인지 조금만 더 붙이면 답변이 선명해져요.",
                "언제, 어디서, 어떤 상황인지 한 문장 더 붙여 보세요.",
                "When I ____, I ____.",
                "답변 앞이나 뒤에 상황을 설명하는 짧은 문장을 붙여 보세요.",
                "상황을 보여 주는 정보가 한 문장 들어가면 성공이에요."
        );
    }

    private MissionDefaults missionDefaultsByMissionPhilosophy(
            FeedbackDiagnosisResult diagnosis,
            String action,
            AnswerBand answerBand
    ) {
        if (answerBand == AnswerBand.OFF_TOPIC || "MAKE_ON_TOPIC".equals(action) || "STATE_MAIN_ANSWER".equals(action)) {
            return missionDefault(
                    "TASK_RESET",
                    "질문에 바로 답하는 문장 쓰기",
                    "질문이 묻는 핵심을 먼저 말하면 답변 방향이 분명해져요.",
                    "첫 문장에서 질문에 대한 직접 답을 써 보세요.",
                    "I usually ____ because ____.",
                    "첫 문장에 질문에 대한 직접 답을 넣어 보세요.",
                    "질문에 대한 직접 답이 첫 문장에 들어가면 성공이에요."
            );
        }
        if (answerBand == AnswerBand.TOO_SHORT_FRAGMENT) {
            return missionDefault(
                    "TASK_RESET",
                    "완전한 한 문장으로 시작하기",
                    "먼저 한 문장을 완성해야 다음 단계 피드백이 쉬워져요.",
                    "주어와 동사가 있는 짧은 한 문장으로 답해 보세요.",
                    "I usually ____.",
                    "첫 줄에 완전한 한 문장을 써 보세요.",
                    "주어와 동사가 있는 한 문장이 되면 성공이에요."
            );
        }
        if (isBlockingGrammarMission(diagnosis, action, answerBand)) {
            return missionDefault(
                    "GRAMMAR_FIX",
                    "가장 중요한 문법 고치기",
                    "이 부분을 먼저 고치면 문장 뜻이 훨씬 또렷해져요.",
                    "의미를 바꾸지 말고 가장 어색한 부분 하나만 고쳐 보세요.",
                    "I usually ____.",
                    "원래 문장의 같은 위치에 수정 표현을 넣어 보세요.",
                    "뜻이 막히던 부분이 자연스러운 표현으로 바뀌면 성공이에요."
            );
        }
        ContentOpportunity opportunity = resolveContentOpportunity(diagnosis, action, answerBand);
        if (opportunity != ContentOpportunity.NONE) {
            return missionDefaultsForOpportunity(opportunity);
        }
        if (answerBand == AnswerBand.NATURAL_BUT_BASIC
                || "IMPROVE_NATURALNESS".equals(action)
                || (diagnosis != null && diagnosis.grammarImpact() != GrammarImpact.NONE)) {
            return missionDefault(
                    "EXPRESSION_POLISH",
                    "조금 더 자연스럽게 다듬기",
                    "이미 충분히 좋아요. 표현 하나만 다듬으면 더 매끄러워져요.",
                    "의미는 그대로 두고 가장 어색한 표현 하나만 자연스럽게 바꿔 보세요.",
                    "I usually ____ after that.",
                    "어색한 표현 하나만 같은 자리에 바꿔 넣어 보세요.",
                    "뜻은 같고 표현만 더 자연스러워지면 성공이에요."
            );
        }
        return missionDefaultsForOpportunity(ContentOpportunity.DETAIL);
    }

    private boolean isBlockingGrammarMission(
            FeedbackDiagnosisResult diagnosis,
            String action,
            AnswerBand answerBand
    ) {
        return (answerBand == AnswerBand.GRAMMAR_BLOCKING
                && answerBand != AnswerBand.TOO_SHORT_FRAGMENT)
                || "FIX_BLOCKING_GRAMMAR".equals(action)
                || (diagnosis != null && (
                diagnosis.grammarImpact() == GrammarImpact.BLOCKING
                        || diagnosis.grammarSeverity() == GrammarSeverity.MAJOR
                        || diagnosis.meaningClarity() == MeaningClarity.BLOCKED
        ));
    }

    private ContentOpportunity resolveContentOpportunity(
            FeedbackDiagnosisResult diagnosis,
            String action,
            AnswerBand answerBand
    ) {
        if (diagnosis != null && diagnosis.contentOpportunity() != ContentOpportunity.NONE) {
            return diagnosis.contentOpportunity();
        }
        if ("ADD_REASON".equals(action)) {
            return ContentOpportunity.REASON;
        }
        if ("ADD_EXAMPLE".equals(action)) {
            return ContentOpportunity.EXAMPLE;
        }
        if ("ADD_SITUATION".equals(action)) {
            return ContentOpportunity.SITUATION;
        }
        if ("ADD_FEELING".equals(action)) {
            return ContentOpportunity.FEELING;
        }
        if ("ADD_RESULT".equals(action)) {
            return ContentOpportunity.RESULT;
        }
        if ("ADD_DETAIL".equals(action)
                || answerBand == AnswerBand.CONTENT_THIN
                || answerBand == AnswerBand.SHORT_BUT_VALID) {
            return ContentOpportunity.DETAIL;
        }
        return ContentOpportunity.NONE;
    }

    private MissionDefaults missionDefaultsForOpportunity(ContentOpportunity opportunity) {
        return switch (opportunity == null ? ContentOpportunity.DETAIL : opportunity) {
            case REASON -> missionDefault(
                    "REASON",
                    "이유 한 문장 더하기",
                    "이유가 붙으면 답변이 질문에 더 충분하게 느껴져요.",
                    "마지막에 왜 그런지 한 문장 더 붙여 보세요.",
                    "I do this because ____.",
                    "답변 끝에 because 문장을 붙여 보세요.",
                    "왜 그런지 알 수 있는 이유가 한 문장 들어가면 성공이에요."
            );
            case EXAMPLE -> missionDefault(
                    "EXAMPLE",
                    "예시 한 문장 더하기",
                    "예시가 있으면 답변이 더 실제 상황처럼 보여요.",
                    "자주 하는 행동이나 상황을 예시로 한 문장 더 써 보세요.",
                    "For example, I ____.",
                    "답변 뒤에 For example로 시작하는 문장을 붙여 보세요.",
                    "구체적인 예시가 한 문장 들어가면 성공이에요."
            );
            case SITUATION -> missionDefault(
                    "SITUATION",
                    "상황 한 문장 더하기",
                    "언제나 어떤 상황인지 붙이면 답변 흐름이 더 선명해져요.",
                    "언제, 어디서, 어떤 상황인지 한 문장 더 붙여 보세요.",
                    "When I ____, I ____.",
                    "답변 앞이나 뒤에 상황을 설명하는 짧은 문장을 붙여 보세요.",
                    "상황을 보여 주는 정보가 한 문장 들어가면 성공이에요."
            );
            case FEELING -> missionDefault(
                    "FEELING",
                    "느낌 한 문장 더하기",
                    "느낌이 들어가면 답변이 더 개인적으로 들려요.",
                    "그때 어떤 기분이었는지 한 문장 더 붙여 보세요.",
                    "I feel ____ when ____.",
                    "답변 끝에 느낌을 말하는 문장을 붙여 보세요.",
                    "내 감정이 한 문장 들어가면 성공이에요."
            );
            case RESULT -> missionDefault(
                    "RESULT",
                    "결과 한 문장 더하기",
                    "그 행동 뒤에 어떻게 되었는지 말하면 답변이 잘 마무리돼요.",
                    "그다음 어떤 결과가 있었는지 한 문장 더 붙여 보세요.",
                    "After that, I ____.",
                    "답변 마지막에 결과를 말하는 문장을 붙여 보세요.",
                    "행동 뒤의 결과가 한 문장 들어가면 성공이에요."
            );
            case DETAIL, NONE -> missionDefault(
                    "DETAIL",
                    "구체적인 정보 한 문장 더하기",
                    "작은 정보 하나가 붙으면 답변이 덜 막연해져요.",
                    "언제, 어디서, 무엇을 하는지 구체적인 정보 하나를 더해 보세요.",
                    "I usually do this when ____.",
                    "기존 답변 뒤에 구체적인 정보 한 문장을 붙여 보세요.",
                    "구체적인 장면이나 정보가 하나 들어가면 성공이에요."
            );
        };
    }

    private MissionDefaults missionDefault(
            String type,
            String titleKo,
            String whyKo,
            String instructionKo,
            String exampleEn,
            String targetHintKo,
            String successCheckKo
    ) {
        return new MissionDefaults(type, titleKo, whyKo, instructionKo, exampleEn, targetHintKo, successCheckKo);
    }

    private record MissionDefaults(
            String type,
            String titleKo,
            String whyKo,
            String instructionKo,
            String exampleEn,
            String targetHintKo,
            String successCheckKo
    ) {
    }

    private List<ValidationFailure> validateFixPointExplanationCoverage(List<FeedbackSecondaryLearningPointDto> fixPoints) {
        if (fixPoints == null || fixPoints.isEmpty()) {
            return List.of();
        }
        for (FeedbackSecondaryLearningPointDto point : fixPoints) {
            if (point == null || !isUnderExplainedFixPoint(point)) {
                continue;
            }
            return List.of(new ValidationFailure(
                    SectionKey.IMPROVEMENT,
                    ValidationFailureCode.LOW_VALUE_SECTION,
                    "Fix point explanation is too thin for the number of visible edits"
            ));
        }
        return List.of();
    }

    private boolean isUnderExplainedFixPoint(FeedbackSecondaryLearningPointDto point) {
        String originalText = trimToNull(point.originalText());
        String revisedText = trimToNull(point.revisedText());
        if (originalText == null || revisedText == null) {
            return false;
        }

        List<InlineFeedbackSegmentDto> changedSegments = buildPreciseInlineFeedback(originalText, revisedText).stream()
                .filter(segment -> segment != null && !"KEEP".equals(segment.type()))
                .filter(this::isMeaningfulChangeSegment)
                .toList();
        if (changedSegments.size() < 2) {
            return false;
        }

        String supportText = trimToNull(point.supportText());
        String explanationText = normalizeForComparison(String.join(" ",
                firstNonBlank(point.title(), ""),
                firstNonBlank(point.headline(), ""),
                firstNonBlank(point.supportText(), "")
        )).toLowerCase(Locale.ROOT);
        List<String> changeAnchors = extractMeaningfulChangeAnchors(changedSegments);
        int coveredAnchors = countCoveredChangeAnchors(explanationText, changeAnchors);

        if (isGenericFixPointSupport(supportText)) {
            return true;
        }

        if (changedSegments.size() >= 3 && (supportText == null || supportText.length() < 28)) {
            return true;
        }

        return changeAnchors.size() >= 2
                && coveredAnchors < 2
                && (supportText == null || supportText.length() < 40);
    }

    private boolean isGenericFixPointSupport(String supportText) {
        String normalized = trimToNull(supportText);
        if (normalized == null) {
            return false;
        }
        String lowerCased = normalized.toLowerCase(Locale.ROOT);
        boolean hasGenericPhrase = GENERIC_FIX_POINT_SUPPORT_PHRASES.stream()
                .map(phrase -> phrase.toLowerCase(Locale.ROOT))
                .anyMatch(lowerCased::contains);
        if (!hasGenericPhrase) {
            return false;
        }
        return SPECIFIC_FIX_POINT_REASON_KEYWORDS.stream()
                .map(keyword -> keyword.toLowerCase(Locale.ROOT))
                .noneMatch(lowerCased::contains);
    }

    private boolean isMeaningfulChangeSegment(InlineFeedbackSegmentDto segment) {
        if (segment == null) {
            return false;
        }
        return containsLatinOrDigit(segment.originalText()) || containsLatinOrDigit(segment.revisedText());
    }

    private List<String> extractMeaningfulChangeAnchors(List<InlineFeedbackSegmentDto> changedSegments) {
        if (changedSegments == null || changedSegments.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> anchors = new LinkedHashSet<>();
        for (InlineFeedbackSegmentDto segment : changedSegments) {
            String anchor = firstNonBlank(
                    sanitizeChangeAnchor(segment.revisedText()),
                    sanitizeChangeAnchor(segment.originalText())
            );
            if (anchor != null) {
                anchors.add(anchor);
            }
        }
        return List.copyOf(anchors);
    }

    private String sanitizeChangeAnchor(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null || !containsLatinOrDigit(trimmed)) {
            return null;
        }
        String normalized = trimmed
                .replaceAll("^[^A-Za-z0-9]+|[^A-Za-z0-9]+$", "")
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return null;
        }
        if (!normalized.contains(" ")) {
            if (normalized.length() < 3 || EXPLANATION_ANCHOR_STOPWORDS.contains(normalized)) {
                return null;
            }
        }
        return normalized;
    }

    private int countCoveredChangeAnchors(String explanationText, List<String> changeAnchors) {
        if (explanationText == null || explanationText.isBlank() || changeAnchors == null || changeAnchors.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (String anchor : changeAnchors) {
            if (anchor != null && !anchor.isBlank() && explanationText.contains(anchor)) {
                count++;
            }
        }
        return count;
    }

    private boolean containsLatinOrDigit(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if ((character >= 'A' && character <= 'Z')
                    || (character >= 'a' && character <= 'z')
                    || Character.isDigit(character)) {
                return true;
            }
        }
        return false;
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
        FeedbackUiDto generatedUi = (!fixPoints.isEmpty()
                || !generatedSections.rewriteSuggestions().isEmpty())
                ? new FeedbackUiDto(
                null,
                null,
                null,
                fixPoints,
                null,
                generatedSections.rewriteSuggestions(),
                null,
                null
        )
                : null;
        FeedbackCoachMissionDto coachMission = generatedSections.coachMission();
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
                List.of(),
                grammarFeedback,
                null,
                toRefinementExpressionDtos(generatedSections.refinementExpressions()),
                generatedSections.modelAnswer(),
                generatedSections.modelAnswerKo(),
                null,
                generatedSections.usedExpressions(),
                generatedUi,
                null,
                coachMission == null ? null : coachMission.toCoachMove(),
                coachMission == null ? null : coachMission.toRewriteWorkspace(learnerAnswer),
                null,
                null
        );
    }

    private List<FeedbackSecondaryLearningPointDto> resolveGeneratedFixPoints(GeneratedSections generatedSections) {
        if (generatedSections == null) {
            return List.of();
        }
        if (generatedSections.fixPoints() != null && !generatedSections.fixPoints().isEmpty()) {
            return dedupeCorrectionFixPoints(generatedSections.fixPoints());
        }
        return List.of();
    }

    private List<FeedbackSecondaryLearningPointDto> dedupeCorrectionFixPoints(
            List<FeedbackSecondaryLearningPointDto> candidates
    ) {
        if (candidates == null || candidates.isEmpty()) {
            return List.of();
        }
        List<FeedbackSecondaryLearningPointDto> fixPoints = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (FeedbackSecondaryLearningPointDto point : candidates) {
            if (point == null || "EXPRESSION".equals(trimToNull(point.kind()))) {
                continue;
            }
            String key = learningPointKey(point);
            if (key.isBlank() || !seen.add(key)) {
                continue;
            }
            fixPoints.add(point);
        }
        return List.copyOf(fixPoints);
    }

    private FeedbackSecondaryLearningPointDto firstCorrectionFixPoint(
            List<FeedbackSecondaryLearningPointDto> fixPoints
    ) {
        if (fixPoints == null || fixPoints.isEmpty()) {
            return null;
        }
        for (FeedbackSecondaryLearningPointDto point : fixPoints) {
            if (point != null
                    && !"EXPRESSION".equals(trimToNull(point.kind()))
                    && isMeaningfulComparisonPair(point.originalText(), point.revisedText())) {
                return point;
            }
        }
        for (FeedbackSecondaryLearningPointDto point : fixPoints) {
            if (point != null && !"EXPRESSION".equals(trimToNull(point.kind()))) {
                return point;
            }
        }
        return null;
    }

    private String learningPointKey(FeedbackSecondaryLearningPointDto point) {
        if (point == null) {
            return "";
        }
        return normalizeForComparison(
                firstNonBlank(point.kind(), "")
                        + "|" + firstNonBlank(point.title(), "")
                        + "|" + firstNonBlank(point.headline(), "")
                        + "|" + firstNonBlank(point.supportText(), "")
                        + "|" + firstNonBlank(point.originalText(), "")
                        + "|" + firstNonBlank(point.revisedText(), "")
                        + "|" + firstNonBlank(point.exampleEn(), "")
        );
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
                null,
                grammarFeedback,
                generatedSections.corrections(),
                generatedSections.refinementExpressions(),
                null,
                generatedSections.modelAnswer(),
                generatedSections.modelAnswerKo(),
                List.of(),
                generatedSections.usedExpressions(),
                !resolveGeneratedFixPoints(generatedSections).isEmpty()
                        ? resolveGeneratedFixPoints(generatedSections)
                        : resolveGeneratedFixPoints(fallbackSections),
                List.of(),
                null,
                !generatedSections.rewriteSuggestions().isEmpty()
                        ? generatedSections.rewriteSuggestions()
                        : fallbackSections.rewriteSuggestions(),
                generatedSections.coachMission() != null
                        ? generatedSections.coachMission()
                        : fallbackSections.coachMission(),
                generatedSections.missionDecision() != null
                        ? generatedSections.missionDecision()
                        : fallbackSections.missionDecision()
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
            return List.of("질문의 핵심에 맞는 답이 이미 들어 있어서, 지금도 충분히 완성도 있는 답이에요.");
        }
        if (answerProfile != null && answerProfile.content() != null && answerProfile.content().signals() != null) {
            ContentSignals signals = answerProfile.content().signals();
            if (signals.hasMainAnswer() && signals.hasReason()) {
                return List.of("질문에 바로 답하고 이유까지 붙여서, 답의 기본 구조가 잘 잡혀 있어요.");
            }
            if (signals.hasMainAnswer() && signals.hasActivity()) {
                return List.of("핵심 답변 뒤에 활동이나 예시가 이어져서, 문장이 조금 더 살아 있어요.");
            }
            if (signals.hasMainAnswer()) {
                return List.of("질문에 맞는 핵심 답을 먼저 적어서, 읽는 사람이 바로 이해하기 쉬워요.");
            }
        }
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.OFF_TOPIC) {
            return List.of("질문과 완전히 맞지는 않아도, 말하려는 방향은 어느 정도 보여요.");
        }
        return List.of("핵심 답을 먼저 적어서, 답의 중심이 흔들리지 않고 있어요.");
    }
    private List<String> resolveFallbackStrengths(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        if (diagnosis != null && diagnosis.finishable()) {
            return List.of("The answer already covers the core of the question, so it feels complete even now.");
        }
        if (answerProfile != null && answerProfile.content() != null && answerProfile.content().signals() != null) {
            ContentSignals signals = answerProfile.content().signals();
            if (signals.hasMainAnswer() && signals.hasReason()) {
                return List.of("You answered the question directly and added a reason, so the basic structure is already there.");
            }
            if (signals.hasMainAnswer() && signals.hasActivity()) {
                return List.of("The main answer is followed by an activity or example, so the response feels more alive.");
            }
            if (signals.hasMainAnswer()) {
                return List.of("You stated the core answer clearly first, so the reader can understand your point right away.");
            }
        }
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.OFF_TOPIC) {
            return List.of("Even if it is not fully on topic yet, your intended direction is still visible.");
        }
        return List.of("You put the core answer first, so the response still has a clear center.");
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
                null,
                List.of(),
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
                diagnosis.grammarSeverity(),
                diagnosisIssues.isEmpty() ? baseProfile.grammar().issues() : diagnosisIssues,
                firstNonBlank(diagnosis.minimalCorrection(), baseProfile.grammar().minimalCorrection()),
                false
        );
        RewriteProfile mergedRewrite = new RewriteProfile(
                firstNonBlank(diagnosis.primaryIssueCode(), baseProfile.rewrite().primaryIssueCode()),
                firstNonBlank(diagnosis.secondaryIssueCode(), baseProfile.rewrite().secondaryIssueCode()),
                diagnosis.rewriteTarget() == null ? baseProfile.rewrite().target() : diagnosis.rewriteTarget(),
                diagnosis.expansionBudget() == null ? baseProfile.rewrite().expansionBudget() : diagnosis.expansionBudget(),
                diagnosis.regressionSensitiveFacts().isEmpty()
                        ? baseProfile.rewrite().regressionSensitiveFacts()
                        : diagnosis.regressionSensitiveFacts(),
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
            case "VERB_PATTERN" -> "동사 형태가 문장 주어와 맞지 않아 보여서, 올바른 동사 모양으로 맞춰 주면 더 자연스러워져요.";
            case "PREPOSITION" -> "전치사가 어울리는 표현과 잘 맞지 않아 보여서, 자주 함께 쓰는 형태로 바꾸면 좋아요.";
            case "ARTICLE" -> "관사 사용이 어색해서, 셀 수 있는 명사인지와 앞뒤 맥락을 함께 보고 고치면 좋아요.";
            case "AGREEMENT" -> "주어와 동사 수일치가 맞지 않아 보여서, 둘의 형태를 함께 맞춰 주세요.";
            case "TENSE_ALIGNMENT" -> "문장 안 시제가 서로 어긋나 보여서, 같은 시간 기준으로 정리하면 자연스러워져요.";
            case "POINT_OF_VIEW_ALIGNMENT" -> "문장 안 시점이나 주체가 흔들려 보여서, 한 관점으로 맞추면 읽기 쉬워져요.";
            default -> "이 부분은 표현 방식이 어색해서, 더 자주 쓰는 영어 패턴으로 다듬으면 좋아요.";
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

        if (isInlineDiffTooLarge(safeOriginalText, safeRevisedText)) {
            return List.of(new InlineFeedbackSegmentDto("REPLACE", safeOriginalText, safeRevisedText));
        }

        List<InlineFeedbackSegmentDto> expanded = expandReplaceSegment(safeOriginalText, safeRevisedText);
        if (expanded != null && !expanded.isEmpty()) {
            return mergeSegments(expanded);
        }

        return List.of(new InlineFeedbackSegmentDto("REPLACE", safeOriginalText, safeRevisedText));
    }

    private boolean isInlineDiffTooLarge(String originalText, String revisedText) {
        return originalText.length() > MAX_INLINE_DIFF_TEXT_CHARS
                || revisedText.length() > MAX_INLINE_DIFF_TEXT_CHARS;
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
        return buildGenerationRequestBody(
                prompt,
                answer,
                hints,
                diagnosis,
                answerProfile,
                sectionPolicy,
                attemptIndex,
                previousAnswer,
                null,
                requestedSections,
                failureCodes,
                previousSections
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
            String previousCoachingSummary,
            List<SectionKey> requestedSections,
            List<ValidationFailureCode> failureCodes,
            GeneratedSections previousSections
    ) throws IOException {
        Map<String, Object> expressionTagsSchema = ExpressionTagSupport.jsonSchema();
        List<String> missionSlotEnum = List.of(
                "ACTION",
                "SITUATION",
                "REASON",
                "DETAIL",
                "EXAMPLE",
                "FEELING",
                "RESULT"
        );
        List<String> chosenSlotEnum = List.of(
                "NONE",
                "REASON",
                "DETAIL",
                "SITUATION",
                "EXAMPLE",
                "FEELING",
                "RESULT"
        );
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
                        Map.entry("meaningClarity", Map.of("type", "string", "enum", List.of("CLEAR", "PARTLY_CLEAR", "BLOCKED"))),
                        Map.entry("grammarImpact", Map.of("type", "string", "enum", List.of("NONE", "POLISH", "LOCAL", "BLOCKING"))),
                        Map.entry("contentOpportunity", Map.of("type", "string", "enum", List.of(
                                "NONE",
                                "REASON",
                                "DETAIL",
                                "EXAMPLE",
                                "SITUATION",
                                "FEELING",
                                "RESULT"
                        ))),
                        Map.entry("selectedMissionReason", Map.of("type", List.of("string", "null"))),
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
                        )),
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
                        Map.entry("usedExpressions", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "expression", Map.of("type", "string"),
                                                "meaningKo", Map.of("type", List.of("string", "null")),
                                                "exampleEn", Map.of("type", List.of("string", "null")),
                                                "usageTip", Map.of("type", "string"),
                                                "tags", expressionTagsSchema
                                        ),
                                        "required", List.of("expression", "meaningKo", "exampleEn", "usageTip", "tags")
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
                        Map.entry("missionDecision", Map.of(
                                "type", "object",
                                "additionalProperties", false,
                                "properties", Map.ofEntries(
                                        Map.entry("chosenType", Map.of("type", "string", "enum", List.of(
                                                "REASON",
                                                "DETAIL",
                                                "SITUATION",
                                                "EXAMPLE",
                                                "FEELING",
                                                "RESULT",
                                                "GRAMMAR_FIX",
                                                "TASK_RESET",
                                                "EXPRESSION_POLISH"
                                        ))),
                                        Map.entry("grammarPriority", Map.of("type", "string", "enum", List.of(
                                                "NONE",
                                                "LOW_VALUE_POLISH",
                                                "HIGH_VALUE_LOCAL",
                                                "BLOCKING"
                                        ))),
                                        Map.entry("contentNeed", Map.of("type", "string", "enum", List.of(
                                                "NONE",
                                                "REASON",
                                                "DETAIL",
                                                "SITUATION",
                                                "EXAMPLE",
                                                "FEELING",
                                                "RESULT"
                                        ))),
                                        Map.entry("presentSlots", Map.of(
                                                "type", "array",
                                                "items", Map.of("type", "string", "enum", missionSlotEnum)
                                        )),
                                        Map.entry("missingSlots", Map.of(
                                                "type", "array",
                                                "items", Map.of("type", "string", "enum", missionSlotEnum)
                                        )),
                                        Map.entry("chosenSlot", Map.of("type", "string", "enum", chosenSlotEnum)),
                                        Map.entry("whyChosenKo", Map.of("type", "string")),
                                        Map.entry("whyNotGrammarFirstKo", Map.of("type", List.of("string", "null"))),
                                        Map.entry("addOnExampleEn", Map.of("type", List.of("string", "null"))),
                                        Map.entry("addOnPlacementKo", Map.of("type", List.of("string", "null"))),
                                        Map.entry("minorFixes", Map.of(
                                                "type", "array",
                                                "items", Map.of(
                                                        "type", "object",
                                                        "additionalProperties", false,
                                                        "properties", Map.of(
                                                                "originalText", Map.of("type", List.of("string", "null")),
                                                                "revisedText", Map.of("type", List.of("string", "null")),
                                                                "reasonKo", Map.of("type", List.of("string", "null"))
                                                        ),
                                                        "required", List.of("originalText", "revisedText", "reasonKo")
                                                )
                                        ))
                                ),
                                "required", List.of(
                                        "chosenType",
                                        "grammarPriority",
                                        "contentNeed",
                                        "presentSlots",
                                        "missingSlots",
                                        "chosenSlot",
                                        "whyChosenKo",
                                        "whyNotGrammarFirstKo",
                                        "addOnExampleEn",
                                        "addOnPlacementKo",
                                        "minorFixes"
                                )
                        )),
                        Map.entry("coachMission", Map.of(
                                "type", "object",
                                "additionalProperties", false,
                                "properties", Map.ofEntries(
                                        Map.entry("missionType", Map.of("type", "string")),
                                        Map.entry("title", Map.of("type", "string")),
                                        Map.entry("originalText", Map.of("type", List.of("string", "null"))),
                                        Map.entry("revisedText", Map.of("type", List.of("string", "null"))),
                                        Map.entry("whyKo", Map.of("type", "string")),
                                        Map.entry("instructionKo", Map.of("type", "string")),
                                        Map.entry("exampleEn", Map.of("type", List.of("string", "null"))),
                                        Map.entry("skeletonEn", Map.of("type", List.of("string", "null"))),
                                        Map.entry("skeletonKo", Map.of("type", List.of("string", "null"))),
                                        Map.entry("suggestedPhrases", Map.of(
                                                "type", "array",
                                                "items", Map.of(
                                                        "type", "object",
                                                        "additionalProperties", false,
                                                        "properties", Map.of(
                                                                "phrase", Map.of("type", "string"),
                                                                "meaningKo", Map.of("type", "string")
                                                        ),
                                                        "required", List.of("phrase", "meaningKo")
                                                )
                                        )),
                                        Map.entry("placeholderEn", Map.of("type", "string")),
                                        Map.entry("targetHintKo", Map.of("type", "string")),
                                        Map.entry("successCheckKo", Map.of("type", List.of("string", "null")))
                                ),
                                "required", List.of(
                                        "missionType",
                                        "title",
                                        "originalText",
                                        "revisedText",
                                        "whyKo",
                                        "instructionKo",
                                        "exampleEn",
                                        "skeletonEn",
                                        "skeletonKo",
                                        "suggestedPhrases",
                                        "placeholderEn",
                                        "targetHintKo",
                                        "successCheckKo"
                                )
                        )),
                        Map.entry("modelAnswer", Map.of("type", List.of("string", "null"))),
                        Map.entry("modelAnswerKo", Map.of("type", List.of("string", "null")))
                )),
                Map.entry("required", List.of(
                        "score",
                        "answerBand",
                        "taskCompletion",
                        "onTopic",
                        "finishable",
                        "meaningClarity",
                        "grammarImpact",
                        "contentOpportunity",
                        "selectedMissionReason",
                        "grammarSeverity",
                        "minimalCorrection",
                        "primaryIssueCode",
                        "secondaryIssueCode",
                        "rewriteTarget",
                        "expansionBudget",
                        "regressionSensitiveFacts",
                        "grammarIssues",
                        "strengths",
                        "fixPoints",
                        "usedExpressions",
                        "refinementExpressions",
                        "missionDecision",
                        "coachMission",
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
                        previousCoachingSummary,
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

    private String buildGenerationPrompt(
            PromptDto prompt,
            String answer,
            List<PromptHintDto> hints,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            SectionPolicy sectionPolicy,
            int attemptIndex,
            String previousAnswer,
            String previousCoachingSummary,
            List<SectionKey> requestedSections,
            List<ValidationFailureCode> failureCodes,
            GeneratedSections previousSections
    ) throws IOException {
        String coachProfileGuidance = PromptOpenAiContextFormatter.formatCoachProfileInstructions(prompt);
        String hintText = PromptOpenAiContextFormatter.formatPromptHints(hints);
        String requestedSectionText = formatRequestedSectionsForPrompt(requestedSections);
        boolean hasRetryContext = (failureCodes != null && !failureCodes.isEmpty()) || previousSections != null;
        String retryContext = "";
        if (hasRetryContext) {
            String retryFailures = failureCodes == null || failureCodes.isEmpty()
                    ? "- none"
                    : "- " + failureCodes.stream().map(Enum::name).reduce((left, right) -> left + ", " + right).orElse("");
            String retrySpecificInstructions = buildRetrySpecificInstructionsV2(failureCodes, requestedSections);
            String previousSectionJson = previousSections == null ? "{}" : objectMapper.writeValueAsString(previousSections);
            retryContext = """
                    Retry notes:
                    %s
                    Retry-specific instructions:
                    %s
                    Return only these section groups:
                    - %s
                    Previous generated sections JSON:
                    %s

                    """.formatted(
                    retryFailures,
                    retrySpecificInstructions,
                    requestedSectionText,
                    previousSectionJson
            );
        }
        String bandGuidance = diagnosis == null
                ? "- Derive the diagnosis first, then choose coachMission as the source of truth and make every section consistent with it."
                : generationBandGuidance(diagnosis.answerBand());
        ProgressDelta progressDelta = answerProfile == null || answerProfile.rewrite() == null
                ? null
                : answerProfile.rewrite().progressDelta();
        String improvedAreas = progressDelta == null ? "[]" : progressDelta.improvedAreas().toString();
        String remainingAreas = progressDelta == null ? "[]" : progressDelta.remainingAreas().toString();
        String allowedExpressionTags = ExpressionTagSupport.formatAllowedTagsForPrompt();
        String previousCoachingSummaryText = previousCoachingSummary == null || previousCoachingSummary.isBlank()
                ? "none"
                : previousCoachingSummary.trim();
        String analysisContext = diagnosis == null
                ? """
                First-pass diagnosis:
                - Diagnose the learner answer inside this same JSON object first.
                - Fill missionDecision immediately after diagnosis, then build coachMission from that decision.
                - Keep diagnosis, missionDecision, coachMission, fixPoints, refinementExpressions, and modelAnswer aligned with each other.
                - attemptIndex: %s
                - history.previousAnswerOnlyDoNotEvaluateAsCurrent: %s
                - previousCoachingSummary:
                %s
                - progress.improvedAreas: %s
                - progress.remainingAreas: %s
                - Return all distinct, high-value teaching points that genuinely help the learner, and avoid overlap or filler.
                """.formatted(
                attemptIndex,
                previousAnswer == null || previousAnswer.isBlank() ? "null" : previousAnswer,
                previousCoachingSummaryText,
                improvedAreas,
                remainingAreas
        )
                : """
                Backend source of truth:
                - answerBand: %s
                - taskCompletion: %s
                - onTopic: %s
                - finishable: %s
                - attemptIndex: %s
                - history.previousAnswerOnlyDoNotEvaluateAsCurrent: %s
                - previousCoachingSummary:
                %s
                - progress.improvedAreas: %s
                - progress.remainingAreas: %s
                - Keep the regenerated sections aligned with this diagnosis.
                """.formatted(
                diagnosis.answerBand().name(),
                diagnosis.taskCompletion().name(),
                diagnosis.onTopic(),
                diagnosis.finishable(),
                attemptIndex,
                previousAnswer == null || previousAnswer.isBlank() ? "null" : previousAnswer,
                previousCoachingSummaryText,
                improvedAreas,
                remainingAreas
        );

        return """
                You are generating English-learner feedback for a rewrite-first coaching app.
                Return valid JSON only.

                %s

                Core quality contract:
                - Decide one learner action first. missionDecision.chosenType, coachMission.missionType, the first fixPoint, and rewrite guide must all support that same action. For add-on missions only, skeletonEn, skeletonKo, and suggestedPhrases must also support it.
                - Do not make modelAnswer the teaching plan. It is only a quiet reference after the mission is chosen.
                - Do not depend on backend fallback. If a field is visible to the learner, write it specifically for this answer.
                - For add-on missions, coachMission.skeletonEn, coachMission.skeletonKo, and coachMission.suggestedPhrases replace the old complete example sentence: give a reusable sentence frame, a Korean meaning for that frame, plus phrase options the learner can choose from. Each suggested phrase must include phrase and meaningKo.
                - For correction missions (GRAMMAR_FIX or EXPRESSION_POLISH), do not return a learner scaffold. Set coachMission.skeletonEn=null, coachMission.skeletonKo=null, and coachMission.suggestedPhrases=[] because the before/after comparison already shows the exact edit.
                - Before returning JSON, run the final self-check near the end of this prompt and revise any mismatch inside the JSON.

                Current answer boundary:
                - The CURRENT LEARNER ANSWER at the bottom of this prompt is the only submission you may diagnose, quote, correct, or put into coachMission.originalText, fixPoints.originalText, grammarIssues.span, minimalCorrection, correctedAnswer, modelAnswer, or rewriteWorkspace.
                - previousAnswer and previousCoachingSummary are history-only context. Use them only to notice progress and avoid repeating a resolved mission.
                - Never quote, correct, or criticize wording that appears only in previousAnswer or previousCoachingSummary.
                - If previousAnswer contains an old phrase and the CURRENT LEARNER ANSWER contains the learner's revised phrase, treat the old phrase as already fixed.
                - Any before/after correction pair must be anchored in exact text from the CURRENT LEARNER ANSWER. If the old phrase is absent from the current answer, it is not a current issue.

                Coaching history rules:
                - Treat previousCoachingSummary as high-priority memory for this same question loop.
                - If the learner already applied a previous mission, do not present that same issue as the new top mission.
                - If previousCoachingSummary shows one or more EXPRESSION_POLISH missions, do not choose EXPRESSION_POLISH again for an equivalent style swap unless the current wording clearly blocks meaning or is objectively awkward.
                - Banned equivalent-expression loops include: "it would be like" -> "I'd say" -> "go for" -> "have", "choose" -> "pick" -> "go for", and "like" -> "prefer" when the meaning is already clear.
                - Do not replace one acceptable expression with another solely because it is slightly smoother. Put optional alternatives in refinementExpressions instead.
                - If the required prompt slots are now present, prefer finishable=true only when no high-value local repair remains. A clear but objectively awkward core phrase, verb pattern, connector, or time expression should still become the next mission.

                Response rules:
                - Fill both the diagnosis fields and the feedback section fields in the same JSON object.
                - Work in this order:
                  1) Diagnose the answer against the prompt obligations.
                  2) Fill missionDecision.presentSlots and missionDecision.missingSlots before choosing the mission.
                  3) Fill missionDecision by comparing the best missing-slot add-on mission against the best grammar/polish mission.
                  4) Build exactly one coachMission from missionDecision.chosenType.
                  5) Build fixPoints so the first fixPoint supports the same issue/action as missionDecision and coachMission without merely repeating the top-card wording.
                  6) Add refinementExpressions only when they support the same next rewrite without repeating fixPoints.
                  7) Write modelAnswer only as a quiet reference. It must not introduce changes that conflict with coachMission.
                - Never output placeholders such as [verb], [noun], [reason], or unresolved templates.
                - Do not reuse a broken learner phrase in strengths, refinementExpressions, coachMission, or modelAnswer.
                - For add-on missions, never set coachMission.skeletonEn or coachMission.skeletonKo to null, empty string, whitespace, or a generic unrelated placeholder.
                - The top-card mission, detailed feedback, and rewrite guide must all point to the same one action.
                - Do not rely on a generic backend fallback. The mission text must be specific enough to show the learner exactly what to do next.
                - Keep Korean fields natural and concise.
                Diagnosis rules:
                - Choose exactly one answerBand from: TOO_SHORT_FRAGMENT, SHORT_BUT_VALID, GRAMMAR_BLOCKING, CONTENT_THIN, NATURAL_BUT_BASIC, OFF_TOPIC.
                - score should reflect current submission readiness from 0 to 100.
                - taskCompletion means whether the answer satisfies the prompt's required parts, not whether the English is perfect.
                - meaningClarity is about whether the learner's intended meaning is understandable: CLEAR, PARTLY_CLEAR, or BLOCKED.
                - grammarImpact is about whether grammar should control the top mission: BLOCKING means meaning/task is blocked, LOCAL means a real repair is useful but the answer is still understandable, POLISH means a small cosmetic cleanup, NONE means no meaningful grammar issue.
                - contentOpportunity is the best expansion opportunity if the answer is understandable: REASON, DETAIL, EXAMPLE, SITUATION, FEELING, RESULT, or NONE.
                - Before selecting contentOpportunity, fill missionDecision.presentSlots with content slots already present in the learner answer: ACTION, SITUATION, REASON, DETAIL, EXAMPLE, FEELING, RESULT.
                - presentSlots must include SITUATION when the prompt itself provides a concrete context using before/after/when/where/with whom, even if the learner answer does not repeat those words.
                - presentSlots must include REASON when the learner clearly attempts a reason using because, so, need, want, don't want, helps, or makes, even if that reason sentence has grammar errors.
                - A malformed causal sentence is REASON present, not REASON missing. Example: "Because family go outside, so I need ready" already contains the reason intent; fix or polish that sentence instead of asking for another reason.
                - Fill missionDecision.missingSlots with useful slots that are not yet present and would improve this exact answer. If no add-on slot is useful, return an empty array.
                - For "What do you usually do before/after/when..." routine questions, never put SITUATION in missingSlots if the answer contains any prompt-relevant action.
                - HARD BAN: If questionEn starts with or clearly means "What do you usually do before/after/when ...?" and the learner answer contains a prompt-relevant verb/action, chosenType=SITUATION is invalid.
                - In the HARD BAN case, do not output Korean titles/instructions like "상황 한 문장 더하기" or "언제, 어디서, 어떤 상황인지...". Choose EXPRESSION_POLISH for local wording, FEELING/RESULT for personal depth, DETAIL for a concrete non-context detail, or NONE/finishable if the answer is already enough.
                - For content missions, missionDecision.chosenSlot must be one value from missionDecision.missingSlots and must match missionDecision.chosenType/contentNeed.
                - For GRAMMAR_FIX, EXPRESSION_POLISH, or TASK_RESET, missionDecision.chosenSlot must be NONE.
                - contentOpportunity must target the most useful missing slot. Do not choose a mission that asks for a content slot already present in the learner answer.
                - A prompt can already supply the situation/context. If the question itself says before/after/when/where/with whom something happens, that context is not a missing learner slot.
                - Do not choose SITUATION just because the learner did not repeat context already given by the prompt. Example: for "What do you usually do before you join a video call?", an answer like "I check my appearance and charge my phone because I want to look ready" already fits the given situation.
                - More examples that already have prompt-provided SITUATION: "What do you usually do when you feel stressed?" + "I listen to calm music and drink water because it helps me slow down."; "What do you usually do before an online class starts?" + "I open the class link and prepare my notes because I want to follow the lesson."; "What do you usually do before you study English?" + "I open my notebook and check yesterday's words because it helps me remember."
                - For prompt-provided context cases, never make a SITUATION mission with a generic skeleton like "When I ____, I ____." That asks the learner to restate context the question already gave.
                - Choose SITUATION only when time/place/context is missing from both the prompt and the learner answer, or when the prompt explicitly asks the learner to provide their own when/where/context.
                - If the answer already contains action/what + place-or-situation + reason/why, do not choose DETAIL or SITUATION only because the answer is short. Prefer FEELING or RESULT if it still feels flat, or NONE/finishable if it is already acceptable.
                - selectedMissionReason must briefly explain why the top mission deserves priority over other possible fixes.
                - grammarSeverity must describe grammar/naturalness damage in the learner answer: NONE, MINOR, MODERATE, or MAJOR.
                - grammarIssues should include only concrete learner spans that need repair. Use empty array if no visible local grammar issue matters.
                - primaryIssueCode must be one concise uppercase code such as OFF_TOPIC_RESPONSE, STATE_MAIN_ANSWER, FIX_BLOCKING_GRAMMAR, FIX_LOCAL_GRAMMAR, ADD_REASON, ADD_DETAIL, ADD_EXAMPLE, ADD_SITUATION, ADD_FEELING, ADD_RESULT, IMPROVE_NATURALNESS.
                - rewriteTarget.action must be one of MAKE_ON_TOPIC, STATE_MAIN_ANSWER, FIX_BLOCKING_GRAMMAR, FIX_LOCAL_GRAMMAR, ADD_REASON, ADD_EXAMPLE, ADD_DETAIL, ADD_SITUATION, ADD_FEELING, ADD_RESULT, IMPROVE_NATURALNESS.
                - rewriteTarget.skeleton should be a short safe rewrite frame or null. Do not put the whole answer there.
                - expansionBudget: NONE when no expansion is needed, ONE_DETAIL for one phrase/detail, ONE_SUPPORT_SENTENCE for one extra sentence.
                - regressionSensitiveFacts should list facts that must not be changed in rewrite, such as people, places, times, preferences, or actions.
                - answerBand must reflect what the learner most needs next, not what sounds harshest.
                - finishable=true only when the current answer already reads like an acceptable final submission: it answers the required prompt parts, meaningClarity is CLEAR or PARTLY_CLEAR, and grammarImpact is NONE or POLISH.
                - Do not set finishable=true for SHORT_BUT_VALID answers.
                - Do not keep finishable=false only because the answer could be longer, more polished, or could support one optional upgrade.
                - If finishable=true, do not turn optional polish into the visible coachMission. Put smoother wording, shorter alternatives, and extra detail ideas into refinementExpressions instead.
                - If the answer already has the required prompt parts and only contains verbose but acceptable wording, keep finishable=true and offer shorter alternatives in refinementExpressions, not as EXPRESSION_POLISH.
                - If a required action, reason, result, or solution clause still contains an objectively awkward verb pattern, time expression, connector, or collocation that should be fixed before submission, set grammarImpact=LOCAL, finishable=false, and choose EXPRESSION_POLISH or GRAMMAR_FIX.
                - Do not mark finishable=true when the answer has two or more non-cosmetic local repairs, even if each repair is small by itself.
                - Example: "To handle this problem I postpone my work tomorrow" is not finishable. The core solution phrase should be repaired to "I put off some work until tomorrow" or "I leave some work for tomorrow."
                - Example: "I face endless work" may be understandable, but if it is part of the main answer and there are other local issues, keep finishable=false and teach a natural phrase such as "I have too much work."
                - A short single-clause answer that only states the main answer, place, activity, preference, or plan without one supporting reason, detail, example, or time flow is usually not finishable.
                - For routine, preference, opinion, and plan prompts, one clean base sentence is usually still too thin to mark as finishable.
                - If a required reason, detail, or activity clause is still malformed or needs more than one small local repair, keep finishable=false.
                - If attemptIndex >= 2, use previousAnswer only to detect progress and remaining issues. Do not repeat already-fixed issues as if they were still the main problem.
                - If attemptIndex >= 2, also use previousCoachingSummary to avoid repeating prior coach missions. A learner should feel the next feedback notices what they already fixed.
                - If previousCoachingSummary says expressionPolishMissionCount is 1 or higher, raise the bar for another EXPRESSION_POLISH mission: only use it for a visibly wrong or confusing phrase, not for a preference among acceptable phrases.
                - NATURAL_BUT_BASIC is appropriate when the answer is already clear, on-topic, complete enough for the loop to end, and needs at most one very small local cleanup.
                - Do not use NATURAL_BUT_BASIC for a minimal one-sentence answer that still feels underdeveloped even if the grammar is clean.
                - Prefer CONTENT_THIN or SHORT_BUT_VALID over GRAMMAR_BLOCKING unless grammar truly blocks meaning or sentence structure.
                - If you are unsure between SHORT_BUT_VALID and NATURAL_BUT_BASIC for a short answer, prefer SHORT_BUT_VALID.
                - If meaningClarity is CLEAR or PARTLY_CLEAR and grammarImpact is NONE or POLISH, do not let small grammar polish control the top mission.
                - If the answer is understandable but thin, choose CONTENT_THIN or SHORT_BUT_VALID and make coachMission an add-on mission even when small local errors exist.
                - Small issues such as capitalization, contraction, article preference, a plural ending, or one nicer word choice belong in fixPoints/refinementExpressions, not the top mission.
                - Use GRAMMAR_FIX as the top mission only when grammarImpact is BLOCKING, grammarSeverity is MAJOR/MODERATE, or the local error prevents the learner from answering the prompt clearly.
                - taskCompletion=PARTIAL means the learner answered part of the prompt but missed one required slot. It is not OFF_TOPIC by itself.
                - Use OFF_TOPIC only when the answer has no prompt-relevant anchor, such as no relevant preference, action, place, plan, reason, time, or topic noun from the question.
                - A short, generic, or partially complete but on-topic answer should be SHORT_BUT_VALID or CONTENT_THIN, never OFF_TOPIC.
                - If the answer has no prompt-relevant anchor, set answerBand=OFF_TOPIC and make the top mission TASK_RESET. Do not disguise a reset as REASON, DETAIL, or SITUATION.
                - Romanized Korean without a real English sentence frame is not an English answer. Examples: "beoseu tago hakgyo gayo", "geunyang joayo", "molla". Treat it as OFF_TOPIC/TASK_RESET, not a grammar repair.
                - Treat word-order fragments without normal subject-verb structure as GRAMMAR_BLOCKING when they need a full sentence frame, for example "home go", "dinner eat", "breakfast eat", "school go", "I want make habit", "every day do it", or a sequence of noun/verb fragments.
                - Treat repeated Korean-learner frame errors as GRAMMAR_BLOCKING when the core sentence needs repair before expansion: missing `to` after want/need/try/plan, missing object/preposition after listen/look/go, or patterns like "it make me exciting", "go company", "wash face", "listen music".
                - If the learner already answers the required slots with a clear action/preference/plan plus a reason or fitting moment when the prompt asks for it, do not force another optional detail. Mark finishable=true only when any remaining wording issue is cosmetic rather than a high-value local repair.
                - Generic adjective reasons such as "it is delicious", "it is good", "it is fun", "it is exciting", or "it makes me happy" are weak reasons, not completion proof. If the prompt asks why, choose REASON, DETAIL, EXAMPLE, FEELING, or RESULT before EXPRESSION_POLISH.

                Mission selection ladder:
                1) Choose TASK_RESET only as a last-resort reset: blank/refusal, non-English gibberish, truly different topic, or no prompt-relevant anchor.
                1a) If the answer is mostly romanized Korean, Hangul, emoji/noise, random words, or a refusal, choose TASK_RESET even if the words hint at the topic.
                2) If the learner names any relevant food, movie, place, season, music, routine, goal, action, time, or reason from the question, TASK_RESET is forbidden.
                3) If grammarImpact is BLOCKING, choose GRAMMAR_FIX.
                4) If the prompt asks "why" and the reason is missing, generic, or could be personal, choose REASON.
                4a) If the learner already wrote a causal reason sentence, even a grammatically rough one, do not choose REASON just to ask for another reason. Choose GRAMMAR_FIX/EXPRESSION_POLISH when the reason sentence needs repair, or FEELING/RESULT/NONE when the answer is otherwise acceptable.
                4b) Do not ask for an already-present slot again. If the learner already says what they do, where/when/context, and why, DETAIL and SITUATION are usually wrong; choose FEELING, RESULT, or NONE instead.
                5) If the answer needs one concrete action, object, scene, or descriptive fact, choose DETAIL.
                6) If the missing slot is specifically time/place/context, choose SITUATION.
                6a) SITUATION is forbidden when the prompt itself already supplies the relevant time/place/context and the learner gives an on-topic action or reason. In that case treat SITUATION as already present.
                6b) For routine questions shaped like "What do you usually do before/after/when ...?", skip SITUATION entirely once the answer has an on-topic action. The next useful mission must be expression polish, feeling/result, detail, example, or completion.
                7) If the answer needs proof, a concrete instance, or "for example" support, choose EXAMPLE.
                8) If the answer would feel more personal with emotion or outcome, choose FEELING or RESULT.
                9) If grammarImpact is LOCAL and the local error is more important than any expansion opportunity, choose GRAMMAR_FIX.
                10) If the answer is already acceptable and has no high-value local expression issue, mark finishable=true.
                11) If the answer is otherwise complete but the remaining issue is a clearly awkward collocation, verb pattern, connector, or time expression in a required clause, keep finishable=false and choose EXPRESSION_POLISH rather than treating it as optional refinement.

                Strengths and usedExpressions rules:
                - strengths should usually be one short Korean keep-signal based on meaning, not a full raw quote unless it is already clean and necessary.
                - usedExpressions may contain as many distinct short reusable learner-used chunks as the answer genuinely supports.
                - Do not force a fixed count for usedExpressions. Return only the useful ones, and omit weak or repetitive items.
                - Prefer phrase-level reusable chunks such as verb phrases, habit frames, time-flow frames, or reason connectors that the learner can reuse in another answer.
                - Prefer 2-6 words when possible. Only go longer if the whole chunk is still a clean reusable expression, not a personalized clause.
                - Do not return full sentences, subject-heavy clauses, or chunks with answer-specific tail details that are not broadly reusable.
                - Do not return dangling or broken spans that end with weak tails such as "and", "to", "because", "so", or similarly incomplete endings.
                - usedExpressions must not contain long broken spans or whole awkward sentences.
                - usedExpressions.meaningKo should be a short Korean meaning or gloss of the expression itself.
                - usedExpressions.exampleEn should be one short natural sentence that uses the expression clearly, is not identical to the expression itself, and does not simply copy the full learner answer.
                - usedExpressions.usageTip should be one short Korean reason why the expression is worth keeping.
                - usedExpressions.tags must contain 2 to 6 tags chosen only from this allowed tag set: %s
                - usedExpressions.tags must always include `used_expression` and may add function, topic, and tense-context tags that truly match the expression itself.
                - Tag the reusable expression itself, not the surrounding example sentence or answer context.
                - Do not assign `time_expression` unless the expression text itself contains a direct time marker, duration marker, or time-flow wording such as `before`, `after`, `when`, `during`, `at night`, `in the morning`, or `for a while`.
                - Do not assign `time_expression` to generic actions like `take a walk`, `read a book`, or `watch videos` just because the learner sentence places them after dinner or at night.

                fixPoints rules:
                - fixPoints are the detailed feedback area. The first item must support the same one action as coachMission without merely repeating the top-card wording.
                - fixPoints should explain the important visible changes needed for the next rewrite, not every possible polish.
                - If coachMission is GRAMMAR_FIX or EXPRESSION_POLISH, the first fixPoints originalText/revisedText must match coachMission.originalText/revisedText.
                - If coachMission is REASON, DETAIL, SITUATION, EXAMPLE, FEELING, RESULT, or TASK_RESET, the first fixPoints item should be an anchored instruction card with no forced originalText/revisedText pair.
                - Each fixPoints item must teach exactly one concrete correction point.
                - Do not make modelAnswer the plan. The plan is coachMission; modelAnswer is only a reference.
                - Return every distinct high-value fix as its own item instead of merging unrelated lessons or repeating the same lesson.
                - Prefer the smallest self-contained aligned originalText / revisedText span that still teaches the point clearly.
                - Do not cut away left or right context if that would make the edit misleading. A fixPoints card should still make sense when read by itself.
                - For connector, preposition, article, pronoun, and determiner edits, include enough surrounding words to show what the function word is attaching to.
                - If a narrower span would falsely suggest adding or removing a word that is already present in the full learner sentence, widen the span until the change is truthful.
                - If one originalText / revisedText pair contains multiple meaningful edits, either split it into multiple fixPoints or make supportText explicitly explain every changed part in that pair.
                - supportText must match the size of the edit. Short reason text is only acceptable for a small local change; larger pairs need fuller explanation.
                - For a fixPoints item with originalText / revisedText, use supportText as the single explanation field the UI will show under "이유".
                - For that same correction-pair fixPoints item, fold any usage note, generalization, or short example into supportText instead of spreading it across meaningKo, guidanceKo, exampleEn, or exampleKo.
                - For correction-pair fixPoints items, leave meaningKo, guidanceKo, exampleEn, and exampleKo null unless one of them is absolutely necessary and not a duplicate of supportText.
                - In supportText, name the exact changed phrase and the concrete reason for the change, such as subject-verb agreement, auxiliary plus base verb, plural noun, article with singular countable noun, pronoun agreement, collocation, or connector choice.
                - Avoid vague supportText such as "문법이 맞지 않아요", "더 자연스럽습니다", or "보통 이렇게 써요" unless you immediately add the exact rule and the specific changed words.
                - Prefer supportText that explains the edit in a learner-usable way, for example: what word changed, what grammar pattern it follows, and why that pattern fits this sentence.
                - Good supportText examples:
                  1) `money`는 단수 주어라 `does`를 쓰고, `does` 뒤 동사는 원형 `make`로 둡니다.
                  2) `many people`에 맞춰 `job`은 복수형 `jobs`로 바꾸고, 같은 사람들을 가리키므로 `their lives`처럼 복수 목적어를 씁니다.
                  3) `life`는 여기서 단수 가산명사라 `a`가 필요하고, `balanced life`가 `balance life`보다 자연스러운 결합입니다.
                - When possible, use originalText for the learner span and revisedText for the aligned corrected span from modelAnswer.
                - A fixPoints item may use originalText / revisedText / supportText for a correction pair, or title / headline / supportText for one anchored instruction card when a clean pair is not possible.
                - If there is no originalText / revisedText pair, the headline must still name the exact phrase, word, connector, or slot that changes in modelAnswer.
                - Avoid generic fixPoints titles or instructions without an explicit anchor.
                - Keep article/determiner, singular/plural, pronoun agreement, and connector choice separate when they are distinct problems.

                refinementExpressions rules:
                - refinementExpressions are the single source for the optional "표현 더하기" area.
                - Use refinementExpressions for reusable expressions, sentence starters, short add-on phrases, and prompt-fit optional improvements beyond fixPoints.
                - Return only genuinely useful, distinct items, and keep expression, meaningKo, guidanceKo, exampleEn, and exampleKo separate.
                - Do not use refinementExpressions to restate a repaired phrase already taught in fixPoints.
                - When finishable=true, return 3 to 5 refinementExpressions. The completion screen uses these as the learner's useful "continue polishing or finish" choice, so do not leave them empty.
                - For finishable=true, each refinementExpression must be an optional, learner-usable expression that can make the current answer one small step richer without implying the current answer is wrong.
                - Finishable refinementExpressions should include practical add-ons such as a smoother connector, a more precise feeling/result phrase, a shorter natural alternative, or a reusable detail phrase that fits the prompt and the learner's existing meaning.
                - Example: if the learner writes an understandable phrase like "a huge place with a lot of dogs and a lot of people", do not make it the visible coachMission just because it could be shorter. If useful, offer alternatives such as "a busy park" or "a spacious park with many people" in refinementExpressions.
                - If a refinement expression or its example sentence substantially overlaps with a fixPoints repair or simply repeats the modelAnswer-level rewrite, omit it.
                - exampleEn must not be identical to expression.

                missionDecision rules:
                - missionDecision is the source of truth for selecting the top mission. Fill it before coachMission.
                - missionDecision.chosenType must exactly match coachMission.missionType.
                - missionDecision.presentSlots is the learner answer's content inventory. Use only these slot names: ACTION, SITUATION, REASON, DETAIL, EXAMPLE, FEELING, RESULT.
                - missionDecision.missingSlots is the improvement inventory. Include only useful slots not already present. Do not list a slot in both presentSlots and missingSlots.
                - missionDecision.chosenSlot is the exact content slot the learner should add next. For content missions it must equal chosenType/contentNeed and must appear in missingSlots. For GRAMMAR_FIX, EXPRESSION_POLISH, or TASK_RESET it must be NONE.
                - If the learner has a rough but understandable reason clause such as "Because family go outside, so I need ready", put REASON in presentSlots and do not put REASON in missingSlots.
                - If ACTION, SITUATION, and REASON are all in presentSlots, then DETAIL and SITUATION are not valid chosenSlot values unless the answer truly lacks a distinct concrete example. Prefer FEELING or RESULT for flat but understandable answers.
                - If the learner already says where/when/context, do not choose SITUATION. If the learner already says why, do not choose REASON. If the learner already says what they do, do not choose DETAIL only to ask "what".
                - If the prompt already says where/when/context, do not choose SITUATION merely because the learner did not repeat those words. Treat prompt-provided context as sufficient unless the learner's answer is ambiguous without it.
                - If the prompt is a routine question shaped like "What do you usually do before/after/when X?", and the answer gives an on-topic action, missionDecision.presentSlots must include SITUATION and missionDecision.missingSlots must not include SITUATION.
                - A SITUATION coachMission must not use a generic "When I ____, I ____." skeleton when the prompt already contains before/after/when/where context.
                - Invalid pair: prompt says "before/after/when X" + answer gives an action + coachMission.missionType=SITUATION. Never produce this pair.
                - grammarPriority means whether grammar should win the top mission:
                  * BLOCKING: grammar prevents the learner from answering the question clearly.
                  * HIGH_VALUE_LOCAL: one local repair is more important than any content add-on.
                  * LOW_VALUE_POLISH: grammar/naturalness can be improved, but the answer is understandable and the issue is not the best next action.
                  * NONE: no meaningful grammar repair is needed.
                - contentNeed is the single best add-on slot if the answer is understandable: REASON, DETAIL, SITUATION, EXAMPLE, FEELING, RESULT, or NONE.
                - Choose contentNeed from missing information only. Never ask for action/what, place/context, or reason/why when the learner already gave that slot clearly enough.
                - For commute, routine, or free-time answers that already include action + place/context + reason, contentNeed should normally be FEELING or RESULT if the answer still needs one personal sentence. Do not choose DETAIL or SITUATION for that pattern.
                - TASK_RESET is a last-resort reset, not a label for thinness, generic reasons, missing examples, or one missing required slot.
                - Before choosing TASK_RESET, ask: does the answer contain any prompt-relevant anchor? If yes, chosenType must be the missing-slot mission instead.
                - If the answer contains no prompt-relevant anchor, chosenType must be TASK_RESET. Do not choose SITUATION, REASON, DETAIL, EXAMPLE, FEELING, or RESULT for a completely unrelated answer.
                - If taskCompletion is PARTIAL, chosenType should normally be the missing required slot: REASON for missing/generic why, EXAMPLE for missing proof, DETAIL for missing concrete action/detail, SITUATION for missing time/place/context, FEELING or RESULT for missing personal reaction/outcome.
                - SITUATION means adding genuinely missing when/where/context. Do not use it as a generic "make richer" bucket, and do not use it to restate context already present in the prompt.
                - If the answer is made of broken word-order fragments and needs a sentence frame before any content can be added, choose GRAMMAR_FIX even if a reason/detail is also missing.
                - If the answer has two or more sentence-frame errors such as missing `to`, missing possessive object, wrong verb pattern, missing preposition after listen/look/go, or wrong emotional adjective after make me, set grammarPriority=BLOCKING and choose GRAMMAR_FIX before adding content.
                - For already complete answers with clear required slots, set finishable=true only when no high-value local expression or grammar repair remains. A good action plus reason should be allowed to finish, but not if the core action/reason/result wording is objectively awkward.
                - For already complete answers, optional improvements belong in refinementExpressions. Do not use coachMission for "could be more natural" unless the current wording is visibly confusing, wrong, or uses an unnatural verb pattern/collocation in a required clause.
                - If meaningClarity is CLEAR or PARTLY_CLEAR, contentNeed is not NONE, and grammarPriority is NONE or LOW_VALUE_POLISH, chosenType must be the contentNeed value, not GRAMMAR_FIX or EXPRESSION_POLISH.
                - If the answer is understandable but thin, pick the most useful add-on mission even if there are small grammar issues. Put those small issues in missionDecision.minorFixes and later fixPoints.
                - Treat flat/generic endings or generic reasons as contentNeed, not polish: examples include "That is all", "I feel good", "It is fun", "because I am tired", "give me energy", and vague future/job reasons.
                - When the only reason is a generic adjective such as delicious/good/fun/exciting/happy, do not mark finishable=true and do not choose EXPRESSION_POLISH. Ask for a personal reason, concrete detail, example, feeling, or result.
                - If the learner uses "That is all" as a final sentence, never choose EXPRESSION_POLISH just to change it to "That's all." Treat it as a flat ending and choose RESULT, FEELING, DETAIL, or REASON with a meaningful sentence that can replace or follow it.
                - Never set EXPRESSION_POLISH for "That is all", "That's all", "That's my routine", or any formal closing phrase. These are not useful polish targets. Choose RESULT, FEELING, DETAIL, or REASON and give a meaningful closing sentence instead.
                - If an answer ends with "That is all", keep finishable=false unless the top mission is already a meaningful content mission. Do not use a contraction, article, plural, or tiny wording polish as the top mission for that answer.
                - Do not choose EXPRESSION_POLISH or GRAMMAR_FIX only to improve a natural collocation, article, singular/plural, verb agreement, or one short phrase when the answer could become more personal with one detail, feeling, result, example, or reason.
                - Concrete low-priority grammar examples that should usually become minorFixes, not the top mission: "sunny day" -> "sunny weather", "give" -> "gives", "future job need English" -> "my future job will need English", "put the food in the refrigerator" -> "put the food away".
                - For weather-feeling prompts, if the learner says a generic feeling such as "I feel good", "I feel happy", or "It makes me feel good", choose FEELING or DETAIL to make the feeling more specific. Do not choose "sunny day" -> "sunny weather" as the top mission.
                - If an answer already has the minimum required parts but still feels flat, choose FEELING, RESULT, DETAIL, or EXAMPLE before EXPRESSION_POLISH.
                - EXPRESSION_POLISH is a last-resort mission for an answer that is already personal and sufficiently developed. Do not use it as a shortcut for a visible correction pair when a stronger GRAMMAR_FIX or content add-on mission exists.
                - If an answer is only one plain sentence with no reason, feeling, result, example, or concrete support, do not choose EXPRESSION_POLISH. Choose the missing content slot instead.
                - When several local fixes exist, do not pick the tiniest polish. Either choose the highest-value local repair that affects the core action, or choose a content add-on if the answer is understandable but flat.
                - If chosenType is REASON, DETAIL, SITUATION, EXAMPLE, FEELING, or RESULT, prepare a sentence skeleton and phrase options rather than one complete sentence to copy.
                - missionDecision.addOnExampleEn is legacy context only. It may be null and must not be the source of the visible top-card guidance.
                - For add-on missions, the visible guidance must come from coachMission.skeletonEn, coachMission.skeletonKo, and coachMission.suggestedPhrases.
                - For REASON, skeletonEn should contain a causal slot such as "I do this because ____." and suggestedPhrases should include reason phrases.
                - For FEELING, skeletonEn should contain a feeling slot such as "It makes me feel ____." and suggestedPhrases should include feeling words or short reaction phrases.
                - For RESULT, skeletonEn should contain an outcome slot such as "After that, I can ____." and suggestedPhrases should include result/outcome phrases.
                - For SITUATION, skeletonEn should contain a time/place/context slot such as "When I ____, I ____." and suggestedPhrases should include time/place/context phrases.
                - Do not return a situation skeleton for a FEELING mission, a feeling skeleton for a REASON mission, or phrase options that only repeat the current answer without supporting the requested slot.
                - For add-on missions, addOnPlacementKo must explain exactly where the new sentence belongs, such as after the main answer, after the action, before the reason, or at the end.
                - whyChosenKo must explain why this mission is the most useful next action for this answer.
                - whyNotGrammarFirstKo must explain why grammar is not first when grammarPriority is LOW_VALUE_POLISH. Use null only when grammar is chosen or there is no visible grammar issue.
                - minorFixes should contain only small grammar/naturalness edits that should not steal the top mission.
                - Do not create a generic add-on mission. If chosenType is content-based, the learner should be able to use skeletonEn plus suggestedPhrases to know what to add without copying a full answer.

                coachMission rules:
                - Always return coachMission as the single visible action for the top feedback card.
                - coachMission must be built from missionDecision. Every visible section should support this one mission.
                - coachMission.title must be a concrete Korean mission name the learner can do immediately, not a vague label such as "디테일 추가" or "한 가지 더 추가".
                - Choose coachMission.title from these recommended titles only. REASON: "이유 한 문장 더하기"; DETAIL: "구체적인 정보 더하기"; SITUATION: "상황 한 문장 더하기"; EXAMPLE: "예시 한 문장 더하기"; FEELING: "느낌 한 문장 더하기"; RESULT: "결과 한 문장 더하기"; TASK_RESET: "질문에 맞게 다시 쓰기"; EXPRESSION_POLISH: "표현 더 자연스럽게 고치기"; GRAMMAR_FIX: choose one of "문장 구조 바로잡기", "동사 형태 맞추기", "주어와 동사 맞추기", "관사 바로잡기", "전치사 바로잡기", "단수와 복수 맞추기", "문장부호 바로잡기".
                - Choose missionType from REASON, DETAIL, SITUATION, EXAMPLE, FEELING, RESULT, GRAMMAR_FIX, TASK_RESET, or EXPRESSION_POLISH.
                - coachMission.missionType must exactly equal missionDecision.chosenType.
                - coachMission.exampleEn is a legacy field. Prefer null.
                - For add-on missions (REASON, DETAIL, SITUATION, EXAMPLE, FEELING, RESULT, TASK_RESET), coachMission.skeletonEn is mandatory. It must be a short reusable English sentence frame with one or more blanks or slots, not a complete model answer.
                - For add-on missions, coachMission.skeletonKo is mandatory. It must be a natural Korean meaning of the sentence frame, preserving blanks, for example skeletonEn="After that, it becomes easier to ____." skeletonKo="그 후에는 ____하기가 더 쉬워져요."
                - For add-on missions, coachMission.suggestedPhrases is mandatory. Return 3 to 5 objects with phrase and meaningKo. phrase must be a short English phrase that can fit into skeletonEn or directly support the mission. meaningKo must be a concise Korean meaning, not a usage note.
                - For GRAMMAR_FIX or EXPRESSION_POLISH, set coachMission.originalText to the exact learner span that should change and coachMission.revisedText to the directly corrected span. Keep both short, aligned, and replaceable.
                - For GRAMMAR_FIX or EXPRESSION_POLISH, originalText and revisedText must use the same text scope. If originalText is a phrase, revisedText must be only the replacement phrase, not the whole corrected sentence.
                - Bad scope pair: originalText="it makes me feel happy", revisedText="I like sweet food because it makes me happy." Good scope pair: originalText="it makes me feel happy", revisedText="it makes me happy".
                - Do not include surrounding unchanged words in revisedText unless those same surrounding words are also included in originalText.
                - For GRAMMAR_FIX or EXPRESSION_POLISH, set coachMission.skeletonEn=null, coachMission.skeletonKo=null, and coachMission.suggestedPhrases=[]. Do not add a sentence frame or phrase options for correction missions; the before/after comparison is the learner action.
                - Never return the same text for coachMission.originalText and coachMission.revisedText. If there is no concrete before/after change, do not choose GRAMMAR_FIX or EXPRESSION_POLISH.
                - The originalText/revisedText pair must match instructionKo exactly. If instructionKo says to remove or replace one connector such as "for that", originalText should be that connector or the smallest phrase around it, not a whole sentence that drops other ideas.
                - For GRAMMAR_FIX or EXPRESSION_POLISH, instructionKo must describe the exact edit the learner should make, not a vague goal. Name the visible change: punctuation, connector, word order, subject, verb, article, tense, plural, preposition, or repeated word.
                - For GRAMMAR_FIX, whyKo must explain why the edit improves the sentence in learner-friendly Korean: meaning clarity, natural word order, article choice, tense, subject-verb agreement, or punctuation. Do not only say "it sounds more natural."
                - For GRAMMAR_FIX, whyKo must name the exact learner words or structure being fixed and the concrete rule. Do not use generic phrasing like "이 부분만 고치면" or "문장 구조가 좋아져요" by itself.
                - Good GRAMMAR_FIX whyKo example: "`Because`절에는 주어와 동사가 필요해서 `family go`를 `my family is going`으로 고치고, `so` 없이 `I need to get ready`로 이어야 해요."
                - successCheckKo is deprecated for the visible mission card. Return null.
                - Bad instructionKo: "같은 뜻을 자연스러운 영어 문장으로 고쳐 보세요."
                - Good instructionKo: "마침표를 쉼표로 바꾸고, When절 뒤에 주어와 동사가 이어지게 한 문장으로 써 보세요."
                - For REASON, DETAIL, SITUATION, EXAMPLE, FEELING, RESULT, or TASK_RESET, set coachMission.originalText and coachMission.revisedText to null.
                - Do not put an optional add-on example into revisedText. For add-on missions, skeletonEn is the sentence frame, skeletonKo is its Korean meaning, and suggestedPhrases are the learner's choice bank.
                - For TASK_RESET, coachMission.skeletonEn must be a prompt-specific starter frame with blanks, not a complete answer to copy.
                - If the prompt asks for multiple parts, choose a mission that fills the most important missing part rather than a vague "make it richer" instruction.
                - Do not make coachMission ask for a slot the learner already answered. If action, place/context, and reason are present, coachMission should ask for feeling/result only when more support is still useful.
                - If the learner answered at least one prompt-relevant part, do not use TASK_RESET. Give a concrete missing-slot mission instead.
                - If coachMission is TASK_RESET, title and instructionKo must explicitly name the current prompt topic and the part the learner must answer from scratch.
                - If the answer has no prompt-relevant anchor, coachMission.missionType must be TASK_RESET and the instruction must tell the learner to answer the actual question from scratch.
                - If the answer is a broken fragment sequence such as "home go. dinner eat", coachMission.missionType should normally be GRAMMAR_FIX with a short originalText/revisedText comparison pair.
                - If the learner already answered the basic question but sounds thin, choose one concrete add-on mission: a reason, situation, example, feeling, or result.
                - For add-on missions, instructionKo must name exactly what kind of sentence to add and where to add it.
                - For add-on missions, coachMission.skeletonEn must be a sentence pattern the learner can complete, not a finished sentence to copy.
                - For add-on missions, coachMission.skeletonKo must translate the sentence pattern naturally in Korean and keep the blank position understandable.
                - For add-on missions, coachMission.skeletonEn, skeletonKo, and suggestedPhrases must match coachMission.missionType in content, not only in wording. For FEELING, include feeling slots and words such as relaxed, happy, worried, tired, proud, comfortable, or similar. For REASON, include a because/since/so slot and causal phrases. For RESULT, include after that/then/so/helped/made/could style outcome phrases. For SITUATION, include when/after/before/at/in/on/during/while style context phrases.
                - If coachMission.missionType is REASON, skeletonEn must ask for a reason and suggestedPhrases must include reason-like options. A plain routine phrase such as "every day" is not enough by itself.
                - Do not use a correction-first priority. If the learner's meaning is understandable and the answer is thin, choose an add-on mission first even when there are small local grammar or naturalness issues.
                - Use EXPRESSION_POLISH as the top mission only when the answer already has enough personal support and contentOpportunity is NONE.
                - Do not use EXPRESSION_POLISH to repair a flat closing phrase such as "That is all"; turn that into a meaningful RESULT, FEELING, DETAIL, or REASON mission instead.
                - Do not use "That is all" as coachMission.originalText for EXPRESSION_POLISH. If that phrase appears, the mission must ask for a real final feeling, result, reason, or detail.
                - Do not choose EXPRESSION_POLISH for generic reasons like "it is delicious" or "it is fun and exciting" when the prompt asks why. The visible mission should tell the learner what personal reason/detail/example/feeling to add.
                - Do not use GRAMMAR_FIX to repair `sunny day` when the prompt asks about feeling and the answer only says `I feel good`; the better mission is to make the feeling more specific.
                - Use GRAMMAR_FIX as the top mission only when that single repair is more important than adding content: meaning is blocked, grammarImpact is BLOCKING, grammarSeverity is MAJOR/MODERATE, or contentOpportunity is NONE.
                - A single small collocation, article, plural, or subject-verb agreement fix is usually not enough reason to choose GRAMMAR_FIX if the answer needs one more personal detail, feeling, result, or example.
                - For comparison missions, placeholderEn must still be a full rewrite frame or sentence starter, not just the revisedText fragment.
                - For CONTENT_THIN or SHORT_BUT_VALID answers, prefer a specific add-on mission such as reason, detail, situation, example, feeling, or result.
                - For GRAMMAR_BLOCKING answers, make the mission about the one most important repair and use originalText/revisedText to show the corrected phrase.
                - whyKo should explain why this one mission helps the current answer in one short Korean sentence.
                - instructionKo should tell the learner exactly what to add or fix in one actionable Korean sentence.
                - For add-on missions, skeletonEn must be one non-empty English sentence frame the learner can complete.
                - For add-on missions, skeletonKo must be one concise Korean translation/meaning of skeletonEn and should keep the blank position understandable.
                - For add-on missions, suggestedPhrases[].phrase must be short, distinct, and usable inside or near skeletonEn. Do not return full completed answers as suggestedPhrases.
                - For add-on missions, suggestedPhrases[].meaningKo must translate the phrase naturally in Korean, for example {"phrase":"check the forecast first","meaningKo":"먼저 일기예보를 확인하다"}.
                - For add-on missions, if skeletonEn, skeletonKo, or suggestedPhrases do not directly satisfy the missionType, rewrite them before returning JSON.
                - For add-on missions, do not copy modelAnswer into skeletonEn, and do not use an example from refinementExpressions or another section as a substitute.
                - placeholderEn should usually match skeletonEn or be a slightly simpler rewrite starter, for example "I like it because ____.".
                - targetHintKo must say where to put the mission in the rewrite.
                - successCheckKo must be null.

                Final self-check before JSON:
                - Does missionDecision.chosenType exactly match coachMission.missionType?
                - Do instructionKo, targetHintKo, and the first fixPoint describe the same concrete action?
                - For add-on missions, are coachMission.skeletonEn and coachMission.skeletonKo non-empty, learner-usable, and do they prove the missionType instead of repeating the current answer or modelAnswer?
                - For add-on missions, do coachMission.suggestedPhrases give 3-5 phrase options with Korean meanings that fit the skeleton and support the same missionType?
                - For GRAMMAR_FIX or EXPRESSION_POLISH, are coachMission.skeletonEn=null, coachMission.skeletonKo=null, and coachMission.suggestedPhrases=[]?
                - For every correction, are coachMission.originalText, fixPoints.originalText, grammarIssues.span, and minimalCorrection based on wording present in the CURRENT LEARNER ANSWER, not only in history.previousAnswerOnlyDoNotEvaluateAsCurrent?
                - If finishable=true, are the required prompt parts answered and no high-value local expression or grammar repair remains?
                - Did you avoid repeating previousCoachingSummary or swapping between equivalent acceptable expressions again?
                - If any answer is no, revise the JSON before returning it.

                modelAnswer rules:
                - modelAnswer should read like a natural reference rewrite, not the main feedback.
                - Write modelAnswer after coachMission and keep it consistent with the mission.
                - Keep modelAnswer as close as possible to the learner's meaning, facts, and sentence direction while making it natural and submission-ready.
                - modelAnswer must include the coachMission change when the mission is a correction.
                - Avoid folding optional expansion into modelAnswer unless it is necessary for fluency or coherence.
                - Prefer putting extra reasons, examples, details, time flow, imagery, and optional polish into refinementExpressions instead of modelAnswer.
                - For OFF_TOPIC or TOO_SHORT_FRAGMENT, modelAnswer may reset the answer toward the prompt or toward one complete base sentence, but should still stay as close as possible to what the learner seems to be trying to say.
                - Preserve referent, pronoun, and singular/plural agreement taught in fixPoints, and do not switch between plural they and singular it unless one fixPoint explicitly teaches that shift.

                Diagnosis-to-section alignment:
                %s

                %s
                Prompt topic: %s
                Difficulty: %s
                Question in English: %s
                Question in Korean: %s
                Speaking tip: %s
                Prompt coaching strategy:
                %s
                Prompt hints:
                %s

                CURRENT LEARNER ANSWER - evaluate this text only:
                <current_answer>
                %s
                </current_answer>
                """.formatted(
                analysisContext,
                allowedExpressionTags,
                bandGuidance,
                retryContext,
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                coachProfileGuidance,
                hintText,
                answer
        );
    }

    private FeedbackDiagnosisResult parseDiagnosisResponse(JsonNode node) {
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
        List<String> regressionSensitiveFacts = new ArrayList<>();
        node.path("regressionSensitiveFacts").forEach(item -> regressionSensitiveFacts.add(item.asText("")));
        String primaryIssueCode = node.path("primaryIssueCode").asText("");
        JsonNode rewriteTargetNode = node.path("rewriteTarget");
        RewriteTarget rewriteTarget = rewriteTargetNode.isMissingNode()
                ? null
                : new RewriteTarget(
                normalizeRewriteTargetAction(rewriteTargetNode.path("action").asText(""), primaryIssueCode),
                rewriteTargetNode.path("skeleton").isNull() ? null : rewriteTargetNode.path("skeleton").asText(null),
                rewriteTargetNode.path("maxNewSentenceCount").asInt(1)
        );
        int score = resolveDiagnosisScore(node.path("score"), answerBand, taskCompletion, onTopic, finishable, grammarSeverity);
        return new FeedbackDiagnosisResult(
                score,
                answerBand,
                taskCompletion,
                onTopic,
                finishable,
                parseMeaningClarity(node.path("meaningClarity").asText("CLEAR")),
                parseGrammarImpact(node.path("grammarImpact").asText("NONE")),
                parseContentOpportunity(node.path("contentOpportunity").asText("NONE")),
                node.path("selectedMissionReason").isNull() ? null : node.path("selectedMissionReason").asText(null),
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
            case "ADD_SITUATION" -> "ADD_SITUATION";
            case "ADD_FEELING" -> "ADD_FEELING";
            case "ADD_RESULT" -> "ADD_RESULT";
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

    private List<String> textArray(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull() || !node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        node.forEach(item -> {
            String value = textOrNull(item);
            if (value != null) {
                values.add(value);
            }
        });
        return List.copyOf(values);
    }

    private List<FeedbackSuggestedPhraseDto> suggestedPhraseArray(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull() || !node.isArray()) {
            return List.of();
        }
        List<FeedbackSuggestedPhraseDto> values = new ArrayList<>();
        node.forEach(item -> {
            if (item == null || item.isNull()) {
                return;
            }
            if (item.isObject()) {
                FeedbackSuggestedPhraseDto phrase = new FeedbackSuggestedPhraseDto(
                        textOrNull(item.path("phrase")),
                        textOrNull(item.path("meaningKo"))
                );
                if (phrase.phrase() != null) {
                    values.add(phrase);
                }
                return;
            }
            String value = textOrNull(item);
            if (value != null) {
                values.add(new FeedbackSuggestedPhraseDto(value));
            }
        });
        return List.copyOf(values);
    }

    private FeedbackCoachMissionDto parseCoachMission(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        return new FeedbackCoachMissionDto(
                textOrNull(node.path("missionType")),
                textOrNull(node.path("title")),
                textOrNull(node.path("originalText")),
                textOrNull(node.path("revisedText")),
                textOrNull(node.path("whyKo")),
                textOrNull(node.path("instructionKo")),
                textOrNull(node.path("exampleEn")),
                textOrNull(node.path("skeletonEn")),
                textOrNull(node.path("skeletonKo")),
                suggestedPhraseArray(node.path("suggestedPhrases")),
                textOrNull(node.path("placeholderEn")),
                textOrNull(node.path("targetHintKo")),
                textOrNull(node.path("successCheckKo"))
        );
    }

    private MissionDecision parseMissionDecision(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        List<MissionMinorFix> minorFixes = new ArrayList<>();
        node.path("minorFixes").forEach(item -> minorFixes.add(new MissionMinorFix(
                textOrNull(item.path("originalText")),
                textOrNull(item.path("revisedText")),
                textOrNull(item.path("reasonKo"))
        )));
        return new MissionDecision(
                textOrNull(node.path("chosenType")),
                textOrNull(node.path("grammarPriority")),
                textOrNull(node.path("contentNeed")),
                textArray(node.path("presentSlots")),
                textArray(node.path("missingSlots")),
                textOrNull(node.path("chosenSlot")),
                textOrNull(node.path("whyChosenKo")),
                textOrNull(node.path("whyNotGrammarFirstKo")),
                textOrNull(node.path("addOnExampleEn")),
                textOrNull(node.path("addOnPlacementKo")),
                minorFixes
        );
    }

    private GeneratedSections parseGeneratedSections(JsonNode node) {
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
        List<CoachExpressionUsageDto> usedExpressions = new ArrayList<>();
        node.path("usedExpressions").forEach(item -> usedExpressions.add(new CoachExpressionUsageDto(
                item.path("expression").asText(""),
                true,
                "SELF_DISCOVERED",
                null,
                "SELF_DISCOVERED",
                item.path("meaningKo").isNull() ? null : item.path("meaningKo").asText(null),
                item.path("exampleEn").isNull() ? null : item.path("exampleEn").asText(null),
                item.path("usageTip").asText(""),
                ExpressionTagSupport.fromJsonNode(item.path("tags"))
        )));
        List<RefinementCard> refinementExpressions = new ArrayList<>();
        node.path("refinementExpressions").forEach(item -> refinementExpressions.add(new RefinementCard(
                item.path("expression").asText(""),
                item.path("guidanceKo").asText(""),
                item.path("exampleEn").asText(""),
                item.path("exampleKo").isNull() ? null : item.path("exampleKo").asText(null),
                item.path("meaningKo").isNull() ? null : item.path("meaningKo").asText(null)
        )));
        List<FeedbackSecondaryLearningPointDto> parsedFixPoints = dedupeCorrectionFixPoints(fixPoints);
        return new GeneratedSections(
                null,
                strengths,
                null,
                null,
                List.of(),
                List.of(),
                refinementExpressions,
                null,
                node.path("modelAnswer").isNull() ? null : node.path("modelAnswer").asText(null),
                node.path("modelAnswerKo").isNull() ? null : node.path("modelAnswerKo").asText(null),
                List.of(),
                usedExpressions,
                parsedFixPoints,
                List.of(),
                null,
                List.of(),
                parseCoachMission(node.path("coachMission")),
                parseMissionDecision(node.path("missionDecision"))
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

    private SectionPolicy llmPassThroughSectionPolicy() {
        return new SectionPolicy(
                true, 4,
                true, 5,
                true,
                true, 12,
                RefinementFocus.DETAIL_BUILDING,
                true,
                true,
                true,
                4,
                ModelAnswerMode.ONE_STEP_UP,
                AttemptOverlayPolicy.NONE
        );
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

        boolean hasGrammarCard = sectionPolicy.showGrammar()
                && answerBand == AnswerBand.GRAMMAR_BLOCKING;
        boolean hasHighValueCorrection = hasGrammarCard
                && answerBand == AnswerBand.GRAMMAR_BLOCKING;
        boolean hasPrimaryFix = hasGrammarCard
                || answerBand == AnswerBand.OFF_TOPIC
                || taskCompletion != TaskCompletion.FULL
                || answerBand == AnswerBand.CONTENT_THIN;

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
                SectionKey.IMPROVEMENT,
                SectionKey.REWRITE_GUIDE,
                SectionKey.MODEL_ANSWER,
                SectionKey.REFINEMENT
        );
    }

    private String formatRequestedSectionsForPrompt(List<SectionKey> requestedSections) {
        List<SectionKey> effectiveSections = (requestedSections == null || requestedSections.isEmpty())
                ? List.of(
                SectionKey.STRENGTHS,
                SectionKey.IMPROVEMENT,
                SectionKey.REWRITE_GUIDE,
                SectionKey.REFINEMENT,
                SectionKey.MODEL_ANSWER,
                SectionKey.USED_EXPRESSIONS
        )
                : requestedSections;

        return effectiveSections.stream()
                .map(this::formatSectionKeyForPrompt)
                .filter(sectionName -> !sectionName.isBlank())
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
            case IMPROVEMENT -> "FIX_POINTS";
            case GRAMMAR -> "GRAMMAR_FEEDBACK";
            case REFINEMENT -> "REFINEMENT_EXPRESSIONS";
            case SUMMARY -> "SUMMARY";
            case REWRITE_GUIDE -> "REWRITE_GUIDE";
            case MODEL_ANSWER -> "MODEL_ANSWER";
            case USED_EXPRESSIONS -> "USED_EXPRESSIONS";
            default -> "";
        };
    }

    private boolean isRequested(List<SectionKey> requestedSections, SectionKey sectionKey) {
        return requestedSections != null && requestedSections.contains(sectionKey);
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

    private List<FeedbackSecondaryLearningPointDto> sanitizeFixPoints(
            List<FeedbackSecondaryLearningPointDto> fixPoints
    ) {
        if (fixPoints == null || fixPoints.isEmpty()) {
            return List.of();
        }
        List<FeedbackSecondaryLearningPointDto> sanitized = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (FeedbackSecondaryLearningPointDto point : fixPoints) {
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

    private List<FeedbackRewriteSuggestionDto> sanitizeRewriteSuggestions(List<FeedbackRewriteSuggestionDto> rewriteSuggestions) {
        if (rewriteSuggestions == null || rewriteSuggestions.isEmpty()) {
            return List.of();
        }

        List<FeedbackRewriteSuggestionDto> sanitized = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (FeedbackRewriteSuggestionDto suggestion : rewriteSuggestions) {
            if (suggestion == null) {
                continue;
            }
            String english = sanitizeRewriteSuggestionEnglish(suggestion.english());
            if (english == null) {
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
        List<GrammarFeedbackItemDto> primary = feedbackSectionValidators.validateGrammarSectionFormat(grammarFeedback);
        primary = feedbackSectionValidators.filterLowValueGrammarItems(primary);
        if (!primary.isEmpty()) {
            return List.copyOf(primary);
        }

        List<GrammarFeedbackItemDto> fallback = feedbackSectionValidators.validateGrammarSectionFormat(toGrammarFeedback(diagnosis));
        fallback = feedbackSectionValidators.filterLowValueGrammarItems(fallback);
        if (!fallback.isEmpty()) {
            return List.copyOf(fallback);
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
        return false;
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
            String meaningKo = usage.meaningKo() == null ? null : usage.meaningKo().trim();
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
                        meaningKo == null || meaningKo.isBlank() ? null : meaningKo,
                        usage.exampleEn() == null || usage.exampleEn().isBlank() ? null : usage.exampleEn().trim(),
                        usageTip,
                        ExpressionTagSupport.withUsedExpressionDefaults(usage.tags(), usage.expression())
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
        boolean fixWorkRequested = requestedSections != null
                && requestedSections.contains(SectionKey.IMPROVEMENT);
        boolean strengthsRequested = requestedSections != null && requestedSections.contains(SectionKey.STRENGTHS);

        boolean fixPointRetryNeeded = fixWorkRequested && (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.LOW_VALUE_SECTION)
                || failureCodes.contains(ValidationFailureCode.NEAR_DUPLICATE)
                || failureCodes.contains(ValidationFailureCode.EMPTY_IMPROVEMENT));
        if (fixPointRetryNeeded) {
            instructions.add("- Replace generic FIX_POINTS with specific ones. Each item should teach one point and name the exact phrase, word, connector, or slot to change when no original/revised pair is shown.");
            instructions.add("- If multiple distinct fixes remain, return them as separate FIX_POINTS instead of repeating the same lesson.");
            instructions.add("- If one FIX_POINTS pair changes several things, either split it into smaller cards or explain every changed part clearly in supportText. Do not explain only the first edit.");
            instructions.add("- Do not use a tiny FIX_POINTS span that loses context. If the fix involves a connector, preposition, article, pronoun, or determiner, widen the pair enough that the card is still truthful when read alone.");
            instructions.add("- Do not create a FIX_POINTS pair that implies adding or removing a word already present in the learner sentence outside the cropped span.");
            instructions.add("- For correction-pair FIX_POINTS, put the full explanation under supportText and avoid scattering the same explanation into meaningKo, guidanceKo, exampleEn, or exampleKo.");
            instructions.add("- Do not use vague supportText like '문법이 맞지 않아요' or '더 자연스럽습니다' by itself. Name the exact changed phrase and the concrete rule or usage reason.");
        }
        if (strengthsRequested && (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.NEAR_DUPLICATE)
                || failureCodes.contains(ValidationFailureCode.LOW_VALUE_SECTION))) {
            instructions.add("- STRENGTHS should be one short Korean keep-signal that says what the learner should keep in the next rewrite.");
        }
        if (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.UNALIGNED_REWRITE_TARGET)) {
            instructions.add("- REFINEMENT_EXPRESSIONS should carry optional expression/detail ideas. Keep them distinct from FIX_POINTS and avoid padding.");
            instructions.add("- If optional advice repeats the same original/revised pair, added phrase, or advice already shown in FIX_POINTS, remove it instead of padding the response.");
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

        String skeleton = diagnosis == null ? null : diagnosis.minimalCorrection();
        if (skeleton == null) {
            return null;
        }

        ExpansionBudget expansionBudget = diagnosis == null ? ExpansionBudget.ONE_SUPPORT_SENTENCE : diagnosis.expansionBudget();
        if (expansionBudget == ExpansionBudget.NONE) {
            return "\"" + skeleton + "\" 틀을 먼저 그대로 쓰고, 필요한 단어만 채워서 문장을 완성해 보세요.";
        }
        if (expansionBudget == ExpansionBudget.ONE_SUPPORT_SENTENCE) {
            return "\"" + skeleton + "\" 틀로 먼저 한 문장을 만들고, 그다음 이유나 예시를 한 문장 더 붙여 보세요.";
        }
        return "\"" + skeleton + "\" 틀로 중심 문장을 만든 뒤, 디테일이나 이유를 덧붙여 답을 더 풍부하게 만들어 보세요.";
    }
    private String fallbackTooShortRewriteGuide(FeedbackDiagnosisResult diagnosis) {
        String skeleton = diagnosis == null ? null : diagnosis.minimalCorrection();
        String usableSkeleton = inferTooShortSkeleton(diagnosis == null ? null : diagnosis.minimalCorrection());
        if (usableSkeleton == null) {
            usableSkeleton = preferFillInSkeleton(skeleton);
        }
        if (usableSkeleton == null) {
            usableSkeleton = "I ____.";
        }
        return "\"" + usableSkeleton + "\" 틀부터 먼저 완성한 다음, 짧은 이유나 예시를 덧붙여 한 단계 더 길게 써 보세요.";
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
        if (preferredSkeleton == null) {
            preferredSkeleton = "I ____.";
        }
        return buildNormalizedTooShortRewriteGuideInstruction(preferredSkeleton);
    }

    private String buildNormalizedTooShortRewriteGuideInstruction(String skeleton) {
        String cleanSkeleton = skeleton == null || skeleton.isBlank() ? "I ____." : skeleton.trim();
        return "\"" + cleanSkeleton + "\" 틀을 먼저 채운 뒤, 시간 표현이나 이유를 한 가지 더 붙여 문장을 조금 더 자연스럽게 확장해 보세요.";
    }
    private String buildTooShortRewriteGuideInstruction(String skeleton) {
        String cleanSkeleton = skeleton == null || skeleton.isBlank() ? "I ____." : skeleton.trim();
        return "\"" + cleanSkeleton + "\" 틀을 먼저 채워 한 문장으로 완성해 보세요.";
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
        String skeleton = "";
        return !skeleton.isBlank() && normalizedGuide.contains(skeleton) ? false : normalizedGuide.contains("i have this is to");
    }

    private String anchorTextForModelAnswer(FeedbackDiagnosisResult diagnosis, AnswerProfile answerProfile) {
        return firstNonBlank(
                diagnosis.minimalCorrection(),
                answerProfile == null || answerProfile.grammar() == null ? null : answerProfile.grammar().minimalCorrection()
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

    private String generationBandGuidance(AnswerBand answerBand) {
        return switch (answerBand) {
            case GRAMMAR_BLOCKING -> """
                    - Prioritize the core sentence repair before extra expansion.
                    - Keep fixPoints compact and centered on the repair.
                    - Keep modelAnswer very close to learner meaning and the corrected direction.
                    """;
            case TOO_SHORT_FRAGMENT -> """
                    - Prioritize completing one full base sentence before any expansion.
                    - Keep fixPoints centered on finishing the fragment cleanly.
                    - After the base sentence is complete, use refinementExpressions for natural follow-up reasons, details, or examples when helpful.
                    - Avoid unsupported invention in fixPoints or modelAnswer.
                    """;
            case CONTENT_THIN, SHORT_BUT_VALID -> """
                    - Prioritize adding one more concrete reason, detail, image, or habit.
                    - Keep finishable=false unless the answer already contains at least one clear supporting detail, reason, example, or time flow beyond the base answer.
                    - A clean single-sentence main answer is usually still not enough to finish here.
                    - Keep grammar explanation brief unless it directly blocks the next rewrite.
                    - Prefer fixPoints that help the learner support the same main idea more concretely.
                    - Keep modelAnswer close to learner meaning and move extra support, detail, or example into refinementExpressions instead of baking it into modelAnswer.
                    - Be proactive about returning multiple distinct reason, example, detail, time-flow, or connector ideas when they would help the learner extend the same answer.
                    - When the answer supports it, prefer several useful refinementExpressions instead of stopping after one.
                    """;
            case NATURAL_BUT_BASIC -> """
                    - Prioritize loop completion and learner confidence over another optional style swap.
                    - Prefer finishable=true when the prompt is answered and no meaningful local expression or grammar repair remains.
                    - If the answer is clear but still has an awkward core collocation, verb pattern, connector, or time expression that would look weak in a final submission, keep finishable=false and teach that one repair.
                    - Only teach one small naturalness or phrasing upgrade if it is genuinely new and not an equivalent-expression swap from previousCoachingSummary.
                    - Keep modelAnswer short, close to learner meaning, and low-pressure.
                    - Put optional polish, smoother wording, and extra detail into refinementExpressions instead of overloading modelAnswer.
                    """;
            case OFF_TOPIC -> """
                    - Prioritize getting the learner back to the actual task before polishing language.
                    - Keep fixPoints centered on answering the prompt directly.
                    - After task alignment is clear, use refinementExpressions for additional reasons, details, or examples when they strengthen the on-topic answer.
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

    private MeaningClarity parseMeaningClarity(String value) {
        return parseEnum(value, MeaningClarity.CLEAR, MeaningClarity.class);
    }

    private GrammarImpact parseGrammarImpact(String value) {
        return parseEnum(value, GrammarImpact.NONE, GrammarImpact.class);
    }

    private ContentOpportunity parseContentOpportunity(String value) {
        return parseEnum(value, ContentOpportunity.NONE, ContentOpportunity.class);
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
        if (operations == null) {
            return null;
        }
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
        if (isInlineTokenDiffTooLarge(originalTokens, revisedTokens)) {
            return null;
        }

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

    private boolean isInlineTokenDiffTooLarge(List<String> originalTokens, List<String> revisedTokens) {
        if (originalTokens.size() > MAX_INLINE_DIFF_TOKENS || revisedTokens.size() > MAX_INLINE_DIFF_TOKENS) {
            return true;
        }
        long cellCount = (long) (originalTokens.size() + 1) * (long) (revisedTokens.size() + 1);
        return cellCount > MAX_INLINE_DIFF_CELLS;
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
        if (!onTopic) {
            return false;
        }
        if (answerBand == AnswerBand.OFF_TOPIC
                || answerBand == AnswerBand.TOO_SHORT_FRAGMENT
                || answerBand == AnswerBand.SHORT_BUT_VALID) {
            return false;
        }
        if (shouldForceTaskResetAnswer(learnerAnswer)) {
            return false;
        }
        if (answerBand == AnswerBand.GRAMMAR_BLOCKING) {
            return false;
        }
        if (taskCompletion != TaskCompletion.FULL && !hasConcreteGoalCompletionCue(learnerAnswer)) {
            return false;
        }
        if (!isSubmissionReadyForCompletion(learnerAnswer, diagnosis, answerProfile, grammarFeedback)) {
            return false;
        }
        return finishable || shouldAutoComplete(answerBand, learnerAnswer, answerProfile, diagnosis, grammarFeedback);
    }

    private boolean shouldAutoComplete(
            AnswerBand answerBand,
            String learnerAnswer,
            AnswerProfile answerProfile,
            FeedbackDiagnosisResult diagnosis,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (!canAutoCompleteWithLocalQuality(diagnosis, grammarFeedback)) {
            return false;
        }
        if (answerBand != AnswerBand.NATURAL_BUT_BASIC) {
            return answerBand == AnswerBand.CONTENT_THIN
                    && countWords(learnerAnswer) >= 12
                    && (hasStrongCompletionSignals(answerProfile) || hasConcreteGoalCompletionCue(learnerAnswer))
                    && !hasGenericAdjectiveReason(learnerAnswer)
                    && !hasFlatClosing(learnerAnswer);
        }
        return hasRequiredSupportClause(answerProfile)
                && !hasGenericAdjectiveReason(learnerAnswer)
                && !hasFlatClosing(learnerAnswer);
    }

    private boolean canAutoCompleteWithLocalQuality(
            FeedbackDiagnosisResult diagnosis,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (diagnosis != null) {
            if (diagnosis.grammarImpact() == GrammarImpact.LOCAL
                    || diagnosis.grammarImpact() == GrammarImpact.BLOCKING) {
                return false;
            }
            if (diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MODERATE.ordinal()) {
                return false;
            }
            if (countMeaningfulDiagnosedGrammarIssues(diagnosis) >= 2) {
                return false;
            }
        }

        return countMeaningfulGrammarFixes(grammarFeedback) == 0;
    }

    private boolean hasStrongCompletionSignals(AnswerProfile answerProfile) {
        if (answerProfile == null || answerProfile.content() == null || answerProfile.content().signals() == null) {
            return false;
        }
        ContentSignals signals = answerProfile.content().signals();
        return signals.hasMainAnswer()
                && signals.hasReason()
                && signals.hasActivity()
                && signals.hasTimeOrPlace();
    }

    private boolean hasConcreteGoalCompletionCue(String learnerAnswer) {
        String normalized = normalizeForComparison(learnerAnswer).toLowerCase(Locale.ROOT);
        if (!normalized.contains("because")) {
            return false;
        }
        return normalized.matches(".*\\b\\d+\\s+times?\\s+a\\s+week\\b.*")
                || normalized.matches(".*\\b(one|two|three|four|five|six|seven)\\s+times?\\s+a\\s+week\\b.*")
                || normalized.matches(".*\\b(every day|this year|next year|every morning|every night)\\b.*");
    }

    private boolean isSubmissionReadyForCompletion(
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile,
            List<GrammarFeedbackItemDto> grammarFeedback
    ) {
        if (diagnosis != null) {
            if (diagnosis.grammarImpact() == GrammarImpact.LOCAL
                    || diagnosis.grammarImpact() == GrammarImpact.BLOCKING) {
                return false;
            }
            if (diagnosis.grammarSeverity().ordinal() >= GrammarSeverity.MODERATE.ordinal()) {
                return false;
            }
            if (countMeaningfulDiagnosedGrammarIssues(diagnosis) >= 2) {
                return false;
            }
        }
        if (answerProfile == null || answerProfile.grammar() == null) {
            return true;
        }
        GrammarProfile grammar = answerProfile.grammar();
        if (grammar.severity().ordinal() > GrammarSeverity.MINOR.ordinal()) {
            return false;
        }
        return countMeaningfulGrammarFixes(grammarFeedback) < 2;
    }

    private int countMeaningfulDiagnosedGrammarIssues(FeedbackDiagnosisResult diagnosis) {
        if (diagnosis == null || diagnosis.grammarIssues() == null || diagnosis.grammarIssues().isEmpty()) {
            return 0;
        }
        int count = 0;
        for (DiagnosedGrammarIssue issue : diagnosis.grammarIssues()) {
            if (issue == null) {
                continue;
            }
            String span = issue.span() == null ? "" : issue.span();
            String correction = issue.correction() == null ? "" : issue.correction();
            if (!span.isBlank()
                    && !correction.isBlank()
                    && !isCosmeticOnlyChange(span, correction)
                    && issue.severity().ordinal() >= GrammarSeverity.MINOR.ordinal()) {
                count++;
            }
        }
        return count;
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
            return "이미 좋아요. 원하면 위 제안만 가볍게 반영해 보세요.";
        }
        if (!isLoopComplete(learnerAnswer, diagnosis, answerProfile, corrections, grammarFeedback)) {
            return null;
        }
        return "이미 좋아요. 원하면 위 제안만 가볍게 반영해 보세요.";
    }

}
