package com.writeloop.service;

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
public class MobileSocialAuthCodeService {

    private static final String SOCIAL_AUTH_CODE_KEY_PREFIX = "auth:social:code:";

    private final StringRedisTemplate redisTemplate;

    @Value("${app.auth.mobile-social-code-minutes:5}")
    private long mobileSocialCodeMinutes;

    public String issue(Long userId) {
        Duration ttl = Duration.ofMinutes(Math.max(1, mobileSocialCodeMinutes));
        String code = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        redisTemplate.opsForValue().set(buildCodeKey(code), String.valueOf(userId), ttl);
        return code;
    }

    public Long consume(String code) {
        String normalizedCode = normalizeCode(code);
        String key = buildCodeKey(normalizedCode);
        String storedUserId = redisTemplate.opsForValue().get(key);
        redisTemplate.delete(key);

        if (storedUserId == null || storedUserId.isBlank()) {
            throw invalidCode();
        }

        try {
            return Long.parseLong(storedUserId);
        } catch (NumberFormatException exception) {
            throw invalidCode();
        }
    }

    private String buildCodeKey(String code) {
        return SOCIAL_AUTH_CODE_KEY_PREFIX + code;
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            throw invalidCode();
        }
        return code.trim();
    }

    private ApiException invalidCode() {
        return new ApiException(
                HttpStatus.UNAUTHORIZED,
                "INVALID_SOCIAL_AUTH_CODE",
                "소셜 로그인 인증이 만료되었어요. 다시 시도해 주세요."
        );
    }
}
