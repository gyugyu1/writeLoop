package com.writeloop.controller;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * [spec] 작업 086 ② 결정 1(03-main-decision.md): 배치 저장은 종류마다 가진 개수(처음 배치 몫 + 산 개수)까지만 받는다.
 * 이번 작업 전부터 있던 배치 저장 테스트는 배치 규칙(자리, 소품, 보관함, 40개 등)을 보는 테스트라,
 * 저장하기 전에 그 계정이 보낼 배치에 필요한 만큼 가구를 산 것으로 준비한다(산 기록 home_shopping_orders를 넣는다).
 * 단언과 기대값은 바꾸지 않는다. 이 준비는 가진 개수 검사 자체를 보지 않는다.
 */
final class LobbyLayoutPurchasePrep {

    /** 팔 수 있는(치울 수 있는) 가구 10종. 장소가 딸린 가구는 가진 개수로 세지 않는다. */
    private static final List<String> SELLABLE = List.of(
            "books", "smallPlant", "lamp", "frame", "plant", "nightstand", "floorLamp", "rug", "wardrobe", "bed");

    /** 처음 배치 몫(모든 계정이 처음부터 가진 것). */
    private static final Map<String, Integer> STARTER = Map.of("wardrobe", 1, "rug", 1, "lamp", 1);

    private LobbyLayoutPurchasePrep() {
    }

    /**
     * 보낼 배치(방 + 보관함)의 종류마다 개수가 가진 개수보다 많으면 모자란 만큼 산 기록을 넣는다.
     * userId가 없으면(로그인 없는 요청 등) 아무것도 하지 않는다. 모양이 틀린 배치에서도 셀 수 있는 것만 센다.
     */
    static void ownEnoughFor(JdbcTemplate jdbc, Long userId, JsonNode layout) {
        if (userId == null || layout == null || !layout.isObject()) {
            return;
        }
        Map<String, Integer> needed = new LinkedHashMap<>();
        count(layout.get("items"), needed);
        count(layout.get("stored"), needed);
        for (Map.Entry<String, Integer> need : needed.entrySet()) {
            String type = need.getKey();
            int bought = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM home_shopping_orders WHERE user_id = ? AND furniture_type = ?",
                    Integer.class, userId, type);
            int missing = need.getValue() - STARTER.getOrDefault(type, 0) - bought;
            for (int i = 0; i < missing; i++) {
                jdbc.update(
                        "INSERT INTO home_shopping_orders (user_id, furniture_type, price, item_id, created_at) VALUES (?, ?, 0, ?, NOW(6))",
                        userId, type, "qa-prep-" + type);
            }
        }
    }

    private static void count(JsonNode list, Map<String, Integer> needed) {
        if (list == null || !list.isArray()) {
            return;
        }
        for (JsonNode item : list) {
            JsonNode type = item == null ? null : item.get("type");
            if (type != null && type.isTextual() && SELLABLE.contains(type.textValue())) {
                needed.merge(type.textValue(), 1, Integer::sum);
            }
        }
    }
}
