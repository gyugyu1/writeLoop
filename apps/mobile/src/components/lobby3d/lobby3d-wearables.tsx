import { useLoader } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WEARABLE_ITEMS, lookOfWear, type WearLook, type WearState } from "@/lib/lobby3d/wear";
import type { WardrobeSlot } from "@/lib/types";
import { characterOutlineMaterial, type CharacterOutlineUniforms, type ToonKit } from "./lobby3d-character";

// 라룹이 착용 아이템(캐릭터 꾸미기 ①·⑤). 착용 모델(lobby-wearables.glb, scripts/lobby3d/build-wearables.py)의
// 모자·선글라스는 머리 뼈, 백팩·머플러·목걸이는 몸통 뼈, 신발은 발 뼈에 붙이고(자리는 라룹이 쉬는 자세 기준),
// 상의·하의 껍질은 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
// 신발은 모델에 왼쪽 한 짝만 들어 있으면 좌우로 뒤집어(라룹이는 x = 0 기준으로 좌우가 같다) 오른발에도 붙인다.
// 부위마다 입은 아이템(WearLook)의 모델만 보이고, 아이템에 색이 있으면 그 모델을 그 색으로 칠한다(같은 모양의 다른 색 아이템).
// 라룹이와 같은 카툰 명암(명암 단계 설정)과 갈색 외곽선(굵기 설정)으로 그린다. 이 모듈은 착용한 것이 있을 때 처음 불러온다.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WEAR_ASSET = require("../../../assets/models/lobby-wearables.glb");

/** 라룹이 쪽에서 넘겨 주는 것: 모델 뿌리(착용 모델을 같은 좌표로 둔다), 몸 메시(뼈대·묶음 행렬), 외곽선 설정, 카툰 명암. */
export interface WearHost {
  model: THREE.Object3D;
  body: THREE.SkinnedMesh;
  uniforms: CharacterOutlineUniforms;
  kit: ToonKit;
}

/** 뼈에 단단히 붙이는 모델과 그 뼈. */
const RIGID: Partial<Record<string, string>> = {
  "wear-hat": "head",
  "wear-hat-blue": "head",
  "wear-hat-green": "head",
  "wear-sunglasses": "head",
  "wear-backpack": "spine",
  "wear-muffler": "spine",
  "wear-necklace": "spine",
  "wear-shoe-l": "foot_l",
  "wear-shoe-r": "foot_r"
};
/** 라룹이 뼈대로 휘는 껍질. */
const SKINNED: ReadonlySet<string> = new Set(["wear-top", "wear-bottom"]);

/** 모델 안 이름 → 아이템 목록의 모델 이름(신발 두 짝은 하나로 본다). */
function modelOf(name: string): string {
  return name === "wear-shoe-l" || name === "wear-shoe-r" ? "wear-shoe" : name;
}

const LOOK_SLOTS: readonly WardrobeSlot[] = ["hat", "top", "bottom", "shoes", "face", "back", "accessory"];

interface BuiltWear {
  model: string;
  objects: THREE.Object3D[];
  /** 겉면 재질과 모델의 원래 색(아이템 색이 없을 때 돌아갈 색). */
  surfaces: { material: THREE.MeshToonMaterial; base: THREE.Color }[];
}

