// qa 테스트 도우미(작업 113 새 나무 모델 넣기): 나무 GLB 넷(WriteLoop_Tree_<A·Pine>_LOD<1·2>.glb. 116: 113의 A·B·C 여섯에서 바뀜)을 Jest에서 쓸 때의 가짜 불러오기와 나무 알아보기.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다).
//
// - 나무 파일 이름·자리 찾기와 require 가짜(mockTreeAssets)는 tree-files-113.ts에 있다(여기서 다시 내보낸다).
// - 가짜 나무 모델(treeGltf)은 three.js GLTFLoader가 이 파일을 푼 모양을 따른다: 장면 아래 노드마다 메시(이름 Tree_Foliage·Tree_Wood),
//   도형은 position·normal·uv·번호, 재질은 MeshStandardMaterial(이름 Foliage·Bark, 색 흰색, 잎은 alphaTest 0.5·양면), 그림은 GLB마다 새 THREE.Texture
//   (이름 = glTF 그림 이름, flipY false, sRGB). 그림 내용은 앱의 그림 읽기(texture-file-loader)처럼 image.data.localUri에 그림 바이트의 sha256 이름으로 둔다.
//   같은 바이트의 그림도 GLB마다 다른 Texture다(GLTFLoader는 파일마다 따로 푼다). 같은 그림을 한 번만 쓰는 것은 앱이 할 일이다.
//   주의: 그림 이름이 같아도 바이트가 다를 수 있다(그림 내용은 바이트 sha256으로 가른다).
// - 가짜 useLoader(treeUseLoader)는 나무 파일(이름이 WriteLoop_Tree_<종류>_LOD<단계>.glb)에는 위 가짜 모델을, 그 밖에는 넘겨받은 다른 가짜에 맡긴다.
//   같은 묶음(resetTreeLoader 사이) 안에서는 같은 파일에 같은 모델 객체를 준다(react-three-fiber useLoader의 캐시처럼).
//   treeLoader.fail을 넣으면 나무 파일을 읽을 때 그 오류를 던진다(react-three-fiber useLoader는 읽기에 실패하면 그리기 중에 그 오류를 던진다).
// - 나무 알아보기(treePartOf): 그린 인스턴스 메시의 도형을 점 자리(소수 넷째 자리)로 네 파일의 두 메시 도형과 맞춘다(앱이 도형을 복제해도 알아본다).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import * as THREE from "three";
import { accessorValues, imageBytes, imageSize, parseGlb, type Glb } from "./village-glb-098";
import { TREE_FILES, TREE_FILE_RE, findTreeFiles, isTreeUrl, treeFileName, type TreeKind, type TreeLod } from "./tree-files-113";

export { MODELS_DIR, TREE_FILES, TREE_KINDS, TREE_LODS, findTreeFiles, isTreeUrl, mockTreeAssets, treeAssetPath, treeAssetRel, treeFileName } from "./tree-files-113";
export type { TreeKind, TreeLod } from "./tree-files-113";

export const TREE_PARTS = ["foliage", "wood"] as const;
export type TreePart = (typeof TREE_PARTS)[number];
export type TreePartInfo = { kind: TreeKind; lod: TreeLod; part: TreePart; file: string };

/** 메시 이름(glTF 노드 이름) → 부품. */
const NODE_PART: Record<string, TreePart> = { Tree_Foliage: "foliage", Tree_Wood: "wood" };

/** 명세 "새 나무 모델": 계절마다 glTF UV에 더하는 값(잎). 겨울 칸은 비어 있다. */
export const FOLIAGE_OFFSET = {
  spring: [0, 0],
  summer: [0.5, 0],
  autumn: [0, 0.5],
  winter: [0.5, 0.5]
} as const;
/** 명세 "새 나무 모델": 줄기는 겨울에만 (0.5, 0)을 더한다. */
export const woodOffset = (season: keyof typeof FOLIAGE_OFFSET): readonly [number, number] => (season === "winter" ? [0.5, 0] : [0, 0]);

// ---------- 파일 풀기 ----------

type PartData = { positions: number[][]; uvs: number[][]; normals: number[][]; index: number[]; material: number };
type ParsedTree = { name: string; kind: TreeKind; lod: TreeLod; glb: Glb; parts: Record<TreePart, PartData> };

const parsed = new Map<string, ParsedTree | null>();

