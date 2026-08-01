package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FeedbackTokenUsageTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void extractsOpenAiUsageAndAddsOneRetry() {
        FeedbackTokenUsage initial = FeedbackTokenUsage.fromOpenAiResponse(
                objectMapper,
                """
                {
                  "usage": {
                    "input_tokens": 100,
                    "input_tokens_details": {"cached_tokens": 20},
                    "output_tokens": 30,
                    "output_tokens_details": {"reasoning_tokens": 10},
                    "total_tokens": 130
                  }
                }
                """
        );
        FeedbackTokenUsage retry = FeedbackTokenUsage.fromOpenAiResponse(
                objectMapper,
                """
                {
                  "usage": {
                    "input_tokens": 110,
                    "input_tokens_details": {"cached_tokens": 25},
                    "output_tokens": 40,
                    "output_tokens_details": {"reasoning_tokens": 15},
                    "total_tokens": 150
                  }
                }
                """
        );

        assertThat(initial.plus(retry)).isEqualTo(
                new FeedbackTokenUsage(210L, 45L, 70L, 25L, 280L)
        );
    }

    @Test
    void extractsGeminiUsageMetadata() {
        FeedbackTokenUsage usage = FeedbackTokenUsage.fromGeminiResponse(
                objectMapper,
                """
                {
                  "usageMetadata": {
                    "promptTokenCount": 90,
                    "cachedContentTokenCount": 15,
                    "candidatesTokenCount": 25,
                    "thoughtsTokenCount": 8,
                    "totalTokenCount": 115
                  }
                }
                """
        );

        assertThat(usage).isEqualTo(new FeedbackTokenUsage(90L, 15L, 25L, 8L, 115L));
    }

    @Test
    void leavesUnavailableUsageValuesNull() {
        FeedbackTokenUsage usage = FeedbackTokenUsage.fromOpenAiResponse(
                objectMapper,
                "{\"output_text\":\"ok\"}"
        );

        assertThat(usage).isEqualTo(FeedbackTokenUsage.empty());
    }
}
