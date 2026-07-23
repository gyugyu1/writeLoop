package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.exception.ApiException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OpenAiFeedbackClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void reportsWhetherApiKeyIsConfigured() {
        assertThat(client("").isConfigured()).isFalse();
        assertThat(client("test-key").isConfigured()).isTrue();
    }

    @Test
    void rejectsFeedbackGenerationWhenApiKeyIsMissing() {
        assertThatThrownBy(() -> client("").review(null, "I take a walk."))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getCode()).isEqualTo("FEEDBACK_GENERATION_UNAVAILABLE");
                    assertThat(exception.getStatus().value()).isEqualTo(502);
                });
    }

    @Test
    void buildsInlineDiffFromTheBackendCorrection() {
        assertThat(client("test-key")
                .buildPreciseInlineFeedback("I goes home.", "I go home."))
                .anySatisfy(segment -> assertThat(segment.type()).isEqualTo("REMOVE"));
    }

    private OpenAiFeedbackClient client(String apiKey) {
        return new OpenAiFeedbackClient(
                objectMapper,
                apiKey,
                "gpt-test",
                "https://example.invalid/v1/responses",
                "",
                5
        );
    }
}