/** 노드 아래의 메시들(여러 재질이면 glTF 불러오기가 묶음 아래 메시 여럿으로 만든다). */
function meshesOf(node: THREE.Object3D): THREE.Mesh[] {
  if ((node as THREE.Mesh).isMesh) return [node as THREE.Mesh];
  const list: THREE.Mesh[] = [];
  node.traverse((o) => {
    if (o !== node && (o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh);
  });
  return list;
}

export function Wearables({ host, wear, look }: { host: WearHost; wear: WearState; look?: WearLook | null }) {
  const gltf = useLoader(GLTFLoader, WEAR_ASSET as string) as GLTF;
  const built = useMemo(() => {
    const items: BuiltWear[] = [];
    const materials: THREE.MeshToonMaterial[] = [];
    const disposables: (THREE.Material | THREE.BufferGeometry)[] = [];
    const skeleton = host.body.skeleton;
    const boneIndex = new Map(skeleton.bones.map((bone, i) => [bone.name, i]));
    const toon = (source: THREE.Material, surfaces: BuiltWear["surfaces"]) => {
      const s = source as THREE.MeshStandardMaterial;
      if (s.map) s.map.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshToonMaterial({ map: s.map ?? null, color: s.map ? 0xffffff : s.color.clone(), gradientMap: host.kit.gradient });
      materials.push(m);
      disposables.push(m);
      surfaces.push({ material: m, base: m.color.clone() });
      return m;
    };
    const outlineFor = () => {
      const m = characterOutlineMaterial(host.uniforms);
      disposables.push(m);
      return m;
    };
    const sources: { node: THREE.Object3D; name: string; mirror: boolean }[] = [];
    gltf.scene.traverse((o) => {
      if (RIGID[o.name] || SKINNED.has(o.name)) sources.push({ node: o, name: o.name, mirror: false });
    });
    // 오른쪽 신발이 따로 없으면 왼쪽 신발을 뒤집어 쓴다
    const leftShoe = sources.find((s) => s.name === "wear-shoe-l");
    if (leftShoe && !sources.some((s) => s.name === "wear-shoe-r")) sources.push({ node: leftShoe.node, name: "wear-shoe-r", mirror: true });
    for (const { node, name, mirror } of sources) {
      const boneName = RIGID[name];
      const surfaces: BuiltWear["surfaces"] = [];
      if (boneName) {
        const index = boneIndex.get(boneName);
        const bone = index === undefined ? undefined : skeleton.bones[index];
        if (!bone || index === undefined) continue;
        // 쉬는 자세의 그 뼈에 대한 자리: (뼈의 묶음 역행렬) × (몸의 묶음 행렬) × (모델 좌표의 자리)
        node.updateWorldMatrix(true, true);
        const toBone = new THREE.Matrix4().multiplyMatrices(skeleton.boneInverses[index], host.body.bindMatrix);
        // 모델 좌표에서 x를 뒤집는다(자리째 반대쪽 발로 간다). 음수 배율로 그리면 three가 앞뒷면을 알아서 바꿔 그린다
        if (mirror) toBone.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
        const group = new THREE.Group();
        for (const source of meshesOf(node)) {
          const local = toBone.clone().multiply(source.matrixWorld);
          const part = new THREE.Group();
          local.decompose(part.position, part.quaternion, part.scale);
          const geometry = source.geometry.clone();
          if (!geometry.attributes.normal) geometry.computeVertexNormals();
          disposables.push(geometry);
          const mesh = new THREE.Mesh(geometry, toon(source.material as THREE.Material, surfaces));
          const shell = new THREE.Mesh(geometry, outlineFor());
          for (const m of [mesh, shell]) {
            m.raycast = () => {};
            m.frustumCulled = false;
          }
          part.add(mesh, shell);
          group.add(part);
        }
        group.visible = false;
        bone.add(group);
        items.push({ model: modelOf(name), objects: [group], surfaces });
        continue;
      }
      const objects: THREE.Object3D[] = [];
      for (const source of meshesOf(node)) {
        const from = (source as THREE.SkinnedMesh).skeleton;
        if (!from) continue;
        // 착용 모델의 뼈 번호를 라룹이 뼈대의 번호로 바꾼다(이름이 같다)
        const geometry = source.geometry.clone();
        disposables.push(geometry);
        const skinIndex = geometry.attributes.skinIndex as THREE.BufferAttribute;
        const remap = from.bones.map((bone) => boneIndex.get(bone.name) ?? 0);
        for (let i = 0; i < skinIndex.count; i += 1) {
          for (let k = 0; k < 4; k += 1) skinIndex.setComponent(i, k, remap[skinIndex.getComponent(i, k)] ?? 0);
        }
        skinIndex.needsUpdate = true;
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        const mesh = new THREE.SkinnedMesh(geometry, toon(source.material as THREE.Material, surfaces));
        const shell = new THREE.SkinnedMesh(geometry, outlineFor());
        for (const m of [mesh, shell]) {
          m.bind(skeleton, host.body.bindMatrix);
          m.raycast = () => {};
          m.frustumCulled = false;
          m.visible = false;
          host.body.parent?.add(m);
          objects.push(m);
        }
      }
      items.push({ model: modelOf(name), objects, surfaces });
    }
    return { items, materials, disposables };
  }, [gltf, host]);

  // 카툰 명암 단계를 바꾸면 라룹이와 함께 바뀌게 명암 목록에 넣는다
  useEffect(() => {
    host.kit.toonMaterials.push(...built.materials);
    return () => {
      for (const m of built.materials) {
        const i = host.kit.toonMaterials.indexOf(m);
        if (i >= 0) host.kit.toonMaterials.splice(i, 1);
      }
      for (const item of built.items) for (const o of item.objects) o.removeFromParent();
      built.disposables.forEach((d) => d.dispose());
    };
  }, [built, host]);

  // 부위마다 입은 아이템의 모델만 보이고, 아이템 색이 있으면 칠한다(없으면 모델 색)
  const shown = look ?? lookOfWear(wear);
  const key = LOOK_SLOTS.map((slot) => shown[slot] ?? "").join("|");
  useEffect(() => {
    const color = new Map<string, string | undefined>();
    for (const slot of LOOK_SLOTS) {
      const type = shown[slot];
      const info = type ? WEARABLE_ITEMS[type] : undefined;
      if (info && info.slot === slot) color.set(info.model, info.color);
    }
    for (const item of built.items) {
      const visible = color.has(item.model);
      for (const o of item.objects) o.visible = visible;
      if (!visible) continue;
      const tint = color.get(item.model);
      for (const { material, base } of item.surfaces) {
        if (tint) material.color.set(tint);
        else material.color.copy(base);
      }
    }
  }, [built, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/** 착용 모델을 불러오지 못하면 라룹이는 그대로 둔다(착용 버튼을 눌러도 아무것도 붙지 않는다). */
export class WearablesErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 착용 모델을 불러오지 못했습니다", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
