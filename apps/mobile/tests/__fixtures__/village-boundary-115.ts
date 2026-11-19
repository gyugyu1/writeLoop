// qa 테스트 도우미(작업 115 ① 경계와 마을 모델, 기능 변경, 모바일): 마을 경계 원(가운데 (29, 26), 반지름 26)의 값과,
// 원 밖에서 빠지는 것(마을 나무·바위·풍차, 생울타리·울타리, 사각형 가장자리 막힌 줄)을 빼고 견주는 도우미.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-boundary.spec.test.ts(.tsx)와,
// 115 명세의 "고칠 기존 테스트"로 고친 테스트가 함께 쓴다.
// 기대값은 명세(private 작업 폴더 115-2026-11-18-마을-동그란-숲-경계/02-경계와-마을-모델/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작은 기준 커밋 de49aef의 지금 값이다.
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";
import { accessorValues, meshNodesUnder, rootIndex, sceneRoots, worldMatrices, type Glb, type Gltf } from "./village-glb-098";
import { changedSolidRegion, gitShow, rectTiles, sha256, type Rect } from "./village-shops-106";
import { inStallArea127, stallTiles127 } from "./village-stalls-127";
import { treeChangeFootprint117 } from "./village-trees-117";

/** 작업 115의 기준 커밋(명세 첫 줄). */
export const BASE_115 = "de49aef";
export const LAYOUT_PATH_115 = "apps/mobile/src/lib/lobby3d/village-layout.json";
export const VILLAGE_GLB_PATH_115 = "apps/mobile/assets/models/lobby-village.glb";

// ---------- 명세의 값 ----------

/** 명세 1: 마을 경계 원. */
export const CIRCLE_115 = { x: 29, z: 26, radius: 26 } as const;
/** 명세 3: 마을 나무는 원 가운데까지 거리가 반지름 − 1.5 이하인 것만 남는다. */
export const TREE_KEEP_RADIUS_115 = CIRCLE_115.radius - 1.5;
/** 명세 3: 지금 70그루 가운데 42그루가 빠져 28그루가 남는다. */
export const TREES_BEFORE_115 = 70;
export const TREES_REMOVED_115 = 42;
export const TREES_KEPT_115 = TREES_BEFORE_115 - TREES_REMOVED_115;
/** 명세 3: 바위는 (46, 12) 하나만 남는다. */
export const ROCKS_KEPT_115: readonly (readonly [number, number])[] = [[46, 12]];
/** 명세 4: 마을 모델에서 빠지는 묶음. */
export const REMOVED_GROUPS_115: readonly string[] = ["hedges", "fences", "windmill", "windmill-rotor"];
/** 명세 5: 카메라 범위(원을 감싸는 상자 x 3~55, z 0~52). 높이는 지금처럼 바닥(0)이다. */
export const VILLAGE_BOUNDS_115 = { minX: 3, maxX: 55, minY: 0, maxY: 0, minZ: 0, maxZ: 52 };
/** 지금(기준 커밋) 풍차 자리와, 둘레 숲이 비우던 풍차 둘레(가운데에서 가로·깊이로 6.5칸). 명세 3 "둘레 숲에서 풍차 둘레를 비우던 규칙도 없앤다". */
export const OLD_WINDMILL_115 = { x: 62.5, z: -3.5 } as const;
export const OLD_MILL_CLEAR_115 = 6.5;

export const centerDistance115 = (x: number, z: number): number => Math.hypot(x - CIRCLE_115.x, z - CIRCLE_115.z);
/** 명세 3: 남는 마을 나무(원 가운데까지 거리가 반지름 − 1.5 이하). */
export const keptTree115 = ([x, z]: readonly number[]): boolean => centerDistance115(x, z) <= TREE_KEEP_RADIUS_115;
/** 명세 3: 남는 바위(원 안). */
export const keptRock115 = ([x, z]: readonly number[]): boolean => centerDistance115(x, z) <= CIRCLE_115.radius;
/** 명세 2: 칸 가운데가 원 밖(가운데까지 거리 > 반지름)이다. */
export const tileOutside115 = (tile: string): boolean => {
  const [c, r] = tile.split(",").map(Number);
  return centerDistance115(c + 0.5, r + 0.5) > CIRCLE_115.radius;
};

// ---------- 기준 커밋의 배치 ----------

export type Layout115 = typeof LAYOUT & { _comment?: string; windmill?: { x: number; z: number } };
export const baseLayout115 = (): Layout115 => JSON.parse(gitShow(BASE_115, LAYOUT_PATH_115).toString("utf8")) as Layout115;