/** 나무 파일 하나를 푼다(없으면 null). */
export function parsedTree(name: string): ParsedTree | null {
  if (parsed.has(name)) return parsed.get(name)!;
  const path = findTreeFiles().get(name)?.[0];
  if (!path) {
    parsed.set(name, null);
    return null;
  }
  const glb = parseGlb(readFileSync(path));
  const m = TREE_FILE_RE.exec(name)!;
  const parts = {} as Record<TreePart, PartData>;
  for (const node of glb.json.nodes) {
    const part = NODE_PART[node.name ?? ""];
    if (!part || node.mesh === undefined) continue;
    const prim = glb.json.meshes[node.mesh].primitives[0];
    parts[part] = {
      positions: accessorValues(glb, prim.attributes.POSITION),
      normals: accessorValues(glb, prim.attributes.NORMAL),
      uvs: accessorValues(glb, prim.attributes.TEXCOORD_0),
      index: accessorValues(glb, prim.indices!).flat(),
      material: prim.material ?? 0
    };
  }
  const tree = { name, kind: m[1] as TreeKind, lod: Number(m[2]) as TreeLod, glb, parts };
  parsed.set(name, tree);
  return tree;
}

/** 네 파일이 모두 앱 자산 폴더에 있는가. */
export const allTreeFilesPresent = () => TREE_FILES.every((n) => parsedTree(n) !== null);

/** 그 파일·부품의 원래 glTF UV(점마다 [u, v]). */
export function originalUvs(kind: TreeKind, lod: TreeLod, part: TreePart): number[][] {
  return parsedTree(treeFileName(kind, lod))!.parts[part].uvs;
}

/** 그 파일·부품 그림의 내용 이름(앱의 그림 읽기처럼 바이트 sha256). */
export function imageKeyOf(kind: TreeKind, lod: TreeLod, part: TreePart): string {
  const tree = parsedTree(treeFileName(kind, lod))!;
  const material = (tree.glb.json.materials ?? [])[tree.parts[part].material] as { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } };
  const textureIndex = material.pbrMetallicRoughness!.baseColorTexture!.index;
  const imageIndex = (tree.glb.json.textures ?? [])[textureIndex].source!;
  return createHash("sha256").update(imageBytes(tree.glb, imageIndex)).digest("hex");
}

// ---------- 가짜 모델 ----------

type TextureDef = { source?: number };
type MaterialDef = {
  name?: string;
  alphaMode?: string;
  alphaCutoff?: number;
  doubleSided?: boolean;
  pbrMetallicRoughness?: { baseColorTexture?: { index: number } };
};

/** GLTFLoader가 푼 모양의 나무 모델(새 객체). */
export function buildTreeGltf(name: string): { scene: THREE.Group; scenes: THREE.Group[]; animations: unknown[]; cameras: unknown[]; asset: object; parser: object; userData: object } {
  const tree = parsedTree(name);
  if (!tree) throw new Error(`나무 파일이 앱 자산 폴더에 없음: ${name}`);
  const json = tree.glb.json;
  const textures = new Map<number, THREE.Texture>();
  const textureOf = (index: number) => {
    if (!textures.has(index)) {
      const imageIndex = ((json.textures ?? []) as TextureDef[])[index].source!;
      const bytes = imageBytes(tree.glb, imageIndex);
      const image = (json.images ?? [])[imageIndex];
      const size = imageSize(bytes) ?? { width: 0, height: 0 };
      const ext = image.mimeType === "image/jpeg" ? "jpeg" : "png";
      const texture = new THREE.Texture();
      texture.name = image.name ?? "";
      texture.image = { data: { localUri: `file:///cache/model-image-${createHash("sha256").update(bytes).digest("hex")}.${ext}` }, width: size.width, height: size.height };
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      textures.set(index, texture);
    }
    return textures.get(index)!;
  };
  const materials = ((json.materials ?? []) as MaterialDef[]).map((def) => {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 });
    material.name = def.name ?? "";
    const ref = def.pbrMetallicRoughness?.baseColorTexture;
    if (ref) material.map = textureOf(ref.index);
    if (def.alphaMode === "MASK") material.alphaTest = def.alphaCutoff ?? 0.5;
    if (def.doubleSided) material.side = THREE.DoubleSide;
    return material;
  });
  const scene = new THREE.Group();
  scene.name = "Scene";
  for (const index of json.scenes[json.scene ?? 0].nodes) {
    const node = json.nodes[index];
    const part = NODE_PART[node.name ?? ""];
    if (!part) continue;
    const data = tree.parts[part];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions.flat(), 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals.flat(), 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs.flat(), 2));
    geometry.setIndex(data.index);
    const mesh = new THREE.Mesh(geometry, materials[data.material]);
    mesh.name = node.name ?? "";
    scene.add(mesh);
  }
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

