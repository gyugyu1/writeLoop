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
@Table(name = "diary_attempts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DiaryAttemptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_id", nullable = false, length = 64)
    private String entryId;

    @Column(name = "attempt_no", nullable = false)
    private Integer attemptNo;

    @Column(name = "diary_text", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String diaryText;

    @Column(nullable = false)
    private Integer score;

    @Column(name = "answer_band", nullable = false, length = 64)
    private String answerBand;

    @Column(name = "feedback_schema_version", nullable = false, length = 64)
    private String feedbackSchemaVersion;

    @Column(name = "feedback_provider", length = 32)
    private String feedbackProvider;

    @Column(name = "feedback_model", length = 128)
    private String feedbackModel;

    @Column(name = "feedback_summary", nullable = false, columnDefinition = "TEXT")
    private String feedbackSummary;

    @Column(name = "strengths_json", nullable = false, columnDefinition = "JSON")
    private String strengthsJson;

    @Column(name = "corrections_json", nullable = false, columnDefinition = "JSON")
    private String correctionsJson;

    @Column(name = "model_answer", nullable = false, columnDefinition = "MEDIUMTEXT")
    private String modelAnswer;

    @Column(name = "rewrite_challenge", nullable = false, columnDefinition = "TEXT")
    private String rewriteChallenge;

    @Column(name = "feedback_payload_json", columnDefinition = "JSON")
    private String feedbackPayloadJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public DiaryAttemptEntity(
            String entryId,
            Integer attemptNo,
            String diaryText,
            Integer score,
            String answerBand,
            String feedbackSchemaVersion,
            String feedbackProvider,
            String feedbackModel,
            String feedbackSummary,
            String strengthsJson,
            String correctionsJson,
            String modelAnswer,
            String rewriteChallenge,
            String feedbackPayloadJson
    ) {
        this.entryId = entryId;
        this.attemptNo = attemptNo;
        this.diaryText = diaryText;
        this.score = score;
        this.answerBand = answerBand;
        this.feedbackSchemaVersion = feedbackSchemaVersion;
        this.feedbackProvider = feedbackProvider;
        this.feedbackModel = feedbackModel;
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
}
