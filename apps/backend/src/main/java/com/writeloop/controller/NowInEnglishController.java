package com.writeloop.controller;

import com.writeloop.dto.NowInEnglishEntryDto;
import com.writeloop.dto.NowInEnglishEntryRequestDto;
import com.writeloop.dto.NowInEnglishEntrySyncRequestDto;
import com.writeloop.dto.NowInEnglishCoachFeedbackRequestDto;
import com.writeloop.dto.NowInEnglishCoachFeedbackResponseDto;
import com.writeloop.dto.NowInEnglishReflectionRequestDto;
import com.writeloop.dto.NowInEnglishReflectionResponseDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.NowInEnglishCoachFeedbackService;
import com.writeloop.service.NowInEnglishEntryService;
import com.writeloop.service.NowInEnglishReflectionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/now-in-english")
@RequiredArgsConstructor
public class NowInEnglishController {

    private final AuthService authService;
    private final NowInEnglishEntryService entryService;
    private final NowInEnglishReflectionService reflectionService;
    private final NowInEnglishCoachFeedbackService coachFeedbackService;

    @GetMapping("/entries")
    @ResponseStatus(HttpStatus.OK)
    public List<NowInEnglishEntryDto> listEntries(HttpServletRequest httpRequest) {
        return entryService.listEntries(requireCurrentUserId(httpRequest));
    }

    @PostMapping("/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public NowInEnglishEntryDto createEntry(
            @RequestBody NowInEnglishEntryRequestDto request,
            HttpServletRequest httpRequest
    ) {
        return entryService.createEntry(requireCurrentUserId(httpRequest), request);
    }

    @PostMapping("/entries/sync")
    @ResponseStatus(HttpStatus.OK)
    public List<NowInEnglishEntryDto> syncEntries(
            @RequestBody(required = false) NowInEnglishEntrySyncRequestDto request,
            HttpServletRequest httpRequest
    ) {
        return entryService.syncEntries(requireCurrentUserId(httpRequest), request);
    }

    @PostMapping("/reflection")
    @ResponseStatus(HttpStatus.OK)
    public NowInEnglishReflectionResponseDto reflect(
            @RequestBody NowInEnglishReflectionRequestDto request,
            HttpServletRequest httpRequest
    ) {
        Long currentUserId = authService.getCurrentUserIdOrNull(httpRequest);
        if (currentUserId != null) {
            return reflectionService.reflectAndStore(currentUserId, request);
        }
        return reflectionService.reflect(request);
    }

    @PostMapping("/coach-feedback")
    @ResponseStatus(HttpStatus.OK)
    public NowInEnglishCoachFeedbackResponseDto coachFeedback(
            @RequestBody NowInEnglishCoachFeedbackRequestDto request,
            HttpServletRequest httpRequest
    ) {
        return coachFeedbackService.review(authService.getCurrentUserIdOrNull(httpRequest), request);
    }

    @GetMapping("/reflection/{dateKey}")
    @ResponseStatus(HttpStatus.OK)
    public NowInEnglishReflectionResponseDto getReflection(
            @PathVariable String dateKey,
            HttpServletRequest httpRequest
    ) {
        return reflectionService.getSavedReflection(requireCurrentUserId(httpRequest), dateKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reflection not found"));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        return currentUserId;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", exception.getMessage()));
    }
}
