// [spec] qa 테스트(작업 066-⑤ 새 가구, 새 기능, 모바일): 카탈로그, 저장 본문 검사, 놓을 수 있는 배치(액자 아래 규칙),
// 편집기의 가구 더하기·새 id, 받침 가구가 여럿일 때 끌기·꺼내기, 받침 가구를 치울 때 소품, 3D 목록, 그대로여야 할 동작을
// 편집기와 배치 계산 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 066/06-새-가구/03-qa-scenarios.md의 A·V·W·N·I·M·S·G2·K)에서만 가져온다.
// 같은 폴더 04-main-decision.md의 결정 3(가구 더하기는 LobbyEditor.addNew(type), 한도 안내는 "limit")은 부르는 방법으로만 쓴다.
// 부르는 방법은 구현(24995ee)에서 이름만 읽었다: addNew, store, takeOut, rotate, resetToDefault, pointerDown·Move·Up, marks, wallMarks,
// selected, handle, storable, red, layout, 카탈로그의 model.piece·box·y·shadow·surface, furniturePlacements, layoutGeometry, tabletopPose.
// 시나리오 0절 약속: 표의 크기·높이는 소수 둘째 자리까지 같으면 맞다(toBeCloseTo(v, 2)).
// 같은 폴더 08-main-decision.md(사용자 결정 2026-11-10): 명세 1 표의 "모델" 칸은 출처(Kenney 원본 이름)와 대략의 크기로 읽는다.
// 모델 이름은 가구 묶음 안의 이름(bed, nightstand, floorLamp, plant, smallPlant, booksStack, frame)이고, 모델 크기는 묶음에서 잰 값이다.
// 그래서 A7a는 결정의 이름을, A7b·A9(협탁·바닥 스탠드·화분)는 이 테스트가 lobby-furniture.glb에서 직접 잰 크기를 기대값으로 쓴다.
import { readFileSync } from "fs";
import { join } from "path";
import { MARKS, TAP_MAX_MOVE_PX, findPath, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES, REQUIRED_FURNITURE_TYPES, findFurnitureType, fittedModel, furnitureType, surfaceSlots } from "@/lib/lobby3d/furniture-catalog";
import { furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { LobbyEditor, isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, makeLayout, tabletopPose, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type LayoutItem = LobbyLayout["items"][number];
type Stored = { id: string; type: string };
type Facing = 0 | 1 | 2 | 3;
type Side = "back" | "left" | "right";

const DESK_TOP = 1.292;
const NS_TOP = 0.74;

const floor = (id: string, type: string, x: number, z: number, facing: Facing = 0): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: Side, along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });
const on = (id: string, type: string, parent: string, slot: number, facing: Facing = 0): LayoutItem => ({ id, type, on: { parent, slot, facing } }) as LayoutItem;

/** 시나리오 0절의 N0(처음 배치). */
function n0Items(): LayoutItem[] {
  return [
    floor("desk", "desk", 1.5, 5.5, 0),
    floor("bookcase", "bookcase", 0.5, 2.5, 1),
    floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
    floor("rug", "rug", 4.6, 7.2, 0),
    wall("board", "board", "back", 1.8),
    wall("window", "window", "back", 4.8),
    on("lamp", "lamp", "desk", 0, 0)
  ];
}
const n0NoLamp = () => n0Items().filter((item) => item.id !== "lamp");

function layoutOf(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(items, stored))) as LobbyLayout;
}

const N0 = () => layoutOf(n0Items());
const NS1 = () => floor("nightstand-1", "nightstand", 3.5, 5.5, 0);
/** L-N1: N0 + 협탁 nightstand-1 (3.5, 5.5, 0)(items 맨 뒤). */
const LN1 = (stored: Stored[] = []) => layoutOf([...n0Items(), NS1()], stored);
/** L-NS: L-N1 + 작은 화분 {nightstand-1, 0, 0}, 보관함 [wardrobe-1]. */
const LNS = () => layoutOf([...n0Items(), NS1(), on("smallPlant-1", "smallPlant", "nightstand-1", 0)], [{ id: "wardrobe-1", type: "wardrobe" }]);
/** L-F: N0 + 액자 frame-1 {left, 7.5}. */
const LF = (extra: LayoutItem[] = []) => layoutOf([...n0Items(), wall("frame-1", "frame", "left", 7.5), ...extra]);

/** V-ALL: N0 + 새 일곱 종. */
function vAllItems(): LayoutItem[] {
  return [
    ...n0Items(),
    floor("bed-1", "bed", 4, 5.5, 0),
    floor("nightstand-1", "nightstand", 6.5, 9.5, 0),
    floor("floorLamp-1", "floorLamp", 5.5, 9.5, 0),
    floor("plant-1", "plant", 7.5, 9.5, 0),
    wall("frame-1", "frame", "left", 7.5),
    on("smallPlant-1", "smallPlant", "nightstand-1", 0),
    on("books-1", "books", "desk", 1)
  ];
}
const V_ALL = () => layoutOf(vAllItems());

function payload(items: LayoutItem[], stored?: Stored[]): unknown {
  return JSON.parse(JSON.stringify(stored ? { version: 2, items, stored } : { version: 2, items }));
}

