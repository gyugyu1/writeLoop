// 마을 길의 둥근 경계. 길 칸(사각형들을 합친 칸 모양)의 경계를 따라가 꺾이는 곳을 둥글게 다듬고, 곧은 가장자리를 살짝 굽이치게 한다.
// 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다. 좌표는 마을 칸 단위(x 왼쪽→오른쪽, z 뒤→앞).
// 바깥 모서리(길이 꺾여 나가는 볼록한 곳)와 길 끝은 깎고, 안쪽 모서리(안으로 파인 곳)는 채운다.

import type { VillagePoint } from "./village";

export type PathRect = readonly [number, number, number, number];
export type PathPoint = readonly [number, number];

export interface PathOutline {
  /** 바깥 경계. 고리는 길이 진행 방향의 오른쪽(normalOf의 반대쪽)에 오도록 돈다. */
  outer: PathPoint[];
  /** 구멍(광장 가운데처럼 길에 둘러싸인 풀밭). */
  holes: PathPoint[][];
}

export interface PathOutlineOptions {
  /** 바깥 모서리 반지름(칸). */
  outerRadius?: number;
  /** 안쪽 모서리 반지름(칸). */
  innerRadius?: number;
  /** 곧은 가장자리의 굽이 크기(칸, 바깥·안쪽으로 이만큼까지). */
  wobble?: number;
  /** 굽이 씨앗값. 같은 값이면 늘 같은 모양이다. */
  seed?: number;
  /** 둥근 모서리 한 곳을 나누는 조각 수. */
  arcSegments?: number;
  /** 곧은 가장자리를 나누는 간격(칸). */
  step?: number;
}

export const PATH_OUTLINE_DEFAULTS = {
  outerRadius: 1.0,
  innerRadius: 0.7,
  wobble: 0.1,
  seed: 7,
  arcSegments: 6,
  step: 0.5
} as const;

const key = (x: number, z: number) => `${x},${z}`;

/** 사각형들이 덮는 칸("x,z": 칸의 왼쪽 위 모서리). */
export function pathCells(rects: readonly PathRect[]): Set<string> {
  const cells = new Set<string>();
  for (const [x0, z0, x1, z1] of rects) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x += 1) for (let z = Math.floor(z0); z < Math.ceil(z1); z += 1) cells.add(key(x, z));
  }
  return cells;
}

type V = [number, number];

/**
 * 칸 모양의 경계를 꼭짓점 고리들로 따라간다. 칸 변 하나하나를 길 칸이 늘 같은 쪽에 오는 방향 변으로 모으고 이어 붙인다
 * (바깥 경계와 구멍 모두 길이 진행 방향의 오른쪽, 곧 normalOf의 반대쪽이다).
 * 한 점에서 나가는 변이 둘(칸이 대각선으로만 닿는 곳)이면 길 쪽으로 가장 많이 꺾는 변을 골라 두 칸을 따로 둘러싼다.
 */
function traceLoops(cells: Set<string>): V[][] {
  // 방향 변: 시작 점 → 끝 점. 칸마다 둘레를 같은 방향으로 돌아, 이웃이 없는 변만 남긴다.
  const out = new Map<string, V[]>();
  const add = (a: V, b: V) => {
    const k = key(a[0], a[1]);
    const list = out.get(k) ?? [];
    list.push(b);
    out.set(k, list);
  };
  const has = (x: number, z: number) => cells.has(key(x, z));
  for (const c of cells) {
    const [x, z] = c.split(",").map(Number);
    // 칸 (x,z)~(x+1,z+1). 이웃이 없으면 그 변이 경계다.
    if (!has(x, z - 1)) add([x + 1, z], [x, z]); // 위 변: 오른쪽 → 왼쪽
    if (!has(x - 1, z)) add([x, z], [x, z + 1]); // 왼쪽 변: 위 → 아래
    if (!has(x, z + 1)) add([x, z + 1], [x + 1, z + 1]); // 아래 변: 왼쪽 → 오른쪽
    if (!has(x + 1, z)) add([x + 1, z + 1], [x + 1, z]); // 오른쪽 변: 아래 → 위
  }
  const loops: V[][] = [];
  const takeNext = (from: V, at: V): V | undefined => {
    const list = out.get(key(at[0], at[1]));
    if (!list || list.length === 0) return undefined;
    let pick = 0;
    if (list.length > 1) {
      // 들어온 방향에 대해 외적이 가장 큰 변(지금 칸을 감싸 도는 쪽)
      const din: V = [at[0] - from[0], at[1] - from[1]];
      let best = -Infinity;
      list.forEach((to, i) => {
        const dout: V = [to[0] - at[0], to[1] - at[1]];
        const cross = din[0] * dout[1] - din[1] * dout[0];
        if (cross > best) {
          best = cross;
          pick = i;
        }
      });
    }
    const [next] = list.splice(pick, 1);
    return next;
  };
  // 시작 점을 정렬해 늘 같은 순서로 돈다(같은 입력이면 같은 출력)
  const starts = [...out.keys()].sort((a, b) => {
    const [ax, az] = a.split(",").map(Number);
    const [bx, bz] = b.split(",").map(Number);
    return az - bz || ax - bx;
  });
  for (const s of starts) {
    while ((out.get(s)?.length ?? 0) > 0) {
      const start = s.split(",").map(Number) as V;
      const loop: V[] = [start];
      let prev = start;
      let cur = takeNext([start[0] - 1, start[1]], start)!;
      while (!(cur[0] === start[0] && cur[1] === start[1])) {
        loop.push(cur);
        const next = takeNext(prev, cur);
        if (!next) break;
        prev = cur;
        cur = next;
      }
      loops.push(loop);
    }
  }
  // 곧게 이어지는 점을 빼고 꺾이는 점만 남긴다
  return loops.map((loop) =>
    loop.filter((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length];
      const b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    })
  );
}

