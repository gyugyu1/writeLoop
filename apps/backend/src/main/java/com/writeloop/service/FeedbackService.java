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
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class FeedbackService {

    private static final Logger LOGGER = LoggerFactory.getLogger(FeedbackService.class);
    private static final int MAX_FEEDBACK_ANSWER_CHARS = 4_000;
    // 처리 중인 같은 제출을 기다리는 시간. 요청 마감(80초)보다 조금 길고 앱 제한(90초)보다 짧다.
    private static final Duration IN_FLIGHT_WAIT = Duration.ofSeconds(85);

    private final PromptService promptService;
    private final LlmFeedbackClient llmFeedbackClient;
    private final AnswerSessionRepository answerSessionRepository;
    private final AnswerAttemptRepository answerAttemptRepository;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactionTemplate;
    private final ConcurrentMap<String, CompletableFuture<FeedbackResponseDto>> inFlightReviews = new ConcurrentHashMap<>();

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
            ObjectMapper objectMapper,
            TransactionTemplate transactionTemplate
    ) {
        this.promptService = promptService;
        this.llmFeedbackClient = llmFeedbackClient;
        this.answerSessionRepository = answerSessionRepository;
        this.answerAttemptRepository = answerAttemptRepository;
        this.objectMapper = objectMapper;
        this.transactionTemplate = transactionTemplate;
    }

    // 같은 제출이 아직 처리 중일 때 다시 오면(앱이 연결을 잃고 다시 보낸 경우) LLM을 한 번 더 부르지 않고 첫 요청의 결과를 기다린다.
    // 첫 요청이 실패하면 기다리던 요청이 직접 처리한다. 백엔드가 한 대라서 이 서버 안에서만 확인하면 된다.
    public FeedbackResponseDto review(FeedbackRequestDto request, Long currentUserId) {
        String key = inFlightKey(request, currentUserId);
        if (key == null) {
            return reviewOnce(request, currentUserId);
        }
        CompletableFuture<FeedbackResponseDto> mine = new CompletableFuture<>();
        CompletableFuture<FeedbackResponseDto> running = inFlightReviews.putIfAbsent(key, mine);
        if (running != null) {
            FeedbackResponseDto joined = awaitInFlight(running);
            return joined != null ? joined : reviewOnce(request, currentUserId);
        }
        try {
            FeedbackResponseDto response = reviewOnce(request, currentUserId);
            mine.complete(response);
            return response;
        } catch (RuntimeException exception) {
            mine.completeExceptionally(exception);
            throw exception;
        } finally {
            inFlightReviews.remove(key, mine);
        }
    }

    private String inFlightKey(FeedbackRequestDto request, Long currentUserId) {
        String submissionId = request.submissionId() == null ? "" : request.submissionId().trim();
        if (submissionId.isEmpty()) {
            return null;
        }
        String owner = currentUserId != null ? "user:" + currentUserId : "guest:" + request.guestId();
        return owner + "|" + request.promptId() + "|" + submissionId;
    }

    private FeedbackResponseDto awaitInFlight(CompletableFuture<FeedbackResponseDto> running) {
        try {
            return running.get(IN_FLIGHT_WAIT.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return null;
        } catch (ExecutionException | TimeoutException exception) {
            return null;
        }
    }

    // LLM 호출(보통 십수 초, 길면 80초)을 DB 트랜잭션 밖에서 해서, 기다리는 동안 DB 연결을 붙잡지 않는다.
    // 준비(검증·조회)와 저장은 각각 짧은 트랜잭션이다. 새 세션은 LLM이 성공한 뒤 저장 단계에서 만든다.
    // 그래야 LLM이 실패해도 빈 세션이 남지 않는다(게스트 질문 수 제한에 걸리지 않는다).
    private FeedbackResponseDto reviewOnce(FeedbackRequestDto request, Long currentUserId) {
        long startedAt = System.nanoTime();
        ReviewPreparation preparation = transactionTemplate.execute(
                status -> prepareReview(request, currentUserId)
        );
        if (preparation.storedResponse() != null) {
            return preparation.storedResponse();
        }

        PromptDto prompt = preparation.prompt();
        AnswerSessionEntity session = preparation.session();
        String answer = preparation.answer();
        int attemptNo = preparation.attemptNo();
        String previousAnswer = preparation.previousAnswer();
        AttemptType attemptType = preparation.attemptType();
        List<PromptHintDto> hints = preparation.hints();

        beginTiming(currentUserId, request.guestId(), prompt.id(), session.getId(), attemptNo);
        try {
            FeedbackResponseDto internalFeedback;
            try {
                internalFeedback = llmFeedbackClient.review(
                        prompt,
                        answer,
                        hints,
                        attemptNo
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

            FeedbackResponseDto shapedFeedback = attachLoopExperience(
                    llmFeedbackClient.clearInternalMetadata(internalFeedback)
            );
            shapedFeedback = withSession(shapedFeedback, session.getId(), attemptNo);
            FeedbackResponseDto feedback = shapedFeedback.withVisibleFeedback(buildVisibleFeedback(shapedFeedback));
            PersistedReview persisted = transactionTemplate.execute(
                    status -> persistReview(preparation, feedback, currentUserId, request.guestId())
            );
            if (persisted.storedResponse() != null) {
                return persisted.storedResponse();
            }
            // 진단 로그는 답변 저장과 따로 저장한다. 로그 저장이 실패해도 학습자의 답변은 남는다.
            saveDiagnosisLog(
                    persisted.session(),
                    persisted.attempt(),
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

    private ReviewPreparation prepareReview(FeedbackRequestDto request, Long currentUserId) {
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
        String submissionId = normalizeSubmissionId(request.submissionId());
        // 앱이 보낸 제출 id만 재시도 확인에 쓴다. 없으면 서버가 새로 만든 id라 이전 제출과 겹칠 수 없다.
        String clientSubmissionId = request.submissionId() == null || request.submissionId().isBlank() ? null : submissionId;
        if (!hasExistingSession) {
            // 게스트 질문 수 제한보다 먼저 본다. 첫 답변이 저장됐는데 응답만 못 받은 게스트도 결과를 받아야 한다.
            FeedbackResponseDto firstSubmission = findFirstSubmissionResponse(
                    prompt.id(), currentUserId, request.guestId(), clientSubmissionId
            );
            if (firstSubmission != null) {
                return ReviewPreparation.stored(firstSubmission);
            }
            assertFeedbackProviderConfigured();
        }
        AnswerSessionEntity session = resolveSession(request, prompt.id(), currentUserId);
        FeedbackResponseDto existingResponse = findIdempotentResponse(session.getId(), submissionId);
        if (existingResponse != null) {
            return ReviewPreparation.stored(existingResponse);
        }
        assertFeedbackProviderConfigured();
        assertSubmissionAllowed(session);
        enforceGuestAttemptLimit(session, currentUserId);

        int attemptNo = answerAttemptRepository.countBySessionId(session.getId()) + 1;
        return new ReviewPreparation(
                prompt,
                answer,
                session,
                !hasExistingSession,
                submissionId,
                clientSubmissionId,
                attemptNo,
                findPreviousAnswer(session.getId(), attemptNo),
                resolveAttemptType(request),
                promptService.findHintsByPromptId(prompt.id()),
                null
        );
    }

    private PersistedReview persistReview(
            ReviewPreparation preparation,
            FeedbackResponseDto feedback,
            Long currentUserId,
            String guestId
    ) {
        AnswerSessionEntity session;
        if (preparation.newSession()) {
            // LLM을 기다리는 동안 같은 첫 제출이 먼저 저장됐으면 세션을 하나 더 만들지 않는다.
            FeedbackResponseDto storedResponse = findFirstSubmissionResponse(
                    preparation.prompt().id(), currentUserId, guestId, preparation.clientSubmissionId()
            );
            if (storedResponse != null) {
                return new PersistedReview(null, null, storedResponse);
            }
            session = answerSessionRepository.save(preparation.session());
        } else {
            // LLM을 기다리는 동안 같은 제출이 먼저 저장됐거나 세션이 완료됐을 수 있어 다시 확인한다.
            session = answerSessionRepository.findById(preparation.session().getId())
                    .orElseThrow(() -> new ApiException(
                            HttpStatus.NOT_FOUND,
                            "ANSWER_SESSION_NOT_FOUND",
                            "답변 세션을 찾을 수 없어요."
                    ));
            FeedbackResponseDto storedResponse = findIdempotentResponse(session.getId(), preparation.submissionId());
            if (storedResponse != null) {
                return new PersistedReview(session, null, storedResponse);
            }
            assertSubmissionAllowed(session);
        }

        AnswerAttemptEntity savedAttempt = saveAttempt(
                session,
                preparation.attemptType(),
                preparation.attemptNo(),
                preparation.answer(),
                feedback,
                preparation.submissionId()
        );
        if (preparation.attemptNo() == 1) {
            promptService.recordDailyPromptStart(
                    preparation.prompt().id(),
                    currentUserId,
                    guestId,
                    session.getId()
            );
        }
        session.setStatus(feedback.loopComplete()
                ? SessionStatus.READY_TO_FINISH
                : SessionStatus.IN_PROGRESS);
        answerSessionRepository.save(session);
        return new PersistedReview(session, savedAttempt, null);
    }

    // 준비 트랜잭션의 결과. storedResponse가 있으면 같은 제출이 이미 저장된 것이라 LLM을 부르지 않는다.
    private record ReviewPreparation(
            PromptDto prompt,
            String answer,
            AnswerSessionEntity session,
            boolean newSession,
            String submissionId,
            String clientSubmissionId,
            int attemptNo,
            String previousAnswer,
            AttemptType attemptType,
            List<PromptHintDto> hints,
            FeedbackResponseDto storedResponse
    ) {
        static ReviewPreparation stored(FeedbackResponseDto storedResponse) {
            return new ReviewPreparation(null, null, null, false, null, null, 0, null, null, List.of(), storedResponse);
        }
    }

    // 저장 트랜잭션의 결과. storedResponse가 있으면 LLM을 기다리는 동안 같은 제출이 먼저 저장된 것이다.
    private record PersistedReview(
            AnswerSessionEntity session,
            AnswerAttemptEntity attempt,
            FeedbackResponseDto storedResponse
    ) {
    }

    @Transactional
    public FeedbackSessionStatusDto finish(
            String sessionId,
            FeedbackFinishRequestDto request,
            Long currentUserId
    ) {
        String guestId = GuestIdentitySupport.normalizeGuestId(request == null ? null : request.guestId());
        AnswerSessionEntity session = findOwnedSession(sessionId, currentUserId, guestId);
        // 게스트로 시작하고 로그인한 뒤 완료하면, 완료 기록이 사용자에게 남도록 세션을 넘긴다(피드백 요청과 같다).
        if (currentUserId != null && session.getUserId() == null) {
            session.assignToUser(currentUserId);
        }
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
        FeedbackCoachMoveDto enrichment = feedback.completion() == null ? null : feedback.completion().enrichment();
        FeedbackCompletionDto completion = complete
                ? new FeedbackCompletionDto(
                firstNonBlank(feedback.completionMessage(), loop.headline()),
                firstNonBlank(feedback.summary(), "질문의 핵심을 충분히 담았어요."),
                "지금 답변으로 루프를 마쳐도 좋아요.",
                firstNonBlank(
                        enrichment == null ? null : enrichment.focus(),
                        "다음 질문에서도 구체적인 내용을 한 가지 넣어 보세요."
                ),
                enrichment
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
        // 새 세션은 아직 저장하지 않는다. LLM이 성공하면 persistReview가 저장한다.
        return new AnswerSessionEntity(
                UUID.randomUUID().toString(),
                promptId,
                currentUserId == null ? guestId : null,
                currentUserId,
                SessionStatus.IN_PROGRESS
        );
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

    private FeedbackResponseDto findFirstSubmissionResponse(
            String promptId,
            Long currentUserId,
            String guestId,
            String submissionId
    ) {
        if (submissionId == null) {
            return null;
        }
        String normalizedGuestId = GuestIdentitySupport.normalizeGuestId(guestId);
        List<AnswerAttemptEntity> attempts;
        if (currentUserId != null) {
            attempts = answerAttemptRepository.findUserSubmissions(currentUserId, promptId, submissionId);
        } else if (normalizedGuestId != null) {
            attempts = answerAttemptRepository.findGuestSubmissions(normalizedGuestId, promptId, submissionId);
        } else {
            return null;
        }
        return attempts.stream().findFirst().map(this::readStoredFeedback).orElse(null);
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
                    firstNonBlank(feedback.summary(), "피드백이 생성됐어요."),
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
            FeedbackTokenUsage tokenUsage = executionTrace.tokenUsage();
            FeedbackProviderRetryTrace providerRetry = executionTrace.providerRetry();
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
                    .providerRetryAttempted(providerRetry.attempted())
                    .providerRetrySucceeded(providerRetry.succeeded())
                    .providerInitialFailureStatusCode(providerRetry.initialFailureStatusCode())
                    .providerInitialFailureBodyJson(toJsonDocument(providerRetry.initialFailureBodyJson()))
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
                    .llmInputTokens(tokenUsage.inputTokens())
                    .llmCachedInputTokens(tokenUsage.cachedInputTokens())
                    .llmOutputTokens(tokenUsage.outputTokens())
                    .llmReasoningTokens(tokenUsage.reasoningTokens())
                    .llmTotalTokens(tokenUsage.totalTokens())
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

    private String toJsonDocument(String value) throws JsonProcessingException {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            objectMapper.readTree(value);
            return value.trim();
        } catch (JsonProcessingException ignored) {
            return objectMapper.writeValueAsString(value);
        }
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
