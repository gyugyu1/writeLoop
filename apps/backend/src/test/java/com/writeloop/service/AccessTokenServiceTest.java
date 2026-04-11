package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AccessTokenServiceTest {

    private AccessTokenService accessTokenService;

    @BeforeEach
    void setUp() {
        accessTokenService = new AccessTokenService(new ObjectMapper());
        ReflectionTestUtils.setField(accessTokenService, "tokenSecret", "test-secret-value");
        ReflectionTestUtils.setField(accessTokenService, "accessTokenMinutes", 15L);
    }

    @Test
    void issueAccessToken_parsesBackToUserId() {
        String token = accessTokenService.issueAccessToken(42L);

        Long userId = accessTokenService.parseUserId(token);

        assertThat(userId).isEqualTo(42L);
    }

    @Test
    void parseUserId_rejectsExpiredToken() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        String header = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(objectMapper.writeValueAsBytes(Map.of(
                        "alg", "HS256",
                        "typ", "JWT"
                )));
        String payload = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(objectMapper.writeValueAsBytes(Map.of(
                        "sub", "7",
                        "typ", "access",
                        "iat", Instant.now().minusSeconds(120).getEpochSecond(),
                        "exp", Instant.now().minusSeconds(60).getEpochSecond()
                )));
        String signature = ReflectionTestUtils.invokeMethod(accessTokenService, "sign", header + "." + payload);
        String expiredToken = header + "." + payload + "." + signature;

        assertThatThrownBy(() -> accessTokenService.parseUserId(expiredToken))
                .isInstanceOf(ApiException.class)
                .extracting("code")
                .isEqualTo("ACCESS_TOKEN_EXPIRED");
    }
}
