package com.writeloop.service;

import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedbackLearningContractPolicyTest {

    private final FeedbackLearningContractPolicy policy = new FeedbackLearningContractPolicy();

    @Test
    void promptContractCombinesCommonDefinitionWithQuestionSpecificEnglishMetadata() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of("REASON"), 1);

        Map<String, Object> contract = policy.promptContract(prompt);

        @SuppressWarnings("unchecked")
        Map<String, Map<String, String>> slotContracts =
                (Map<String, Map<String, String>>) contract.get("slotContracts");
        assertThat(slotContracts.get("ACTION"))
                .containsKeys("definition", "semanticRole", "satisfiedWhen");
        assertThat(slotContracts.get("ACTION"))
                .doesNotContainKeys("semanticRoleKo", "satisfiedWhenKo");
    }

    @Test
    void promptContractRejectsMissingQuestionSpecificSlotMetadata() {
        PromptDto prompt = new PromptDto(
                "prompt-without-contract",
                "Daily life",
                "Daily life",
                "Routine",
                "A",
                "What do you usually do?",
                "What do you usually do?",
                "",
                null,
                new PromptTaskMetaDto("ROUTINE", List.of("ACTION"), List.of())
        );

        assertThatThrownBy(() -> policy.promptContract(prompt))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("slot contracts do not match");
    }

    @Test
    void choosesOffTopicResetBeforeGrammarAndSlots() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of("REASON"), 1);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.OFF_TOPIC, List.of(
                issue("baseball", "baseball games")
        ));
        SlotAssessments assessment = assessment(
                missing("ACTION"),
                missing("REASON")
        );

        MissionDecision result = policy.resolve(prompt, "I enjoy baseball.", diagnosis, assessment);

        assertThat(result.missionKind()).isEqualTo(MissionKind.TASK_RESET);
        assertThat(result.chosenSlot()).isEqualTo("ACTION");
    }

    @Test
    void rejectsOffTopicDiagnosisThatTreatsUnrelatedFactsAsSatisfiedSlots() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.OFF_TOPIC, List.of());
        SlotAssessments assessment = assessment(satisfied("ACTION", "enjoy baseball"));

        assertThatThrownBy(() -> policy.resolve(prompt, "I enjoy baseball.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("OFF_TOPIC");
    }

    @Test
    void rejectsGrammarIssueWithoutGroundedCorrectionEvidence() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of(
                issue("invented text", "corrected text")
        ));
        SlotAssessments assessment = assessment(satisfied("ACTION", "goes home"));

        assertThatThrownBy(() -> policy.resolve(prompt, "I goes home.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("exact learner-answer span");
    }

    @Test
    void rejectsGrammarIssueWithoutAUsableImpact() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of(
                issue(GrammarImpact.NONE, "goes", "go")
        ));
        SlotAssessments assessment = assessment(satisfied("ACTION", "goes home"));

        assertThatThrownBy(() -> policy.resolve(prompt, "I goes home.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("LOCAL or BLOCKING");
    }

    @Test
    void blockingGrammarPreemptsMissingRequiredSlot() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of(
                issue(GrammarImpact.BLOCKING, "I am go", "I am going")
        ));
        SlotAssessments assessment = assessment(missing("ACTION"));

        MissionDecision result = policy.resolve(prompt, "I am go.", diagnosis, assessment);

        assertThat(result.missionKind()).isEqualTo(MissionKind.GRAMMAR_FIX);
        assertThat(result.chosenSlot()).isNull();
    }

    @Test
    void onTopicFragmentPreemptsBlockingGrammarAndMissingRequiredSlot() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                structureAssessment(
                        StructureStatus.FRAGMENT,
                        structureRepair("Too many tasks at work.", "I have too many tasks at work.")
                ),
                List.of(issue(GrammarImpact.BLOCKING, "Too many tasks", "I have too many tasks"))
        );
        SlotAssessments assessment = assessment(missing("ACTION"));

        MissionDecision result = policy.resolve(prompt, "Too many tasks at work.", diagnosis, assessment);

        assertThat(result.missionKind()).isEqualTo(MissionKind.STRUCTURE_FIX);
        assertThat(result.chosenSlot()).isNull();
    }

    @Test
    void offTopicStillPreemptsFragment() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.OFF_TOPIC, "질문과 다른 주제예요."),
                structureAssessment(StructureStatus.FRAGMENT),
                List.of()
        );
        SlotAssessments assessment = assessment(missing("ACTION"));

        MissionDecision result = policy.resolve(prompt, "Baseball with my brother.", diagnosis, assessment);

        assertThat(result.missionKind()).isEqualTo(MissionKind.TASK_RESET);
    }

    @Test
    void rejectsOffTopicDiagnosisWithStructureRepair() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.OFF_TOPIC, "질문과 다른 주제예요."),
                structureAssessment(
                        StructureStatus.FRAGMENT,
                        structureRepair("Baseball with my brother.", "I watch baseball with my brother.")
                ),
                List.of()
        );
        SlotAssessments assessment = assessment(missing("ACTION"));

        assertThatThrownBy(() -> policy.resolve(prompt, "Baseball with my brother.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("OFF_TOPIC structure assessment");
    }

    @Test
    void rejectsFragmentWithoutStructureRepair() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                structureAssessment(StructureStatus.FRAGMENT),
                List.of()
        );
        SlotAssessments assessment = assessment(missing("ACTION"));

        assertThatThrownBy(() -> policy.resolve(prompt, "At the gym.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("exactly one repair");
    }

    @Test
    void rejectsFragmentWithoutOneAuthoritativeCorrectedAnswer() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                structureAssessment(
                        StructureStatus.FRAGMENT,
                        structureRepair("At the gym.", null)
                ),
                List.of()
        );
        SlotAssessments assessment = assessment(missing("ACTION"));

        assertThatThrownBy(() -> policy.resolve(prompt, "At the gym.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("one distinct corrected answer");
    }

    @Test
    void rejectsFragmentWithMoreThanOneStructureRepair() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                structureAssessment(
                        StructureStatus.FRAGMENT,
                        structureRepair("After work, maybe noodles.", "After work, I usually eat noodles."),
                        structureRepair("After work, maybe noodles.", "I usually eat noodles after work.")
                ),
                List.of()
        );
        SlotAssessments assessment = assessment(satisfied("ACTION", "noodles"));

        assertThatThrownBy(() -> policy.resolve(prompt, "After work, maybe noodles.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("exactly one repair");
    }

    @Test
    void rejectsStructureRepairThatQuotesOnlyPartOfTheAnswer() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                structureAssessment(
                        StructureStatus.FRAGMENT,
                        structureRepair("maybe noodles", "After work, I usually eat noodles.")
                ),
                List.of()
        );
        SlotAssessments assessment = assessment(satisfied("ACTION", "noodles"));

        assertThatThrownBy(() -> policy.resolve(prompt, "After work, maybe noodles.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("complete learner answer");
    }

    @Test
    void rejectsCompleteAnswerWithStructureRepair() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = new FeedbackDiagnosisResult(
                new TopicAssessment(TopicRelevance.ON_TOPIC, "질문에 관련된 답이에요."),
                structureAssessment(
                        StructureStatus.COMPLETE,
                        structureRepair("I go home.", "I go home after work.")
                ),
                List.of()
        );
        SlotAssessments assessment = assessment(satisfied("ACTION", "go home"));

        assertThatThrownBy(() -> policy.resolve(prompt, "I go home.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("cannot include a repair");
    }

    @Test
    void missingRequiredSlotPreemptsLocalGrammar() {
        PromptDto prompt = prompt(List.of("ACTION", "REASON"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of(
                issue("I goes", "I go")
        ));
        SlotAssessments assessment = assessment(
                satisfied("ACTION", "I goes home"),
                missing("REASON")
        );

        MissionDecision result = policy.resolve(prompt, "I goes home.", diagnosis, assessment);

        assertThat(result.missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(result.chosenSlot()).isEqualTo("REASON");
    }

    @Test
    void genericRequiredSlotRemainsTheTargetSlot() {
        PromptDto prompt = prompt(List.of("PLAN"), List.of("DETAIL"), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessment = assessment(
                generic("PLAN", "exercise more"),
                missing("DETAIL")
        );

        MissionDecision result = policy.resolve(
                prompt,
                "I will exercise more.",
                diagnosis,
                assessment
        );

        assertThat(result.missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(result.chosenSlot()).isEqualTo("PLAN");
    }

    @Test
    void localGrammarRunsAfterRequiredSlotsAreSatisfied() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of(
                issue("I goes", "I go")
        ));
        SlotAssessments assessment = assessment(satisfied("ACTION", "I goes home"));

        MissionDecision result = policy.resolve(prompt, "I goes home.", diagnosis, assessment);

        assertThat(result.missionKind()).isEqualTo(MissionKind.GRAMMAR_FIX);
    }

    @Test
    void completesWhenTopicGrammarAndDepthContractAreSatisfied() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of("REASON"), 1);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessment = assessment(
                satisfied("ACTION", "I take a nap"),
                satisfied("REASON", "because it helps me recharge")
        );

        MissionDecision result = policy.resolve(
                prompt,
                "I take a nap because it helps me recharge.",
                diagnosis,
                assessment
        );

        assertThat(result.missionKind()).isEqualTo(MissionKind.COMPLETE);
        assertThat(result.chosenSlot()).isNull();
    }

    @Test
    void completesBroadOpinionAfterOneConcreteDepthSlot() {
        PromptDto prompt = prompt(
                List.of("OPINION"),
                List.of("REASON", "EXAMPLE", "RESULT"),
                1
        );
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessment = assessment(
                satisfied("OPINION", "Companies should protect user data"),
                satisfied("REASON", "because privacy matters"),
                missing("EXAMPLE"),
                missing("RESULT")
        );

        MissionDecision result = policy.resolve(
                prompt,
                "Companies should protect user data because privacy matters.",
                diagnosis,
                assessment
        );

        assertThat(result.missionKind()).isEqualTo(MissionKind.COMPLETE);
        assertThat(result.missingSlots()).isEmpty();
    }

    @Test
    void genericDepthDoesNotSatisfyLoweredOpinionContract() {
        PromptDto prompt = prompt(
                List.of("OPINION"),
                List.of("REASON", "EXAMPLE", "RESULT"),
                1
        );
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessment = assessment(
                satisfied("OPINION", "Companies should act responsibly"),
                generic("REASON", "because it is important"),
                missing("EXAMPLE"),
                missing("RESULT")
        );

        MissionDecision result = policy.resolve(
                prompt,
                "Companies should act responsibly because it is important.",
                diagnosis,
                assessment
        );

        assertThat(result.missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(result.chosenSlot()).isEqualTo("REASON");
    }

    @Test
    void derivesGenericWhenEvidenceAndSupportArePresent() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue(
                        "something",
                        List.of(support("ACTION"))
                )
        ));

        MissionDecision result = policy.resolve(prompt, "I do something.", diagnosis, assessments);

        assertThat(result.missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(result.slotAssessments().get("ACTION").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.GENERIC);
    }

    @Test
    void derivesSatisfiedWhenEvidenceIsPresentWithoutSupport() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue("go home", List.of())
        ));

        MissionDecision result = policy.resolve(prompt, "I go home.", diagnosis, assessments);

        assertThat(result.missionKind()).isEqualTo(MissionKind.COMPLETE);
        assertThat(result.slotAssessments().get("ACTION").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.SATISFIED);
    }

    @Test
    void derivesMissingWhenEvidenceIsAbsentAndSupportIsPresent() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue(null, List.of(support("ACTION")))
        ));

        MissionDecision result = policy.resolve(prompt, "I go home.", diagnosis, assessments);

        assertThat(result.missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(result.slotAssessments().get("ACTION").derivedStatus())
                .isEqualTo(SlotAssessmentStatus.MISSING);
    }

    @Test
    void rejectsAssessmentWithoutEvidenceOrSupport() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue(null, List.of())
        ));

        assertThatThrownBy(() -> policy.resolve(prompt, "I go home.", diagnosis, assessments))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("must contain evidence, or exactly one support item");
    }

    @Test
    void rejectsMoreThanOneSupportItem() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue(
                        "something",
                        List.of(support("ACTION"), support("ACTION"))
                )
        ));

        assertThatThrownBy(() -> policy.resolve(prompt, "I do something.", diagnosis, assessments))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("must contain evidence, or exactly one support item");
    }

    @Test
    void rejectsEvidenceThatDoesNotQuoteTheLearnerAnswer() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue("invented action", List.of())
        ));

        assertThatThrownBy(() -> policy.resolve(prompt, "I go home.", diagnosis, assessments))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("requires evidence from the learner answer");
    }

    @Test
    void restoresEvidenceOnlyByReversingAKnownGrammarCorrection() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                List.of(issue("washes", "wash"))
        );
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue("wash the dishes", List.of())
        ));

        MissionDecision result = policy.resolve(
                prompt,
                "After dinner, I usually washes the dishes because it helps me reset.",
                diagnosis,
                assessments
        );

        assertThat(result.missionKind()).isEqualTo(MissionKind.GRAMMAR_FIX);
        assertThat(result.slotAssessments().get("ACTION").evidence())
                .isEqualTo("washes the dishes");
    }

    @Test
    void preservesGenericSupportWhenRestoringGrammarCorrectedEvidence() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                List.of(issue("does", "do"))
        );
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue("do something", List.of(support("ACTION")))
        ));

        MissionDecision result = policy.resolve(
                prompt,
                "I usually does something.",
                diagnosis,
                assessments
        );

        SlotAssessmentValue restored = result.slotAssessments().get("ACTION");
        assertThat(result.missionKind()).isEqualTo(MissionKind.SLOT);
        assertThat(restored.evidence()).isEqualTo("does something");
        assertThat(restored.derivedStatus()).isEqualTo(SlotAssessmentStatus.GENERIC);
        assertThat(restored.support()).hasSize(1);
    }

    @Test
    void rejectsEvidenceWhenGrammarReversalDoesNotProduceAnExactOriginalSpan() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                List.of(issue("washes", "wash"))
        );
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue("wash the plates", List.of())
        ));

        assertThatThrownBy(() -> policy.resolve(
                prompt,
                "After dinner, I usually washes the dishes.",
                diagnosis,
                assessments
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("requires evidence from the learner answer");
    }

    @Test
    void rejectsEvidenceWhenMultipleGrammarReversalsCouldMatchTheOriginal() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(
                TopicRelevance.ON_TOPIC,
                List.of(
                        issue("is", "are"),
                        issue("am", "are")
                )
        );
        SlotAssessments assessments = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue("are", List.of())
        ));

        assertThatThrownBy(() -> policy.resolve(
                prompt,
                "He is tired, and I am ready.",
                diagnosis,
                assessments
        ))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("requires evidence from the learner answer");
    }

    @Test
    void rejectsIncompleteScaffoldInsteadOfInventingBackendFallback() {
        PromptDto prompt = prompt(List.of("ACTION"), List.of(), 0);
        FeedbackDiagnosisResult diagnosis = diagnosis(TopicRelevance.ON_TOPIC, List.of());
        SlotFeedbackSupport incomplete = new SlotFeedbackSupport(
                "행동 말하기", "행동이 빠졌어요.", "행동을 넣어 보세요.",
                "I usually take a walk.", "I usually ____.", "저는 보통 ____해요.",
                List.of(new FeedbackSuggestedPhraseDto("take a walk", "산책하다")),
                "행동 한 가지"
        );
        SlotAssessments assessment = new SlotAssessments(Map.of(
                "ACTION", new SlotAssessmentValue(null, List.of(incomplete))
        ));

        assertThatThrownBy(() -> policy.resolve(prompt, "It is nice.", diagnosis, assessment))
                .isInstanceOf(FeedbackContractException.class)
                .hasMessageContaining("Incomplete slot support");
    }

    private PromptDto prompt(List<String> required, List<String> optional, int minimumDepth) {
        Map<String, PromptSlotContractDto> slotContracts = new LinkedHashMap<>();
        List<String> configuredSlots = new java.util.ArrayList<>(required);
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
            List<DiagnosedGrammarIssue> issues
    ) {
        return new FeedbackDiagnosisResult(
                new TopicAssessment(topic, "판정 근거"),
                structureAssessment(StructureStatus.COMPLETE),
                issues
        );
    }

    private DiagnosedGrammarIssue issue(String original, String revised) {
        return issue(GrammarImpact.LOCAL, original, revised);
    }

    private DiagnosedGrammarIssue issue(GrammarImpact impact, String original, String revised) {
        return new DiagnosedGrammarIssue(
                impact,
                "GRAMMAR",
                original,
                revised,
                "문법을 고쳐요.",
                "표현을 바꿔 보세요."
        );
    }

    private StructureAssessment structureAssessment(StructureStatus status, StructureRepair... repairs) {
        return new StructureAssessment(status, List.of(repairs));
    }

    private StructureRepair structureRepair(String original, String corrected) {
        return new StructureRepair(
                original,
                corrected,
                "주어와 서술어가 있는 문장으로 완성해야 해요.",
                "질문의 틀을 활용해 완전한 문장으로 바꿔 보세요."
        );
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
}