function byId<T extends { id: string }>(list: readonly T[] | undefined): T[] {
  return [...(list ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function itemOf(layout: LobbyLayout, id: string) {
  return layout.items.find((item) => item.id === id);
}

function storedOf(layout: LobbyLayout): Stored[] {
  return ((layout as { stored?: Stored[] }).stored ?? []).map((s) => ({ id: s.id, type: s.type }));
}

function placementOf(layout: LobbyLayout, id: string) {
  const found = furniturePlacements(layout).filter((p) => p.item === id && !p.companion);
  expect(found).toHaveLength(1);
  return found[0];
}

function expectAt(layout: LobbyLayout, id: string, want: { x: number; y: number; z: number }) {
  const p = placementOf(layout, id);
  expect(p.x).toBeCloseTo(want.x, 6);
  expect(p.y).toBeCloseTo(want.y, 6);
  expect(p.z).toBeCloseTo(want.z, 6);
}

function hit(point: FloorPoint | null, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

function wallHit(piece: string | null, side: Side, along: number): PointerHit {
  return { point: null, mark: null, onCharacter: false, piece, wall: { wall: side, along } };
}

function tap(editor: LobbyEditor, point: FloorPoint | null, piece: string | null) {
  editor.pointerDown(hit(point, piece), 200, 300);
  return editor.pointerUp();
}

function drag(editor: LobbyEditor, piece: string, from: FloorPoint, to: FloorPoint) {
  editor.pointerDown(hit(from, piece), 200, 300);
  editor.pointerMove(hit(to, null), 200 + TAP_MAX_MOVE_PX + 50, 300 + TAP_MAX_MOVE_PX + 50);
  return editor.pointerUp();
}

function dragWall(editor: LobbyEditor, piece: string, side: Side, from: number, to: number) {
  editor.pointerDown(wallHit(piece, side, from), 200, 300);
  editor.pointerMove(wallHit(null, side, to), 200 + TAP_MAX_MOVE_PX + 50, 300 + TAP_MAX_MOVE_PX + 50);
  return editor.pointerUp();
}

const NEW_IDS = ["bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame"];

type GltfNode = { name?: string; mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] };
type Gltf = { nodes?: GltfNode[]; meshes?: { primitives: { attributes: { POSITION: number } }[] }[]; accessors?: { min?: number[]; max?: number[] }[] };

// 090-② 05 결정 3(사용자 2026-11-13 "qa가 새 동작에 맞게 고침"): 가구 묶음(lobby-furniture.glb) 대신 가구마다 모델 파일이다.
// 처음 방 일곱은 앱에 든 파일(assets/models/furniture/<id>.glb), 일곱 밖 가구는 앱이 받는 서버 파일(백엔드 catalog/files/<id>.glb)을 읽는다.
// 읽는 파일만 바꿨고, 잰 크기와 견주는 단언은 그대로다.
const APP_FURNITURE_FILES = ["desk", "bookcase", "board", "window", "wardrobe", "rug", "lamp"];

function furnitureModelPath(id: string): string {
  return APP_FURNITURE_FILES.includes(id)
    ? join(__dirname, "..", "..", "assets", "models", "furniture", `${id}.glb`)
    : join(__dirname, "..", "..", "..", "backend", "src", "main", "resources", "catalog", "files", `${id}.glb`);
}

function readGlbJson(path: string): Gltf {
  const buffer = readFileSync(path);
  expect(buffer.toString("ascii", 16, 20)).toBe("JSON");
  return JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12))) as Gltf;
}

/** 그 가구의 모델 파일. */
function readFurnitureGltf(id: string): Gltf {
  return readGlbJson(furnitureModelPath(id));
}

/** 열 우선 4×4 행렬 곱 a·b. */
function mul(a: number[], b: number[]): number[] {
  const r = new Array<number>(16).fill(0);
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) for (let k = 0; k < 4; k += 1) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return r;
}

function localMatrix(node: GltfNode): number[] {
  if (node.matrix) return node.matrix;
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1
  ];
}

/**
 * 가구 묶음 안 그 이름의 노드(자식 포함)를 둘러싼 상자의 가로(x)·높이(y)·깊이(z). 노드 자신의 변환은 빼고(앱이 자리를 정한다) 자식의 변환은 넣는다.
 * 정점 대신 접근자의 min·max 모서리를 변환해 잰다(회전이 없거나 90도 단위면 정확하다).
 */
function measuredModel(gltf: Gltf, name: string): { width: number; height: number; depth: number } {
  const nodes = gltf.nodes ?? [];
  const index = nodes.findIndex((node) => node.name === name);
  expect(`${name}:${index >= 0}`).toBe(`${name}:true`);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const visit = (i: number, parent: number[] | null) => {
    const node = nodes[i];
    const m = parent ? mul(parent, localMatrix(node)) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes![node.mesh].primitives) {
        const accessor = gltf.accessors![primitive.attributes.POSITION];
        for (const x of [accessor.min![0], accessor.max![0]]) {
          for (const y of [accessor.min![1], accessor.max![1]]) {
            for (const z of [accessor.min![2], accessor.max![2]]) {
              for (let k = 0; k < 3; k += 1) {
                const v = m[k] * x + m[4 + k] * y + m[8 + k] * z + m[12 + k];
                min[k] = Math.min(min[k], v);
                max[k] = Math.max(max[k], v);
              }
            }
          }
        }
      }
    }
    for (const child of node.children ?? []) visit(child, m);
  };
  visit(index, null);
  return { width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2] };
}
const SLOT0 = { x: 0.5, z: 5.5 };
const NS_AT = { x: 3.5, z: 5.5 };

// ---------- A. 카탈로그 ----------

