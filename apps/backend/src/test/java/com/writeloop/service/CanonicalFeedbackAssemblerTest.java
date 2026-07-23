package com.writeloop.service;

import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptTaskMetaDto;
import com.writeloop.dto.RefinementExpressionDto;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CanonicalFeedbackAssemblerTest {

    private final CanonicalFeedbackAssembler assembler = new CanonicalFeedbackAssembler();

    @Test
    void backendChoosesMissingSlotAndKeepsRawModelAnswerVisible() {
        SlotFeedbackSupport reasonSupport = new SlotFeedbackSupport(
                "Add a reason",
                "A concrete reason makes the answer useful.",
                "Add one reason from your real experience.",
                "I take a walk because it helps me relax.",
                "I take a walk because ____.",
                "I take a walk because ____.",
                List.of(
                        new FeedbackSuggestedPhraseDto("it helps me relax", "relax"),
                        new FeedbackSuggestedPhraseDto("I need fresh air", "fresh air")
                ),
                "Give one concrete reason."
        );
        CanonicalLlmOutput output = new CanonicalLlmOutput(
                new FeedbackDiagnosisResult(
                        new TopicAssessment(TopicRelevance.ON_TOPIC, "Relevant answer"),
                        new StructureAssessment(StructureStatus.COMPLETE, List.of()),
                        List.of()
                ),
                new GeneratedContent(
                        List.of("The main action is clear."),
                        List.of(),
                        List.of(),
                        "I usually take a walk after work because it helps me relax.",
                        "Reference translation"
                ),
                new SlotAssessments(Map.of(
                        "ACTION", new SlotAssessmentValue("take a walk", List.of()),
                        "REASON", new SlotAssessmentValue(null, List.of(reasonSupport))
                ))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                prompt(),
                "I take a walk.",
                1,
                output
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(assembled.sections().missionDecision().chosenSlot()).isEqualTo("REASON");
        assertThat(assembled.response().loopComplete()).isFalse();
        assertThat(assembled.response().coachMove().targetSlot()).isEqualTo("REASON");
        assertThat(assembled.response().modelAnswer())
                .isEqualTo("I usually take a walk after work because it helps me relax.");
    }

    @Test
    void backendDerivesGrammarImpactFromIssuesForCorrection() {
        CanonicalLlmOutput output = new CanonicalLlmOutput(
                new FeedbackDiagnosisResult(
                        new TopicAssessment(TopicRelevance.ON_TOPIC, "Relevant answer"),
                        new StructureAssessment(StructureStatus.COMPLETE, List.of()),
                        List.of(new DiagnosedGrammarIssue(
                                GrammarImpact.LOCAL,
                                "SUBJECT_VERB",
                                "goes",
                                "go",
                                "Use the base verb with I.",
                                "Replace goes with go."
                        ))
                ),
                new GeneratedContent(
                        List.of(),
                        List.of(),
                        List.of(),
                        "I go home after work.",
                        "Reference translation"
                ),
                new SlotAssessments(Map.of(
                        "ACTION", new SlotAssessmentValue("goes home", List.of())
                ))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                "I goes home.",
                1,
                output
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.GRAMMAR_FIX);
        assertThat(assembled.response().correctedAnswer()).isEqualTo("I go home.");
        assertThat(assembled.response().grammarFeedback()).hasSize(1);
    }

    @Test
    void backendUsesTheStrongestGrammarIssueForThePrimaryMission() {
        CanonicalLlmOutput output = new CanonicalLlmOutput(
                new FeedbackDiagnosisResult(
                        new TopicAssessment(TopicRelevance.ON_TOPIC, "Relevant answer"),
                        new StructureAssessment(StructureStatus.COMPLETE, List.of()),
                        List.of(
                                new DiagnosedGrammarIssue(
                                        GrammarImpact.LOCAL,
                                        "SUBJECT_VERB",
                                        "goes",
                                        "go",
                                        "Use the base verb with I.",
                                        "Replace goes with go."
                                ),
                                new DiagnosedGrammarIssue(
                                        GrammarImpact.BLOCKING,
                                        "WORD_ORDER",
                                        "work no",
                                        "do not work",
                                        "The word order blocks the intended meaning.",
                                        "Restore the negative verb phrase."
                                )
                        )
                ),
                new GeneratedContent(
                        List.of(),
                        List.of(),
                        List.of(),
                        "I go home and do not work today.",
                        "Reference translation"
                ),
                new SlotAssessments(Map.of(
                        "ACTION", new SlotAssessmentValue("goes home", List.of())
                ))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                "I goes home and work no today.",
                1,
                output
        );

        assertThat(assembled.diagnosis().strongestGrammarImpact()).isEqualTo(GrammarImpact.BLOCKING);
        assertThat(assembled.response().coachMove().before()).isEqualTo("work no");
        assertThat(assembled.response().coachMove().after()).isEqualTo("do not work");
        assertThat(assembled.response().correctedAnswer()).isEqualTo("I go home and do not work today.");
    }

    @Test
    void optionalNaturalnessRefinementDoesNotBlockCompletion() {
        RefinementExpressionDto refinement = new RefinementExpressionDto(
                "practice having a five-minute conversation",
                "원문도 맞고, 이렇게도 말할 수 있어요.",
                "I practice having a five-minute conversation every evening.",
                "저는 매일 저녁 5분 동안 대화하는 연습을 해요.",
                "5분 동안 대화하는 연습을 하다"
        );
        CanonicalLlmOutput output = new CanonicalLlmOutput(
                new FeedbackDiagnosisResult(
                        new TopicAssessment(TopicRelevance.ON_TOPIC, "Relevant answer"),
                        new StructureAssessment(StructureStatus.COMPLETE, List.of()),
                        List.of()
                ),
                new GeneratedContent(
                        List.of("The plan is specific."),
                        List.of(refinement),
                        List.of(),
                        "I will practice a five-minute conversation every evening.",
                        "Reference translation"
                ),
                new SlotAssessments(Map.of(
                        "ACTION", new SlotAssessmentValue("practice a five-minute conversation", List.of())
                ))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                "I practice a five-minute conversation every evening.",
                1,
                output
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.COMPLETE);
        assertThat(assembled.response().loopComplete()).isTrue();
        assertThat(assembled.response().grammarFeedback()).isEmpty();
        assertThat(assembled.response().ui().fixPoints()).isEmpty();
        assertThat(assembled.response().refinementExpressions()).containsExactly(refinement);
    }

    @Test
    void structureFixUsesTheGroundedRepairAndHidesGrammarFeedback() {
        CanonicalLlmOutput output = new CanonicalLlmOutput(
                new FeedbackDiagnosisResult(
                        new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                        new StructureAssessment(StructureStatus.FRAGMENT, List.of(new StructureRepair(
                                "Gym after work, relaxing.",
                                "I go to the gym after work because it helps me relax.",
                                "주어와 서술어가 있는 문장으로 완성해야 해요.",
                                "질문의 틀을 활용해 완전한 문장으로 바꿔 보세요."
                        ))),
                        List.of(new DiagnosedGrammarIssue(
                                GrammarImpact.LOCAL,
                                "WORD_FORM",
                                "relaxing",
                                "relaxed",
                                "문맥에 맞는 형태를 사용해요.",
                                "relaxing을 relaxed로 바꿔 보세요."
                        ))
                ),
                new GeneratedContent(
                        List.of(),
                        List.of(),
                        List.of(),
                        "I go to the gym after work because it helps me relax.",
                        "퇴근 후 긴장을 풀기 위해 헬스장에 가요."
                ),
                new SlotAssessments(Map.of(
                        "ACTION", new SlotAssessmentValue("Gym after work", List.of())
                ))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                "Gym after work, relaxing.",
                1,
                output
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.STRUCTURE_FIX);
        assertThat(assembled.response().correctedAnswer())
                .isEqualTo("I go to the gym after work because it helps me relax.");
        assertThat(assembled.response().grammarFeedback()).isEmpty();
        assertThat(assembled.response().corrections()).isEmpty();
        assertThat(assembled.response().coachMove().focusType()).isEqualTo("STRUCTURE_FIX");
        assertThat(assembled.response().coachMove().before()).isEqualTo("Gym after work, relaxing.");
        assertThat(assembled.response().coachMove().after())
                .isEqualTo("I go to the gym after work because it helps me relax.");
    }

    @Test
    void structureFixUsesAuthoritativeRepairWithoutJoiningFragments() {
        CanonicalLlmOutput output = new CanonicalLlmOutput(
                new FeedbackDiagnosisResult(
                        new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                        new StructureAssessment(StructureStatus.FRAGMENT, List.of(new StructureRepair(
                                "After work, maybe noodles.",
                                "After work, I usually eat noodles.",
                                "주어와 서술어가 없어 문장이 완성되지 않았어요.",
                                "주어와 동사를 넣어 한 문장으로 완성해 보세요."
                        ))),
                        List.of()
                ),
                new GeneratedContent(
                        List.of(),
                        List.of(),
                        List.of(),
                        "After work, I usually eat noodles because they are quick.",
                        "퇴근 후에는 빨리 준비할 수 있어서 보통 국수를 먹어요."
                ),
                new SlotAssessments(Map.of(
                        "ACTION", new SlotAssessmentValue("noodles", List.of())
                ))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                "After work, maybe noodles.",
                1,
                output
        );

        assertThat(assembled.response().correctedAnswer())
                .isEqualTo("After work, I usually eat noodles.");
        assertThat(assembled.response().correctedAnswer()).doesNotContain(".,", "..");
        assertThat(assembled.response().ui().fixPoints()).singleElement()
                .satisfies(point -> assertThat(point.revisedText())
                        .isEqualTo("After work, I usually eat noodles."));
    }

    private PromptDto prompt() {
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do after work and why?",
                "What do you usually do after work and why?",
                "",
                null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of("REASON"), null, null, 1)
        );
    }

    private PromptDto grammarPrompt() {
        return new PromptDto(
                "prompt-2",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you do after work?",
                "What do you do after work?",
                "",
                null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of(), null, null, 0)
        );
    }
}
