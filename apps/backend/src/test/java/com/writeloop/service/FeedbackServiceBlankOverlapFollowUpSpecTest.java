package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.writeloop.dto.PromptDto;
import com.writeloop.support.IntegrationTestSupport;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 057 4단계 뒤 결정(11-main-decision.md)으로 더한 테스트 중 백엔드 쪽: 넣어볼 표현의 빈칸 겹침 떼기(명세 4 A).
 *
 * <p>결정 11-4: 겹침 비교에서 숫자도 낱말의 일부다(명세 "한 낱말이 똑같이 겹칠 때만"). "7am"과 "8am"은 다른 낱말이고,
 * "3"과 "3"은 같은 낱말이다. 이 세 테스트(changed_)는 지금 코드에서 실패해야 한다.
 *
 * <p>결정 11-7: 03 결정 2-2(빈칸이 여럿이면 첫 빈칸의 앞뒤 낱말과 비교)와 03 덧붙임 2-3(떼고 남은 표현이 2개 미만이면 미션 지원은
 * 지금 검사대로 다시 시도, 풍부하게 써 보기는 지금 동작대로 제안을 버림). 이 세 테스트(kept_)는 지금 코드에서 통과해야 한다.
 *
 * <p>방법은 FeedbackServiceContentQualitySpecTest와 같다. 실제 앱(통합 테스트 기반)에 가짜 OpenAI 서버를 붙이고
 * POST /api/feedback의 응답(바깥 칸과 visibleFeedback 사본)을 본다. OpenAI는 부르지 않는다. 질문은 기준 데이터의
 * prompt-goal-1102를 읽기만 하고(R = 첫 필수 슬롯, D1·D2 = 첫째·둘째 깊이 슬롯), 테스트마다 고유한 guestId를 쓴다.
 */
class FeedbackServiceBlankOverlapFollowUpSpecTest extends IntegrationTestSupport {

    private static final String PROMPT_ID = "prompt-goal-1102";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final FakeOpenAi OPENAI = FakeOpenAi.start();

    // R 충족, D1 막연함 -> 깊이 슬롯이 하나도 충족되지 않아 D1 내용 보충(SLOT).
    private static final String ANSWER_SLOT_D1 = "I will write three lines in my journal at some point.";
    // R 충족, D1 충족 -> 완료(COMPLETE). D2가 비어 있어 풍부하게 써 보기는 D2.
    private static final String ANSWER_COMPLETE = "I will write three lines in my journal every night at ten.";

    @DynamicPropertySource
    static void fakeOpenAiProperties(DynamicPropertyRegistry registry) {
        registry.add("openai.api-key", () -> "test-key");
        registry.add("openai.api-url", OPENAI::url);
    }

    @AfterAll
    static void stopFakeOpenAi() {
        OPENAI.stop();
    }

    @Autowired
    private PromptService promptService;

