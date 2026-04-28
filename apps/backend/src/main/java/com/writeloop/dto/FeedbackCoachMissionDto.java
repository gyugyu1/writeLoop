package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackCoachMissionDto(
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
    public FeedbackCoachMissionDto {
        missionType = normalize(missionType);
        title = normalize(title);
        originalText = normalize(originalText);
        revisedText = normalize(revisedText);
        whyKo = normalize(whyKo);
        instructionKo = normalize(instructionKo);
        exampleEn = normalize(exampleEn);
        placeholderEn = normalize(placeholderEn);
        targetHintKo = normalize(targetHintKo);
        successCheckKo = normalize(successCheckKo);
    }

    public FeedbackCoachMoveDto toCoachMove() {
        boolean hasComparisonPair = isComparisonMission(missionType)
                && originalText != null
                && revisedText != null;
        return new FeedbackCoachMoveDto(
                title,
                missionType,
                whyKo,
                hasComparisonPair ? originalText : null,
                hasComparisonPair ? revisedText : null,
                instructionKo,
                successCheckKo
        );
    }

    public FeedbackRewriteWorkspaceDto toRewriteWorkspace(String seedText) {
        return new FeedbackRewriteWorkspaceDto(
                seedText,
                firstNonBlank(placeholderEn, revisedText, exampleEn),
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

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
