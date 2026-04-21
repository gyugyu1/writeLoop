package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(
        name = "saved_expressions",
        indexes = {
                @Index(name = "idx_saved_expressions_user_last_saved", columnList = "user_id, last_saved_at"),
                @Index(name = "idx_saved_expressions_prompt", columnList = "prompt_id"),
                @Index(name = "idx_saved_expressions_coach_request", columnList = "coach_interaction_request_id")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SavedExpressionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 255)
    private String expression;

    @Column(name = "normalized_expression", nullable = false, length = 255)
    private String normalizedExpression;

    @Column(name = "meaning_ko", length = 255)
    private String meaningKo;

    @Column(name = "usage_tip_ko", columnDefinition = "TEXT")
    private String usageTipKo;

    @Column(name = "example_en", columnDefinition = "TEXT")
    private String exampleEn;

    @Column(name = "tags_json", columnDefinition = "TEXT")
    private String tagsJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 32)
    private SavedExpressionSourceType sourceType;

    @Column(name = "prompt_id", length = 64)
    private String promptId;

    @Column(name = "answer_session_id", length = 64)
    private String answerSessionId;

    @Column(name = "answer_attempt_no")
    private Integer answerAttemptNo;

    @Column(name = "coach_interaction_request_id", length = 64)
    private String coachInteractionRequestId;

    @Column(name = "save_count", nullable = false)
    private Integer saveCount;

    @Column(name = "last_saved_at", nullable = false)
    private Instant lastSavedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public SavedExpressionEntity(
            Long userId,
            String expression,
            String normalizedExpression,
            String meaningKo,
            String usageTipKo,
            String exampleEn,
            String tagsJson,
            SavedExpressionSourceType sourceType,
            String promptId,
            String answerSessionId,
            Integer answerAttemptNo,
            String coachInteractionRequestId
    ) {
        this.userId = userId;
        this.expression = expression;
        this.normalizedExpression = normalizedExpression;
        this.meaningKo = meaningKo;
        this.usageTipKo = usageTipKo;
        this.exampleEn = exampleEn;
        this.tagsJson = tagsJson;
        this.sourceType = sourceType;
        this.promptId = promptId;
        this.answerSessionId = answerSessionId;
        this.answerAttemptNo = answerAttemptNo;
        this.coachInteractionRequestId = coachInteractionRequestId;
        this.saveCount = 1;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        lastSavedAt = now;
        if (saveCount == null || saveCount < 1) {
            saveCount = 1;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void refreshSave(
            String expression,
            String meaningKo,
            String usageTipKo,
            String exampleEn,
            String tagsJson,
            SavedExpressionSourceType sourceType,
            String promptId,
            String answerSessionId,
            Integer answerAttemptNo,
            String coachInteractionRequestId
    ) {
        this.expression = expression;
        this.sourceType = sourceType;
        if (meaningKo != null && !meaningKo.isBlank()) {
            this.meaningKo = meaningKo;
        }
        if (usageTipKo != null && !usageTipKo.isBlank()) {
            this.usageTipKo = usageTipKo;
        }
        if (exampleEn != null && !exampleEn.isBlank()) {
            this.exampleEn = exampleEn;
        }
        if (tagsJson != null && !tagsJson.isBlank()) {
            this.tagsJson = tagsJson;
        }
        if (promptId != null && !promptId.isBlank()) {
            this.promptId = promptId;
        }
        if (answerSessionId != null && !answerSessionId.isBlank()) {
            this.answerSessionId = answerSessionId;
        }
        if (answerAttemptNo != null && answerAttemptNo > 0) {
            this.answerAttemptNo = answerAttemptNo;
        }
        if (coachInteractionRequestId != null && !coachInteractionRequestId.isBlank()) {
            this.coachInteractionRequestId = coachInteractionRequestId;
        }
        this.saveCount = (this.saveCount == null ? 0 : this.saveCount) + 1;
        this.lastSavedAt = Instant.now();
    }
}
