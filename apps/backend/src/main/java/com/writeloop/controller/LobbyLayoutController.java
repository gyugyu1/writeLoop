package com.writeloop.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.writeloop.dto.LobbyLayoutDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.LobbyLayoutService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 모바일 홈 로비의 가구 배치. 저장한 적이 없으면 불러오기가 404다(초안 불러오기와 같다). */
@RestController
@RequestMapping("/api/lobby-layout")
@RequiredArgsConstructor
public class LobbyLayoutController {

    private final AuthService authService;
    private final LobbyLayoutService lobbyLayoutService;

    @GetMapping
    public ResponseEntity<LobbyLayoutDto> getLayout(HttpServletRequest request) {
        LobbyLayoutDto layout = lobbyLayoutService.getLayout(requireCurrentUserId(request));
        if (layout == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(layout);
    }

    @PutMapping
    @ResponseStatus(HttpStatus.OK)
    public LobbyLayoutDto saveLayout(@RequestBody JsonNode layout, HttpServletRequest request) {
        return lobbyLayoutService.saveLayout(requireCurrentUserId(request), layout);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return currentUserId;
    }
}
