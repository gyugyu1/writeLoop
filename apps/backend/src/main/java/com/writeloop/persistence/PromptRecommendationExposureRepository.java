package com.writeloop.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PromptRecommendationExposureRepository extends JpaRepository<PromptRecommendationExposureEntity, Long> {

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

    Optional<PromptRecommendationExposureEntity> findFirstByUserIdAndPromptIdAndRecommendedDateOrderByShownAtDesc(
            Long userId,
            String promptId,
            LocalDate recommendedDate
    );

    Optional<PromptRecommendationExposureEntity> findFirstByGuestIdAndPromptIdAndRecommendedDateOrderByShownAtDesc(
            String guestId,
            String promptId,
            LocalDate recommendedDate
    );
}
