package com.writeloop.dto;

import java.time.LocalDate;
import java.util.List;

public record UpdateDiaryEntryRequestDto(
        String title,
        String content,
        String language,
        LocalDate entryDate,
        String mood,
        List<String> tags,
        Boolean draft
) {
}
