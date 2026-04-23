package com.writeloop.dto;

import java.time.LocalDate;

public record DiaryCalendarDayDto(
        LocalDate date,
        String entryId,
        int entryCount
) {
}
