package com.writeloop.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface LoopPointBalanceRepository extends JpaRepository<LoopPointBalanceEntity, Long> {

    /**
     * 잔액 행이 없으면 시작 선물을 넣어 만든다. 만들었으면 1, 이미 있으면 0이다.
     * 같은 계정의 첫 요청이 거의 동시에 둘 와도 한 번만 만들어지게 한 문장으로 한다.
     */
    @Modifying(clearAutomatically = true)
    @Query(value = """
            INSERT IGNORE INTO loop_point_balances (user_id, balance, created_at, updated_at)
            VALUES (:userId, :balance, :now, :now)
            """, nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId, @Param("balance") int balance, @Param("now") Instant now);

    /** 잔액 행을 잠가 읽는다. 같은 계정의 적립·주문은 이 잠금으로 하나씩 처리된다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from LoopPointBalanceEntity b where b.userId = :userId")
    Optional<LoopPointBalanceEntity> findForUpdate(@Param("userId") Long userId);

    void deleteAllByUserId(Long userId);
}
