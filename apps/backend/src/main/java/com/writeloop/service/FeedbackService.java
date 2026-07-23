package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackCompletionDto;
import com.writeloop.dto.FeedbackLoopDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackRevealLaterDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.exception.ApiException;
import com.writeloop.exception.GuestLimitExceededException;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.SessionStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

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
        if (!llmFeedbackClient.isConfigured()) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "FEEDBACK_GENERATION_UNAVAILABLE",
                    "지금은 피드백을 생성할 수 없어요. 잠시 후 다시 시도해 주세요."
            );
        }

        AnswerSessionEntity session = resolveSession(request, prompt.id(), currentUserId);
        int attemptNo = answerAttemptRepository.countBySessionId(session.getId()) + 1;
        String previousAnswer = findPreviousAnswer(session.getId(), attemptNo);
        String previousCoachingSummary = buildPreviousCoachingSummary(session.getId());
        AttemptType attemptType = resolveAttemptType(request);
        List<PromptHintDto> hints = promptService.findHintsByPromptId(prompt.id());

        beginTiming(currentUserId, request.guestId(), prompt.id(), session.getId(), attemptNo);
        try {
            FeedbackResponseDto internalFeedback = llmFeedbackClient.review(
                    prompt,
                    answer,
                    hints,
                    attemptNo,
                    previousAnswer,
                    previousCoachingSummary
            );
            FeedbackAnalysisSnapshot snapshot = llmFeedbackClient.takeLastAnalysisSnapshot();
            if (!llmFeedbackClient.isAuthoritativeFeedback(internalFeedback) || snapshot == null) {
                throw new ApiException(
                        HttpStatus.BAD_GATEWAY,
                        "FEEDBACK_GENERATION_UNAVAILABLE",
                        "피드백 결과를 확인할 수 없어요. 잠시 후 다시 시도해 주세요."
                );
            }

            FeedbackResponseDto feedback = attachLoopExperience(
                    llmFeedbackClient.clearInternalMetadata(internalFeedback)
            );
            AnswerAttemptEntity savedAttempt = saveAttempt(session, attemptType, attemptNo, answer, feedback);
            if (attemptNo == 1) {
                promptService.recordDailyPromptStart(
                        prompt.id(),
                        currentUserId,
                        request.guestId(),
                        session.getId()
                );
            }
            if (feedback.loopComplete()) {
                session.setStatus(SessionStatus.COMPLETED);
                answerSessionRepository.save(session);
                promptService.recordDailyPromptComplete(
                        prompt.id(),
                        currentUserId,
                        request.guestId(),
                        session.getId()
                );
            }
            saveDiagnosisLog(
                    session,
                    savedAttempt,
                    attemptType,
                    attemptNo,
                    prompt,
                    hints,
                    answer,
                    previousAnswer,
                    snapshot
            );
            recordServiceTiming("total", startedAt);
            return withSession(feedback, session.getId(), attemptNo);
        } finally {
            clearTiming();
        }
    }

    private FeedbackResponseDto attachLoopExperience(FeedbackResponseDto feedback) {
        boolean complete = feedback.loopComplete();
        FeedbackLoopDto loop = new FeedbackLoopDto(
                complete ? "COMPLETE" : "NEEDS_REWRITE",
                complete
                        ? firstNonBlank(feedback.completionMessage(), "좋아요. 이 답변은 완성됐어요.")
                        : firstNonBlank(feedback.summary(), "한 가지만 반영해서 다시 써 볼까요?"),
                complete ? "finish" : "rewrite",
                complete ? "루프 완료하기" : "다시 써보기",
                "자세한 피드백 보기"
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
                "자세한 피드백 보기",
                "예시 답변"
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

    private AnswerSessionEntity resolveSession(FeedbackRequestDto request, String promptId, Long currentUserId) {
        String guestId = GuestIdentitySupport.normalizeGuestId(request.guestId());
        if (request.sessionId() != null && !request.sessionId().isBlank()) {
            AnswerSessionEntity session = answerSessionRepository.findById(request.sessionId())
                    .orElseThrow(() -> new ApiException(
                            HttpStatus.NOT_FOUND,
                            "ANSWER_SESSION_NOT_FOUND",
                            "답변 세션을 찾을 수 없어요."
                    ));
            if (!promptId.equals(session.getPromptId())) {
                throw ownershipMismatch();
            }
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
            if (currentUserId != null) {
                session.assignToUser(currentUserId);
                return answerSessionRepository.save(session);
            }
            if (session.getGuestId() != null && answerAttemptRepository.countBySessionId(session.getId()) >= 2) {
                throw new GuestLimitExceededException();
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
            FeedbackResponseDto feedback
    ) {
        try {
            AnswerAttemptEntity attempt = new AnswerAttemptEntity(
                    session.getId(),
                    attemptNo,
                    attemptType,
                    answer,
                    null,
                    firstNonBlank(feedback.summary(), "피드백이 생성됐어요."),
                    objectMapper.writeValueAsString(feedback.strengths()),
                    objectMapper.writeValueAsString(feedback.corrections()),
                    firstNonBlank(feedback.modelAnswer(), feedback.correctedAnswer(), ""),
                    firstNonBlank(feedback.rewriteChallenge(), feedback.summary(), ""),
                    objectMapper.writeValueAsString(feedback)
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
            FeedbackAnalysisSnapshot snapshot
    ) {
        if (feedbackDiagnosisLogRepository == null) {
            return;
        }
        try {
            FeedbackDiagnosisResult diagnosis = snapshot.diagnosis();
            FeedbackDiagnosisLogEntity entity = FeedbackDiagnosisLogEntity.builder()
                    .answerAttemptId(attempt == null ? null : attempt.getId())
                    .sessionId(session.getId())
                    .attemptNo(attemptNo)
                    .attemptType(attemptType.name())
                    .userId(session.getUserId())
                    .guestId(session.getGuestId())
                    .promptId(prompt.id())
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
                    .diagnosisResponseStatusCode(snapshot.responseStatusCode())
                    .diagnosisResponseBodyJson(snapshot.responseBodyJson())
                    .authoritativeFeedback(true)
                    .diagnosisFallbackUsed(false)
                    .deterministicResponseFallbackUsed(false)
                    .retryAttempted(false)
                    .diagnosisTopicRelevance(diagnosis.topicRelevance().name())
                    .diagnosisUtteranceForm(diagnosis.structureAssessment().status().name())
                    .diagnosisGrammarIssueCount(diagnosis.grammarIssues().size())
                    .diagnosisPayloadJson(objectMapper.writeValueAsString(diagnosis))
                    .finalSectionsJson(objectMapper.writeValueAsString(snapshot.finalSections()))
                    .build();
            feedbackDiagnosisLogRepository.save(entity);
        } catch (Exception exception) {
            LOGGER.warn("Failed to save canonical feedback diagnosis for session {}", session.getId(), exception);
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