/** 넓이의 부호(신발끈 공식, x·z 그대로). 이 파일의 고리 방향에서 바깥 경계는 음수, 구멍은 양수다. */
function signedArea(loop: readonly PathPoint[]): number {
  let s = 0;
  for (let i = 0; i < loop.length; i += 1) {
    const [x0, z0] = loop[i];
    const [x1, z1] = loop[(i + 1) % loop.length];
    s += x0 * z1 - x1 * z0;
  }
  return s / 2;
}

/** 0~1 사이 값을 주는 정수 해시. */
function hash(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** 자리(x, z)의 부드러운 잡음(-1~1). 자리에서 바로 정해지므로 고리를 어디서 시작하든 같은 굽이가 나온다. */
function noise(x: number, z: number, seed: number): number {
  const fx = Math.floor(x);
  const fz = Math.floor(z);
  const tx = x - fx;
  const tz = z - fz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash(fx, fz, seed);
  const b = hash(fx + 1, fz, seed);
  const c = hash(fx, fz + 1, seed);
  const d = hash(fx + 1, fz + 1, seed);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}

/** 꺾이는 점만 있는 고리를 둥근 모서리와 굽이친 가장자리를 가진 점 고리로 바꾼다. */
function roundLoop(corners: V[], o: Required<PathOutlineOptions>): PathPoint[] {
  const n = corners.length;
  const dirs = corners.map((p, i) => {
    const q = corners[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return { d: [(q[0] - p[0]) / len, (q[1] - p[1]) / len] as V, len };
  });
  // 모서리마다 반지름: 볼록(외적 < 0, 길이 꺾여 나가는 바깥 모서리)은 바깥 반지름, 오목은 안쪽 반지름. 양옆 변 길이의 절반을 넘지 않게 한다
  const radius = corners.map((_, i) => {
    const din = dirs[(i - 1 + n) % n];
    const dout = dirs[i];
    const cross = din.d[0] * dout.d[1] - din.d[1] * dout.d[0];
    const convex = cross < 0;
    const r = convex ? o.outerRadius : o.innerRadius;
    return Math.min(r, din.len / 2, dout.len / 2);
  });
  const pts: V[] = [];
  const normalOf = (d: V): V => [-d[1], d[0]]; // 진행 방향에 수직인 길 바깥쪽
  let last: V | null = null;
  // 굽이는 늘 길 바깥쪽 방향(nx, nz)으로 민다. 둥근 모서리 둘이 맞닿는 곳처럼 같은 자리가 잇달아 오면 한 번만 넣는다
  const pushWobbled = (x: number, z: number, nx: number, nz: number) => {
    if (last && Math.abs(last[0] - x) < 1e-9 && Math.abs(last[1] - z) < 1e-9) return;
    last = [x, z];
    const w = o.wobble * noise(x * 0.9, z * 0.9, o.seed);
    pts.push([x - nx * w, z - nz * w]);
  };
  for (let i = 0; i < n; i += 1) {
    const c = corners[i];
    const din = dirs[(i - 1 + n) % n].d;
    const dout = dirs[i].d;
    const r = radius[i];
    // 둥근 모서리: 들어오는 변에서 r 앞 → 나가는 변에서 r 뒤. 가운데는 S + r·dout
    const sx = c[0] - din[0] * r;
    const sz = c[1] - din[1] * r;
    const cx = sx + dout[0] * r;
    const cz = sz + dout[1] * r;
    const a0 = Math.atan2(sz - cz, sx - cx);
    const ex = c[0] + dout[0] * r;
    const ez = c[1] + dout[1] * r;
    let a1 = Math.atan2(ez - cz, ex - cx);
    // 짧은 쪽(90도)으로 돈다
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    a1 = a0 + da;
    // 둥근 모서리의 굽이 방향: 원 가운데에서 나가는 방향을 길 바깥쪽으로 맞춘 것(볼록은 그대로, 오목은 반대).
    // 모서리 양 끝에서 곧은 가장자리의 바깥쪽과 같아져 굽이가 끊기지 않는다
    const outIn = normalOf(din);
    const side = Math.cos(a0) * outIn[0] + Math.sin(a0) * outIn[1] >= 0 ? 1 : -1;
    for (let k = 0; k <= o.arcSegments; k += 1) {
      const a = a0 + (da * k) / o.arcSegments;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      pushWobbled(x, z, Math.cos(a) * side, Math.sin(a) * side);
    }
    // 곧은 가장자리: 다음 모서리의 둥근 시작까지 step 간격으로 나눈다
    const next = corners[(i + 1) % n];
    const rNext = radius[(i + 1) % n];
    const fromX = ex;
    const fromZ = ez;
    const toX = next[0] - dout[0] * rNext;
    const toZ = next[1] - dout[1] * rNext;
    const len = Math.hypot(toX - fromX, toZ - fromZ);
    const steps = Math.max(1, Math.round(len / o.step));
    const nrm = normalOf(dout);
    for (let k = 1; k < steps; k += 1) {
      const t = k / steps;
      pushWobbled(fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t, nrm[0], nrm[1]);
    }
  }
  // 고리의 끝과 처음이 같은 자리면 하나를 뺀다
  if (pts.length > 1) {
    const [fx, fz] = pts[0];
    const [lx, lz] = pts[pts.length - 1];
    if (Math.abs(fx - lx) < 1e-9 && Math.abs(fz - lz) < 1e-9) pts.pop();
  }
  return pts;
}

/** 점이 고리 안에 있는가(짝홀 규칙). */
export function pointInLoop(p: PathPoint, loop: readonly PathPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i, i += 1) {
    const [xi, zi] = loop[i];
    const [xj, zj] = loop[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** 길 사각형들로 둥근 길 경계(바깥 경계와 구멍)를 만든다. 같은 입력·옵션이면 늘 같은 결과다. */
export function buildPathOutlines(rects: readonly PathRect[], options: PathOutlineOptions = {}): PathOutline[] {
  const o: Required<PathOutlineOptions> = { ...PATH_OUTLINE_DEFAULTS, ...options };
  const loops = traceLoops(pathCells(rects));
  const rounded = loops.map((corners) => ({ corners, pts: roundLoop(corners, o), area: signedArea(corners) }));
  const outers = rounded.filter((l) => l.area < 0);
  const holes = rounded.filter((l) => l.area > 0);
  // 구멍은 그 구멍을 품은 바깥 경계 중 가장 작은 것에 넣는다(구멍 안에 또 길 섬이 있는 모양도 맞게 나눈다)
  const owner = holes.map((h) => {
    const containing = outers.filter((l) => pointInLoop(h.corners[0], l.corners));
    containing.sort((a, b) => Math.abs(a.area) - Math.abs(b.area));
    return containing[0];
  });
  return outers.map((l) => ({
    outer: l.pts,
    holes: holes.filter((_, i) => owner[i] === l).map((h) => h.pts)
  }));
}

/**
 * 고리를 길 안쪽으로 d만큼 옮긴 고리(가장자리 띠의 안쪽 선). 점마다 양옆 변의 수직 방향 평균으로 옮긴다.
 * 이 파일의 고리는 바깥 경계든 구멍이든 길이 진행 방향의 오른쪽에 오도록 돈다(칸 변을 따라간 방향 그대로). 그래서 늘 오른쪽으로 옮긴다.
 */
export function insetLoop(loop: readonly PathPoint[], d: number): PathPoint[] {
  const n = loop.length;
  const sign = -1;
  return loop.map((p, i) => {
    const a = loop[(i - 1 + n) % n];
    const b = loop[(i + 1) % n];
    const t1 = [p[0] - a[0], p[1] - a[1]];
    const t2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(t1[0], t1[1]) || 1;
    const l2 = Math.hypot(t2[0], t2[1]) || 1;
    const nx = (-t1[1] / l1 - t2[1] / l2) / 2;
    const nz = (t1[0] / l1 + t2[0] / l2) / 2;
    const nl = Math.hypot(nx, nz) || 1;
    return [p[0] + (nx / nl) * d * sign, p[1] + (nz / nl) * d * sign] as const;
  });
}

/** 둥근 길 조각 하나: 바깥 경계와 구멍(점은 마을 칸 단위 {x, z}). */
export interface PathShape {
  outer: VillagePoint[];
  holes: VillagePoint[][];
}

const toPoints = (loop: readonly PathPoint[]): VillagePoint[] => loop.map(([x, z]) => ({ x, z }));

/** 길 사각형들(배치 파일 paths, 겹쳐도 됨)로 둥근 길 조각들을 만든다. 씨앗값과 반지름은 고정값(PATH_OUTLINE_DEFAULTS)이다. 빈 입력이면 []. */
export function roundedPathShapes(rects: readonly PathRect[]): PathShape[] {
  return buildPathOutlines(rects).map((o) => ({ outer: toPoints(o.outer), holes: o.holes.map(toPoints) }));
}
