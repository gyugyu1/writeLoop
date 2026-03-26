package com.writeloop.service;

import com.writeloop.dto.CoachHelpRequestDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoachServiceTest {

    @Mock
    private PromptService promptService;

    @Mock
    private OpenAiCoachClient openAiCoachClient;

    private CoachService coachService;

    @BeforeEach
    void setUp() {
        coachService = new CoachService(promptService, openAiCoachClient);
        lenient().when(openAiCoachClient.isConfigured()).thenReturn(false);
    }

    @Test
    void help_prioritizes_explicit_reason_intent_over_starter_hints() {
        PromptDto prompt = new PromptDto(
                "prompt-1",
                "Daily writing",
                "EASY",
                "Why do you study English every day?",
                "왜 매일 영어를 공부하나요?",
                "Explain your reason."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto(
                        "hint-1",
                        prompt.id(),
                        "STARTER",
                        "Starter: \"On weekends, I usually relax at home.\"",
                        1
                ),
                new PromptHintDto(
                        "hint-2",
                        prompt.id(),
                        "STRUCTURE",
                        "Use \"One reason is that ...\" to explain your point.",
                        2
                )
        ));

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "I need reason expressions")
        );

        assertThat(response.expressions()).isNotEmpty();
        assertThat(response.expressions().get(0).expression()).isEqualTo("One reason is that ...");
        assertThat(response.expressions())
                .noneMatch(expression -> expression.expression().contains("On weekends, I usually relax at home"));
    }

    @Test
    void help_prioritizes_korean_reason_intent_over_habit_starters() {
        PromptDto prompt = new PromptDto(
                "prompt-kr-1",
                "Daily writing",
                "EASY",
                "Why do you study English every day?",
                "왜 매일 영어를 공부하나요?",
                "Explain your reason."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto(
                        "hint-1",
                        prompt.id(),
                        "STARTER",
                        "Starter: \"On weekends, I usually relax at home.\"",
                        1
                ),
                new PromptHintDto(
                        "hint-2",
                        prompt.id(),
                        "VOCAB",
                        "Reason expressions: because, one reason is that",
                        2
                )
        ));

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "이 질문에서 쓸 수 있는 이유 표현 알려줘")
        );

        assertThat(response.expressions()).isNotEmpty();
        assertThat(response.expressions().get(0).expression()).isEqualTo("One reason is that ...");
        assertThat(response.expressions())
                .noneMatch(expression -> expression.expression().toLowerCase().contains("usually"));
    }

    @Test
    void help_allows_hints_when_user_intent_is_unclear() {
        PromptDto prompt = new PromptDto(
                "prompt-2",
                "Warm-up",
                "EASY",
                "Share your answer.",
                "답을 적어 보세요.",
                "Use a natural sentence."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto(
                        "hint-1",
                        prompt.id(),
                        "STARTER",
                        "Starter: \"On weekends, I usually relax at home.\"",
                        1
                )
        ));

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "Need help")
        );

        assertThat(response.expressions())
                .anySatisfy(expression -> assertThat(expression.expression()).contains("on weekends"));
    }

    @Test
    void help_returns_topic_bundle_for_sleep_phrase_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-sleep-1",
                "Weekend routine",
                "EASY",
                "What do you usually do at night?",
                "밤에 보통 무엇을 하나요?",
                "Talk about your routine."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto(
                        "hint-1",
                        prompt.id(),
                        "STARTER",
                        "Starter: \"On weekends, I usually relax at home.\"",
                        1
                )
        ));

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "잔다고 말하고 싶어")
        );

        assertThat(response.expressions()).hasSizeGreaterThanOrEqualTo(5);
        assertThat(response.expressions())
                .extracting(expression -> expression.expression().toLowerCase())
                .contains("go to bed", "go to sleep", "fall asleep", "get some sleep", "sleep well");
        assertThat(response.expressions())
                .noneMatch(expression -> expression.expression().toLowerCase().contains("walk"));
    }

    @Test
    void help_preserves_openai_reply_for_dynamic_expression_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-openai-1",
                "Weekend routine",
                "EASY",
                "What do you usually do at night?",
                "밤에 보통 무엇을 하나요?",
                "Talk about your routine."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);
        when(openAiCoachClient.help(prompt, "잔다고 말하고 싶어", List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        "잔다고 말하고 싶어",
                        "잠을 말할 때는 go to bed, go to sleep, fall asleep처럼 뉘앙스가 다른 표현을 같이 보면 좋아요.",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("go to bed", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("go to sleep", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("fall asleep", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "잔다고 말하고 싶어")
        );

        assertThat(response.expressions())
                .extracting(expression -> expression.expression().toLowerCase())
                .contains("go to bed", "go to sleep", "fall asleep");
    }
}
