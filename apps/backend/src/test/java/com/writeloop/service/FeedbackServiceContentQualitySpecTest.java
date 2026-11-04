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
 * 작업 057 명세(01-main-spec.md)의 기대 결과 중 백엔드 쪽: 학생에게 보이는 글의 안전장치(명세 4 A·C), 주제 판정 이유 칸의
 * 새 이름(명세 3), 완료 답의 추천 표현 개수 검사(명세 3, 그대로).
 *
 * <p>안전장치가 어느 클래스에 들어가든 같은 방법으로 확인되도록, 실제 앱(통합 테스트 기반)에 가짜 OpenAI 서버를 붙이고
 * POST /api/feedback의 응답을 본다. 화면은 visibleFeedback을 먼저 쓰고 없으면 바깥 칸을 쓰므로 둘 다 본다. OpenAI는 부르지 않는다.
 *
 * <p>질문은 기준 데이터의 활성 질문 prompt-goal-1102(필수 슬롯 하나, 깊이 슬롯 둘 이상, minimumDepthSlots 1)를 읽기만 한다.
 * 슬롯 코드는 그 질문의 계약에서 읽는다: R = 첫 필수 슬롯, D1 = 첫 깊이 슬롯, D2 = 둘째 깊이 슬롯. 테스트마다 고유한 guestId를 쓴다.
 *
 * <p>가짜 LLM 출력의 topicAssessment에는 새 이름 reason과 지금 이름 reasonKo를 함께 넣는다(백엔드는 모르는 칸을 읽지 않는다).
 * 그래야 안전장치 테스트가 지금 코드에서는 안전장치 때문에만 실패하고, 고친 뒤에는 이유 칸 이름과 관계없이 확인된다.
 * 이유 칸 이름 자체는 changed_topicReason… 테스트가 reason만 넣어 본다.
 *
 * <p>넣어볼 표현 입력은 056 기준 측정 리포트에서 실제로 나온 문장 틀·표현을 따랐다(예: "I will prepare my meals on ____." / "on Sunday").
 *
 * <p>바뀔 동작은 이름이 changed_ 로 시작한다(지금 코드에서 실패해야 한다). 그대로 둘 동작은 kept_ 로 시작한다(지금 통과해야 한다).
 */
class FeedbackServiceContentQualitySpecTest extends IntegrationTestSupport {

    private static final String PROMPT_ID = "prompt-goal-1102";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final FakeOpenAi OPENAI = FakeOpenAi.start();

    // R 충족, D1 막연함 -> 깊이 슬롯이 하나도 충족되지 않아 D1 내용 보충(SLOT).
    private static final String ANSWER_SLOT_D1 = "I will write three lines in my journal at some point.";
    // R 충족, D1 충족 -> 완료(COMPLETE). D2가 비어 있어 풍부하게 써 보기는 D2.
    private static final String ANSWER_COMPLETE = "I will write three lines in my journal every night at ten.";
    // R 충족, D1 충족, 가벼운 문법 하나 -> 문장 교정(LANGUAGE_FIX).
    private static final String ANSWER_LANGUAGE_FIX = "I will writes three lines in my journal every night at ten.";

    private static final String TOPIC_REASON_EN = "qa-057 topic reason: the answer describes a journaling plan.";
    private static final String TOPIC_REASON_KO = "qa-057 주제 이유: 일기 계획을 말한 답이에요.";

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

    // ================= 바뀔 동작 4 A: 넣어볼 표현이 문장 틀 빈칸 앞뒤 낱말과 겹치면 떼기 =================

