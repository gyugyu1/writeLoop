package com.writeloop.dto;

/**
 * 모바일 홈 로비의 가구 배치(앱 lobby-layout.ts의 LobbyLayout과 같은 모양)와 그 모양 버전.
 * 바닥 가구의 x·z는 칸 모양의 가운데(깔개는 그림 가운데), facing은 0 앞(+z)·1 오른쪽(+x)·2 뒤(−z)·3 왼쪽(−x)이다.
 * 벽 가구의 wall은 back·left·right, along은 뒷벽이면 x, 옆벽이면 z다.
 */
public record LobbyLayoutDto(
        int version,
        Floor floor,
        Wall wall
) {

    public record Floor(FloorPiece desk, FloorPiece bookcase, FloorPiece wardrobe, FloorPiece rug) {
    }

    public record FloorPiece(double x, double z, int facing) {
    }

    public record Wall(WallPiece board, WallPiece window) {
    }

    public record WallPiece(String wall, double along) {
    }
}
