// qa 테스트 도우미(작업 106 마을 가게 넣기): 기준 커밋의 배치·마을 모델과 견주는 값, 이번 작업이 바꾸는 곳(빼는 건물·길, 옷집 땅, 옮기는 나무),
// 넣을 모델 파일에서 잰 값을 모은다. 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다).
// 기대값은 명세(private 작업 폴더 106-2026-11-18-마을-가게-넣기/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 c728f00의 지금 값이다.
//
// 넣을 모델(저장소 밖 파일. 테스트는 저장소 밖 파일을 읽지 않는다(CI에는 없다). 값만 옮겨 적었다):
// - 가구점 C:\WriteLoop-asset\마을-건물\가구점\단계\01-앱용-유리\furniture-shop-app.glb(601628바이트):
//   메시 둘(건물 10000삼각형 재질 building, glass 30삼각형 재질 glass(BLEND, 바탕색 알파 0.25)), 빈 노드 display-slot-1~3, 노드 변환 없음.
//   색 그림 한 장(JPEG 1024×1024, 250043바이트, sha256 FURNITURE_SHOP_MODEL.colorMapSha256).
// - 옷집 C:\WriteLoop-asset\마을-건물\옷집\단계\02-옥상-다듬기\clothing-shop-app2.glb(619632바이트):
//   메시 하나에 프리미티브 둘(building 7242삼각형, glass 16삼각형), 빈 노드 display-slot-1·2, 노드 변환 없음.
//   색 그림 한 장(JPEG 1024×1024, 221009바이트, sha256 CLOTHING_SHOP_MODEL.colorMapSha256).
// - 라룹이 집 C:\WriteLoop-asset\마을-건물\라룹이-집\단계\09-나무-프레임\laroopi-house-angular-app3.glb(462256바이트):
//   메시 하나, 프리미티브 하나, 10852삼각형, 색 그림 한 장(JPEG 1024×1024, 174035바이트, sha256 HOME_MODEL.colorMapSha256).
//   크기 상자(모델 단위) 가로 0.98108, 높이 0.746, 깊이 0.81757(가로:높이 1.31512, 가로:깊이 1.20000).
//   build-village.py의 place_model 방식(벽 둘레 = 높이 1/4 아래 점, 벽 가로를 땅 가로에 맞춰 고르게 키움)으로 벽 가로를 4칸에 맞추면
//   배율 4.38500, 벽 깊이 3.3242, 높이 3.2712다(명세 3-1 "땅 깊이 약 3.3칸").
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { VILLAGE_BUILDINGS, VILLAGE_SOLID_TILES, type VillageBuilding } from "@/lib/lobby3d/village";
import { accessorValues, meshNodesUnder, sceneRoots, type Glb } from "./village-glb-098";

export const REPO_106 = join(__dirname, "..", "..", "..", "..");
/** 작업 106의 기준 커밋(명세 첫 줄). */
export const BASE_106 = "c728f00";
export const LAYOUT_PATH_106 = "apps/mobile/src/lib/lobby3d/village-layout.json";
export const VILLAGE_GLB_PATH_106 = "apps/mobile/assets/models/lobby-village.glb";

export const gitShow = (commit: string, path: string): Buffer => execFileSync("git", ["show", `${commit}:${path}`], { cwd: REPO_106, maxBuffer: 64 * 1024 * 1024 });
export const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");

export type Rect = readonly [number, number, number, number];
type Layout = typeof LAYOUT;
export const baseLayout106 = (): Layout => JSON.parse(gitShow(BASE_106, LAYOUT_PATH_106).toString("utf8")) as Layout;

// ---------- 명세의 값 ----------

export const CLOTHING_LABEL = "옷집";
/** 명세 3: 옷집 땅. */
export const CLOTHING_RECT: Rect = [44, 16, 50, 22];
/** 명세 3: 옷집 문 x(약 49.2). "약"은 ±0.3칸으로 받는다. */
export const CLOTHING_DOOR_X = 49.2;
/** 명세 2: 가구점 땅(지금 땅 그대로)과 문 x(약 13.0, 지금 12.5). */
export const FURNITURE_RECT: Rect = [8, 25, 14, 31];
export const FURNITURE_DOOR_X = 13.0;
/** "약 13.0", "약 49.2"를 받는 폭(칸). 가구점은 이 폭이면 지금 12.5를 받지 않는다. */
export const DOOR_TOLERANCE = 0.3;
/** 명세 3-1: 라룹이 집 땅 가로 4칸, 문 x 35.5, 땅 앞 z 12, 땅 깊이 약 3.3칸(±0.3칸으로 받는다). */
export const HOME_WIDTH = 4;
export const HOME_DOOR_X = 35.5;
export const HOME_FRONT_Z = 12;
export const HOME_DEPTH = 3.3;
export const HOME_DEPTH_TOLERANCE = 0.3;

