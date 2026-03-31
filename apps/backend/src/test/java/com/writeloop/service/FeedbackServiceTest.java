package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.dto.RefinementExampleSource;
import com.writeloop.dto.RefinementExpressionDto;
import com.writeloop.dto.RefinementExpressionSource;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.reset;
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
        OpenAiFeedbackClient diffHelper = new OpenAiFeedbackClient(
                new ObjectMapper(),
                "test-key",
                "gpt-4o",
                "https://api.example.com/v1/responses"
        );
        feedbackService = new FeedbackService(
                promptService,
                openAiFeedbackClient,
                answerSessionRepository,
                answerAttemptRepository,
                new ObjectMapper()
        );

        lenient().when(answerSessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(answerSessionRepository.countByGuestId(any())).thenReturn(0L);
        lenient().when(answerAttemptRepository.countBySessionId(any())).thenReturn(0);
        lenient().when(answerAttemptRepository.findBySessionIdAndAttemptNo(anyString(), any())).thenReturn(java.util.Optional.empty());
        lenient().when(answerAttemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(promptService.findHintsByPromptId(anyString())).thenReturn(List.of());
        lenient().when(openAiFeedbackClient.buildInlineFeedbackFromCorrectedAnswer(anyString(), anyString()))
                .thenAnswer(invocation -> diffHelper.buildInlineFeedbackFromCorrectedAnswer(
                        invocation.getArgument(0),
                        invocation.getArgument(1)
                ));
        lenient().when(openAiFeedbackClient.buildPreciseInlineFeedback(anyString(), anyString()))
                .thenAnswer(invocation -> diffHelper.buildPreciseInlineFeedback(
                        invocation.getArgument(0),
                        invocation.getArgument(1)
                ));
    }

    @Test
    void review_rewrite_challenge_uses_profile_when_reason_is_missing() {
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
        when(openAiFeedbackClient.isConfigured()).thenReturn(false);

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.rewriteChallenge())
                .contains("이유")
                .doesNotContain("3~4문장");
    }

    @Test
    void buildRewriteChallenge_forGrammarBlocking_prefersMinimalCorrection_over_raw_fallback() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Work Challenge",
                "B",
                "What is one challenge you often face at work or school, and how do you deal with it?",
                "질문",
                null
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING),
                new GrammarProfile(
                        GrammarSeverity.MAJOR,
                        List.of(new GrammarIssue("SUBJECT_VERB_AGREEMENT", "meet the deadline", "to meet deadlines", true, GrammarSeverity.MAJOR)),
                        "I often struggle to meet deadlines. To solve this, I write a to-do list."
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_BLOCKING_GRAMMAR",
                        null,
                        new RewriteTarget("FIX_BLOCKING_GRAMMAR", "I often struggle to meet deadlines. To solve this, I write a to-do list.", 0),
                        null
                )
        );

        String rewriteChallenge = ReflectionTestUtils.invokeMethod(
                feedbackService,
                "buildRewriteChallenge",
                prompt,
                answerProfile,
                "Hint: I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.",
                "One challenge I face is meeting deadlines. To solve this, I write a to-do list."
        );

        assertThat(rewriteChallenge)
                .contains("I often struggle to meet deadlines")
                .doesNotContain("I often struggle with meet the deadline");
    }

    @Test
    void saveAttempt_uses_fallback_summary_when_section_policy_hides_summary() {
        AnswerSessionEntity session = new AnswerSessionEntity(
                "session-1",
                "prompt-rtn-1",
                "guest-1",
                null,
                SessionStatus.IN_PROGRESS
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                "prompt-rtn-1",
                "session-1",
                2,
                91,
                false,
                null,
                null,
                List.of("문제와 해결 방법을 함께 말한 점이 좋아요."),
                List.of(new CorrectionDto("이 방법이 어떻게 도움이 되는지 한 가지 더 덧붙여 보세요.", "효과를 한 문장 더 써 보세요.")),
                List.of(),
                List.of(),
                "I usually start my Saturday with a walk.",
                List.of(),
                null,
                null,
                null,
                List.of()
        );

        reset(answerAttemptRepository);
        when(answerAttemptRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ReflectionTestUtils.invokeMethod(
                feedbackService,
                "saveAttempt",
                session,
                AttemptType.REWRITE,
                2,
                "I usually start my Saturday with a walk.",
                feedback
        );

        ArgumentCaptor<AnswerAttemptEntity> captor = ArgumentCaptor.forClass(AnswerAttemptEntity.class);
        verify(answerAttemptRepository).save(captor.capture());

        AnswerAttemptEntity saved = captor.getValue();
        assertThat(saved.getFeedbackSummary()).isEqualTo("문제와 해결 방법을 함께 말한 점이 좋아요. 이 방법이 어떻게 도움이 되는지 한 가지 더 덧붙여 보세요.");
        assertThat(saved.getModelAnswer()).isEqualTo("I usually start my Saturday with a walk.");
        assertThat(saved.getRewriteChallenge()).isEqualTo("다음 답변에서 핵심 문장을 더 자연스럽게 다듬어 보세요.");
    }

    @Test
    void review_applies_grammar_blocking_policy_to_broken_solution_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Work Challenge",
                "Problem Solving",
                "Work Challenge",
                "B",
                "What is one challenge you often face at work or school, and how do you deal with it?",
                "질문",
                null,
                null,
                new PromptTaskMetaDto("PROBLEM_SOLUTION", List.of("MAIN_ANSWER", "ACTIVITY"), List.of("REASON"))
        );
        String answer = "I often struggle with meet the deadline, to address I try to stay on track by write a to-do list.";
        String correctedAnswer = "I often struggle to meet deadlines, so I try to stay on track by writing a to-do list.";
        String modelAnswer = correctedAnswer + " This helps me organize my tasks better.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                75,
                false,
                null,
                "summary",
                List.of("\"" + answer + "\" shows your idea clearly."),
                List.of(new CorrectionDto("Add more detail.", "Explain the method and result more clearly.")),
                List.of(),
                List.of(),
                correctedAnswer,
                List.of(),
                modelAnswer,
                null,
                "Hint: " + answer,
                List.of(
                        new CoachExpressionUsageDto("stay on track", true, "SELF_DISCOVERED", null, "SELF_DISCOVERED", "Useful chunk."),
                        new CoachExpressionUsageDto("I often struggle with meet the deadline", true, "SELF_DISCOVERED", null, "SELF_DISCOVERED", "Broken span.")
                )
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.strengths()).allSatisfy(strength -> {
            assertThat(strength).doesNotContain(answer);
        });
        assertThat(response.strengths()).anySatisfy(strength -> {
            assertThat(strength).contains("문제와 해결 방법");
        });
        assertThat(response.grammarFeedback()).isNotEmpty();
        assertThat(response.grammarFeedback().get(0).originalText()).isEqualTo(answer);
        assertThat(response.grammarFeedback().get(0).revisedText()).isEqualTo(correctedAnswer);
        assertThat(response.rewriteChallenge())
                .contains("다시 써")
                .doesNotContain(answer);
        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("stay on track")
                .doesNotContain("I often struggle with meet the deadline");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
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
    @org.junit.jupiter.api.Disabled("Current fallback-only correction policy keeps the OpenAI correction instead of adding a second local correction.")
    void review_keeps_openai_correction_when_inline_feedback_has_additional_local_edit() {
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
    @org.junit.jupiter.api.Disabled("Grammar-only corrections are now filtered into grammarFeedback.")
    void review_does_not_add_supplemental_correction_when_openai_correction_exists() {
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
                        "문장을 한 번에 이어서 더 매끄럽게 만들어 보세요."
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
                .containsExactly("'Because it is delicious and versatile.'라는 문장에 충분한 연결이 필요합니다.");
        assertThat(response.corrections())
                .extracting(CorrectionDto::suggestion)
                .containsExactly("문장을 한 번에 이어서 더 매끄럽게 만들어 보세요.");
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
    void review_preserves_openai_used_expressions_and_drops_duplicate_matched_text() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal",
                "B",
                "What is one goal you have this year?",
                "올해 가진 목표 한 가지를 말해 보세요.",
                "Use one sentence."
        );
        String answer = "I want to speak English fluently because it is important for my job.";

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
                "다음에는 이유를 조금 더 풀어 보세요.",
                List.of(new CoachExpressionUsageDto(
                        "I want to speak English fluently",
                        true,
                        "SELF_DISCOVERED",
                        "I want to speak English fluently",
                        "SELF_DISCOVERED",
                        "목표를 분명하게 말할 때 자연스럽게 쓸 수 있어요."
                ))
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.usedExpressions())
                .anySatisfy(expression -> {
                    assertThat(expression.expression()).isEqualTo("I want to speak English fluently");
                    assertThat(expression.matchedText()).isNull();
                    assertThat(expression.usageTip()).isEqualTo("목표를 분명하게 말할 때 자연스럽게 쓸 수 있어요.");
                });
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
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
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
                new PromptHintDto("hint-2", prompt.id(), "VOCAB_PHRASE", "practice regularly", 2)
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

    @Test
    void review_filters_refinement_frames_when_example_or_pattern_is_already_used() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "어떤 계절을 좋아하고 왜 좋아하나요?",
                "좋아하는 이유를 한 가지 이상 넣어 보세요."
        );
        String answer = "I like spring season because it's the season when flowers bloom and everything fresh.";
        String correctedAnswer = "I like spring because it's the season when flowers bloom and everything feels fresh.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                83,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(
                        new CorrectionDto("'spring season'은 자연스럽지 않습니다.", "'spring'으로 충분합니다."),
                        new CorrectionDto("'feel'은 'everything'에 맞게 수일치가 필요합니다.", "'feels'를 사용하세요.")
                ),
                List.of(),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "when [thing] [verb]",
                                "상황이나 시기를 설명할 때 쓸 수 있습니다.",
                                "when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "because it's the [noun] when [thing] [verb]",
                                "특정 시기나 계절을 이유로 설명할 때 유용합니다.",
                                "because it's the season when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "everything feels [adj]",
                                "다양한 감각을 설명할 수 있습니다.",
                                "everything feels fresh"
                        )
                ),
                correctedAnswer,
                "다시 써 보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions()).isEmpty();
    }

    @Test
    void review_filters_refinement_suggestions_when_core_tokens_already_overlap_strongly() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "어떤 계절을 좋아하고 왜 좋아하나요?",
                "좋아하는 이유를 한 가지 이상 넣어 보세요."
        );
        String answer = "I like spring because flowers are blooming and the air feels fresh.";
        String correctedAnswer = "I like spring because flowers are blooming and the air feels fresh.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "when [thing] [verb]",
                                "상황이나 시기를 설명할 때 쓸 수 있습니다.",
                                "when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "the air feels [adj]",
                                "분위기나 감각을 묘사할 때 좋습니다.",
                                "the air feels fresh"
                        ),
                        new RefinementExpressionDto(
                                "I enjoy [season] because it feels [adj].",
                                "계절 선호를 말할 때 쓸 수 있습니다.",
                                "I enjoy spring because it feels refreshing."
                        )
                ),
                correctedAnswer,
                "다시 써 보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain(
                        "when [thing] [verb]",
                        "the air feels [adj]"
                );
    }

    @Test
    void review_filters_hint_refinement_when_core_phrase_is_already_used_with_small_inflection_difference() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving",
                "B",
                "What is one challenge you often face, and how do you deal with it?",
                "자주 겪는 어려움과 해결 방법을 말해 보세요.",
                "Mention the problem and one strategy."
        );
        String answer = "I often struggle to meet the deadline, but I try to stay on track by writing a to-do list.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "VOCAB_PHRASE", "to meet deadlines", 1),
                new PromptHintDto("hint-2", prompt.id(), "STRUCTURE", "To handle this, I [action or strategy].", 2)
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, hints)).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                81,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                answer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain("to meet deadlines");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
    void review_filters_because_frames_when_they_are_already_used_or_not_reusable() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "어떤 계절을 좋아하고 왜 좋아하나요?",
                "좋아하는 이유를 한 가지 이상 넣어 보세요."
        );
        String answer = "I like spring because it is beautiful.";
        String correctedAnswer = "I like spring because it is beautiful.";

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
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "because [reason]",
                                "이유를 붙일 때 유용합니다.",
                                "because it is beautiful"
                        ),
                        new RefinementExpressionDto(
                                "because it's the [noun] when [thing] [verb]",
                                "조금 더 구체적인 이유를 설명할 때 좋습니다.",
                                "because it's the season when flowers bloom"
                        )
                ),
                correctedAnswer,
                "다시 써 보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain("because [reason]")
                .contains("because it's the [noun] when [thing] [verb]");
    }

    @Test
    void review_prefers_dropping_invalid_refinements_over_padding_with_prompt_hints() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "어떤 계절을 좋아하고 왜 좋아하나요?",
                "좋아하는 이유를 한 가지 이상 넣어 보세요."
        );
        String answer = "I like spring because it's the season when flowers bloom and everything feels fresh.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I especially like [season] because ...", 1),
                new PromptHintDto("hint-2", prompt.id(), "VOCAB_WORD", "pleasant", 2),
                new PromptHintDto("hint-3", prompt.id(), "DETAIL", "It makes me feel [adj].", 3)
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, hints)).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                84,
                false,
                null,
                "요약",
                List.of("강점"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(
                        new RefinementExpressionDto(
                                "when [thing] [verb]",
                                "상황이나 시기를 설명할 때 쓸 수 있습니다.",
                                "when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "because it's the [noun] when [thing] [verb]",
                                "특정 시기나 계절을 이유로 설명할 때 유용합니다.",
                                "because it's the season when flowers bloom"
                        ),
                        new RefinementExpressionDto(
                                "everything feels [adj]",
                                "다양한 감각을 설명할 수 있습니다.",
                                "everything feels fresh"
                        )
                ),
                answer,
                "다시 써 보세요."
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions()).isEmpty();
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy refinement expectation predates placeholder-drop contract.")
    void review_keeps_usable_openai_refinements_without_padding_with_prompt_hints() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Season",
                "A",
                "What season do you like, and why?",
                "Which season do you like, and why?",
                "Give at least one reason."
        );
        String answer = "I like spring because it is beautiful.";
        List<PromptHintDto> hints = List.of(
                new PromptHintDto("hint-1", prompt.id(), "STARTER", "I especially like [season] because ...", 1),
                new PromptHintDto("hint-2", prompt.id(), "VOCAB_WORD", "pleasant", 2)
        );

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(hints);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, hints)).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(
                        new RefinementExpressionDto(
                                "One reason is that [reason].",
                                "Add a clearer reason.",
                                "One reason is that the weather feels fresh."
                        ),
                        new RefinementExpressionDto(
                                "What I like most about [thing] is that [detail].",
                                "Expand the idea with a detail.",
                                "What I like most about spring is that it feels calm."
                        ),
                        new RefinementExpressionDto(
                                "because [reason]",
                                "Add a reason naturally.",
                                "because it is beautiful"
                        )
                ),
                answer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains("One reason is that [reason].", "What I like most about [thing] is that [detail].")
                .doesNotContain("because [reason]");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy model-supplement expectation predates current refinement policy.")
    void review_extracts_additional_refinement_frames_from_model_answer_without_hint_top_up() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Time Management",
                "B",
                "What is one challenge you often face with time management, and how do you handle it?",
                "What time-management challenge do you face, and how do you handle it?",
                "Explain the problem and your response."
        );
        String answer = "Time management is difficult for me, so I try to stay organized.";
        String modelAnswer = "One challenge I often face with time management is staying consistent. "
                + "It helps me stay on track and finish important tasks. "
                + "This makes it easier to manage my schedule.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains(
                        "One challenge I often face with [noun] is [issue].",
                        "It helps me [verb] and [verb].",
                        "This makes it easier to [verb]."
                );
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy model-supplement expectation predates current refinement policy.")
    void review_tops_up_refinement_expressions_from_model_answer_up_to_four_items() {
        PromptDto prompt = new PromptDto(
                "prompt-b-5",
                "Goal Plan - Skill Growth",
                "B",
                "What is one skill you want to improve this year, and how will you work on it?",
                "올해 키우고 싶은 기술 한 가지와 어떻게 연습할지 설명해 주세요.",
                "Explain both the goal and the action plan."
        );
        String answer = "I want to improve my English this year.";
        String modelAnswer = "I want to improve my English so that I can speak more confidently. "
                + "I plan to do this by studying for thirty minutes every day. "
                + "It helps me stay motivated and track my progress. "
                + "This makes it easier to keep a steady routine.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                84,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                answer,
                List.of(
                        new RefinementExpressionDto(
                                "I want to [verb] so that I can [result].",
                                "목표와 기대 결과를 함께 말할 때 쓸 수 있어요.",
                                "I want to improve my English so that I can speak more confidently."
                        ),
                        new RefinementExpressionDto(
                                "I plan to [verb] by [verb]ing [method].",
                                "실천 계획을 설명할 때 쓸 수 있어요.",
                                "I plan to do this by studying for thirty minutes every day."
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions()).hasSize(4);
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .contains(
                        "I want to [verb] so that I can [result].",
                        "I plan to [verb] by [verb]ing [method].",
                        "It helps me [verb] and [verb].",
                        "This makes it easier to [verb]."
                );
    }

    @Test
    void review_keeps_openai_refinement_when_openai_example_is_usable_even_if_not_in_model_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I usually take a short break.";
        String correctedAnswer = "I usually take a short break.";
        String modelAnswer = "I usually take a short walk before dinner.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "Use this to add a time phrase naturally.",
                                "I usually rest after lunch.",
                                "점심 식사 후에"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(
                        RefinementExpressionDto::expression,
                        RefinementExpressionDto::example,
                        RefinementExpressionDto::exampleSource
                )
                .contains(tuple("after lunch", "I usually rest after lunch.", RefinementExampleSource.OPENAI));
    }

    @Test
    void review_drops_refinement_items_when_example_is_only_the_expression_itself() {
        PromptDto prompt = new PromptDto(
                "prompt-a-2",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I usually take a short break.";
        String correctedAnswer = "I usually take a short break.";
        String modelAnswer = "I usually take a short walk before dinner.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "Use this to add a time phrase naturally.",
                                "after lunch",
                                "점심 식사 후에"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression)
                .doesNotContain("after lunch");
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::example)
                .doesNotContain("after lunch");
    }

    @Test
    void review_generates_lexical_gloss_for_single_word_refinement_when_hints_are_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "rest",
                                "실제 답변에서 휴식 시간이나 이유를 함께 붙여 보세요.",
                                "I usually rest after lunch because it helps me recharge.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo, RefinementExpressionDto::example)
                .contains(tuple("rest", "휴식하다", "I usually rest after lunch because it helps me recharge."));
    }

    @Test
    void review_generates_lexical_gloss_for_phrase_refinement_when_hints_are_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "시간 표현 뒤에 어떤 활동을 하는지 이어서 말해 보세요.",
                                "I usually rest after lunch because it helps me recharge.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo, RefinementExpressionDto::example)
                .contains(tuple("after lunch", "점심 식사 후에", "I usually rest after lunch because it helps me recharge."));
    }

    @Test
    void review_prefers_model_answer_snippet_over_openai_example_when_both_are_usable() {
        PromptDto prompt = new PromptDto(
                "prompt-a-4b",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "?쒓컙 ?쒗쁽 ?ㅼ뿉 ?대뼡 ?쒕룞???섎뒗吏 ?댁뼱??留먰빐 蹂댁꽭??",
                                "I often read a book after lunch.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(
                        RefinementExpressionDto::expression,
                        RefinementExpressionDto::example,
                        RefinementExpressionDto::exampleSource
                )
                .contains(tuple(
                        "after lunch",
                        "I usually rest after lunch because it helps me recharge.",
                        RefinementExampleSource.EXTRACTED
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy placeholder-based frame expectation predates placeholder-drop contract.")
    void review_generates_pattern_meaning_for_frame_refinement() {
        PromptDto prompt = new PromptDto(
                "prompt-b-2",
                "Future Plans",
                "B",
                "What habit do you want to build this year?",
                "What habit do you want to build this year?",
                "Describe a clear plan."
        );
        String answer = "Building a healthier routine is my goal this year.";
        String correctedAnswer = "Building a healthier routine is my goal this year.";
        String modelAnswer = "I want to build a healthy routine this year.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                88,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "I want to [verb].",
                                "목표를 말할 때 뒤에 구체적인 행동을 이어 보세요.",
                                "I want to build a healthy routine this year.",
                                null
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo, RefinementExpressionDto::example)
                .contains(tuple("I want to [verb].", "[동사]하고 싶다고 말하는 틀", "I want to build a healthy routine this year."));
    }

    @Test
    void review_keeps_single_word_openai_refinement_when_openai_example_is_usable_even_if_not_in_model_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-a-5",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually take a short walk before dinner.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "rest",
                                "실제 답변에서 휴식 시간이나 이유를 함께 붙여 보세요.",
                                "I usually rest after lunch.",
                                "휴식하다"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .filteredOn(expression -> "rest".equals(expression.expression()))
                .singleElement()
                .satisfies(expression -> {
                    assertThat(expression.meaningKo()).isNotBlank();
                    assertThat(expression.example()).isEqualTo("I usually rest after lunch.");
                    assertThat(expression.exampleSource()).isEqualTo(RefinementExampleSource.OPENAI);
                });
    }

    @Test
    void review_replaces_generic_meaning_placeholder_with_generated_gloss() {
        PromptDto prompt = new PromptDto(
                "prompt-a-6",
                "Daily Life",
                "EASY",
                "What do you usually do after lunch?",
                "What do you usually do after lunch?",
                "Use one clear daily-life example."
        );
        String answer = "I take a short break.";
        String correctedAnswer = "I take a short break.";
        String modelAnswer = "I usually rest after lunch because it helps me recharge.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                86,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto("KEEP", answer, answer)),
                correctedAnswer,
                List.of(
                        new RefinementExpressionDto(
                                "after lunch",
                                "시간 표현 뒤에 어떤 활동을 하는지 이어서 말해 보세요.",
                                "I usually rest after lunch because it helps me recharge.",
                                "다음 답변에서 활용하기 좋은 표현"
                        )
                ),
                modelAnswer,
                "rewrite"
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::expression, RefinementExpressionDto::meaningKo)
                .contains(tuple("after lunch", "점심 식사 후에"));
        assertThat(response.refinementExpressions())
                .extracting(RefinementExpressionDto::meaningKo)
                .doesNotContain("다음 답변에서 활용하기 좋은 표현");
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed minor grammar was always shown before answer-band section hiding.")
    void review_collects_grammar_feedback_from_inline_edits_and_keeps_corrections_for_non_grammar_only() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Time Management",
                "B",
                "What is one challenge you often face with time management, and how do you handle it?",
                "What time-management challenge do you face, and how do you handle it?",
                "Explain the problem and your response."
        );
        String answer = "i have a problem meeting friend on time. i set an alarm.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(
                        new CorrectionDto(
                                "답변의 상황 설명이 조금 더 구체적이면 더 설득력 있어져요.",
                                "왜 친구를 제시간에 만나기 어려운지 한 문장 더 덧붙여 보세요."
                        ),
                        new CorrectionDto(
                                "'I'는 항상 대문자로 써야 해요.",
                                "'I'로 고쳐 주세요."
                        )
                ),
                List.of(
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " have a problem meeting ", " have a problem meeting "),
                        new InlineFeedbackSegmentDto("ADD", "", "my "),
                        new InlineFeedbackSegmentDto("REPLACE", "friend", "friends"),
                        new InlineFeedbackSegmentDto("KEEP", " on time. ", " on time. "),
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " set an alarm.", " set an alarm.")
                ),
                List.of(new GrammarFeedbackItemDto(
                        "i",
                        "I",
                        "'I'는 항상 대문자로 써야 해요."
                )),
                "I have a problem meeting my friends on time. I set an alarm.",
                List.of(),
                "I have a problem meeting my friends on time. I set an alarm.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple("i", "I", "'I'는 항상 대문자로 써야 해요."));
        assertThat(response.corrections())
                .extracting(CorrectionDto::issue)
                .containsExactly("답변의 상황 설명이 조금 더 구체적이면 더 설득력 있어져요.");
    }
    @Test
    @org.junit.jupiter.api.Disabled("Legacy grammar expectation predates section-policy grammar cap.")
    void review_rebuilds_inline_feedback_from_corrected_answer_and_preserves_openai_grammar_feedback_units() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말은 보통 어떻게 보내나요?",
                "Mention one or two activities."
        );
        String answer = "On weekends, i usually take nap and write a my diary";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                70,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(new CorrectionDto(
                        "내용이 조금 더 구체적이면 더 좋아져요.",
                        "어디에서 시간을 보내는지 한 문장 더 덧붙여 보세요."
                )),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("i", "I", "'I'는 항상 대문자로 써야 해요."),
                        new GrammarFeedbackItemDto("a my diary", "my diary", "'a'는 소유격 'my'와 함께 쓸 수 없어요.")
                ),
                "On weekends, I usually take a nap and write in my diary.",
                List.of(),
                "On weekends, I usually take a nap and write in my diary.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.inlineFeedback()).isNotEmpty();
        assertThat(response.inlineFeedback())
                .extracting(InlineFeedbackSegmentDto::type, InlineFeedbackSegmentDto::originalText, InlineFeedbackSegmentDto::revisedText)
                .contains(
                        tuple("REPLACE", "i", "I"),
                        tuple("ADD", "", "a ")
                );
        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(
                        tuple("i", "I", "'I'\uB294 \uD56D\uC0C1 \uB300\uBB38\uC790\uB85C \uC368\uC57C \uD574\uC694."),
                        tuple("a my diary", "my diary", "'a'\uB294 \uC18C\uC720\uACA9 'my'\uC640 \uD568\uAED8 \uC4F8 \uC218 \uC5C6\uC5B4\uC694.")
                );
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy grammar reason expectation predates current grammar sanitizer behavior.")
    void review_preserves_matching_openai_reason_but_refines_generic_possessive_article_reason() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말에 보통 어떻게 보내나요?",
                "Mention one or two activities."
        );
        String answer = "On weekends, i usually take nap and write a my diary";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                70,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("i", "I", "capitalization reason"),
                        new GrammarFeedbackItemDto("a my diary", "my diary", "broad diary reason")
                ),
                "On weekends, I usually take a nap and write in my diary.",
                List.of(),
                "On weekends, I usually take a nap and write in my diary.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .filteredOn(item -> "i".equals(item.originalText()) && "I".equals(item.revisedText()))
                .extracting(GrammarFeedbackItemDto::reasonKo)
                .containsExactly("capitalization reason");

        assertThat(response.grammarFeedback())
                .filteredOn(item -> "a my diary".equals(item.originalText()) && "my diary".equals(item.revisedText()))
                .extracting(GrammarFeedbackItemDto::reasonKo)
                .containsExactly("'my' 같은 한정사가 이미 명사를 꾸며 주므로 앞에 관사 'a'를 함께 쓰지 않아요.");
    }

    @Test
    void review_refines_generic_article_removal_reason_when_article_precedes_possessive_determiner() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말은 보통 어떻게 보내나요?",
                "Mention one or two activities."
        );
        String answer = "On weekends, I write a my diary before bed.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                75,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("a", "", "이 부분은 빼는 것이 문법적으로 더 자연스러워요.")
                ),
                "On weekends, I write my diary before bed.",
                List.of(),
                "On weekends, I write my diary before bed.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "a",
                        "",
                        "'my' 같은 한정사가 이미 명사를 꾸며 주므로 앞에 관사 'a'를 함께 쓰지 않아요."
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed article fixes were always surfaced in grammar instead of being folded into corrected answer for stronger bands.")
    void review_refines_generic_article_addition_reason_into_countable_noun_rule() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "올해 만들고 싶은 습관 한 가지와 그것이 왜 중요한지 설명해 주세요.",
                "Include your goal and reason."
        );
        String answer = "I want to build exercise habit this year because it helps me stay healthy.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("", "an", "명사 앞에 필요한 한정어를 넣으면 뜻이 더 분명해집니다.")
                ),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                List.of(),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "",
                        "an",
                        "'habit'처럼 단수 가산명사 앞에는 관사 'an'을 써야 해요."
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy punctuation expectation predates section-policy grammar cap.")
    void review_refines_generic_punctuation_reason_into_comma_and_period_specific_feedback() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말은 보통 어떻게 보내나요?",
                "Mention one or two activities."
        );
        String answer = "On weekends I usually relax at home";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                85,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("", ",", "문장 끝에는 문장부호가 있어야 문장이 분명해요."),
                        new GrammarFeedbackItemDto("", ".", "문장 끝에는 문장부호가 있어야 문장이 분명해요.")
                ),
                "On weekends, I usually relax at home.",
                List.of(),
                "On weekends, I usually relax at home.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(
                        tuple("", ",", "쉼표를 넣어 앞부분의 도입 표현과 뒤의 본문을 구분해요."),
                        tuple("", ".", "완전한 문장은 끝에 마침표를 넣어 마무리해요.")
                );
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed local possessive article fixes were always shown in grammar instead of hidden for otherwise-good answers.")
    void review_refines_possessive_article_reason_when_openai_span_includes_context() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Routine - Evening",
                "A",
                "What do you usually do after dinner?",
                "저녁을 먹고 나면 보통 무엇을 하나요?",
                "Mention one or two activities."
        );
        String answer = "After dinner, I clean the my desk and organize my notes.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                74,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "clean the my desk",
                                "clean my desk",
                                "명사 앞에 두 개의 정관사를 사용할 수 없습니다."
                        )
                ),
                "After dinner, I clean my desk and organize my notes.",
                List.of(),
                "After dinner, I clean my desk and organize my notes.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "clean the my desk",
                        "clean my desk",
                        "'my' 같은 한정사가 이미 명사를 꾸며 주므로 앞에 관사 'the'를 함께 쓰지 않아요."
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed short-valid/content-thin answers always surfaced minor article cleanup in grammar.")
    void review_refines_trailing_article_reason_when_followed_by_possessive_determiner() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "올해 만들고 싶은 습관 한 가지와 그것이 왜 중요한지 설명해 주세요.",
                "Include your goal and reason."
        );
        String answer = "I check a my schedule every morning.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                76,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "I check a",
                                "I check",
                                "'schedule'는 가산명사지만 관사를 필요로 하지 않음."
                        )
                ),
                "I check my schedule every morning.",
                List.of(),
                "I check my schedule every morning.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "I check a",
                        "I check",
                        "'my' 같은 한정사가 이미 명사를 꾸며 주므로 앞에 관사 'a'를 함께 쓰지 않아요."
                ));
    }

    @Test
    @org.junit.jupiter.api.Disabled("Legacy expectation assumed surviving minor grammar items were always shown even when section policy hides grammar for stronger answers.")
    void review_filters_out_provided_grammar_feedback_items_without_actual_change() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말은 보통 어떻게 보내나요?",
                "Mention one or two activities."
        );
        String answer = "On weekends, I usually take nap at home and watch videos.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("nap", "a nap", "'nap'은 가산명사라서 관사가 필요합니다."),
                        new GrammarFeedbackItemDto("watch videos", "watch videos", "복수형 설명")
                ),
                "On weekends, I usually take a nap at home and watch videos.",
                List.of(),
                "On weekends, I usually take a nap at home and watch videos.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText)
                .contains(tuple("nap", "a nap"))
                .doesNotContain(tuple("watch videos", "watch videos"));
    }

    @Test
    void review_keeps_corrected_answer_and_non_grammar_improvement_when_minor_grammar_is_hidden_by_policy() {
        PromptDto prompt = new PromptDto(
                "prompt-b-1",
                "Problem Solving - Time Management",
                "B",
                "What is one challenge you often face with time management, and how do you handle it?",
                "What time-management challenge do you face, and how do you handle it?",
                "Explain the problem and your response."
        );
        String answer = "i have a problem meeting friend on time. i set an alarm.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(
                        new CorrectionDto(
                                "?듬????곹솴 ?ㅻ챸??議곌툑 ??援ъ껜?곸씠硫????ㅻ뱷???덉뼱?몄슂.",
                                "??移쒓뎄瑜??쒖떆媛꾩뿉 留뚮굹湲??대젮?댁? ??臾몄옣 ???㏓텤??蹂댁꽭??"
                        ),
                        new CorrectionDto(
                                "'I'????긽 ?臾몄옄濡??⑥빞 ?댁슂.",
                                "'I'濡?怨좎퀜 二쇱꽭??"
                        )
                ),
                List.of(
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " have a problem meeting ", " have a problem meeting "),
                        new InlineFeedbackSegmentDto("ADD", "", "my "),
                        new InlineFeedbackSegmentDto("REPLACE", "friend", "friends"),
                        new InlineFeedbackSegmentDto("KEEP", " on time. ", " on time. "),
                        new InlineFeedbackSegmentDto("REPLACE", "i", "I"),
                        new InlineFeedbackSegmentDto("KEEP", " set an alarm.", " set an alarm.")
                ),
                List.of(new GrammarFeedbackItemDto("i", "I", "'I'????긽 ?臾몄옄濡??⑥빞 ?댁슂.")),
                "I have a problem meeting my friends on time. I set an alarm.",
                List.of(),
                "I have a problem meeting my friends on time. I set an alarm.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.correctedAnswer()).isNotBlank();
        assertThat(response.grammarFeedback()).isEmpty();
        assertThat(response.corrections())
                .extracting(CorrectionDto::issue)
                .containsExactly("?듬????곹솴 ?ㅻ챸??議곌툑 ??援ъ껜?곸씠硫????ㅻ뱷???덉뼱?몄슂.");
    }

    @Test
    void review_keeps_countable_noun_article_fix_in_corrected_answer_when_grammar_section_is_hidden() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "?ы빐 留뚮뱾怨??띠? ?듦? ??媛吏? 洹멸쾬????以묒슂?쒖? ?ㅻ챸??二쇱꽭??",
                "Include your goal and reason."
        );
        String answer = "I want to build exercise habit this year because it helps me stay healthy.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto("", "an", "article")),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                List.of(),
                "I want to build an exercise habit this year because it helps me stay healthy.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.correctedAnswer())
                .isEqualTo("I want to build an exercise habit this year because it helps me stay healthy.");
        assertThat(response.grammarFeedback()).isEmpty();
    }

    @Test
    void review_keeps_possessive_article_cleanup_in_corrected_answer_when_grammar_section_is_hidden() {
        PromptDto prompt = new PromptDto(
                "prompt-a-1",
                "Routine - Evening",
                "A",
                "What do you usually do after dinner?",
                "??곸쓣 癒밴퀬 ?섎㈃ 蹂댄넻 臾댁뾿???섎굹??",
                "Mention one or two activities."
        );
        String answer = "After dinner, I clean the my desk and organize my notes.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                74,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto("clean the my desk", "clean my desk", "article")),
                "After dinner, I clean my desk and organize my notes.",
                List.of(),
                "After dinner, I clean my desk and organize my notes.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("After dinner, I clean my desk and organize my notes.");
        assertThat(response.grammarFeedback()).isEmpty();
    }

    @Test
    void review_keeps_local_article_fix_in_corrected_answer_when_remaining_answer_is_good_enough() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "二쇰쭚? 蹂댄넻 ?대뼸寃?蹂대궡?섏슂?",
                "Mention one or two activities."
        );
        String answer = "On weekends, I usually take nap at home and watch videos.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("nap", "a nap", "article"),
                        new GrammarFeedbackItemDto("watch videos", "watch videos", "noop")
                ),
                "On weekends, I usually take a nap at home and watch videos.",
                List.of(),
                "On weekends, I usually take a nap at home and watch videos.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("On weekends, I usually take a nap at home and watch videos.");
        assertThat(response.grammarFeedback()).isEmpty();
    }

    @Test
    void review_prefers_reason_building_over_minor_article_cleanup_for_short_valid_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "?ы빐 留뚮뱾怨??띠? ?듦? ??媛吏? 洹멸쾬????以묒슂?쒖? ?ㅻ챸??二쇱꽭??",
                "Include your goal and reason."
        );
        String answer = "I check a my schedule every morning.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                76,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto("I check a", "I check", "article")),
                "I check my schedule every morning.",
                List.of(),
                "I check my schedule every morning.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("I check my schedule every morning.");
        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText)
                .containsExactly(tuple("I check a", "I check"));
        assertThat(response.rewriteChallenge()).contains("이유");
    }

    @Test
    void review_ignores_provided_grammar_feedback_when_it_does_not_overlap_actual_inline_change() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "올해 만들고 싶은 습관 한 가지와 그것이 왜 중요한지 설명해 주세요.",
                "Include your goal and reason."
        );
        String answer = "I want to make study plan for this month.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "this month.",
                                "for this month.",
                                "전치사 'for'는 '~을 위한'의 의미로 사용됩니다. 여기서는 기간을 나타냅니다."
                        )
                ),
                "I want to make a study plan for this month.",
                List.of(),
                "I want to make a study plan for this month.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText, GrammarFeedbackItemDto::reasonKo)
                .contains(tuple(
                        "",
                        "a",
                        "'plan'처럼 단수 가산명사 앞에는 관사 'a'를 써야 해요."
                ))
                .doesNotContain(tuple(
                        "this month.",
                        "for this month.",
                        "전치사 'for'는 '~을 위한'의 의미로 사용됩니다. 여기서는 기간을 나타냅니다."
                ));
    }

    @Test
    void review_filters_out_english_only_corrections_and_keeps_korean_ones() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말에 보통 어떻게 보내나요?",
                "Mention one or two activities."
        );
        String answer = "When I stay at home, I usually play games and listen to music.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                80,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(
                        new CorrectionDto(
                                "Expand on activities or companions.",
                                "Consider adding more details about other activities or who you spend time with."
                        ),
                        new CorrectionDto(
                                "더 구체적인 정보를 포함하면 좋겠어요.",
                                "어디에서 시간을 보내는지나 누구와 함께하는지도 덧붙여 보세요."
                        )
                ),
                List.of(),
                List.of(),
                answer,
                List.of(),
                answer,
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.corrections())
                .extracting(CorrectionDto::issue, CorrectionDto::suggestion)
                .containsExactly(tuple(
                        "더 구체적인 정보를 포함하면 좋겠어요.",
                        "어디에서 시간을 보내는지나 누구와 함께하는지도 덧붙여 보세요."
                ));
    }

    @Test
    void review_discards_context_rewrites_from_corrected_answer_for_grammar_feedback() {
        PromptDto prompt = new PromptDto(
                "prompt-a-3",
                "Routine - Weekend",
                "A",
                "How do you usually spend your weekend?",
                "주말은 보통 어떻게 보내나요?",
                "Mention one or two activities."
        );
        String answer = "In the morning, I exercise, and in the afternoon, I relax by reading a book or watching TV.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                78,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("morning", "evening", "'morning'보다 'evening'가 문맥에 더 자연스럽습니다."),
                        new GrammarFeedbackItemDto("in the", "after", "관사를 보완하면 표현이 더 자연스럽고 정확해집니다."),
                        new GrammarFeedbackItemDto("afternoon", "work", "'afternoon'보다 'work'가 문맥에 더 자연스럽습니다.")
                ),
                "In the evening, I exercise, and after work, I relax by reading a book or watching TV.",
                List.of(),
                "In the evening, I exercise, and after work, I relax by reading a book or watching TV.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo(answer);
        assertThat(response.inlineFeedback()).isEmpty();
        assertThat(response.grammarFeedback()).isEmpty();
    }

    @Test
    void review_keeps_local_article_fix_in_corrected_answer_sanitization() {
        PromptDto prompt = new PromptDto(
                "prompt-b-3",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year, and why is it important to you?",
                "올해 만들고 싶은 습관 한 가지와 그것이 왜 중요한지 설명해 주세요.",
                "Include your goal and reason."
        );
        String answer = "I want to take nap after lunch.";

        when(promptService.findById(prompt.id())).thenReturn(prompt);
        when(openAiFeedbackClient.isConfigured()).thenReturn(true);
        when(openAiFeedbackClient.review(prompt, answer, List.of())).thenReturn(new FeedbackResponseDto(
                prompt.id(),
                null,
                0,
                82,
                false,
                null,
                "summary",
                List.of("strength"),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto("nap", "a nap", "'nap'은 가산명사라서 관사가 필요합니다.")
                ),
                "I want to take a nap after lunch.",
                List.of(),
                "I want to take a nap after lunch.",
                "rewrite",
                List.of()
        ));

        FeedbackResponseDto response = feedbackService.review(
                new FeedbackRequestDto(prompt.id(), answer, null, "INITIAL", "guest-1"),
                null
        );

        assertThat(response.correctedAnswer()).isEqualTo("I want to take a nap after lunch.");
        assertThat(response.inlineFeedback())
                .extracting(InlineFeedbackSegmentDto::type, InlineFeedbackSegmentDto::originalText, InlineFeedbackSegmentDto::revisedText)
                .contains(tuple("ADD", "", "a "));
        assertThat(response.grammarFeedback())
                .extracting(GrammarFeedbackItemDto::originalText, GrammarFeedbackItemDto::revisedText)
                .contains(tuple("nap", "a nap"));
    }

    @Test
    void buildRefinementExpressionDto_aligns_example_translation_with_model_answer_snippet() {
        RefinementExpressionDto expression = (RefinementExpressionDto) ReflectionTestUtils.invokeMethod(
                feedbackService,
                "buildRefinementExpressionDto",
                "after lunch",
                RefinementExpressionSource.MODEL_ANSWER,
                "시간 표현 뒤에 어떤 활동을 하는지 붙이면 문장이 더 또렷해집니다.",
                null,
                null,
                "I usually rest after lunch. It helps me recharge for the afternoon.",
                "저는 보통 점심 식사 후에 쉬어요. 그러면 오후를 더 잘 보낼 힘이 생겨요.",
                "점심 식사 후에",
                List.of()
        );

        assertThat(expression).isNotNull();
        assertThat(expression.exampleEn()).isEqualTo("I usually rest after lunch.");
        assertThat(expression.exampleKo()).isEqualTo("저는 보통 점심 식사 후에 쉬어요.");
        assertThat(expression.exampleSource()).isEqualTo(RefinementExampleSource.EXTRACTED);
    }
}
