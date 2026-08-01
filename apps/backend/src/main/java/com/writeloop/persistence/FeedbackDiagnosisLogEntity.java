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
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(
        name = "feedback_diagnosis_logs",
        indexes = {
                @Index(name = "idx_feedback_diag_prompt_created", columnList = "prompt_id, created_at"),
                @Index(name = "idx_feedback_diag_session_attempt", columnList = "session_id, attempt_no"),
                @Index(name = "idx_feedback_diag_answer_attempt", columnList = "answer_attempt_id"),
                @Index(name = "idx_feedback_diag_execution_created", columnList = "execution_status, created_at"),
                @Index(name = "idx_feedback_diag_input_created", columnList = "prompt_id, input_fingerprint, created_at")
        }
)
@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FeedbackDiagnosisLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "execution_status", nullable = false, length = 16)
    private FeedbackDiagnosisExecutionStatus executionStatus;

    @Column(name = "answer_attempt_id")
    private Long answerAttemptId;

    @Column(name = "session_id", length = 64)
    private String sessionId;

    @Column(name = "attempt_no")
    private Integer attemptNo;

    @Column(name = "attempt_type", length = 24)
    private String attemptType;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "guest_id", length = 64)
    private String guestId;

    @Column(name = "prompt_id", nullable = false, length = 64)
    private String promptId;

    @Column(name = "input_fingerprint", nullable = false, length = 64)
    private String inputFingerprint;

    @Column(name = "prompt_topic", nullable = false, length = 160)
    private String promptTopic;

    @Column(name = "prompt_topic_category", length = 120)
    private String promptTopicCategory;

    @Column(name = "prompt_topic_detail", length = 160)
    private String promptTopicDetail;

    @Column(name = "prompt_difficulty", nullable = false, length = 16)
    private String promptDifficulty;

    @Column(name = "prompt_question_en", nullable = false, columnDefinition = "TEXT")
    private String promptQuestionEn;

    @Column(name = "prompt_question_ko", nullable = false, columnDefinition = "TEXT")
    private String promptQuestionKo;

    @Column(name = "prompt_hints_json", columnDefinition = "JSON")
    private String promptHintsJson;

    @Column(name = "prompt_task_meta_json", columnDefinition = "JSON")
    private String promptTaskMetaJson;

    @Column(name = "learner_answer", nullable = false, columnDefinition = "TEXT")
    private String learnerAnswer;

    @Column(name = "previous_answer", columnDefinition = "TEXT")
    private String previousAnswer;

    @Column(name = "llm_provider", nullable = false, length = 32)
    private String llmProvider;

    @Column(name = "llm_model", length = 64)
    private String llmModel;

    @Column(name = "reasoning_effort", length = 24)
    private String reasoningEffort;

    @Column(name = "thinking_budget")
    private Integer thinkingBudget;

    @Column(name = "diagnosis_response_status_code")
    private Integer diagnosisResponseStatusCode;

    @Column(name = "regeneration_response_status_code")
    private Integer regenerationResponseStatusCode;

    @Column(name = "diagnosis_response_body_json", columnDefinition = "JSON")
    private String diagnosisResponseBodyJson;

    @Column(name = "regeneration_response_body_json", columnDefinition = "JSON")
    private String regenerationResponseBodyJson;

    @Column(name = "contract_violation_detected", nullable = false)
    private boolean contractViolationDetected;

    @Column(name = "retry_attempted", nullable = false)
    private boolean retryAttempted;

    @Column(name = "contract_retry_succeeded")
    private Boolean contractRetrySucceeded;

    @Column(name = "contract_original_error_reason", columnDefinition = "TEXT")
    private String contractOriginalErrorReason;

    @Column(name = "contract_final_error_reason", columnDefinition = "TEXT")
    private String contractFinalErrorReason;

    @Column(name = "diagnosis_topic_relevance", length = 16)
    private String diagnosisTopicRelevance;

    @Column(name = "diagnosis_utterance_form", length = 16)
    private String diagnosisUtteranceForm;

    @Column(name = "diagnosis_grammar_issue_count")
    private Integer diagnosisGrammarIssueCount;

    @Column(name = "elapsed_ms")
    private Long elapsedMs;

    @Column(name = "llm_input_tokens")
    private Long llmInputTokens;

    @Column(name = "llm_cached_input_tokens")
    private Long llmCachedInputTokens;

    @Column(name = "llm_output_tokens")
    private Long llmOutputTokens;

    @Column(name = "llm_reasoning_tokens")
    private Long llmReasoningTokens;

    @Column(name = "llm_total_tokens")
    private Long llmTotalTokens;

    @Column(name = "diagnosis_payload_json", columnDefinition = "JSON")
    private String diagnosisPayloadJson;

    @Column(name = "final_sections_json", columnDefinition = "JSON")
    private String finalSectionsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