describe("[spec] 066-⑤ 명세 1: 카탈로그(A)", () => {
  test("A1 일곱 종류가 있고 이름이 침대·협탁·바닥 스탠드·화분·작은 화분·책·액자다", () => {
    const names = NEW_IDS.map((id) => findFurnitureType(id)?.name);
    expect(names).toEqual(["침대", "협탁", "바닥 스탠드", "화분", "작은 화분", "책", "액자"]);
  });

  test("A2 bed·nightstand·floorLamp·plant는 바닥, smallPlant·books는 탁상, frame은 벽이다", () => {
    expect(NEW_IDS.map((id) => furnitureType(id).mount)).toEqual(["floor", "floor", "floor", "floor", "tabletop", "tabletop", "wall"]);
  });

  test("A3 칸: bed 2×3, nightstand·floorLamp·plant·smallPlant·books 1×1, frame 폭 1", () => {
    expect(furnitureType("bed").size).toEqual({ width: 2, depth: 3 });
    for (const id of ["nightstand", "floorLamp", "plant", "smallPlant", "books"]) expect(furnitureType(id).size).toEqual({ width: 1, depth: 1 });
    expect(furnitureType("frame").size.width).toBe(1);
  });

  test("A4 높이: 바닥에서 1.05·0.74·2.41·1.83, 받침 윗면에서 0.41·0.29, 액자는 1.6~2.4", () => {
    const want: [string, number, number][] = [
      ["bed", 0, 1.05],
      ["nightstand", 0, 0.74],
      ["floorLamp", 0, 2.41],
      ["plant", 0, 1.83],
      ["smallPlant", 0, 0.41],
      ["books", 0, 0.29],
      ["frame", 1.6, 2.4]
    ];
    for (const [id, bottom, top] of want) {
      expect(furnitureType(id).height.bottom).toBeCloseTo(bottom, 2);
      expect(furnitureType(id).height.top).toBeCloseTo(top, 2);
    }
  });

  test("A5 bed·nightstand·floorLamp·plant는 길을 막는다", () => {
    for (const id of ["bed", "nightstand", "floorLamp", "plant"]) expect(furnitureType(id).blocksWalk).toBe(true);
  });

  test("A6 일곱 종류 모두 치울 수 있고 장소·딸린 의자가 없다", () => {
    for (const id of NEW_IDS) {
      expect(furnitureType(id).removable).toBe(true);
      expect(furnitureType(id).place).toBeUndefined();
      expect(furnitureType(id).chair).toBeUndefined();
    }
  });

  // 08 결정으로 기대값을 Kenney 원본 이름(bedSingle 등)에서 가구 묶음 안의 이름으로 바꿨다. 액자 이름도 결정에 있어 더했다
  test("A7a 모델 이름(가구 묶음 안의 이름): bed, nightstand, floorLamp, plant, smallPlant, booksStack, frame", () => {
    const want: Record<string, string> = {
      bed: "bed",
      nightstand: "nightstand",
      floorLamp: "floorLamp",
      plant: "plant",
      smallPlant: "smallPlant",
      books: "booksStack",
      frame: "frame"
    };
    expect(Object.fromEntries(Object.keys(want).map((id) => [id, furnitureType(id).model.piece]))).toEqual(want);
  });

  // 08 결정으로 기대값을 명세 표의 대략 크기에서 가구 묶음에서 잰 크기로 바꿨다(이 테스트가 glb에서 직접 잰다)
  test("A7b 모델 가로×깊이는 가구 묶음에서 잰 그 모델의 크기다(bed·nightstand·floorLamp·plant·smallPlant·books)", () => {
    const ids = ["bed", "nightstand", "floorLamp", "plant", "smallPlant", "books"];
    // 한 번에 모두 보이게 종류마다 맞는지(둘째 자리까지 같은지)를 모아 견준다
    const got = ids.map((id) => {
      const box = furnitureType(id).model.box;
      const measured = measuredModel(readFurnitureGltf(id), furnitureType(id).model.piece);
      return { id, width: Math.abs(box.width - measured.width) < 0.005, depth: Math.abs(box.depth - measured.depth) < 0.005 };
    });
    expect(got).toEqual(ids.map((id) => ({ id, width: true, depth: true })));
  });

  test("A8 협탁의 소품 자리는 하나이고 칸 가운데다. 윗면이 있는 종류는 책상과 협탁 둘뿐이다", () => {
    const slots = surfaceSlots(furnitureType("nightstand"));
    expect(slots).toHaveLength(1);
    expect(slots[0].x).toBeCloseTo(0, 6);
    expect(slots[0].z).toBeCloseTo(0, 6);
    expect(FURNITURE_TYPES.filter((type) => type.surface).map((type) => type.id).sort()).toEqual(["desk", "nightstand"]);
  });

  test("A9 bed: 깊이만 3/3.15로 줄이고 가로는 그대로(≈1.60), 칸 3에 맞고 놓는 자리 (0, 0)", () => {
    const fit = fittedModel(furnitureType("bed"));
    expect(fit.scale.x).toBe(1);
    expect(fit.scale.z).toBeCloseTo(3 / 3.15, 2);
    expect(fit.box.width).toBeCloseTo(1.6, 2);
    expect(fit.box.depth).toBeCloseTo(3, 2);
    expect(fit.drawAt.x).toBeCloseTo(0, 6);
    expect(fit.drawAt.z).toBeCloseTo(0, 2);
  });

  // 08 결정으로 기대 깊이를 명세 표 값(0.61·0.49·0.68)에서 가구 묶음에서 잰 깊이로 바꿨다. 규칙(뒷면을 칸 뒤 끝에)은 그대로다
  test("A9 nightstand·floorLamp·plant: 비율 (1, 1)이고 뒷면을 칸 뒤 끝에 붙인다(drawAt.z = −(1 − 잰 깊이)/2)", () => {
    const want: [string, number][] = ["nightstand", "floorLamp", "plant"].map((id) => [id, -(1 - measuredModel(readFurnitureGltf(id), furnitureType(id).model.piece).depth) / 2]);
    for (const [id] of want) {
      const fit = fittedModel(furnitureType(id));
      expect(fit.scale).toEqual({ x: 1, z: 1 });
      expect(fit.drawAt.x).toBeCloseTo(0, 6);
    }
    const got = want.map(([id, z]) => ({ id, z: Math.abs(fittedModel(furnitureType(id)).drawAt.z - z) < 0.005 }));
    expect(got).toEqual(want.map(([id]) => ({ id, z: true })));
  });

  test("A9 smallPlant·books: 비율 (1, 1), 놓는 자리 (0, 0). frame: 맞춘 가로가 1을 넘지 않는다", () => {
    for (const id of ["smallPlant", "books"]) {
      const fit = fittedModel(furnitureType(id));
      expect(fit.scale).toEqual({ x: 1, z: 1 });
      expect(fit.drawAt.x).toBeCloseTo(0, 6);
      expect(fit.drawAt.z).toBeCloseTo(0, 6);
    }
    expect(fittedModel(furnitureType("frame")).box.width).toBeLessThanOrEqual(1 + 1e-9);
  });

  test("A10 바닥 가구 넷은 바닥 그림자, 액자는 벽 그림자가 있다", () => {
    for (const id of ["bed", "nightstand", "floorLamp", "plant"]) expect(furnitureType(id).model.shadow?.floor).toBeDefined();
    expect(furnitureType("frame").model.shadow?.wall).toBeDefined();
  });

  test("A11 액자 모델은 1.6~2.4 높이에 걸린다(y ± 높이/2)", () => {
    const { y, box } = furnitureType("frame").model;
    expect(y - box.height / 2).toBeCloseTo(1.6, 2);
    expect(y + box.height / 2).toBeCloseTo(2.4, 2);
  });

  // 090-② 05 결정 3: 가구 묶음 대신 가구마다 파일이라, 그 노드를 그 가구의 파일에서 찾는다(책상 파일에 의자, 창문 파일에 창밖 판)
  test("A12 가구 묶음 glb에 일곱 종류의 모델 노드가 있고 기존 노드도 그대로 있다", () => {
    const namesIn = (id: string) => new Set((readFurnitureGltf(id).nodes ?? []).map((node) => node.name));
    for (const id of NEW_IDS) expect(`${id}:${namesIn(id).has(furnitureType(id).model.piece)}`).toBe(`${id}:true`);
    const existing: [string, string][] = [["desk", "desk"], ["desk", "chair"], ["bookcase", "bookcase"], ["wardrobe", "wardrobe"], ["rug", "rug"], ["lamp", "tableLamp"], ["board", "board"], ["window", "window"], ["window", "windowView"]];
    for (const [id, name] of existing) {
      expect(`${name}:${namesIn(id).has(name)}`).toBe(`${name}:true`);
    }
  });

  test("A13 장소 가구 목록은 그대로 {board, bookcase, desk, window}다", () => {
    expect([...REQUIRED_FURNITURE_TYPES].sort()).toEqual(["board", "bookcase", "desk", "window"]);
  });
});

// ---------- V. 저장 본문 검사 ----------

