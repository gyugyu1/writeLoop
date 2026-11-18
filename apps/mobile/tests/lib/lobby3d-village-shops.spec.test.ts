/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 106 마을 가게 넣기, 기능 변경, 모바일): 마을 배치 데이터(건물·장소·길·나무·막힌 칸·가리기·말풍선).
// 기대값은 명세(private 작업 폴더 106-2026-11-18-마을-가게-넣기/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 c728f00의 지금 값이다.
// 구현 전(기준 커밋)에 쓴 테스트다. 구현 코드는 부르는 방법(village.ts의 VILLAGE_BUILDINGS·VILLAGE_PLACES·VILLAGE_PATH_RECTS·VILLAGE_SOLID_TILES·
// VILLAGE_START·occludingBuildings, engine.ts의 applyArea·isFree·findPath·markInfo·hasPlaceBubble·VILLAGE_MARK_IDS·LobbySim, village-layout.json)을 알려고만 읽었다.
// 명세에 옷집의 건물 id가 없어 옷집은 이름 "옷집"으로 찾는다(tests/__fixtures__/village-shops-106.ts의 clothingId).
// "약"이 붙은 값의 폭: 문 x ±0.3칸(가구점은 이 폭이면 지금 12.5를 받지 않는다), 라룹이 집 땅 깊이 3.3 ±0.3칸.
// "근처 빈 풀밭"(옮기는 나무)은 옛 자리에서 8칸 안이고, 건물 땅·길 칸에 걸리지 않으며, 다른 막힌 칸과 겹치지 않는 것(K2)으로 본다.
//
// 바뀔 동작(구현 전 실패): V1~V11. 그대로 둘 동작(구현 전·뒤 통과): K1~K4.
// 작업 107(라룹이 집 크기) 명세의 "그 때문에 고칠 기존 테스트"(106 테스트 가운데 집 땅을 가로 4칸·깊이 3.3으로 보는 것)와 바뀌는 동작 1
// (땅 가로 4칸 → 5칸, 땅 [33, z0, 38, 12], 깊이 약 4.2칸(z0 약 7.8), 문 x 35.5·땅 앞 z 12 그대로)로 qa가 V10을 고쳤다(107 qa 보고 02-qa-tests.md):
// - 가로 4 → 5, 깊이 약 3.3(3.0~3.6) → 약 4.2(4.1~4.3). 값은 tests/__fixtures__/village-home-size-107.ts.
// - 걸어갈 수 있는 옛 땅: x 32 열·x 38 열의 z 7~11과 z 7 줄의 x 33~37 → x 32 열·x 38 열의 z 7~11(z 7 줄은 새 집이 막는다).
// - 막힌 집 가운데: x 33~37, z 9~11 → 새 집 칸 전체 x 33~37, z 7~11.
// 작업 114(마을 벤치 모델) 명세의 "고칠 기존 테스트"(벤치 방향 rot, 벤치 막히는 칸)로 qa가 K1·K2를 고쳤다(114 qa 보고 02-qa-tests.md).
// 벤치 말고 다른 것의 기대는 그대로다(도우미·값은 tests/__fixtures__/village-bench-114.ts):
// - K1: 배치 파일을 견줄 때 벤치의 rot만 뺀다(벤치 자리는 그대로 본다).
// - K2: 견주는 칸에서 벤치가 바꿀 수 있는 곳(지금 벤치 칸과 새 벤치 칸)도 뺀다. 기대값은 587개 목록에서 지금 벤치 칸 12개를 뺀 575개(114 기준 커밋 d256ff4에서 잰 값).
import { LobbySim, VILLAGE_MARK_IDS, applyArea, findPath, hasPlaceBubble, isFree, markInfo, type FloorPoint, type PlaceId } from "@/lib/lobby3d/engine";
import { VILLAGE_BUILDINGS, VILLAGE_PATH_RECTS, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START, occludingBuildings, type VillageBuildingId } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import {
  CLOTHING_DOOR_X,
  CLOTHING_LABEL,
  CLOTHING_RECT,
  DOOR_TOLERANCE,
  EXPECTED_PATH_RECTS,
  FURNITURE_DOOR_X,
  FURNITURE_RECT,
  HOME_DOOR_X,
  HOME_FRONT_Z,
  MOVED_TREE,
  OLD_CAFE_RECT,
  OLD_LIBRARY_RECT,
  REMOVED_PATH_RECTS,
  baseLayout106,
  buildingByLabel,
  clothingId,
  goneTrees,
  newTrees,
  rectTiles,
  solidOutsideChanged,
  treeTiles,
  type Rect
} from "../__fixtures__/village-shops-106";
import { HOME_DEPTH_107, HOME_NEAR_107, HOME_WIDTH_107 } from "../__fixtures__/village-home-size-107";
import { BENCH_TILE_RECTS, SOLID_OUTSIDE_CHANGED_114, withoutBenchRot } from "../__fixtures__/village-bench-114";

