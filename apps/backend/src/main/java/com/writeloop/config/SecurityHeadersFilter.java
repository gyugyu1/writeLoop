package com.writeloop.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeadersFilter extends OncePerRequestFilter {

    private final boolean enabled;
    private final long hstsMaxAgeSeconds;
    private final String contentSecurityPolicy;
    private final String referrerPolicy;
    private final String permissionsPolicy;

    public SecurityHeadersFilter(
            @Value("${app.security.headers.enabled:true}") boolean enabled,
            @Value("${app.security.headers.hsts-max-age-seconds:31536000}") long hstsMaxAgeSeconds,
            @Value("${app.security.headers.content-security-policy:default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'}") String contentSecurityPolicy,
            @Value("${app.security.headers.referrer-policy:no-referrer}") String referrerPolicy,
            @Value("${app.security.headers.permissions-policy:camera=(), microphone=(), geolocation=()}") String permissionsPolicy
    ) {
        this.enabled = enabled;
        this.hstsMaxAgeSeconds = hstsMaxAgeSeconds;
        this.contentSecurityPolicy = contentSecurityPolicy;
        this.referrerPolicy = referrerPolicy;
        this.permissionsPolicy = permissionsPolicy;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        applyHeaders(request, response);
        filterChain.doFilter(request, response);
        applyHeaders(request, response);
    }

    private void applyHeaders(HttpServletRequest request, HttpServletResponse response) {
        if (!enabled) {
            return;
        }

        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", referrerPolicy);
        response.setHeader("Permissions-Policy", permissionsPolicy);
        response.setHeader("Content-Security-Policy", contentSecurityPolicy);

        if (isSecureRequest(request) && hstsMaxAgeSeconds > 0) {
            response.setHeader(
                    "Strict-Transport-Security",
                    "max-age=" + hstsMaxAgeSeconds + "; includeSubDomains"
            );
        }
    }

    private boolean isSecureRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        if (request.isSecure()) {
            return true;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        return forwardedProto != null && forwardedProto.equalsIgnoreCase("https");
    }
}
