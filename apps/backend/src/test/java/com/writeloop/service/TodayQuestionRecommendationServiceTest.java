package com.writeloop.service;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
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
        verify(promptRecommendationExposureRepository).saveAll(any());
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
    void recordClick_updatesLatestExposureForToday() {
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
                .findFirstByUserIdAndPromptIdAndRecommendedDateOrderByShownAtDesc(eq(11L), eq("prompt-a-7"), any(LocalDate.class)))
                .thenReturn(Optional.of(exposure));

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
                .findFirstByUserIdAndPromptIdAndRecommendedDateOrderByShownAtDesc(eq(15L), eq("prompt-a-9"), any(LocalDate.class)))
                .thenReturn(Optional.of(exposure));

        recommendationService.recordStart("prompt-a-9", 15L, null, "session-15");
        recommendationService.recordComplete("prompt-a-9", 15L, null, "session-15");

        assertThat(exposure.getClickedAt()).isNotNull();
        assertThat(exposure.getStartedSessionId()).isEqualTo("session-15");
        assertThat(exposure.getCompletedSessionId()).isEqualTo("session-15");
        verify(promptRecommendationExposureRepository, times(2)).save(exposure);
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
}