/** 막힌 칸 가운데 이번 작업이 바꾸는 곳(옛 라룹이 집·카페·도서관·옷집 땅, 옮긴 나무) 밖의 칸. 기준 커밋 c728f00에서 이 테스트의 계산으로 잰 값. */
// { count: 587, sha256: "a261d8ba50c1bf7ef47178706c1f74c5d952842b04c545454301b92038299651" }. 114에서 벤치가 바꿀 수 있는 곳도 빼서 SOLID_OUTSIDE_CHANGED_114(village-bench-114.ts)로 견준다.

const LABELS = ["가구점", "라룹이 집", "옷집"].sort();
const tileCenter = (t: string): FloorPoint => {
  const [c, r] = t.split(",").map(Number);
  return { x: c + 0.5, z: r + 0.5 };
};
const tileOf = (p: FloorPoint) => `${Math.floor(p.x)},${Math.floor(p.z)}`;
const sorted = (s: Iterable<string>) => [...s].sort();

function building(label: string) {
  const found = buildingByLabel(label);
  expect({ label, found: found !== undefined }).toEqual({ label, found: true });
  return found!;
}

function place(id: string) {
  const found = VILLAGE_PLACES[id as VillageBuildingId];
  expect({ id, found: found !== undefined }).toEqual({ id, found: true });
  return found;
}

beforeEach(() => {
  applyArea("village");
});

afterEach(() => {
  applyArea("room");
});

