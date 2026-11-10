// [spec] qa 테스트(작업 075 꾸미기: 들린 가구를 탭으로 옮기기, 기능 변경, 모바일): 편집기(LobbyEditor) 단위로
// 가구가 골라져(들려) 있을 때의 탭이 명세의 새 동작대로인지 본다.
// 기대값은 명세(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/01-main-spec.md의 "바뀌는 동작" 1)에서만 가져온다.
// - 골라진 가구 자신을 탭하면 확정(고르기가 풀린다). 그 밖의 곳을 탭하면 골라진 가구를 탭한 곳으로 옮기고 골라진 채로 둔다.
// - 옮길 자리: 끌기와 같은 칸 맞춤. 바닥 가구·깔개는 탭한 바닥 점에 가구 가운데가 오게(칸에 맞춘 가장 가까운 자리, 방향은 그대로),
//   탁상 소품은 탭한 점에서 가장 가까운 받침 가구 위 자리, 벽 가구는 벽을 탭하면 그 벽의 그 자리, 바닥을 탭하면 가장 가까운 벽의 그 자리(반 칸 단위).
// - 둘 수 없으면(겹침, 길 막음, 방 밖, 받침 자리 없음·차 있음, 벽 가구 밑 등 지금 놓기 규칙) 옮기지 않고 안내. 가구는 원래 자리에서 골라진 채,
//   탭한 곳의 다른 가구는 골라지지 않는다.
// 기대 자리는 명세의 규칙(칸 맞춤: 가운데 = round(점 - 크기/2) + 크기/2, 벽 = round(점/0.5)*0.5)과 카탈로그 크기로 손으로 셈했다.
// 둘 수 있는지는 지금 놓기 규칙(isPlaceableLayout, 이번 작업에서 바뀌지 않는 동작)을 따른다.
// 안내 글은 화면 테스트(home-lobby-tap-move.spec.test.tsx)가 본다. 여기서는 pointerUp이 돌려주는 알림이 있는지(null이 아닌지)만 본다
// (가정: 안내는 지금처럼 pointerUp의 반환값으로 화면에 알린다. 값의 이름은 명세가 정하지 않았다).
// 구현 코드는 부르는 방법(LobbyEditor의 생성자·pointerDown·pointerUp·rotate·selected·red·layout, 누르기 결과의 point·piece·wall)을 알려고만 읽었다.
// 빨간 가구(돌려서 놓을 수 없는 자리가 된 가구)가 골라진 채 다른 곳을 탭하는 경우는 결정(같은 폴더 03-main-decision.md의 답 2)에서 가져온다:
// 다른 가구와 같이 탭한 곳으로 옮기고, 그 자리에 둘 수 있으면 빨간 상태가 풀리며, 둘 수 없으면 안내만 뜨고 그대로(빨강)다(R1~R4).

import type { FloorPoint, PointerHit } from "@/lib/lobby3d/engine";
import { LobbyEditor } from "@/lib/lobby3d/lobby-edit";
import { makeLayout, type FurnitureItem, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type Facing = 0 | 1 | 2 | 3;
type Side = "back" | "left" | "right";

const floor = (id: string, type: string, x: number, z: number, facing: Facing): FurnitureItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: Side, along: number): FurnitureItem => ({ id, type, wall: { wall: side, along } });
const on = (id: string, type: string, parent: string, slot: number, facing: Facing = 0): FurnitureItem => ({ id, type, on: { parent, slot, facing } });

/** 처음 배치(N0): 책상·책장·옷장·깔개·게시판·창문·책상 왼쪽 자리의 스탠드. */
const N0_ITEMS: FurnitureItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8),
  on("lamp", "lamp", "desk", 0)
];

function layoutOf(items: FurnitureItem[]): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(items, []))) as LobbyLayout;
}

const N0 = () => layoutOf(N0_ITEMS);

