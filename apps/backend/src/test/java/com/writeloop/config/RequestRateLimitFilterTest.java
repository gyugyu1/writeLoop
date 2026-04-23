package com.writeloop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.service.AuthService;
import com.writeloop.service.RequestRateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class RequestRateLimitFilterTest {

    @Test
    void blocks_feedback_requests_after_ip_limit_is_exceeded_for_cookie_less_guests() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = buildFilter(
                limiter,
                10,
                5,
                60,
                2,
                20,
                60,
                120
        );

        MockHttpServletRequest firstRequest = feedbackRequest("203.0.113.40");
        MockHttpServletRequest secondRequest = feedbackRequest("203.0.113.40");
        MockHttpServletRequest blockedRequest = feedbackRequest("203.0.113.40");

        MockHttpServletResponse firstResponse = filterOnce(filter, firstRequest);
        MockHttpServletResponse secondResponse = filterOnce(filter, secondRequest);
        MockHttpServletResponse blockedResponse = filterOnce(filter, blockedRequest);

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(secondResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blockedResponse.getHeader("X-RateLimit-Limit")).isEqualTo("2");
        assertThat(blockedResponse.getContentAsString()).contains("RATE_LIMIT_EXCEEDED");
        assertThat(firstRequest.getSession(false)).isNull();
        assertThat(secondRequest.getSession(false)).isNull();
        assertThat(blockedRequest.getSession(false)).isNull();
    }

    @Test
    void feedback_rate_limit_uses_ip_even_when_guest_sessions_differ() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = buildFilter(
                limiter,
                10,
                5,
                60,
                1,
                20,
                60,
                120
        );

        MockHttpServletRequest firstRequest = feedbackRequest(new MockHttpSession(), "203.0.113.41");
        MockHttpServletRequest blockedRequest = feedbackRequest(new MockHttpSession(), "203.0.113.41");

        MockHttpServletResponse firstResponse = filterOnce(filter, firstRequest);
        MockHttpServletResponse blockedResponse = filterOnce(filter, blockedRequest);

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getHeader("X-RateLimit-Limit")).isEqualTo("1");
    }

    @Test
    void limits_login_by_client_ip_even_when_sessions_differ() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = buildFilter(
                limiter,
                1,
                5,
                60,
                6,
                20,
                60,
                120
        );

        MockHttpServletRequest firstRequest = loginRequest("203.0.113.10");
        firstRequest.setSession(new MockHttpSession());
        MockHttpServletRequest secondRequest = loginRequest("203.0.113.10");
        secondRequest.setSession(new MockHttpSession());

        MockHttpServletResponse firstResponse = filterOnce(filter, firstRequest);
        MockHttpServletResponse blockedResponse = filterOnce(filter, secondRequest);

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getContentAsString()).contains("로그인 요청이 너무 많아요.");
    }

    @Test
    void limits_email_verification_by_client_ip() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = buildFilter(
                limiter,
                10,
                1,
                60,
                6,
                20,
                60,
                120
        );

        MockHttpServletResponse firstResponse = filterOnce(filter, verifyEmailRequest("203.0.113.20"));
        MockHttpServletResponse blockedResponse = filterOnce(filter, verifyEmailRequest("203.0.113.20"));

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getHeader("Retry-After")).isEqualTo("600");
    }

    @Test
    void limits_daily_prompt_recommendations_by_client_ip_without_creating_session() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = buildFilter(
                limiter,
                10,
                5,
                1,
                6,
                20,
                60,
                120
        );

        MockHttpServletRequest firstRequest = dailyPromptRequest("203.0.113.30");
        MockHttpServletRequest blockedRequest = dailyPromptRequest("203.0.113.30");

        MockHttpServletResponse firstResponse = filterOnce(filter, firstRequest);
        MockHttpServletResponse blockedResponse = filterOnce(filter, blockedRequest);

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getHeader("X-RateLimit-Limit")).isEqualTo("1");
        assertThat(firstRequest.getSession(false)).isNull();
        assertThat(blockedRequest.getSession(false)).isNull();
    }

    @Test
    void limits_draft_saves_by_authenticated_user() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = buildFilter(
                limiter,
                10,
                5,
                60,
                6,
                20,
                60,
                1
        );

        MockHttpServletRequest firstRequest = draftSaveRequest("203.0.113.50", 7L);
        MockHttpServletRequest blockedRequest = draftSaveRequest("198.51.100.50", 7L);

        MockHttpServletResponse firstResponse = filterOnce(filter, firstRequest);
        MockHttpServletResponse blockedResponse = filterOnce(filter, blockedRequest);

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getHeader("X-RateLimit-Limit")).isEqualTo("1");
        assertThat(firstRequest.getSession(false)).isNull();
        assertThat(blockedRequest.getSession(false)).isNull();
    }

    private RequestRateLimitFilter buildFilter(
            RequestRateLimiter limiter,
            int authMaxRequests,
            int emailMaxRequests,
            int promptRecommendationMaxRequests,
            int feedbackMaxRequests,
            int coachHelpMaxRequests,
            int coachUsageMaxRequests,
            int draftSaveMaxRequests
    ) {
        return new RequestRateLimitFilter(
                limiter,
                new ObjectMapper(),
                true,
                300, authMaxRequests,
                600, emailMaxRequests,
                60, promptRecommendationMaxRequests,
                60, feedbackMaxRequests,
                60, coachHelpMaxRequests,
                60, coachUsageMaxRequests,
                60, draftSaveMaxRequests
        );
    }

    private MockHttpServletResponse filterOnce(
            RequestRateLimitFilter filter,
            MockHttpServletRequest request
    ) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private MockHttpServletRequest feedbackRequest(MockHttpSession session) {
        return feedbackRequest(session, "127.0.0.1");
    }

    private MockHttpServletRequest feedbackRequest(String remoteAddr) {
        return feedbackRequest(null, remoteAddr);
    }

    private MockHttpServletRequest feedbackRequest(MockHttpSession session, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/feedback");
        if (session != null) {
            request.setSession(session);
        }
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private MockHttpServletRequest loginRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private MockHttpServletRequest verifyEmailRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/verify-email");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private MockHttpServletRequest dailyPromptRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/prompts/daily");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private MockHttpServletRequest draftSaveRequest(String remoteAddr, long userId) {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/drafts/prompt-1");
        request.setRemoteAddr(remoteAddr);
        request.setAttribute(AuthService.REQUEST_USER_ID_ATTRIBUTE, userId);
        return request;
    }

    private static final class MutableClock extends Clock {
        private final Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
