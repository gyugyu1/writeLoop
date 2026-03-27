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

    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    @Column(name = "attempt_no", nullable = false)
    private Integer attemptNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "attempt_type", nullable = false, length = 24)
    private AttemptType attemptType;

    @Column(name = "answer_text", nullable = false, columnDefinition = "TEXT")
    private String answerText;

    @Column(nullable = false)
    private Integer score;

    @Column(name = "feedback_summary", nullable = false, columnDefinition = "TEXT")
    private String feedbackSummary;

    @Column(name = "strengths_json", nullable = false, columnDefinition = "JSON")
    private String strengthsJson;

    @Column(name = "corrections_json", nullable = false, columnDefinition = "JSON")
    private String correctionsJson;

    @Column(name = "model_answer", nullable = false, columnDefinition = "TEXT")
    private String modelAnswer;

    @Column(name = "rewrite_challenge", nullable = false, columnDefinition = "TEXT")
    private String rewriteChallenge;

    @Column(name = "feedback_payload_json", columnDefinition = "JSON")
    private String feedbackPayloadJson;

    @Column(name = "used_coach_expressions_json", columnDefinition = "JSON")
    private String usedCoachExpressionsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public AnswerAttemptEntity(
            String sessionId,
            Integer attemptNo,
            AttemptType attemptType,
            String answerText,
            Integer score,
            String feedbackSummary,
            String strengthsJson,
            String correctionsJson,
            String modelAnswer,
            String rewriteChallenge,
            String feedbackPayloadJson
    ) {
        this.sessionId = sessionId;
        this.attemptNo = attemptNo;
        this.attemptType = attemptType;
        this.answerText = answerText;
        this.score = score;
        this.feedbackSummary = feedbackSummary;
        this.strengthsJson = strengthsJson;
        this.correctionsJson = correctionsJson;
        this.modelAnswer = modelAnswer;
        this.rewriteChallenge = rewriteChallenge;
        this.feedbackPayloadJson = feedbackPayloadJson;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }

    public void updateUsedCoachExpressions(String usedCoachExpressionsJson) {
        this.usedCoachExpressionsJson = usedCoachExpressionsJson;
    }
}
