// qa 테스트 도우미(작업 099 마을 길 둥글게): 길 칸과 둥근 경계 모양을 재는 계산.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-paths.spec.test.ts와 lobby3d-village-round-paths.spec.test.tsx가 함께 쓴다.
// 좌표는 마을 칸 단위(x 왼쪽→오른쪽, z 뒤→앞). 점은 village.ts의 VillagePoint({ x, z })다.
//
// 둥근 경계 함수의 모양(qa가 정했다. 구현은 이 모양에 맞춘다. 02-qa-tests.md "부르는 방법"):
//   모듈 @/lib/lobby3d/village-paths (apps/mobile/src/lib/lobby3d/village-paths.ts)
//   export function roundedPathShapes(rects: readonly (readonly [number, number, number, number])[]): PathShape[]
//   export interface PathShape { outer: VillagePoint[]; holes: VillagePoint[][] }
//   - rects는 배치 파일 paths와 같은 [x0, z0, x1, z1] 칸 사각형(x1·z1은 들지 않음). 겹쳐도 된다.
//   - 돌려주는 것은 이어진 길 조각마다 하나(바깥 경계 outer와 그 안의 구멍 holes). 고리는 닫힌 꺾은선이고 마지막 점이 첫 점과 같아도, 달라도 된다.
//   - 3D(three)를 쓰지 않는다. 같은 입력이면 늘 같은 결과다.
import type { VillagePoint } from "@/lib/lobby3d/village";

export type Rect = readonly [number, number, number, number];
export interface PathShape {
  outer: VillagePoint[];
  holes: VillagePoint[][];
}
export type RoundedPathShapes = (rects: readonly Rect[]) => PathShape[];

/** 사각형들이 덮는 칸("열,행"). */
export function tilesOf(rects: readonly Rect[]): Set<string> {
  const out = new Set<string>();
  for (const [x0, z0, x1, z1] of rects) for (let c = x0; c < x1; c += 1) for (let r = z0; r < z1; r += 1) out.add(`${c},${r}`);
  return out;
}

/** 고리의 끝 점이 첫 점과 같으면 뗀다. */
function openRing(ring: VillagePoint[]): VillagePoint[] {
  if (ring.length > 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a.x === b.x && a.z === b.z) return ring.slice(0, -1);
  }
  return ring;
}

/** 모든 고리(바깥과 구멍)를 닫힌 꺾은선으로. */
export function ringsOf(shapes: PathShape[]): VillagePoint[][] {
  return shapes.flatMap((s) => [openRing(s.outer), ...s.holes.map(openRing)]);
}

function inRing(ring: VillagePoint[], p: VillagePoint): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** 점이 둥근 길 안인가(어느 조각의 바깥 경계 안이고 그 조각의 구멍 안이 아님). */
export function inShapes(shapes: PathShape[], p: VillagePoint): boolean {
  return shapes.some((s) => inRing(openRing(s.outer), p) && !s.holes.some((h) => inRing(openRing(h), p)));
}

function segmentDistance(p: VillagePoint, a: VillagePoint, b: VillagePoint): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz));
}

/** 점에서 둥근 경계(모든 고리)까지의 거리. */
export function boundaryDistance(shapes: PathShape[], p: VillagePoint): number {
  let best = Infinity;
  for (const ring of ringsOf(shapes)) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) best = Math.min(best, segmentDistance(p, ring[j], ring[i]));
  }
  return best;
}

type Seg = { a: VillagePoint; b: VillagePoint };

/**
 * 많은 점을 볼 때 쓰는 빠른 판정(1칸 격자로 묶음). inside는 inShapes와 같고,
 * distance는 boundaryDistance와 같되 1칸보다 먼 경계는 보지 않는다(1칸 넘게 떨어지면 Infinity).
 */
