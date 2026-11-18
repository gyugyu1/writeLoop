// 바깥 마을 땅의 꽃·풀 장식(3D 모델)과 계절 흩뿌림(낙엽·꽃잎·잎, 납작한 그림 판)을 둘 자리. 정해진 씨앗값으로 늘 같은 자리를 준다.
// 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다. 좌표는 마을 칸 단위(x 왼쪽→오른쪽, z 뒤→앞).
// - 장식: 걸을 수 있는 풀밭에 몇 개씩 모아 심는다. 길 경계와 막힌 칸(건물·나무·바위·소품·가장자리)에서 떨어뜨린다.
// - 계절 흩뿌림: 봄 꽃잎·여름 잎은 마을 땅에 흩되, 자리마다 빽빽한 정도를 부드러운 잡음으로 달리한다. 가을 낙엽은 단풍이 드는 A 그루 둘레에만
//   떨어뜨린다(밑동에 가까울수록 빽빽하다). 길과 건물 땅 위, 경계 원 밖에는 두지 않는다. 겨울에는 없다(눈).
import type { Season } from "./daylight";
import { VILLAGE, VILLAGE_BOUNDARY, VILLAGE_BUILDINGS, VILLAGE_PATH_RECTS, VILLAGE_SOLID_TILES } from "./village";
import { pathCells, pointInLoop, roundedPathShapes, type PathPoint } from "./village-paths";
import { villageTreeSpots } from "./village-trees";

export type VillageDecorKind = "flowerWhite" | "flowerYellow" | "flowerPink" | "flowerRed" | "clover" | "grassTuft";

export interface VillageDecorSpot {
  kind: VillageDecorKind;
  x: number;
  z: number;
  /** 세로축 둘레 돌림(라디안). */
  turn: number;
  /** 모델 크기 배율(1 = 모델 그대로). */
  scale: number;
}

export interface VillageScatterPiece {
  /** 조각 그림 모음(4×4 칸)의 칸 번호 0~15(왼쪽 위부터 줄마다). 가을 0~7, 봄 8~11, 여름 12~15. */
  kind: number;
  x: number;
  z: number;
  turn: number;
  /** 조각 판의 한 변(칸). */
  size: number;
  /** 밝기 배율(1 = 그림 그대로). */
  shade: number;
}

