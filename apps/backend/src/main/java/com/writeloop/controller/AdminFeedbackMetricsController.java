package com.writeloop.controller;

import com.writeloop.dto.AdminFeedbackMetricsDto;
import com.writeloop.service.AdminFeedbackMetricsService;
import com.writeloop.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/admin/feedback-metrics")
@RequiredArgsConstructor
public class AdminFeedbackMetricsController {

    private final AuthService authService;
    private final AdminFeedbackMetricsService adminFeedbackMetricsService;

    @GetMapping
    public AdminFeedbackMetricsDto summarize(
            @RequestParam(name = "startDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate startDate,
            @RequestParam(name = "endDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate endDate,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        return adminFeedbackMetricsService.summarize(startDate, endDate);
    }
}
