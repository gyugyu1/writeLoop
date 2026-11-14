// [spec] qa 테스트(작업 067 모바일 로비 책상 가로 3칸, 기능 변경, 모바일): 카탈로그에서 "가로를 칸 폭에 맞춰 늘리기"를 켠 가구(책상)는
// 모델 가로가 칸 폭보다 작아도 칸 폭에 맞게 늘려 그리고, 책상 장소의 바라볼 지점·이름표가 칸 가운데(가구 기준 x 0)로 옮겨지는지.
// 기대값은 명세(private 작업 폴더 067/01-main-spec.md)에서만 가져온다:
// - 바뀌는 동작 1: 표시를 켠 가구는 모델 가로가 칸 폭보다 작아도 칸 폭에 맞게 늘린다. 켜지 않은 가구는 지금처럼 넘칠 때만 줄인다.
//   사용자 결정: 표시는 카탈로그에 두고 책상에만 켠다(가구 이름으로 나누지 않는다). 높이·깊이는 그대로다.
// - 바뀌는 동작 2: 책상 모델 가로 2.468 → 3.0(약 1.216배), 깊이 1.0·높이 1.292 그대로. 칸 가운데에 놓여 처음 배치의 그림이 (1.25, 5.5) → (1.5, 5.5).
//   바닥 그림자 가로 2.8 → 2.8 × 3.0/2.468(약 3.40), 깊이(약 1.25)·진하기 그대로. 대체 상자·누르기 상자도 가로 3.0.
// - 바뀌는 동작 3: 책상 장소의 바라볼 지점 (-0.25, 0) → (0, 0), 이름표 (-0.25, 2.1, 0) → (0, 2.1, 0)(가구 기준).
//   처음 배치에서 바라볼 지점 (1.25, 5.5) → (1.5, 5.5), 이름표 x 1.25 → 1.5. 옮기거나 돌려도 같은 가구 기준 값으로 따라간다.
// - 그대로여야 할 동작: 책상 칸 3×1·막힌 칸·처음 자리 (1.5, 5.5), 서는 자리(가구 기준 (0, 1.25)), 의자(자리·빼는 거리·앉는 자리·비켜서는 자리·
//   크기·그림자), 다른 가구(옷장·책장·깔개·게시판·창문)의 크기·자리·그림자(066 ② 결과 그대로).
// 좌표 약속(lobby-layout.ts): 가구 기준은 칸 모양 가운데가 원점이고 앞면 +z, 로컬 (a, b)를 방향 rotY θ로 돌리면 (a·cosθ + b·sinθ, −a·sinθ + b·cosθ).
//
// 늘린 크기를 어디서 읽는지는 명세가 정하지 않아 066 ② 때와 같이 가정한다(02-qa-tests.md "가정"):
// - 3D 목록(furniturePlacements)의 가구마다 box가 칸에 맞춘 모델 크기(대체 상자·누르기 상자), scale이 모델을 늘리거나 줄인 비율(가구 묶음이 쓰는 값),
//   shadow.floor가 맞춘 그림자다. 장소의 바라볼 지점·이름표는 layoutGeometry(...).places에서 읽는다.
// - 공통 규칙은 fittedModel(가구 종류)이다(명세가 "066 ②의 fittedModel"이라 부른다). 카탈로그 표시의 이름은 명세가 정하지 않아 이 파일은 쓰지 않는다.
//   "가구 이름으로 나누지 않는다"는 책상 종류 값을 그대로 둔 채 id만 바꾼 것(늘린다)과, 표시가 없는 종류에 id만 "desk"를 붙인 것(늘리지 않는다)으로 본다.
// - 구현이 다른 이름으로 내면 아래 "지금 코드를 부르는 곳"만 따라 고친다. 그 아래의 기대값·단언·입력은 고치지 않는다.
// 가구 묶음(Kenney 모델)을 늘려 그리는지와 그림자 판의 크기는 three를 Jest에서 그릴 수 없어 이 파일이 보지 않는다(보고에 적음).
// 분류: 바뀔 동작(고치기 전에는 실패해야 한다) W1~W6, N1. 그대로 둘 동작(고치기 전에도 통과해야 한다) N2, K1~K4.
import { ROOM } from "@/lib/lobby3d/engine";
import { fittedModel, furnitureType, type FurnitureType } from "@/lib/lobby3d/furniture-catalog";
import { furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { floorPieceBounds, layoutGeometry, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

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
  /** 칸에 맞춘 모델 크기(대체 상자·누르기 상자). */
  box: Box | null;
  /** 모델을 늘리거나 줄인 비율(가로 x·깊이 z). */
  scale: { x: number; z: number } | null;
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
        scale: p.scale ?? null,
        floorShadow: p.shadow?.floor ?? null,
        wallShadow: p.shadow?.wall ?? null
      })),
  /** 배치의 장소(서는 자리·바라볼 지점·이름표), 막힌 칸, 의자. */
  geometry: (layout: LobbyLayout) => layoutGeometry(layout, ROOM.width),
  bounds: (type: string, floor: FloorSpot) => floorPieceBounds(type, floor),
  /** 공통 규칙(066 ②의 fittedModel): 가구 종류 → 칸에 맞춘 크기·자리·그림자. */
  fit: (type: FurnitureType) => fittedModel(type),
  type: (id: string) => furnitureType(id)
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

