// 바깥 마을 나무 자리: 마을 안(배치 데이터 VILLAGE_TREES, LOD1)과 둘레 숲(경계 원 바깥, LOD2)의 그루마다 종류·크기·방향·밝기.
// 그리기(lobby3d-village)가 이 자리에 나무 모델을 찍고, 가을 낙엽(village-decor)은 A 그루 둘레에만 흩는다. 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.
import { VILLAGE_BOUNDARY, VILLAGE_TREE_KINDS, VILLAGE_TREES, type VillageTreeSpecies } from "./village";

export type { VillageTreeSpecies };

/** 그루 크기에 곱하는 값(2026-11-18 사용자 결정: 새 모델이 커서 0.9배). */
const TREE_SIZE = 0.9;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 나무 한 그루를 찍을 자리. */
export interface VillageTreeSpot {
  species: VillageTreeSpecies;
  /** 마을 안은 LOD1, 둘레 숲은 LOD2(그루 자리로 정한다. 카메라 거리로 바꾸지 않는다). */
  lod: 1 | 2;
  x: number;
  z: number;
  scale: number;
  turn: number;
  /** 잎에 곱하는 밝기(그루마다 조금씩 달라 숲이 한 색으로 보이지 않게). */
  shade: number;
}

/**
 * 마을 나무 자리(배치 데이터, 자리마다 종류가 정해져 있다)와 둘레 숲. 숲은 경계 원 바깥에 심어 마을 카메라가 보여 줄 수 있는 곳까지 채운다
 * (화면 어디에도 빈 바깥이 보이지 않게). 안쪽 가장자리는 원을 따라가되 살짝 들쭉날쭉하다.
 * 마을에서 가까이 보이는 가장자리 띠는 성기게 심어 그루마다 수관이 읽히고 사이로 풀밭이 보이게 하고, 그 뒤는 빽빽하게 심어 숲이 이어져 보이게 한다.
 * 숲은 Pine이 기본이고, A는 작은 무리(구역마다 정해진 무리 한가운데 둘레)로 섞는다.
 */
function computeTreeSpots(): VillageTreeSpot[] {
  const rnd = seeded(11);
  const spots: VillageTreeSpot[] = [];
  VILLAGE_TREES.forEach(([x, z], i) => {
    spots.push({ species: VILLAGE_TREE_KINDS[i], lod: 1, x, z, scale: (1.7 + rnd() * 0.35) * TREE_SIZE, turn: rnd() * Math.PI * 2, shade: TREE_SHADE_MIN + rnd() * TREE_SHADE_SPAN });
  });
  const { x: bx, z: bz, radius } = VILLAGE_BOUNDARY;
  // 숲 가장자리에서 바깥으로 잰 거리(그루 밑동은 늘 원 밖이다)
  const beyondEdge = (x: number, z: number) => Math.hypot(x - bx, z - bz) - forestEdge(Math.atan2(z - bz, x - bx), radius);
  const grid = (step: number, jitter: number, gap: number, near: number, far: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let x = bx - radius - FOREST_REACH_SIDE; x <= bx + radius + FOREST_REACH_SIDE; x += step) {
      for (let z = bz - radius - FOREST_REACH_BACK; z <= bz + radius + FOREST_REACH_FRONT; z += step) {
        const jx = x + (rnd() - 0.5) * jitter;
        const jz = z + (rnd() - 0.5) * jitter;
        const d = beyondEdge(jx, jz);
        if (rnd() < gap || d < near || d >= far) continue;
        out.push([jx, jz]);
      }
    }
    return out;
  };
  const band = grid(FOREST_BAND_STEP, FOREST_BAND_JITTER, FOREST_BAND_GAP, 0, FOREST_BAND);
  const back = grid(FOREST_STEP, FOREST_JITTER, FOREST_GAP, FOREST_BAND, Infinity).filter(([x, z]) =>
    band.every(([ox, oz]) => Math.hypot(x - ox, z - oz) >= FOREST_BAND_CLEAR)
  );
  for (const [x, z] of [...band, ...back]) {
    spots.push({ species: inAClump(x, z) ? "A" : "Pine", lod: 2, x, z, scale: (1.6 + rnd() * 0.5) * TREE_SIZE, turn: rnd() * Math.PI * 2, shade: TREE_SHADE_MIN + rnd() * TREE_SHADE_SPAN });
  }
  return spots;
}

/** 숲 가장자리 띠(가장자리에서 바깥으로 FOREST_BAND칸까지): 성긴 격자 간격(칸)과 흔들기 폭, 빈자리로 둘 몫. 띠 그루와 이보다 가까운 뒤쪽 그루는 뺀다. */
const FOREST_BAND = 5;
const FOREST_BAND_STEP = 3.3;
const FOREST_BAND_JITTER = 1;
const FOREST_BAND_GAP = 0.08;
const FOREST_BAND_CLEAR = 1.8;
/** 그 뒤 숲 격자 간격(칸)과 흔들기 폭, 빈자리로 둘 몫. */
const FOREST_STEP = 2;
const FOREST_JITTER = 1.2;
const FOREST_GAP = 0.06;
/** 숲의 A 무리: CLUMP_CELL칸 구역마다 CLUMP_CHANCE 확률로 무리 한가운데를 두고, 그 한가운데에서 CLUMP_RADIUS칸 안의 그루가 A다. */
const CLUMP_CELL = 7;
const CLUMP_CHANCE = 0.5;
const CLUMP_RADIUS = 2.6;

/** 0~1 해시(구역 번호와 씨앗값으로 늘 같은 값). */
function hash(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** 자리 (x, z)가 숲의 A 무리 안인지(둘레 구역의 무리 한가운데를 본다). */
function inAClump(x: number, z: number): boolean {
  const cx = Math.floor(x / CLUMP_CELL);
  const cz = Math.floor(z / CLUMP_CELL);
  for (let i = cx - 1; i <= cx + 1; i += 1) {
    for (let j = cz - 1; j <= cz + 1; j += 1) {
      if (hash(i, j, 91) >= CLUMP_CHANCE) continue;
      const ox = (i + 0.2 + 0.6 * hash(i, j, 92)) * CLUMP_CELL;
      const oz = (j + 0.2 + 0.6 * hash(i, j, 93)) * CLUMP_CELL;
      if (Math.hypot(x - ox, z - oz) < CLUMP_RADIUS) return true;
    }
  }
  return false;
}
/** 원을 감싸는 상자에서 숲을 더 심는 칸(옆·뒤·앞). 마을 카메라가 끝에서 보여 주는 바깥(옆은 화면 가로, 뒤는 화면 위 끝 너머)을 채운다. */
const FOREST_REACH_SIDE = 9;
const FOREST_REACH_BACK = 12;
const FOREST_REACH_FRONT = 4;
/** 숲 안쪽 가장자리 반지름(각도 a에서): 원 반지름 + 0~2칸. 사인 둘을 섞어 부드럽게 들쭉날쭉하다. */
function forestEdge(a: number, radius: number): number {
  return radius + 1 + 0.6 * Math.sin(3 * a + 1.3) + 0.4 * Math.sin(7 * a + 0.4);
}
/** 그루마다 잎에 곱하는 밝기 범위(0.9~1.05). */
const TREE_SHADE_MIN = 0.9;
const TREE_SHADE_SPAN = 0.15;

let cached: readonly VillageTreeSpot[] | null = null;

/** 마을 안과 둘레 숲의 나무 자리(늘 같은 결과. 한 번 계산해 두고 함께 쓴다). */
export function villageTreeSpots(): readonly VillageTreeSpot[] {
  cached ??= computeTreeSpots();
  return cached;
}
