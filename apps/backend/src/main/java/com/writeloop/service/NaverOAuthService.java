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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class NaverOAuthService {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Value("${app.oauth.naver.client-id:}")
    private String clientId;

    @Value("${app.oauth.naver.client-secret:}")
    private String clientSecret;

    @Value("${app.oauth.naver.authorization-uri:https://nid.naver.com/oauth2.0/authorize}")
    private String authorizationUri;

    @Value("${app.oauth.naver.token-uri:https://nid.naver.com/oauth2.0/token}")
    private String tokenUri;

    @Value("${app.oauth.naver.user-info-uri:https://openapi.naver.com/v1/nid/me}")
    private String userInfoUri;

    @Value("${app.oauth.naver.redirect-uri:}")
    private String redirectUri;

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
    }

    public String buildAuthorizationUrl(String state) {
        return UriComponentsBuilder.fromUriString(authorizationUri)
                .queryParam("response_type", "code")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .build(true)
                .toUriString();
    }

    public NaverUserProfile fetchUserProfile(String code, String state) {
        if (!isConfigured()) {
            throw new IllegalStateException("Naver OAuth is not configured");
        }

        try {
            String accessToken = requestAccessToken(code, state);
            return requestUserProfile(accessToken);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to communicate with Naver OAuth API", exception);
        }
    }

    private String requestAccessToken(String code, String state) throws IOException, InterruptedException {
        String uri = UriComponentsBuilder.fromUriString(tokenUri)
                .queryParam("grant_type", "authorization_code")
                .queryParam("client_id", clientId)
                .queryParam("client_secret", clientSecret)
                .queryParam("code", code)
                .queryParam("state", state)
                .build(true)
                .toUriString();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(uri))
                .timeout(Duration.ofSeconds(20))
                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Naver token request failed with status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String accessToken = root.path("access_token").asText("");
        if (accessToken.isBlank()) {
            throw new IllegalStateException("Naver token response did not contain access_token");
        }

        return accessToken;
    }

    private NaverUserProfile requestUserProfile(String accessToken) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(userInfoUri))
                .timeout(Duration.ofSeconds(20))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Naver profile request failed with status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode profile = root.path("response");
        String providerUserId = profile.path("id").asText("");
        String email = profile.path("email").asText("");
        String nickname = profile.path("nickname").asText("");
        String name = profile.path("name").asText("");

        if (providerUserId.isBlank()) {
            throw new IllegalStateException("Naver profile did not contain a user id");
        }

        String displayName = !nickname.isBlank() ? nickname : name;

        return new NaverUserProfile(providerUserId, email, displayName);
    }

    public record NaverUserProfile(
            String providerUserId,
            String email,
            String displayName
    ) {
    }
}
