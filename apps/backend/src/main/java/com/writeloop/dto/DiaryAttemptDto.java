package com.writeloop.dto;

import java.time.Instant;

public record DiaryAttemptDto(
        Long id,
        Integer attemptNo,
        String diaryText,
        Integer score,
        String feedbackSummary,
        DiaryFeedbackResponseDto feedback,
        Instant createdAt
) {
}
