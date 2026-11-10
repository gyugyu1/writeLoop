// [spec] qa 테스트(작업 066-⑥ 방 구조 데이터, 새 기능, 모바일): 엔진·편집 모드·3D 가구 자리·저장 본문 검사가 지금 방의 데이터를 읽는지.
// 시험용 방 T(9×13, 벽 높이 3.6, 벽 두께 0.5, 입구 가운데 x 3.0)를 지금 방으로 바꿔 부른다.
// 기대값은 시나리오(private 작업 폴더 066/07-방-구조-데이터/03-qa-scenarios.md C1~C33)와
// 결정 파일(05-main-decision.md 1: 걸 수 없는 벽에는 놓을 수 없고, 꺼내기는 건너뛰고, 저장 본문 검사도 거절한다)에서만 가져온다.
// 지금 방을 바꾸는 방법(engine의 applyRoom, 바꾼 뒤 applyLobbyLayout으로 배치 값을 다시 계산)과 room 인자는 구현 커밋 0325938에서 부르는 방법만 확인했다.
// 테스트마다 끝나면 기본 방과 처음 배치로 되돌린다.

import {
  MARKS,
  ROOM_BOUNDS,
  TAP_MAX_MOVE_PX,
  applyLobbyLayout,
  applyRoom,
  cameraPose,
  findPath,
  isBlocked,
  isFree,
  nearestOpenSpot,
  roomFitViewWidth,
  type FloorPoint,
  type PointerHit
} from "@/lib/lobby3d/engine";
import { buildPlacements, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { LobbyEditor, freeSpotFor, isPlaceableLayout, nearestWall, wallPieceInFront } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, layoutItem, makeLayout, type FurnitureItem, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { BASIC_ROOM, type RoomSpec, type WallSide } from "@/lib/lobby3d/room";

function roomT(hangWalls: WallSide[] = ["back", "left", "right"]): RoomSpec {
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

function useRoom(room: RoomSpec) {
  applyRoom(room);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
}

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

const DEF = DEFAULT_LOBBY_LAYOUT;
const plus = (...extra: FurnitureItem[]): LobbyLayout => makeLayout([...DEF.items, ...extra], []);
const wardrobe2 = (x: number, z: number, facing: 0 | 1 | 2 | 3 = 0): FurnitureItem => ({ id: "wardrobe-2", type: "wardrobe", floor: { x, z, facing } });
const frame1 = (wall: WallSide, along: number): FurnitureItem => ({ id: "frame-1", type: "frame", wall: { wall, along } });
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const hit = (point: FloorPoint | null, piece: string | null = null): PointerHit => ({ point, mark: null, onCharacter: false, piece });

describe("[spec] T의 엔진(C1~C6)", () => {
  it("C1: 밖으로 장소는 서는 자리 [(3.0, 12.5)], 바라볼 지점 (3.0, 13.35)", () => {
    useRoom(roomT());
    expect(MARKS.door.approach).toEqual([{ x: 3.0, z: 12.5 }]);
    expect(MARKS.door.faceTo.x).toBe(3.0);
    expect(MARKS.door.faceTo.z).toBeCloseTo(13.35, 9);
  });

  it("C2: isBlocked는 T의 가로·깊이로 막는다", () => {
    useRoom(roomT());
    expect(isBlocked(8.7, 12.9)).toBe(false);
    expect(isBlocked(8.8, 5)).toBe(true);
    expect(isBlocked(4, 13.05)).toBe(true);
    expect(isBlocked(0.2, 5)).toBe(true);
  });

  it("C3: T의 입구 서는 자리 (3.0, 12.5)에 설 수 있다", () => {
    useRoom(roomT());
    expect(isFree(3.0, 12.5)).toBe(true);
  });

  it("C4: T에서는 (8.2, 12.5)까지 길이 있고, 기본 방에서는 없다", () => {
    useRoom(roomT());
    const path = findPath({ x: 3, z: 12.5 }, [{ x: 8.2, z: 12.5 }]);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 8.2, z: 12.5 });
    applyRoom(BASIC_ROOM);
    applyLobbyLayout(DEF);
    expect(findPath({ x: 3, z: 10.5 }, [{ x: 8.2, z: 12.5 }])).toBeNull();
  });

  it("C5: T의 입구에서 책상 서는 자리까지 길이 있다", () => {
    useRoom(roomT());
    const path = findPath({ x: 3, z: 12.5 }, MARKS.desk.approach);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 1.5, z: 6.75 });
  });

  it("C6: nearestOpenSpot((8.9, 12.9))는 (7.5, 12.5)", () => {
    useRoom(roomT());
    expect(nearestOpenSpot({ x: 8.9, z: 12.9 })).toEqual({ x: 7.5, z: 12.5 });
  });
});

