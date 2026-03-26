package com.writeloop.dto;

import java.util.List;

public record MonthWritingStatusDto(
        int year,
        int month,
        long streakDays,
        List<MonthWritingStatusDayDto> days
) {
}
