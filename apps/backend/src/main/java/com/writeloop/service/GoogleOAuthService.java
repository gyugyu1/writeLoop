package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class GoogleOAuthService {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Value("${app.oauth.google.client-id:}")
    private String clientId;

    @Value("${app.oauth.google.client-secret:}")
    private String clientSecret;

    @Value("${app.oauth.google.authorization-uri:https://accounts.google.com/o/oauth2/v2/auth}")
    private String authorizationUri;

    @Value("${app.oauth.google.token-uri:https://oauth2.googleapis.com/token}")
    private String tokenUri;

    @Value("${app.oauth.google.user-info-uri:https://openidconnect.googleapis.com/v1/userinfo}")
    private String userInfoUri;

    @Value("${app.oauth.google.redirect-uri:http://api.localtest.me/api/auth/social/google/callback}")
    private String redirectUri;

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }

    public String buildAuthorizationUrl(String state) {
        return UriComponentsBuilder.fromUriString(authorizationUri)
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("scope", "openid email profile")
                .queryParam("state", state)
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .build()
                .toUriString();
    }

    public GoogleUserProfile fetchUserProfile(String code) {
        if (!isConfigured()) {
            throw new IllegalStateException("Google OAuth is not configured");
        }

        try {
            String accessToken = requestAccessToken(code);
            return requestUserProfile(accessToken);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to communicate with Google OAuth API", exception);
        }
    }

    private String requestAccessToken(String code) throws IOException, InterruptedException {
        String requestBody = "code=" + encode(code)
                + "&client_id=" + encode(clientId)
                + "&client_secret=" + encode(clientSecret)
                + "&redirect_uri=" + encode(redirectUri)
                + "&grant_type=authorization_code";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenUri))
                .timeout(Duration.ofSeconds(20))
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Google token request failed with status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String accessToken = root.path("access_token").asText("");
        if (accessToken.isBlank()) {
            throw new IllegalStateException("Google token response did not contain access_token");
        }

        return accessToken;
    }

    private GoogleUserProfile requestUserProfile(String accessToken) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(userInfoUri))
                .timeout(Duration.ofSeconds(20))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Google profile request failed with status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String providerUserId = root.path("sub").asText("");
        String email = root.path("email").asText("");
        String displayName = root.path("name").asText("");

        if (providerUserId.isBlank()) {
            throw new IllegalStateException("Google profile did not contain a user id");
        }

        return new GoogleUserProfile(providerUserId, email, displayName);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record GoogleUserProfile(
            String providerUserId,
            String email,
            String displayName
    ) {
    }
}
