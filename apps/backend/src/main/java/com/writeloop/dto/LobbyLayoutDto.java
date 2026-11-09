package com.writeloop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * 모바일 홈 로비의 가구 배치(앱 lobby-layout.ts의 LobbyLayout과 같은 모양)와 그 모양 버전.
 * 배치는 가구 인스턴스 목록이다. 바닥에 놓는 가구는 floor, 벽에 거는 가구는 wall 자리 하나만 갖는다.
 * floor의 x·z는 칸 모양의 가운데, facing은 0 앞(+z)·1 오른쪽(+x)·2 뒤(−z)·3 왼쪽(−x)이다.
 * wall의 wall은 back·left·right, along은 뒷벽이면 x, 옆벽이면 z다.
 * stored는 보관함에 넣은 가구(자리 없이 id와 종류만)다. 저장할 때 보내지 않았으면 없다(빈 보관함).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LobbyLayoutDto(
        int version,
        List<Item> items,
        List<StoredItem> stored
) {

    public LobbyLayoutDto(int version, List<Item> items) {
        this(version, items, null);
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Item(String id, String type, FloorSpot floor, WallSpot wall) {
    }

    public record FloorSpot(double x, double z, int facing) {
    }

    public record WallSpot(String wall, double along) {
    }

    public record StoredItem(String id, String type) {
    }
}
