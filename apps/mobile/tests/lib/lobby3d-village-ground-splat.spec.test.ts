/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 102 마을 땅 무늬 섞기, 기능 변경, 모바일): 맨땅·이끼를 섞을 자리 지도(villageGroundPlaceMap)의 규칙.
// 기대값은 명세(private 작업 폴더 102-2026-11-17-마을-땅-무늬-섞기/01-main-spec.md "바뀌는 동작" 1)에서만 가져온다.
// 함수의 모양은 qa가 정했다(tests/__fixtures__/village-splat-102.ts 머리말, 02-qa-tests.md "부르는 방법"). 구현 전에는 모듈이 없어 모두 실패한다(바뀔 동작).
// 지도는 그래픽 카드처럼 이웃 네 픽셀을 고르게 섞어 읽는다(sampleMap). 명세에 수가 없어 qa가 정한 값(02-qa-tests.md "가정"):
// - "길 가장자리" = 둥근 길 밖으로 경계에서 0.25~0.75칸(길 판의 바래는 띠 바깥). "문 앞 둘레" = 문 가운데 앞(장소의 faceTo)에서 1.5칸 안.
// - G4(07 결정으로 고침): 문 앞 둘레의 맨땅이 길가 맨땅과 따로 섞였는지 보려고, 같은 길 거리(±0.1칸)인 문에서 4칸 넘게 떨어진 길가보다 평균 0.1 이상 많은지 본다.
//   문 앞 1.5칸 안에 풀밭 점(길 경계에서 0.25칸 넘게)이 10개 안 되는 건물(문 앞이 거의 다 길·건물)은 건너뛰고, 확인하는 건물이 둘 이상이어야 한다.
// - "섞는다" = 그곳의 맨땅·이끼 몫 평균이 0.25 이상. "~에만" = 길 칸에서 3.5칸, 문 앞에서 3칸 넘게 떨어진 곳은 맨땅 몫이 3/255 이하.
// - "나무 가까이" = 마을 나무 가운데에서 0.6~1.4칸. "생울타리 가까이" = 마을 끝(뒤쪽·양옆)에서 1~2칸 안쪽 띠.
//   이끼가 자리로 정해진다 = 나무·생울타리에서 4칸 넘게 떨어진 풀밭의 이끼 평균이 나무 둘레 평균의 절반 이하.
// - "부드럽게 섞인다" = 이웃 픽셀 사이에서 맨땅·이끼 몫이 1칸당 0.5 넘게 바뀌지 않는다(픽셀 크기에 비례, 반올림 2/255 봐줌). 픽셀 한 변은 1칸 이하.
// 작업 115 ②(숲과 땅 꾸밈) 명세의 "고칠 기존 테스트"(풀밭 무늬 자리 지도의 이끼)로 qa가 G6·G7을 고쳤다(115 ② qa 보고 03-숲과-땅-꾸밈/02-qa-tests.md).
// 115 ②는 이끼를 옛 사각형 가장자리(옛 생울타리) 대신 원 경계(가운데 (29, 26), 반지름 26. 숲 가장자리) 둘레에 짙게 한다(명세 바뀌는 동작 3).
// 마을 나무 둘레 이끼와 맨땅 규칙은 그대로다. 그래서 "생울타리 가까이"를 "원 경계 가까이"로 바꿨다:
// - G6: "생울타리 안쪽 띠(마을 끝에서 1~2칸)" 대신 "원 경계 안쪽 1칸 띠(원 가운데에서 25~26칸)". 숲 가장자리는 원에서 바깥으로 0~2칸이라,
//   원 경계로 재든 숲 가장자리로 재든 이끼가 닿는 원 바로 안쪽 띠를 골랐다. 나무에서 2칸·길에서 1칸 넘게, 건물 밖인 것은 그대로다.
// - G7: "생울타리에서 4칸 넘게" 대신 "원 경계에서 4칸 넘게 안쪽(원 가운데에서 22칸 안)". 나무에서 4칸·길 칸에서 3.5칸 넘게는 그대로다.
import { VILLAGE, VILLAGE_BUILDINGS, VILLAGE_PATH_RECTS, VILLAGE_PLACES, VILLAGE_TREES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { freshSplatModule, rectsDistance, sampleMap, splatModule, type VillageGroundPlaceMap } from "../__fixtures__/village-splat-102";
import { boundaryDistance, shapeIndex, type PathShape, type Rect, type RoundedPathShapes } from "../__fixtures__/village-paths-099";

function pathShapes(): PathShape[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/lobby3d/village-paths") as { roundedPathShapes: RoundedPathShapes };
  return mod.roundedPathShapes(LAYOUT.paths as unknown as Rect[]);
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const inVillage = (p: { x: number; z: number }) => p.x > 0 && p.x < VILLAGE.width && p.z > 0 && p.z < VILLAGE.depth;
const inBuilding = (p: { x: number; z: number }) => VILLAGE_BUILDINGS.some((b) => p.x >= b.rect[0] && p.x <= b.rect[2] && p.z >= b.rect[1] && p.z <= b.rect[3]);
const doorFronts = () => VILLAGE_BUILDINGS.map((b) => ({ id: b.id, ...VILLAGE_PLACES[b.id].faceTo }));
const treeDistance = (p: { x: number; z: number }) => Math.min(...VILLAGE_TREES.map(([x, z]) => Math.hypot(p.x - x, p.z - z)));
/** 115 ②: 원 경계(가운데 (29, 26), 반지름 26)에서 안쪽으로 잰 거리(원 밖이면 음수). 115 전에는 마을 끝 뒤쪽·양옆의 생울타리 줄에서의 거리(hedgeDistance)를 썼다. */
const circleInsideDistance = (p: { x: number; z: number }) => 26 - Math.hypot(p.x - 29, p.z - 26);

/** 0.25칸 간격으로 마을 안 점들. */
function villageGrid(step = 0.25): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let x = step / 2; x < VILLAGE.width; x += step) for (let z = step / 2; z < VILLAGE.depth; z += step) out.push({ x, z });
  return out;
}