/** 처음 배치에서 책상 자리만 바꾼 배치. */
function withDesk(floor: FloorSpot): LobbyLayout {
  return layout(p0Items().map((i) => (i.id === "desk" ? ({ ...i, floor } as LayoutItem) : i)));
}

function drawnOf(l: LobbyLayout, item: string, companion = false): Drawn {
  const found = current.drawn(l).find((d) => d.item === item && d.companion === companion);
  if (!found) throw new Error(`3D 목록에 ${item}${companion ? "의 의자" : ""}가 없다`);
  return found;
}

// ---------- 도우미 ----------

const r4 = (v: number) => {
  const n = Math.round(v * 1e4) / 1e4;
  return n === 0 ? 0 : n;
};
const r4Box = (b: Box | null) => (b ? { width: r4(b.width), height: r4(b.height), depth: r4(b.depth) } : null);
const r4List = (l: readonly number[] | null) => (l ? l.map(r4) : null);
const pt = (p: { x: number; z: number }): [number, number] => [r4(p.x), r4(p.z)];

const FACING_ROT: Record<Facing, number> = { 0: 0, 1: Math.PI / 2, 2: Math.PI, 3: -Math.PI / 2 };

/** 방 좌표의 점을 가구 기준(칸 모양 가운데가 원점, 앞면 +z)으로 되돌린다. */
function toLocal(floor: FloorSpot, p: { x: number; z: number }): { x: number; z: number } {
  const t = FACING_ROT[floor.facing];
  const dx = p.x - floor.x;
  const dz = p.z - floor.z;
  // 로컬 (a, b) → 방 (a·cos + b·sin, −a·sin + b·cos)의 역변환
  return { x: dx * Math.cos(t) - dz * Math.sin(t), z: dx * Math.sin(t) + dz * Math.cos(t) };
}

/** 그린 모델(가운데 자리, 맞춘 가로·깊이, 방향)이 바닥에서 차지하는 범위(방 좌표). */
function modelExtent(d: Drawn, facing: Facing) {
  const sideways = facing % 2 === 1;
  const w = sideways ? d.box!.depth : d.box!.width;
  const dd = sideways ? d.box!.width : d.box!.depth;
  return { minX: d.x - w / 2, maxX: d.x + w / 2, minZ: d.z - dd / 2, maxZ: d.z + dd / 2 };
}

// ---------- 명세의 값 ----------

