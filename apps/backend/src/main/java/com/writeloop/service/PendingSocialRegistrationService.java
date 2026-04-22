package com.writeloop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PendingSocialRegistrationService {

    private static final String PENDING_SOCIAL_REGISTRATION_KEY_PREFIX = "auth:social:pending:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.auth.pending-social-registration-minutes:10}")
    private long pendingSocialRegistrationMinutes;

    public String issue(PendingSocialRegistrationSession session) {
        Duration ttl = Duration.ofMinutes(Math.max(1, pendingSocialRegistrationMinutes));
        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        try {
            redisTemplate.opsForValue().set(
                    buildTokenKey(token),
                    objectMapper.writeValueAsString(session),
                    ttl
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize pending social registration", exception);
        }
        return token;
    }

    public PendingSocialRegistrationSession require(String token) {
        String normalizedToken = normalizeToken(token);
        String payload = redisTemplate.opsForValue().get(buildTokenKey(normalizedToken));
        if (payload == null || payload.isBlank()) {
            throw invalidToken();
        }

        try {
            return objectMapper.readValue(payload, PendingSocialRegistrationSession.class);
        } catch (JsonProcessingException exception) {
            throw invalidToken();
        }
    }

    public void delete(String token) {
        redisTemplate.delete(buildTokenKey(normalizeToken(token)));
    }

    private String buildTokenKey(String token) {
        return PENDING_SOCIAL_REGISTRATION_KEY_PREFIX + token;
    }

    private String normalizeToken(String token) {
        if (token == null || token.isBlank()) {
            throw invalidToken();
        }
        return token.trim();
    }

    private ApiException invalidToken() {
        return new ApiException(
                HttpStatus.UNAUTHORIZED,
                "INVALID_SOCIAL_SIGNUP_TOKEN",
                "소셜 가입 정보가 만료되었어요. 다시 로그인해 주세요."
        );
    }

    public record PendingSocialRegistrationSession(
            String provider,
            String providerUserId,
            String email,
            String providerDisplayName,
            String returnTo,
            boolean rememberMe
    ) {
    }
}
