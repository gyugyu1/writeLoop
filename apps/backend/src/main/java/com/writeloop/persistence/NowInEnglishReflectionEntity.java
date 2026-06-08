package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "now_in_english_reflections")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NowInEnglishReflectionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "reflection_date", nullable = false)
    private LocalDate reflectionDate;

    @Column(name = "entry_count", nullable = false)
    private int entryCount;

    @Column(name = "entry_signature", nullable = false, length = 64)
    private String entrySignature;

    @Column(name = "headline_ko", nullable = false, length = 80)
    private String headlineKo;

    @Column(name = "summary_ko", nullable = false, columnDefinition = "TEXT")
    private String summaryKo;

    @Column(name = "highlights_json", nullable = false, columnDefinition = "JSON")
    private String highlightsJson;

    @Column(name = "pattern_ko", nullable = false, length = 500)
    private String patternKo;

    @Column(name = "gentle_correction_ko", nullable = false, length = 500)
    private String gentleCorrectionKo;

    @Column(name = "next_action_ko", nullable = false, length = 500)
    private String nextActionKo;

    @Column(name = "next_action_example_en", nullable = false, length = 300)
    private String nextActionExampleEn;

    @Column(name = "expressions_json", nullable = false, columnDefinition = "JSON")
    private String expressionsJson;

    @Column(name = "closing_ko", nullable = false, length = 300)
    private String closingKo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public NowInEnglishReflectionEntity(Long userId, LocalDate reflectionDate) {
        this.userId = userId;
        this.reflectionDate = reflectionDate;
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

    public void updateReflection(
            int entryCount,
            String entrySignature,
            String headlineKo,
            String summaryKo,
            String highlightsJson,
            String patternKo,
            String gentleCorrectionKo,
            String nextActionKo,
            String nextActionExampleEn,
            String expressionsJson,
            String closingKo
    ) {
        this.entryCount = entryCount;
        this.entrySignature = entrySignature;
        this.headlineKo = headlineKo;
        this.summaryKo = summaryKo;
        this.highlightsJson = highlightsJson;
        this.patternKo = patternKo;
        this.gentleCorrectionKo = gentleCorrectionKo;
        this.nextActionKo = nextActionKo;
        this.nextActionExampleEn = nextActionExampleEn;
        this.expressionsJson = expressionsJson;
        this.closingKo = closingKo;
    }
}
