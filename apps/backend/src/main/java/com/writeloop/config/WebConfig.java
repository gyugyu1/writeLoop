package com.writeloop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public WebConfig(@Value("${app.cors.allowed-origins:}") String allowedOrigins) {
        Set<String> origins = new LinkedHashSet<>(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList());

        this.allowedOrigins = origins.toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