describe("[spec] 106 바뀔 동작: 건물·장소(명세 1·2·3)", () => {
  it("V1 건물은 셋(라룹이 집·가구점·옷집)이고 카페·도서관은 없다: 앱 데이터와 배치 파일(마을 모델 스크립트가 읽는다) 모두", () => {
    expect(VILLAGE_BUILDINGS.map((b) => b.label).sort()).toEqual(LABELS);
    expect(LAYOUT.buildings.map((b) => b.label).sort()).toEqual(LABELS);
  });

  it("V2 장소(문 앞 누르기·말풍선)도 셋이다: 마을 장소 목록(VILLAGE_MARK_IDS)과 장소 자리(VILLAGE_PLACES)의 이름이 라룹이 집·가구점·옷집", () => {
    expect(VILLAGE_MARK_IDS.map((id) => markInfo(id).label).sort()).toEqual(LABELS);
    expect(Object.values(VILLAGE_PLACES).map((p) => p.label).sort()).toEqual(LABELS);
  });

  it("V3 카페·도서관 땅은 풀밭이 된다: 옛 카페 땅 [56,22,62,28]과 옛 도서관 땅 [22,45,31,48]의 모든 칸이 걸어갈 수 있다", () => {
    const blocked = sorted(rectTiles([OLD_CAFE_RECT, OLD_LIBRARY_RECT])).filter((t) => {
      const p = tileCenter(t);
      return VILLAGE_SOLID_TILES.has(t) || !isFree(p.x, p.z);
    });
    expect(blocked).toEqual([]);
  });

  it("V4 길(명세 1·3): 카페·도서관으로 가던 흙길을 빼고 광장 동쪽 길을 옷집 문 앞까지 [42,22,50,24]로 줄인다. 길 칸이 정확히 그 148칸이다", () => {
    const expected = rectTiles(EXPECTED_PATH_RECTS);
    expect(expected.size).toBe(148);
    const now = rectTiles(VILLAGE_PATH_RECTS as readonly Rect[]);
    const extra = sorted(now).filter((t) => !expected.has(t));
    const missing = sorted(expected).filter((t) => !now.has(t));
    expect({ extra, missing }).toEqual({ extra: [], missing: [] });
    const removed = sorted(rectTiles(REMOVED_PATH_RECTS)).filter((t) => now.has(t));
    expect(removed).toEqual([]);
  });

  it("V5 가구점 문(명세 2): 문 x가 약 13.0(12.7~13.3)이고 문 앞 길 [12,31,14,34] 안이다. 장소는 문 가운데를 보고 문 바로 앞(앞면 z 31에서 0.9칸)에 선다", () => {
    const shop = building("가구점");
    expect({ doorX: shop.doorX, near: Math.abs(shop.doorX - FURNITURE_DOOR_X) <= DOOR_TOLERANCE, onPath: shop.doorX > 12 && shop.doorX < 14 }).toEqual({ doorX: shop.doorX, near: true, onPath: true });
    const p = place(shop.id);
    expect({ faceTo: p.faceTo, approach: p.approach }).toEqual({ faceTo: { x: shop.doorX, z: 31 }, approach: [{ x: shop.doorX, z: 31.9 }] });
    expect(isFree(p.approach[0].x, p.approach[0].z)).toBe(true);
  });

  it("V6 옷집(명세 3): 이름 '옷집', 땅 [44,16,50,22], 층수 2, 문 x 약 49.2(48.9~49.5). 장소는 문 가운데를 보고 문 바로 앞(앞면 z 22에서 0.9칸)에 서며, 그 자리는 걸어갈 수 있고 줄인 광장 동쪽 길 위다", () => {
    const shop = building(CLOTHING_LABEL);
    expect({ rect: [...shop.rect], floors: shop.floors }).toEqual({ rect: [...CLOTHING_RECT], floors: 2 });
    expect({ doorX: shop.doorX, near: Math.abs(shop.doorX - CLOTHING_DOOR_X) <= DOOR_TOLERANCE }).toEqual({ doorX: shop.doorX, near: true });
    const p = place(shop.id);
    expect({ label: p.label, faceTo: p.faceTo, approach: p.approach }).toEqual({ label: CLOTHING_LABEL, faceTo: { x: shop.doorX, z: 22 }, approach: [{ x: shop.doorX, z: 22.9 }] });
    expect(isFree(p.approach[0].x, p.approach[0].z)).toBe(true);
    expect(rectTiles(EXPECTED_PATH_RECTS).has(tileOf(p.approach[0]))).toBe(true);
  });

  it("V7 옷집 땅은 막히고(건물 땅이 막는다), 유리는 걷기를 막지 않는다(명세 5): 땅 [44,16,50,22]의 모든 칸은 걸어갈 수 없고, 바로 앞 줄(z 22, x 44~49)은 걸어갈 수 있다", () => {
    const open = sorted(rectTiles([CLOTHING_RECT])).filter((t) => {
      const p = tileCenter(t);
      return !VILLAGE_SOLID_TILES.has(t) || isFree(p.x, p.z);
    });
    expect(open).toEqual([]);
    const front: string[] = [];
    for (let x = 44; x < 50; x += 1) if (!isFree(x + 0.5, 22.5)) front.push(`${x},22`);
    expect(front).toEqual([]);
  });

  it("V8 옷집 문 앞(명세 3·4): 라룹이 집 앞에서 옷집 장소를 누르면 그 서는 자리까지 걸어가 도착하고, 말풍선은 버튼 없이 '옷집은 곧 열려요'다", () => {
    const id = clothingId();
    const info = markInfo(id as PlaceId);
    expect({ prompt: info?.prompt, buttonLabel: info?.buttonLabel }).toEqual({ prompt: "옷집은 곧 열려요", buttonLabel: "" });
    expect(hasPlaceBubble(id as PlaceId)).toBe(true);
    const goal = place(id).approach[0];
    const path = findPath(VILLAGE_START, [goal]);
    expect(path?.[path.length - 1]).toEqual(goal);
    let now = 1_000_000;
    const sim = new LobbySim({ x: VILLAGE_START.x, z: VILLAGE_START.z, random: () => 0.5 });
    sim.pointerDown({ point: goal, mark: id as PlaceId, onCharacter: false }, 100, 100, now);
    now += 50;
    expect(sim.pointerUp(now)).toBe("walk");
    for (let i = 0; i < 800; i += 1) {
      now += 50;
      sim.update(0.05, now);
    }
    expect(Math.hypot(sim.x - goal.x, sim.z - goal.z)).toBeLessThanOrEqual(0.06);
    const snap = sim.snapshot(now);
    expect({ arrived: snap.arrived, text: snap.bubbleText, button: snap.bubbleButton }).toEqual({ arrived: id, text: "옷집은 곧 열려요", button: null });
  });

  it("V9 나무(명세 3): 옷집 땅 안의 나무 [45.7, 19.2]는 근처 빈 풀밭으로 옮긴다. 나무 수 70 그대로, 옛 자리는 없고 새 자리 하나가 있으며, 새 자리는 옛 자리에서 8칸 안이고 건물 땅·길 칸에 걸리지 않는다", () => {
    expect(LAYOUT.trees).toHaveLength(70);
    expect(LAYOUT.trees.some(([x, z]) => x === MOVED_TREE[0] && z === MOVED_TREE[1])).toBe(false);
    expect(goneTrees()).toEqual([MOVED_TREE]);
    const added = newTrees();
    expect(added).toHaveLength(1);
    const [x, z] = added[0];
    expect({ distance: Math.hypot(x - MOVED_TREE[0], z - MOVED_TREE[1]), near: Math.hypot(x - MOVED_TREE[0], z - MOVED_TREE[1]) <= 8 }).toEqual({
      distance: Math.hypot(x - MOVED_TREE[0], z - MOVED_TREE[1]),
      near: true
    });
    const taken = rectTiles([...VILLAGE_BUILDINGS.map((b) => b.rect as Rect), ...EXPECTED_PATH_RECTS]);
    expect(sorted(treeTiles(x, z)).filter((t) => taken.has(t))).toEqual([]);
  });

  it("V10 라룹이 집 땅(명세 3-1, 107 명세 1): 가로 5칸, 땅 앞 z 12, 깊이 약 4.2칸(4.1~4.3), 문 x 35.5. 줄어 남는 옛 땅(x 32 열·x 38 열의 z 7~11)은 걸어갈 수 있고, 집 칸(x 33~37, z 7~11)은 막혀 있다", () => {
    const home = VILLAGE_BUILDINGS.find((b) => b.id === "home")!;
    const [x0, z0, x1, z1] = home.rect;
    const layoutHome = LAYOUT.buildings.find((b) => b.id === "home")!;
    expect([...layoutHome.rect]).toEqual([x0, z0, x1, z1]);
    expect({ width: x1 - x0, front: z1, doorX: home.doorX }).toEqual({ width: HOME_WIDTH_107, front: HOME_FRONT_Z, doorX: HOME_DOOR_X });
    expect({ depth: z1 - z0, near: Math.abs(z1 - z0 - HOME_DEPTH_107) <= HOME_NEAR_107 }).toEqual({ depth: z1 - z0, near: true });
    const freed: string[] = [];
    for (let z = 7; z < 12; z += 1) freed.push(`32,${z}`, `38,${z}`);
    expect(freed.filter((t) => VILLAGE_SOLID_TILES.has(t) || !isFree(tileCenter(t).x, tileCenter(t).z))).toEqual([]);
    const open: string[] = [];
    for (let x = 33; x < 38; x += 1) for (let z = 7; z < 12; z += 1) if (isFree(x + 0.5, z + 0.5)) open.push(`${x},${z}`);
    expect(open).toEqual([]);
  });

  it("V11 가리기(명세 6, 지금 규칙 그대로 새 가게에도): 옷집 바로 뒤(x 47, z 15.5)에 서면 옷집만 가리는 건물이다. 2층이라 가리기 높이는 8칸(층 3칸×2 + 지붕 2칸)이고, 뒷면에서 8칸 뒤는 가리고 9칸 뒤는 가리지 않는다", () => {
    const id = clothingId();
    expect(occludingBuildings({ x: 47, z: 15.5 })).toEqual([id]);
    expect(building(CLOTHING_LABEL).height).toBe(8);
    expect(occludingBuildings({ x: 47, z: 8 })).toEqual([id]);
    expect(occludingBuildings({ x: 47, z: 7 })).toEqual([]);
  });
});

