package com.writeloop.service;

import com.writeloop.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final String REFRESH_TOKEN_KEY_PREFIX = "auth:refresh:";
    private static final String USER_REFRESH_SET_KEY_PREFIX = "auth:refresh:user:";

    private final StringRedisTemplate redisTemplate;

    @Value("${app.auth.refresh-token-days:30}")
    private long refreshTokenDays;

    public IssuedRefreshToken issue(Long userId) {
        Duration ttl = Duration.ofDays(Math.max(1, refreshTokenDays));
        String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");

        redisTemplate.opsForValue().set(buildRefreshTokenKey(token), String.valueOf(userId), ttl);
        redisTemplate.opsForSet().add(buildUserRefreshSetKey(userId), token);
        redisTemplate.expire(buildUserRefreshSetKey(userId), ttl);

        return new IssuedRefreshToken(token, ttl.toSeconds());
    }

    public Long requireUserId(String refreshToken) {
        String token = normalizeRefreshToken(refreshToken);
        String storedUserId = redisTemplate.opsForValue().get(buildRefreshTokenKey(token));
        if (storedUserId == null || storedUserId.isBlank()) {
            throw invalidRefreshToken();
        }

        try {
            return Long.parseLong(storedUserId);
        } catch (NumberFormatException exception) {
            revoke(token);
            throw invalidRefreshToken();
        }
    }

    public void revoke(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }

        String token = refreshToken.trim();
        String key = buildRefreshTokenKey(token);
        String storedUserId = redisTemplate.opsForValue().get(key);
        redisTemplate.delete(key);

        if (storedUserId != null && !storedUserId.isBlank()) {
            redisTemplate.opsForSet().remove(buildUserRefreshSetKey(Long.parseLong(storedUserId)), token);
        }
    }

    public void revokeAllForUser(Long userId) {
        if (userId == null) {
            return;
        }

        String userKey = buildUserRefreshSetKey(userId);
        Set<String> tokens = redisTemplate.opsForSet().members(userKey);
        if (tokens != null && !tokens.isEmpty()) {
            redisTemplate.delete(tokens.stream().map(this::buildRefreshTokenKey).toList());
        }
        redisTemplate.delete(userKey);
    }

    private String buildRefreshTokenKey(String refreshToken) {
        return REFRESH_TOKEN_KEY_PREFIX + refreshToken;
    }

    private String buildUserRefreshSetKey(Long userId) {
        return USER_REFRESH_SET_KEY_PREFIX + userId;
    }

    private String normalizeRefreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw invalidRefreshToken();
        }
        return refreshToken.trim();
    }

    private ApiException invalidRefreshToken() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "로그인이 만료됐어요. 다시 로그인해 주세요.");
    }

    public record IssuedRefreshToken(
            String token,
            long expiresInSeconds
    ) {
    }
}
