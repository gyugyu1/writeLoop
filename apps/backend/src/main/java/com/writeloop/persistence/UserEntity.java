package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 160)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;

    @Column(name = "social_provider", length = 40)
    private String socialProvider;

    @Column(name = "social_provider_user_id", length = 160)
    private String socialProviderUserId;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UserEntity(String email, String passwordHash, String displayName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.emailVerified = false;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void markEmailVerified() {
        this.emailVerified = true;
        this.verifiedAt = Instant.now();
    }

    public void linkSocialAccount(String provider, String providerUserId) {
        this.socialProvider = provider;
        this.socialProviderUserId = providerUserId;
    }

    public void updateDisplayName(String displayName) {
        if (displayName != null && !displayName.isBlank()) {
            this.displayName = displayName.trim();
        }
    }

    public void completeLocalRegistration(String passwordHash, String displayName) {
        this.passwordHash = passwordHash;
        if (displayName != null && !displayName.isBlank()) {
            this.displayName = displayName.trim();
        }
    }

    public void updatePasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }
}
