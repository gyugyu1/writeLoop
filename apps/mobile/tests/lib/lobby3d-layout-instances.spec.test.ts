// [spec] qa 테스트(작업 066-① 가구 카탈로그와 배치 데이터 v2, 기능 변경, 모바일): 배치가 가구 인스턴스 목록이 되어,
// 같은 종류가 여러 개이거나 인스턴스 id가 종류 id와 달라도 공통 배치 규칙·막힌 칸·장소·편집 모드가 종류(카탈로그 값)와 인스턴스로 동작하는지.
// 기대값은 명세(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서만 가져온다:
// - 명세 1: 배치 규칙·3D·장소·편집 모드는 가구 이름을 코드에서 따로 다루지 않고 카탈로그 값만 읽는다(바닥형은 길을 막고 덮개형은 막지 않는다).
// - 명세 2: 배치는 인스턴스 목록이고 같은 종류를 여러 개 놓을 수 있는 모양이다.
// - 명세 3의 2: 길을 막는 가구끼리 칸이 겹치지 않는다. 덮개는 바닥형과 겹쳐도 되지만 다른 덮개와는 겹치지 않는다.
// - 명세 3의 3: 바닥형의 윗면이 벽 가구의 아래 끝보다 높으면 그 벽 가구 바로 아래 칸에 두지 않는다(책장·옷장·책상은 막히고 깔개는 된다).
// - 명세 5: 편집 모드가 다루는 "고른 가구"는 인스턴스 id다.
// 칸 모양·막힌 칸·장소 값은 처음 배치의 지금 값(064 qa 테스트 lobby3d-layout-change.spec의 T0·T4)과 같다: 옷장 1×1, 깔개 2×2(막지 않음),
// 처음 배치의 막힌 칸 "0,2" "0,5" "1,5" "2,5" "7,3", 옷장을 (5.5, 9.5) 앞으로 두면 칸 "5,9", 그림 (5.5, 9.44).
// 부르는 이름(layoutGeometry, isPlaceableLayout, LobbyEditor와 그 pointerDown·pointerMove·pointerUp·rotate·selected·marks·layout,
// furniturePlacements)은 메인 세션이 알려 준 이름 약속(지금 이름 그대로, 값 안의 배치 모양만 v2)이다.
// 모두 바뀔 동작이다(지금 코드는 가구 종류마다 하나인 옛 모양만 읽는다).
// 066-②(private 작업 폴더 066/03-모델-칸에-맞추기/01-main-spec.md)에서 바닥 가구 모델이 칸에 맞게 줄고 뒷면이 칸 뒤 끝에 붙어, 명세의 "고칠 기존 테스트"대로
// 책장·옷장 그림 자리의 기대값만 새 자리(뒤로 0.06 → 칸 뒤 끝에서 0.876/2 앞, 벽 가까이 0.44 → 0.438, 7.56 → 7.562)로 고쳤다.
// 066-②(private 작업 폴더 066/03-모델-칸에-맞추기/01-main-spec.md)에서 깔개가 차지하는 칸이 2×2에서 3×3이 되어, 명세의 "고칠 기존 테스트"대로
// 2×2에 기대던 것만 고쳤다: P6·P11은 3×3 칸이 방 밖이 되는 자리(1.0, 9.0)·(4.6, 1.0)를 뜻(겹치지 않음, 창문 아래)이 같은 방 안 자리 (1.5, 9.5)·(4.5, 1.5)로
// 옮겼고, P5·P13은 결과가 같아 이름의 칸 범위만 3×3으로 고쳤다. G2는 막힌 칸만 보아 그대로 두었다.

