package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 073 재현 테스트: 교정 단계(revision step) 계약 위반이 나면 다른 계약 위반처럼 한 번 다시 시도해야 한다.
 * 고치기 전에는 다시 시도 없이 바로 502(FEEDBACK_GENERATION_UNAVAILABLE)로 끝난다.
 * 범위는 04 결정대로 지금 코드의 교정 단계 계약 위반(languageRevisionViolation) 전부다.
 */
class OpenAiFeedbackClientRevisionStepRetrySpecTest {

    private static final String LEARNER_ANSWER = "I goes home because I am tired.";
    private static final String FIXED_ANSWER = "I go home because I am tired.";

    private static final String NO_CHANGE_MESSAGE =
            "Every revision step must change the complete answer from the previous step";
    private static final String REVERT_MESSAGE =
            "A later revision step cannot change or revert text corrected by an earlier step";
    private static final String INCOMPLETE_STEP_MESSAGE =
            "Every revision step requires kind, answerAfter, and reasonKo";
    private static final String COMPLETE_WITH_STRUCTURE_MESSAGE =
            "COMPLETE structure assessment cannot include a STRUCTURE revision step";

    // 04 결정으로 넓힌 범위: languageRevisionViolation으로 만드는 나머지 위반
    private static final String TOO_MANY_STEPS_MESSAGE =
            "languageAssessment.revisionSteps may contain at most 25 correction steps";
    private static final String OFF_TOPIC_NOT_COMPLETE_MESSAGE =
            "OFF_TOPIC answers must use COMPLETE structure status";
    private static final String OFF_TOPIC_WITH_STEPS_MESSAGE =
            "OFF_TOPIC answers cannot include language revision steps";
    private static final String KIND_ORDER_MESSAGE =
            "Revision steps must be ordered STRUCTURE, GRAMMAR_BLOCKING, then GRAMMAR_LOCAL";
    private static final String FRAGMENT_WITHOUT_STRUCTURE_STEP_MESSAGE =
            "FRAGMENT structure assessment requires at least one STRUCTURE revision step";

    private final ObjectMapper objectMapper = new ObjectMapper();

    // --- 다시 시도한 출력이 계약을 지키면 정상 피드백을 돌려준다 ---

