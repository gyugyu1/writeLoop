package com.writeloop.controller;

import com.writeloop.dto.AdminCoachEvaluationRunResponseDto;
import com.writeloop.dto.AdminCoachEvaluationSummaryDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.CoachEvaluationService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/coach-evaluations")
@RequiredArgsConstructor
public class AdminCoachEvaluationController {

    private final AuthService authService;
    private final CoachEvaluationService coachEvaluationService;

    @GetMapping("/summary")
    public AdminCoachEvaluationSummaryDto summary(HttpSession session) {
        authService.requireAdmin(session);
        return coachEvaluationService.getSummary();
    }

    @PostMapping("/run")
    public AdminCoachEvaluationRunResponseDto run(
            @RequestParam(name = "limit", required = false) Integer limit,
            HttpSession session
    ) {
        authService.requireAdmin(session);
        return coachEvaluationService.evaluatePendingInteractions(limit);
    }
}