describe("[spec] 066-⑤ 명세 4: 저장 본문 검사(V)", () => {
  test("V1·V9 V-ALL을 받고 받은 items와 같은 배치다(보관함 없음)", () => {
    const parsed = parseLobbyLayoutPayload(payload(vAllItems()));
    expect(parsed).not.toBeNull();
    expect(byId(parsed!.items)).toEqual(byId(vAllItems()));
    expect(storedOf(parsed!)).toEqual([]);
  });

  test("V2 V-ALL을 본문으로 만들어 JSON 왕복해 다시 읽으면 같은 배치다", () => {
    const parsed = parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(V_ALL()))));
    expect(parsed).not.toBeNull();
    expect(byId(parsed!.items)).toEqual(byId(vAllItems()));
    expect(storedOf(parsed!)).toEqual([]);
  });

  test("V3 작은 화분이 협탁 자리 1에 있으면 거절한다(협탁은 자리 1개)", () => {
    const items = vAllItems().map((item) => (item.id === "smallPlant-1" ? on("smallPlant-1", "smallPlant", "nightstand-1", 1) : item));
    expect(parseLobbyLayoutPayload(payload(items))).toBeNull();
  });

  test("V4 협탁 자리 0에 소품이 둘이면 거절한다", () => {
    expect(parseLobbyLayoutPayload(payload([...vAllItems(), on("books-2", "books", "nightstand-1", 0)]))).toBeNull();
  });

  test("V5 협탁이 보관함에 있는데 그 위에 작은 화분이 있으면 거절한다", () => {
    const items = vAllItems().filter((item) => item.id !== "nightstand-1");
    expect(parseLobbyLayoutPayload(payload(items, [{ id: "nightstand-1", type: "nightstand" }]))).toBeNull();
  });

  test("V6 책을 침대에 올리면 거절한다(침대는 받침 가구가 아니다)", () => {
    const items = vAllItems().map((item) => (item.id === "books-1" ? on("books-1", "books", "bed-1", 0) : item));
    expect(parseLobbyLayoutPayload(payload(items))).toBeNull();
  });

  test("V7 유형에 맞지 않는 자리는 거절한다(액자에 floor, 침대에 wall, 작은 화분에 floor, 협탁에 on)", () => {
    const swap = (id: string, value: LayoutItem) => vAllItems().map((item) => (item.id === id ? value : item));
    expect(parseLobbyLayoutPayload(payload(swap("frame-1", floor("frame-1", "frame", 0.5, 7.5, 0))))).toBeNull();
    expect(parseLobbyLayoutPayload(payload(swap("bed-1", wall("bed-1", "bed", "left", 7.5))))).toBeNull();
    const items = vAllItems().filter((item) => item.id !== "smallPlant-1");
    expect(parseLobbyLayoutPayload(payload([...items, floor("smallPlant-1", "smallPlant", 2.5, 9.5, 0)]))).toBeNull();
    expect(
      parseLobbyLayoutPayload(payload([...vAllItems().filter((item) => item.id !== "smallPlant-1" && item.id !== "nightstand-1"), on("nightstand-1", "nightstand", "desk", 2)]))
    ).toBeNull();
  });

  test("V8 보관함에 일곱 종류가 하나씩 있으면 받고 보관함이 받은 그대로다", () => {
    const stored = NEW_IDS.map((type) => ({ id: `${type}-1`, type }));
    const parsed = parseLobbyLayoutPayload(payload(n0Items(), stored));
    expect(parsed).not.toBeNull();
    expect(storedOf(parsed!)).toEqual(stored);
  });

  test("V10 방과 보관함을 합쳐 40개(새 종류 포함)는 받고 41개는 거절한다", () => {
    const stored = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `${NEW_IDS[i % 7]}-${i + 1}`, type: NEW_IDS[i % 7] }));
    expect(parseLobbyLayoutPayload(payload(n0Items(), stored(33)))).not.toBeNull();
    expect(parseLobbyLayoutPayload(payload(n0Items(), stored(34)))).toBeNull();
  });

  // 작업 090-①(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/02-서버-아이템-목록/01-main-spec.md)의 "고칠 기존 테스트":
  // "모르는 종류 sofa는 거절한다(null)"를 새 동작(모르는 가구가 든 배치를 버리지 않고, 저장할 때 그대로 다시 보낸다)으로 고쳤다. 기대값은 그 명세에서만 가져왔다.
  test("V11(090) 모르는 종류 sofa가 방에 있어도 배치를 버리지 않고, 다시 본문으로 만들면 sofa-1이 받은 그대로다", () => {
    const items = [...n0Items(), floor("sofa-1", "sofa", 4.5, 9.5, 0)];
    const parsed = parseLobbyLayoutPayload(payload(items));

    expect(parsed).not.toBeNull();
    const sent = JSON.parse(JSON.stringify(toLobbyLayoutPayload(parsed!))) as { items: LayoutItem[] };
    expect(byId(sent.items)).toEqual(byId(JSON.parse(JSON.stringify(items)) as LayoutItem[]));
  });
});

// ---------- W. 놓을 수 있는 배치·벽 가구 아래 규칙 ----------

