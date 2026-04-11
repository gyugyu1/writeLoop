package com.writeloop.controller;

import com.writeloop.dto.FeedbackRequestDto;
import com.writeloop.dto.FeedbackResponseDto;
import com.writeloop.exception.GuestLimitExceededException;
import com.writeloop.service.AuthService;
import com.writeloop.service.FeedbackService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final AuthService authService;
    private final FeedbackService feedbackService;

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public FeedbackResponseDto review(
            @RequestBody FeedbackRequestDto request,
            HttpServletRequest httpRequest,
            HttpSession session
    ) {
        if (request == null || request.answer() == null || request.answer().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "answer is required");
        }

        return feedbackService.review(request, authService.getCurrentUserIdOrNull(httpRequest, session));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleIllegalState(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", exception.getMessage()));
    }

    @ExceptionHandler(GuestLimitExceededException.class)
    public ResponseEntity<Map<String, String>> handleGuestLimit(GuestLimitExceededException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of(
                        "code", "GUEST_LIMIT_REACHED",
                        "message", exception.getMessage()
                ));
    }
}
