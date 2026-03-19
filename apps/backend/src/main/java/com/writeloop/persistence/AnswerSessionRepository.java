package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

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

    List<AnswerSessionEntity> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, SessionStatus status);

    List<AnswerSessionEntity> findByUserIdOrderByCreatedAtDesc(Long userId);
}