describe("[spec] T의 놓을 수 있는 배치(C7~C14)", () => {
  beforeEach(() => useRoom(roomT()));

  it("C7: 처음 배치는 놓을 수 있다", () => {
    expect(isPlaceableLayout(DEF)).toBe(true);
  });

  it("C8: 옷장 (8.5, 12.5)은 T에서 되고 기본 방에서는 안 된다", () => {
    expect(isPlaceableLayout(plus(wardrobe2(8.5, 12.5)))).toBe(true);
    expect(isPlaceableLayout(plus(wardrobe2(8.5, 12.5)), BASIC_ROOM)).toBe(false);
  });

  it("C9: 옷장 (9.5, 5.5)은 방 밖이라 안 된다", () => {
    expect(isPlaceableLayout(plus(wardrobe2(9.5, 5.5)))).toBe(false);
  });

  it("C10: 액자 뒷벽 8.0은 되고(기본 방은 안 됨) 8.5는 안 된다", () => {
    expect(isPlaceableLayout(plus(frame1("back", 8.0)))).toBe(true);
    expect(isPlaceableLayout(plus(frame1("back", 8.0)), BASIC_ROOM)).toBe(false);
    expect(isPlaceableLayout(plus(frame1("back", 8.5)))).toBe(false);
  });

  it("C11: 액자 오른벽 12.0은 되고(기본 방은 안 됨) 12.5는 안 된다", () => {
    expect(isPlaceableLayout(plus(frame1("right", 12.0)))).toBe(true);
    expect(isPlaceableLayout(plus(frame1("right", 12.0)), BASIC_ROOM)).toBe(false);
    expect(isPlaceableLayout(plus(frame1("right", 12.5)))).toBe(false);
  });

  it("C12: 오른벽 가구 바로 아래 칸은 x 8~9다", () => {
    expect(isPlaceableLayout(plus(wardrobe2(8.5, 5.5, 3)))).toBe(true);
    expect(isPlaceableLayout(plus(wardrobe2(8.5, 5.5, 3), frame1("right", 5.5)))).toBe(false);
  });

  it("C13: T의 입구 서는 자리를 막는 옷장 (2.5, 12.5)은 안 된다", () => {
    expect(isPlaceableLayout(plus(wardrobe2(2.5, 12.5)))).toBe(false);
  });

  it("C14: 옷장 (4.5, 10.5)은 T에서 되고, 기본 방에서는 입구를 막아 안 된다", () => {
    expect(isPlaceableLayout(plus(wardrobe2(4.5, 10.5)))).toBe(true);
    expect(isPlaceableLayout(plus(wardrobe2(4.5, 10.5)), BASIC_ROOM)).toBe(false);
  });
});

