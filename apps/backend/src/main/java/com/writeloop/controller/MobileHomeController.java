package com.writeloop.controller;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DiaryCalendarSummaryDto;
import com.writeloop.dto.FeaturedDailyPromptDto;
import com.writeloop.dto.MobileHomeSnapshotDto;
import com.writeloop.dto.TodayWritingStatusDto;
import com.writeloop.service.AnswerHistoryService;
import com.writeloop.service.AuthService;
import com.writeloop.service.DiaryService;
import com.writeloop.service.PromptService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/mobile/home")
@RequiredArgsConstructor
public class MobileHomeController {

    private final AuthService authService;
    private final AnswerHistoryService answerHistoryService;
    private final DiaryService diaryService;
    private final PromptService promptService;

    @GetMapping
    public MobileHomeSnapshotDto getHomeSnapshot(
            @RequestParam(name = "featuredDifficulty", defaultValue = "I") DailyDifficultyDto featuredDifficulty,
            @RequestParam(name = "guestId", required = false) String guestId,
            HttpServletRequest request
    ) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        TodayWritingStatusDto todayStatus = null;
        DiaryCalendarSummaryDto diaryCalendarSummary = null;

        if (currentUserId != null) {
            todayStatus = answerHistoryService.getTodayStatus(currentUserId);
            diaryCalendarSummary = diaryService.getCalendarSummary(currentUserId);
        }

        FeaturedDailyPromptDto featuredRecommendation = promptService.recommendFeaturedDailyPrompt(
                featuredDifficulty,
                currentUserId,
                guestId
        );

        return new MobileHomeSnapshotDto(todayStatus, diaryCalendarSummary, featuredRecommendation);
    }
}
