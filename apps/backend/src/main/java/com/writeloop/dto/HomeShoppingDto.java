package com.writeloop.dto;

import java.util.List;

/** GET /api/home-shopping: 잔액, 오늘의 방송 상품, 팔 수 있는 가구(가격이 낮은 것부터). salePrice는 그날 방송 상품만 있고 다른 가구는 null이다. */
public record HomeShoppingDto(
        int balance,
        Broadcast broadcast,
        List<Item> items
) {
    public record Broadcast(
            String type,
            int price,
            int salePrice
    ) {
    }

    public record Item(
            String type,
            int price,
            Integer salePrice,
            int owned
    ) {
    }
}
