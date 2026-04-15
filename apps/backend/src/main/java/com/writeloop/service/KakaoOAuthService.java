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
public class KakaoOAuthService {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Value("${app.oauth.kakao.client-id:}")
    private String clientId;

    @Value("${app.oauth.kakao.client-secret:}")
    private String clientSecret;

    @Value("${app.oauth.kakao.authorization-uri:https://kauth.kakao.com/oauth/authorize}")
    private String authorizationUri;

    @Value("${app.oauth.kakao.token-uri:https://kauth.kakao.com/oauth/token}")
    private String tokenUri;

    @Value("${app.oauth.kakao.user-info-uri:https://kapi.kakao.com/v2/user/me}")
    private String userInfoUri;

    @Value("${app.oauth.kakao.redirect-uri:}")
    private String redirectUri;

    public boolean isConfigured() {
        return clientId != null && !clientId.isBlank();
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

    public KakaoUserProfile fetchUserProfile(String code) {
        if (!isConfigured()) {
            throw new IllegalStateException("Kakao OAuth is not configured");
        }

        try {
            String accessToken = requestAccessToken(code);
            return requestUserProfile(accessToken);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new IllegalStateException("Failed to communicate with Kakao OAuth API", exception);
        }
    }

    private String requestAccessToken(String code) throws IOException, InterruptedException {
        String requestBody = "grant_type=authorization_code"
                + "&client_id=" + encode(clientId)
                + "&redirect_uri=" + encode(redirectUri)
                + "&code=" + encode(code)
                + (clientSecret == null || clientSecret.isBlank() ? "" : "&client_secret=" + encode(clientSecret));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenUri))
                .timeout(Duration.ofSeconds(20))
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_FORM_URLENCODED_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Kakao token request failed with status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String accessToken = root.path("access_token").asText("");
        if (accessToken.isBlank()) {
            throw new IllegalStateException("Kakao token response did not contain access_token");
        }

        return accessToken;
    }

    private KakaoUserProfile requestUserProfile(String accessToken) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(userInfoUri))
                .timeout(Duration.ofSeconds(20))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IllegalStateException("Kakao profile request failed with status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String providerUserId = root.path("id").asText("");
        JsonNode account = root.path("kakao_account");
        String email = account.path("email").asText("");
        String displayName = account.path("profile").path("nickname").asText("");

        if (providerUserId.isBlank()) {
            throw new IllegalStateException("Kakao profile did not contain a user id");
        }

        return new KakaoUserProfile(providerUserId, email, displayName);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record KakaoUserProfile(
            String providerUserId,
            String email,
            String displayName
    ) {
    }
}