describe("[spec] T의 편집 모드(C15~C23)", () => {
  beforeEach(() => useRoom(roomT()));

  it("C15: 보관함에서 꺼낸 옷장은 (4.5, 6.5, 방향 0)에 놓이고 골라진다", () => {
    const editor = new LobbyEditor(makeLayout(DEF.items.filter((item) => item.id !== "wardrobe"), [{ id: "wardrobe", type: "wardrobe" }]));
    expect(editor.takeOut("wardrobe")).toBeNull();
    expect(layoutItem(editor.layout, "wardrobe")).toEqual({ id: "wardrobe", type: "wardrobe", floor: { x: 4.5, z: 6.5, facing: 0 } });
    expect(editor.selected).toBe("wardrobe");
  });

  it("C16: 가구 더하기로 만든 plant-1은 (4.5, 6.5, 방향 0)", () => {
    const editor = new LobbyEditor(DEF);
    expect(editor.addNew("plant")).toBeNull();
    expect(layoutItem(editor.layout, "plant-1")).toEqual({ id: "plant-1", type: "plant", floor: { x: 4.5, z: 6.5, facing: 0 } });
  });

  it("C17: 벽 가구가 없는 배치에 꺼낸 액자는 T 뒷벽 가운데 4.5", () => {
    const noWall = makeLayout(DEF.items.filter((item) => !item.wall), []);
    expect(freeSpotFor(noWall, { id: "frame-1", type: "frame" })).toEqual({ id: "frame-1", type: "frame", wall: { wall: "back", along: 4.5 } });
  });

  it("C18: nearestWall((4.4, 4.0))는 뒷벽 4.4", () => {
    expect(nearestWall({ x: 4.4, z: 4.0 })).toEqual({ wall: "back", along: 4.4 });
  });

  it("C19: 오른벽 액자 앞 바닥 (8.5, 5)는 그 액자", () => {
    expect(wallPieceInFront(plus(frame1("right", 5)), { x: 8.5, z: 5 })).toBe("frame-1");
  });

  it("C20: 바닥 (8.5, 5)를 눌러 오른벽 액자를 고르면 focus는 (8, 5)", () => {
    const editor = new LobbyEditor(plus(frame1("right", 5)));
    editor.pointerDown(hit({ x: 8.5, z: 5 }), 0, 0);
    editor.pointerUp();
    expect(editor.selected).toBe("frame-1");
    expect(editor.focus()).toEqual({ x: 8, z: 5 });
  });

  it("C21·C22: 끌기 범위는 T 깊이 13 + 1.5까지(12.8은 옮기고 14.6은 옮기지 않는다)", () => {
    expect(100).toBeGreaterThan(TAP_MAX_MOVE_PX);
    const editor = new LobbyEditor(plus(wardrobe2(5.5, 10.5)));
    editor.pointerDown(hit({ x: 5.5, z: 10.5 }, "wardrobe-2"), 0, 0);
    editor.pointerMove(hit({ x: 5.5, z: 12.8 }), 0, 100);
    expect(layoutItem(editor.layout, "wardrobe-2")!.floor).toEqual({ x: 5.5, z: 12.5, facing: 0 });
    editor.pointerMove(hit({ x: 5.5, z: 14.6 }), 0, 150);
    expect(layoutItem(editor.layout, "wardrobe-2")!.floor).toEqual({ x: 5.5, z: 12.5, facing: 0 });
    expect(editor.pointerUp()).toBeNull();
    expect(layoutItem(editor.layout, "wardrobe-2")!.floor).toEqual({ x: 5.5, z: 12.5, facing: 0 });
  });

  it("C23: 오른벽 6에 건 창문의 장소 구역", () => {
    const layout = makeLayout(DEF.items.map((item) => (item.id === "window" ? { id: "window", type: "window", wall: { wall: "right" as const, along: 6 } } : item)), []);
    const editor = new LobbyEditor(layout);
    editor.pointerDown(hit(null, "window"), 0, 0);
    editor.pointerUp();
    expect(editor.selected).toBe("window");
    const zone = editor.zone()!;
    expect({
      place: zone.place,
      center: { x: r6(zone.center.x), z: r6(zone.center.z) },
      reach: zone.reach,
      radius: zone.radius,
      approach: zone.approach.map((p) => ({ x: r6(p.x), z: r6(p.z) }))
    }).toEqual({
      place: "window",
      center: { x: 7.45, z: 6 },
      reach: { x: 9, z: 6 },
      radius: 1,
      approach: [
        { x: 7.45, z: 5.7 },
        { x: 7.45, z: 6.3 }
      ]
    });
  });
});

describe("[spec] T의 3D 가구 자리·카메라(C24~C29)", () => {
  beforeEach(() => useRoom(roomT()));

  it("C24: 입구 발판은 (3.0, 0, 13.35), 나머지 가구 자리는 기본 방과 같다", () => {
    const list = furniturePlacements(DEF);
    const exit = list[list.length - 1];
    expect({ ...exit, z: r6(exit.z) }).toEqual({ item: "exit", piece: "exit", mount: "floor", x: 3.0, y: 0, z: 13.35, rotY: 0, mark: "door" });
    applyRoom(BASIC_ROOM);
    const basic = furniturePlacements(DEF);
    expect(list.slice(0, -1)).toEqual(basic.slice(0, -1));
  });

  it("C25: 오른벽 5에 건 액자 그림은 x 8.958", () => {
    const piece = layoutGeometry(plus(frame1("right", 5)), 9).pieces.find((p) => p.item === "frame-1")!;
    expect({ x: r6(piece.x), y: piece.y, z: r6(piece.z), rotY: r6(piece.rotY) }).toEqual({ x: 8.958, y: 2, z: 5, rotY: r6(-Math.PI / 2) });
  });

  it("C26: 보관함 가구는 T의 방 가운데·뒷벽 가운데에 만든다", () => {
    const layout = makeLayout(
      DEF.items.filter((item) => item.id !== "wardrobe"),
      [
        { id: "wardrobe", type: "wardrobe" },
        { id: "frame-1", type: "frame" },
        { id: "books-1", type: "books" }
      ]
    );
    const stowed = buildPlacements(layout)
      .filter((p) => p.stowed)
      .map((p) => ({ item: p.item, x: r6(p.x), y: r6(p.y), z: r6(p.z), rotY: p.rotY }));
    expect(stowed).toEqual([
      { item: "frame-1", x: 4.5, y: 2, z: 0.042, rotY: 0 },
      { item: "wardrobe", x: 4.5, y: 0, z: 6.438, rotY: 0 },
      { item: "books-1", x: 0.5, y: 1.292, z: 5.5, rotY: 0 }
    ]);
  });

  it("C27: 방 끝 상자", () => {
    const b = { ...ROOM_BOUNDS };
    expect(Object.fromEntries(Object.entries(b).map(([k, v]) => [k, r6(v)]))).toEqual({ minX: -0.5, maxX: 9.5, minY: -0.25, maxY: 3.6, minZ: -0.5, maxZ: 13.7 });
  });

  it("C28: 방이 가로로 다 들어오면 카메라는 x 4.5를 본다", () => {
    expect(r6(cameraPose({ x: 0.5, z: 6.5 }, 30, 0.46).lookAt.x)).toBe(4.5);
  });

  it("C29: roomFitViewWidth(0.46)는 12.092085", () => {
    expect(roomFitViewWidth(0.46)).toBeCloseTo(12.092085, 6);
  });
});

