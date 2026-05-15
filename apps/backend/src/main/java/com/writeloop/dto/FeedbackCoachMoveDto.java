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
        String successCheck
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
        this(focus, focusType, why, before, after, instruction, exampleEn, skeletonEn, null, suggestedPhrases, successCheck);
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
        this(focus, focusType, why, before, after, instruction, exampleEn, null, null, List.of(), successCheck);
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
        this(focus, focusType, why, before, after, instruction, null, null, null, List.of(), successCheck);
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
