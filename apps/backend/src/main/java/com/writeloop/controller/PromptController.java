package com.writeloop.controller;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.dto.PromptRecommendationClickRequestDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.PromptService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/prompts")
@RequiredArgsConstructor
public class PromptController {

    private final AuthService authService;
    private final PromptService promptService;

    @GetMapping
    public List<PromptDto> findPrompts() {
        return promptService.findAll();
    }

    @GetMapping("/daily")
    public DailyPromptRecommendationDto recommendDailyPrompts(
            @RequestParam(name = "difficulty", defaultValue = "A") DailyDifficultyDto difficulty,
            @RequestParam(name = "guestId", required = false) String guestId,
            HttpServletRequest request
    ) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        return promptService.recommendDailyPrompts(difficulty, currentUserId, guestId);
    }

    @PostMapping("/daily/click")
    @ResponseStatus(HttpStatus.OK)
    public void recordDailyPromptClick(
            @RequestBody PromptRecommendationClickRequestDto requestBody,
            HttpServletRequest request
    ) {
        if (requestBody == null || requestBody.promptId() == null || requestBody.promptId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "promptId is required");
        }

        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        promptService.recordDailyPromptClick(requestBody.promptId(), currentUserId, requestBody.guestId());
    }

    @GetMapping("/{promptId}/hints")
    public List<PromptHintDto> findPromptHints(@PathVariable String promptId) {
        return promptService.findHintsByPromptId(promptId);
    }
}
