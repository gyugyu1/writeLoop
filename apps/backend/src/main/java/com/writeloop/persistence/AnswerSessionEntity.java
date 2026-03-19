package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "answer_sessions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AnswerSessionEntity {

    @Id
    @Column(nullable = false, length = 64)
    private String id;

    @Column(name = "prompt_id", nullable = false, length = 64)
    private String promptId;

    @Column(name = "guest_id", length = 64)
    private String guestId;

    @Column(name = "user_id")
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private SessionStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public AnswerSessionEntity(String id, String promptId, String guestId, Long userId, SessionStatus status) {
        this.id = id;
        this.promptId = promptId;
        this.guestId = guestId;
        this.userId = userId;
        this.status = status;
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

    public void setStatus(SessionStatus status) {
        this.status = status;
    }

    public void assignToUser(Long userId) {
        this.userId = userId;
        this.guestId = null;
    }
}
