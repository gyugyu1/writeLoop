package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonCreator;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record FeedbackSuggestedPhraseDto(
        String phrase,
        String meaningKo
) {
    public FeedbackSuggestedPhraseDto {
        phrase = normalize(phrase);
        meaningKo = normalize(meaningKo);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public FeedbackSuggestedPhraseDto(String phrase) {
        this(phrase, null);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
