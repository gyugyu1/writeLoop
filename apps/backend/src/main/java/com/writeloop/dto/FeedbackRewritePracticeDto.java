package com.writeloop.dto;

public record FeedbackRewritePracticeDto(
        String title,
        String starter,
        String instruction,
        String ctaLabel,
        boolean optionalTone
) {
    public FeedbackRewritePracticeDto {
        title = title == null ? "" : title.trim();
        starter = starter == null ? "" : starter.trim();
        instruction = instruction == null ? "" : instruction.trim();
        ctaLabel = ctaLabel == null || ctaLabel.isBlank() ? "이 문장으로 시작해서 다시 쓰기" : ctaLabel.trim();
    }
}
