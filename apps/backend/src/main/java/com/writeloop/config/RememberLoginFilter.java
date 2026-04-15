package com.writeloop.config;

import com.writeloop.service.RememberLoginService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@RequiredArgsConstructor
public class RememberLoginFilter extends OncePerRequestFilter {

    private final RememberLoginService rememberLoginService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        rememberLoginService.tryAuthenticateFromCookie(request, response);
        filterChain.doFilter(request, response);
    }
}
