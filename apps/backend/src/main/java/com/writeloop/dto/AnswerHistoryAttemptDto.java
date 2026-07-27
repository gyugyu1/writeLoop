package com.writeloop.dto;

import java.time.Instant;

public record AnswerHistoryAttemptDto(
        Long id,
        Integer attemptNo,
        String attemptType,
        String answerText,
        String feedbackSummary,
        VisibleFeedbackSnapshotDto visibleFeedback,
        java.util.List<AnswerHistoryUsedExpressionDto> usedExpressions,
        Instant createdAt
) {
}
