package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "email_verification_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailVerificationTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 160)
    private String email;

    @Column(name = "verification_code", nullable = false, length = 12)
    private String verificationCode;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public EmailVerificationTokenEntity(Long userId, String email, String verificationCode, Instant expiresAt) {
        this.userId = userId;
        this.email = email;
        this.verificationCode = verificationCode;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public void markUsed() {
        usedAt = Instant.now();
    }

    public boolean isExpired() {
        return expiresAt.isBefore(Instant.now());
    }
}