    private String r;
    private String d1;
    private String d2;
    private List<String> contractSlots;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        OPENAI.reset();
        PromptDto prompt = promptService.findById(PROMPT_ID);
        assertThat(prompt.id()).as("setup: %s must be an active prompt", PROMPT_ID).isEqualTo(PROMPT_ID);
        Map<String, Object> contract = new FeedbackLearningContractPolicy().promptContract(prompt);
        List<String> required = (List<String>) contract.get("requiredSlots");
        List<String> depth = (List<String>) contract.get("depthSlots");
        assertThat(required).as("setup: required slots").isNotEmpty();
        assertThat(depth).as("setup: depth slots").hasSizeGreaterThanOrEqualTo(2);
        assertThat(((Number) contract.get("minimumDepthSlots")).intValue()).as("setup: minimumDepthSlots").isEqualTo(1);
        r = required.get(0);
        d1 = depth.get(0);
        d2 = depth.get(1);
        contractSlots = new ArrayList<>(required);
        contractSlots.addAll(depth);
    }

    // ================= 결정 11-4: 숫자도 낱말의 일부 (지금 실패해야 함) =================

    // 빈칸 바로 앞 낱말이 숫자 "3"이고 표현의 첫 낱말도 "3"이면 같은 낱말이라 뗀다. "4"는 다른 낱말이라 그대로 둔다.
    @Test
    void changed_missionPhraseDropsTheSameNumberWordBeforeTheBlank() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I will write 3 ____ in my journal every night.",
                "3 short lines", "4 short lines", "short sentences")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "short lines", "4 short lines", "short sentences");
    }

    // "7am"과 "8am"은 글자 부분(am)만 같고 숫자가 다르므로 같은 낱말이 아니다. "7am"은 똑같이 겹치므로 뗀다.
    @Test
    void changed_missionPhraseKeepsAWordThatDiffersFromTheFrameWordOnlyInDigits() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I will write in my journal at 7am ____ every day.",
                "7am before breakfast", "8am on weekends", "after I wake up")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "before breakfast", "8am on weekends", "after I wake up");
    }

    // 빈칸 바로 뒤 낱말이 숫자 "3"이고 표현의 끝 낱말도 "3"이면 뗀다.
    @Test
    void changed_missionPhraseDropsTheSameNumberWordAfterTheBlank() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I will write in my journal ____ 3 times a week.",
                "in the evening 3", "before bed", "for ten minutes")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "in the evening", "before bed", "for ten minutes");
    }

    // ================= 결정 11-7: 03 결정 2-2·덧붙임 2-3 (지금 통과해야 함) =================

    // 03 결정 2-2: 빈칸이 여럿이면 첫 빈칸의 앞뒤 낱말(meet, at)과 비교한다. "at the library"는 둘째 빈칸 앞 낱말 at과
    // 겹치지만 첫 빈칸과는 겹치지 않으므로 그대로 둔다.
    @Test
    void kept_firstBlankDecidesTheOverlapWhenTheFrameHasTwoBlanks() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I meet ____ at ____ every week.",
                "meet my friends", "my cousins at", "at the library")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "my friends", "my cousins", "at the library");
        assertThat(response.path("coachMove").path("skeletonEn").asText())
                .as("the skeleton itself is unchanged")
                .isEqualTo("I meet ____ at ____ every week.");
    }

    // 03 덧붙임 2-3(미션 지원): 떼고 비어서 뺀 뒤 표현이 1개만 남으면 지원 내용이 완전하지 않아 계약 위반으로 한 번 다시 시도한다.
    @Test
    void kept_missionSupportLeftWithFewerThanTwoPhrasesAfterTrimmingIsRetried() throws Exception {
        String trimmedToOne = slotMissionOutput(support(d1, "I will prepare my meals on ____.", "on", "Sunday"));
        String recovered = slotMissionOutput(support(d1, "I will prepare my meals on ____.", "Sunday", "Saturday morning"));
        OPENAI.respond(trimmedToOne, recovered);

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertThat(OPENAI.requestCount()).as("OpenAI requests").isEqualTo(2);
        assertThat(OPENAI.userPromptText(1))
                .contains("CANONICAL_CONTRACT_RETRY")
                .contains("Incomplete mission support");
        assertMissionPhrases(response, "Sunday", "Saturday morning");
    }

    // 03 덧붙임 2-3(풍부하게 써 보기): 떼고 비어서 뺀 뒤 표현이 1개만 남으면 다시 시도하지 않고 그 제안만 버린다. 답은 완료 그대로다.
    @Test
    void kept_enrichmentLeftWithFewerThanTwoPhrasesAfterTrimmingIsDropped() throws Exception {
        OPENAI.respond(completeOutput(support(d2, "I write in my journal because ___.", "because", "it calms me down"), 2));

        JsonNode response = post(ANSWER_COMPLETE);

        assertThat(response.path("loopComplete").asBoolean()).as("loopComplete, body %s", response).isTrue();
        assertThat(OPENAI.requestCount()).as("OpenAI requests (no contract retry)").isEqualTo(1);
        for (JsonNode completion : List.of(response.path("completion"), response.path("visibleFeedback").path("completion"))) {
            JsonNode enrichment = completion.path("enrichment");
            assertThat(enrichment.isMissingNode() || enrichment.isNull())
                    .as("no enrichment is shown, body %s", response)
                    .isTrue();
        }
        assertThat(expressions(response.path("refinementExpressions"))).containsExactly("make it a habit to", "so that");
    }

    // ================= 준비 (FeedbackServiceContentQualitySpecTest와 같은 방법) =================

    private Map<String, String[]> slotD1Verdicts() {
        return slots(r, "write three lines in my journal", "SATISFIED", d1, "at some point", "GENERIC");
    }

    private Map<String, String[]> completeVerdicts() {
        return slots(r, "write three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED");
    }

    private String slotMissionOutput(Map<String, Object> missionSupport) throws Exception {
        return output(slotD1Verdicts(), List.of(missionSupport), List.of(), false, 0);
    }

    private String completeOutput(Map<String, Object> enrichment, int refinementCount) throws Exception {
        return output(completeVerdicts(), List.of(), List.of(enrichment), true, refinementCount);
    }

    // slot, evidence, verdict를 세 개씩. 적지 않은 슬롯은 근거 없이 MISSING이 된다.
    private static Map<String, String[]> slots(String... triples) {
        Map<String, String[]> map = new LinkedHashMap<>();
        for (int index = 0; index < triples.length; index += 3) {
            map.put(triples[index], new String[]{triples[index + 1], triples[index + 2]});
        }
        return map;
    }

    private String output(
            Map<String, String[]> verdicts,
            List<Map<String, Object>> missionSupport,
            List<Map<String, Object>> enrichmentSupport,
            boolean completionOutputs,
            int refinementCount
    ) throws Exception {
        List<Map<String, Object>> slotItems = new ArrayList<>();
        for (String slot : contractSlots) {
            String[] value = verdicts.get(slot);
            slotItems.add(ordered(
                    "slot", slot,
                    "evidence", value == null ? "" : value[0],
                    "reason", "qa-057 slot reason: the quoted span decides this slot.",
                    "verdict", value == null ? "MISSING" : value[1]
            ));
        }
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("topicAssessment", ordered("reason", "qa-057 topic reason: the answer describes a journaling plan.",
                "status", "ON_TOPIC"));
        root.put("structureAssessment", ordered("reason", "qa-057 structure reason: every segment is a sentence.",
                "status", "COMPLETE"));
        root.put("languageAssessment", ordered("revisionSteps", List.of()));
        root.put("slotAssessments", slotItems);
        root.put("missionSupport", missionSupport);
        root.put("enrichmentSupport", enrichmentSupport);
        root.put("modelAnswer", completionOutputs ? "I will write three lines in my journal every night at ten before bed." : "");
        root.put("modelAnswerKo", completionOutputs ? "매일 밤 열 시, 자기 전에 일기를 세 줄 쓸 거예요." : "");
        root.put("refinementExpressions", refinements(refinementCount));
        root.put("strengths", List.of("계획이 분명해요."));
        return JSON.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    private static Map<String, Object> support(String slot, String skeletonEn, String... phrases) {
        List<Map<String, Object>> suggested = new ArrayList<>();
        for (String phrase : phrases) {
            suggested.add(ordered("phrase", phrase, "meaningKo", "뜻: " + phrase));
        }
        Map<String, Object> support = new LinkedHashMap<>();
        support.put("slot", slot);
        support.put("title", "한 가지를 더 분명하게 써 보세요");
        support.put("whyKo", "답이 더 구체적이 돼요.");
        support.put("instructionKo", "실제 계획에서 한 가지를 구체적으로 더하세요.");
        support.put("skeletonEn", skeletonEn);
        support.put("skeletonKo", "나는 ____ 일기를 쓸 거예요.");
        support.put("suggestedPhrases", suggested);
        return support;
    }

    private static List<Map<String, Object>> refinements(int count) {
        List<Map<String, Object>> all = List.of(
                ordered("expression", "make it a habit to", "meaningKo", "~을 습관으로 삼다",
                        "guidanceKo", "꾸준함을 강조해요.", "exampleEn", "I make it a habit to write before bed."),
                ordered("expression", "so that", "meaningKo", "~하도록", "guidanceKo", "목적을 이어요.",
                        "exampleEn", "I write every night so that I remember my day.")
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

    private JsonNode post(String answer) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("promptId", PROMPT_ID);
        body.put("answer", answer);
        body.put("attemptType", "INITIAL");
        body.put("guestId", "guest-qa-057b-" + UUID.randomUUID().toString().replace("-", ""));
        body.put("submissionId", "qa-057b-" + UUID.randomUUID().toString().substring(0, 18));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = rest.postForEntity("/api/feedback", new HttpEntity<>(body, headers), String.class);
        assertThat(response.getStatusCode())
                .as("POST /api/feedback body %s, fake OpenAI requests %s", response.getBody(), OPENAI.requestCount())
                .isEqualTo(HttpStatus.OK);
        return JSON.readTree(response.getBody());
    }

    private static void assertMission(JsonNode response, String focusType, String targetSlot) {
        JsonNode coachMove = response.path("coachMove");
        assertThat(response.path("loopComplete").asBoolean()).as("setup: loopComplete, body %s", response).isFalse();
        assertThat(coachMove.path("focusType").asText()).as("setup: coachMove.focusType, body %s", response)
                .isEqualTo(focusType);
        assertThat(coachMove.path("targetSlot").asText()).as("setup: coachMove.targetSlot, body %s", response)
                .isEqualTo(targetSlot);
    }

    private static void assertMissionPhrases(JsonNode response, String... expected) {
        assertThat(phrases(response.path("coachMove").path("suggestedPhrases")))
                .as("coachMove.suggestedPhrases")
                .containsExactly(expected);
        assertThat(phrases(response.path("visibleFeedback").path("coachMove").path("suggestedPhrases")))
                .as("visibleFeedback.coachMove.suggestedPhrases")
                .containsExactly(expected);
    }

    private static List<String> phrases(JsonNode suggestedPhrases) {
        List<String> values = new ArrayList<>();
        suggestedPhrases.forEach(item -> values.add(item.isTextual() ? item.asText() : item.path("phrase").asText()));
        return values;
    }

    private static List<String> expressions(JsonNode refinementExpressions) {
        List<String> values = new ArrayList<>();
        refinementExpressions.forEach(item -> values.add(item.path("expression").asText()));
        return values;
    }

    /** OpenAI Responses API 대신 응답하는 가짜 서버. 받은 요청 본문을 차례로 남기고, 정해 둔 출력을 차례로 돌려준다. */
    private static final class FakeOpenAi {

        private final HttpServer server;
        private final List<String> requests = new ArrayList<>();
        private List<String> outputs = List.of();

        private FakeOpenAi(HttpServer server) {
            this.server = server;
        }

        static FakeOpenAi start() {
            try {
                HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
                FakeOpenAi fake = new FakeOpenAi(server);
                server.createContext("/v1/responses", fake::handle);
                server.setExecutor(Executors.newCachedThreadPool(runnable -> {
                    Thread thread = new Thread(runnable, "qa-057b-fake-openai");
                    thread.setDaemon(true);
                    return thread;
                }));
                server.start();
                return fake;
            } catch (IOException exception) {
                throw new UncheckedIOException(exception);
            }
        }

        String url() {
            return "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/responses";
        }

        synchronized void reset() {
            requests.clear();
            outputs = List.of();
        }

        synchronized void respond(String... outputs) {
            this.outputs = List.of(outputs);
        }

        synchronized int requestCount() {
            return requests.size();
        }

        synchronized String userPromptText(int index) throws IOException {
            assertThat(requests.size()).as("fake OpenAI request %s was sent", index).isGreaterThan(index);
            return JSON.readTree(requests.get(index)).path("input").get(1).path("content").get(0).path("text").asText();
        }

        void stop() {
            server.stop(0);
        }

        private void handle(HttpExchange exchange) throws IOException {
            String output;
            synchronized (this) {
                requests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                int index = requests.size() - 1;
                output = outputs.isEmpty() ? "{}" : outputs.get(Math.min(index, outputs.size() - 1));
            }
            Map<String, Object> usage = new LinkedHashMap<>();
            usage.put("input_tokens", 100);
            usage.put("output_tokens", 30);
            usage.put("total_tokens", 130);
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("output_text", output);
            envelope.put("usage", usage);
            byte[] body = JSON.writeValueAsBytes(envelope);
            exchange.getResponseHeaders().set("content-type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        }
    }
}