/** 기준 커밋 배치 파일의 마을 나무 가운데 115가 빼는 것(원 가운데까지 거리 > 반지름 − 1.5). */
export const removedTrees115 = (): (readonly [number, number])[] => baseLayout115().trees.filter((t) => !keptTree115(t)).map(([x, z]) => [x, z] as const);
/** 기준 커밋 배치 파일의 바위 가운데 115가 빼는 것(원 밖). */
export const removedRocks115 = (): (readonly [number, number])[] => baseLayout115().rocks.filter((t) => !keptRock115(t)).map(([x, z]) => [x, z] as const);

/** 배치 파일 윗단계 열쇠 가운데 115 전부터 있던 것(풍차·127의 노점 빼고). 115가 더하는 경계 원 열쇠(이름은 명세에 없다)는 견주지 않는다(새 테스트가 따로 본다). */
const KEPT_KEYS_115 = ["_comment", "width", "depth", "buildings", "fountain", "lanterns", "benches", "rocks", "paths"] as const;

/**
 * 배치 파일에서 115가 바꾸는 것을 뺀 모양: 풍차(windmill)와 경계 원 열쇠를 빼고, 마을 나무·바위는 남는 것(명세 3)만 둔다.
 * 기존 테스트가 "기준 커밋 배치와 같다"를 볼 때 양쪽에 씌운다. 남는 나무·바위의 자리와 그 밖의 값은 그대로 견준다.
 */
export function withoutBoundary115<T extends { trees: number[][]; rocks: number[][] }>(layout: T): T {
  const source = layout as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of KEPT_KEYS_115) if (key in source) out[key] = source[key];
  // 117: 마을 안 나무(trees)와 그 종류(treeKinds)는 117이 바꾸므로 견주지 않는다(117 테스트가 따로 본다)
  out.rocks = layout.rocks.filter((t) => keptRock115(t));
  return out as unknown as T;
}

// ---------- 칸 ----------

/** 나무 하나·바위 하나가 막는 칸(village.ts: 나무는 가운데에서 0.8×0.8칸, 바위는 1.8×1.8칸). */
const treeRect = ([x, z]: readonly number[]): Rect => [x - 0.4, z - 0.4, x + 0.4, z + 0.4];
const rockRect = ([x, z]: readonly number[]): Rect => [x - 0.9, z - 0.9, x + 0.9, z + 0.9];

let removedFootprintCache: Set<string> | null = null;
/** 115가 빼는 마을 나무·바위가 지금 막는 칸. */
export function removedFootprint115(): Set<string> {
  if (!removedFootprintCache) removedFootprintCache = rectTiles([...removedTrees115().map(treeRect), ...removedRocks115().map(rockRect)]);
  return removedFootprintCache;
}

/** 마을 칸 크기(명세 "길찾기 칸 범위 x 0~70, z 0~60"은 그대로다). */
export const VILLAGE_SIZE_115 = { width: 70, depth: 60 } as const;

/** 지금 사각형 가장자리 한 줄(x 0·69, z 0·59). 명세 2가 이 줄을 막던 규칙을 없앤다. */
export const edgeTile115 = (tile: string): boolean => {
  const [c, r] = tile.split(",").map(Number);
  return c === 0 || r === 0 || c === VILLAGE_SIZE_115.width - 1 || r === VILLAGE_SIZE_115.depth - 1;
};

/**
 * 115가 막힌 칸을 바꾸지 않는 곳: 칸 가운데가 원 안이고, 사각형 가장자리 줄이 아니며, 빠지는 나무·바위가 막던 칸이 아닌 칸.
 * 그대로 둘 막힌 칸(건물·분수·가로등·벤치·남는 나무·바위)은 이 안에서 견준다.
 */
// 117: 마을 안 나무 28자리가 바뀌므로(옛 28자리·새 28자리) 그 나무가 막는 칸도 "바뀔 수 있는 곳"으로 보고 뺀다.
export const inKeepRegion115 = (tile: string): boolean => !tileOutside115(tile) && !edgeTile115(tile) && !removedFootprint115().has(tile) && !treeChangeFootprint117().has(tile) && !stallTiles127().has(tile);

export const digest115 = (tiles: readonly string[]): { count: number; sha256: string } => ({ count: tiles.length, sha256: sha256(tiles.join("\n")) });

/** 막힌 칸 가운데 115가 바꾸지 않는 곳(정렬). */
export function solidKeep115(): string[] {
  return [...VILLAGE_SOLID_TILES].filter(inKeepRegion115).sort();
}

/** 106 테스트의 solidOutsideChanged(extra)에서 115가 바꾸는 곳도 뺀 칸: 개수와 정렬한 목록(줄바꿈으로 이음)의 sha256. */
export function solidOutsideChanged115(extra: readonly Rect[] = []): { count: number; sha256: string } {
  const region = changedSolidRegion(extra);
  return digest115([...VILLAGE_SOLID_TILES].filter((t) => !region.has(t) && inKeepRegion115(t)).sort());
}

