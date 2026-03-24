package com.writeloop.dto;

public record InlineFeedbackSegmentDto(
        String type,
        String originalText,
        String revisedText
) {
}
