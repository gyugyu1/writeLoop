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
        SlotFeedbackSupport reasonSupport = support();
        CanonicalLlmOutput output = output(
                diagnosis("I take a walk.", StructureStatus.COMPLETE, List.of()),
                "I usually take a walk after work because it helps me relax.",
                List.of(),
                Map.of(
                        "ACTION", new SlotAssessmentValue("take a walk", List.of()),
                        "REASON", new SlotAssessmentValue(null, List.of(reasonSupport))
                )
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                requiredReasonPrompt(),
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
    void backendUsesFullRevisedAnswerAndDerivesOneCorrectionPerDiffSpan() {
        CanonicalLlmOutput output = output(
                diagnosis(
                        "I go home.",
                        StructureStatus.COMPLETE,
                        List.of(languageStep(
                                LanguageIssueKind.GRAMMAR_LOCAL,
                                "SUBJECT_VERB",
                                "I go home."
                        ))
                ),
                "I go home after work.",
                List.of(),
                Map.of("ACTION", new SlotAssessmentValue("goes home", List.of()))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                "I goes home.",
                1,
                output
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.LANGUAGE_FIX);
        assertThat(assembled.response().revisedAnswer()).isEqualTo("I go home.");
        assertThat(assembled.response().grammarFeedback()).singleElement()
                .satisfies(item -> {
                    assertThat(item.originalText()).isEqualTo("goes");
                    assertThat(item.revisedText()).isEqualTo("go");
                });
    }

    @Test
    void repeatedTextDoesNotNeedAUniqueSubstringMatch() {
        String answer = "I drink makgeolli, and I enjoy makgeolli.";
        String revised = "I drink makgeolli, and I enjoy Makgeolli.";
        CanonicalLlmOutput output = output(
                diagnosis(
                        revised,
                        StructureStatus.COMPLETE,
                        List.of(languageStep(
                                LanguageIssueKind.GRAMMAR_LOCAL,
                                "CAPITALIZATION",
                                revised
                        ))
                ),
                revised,
                List.of(),
                Map.of("ACTION", new SlotAssessmentValue("drink makgeolli", List.of()))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                answer,
                1,
                output
        );

        assertThat(assembled.response().revisedAnswer()).isEqualTo(revised);
        assertThat(assembled.response().coachMove().languageCorrections()).singleElement()
                .satisfies(correction -> {
                    assertThat(correction.before()).isEqualTo("makgeolli.");
                    assertThat(correction.after()).isEqualTo("Makgeolli.");
                });
    }

    @Test
    void languageCorrectionsArePairedInSourceOrderThenSortedForDisplay() {
        String answer = "After work, go home because work no today, and she eat rice.";
        String revised = "After work, I go home because I do not work today, and she eats rice.";
        CanonicalLlmOutput output = output(
                diagnosis(
                        revised,
                        StructureStatus.FRAGMENT,
                        List.of(
                                languageStep(
                                        LanguageIssueKind.STRUCTURE,
                                        "MISSING_SUBJECT",
                                        "After work, I go home because work no today, and she eat rice."
                                ),
                                languageStep(
                                        LanguageIssueKind.GRAMMAR_BLOCKING,
                                        "WORD_ORDER",
                                        "After work, I go home because I do not work today, and she eat rice."
                                ),
                                languageStep(
                                        LanguageIssueKind.GRAMMAR_LOCAL,
                                        "SUBJECT_VERB",
                                        revised
                                )
                        )
                ),
                revised,
                List.of(),
                Map.of("ACTION", new SlotAssessmentValue("go home", List.of()))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                answer,
                1,
                output
        );

        assertThat(assembled.response().coachMove().languageCorrections())
                .extracting("kind")
                .containsExactly("STRUCTURE", "GRAMMAR_BLOCKING", "GRAMMAR_LOCAL");
        assertThat(assembled.response().revisedAnswer()).isEqualTo(revised);
    }

    @Test
    void languageFixPreservesMoreThanFourValidatedCorrections() {
        String answer = "i keep hav anchor appl bridge banan middle eat later thre near pear.";
        String revised = "I keep have anchor apple bridge bananas middle eats later three near pears.";
        List<LanguageRevisionStep> revisionSteps = List.of(
                languageStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "CAPITALIZATION",
                        "I keep hav anchor appl bridge banan middle eat later thre near pear."
                ),
                languageStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "SPELLING",
                        "I keep have anchor appl bridge banan middle eat later thre near pear."
                ),
                languageStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "SPELLING",
                        "I keep have anchor apple bridge banan middle eat later thre near pear."
                ),
                languageStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "NUMBER",
                        "I keep have anchor apple bridge bananas middle eat later thre near pear."
                ),
                languageStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "SUBJECT_VERB",
                        "I keep have anchor apple bridge bananas middle eats later thre near pear."
                ),
                languageStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "SPELLING",
                        "I keep have anchor apple bridge bananas middle eats later three near pear."
                ),
                languageStep(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "NUMBER",
                        revised
                )
        );
        CanonicalLlmOutput output = output(
                diagnosis(revised, StructureStatus.COMPLETE, revisionSteps),
                revised,
                List.of(),
                Map.of("ACTION", new SlotAssessmentValue("eat later", List.of()))
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                answer,
                1,
                output
        );

        assertThat(assembled.response().coachMove().languageCorrections()).hasSize(7);
        assertThat(assembled.response().revisedAnswer()).isEqualTo(revised);
    }

    @Test
    void requiredSlotMissionDoesNotExposeAHiddenLocalGrammarRevision() {
        CanonicalLlmOutput output = output(
                diagnosis(
                        "I go home.",
                        StructureStatus.COMPLETE,
                        List.of(languageStep(
                                LanguageIssueKind.GRAMMAR_LOCAL,
                                "SUBJECT_VERB",
                                "I go home."
                        ))
                ),
                "I go home because I need to rest.",
                List.of(),
                Map.of(
                        "ACTION", new SlotAssessmentValue("goes home", List.of()),
                        "REASON", new SlotAssessmentValue(null, List.of(support()))
                )
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                requiredReasonPrompt(),
                "I goes home.",
                1,
                output
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(assembled.response().revisedAnswer()).isNull();
        assertThat(assembled.response().grammarFeedback()).isEmpty();
        assertThat(assembled.response().coachMove().languageCorrections()).isEmpty();
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
        String answer = "I practice a five-minute conversation every evening.";
        CanonicalLlmOutput output = output(
                diagnosis(answer, StructureStatus.COMPLETE, List.of()),
                answer,
                List.of(refinement),
                Map.of(
                        "ACTION",
                        new SlotAssessmentValue("practice a five-minute conversation", List.of())
                )
        );

        AssembledFeedback assembled = assembler.assemble(
                "internal",
                grammarPrompt(),
                answer,
                1,
                output
        );

        assertThat(assembled.sections().missionDecision().missionKind()).isEqualTo(MissionKind.COMPLETE);
        assertThat(assembled.response().loopComplete()).isTrue();
        assertThat(assembled.response().refinementExpressions()).containsExactly(refinement);
    }

    private CanonicalLlmOutput output(
            FeedbackDiagnosisResult diagnosis,
            String modelAnswer,
            List<RefinementExpressionDto> refinements,
            Map<String, SlotAssessmentValue> slotAssessments
    ) {
        return new CanonicalLlmOutput(
                diagnosis,
                new GeneratedContent(
                        List.of(),
                        refinements,
                        List.of(),
                        modelAnswer,
                        "Reference translation"
                ),
                new SlotAssessments(slotAssessments)
        );
    }

    private FeedbackDiagnosisResult diagnosis(
            String revisedAnswer,
            StructureStatus structureStatus,
            List<LanguageRevisionStep> revisionSteps
    ) {
        return new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "Relevant answer"),
                new StructureAssessment(structureStatus),
                new LanguageAssessment(revisionSteps)
        );
    }

    private LanguageRevisionStep languageStep(
            LanguageIssueKind kind,
            String code,
            String answerAfter
    ) {
        return new LanguageRevisionStep(
                kind,
                code,
                answerAfter,
                "이 변경이 필요한 이유예요.",
                "표시된 부분을 고쳐 보세요."
        );
    }

    private SlotFeedbackSupport support() {
        return new SlotFeedbackSupport(
                "이유를 더해 보세요",
                "구체적인 이유가 필요해요.",
                "실제 경험에서 이유 하나를 더하세요.",
                "I take a walk because it helps me relax.",
                "I take a walk because ____.",
                "나는 ____ 때문에 산책해요.",
                List.of(
                        new FeedbackSuggestedPhraseDto("it helps me relax", "긴장을 풀어 줘요"),
                        new FeedbackSuggestedPhraseDto("I need fresh air", "신선한 공기가 필요해요")
                ),
                "구체적인 이유 하나를 쓰세요."
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
                "퇴근 후 무엇을 하나요?",
                "",
                null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of(), null, null, 0)
        );
    }

    private PromptDto requiredReasonPrompt() {
        return new PromptDto(
                "prompt-3",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you do after work, and why?",
                "퇴근 후 무엇을 하고, 왜 그렇게 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION", "REASON"),
                        List.of(),
                        null,
                        null,
                        0
                )
        );
    }
}