describe("[spec] T의 저장 본문 검사(C30~C33)", () => {
  beforeEach(() => useRoom(roomT()));

  const base = () => toLobbyLayoutPayload(DEF);
  const ok = (id: string, patch: object) =>
    parseLobbyLayoutPayload({ ...base(), items: base().items.map((item) => (item.id === id ? { id: item.id, type: item.type, ...patch } : item)) }) !== null;

  it("C30: 옷장 x 9는 받고 9.01은 거절한다", () => {
    expect(ok("wardrobe", { floor: { x: 9, z: 3.5, facing: 3 } })).toBe(true);
    expect(ok("wardrobe", { floor: { x: 9.01, z: 3.5, facing: 3 } })).toBe(false);
  });

  it("C31: 옷장 z 13은 받고 13.01은 거절한다", () => {
    expect(ok("wardrobe", { floor: { x: 7.5, z: 13, facing: 3 } })).toBe(true);
    expect(ok("wardrobe", { floor: { x: 7.5, z: 13.01, facing: 3 } })).toBe(false);
  });

  it("C32: 게시판 뒷벽 9는 받고 9.01은 거절한다", () => {
    expect(ok("board", { wall: { wall: "back", along: 9 } })).toBe(true);
    expect(ok("board", { wall: { wall: "back", along: 9.01 } })).toBe(false);
  });

  it("C33: 게시판 오른벽 13은 받고 13.01은 거절한다", () => {
    expect(ok("board", { wall: { wall: "right", along: 13 } })).toBe(true);
    expect(ok("board", { wall: { wall: "right", along: 13.01 } })).toBe(false);
  });
});

describe("[spec] 걸 수 없는 벽(05 결정 1)", () => {
  it("H1: 오른벽에 걸 수 없는 방에서는 오른벽 액자를 놓을 수 없고, 왼벽 액자는 놓을 수 있다", () => {
    useRoom(roomT(["back", "left"]));
    expect(isPlaceableLayout(plus(frame1("right", 5)))).toBe(false);
    expect(isPlaceableLayout(plus(frame1("left", 9)))).toBe(true);
  });

  it("H2: 꺼내기는 걸 수 없는 벽을 건너뛴다(오른벽만 → 오른벽 6.5, 왼벽·오른벽 → 왼벽 6.5)", () => {
    const noWall = makeLayout(DEF.items.filter((item) => !item.wall), []);
    useRoom(roomT(["right"]));
    expect(freeSpotFor(noWall, { id: "frame-1", type: "frame" })).toEqual({ id: "frame-1", type: "frame", wall: { wall: "right", along: 6.5 } });
    useRoom(roomT(["left", "right"]));
    expect(freeSpotFor(noWall, { id: "frame-1", type: "frame" })).toEqual({ id: "frame-1", type: "frame", wall: { wall: "left", along: 6.5 } });
  });

  it("H3: 저장 본문 검사는 걸 수 없는 벽의 가구를 거절한다", () => {
    useRoom(roomT(["back", "left"]));
    const base = toLobbyLayoutPayload(DEF);
    expect(parseLobbyLayoutPayload(base)).not.toBeNull();
    expect(parseLobbyLayoutPayload({ ...base, items: [...base.items, frame1("right", 5)] })).toBeNull();
    expect(parseLobbyLayoutPayload({ ...base, items: [...base.items, frame1("left", 5)] })).not.toBeNull();
  });
});
