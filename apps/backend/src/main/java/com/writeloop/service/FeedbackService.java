package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackCompletionDto;
import com.writeloop.dto.FeedbackFinishRequestDto;
import com.writeloop.dto.FeedbackLoopDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackRevealLaterDto;
import com.writeloop.dto.FeedbackSessionStatusDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.VisibleFeedbackSnapshotDto;
import com.writeloop.dto.VisibleFeedbackState;
import com.writeloop.exception.ApiException;
import com.writeloop.exception.GuestLimitExceededException;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.FeedbackDiagnosisExecutionStatus;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.SessionStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class FeedbackService {

    private static final Logger LOGGER = LoggerFactory.getLogger(FeedbackService.class);
    private static final int MAX_FEEDBACK_ANSWER_CHARS = 4_000;

    private final PromptService promptService;
    private final LlmFeedbackClient llmFeedbackClient;
    private final AnswerSessionRepository answerSessionRepository;
    private final AnswerAttemptRepository answerAttemptRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private FeedbackDiagnosisLogRepository feedbackDiagnosisLogRepository;

    @Autowired(required = false)
    private FeedbackDiagnosisLogRecorder feedbackDiagnosisLogRecorder;

    @Autowired(required = false)
    private FeedbackTimingRecorder feedbackTimingRecorder;

    public FeedbackService(
            PromptService promptService,
            LlmFeedbackClient llmFeedbackClient,
            AnswerSessionRepository answerSessionRepository,
            AnswerAttemptRepository answerAttemptRepository,
            ObjectMapper objectMapper
    ) {
        this.promptService = promptService;
        this.llmFeedbackClient = llmFeedbackClient;
        this.answerSessionRepository = answerSessionRepository;
        this.answerAttemptRepository = answerAttemptRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public FeedbackResponseDto review(FeedbackRequestDto request, Long currentUserId) {
        long startedAt = System.nanoTime();
        PromptDto prompt = promptService.findById(request.promptId());
        String answer = request.answer() == null ? "" : request.answer().trim();
        if (answer.length() > MAX_FEEDBACK_ANSWER_CHARS) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "ANSWER_TOO_LONG",
                    "답변은 4,000자 이하로 작성해 주세요."
            );
        }
        boolean hasExistingSession = request.sessionId() != null && !request.sessionId().isBlank();
        if (!hasExistingSession) {
            assertFeedbackProviderConfigured();
        }
        AnswerSessionEntity session = resolveSession(request, prompt.id(), currentUserId);
        String submissionId = normalizeSubmissionId(request.submissionId());
        FeedbackResponseDto existingResponse = findIdempotentResponse(session.getId(), submissionId);
        if (existingResponse != null) {
            return existingResponse;
        }
        assertFeedbackProviderConfigured();
        assertSubmissionAllowed(session);
        enforceGuestAttemptLimit(session, currentUserId);

        int attemptNo = answerAttemptRepository.countBySessionId(session.getId()) + 1;
        String previousAnswer = findPreviousAnswer(session.getId(), attemptNo);
        String previousCoachingSummary = buildPreviousCoachingSummary(session.getId());
        AttemptType attemptType = resolveAttemptType(request);
        List<PromptHintDto> hints = promptService.findHintsByPromptId(prompt.id());

        beginTiming(currentUserId, request.guestId(), prompt.id(), session.getId(), attemptNo);
        try {
            FeedbackResponseDto internalFeedback;
            try {
                internalFeedback = llmFeedbackClient.review(
                        prompt,
                        answer,
                        hints,
                        attemptNo,
                        previousAnswer,
                        previousCoachingSummary
                );
            } catch (RuntimeException exception) {
                saveFailedDiagnosisLog(
                        session,
                        attemptType,
                        attemptNo,
                        prompt,
                        hints,
                        answer,
                        previousAnswer,
                        llmFeedbackClient.takeLastExecutionTrace()
                );
                throw exception;
            }
            FeedbackAnalysisSnapshot snapshot = llmFeedbackClient.takeLastAnalysisSnapshot();
            FeedbackExecutionTrace executionTrace = llmFeedbackClient.takeLastExecutionTrace();
            if (!llmFeedbackClient.isAuthoritativeFeedback(internalFeedback) || snapshot == null) {
                FeedbackExecutionTrace failedTrace = executionTrace == null
                        ? null
                        : executionTrace.asFailure("Canonical feedback snapshot was unavailable");
                saveFailedDiagnosisLog(
                        session,
                        attemptType,
                        attemptNo,
                        prompt,
                        hints,
                        answer,
                        previousAnswer,
                        failedTrace
                );
                throw new ApiException(
                        HttpStatus.BAD_GATEWAY,
                        "FEEDBACK_GENERATION_UNAVAILABLE",
                        "피드백 결과를 확인할 수 없어요. 잠시 후 다시 시도해 주세요."
                );
            }

            FeedbackResponseDto feedback = attachLoopExperience(
                    llmFeedbackClient.clearInternalMetadata(internalFeedback)
            );
            feedback = withSession(feedback, session.getId(), attemptNo);
            feedback = feedback.withVisibleFeedback(buildVisibleFeedback(feedback));
            AnswerAttemptEntity savedAttempt = saveAttempt(
                    session,
                    attemptType,
                    attemptNo,
                    answer,
                    feedback,
                    submissionId
            );
            if (attemptNo == 1) {
                promptService.recordDailyPromptStart(
                        prompt.id(),
                        currentUserId,
                        request.guestId(),
                        session.getId()
                );
            }
            session.setStatus(feedback.loopComplete()
                    ? SessionStatus.READY_TO_FINISH
                    : SessionStatus.IN_PROGRESS);
            answerSessionRepository.save(session);
            saveDiagnosisLog(
                    session,
                    savedAttempt,
                    attemptType,
                    attemptNo,
                    prompt,
                    hints,
                    answer,
                    previousAnswer,
                    snapshot,
                    executionTrace == null
                            ? FeedbackExecutionTrace.successful(snapshot)
                            : executionTrace
            );
            recordServiceTiming("total", startedAt);
            return feedback;
        } finally {
            clearTiming();
        }
    }

    @Transactional
    public FeedbackSessionStatusDto finish(
            String sessionId,
            FeedbackFinishRequestDto request,
            Long currentUserId
    ) {
        String guestId = GuestIdentitySupport.normalizeGuestId(request == null ? null : request.guestId());
        AnswerSessionEntity session = findOwnedSession(sessionId, currentUserId, guestId);
        if (session.getStatus() == SessionStatus.COMPLETED) {
            return new FeedbackSessionStatusDto(session.getId(), SessionStatus.COMPLETED.name());
        }
        if (session.getStatus() != SessionStatus.READY_TO_FINISH || !latestAttemptIsReady(session.getId())) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "ANSWER_SESSION_NOT_READY",
                    "아직 완료할 수 없는 답변 세션이에요."
            );
        }

        session.setStatus(SessionStatus.COMPLETED);
        answerSessionRepository.save(session);
        promptService.recordDailyPromptComplete(
                session.getPromptId(),
                session.getUserId(),
                session.getGuestId(),
                session.getId()
        );
        return new FeedbackSessionStatusDto(session.getId(), SessionStatus.COMPLETED.name());
    }

    private FeedbackResponseDto attachLoopExperience(FeedbackResponseDto feedback) {
        boolean complete = feedback.loopComplete();
        FeedbackLoopDto loop = new FeedbackLoopDto(
                complete ? "READY_TO_FINISH" : "NEEDS_REWRITE",
                complete
                        ? firstNonBlank(feedback.completionMessage(), "좋아요. 이 답변을 완료할 준비가 됐어요.")
                        : firstNonBlank(feedback.summary(), "한 가지만 반영해서 다시 써 볼까요?"),
                complete ? "finish" : "rewrite",
                complete ? "루프 완료하기" : "다시 써보기",
                null
        );
        FeedbackCompletionDto completion = complete
                ? new FeedbackCompletionDto(
                firstNonBlank(feedback.completionMessage(), loop.headline()),
                firstNonBlank(feedback.summary(), "질문의 핵심을 충분히 담았어요."),
                "지금 답변으로 루프를 마쳐도 좋아요.",
                "다음 질문에서도 구체적인 내용을 한 가지 넣어 보세요."
        )
                : null;
        FeedbackRevealLaterDto revealLater = new FeedbackRevealLaterDto(
                null,
                complete ? "모범답안" : null
        );
        return feedback.withLoopExperience(
                loop,
                feedback.coachMove(),
                feedback.rewriteWorkspace(),
                completion,
                revealLater
        );
    }

    private FeedbackResponseDto withSession(FeedbackResponseDto feedback, String sessionId, int attemptNo) {
        return new FeedbackResponseDto(
                feedback.promptId(),
                sessionId,
                attemptNo,
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
                feedback.usedExpressions(),
                feedback.ui(),
                feedback.loop(),
                feedback.coachMove(),
                feedback.rewriteWorkspace(),
                feedback.completion(),
                feedback.revealLater(),
                feedback.visibleFeedback()
        );
    }

    private VisibleFeedbackSnapshotDto buildVisibleFeedback(FeedbackResponseDto feedback) {
        String strength = feedback.strengths().stream()
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
        if (feedback.loopComplete()) {
            return new VisibleFeedbackSnapshotDto(
                    1,
                    VisibleFeedbackState.READY_TO_FINISH,
                    strength,
                    null,
                    feedback.completion(),
                    feedback.refinementExpressions(),
                    feedback.modelAnswer(),
                    feedback.modelAnswerKo(),
                    false
            );
        }
        return new VisibleFeedbackSnapshotDto(
                1,
                VisibleFeedbackState.NEEDS_REWRITE,
                strength,
                toVisibleCoachMove(feedback.coachMove()),
                null,
                List.of(),
                null,
                null,
                false
        );
    }

    private FeedbackCoachMoveDto toVisibleCoachMove(FeedbackCoachMoveDto coachMove) {
        if (coachMove == null) {
            return null;
        }
        return new FeedbackCoachMoveDto(
                coachMove.focus(),
                coachMove.focusType(),
                coachMove.why(),
                coachMove.before(),
                coachMove.after(),
                coachMove.instruction(),
                null,
                coachMove.skeletonEn(),
                coachMove.skeletonKo(),
                coachMove.suggestedPhrases(),
                null,
                coachMove.targetSlot(),
                coachMove.languageCorrections()
        );
    }

    private AnswerSessionEntity resolveSession(FeedbackRequestDto request, String promptId, Long currentUserId) {
        String guestId = GuestIdentitySupport.normalizeGuestId(request.guestId());
        if (request.sessionId() != null && !request.sessionId().isBlank()) {
            AnswerSessionEntity session = findOwnedSession(request.sessionId(), currentUserId, guestId);
            if (!promptId.equals(session.getPromptId())) {
                throw ownershipMismatch();
            }
            if (currentUserId != null) {
                if (session.getUserId() == null) {
                    session.assignToUser(currentUserId);
                    return answerSessionRepository.save(session);
                }
            }
            return session;
        }

        if (currentUserId == null && guestId != null && answerSessionRepository.countByGuestId(guestId) >= 1) {
            throw new GuestLimitExceededException();
        }
        AnswerSessionEntity session = new AnswerSessionEntity(
                UUID.randomUUID().toString(),
                promptId,
                currentUserId == null ? guestId : null,
                currentUserId,
                SessionStatus.IN_PROGRESS
        );
        return answerSessionRepository.save(session);
    }

    private AnswerSessionEntity findOwnedSession(String sessionId, Long currentUserId, String guestId) {
        AnswerSessionEntity session = answerSessionRepository.findById(sessionId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "ANSWER_SESSION_NOT_FOUND",
                        "답변 세션을 찾을 수 없어요."
                ));
        if (session.getUserId() != null) {
            if (currentUserId == null || !session.getUserId().equals(currentUserId)) {
                throw ownershipMismatch();
            }
            return session;
        }
        if (session.getGuestId() != null
                && (guestId == null || !session.getGuestId().equals(guestId))) {
            throw ownershipMismatch();
        }
        return session;
    }

    private void assertSubmissionAllowed(AnswerSessionEntity session) {
        if (session.getStatus() == SessionStatus.COMPLETED) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "ANSWER_SESSION_COMPLETED",
                    "이미 완료한 답변 세션이에요."
            );
        }
    }

    private void enforceGuestAttemptLimit(AnswerSessionEntity session, Long currentUserId) {
        if (currentUserId == null
                && session.getGuestId() != null
                && answerAttemptRepository.countBySessionId(session.getId()) >= 2) {
            throw new GuestLimitExceededException();
        }
    }

    private void assertFeedbackProviderConfigured() {
        if (llmFeedbackClient.isConfigured()) {
            return;
        }
        throw new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "FEEDBACK_GENERATION_UNAVAILABLE",
                "지금은 피드백을 생성할 수 없어요. 잠시 후 다시 시도해 주세요."
        );
    }

    private String normalizeSubmissionId(String value) {
        if (value == null || value.isBlank()) {
            return UUID.randomUUID().toString();
        }
        String normalized = value.trim();
        if (normalized.length() > 64) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_SUBMISSION_ID",
                    "submissionId는 64자 이하여야 해요."
            );
        }
        return normalized;
    }

    private FeedbackResponseDto findIdempotentResponse(String sessionId, String submissionId) {
        return answerAttemptRepository.findBySessionIdAndSubmissionId(sessionId, submissionId)
                .map(this::readStoredFeedback)
                .orElse(null);
    }

    private FeedbackResponseDto readStoredFeedback(AnswerAttemptEntity attempt) {
        try {
            FeedbackResponseDto feedback = objectMapper.readValue(
                    attempt.getFeedbackPayloadJson(),
                    FeedbackResponseDto.class
            );
            if (feedback.visibleFeedback() != null || attempt.getVisibleFeedbackSnapshotJson() == null) {
                return feedback;
            }
            VisibleFeedbackSnapshotDto visibleFeedback = objectMapper.readValue(
                    attempt.getVisibleFeedbackSnapshotJson(),
                    VisibleFeedbackSnapshotDto.class
            );
            return feedback.withVisibleFeedback(visibleFeedback);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to deserialize idempotent feedback", exception);
        }
    }

    private boolean latestAttemptIsReady(String sessionId) {
        return answerAttemptRepository.findFirstBySessionIdOrderByAttemptNoDesc(sessionId)
                .map(AnswerAttemptEntity::getVisibleFeedbackSnapshotJson)
                .filter(value -> value != null && !value.isBlank())
                .map(value -> {
                    try {
                        return objectMapper.readValue(value, VisibleFeedbackSnapshotDto.class);
                    } catch (JsonProcessingException exception) {
                        return null;
                    }
                })
                .map(snapshot -> snapshot.state() == VisibleFeedbackState.READY_TO_FINISH)
                .orElse(false);
    }

    private ApiException ownershipMismatch() {
        return new ApiException(
                HttpStatus.FORBIDDEN,
                "SESSION_OWNERSHIP_MISMATCH",
                "이 답변 세션에 접근할 수 없어요."
        );
    }

    private AttemptType resolveAttemptType(FeedbackRequestDto request) {
        if (request.attemptType() == null || request.attemptType().isBlank()) {
            return AttemptType.INITIAL;
        }
        try {
            return AttemptType.valueOf(request.attemptType().trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            return AttemptType.INITIAL;
        }
    }

    private String findPreviousAnswer(String sessionId, int attemptNo) {
        if (attemptNo <= 1) {
            return null;
        }
        return answerAttemptRepository.findBySessionIdAndAttemptNo(sessionId, attemptNo - 1)
                .map(AnswerAttemptEntity::getAnswerText)
                .orElse(null);
    }

    private String buildPreviousCoachingSummary(String sessionId) {
        List<AnswerAttemptEntity> attempts = answerAttemptRepository.findBySessionIdOrderByAttemptNoAsc(sessionId);
        if (attempts.isEmpty()) {
            return null;
        }
        StringBuilder summary = new StringBuilder();
        attempts.stream().skip(Math.max(0, attempts.size() - 4)).forEach(attempt -> summary
                .append("Attempt ")
                .append(attempt.getAttemptNo())
                .append(": answer=")
                .append(compact(attempt.getAnswerText()))
                .append("; feedback=")
                .append(compact(attempt.getFeedbackSummary()))
                .append('\n'));
        return summary.toString().trim();
    }

    private String compact(String value) {
        if (value == null) {
            return "";
        }
        String compact = value.replaceAll("\\s+", " ").trim();
        return compact.length() <= 240 ? compact : compact.substring(0, 240);
    }

    private AnswerAttemptEntity saveAttempt(
            AnswerSessionEntity session,
            AttemptType attemptType,
            int attemptNo,
            String answer,
            FeedbackResponseDto feedback,
            String submissionId
    ) {
        try {
            String visibleFeedbackJson = feedback.visibleFeedback() == null
                    ? null
                    : objectMapper.writeValueAsString(feedback.visibleFeedback());
            AnswerAttemptEntity attempt = new AnswerAttemptEntity(
                    session.getId(),
                    attemptNo,
                    attemptType,
                    answer,
                    null,
                    firstNonBlank(feedback.summary(), "피드백이 생성됐어요."),
                    objectMapper.writeValueAsString(feedback.strengths()),
                    objectMapper.writeValueAsString(feedback.corrections()),
                    firstNonBlank(feedback.modelAnswer(), feedback.revisedAnswer(), ""),
                    firstNonBlank(feedback.rewriteChallenge(), feedback.summary(), ""),
                    objectMapper.writeValueAsString(feedback),
                    submissionId,
                    visibleFeedbackJson
            );
            return answerAttemptRepository.save(attempt);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize feedback for storage", exception);
        }
    }

    private void saveDiagnosisLog(
            AnswerSessionEntity session,
            AnswerAttemptEntity attempt,
            AttemptType attemptType,
            int attemptNo,
            PromptDto prompt,
            List<PromptHintDto> hints,
            String learnerAnswer,
            String previousAnswer,
            FeedbackAnalysisSnapshot snapshot,
            FeedbackExecutionTrace executionTrace
    ) {
        if (feedbackDiagnosisLogRepository == null) {
            return;
        }
        try {
            FeedbackDiagnosisResult diagnosis = snapshot.diagnosis();
            FeedbackDiagnosisLogEntity entity = FeedbackDiagnosisLogEntity.builder()
                    .executionStatus(FeedbackDiagnosisExecutionStatus.SUCCESS)
                    .answerAttemptId(attempt == null ? null : attempt.getId())
                    .sessionId(session.getId())
                    .attemptNo(attemptNo)
                    .attemptType(attemptType.name())
                    .userId(session.getUserId())
                    .guestId(session.getGuestId())
                    .promptId(prompt.id())
                    .inputFingerprint(FeedbackDiagnosisLogRecorder.fingerprint(prompt.id(), learnerAnswer))
                    .promptTopic(prompt.topic())
                    .promptTopicCategory(emptyToNull(prompt.topicCategory()))
                    .promptTopicDetail(emptyToNull(prompt.topicDetail()))
                    .promptDifficulty(prompt.difficulty())
                    .promptQuestionEn(prompt.questionEn())
                    .promptQuestionKo(prompt.questionKo())
                    .promptHintsJson(objectMapper.writeValueAsString(hints == null ? List.of() : hints))
                    .promptTaskMetaJson(objectMapper.writeValueAsString(prompt.taskMeta()))
                    .learnerAnswer(learnerAnswer)
                    .previousAnswer(emptyToNull(previousAnswer))
                    .llmProvider(snapshot.provider())
                    .llmModel(snapshot.model())
                    .reasoningEffort(executionTrace.reasoningEffort())
                    .thinkingBudget(executionTrace.thinkingBudget())
                    .diagnosisResponseStatusCode(executionTrace.initialResponseStatusCode())
                    .regenerationResponseStatusCode(executionTrace.retryResponseStatusCode())
                    .diagnosisResponseBodyJson(executionTrace.initialResponseBodyJson())
                    .regenerationResponseBodyJson(executionTrace.retryResponseBodyJson())
                    .contractViolationDetected(executionTrace.contractViolationDetected())
                    .retryAttempted(executionTrace.retryAttempted())
                    .contractRetrySucceeded(executionTrace.retrySucceeded())
                    .contractOriginalErrorReason(executionTrace.originalContractErrorReason())
                    .contractFinalErrorReason(executionTrace.finalErrorReason())
                    .diagnosisTopicRelevance(diagnosis.topicRelevance().name())
                    .diagnosisUtteranceForm(diagnosis.structureAssessment().status().name())
                    .diagnosisGrammarIssueCount((int) diagnosis.languageAssessment().revisionSteps().stream()
                            .filter(step -> step.kind() != LanguageIssueKind.STRUCTURE)
                            .count())
                    .elapsedMs(executionTrace.elapsedMs())
                    .diagnosisPayloadJson(objectMapper.writeValueAsString(diagnosis))
                    .finalSectionsJson(objectMapper.writeValueAsString(snapshot.finalSections()))
                    .build();
            feedbackDiagnosisLogRepository.save(entity);
        } catch (Exception exception) {
            LOGGER.warn("Failed to save canonical feedback diagnosis for session {}", session.getId(), exception);
        }
    }

    private void saveFailedDiagnosisLog(
            AnswerSessionEntity session,
            AttemptType attemptType,
            int attemptNo,
            PromptDto prompt,
            List<PromptHintDto> hints,
            String learnerAnswer,
            String previousAnswer,
            FeedbackExecutionTrace executionTrace
    ) {
        if (feedbackDiagnosisLogRecorder == null
                || executionTrace == null
                || executionTrace.finalSuccess()) {
            return;
        }
        try {
            feedbackDiagnosisLogRecorder.recordFailure(new FeedbackDiagnosisFailureEvent(
                    session.getId(),
                    attemptNo,
                    attemptType.name(),
                    session.getUserId(),
                    session.getGuestId(),
                    prompt,
                    hints,
                    learnerAnswer,
                    previousAnswer,
                    executionTrace
            ));
        } catch (RuntimeException exception) {
            LOGGER.warn("Failed to save failed feedback diagnosis for session {}", session.getId(), exception);
        }
    }

    private void beginTiming(Long userId, String guestId, String promptId, String sessionId, int attemptNo) {
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.beginAnswerTrace(userId, guestId, promptId, sessionId, attemptNo);
        }
    }

    private void recordServiceTiming(String phase, long startedAt) {
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.recordServicePhase(phase, (System.nanoTime() - startedAt) / 1_000_000);
        }
    }

    private void clearTiming() {
        if (feedbackTimingRecorder != null) {
            feedbackTimingRecorder.clearTrace();
        }
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
