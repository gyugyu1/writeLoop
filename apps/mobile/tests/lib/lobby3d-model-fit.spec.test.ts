// [spec] qa 테스트(작업 066-② 모델을 칸에 맞추기, 기능 변경, 모바일): 가구 모델이 차지하는 칸보다 크면 넘치는 방향만 칸에 맞게 줄이고,
// 바닥 가구는 모델 뒷면을 칸 뒤 끝에 붙이며, 깔개가 차지하는 칸이 3×3이 되는지.
// 기대값은 명세(private 작업 폴더 066/03-모델-칸에-맞추기/01-main-spec.md)에서만 가져온다:
// - 바뀌는 동작 1: 모델 가로가 칸(벽 가구는 벽 폭)보다 크면 칸 폭에 맞게 줄이고 깊이도 같다. 높이는 줄이지 않는다.
//   바닥 가구는 모델 뒷면을 칸 뒤 끝에 맞춘다. 가로 자리는 카탈로그의 그리는 자리를 따르되 칸 밖으로 나가지 않는다(책상은 왼쪽으로 치우친
//   자리, 옷장·책장은 가운데). 덮개(깔개)는 칸 가운데. 줄인 크기는 3D 모델·대체 상자·누르기 판정 상자·바닥 그림자가 함께 쓴다.
// - 바뀌는 동작 2: 옷장·책장 가로 1.12 → 1.0(깊이 0.876·높이 그대로), 그림자 가로 1.4 → 1.25. 책상 깊이 1.318 → 1.0(가로 2.468·높이
//   그대로), 그림자 깊이 1.65 → 1.25(줄인 방향만 같은 비율: 1.65 × 1.0/1.318). 깔개 모델 2.576×2.576 그대로, 칸 3×3(칸 표시·덮개 겹침·
//   방 안 규칙·끌 때 맞추는 칸, 3칸이라 칸 가운데가 0.5 단위). 게시판·창문은 바뀌지 않는다.
// - 그대로여야 할 동작: 처음 배치의 깔개 자리(4.6, 7.2), 의자 모델 크기·그림자, 가구 높이.
// - 알릴 것: 로컬 저장분의 깔개가 벽에서 1칸 안이면 불러오기는 자리 점만 보아 그대로 불러오고, 편집 모드의 방 안 규칙에는 걸린다.
// 모델의 원점은 모델 바닥 넓이의 가운데다(가구 묶음을 굽는 scripts/lobby3d/build-furniture.py가 가로·깊이 가운데, 바닥 높이를 원점으로 둔다.
// 대체 상자도 자리를 가운데로 그린다). 그래서 "뒷면이 칸 뒤 끝"은 모델 가운데가 칸 뒤 끝에서 (줄인 깊이)/2 앞이라는 뜻이다.
// 좌표 약속(lobby-layout.ts): 가구 기준은 앞면 +z, rotY는 위에서 보아 반시계, 로컬 (a, b)를 rotY θ로 돌리면 (a·cosθ + b·sinθ, −a·sinθ + b·cosθ).
//
// 줄인 크기를 어디서 읽는지는 명세가 정하지 않아 가정한다(02-qa-tests.md "가정"):
// - 3D 목록(furniturePlacements)의 가구마다 box가 줄인 모델 크기(대체 상자·누르기 판정 상자가 쓰는 값)이고, shadow.floor가 줄인 그림자다.
// - 구현이 줄인 크기를 다른 이름으로 내면 아래 "지금 코드를 부르는 곳"만 따라 고친다. 그 아래의 기대값·단언·입력은 고치지 않는다.
// 가구 묶음(Kenney 모델)을 줄여 그리는지와 그림자 판의 크기는 three를 Jest에서 그릴 수 없어 이 파일이 보지 않는다(보고에 적음).
// 분류: 바뀔 동작(고치기 전에는 실패해야 한다) A1~A4, B1·B2, C1~C7, D1~D8, E2. 그대로 둘 동작(고치기 전에도 통과해야 한다) E1, K1~K6.
import { ROOM, TAP_MAX_MOVE_PX, type PointerHit } from "@/lib/lobby3d/engine";
import { furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { LobbyEditor, isPlaceableLayout, snapPiece } from "@/lib/lobby3d/lobby-edit";
import { parseLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { floorPieceBounds, floorPieceSize, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type LayoutItem = LobbyLayout["items"][number];
type FloorSpot = NonNullable<LayoutItem["floor"]>;
type Facing = FloorSpot["facing"];

// ---------- 지금 코드를 부르는 곳 ----------

interface Box {
  width: number;
  height: number;
  depth: number;
}
interface Drawn {
  item: string;
  piece: string;
  companion: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** 줄인 모델 크기(대체 상자·누르기 판정 상자). */
  box: Box | null;
  /** 줄인 바닥 그림자(가로·깊이·진하기). */
  floorShadow: [number, number, number] | null;
  wallShadow: [number, number, number] | null;
}

const current = {
  /** 배치의 3D 가구(입구 발판 빼고). */
  drawn: (layout: LobbyLayout): Drawn[] =>
    furniturePlacements(layout)
      .filter((p) => p.piece !== "exit")
      .map((p) => ({
        item: p.item,
        piece: p.piece,
        companion: Boolean(p.companion),
        x: p.x,
        y: p.y,
        z: p.z,
        rotY: p.rotY,
        box: p.box ?? null,
        floorShadow: p.shadow?.floor ?? null,
        wallShadow: p.shadow?.wall ?? null
      })),
  size: (type: string, facing: Facing) => floorPieceSize(type, facing),
  bounds: (type: string, floor: FloorSpot) => floorPieceBounds(type, floor),
  snap: (type: string, facing: Facing, point: { x: number; z: number }) => snapPiece(type, facing, point),
  placeable: (layout: LobbyLayout) => isPlaceableLayout(layout),
  editor: (layout: LobbyLayout) => new LobbyEditor(layout),
  parse: (body: unknown) => parseLobbyLayoutPayload(body)
};

// ---------- 배치 ----------

/** 처음 배치(인스턴스 id = 종류 id). */
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

const layout = (items: LayoutItem[]): LobbyLayout => ({ items }) as LobbyLayout;
const P0 = (): LobbyLayout => layout(p0Items());

/** 처음 배치에서 한 가구의 바닥 자리만 바꾼 배치. */
function withFloor(id: string, floor: FloorSpot): LobbyLayout {
  return layout(p0Items().map((i) => (i.id === id ? ({ ...i, floor } as LayoutItem) : i)));
}

/** 처음 배치에 가구 하나를 더한 배치. */
function plus(id: string, type: string, floor: FloorSpot): LobbyLayout {
  return layout([...p0Items(), { id, type, floor } as LayoutItem]);
}

function drawnOf(l: LobbyLayout, item: string, companion = false): Drawn {
  const found = current.drawn(l).find((d) => d.item === item && d.companion === companion);
  if (!found) throw new Error(`3D 목록에 ${item}${companion ? "의 의자" : ""}가 없다`);
  return found;
}

// ---------- 도우미 ----------

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const r4 = (v: number) => {
  const n = Math.round(v * 1e4) / 1e4;
  return n === 0 ? 0 : n;
};
const r4Box = (b: Box | null) => (b ? { width: r4(b.width), height: r4(b.height), depth: r4(b.depth) } : null);
const r4List = (l: readonly number[] | null) => (l ? l.map(r4) : null);

const FACING_ROT: Record<Facing, number> = { 0: 0, 1: Math.PI / 2, 2: Math.PI, 3: -Math.PI / 2 };

/** 방 좌표의 점을 가구 기준(칸 모양 가운데가 원점, 앞면 +z)으로 되돌린다. */
function toLocal(floor: FloorSpot, p: { x: number; z: number }): { x: number; z: number } {
  const t = FACING_ROT[floor.facing];
  const dx = p.x - floor.x;
  const dz = p.z - floor.z;
  // 로컬 (a, b) → 방 (a·cos + b·sin, −a·sin + b·cos)의 역변환
  return { x: dx * Math.cos(t) - dz * Math.sin(t), z: dx * Math.sin(t) + dz * Math.cos(t) };
}

/** 그린 모델(가운데 자리, 줄인 가로·깊이, 방향)이 바닥에서 차지하는 범위(방 좌표). */
function modelExtent(d: Drawn, facing: Facing) {
  const sideways = facing % 2 === 1;
  const w = sideways ? d.box!.depth : d.box!.width;
  const dd = sideways ? d.box!.width : d.box!.depth;
  return { minX: d.x - w / 2, maxX: d.x + w / 2, minZ: d.z - dd / 2, maxZ: d.z + dd / 2 };
}

/** 칸 모양의 뒤 끝(앞면 반대쪽): 방향마다 범위의 어느 변인지. */
function backEdge(b: { minX: number; maxX: number; minZ: number; maxZ: number }, facing: Facing): number {
  return [b.minZ, b.minX, b.maxZ, b.maxX][facing];
}

function floorHit(point: { x: number; z: number }, piece: string | null): PointerHit {
  return { point, mark: null, onCharacter: false, piece: piece as PointerHit["piece"], wall: null };
}

/** 편집 모드에서 가구를 톡해 고른다. */
function select(editor: LobbyEditor, id: string, at: { x: number; z: number }) {
  editor.pointerDown(floorHit(at, id), 200, 300);
  editor.pointerUp();
}

/** 편집 모드에서 가구를 from에서 to까지 끌어 놓는다. 손을 뗀 결과(알림)를 돌려준다. */
function drag(editor: LobbyEditor, id: string, from: { x: number; z: number }, to: { x: number; z: number }) {
  editor.pointerDown(floorHit(from, id), 200, 300);
  editor.pointerMove(floorHit(to, null), 200 + TAP_MAX_MOVE_PX + 50, 300 + TAP_MAX_MOVE_PX + 50);
  return editor.pointerUp();
}

// ---------- 명세의 값 ----------

/** 줄인 모델 크기(바뀌는 동작 2). */
const FIT_BOX: Record<string, Box> = {
  wardrobe: { width: 1.0, height: 2.38, depth: 0.876 },
  bookcase: { width: 1.0, height: 2.464, depth: 0.876 },
  desk: { width: 2.468, height: 1.292, depth: 1.0 }
};
/** 칸(가로×깊이). 바닥 가구의 칸은 이번에 바뀌지 않는다. */
const CELL: Record<string, { width: number; depth: number }> = {
  wardrobe: { width: 1, depth: 1 },
  bookcase: { width: 1, depth: 1 },
  desk: { width: 3, depth: 1 }
};
/** 그리는 가로 자리(가구 기준 x): 책상은 왼쪽으로 치우친 -0.25, 옷장·책장은 가운데. */
const DRAW_X: Record<string, number> = { wardrobe: 0, bookcase: 0, desk: -0.25 };

// ---------- A. 줄인 모델 크기(바뀔 동작) ----------

describe("[spec] 066-② A: 칸보다 큰 방향만 칸에 맞게 줄인 모델 크기(대체 상자·누르기 상자)", () => {
  test("A1 옷장: 가로 1.12 → 1.0, 높이 2.38·깊이 0.876 그대로", () => {
    expect(r4Box(drawnOf(P0(), "wardrobe").box)).toEqual({ width: 1, height: 2.38, depth: 0.876 });
  });

  test("A2 책장: 가로 1.12 → 1.0, 높이 2.464·깊이 0.876 그대로", () => {
    expect(r4Box(drawnOf(P0(), "bookcase").box)).toEqual({ width: 1, height: 2.464, depth: 0.876 });
  });

  test("A3 책상: 깊이 1.318 → 1.0, 가로 2.468·높이 1.292 그대로", () => {
    expect(r4Box(drawnOf(P0(), "desk").box)).toEqual({ width: 2.468, height: 1.292, depth: 1 });
  });

  test("A4 줄인 크기는 놓인 방향과 상관없다: 옷장을 앞(0)·오른쪽(1)·뒤(2)·왼쪽(3)으로 놓아도 가로 1.0·깊이 0.876", () => {
    for (const facing of [0, 1, 2, 3] as Facing[]) {
      const d = drawnOf(withFloor("wardrobe", { x: 4.5, z: 8.5, facing }), "wardrobe");
      expect({ facing, box: r4Box(d.box) }).toEqual({ facing, box: { width: 1, height: 2.38, depth: 0.876 } });
    }
  });
});

// ---------- B. 줄인 바닥 그림자(바뀔 동작) ----------

describe("[spec] 066-② B: 바닥 그림자는 줄인 방향만 모델과 같은 비율로 줄인다", () => {
  test("B1 옷장·책장 그림자: 가로 1.4 → 1.25(1.4 × 1.0/1.12), 깊이 1.2·진하기 0.52 그대로", () => {
    expect(r4List(drawnOf(P0(), "wardrobe").floorShadow)).toEqual([1.25, 1.2, 0.52]);
    expect(r4List(drawnOf(P0(), "bookcase").floorShadow)).toEqual([1.25, 1.2, 0.52]);
  });

  test("B2 책상 그림자: 깊이 1.65 → 1.65 × 1.0/1.318(약 1.25), 가로 2.8·진하기 0.5 그대로", () => {
    const s = drawnOf(P0(), "desk").floorShadow!;
    expect(s).not.toBeNull();
    expect(r4(s[0])).toBe(2.8);
    expect(s[1]).toBeCloseTo((1.65 * 1.0) / 1.318, 4);
    expect(s[1]).toBeCloseTo(1.25, 2);
    expect(r4(s[2])).toBe(0.5);
  });
});

// ---------- C. 그리는 자리: 뒷면은 칸 뒤 끝, 모델은 칸 안(바뀔 동작) ----------

describe("[spec] 066-② C: 바닥 가구는 모델 뒷면을 칸 뒤 끝에 맞추고, 모델이 칸 밖으로 나가지 않는다", () => {
  test("C1 처음 배치의 책장은 왼쪽 벽에 딱 붙는다: 그린 자리 (0.438, 0, 2.5)(칸 뒤 끝 x 0에서 0.876/2 앞), 모델 왼끝 x 0", () => {
    const d = drawnOf(P0(), "bookcase");
    expect({ x: r4(d.x), y: r4(d.y), z: r4(d.z) }).toEqual({ x: 0.438, y: 0, z: 2.5 });
    expect(r4(modelExtent(d, 1).minX)).toBe(0);
  });

  test("C2 처음 배치의 옷장은 오른쪽 벽에 딱 붙는다: 그린 자리 (7.562, 0, 3.5), 모델 오른끝 x 8(방 폭)", () => {
    const d = drawnOf(P0(), "wardrobe");
    expect({ x: r4(d.x), y: r4(d.y), z: r4(d.z) }).toEqual({ x: 7.562, y: 0, z: 3.5 });
    expect(r4(modelExtent(d, 3).maxX)).toBe(ROOM.width);
  });

  test("C3 처음 배치의 책상: 그린 자리는 지금처럼 (1.25, 0, 5.5)(가로 -0.25 치우침, 깊이 1.0이 칸 깊이와 같아 가운데), 모델 앞뒤가 칸 5~6 안", () => {
    const d = drawnOf(P0(), "desk");
    expect({ x: r4(d.x), y: r4(d.y), z: r4(d.z) }).toEqual({ x: 1.25, y: 0, z: 5.5 });
    const e = modelExtent(d, 0);
    expect({ minZ: r4(e.minZ), maxZ: r4(e.maxZ) }).toEqual({ minZ: 5, maxZ: 6 });
  });

  test("C4 옷장을 방 가운데 (5.5, 9.5)에 앞을 보게: 그린 자리 (5.5, 9.438), 모델 뒷면 z 9(칸 뒤 끝), 앞면 9.876, 좌우 5~6", () => {
    const d = drawnOf(withFloor("wardrobe", { x: 5.5, z: 9.5, facing: 0 }), "wardrobe");
    expect({ x: r4(d.x), z: r4(d.z) }).toEqual({ x: 5.5, z: 9.438 });
    const e = modelExtent(d, 0);
    expect({ minX: r4(e.minX), maxX: r4(e.maxX), minZ: r4(e.minZ), maxZ: r4(e.maxZ) }).toEqual({ minX: 5, maxX: 6, minZ: 9, maxZ: 9.876 });
  });

  test("C5 책장을 뒷벽에 붙여 앞을 보게 (3.5, 0.5): 모델 뒷면 z 0(뒷벽)에 딱 붙는다", () => {
    const d = drawnOf(withFloor("bookcase", { x: 3.5, z: 0.5, facing: 0 }), "bookcase");
    expect({ x: r4(d.x), z: r4(d.z) }).toEqual({ x: 3.5, z: 0.438 });
    expect(r4(modelExtent(d, 0).minZ)).toBe(0);
  });

  test("C6 책상을 뒷벽에 붙여 앞을 보게 (4.5, 0.5): 모델 뒷면 z 0, 앞면 z 1(칸 앞 끝), 가로 자리 4.25", () => {
    const d = drawnOf(withFloor("desk", { x: 4.5, z: 0.5, facing: 0 }), "desk");
    expect({ x: r4(d.x), z: r4(d.z) }).toEqual({ x: 4.25, z: 0.5 });
    const e = modelExtent(d, 0);
    expect({ minZ: r4(e.minZ), maxZ: r4(e.maxZ) }).toEqual({ minZ: 0, maxZ: 1 });
  });

  const types = ["wardrobe", "bookcase", "desk"] as const;
  const facings = [0, 1, 2, 3] as Facing[];
  const grid: [string, (typeof types)[number], Facing][] = types.flatMap((t) => facings.map((f) => [`${t} 방향 ${f}`, t, f] as [string, (typeof types)[number], Facing]));

  test.each(grid)("C7 %s((4.5, 8.5)): 모델이 칸 안이고, 뒷면이 칸 뒤 끝이며, 가로 자리가 그리는 자리(책상 -0.25, 옷장·책장 0)다", (_label, type, facing) => {
    const floor = { x: 4.5, z: 8.5, facing };
    const d = drawnOf(withFloor(type, floor), type);
    const cell = current.bounds(type, floor);
    const e = modelExtent(d, facing);
    const inside = e.minX >= cell.minX - 1e-6 && e.maxX <= cell.maxX + 1e-6 && e.minZ >= cell.minZ - 1e-6 && e.maxZ <= cell.maxZ + 1e-6;
    const local = toLocal(floor, d);
    expect({
      inside,
      backFlush: near(backEdge(e, facing), backEdge(cell, facing)),
      localX: r4(local.x),
      localZ: r4(local.z)
    }).toEqual({
      inside: true,
      backFlush: true,
      localX: DRAW_X[type],
      // 칸 뒤 끝(-깊이/2)에서 줄인 깊이의 절반 앞
      localZ: r4(-CELL[type].depth / 2 + FIT_BOX[type].depth / 2)
    });
  });
});

// ---------- D. 깔개 칸 3×3(바뀔 동작) ----------

describe("[spec] 066-② D: 깔개가 차지하는 칸이 3×3이 된다", () => {
  test("D1 깔개의 칸 모양은 방향과 상관없이 가로 3·깊이 3이다", () => {
    for (const facing of [0, 1, 2, 3] as Facing[]) {
      expect({ facing, size: current.size("rug", facing) }).toEqual({ facing, size: { width: 3, depth: 3 } });
    }
  });

  test("D2 처음 자리 (4.6, 7.2)의 깔개 칸 범위는 x 3.1~6.1, z 5.7~8.7이다", () => {
    const b = current.bounds("rug", { x: 4.6, z: 7.2, facing: 0 });
    expect({ minX: r4(b.minX), maxX: r4(b.maxX), minZ: r4(b.minZ), maxZ: r4(b.maxZ) }).toEqual({ minX: 3.1, maxX: 6.1, minZ: 5.7, maxZ: 8.7 });
  });

  test.each([
    ["(1.6, 2.2) → (1.5, 2.5)", { x: 1.6, z: 2.2 }, { x: 1.5, z: 2.5 }],
    ["(4.9, 7.3) → (4.5, 7.5)", { x: 4.9, z: 7.3 }, { x: 4.5, z: 7.5 }],
    ["(6.6, 7.2) → (6.5, 7.5)", { x: 6.6, z: 7.2 }, { x: 6.5, z: 7.5 }],
    ["(4.6, 7.2) → (4.5, 7.5)", { x: 4.6, z: 7.2 }, { x: 4.5, z: 7.5 }]
  ])("D3 끌 때 맞추는 깔개 가운데는 0.5 단위(3칸이 바닥 칸에 딱 맞는 자리): %s", (_label, point, expected) => {
    expect(current.snap("rug", 0, point)).toEqual(expected);
  });

  test.each([
    ["D4-2 (1.0, 9.0): 칸 -0.5~2.5가 왼벽 밖", { x: 1.0, z: 9.0, facing: 0 as Facing }],
    ["D4-4 (7.0, 9.5): 칸 5.5~8.5가 오른벽 밖", { x: 7.0, z: 9.5, facing: 0 as Facing }],
    ["D4-6 (4.5, 1.0): 칸 z -0.5~2.5가 뒷벽 밖", { x: 4.5, z: 1.0, facing: 0 as Facing }],
    ["D4-7 (4.5, 10.0): 칸 z 8.5~11.5가 방 앞 끝 밖", { x: 4.5, z: 10.0, facing: 0 as Facing }],
    ["D4-8 (1.0, 9.0) 오른쪽(1)으로 돌려도 3×3이라 왼벽 밖", { x: 1.0, z: 9.0, facing: 1 as Facing }]
  ])("D4 방 안 규칙: 깔개 %s → 놓을 수 없음", (_label, floor) => {
    expect(current.placeable(withFloor("rug", floor))).toBe(false);
  });

  test.each([
    ["D5-2 깔개 하나 더 (1.7, 7.2): 처음 깔개(3.1~6.1)와 x 3.1~3.2가 겹침", { x: 1.7, z: 7.2, facing: 0 as Facing }],
    ["D5-4 깔개 하나 더 (4.6, 4.3): 처음 깔개(z 5.7~8.7)와 z 5.7~5.8이 겹침", { x: 4.6, z: 4.3, facing: 0 as Facing }]
  ])("D5 덮개끼리 겹침(3×3 칸으로 판단): %s → 놓을 수 없음", (_label, floor) => {
    expect(current.placeable(plus("rug-2", "rug", floor))).toBe(false);
  });

  test("D6 편집 모드에서 처음 자리의 깔개를 고르면 칠하는 칸은 x 3.1~6.1, z 5.7~8.7(놓을 수 있음)이다", () => {
    const editor = current.editor(P0());
    select(editor, "rug", { x: 4.6, z: 7.2 });

    expect(editor.selected).toBe("rug");
    expect(editor.marks().map((m) => ({ piece: m.piece, minX: r4(m.minX), maxX: r4(m.maxX), minZ: r4(m.minZ), maxZ: r4(m.maxZ), ok: m.ok }))).toEqual([
      { piece: "rug", minX: 3.1, maxX: 6.1, minZ: 5.7, maxZ: 8.7, ok: true }
    ]);
  });

  test("D7 편집 모드에서 깔개를 (1.6, 2.2)까지 끌면 3칸에 맞춘 (1.5, 2.5)에 놓인다", () => {
    const editor = current.editor(P0());

    const notice = drag(editor, "rug", { x: 4.6, z: 7.2 }, { x: 1.6, z: 2.2 });

    expect(notice).toBeNull();
    expect(editor.layout.items.find((i) => i.id === "rug")?.floor).toEqual({ x: 1.5, z: 2.5, facing: 0 });
  });

  test("D8 편집 모드에서 깔개를 왼쪽 앞 구석 (0.9, 9.9)까지 끌면 맞춘 자리 (0.5, 9.5)의 칸이 왼벽 밖이라 끌기 전 (4.6, 7.2)로 돌아가고 \"cannot-place\"다", () => {
    const editor = current.editor(P0());

    const notice = drag(editor, "rug", { x: 4.6, z: 7.2 }, { x: 0.9, z: 9.9 });

    expect(notice).toBe("cannot-place");
    expect(editor.layout.items.find((i) => i.id === "rug")?.floor).toEqual({ x: 4.6, z: 7.2, facing: 0 });
  });
});

// ---------- E. 알릴 것: 벽에서 1칸 안의 깔개 저장분 ----------

describe("[spec] 066-② E: 벽에서 1칸 안에 저장된 깔개는 그대로 불러오고, 편집 모드의 방 안 규칙에 걸린다(명세 '알릴 것')", () => {
  const saved = () => ({
    version: 2,
    items: p0Items().map((i) => (i.id === "rug" ? { id: "rug", type: "rug", floor: { x: 1.0, z: 9.0, facing: 0 } } : i))
  });

  test("E1(그대로 둘 동작) 깔개가 (1.0, 9.0)인 저장 본문은 자리 점만 보아 그대로 불러온다", () => {
    const parsed = current.parse(saved());
    expect(parsed?.items.find((i) => i.id === "rug")?.floor).toEqual({ x: 1.0, z: 9.0, facing: 0 });
  });

  test("E2 그 배치로 편집 모드에 들어가 깔개를 고르면 칠하는 칸이 x -0.5~2.5이고 놓을 수 없음(빨강)이다", () => {
    const parsed = current.parse(saved());
    expect(parsed).not.toBeNull();
    const editor = current.editor(parsed!);
    select(editor, "rug", { x: 1.0, z: 9.0 });

    expect(editor.marks().map((m) => ({ piece: m.piece, minX: r4(m.minX), maxX: r4(m.maxX), ok: m.ok }))).toEqual([{ piece: "rug", minX: -0.5, maxX: 2.5, ok: false }]);
  });
});

// ---------- K. 그대로 둘 동작 ----------

describe("[spec] 066-② K: 그대로 둘 동작(깔개 모델·자리, 벽 가구, 의자, 높이)", () => {
  test("K1 깔개 모델은 줄이지 않는다: 크기 2.576×0.028×2.576, 처음 자리 그린 자리 (4.6, 0.004, 7.2)(칸 가운데)", () => {
    const d = drawnOf(P0(), "rug");
    expect({ box: r4Box(d.box), x: r4(d.x), y: r4(d.y), z: r4(d.z) }).toEqual({ box: { width: 2.576, height: 0.028, depth: 2.576 }, x: 4.6, y: 0.004, z: 7.2 });
  });

  test("K2 깔개는 어느 방향이든 칸 가운데에 그린다: (2.0, 9.0) 오른쪽(1) → 그린 자리 (2.0, 9.0)", () => {
    const d = drawnOf(withFloor("rug", { x: 2.0, z: 9.0, facing: 1 }), "rug");
    expect({ x: r4(d.x), z: r4(d.z) }).toEqual({ x: 2, z: 9 });
  });

  test("K3 게시판·창문은 벽 폭 안이라 크기·벽 그림자가 그대로다(게시판 1.792×1.4×0.126, 그림자 2.0×1.6, 창문 2.3×1.876×0.35, 그림자 2.55×2.15)", () => {
    const board = drawnOf(P0(), "board");
    const win = drawnOf(P0(), "window");
    expect({ box: r4Box(board.box), wall: r4List(board.wallShadow) }).toEqual({ box: { width: 1.792, height: 1.4, depth: 0.126 }, wall: [2, 1.6, 0.3] });
    expect({ box: r4Box(win.box), wall: r4List(win.wallShadow) }).toEqual({ box: { width: 2.3, height: 1.876, depth: 0.35 }, wall: [2.55, 2.15, 0.3] });
  });

  test("K4 의자: 모델 크기 0.56×1.316×0.56, 그림자 0.75×0.75(0.42), 책상 밑 자리 (1.5, 0, 5.95)", () => {
    const chair = drawnOf(P0(), "desk", true);
    expect({ box: r4Box(chair.box), shadow: r4List(chair.floorShadow), x: r4(chair.x), y: r4(chair.y), z: r4(chair.z) }).toEqual({
      box: { width: 0.56, height: 1.316, depth: 0.56 },
      shadow: [0.75, 0.75, 0.42],
      x: 1.5,
      y: 0,
      z: 5.95
    });
  });

  test.each([
    ["K6-1 깔개 (1.5, 9.5): 3×3 칸 0~3, 8~11이 방 안", withFloor("rug", { x: 1.5, z: 9.5, facing: 0 })],
    ["K6-2 깔개 (6.5, 9.5): 3×3 칸 5~8이 방 안", withFloor("rug", { x: 6.5, z: 9.5, facing: 0 })],
    ["K6-3 깔개 (4.5, 1.5): 3×3 칸 z 0~3이 방 안(창문 아래라도 덮개는 됨)", withFloor("rug", { x: 4.5, z: 1.5, facing: 0 })],
    ["K6-4 깔개 하나 더 (1.6, 7.2): 처음 깔개(3.1~6.1)와 x 3.1에서 맞닿기만 함", plus("rug-2", "rug", { x: 1.6, z: 7.2, facing: 0 })],
    ["K6-5 깔개 하나 더 (4.6, 4.2): 처음 깔개(z 5.7~8.7)와 z 5.7에서 맞닿기만 함", plus("rug-2", "rug", { x: 4.6, z: 4.2, facing: 0 })]
  ])("K6 D4·D5의 경계 짝(2×2 때도 3×3에서도 놓을 수 있는 자리): %s → 놓을 수 있음", (_label, l) => {
    expect(current.placeable(l)).toBe(true);
  });

  test("K5 처음 배치는 3×3 깔개로도 놓을 수 있는 배치다", () => {
    expect(current.placeable(P0())).toBe(true);
  });
});
