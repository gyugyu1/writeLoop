package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.writeloop.dto.DiaryAnswerBand;
import com.writeloop.dto.DiaryFeedbackResponseDto;
import com.writeloop.support.IntegrationTestSupport;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.IntFunction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * [spec] 작업 086 ① 룹 장부와 적립. 시나리오 02-qa-scenarios.md(A, B, C, D, E, F, G1)와
 * 결정 03-main-decision.md(M1: 다른 API·저장된 일기 피드백에는 loopPoints 키조차 없다, M2: 하루 한도는 동시 요청에도 지킨다)를
 * 실제 서버(MySQL·Redis)로 확인한다.
 *
 * <ul>
 *   <li>로그인은 따로 적지 않으면 모바일과 같은 토큰 로그인(Bearer). 테스트마다 새 사용자를 만든다.</li>
 *   <li>일기 LLM은 가짜 엔진으로 대신한다(OpenAI를 부르지 않는다).</li>
 *   <li>날짜 시나리오(E)는 테스트용 시계 빈으로 서버 시각을 바꾼다. 다른 테스트에서는 실제 시각을 쓴다.</li>
 *   <li>적립 실패(F)는 룹 잔액 표 이름을 잠깐 바꿔 실제 DB 오류를 만들고 끝에 되돌린다.</li>
 *   <li>loopPoints "없음"은 시나리오 가정 G1대로 null이거나 키가 없는 것이다(세 완료 응답). 결정 M1의 다른 API는 키가 없어야 한다.</li>
 * </ul>
 */
class LoopPointServiceSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final String PROMPT_ID = "prompt-a-1";
    private static final String LOCAL_ORIGIN = "http://localhost";
    private static final AtomicReference<Instant> FIXED_NOW = new AtomicReference<>();

    @TestConfiguration
    static class ClockConfig {
        @Bean
        Clock loopPointSpecClock() {
            return new SwitchableClock(SEOUL);
        }
    }

    /** FIXED_NOW가 비어 있으면 실제 시각, 있으면 그 시각을 돌려주는 시계. */
    static final class SwitchableClock extends Clock {
        private final ZoneId zone;

        SwitchableClock(ZoneId zone) {
            this.zone = zone;
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId newZone) {
            return new SwitchableClock(newZone);
        }

        @Override
        public Instant instant() {
            Instant fixed = FIXED_NOW.get();
            return fixed == null ? Instant.now() : fixed;
        }
    }

    @MockitoBean
    private DiaryFeedbackLlmEngine diaryEngine;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper springObjectMapper;

    private final HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @BeforeEach
    void setUpDiaryEngine() {
        FIXED_NOW.set(null);
        reset(diaryEngine);
        when(diaryEngine.isConfigured()).thenReturn(true);
        when(diaryEngine.provider()).thenReturn("openai");
        when(diaryEngine.model()).thenReturn("qa-fake-model");
        when(diaryEngine.review(any())).thenAnswer(invocation -> fakeDiaryFeedback());
    }

    @AfterEach
    void restoreClock() {
        FIXED_NOW.set(null);
    }

    // =====================================================================
    // A. 잔액 조회 API와 시작 선물
    // =====================================================================

    @Test
    void a1_firstSummaryHasStartGiftAndTodayLimits() throws Exception {
        TestUser user = newUser("a1");

        HttpResponse<String> response = summary(user.token());

        assertThat(response.statusCode()).as("A1 GET /api/loop-points, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("balance").asInt()).as("A1 balance").isEqualTo(200);
        assertThat(body.path("balance").isInt()).as("A1 balance is a number").isTrue();
        assertTodayActivity(body, "question", 0, 3, 30, "A1");
        assertTodayActivity(body, "diary", 0, 1, 30, "A1");
        assertTodayActivity(body, "nowInEnglish", 0, 5, 10, "A1");
    }

    @Test
    void a2_startGiftIsGivenOnlyOnce() throws Exception {
        TestUser user = newUser("a2");
        assertThat(balanceOf(user)).as("setup A1").isEqualTo(200);

        assertThat(balanceOf(user)).as("A2 second GET balance").isEqualTo(200);
        assertThat(balanceOf(user)).as("A2 third GET balance").isEqualTo(200);
    }

    @Test
    void a3_summaryWithoutLoginIs401AndCreatesNothing() throws Exception {
        int balancesBefore = countAll("loop_point_balances");
        int entriesBefore = countAll("loop_point_entries");

        HttpResponse<String> response = summary(null);

        assertThat(response.statusCode()).as("A3 GET without login, body %s", response.body()).isEqualTo(401);
        assertThat(countAll("loop_point_balances")).as("A3 no balance row created").isEqualTo(balancesBefore);
        assertThat(countAll("loop_point_entries")).as("A3 no entry row created").isEqualTo(entriesBefore);
    }

    @Test
    void a4_concurrentFirstSummariesGiveTheGiftOnce() throws Exception {
        TestUser user = newUser("a4");

        List<HttpResponse<String>> responses = concurrently(10, i -> summaryRequest(user.token()));

        for (HttpResponse<String> response : responses) {
            assertThat(response.statusCode()).as("A4 concurrent GET, body %s", response.body()).isEqualTo(200);
            assertThat(JSON.readTree(response.body()).path("balance").asInt()).as("A4 concurrent GET balance").isEqualTo(200);
        }
        assertThat(balanceOf(user)).as("A4 GET after concurrent GETs").isEqualTo(200);
        JsonNode created = createNie(user.token(), nieBody(newNieId(), "I am testing the gift.", null, null, null));
        assertLoopPoints(created, "nowInEnglish", 10, 210, false, "A4 first entry after concurrent GETs");
    }

    @Test
    void a5_firstEarnGivesTheGiftThenEarns() throws Exception {
        TestUser user = newUser("a5");

        HttpResponse<String> created = postNie(user.token(), nieBody(newNieId(), "My first piece.", null, null, null));

        assertThat(created.statusCode()).as("A5 POST entry, body %s", created.body()).isEqualTo(201);
        assertLoopPoints(JSON.readTree(created.body()), "nowInEnglish", 10, 210, false, "A5");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("A5 balance").isEqualTo(210);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("A5 nowInEnglish count").isEqualTo(1);
    }

    @Test
    void a6_concurrentFirstSummaryAndEarnGiveGiftOnceAndEarnOnce() throws Exception {
        TestUser user = newUser("a6");
        String entryId = newNieId();

        concurrently(2, i -> i == 0
                ? summaryRequest(user.token())
                : nieRequest(user.token(), nieBody(entryId, "Racing the summary.", null, null, null)));

        assertThat(balanceOf(user)).as("A6 balance after concurrent first GET and entry").isEqualTo(210);
    }

    @Test
    void a7_pointsArePerAccount() throws Exception {
        TestUser x = newUser("a7x");
        createNie(x.token(), nieBody(newNieId(), "X one.", null, null, null));
        createNie(x.token(), nieBody(newNieId(), "X two.", null, null, null));
        TestUser y = newUser("a7y");

        JsonNode ySummary = summaryBody(y);
        JsonNode xSummary = summaryBody(x);

        assertThat(ySummary.path("balance").asInt()).as("A7 Y balance").isEqualTo(200);
        assertThat(ySummary.at("/today/nowInEnglish/count").asLong()).as("A7 Y count").isEqualTo(0);
        assertThat(xSummary.path("balance").asInt()).as("A7 X balance").isEqualTo(220);
        assertThat(xSummary.at("/today/nowInEnglish/count").asLong()).as("A7 X count").isEqualTo(2);
    }

    @Test
    void a8_recordsFromBeforeTheFeatureAreNotCounted() throws Exception {
        TestUser user = newUser("a8");
        String today = java.time.LocalDate.now(SEOUL).toString();
        for (int i = 0; i < 3; i++) {
            jdbc.update(
                    "INSERT INTO now_in_english_entries (entry_id, user_id, entry_text, entry_date, created_at) VALUES (?, ?, ?, ?, NOW(6))",
                    newNieId(), user.id(), "old piece " + i, today);
        }
        for (int i = 0; i < 2; i++) {
            jdbc.update(
                    "INSERT INTO answer_sessions (id, prompt_id, guest_id, user_id, status) VALUES (?, ?, NULL, ?, 'COMPLETED')",
                    UUID.randomUUID().toString(), PROMPT_ID, user.id());
        }
        String diaryId = UUID.randomUUID().toString();
        jdbc.update(
                "INSERT INTO diary_entries (id, user_id, title, entry_text, language, entry_date, is_draft) VALUES (?, ?, 'old', 'Old diary text.', 'en', ?, 0)",
                diaryId, user.id(), today);
        jdbc.update(
                "INSERT INTO diary_attempts (entry_id, attempt_no, diary_text, score, feedback_summary, strengths_json, corrections_json, model_answer, rewrite_challenge) "
                        + "VALUES (?, 1, 'Old diary text.', 80, 'old', JSON_ARRAY(), JSON_ARRAY(), '', '')",
                diaryId);

        JsonNode summary = summaryBody(user);

        assertThat(summary.path("balance").asInt()).as("A8 balance").isEqualTo(200);
        assertThat(summary.at("/today/question/count").asLong()).as("A8 question count").isEqualTo(0);
        assertThat(summary.at("/today/diary/count").asLong()).as("A8 diary count").isEqualTo(0);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("A8 nowInEnglish count").isEqualTo(0);
    }

    // =====================================================================
    // B. 질문 답하기 적립
    // =====================================================================

    @Test
    void b1_b12_completingOwnSessionEarns30() throws Exception {
        TestUser user = newUser("b1");
        String sessionId = readySession(user.id(), null);

        HttpResponse<String> response = complete(sessionId, user.token(), null);

        assertThat(response.statusCode()).as("B1 complete, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("sessionId").asText()).as("B1 sessionId").isEqualTo(sessionId);
        assertThat(body.path("status").asText()).as("B1 status").isEqualTo("COMPLETED");
        assertLoopPoints(body, "question", 30, 230, false, "B1");
        assertThat(fieldNames(body)).as("B12 complete response keys").containsExactlyInAnyOrder("sessionId", "status", "loopPoints");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("B1 balance").isEqualTo(230);
        assertThat(summary.at("/today/question/count").asLong()).as("B1 question count").isEqualTo(1);
    }

    @Test
    void b2_completingAgainDoesNotEarn() throws Exception {
        TestUser user = newUser("b2");
        String sessionId = readySession(user.id(), null);
        assertThat(complete(sessionId, user.token(), null).statusCode()).as("setup B1").isEqualTo(200);

        HttpResponse<String> again = complete(sessionId, user.token(), null);

        assertThat(again.statusCode()).as("B2 second complete, body %s", again.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(again.body());
        assertThat(body.path("status").asText()).as("B2 status").isEqualTo("COMPLETED");
        assertNoLoopPoints(body, "B2");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("B2 balance").isEqualTo(230);
        assertThat(summary.at("/today/question/count").asLong()).as("B2 question count").isEqualTo(1);
    }

    @Test
    void b3_concurrentCompletesEarnOnce() throws Exception {
        TestUser user = newUser("b3");
        String sessionId = readySession(user.id(), null);

        List<HttpResponse<String>> responses = concurrently(5, i -> completeRequest(sessionId, user.token(), null));

        int earned30 = 0;
        for (HttpResponse<String> response : responses) {
            JsonNode body = parseOrNull(response.body());
            if (body != null && body.path("loopPoints").path("earned").asInt(-1) == 30) {
                earned30++;
            }
        }
        assertThat(earned30).as("B3 responses with earned 30: %s", bodies(responses)).isEqualTo(1);
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("B3 balance").isEqualTo(230);
        assertThat(summary.at("/today/question/count").asLong()).as("B3 question count").isEqualTo(1);
        assertThat(sessionStatus(sessionId)).as("B3 session status").isEqualTo("COMPLETED");
    }

    @Test
    void b4_b5_questionDailyLimitIsThree() throws Exception {
        TestUser user = newUser("b4");
        int[] expectedBalance = {230, 260, 290};

        for (int i = 0; i < 3; i++) {
            JsonNode body = completeOk(readySession(user.id(), null), user.token(), null, "B4 #" + (i + 1));
            assertLoopPoints(body, "question", 30, expectedBalance[i], false, "B4/B5 #" + (i + 1));
        }
        JsonNode fourth = completeOk(readySession(user.id(), null), user.token(), null, "B4 #4");

        assertThat(fourth.path("status").asText()).as("B4 #4 status").isEqualTo("COMPLETED");
        assertLoopPoints(fourth, "question", 0, 290, true, "B4 #4");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("B4 balance").isEqualTo(290);
        assertThat(summary.at("/today/question/count").asLong()).as("B4 question count").isEqualTo(3);
    }

    @Test
    void b6_guestCompletionDoesNotEarn() throws Exception {
        String guestId = newGuestId();
        String sessionId = readySession(null, guestId);
        int entriesBefore = countAll("loop_point_entries");
        int balancesBefore = countAll("loop_point_balances");

        HttpResponse<String> response = complete(sessionId, null, guestId);

        assertThat(response.statusCode()).as("B6 guest complete, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("status").asText()).as("B6 status").isEqualTo("COMPLETED");
        assertNoLoopPoints(body, "B6");
        assertThat(countAll("loop_point_entries")).as("B6 no ledger rows").isEqualTo(entriesBefore);
        assertThat(countAll("loop_point_balances")).as("B6 no balance rows").isEqualTo(balancesBefore);
    }

    @Test
    void b7_guestSessionCompletedAfterLoginEarns() throws Exception {
        String guestId = newGuestId();
        String sessionId = readySession(null, guestId);
        TestUser user = newUser("b7");

        JsonNode body = completeOk(sessionId, user.token(), guestId, "B7");

        assertThat(body.path("status").asText()).as("B7 status").isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("SELECT user_id FROM answer_sessions WHERE id = ?", Long.class, sessionId))
                .as("B7 session user_id").isEqualTo(user.id());
        assertLoopPoints(body, "question", 30, 230, false, "B7");
    }

    @Test
    void b8_guestCompletedSessionCompletedAgainAfterLoginDoesNotEarn() throws Exception {
        String guestId = newGuestId();
        String sessionId = readySession(null, guestId);
        assertThat(complete(sessionId, null, guestId).statusCode()).as("setup: guest completes").isEqualTo(200);
        TestUser user = newUser("b8");

        JsonNode body = completeOk(sessionId, user.token(), guestId, "B8");

        assertThat(body.path("status").asText()).as("B8 status").isEqualTo("COMPLETED");
        assertNoLoopPoints(body, "B8");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("B8 balance").isEqualTo(200);
        assertThat(summary.at("/today/question/count").asLong()).as("B8 question count").isEqualTo(0);
    }

    @Test
    void b9_notReadySessionStays409AndDoesNotEarn() throws Exception {
        TestUser user = newUser("b9");
        String sessionId = UUID.randomUUID().toString();
        jdbc.update(
                "INSERT INTO answer_sessions (id, prompt_id, guest_id, user_id, status) VALUES (?, ?, NULL, ?, 'IN_PROGRESS')",
                sessionId, PROMPT_ID, user.id());

        HttpResponse<String> response = complete(sessionId, user.token(), null);

        assertThat(response.statusCode()).as("B9 complete not-ready, body %s", response.body()).isEqualTo(409);
        assertThat(JSON.readTree(response.body()).path("code").asText()).as("B9 code").isEqualTo("ANSWER_SESSION_NOT_READY");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("B9 balance").isEqualTo(200);
        assertThat(summary.at("/today/question/count").asLong()).as("B9 question count").isEqualTo(0);
    }

    @Test
    void b10_someoneElsesSessionKeepsTheOwnershipErrorAndNobodyEarns() throws Exception {
        TestUser p = newUser("b10p");
        TestUser q = newUser("b10q");
        String sessionId = readySession(p.id(), null);

        HttpResponse<String> response = complete(sessionId, q.token(), null);

        assertThat(response.statusCode()).as("B10 Q completes P's session, body %s", response.body()).isEqualTo(403);
        assertThat(JSON.readTree(response.body()).path("code").asText()).as("B10 code").isEqualTo("SESSION_OWNERSHIP_MISMATCH");
        assertThat(sessionStatus(sessionId)).as("B10 session status unchanged").isEqualTo("READY_TO_FINISH");
        JsonNode pSummary = summaryBody(p);
        JsonNode qSummary = summaryBody(q);
        assertThat(pSummary.path("balance").asInt()).as("B10 P balance").isEqualTo(200);
        assertThat(pSummary.at("/today/question/count").asLong()).as("B10 P count").isEqualTo(0);
        assertThat(qSummary.path("balance").asInt()).as("B10 Q balance").isEqualTo(200);
        assertThat(qSummary.at("/today/question/count").asLong()).as("B10 Q count").isEqualTo(0);
    }

    @Test
    void b11_webCookieLoginCompletionEarnsTheSame() throws Exception {
        TestUser user = newUser("b11");
        String sessionId = readySession(user.id(), null);
        HttpClient web = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .cookieHandler(new CookieManager())
                .build();
        Map<String, Object> login = new LinkedHashMap<>();
        login.put("email", user.email());
        login.put("password", user.password());
        HttpResponse<String> loginResponse = web.send(
                HttpRequest.newBuilder(uri("/api/auth/login"))
                        .header("Content-Type", "application/json")
                        .header("Origin", LOCAL_ORIGIN)
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(login)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(loginResponse.statusCode()).as("setup: web login, body %s", loginResponse.body()).isEqualTo(200);

        HttpResponse<String> response = web.send(
                HttpRequest.newBuilder(uri("/api/feedback/" + sessionId + "/complete"))
                        .header("Content-Type", "application/json")
                        .header("Origin", LOCAL_ORIGIN)
                        .POST(HttpRequest.BodyPublishers.ofString("{}"))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).as("B11 web complete, body %s", response.body()).isEqualTo(200);
        assertLoopPoints(JSON.readTree(response.body()), "question", 30, 230, false, "B11");
    }

    // =====================================================================
    // C. 영어일기 적립
    // =====================================================================

    @Test
    void c1_c8_firstDiaryFeedbackEarns30AndKeepsFeedbackFields() throws Exception {
        TestUser user = newUser("c1");
        String entryId = createDiary(user.token(), "Today I walked to the park with my dog.");

        HttpResponse<String> response = diaryFeedback(user.token(), entryId, null);

        assertThat(response.statusCode()).as("C1 diary feedback, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("attemptNo").asInt()).as("C1 attemptNo").isEqualTo(1);
        assertLoopPoints(body, "diary", 30, 230, false, "C1");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("C1 balance").isEqualTo(230);
        assertThat(summary.at("/today/diary/count").asLong()).as("C1 diary count").isEqualTo(1);

        // C8: 기존 필드는 가짜 LLM 결과에서 지금 나오는 값과 같고, 더해진 키는 loopPoints뿐
        ObjectNode withoutPoints = body.deepCopy();
        withoutPoints.remove("loopPoints");
        JsonNode expected = springObjectMapper.valueToTree(
                fakeDiaryFeedback().withIdentity(entryId, 1).withFinishableFromBand());
        assertThat(withoutPoints).as("C8 feedback fields").isEqualTo(expected);
        Set<String> expectedKeys = new TreeSet<>(List.of(
                "schemaVersion", "entryId", "attemptNo", "score", "finishable", "diaryAnswerBand", "summaryKo",
                "strengths", "correctedDiary", "modelDiary", "modelDiaryKo", "fixPoints", "diaryFlow", "rewriteIdeas",
                "usedDiaryExpressions", "diaryExpressions", "nextDiaryMission", "safetyFlags", "loopPoints"));
        assertThat(new TreeSet<>(fieldNames(body))).as("C8 diary feedback keys").isEqualTo(expectedKeys);
    }

    @Test
    void c2_secondFeedbackOnTheSameDiaryDoesNotEarn() throws Exception {
        TestUser user = newUser("c2");
        String entryId = createDiary(user.token(), "I cooked pasta for dinner.");
        assertThat(diaryFeedback(user.token(), entryId, null).statusCode()).as("setup C1").isEqualTo(200);

        HttpResponse<String> second = diaryFeedback(user.token(), entryId, "I cooked spicy pasta for dinner tonight.");

        assertThat(second.statusCode()).as("C2 second feedback, body %s", second.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(second.body());
        assertThat(body.path("attemptNo").asInt()).as("C2 attemptNo").isEqualTo(2);
        assertNoLoopPoints(body, "C2");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("C2 balance").isEqualTo(230);
        assertThat(summary.at("/today/diary/count").asLong()).as("C2 diary count").isEqualTo(1);
    }

    @Test
    void c3_diaryDailyLimitIsOne() throws Exception {
        TestUser user = newUser("c3");
        String first = createDiary(user.token(), "First diary today.");
        assertThat(diaryFeedback(user.token(), first, null).statusCode()).as("setup C1").isEqualTo(200);
        String second = createDiary(user.token(), "Second diary today.");

        HttpResponse<String> response = diaryFeedback(user.token(), second, null);

        assertThat(response.statusCode()).as("C3 second diary feedback, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("attemptNo").asInt()).as("C3 attemptNo").isEqualTo(1);
        assertLoopPoints(body, "diary", 0, 230, true, "C3");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("C3 balance").isEqualTo(230);
        assertThat(summary.at("/today/diary/count").asLong()).as("C3 diary count").isEqualTo(1);
    }

    @Test
    void c4_deletingAndRewritingIsStillLimited() throws Exception {
        TestUser user = newUser("c4");
        String first = createDiary(user.token(), "A diary I will delete.");
        assertThat(diaryFeedback(user.token(), first, null).statusCode()).as("setup C1").isEqualTo(200);
        HttpResponse<String> delete = client.send(
                authed(HttpRequest.newBuilder(uri("/api/diary/entries/" + first)).DELETE(), user.token()).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(delete.statusCode()).as("setup: delete diary, body %s", delete.body()).isEqualTo(204);
        String rewritten = createDiary(user.token(), "A diary I wrote again.");

        HttpResponse<String> response = diaryFeedback(user.token(), rewritten, null);

        assertThat(response.statusCode()).as("C4 feedback, body %s", response.body()).isEqualTo(200);
        assertLoopPoints(JSON.readTree(response.body()), "diary", 0, 230, true, "C4");
        assertThat(balanceOf(user)).as("C4 balance").isEqualTo(230);
    }

    @Test
    void c5_failedFirstFeedbackDoesNotEarnAndTheSavedFirstOneDoes() throws Exception {
        TestUser user = newUser("c5");
        String entryId = createDiary(user.token(), "The LLM will fail first.");
        when(diaryEngine.review(any()))
                .thenThrow(new IllegalStateException("qa: fake LLM failure"))
                .thenAnswer(invocation -> fakeDiaryFeedback());

        HttpResponse<String> failed = diaryFeedback(user.token(), entryId, null);

        assertThat(failed.statusCode()).as("C5 failed feedback (unchanged error), body %s", failed.body()).isEqualTo(503);
        assertThat(JSON.readTree(failed.body()).path("code").asText()).as("C5 failed code").isEqualTo("DIARY_FEEDBACK_UNAVAILABLE");
        assertThat(balanceOf(user)).as("C5 balance after failure").isEqualTo(200);

        HttpResponse<String> ok = diaryFeedback(user.token(), entryId, null);

        assertThat(ok.statusCode()).as("C5 retry, body %s", ok.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(ok.body());
        assertThat(body.path("attemptNo").asInt()).as("C5 attemptNo").isEqualTo(1);
        assertLoopPoints(body, "diary", 30, 230, false, "C5");
    }

    @Test
    void c6_concurrentFirstFeedbacksEarnOnce() throws Exception {
        TestUser user = newUser("c6");
        String entryId = createDiary(user.token(), "Two requests at the same time.");
        when(diaryEngine.review(any())).thenAnswer(invocation -> {
            Thread.sleep(700);
            return fakeDiaryFeedback();
        });

        List<HttpResponse<String>> responses = concurrently(2, i -> diaryFeedbackRequest(user.token(), entryId, null));

        int earned30 = 0;
        for (HttpResponse<String> response : responses) {
            JsonNode body = parseOrNull(response.body());
            if (body != null && body.path("loopPoints").path("earned").asInt(-1) == 30) {
                earned30++;
            }
        }
        assertThat(earned30).as("C6 responses with earned 30: %s", bodies(responses)).isLessThanOrEqualTo(1);
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("C6 balance").isEqualTo(230);
        assertThat(summary.at("/today/diary/count").asLong()).as("C6 diary count").isEqualTo(1);
    }

    @Test
    void c7_otherDiaryApisAndStoredFeedbackHaveNoLoopPointsKey() throws Exception {
        TestUser user = newUser("c7");
        String entryId = createDiary(user.token(), "Checking the stored feedback.");
        HttpResponse<String> feedback = diaryFeedback(user.token(), entryId, null);
        assertThat(feedback.statusCode()).as("setup C1").isEqualTo(200);
        assertLoopPoints(JSON.readTree(feedback.body()), "diary", 30, 230, false, "setup C1");

        HttpResponse<String> one = client.send(
                authed(HttpRequest.newBuilder(uri("/api/diary/entries/" + entryId)).GET(), user.token()).build(),
                HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> list = client.send(
                authed(HttpRequest.newBuilder(uri("/api/diary/entries")).GET(), user.token()).build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(one.statusCode()).as("C7 GET entry, body %s", one.body()).isEqualTo(200);
        assertThat(list.statusCode()).as("C7 GET entries, body %s", list.body()).isEqualTo(200);
        JsonNode oneBody = JSON.readTree(one.body());
        assertThat(oneBody.path("attempts").size()).as("C7 attempts in GET entry").isEqualTo(1);
        assertThat(containsKeyAnywhere(oneBody, "loopPoints")).as("C7 GET entry has loopPoints key: %s", one.body()).isFalse();
        assertThat(containsKeyAnywhere(JSON.readTree(list.body()), "loopPoints")).as("C7 GET entries has loopPoints key: %s", list.body()).isFalse();
        String payload = jdbc.queryForObject(
                "SELECT CAST(feedback_payload_json AS CHAR) FROM diary_attempts WHERE entry_id = ? AND attempt_no = 1",
                String.class, entryId);
        assertThat(payload).as("C7 stored payload exists").isNotBlank();
        assertThat(containsKeyAnywhere(JSON.readTree(payload), "loopPoints")).as("C7 stored payload has loopPoints key: %s", payload).isFalse();
    }

    @Test
    void c9_diaryLlmSchemaHasNoLoopPoints() throws Exception {
        for (boolean includeFullDiaries : List.of(false, true)) {
            String schema = springObjectMapper.writeValueAsString(DiaryFeedbackPromptSupport.jsonSchema(includeFullDiaries));
            assertThat(schema).as("C9 diary LLM schema (includeFullDiaries=%s)", includeFullDiaries).doesNotContain("loopPoints");
        }
    }

    // =====================================================================
    // D. 지금 영어로 적립
    // =====================================================================

    @Test
    void d1_d14_newEntryEarns10AndKeepsEntryFields() throws Exception {
        TestUser user = newUser("d1");
        String entryId = newNieId();
        Instant createdAt = Instant.parse("2026-11-12T03:04:05.123Z");
        String dateKey = "2026-11-12";

        HttpResponse<String> response = postNie(user.token(), nieBody(entryId, "  I   am drinking   coffee. ", null, dateKey, createdAt));

        assertThat(response.statusCode()).as("D1/D14 POST entry status, body %s", response.body()).isEqualTo(201);
        JsonNode body = JSON.readTree(response.body());
        assertLoopPoints(body, "nowInEnglish", 10, 210, false, "D1");
        assertThat(fieldNames(body)).as("D14 keys").containsExactlyInAnyOrder(
                "id", "text", "polishedFromEntryId", "polishedFromText", "dateKey", "createdAt", "loopPoints");
        assertThat(body.path("id").asText()).as("D14 id").isEqualTo(entryId);
        assertThat(body.path("text").asText()).as("D14 text (normalized as before)").isEqualTo("I am drinking coffee.");
        assertThat(body.path("polishedFromEntryId").isNull()).as("D14 polishedFromEntryId").isTrue();
        assertThat(body.path("polishedFromText").isNull()).as("D14 polishedFromText").isTrue();
        assertThat(body.path("dateKey").asText()).as("D14 dateKey").isEqualTo(dateKey);
        JsonNode listed = firstListedEntry(user.token(), entryId);
        assertThat(body.path("createdAt")).as("D14 createdAt same as the stored entry").isEqualTo(listed.path("createdAt"));
    }

    @Test
    void d2_savingAnExistingEntryAgainDoesNotEarn() throws Exception {
        TestUser user = newUser("d2");
        String entryId = newNieId();
        createNie(user.token(), nieBody(entryId, "Original text.", null, null, null));

        HttpResponse<String> edited = postNie(user.token(), nieBody(entryId, "Edited text.", null, null, null));
        HttpResponse<String> same = postNie(user.token(), nieBody(entryId, "Edited text.", null, null, null));

        assertThat(edited.statusCode()).as("D2 edited, body %s", edited.body()).isEqualTo(201);
        assertThat(same.statusCode()).as("D2 same, body %s", same.body()).isEqualTo(201);
        assertNoLoopPoints(JSON.readTree(edited.body()), "D2 edited");
        assertNoLoopPoints(JSON.readTree(same.body()), "D2 same");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("D2 balance").isEqualTo(210);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("D2 count").isEqualTo(1);
    }

    @Test
    void d3_polishedEntryDoesNotEarn() throws Exception {
        TestUser user = newUser("d3");
        String original = newNieId();
        createNie(user.token(), nieBody(original, "I go school.", null, null, null));

        HttpResponse<String> polished = postNie(user.token(), nieBody(newNieId(), "I go to school.", original, null, null));

        assertThat(polished.statusCode()).as("D3 polished, body %s", polished.body()).isEqualTo(201);
        assertNoLoopPoints(JSON.readTree(polished.body()), "D3");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("D3 balance").isEqualTo(210);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("D3 count").isEqualTo(1);
    }

    @Test
    void d4_entryWithoutIdIsNewAndEarns() throws Exception {
        TestUser user = newUser("d4");

        HttpResponse<String> response = postNie(user.token(), nieBody(null, "No id from the app.", null, null, null));

        assertThat(response.statusCode()).as("D4 POST, body %s", response.body()).isEqualTo(201);
        assertLoopPoints(JSON.readTree(response.body()), "nowInEnglish", 10, 210, false, "D4");
    }

    @Test
    void d5_sameIdAsAnotherAccountIsNewForThisAccount() throws Exception {
        TestUser x = newUser("d5x");
        TestUser y = newUser("d5y");
        String sharedId = "now-shared-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        createNie(x.token(), nieBody(sharedId, "X wrote this.", null, null, null));

        HttpResponse<String> response = postNie(y.token(), nieBody(sharedId, "Y wrote this.", null, null, null));

        assertThat(response.statusCode()).as("D5 Y POST, body %s", response.body()).isEqualTo(201);
        assertLoopPoints(JSON.readTree(response.body()), "nowInEnglish", 10, 210, false, "D5");
    }

    @Test
    void d6_d7_syncDoesNotEarnAndSyncedEntriesAreExisting() throws Exception {
        TestUser user = newUser("d6");
        List<String> ids = List.of(newNieId(), newNieId(), newNieId());
        List<Map<String, Object>> entries = new ArrayList<>();
        for (String id : ids) {
            entries.add(nieBody(id, "Synced " + id, null, null, null));
        }

        HttpResponse<String> sync = postSync(user.token(), entries);

        assertThat(sync.statusCode()).as("D6 sync, body %s", sync.body()).isEqualTo(200);
        assertThat(JSON.readTree(sync.body()).size()).as("D6 sync list size").isEqualTo(3);
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("D6 balance").isEqualTo(200);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("D6 count").isEqualTo(0);

        HttpResponse<String> again = postNie(user.token(), nieBody(ids.get(0), "Synced " + ids.get(0), null, null, null));

        assertThat(again.statusCode()).as("D7 POST synced id, body %s", again.body()).isEqualTo(201);
        assertNoLoopPoints(JSON.readTree(again.body()), "D7");
        assertThat(balanceOf(user)).as("D7 balance").isEqualTo(200);
    }

    @Test
    void d8_nowInEnglishDailyLimitIsFive() throws Exception {
        TestUser user = newUser("d8");
        int[] expectedBalance = {210, 220, 230, 240, 250};

        for (int i = 0; i < 5; i++) {
            JsonNode body = createNie(user.token(), nieBody(newNieId(), "Piece " + i, null, null, null));
            assertLoopPoints(body, "nowInEnglish", 10, expectedBalance[i], false, "D8 #" + (i + 1));
        }
        String sixthId = newNieId();
        HttpResponse<String> sixth = postNie(user.token(), nieBody(sixthId, "Piece 6", null, null, null));

        assertThat(sixth.statusCode()).as("D8 #6 saved, body %s", sixth.body()).isEqualTo(201);
        assertLoopPoints(JSON.readTree(sixth.body()), "nowInEnglish", 0, 250, true, "D8 #6");
        assertThat(nieRows(user.id(), sixthId)).as("D8 #6 row saved").isEqualTo(1);
        assertThat(summaryBody(user).at("/today/nowInEnglish/count").asLong()).as("D8 count").isEqualTo(5);
    }

    @Test
    void d9_serverSeoulDateIsUsedNotTheAppDate() throws Exception {
        TestUser user = newUser("d9");

        HttpResponse<String> response = postNie(user.token(),
                nieBody(newNieId(), "Old date from the app.", null, "2020-01-01", Instant.parse("2020-01-01T00:00:00Z")));

        assertThat(response.statusCode()).as("D9 POST, body %s", response.body()).isEqualTo(201);
        JsonNode body = JSON.readTree(response.body());
        assertLoopPoints(body, "nowInEnglish", 10, 210, false, "D9");
        assertThat(body.path("dateKey").asText()).as("D9 dateKey kept as before").isEqualTo("2020-01-01");
        assertThat(summaryBody(user).at("/today/nowInEnglish/count").asLong()).as("D9 counted today").isEqualTo(1);
    }

    @Test
    void d10_appDateCannotDodgeTheLimit() throws Exception {
        TestUser user = newUser("d10");
        for (int i = 0; i < 5; i++) {
            createNie(user.token(), nieBody(newNieId(), "Today " + i, null, null, null));
        }
        String yesterday = java.time.LocalDate.now(SEOUL).minusDays(1).toString();

        JsonNode body = createNie(user.token(), nieBody(newNieId(), "Pretend yesterday.", null, yesterday, null));

        assertLoopPoints(body, "nowInEnglish", 0, 250, true, "D10");
    }

    @Test
    void d11_concurrentSavesOfTheSameNewEntryEarnOnce() throws Exception {
        TestUser user = newUser("d11");
        String entryId = newNieId();

        concurrently(3, i -> nieRequest(user.token(), nieBody(entryId, "Same piece at once.", null, null, null)));

        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("D11 balance").isEqualTo(210);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("D11 count").isEqualTo(1);
        assertThat(nieRows(user.id(), entryId)).as("D11 entry rows").isEqualTo(1);
    }

    @Test
    void d12_invalidEntryStays400AndDoesNotEarn() throws Exception {
        TestUser user = newUser("d12");

        HttpResponse<String> response = postNie(user.token(), nieBody(newNieId(), "   ", null, null, null));

        assertThat(response.statusCode()).as("D12 blank text, body %s", response.body()).isEqualTo(400);
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("D12 balance").isEqualTo(200);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("D12 count").isEqualTo(0);
    }

    @Test
    void d13_listAndSyncResponsesHaveNoLoopPointsKey() throws Exception {
        TestUser user = newUser("d13");
        String entryId = newNieId();
        assertLoopPoints(createNie(user.token(), nieBody(entryId, "Listed piece.", null, null, null)),
                "nowInEnglish", 10, 210, false, "setup D1");

        HttpResponse<String> list = client.send(
                authed(HttpRequest.newBuilder(uri("/api/now-in-english/entries")).GET(), user.token()).build(),
                HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> sync = postSync(user.token(), List.of(nieBody(newNieId(), "Synced piece.", null, null, null)));

        assertThat(list.statusCode()).as("D13 list, body %s", list.body()).isEqualTo(200);
        assertThat(sync.statusCode()).as("D13 sync, body %s", sync.body()).isEqualTo(200);
        JsonNode listBody = JSON.readTree(list.body());
        JsonNode syncBody = JSON.readTree(sync.body());
        assertThat(listBody.size()).as("D13 list size").isEqualTo(1);
        assertThat(syncBody.size()).as("D13 sync size").isEqualTo(2);
        for (JsonNode item : listBody) {
            assertThat(fieldNames(item)).as("D13 list item keys").containsExactlyInAnyOrder(
                    "id", "text", "polishedFromEntryId", "polishedFromText", "dateKey", "createdAt");
        }
        for (JsonNode item : syncBody) {
            assertThat(fieldNames(item)).as("D13 sync item keys").containsExactlyInAnyOrder(
                    "id", "text", "polishedFromEntryId", "polishedFromText", "dateKey", "createdAt");
        }
    }

    @Test
    void m2_dailyLimitHoldsUnderConcurrentDifferentEntries() throws Exception {
        TestUser user = newUser("m2");
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            ids.add(newNieId());
        }

        List<HttpResponse<String>> responses = concurrently(8,
                i -> nieRequest(user.token(), nieBody(ids.get(i), "Concurrent piece " + i, null, null, null)));

        int earned10 = 0;
        int limited = 0;
        for (HttpResponse<String> response : responses) {
            assertThat(response.statusCode()).as("M2 each entry saved, body %s", response.body()).isEqualTo(201);
            JsonNode points = JSON.readTree(response.body()).path("loopPoints");
            if (points.path("earned").asInt(-1) == 10 && !points.path("dailyLimitReached").asBoolean(true)) {
                earned10++;
            } else if (points.path("earned").asInt(-1) == 0 && points.path("dailyLimitReached").asBoolean(false)) {
                limited++;
            }
        }
        assertThat(earned10).as("M2 responses with earned 10: %s", bodies(responses)).isEqualTo(5);
        assertThat(limited).as("M2 responses with earned 0 and dailyLimitReached: %s", bodies(responses)).isEqualTo(3);
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("M2 balance").isEqualTo(250);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("M2 count").isEqualTo(5);
    }

    // =====================================================================
    // E. 하루 합계, 날짜 경계
    // =====================================================================

    @Test
    void e1_dailyMaximumIs170() throws Exception {
        TestUser user = newUser("e1");
        for (int i = 0; i < 3; i++) {
            completeOk(readySession(user.id(), null), user.token(), null, "E1 question #" + (i + 1));
        }
        assertThat(diaryFeedback(user.token(), createDiary(user.token(), "E1 diary."), null).statusCode()).as("E1 diary").isEqualTo(200);
        for (int i = 0; i < 5; i++) {
            createNie(user.token(), nieBody(newNieId(), "E1 piece " + i, null, null, null));
        }

        JsonNode extraQuestion = completeOk(readySession(user.id(), null), user.token(), null, "E1 extra question");
        HttpResponse<String> extraDiary = diaryFeedback(user.token(), createDiary(user.token(), "E1 extra diary."), null);
        JsonNode extraPiece = createNie(user.token(), nieBody(newNieId(), "E1 extra piece", null, null, null));

        assertLoopPoints(extraQuestion, "question", 0, 370, true, "E1 extra question");
        assertThat(extraDiary.statusCode()).as("E1 extra diary, body %s", extraDiary.body()).isEqualTo(200);
        assertLoopPoints(JSON.readTree(extraDiary.body()), "diary", 0, 370, true, "E1 extra diary");
        assertLoopPoints(extraPiece, "nowInEnglish", 0, 370, true, "E1 extra piece");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("E1 balance").isEqualTo(370);
        assertThat(summary.at("/today/question/count").asLong()).as("E1 question count").isEqualTo(3);
        assertThat(summary.at("/today/diary/count").asLong()).as("E1 diary count").isEqualTo(1);
        assertThat(summary.at("/today/nowInEnglish/count").asLong()).as("E1 nowInEnglish count").isEqualTo(5);
    }

    @Test
    void e2_yesterdaysEarningsDoNotCountToday() throws Exception {
        TestUser user = newUser("e2");
        FIXED_NOW.set(Instant.parse("2031-03-10T03:00:00Z")); // 서울 3월 10일 12:00
        for (int i = 0; i < 5; i++) {
            createNie(user.token(), nieBody(newNieId(), "Yesterday " + i, null, null, null));
        }
        FIXED_NOW.set(Instant.parse("2031-03-11T03:00:00Z")); // 서울 3월 11일 12:00

        JsonNode body = createNie(user.token(), nieBody(newNieId(), "Today first.", null, null, null));

        assertLoopPoints(body, "nowInEnglish", 10, 260, false, "E2");
        assertThat(summaryBody(user).at("/today/nowInEnglish/count").asLong()).as("E2 today count").isEqualTo(1);
    }

    @Test
    void e3_seoulMidnightSplitsTheDays() throws Exception {
        TestUser user = newUser("e3");
        FIXED_NOW.set(Instant.parse("2031-05-01T14:59:00Z")); // 서울 5월 1일 23:59
        for (int i = 0; i < 5; i++) {
            createNie(user.token(), nieBody(newNieId(), "Late night " + i, null, null, null));
        }
        JsonNode limited = createNie(user.token(), nieBody(newNieId(), "Late night limit", null, null, null));
        assertLoopPoints(limited, "nowInEnglish", 0, 250, true, "E3 23:59 over the limit");
        FIXED_NOW.set(Instant.parse("2031-05-01T15:00:00Z")); // 서울 5월 2일 00:00

        JsonNode body = createNie(user.token(), nieBody(newNieId(), "Just after midnight.", null, null, null));

        assertLoopPoints(body, "nowInEnglish", 10, 260, false, "E3 00:00");
        assertThat(summaryBody(user).at("/today/nowInEnglish/count").asLong()).as("E3 today count").isEqualTo(1);
    }

    @Test
    void e4_activitiesLimitedYesterdayDoNotEarnLater() throws Exception {
        TestUser user = newUser("e4");
        FIXED_NOW.set(Instant.parse("2031-07-20T03:00:00Z")); // 서울 7월 20일
        String firstDiary = createDiary(user.token(), "E4 first diary.");
        assertThat(diaryFeedback(user.token(), firstDiary, null).statusCode()).as("setup: first diary").isEqualTo(200);
        String limitedDiary = createDiary(user.token(), "E4 limited diary.");
        HttpResponse<String> limitedFeedback = diaryFeedback(user.token(), limitedDiary, null);
        assertLoopPoints(JSON.readTree(limitedFeedback.body()), "diary", 0, 230, true, "setup C3");
        for (int i = 0; i < 3; i++) {
            completeOk(readySession(user.id(), null), user.token(), null, "setup question #" + (i + 1));
        }
        String limitedSession = readySession(user.id(), null);
        assertLoopPoints(completeOk(limitedSession, user.token(), null, "setup question #4"), "question", 0, 320, true, "setup B4 #4");
        FIXED_NOW.set(Instant.parse("2031-07-21T03:00:00Z")); // 서울 7월 21일

        HttpResponse<String> nextDayDiary = diaryFeedback(user.token(), limitedDiary, "E4 limited diary, rewritten the next day.");
        JsonNode nextDaySession = completeOk(limitedSession, user.token(), null, "E4 next day complete again");

        assertThat(nextDayDiary.statusCode()).as("E4 next day diary feedback, body %s", nextDayDiary.body()).isEqualTo(200);
        assertNoLoopPoints(JSON.readTree(nextDayDiary.body()), "E4 diary");
        assertNoLoopPoints(nextDaySession, "E4 session");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("E4 balance").isEqualTo(320);
        assertThat(summary.at("/today/diary/count").asLong()).as("E4 next day diary count").isEqualTo(0);
        assertThat(summary.at("/today/question/count").asLong()).as("E4 next day question count").isEqualTo(0);
    }

    // =====================================================================
    // F. 적립 실패가 원래 활동을 깨지 않음
    // =====================================================================

    @Test
    void f1_completionSucceedsWhenEarningFails() throws Exception {
        TestUser user = newUser("f1");
        String sessionId = readySession(user.id(), null);

        HttpResponse<String> response = withBrokenLedger(() -> complete(sessionId, user.token(), null));

        assertThat(response.statusCode()).as("F1 complete, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("status").asText()).as("F1 status").isEqualTo("COMPLETED");
        assertNoLoopPoints(body, "F1");
        assertThat(sessionStatus(sessionId)).as("F1 session really COMPLETED in DB").isEqualTo("COMPLETED");
        JsonNode summary = summaryBody(user);
        assertThat(summary.path("balance").asInt()).as("F1 balance after restore").isEqualTo(200);
        assertThat(summary.at("/today/question/count").asLong()).as("F1 question count").isEqualTo(0);
    }

    @Test
    void f2_diaryFeedbackSucceedsWhenEarningFails() throws Exception {
        TestUser user = newUser("f2");
        String entryId = createDiary(user.token(), "Earning will fail for this diary.");

        HttpResponse<String> response = withBrokenLedger(() -> diaryFeedback(user.token(), entryId, null));

        assertThat(response.statusCode()).as("F2 diary feedback, body %s", response.body()).isEqualTo(200);
        JsonNode body = JSON.readTree(response.body());
        assertThat(body.path("attemptNo").asInt()).as("F2 attemptNo").isEqualTo(1);
        assertThat(body.path("summaryKo").asText()).as("F2 feedback content").isEqualTo(fakeDiaryFeedback().summaryKo());
        assertNoLoopPoints(body, "F2");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM diary_attempts WHERE entry_id = ? AND attempt_no = 1", Integer.class, entryId))
                .as("F2 attempt 1 saved").isEqualTo(1);
    }

    @Test
    void f3_entrySaveSucceedsWhenEarningFails() throws Exception {
        TestUser user = newUser("f3");
        String entryId = newNieId();

        HttpResponse<String> response = withBrokenLedger(() -> postNie(user.token(), nieBody(entryId, "Earning fails.", null, null, null)));

        assertThat(response.statusCode()).as("F3 POST entry, body %s", response.body()).isEqualTo(201);
        assertNoLoopPoints(JSON.readTree(response.body()), "F3");
        assertThat(nieRows(user.id(), entryId)).as("F3 entry row saved").isEqualTo(1);
    }

    // =====================================================================
    // G1. 회원 탈퇴
    // =====================================================================

    @Test
    void g1_accountDeletionRemovesOnlyThatUsersPoints() throws Exception {
        TestUser x = newUser("g1x");
        TestUser y = newUser("g1y");
        createNie(x.token(), nieBody(newNieId(), "X piece one.", null, null, null));
        createNie(x.token(), nieBody(newNieId(), "X piece two.", null, null, null));
        createNie(y.token(), nieBody(newNieId(), "Y piece.", null, null, null));
        assertThat(rowsOf("loop_point_entries", x.id())).as("setup: X has ledger rows").isGreaterThan(0);

        Map<String, Object> deleteBody = new LinkedHashMap<>();
        deleteBody.put("confirmationText", "탈퇴");
        deleteBody.put("currentPassword", x.password());
        HttpResponse<String> delete = client.send(
                HttpRequest.newBuilder(uri("/api/auth/account"))
                        .header("Authorization", "Bearer " + x.token())
                        .header("Content-Type", "application/json")
                        .method("DELETE", HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(deleteBody)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());

        assertThat(delete.statusCode()).as("G1 DELETE /api/auth/account, body %s", delete.body()).isEqualTo(200);
        assertThat(rowsOf("loop_point_entries", x.id())).as("G1 X ledger rows").isZero();
        assertThat(rowsOf("loop_point_balances", x.id())).as("G1 X balance rows").isZero();
        assertThat(rowsOf("loop_point_balances", y.id())).as("G1 Y balance row").isEqualTo(1);
        assertThat(balanceOf(y)).as("G1 Y balance").isEqualTo(210);
    }

    // =====================================================================
    // 도움 함수
    // =====================================================================

    private static DiaryFeedbackResponseDto fakeDiaryFeedback() {
        return new DiaryFeedbackResponseDto(
                "diary-feedback-v1",
                null,
                0,
                82,
                false,
                DiaryAnswerBand.DIARY_CLEAR_BASIC,
                "흐름이 자연스러운 일기예요.",
                List.of("Clear order of events."),
                "",
                "",
                "",
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    private void assertLoopPoints(JsonNode body, String activity, int earned, int balance, boolean limitReached, String label) {
        JsonNode points = body.path("loopPoints");
        assertThat(points.isObject()).as("%s loopPoints is an object, body %s", label, body).isTrue();
        assertThat(points.path("activity").asText()).as("%s loopPoints.activity", label).isEqualTo(activity);
        assertThat(points.path("earned").isInt()).as("%s loopPoints.earned is a number", label).isTrue();
        assertThat(points.path("earned").asInt()).as("%s loopPoints.earned", label).isEqualTo(earned);
        assertThat(points.path("balance").asInt()).as("%s loopPoints.balance", label).isEqualTo(balance);
        assertThat(points.path("dailyLimitReached").isBoolean()).as("%s loopPoints.dailyLimitReached is a boolean", label).isTrue();
        assertThat(points.path("dailyLimitReached").asBoolean()).as("%s loopPoints.dailyLimitReached", label).isEqualTo(limitReached);
    }

    private void assertNoLoopPoints(JsonNode body, String label) {
        JsonNode points = body.path("loopPoints");
        assertThat(points.isNull() || points.isMissingNode()).as("%s loopPoints is null or absent, body %s", label, body).isTrue();
    }

    private void assertTodayActivity(JsonNode summary, String key, long count, int limit, int points, String label) {
        JsonNode node = summary.path("today").path(key);
        assertThat(node.path("count").asLong(-1)).as("%s today.%s.count", label, key).isEqualTo(count);
        assertThat(node.path("limit").asInt(-1)).as("%s today.%s.limit", label, key).isEqualTo(limit);
        assertThat(node.path("points").asInt(-1)).as("%s today.%s.points", label, key).isEqualTo(points);
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        Iterator<String> iterator = node.fieldNames();
        iterator.forEachRemaining(names::add);
        return names;
    }

    private static boolean containsKeyAnywhere(JsonNode node, String key) {
        if (node == null) {
            return false;
        }
        if (node.isObject()) {
            if (node.has(key)) {
                return true;
            }
            for (JsonNode child : node) {
                if (containsKeyAnywhere(child, key)) {
                    return true;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                if (containsKeyAnywhere(child, key)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static JsonNode parseOrNull(String body) {
        try {
            return body == null || body.isBlank() ? null : JSON.readTree(body);
        } catch (Exception exception) {
            return null;
        }
    }

    private static List<String> bodies(List<HttpResponse<String>> responses) {
        return responses.stream().map(r -> r.statusCode() + " " + r.body()).toList();
    }

    private record TestUser(long id, String email, String password, String token) {
    }

    private TestUser newUser(String tag) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String email = "qa-086-" + tag + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-086-" + tag + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        return new TestUser(userId, email, password, tokenLogin(email, password));
    }

    private String tokenLogin(String email, String password) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("email", email);
        body.put("password", password);
        HttpResponse<String> login = client.send(
                HttpRequest.newBuilder(uri("/api/auth/token/login"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).as("setup: token login, body %s", login.body()).isEqualTo(200);
        String token = JSON.readTree(login.body()).path("accessToken").asText();
        assertThat(token).as("setup: access token").isNotBlank();
        return token;
    }

    private static String newGuestId() {
        return "guest-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
    }

    private static String newNieId() {
        return "now-qa-" + UUID.randomUUID().toString().replace("-", "").substring(0, 24);
    }

    /** 지금 완료 조건(세션 READY_TO_FINISH, 마지막 시도 스냅샷 READY_TO_FINISH)을 만족하는 세션을 넣는다. */
    private String readySession(Long userId, String guestId) {
        String sessionId = UUID.randomUUID().toString();
        jdbc.update(
                "INSERT INTO answer_sessions (id, prompt_id, guest_id, user_id, status) VALUES (?, ?, ?, ?, 'READY_TO_FINISH')",
                sessionId, PROMPT_ID, guestId, userId);
        jdbc.update(
                "INSERT INTO answer_attempts (session_id, attempt_no, attempt_type, answer_text, feedback_summary, visible_feedback_snapshot_json) "
                        + "VALUES (?, 1, 'INITIAL', 'I like reading books.', 'ready', ?)",
                sessionId, "{\"schemaVersion\":1,\"state\":\"READY_TO_FINISH\"}");
        return sessionId;
    }

    private String sessionStatus(String sessionId) {
        return jdbc.queryForObject("SELECT status FROM answer_sessions WHERE id = ?", String.class, sessionId);
    }

    private int countAll(String table) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    }

    private int rowsOf(String table, long userId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM " + table + " WHERE user_id = ?", Integer.class, userId);
    }

    private int nieRows(long userId, String entryId) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM now_in_english_entries WHERE user_id = ? AND entry_id = ?", Integer.class, userId, entryId);
    }

    /** 룹 잔액 표 이름을 잠깐 바꿔 적립만 실제 DB 오류로 실패하게 하고, 끝나면 되돌린다. */
    private <T> T withBrokenLedger(Callable<T> action) throws Exception {
        jdbc.execute("RENAME TABLE loop_point_balances TO loop_point_balances_qa_off");
        try {
            return action.call();
        } finally {
            jdbc.execute("RENAME TABLE loop_point_balances_qa_off TO loop_point_balances");
        }
    }

    private HttpRequest.Builder authed(HttpRequest.Builder builder, String token) {
        if (token != null) {
            builder.header("Authorization", "Bearer " + token);
        }
        return builder;
    }

    private HttpRequest summaryRequest(String token) {
        return authed(HttpRequest.newBuilder(uri("/api/loop-points")).GET(), token).build();
    }

    private HttpResponse<String> summary(String token) throws Exception {
        return client.send(summaryRequest(token), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode summaryBody(TestUser user) throws Exception {
        HttpResponse<String> response = summary(user.token());
        assertThat(response.statusCode()).as("GET /api/loop-points, body %s", response.body()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private int balanceOf(TestUser user) throws Exception {
        return summaryBody(user).path("balance").asInt();
    }

    private HttpRequest completeRequest(String sessionId, String token, String guestId) {
        String body;
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            if (guestId != null) {
                map.put("guestId", guestId);
            }
            body = JSON.writeValueAsString(map);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
        return authed(HttpRequest.newBuilder(uri("/api/feedback/" + sessionId + "/complete"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)), token).build();
    }

    private HttpResponse<String> complete(String sessionId, String token, String guestId) throws Exception {
        return client.send(completeRequest(sessionId, token, guestId), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode completeOk(String sessionId, String token, String guestId, String label) throws Exception {
        HttpResponse<String> response = complete(sessionId, token, guestId);
        assertThat(response.statusCode()).as("%s complete, body %s", label, response.body()).isEqualTo(200);
        return JSON.readTree(response.body());
    }

    private String createDiary(String token, String content) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("title", "QA diary");
        body.put("content", content);
        body.put("language", "en");
        body.put("draft", true);
        HttpResponse<String> response = client.send(
                authed(HttpRequest.newBuilder(uri("/api/diary/entries"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))), token).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as("setup: create diary, body %s", response.body()).isEqualTo(201);
        return JSON.readTree(response.body()).path("entryId").asText();
    }

    private HttpRequest diaryFeedbackRequest(String token, String entryId, String bodyText) {
        String body;
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            if (bodyText != null) {
                map.put("bodyText", bodyText);
            }
            body = JSON.writeValueAsString(map);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
        return authed(HttpRequest.newBuilder(uri("/api/diary/entries/" + entryId + "/feedback"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)), token).build();
    }

    private HttpResponse<String> diaryFeedback(String token, String entryId, String bodyText) throws Exception {
        return client.send(diaryFeedbackRequest(token, entryId, bodyText), HttpResponse.BodyHandlers.ofString());
    }

    private static Map<String, Object> nieBody(String id, String text, String polishedFrom, String dateKey, Instant createdAt) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (id != null) {
            body.put("id", id);
        }
        body.put("text", text);
        if (polishedFrom != null) {
            body.put("polishedFromEntryId", polishedFrom);
            body.put("polishedFromText", "original text");
        }
        if (dateKey != null) {
            body.put("dateKey", dateKey);
        }
        if (createdAt != null) {
            body.put("createdAt", createdAt.toString());
        }
        return body;
    }

    private HttpRequest nieRequest(String token, Map<String, Object> body) {
        try {
            return authed(HttpRequest.newBuilder(uri("/api/now-in-english/entries"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))), token).build();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private HttpResponse<String> postNie(String token, Map<String, Object> body) throws Exception {
        return client.send(nieRequest(token, body), HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode createNie(String token, Map<String, Object> body) throws Exception {
        HttpResponse<String> response = postNie(token, body);
        assertThat(response.statusCode()).as("POST now-in-english entry, body %s", response.body()).isEqualTo(201);
        return JSON.readTree(response.body());
    }

    private HttpResponse<String> postSync(String token, List<Map<String, Object>> entries) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("entries", entries);
        return client.send(
                authed(HttpRequest.newBuilder(uri("/api/now-in-english/entries/sync"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body))), token).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private JsonNode firstListedEntry(String token, String entryId) throws Exception {
        HttpResponse<String> list = client.send(
                authed(HttpRequest.newBuilder(uri("/api/now-in-english/entries")).GET(), token).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(list.statusCode()).as("GET now-in-english entries, body %s", list.body()).isEqualTo(200);
        for (JsonNode item : JSON.readTree(list.body())) {
            if (entryId.equals(item.path("id").asText())) {
                return item;
            }
        }
        throw new AssertionError("entry " + entryId + " not listed: " + list.body());
    }

    /** 요청 n개를 한꺼번에 출발시켜 응답을 모은다. */
    private List<HttpResponse<String>> concurrently(int n, IntFunction<HttpRequest> requestFor) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            CountDownLatch ready = new CountDownLatch(n);
            CountDownLatch start = new CountDownLatch(1);
            List<Future<HttpResponse<String>>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                HttpRequest request = requestFor.apply(i);
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    return client.send(request, HttpResponse.BodyHandlers.ofString());
                }));
            }
            ready.await(10, TimeUnit.SECONDS);
            start.countDown();
            List<HttpResponse<String>> responses = new ArrayList<>();
            for (Future<HttpResponse<String>> future : futures) {
                responses.add(future.get(90, TimeUnit.SECONDS));
            }
            return responses;
        } finally {
            pool.shutdownNow();
        }
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
