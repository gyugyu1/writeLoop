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
import java.time.LocalDate;

@Entity
@Table(
        name = "prompt_recommendation_exposures",
        indexes = {
                @Index(name = "idx_prompt_reco_user_date", columnList = "user_id, recommended_date"),
                @Index(name = "idx_prompt_reco_guest_date", columnList = "guest_id, recommended_date"),
                @Index(name = "idx_prompt_reco_prompt_date", columnList = "prompt_id, recommended_date")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptRecommendationExposureEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recommended_date", nullable = false)
    private LocalDate recommendedDate;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "guest_id", length = 128)
    private String guestId;

    @Column(nullable = false, length = 16)
    private String difficulty;

    @Column(name = "prompt_id", nullable = false, length = 64)
    private String promptId;

    @Column(name = "slot_type", nullable = false, length = 32)
    private String slotType;

    @Column(name = "reason_code", nullable = false, length = 64)
    private String reasonCode;

    @Column(nullable = false)
    private Integer score;

    @Column(name = "shown_at", nullable = false)
    private Instant shownAt;

    @Column(name = "clicked_at")
    private Instant clickedAt;

    @Column(name = "started_session_id", length = 64)
    private String startedSessionId;

    @Column(name = "completed_session_id", length = 64)
    private String completedSessionId;

    public PromptRecommendationExposureEntity(
            LocalDate recommendedDate,
            Long userId,
            String guestId,
            String difficulty,
            String promptId,
            String slotType,
            String reasonCode,
            Integer score
    ) {
        this.recommendedDate = recommendedDate;
        this.userId = userId;
        this.guestId = guestId;
        this.difficulty = difficulty;
        this.promptId = promptId;
        this.slotType = slotType;
        this.reasonCode = reasonCode;
        this.score = score;
        this.shownAt = Instant.now();
    }

    public void markClicked() {
        if (clickedAt == null) {
            clickedAt = Instant.now();
        }
    }

    public void markStartedSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        markClicked();
        if (startedSessionId == null || startedSessionId.isBlank()) {
            startedSessionId = sessionId;
        }
    }

    public void markCompletedSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        markStartedSession(sessionId);
        if (completedSessionId == null || completedSessionId.isBlank()) {
            completedSessionId = sessionId;
        }
    }

    @PrePersist
    void onCreate() {
        if (shownAt == null) {
            shownAt = Instant.now();
        }
    }
}
