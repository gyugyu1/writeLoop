package com.writeloop.controller;

import com.writeloop.dto.ClothingShopOrderRequestDto;
import com.writeloop.dto.ClothingShopOrderResponseDto;
import com.writeloop.service.AuthService;
import com.writeloop.service.ClothingShopService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 마을 옷집 계산대 주문(장바구니를 한 번에). 로그인한 계정만 부른다. */
@RestController
@RequestMapping("/api/clothing-shop")
@RequiredArgsConstructor
public class ClothingShopController {

    private final ClothingShopService clothingShopService;
    private final AuthService authService;

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.OK)
    public ClothingShopOrderResponseDto order(
            @RequestBody(required = false) ClothingShopOrderRequestDto body,
            HttpServletRequest request
    ) {
        Long currentUserId = authService.getCurrentUserIdOrNull(request);
        if (currentUserId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        return clothingShopService.order(currentUserId, body);
    }
}
