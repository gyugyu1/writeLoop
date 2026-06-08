package com.writeloop.dto;

import java.time.Instant;

public record NowInEnglishEntryDto(
        String id,
        String text,
        String polishedFromEntryId,
        String polishedFromText,
        String dateKey,
        Instant createdAt
) {
}