/** 그 id의 가구만 자리를 바꾼 배치. */
function moved(base: LobbyLayout, id: string, place: Partial<FurnitureItem>): LobbyLayout {
  return layoutOf(base.items.map((item) => (item.id === id ? ({ id: item.id, type: item.type, ...place } as FurnitureItem) : item)));
}

function sortedItems(layout: LobbyLayout) {
  return [...layout.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function expectLayout(editor: LobbyEditor, expected: LobbyLayout) {
  expect(sortedItems(editor.layout)).toEqual(sortedItems(expected));
  expect((editor.layout as { stored?: unknown }).stored ?? []).toEqual([]);
}

function floorHit(point: FloorPoint, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece, wall: null };
}

function wallHit(side: Side, along: number, piece: string | null = null): PointerHit {
  const mark = piece === "board" || piece === "window" ? piece : null;
  return { point: null, mark, onCharacter: false, piece, wall: { wall: side, along } };
}

/** 톡(같은 화면 자리에서 누르고 뗀다). 뗄 때의 알림을 돌려준다. */
function tap(editor: LobbyEditor, hit: PointerHit) {
  editor.pointerDown(hit, 200, 300);
  return editor.pointerUp();
}

/** 가구를 톡해 고른다(아무것도 골라지지 않은 상태에서). */
function select(editor: LobbyEditor, hit: PointerHit, id: string) {
  expect(editor.selected).toBeNull();
  expect(tap(editor, hit)).toBeNull();
  expect(editor.selected).toBe(id);
}

const AT = {
  desk: { x: 1.5, z: 5.5 },
  wardrobe: { x: 7.5, z: 3.5 },
  rug: { x: 4.6, z: 7.2 },
  slot0: { x: 0.5, z: 5.5 },
  slot1: { x: 1.5, z: 5.5 },
  slot2: { x: 2.5, z: 5.5 }
} as const;

// ---------- 1. 바닥 가구를 탭으로 옮긴다 ----------

describe("[spec] 075 바뀌는 동작 1: 골라진 바닥 가구를 다른 곳 탭으로 옮긴다", () => {
  test("T1 옷장(7.5, 3.5, 방향 3)을 고른 채 빈 바닥 (5.3, 9.6)을 탭하면 칸에 맞춘 (5.5, 9.5)로 옮겨 가고(방향 3 그대로) 골라진 채이며 알림이 없다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.wardrobe, "wardrobe"), "wardrobe");

    const notice = tap(editor, floorHit({ x: 5.3, z: 9.6 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "wardrobe", { floor: { x: 5.5, z: 9.5, facing: 3 } }));
    expect(editor.selected).toBe("wardrobe");
    expect(editor.red).toBeNull();
  });

  test("T2 옮긴 뒤 다른 곳 (2.4, 9.4)을 또 탭하면 (2.5, 9.5)로 또 옮겨 가고 골라진 채다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.wardrobe, "wardrobe"), "wardrobe");
    tap(editor, floorHit({ x: 5.3, z: 9.6 }));

    const notice = tap(editor, floorHit({ x: 2.4, z: 9.4 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "wardrobe", { floor: { x: 2.5, z: 9.5, facing: 3 } }));
    expect(editor.selected).toBe("wardrobe");
  });

  test("T3 옮긴 옷장을 새 자리 (5.5, 9.5)에서 탭하면 배치가 확정된다(고르기가 풀리고 자리는 그대로)", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.wardrobe, "wardrobe"), "wardrobe");
    tap(editor, floorHit({ x: 5.3, z: 9.6 }));

    const notice = tap(editor, floorHit({ x: 5.5, z: 9.5 }, "wardrobe"));

    expect(notice).toBeNull();
    expect(editor.selected).toBeNull();
    expectLayout(editor, moved(N0(), "wardrobe", { floor: { x: 5.5, z: 9.5, facing: 3 } }));
  });

  test("T3b 옮긴 옷장의 칸 안 (5.8, 9.2)을 가구를 맞히지 않고 탭해도(떠 있어 모양을 맞히지 못함) 그 가구를 탭한 것이라 확정된다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.wardrobe, "wardrobe"), "wardrobe");
    tap(editor, floorHit({ x: 5.3, z: 9.6 }));

    tap(editor, floorHit({ x: 5.8, z: 9.2 }));

    expect(editor.selected).toBeNull();
    expectLayout(editor, moved(N0(), "wardrobe", { floor: { x: 5.5, z: 9.5, facing: 3 } }));
  });

  test("T4 책상(스탠드가 올라감)을 고른 채 빈 바닥 (4.4, 9.3)을 탭하면 책상이 (4.5, 9.5, 방향 0)으로 옮겨 가고 스탠드는 책상 왼쪽 자리 그대로 따라간다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.desk, "desk"), "desk");

    const notice = tap(editor, floorHit({ x: 4.4, z: 9.3 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "desk", { floor: { x: 4.5, z: 9.5, facing: 0 } }));
    expect(editor.layout.items.find((item) => item.id === "lamp")).toEqual(on("lamp", "lamp", "desk", 0));
    expect(editor.selected).toBe("desk");
  });

  test("T5 돌려서 가로 1×세로 3이 된 책상(방향 1)을 고른 채 (5.2, 8.9)를 탭하면 그 모양으로 칸에 맞춘 (5.5, 8.5, 방향 1)로 옮겨 간다", () => {
    const start = moved(N0(), "desk", { floor: { x: 1.5, z: 5.5, facing: 1 } });
    const editor = new LobbyEditor(start);
    select(editor, floorHit(AT.desk, "desk"), "desk");

    const notice = tap(editor, floorHit({ x: 5.2, z: 8.9 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "desk", { floor: { x: 5.5, z: 8.5, facing: 1 } }));
    expect(editor.selected).toBe("desk");
  });

  test("T6 깔개(4.6, 7.2)를 고른 채 빈 바닥 (4.2, 3.4)를 탭하면 3×3 칸에 맞춘 (4.5, 3.5, 방향 0)으로 옮겨 간다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.rug, "rug"), "rug");

    const notice = tap(editor, floorHit({ x: 4.2, z: 3.4 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "rug", { floor: { x: 4.5, z: 3.5, facing: 0 } }));
    expect(editor.selected).toBe("rug");
  });

  test("T7 깔개는 가구 밑에 둘 수 있다: 깔개를 고른 채 책상 (1.5, 5.5)를 탭하면 깔개가 (1.5, 5.5)로 옮겨 가고, 책상은 골라지지 않는다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.rug, "rug"), "rug");

    const notice = tap(editor, floorHit(AT.desk, "desk"));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "rug", { floor: { x: 1.5, z: 5.5, facing: 0 } }));
    expect(editor.selected).toBe("rug");
  });
});