/** 책상 모델: 가로 3.0(칸 폭), 높이 1.292·깊이 1.0 그대로(바뀌는 동작 2). */
const DESK_BOX = { width: 3, height: 1.292, depth: 1 };
/** 책상 모델 실제 가로(카탈로그)와 실제 깊이: 늘린 비율 3.0/2.468, 깊이 비율 1.0/1.318(066 ②). */
const DESK_STRETCH_X = 3.0 / 2.468;
const DESK_DEPTH_Z = 1.0 / 1.318;
/** 책상 장소의 이름표 높이(가구 기준 y 2.1 그대로). */
const LABEL_Y = 2.1;

// ---------- W. 책상을 칸 폭 3.0에 맞춰 늘린다(바뀔 동작) ----------

describe("[spec] 067 W: 책상은 모델 가로를 칸 폭 3.0에 맞춰 늘리고 칸 가운데에 놓는다", () => {
  test("W1 책상 모델 크기(대체 상자·누르기 상자): 가로 2.468 → 3.0, 높이 1.292·깊이 1.0 그대로", () => {
    expect(r4Box(drawnOf(P0(), "desk").box)).toEqual(DESK_BOX);
  });

  test("W2 책상 모델을 늘린 비율: 가로 3.0/2.468(약 1.216배), 깊이는 066 ② 그대로 1.0/1.318", () => {
    const s = drawnOf(P0(), "desk").scale;
    expect(s).not.toBeNull();
    expect(s!.x).toBeCloseTo(DESK_STRETCH_X, 4);
    expect(s!.x).toBeCloseTo(1.216, 3);
    expect(s!.z).toBeCloseTo(DESK_DEPTH_Z, 4);
  });

  test("W3 처음 배치의 책상 그림: (1.25, 0, 5.5) → (1.5, 0, 5.5)(칸 가운데), 모델이 칸 x 0~3, z 5~6을 꽉 채운다", () => {
    const d = drawnOf(P0(), "desk");
    expect({ x: r4(d.x), y: r4(d.y), z: r4(d.z) }).toEqual({ x: 1.5, y: 0, z: 5.5 });
    const e = modelExtent(d, 0);
    expect({ minX: r4(e.minX), maxX: r4(e.maxX), minZ: r4(e.minZ), maxZ: r4(e.maxZ) }).toEqual({ minX: 0, maxX: 3, minZ: 5, maxZ: 6 });
  });

  test("W4 책상 바닥 그림자: 가로 2.8 → 2.8 × 3.0/2.468(약 3.40), 깊이 1.65 × 1.0/1.318(약 1.25)·진하기 0.5 그대로", () => {
    const s = drawnOf(P0(), "desk").floorShadow;
    expect(s).not.toBeNull();
    expect(s![0]).toBeCloseTo((2.8 * 3.0) / 2.468, 4);
    expect(s![0]).toBeCloseTo(3.4, 1);
    expect(s![1]).toBeCloseTo((1.65 * 1.0) / 1.318, 4);
    expect(r4(s![2])).toBe(0.5);
  });

  test("W5 처음 배치의 책상 장소: 바라볼 지점 (1.25, 5.5) → (1.5, 5.5), 이름표 (1.25, 2.1, 5.5) → (1.5, 2.1, 5.5)", () => {
    const desk = current.geometry(P0()).places.desk;
    expect({ faceTo: pt(desk.faceTo), label: [r4(desk.label.x), r4(desk.label.y), r4(desk.label.z)] }).toEqual({
      faceTo: [1.5, 5.5],
      label: [1.5, LABEL_Y, 5.5]
    });
  });

  const facings = [0, 1, 2, 3] as Facing[];

  test.each(facings)("W6 책상을 (4.5, 8.5)에 방향 %s로 놓으면: 모델이 칸을 꽉 채우고(가구 기준 가운데), 크기는 3.0×1.292×1.0, 바라볼 지점·이름표가 가구 기준 (0, 0)·(0, 2.1, 0)", (facing) => {
    const floor = { x: 4.5, z: 8.5, facing };
    const d = drawnOf(withDesk(floor), "desk");
    const cell = current.bounds("desk", floor);
    const e = modelExtent(d, facing);
    const local = toLocal(floor, d);
    const place = current.geometry(withDesk(floor)).places.desk;
    const faceLocal = toLocal(floor, place.faceTo);
    const labelLocal = toLocal(floor, place.label);
    expect({
      box: r4Box(d.box),
      extent: { minX: r4(e.minX), maxX: r4(e.maxX), minZ: r4(e.minZ), maxZ: r4(e.maxZ) },
      drawLocal: [r4(local.x), r4(local.z)],
      faceLocal: [r4(faceLocal.x), r4(faceLocal.z)],
      label: [r4(labelLocal.x), r4(place.label.y), r4(labelLocal.z)]
    }).toEqual({
      box: DESK_BOX,
      extent: { minX: r4(cell.minX), maxX: r4(cell.maxX), minZ: r4(cell.minZ), maxZ: r4(cell.maxZ) },
      drawLocal: [0, 0],
      faceLocal: [0, 0],
      label: [0, LABEL_Y, 0]
    });
  });
});

