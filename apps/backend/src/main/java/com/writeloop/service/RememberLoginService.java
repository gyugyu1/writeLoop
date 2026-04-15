package com.writeloop.service;

import com.writeloop.persistence.RememberLoginTokenEntity;
import com.writeloop.persistence.RememberLoginTokenRepository;
import com.writeloop.persistence.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RememberLoginService {

    public static final String COOKIE_NAME = "WRITELOOP_REMEMBER";

    private final RememberLoginTokenRepository rememberLoginTokenRepository;
    private final UserRepository userRepository;

    @Value("${app.auth.remember-me-days:30}")
    private long rememberMeDays;

    @Value("${APP_SESSION_COOKIE_SAME_SITE:Lax}")
    private String sameSite;

    @Value("${APP_SESSION_COOKIE_SECURE:false}")
    private boolean secureCookie;

    public void rememberUser(Long userId, HttpServletResponse response) {
        String rawToken = generateRawToken();
        RememberLoginTokenEntity token = new RememberLoginTokenEntity(
                userId,
                hash(rawToken),
                Instant.now().plus(Duration.ofDays(rememberMeDays))
        );
        rememberLoginTokenRepository.save(token);
        writeRememberCookie(response, rawToken, rememberMeDays);
    }

    public void clearRememberedLogin(HttpServletRequest request, HttpServletResponse response) {
        extractCookieValue(request).ifPresent(rawToken -> revokeByRawToken(rawToken));
        clearRememberCookie(response);
    }

    public void tryAuthenticateFromCookie(HttpServletRequest request, HttpServletResponse response) {
        HttpSession existingSession = request.getSession(false);
        if (existingSession != null && existingSession.getAttribute(AuthService.SESSION_USER_ID) != null) {
            return;
        }

        Optional<String> rawToken = extractCookieValue(request);
        if (rawToken.isEmpty()) {
            return;
        }

        Optional<RememberLoginTokenEntity> token = rememberLoginTokenRepository
                .findFirstByTokenHashAndRevokedAtIsNull(hash(rawToken.get()));

        if (token.isEmpty()) {
            clearRememberCookie(response);
            return;
        }

        RememberLoginTokenEntity entity = token.get();
        if (entity.isExpired() || entity.isRevoked()) {
            entity.revoke();
            rememberLoginTokenRepository.save(entity);
            clearRememberCookie(response);
            return;
        }

        HttpSession session = request.getSession(true);
        try {
            request.changeSessionId();
        } catch (IllegalStateException ignored) {
            // Keep using the existing session when rotation is unavailable.
        }
        HttpSession refreshedSession = request.getSession(false);
        if (refreshedSession == null) {
            refreshedSession = session;
        }
        refreshedSession.setAttribute(AuthService.SESSION_USER_ID, entity.getUserId());
        userRepository.findById(entity.getUserId()).ifPresent(user -> {
            user.markLoggedIn();
            userRepository.save(user);
        });

        String nextRawToken = generateRawToken();
        entity.rotate(hash(nextRawToken), Instant.now().plus(Duration.ofDays(rememberMeDays)));
        rememberLoginTokenRepository.save(entity);
        writeRememberCookie(response, nextRawToken, rememberMeDays);
    }

    public void revokeAllForUser(Long userId) {
        List<RememberLoginTokenEntity> activeTokens = rememberLoginTokenRepository.findAllByUserIdAndRevokedAtIsNull(userId);
        for (RememberLoginTokenEntity activeToken : activeTokens) {
            activeToken.revoke();
        }
        if (!activeTokens.isEmpty()) {
            rememberLoginTokenRepository.saveAll(activeTokens);
        }
    }

    private void revokeByRawToken(String rawToken) {
        rememberLoginTokenRepository.findFirstByTokenHashAndRevokedAtIsNull(hash(rawToken))
                .ifPresent(entity -> {
                    entity.revoke();
                    rememberLoginTokenRepository.save(entity);
                });
    }

    private Optional<String> extractCookieValue(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }

        for (Cookie cookie : cookies) {
            if (COOKIE_NAME.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return Optional.of(cookie.getValue());
            }
        }

        return Optional.empty();
    }

    private void writeRememberCookie(HttpServletResponse response, String rawToken, long maxAgeDays) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, rawToken)
                .httpOnly(true)
                .path("/")
                .secure(secureCookie)
                .sameSite(normalizeSameSite(sameSite))
                .maxAge(Duration.ofDays(maxAgeDays))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clearRememberCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, "")
                .httpOnly(true)
                .path("/")
                .secure(secureCookie)
                .sameSite(normalizeSameSite(sameSite))
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String normalizeSameSite(String value) {
        if (value == null || value.isBlank()) {
            return "Lax";
        }

        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "none" -> "None";
            case "strict" -> "Strict";
            default -> "Lax";
        };
    }

    private String generateRawToken() {
        return UUID.randomUUID() + UUID.randomUUID().toString().replace("-", "");
    }

    private String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is not available", exception);
        }
    }
}
