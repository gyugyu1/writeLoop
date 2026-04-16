package com.writeloop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.service.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 25)
public class SessionCsrfFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final String frontendBaseUrl;
    private final Set<String> allowedOrigins;

    public SessionCsrfFilter(
            ObjectMapper objectMapper,
            @Value("${app.security.csrf.enabled:true}") boolean enabled,
            @Value("${app.frontend-base-url:}") String frontendBaseUrl,
            @Value("${app.cors.allowed-origins:}") String allowedOrigins
    ) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.frontendBaseUrl = frontendBaseUrl;
        this.allowedOrigins = parseConfiguredOrigins(frontendBaseUrl, allowedOrigins);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !enabled
                || request == null
                || !isUnsafeMethod(request.getMethod())
                || request.getRequestURI() == null
                || !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!requiresCsrfProtection(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String origin = normalizeOrigin(request.getHeader("Origin"));
        if (origin != null) {
            if (isAllowedOrigin(origin, request)) {
                filterChain.doFilter(request, response);
                return;
            }
            writeForbidden(response);
            return;
        }

        String refererOrigin = extractRefererOrigin(request.getHeader("Referer"));
        if (refererOrigin != null) {
            if (isAllowedOrigin(refererOrigin, request)) {
                filterChain.doFilter(request, response);
                return;
            }
            writeForbidden(response);
            return;
        }

        if (isSameSiteFetch(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        writeForbidden(response);
    }

    private boolean requiresCsrfProtection(HttpServletRequest request) {
        if (hasBearerAuthorization(request)) {
            return false;
        }

        HttpSession session = request.getSession(false);
        if (session == null) {
            return false;
        }

        Object sessionUserId = session.getAttribute(AuthService.SESSION_USER_ID);
        if (sessionUserId instanceof Number) {
            return true;
        }
        if (sessionUserId instanceof String stringValue) {
            return !stringValue.isBlank();
        }
        return false;
    }

    private boolean hasBearerAuthorization(HttpServletRequest request) {
        String authorization = request == null ? null : request.getHeader("Authorization");
        return authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7);
    }

    private boolean isUnsafeMethod(String method) {
        if (method == null) {
            return false;
        }
        String normalized = method.trim().toUpperCase(Locale.ROOT);
        return !normalized.equals("GET")
                && !normalized.equals("HEAD")
                && !normalized.equals("OPTIONS")
                && !normalized.equals("TRACE");
    }

    private boolean isSameSiteFetch(HttpServletRequest request) {
        String fetchSite = request == null ? null : request.getHeader("Sec-Fetch-Site");
        if (fetchSite == null || fetchSite.isBlank()) {
            return false;
        }

        String normalized = fetchSite.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("same-origin")
                || normalized.equals("same-site")
                || normalized.equals("none");
    }

    private boolean isAllowedOrigin(String candidateOrigin, HttpServletRequest request) {
        if (candidateOrigin == null) {
            return false;
        }

        if (allowedOrigins.contains(candidateOrigin)) {
            return true;
        }

        String currentRequestOrigin = resolveRequestOrigin(request);
        return candidateOrigin.equals(currentRequestOrigin);
    }

    private String resolveRequestOrigin(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        String scheme = firstForwardedValue(request.getHeader("X-Forwarded-Proto"));
        if (scheme == null) {
            scheme = request.getScheme();
        }

        String host = firstForwardedValue(request.getHeader("X-Forwarded-Host"));
        if (host == null) {
            host = trimToNull(request.getHeader("Host"));
        }
        if (host == null) {
            host = trimToNull(request.getServerName());
        }
        if (host == null) {
            return null;
        }

        String normalizedHost = host;
        if (!normalizedHost.contains(":")) {
            String forwardedPort = firstForwardedValue(request.getHeader("X-Forwarded-Port"));
            int port = parsePort(forwardedPort, request.getServerPort());
            if (!isDefaultPort(scheme, port)) {
                normalizedHost = normalizedHost + ":" + port;
            }
        }

        return normalizeOrigin(scheme + "://" + normalizedHost);
    }

    private Set<String> parseConfiguredOrigins(String frontendBaseUrl, String corsAllowedOrigins) {
        Set<String> origins = new LinkedHashSet<>();
        addNormalizedOrigin(origins, frontendBaseUrl);
        if (corsAllowedOrigins == null || corsAllowedOrigins.isBlank()) {
            return origins;
        }

        for (String candidate : corsAllowedOrigins.split(",")) {
            addNormalizedOrigin(origins, candidate);
        }
        return origins;
    }

    private void addNormalizedOrigin(Set<String> origins, String candidate) {
        String normalized = normalizeOrigin(candidate);
        if (normalized != null) {
            origins.add(normalized);
        }
    }

    private String extractRefererOrigin(String referer) {
        if (referer == null || referer.isBlank()) {
            return null;
        }
        return normalizeOrigin(referer);
    }

    private String normalizeOrigin(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return null;
        }

        String trimmed = candidate.trim();
        if ("null".equalsIgnoreCase(trimmed)) {
            return null;
        }

        try {
            URI uri = URI.create(trimmed);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) {
                return null;
            }
            String lowerScheme = scheme.toLowerCase(Locale.ROOT);
            String lowerHost = host.toLowerCase(Locale.ROOT);
            int port = uri.getPort();
            if (port < 0 || isDefaultPort(lowerScheme, port)) {
                return lowerScheme + "://" + lowerHost;
            }
            return lowerScheme + "://" + lowerHost + ":" + port;
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean isDefaultPort(String scheme, int port) {
        if (port <= 0) {
            return true;
        }
        String normalizedScheme = scheme == null ? "" : scheme.toLowerCase(Locale.ROOT);
        return ("http".equals(normalizedScheme) && port == 80)
                || ("https".equals(normalizedScheme) && port == 443);
    }

    private int parsePort(String candidate, int fallback) {
        if (candidate == null || candidate.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(candidate.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private String firstForwardedValue(String value) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            return null;
        }
        return trimToNull(trimmed.split(",")[0]);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void writeForbidden(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), Map.of(
                "code", "CSRF_VALIDATION_FAILED",
                "message", "요청 출처를 확인할 수 없어요."
        ));
    }
}