// ---------- 2. 둘 수 없는 곳이면 옮기지 않고 안내 ----------

describe("[spec] 075 바뀌는 동작 1: 둘 수 없는 곳을 탭하면 옮기지 않고 안내, 골라진 채", () => {
  test.each([
    ["T8 다른 가구(책상)와 겹침: 책상 (1.5, 5.5)를 탭", floorHit(AT.desk, "desk")],
    ["T9 방 밖: (9.3, 5.4)를 탭(칸 맞춤 (9.5, 5.5))", floorHit({ x: 9.3, z: 5.4 })],
    ["T10 길을 막음: 책상 앞 서는 자리 칸 (1.5, 6.5)를 탭", floorHit({ x: 1.5, z: 6.5 })],
    ["T11 입구를 막음: 입구 앞 칸 (4.5, 10.5)를 탭", floorHit({ x: 4.5, z: 10.5 })],
    ["T12 벽 가구 밑: 창문 바로 아래 칸 (4.5, 0.5)를 탭(옷장이 창문 아래 끝보다 높다)", floorHit({ x: 4.5, z: 0.5 })]
  ])("%s하면 옷장은 (7.5, 3.5) 그대로 골라진 채이고 알림이 있다", (_label, hit) => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.wardrobe, "wardrobe"), "wardrobe");

    const notice = tap(editor, hit);

    expect(notice).not.toBeNull();
    expectLayout(editor, N0());
    expect(editor.selected).toBe("wardrobe");
    expect(editor.red).toBeNull();
  });

  test("T13 책상을 고른 채 스탠드(0.5, 5.5)를 탭하면 스탠드는 골라지지 않고, 책상은 칸 맞춤 (0.5, 5.5)가 방 밖이라 옮기지 않으며 알림이 있다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.desk, "desk"), "desk");

    const notice = tap(editor, floorHit(AT.slot0, "lamp"));

    expect(notice).not.toBeNull();
    expectLayout(editor, N0());
    expect(editor.selected).toBe("desk");
  });

  test("T14 둘 수 없어 안내한 뒤에도 그 가구를 탭하면 확정되고(고르기 풀림), 그다음 다른 가구(책상)를 탭하면 그 가구가 골라진다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.wardrobe, "wardrobe"), "wardrobe");
    expect(tap(editor, floorHit(AT.desk, "desk"))).not.toBeNull();
    expect(editor.selected).toBe("wardrobe");

    tap(editor, floorHit(AT.wardrobe, "wardrobe"));
    expect(editor.selected).toBeNull();
    tap(editor, floorHit(AT.desk, "desk"));

    expect(editor.selected).toBe("desk");
    expectLayout(editor, N0());
  });
});

