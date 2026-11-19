// qa 테스트 도우미(작업 118 마을 분수대 교체): 새 분수 모델(village-fountain.glb)의 값과, 마을 모델(lobby-village.glb)에서 옛 Kenney 분수를 뺀 모양을 만드는 도우미.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). three를 읽지 않아 어느 테스트에서도 쓸 수 있다(three를 쓰는 분수 모델 풀기는 village-fountain-model-118.ts).
// 기대값은 명세(private 작업 폴더 118-2026-11-19-마을-분수대-교체/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 0f80ab1의 지금 값이다.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { REPO, VILLAGE_GLB_PATH, accessorValues, meshNodesUnder, parseGlb, rootIndex, sceneRoots, worldMatrices, type Glb, type Gltf } from "./village-glb-098";

export const BASE_118 = "0f80ab1";
export const MODELS_DIR_118 = join(__dirname, "..", "..", "assets", "models");
/** 명세 2: 새 분수 모델을 앱 모델 자산 폴더에 이 이름으로 넣는다. */
export const FOUNTAIN_ASSET_NAME = "village-fountain.glb";
export const FOUNTAIN_ASSET_FILE = join(MODELS_DIR_118, FOUNTAIN_ASSET_NAME);
export const FOUNTAIN_ASSET_REPO_PATH = `apps/mobile/assets/models/${FOUNTAIN_ASSET_NAME}`;
/** 명세 2: 원본 바이트 그대로. 원본(C:\WriteLoop-asset\분수대\3d\WriteLoop_Village_Fountain.glb)의 sha256은 qa가 그 파일에서 잰 값이다(CI에는 그 폴더가 없어 테스트가 읽지 않는다). */
export const FOUNTAIN_SOURCE_SHA256 = "ed7b31b368ddec6c5aec1917c4e50e666d395bfb0e81e2283940071a1bd32536";
export const FOUNTAIN_SOURCE_BYTES = 143460;

/** 명세 "새 모델": 석재·물 메시와 클립. */
export const STONE_NODE_NAME = "Fountain | carved limestone";
export const WATER_NODE_NAME = "Water | gentle downward trickle";
export const STONE_TRIANGLES = 1534;
export const WATER_TRIANGLES = 1186;
export const CLIP_NAME = "Fountain_Flow";
export const CLIP_KEYS = 25;
/** 명세 "새 모델": 크기(모델 단위). */
export const MODEL_SIZE = { minX: -1.223, maxX: 1.223, minY: 0, maxY: 0.987, minZ: -1.232, maxZ: 1.232 } as const;
/** 명세 3: 가운데는 배치 파일의 fountain x·z, 균일 배율은 반지름 ÷ 모델의 바깥 반폭(1.6 ÷ 1.232 ≈ 1.30). */
export const FOUNTAIN_LAYOUT = LAYOUT.fountain;
export const FOUNTAIN_HALF_WIDTH = 1.232;
export const FOUNTAIN_SCALE = FOUNTAIN_LAYOUT.radius / FOUNTAIN_HALF_WIDTH;
/** 명세 4: 클립은 첫 키를 0초로 당겨 쓴다. 길이는 2초. */
export const CLIP_SECONDS = 2;