describe("[spec] 066-⑤ 명세 1: 놓을 수 있는 배치와 액자 아래 규칙(W)", () => {
  test("W1 L-F는 놓을 수 있다", () => {
    expect(isPlaceableLayout(LF())).toBe(true);
  });

  test("W2 액자 바로 아래 칸에 화분·바닥 스탠드·옷장·책장은 놓을 수 없다", () => {
    expect(isPlaceableLayout(LF([floor("plant-1", "plant", 0.5, 7.5, 0)]))).toBe(false);
    expect(isPlaceableLayout(LF([floor("floorLamp-1", "floorLamp", 0.5, 7.5, 0)]))).toBe(false);
    const moved = (id: string) =>
      layoutOf([...n0Items().map((item) => (item.id === id ? floor(id, id, 0.5, 7.5, 1) : item)), wall("frame-1", "frame", "left", 7.5)]);
    expect(isPlaceableLayout(moved("wardrobe"))).toBe(false);
    expect(isPlaceableLayout(moved("bookcase"))).toBe(false);
  });

  test("W3 액자 바로 아래 칸에 협탁·침대는 놓을 수 있다", () => {
    expect(isPlaceableLayout(LF([floor("nightstand-1", "nightstand", 0.5, 7.5, 0)]))).toBe(true);
    expect(isPlaceableLayout(LF([floor("bed-1", "bed", 1, 8.5, 0)]))).toBe(true);
  });

  test("W4 스탠드를 올린 책상을 액자 아래 (1.5, 7.5, 0)에 두어도 놓을 수 있다", () => {
    const items = [...n0Items().map((item) => (item.id === "desk" ? floor("desk", "desk", 1.5, 7.5, 0) : item)), wall("frame-1", "frame", "left", 7.5)];
    expect(isPlaceableLayout(layoutOf(items))).toBe(true);
  });

  test("W5 화분을 액자 아래 (0.5, 7.5)로 끌어 놓으면 (3.5, 5.5, 0)으로 돌아가고 cannot-place다", () => {
    const editor = new LobbyEditor(LF([floor("plant-1", "plant", 3.5, 5.5, 0)]));
    expect(drag(editor, "plant-1", { x: 3.5, z: 5.5 }, { x: 0.5, z: 7.5 })).toBe("cannot-place");
    expect(itemOf(editor.layout, "plant-1")).toEqual(floor("plant-1", "plant", 3.5, 5.5, 0));
  });

  test("W6 화분 위로 액자를 왼벽 9.5에서 7.5로 끌어 놓으면 9.5로 돌아가고 cannot-place다", () => {
    const start = layoutOf([...n0Items(), floor("plant-1", "plant", 0.5, 7.5, 0), wall("frame-1", "frame", "left", 9.5)]);
    expect(isPlaceableLayout(start)).toBe(true);
    const editor = new LobbyEditor(start);
    expect(dragWall(editor, "frame-1", "left", 9.5, 7.5)).toBe("cannot-place");
    expect(itemOf(editor.layout, "frame-1")).toEqual(wall("frame-1", "frame", "left", 9.5));
  });

  test("W7 액자가 게시판과 겹치면(뒷벽 2.0) 놓을 수 없다", () => {
    expect(isPlaceableLayout(layoutOf([...n0Items(), wall("frame-1", "frame", "back", 2.0)]))).toBe(false);
  });

  test("W8 창문 아래 (3.5, 0.5)에 협탁은 놓을 수 있고 화분은 놓을 수 없다", () => {
    expect(isPlaceableLayout(layoutOf([...n0Items(), floor("nightstand-1", "nightstand", 3.5, 0.5, 0)]))).toBe(true);
    expect(isPlaceableLayout(layoutOf([...n0Items(), floor("plant-1", "plant", 3.5, 0.5, 0)]))).toBe(false);
  });

  test("W9 옷장과 겹친 침대 (7, 3.5, 0)·화분 (7.5, 3.5, 0)은 놓을 수 없다", () => {
    expect(isPlaceableLayout(layoutOf([...n0Items(), floor("bed-1", "bed", 7, 3.5, 0)]))).toBe(false);
    expect(isPlaceableLayout(layoutOf([...n0Items(), floor("plant-1", "plant", 7.5, 3.5, 0)]))).toBe(false);
  });

  test("W10 깔개와 겹친 침대 (4, 5.5, 0)는 놓을 수 있다", () => {
    expect(isPlaceableLayout(layoutOf([...n0Items(), floor("bed-1", "bed", 4, 5.5, 0)]))).toBe(true);
  });

  test("W11 (7, 9.5, 0)의 침대를 돌리면 facing 1이 되고 방 밖으로 나가 빨간 가구가 된다", () => {
    const start = layoutOf([...n0Items(), floor("bed-1", "bed", 7, 9.5, 0)]);
    expect(isPlaceableLayout(start)).toBe(true);
    const editor = new LobbyEditor(start);
    tap(editor, { x: 7, z: 9.5 }, "bed-1");
    editor.rotate();
    expect(itemOf(editor.layout, "bed-1")!.floor!.facing).toBe(1);
    expect(editor.red).toBe("bed-1");
  });

  test("W12 막힌 칸: 침대는 6칸, 협탁은 '3,5'를 더하고 작은 화분은 더하지 않는다", () => {
    const base = layoutGeometry(N0(), 8).solidTiles;
    const withBed = layoutGeometry(layoutOf([...n0Items(), floor("bed-1", "bed", 4, 5.5, 0)]), 8).solidTiles;
    expect([...withBed].filter((t) => !base.has(t)).sort()).toEqual(["3,4", "3,5", "3,6", "4,4", "4,5", "4,6"]);
    const withNs = layoutGeometry(LN1(), 8).solidTiles;
    expect([...withNs].filter((t) => !base.has(t)).sort()).toEqual(["3,5"]);
    const withPlant = layoutGeometry(layoutOf([...n0Items(), NS1(), on("smallPlant-1", "smallPlant", "nightstand-1", 0)]), 8).solidTiles;
    expect([...withPlant].sort()).toEqual([...withNs].sort());
  });

  test("W13 L-F에서 액자를 고르면 벽 표시가 하나 {left, 7.0~8.0, 높이 1.6~2.4, ok}다", () => {
    const editor = new LobbyEditor(LF());
    editor.pointerDown(wallHit("frame-1", "left", 7.5), 200, 300);
    editor.pointerUp();
    const marks = editor.wallMarks();
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ wall: "left", ok: true });
    expect(marks[0].from).toBeCloseTo(7, 6);
    expect(marks[0].to).toBeCloseTo(8, 6);
    expect(marks[0].bottom).toBeCloseTo(1.6, 2);
    expect(marks[0].top).toBeCloseTo(2.4, 2);
  });
});

// ---------- N. 가구 더하기(편집기) ----------

