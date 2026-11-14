package com.writeloop.controller;

import com.writeloop.dto.LoopPointsSummaryDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.LoopPointService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 룹 잔액과 오늘 적립 현황. 로그인한 계정만 부른다. */
@RestController
@RequestMapping("/api/loop-points")
@RequiredArgsConstructor
public class LoopPointController {

    private final LoopPointService loopPointService;
    private final AuthService authService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public LoopPointsSummaryDto getSummary(HttpServletRequest request) {
        return loopPointService.getSummary(requireCurrentUserId(request));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        return currentUserId;
    }
}