/** 기준 커밋 0f80ab1의 마을 모델(옛 Kenney 분수가 든 것). */
export const baseVillageGlb118 = (): Glb => parseGlb(execFileSync("git", ["show", `${BASE_118}:${VILLAGE_GLB_PATH}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));

export const sha256Hex = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

export const fountainAssetExists = () => existsSync(FOUNTAIN_ASSET_FILE);
export const fountainAssetGlb = (): Glb => parseGlb(readFileSync(FOUNTAIN_ASSET_FILE));

/** jest.doMock으로 분수 모델 파일을 가짜로 둔다(파일이 아직 없어도 된다: 가상 모듈. 파일 경로로 불러오는 코드가 같은 경로를 받는다). */
export function mockFountainAsset(valueOf: (name: string) => unknown = (name) => name): void {
  jest.doMock(FOUNTAIN_ASSET_FILE, () => valueOf(FOUNTAIN_ASSET_NAME), { virtual: true });
}

/** 분수 모델 파일 이름인가(가짜 자산 값은 파일 이름 글자이거나 경로다). */
export const isFountainUrl = (url: unknown): boolean => typeof url === "string" && (url === FOUNTAIN_ASSET_NAME || url.endsWith(`/${FOUNTAIN_ASSET_NAME}`));

// ---------- 클립의 키(모델에서 읽은 값) ----------

export type FlowKeys = { times: number[]; values: number[][] };

/** 모델의 Fountain_Flow 키: 시각(초)과 키마다 가중치 셋. 모델 파일에서 읽는다. */
export function flowKeys(glb: Glb = fountainAssetGlb()): FlowKeys {
  const animations = (glb.json as Gltf & { animations?: { name?: string; samplers: { input: number; output: number }[] }[] }).animations;
  const animation = animations?.find((a) => a.name === CLIP_NAME);
  if (!animation) throw new Error("Fountain_Flow 애니메이션이 없다");
  const sampler = animation.samplers[0];
  const times = accessorValues(glb, sampler.input).map((v) => v[0]);
  const flat = accessorValues(glb, sampler.output).map((v) => v[0]);
  const values: number[][] = [];
  for (let i = 0; i < times.length; i += 1) values.push(flat.slice(i * 3, i * 3 + 3));
  return { times, values };
}

/**
 * 명세 4대로 읽은 클립을 t초(되풀이, 첫 키를 0초로 당긴 길이 2초) 뒤에 재생한 가중치 셋.
 * 원본 키 시각은 첫 키 + (t mod 2), 키 사이는 LINEAR다.
 */
export function expectedWeightsAt(keys: FlowKeys, t: number): number[] {
  const first = keys.times[0];
  const last = keys.times[keys.times.length - 1];
  const length = last - first;
  let local = t % length;
  // 끝 키 시각(t = 2.0)은 끝 키 값 = 첫 키 값이다
  if (Math.abs(local - length) < 1e-9) local = 0;
  const at = first + local;
  let i = 0;
  while (i + 1 < keys.times.length - 1 && keys.times[i + 1] <= at) i += 1;
  const a = keys.times[i];
  const b = keys.times[i + 1];
  const k = b > a ? (at - a) / (b - a) : 0;
  return keys.values[i].map((v, c) => v + (keys.values[i + 1][c] - v) * k);
}

/**
 * 그린 장면의 물체가 새 분수 모델의 메시(석재 1534·물 1186 삼각형)인가. 삼각형 수와 재질 이름(원본 그대로: Limestone…, Water…)으로 알아본다.
 * 누르기 대상·그려지는 메시를 세는 기존 테스트가 분수 메시를 따로 가려내는 데 쓴다(작업 118).
 */
export function isFountainMesh118(o: unknown): boolean {
  const m = o as {
    isMesh?: boolean;
    isInstancedMesh?: boolean;
    material?: { name?: string } | { name?: string }[];
    geometry?: { index?: { count: number } | null; getAttribute: (name: string) => { count: number } };
  };
  if (!m || !m.isMesh || m.isInstancedMesh || !m.geometry) return false;
  const triangles = (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;
  const material = Array.isArray(m.material) ? m.material[0] : m.material;
  return (triangles === STONE_TRIANGLES || triangles === WATER_TRIANGLES) && /limestone|water/i.test(material?.name ?? "");
}

// ---------- 마을 모델에서 옛 Kenney 분수를 뺀 모양 ----------

/** 옛 분수가 있던 곳: 가운데 x·z에서 1.7칸 안(옛 분수 반지름 1.6 + 여유 0.1). 높이는 땅 아래 −0.01부터. 이 안에 다른 소품(가로등·벤치·바위)이 없음은 테스트 F1이 본다. */
export const OLD_FOUNTAIN_AREA_RADIUS = FOUNTAIN_LAYOUT.radius + 0.1;
export function inOldFountainArea([x, y, z]: readonly number[]): boolean {
  return y >= -0.01 && Math.hypot(x - FOUNTAIN_LAYOUT.x, z - FOUNTAIN_LAYOUT.z) <= OLD_FOUNTAIN_AREA_RADIUS;
}

type Prim = Gltf["meshes"][number]["primitives"][number];

/** 소품 묶음(props)의 삼각형 가운데 점 셋이 모두 옛 분수 자리 안에 있는 것의 수. */
export function propsTrianglesInOldFountain(glb: Glb): number {
  const root = rootIndex(glb, "props");
  if (root < 0) return 0;
  const matrices = worldMatrices(glb);
  let count = 0;
  for (const node of meshNodesUnder(glb, root)) {
    const m = matrices.get(node)!;
    for (const prim of glb.json.meshes[glb.json.nodes[node].mesh!].primitives) {
      const world = accessorValues(glb, prim.attributes.POSITION).map(([x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      const index = prim.indices !== undefined ? accessorValues(glb, prim.indices).map((v) => v[0]) : [...world.keys()];
      for (let i = 0; i + 2 < index.length; i += 3) if ([index[i], index[i + 1], index[i + 2]].every((v) => inOldFountainArea(world[v]))) count += 1;
    }
  }
  return count;
}

/**
 * 옛 Kenney 분수를 뺀 마을 모델: 소품 묶음(props)에서 점 셋이 모두 옛 분수 자리 안에 있는 삼각형을 뺀다(남는 삼각형이 쓰는 점만 새 POSITION으로,
 * 삼각형은 새 인덱스로 적는다. 바뀐 프리미티브에는 POSITION만 남긴다). 삼각형이 모두 빠진 프리미티브는 빼고, 프리미티브가 모두 빠진 메시 노드는 메시 없는 노드로 둔다.
 * 그 밖(다른 묶음, 소품의 다른 조각)은 그대로라 기존 테스트의 묶음 견주기에 그대로 넘긴다. 이미 분수가 없는 모델에는 아무것도 바꾸지 않는다(115의 withoutBoundaryGlb115와 같은 방법).
 */
export function withoutFountainGlb118(glb: Glb): Glb {
  const json = JSON.parse(JSON.stringify(glb.json)) as Gltf;
  const root = rootIndex(glb, "props");
  if (root < 0) return { json, bin: glb.bin };
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
        if (!t.every((v) => inOldFountainArea(world[v]))) tris.push(...t);
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

/** 장면 뿌리 묶음 이름(정렬). */
export const rootNames118 = (glb: Glb): string[] => sceneRoots(glb).map((i) => glb.json.nodes[i].name ?? "").sort();
