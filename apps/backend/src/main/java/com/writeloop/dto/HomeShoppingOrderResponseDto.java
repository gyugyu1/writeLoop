package com.writeloop.dto;

/**
 * 주문 결과: 산 상품과 값, 주문 뒤 잔액, 그 종류의 가진 개수, 보관함에 더한 가구 id, 주문 뒤 저장된 배치, 주문 뒤 옷장.
 * 가구 주문은 wardrobe가 null이고, 옷 주문은 itemId·layout이 null이며 owned는 1이다.
 */
public record HomeShoppingOrderResponseDto(
        String type,
        int price,
        int balance,
        int owned,
        String itemId,
        LobbyLayoutDto layout,
        WardrobeDto wardrobe
) {
}
