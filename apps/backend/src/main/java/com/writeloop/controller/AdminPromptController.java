package com.writeloop.controller;

import com.writeloop.dto.AdminPromptDto;
import com.writeloop.dto.AdminPromptHintDto;
import com.writeloop.dto.AdminPromptHintRequestDto;
import com.writeloop.dto.AdminPromptRequestDto;
import com.writeloop.dto.AdminPromptTopicCatalogDto;
import com.writeloop.service.AdminPromptService;
import com.writeloop.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/prompts")
@RequiredArgsConstructor
public class AdminPromptController {

    private final AuthService authService;
    private final AdminPromptService adminPromptService;

    @GetMapping
    public List<AdminPromptDto> findPrompts(HttpServletRequest request, HttpSession session) {
        authService.requireAdmin(request, session);
        return adminPromptService.findAll();
    }

    @GetMapping("/topic-catalog")
    public List<AdminPromptTopicCatalogDto> findTopicCatalog(HttpServletRequest request, HttpSession session) {
        authService.requireAdmin(request, session);
        return adminPromptService.findTopicCatalog();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminPromptDto createPrompt(
            @RequestBody AdminPromptRequestDto promptRequest,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        return adminPromptService.createPrompt(promptRequest);
    }

    @PutMapping("/{promptId}")
    public AdminPromptDto updatePrompt(
            @PathVariable String promptId,
            @RequestBody AdminPromptRequestDto promptRequest,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        return adminPromptService.updatePrompt(promptId, promptRequest);
    }

    @DeleteMapping("/{promptId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePrompt(@PathVariable String promptId, HttpServletRequest request, HttpSession session) {
        authService.requireAdmin(request, session);
        adminPromptService.deletePrompt(promptId);
    }

    @PostMapping("/{promptId}/hints")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminPromptHintDto createHint(
            @PathVariable String promptId,
            @RequestBody AdminPromptHintRequestDto hintRequest,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        return adminPromptService.createHint(promptId, hintRequest);
    }

    @PutMapping("/{promptId}/hints/{hintId}")
    public AdminPromptHintDto updateHint(
            @PathVariable String promptId,
            @PathVariable String hintId,
            @RequestBody AdminPromptHintRequestDto hintRequest,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        return adminPromptService.updateHint(promptId, hintId, hintRequest);
    }

    @DeleteMapping("/{promptId}/hints/{hintId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHint(
            @PathVariable String promptId,
            @PathVariable String hintId,
            HttpServletRequest request,
            HttpSession session
    ) {
        authService.requireAdmin(request, session);
        adminPromptService.deleteHint(promptId, hintId);
    }
}
