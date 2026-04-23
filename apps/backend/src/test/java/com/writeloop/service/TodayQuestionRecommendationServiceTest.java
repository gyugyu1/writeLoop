package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.FeaturedDailyPromptDto;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.PromptEntity;
import com.writeloop.persistence.PromptHintRepository;
import com.writeloop.persistence.PromptRecommendationExposureEntity;
import com.writeloop.persistence.PromptRecommendationExposureRepository;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TodayQuestionRecommendationServiceTest {

    @Mock
    private PromptRepository promptRepository;

    @Mock
    private PromptHintRepository promptHintRepository;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private SavedExpressionRepository savedExpressionRepository;

    @Mock
    private PromptRecommendationExposureRepository promptRecommendationExposureRepository;

    @Mock
    private PromptCoachProfileSupport promptCoachProfileSupport;

    @Mock
    private PromptTaskMetaSupport promptTaskMetaSupport;

    private TodayQuestionRecommendationService recommendationService;

    @BeforeEach
    void setUp() {
        recommendationService = new TodayQuestionRecommendationService(
                promptRepository,
                promptHintRepository,
                answerSessionRepository,
                answerAttemptRepository,
                savedExpressionRepository,
                promptRecommendationExposureRepository,
                promptCoachProfileSupport,
                promptTaskMetaSupport
        );
    }

    @Test
    void recommend_excludes_recently_completed_prompt_and_returns_featured_items() {
        PromptEntity promptOne = prompt("prompt-a-1", "Routine", "Free Time", "A");
        PromptEntity promptTwo = prompt("prompt-a-2", "Preference", "Movie Genre", "A");
        PromptEntity promptThree = prompt("prompt-a-3", "Food", "Lunch", "A");

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(7L))
                .thenReturn(List.of(completedSession("session-1", "prompt-a-1", 7L)));
        when(answerAttemptRepository.findBySessionIdInOrderByCreatedAtAsc(any()))
                .thenReturn(List.of(new AnswerAttemptEntity(
                        "session-1",
                        1,
                        AttemptType.INITIAL,
                        "I relax at home.",
                        82,
                        "good",
                        "[]",
                        "[]",
                        "Model answer",
                        "Rewrite challenge",
                        null
                )));
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(7L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenReturn(List.of());

        DailyPromptRecommendationDto recommendation = recommendationService.recommend(DailyDifficultyDto.A, 7L, null);

        assertThat(recommendation.featured()).isNotNull();
        assertThat(recommendation.featured().prompt().id()).isNotEqualTo("prompt-a-1");
        assertThat(recommendation.prompts()).extracting("id")
                .contains("prompt-a-2", "prompt-a-3");
        assertThat(recommendation.featured().reasonCode()).isNotBlank();
        verify(promptRecommendationExposureRepository, atLeastOnce()).save(any(PromptRecommendationExposureEntity.class));
    }

    @Test
    void recommend_introDifficulty_returnsOnlyIntroPrompts() {
        PromptEntity introOne = prompt("prompt-intro-1", "Routine", "Before Bed", "I");
        PromptEntity introTwo = prompt("prompt-intro-2", "Preference", "Favorite Food", "I");
        PromptEntity easyPrompt = prompt("prompt-a-1", "Routine", "After Dinner", "A");

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(introOne, introTwo, easyPrompt));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(introOne, introTwo, easyPrompt));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(5L)).thenReturn(List.of());
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(5L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenReturn(List.of());

        DailyPromptRecommendationDto recommendation = recommendationService.recommend(DailyDifficultyDto.I, 5L, null);

        assertThat(recommendation.prompts()).extracting("difficulty").containsOnly("I");
        assertThat(recommendation.prompts()).extracting("id")
                .contains("prompt-intro-1", "prompt-intro-2")
                .doesNotContain("prompt-a-1");
    }

    @Test
    void recommend_marksFallbackUsed_when_recent_exposure_removes_all_strict_candidates() {
        PromptEntity promptOne = prompt("prompt-a-4", "Routine", "Home", "A");

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(promptOne));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(promptOne));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(9L)).thenReturn(List.of());
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(9L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenReturn(List.of(new PromptRecommendationExposureEntity(
                        java.time.LocalDate.now(),
                        9L,
                        null,
                        "A",
                        "prompt-a-4",
                        "FEATURED",
                        "QUICK_START",
                        80
                )));

        DailyPromptRecommendationDto recommendation = recommendationService.recommend(DailyDifficultyDto.A, 9L, null);

        assertThat(recommendation.fallbackUsed()).isTrue();
        assertThat(recommendation.prompts()).singleElement().extracting("id").isEqualTo("prompt-a-4");
    }

    @Test
    void recommendFeatured_saves_only_prepick_featured_exposure() {
        PromptEntity promptOne = prompt("prompt-a-2", "Preference", "Movie Genre", "A");
        PromptEntity promptTwo = prompt("prompt-a-3", "Food", "Lunch", "A");

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(promptOne, promptTwo));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(promptOne, promptTwo));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(21L)).thenReturn(List.of());
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(21L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenReturn(List.of());

        FeaturedDailyPromptDto recommendation = recommendationService.recommendFeatured(DailyDifficultyDto.A, 21L, null);

        assertThat(recommendation.featured()).isNotNull();
        ArgumentCaptor<PromptRecommendationExposureEntity> exposureCaptor =
                ArgumentCaptor.forClass(PromptRecommendationExposureEntity.class);
        verify(promptRecommendationExposureRepository).save(exposureCaptor.capture());
        verify(promptRecommendationExposureRepository, never()).saveAll(any());
        assertThat(exposureCaptor.getValue().getSlotType()).isEqualTo("PREPICK_FEATURED");
        assertThat(exposureCaptor.getValue().getPromptId()).isEqualTo(recommendation.featured().prompt().id());
    }

    @Test
    void recommend_keeps_same_featured_prompt_for_the_same_day() {
        PromptEntity promptOne = prompt("prompt-a-2", "Preference", "Movie Genre", "A");
        PromptEntity promptTwo = prompt("prompt-a-3", "Food", "Lunch", "A");
        PromptEntity promptThree = prompt("prompt-a-4", "Routine", "Weekend", "A");
        List<PromptRecommendationExposureEntity> exposures = new ArrayList<>();

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(25L)).thenReturn(List.of());
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(25L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenAnswer(invocation -> List.copyOf(exposures));

        FeaturedDailyPromptDto featuredRecommendation =
                recommendationService.recommendFeatured(DailyDifficultyDto.A, 25L, null);
        exposures.add(new PromptRecommendationExposureEntity(
                LocalDate.now(),
                25L,
                null,
                "A",
                featuredRecommendation.featured().prompt().id(),
                "PREPICK_FEATURED",
                featuredRecommendation.featured().reasonCode(),
                featuredRecommendation.featured().score()
        ));

        DailyPromptRecommendationDto dailyRecommendation =
                recommendationService.recommend(DailyDifficultyDto.A, 25L, null);

        assertThat(dailyRecommendation.featured()).isNotNull();
        assertThat(dailyRecommendation.featured().prompt().id())
                .isEqualTo(featuredRecommendation.featured().prompt().id());
        assertThat(dailyRecommendation.prompts()).isNotEmpty();
        assertThat(dailyRecommendation.prompts().get(0).id())
                .isEqualTo(featuredRecommendation.featured().prompt().id());
    }

    @Test
    void recommend_skips_pinned_featured_when_that_prompt_was_completed_today() {
        PromptEntity promptOne = prompt("prompt-a-2", "Preference", "Movie Genre", "A");
        PromptEntity promptTwo = prompt("prompt-a-3", "Food", "Lunch", "A");
        PromptEntity promptThree = prompt("prompt-a-4", "Routine", "Weekend", "A");
        List<PromptRecommendationExposureEntity> exposures = new ArrayList<>();

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(31L))
                .thenReturn(List.of(completedSessionToday("session-31", "prompt-a-2", 31L)));
        when(answerAttemptRepository.findBySessionIdInOrderByCreatedAtAsc(any()))
                .thenReturn(List.of());
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(31L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenAnswer(invocation -> List.copyOf(exposures));

        FeaturedDailyPromptDto featuredRecommendation =
                recommendationService.recommendFeatured(DailyDifficultyDto.A, 31L, null);
        exposures.add(new PromptRecommendationExposureEntity(
                LocalDate.now(),
                31L,
                null,
                "A",
                featuredRecommendation.featured().prompt().id(),
                "PREPICK_FEATURED",
                featuredRecommendation.featured().reasonCode(),
                featuredRecommendation.featured().score()
        ));

        DailyPromptRecommendationDto dailyRecommendation =
                recommendationService.recommend(DailyDifficultyDto.A, 31L, null);

        assertThat(dailyRecommendation.featured()).isNotNull();
        assertThat(dailyRecommendation.featured().prompt().id()).isNotEqualTo("prompt-a-2");
    }

    @Test
    void recommend_respects_excluded_prompt_ids_for_same_day_refresh() {
        PromptEntity promptOne = prompt("prompt-a-2", "Preference", "Movie Genre", "A");
        PromptEntity promptTwo = prompt("prompt-a-3", "Food", "Lunch", "A");
        PromptEntity promptThree = prompt("prompt-a-4", "Routine", "Weekend", "A");

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(promptOne, promptTwo, promptThree));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(37L)).thenReturn(List.of());
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(37L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenReturn(List.of());

        DailyPromptRecommendationDto recommendation = recommendationService.recommend(
                DailyDifficultyDto.A,
                37L,
                null,
                List.of("prompt-a-2", "prompt-a-3")
        );

        assertThat(recommendation.prompts()).extracting("id")
                .containsExactly("prompt-a-4");
    }

    @Test
    void recordClick_updatesCanonicalExposureForToday() {
        PromptRecommendationExposureEntity exposure = new PromptRecommendationExposureEntity(
                LocalDate.now(),
                11L,
                null,
                "A",
                "prompt-a-7",
                "FEATURED",
                "QUICK_START",
                88
        );
        when(promptRecommendationExposureRepository
                .findByUserIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(11L), eq("prompt-a-7"), any(LocalDate.class)))
                .thenReturn(List.of(exposure));

        recommendationService.recordClick("prompt-a-7", 11L, null);

        assertThat(exposure.getClickedAt()).isNotNull();
        verify(promptRecommendationExposureRepository).save(exposure);
    }

    @Test
    void recordStartAndComplete_fillSessionTrackingFields() {
        PromptRecommendationExposureEntity exposure = new PromptRecommendationExposureEntity(
                LocalDate.now(),
                15L,
                null,
                "A",
                "prompt-a-9",
                "FEATURED",
                "QUICK_START",
                86
        );
        when(promptRecommendationExposureRepository
                .findByUserIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(15L), eq("prompt-a-9"), any(LocalDate.class)))
                .thenReturn(List.of(exposure));

        recommendationService.recordStart("prompt-a-9", 15L, null, "session-15");
        recommendationService.recordComplete("prompt-a-9", 15L, null, "session-15");

        assertThat(exposure.getClickedAt()).isNotNull();
        assertThat(exposure.getStartedSessionId()).isEqualTo("session-15");
        assertThat(exposure.getCompletedSessionId()).isEqualTo("session-15");
        verify(promptRecommendationExposureRepository, times(2)).save(exposure);
    }

    @Test
    void recordStart_dedupes_same_day_duplicate_exposures_before_tracking() {
        PromptRecommendationExposureEntity earlierExposure = new PromptRecommendationExposureEntity(
                LocalDate.now(),
                17L,
                null,
                "A",
                "prompt-a-11",
                "PREPICK_FEATURED",
                "QUICK_START",
                80
        );
        PromptRecommendationExposureEntity laterExposure = new PromptRecommendationExposureEntity(
                LocalDate.now(),
                17L,
                null,
                "A",
                "prompt-a-11",
                "FEATURED",
                "STREAK_KEEPER",
                92
        );
        forceShownAt(earlierExposure, Instant.now().minus(2, ChronoUnit.HOURS));
        forceShownAt(laterExposure, Instant.now().minus(1, ChronoUnit.HOURS));
        laterExposure.markClicked();

        when(promptRecommendationExposureRepository
                .findByUserIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(17L), eq("prompt-a-11"), any(LocalDate.class)))
                .thenReturn(List.of(earlierExposure, laterExposure));

        recommendationService.recordStart("prompt-a-11", 17L, null, "session-17");

        assertThat(earlierExposure.getSlotType()).isEqualTo("FEATURED");
        assertThat(earlierExposure.getReasonCode()).isEqualTo("STREAK_KEEPER");
        assertThat(earlierExposure.getClickedAt()).isNotNull();
        assertThat(earlierExposure.getStartedSessionId()).isEqualTo("session-17");
        verify(promptRecommendationExposureRepository).deleteAll(List.of(laterExposure));
        verify(promptRecommendationExposureRepository, times(2)).save(earlierExposure);
    }

    @Test
    void recordStart_claims_guest_exposure_for_authenticated_user_handoff() {
        String guestId = "guest-1234567890abcdef12";
        PromptRecommendationExposureEntity guestExposure = new PromptRecommendationExposureEntity(
                LocalDate.now(),
                null,
                guestId,
                "A",
                "prompt-a-13",
                "PREPICK_FEATURED",
                "QUICK_START",
                78
        );

        when(promptRecommendationExposureRepository
                .findByUserIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(19L), eq("prompt-a-13"), any(LocalDate.class)))
                .thenReturn(List.of());
        when(promptRecommendationExposureRepository
                .findByGuestIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(guestId), eq("prompt-a-13"), any(LocalDate.class)))
                .thenReturn(List.of(guestExposure));

        recommendationService.recordStart("prompt-a-13", 19L, guestId, "session-19");

        assertThat(guestExposure.getUserId()).isEqualTo(19L);
        assertThat(guestExposure.getGuestId()).isNull();
        assertThat(guestExposure.getStartedSessionId()).isEqualTo("session-19");
        verify(promptRecommendationExposureRepository, times(2)).save(guestExposure);
    }

    @Test
    void recordStart_doesNotDeleteSameExposureReturnedByUserAndGuestLookup() {
        String guestId = "guest-abcdef123456789012";
        PromptRecommendationExposureEntity exposure = new PromptRecommendationExposureEntity(
                LocalDate.now(),
                21L,
                guestId,
                "A",
                "prompt-a-14",
                "FEATURED",
                "QUICK_START",
                90
        );

        when(promptRecommendationExposureRepository
                .findByUserIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(21L), eq("prompt-a-14"), any(LocalDate.class)))
                .thenReturn(List.of(exposure));
        when(promptRecommendationExposureRepository
                .findByGuestIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(guestId), eq("prompt-a-14"), any(LocalDate.class)))
                .thenReturn(List.of(exposure));

        recommendationService.recordStart("prompt-a-14", 21L, guestId, "session-21");

        assertThat(exposure.getUserId()).isEqualTo(21L);
        assertThat(exposure.getGuestId()).isNull();
        assertThat(exposure.getStartedSessionId()).isEqualTo("session-21");
        verify(promptRecommendationExposureRepository, never()).deleteAll(any());
        verify(promptRecommendationExposureRepository, times(2)).save(exposure);
    }

    @Test
    void recommend_recovers_when_same_day_insert_hits_unique_constraint() {
        PromptEntity promptOne = prompt("prompt-a-15", "Routine", "Lunch Break", "A");
        PromptRecommendationExposureEntity existingExposure = new PromptRecommendationExposureEntity(
                LocalDate.now(),
                41L,
                null,
                "A",
                "prompt-a-15",
                "FEATURED",
                "QUICK_START",
                84
        );

        when(promptRepository.findAllByActiveTrueOrderByDisplayOrderAsc())
                .thenReturn(List.of(promptOne));
        when(promptRepository.findAllById(anyCollection()))
                .thenReturn(List.of(promptOne));
        when(promptHintRepository.findAllByPromptIdInAndActiveTrueOrderByPromptIdAscDisplayOrderAsc(anyCollection()))
                .thenReturn(List.of());
        when(answerSessionRepository.findByUserIdOrderByCreatedAtDesc(41L)).thenReturn(List.of());
        when(savedExpressionRepository.findTop50ByUserIdOrderByLastSavedAtDesc(41L)).thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateGreaterThanEqualOrderByShownAtDesc(any(), any()))
                .thenReturn(List.of());
        when(promptRecommendationExposureRepository.findByUserIdAndRecommendedDateOrderByShownAtAsc(eq(41L), any(LocalDate.class)))
                .thenReturn(List.of());
        when(promptRecommendationExposureRepository
                .findByUserIdAndPromptIdAndRecommendedDateOrderByShownAtAsc(eq(41L), eq("prompt-a-15"), any(LocalDate.class)))
                .thenReturn(List.of())
                .thenReturn(List.of(existingExposure));
        when(promptRecommendationExposureRepository.save(any(PromptRecommendationExposureEntity.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate daily exposure"))
                .thenReturn(existingExposure);

        DailyPromptRecommendationDto recommendation = recommendationService.recommend(DailyDifficultyDto.A, 41L, null);

        assertThat(recommendation.prompts()).extracting("id").containsExactly("prompt-a-15");
        verify(promptRecommendationExposureRepository, times(2)).save(any(PromptRecommendationExposureEntity.class));
    }

    private PromptEntity prompt(String id, String topicCategory, String topicDetail, String difficulty) {
        return new PromptEntity(
                id,
                topicCategory,
                topicDetail,
                difficulty,
                "What do you usually do?",
                "질문",
                "tip",
                1,
                true
        );
    }

    private AnswerSessionEntity completedSession(String sessionId, String promptId, Long userId) {
        AnswerSessionEntity session = new AnswerSessionEntity(
                sessionId,
                promptId,
                null,
                userId,
                SessionStatus.COMPLETED
        );
        forceCreatedAt(session, Instant.now().minus(1, ChronoUnit.DAYS));
        forceUpdatedAt(session, Instant.now().minus(1, ChronoUnit.DAYS));
        return session;
    }

    private AnswerSessionEntity completedSessionToday(String sessionId, String promptId, Long userId) {
        AnswerSessionEntity session = new AnswerSessionEntity(
                sessionId,
                promptId,
                null,
                userId,
                SessionStatus.COMPLETED
        );
        forceCreatedAt(session, Instant.now().minus(2, ChronoUnit.HOURS));
        forceUpdatedAt(session, Instant.now().minus(1, ChronoUnit.HOURS));
        return session;
    }

    private void forceCreatedAt(AnswerSessionEntity session, Instant createdAt) {
        try {
            var field = AnswerSessionEntity.class.getDeclaredField("createdAt");
            field.setAccessible(true);
            field.set(session, createdAt);
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void forceUpdatedAt(AnswerSessionEntity session, Instant updatedAt) {
        try {
            var field = AnswerSessionEntity.class.getDeclaredField("updatedAt");
            field.setAccessible(true);
            field.set(session, updatedAt);
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void forceShownAt(PromptRecommendationExposureEntity exposure, Instant shownAt) {
        try {
            var field = PromptRecommendationExposureEntity.class.getDeclaredField("shownAt");
            field.setAccessible(true);
            field.set(exposure, shownAt);
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