// ---------- 마을 모델(glb) ----------

/** 빠지는 바위 둘레(바위 가운데에서 가로·깊이 거리 1.5칸 안, 높이 −0.01~2.5). 지금 바위 하나는 가운데에서 1.11칸 안의 삼각형 200개다(기준 커밋에서 잰 값). */
export function inRemovedRockArea115([x, y, z]: readonly number[], rocks: readonly (readonly [number, number])[]): boolean {
  return y >= -0.01 && y <= 2.5 && rocks.some(([rx, rz]) => Math.hypot(x - rx, z - rz) <= 1.5);
}

type Prim = Gltf["meshes"][number]["primitives"][number];

/**
 * 115가 바꾸는 것을 뺀 마을 모델: 빠지는 묶음(생울타리·울타리·풍차·풍차 날개)을 장면 뿌리에서 떼고, 소품 묶음(props)에서
 * 점 셋이 모두 빠지는 바위 둘레에 있는 삼각형을 뺀다(남는 삼각형이 쓰는 점만 새 POSITION으로, 삼각형은 새 인덱스로 적는다.
 * 프리미티브에는 POSITION만 남긴다). 삼각형이 모두 빠진 프리미티브는 빼고, 프리미티브가 모두 빠진 메시 노드는 메시 없는 노드로 둔다.
 * 그 밖(다른 묶음, 소품의 다른 조각)은 그대로라 기존 테스트의 묶음 견주기에 그대로 넘긴다.
 */
