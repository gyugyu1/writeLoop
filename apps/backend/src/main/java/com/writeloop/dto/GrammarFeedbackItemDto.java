package com.writeloop.dto;

public record GrammarFeedbackItemDto(
        String originalText,
        String revisedText,
        String reasonKo
) {
    public GrammarFeedbackItemDto {
        originalText = originalText == null ? "" : originalText;
        revisedText = revisedText == null ? "" : revisedText;
        reasonKo = reasonKo == null ? "" : reasonKo.trim();
    }
}
