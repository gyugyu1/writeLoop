package com.writeloop.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** 계정의 룹 잔액. 계정마다 한 행이고, 처음 만들 때 시작 선물이 들어 있다(LoopPointBalanceRepository.insertIfAbsent). */
@Entity
@Table(name = "loop_point_balances")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoopPointBalanceEntity {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "balance", nullable = false)
    private Integer balance;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** 잔액을 바꾼다. 0 아래로는 내려가지 않는다(나가는 쪽은 부르기 전에 잔액을 확인한다). */
    public void change(int amount, Instant now) {
        int next = balance + amount;
        if (next < 0) {
            throw new IllegalStateException("룹 잔액이 모자라요.");
        }
        balance = next;
        updatedAt = now;
    }
}
