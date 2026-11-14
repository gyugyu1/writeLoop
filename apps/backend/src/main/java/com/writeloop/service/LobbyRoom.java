package com.writeloop.service;

import java.util.List;

/**
 * 모바일 홈 로비 방의 고정 구조(앱 room.ts와 같은 값): 직사각형 방의 크기, 가구를 걸 수 있는 벽, 출입구.
 * 로비 배치 검사는 방 크기와 벽을 이 데이터에서 읽는다. 방이 바뀌는 기능(집 넓히기·이층집)은 아직 없어 지금 방은 늘 기본 방이다.
 * 방을 만들 때 최소 크기(기본 방), 정수 칸 수, 걸 수 있는 벽(하나 이상, 아는 벽), 밖으로 출입구가 정확히 하나인지, 입구 발판이 방 앞끝 안인지 검사한다.
 */
public record LobbyRoom(
        String id,
        double width,
        double depth,
        double wallHeight,
        double wallThickness,
        List<String> hangWalls,
        List<Exit> exits
) {

    /** 방의 최소 가로·깊이(기본 방). 방은 넓어지기만 해서, 처음 배치의 장소 가구를 늘 놓을 수 있다. */
    public static final double MIN_WIDTH = 8;
    public static final double MIN_DEPTH = 11;

    /** 아는 벽 이름. 앞쪽은 카메라 쪽이라 열려 있다. */
    public static final List<String> WALL_SIDES = List.of("back", "left", "right");

    /** 출입구. 밖으로 출입구는 입구 발판(가운데 x, 폭, 앞으로 나온 깊이)이고, 다른 방으로(이층집의 계단 등)는 이어지는 방 id만 둔다. */
    public sealed interface Exit permits OutsideExit, RoomLinkExit {
    }

    public record OutsideExit(double x, double width, double depth) implements Exit {
    }

    public record RoomLinkExit(String to) implements Exit {
    }

    public LobbyRoom {
        hangWalls = List.copyOf(hangWalls);
        exits = List.copyOf(exits);
        if (width != Math.rint(width) || depth != Math.rint(depth)) {
            throw new IllegalArgumentException("방 칸 수는 정수여야 해요: " + id);
        }
        if (width < MIN_WIDTH || depth < MIN_DEPTH) {
            throw new IllegalArgumentException("방이 최소 크기보다 작아요: " + id);
        }
        // 최소 크기 덕에 어느 벽 하나에도 장소가 딸린 벽 가구(게시판·창문)를 함께 걸 수 있다
        if (hangWalls.isEmpty() || !WALL_SIDES.containsAll(hangWalls)) {
            throw new IllegalArgumentException("걸 수 있는 벽이 하나 이상, 아는 벽이어야 해요: " + id);
        }
        List<OutsideExit> outside = exits.stream().filter(OutsideExit.class::isInstance).map(OutsideExit.class::cast).toList();
        if (outside.size() != 1) {
            throw new IllegalArgumentException("밖으로 출입구는 정확히 하나여야 해요: " + id);
        }
        OutsideExit step = outside.get(0);
        if (!(step.width() > 0) || !(step.depth() > 0) || step.x() - step.width() / 2 < 0 || step.x() + step.width() / 2 > width) {
            throw new IllegalArgumentException("입구 발판이 방 앞끝 밖으로 나가요: " + id);
        }
    }

    /** 기본 방: 8×11, 뒷벽·양옆 벽에 걸고, 앞 가운데 입구 발판(폭 2, 깊이 0.7)이 밖으로 가는 길이다. */
    public static final LobbyRoom BASIC = new LobbyRoom(
            "basic", 8, 11, 3.2, 0.4,
            List.of("back", "left", "right"),
            List.of(new OutsideExit(4, 2.0, 0.7))
    );

    /** 아는 방 목록. */
    public static final List<LobbyRoom> ROOMS = List.of(BASIC);

    /** 지금 방(늘 기본 방). */
    public static LobbyRoom current() {
        return BASIC;
    }

    /** 벽을 따라간 자리의 범위(벽 길이). 뒷벽은 방 폭, 옆벽은 방 깊이다. */
    public double wallLength(String wall) {
        return "back".equals(wall) ? width : depth;
    }

    /** 밖으로 출입구(방마다 정확히 하나다). */
    public OutsideExit outsideExit() {
        return exits.stream().filter(OutsideExit.class::isInstance).map(OutsideExit.class::cast).findFirst().orElseThrow();
    }
}
