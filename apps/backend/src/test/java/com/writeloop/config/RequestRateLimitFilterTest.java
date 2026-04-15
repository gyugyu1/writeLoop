package com.writeloop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
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
    void blocks_feedback_requests_after_session_limit_is_exceeded() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = new RequestRateLimitFilter(
                limiter,
                new ObjectMapper(),
                true,
                300, 10,
                600, 5,
                60, 2,
                60, 20,
                60, 60
        );

        MockHttpSession session = new MockHttpSession();

        MockHttpServletResponse firstResponse = filterOnce(filter, feedbackRequest(session));
        MockHttpServletResponse secondResponse = filterOnce(filter, feedbackRequest(session));
        MockHttpServletResponse blockedResponse = filterOnce(filter, feedbackRequest(session));

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(secondResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blockedResponse.getHeader("X-RateLimit-Limit")).isEqualTo("2");
        assertThat(blockedResponse.getContentAsString()).contains("RATE_LIMIT_EXCEEDED");
    }

    @Test
    void limits_login_by_client_ip_even_when_sessions_differ() throws Exception {
        MutableClock clock = new MutableClock(Instant.parse("2026-04-15T00:00:00Z"));
        RequestRateLimiter limiter = new RequestRateLimiter(clock, Duration.ofHours(1));
        RequestRateLimitFilter filter = new RequestRateLimitFilter(
                limiter,
                new ObjectMapper(),
                true,
                300, 1,
                600, 5,
                60, 6,
                60, 20,
                60, 60
        );

        MockHttpServletRequest firstRequest = loginRequest("203.0.113.10");
        firstRequest.setSession(new MockHttpSession());
        MockHttpServletRequest secondRequest = loginRequest("203.0.113.10");
        secondRequest.setSession(new MockHttpSession());

        MockHttpServletResponse firstResponse = filterOnce(filter, firstRequest);
        MockHttpServletResponse blockedResponse = filterOnce(filter, secondRequest);

        assertThat(firstResponse.getStatus()).isEqualTo(200);
        assertThat(blockedResponse.getStatus()).isEqualTo(429);
        assertThat(blockedResponse.getContentAsString()).contains("로그인 요청이 너무 많아요");
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
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/feedback");
        request.setSession(session);
        request.setRemoteAddr("127.0.0.1");
        return request;
    }

    private MockHttpServletRequest loginRequest(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

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
