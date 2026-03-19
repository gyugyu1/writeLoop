package com.writeloop.controller;

import com.writeloop.dto.AnswerHistorySessionDto;
import com.writeloop.dto.CommonMistakeDto;
import com.writeloop.dto.TodayWritingStatusDto;
import com.writeloop.service.AnswerHistoryService;
import com.writeloop.service.AuthService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class AnswerHistoryController {

    private final AnswerHistoryService answerHistoryService;
    private final AuthService authService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public List<AnswerHistorySessionDto> getHistory(HttpSession session) {
        Long currentUserId = authService.getCurrentUserIdOrNull(session);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        return answerHistoryService.getHistory(currentUserId);
    }

    @GetMapping("/today-status")
    @ResponseStatus(HttpStatus.OK)
    public TodayWritingStatusDto getTodayStatus(HttpSession session) {
        Long currentUserId = authService.getCurrentUserIdOrNull(session);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        return answerHistoryService.getTodayStatus(currentUserId);
    }

    @GetMapping("/common-mistakes")
    @ResponseStatus(HttpStatus.OK)
    public List<CommonMistakeDto> getCommonMistakes(HttpSession session) {
        Long currentUserId = authService.getCurrentUserIdOrNull(session);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }

        return answerHistoryService.getCommonMistakes(currentUserId);
    }
}
