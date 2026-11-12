package com.writeloop.controller;

import com.writeloop.dto.HomeShoppingDto;
import com.writeloop.dto.HomeShoppingOrderRequestDto;
import com.writeloop.dto.HomeShoppingOrderResponseDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.HomeShoppingService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 라룹 홈쇼핑 목록과 주문. 로그인한 계정만 부른다. */
@RestController
@RequestMapping("/api/home-shopping")
@RequiredArgsConstructor
public class HomeShoppingController {

    private final HomeShoppingService homeShoppingService;
    private final AuthService authService;

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public HomeShoppingDto getShop(HttpServletRequest request) {
        return homeShoppingService.getShop(requireCurrentUserId(request));
    }

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.OK)
    public HomeShoppingOrderResponseDto order(
            @RequestBody(required = false) HomeShoppingOrderRequestDto body,
            HttpServletRequest request
    ) {
        return homeShoppingService.order(requireCurrentUserId(request), body);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        return currentUserId;
    }
}
