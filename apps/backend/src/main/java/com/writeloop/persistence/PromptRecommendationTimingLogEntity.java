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
        name = "prompt_recommendation_timing_logs",
        indexes = {
                @Index(name = "idx_prompt_reco_timing_trace", columnList = "trace_id"),
                @Index(name = "idx_prompt_reco_timing_endpoint_created", columnList = "endpoint_type, created_at"),
                @Index(name = "idx_prompt_reco_timing_phase_created", columnList = "phase, created_at"),
                @Index(name = "idx_prompt_reco_timing_difficulty_created", columnList = "difficulty, created_at"),
                @Index(name = "idx_prompt_reco_timing_user_created", columnList = "user_id, created_at")
        }
)
@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PromptRecommendationTimingLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trace_id", nullable = false, length = 64)
    private String traceId;

    @Column(name = "endpoint_type", nullable = false, length = 32)
    private String endpointType;

    @Column(nullable = false, length = 80)
    private String phase;

    @Column(nullable = false, length = 16)
    private String difficulty;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "guest_id", length = 64)
    private String guestId;

    @Column(name = "exclude_count")
    private Integer excludeCount;

    @Column(name = "candidate_count")
    private Integer candidateCount;

    @Column(name = "result_count")
    private Integer resultCount;

    @Column(name = "fallback_used")
    private Boolean fallbackUsed;

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
