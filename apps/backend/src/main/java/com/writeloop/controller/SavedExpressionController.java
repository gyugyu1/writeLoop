package com.writeloop.controller;

import com.writeloop.dto.SaveExpressionRequestDto;
import com.writeloop.dto.SavedExpressionDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.SavedExpressionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/saved-expressions")
@RequiredArgsConstructor
public class SavedExpressionController {

    private final AuthService authService;
    private final SavedExpressionService savedExpressionService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public List<SavedExpressionDto> getSavedExpressions(HttpServletRequest request) {
        return savedExpressionService.getSavedExpressions(requireCurrentUserId(request));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public SavedExpressionDto saveExpression(
            @RequestBody SaveExpressionRequestDto request,
            HttpServletRequest httpRequest
    ) {
        return savedExpressionService.saveExpression(requireCurrentUserId(httpRequest), request);
    }

    @DeleteMapping("/{savedExpressionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteExpression(
            @PathVariable Long savedExpressionId,
            HttpServletRequest request
    ) {
        savedExpressionService.deleteExpression(requireCurrentUserId(request), savedExpressionId);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return currentUserId;
    }
}