describe("[spec] 066-⑤ 명세 2: 가구 더하기(N, 편집기)", () => {
  test("N4 N0에서 침대를 더하면 bed-1이 (4, 5.5, 0)에 놓이고 골라지며(돌리기·치우기 대상) 보관함은 그대로다", () => {
    const editor = new LobbyEditor(N0());
    expect(editor.addNew("bed")).toBeNull();
    expect(byId(editor.layout.items)).toEqual(byId([...n0Items(), floor("bed-1", "bed", 4, 5.5, 0)]));
    expect(storedOf(editor.layout)).toEqual([]);
    expect(editor.selected).toBe("bed-1");
    expect(editor.handle).toBe("bed-1");
    expect(editor.storable).toBe("bed-1");
  });

  test.each(["nightstand", "floorLamp", "plant"])("N5 N0에서 %s를 더하면 <종류>-1이 (3.5, 5.5, 0)에 놓이고 골라진다", (type) => {
    const editor = new LobbyEditor(N0());
    expect(editor.addNew(type)).toBeNull();
    expect(itemOf(editor.layout, `${type}-1`)).toEqual(floor(`${type}-1`, type, 3.5, 5.5, 0));
    expect(editor.selected).toBe(`${type}-1`);
  });

  test("N6 협탁을 두 번 더하면 nightstand-1 (3.5, 5.5, 0), nightstand-2 (4.5, 5.5, 0)이고 nightstand-2가 골라진다", () => {
    const editor = new LobbyEditor(N0());
    editor.addNew("nightstand");
    editor.addNew("nightstand");
    expect(itemOf(editor.layout, "nightstand-1")).toEqual(floor("nightstand-1", "nightstand", 3.5, 5.5, 0));
    expect(itemOf(editor.layout, "nightstand-2")).toEqual(floor("nightstand-2", "nightstand", 4.5, 5.5, 0));
    expect(editor.selected).toBe("nightstand-2");
  });

  test("N7 N0에서 액자를 더하면 frame-1이 뒷벽 6.5에 걸리고 골라진다", () => {
    const editor = new LobbyEditor(N0());
    expect(editor.addNew("frame")).toBeNull();
    expect(itemOf(editor.layout, "frame-1")).toEqual(wall("frame-1", "frame", "back", 6.5));
    expect(editor.selected).toBe("frame-1");
  });

  test("N8 액자를 한 번 더 더하면(뒷벽에 자리 없음) frame-2가 왼벽 5.5에 걸린다", () => {
    const editor = new LobbyEditor(N0());
    editor.addNew("frame");
    expect(editor.addNew("frame")).toBeNull();
    expect(itemOf(editor.layout, "frame-2")).toEqual(wall("frame-2", "frame", "left", 5.5));
  });

  test("N9 N0에서 작은 화분, 이어서 책을 더하면 {desk, 1, 0}, {desk, 2, 0}이고 각각 골라진다", () => {
    const editor = new LobbyEditor(N0());
    expect(editor.addNew("smallPlant")).toBeNull();
    expect(itemOf(editor.layout, "smallPlant-1")).toEqual(on("smallPlant-1", "smallPlant", "desk", 1));
    expect(editor.selected).toBe("smallPlant-1");
    expect(editor.addNew("books")).toBeNull();
    expect(itemOf(editor.layout, "books-1")).toEqual(on("books-1", "books", "desk", 2));
    expect(editor.selected).toBe("books-1");
  });

  test("N10 책상 자리가 다 찬 L-N1에서 책을 더하면 books-2가 {nightstand-1, 0, 0}에 놓인다", () => {
    const editor = new LobbyEditor(layoutOf([...n0Items(), NS1(), on("smallPlant-1", "smallPlant", "desk", 1), on("books-1", "books", "desk", 2)]));
    expect(editor.addNew("books")).toBeNull();
    expect(itemOf(editor.layout, "books-2")).toEqual(on("books-2", "books", "nightstand-1", 0));
  });

  test("N11 받침 가구 자리가 다 찼으면 책을 만들지 않고 no-room이며 배치가 그대로다", () => {
    const start = layoutOf([...n0Items(), on("smallPlant-1", "smallPlant", "desk", 1), on("books-1", "books", "desk", 2)]);
    const editor = new LobbyEditor(start);
    expect(editor.addNew("books")).toBe("no-room");
    expect(editor.layout).toEqual(start);
  });

  test("N12 보관함의 협탁은 받침 가구가 아니다: 작은 화분을 만들지 않고 no-room이다", () => {
    const start = layoutOf([...n0Items(), on("smallPlant-1", "smallPlant", "desk", 1), on("books-1", "books", "desk", 2)], [{ id: "nightstand-1", type: "nightstand" }]);
    const editor = new LobbyEditor(start);
    expect(editor.addNew("smallPlant")).toBe("no-room");
    expect(editor.layout).toEqual(start);
  });

  test("N13 침대를 더해 돌려 빨갛게 한 뒤 화분을 더하면 만들지 않고 red-first다", () => {
    const editor = new LobbyEditor(N0());
    editor.addNew("bed");
    editor.rotate();
    expect(editor.red).toBe("bed-1");
    const before = editor.layout;
    expect(editor.addNew("plant")).toBe("red-first");
    expect(editor.layout).toEqual(before);
    expect(itemOf(editor.layout, "plant-1")).toBeUndefined();
  });

  const wardrobes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `wardrobe-${i + 1}`, type: "wardrobe" }));

  test("N14 방과 보관함을 합쳐 40개면 침대를 만들지 않고 limit이며 배치가 그대로다", () => {
    const start = layoutOf(n0Items(), wardrobes(33));
    const editor = new LobbyEditor(start);
    expect(editor.addNew("bed")).toBe("limit");
    expect(editor.layout).toEqual(start);
  });

  test("N15 39개에서 화분을 더하면 plant-1이 (3.5, 5.5, 0)에 놓이고, 한 번 더 더하면 limit이다", () => {
    const editor = new LobbyEditor(layoutOf(n0Items(), wardrobes(32)));
    expect(editor.addNew("plant")).toBeNull();
    expect(itemOf(editor.layout, "plant-1")).toEqual(floor("plant-1", "plant", 3.5, 5.5, 0));
    const before = editor.layout;
    expect(editor.addNew("plant")).toBe("limit");
    expect(editor.layout).toEqual(before);
  });

  test("N16 협탁을 더한 직후 돌리면 facing이 1이다", () => {
    const editor = new LobbyEditor(N0());
    editor.addNew("nightstand");
    editor.rotate();
    expect(itemOf(editor.layout, "nightstand-1")!.floor!.facing).toBe(1);
  });

  test("N17 침대를 더한 직후 (4, 5.5)에서 (6, 9.5)로 끌어 놓으면 (6, 9.5, 0)이고 안내가 없다", () => {
    const editor = new LobbyEditor(N0());
    editor.addNew("bed");
    expect(drag(editor, "bed-1", { x: 4, z: 5.5 }, { x: 6, z: 9.5 })).toBeNull();
    expect(itemOf(editor.layout, "bed-1")).toEqual(floor("bed-1", "bed", 6, 9.5, 0));
  });

  test("N21 침대를 더한 뒤 '처음 배치로'면 방은 N0, 보관함은 [bed-1]이고 고르기가 풀린다", () => {
    const editor = new LobbyEditor(N0());
    editor.addNew("bed");
    editor.resetToDefault();
    expect(byId(editor.layout.items)).toEqual(byId(n0Items()));
    expect(storedOf(editor.layout)).toEqual([{ id: "bed-1", type: "bed" }]);
    expect(editor.selected).toBeNull();
  });
});

// ---------- I. 새 id ----------

describe("[spec] 066-⑤ 명세 2: 새 id(I)", () => {
  const addedId = (start: LobbyLayout, type = "bed") => {
    const editor = new LobbyEditor(start);
    const before = new Set([...start.items, ...storedOf(start)].map((p) => p.id));
    expect(editor.addNew(type)).toBeNull();
    const fresh = editor.layout.items.filter((p) => !before.has(p.id));
    expect(fresh).toHaveLength(1);
    return fresh[0].id;
  };
  const bedAt = (id: string) => floor(id, "bed", 7, 9.5, 0);

  test("I1 N0 → bed-1", () => {
    expect(addedId(N0())).toBe("bed-1");
  });

  test("I2 방에 bed-2만 있으면 → bed-1", () => {
    expect(addedId(layoutOf([...n0Items(), bedAt("bed-2")]))).toBe("bed-1");
  });

  test("I3 방에 bed-1, 보관함에 bed-3 → bed-2", () => {
    expect(addedId(layoutOf([...n0Items(), bedAt("bed-1")], [{ id: "bed-3", type: "bed" }]))).toBe("bed-2");
  });

  test("I4 방에 bed-1, 보관함에 bed-2 → bed-3", () => {
    expect(addedId(layoutOf([...n0Items(), bedAt("bed-1")], [{ id: "bed-2", type: "bed" }]))).toBe("bed-3");
  });

  test("I5 bed-1을 더해 치운 뒤 침대를 다시 더하면 bed-2", () => {
    const editor = new LobbyEditor(N0());
    editor.addNew("bed");
    editor.store();
    expect(storedOf(editor.layout)).toEqual([{ id: "bed-1", type: "bed" }]);
    expect(editor.addNew("bed")).toBeNull();
    expect(itemOf(editor.layout, "bed-2")).toBeDefined();
  });

  test("I6 N0에서 스탠드를 더하면 lamp-1", () => {
    expect(addedId(N0(), "lamp")).toBe("lamp-1");
  });

  test("I7 방에 id가 bed-1인 옷장이 있으면 침대는 bed-2", () => {
    const items = n0Items().map((item) => (item.id === "wardrobe" ? floor("bed-1", "wardrobe", 7.5, 3.5, 3) : item));
    expect(addedId(layoutOf(items))).toBe("bed-2");
  });
});

