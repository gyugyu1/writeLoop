package com.writeloop.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.exception.ApiException;
import com.writeloop.service.TokenAuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class AccessTokenFilter extends OncePerRequestFilter {

    private final TokenAuthService tokenAuthService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            tokenAuthService.authenticateRequest(request);
            filterChain.doFilter(request, response);
        } catch (ApiException exception) {
            response.setStatus(exception.getStatus().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getWriter(), Map.of(
                    "message", exception.getMessage(),
                    "code", exception.getCode()
            ));
        }
    }
}
