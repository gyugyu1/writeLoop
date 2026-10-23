package com.writeloop.persistence;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AnswerSessionRepository extends JpaRepository<AnswerSessionEntity, String> {

    long countByGuestId(String guestId);

    long countByUserId(Long userId);

    long countByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(Long userId, Instant start, Instant end);

    long countByUserIdAndStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            Long userId,
            SessionStatus status,
            Instant start,
            Instant end
    );

    long countByUserIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThan(
            Long userId,
            SessionStatus status,
            Instant start,
            Instant end
    );

    List<AnswerSessionEntity> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            Long userId,
            Instant start,
            Instant end
    );

    List<AnswerSessionEntity> findByUserIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtAsc(
            Long userId,
            SessionStatus status,
            Instant start,
            Instant end
    );

    List<AnswerSessionEntity> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, SessionStatus status);

    // 기록 화면의 한 페이지. before보다 먼저 시작한 세션을 최근 순으로 limit개 읽는다.
    List<AnswerSessionEntity> findByUserIdOrderByCreatedAtDesc(Long userId, Limit limit);

    List<AnswerSessionEntity> findByUserIdAndCreatedAtLessThanOrderByCreatedAtDesc(Long userId, Instant before, Limit limit);

    // 연속 학습일 계산용. 세션 전체가 아니라 완료 시각만, 정한 날 이후만 읽는다.
    @Query("""
            select s.updatedAt
            from AnswerSessionEntity s
            where s.userId = :userId and s.status = :status and s.updatedAt >= :since
            order by s.updatedAt desc
            """)
    List<Instant> findUpdatedAtByUserIdAndStatusSince(
            @Param("userId") Long userId,
            @Param("status") SessionStatus status,
            @Param("since") Instant since
    );

    List<AnswerSessionEntity> findByGuestIdOrderByCreatedAtDesc(String guestId);

    List<AnswerSessionEntity> findTop40ByUserIdOrderByCreatedAtDesc(Long userId);

    List<AnswerSessionEntity> findTop40ByGuestIdOrderByCreatedAtDesc(String guestId);

    @Modifying
    @Query("delete from AnswerSessionEntity e where e.userId = :userId")
    int purgeByUserId(@Param("userId") Long userId);
}
