package com.writeloop.controller;

import com.writeloop.dto.CoachHelpRequestDto;
import com.writeloop.dto.CoachHelpResponseDto;
import com.writeloop.dto.CoachUsageCheckRequestDto;
import com.writeloop.dto.CoachUsageCheckResponseDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.CoachService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/coach")
@RequiredArgsConstructor
public class CoachController {

    private final CoachService coachService;
    private final AuthService authService;

    @PostMapping("/help")
    @ResponseStatus(HttpStatus.OK)
    public CoachHelpResponseDto help(
            @RequestBody CoachHelpRequestDto request,
            HttpServletRequest httpRequest,
            HttpSession session
    ) {
        if (request == null || request.promptId() == null || request.promptId().isBlank()) {
            throw new IllegalArgumentException("promptId is required");
        }
        if (request.question() == null || request.question().isBlank()) {
            throw new IllegalArgumentException("question is required");
        }

        return coachService.help(request, authService.getCurrentUserIdOrNull(httpRequest, session), session.getId());
    }

    @PostMapping("/usage-check")
    @ResponseStatus(HttpStatus.OK)
    public CoachUsageCheckResponseDto checkUsage(
            @RequestBody CoachUsageCheckRequestDto request,
            HttpServletRequest httpRequest,
            HttpSession session
    ) {
        if (request == null || request.promptId() == null || request.promptId().isBlank()) {
            throw new IllegalArgumentException("promptId is required");
        }
        if (request.answer() == null || request.answer().isBlank()) {
            throw new IllegalArgumentException("answer is required");
        }
        if (request.expressions() == null || request.expressions().isEmpty()) {
            throw new IllegalArgumentException("expressions is required");
        }

        return coachService.checkUsage(
                request,
                authService.getCurrentUserIdOrNull(httpRequest, session),
                session.getId()
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", exception.getMessage()));
    }
}
