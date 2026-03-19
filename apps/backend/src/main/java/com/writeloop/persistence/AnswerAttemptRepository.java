package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AnswerAttemptRepository extends JpaRepository<AnswerAttemptEntity, Long> {

    int countBySessionId(String sessionId);

    List<AnswerAttemptEntity> findBySessionIdInOrderByCreatedAtAsc(List<String> sessionIds);
}
