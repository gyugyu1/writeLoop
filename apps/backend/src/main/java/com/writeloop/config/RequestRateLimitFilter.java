package com.writeloop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.service.AuthService;
import com.writeloop.service.RequestRateLimiter;
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
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class RequestRateLimitFilter extends OncePerRequestFilter {

    private final RequestRateLimiter requestRateLimiter;
    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final List<RateLimitPolicy> policies;

    public RequestRateLimitFilter(
            RequestRateLimiter requestRateLimiter,
            ObjectMapper objectMapper,
            @Value("${app.security.rate-limit.enabled:true}") boolean enabled,
            @Value("${app.security.rate-limit.auth-window-seconds:300}") long authWindowSeconds,
            @Value("${app.security.rate-limit.auth-max-requests:10}") int authMaxRequests,
            @Value("${app.security.rate-limit.email-window-seconds:600}") long emailWindowSeconds,
            @Value("${app.security.rate-limit.email-max-requests:5}") int emailMaxRequests,
            @Value("${app.security.rate-limit.feedback-window-seconds:60}") long feedbackWindowSeconds,
            @Value("${app.security.rate-limit.feedback-max-requests:6}") int feedbackMaxRequests,
            @Value("${app.security.rate-limit.coach-help-window-seconds:60}") long coachHelpWindowSeconds,
            @Value("${app.security.rate-limit.coach-help-max-requests:20}") int coachHelpMaxRequests,
            @Value("${app.security.rate-limit.coach-usage-window-seconds:60}") long coachUsageWindowSeconds,
            @Value("${app.security.rate-limit.coach-usage-max-requests:60}") int coachUsageMaxRequests
    ) {
        this.requestRateLimiter = requestRateLimiter;
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.policies = List.of(
                new RateLimitPolicy(
                        "auth-login",
                        "POST",
                        Set.of("/api/auth/login", "/api/auth/token/login"),
                        authMaxRequests,
                        Duration.ofSeconds(Math.max(authWindowSeconds, 1)),
                        KeyMode.CLIENT_IP,
                        false,
                        "로그인 요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
                ),
                new RateLimitPolicy(
                        "auth-email",
                        "POST",
                        Set.of(
                                "/api/auth/register/send-code",
                                "/api/auth/resend-verification",
                                "/api/auth/password-reset/check-email",
                                "/api/auth/password-reset/send-code",
                                "/api/auth/password-reset/verify-code"
                        ),
                        emailMaxRequests,
                        Duration.ofSeconds(Math.max(emailWindowSeconds, 1)),
                        KeyMode.CLIENT_IP,
                        false,
                        "인증 요청이 너무 많아요. 잠시 후 다시 시도해 주세요."
                ),
                new RateLimitPolicy(
                        "feedback",
                        "POST",
                        Set.of("/api/feedback"),
                        feedbackMaxRequests,
                        Duration.ofSeconds(Math.max(feedbackWindowSeconds, 1)),
                        KeyMode.USER_OR_SESSION_OR_IP,
                        true,
                        "피드백 요청이 너무 빨라요. 잠시 후 다시 받아 주세요."
                ),
                new RateLimitPolicy(
                        "coach-help",
                        "POST",
                        Set.of("/api/coach/help"),
                        coachHelpMaxRequests,
                        Duration.ofSeconds(Math.max(coachHelpWindowSeconds, 1)),
                        KeyMode.USER_OR_SESSION_OR_IP,
                        true,
                        "AI 코치 요청이 너무 빨라요. 잠시 후 다시 시도해 주세요."
                ),
                new RateLimitPolicy(
                        "coach-usage",
                        "POST",
                        Set.of("/api/coach/usage-check"),
                        coachUsageMaxRequests,
                        Duration.ofSeconds(Math.max(coachUsageWindowSeconds, 1)),
                        KeyMode.USER_OR_SESSION_OR_IP,
                        true,
                        "AI 코치 요청이 너무 빨라요. 잠시 후 다시 시도해 주세요."
                )
        );
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled || request == null || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        return findPolicy(request) == null;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        RateLimitPolicy policy = findPolicy(request);
        if (policy == null) {
            filterChain.doFilter(request, response);
            return;
        }

        String subjectKey = resolveSubjectKey(request, policy);
        RequestRateLimiter.RateLimitDecision decision = requestRateLimiter.tryConsume(
                policy.id(),
                subjectKey,
                policy.maxRequests(),
                policy.window()
        );

        applyRateLimitHeaders(response, decision);
        if (!decision.allowed()) {
            writeRateLimitResponse(response, policy, decision);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private RateLimitPolicy findPolicy(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        String method = request.getMethod();
        for (RateLimitPolicy policy : policies) {
            if (policy.matches(method, requestUri)) {
                return policy;
            }
        }
        return null;
    }

    private String resolveSubjectKey(HttpServletRequest request, RateLimitPolicy policy) {
        if (policy.keyMode() == KeyMode.CLIENT_IP) {
            return "ip:" + resolveClientIp(request);
        }

        Long currentUserId = extractCurrentUserId(request);
        if (currentUserId != null) {
            return "user:" + currentUserId;
        }

        HttpSession session = request.getSession(false);
        if (session == null && policy.createSessionWhenMissing()) {
            session = request.getSession(true);
        }
        if (session != null) {
            return "session:" + session.getId();
        }

        return "ip:" + resolveClientIp(request);
    }

    private Long extractCurrentUserId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        Object requestValue = request.getAttribute(AuthService.REQUEST_USER_ID_ATTRIBUTE);
        if (requestValue instanceof Long requestUserId) {
            return requestUserId;
        }
        if (requestValue instanceof Number requestUserNumber) {
            return requestUserNumber.longValue();
        }

        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        Object sessionValue = session.getAttribute(AuthService.SESSION_USER_ID);
        if (sessionValue instanceof Long sessionUserId) {
            return sessionUserId;
        }
        if (sessionValue instanceof Number sessionUserNumber) {
            return sessionUserNumber.longValue();
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = trimToNull(request == null ? null : request.getRemoteAddr());
        if (isTrustedProxyHop(remoteAddr)) {
            String forwardedFor = trimToNull(request.getHeader("X-Forwarded-For"));
            if (forwardedFor != null) {
                String firstHop = forwardedFor.split(",")[0].trim();
                if (!firstHop.isEmpty()) {
                    return firstHop;
                }
            }

            String realIp = trimToNull(request.getHeader("X-Real-IP"));
            if (realIp != null) {
                return realIp;
            }
        }
        return remoteAddr == null ? "unknown" : remoteAddr;
    }

    private boolean isTrustedProxyHop(String remoteAddr) {
        if (remoteAddr == null || remoteAddr.isBlank()) {
            return false;
        }
        return remoteAddr.equals("127.0.0.1")
                || remoteAddr.equals("0:0:0:0:0:0:0:1")
                || remoteAddr.equals("::1")
                || remoteAddr.startsWith("10.")
                || remoteAddr.startsWith("192.168.")
                || remoteAddr.startsWith("172.16.")
                || remoteAddr.startsWith("172.17.")
                || remoteAddr.startsWith("172.18.")
                || remoteAddr.startsWith("172.19.")
                || remoteAddr.startsWith("172.20.")
                || remoteAddr.startsWith("172.21.")
                || remoteAddr.startsWith("172.22.")
                || remoteAddr.startsWith("172.23.")
                || remoteAddr.startsWith("172.24.")
                || remoteAddr.startsWith("172.25.")
                || remoteAddr.startsWith("172.26.")
                || remoteAddr.startsWith("172.27.")
                || remoteAddr.startsWith("172.28.")
                || remoteAddr.startsWith("172.29.")
                || remoteAddr.startsWith("172.30.")
                || remoteAddr.startsWith("172.31.");
    }

    private void applyRateLimitHeaders(
            HttpServletResponse response,
            RequestRateLimiter.RateLimitDecision decision
    ) {
        response.setHeader("X-RateLimit-Limit", Integer.toString(decision.limit()));
        response.setHeader("X-RateLimit-Remaining", Integer.toString(decision.remaining()));
        response.setHeader("X-RateLimit-Reset", Long.toString(decision.resetAt().getEpochSecond()));
        if (!decision.allowed()) {
            response.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
        }
    }

    private void writeRateLimitResponse(
            HttpServletResponse response,
            RateLimitPolicy policy,
            RequestRateLimiter.RateLimitDecision decision
    ) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), Map.of(
                "code", "RATE_LIMIT_EXCEEDED",
                "message", policy.message(),
                "retryAfterSeconds", Long.toString(decision.retryAfterSeconds())
        ));
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private enum KeyMode {
        CLIENT_IP,
        USER_OR_SESSION_OR_IP
    }

    private record RateLimitPolicy(
            String id,
            String method,
            Set<String> exactPaths,
            int maxRequests,
            Duration window,
            KeyMode keyMode,
            boolean createSessionWhenMissing,
            String message
    ) {
        private boolean matches(String requestMethod, String requestUri) {
            return method.equalsIgnoreCase(requestMethod) && exactPaths.contains(requestUri);
        }
    }
}
