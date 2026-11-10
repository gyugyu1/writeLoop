// [spec] qa 테스트(작업 066-⑥ 방 구조 데이터, 새 기능, 모바일): 배치를 다른 방으로 옮기는 함수(방에 배치 맞추기).
// 기대값은 시나리오(private 작업 폴더 066/07-방-구조-데이터/03-qa-scenarios.md D1~D12)와
// 결정 파일(05-main-decision.md 1: 걸 수 없는 벽에 걸려 있던 가구는 보관함으로, 장소 가구는 걸 수 있는 다른 벽으로)에서만 가져온다.
// 부르는 이름 fitLayoutToRoom(layout, room)과 isPlaceableLayout(layout, room)은 구현 커밋 0325938에서 부르는 방법만 확인했다.
// 방 가구는 순서를 보지 않고(id마다 종류와 자리), 보관함은 순서까지 본다.

import { fitLayoutToRoom, isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, storedItems, type FurnitureItem, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";
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

/** 처음 배치 7개(시나리오 D절 머리말의 "처음 배치 그대로"). */
function defaultItems(): FurnitureItem[] {
  return [
    { id: "desk", type: "desk", floor: { x: 1.5, z: 5.5, facing: 0 } },
    { id: "bookcase", type: "bookcase", floor: { x: 0.5, z: 2.5, facing: 1 } },
    { id: "wardrobe", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } },
    { id: "rug", type: "rug", floor: { x: 4.6, z: 7.2, facing: 0 } },
    { id: "board", type: "board", wall: { wall: "back", along: 1.8 } },
    { id: "window", type: "window", wall: { wall: "back", along: 4.8 } },
    { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } }
  ];
}

/** 처음 배치에서 id 하나만 자리를 바꾼 가구 목록. */
function replaced(id: string, patch: Omit<FurnitureItem, "id" | "type">): FurnitureItem[] {
  return defaultItems().map((item) => (item.id === id ? { id: item.id, type: item.type, ...patch } : item));
}

