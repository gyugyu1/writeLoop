package com.writeloop.dto;

public record MobileHomeSnapshotDto(
        TodayWritingStatusDto todayStatus,
        DiaryCalendarSummaryDto diaryCalendarSummary,
        FeaturedDailyPromptDto featuredRecommendation
) {
}
