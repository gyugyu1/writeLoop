package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class FeedbackServiceGuidanceTextTest {

    @Test
    void buildReadableHintRefinementGuidance_returns_clean_korean_text() {
        FeedbackService feedbackService = new FeedbackService(
                mock(PromptService.class),
                mock(OpenAiFeedbackClient.class),
                mock(com.writeloop.persistence.AnswerSessionRepository.class),
                mock(com.writeloop.persistence.AnswerAttemptRepository.class),
                new ObjectMapper()
        );

        String guidance = (String) ReflectionTestUtils.invokeMethod(
                feedbackService,
                "buildReadableHintRefinementGuidance",
                "STRUCTURE"
        );

        assertThat(guidance).isEqualTo("\uc774 \ud2c0\uc744 \uc4f0\uba74 \uc774\uc720\ub098 \ubc29\ubc95\uc744 \ub354 \uad6c\uccb4\uc801\uc73c\ub85c \uc124\uba85\ud560 \uc218 \uc788\uc5b4\uc694.");
    }

    @Test
    void buildReadableRecommendationGuidance_returns_clean_default_guidance() {
        FeedbackService feedbackService = new FeedbackService(
                mock(PromptService.class),
                mock(OpenAiFeedbackClient.class),
                mock(com.writeloop.persistence.AnswerSessionRepository.class),
                mock(com.writeloop.persistence.AnswerAttemptRepository.class),
                new ObjectMapper()
        );

        String guidance = (String) ReflectionTestUtils.invokeMethod(
                feedbackService,
                "buildReadableRecommendationGuidance",
                "To stay motivated"
        );

        assertThat(guidance).isEqualTo("\ub2e4\uc74c \ub2f5\ubcc0\uc5d0\uc11c \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub123\uc5b4 \ubcf4\uba74 \uc88b\uc740 \ud45c\ud604\uc774\uc5d0\uc694.");
    }

    @Test
    void cleanUsedExpressionUsageTip_returns_clean_korean_text() {
        FeedbackService feedbackService = new FeedbackService(
                mock(PromptService.class),
                mock(OpenAiFeedbackClient.class),
                mock(com.writeloop.persistence.AnswerSessionRepository.class),
                mock(com.writeloop.persistence.AnswerAttemptRepository.class),
                new ObjectMapper()
        );

        String guidance = (String) ReflectionTestUtils.invokeMethod(
                feedbackService,
                "cleanUsedExpressionUsageTip",
                "because it helps me stay focused"
        );

        assertThat(guidance).isEqualTo("\uc774\uc720\ub97c \uc790\uc5f0\uc2a4\ub7fd\uac8c \ub367\ubd99\uc77c \ub54c \uc4f0\uae30 \uc88b\uc740 \ud45c\ud604\uc774\uc5d0\uc694.");
    }
}
