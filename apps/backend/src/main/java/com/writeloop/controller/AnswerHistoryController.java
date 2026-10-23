package com.writeloop.controller;

import com.writeloop.dto.AnswerHistorySessionDto;
import com.writeloop.dto.CommonMistakeDto;
import com.writeloop.dto.MonthWritingStatusDto;
import com.writeloop.dto.TodayWritingStatusDto;
import com.writeloop.service.AnswerHistoryService;
import com.writeloop.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class AnswerHistoryController {

    private final AnswerHistoryService answerHistoryService;
    private final AuthService authService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public List<AnswerHistorySessionDto> getHistory(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String before,
            HttpServletRequest request
    ) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        return answerHistoryService.getHistory(currentUserId, limit, parseBefore(before));
    }

    @GetMapping("/today-status")
    @ResponseStatus(HttpStatus.OK)
    public TodayWritingStatusDto getTodayStatus(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        return answerHistoryService.getTodayStatus(currentUserId);
    }

    @GetMapping("/month-status")
    @ResponseStatus(HttpStatus.OK)
    public MonthWritingStatusDto getMonthStatus(
            @RequestParam int year,
            @RequestParam int month,
            HttpServletRequest request
    ) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        return answerHistoryService.getMonthStatus(currentUserId, year, month);
    }

    @GetMapping("/common-mistakes")
    @ResponseStatus(HttpStatus.OK)
    public List<CommonMistakeDto> getCommonMistakes(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        return answerHistoryService.getCommonMistakes(currentUserId);
    }

    // 기록 페이지의 기준 시각. 앞 페이지 마지막 세션의 createdAt(ISO-8601)을 그대로 받는다.
    private static Instant parseBefore(String before) {
        if (before == null || before.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(before.trim());
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "before는 ISO-8601 시각이어야 해요.");
        }
    }
}
