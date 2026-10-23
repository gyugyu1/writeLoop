package com.writeloop.service;

import com.writeloop.dto.AdminFeedbackMetricsDto;
import com.writeloop.dto.AdminFeedbackMetricsItemDto;
import com.writeloop.persistence.FeedbackDiagnosisLogRepository;
import com.writeloop.persistence.FeedbackTimingLlmCallView;
import com.writeloop.persistence.FeedbackTimingLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminFeedbackMetricsServiceTest {

    private final FeedbackTimingLogRepository timingRepository = mock(FeedbackTimingLogRepository.class);
    private final FeedbackDiagnosisLogRepository diagnosisRepository = mock(FeedbackDiagnosisLogRepository.class);
    private final AdminFeedbackMetricsService service = new AdminFeedbackMetricsService(timingRepository, diagnosisRepository);

    @Test
    void summarizesCallsFailuresLatencyAndTokensPerFeature() {
        when(timingRepository.findLlmCalls(any(), any())).thenReturn(List.of(
                call("ANSWER", true, 10_000L, 1_000L, 400L, 300L),
                call("ANSWER", true, 20_000L, 1_200L, 0L, 350L),
                call("ANSWER", false, 40_000L, null, null, null),
                call("ANSWER", true, 12_000L, null, null, null),
                call("COACH", true, 3_000L, 500L, 0L, 120L)
        ));
        when(diagnosisRepository.countByRetryAttemptedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any())).thenReturn(2L);
        when(diagnosisRepository.countByProviderRetryAttemptedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any())).thenReturn(1L);

        AdminFeedbackMetricsDto metrics = service.summarize(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 14));

        assertThat(metrics.totalCalls()).isEqualTo(5);
        assertThat(metrics.totalFailedCalls()).isEqualTo(1);
        assertThat(metrics.answerContractRetries()).isEqualTo(2);
        assertThat(metrics.answerProviderRetries()).isEqualTo(1);
        // 화면 순서는 문장 피드백, 영어일기, Now in English, 코치다. 호출이 없는 기능도 0으로 보인다.
        assertThat(metrics.items()).extracting(AdminFeedbackMetricsItemDto::feedbackType)
                .containsExactly("ANSWER", "DIARY", "NOW_IN_ENGLISH", "COACH");

        AdminFeedbackMetricsItemDto answer = metrics.items().get(0);
        assertThat(answer.calls()).isEqualTo(4);
        assertThat(answer.failedCalls()).isEqualTo(1);
        assertThat(answer.failureRate()).isEqualTo(0.25);
        assertThat(answer.p50ElapsedMs()).isEqualTo(12_000L);
        assertThat(answer.p95ElapsedMs()).isEqualTo(40_000L);
        assertThat(answer.callsWithTokens()).isEqualTo(2);
        assertThat(answer.inputTokens()).isEqualTo(2_200L);
        assertThat(answer.cachedInputTokens()).isEqualTo(400L);
        assertThat(answer.outputTokens()).isEqualTo(650L);

        AdminFeedbackMetricsItemDto diary = metrics.items().get(1);
        assertThat(diary.calls()).isZero();
        assertThat(diary.p50ElapsedMs()).isNull();
    }

    @Test
    void rejectsReversedOrTooLongPeriods() {
        assertThatThrownBy(() -> service.summarize(LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 1)))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.summarize(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 10, 1)))
                .isInstanceOf(ResponseStatusException.class);
    }

    private static FeedbackTimingLlmCallView call(
            String feature, boolean success, Long elapsedMs, Long input, Long cached, Long output
    ) {
        return new FeedbackTimingLlmCallView() {
            public String getFeedbackType() { return feature; }
            public Boolean getSuccess() { return success; }
            public Long getElapsedMs() { return elapsedMs; }
            public Long getLlmInputTokens() { return input; }
            public Long getLlmCachedInputTokens() { return cached; }
            public Long getLlmOutputTokens() { return output; }
        };
    }
}