    // 표현의 첫 낱말이 빈칸 바로 앞 낱말과 같으면(대소문자 무시) 뗀다. 미션 지원(missionSupport).
    @Test
    void changed_missionPhraseDropsItsFirstWordWhenItRepeatsTheWordBeforeTheBlank() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I will prepare my meals on ____.",
                "on Sunday", "On Saturday morning", "after work")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "Sunday", "Saturday morning", "after work");
        assertThat(response.path("coachMove").path("skeletonEn").asText())
                .as("the skeleton itself is unchanged")
                .isEqualTo("I will prepare my meals on ____.");
    }

    // 표현의 끝 낱말이 빈칸 바로 뒤 낱말과 같으면 뗀다(056 실제 예: "My family and I ______ together every year." / "have dinner together").
    @Test
    void changed_missionPhraseDropsItsLastWordWhenItRepeatsTheWordAfterTheBlank() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "My family and I ______ together every year.",
                "have dinner together", "share stories", "look through a photo album")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "have dinner", "share stories", "look through a photo album");
    }

    // 앞뒤가 모두 겹치면 둘 다 떼고, 떼고 나서 비면 그 표현을 뺀다.
    @Test
    void changed_missionPhraseDropsBothEndsAndAPhraseThatBecomesEmptyIsRemoved() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "We meet at ____ together every Sunday.",
                "at the park together", "at", "a cafe", "the library")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "the park", "a cafe", "the library");
    }

    // 빈칸 바로 뒤 낱말에 마침표가 붙어 있어도 낱말은 같다("____ together.").
    @Test
    void changed_missionPhraseDropsTheRepeatedWordAfterTheBlankWhenPunctuationFollowsIt() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "My sister and I write ____ together.",
                "a short entry together", "three lines", "about our day together")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "a short entry", "three lines", "about our day");
    }

    // 풍부하게 써 보기(enrichmentSupport): 첫 낱말이 빈칸 앞 낱말과 같으면 떼고(대소문자 무시), 비면 뺀다. 빈칸은 밑줄 세 개.
    @Test
    void changed_enrichmentPhraseDropsTheRepeatedWordBeforeTheBlankAndRemovesAnEmptyPhrase() throws Exception {
        OPENAI.respond(completeOutput(support(d2, "I write in my journal because ___.",
                "because it calms me down", "Because I want to remember my day", "because", "it helps me sleep"), 2));

        JsonNode response = post(ANSWER_COMPLETE);

        assertComplete(response, d2);
        assertEnrichmentPhrases(response, "it calms me down", "I want to remember my day", "it helps me sleep");
    }

    // 풍부하게 써 보기: 끝 낱말이 빈칸 뒤 낱말과 같으면 뗀다.
    @Test
    void changed_enrichmentPhraseDropsTheRepeatedWordAfterTheBlank() throws Exception {
        OPENAI.respond(completeOutput(support(d2, "My sister and I ____ together every weekend.",
                "write a page together", "read our entries", "share one memory together"), 2));

        JsonNode response = post(ANSWER_COMPLETE);

        assertComplete(response, d2);
        assertEnrichmentPhrases(response, "write a page", "read our entries", "share one memory");
    }

    // ================= 바뀔 동작 4 A의 경계(지금도 그대로, 고친 뒤에도 그대로) =================

    // 한 낱말이 똑같이 겹칠 때만 뗀다. "because of the rain"의 첫 낱말 because는 빈칸 앞 낱말 of와 다르다.
    @Test
    void kept_missionPhraseIsUnchangedWhenOnlySeveralWordsOverlapTheFrame() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I stayed home because of ____.",
                "because of the rain", "a bad cold")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "because of the rain", "a bad cold");
    }

    // 낱말 단위로 본다. online은 빈칸 앞 낱말 on과 다른 낱말이다.
    @Test
    void kept_missionPhraseIsUnchangedWhenTheFrameWordIsOnlyAPrefixOfThePhraseWord() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I study English on ____ every day.",
                "online classes", "my phone")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertMissionPhrases(response, "online classes", "my phone");
    }

    // ================= 바뀔 동작 4 C: 학생에게 보이는 한국어 칸의 슬롯 코드를 한국어 이름으로 =================

    // 미션 지원의 제목·이유·지시와 잘한 점. 이유 문장은 056 기준 측정에서 실제로 나온 문장이다.
    @Test
    void changed_slotCodesInTheMissionTitleWhyInstructionAndStrengthBecomeKoreanNames() throws Exception {
        Map<String, Object> support = support(d1, "I will write in my journal ____.", "every night", "before bed");
        support.put("title", "ACTION을 더 구체적으로 써 보세요");
        support.put("whyKo", "필수 내용인 ACTION이 아직 넓게 표현되어 있어, 어떤 종류의 크리에이터를 보는지 밝혀야 합니다.");
        support.put("instructionKo", "SPECIFIC_TIME 하나를 골라 ACTION 뒤에 이어 써 보세요.");
        OPENAI.respond(output(slotD1Verdicts(), List.of(), List.of(support), List.of(), false, 0,
                List.of("PLAN을 분명하게 말했어요.")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        for (JsonNode coachMove : List.of(response.path("coachMove"), response.path("visibleFeedback").path("coachMove"))) {
            assertThat(coachMove.path("focus").asText()).isEqualTo("행동을 더 구체적으로 써 보세요");
            assertThat(coachMove.path("why").asText())
                    .isEqualTo("필수 내용인 행동이 아직 넓게 표현되어 있어, 어떤 종류의 크리에이터를 보는지 밝혀야 합니다.");
            assertThat(coachMove.path("instruction").asText()).isEqualTo("구체적인 때 하나를 골라 행동 뒤에 이어 써 보세요.");
        }
        assertStrength(response, "계획을 분명하게 말했어요.");
    }

    // 풍부하게 써 보기의 제목·이유·지시와 잘한 점.
    @Test
    void changed_slotCodesInTheEnrichmentTitleWhyInstructionAndStrengthBecomeKoreanNames() throws Exception {
        Map<String, Object> support = support(d2, "I feel ____ when I write in my journal.", "calm", "proud of myself");
        support.put("title", "FEELING을 넣어 더 풍부하게 써 보세요");
        support.put("whyKo", "PLACE를 이미 썼으니, 그때의 FEELING을 더하면 답이 살아나요.");
        support.put("instructionKo", "RESULT 말고 FEELING 하나만 더해 보세요.");
        OPENAI.respond(output(completeVerdicts(), List.of(), List.of(), List.of(support), true, 2,
                List.of("EXAMPLE 하나가 답을 살려요.")));

        JsonNode response = post(ANSWER_COMPLETE);

        assertComplete(response, d2);
        for (JsonNode enrichment : List.of(
                response.path("completion").path("enrichment"),
                response.path("visibleFeedback").path("completion").path("enrichment"))) {
            assertThat(enrichment.path("focus").asText()).isEqualTo("감정을 넣어 더 풍부하게 써 보세요");
            assertThat(enrichment.path("why").asText()).isEqualTo("장소를 이미 썼으니, 그때의 감정을 더하면 답이 살아나요.");
            assertThat(enrichment.path("instruction").asText()).isEqualTo("결과 말고 감정 하나만 더해 보세요.");
        }
        assertStrength(response, "예시 하나가 답을 살려요.");
    }

    // 교정 줄의 이유.
    @Test
    void changed_slotCodesInTheCorrectionReasonBecomeKoreanNames() throws Exception {
        OPENAI.respond(output(languageFixVerdicts(),
                List.of(step("GRAMMAR_LOCAL", ANSWER_COMPLETE, "ACTION 동사 writes는 will 뒤에서 원형 write로 써요.")),
                List.of(), List.of(), false, 0, List.of("계획이 분명해요.")));

        JsonNode response = post(ANSWER_LANGUAGE_FIX);

        assertMission(response, "LANGUAGE_FIX", null);
        for (JsonNode coachMove : List.of(response.path("coachMove"), response.path("visibleFeedback").path("coachMove"))) {
            assertThat(coachMove.path("languageCorrections")).hasSize(1);
            assertThat(coachMove.path("languageCorrections").get(0).path("reason").asText())
                    .isEqualTo("행동 동사 writes는 will 뒤에서 원형 write로 써요.");
        }
    }

    // 명세의 한국어 이름 목록 20개 전부. ADDITIONAL_ACTION은 한 코드라서 "추가 행동"이 된다(ACTION만 바꾸지 않는다).
    @Test
    void changed_everySlotCodeBecomesItsKoreanNameFromTheSpecList() throws Exception {
        String codes = "ACTION, CHOICE, GOAL, PROBLEM, OPINION, PLAN, SOLUTION, ADVANTAGE, DISADVANTAGE, BEFORE_STATE, "
                + "NOW_STATE, CHANGE_CAUSE, ADDITIONAL_ACTION, SPECIFIC_TIME, PLACE, REASON, DETAIL, EXAMPLE, FEELING, RESULT를 모두 담았어요.";
        String names = "행동, 선택, 목표, 문제, 의견, 계획, 해결책, 장점, 단점, 이전 상태, "
                + "지금 상태, 바뀐 계기, 추가 행동, 구체적인 때, 장소, 이유, 세부 내용, 예시, 감정, 결과를 모두 담았어요.";
        OPENAI.respond(output(slotD1Verdicts(), List.of(),
                List.of(support(d1, "I will write in my journal ____.", "every night", "before bed")),
                List.of(), false, 0, List.of(codes)));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertStrength(response, names);
    }

    // 슬롯 코드가 낱말로 나올 때만 바꾼다. PLANS·REASONABLE은 슬롯 코드가 아니다.
    @Test
    void changed_onlyWholeSlotCodesAreReplaced() throws Exception {
        Map<String, Object> support = support(d1, "I will write in my journal ____.", "every night", "before bed");
        support.put("instructionKo", "PLANS나 REASONABLE 같은 영어 낱말은 그대로 두고, PLAN 하나만 더 써 보세요.");
        OPENAI.respond(output(slotD1Verdicts(), List.of(), List.of(support), List.of(), false, 0,
                List.of("계획이 분명해요.")));

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        for (JsonNode coachMove : List.of(response.path("coachMove"), response.path("visibleFeedback").path("coachMove"))) {
            assertThat(coachMove.path("instruction").asText())
                    .isEqualTo("PLANS나 REASONABLE 같은 영어 낱말은 그대로 두고, 계획 하나만 더 써 보세요.");
        }
    }

    // ================= 바뀔 동작 3: 주제 판정 이유 칸 이름 reason =================

    // 새 스키마대로 topicAssessment에 reason만 있는 출력을 계약 위반 없이 한 번에 받는다.
    // 지금 코드는 reasonKo가 없으면 "Topic assessment requires a reason"으로 다시 시도한다.
    @Test
    void changed_topicAssessmentWithOnlyTheNewReasonFieldIsAcceptedWithoutRetry() throws Exception {
        String output = output(slotD1Verdicts(), List.of(),
                List.of(support(d1, "I will write in my journal ____.", "every night", "before bed")),
                List.of(), false, 0, List.of("계획이 분명해요."),
                ordered("reason", TOPIC_REASON_EN, "status", "ON_TOPIC"));
        OPENAI.respond(output);

        ResponseEntity<String> raw = postRaw(ANSWER_SLOT_D1);

        assertThat(raw.getStatusCode()).as("body %s", raw.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(OPENAI.requestCount()).as("OpenAI requests (no contract retry)").isEqualTo(1);
        assertMission(JSON.readTree(raw.getBody()), "SLOT", d1);
    }

    // ================= 그대로 둘 동작 =================

    // 지금 동작: 주제 판정 이유가 비면 계약 위반으로 한 번 다시 시도한다. 칸 이름이 reason으로 바뀌어도 이 검사는 그대로다.
    // 다시 시도의 출력에는 새 이름과 지금 이름을 함께 넣어, 고치기 전·뒤 모두에서 회복되게 한다.
    @Test
    void kept_blankTopicReasonIsARetriedContractViolation() throws Exception {
        List<Map<String, Object>> supports = List.of(support(d1, "I will write in my journal ____.", "every night", "before bed"));
        String blankReason = output(slotD1Verdicts(), List.of(), supports, List.of(), false, 0,
                List.of("계획이 분명해요."), ordered("reason", "", "status", "ON_TOPIC"));
        String recovered = output(slotD1Verdicts(), List.of(), supports, List.of(), false, 0,
                List.of("계획이 분명해요."));
        OPENAI.respond(blankReason, recovered);

        JsonNode response = post(ANSWER_SLOT_D1);

        assertMission(response, "SLOT", d1);
        assertThat(OPENAI.requestCount()).as("OpenAI requests").isEqualTo(2);
        assertThat(OPENAI.userPromptText(1)).contains("CANONICAL_CONTRACT_RETRY");
    }

    // 주제 판정 이유는 화면에 보이지 않는다(API 응답에 없다).
    @Test
    void kept_topicReasonIsNotInTheApiResponse() throws Exception {
        OPENAI.respond(slotMissionOutput(support(d1, "I will write in my journal ____.", "every night", "before bed")));

        ResponseEntity<String> raw = postRaw(ANSWER_SLOT_D1);

        assertThat(raw.getStatusCode()).as("body %s", raw.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(raw.getBody()).doesNotContain(TOPIC_REASON_EN).doesNotContain(TOPIC_REASON_KO);
    }

    // 완료 답에 추천 표현 3개는 3개 모두 그 순서로 보인다.
    @Test
    void kept_completeAnswerKeepsThreeRefinementExpressions() throws Exception {
        OPENAI.respond(completeOutput(support(d2, "I feel ____ when I write in my journal.", "calm", "proud of myself"), 3));

        JsonNode response = post(ANSWER_COMPLETE);

        assertComplete(response, d2);
        assertThat(OPENAI.requestCount()).isEqualTo(1);
        assertThat(expressions(response.path("refinementExpressions")))
                .containsExactly("make it a habit to", "so that", "stick to");
        assertThat(expressions(response.path("visibleFeedback").path("refinementExpressions")))
                .containsExactly("make it a habit to", "so that", "stick to");
    }

    // 완료면 추천 표현 2개 이상이 필요한 백엔드 검사는 그대로: 1개면 계약 위반으로 한 번 다시 시도한다.
    @Test
    void kept_completeAnswerWithOneRefinementExpressionIsRetried() throws Exception {
        Map<String, Object> enrichment = support(d2, "I feel ____ when I write in my journal.", "calm", "proud of myself");
        OPENAI.respond(completeOutput(enrichment, 1), completeOutput(enrichment, 2));

        JsonNode response = post(ANSWER_COMPLETE);

        assertComplete(response, d2);
        assertThat(OPENAI.requestCount()).as("OpenAI requests").isEqualTo(2);
        assertThat(OPENAI.userPromptText(1)).contains("CANONICAL_CONTRACT_RETRY");
        assertThat(expressions(response.path("refinementExpressions"))).containsExactly("make it a habit to", "so that");
    }

    // ================= 준비 =================

    private Map<String, String[]> slotD1Verdicts() {
        return slots(r, "write three lines in my journal", "SATISFIED", d1, "at some point", "GENERIC");
    }

    private Map<String, String[]> completeVerdicts() {
        return slots(r, "write three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED");
    }

    private Map<String, String[]> languageFixVerdicts() {
        return slots(r, "writes three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED");
    }

    private String slotMissionOutput(Map<String, Object> missionSupport) throws Exception {
        return output(slotD1Verdicts(), List.of(), List.of(missionSupport), List.of(), false, 0,
                List.of("계획이 분명해요."));
    }

    private String completeOutput(Map<String, Object> enrichment, int refinementCount) throws Exception {
        return output(completeVerdicts(), List.of(), List.of(), List.of(enrichment), true, refinementCount,
                List.of("계획이 분명해요."));
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
            List<Map<String, Object>> revisionSteps,
            List<Map<String, Object>> missionSupport,
            List<Map<String, Object>> enrichmentSupport,
            boolean completionOutputs,
            int refinementCount,
            List<String> strengths
    ) throws Exception {
        return output(verdicts, revisionSteps, missionSupport, enrichmentSupport, completionOutputs, refinementCount,
                strengths, ordered("reason", TOPIC_REASON_EN, "reasonKo", TOPIC_REASON_KO, "status", "ON_TOPIC"));
    }

    private String output(
            Map<String, String[]> verdicts,
            List<Map<String, Object>> revisionSteps,
            List<Map<String, Object>> missionSupport,
            List<Map<String, Object>> enrichmentSupport,
            boolean completionOutputs,
            int refinementCount,
            List<String> strengths,
            Map<String, Object> topicAssessment
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
        root.put("topicAssessment", topicAssessment);
        root.put("structureAssessment", ordered("reason", "qa-057 structure reason: every segment is a sentence.",
                "status", "COMPLETE"));
        root.put("languageAssessment", ordered("revisionSteps", revisionSteps));
        root.put("slotAssessments", slotItems);
        root.put("missionSupport", missionSupport);
        root.put("enrichmentSupport", enrichmentSupport);
        root.put("modelAnswer", completionOutputs ? "I will write three lines in my journal every night at ten before bed." : "");
        root.put("modelAnswerKo", completionOutputs ? "매일 밤 열 시, 자기 전에 일기를 세 줄 쓸 거예요." : "");
        root.put("refinementExpressions", refinements(refinementCount));
        root.put("strengths", strengths);
        return JSON.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    private static Map<String, Object> step(String kind, String answerAfter, String reasonKo) {
        return ordered("kind", kind, "answerAfter", answerAfter, "reasonKo", reasonKo);
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
                        "exampleEn", "I write every night so that I remember my day."),
                ordered("expression", "stick to", "meaningKo", "~을 지키다", "guidanceKo", "계획을 지킨다는 뜻을 더해요.",
                        "exampleEn", "I will stick to writing three lines every night.")
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
        ResponseEntity<String> response = postRaw(answer);
        assertThat(response.getStatusCode())
                .as("POST /api/feedback body %s, fake OpenAI requests %s", response.getBody(), OPENAI.requestCount())
                .isEqualTo(HttpStatus.OK);
        return JSON.readTree(response.getBody());
    }

    private ResponseEntity<String> postRaw(String answer) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("promptId", PROMPT_ID);
        body.put("answer", answer);
        body.put("attemptType", "INITIAL");
        body.put("guestId", "guest-qa-057-" + UUID.randomUUID().toString().replace("-", ""));
        body.put("submissionId", "qa-057-" + UUID.randomUUID().toString().substring(0, 18));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.postForEntity("/api/feedback", new HttpEntity<>(body, headers), String.class);
    }

    private static void assertMission(JsonNode response, String focusType, String targetSlot) {
        JsonNode coachMove = response.path("coachMove");
        assertThat(response.path("loopComplete").asBoolean()).as("setup: loopComplete, body %s", response).isFalse();
        assertThat(coachMove.path("focusType").asText()).as("setup: coachMove.focusType, body %s", response)
                .isEqualTo(focusType);
        if (targetSlot != null) {
            assertThat(coachMove.path("targetSlot").asText()).as("setup: coachMove.targetSlot, body %s", response)
                    .isEqualTo(targetSlot);
        }
    }

    private static void assertComplete(JsonNode response, String enrichmentSlot) {
        assertThat(response.path("loopComplete").asBoolean()).as("setup: loopComplete, body %s", response).isTrue();
        assertThat(response.path("completion").path("enrichment").path("targetSlot").asText())
                .as("setup: completion.enrichment.targetSlot, body %s", response)
                .isEqualTo(enrichmentSlot);
    }

    private static void assertMissionPhrases(JsonNode response, String... expected) {
        assertThat(phrases(response.path("coachMove").path("suggestedPhrases")))
                .as("coachMove.suggestedPhrases")
                .containsExactly(expected);
        assertThat(phrases(response.path("visibleFeedback").path("coachMove").path("suggestedPhrases")))
                .as("visibleFeedback.coachMove.suggestedPhrases")
                .containsExactly(expected);
    }

    private static void assertEnrichmentPhrases(JsonNode response, String... expected) {
        assertThat(phrases(response.path("completion").path("enrichment").path("suggestedPhrases")))
                .as("completion.enrichment.suggestedPhrases")
                .containsExactly(expected);
        assertThat(phrases(response.path("visibleFeedback").path("completion").path("enrichment").path("suggestedPhrases")))
                .as("visibleFeedback.completion.enrichment.suggestedPhrases")
                .containsExactly(expected);
    }

    private static void assertStrength(JsonNode response, String expected) {
        assertThat(response.path("strengths")).hasSize(1);
        assertThat(response.path("strengths").get(0).asText()).as("strengths[0]").isEqualTo(expected);
        assertThat(response.path("visibleFeedback").path("strength").asText()).as("visibleFeedback.strength")
                .isEqualTo(expected);
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
                    Thread thread = new Thread(runnable, "qa-057-fake-openai");
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
