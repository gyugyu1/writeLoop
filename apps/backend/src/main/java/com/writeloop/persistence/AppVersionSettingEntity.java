package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "app_version_settings")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AppVersionSettingEntity {

    @Id
    @Column(nullable = false, length = 16)
    private String platform;

    @Column(name = "latest_version", nullable = false, length = 32)
    private String latestVersion;

    @Column(name = "minimum_supported_version", nullable = false, length = 32)
    private String minimumSupportedVersion;

    @Column(name = "store_url", length = 512)
    private String storeUrl;

    @Column(name = "optional_title_ko", nullable = false, length = 120)
    private String optionalTitleKo;

    @Column(name = "forced_title_ko", nullable = false, length = 120)
    private String forcedTitleKo;

    @Column(name = "optional_message_ko", nullable = false, length = 512)
    private String optionalMessageKo;

    @Column(name = "forced_message_ko", nullable = false, length = 512)
    private String forcedMessageKo;

    @Column(name = "release_notes_ko", nullable = false, length = 512)
    private String releaseNotesKo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public AppVersionSettingEntity(
            String platform,
            String latestVersion,
            String minimumSupportedVersion,
            String storeUrl,
            String optionalTitleKo,
            String forcedTitleKo,
            String optionalMessageKo,
            String forcedMessageKo,
            String releaseNotesKo
    ) {
        this.platform = platform;
        update(
                latestVersion,
                minimumSupportedVersion,
                storeUrl,
                optionalTitleKo,
                forcedTitleKo,
                optionalMessageKo,
                forcedMessageKo,
                releaseNotesKo
        );
    }

    public void update(
            String latestVersion,
            String minimumSupportedVersion,
            String storeUrl,
            String optionalTitleKo,
            String forcedTitleKo,
            String optionalMessageKo,
            String forcedMessageKo,
            String releaseNotesKo
    ) {
        this.latestVersion = latestVersion;
        this.minimumSupportedVersion = minimumSupportedVersion;
        this.storeUrl = storeUrl;
        this.optionalTitleKo = optionalTitleKo;
        this.forcedTitleKo = forcedTitleKo;
        this.optionalMessageKo = optionalMessageKo;
        this.forcedMessageKo = forcedMessageKo;
        this.releaseNotesKo = releaseNotesKo;
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
}
