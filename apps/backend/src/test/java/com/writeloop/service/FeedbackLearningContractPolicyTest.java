package com.writeloop.service;

import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedbackLearningContractPolicyTest {

    private final FeedbackLearningContractPolicy policy = new FeedbackLearningContractPolicy();

    @Test
    void promptContractCombinesCommonDefinitionWithQuestionSpecificEnglishMetadata() {
        Map<String, Object> contract = policy.promptContract(prompt(List.of("ACTION"), List.of(), 0));

        assertThat(contract).containsEntry("requiredSlots", List.of("ACTION"));
        @SuppressWarnings("unchecked")
        Map<String, Map<String, String>> slots =
                (Map<String, Map<String, String>>) contract.get("slotContracts");
        assertThat(slots.get("ACTION"))
                .containsKeys("definition", "semanticRole", "satisfiedWhen");
    }

    @Test
    void promptContractRejectsMissingQuestionSpecificSlotMetadata() {
        PromptDto prompt = new PromptDto(
                "missing-contract",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you do?",
                "무엇을 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        List.of("ACTION"),
                        List.of(),
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        0,
                        Map.of()
                )
        );

        assertThatThrownBy(() -> policy.promptContract(prompt))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("slot contracts");
    }

    @Test
    void choosesOffTopicResetBeforeSlots() {
        String answer = "I like baseball.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.OFF_TOPIC,
                StructureStatus.COMPLETE,
                answer,
                List.of()
        );

        MissionDecision decision = policy.resolve(
                prompt(List.of("ACTION"), List.of("REASON"), 1),
                answer,
                diagnosis,
                assessment(missing("ACTION"), missing("REASON"))
        );

        assertThat(decision.missionKind()).isEqualTo(MissionKind.TASK_RESET);
    }

    @Test
    void rejectsOffTopicDiagnosisThatChangesTheAnswer() {
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.OFF_TOPIC,
                StructureStatus.COMPLETE,
                "I enjoy baseball.",
                List.of(step(LanguageIssueKind.GRAMMAR_LOCAL, "I enjoy baseball."))
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                "I like baseball.",
                diagnosis,
                assessment(missing("ACTION"))
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("OFF_TOPIC");
    }

    @Test
    void acceptsOneRevisionStepThatContainsSeveralLowLevelDiffSpans() {
        String answer = "i take phill to stay focus.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I take a pill to stay focused.",
                List.of(step(LanguageIssueKind.GRAMMAR_LOCAL, "I take a pill to stay focused."))
        );

        LearningContractResolution resolution = policy.resolveContract(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "take phill"))
        );

        assertThat(resolution.languageCorrections()).singleElement()
                .satisfies(correction -> {
                    assertThat(correction.edit().originalText())
                            .isEqualTo("i take phill to stay focus.");
                    assertThat(correction.edit().revisedText())
                            .isEqualTo("I take a pill to stay focused.");
                });
    }

    @Test
    void acceptsCumulativeRevisionStepsInSourceOrder() {
        String answer = "i take phill to stay focus.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I take a pill to stay focused.",
                List.of(
                        step(LanguageIssueKind.GRAMMAR_LOCAL, "I take phill to stay focus."),
                        step(LanguageIssueKind.GRAMMAR_LOCAL, "I take a pill to stay focus."),
                        step(LanguageIssueKind.GRAMMAR_LOCAL, "I take a pill to stay focused.")
                )
        );

        LearningContractResolution resolution = policy.resolveContract(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "take phill"))
        );

        assertThat(resolution.languageCorrections()).hasSize(3);
        assertThat(resolution.languageCorrections())
                .extracting(correction -> correction.edit().sourceStart())
                .isSorted();
        assertThat(resolution.revisedAnswer()).isEqualTo("I take a pill to stay focused.");
    }

    @Test
    void repeatedWordsDoNotMakeARevisionAmbiguous() {
        String answer = "I drink makgeolli, and I enjoy makgeolli.";
        String revised = "I drink makgeolli, and I enjoy Makgeolli.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                revised,
                List.of(step(LanguageIssueKind.GRAMMAR_LOCAL, revised))
        );

        LearningContractResolution resolution = policy.resolveContract(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "drink makgeolli"))
        );

        assertThat(resolution.languageCorrections()).singleElement()
                .satisfies(correction -> assertThat(correction.edit().sourceStart()).isGreaterThan(20));
    }

    @Test
    void rejectsLanguageStepsThatMoveBackwardsWithinTheSameKind() {
        String answer = "i go hom.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I go home.",
                List.of(
                        step(LanguageIssueKind.GRAMMAR_LOCAL, "i go home."),
                        step(LanguageIssueKind.GRAMMAR_LOCAL, "I go home.")
                )
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "go"))
        ))
                .isInstanceOfSatisfying(FeedbackContractException.class, exception -> {
                    assertThat(exception.retryable()).isFalse();
                    assertThat(exception).hasMessageContaining("source order");
                });
    }

    @Test
    void rejectsLaterLanguageStepThatChangesAnEarlierCorrection() {
        String answer = "I bad home.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I went home.",
                List.of(
                        step(LanguageIssueKind.GRAMMAR_BLOCKING, "I go home."),
                        step(LanguageIssueKind.GRAMMAR_LOCAL, "I went home.")
                )
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "bad home"))
        ))
                .isInstanceOfSatisfying(FeedbackContractException.class, exception -> {
                    assertThat(exception.retryable()).isFalse();
                    assertThat(exception).hasMessageContaining("earlier step");
                });
    }

    @Test
    void rejectsLanguageStepsThatReverseTheKindPriority() {
        String answer = "i work no today.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I do not work today.",
                List.of(
                        step(LanguageIssueKind.GRAMMAR_LOCAL, "I work no today."),
                        step(LanguageIssueKind.GRAMMAR_BLOCKING, "I do not work today.")
                )
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "work no"))
        ))
                .isInstanceOfSatisfying(FeedbackContractException.class, exception -> {
                    assertThat(exception.retryable()).isFalse();
                    assertThat(exception).hasMessageContaining("ordered STRUCTURE");
                });
    }

    @Test
    void blockingGrammarPreemptsMissingRequiredSlot() {
        String answer = "I work no today.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I do not work today.",
                List.of(step(LanguageIssueKind.GRAMMAR_BLOCKING, "I do not work today."))
        );

        MissionDecision decision = policy.resolve(
                prompt(List.of("ACTION", "REASON"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "work no"), missing("REASON"))
        );

        assertThat(decision.missionKind()).isEqualTo(MissionKind.LANGUAGE_FIX);
    }

    @Test
    void fragmentRequiresAStructureIssueAndPreemptsGrammarAndSlots() {
        String answer = "After work, noodles.";
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.FRAGMENT,
                "After work, I eat noodles.",
                List.of(step(LanguageIssueKind.STRUCTURE, "After work, I eat noodles."))
        );

        MissionDecision decision = policy.resolve(
                prompt(List.of("ACTION", "REASON"), List.of(), 0),
                answer,
                diagnosis,
                assessment(satisfied("ACTION", "noodles"), missing("REASON"))
        );

        assertThat(decision.missionKind()).isEqualTo(MissionKind.LANGUAGE_FIX);
    }

    @Test
    void rejectsFragmentWithoutAStructureIssue() {
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.FRAGMENT,
                "I eat noodles.",
                List.of(step(LanguageIssueKind.GRAMMAR_LOCAL, "I eat noodles."))
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                "Eat noodles.",
                diagnosis,
                assessment(satisfied("ACTION", "Eat noodles"))
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("STRUCTURE");
    }

    @Test
    void rejectsCompleteAssessmentWithAStructureIssue() {
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I eat noodles.",
                List.of(step(LanguageIssueKind.STRUCTURE, "I eat noodles."))
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                "Eat noodles.",
                diagnosis,
                assessment(satisfied("ACTION", "Eat noodles"))
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("COMPLETE");
    }

    @Test
    void missingRequiredSlotPreemptsLocalGrammar() {
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I go home.",
                List.of(step(LanguageIssueKind.GRAMMAR_LOCAL, "I go home."))
        );

        MissionDecision decision = policy.resolve(
                prompt(List.of("ACTION", "REASON"), List.of(), 0),
                "I goes home.",
                diagnosis,
                assessment(satisfied("ACTION", "goes home"), missing("REASON"))
        );

        assertThat(decision.missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(decision.chosenSlot()).isEqualTo("REASON");
    }

    @Test
    void localGrammarRunsAfterRequiredSlotsAreSatisfied() {
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I go home because I am tired.",
                List.of(step(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "I go home because I am tired."
                ))
        );

        MissionDecision decision = policy.resolve(
                prompt(List.of("ACTION", "REASON"), List.of(), 0),
                "I goes home because I am tired.",
                diagnosis,
                assessment(
                        satisfied("ACTION", "goes home"),
                        satisfied("REASON", "because I am tired")
                )
        );

        assertThat(decision.missionKind()).isEqualTo(MissionKind.LANGUAGE_FIX);
    }

    @Test
    void acceptsUpToTwentyFiveLanguageCorrections() {
        RevisionCase revisionCase = revisionCase(25);
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                revisionCase.revised(),
                revisionCase.steps()
        );

        LearningContractResolution resolution = policy.resolveContract(
                prompt(List.of("ACTION"), List.of(), 0),
                revisionCase.original(),
                diagnosis,
                assessment(satisfied("ACTION", "item0"))
        );

        assertThat(resolution.languageCorrections()).hasSize(25);
    }

    @Test
    void rejectsMoreThanTwentyFiveLanguageCorrections() {
        RevisionCase revisionCase = revisionCase(26);
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                revisionCase.revised(),
                revisionCase.steps()
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                revisionCase.original(),
                diagnosis,
                assessment(satisfied("ACTION", "item0"))
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("at most 25");
    }

    @Test
    void restoresSlotEvidenceFromThePositionedLanguageDiff() {
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                StructureStatus.COMPLETE,
                "I usually wash the dishes.",
                List.of(step(
                        LanguageIssueKind.GRAMMAR_LOCAL,
                        "I usually wash the dishes."
                ))
        );

        LearningContractResolution resolution = policy.resolveContract(
                prompt(List.of("ACTION"), List.of(), 0),
                "I usually washes the dishes.",
                diagnosis,
                assessment(satisfied("ACTION", "wash the dishes"))
        );

        assertThat(resolution.decision().slotAssessments().get("ACTION").evidence())
                .isEqualTo("washes the dishes");
    }

    @Test
    void derivesGenericMissingAndSatisfiedSlotStates() {
        String answer = "I do something because it is useful.";
        MissionDecision decision = policy.resolve(
                prompt(List.of("ACTION", "REASON"), List.of("DETAIL"), 1),
                answer,
                diagnosis(TopicRelevance.ON_TOPIC, StructureStatus.COMPLETE, answer, List.of()),
                assessment(
                        generic("ACTION", "something"),
                        satisfied("REASON", "because it is useful"),
                        missing("DETAIL")
                )
        );

        assertThat(decision.slotAssessments().get("ACTION").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.GENERIC);
        assertThat(decision.slotAssessments().get("REASON").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.SATISFIED);
        assertThat(decision.slotAssessments().get("DETAIL").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.MISSING);
    }

    @Test
    void rejectsAssessmentWithoutEvidenceOrSupport() {
        String answer = "I walk.";

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis(TopicRelevance.ON_TOPIC, StructureStatus.COMPLETE, answer, List.of()),
                assessment(Map.entry("ACTION", new SlotAssessmentValue(null, List.of())))
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("evidence");
    }

    @Test
    void rejectsEvidenceThatDoesNotQuoteTheLearnerAnswer() {
        String answer = "I walk.";

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis(TopicRelevance.ON_TOPIC, StructureStatus.COMPLETE, answer, List.of()),
                assessment(satisfied("ACTION", "take a walk"))
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("evidence from the learner answer");
    }

    @Test
    void rejectsIncompleteScaffoldInsteadOfInventingBackendFallback() {
        String answer = "It is nice.";
        SlotFeedbackSupport incomplete = new SlotFeedbackSupport(
                "행동 말하기",
                "행동이 빠졌어요.",
                "행동을 넣어 보세요.",
                "I usually take a walk.",
                "I usually ____.",
                "저는 보통 ____해요.",
                List.of(new FeedbackSuggestedPhraseDto("take a walk", "산책하다")),
                "행동 한 가지"
        );

        assertThatThrownBy(() -> policy.resolve(
                prompt(List.of("ACTION"), List.of(), 0),
                answer,
                diagnosis(TopicRelevance.ON_TOPIC, StructureStatus.COMPLETE, answer, List.of()),
                assessment(Map.entry("ACTION", new SlotAssessmentValue(null, List.of(incomplete))))
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("Incomplete slot support");
    }

    private PromptDto prompt(List<String> required, List<String> optional, int minimumDepth) {
        Map<String, PromptSlotContractDto> slotContracts = new LinkedHashMap<>();
        List<String> configuredSlots = new ArrayList<>(required);
        configuredSlots.addAll(optional);
        configuredSlots.forEach(slot -> slotContracts.put(
                slot,
                new PromptSlotContractDto(
                        "The question-specific role of " + slot + ".",
                        "The learner answer clearly fulfills " + slot + " for this question.",
                        "Korean role reference for " + slot + ".",
                        "Korean satisfaction reference for " + slot + "."
                )
        ));
        return new PromptDto(
                "prompt-1",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do and why?",
                "보통 무엇을 하고 왜 하나요?",
                "",
                null,
                new PromptTaskMetaDto(
                        "ROUTINE",
                        required,
                        optional,
                        "PRESENT_SIMPLE",
                        "FIRST_PERSON",
                        minimumDepth,
                        slotContracts
                )
        );
    }

    private FeedbackDiagnosisResult diagnosis(
            TopicRelevance topic,
            StructureStatus structure,
            String revisedAnswer,
            List<LanguageRevisionStep> revisionSteps
    ) {
        return new FeedbackDiagnosisResult(
                new TopicAssessment(topic, "판정 근거"),
                new StructureAssessment(structure),
                new LanguageAssessment(revisionSteps)
        );
    }

    private LanguageRevisionStep step(LanguageIssueKind kind, String answerAfter) {
        return new LanguageRevisionStep(
                kind,
                "LANGUAGE",
                answerAfter,
                "이 변경이 필요한 이유예요.",
                "표시된 부분을 고쳐 보세요."
        );
    }

    private RevisionCase revisionCase(int count) {
        StringBuilder original = new StringBuilder();
        for (int index = 0; index < count; index++) {
            original.append("item").append(index).append(" anchor").append(index).append(' ');
        }
        String originalAnswer = original.toString().trim();
        String revisedAnswer = originalAnswer;
        List<LanguageRevisionStep> steps = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            revisedAnswer = revisedAnswer.replace(
                    "item" + index + " ",
                    "fixed" + index + " "
            );
            steps.add(step(LanguageIssueKind.GRAMMAR_LOCAL, revisedAnswer));
        }
        return new RevisionCase(originalAnswer, revisedAnswer, List.copyOf(steps));
    }

    private Map.Entry<String, SlotAssessmentValue> satisfied(String slot, String evidence) {
        return Map.entry(slot, new SlotAssessmentValue(evidence, List.of()));
    }

    private Map.Entry<String, SlotAssessmentValue> generic(String slot, String evidence) {
        return Map.entry(slot, new SlotAssessmentValue(evidence, List.of(support(slot))));
    }

    private Map.Entry<String, SlotAssessmentValue> missing(String slot) {
        return Map.entry(slot, new SlotAssessmentValue(null, List.of(support(slot))));
    }

    @SafeVarargs
    private final SlotAssessments assessment(Map.Entry<String, SlotAssessmentValue>... entries) {
        Map<String, SlotAssessmentValue> values = new LinkedHashMap<>();
        for (Map.Entry<String, SlotAssessmentValue> entry : entries) {
            values.put(entry.getKey(), entry.getValue());
        }
        return new SlotAssessments(values);
    }

    private SlotFeedbackSupport support(String slot) {
        return new SlotFeedbackSupport(
                slot + " 보강하기",
                "이 내용을 구체화하면 답이 또렷해져요.",
                "실제 내용을 한 가지 넣어 보세요.",
                "I usually take a walk after dinner.",
                "I usually ____.",
                "저는 보통 ____해요.",
                List.of(
                        new FeedbackSuggestedPhraseDto("take a walk", "산책하다"),
                        new FeedbackSuggestedPhraseDto("after dinner", "저녁 식사 후에")
                ),
                "실제 내용을 한 가지 써 주세요."
        );
    }

    private record RevisionCase(
            String original,
            String revised,
            List<LanguageRevisionStep> steps
    ) {
    }
}
