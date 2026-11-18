// qa 테스트 도우미(작업 114 마을 벤치 모델, 기능 변경, 모바일): 새 벤치 모델에서 잰 값, 벤치가 바꾸는 막힌 칸, 마을 모델에서 벤치 조각을 빼고 견주는 도우미.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-bench.spec.test.ts와, 114 명세의 "고칠 기존 테스트"로 고친 테스트가 함께 쓴다.
// 기대값은 명세(private 작업 폴더 114-2026-11-18-마을-벤치-모델/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 d256ff4의 지금 값이다.
//
// 새 벤치 모델(저장소 밖 C:\WriteLoop-asset\벤치\3d\WriteLoop_Village_Bench.glb, 203864바이트, sha256 98d0d44d…340d).
// 테스트는 저장소 밖 파일을 읽지 않는다(CI에는 없다). qa가 그 파일에서 잰 값만 옮겨 적었다:
// - 노드 하나·메시 하나(WriteLoop_Village_Bench), 프리미티브 하나(POSITION·NORMAL·TEXCOORD_0), 점 2147, 삼각형 2110.
// - 재질 하나 Village_Bench_Painted_Timber(바탕색 그림 하나). 그림 bench_atlas: PNG 1024×1024, 121045바이트, sha256 BENCH_MODEL.atlasSha256.
// - 크기 상자(모델 단위, glTF: +Y 위) x -0.85480~0.85589(길이 1.71069), y 0~0.98480, z -0.37600~0.31277(깊이 0.68877).
//   높이 0.7 넘는 점(등받이 윗부분)은 모두 z -0.2328 아래(뒤, -z)다. 명세 "등받이가 -z(뒤)에 있어 앉는 쪽이 +z(앞)를 본다".
// 명세 1의 1.3배: 길이 2.2239, 깊이 0.8954, 높이 1.2802. 높이 0.91(= 0.7 × 1.3) 넘는 점은 원점보다 0.3026 넘게 뒤, 크기 상자 가운데보다 0.26 넘게 뒤다.
import { createHash } from "node:crypto";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";
import { accessorValues, meshNodesUnder, rootIndex, worldMatrices, type Glb, type Gltf } from "./village-glb-098";
import { gitShow, rectTiles, type Rect } from "./village-shops-106";

/** 작업 114의 기준 커밋(명세 첫 줄). */
export const BASE_114 = "d256ff4";
export const LAYOUT_PATH_114 = "apps/mobile/src/lib/lobby3d/village-layout.json";
export const SCRIPT_PATH_114 = "scripts/lobby3d/build-village.py";
export const CREDITS_PATH_114 = "apps/mobile/assets/models/CREDITS.md";
/** 명세 4: 머리말에 적을 저장소 밖 벤치 모델 경로. */
export const BENCH_MODEL_PATH = "C:\\WriteLoop-asset\\벤치\\3d\\WriteLoop_Village_Bench.glb";

export const sha256 = (data: Buffer | string): string => createHash("sha256").update(data).digest("hex");

// ---------- 명세의 값 ----------

/** 명세 1: 자리는 그대로(분수 좌우). */
export const BENCH_SPOTS: readonly { x: number; z: number }[] = [
  { x: 32, z: 22.5 },
  { x: 39, z: 22.5 }
];
/** 새 벤치 모델에서 잰 값(머리말). */
export const BENCH_MODEL = {
  triangles: 2110,
  materialName: "Village_Bench_Painted_Timber",
  atlas: { width: 1024, height: 1024, mimeType: "image/png" },
  atlasSha256: "d1b7e561de0bc129db328d4dc7f8d55f7f930d599e8067d249894dda4c72fffa"
};
/** 명세 1: 새 모델 원본의 1.3배. 원본 크기 상자에 1.3을 곱한 값(머리말). */
export const BENCH_SCALE = 1.3;
export const BENCH_SIZE = { length: 1.71069 * BENCH_SCALE, depth: 0.68877 * BENCH_SCALE, height: 0.9848 * BENCH_SCALE };
/** "약"의 폭(qa가 정함): 길이·깊이 ±0.03칸, 높이 ±0.02칸, 바닥 ±0.005칸, 자리 x ±0.05칸·z ±0.1칸(원점을 놓든 크기 상자 가운데를 놓든 받는다). */
export const BENCH_TOL = { size: 0.03, height: 0.02, floor: 0.005, x: 0.05, z: 0.1 };
/** 등받이 윗부분: 1.3배한 높이 0.91 넘는 점. 크기 상자 가운데보다 이만큼 넘게 뒤(-z)에 있어야 한다(잰 값 0.26보다 좁게). */
export const BACKREST_Y = 0.7 * BENCH_SCALE;
export const BACKREST_BEHIND = 0.15;

