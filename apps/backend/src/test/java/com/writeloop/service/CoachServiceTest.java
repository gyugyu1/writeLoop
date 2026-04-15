package com.writeloop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.CoachHelpRequestDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachSelfDiscoveredCandidateDto;
import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.CoachUsageCheckResponseDto;
import com.writeloop.dto.CoachUsageCheckRequestDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptHintItemDto;
import com.writeloop.persistence.AnswerAttemptEntity;
import com.writeloop.persistence.AnswerAttemptRepository;
import com.writeloop.persistence.AnswerSessionEntity;
import com.writeloop.persistence.AnswerSessionRepository;
import com.writeloop.persistence.AttemptType;
import com.writeloop.persistence.CoachInteractionEntity;
import com.writeloop.persistence.CoachInteractionRepository;
import com.writeloop.persistence.CoachResponseSource;
import com.writeloop.persistence.SessionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CoachServiceTest {

    @Mock
    private PromptService promptService;

    @Mock
    private LlmCoachClient openAiCoachClient;

    @Mock
    private AnswerAttemptRepository answerAttemptRepository;

    @Mock
    private AnswerSessionRepository answerSessionRepository;

    @Mock
    private CoachInteractionRepository coachInteractionRepository;

    private CoachService coachService;

    @BeforeEach
    void setUp() {
        coachService = new CoachService(
                promptService,
                openAiCoachClient,
                answerAttemptRepository,
                answerSessionRepository,
                coachInteractionRepository,
                new ObjectMapper(),
                new CoachQueryAnalyzer()
        );
        lenient().when(openAiCoachClient.isConfigured()).thenReturn(false);
        lenient().when(answerSessionRepository.findById(any())).thenAnswer(invocation -> Optional.of(
                new AnswerSessionEntity(
                        invocation.getArgument(0),
                        "prompt-default",
                        null,
                        null,
                        SessionStatus.IN_PROGRESS
                )
        ));
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
                        "VOCAB_PHRASE",
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
    void help_prefers_structured_hint_items_over_legacy_bundle_content() {
        PromptDto prompt = new PromptDto(
                "prompt-2-items",
                "Time management",
                "EASY",
                "What challenge do you face with time management?",
                "시간 관리에서 어떤 어려움을 겪나요?",
                "Use natural expressions."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto(
                        "hint-1",
                        prompt.id(),
                        "VOCAB_WORD",
                        "활용 단어: deadline, pressure, teamwork",
                        1,
                        List.of(
                                new PromptHintItemDto("item-1", "hint-1", "WORD", "deadline", null, null, null, null, 1),
                                new PromptHintItemDto("item-2", "hint-1", "WORD", "pressure", null, null, null, null, 2),
                                new PromptHintItemDto("item-3", "hint-1", "WORD", "teamwork", null, null, null, null, 3)
                        )
                )
        ));

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "Need help")
        );

        assertThat(response.expressions())
                .extracting(expression -> expression.expression().toLowerCase())
                .contains("deadline", "pressure", "teamwork")
                .doesNotContain("활용 단어: deadline, pressure, teamwork");
    }

    @Test
    void help_returns_topic_bundle_for_sleep_phrase_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-sleep-1",
                "Weekend routine",
                "EASY",
                "How do you feel today?",
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
    void help_returns_sleep_expressions_for_sleep_phrase_lookup() {
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
        lenient().when(openAiCoachClient.isConfigured()).thenReturn(true);
        String lookup = "\uD589\uBCF5\uD558\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4";
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

    @Test
    void help_skips_openai_when_deterministic_meaning_lookup_exists() {
        PromptDto prompt = new PromptDto(
                "prompt-meaning-openai-skip",
                "Daily Life",
                "EASY",
                "How do you usually spend your weekend?",
                "주말을 보통 어떻게 보내나요?",
                "Answer with a simple daily-life example."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "\uCE5C\uAD6C \uB9CC\uB09C\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4";
        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(response.expressions())
                .extracting(expression -> expression.expression().toLowerCase())
                .contains("meet my friends", "hang out with my friends", "catch up with my friends");
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_uses_openai_when_deterministic_meaning_lookup_is_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-openai-fallback",
                "Feeling",
                "EASY",
                "How do you feel today?",
                "오늘 기분이 어떤가요?",
                "Describe your feeling."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "\uD589\uBCF5\uD558\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4";
        when(openAiCoachClient.help(prompt, lookup, List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        lookup,
                        "행복한 기분을 말할 때 바로 쓸 수 있는 표현을 골랐어요.",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("feel happy", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("be in a good mood", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("feel cheerful", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(response.expressions())
                .extracting(expression -> expression.expression().toLowerCase())
                .contains("feel happy", "be in a good mood", "feel cheerful");
        assertThat(response.coachReply()).isEqualTo("행복한 기분을 말할 때 바로 쓸 수 있는 표현을 골랐어요.");
        verify(openAiCoachClient).help(prompt, lookup, List.of());
    }

    @Test
    void checkUsage_persists_used_expressions_on_matching_attempt() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-1",
                "Daily writing",
                "EASY",
                "Why do you study English every day?",
                "왜 매일 영어를 공부하나요?",
                "Explain your reason."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        AnswerAttemptEntity attempt = new AnswerAttemptEntity(
                "session-1",
                1,
                AttemptType.INITIAL,
                "One reason is that it helps me focus.",
                88,
                "Good job",
                "[]",
                "[]",
                "Model answer",
                "Rewrite challenge",
                "{}"
        );
        when(answerAttemptRepository.findBySessionIdAndAttemptNo("session-1", 1)).thenReturn(Optional.of(attempt));
        when(answerSessionRepository.findById("session-1")).thenReturn(Optional.of(
                new AnswerSessionEntity(
                        "session-1",
                        prompt.id(),
                        "guest-test-identity-0001",
                        null,
                        SessionStatus.IN_PROGRESS
                )
        ));

        coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "One reason is that it helps me focus.",
                        "session-1",
                        "guest-test-identity-0001",
                        1,
                        List.of("One reason is that ...", "For example, ...")
                )
        );

        assertThat(attempt.getUsedCoachExpressionsJson()).contains("One reason is that ...");
        verify(answerAttemptRepository).save(attempt);
    }

    @Test
    void checkUsage_does_not_praise_generic_overlap_without_core_expression() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-2",
                "Growth",
                "MEDIUM",
                "What is one habit you want to build this year?",
                "올해 만들고 싶은 습관은 무엇인가요?",
                "Explain your habit clearly."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "One habit I want to build this year is to study English every morning.",
                        "session-2",
                        1,
                        List.of("I want to consistently study English.")
                )
        );

        assertThat(response.usedExpressions())
                .filteredOn(usage -> "RECOMMENDED".equalsIgnoreCase(usage.source()))
                .isEmpty();
        assertThat(response.usedExpressions())
                .filteredOn(usage -> "SELF_DISCOVERED".equalsIgnoreCase(usage.source()))
                .isNotEmpty();
        assertThat(response.unusedExpressions())
                .extracting(usage -> usage.expression().toLowerCase())
                .containsExactly("i want to consistently study english.");
    }

    @Test
    void checkUsage_adds_self_discovered_expression_when_feedback_keeps_good_phrase() throws Exception {
        PromptDto prompt = new PromptDto(
                "prompt-usage-3",
                "Growth",
                "MEDIUM",
                "What is one skill you want to improve this year?",
                "올해 키우고 싶은 기술 하나를 말해 보세요.",
                "Share one skill and how you will practice it."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        FeedbackResponseDto feedbackPayload = new FeedbackResponseDto(
                prompt.id(),
                "session-3",
                1,
                90,
                false,
                null,
                "Good job",
                List.of("Clear sentence"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto(
                        "KEEP",
                        "I want to learn Spanish this year.",
                        "I want to learn Spanish this year."
                )),
                "I want to learn Spanish this year.",
                List.of(),
                "Model answer",
                "Rewrite it with one more detail."
        );
        AnswerAttemptEntity attempt = new AnswerAttemptEntity(
                "session-3",
                1,
                AttemptType.INITIAL,
                "I want to learn Spanish this year.",
                90,
                "Good job",
                "[]",
                "[]",
                "Model answer",
                "Rewrite it with one more detail.",
                new ObjectMapper().writeValueAsString(feedbackPayload)
        );
        when(answerAttemptRepository.findBySessionIdAndAttemptNo("session-3", 1)).thenReturn(Optional.of(attempt));
        when(answerSessionRepository.findById("session-3")).thenReturn(Optional.of(
                new AnswerSessionEntity(
                        "session-3",
                        prompt.id(),
                        "guest-test-identity-0001",
                        null,
                        SessionStatus.IN_PROGRESS
                )
        ));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "I want to learn Spanish this year.",
                        "session-3",
                        "guest-test-identity-0001",
                        1,
                        List.of("One reason is that ...")
                )
        );

        assertThat(response.usedExpressions())
                .extracting(usage -> usage.expression().toLowerCase())
                .contains("i want to learn spanish this year");
        assertThat(response.usedExpressions())
                .extracting(usage -> usage.source().toUpperCase())
                .contains("SELF_DISCOVERED");
        assertThat(response.unusedExpressions())
                .extracting(usage -> usage.expression().toLowerCase())
                .containsExactly("one reason is that ...");
        assertThat(attempt.getUsedCoachExpressionsJson()).contains("SELF_DISCOVERED");
    }

    @Test
    void checkUsage_requires_compact_order_for_recommended_paraphrase_match() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-4",
                "Travel",
                "MEDIUM",
                "Tell me about a place you want to visit and why.",
                "가 보고 싶은 장소와 이유를 말해 보세요.",
                "Use one or two sentences."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "I want to visit a maid cafe, and I also want to try local food there.",
                        "session-4",
                        1,
                        List.of("I want to visit a maid cafe.", "I also want to visit a maid cafe.")
                )
        );

        assertThat(response.usedExpressions())
                .filteredOn(usage -> "RECOMMENDED".equalsIgnoreCase(usage.source()))
                .extracting(usage -> usage.expression().toLowerCase())
                .containsExactly("i want to visit a maid cafe.");
        assertThat(response.unusedExpressions())
                .extracting(usage -> usage.expression().toLowerCase())
                .contains("i also want to visit a maid cafe.");
    }

    @Test
    void checkUsage_mixes_same_topic_detail_and_same_category_prompt_recommendations() {
        PromptDto currentPrompt = new PromptDto(
                "prompt-goal-current",
                "Goal Plan - Habit Building",
                "B",
                "What is one habit you want to build this year?",
                "올해 만들고 싶은 습관 한 가지는 무엇인가요?",
                "Explain why it matters."
        );
        PromptDto sameTopicDetailPrompt = new PromptDto(
                "prompt-goal-habit-2",
                "Goal Plan - Habit Building",
                "B",
                "What healthy habit do you want to keep every week?",
                "매주 꾸준히 지키고 싶은 건강 습관은 무엇인가요?",
                "Share one clear habit."
        );
        PromptDto sameCategoryPrompt = new PromptDto(
                "prompt-goal-skill",
                "Goal Plan - Skill Growth",
                "B",
                "What skill do you want to improve this year?",
                "올해 향상하고 싶은 기술은 무엇인가요?",
                "Explain how you will practice."
        );
        PromptDto fallbackPrompt = new PromptDto(
                "prompt-routine-dinner",
                "Routine - After Dinner",
                "B",
                "What do you usually do after dinner?",
                "저녁 식사 후에 보통 무엇을 하나요?",
                "Use one or two sentences."
        );

        when(promptService.findAll()).thenReturn(List.of(
                currentPrompt,
                fallbackPrompt,
                sameCategoryPrompt,
                sameTopicDetailPrompt
        ));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        currentPrompt.id(),
                        "I want to build this habit because it helps me stay healthy.",
                        null,
                        null,
                        List.of("I want to build this habit.")
                )
        );

        assertThat(response.suggestedPromptIds()).hasSize(3);
        assertThat(response.suggestedPromptIds().get(0)).isEqualTo("prompt-goal-habit-2");
        assertThat(response.suggestedPromptIds().subList(0, 2))
                .contains("prompt-goal-skill");
    }

    @Test
    void checkUsage_uses_keep_segment_as_self_discovered_fallback_when_pattern_match_is_missing() throws Exception {
        PromptDto prompt = new PromptDto(
                "prompt-usage-5",
                "Technology",
                "MEDIUM",
                "How has technology changed the way people build relationships?",
                "기술이 인간관계 맺는 방식을 어떻게 바꿨는지 말해 보세요.",
                "Use one clear idea."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        FeedbackResponseDto feedbackPayload = new FeedbackResponseDto(
                prompt.id(),
                "session-5",
                1,
                92,
                false,
                null,
                "Nice point",
                List.of("Clear idea"),
                List.of(),
                List.of(new InlineFeedbackSegmentDto(
                        "KEEP",
                        "Online conversations feel less awkward now.",
                        "Online conversations feel less awkward now."
                )),
                "Online conversations feel less awkward now.",
                List.of(),
                "Model answer",
                "Add one supporting detail."
        );
        AnswerAttemptEntity attempt = new AnswerAttemptEntity(
                "session-5",
                1,
                AttemptType.INITIAL,
                "Online conversations feel less awkward now.",
                92,
                "Nice point",
                "[]",
                "[]",
                "Model answer",
                "Add one supporting detail.",
                new ObjectMapper().writeValueAsString(feedbackPayload)
        );
        when(answerAttemptRepository.findBySessionIdAndAttemptNo("session-5", 1)).thenReturn(Optional.of(attempt));
        when(answerSessionRepository.findById("session-5")).thenReturn(Optional.of(
                new AnswerSessionEntity(
                        "session-5",
                        prompt.id(),
                        "guest-test-identity-0001",
                        null,
                        SessionStatus.IN_PROGRESS
                )
        ));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "Online conversations feel less awkward now.",
                        "session-5",
                        "guest-test-identity-0001",
                        1,
                        List.of("One reason is that ...")
                )
        );

        assertThat(response.usedExpressions())
                .filteredOn(usage -> "SELF_DISCOVERED".equalsIgnoreCase(usage.source()))
                .extracting(usage -> usage.expression().toLowerCase())
                .contains("online conversations feel less awkward now");
    }

    @Test
    void checkUsage_extracts_self_discovered_curiosity_phrase_with_contraction() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-6",
                "Travel",
                "MEDIUM",
                "Tell me about a place or culture you want to experience.",
                "경험해 보고 싶은 장소나 문화를 말해 보세요.",
                "Share one short reason."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "I'm curious about maid cafes because the theme looks fun.",
                        "session-6",
                        1,
                        List.of("For example, ...")
                )
        );

        assertThat(response.usedExpressions())
                .filteredOn(usage -> "SELF_DISCOVERED".equalsIgnoreCase(usage.source()))
                .extracting(usage -> usage.expression().toLowerCase())
                .contains("i'm curious about maid cafes");
    }

    @Test
    void checkUsage_removes_overlapping_shorter_used_expression_when_longer_phrase_exists() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-overlap",
                "Weekend",
                "EASY",
                "How do you usually spend your weekend?",
                "주말을 보통 어떻게 보내나요?",
                "장소나 함께 있는 사람을 함께 말하면 더 좋아요."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "On weekends, I usually work out and spend time with my family at the park.",
                        "session-overlap",
                        1,
                        List.of("On weekends, I usually...", "spend time with my family")
                )
        );

        assertThat(response.usedExpressions())
                .extracting(CoachExpressionUsageDto::expression)
                .contains("On weekends, I usually...", "spend time with my family at the park")
                .doesNotContain("spend time with my family");
    }

    @Test
    void checkUsage_prefers_openai_self_discovered_candidates_with_validation() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-7",
                "Travel",
                "MEDIUM",
                "Tell me about a place you want to visit and why.",
                "가 보고 싶은 장소와 이유를 말해 보세요.",
                "Use one or two sentences."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(openAiCoachClient.isConfigured()).thenReturn(true);
        when(openAiCoachClient.extractSelfDiscoveredExpressions(
                prompt,
                "I'd like to experience a maid cafe because it looks fun.",
                List.of("For example, ..."),
                List.of()
        )).thenReturn(List.of(
                new CoachSelfDiscoveredCandidateDto(
                        "I'd like to experience a maid cafe",
                        "가 보고 싶은 장소를 조금 더 자연스럽게 말한 표현이에요.",
                        "HIGH"
                ),
                new CoachSelfDiscoveredCandidateDto(
                        "a completely different phrase",
                        "무시돼야 하는 후보예요.",
                        "HIGH"
                )
        ));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "I'd like to experience a maid cafe because it looks fun.",
                        "session-7",
                        1,
                        List.of("For example, ...")
                )
        );

        assertThat(response.usedExpressions())
                .filteredOn(usage -> "SELF_DISCOVERED".equalsIgnoreCase(usage.source()))
                .extracting(usage -> usage.expression().toLowerCase())
                .contains("i'd like to experience a maid cafe")
                .doesNotContain("a completely different phrase");
    }

    @Test
    void checkUsage_falls_back_to_deterministic_self_discovered_when_openai_candidate_is_low_confidence() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-8",
                "Travel",
                "MEDIUM",
                "Tell me about a place you want to visit.",
                "가 보고 싶은 장소를 말해 보세요.",
                "Share one short reason."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(openAiCoachClient.isConfigured()).thenReturn(true);
        when(openAiCoachClient.extractSelfDiscoveredExpressions(
                prompt,
                "I'm curious about maid cafes because the theme looks fun.",
                List.of("For example, ..."),
                List.of()
        )).thenReturn(List.of(
                new CoachSelfDiscoveredCandidateDto(
                        "I'm curious about maid cafes",
                        "낮은 confidence 후보",
                        "LOW"
                )
        ));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "I'm curious about maid cafes because the theme looks fun.",
                        "session-8",
                        1,
                        List.of("For example, ...")
                )
        );

        assertThat(response.usedExpressions())
                .filteredOn(usage -> "SELF_DISCOVERED".equalsIgnoreCase(usage.source()))
                .extracting(usage -> usage.expression().toLowerCase())
                .contains("i'm curious about maid cafes");
    }

    @Test
    void help_prefers_dynamic_meaning_lookup_for_meeting_friends() {
        PromptDto prompt = new PromptDto(
                "prompt-meaning-1",
                "Daily Life",
                "EASY",
                "How do you usually spend your weekend?",
                "주말을 보통 어떻게 보내나요?",
                "Answer with a simple daily-life example."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto(
                        "hint-meaning-1",
                        prompt.id(),
                        "STARTER",
                        "Starter: \"On weekends, I usually ...\"",
                        1
                )
        ));

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(
                        prompt.id(),
                        "\uCE5C\uAD6C \uB9CC\uB09C\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4"
                )
        );

        assertThat(response.expressions())
                .extracting(expression -> expression.expression().toLowerCase())
                .contains("meet my friends", "hang out with my friends", "catch up with my friends");
        assertThat(response.expressions())
                .extracting(expression -> expression.expression().toLowerCase())
                .doesNotContain("i usually ...", "on weekends i usually");
    }

    @Test
    void help_supports_many_explicit_intent_query_patterns() {
        PromptDto prompt = new PromptDto(
                "prompt-intent-matrix",
                "General Writing",
                "MEDIUM",
                "Share your idea clearly.",
                "\uC0DD\uAC01\uC744 \uBD84\uBA85\uD558\uAC8C \uC801\uC5B4 \uBCF4\uC138\uC694.",
                "Use a clear answer."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        record QueryCase(String query, List<String> expectedExpressions) {}

        List<QueryCase> cases = List.of(
                new QueryCase(
                        "\uC774 \uC9C8\uBB38\uC5D0\uC11C \uC4F8 \uC218 \uC788\uB294 \uC774\uC720 \uD45C\uD604 \uC54C\uB824\uC918",
                        List.of("one reason is that ...", "this is because ...")
                ),
                new QueryCase(
                        "\uC0AC\uB840 \uD558\uB098 \uBD99\uC77C \uB54C \uC4F8 \uD45C\uD604 \uC54C\uB824\uC918",
                        List.of("for example, ...", "for instance, ...")
                ),
                new QueryCase(
                        "\uAC1C\uC778\uC801\uC73C\uB85C \uB9D0\uD560 \uB54C \uD45C\uD604 \uBB50 \uC788\uC5B4?",
                        List.of("i think ...", "in my opinion, ...")
                ),
                new QueryCase(
                        "\uBE44\uAD50\uD560 \uB54C \uC4F8 \uD45C\uD604 \uC54C\uB824\uC918",
                        List.of("on the other hand, ...", "in contrast, ...")
                ),
                new QueryCase(
                        "\uC774 \uC9C8\uBB38 \uB2F5 \uAD6C\uC870 \uC54C\uB824\uC918",
                        List.of("first, ...", "another point is that ...")
                ),
                new QueryCase(
                        "\uC7A5\uB2E8\uC810 \uBE44\uAD50\uD560 \uB54C \uC4F8 \uD45C\uD604 \uC54C\uB824\uC918",
                        List.of("on the one hand, ...", "overall, ...")
                ),
                new QueryCase(
                        "\uC2B5\uAD00 \uB9D0\uD560 \uB54C \uD45C\uD604 \uC54C\uB824\uC918",
                        List.of("i usually ...", "i often ...")
                ),
                new QueryCase(
                        "\uC62C\uD574 \uBAA9\uD45C \uB9D0\uD560 \uB54C \uD45C\uD604 \uC54C\uB824\uC918",
                        List.of("in the long run, ...", "my goal is to ...")
                ),
                new QueryCase(
                        "\uB354 \uAD6C\uCCB4\uC801\uC73C\uB85C \uC124\uBA85\uD558\uB294 \uD45C\uD604 \uC54C\uB824\uC918",
                        List.of("specifically, ...", "to be more specific, ...")
                )
        );

        for (QueryCase queryCase : cases) {
            CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), queryCase.query()));

            assertThat(lowerExpressions(response))
                    .as("query: %s", queryCase.query())
                    .containsAll(queryCase.expectedExpressions());
        }
    }

    @Test
    void help_handles_mixed_compare_and_opinion_queries() {
        PromptDto prompt = new PromptDto(
                "prompt-mixed-query",
                "General Writing",
                "MEDIUM",
                "Share your idea clearly.",
                "\uC0DD\uAC01\uC744 \uBD84\uBA85\uD558\uAC8C \uC801\uC5B4 \uBCF4\uC138\uC694.",
                "Use a clear answer."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "compare expression and opinion expression together")
        );

        assertThat(lowerExpressions(response))
                .contains("on the other hand, ...", "i think ...");
    }

    @Test
    void help_treats_short_structure_question_as_structure_not_meaning_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-short-structure",
                "General Writing",
                "EASY",
                "Share your answer.",
                "\uB2F5\uC744 \uC801\uC5B4 \uBCF4\uC138\uC694.",
                "Use a clear answer."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "\uBB50\uBD80\uD130 \uC368?")
        );

        assertThat(lowerExpressions(response))
                .contains("first, ...", "another point is that ...");
    }

    @Test
    void help_recognizes_meaning_lookup_keywords_for_deterministic_bundle() {
        PromptDto prompt = new PromptDto(
                "prompt-meaning-keyword",
                "Daily Life",
                "EASY",
                "How do you usually spend your weekend?",
                "\uC8FC\uB9D0\uC744 \uBCF4\uD1B5 \uC5B4\uB5BB\uAC8C \uBCF4\uB0B4\uC138\uC694?",
                "Answer with a simple daily-life example."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "sleep well meaning?";
        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response)).contains("sleep well", "go to bed");
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_uses_openai_for_unresolved_meaning_lookup_keywords() {
        PromptDto prompt = new PromptDto(
                "prompt-meaning-openai",
                "General Writing",
                "EASY",
                "How do you feel today?",
                "\uC624\uB298 \uAE30\uBD84\uC774 \uC5B4\uB54C\uC694?",
                "Describe your feeling."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "\uC6B4\uB3D9\uD558\uB2E4 \uB73B\uC774 \uBB50\uC57C?";
        when(openAiCoachClient.help(prompt, lookup, List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        lookup,
                        "Use natural 운동 expressions.",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("work out", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("exercise", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("train regularly", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains("work out", "exercise", "train regularly");
        verify(openAiCoachClient).help(prompt, lookup, List.of());
    }

    @Test
    void help_returns_learn_target_expressions_for_judo_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-learn-judo",
                "Growth",
                "EASY",
                "What is one skill you want to improve this year, and how will you practice it?",
                "\uC62C\uD574 \uB298\uB9AC\uACE0 \uC2F6\uC740 \uAE30\uC220 \uD558\uB098\uC640 \uC5B4\uB5BB\uAC8C \uC5F0\uC2B5\uD560\uC9C0 \uC4F0\uC138\uC694.",
                "Talk about a skill and your practice plan."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "\uC720\uB3C4\uB97C \uBC30\uC6B0\uACE0 \uC2F6\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4";
        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "i want to learn judo.",
                        "i want to start learning judo.",
                        "judo",
                        "practice judo",
                        "get better at judo"
                );
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_returns_growth_capability_expressions_for_strength_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-growth-strength",
                "Growth",
                "EASY",
                "What is one skill you want to improve this year, and how will you practice it?",
                "\uC62C\uD574 \uB298\uB9AC\uACE0 \uC2F6\uC740 \uAE30\uC220 \uD558\uB098\uC640 \uC5B4\uB5BB\uAC8C \uC5F0\uC2B5\uD560\uC9C0 \uC4F0\uC138\uC694.",
                "Talk about a skill and your practice plan."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "근력을 키우고 싶다";
        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "i want to improve my strength.",
                        "i want to work on my strength.",
                        "i want to develop my strength.",
                        "i want to build up my strength.",
                        "strength"
                );
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_returns_reduce_manage_expressions_for_stress_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-reduce-stress",
                "Daily Life",
                "MEDIUM",
                "What habit would you like to change this year?",
                "\uC62C\uD574 \uBC14\uAFB8\uACE0 \uC2F6\uC740 \uC2B5\uAD00 \uD558\uB098\uB97C \uC368 \uBCF4\uC138\uC694.",
                "Talk about one habit you want to change."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "스트레스를 줄이고 싶다";
        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "i want to reduce my stress.",
                        "i want to manage my stress better.",
                        "i want to work on lowering my stress.",
                        "i want to cut down on my stress."
                );
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_uses_slot_translation_fallback_for_unknown_growth_target() {
        PromptDto prompt = new PromptDto(
                "prompt-growth-unknown",
                "Growth",
                "EASY",
                "What would you like to improve this year?",
                "\uC62C\uD574 \uB354 \uC88B\uAC8C \uB9CC\uB4E4\uACE0 \uC2F6\uC740 \uAC83\uC744 \uC368 \uBCF4\uC138\uC694.",
                "Talk about something you want to improve."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "회복력을 키우고 싶다";
        when(openAiCoachClient.translateMeaningSlot(
                org.mockito.ArgumentMatchers.eq(prompt),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.eq(CoachQueryAnalyzer.ActionFamily.GROWTH_CAPABILITY),
                org.mockito.ArgumentMatchers.eq(CoachQueryAnalyzer.MeaningSlot.TARGET),
                org.mockito.ArgumentMatchers.anyString()
        )).thenReturn("resilience");

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "i want to improve my resilience.",
                        "i want to work on my resilience.",
                        "i want to develop my resilience.",
                        "i want to build up my resilience.",
                        "resilience"
                );
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_uses_openai_meaning_lookup_for_generic_desire_state_statement() {
        PromptDto prompt = new PromptDto(
                "prompt-desire-state",
                "Self image",
                "MEDIUM",
                "How would you like to present yourself to others?",
                "\uB2E4\uB978 \uC0AC\uB78C\uC5D0\uAC8C \uC5B4\uB5A4 \uC778\uC0C1\uC73C\uB85C \uBCF4\uC774\uACE0 \uC2F6\uB098\uC694?",
                "Talk about the impression you want to give."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "매력적으로 보이고 싶다";
        when(openAiCoachClient.help(prompt, lookup, List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        lookup,
                        "표현하고 싶은 인상에 가까운 표현을 골랐어요.",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("I want to look attractive.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("I want to come across as attractive.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("I want to seem more attractive.", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "i want to look attractive.",
                        "i want to come across as attractive.",
                        "i want to seem more attractive."
        );
        verify(openAiCoachClient).help(prompt, lookup, List.of());
    }

    @Test
    void help_downgrades_generic_meaning_lookup_openai_response_to_writing_support() {
        PromptDto prompt = new PromptDto(
                "prompt-hybrid-downgrade",
                "Self image",
                "MEDIUM",
                "How would you like to present yourself to others?",
                "\uB2E4\uB978 \uC0AC\uB78C\uC5D0\uAC8C \uC5B4\uB5A4 \uC778\uC0C1\uC73C\uB85C \uBCF4\uC774\uACE0 \uC2F6\uB098\uC694?",
                "Talk about the impression you want to give."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "이 질문에서 매력적으로 보이고 싶을 때 쓸 표현 알려줘";
        when(openAiCoachClient.help(prompt, lookup, List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        lookup,
                        "generic",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("One reason is that ...", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("For example, ...", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("I think ...", "a", "b", "c", "COACH")
                        )
                ),
                new CoachHelpResponseDto(
                        prompt.id(),
                        lookup,
                        "support",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("I want to look attractive.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("I want to come across as attractive.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("To sound more natural, ...", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains("i want to look attractive.", "i want to come across as attractive.");
        verify(openAiCoachClient, times(2)).help(prompt, lookup, List.of());
    }

    @Test
    void help_returns_prompt_specific_ideas_for_reason_brainstorm_question() {
        PromptDto prompt = new PromptDto(
                "prompt-idea-society",
                "Society",
                "HARD",
                "What kind of social responsibility should successful companies have in modern society?",
                "성공한 기업이 현대 사회에서 어떤 사회적 책임을 가져야 하는지 써 보세요.",
                "State your opinion and support it."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "이 질문에 쓸 수 있는 이유가 뭐가 있을까")
        );

        assertThat(lowerExpressions(response))
                .contains(
                        "companies can provide educational opportunities",
                        "companies can create job opportunities in local communities",
                        "companies should protect the environment through sustainable policies"
                )
                .doesNotContain("one reason is that ...", "this is because ...", "i think ...");
        assertThat(response.coachReply()).contains("이유 아이디어");
    }

    @Test
    void help_uses_openai_for_idea_support_when_available() {
        PromptDto prompt = new PromptDto(
                "prompt-idea-growth",
                "Growth",
                "MEDIUM",
                "What is one skill you want to improve this year, and how will you practice it?",
                "올해 늘리고 싶은 기술 하나와 어떻게 연습할지 써 보세요.",
                "Talk about a skill and your practice plan."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String question = "이 질문에 넣을 만한 이유가 뭐가 있을까";
        when(openAiCoachClient.help(prompt, question, List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        question,
                        "ideas",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("it can help me feel more confident over time", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("it will be useful in my daily life", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("small daily practice can lead to steady progress", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), question));

        assertThat(lowerExpressions(response))
                .contains(
                        "it can help me feel more confident over time",
                        "it will be useful in my daily life",
                        "small daily practice can lead to steady progress"
                );
        verify(openAiCoachClient).help(prompt, question, List.of());
    }

    @Test
    void help_rejects_generic_openai_response_for_idea_support_and_uses_local_ideas() {
        PromptDto prompt = new PromptDto(
                "prompt-idea-tech",
                "Technology",
                "HARD",
                "How has technology changed the way people build relationships, and is that change mostly positive?",
                "기술이 사람들이 관계를 맺는 방식을 어떻게 바꿨는지, 그리고 그 변화가 대체로 긍정적인지 써 보세요.",
                "Discuss one clear change and your opinion."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String question = "이 질문에 쓸 수 있는 이유가 뭐가 있을까";
        when(openAiCoachClient.help(prompt, question, List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        question,
                        "generic",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("One reason is that ...", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("For example, ...", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("I think ...", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), question));

        assertThat(lowerExpressions(response))
                .contains(
                        "technology makes it easier to stay in touch with people",
                        "people can meet others online beyond their local area",
                        "long-distance relationships are easier to maintain now"
                )
                .doesNotContain("one reason is that ...", "for example, ...", "i think ...");
    }

    @Test
    void help_uses_slot_translation_fallback_for_unknown_learn_target_variant() {
        PromptDto prompt = new PromptDto(
                "prompt-learn-spanish",
                "Growth",
                "EASY",
                "What is one skill you want to improve this year, and how will you practice it?",
                "\uC62C\uD574 \uB298\uB9AC\uACE0 \uC2F6\uC740 \uAE30\uC220 \uD558\uB098\uC640 \uC5B4\uB5BB\uAC8C \uC5F0\uC2B5\uD560\uC9C0 \uC4F0\uC138\uC694.",
                "Talk about a skill and your practice plan."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "\uC2A4\uD398\uC778\uC5B4\uB97C \uBC30\uC6CC\uC57C\uD55C\uB2E4\uACE0 \uB9D0 \uD558\uACE0\uC2F6\uC5B4";
        when(openAiCoachClient.translateMeaningSlot(
                org.mockito.ArgumentMatchers.eq(prompt),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.eq(CoachQueryAnalyzer.ActionFamily.LEARN),
                org.mockito.ArgumentMatchers.eq(CoachQueryAnalyzer.MeaningSlot.TARGET),
                org.mockito.ArgumentMatchers.anyString()
        )).thenReturn("Spanish");

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "i want to learn spanish.",
                        "i want to start learning spanish.",
                        "spanish",
                        "practice spanish",
                        "get better at spanish"
                );
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_returns_state_change_expressions_for_online_relationship_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-online-relationship",
                "Technology",
                "HARD",
                "How has technology changed the way people build relationships, and do you think that change is mostly positive?",
                "\uAE30\uC220\uC740 \uC0AC\uB78C\uB4E4\uC774 \uAD00\uACC4\uB97C \uB9FA\uB294 \uBC29\uC2DD\uC744 \uC5B4\uB5BB\uAC8C \uBC14\uAFC8\uB098\uC694? \uADF8 \uBCC0\uD654\uAC00 \uB300\uCCB4\uB85C \uAE0D\uC815\uC801\uC774\uB77C\uACE0 \uC0DD\uAC01\uD558\uB098\uC694?",
                "Talk about relationship changes and your opinion."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "\uC778\uD130\uB137\uC5D0\uC11C\uC758 \uB9CC\uB0A8\uC774 \uC790\uC5F0\uC2A4\uB7EC\uC6CC\uC84C\uB2E4\uB97C \uC5B4\uB5BB\uAC8C \uB9D0\uD574";
        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "meeting people online has become more natural.",
                        "it has become more natural to meet people online.",
                        "people have become more comfortable with meeting people online.",
                        "meeting people online feels more natural now."
                );
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_returns_visit_interest_expressions_for_place_interest_lookup() {
        PromptDto prompt = new PromptDto(
                "prompt-visit-interest",
                "Travel",
                "MEDIUM",
                "Tell me about a place you want to visit and what you want to do there.",
                "\uAC00 \uBCF4\uACE0 \uC2F6\uC740 \uACF3\uACFC \uADF8\uACF3\uC5D0\uC11C \uD558\uACE0 \uC2F6\uC740 \uAC83\uC744 \uB9D0\uD574 \uBCF4\uC138\uC694.",
                "Share one place and one activity."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        String lookup = "\uBA54\uC774\uB4DC\uCE74\uD398\uC5D0 \uAC00\uBCF4\uACE0 \uC2F6\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4";
        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains(
                        "i want to visit maid cafe.",
                        "i'd like to visit maid cafe.",
                        "i'm curious about maid cafe.",
                        "i'm interested in maid cafe.",
                        "i want to experience maid cafe."
                );
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(lookup),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_uses_openai_when_learning_target_translation_is_unknown() {
        PromptDto prompt = new PromptDto(
                "prompt-learn-unknown",
                "General Writing",
                "EASY",
                "Share a short answer.",
                "\uC9E7\uAC8C \uB2F5\uD574 \uBCF4\uC138\uC694.",
                "Write one or two sentences."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);

        String lookup = "\uAD81\uB3C4\uB97C \uBC30\uC6B0\uACE0 \uC2F6\uB2E4\uACE0 \uB9D0\uD558\uACE0 \uC2F6\uC5B4";
        when(openAiCoachClient.help(prompt, lookup, List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        lookup,
                        "Use natural archery expressions.",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("I want to learn archery.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("I want to start learning archery.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("My goal is to learn archery.", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(new CoachHelpRequestDto(prompt.id(), lookup));

        assertThat(lowerExpressions(response))
                .contains("i want to learn archery.", "i want to start learning archery.", "my goal is to learn archery.");
        verify(openAiCoachClient).help(prompt, lookup, List.of());
    }

    @Test
    void help_persists_structured_interaction_log() {
        PromptDto prompt = new PromptDto(
                "prompt-log-1",
                "Growth",
                "EASY",
                "What is one skill you want to improve this year, and how will you practice it?",
                "올해 키우고 싶은 기술 하나와, 어떻게 연습할지 말해 보세요.",
                "Talk about one skill and your practice plan."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto("hint-1", prompt.id(), "STRUCTURE", "Use one clear reason.", 1)
        ));
        when(openAiCoachClient.isConfigured()).thenReturn(true);
        when(openAiCoachClient.translateMeaningSlot(
                prompt,
                "스페인어를 배워야한다고 말 하고싶어",
                CoachQueryAnalyzer.ActionFamily.LEARN,
                CoachQueryAnalyzer.MeaningSlot.TARGET,
                "스페인어"
        )).thenReturn("Spanish");

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(
                        prompt.id(),
                        "스페인어를 배워야한다고 말 하고싶어",
                        "session-1",
                        "I want to improve my language skills.",
                        "INITIAL"
                ),
                7L,
                "http-session-1"
        );

        ArgumentCaptor<CoachInteractionEntity> captor = ArgumentCaptor.forClass(CoachInteractionEntity.class);
        verify(coachInteractionRepository).save(captor.capture());

        CoachInteractionEntity saved = captor.getValue();
        assertThat(response.interactionId()).isEqualTo(saved.getRequestId());
        assertThat(saved.getPromptId()).isEqualTo(prompt.id());
        assertThat(saved.getUserId()).isEqualTo(7L);
        assertThat(saved.getAnswerSessionId()).isEqualTo("session-1");
        assertThat(saved.getAttemptContextType()).isEqualTo(AttemptType.INITIAL);
        assertThat(saved.getQueryMode()).isEqualTo("MEANING_LOOKUP");
        assertThat(saved.getMeaningFamily()).isEqualTo("LEARN");
        assertThat(saved.getResponseSource()).isEqualTo(CoachResponseSource.DETERMINISTIC);
        assertThat(saved.getAnalysisPayloadJson()).contains("Spanish");
        assertThat(saved.getExpressionsJson()).contains("I want to learn Spanish.");
    }

    @Test
    void checkUsage_updates_existing_interaction_when_interaction_id_is_present() {
        PromptDto prompt = new PromptDto(
                "prompt-usage-log",
                "Daily Life",
                "EASY",
                "What habit do you want to build this year?",
                "올해 만들고 싶은 습관을 말해 보세요.",
                "Talk about one habit."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));

        AnswerAttemptEntity attempt = new AnswerAttemptEntity(
                "session-1",
                1,
                AttemptType.INITIAL,
                "I want to learn Spanish this year.",
                88,
                "Good",
                "[]",
                "[]",
                "model answer",
                "rewrite",
                "{}"
        );
        CoachInteractionEntity interaction = new CoachInteractionEntity(
                "interaction-1",
                7L,
                "http-session-1",
                null,
                AttemptType.INITIAL,
                prompt.id(),
                prompt.topic(),
                prompt.difficulty(),
                prompt.questionEn(),
                prompt.questionKo(),
                prompt.tip(),
                "[]",
                "스페인어를 배우고 싶다고 말하고 싶어",
                "스페인어를 배우고 싶다고 말하고 싶어",
                "I want to improve my language skills.",
                "MEANING_LOOKUP",
                "LEARN",
                "{}",
                "coach reply",
                "[]",
                CoachResponseSource.DETERMINISTIC_WITH_SLOT_TRANSLATION,
                "gpt-4o"
        );

        when(answerAttemptRepository.findBySessionIdAndAttemptNo("session-1", 1)).thenReturn(Optional.of(attempt));
        when(answerSessionRepository.findById("session-1")).thenReturn(Optional.of(
                new AnswerSessionEntity(
                        "session-1",
                        prompt.id(),
                        null,
                        7L,
                        SessionStatus.IN_PROGRESS
                )
        ));
        when(coachInteractionRepository.findByRequestId("interaction-1")).thenReturn(Optional.of(interaction));

        CoachUsageCheckResponseDto response = coachService.checkUsage(
                new CoachUsageCheckRequestDto(
                        prompt.id(),
                        "I want to learn Spanish.",
                        "session-1",
                        1,
                        List.of("I want to learn Spanish.", "practice Spanish"),
                        "interaction-1"
                ),
                7L,
                "http-session-1"
        );

        assertThat(response.usedExpressions()).isNotEmpty();
        assertThat(interaction.getAnswerSessionId()).isEqualTo("session-1");
        assertThat(interaction.getAnswerAttemptNo()).isEqualTo(1);
        assertThat(interaction.getUsedExpressionsJson()).contains("I want to learn Spanish.");
        assertThat(interaction.getUsagePayloadJson()).contains("usedExpressions");
        verify(coachInteractionRepository).save(interaction);
        verify(answerAttemptRepository).save(any(AnswerAttemptEntity.class));
    }

    @Test
    void help_returns_idea_support_for_reason_points_variant() {
        PromptDto prompt = new PromptDto(
                "prompt-idea-society-2",
                "Society",
                "HARD",
                "What kind of social responsibility should successful companies have in modern society?",
                "성공한 기업이 현대 사회에서 어떤 사회적 책임을 가져야 하는지 써 보세요.",
                "State your opinion and support it."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "성공한 기업 책임에 대한 이유 포인트 뭐가 있어?")
        );

        assertThat(lowerExpressions(response))
                .contains(
                        "companies can provide educational opportunities",
                        "companies can create job opportunities in local communities"
                )
                .doesNotContain("one reason is that ...", "this is because ...");
    }

    @Test
    void help_returns_idea_support_for_compact_reason_idea_label() {
        PromptDto prompt = new PromptDto(
                "prompt-idea-society-compact",
                "Society",
                "HARD",
                "What kind of social responsibility should successful companies have in modern society?",
                "성공한 기업은 현대 사회에서 어떤 사회적 책임을 가져야 하는지 써 보세요.",
                "State your opinion and support it."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "이 질문 이유 아이디어")
        );

        assertThat(lowerExpressions(response))
                .contains(
                        "companies can provide educational opportunities",
                        "companies can create job opportunities in local communities"
                )
                .doesNotContain("one reason is that ...", "this is because ...");
    }

    @Test
    void help_returns_idea_support_for_compact_case_question() {
        PromptDto prompt = new PromptDto(
                "prompt-idea-tech-compact",
                "Technology",
                "HARD",
                "How has technology changed the way people build relationships, and is that change mostly positive?",
                "기술이 사람들이 관계를 맺는 방식을 어떻게 바꿨는지 말해 보세요.",
                "Discuss one clear change."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "사례 뭐 넣지")
        );

        assertThat(lowerExpressions(response))
                .contains(
                        "technology makes it easier to stay in touch with people",
                        "people can meet others online beyond their local area"
                )
                .doesNotContain("for example, ...", "for instance, ...");
    }

    @Test
    void help_blends_support_expressions_for_hybrid_lookup_request() {
        PromptDto prompt = new PromptDto(
                "prompt-hybrid-social",
                "Daily life",
                "MEDIUM",
                "How do you usually spend time with your friends?",
                "친구들과 보통 어떻게 시간을 보내는지 써 보세요.",
                "Mention one example."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(false);

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "친구 만난다고 말하고 싶어 예시도 같이 알려줘")
        );

        assertThat(lowerExpressions(response))
                .contains("meet my friends")
                .anyMatch(expression -> expression.equals("for example, ...") || expression.equals("for instance, ..."));
    }

    @Test
    void help_blends_structure_support_for_hybrid_lookup_request() {
        PromptDto prompt = new PromptDto(
                "prompt-hybrid-visit-structure",
                "Travel",
                "MEDIUM",
                "Tell me about a place you want to visit and what you want to do there.",
                "가 보고 싶은 곳과 거기서 하고 싶은 일을 말해 보세요.",
                "Share one place and one activity."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(false);

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "메이드카페에 가보고 싶다고 하고 싶은데 첫 문장도 추천해줘")
        );

        assertThat(lowerExpressions(response))
                .contains("i want to visit maid cafe.")
                .contains("first, ...");
    }

    @Test
    void help_blends_balance_support_for_hybrid_lookup_request() {
        PromptDto prompt = new PromptDto(
                "prompt-hybrid-balance",
                "Technology",
                "HARD",
                "How has technology changed the way people build relationships, and is that change mostly positive?",
                "기술이 사람들이 관계를 맺는 방식을 어떻게 바꿨는지 말해 보세요.",
                "Discuss one clear change."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(false);

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "온라인 관계가 더 자연스럽다고 말하고 싶은데 반대 의견 표현도 있으면 좋겠어")
        );

        assertThat(lowerExpressions(response))
                .anyMatch(expression -> expression.contains("more natural"))
                .anyMatch(expression -> expression.equals("on the one hand, ...")
                        || expression.equals("on the other hand, ...")
                        || expression.equals("overall, ...")
                        || expression.equals("in contrast, ..."));
    }

    @Test
    void help_uses_prompt_scoped_state_change_for_relationship_change_statement() {
        PromptDto prompt = new PromptDto(
                "prompt-tech-state",
                "Technology",
                "HARD",
                "How has technology changed the way people build relationships, and is that change mostly positive?",
                "기술이 사람들이 관계를 맺는 방식을 어떻게 바꿨는지 말해 보세요.",
                "Discuss one clear change."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(false);

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "멀리 사는 사람과도 자연스럽게 친해진다")
        );

        assertThat(lowerExpressions(response))
                .anySatisfy(expression -> assertThat(expression).contains("more natural"));
        verify(openAiCoachClient, never()).help(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq("멀리 사는 사람과도 자연스럽게 친해진다"),
                org.mockito.ArgumentMatchers.anyList()
        );
    }

    @Test
    void help_filters_mixed_openai_response_to_starter_only_expressions() {
        PromptDto prompt = new PromptDto(
                "prompt-starter-support",
                "Technology",
                "HARD",
                "How has technology changed the way people build relationships, and do you think that change is mostly positive?",
                "湲곗닠???ъ엺?ㅼ씠 愿怨꾨? 留뚮뱶???⑸땲寃??대? ?대뼸寃?諛붾퓭?덉뒗吏, 洹?蹂?붽? ???濡?湲띿젙?곸씤吏 留먰빐 蹂댁꽭??",
                "Start with your main point."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(true);
        when(openAiCoachClient.help(prompt, "泥?臾몄옣???쒖옉?섎뒗 ?먯뿰?ㅻ읇? ?쒗쁽 ?뚮젮以?", List.of())).thenReturn(
                new CoachHelpResponseDto(
                        prompt.id(),
                        "泥?臾몄옣???쒖옉?섎뒗 ?먯뿰?ㅻ읇? ?쒗쁽 ?뚮젮以?",
                        "",
                        List.of(
                                new com.writeloop.dto.CoachExpressionDto("Technology has completely transformed how we connect with each other.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("On one hand, technology has made staying in touch easier than ever.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("Overall, these changes have reshaped the way relationships develop.", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("I think ...", "a", "b", "c", "COACH"),
                                new com.writeloop.dto.CoachExpressionDto("Specifically, ...", "a", "b", "c", "COACH")
                        )
                )
        );

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "泥?臾몄옣???쒖옉?섎뒗 ?먯뿰?ㅻ읇? ?쒗쁽 ?뚮젮以?")
        );

        assertThat(lowerExpressions(response))
                .anyMatch(expression -> expression.contains("technology has completely transformed"))
                .anyMatch(expression -> expression.equals("i think ..."))
                .noneMatch(expression -> expression.startsWith("on one hand"))
                .noneMatch(expression -> expression.startsWith("overall"))
                .noneMatch(expression -> expression.startsWith("specifically"));
        assertThat(response.coachReply()).contains("첫 문장");
    }

    @Test
    void help_treats_compact_start_question_as_starter_request() {
        PromptDto prompt = new PromptDto(
                "prompt-starter-compact-help",
                "Skills",
                "EASY",
                "What is one skill you want to improve this year, and how will you practice it?",
                "\uC62C\uD574 \uD5A5\uC0C1\uD558\uACE0 \uC2F6\uC740 \uAE30\uC220 \uD558\uB098\uC640 \uC5F0\uC2B5 \uACC4\uD68D\uC744 \uB9D0\uD574 \uBCF4\uC138\uC694.",
                "Start with your main point."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of());
        when(openAiCoachClient.isConfigured()).thenReturn(false);

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "\uBB50\uB77C \uC2DC\uC791\uD574")
        );

        assertThat(lowerExpressions(response))
                .contains("these days, ...", "in modern society, ...", "i think ...")
                .noneMatch(expression -> expression.equals("one reason is that ..."))
                .noneMatch(expression -> expression.equals("for example, ..."));
        assertThat(response.coachReply()).contains("\uCCAB \uBB38\uC7A5");
    }

    @Test
    void help_uses_item_only_hints_when_legacy_content_is_missing() {
        PromptDto prompt = new PromptDto(
                "prompt-items-only-1",
                "Time management",
                "EASY",
                "What challenge do you face with time management?",
                "What challenge do you face with time management?",
                "Use natural expressions."
        );
        when(promptService.findAll()).thenReturn(List.of(prompt));
        when(promptService.findHintsByPromptId(prompt.id())).thenReturn(List.of(
                new PromptHintDto(
                        "hint-1",
                        prompt.id(),
                        "VOCAB_WORD",
                        "활용 단어",
                        null,
                        1,
                        List.of(
                                new PromptHintItemDto("item-1", "hint-1", "WORD", "deadline", null, null, null, null, 1),
                                new PromptHintItemDto("item-2", "hint-1", "WORD", "pressure", null, null, null, null, 2)
                        )
                )
        ));
        when(openAiCoachClient.isConfigured()).thenReturn(false);

        CoachHelpResponseDto response = coachService.help(
                new CoachHelpRequestDto(prompt.id(), "Need help")
        );

        assertThat(lowerExpressions(response)).contains("deadline", "pressure");
    }

    private List<String> lowerExpressions(CoachHelpResponseDto response) {
        return response.expressions().stream()
                .map(expression -> expression.expression().toLowerCase())
                .toList();
    }
}
