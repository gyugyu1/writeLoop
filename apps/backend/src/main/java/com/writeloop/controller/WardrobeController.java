package com.writeloop.controller;

import com.writeloop.dto.WardrobeDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.WardrobeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 라룹이 착용 아이템(캐릭터 꾸미기): 가진 것과 입은 것. 로그인한 사용자만. */
@RestController
@RequestMapping("/api/wardrobe")
@RequiredArgsConstructor
public class WardrobeController {

    private final AuthService authService;
    private final WardrobeService wardrobeService;

    @GetMapping
    public WardrobeDto getWardrobe(HttpServletRequest request) {
        return wardrobeService.getWardrobe(requireCurrentUserId(request));
    }

    @PutMapping("/equipped")
    public WardrobeDto saveEquipped(@RequestBody(required = false) WardrobeDto.Equipped equipped, HttpServletRequest request) {
        return wardrobeService.saveEquipped(requireCurrentUserId(request), equipped);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요해요.");
        }
        return currentUserId;
    }
}
