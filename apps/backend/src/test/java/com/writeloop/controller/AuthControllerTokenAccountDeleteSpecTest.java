package com.writeloop.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.support.IntegrationTestSupport;
import com.writeloop.support.IntegrationTestSupportSpecTest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * [spec] 작업 032 시나리오 B2: 모바일 토큰 사용자의 회원 탈퇴(cb2641a에서 고친 401)의 회귀 확인.
 * 이메일 회원이 POST /api/auth/token/login으로 받은 액세스 토큰만(세션·쿠키 없이) Authorization: Bearer로 보내
 * DELETE /api/auth/account(확인 문구와 현재 비밀번호)를 요청하면 200이고, 그 뒤 그 사용자의 users 행이 없다.
 * 쿠키를 보내지 않도록 쿠키 저장소가 없는 JDK HttpClient로 헤더를 직접 정해 보낸다.
 * 결정 03의 격리 규칙대로 이 테스트만 쓰는 이메일을 만들고, 자기 데이터만 확인한다.
 */
class AuthControllerTokenAccountDeleteSpecTest extends IntegrationTestSupport {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Test
    void b2_tokenOnlyEmailMemberDeletesAccountWith200AndTheUserRowIsGone() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 24);
        String email = "qa-b2-" + suffix + "@example.com";
        String password = "qa-pass-" + suffix;
        jdbc.update(
                "INSERT INTO users (email, password_hash, display_name, email_verified, verified_at) VALUES (?, ?, ?, 1, NOW())",
                email, passwordEncoder.encode(password), "qa-b2-" + suffix);
        long userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);

        HttpClient client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
        assertThat(client.cookieHandler()).as("setup: no cookie store").isEmpty();

        Map<String, Object> loginBody = new LinkedHashMap<>();
        loginBody.put("email", email);
        loginBody.put("password", password);
        HttpResponse<String> login = client.send(
                HttpRequest.newBuilder(uri("/api/auth/token/login"))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(loginBody)))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).as("setup: token login, body %s", login.body()).isEqualTo(200);
        JsonNode accessToken = JSON.readTree(login.body()).get("accessToken");
        assertThat(accessToken).as("setup: access token in %s", login.body()).isNotNull();
        assertThat(accessToken.asText()).as("setup: access token").isNotBlank();

        Map<String, Object> deleteBody = new LinkedHashMap<>();
        deleteBody.put("confirmationText", "탈퇴");
        deleteBody.put("currentPassword", password);
        HttpRequest delete = HttpRequest.newBuilder(uri("/api/auth/account"))
                .header("Authorization", "Bearer " + accessToken.asText())
                .header("Content-Type", "application/json")
                .method("DELETE", HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(deleteBody)))
                .build();
        assertThat(delete.headers().map().keySet()).as("setup: only bearer and content type, no cookie")
                .containsExactlyInAnyOrder("Authorization", "Content-Type");

        HttpResponse<String> response = client.send(delete, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).as("B2-1 DELETE /api/auth/account, body %s", response.body()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Integer.class, userId))
                .as("B2-2 users row of %s", userId).isZero();
    }

    // A7: 이 클래스도 같은 컨테이너를 쓰는지 기록한다.
    @Test
    void a7_seesTheSameMysqlAndRedisAsOtherIntegrationTestClasses() {
        IntegrationTestSupportSpecTest.ServerIdentity.recordAndAssertSame(getClass().getSimpleName(), jdbc, redisTemplate);
    }

    private URI uri(String path) {
        return URI.create(rest.getRootUri() + path);
    }
}
