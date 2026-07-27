package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackCoachMoveDto(
        String focus,
        String focusType,
        String why,
        String before,
        String after,
        String instruction,
        String exampleEn,
        String skeletonEn,
        String skeletonKo,
        List<FeedbackSuggestedPhraseDto> suggestedPhrases,
        String successCheck,
        String targetSlot,
        List<FeedbackLanguageCorrectionDto> languageCorrections
) {
    public FeedbackCoachMoveDto {
        focus = normalize(focus);
        focusType = normalize(focusType);
        why = normalize(why);
        before = normalize(before);
        after = normalize(after);
        instruction = normalize(instruction);
        exampleEn = normalize(exampleEn);
        skeletonEn = normalize(skeletonEn);
        skeletonKo = normalize(skeletonKo);
        suggestedPhrases = normalizePhrases(suggestedPhrases);
        successCheck = normalize(successCheck);
        targetSlot = normalize(targetSlot);
        languageCorrections = normalizeLanguageCorrections(languageCorrections);
    }

    public FeedbackCoachMoveDto(
            String focus,
            String focusType,
            String why,
            String before,
            String after,
            String instruction,
            String exampleEn,
            String skeletonEn,
            String skeletonKo,
            List<FeedbackSuggestedPhraseDto> suggestedPhrases,
            String successCheck
    ) {
        this(
                focus,
                focusType,
                why,
                before,
                after,
                instruction,
                exampleEn,
                skeletonEn,
                skeletonKo,
                suggestedPhrases,
                successCheck,
                null,
                List.of()
        );
    }

    public FeedbackCoachMoveDto(
            String focus,
            String focusType,
            String why,
            String before,
            String after,
            String instruction,
            String exampleEn,
            String skeletonEn,
            String skeletonKo,
            List<FeedbackSuggestedPhraseDto> suggestedPhrases,
            String successCheck,
            String targetSlot
    ) {
        this(
                focus,
                focusType,
                why,
                before,
                after,
                instruction,
                exampleEn,
                skeletonEn,
                skeletonKo,
                suggestedPhrases,
                successCheck,
                targetSlot,
                List.of()
        );
    }

    public FeedbackCoachMoveDto(
            String focus,
            String focusType,
            String why,
            String before,
            String after,
            String instruction,
            String exampleEn,
            String skeletonEn,
            List<FeedbackSuggestedPhraseDto> suggestedPhrases,
            String successCheck
    ) {
        this(focus, focusType, why, before, after, instruction, exampleEn, skeletonEn, null, suggestedPhrases, successCheck, null, List.of());
    }

    public FeedbackCoachMoveDto(
            String focus,
            String focusType,
            String why,
            String before,
            String after,
            String instruction,
            String exampleEn,
            String successCheck
    ) {
        this(focus, focusType, why, before, after, instruction, exampleEn, null, null, List.of(), successCheck, null, List.of());
    }

    public FeedbackCoachMoveDto(
            String focus,
            String focusType,
            String why,
            String before,
            String after,
            String instruction,
            String successCheck
    ) {
        this(focus, focusType, why, before, after, instruction, null, null, null, List.of(), successCheck, null, List.of());
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