/** 점 둘레(가로·깊이 ±r) 격자. */
function gridAround(c: { x: number; z: number }, r: number, step: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let x = c.x - r; x <= c.x + r + 1e-9; x += step) for (let z = c.z - r; z <= c.z + r + 1e-9; z += step) if (inVillage({ x, z })) out.push({ x, z });
  return out;
}

let map: VillageGroundPlaceMap;

beforeAll(() => {
  map = splatModule().villageGroundPlaceMap();
});

jest.setTimeout(120000);

describe("[spec] 102 바뀔 동작: 맨땅·이끼를 섞을 자리 지도(명세 1)", () => {
  it("G1 같은 마을이면 늘 같다: 두 번 불러도, 모듈을 새로 읽어 불러도 같은 지도다. 모양이 맞고(data 길이 = width × height × 4) 픽셀 한 변이 1칸 이하다", () => {
    const again = splatModule().villageGroundPlaceMap();
    const fresh = freshSplatModule().villageGroundPlaceMap();
    const shape = (m: VillageGroundPlaceMap) => ({
      area: [m.x0, m.z0, m.x1, m.z1],
      size: [m.width, m.height],
      integers: Number.isInteger(m.width) && Number.isInteger(m.height) && m.width > 0 && m.height > 0,
      ordered: m.x0 < m.x1 && m.z0 < m.z1,
      bytes: m.data instanceof Uint8Array && m.data.length === m.width * m.height * 4
    });
    expect(shape(map)).toEqual({ ...shape(map), integers: true, ordered: true, bytes: true });
    expect(shape(again)).toEqual(shape(map));
    expect(shape(fresh)).toEqual(shape(map));
    expect(Buffer.compare(Buffer.from(again.data), Buffer.from(map.data))).toBe(0);
    expect(Buffer.compare(Buffer.from(fresh.data), Buffer.from(map.data))).toBe(0);
    const cell = { x: (map.x1 - map.x0) / map.width, z: (map.z1 - map.z0) / map.height };
    expect({ cellX: cell.x <= 1, cellZ: cell.z <= 1 }).toEqual({ cellX: true, cellZ: true });
  });

  it("G2 지도는 마을 전체와 둘레를 덮는다(x0 ≤ 0, x1 ≥ 마을 폭, z0 ≤ 0, z1 ≥ 마을 깊이). 픽셀마다 맨땅 몫 + 이끼 몫이 1을 넘지 않는다(R + G ≤ 256)", () => {
    expect({ x0: map.x0 <= 0, z0: map.z0 <= 0, x1: map.x1 >= VILLAGE.width, z1: map.z1 >= VILLAGE.depth }).toEqual({ x0: true, z0: true, x1: true, z1: true });
    const over: string[] = [];
    for (let k = 0; k < map.width * map.height; k += 1) {
      const r = map.data[k * 4];
      const g = map.data[k * 4 + 1];
      if (r + g > 256) over.push(`${k % map.width},${Math.floor(k / map.width)} R${r} G${g}`);
    }
    expect({ count: over.length, first: over.slice(0, 10) }).toEqual({ count: 0, first: [] });
  });

  it("G3 맨땅은 길 가장자리에 섞는다: 마을 안 둥근 길 밖으로 경계에서 0.25~0.75칸 띠의 맨땅 몫 평균이 0.25 이상이다", () => {
    const index = shapeIndex(pathShapes());
    const band = villageGrid().filter((p) => {
      if (!inVillage(p) || inBuilding(p) || index.inside(p)) return false;
      const d = index.distance(p);
      return d >= 0.25 && d <= 0.75;
    });
    expect(band.length).toBeGreaterThan(500);
    const bare = band.map((p) => sampleMap(map, 0, p.x, p.z));
    expect({ points: band.length, mean: Number(mean(bare).toFixed(3)), enough: mean(bare) >= 0.25 }).toEqual({
      points: band.length,
      mean: Number(mean(bare).toFixed(3)),
      enough: true
    });
  });

  it("G4 맨땅은 건물 문 앞 둘레에 섞는다(07 결정으로 고침): 문 앞(faceTo)에서 1.5칸 안 풀밭(둥근 길·건물 땅 밖, 경계에서 0.25칸 넘게) 점이 10개 이상인 건물(둘 이상)마다, 그 점들의 맨땅 몫 평균이 0.25 이상이고, 같은 길 거리(±0.1칸)인 문에서 4칸 넘게 떨어진 길가보다 평균 0.1 이상 많다. 문 앞이 거의 다 길·건물인 건물은 건너뛴다", () => {
    const shapes = pathShapes();
    const index = shapeIndex(shapes);
    const doors = doorFronts();
    // 견줄 길가: 마을 안, 길·건물 밖, 길 경계에서 2.5칸 안, 모든 문에서 4칸 넘게 떨어진 점의 (길 거리, 맨땅 몫)
    const baseline: { d: number; bare: number }[] = [];
    for (const p of villageGrid()) {
      if (inBuilding(p) || index.inside(p) || rectsDistance(VILLAGE_PATH_RECTS, p) > 3) continue;
      if (doors.some((door) => Math.hypot(p.x - door.x, p.z - door.z) <= 4)) continue;
      const d = boundaryDistance(shapes, p);
      if (d <= 2.5) baseline.push({ d, bare: sampleMap(map, 0, p.x, p.z) });
    }
    expect(baseline.length).toBeGreaterThan(1000);
    const baselineAt = (d: number) => {
      const same = baseline.filter((b) => Math.abs(b.d - d) <= 0.1);
      return same.length >= 5 ? mean(same.map((b) => b.bare)) : null;
    };
    const result = doors.map((door) => {
      const near = gridAround(door, 1.5, 0.1)
        .filter((p) => Math.hypot(p.x - door.x, p.z - door.z) <= 1.5 && !inBuilding(p) && !index.inside(p))
        .map((p) => ({ p, d: boundaryDistance(shapes, p) }))
        .filter((q) => q.d > 0.25);
      if (near.length < 10) return { id: door.id, skipped: true };
      const bare = near.map((q) => sampleMap(map, 0, q.p.x, q.p.z));
      const base = near.map((q) => baselineAt(q.d));
      const excess = mean(bare.map((b, k) => b - (base[k] ?? 0)));
      return {
        id: door.id,
        skipped: false,
        mean: Number(mean(bare).toFixed(3)),
        excess: Number(excess.toFixed(3)),
        baselineFound: base.every((b) => b !== null),
        enough: mean(bare) >= 0.25,
        moreThanPathSide: excess >= 0.1
      };
    });
    const checked = result.filter((r) => !r.skipped);
    expect({ checked: checked.map((r) => r.id), atLeastTwo: checked.length >= 2 }).toEqual({ checked: checked.map((r) => r.id), atLeastTwo: true });
    expect(checked).toEqual(checked.map((r) => ({ ...r, baselineFound: true, enough: true, moreThanPathSide: true })));
  });

  it("G5 맨땅은 마을 안 길·문 앞 둘레에만: 지도 전체(마을 밖 둘레 포함)에서 길 칸에서 3.5칸, 문 앞에서 3칸 넘게 떨어진 픽셀의 맨땅 몫이 3/255 이하다", () => {
    const doors = doorFronts();
    const wrong: string[] = [];
    let checked = 0;
    for (let j = 0; j < map.height; j += 1) {
      for (let i = 0; i < map.width; i += 1) {
        const p = { x: map.x0 + ((i + 0.5) * (map.x1 - map.x0)) / map.width, z: map.z0 + ((j + 0.5) * (map.z1 - map.z0)) / map.height };
        if (rectsDistance(VILLAGE_PATH_RECTS, p) <= 3.5 || doors.some((d) => Math.hypot(p.x - d.x, p.z - d.z) <= 3)) continue;
        checked += 1;
        const r = map.data[(j * map.width + i) * 4];
        if (r > 3) wrong.push(`${p.x.toFixed(2)},${p.z.toFixed(2)} R${r}`);
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect({ count: wrong.length, first: wrong.slice(0, 10) }).toEqual({ count: 0, first: [] });
  });

  it("G6 나무·생울타리 가까이는 이끼(115 ②: 생울타리 대신 원 경계): 마을 나무 가운데에서 0.6~1.4칸(길에서 1칸 넘게)과, 원 경계 안쪽 1칸 띠(원 가운데에서 25~26칸, 나무에서 2칸·길에서 1칸 넘게)의 이끼 몫 평균이 각각 0.25 이상이다", () => {
    const index = shapeIndex(pathShapes());
    const awayFromPath = (p: { x: number; z: number }) => !index.inside(p) && index.distance(p) === Infinity;
    const nearTree = villageGrid().filter((p) => {
      const d = treeDistance(p);
      return inVillage(p) && d >= 0.6 && d <= 1.4 && awayFromPath(p) && !inBuilding(p);
    });
    // 115 ②: 생울타리 안쪽 띠 대신 원 경계 안쪽 1칸 띠
    const nearHedge = villageGrid().filter((p) => {
      const d = circleInsideDistance(p);
      return inVillage(p) && d >= 0 && d <= 1 && treeDistance(p) > 2 && awayFromPath(p) && !inBuilding(p);
    });
    expect({ tree: nearTree.length > 200, hedge: nearHedge.length > 200 }).toEqual({ tree: true, hedge: true });
    const treeMoss = mean(nearTree.map((p) => sampleMap(map, 1, p.x, p.z)));
    const hedgeMoss = mean(nearHedge.map((p) => sampleMap(map, 1, p.x, p.z)));
    expect({ tree: Number(treeMoss.toFixed(3)), hedge: Number(hedgeMoss.toFixed(3)), treeEnough: treeMoss >= 0.25, hedgeEnough: hedgeMoss >= 0.25 }).toEqual({
      tree: Number(treeMoss.toFixed(3)),
      hedge: Number(hedgeMoss.toFixed(3)),
      treeEnough: true,
      hedgeEnough: true
    });
  });

  it("G7 이끼는 자리로 정한다(115 ②: 생울타리 대신 원 경계): 나무에서 4칸 넘게, 원 경계에서 4칸 넘게 안쪽인 마을 안 풀밭(길 칸에서 3.5칸 넘게)의 이끼 몫 평균이 나무 둘레(G6) 평균의 절반 이하다", () => {
    const index = shapeIndex(pathShapes());
    const nearTree = villageGrid().filter((p) => {
      const d = treeDistance(p);
      return inVillage(p) && d >= 0.6 && d <= 1.4 && !index.inside(p) && index.distance(p) === Infinity && !inBuilding(p);
    });
    // 115 ②: 생울타리에서 4칸 넘게 대신 원 경계에서 4칸 넘게 안쪽
    const far = villageGrid().filter((p) => inVillage(p) && treeDistance(p) > 4 && circleInsideDistance(p) > 4 && rectsDistance(VILLAGE_PATH_RECTS, p) > 3.5 && !inBuilding(p));
    expect({ tree: nearTree.length > 200, far: far.length > 1000 }).toEqual({ tree: true, far: true });
    const treeMoss = mean(nearTree.map((p) => sampleMap(map, 1, p.x, p.z)));
    const farMoss = mean(far.map((p) => sampleMap(map, 1, p.x, p.z)));
    expect({ tree: Number(treeMoss.toFixed(3)), far: Number(farMoss.toFixed(3)), placed: farMoss <= treeMoss / 2 }).toEqual({
      tree: Number(treeMoss.toFixed(3)),
      far: Number(farMoss.toFixed(3)),
      placed: true
    });
  });

  it("G8 경계는 부드럽게 섞인다: 이웃 픽셀 사이에서 맨땅·이끼 몫이 1칸당 0.5 넘게 바뀌지 않는다(딱 끊기지 않음)", () => {
    const cellX = (map.x1 - map.x0) / map.width;
    const cellZ = (map.z1 - map.z0) / map.height;
    const limitX = 0.5 * cellX * 255 + 2;
    const limitZ = 0.5 * cellZ * 255 + 2;
    const wrong: string[] = [];
    const at = (i: number, j: number, c: number) => map.data[(j * map.width + i) * 4 + c];
    for (let j = 0; j < map.height; j += 1) {
      for (let i = 0; i < map.width; i += 1) {
        for (const c of [0, 1]) {
          if (i + 1 < map.width && Math.abs(at(i + 1, j, c) - at(i, j, c)) > limitX) wrong.push(`${"RG"[c]} x ${i},${j} ${at(i, j, c)}→${at(i + 1, j, c)}`);
          if (j + 1 < map.height && Math.abs(at(i, j + 1, c) - at(i, j, c)) > limitZ) wrong.push(`${"RG"[c]} z ${i},${j} ${at(i, j, c)}→${at(i, j + 1, c)}`);
        }
      }
    }
    expect({ count: wrong.length, first: wrong.slice(0, 10) }).toEqual({ count: 0, first: [] });
  });
});
