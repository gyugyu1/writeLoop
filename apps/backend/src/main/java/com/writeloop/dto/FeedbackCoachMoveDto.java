package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
@JsonIgnoreProperties(ignoreUnknown = true)
public record FeedbackCoachMoveDto(
        String focus,
        String focusType,
        String why,
        String before,
        String after,
        String instruction,
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
        skeletonEn = normalize(skeletonEn);
        skeletonKo = normalize(skeletonKo);
        suggestedPhrases = normalizePhrases(suggestedPhrases);
        successCheck = normalize(successCheck);
        targetSlot = normalize(targetSlot);
        languageCorrections = normalizeLanguageCorrections(languageCorrections);
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
