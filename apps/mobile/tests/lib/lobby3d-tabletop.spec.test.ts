// [spec] qa 테스트(작업 066-④ 탁상형(책상 위 소품), 새 기능, 모바일): 카탈로그, 처음 배치, 3D 자리와 받침 가구 따라가기,
// 편집 모드(고르기·돌리기·치우기·끌기·자리 표시·꺼내기)를 편집기와 배치 계산 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 066/05-책상-위-소품/03-qa-scenarios.md)와 결정(같은 폴더 04-main-decision.md)에서만 가져온다.
// - 결정 1: 차 있는 자리에 손을 떼면 끌기 전 자리로 돌아가고 "놓을 수 없는 자리" 안내(cannot-place)다. 빨간 가구가 되지 않는다.
//   그래서 시나리오의 M6을 이 결정대로 쓰고, 빨간 가구를 전제로 한 M7·M8·M9·K3은 쓰지 않는다. T5의 빨간 가구는 지금 규칙대로 돌려서 만든다(깔개).
// - 결정 3: 꺼낸 스탠드의 방향은 0(T1). 결정 4: 받침 가구가 둘인 경우(M10·T6)는 편집기에 직접 넣는 단위 테스트로 본다.
// 좌표 약속(시나리오 0절): 가구 기준 앞면 +z, rotY 0 → 0, 1 → π/2, 2 → π, 3 → -π/2. 처음 배치 책상 (1.5, 5.5, 0), 윗면 1.292,
// 자리 0 (0.5, 5.5), 1 (1.5, 5.5), 2 (2.5, 5.5). 스탠드의 방 방향 = (받침 가구 방향 + on.facing) mod 4.
// 부르는 방법은 구현(dd3c870)에서 이름만 읽었다: 카탈로그의 mount "tabletop"(탁상형), surface(윗면 표시), 3D 목록 furniturePlacements의 item·x·y·z·rotY·box·blocker,
// LobbyEditor의 pointerDown·pointerMove·pointerUp·rotate·store·takeOut·marks·selected·handle·storable·red·canFinish·changed·layout, 편집 표시의 y(칠하는 높이).
// 시나리오 해석 바꿈(보고 07-qa-tests.md에 적음): G10은 "스탠드에 장소 표시(mark)가 없다"를 빼고 "길을 막지 않는다(blocker 아님)"만 본다.
//   명세 5는 "그 자리를 누르면 책상(장소)을 누른 것"이라 결과만 정하고, 이 결과는 3D 테스트(B10)가 본다.
// F1은 책상을 시나리오의 (3.5, 5.5) 대신 069 테스트에서 놓을 수 있다고 확인된 (1.5, 6.5)로 옮긴다(놓을 수 있는지가 아니라 따라가기를 보려고). 기대값은 같은 규칙으로 계산했다.
// 075(꾸미기: 들린 가구를 탭으로 옮기기) 명세의 "고칠 기존 테스트"로 B6·B7·B8을 새 동작으로 고쳤다(private 작업 폴더
// 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/01-main-spec.md, 보고 02-qa-tests.md): 가구가 골라져 있을 때 다른 곳을 톡하면
// 골라진 가구를 그리로 옮기고(소품은 가장 가까운 받침 자리) 골라진 채 두며, 둘 수 없으면 옮기지 않고 안내한다(탭한 곳의 가구는 골라지지 않는다).
import { readFileSync } from "fs";
import { join } from "path";
import { TAP_MAX_MOVE_PX, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES, REQUIRED_FURNITURE_TYPES, findFurnitureType, fittedModel, furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { FURNITURE_LAYOUT, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { LobbyEditor, isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, makeLayout, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type LayoutItem = LobbyLayout["items"][number];
type Stored = { id: string; type: string };
type Facing = 0 | 1 | 2 | 3;

const TOP = 1.292;
const ROT: Record<Facing, number> = { 0: 0, 1: Math.PI / 2, 2: Math.PI, 3: -Math.PI / 2 };

/** 스탠드 전 처음 배치 여섯 개(시나리오의 P0). */
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

function lampItem(id: string, slot: number, facing: Facing = 0, parent = "desk"): LayoutItem {
  return { id, type: "lamp", on: { parent, slot, facing } } as LayoutItem;
}

function layoutOf(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(items, stored))) as LobbyLayout;
}

const P0 = () => layoutOf(p0Items());
/** 시나리오의 L(k, f). */
const L = (slot: number, facing: Facing = 0) => layoutOf([...p0Items(), lampItem("lamp", slot, facing)]);
/** 시나리오의 N0(새 처음 배치). */
const N0 = () => L(0, 0);
/** 시나리오의 L2(a, b). */
const L2 = (a: number, b: number) => layoutOf([...p0Items(), lampItem("lamp", a), lampItem("lamp2", b)]);

function withDesk(layout: LobbyLayout, floor: { x: number; z: number; facing: Facing }): LobbyLayout {
  return { ...layout, items: layout.items.map((item) => (item.id === "desk" ? { ...item, floor } : item)) };
}

function sortedById<T extends { id: string }>(list: readonly T[] | undefined): T[] {
  return [...(list ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function itemOf(layout: LobbyLayout, id: string) {
  return layout.items.find((item) => item.id === id);
}

function storedOf(layout: LobbyLayout): Stored[] {
  return (layout as { stored?: Stored[] }).stored ?? [];
}

/** 3D 목록에서 그 가구(딸린 의자 빼고)의 자리. */
function placementOf(layout: LobbyLayout, id: string) {
  const found = furniturePlacements(layout).filter((p) => p.item === id && !p.companion);
  expect(found).toHaveLength(1);
  return found[0];
}

function expectPose(layout: LobbyLayout, id: string, want: { x: number; y: number; z: number; rotY: number }) {
  const p = placementOf(layout, id);
  expect({ x: p.x, y: p.y, z: p.z }).toEqual({ x: expect.closeTo(want.x, 6), y: expect.closeTo(want.y, 6), z: expect.closeTo(want.z, 6) });
  expect(Math.cos(p.rotY)).toBeCloseTo(Math.cos(want.rotY), 6);
  expect(Math.sin(p.rotY)).toBeCloseTo(Math.sin(want.rotY), 6);
}

function hit(point: FloorPoint | null, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

function tap(editor: LobbyEditor, point: FloorPoint | null, piece: string | null) {
  editor.pointerDown(hit(point, piece), 200, 300);
  return editor.pointerUp();
}

/** 누르고 끈다(떼지 않는다). */
function pressAndMove(editor: LobbyEditor, piece: string, from: FloorPoint, to: FloorPoint) {
  editor.pointerDown(hit(from, piece), 200, 300);
  editor.pointerMove(hit(to, null), 200 + TAP_MAX_MOVE_PX + 50, 300 + TAP_MAX_MOVE_PX + 50);
}

function drag(editor: LobbyEditor, piece: string, from: FloorPoint, to: FloorPoint) {
  pressAndMove(editor, piece, from, to);
  return editor.pointerUp();
}

const SLOT = [
  { x: 0.5, z: 5.5 },
  { x: 1.5, z: 5.5 },
  { x: 2.5, z: 5.5 }
];

// ---------- 1. 카탈로그 ----------

describe("[spec] 066-④ 명세 1·2: 카탈로그", () => {
  test("C1 lamp는 이름 '스탠드', 탁상형, 치울 수 있고 길을 막지 않으며 장소·딸린 의자가 없다", () => {
    const type = findFurnitureType("lamp");
    expect(type).toBeDefined();
    expect(type!.name).toBe("스탠드");
    expect(type!.mount).toBe("tabletop");
    expect(type!.removable).toBe(true);
    expect(type!.blocksWalk).toBe(false);
    expect(type!.place).toBeUndefined();
    expect(type!.chair).toBeUndefined();
  });

  // 066-⑤ 04 결정 1의 2: 협탁이 받침 가구가 되어(⑤ 명세 3) "책상뿐"을 "책상과 협탁"으로 고쳤다.
  test("C2 윗면이 있다고 표시한 종류는 책상과 협탁이다", () => {
    expect(FURNITURE_TYPES.filter((type) => type.surface).map((type) => type.id)).toEqual(["desk", "nightstand"]);
  });

  test("C3 장소 가구 목록은 게시판·창문·책상·책장 넷 그대로다(스탠드가 들지 않는다)", () => {
    expect([...REQUIRED_FURNITURE_TYPES].sort()).toEqual(["board", "bookcase", "desk", "window"]);
  });

  test("C4 스탠드를 칸에 맞춘 모델은 가로·깊이가 자리 칸(1)을 넘지 않고 높이는 카탈로그 그대로이며, 카탈로그 모델이 1 이하면 비율이 (1, 1)이다", () => {
    const type = furnitureType("lamp");
    const fit = fittedModel(type);
    expect(fit.box.width).toBeLessThanOrEqual(1);
    expect(fit.box.depth).toBeLessThanOrEqual(1);
    expect(fit.box.height).toBe(type.model.box.height);
    if (type.model.box.width <= 1 && type.model.box.depth <= 1) expect(fit.scale).toEqual({ x: 1, z: 1 });
    expect(placementOf(N0(), "lamp").box).toEqual(fit.box);
  });

  test("C5 가구 묶음 lobby-furniture.glb에 스탠드 모델 노드가 있고, 기존 가구 노드도 그대로 있다", () => {
    const buffer = readFileSync(join(__dirname, "..", "..", "assets", "models", "lobby-furniture.glb"));
    expect(buffer.toString("ascii", 16, 20)).toBe("JSON");
    const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12))) as { nodes?: { name?: string }[] };
    const names = new Set((gltf.nodes ?? []).map((node) => node.name));
    expect(names.has(furnitureType("lamp").model.piece)).toBe(true);
    for (const name of ["desk", "chair", "bookcase", "wardrobe", "rug", "board", "window", "windowView"]) expect(names.has(name)).toBe(true);
  });
});

// ---------- 2. 처음 배치 ----------

describe("[spec] 066-④ 명세 4: 처음 배치", () => {
  test("D1 DEFAULT_LOBBY_LAYOUT은 N0이다: 스탠드는 정확히 { id: lamp, type: lamp, on: { parent: desk, slot: 0, facing: 0 } }, 나머지 여섯은 그대로, 보관함 없음", () => {
    expect(sortedById(DEFAULT_LOBBY_LAYOUT.items)).toEqual(sortedById(N0().items));
    expect(itemOf(DEFAULT_LOBBY_LAYOUT, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
    expect(storedOf(DEFAULT_LOBBY_LAYOUT)).toEqual([]);
  });

  test("D2 처음 배치를 본문으로 만들어 JSON 왕복해 다시 읽으면 N0이다", () => {
    const again = parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(DEFAULT_LOBBY_LAYOUT))));
    expect(again).not.toBeNull();
    expect(sortedById(again!.items)).toEqual(sortedById(N0().items));
  });

  test("D3 처음 배치는 놓을 수 있는 배치다", () => {
    expect(isPlaceableLayout(DEFAULT_LOBBY_LAYOUT)).toBe(true);
  });

  test("D4 처음 배치의 3D 목록에 스탠드가 하나 (0.5, 1.292, 5.5) rotY 0에 있고, 나머지는 P0의 3D 목록과 같다", () => {
    expect(FURNITURE_LAYOUT.filter((p) => p.item === "lamp")).toHaveLength(1);
    expectPose(DEFAULT_LOBBY_LAYOUT, "lamp", { x: 0.5, y: TOP, z: 5.5, rotY: 0 });
    expect(FURNITURE_LAYOUT.filter((p) => p.item !== "lamp")).toEqual(furniturePlacements(P0()));
  });

  test("D10 L2(0, 1)에서 '처음 배치로' → 방은 N0, 처음 배치에 없는 lamp2는 보관함에 { id: lamp2, type: lamp }로 든다", () => {
    const editor = new LobbyEditor(L2(0, 1));
    editor.resetToDefault();
    expect(sortedById(editor.layout.items)).toEqual(sortedById(N0().items));
    expect(storedOf(editor.layout)).toEqual([{ id: "lamp2", type: "lamp" }]);
  });
});

// ---------- 4. 3D 자리와 받침 가구 ----------

describe("[spec] 066-④ 명세 1·3·5: 스탠드의 3D 자리", () => {
  test.each([0, 1, 2])("G1 책상 자리 %i의 스탠드는 그 칸 가운데, 높이 1.292, rotY 0이다", (slot) => {
    expectPose(L(slot), "lamp", { x: SLOT[slot].x, y: TOP, z: SLOT[slot].z, rotY: 0 });
  });

  test.each([1, 2, 3] as Facing[])("G2 방향 %i의 스탠드는 자리 0 그대로이고 rotY가 그 방향이다", (facing) => {
    expectPose(L(0, facing), "lamp", { x: 0.5, y: TOP, z: 5.5, rotY: ROT[facing] });
  });

  test("G3 책상을 facing 2로 돌리면 자리 0 → (2.5, 5.5), 1 → (1.5, 5.5), 2 → (0.5, 5.5)이고 스탠드 rotY는 π다", () => {
    const want = [2.5, 1.5, 0.5];
    for (const slot of [0, 1, 2]) expectPose(withDesk(L(slot), { x: 1.5, z: 5.5, facing: 2 }), "lamp", { x: want[slot], y: TOP, z: 5.5, rotY: Math.PI });
  });

  test("G4 책상 (4.5, 5.5, facing 1)이면 자리 0 → (4.5, 6.5), 1 → (4.5, 5.5), 2 → (4.5, 4.5)이고 스탠드 rotY는 π/2다", () => {
    const want = [6.5, 5.5, 4.5];
    for (const slot of [0, 1, 2]) expectPose(withDesk(L(slot), { x: 4.5, z: 5.5, facing: 1 }), "lamp", { x: 4.5, y: TOP, z: want[slot], rotY: Math.PI / 2 });
  });

  test("G5 책상 (4.5, 5.5, facing 3)이면 자리 0 → (4.5, 4.5), 2 → (4.5, 6.5)이고 스탠드 rotY는 -π/2다", () => {
    expectPose(withDesk(L(0), { x: 4.5, z: 5.5, facing: 3 }), "lamp", { x: 4.5, y: TOP, z: 4.5, rotY: -Math.PI / 2 });
    expectPose(withDesk(L(2), { x: 4.5, z: 5.5, facing: 3 }), "lamp", { x: 4.5, y: TOP, z: 6.5, rotY: -Math.PI / 2 });
  });

  test("G6 책상 facing 1에 스탠드 facing 3이면 스탠드 rotY는 0이다", () => {
    expectPose(withDesk(L(0, 3), { x: 4.5, z: 5.5, facing: 1 }), "lamp", { x: 4.5, y: TOP, z: 6.5, rotY: 0 });
  });

  test("G7 스탠드는 길을 막지 않는다: N0과 P0의 막힌 칸·장소·의자가 같다", () => {
    const withLamp = layoutGeometry(N0(), 8);
    const without = layoutGeometry(P0(), 8);
    expect([...withLamp.solidTiles].sort()).toEqual([...without.solidTiles].sort());
    expect(withLamp.places).toEqual(without.places);
    expect(withLamp.chair).toEqual(without.chair);
  });

  test("G8 스탠드가 책상 자리 0·1·2 어디에 있든, 셋 모두 있든 놓을 수 있는 배치다", () => {
    for (const slot of [0, 1, 2]) expect(isPlaceableLayout(L(slot))).toBe(true);
    expect(isPlaceableLayout(layoutOf([...p0Items(), lampItem("lamp", 0), lampItem("lamp2", 1), lampItem("lamp3", 2)]))).toBe(true);
  });

  test("G9 두 스탠드가 같은 자리 1에 있으면 놓을 수 없는 배치다", () => {
    expect(isPlaceableLayout(L2(1, 1))).toBe(false);
  });

  test("G10 스탠드는 길을 막는 가구(blocker)가 아니다", () => {
    expect(placementOf(N0(), "lamp").blocker ?? false).toBe(false);
  });
});

// ---------- 5·6. 고르기·돌리기·치우기 ----------

describe("[spec] 066-④ 명세 6: 고르기·돌리기·치우기", () => {
  test("B5 스탠드를 톡하면 골라지고, 돌리기·치우기를 띄울 가구가 스탠드다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    expect(editor.selected).toBe("lamp");
    expect(editor.handle).toBe("lamp");
    expect(editor.storable).toBe("lamp");
  });

  // 075 고칠 기존 테스트: 옛 B6 "책상이 골라진다"를 새 동작(스탠드가 가장 가까운 자리 2로 옮겨 가고 골라진 채)으로 고쳤다
  test("B6 [075 바뀔] 스탠드를 고른 뒤 책상(2.5, 5.5)을 톡하면 오류 없이 스탠드가 가장 가까운 자리 2로 옮겨 가고, 책상은 골라지지 않으며 스탠드가 골라진 채다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    expect(() => tap(editor, { x: 2.5, z: 5.5 }, "desk")).not.toThrow();
    expect(itemOf(editor.layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 2, facing: 0 } });
    expect(editor.selected).toBe("lamp");
  });

  // 075 고칠 기존 테스트: 옛 B7 "고르기가 풀린다"를 새 동작(가장 가까운 자리 2로 옮겨 가고 골라진 채)으로 고쳤다
  test("B7 [075 바뀔] 스탠드를 고른 뒤 빈 바닥 (5.5, 9.5)를 톡하면 오류 없이 가장 가까운 책상 자리 2로 옮겨 가고 골라진 채다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    expect(() => tap(editor, { x: 5.5, z: 9.5 }, null)).not.toThrow();
    expect(itemOf(editor.layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 2, facing: 0 } });
    expect(editor.selected).toBe("lamp");
  });

  // 075 고칠 기존 테스트: 옛 B8 "스탠드가 골라진다"를 새 동작(책상을 칸 맞춤 (0.5, 5.5)로 옮기면 방 밖이라 옮기지 않고 안내, 책상이 골라진 채)으로 고쳤다
  test("B8 [075 바뀔] 책상을 고른 뒤 스탠드(0.5, 5.5)를 톡하면 스탠드는 골라지지 않고, 책상은 방 밖이 되어 옮기지 않으며 알림이 있고 골라진 채다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, { x: 1.5, z: 5.5 }, "desk");
    expect(editor.selected).toBe("desk");
    const notice = tap(editor, SLOT[0], "lamp");
    expect(notice).not.toBeNull();
    expect(editor.selected).toBe("desk");
    expect(sortedById(editor.layout.items)).toEqual(sortedById(N0().items));
  });

  test("B9 고른 스탠드를 다시 톡하면 고르기가 풀린다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    tap(editor, SLOT[0], "lamp");
    expect(editor.selected).toBeNull();
  });

  test("R1 스탠드를 골라 한 번 돌리면 on이 { desk, 0, 1 }이고 빨간 가구가 없으며 바뀐 것이 있고, 3D rotY가 π/2다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    editor.rotate();
    expect(itemOf(editor.layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 1 } });
    expect(editor.red).toBeNull();
    expect(editor.changed).toBe(true);
    expectPose(editor.layout, "lamp", { x: 0.5, y: TOP, z: 5.5, rotY: Math.PI / 2 });
  });

  test("R2 이어 세 번 더 돌리면 facing이 2 → 3 → 0이고 parent·slot은 그대로이며, 네 번 뒤에는 바뀐 것이 없다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    editor.rotate();
    for (const facing of [2, 3, 0]) {
      editor.rotate();
      expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 0, facing });
    }
    expect(editor.changed).toBe(false);
  });

  test("R3 스탠드를 골라 치우면 방에 없고 보관함이 [{ id: lamp, type: lamp }](on 없음)이며 고르기가 풀린다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    editor.store();
    expect(itemOf(editor.layout, "lamp")).toBeUndefined();
    expect(storedOf(editor.layout)).toEqual([{ id: "lamp", type: "lamp" }]);
    expect(editor.selected).toBeNull();
  });
});

