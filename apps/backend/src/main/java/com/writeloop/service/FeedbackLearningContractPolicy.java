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

    private static final int MAX_LANGUAGE_CORRECTIONS = 25;

    MissionDecision resolve(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            SlotAssessments assessments
    ) {
        return resolveContract(prompt, learnerAnswer, diagnosis, assessments).decision();
    }

    LearningContractResolution resolveContract(
            PromptDto prompt,
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis,
            SlotAssessments assessments
    ) {
        if (diagnosis == null) {
            throw new FeedbackContractException("The LLM response did not include a diagnosis");
        }
        ValidatedLanguageRevision languageRevision = verifyDiagnosis(learnerAnswer, diagnosis);

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
                languageRevision.corrections()
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
            return resolution(
                    decision(
                            MissionKind.TASK_RESET,
                            presentSlots,
                            missingSlots,
                            target,
                            verified
                    ),
                    diagnosis,
                    languageRevision
            );
        }
        if (diagnosis.structureAssessment().status() == StructureStatus.FRAGMENT) {
            return resolution(
                    decision(MissionKind.LANGUAGE_FIX, presentSlots, missingSlots, null, verified),
                    diagnosis,
                    languageRevision
            );
        }
        if (diagnosis.strongestGrammarImpact() == GrammarImpact.BLOCKING) {
            return resolution(
                    decision(MissionKind.LANGUAGE_FIX, presentSlots, missingSlots, null, verified),
                    diagnosis,
                    languageRevision
            );
        }
        if (!unresolvedRequired.isEmpty()) {
            return resolution(
                    decision(MissionKind.SLOT, presentSlots, missingSlots, unresolvedRequired.get(0), verified),
                    diagnosis,
                    languageRevision
            );
        }
        if (diagnosis.strongestGrammarImpact() == GrammarImpact.LOCAL) {
            return resolution(
                    decision(MissionKind.LANGUAGE_FIX, presentSlots, missingSlots, null, verified),
                    diagnosis,
                    languageRevision
            );
        }
        if (!unresolvedDepth.isEmpty()) {
            return resolution(
                    decision(MissionKind.SLOT, presentSlots, missingSlots, unresolvedDepth.get(0), verified),
                    diagnosis,
                    languageRevision
            );
        }
        return resolution(
                decision(MissionKind.COMPLETE, presentSlots, List.of(), null, verified),
                diagnosis,
                languageRevision
        );
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
            List<ValidatedLanguageCorrection> languageCorrections
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
                    SlotAssessmentValue restored = restoreLanguageCorrectedEvidence(
                            item,
                            learnerAnswer,
                            normalizedAnswer,
                            languageCorrections
                    );
                    entry.setValue(restored);
                    requireQuotedEvidence(slot, normalizeText(restored.evidence()), normalizedAnswer);
                }
                case GENERIC -> {
                    SlotAssessmentValue restored = restoreLanguageCorrectedEvidence(
                            item,
                            learnerAnswer,
                            normalizedAnswer,
                            languageCorrections
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

    private SlotAssessmentValue restoreLanguageCorrectedEvidence(
            SlotAssessmentValue assessment,
            String learnerAnswer,
            String normalizedAnswer,
            List<ValidatedLanguageCorrection> languageCorrections
    ) {
        String evidence = assessment.evidence();
        if (normalizedAnswer.contains(normalizeText(evidence))) {
            return assessment;
        }
        if (evidence == null
                || learnerAnswer == null
                || languageCorrections == null
                || languageCorrections.isEmpty()) {
            return assessment;
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        candidates.add(evidence);
        for (int index = languageCorrections.size() - 1; index >= 0; index--) {
            ValidatedLanguageCorrection correction = languageCorrections.get(index);
            if (correction == null) {
                continue;
            }
            String originalText = correction.edit().displayOriginalText();
            String revisedText = correction.edit().displayRevisedText();
            if (originalText.isEmpty() || revisedText.isEmpty()) {
                continue;
            }
            LinkedHashSet<String> expanded = new LinkedHashSet<>(candidates);
            for (String candidate : candidates) {
                if (occurrenceCount(candidate, revisedText) == 1) {
                    expanded.add(replaceOnce(candidate, revisedText, originalText));
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

    private LearningContractResolution resolution(
            MissionDecision decision,
            FeedbackDiagnosisResult diagnosis,
            ValidatedLanguageRevision languageRevision
    ) {
        return new LearningContractResolution(
                decision,
                diagnosis,
                languageRevision.revisedAnswer(),
                languageRevision.corrections()
        );
    }

    private ValidatedLanguageRevision verifyDiagnosis(
            String learnerAnswer,
            FeedbackDiagnosisResult diagnosis
    ) {
        if (diagnosis.topicAssessment().reasonKo() == null) {
            throw new FeedbackContractException("Topic assessment requires a reason");
        }
        String sourceAnswer = learnerAnswer == null ? "" : learnerAnswer.trim();
        StructureAssessment structure = diagnosis.structureAssessment();
        LanguageAssessment language = diagnosis.languageAssessment();
        List<LanguageRevisionStep> steps = language.revisionSteps();
        if (steps.size() > MAX_LANGUAGE_CORRECTIONS) {
            throw languageRevisionViolation(
                    "languageAssessment.revisionSteps may contain at most "
                            + MAX_LANGUAGE_CORRECTIONS
                            + " correction steps"
            );
        }
        if (steps.stream().anyMatch(step -> !step.isComplete())) {
            throw languageRevisionViolation(
                    "Every revision step requires kind, answerAfter, and reasonKo"
            );
        }

        if (diagnosis.topicRelevance() == TopicRelevance.OFF_TOPIC) {
            if (structure.status() != StructureStatus.COMPLETE) {
                throw languageRevisionViolation(
                        "OFF_TOPIC answers must use COMPLETE structure status"
                );
            }
            if (!steps.isEmpty()) {
                throw languageRevisionViolation(
                        "OFF_TOPIC answers cannot include language revision steps"
                );
            }
            return new ValidatedLanguageRevision(sourceAnswer, List.of());
        }

        List<ValidatedLanguageCorrection> corrections = new ArrayList<>();
        List<ProtectedRevisionRange> protectedRanges = new ArrayList<>();
        String currentAnswer = sourceAnswer;
        int previousPriority = -1;

        for (int index = 0; index < steps.size(); index++) {
            LanguageRevisionStep step = steps.get(index);
            int priority = languagePriority(step.kind());
            if (priority < previousPriority) {
                throw languageRevisionViolation(
                        "Revision steps must be ordered STRUCTURE, GRAMMAR_BLOCKING, then GRAMMAR_LOCAL"
                );
            }
            FeedbackRevisionDiff displayDiff = FeedbackRevisionDiffSupport.compare(
                    currentAnswer,
                    step.answerAfter()
            );
            FeedbackRevisionDiff validationDiff = FeedbackRevisionDiffSupport.compareForValidation(
                    currentAnswer,
                    step.answerAfter()
            );
            if (validationDiff.edits().isEmpty()) {
                throw languageRevisionViolation(
                        "Every revision step must change the complete answer from the previous step"
                );
            }
            LanguageRevisionEdit combinedEdit = FeedbackRevisionDiffSupport.enclosingEdit(
                    currentAnswer,
                    step.answerAfter(),
                    displayDiff
            );
            if (protectedRanges.stream().anyMatch(range -> validationDiff.edits().stream()
                    .anyMatch(edit -> overlaps(range, edit)))) {
                throw languageRevisionViolation(
                        "A later revision step cannot change or revert text corrected by an earlier step"
                );
            }

            protectedRanges = advanceProtectedRanges(protectedRanges, validationDiff.edits());
            for (LanguageRevisionEdit edit : validationDiff.edits()) {
                protectedRanges.add(new ProtectedRevisionRange(
                        edit.revisedStart(),
                        edit.revisedEnd()
                ));
            }
            corrections.add(new ValidatedLanguageCorrection(step, combinedEdit, index));
            currentAnswer = step.answerAfter();
            previousPriority = priority;
        }

        boolean hasStructureStep = steps.stream()
                .anyMatch(step -> step.kind() == LanguageIssueKind.STRUCTURE);
        if (structure.status() == StructureStatus.FRAGMENT && !hasStructureStep) {
            throw languageRevisionViolation(
                    "FRAGMENT structure assessment requires at least one STRUCTURE revision step"
            );
        }
        if (structure.status() == StructureStatus.COMPLETE && hasStructureStep) {
            throw languageRevisionViolation(
                    "COMPLETE structure assessment cannot include a STRUCTURE revision step"
            );
        }
        if (structure.status() == StructureStatus.FRAGMENT && corrections.isEmpty()) {
            throw languageRevisionViolation(
                    "FRAGMENT structure assessment requires at least one answer revision"
            );
        }
        return new ValidatedLanguageRevision(currentAnswer, List.copyOf(corrections));
    }

    private int languagePriority(LanguageIssueKind kind) {
        return switch (kind) {
            case STRUCTURE -> 0;
            case GRAMMAR_BLOCKING -> 1;
            case GRAMMAR_LOCAL -> 2;
        };
    }

    private boolean overlaps(ProtectedRevisionRange protectedRange, LanguageRevisionEdit edit) {
        int editStart = edit.sourceStart();
        int editEnd = edit.sourceEnd();
        if (protectedRange.start() == protectedRange.end() && editStart == editEnd) {
            return protectedRange.start() == editStart;
        }
        if (editStart == editEnd) {
            return editStart > protectedRange.start() && editStart < protectedRange.end();
        }
        if (protectedRange.start() == protectedRange.end()) {
            return protectedRange.start() > editStart && protectedRange.start() < editEnd;
        }
        return editStart < protectedRange.end() && editEnd > protectedRange.start();
    }

    private List<ProtectedRevisionRange> advanceProtectedRanges(
            List<ProtectedRevisionRange> ranges,
            List<LanguageRevisionEdit> edits
    ) {
        List<ProtectedRevisionRange> advanced = new ArrayList<>();
        for (ProtectedRevisionRange range : ranges) {
            int delta = edits.stream()
                    .filter(edit -> edit.sourceEnd() <= range.start())
                    .mapToInt(edit -> (edit.revisedEnd() - edit.revisedStart())
                            - (edit.sourceEnd() - edit.sourceStart()))
                    .sum();
            advanced.add(new ProtectedRevisionRange(
                    range.start() + delta,
                    range.end() + delta
            ));
        }
        return advanced;
    }

    private FeedbackContractException languageRevisionViolation(String message) {
        return new FeedbackContractException(message, false);
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

    private record ProtectedRevisionRange(
            int start,
            int end
    ) {
    }

}

record LearningContractResolution(
        MissionDecision decision,
        FeedbackDiagnosisResult diagnosis,
        String revisedAnswer,
        List<ValidatedLanguageCorrection> languageCorrections
) {
    LearningContractResolution {
        revisedAnswer = revisedAnswer == null ? null : revisedAnswer.trim();
        languageCorrections = languageCorrections == null ? List.of() : List.copyOf(languageCorrections);
    }
}

record ValidatedLanguageCorrection(
        LanguageRevisionStep step,
        LanguageRevisionEdit edit,
        int stepIndex
) {
}

record ValidatedLanguageRevision(
        String revisedAnswer,
        List<ValidatedLanguageCorrection> corrections
) {
    ValidatedLanguageRevision {
        revisedAnswer = revisedAnswer == null ? null : revisedAnswer.trim();
        corrections = corrections == null ? List.of() : List.copyOf(corrections);
    }
}

class FeedbackContractException extends IllegalStateException {

    private final boolean retryable;

    FeedbackContractException(String message) {
        this(message, true);
    }

    FeedbackContractException(String message, boolean retryable) {
        super(message);
        this.retryable = retryable;
    }

    boolean retryable() {
        return retryable;
    }
}