// ---------- N. 표시는 카탈로그 값이고 가구 이름으로 나누지 않는다(사용자 결정) ----------

describe("[spec] 067 N: 늘리기는 카탈로그 표시로 정하고 가구 이름(id)으로 나누지 않는다(공통 규칙 fittedModel)", () => {
  test("N1(바뀔) 책상 종류 값을 그대로 둔 채 id만 desk-copy로 바꿔도 가로를 칸 폭 3.0에 맞춰 늘리고 칸 가운데(x 0)에 놓는다", () => {
    const copy: FurnitureType = { ...current.type("desk"), id: "desk-copy", name: "책상 복사" };
    const fit = current.fit(copy);
    expect({ box: r4Box(fit.box), drawX: r4(fit.drawAt.x), drawZ: r4(fit.drawAt.z) }).toEqual({ box: DESK_BOX, drawX: 0, drawZ: 0 });
    expect(fit.scale.x).toBeCloseTo(DESK_STRETCH_X, 4);
  });

  test("N2(그대로) 표시가 없는 종류(옷장 값)에 id만 desk를 붙이고 칸 3×1·모델 2.468×1.292×1.318·치우침 -0.25를 주면, 지금처럼 넘치는 깊이만 줄이고 가로는 늘리지 않는다", () => {
    const wardrobe = current.type("wardrobe");
    const plain: FurnitureType = {
      ...wardrobe,
      id: "desk",
      size: { width: 3, depth: 1 },
      height: { bottom: 0, top: 1.292 },
      model: { ...wardrobe.model, box: { width: 2.468, height: 1.292, depth: 1.318 }, offsetX: -0.25, shadow: { floor: [2.8, 1.65, 0.5] } }
    };
    const fit = current.fit(plain);
    expect({ box: r4Box(fit.box), scaleX: r4(fit.scale.x), drawX: r4(fit.drawAt.x), drawZ: r4(fit.drawAt.z), shadowX: r4(fit.shadow!.floor![0]) }).toEqual({
      box: { width: 2.468, height: 1.292, depth: 1 },
      scaleX: 1,
      drawX: -0.25,
      drawZ: 0,
      shadowX: 2.8
    });
    expect(fit.scale.z).toBeCloseTo(DESK_DEPTH_Z, 4);
  });
});

// ---------- K. 그대로 둘 동작 ----------

