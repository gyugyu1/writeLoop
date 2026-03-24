package com.writeloop.dto;

public record SaveWritingDraftRequestDto(
        WritingDraftTypeDto draftType,
        String selectedDifficulty,
        String sessionId,
        String answer,
        String rewrite,
        String lastSubmittedAnswer,
        FeedbackResponseDto feedback,
        String step
) {
}
