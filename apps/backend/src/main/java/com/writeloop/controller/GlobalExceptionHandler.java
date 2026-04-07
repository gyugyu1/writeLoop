package com.writeloop.controller;

import com.writeloop.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException exception) {
        if (exception.getStatus().is5xxServerError()) {
            LOGGER.error(
                    "ApiException handled: status={}, code={}, message={}",
                    exception.getStatus().value(),
                    exception.getCode(),
                    exception.getMessage(),
                    exception
            );
        } else {
            LOGGER.warn(
                    "ApiException handled: status={}, code={}, message={}",
                    exception.getStatus().value(),
                    exception.getCode(),
                    exception.getMessage(),
                    exception
            );
        }
        Map<String, String> body = new HashMap<>();
        body.put("message", exception.getMessage());
        body.put("code", exception.getCode());
        return ResponseEntity.status(exception.getStatus()).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatusException(ResponseStatusException exception) {
        if (exception.getStatusCode().is5xxServerError()) {
            LOGGER.error(
                    "ResponseStatusException handled: status={}, message={}",
                    exception.getStatusCode().value(),
                    exception.getReason(),
                    exception
            );
        } else {
            LOGGER.warn(
                    "ResponseStatusException handled: status={}, message={}",
                    exception.getStatusCode().value(),
                    exception.getReason(),
                    exception
            );
        }
        Map<String, String> body = new HashMap<>();
        body.put("message", exception.getReason() == null ? "\uC694\uCCAD\uC744 \uCC98\uB9AC\uD560 \uC218 \uC5C6\uC5B4\uC694." : exception.getReason());
        return ResponseEntity.status(exception.getStatusCode()).body(body);
    }
}
