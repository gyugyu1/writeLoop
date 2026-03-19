package com.writeloop.controller;

import com.writeloop.dto.DailyDifficultyDto;
import com.writeloop.dto.DailyPromptRecommendationDto;
import com.writeloop.dto.PromptHintDto;
import com.writeloop.dto.PromptDto;
import com.writeloop.service.PromptService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/prompts")
@RequiredArgsConstructor
public class PromptController {

    private final PromptService promptService;

    @GetMapping
    public List<PromptDto> findPrompts() {
        return promptService.findAll();
    }

    @GetMapping("/daily")
    public DailyPromptRecommendationDto recommendDailyPrompts(
            @RequestParam(name = "difficulty", defaultValue = "A") DailyDifficultyDto difficulty
    ) {
        return promptService.recommendDailyPrompts(difficulty);
    }

    @GetMapping("/{promptId}/hints")
    public List<PromptHintDto> findPromptHints(@PathVariable String promptId) {
        return promptService.findHintsByPromptId(promptId);
    }
}
