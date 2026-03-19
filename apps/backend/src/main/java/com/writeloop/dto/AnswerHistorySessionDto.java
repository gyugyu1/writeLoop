package com.writeloop.dto;

import java.time.Instant;
import java.util.List;

public record AnswerHistorySessionDto(
        String sessionId,
        String promptId,
        String topic,
        String difficulty,
        String questionEn,
        String questionKo,
        Instant createdAt,
        Instant updatedAt,
        List<AnswerHistoryAttemptDto> attempts
) {
}
