package com.writeloop.dto;

import java.util.List;

/**
 * GET /api/home-shopping: 잔액, 오늘의 방송 상품, 팔 수 있는 가구·옷(가격이 낮은 것부터). salePrice는 그날 방송 상품만 있고 다른 상품은 null이다.
 * owned는 가구면 가진 개수, 옷이면 가졌으면 1이다.
 */
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
