package com.writeloop.dto;

import java.time.Instant;

public record AnswerHistoryAttemptDto(
        Long id,
        Integer attemptNo,
        String attemptType,
        String answerText,
        Integer score,
        String feedbackSummary,
        AnswerHistoryFeedbackDto feedback,
        Instant createdAt
) {
}
