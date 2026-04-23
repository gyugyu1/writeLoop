package com.writeloop.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DiaryEntryDto(
        String entryId,
        String title,
        String content,
        String language,
        LocalDate entryDate,
        String mood,
        List<String> tags,
        boolean draft,
        Instant createdAt,
        Instant updatedAt,
        List<DiaryAttemptDto> attempts
) {
    public DiaryEntryDto {
        tags = tags == null ? List.of() : List.copyOf(tags);
        attempts = attempts == null ? List.of() : List.copyOf(attempts);
    }
}
