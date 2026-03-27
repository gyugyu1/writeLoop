package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AnswerAttemptRepository extends JpaRepository<AnswerAttemptEntity, Long> {

    int countBySessionId(String sessionId);

    Optional<AnswerAttemptEntity> findBySessionIdAndAttemptNo(String sessionId, Integer attemptNo);

    List<AnswerAttemptEntity> findBySessionIdInOrderByCreatedAtAsc(List<String> sessionIds);

    void deleteBySessionIdIn(List<String> sessionIds);
}
