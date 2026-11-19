// qa 테스트 도우미(작업 120 마을 가로등 교체): 새 가로등 모델(village-streetlamp.glb)의 값과, 마을 모델(lobby-village.glb)에서 옛 Kenney 가로등과 가로등 불빛 판을 뺀 모양을 만든다.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). three를 읽지 않아 어느 테스트에서도 쓸 수 있다(three를 쓰는 모델 풀기는 village-streetlamp-model-120.ts).
// 기대값은 명세(private 작업 폴더 120-2026-11-19-마을-가로등-교체/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 703bef8의 지금 값이다.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { REPO, VILLAGE_GLB_PATH, accessorValues, meshNodesUnder, parseGlb, rootIndex, sceneRoots, worldMatrices, type Glb, type Gltf } from "./village-glb-098";
import { withoutFountainGlb118 } from "./village-fountain-118";

export const BASE_120 = "703bef8";
export const MODELS_DIR_120 = join(__dirname, "..", "..", "assets", "models");
/** 명세 2: 새 가로등 모델을 앱 모델 자산 폴더에 이 이름으로 넣는다. */
export const LAMP_ASSET_NAME = "village-streetlamp.glb";
export const LAMP_ASSET_FILE = join(MODELS_DIR_120, LAMP_ASSET_NAME);
export const LAMP_ASSET_REPO_PATH = `apps/mobile/assets/models/${LAMP_ASSET_NAME}`;
/** 명세 2: 원본 바이트 그대로. 원본(C:\WriteLoop-asset\가로등\3d\WriteLoop_Village_Streetlamp.glb)의 sha256·크기는 qa가 그 파일에서 잰 값이다(CI에는 그 폴더가 없어 테스트가 읽지 않는다). */
export const LAMP_SOURCE_SHA256 = "5c3e2360a6044f3fcb7a4fc1c89d787605ec0502ad6c69fc78c28f785237c243";
export const LAMP_SOURCE_BYTES = 61536;

/** 명세 "새 모델": 메시 하나, 삼각형 930, 재질 하나(발광 그림·색 그림, emissiveFactor 1,1,1, 거칠기 0.7, 금속 0). */
export const LAMP_NODE_NAME = "WriteLoop_Village_Streetlamp";
export const LAMP_TRIANGLES = 930;
export const LAMP_ROUGHNESS = 0.7;
/** 명세 "새 모델": 크기(모델 단위). 지붕 반폭 0.294, 높이 2.571. */
export const LAMP_MODEL_SIZE = { half: 0.294, height: 2.571 } as const;
/** 명세 3: 균일 배율 1.30을 한 번만 준다(기존 Kenney 가로등의 1.6은 대신한다). */
export const LAMP_SCALE = 1.3;
/** 명세 "그대로여야 할 동작": 가로등이 걷기를 막는 넓이는 각 자리 0.6 × 0.6칸. */
export const LAMP_BLOCK = 0.6;
/** 배치 파일의 가로등 자리(명세 3: 그리기 코드가 이 값을 읽는다). */
export const LANTERNS = LAYOUT.lanterns as readonly (readonly number[])[];

export const sha256Hex = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

