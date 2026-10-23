package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface FeedbackDiagnosisLogRepository extends JpaRepository<FeedbackDiagnosisLogEntity, Long> {

    @Modifying
    @Query("delete from FeedbackDiagnosisLogEntity e where e.userId = :userId")
    int purgeByUserId(@Param("userId") Long userId);

    long countByRetryAttemptedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(Instant start, Instant end);

    long countByProviderRetryAttemptedTrueAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(Instant start, Instant end);
}
