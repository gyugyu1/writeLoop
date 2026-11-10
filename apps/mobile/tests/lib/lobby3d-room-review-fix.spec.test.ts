// [spec] qa 재현 테스트(작업 066-⑥ 방 구조 데이터, 검증 지적 뒤 테스트 더하기, 모바일).
// 기대값은 결정 파일(private 작업 폴더 066/07-방-구조-데이터/11-main-decision.md)에서만 가져온다.
// - 결정 1(명세 1을 바꿈): 걸 수 있는 벽이 하나도 없거나 모르는 벽 이름(back·left·right 밖)이 들어 있으면 잘못된 방이다.
//   테스트 커밋 시점(고치기 전)에는 실패가 맞다.
// - 결정 2의 의심 3: 지금 방 바꾸기(applyRoom)가 지금 배치에서 계산하는 값(장소의 서는 자리·바라볼 지점, 막힌 칸, 의자)도 새 방으로 다시 계산한다.
//   applyRoom만 부르고 applyLobbyLayout은 부르지 않는다. 테스트 커밋 시점에는 실패가 맞다.
// 오른벽 장소 가구의 서는 자리·바라볼 지점 값은 시나리오(03-qa-scenarios.md C23)와 같은 계산이다(오른벽 6의 창문: 기본 방은 벽 면 x 8, 가로 9인 방은 x 9).
// 부르는 이름(room.ts의 makeRoom·BASIC_ROOM, engine의 applyRoom·applyLobbyLayout·activeLobbyLayout·MARKS·SOLID_TILES·CHAIR,
// lobby-layout의 layoutGeometry)은 구현 커밋에서 부르는 방법만 확인했다. 지금 방을 바꾼 테스트는 끝난 뒤 기본 방과 처음 배치로 되돌린다.

import { CHAIR, MARKS, SOLID_TILES, activeLobbyLayout, applyLobbyLayout, applyRoom } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, makeLayout, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, makeRoom, type RoomSpec, type WallSide } from "@/lib/lobby3d/room";

function roomT(hangWalls: readonly WallSide[] = ["back", "left", "right"]): RoomSpec {
  return {
    id: "qa-test",
    width: 9,
    depth: 13,
    wallHeight: 3.6,
    wallThickness: 0.5,
    hangWalls,
    exits: [{ kind: "outside", x: 3.0, width: 2.0, depth: 0.7 }]
  };
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const rp = (p: { x: number; z: number }) => ({ x: r6(p.x), z: r6(p.z) });

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

describe("[spec] 결정 1: 걸 수 있는 벽 규칙(고치기 전에는 실패가 맞다)", () => {
  it("R1: 걸 수 있는 벽이 하나도 없는 방은 만들 수 없다", () => {
    expect(() => makeRoom(roomT([]))).toThrow();
  });

  it("R2: 모르는 벽 이름이 든 방은 만들 수 없다(front, ceiling)", () => {
    expect(() => makeRoom(roomT(["back", "front" as unknown as WallSide]))).toThrow();
    expect(() => makeRoom(roomT(["ceiling" as unknown as WallSide]))).toThrow();
  });

  it("R3: 걸 수 있는 벽이 하나 이상이고 모두 아는 이름이면 받는다(기준 확인, 뒷벽만 / 오른벽만)", () => {
    expect(() => makeRoom(roomT(["back"]))).not.toThrow();
    expect(() => makeRoom(roomT(["right"]))).not.toThrow();
  });
});

describe("[spec] 의심 3: applyRoom이 지금 배치에서 계산하는 값도 새 방으로 다시 계산한다(고치기 전에는 실패가 맞다)", () => {
  it("R4: 창문을 오른벽 6에 둔 배치에서 가로 9인 방으로 applyRoom만 부르면 창문 장소·막힌 칸·의자가 새 방 기준이다", () => {
    const layout: LobbyLayout = makeLayout(
      DEFAULT_LOBBY_LAYOUT.items.map((item) => (item.id === "window" ? { id: "window", type: "window", wall: { wall: "right" as const, along: 6 } } : item)),
      []
    );
    applyLobbyLayout(layout);
    // 기본 방에서는 오른벽 면이 x 8이다(준비가 맞는지)
    expect(rp(MARKS.window.faceTo)).toEqual({ x: 8, z: 6 });

    applyRoom(roomT());

    expect(activeLobbyLayout()).toBe(layout);
    expect(rp(MARKS.window.faceTo)).toEqual({ x: 9, z: 6 });
    expect(MARKS.window.approach.map(rp)).toEqual([
      { x: 7.45, z: 5.7 },
      { x: 7.45, z: 6.3 }
    ]);
    const expected = layoutGeometry(layout, 9);
    expect([...SOLID_TILES].sort()).toEqual([...expected.solidTiles].sort());
    expect({ ...CHAIR }).toEqual(expected.chair);
    // 뒷벽 장소는 방 가로와 관계없어 그대로다
    expect(MARKS.board.approach.map(rp)).toEqual([
      { x: 1.6, z: 1.3 },
      { x: 2.2, z: 1.3 }
    ]);
  });
});