export function withoutBoundaryGlb115(glb: Glb): Glb {
  const json = JSON.parse(JSON.stringify(glb.json)) as Gltf;
  const scene = json.scenes[json.scene ?? 0];
  scene.nodes = scene.nodes.filter((i) => !REMOVED_GROUPS_115.includes(json.nodes[i].name ?? ""));
  const root = rootIndex(glb, "props");
  if (root < 0) return { json, bin: glb.bin };
  const rocks = removedRocks115();
  const matrices = worldMatrices(glb);
  const chunks: Buffer[] = [glb.bin];
  let offset = glb.bin.length;
  const append = (data: Buffer): number => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      offset += pad;
    }
    json.bufferViews.push({ byteOffset: offset, byteLength: data.length });
    chunks.push(data);
    offset += data.length;
    return json.bufferViews.length - 1;
  };
  for (const node of meshNodesUnder(glb, root)) {
    const m = matrices.get(node)!;
    const meshIndex = glb.json.nodes[node].mesh!;
    const kept: Prim[] = [];
    for (const prim of glb.json.meshes[meshIndex].primitives) {
      const local = accessorValues(glb, prim.attributes.POSITION);
      const world = local.map(([x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      const index = prim.indices !== undefined ? accessorValues(glb, prim.indices).map((v) => v[0]) : [...local.keys()];
      const tris: number[] = [];
      for (let i = 0; i + 2 < index.length; i += 3) {
        const t = [index[i], index[i + 1], index[i + 2]];
        if (!t.every((v) => inRemovedRockArea115(world[v], rocks) || inStallArea127(world[v]))) tris.push(...t);
      }
      if (tris.length === index.length) {
        kept.push(prim);
        continue;
      }
      if (tris.length === 0) continue;
      const used = [...new Set(tris)];
      const remap = new Map(used.map((v, i) => [v, i]));
      const positions = Buffer.alloc(used.length * 12);
      used.forEach((v, i) => local[v].forEach((n, k) => positions.writeFloatLE(n, i * 12 + k * 4)));
      const indices = Buffer.alloc(tris.length * 4);
      tris.forEach((v, i) => indices.writeUInt32LE(remap.get(v)!, i * 4));
      json.accessors.push({ bufferView: append(positions), count: used.length, componentType: 5126, type: "VEC3" });
      const positionAccessor = json.accessors.length - 1;
      json.accessors.push({ bufferView: append(indices), count: tris.length, componentType: 5125, type: "SCALAR" });
      kept.push({ ...prim, attributes: { POSITION: positionAccessor }, indices: json.accessors.length - 1 });
    }
    if (kept.length === 0) {
      delete json.nodes[node].mesh;
      continue;
    }
    json.meshes.push({ ...glb.json.meshes[meshIndex], primitives: kept });
    json.nodes[node].mesh = json.meshes.length - 1;
  }
  return { json, bin: Buffer.concat(chunks) };
}

/** 장면 뿌리 묶음 이름(정렬). 빠지는 묶음은 뺀다. */
export function rootNamesKept115(glb: Glb): string[] {
  return sceneRoots(glb)
    .map((i) => glb.json.nodes[i].name ?? "")
    .filter((n) => !REMOVED_GROUPS_115.includes(n))
    // 120: 가로등 불빛 판(glow-lamp-*)도 마을 모델에서 빠진다(옛 Kenney 가로등과 함께)
    .filter((n) => !/^glow-lamp(-|$)/.test(n))
    .sort();
}

/** 소품 묶음(props)의 삼각형 가운데 점 셋이 모두 이 바위들 둘레에 있는 것의 수. */
export function propsTrianglesAround115(glb: Glb, rocks: readonly (readonly [number, number])[]): number {
  const root = rootIndex(glb, "props");
  if (root < 0) return 0;
  const matrices = worldMatrices(glb);
  let count = 0;
  for (const node of meshNodesUnder(glb, root)) {
    const m = matrices.get(node)!;
    for (const prim of glb.json.meshes[glb.json.nodes[node].mesh!].primitives) {
      const world = accessorValues(glb, prim.attributes.POSITION).map(([x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      const index = prim.indices !== undefined ? accessorValues(glb, prim.indices).map((v) => v[0]) : [...world.keys()];
      for (let i = 0; i + 2 < index.length; i += 3) if ([index[i], index[i + 1], index[i + 2]].every((v) => inRemovedRockArea115(world[v], rocks))) count += 1;
    }
  }
  return count;
}

// ---------- 둘레 숲(그리기) ----------

/** 둘레 숲이 비우던 옛 풍차 둘레 안인가(가운데에서 가로·깊이 모두 6.5칸 안). */
export const inOldMillClear115 = (x: number, z: number): boolean => Math.abs(x - OLD_WINDMILL_115.x) < OLD_MILL_CLEAR_115 && Math.abs(z - OLD_WINDMILL_115.z) < OLD_MILL_CLEAR_115;

// ---------- 기준 커밋에서 잰 값(그대로 둘 막힌 칸)과 명세대로 셈한 값(새 막힌 칸) ----------
// 127: 아래 네 값은 노점이 막던 칸 18개(노점 둘 × 3×3칸, 모두 막혀 있었다. stallTiles127)를 목록에서 뺀 값이다(옛 값에서 18개 줄어든 개수 150→132, 83→65, 119→101, 144→126).
// inKeepRegion115가 그 칸을 "바뀔 수 있는 곳"으로 빼서 옛 커밋 쪽·지금 쪽 모두 노점 칸 없이 견준다. 노점이 걸을 수 있게 되는 것은 127 테스트가 본다.

/** solidKeep115(): 막힌 칸 643개 가운데 115가 바꾸지 않는 곳(원 안, 가장자리 줄 아님, 빠지는 나무·바위 칸 아님). 기준 커밋 de49aef에서 잰 값. */
export const SOLID_KEEP_115 = { count: 132, sha256: "0f8cd9112f9eedcea75899837393beda4a52c1bf6f6d3b00c070edab81036e16" };
/**
 * 106 테스트 solidOutsideChanged()(옛 라룹이 집·카페·도서관·옷집 땅, 옮긴 나무 밖)에서 114가 뺀 벤치 칸(BENCH_TILE_RECTS)과 115가 바꾸는 곳도 뺀 칸.
 * 기준 커밋 de49aef에서 잰 값(114 값 575개 목록에서 115가 바꾸는 곳 밖만 남긴 것). 098의 옛 집 땅 [31, 6, 40, 12]을 더 빼도 같다.
 */
export const SOLID_OUTSIDE_CHANGED_115 = { count: 65, sha256: "1ff92b23e322fd014586f7c6af359388818650e7da908aaf85f040ae996e64c2" };
/** 107 테스트 K2(새 집 칸 x 33~37, z 7~11 밖)에서 114 벤치 칸과 115가 바꾸는 곳도 뺀 칸. 기준 커밋 de49aef에서 잰 값(114 값 612개에서 줄인 것). */
export const SOLID_OUTSIDE_HOME_107_115 = { count: 101, sha256: "004c87895efac4a758b6337a5e3e967342b2914640fb82ce0d8fe7e32fb0f819" };
/** 114 테스트 K3(벤치가 바꿀 수 있는 곳 밖)에서 115가 바꾸는 곳도 뺀 칸. 기준 커밋 de49aef에서 잰 값(114 값 637개에서 줄인 것). */
export const SOLID_OUTSIDE_BENCH_115 = { count: 126, sha256: "647d19d01da186cc4575f4fe43a06051c2da53eb115c4f00b2883039e5027619" };