describe("[spec] 106 그대로 둘 동작: 배치 파일·막힌 칸·나무·가구점 가리기", () => {
  it("K1 배치 파일에서 건물·길·나무(와 설명) 말고는 기준 커밋과 같다(마을 크기, 분수, 가로등, 노점, 벤치, 바위, 풍차). 라룹이 집의 id·이름·문·층수와 가구점의 id·이름·땅·층수도 같다", () => {
    type Layout = typeof LAYOUT & { _comment?: string };
    const strip = (layout: Layout) => {
      // 114: 벤치의 rot은 보지 않는다(벤치 자리는 본다)
      const { buildings: _b, paths: _p, trees: _t, _comment: _c, ...rest } = withoutBenchRot(layout);
      return rest;
    };
    const base = baseLayout106() as Layout;
    expect(strip(LAYOUT as Layout)).toEqual(strip(base));
    const pick = (layout: Layout, id: string) => {
      const b = layout.buildings.find((x) => x.id === id);
      return b ? { id: b.id, label: b.label, door: id === "home" ? b.door : undefined, rect: id === "home" ? undefined : b.rect, floors: b.floors } : null;
    };
    expect(pick(LAYOUT as Layout, "home")).toEqual(pick(base, "home"));
    expect(pick(LAYOUT as Layout, "furnitureShop")).toEqual(pick(base, "furnitureShop"));
    expect([...building("가구점").rect]).toEqual([...FURNITURE_RECT]);
  });

  it("K2 막힌 칸 가운데 바뀌는 곳(옛 라룹이 집·카페·도서관·옷집 땅, 옮긴 나무가 막는 칸) 밖은 기준 커밋과 같다(개수와 목록의 sha256)", () => {
    // 114: 벤치가 바꿀 수 있는 곳도 빼고 견준다(587개 목록에서 지금 벤치 칸 12개를 뺀 575개)
    expect(solidOutsideChanged([...BENCH_TILE_RECTS])).toEqual(SOLID_OUTSIDE_CHANGED_114);
  });

  it("K3 옮기는 한 그루 말고 나무 자리는 기준 커밋 그대로다(빠진 자리가 있으면 [45.7, 19.2]뿐이고, 더해진 자리는 많아야 하나)", () => {
    const gone = goneTrees();
    expect(gone.filter(([x, z]) => !(x === MOVED_TREE[0] && z === MOVED_TREE[1]))).toEqual([]);
    expect(newTrees().length).toBeLessThanOrEqual(1);
  });

  it("K4 가리기(지금 동작): 가구점 바로 뒤(x 11, z 24.5)에 서면 가구점만 가리는 건물이고, 라룹이 집 서는 자리에서는 가리는 건물이 없다", () => {
    expect(occludingBuildings({ x: 11, z: 24.5 })).toEqual([building("가구점").id]);
    expect(occludingBuildings(VILLAGE_START)).toEqual([]);
  });
});
