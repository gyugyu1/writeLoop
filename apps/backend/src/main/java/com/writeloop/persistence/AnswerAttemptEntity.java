package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "answer_attempts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AnswerAttemptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(
            name = "session_id",
            nullable = false,
            length = 64,
            columnDefinition = "VARCHAR(64) COLLATE utf8mb4_unicode_ci"
    )
    private String sessionId;

    @Column(name = "attempt_no", nullable = false)
    private Integer attemptNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "attempt_type", nullable = false, length = 24)
    private AttemptType attemptType;

    @Column(name = "submission_id", length = 64)
    private String submissionId;

    @Column(name = "answer_text", nullable = false, columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "feedback_summary", nullable = false, columnDefinition = "TEXT")
    private String feedbackSummary;

    @Column(name = "feedback_payload_json", columnDefinition = "JSON")
    private String feedbackPayloadJson;

    @Column(name = "visible_feedback_snapshot_json", columnDefinition = "JSON")
    private String visibleFeedbackSnapshotJson;

    @Column(name = "used_coach_expressions_json", columnDefinition = "JSON")
    private String usedCoachExpressionsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public AnswerAttemptEntity(
            String sessionId,
            Integer attemptNo,
            AttemptType attemptType,
            String answerText,
            String feedbackSummary,
            String feedbackPayloadJson,
            String submissionId,
            String visibleFeedbackSnapshotJson
    ) {
        this.sessionId = sessionId;
        this.attemptNo = attemptNo;
        this.attemptType = attemptType;
        this.answerText = answerText;
        this.feedbackSummary = feedbackSummary;
        this.feedbackPayloadJson = feedbackPayloadJson;
        this.submissionId = submissionId;
        this.visibleFeedbackSnapshotJson = visibleFeedbackSnapshotJson;
    }

    public AnswerAttemptEntity(
            String sessionId,
            Integer attemptNo,
            AttemptType attemptType,
            String answerText,
            String feedbackSummary,
            String feedbackPayloadJson
    ) {
        this(
                sessionId,
                attemptNo,
                attemptType,
                answerText,
                feedbackSummary,
                feedbackPayloadJson,
                null,
                null
        );
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public void updateUsedCoachExpressions(String usedCoachExpressionsJson) {
        this.usedCoachExpressionsJson = usedCoachExpressionsJson;
    }
}
