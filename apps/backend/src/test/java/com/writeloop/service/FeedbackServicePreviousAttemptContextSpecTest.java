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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 055 계획 ② 명세(03-지난-미션-판정-맥락/01-main-spec.md)의 기대 결과 중 FeedbackService·OpenAiFeedbackClient 경로.
 *
 * <p>실제 앱(통합 테스트 기반)에 가짜 OpenAI 서버를 붙이고 POST /api/feedback으로 첫 답→다시 쓴 답을 보낸다. 가짜 서버가 받은
 * 요청 본문(사용자 프롬프트)과 API 응답의 미션을 본다. 지난 시도의 답·미션·판정을 구현이 어디에서 읽든(저장된 피드백, 진단 로그 등)
 * 같은 방법으로 확인되도록, 앞 시도도 실제 API로 만든다. OpenAI는 부르지 않는다.
 *
 * <p>질문은 기준 데이터의 활성 질문 prompt-goal-1102(필수 슬롯 하나, 깊이 슬롯 여럿, minimumDepthSlots 1)를 읽기만 한다.
 * 슬롯 코드는 그 질문의 계약(questionContract)에서 읽는다: R = 첫 필수 슬롯, D1 = 첫 깊이 슬롯, D2 = 둘째 깊이 슬롯.
 * 테스트마다 고유한 guestId·이메일을 쓰고 자기 데이터만 확인한다.
 *
 * <p>가짜 LLM 출력은 명세의 새 모양(structureAssessment.reason, slotAssessments 항목의 reason)으로 쓴다. 지금 코드는 모르는 칸을
 * 읽지 않으므로 같은 출력이 고치기 전·뒤 모두에 쓰인다.
 *
 * <p>바뀔 동작은 이름이 changed_ 로 시작한다(지금 코드에서 실패해야 한다). 그대로 둘 동작은 kept_ 로 시작한다(지금 통과해야 한다).
 */
class FeedbackServicePreviousAttemptContextSpecTest extends IntegrationTestSupport {

    private static final String PROMPT_ID = "prompt-goal-1102";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final FakeOpenAi OPENAI = FakeOpenAi.start();

    // 첫 답: R 충족, D1 막연함, 문법 문제 없음 -> 깊이 슬롯이 하나도 충족되지 않아 내용 보충 D1(지금 순서 5단계).
    private static final String ANSWER_SLOT_D1 = "I will write three lines in my journal at some point.";
    // 첫 답: R 충족, D1 충족, 가벼운 문법 하나 -> 문장 교정(지금 순서 4단계).
    private static final String ANSWER_LANGUAGE_FIX = "I will writes three lines in my journal every night at ten.";

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

    @Autowired
    private PasswordEncoder passwordEncoder;

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

    // ================= 바뀔 동작 1: 다시 쓴 답 요청에 지난 시도 맥락 =================

    @Test
    void changed_rewriteRequestPutsPreviousAttemptBetweenPromptHintsAndLearnerAnswer() throws Exception {
        String rewrite = "I will write three lines in my journal at some point in the day.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE", List.of(),
                        slots(r, "write three lines in my journal", "SATISFIED", d1, "at some point in the day", "GENERIC"),
                        d1, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        JsonNode userPrompt = OPENAI.userPrompt(1);
        assertThat(keys(userPrompt))
                .as("rewrite user prompt keys")
                .containsExactly("question", "questionContract", "promptHints", "previousAttempt", "learnerAnswer");
        assertThat(userPrompt.path("learnerAnswer").asText()).isEqualTo(rewrite);
    }

    @Test
    void changed_previousAttemptCarriesThePreviousAnswerMissionAndEverySlotVerdictWithEvidence() throws Exception {
        String rewrite = "I will write three lines in my journal at some point in the day.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE", List.of(),
                        slots(r, "write three lines in my journal", "SATISFIED", d1, "at some point in the day", "GENERIC"),
                        d1, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        JsonNode previous = OPENAI.userPrompt(1).path("previousAttempt");
        assertThat(previous.isMissingNode()).as("previousAttempt present").isFalse();
        assertThat(textValues(previous)).as("previous answer").contains(ANSWER_SLOT_D1);
        assertThat(hasObjectWithValues(previous, "SLOT", d1))
                .as("previous mission (kind SLOT, target %s) in %s", d1, previous)
                .isTrue();
        assertThat(hasSlotEntry(previous, r, "SATISFIED", "write three lines in my journal"))
                .as("verdict of %s with evidence in %s", r, previous)
                .isTrue();
        assertThat(hasSlotEntry(previous, d1, "GENERIC", "at some point"))
                .as("verdict of %s with evidence in %s", d1, previous)
                .isTrue();
        for (String slot : contractSlots) {
            if (slot.equals(r) || slot.equals(d1)) {
                continue;
            }
            assertThat(hasSlotEntry(previous, slot, "MISSING"))
                    .as("verdict of %s in %s", slot, previous)
                    .isTrue();
        }
    }

