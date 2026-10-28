package com.writeloop.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.support.IntegrationTestSupport;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 033(버그 수정): 게스트 추천 기록을 회원으로 합칠 때의 500.
 *
 * <p>같은 날·같은 질문의 오늘의 질문 추천 기록이 게스트(guestId) 쪽과 회원 쪽에 모두 있고 게스트 행이 먼저 보인 것일 때,
 * 그 회원이 같은 guestId와 함께 요청하면 지금 코드는 500이다(유니크 키 uk_prompt_reco_daily_viewer_prompt 충돌).
 *
 * <ul>
 *   <li>R1~R3: 명세의 기대 동작(200, 그 뒤 회원 것 하나만 남음, 다시 보내도 200). 결정 03의 1에 따라 같은 합치기 코드를 지나는
 *       경로 넷(오늘의 질문, 고정 추천, 클릭 기록, 모바일 홈)마다 확인한다. 지금 코드에서 실패해야 한다.</li>
 *   <li>M1~M2: 결정 03의 2. 합친 뒤 남는 행은 회원 것이고 guest_id는 비며, 처음 본 시각·클릭 시각은 두 행 중 이른 것,
 *       세션 id는 있는 쪽 것을 갖는다. 경로 넷마다 확인한다. 지금 코드에서 실패해야 한다.</li>
 *   <li>K1~K4: "회원 행이 먼저 보인 경우와 행이 하나뿐인 경우의 동작은 그대로다"를 오늘의 질문 경로의 지금 동작으로 기록한다.
 *       지금 코드에서 통과해야 한다.</li>
 * </ul>
 *
 * <p>통합 테스트 기반은 테스트 사이에 데이터를 되돌리지 않으므로, 테스트마다 고유한 이메일과 guestId를 만들고 자기 데이터만 확인한다.
 * 기준 데이터(질문)는 읽기만 한다. 준비한 추천 기록은 그날 같은 질문을 고정 추천(FEATURED)으로 다시 내보내게 해,
 * 요청이 그 질문의 기록을 합치는 코드를 반드시 지나게 한다(클릭 기록은 그 질문 id를 직접 보낸다).
 */
class TodayQuestionRecommendationGuestMergeSpecTest extends IntegrationTestSupport {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");
    private static final ObjectMapper JSON = new ObjectMapper();

    /** 같은 합치기 코드(findOrStabilizePromptExposureForToday)를 지나는 요청 경로. */
    enum Path {
        DAILY,          // GET /api/prompts/daily
        DAILY_FEATURED, // GET /api/prompts/daily/featured
        DAILY_CLICK,    // POST /api/prompts/daily/click
        MOBILE_HOME     // GET /api/mobile/home
    }

    @Autowired
    private PasswordEncoder passwordEncoder;

    // ---- R: 명세의 기대 동작(지금 코드에서 실패해야 함) ----

    @ParameterizedTest(name = "{0}")
    @EnumSource(Path.class)
    void r1_guestRowShownFirst_memberWithTheSameGuestIdGets200(Path path) {
        Fixture f = newFixture("r1");
        f.insertExposure(null, f.guestId, 120, null, null, null);
        f.insertExposure(f.userId, null, 60, null, null, null);
        assertThat(f.records()).as("setup: guest row and member row").hasSize(2);

        ResponseEntity<String> first = send(path, f, f.login());

        assertThat(first.getStatusCode()).as("R1 %s first request, body %s", path, first.getBody())
                .isEqualTo(HttpStatus.OK);
    }

    @ParameterizedTest(name = "{0}")
    @EnumSource(Path.class)
    void r2_guestRowShownFirst_onlyTheMemberRecordRemainsAfterTheRequest(Path path) {
        Fixture f = newFixture("r2");
        f.insertExposure(null, f.guestId, 120, null, null, null);
        f.insertExposure(f.userId, null, 60, null, null, null);
        assertThat(f.records()).as("setup: guest row and member row").hasSize(2);

        ResponseEntity<String> first = send(path, f, f.login());

        List<Map<String, Object>> remaining = f.records();
        assertThat(remaining)
                .as("R2 %s records of prompt %s today after the request (status %s, body %s)",
                        path, f.promptId, first.getStatusCode(), first.getBody())
                .hasSize(1);
        assertThat(userIdOf(remaining.get(0))).as("R2 %s owner of the remaining record", path).isEqualTo(f.userId);
        assertThat(remaining.get(0).get("guest_id")).as("R2 %s guest_id of the remaining record", path).isNull();
    }

