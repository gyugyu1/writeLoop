// qa 테스트 도우미(작업 118 마을 분수대 교체): 새 분수 모델(village-fountain.glb)을 three.js GLTFLoader가 푼 모양(GLTF)으로 만든다.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). three를 읽으므로 쓰는 테스트가 three를 node의 것으로 바꿔 둔다(다른 도우미와 같다).
//
// GLTFLoader가 푼 모양을 따른다(코드: three/examples/jsm/loaders/GLTFLoader.js):
// - 장면 Group(이름 Scene) 아래 노드마다 메시(프리미티브 하나라 Mesh 하나). 노드 이름은 공백을 _로 바꾼 이름(PropertyBinding.sanitizeNodeName).
// - 도형은 position·normal·uv(석재)·color(물, glTF COLOR_0)·번호. 물은 모프 타깃 셋(morphAttributes.position, 상대 값)이고 morphTargetInfluences [0, 0, 0],
//   morphTargetDictionary는 모델의 targetNames다.
// - 재질은 KHR_materials_specular가 있어 MeshPhysicalMaterial(specularIntensity)이다. 이름·거칠기·금속성은 glb 그대로. 석재는 색 그림(빈 Texture, sRGB, flipY false),
//   물은 정점색(vertexColors).
// - 클립(animations[0]) Fountain_Flow: 물 노드의 "<이름>.morphTargetInfluences" 숫자 키 트랙 하나, LINEAR. 키 시각은 모델 그대로(첫 키 0.0417초)다.
import * as THREE from "three";
import { accessorValues, type Glb, type Gltf } from "./village-glb-098";
import { CLIP_NAME, WATER_NODE_NAME, fountainAssetExists, fountainAssetGlb } from "./village-fountain-118";

export type FountainGltf = {
  scene: THREE.Group;
  scenes: THREE.Group[];
  animations: THREE.AnimationClip[];
  cameras: unknown[];
  asset: Record<string, unknown>;
  parser: Record<string, unknown>;
  userData: Record<string, unknown>;
};

const sanitize = (name: string) => name.replace(/\s/g, "_").replace(/[\[\]\.:\/]/g, "");

type MeshDef = Gltf["meshes"][number] & { extras?: { targetNames?: string[] }; weights?: number[] };
type MaterialDef = NonNullable<Gltf["materials"]>[number] & {
  extensions?: { KHR_materials_specular?: { specularFactor?: number } };
  pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number }; metallicFactor?: number; roughnessFactor?: number };
};

/** 모델 파일을 GLTFLoader가 푼 모양으로 만든다. 파일이 아직 없으면(구현 전) null이다. 부를 때마다 새 객체다. */
export function buildFountainGltf(glb: Glb = fountainAssetGlb()): FountainGltf {
  const json = glb.json as Gltf & { animations?: { name?: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number }[] }[] };
  const scene = new THREE.Group();
  scene.name = "Scene";
  const textures = new Map<number, THREE.Texture>();
  const targetNode = (json.animations ?? [])[0]?.channels[0].target.node;
  const sceneNodes = json.scenes[json.scene ?? 0].nodes;
  const names = new Map<number, string>();
  for (const index of sceneNodes) {
    const node = json.nodes[index];
    const def = json.meshes[node.mesh!] as MeshDef;
    const prim = def.primitives[0];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(accessorValues(glb, prim.attributes.POSITION).flat(), 3));
    if (prim.attributes.NORMAL !== undefined) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(accessorValues(glb, prim.attributes.NORMAL).flat(), 3));
    if (prim.attributes.TEXCOORD_0 !== undefined) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(accessorValues(glb, prim.attributes.TEXCOORD_0).flat(), 2));
    if (prim.attributes.COLOR_0 !== undefined) {
      const color = accessorValues(glb, prim.attributes.COLOR_0);
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(color.flat(), color[0].length));
    }
    if (prim.indices !== undefined) geometry.setIndex(accessorValues(glb, prim.indices).flat());
    const targets = (prim as unknown as { targets?: Record<string, number>[] }).targets;
    if (targets) {
      geometry.morphAttributes.position = targets.map((t) => new THREE.Float32BufferAttribute(accessorValues(glb, t.POSITION).flat(), 3));
      geometry.morphTargetsRelative = true;
    }
    const def2 = (json.materials ?? [])[prim.material ?? 0] as MaterialDef;
    const pbr = def2.pbrMetallicRoughness ?? {};
    const material = new THREE.MeshPhysicalMaterial();
    material.name = def2.name ?? "";
    material.color.setRGB(...((pbr.baseColorFactor ?? [1, 1, 1]).slice(0, 3) as [number, number, number]));
    material.metalness = pbr.metallicFactor ?? 1;
    material.roughness = pbr.roughnessFactor ?? 1;
    material.specularIntensity = def2.extensions?.KHR_materials_specular?.specularFactor ?? 1;
    if (pbr.baseColorTexture) {
      const at = pbr.baseColorTexture.index;
      if (!textures.has(at)) {
        const texture = new THREE.Texture();
        texture.name = `fountain-texture-${at}`;
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.set(at, texture);
      }
      material.map = textures.get(at)!;
    }
    if (prim.attributes.COLOR_0 !== undefined) material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = sanitize(node.name ?? "");
    names.set(index, mesh.name);
    if (targets) {
      mesh.updateMorphTargets();
      const targetNames = def.extras?.targetNames;
      if (targetNames) targetNames.forEach((n, i) => (mesh.morphTargetDictionary![n] = i));
      mesh.morphTargetInfluences = (def.weights ?? targets.map(() => 0)).slice();
    }
    scene.add(mesh);
  }
  const animations: THREE.AnimationClip[] = [];
  for (const animation of json.animations ?? []) {
    const tracks: THREE.KeyframeTrack[] = [];
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler];
      const times = accessorValues(glb, sampler.input).map((v) => v[0]);
      const values = accessorValues(glb, sampler.output).map((v) => v[0]);
      tracks.push(new THREE.NumberKeyframeTrack(`${names.get(channel.target.node ?? targetNode!)}.morphTargetInfluences`, times, values));
    }
    animations.push(new THREE.AnimationClip(animation.name ?? "", -1, tracks));
  }
  return { scene, scenes: [scene], animations, cameras: [], asset: {}, parser: {}, userData: {} };
}

/** 지금 분수 파일이 있으면 푼 모양을, 없으면(구현 전) 아무것도 없는 빈 모양(장면 비어 있음, 클립 없음)을 준다. 기존 테스트의 가짜 불러오기가 쓴다. */
export function fountainGltfOrEmpty(): FountainGltf {
  if (fountainAssetExists()) return buildFountainGltf();
  const scene = new THREE.Group();
  scene.name = "Scene";
  return { scene, scenes: [scene], animations: [], cameras: [], asset: {}, parser: {}, userData: {} };
}

let shared: FountainGltf | null = null;

/** react-three-fiber useLoader의 캐시처럼 같은 객체를 돌려주는 가짜 불러오기용(테스트 파일 하나 안에서 같은 파일에는 같은 모델). */
export function sharedFountainGltf(): FountainGltf {
  if (!shared) shared = fountainGltfOrEmpty();
  return shared;
}

export { CLIP_NAME, WATER_NODE_NAME };
