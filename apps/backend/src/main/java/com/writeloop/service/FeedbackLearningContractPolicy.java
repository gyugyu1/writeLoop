package com.writeloop.service;

import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptSlotContractDto;
import com.writeloop.dto.PromptTaskMetaDto;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class FeedbackLearningContractPolicy {

    MissionDecision resolve(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            SlotAssessments assessments
    ) {
        if (diagnosis == null) {
            throw new FeedbackContractException("The LLM response did not include a diagnosis");
        }
        verifyDiagnosis(learnerAnswer, diagnosis);

        PromptTaskMetaDto taskMeta = prompt == null ? null : prompt.taskMeta();
        List<String> requiredSlots = taskMeta == null
                ? List.of()
                : mappedSlots(taskMeta.requiredSlots(), taskMeta.answerMode());
        List<String> depthSlots = taskMeta == null
                ? List.of()
                : mappedSlots(taskMeta.optionalSlots(), taskMeta.answerMode()).stream()
                .filter(slot -> !requiredSlots.contains(slot))
                .toList();
        LinkedHashSet<String> allowedSlots = new LinkedHashSet<>(requiredSlots);
        allowedSlots.addAll(depthSlots);

        ContractAssessment verified = verifyAssessment(
                learnerAnswer,
                taskMeta == null ? null : taskMeta.answerMode(),
                allowedSlots,
                assessments,
                diagnosis.grammarIssues()
        );
        if (diagnosis.topicRelevance() == TopicRelevance.OFF_TOPIC
                && verified.values().values().stream()
                .anyMatch(item -> item.derivedStatus() != SlotAssessmentStatus.MISSING)) {
            throw new FeedbackContractException("OFF_TOPIC answers cannot satisfy question slots");
        }
        List<String> presentSlots = verified.values().entrySet().stream()
                .filter(entry -> entry.getValue().isSatisfied())
                .map(Map.Entry::getKey)
                .toList();
        List<String> unresolvedRequired = unresolved(requiredSlots, presentSlots);
        int minimumDepthSlots = taskMeta == null
                ? 0
                : Math.min(taskMeta.minimumDepthSlots(), depthSlots.size());
        long satisfiedDepthCount = depthSlots.stream().filter(presentSlots::contains).count();
        List<String> unresolvedDepth = satisfiedDepthCount < minimumDepthSlots
                ? unresolved(depthSlots, presentSlots)
                : List.of();
        List<String> missingSlots = new ArrayList<>(unresolvedRequired);
        missingSlots.addAll(unresolvedDepth);

        if (diagnosis.topicRelevance() == TopicRelevance.OFF_TOPIC) {
            String target = firstSlot(requiredSlots, depthSlots);
            return decision(
                    MissionKind.TASK_RESET,
                    presentSlots,
                    missingSlots,
                    target,
                    verified
            );
        }
        if (diagnosis.structureAssessment().status() == StructureStatus.FRAGMENT) {
            return decision(MissionKind.STRUCTURE_FIX, presentSlots, missingSlots, null, verified);
        }
        if (diagnosis.strongestGrammarImpact() == GrammarImpact.BLOCKING) {
            return decision(MissionKind.GRAMMAR_FIX, presentSlots, missingSlots, null, verified);
        }
        if (!unresolvedRequired.isEmpty()) {
            return decision(MissionKind.SLOT, presentSlots, missingSlots, unresolvedRequired.get(0), verified);
        }
        if (diagnosis.strongestGrammarImpact() == GrammarImpact.LOCAL) {
            return decision(MissionKind.GRAMMAR_FIX, presentSlots, missingSlots, null, verified);
        }
        if (!unresolvedDepth.isEmpty()) {
            return decision(MissionKind.SLOT, presentSlots, missingSlots, unresolvedDepth.get(0), verified);
        }
        return decision(MissionKind.COMPLETE, presentSlots, List.of(), null, verified);
    }

    Map<String, Object> promptContract(PromptDto prompt) {
        PromptTaskMetaDto taskMeta = prompt == null ? null : prompt.taskMeta();
        if (taskMeta == null) {
            if (prompt != null && prompt.id() != null && !prompt.id().isBlank()) {
                throw new FeedbackContractException(
                        "Question-specific task metadata is missing: " + prompt.id()
                );
            }
            return Map.of(
                    "answerMode", "GENERAL_DESCRIPTION",
                    "requiredSlots", List.of(),
                    "depthSlots", List.of(),
                    "minimumDepthSlots", 0,
                    "slotContracts", Map.of()
            );
        }

        List<String> requiredSlots = mappedSlots(taskMeta.requiredSlots(), taskMeta.answerMode());
        List<String> depthSlots = mappedSlots(taskMeta.optionalSlots(), taskMeta.answerMode()).stream()
                .filter(slot -> !requiredSlots.contains(slot))
                .toList();
        LinkedHashSet<String> contractSlots = new LinkedHashSet<>(requiredSlots);
        contractSlots.addAll(depthSlots);
        Map<String, PromptSlotContractDto> configuredContracts = mappedContracts(taskMeta);
        if (!configuredContracts.keySet().equals(contractSlots)) {
            LinkedHashSet<String> missing = new LinkedHashSet<>(contractSlots);
            missing.removeAll(configuredContracts.keySet());
            LinkedHashSet<String> unexpected = new LinkedHashSet<>(configuredContracts.keySet());
            unexpected.removeAll(contractSlots);
            throw new FeedbackContractException(
                    "Question-specific slot contracts do not match configured slots"
                            + " (missing=" + missing + ", unexpected=" + unexpected + ")"
            );
        }
        Map<String, Map<String, String>> slotContracts = new LinkedHashMap<>();
        Map<String, String> glossary = FeedbackSlotCatalog.glossary();
        for (String slot : contractSlots) {
            PromptSlotContractDto configured = configuredContracts.get(slot);
            if (configured == null || !configured.isComplete()) {
                throw new FeedbackContractException(
                        "Question-specific slot contract is incomplete: " + slot
                );
            }
            String definition = glossary.get(slot);
            if (definition == null || definition.isBlank()) {
                throw new FeedbackContractException("Common slot definition is missing: " + slot);
            }
            Map<String, String> slotContract = new LinkedHashMap<>();
            slotContract.put("definition", definition);
            slotContract.put("semanticRole", configured.semanticRoleEn());
            slotContract.put("satisfiedWhen", configured.satisfiedWhenEn());
            slotContracts.put(slot, Map.copyOf(slotContract));
        }

        Map<String, Object> contract = new LinkedHashMap<>();
        contract.put("answerMode", taskMeta.answerMode());
        contract.put("requiredSlots", requiredSlots);
        contract.put("depthSlots", depthSlots);
        contract.put("minimumDepthSlots", taskMeta.minimumDepthSlots());
        contract.put("expectedTense", taskMeta.expectedTense());
        contract.put("expectedPov", taskMeta.expectedPov());
        contract.put("slotContracts", slotContracts);
        return Map.copyOf(contract);
    }

    List<String> allowedSlots(PromptDto prompt) {
        PromptTaskMetaDto taskMeta = prompt == null ? null : prompt.taskMeta();
        if (taskMeta == null) {
            return List.of();
        }
        LinkedHashSet<String> slots = new LinkedHashSet<>(mappedSlots(taskMeta.requiredSlots(), taskMeta.answerMode()));
        slots.addAll(mappedSlots(taskMeta.optionalSlots(), taskMeta.answerMode()));
        return List.copyOf(slots);
    }

    private ContractAssessment verifyAssessment(
            String learnerAnswer,
            String answerMode,
            Set<String> allowedSlots,
            SlotAssessments assessments,
            List<DiagnosedGrammarIssue> grammarIssues
    ) {
        Map<String, SlotAssessmentValue> proposed = assessments == null ? Map.of() : assessments.values();
        if (allowedSlots.isEmpty()) {
            if (!proposed.isEmpty()) {
                throw new FeedbackContractException("Slot data was returned without a slot contract");
            }
            return new ContractAssessment(Map.of());
        }

        Map<String, SlotAssessmentValue> assessmentsBySlot = new LinkedHashMap<>();
        for (Map.Entry<String, SlotAssessmentValue> entry : proposed.entrySet()) {
            String slot = FeedbackSlotCatalog.normalizeSlot(entry.getKey(), answerMode);
            if (slot == null || !allowedSlots.contains(slot)) {
                throw new FeedbackContractException("Unexpected slot assessment: " + entry.getKey());
            }
            SlotAssessmentValue item = entry.getValue();
            if (assessmentsBySlot.putIfAbsent(slot, item) != null) {
                throw new FeedbackContractException("Duplicate normalized slot assessment: " + slot);
            }
        }
        if (!assessmentsBySlot.keySet().equals(allowedSlots)) {
            throw new FeedbackContractException("Every configured slot must be assessed exactly once");
        }

        String normalizedAnswer = normalizeText(learnerAnswer);
        for (Map.Entry<String, SlotAssessmentValue> entry : assessmentsBySlot.entrySet()) {
            String slot = entry.getKey();
            SlotAssessmentValue item = entry.getValue();
            SlotAssessmentStatus status = item.derivedStatus();
            if (status == null) {
                throw new FeedbackContractException(
                        "Slot assessment must contain evidence, or exactly one support item: " + slot
                );
            }
            switch (status) {
                case SATISFIED -> {
                    SlotAssessmentValue restored = restoreGrammarCorrectedEvidence(
                            item,
                            learnerAnswer,
                            normalizedAnswer,
                            grammarIssues
                    );
                    entry.setValue(restored);
                    requireQuotedEvidence(slot, normalizeText(restored.evidence()), normalizedAnswer);
                }
                case GENERIC -> {
                    SlotAssessmentValue restored = restoreGrammarCorrectedEvidence(
                            item,
                            learnerAnswer,
                            normalizedAnswer,
                            grammarIssues
                    );
                    entry.setValue(restored);
                    requireQuotedEvidence(slot, normalizeText(restored.evidence()), normalizedAnswer);
                    requireOneCompleteSupport(slot, restored.support());
                }
                case MISSING -> requireOneCompleteSupport(slot, item.support());
            }
        }
        return new ContractAssessment(Collections.unmodifiableMap(new LinkedHashMap<>(assessmentsBySlot)));
    }

    private SlotAssessmentValue restoreGrammarCorrectedEvidence(
            SlotAssessmentValue assessment,
            String learnerAnswer,
            String normalizedAnswer,
            List<DiagnosedGrammarIssue> grammarIssues
    ) {
        String evidence = assessment.evidence();
        if (normalizedAnswer.contains(normalizeText(evidence))) {
            return assessment;
        }
        if (evidence == null || learnerAnswer == null || grammarIssues == null || grammarIssues.isEmpty()) {
            return assessment;
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        candidates.add(evidence);
        for (DiagnosedGrammarIssue issue : grammarIssues) {
            if (issue == null || issue.originalText() == null || issue.revisedText() == null) {
                continue;
            }
            LinkedHashSet<String> expanded = new LinkedHashSet<>(candidates);
            for (String candidate : candidates) {
                if (occurrenceCount(candidate, issue.revisedText()) == 1) {
                    expanded.add(replaceOnce(candidate, issue.revisedText(), issue.originalText()));
                }
            }
            candidates = expanded;
        }

        List<String> exactOriginalSpans = candidates.stream()
                .filter(candidate -> !candidate.equals(evidence))
                .filter(candidate -> occurrenceCount(learnerAnswer, candidate) == 1)
                .toList();
        if (exactOriginalSpans.size() != 1) {
            return assessment;
        }
        return new SlotAssessmentValue(exactOriginalSpans.get(0), assessment.support());
    }

    private int occurrenceCount(String value, String target) {
        if (value == null || target == null || target.isEmpty()) {
            return 0;
        }
        int count = 0;
        int fromIndex = 0;
        while (fromIndex <= value.length() - target.length()) {
            int index = value.indexOf(target, fromIndex);
            if (index < 0) {
                break;
            }
            count++;
            fromIndex = index + target.length();
        }
        return count;
    }

    private String replaceOnce(String value, String target, String replacement) {
        int index = value.indexOf(target);
        if (index < 0) {
            return value;
        }
        return value.substring(0, index) + replacement + value.substring(index + target.length());
    }

    private void requireQuotedEvidence(String slot, String evidence, String learnerAnswer) {
        if (evidence.isBlank() || !learnerAnswer.contains(evidence)) {
            throw new FeedbackContractException(
                    "SATISFIED or GENERIC requires evidence from the learner answer: " + slot
            );
        }
    }

    private void requireOneCompleteSupport(
            String slot,
            List<SlotFeedbackSupport> support
    ) {
        if (support.size() != 1) {
            throw new FeedbackContractException(
                    "An unresolved slot requires exactly one support item: " + slot
            );
        }
        if (!support.get(0).isComplete()) {
            throw new FeedbackContractException("Incomplete slot support: " + slot);
        }
    }

    private MissionDecision decision(
            MissionKind kind,
            List<String> presentSlots,
            List<String> missingSlots,
            String chosenSlot,
        ContractAssessment assessment
    ) {
        if ((kind == MissionKind.SLOT || kind == MissionKind.TASK_RESET) && chosenSlot != null) {
            SlotAssessmentValue chosenAssessment = assessment.values().get(chosenSlot);
            boolean hasSupport = chosenAssessment != null && chosenAssessment.support().size() == 1;
            if (!hasSupport) {
                throw new FeedbackContractException("The chosen slot has no teaching support: " + chosenSlot);
            }
        }
        return new MissionDecision(
                kind,
                presentSlots,
                missingSlots,
                chosenSlot,
                assessment.values()
        );
    }

    private void verifyDiagnosis(String learnerAnswer, FeedbackDiagnosisResult diagnosis) {
        if (diagnosis.topicAssessment().reasonKo() == null) {
            throw new FeedbackContractException("Topic assessment requires a reason");
        }
        StructureAssessment structure = diagnosis.structureAssessment();
        List<StructureRepair> repairs = structure.repair();
        if (structure.status() == StructureStatus.COMPLETE && !repairs.isEmpty()) {
            throw new FeedbackContractException("COMPLETE structure assessment cannot include a repair");
        }
        if (diagnosis.topicRelevance() == TopicRelevance.OFF_TOPIC && !repairs.isEmpty()) {
            throw new FeedbackContractException("OFF_TOPIC structure assessment cannot include a repair");
        }
        if (diagnosis.topicRelevance() == TopicRelevance.ON_TOPIC
                && structure.status() == StructureStatus.FRAGMENT
                && repairs.size() != 1) {
            throw new FeedbackContractException("FRAGMENT structure assessment requires exactly one repair");
        }
        if (diagnosis.topicRelevance() == TopicRelevance.ON_TOPIC
                && structure.status() == StructureStatus.FRAGMENT
                && !repairs.isEmpty()
                && (repairs.get(0).correctedAnswer() == null
                || repairs.get(0).correctedAnswer().equals(learnerAnswer == null ? null : learnerAnswer.trim()))) {
            throw new FeedbackContractException("FRAGMENT structure assessment requires one distinct corrected answer");
        }
        boolean invalidStructureRepair = repairs.stream()
                .anyMatch(repair -> !repair.isUsableFor(learnerAnswer));
        if (invalidStructureRepair) {
            throw new FeedbackContractException(
                    "Every structure repair requires the complete learner answer, one correction, and an explanation"
            );
        }
        boolean invalidImpact = diagnosis.grammarIssues().stream()
                .anyMatch(issue -> issue.impact() == null || issue.impact() == GrammarImpact.NONE);
        if (invalidImpact) {
            throw new FeedbackContractException(
                    "Every grammar issue requires a LOCAL or BLOCKING impact"
            );
        }
        boolean invalidIssue = diagnosis.grammarIssues().stream()
                .anyMatch(issue -> !issue.isUsableFor(learnerAnswer));
        if (invalidIssue) {
            throw new FeedbackContractException("Every grammar issue must quote an exact learner-answer span");
        }
    }

    private List<String> unresolved(List<String> slots, List<String> presentSlots) {
        return slots.stream().filter(slot -> !presentSlots.contains(slot)).toList();
    }

    private String firstSlot(List<String> requiredSlots, List<String> depthSlots) {
        if (!requiredSlots.isEmpty()) {
            return requiredSlots.get(0);
        }
        return depthSlots.isEmpty() ? null : depthSlots.get(0);
    }

    private List<String> mappedSlots(List<String> taskSlots, String answerMode) {
        if (taskSlots == null || taskSlots.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> mapped = new LinkedHashSet<>();
        for (String taskSlot : taskSlots) {
            String slot = FeedbackSlotCatalog.normalizeSlot(taskSlot, answerMode);
            if (slot != null) {
                mapped.add(slot);
            }
        }
        return List.copyOf(mapped);
    }

    private Map<String, PromptSlotContractDto> mappedContracts(PromptTaskMetaDto taskMeta) {
        Map<String, PromptSlotContractDto> mapped = new LinkedHashMap<>();
        for (Map.Entry<String, PromptSlotContractDto> entry : taskMeta.slotContracts().entrySet()) {
            String slot = FeedbackSlotCatalog.normalizeSlot(entry.getKey(), taskMeta.answerMode());
            if (slot == null) {
                throw new FeedbackContractException(
                        "Question-specific slot contract has an unknown slot: " + entry.getKey()
                );
            }
            if (mapped.putIfAbsent(slot, entry.getValue()) != null) {
                throw new FeedbackContractException(
                        "Question-specific slot contracts normalize to a duplicate slot: " + slot
                );
            }
        }
        return Collections.unmodifiableMap(mapped);
    }

    private String normalizeText(String value) {
        return value == null
                ? ""
                : value.toLowerCase(Locale.ROOT).replace('\u2019', '\'').replaceAll("\\s+", " ").trim();
    }

    private record ContractAssessment(
            Map<String, SlotAssessmentValue> values
    ) {
    }
}

final class FeedbackContractException extends IllegalStateException {
    FeedbackContractException(String message) {
        super(message);
    }
}
