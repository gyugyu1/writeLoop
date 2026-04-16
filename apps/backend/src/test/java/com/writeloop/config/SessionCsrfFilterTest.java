package com.writeloop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;

import static org.assertj.core.api.Assertions.assertThat;

class SessionCsrfFilterTest {

    @Test
    void blocks_session_authenticated_write_requests_from_untrusted_origin() throws Exception {
        SessionCsrfFilter filter = new SessionCsrfFilter(
                new ObjectMapper(),
                true,
                "https://app.writeloop.com",
                "https://app.writeloop.com"
        );
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/profile");
        request.addHeader("Origin", "https://evil.example");
        request.setSession(authenticatedSession());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("CSRF_VALIDATION_FAILED");
    }

    @Test
    void allows_session_authenticated_write_requests_from_allowed_frontend_origin() throws Exception {
        SessionCsrfFilter filter = new SessionCsrfFilter(
                new ObjectMapper(),
                true,
                "https://app.writeloop.com",
                "https://app.writeloop.com"
        );
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/profile");
        request.addHeader("Origin", "https://app.writeloop.com");
        request.setSession(authenticatedSession());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void skips_csrf_validation_for_bearer_token_requests() throws Exception {
        SessionCsrfFilter filter = new SessionCsrfFilter(
                new ObjectMapper(),
                true,
                "https://app.writeloop.com",
                "https://app.writeloop.com"
        );
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/drafts/prompt-1");
        request.addHeader("Authorization", "Bearer test-token");
        request.setSession(authenticatedSession());
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
    }

    private MockHttpSession authenticatedSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(AuthService.SESSION_USER_ID, 7L);
        return session;
    }
}
