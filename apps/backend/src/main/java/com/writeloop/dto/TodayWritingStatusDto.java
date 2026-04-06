package com.writeloop.dto;

public record TodayWritingStatusDto(
        String date,
        boolean completed,
        long completedSessions,
        long startedSessions,
        long streakDays,
        long totalWrittenSentences
) {
}
