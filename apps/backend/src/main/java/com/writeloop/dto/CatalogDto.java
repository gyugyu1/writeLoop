package com.writeloop.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.writeloop.service.ItemCatalog;

import java.util.List;

/**
 * GET /api/catalog: 아이템 목록(가구·옷)과 그 판(version, 목록 파일이나 모델·아이콘 파일 내용이 바뀌면 바뀐다).
 * 값이 없는 칸은 null이다. price는 정가(오늘의 방송 할인은 홈쇼핑 API가 준다).
 * draw는 가구의 그리기 정보(옷은 null), assets는 내려받을 모델·아이콘 파일(파일이 없는 아이템은 null)이다.
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
            ItemCatalog.Assets assets,
            JsonNode draw
    ) {
    }
}
