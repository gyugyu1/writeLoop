// [spec] qa 테스트(작업 064-① 배치를 데이터로, 명세 범위 3: 배치를 바꿔도 장소·이름표·의자가 따라감).
// 입구 이름과 배치 데이터 모양은 결정(private 작업 폴더 064/02-배치-데이터/03-main-decision.md)의 2를 따른다:
// lobby-layout.ts의 LobbyLayout·DEFAULT_LOBBY_LAYOUT·layoutGeometry, engine.ts의 applyLobbyLayout·activeLobbyLayout,
// furniture-layout.ts의 furniturePlacements. 새 입구라 기준 코드(8e6a453)에서는 실패하는 것이 맞다.
// 기대값은 명세 범위 3의 규칙("가구가 옮겨지거나 돌면 딸린 서는 자리·바라볼 지점·구역·이름표·의자도 함께 옮겨지고 돈다",
// "벽 가구는 걸린 벽을 따라 방 안쪽을 본다")과 결정 03의 1(칸 모양: 책상 3×1, 책장·옷장 1×1, 깔개는 막지 않음,
// 자리는 칸 모양의 가운데, 돌리면 칸 모양이 가운데를 중심으로 돎. 처음 배치의 그림 자리는 지금과 같음)에서 얻는다.
// 처음 배치에서 딸린 점이 가구 가운데(벽 가구는 벽 위의 바라볼 지점)에서 떨어진 차이를 처음 배치의 값(lobby3d-layout-initial.spec)에서 재고,
// 가구를 옮기면 그 차이를 그대로, 돌리면 rotY만큼 돌린다. rotY는 위에서 보아 반시계(furniture-layout.ts의 약속),
// facing은 0 앞(+z, rotY 0), 1 오른쪽(+x, rotY π/2), 2 뒤(−z, rotY π), 3 왼쪽(−x, rotY −π/2)이다(결정 03).
// 회전: 로컬 차이 (a, b)를 rotY θ로 돌리면 (a·cosθ + b·sinθ, −a·sinθ + b·cosθ).
// 창문이 옆벽일 때의 창문 빛·창밖 방향은 ④에서 하므로 보지 않는다(옆벽 창문은 자리·서는 자리·바라볼 지점·이름표만 본다).
// 배치를 바꾼 테스트는 끝에 처음 배치로 되돌린다(afterEach).
// 066-①(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서 배치 데이터가 v2(가구 인스턴스 목록)로 바뀌어,
// 명세의 "고칠 기존 테스트"대로 확인하는 뜻·기대값은 그대로 두고 배치 모양만 v2로 고쳤다(처음 배치의 인스턴스 id는 종류 id와 같다).
// 배치는 064 때처럼 바닥 가구·벽 가구 묶음으로 적고 바꾼 뒤 v2 목록으로 만든다(layoutWith). 목록 순서는 명세가 정하지 않아 id 순으로 견준다.
// 066-②(private 작업 폴더 066/03-모델-칸에-맞추기/01-main-spec.md)에서 바닥 가구 모델이 칸에 맞게 줄고 뒷면이 칸 뒤 끝에 붙어, 명세의 "고칠 기존 테스트"대로
// 책장·옷장 그림 자리의 기대값만 새 자리(뒤로 0.06 → 칸 뒤 끝에서 0.876/2 앞, 벽 가까이 0.44 → 0.438, 7.56 → 7.562)로 고쳤다.
// 067(private 작업 폴더 067/01-main-spec.md)에서 책상 모델이 칸 폭 3.0을 다 채워 칸 가운데에 놓이고 책상 장소의 바라볼 지점·이름표가 가구 기준
// (-0.25, 0) → (0, 0)으로 옮겨져, 명세의 "고칠 기존 테스트"대로 책상 그림·바라볼 지점·이름표의 기대값(가구 가운데에서 x -0.25 → 0)과
// 그 바라볼 지점을 보는 방향만 고쳤다(DEFAULT_PLACES·DEFAULT_PIECES의 책상, T1-1~T1-4, T5-2·T5-4·T5-5, R1). 서는 자리·의자·막힌 칸과 입력은 그대로다.
// 089-③(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/05-옷장과-꾸미기-화면/03-main-decision.md A, 사용자 결정 "qa가 새 동작에 맞게 고침")에서
// 옷장이 막는 가구가 아니라 옷장마다 하나인 장소가 되어, T0-4·T4-2의 옷장 기대값만 새 동작(막는 가구 표시 없음, 그 옷장의 장소 표시)으로 고쳤다.
// 장소 id는 구현의 closetPlaceId(가구 id)로 만든다. 자리·방향 등 나머지 기대값과 입력은 그대로다.
//
// 기준 코드에서는 새 입구가 없어 타입 검사가 깨지지 않게, 입구는 아래 "지금 코드를 부르는 곳"에서 require로 불러오고 타입은 결정 03대로 여기서 적는다.
// 구현이 부르는 모양을 바꾸면 그곳만 따라 고친다(결정 03의 4). 그 아래의 기대값·단언·입력은 고치지 않는다.
import { windowLightPanes, type WindowLightPane } from "@/lib/lobby3d/daylight";
import * as engine from "@/lib/lobby3d/engine";
import type { FloorPoint, MarkId } from "@/lib/lobby3d/engine";
import * as furniture from "@/lib/lobby3d/furniture-layout";
import { closetPlaceId } from "@/lib/lobby3d/lobby-layout";

// ---------- 지금 코드를 부르는 곳(결정 03의 입구) ----------

