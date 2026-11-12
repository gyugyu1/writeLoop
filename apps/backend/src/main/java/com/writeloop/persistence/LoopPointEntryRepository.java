package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface LoopPointEntryRepository extends JpaRepository<LoopPointEntryEntity, Long> {

    boolean existsByUserIdAndReasonAndSourceKey(Long userId, String reason, String sourceKey);

    /** 그날 그 까닭으로 실제로 룹이 들어온 횟수(한도 때문에 0으로 남은 줄은 빼고). */
    long countByUserIdAndReasonAndRewardDateAndAmountGreaterThan(Long userId, String reason, LocalDate rewardDate, int amount);

    void deleteAllByUserId(Long userId);
}
