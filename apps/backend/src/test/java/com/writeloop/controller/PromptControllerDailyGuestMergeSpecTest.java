package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.writeloop.support.IntegrationTestSupport;
import com.writeloop.support.IntegrationTestSupportSpecTest;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 032 시나리오 B1: 게스트 추천 기록 합치기(19211af에서 고친 500)의 회귀 확인.
 * 같은 날·같은 질문의 추천 기록이 게스트 쪽과 회원 쪽에 모두 있을 때, 그 회원이 같은 guestId로 GET /api/prompts/daily를 보내면
 * 200이고, 그 뒤 그 질문의 기록은 회원 것 하나만 남고, 다시 보내도 200이다.
 * 결정 03의 격리 규칙대로 이 테스트만 쓰는 이메일과 guestId를 만들고, 자기 데이터만 확인한다. 기준 데이터는 바꾸지 않는다.
 */
class PromptControllerDailyGuestMergeSpecTest extends IntegrationTestSupport {

    private static final ZoneId KOREA = ZoneId.of("Asia/Seoul");

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Test
    void b1_memberWithTheSameGuestIdGets200AndOnlyTheMemberRecordRemains() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        String email = "qa-b1-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        long userId = insertVerifiedEmailUser(email, password, "qa-b1-" + suffix);
        String guestId = "guest-qa-b1-" + suffix;
        String promptId = jdbc.queryForObject(
                "SELECT id FROM prompts WHERE is_active = 1 AND UPPER(difficulty) = 'A' ORDER BY display_order, id LIMIT 1",
                String.class);
        String today = LocalDate.now(KOREA).toString();

        // 게스트 행이 회원 행보다 먼저 보인 것으로 둔다. 19211af의 버그는 게스트 행이 남을 행이 되어 회원 행으로 바뀔 때 생겼다.
        insertFeaturedExposure(today, null, guestId, promptId, 2);
        insertFeaturedExposure(today, userId, null, promptId, 1);
        assertThat(recordsFor(today, promptId, userId, guestId)).as("setup: guest row and member row").hasSize(2);

        String accessToken = tokenLogin(email, password);

        ResponseEntity<String> first = dailyPrompts(guestId, accessToken);
        assertThat(first.getStatusCode()).as("B1-1 first request, body %s", first.getBody()).isEqualTo(HttpStatus.OK);

        List<Map<String, Object>> remaining = recordsFor(today, promptId, userId, guestId);
        assertThat(remaining).as("B1-2 records of prompt %s today after the request, response %s", promptId, first.getBody())
                .hasSize(1);
        assertThat(((Number) remaining.get(0).get("user_id")).longValue()).as("B1-2 remaining record owner")
                .isEqualTo(userId);

        ResponseEntity<String> second = dailyPrompts(guestId, accessToken);
        assertThat(second.getStatusCode()).as("B1-3 repeated request, body %s", second.getBody()).isEqualTo(HttpStatus.OK);
    }

    // A7: 이 클래스도 같은 컨테이너를 쓰는지 기록한다.
    @Test
    void a7_seesTheSameMysqlAndRedisAsOtherIntegrationTestClasses() {
        IntegrationTestSupportSpecTest.ServerIdentity.recordAndAssertSame(getClass().getSimpleName(), jdbc, redisTemplate);
    }

    private long insertVerifiedEmailUser(String email, String password, String displayName) {
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), displayName);
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
    }

    private void insertFeaturedExposure(String date, Long userId, String guestId, String promptId, int hoursAgo) {
        jdbc.update(
                "INSERT INTO prompt_recommendation_exposures "
                        + "(recommended_date, user_id, guest_id, difficulty, prompt_id, slot_type, reason_code, score, shown_at) "
                        + "VALUES (?, ?, ?, 'A', ?, 'FEATURED', 'TOPIC_FRESH', 50, NOW(6) - INTERVAL ? HOUR)",
                date, userId, guestId, promptId, hoursAgo);
    }

    private List<Map<String, Object>> recordsFor(String date, String promptId, long userId, String guestId) {
        return jdbc.queryForList(
                "SELECT id, user_id, guest_id FROM prompt_recommendation_exposures "
                        + "WHERE recommended_date = ? AND prompt_id = ? AND (user_id = ? OR guest_id = ?)",
                date, promptId, userId, guestId);
    }

    private String tokenLogin(String email, String password) {
        ResponseEntity<Map> response = rest.postForEntity(
                "/api/auth/token/login", Map.of("email", email, "password", password), Map.class);
        assertThat(response.getStatusCode()).as("setup: token login, body %s", response.getBody()).isEqualTo(HttpStatus.OK);
        Object accessToken = response.getBody() == null ? null : response.getBody().get("accessToken");
        assertThat(accessToken).as("setup: access token").isInstanceOf(String.class);
        return (String) accessToken;
    }

    private ResponseEntity<String> dailyPrompts(String guestId, String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        return rest.exchange("/api/prompts/daily?guestId={guestId}", HttpMethod.GET, new HttpEntity<>(headers),
                String.class, guestId);
    }
}
