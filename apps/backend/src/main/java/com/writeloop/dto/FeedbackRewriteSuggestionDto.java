package com.writeloop.dto;

public record FeedbackRewriteSuggestionDto(
        String english,
        String meaningKo,
        String noteKo
) {
    public FeedbackRewriteSuggestionDto {
        english = english == null ? "" : english.trim();
        meaningKo = meaningKo == null || meaningKo.isBlank() ? null : meaningKo.trim();
        noteKo = noteKo == null || noteKo.isBlank() ? null : noteKo.trim();
    }
}