// ---------- 7. 끌기와 자리 표시 ----------

describe("[spec] 066-④ 명세 6(결정 1): 끌기와 자리 표시", () => {
  test("M1 스탠드를 (0.5, 5.5)에서 (2.5, 5.5)로 끌어 놓으면 on이 { desk, 2, 0 }이고 floor·wall이 없으며 안내·빨간 가구가 없다", () => {
    const editor = new LobbyEditor(N0());
    const notice = drag(editor, "lamp", SLOT[0], { x: 2.5, z: 5.5 });
    expect(notice).toBeNull();
    expect(itemOf(editor.layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 2, facing: 0 } });
    expect(editor.red).toBeNull();
    expect(editor.selected).toBe("lamp");
    expect(editor.changed).toBe(true);
  });

  test("M2 (1.5, 5.5)로 끌면 자리 1이다", () => {
    const editor = new LobbyEditor(N0());
    drag(editor, "lamp", SLOT[0], { x: 1.5, z: 5.5 });
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 1, facing: 0 });
  });

  test("M3 바닥 (6.5, 9.5)까지 끌면 가장 가까운 자리 2에 남고 바닥에 놓이지 않는다", () => {
    const editor = new LobbyEditor(N0());
    const notice = drag(editor, "lamp", SLOT[0], { x: 6.5, z: 9.5 });
    expect(notice).toBeNull();
    expect(itemOf(editor.layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 2, facing: 0 } });
    expect(editor.red).toBeNull();
  });

  test("M4 책상 뒤쪽 바닥 (0.4, 2.0)까지 끌면 자리 0 그대로이고 안내가 없다", () => {
    const editor = new LobbyEditor(N0());
    const notice = drag(editor, "lamp", SLOT[0], { x: 0.4, z: 2.0 });
    expect(notice).toBeNull();
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
  });

  test("M5 끄는 도중(떼기 전)에 편집 중 배치와 3D 목록에서 스탠드가 자리 2에 있다", () => {
    const editor = new LobbyEditor(N0());
    pressAndMove(editor, "lamp", SLOT[0], { x: 2.5, z: 5.5 });
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 2, facing: 0 });
    const p = placementOf(editor.layout, "lamp");
    expect({ x: p.x, z: p.z }).toEqual({ x: expect.closeTo(2.5, 6), z: expect.closeTo(5.5, 6) });
    editor.pointerUp();
  });

  test("M6(결정 1) L2(0, 1)에서 lamp를 lamp2가 있는 (1.5, 5.5)로 끌어 놓으면 끌기 전 자리 0으로 돌아가고 cannot-place이며 빨간 가구가 되지 않는다", () => {
    const editor = new LobbyEditor(L2(0, 1));
    const notice = drag(editor, "lamp", SLOT[0], { x: 1.5, z: 5.5 });
    expect(notice).toBe("cannot-place");
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
    expect(editor.red).toBeNull();
    expect(editor.canFinish).toBe(true);
    expect(editor.changed).toBe(false);
  });

  test("M10(결정 4) 두 책상 배치에서 스탠드를 둘째 책상 desk2의 자리 1 (4.5, 9.5)로 끌면 on이 { desk2, 1, 0 }이고 3D가 (4.5, 1.292, 9.5)다", () => {
    const base = layoutOf([...p0Items(), { id: "desk2", type: "desk", floor: { x: 4.5, z: 9.5, facing: 0 } } as LayoutItem, lampItem("lamp", 0)]);
    // 전제: 이 두 책상 배치가 놓을 수 있는 배치다(아니면 손을 뗄 때 돌아가 따라가기가 아닌 이유로 실패한다)
    expect(isPlaceableLayout(base)).toBe(true);
    const editor = new LobbyEditor(base);
    const notice = drag(editor, "lamp", SLOT[0], { x: 4.5, z: 9.5 });
    expect(notice).toBeNull();
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk2", slot: 1, facing: 0 });
    expectPose(editor.layout, "lamp", { x: 4.5, y: TOP, z: 9.5, rotY: 0 });
  });

  test("M11(결정 1) L2(0, 2)에서 lamp2를 lamp가 있는 (0.5, 5.5)로 끌면 스탠드 위가 아니라 책상 자리 0이 차 있어 끌기 전 자리 2로 돌아가고 cannot-place다", () => {
    const editor = new LobbyEditor(L2(0, 2));
    pressAndMove(editor, "lamp2", SLOT[2], SLOT[0]);
    // 끄는 동안 lamp2는 책상 자리 0으로 간다(parent는 lamp가 아니라 desk)
    expect(itemOf(editor.layout, "lamp2")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
    const notice = editor.pointerUp();
    expect(notice).toBe("cannot-place");
    expect(itemOf(editor.layout, "lamp2")!.on).toEqual({ parent: "desk", slot: 2, facing: 0 });
    expect(editor.red).toBeNull();
  });

  test("K1 스탠드를 고르면 책상 윗면의 그 칸(x 0..1, z 5..6, 높이 1.292)에 초록 표시 하나가 있다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, SLOT[0], "lamp");
    const marks = editor.marks();
    expect(marks).toHaveLength(1);
    expect(marks[0]).toEqual(expect.objectContaining({ piece: "lamp", ok: true }));
    expect(marks[0].minX).toBeCloseTo(0, 6);
    expect(marks[0].maxX).toBeCloseTo(1, 6);
    expect(marks[0].minZ).toBeCloseTo(5, 6);
    expect(marks[0].maxZ).toBeCloseTo(6, 6);
    expect(marks[0].y).toBeCloseTo(TOP, 6);
  });

  test("K2 L2(0, 1)에서 lamp를 (1.5, 5.5) 위로 끈 채(떼기 전) 그 칸(x 1..2, z 5..6, 책상 윗면)이 빨강이다", () => {
    const editor = new LobbyEditor(L2(0, 1));
    pressAndMove(editor, "lamp", SLOT[0], { x: 1.5, z: 5.5 });
    const mark = editor.marks().find((m) => m.piece === "lamp");
    expect(mark).toBeDefined();
    expect(mark!.ok).toBe(false);
    expect([mark!.minX, mark!.maxX, mark!.minZ, mark!.maxZ].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1, 2, 5, 6]);
    expect(mark!.y).toBeCloseTo(TOP, 6);
    editor.pointerUp();
  });

  test("K4 책상을 고르면 지금처럼 책상의 바닥 칸(x 0..3, z 5..6)에 초록 표시이고 장소 구역은 책상이다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, { x: 1.5, z: 5.5 }, "desk");
    expect(editor.marks()).toEqual([{ piece: "desk", minX: 0, maxX: 3, minZ: 5, maxZ: 6, ok: true }]);
    expect(editor.zone()?.place).toBe("desk");
  });
});

