package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface FeedbackTimingLogRepository extends JpaRepository<FeedbackTimingLogEntity, Long> {

    @Modifying
    @Query("delete from FeedbackTimingLogEntity e where e.userId = :userId")
    int purgeByUserId(@Param("userId") Long userId);

    @Query("""
            select e.feedbackType as feedbackType, e.success as success, e.elapsedMs as elapsedMs,
                   e.llmInputTokens as llmInputTokens, e.llmCachedInputTokens as llmCachedInputTokens,
                   e.llmOutputTokens as llmOutputTokens
            from FeedbackTimingLogEntity e
            where e.phaseScope = 'LLM' and e.createdAt >= :start and e.createdAt < :end
            """)
    List<FeedbackTimingLlmCallView> findLlmCalls(@Param("start") Instant start, @Param("end") Instant end);
}
