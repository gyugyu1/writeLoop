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
        name = "feedback_timing_logs",
        indexes = {
                @Index(name = "idx_feedback_timing_trace", columnList = "trace_id"),
                @Index(name = "idx_feedback_timing_type_created", columnList = "feedback_type, created_at"),
                @Index(name = "idx_feedback_timing_phase_created", columnList = "phase, created_at"),
                @Index(name = "idx_feedback_timing_prompt_created", columnList = "prompt_id, created_at"),
                @Index(name = "idx_feedback_timing_diary_created", columnList = "diary_entry_id, created_at"),
                @Index(name = "idx_feedback_timing_provider_model_created", columnList = "provider, model, created_at")
        }
)
@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FeedbackTimingLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trace_id", nullable = false, length = 64)
    private String traceId;

    @Column(name = "feedback_type", nullable = false, length = 32)
    private String feedbackType;

    @Column(name = "phase_scope", nullable = false, length = 32)
    private String phaseScope;

    @Column(nullable = false, length = 80)
    private String phase;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "guest_id", length = 64)
    private String guestId;

    @Column(name = "prompt_id", length = 64)
    private String promptId;

    @Column(name = "diary_entry_id", length = 64)
    private String diaryEntryId;

    @Column(name = "session_id", length = 64)
    private String sessionId;

    @Column(name = "answer_attempt_id")
    private Long answerAttemptId;

    @Column(name = "diary_attempt_id")
    private Long diaryAttemptId;

    @Column(name = "attempt_no")
    private Integer attemptNo;

    @Column(length = 32)
    private String provider;

    @Column(length = 128)
    private String model;

    @Column(name = "reasoning_effort", length = 32)
    private String reasoningEffort;

    @Column(name = "thinking_budget")
    private Integer thinkingBudget;

    @Column
    private Boolean success;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "exception_class")
    private String exceptionClass;

    @Column(name = "elapsed_ms", nullable = false)
    private Long elapsedMs;

    @Column(name = "metadata_json", columnDefinition = "JSON")
    private String metadataJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
