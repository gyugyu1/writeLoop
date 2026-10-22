package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CoachInteractionRepository extends JpaRepository<CoachInteractionEntity, Long> {

    Optional<CoachInteractionEntity> findByRequestId(String requestId);

    void deleteAllByUserId(Long userId);
}
