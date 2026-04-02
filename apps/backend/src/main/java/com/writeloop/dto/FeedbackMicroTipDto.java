package com.writeloop.dto;

public record FeedbackMicroTipDto(
        String title,
        String originalText,
        String revisedText,
        String reasonKo
) {
    public FeedbackMicroTipDto {
        title = title == null ? "" : title.trim();
        originalText = originalText == null || originalText.isBlank() ? null : originalText.trim();
        revisedText = revisedText == null || revisedText.isBlank() ? null : revisedText.trim();
        reasonKo = reasonKo == null || reasonKo.isBlank() ? null : reasonKo.trim();
    }
}
