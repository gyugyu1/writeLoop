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
}