    @ParameterizedTest(name = "{0}")
    @EnumSource(Path.class)
    void r3_guestRowShownFirst_repeatedRequestAlsoGets200(Path path) {
        Fixture f = newFixture("r3");
        f.insertExposure(null, f.guestId, 120, null, null, null);
        f.insertExposure(f.userId, null, 60, null, null, null);
        assertThat(f.records()).as("setup: guest row and member row").hasSize(2);
        String accessToken = f.login();

        ResponseEntity<String> first = send(path, f, accessToken);
        ResponseEntity<String> second = send(path, f, accessToken);

        assertThat(second.getStatusCode())
                .as("R3 %s repeated request (first was %s), body %s", path, first.getStatusCode(), second.getBody())
                .isEqualTo(HttpStatus.OK);
    }

    // ---- M: 합친 뒤 남는 행의 내용(결정 03의 2, 지금 코드에서 실패해야 함) ----

    /** 게스트 행이 더 이른 처음 본 시각·클릭 시각과 세션 id를 갖고, 회원 행에는 세션 id가 없다. */
    @ParameterizedTest(name = "{0}")
    @EnumSource(Path.class)
    void m1_guestRowHasTheEarlierTimesAndTheSessions_theMergedMemberRowKeepsThem(Path path) {
        Fixture f = newFixture("m1");
        String guestStarted = "qa-sess-g-start-" + f.suffix;
        String guestCompleted = "qa-sess-g-done-" + f.suffix;
        long guestRowId = f.insertExposure(null, f.guestId, 180, 120, guestStarted, guestCompleted);
        long memberRowId = f.insertExposure(f.userId, null, 60, 30, null, null);
        assertThat(f.records()).as("setup: guest row and member row").hasSize(2);
        String guestShownAt = f.timeOf(guestRowId, "shown_at");
        String guestClickedAt = f.timeOf(guestRowId, "clicked_at");
        assertThat(guestShownAt).as("setup: guest row shown first").isLessThan(f.timeOf(memberRowId, "shown_at"));
        assertThat(guestClickedAt).as("setup: guest row clicked first").isLessThan(f.timeOf(memberRowId, "clicked_at"));

        ResponseEntity<String> response = send(path, f, f.login());

        List<Map<String, Object>> remaining = f.records();
        assertThat(remaining)
                .as("M1 %s records after the request (status %s, body %s)", path, response.getStatusCode(), response.getBody())
                .hasSize(1);
        Map<String, Object> merged = remaining.get(0);
        assertThat(userIdOf(merged)).as("M1 %s user_id", path).isEqualTo(f.userId);
        assertThat(merged.get("guest_id")).as("M1 %s guest_id", path).isNull();
        assertThat(merged.get("shown_at")).as("M1 %s shown_at = the earlier (guest row)", path).isEqualTo(guestShownAt);
        assertThat(merged.get("clicked_at")).as("M1 %s clicked_at = the earlier (guest row)", path).isEqualTo(guestClickedAt);
        assertThat(merged.get("started_session_id")).as("M1 %s started_session_id (only the guest row had one)", path)
                .isEqualTo(guestStarted);
        assertThat(merged.get("completed_session_id")).as("M1 %s completed_session_id (only the guest row had one)", path)
                .isEqualTo(guestCompleted);
    }

