package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.persistence.FeedbackTimingLogEntity;
import com.writeloop.persistence.FeedbackTimingLogRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class FeedbackTimingRecorderTest {

    @Test
    void recordsNowInEnglishPhasesUnderOneTraceWithOperationMetadata() throws Exception {
        FeedbackTimingLogRepository repository = mock(FeedbackTimingLogRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        FeedbackTimingRecorder recorder = new FeedbackTimingRecorder(repository, objectMapper);

        recorder.beginNowInEnglishTrace(42L, "COACH_FEEDBACK");
        try {
            recorder.recordNowInEnglishLlmPhase(
                    "coach_feedback",
                    "openai",
                    "gpt-5.6-luna",
                    "low",
                    new FeedbackTokenUsage(1_200L, 400L, 300L, 120L, 1_500L),
                    false,
                    503,
                    "java.io.IOException",
                    1_234L,
                    Map.of("inputChars", 18)
            );
            recorder.recordServicePhase("total", 1_250L);
        } finally {
            recorder.clearTrace();
        }

        ArgumentCaptor<FeedbackTimingLogEntity> captor =
                ArgumentCaptor.forClass(FeedbackTimingLogEntity.class);
        verify(repository, times(2)).save(captor.capture());
        FeedbackTimingLogEntity llmLog = captor.getAllValues().get(0);
        FeedbackTimingLogEntity totalLog = captor.getAllValues().get(1);

        assertThat(llmLog.getFeedbackType()).isEqualTo("NOW_IN_ENGLISH");
        assertThat(llmLog.getPhaseScope()).isEqualTo("LLM");
        assertThat(llmLog.getPhase()).isEqualTo("coach_feedback");
        assertThat(llmLog.getUserId()).isEqualTo(42L);
        assertThat(llmLog.getProvider()).isEqualTo("openai");
        assertThat(llmLog.getModel()).isEqualTo("gpt-5.6-luna");
        assertThat(llmLog.getReasoningEffort()).isEqualTo("low");
        assertThat(llmLog.getSuccess()).isFalse();
        assertThat(llmLog.getStatusCode()).isEqualTo(503);
        assertThat(llmLog.getExceptionClass()).isEqualTo("java.io.IOException");
        assertThat(llmLog.getElapsedMs()).isEqualTo(1_234L);
        assertThat(llmLog.getLlmInputTokens()).isEqualTo(1_200L);
        assertThat(llmLog.getLlmCachedInputTokens()).isEqualTo(400L);
        assertThat(llmLog.getLlmOutputTokens()).isEqualTo(300L);
        assertThat(llmLog.getLlmReasoningTokens()).isEqualTo(120L);
        assertThat(llmLog.getLlmTotalTokens()).isEqualTo(1_500L);
        assertThat(totalLog.getLlmTotalTokens()).isNull();

        JsonNode llmMetadata = objectMapper.readTree(llmLog.getMetadataJson());
        assertThat(llmMetadata.path("operation").asText()).isEqualTo("COACH_FEEDBACK");
        assertThat(llmMetadata.path("inputChars").asInt()).isEqualTo(18);

        assertThat(totalLog.getTraceId()).isEqualTo(llmLog.getTraceId());
        assertThat(totalLog.getFeedbackType()).isEqualTo("NOW_IN_ENGLISH");
        assertThat(totalLog.getPhaseScope()).isEqualTo("SERVICE");
        assertThat(totalLog.getPhase()).isEqualTo("total");
        JsonNode totalMetadata = objectMapper.readTree(totalLog.getMetadataJson());
        assertThat(totalMetadata.path("operation").asText()).isEqualTo("COACH_FEEDBACK");
    }
    @Test
    void recordsEachCoachLlmCallWithTokensAsAStandaloneTrace() {
        FeedbackTimingLogRepository repository = mock(FeedbackTimingLogRepository.class);
        FeedbackTimingRecorder recorder = new FeedbackTimingRecorder(repository, new ObjectMapper());

        recorder.recordCoachLlmPhase("coach_help", "prompt-a-1", "gpt-6-luna", "medium",
                new FeedbackTokenUsage(900L, 0L, 250L, 80L, 1_150L), true, 200, null, 4_321L);

        ArgumentCaptor<FeedbackTimingLogEntity> captor = ArgumentCaptor.forClass(FeedbackTimingLogEntity.class);
        verify(repository).save(captor.capture());
        FeedbackTimingLogEntity log = captor.getValue();
        assertThat(log.getFeedbackType()).isEqualTo("COACH");
        assertThat(log.getPhaseScope()).isEqualTo("LLM");
        assertThat(log.getPhase()).isEqualTo("coach_help");
        assertThat(log.getPromptId()).isEqualTo("prompt-a-1");
        assertThat(log.getProvider()).isEqualTo("openai");
        assertThat(log.getLlmTotalTokens()).isEqualTo(1_150L);
        assertThat(log.getSuccess()).isTrue();
    }
}
