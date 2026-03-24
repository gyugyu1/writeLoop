package com.writeloop.dto;

import java.time.Instant;

public record WritingDraftDto(
        String promptId,
        WritingDraftTypeDto draftType,
        String selectedDifficulty,
        String sessionId,
        String answer,
        String rewrite,
        String lastSubmittedAnswer,
        FeedbackResponseDto feedback,
        String step,
        Instant updatedAt
) {
}