type Facing = 0 | 1 | 2 | 3;
interface FloorSpot {
  x: number;
  z: number;
  facing: Facing;
}
interface WallSpot {
  wall: "back" | "left" | "right";
  along: number;
}
/** 066-① 명세 2의 배치 데이터 v2(앱 안의 값은 API 본문에서 version을 뺀 모양). */
interface LobbyLayout {
  items: { id: string; type: string; floor?: FloorSpot; wall?: WallSpot; on?: { parent: string; slot: number; facing: Facing } }[];
}
/** 064 때 적던 배치 묶음. 테스트 안에서만 쓰고 v2 목록으로 바꿔 넘긴다. */
interface LayoutParts {
  floor: { desk: FloorSpot; bookcase: FloorSpot; wardrobe: FloorSpot; rug: FloorSpot };
  wall: { board: WallSpot; window: WallSpot };
}
type PlaceId = "board" | "window" | "desk" | "bookcase";
interface Point3 {
  x: number;
  y: number;
  z: number;
}
interface LayoutGeometry {
  pieces: readonly { piece: string; x: number; y: number; z: number; rotY: number }[];
  solidTiles: ReadonlySet<string>;
  places: Record<PlaceId, { approach: readonly FloorPoint[]; faceTo: FloorPoint; label: Point3 }>;
  chair: { home: FloorPoint; pullDir: FloorPoint; pull: number; seat: FloorPoint; side: FloorPoint; seatHeight: number; heading: number };
}
interface Placement {
  piece: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  mark?: string;
  blocker?: boolean;
}