// ---------- 3. 탁상 소품 ----------

describe("[spec] 075 바뀌는 동작 1: 탁상 소품은 탭한 점에서 가장 가까운 받침 가구 위 자리로", () => {
  test("T15 스탠드(책상 자리 0)를 고른 채 빈 바닥 (3.4, 6.6)을 탭하면 가장 가까운 책상 자리 2로 옮겨 가고(방향 0 그대로) 골라진 채다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.slot0, "lamp"), "lamp");

    const notice = tap(editor, floorHit({ x: 3.4, z: 6.6 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "lamp", { on: { parent: "desk", slot: 2, facing: 0 } }));
    expect(editor.selected).toBe("lamp");
  });

  test("T16 스탠드를 고른 채 책상의 자리 1 위 (1.5, 5.5)를 탭하면(책상을 맞힘) 스탠드가 자리 1로 옮겨 가고 책상은 골라지지 않는다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.slot0, "lamp"), "lamp");

    const notice = tap(editor, floorHit(AT.slot1, "desk"));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "lamp", { on: { parent: "desk", slot: 1, facing: 0 } }));
    expect(editor.selected).toBe("lamp");
  });

  test("T17 가장 가까운 자리에 다른 소품이 있으면 둘 수 없다: 스탠드(자리 0)·스탠드2(자리 1)에서 스탠드를 고른 채 (1.5, 6.3)을 탭하면 옮기지 않고 알림, 스탠드2는 골라지지 않는다", () => {
    const start = layoutOf([...N0_ITEMS, on("lamp2", "lamp", "desk", 1)]);
    const editor = new LobbyEditor(start);
    select(editor, floorHit(AT.slot0, "lamp"), "lamp");

    const notice = tap(editor, floorHit({ x: 1.5, z: 6.3 }));

    expect(notice).not.toBeNull();
    expectLayout(editor, start);
    expect(editor.selected).toBe("lamp");
  });

  test("T18 옮긴 스탠드를 새 자리(자리 2)에서 탭하면 확정된다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit(AT.slot0, "lamp"), "lamp");
    tap(editor, floorHit({ x: 3.4, z: 6.6 }));

    tap(editor, floorHit(AT.slot2, "lamp"));

    expect(editor.selected).toBeNull();
    expectLayout(editor, moved(N0(), "lamp", { on: { parent: "desk", slot: 2, facing: 0 } }));
  });
});

// ---------- 4. 벽 가구 ----------

