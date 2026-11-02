package com.writeloop.service;

import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 작업 051 명세의 그대로 둘 동작: 백엔드 검증과 근거 복원, LanguageRevisionEdit의 최소 구간 값.
 * 교정 줄에 앞뒤 단어를 붙이는 일은 화면에 보낼 값에서만 하고, 검증용 구간은 바꾸지 않는다.
 */
class FeedbackLearningContractPolicySpecTest {

    private final FeedbackLearningContractPolicy policy = new FeedbackLearningContractPolicy();

    @Test
    void kept_insertionEditKeepsTheMinimalSpanValues() {
        LearningContractResolution resolution = policy.resolveContract(
                prompt(),
                "I want build an app.",
                diagnosis(StructureStatus.COMPLETE, "I want to build an app."),
                assessment("build an app")
        );

        assertThat(resolution.languageCorrections()).singleElement()
                .satisfies(correction -> {
                    LanguageRevisionEdit edit = correction.edit();
                    assertThat(edit.displayOriginalText()).isEqualTo("");
                    assertThat(edit.displayRevisedText()).isEqualTo("to");
                    assertThat(edit.originalText()).isEqualTo("");
                    assertThat(edit.revisedText()).isEqualTo("to ");
                    assertThat(edit.sourceStart()).isEqualTo(7);
                    assertThat(edit.sourceEnd()).isEqualTo(7);
                    assertThat(edit.revisedStart()).isEqualTo(7);
                    assertThat(edit.revisedEnd()).isEqualTo(10);
                });
        assertThat(resolution.revisedAnswer()).isEqualTo("I want to build an app.");
    }

    @Test
    void kept_deletionEditKeepsTheMinimalSpanValues() {
        LearningContractResolution resolution = policy.resolveContract(
                prompt(),
                "I am agree with you.",
                diagnosis(StructureStatus.COMPLETE, "I agree with you."),
                assessment("agree with you")
        );

        assertThat(resolution.languageCorrections()).singleElement()
                .satisfies(correction -> {
                    LanguageRevisionEdit edit = correction.edit();
                    assertThat(edit.displayOriginalText()).isEqualTo("am");
                    assertThat(edit.displayRevisedText()).isEqualTo("");
                    assertThat(edit.originalText()).isEqualTo("am ");
                    assertThat(edit.revisedText()).isEqualTo("");
                    assertThat(edit.sourceStart()).isEqualTo(2);
                    assertThat(edit.sourceEnd()).isEqualTo(5);
                    assertThat(edit.revisedStart()).isEqualTo(2);
                    assertThat(edit.revisedEnd()).isEqualTo(2);
                });
        assertThat(resolution.revisedAnswer()).isEqualTo("I agree with you.");
    }

    // 지금 근거 복원은 한쪽이 빈 교정을 건너뛴다. 근거가 고친 문장에서만 나오면 지금처럼 계약 위반이어야 한다.
    @Test
    void kept_evidenceRestorationStillSkipsPureInsertions() {
        assertThatThrownBy(() -> policy.resolveContract(
                prompt(),
                "I want build an app.",
                diagnosis(StructureStatus.COMPLETE, "I want to build an app."),
                assessment("want to build")
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("SATISFIED or GENERIC requires evidence from the learner answer: ACTION");
    }

    @Test
    void kept_evidenceRestorationStillSkipsPureDeletions() {
        assertThatThrownBy(() -> policy.resolveContract(
                prompt(),
                "I am agree with you.",
                diagnosis(StructureStatus.COMPLETE, "I agree with you."),
                assessment("I agree with you")
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("SATISFIED or GENERIC requires evidence from the learner answer: ACTION");
    }

    private FeedbackDiagnosisResult diagnosis(StructureStatus structure, String answerAfter) {
        return new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "판정 근거"),
                new StructureAssessment(structure),
                new LanguageAssessment(List.of(new LanguageRevisionStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        answerAfter,
                        "이 변경이 필요한 이유예요."
                )))
        );
    }

    private SlotAssessments assessment(String actionEvidence) {
        Map<String, SlotAssessmentValue> values = new LinkedHashMap<>();
        values.put("ACTION", new SlotAssessmentValue(actionEvidence, SlotAssessmentStatus.SATISFIED));
        return new SlotAssessments(values, null);
    }

    private PromptDto prompt() {
        Map<String, PromptSlotContractDto> slotContracts = new LinkedHashMap<>();
        slotContracts.put("ACTION", new PromptSlotContractDto(
                "The question-specific role of ACTION.",
                "The learner answer clearly fulfills ACTION for this question.",
                "Korean role reference for ACTION.",
                "Korean satisfaction reference for ACTION."
        ));
        return new PromptDto(
                "prompt-spec-051",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do?",
                "보통 무엇을 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of(),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        0,
                        slotContracts
                )
        );
    }
}