// ---------- M. 받침 가구가 여럿일 때: 끌기·꺼내기 ----------

describe("[spec] 066-⑤ 명세 3: 받침 가구가 여럿일 때 끌기·꺼내기(M)", () => {
  test("M1 L-N1에서 스탠드를 협탁 (3.5, 5.5)로 끌어 놓으면 {nightstand-1, 0, 0}이고 3D는 (3.5, 0.74, 5.5)다", () => {
    const editor = new LobbyEditor(LN1());
    expect(drag(editor, "lamp", SLOT0, NS_AT)).toBeNull();
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "nightstand-1", slot: 0, facing: 0 });
    expect(editor.red).toBeNull();
    expectAt(editor.layout, "lamp", { x: 3.5, y: NS_TOP, z: 5.5 });
  });

  test("M2 이어서 협탁에서 (1.5, 5.5)로 끌어 놓으면 {desk, 1, 0}이다", () => {
    const editor = new LobbyEditor(LN1());
    drag(editor, "lamp", SLOT0, NS_AT);
    expect(drag(editor, "lamp", NS_AT, { x: 1.5, z: 5.5 })).toBeNull();
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 1, facing: 0 });
  });

  test("M3 작은 화분이 있는 협탁으로 스탠드를 끌어 놓으면 {desk, 0, 0}으로 돌아가고 cannot-place이며 빨간 가구가 아니다", () => {
    const editor = new LobbyEditor(layoutOf([...n0Items(), NS1(), on("smallPlant-1", "smallPlant", "nightstand-1", 0)]));
    expect(drag(editor, "lamp", SLOT0, NS_AT)).toBe("cannot-place");
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
    expect(editor.red).toBeNull();
  });

  test("M4 스탠드를 한 번 돌린 뒤 협탁으로 끌어 놓으면 {nightstand-1, 0, 1}이다", () => {
    const editor = new LobbyEditor(LN1());
    tap(editor, SLOT0, "lamp");
    editor.rotate();
    drag(editor, "lamp", SLOT0, NS_AT);
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "nightstand-1", slot: 0, facing: 1 });
  });

  test("M5 스탠드를 침대 가운데 (4, 5.5)로 끌어도 침대에는 오르지 않고 {desk, 2, 0}이다", () => {
    const editor = new LobbyEditor(layoutOf([...n0Items(), floor("bed-1", "bed", 4, 5.5, 0), floor("nightstand-1", "nightstand", 6.5, 9.5, 0)]));
    drag(editor, "lamp", SLOT0, { x: 4, z: 5.5 });
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 2, facing: 0 });
  });

  test("M6 협탁이 items 맨 앞이면 보관함의 스탠드를 꺼낼 때 {nightstand-1, 0, 0}이다", () => {
    const editor = new LobbyEditor(layoutOf([NS1(), ...n0NoLamp()], [{ id: "lamp", type: "lamp" }]));
    expect(editor.takeOut("lamp")).toBeNull();
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "nightstand-1", slot: 0, facing: 0 });
  });

  test("M7 협탁이 items 맨 뒤면 보관함의 스탠드를 꺼낼 때 {desk, 0, 0}이다", () => {
    const editor = new LobbyEditor(layoutOf([...n0NoLamp(), NS1()], [{ id: "lamp", type: "lamp" }]));
    expect(editor.takeOut("lamp")).toBeNull();
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "desk", slot: 0, facing: 0 });
  });

  const lampOnNs = () => layoutOf([...n0NoLamp(), NS1(), on("lamp", "lamp", "nightstand-1", 0)]);

  test("M8 스탠드를 올린 협탁을 (5.5, 9.5)로 끌어 놓으면 스탠드 저장값은 그대로이고 자리는 (5.5, 0.74, 9.5)다", () => {
    const editor = new LobbyEditor(lampOnNs());
    expect(drag(editor, "nightstand-1", NS_AT, { x: 5.5, z: 9.5 })).toBeNull();
    expect(itemOf(editor.layout, "nightstand-1")!.floor).toEqual({ x: 5.5, z: 9.5, facing: 0 });
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "nightstand-1", slot: 0, facing: 0 });
    const pose = tabletopPose(editor.layout, itemOf(editor.layout, "lamp")!)!;
    expect([pose.x, pose.z]).toEqual([5.5, 9.5]);
    expect(pose.y).toBeCloseTo(NS_TOP, 6);
    expectAt(editor.layout, "lamp", { x: 5.5, y: NS_TOP, z: 9.5 });
  });

  test("M9 그 협탁을 한 번 돌리면 스탠드 저장값은 그대로이고 3D rotY π/2, 자리 (3.5, 0.74, 5.5)다", () => {
    const editor = new LobbyEditor(lampOnNs());
    tap(editor, NS_AT, "nightstand-1");
    editor.rotate();
    expect(itemOf(editor.layout, "nightstand-1")!.floor!.facing).toBe(1);
    expect(itemOf(editor.layout, "lamp")!.on).toEqual({ parent: "nightstand-1", slot: 0, facing: 0 });
    const p = placementOf(editor.layout, "lamp");
    expect(Math.cos(p.rotY)).toBeCloseTo(0, 6);
    expect(Math.sin(p.rotY)).toBeCloseTo(1, 6);
    expectAt(editor.layout, "lamp", { x: 3.5, y: NS_TOP, z: 5.5 });
  });

  test("M10 협탁 위 스탠드를 고르면 표시가 하나 {x 3..4, z 5..6, 높이 0.74, ok}다", () => {
    const editor = new LobbyEditor(lampOnNs());
    tap(editor, NS_AT, "lamp");
    const marks = editor.marks();
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ minX: 3, maxX: 4, minZ: 5, maxZ: 6, ok: true });
    expect(marks[0].y).toBeCloseTo(NS_TOP, 6);
  });
});

// ---------- S. 받침 가구를 치울 때 ----------

