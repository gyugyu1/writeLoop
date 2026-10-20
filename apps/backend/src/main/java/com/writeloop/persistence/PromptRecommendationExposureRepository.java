package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Modifying
    @Query("delete from PromptRecommendationExposureEntity e where e.userId = :userId")
    int purgeByUserId(@Param("userId") Long userId);
}