/** 지금(기준 커밋) 땅. 빼는 건물(카페·도서관)과 줄이는 라룹이 집. */
export const OLD_HOME_RECT: Rect = [32.5, 7.0, 38.5, 12];
export const OLD_CAFE_RECT: Rect = [56, 22, 62, 28];
export const OLD_LIBRARY_RECT: Rect = [22, 45, 31, 48];
/** 명세 3: 옮기는 나무(옷집 땅 안). */
export const MOVED_TREE: readonly [number, number] = [45.7, 19.2];

/**
 * 명세 1·3의 길: 지금 길 사각형에서 카페로 가던 길(광장 동쪽 길의 x 50 동쪽, 광장 남동쪽에서 카페 문 앞까지)과
 * 도서관으로 가던 길(광장 남쪽으로 내려가는 길과 도서관 앞 길)을 빼고, 광장 동쪽 길을 옷집 문 앞까지 [42, 22, 50, 24]로 줄인 것.
 * 지금 길 사각형: [35,12,37,18] [30,18,42,20] [30,26,42,28] [30,20,32,26] [40,20,42,26] [12,31,14,34] [12,32,30,34] [28,27,30,34]
 * [42,22,56,24](광장 동쪽 길) [56,28,59,30](카페 문 앞) [42,28,59,30](광장 남동쪽 → 카페) [26,34,28,48](광장 남쪽으로 내려가는 길) [26,48,28,50] [20,48,33,50](도서관 앞 길).
 */
export const EXPECTED_PATH_RECTS: readonly Rect[] = [
  [35, 12, 37, 18],
  [30, 18, 42, 20],
  [30, 26, 42, 28],
  [30, 20, 32, 26],
  [40, 20, 42, 26],
  [12, 31, 14, 34],
  [12, 32, 30, 34],
  [28, 27, 30, 34],
  [42, 22, 50, 24]
];
/** 빼는 길 사각형(지금 값). */
export const REMOVED_PATH_RECTS: readonly Rect[] = [
  [50, 22, 56, 24],
  [56, 28, 59, 30],
  [42, 28, 59, 30],
  [26, 34, 28, 48],
  [26, 48, 28, 50],
  [20, 48, 33, 50]
];

/** 명세 2·3·3-1의 모델에서 잰 값(머리말). */
export const FURNITURE_SHOP_MODEL = { buildingTriangles: 10000, glassTriangles: 30, colorMapSha256: "c3f41f4a61c37667cbea67b6a340c537366977244d9cab6e55029460baae0ae8" };
export const CLOTHING_SHOP_MODEL = { buildingTriangles: 7242, glassTriangles: 16, colorMapSha256: "ff8f834242aa5ade4590fb8322ae50c04c28559cb7132a2e5796699dad431b43" };
export const HOME_MODEL = {
  triangles: 10852,
  colorMapSha256: "1bb6221939d37a8b0f6b97fc330e5cc95badf8a76f868dd3eb658945cff8bbc5",
  /** 벽 가로를 4칸에 맞췄을 때의 벽 깊이·높이(머리말). */
  wallDepthAt4: 3.3242,
  heightAt4: 3.2712
};
/** 모델의 유리 재질 이름("glass". Blender가 같은 이름 재질을 둘째부터 glass.001처럼 바꿀 수 있어 앞머리로 본다). */
export const GLASS_MATERIAL = /^glass/i;

// ---------- 칸 ----------

/** 사각형들이 덮는 칸("열,행"). village.ts의 막힌 칸과 같은 셈(x0·z0 내림, x1·z1 올림, 끝 칸 빼고). */
export function rectTiles(rects: readonly Rect[]): Set<string> {
  const out = new Set<string>();
  for (const [x0, z0, x1, z1] of rects) for (let c = Math.floor(x0); c < Math.ceil(x1); c += 1) for (let r = Math.floor(z0); r < Math.ceil(z1); r += 1) out.add(`${c},${r}`);
  return out;
}

/** 나무 하나가 막는 칸(village.ts: 가운데에서 0.8×0.8칸). */
export function treeTiles(x: number, z: number): Set<string> {
  return rectTiles([[x - 0.4, z - 0.4, x + 0.4, z + 0.4]]);
}

const treeKey = ([x, z]: readonly number[]) => `${x},${z}`;

/** 배치 파일의 나무 가운데 기준 커밋에 없던 자리(옮긴 나무). */
export function newTrees(): (readonly [number, number])[] {
  const base = new Map<string, number>();
  for (const t of baseLayout106().trees) base.set(treeKey(t), (base.get(treeKey(t)) ?? 0) + 1);
  const out: (readonly [number, number])[] = [];
  for (const t of LAYOUT.trees) {
    const left = base.get(treeKey(t)) ?? 0;
    if (left > 0) base.set(treeKey(t), left - 1);
    else out.push([t[0], t[1]]);
  }
  return out;
}