export const treeLoader: { fail: Error | null; calls: unknown[]; session: Map<string, unknown> } = { fail: null, calls: [], session: new Map() };

export function resetTreeLoader(): void {
  treeLoader.fail = null;
  treeLoader.calls = [];
  treeLoader.session.clear();
}

/** 같은 묶음 안에서 같은 파일에 같은 모델 객체. */
export function treeGltf(url: string): unknown {
  const name = basename(url);
  if (!treeLoader.session.has(name)) treeLoader.session.set(name, buildTreeGltf(name));
  return treeLoader.session.get(name);
}

/** 나무 파일은 가짜 나무 모델, 그 밖은 fallback. 나무 파일이 하나도 없는 부름은 그대로 fallback에 넘긴다. */
export function treeUseLoader(loader: unknown, input: unknown, fallback: (loader: unknown, input: unknown) => unknown): unknown {
  const list = Array.isArray(input) ? input : [input];
  if (!list.some(isTreeUrl)) return fallback(loader, input);
  treeLoader.calls.push(input);
  if (treeLoader.fail) throw treeLoader.fail;
  const one = (url: unknown) => (isTreeUrl(url) ? treeGltf(url) : fallback(loader, url));
  return Array.isArray(input) ? input.map(one) : one(input);
}

// ---------- 나무 알아보기 ----------

const fingerprintOfPoints = (count: number, at: (i: number, k: number) => number) => {
  const hash = createHash("sha1");
  for (let i = 0; i < count; i += 1) hash.update(`${at(i, 0).toFixed(4)},${at(i, 1).toFixed(4)},${at(i, 2).toFixed(4)};`);
  return `${count}:${hash.digest("hex")}`;
};

let known: Map<string, TreePartInfo> | null = null;

function knownParts(): Map<string, TreePartInfo> {
  if (known) return known;
  known = new Map();
  for (const name of TREE_FILES) {
    const tree = parsedTree(name);
    if (!tree) continue;
    for (const part of TREE_PARTS) {
      const pts = tree.parts[part].positions;
      known.set(
        fingerprintOfPoints(pts.length, (i, k) => Math.fround(pts[i][k])),
        { kind: tree.kind, lod: tree.lod, part, file: name }
      );
    }
  }
  return known;
}

const partCache = new WeakMap<THREE.BufferGeometry, TreePartInfo | null>();

/** 도형이 나무 모델의 어느 파일·부품인가(아니면 null). */
export function treePartOf(geometry: THREE.BufferGeometry): TreePartInfo | null {
  if (partCache.has(geometry)) return partCache.get(geometry)!;
  const pos = geometry.getAttribute("position");
  let info: TreePartInfo | null = null;
  if (pos) info = knownParts().get(fingerprintOfPoints(pos.count, (i, k) => pos.getComponent(i, k))) ?? null;
  partCache.set(geometry, info);
  return info;
}

/**
 * 메시가 그리는 그림 좌표가 원래 glTF UV + offset인지: 점마다 (도형의 uv를 재질 그림의 변환 행렬로 옮긴 것) − (원래 UV + offset)의 가장 큰 차이.
 * 그림 변환은 three.js가 그릴 때처럼 matrixAutoUpdate면 offset·repeat·rotation·center로 다시 만든다. 그림이 없으면 Infinity.
 */
export function uvShiftError(mesh: THREE.Mesh, info: TreePartInfo, offset: readonly [number, number] | readonly number[]): number {
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  const map = material.map;
  const uv = mesh.geometry.getAttribute("uv");
  if (!map || !uv) return Infinity;
  if (map.matrixAutoUpdate) map.updateMatrix();
  const original = originalUvs(info.kind, info.lod, info.part);
  const v = new THREE.Vector3();
  let worst = 0;
  const step = Math.max(1, Math.floor(uv.count / 200));
  for (let i = 0; i < uv.count; i += step) {
    v.set(uv.getX(i), uv.getY(i), 1).applyMatrix3(map.matrix);
    worst = Math.max(worst, Math.abs(v.x - (original[i][0] + offset[0])), Math.abs(v.y - (original[i][1] + offset[1])));
  }
  return worst;
}

/** 재질 그림의 내용 이름(가짜 모델이 image.data.localUri에 넣은 sha256). 없으면 null. */
export function imageKeyOfMaterial(mesh: THREE.Mesh): string | null {
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  const uri = (material.map?.image as { data?: { localUri?: string } } | undefined)?.data?.localUri ?? "";
  return /model-image-([0-9a-f]{64})\./.exec(uri)?.[1] ?? null;
}
