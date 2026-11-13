import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useItemCatalog } from "@/lib/item-catalog-store";
import { cachedItemFile, fetchItemFile, itemFileFailed, useItemFiles } from "@/lib/item-files";
import { lookOfWear, wearDraw, type WearDraw, type WearLook, type WearState } from "@/lib/lobby3d/wear";
import type { WardrobeSlot } from "@/lib/types";
import { characterOutlineMaterial, type CharacterOutlineUniforms, type ToonKit } from "./lobby3d-character";

// 라룹이 착용 아이템(캐릭터 꾸미기 ①·⑤, 아이템 목록 ③).
// 입은 옷마다 받은 아이템 목록의 그리기 정보(wearDraw)와 모델 파일을 쓴다. 모델 파일은 처음 입을 때 서버에서 받아 기기에 두고(item-files),
// 받는 동안이나 받지 못했으면 그 옷은 그리지 않는다(받으면 바로 입힌다). 그릴 줄 모르는 옷(그리기 정보가 없거나 몸 판이 다름)도 그리지 않는다.
// - bone: 모델(라룹이 쉬는 자세 좌표)을 그 뼈에 단단히 붙인다(자리는 쉬는 자세 기준). mirror가 있으면 좌우로 뒤집어 그 뼈에도 붙인다(신발 오른짝).
// - skin: 모델의 뼈대로 휘는 껍질을 라룹이 뼈대에 뼈 이름으로 다시 묶는다.
// 아이템에 색이 있으면 모델을 그 색으로 칠한다(같은 모양의 다른 색 아이템). 라룹이와 같은 카툰 명암과 갈색 외곽선으로 그린다.
// 모델 파일은 scripts/lobby3d/split-wearables.py(묶음에서 나눔)·build-extra-wearables.py(서버로만 더한 옷)가 만든다. 이 모듈은 착용한 것이 있을 때 처음 불러온다.

/** 라룹이 쪽에서 넘겨 주는 것: 모델 뿌리(착용 모델을 같은 좌표로 둔다), 몸 메시(뼈대·묶음 행렬), 외곽선 설정, 카툰 명암. */
export interface WearHost {
  model: THREE.Object3D;
  body: THREE.SkinnedMesh;
  uniforms: CharacterOutlineUniforms;
  kit: ToonKit;
}

const LOOK_SLOTS: readonly WardrobeSlot[] = ["hat", "top", "bottom", "shoes", "face", "back", "accessory"];

/** 기기에 받은 모델 파일을 읽은 것(파일 해시 → 읽기). 읽지 못하면 지워 다음에 다시 읽는다. */
const MODELS = new Map<string, Promise<GLTF | null>>();