/** 기준 커밋의 나무 가운데 지금 배치 파일에 없는 자리. */
export function goneTrees(): (readonly [number, number])[] {
  const now = new Map<string, number>();
  for (const t of LAYOUT.trees) now.set(treeKey(t), (now.get(treeKey(t)) ?? 0) + 1);
  const out: (readonly [number, number])[] = [];
  for (const t of baseLayout106().trees) {
    const left = now.get(treeKey(t)) ?? 0;
    if (left > 0) now.set(treeKey(t), left - 1);
    else out.push([t[0], t[1]]);
  }
  return out;
}

/**
 * 이번 작업이 막힌 칸을 바꾸는 곳: 옛 라룹이 집 땅, 카페 땅, 도서관 땅, 옷집 땅(옮기는 나무의 옛 자리도 이 안이다)과, 옮긴 나무가 막는 칸.
 * extra는 옛 테스트가 원래 빼던 사각형(예: 098의 옛 집 땅)이다.
 */
export function changedSolidRegion(extra: readonly Rect[] = []): Set<string> {
  const region = rectTiles([OLD_HOME_RECT, OLD_CAFE_RECT, OLD_LIBRARY_RECT, CLOTHING_RECT, ...extra]);
  for (const [x, z] of newTrees()) treeTiles(x, z).forEach((t) => region.add(t));
  return region;
}

/** 막힌 칸 가운데 바뀌는 곳 밖의 칸: 개수와 정렬한 목록(줄바꿈으로 이음)의 sha256. */
export function solidOutsideChanged(extra: readonly Rect[] = []): { count: number; sha256: string } {
  const region = changedSolidRegion(extra);
  const outside = [...VILLAGE_SOLID_TILES].filter((t) => !region.has(t)).sort();
  return { count: outside.length, sha256: sha256(outside.join("\n")) };
}

// ---------- 건물 ----------

export function buildingByLabel(label: string): VillageBuilding | undefined {
  return VILLAGE_BUILDINGS.find((b) => b.label === label);
}

/** 옷집 건물 id(명세에 id가 없어 이름으로 찾는다). 없으면 없는 id를 돌려 그 테스트가 실패하게 한다. */
export function clothingId(): string {
  return buildingByLabel(CLOTHING_LABEL)?.id ?? "옷집-없음";
}

// ---------- 마을 모델(glb) ----------

/** 장면 뿌리 묶음 이름들(정렬). */
export function rootNames(glb: Glb): string[] {
  return sceneRoots(glb).map((i) => glb.json.nodes[i].name ?? "").sort();
}

/** 이번 작업이 바꾸는 묶음: 건물(bld-*), 창 불빛 판(가로등 불빛이 아닌 glow-*: 조립한 건물의 창 불빛이다), 옛 Kenney 길 조각(paths). */
export function changedBy106(rootName: string): boolean {
  return rootName.startsWith("bld-") || (rootName.startsWith("glow") && !rootName.startsWith("glow-lamp")) || rootName === "paths";
}

/**
 * 묶음(장면 뿌리) 아래 메시 노드마다 프리미티브의 삼각형 수/겹치지 않는 점 자리 수/점 자리(소수 넷째 자리) 목록의 sha256(정렬).
 * 점 자리는 노드 안 좌표다(098 K5와 같은 방법). 구석 어둠(꼭짓점 색)을 다시 구우면 내보내기가 점을 나누는 수가 달라질 수 있어 점 수는 겹치지 않는 자리로 센다.
 */
export function describeGroups(glb: Glb, include: (rootName: string) => boolean): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const root of sceneRoots(glb)) {
    const rootName = glb.json.nodes[root].name ?? "";
    if (!include(rootName)) continue;
    for (const i of meshNodesUnder(glb, root)) {
      const node = glb.json.nodes[i];
      const prims = glb.json.meshes[node.mesh!].primitives.map((p) => {
        const a = glb.json.accessors[p.attributes.POSITION];
        const tris = (p.indices !== undefined ? glb.json.accessors[p.indices].count : a.count) / 3;
        const points = [...new Set(accessorValues(glb, p.attributes.POSITION).map((v) => v.map((n) => (Math.round(n * 1e4) / 1e4).toFixed(4)).join(",")))].sort();
        return `${tris}/${points.length}/${sha256(points.join("\n"))}`;
      });
      out[`${rootName} > ${node.name ?? i}`] = [...prims].sort();
    }
  }
  return out;
}