const byId = (items: FurnitureItem[]) => [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** 결과 방의 가구(순서 무관)와 보관함(순서 포함)을 확인하고, 새 방에서 놓을 수 있는 배치인지(D12)도 본다. */
function expectFit(result: LobbyLayout, room: RoomSpec, items: FurnitureItem[], stored: StoredItem[]) {
  expect(byId(result.items)).toEqual(byId(items));
  expect(storedItems(result)).toEqual(stored);
  expect(isPlaceableLayout(result, room)).toBe(true);
}

describe("[spec] 규칙 1: 그대로 둔다(D1·D2)", () => {
  it("D1: 처음 배치 → 기본 방은 그대로", () => {
    const result = fitLayoutToRoom(DEFAULT_LOBBY_LAYOUT, BASIC_ROOM);
    expect(result).toEqual(DEFAULT_LOBBY_LAYOUT);
    expectFit(result, BASIC_ROOM, defaultItems(), []);
  });

  it("D2: 처음 배치 → T는 그대로", () => {
    const result = fitLayoutToRoom(DEFAULT_LOBBY_LAYOUT, roomT());
    expect(result).toEqual(DEFAULT_LOBBY_LAYOUT);
    expectFit(result, roomT(), defaultItems(), []);
  });
});

describe("[spec] 규칙 2·3: 하나씩 다시 놓기(D3~D11), 기본 방으로", () => {
  it("D3: 방 밖이 된 옷장은 보관함 끝에, 보관함에 있던 액자는 그대로 앞에", () => {
    const layout = makeLayout([...defaultItems(), { id: "wardrobe-2", type: "wardrobe", floor: { x: 8.5, z: 12.5, facing: 0 } }], [{ id: "frame-1", type: "frame" }]);
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, defaultItems(), [
      { id: "frame-1", type: "frame" },
      { id: "wardrobe-2", type: "wardrobe" }
    ]);
  });

  it("D4: 방 밖이 된 책장(장소 가구)은 방 가운데에서 가까운 (3.5, 5.5, 방향 0)으로 옮긴다", () => {
    const layout = makeLayout(replaced("bookcase", { floor: { x: 6.5, z: 11.5, facing: 0 } }), []);
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, replaced("bookcase", { floor: { x: 3.5, z: 5.5, facing: 0 } }), []);
  });

  it("D5: 장소 가구를 먼저 놓아, 그 자리에 있던 옷장은 기본 방 안이어도 보관함으로 간다", () => {
    const layout = makeLayout(
      [...replaced("bookcase", { floor: { x: 6.5, z: 11.5, facing: 0 } }), { id: "wardrobe-2", type: "wardrobe", floor: { x: 3.5, z: 5.5, facing: 0 } }],
      []
    );
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, replaced("bookcase", { floor: { x: 3.5, z: 5.5, facing: 0 } }), [
      { id: "wardrobe-2", type: "wardrobe" }
    ]);
  });

  it("D6: 오른벽 11.5에서 벽 밖이 된 창문(장소 가구)은 뒷벽 4.0으로 옮긴다", () => {
    const layout = makeLayout(replaced("window", { wall: { wall: "right", along: 11.5 } }), []);
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, replaced("window", { wall: { wall: "back", along: 4.0 } }), []);
  });

  it("D7: 보관함에 가는 받침 가구 위 소품은 받침 가구 바로 다음에 함께 간다", () => {
    const layout = makeLayout(
      [
        ...defaultItems(),
        { id: "nightstand-1", type: "nightstand", floor: { x: 8.5, z: 12.5, facing: 0 } },
        { id: "floorLamp-1", type: "floorLamp", floor: { x: 6.5, z: 12.5, facing: 0 } },
        { id: "books-1", type: "books", on: { parent: "nightstand-1", slot: 0, facing: 0 } }
      ],
      [{ id: "plant-1", type: "plant" }]
    );
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, defaultItems(), [
      { id: "plant-1", type: "plant" },
      { id: "nightstand-1", type: "nightstand" },
      { id: "books-1", type: "books" },
      { id: "floorLamp-1", type: "floorLamp" }
    ]);
  });

  it("D8: 받침 가구가 방에 남으면 위 소품도 그대로 남는다", () => {
    const layout = makeLayout(
      [
        ...defaultItems(),
        { id: "nightstand-1", type: "nightstand", floor: { x: 8.5, z: 12.5, facing: 0 } },
        { id: "nightstand-2", type: "nightstand", floor: { x: 6.5, z: 9.5, facing: 0 } },
        { id: "floorLamp-1", type: "floorLamp", floor: { x: 6.5, z: 12.5, facing: 0 } },
        { id: "books-1", type: "books", on: { parent: "nightstand-1", slot: 0, facing: 0 } },
        { id: "smallPlant-1", type: "smallPlant", on: { parent: "nightstand-2", slot: 0, facing: 1 } }
      ],
      [{ id: "plant-1", type: "plant" }]
    );
    expectFit(
      fitLayoutToRoom(layout, BASIC_ROOM),
      BASIC_ROOM,
      [
        ...defaultItems(),
        { id: "nightstand-2", type: "nightstand", floor: { x: 6.5, z: 9.5, facing: 0 } },
        { id: "smallPlant-1", type: "smallPlant", on: { parent: "nightstand-2", slot: 0, facing: 1 } }
      ],
      [
        { id: "plant-1", type: "plant" },
        { id: "nightstand-1", type: "nightstand" },
        { id: "books-1", type: "books" },
        { id: "floorLamp-1", type: "floorLamp" }
      ]
    );
  });

  it("D9: 옮겨진 책상 위 스탠드는 책상 자리 0에 그대로 남는다", () => {
    const layout = makeLayout(replaced("desk", { floor: { x: 6.5, z: 12.5, facing: 0 } }), []);
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, replaced("desk", { floor: { x: 3.5, z: 5.5, facing: 0 } }), []);
  });

  it("D10: 벽 밖이 된 액자(장소 가구 아님)는 보관함으로", () => {
    const layout = makeLayout([...defaultItems(), { id: "frame-1", type: "frame", wall: { wall: "right", along: 12 } }], []);
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, defaultItems(), [{ id: "frame-1", type: "frame" }]);
  });

  it("D11: 기본 방 입구 (4, 10.5)를 막는 옷장은 방 안이어도 보관함으로", () => {
    const layout = makeLayout([...defaultItems(), { id: "wardrobe-2", type: "wardrobe", floor: { x: 4.5, z: 10.5, facing: 0 } }], []);
    expect(isPlaceableLayout(layout, roomT())).toBe(true);
    expectFit(fitLayoutToRoom(layout, BASIC_ROOM), BASIC_ROOM, defaultItems(), [{ id: "wardrobe-2", type: "wardrobe" }]);
  });
});

describe("[spec] 걸 수 없는 벽으로 맞추기(05 결정 1)", () => {
  it("H4: 오른벽에 걸 수 없는 방으로 옮기면 오른벽 액자는 보관함으로, 오른벽 창문(장소 가구)은 뒷벽 4.5로", () => {
    const layout = makeLayout(
      [...replaced("window", { wall: { wall: "right", along: 6 } }), { id: "frame-1", type: "frame", wall: { wall: "right", along: 11 } }],
      []
    );
    const room = roomT(["back", "left"]);
    expectFit(fitLayoutToRoom(layout, room), room, replaced("window", { wall: { wall: "back", along: 4.5 } }), [{ id: "frame-1", type: "frame" }]);
  });
});
