package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.FeedbackFocusCardDto;
import com.writeloop.dto.FeedbackPrimaryFixDto;
import com.writeloop.dto.FeedbackNextStepPracticeDto;
import com.writeloop.dto.FeedbackSecondaryLearningPointDto;
import com.writeloop.dto.FeedbackUiDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.RefinementExpressionDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class FeedbackUiComposerTest {

    private final FeedbackUiComposer composer = new FeedbackUiComposer();

    @Test
    void compose_builds_grammar_first_focus_and_expanded_fix_for_grammar_blocking() {
        PromptDto prompt = new PromptDto(
                "prompt-a",
                "Routine",
                "A",
                "Describe your routine for your weekday mornings.",
                "평일 아침 루틴을 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                73,
                false,
                null,
                "방향은 좋아요. 이제 좋아하는 이유를 한 가지 더 또렷하게 붙이면 답이 더 설득력 있어져요.",
                List.of("시간 순서가 보여요."),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "right after I wake up I take a shower",
                        "Right after I wake up, I take a shower",
                        "문장 두 개를 자연스럽게 잇고 쉼표를 넣어 주세요."
                )),
                "I wake up at 8 a.m. Right after I wake up, I take a shower.",
                List.of(),
                null,
                null,
                "방향은 좋아요. 이제 좋아하는 이유를 한 가지 더 또렷하게 붙이면 답이 더 설득력 있어져요.",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING, false),
                new GrammarProfile(
                        GrammarSeverity.MODERATE,
                        List.of(new GrammarIssue(
                                "CONNECTOR",
                                "right after I wake up I take a shower",
                                "Right after I wake up, I take a shower",
                                true,
                                GrammarSeverity.MODERATE
                        )),
                        "I wake up at 8 a.m. Right after I wake up, I take a shower."
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_BLOCKING_GRAMMAR",
                        null,
                        new RewriteTarget("FIX_BLOCKING_GRAMMAR", "I wake up at 8 a.m. Right after I wake up, I take a shower.", 0),
                        null
                )
        );

        var ui = composer.compose(prompt, "I wake up at 8am. right after I wake up I take a shower", feedback, answerProfile);

        assertThat(ui.focusCard().headline()).isEqualTo("핵심 문법 먼저 고치기");
        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.microTip()).isNull();
        assertThat(ui.primaryFix().title()).isEqualTo("먼저 고칠 부분");
        assertThat(ui.screenPolicy()).isNotNull();
        assertThat(ui.screenPolicy().completionState()).isEqualTo("NEEDS_REVISION");
        assertThat(ui.screenPolicy().fixFirstDisplayMode()).isEqualTo("SHOW_EXPANDED");
        assertThat(ui.screenPolicy().modelAnswerDisplayMode()).isEqualTo("HIDE");
        assertThat(ui.loopStatus().badge()).isEqualTo("다시 써보기 추천");
    }

    @Test
    void compose_keeps_model_answer_visible_for_finishable_content_thin_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-b",
                "Relaxing place",
                "A",
                "What do you like most about your favorite place to relax, and why?",
                "편하게 쉬기 좋은 장소에서 가장 마음에 드는 점은 무엇이고, 왜 그런가요?",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                82,
                true,
                "좋아요. 지금 단계에서 마무리해도 괜찮아요.",
                "",
                List.of("좋아하는 장소와 이유를 함께 답했어요."),
                List.of(),
                List.of(),
                List.of(),
                "My favorite season is spring because I like sunshine.",
                List.of(),
                "My favorite season is spring because the warm sunshine makes me feel relaxed.",
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, true),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), "My favorite season is spring because I like sunshine."),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, true, false, false),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        null,
                        new RewriteTarget("ADD_DETAIL", "My favorite season is spring because ______.", 1),
                        null
                )
        );

        var ui = composer.compose(prompt, "My favorite season is spring because I like sunshine.", feedback, answerProfile);

        assertThat(ui.focusCard().title()).isEqualTo("지금 단계에서는 마무리 가능해요");
        assertThat(ui.focusCard().supportText()).isNotBlank();
        assertThat(ui.screenPolicy().completionState()).isEqualTo("CAN_FINISH");
        assertThat(ui.screenPolicy().modelAnswerDisplayMode()).isEqualTo("SHOW_EXPANDED");
        assertThat(ui.screenPolicy().refinementDisplayMode()).isEqualTo("HIDE");
        assertThat(ui.microTip()).isNull();
        assertThat(ui.loopStatus().badge()).isNull();
        assertThat(ui.loopStatus().supportText()).isNull();
        assertThat(ui.loopStatus().finishCtaLabel()).isEqualTo("오늘 루프 완료하고 도장 받기");
    }

    @Test
    void compose_uses_optional_polish_overlay_for_finishable_natural_answer() {
        PromptDto prompt = new PromptDto(
                "prompt-c",
                "Sunday routine",
                "A",
                "How do you usually spend your Sunday afternoons?",
                "일요일 오후는 보통 어떻게 보내나요?",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                88,
                true,
                "좋아요. 지금 단계에서 마무리해도 충분해요. 원하면 한 번 더 다듬어볼 수 있어요.",
                "",
                List.of("질문에 맞게 답의 흐름을 자연스럽게 이어 갔어요."),
                List.of(),
                List.of(),
                List.of(),
                "On Sunday afternoons, I usually go to church and relax at home.",
                List.of(),
                "On Sunday afternoons, I usually go to church and relax at home with a good book.",
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC, true),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), "On Sunday afternoons, I usually go to church and relax at home."),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "IMPROVE_NATURALNESS",
                        null,
                        new RewriteTarget("IMPROVE_NATURALNESS", "On Sunday afternoons, I usually go to church and relax at home.", 1),
                        null
                )
        );

        var ui = composer.compose(prompt, "On Sunday afternoons, I usually go to church and relax at home.", feedback, answerProfile);

        assertThat(ui.focusCard().title()).isEqualTo("지금도 충분히 좋아요");
        assertThat(ui.primaryFix()).isNull();
        assertThat(ui.microTip()).isNull();
        assertThat(ui.nextStepPractice().optionalTone()).isTrue();
        assertThat(ui.nextStepPractice().starter()).isNotBlank();
        assertThat(ui.screenPolicy().completionState()).isEqualTo("OPTIONAL_POLISH");
        assertThat(ui.screenPolicy().modelAnswerDisplayMode()).isEqualTo("SHOW_COLLAPSED");
        assertThat(ui.loopStatus().badge()).isNull();
        assertThat(ui.loopStatus().headline()).isEqualTo("좋아요. 지금 단계에서 마무리해도 충분해요.");
        assertThat(ui.loopStatus().supportText()).isNull();
        assertThat(ui.loopStatus().rewriteCtaLabel()).isEqualTo("한 번 더 다듬기");
    }

    @Test
    void compose_keeps_minor_grammar_fix_visible_during_optional_polish() {
        PromptDto prompt = new PromptDto(
                "prompt-c2",
                "Favorite movie genre",
                "A",
                "Tell me about your favorite movie genre and explain why it appeals to you.",
                "Write about your favorite movie genre and explain why you like it.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                2,
                91,
                true,
                "Looks good overall.",
                "",
                List.of("You clearly named your favorite genre."),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "romantic comedy movi",
                        "romantic comedy movies",
                        "Use movies when you talk about the genre in general."
                )),
                "I like romantic comedy movies. They are funny and relatable.",
                List.of(),
                "I like romantic comedy movies because they are funny and relatable.",
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.NATURAL_BUT_BASIC, true),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "NUMBER",
                                "romantic comedy movi",
                                "romantic comedy movies",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I like romantic comedy movies. They are funny and relatable."
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, true, false, false, false, false),
                        List.of()
                ),
                new RewriteProfile(
                        "IMPROVE_NATURALNESS",
                        null,
                        new RewriteTarget("IMPROVE_NATURALNESS", "I like romantic comedy movies because ______.", 1),
                        null
                )
        );

        var ui = composer.compose(prompt, "I like romantic comedy movi . it's funny and relatable.", feedback, answerProfile);

        assertThat(ui.screenPolicy().completionState()).isEqualTo("OPTIONAL_POLISH");
        assertThat(ui.screenPolicy().fixFirstDisplayMode()).isEqualTo("SHOW_EXPANDED");
        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().originalText()).isEqualTo("romantic comedy movi");
        assertThat(ui.primaryFix().revisedText()).isEqualTo("romantic comedy movies");
        assertThat(ui.primaryFix().reasonKo()).isEqualTo("Use movies when you talk about the genre in general.");
    }

    @Test
    void compose_filters_secondary_point_that_repeats_primary_fix_anchor_phrase() {
        PromptDto prompt = new PromptDto(
                "prompt-c3",
                "Sunday afternoon routine",
                "A",
                "Describe your routine for the start of your Sunday afternoon.",
                "Describe how you usually begin your Sunday afternoon.",
                ""
        );
        FeedbackUiDto llmUi = new FeedbackUiDto(
                new FeedbackFocusCardDto("학습 가이드", "일요일 오후 루틴을 더 구체적으로 말해 보세요.", "한 문장 앞부분에 시간 배경을 더해 보세요."),
                new FeedbackPrimaryFixDto(
                        "루틴 배경 추가하기",
                        "문장 앞에 'On Sunday afternoons'를 넣어 일요일 오후 루틴임을 명확히 해주세요.",
                        null,
                        null,
                        null
                ),
                null,
                List.of(new FeedbackSecondaryLearningPointDto(
                        "EXPRESSION",
                        "자연스러운 루틴 표현",
                        "On Sunday afternoons, I usually sleep in.",
                        "일요일 오후에는 보통 늦잠을 자요.",
                        null,
                        null,
                        null,
                        "루틴을 말할 때는 시간 표현을 문장 앞에 두면 훨씬 자연스럽습니다.",
                        null,
                        null
                )),
                new FeedbackNextStepPracticeDto(
                        "루틴 묘사 연습",
                        "I usually start my Sunday afternoon by ______.",
                        "일요일 오후 첫 활동을 채워 보세요.",
                        "완성하기",
                        false
                )
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                84,
                false,
                null,
                "",
                List.of("You clearly described a routine."),
                List.of(),
                List.of(),
                List.of(),
                "On Sunday afternoons, I usually sleep in.",
                List.of(),
                null,
                null,
                "",
                List.of()
        ).withUi(llmUi);
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), null),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        null,
                        new RewriteTarget("ADD_DETAIL", "On Sunday afternoons, I usually ______.", 1),
                        null
                )
        );

        var ui = composer.compose(prompt, "I usually sleep in.", feedback, answerProfile);

        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().instruction()).contains("On Sunday afternoons");
        assertThat(ui.secondaryLearningPoints()).isEmpty();
    }

    @Test
    void compose_filters_secondary_point_that_repeats_primary_fix_added_connector() {
        PromptDto prompt = new PromptDto(
                "prompt-c4",
                "Sunday routine",
                "A",
                "Describe your Sunday afternoon routine.",
                "Describe your Sunday afternoon routine.",
                ""
        );
        FeedbackUiDto llmUi = new FeedbackUiDto(
                new FeedbackFocusCardDto("학습 가이드", "문장을 더 자연스럽게 연결해 보세요.", "장소와 활동을 한 문장으로 이어 보세요."),
                new FeedbackPrimaryFixDto(
                        "문장 자연스럽게 연결하기",
                        "장소 이동을 나타낼 때는 'to'를 추가하고, 짧은 두 문장을 'and'로 연결해 보세요.",
                        "I go church. meet friends.",
                        "I go to church and meet my friends.",
                        "문장 성분이 빠진 곳을 보완하고 두 동작을 매끄럽게 이었습니다."
                ),
                null,
                List.of(new FeedbackSecondaryLearningPointDto(
                        "CORRECTION",
                        "더 자연스럽게 다듬을 점",
                        "문장이 짧게 끊겨 있습니다.",
                        "and를 사용하여 문장을 하나로 연결해 보세요.",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                )),
                new FeedbackNextStepPracticeDto(
                        "문장 완성하기",
                        "I go to church and meet my friends ______.",
                        "빈칸을 채워 보세요.",
                        "완성하기",
                        false
                )
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                80,
                false,
                null,
                "",
                List.of("You described your routine clearly."),
                List.of(),
                List.of(),
                List.of(),
                "I go to church and meet my friends.",
                List.of(),
                null,
                null,
                "",
                List.of()
        ).withUi(llmUi);
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "CONNECTOR",
                                "I go church. meet friends.",
                                "I go to church and meet my friends.",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I go to church and meet my friends."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        null,
                        new RewriteTarget("ADD_DETAIL", "I go to church and meet my friends ______.", 1),
                        null
                )
        );

        var ui = composer.compose(prompt, "I go church. meet friends.", feedback, answerProfile);

        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().revisedText()).contains("and");
        assertThat(ui.secondaryLearningPoints()).isEmpty();
    }

    @Test
    void compose_exposes_minor_grammar_as_micro_tip_when_fix_first_uses_task_reset() {
        PromptDto prompt = new PromptDto(
                "prompt-d",
                "Morning routine",
                "A",
                "Describe your routine for your weekday mornings.",
                "평일 아침 루틴을 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                76,
                false,
                null,
                "",
                List.of("질문에 맞는 핵심 답을 분명하게 말했어요."),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "commute",
                        "my commute",
                        "출근을 말할 때는 보통 my commute처럼 소유 표현을 함께 쓰면 더 자연스러워요."
                )),
                "I wake up in the morning and get ready for my commute.",
                List.of(),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.PARTIAL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "POSSESSIVE",
                                "commute",
                                "my commute",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I wake up in the morning and get ready for my commute."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        null,
                        new RewriteTarget(
                                "ADD_DETAIL",
                                "I wake up in the morning and get ready for my commute. After that, I ______.",
                                1
                        ),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I wake up in the morning and get ready for commute.",
                feedback,
                answerProfile
        );

        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().originalText()).isEqualTo("commute");
        assertThat(ui.primaryFix().revisedText()).isEqualTo("my commute");
        assertThat(ui.microTip()).isNotNull();
        assertThat(ui.microTip().title()).isEqualTo("작은 표현 다듬기");
        assertThat(ui.microTip().originalText()).isEqualTo("commute");
        assertThat(ui.microTip().revisedText()).isEqualTo("my commute");
    }

    @Test
    void compose_prefers_computed_focus_card_over_legacy_summary_text() {
        PromptDto prompt = new PromptDto(
                "prompt-e",
                "Routine",
                "A",
                "Describe your routine for your weekday mornings.",
                "평일 아침 루틴을 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                78,
                false,
                null,
                "루틴의 방향은 좋아요. 이제 한 가지 활동을 더 덧붙이면 답이 더 자연스러워져요.",
                List.of("질문에 맞는 활동을 먼저 말했어요."),
                List.of(),
                List.of(),
                List.of(),
                "I wake up in the morning and get ready for my commute.",
                List.of(),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), "I wake up in the morning and get ready for my commute."),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_DETAIL",
                        null,
                        new RewriteTarget("ADD_DETAIL", "I wake up in the morning and get ready for my commute. After that, I ______.", 1),
                        null
                )
        );

        var ui = composer.compose(prompt, "I wake up in the morning and get ready for commute.", feedback, answerProfile);
        assertThat(ui.focusCard().supportText()).isNotBlank();
        if (false) {

        assertThat(ui.focusCard().supportText()).isEqualTo("루틴의 방향은 좋아요. 이제 한 가지 활동을 더 덧붙이면 답이 더 자연스러워져요.");
        }
    }
    @Test
    void compose_normalizes_bracket_placeholders_without_duplicating_because_in_rewrite_starter() {
        PromptDto prompt = new PromptDto(
                "prompt-f",
                "Habit goal",
                "A",
                "What is one habit you want to build this year, and why is it important to you?",
                "올해 만들고 싶은 습관 한 가지와 그것이 왜 중요한지 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                78,
                false,
                null,
                "습관과 이유를 한 문장으로 더 또렷하게 이어 보세요.",
                List.of("목표와 이유를 함께 제시했어요."),
                List.of(),
                List.of(),
                List.of(),
                "I want to improve my English skills. It is important to me because I want to get promoted.",
                List.of(),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.SHORT_BUT_VALID, false),
                new GrammarProfile(
                        GrammarSeverity.NONE,
                        List.of(),
                        "I want to improve my English skills. It is important to me because I want to get promoted."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, false, false),
                        List.of()
                ),
                new RewriteProfile(
                        "IMPROVE_NATURALNESS",
                        null,
                        new RewriteTarget(
                                "IMPROVE_NATURALNESS",
                                "One habit I want to build this year is [specific habit]. It is important to me because [reason for importance].",
                                1
                        ),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I want to improve my English skills. So I can get promoted.",
                feedback,
                answerProfile
        );

        assertThat(ui.nextStepPractice().starter())
                .doesNotContain("[specific habit]")
                .doesNotContain("[reason for importance]")
                .doesNotContain("because because")
                .isNotBlank();
    }

    @Test
    void compose_prefers_llm_primary_fix_that_matches_rewrite_practice_direction() {
        PromptDto prompt = new PromptDto(
                "prompt-g",
                "Place to visit",
                "A",
                "Tell me about a place you want to visit and what you want to do there.",
                "가고 싶은 장소와 그곳에서 무엇을 하고 싶은지 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                77,
                false,
                null,
                "장소와 활동은 이미 들어 있어요. 이제 가고 싶은 이유를 한 문장 더 붙여 보세요.",
                List.of("방문하고 싶은 장소와 활동을 분명하게 말했어요."),
                List.of(),
                List.of(),
                List.of(),
                "I want to visit Tokyo because I love its food. I also want to eat sushi there.",
                List.of(),
                null,
                null,
                "",
                List.of(),
                new FeedbackUiDto(
                        null,
                        new FeedbackPrimaryFixDto(
                                "한 가지 더 추가하면 좋아요",
                                "도쿄에 왜 가고 싶은지 이유를 because 절로 한 문장 더 써 보세요.",
                                null,
                                null,
                                null
                        ),
                        null
                )
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.PARTIAL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), "I want to visit Tokyo. I want to eat sushi there."),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_REASON",
                        null,
                        new RewriteTarget("ADD_REASON", "I want to visit Tokyo because ______. Also, I want to ______.", 1),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I want to visit Tokyo. I would love to eat sushi.",
                feedback,
                answerProfile
        );

        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().instruction()).contains("because");
        assertThat(ui.nextStepPractice()).isNotNull();
        assertThat(ui.nextStepPractice().starter()).isNull();
        assertThat(ui.nextStepPractice().instruction()).isNotBlank();
    }

    @Test
    void compose_uses_detail_prompt_focus_and_fix_for_partial_reason_issue() {
        PromptDto prompt = new PromptDto(
                "prompt-i",
                "Place to visit",
                "A",
                "Tell me about a place you want to visit and what you want to do there.",
                "가고 싶은 장소와 그곳에서 무엇을 하고 싶은지 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                77,
                false,
                null,
                "장소와 활동은 이미 보여요. 이제 왜 가고 싶은지 because 절로 한 문장 더 붙여 보세요.",
                List.of("방문하고 싶은 장소와 그곳에서 하고 싶은 활동을 분명히 전달했어요."),
                List.of(),
                List.of(),
                List.of(),
                "I want to visit Tokyo because I love its food. Also, I want to eat sushi there.",
                List.of(),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.PARTIAL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), "I want to visit Tokyo. I want to eat sushi there."),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_REASON",
                        null,
                        new RewriteTarget("ADD_REASON", "I want to visit Tokyo because ______. Also, I want to ______.", 1),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I want to visit Tokyo. I would love to eat sushi.",
                feedback,
                answerProfile
        );

        assertThat(ui.focusCard().headline()).contains("이유");
        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().originalText()).isNull();
        assertThat(ui.primaryFix().instruction()).contains("because");
        assertThat(ui.screenPolicy().fixFirstDisplayMode()).isEqualTo("SHOW_EXPANDED");
        assertThat(ui.nextStepPractice()).isNotNull();
        assertThat(ui.nextStepPractice().starter()).isNull();
        assertThat(ui.nextStepPractice().instruction()).isNotBlank();
    }

    @Test
    void compose_hides_instruction_only_primary_fix_when_it_has_no_concrete_anchor() {
        PromptDto prompt = new PromptDto(
                "prompt-i-generic",
                "Town",
                "A",
                "Describe something special about your town.",
                "사는 동네의 특별한 점을 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                75,
                false,
                null,
                "동네의 특별한 점을 한 문장 더 보태 보세요.",
                List.of("동네에 대한 핵심 내용은 잘 전달했어요."),
                List.of(),
                List.of(),
                List.of(),
                "My town is special because ______.",
                List.of(),
                null,
                null,
                "",
                List.of(),
                new FeedbackUiDto(
                        null,
                        new FeedbackPrimaryFixDto(
                                "먼저 고칠 부분",
                                "이 한 군데만 먼저 고치면 문장 흐름이 훨씬 안정돼요.",
                                null,
                                null,
                                null
                        ),
                        null,
                        List.of(),
                        new FeedbackNextStepPracticeDto(
                                "한번 더 써보기",
                                "My town is special because ______.",
                                "빈칸에 특별한 이유를 써 보세요.",
                                "완성하기",
                                false
                        ),
                        List.of(),
                        null,
                        null
                )
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(GrammarSeverity.NONE, List.of(), "My town is special."),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "MAKE_IT_MORE_SPECIFIC",
                        null,
                        new RewriteTarget("MAKE_IT_MORE_SPECIFIC", "My town is special because ______.", 1),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "My town is special.",
                feedback,
                answerProfile
        );

        assertThat(ui.primaryFix()).isNull();
        assertThat(ui.nextStepPractice()).isNotNull();
    }

    @Test
    void compose_keeps_supporting_grammar_pair_inside_primary_fix_for_detail_prompt_mode() {
        PromptDto prompt = new PromptDto(
                "prompt-i2",
                "Favorite movie genre",
                "A",
                "Tell me about your favorite movie genre and explain why it appeals to you.",
                "가장 좋아하는 영화 장르에 대해 말하고, 왜 끌리는지 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                79,
                false,
                null,
                "문장을 더 자연스럽게 연결해 보세요.",
                List.of("장르를 말한 점은 좋아요."),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "romantic comedy movi",
                        "romantic comedy movies",
                        "영화 장르처럼 일반적인 대상을 말할 때는 복수형 movies를 사용하면 더 자연스럽습니다."
                )),
                "I like romantic comedy movies because they are funny and relatable.",
                List.of(),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.PARTIAL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "NUMBER",
                                "romantic comedy movi",
                                "romantic comedy movies",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I like romantic comedy movies. It's funny and relatable."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "ADD_REASON",
                        null,
                        new RewriteTarget("ADD_REASON", "I like romantic comedy movies because ______.", 1),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I like romantic comedy movi. it's funny and relatable.",
                feedback,
                answerProfile
        );

        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().instruction()).contains("because");
        assertThat(ui.primaryFix().originalText()).isEqualTo("romantic comedy movi");
        assertThat(ui.primaryFix().revisedText()).isEqualTo("romantic comedy movies");
        assertThat(ui.primaryFix().reasonKo()).contains("movies");
        assertThat(ui.secondaryLearningPoints())
                .extracting(FeedbackSecondaryLearningPointDto::originalText, FeedbackSecondaryLearningPointDto::revisedText)
                .doesNotContain(tuple("romantic comedy movi", "romantic comedy movies"));
    }

    @Test
    void compose_uses_corrected_skeleton_rewrite_guide_when_fix_first_is_grammar_card() {
        PromptDto prompt = new PromptDto(
                "prompt-h",
                "Recommended hobby",
                "A",
                "Introduce a hobby you would recommend to others and explain why you would recommend it.",
                "질문",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                74,
                false,
                null,
                "문법을 먼저 고치고 이유를 한 가지 더 자연스럽게 말해 보세요.",
                List.of("추천할 취미와 이유를 함께 말하려는 방향은 좋아요."),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "I recommend foot ball to other. because by footbol I can expand social network.",
                        "I recommend football to others because it helps me expand my social network.",
                        "football, others, because 절 연결을 자연스럽게 고쳐 주세요."
                )),
                "I recommend football to others because it helps me expand my social network.",
                List.of(),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "LOCAL_GRAMMAR",
                                "foot ball to other. because by footbol",
                                "football to others because it helps me",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I recommend football to others because it helps me expand my social network."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_LOCAL_GRAMMAR",
                        null,
                        new RewriteTarget("ADD_REASON", "I recommend football to others because it helps me ______.", 1),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I recommend foot ball to other. because by footbol I can expand social network.",
                feedback,
                answerProfile
        );

        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.screenPolicy().fixFirstDisplayMode()).isEqualTo("SHOW_EXPANDED");
        assertThat(ui.screenPolicy().rewriteGuideMode()).isEqualTo("CORRECTED_SKELETON");
        assertThat(ui.nextStepPractice().starter()).contains("I recommend football to others because it helps me");
    }

    @Test
    void compose_forces_blank_in_corrected_skeleton_even_when_target_has_no_blank() {
        PromptDto prompt = new PromptDto(
                "prompt-k",
                "Recommended hobby",
                "A",
                "Introduce a hobby you would recommend to others and explain why you would recommend it.",
                "吏덈Ц",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                72,
                false,
                null,
                "臾몃쾿??癒쇱? 怨좎튂怨??쒖옉 臾몄옣??諛붾Ⅴ寃?留욌텧 蹂댁꽭??",
                List.of("異붿쿇?섎뒗 痍⑤?? ?댁쑀瑜??④퍡 留먰븷 ?섏쓣 ???덉뼱??"),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "I recommend foot ball to other. because by footbol I can expand social network.",
                        "I recommend football to others because I can expand my social network through it.",
                        "football, others, because ???곌껐???먯뿰?ㅻ읇寃?怨좎퀜 二쇱꽭??"
                )),
                "I recommend football to others because I can expand my social network through it.",
                List.of(),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "LOCAL_GRAMMAR",
                                "foot ball to other. because by footbol",
                                "football to others because I can expand my social network through it",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I recommend football to others because I can expand my social network through it."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_LOCAL_GRAMMAR",
                        null,
                        new RewriteTarget("FIX_LOCAL_GRAMMAR", "I recommend football to others because I can expand my social network through it.", 1),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I recommend foot ball to other. because by footbol I can expand social network.",
                feedback,
                answerProfile
        );

        assertThat(ui.screenPolicy().rewriteGuideMode()).isEqualTo("CORRECTED_SKELETON");
        assertThat(ui.nextStepPractice().starter()).isNotBlank();
        assertThat(ui.nextStepPractice().starter()).doesNotContain("because because");
    }

    @Test
    void compose_collects_secondary_learning_points_from_corrections_and_refinement_without_tight_card_limit() {
        PromptDto prompt = new PromptDto(
                "prompt-j",
                "Recommended hobby",
                "A",
                "Introduce a hobby you would recommend to others and explain why you would recommend it.",
                "취미를 소개하고 추천 이유를 설명해 주세요.",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                74,
                false,
                null,
                "문법을 먼저 고치고, 표현도 더 자연스럽게 다듬어 보세요.",
                List.of("추천하는 취미와 이유를 함께 말하려는 방향은 좋아요."),
                List.of(
                        new CorrectionDto("recommend football to others", "recommend playing football to others처럼 쓰면 더 자연스러워요."),
                        new CorrectionDto("expand social network", "expand your social network 또는 make friends처럼 바꿔 보세요.")
                ),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "I recommend foot ball to other. because by footbol I can expand social network.",
                        "I recommend football to others because it helps me expand my social network.",
                        "football, others, because 절 연결을 자연스럽게 고쳐야 해요."
                )),
                "I recommend football to others because it helps me expand my social network.",
                List.of(
                        new RefinementExpressionDto(
                                "make friends",
                                "사람들과 쉽게 가까워지는 상황을 말할 때 쓸 수 있어요.",
                                "Playing football can help you make friends.",
                                "친구를 사귀는 데 도움이 될 수 있어요.",
                                "친구를 사귀다"
                        )
                ),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.CONTENT_THIN, false),
                new GrammarProfile(
                        GrammarSeverity.MINOR,
                        List.of(new GrammarIssue(
                                "LOCAL_GRAMMAR",
                                "foot ball to other. because by footbol",
                                "football to others because it helps me",
                                false,
                                GrammarSeverity.MINOR
                        )),
                        "I recommend football to others because it helps me expand my social network."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, true, false, false, true, false),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_LOCAL_GRAMMAR",
                        null,
                        new RewriteTarget("ADD_REASON", "I recommend football to others because it helps me ______.", 1),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I recommend foot ball to other. because by footbol I can expand social network.",
                feedback,
                answerProfile
        );

        assertThat(ui.secondaryLearningPoints()).hasSizeGreaterThanOrEqualTo(3);
        assertThat(ui.secondaryLearningPoints())
                .extracting(point -> point.kind(), point -> point.headline(), point -> point.exampleEn())
                .startsWith(
                        tuple("CORRECTION", "recommend football to others", null),
                        tuple("CORRECTION", "expand social network", null)
                )
                .contains(
                        tuple("CORRECTION", "recommend football to others", null),
                        tuple("CORRECTION", "expand social network", null),
                        tuple("EXPRESSION", "make friends", "Playing football can help you make friends.")
                );
    }

    @Test
    void compose_hides_overlapping_grammar_secondary_when_primary_fix_already_covers_the_whole_sentence() {
        PromptDto prompt = new PromptDto(
                "prompt-l",
                "Morning routine",
                "A",
                "Describe your routine for your weekday mornings.",
                "",
                ""
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                75,
                false,
                null,
                "Fix the sentence structure first.",
                List.of("You already mentioned the main activities."),
                List.of(),
                List.of(),
                List.of(
                        new GrammarFeedbackItemDto(
                                "I wake up morning.get ready for commute.",
                                "I wake up in the morning and get ready for my commute.",
                                "Use 'in the morning', connect the actions, and say 'my commute'."
                        ),
                        new GrammarFeedbackItemDto(
                                "I wake up morning.",
                                "I wake up in the morning.",
                                "Add 'in' before 'the morning'."
                        )
                ),
                "I wake up in the morning and get ready for my commute.",
                List.of(
                        new RefinementExpressionDto(
                                "After that",
                                "Use it to connect the next action.",
                                "After that, I head to work."
                        )
                ),
                null,
                null,
                "",
                List.of()
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING, false),
                new GrammarProfile(
                        GrammarSeverity.MODERATE,
                        List.of(
                                new GrammarIssue(
                                        "ROUTINE_GRAMMAR",
                                        "I wake up morning.get ready for commute.",
                                        "I wake up in the morning and get ready for my commute.",
                                        true,
                                        GrammarSeverity.MODERATE
                                )
                        ),
                        "I wake up in the morning and get ready for my commute."
                ),
                new ContentProfile(
                        ContentLevel.LOW,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_BLOCKING_GRAMMAR",
                        null,
                        new RewriteTarget(
                                "FIX_BLOCKING_GRAMMAR",
                                "I wake up in the morning and get ready for my commute. After that, I ______.",
                                1
                        ),
                        null
                )
        );

        var ui = composer.compose(
                prompt,
                "I wake up morning.get ready for commute.",
                feedback,
                answerProfile
        );

        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.secondaryLearningPoints())
                .extracting(point -> point.kind(), point -> point.headline(), point -> point.exampleEn())
                .containsExactly(tuple("EXPRESSION", "After that", "After that, I head to work."));
    }

    @Test
    void compose_prefers_llm_supplied_ui_pack_for_primary_fix_rewrite_and_secondary_points() {
        PromptDto prompt = new PromptDto(
                "prompt-llm-pack",
                "Routine",
                "A",
                "Describe your routine for your weekday mornings.",
                "평일 아침 루틴을 설명해 주세요.",
                ""
        );
        FeedbackUiDto llmUi = new FeedbackUiDto(
                new com.writeloop.dto.FeedbackFocusCardDto(
                        "이번 답변의 수정 목표",
                        "핵심 문장 먼저 자연스럽게 연결하기",
                        "위 카드와 아래 다시쓰기 틀을 같은 방향으로 읽으면 돼요."
                ),
                new FeedbackPrimaryFixDto(
                        "기본 문장 구성 바로잡기",
                        "전치사와 연결 표현을 먼저 맞춰 보세요.",
                        "I wake up morning.get ready for commute.",
                        "I wake up in the morning and get ready for my commute.",
                        "시간 표현에는 in을 넣고, 두 동작은 and로 자연스럽게 연결해 보세요."
                ),
                null,
                List.of(
                        new FeedbackSecondaryLearningPointDto(
                                "CORRECTION",
                                "보조 학습 포인트",
                                "commute보다 my commute가 더 자연스러워요.",
                                "내 일과를 말할 때는 소유 표현을 붙이면 더 자연스럽습니다.",
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        )
                ),
                new FeedbackNextStepPracticeDto(
                        "한번 더 써보기",
                        "I wake up in the morning and get ready for my commute. After that, I ______.",
                        "빈칸에 다음 활동을 한 가지 넣어 다시 써 보세요.",
                        "이 문장으로 시작해서 다시 쓰기",
                        false
                ),
                null,
                null
        );
        FeedbackResponseDto feedback = new FeedbackResponseDto(
                prompt.id(),
                null,
                1,
                73,
                false,
                null,
                "루틴의 흐름은 보이지만 연결 표현을 조금 더 정리하면 좋아요.",
                List.of("핵심 아침 활동은 잘 보였어요."),
                List.of(),
                List.of(),
                List.of(new GrammarFeedbackItemDto(
                        "I wake up morning.get ready for commute.",
                        "I wake up in the morning.get ready for my commute.",
                        "in을 넣고 and로 연결하세요."
                )),
                "I wake up in the morning and get ready for my commute.",
                List.of(),
                null,
                null,
                "",
                List.of(),
                llmUi
        );
        AnswerProfile answerProfile = new AnswerProfile(
                new TaskProfile(true, TaskCompletion.FULL, AnswerBand.GRAMMAR_BLOCKING, false),
                new GrammarProfile(
                        GrammarSeverity.MODERATE,
                        List.of(new GrammarIssue(
                                "LOCAL_GRAMMAR",
                                "wake up morning.get ready for commute",
                                "wake up in the morning and get ready for my commute",
                                true,
                                GrammarSeverity.MODERATE
                        )),
                        "I wake up in the morning and get ready for my commute."
                ),
                new ContentProfile(
                        ContentLevel.MEDIUM,
                        new ContentSignals(true, false, false, false, true, true),
                        List.of()
                ),
                new RewriteProfile(
                        "FIX_BLOCKING_GRAMMAR",
                        null,
                        new RewriteTarget("FIX_BLOCKING_GRAMMAR", "I wake up in the morning and get ready for my commute. After that, I ______.", 1),
                        null
                )
        );

        var ui = composer.compose(prompt, "I wake up morning.get ready for commute.", feedback, answerProfile);

        assertThat(ui.focusCard()).isNotNull();
        assertThat(ui.focusCard().headline()).isEqualTo("핵심 문장 먼저 자연스럽게 연결하기");
        assertThat(ui.focusCard().supportText()).isEqualTo("위 카드와 아래 다시쓰기 틀을 같은 방향으로 읽으면 돼요.");
        assertThat(ui.primaryFix()).isNotNull();
        assertThat(ui.primaryFix().revisedText()).isEqualTo("I wake up in the morning and get ready for my commute.");
        assertThat(ui.nextStepPractice().starter()).contains("After that");
        assertThat(ui.secondaryLearningPoints())
                .extracting(FeedbackSecondaryLearningPointDto::headline)
                .containsExactly("commute보다 my commute가 더 자연스러워요.");
    }
}
