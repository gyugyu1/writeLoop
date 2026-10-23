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
        name = "coach_interactions",
        indexes = {
                @Index(name = "idx_coach_interactions_prompt_created", columnList = "prompt_id, created_at"),
                @Index(name = "idx_coach_interactions_user_created", columnList = "user_id, created_at"),
                @Index(name = "idx_coach_interactions_answer_session", columnList = "answer_session_id")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CoachInteractionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, unique = true, length = 64)
    private String requestId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "http_session_id", length = 128)
    private String httpSessionId;

    @Column(name = "answer_session_id", length = 64)
    private String answerSessionId;

    @Column(name = "answer_attempt_no")
    private Integer answerAttemptNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "attempt_context_type", length = 24)
    private AttemptType attemptContextType;

    @Column(name = "prompt_id", nullable = false, length = 64)
    private String promptId;

    @Column(name = "prompt_topic", nullable = false, length = 120)
    private String promptTopic;

    @Column(name = "prompt_difficulty", nullable = false, length = 8)
    private String promptDifficulty;

    @Column(name = "prompt_question_en", nullable = false, columnDefinition = "TEXT")
    private String promptQuestionEn;

    @Column(name = "prompt_question_ko", nullable = false, columnDefinition = "TEXT")
    private String promptQuestionKo;

    @Column(name = "prompt_tip", nullable = false, columnDefinition = "TEXT")
    private String promptTip;

    @Column(name = "user_question", nullable = false, columnDefinition = "TEXT")
    private String userQuestion;

    @Column(name = "normalized_question", nullable = false, columnDefinition = "TEXT")
    private String normalizedQuestion;

    @Column(name = "answer_snapshot", columnDefinition = "TEXT")
    private String answerSnapshot;

    @Column(name = "query_mode", nullable = false, length = 32)
    private String queryMode;

    @Column(name = "meaning_family", length = 48)
    private String meaningFamily;

    @Column(name = "analysis_payload_json", nullable = false, columnDefinition = "JSON")
    private String analysisPayloadJson;

    @Column(name = "coach_reply", nullable = false, columnDefinition = "TEXT")
    private String coachReply;

    @Column(name = "expressions_json", nullable = false, columnDefinition = "JSON")
    private String expressionsJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "response_source", nullable = false, length = 48)
    private CoachResponseSource responseSource;

    @Column(name = "response_model", length = 64)
    private String responseModel;

    @Column(name = "usage_payload_json", columnDefinition = "JSON")
    private String usagePayloadJson;

    @Column(name = "used_expressions_json", columnDefinition = "JSON")
    private String usedExpressionsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public CoachInteractionEntity(
            String requestId,
            Long userId,
            String httpSessionId,
            String answerSessionId,
            AttemptType attemptContextType,
            String promptId,
            String promptTopic,
            String promptDifficulty,
            String promptQuestionEn,
            String promptQuestionKo,
            String promptTip,
            String userQuestion,
            String normalizedQuestion,
            String answerSnapshot,
            String queryMode,
            String meaningFamily,
            String analysisPayloadJson,
            String coachReply,
            String expressionsJson,
            CoachResponseSource responseSource,
            String responseModel
    ) {
        this.requestId = requestId;
        this.userId = userId;
        this.httpSessionId = httpSessionId;
        this.answerSessionId = answerSessionId;
        this.attemptContextType = attemptContextType;
        this.promptId = promptId;
        this.promptTopic = promptTopic;
        this.promptDifficulty = promptDifficulty;
        this.promptQuestionEn = promptQuestionEn;
        this.promptQuestionKo = promptQuestionKo;
        this.promptTip = promptTip;
        this.userQuestion = userQuestion;
        this.normalizedQuestion = normalizedQuestion;
        this.answerSnapshot = answerSnapshot;
        this.queryMode = queryMode;
        this.meaningFamily = meaningFamily;
        this.analysisPayloadJson = analysisPayloadJson;
        this.coachReply = coachReply;
        this.expressionsJson = expressionsJson;
        this.responseSource = responseSource;
        this.responseModel = responseModel;
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

    public void updateUsage(
            String answerSessionId,
            Integer answerAttemptNo,
            String usedExpressionsJson,
            String usagePayloadJson
    ) {
        if (answerSessionId != null && !answerSessionId.isBlank()) {
            this.answerSessionId = answerSessionId;
        }
        this.answerAttemptNo = answerAttemptNo;
        this.usedExpressionsJson = usedExpressionsJson;
        this.usagePayloadJson = usagePayloadJson;
    }
}
