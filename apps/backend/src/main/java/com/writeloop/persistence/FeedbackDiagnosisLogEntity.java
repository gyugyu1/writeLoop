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
                @Index(name = "idx_feedback_diag_band_created", columnList = "diagnosis_answer_band, created_at")
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

    @Column(name = "diagnosis_response_status_code")
    private Integer diagnosisResponseStatusCode;

    @Column(name = "generation_response_status_code")
    private Integer generationResponseStatusCode;

    @Column(name = "regeneration_response_status_code")
    private Integer regenerationResponseStatusCode;

    @Column(name = "diagnosis_response_body_json", columnDefinition = "JSON")
    private String diagnosisResponseBodyJson;

    @Column(name = "generation_response_body_json", columnDefinition = "JSON")
    private String generationResponseBodyJson;

    @Column(name = "regeneration_response_body_json", columnDefinition = "JSON")
    private String regenerationResponseBodyJson;

    @Column(name = "authoritative_feedback", nullable = false)
    private boolean authoritativeFeedback;

    @Column(name = "diagnosis_fallback_used", nullable = false)
    private boolean diagnosisFallbackUsed;

    @Column(name = "deterministic_response_fallback_used", nullable = false)
    private boolean deterministicResponseFallbackUsed;

    @Column(name = "retry_attempted", nullable = false)
    private boolean retryAttempted;

    @Column(name = "diagnosis_score")
    private Integer diagnosisScore;

    @Column(name = "diagnosis_answer_band", length = 32)
    private String diagnosisAnswerBand;

    @Column(name = "diagnosis_task_completion", length = 16)
    private String diagnosisTaskCompletion;

    @Column(name = "diagnosis_on_topic")
    private Boolean diagnosisOnTopic;

    @Column(name = "diagnosis_finishable")
    private Boolean diagnosisFinishable;

    @Column(name = "diagnosis_grammar_severity", length = 16)
    private String diagnosisGrammarSeverity;

    @Column(name = "diagnosis_grammar_issue_count")
    private Integer diagnosisGrammarIssueCount;

    @Column(name = "diagnosis_primary_issue_code", length = 96)
    private String diagnosisPrimaryIssueCode;

    @Column(name = "diagnosis_secondary_issue_code", length = 96)
    private String diagnosisSecondaryIssueCode;

    @Column(name = "diagnosis_minimal_correction", columnDefinition = "TEXT")
    private String diagnosisMinimalCorrection;

    @Column(name = "rewrite_target_action", length = 255)
    private String rewriteTargetAction;

    @Column(name = "rewrite_target_skeleton", columnDefinition = "TEXT")
    private String rewriteTargetSkeleton;

    @Column(name = "rewrite_target_max_new_sentence_count")
    private Integer rewriteTargetMaxNewSentenceCount;

    @Column(name = "expansion_budget", length = 32)
    private String expansionBudget;

    @Column(name = "profile_task_answer_band", length = 32)
    private String profileTaskAnswerBand;

    @Column(name = "profile_task_completion", length = 16)
    private String profileTaskCompletion;

    @Column(name = "profile_task_finishable")
    private Boolean profileTaskFinishable;

    @Column(name = "profile_grammar_severity", length = 16)
    private String profileGrammarSeverity;

    @Column(name = "profile_grammar_issue_count")
    private Integer profileGrammarIssueCount;

    @Column(name = "profile_content_specificity", length = 16)
    private String profileContentSpecificity;

    @Column(name = "profile_has_main_answer")
    private Boolean profileHasMainAnswer;

    @Column(name = "profile_has_reason")
    private Boolean profileHasReason;

    @Column(name = "profile_has_example")
    private Boolean profileHasExample;

    @Column(name = "profile_has_feeling")
    private Boolean profileHasFeeling;

    @Column(name = "profile_has_activity")
    private Boolean profileHasActivity;

    @Column(name = "profile_has_time_or_place")
    private Boolean profileHasTimeOrPlace;

    @Column(name = "diagnosis_payload_json", columnDefinition = "JSON")
    private String diagnosisPayloadJson;

    @Column(name = "answer_profile_json", columnDefinition = "JSON")
    private String answerProfileJson;

    @Column(name = "section_policy_json", columnDefinition = "JSON")
    private String sectionPolicyJson;

    @Column(name = "final_sections_json", columnDefinition = "JSON")
    private String finalSectionsJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