/** 기준 커밋 703bef8의 마을 모델(옛 Kenney 가로등·불빛 판이 든 것). */
export const baseVillageGlb120 = (): Glb => parseGlb(execFileSync("git", ["show", `${BASE_120}:${VILLAGE_GLB_PATH}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));

export const lampAssetExists = () => existsSync(LAMP_ASSET_FILE);
export const lampAssetGlb = (): Glb => parseGlb(readFileSync(LAMP_ASSET_FILE));

/** jest.doMock으로 가로등 모델 파일을 가짜로 둔다(파일이 아직 없어도 되는 가상 모듈). */
export function mockLampAsset(valueOf: (name: string) => unknown = (name) => name): void {
  jest.doMock(LAMP_ASSET_FILE, () => valueOf(LAMP_ASSET_NAME), { virtual: true });
}

/** 가로등 모델 파일 이름인가(가짜 자산 값은 파일 이름 글자이거나 경로다). */
export const isLampUrl = (url: unknown): boolean => typeof url === "string" && (url === LAMP_ASSET_NAME || url.endsWith(`/${LAMP_ASSET_NAME}`));

/**
 * 그린 장면의 물체가 새 가로등 모델의 메시(930 삼각형, 재질 이름 "Village lamp…")인가. 누르기 대상·그려지는 메시를 세는 기존 테스트가 가로등 메시를 가려내는 데 쓴다(작업 120).
 * 인스턴스 메시도 가로등이다(명세 3: 네 자리를 인스턴스 메시 하나로 그린다).
 */
export function isLampMesh120(o: unknown): boolean {
  const m = o as {
    isMesh?: boolean;
    material?: { name?: string } | { name?: string }[];
    geometry?: { index?: { count: number } | null; getAttribute: (name: string) => { count: number } };
  };
  if (!m || !m.isMesh || !m.geometry) return false;
  const triangles = (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;
  const material = Array.isArray(m.material) ? m.material[0] : m.material;
  return triangles === LAMP_TRIANGLES && /lamp/i.test(material?.name ?? "");
}

// ---------- 마을 모델에서 옛 Kenney 가로등과 불빛 판을 뺀 모양 ----------

/** 옛 가로등이 있던 곳: 자리마다 x·z에서 이 거리 안(옛 가로등 모양은 배율 1.6의 Kenney 가로등). 높이는 땅 아래 −0.01부터. 이 안에 다른 소품(분수·벤치·바위)이 없음은 테스트 F1이 본다. */
export const OLD_LAMP_AREA_RADIUS = 0.9;
export function inOldLampArea([x, y, z]: readonly number[]): boolean {
  return y >= -0.01 && LANTERNS.some(([lx, lz]) => Math.hypot(x - lx, z - lz) <= OLD_LAMP_AREA_RADIUS);
}

type Prim = Gltf["meshes"][number]["primitives"][number];

/** 소품 묶음(props)의 삼각형 가운데 점 셋이 모두 옛 가로등 자리 안에 있는 것의 수. */
export function propsTrianglesInOldLamps(glb: Glb): number {
  const root = rootIndex(glb, "props");
  if (root < 0) return 0;
  const matrices = worldMatrices(glb);
  let count = 0;
  for (const node of meshNodesUnder(glb, root)) {
    const m = matrices.get(node)!;
    for (const prim of glb.json.meshes[glb.json.nodes[node].mesh!].primitives) {
      const world = accessorValues(glb, prim.attributes.POSITION).map(([x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      const index = prim.indices !== undefined ? accessorValues(glb, prim.indices).map((v) => v[0]) : [...world.keys()];
      for (let i = 0; i + 2 < index.length; i += 3) if ([index[i], index[i + 1], index[i + 2]].every((v) => inOldLampArea(world[v]))) count += 1;
    }
  }
  return count;
}

/** 가로등 불빛 판 묶음(glow-lamp-0~3) 이름인가. 건물 창 불빛(glow-windows)은 아니다. */
export const isLampGlowRoot = (name: string): boolean => /^glow-lamp(-|$)/.test(name);

/**
 * 옛 Kenney 가로등과 불빛 판을 뺀 마을 모델: (1) 장면 뿌리 가운데 이름이 glow-lamp로 시작하는 묶음을 장면에서 뺀다(2) 소품 묶음(props)에서 점 셋이 모두 옛 가로등 자리 안에 있는 삼각형을 뺀다
 * (남는 삼각형이 쓰는 점만 새 POSITION으로, 삼각형은 새 인덱스로 적는다. 바뀐 프리미티브에는 POSITION만 남긴다. 삼각형이 모두 빠진 프리미티브는 빼고, 프리미티브가 모두 빠진 메시 노드는 메시 없는 노드로 둔다).
 * 그 밖(다른 묶음, 소품의 다른 조각)은 그대로라 기존 테스트의 묶음 견주기에 그대로 넘긴다. 이미 가로등이 없는 모델에는 아무것도 바꾸지 않는다(118의 withoutFountainGlb118과 같은 방법).
 */
export function withoutLanternsGlb120(glb: Glb): Glb {
  const json = JSON.parse(JSON.stringify(glb.json)) as Gltf;
  const scene = json.scenes[json.scene ?? 0];
  scene.nodes = scene.nodes.filter((i) => !isLampGlowRoot(json.nodes[i].name ?? ""));
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
        if (!t.every((v) => inOldLampArea(world[v]))) tris.push(...t);
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

/** 옛 분수(118)와 옛 가로등·불빛 판(120)을 모두 뺀 모양. 마을 모델 파일을 기준 커밋과 견주는 기존 테스트가 양쪽에 씌운다. */
export const withoutFountainAndLanternsGlb120 = (glb: Glb): Glb => withoutLanternsGlb120(withoutFountainGlb118(glb));

/** 장면 뿌리 묶음 이름(정렬). */
export const rootNames120 = (glb: Glb): string[] => sceneRoots(glb).map((i) => glb.json.nodes[i].name ?? "").sort();
