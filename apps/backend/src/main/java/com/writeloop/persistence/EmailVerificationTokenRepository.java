package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationTokenEntity, Long> {

    Optional<EmailVerificationTokenEntity> findFirstByEmailAndVerificationCodeAndUsedAtIsNullOrderByCreatedAtDesc(
            String email,
            String verificationCode
    );

    Optional<EmailVerificationTokenEntity> findTopByEmailAndUsedAtIsNullOrderByCreatedAtDesc(String email);
}
