package com.writeloop.dto;

import java.util.List;

/**
 * GET /api/catalog: 아이템 목록(가구·옷)과 그 판(version, 목록 내용이 바뀌면 바뀐다).
 * 값이 없는 칸은 null이다. price는 정가(오늘의 방송 할인은 홈쇼핑 API가 준다). assets는 모델·그림 칸(아직 null).
 */
public record CatalogDto(String version, List<Item> items) {

    public record Item(
            String id,
            String kind,
            String name,
            String shopName,
            String description,
            String category,
            String slot,
            Integer price,
            Object assets
    ) {
    }
}