export function shapeIndex(shapes: PathShape[]) {
  const rowsOf = (ring: VillagePoint[]) => {
    const rows = new Map<number, Seg[]>();
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      for (let r = Math.floor(Math.min(a.z, b.z)); r <= Math.floor(Math.max(a.z, b.z)); r += 1) {
        if (!rows.has(r)) rows.set(r, []);
        rows.get(r)!.push({ a, b });
      }
    }
    return rows;
  };
  const crosses = (rows: Map<number, Seg[]>, p: VillagePoint) => {
    let inside = false;
    for (const { a, b } of rows.get(Math.floor(p.z)) ?? []) {
      if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };
  const indexed = shapes.map((s) => ({ outer: rowsOf(openRing(s.outer)), holes: s.holes.map((h) => rowsOf(openRing(h))) }));
  const cells = new Map<string, Seg[]>();
  for (const ring of ringsOf(shapes)) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[j];
      const b = ring[i];
      for (let c = Math.floor(Math.min(a.x, b.x)); c <= Math.floor(Math.max(a.x, b.x)); c += 1) {
        for (let r = Math.floor(Math.min(a.z, b.z)); r <= Math.floor(Math.max(a.z, b.z)); r += 1) {
          const k = `${c},${r}`;
          if (!cells.has(k)) cells.set(k, []);
          cells.get(k)!.push({ a, b });
        }
      }
    }
  }
  return {
    inside: (p: VillagePoint) => indexed.some((s) => crosses(s.outer, p) && !s.holes.some((h) => crosses(h, p))),
    distance: (p: VillagePoint) => {
      let best = Infinity;
      const c0 = Math.floor(p.x);
      const r0 = Math.floor(p.z);
      for (let c = c0 - 1; c <= c0 + 1; c += 1) {
        for (let r = r0 - 1; r <= r0 + 1; r += 1) for (const { a, b } of cells.get(`${c},${r}`) ?? []) best = Math.min(best, segmentDistance(p, a, b));
      }
      return best <= 1 ? best : Infinity;
    }
  };
}

/** 점에서 길 칸(합친 모양)까지의 거리. 칸 안이면 0. */
export function tileDistance(tiles: Set<string>, p: VillagePoint): number {
  let best = Infinity;
  const c0 = Math.floor(p.x);
  const r0 = Math.floor(p.z);
  for (let c = c0 - 2; c <= c0 + 2; c += 1) {
    for (let r = r0 - 2; r <= r0 + 2; r += 1) {
      if (!tiles.has(`${c},${r}`)) continue;
      const dx = Math.max(c - p.x, 0, p.x - (c + 1));
      const dz = Math.max(r - p.z, 0, p.z - (r + 1));
      best = Math.min(best, Math.hypot(dx, dz));
    }
  }
  return best;
}

export interface Corner {
  x: number;
  z: number;
  /** 모서리에서 길 쪽(볼록) 또는 빈 쪽(오목)으로 가는 대각선 방향(각 성분 ±1). */
  dx: number;
  dz: number;
}

/**
 * 격자 점마다 둘레 네 칸을 보고 모서리를 찾는다.
 * - 볼록(바깥 모서리, 길 끝 포함): 네 칸 중 길이 하나. 방향은 그 길 칸 쪽.
 * - 오목(안쪽 모서리): 네 칸 중 길이 셋. 방향은 빈 칸 쪽.
 * 대각선으로만 맞닿은 점(두 칸이 대각선)은 명세가 정하지 않아 어느 쪽에도 넣지 않는다.
 */
export function cornersOf(tiles: Set<string>): { convex: Corner[]; concave: Corner[] } {
  const convex: Corner[] = [];
  const concave: Corner[] = [];
  const cols = [...tiles].map((t) => Number(t.split(",")[0]));
  const rows = [...tiles].map((t) => Number(t.split(",")[1]));
  for (let x = Math.min(...cols); x <= Math.max(...cols) + 1; x += 1) {
    for (let z = Math.min(...rows); z <= Math.max(...rows) + 1; z += 1) {
      const quads = [
        { dx: -1, dz: -1, on: tiles.has(`${x - 1},${z - 1}`) },
        { dx: 1, dz: -1, on: tiles.has(`${x},${z - 1}`) },
        { dx: -1, dz: 1, on: tiles.has(`${x - 1},${z}`) },
        { dx: 1, dz: 1, on: tiles.has(`${x},${z}`) }
      ];
      const on = quads.filter((q) => q.on);
      if (on.length === 1) convex.push({ x, z, dx: on[0].dx, dz: on[0].dz });
      if (on.length === 3) {
        const off = quads.find((q) => !q.on)!;
        concave.push({ x, z, dx: off.dx, dz: off.dz });
      }
    }
  }
  return { convex, concave };
}

/** 모서리에서 대각선 방향으로 s(칸)만큼 간 점. 대각선 거리 s는 각 축으로 s/√2다. */
export function alongDiagonal(c: Corner, s: number): VillagePoint {
  const k = s / Math.SQRT2;
  return { x: c.x + c.dx * k, z: c.z + c.dz * k };
}

/** 모서리에서 대각선으로 0~1칸을 0.005칸씩 걸으며, 점이 처음으로 길 안(wantInside true) 또는 길 밖(false)이 되는 거리. 없으면 null. */
export function firstAlongDiagonal(shapes: PathShape[], c: Corner, wantInside: boolean): number | null {
  for (let i = 0; i <= 200; i += 1) {
    const s = i * 0.005;
    if (inShapes(shapes, alongDiagonal(c, s)) === wantInside) return s;
  }
  return null;
}