    // 명세 "바로 앞 시도의 답·미션·판정": 세 번째 답의 맥락은 두 번째 시도의 것이다(게스트는 두 번까지라 회원으로 보낸다).
    @Test
    void changed_previousAttemptIsTheImmediatelyPrecedingAttempt() throws Exception {
        String second = "I will writes three lines in my journal every night at ten.";
        String third = "I will write three lines in my journal every night at ten.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE",
                        List.of(step("GRAMMAR_LOCAL", third)),
                        slots(r, "writes three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED"),
                        null, false),
                output("ON_TOPIC", "COMPLETE", List.of(),
                        slots(r, "write three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED"),
                        null, true)
        );
        String token = loginNewUser();
        JsonNode first = post(null, null, "INITIAL", ANSWER_SLOT_D1, token);
        assertMission(first, "SLOT", d1, "setup: first answer");
        JsonNode secondResponse = post(null, first.path("sessionId").asText(), "REWRITE", second, token);
        assertMission(secondResponse, "LANGUAGE_FIX", null, "setup: second answer");

        post(null, first.path("sessionId").asText(), "REWRITE", third, token);

        JsonNode previous = OPENAI.userPrompt(2).path("previousAttempt");
        assertThat(previous.isMissingNode()).as("previousAttempt present").isFalse();
        List<String> texts = textValues(previous);
        assertThat(texts).as("previous answer is the second attempt").contains(second);
        assertThat(texts).as("the first attempt's answer is not the previous attempt").doesNotContain(ANSWER_SLOT_D1);
        assertThat(hasObjectWithValues(previous, "LANGUAGE_FIX"))
                .as("previous mission LANGUAGE_FIX in %s", previous)
                .isTrue();
        assertThat(hasSlotEntry(previous, d1, "SATISFIED", "every night at ten"))
                .as("second attempt verdict of %s in %s", d1, previous)
                .isTrue();
    }

    // ================= 그대로 둘 동작: 첫 답 요청, 앞 판정을 읽을 수 없을 때 =================

    @Test
    void kept_firstAnswerRequestHasNoPreviousAttempt() throws Exception {
        OPENAI.respond(firstAnswerSlotD1Output());

        post(guestId(), null, "INITIAL", ANSWER_SLOT_D1, null);

        JsonNode userPrompt = OPENAI.userPrompt(0);
        assertThat(keys(userPrompt)).containsExactly("question", "questionContract", "promptHints", "learnerAnswer");
        assertThat(userPrompt.path("learnerAnswer").asText()).isEqualTo(ANSWER_SLOT_D1);
    }

    // 명세: 앞 시도의 판정을 읽을 수 없으면 previousAttempt를 넣지 않고 지금처럼 진단한다.
    // 앞 시도를 판정이 없는 저장 피드백({})으로 직접 넣는다(LLM을 거치지 않아 진단 로그도 없다).
    @Test
    void kept_previousAttemptIsOmittedWhenThePreviousVerdictsCannotBeRead() throws Exception {
        String guestId = guestId();
        String sessionId = UUID.randomUUID().toString();
        jdbc.update(
                "INSERT INTO answer_sessions (id, prompt_id, guest_id, status) VALUES (?, ?, ?, 'IN_PROGRESS')",
                sessionId, PROMPT_ID, guestId);
        jdbc.update(
                "INSERT INTO answer_attempts (session_id, attempt_no, attempt_type, submission_id, answer_text, "
                        + "feedback_summary, feedback_payload_json) VALUES (?, 1, 'INITIAL', ?, ?, 'summary', '{}')",
                sessionId, "qa-055-" + UUID.randomUUID(), ANSWER_SLOT_D1);
        String rewrite = "I will writes three lines in my journal at some point.";
        OPENAI.respond(output("ON_TOPIC", "COMPLETE",
                List.of(step("GRAMMAR_LOCAL", ANSWER_SLOT_D1)),
                slots(r, "writes three lines in my journal", "SATISFIED", d1, "at some point", "GENERIC"),
                d1, false));

        JsonNode response = post(guestId, sessionId, "REWRITE", rewrite, null);

        JsonNode userPrompt = OPENAI.userPrompt(0);
        assertThat(keys(userPrompt)).containsExactly("question", "questionContract", "promptHints", "learnerAnswer");
        assertThat(userPrompt.path("learnerAnswer").asText()).isEqualTo(rewrite);
        // 지난 미션을 모르므로 지금 순서대로: 필수 슬롯 충족, 가벼운 문법 -> 문장 교정.
        assertMission(response, "LANGUAGE_FIX", null, "rewrite without readable previous verdicts");
    }

    // ================= 바뀔 동작 2: 지난 미션 유지(백엔드 선택) =================

    // 이유를 반쯤 풀었는데(D1 막연함) 가벼운 문법이 생긴 다시 쓴 답: 지금은 문장 교정으로 넘어간다.
    @Test
    void changed_previousSlotMissionStaysWhileItsSlotIsNotSatisfiedEvenWithLocalGrammar() throws Exception {
        String rewrite = "I will writes three lines in my journal at some point in the day.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE",
                        List.of(step("GRAMMAR_LOCAL", "I will write three lines in my journal at some point in the day.")),
                        slots(r, "writes three lines in my journal", "SATISFIED", d1, "at some point in the day", "GENERIC"),
                        d1, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "SLOT", d1, "rewrite keeps the previous slot mission");
        assertThat(OPENAI.requestCount()).as("no contract retry").isEqualTo(2);
    }

    // 명세: missionSupport는 이 규칙으로 고른 슬롯에 대해 쓴다. 어긋나면(지금 순서대로 미션 설명을 비우면) 다시 시도 대상 계약 위반.
    @Test
    void changed_missingMissionSupportForTheKeptSlotIsARetriedContractViolation() throws Exception {
        String rewrite = "I will writes three lines in my journal at some point in the day.";
        List<Map<String, Object>> steps =
                List.of(step("GRAMMAR_LOCAL", "I will write three lines in my journal at some point in the day."));
        Map<String, String[]> verdicts =
                slots(r, "writes three lines in my journal", "SATISFIED", d1, "at some point in the day", "GENERIC");
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE", steps, verdicts, null, false),
                output("ON_TOPIC", "COMPLETE", steps, verdicts, d1, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertThat(OPENAI.requestCount()).as("first answer + rewrite + one contract retry").isEqualTo(3);
        assertThat(OPENAI.userPromptText(2)).contains("CANONICAL_CONTRACT_RETRY");
        assertMission(response, "SLOT", d1, "rewrite after the contract retry");
    }

    // 지난 미션 유지는 "빠진 필수 슬롯"보다 앞선다(앞 세 단계 바로 뒤).
    @Test
    void changed_previousSlotMissionStaysBeforeAMissingRequiredSlot() throws Exception {
        String rewrite = "At some point in the day I will try it.";
        Map<String, String[]> verdicts = slots(d1, "At some point in the day", "GENERIC");
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE", List.of(), verdicts, d1, false),
                // 지금 코드는 R을 고르고 D1 설명을 계약 위반으로 다시 시도한다. 다시 시도에는 R 설명을 줘서 지금 결과(SLOT R)가 보이게 한다.
                output("ON_TOPIC", "COMPLETE", List.of(), verdicts, r, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "SLOT", d1, "rewrite keeps the previous slot mission over the missing required slot");
    }

    // 결정 2(03-main-decision.md, 완료 우선): 지난 미션의 깊이 슬롯 X가 충족이 아니어도, 다른 깊이 슬롯으로 minimumDepthSlots를
    // 채워 지금 순서로 완료가 되는 답이면 완료. 지난 미션 유지는 지금 순서로도 미션이 있을 때만 그 미션을 X로 바꾼다.
    @Test
    void kept_previousDepthSlotMissionGivesWayToCompletionWhenAnotherDepthSlotMeetsTheMinimum() throws Exception {
        String rewrite = "I will write three lines in my journal at some point because it calms me down.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE", List.of(),
                        slots(r, "write three lines in my journal", "SATISFIED",
                                d1, "at some point", "GENERIC",
                                d2, "because it calms me down", "SATISFIED"),
                        d1, true)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertThat(response.path("loopComplete").asBoolean())
                .as("another depth slot meets the minimum, so the rewrite completes; body %s", response)
                .isTrue();
    }

    // 지난 미션이 문장 교정이고 문법 문제(LOCAL)가 남아 있으면, 빠진 필수 슬롯보다 문장 교정을 이어 간다.
    @Test
    void changed_previousLanguageFixStaysWhileLocalGrammarRemainsBeforeAMissingRequiredSlot() throws Exception {
        String rewrite = "I writes every night at ten.";
        OPENAI.respond(
                firstAnswerLanguageFixOutput(),
                // 지금 코드가 고를 SLOT R에 맞춘 설명을 넣어 지금 결과(SLOT R)가 보이게 한다. 문장 교정이면 백엔드가 이 설명을 쓰지 않는다.
                output("ON_TOPIC", "COMPLETE",
                        List.of(step("GRAMMAR_LOCAL", "I write every night at ten.")),
                        slots(r, "writes", "GENERIC", d1, "every night at ten", "SATISFIED"),
                        r, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_LANGUAGE_FIX, null);
        assertMission(first, "LANGUAGE_FIX", null, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "LANGUAGE_FIX", null, "rewrite keeps the previous language fix");
    }

    // ================= 그대로 둘 동작: 앞 세 단계가 앞서고, 그 밖에는 지금 순서 =================

    @Test
    void kept_blockingGrammarStillPreemptsTheKeptSlotMission() throws Exception {
        String rewrite = "I journal no write at some point.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE",
                        List.of(step("GRAMMAR_BLOCKING", "I do not write in my journal at some point.")),
                        slots(r, "journal no write", "GENERIC", d1, "at some point", "GENERIC"),
                        null, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "LANGUAGE_FIX", null, "blocking grammar");
    }

    @Test
    void kept_fragmentStillPreemptsTheKeptSlotMission() throws Exception {
        String rewrite = "Three lines in my journal at some point.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "FRAGMENT",
                        List.of(step("STRUCTURE", "I write three lines in my journal at some point.")),
                        slots(r, "Three lines in my journal", "SATISFIED", d1, "at some point", "GENERIC"),
                        null, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "LANGUAGE_FIX", null, "fragment");
    }

    @Test
    void kept_offTopicStillPreemptsTheKeptSlotMission() throws Exception {
        String rewrite = "My brother likes football very much.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("OFF_TOPIC", "COMPLETE", List.of(), slots(), r, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "TASK_RESET", r, "off topic");
    }

    // 지난 미션의 슬롯이 이제 충족이면 지금 순서대로(필수 충족, 가벼운 문법 -> 문장 교정).
    @Test
    void kept_satisfiedPreviousSlotFallsBackToTheCurrentOrder() throws Exception {
        String rewrite = "I will writes three lines in my journal every night at ten.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE",
                        List.of(step("GRAMMAR_LOCAL", "I will write three lines in my journal every night at ten.")),
                        slots(r, "writes three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED"),
                        null, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "LANGUAGE_FIX", null, "previous slot satisfied, local grammar left");
    }

    @Test
    void kept_satisfiedPreviousSlotWithNothingLeftCompletes() throws Exception {
        String rewrite = "I will write three lines in my journal every night at ten.";
        OPENAI.respond(
                firstAnswerSlotD1Output(),
                output("ON_TOPIC", "COMPLETE", List.of(),
                        slots(r, "write three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED"),
                        null, true)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_SLOT_D1, null);
        assertMission(first, "SLOT", d1, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertThat(response.path("loopComplete").asBoolean()).as("complete, body %s", response).isTrue();
    }

    // 지난 미션이 문장 교정이어도 문법 문제가 없으면 지금 순서대로(빠진 필수 슬롯 -> 내용 보충 R).
    @Test
    void kept_previousLanguageFixWithoutGrammarLeftFallsBackToTheCurrentOrder() throws Exception {
        String rewrite = "I write every night at ten.";
        OPENAI.respond(
                firstAnswerLanguageFixOutput(),
                output("ON_TOPIC", "COMPLETE", List.of(),
                        slots(r, "write", "GENERIC", d1, "every night at ten", "SATISFIED"),
                        r, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", ANSWER_LANGUAGE_FIX, null);
        assertMission(first, "LANGUAGE_FIX", null, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "SLOT", r, "previous language fix, no grammar left");
    }

    // 지난 미션이 내용 보충·문장 교정이 아니면(주제 이탈 다시 쓰기) 지금 순서대로.
    @Test
    void kept_previousTaskResetFallsBackToTheCurrentOrder() throws Exception {
        String offTopic = "My brother likes football very much.";
        String rewrite = "I will writes three lines in my journal at some point.";
        OPENAI.respond(
                output("OFF_TOPIC", "COMPLETE", List.of(), slots(), r, false),
                output("ON_TOPIC", "COMPLETE",
                        List.of(step("GRAMMAR_LOCAL", ANSWER_SLOT_D1)),
                        slots(r, "writes three lines in my journal", "SATISFIED", d1, "at some point", "GENERIC"),
                        null, false)
        );
        String guestId = guestId();
        JsonNode first = post(guestId, null, "INITIAL", offTopic, null);
        assertMission(first, "TASK_RESET", r, "setup: first answer");

        JsonNode response = post(guestId, first.path("sessionId").asText(), "REWRITE", rewrite, null);

        assertMission(response, "LANGUAGE_FIX", null, "previous task reset");
    }

    // 첫 답은 지금 순서 그대로: 필수 슬롯 충족 + 가벼운 문법 + 깊이 슬롯 미충족 -> 문장 교정.
    @Test
    void kept_firstAnswerLocalGrammarBeforeAnUnresolvedDepthSlot() throws Exception {
        OPENAI.respond(output("ON_TOPIC", "COMPLETE",
                List.of(step("GRAMMAR_LOCAL", ANSWER_SLOT_D1)),
                slots(r, "writes three lines in my journal", "SATISFIED", d1, "at some point", "GENERIC"),
                null, false));

        JsonNode response = post(guestId(), null, "INITIAL", "I will writes three lines in my journal at some point.", null);

        assertMission(response, "LANGUAGE_FIX", null, "first answer");
    }

    // 첫 답은 지금 순서 그대로: 빠진 필수 슬롯이 가벼운 문법보다 앞선다.
    @Test
    void kept_firstAnswerMissingRequiredSlotBeforeLocalGrammar() throws Exception {
        OPENAI.respond(output("ON_TOPIC", "COMPLETE",
                List.of(step("GRAMMAR_LOCAL", "I write every night at ten.")),
                slots(r, "writes", "GENERIC", d1, "every night at ten", "SATISFIED"),
                r, false));

        JsonNode response = post(guestId(), null, "INITIAL", "I writes every night at ten.", null);

        assertMission(response, "SLOT", r, "first answer");
    }

    // ================= 바뀔 동작 4의 출력 범위: 이유 칸은 진단 로그(원문)에만 =================

    @Test
    void kept_reasonTextStaysInTheRawDiagnosisLogAndNotInTheApiResponse() throws Exception {
        OPENAI.respond(firstAnswerSlotD1Output());

        ResponseEntity<String> raw = postRaw(guestId(), null, "INITIAL", ANSWER_SLOT_D1, null);

        assertThat(raw.getStatusCode()).as("body %s", raw.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(raw.getBody()).doesNotContain(STRUCTURE_REASON).doesNotContain(SLOT_REASON);
        String sessionId = JSON.readTree(raw.getBody()).path("sessionId").asText();
        String logged = jdbc.queryForObject(
                "SELECT diagnosis_response_body_json FROM feedback_diagnosis_logs WHERE session_id = ? AND attempt_no = 1",
                String.class, sessionId);
        assertThat(logged).contains(STRUCTURE_REASON).contains(SLOT_REASON);
    }

    // ================= 준비 =================

    private static final String STRUCTURE_REASON = "qa-055 structure reason: every segment has a subject and a verb.";
    private static final String SLOT_REASON = "qa-055 slot reason: the quoted span answers this slot.";

    private String firstAnswerSlotD1Output() throws Exception {
        return output("ON_TOPIC", "COMPLETE", List.of(),
                slots(r, "write three lines in my journal", "SATISFIED", d1, "at some point", "GENERIC"),
                d1, false);
    }

    private String firstAnswerLanguageFixOutput() throws Exception {
        return output("ON_TOPIC", "COMPLETE",
                List.of(step("GRAMMAR_LOCAL", "I will write three lines in my journal every night at ten.")),
                slots(r, "writes three lines in my journal", "SATISFIED", d1, "every night at ten", "SATISFIED"),
                null, false);
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
            String topicStatus,
            String structureStatus,
            List<Map<String, Object>> revisionSteps,
            Map<String, String[]> verdicts,
            String missionSupportSlot,
            boolean completionOutputs
    ) throws Exception {
        List<Map<String, Object>> slotItems = new ArrayList<>();
        for (String slot : contractSlots) {
            String[] value = verdicts.get(slot);
            slotItems.add(ordered(
                    "slot", slot,
                    "evidence", value == null ? "" : value[0],
                    "reason", SLOT_REASON,
                    "verdict", value == null ? "MISSING" : value[1]
            ));
        }
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("topicAssessment", ordered("reasonKo", "질문에 대한 답인지 본 이유예요.", "status", topicStatus));
        root.put("structureAssessment", ordered("reason", STRUCTURE_REASON, "status", structureStatus));
        root.put("languageAssessment", ordered("revisionSteps", revisionSteps));
        root.put("slotAssessments", slotItems);
        root.put("missionSupport", missionSupportSlot == null ? List.of() : List.of(support(missionSupportSlot)));
        root.put("enrichmentSupport", List.of());
        root.put("modelAnswer", completionOutputs ? "I will write three lines in my journal every night at ten before bed." : "");
        root.put("modelAnswerKo", completionOutputs ? "매일 밤 열 시, 자기 전에 일기를 세 줄 쓸 거예요." : "");
        root.put("refinementExpressions", completionOutputs ? refinements() : List.of());
        root.put("strengths", List.of("계획이 분명해요."));
        return JSON.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    private static Map<String, Object> step(String kind, String answerAfter) {
        return ordered("kind", kind, "answerAfter", answerAfter, "reasonKo", "이 부분을 고쳐야 문장이 바르게 돼요.");
    }

    private static Map<String, Object> support(String slot) {
        Map<String, Object> support = new LinkedHashMap<>();
        support.put("slot", slot);
        support.put("title", "한 가지를 더 분명하게 써 보세요");
        support.put("whyKo", "답이 더 구체적이 돼요.");
        support.put("instructionKo", "실제 계획에서 한 가지를 구체적으로 더하세요.");
        support.put("skeletonEn", "I will write in my journal ____.");
        support.put("skeletonKo", "나는 ____ 일기를 쓸 거예요.");
        support.put("suggestedPhrases", List.of(
                ordered("phrase", "every night before bed", "meaningKo", "매일 밤 자기 전에"),
                ordered("phrase", "for ten minutes", "meaningKo", "10분 동안")
        ));
        return support;
    }

    private static List<Map<String, Object>> refinements() {
        return List.of(
                ordered("expression", "make it a habit to", "meaningKo", "~을 습관으로 삼다",
                        "guidanceKo", "꾸준함을 강조해요.", "exampleEn", "I make it a habit to write before bed."),
                ordered("expression", "so that", "meaningKo", "~하도록", "guidanceKo", "목적을 이어요.",
                        "exampleEn", "I write every night so that I remember my day.")
        );
    }

    private static Map<String, Object> ordered(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int index = 0; index < keyValues.length; index += 2) {
            map.put((String) keyValues[index], keyValues[index + 1]);
        }
        return map;
    }

    private static String guestId() {
        return "guest-qa-055-" + UUID.randomUUID().toString().replace("-", "");
    }

    private String loginNewUser() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        String email = "qa-055-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-055-" + suffix);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("password", password);
        ResponseEntity<String> response = rest.postForEntity("/api/auth/token/login", json(body, null), String.class);
        assertThat(response.getStatusCode()).as("setup: token login, body %s", response.getBody()).isEqualTo(HttpStatus.OK);
        try {
            String token = JSON.readTree(response.getBody()).path("accessToken").asText();
            assertThat(token).as("setup: access token").isNotBlank();
            return token;
        } catch (IOException exception) {
            throw new UncheckedIOException(exception);
        }
    }

    private JsonNode post(String guestId, String sessionId, String attemptType, String answer, String token) throws Exception {
        ResponseEntity<String> response = postRaw(guestId, sessionId, attemptType, answer, token);
        assertThat(response.getStatusCode())
                .as("POST /api/feedback (%s) body %s, fake OpenAI requests %s", attemptType, response.getBody(),
                        OPENAI.requestCount())
                .isEqualTo(HttpStatus.OK);
        return JSON.readTree(response.getBody());
    }

    private ResponseEntity<String> postRaw(String guestId, String sessionId, String attemptType, String answer, String token) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("promptId", PROMPT_ID);
        body.put("answer", answer);
        if (sessionId != null) {
            body.put("sessionId", sessionId);
        }
        body.put("attemptType", attemptType);
        if (guestId != null) {
            body.put("guestId", guestId);
        }
        body.put("submissionId", "qa-055-" + UUID.randomUUID().toString().substring(0, 18));
        return rest.postForEntity("/api/feedback", json(body, token), String.class);
    }

    private static HttpEntity<Map<String, Object>> json(Map<String, Object> body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return new HttpEntity<>(body, headers);
    }

    private static void assertMission(JsonNode response, String focusType, String targetSlot, String label) {
        JsonNode coachMove = response.path("coachMove");
        assertThat(response.path("loopComplete").asBoolean()).as("%s: loopComplete, body %s", label, response).isFalse();
        assertThat(coachMove.path("focusType").asText()).as("%s: coachMove.focusType, body %s", label, response)
                .isEqualTo(focusType);
        if (targetSlot != null) {
            assertThat(coachMove.path("targetSlot").asText()).as("%s: coachMove.targetSlot, body %s", label, response)
                    .isEqualTo(targetSlot);
        }
    }

    private static List<String> keys(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    // 노드 아래의 모든 문자열 값(앞뒤 공백 제거).
    private static List<String> textValues(JsonNode node) {
        List<String> values = new ArrayList<>();
        collectText(node, values);
        return values;
    }

    private static void collectText(JsonNode node, List<String> values) {
        if (node == null) {
            return;
        }
        if (node.isTextual()) {
            values.add(node.asText().trim());
            return;
        }
        for (JsonNode child : node) {
            collectText(child, values);
        }
    }

    // 노드 아래에, 바로 아래 문자열 값으로 주어진 값을 모두 가진 객체가 있는가. 필드 이름은 가리지 않는다.
    private static boolean hasObjectWithValues(JsonNode node, String... values) {
        if (node == null) {
            return false;
        }
        if (node.isObject()) {
            List<String> direct = new ArrayList<>();
            node.fields().forEachRemaining(entry -> {
                if (entry.getValue().isTextual()) {
                    direct.add(entry.getValue().asText().trim());
                }
            });
            if (direct.containsAll(List.of(values))) {
                return true;
            }
        }
        for (JsonNode child : node) {
            if (hasObjectWithValues(child, values)) {
                return true;
            }
        }
        return false;
    }

    // 슬롯 판정 하나: {slot: S, verdict: V, evidence: E}처럼 한 객체에 값으로 있거나, {S: {verdict: V, evidence: E}}처럼 슬롯 이름이
    // 필드 이름인 객체 아래에 있다. 필드 이름(slot, verdict, evidence 등)은 명세에 없어 가리지 않는다.
    private static boolean hasSlotEntry(JsonNode node, String slot, String... values) {
        List<String> all = new ArrayList<>();
        all.add(slot);
        all.addAll(List.of(values));
        if (hasObjectWithValues(node, all.toArray(String[]::new))) {
            return true;
        }
        return hasSlotKeyedEntry(node, slot, values);
    }

    private static boolean hasSlotKeyedEntry(JsonNode node, String slot, String... values) {
        if (node == null) {
            return false;
        }
        if (node.isObject()) {
            JsonNode keyed = node.get(slot);
            if (keyed != null && keyed.isObject() && hasObjectWithValues(keyed, values)) {
                return true;
            }
        }
        Iterator<JsonNode> children = node.elements();
        while (children.hasNext()) {
            if (hasSlotKeyedEntry(children.next(), slot, values)) {
                return true;
            }
        }
        return false;
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
                    Thread thread = new Thread(runnable, "qa-055-fake-openai");
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

        JsonNode userPrompt(int index) throws IOException {
            return JSON.readTree(userPromptText(index));
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
