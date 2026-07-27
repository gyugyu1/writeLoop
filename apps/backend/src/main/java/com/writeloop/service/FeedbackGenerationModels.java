package com.writeloop.service;

import com.writeloop.dto.CoachExpressionUsageDto;
import com.writeloop.dto.FeedbackCoachMissionDto;
import com.writeloop.dto.FeedbackSuggestedPhraseDto;
import com.writeloop.dto.RefinementExpressionDto;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

enum TopicRelevance {
    ON_TOPIC,
    OFF_TOPIC;

    static TopicRelevance fromCode(String value) {
        if (value == null || value.isBlank()) {
            return OFF_TOPIC;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return OFF_TOPIC;
        }
    }
}

enum StructureStatus {
    COMPLETE,
    FRAGMENT;

    static StructureStatus fromCode(String value) {
        if (value == null || value.isBlank()) {
            return FRAGMENT;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return FRAGMENT;
        }
    }
}

enum GrammarImpact {
    NONE,
    LOCAL,
    BLOCKING;

    static GrammarImpact fromCode(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

}

enum LanguageIssueKind {
    STRUCTURE,
    GRAMMAR_BLOCKING,
    GRAMMAR_LOCAL;

    static LanguageIssueKind fromCode(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    GrammarImpact grammarImpact() {
        return switch (this) {
            case GRAMMAR_BLOCKING -> GrammarImpact.BLOCKING;
            case GRAMMAR_LOCAL -> GrammarImpact.LOCAL;
            case STRUCTURE -> GrammarImpact.NONE;
        };
    }
}

record LanguageRevisionStep(
        LanguageIssueKind kind,
        String code,
        String answerAfter,
        String reasonKo,
        String instructionKo
) {
    LanguageRevisionStep(
            String kind,
            String code,
            String answerAfter,
            String reasonKo,
            String instructionKo
    ) {
        this(LanguageIssueKind.fromCode(kind), code, answerAfter, reasonKo, instructionKo);
    }

    LanguageRevisionStep {
        code = normalizeCode(code);
        answerAfter = normalize(answerAfter);
        reasonKo = normalize(reasonKo);
        instructionKo = normalize(instructionKo);
    }

    boolean isComplete() {
        return kind != null
                && code != null
                && answerAfter != null
                && reasonKo != null
                && instructionKo != null;
    }

    private static String normalizeCode(String value) {
        String normalized = normalize(value);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT).replace('-', '_');
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

record LanguageAssessment(
        List<LanguageRevisionStep> revisionSteps
) {
    LanguageAssessment {
        revisionSteps = revisionSteps == null
                ? List.of()
                : revisionSteps.stream().filter(step -> step != null).toList();
    }
}

record StructureAssessment(
        StructureStatus status
) {
    StructureAssessment(String status) {
        this(StructureStatus.fromCode(status));
    }

    StructureAssessment {
        status = status == null ? StructureStatus.FRAGMENT : status;
    }
}

record TopicAssessment(
        TopicRelevance status,
        String reasonKo
) {
    TopicAssessment {
        status = status == null ? TopicRelevance.OFF_TOPIC : status;
        reasonKo = reasonKo == null || reasonKo.isBlank() ? null : reasonKo.trim();
    }
}

record FeedbackDiagnosisResult(
        TopicAssessment topicAssessment,
        StructureAssessment structureAssessment,
        LanguageAssessment languageAssessment
) {
    FeedbackDiagnosisResult {
        topicAssessment = topicAssessment == null
                ? new TopicAssessment(TopicRelevance.OFF_TOPIC, null)
                : topicAssessment;
        structureAssessment = structureAssessment == null
                ? new StructureAssessment(StructureStatus.FRAGMENT)
                : structureAssessment;
        languageAssessment = languageAssessment == null
                ? new LanguageAssessment(List.of())
                : languageAssessment;
    }

    TopicRelevance topicRelevance() {
        return topicAssessment.status();
    }

    GrammarImpact strongestGrammarImpact() {
        GrammarImpact strongest = GrammarImpact.NONE;
        for (LanguageRevisionStep step : languageAssessment.revisionSteps()) {
            if (step.kind() == null) {
                continue;
            }
            GrammarImpact impact = step.kind().grammarImpact();
            if (impact.ordinal() > strongest.ordinal()) {
                strongest = impact;
            }
        }
        return strongest;
    }

}

enum SlotAssessmentStatus {
    SATISFIED,
    GENERIC,
    MISSING
}

record SlotAssessmentValue(
        String evidence,
        List<SlotFeedbackSupport> support
) {
    SlotAssessmentValue {
        evidence = normalize(evidence);
        support = support == null
                ? List.of()
                : support.stream().filter(item -> item != null).toList();
    }

    SlotAssessmentStatus derivedStatus() {
        if (evidence != null && support.isEmpty()) {
            return SlotAssessmentStatus.SATISFIED;
        }
        if (evidence != null && support.size() == 1) {
            return SlotAssessmentStatus.GENERIC;
        }
        if (evidence == null && support.size() == 1) {
            return SlotAssessmentStatus.MISSING;
        }
        return null;
    }

    boolean isSatisfied() {
        return derivedStatus() == SlotAssessmentStatus.SATISFIED;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

record SlotFeedbackSupport(
        String title,
        String whyKo,
        String instructionKo,
        String exampleEn,
        String skeletonEn,
        String skeletonKo,
        List<FeedbackSuggestedPhraseDto> suggestedPhrases,
        String targetHintKo
) {
    SlotFeedbackSupport {
        title = normalize(title);
        whyKo = normalize(whyKo);
        instructionKo = normalize(instructionKo);
        exampleEn = normalize(exampleEn);
        skeletonEn = normalize(skeletonEn);
        skeletonKo = normalize(skeletonKo);
        suggestedPhrases = suggestedPhrases == null
                ? List.of()
                : suggestedPhrases.stream()
                .filter(item -> item != null && item.phrase() != null)
                .distinct()
                .limit(4)
                .toList();
        targetHintKo = normalize(targetHintKo);
    }

    boolean isComplete() {
        return title != null
                && whyKo != null
                && instructionKo != null
                && exampleEn != null
                && skeletonEn != null
                && skeletonKo != null
                && suggestedPhrases.size() >= 2
                && targetHintKo != null;
    }

    FeedbackCoachMissionDto toCoachMission(String missionType) {
        return new FeedbackCoachMissionDto(
                missionType,
                title,
                null,
                null,
                whyKo,
                instructionKo,
                exampleEn,
                skeletonEn,
                skeletonKo,
                suggestedPhrases,
                skeletonEn,
                targetHintKo,
                null
        );
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

enum MissionKind {
    SLOT,
    TASK_RESET,
    LANGUAGE_FIX,
    COMPLETE
}

record SlotAssessments(
        Map<String, SlotAssessmentValue> values
) {
    SlotAssessments {
        Map<String, SlotAssessmentValue> normalized = new LinkedHashMap<>();
        if (values != null) {
            values.forEach((slot, assessment) -> {
                if (slot != null && assessment != null) {
                    normalized.put(slot, assessment);
                }
            });
        }
        values = Collections.unmodifiableMap(normalized);
    }
}

record MissionDecision(
        MissionKind missionKind,
        List<String> presentSlots,
        List<String> missingSlots,
        String chosenSlot,
        Map<String, SlotAssessmentValue> slotAssessments
) {
    MissionDecision {
        presentSlots = normalizeSlots(presentSlots);
        missingSlots = normalizeSlots(missingSlots);
        chosenSlot = normalizeCode(chosenSlot);
        slotAssessments = slotAssessments == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(slotAssessments));
    }

    boolean isComplete() {
        return missionKind == MissionKind.COMPLETE;
    }

    private static List<String> normalizeSlots(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .map(MissionDecision::normalizeCode)
                .filter(value -> value != null)
                .distinct()
                .toList();
    }

    private static String normalizeCode(String value) {
        return value == null || value.isBlank()
                ? null
                : value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replaceAll("\\s+", "_");
    }
}

record GeneratedContent(
        List<String> strengths,
        List<RefinementExpressionDto> refinementExpressions,
        List<CoachExpressionUsageDto> usedExpressions,
        String modelAnswer,
        String modelAnswerKo
) {
    GeneratedContent {
        strengths = strengths == null ? List.of() : strengths.stream().filter(value -> value != null).limit(1).toList();
        refinementExpressions = refinementExpressions == null
                ? List.of()
                : refinementExpressions.stream().filter(value -> value != null).limit(3).toList();
        usedExpressions = usedExpressions == null
                ? List.of()
                : usedExpressions.stream().filter(value -> value != null).limit(3).toList();
        modelAnswer = normalize(modelAnswer);
        modelAnswerKo = normalize(modelAnswerKo);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

record GeneratedSections(
        List<String> strengths,
        List<RefinementExpressionDto> refinementExpressions,
        List<CoachExpressionUsageDto> usedExpressions,
        String modelAnswer,
        String modelAnswerKo,
        MissionDecision missionDecision,
        FeedbackCoachMissionDto coachMission
) {
    GeneratedSections {
        strengths = strengths == null ? List.of() : strengths.stream().filter(value -> value != null).limit(1).toList();
        refinementExpressions = refinementExpressions == null
                ? List.of()
                : refinementExpressions.stream().filter(value -> value != null).limit(3).toList();
        usedExpressions = usedExpressions == null
                ? List.of()
                : usedExpressions.stream().filter(value -> value != null).limit(3).toList();
        modelAnswer = normalize(modelAnswer);
        modelAnswerKo = normalize(modelAnswerKo);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
