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
        String skeletonEn,
        String skeletonKo,
        List<FeedbackSuggestedPhraseDto> suggestedPhrases,
        String placeholderEn,
        String successCheckKo,
        List<FeedbackLanguageCorrectionDto> languageCorrections
) {
    public FeedbackCoachMissionDto {
        missionType = normalize(missionType);
        title = normalize(title);
        originalText = normalize(originalText);
        revisedText = normalize(revisedText);
        whyKo = normalize(whyKo);
        instructionKo = normalize(instructionKo);
        skeletonEn = normalize(skeletonEn);
        skeletonKo = normalize(skeletonKo);
        suggestedPhrases = normalizePhrases(suggestedPhrases);
        placeholderEn = normalize(placeholderEn);
        successCheckKo = normalize(successCheckKo);
        languageCorrections = normalizeLanguageCorrections(languageCorrections);
    }

    public FeedbackCoachMoveDto toCoachMove() {
        return toCoachMove(null);
    }

    public FeedbackCoachMoveDto toCoachMove(String targetSlot) {
        boolean hasComparisonPair = isComparisonMission(missionType)
                && originalText != null
                && revisedText != null;
        boolean directCorrection = isDirectCorrectionMission(missionType);
        return new FeedbackCoachMoveDto(
                title,
                missionType,
                whyKo,
                hasComparisonPair ? originalText : null,
                hasComparisonPair ? revisedText : null,
                instructionKo,
                directCorrection ? null : skeletonEn,
                directCorrection ? null : skeletonKo,
                directCorrection ? List.of() : suggestedPhrases,
                null,
                targetSlot,
                languageCorrections
        );
    }

    public FeedbackRewriteWorkspaceDto toRewriteWorkspace(String seedText) {
        return new FeedbackRewriteWorkspaceDto(
                seedText,
                firstNonBlank(placeholderEn, skeletonEn, revisedText),
                true
        );
    }

    private static boolean isComparisonMission(String missionType) {
        String normalized = normalize(missionType);
        if (normalized == null) {
            return false;
        }

        return switch (normalized.toUpperCase()) {
            case "MICRO_FIX", "LANGUAGE_FIX", "STRUCTURE_FIX", "GRAMMAR_FIX", "FIX_LOCAL_GRAMMAR", "FIX_BLOCKING_GRAMMAR", "EXPRESSION_POLISH" -> true;
            default -> false;
        };
    }

    private static boolean isDirectCorrectionMission(String missionType) {
        String normalized = normalize(missionType);
        if (normalized == null) {
            return false;
        }

        return switch (normalized.toUpperCase()) {
            case "MICRO_FIX",
                    "LANGUAGE_FIX",
                    "STRUCTURE_FIX",
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

    private static List<FeedbackLanguageCorrectionDto> normalizeLanguageCorrections(
            List<FeedbackLanguageCorrectionDto> values
    ) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }

        return values.stream()
                .filter(value -> value != null && value.kind() != null)
                .limit(25)
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
