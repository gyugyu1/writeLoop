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
@Table(name = "now_in_english_entries")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NowInEnglishEntryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_id", nullable = false, length = 80)
    private String entryId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "entry_text", nullable = false, length = 500)
    private String text;

    @Column(name = "polished_from_entry_id", length = 80)
    private String polishedFromEntryId;

    @Column(name = "polished_from_text", length = 500)
    private String polishedFromText;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public NowInEnglishEntryEntity(
            String entryId,
            Long userId,
            String text,
            LocalDate entryDate,
            Instant createdAt
    ) {
        this.entryId = entryId;
        this.userId = userId;
        this.text = text;
        this.entryDate = entryDate;
        this.createdAt = createdAt;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void setText(String text) {
        this.text = text;
    }

    public void setPolishedFromEntryId(String polishedFromEntryId) {
        this.polishedFromEntryId = polishedFromEntryId;
    }

    public void setPolishedFromText(String polishedFromText) {
        this.polishedFromText = polishedFromText;
    }

    public void setEntryDate(LocalDate entryDate) {
        this.entryDate = entryDate;
    }
}
