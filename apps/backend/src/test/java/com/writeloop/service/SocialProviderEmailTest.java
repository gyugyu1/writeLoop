package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 소셜 로그인은 제공자가 인증했다고 확인한 이메일만 계정 이메일로 쓴다.
 * 인증되지 않은 이메일을 받아들이면 아직 가입하지 않은 다른 사람의 이메일을 선점할 수 있다.
 */
class SocialProviderEmailTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void kakaoUsesOnlyValidAndVerifiedEmail() throws Exception {
        assertThat(KakaoOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com", "is_email_valid": true, "is_email_verified": true}
                """))).isEqualTo("user@example.com");
        assertThat(KakaoOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com", "is_email_valid": true, "is_email_verified": false}
                """))).isEmpty();
        assertThat(KakaoOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com", "is_email_valid": false, "is_email_verified": true}
                """))).isEmpty();
        assertThat(KakaoOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com"}
                """))).isEmpty();
    }

    @Test
    void googleUsesOnlyVerifiedEmail() throws Exception {
        assertThat(GoogleOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com", "email_verified": true}
                """))).isEqualTo("user@example.com");
        assertThat(GoogleOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com", "email_verified": "true"}
                """))).isEqualTo("user@example.com");
        assertThat(GoogleOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com", "email_verified": false}
                """))).isEmpty();
        assertThat(GoogleOAuthService.resolveVerifiedEmail(json("""
                {"email": "user@example.com"}
                """))).isEmpty();
    }

    private JsonNode json(String value) throws Exception {
        return objectMapper.readTree(value);
    }
}
