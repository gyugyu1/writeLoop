package com.writeloop.service;

import com.writeloop.dto.NowInEnglishCoachFeedbackRequestDto;
import com.writeloop.dto.NowInEnglishCoachFeedbackResponseDto;
import com.writeloop.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NowInEnglishCoachFeedbackServiceTest {

    @Mock
    private OpenAiNowInEnglishCoachFeedbackClient openAiClient;

    @Mock
    private FeedbackTimingRecorder feedbackTimingRecorder;

    private NowInEnglishCoachFeedbackService service;

    @BeforeEach
    void setUp() {
        service = new NowInEnglishCoachFeedbackService(openAiClient, feedbackTimingRecorder);
    }

    @Test
    void returnsUnavailableInsteadOfFixedPraiseWhenLlmFails() {
        when(openAiClient.isConfigured()).thenReturn(true);
        when(openAiClient.review(anyString(), anyString())).thenThrow(new IllegalStateException("timeout"));

        // 누구에게나 같은 칭찬 문구를 AI 피드백처럼 보여 주지 않는다. 문장은 /entries로 이미 저장됐다.
        assertThatThrownBy(() -> service.review(7L, request()))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(exception.getCode()).isEqualTo("NOW_COACH_FEEDBACK_UNAVAILABLE");
                    assertThat(exception.getMessage()).contains("문장은 저장됐어요");
                });
    }

    @Test
    void returnsUnavailableWhenProviderIsNotConfigured() {
        when(openAiClient.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.review(7L, request()))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getCode()).isEqualTo("NOW_COACH_FEEDBACK_UNAVAILABLE"));
    }

    @Test
    void returnsLlmFeedbackWhenAvailable() {
        when(openAiClient.isConfigured()).thenReturn(true);
        when(openAiClient.review(anyString(), anyString())).thenReturn(new NowInEnglishCoachFeedbackResponseDto(
                "I am taking a short break.",
                "쉬는 순간을 잘 잡았어요",
                "현재진행형으로 지금 하는 일을 말했어요.",
                "",
                "",
                "",
                "왜 쉬고 있는지 붙여 볼까요?",
                "take a break",
                "잠깐 쉬다",
                "I take a break after lunch."
        ));

        NowInEnglishCoachFeedbackResponseDto response = service.review(7L, request());

        assertThat(response.headlineKo()).isEqualTo("쉬는 순간을 잘 잡았어요");
        assertThat(response.expression()).isEqualTo("take a break");
    }

    private NowInEnglishCoachFeedbackRequestDto request() {
        return new NowInEnglishCoachFeedbackRequestDto("I am taking a short break.", "2026-10-22T12:00:00+09:00");
    }
}
