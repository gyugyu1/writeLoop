package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.exception.ApiException;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 작업 053 명세(문장 피드백 스키마 고정과 완료 전용 출력)의 기대 결과. 가짜 OpenAI 서버로 응답을 넣고
 * OpenAiFeedbackClient가 돌려주는 응답과 재시도 기록을 본다.
 * 바뀔 동작: 이름이 changed_ 로 시작한다. 그대로 둘 동작: kept_ 로 시작한다.
 */
class OpenAiFeedbackClientSpecTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---- 바뀔 동작 1: 슬롯 판정을 고정 모양 배열로 ----

    @Test
    void changed_requestsForQuestionsWithDifferentSlotsDifferOnlyInTheUserPrompt() throws Exception {
        List<JsonNode> requests = new ArrayList<>();
        for (PromptDto prompt : List.of(routinePrompt(), preferencePrompt(), changeReflectionPrompt())) {
            try (TestResponseServer server = new TestResponseServer(new int[]{400}, providerError())) {
                OpenAiFeedbackClient client = client(server.url());
                assertThatThrownBy(() -> client.review(prompt, "I take a walk."))
                        .isInstanceOf(ApiException.class);
                assertThat(server.requestCount()).isEqualTo(1);
                requests.add(objectMapper.readTree(server.requestBody(0)));
            }
        }

        List<String> userPrompts = new ArrayList<>();
        List<String> withoutUserPrompt = new ArrayList<>();
        for (JsonNode request : requests) {
            ObjectNode copy = request.deepCopy();
            ArrayNode input = (ArrayNode) copy.path("input");
            assertThat(input.size()).isEqualTo(2);
            assertThat(input.get(1).path("role").asText()).isEqualTo("user");
            userPrompts.add(input.get(1).path("content").get(0).path("text").asText());
            input.remove(1);
            withoutUserPrompt.add(objectMapper.writeValueAsString(copy));
        }
        assertThat(withoutUserPrompt).containsOnly(withoutUserPrompt.get(0));
        assertThat(userPrompts).doesNotHaveDuplicates();
    }

    @Test
    void changed_acceptsOneSlotAssessmentItemPerQuestionSlot() throws Exception {
        String answer = "I take a walk because it helps me relax.";
        try (TestResponseServer server = new TestResponseServer(completeRoutineOutput(List.of(
                slot("ACTION", "take a walk", "SATISFIED"),
                slot("REASON", "because it helps me relax", "SATISFIED")
        )))) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(routinePrompt(), answer);

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isTrue();
            FeedbackAnalysisSnapshot snapshot = client.takeLastAnalysisSnapshot();
            Map<String, SlotAssessmentValue> values = snapshot.finalSections().missionDecision().slotAssessments();
            assertThat(values.keySet()).containsExactlyInAnyOrder("ACTION", "REASON");
            assertThat(values.get("ACTION")).isEqualTo(new SlotAssessmentValue("take a walk", SlotAssessmentStatus.SATISFIED));
            assertThat(values.get("REASON"))
                    .isEqualTo(new SlotAssessmentValue("because it helps me relax", SlotAssessmentStatus.SATISFIED));
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isFalse();
            assertThat(trace.retryAttempted()).isFalse();
            assertThat(trace.finalSuccess()).isTrue();
        }
    }

    @Test
    void changed_missingSlotItemIsARetriedContractViolation() throws Exception {
        assertRetriedOnceThenRecovered(
                completeRoutineOutput(List.of(slot("ACTION", "take a walk", "SATISFIED"))),
                completeRoutineOutput(validRoutineSlots())
        );
    }

    @Test
    void changed_slotItemNotInTheQuestionIsARetriedContractViolation() throws Exception {
        List<Map<String, Object>> slots = new ArrayList<>(validRoutineSlots());
        slots.add(slot("PLACE", "", "MISSING"));
        assertRetriedOnceThenRecovered(
                completeRoutineOutput(slots),
                completeRoutineOutput(validRoutineSlots())
        );
    }

    @Test
    void changed_duplicateSlotItemIsARetriedContractViolation() throws Exception {
        List<Map<String, Object>> slots = new ArrayList<>(validRoutineSlots());
        slots.add(slot("REASON", "because it helps me relax", "SATISFIED"));
        assertRetriedOnceThenRecovered(
                completeRoutineOutput(slots),
                completeRoutineOutput(validRoutineSlots())
        );
    }

    // 배열 입력에서도 그 밖의 검증은 지금과 같다: SATISFIED·GENERIC은 학습자 답 인용이 필요하다.
    @Test
    void changed_arrayInputKeepsTheQuotedEvidenceRule() throws Exception {
        assertRetriedOnceThenRecovered(
                completeRoutineOutput(List.of(
                        slot("ACTION", "take a walk", "SATISFIED"),
                        slot("REASON", "because walking is healthy", "SATISFIED")
                )),
                completeRoutineOutput(validRoutineSlots())
        );
    }

    // 배열 입력에서도 그 밖의 검증은 지금과 같다: MISSING 근거는 다시 시도하지 않고 지운다.
    @Test
    void changed_arrayInputStillClearsMissingEvidenceWithoutRetry() throws Exception {
        String output = output(
                "ON_TOPIC",
                "COMPLETE",
                List.of(),
                List.of(
                        slot("ACTION", "take a walk", "SATISFIED"),
                        slot("REASON", "take a walk", "MISSING")
                ),
                List.of(support("REASON")),
                List.of(),
                "",
                "",
                List.of()
        );
        try (TestResponseServer server = new TestResponseServer(output)) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(routinePrompt(), "I take a walk.");

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.coachMove().targetSlot()).isEqualTo("REASON");
            assertThat(client.takeLastAnalysisSnapshot().finalSections().missionDecision().slotAssessments().get("REASON"))
                    .isEqualTo(new SlotAssessmentValue(null, SlotAssessmentStatus.MISSING));
            assertThat(client.takeLastExecutionTrace().contractViolationDetected()).isFalse();
        }
    }

    // missionSupport.slot의 선택지가 전체 슬롯 코드가 되어도, 질문 밖 슬롯의 미션 설명은 지금처럼 다시 시도 대상이다.
    @Test
    void changed_missionSupportForASlotOutsideTheQuestionIsStillRetried() throws Exception {
        String rejected = slotMissionOutput(support("PLACE"));
        String recovered = slotMissionOutput(support("REASON"));
        try (TestResponseServer server = new TestResponseServer(rejected, recovered)) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(routinePrompt(), "I take a walk.");

            assertThat(server.requestCount()).isEqualTo(2);
            assertThat(feedback.coachMove().targetSlot()).isEqualTo("REASON");
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isTrue();
        }
    }

    // enrichmentSupport.slot의 선택지가 전체 슬롯 코드가 되어도, 질문 밖 슬롯의 제안은 지금처럼 다시 시도 없이 버린다.
    @Test
    void changed_enrichmentForASlotOutsideTheQuestionIsDroppedWithoutRetry() throws Exception {
        try (TestResponseServer server = new TestResponseServer(completePreferenceOutput(support("PLACE")))) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(preferencePrompt(), PREFERENCE_ANSWER);

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isTrue();
            assertThat(feedback.completion()).isNull();
            assertThat(client.takeLastExecutionTrace().contractViolationDetected()).isFalse();
        }
    }

    @Test
    void changed_enrichmentForAQuestionDepthSlotStaysInTheCompletion() throws Exception {
        try (TestResponseServer server = new TestResponseServer(completePreferenceOutput(support("FEELING")))) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(preferencePrompt(), PREFERENCE_ANSWER);

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isTrue();
            assertThat(feedback.completion().enrichment().focusType()).isEqualTo("ENRICHMENT");
            assertThat(feedback.completion().enrichment().targetSlot()).isEqualTo("FEELING");
            assertThat(feedback.modelAnswer()).isEqualTo(MODEL_ANSWER);
            assertThat(feedback.refinementExpressions())
                    .extracting(RefinementExpressionDto::expression)
                    .containsExactly("remind me of", "That is why");
        }
    }

    // ---- 바뀔 동작 3: 완료 전용 출력은 완료일 때만 ----

    @Test
    void changed_completeWithBlankModelAnswerIsARetriedContractViolation() throws Exception {
        assertNoSlotCompleteRetriedOnceThenRecovered(noSlotCompleteOutput("", MODEL_ANSWER_KO, refinements(2)));
    }

    @Test
    void changed_completeWithOneRefinementExpressionIsARetriedContractViolation() throws Exception {
        assertNoSlotCompleteRetriedOnceThenRecovered(noSlotCompleteOutput(MODEL_ANSWER, MODEL_ANSWER_KO, refinements(1)));
    }

    @Test
    void changed_completeWithNoRefinementExpressionIsARetriedContractViolation() throws Exception {
        assertNoSlotCompleteRetriedOnceThenRecovered(noSlotCompleteOutput(MODEL_ANSWER, MODEL_ANSWER_KO, refinements(0)));
    }

    @Test
    void changed_completeStillMissingCompletionOutputAfterTheRetryFails() throws Exception {
        String invalid = noSlotCompleteOutput("", "", refinements(0));
        try (TestResponseServer server = new TestResponseServer(invalid, invalid)) {
            OpenAiFeedbackClient client = client(server.url());

            assertThatThrownBy(() -> client.review(noSlotPrompt(), NO_SLOT_ANSWER))
                    .isInstanceOfSatisfying(ApiException.class, exception ->
                            assertThat(exception.getCode()).isEqualTo("FEEDBACK_GENERATION_UNAVAILABLE"));

            assertThat(server.requestCount()).isEqualTo(2);
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isFalse();
            assertThat(trace.finalSuccess()).isFalse();
        }
    }

    @Test
    void changed_completeWithBlankModelAnswerOnASlotQuestionIsARetriedContractViolation() throws Exception {
        String rejected = output(
                "ON_TOPIC", "COMPLETE", List.of(), validRoutineSlots(), List.of(), List.of(),
                "", MODEL_ANSWER_KO, refinements(2)
        );
        assertRetriedOnceThenRecovered(rejected, completeRoutineOutput(validRoutineSlots()));
    }

    @Test
    void changed_languageFixDropsCompletionOnlyOutputWithoutRetry() throws Exception {
        String output = output(
                "ON_TOPIC", "COMPLETE",
                List.of(step("GRAMMAR_LOCAL", "I go home after work.")),
                List.of(), List.of(), List.of(),
                MODEL_ANSWER, MODEL_ANSWER_KO, refinements(2)
        );
        try (TestResponseServer server = new TestResponseServer(output)) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(noSlotPrompt(), "I goes home after work.");

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isFalse();
            assertThat(feedback.coachMove().focusType()).isEqualTo("LANGUAGE_FIX");
            assertCompletionOnlyOutputIsEmpty(feedback);
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isFalse();
            assertThat(trace.retryAttempted()).isFalse();
            assertThat(trace.finalSuccess()).isTrue();
        }
    }

    @Test
    void changed_slotMissionDropsCompletionOnlyOutputWithoutRetry() throws Exception {
        try (TestResponseServer server = new TestResponseServer(slotMissionOutput(support("REASON")))) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(routinePrompt(), "I take a walk.");

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isFalse();
            assertThat(feedback.coachMove().focusType()).isEqualTo("SLOT");
            assertThat(feedback.coachMove().targetSlot()).isEqualTo("REASON");
            assertCompletionOnlyOutputIsEmpty(feedback);
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isFalse();
            assertThat(trace.retryAttempted()).isFalse();
        }
    }

    @Test
    void changed_taskResetDropsCompletionOnlyOutputWithoutRetry() throws Exception {
        String output = output(
                "OFF_TOPIC", "COMPLETE", List.of(),
                List.of(slot("ACTION", "", "MISSING"), slot("REASON", "", "MISSING")),
                List.of(support("ACTION")), List.of(),
                MODEL_ANSWER, MODEL_ANSWER_KO, refinements(2)
        );
        try (TestResponseServer server = new TestResponseServer(output)) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(routinePrompt(), "My sister works at a bank in Seoul.");

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isFalse();
            assertThat(feedback.coachMove().focusType()).isEqualTo("TASK_RESET");
            assertCompletionOnlyOutputIsEmpty(feedback);
            assertThat(client.takeLastExecutionTrace().contractViolationDetected()).isFalse();
        }
    }

    // ---- 그대로 둘 동작 ----

    @Test
    void kept_completeAnswerKeepsModelAnswerTranslationAndRefinements() throws Exception {
        try (TestResponseServer server = new TestResponseServer(
                noSlotCompleteOutput(MODEL_ANSWER, MODEL_ANSWER_KO, refinements(2))
        )) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(noSlotPrompt(), NO_SLOT_ANSWER);

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isTrue();
            assertThat(feedback.modelAnswer()).isEqualTo(MODEL_ANSWER);
            assertThat(feedback.modelAnswerKo()).isEqualTo(MODEL_ANSWER_KO);
            assertThat(feedback.refinementExpressions())
                    .extracting(
                            RefinementExpressionDto::expression,
                            RefinementExpressionDto::meaningKo,
                            RefinementExpressionDto::guidanceKo,
                            RefinementExpressionDto::exampleEn
                    )
                    .containsExactly(
                            org.assertj.core.groups.Tuple.tuple(
                                    "remind me of", "~을 떠올리게 하다", "이유를 감각과 연결해요.",
                                    "Blue reminds me of the ocean."
                            ),
                            org.assertj.core.groups.Tuple.tuple(
                                    "That is why", "그래서", "이유 뒤에 결과를 이어요.",
                                    "That is why I wear blue often."
                            )
                    );
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isFalse();
            assertThat(trace.finalSuccess()).isTrue();
        }
    }

    @Test
    void kept_nonCompleteWithEmptyCompletionOutputIsAcceptedWithoutRetry() throws Exception {
        String output = output(
                "ON_TOPIC", "COMPLETE",
                List.of(step("GRAMMAR_LOCAL", "I go home after work.")),
                List.of(), List.of(), List.of(),
                "", "", List.of()
        );
        try (TestResponseServer server = new TestResponseServer(output)) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(noSlotPrompt(), "I goes home after work.");

            assertThat(server.requestCount()).isEqualTo(1);
            assertThat(feedback.loopComplete()).isFalse();
            assertThat(feedback.revisedAnswer()).isEqualTo("I go home after work.");
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isFalse();
            assertThat(trace.finalSuccess()).isTrue();
        }
    }

    // ---- helpers ----

    private static final String NO_SLOT_ANSWER = "My favorite color is blue because it reminds me of the ocean.";
    private static final String PREFERENCE_ANSWER = "My favorite color is blue because it reminds me of the ocean.";
    private static final String MODEL_ANSWER = "My favorite color is blue because it reminds me of the calm ocean.";
    private static final String MODEL_ANSWER_KO = "제가 가장 좋아하는 색은 파란색이에요. 잔잔한 바다가 떠오르기 때문이에요.";

    private void assertRetriedOnceThenRecovered(String rejected, String recovered) throws Exception {
        try (TestResponseServer server = new TestResponseServer(rejected, recovered)) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(routinePrompt(), "I take a walk because it helps me relax.");

            assertThat(server.requestCount()).isEqualTo(2);
            assertThat(server.requestUserPrompt(1)).contains("CANONICAL_CONTRACT_RETRY");
            assertThat(feedback.loopComplete()).isTrue();
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isTrue();
            assertThat(trace.finalSuccess()).isTrue();
        }
    }

    private void assertNoSlotCompleteRetriedOnceThenRecovered(String rejected) throws Exception {
        String recovered = noSlotCompleteOutput(MODEL_ANSWER, MODEL_ANSWER_KO, refinements(2));
        try (TestResponseServer server = new TestResponseServer(rejected, recovered)) {
            OpenAiFeedbackClient client = client(server.url());

            FeedbackResponseDto feedback = client.review(noSlotPrompt(), NO_SLOT_ANSWER);

            assertThat(server.requestCount()).isEqualTo(2);
            assertThat(server.requestUserPrompt(1)).contains("CANONICAL_CONTRACT_RETRY");
            assertThat(feedback.loopComplete()).isTrue();
            assertThat(feedback.modelAnswer()).isEqualTo(MODEL_ANSWER);
            assertThat(feedback.refinementExpressions()).hasSize(2);
            FeedbackExecutionTrace trace = client.takeLastExecutionTrace();
            assertThat(trace.contractViolationDetected()).isTrue();
            assertThat(trace.retryAttempted()).isTrue();
            assertThat(trace.retrySucceeded()).isTrue();
            assertThat(trace.finalSuccess()).isTrue();
        }
    }

    // 명세: 미완료 피드백의 API 응답에는 modelAnswer·modelAnswerKo가 비고 refinementExpressions가 빈 배열이다.
    private void assertCompletionOnlyOutputIsEmpty(FeedbackResponseDto feedback) {
        assertThat(feedback.modelAnswer()).isNullOrEmpty();
        assertThat(feedback.modelAnswerKo()).isNullOrEmpty();
        assertThat(feedback.refinementExpressions()).isEmpty();
    }

    private List<Map<String, Object>> validRoutineSlots() {
        return List.of(
                slot("ACTION", "take a walk", "SATISFIED"),
                slot("REASON", "because it helps me relax", "SATISFIED")
        );
    }

    private String completeRoutineOutput(List<Map<String, Object>> slots) throws Exception {
        return output(
                "ON_TOPIC", "COMPLETE", List.of(), slots, List.of(), List.of(),
                "I usually take a walk after work because it helps me relax.",
                "퇴근 후에는 긴장을 풀 수 있어서 보통 산책을 해요.",
                refinements(2)
        );
    }

    private String slotMissionOutput(Map<String, Object> missionSupport) throws Exception {
        return output(
                "ON_TOPIC", "COMPLETE", List.of(),
                List.of(slot("ACTION", "take a walk", "SATISFIED"), slot("REASON", "", "MISSING")),
                List.of(missionSupport), List.of(),
                "I usually take a walk after work because it helps me relax.",
                "퇴근 후에는 긴장을 풀 수 있어서 보통 산책을 해요.",
                refinements(2)
        );
    }

    private String completePreferenceOutput(Map<String, Object> enrichment) throws Exception {
        return output(
                "ON_TOPIC", "COMPLETE", List.of(),
                List.of(
                        slot("CHOICE", "blue", "SATISFIED"),
                        slot("REASON", "because it reminds me of the ocean", "SATISFIED"),
                        slot("FEELING", "", "MISSING")
                ),
                List.of(), List.of(enrichment),
                MODEL_ANSWER, MODEL_ANSWER_KO, refinements(2)
        );
    }

    private String noSlotCompleteOutput(
            String modelAnswer,
            String modelAnswerKo,
            List<Map<String, Object>> refinements
    ) throws Exception {
        return output(
                "ON_TOPIC", "COMPLETE", List.of(), List.of(), List.of(), List.of(),
                modelAnswer, modelAnswerKo, refinements
        );
    }

    private String output(
            String topicStatus,
            String structureStatus,
            List<Map<String, Object>> revisionSteps,
            List<Map<String, Object>> slotAssessments,
            List<Map<String, Object>> missionSupport,
            List<Map<String, Object>> enrichmentSupport,
            String modelAnswer,
            String modelAnswerKo,
            List<Map<String, Object>> refinementExpressions
    ) throws Exception {
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("topicAssessment", ordered("reasonKo", "질문과 관련된 답이에요.", "status", topicStatus));
        root.put("structureAssessment", ordered("status", structureStatus));
        root.put("languageAssessment", ordered("revisionSteps", revisionSteps));
        root.put("slotAssessments", slotAssessments);
        root.put("missionSupport", missionSupport);
        root.put("enrichmentSupport", enrichmentSupport);
        root.put("modelAnswer", modelAnswer);
        root.put("modelAnswerKo", modelAnswerKo);
        root.put("refinementExpressions", refinementExpressions);
        root.put("strengths", List.of());
        return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    private Map<String, Object> slot(String slot, String evidence, String verdict) {
        return ordered("slot", slot, "evidence", evidence, "verdict", verdict);
    }

    private Map<String, Object> step(String kind, String answerAfter) {
        return ordered("kind", kind, "answerAfter", answerAfter, "reasonKo", "주어 I 뒤에는 동사 원형을 써요.");
    }

    private Map<String, Object> support(String slot) {
        Map<String, Object> support = new LinkedHashMap<>();
        support.put("slot", slot);
        support.put("title", "한 가지를 더 넣어 보세요");
        support.put("whyKo", "답이 더 분명해져요.");
        support.put("instructionKo", "실제 경험에서 한 가지를 더하세요.");
        support.put("skeletonEn", "I take a walk because ____.");
        support.put("skeletonKo", "나는 ____ 때문에 산책해요.");
        support.put("suggestedPhrases", List.of(
                ordered("phrase", "it helps me relax", "meaningKo", "긴장을 풀어 줘요"),
                ordered("phrase", "I need fresh air", "meaningKo", "신선한 공기가 필요해요")
        ));
        return support;
    }

    private List<Map<String, Object>> refinements(int count) {
        List<Map<String, Object>> all = List.of(
                ordered(
                        "expression", "remind me of",
                        "meaningKo", "~을 떠올리게 하다",
                        "guidanceKo", "이유를 감각과 연결해요.",
                        "exampleEn", "Blue reminds me of the ocean."
                ),
                ordered(
                        "expression", "That is why",
                        "meaningKo", "그래서",
                        "guidanceKo", "이유 뒤에 결과를 이어요.",
                        "exampleEn", "That is why I wear blue often."
                )
        );
        return all.subList(0, count);
    }

    private static Map<String, Object> ordered(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int index = 0; index < keyValues.length; index += 2) {
            map.put((String) keyValues[index], keyValues[index + 1]);
        }
        return map;
    }

    private String providerError() {
        return "{\"error\":{\"code\":\"invalid_request_error\",\"type\":\"invalid_request_error\",\"message\":\"stop\"}}";
    }

    private OpenAiFeedbackClient client(String apiUrl) {
        return new OpenAiFeedbackClient(objectMapper, "test-key", "gpt-test", apiUrl, "", 5, 80);
    }

    private static PromptSlotContractDto contract(String slot) {
        return new PromptSlotContractDto(
                "The question-specific role of " + slot + ".",
                "The learner answer clearly fulfills " + slot + " for this question.",
                slot + " 역할",
                slot + " 충족 기준"
        );
    }

    private static Map<String, PromptSlotContractDto> contracts(String... slots) {
        Map<String, PromptSlotContractDto> contracts = new LinkedHashMap<>();
        for (String slot : slots) {
            contracts.put(slot, contract(slot));
        }
        return contracts;
    }

    // 필수 ACTION, 선택 REASON, 선택 슬롯 최소 1개
    private static PromptDto routinePrompt() {
        return new PromptDto(
                "prompt-spec-053-routine",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work?",
                "퇴근 후 보통 무엇을 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of("REASON"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        1,
                        contracts("ACTION", "REASON")
                )
        );
    }

    // 필수 CHOICE·REASON, 선택 FEELING, 선택 슬롯 최소 0개
    private static PromptDto preferencePrompt() {
        return new PromptDto(
                "prompt-spec-053-preference",
                "Daily life",
                "Daily life",
                "Preference",
                "I",
                "What is your favorite color? Why?",
                "가장 좋아하는 색은 무엇인가요? 왜 그런가요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "PREFERENCE",
                        List.of("CHOICE", "REASON"),
                        List.of("FEELING"),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        0,
                        contracts("CHOICE", "REASON", "FEELING")
                )
        );
    }

    private static PromptDto changeReflectionPrompt() {
        return new PromptDto(
                "prompt-spec-053-change",
                "Society",
                "Society",
                "Change",
                "C",
                "How has online shopping changed daily life, and do you think the change is mostly positive?",
                "온라인 쇼핑은 일상을 어떻게 바꾸었고, 그 변화가 대체로 긍정적이라고 생각하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "CHANGE_REFLECTION",
                        List.of("BEFORE_STATE", "NOW_STATE", "OPINION"),
                        List.of("CHANGE_CAUSE", "EXAMPLE"),
                        "MIXED",
                        "FIRST_PERSON",
                        0,
                        contracts("BEFORE_STATE", "NOW_STATE", "OPINION", "CHANGE_CAUSE", "EXAMPLE")
                )
        );
    }

    // 슬롯이 없는 질문 계약. 슬롯 판정 모양과 관계없이 완료 전용 출력 규칙만 보려고 쓴다.
    private static PromptDto noSlotPrompt() {
        return new PromptDto(
                "prompt-spec-053-no-slot",
                "Daily life",
                "Daily life",
                "Description",
                "I",
                "Tell me about your favorite color.",
                "가장 좋아하는 색에 대해 말해 주세요.",
                "",
                null,
                new PromptTaskMetaDto(
                        "GENERAL_DESCRIPTION",
                        List.of(),
                        List.of(),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        0,
                        new LinkedHashMap<>()
                )
        );
    }

    private final class TestResponseServer implements AutoCloseable {

        private final HttpServer server;
        private final List<String> outputs;
        private final int[] statusCodes;
        private final List<String> requests = new ArrayList<>();
        private final AtomicInteger requestCount = new AtomicInteger();

        private TestResponseServer(String... outputs) throws IOException {
            this(null, outputs);
        }

        private TestResponseServer(int[] statusCodes, String... outputs) throws IOException {
            this.outputs = List.of(outputs);
            this.statusCodes = new int[outputs.length];
            for (int index = 0; index < outputs.length; index++) {
                this.statusCodes[index] = statusCodes == null ? 200 : statusCodes[index];
            }
            this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            this.server.createContext("/v1/responses", this::handle);
            this.server.setExecutor(Executors.newCachedThreadPool());
            this.server.start();
        }

        private void handle(HttpExchange exchange) throws IOException {
            synchronized (requests) {
                requests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            }
            int index = requestCount.getAndIncrement();
            int responseIndex = Math.min(index, outputs.size() - 1);
            int statusCode = statusCodes[responseIndex];
            String output = outputs.get(responseIndex);
            Map<String, Object> usage = new LinkedHashMap<>();
            usage.put("input_tokens", 100);
            usage.put("input_tokens_details", Map.of("cached_tokens", 20));
            usage.put("output_tokens", 30);
            usage.put("output_tokens_details", Map.of("reasoning_tokens", 10));
            usage.put("total_tokens", 130);
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("output_text", output);
            envelope.put("usage", usage);
            byte[] body = statusCode >= 200 && statusCode < 300
                    ? objectMapper.writeValueAsBytes(envelope)
                    : output.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("content-type", "application/json");
            exchange.sendResponseHeaders(statusCode, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        }

        private String url() {
            return "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/responses";
        }

        private int requestCount() {
            return requestCount.get();
        }

        private String requestBody(int requestIndex) {
            synchronized (requests) {
                return requests.get(requestIndex);
            }
        }

        private String requestUserPrompt(int requestIndex) throws Exception {
            return objectMapper.readTree(requestBody(requestIndex))
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
