package com.writeloop.service;

import com.writeloop.dto.SaveExpressionRequestDto;
import com.writeloop.dto.SavedExpressionDto;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.PromptRepository;
import com.writeloop.persistence.SavedExpressionEntity;
import com.writeloop.persistence.SavedExpressionRepository;
import com.writeloop.persistence.SavedExpressionSourceType;
import com.writeloop.util.ExpressionTagSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SavedExpressionServiceTest {

    @Mock
    private SavedExpressionRepository savedExpressionRepository;

    @Mock
    private PromptRepository promptRepository;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private CoachInteractionRepository coachInteractionRepository;

    @InjectMocks
    private SavedExpressionService savedExpressionService;

    @Test
    void saveExpression_merges_existing_tags_and_strips_context_only_time_tags() {
        SavedExpressionEntity existing = new SavedExpressionEntity(
                7L,
                "take a walk",
                "take a walk",
                "산책하다",
                null,
                "I take a walk after dinner.",
                ExpressionTagSupport.toJson(List.of("used_expression", "daily_routine")),
                SavedExpressionSourceType.USED_EXPRESSION,
                null,
                null,
                null,
                null
        );

        when(savedExpressionRepository.findByUserIdAndNormalizedExpression(7L, "take a walk"))
                .thenReturn(Optional.of(existing));
        when(savedExpressionRepository.save(existing)).thenReturn(existing);

        SavedExpressionDto saved = savedExpressionService.saveExpression(
                7L,
                new SaveExpressionRequestDto(
                        "take a walk",
                        "산책하다",
                        "루틴을 말할 때 자연스러워요.",
                        "I take a walk after dinner.",
                        SavedExpressionSourceType.REFINEMENT_EXPRESSION,
                        null,
                        null,
                        null,
                        null,
                        List.of("Verb Phrase", "time", "표현더하기", "invalid_tag")
                )
        );

        assertThat(ExpressionTagSupport.fromJson(existing.getTagsJson()))
                .containsExactly(
                        "used_expression",
                        "daily_routine",
                        "verb_phrase",
                        "refinement_expression"
                );
        assertThat(saved.tags())
                .containsExactly(
                        "used_expression",
                        "daily_routine",
                        "verb_phrase",
                        "refinement_expression"
                );
    }

    @Test
    void getSavedExpressions_strips_stale_time_expression_from_generic_action() {
        SavedExpressionEntity saved = new SavedExpressionEntity(
                11L,
                "take a walk",
                "take a walk",
                "?곗콉?섎떎",
                null,
                "After dinner, I take a walk around the block.",
                ExpressionTagSupport.toJson(List.of("used_expression", "daily_routine", "time_expression")),
                SavedExpressionSourceType.USED_EXPRESSION,
                null,
                null,
                null,
                null
        );

        when(savedExpressionRepository.findByUserIdOrderByLastSavedAtDesc(11L)).thenReturn(List.of(saved));

        List<SavedExpressionDto> expressions = savedExpressionService.getSavedExpressions(11L);

        assertThat(expressions).singleElement().satisfies(expression ->
                assertThat(expression.tags()).containsExactly("used_expression", "daily_routine")
        );
    }

    @Test
    void getSavedExpressions_backfills_source_tag_when_tags_json_is_missing() {
        SavedExpressionEntity saved = new SavedExpressionEntity(
                9L,
                "keep in touch",
                "keep in touch",
                "연락을 이어 가다",
                null,
                "I try to keep in touch with my close friends.",
                null,
                SavedExpressionSourceType.COACH_RECOMMENDATION,
                null,
                null,
                null,
                null
        );

        when(savedExpressionRepository.findByUserIdOrderByLastSavedAtDesc(9L)).thenReturn(List.of(saved));

        List<SavedExpressionDto> expressions = savedExpressionService.getSavedExpressions(9L);

        assertThat(expressions).singleElement().satisfies(expression ->
                assertThat(expression.tags()).containsExactly("coach_recommendation")
        );
    }
}
