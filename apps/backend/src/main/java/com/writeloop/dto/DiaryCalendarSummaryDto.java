package com.writeloop.dto;

import java.util.List;

public record DiaryCalendarSummaryDto(
        long totalEntries,
        List<DiaryCalendarDayDto> days
) {
}
