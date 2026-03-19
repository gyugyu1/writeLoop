package com.writeloop.controller;

import com.writeloop.exception.ApiException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException exception) {
        Map<String, String> body = new HashMap<>();
        body.put("message", exception.getMessage());
        body.put("code", exception.getCode());
        return ResponseEntity.status(exception.getStatus()).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatusException(ResponseStatusException exception) {
        Map<String, String> body = new HashMap<>();
        body.put("message", exception.getReason() == null ? "요청을 처리할 수 없어요." : exception.getReason());
        return ResponseEntity.status(exception.getStatusCode()).body(body);
    }
}