describe("[spec] 075 바뀌는 동작 1: 벽 가구는 벽을 탭하면 그 벽의 그 자리, 바닥을 탭하면 가장 가까운 벽의 그 자리", () => {
  test("T19 창문(뒷벽 4.8)을 고른 채 뒷벽 6.0을 탭하면 뒷벽 6.0으로 옮겨 가고 골라진 채다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, wallHit("back", 4.8, "window"), "window");

    const notice = tap(editor, wallHit("back", 6.0));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "window", { wall: { wall: "back", along: 6.0 } }));
    expect(editor.selected).toBe("window");
  });

  test("T20 창문을 고른 채 왼벽 8.5를 탭하면 왼벽 8.5로 옮겨 간다(다른 벽)", () => {
    const editor = new LobbyEditor(N0());
    select(editor, wallHit("back", 4.8, "window"), "window");

    const notice = tap(editor, wallHit("left", 8.5));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "window", { wall: { wall: "left", along: 8.5 } }));
    expect(editor.selected).toBe("window");
  });

  test.each([
    ["T21 뒷벽이 가장 가까운 (6.2, 0.4) → 뒷벽 6.0(반 칸 단위로 내림)", "window", { x: 6.2, z: 0.4 }, { wall: "back", along: 6.0 }],
    ["T22 뒷벽이 가장 가까운 (6.3, 0.4) → 뒷벽 6.5(반 칸 단위로 올림)", "window", { x: 6.3, z: 0.4 }, { wall: "back", along: 6.5 }],
    ["T23 왼벽이 가장 가까운 (0.4, 8.2) → 왼벽 8.0", "board", { x: 0.4, z: 8.2 }, { wall: "left", along: 8.0 }],
    ["T24 오른벽이 가장 가까운 빈 바닥 (4.5, 9.5) → 오른벽 9.5", "board", { x: 4.5, z: 9.5 }, { wall: "right", along: 9.5 }]
  ] as const)("%s: 벽 가구를 고른 채 바닥을 탭하면 가장 가까운 벽의 그 자리로 옮겨 가고 골라진 채다", (_label, id, point, spot) => {
    const editor = new LobbyEditor(N0());
    const along = id === "window" ? 4.8 : 1.8;
    select(editor, wallHit("back", along, id), id);

    const notice = tap(editor, floorHit(point));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), id, { wall: { wall: spot.wall, along: spot.along } }));
    expect(editor.selected).toBe(id);
  });

  test.each([
    ["T25 같은 벽의 게시판과 겹침: 뒷벽 2.0을 탭", wallHit("back", 2.0)],
    ["T26 책상 바로 위(책상이 창문 아래 끝보다 높다): 왼벽 6.5를 탭", wallHit("left", 6.5)],
    ["T27 바닥 (0.4, 6.4)를 탭 → 가장 가까운 왼벽 6.5가 책상 바로 위", floorHit({ x: 0.4, z: 6.4 })],
    ["T28 벽 끝을 넘음: 뒷벽 7.5를 탭(폭 2.3이 벽 끝 0.2 안으로 들지 않는다)", wallHit("back", 7.5)]
  ])("%s하면 창문은 뒷벽 4.8 그대로 골라진 채이고 알림이 있다", (_label, hit) => {
    const editor = new LobbyEditor(N0());
    select(editor, wallHit("back", 4.8, "window"), "window");

    const notice = tap(editor, hit);

    expect(notice).not.toBeNull();
    expectLayout(editor, N0());
    expect(editor.selected).toBe("window");
  });

  test("T29 게시판을 고른 채 책장 (0.5, 2.5)를 탭하면 책장은 골라지지 않고, 가장 가까운 왼벽 2.5는 책장 바로 위라 옮기지 않으며 알림이 있다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, wallHit("back", 1.8, "board"), "board");

    const notice = tap(editor, floorHit({ x: 0.5, z: 2.5 }, "bookcase"));

    expect(notice).not.toBeNull();
    expectLayout(editor, N0());
    expect(editor.selected).toBe("board");
  });

  test("T30 옮긴 창문(왼벽 8.5)을 그 자리에서 탭하면 확정된다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, wallHit("back", 4.8, "window"), "window");
    tap(editor, wallHit("left", 8.5));

    tap(editor, wallHit("left", 8.5, "window"));

    expect(editor.selected).toBeNull();
    expectLayout(editor, moved(N0(), "window", { wall: { wall: "left", along: 8.5 } }));
  });
});

