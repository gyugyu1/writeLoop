package com.writeloop.dto;

public record FeedbackPrimaryFixDto(
        String title,
        String instruction,
        String originalText,
        String revisedText,
        String reasonKo
) {
    public FeedbackPrimaryFixDto {
        title = title == null ? "" : title.trim();
        instruction = instruction == null || instruction.isBlank() ? null : instruction.trim();
        originalText = originalText == null || originalText.isBlank() ? null : originalText.trim();
        revisedText = revisedText == null || revisedText.isBlank() ? null : revisedText.trim();
        reasonKo = reasonKo == null || reasonKo.isBlank() ? null : reasonKo.trim();
    }
}
