// qa 테스트 도우미(작업 101 마을 땅 무늬): 꽃·풀 장식 자리와 풀 자국 자리를 정하는 함수의 모양과, 자리 규칙을 재는 계산.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-decor.spec.test.ts와 lobby3d-village-ground-marks.spec.test.tsx가 함께 쓴다.
//
// 자리 함수의 모양(qa가 정했다. 구현은 이 모양에 맞춘다. 04-qa-tests.md "부르는 방법"):
//   모듈 @/lib/lobby3d/village-decor (apps/mobile/src/lib/lobby3d/village-decor.ts). 3D(three)를 쓰지 않는다. 인자 없이 부르고, 정해진 씨앗값으로 늘 같은 결과를 준다.
//   export type VillageDecorKind = "flowerWhite" | "flowerYellow" | "flowerPink" | "flowerRed" | "clover" | "grassTuft";
//   export interface VillageDecorSpot { kind: VillageDecorKind; x: number; z: number; turn: number; scale: number }
//   export function villageDecorSpots(): VillageDecorSpot[]      // 꽃 무리·클로버·풀 포기 3D 모델을 심을 자리(마을 안)
//   export interface VillageGrassMark { kind: number; x: number; z: number; turn: number; size: number; shade: number }
//   export function villageGrassMarks(): VillageGrassMark[]      // 풀 자국을 찍을 자리
//   - x, z: 마을 칸 좌표(village.ts와 같다). 그리기는 그 자리를 인스턴스의 원점(변환의 옮김 x, z)으로 찍는다.
//   - turn: 세로축(y) 둘레 돌림(라디안). scale: 장식 모델의 크기 배율(1 = 모델 그대로).
//   - 자국 kind: 자국 그림 종류 번호(0부터). size: 자국 판의 한 변(칸). shade: 밝기 배율(1 = 기본).
import { VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";

export const DECOR_KINDS = ["flowerWhite", "flowerYellow", "flowerPink", "flowerRed", "clover", "grassTuft"] as const;
export type VillageDecorKind = (typeof DECOR_KINDS)[number];
export interface VillageDecorSpot {
  kind: VillageDecorKind;
  x: number;
  z: number;
  turn: number;
  scale: number;
}
export interface VillageGrassMark {
  kind: number;
  x: number;
  z: number;
  turn: number;
  size: number;
  shade: number;
}
type DecorModule = { villageDecorSpots: () => VillageDecorSpot[]; villageGrassMarks: () => VillageGrassMark[] };

export function decorModule(): DecorModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/lobby3d/village-decor") as DecorModule;
}

/** 모듈을 새로 읽어(모듈 상태와 관계없이) 부른 결과. */
export function freshDecorModule(): DecorModule {
  let mod: DecorModule | null = null;
  jest.isolateModules(() => {
    mod = decorModule();
  });
  return mod!;
}

/** 점에서 막힌 칸(정사각형 [c, c+1]×[r, r+1])들까지의 가장 짧은 거리(2칸 넘게 떨어지면 Infinity). */
export function solidDistance(p: { x: number; z: number }): number {
  let best = Infinity;
  const c0 = Math.floor(p.x);
  const r0 = Math.floor(p.z);
  for (let c = c0 - 2; c <= c0 + 2; c += 1) {
    for (let r = r0 - 2; r <= r0 + 2; r += 1) {
      if (!VILLAGE_SOLID_TILES.has(`${c},${r}`)) continue;
      const dx = Math.max(c - p.x, 0, p.x - (c + 1));
      const dz = Math.max(r - p.z, 0, p.z - (r + 1));
      best = Math.min(best, Math.hypot(dx, dz));
    }
  }
  return best;
}

/** 점들을 linkage칸 안에 이웃이 있으면 같은 무리로 묶은 무리 크기들. */
export function clusterSizes(points: { x: number; z: number }[], linkage: number): number[] {
  const parent = points.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z) <= linkage) parent[root(i)] = root(j);
    }
  }
  const sizes = new Map<number, number>();
  points.forEach((_, i) => sizes.set(root(i), (sizes.get(root(i)) ?? 0) + 1));
  return [...sizes.values()];
}