// ---------- 5. 빨간 가구(03 결정 답 2) ----------

describe("[spec] 075 03 결정 답 2: 빨간 가구가 골라진 채 다른 곳을 탭하면 옮기고, 둘 수 있으면 빨간 상태가 풀린다", () => {
  /** 책장(0.5, 2.5, 방향 1)을 골라 한 번 돌려 앞면이 벽을 보는 빨간 가구(방향 2)로 만든다(골라진 채). */
  function redBookcase(): LobbyEditor {
    const editor = new LobbyEditor(N0());
    select(editor, floorHit({ x: 0.5, z: 2.5 }, "bookcase"), "bookcase");
    editor.rotate();
    expect(editor.red).toBe("bookcase");
    expect(editor.canFinish).toBe(false);
    expectLayout(editor, moved(N0(), "bookcase", { floor: { x: 0.5, z: 2.5, facing: 2 } }));
    return editor;
  }

  test("R1 빨간 책장(방향 2)을 고른 채 빈 바닥 (5.3, 9.6)을 탭하면 (5.5, 9.5, 방향 2)로 옮겨 가고, 그 자리에 둘 수 있어 빨간 상태가 풀리며(완료 가능) 골라진 채이고 알림이 없다", () => {
    const editor = redBookcase();

    const notice = tap(editor, floorHit({ x: 5.3, z: 9.6 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "bookcase", { floor: { x: 5.5, z: 9.5, facing: 2 } }));
    expect(editor.red).toBeNull();
    expect(editor.canFinish).toBe(true);
    expect(editor.selected).toBe("bookcase");
  });

  test.each([
    ["R2 다른 가구(책상)와 겹침: 책상 (1.5, 5.5)를 탭", floorHit(AT.desk, "desk")],
    ["R3 옮긴 자리에서도 앞면이 벽을 봄: 뒷벽 앞 빈 칸 (6.5, 0.5)를 탭", floorHit({ x: 6.5, z: 0.5 })]
  ])("%s하면 옮기지 않고 알림만 있고, 책장은 (0.5, 2.5, 방향 2) 그대로 빨간 가구이며 골라진 채다(완료 막힘)", (_label, hit) => {
    const editor = redBookcase();

    // 다른 가구 위를 탭하면 알림이 누를 때('빨간 가구부터')인지 뗄 때('둘 수 없어요')인지 결정이 갈라 말하지 않아(보고 04-qa-tests.md) 둘 중 하나가 있는지 본다
    const down = editor.pointerDown(hit, 200, 300);
    const up = editor.pointerUp();

    expect(down ?? up).not.toBeNull();
    expectLayout(editor, moved(N0(), "bookcase", { floor: { x: 0.5, z: 2.5, facing: 2 } }));
    expect(editor.red).toBe("bookcase");
    expect(editor.canFinish).toBe(false);
    expect(editor.selected).toBe("bookcase");
  });

  test("R4 둘 수 있는 곳으로 옮겨 빨간 상태가 풀린 뒤에는 다른 가구 규칙이 그대로다: 책장을 탭해 확정한 다음 옷장을 탭하면 옷장이 골라진다", () => {
    const editor = redBookcase();
    tap(editor, floorHit({ x: 5.3, z: 9.6 }));
    expect(editor.red).toBeNull();

    tap(editor, floorHit({ x: 5.5, z: 9.5 }, "bookcase"));
    expect(editor.selected).toBeNull();
    const notice = tap(editor, floorHit(AT.wardrobe, "wardrobe"));

    expect(notice).toBeNull();
    expect(editor.selected).toBe("wardrobe");
  });
});