function need<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name}이(가) 없다(결정 03의 입구)`);
  return value;
}

const engineApi = engine as unknown as typeof engine & {
  applyLobbyLayout?: (layout: LobbyLayout) => void;
  activeLobbyLayout?: () => LobbyLayout;
};
const furnitureApi = furniture as unknown as typeof furniture & { furniturePlacements?: (layout: LobbyLayout) => readonly Placement[] };

function layoutModule(): { DEFAULT_LOBBY_LAYOUT: LobbyLayout; layoutGeometry: (layout: LobbyLayout, roomWidth: number) => LayoutGeometry } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/lobby3d/lobby-layout");
}

const current = {
  defaultLayout: () => need(layoutModule().DEFAULT_LOBBY_LAYOUT, "DEFAULT_LOBBY_LAYOUT"),
  geometry: (layout: LobbyLayout) => need(layoutModule().layoutGeometry, "layoutGeometry")(layout, engine.ROOM.width),
  placements: (layout: LobbyLayout) => need(furnitureApi.furniturePlacements, "furniturePlacements")(layout),
  apply: (layout: LobbyLayout) => need(engineApi.applyLobbyLayout, "applyLobbyLayout")(layout),
  active: () => need(engineApi.activeLobbyLayout, "activeLobbyLayout")(),
  /** 지금 배치의 장소 데이터·막힌 칸·의자(결정 03: applyLobbyLayout을 따른다). */
  marks: () => engine.MARKS,
  solidTiles: () => engine.SOLID_TILES,
  chair: () => engine.CHAIR,
  isBlocked: (x: number, z: number) => engine.isBlocked(x, z),
  markZoneAt: (x: number, z: number) => engine.markZoneAt(x, z),
  newSim: (at: FloorPoint) => new engine.LobbySim(at),
  /** 바닥 창문 빛: 3D 목록의 창문 자리(x, y)와 창 안쪽 크기로 구한다(지금 lobby3d-daylight가 하는 조합). */
  windowLightPanes: (layout: LobbyLayout, sun: { elevation: number; azimuth: number }) => {
    const place = current.placements(layout).find((p) => p.piece === "window");
    return windowLightPanes(sun, { ...furniture.WINDOW_OPENING, x: place!.x, y: place!.y }, engine.ROOM.width, engine.ROOM.depth);
  }
};

afterEach(() => {
  // 배치를 바꾼 테스트 뒤에 처음 배치로 되돌린다(입구가 없는 기준 코드에서는 할 것이 없다)
  if (typeof engineApi.applyLobbyLayout === "function") engineApi.applyLobbyLayout(layoutModule().DEFAULT_LOBBY_LAYOUT);
});

// ---------- 도우미 ----------

function r4(v: number): number {
  const n = Math.round(v * 1e4) / 1e4;
  return n === 0 ? 0 : n;
}

function angle(v: number): number {
  const twoPi = Math.PI * 2;
  const n = r4(((v % twoPi) + twoPi) % twoPi);
  return n === r4(twoPi) ? 0 : n;
}

const pt = (p: FloorPoint): [number, number] => [r4(p.x), r4(p.z)];
const p3 = (p: Point3): [number, number, number] => [r4(p.x), r4(p.y), r4(p.z)];

/** 처음 배치(결정 03의 1·2)의 묶음. */
function defaultParts(): LayoutParts {
  return {
    floor: {
      desk: { x: 1.5, z: 5.5, facing: 0 },
      bookcase: { x: 0.5, z: 2.5, facing: 1 },
      wardrobe: { x: 7.5, z: 3.5, facing: 3 },
      rug: { x: 4.6, z: 7.2, facing: 0 }
    },
    wall: { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } }
  };
}

/** 묶음을 v2 목록으로(인스턴스 id = 종류 id). */
function toV2(parts: LayoutParts): LobbyLayout {
  return {
    items: [
      ...Object.entries(parts.floor).map(([id, floor]) => ({ id, type: id, floor })),
      ...Object.entries(parts.wall).map(([id, wall]) => ({ id, type: id, wall }))
    ]
  };
}

/** 처음 배치(결정 03의 1·2). */
function defaultLayout(): LobbyLayout {
  return toV2(defaultParts());
}

/** 066-④ 결정 2: 처음 배치(DEFAULT_LOBBY_LAYOUT)에 스탠드(책상 왼쪽 자리)가 더해졌다. T0-1·T0-2·R1은 처음 배치와 견주므로 이것과 견준다. */
function newDefaultLayout(): LobbyLayout {
  const layout = defaultLayout();
  return { items: [...layout.items, { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } }] };
}

function layoutWith(change: (layout: LayoutParts) => void): LobbyLayout {
  const parts = defaultParts();
  change(parts);
  return toV2(parts);
}

/** id 순으로 늘어놓은 인스턴스(목록 순서를 보지 않고 견준다). */
function sortedItems(layout: LobbyLayout | null | undefined) {
  return [...(layout?.items ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function piecesByName(list: readonly { piece: string; x: number; y: number; z: number; rotY: number }[]) {
  return Object.fromEntries(list.map((p) => [p.piece, { x: r4(p.x), y: r4(p.y), z: r4(p.z), rotY: angle(p.rotY) }]));
}

function placesOf(g: LayoutGeometry) {
  return Object.fromEntries(
    (["board", "window", "desk", "bookcase"] as PlaceId[]).map((id) => [
      id,
      { approach: g.places[id].approach.map(pt), faceTo: pt(g.places[id].faceTo), label: p3(g.places[id].label) }
    ])
  );
}

function chairOf(g: LayoutGeometry) {
  const c = g.chair;
  return {
    home: pt(c.home),
    pullDir: pt(c.pullDir),
    pull: r4(c.pull),
    seat: pt(c.seat),
    side: pt(c.side),
    seatHeight: r4(c.seatHeight),
    heading: angle(c.heading)
  };
}

function marksOf() {
  const m = current.marks();
  return Object.fromEntries(
    (["board", "window", "desk", "bookcase", "door"] as MarkId[]).map((id) => [id, { approach: m[id].approach.map(pt), faceTo: pt(m[id].faceTo) }])
  );
}

let now = 2_000_000;

function step(sim: engine.LobbySim, frames: number) {
  for (let i = 0; i < frames; i += 1) {
    now += 50;
    sim.update(0.05, now);
  }
}

/** 방 가운데(4.2, 6.2)에서 장소를 눌러 걸어간 뒤의 자리·도착 장소·방향. */
function walkTo(id: MarkId) {
  const sim = current.newSim({ x: 4.2, z: 6.2 });
  sim.pointerDown({ point: null, mark: id, onCharacter: false }, 100, 100, now);
  const result = sim.pointerUp(now + 100);
  now += 100;
  step(sim, 400);
  return { result, at: pt(sim), arrived: sim.arrived, heading: angle(sim.heading) };
}

/** 일기 책상 들어가기 동작의 비켜선 자리(8번째 프레임), 앉은 자리(20번째), 판을 연 동안의 방향, 돌아온 자리와 방향. */
function chairScene(from: FloorPoint) {
  const sim = current.newSim(from);
  const started = sim.startScene("desk", now);
  const seen: Record<string, [number, number]> = {};
  for (let i = 1; i <= 30; i += 1) {
    step(sim, 1);
    if (i === 8) seen.side = pt(sim);
    if (i === 20) seen.seat = pt(sim);
  }
  const hold = { phase: sim.scene?.phase ?? null, heading: angle(sim.heading) };
  sim.endScene();
  step(sim, 40);
  return { started, side: seen.side, seat: seen.seat, hold, back: pt(sim), arrived: sim.arrived, heading: angle(sim.heading) };
}

const sortedTiles = (tiles: Iterable<string>) => [...tiles].sort();

/** 처음 배치의 장소 데이터(lobby3d-layout-initial.spec M2와 지금 이름표 자리). */
const DEFAULT_PLACES = {
  board: { approach: [[1.6, 1.3], [2.2, 1.3]], faceTo: [1.8, 0], label: [1.8, 2.75, 0.3] },
  window: { approach: [[4.5, 1.55], [5.1, 1.55]], faceTo: [4.8, 0], label: [4.8, 3.05, 0.3] },
  desk: { approach: [[1.5, 6.75]], faceTo: [1.5, 5.5], label: [1.5, 2.1, 5.5] },
  bookcase: { approach: [[1.4, 2.5]], faceTo: [0, 2.5], label: [0.9, 2.3, 2.5] }
};

/** 처음 배치의 3D 가구(입구 발판 빼고). */
const DEFAULT_PIECES = {
  board: { x: 1.8, y: 1.75, z: 0.06, rotY: 0 },
  window: { x: 4.8, y: 2.05, z: 0.17, rotY: 0 },
  desk: { x: 1.5, y: 0, z: 5.5, rotY: 0 },
  chair: { x: 1.5, y: 0, z: 5.95, rotY: angle(Math.PI) },
  bookcase: { x: 0.438, y: 0, z: 2.5, rotY: angle(Math.PI / 2) },
  wardrobe: { x: 7.562, y: 0, z: 3.5, rotY: angle(-Math.PI / 2) },
  rug: { x: 4.6, y: 0.004, z: 7.2, rotY: 0 }
};

const DEFAULT_SOLID = ["0,2", "0,5", "1,5", "2,5", "7,3"];

const DEFAULT_CHAIR = {
  home: [1.5, 5.95],
  pullDir: [0, 1],
  pull: 0.5,
  seat: [1.5, 6.45],
  side: [2.15, 6.55],
  seatHeight: 0.67,
  heading: angle(Math.PI)
};

// ---------- T0 처음 배치 ----------

describe("[spec] 064-① 범위 3 T0: 처음 배치를 데이터로 넣으면 지금과 같은 값이 나온다", () => {
  it("T0-1: DEFAULT_LOBBY_LAYOUT은 결정 03의 처음 배치(책상 (1.5, 5.5) 앞, 책장 (0.5, 2.5) 오른쪽, 옷장 (7.5, 3.5) 왼쪽, 깔개 (4.6, 7.2), 게시판 뒷벽 1.8, 창문 뒷벽 4.8)다", () => {
    expect(sortedItems(current.defaultLayout())).toEqual(sortedItems(newDefaultLayout()));
  });

  it("T0-2: 처음 지금 배치(activeLobbyLayout)는 처음 배치다", () => {
    expect(sortedItems(current.active())).toEqual(sortedItems(newDefaultLayout()));
  });

  it("T0-3: layoutGeometry(처음 배치)의 3D 가구 자리·막힌 칸·장소(서는 자리·바라볼 지점·이름표)·의자가 지금 값과 같다", () => {
    const g = current.geometry(defaultLayout());
    expect(piecesByName(g.pieces)).toEqual(DEFAULT_PIECES);
    expect(g.pieces.length).toBe(7);
    expect(sortedTiles(g.solidTiles)).toEqual(DEFAULT_SOLID);
    expect(placesOf(g)).toEqual(DEFAULT_PLACES);
    expect(chairOf(g)).toEqual(DEFAULT_CHAIR);
  });

  it("T0-4: furniturePlacements(처음 배치)는 입구 발판을 더한 여덟 개이고, 장소·막는 가구 표시가 지금과 같다(089-③ 03 결정 A: 옷장은 옷장 장소)", () => {
    const list = current.placements(defaultLayout());
    expect(list.length).toBe(8);
    expect(Object.fromEntries(list.map((p) => [p.piece, { ...piecesByName([p])[p.piece], mark: p.mark ?? null, blocker: p.blocker ?? false }]))).toEqual({
      board: { ...DEFAULT_PIECES.board, mark: "board", blocker: false },
      window: { ...DEFAULT_PIECES.window, mark: "window", blocker: false },
      desk: { ...DEFAULT_PIECES.desk, mark: "desk", blocker: false },
      chair: { ...DEFAULT_PIECES.chair, mark: "desk", blocker: false },
      bookcase: { ...DEFAULT_PIECES.bookcase, mark: "bookcase", blocker: false },
      wardrobe: { ...DEFAULT_PIECES.wardrobe, mark: closetPlaceId("wardrobe"), blocker: false },
      rug: { ...DEFAULT_PIECES.rug, mark: null, blocker: false },
      exit: { x: 4, y: 0, z: 11.35, rotY: 0, mark: "door", blocker: false }
    });
  });

  it("T0-5: 처음 배치를 applyLobbyLayout으로 다시 넣어도 장소·막힌 칸·의자가 지금과 같다", () => {
    current.apply(defaultLayout());
    expect(sortedTiles(current.solidTiles())).toEqual(DEFAULT_SOLID);
    expect(marksOf()).toEqual({
      board: { approach: DEFAULT_PLACES.board.approach, faceTo: DEFAULT_PLACES.board.faceTo },
      window: { approach: DEFAULT_PLACES.window.approach, faceTo: DEFAULT_PLACES.window.faceTo },
      desk: { approach: DEFAULT_PLACES.desk.approach, faceTo: DEFAULT_PLACES.desk.faceTo },
      bookcase: { approach: DEFAULT_PLACES.bookcase.approach, faceTo: DEFAULT_PLACES.bookcase.faceTo },
      door: { approach: [[4, 10.5]], faceTo: [4, 11.35] }
    });
    const c = current.chair();
    expect({ pull: r4(c.pull), seat: pt(c.seat), side: pt(c.side), seatHeight: r4(c.seatHeight) }).toEqual({
      pull: 0.5,
      seat: [1.5, 6.45],
      side: [2.15, 6.55],
      seatHeight: 0.67
    });
  });
});

// ---------- T1 일기 책상을 오른쪽으로 1칸 ----------

describe("[spec] 064-① 범위 3 T1: 일기 책상을 오른쪽으로 1칸(가운데 (2.5, 5.5)) 옮기면 딸린 것이 모두 x +1", () => {
  const layout = () => layoutWith((l) => (l.floor.desk = { x: 2.5, z: 5.5, facing: 0 }));

  it("T1-1: 책상 그림 (2.5, 5.5)·의자 (2.5, 5.95), 막힌 칸 \"1,5\" \"2,5\" \"3,5\", 장소(서는 자리 (2.5, 6.75), 바라볼 지점 (2.5, 5.5), 이름표 (2.5, 2.1, 5.5)), 의자 자리가 x +1", () => {
    const g = current.geometry(layout());
    expect(piecesByName(g.pieces)).toEqual({
      ...DEFAULT_PIECES,
      desk: { x: 2.5, y: 0, z: 5.5, rotY: 0 },
      chair: { x: 2.5, y: 0, z: 5.95, rotY: angle(Math.PI) }
    });
    expect(sortedTiles(g.solidTiles)).toEqual(["0,2", "1,5", "2,5", "3,5", "7,3"]);
    expect(placesOf(g)).toEqual({ ...DEFAULT_PLACES, desk: { approach: [[2.5, 6.75]], faceTo: [2.5, 5.5], label: [2.5, 2.1, 5.5] } });
    expect(chairOf(g)).toEqual({ ...DEFAULT_CHAIR, home: [2.5, 5.95], seat: [2.5, 6.45], side: [3.15, 6.55] });
  });

  it("T1-2: 넣으면 막힌 칸·장소 데이터·의자가 따라가고, 칸 \"0,5\"는 지나갈 수 있고 \"3,5\"는 막힌다", () => {
    current.apply(layout());
    expect(sortedItems(current.active())).toEqual(sortedItems(layout()));
    expect(sortedTiles(current.solidTiles())).toEqual(["0,2", "1,5", "2,5", "3,5", "7,3"]);
    expect({ free05: current.isBlocked(0.5, 5.5), blocked35: current.isBlocked(3.5, 5.5) }).toEqual({ free05: false, blocked35: true });
    expect(marksOf().desk).toEqual({ approach: [[2.5, 6.75]], faceTo: [2.5, 5.5] });
    expect(pt(current.chair().seat)).toEqual([2.5, 6.45]);
    expect(pt(current.chair().side)).toEqual([3.15, 6.55]);
  });

  it("T1-3: 넣으면 일기 책상 구역이 새 서는 자리를 가운데로 옮겨지고, 걸어가면 (2.5, 6.75)에 서서 (2.5, 5.5)를 본다", () => {
    current.apply(layout());
    expect({ at: current.markZoneAt(2.5, 6.75), old: current.markZoneAt(1.0, 6.75) }).toEqual({ at: "desk", old: null });
    expect(walkTo("desk")).toEqual({ result: "walk", at: [2.5, 6.75], arrived: "desk", heading: angle(Math.atan2(2.5 - 2.5, 5.5 - 6.75)) });
  });

  it("T1-4: 넣으면 들어가기 동작이 (3.15, 6.55)로 비켜섰다가 (2.5, 6.45)에 앉고, 판을 연 동안 책상(뒤)을 본다", () => {
    current.apply(layout());
    expect(chairScene({ x: 2.5, z: 6.75 })).toEqual({
      started: true,
      side: [3.15, 6.55],
      seat: [2.5, 6.45],
      hold: { phase: "hold", heading: angle(Math.PI) },
      back: [2.5, 6.75],
      arrived: "desk",
      heading: angle(Math.atan2(2.5 - 2.5, 5.5 - 6.75))
    });
  });
});

// ---------- T2 책장을 왼쪽 벽을 따라 앞으로 ----------

describe("[spec] 064-① 범위 3 T2: 책장을 왼쪽 벽을 따라 z 2.5 → 8.5(가운데 (0.5, 8.5))로 옮기면 딸린 것이 z +6", () => {
  const layout = () => layoutWith((l) => (l.floor.bookcase = { x: 0.5, z: 8.5, facing: 1 }));

  it("T2-1: 책장 그림 (0.438, 8.5), 막힌 칸 \"0,2\" → \"0,8\", 장소(서는 자리 (1.4, 8.5), 바라볼 지점 (0, 8.5), 이름표 (0.9, 2.3, 8.5))", () => {
    const g = current.geometry(layout());
    expect(piecesByName(g.pieces)).toEqual({ ...DEFAULT_PIECES, bookcase: { x: 0.438, y: 0, z: 8.5, rotY: angle(Math.PI / 2) } });
    expect(sortedTiles(g.solidTiles)).toEqual(["0,5", "0,8", "1,5", "2,5", "7,3"]);
    expect(placesOf(g)).toEqual({ ...DEFAULT_PLACES, bookcase: { approach: [[1.4, 8.5]], faceTo: [0, 8.5], label: [0.9, 2.3, 8.5] } });
    expect(chairOf(g)).toEqual(DEFAULT_CHAIR);
  });

  it("T2-2: 넣으면 책장 구역이 벽(0, 8.5)까지 이어지고 옛 자리는 구역이 아니며, 걸어가면 (1.4, 8.5)에 서서 왼쪽 벽을 본다", () => {
    current.apply(layout());
    expect(sortedTiles(current.solidTiles())).toEqual(["0,5", "0,8", "1,5", "2,5", "7,3"]);
    expect({ wall: current.markZoneAt(0.1, 8.5), at: current.markZoneAt(1.4, 8.5), old: current.markZoneAt(1.4, 2.5) }).toEqual({
      wall: "bookcase",
      at: "bookcase",
      old: null
    });
    expect(marksOf().bookcase).toEqual({ approach: [[1.4, 8.5]], faceTo: [0, 8.5] });
    expect(walkTo("bookcase")).toEqual({ result: "walk", at: [1.4, 8.5], arrived: "bookcase", heading: angle(-Math.PI / 2) });
  });
});

// ---------- T3 창문을 뒷벽을 따라 ----------

function shiftPanes(list: { points: [number, number][]; origin: [number, number]; u: [number, number]; v: [number, number] }[], dx: number) {
  const s = ([x, z]: [number, number]): [number, number] => [r4(x + dx), z];
  return list.map((p) => ({ points: p.points.map(s), origin: s(p.origin), u: p.u, v: p.v }));
}

function panes(list: WindowLightPane[]) {
  return list.map((p) => ({ points: p.points.map(pt), origin: pt(p.origin), u: pt(p.u), v: pt(p.v) }));
}

/** 처음 배치 창문의 정오 무렵(남 35도) 바닥 창문 빛(lobby3d-layout-initial.spec W1). */
const NOON_PANES: { points: [number, number][]; origin: [number, number]; u: [number, number]; v: [number, number] }[] = [
  { points: [[3.865, 1.7923], [4.76, 1.7923], [4.76, 2.9206], [3.865, 2.9206]], origin: [3.865, 1.7923], u: [0.895, 0], v: [0, 1.1282] },
  { points: [[3.865, 3.0348], [4.76, 3.0348], [4.76, 4.1631], [3.865, 4.1631]], origin: [3.865, 3.0348], u: [0.895, 0], v: [0, 1.1282] },
  { points: [[4.84, 1.7923], [5.735, 1.7923], [5.735, 2.9206], [4.84, 2.9206]], origin: [4.84, 1.7923], u: [0.895, 0], v: [0, 1.1282] },
  { points: [[4.84, 3.0348], [5.735, 3.0348], [5.735, 4.1631], [4.84, 4.1631]], origin: [4.84, 3.0348], u: [0.895, 0], v: [0, 1.1282] }
];

describe("[spec] 064-① 범위 3 T3: 창문을 뒷벽을 따라 x 4.8 → 6.3으로 옮기면 딸린 것과 창문 빛이 x +1.5", () => {
  const layout = () => layoutWith((l) => (l.wall.window = { wall: "back", along: 6.3 }));

  it("T3-1: 창문 그림 (6.3, 2.05, 0.17), 장소(서는 자리 (6.0, 1.55)·(6.6, 1.55), 바라볼 지점 (6.3, 0), 이름표 (6.3, 3.05, 0.3)). 막힌 칸은 그대로", () => {
    const g = current.geometry(layout());
    expect(piecesByName(g.pieces)).toEqual({ ...DEFAULT_PIECES, window: { x: 6.3, y: 2.05, z: 0.17, rotY: 0 } });
    expect(sortedTiles(g.solidTiles)).toEqual(DEFAULT_SOLID);
    expect(placesOf(g)).toEqual({ ...DEFAULT_PLACES, window: { approach: [[6.0, 1.55], [6.6, 1.55]], faceTo: [6.3, 0], label: [6.3, 3.05, 0.3] } });
  });

  it("T3-2: 3D 목록(furniturePlacements)의 창문 자리가 (6.3, 2.05, 0.17)이고, 그 자리로 구한 정오 무렵 창문 빛 네 칸이 처음 배치보다 x +1.5", () => {
    const place = current.placements(layout()).find((p) => p.piece === "window");
    expect(place && { x: r4(place.x), y: r4(place.y), z: r4(place.z), rotY: angle(place.rotY), mark: place.mark }).toEqual({
      x: 6.3,
      y: 2.05,
      z: 0.17,
      rotY: 0,
      mark: "window"
    });
    expect(panes(current.windowLightPanes(layout(), { elevation: 35, azimuth: 180 }))).toEqual(shiftPanes(NOON_PANES, 1.5));
  });

  it("T3-3: 넣으면 창가 장소가 따라가고, 걸어가면 (6.0, 1.55)에 서서 (6.3, 0)을 본다", () => {
    current.apply(layout());
    expect(marksOf().window).toEqual({ approach: [[6.0, 1.55], [6.6, 1.55]], faceTo: [6.3, 0] });
    expect({ wall: current.markZoneAt(6.3, 0.1), old: current.markZoneAt(4.0, 0.6) }).toEqual({ wall: "window", old: null });
    expect(walkTo("window")).toEqual({ result: "walk", at: [6.0, 1.55], arrived: "window", heading: angle(Math.atan2(6.3 - 6.0, 0 - 1.55)) });
  });
});

// ---------- T4 옷장·깔개 ----------

describe("[spec] 064-① 범위 3 T4: 옷장·깔개를 옮기면 막힌 칸만 바뀌고(깔개는 막지 않음) 장소는 그대로", () => {
  it("T4-1: 옷장을 오른쪽 벽을 따라 (7.5, 8.5)로: 그림 (7.562, 8.5), 막힌 칸 \"7,3\" → \"7,8\", 장소·의자 그대로", () => {
    const layout = layoutWith((l) => (l.floor.wardrobe = { x: 7.5, z: 8.5, facing: 3 }));
    const g = current.geometry(layout);
    expect(piecesByName(g.pieces)).toEqual({ ...DEFAULT_PIECES, wardrobe: { x: 7.562, y: 0, z: 8.5, rotY: angle(-Math.PI / 2) } });
    expect(sortedTiles(g.solidTiles)).toEqual(["0,2", "0,5", "1,5", "2,5", "7,8"]);
    expect(placesOf(g)).toEqual(DEFAULT_PLACES);
    expect(chairOf(g)).toEqual(DEFAULT_CHAIR);
    current.apply(layout);
    expect({ old: current.isBlocked(7.5, 3.5), now: current.isBlocked(7.5, 8.5) }).toEqual({ old: false, now: true });
  });

  it("T4-2: 옷장을 방 가운데 (5.5, 9.5)에 앞을 보게: 그림 뒷면이 칸 뒤 끝(z 9)이라 가운데가 (5.5, 9.438), rotY 0, 막힌 칸 \"5,9\", 옮긴 옷장은 그 옷장 장소(089-③ 03 결정 A)", () => {
    const layout = layoutWith((l) => (l.floor.wardrobe = { x: 5.5, z: 9.5, facing: 0 }));
    const g = current.geometry(layout);
    expect(piecesByName(g.pieces).wardrobe).toEqual({ x: 5.5, y: 0, z: 9.438, rotY: 0 });
    expect(sortedTiles(g.solidTiles)).toEqual(["0,2", "0,5", "1,5", "2,5", "5,9"]);
    const marked = current.placements(layout).find((p) => p.piece === "wardrobe");
    expect({ blocker: marked?.blocker ?? false, mark: marked?.mark ?? null }).toEqual({ blocker: false, mark: closetPlaceId("wardrobe") });
  });

  it("T4-3: 깔개를 (2.0, 9.0)으로: 그림만 옮겨지고 막힌 칸은 그대로", () => {
    const layout = layoutWith((l) => (l.floor.rug = { x: 2.0, z: 9.0, facing: 0 }));
    const g = current.geometry(layout);
    expect(piecesByName(g.pieces)).toEqual({ ...DEFAULT_PIECES, rug: { x: 2, y: 0.004, z: 9, rotY: 0 } });
    expect(sortedTiles(g.solidTiles)).toEqual(DEFAULT_SOLID);
    current.apply(layout);
    expect(current.isBlocked(2.0, 9.0)).toBe(false);
  });
});

// ---------- T5 일기 책상을 90도 돌림 ----------

describe("[spec] 064-① 범위 3 T5: 일기 책상을 가운데 (1.5, 5.5)에서 오른쪽(facing 1, rotY π/2)으로 돌리면 딸린 것이 가운데를 중심으로 돈다", () => {
  // 처음 배치에서 책상 가운데 (1.5, 5.5)로부터의 차이: 그림·바라볼 지점·이름표 (0, 0)(067), 의자 (0, 0.45), 서는 자리 (0, 1.25),
  // 앉는 자리 (0, 0.95), 비켜서는 자리 (0.65, 1.05), 의자를 빼는 방향 (0, 1). rotY π/2로 돌리면 (a, b) → (b, −a).
  const layout = () => layoutWith((l) => (l.floor.desk = { x: 1.5, z: 5.5, facing: 1 }));

  it("T5-1: 칸 모양 3×1이 1×3이 되어 막힌 칸이 \"1,4\" \"1,5\" \"1,6\"이다", () => {
    expect(sortedTiles(current.geometry(layout()).solidTiles)).toEqual(["0,2", "1,4", "1,5", "1,6", "7,3"]);
  });

  it("T5-2: 책상 그림 (1.5, 5.5) rotY π/2, 의자 (1.95, 5.5) rotY 3π/2, 장소(서는 자리 (2.75, 5.5), 바라볼 지점 (1.5, 5.5), 이름표 (1.5, 2.1, 5.5))", () => {
    const g = current.geometry(layout());
    expect(piecesByName(g.pieces)).toEqual({
      ...DEFAULT_PIECES,
      desk: { x: 1.5, y: 0, z: 5.5, rotY: angle(Math.PI / 2) },
      chair: { x: 1.95, y: 0, z: 5.5, rotY: angle((3 * Math.PI) / 2) }
    });
    expect(placesOf(g)).toEqual({ ...DEFAULT_PLACES, desk: { approach: [[2.75, 5.5]], faceTo: [1.5, 5.5], label: [1.5, 2.1, 5.5] } });
  });

  it("T5-3: 의자 자리: 처음 (1.95, 5.5), 빼는 방향 (1, 0), 앉는 자리 (2.45, 5.5), 비켜서는 자리 (2.55, 4.85), 판을 연 동안 방향 3π/2(−x, 책상 쪽)", () => {
    expect(chairOf(current.geometry(layout()))).toEqual({
      home: [1.95, 5.5],
      pullDir: [1, 0],
      pull: 0.5,
      seat: [2.45, 5.5],
      side: [2.55, 4.85],
      seatHeight: 0.67,
      heading: angle((3 * Math.PI) / 2)
    });
  });

  it("T5-4: 넣으면 칸 \"1,4\"·\"1,6\"이 막히고 \"0,5\"·\"2,5\"는 지나갈 수 있으며, 걸어가면 (2.75, 5.5)에 서서 (1.5, 5.5)를 본다", () => {
    current.apply(layout());
    expect({
      t14: current.isBlocked(1.5, 4.5),
      t16: current.isBlocked(1.5, 6.5),
      t05: current.isBlocked(0.5, 5.5),
      t25: current.isBlocked(2.5, 5.5)
    }).toEqual({ t14: true, t16: true, t05: false, t25: false });
    expect(marksOf().desk).toEqual({ approach: [[2.75, 5.5]], faceTo: [1.5, 5.5] });
    expect({ at: current.markZoneAt(2.75, 5.5), old: current.markZoneAt(1.5, 6.75) }).toEqual({ at: "desk", old: null });
    expect(walkTo("desk")).toEqual({ result: "walk", at: [2.75, 5.5], arrived: "desk", heading: angle(Math.atan2(1.5 - 2.75, 5.5 - 5.5)) });
  });

  it("T5-5: 넣으면 들어가기 동작이 (2.55, 4.85)로 비켜섰다가 (2.45, 5.5)에 앉고, 판을 연 동안 책상 쪽(3π/2)을 본다", () => {
    current.apply(layout());
    expect(chairScene({ x: 2.75, z: 5.5 })).toEqual({
      started: true,
      side: [2.55, 4.85],
      seat: [2.45, 5.5],
      hold: { phase: "hold", heading: angle((3 * Math.PI) / 2) },
      back: [2.75, 5.5],
      arrived: "desk",
      heading: angle(Math.atan2(1.5 - 2.75, 5.5 - 5.5))
    });
  });
});

// ---------- T6 게시판을 옆벽에 ----------

describe("[spec] 064-① 범위 3 T6: 게시판을 옆벽에 걸면 그 벽을 따라 방 안쪽을 본다", () => {
  // 처음 배치(뒷벽)에서 바라볼 지점 (1.8, 0)으로부터의 차이: 서는 자리 (−0.2, 1.3)·(0.4, 1.3), 그림 (0, 0.06)(높이 1.75), 이름표 (0, 0.3)(높이 2.75).
  // 왼벽은 rotY π/2로 (a, b) → (b, −a), 오른벽은 rotY −π/2로 (a, b) → (−b, a).
  it("T6-1: 왼벽 z 8.5: 그림 (0.06, 1.75, 8.5) rotY π/2, 바라볼 지점 (0, 8.5), 서는 자리 (1.3, 8.7)·(1.3, 8.1), 이름표 (0.3, 2.75, 8.5)", () => {
    const g = current.geometry(layoutWith((l) => (l.wall.board = { wall: "left", along: 8.5 })));
    expect(piecesByName(g.pieces)).toEqual({ ...DEFAULT_PIECES, board: { x: 0.06, y: 1.75, z: 8.5, rotY: angle(Math.PI / 2) } });
    expect(sortedTiles(g.solidTiles)).toEqual(DEFAULT_SOLID);
    expect(placesOf(g)).toEqual({ ...DEFAULT_PLACES, board: { approach: [[1.3, 8.7], [1.3, 8.1]], faceTo: [0, 8.5], label: [0.3, 2.75, 8.5] } });
  });

  it("T6-2: 오른벽 z 9: 그림 (7.94, 1.75, 9) rotY −π/2, 바라볼 지점 (8, 9), 서는 자리 (6.7, 8.8)·(6.7, 9.4), 이름표 (7.7, 2.75, 9)", () => {
    const g = current.geometry(layoutWith((l) => (l.wall.board = { wall: "right", along: 9 })));
    expect(piecesByName(g.pieces)).toEqual({ ...DEFAULT_PIECES, board: { x: 7.94, y: 1.75, z: 9, rotY: angle(-Math.PI / 2) } });
    expect(placesOf(g)).toEqual({ ...DEFAULT_PLACES, board: { approach: [[6.7, 8.8], [6.7, 9.4]], faceTo: [8, 9], label: [7.7, 2.75, 9] } });
  });

  it("T6-3: 왼벽 z 8.5에 걸고 넣으면 게시판 구역이 벽까지 이어지고, 걸어가면 (1.3, 8.7)에 서서 벽 위 (0, 8.5)를 본다", () => {
    current.apply(layoutWith((l) => (l.wall.board = { wall: "left", along: 8.5 })));
    expect(marksOf().board).toEqual({ approach: [[1.3, 8.7], [1.3, 8.1]], faceTo: [0, 8.5] });
    expect({ wall: current.markZoneAt(0.1, 8.5), old: current.markZoneAt(1.8, 0.1) }).toEqual({ wall: "board", old: null });
    expect(walkTo("board")).toEqual({ result: "walk", at: [1.3, 8.7], arrived: "board", heading: angle(Math.atan2(0 - 1.3, 8.5 - 8.7)) });
  });

  it("T6-4: 오른벽 z 9에 걸고 넣으면 걸어가서 (6.7, 8.8)에 서서 벽 위 (8, 9)를 본다", () => {
    current.apply(layoutWith((l) => (l.wall.board = { wall: "right", along: 9 })));
    expect(current.markZoneAt(7.9, 9)).toBe("board");
    expect(walkTo("board")).toEqual({ result: "walk", at: [6.7, 8.8], arrived: "board", heading: angle(Math.atan2(8 - 6.7, 9 - 8.8)) });
  });
});

// ---------- T7 창문을 옆벽에(자리와 장소만. 창문 빛·창밖은 ④) ----------

describe("[spec] 064-① 범위 3 T7: 창문을 오른벽 z 8에 걸면 자리·장소가 그 벽을 따라 방 안쪽을 본다(창문 빛·창밖은 ④)", () => {
  // 처음 배치(뒷벽)에서 바라볼 지점 (4.8, 0)으로부터의 차이: 서는 자리 (−0.3, 1.55)·(0.3, 1.55), 그림 (0, 0.17)(높이 2.05), 이름표 (0, 0.3)(높이 3.05).
  it("T7-1: 그림 (7.83, 2.05, 8) rotY −π/2, 바라볼 지점 (8, 8), 서는 자리 (6.45, 7.7)·(6.45, 8.3), 이름표 (7.7, 3.05, 8)", () => {
    const g = current.geometry(layoutWith((l) => (l.wall.window = { wall: "right", along: 8 })));
    expect(piecesByName(g.pieces)).toEqual({ ...DEFAULT_PIECES, window: { x: 7.83, y: 2.05, z: 8, rotY: angle(-Math.PI / 2) } });
    expect(placesOf(g)).toEqual({ ...DEFAULT_PLACES, window: { approach: [[6.45, 7.7], [6.45, 8.3]], faceTo: [8, 8], label: [7.7, 3.05, 8] } });
  });
});

// ---------- 되돌리기 ----------

describe("[spec] 064-① 범위 3: 처음 배치로 되돌리기", () => {
  it("R1: 바꾼 배치를 넣은 뒤 처음 배치를 넣으면 막힌 칸·장소·의자가 처음 값으로 돌아온다", () => {
    current.apply(layoutWith((l) => (l.floor.desk = { x: 1.5, z: 5.5, facing: 1 })));
    current.apply(current.defaultLayout());
    expect(sortedItems(current.active())).toEqual(sortedItems(newDefaultLayout()));
    expect(sortedTiles(current.solidTiles())).toEqual(DEFAULT_SOLID);
    expect(marksOf().desk).toEqual({ approach: [[1.5, 6.75]], faceTo: [1.5, 5.5] });
    expect(pt(current.chair().seat)).toEqual([1.5, 6.45]);
    expect(pt(current.chair().side)).toEqual([2.15, 6.55]);
  });
});