// ---------- 8. 받침 가구를 옮기고 돌릴 때 ----------

describe("[spec] 066-④ 명세 3·5: 책상을 옮기고 돌리면 스탠드가 따라간다", () => {
  test("F1 책상을 (1.5, 6.5)로 끌어 놓으면 스탠드 저장값은 그대로이고 3D는 (0.5, 1.292, 6.5)다", () => {
    const editor = new LobbyEditor(N0());
    const notice = drag(editor, "desk", { x: 1.5, z: 5.5 }, { x: 1.5, z: 6.5 });
    expect(notice).toBeNull();
    expect(itemOf(editor.layout, "desk")!.floor).toEqual({ x: 1.5, z: 6.5, facing: 0 });
    expect(itemOf(editor.layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
    expectPose(editor.layout, "lamp", { x: 0.5, y: TOP, z: 6.5, rotY: 0 });
  });

  test("F3 책상을 돌리면(빨간지와 관계없이) 스탠드 3D가 (1.5, 1.292, 6.5) rotY π/2이고 저장값은 그대로다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, { x: 1.5, z: 5.5 }, "desk");
    editor.rotate();
    expect(itemOf(editor.layout, "desk")!.floor).toEqual({ x: 1.5, z: 5.5, facing: 1 });
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
    expectPose(editor.layout, "lamp", { x: 1.5, y: TOP, z: 6.5, rotY: Math.PI / 2 });
  });

  test("F4 책상을 책장 칸을 덮는 (1.5, 2.5)로 끌어 놓으면 책상이 돌아가고 스탠드 3D도 (0.5, 1.292, 5.5)로 돌아간다", () => {
    const editor = new LobbyEditor(N0());
    pressAndMove(editor, "desk", { x: 1.5, z: 5.5 }, { x: 1.5, z: 2.5 });
    expectPose(editor.layout, "lamp", { x: 0.5, y: TOP, z: 2.5, rotY: 0 });
    const notice = editor.pointerUp();
    expect(notice).toBe("cannot-place");
    expect(itemOf(editor.layout, "desk")!.floor).toEqual({ x: 1.5, z: 5.5, facing: 0 });
    expectPose(editor.layout, "lamp", { x: 0.5, y: TOP, z: 5.5, rotY: 0 });
  });
});

// ---------- 9. 보관함에서 꺼내기 ----------

describe("[spec] 066-④ 명세 7(결정 3·4): 보관함에서 꺼내기", () => {
  test("T1 P0 + 보관함 스탠드: 꺼내면 책상 자리 0, 방향 0이고 골라지며 보관함이 빈다", () => {
    const editor = new LobbyEditor(layoutOf(p0Items(), [{ id: "lamp", type: "lamp" }]));
    expect(editor.takeOut("lamp")).toBeNull();
    expect(itemOf(editor.layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
    expect(storedOf(editor.layout)).toEqual([]);
    expect(editor.selected).toBe("lamp");
  });

  test("T2 자리 0에 스탠드가 있으면 꺼낸 lamp2는 자리 1이다", () => {
    const editor = new LobbyEditor(layoutOf([...p0Items(), lampItem("lamp", 0)], [{ id: "lamp2", type: "lamp" }]));
    expect(editor.takeOut("lamp")).toBeNull();
    expect(itemOf(editor.layout, "lamp2")!.on).toEqual({ parent: "desk", slot: 1, facing: 0 });
  });

  test("T3 자리 1에만 스탠드가 있으면 꺼낸 lamp2는 자리 0이다", () => {
    const editor = new LobbyEditor(layoutOf([...p0Items(), lampItem("lamp", 1)], [{ id: "lamp2", type: "lamp" }]));
    expect(editor.takeOut("lamp")).toBeNull();
    expect(itemOf(editor.layout, "lamp2")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
  });

  test("T4 자리 셋이 모두 차 있으면 꺼내지 않고 no-room이며 방·보관함이 그대로다", () => {
    const start = layoutOf([...p0Items(), lampItem("lamp", 0), lampItem("lamp2", 1), lampItem("lamp3", 2)], [{ id: "lamp4", type: "lamp" }]);
    const editor = new LobbyEditor(start);
    expect(editor.takeOut("lamp")).toBe("no-room");
    expect(sortedById(editor.layout.items)).toEqual(sortedById(start.items));
    expect(storedOf(editor.layout)).toEqual([{ id: "lamp4", type: "lamp" }]);
  });

  test("T5 빨간 가구가 있으면 꺼내지 않고 red-first이며 방·보관함이 그대로다(빨간 가구: (1.5, 3.5)의 책상을 돌려 책장 서는 자리를 막는다)", () => {
    // 빨간 가구는 지금 규칙(돌려서 놓을 수 없는 모양)으로 만든다. 3×1 책상만 돌리면 칸 모양이 바뀐다
    const start = withDesk(layoutOf([...p0Items(), lampItem("lamp", 0)], [{ id: "lamp3", type: "lamp" }]), { x: 1.5, z: 3.5, facing: 0 });
    expect(isPlaceableLayout(start)).toBe(true);
    const editor = new LobbyEditor(start);
    tap(editor, { x: 1.5, z: 3.5 }, "desk");
    editor.rotate();
    expect(editor.red).toBe("desk");
    const before = JSON.parse(JSON.stringify(editor.layout)) as LobbyLayout;
    expect(editor.takeOut("lamp")).toBe("red-first");
    expect(editor.layout).toEqual(before);
    expect(storedOf(editor.layout)).toEqual([{ id: "lamp3", type: "lamp" }]);
  });

  test("T6(결정 4) 두 책상 배치(desk가 desk2보다 앞)에서 desk 자리가 모두 차 있으면 꺼낸 lamp9는 desk2 자리 0이다", () => {
    const items = [
      ...p0Items(),
      { id: "desk2", type: "desk", floor: { x: 4.5, z: 9.5, facing: 0 } } as LayoutItem,
      lampItem("lamp", 0),
      lampItem("lamp2", 1),
      lampItem("lamp3", 2)
    ];
    const editor = new LobbyEditor(layoutOf(items, [{ id: "lamp9", type: "lamp" }]));
    expect(editor.takeOut("lamp")).toBeNull();
    expect(itemOf(editor.layout, "lamp9")!.on).toEqual({ parent: "desk2", slot: 0, facing: 0 });
  });
});

// ---------- 10. 바뀐 것 알기 ----------

describe("[spec] 066-④ 명세 6: 바뀐 것 알기", () => {
  test("S2 스탠드를 자리 2로 끌었다가 다시 자리 0으로 끌면 바뀐 것이 없다", () => {
    const editor = new LobbyEditor(N0());
    drag(editor, "lamp", SLOT[0], { x: 2.5, z: 5.5 });
    expect(editor.changed).toBe(true);
    drag(editor, "lamp", SLOT[2], SLOT[0]);
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
    expect(editor.changed).toBe(false);
  });
});
