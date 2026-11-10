// [spec] qa 테스트(작업 066-⑥ 방 구조 데이터, 새 기능, 모바일): 방 데이터(기본 방, 방 목록, 지금 방, 잘못된 방 거절)와
// 밖으로 장소를 그 방의 입구 발판에서 계산하는지.
// 기대값은 시나리오(private 작업 폴더 066/07-방-구조-데이터/03-qa-scenarios.md A1~A10)와 결정 파일(05-main-decision.md 2: 바라볼 지점은
// 입구 발판 가운데 = 깊이 + 발판 깊이 / 2)에서만 가져온다.
// 부르는 이름(room.ts의 BASIC_ROOM·ROOMS·currentRoom·makeRoom, engine의 applyRoom·MARKS·ROOM_BOUNDS, furniture-layout의 furniturePlacements)은
// 구현 커밋 0325938·3f3b99c에서 부르는 방법만 확인했다. makeRoom은 잘못된 방이면 던진다("거절").
// 지금 방을 바꾼 테스트는 끝난 뒤 기본 방과 처음 배치로 되돌린다.

import { MARKS, ROOM_BOUNDS, applyLobbyLayout, applyRoom } from "@/lib/lobby3d/engine";
import { furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, ROOMS, currentRoom, makeRoom, type RoomSpec } from "@/lib/lobby3d/room";

/** 시험용 방 T(시나리오 0절): 9×13, 벽 높이 3.6, 벽 두께 0.5, 세 벽에 걸고, 밖으로 출입구 하나(가운데 x 3.0, 폭 2.0, 깊이 0.7). */
function roomT(patch: Partial<RoomSpec> = {}): RoomSpec {
  return {
    id: "qa-test",
    width: 9,
    depth: 13,
    wallHeight: 3.6,
    wallThickness: 0.5,
    hangWalls: ["back", "left", "right"],
    exits: [{ kind: "outside", x: 3.0, width: 2.0, depth: 0.7 }],
    ...patch
  };
}

const outside = (x: number, width = 2.0, depth = 0.7) => ({ kind: "outside" as const, x, width, depth });

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

describe("[spec] 방 데이터(A1~A4)", () => {
  it("A1: 기본 방은 basic, 8×11, 벽 높이 3.2, 벽 두께 0.4, 세 벽에 걸고, 밖으로 출입구 하나(가운데 x 4, 폭 2.0, 깊이 0.7)", () => {
    expect(BASIC_ROOM.id).toBe("basic");
    expect(BASIC_ROOM.width).toBe(8);
    expect(BASIC_ROOM.depth).toBe(11);
    expect(BASIC_ROOM.wallHeight).toBe(3.2);
    expect(BASIC_ROOM.wallThickness).toBe(0.4);
    expect([...BASIC_ROOM.hangWalls].sort()).toEqual(["back", "left", "right"]);
    expect(BASIC_ROOM.exits).toEqual([{ kind: "outside", x: 4, width: 2.0, depth: 0.7 }]);
  });

  it("A2: 앱의 방 목록에는 방이 하나이고 그 id가 basic이다", () => {
    expect(ROOMS.map((room) => room.id)).toEqual(["basic"]);
  });

  it("A3: 지금 방은 기본 방이다", () => {
    expect(currentRoom()).toEqual(BASIC_ROOM);
    expect(currentRoom().id).toBe("basic");
  });

  it("A4: 기본 방의 값으로 방을 만들면 거절하지 않는다", () => {
    expect(() => makeRoom({ ...BASIC_ROOM })).not.toThrow();
  });
});

describe("[spec] 잘못된 방 거절(A5~A10)", () => {
  it("A5: 8×11과 9×13은 받는다", () => {
    expect(() => makeRoom(roomT({ width: 8, depth: 11, exits: [outside(4)] }))).not.toThrow();
    expect(() => makeRoom(roomT())).not.toThrow();
  });

  it("A6: 가로·깊이 중 하나라도 기본 방보다 작으면 거절한다(7×11, 8×10, 9×10)", () => {
    expect(() => makeRoom(roomT({ width: 7, depth: 11, exits: [outside(3.5)] }))).toThrow();
    expect(() => makeRoom(roomT({ width: 8, depth: 10, exits: [outside(4)] }))).toThrow();
    expect(() => makeRoom(roomT({ width: 9, depth: 10 }))).toThrow();
  });

  it("A7: 칸 수가 정수가 아니면 거절한다(8.5×11, 8×11.5)", () => {
    expect(() => makeRoom(roomT({ width: 8.5, depth: 11, exits: [outside(4)] }))).toThrow();
    expect(() => makeRoom(roomT({ width: 8, depth: 11.5, exits: [outside(4)] }))).toThrow();
  });

  it("A8: 밖으로 출입구가 없거나 둘이면 거절한다", () => {
    expect(() => makeRoom(roomT({ exits: [] }))).toThrow();
    expect(() => makeRoom(roomT({ exits: [outside(3.0), outside(6.0)] }))).toThrow();
  });

  it("A9: 입구 발판이 앞끝 밖으로 나가면 거절한다(왼끝 −0.1, 오른끝 9.2, 가운데 x 10)", () => {
    expect(() => makeRoom(roomT({ exits: [outside(0.9)] }))).toThrow();
    expect(() => makeRoom(roomT({ exits: [outside(8.2)] }))).toThrow();
    expect(() => makeRoom(roomT({ exits: [outside(10)] }))).toThrow();
  });

  it("A10: 입구 발판이 앞끝 안이면 받는다(가운데 x 4.5, 왼끝이 정확히 0인 가운데 x 1.0)", () => {
    expect(() => makeRoom(roomT({ exits: [outside(4.5)] }))).not.toThrow();
    expect(() => makeRoom(roomT({ exits: [outside(1.0)] }))).not.toThrow();
  });
});

describe("[spec] 밖으로 장소는 입구 발판에서 계산(05 결정 2)", () => {
  it("기본 방: 서는 자리 (4.0, 10.5), 바라볼 지점 (4.0, 11.35)", () => {
    expect(MARKS.door.approach).toEqual([{ x: 4.0, z: 10.5 }]);
    expect(MARKS.door.faceTo).toEqual({ x: 4.0, z: 11.35 });
  });

  it("발판 깊이 0.9인 방: 바라볼 지점 (3.0, 13.45), 서는 자리 (3.0, 12.5), 입구 발판 자리 z 13.45, 방 끝 상자 앞끝 13.9", () => {
    applyRoom(roomT({ exits: [outside(3.0, 2.0, 0.9)] }));
    applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
    expect(MARKS.door.approach).toEqual([{ x: 3.0, z: 12.5 }]);
    expect(MARKS.door.faceTo.x).toBe(3.0);
    expect(MARKS.door.faceTo.z).toBeCloseTo(13.45, 9);
    const exit = furniturePlacements(DEFAULT_LOBBY_LAYOUT).find((p) => p.item === "exit")!;
    expect(exit.x).toBe(3.0);
    expect(exit.z).toBeCloseTo(13.45, 9);
    expect(ROOM_BOUNDS.maxZ).toBeCloseTo(13.9, 9);
  });
});
