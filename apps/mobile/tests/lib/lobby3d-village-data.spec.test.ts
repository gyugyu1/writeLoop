// [spec] qa 테스트(작업 088 ① 마을 장면, 새 기능, 모바일): 마을 모양과 데이터(A1~A12), 가리는 건물(O1, O2, O4).
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/02-마을-장면/02-qa-scenarios.md)와
// 결정(03-main-decision.md: 문은 모두 카메라 쪽, 가리는 건물은 반투명 / 04-main-decision.md: 벤치는 걸어갈 수 없음)에서만 가져온다.
// 구현 코드는 부르는 방법(village.ts의 VILLAGE·VILLAGE_BUILDINGS·VILLAGE_PLACES·VILLAGE_START·occludingBuildings,
// engine.ts의 applyArea·isFree·findPath·isClearLine, 물건 자리를 담은 village-layout.json)을 알려고만 읽었다.
// 명세에 숫자가 없는 자리(건물 땅, 분수, 가로등 등)는 구현의 마을 데이터를 입력으로 읽는다.
// "걸어갈 수 있음"은 마을 구역을 켠 상태의 isFree(라룹이가 그 자리에 설 수 있음)다.
// O2의 "분수 옆"은 결정 03-2("도서관 뒤로 약 5칸이 가려진다")에 맞춰 분수 뒤쪽(라룹이 집 쪽) 옆자리로 골랐다(보고 06-qa-tests.md).
import { applyArea, findPath, isClearLine, isFree, type FloorPoint } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_BUILDINGS, VILLAGE_PLACES, VILLAGE_START, occludingBuildings } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";

const PLACE_IDS = ["home", "furnitureShop", "cafe", "library"] as const;
type PlaceKey = (typeof PLACE_IDS)[number];

function spot(id: PlaceKey): FloorPoint {
  const place = VILLAGE_PLACES[id];
  expect(place.approach.length).toBeGreaterThan(0);
  return place.approach[0];
}

function building(id: PlaceKey) {
  const found = VILLAGE_BUILDINGS.find((b) => b.id === id);
  expect(found).toBeDefined();
  return found!;
}

const fountain: FloorPoint = { x: LAYOUT.fountain.x, z: LAYOUT.fountain.z };

/** 마을 칸의 모든 칸 가운데 중 걸어갈 수 있는 곳. */
function freeTileCenters(): FloorPoint[] {
  const out: FloorPoint[] = [];
  for (let c = 0; c < 28; c += 1) for (let r = 0; r < 24; r += 1) if (isFree(c + 0.5, r + 0.5)) out.push({ x: c + 0.5, z: r + 0.5 });
  return out;
}

beforeEach(() => {
  applyArea("village");
});

afterEach(() => {
  applyArea("room");
});

