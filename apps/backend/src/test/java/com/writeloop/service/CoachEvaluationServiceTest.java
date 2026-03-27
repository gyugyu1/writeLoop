package com.writeloop.service;

import com.writeloop.dto.AdminCoachEvaluationRunResponseDto;
import com.writeloop.dto.AdminCoachEvaluationSummaryDto;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.CoachEvaluationStatus;
import com.writeloop.persistence.CoachInteractionEntity;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.CoachResponseSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoachEvaluationServiceTest {

    @Mock
    private CoachInteractionRepository coachInteractionRepository;

    @Mock
    private OpenAiCoachEvaluationClient openAiCoachEvaluationClient;

    private CoachEvaluationService coachEvaluationService;

    @BeforeEach
    void setUp() {
        coachEvaluationService = new CoachEvaluationService(coachInteractionRepository, openAiCoachEvaluationClient);
    }

    @Test
    void getSummary_returns_current_counts() {
        when(openAiCoachEvaluationClient.isConfigured()).thenReturn(true);
        when(coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.NOT_EVALUATED)).thenReturn(5L);
        when(coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.IN_REVIEW)).thenReturn(1L);
        when(coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.APPROPRIATE)).thenReturn(9L);
        when(coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.INAPPROPRIATE)).thenReturn(2L);
        when(coachInteractionRepository.countByEvaluationStatus(CoachEvaluationStatus.NEEDS_REVIEW)).thenReturn(3L);

        AdminCoachEvaluationSummaryDto summary = coachEvaluationService.getSummary();

        assertThat(summary.evaluatorConfigured()).isTrue();
        assertThat(summary.notEvaluatedCount()).isEqualTo(5);
        assertThat(summary.appropriateCount()).isEqualTo(9);
        assertThat(summary.inappropriateCount()).isEqualTo(2);
        assertThat(summary.needsReviewCount()).isEqualTo(3);
    }

    @Test
    void evaluatePendingInteractions_updates_status_with_openai_result() {
        CoachInteractionEntity interaction = new CoachInteractionEntity(
                "interaction-1",
                7L,
                "http-session-1",
                "answer-session-1",
                AttemptType.INITIAL,
                "prompt-1",
                "Growth",
                "EASY",
                "What skill do you want to improve?",
                "어떤 기술을 키우고 싶나요?",
                "Use one clear plan.",
                "[]",
                "스페인어를 배우고 싶다고 말하고 싶어",
                "스페인어를 배우고 싶다고 말하고 싶어",
                null,
                "MEANING_LOOKUP",
                "LEARN",
                "{\"queryMode\":\"MEANING_LOOKUP\"}",
                "표현하고 싶은 뜻에 가까운 표현을 먼저 골랐어요.",
                "[{\"expression\":\"I want to learn Spanish.\"}]",
                CoachResponseSource.DETERMINISTIC_WITH_SLOT_TRANSLATION,
                "gpt-4o"
        );

        when(openAiCoachEvaluationClient.isConfigured()).thenReturn(true);
        when(openAiCoachEvaluationClient.configuredModel()).thenReturn("gpt-4o");
        when(coachInteractionRepository.findByEvaluationStatusOrderByCreatedAtAsc(
                any(CoachEvaluationStatus.class),
                any(Pageable.class)
        )).thenReturn(List.of(interaction));
        when(openAiCoachEvaluationClient.evaluate(interaction)).thenReturn(
                new OpenAiCoachEvaluationClient.CoachEvaluationResult(
                        CoachEvaluationStatus.APPROPRIATE,
                        93,
                        "MEANING_MATCH",
                        "질문 의도와 추천 표현이 잘 맞습니다.",
                        "{\"evaluationStatus\":\"APPROPRIATE\"}"
                )
        );

        AdminCoachEvaluationRunResponseDto result = coachEvaluationService.evaluatePendingInteractions(10);

        assertThat(result.processedCount()).isEqualTo(1);
        assertThat(result.appropriateCount()).isEqualTo(1);
        assertThat(result.inappropriateCount()).isZero();
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).evaluationStatus()).isEqualTo("APPROPRIATE");
        assertThat(interaction.getEvaluationStatus()).isEqualTo(CoachEvaluationStatus.APPROPRIATE);
        assertThat(interaction.getEvaluationScore()).isEqualTo(93);
        assertThat(interaction.getEvaluationVerdict()).isEqualTo("MEANING_MATCH");
        verify(coachInteractionRepository, atLeastOnce()).save(interaction);
    }
}
