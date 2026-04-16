package com.writeloop.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Component
public class SecurityConfigurationValidator {

    private static final String DEV_TOKEN_SECRET = "writeloop-dev-token-secret-change-me";

    @Value("${app.security.allow-insecure-dev-defaults:false}")
    private boolean allowInsecureDevDefaults;

    @Value("${app.security.headers.enabled:true}")
    private boolean securityHeadersEnabled;

    @Value("${app.security.csrf.enabled:true}")
    private boolean csrfEnabled;

    @Value("${app.security.headers.content-security-policy:}")
    private String contentSecurityPolicy;

    @Value("${app.security.headers.hsts-max-age-seconds:31536000}")
    private long hstsMaxAgeSeconds;

    @Value("${app.security.rate-limit.enabled:true}")
    private boolean rateLimitEnabled;

    @Value("${server.servlet.session.cookie.secure:true}")
    private boolean sessionCookieSecure;

    @Value("${app.frontend-base-url:}")
    private String frontendBaseUrl;

    @Value("${app.cors.allowed-origins:}")
    private String allowedOrigins;

    @Value("${app.auth.token-secret:}")
    private String tokenSecret;

    @Value("${app.auth.mobile-redirect-prefixes:writeloop://}")
    private String mobileRedirectPrefixes;

    @Value("${app.oauth.google.client-id:}")
    private String googleClientId;

    @Value("${app.oauth.google.redirect-uri:}")
    private String googleRedirectUri;

    @Value("${app.oauth.kakao.client-id:}")
    private String kakaoClientId;

    @Value("${app.oauth.kakao.redirect-uri:}")
    private String kakaoRedirectUri;

    @Value("${app.oauth.naver.client-id:}")
    private String naverClientId;

    @Value("${app.oauth.naver.redirect-uri:}")
    private String naverRedirectUri;

    @PostConstruct
    void validate() {
        List<String> issues = new ArrayList<>();

        if (allowInsecureDevDefaults) {
            validateLocalMode(issues);
        } else {
            validateProductionMode(issues);
        }

        if (!issues.isEmpty()) {
            throw new IllegalStateException(
                    "Insecure backend configuration detected: " + String.join(" ", issues)
            );
        }
    }

    private void validateLocalMode(List<String> issues) {
        if (!isBlank(frontendBaseUrl) && !isLocalUrl(frontendBaseUrl)) {
            issues.add("`app.frontend-base-url` must stay local when `app.security.allow-insecure-dev-defaults=true`.");
        }

        for (String origin : splitCsv(allowedOrigins)) {
            if (!isLocalOrigin(origin)) {
                issues.add("`app.cors.allowed-origins` may only contain local origins in insecure local mode.");
                break;
            }
        }

        if (!isBlank(googleClientId) && !isLocalUrl(googleRedirectUri)) {
            issues.add("Google OAuth redirect must stay local in insecure local mode.");
        }
        if (!isBlank(kakaoClientId) && !isLocalUrl(kakaoRedirectUri)) {
            issues.add("Kakao OAuth redirect must stay local in insecure local mode.");
        }
        if (!isBlank(naverClientId) && !isLocalUrl(naverRedirectUri)) {
            issues.add("Naver OAuth redirect must stay local in insecure local mode.");
        }

        for (String prefix : splitCsv(mobileRedirectPrefixes)) {
            if (!isAllowedLocalMobilePrefix(prefix)) {
                issues.add("`app.auth.mobile-redirect-prefixes` contains a non-local redirect while insecure local mode is enabled.");
                break;
            }
        }
    }