    /** 게스트 행이 먼저 보였지만, 클릭은 회원 행이 더 이르고 세션 id도 회원 행에만 있다. */
    @ParameterizedTest(name = "{0}")
    @EnumSource(Path.class)
    void m2_memberRowHasTheEarlierClickAndTheSessions_theMergedMemberRowKeepsThem(Path path) {
        Fixture f = newFixture("m2");
        String memberStarted = "qa-sess-m-start-" + f.suffix;
        String memberCompleted = "qa-sess-m-done-" + f.suffix;
        long guestRowId = f.insertExposure(null, f.guestId, 180, 60, null, null);
        long memberRowId = f.insertExposure(f.userId, null, 150, 90, memberStarted, memberCompleted);
        assertThat(f.records()).as("setup: guest row and member row").hasSize(2);
        String guestShownAt = f.timeOf(guestRowId, "shown_at");
        String memberClickedAt = f.timeOf(memberRowId, "clicked_at");
        assertThat(guestShownAt).as("setup: guest row shown first").isLessThan(f.timeOf(memberRowId, "shown_at"));
        assertThat(memberClickedAt).as("setup: member row clicked first").isLessThan(f.timeOf(guestRowId, "clicked_at"));

        ResponseEntity<String> response = send(path, f, f.login());

        List<Map<String, Object>> remaining = f.records();
        assertThat(remaining)
                .as("M2 %s records after the request (status %s, body %s)", path, response.getStatusCode(), response.getBody())
                .hasSize(1);
        Map<String, Object> merged = remaining.get(0);
        assertThat(userIdOf(merged)).as("M2 %s user_id", path).isEqualTo(f.userId);
        assertThat(merged.get("guest_id")).as("M2 %s guest_id", path).isNull();
        assertThat(merged.get("shown_at")).as("M2 %s shown_at = the earlier (guest row)", path).isEqualTo(guestShownAt);
        assertThat(merged.get("clicked_at")).as("M2 %s clicked_at = the earlier (member row)", path).isEqualTo(memberClickedAt);
        assertThat(merged.get("started_session_id")).as("M2 %s started_session_id (only the member row had one)", path)
                .isEqualTo(memberStarted);
        assertThat(merged.get("completed_session_id")).as("M2 %s completed_session_id (only the member row had one)", path)
                .isEqualTo(memberCompleted);
    }

    // ---- K: 오늘의 질문 경로의 지금 동작 그대로(지금 코드에서 통과해야 함) ----

