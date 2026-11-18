import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VILLAGE_LANTERNS } from "@/lib/lobby3d/village";

// 마을 광장 가로등(WriteLoop 제작 모델, assets/models/village-streetlamp.glb). 메시 하나·재질 하나이고,
// 재질은 나무·석재 색 그림과 네 면 유리창만 빛나게 하는 발광 그림을 갖는다. 자리는 배치 파일의 lanterns를 따른다.
// 네 자리는 인스턴스 메시 하나로 그린다(모양·그림·재질 하나를 함께 쓴다). 점등은 재질의 emissiveIntensity만 바꾼다.

let streetlampAsset: string | null = null;

/** 가로등 모델 파일(늘 같은 값이라 useLoader의 키가 같다. 미리 읽기와 마을이 함께 쓴다). 처음 부를 때 require한다. */
export function villageStreetlampAsset(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  streetlampAsset ??= require("../../../assets/models/village-streetlamp.glb") as string;
  return streetlampAsset;
}

/** 가로등 균일 배율(원본 높이 2.57 → 약 3.34. 유리창 아래쪽이 라룹이 귀 끝보다 조금 위). */
export const STREETLAMP_SCALE = 1.3;

export interface VillageStreetlamps {
  /** 장면에 넣을 가로등 넷(인스턴스 메시 하나). */
  mesh: THREE.InstancedMesh;
  /** 가로등용 재질(원본 재질의 복제 하나. 네 자리가 함께 쓴다). */
  material: THREE.MeshStandardMaterial;
  /** 점등: 0(낮, 빛나지 않음)~1(밤, 발광 그림 그대로). */
  setGlow(amount: number): void;
  dispose(): void;
}

/**
 * 불러온 가로등 모델로 배치 파일의 가로등 자리마다 한 그루씩 놓는다. 모델에 메시가 없으면 null(가로등만 빠진다). 모양과 그림은 불러오기가 들고 있는 것을 함께 쓰고,
 * 재질만 복제한다(useLoader가 준 모델은 앱 전체에서 함께 쓰므로 점등 값을 바꾸려면 따로 둔다). 모델 밑면을 땅(y = 0)에 놓는다.
 */
export function buildVillageStreetlamps(gltf: GLTF): VillageStreetlamps | null {
  let source: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => {
    if (!source && o instanceof THREE.Mesh) source = o;
  });
  if (!source) return null;
  const found = source as THREE.Mesh;
  const material = (found.material as THREE.MeshStandardMaterial).clone();
  const geometry = found.geometry;
  geometry.computeBoundingBox();
  const bottom = geometry.boundingBox!.min.y;
  const mesh = new THREE.InstancedMesh(geometry, material, VILLAGE_LANTERNS.length);
  mesh.name = "village-streetlamps";
  const matrix = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3(STREETLAMP_SCALE, STREETLAMP_SCALE, STREETLAMP_SCALE);
  const turn = new THREE.Quaternion();
  VILLAGE_LANTERNS.forEach(([x, z], i) => {
    mesh.setMatrixAt(i, matrix.compose(at.set(x, -bottom * STREETLAMP_SCALE, z), turn, size));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return {
    mesh,
    material,
    setGlow(amount) {
      material.emissiveIntensity = amount;
    },
    dispose() {
      mesh.dispose();
      material.dispose();
    }
  };
}
