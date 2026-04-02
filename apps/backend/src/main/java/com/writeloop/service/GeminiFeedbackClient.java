package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.exception.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class GeminiFeedbackClient {
    private static final Pattern INLINE_TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9']+|[^\\sA-Za-z0-9']+|\\s+");
    static final String INTERNAL_AUTHORITATIVE_SESSION_ID = "__LLM_HYBRID_FINAL__";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;
    private final AnswerProfileBuilder answerProfileBuilder = new AnswerProfileBuilder();
    private final SectionPolicySelector sectionPolicySelector = new SectionPolicySelector();
    private final CompletionStateSelector completionStateSelector = new CompletionStateSelector();
    private final FeedbackScreenPolicySelector feedbackScreenPolicySelector = new FeedbackScreenPolicySelector();
    private final FeedbackSectionValidators feedbackSectionValidators = new FeedbackSectionValidators();
    private final FeedbackDeterministicSectionGenerator deterministicSectionGenerator = new FeedbackDeterministicSectionGenerator();
    private final FeedbackDeterministicCorrectionResolver deterministicCorrectionResolver = new FeedbackDeterministicCorrectionResolver();
    private final FeedbackRetryPolicy feedbackRetryPolicy = new FeedbackRetryPolicy();
    private final ThreadLocal<FeedbackAnalysisSnapshot> latestAnalysisSnapshot = new ThreadLocal<>();

    private record GeminiApiResponse(
            int statusCode,
            String body
    ) {
    }

    private record DiagnosisCallResult(
            FeedbackDiagnosisResult diagnosis,
            int statusCode
    ) {
    }

    private record GenerationCallResult(
            GeneratedSections sections,
            int statusCode
    ) {
    }

    private static final class GeminiApiHttpException extends IllegalStateException {
        private final int statusCode;

        private GeminiApiHttpException(int statusCode, String message) {
            super(message);
            this.statusCode = statusCode;
        }

        int statusCode() {
            return statusCode;
        }
    }

    private ApiException feedbackGenerationUnavailable() {
        return new ApiException(
                HttpStatus.BAD_GATEWAY,
                "FEEDBACK_GENERATION_UNAVAILABLE",
                "피드백 생성 불가"
        );
    }

    public GeminiFeedbackClient(
            ObjectMapper objectMapper,
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-2.5-flash}") String model,
            @Value("${gemini.api-url:https://generativelanguage.googleapis.com/v1beta/models}") String apiUrl
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = apiUrl;
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
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Gemini API request failed", exception);
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
                feedback.usedExpressions()
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
        try {
            DiagnosisCallResult diagnosisCallResult = diagnose(prompt, answer, hints, attemptIndex, previousAnswer);
            diagnosis = diagnosisCallResult.diagnosis();
            diagnosisResponseStatusCode = diagnosisCallResult.statusCode();
        } catch (GeminiApiHttpException diagnosisFailure) {
            throw feedbackGenerationUnavailable();
        } catch (IOException diagnosisFailure) {
            throw feedbackGenerationUnavailable();
        } catch (InterruptedException diagnosisFailure) {
            Thread.currentThread().interrupt();
            throw feedbackGenerationUnavailable();
        } catch (RuntimeException diagnosisFailure) {
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
                    validation = validateGeneratedSections(
                            answer,
                            diagnosis,
                            diagnosedProfile,
                            sectionPolicy,
                            validation.sanitizedSections().merge(regenerated),
                            generationRequestedSections
                    );
                } catch (GeminiApiHttpException apiException) {
                    throw feedbackGenerationUnavailable();
                } catch (IOException ioException) {
                    throw feedbackGenerationUnavailable();
                } catch (InterruptedException interruptedException) {
                    Thread.currentThread().interrupt();
                    throw feedbackGenerationUnavailable();
                } catch (RuntimeException ignored) {
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
                    "GEMINI",
                    model,
                    diagnosisResponseStatusCode,
                    generationResponseStatusCode,
                    regenerationResponseStatusCode,
                    diagnosis,
                    diagnosedProfile,
                    sectionPolicy,
                    completed.sanitizedSections(),
                    diagnosisFallbackUsed,
                    false,
                    retryAttempted
            ));
            return assembleHybridResponse(prompt.id(), answer, diagnosis, diagnosedProfile, completed.sanitizedSections());
        } catch (GeminiApiHttpException apiException) {
            throw feedbackGenerationUnavailable();
        } catch (IOException generationFailure) {
            throw feedbackGenerationUnavailable();
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            throw feedbackGenerationUnavailable();
        } catch (RuntimeException ignored) {
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
                "GEMINI",
                model,
                diagnosisResponseStatusCode,
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
        GeminiApiResponse response = sendResponsesRequest(buildDiagnosisRequestBody(prompt, answer, hints, attemptIndex, previousAnswer));
        return new DiagnosisCallResult(parseDiagnosisResponse(response.body()), response.statusCode());
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
        GeminiApiResponse response = sendResponsesRequest(buildGenerationRequestBody(
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
        return new GenerationCallResult(parseGeneratedSections(response.body()), response.statusCode());
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
        boolean grammarRequested = isRequested(requestedSections, SectionKey.GRAMMAR);
        boolean improvementRequested = isRequested(requestedSections, SectionKey.IMPROVEMENT);
        boolean refinementRequested = isRequested(requestedSections, SectionKey.REFINEMENT);
        boolean summaryRequested = isRequested(requestedSections, SectionKey.SUMMARY);
        boolean rewriteGuideRequested = isRequested(requestedSections, SectionKey.REWRITE_GUIDE);
        boolean modelAnswerRequested = isRequested(requestedSections, SectionKey.MODEL_ANSWER);
        boolean usedExpressionsRequested = isRequested(requestedSections, SectionKey.USED_EXPRESSIONS);

        List<String> strengths = strengthsRequested
                ? limit(
                resolveDisplayableStrengths(generatedSections.strengths(), diagnosis, answerProfile),
                sectionPolicy.maxStrengthCount()
        )
                : List.of();
        if (strengthsRequested && strengths.isEmpty() && !diagnosis.finishable()) {
            failures.add(new ValidationFailure(
                    SectionKey.STRENGTHS,
                    ValidationFailureCode.EMPTY_STRENGTHS,
                    "No displayable strengths survived validation."
            ));
        }
        List<GrammarFeedbackItemDto> grammarFeedback = grammarRequested
                ? sanitizeGrammarFeedback(generatedSections.grammarFeedback(), diagnosis, answerProfile)
                : List.of();
        if (grammarRequested
                && grammarFeedback.isEmpty()
                && shouldRequireGrammarSection(diagnosis, answerProfile, sectionPolicy)) {
            failures.add(new ValidationFailure(
                    SectionKey.GRAMMAR,
                    ValidationFailureCode.EMPTY_GRAMMAR,
                    "No valid grammar feedback survived validation."
            ));
        }
        List<CorrectionDto> corrections = improvementRequested
                ? sanitizeCorrections(generatedSections.corrections())
                : List.of();
        if (improvementRequested && corrections.isEmpty() && !diagnosis.finishable()) {
            failures.add(new ValidationFailure(
                    SectionKey.IMPROVEMENT,
                    ValidationFailureCode.EMPTY_IMPROVEMENT,
                    "No non-grammar improvement point survived validation."
            ));
        }
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
        if (refinementRequested && refinementExpressions.isEmpty()) {
            failures.add(new ValidationFailure(
                    SectionKey.REFINEMENT,
                    ValidationFailureCode.LOW_VALUE_REFINEMENT,
                    "No displayable refinement cards survived validation."
            ));
        }

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
        boolean modelAnswerDuplicatedAnchor = false;
        if (modelAnswerRequested && protectedModelAnswer != null && modelAnswerAnchor != null) {
            if (feedbackSectionValidators.isNearDuplicateText(protectedModelAnswer, modelAnswerAnchor)
                    || !hasNovelOneStepUpDetail(protectedModelAnswer, modelAnswerAnchor)) {
                modelAnswerDuplicatedAnchor = true;
                protectedModelAnswer = null;
            }
        }
        if (modelAnswerRequested
                && sectionPolicy.modelAnswerMode() != ModelAnswerMode.OPTIONAL_IF_ALREADY_GOOD
                && protectedModelAnswer == null) {
            failures.add(new ValidationFailure(
                    SectionKey.MODEL_ANSWER,
                    modelAnswerDuplicatedAnchor
                            ? ValidationFailureCode.MODEL_DUPLICATE_ANCHOR
                            : ValidationFailureCode.LOW_VALUE_MODEL_ANSWER,
                    "Model answer was empty, duplicated the anchor, or regressed learner meaning."
            ));
        }

        String rewriteGuide = rewriteGuideRequested
                ? feedbackSectionValidators.reduceRewriteGuideModelAnswerDuplication(
                sanitizeRewriteGuide(generatedSections.rewriteGuide(), diagnosis, answerProfile),
                protectedModelAnswer,
                diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING
        )
                : null;
        if (rewriteGuideRequested && (rewriteGuide == null || rewriteGuide.isBlank())) {
            failures.add(new ValidationFailure(
                    SectionKey.REWRITE_GUIDE,
                    ValidationFailureCode.UNALIGNED_REWRITE_TARGET,
                    "Rewrite guide did not survive validation."
            ));
        } else if (rewriteGuideRequested
                && protectedModelAnswer != null
                && feedbackSectionValidators.isNearDuplicateText(rewriteGuide, protectedModelAnswer)) {
            failures.add(new ValidationFailure(
                    SectionKey.REWRITE_GUIDE,
                    ValidationFailureCode.REWRITE_DUPLICATE_MODEL_ANSWER,
                    "Rewrite guide overlapped too much with model answer."
            ));
        }

        String summary = summaryRequested
                ? feedbackSectionValidators.reduceSummaryDuplication(
                resolveDisplayableSummary(generatedSections.summary(), diagnosis, answerProfile),
                corrections,
                rewriteGuide
        )
                : null;
        if (summaryRequested && (summary == null || summary.isBlank()) && !diagnosis.finishable()) {
            failures.add(new ValidationFailure(
                    SectionKey.SUMMARY,
                    ValidationFailureCode.SUMMARY_DUPLICATES_IMPROVEMENT,
                    "Summary was empty or duplicated another section."
            ));
        }

        GeneratedSections sanitized = new GeneratedSections(
                summary,
                strengths,
                grammarFeedback,
                corrections,
                refinementExpressions,
                rewriteGuide,
                protectedModelAnswer,
                protectedModelAnswer == null ? null : guardedModelAnswer.modelAnswerKo(),
                usedExpressions
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
        return new FeedbackResponseDto(
                promptId,
                INTERNAL_AUTHORITATIVE_SESSION_ID,
                0,
                diagnosis.score(),
                loopComplete,
                completionMessage,
                generatedSections.summary(),
                generatedSections.strengths(),
                generatedSections.corrections(),
                inlineFeedback,
                grammarFeedback,
                correctedAnswer,
                toRefinementExpressionDtos(generatedSections.refinementExpressions()),
                generatedSections.modelAnswer(),
                generatedSections.modelAnswerKo(),
                generatedSections.rewriteGuide(),
                generatedSections.usedExpressions()
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
        String rewriteGuide = sectionPolicy.showRewriteGuide()
                ? sanitizeRewriteGuide(
                deterministicSectionGenerator.buildRewriteGuide(
                        prompt,
                        answerProfile,
                        answerBand,
                        correctedBase,
                        diagnosis.minimalCorrection(),
                        answerProfile == null || answerProfile.rewrite() == null || answerProfile.rewrite().target() == null
                                ? null
                                : answerProfile.rewrite().target().skeleton()
                ),
                diagnosis,
                answerProfile
        )
                : null;
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
        String summary = sectionPolicy.showSummary()
                ? feedbackSectionValidators.reduceSummaryDuplication(
                resolveDisplayableSummary(
                        deterministicSectionGenerator.buildSummary(answerProfile, strengths, corrections, answerBand),
                        diagnosis,
                        answerProfile
                ),
                corrections,
                rewriteGuide
        )
                : null;

        return new GeneratedSections(summary, strengths, grammarFeedback, corrections, refinementExpressions, rewriteGuide,
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

        String rewriteGuide = generatedSections.rewriteGuide();
        boolean needsHardRewriteFallback = sectionPolicy.showRewriteGuide()
                && (diagnosis.answerBand() == AnswerBand.TOO_SHORT_FRAGMENT
                || diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING);
        if ((rewriteGuide == null || rewriteGuide.isBlank()) && needsHardRewriteFallback) {
            rewriteGuide = fallbackSections.rewriteGuide();
        }

        return new GeneratedSections(
                generatedSections.summary(),
                generatedSections.strengths(),
                grammarFeedback,
                generatedSections.corrections(),
                generatedSections.refinementExpressions(),
                rewriteGuide,
                generatedSections.modelAnswer(),
                generatedSections.modelAnswerKo(),
                generatedSections.usedExpressions()
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

    private String resolveDisplayableSummary(
            String generatedSummary,
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        String koreanSummary = feedbackSectionValidators.filterKoreanSummary(generatedSummary);
        if (koreanSummary != null) {
            return koreanSummary;
        }
        return resolveKoreanFallbackSummary(diagnosis, answerProfile);
    }

    private String resolveKoreanFallbackSummary(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.OFF_TOPIC) {
            return "\uC9C8\uBB38\uC5D0 \uB9DE\uB294 \uD575\uC2EC \uB0B4\uC6A9\uC744 \uB354 \uBD84\uBA85\uD558\uAC8C \uB123\uC73C\uBA74 \uB2F5\uC774 \uD55C\uACB0 \uC120\uBA85\uD574\uC838\uC694.";
        }
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.GRAMMAR_BLOCKING) {
            return "\uD575\uC2EC \uB0B4\uC6A9\uC740 \uBCF4\uC774\uC9C0\uB9CC \uBB38\uC7A5 \uAD6C\uC870\uB97C \uB354 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB2E4\uB4EC\uC73C\uBA74 \uB2F5\uC774 \uD55C\uACB0 \uBD84\uBA85\uD574\uC838\uC694.";
        }
        if (diagnosis != null && diagnosis.finishable()) {
            return "\uC9C8\uBB38\uC5D0 \uB9DE\uB294 \uD575\uC2EC \uB0B4\uC6A9\uC774 \uC798 \uB4E4\uC5B4 \uC788\uC5B4\uC694. \uC9C0\uAE08 \uB2F5\uB3C4 \uCDA9\uBD84\uD788 \uAD1C\uCC2E\uC544\uC694.";
        }
        if (answerProfile != null && answerProfile.content() != null && answerProfile.content().signals() != null) {
            ContentSignals signals = answerProfile.content().signals();
            if (signals.hasMainAnswer() && signals.hasReason()) {
                return "\uC88B\uC544\uD558\uB294 \uB300\uC0C1\uACFC \uC774\uC720\uB97C \uD568\uAED8 \uC801\uC5B4 \uB2F5\uC758 \uD575\uC2EC\uC740 \uC798 \uB4E4\uB7EC\uB0AC\uC5B4\uC694.";
            }
            if (signals.hasMainAnswer() && signals.hasActivity()) {
                return "\uD558\uB294 \uD65C\uB3D9\uC740 \uC798 \uB4E4\uB7EC\uB0AC\uACE0, \uC2DC\uAC04 \uD750\uB984\uC774\uB098 \uD55C \uAC00\uC9C0 \uB514\uD14C\uC77C\uC744 \uB354 \uBD99\uC774\uBA74 \uB2F5\uC774 \uB354 \uC790\uC5F0\uC2A4\uB7EC\uC6CC\uC838\uC694.";
            }
            if (signals.hasMainAnswer()) {
                return "\uC9C8\uBB38\uC5D0 \uB9DE\uB294 \uD575\uC2EC \uB2F5\uC740 \uC798 \uB4E4\uC5B4 \uC788\uC5B4\uC694. \uD55C \uAC00\uC9C0 \uB514\uD14C\uC77C\uC744 \uB354 \uBD99\uC774\uBA74 \uB2F5\uC774 \uB354 \uD48D\uC131\uD574\uC838\uC694.";
            }
        }
        return "\uC9C8\uBB38\uC5D0 \uB9DE\uB294 \uD575\uC2EC \uB0B4\uC6A9\uC740 \uBCF4\uC774\uACE0, \uD55C \uAC00\uC9C0 \uB514\uD14C\uC77C\uC744 \uB354 \uBD99\uC774\uBA74 \uB2F5\uC774 \uB354 \uC120\uBA85\uD574\uC838\uC694.";
    }

    private List<String> resolveKoreanFallbackStrengths(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        if (diagnosis != null && diagnosis.finishable()) {
            return List.of("질문에 맞게 답의 흐름을 자연스럽게 이어 갔어요.");
        }
        if (answerProfile != null && answerProfile.content() != null && answerProfile.content().signals() != null) {
            ContentSignals signals = answerProfile.content().signals();
            if (signals.hasMainAnswer() && signals.hasReason()) {
                return List.of("답의 핵심과 이유를 함께 제시한 점이 좋아요.");
            }
            if (signals.hasMainAnswer() && signals.hasActivity()) {
                return List.of("실제로 하는 행동을 넣어 답이 더 살아 있어요.");
            }
            if (signals.hasMainAnswer()) {
                return List.of("질문에 맞는 핵심 답을 분명하게 말했어요.");
            }
        }
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.OFF_TOPIC) {
            return List.of("질문에 맞추려는 방향은 보여요.");
        }
        return List.of("질문에 맞는 답을 쓰려는 방향이 보여요.");
    }

    private List<String> resolveFallbackStrengths(
            FeedbackDiagnosisResult diagnosis,
            AnswerProfile answerProfile
    ) {
        if (diagnosis != null && diagnosis.finishable()) {
            return List.of("질문에 맞게 전체 흐름을 자연스럽게 이어 갔어요.");
        }
        if (answerProfile != null && answerProfile.content() != null && answerProfile.content().signals() != null) {
            ContentSignals signals = answerProfile.content().signals();
            if (signals.hasMainAnswer() && signals.hasReason()) {
                return List.of("질문에 맞는 답과 이유를 함께 말한 점이 좋아요.");
            }
            if (signals.hasMainAnswer() && signals.hasActivity()) {
                return List.of("문제와 해결 방법을 함께 제시한 점이 좋아요.");
            }
            if (signals.hasMainAnswer()) {
                return List.of("질문에 맞는 핵심 답을 분명하게 말한 점이 좋아요.");
            }
        }
        if (diagnosis != null && diagnosis.answerBand() == AnswerBand.OFF_TOPIC) {
            return List.of("답해 보려는 시도는 보여요.");
        }
        return List.of("질문에 답하려는 방향은 잘 잡혀 있어요.");
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
            case "VERB_PATTERN" -> "동사 형태를 더 자연스럽게 맞춰 주세요.";
            case "PREPOSITION" -> "전치사와 뒤 형태를 자연스럽게 이어 주세요.";
            case "ARTICLE" -> "관사나 수식어를 자연스럽게 맞춰 주세요.";
            case "AGREEMENT" -> "주어와 표현 형태를 자연스럽게 맞춰 주세요.";
            case "TENSE_ALIGNMENT" -> "시제를 문맥에 맞게 자연스럽게 맞춰 주세요.";
            case "POINT_OF_VIEW_ALIGNMENT" -> "주어와 시점을 문맥에 맞게 맞춰 주세요.";
            default -> "의미 흐름을 해치지 않도록 이 부분만 자연스럽게 고쳐 주세요.";
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
                                        "action", Map.of("type", "string"),
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
                        Map.entry("summary", Map.of("type", List.of("string", "null"))),
                        Map.entry("strengths", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        )),
                        Map.entry("grammarFeedback", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "originalText", Map.of("type", "string"),
                                                "revisedText", Map.of("type", "string"),
                                                "reasonKo", Map.of("type", "string")
                                        ),
                                        "required", List.of("originalText", "revisedText", "reasonKo")
                                )
                        )),
                        Map.entry("corrections", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "additionalProperties", false,
                                        "properties", Map.of(
                                                "issue", Map.of("type", "string"),
                                                "suggestion", Map.of("type", "string")
                                        ),
                                        "required", List.of("issue", "suggestion")
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
                        Map.entry("rewriteGuide", Map.of("type", List.of("string", "null"))),
                        Map.entry("modelAnswer", Map.of("type", List.of("string", "null"))),
                        Map.entry("modelAnswerKo", Map.of("type", List.of("string", "null")))
                )),
                Map.entry("required", List.of(
                        "summary",
                        "strengths",
                        "grammarFeedback",
                        "corrections",
                        "usedExpressions",
                        "refinementExpressions",
                        "rewriteGuide",
                        "modelAnswer",
                        "modelAnswerKo"
                ))
        );
        return buildStructuredRequestBody(
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

    private String buildStructuredRequestBody(String promptText, String schemaName, Map<String, Object> schema) throws IOException {
        return GeminiStructuredOutputSupport.buildGenerateContentRequestBody(objectMapper, promptText, schema);
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
        String requestedSectionText = requestedSections == null || requestedSections.isEmpty()
                ? "STRENGTHS, GRAMMAR, IMPROVEMENT, REFINEMENT, SUMMARY, REWRITE_GUIDE, MODEL_ANSWER, USED_EXPRESSIONS"
                : requestedSections.stream().map(Enum::name).reduce((left, right) -> left + ", " + right).orElse("");
        String retryFailures = failureCodes == null || failureCodes.isEmpty()
                ? "- none"
                : "- " + failureCodes.stream().map(Enum::name).reduce((left, right) -> left + ", " + right).orElse("");
        String retrySpecificInstructions = buildRetrySpecificInstructions(failureCodes, requestedSections);
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
                - Prioritize immediate rewrite usefulness over section completeness.

                Screen role map:
                - summary feeds the Top Status Card support text.
                - strengths feed Keep What Works.
                - usedExpressions feed the small expression chips under Keep What Works.
                - grammarFeedback feeds Fix First or a small micro-tip when grammar is secondary.
                - corrections are optional support data only for screens that still need one explicit content/detail action.
                - rewriteGuide feeds the Rewrite Guide starter.
                - modelAnswer feeds the Example Answer section.
                - refinementExpressions feed the lower-priority expression drawer.

                Common rules:
                - summary must be one short Korean support sentence for the Top Status Card, not a recap box and not a generic compliment.
                - summary must tell the learner how to read the screen right now: fix grammar first, add one detail, answer the prompt first, or optionally polish.
                - summary should match the dominant next step selected by answerBand and primaryIssueCode.
                - strengths must be semantic praise only. Never quote the full raw learner answer unless it is already clean and necessary.
                - strengths should usually be one short Korean line that tells the learner what to keep.
                - usedExpressions should contain at most 2 short reusable learner-used chunks that are already good enough to keep.
                - usedExpressions must not contain long broken spans or whole awkward sentences.
                - usedExpressions.usageTip must be one short Korean note about why the expression is worth keeping.
                - grammarFeedback must use the chosen minimalCorrection direction only and follow originalText / revisedText / reasonKo.
                - grammarFeedback should surface only the highest-value correction first, not many small edits.
                - corrections must be non-grammar improvement points only and should point to one next action.
                - corrections are optional. If the current screen does not need a separate content/detail action, return [].
                - If requested, return at most one correction item.
                - corrections must name one concrete weak learner phrase, vague word, or missing support slot. Avoid generic advice such as "make it more natural" unless you also say what to rewrite.
                - corrections.suggestion must tell the learner exactly what to change, add, or replace next. Prefer a concrete phrase or sentence pattern over abstract coaching language.
                - refinementExpressions must separate expression, meaningKo, guidanceKo, exampleEn, exampleKo.
                - exampleEn must not be identical to expression.
                - Never output placeholders such as [verb], [noun], [reason], or unresolved templates.
                - Do not reuse a broken learner phrase in strengths, refinement, rewriteGuide, or modelAnswer.
                - rewriteGuide must be based on minimalCorrection or rewriteTarget.skeleton, not the raw learner sentence.
                - rewriteGuide must include one concrete anchored sentence pattern, not only meta advice.
                - For non-too-short answers, rewriteGuide should usually contain a corrected clause or sentence the learner can directly build from.
                - Do not write rewriteGuide as only generic coaching text such as "표현을 더 자연스럽게 고쳐 보세요." without a concrete sentence anchor.
                - If answerBand is TOO_SHORT_FRAGMENT, rewriteGuide must be a short fill-in scaffold, not a polished final answer.
                - If answerBand is TOO_SHORT_FRAGMENT, prefer one clause and one blank over any expansion pattern such as "and ____." or "because ____."
                - If answerBand is TOO_SHORT_FRAGMENT, rewriteGuide should include one short instruction telling the learner to complete the sentence with a real action.
                - modelAnswer must preserve learner meaning, must not delete correct learner information, and must not over-invent new activities, feelings, or plans.
                - modelAnswer must feel clearly different from rewriteGuide. rewriteGuide is the learner scaffold; modelAnswer is only a one-step-up reference.
                - refinementExpressions are secondary. Prefer 1-2 strong reusable cards over many weak ones.
                - If requestedSections does not include a section, return [] for arrays or null for strings.
                - Keep Korean fields natural and concise.
                - If attemptIndex >= 2, avoid repeating already-resolved issues and focus on one remaining action.

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
        JsonNode rewriteTargetNode = node.path("rewriteTarget");
        RewriteTarget rewriteTarget = rewriteTargetNode.isMissingNode()
                ? null
                : new RewriteTarget(
                rewriteTargetNode.path("action").asText(""),
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
                node.path("primaryIssueCode").asText(""),
                node.path("secondaryIssueCode").isNull() ? null : node.path("secondaryIssueCode").asText(null),
                rewriteTarget,
                parseExpansionBudget(node.path("expansionBudget").asText("ONE_DETAIL")),
                regressionSensitiveFacts
        );
    }

    private GeneratedSections parseGeneratedSections(String body) throws IOException {
        JsonNode node = objectMapper.readTree(extractOutputText(body));
        List<String> strengths = new ArrayList<>();
        node.path("strengths").forEach(item -> strengths.add(item.asText("")));
        List<GrammarFeedbackItemDto> grammarFeedback = new ArrayList<>();
        node.path("grammarFeedback").forEach(item -> grammarFeedback.add(new GrammarFeedbackItemDto(
                item.path("originalText").asText(""),
                item.path("revisedText").asText(""),
                item.path("reasonKo").asText("")
        )));
        List<CorrectionDto> corrections = new ArrayList<>();
        node.path("corrections").forEach(item -> corrections.add(new CorrectionDto(
                item.path("issue").asText(""),
                item.path("suggestion").asText("")
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
        return new GeneratedSections(
                node.path("summary").isNull() ? null : node.path("summary").asText(null),
                strengths,
                grammarFeedback,
                corrections,
                refinementExpressions,
                node.path("rewriteGuide").isNull() ? null : node.path("rewriteGuide").asText(null),
                node.path("modelAnswer").isNull() ? null : node.path("modelAnswer").asText(null),
                node.path("modelAnswerKo").isNull() ? null : node.path("modelAnswerKo").asText(null),
                usedExpressions
        );
    }

    private GeminiApiResponse sendResponsesRequest(String requestBody) throws IOException, InterruptedException {
        HttpRequest request = GeminiStructuredOutputSupport.buildGenerateContentRequest(apiUrl, apiKey, model, requestBody);

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new GeminiApiHttpException(
                    response.statusCode(),
                    "Gemini API request failed with status " + response.statusCode()
            );
        }
        return new GeminiApiResponse(response.statusCode(), response.body());
    }

    private String extractOutputText(String body) throws IOException {
        return GeminiStructuredOutputSupport.extractStructuredOutputText(objectMapper, body);
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
        List<SectionKey> sections = new ArrayList<>();

        if (screenPolicy == null) {
            if (sectionPolicy.showSummary()) {
                sections.add(SectionKey.SUMMARY);
            }
            if (sectionPolicy.showStrengths()) {
                sections.add(SectionKey.STRENGTHS);
                sections.add(SectionKey.USED_EXPRESSIONS);
            }
            if (sectionPolicy.showGrammar()) {
                sections.add(SectionKey.GRAMMAR);
            }
            if (sectionPolicy.showImprovement()) {
                sections.add(SectionKey.IMPROVEMENT);
            }
            if (sectionPolicy.showRefinement()) {
                sections.add(SectionKey.REFINEMENT);
            }
            if (sectionPolicy.showRewriteGuide()) {
                sections.add(SectionKey.REWRITE_GUIDE);
            }
            if (sectionPolicy.showModelAnswer()) {
                sections.add(SectionKey.MODEL_ANSWER);
            }
            return List.copyOf(new ArrayList<>(new LinkedHashSet<>(sections)));
        }

        sections.add(SectionKey.SUMMARY);

        if (screenPolicy.keepWhatWorksDisplayMode() != SectionDisplayMode.HIDE) {
            sections.add(SectionKey.STRENGTHS);
            if (screenPolicy.keepExpressionChipMaxItems() > 0) {
                sections.add(SectionKey.USED_EXPRESSIONS);
            }
        }

        if (screenPolicy.fixFirstDisplayMode() != SectionDisplayMode.HIDE) {
            switch (screenPolicy.fixFirstMode()) {
                case GRAMMAR_CARD -> sections.add(SectionKey.GRAMMAR);
                case DETAIL_PROMPT_CARD -> sections.add(SectionKey.IMPROVEMENT);
                case TASK_RESET_CARD -> {
                    if (availability != null && availability.hasHighValueCorrection()) {
                        sections.add(SectionKey.GRAMMAR);
                    }
                }
                case HIDE -> {
                }
            }
        } else if (availability != null && availability.hasHighValueCorrection() && answerProfile != null) {
            sections.add(SectionKey.GRAMMAR);
        }

        if (screenPolicy.rewriteGuideDisplayMode() != SectionDisplayMode.HIDE) {
            sections.add(SectionKey.REWRITE_GUIDE);
        }
        if (screenPolicy.modelAnswerDisplayMode() != ModelAnswerDisplayMode.HIDE) {
            sections.add(SectionKey.MODEL_ANSWER);
        }
        if (screenPolicy.refinementDisplayMode() != RefinementDisplayMode.HIDE) {
            sections.add(SectionKey.REFINEMENT);
        }

        return List.copyOf(new ArrayList<>(new LinkedHashSet<>(sections)));
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

        if (answerProfile != null && answerProfile.grammar() != null && answerProfile.grammar().minimalCorrection() != null) {
            String originalText = diagnosis == null ? null : diagnosis.minimalCorrection();
            String revisedText = answerProfile.grammar().minimalCorrection();
            if (revisedText != null && !revisedText.isBlank()) {
                return List.of(new GrammarFeedbackItemDto(
                        originalText == null || originalText.isBlank() ? "" : originalText,
                        revisedText,
                        "수정문 방향에 맞춰 핵심 문법을 먼저 바로잡아 보세요."
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

    private String buildRetrySpecificInstructions(
            List<ValidationFailureCode> failureCodes,
            List<SectionKey> requestedSections
    ) {
        if (failureCodes == null || failureCodes.isEmpty() || requestedSections == null || requestedSections.isEmpty()) {
            return "- none";
        }
        List<String> instructions = new ArrayList<>();
        boolean improvementRequested = requestedSections.contains(SectionKey.IMPROVEMENT);
        boolean rewriteRequested = requestedSections.contains(SectionKey.REWRITE_GUIDE);
        boolean summaryRequested = requestedSections.contains(SectionKey.SUMMARY);
        boolean strengthsRequested = requestedSections.contains(SectionKey.STRENGTHS);
        if (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT) && improvementRequested) {
            instructions.add("- IMPROVEMENT must mention one actual learner phrase or one explicit missing detail. Do not say only \"자연스럽게 고쳐 보세요\" or \"이유를 더 붙여 보세요\".");
            instructions.add("- IMPROVEMENT.suggestion should show exactly what kind of replacement or added clause is needed next.");
        }
        if (summaryRequested && (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.SUMMARY_DUPLICATES_IMPROVEMENT)
                || failureCodes.contains(ValidationFailureCode.LOW_VALUE_SECTION))) {
            instructions.add("- SUMMARY must be one short Korean support sentence for the Top Status Card, not a generic compliment or recap.");
            instructions.add("- SUMMARY should name the one next step the learner should focus on right now.");
        }
        if (strengthsRequested && (failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.NEAR_DUPLICATE)
                || failureCodes.contains(ValidationFailureCode.LOW_VALUE_SECTION))) {
            instructions.add("- STRENGTHS should be one short Korean keep-signal, not a generic compliment.");
            instructions.add("- If you praise something, say what the learner should keep in the next rewrite.");
        }
        if ((failureCodes.contains(ValidationFailureCode.GENERIC_TEXT)
                || failureCodes.contains(ValidationFailureCode.UNALIGNED_REWRITE_TARGET))
                && rewriteRequested) {
            instructions.add("- REWRITE_GUIDE must include a concrete anchored sentence pattern, ideally reusing minimalCorrection or rewriteTarget.skeleton.");
            instructions.add("- REWRITE_GUIDE must not be only meta advice. Give the learner a sentence they can build from immediately.");
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
            return "\"" + base + "\"를 기준으로 다시 써 보세요.";
        }
        if (diagnosis.expansionBudget() == ExpansionBudget.ONE_SUPPORT_SENTENCE) {
            return "\"" + base + "\"를 바탕으로 질문에 직접 답하는 문장 뒤에 이유 문장 하나를 더 붙여 보세요.";
        }
        return "\"" + base + "\"를 바탕으로 한 가지 이유나 구체적인 설명을 더 붙여 보세요.";
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
        return "\"" + usableSkeleton + "\" 틀에 맞춰 한 문장으로 다시 쓰고, 빈칸에 실제 활동을 넣어 보세요.";
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
        return "\"" + cleanSkeleton + "\" 틀에 맞춰 먼저 한 문장으로 완성하고, 빈칸에는 실제 행동을 넣어 보세요.";
    }

    private String buildTooShortRewriteGuideInstruction(String skeleton) {
        String cleanSkeleton = skeleton == null || skeleton.isBlank() ? "I ____." : skeleton.trim();
        return "\"" + cleanSkeleton + "\" 틀에 맞춰 먼저 한 문장으로 완성해 보세요.";
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
                    - Keep the feedback centered on minimalCorrection.
                    - summary should clearly say that the learner should fix the core sentence first.
                    - refinement should prefer grammar pattern or immediate repair chunks.
                    - rewriteGuide should use minimalCorrection or the corrected skeleton and add one direct next action.
                    - modelAnswer is allowed only when it stays very close to minimalCorrection and learner meaning.
                    - If a modelAnswer would drift beyond a close correction, keep it empty.
                    """;
            case TOO_SHORT_FRAGMENT -> """
                    - Correction must come before invention.
                    - summary should clearly say that the learner should first complete one full sentence.
                    - Use a corrected skeleton first.
                    - rewriteGuide must be a one-clause fill-in skeleton such as "I go to ____." or "On Sunday afternoons, I usually ____."
                    - Prefer one blank and one clause. Do not push expansion with patterns like "and ____." before the learner has one complete base sentence.
                    - rewriteGuide must include a blank like ____ or ....
                    - Add one short instruction telling the learner to complete the blank with their real activity.
                    - Do not turn rewriteGuide into a polished final sentence.
                    - Do not invent a second activity, family member, place, feeling, or schedule detail unless the learner already mentioned it.
                    - Avoid unsupported lifestyle invention.
                    - Prefer rewriteGuide over modelAnswer for this band.
                    - Keep modelAnswer empty unless a very close corrected example is clearly necessary.
                    """;
            case CONTENT_THIN, SHORT_BUT_VALID -> """
                    - Focus on one more concrete reason, image, or habit.
                    - summary should say that the answer direction is okay and one more concrete detail is the next step.
                    - Avoid over-explaining grammar unless the chosen correction truly matters.
                    - modelAnswer should stay close to minimalCorrection and add only one detail.
                    - Even when the answer is already finishable, keep modelAnswer if a short one-step-up example would help the learner.
                    """;
            case NATURAL_BUT_BASIC -> sectionPolicy.showModelAnswer()
                    ? """
                    - Focus on naturalness and small polish only.
                    - summary should say that the answer is already okay and polishing is optional.
                    - Do not delete correct learner information.
                    - modelAnswer is optional and should usually stay empty.
                    - Show a modelAnswer only when one short example clearly improves the learner answer without adding much new content.
                    """
                    : """
                    - Focus on naturalness only.
                    - summary should say that the answer is already okay and polishing is optional.
                    - If strengths and improvement already help enough, keep modelAnswer empty.
                    """;
            case OFF_TOPIC -> """
                    - Reset the learner back to the task.
                    - summary should clearly say that the learner needs to answer the actual prompt first.
                    - refinement should prefer task-completion chunks.
                    - modelAnswer should be a short task-reset example.
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
        return !(hasRequiredSupportClause(answerProfile) && countMeaningfulGrammarFixes(grammarFeedback) > 1);
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
            return "좋아요. 지금 단계에서 마무리해도 충분해요. 원하면 한 번 더 다듬으면서 연습해 볼 수 있어요.";
        }
        if (!isLoopComplete(learnerAnswer, diagnosis, answerProfile, corrections, grammarFeedback)) {
            return null;
        }
        return "충분히 좋아서 지금 단계에서 마무리해도 괜찮아요. 원하면 한 번 더 다듬어 보며 연습할 수도 있어요.";
    }
}

