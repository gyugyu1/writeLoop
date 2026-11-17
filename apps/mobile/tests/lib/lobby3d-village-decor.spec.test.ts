// [spec] qa 테스트(작업 101 마을 땅 무늬, 기능 변경, 모바일): 꽃·풀 장식 자리(villageDecorSpots)와 풀 자국 자리(villageGrassMarks)의 규칙.
// 기대값은 명세(private 작업 폴더 101-2026-11-17-마을-땅-무늬/01-main-spec.md의 3)와 03 결정(01의 1·3을 바꿈)에서만 가져온다.
// 함수의 모양은 qa가 정했다(tests/__fixtures__/village-decor-101.ts 머리말, 04-qa-tests.md "부르는 방법"). 구현 전에는 모듈이 없어 모두 실패한다(바뀔 동작).
// 명세에 수가 없어 qa가 정한 값(04-qa-tests.md "가정"): 장식의 "그 둘레" = 둥근 길 경계와 막힌 칸에서 0.5칸, "몇 개씩 모임" = 1.5칸 안 이웃,
// 자국의 "조금씩 달리" = 다른 값 10가지 이상·밝기 0.6~1.4, "빽빽한 정도를 다르게" = 5칸 네모 구역의 자국 밀도 상위 10%가 하위 10%의 2배 이상.
import { VILLAGE, VILLAGE_BUILDINGS, VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { DECOR_KINDS, clusterSizes, decorModule, freshDecorModule, solidDistance } from "../__fixtures__/village-decor-101";
import { shapeIndex, tilesOf, type PathShape, type Rect, type RoundedPathShapes } from "../__fixtures__/village-paths-099";

function pathShapes(): PathShape[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/lobby3d/village-paths") as { roundedPathShapes: RoundedPathShapes };
  return mod.roundedPathShapes(LAYOUT.paths as unknown as Rect[]);
}

const percentile = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

describe("[spec] 101 바뀔 동작: 꽃·풀 장식 자리(01의 3, 03 결정 3)", () => {
  it("D1 자리는 정해진 씨앗값으로 늘 같다: 두 번 불러도, 모듈을 새로 읽어 불러도 같은 목록이다", () => {
    const a = decorModule().villageDecorSpots();
    const b = decorModule().villageDecorSpots();
    const c = freshDecorModule().villageDecorSpots();
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("D2 마을 안에 대략 100~150개다", () => {
    const n = decorModule().villageDecorSpots().length;
    expect(n).toBeGreaterThanOrEqual(100);
    expect(n).toBeLessThanOrEqual(150);
  });

  it("D3 종류는 꽃 무리(흰·노랑·분홍·빨강), 클로버, 풀 포기 여섯 가지이고 모두 쓰인다", () => {
    const spots = decorModule().villageDecorSpots();
    expect([...new Set(spots.map((s) => s.kind))].sort()).toEqual([...DECOR_KINDS].sort());
    for (const s of spots) {
      expect({ kind: s.kind, finite: [s.x, s.z, s.turn, s.scale].every(Number.isFinite), scalePositive: s.scale > 0 }).toEqual({ kind: s.kind, finite: true, scalePositive: true });
    }
  });

  it("D4 걸을 수 있는 풀밭에만 둔다: 마을 안, 막힌 칸(건물·나무·바위·소품·가장자리)이 아닌 칸, 둥근 길 밖이고, 길 경계와 막힌 칸에서 0.5칸 넘게 떨어진다", () => {
    const spots = decorModule().villageDecorSpots();
    const index = shapeIndex(pathShapes());
    const wrong = spots
      .map((s) => {
        const p = { x: s.x, z: s.z };
        const problems: string[] = [];
        if (!(s.x > 0 && s.x < VILLAGE.width && s.z > 0 && s.z < VILLAGE.depth)) problems.push("마을 밖");
        if (VILLAGE_SOLID_TILES.has(`${Math.floor(s.x)},${Math.floor(s.z)}`)) problems.push("막힌 칸");
        if (index.inside(p)) problems.push("길 안");
        else if (index.distance(p) < 0.5) problems.push(`길에서 ${index.distance(p).toFixed(2)}`);
        if (solidDistance(p) < 0.5) problems.push(`막힌 칸에서 ${solidDistance(p).toFixed(2)}`);
        return problems.length ? `${s.kind} ${s.x.toFixed(2)},${s.z.toFixed(2)}: ${problems.join(", ")}` : null;
      })
      .filter((w): w is string => w !== null);
    expect(wrong).toEqual([]);
  });

  it("D5 몇 개씩 모여 있다: 80% 이상이 1.5칸 안에 다른 장식이 있고, 무리(1.5칸 안 이웃으로 이음)는 10개 이상이며 가장 큰 무리도 15개 이하다", () => {
    const spots = decorModule().villageDecorSpots();
    const withNeighbor = spots.filter((s, i) => spots.some((t, j) => j !== i && Math.hypot(s.x - t.x, s.z - t.z) <= 1.5)).length;
    expect(withNeighbor / spots.length).toBeGreaterThanOrEqual(0.8);
    const sizes = clusterSizes(spots, 1.5);
    expect(sizes.length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(15);
  });
});

describe("[spec] 101 바뀔 동작: 풀 자국 자리(03 결정 1)", () => {
  it("M1 자리는 정해진 씨앗값으로 늘 같다: 두 번 불러도, 모듈을 새로 읽어 불러도 같은 목록이고, 자국이 있다", () => {
    const a = decorModule().villageGrassMarks();
    expect(a.length).toBeGreaterThan(0);
    expect(decorModule().villageGrassMarks()).toEqual(a);
    expect(freshDecorModule().villageGrassMarks()).toEqual(a);
  });

  it("M2 자국은 여러 종류(3가지 이상)이고, 자국마다 방향·크기·밝기가 조금씩 다르다(각각 다른 값 10가지 이상, 밝기 0.6~1.4, 크기는 양수)", () => {
    const marks = decorModule().villageGrassMarks();
    for (const m of marks) {
      expect({
        kind: Number.isInteger(m.kind) && m.kind >= 0,
        finite: [m.x, m.z, m.turn, m.size, m.shade].every(Number.isFinite),
        size: m.size > 0,
        shade: m.shade >= 0.6 && m.shade <= 1.4
      }).toEqual({ kind: true, finite: true, size: true, shade: true });
    }
    expect(new Set(marks.map((m) => m.kind)).size).toBeGreaterThanOrEqual(3);
    const distinct = (f: (m: (typeof marks)[number]) => number) => new Set(marks.map((m) => f(m).toFixed(4))).size;
    expect({ turn: distinct((m) => m.turn) >= 10, size: distinct((m) => m.size) >= 10, shade: distinct((m) => m.shade) >= 10 }).toEqual({
      turn: true,
      size: true,
      shade: true
    });
  });

  it("M3 길·건물 땅 위에는 두지 않는다: 자국 가운데가 둥근 길 밖에서 경계까지 자국 반 변(size/2) 이상 떨어지고, 건물 땅을 반 변만큼 넓힌 네모 밖이다", () => {
    const marks = decorModule().villageGrassMarks();
    const index = shapeIndex(pathShapes());
    const wrong = marks
      .map((m) => {
        const p = { x: m.x, z: m.z };
        const half = m.size / 2;
        const problems: string[] = [];
        if (index.inside(p)) problems.push("길 안");
        else if (index.distance(p) < half) problems.push(`길에서 ${index.distance(p).toFixed(2)} < ${half.toFixed(2)}`);
        for (const b of VILLAGE_BUILDINGS) {
          const [x0, z0, x1, z1] = b.rect;
          if (m.x > x0 - half && m.x < x1 + half && m.z > z0 - half && m.z < z1 + half) problems.push(`건물 ${b.id}`);
        }
        return problems.length ? `${m.x.toFixed(2)},${m.z.toFixed(2)} size ${m.size.toFixed(2)}: ${problems.join(", ")}` : null;
      })
      .filter((w): w is string => w !== null);
    expect(wrong.slice(0, 20)).toEqual([]);
  });

  it("M4 자리마다 빽빽한 정도가 다르다: 마을 안 5칸 네모 구역(풀 칸 10개 이상)의 풀 칸당 자국 수에서 상위 10%가 하위 10%의 2배 이상이다", () => {
    const marks = decorModule().villageGrassMarks();
    const pathTiles = tilesOf(LAYOUT.paths as unknown as Rect[]);
    const densities: number[] = [];
    for (let bx = 0; bx + 5 <= VILLAGE.width; bx += 5) {
      for (let bz = 0; bz + 5 <= VILLAGE.depth; bz += 5) {
        let grass = 0;
        for (let c = bx; c < bx + 5; c += 1) for (let r = bz; r < bz + 5; r += 1) if (!VILLAGE_SOLID_TILES.has(`${c},${r}`) && !pathTiles.has(`${c},${r}`)) grass += 1;
        if (grass < 10) continue;
        const count = marks.filter((m) => m.x >= bx && m.x < bx + 5 && m.z >= bz && m.z < bz + 5).length;
        densities.push(count / grass);
      }
    }
    expect(densities.length).toBeGreaterThan(20);
    const high = percentile(densities, 0.9);
    const low = percentile(densities, 0.1);
    expect({ high: high > 0, ratio: high >= 2 * low }).toEqual({ high: true, ratio: true });
  });
});
