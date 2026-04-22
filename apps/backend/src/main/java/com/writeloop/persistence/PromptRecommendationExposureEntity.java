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
import java.util.Objects;

@Entity
@Table(
        name = "prompt_recommendation_exposures",
        indexes = {
                @Index(name = "idx_prompt_reco_user_date", columnList = "user_id, recommended_date"),
                @Index(name = "idx_prompt_reco_guest_date", columnList = "guest_id, recommended_date"),
                @Index(name = "idx_prompt_reco_prompt_date", columnList = "prompt_id, recommended_date"),
                @Index(name = "idx_prompt_reco_user_prompt_date", columnList = "user_id, prompt_id, recommended_date, shown_at"),
                @Index(name = "idx_prompt_reco_guest_prompt_date", columnList = "guest_id, prompt_id, recommended_date, shown_at")
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

    public boolean updateShownAtIfEarlier(Instant candidateShownAt) {
        if (candidateShownAt == null) {
            return false;
        }
        if (shownAt == null || candidateShownAt.isBefore(shownAt)) {
            shownAt = candidateShownAt;
            return true;
        }
        return false;
    }

    public boolean updateClickedAtIfEarlier(Instant candidateClickedAt) {
        if (candidateClickedAt == null) {
            return false;
        }
        if (clickedAt == null || candidateClickedAt.isBefore(clickedAt)) {
            clickedAt = candidateClickedAt;
            return true;
        }
        return false;
    }

    public boolean adoptStartedSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return false;
        }
        if (startedSessionId == null || startedSessionId.isBlank()) {
            startedSessionId = sessionId;
            return true;
        }
        return false;
    }

    public boolean adoptCompletedSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return false;
        }
        if (completedSessionId == null || completedSessionId.isBlank()) {
            completedSessionId = sessionId;
            return true;
        }
        return false;
    }

    public boolean updateRecommendation(String difficulty, String slotType, String reasonCode, Integer score) {
        boolean changed = false;

        if (difficulty != null && !difficulty.equals(this.difficulty)) {
            this.difficulty = difficulty;
            changed = true;
        }
        if (slotType != null && !slotType.equals(this.slotType)) {
            this.slotType = slotType;
            changed = true;
        }
        if (reasonCode != null && !reasonCode.equals(this.reasonCode)) {
            this.reasonCode = reasonCode;
            changed = true;
        }
        if (score != null && !score.equals(this.score)) {
            this.score = score;
            changed = true;
        }

        return changed;
    }

    public boolean claimAuthenticatedUser(Long userId) {
        if (userId == null) {
            return false;
        }

        boolean changed = false;
        if (!Objects.equals(this.userId, userId)) {
            this.userId = userId;
            changed = true;
        }
        if (this.guestId != null) {
            this.guestId = null;
            changed = true;
        }

        return changed;
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
