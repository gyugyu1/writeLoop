package com.writeloop.service;

import com.writeloop.dto.CorrectionDto;
import com.writeloop.dto.FeedbackLanguageCorrectionDto;
import com.writeloop.dto.GrammarFeedbackItemDto;
import com.writeloop.dto.InlineFeedbackSegmentDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 작업 051 명세(교정 줄의 순수 삽입·삭제에 앞뒤 단어 하나씩 붙이기)의 기대 결과.
 * 바뀔 동작: 이름이 changed_ 로 시작한다. 그대로 둘 동작: kept_ 로 시작한다.
 */
class CanonicalFeedbackAssemblerSpecTest {

    private static final String REASON = "이 변경이 필요한 이유예요.";

    private final CanonicalFeedbackAssembler assembler = new CanonicalFeedbackAssembler();

    // ---- 바뀔 동작 ----

    @Test
    void changed_insertedWordGetsTheWordBeforeAndAfterOnBothSides() {
        AssembledFeedback assembled = assembleSingleStep(
                "I want build an app.",
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                "I want to build an app.",
                "build an app"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "GRAMMAR_LOCAL", "세부 교정", "want build", "want to build", REASON
                ));
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(new GrammarFeedbackItemDto("want build", "want to build", REASON));
    }

    @Test
    void changed_deletedWordGetsTheWordBeforeAndAfterOnBothSides() {
        AssembledFeedback assembled = assembleSingleStep(
                "I am agree with you.",
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                "I agree with you.",
                "agree with you"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "GRAMMAR_LOCAL", "세부 교정", "I am agree", "I agree", REASON
                ));
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(new GrammarFeedbackItemDto("I am agree", "I agree", REASON));
    }

    @Test
    void changed_insertionAtSentenceStartGetsOnlyTheWordAfter() {
        AssembledFeedback assembled = assembleSingleStep(
                "went to school yesterday.",
                LanguageIssueKind.STRUCTURE,
                StructureStatus.FRAGMENT,
                "I went to school yesterday.",
                "went to school"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "STRUCTURE", "문장 구조", "went", "I went", REASON
                ));
        // STRUCTURE 교정은 지금처럼 grammarFeedback에 넣지 않는다.
        assertThat(assembled.response().grammarFeedback()).isEmpty();
    }

    @Test
    void changed_deletionAtSentenceStartGetsOnlyTheWordAfter() {
        AssembledFeedback assembled = assembleSingleStep(
                "So I went home.",
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                "I went home.",
                "went home"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "GRAMMAR_LOCAL", "세부 교정", "So I", "I", REASON
                ));
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(new GrammarFeedbackItemDto("So I", "I", REASON));
    }

    @Test
    void changed_neighborWordsAreWhitespaceSeparatedWordsIncludingAttachedPunctuation() {
        AssembledFeedback assembled = assembleSingleStep(
                "I went school.",
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                "I went to the school.",
                "went school"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "GRAMMAR_LOCAL", "세부 교정", "went school.", "went to the school.", REASON
                ));
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(new GrammarFeedbackItemDto("went school.", "went to the school.", REASON));
    }

    @Test
    void changed_neighborWordsComeFromThatStepsBeforeAndAfterSentences() {
        String answer = "She want build an app.";
        String afterBlocking = "She wants build an app.";
        String revised = "She wants to build an app.";
        CanonicalLlmOutput output = output(
                diagnosis(StructureStatus.COMPLETE, List.of(
                        new LanguageRevisionStep(LanguageIssueKind.GRAMMAR_BLOCKING, afterBlocking, "주어에 맞춰 동사를 바꿔요."),
                        new LanguageRevisionStep(LanguageIssueKind.GRAMMAR_LOCAL, revised, "want 뒤에는 to를 써요.")
                )),
                "build an app"
        );

        AssembledFeedback assembled = assembler.assemble("internal", prompt(), answer, 1, output);

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(
                        new FeedbackLanguageCorrectionDto(
                                "GRAMMAR_BLOCKING", "핵심 교정", "want", "wants", "주어에 맞춰 동사를 바꿔요."
                        ),
                        new FeedbackLanguageCorrectionDto(
                                "GRAMMAR_LOCAL", "세부 교정", "wants build", "wants to build", "want 뒤에는 to를 써요."
                        )
                );
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(
                        new GrammarFeedbackItemDto("want", "wants", "주어에 맞춰 동사를 바꿔요."),
                        new GrammarFeedbackItemDto("wants build", "wants to build", "want 뒤에는 to를 써요.")
                );
    }

    // ---- 그대로 둘 동작 ----

    @Test
    void kept_replacementKeepsTheChangedSpanOnly() {
        AssembledFeedback assembled = assembleSingleStep(
                "I goes home.",
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                "I go home.",
                "goes home"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "GRAMMAR_LOCAL", "세부 교정", "goes", "go", REASON
                ));
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(new GrammarFeedbackItemDto("goes", "go", REASON));
    }

    @Test
    void kept_stepWithTwoInsertionsAlreadyHasBothSidesAndStaysTheSame() {
        AssembledFeedback assembled = assembleSingleStep(
                "I want build app.",
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                "I want to build an app.",
                "build app"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "GRAMMAR_LOCAL", "세부 교정", "build", "to build an", REASON
                ));
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(new GrammarFeedbackItemDto("build", "to build an", REASON));
    }

    // 명세의 예("rainy Day." 끝의 마침표 삭제는 Day. → Day). 지금 코드도 이 값을 낸다.
    @Test
    void kept_specExampleTrailingPeriodRemovalShowsDayDotToDay() {
        AssembledFeedback assembled = assembleSingleStep(
                "It was a rainy Day.",
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                "It was a rainy Day",
                "rainy Day"
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .containsExactly(new FeedbackLanguageCorrectionDto(
                        "GRAMMAR_LOCAL", "세부 교정", "Day.", "Day", REASON
                ));
        assertThat(assembled.response().grammarFeedback())
                .containsExactly(new GrammarFeedbackItemDto("Day.", "Day", REASON));
    }

    @Test
    void kept_insertionLeavesOtherResponseFieldsUnchanged() {
        String answer = "I want build an app.";
        String revised = "I want to build an app.";
        AssembledFeedback assembled = assembleSingleStep(
                answer,
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                revised,
                "build an app"
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.LANGUAGE_FIX);
        assertThat(assembled.response().revisedAnswer()).isEqualTo(revised);
        assertThat(assembled.response().inlineFeedback()).containsExactly(
                new InlineFeedbackSegmentDto("KEEP", "I want ", "I want "),
                new InlineFeedbackSegmentDto("ADD", "", "to "),
                new InlineFeedbackSegmentDto("KEEP", "build an app.", "build an app.")
        );
        assertThat(assembled.response().corrections())
                .containsExactly(new CorrectionDto(REASON, "to"));
        assertThat(assembled.response().coachMove().focusType()).isEqualTo("LANGUAGE_FIX");
        assertThat(assembled.response().coachMove().focus()).isEqualTo("문장 한 곳 바로잡기");
        assertThat(assembled.response().coachMove().before()).isEqualTo(answer);
        assertThat(assembled.response().coachMove().after()).isEqualTo(revised);
        assertThat(assembled.response().coachMove().languageCorrections())
                .singleElement()
                .satisfies(correction -> {
                    assertThat(correction.kind()).isEqualTo("GRAMMAR_LOCAL");
                    assertThat(correction.label()).isEqualTo("세부 교정");
                    assertThat(correction.reason()).isEqualTo(REASON);
                });
    }

    @Test
    void kept_deletionLeavesOtherResponseFieldsUnchanged() {
        String answer = "I am agree with you.";
        String revised = "I agree with you.";
        AssembledFeedback assembled = assembleSingleStep(
                answer,
                LanguageIssueKind.GRAMMAR_LOCAL,
                StructureStatus.COMPLETE,
                revised,
                "agree with you"
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.LANGUAGE_FIX);
        assertThat(assembled.response().revisedAnswer()).isEqualTo(revised);
        assertThat(assembled.response().inlineFeedback()).containsExactly(
                new InlineFeedbackSegmentDto("KEEP", "I ", "I "),
                new InlineFeedbackSegmentDto("REMOVE", "am ", ""),
                new InlineFeedbackSegmentDto("KEEP", "agree with you.", "agree with you.")
        );
        assertThat(assembled.response().corrections())
                .containsExactly(new CorrectionDto(REASON, ""));
        assertThat(assembled.response().coachMove().focus()).isEqualTo("문장 한 곳 바로잡기");
        assertThat(assembled.response().coachMove().before()).isEqualTo(answer);
        assertThat(assembled.response().coachMove().after()).isEqualTo(revised);
    }

    @Test
    void kept_multiStepOrderCountKindLabelReasonAndOtherFieldsUnchanged() {
        String answer = "She want build an app.";
        String afterBlocking = "She wants build an app.";
        String revised = "She wants to build an app.";
        CanonicalLlmOutput output = output(
                diagnosis(StructureStatus.COMPLETE, List.of(
                        new LanguageRevisionStep(LanguageIssueKind.GRAMMAR_BLOCKING, afterBlocking, "주어에 맞춰 동사를 바꿔요."),
                        new LanguageRevisionStep(LanguageIssueKind.GRAMMAR_LOCAL, revised, "want 뒤에는 to를 써요.")
                )),
                "build an app"
        );

        AssembledFeedback assembled = assembler.assemble("internal", prompt(), answer, 1, output);

        assertThat(assembled.response().coachMove().languageCorrections())
                .extracting(FeedbackLanguageCorrectionDto::kind)
                .containsExactly("GRAMMAR_BLOCKING", "GRAMMAR_LOCAL");
        assertThat(assembled.response().coachMove().languageCorrections())
                .extracting(FeedbackLanguageCorrectionDto::label)
                .containsExactly("핵심 교정", "세부 교정");
        assertThat(assembled.response().coachMove().languageCorrections())
                .extracting(FeedbackLanguageCorrectionDto::reason)
                .containsExactly("주어에 맞춰 동사를 바꿔요.", "want 뒤에는 to를 써요.");
        assertThat(assembled.response().coachMove().focus()).isEqualTo("문장 2곳 바로잡기");
        assertThat(assembled.response().revisedAnswer()).isEqualTo(revised);
        assertThat(assembled.response().corrections()).containsExactly(
                new CorrectionDto("주어에 맞춰 동사를 바꿔요.", "wants"),
                new CorrectionDto("want 뒤에는 to를 써요.", "to")
        );
        assertThat(assembled.response().inlineFeedback()).containsExactly(
                new InlineFeedbackSegmentDto("KEEP", "She ", "She "),
                new InlineFeedbackSegmentDto("REPLACE", "want ", "wants to "),
                new InlineFeedbackSegmentDto("KEEP", "build an app.", "build an app.")
        );
    }

    // ---- helpers ----

    private AssembledFeedback assembleSingleStep(
            String answer,
            LanguageIssueKind kind,
            StructureStatus structure,
            String answerAfter,
            String actionEvidence
    ) {
        CanonicalLlmOutput output = output(
                diagnosis(structure, List.of(new LanguageRevisionStep(kind, answerAfter, REASON))),
                actionEvidence
        );
        return assembler.assemble("internal", prompt(), answer, 1, output);
    }

    private CanonicalLlmOutput output(FeedbackDiagnosisResult diagnosis, String actionEvidence) {
        Map<String, SlotAssessmentValue> values = new LinkedHashMap<>();
        values.put("ACTION", new SlotAssessmentValue(actionEvidence, SlotAssessmentStatus.SATISFIED));
        return new CanonicalLlmOutput(
                diagnosis,
                new GeneratedContent(List.of(), List.of(), "Model answer.", "모범 답안"),
                new SlotAssessments(values, null, null)
        );
    }

    private FeedbackDiagnosisResult diagnosis(StructureStatus structure, List<LanguageRevisionStep> steps) {
        return new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "Relevant answer"),
                new StructureAssessment(structure),
                new LanguageAssessment(steps)
        );
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-spec-051",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you do after work?",
                "퇴근 후 무엇을 하나요?",
                "",
                null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of(), null, null, 0)
        );
    }
}
