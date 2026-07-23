package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.exception.ApiException;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
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
        assertThat(logCaptor.getValue().getDiagnosisTopicRelevance()).isEqualTo("ON_TOPIC");
        assertThat(logCaptor.getValue().getDiagnosisUtteranceForm()).isEqualTo("COMPLETE");
        assertThat(logCaptor.getValue().getDiagnosisAnswerBand()).isNull();
        JsonNode diagnosisPayload = objectMapper.readTree(logCaptor.getValue().getDiagnosisPayloadJson());
        assertThat(diagnosisPayload.has("grammarImpact")).isFalse();
        assertThat(diagnosisPayload.has("utteranceForm")).isFalse();
        assertThat(diagnosisPayload.has("correctedAnswer")).isFalse();
        assertThat(diagnosisPayload.has("structureIssues")).isFalse();
        assertThat(diagnosisPayload.path("structureAssessment").path("status").asText())
                .isEqualTo("COMPLETE");
        assertThat(diagnosisPayload.path("structureAssessment").path("repair")).isEmpty();
        assertThat(diagnosisPayload.path("grammarIssues"))
                .isEmpty();

        assertThat(response.sessionId()).isEqualTo(session.getId());
        assertThat(response.attemptNo()).isEqualTo(1);
        assertThat(response.loop()).isNotNull();
        assertThat(response.loopComplete()).isFalse();
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
    void marksSessionCompleteOnlyFromBackendDerivedCompletion() {
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
                new StructureAssessment(StructureStatus.COMPLETE, List.of()),
                List.of()
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
                null,
                List.of()
        );
        return new FeedbackAnalysisSnapshot("openai", "test-model", 200, "{}", diagnosis, sections);
    }
}
