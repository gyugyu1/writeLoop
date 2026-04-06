package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AnswerAttemptRepository extends JpaRepository<AnswerAttemptEntity, Long> {

    int countBySessionId(String sessionId);

    Optional<AnswerAttemptEntity> findBySessionIdAndAttemptNo(String sessionId, Integer attemptNo);

    List<AnswerAttemptEntity> findBySessionIdInOrderByCreatedAtAsc(List<String> sessionIds);

    @Query("""
            select count(a)
            from AnswerAttemptEntity a
            where exists (
                select 1
                from AnswerSessionEntity s
                where s.id = a.sessionId and s.userId = :userId
            )
            """)
    long countByUserId(@Param("userId") Long userId);

    void deleteBySessionIdIn(List<String> sessionIds);
}