/**
 * 막힌 칸(명세 3: 벤치 가운데에서 가로 약 2.3 × 세로 약 0.9, village.ts의 칸 셈 = x0·z0 내림, x1·z1 올림, 끝 칸 빼고).
 * 가로가 2보다 크고 4보다 작으면 x 30~33(벤치 32)·37~40(벤치 39) 네 칸, 세로가 1 이하면 z 22 한 줄이라 "약"이 이 칸을 바꾸지 않는다.
 */
export const BENCH_NEW_TILES: readonly string[] = ["30,22", "31,22", "32,22", "33,22", "37,22", "38,22", "39,22", "40,22"];
/** 지금(세로로 김: 가로 0.6 × 세로 2.2) 벤치만 막고 새 벤치는 막지 않는 칸. 그 칸을 막는 다른 것(분수·가로등·길 둘레 등)은 없다. */
export const BENCH_OLD_ONLY_TILES: readonly string[] = ["31,21", "32,21", "31,23", "32,23", "38,21", "39,21", "38,23", "39,23"];
/**
 * 벤치가 막힌 칸을 바꿀 수 있는 곳: 지금 벤치 칸(x 31~32·38~39, z 21~23)과, 새 벤치 칸 가운데 지금 막히지 않은 칸(30,22·40,22)을 덮는 사각형들.
 * 새 벤치 칸 33,22·37,22는 분수도 막아 바뀌기 전·뒤 모두 막히므로 빼지 않는다. 그대로 둘 막힌 칸은 이 밖에서 견준다.
 */
export const BENCH_TILE_RECTS: readonly Rect[] = [
  [31, 21, 33, 24],
  [38, 21, 40, 24],
  [30, 22, 31, 23],
  [40, 22, 41, 23]
];
export const benchTileRegion = (): Set<string> => rectTiles(BENCH_TILE_RECTS);

/** 막힌 칸 가운데 벤치가 바꿀 수 있는 곳(BENCH_TILE_RECTS) 밖. */
export function solidOutsideBench(): string[] {
  const region = benchTileRegion();
  return [...VILLAGE_SOLID_TILES].filter((t) => !region.has(t)).sort();
}

// ---------- 배치 파일 ----------

export type Layout = typeof LAYOUT & { _comment?: string };
export const baseLayout114 = (): Layout => JSON.parse(gitShow(BASE_114, LAYOUT_PATH_114).toString("utf8")) as Layout;

/** 배치 파일에서 벤치의 rot을 뺀 모양(벤치는 자리만 남긴다). 명세 2가 rot만 바꾼다. */
export function withoutBenchRot<T extends { benches: { x: number; z: number; rot: number }[] }>(layout: T): Omit<T, "benches"> & { benches: { x: number; z: number }[] } {
  return { ...layout, benches: layout.benches.map((b) => ({ x: b.x, z: b.z })) };
}

// ---------- 마을 모델(glb) ----------

/** 벤치 둘레 상자(벤치 가운데에서 x ±1.4, z ±0.8, 높이 -0.01~1.6). 지금 Kenney 벤치(길이 2.26, 깊이 0.62, 높이 0.54)와 새 벤치를 모두 덮고, 분수(x 33.9~37.1)·가로등에는 닿지 않는다. */
export function inBenchArea([x, y, z]: readonly number[]): boolean {
  return y >= -0.01 && y <= 1.6 && BENCH_SPOTS.some((b) => Math.abs(x - b.x) <= 1.4 && Math.abs(z - b.z) <= 0.8);
}

type Prim = Gltf["meshes"][number]["primitives"][number];

/** 노드 변환을 곱한 프리미티브의 점들(세계 좌표). */
export function primitiveWorldPoints(glb: Glb, nodeIndex: number, prim: Prim, matrices = worldMatrices(glb)): [number, number, number][] {
  const m = matrices.get(nodeIndex)!;
  return accessorValues(glb, prim.attributes.POSITION).map(([x, y, z]) => [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  ]);
}

/** 프리미티브의 삼각형(점 번호 셋씩). */
export function primitiveTriangles(glb: Glb, prim: Prim): [number, number, number][] {
  const count = glb.json.accessors[prim.attributes.POSITION].count;
  const index = prim.indices !== undefined ? accessorValues(glb, prim.indices).map((v) => v[0]) : [...Array(count).keys()];
  const out: [number, number, number][] = [];
  for (let i = 0; i + 2 < index.length; i += 3) out.push([index[i], index[i + 1], index[i + 2]]);
  return out;
}

