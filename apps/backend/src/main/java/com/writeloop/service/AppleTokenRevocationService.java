package com.writeloop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.writeloop.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

// 회원 탈퇴 때 Sign in with Apple 토큰을 해지한다(App Store 심사 기준 5.1.1(v)).
// Apple 토큰은 저장하지 않는다. 탈퇴할 때 앱이 Apple 로그인을 한 번 더 받아 일회용 authorization code를 보내면,
// 그 코드로 토큰을 받아 바로 해지한다. client secret은 Sign in with Apple 키(.p8)로 서명한 짧은 JWT다.
// 키 설정(APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY)이 없으면 해지를 건너뛴다.
@Service
public class AppleTokenRevocationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AppleTokenRevocationService.class);
    private static final String APPLE_AUDIENCE = "https://appleid.apple.com";
    private static final Duration CLIENT_SECRET_LIFETIME = Duration.ofMinutes(5);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String clientId;
    private final String teamId;
    private final String keyId;
    private final String privateKeyPem;
    private final String tokenUri;
    private final String revokeUri;

    public AppleTokenRevocationService(
            ObjectMapper objectMapper,
            @Value("${app.oauth.apple.audience:kr.writeloop}") String clientId,
            @Value("${app.oauth.apple.team-id:}") String teamId,
            @Value("${app.oauth.apple.key-id:}") String keyId,
            @Value("${app.oauth.apple.private-key:}") String privateKeyPem,
            @Value("${app.oauth.apple.token-uri:https://appleid.apple.com/auth/token}") String tokenUri,
            @Value("${app.oauth.apple.revoke-uri:https://appleid.apple.com/auth/revoke}") String revokeUri
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        this.clientId = clientId;
        this.teamId = teamId;
        this.keyId = keyId;
        this.privateKeyPem = privateKeyPem;
        this.tokenUri = tokenUri;
        this.revokeUri = revokeUri;
    }

    public boolean isConfigured() {
        return isNotBlank(clientId) && isNotBlank(teamId) && isNotBlank(keyId) && isNotBlank(privateKeyPem);
    }

    // 해지에 실패하면 예외를 던진다. 탈퇴는 해지가 끝난 뒤에만 진행한다.
    public void revokeWithAuthorizationCode(String authorizationCode) {
        if (!isConfigured()) {
            LOGGER.warn("Skipping Apple token revocation because the Sign in with Apple key is not configured");
            return;
        }

        String clientSecret = buildClientSecret(Instant.now());
        Map<String, String> tokenForm = new LinkedHashMap<>();
        tokenForm.put("client_id", clientId);
        tokenForm.put("client_secret", clientSecret);
        tokenForm.put("code", authorizationCode);
        tokenForm.put("grant_type", "authorization_code");
        HttpResponse<String> tokenResponse = postForm(tokenUri, tokenForm);
        if (tokenResponse.statusCode() == 400) {
            // 코드가 만료됐거나 이미 쓰였다(invalid_grant). 앱에서 Apple 로그인을 다시 받으면 된다.
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "APPLE_REAUTH_FAILED",
                    "Apple 확인이 만료됐어요. 다시 시도해 주세요."
            );
        }
        if (tokenResponse.statusCode() != 200) {
            LOGGER.warn("Apple token exchange failed with status {}", tokenResponse.statusCode());
            throw revocationUnavailable();
        }

        JsonNode tokens = readJson(tokenResponse.body());
        String refreshToken = tokens.path("refresh_token").asText("");
        String accessToken = tokens.path("access_token").asText("");
        boolean useRefreshToken = !refreshToken.isBlank();
        if (!useRefreshToken && accessToken.isBlank()) {
            LOGGER.warn("Apple token exchange returned no token to revoke");
            throw revocationUnavailable();
        }

        Map<String, String> revokeForm = new LinkedHashMap<>();
        revokeForm.put("client_id", clientId);
        revokeForm.put("client_secret", clientSecret);
        revokeForm.put("token", useRefreshToken ? refreshToken : accessToken);
        revokeForm.put("token_type_hint", useRefreshToken ? "refresh_token" : "access_token");
        HttpResponse<String> revokeResponse = postForm(revokeUri, revokeForm);
        if (revokeResponse.statusCode() != 200) {
            LOGGER.warn("Apple token revocation failed with status {}", revokeResponse.statusCode());
            throw revocationUnavailable();
        }
    }

    String buildClientSecret(Instant now) {
        try {
            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(keyId.trim()).build();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(teamId.trim())
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plus(CLIENT_SECRET_LIFETIME)))
                    .audience(APPLE_AUDIENCE)
                    .subject(clientId.trim())
                    .build();
            SignedJWT jwt = new SignedJWT(header, claims);
            jwt.sign(new ECDSASigner(parsePrivateKey(privateKeyPem)));
            return jwt.serialize();
        } catch (Exception exception) {
            LOGGER.warn("Failed to build the Sign in with Apple client secret", exception);
            throw revocationUnavailable();
        }
    }

    // .p8 파일 내용(PKCS#8 PEM). 환경변수에 한 줄로 넣을 때 쓰는 \n도 줄바꿈으로 읽는다.
    static ECPrivateKey parsePrivateKey(String pem) throws Exception {
        String base64 = pem.replace("\\n", "\n")
                .replaceAll("-----BEGIN [A-Z ]+-----", "")
                .replaceAll("-----END [A-Z ]+-----", "")
                .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(base64);
        return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private HttpResponse<String> postForm(String uri, Map<String, String> form) {
        String body = form.entrySet().stream()
                .map(entry -> URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                        + "=" + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        HttpRequest request = HttpRequest.newBuilder(URI.create(uri))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw revocationUnavailable();
        } catch (Exception exception) {
            LOGGER.warn("Apple token request to {} failed", uri, exception);
            throw revocationUnavailable();
        }
    }

    private JsonNode readJson(String body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception exception) {
            throw revocationUnavailable();
        }
    }

    private ApiException revocationUnavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "APPLE_REVOKE_UNAVAILABLE",
                "Apple 계정 연결을 해제하지 못해 탈퇴하지 않았어요. 잠시 후 다시 시도해 주세요."
        );
    }

    private static boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