/** 계절마다 쓰는 조각 칸, 칸당 가장 빽빽할 때의 수(가을이 가장 많다), 씨앗값. 겨울은 없다. */
const SCATTER_SEASONS: Record<Exclude<Season, "winter">, { kinds: number[]; maxPerCell: number; seed: number }> = {
  autumn: { kinds: [0, 1, 2, 3, 4, 5, 6, 7], maxPerCell: 2.4, seed: 4049 },
  spring: { kinds: [8, 9, 10, 11], maxPerCell: 1.4, seed: 5051 },
  summer: { kinds: [12, 13, 14, 15], maxPerCell: 0.8, seed: 6067 }
};

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 0~1 해시와 부드러운 잡음(빽빽한 정도). */
function hash(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function smoothNoise(x: number, z: number, seed: number): number {
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
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

export interface PathIndex {
  /** 점이 둥근 길 안인가. */
  inside(x: number, z: number): boolean;
  /** 점에서 둥근 길 경계까지의 거리. 경계에서 SEG_REACH칸 넘게 떨어지면 Infinity. */
  distance(x: number, z: number): number;
}

let pathIndexCache: PathIndex | null = null;
/** 길 경계 변을 둘레 몇 칸까지의 칸에 넣어 둘지. 이 거리 안에서는 경계까지의 거리를 정확히 잰다(땅 무늬 섞기의 맨땅이 약 2.4칸까지 바랜다). */
const SEG_REACH = 3;

/** 둥근 길 경계를 칸별로 나눠 두고 가까운 변만 견주는 색인(땅 무늬 섞기의 맨땅 자리도 쓴다). */
export function villagePathIndex(): PathIndex {
  if (pathIndexCache) return pathIndexCache;
  const shapes = roundedPathShapes(VILLAGE_PATH_RECTS);
  const loops: { outer: PathPoint[]; holes: PathPoint[][] }[] = shapes.map((s) => ({
    outer: s.outer.map((p) => [p.x, p.z] as const),
    holes: s.holes.map((h) => h.map((p) => [p.x, p.z] as const))
  }));
  const segs = new Map<string, [number, number, number, number][]>();
  const addSeg = (a: PathPoint, b: PathPoint) => {
    const c0 = Math.floor(Math.min(a[0], b[0])) - SEG_REACH;
    const c1 = Math.floor(Math.max(a[0], b[0])) + SEG_REACH;
    const r0 = Math.floor(Math.min(a[1], b[1])) - SEG_REACH;
    const r1 = Math.floor(Math.max(a[1], b[1])) + SEG_REACH;
    for (let c = c0; c <= c1; c += 1) {
      for (let r = r0; r <= r1; r += 1) {
        const k = `${c},${r}`;
        const list = segs.get(k) ?? [];
        list.push([a[0], a[1], b[0], b[1]]);
        segs.set(k, list);
      }
    }
  };
  for (const l of loops) {
    for (const loop of [l.outer, ...l.holes]) loop.forEach((p, i) => addSeg(p, loop[(i + 1) % loop.length]));
  }
  const near = pathCells(VILLAGE_PATH_RECTS);
  pathIndexCache = {
    inside(x, z) {
      // 길 칸에서 두 칸 넘게 떨어진 점은 길 밖이다(둥근 경계는 칸 밖으로 0.5칸 안만 나간다)
      let close = false;
      for (let c = Math.floor(x) - 2; c <= Math.floor(x) + 2 && !close; c += 1) for (let r = Math.floor(z) - 2; r <= Math.floor(z) + 2; r += 1) if (near.has(`${c},${r}`)) close = true;
      if (!close) return false;
      return loops.some((l) => pointInLoop([x, z], l.outer) && !l.holes.some((h) => pointInLoop([x, z], h)));
    },
    distance(x, z) {
      const list = segs.get(`${Math.floor(x)},${Math.floor(z)}`);
      if (!list) return Infinity;
      let best = Infinity;
      for (const [ax, az, bx, bz] of list) {
        const dx = bx - ax;
        const dz = bz - az;
        const len2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
        best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
      }
      return best;
    }
  };
  return pathIndexCache;
}

/** 점에서 막힌 칸들까지 가장 짧은 거리(2칸 넘으면 2). */
function solidDistance(x: number, z: number): number {
  let best = 2;
  for (let c = Math.floor(x) - 2; c <= Math.floor(x) + 2; c += 1) {
    for (let r = Math.floor(z) - 2; r <= Math.floor(z) + 2; r += 1) {
      if (!VILLAGE_SOLID_TILES.has(`${c},${r}`)) continue;
      const dx = Math.max(c - x, 0, x - (c + 1));
      const dz = Math.max(r - z, 0, z - (r + 1));
      best = Math.min(best, Math.hypot(dx, dz));
    }
  }
  return best;
}

/** 장식을 둘 수 있는 자리인가: 마을 안, 막힌 칸이 아니고 길 밖이며, 길 경계와 막힌 칸에서 CLEAR칸 넘게 떨어진다. */
const DECOR_CLEAR = 0.6;
function decorFits(x: number, z: number): boolean {
  if (!(x > 1 && x < VILLAGE.width - 1 && z > 1 && z < VILLAGE.depth - 1)) return false;
  if (VILLAGE_SOLID_TILES.has(`${Math.floor(x)},${Math.floor(z)}`)) return false;
  if (solidDistance(x, z) <= DECOR_CLEAR) return false;
  const paths = villagePathIndex();
  return !paths.inside(x, z) && paths.distance(x, z) > DECOR_CLEAR;
}

/** 무리마다 주로 심는 꽃(나머지 몇 개는 클로버·풀 포기). */
const CLUSTER_FLOWERS: readonly VillageDecorKind[] = ["flowerWhite", "flowerYellow", "flowerPink", "flowerRed"];
/** 무리 가운데끼리 띄울 거리(칸). 무리 반지름 약 1.3칸 + 이웃 판정 1.5칸보다 넉넉하다. */
const CLUSTER_GAP = 5;

let decorCache: VillageDecorSpot[] | null = null;

/** 꽃·풀 장식 자리(마을 안 약 100~150개, 6~10개씩 모인 무리). 늘 같은 결과다. */
export function villageDecorSpots(): VillageDecorSpot[] {
  if (decorCache) return decorCache.map((s) => ({ ...s }));
  const rnd = seeded(2027);
  const centers: { x: number; z: number }[] = [];
  const spots: VillageDecorSpot[] = [];
  let tries = 0;
  while (spots.length < 125 && tries < 4000) {
    tries += 1;
    const cx = 2 + rnd() * (VILLAGE.width - 4);
    const cz = 2 + rnd() * (VILLAGE.depth - 4);
    if (!decorFits(cx, cz) || centers.some((c) => Math.hypot(c.x - cx, c.z - cz) < CLUSTER_GAP)) continue;
    const main = CLUSTER_FLOWERS[centers.length % CLUSTER_FLOWERS.length];
    const want = 6 + Math.floor(rnd() * 5);
    const members: VillageDecorSpot[] = [];
    for (let k = 0; k < want * 6 && members.length < want; k += 1) {
      // 앞서 심은 것 가까이(0.5~1.1칸)에 이어 심어 무리를 이룬다
      const from = members.length ? members[Math.floor(rnd() * members.length)] : { x: cx, z: cz };
      const a = rnd() * Math.PI * 2;
      const d = members.length ? 0.5 + rnd() * 0.6 : 0;
      const x = from.x + Math.cos(a) * d;
      const z = from.z + Math.sin(a) * d;
      if (Math.hypot(x - cx, z - cz) > 1.6 || !decorFits(x, z)) continue;
      if (members.some((m) => Math.hypot(m.x - x, m.z - z) < 0.42)) continue;
      const roll = rnd();
      const kind: VillageDecorKind = roll < 0.7 ? main : roll < 0.85 ? "clover" : "grassTuft";
      members.push({ kind, x, z, turn: rnd() * Math.PI * 2, scale: 0.75 + rnd() * 0.35 });
    }
    if (members.length < 4) continue;
    centers.push({ x: cx, z: cz });
    spots.push(...members);
  }
  decorCache = spots;
  return spots.map((s) => ({ ...s }));
}

const scatterCache = new Map<Season, VillageScatterPiece[]>();

/** 낙엽이 떨어지는 범위: 수관 반폭(모델 원본 0.92칸) × 그루 배율 × 1.6. */
const LEAF_CROWN_HALF = 0.92;
const LEAF_REACH = 1.6;
/** 나무 밑 낙엽은 마을 전체에 흩던 때보다 빽빽하게(밑동 칸에 최대 maxPerCell × 2장). */
const LEAF_DENSITY = 2;
let leafTrees: { x: number; z: number; reach: number }[] | null = null;

/** 자리 (x, z)의 낙엽 빽빽한 정도 0~1: 가장 가까운 A 그루 밑동에서 1, 떨어지는 범위 끝에서 0. */
function leafFall(x: number, z: number): number {
  leafTrees ??= villageTreeSpots()
    .filter((t) => t.species === "A")
    .map((t) => ({ x: t.x, z: t.z, reach: LEAF_CROWN_HALF * t.scale * LEAF_REACH }));
  let best = 0;
  for (const t of leafTrees) {
    const dx = x - t.x;
    const dz = z - t.z;
    if (Math.abs(dx) > t.reach || Math.abs(dz) > t.reach) continue;
    const f = 1 - Math.hypot(dx, dz) / t.reach;
    if (f > best) best = f;
  }
  return best <= 0 ? 0 : best ** 0.8;
}

/** 계절 흩뿌림 조각 자리. 칸마다 빽빽한 정도(부드러운 잡음)만큼 찍고, 종류·방향·크기·밝기를 조금씩 달리한다. 계절마다 늘 같은 결과이고 겨울에는 빈 목록이다. */
export function villageSeasonScatter(season: Season): VillageScatterPiece[] {
  if (season === "winter") return [];
  const cached = scatterCache.get(season);
  if (cached) return cached.map((m) => ({ ...m }));
  const conf = SCATTER_SEASONS[season];
  const rnd = seeded(conf.seed);
  const paths = villagePathIndex();
  const pieces: VillageScatterPiece[] = [];
  for (let c = 0; c < VILLAGE.width; c += 1) {
    for (let r = 0; r < VILLAGE.depth; r += 1) {
      // 빽빽한 정도: 큰 얼룩(약 9칸)과 작은 얼룩(약 3칸)을 섞은 0~1 값 → 칸당 0~maxPerCell개
      const n = smoothNoise(c / 9, r / 9, 11) * 0.7 + smoothNoise(c / 3, r / 3, 23) * 0.3;
      // 가을은 A 그루 둘레(밑동에 가까울수록 빽빽하게)에만, 작은 얼룩으로 조금 고르지 않게 한다
      const density =
        season === "autumn"
          ? leafFall(c + 0.5, r + 0.5) * (0.6 + 0.4 * smoothNoise(c / 3, r / 3, 23)) * conf.maxPerCell * LEAF_DENSITY
          : Math.max(0, (n - 0.25) / 0.75) ** 1.4 * conf.maxPerCell;
      let count = Math.floor(density);
      if (rnd() < density - count) count += 1;
      for (let k = 0; k < count; k += 1) {
        const x = c + rnd();
        const z = r + rnd();
        const size = 0.3 + rnd() * 0.25;
        const half = size / 2;
        if (VILLAGE_BUILDINGS.some((b) => x > b.rect[0] - half && x < b.rect[2] + half && z > b.rect[1] - half && z < b.rect[3] + half)) continue;
        if (paths.inside(x, z) || paths.distance(x, z) < half) continue;
        if (season === "autumn" && leafFall(x, z) <= 0) continue;
        pieces.push({ kind: conf.kinds[Math.floor(rnd() * conf.kinds.length)], x, z, turn: rnd() * Math.PI * 2, size, shade: 0.85 + rnd() * 0.3 });
      }
    }
  }
  // 경계 원 밖(숲 밑)의 조각은 다 계산한 뒤 뺀다(원 안 조각의 자리·종류는 그대로 두려고 난수 순서를 바꾸지 않는다)
  const kept = pieces.filter((m) => Math.hypot(m.x - VILLAGE_BOUNDARY.x, m.z - VILLAGE_BOUNDARY.z) <= VILLAGE_BOUNDARY.radius);
  scatterCache.set(season, kept);
  return kept.map((m) => ({ ...m }));
}
