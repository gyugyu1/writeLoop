package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedExpressionRepository extends JpaRepository<SavedExpressionEntity, Long> {

    Optional<SavedExpressionEntity> findByUserIdAndNormalizedExpression(Long userId, String normalizedExpression);

    List<SavedExpressionEntity> findByUserIdOrderByLastSavedAtDesc(Long userId);

    Optional<SavedExpressionEntity> findByIdAndUserId(Long id, Long userId);

    void deleteAllByUserId(Long userId);
}