    @Test
    void k1_memberRowShownFirst_keepsTheMemberRowAndRemovesTheGuestRow() {
        Fixture f = newFixture("k1");
        long memberRowId = f.insertExposure(f.userId, null, 120, null, null, null);
        f.insertExposure(null, f.guestId, 60, null, null, null);
        assertThat(f.records()).as("setup: member row and guest row").hasSize(2);
        String memberShownAt = f.timeOf(memberRowId, "shown_at");
        String accessToken = f.login();

        ResponseEntity<String> first = send(Path.DAILY, f, accessToken);
        assertThat(first.getStatusCode()).as("K1 first request, body %s", first.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(featuredPromptId(first)).as("K1 featured prompt").isEqualTo(f.promptId);

        List<Map<String, Object>> remaining = f.records();
        assertThat(remaining).as("K1 records after the first request").hasSize(1);
        assertThat(idOf(remaining.get(0))).as("K1 remaining row is the member row").isEqualTo(memberRowId);
        assertThat(userIdOf(remaining.get(0))).as("K1 remaining row user_id").isEqualTo(f.userId);
        assertThat(remaining.get(0).get("guest_id")).as("K1 remaining row guest_id").isNull();
        assertThat(remaining.get(0).get("shown_at")).as("K1 remaining row shown_at").isEqualTo(memberShownAt);

        ResponseEntity<String> second = send(Path.DAILY, f, accessToken);
        assertThat(second.getStatusCode()).as("K1 repeated request, body %s", second.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(f.records()).as("K1 records after the repeated request").hasSize(1);
    }

    @Test
    void k2_onlyGuestRow_memberWithTheSameGuestIdTakesOverThatRow() {
        Fixture f = newFixture("k2");
        long guestRowId = f.insertExposure(null, f.guestId, 120, null, null, null);
        assertThat(f.records()).as("setup: guest row only").hasSize(1);
        String guestShownAt = f.timeOf(guestRowId, "shown_at");
        String accessToken = f.login();

        ResponseEntity<String> first = send(Path.DAILY, f, accessToken);
        assertThat(first.getStatusCode()).as("K2 first request, body %s", first.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(featuredPromptId(first)).as("K2 featured prompt").isEqualTo(f.promptId);

        List<Map<String, Object>> remaining = f.records();
        assertThat(remaining).as("K2 records after the first request").hasSize(1);
        assertThat(idOf(remaining.get(0))).as("K2 remaining row is the former guest row").isEqualTo(guestRowId);
        assertThat(userIdOf(remaining.get(0))).as("K2 remaining row user_id").isEqualTo(f.userId);
        assertThat(remaining.get(0).get("guest_id")).as("K2 remaining row guest_id").isNull();
        assertThat(remaining.get(0).get("shown_at")).as("K2 remaining row shown_at").isEqualTo(guestShownAt);

        ResponseEntity<String> second = send(Path.DAILY, f, accessToken);
        assertThat(second.getStatusCode()).as("K2 repeated request, body %s", second.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(f.records()).as("K2 records after the repeated request").hasSize(1);
    }

    @Test
    void k3_onlyMemberRow_memberWithAGuestIdKeepsThatRowAsItIs() {
        Fixture f = newFixture("k3");
        long memberRowId = f.insertExposure(f.userId, null, 120, null, null, null);
        assertThat(f.records()).as("setup: member row only").hasSize(1);
        String memberShownAt = f.timeOf(memberRowId, "shown_at");
        String accessToken = f.login();

        ResponseEntity<String> first = send(Path.DAILY, f, accessToken);
        assertThat(first.getStatusCode()).as("K3 first request, body %s", first.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(featuredPromptId(first)).as("K3 featured prompt").isEqualTo(f.promptId);

        List<Map<String, Object>> remaining = f.records();
        assertThat(remaining).as("K3 records after the first request").hasSize(1);
        assertThat(idOf(remaining.get(0))).as("K3 remaining row is the member row").isEqualTo(memberRowId);
        assertThat(userIdOf(remaining.get(0))).as("K3 remaining row user_id").isEqualTo(f.userId);
        assertThat(remaining.get(0).get("guest_id")).as("K3 remaining row guest_id").isNull();
        assertThat(remaining.get(0).get("shown_at")).as("K3 remaining row shown_at").isEqualTo(memberShownAt);

        ResponseEntity<String> second = send(Path.DAILY, f, accessToken);
        assertThat(second.getStatusCode()).as("K3 repeated request, body %s", second.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(f.records()).as("K3 records after the repeated request").hasSize(1);
    }

    @Test
    void k4_onlyGuestRow_guestWithoutLoginKeepsThatRowAsItIs() {
        Fixture f = newFixture("k4");
        long guestRowId = f.insertExposure(null, f.guestId, 120, null, null, null);
        assertThat(f.records()).as("setup: guest row only").hasSize(1);
        String guestShownAt = f.timeOf(guestRowId, "shown_at");

        ResponseEntity<String> first = send(Path.DAILY, f, null);
        assertThat(first.getStatusCode()).as("K4 first request, body %s", first.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(featuredPromptId(first)).as("K4 featured prompt").isEqualTo(f.promptId);

        List<Map<String, Object>> remaining = f.records();
        assertThat(remaining).as("K4 records after the first request").hasSize(1);
        assertThat(idOf(remaining.get(0))).as("K4 remaining row is the guest row").isEqualTo(guestRowId);
        assertThat(remaining.get(0).get("user_id")).as("K4 remaining row user_id").isNull();
        assertThat(remaining.get(0).get("guest_id")).as("K4 remaining row guest_id").isEqualTo(f.guestId);
        assertThat(remaining.get(0).get("shown_at")).as("K4 remaining row shown_at").isEqualTo(guestShownAt);

        ResponseEntity<String> second = send(Path.DAILY, f, null);
        assertThat(second.getStatusCode()).as("K4 repeated request, body %s", second.getBody()).isEqualTo(HttpStatus.OK);
        assertThat(f.records()).as("K4 records after the repeated request").hasSize(1);
    }

    // ---- 요청 ----

    private ResponseEntity<String> send(Path path, Fixture f, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        if (accessToken != null) {
            headers.setBearerAuth(accessToken);
        }
        return switch (path) {
            case DAILY -> rest.exchange("/api/prompts/daily?guestId={guestId}", HttpMethod.GET,
                    new HttpEntity<>(headers), String.class, f.guestId);
            case DAILY_FEATURED -> rest.exchange("/api/prompts/daily/featured?difficulty=A&guestId={guestId}",
                    HttpMethod.GET, new HttpEntity<>(headers), String.class, f.guestId);
            case DAILY_CLICK -> {
                headers.setContentType(MediaType.APPLICATION_JSON);
                yield rest.exchange("/api/prompts/daily/click", HttpMethod.POST,
                        new HttpEntity<>(Map.of("promptId", f.promptId, "guestId", f.guestId), headers), String.class);
            }
            // 모바일 앱처럼 featuredDifficulty와 guestId를 함께 보낸다(apps/mobile/src/lib/api.ts getMobileHomeSnapshot).
            case MOBILE_HOME -> rest.exchange("/api/mobile/home?featuredDifficulty=A&guestId={guestId}", HttpMethod.GET,
                    new HttpEntity<>(headers), String.class, f.guestId);
        };
    }

    // ---- 준비와 확인 도우미 ----

    private Fixture newFixture(String label) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        String email = "qa-033-" + label + "-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-033-" + label + "-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
        String promptId = jdbc.queryForObject(
                "SELECT id FROM prompts WHERE is_active = 1 AND UPPER(difficulty) = 'A' ORDER BY display_order, id LIMIT 1",
                String.class);
        return new Fixture(suffix, email, password, userId, "guest-qa-033-" + label + "-" + suffix, promptId,
                LocalDate.now(KOREA).toString());
    }

    private final class Fixture {
        final String suffix;
        final String email;
        final String password;
        final long userId;
        final String guestId;
        final String promptId;
        final String today;

        Fixture(String suffix, String email, String password, long userId, String guestId, String promptId, String today) {
            this.suffix = suffix;
            this.email = email;
            this.password = password;
            this.userId = userId;
            this.guestId = guestId;
            this.promptId = promptId;
            this.today = today;
        }

        /**
         * 오늘 이 질문을 고정 추천(FEATURED)으로 shownMinutesAgo분 전에 보인 기록을 넣고 id를 돌려준다.
         * clickedMinutesAgo가 null이면 클릭 시각을 비운다.
         */
        long insertExposure(Long ownerUserId, String ownerGuestId, int shownMinutesAgo, Integer clickedMinutesAgo,
                            String startedSessionId, String completedSessionId) {
            jdbc.update(
                    "INSERT INTO prompt_recommendation_exposures "
                            + "(recommended_date, user_id, guest_id, difficulty, prompt_id, slot_type, reason_code, score, "
                            + "shown_at, clicked_at, started_session_id, completed_session_id) "
                            + "VALUES (?, ?, ?, 'A', ?, 'FEATURED', 'TOPIC_FRESH', 50, NOW(6) - INTERVAL ? MINUTE, "
                            + "IF(? IS NULL, NULL, NOW(6) - INTERVAL ? MINUTE), ?, ?)",
                    today, ownerUserId, ownerGuestId, promptId, shownMinutesAgo,
                    clickedMinutesAgo, clickedMinutesAgo, startedSessionId, completedSessionId);
            return jdbc.queryForObject(
                    "SELECT id FROM prompt_recommendation_exposures "
                            + "WHERE recommended_date = ? AND prompt_id = ? AND user_id <=> ? AND guest_id <=> ?",
                    Long.class, today, promptId, ownerUserId, ownerGuestId);
        }

        /** 오늘 이 질문의 기록 중 이 회원이나 이 게스트의 것. 시각은 마이크로초까지 문자열로 읽는다. */
        List<Map<String, Object>> records() {
            return jdbc.queryForList(
                    "SELECT id, user_id, guest_id, "
                            + "DATE_FORMAT(shown_at, '%Y-%m-%d %H:%i:%s.%f') AS shown_at, "
                            + "DATE_FORMAT(clicked_at, '%Y-%m-%d %H:%i:%s.%f') AS clicked_at, "
                            + "started_session_id, completed_session_id "
                            + "FROM prompt_recommendation_exposures "
                            + "WHERE recommended_date = ? AND prompt_id = ? AND (user_id = ? OR guest_id = ?) ORDER BY id",
                    today, promptId, userId, guestId);
        }

        /** column은 shown_at이나 clicked_at. */
        String timeOf(long rowId, String column) {
            return jdbc.queryForObject(
                    "SELECT DATE_FORMAT(" + column + ", '%Y-%m-%d %H:%i:%s.%f') FROM prompt_recommendation_exposures WHERE id = ?",
                    String.class, rowId);
        }

        String login() {
            ResponseEntity<Map> response = rest.postForEntity(
                    "/api/auth/token/login", Map.of("email", email, "password", password), Map.class);
            assertThat(response.getStatusCode()).as("setup: token login, body %s", response.getBody())
                    .isEqualTo(HttpStatus.OK);
            Object accessToken = response.getBody() == null ? null : response.getBody().get("accessToken");
            assertThat(accessToken).as("setup: access token").isInstanceOf(String.class);
            return (String) accessToken;
        }
    }

    private static String featuredPromptId(ResponseEntity<String> response) {
        try {
            JsonNode root = JSON.readTree(response.getBody());
            return root.path("featured").path("prompt").path("id").asText(null);
        } catch (Exception exception) {
            throw new AssertionError("response is not JSON: " + response.getBody(), exception);
        }
    }

    private static long idOf(Map<String, Object> row) {
        return ((Number) row.get("id")).longValue();
    }

    private static Long userIdOf(Map<String, Object> row) {
        Object value = row.get("user_id");
        return value == null ? null : ((Number) value).longValue();
    }
}