describe("[spec] 066-⑤ 명세 3: 받침 가구를 치울 때(S, 편집기)", () => {
  function storeNightstand() {
    const editor = new LobbyEditor(LNS());
    tap(editor, NS_AT, "nightstand-1");
    expect(editor.storable).toBe("nightstand-1");
    editor.store();
    return editor;
  }

  test("S1 L-NS에서 협탁을 치우면 협탁과 작은 화분이 방에서 빠지고 보관함이 [wardrobe-1, nightstand-1, smallPlant-1] 순서다", () => {
    const editor = storeNightstand();
    expect(itemOf(editor.layout, "nightstand-1")).toBeUndefined();
    expect(itemOf(editor.layout, "smallPlant-1")).toBeUndefined();
    expect(storedOf(editor.layout)).toEqual([
      { id: "wardrobe-1", type: "wardrobe" },
      { id: "nightstand-1", type: "nightstand" },
      { id: "smallPlant-1", type: "smallPlant" }
    ]);
    expect(editor.selected).toBeNull();
  });

  test("S3 이어서 협탁을 꺼내면 (3.5, 5.5, 0)에 빈 채로 놓이고 골라지며 보관함은 [wardrobe-1, smallPlant-1]이다", () => {
    const editor = storeNightstand();
    expect(editor.takeOut("nightstand")).toBeNull();
    expect(itemOf(editor.layout, "nightstand-1")).toEqual(NS1());
    expect(editor.layout.items.filter((item) => item.on?.parent === "nightstand-1")).toEqual([]);
    expect(editor.selected).toBe("nightstand-1");
    expect(storedOf(editor.layout)).toEqual([
      { id: "wardrobe-1", type: "wardrobe" },
      { id: "smallPlant-1", type: "smallPlant" }
    ]);
  });

  test("S4 이어서 작은 화분을 꺼내면 책상의 첫 빈자리 {desk, 1, 0}이다", () => {
    const editor = storeNightstand();
    editor.takeOut("nightstand");
    expect(editor.takeOut("smallPlant")).toBeNull();
    expect(itemOf(editor.layout, "smallPlant-1")!.on).toEqual({ parent: "desk", slot: 1, facing: 0 });
  });

  test("S7 L-NS에서 '처음 배치로'면 방은 N0이고 보관함에 wardrobe-1·nightstand-1·smallPlant-1이 있다", () => {
    const editor = new LobbyEditor(LNS());
    editor.resetToDefault();
    expect(byId(editor.layout.items)).toEqual(byId(n0Items()));
    expect(byId(storedOf(editor.layout))).toEqual(
      byId([
        { id: "wardrobe-1", type: "wardrobe" },
        { id: "nightstand-1", type: "nightstand" },
        { id: "smallPlant-1", type: "smallPlant" }
      ])
    );
  });

  test("S8 작은 화분만 치우면 협탁은 남고 보관함 끝에 smallPlant-1이 붙는다", () => {
    const editor = new LobbyEditor(LNS());
    tap(editor, NS_AT, "smallPlant-1");
    expect(editor.storable).toBe("smallPlant-1");
    editor.store();
    expect(itemOf(editor.layout, "smallPlant-1")).toBeUndefined();
    expect(itemOf(editor.layout, "nightstand-1")).toEqual(NS1());
    expect(storedOf(editor.layout)).toEqual([
      { id: "wardrobe-1", type: "wardrobe" },
      { id: "smallPlant-1", type: "smallPlant" }
    ]);
  });
});

// ---------- G2·K. 3D 목록과 그대로여야 할 동작 ----------

describe("[spec] 066-⑤ 명세 1·5: 3D 목록(G2)과 그대로여야 할 동작(K)", () => {
  test("G2 바닥 가구 넷은 길을 막는 가구이고 장소가 없으며 바닥 그림자가 있다. 액자는 벽 가구, 벽 그림자, 장소·막음 없음", () => {
    const layout = V_ALL();
    for (const id of ["bed-1", "nightstand-1", "floorLamp-1", "plant-1"]) {
      const p = placementOf(layout, id);
      expect(`${id}:${p.blocker}:${p.mark}`).toBe(`${id}:true:undefined`);
      expect(p.shadow?.floor).toBeDefined();
    }
    const frame = placementOf(layout, "frame-1");
    expect(frame.mount).toBe("wall");
    expect(frame.shadow?.wall).toBeDefined();
    expect(frame.mark).toBeUndefined();
    expect(frame.blocker).toBeUndefined();
    const bed = placementOf(layout, "bed-1");
    expect(bed.scale!.x).toBe(1);
    expect(bed.scale!.z).toBeCloseTo(3 / 3.15, 2);
  });

  test("G1(목록) 작은 화분은 협탁 윗면 0.74, 책은 책상 윗면 1.292에 놓인다", () => {
    const layout = V_ALL();
    expect(placementOf(layout, "smallPlant-1").y).toBeCloseTo(NS_TOP + furnitureType("smallPlant").model.y, 6);
    expect(placementOf(layout, "books-1").y).toBeCloseTo(DESK_TOP + furnitureType("books").model.y, 6);
  });

  test("K1 처음 배치는 N0 그대로다(7개, 보관함 없음)", () => {
    expect(DEFAULT_LOBBY_LAYOUT).toEqual(N0());
  });

  test("K2 N0과 N0 + 보관함 [wardrobe-1, rug-1, lamp-1]을 본문으로 JSON 왕복하면 같다", () => {
    for (const layout of [N0(), layoutOf(n0Items(), [{ id: "wardrobe-1", type: "wardrobe" }, { id: "rug-1", type: "rug" }, { id: "lamp-1", type: "lamp" }])]) {
      const back = parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(layout))));
      expect(back).toEqual(layout);
    }
  });

  test("K5 꾸미기 밖: 책상 위 책·스탠드는 책상 장소이고, 협탁 위 작은 화분은 길을 막는 가구다", () => {
    const layout = V_ALL();
    expect(placementOf(layout, "books-1").mark).toBe("desk");
    expect(placementOf(layout, "lamp").mark).toBe("desk");
    const plant = placementOf(layout, "smallPlant-1");
    expect(plant.mark).toBeUndefined();
    expect(plant.blocker).toBe(true);
  });

  test("K6 V-ALL의 장소 입구 자리는 N0과 같고, 입구에서 장소로 가는 길의 점은 새 바닥 가구 칸에 들지 않는다", () => {
    const all = layoutGeometry(V_ALL(), 8);
    expect(all.places).toEqual(layoutGeometry(N0(), 8).places);
    const newTiles = ["3,4", "3,5", "3,6", "4,4", "4,5", "4,6", "6,9", "5,9", "7,9"];
    for (const tile of newTiles) expect(all.solidTiles.has(tile)).toBe(true);
    for (const place of Object.values(all.places)) {
      const path = findPath(MARKS.door.approach[0], place.approach, all.solidTiles);
      expect(path).not.toBeNull();
      for (const p of path!) expect(newTiles).not.toContain(`${Math.floor(p.x)},${Math.floor(p.z)}`);
    }
  });
});
