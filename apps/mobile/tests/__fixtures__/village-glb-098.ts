// qa 테스트 도우미(작업 098 마을 라룹이 집 교체): 마을 모델(lobby-village.glb)을 읽어 노드·메시·점 자리·그림 크기를 꺼낸다.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-home-swap.spec.test.ts와 lobby3d-village-home-model.spec.test.tsx가 함께 쓴다.
// glb의 좌표는 앱 좌표와 같다(x 오른쪽, y 위, z 앞. build-village.py 머리말: 앱 (x, y, z) = Blender (x, -y, z)이고 glTF 내보내기가 Z 위를 Y 위로 바꾼다).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const MOBILE = join(__dirname, "..", "..");
export const REPO = join(MOBILE, "..", "..");
export const VILLAGE_GLB_PATH = "apps/mobile/assets/models/lobby-village.glb";
export const LAYOUT_PATH = "apps/mobile/src/lib/lobby3d/village-layout.json";
export const CREDITS_PATH = "apps/mobile/assets/models/CREDITS.md";
/** 작업 098의 기준 커밋(명세 01-main-spec.md 첫 줄). 그대로 둘 동작은 이 커밋의 파일과 견준다. */
export const BASE = "95fc92f";

export type GltfNode = { name?: string; mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] };
export type GltfPrimitive = { attributes: Record<string, number>; indices?: number; material?: number };
export type Gltf = {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { name?: string; primitives: GltfPrimitive[] }[];
  accessors: { bufferView?: number; byteOffset?: number; count: number; componentType: number; type: string; min?: number[]; max?: number[] }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } } }[];
  textures?: { source?: number }[];
  images?: { bufferView?: number; mimeType?: string; name?: string }[];
};
export type Glb = { json: Gltf; bin: Buffer };

export function parseGlb(buf: Buffer): Glb {
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength + 8;
  return { json, bin: buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLength)) };
}

export const nowVillageGlb = () => parseGlb(readFileSync(join(REPO, VILLAGE_GLB_PATH)));
export const baseVillageGlb = () => parseGlb(baseFile(VILLAGE_GLB_PATH));
export const baseFile = (path: string) => execFileSync("git", ["show", `${BASE}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/** accessor 값(정규화하지 않은 날 값), 점마다 배열 하나. */
export function accessorValues(glb: Glb, index: number): number[][] {
  const a = glb.json.accessors[index];
  const view = glb.json.bufferViews[a.bufferView ?? 0];
  const n = COMPONENTS[a.type];
  const size = BYTES[a.componentType];
  const stride = view.byteStride ?? n * size;
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out: number[][] = [];
  for (let i = 0; i < a.count; i += 1) {
    const item: number[] = [];
    for (let k = 0; k < n; k += 1) {
      const o = start + i * stride + k * size;
      switch (a.componentType) {
        case 5126: item.push(glb.bin.readFloatLE(o)); break;
        case 5125: item.push(glb.bin.readUInt32LE(o)); break;
        case 5123: item.push(glb.bin.readUInt16LE(o)); break;
        case 5122: item.push(glb.bin.readInt16LE(o)); break;
        case 5121: item.push(glb.bin.readUInt8(o)); break;
        default: item.push(glb.bin.readInt8(o));
      }
    }
    out.push(item);
  }
  return out;
}

// ---------- 노드 변환(4×4, 열 우선) ----------

type Mat = number[];
const IDENTITY: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: Mat, b: Mat): Mat {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) for (let k = 0; k < 4; k += 1) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

function localMatrix(node: GltfNode): Mat {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1
  ];
}

/** 장면 뿌리 노드 번호들. */
export function sceneRoots(glb: Glb): number[] {
  return glb.json.scenes[glb.json.scene ?? 0].nodes;
}

/** 노드 번호 → 부모 번호(뿌리는 없음). */
export function parents(glb: Glb): Map<number, number> {
  const out = new Map<number, number>();
  glb.json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => out.set(c, i)));
  return out;
}

/** 노드 번호 → 세계 변환. */
export function worldMatrices(glb: Glb): Map<number, Mat> {
  const out = new Map<number, Mat>();
  const walk = (i: number, parent: Mat) => {
    const m = multiply(parent, localMatrix(glb.json.nodes[i]));
    out.set(i, m);
    (glb.json.nodes[i].children ?? []).forEach((c) => walk(c, m));
  };
  sceneRoots(glb).forEach((r) => walk(r, IDENTITY));
  return out;
}

/** 뿌리 노드 이름이 같은 노드 번호(없으면 -1). */
export function rootIndex(glb: Glb, name: string): number {
  return sceneRoots(glb).find((i) => glb.json.nodes[i].name === name) ?? -1;
}

/** 노드와 그 아래 모든 노드 번호. */
export function subtree(glb: Glb, index: number): number[] {
  const out: number[] = [];
  const walk = (i: number) => {
    out.push(i);
    (glb.json.nodes[i].children ?? []).forEach(walk);
  };
  walk(index);
  return out;
}

/** 노드 아래(자신 포함) 메시가 있는 노드 번호. */
export function meshNodesUnder(glb: Glb, index: number): number[] {
  return subtree(glb, index).filter((i) => glb.json.nodes[i].mesh !== undefined);
}

/** 메시 노드의 모든 점을 세계 좌표로. */
export function worldPoints(glb: Glb, nodeIndex: number, matrices = worldMatrices(glb)): [number, number, number][] {
  const m = matrices.get(nodeIndex) ?? IDENTITY;
  const mesh = glb.json.meshes[glb.json.nodes[nodeIndex].mesh!];
  const out: [number, number, number][] = [];
  for (const p of mesh.primitives) {
    for (const [x, y, z] of accessorValues(glb, p.attributes.POSITION)) {
      out.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
    }
  }
  return out;
}

/** 삼각형 수(인덱스가 없으면 점 수 / 3). */
export function triangleCount(glb: Glb, nodeIndex: number): number {
  const mesh = glb.json.meshes[glb.json.nodes[nodeIndex].mesh!];
  return mesh.primitives.reduce((sum, p) => sum + (p.indices !== undefined ? glb.json.accessors[p.indices].count : glb.json.accessors[p.attributes.POSITION].count) / 3, 0);
}

export type Box = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

export function boxOf(points: [number, number, number][]): Box {
  const box: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const [x, y, z] of points) {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
    box.minZ = Math.min(box.minZ, z);
    box.maxZ = Math.max(box.maxZ, z);
  }
  return box;
}

/** 그림 바이트(glb 안)의 가로·세로. PNG(IHDR)와 JPEG(SOF0~SOF15, DHT·JPG·DAC 빼고)를 읽는다. */
export function imageBytes(glb: Glb, imageIndex: number): Buffer {
  const image = glb.json.images![imageIndex];
  const view = glb.json.bufferViews[image.bufferView!];
  return glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}

export function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 4 <= bytes.length) {
      if (bytes[o] !== 0xff) return null;
      const marker = bytes[o + 1];
      const length = bytes.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: bytes.readUInt16BE(o + 7), height: bytes.readUInt16BE(o + 5) };
      }
      o += 2 + length;
    }
  }
  return null;
}