describe("[spec] 067 K: 그대로 둘 동작(책상 칸·서는 자리·의자, 다른 가구)", () => {
  test("K1 책상 칸 3×1과 막힌 칸 \"0,5\" \"1,5\" \"2,5\", 처음 자리 (1.5, 5.5), 서는 자리 (1.5, 6.75)(가구 기준 (0, 1.25))", () => {
    const g = current.geometry(P0());
    const cell = current.bounds("desk", { x: 1.5, z: 5.5, facing: 0 });
    expect({
      cell: { minX: r4(cell.minX), maxX: r4(cell.maxX), minZ: r4(cell.minZ), maxZ: r4(cell.maxZ) },
      solid: [...g.solidTiles].filter((t) => t.endsWith(",5")).sort(),
      approach: g.places.desk.approach.map(pt)
    }).toEqual({
      cell: { minX: 0, maxX: 3, minZ: 5, maxZ: 6 },
      solid: ["0,5", "1,5", "2,5"],
      approach: [[1.5, 6.75]]
    });
  });

  test.each([1, 2, 3] as Facing[])("K2 책상을 (4.5, 8.5)에 방향 %s로 놓아도 서는 자리는 가구 기준 (0, 1.25)를 따라간다", (facing) => {
    const floor = { x: 4.5, z: 8.5, facing };
    const approach = current.geometry(withDesk(floor)).places.desk.approach.map((p) => toLocal(floor, p));
    expect(approach.map((p) => [r4(p.x), r4(p.z)])).toEqual([[0, 1.25]]);
  });

  test("K3 의자: 크기 0.56×1.316×0.56, 그림자 0.75×0.75(0.42), 늘리지 않음(비율 1), 책상 밑 자리 (1.5, 0, 5.95), 빼는 거리 0.5, 앉는 자리 (1.5, 6.45), 비켜서는 자리 (2.15, 6.55)", () => {
    const chair = drawnOf(P0(), "desk", true);
    const c = current.geometry(P0()).chair;
    expect({
      box: r4Box(chair.box),
      shadow: r4List(chair.floorShadow),
      scale: chair.scale,
      at: [r4(chair.x), r4(chair.y), r4(chair.z)],
      home: pt(c.home),
      pull: r4(c.pull),
      seat: pt(c.seat),
      side: pt(c.side)
    }).toEqual({
      box: { width: 0.56, height: 1.316, depth: 0.56 },
      shadow: [0.75, 0.75, 0.42],
      scale: { x: 1, z: 1 },
      at: [1.5, 0, 5.95],
      home: [1.5, 5.95],
      pull: 0.5,
      seat: [1.5, 6.45],
      side: [2.15, 6.55]
    });
  });

  test("K4 다른 가구는 066 ② 결과 그대로: 옷장·책장은 넘치는 가로만 1.0으로 줄이고, 깔개(2.576 < 칸 3)·게시판(1.792 < 벽 폭 1.8)은 칸보다 작아도 늘리지 않는다", () => {
    const pick = (item: string) => {
      const d = drawnOf(P0(), item);
      return {
        box: r4Box(d.box),
        scale: d.scale ? { x: r4(d.scale.x), z: r4(d.scale.z) } : null,
        at: [r4(d.x), r4(d.y), r4(d.z)],
        floor: r4List(d.floorShadow),
        wall: r4List(d.wallShadow)
      };
    };
    expect({
      wardrobe: pick("wardrobe"),
      bookcase: pick("bookcase"),
      rug: pick("rug"),
      board: pick("board"),
      window: pick("window")
    }).toEqual({
      wardrobe: { box: { width: 1, height: 2.38, depth: 0.876 }, scale: { x: r4(1 / 1.12), z: 1 }, at: [7.562, 0, 3.5], floor: [1.25, 1.2, 0.52], wall: null },
      bookcase: { box: { width: 1, height: 2.464, depth: 0.876 }, scale: { x: r4(1 / 1.12), z: 1 }, at: [0.438, 0, 2.5], floor: [1.25, 1.2, 0.52], wall: null },
      rug: { box: { width: 2.576, height: 0.028, depth: 2.576 }, scale: { x: 1, z: 1 }, at: [4.6, 0.004, 7.2], floor: null, wall: null },
      board: { box: { width: 1.792, height: 1.4, depth: 0.126 }, scale: { x: 1, z: 1 }, at: [1.8, 1.75, 0.06], floor: null, wall: [2, 1.6, 0.3] },
      window: { box: { width: 2.3, height: 1.876, depth: 0.35 }, scale: { x: 1, z: 1 }, at: [4.8, 2.05, 0.17], floor: null, wall: [2.55, 2.15, 0.3] }
    });
  });
});