import { ROOM, TAP_MAX_MOVE_PX, type PointerHit } from "@/lib/lobby3d/engine";
import { furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { LobbyEditor, isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import { layoutGeometry, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type LayoutItem = LobbyLayout["items"][number];
type FloorSpot = NonNullable<LayoutItem["floor"]>;

/** 처음 배치(명세 2: 지금 자리 그대로, 인스턴스 id = 종류 id). */
function p0Items(): LayoutItem[] {
  return [
    { id: "desk", type: "desk", floor: { x: 1.5, z: 5.5, facing: 0 } },
    { id: "bookcase", type: "bookcase", floor: { x: 0.5, z: 2.5, facing: 1 } },
    { id: "wardrobe", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } },
    { id: "rug", type: "rug", floor: { x: 4.6, z: 7.2, facing: 0 } },
    { id: "board", type: "board", wall: { wall: "back", along: 1.8 } },
    { id: "window", type: "window", wall: { wall: "back", along: 4.8 } }
  ] as LayoutItem[];
}

function layout(items: LayoutItem[]): LobbyLayout {
  return { items } as LobbyLayout;
}

/** 처음 배치에 가구 하나를 더한 배치. */
function plus(id: string, type: string, floor: FloorSpot): LobbyLayout {
  return layout([...p0Items(), { id, type, floor } as LayoutItem]);
}

function r4(v: number): number {
  const n = Math.round(v * 1e4) / 1e4;
  return n === 0 ? 0 : n;
}

const sortedTiles = (tiles: Iterable<string>) => [...tiles].sort();
const P0_SOLID = ["0,2", "0,5", "1,5", "2,5", "7,3"];

function placesOf(l: LobbyLayout) {
  const g = layoutGeometry(l, ROOM.width);
  return Object.fromEntries(
    (["board", "window", "desk", "bookcase"] as const).map((id) => [
      id,
      { approach: g.places[id].approach.map((p) => [r4(p.x), r4(p.z)]), faceTo: [r4(g.places[id].faceTo.x), r4(g.places[id].faceTo.z)] }
    ])
  );
}

/** 처음 배치의 장소 데이터(lobby3d-layout-change.spec의 DEFAULT_PLACES에서 서는 자리·바라볼 지점). */
const P0_PLACES = {
  board: { approach: [[1.6, 1.3], [2.2, 1.3]], faceTo: [1.8, 0] },
  window: { approach: [[4.5, 1.55], [5.1, 1.55]], faceTo: [4.8, 0] },
  desk: { approach: [[1.5, 6.75]], faceTo: [1.25, 5.5] },
  bookcase: { approach: [[1.4, 2.5]], faceTo: [0, 2.5] }
};

// ---------- G. 막힌 칸·장소·3D가 인스턴스 목록을 읽는다(명세 1·2·5) ----------

describe("[spec] 066-① G: 막힌 칸·장소·3D 가구가 인스턴스 목록과 종류의 값을 읽는다", () => {
  test("G1 옷장을 하나 더(id wardrobe-2, (5.5, 9.5) 앞) 두면 두 옷장의 칸이 모두 막힌다: 처음 배치의 막힌 칸 + \"5,9\"", () => {
    const g = layoutGeometry(plus("wardrobe-2", "wardrobe", { x: 5.5, z: 9.5, facing: 0 }), ROOM.width);
    expect(sortedTiles(g.solidTiles)).toEqual([...P0_SOLID, "5,9"].sort());
  });

  test("G2 깔개를 하나 더(id rug-2, (1.0, 9.0)) 두어도 덮개라 막힌 칸은 처음 배치 그대로다", () => {
    const g = layoutGeometry(plus("rug-2", "rug", { x: 1.0, z: 9.0, facing: 0 }), ROOM.width);
    expect(sortedTiles(g.solidTiles)).toEqual(P0_SOLID);
  });

  test("G3 옷장을 하나 더 두면 3D 목록(furniturePlacements)에 막는 가구가 둘이고, 새 옷장 그림은 (5.5, 0, 9.438) rotY 0이다", () => {
    const list = furniturePlacements(plus("wardrobe-2", "wardrobe", { x: 5.5, z: 9.5, facing: 0 }));
    const blockers = list.filter((p) => p.blocker === true).map((p) => [r4(p.x), r4(p.y), r4(p.z), r4(p.rotY)]);
    expect(blockers.sort()).toEqual(
      [
        [5.5, 0, 9.438, 0],
        [7.562, 0, 3.5, r4(-Math.PI / 2)]
      ].sort()
    );
  });

  test("G4 옷장·깔개가 없는 배치(장소 가구 넷만): 막힌 칸은 책장·책상 칸뿐이고, 장소 넷은 처음 배치 그대로, 3D 목록은 게시판·창문·책상·의자·책장·입구 발판 여섯이다", () => {
    const only = layout(p0Items().filter((i) => i.type !== "wardrobe" && i.type !== "rug"));
    expect(sortedTiles(layoutGeometry(only, ROOM.width).solidTiles)).toEqual(["0,2", "0,5", "1,5", "2,5"]);
    expect(placesOf(only)).toEqual(P0_PLACES);
    const list = furniturePlacements(only);
    expect(list).toHaveLength(6);
    expect(list.filter((p) => p.blocker === true)).toEqual([]);
  });

  test("G5 책상의 인스턴스 id가 종류 id와 달라도(my-desk, 처음 자리) 책상 장소·의자·막힌 칸은 처음 배치와 같다", () => {
    const renamed = layout(p0Items().map((i) => (i.id === "desk" ? ({ ...i, id: "my-desk" } as LayoutItem) : i)));
    const g = layoutGeometry(renamed, ROOM.width);
    expect(sortedTiles(g.solidTiles)).toEqual(P0_SOLID);
    expect(placesOf(renamed)).toEqual(P0_PLACES);
    expect({ seat: [r4(g.chair.seat.x), r4(g.chair.seat.z)], side: [r4(g.chair.side.x), r4(g.chair.side.z)], home: [r4(g.chair.home.x), r4(g.chair.home.z)] }).toEqual({
      seat: [1.5, 6.45],
      side: [2.15, 6.55],
      home: [1.5, 5.95]
    });
  });
});

// ---------- P. 공통 배치 규칙이 인스턴스마다 적용된다(명세 3) ----------

describe("[spec] 066-① P: 공통 배치 규칙이 같은 종류 여러 개에도 종류의 값으로 적용된다(명세 3)", () => {
  const cases: [string, LobbyLayout, boolean][] = [
    ["P1 옷장 하나 더 (5.5, 9.5) 앞: 빈 바닥", plus("wardrobe-2", "wardrobe", { x: 5.5, z: 9.5, facing: 0 }), true],
    ["P2 옷장 하나 더 (7.5, 3.5) 왼쪽: 처음 옷장과 칸 7,3이 겹침(3의 2)", plus("wardrobe-2", "wardrobe", { x: 7.5, z: 3.5, facing: 3 }), false],
    ["P3 옷장 하나 더 (1.5, 5.5): 책상 칸 1,5와 겹침(3의 2)", plus("wardrobe-2", "wardrobe", { x: 1.5, z: 5.5, facing: 0 }), false],
    ["P4 옷장 하나 더 (4.5, 7.5): 깔개 위(바닥형은 덮개와 겹쳐도 됨, 3의 2)", plus("wardrobe-2", "wardrobe", { x: 4.5, z: 7.5, facing: 3 }), true],
    ["P5 깔개 하나 더 (5.0, 8.0): 처음 깔개(3.1~6.1, 5.7~8.7)와 겹침(덮개끼리는 안 됨, 3의 2)", plus("rug-2", "rug", { x: 5.0, z: 8.0, facing: 0 }), false],
    ["P6 깔개 하나 더 (1.5, 9.5): 다른 덮개와 겹치지 않음", plus("rug-2", "rug", { x: 1.5, z: 9.5, facing: 0 }), true],
    ["P7 깔개 하나 더 (1.5, 5.5): 책상과 겹침(덮개는 바닥형과 겹쳐도 됨, 3의 2)", plus("rug-2", "rug", { x: 1.5, z: 5.5, facing: 0 }), true],
    ["P8 옷장 하나 더 (2.5, 0.5) 앞: 게시판(뒷벽 1.8, 폭 1.8) 바로 아래 칸 2,0(3의 3)", plus("wardrobe-2", "wardrobe", { x: 2.5, z: 0.5, facing: 0 }), false],
    ["P9 옷장 하나 더 (4.5, 0.5) 앞: 창문(뒷벽 4.8, 폭 2.3) 바로 아래 칸 4,0(3의 3)", plus("wardrobe-2", "wardrobe", { x: 4.5, z: 0.5, facing: 0 }), false],
    ["P10 옷장 하나 더 (7.5, 0.5) 왼쪽: 칸 7,0은 벽 가구 아래가 아님", plus("wardrobe-2", "wardrobe", { x: 7.5, z: 0.5, facing: 3 }), true],
    ["P11 깔개 하나 더 (4.5, 1.5): 창문 아래라도 덮개는 됨(3의 3)", plus("rug-2", "rug", { x: 4.5, z: 1.5, facing: 0 }), true],
    ["P12 옷장 하나 더 (8.5, 9.5): 칸이 방 밖(3의 1)", plus("wardrobe-2", "wardrobe", { x: 8.5, z: 9.5, facing: 0 }), false],
    ["P13 깔개 하나 더 (7.6, 9.0): 3×3 칸이 오른벽 밖(3의 1)", plus("rug-2", "rug", { x: 7.6, z: 9.0, facing: 0 }), false],
    ["P14 옷장 하나 더 (4.5, 10.5): 입구 발판 앞 칸을 막아 장소로 가는 길이 없음(3의 5)", plus("wardrobe-2", "wardrobe", { x: 4.5, z: 10.5, facing: 0 }), false],
    ["P15 책상 id가 my-desk(처음 자리): 처음 배치와 같이 놓을 수 있음", layout(p0Items().map((i) => (i.id === "desk" ? ({ ...i, id: "my-desk" } as LayoutItem) : i))), true],
    ["P16 책상 id가 my-desk이고 창문 바로 아래 (4.5, 0.5): 책상 윗면이 창문 아래 끝보다 높아 안 됨(3의 3)", layout(p0Items().map((i) => (i.id === "desk" ? ({ ...i, id: "my-desk", floor: { x: 4.5, z: 0.5, facing: 0 } } as LayoutItem) : i))), false]
  ];

  test.each(cases)("%s → 놓을 수 있음 %s", (_label, l, expected) => {
    expect(isPlaceableLayout(l)).toBe(expected);
  });
});

// ---------- E. 편집 모드의 고른 가구는 인스턴스 id(명세 5) ----------

function floorHit(point: { x: number; z: number }, piece: string | null): PointerHit {
  return { point, mark: null, onCharacter: false, piece: piece as PointerHit["piece"], wall: null };
}

function itemOf(l: LobbyLayout, id: string) {
  return l.items.find((i) => i.id === id);
}

describe("[spec] 066-① E: 편집 모드가 다루는 고른 가구는 인스턴스 id다(명세 5)", () => {
  const start = () => plus("wardrobe-2", "wardrobe", { x: 5.5, z: 9.5, facing: 0 });

  test("E1 두 번째 옷장(wardrobe-2)을 톡하면 고른 가구가 wardrobe-2이고, 칠한 칸의 piece도 wardrobe-2다(칸 5~6, 9~10, 놓을 수 있음)", () => {
    const editor = new LobbyEditor(start());

    editor.pointerDown(floorHit({ x: 5.5, z: 9.5 }, "wardrobe-2"), 200, 300);
    editor.pointerUp();

    expect(editor.selected).toBe("wardrobe-2");
    expect(editor.marks()).toEqual([{ piece: "wardrobe-2", minX: 5, maxX: 6, minZ: 9, maxZ: 10, ok: true }]);
  });

  test("E2 두 번째 옷장을 (5.5, 8.5)로 끌어 놓으면 그 인스턴스만 옮겨지고 처음 옷장(wardrobe)은 그대로다", () => {
    const editor = new LobbyEditor(start());

    editor.pointerDown(floorHit({ x: 5.5, z: 9.5 }, "wardrobe-2"), 200, 300);
    editor.pointerMove(floorHit({ x: 5.5, z: 8.5 }, null), 200 + TAP_MAX_MOVE_PX + 50, 300 + TAP_MAX_MOVE_PX + 50);
    editor.pointerUp();

    expect(itemOf(editor.layout, "wardrobe-2")).toEqual({ id: "wardrobe-2", type: "wardrobe", floor: { x: 5.5, z: 8.5, facing: 0 } });
    expect(itemOf(editor.layout, "wardrobe")).toEqual({ id: "wardrobe", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } });
    expect(editor.layout.items).toHaveLength(7);
    expect(editor.selected).toBe("wardrobe-2");
    expect(editor.changed).toBe(true);
  });

  test("E3 두 번째 옷장을 고르고 돌리면 그 인스턴스만 오른쪽(facing 1)으로 돈다", () => {
    const editor = new LobbyEditor(start());
    editor.pointerDown(floorHit({ x: 5.5, z: 9.5 }, "wardrobe-2"), 200, 300);
    editor.pointerUp();

    editor.rotate();

    expect(itemOf(editor.layout, "wardrobe-2")?.floor).toEqual({ x: 5.5, z: 9.5, facing: 1 });
    expect(itemOf(editor.layout, "wardrobe")?.floor).toEqual({ x: 7.5, z: 3.5, facing: 3 });
  });

  test("E4 두 번째 옷장을 처음 옷장 칸 (7.5, 3.5)로 끌어 놓으면 겹쳐 놓을 수 없어 끌기 전 자리 (5.5, 9.5)로 돌아가고 \"cannot-place\"를 돌려준다", () => {
    const editor = new LobbyEditor(start());

    editor.pointerDown(floorHit({ x: 5.5, z: 9.5 }, "wardrobe-2"), 200, 300);
    editor.pointerMove(floorHit({ x: 7.5, z: 3.5 }, null), 200 + TAP_MAX_MOVE_PX + 50, 300 + TAP_MAX_MOVE_PX + 50);
    const notice = editor.pointerUp();

    expect(notice).toBe("cannot-place");
    expect(itemOf(editor.layout, "wardrobe-2")?.floor).toEqual({ x: 5.5, z: 9.5, facing: 0 });
  });
});
