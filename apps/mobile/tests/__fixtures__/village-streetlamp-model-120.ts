// qa 테스트 도우미(작업 120 마을 가로등 교체): 새 가로등 모델(village-streetlamp.glb)을 three.js GLTFLoader가 푼 모양(GLTF)으로 만든다.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). three를 읽으므로 쓰는 테스트가 three를 node의 것으로 바꿔 둔다(다른 도우미와 같다).
//
// GLTFLoader가 푼 모양을 따른다(코드: three/examples/jsm/loaders/GLTFLoader.js):
// - 장면 Group(이름 Scene) 아래 메시 하나(프리미티브 하나라 Mesh 하나). 노드 이름은 공백을 _로 바꾼 이름(WriteLoop_Village_Streetlamp).
// - 도형은 position·normal·uv·번호(삼각형 930개).
// - 재질은 확장이 없어 MeshStandardMaterial이다. 이름·거칠기(0.7)·금속성(0)은 glb 그대로, 색 그림(map, sRGB, flipY false)과 발광 그림(emissiveMap, sRGB, flipY false),
//   emissive (1, 1, 1)(emissiveFactor)이고 emissiveIntensity는 1이다(KHR_materials_emissive_strength가 없다).
import * as THREE from "three";
import { accessorValues, type Glb } from "./village-glb-098";
import { LAMP_NODE_NAME, lampAssetExists, lampAssetGlb } from "./village-streetlamp-120";

export type LampGltf = {
  scene: THREE.Group;
  scenes: THREE.Group[];
  animations: THREE.AnimationClip[];
  cameras: unknown[];
  asset: Record<string, unknown>;
  parser: Record<string, unknown>;
  userData: Record<string, unknown>;
};

type MaterialDef = {
  name?: string;
  emissiveFactor?: number[];
  emissiveTexture?: { index: number };
  pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number }; metallicFactor?: number; roughnessFactor?: number };
};

/** 모델 파일을 GLTFLoader가 푼 모양으로 만든다. 부를 때마다 새 객체다. */
export function buildLampGltf(glb: Glb = lampAssetGlb()): LampGltf {
  const json = glb.json;
  const scene = new THREE.Group();
  scene.name = "Scene";
  const textures = new Map<number, THREE.Texture>();
  const texture = (at: number, name: string) => {
    if (!textures.has(at)) {
      const t = new THREE.Texture();
      t.name = name;
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      textures.set(at, t);
    }
    return textures.get(at)!;
  };
  for (const index of json.scenes[json.scene ?? 0].nodes) {
    const node = json.nodes[index];
    const prim = json.meshes[node.mesh!].primitives[0];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(accessorValues(glb, prim.attributes.POSITION).flat(), 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(accessorValues(glb, prim.attributes.NORMAL).flat(), 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(accessorValues(glb, prim.attributes.TEXCOORD_0).flat(), 2));
    if (prim.indices !== undefined) geometry.setIndex(accessorValues(glb, prim.indices).flat());
    const def = (json.materials ?? [])[prim.material ?? 0] as unknown as MaterialDef;
    const pbr = def.pbrMetallicRoughness ?? {};
    const material = new THREE.MeshStandardMaterial();
    material.name = def.name ?? "";
    material.color.setRGB(...((pbr.baseColorFactor ?? [1, 1, 1]).slice(0, 3) as [number, number, number]));
    material.metalness = pbr.metallicFactor ?? 1;
    material.roughness = pbr.roughnessFactor ?? 1;
    if (pbr.baseColorTexture) material.map = texture(json.textures![pbr.baseColorTexture.index].source!, "lamp_color");
    material.emissive.setRGB(...((def.emissiveFactor ?? [0, 0, 0]) as [number, number, number]));
    if (def.emissiveTexture) material.emissiveMap = texture(json.textures![def.emissiveTexture.index].source!, "lamp_emission_mobile");
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = (node.name ?? "").replace(/\s/g, "_");
    scene.add(mesh);
  }
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

/** 지금 가로등 파일이 있으면 푼 모양을, 없으면(구현 전) 아무것도 없는 빈 모양(장면 비어 있음)을 준다. 기존 테스트의 가짜 불러오기가 쓴다. */
export function lampGltfOrEmpty(): LampGltf {
  if (lampAssetExists()) return buildLampGltf();
  const scene = new THREE.Group();
  scene.name = "Scene";
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

let shared: LampGltf | null = null;

/** react-three-fiber useLoader의 캐시처럼 같은 객체를 돌려주는 가짜 불러오기용(테스트 파일 하나 안에서 같은 파일에는 같은 모델). */
export function sharedLampGltf(): LampGltf {
  if (!shared) shared = lampGltfOrEmpty();
  return shared;
}

export { LAMP_NODE_NAME };