export type PropsPrimitive = { node: number; prim: Prim; material: string; points: [number, number, number][]; triangles: [number, number, number][] };

/** 소품 묶음(props) 아래 모든 메시 노드의 프리미티브. */
export function propsPrimitives(glb: Glb): PropsPrimitive[] {
  const root = rootIndex(glb, "props");
  if (root < 0) return [];
  const matrices = worldMatrices(glb);
  return meshNodesUnder(glb, root).flatMap((node) =>
    glb.json.meshes[glb.json.nodes[node].mesh!].primitives.map((prim) => ({
      node,
      prim,
      material: prim.material !== undefined ? glb.json.materials?.[prim.material]?.name ?? "" : "",
      points: primitiveWorldPoints(glb, node, prim, matrices),
      triangles: primitiveTriangles(glb, prim)
    }))
  );
}

/** 프리미티브의 바탕색 그림 번호(없으면 -1). */
export function primitiveImage(glb: Glb, prim: Prim): number {
  const ref = prim.material !== undefined ? glb.json.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorTexture : undefined;
  return ref ? glb.json.textures?.[ref.index]?.source ?? -1 : -1;
}

/**
 * 벤치 조각을 뺀 마을 모델: 소품 묶음(props) 아래 프리미티브 가운데 점이 모두 벤치 둘레 상자 안인 것(지금은 Kenney 벤치 조각, 바뀐 뒤에는 새 벤치 조각)을 뺀다.
 * 프리미티브가 모두 빠진 메시 노드는 메시가 없는 노드로 둔다. 그 밖(다른 묶음, 소품의 다른 조각)은 그대로라, 기존 테스트의 묶음 견주기에 그대로 넘긴다.
 */
export function withoutBenchPrimitives(glb: Glb): Glb {
  const json = JSON.parse(JSON.stringify(glb.json)) as Gltf;
  const root = rootIndex(glb, "props");
  if (root < 0) return { json, bin: glb.bin };
  const matrices = worldMatrices(glb);
  const meshes = json.meshes;
  for (const node of meshNodesUnder(glb, root)) {
    const meshIndex = glb.json.nodes[node].mesh!;
    const kept = glb.json.meshes[meshIndex].primitives.filter((prim) => !primitiveWorldPoints(glb, node, prim, matrices).every(inBenchArea));
    if (kept.length === 0) {
      delete json.nodes[node].mesh;
      continue;
    }
    meshes.push({ ...glb.json.meshes[meshIndex], primitives: kept });
    json.nodes[node].mesh = meshes.length - 1;
  }
  return { json, bin: glb.bin };
}

// ---------- 기준 커밋에서 잰 값(그대로 둘 막힌 칸) ----------

/**
 * 106 테스트의 solidOutsideChanged()(옛 라룹이 집·카페·도서관·옷집 땅, 옮긴 나무 밖)에서 벤치가 바꿀 수 있는 곳(BENCH_TILE_RECTS)도 뺀 칸:
 * 개수와 정렬한 목록(줄바꿈으로 이음)의 sha256. 기준 커밋 d256ff4에서 잰 값. 그 커밋에서 106 값(587개, sha256 a261d8ba…)과 같았던 목록에서
 * 지금 벤치 칸 12개를 뺀 것이다(벤치가 바꿀 수 있는 곳 14칸 가운데 그 커밋에서 막힌 칸은 지금 벤치 칸 12개뿐이다).
 */
export const SOLID_OUTSIDE_CHANGED_114 = { count: 575, sha256: "354f2cce4ff00cc6e85c57b5e8f107fcd290750c9c1c782bd0884f0453346ad9" };
/** 107 테스트 K2(새 집 칸 x 33~37, z 7~11 밖, 624개)에서 벤치가 바꿀 수 있는 곳도 뺀 칸. 기준 커밋 d256ff4에서 잰 값(624개 목록에서 지금 벤치 칸 12개를 뺀 것). */
export const SOLID_OUTSIDE_HOME_107_114 = { count: 612, sha256: "2d68c371c9f7ad39996400869179b92b057401a8d646f1e59734e4431a74f275" };
/** 막힌 칸 전체(649개)에서 벤치가 바꿀 수 있는 곳 밖(solidOutsideBench). 기준 커밋 d256ff4에서 잰 값. */
export const SOLID_OUTSIDE_BENCH_114 = { count: 637, sha256: "b5de62663ef7e3607e4f2b0ac122007875cf32ceff39f4e2aeb203c9d6a552e6" };
