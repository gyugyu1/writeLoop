// 바깥 마을 나무 자리: 마을 안(배치 데이터 VILLAGE_TREES, LOD1)과 둘레 숲(경계 원 바깥, LOD2)의 그루마다 종류·크기·방향·밝기.
// 그리기(lobby3d-village)가 이 자리에 나무 모델을 찍고, 가을 낙엽(village-decor)은 A 그루 둘레에만 흩는다. 3D 그리기와 떨어져 있어 테스트에서 바로 부를 수 있다.
import { VILLAGE_BOUNDARY, VILLAGE_TREES } from "./village";

/** 나무 종류: A(둥근 활엽수, 가을에 단풍이 들고 겨울에 잎이 진다), Pine(소나무, 늘 푸르다). 나무 모델(tree-models)의 종류와 같다. */
export type VillageTreeSpecies = "A" | "Pine";

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
 * 마을 나무 자리(배치 데이터)와 둘레 숲. 숲은 경계 원 바깥에 빽빽하게(FOREST_STEP칸 격자에 흔들기) 심어,
 * 마을 카메라가 보여 줄 수 있는 곳까지 채운다(화면 어디에도 빈 바깥이 보이지 않게). 안쪽 가장자리는 원을 따라가되 살짝 들쭉날쭉하다.
 */
function computeTreeSpots(): VillageTreeSpot[] {
  const rnd = seeded(11);
  const spots: VillageTreeSpot[] = [];
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rnd() * items.length)];
  for (const [x, z] of VILLAGE_TREES) {
    spots.push({ species: pick(VILLAGE_TREE_SPECIES), lod: 1, x, z, scale: (1.7 + rnd() * 0.35) * TREE_SIZE, turn: rnd() * Math.PI * 2, shade: TREE_SHADE_MIN + rnd() * TREE_SHADE_SPAN });
  }
  const { x: bx, z: bz, radius } = VILLAGE_BOUNDARY;
  for (let x = bx - radius - FOREST_REACH_SIDE; x <= bx + radius + FOREST_REACH_SIDE; x += FOREST_STEP) {
    for (let z = bz - radius - FOREST_REACH_BACK; z <= bz + radius + FOREST_REACH_FRONT; z += FOREST_STEP) {
      const jx = x + (rnd() - 0.5) * FOREST_JITTER;
      const jz = z + (rnd() - 0.5) * FOREST_JITTER;
      // 숲 가장자리: 원 반지름에 각도마다 부드럽게 바뀌는 0~2칸을 더한 곳부터 바깥(그루 밑동은 늘 원 밖이다)
      const inside = Math.hypot(jx - bx, jz - bz) < forestEdge(Math.atan2(jz - bz, jx - bx), radius);
      if (inside || rnd() < FOREST_GAP) continue;
      spots.push({ species: pick(FOREST_TREE_SPECIES), lod: 2, x: jx, z: jz, scale: (1.6 + rnd() * 0.5) * TREE_SIZE, turn: rnd() * Math.PI * 2, shade: TREE_SHADE_MIN + rnd() * TREE_SHADE_SPAN });
    }
  }
  return spots;
}

/** 둘레 숲 격자 간격(칸)과 흔들기 폭, 빈자리로 둘 몫. */
const FOREST_STEP = 2;
const FOREST_JITTER = 1.2;
const FOREST_GAP = 0.06;
/** 원을 감싸는 상자에서 숲을 더 심는 칸(옆·뒤·앞). 마을 카메라가 끝에서 보여 주는 바깥(옆은 화면 가로, 뒤는 화면 위 끝 너머)을 채운다. */
const FOREST_REACH_SIDE = 9;
const FOREST_REACH_BACK = 12;
const FOREST_REACH_FRONT = 4;
/** 숲 안쪽 가장자리 반지름(각도 a에서): 원 반지름 + 0~2칸. 사인 둘을 섞어 부드럽게 들쭉날쭉하다. */
function forestEdge(a: number, radius: number): number {
  return radius + 1 + 0.6 * Math.sin(3 * a + 1.3) + 0.4 * Math.sin(7 * a + 0.4);
}
/** 마을 안에 섞어 심는 나무(A 70%·Pine 30%)와 둘레 숲 나무(Pine 65%·A 35%). 한 번 뽑기로 고른다(자리 계산의 난수 순서를 지킨다). */
const VILLAGE_TREE_SPECIES: readonly VillageTreeSpecies[] = [..."AAAAAAA", "Pine", "Pine", "Pine"] as VillageTreeSpecies[];
const FOREST_TREE_SPECIES: readonly VillageTreeSpecies[] = [...Array<VillageTreeSpecies>(13).fill("Pine"), ...Array<VillageTreeSpecies>(7).fill("A")];
/** 그루마다 잎에 곱하는 밝기 범위(0.9~1.05). */
const TREE_SHADE_MIN = 0.9;
const TREE_SHADE_SPAN = 0.15;

let cached: readonly VillageTreeSpot[] | null = null;

/** 마을 안과 둘레 숲의 나무 자리(늘 같은 결과. 한 번 계산해 두고 함께 쓴다). */
export function villageTreeSpots(): readonly VillageTreeSpot[] {
  cached ??= computeTreeSpots();
  return cached;
}
