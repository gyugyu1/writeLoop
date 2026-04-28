package com.writeloop.service;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.writeloop.exception.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
public class AppleIdentityTokenService {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(8);

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(REQUEST_TIMEOUT)
            .build();

    @Value("${app.oauth.apple.audience:kr.writeloop}")
    private String audience;

    @Value("${app.oauth.apple.issuer:https://appleid.apple.com}")
    private String issuer;

    @Value("${app.oauth.apple.jwks-uri:https://appleid.apple.com/auth/keys}")
    private String jwksUri;

    public AppleUserProfile verify(String identityToken, String fallbackEmail, String fallbackDisplayName) {
        if (identityToken == null || identityToken.isBlank()) {
            throw invalidAppleToken();
        }

        try {
            SignedJWT signedJwt = SignedJWT.parse(identityToken.trim());
            JWK signingKey = loadSigningKey(signedJwt.getHeader().getKeyID());
            if (!(signingKey instanceof RSAKey rsaKey)) {
                throw invalidAppleToken();
            }

            JWSVerifier verifier = new RSASSAVerifier(rsaKey.toRSAPublicKey());
            if (!signedJwt.verify(verifier)) {
                throw invalidAppleToken();
            }

            JWTClaimsSet claims = signedJwt.getJWTClaimsSet();
            validateClaims(claims);

            String providerUserId = claims.getSubject();
            String email = firstNonBlank(
                    claims.getStringClaim("email"),
                    fallbackEmail
            );
            String displayName = firstNonBlank(fallbackDisplayName, "Apple user");

            return new AppleUserProfile(providerUserId, email, displayName);
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw invalidAppleToken();
        }
    }

    private JWK loadSigningKey(String keyId) throws Exception {
        if (keyId == null || keyId.isBlank()) {
            throw invalidAppleToken();
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(jwksUri))
                .timeout(REQUEST_TIMEOUT)
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw invalidAppleToken();
        }

        JWK key = JWKSet.parse(response.body()).getKeyByKeyId(keyId);
        if (key == null) {
            throw invalidAppleToken();
        }
        return key;
    }

    private void validateClaims(JWTClaimsSet claims) {
        if (claims == null || claims.getSubject() == null || claims.getSubject().isBlank()) {
            throw invalidAppleToken();
        }

        if (!issuer.equals(claims.getIssuer())) {
            throw invalidAppleToken();
        }

        List<String> audiences = claims.getAudience();
        if (audiences == null || audiences.stream().noneMatch(audience::equals)) {
            throw invalidAppleToken();
        }

        Date expirationTime = claims.getExpirationTime();
        if (expirationTime == null || expirationTime.toInstant().isBefore(Instant.now())) {
            throw invalidAppleToken();
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private ApiException invalidAppleToken() {
        return new ApiException(
                HttpStatus.UNAUTHORIZED,
                "INVALID_APPLE_IDENTITY_TOKEN",
                "Apple 로그인 정보를 확인하지 못했어요. 다시 시도해 주세요."
        );
    }

    public record AppleUserProfile(
            String providerUserId,
            String email,
            String displayName
    ) {
    }
}
