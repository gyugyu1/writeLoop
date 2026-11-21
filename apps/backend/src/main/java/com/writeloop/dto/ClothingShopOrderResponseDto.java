package com.writeloop.dto;

import java.util.List;

/** 옷집 계산대 주문 결과: 산 옷과 값, 합계, 주문 뒤 잔액, 주문 뒤 옷장. */
public record ClothingShopOrderResponseDto(
        List<Item> items,
        int total,
        int balance,
        WardrobeDto wardrobe
) {
    public record Item(
            String type,
            int price
    ) {
    }
}
