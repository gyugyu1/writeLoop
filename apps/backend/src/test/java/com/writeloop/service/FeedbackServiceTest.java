package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

    @Mock
    private PromptService promptService;

    @Mock
    private OpenAiFeedbackClient openAiFeedbackClient;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    private FeedbackService feedbackService;

    @BeforeEach
    void setUp() {
        feedbackService = new FeedbackService(
                promptService,
                openAiFeedbackClient,
                answerSessionRepository,
                answerAttemptRepository,
                new ObjectMapper()
        );

        when(answerSessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(answerSessionRepository.countByGuestId(any())).thenReturn(0L);
        when(answerAttemptRepository.countBySessionId(any())).thenReturn(0);
        when(answerAttemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(promptService.findHintsByPromptId(anyString())).thenReturn(List.of());
    }

    @Test
    void review_filters_refinement_expressions_already_used_in_answer_or_corrected_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-c-2",
                "Society",
                "HARD",
                "What kind of social responsibility should successful companies have in modern society?",
                "현대 사회에서 성공한 기업이 어떤 사회적 책임을 가져야 하는지 설명해 주세요.",
                "구체적인 사례와 기준을 함께 제시하면 더 설득력 있어집니다."
        );
        String answer = "Successful companies should take responsibility for caring marginalized groups.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                90,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(new CorrectionDto("전치사 보완", "'for'를 넣어 보세요.")),
                List.of(),
                "Successful companies should take responsibility for caring for marginalized groups.",
                List.of(
                        new RefinementExpressionDto(
                                "take responsibility for",
                                "이미 쓴 표현",
                                "take responsibility for supporting communities"
                        ),
                        new RefinementExpressionDto(
                                "caring for marginalized groups",
                                "교정문에 이미 반영된 표현",
                                "caring for marginalized groups by providing support"
                        ),
                        new RefinementExpressionDto(
                                "by providing support and opportunities",
                                "다음 답변에서 더해볼 표현",
                                "by providing support and opportunities"
                        )
                ),
                "Successful companies should take responsibility for caring for marginalized groups by providing support and opportunities.",
                "다시 써 보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains("by [verb]ing [method]")
                .doesNotContain("take responsibility for", "caring for marginalized groups");
    }

    @Test
    void review_supplements_missing_pronoun_agreement_correction_from_inline_feedback() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Food",
                "EASY",
                "What food do you like, and why?",
                "어떤 음식을 좋아하고 왜 좋아하는지 말해 보세요.",
                "Give one reason."
        );
        String answer = "I like pizza and chicken because it is delicious.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                84,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(new CorrectionDto(
                        "'Because it is delicious and versatile.'라는 문장에 충분한 연결이 필요합니다.",
                        "문장을 연결하여 자연스럽게 만드세요."
                )),
                List.of(
                        new InlineFeedbackSegmentDto("KEEP", "I like pizza and chicken because ", "I like pizza and chicken because "),
                        new InlineFeedbackSegmentDto("REPLACE", "it is", "they are"),
                        new InlineFeedbackSegmentDto("KEEP", " delicious.", " delicious.")
                ),
                "I like pizza and chicken because they are delicious.",
                List.of(),
                "I like pizza and chicken because they are delicious and versatile.",
                "다시 써 보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.corrections())
                .extracting(CorrectionDto::issue)
                .anySatisfy(issue -> assertThat(issue).contains("they are"));
        assertThat(response.corrections())
                .extracting(CorrectionDto::suggestion)
                .anySatisfy(suggestion -> assertThat(suggestion).contains("대명사와 be동사"));
    }

    @Test
    void review_extracts_used_expressions_even_without_coach_usage() {
        PromptDto prompt = new PromptDto(
                "prompt-a-2",
                "Weekend",
                "EASY",
                "What do you usually do on weekends?",
                "주말에 보통 무엇을 하나요?",
                "Mention one or two activities."
        );
        String answer = "On weekends, I work out and spend time with my family at the park.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                90,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "다시 써보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("work out", "spend time with my family at the park");
    }

    @Test
    void review_deduplicates_overlapping_used_expressions_from_incomplete_and_full_matches() {
        PromptDto prompt = new PromptDto(
                "prompt-a-2",
                "Weekend",
                "EASY",
                "What do you usually do on weekends?",
                "주말에 보통 무엇을 하나요?",
                "Mention one or two activities."
        );
        String answer = "I usually spend time with my friends on weekends.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "다시 써보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("I usually spend time with my friends")
                .doesNotContain("I usually spend time with my", "spend time with my friends");
    }

    @Test
    void review_converts_full_sentence_refinement_examples_into_reusable_frames() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Food",
                "EASY",
                "What food do you like, and why?",
                "어떤 음식을 좋아하고 왜 좋아하는지 말해 보세요.",
                "Give one reason."
        );
        String answer = "I like pizza.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(),
                List.of(),
                "I like pizza because it is delicious.",
                List.of(
                        new RefinementExpressionDto(
                                "My favorite food is pizza because it is delicious and versatile.",
                                "다음 답변에서 재사용해 보세요.",
                                "My favorite food is pizza because it is delicious and versatile."
                        ),
                        new RefinementExpressionDto(
                                "I want to eat healthy food so that I can stay energetic.",
                                "다음 답변에서 재사용해 보세요.",
                                "I want to eat healthy food so that I can stay energetic."
                        )
                ),
                "My favorite food is pizza because it is delicious and versatile. I want to eat healthy food so that I can stay energetic.",
                "다시 써 보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains(
                        "My favorite [thing] is [item] because it is [adj] and [adj].",
                        "I want to [verb] so that I can [result]."
                )
                .doesNotContain(
                        "My favorite food is pizza because it is delicious and versatile.",
                        "I want to eat healthy food so that I can stay energetic."
                );
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::example)
                .contains(
                        "My favorite food is pizza because it is delicious and versatile.",
                        "I want to eat healthy food so that I can stay energetic."
                )
                .doesNotContain(
                        "My favorite [thing] is [item] because it is [adj] and [adj].",
                        "I want to [verb] so that I can [result]."
                );
    }

    @Test
    void review_fetches_prompt_hints_and_forwards_them_to_openai_feedback() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal Plan - Skill Growth",
                "B",
                "What is one skill you want to improve this year, and how will you work on it?",
                "올해 더 키우고 싶은 기술 하나는 무엇이고, 어떻게 실천할 건가요?",
                "목표와 실천 계획을 함께 말해 보세요."
        );
        String answer = "I want to improve my English speaking this year.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I want to improve [skill] this year.", 1),
                new PromptHintDto("hint-2", prompt.id(), "VOCAB", "practice regularly", 2)
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                87,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "다시 써 보세요."
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, hints)).thenReturn(feedback);

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.promptId()).isEqualTo(prompt.id());
        verify(promptService).findHintsByPromptId(prompt.id());
        verify(openAiFeedbackClient).review(prompt, answer, hints);
    }
}
