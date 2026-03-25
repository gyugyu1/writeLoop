package com.writeloop.dto;

public record InlineFeedbackSegmentDto(
        String type,
        String originalText,
        String revisedText
) {
    public InlineFeedbackSegmentDto {
        type = type == null ? "" : type.trim().toUpperCase();
        originalText = originalText == null ? "" : originalText;
        revisedText = revisedText == null ? "" : revisedText;
    }
}