    @Test
    void unchangedRevisionStepIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(unchangedStepOutput(), NO_CHANGE_MESSAGE);
    }

    @Test
    void laterStepRevertingAnEarlierCorrectionIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(revertingStepOutput(), REVERT_MESSAGE);
    }

    @Test
    void revisionStepWithoutReasonIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(stepWithoutReasonOutput(), INCOMPLETE_STEP_MESSAGE);
    }

    @Test
    void completeStructureWithStructureStepIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(completeWithStructureStepOutput(), COMPLETE_WITH_STRUCTURE_MESSAGE);
    }

    // --- 다시 시도도 위반하면 지금처럼 실패하고, 다시 시도는 한 번뿐이다 ---

    @Test
    void unchangedRevisionStepFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(unchangedStepOutput(), NO_CHANGE_MESSAGE);
    }

    @Test
    void laterStepRevertingAnEarlierCorrectionFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(revertingStepOutput(), REVERT_MESSAGE);
    }

    @Test
    void revisionStepWithoutReasonFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(stepWithoutReasonOutput(), INCOMPLETE_STEP_MESSAGE);
    }

    @Test
    void completeStructureWithStructureStepFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(completeWithStructureStepOutput(), COMPLETE_WITH_STRUCTURE_MESSAGE);
    }

    // --- 04 결정으로 넓힌 범위: 나머지 교정 단계 위반도 한 번 다시 시도한다 ---

    @Test
    void moreThanTwentyFiveStepsIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(tooManyStepsOutput(), TOO_MANY_STEPS_MESSAGE);
    }

    @Test
    void moreThanTwentyFiveStepsFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(tooManyStepsOutput(), TOO_MANY_STEPS_MESSAGE);
    }

    @Test
    void offTopicFragmentIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(offTopicFragmentOutput(), OFF_TOPIC_NOT_COMPLETE_MESSAGE);
    }

    @Test
    void offTopicFragmentFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(offTopicFragmentOutput(), OFF_TOPIC_NOT_COMPLETE_MESSAGE);
    }

    @Test
    void offTopicWithRevisionStepIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(offTopicWithStepOutput(), OFF_TOPIC_WITH_STEPS_MESSAGE);
    }

    @Test
    void offTopicWithRevisionStepFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(offTopicWithStepOutput(), OFF_TOPIC_WITH_STEPS_MESSAGE);
    }

    @Test
    void reversedKindOrderIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(reversedKindOrderOutput(), KIND_ORDER_MESSAGE);
    }

    @Test
    void reversedKindOrderFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(reversedKindOrderOutput(), KIND_ORDER_MESSAGE);
    }

    @Test
    void fragmentWithoutStructureStepIsRetriedOnceAndRecovers() throws Exception {
        assertRetriedOnceThenRecovered(fragmentWithoutStructureStepOutput(), FRAGMENT_WITHOUT_STRUCTURE_STEP_MESSAGE);
    }

    @Test
    void fragmentWithoutStructureStepFailsAfterOneRetry() throws Exception {
        assertFailsAfterExactlyOneRetry(fragmentWithoutStructureStepOutput(), FRAGMENT_WITHOUT_STRUCTURE_STEP_MESSAGE);
    }

    private void assertRetriedOnceThenRecovered(String rejectedOutput, String violation) throws Exception {
        try (TestResponseServer server = new TestResponseServer(rejectedOutput, validOutput())) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(prompt(), LEARNER_ANSWER);

            assertThat(feedback.sessionId()).isEqualTo(OpenAiFeedbackClient.INTERNAL_AUTHORITATIVE_SESSION_ID);
            assertThat(server.requestCount()).isEqualTo(2);

            // 지금 있는 계약 다시 시도 요청: 위반 내용과 거절한 출력을 넣는다.
            JsonNode retryPayload = objectMapper.readTree(server.requestUserPrompt(1));
            assertThat(retryPayload.path("requestType").asText()).isEqualTo("CANONICAL_CONTRACT_RETRY");
            assertThat(retryPayload.path("retryInstruction").path("validationError").asText())
                    .isEqualTo(violation);
            assertThat(retryPayload.path("originalInput").path("learnerAnswer").asText())
                    .isEqualTo(LEARNER_ANSWER);
            assertThat(retryPayload.path("rejectedOutput"))
                    .isEqualTo(objectMapper.readTree(rejectedOutput));

            FeedbackAnalysisSnapshot snapshot = client.takeLastAnalysisSnapshot();
            assertThat(snapshot.contractRetry().attempted()).isTrue();
            assertThat(snapshot.contractRetry().succeeded()).isTrue();
            assertThat(snapshot.contractRetry().originalErrorReason()).isEqualTo(violation);

            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isTrue();
            assertThat(trace.finalSuccess()).isTrue();
            assertThat(trace.originalContractErrorReason()).isEqualTo(violation);
            assertThat(trace.finalErrorReason()).isNull();
            assertThat(trace.retryResponseStatusCode()).isEqualTo(200);
            assertThat(trace.tokenUsage()).isEqualTo(
                    new FeedbackTokenUsage(210L, 45L, 70L, 25L, 280L)
            );
        }
    }

    private void assertFailsAfterExactlyOneRetry(String rejectedOutput, String violation) throws Exception {
        // 세 번째 응답은 계약을 지키지만, 다시 시도는 한 번뿐이라 쓰이지 않아야 한다.
        try (TestResponseServer server = new TestResponseServer(rejectedOutput, rejectedOutput, validOutput())) {
            OpenAiFeedbackClient client = client(server.url());

            assertThatThrownBy(() -> client.review(prompt(), LEARNER_ANSWER))
                    .isInstanceOfSatisfying(ApiException.class, exception -> {
                        assertThat(exception.getCode()).isEqualTo("FEEDBACK_GENERATION_UNAVAILABLE");
                        assertThat(exception.getStatus().value()).isEqualTo(502);
                    });

            assertThat(server.requestCount()).isEqualTo(2);
            assertThat(client.takeLastAnalysisSnapshot()).isNull();

            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isFalse();
            assertThat(trace.finalSuccess()).isFalse();
            assertThat(trace.originalContractErrorReason()).isEqualTo(violation);
            assertThat(trace.finalErrorReason()).isEqualTo(violation);
            assertThat(trace.tokenUsage()).isEqualTo(
                    new FeedbackTokenUsage(210L, 45L, 70L, 25L, 280L)
            );
        }
    }

    private OpenAiFeedbackClient client(String apiUrl) {
        return new OpenAiFeedbackClient(objectMapper, "test-key", "gpt-test", apiUrl, "", 5, 80);
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

    private String validOutput() {
        return output("COMPLETE", """
                [{"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."}]
                """.formatted(FIXED_ANSWER));
    }

    // 단계가 앞 답(학습자 답)을 바꾸지 않는다.
    private String unchangedStepOutput() {
        return output("COMPLETE", """
                [{"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."}]
                """.formatted(LEARNER_ANSWER));
    }

    // 둘째 단계가 첫 단계가 고친 낱말(go)을 다시 바꾼다.
    private String revertingStepOutput() {
        return output("COMPLETE", """
                [
                  {"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."},
                  {"kind": "GRAMMAR_LOCAL", "answerAfter": "I went home because I am tired.", "reasonKo": "과거로 바꿔요."}
                ]
                """.formatted(FIXED_ANSWER));
    }

    // 단계에 reasonKo가 비어 있다.
    private String stepWithoutReasonOutput() {
        return output("COMPLETE", """
                [{"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": ""}]
                """.formatted(FIXED_ANSWER));
    }

    // 구조가 COMPLETE인데 STRUCTURE 단계가 있다.
    private String completeWithStructureStepOutput() {
        return output("COMPLETE", """
                [{"kind": "STRUCTURE", "answerAfter": "%s", "reasonKo": "문장 구조를 고쳐요."}]
                """.formatted(FIXED_ANSWER));
    }

    // 단계가 26개(최대 25개).
    private String tooManyStepsOutput() {
        String step = """
                {"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."}
                """.formatted(FIXED_ANSWER).trim();
        return output("COMPLETE", "[" + String.join(",", Collections.nCopies(26, step)) + "]");
    }

    // 주제에서 벗어난 답인데 구조가 FRAGMENT다.
    private String offTopicFragmentOutput() {
        return output("OFF_TOPIC", "FRAGMENT", "[]");
    }

    // 주제에서 벗어난 답인데 교정 단계가 있다.
    private String offTopicWithStepOutput() {
        return output("OFF_TOPIC", "COMPLETE", """
                [{"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."}]
                """.formatted(FIXED_ANSWER));
    }

    // GRAMMAR_LOCAL 뒤에 GRAMMAR_BLOCKING이 온다.
    private String reversedKindOrderOutput() {
        return output("COMPLETE", """
                [
                  {"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."},
                  {"kind": "GRAMMAR_BLOCKING", "answerAfter": "I go home because I am very tired.", "reasonKo": "뜻을 분명히 해요."}
                ]
                """.formatted(FIXED_ANSWER));
    }

    // 구조가 FRAGMENT인데 STRUCTURE 단계가 없다.
    private String fragmentWithoutStructureStepOutput() {
        return output("FRAGMENT", """
                [{"kind": "GRAMMAR_LOCAL", "answerAfter": "%s", "reasonKo": "주어 I 뒤에는 동사 원형을 써야 해요."}]
                """.formatted(FIXED_ANSWER));
    }

    private String output(String structureStatus, String revisionSteps) {
        return output("ON_TOPIC", structureStatus, revisionSteps);
    }

    private String output(String topicStatus, String structureStatus, String revisionSteps) {
        return """
                {
                  "topicAssessment": {"status": "%s", "reasonKo": "질문에 맞는 답이에요."},
                  "structureAssessment": {"status": "%s"},
                  "languageAssessment": {
                    "revisionSteps": %s
                  },
                  "strengths": [],
                  "refinementExpressions": [],
                  "slotAssessments": [
                    {"slot": "ACTION", "evidence": "goes home", "verdict": "SATISFIED"},
                    {"slot": "REASON", "evidence": "because I am tired", "verdict": "SATISFIED"}
                  ],
                  "missionSupport": [],
                  "modelAnswer": "I go home because I am tired.",
                  "modelAnswerKo": "저는 피곤해서 집에 가요."
                }
                """.formatted(topicStatus, structureStatus, revisionSteps.trim());
    }

    private final class TestResponseServer implements AutoCloseable {

        private final HttpServer server;
        private final List<String> outputs;
        private final List<String> requests = Collections.synchronizedList(new ArrayList<>());
        private final AtomicInteger requestCount = new AtomicInteger();

        private TestResponseServer(String... outputs) throws IOException {
            this.outputs = List.of(outputs);
            this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            this.server.createContext("/v1/responses", this::handle);
            this.server.setExecutor(Executors.newCachedThreadPool());
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
