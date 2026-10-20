package com.writeloop.service;

import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AppleIdentityTokenServiceTest {

    @Test
    void resolveVerifiedEmail_usesSignedEmailClaim() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("apple-user")
                .claim("email", " learner@example.com ")
                .claim("email_verified", "true")
                .build();

        assertThat(AppleIdentityTokenService.resolveVerifiedEmail(claims)).isEqualTo("learner@example.com");
    }

    @Test
    void resolveVerifiedEmail_acceptsBooleanVerifiedClaim() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("apple-user")
                .claim("email", "learner@example.com")
                .claim("email_verified", true)
                .build();

        assertThat(AppleIdentityTokenService.resolveVerifiedEmail(claims)).isEqualTo("learner@example.com");
    }

    @Test
    void resolveVerifiedEmail_returnsBlankWhenTokenHasNoEmail() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("apple-user")
                .build();

        assertThat(AppleIdentityTokenService.resolveVerifiedEmail(claims)).isEmpty();
    }

    @Test
    void resolveVerifiedEmail_rejectsUnverifiedEmail() throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("apple-user")
                .claim("email", "learner@example.com")
                .claim("email_verified", "false")
                .build();

        assertThat(AppleIdentityTokenService.resolveVerifiedEmail(claims)).isEmpty();
    }
}
