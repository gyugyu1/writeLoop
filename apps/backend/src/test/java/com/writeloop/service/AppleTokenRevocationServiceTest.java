package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import com.writeloop.exception.ApiException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AppleTokenRevocationServiceTest {

    private HttpServer server;
    private final List<String> tokenRequests = new CopyOnWriteArrayList<>();
    private final List<String> revokeRequests = new CopyOnWriteArrayList<>();
    private volatile int tokenStatus = 200;
    private KeyPair keyPair;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        keyPair = generator.generateKeyPair();

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/auth/token", exchange -> {
            tokenRequests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = (tokenStatus == 200
                    ? "{\"access_token\":\"access-1\",\"refresh_token\":\"refresh-1\"}"
                    : "{\"error\":\"invalid_grant\"}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(tokenStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.createContext("/auth/revoke", exchange -> {
            revokeRequests.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void exchangesTheCodeAndRevokesTheRefreshToken() throws Exception {
        AppleTokenRevocationService service = service(pemOf(keyPair));

        service.revokeWithAuthorizationCode("code-1");

        Map<String, String> tokenForm = parseForm(tokenRequests.get(0));
        assertThat(tokenForm).containsEntry("grant_type", "authorization_code")
                .containsEntry("code", "code-1")
                .containsEntry("client_id", "kr.writeloop");
        SignedJWT clientSecret = SignedJWT.parse(tokenForm.get("client_secret"));
        assertThat(clientSecret.verify(new ECDSAVerifier((ECPublicKey) keyPair.getPublic()))).isTrue();
        assertThat(clientSecret.getHeader().getKeyID()).isEqualTo("KEY123");
        assertThat(clientSecret.getJWTClaimsSet().getIssuer()).isEqualTo("TEAM123");
        assertThat(clientSecret.getJWTClaimsSet().getSubject()).isEqualTo("kr.writeloop");
        assertThat(clientSecret.getJWTClaimsSet().getAudience()).containsExactly("https://appleid.apple.com");

        Map<String, String> revokeForm = parseForm(revokeRequests.get(0));
        assertThat(revokeForm).containsEntry("token", "refresh-1")
                .containsEntry("token_type_hint", "refresh_token");
    }

    @Test
    void readsAKeyWrittenOnOneLineWithEscapedNewlines() throws Exception {
        AppleTokenRevocationService service = service(pemOf(keyPair).replace("\n", "\\n"));

        service.revokeWithAuthorizationCode("code-1");

        assertThat(revokeRequests).hasSize(1);
    }

    @Test
    void asksToRetryWhenTheCodeIsExpiredAndDoesNotRevoke() throws Exception {
        tokenStatus = 400;
        AppleTokenRevocationService service = service(pemOf(keyPair));

        assertThatThrownBy(() -> service.revokeWithAuthorizationCode("expired-code"))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getCode()).isEqualTo("APPLE_REAUTH_FAILED"));
        assertThat(revokeRequests).isEmpty();
    }

    @Test
    void skipsRevocationWhenTheAppleKeyIsNotConfigured() {
        AppleTokenRevocationService service = service("");

        service.revokeWithAuthorizationCode("code-1");

        assertThat(service.isConfigured()).isFalse();
        assertThat(tokenRequests).isEmpty();
    }

    private AppleTokenRevocationService service(String privateKeyPem) {
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        return new AppleTokenRevocationService(
                new ObjectMapper(),
                "kr.writeloop",
                "TEAM123",
                "KEY123",
                privateKeyPem,
                baseUrl + "/auth/token",
                baseUrl + "/auth/revoke"
        );
    }

    private static String pemOf(KeyPair keyPair) {
        String base64 = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.UTF_8))
                .encodeToString(keyPair.getPrivate().getEncoded());
        return "-----BEGIN PRIVATE KEY-----\n" + base64 + "\n-----END PRIVATE KEY-----\n";
    }

    private static Map<String, String> parseForm(String body) {
        return Arrays.stream(body.split("&"))
                .map(pair -> pair.split("=", 2))
                .collect(Collectors.toMap(
                        pair -> URLDecoder.decode(pair[0], StandardCharsets.UTF_8),
                        pair -> URLDecoder.decode(pair[1], StandardCharsets.UTF_8)
                ));
    }
}
