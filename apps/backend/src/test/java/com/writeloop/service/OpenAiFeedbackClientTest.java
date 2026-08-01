package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.exception.ApiException;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

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
                .anySatisfy(segment -> assertThat(segment.type()).isEqualTo("REPLACE"));
    }

    @Test
    void retriesOneContractViolationWithItsReasonAndKeepsTheRetryTrace() throws Exception {
        try (TestResponseServer server = new TestResponseServer(
                invalidContractOutput(),
                validContractOutput()
        )) {
            OpenAiFeedbackClient client = client("test-key", server.url());

            FeedbackResponseDto feedback = client.review(prompt(), "I goes home because I am tired.");

            assertThat(feedback.sessionId()).isEqualTo(OpenAiFeedbackClient.INTERNAL_AUTHORITATIVE_SESSION_ID);
            assertThat(server.requestCount()).isEqualTo(2);
            assertThat(server.requestUserPrompt(1))
                    .contains("CANONICAL_CONTRACT_RETRY")
                    .contains("Every configured slot must be assessed exactly once")
                    .contains("\"learnerAnswer\" : \"I goes home because I am tired.\"")
                    .contains("\"revisionSteps\"");

            FeedbackAnalysisSnapshot snapshot = client.takeLastAnalysisSnapshot();
            assertThat(snapshot.contractRetry().attempted()).isTrue();
            assertThat(snapshot.contractRetry().succeeded()).isTrue();
            assertThat(snapshot.contractRetry().originalErrorReason())
                    .contains("Every configured slot must be assessed exactly once");
            assertThat(snapshot.contractRetry().originalResponseBodyJson())
                    .doesNotContain("\"REASON\"");
            assertThat(snapshot.contractRetry().retryResponseBodyJson())
                    .contains("\"kind\": \"GRAMMAR_LOCAL\"");

            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isTrue();
            assertThat(trace.finalSuccess()).isTrue();
            assertThat(trace.initialResponseBodyJson())
                    .doesNotContain("\"REASON\"");
            assertThat(trace.retryResponseBodyJson())
                    .contains("\"REASON\"");
            assertThat(trace.tokenUsage()).isEqualTo(
                    new FeedbackTokenUsage(210L, 45L, 70L, 25L, 280L)
            );
        }
    }

    @Test
    void stopsAfterOneContractRetryWhenTheSecondResponseIsStillInvalid() throws Exception {
        try (TestResponseServer server = new TestResponseServer(
                invalidContractOutput(),
                invalidContractOutput()
        )) {
            OpenAiFeedbackClient client = client("test-key", server.url());

            assertThatThrownBy(() -> client.review(prompt(), "I goes home because I am tired."))
                    .isInstanceOfSatisfying(ApiException.class, exception ->
                            assertThat(exception.getCode()).isEqualTo("FEEDBACK_GENERATION_UNAVAILABLE"));
            assertThat(server.requestCount()).isEqualTo(2);
            assertThat(client.takeLastAnalysisSnapshot()).isNull();

            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isFalse();
            assertThat(trace.finalSuccess()).isFalse();
            assertThat(trace.initialResponseBodyJson())
                    .doesNotContain("\"REASON\"");
            assertThat(trace.retryResponseBodyJson())
                    .doesNotContain("\"REASON\"");
            assertThat(trace.finalErrorReason())
                    .contains("Every configured slot must be assessed exactly once");
            assertThat(trace.tokenUsage()).isEqualTo(
                    new FeedbackTokenUsage(210L, 45L, 70L, 25L, 280L)
            );
        }
    }

    @Test
    void doesNotRetryAnInvalidLanguageRevisionStep() throws Exception {
        String invalidLanguageOutput = validContractOutput().replace(
                "\"answerAfter\": \"I go home because I am tired.\"",
                "\"answerAfter\": \"I goes home because I am tired.\""
        );
        try (TestResponseServer server = new TestResponseServer(invalidLanguageOutput)) {
            OpenAiFeedbackClient client = client("test-key", server.url());

            assertThatThrownBy(() -> client.review(
                    prompt(),
                    "I goes home because I am tired."
            )).isInstanceOfSatisfying(ApiException.class, exception ->
                    assertThat(exception.getCode()).isEqualTo("FEEDBACK_GENERATION_UNAVAILABLE"));

            assertThat(server.requestCount()).isEqualTo(1);
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isFalse();
            assertThat(trace.finalErrorReason())
                    .contains("Every revision step must change");
            assertThat(trace.tokenUsage()).isEqualTo(
                    new FeedbackTokenUsage(100L, 20L, 30L, 10L, 130L)
            );
        }
    }

    private OpenAiFeedbackClient client(String apiKey) {
        return client(apiKey, "https://example.invalid/v1/responses");
    }

    private OpenAiFeedbackClient client(String apiKey, String apiUrl) {
        return new OpenAiFeedbackClient(
                objectMapper,
                apiKey,
                "gpt-test",
                apiUrl,
                "",
                5
        );
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work and why?",
                "퇴근 후에 보통 무엇을 하고, 왜 그렇게 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of("REASON"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        1,
                        Map.of(
                                "ACTION", new PromptSlotContractDto(
                                        "The learner's usual action after work.",
                                        "The answer states an action the learner usually performs after work.",
                                        "퇴근 후 학습자가 평소에 하는 행동",
                                        "답변이 퇴근 후 평소 행동을 말하면 충족한다."
                                ),
                                "REASON", new PromptSlotContractDto(
                                        "The learner's reason for the usual action.",
                                        "The answer gives a concrete reason for the action.",
                                        "그 행동을 하는 이유",
                                        "답변이 행동의 구체적인 이유를 말하면 충족한다."
                                )
                        )
                )
        );
    }

    private String invalidContractOutput() {
        return canonicalOutput(false);
    }

    private String validContractOutput() {
        return canonicalOutput(true);
    }

    private String canonicalOutput(boolean includeReasonSlot) {
        String revisionSteps = includeReasonSlot
                ? """
                    [{
                      "kind": "GRAMMAR_LOCAL",
                      "answerAfter": "I go home because I am tired.",
                      "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."
                    }]
                    """
                : "[]";
        String reasonSlot = includeReasonSlot
                ? """
                    ,
                    "REASON": {"evidence": "because I am tired", "support": []}
                    """
                : "";
        return """
                {
                  "topicAssessment": {"status": "ON_TOPIC", "reasonKo": "질문에 맞는 답이에요."},
                  "structureAssessment": {"status": "COMPLETE"},
                  "languageAssessment": {
                    "revisionSteps": %s
                  },
                  "strengths": [],
                  "refinementExpressions": [],
                  "slotAssessments": {
                    "ACTION": {"evidence": "goes home", "support": []}%s
                  },
                  "modelAnswer": "I go home because I am tired.",
                  "modelAnswerKo": "저는 피곤해서 집에 가요."
                }
                """.formatted(revisionSteps, reasonSlot);
    }

    private final class TestResponseServer implements AutoCloseable {

        private final HttpServer server;
        private final List<String> outputs;
        private final List<String> requests = new ArrayList<>();
        private final AtomicInteger requestCount = new AtomicInteger();

        private TestResponseServer(String... outputs) throws IOException {
            this.outputs = List.of(outputs);
            this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            this.server.createContext("/v1/responses", this::handle);
            this.server.start();
        }

        private void handle(HttpExchange exchange) throws IOException {
            requests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            int index = requestCount.getAndIncrement();
            String output = outputs.get(Math.min(index, outputs.size() - 1));
            Map<String, Object> usage = index == 0
                    ? Map.of(
                            "input_tokens", 100,
                            "input_tokens_details", Map.of("cached_tokens", 20),
                            "output_tokens", 30,
                            "output_tokens_details", Map.of("reasoning_tokens", 10),
                            "total_tokens", 130
                    )
                    : Map.of(
                            "input_tokens", 110,
                            "input_tokens_details", Map.of("cached_tokens", 25),
                            "output_tokens", 40,
                            "output_tokens_details", Map.of("reasoning_tokens", 15),
                            "total_tokens", 150
                    );
            byte[] body = objectMapper.writeValueAsBytes(Map.of(
                    "output_text", output,
                    "usage", usage
            ));
            exchange.getResponseHeaders().set("content-type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        }

        private String url() {
            return "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/responses";
        }

        private int requestCount() {
            return requestCount.get();
        }

        private String requestUserPrompt(int requestIndex) throws Exception {
            return objectMapper.readTree(requests.get(requestIndex))
                    .path("input")
                    .get(1)
                    .path("content")
                    .get(0)
                    .path("text")
                    .asText();
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }
}