function loadWearModel(sha256: string, uri: string): Promise<GLTF | null> {
  let job = MODELS.get(sha256);
  if (!job) {
    job = new GLTFLoader().loadAsync(uri).catch((error: unknown) => {
      console.warn("[lobby3d] 착용 모델을 읽지 못했습니다", error);
      MODELS.delete(sha256);
      return null;
    });
    MODELS.set(sha256, job);
  }
  return job;
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
  // 받은 목록·받은 파일이 바뀌면 다시 고른다
  const catalog = useItemCatalog();
  const filesTick = useItemFiles();
  const shown = look ?? lookOfWear(wear);
  const key = LOOK_SLOTS.map((slot) => shown[slot] ?? "").join("|");
  const draws = useMemo(() => {
    const list: WearDraw[] = [];
    for (const slot of LOOK_SLOTS) {
      const draw = wearDraw(shown[slot]);
      if (draw && draw.slot === slot) list.push(draw);
    }
    return list;
  }, [key, catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  // 입은 옷의 모델: 기기에 있으면 읽고, 없으면 받기 시작한다(받으면 filesTick이 바뀌어 다시 온다)
  const [models, setModels] = useState<ReadonlyMap<string, GLTF>>(() => new Map());
  useEffect(() => {
    let alive = true;
    for (const { model } of draws) {
      if (models.has(model.sha256)) continue;
      const uri = cachedItemFile(model);
      if (!uri) {
        if (!itemFileFailed(model)) void fetchItemFile(model);
        continue;
      }
      void loadWearModel(model.sha256, uri).then((gltf) => {
        if (!alive || !gltf) return;
        setModels((current) => (current.has(model.sha256) ? current : new Map(current).set(model.sha256, gltf)));
      });
    }
    return () => {
      alive = false;
    };
  }, [draws, filesTick, models]);

  return (
    <>
      {draws.map((draw) => {
        const gltf = models.get(draw.model.sha256);
        return gltf ? <WearPiece key={`${draw.slot}:${draw.type}:${draw.model.sha256}`} host={host} draw={draw} gltf={gltf} /> : null;
      })}
    </>
  );
}

/** 옷 하나를 라룹이에 붙인다(사라지면 떼고 버린다). */
function WearPiece({ host, draw, gltf }: { host: WearHost; draw: WearDraw; gltf: GLTF }) {
  const built = useMemo(() => {
    const objects: THREE.Object3D[] = [];
    const materials: THREE.MeshToonMaterial[] = [];
    const disposables: (THREE.Material | THREE.BufferGeometry)[] = [];
    const skeleton = host.body.skeleton;
    const boneIndex = new Map(skeleton.bones.map((bone, i) => [bone.name, i]));
    const toon = (source: THREE.Material) => {
      const s = source as THREE.MeshStandardMaterial;
      if (s.map) s.map.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshToonMaterial({ map: s.map ?? null, color: s.map ? 0xffffff : s.color.clone(), gradientMap: host.kit.gradient });
      if (draw.color) m.color.set(draw.color);
      materials.push(m);
      disposables.push(m);
      return m;
    };
    const outline = () => {
      const m = characterOutlineMaterial(host.uniforms);
      disposables.push(m);
      return m;
    };
    gltf.scene.updateWorldMatrix(true, true);

    if (draw.attach === "bone") {
      // 모델 파일의 맨 위 노드들(뼈대가 아닌 것)을 붙인다
      const sources = gltf.scene.children.filter((node) => !(node as THREE.Bone).isBone && meshesOf(node).some((m) => !(m as THREE.SkinnedMesh).isSkinnedMesh));
      const attach = (boneName: string, mirror: boolean) => {
        const index = boneIndex.get(boneName);
        const bone = index === undefined ? undefined : skeleton.bones[index];
        if (!bone || index === undefined) return;
        // 쉬는 자세의 그 뼈에 대한 자리: (뼈의 묶음 역행렬) × (몸의 묶음 행렬) × (모델 좌표의 자리)
        const toBone = new THREE.Matrix4().multiplyMatrices(skeleton.boneInverses[index], host.body.bindMatrix);
        // 모델 좌표에서 x를 뒤집는다(자리째 반대쪽으로 간다). 음수 배율로 그리면 three가 앞뒷면을 알아서 바꿔 그린다
        if (mirror) toBone.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
        const group = new THREE.Group();
        for (const node of sources) {
          for (const source of meshesOf(node)) {
            const local = toBone.clone().multiply(source.matrixWorld);
            const part = new THREE.Group();
            local.decompose(part.position, part.quaternion, part.scale);
            const geometry = source.geometry.clone();
            if (!geometry.attributes.normal) geometry.computeVertexNormals();
            disposables.push(geometry);
            const mesh = new THREE.Mesh(geometry, toon(source.material as THREE.Material));
            const shell = new THREE.Mesh(geometry, outline());
            for (const m of [mesh, shell]) {
              m.raycast = () => {};
              m.frustumCulled = false;
            }
            part.add(mesh, shell);
            group.add(part);
          }
        }
        bone.add(group);
        objects.push(group);
      };
      if (draw.bone) attach(draw.bone, false);
      if (draw.mirror) attach(draw.mirror, true);
    } else {
      const sources: THREE.SkinnedMesh[] = [];
      gltf.scene.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) sources.push(o as THREE.SkinnedMesh);
      });
      for (const source of sources) {
        const from = source.skeleton;
        if (!from) continue;
        // 모델의 뼈 번호를 라룹이 뼈대의 번호로 바꾼다(이름이 같다)
        const geometry = source.geometry.clone();
        disposables.push(geometry);
        const skinIndex = geometry.attributes.skinIndex as THREE.BufferAttribute | undefined;
        if (!skinIndex) continue;
        const remap = from.bones.map((bone) => boneIndex.get(bone.name) ?? 0);
        for (let i = 0; i < skinIndex.count; i += 1) {
          for (let k = 0; k < 4; k += 1) skinIndex.setComponent(i, k, remap[skinIndex.getComponent(i, k)] ?? 0);
        }
        skinIndex.needsUpdate = true;
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        const mesh = new THREE.SkinnedMesh(geometry, toon(source.material as THREE.Material));
        const shell = new THREE.SkinnedMesh(geometry, outline());
        for (const m of [mesh, shell]) {
          m.bind(skeleton, host.body.bindMatrix);
          m.raycast = () => {};
          m.frustumCulled = false;
          host.body.parent?.add(m);
          objects.push(m);
        }
      }
    }
    return { objects, materials, disposables };
  }, [host, draw, gltf]);

  // 카툰 명암 단계를 바꾸면 라룹이와 함께 바뀌게 명암 목록에 넣고, 사라지면 떼고 버린다
  useEffect(() => {
    host.kit.toonMaterials.push(...built.materials);
    return () => {
      for (const m of built.materials) {
        const i = host.kit.toonMaterials.indexOf(m);
        if (i >= 0) host.kit.toonMaterials.splice(i, 1);
      }
      for (const o of built.objects) o.removeFromParent();
      built.disposables.forEach((d) => d.dispose());
    };
  }, [built, host]);

  return null;
}

/** 착용 모델을 그리다 오류가 나면 라룹이는 그대로 둔다(옷이 붙지 않는다). */
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
