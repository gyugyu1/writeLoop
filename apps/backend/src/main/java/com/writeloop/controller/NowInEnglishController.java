package com.writeloop.controller;

import com.writeloop.dto.NowInEnglishReflectionRequestDto;
import com.writeloop.dto.NowInEnglishReflectionResponseDto;
import com.writeloop.service.NowInEnglishReflectionService;
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
@RequestMapping("/api/now-in-english")
@RequiredArgsConstructor
public class NowInEnglishController {

    private final NowInEnglishReflectionService reflectionService;

    @PostMapping("/reflection")
    @ResponseStatus(HttpStatus.OK)
    public NowInEnglishReflectionResponseDto reflect(
            @RequestBody NowInEnglishReflectionRequestDto request
    ) {
        return reflectionService.reflect(request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", exception.getMessage()));
    }
}
