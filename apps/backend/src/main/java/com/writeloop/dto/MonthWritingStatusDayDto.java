package com.writeloop.dto;

public record MonthWritingStatusDayDto(
        String date,
        boolean started,
        boolean completed,
        long startedSessions,
        long completedSessions,
        boolean isToday
) {
}