describe("[spec] 마을 모양과 데이터(A1~A12)", () => {
  it("A1: 마을은 가로 28칸 × 깊이 24칸", () => {
    expect({ width: VILLAGE.width, depth: VILLAGE.depth }).toEqual({ width: 28, depth: 24 });
  });

  it("A2: 장소는 정확히 넷이고 이름표는 라룹이 집·가구점·카페·도서관", () => {
    const labels = Object.values(VILLAGE_PLACES).map((p) => p.label);
    expect(labels).toHaveLength(4);
    expect([...labels].sort()).toEqual(["가구점", "도서관", "라룹이 집", "카페"].sort());
  });

  it("A3: 장소 넷의 서는 자리는 모두 걸어갈 수 있고 마을 칸 안이다", () => {
    for (const id of PLACE_IDS) {
      const p = spot(id);
      expect({ id, free: isFree(p.x, p.z), inside: p.x >= 0 && p.x <= 28 && p.z >= 0 && p.z <= 24 }).toEqual({ id, free: true, inside: true });
    }
  });

  it("A4: 문은 모두 카메라 쪽(+z)을 보고 서는 자리는 문 바로 앞이다(결정 03-1): 서는 자리 바로 뒤에 건물이 있고, 바라볼 지점은 서는 자리보다 뒤쪽이다", () => {
    for (const id of PLACE_IDS) {
      const p = spot(id);
      const behindBlocked = [0.5, 1, 1.5].some((d) => !isFree(p.x, p.z - d));
      expect({ id, behindBlocked }).toEqual({ id, behindBlocked: true });
      expect(VILLAGE_PLACES[id].faceTo.z).toBeLessThan(p.z);
    }
  });

  it("A5: 라룹이 집은 뒤쪽 가운데, 가구점은 광장 왼쪽, 카페는 광장 오른쪽, 도서관은 광장 앞쪽", () => {
    const home = spot("home");
    const shop = spot("furnitureShop");
    const cafe = spot("cafe");
    const library = spot("library");
    expect(home.z).toBeLessThan(fountain.z);
    expect(home.z).toBeLessThan(12);
    expect(shop.x).toBeLessThan(fountain.x);
    expect(fountain.x).toBeLessThan(cafe.x);
    expect(home.x).toBeGreaterThan(shop.x);
    expect(home.x).toBeLessThan(cafe.x);
    expect(library.z).toBeGreaterThan(fountain.z);
  });

  it("A6: 광장 가운데 분수 자리는 걸어갈 수 없다", () => {
    expect(isFree(fountain.x, fountain.z)).toBe(false);
  });

  it("A7: 노점·벤치·나무·가로등 기둥·바위 자리는 걸어갈 수 없다(벤치는 04 결정 2)", () => {
    const things: [string, number, number][] = [
      ...LAYOUT.lanterns.map(([x, z]) => ["가로등", x, z] as [string, number, number]),
      ...LAYOUT.stalls.map((s) => ["노점", s.x, s.z] as [string, number, number]),
      ...LAYOUT.benches.map((b) => ["벤치", b.x, b.z] as [string, number, number]),
      ...LAYOUT.trees.map(([x, z]) => ["나무", x, z] as [string, number, number]),
      ...LAYOUT.rocks.map(([x, z]) => ["바위", x, z] as [string, number, number])
    ];
    expect(things.length).toBeGreaterThan(0);
    for (const [kind, x, z] of things) expect({ kind, x, z, free: isFree(x, z) }).toEqual({ kind, x, z, free: false });
  });

  it("A7: 가로등은 넷이다(명세 '둘레에 가로등 넷')", () => {
    expect(LAYOUT.lanterns).toHaveLength(4);
  });

  it("A8: 건물 넷의 가운데 자리는 걸어갈 수 없다", () => {
    expect(VILLAGE_BUILDINGS).toHaveLength(4);
    for (const b of VILLAGE_BUILDINGS) {
      const [x0, z0, x1, z1] = b.rect;
      expect({ id: b.id, free: isFree((x0 + x1) / 2, (z0 + z1) / 2) }).toEqual({ id: b.id, free: false });
    }
  });

  it("A9: 마을 칸 바로 바깥은 걸어갈 수 없다", () => {
    for (let z = 0.5; z < 24; z += 1) {
      expect(isFree(-0.5, z)).toBe(false);
      expect(isFree(28.5, z)).toBe(false);
    }
    for (let x = 0.5; x < 28; x += 1) {
      expect(isFree(x, -0.5)).toBe(false);
      expect(isFree(x, 24.5)).toBe(false);
    }
  });

  it("A10: 걸어갈 수 있는 모든 칸에서 장소 넷의 서는 자리까지 길이 있고, 길의 끝은 그 서는 자리다", () => {
    const tiles = freeTileCenters();
    expect(tiles.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const from of tiles) {
      for (const id of PLACE_IDS) {
        const goal = spot(id);
        const path = findPath(from, [goal]);
        const last = path?.[path.length - 1];
        if (!path || !last || last.x !== goal.x || last.z !== goal.z) missing.push(`${from.x},${from.z}→${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("A11: 분수 바로 앞(분수와 도서관 사이)에서 도서관 앞쪽 문 앞까지 건물을 뚫지 않는 길이 있다(결정 03-1)", () => {
    const libraryBack = building("library").rect[1];
    let start: FloorPoint | null = null;
    for (let z = fountain.z + LAYOUT.fountain.radius; z < libraryBack; z += 0.1) {
      if (isFree(fountain.x, z)) {
        start = { x: fountain.x, z };
        break;
      }
    }
    expect(start).not.toBeNull();
    const path = findPath(start!, [spot("library")]);
    expect(path).not.toBeNull();
    let cur = start!;
    for (const p of path!) {
      expect({ from: cur, to: p, clear: isClearLine(cur, p) }).toEqual({ from: cur, to: p, clear: true });
      cur = p;
    }
    expect(cur).toEqual(spot("library"));
  });

  it("A12: 처음 나타나는 자리는 라룹이 집 서는 자리이고 카메라 쪽(방향 0)을 본다", () => {
    expect({ x: VILLAGE_START.x, z: VILLAGE_START.z }).toEqual(spot("home"));
    expect(VILLAGE_START.heading).toBe(0);
  });
});

describe("[spec] 라룹이를 가리는 건물(O1, O2, O4, 결정 03-2)", () => {
  it("O1: 도서관 바로 뒤(도서관 뒤쪽 벽에서 1칸 안)에 서면 도서관만 가리는 건물이다", () => {
    const lib = building("library");
    const back = lib.rect[1];
    let behind: FloorPoint | null = null;
    for (let z = back - 0.05; z > back - 1; z -= 0.05) {
      if (isFree(lib.doorX, z)) {
        behind = { x: lib.doorX, z };
        break;
      }
    }
    expect(behind).not.toBeNull();
    expect(occludingBuildings(behind!)).toEqual(["library"]);
  });

  it("O2: 분수 옆(건물과 떨어진 자리)과 라룹이 집 서는 자리에서는 가리는 건물이 없다", () => {
    let beside: FloorPoint | null = null;
    for (let z = fountain.z - LAYOUT.fountain.radius; z > fountain.z - 4; z -= 0.1) {
      if (isFree(fountain.x, z)) {
        beside = { x: fountain.x, z };
        break;
      }
    }
    expect(beside).not.toBeNull();
    expect(occludingBuildings(beside!)).toEqual([]);
    expect(occludingBuildings(spot("home"))).toEqual([]);
  });

  it("O4: 도서관은 광장 앞쪽 그대로다(서는 자리 z > 분수 z)", () => {
    expect(spot("library").z).toBeGreaterThan(fountain.z);
  });
});