    private void validateProductionMode(List<String> issues) {
        if (!securityHeadersEnabled) {
            issues.add("`app.security.headers.enabled` must stay true outside the local profile.");
        }
        if (!csrfEnabled) {
            issues.add("`app.security.csrf.enabled` must stay true outside the local profile.");
        }
        if (contentSecurityPolicy == null || contentSecurityPolicy.isBlank()) {
            issues.add("`app.security.headers.content-security-policy` must not be blank.");
        }
        if (hstsMaxAgeSeconds <= 0) {
            issues.add("`app.security.headers.hsts-max-age-seconds` must be greater than zero.");
        }
        if (!rateLimitEnabled) {
            issues.add("`app.security.rate-limit.enabled` must stay true outside the local profile.");
        }
        if (!sessionCookieSecure) {
            issues.add("`APP_SESSION_COOKIE_SECURE` must be true outside the local profile.");
        }
        if (isBlank(tokenSecret) || DEV_TOKEN_SECRET.equals(tokenSecret.trim())) {
            issues.add("`APP_AUTH_TOKEN_SECRET` must be set to a non-default secret.");
        }
        if (!isSafeProductionUrl(frontendBaseUrl)) {
            issues.add("`APP_FRONTEND_BASE_URL` must be a non-local https URL.");
        }

        List<String> origins = splitCsv(allowedOrigins);
        if (origins.isEmpty()) {
            issues.add("`APP_CORS_ALLOWED_ORIGINS` must be set explicitly.");
        } else {
            for (String origin : origins) {
                if (!isSafeProductionOrigin(origin)) {
                    issues.add("`APP_CORS_ALLOWED_ORIGINS` must not include localhost, capacitor, or non-https origins.");
                    break;
                }
            }
        }

        validateConfiguredProviderRedirect("Google", googleClientId, googleRedirectUri, issues);
        validateConfiguredProviderRedirect("Kakao", kakaoClientId, kakaoRedirectUri, issues);
        validateConfiguredProviderRedirect("Naver", naverClientId, naverRedirectUri, issues);

        for (String prefix : splitCsv(mobileRedirectPrefixes)) {
            String normalized = prefix.toLowerCase(Locale.ROOT);
            if (normalized.startsWith("exp://") || normalized.startsWith("http://") || normalized.startsWith("https://")) {
                issues.add("`APP_AUTH_MOBILE_REDIRECT_PREFIXES` must use app schemes only in production.");
                break;
            }
        }
    }

    private void validateConfiguredProviderRedirect(String providerName, String clientId, String redirectUri, List<String> issues) {
        if (isBlank(clientId)) {
            return;
        }
        if (!isSafeProductionUrl(redirectUri)) {
            issues.add(providerName + " OAuth redirect URI must be a non-local https URL when that provider is configured.");
        }
    }

    private List<String> splitCsv(String value) {
        if (isBlank(value)) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .toList();
    }

    private boolean isAllowedLocalMobilePrefix(String prefix) {
        if (isBlank(prefix)) {
            return false;
        }
        String normalized = prefix.trim().toLowerCase(Locale.ROOT);
        return normalized.startsWith("writeloop://")
                || normalized.startsWith("exp://")
                || normalized.startsWith("http://localhost")
                || normalized.startsWith("https://localhost");
    }

    private boolean isSafeProductionOrigin(String origin) {
        if (isBlank(origin)) {
            return false;
        }
        URI uri = safeUri(origin);
        if (uri == null) {
            return false;
        }
        String scheme = lower(uri.getScheme());
        return "https".equals(scheme) && !isLocalHost(uri.getHost());
    }

    private boolean isSafeProductionUrl(String value) {
        if (isBlank(value)) {
            return false;
        }
        URI uri = safeUri(value);
        if (uri == null) {
            return false;
        }
        String scheme = lower(uri.getScheme());
        return "https".equals(scheme) && !isLocalHost(uri.getHost());
    }

    private boolean isLocalOrigin(String origin) {
        if (isBlank(origin)) {
            return false;
        }
        String normalized = origin.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("capacitor://localhost")) {
            return true;
        }
        URI uri = safeUri(origin);
        return uri != null && isLocalHost(uri.getHost());
    }

    private boolean isLocalUrl(String value) {
        if (isBlank(value)) {
            return false;
        }
        URI uri = safeUri(value);
        return uri != null && isLocalHost(uri.getHost());
    }

    private boolean isLocalHost(String host) {
        String normalized = lower(host);
        if (normalized == null) {
            return false;
        }
        return normalized.equals("localhost")
                || normalized.equals("127.0.0.1")
                || normalized.equals("0.0.0.0")
                || normalized.endsWith(".localtest.me");
    }

    private URI safeUri(String value) {
        try {
            return URI.create(value.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private String lower(String value) {
        return value == null ? null : value.toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
