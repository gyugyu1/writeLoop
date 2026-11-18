// qa 테스트 도우미(작업 107 라룹이 집 크기): 라룹이 집 땅·마을 모델 안 집 크기의 기대값과, 기준 커밋과 견주는 도우미를 모은다.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다).
// 기대값은 명세(private 작업 폴더 107-2026-11-18-라룹이-집-크기/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 c4b7693의 지금 값이다.
//
// 명세 1: 땅 가로 4칸 → 5칸, 문 x 35.5·땅 앞 z 12 그대로, 땅 [33, z0, 38, 12]. 땅 깊이는 모델 비율(벽 깊이 0.7581 / 벽 가로 0.9122)로 약 4.2칸(z0 약 7.8).
//   "약"은 ±0.1칸으로 받는다(모델 비율 그대로면 깊이 5 × 0.7581 / 0.9122 = 4.155, z0 7.845. 반올림한 7.8도, 7.84·7.85도 받는다).
// 마을 모델은 벽 가로를 땅 가로에 맞춰 고르게 키우므로(build-village.py place_model: 벽 가로 가운데를 땅 가운데, 벽 앞면을 땅 앞에 둔다)
// 집 전체가 1.25배(5/4)가 된다. 기준 커밋의 마을 모델 안 집(벽 가로 4칸)에서 잰 값(tests/__fixtures__/village-glb-098.ts 도우미로 잼):
//   크기 상자 x 33.3505~37.6526(가로 4.3020), 높이 3.2712, z 8.5232~12.1083. 벽 둘레(높이 1/4 아래 점) x 33.5~37.5, z 8.6758~12(깊이 3.3242).
//   1.25배면 크기 상자 가로 5.3775, 높이 4.0890, 벽 깊이 4.1553, 벽 뒷면 z 7.8447, 처마 앞 끝 z 12.1353이다.
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { VILLAGE_BUILDINGS } from "@/lib/lobby3d/village";
import { boxOf, meshNodesUnder, parseGlb, rootIndex, worldMatrices, worldPoints, type Glb } from "./village-glb-098";
import { gitShow, type Rect } from "./village-shops-106";

/** 작업 107의 기준 커밋(명세 첫 줄). */
export const BASE_107 = "c4b7693";
export const LAYOUT_PATH_107 = "apps/mobile/src/lib/lobby3d/village-layout.json";
export const VILLAGE_GLB_PATH_107 = "apps/mobile/assets/models/lobby-village.glb";

// ---------- 명세의 값 ----------

/** 명세 1: 땅 가로 5칸, 땅 x 33~38, 문 x 35.5, 땅 앞 z 12. */
export const HOME_WIDTH_107 = 5;
export const HOME_X0_107 = 33;
export const HOME_X1_107 = 38;
export const HOME_DOOR_X_107 = 35.5;
export const HOME_FRONT_Z_107 = 12;
/** 명세 1: 땅 깊이 약 4.2칸(z0 약 7.8). "약"은 ±0.1칸. */
export const HOME_DEPTH_107 = 4.2;
export const HOME_Z0_107 = 7.8;
export const HOME_NEAR_107 = 0.1;
/** 지금 땅 가로(106)와 106 전 땅 가로. 명세 1 "106 전 6칸보다는 작다". */
export const HOME_WIDTH_NOW = 4;
export const HOME_WIDTH_BEFORE_106 = 6;
/** 집 전체 배율(명세 1 "집 전체가 1.25배"). */
export const HOME_SCALE_107 = 1.25;

/** 기준 커밋의 마을 모델 안 집에서 잰 값을 1.25배한 값(머리말). */
export const HOME_AT_5 = {
  wallDepth: 3.3242 * 1.25,
  height: 3.2712 * 1.25,
  boxWidth: 4.302 * 1.25
};

/** 명세 1의 땅 [33, z0, 38, 12]가 막는 칸(z0가 7.7~7.9면 x 33~37, z 7~11. village.ts의 칸 셈: x0·z0 내림, x1·z1 올림, 끝 칸 빼고). */
export const HOME_TILES_RECT_107: Rect = [33, 7, 38, 12];

// ---------- 기준 커밋 ----------

type Layout = typeof LAYOUT & { _comment?: string };
export const baseLayout107 = (): Layout => JSON.parse(gitShow(BASE_107, LAYOUT_PATH_107).toString("utf8")) as Layout;
export const baseVillageGlb107 = (): Glb => parseGlb(gitShow(BASE_107, VILLAGE_GLB_PATH_107));

// ---------- 집 ----------

export function homeBuilding107() {
  const found = VILLAGE_BUILDINGS.find((b) => b.id === "home");
  expect(found).toBeDefined();
  return found!;
}

export function layoutHome107() {
  const found = LAYOUT.buildings.find((b) => b.id === "home");
  expect(found).toBeDefined();
  return found!;
}

/** 마을 모델의 bld-home 아래 모든 점(세계 좌표). */
export function homePoints107(glb: Glb): [number, number, number][] {
  const root = rootIndex(glb, "bld-home");
  expect(root).toBeGreaterThanOrEqual(0);
  const nodes = meshNodesUnder(glb, root);
  expect(nodes.length).toBeGreaterThan(0);
  const m = worldMatrices(glb);
  return nodes.flatMap((i) => worldPoints(glb, i, m));
}

/** 집의 크기 상자와, build-village.py와 같은 뜻의 벽 둘레(바닥에서 높이 1/4 아래 점)의 상자. */
export function homeShape107(glb: Glb) {
  const points = homePoints107(glb);
  const box = boxOf(points);
  const wall = boxOf(points.filter(([, y]) => y - box.minY < (box.maxY - box.minY) / 4));
  return { box, wall };
}

/** 겹치지 않는 점 자리(소수 넷째 자리로 반올림). */
export function uniquePoints(points: [number, number, number][]): [number, number, number][] {
  const seen = new Map<string, [number, number, number]>();
  for (const p of points) {
    const key = p.map((n) => (Math.round(n * 1e4) / 1e4).toFixed(4)).join(",");
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()];
}

/** from의 점마다 to에 tol 안의 점이 있는지 보고, 없는 점(앞에서 몇 개)과 그 수를 돌려준다. 칸 0.01 격자로 찾는다. */
export function unmatchedPoints(from: [number, number, number][], to: [number, number, number][], tol: number) {
  const cell = 0.01;
  const grid = new Map<string, [number, number, number][]>();
  const cellOf = (n: number) => Math.floor(n / cell);
  for (const p of to) {
    const key = `${cellOf(p[0])},${cellOf(p[1])},${cellOf(p[2])}`;
    const list = grid.get(key);
    if (list) list.push(p);
    else grid.set(key, [p]);
  }
  const missing: [number, number, number][] = [];
  for (const p of from) {
    const [cx, cy, cz] = [cellOf(p[0]), cellOf(p[1]), cellOf(p[2])];
    let found = false;
    for (let dx = -1; dx <= 1 && !found; dx += 1)
      for (let dy = -1; dy <= 1 && !found; dy += 1)
        for (let dz = -1; dz <= 1 && !found; dz += 1)
          for (const q of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? [])
            if (Math.abs(q[0] - p[0]) <= tol && Math.abs(q[1] - p[1]) <= tol && Math.abs(q[2] - p[2]) <= tol) {
              found = true;
              break;
            }
    if (!found) missing.push(p);
  }
  return { count: missing.length, first: missing.slice(0, 5) };
}
