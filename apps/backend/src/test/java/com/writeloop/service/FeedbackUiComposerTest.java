package com.writeloop.service;

import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.PromptDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

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
                "좋아요. 지금 단계에서 마무리해도 충분해요.",
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
        assertThat(ui.rewritePractice().optionalTone()).isTrue();
        assertThat(ui.screenPolicy().completionState()).isEqualTo("OPTIONAL_POLISH");
        assertThat(ui.screenPolicy().modelAnswerDisplayMode()).isEqualTo("HIDE");
        assertThat(ui.loopStatus().rewriteCtaLabel()).isEqualTo("한 번 더 다듬기");
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
        assertThat(ui.primaryFix().originalText()).isNull();
        assertThat(ui.microTip()).isNotNull();
        assertThat(ui.microTip().title()).isEqualTo("작은 표현 다듬기");
        assertThat(ui.microTip().originalText()).isEqualTo("commute");
        assertThat(ui.microTip().revisedText()).isEqualTo("my commute");
    }

    @Test
    void compose_uses_summary_as_top_status_support_text_when_available() {
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

        assertThat(ui.focusCard().supportText()).isEqualTo("루틴의 방향은 좋아요. 이제 한 가지 활동을 더 덧붙이면 답이 더 자연스러워져요.");
    }
}
