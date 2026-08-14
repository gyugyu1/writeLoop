package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.PromptDto;
import com.writeloop.persistence.FeedbackDiagnosisExecutionStatus;
import com.writeloop.persistence.FeedbackDiagnosisLogEntity;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class FeedbackDiagnosisLogRecorderTest {

    @Test
    void recordsFailedExecutionWithBothRawOutputsAndErrorReasons() {
        FeedbackDiagnosisLogRepository repository = mock(FeedbackDiagnosisLogRepository.class);
        FeedbackDiagnosisLogRecorder recorder = new FeedbackDiagnosisLogRecorder(
                repository,
                new ObjectMapper()
        );
        FeedbackExecutionTrace trace = new FeedbackExecutionTrace(
                "openai",
                "gpt-test",
                "medium",
                null,
                200,
                "{\"original\":\"invalid\"}",
                200,
                "not-json retry output",
                true,
                true,
                false,
                false,
                "Initial contract failure",
                "Final contract failure",
                FeedbackProviderRetryTrace.attempted(
                        503,
                        "{\"error\":{\"code\":\"server_is_overloaded\"}}",
                        false
                ),
                new FeedbackTokenUsage(210L, 45L, 70L, 25L, 280L),
                812L
        );

        recorder.recordFailure(new FeedbackDiagnosisFailureEvent(
                "session-1",
                2,
                "REWRITE",
                7L,
                null,
                prompt(),
                List.of(),
                "I goes home.",
                "I go.",
                trace
        ));

        ArgumentCaptor<FeedbackDiagnosisLogEntity> captor =
                ArgumentCaptor.forClass(FeedbackDiagnosisLogEntity.class);
        verify(repository).saveAndFlush(captor.capture());
        FeedbackDiagnosisLogEntity saved = captor.getValue();
        assertThat(saved.getExecutionStatus()).isEqualTo(FeedbackDiagnosisExecutionStatus.FAILED);
        assertThat(saved.getAnswerAttemptId()).isNull();
        assertThat(saved.getLearnerAnswer()).isEqualTo("I goes home.");
        assertThat(saved.getInputFingerprint()).hasSize(64);
        assertThat(saved.getDiagnosisResponseBodyJson()).isEqualTo("{\"original\":\"invalid\"}");
        assertThat(saved.getRegenerationResponseBodyJson())
                .isEqualTo("\"not-json retry output\"");
        assertThat(saved.getContractOriginalErrorReason()).isEqualTo("Initial contract failure");
        assertThat(saved.getContractFinalErrorReason()).isEqualTo("Final contract failure");
        assertThat(saved.isProviderRetryAttempted()).isTrue();
        assertThat(saved.getProviderRetrySucceeded()).isFalse();
        assertThat(saved.getProviderInitialFailureStatusCode()).isEqualTo(503);
        assertThat(saved.getProviderInitialFailureBodyJson())
                .isEqualTo("{\"error\":{\"code\":\"server_is_overloaded\"}}");
        assertThat(saved.getElapsedMs()).isEqualTo(812L);
        assertThat(saved.getLlmInputTokens()).isEqualTo(210L);
        assertThat(saved.getLlmCachedInputTokens()).isEqualTo(45L);
        assertThat(saved.getLlmOutputTokens()).isEqualTo(70L);
        assertThat(saved.getLlmReasoningTokens()).isEqualTo(25L);
        assertThat(saved.getLlmTotalTokens()).isEqualTo(280L);
    }

    @Test
    void failureWriteUsesAnIndependentTransaction() throws Exception {
        Transactional annotation = FeedbackDiagnosisLogRecorder.class
                .getMethod("recordFailure", FeedbackDiagnosisFailureEvent.class)
                .getAnnotation(Transactional.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work?",
                "퇴근 후 보통 무엇을 하나요?",
                "",
                null,
                null
        );
    }
}
