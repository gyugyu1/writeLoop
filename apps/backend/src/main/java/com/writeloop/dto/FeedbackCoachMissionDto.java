package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackCoachMissionDto(
        String missionType,
        String title,
        String originalText,
        String revisedText,
        String whyKo,
        String instructionKo,
        String exampleEn,
        String skeletonEn,
        String skeletonKo,
        List<FeedbackSuggestedPhraseDto> suggestedPhrases,
        String placeholderEn,
        String targetHintKo,
        String successCheckKo
) {
    public FeedbackCoachMissionDto(
            String missionType,
            String title,
            String originalText,
            String revisedText,
            String whyKo,
            String instructionKo,
            String exampleEn,
            String placeholderEn,
            String targetHintKo,
            String successCheckKo
    ) {
        this(
                missionType,
                title,
                originalText,
                revisedText,
                whyKo,
                instructionKo,
                exampleEn,
                firstNonBlank(placeholderEn, revisedText, exampleEn),
                null,
                List.of(),
                placeholderEn,
                targetHintKo,
                successCheckKo
        );
    }

    public FeedbackCoachMissionDto(
            String missionType,
            String title,
            String originalText,
            String revisedText,
            String whyKo,
            String instructionKo,
            String exampleEn,
            String skeletonEn,
            List<FeedbackSuggestedPhraseDto> suggestedPhrases,
            String placeholderEn,
            String targetHintKo,
            String successCheckKo
    ) {
        this(
                missionType,
                title,
                originalText,
                revisedText,
                whyKo,
                instructionKo,
                exampleEn,
                skeletonEn,
                null,
                suggestedPhrases,
                placeholderEn,
                targetHintKo,
                successCheckKo
        );
    }

    public FeedbackCoachMissionDto {
        missionType = normalize(missionType);
        title = normalize(title);
        originalText = normalize(originalText);
        revisedText = normalize(revisedText);
        whyKo = normalize(whyKo);
        instructionKo = normalize(instructionKo);
        exampleEn = normalize(exampleEn);
        skeletonEn = normalize(skeletonEn);
        skeletonKo = normalize(skeletonKo);
        suggestedPhrases = normalizePhrases(suggestedPhrases);
        placeholderEn = normalize(placeholderEn);
        targetHintKo = normalize(targetHintKo);
        successCheckKo = normalize(successCheckKo);
    }

    public FeedbackCoachMoveDto toCoachMove() {
        boolean hasComparisonPair = isComparisonMission(missionType)
                && originalText != null
                && revisedText != null;
        boolean grammarCorrection = isGrammarCorrectionMission(missionType);
        return new FeedbackCoachMoveDto(
                title,
                missionType,
                whyKo,
                hasComparisonPair ? originalText : null,
                hasComparisonPair ? revisedText : null,
                instructionKo,
                grammarCorrection ? null : exampleEn,
                grammarCorrection ? null : skeletonEn,
                grammarCorrection ? null : skeletonKo,
                grammarCorrection ? List.of() : suggestedPhrases,
                null
        );
    }

    public FeedbackRewriteWorkspaceDto toRewriteWorkspace(String seedText) {
        return new FeedbackRewriteWorkspaceDto(
                seedText,
                firstNonBlank(placeholderEn, skeletonEn, revisedText),
                targetHintKo,
                true
        );
    }

    private static boolean isComparisonMission(String missionType) {
        String normalized = normalize(missionType);
        if (normalized == null) {
            return false;
        }

        return switch (normalized.toUpperCase()) {
            case "MICRO_FIX", "GRAMMAR_FIX", "FIX_LOCAL_GRAMMAR", "FIX_BLOCKING_GRAMMAR", "EXPRESSION_POLISH" -> true;
            default -> false;
        };
    }

    private static boolean isGrammarCorrectionMission(String missionType) {
        String normalized = normalize(missionType);
        if (normalized == null) {
            return false;
        }

        return switch (normalized.toUpperCase()) {
            case "MICRO_FIX",
                    "GRAMMAR",
                    "GRAMMAR_FIX",
                    "LOCAL_GRAMMAR",
                    "FIX_LOCAL_GRAMMAR",
                    "BLOCKING_GRAMMAR",
                    "FIX_BLOCKING_GRAMMAR",
                    "EXPRESSION",
                    "EXPRESSION_POLISH" -> true;
            default -> false;
        };
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private static List<FeedbackSuggestedPhraseDto> normalizePhrases(List<FeedbackSuggestedPhraseDto> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }

        return values.stream()
                .filter(value -> value != null && value.phrase() != null)
                .distinct()
                .limit(6)
                .toList();
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
