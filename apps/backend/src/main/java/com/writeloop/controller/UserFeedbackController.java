package com.writeloop.controller;

import com.writeloop.dto.UserFeedbackRequestDto;
import com.writeloop.dto.UserFeedbackResponseDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.UserFeedbackService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user-feedback")
@RequiredArgsConstructor
public class UserFeedbackController {

    private final AuthService authService;
    private final UserFeedbackService userFeedbackService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserFeedbackResponseDto submit(
            @RequestBody UserFeedbackRequestDto request,
            HttpServletRequest httpRequest
    ) {
        return userFeedbackService.submit(authService.getCurrentUserIdOrNull(httpRequest), request);
    }
}
