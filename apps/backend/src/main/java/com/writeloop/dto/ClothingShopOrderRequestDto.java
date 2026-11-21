package com.writeloop.dto;

import java.util.List;

/** POST /api/clothing-shop/orders: 장바구니에 담은 옷마다 아이템 ID와 화면에 보인 가격. */
public record ClothingShopOrderRequestDto(
        List<Item> items
) {
    public record Item(
            String type,
            Integer price
    ) {
    }
}
