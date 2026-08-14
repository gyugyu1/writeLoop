package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(
        name = "user_feedback",
        indexes = {
                @Index(name = "idx_user_feedback_status_created", columnList = "status, created_at"),
                @Index(name = "idx_user_feedback_category_created", columnList = "category, created_at"),
                @Index(name = "idx_user_feedback_user_created", columnList = "user_id, created_at")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserFeedbackEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 16)
    private String category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "contact_email", length = 320)
    private String contactEmail;

    @Column(name = "source_screen", length = 80)
    private String sourceScreen;

    @Column(name = "app_version", length = 32)
    private String appVersion;

    @Column(length = 16)
    private String platform;

    @Column(name = "os_version", length = 64)
    private String osVersion;

    @Column(name = "device_model", length = 120)
    private String deviceModel;

    @Column(name = "error_code", length = 120)
    private String errorCode;

    @Column(nullable = false, length = 16)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UserFeedbackEntity(
            Long userId,
            String category,
            String message,
            String contactEmail,
            String sourceScreen,
            String appVersion,
            String platform,
            String osVersion,
            String deviceModel,
            String errorCode
    ) {
        this.userId = userId;
        this.category = category;
        this.message = message;
        this.contactEmail = contactEmail;
        this.sourceScreen = sourceScreen;
        this.appVersion = appVersion;
        this.platform = platform;
        this.osVersion = osVersion;
        this.deviceModel = deviceModel;
        this.errorCode = errorCode;
        this.status = "NEW";
    }

    @PrePersist
    void onCreate() {
        if (status == null || status.isBlank()) {
            status = "NEW";
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
