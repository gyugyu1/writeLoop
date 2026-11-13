import { useLoader } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { WearSlot, WearState } from "@/lib/lobby3d/wear";
import { characterOutlineMaterial, type CharacterOutlineUniforms, type ToonKit } from "./lobby3d-character";

// 라룹이 착용 시험(캐릭터 꾸미기 ① 기술 시험). 착용 모델(lobby-wearables.glb, scripts/lobby3d/build-wearables.py)의
// 모자는 머리 뼈, 신발은 발 뼈에 붙이고(자리는 라룹이 쉬는 자세 기준), 상의·하의 껍질은 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
// 신발은 모델에 왼쪽 한 짝만 들어 있으면 좌우로 뒤집어(라룹이는 x = 0 기준으로 좌우가 같다) 오른발에도 붙인다.
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

const RIGID: Partial<Record<string, { slot: WearSlot; bone: string }>> = {
  "wear-hat": { slot: "hat", bone: "head" },
  "wear-shoe-l": { slot: "shoes", bone: "foot_l" },
  "wear-shoe-r": { slot: "shoes", bone: "foot_r" }
};
const SKINNED: Partial<Record<string, WearSlot>> = { "wear-top": "top", "wear-bottom": "bottom" };

interface BuiltWear {
  slot: WearSlot;
  objects: THREE.Object3D[];
}

export function Wearables({ host, wear }: { host: WearHost; wear: WearState }) {
  const gltf = useLoader(GLTFLoader, WEAR_ASSET as string) as GLTF;
  const built = useMemo(() => {
    const items: BuiltWear[] = [];
    const materials: THREE.MeshToonMaterial[] = [];
    const disposables: (THREE.Material | THREE.BufferGeometry)[] = [];
    const skeleton = host.body.skeleton;
    const boneIndex = new Map(skeleton.bones.map((bone, i) => [bone.name, i]));
    const toon = (source: THREE.Material) => {
      const s = source as THREE.MeshStandardMaterial;
      if (s.map) s.map.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshToonMaterial({ map: s.map ?? null, color: s.map ? 0xffffff : s.color.clone(), gradientMap: host.kit.gradient });
      materials.push(m);
      disposables.push(m);
      return m;
    };
    const outlineFor = () => {
      const m = characterOutlineMaterial(host.uniforms);
      disposables.push(m);
      return m;
    };
    const sources: { source: THREE.Mesh; name: string; mirror: boolean }[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (RIGID[o.name] || SKINNED[o.name])) sources.push({ source: o as THREE.Mesh, name: o.name, mirror: false });
    });
    // 오른쪽 신발이 따로 없으면 왼쪽 신발을 뒤집어 쓴다
    const leftShoe = sources.find((s) => s.name === "wear-shoe-l");
    if (leftShoe && !sources.some((s) => s.name === "wear-shoe-r")) sources.push({ source: leftShoe.source, name: "wear-shoe-r", mirror: true });
    for (const { source, name, mirror } of sources) {
      const rigid = RIGID[name];
      if (rigid) {
        const bone = skeleton.bones[boneIndex.get(rigid.bone) ?? -1];
        if (!bone) continue;
        // 쉬는 자세의 그 뼈에 대한 자리: (뼈의 묶음 역행렬) × (몸의 묶음 행렬) × (모델 좌표의 자리)
        source.updateWorldMatrix(true, false);
        const local = new THREE.Matrix4()
          .multiplyMatrices(skeleton.boneInverses[boneIndex.get(rigid.bone)!], host.body.bindMatrix)
          .multiply(source.matrixWorld);
        const geometry = source.geometry.clone();
        if (mirror) {
          // 모델 좌표에서 x를 뒤집는다(자리째 반대쪽 발로 간다). 음수 배율로 그리면 three가 앞뒷면을 알아서 바꿔 그린다
          local.copy(
            new THREE.Matrix4()
              .multiplyMatrices(skeleton.boneInverses[boneIndex.get(rigid.bone)!], host.body.bindMatrix)
              .multiply(new THREE.Matrix4().makeScale(-1, 1, 1))
              .multiply(source.matrixWorld)
          );
        }
        const group = new THREE.Group();
        local.decompose(group.position, group.quaternion, group.scale);
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        disposables.push(geometry);
        const mesh = new THREE.Mesh(geometry, toon(source.material as THREE.Material));
        const shell = new THREE.Mesh(geometry, outlineFor());
        for (const m of [mesh, shell]) {
          m.raycast = () => {};
          m.frustumCulled = false;
        }
        group.add(mesh, shell);
        group.visible = false;
        bone.add(group);
        items.push({ slot: rigid.slot, objects: [group] });
        continue;
      }
      const slot = SKINNED[source.name]!;
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
      const mesh = new THREE.SkinnedMesh(geometry, toon(source.material as THREE.Material));
      const shell = new THREE.SkinnedMesh(geometry, outlineFor());
      for (const m of [mesh, shell]) {
        m.bind(skeleton, host.body.bindMatrix);
        m.raycast = () => {};
        m.frustumCulled = false;
        m.visible = false;
        host.body.parent?.add(m);
      }
      items.push({ slot, objects: [mesh, shell] });
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

  useEffect(() => {
    for (const item of built.items) for (const o of item.objects) o.visible = wear[item.slot];
  }, [built, wear]);

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
