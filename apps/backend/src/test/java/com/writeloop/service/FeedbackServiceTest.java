package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackCoachMoveDto;
import com.writeloop.dto.FeedbackFinishRequestDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.FeedbackDiagnosisExecutionStatus;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

    @Mock
    private PromptService promptService;

    @Mock
    private LlmFeedbackClient llmFeedbackClient;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private FeedbackDiagnosisLogRepository diagnosisLogRepository;

    @Mock
    private FeedbackDiagnosisLogRecorder diagnosisLogRecorder;

    private FeedbackService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new FeedbackService(
                promptService,
                llmFeedbackClient,
                answerSessionRepository,
                answerAttemptRepository,
                objectMapper
        );
        ReflectionTestUtils.setField(service, "feedbackDiagnosisLogRepository", diagnosisLogRepository);
        ReflectionTestUtils.setField(service, "feedbackDiagnosisLogRecorder", diagnosisLogRecorder);

        lenient().when(answerAttemptRepository.countBySessionId(anyString())).thenReturn(0);
        lenient().when(answerAttemptRepository.findBySessionIdAndAttemptNo(anyString(), anyInt()))
                .thenReturn(Optional.empty());
        lenient().when(answerAttemptRepository.findBySessionIdOrderByAttemptNoAsc(anyString()))
                .thenReturn(List.of());
        lenient().when(answerAttemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(answerSessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(diagnosisLogRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(promptService.findHintsByPromptId(anyString())).thenReturn(List.of());
        lenient().when(llmFeedbackClient.clearInternalMetadata(any()))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void rejectsOverlongAnswerBeforeCallingLlm() {
        PromptDto prompt = prompt();
        when(promptService.findById(prompt.id())).thenReturn(prompt);

        assertThatThrownBy(() -> service.review(
                new FeedbackRequestDto(prompt.id(), "a".repeat(4_001), null, null, null),
                7L
        )).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getCode()).isEqualTo("ANSWER_TOO_LONG"));

        verifyNoInteractions(llmFeedbackClient);
    }

    @Test
    void rejectsRequestWhenConfiguredProviderIsUnavailable() {
        PromptDto prompt = prompt();
        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(llmFeedbackClient.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.review(
                new FeedbackRequestDto(prompt.id(), "I take a walk.", null, null, null),
                7L
        )).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getCode()).isEqualTo("FEEDBACK_GENERATION_UNAVAILABLE"));

        verifyNoInteractions(answerAttemptRepository);
    }

    @Test
    void storesCanonicalDiagnosisAndPersistsNoFeedbackScore() throws Exception {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = session(prompt, "session-1");
        FeedbackResponseDto internal = feedback(prompt, false);
        FeedbackAnalysisSnapshot snapshot = snapshot(false);
        stubSuccessfulReview(prompt, session, internal, snapshot);

        FeedbackResponseDto response = service.review(
                new FeedbackRequestDto(prompt.id(), "I take a walk.", session.getId(), "INITIAL", null),
                7L
        );

        ArgumentCaptor<AnswerAttemptEntity> attemptCaptor = ArgumentCaptor.forClass(AnswerAttemptEntity.class);
        verify(answerAttemptRepository).save(attemptCaptor.capture());
        AnswerAttemptEntity savedAttempt = attemptCaptor.getValue();
        assertThat(savedAttempt.getScore()).isNull();
        assertThat(objectMapper.readTree(savedAttempt.getFeedbackPayloadJson()).has("score")).isFalse();

        ArgumentCaptor<FeedbackDiagnosisLogEntity> logCaptor = ArgumentCaptor.forClass(FeedbackDiagnosisLogEntity.class);
        verify(diagnosisLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getExecutionStatus())
                .isEqualTo(FeedbackDiagnosisExecutionStatus.SUCCESS);
        assertThat(logCaptor.getValue().getInputFingerprint()).hasSize(64);
        assertThat(logCaptor.getValue().getDiagnosisTopicRelevance()).isEqualTo("ON_TOPIC");
        assertThat(logCaptor.getValue().getDiagnosisUtteranceForm()).isEqualTo("COMPLETE");
        assertThat(logCaptor.getValue().isRetryAttempted()).isFalse();
        assertThat(logCaptor.getValue().getContractRetrySucceeded()).isNull();
        assertThat(logCaptor.getValue().getContractFinalErrorReason()).isNull();
        JsonNode diagnosisPayload = objectMapper.readTree(logCaptor.getValue().getDiagnosisPayloadJson());
        assertThat(diagnosisPayload.has("grammarImpact")).isFalse();
        assertThat(diagnosisPayload.has("utteranceForm")).isFalse();
        assertThat(diagnosisPayload.has("correctedAnswer")).isFalse();
        assertThat(diagnosisPayload.has("structureIssues")).isFalse();
        assertThat(diagnosisPayload.path("structureAssessment").path("status").asText())
                .isEqualTo("COMPLETE");
        assertThat(diagnosisPayload.path("structureAssessment").has("repair")).isFalse();
        assertThat(diagnosisPayload.has("grammarIssues")).isFalse();
        assertThat(diagnosisPayload.path("languageAssessment").path("revisionSteps")).isEmpty();
        assertThat(diagnosisPayload.path("languageAssessment").has("revisedAnswer")).isFalse();
        assertThat(diagnosisPayload.path("languageAssessment").has("issues")).isFalse();

        assertThat(response.sessionId()).isEqualTo(session.getId());
        assertThat(response.attemptNo()).isEqualTo(1);
        assertThat(response.loop()).isNotNull();
        assertThat(response.loopComplete()).isFalse();
    }

    @Test
    void storesOnlyUserVisibleCoachFieldsInTheVisibleSnapshot() throws Exception {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = session(prompt, "session-visible-snapshot");
        FeedbackCoachMoveDto coachMove = new FeedbackCoachMoveDto(
                "Add a concrete method.",
                "DETAIL",
                "The current answer does not explain how.",
                "study English",
                "review words with flashcards",
                "Name one method you actually use.",
                "I review words with flashcards.",
                "I use [a study method] to remember words.",
                "나는 단어를 기억하기 위해 [학습 방법]을 사용해요.",
                List.of(new FeedbackSuggestedPhraseDto("use flashcards", "플래시카드를 사용하다")),
                "The answer includes one concrete study method.",
                "DETAIL"
        );
        FeedbackResponseDto internal = feedback(prompt, false)
                .withLoopExperience(null, coachMove, null, null, null);
        stubSuccessfulReview(prompt, session, internal, snapshot(false));

        FeedbackResponseDto response = service.review(
                new FeedbackRequestDto(prompt.id(), "I study English.", session.getId(), "INITIAL", null),
                7L
        );

        FeedbackCoachMoveDto visibleCoachMove = response.visibleFeedback().coachMove();
        assertThat(visibleCoachMove.skeletonEn()).isEqualTo(
                "I use [a study method] to remember words."
        );
        assertThat(visibleCoachMove.suggestedPhrases()).hasSize(1);
        assertThat(visibleCoachMove.exampleEn()).isNull();
        assertThat(visibleCoachMove.successCheck()).isNull();

        ArgumentCaptor<AnswerAttemptEntity> attemptCaptor = ArgumentCaptor.forClass(AnswerAttemptEntity.class);
        verify(answerAttemptRepository).save(attemptCaptor.capture());
        JsonNode visibleSnapshot = objectMapper.readTree(
                attemptCaptor.getValue().getVisibleFeedbackSnapshotJson()
        );
        assertThat(visibleSnapshot.path("coachMove").has("exampleEn")).isFalse();
        assertThat(visibleSnapshot.path("coachMove").has("successCheck")).isFalse();

        JsonNode internalPayload = objectMapper.readTree(
                attemptCaptor.getValue().getFeedbackPayloadJson()
        );
        assertThat(internalPayload.path("coachMove").path("exampleEn").asText())
                .isEqualTo("I review words with flashcards.");
        assertThat(internalPayload.path("coachMove").path("successCheck").asText())
                .isEqualTo("The answer includes one concrete study method.");
    }

    @Test
    void storesTheRejectedResponseAndRecoveredContractRetrySeparately() {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = session(prompt, "session-contract-retry");
        FeedbackResponseDto internal = feedback(prompt, false);
        FeedbackAnalysisSnapshot baseSnapshot = snapshot(false);
        FeedbackAnalysisSnapshot retriedSnapshot = new FeedbackAnalysisSnapshot(
                baseSnapshot.provider(),
                baseSnapshot.model(),
                200,
                "{\"result\":\"accepted\"}",
                baseSnapshot.diagnosis(),
                baseSnapshot.finalSections(),
                FeedbackContractRetryTrace.recovered(
                        "Every grammar issue must quote an exact learner-answer span",
                        200,
                        "{\"result\":\"rejected\"}",
                        200,
                        "{\"result\":\"accepted\"}"
                )
        );
        stubSuccessfulReview(prompt, session, internal, retriedSnapshot);

        service.review(
                new FeedbackRequestDto(prompt.id(), "I take a walk.", session.getId(), "INITIAL", null),
                7L
        );

        ArgumentCaptor<FeedbackDiagnosisLogEntity> logCaptor =
                ArgumentCaptor.forClass(FeedbackDiagnosisLogEntity.class);
        verify(diagnosisLogRepository).save(logCaptor.capture());
        FeedbackDiagnosisLogEntity saved = logCaptor.getValue();
        assertThat(saved.isRetryAttempted()).isTrue();
        assertThat(saved.getContractRetrySucceeded()).isTrue();
        assertThat(saved.getContractOriginalErrorReason())
                .isEqualTo("Every grammar issue must quote an exact learner-answer span");
        assertThat(saved.getDiagnosisResponseBodyJson()).isEqualTo("{\"result\":\"rejected\"}");
        assertThat(saved.getRegenerationResponseBodyJson()).isEqualTo("{\"result\":\"accepted\"}");
        assertThat(saved.getDiagnosisResponseStatusCode()).isEqualTo(200);
        assertThat(saved.getRegenerationResponseStatusCode()).isEqualTo(200);
    }

    @Test
    void rejectsResponseWithoutCanonicalSnapshot() {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = session(prompt, "session-2");
        FeedbackResponseDto internal = feedback(prompt, false);
        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(llmFeedbackClient.isConfigured()).thenReturn(true);
        when(answerSessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
        when(llmFeedbackClient.review(
                any(PromptDto.class), anyString(), anyList(), anyInt(), nullable(String.class), nullable(String.class)
        )).thenReturn(internal);
        when(llmFeedbackClient.isAuthoritativeFeedback(internal)).thenReturn(true);
        when(llmFeedbackClient.takeLastAnalysisSnapshot()).thenReturn(null);

        assertThatThrownBy(() -> service.review(
                new FeedbackRequestDto(prompt.id(), "I take a walk.", session.getId(), null, null),
                7L
        )).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getCode()).isEqualTo("FEEDBACK_GENERATION_UNAVAILABLE"));

        verify(answerAttemptRepository, never()).save(any());
    }

    @Test
    void storesFailedLlmExecutionIndependentlyWithoutSavingAnAnswerAttempt() {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = session(prompt, "session-failed-diagnosis");
        FeedbackExecutionTrace trace = new FeedbackExecutionTrace(
                "openai",
                "test-model",
                "medium",
                null,
                200,
                "{\"result\":\"rejected\"}",
                200,
                "{\"result\":\"still-rejected\"}",
                true,
                true,
                false,
                false,
                "Initial contract failure",
                "Final contract failure",
                321L
        );
        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(llmFeedbackClient.isConfigured()).thenReturn(true);
        when(answerSessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
        when(llmFeedbackClient.review(
                any(PromptDto.class), anyString(), anyList(), anyInt(), nullable(String.class), nullable(String.class)
        )).thenThrow(new IllegalStateException("feedback failed"));
        when(llmFeedbackClient.takeLastExecutionTrace()).thenReturn(trace);

        assertThatThrownBy(() -> service.review(
                new FeedbackRequestDto(prompt.id(), "I goes home.", session.getId(), "INITIAL", null),
                7L
        )).isInstanceOf(IllegalStateException.class);

        ArgumentCaptor<FeedbackDiagnosisFailureEvent> eventCaptor =
                ArgumentCaptor.forClass(FeedbackDiagnosisFailureEvent.class);
        verify(diagnosisLogRecorder).recordFailure(eventCaptor.capture());
        assertThat(eventCaptor.getValue().executionTrace()).isEqualTo(trace);
        assertThat(eventCaptor.getValue().learnerAnswer()).isEqualTo("I goes home.");
        verify(answerAttemptRepository, never()).save(any());
        verify(diagnosisLogRepository, never()).save(any());
    }

    @Test
    void returnsStoredResponseForRepeatedSubmissionWithoutCallingLlm() throws Exception {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = session(prompt, "session-idempotent");
        FeedbackResponseDto storedFeedback = feedback(prompt, false)
                .withVisibleFeedback(new com.writeloop.dto.VisibleFeedbackSnapshotDto(
                        1,
                        com.writeloop.dto.VisibleFeedbackState.NEEDS_REWRITE,
                        "The main action is clear.",
                        null,
                        null,
                        List.of(),
                        null,
                        null,
                        false
                ));
        AnswerAttemptEntity storedAttempt = new AnswerAttemptEntity(
                session.getId(),
                1,
                com.writeloop.persistence.AttemptType.INITIAL,
                "I take a walk.",
                null,
                "Add one relevant detail.",
                "[]",
                "[]",
                "",
                "Add one detail.",
                objectMapper.writeValueAsString(storedFeedback),
                "submission-idempotent",
                objectMapper.writeValueAsString(storedFeedback.visibleFeedback())
        );
        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(answerSessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
        when(answerAttemptRepository.findBySessionIdAndSubmissionId(
                session.getId(),
                "submission-idempotent"
        )).thenReturn(Optional.of(storedAttempt));

        FeedbackResponseDto response = service.review(
                new FeedbackRequestDto(
                        prompt.id(),
                        "I take a walk.",
                        session.getId(),
                        "INITIAL",
                        null,
                        "submission-idempotent"
                ),
                7L
        );

        assertThat(response.visibleFeedback().state())
                .isEqualTo(com.writeloop.dto.VisibleFeedbackState.NEEDS_REWRITE);
        verifyNoInteractions(llmFeedbackClient);
        verify(answerAttemptRepository, never()).save(any());
    }

    @Test
    void keepsBackendDerivedCompletionReadyUntilUserFinishes() {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = session(prompt, "session-3");
        FeedbackResponseDto internal = feedback(prompt, true);
        stubSuccessfulReview(prompt, session, internal, snapshot(true));

        FeedbackResponseDto response = service.review(
                new FeedbackRequestDto(prompt.id(), "I take a walk after dinner.", session.getId(), null, null),
                7L
        );

        assertThat(response.loopComplete()).isTrue();
        assertThat(response.completion()).isNotNull();
        assertThat(response.visibleFeedback().state().name()).isEqualTo("READY_TO_FINISH");
        assertThat(session.getStatus()).isEqualTo(SessionStatus.READY_TO_FINISH);
        verify(promptService, never()).recordDailyPromptComplete(anyString(), any(), any(), anyString());
    }

    @Test
    void completesReadySessionOnlyAfterExplicitFinish() throws Exception {
        PromptDto prompt = prompt();
        AnswerSessionEntity session = new AnswerSessionEntity(
                "session-ready",
                prompt.id(),
                null,
                7L,
                SessionStatus.READY_TO_FINISH
        );
        FeedbackResponseDto readyFeedback = feedback(prompt, true)
                .withVisibleFeedback(new com.writeloop.dto.VisibleFeedbackSnapshotDto(
                        1,
                        com.writeloop.dto.VisibleFeedbackState.READY_TO_FINISH,
                        "The main action is clear.",
                        null,
                        null,
                        List.of(),
                        "I usually take a walk after work.",
                        "퇴근 후에는 보통 산책해요.",
                        false
                ));
        AnswerAttemptEntity latestAttempt = new AnswerAttemptEntity(
                session.getId(),
                1,
                com.writeloop.persistence.AttemptType.INITIAL,
                "I usually take a walk after work.",
                null,
                "Ready",
                "[]",
                "[]",
                readyFeedback.modelAnswer(),
                "",
                objectMapper.writeValueAsString(readyFeedback),
                "submission-ready",
                objectMapper.writeValueAsString(readyFeedback.visibleFeedback())
        );
        when(answerSessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
        when(answerAttemptRepository.findFirstBySessionIdOrderByAttemptNoDesc(session.getId()))
                .thenReturn(Optional.of(latestAttempt));

        var result = service.finish(session.getId(), new FeedbackFinishRequestDto(null), 7L);

        assertThat(result.status()).isEqualTo("COMPLETED");
        assertThat(session.getStatus()).isEqualTo(SessionStatus.COMPLETED);
        verify(promptService).recordDailyPromptComplete(prompt.id(), 7L, null, session.getId());
    }

    private void stubSuccessfulReview(
            PromptDto prompt,
            AnswerSessionEntity session,
            FeedbackResponseDto feedback,
            FeedbackAnalysisSnapshot snapshot
    ) {
        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(llmFeedbackClient.isConfigured()).thenReturn(true);
        when(answerSessionRepository.findById(session.getId())).thenReturn(Optional.of(session));
        when(llmFeedbackClient.review(
                any(PromptDto.class), anyString(), anyList(), anyInt(), nullable(String.class), nullable(String.class)
        )).thenReturn(feedback);
        when(llmFeedbackClient.isAuthoritativeFeedback(feedback)).thenReturn(true);
        when(llmFeedbackClient.takeLastAnalysisSnapshot()).thenReturn(snapshot);
        when(llmFeedbackClient.takeLastExecutionTrace())
                .thenReturn(FeedbackExecutionTrace.successful(snapshot));
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work?",
                "What do you usually do after work?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of("REASON"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        0
                )
        );
    }

    private AnswerSessionEntity session(PromptDto prompt, String id) {
        return new AnswerSessionEntity(id, prompt.id(), null, 7L, SessionStatus.IN_PROGRESS);
    }

    private FeedbackResponseDto feedback(PromptDto prompt, boolean complete) {
        return new FeedbackResponseDto(
                prompt.id(),
                "__CANONICAL_INTERNAL__",
                1,
                complete,
                complete ? "Complete" : null,
                complete ? "The answer meets the contract." : "Add one relevant detail.",
                List.of("The main action is clear."),
                List.of(),
                List.of(),
                List.of(),
                "I take a walk.",
                List.of(),
                "I usually take a walk after work.",
                "I usually take a walk after work.",
                complete ? null : "Add one detail.",
                List.of(),
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private FeedbackAnalysisSnapshot snapshot(boolean complete) {
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "The answer addresses the question."),
                new StructureAssessment(StructureStatus.COMPLETE),
                new LanguageAssessment(List.of())
        );
        MissionDecision decision = new MissionDecision(
                complete ? MissionKind.COMPLETE : MissionKind.SLOT,
                List.of(),
                complete ? List.of() : List.of("REASON"),
                complete ? null : "REASON",
                Map.of()
        );
        GeneratedSections sections = new GeneratedSections(
                List.of("The main action is clear."),
                List.of(),
                List.of(),
                "I usually take a walk after work.",
                "I usually take a walk after work.",
                decision,
                null
        );
        return new FeedbackAnalysisSnapshot("openai", "test-model", 200, "{}", diagnosis, sections);
    }
}
