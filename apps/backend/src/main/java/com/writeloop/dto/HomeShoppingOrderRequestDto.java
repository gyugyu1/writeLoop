package com.writeloop.dto;

/** POST /api/home-shopping/orders: 살 가구 종류와 화면에 보인 가격. 서버의 지금 가격과 다르면 주문하지 않는다. */
public record HomeShoppingOrderRequestDto(
        String type,
        Integer price
) {
}
