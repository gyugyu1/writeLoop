package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public interface PromptRecommendationExposureRepository extends JpaRepository<PromptRecommendationExposureEntity, Long> {

    List<PromptRecommendationExposureEntity> findByUserIdAndRecommendedDateOrderByShownAtAsc(
            Long userId,
            LocalDate recommendedDate
    );

    List<PromptRecommendationExposureEntity> findByUserIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(
            Long userId,
            String promptId,
            LocalDate recommendedDate
    );

    List<PromptRecommendationExposureEntity> findByGuestIdAndRecommendedDateOrderByShownAtAsc(
            String guestId,
            LocalDate recommendedDate
    );

    List<PromptRecommendationExposureEntity> findByGuestIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(
            String guestId,
            String promptId,
            LocalDate recommendedDate
    );

    List<PromptRecommendationExposureEntity> findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(
            Long userId,
            LocalDate recommendedDate
    );

    List<PromptRecommendationExposureEntity> findByGuestIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(
            String guestId,
            LocalDate recommendedDate
    );

    List<PromptRecommendationExposureEntity> findByRecommendedDateBetweenOrderByRecommendedDateDescShownAtDesc(
            LocalDate startDate,
            LocalDate endDate
    );

    List<PromptRecommendationExposureEntity> findByRecommendedDateBetweenAndDifficultyOrderByRecommendedDateDescShownAtDesc(
            LocalDate startDate,
            LocalDate endDate,
            String difficulty
    );

    /**
     * 같은 날·같은 사용자·같은 질문의 노출 행을 원자적으로 하나만 만든다. 이미 있으면 아무것도 바꾸지 않는다.
     * 동시 요청이 엔티티 save로 같은 행을 넣으면 유니크 키 위반으로 영속성 컨텍스트가 깨지므로 이 쿼리를 쓴다.
     */
    @Modifying
    @Query(value = """
            insert into prompt_recommendation_exposures
                (recommended_date, user_id, guest_id, difficulty, prompt_id, slot_type, reason_code, score, shown_at)
            values
                (:recommendedDate, :userId, :guestId, :difficulty, :promptId, :slotType, :reasonCode, :score, :shownAt)
            on duplicate key update id = id
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("recommendedDate") LocalDate recommendedDate,
            @Param("userId") Long userId,
            @Param("guestId") String guestId,
            @Param("difficulty") String difficulty,
            @Param("promptId") String promptId,
            @Param("slotType") String slotType,
            @Param("reasonCode") String reasonCode,
            @Param("score") Integer score,
            @Param("shownAt") Instant shownAt
    );

    // 같은 사용자의 노출 기록 쓰기를 직렬화하는 MySQL 이름 잠금. 연결(세션) 단위라 같은 트랜잭션 안에서 풀어야 한다.
    @Query(value = "select get_lock(:name, :timeoutSeconds)", nativeQuery = true)
    Long acquireWriteLock(@Param("name") String name, @Param("timeoutSeconds") int timeoutSeconds);

    @Query(value = "select release_lock(:name)", nativeQuery = true)
    Long releaseWriteLock(@Param("name") String name);

    @Modifying
    @Query("delete from PromptRecommendationExposureEntity e where e.userId = :userId")
    int purgeByUserId(@Param("userId") Long userId);
}
