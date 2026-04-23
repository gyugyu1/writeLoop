package com.writeloop.controller;

import com.writeloop.dto.CreateDiaryEntryRequestDto;
import com.writeloop.dto.DiaryCalendarSummaryDto;
import com.writeloop.dto.DiaryEntryDto;
import com.writeloop.dto.DiaryFeedbackRequestDto;
import com.writeloop.dto.DiaryFeedbackResponseDto;
import com.writeloop.dto.UpdateDiaryEntryRequestDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.DiaryService;
import jakarta.servlet.http.HttpServletRequest;
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
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/diary/entries")
@RequiredArgsConstructor
public class DiaryController {

    private final AuthService authService;
    private final DiaryService diaryService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DiaryEntryDto createEntry(
            @RequestBody CreateDiaryEntryRequestDto request,
            HttpServletRequest httpRequest
    ) {
        requireRequest(request);
        return diaryService.createEntry(requireCurrentUserId(httpRequest), request);
    }

    @PutMapping("/{entryId}")
    @ResponseStatus(HttpStatus.OK)
    public DiaryEntryDto updateEntry(
            @PathVariable String entryId,
            @RequestBody UpdateDiaryEntryRequestDto request,
            HttpServletRequest httpRequest
    ) {
        requireRequest(request);
        return diaryService.updateEntry(requireCurrentUserId(httpRequest), entryId, request);
    }

    @PostMapping("/{entryId}/feedback")
    @ResponseStatus(HttpStatus.OK)
    public DiaryFeedbackResponseDto generateFeedback(
            @PathVariable String entryId,
            @RequestBody(required = false) DiaryFeedbackRequestDto request,
            HttpServletRequest httpRequest
    ) {
        return diaryService.generateFeedback(requireCurrentUserId(httpRequest), entryId, request);
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public List<DiaryEntryDto> listEntries(HttpServletRequest httpRequest) {
        return diaryService.listEntries(requireCurrentUserId(httpRequest));
    }

    @GetMapping("/calendar")
    @ResponseStatus(HttpStatus.OK)
    public DiaryCalendarSummaryDto getCalendarSummary(HttpServletRequest httpRequest) {
        return diaryService.getCalendarSummary(requireCurrentUserId(httpRequest));
    }

    @GetMapping("/{entryId}")
    @ResponseStatus(HttpStatus.OK)
    public DiaryEntryDto getEntry(
            @PathVariable String entryId,
            HttpServletRequest httpRequest
    ) {
        return diaryService.getEntry(requireCurrentUserId(httpRequest), entryId);
    }

    @DeleteMapping("/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEntry(
            @PathVariable String entryId,
            HttpServletRequest httpRequest
    ) {
        diaryService.deleteEntry(requireCurrentUserId(httpRequest), entryId);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        return currentUserId;
    }

    private void requireRequest(Object request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
    }
}
