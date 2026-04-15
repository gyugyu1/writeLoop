package com.writeloop.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityHeadersFilterTest {

    @Test
    void applies_standard_headers_and_hsts_for_secure_requests() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter(
                true,
                31536000,
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
                "no-referrer",
                "camera=(), microphone=(), geolocation=()"
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/prompts");
        request.addHeader("X-Forwarded-Proto", "https");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(response.getHeader("X-Frame-Options")).isEqualTo("DENY");
        assertThat(response.getHeader("Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(response.getHeader("Permissions-Policy")).isEqualTo("camera=(), microphone=(), geolocation=()");
        assertThat(response.getHeader("Content-Security-Policy"))
                .isEqualTo("default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        assertThat(response.getHeader("Strict-Transport-Security"))
                .isEqualTo("max-age=31536000; includeSubDomains");
    }

    @Test
    void does_not_set_hsts_for_plain_http_requests() throws Exception {
        SecurityHeadersFilter filter = new SecurityHeadersFilter(
                true,
                31536000,
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
                "no-referrer",
                "camera=(), microphone=(), geolocation=()"
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/prompts");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getHeader("Strict-Transport-Security")).isNull();
    }
}
