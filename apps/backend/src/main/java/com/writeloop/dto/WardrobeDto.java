package com.writeloop.dto;

import java.time.Instant;
import java.util.List;

/**
 * 라룹이 착용 아이템(캐릭터 꾸미기): 가진 아이템(얻은 순서)과 부위별로 입은 아이템(입지 않은 부위는 null).
 * 앱 types.ts의 Wardrobe와 같은 모양이다.
 */
public record WardrobeDto(List<Item> items, Equipped equipped) {

    public record Item(String type, String slot, Instant acquiredAt) {
    }

    /** 부위 일곱의 입은 아이템 종류. 요청 본문으로도 쓴다(빠진 부위는 null로 본다). */
    public record Equipped(String hat, String top, String bottom, String shoes, String face, String back, String accessory) {
    }
}
