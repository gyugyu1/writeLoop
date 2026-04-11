package com.writeloop.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AccessTokenService {

    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    private final ObjectMapper objectMapper;

    @Value("${app.auth.token-secret:writeloop-dev-token-secret-change-me}")
    private String tokenSecret;

    @Value("${app.auth.access-token-minutes:15}")
    private long accessTokenMinutes;

    public String issueAccessToken(Long userId) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(Duration.ofMinutes(Math.max(1, accessTokenMinutes)));
        String header = encodeJson(Map.of(
                "alg", "HS256",
                "typ", "JWT"
        ));
        String payload = encodeJson(Map.of(
                "sub", String.valueOf(userId),
                "typ", "access",
                "iat", issuedAt.getEpochSecond(),
                "exp", expiresAt.getEpochSecond()
        ));
        String signature = sign(header + "." + payload);
        return header + "." + payload + "." + signature;
    }

    public Long parseUserId(String accessToken) {
        String token = normalizeAccessToken(accessToken);
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw invalidAccessToken();
        }

        String signedPayload = parts[0] + "." + parts[1];
        String expectedSignature = sign(signedPayload);
        if (!constantTimeEquals(expectedSignature, parts[2])) {
            throw invalidAccessToken();
        }

        try {
            Map<String, Object> payload = objectMapper.readValue(decode(parts[1]), MAP_TYPE);
            String tokenType = String.valueOf(payload.get("typ"));
            if (!"access".equals(tokenType)) {
                throw invalidAccessToken();
            }

            long expiresAt = Long.parseLong(String.valueOf(payload.get("exp")));
            if (Instant.now().getEpochSecond() >= expiresAt) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "ACCESS_TOKEN_EXPIRED", "로그인이 만료됐어요. 다시 로그인해 주세요.");
            }

            return Long.parseLong(String.valueOf(payload.get("sub")));
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw invalidAccessToken();
        }
    }

    public long getAccessTokenExpiresInSeconds() {
        return Duration.ofMinutes(Math.max(1, accessTokenMinutes)).toSeconds();
    }

    private String encodeJson(Map<String, Object> value) {
        try {
            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception exception) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "ACCESS_TOKEN_ENCODING_FAILED",
                    "로그인 토큰을 만들지 못했어요."
            );
        }
    }

    private byte[] decode(String value) {
        return Base64.getUrlDecoder().decode(value);
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(tokenSecret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new ApiException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "ACCESS_TOKEN_SIGNING_FAILED",
                    "로그인 토큰을 만들지 못했어요."
            );
        }
    }

    private boolean constantTimeEquals(String left, String right) {
        byte[] leftBytes = left.getBytes(StandardCharsets.UTF_8);
        byte[] rightBytes = right.getBytes(StandardCharsets.UTF_8);
        if (leftBytes.length != rightBytes.length) {
            return false;
        }

        int diff = 0;
        for (int i = 0; i < leftBytes.length; i++) {
            diff |= leftBytes[i] ^ rightBytes[i];
        }
        return diff == 0;
    }

    private String normalizeAccessToken(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw invalidAccessToken();
        }
        return accessToken.trim();
    }

    private ApiException invalidAccessToken() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_ACCESS_TOKEN", "로그인이 유효하지 않아요. 다시 로그인해 주세요.");
    }
}
