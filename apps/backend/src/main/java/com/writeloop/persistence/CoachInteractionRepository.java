package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface CoachInteractionRepository extends JpaRepository<CoachInteractionEntity, Long> {

    Optional<CoachInteractionEntity> findByRequestId(String requestId);

    List<CoachInteractionEntity> findByEvaluationStatusOrderByCreatedAtAsc(
            CoachEvaluationStatus evaluationStatus,
            Pageable pageable
    );

    long countByEvaluationStatus(CoachEvaluationStatus evaluationStatus);

    void deleteAllByUserId(Long userId);
}
