package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

/** 룹이 들어오고 나간 기록 한 줄. 같은 까닭(reason)과 출처(sourceKey)는 계정마다 한 번만 남는다. */
@Entity
@Table(name = "loop_point_entries")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoopPointEntryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "reason", nullable = false, length = 32)
    private String reason;

    @Column(name = "source_key", nullable = false, length = 100)
    private String sourceKey;

    @Column(name = "amount", nullable = false)
    private Integer amount;

    @Column(name = "reward_date", nullable = false)
    private LocalDate rewardDate;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public LoopPointEntryEntity(Long userId, String reason, String sourceKey, int amount, LocalDate rewardDate, Instant createdAt) {
        this.userId = userId;
        this.reason = reason;
        this.sourceKey = sourceKey;
        this.amount = amount;
        this.rewardDate = rewardDate;
        this.createdAt = createdAt;
    }
}
