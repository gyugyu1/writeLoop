import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PlaceId } from "@/lib/lobby3d/engine";
import { CLOTHING_FLOOR_ROOTS, CLOTHING_HIDDEN_NODES, CLOTHING_OFFSET, type ClothingFloor } from "@/lib/lobby3d/clothing-shop";
import type { DaylightState } from "./lobby3d-daylight";
import { SHOP_OUTSIDE_COLOR, convertMaterials, type ShopPickData } from "./lobby3d-shop";

// 마을 옷집 실내(구역 clothing1·clothing2): 지금 층의 실내 모델 하나만 장면에 둔다(층을 옮기면 빠지고 다른 층이 붙는다).
// 층 모델은 앱에 들어 있다. 모델 좌표에 CLOTHING_OFFSET을 더한 자리에 놓는다(오프셋은 clothing-shop.ts의 한 값이다).
// 앞쪽 가림 노드(창틀·유리)는 숨기고 누르기 대상에서 뺀다. 그 밖의 부품은 누르면 그 자리로 걸어가는 물체다(장소는 없다).

/* eslint-disable @typescript-eslint/no-require-imports */
export const CLOTHING_FLOOR_ASSETS: Record<ClothingFloor, number> = {
  1: require("../../../assets/models/clothing-shop/clothing-shop-interior-1f.glb"),
  2: require("../../../assets/models/clothing-shop/clothing-shop-interior-2f.glb")
};
/* eslint-enable @typescript-eslint/no-require-imports */

export interface BuiltClothingFloor {
  floor: ClothingFloor;
  /** 장면에 붙일 뿌리(CLOTHING_OFFSET 자리). */
  root: THREE.Group;
  /** 누르기 판정을 받는 물체들(숨긴 앞쪽 노드·바닥은 빠진다). */
  pickTargets: THREE.Object3D[];
  /** 만든 재질을 버린다(모양은 useLoader의 원본과 함께 쓰므로 버리지 않는다). */
  dispose(): void;
}

/** 층 모델로 그 층 장면을 짓는다(3D 그리기와 테스트가 부른다). 원본은 앱 전체가 함께 쓰므로 복제해서 재질을 바꾼다. */
export function buildClothingFloor(floor: ClothingFloor, gltf: GLTF): BuiltClothingFloor {
  const owned: THREE.Material[] = [];
  const root = new THREE.Group();
  root.name = `clothing-floor-${floor}`;
  root.position.set(CLOTHING_OFFSET.x, 0, CLOTHING_OFFSET.z);
  const interior = gltf.scene.clone(true);
  interior.name = `clothing-interior-${floor}`;
  convertMaterials(interior, owned);
  const noPick = (o: THREE.Object3D) => o.traverse((c) => ((c as THREE.Mesh).raycast = () => {}));
  for (const name of CLOTHING_HIDDEN_NODES[floor]) {
    const hidden = interior.getObjectByName(name);
    if (!hidden) continue;
    hidden.visible = false;
    noPick(hidden);
  }
  root.add(interior);
  const pickTargets: THREE.Object3D[] = [];
  const parts = interior.getObjectByName(CLOTHING_FLOOR_ROOTS[floor]) ?? interior;
  for (const child of parts.children) {
    if (CLOTHING_HIDDEN_NODES[floor].includes(child.name)) continue;
    let mesh = false;
    child.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) mesh = true;
    });
    if (!mesh) continue;
    // 바닥·유리는 누르기 대상에서 뺀다(바닥은 바닥 점으로, 유리는 그 너머가 보인다)
    if (/Floor|Glass/.test(child.name)) {
      noPick(child);
      continue;
    }
    child.traverse((o) => {
      (o.userData as ShopPickData).shopPlace = null as PlaceId | null;
    });
    pickTargets.push(child);
  }
  return {
    floor,
    root,
    pickTargets,
    dispose() {
      for (const m of owned) m.dispose();
    }
  };
}

export interface ClothingFloorModelProps {
  floor: ClothingFloor;
  daylight: DaylightState;
  /** 누르기 판정 대상(로비 캔버스가 넘긴 자리에 넣는다). */
  pickTargets: MutableRefObject<THREE.Object3D[]>;
}

export function ClothingFloorModel({ floor, daylight, pickTargets }: ClothingFloorModelProps) {
  const gltf = useLoader(GLTFLoader, CLOTHING_FLOOR_ASSETS[floor] as unknown as string) as GLTF;
  const built = useMemo(() => buildClothingFloor(floor, gltf), [floor, gltf]);
  useEffect(() => () => built.dispose(), [built]);
  useEffect(() => {
    pickTargets.current = [...built.pickTargets];
    return () => {
      pickTargets.current = [];
    };
  }, [built, pickTargets]);

  // 실내 빛(가구점과 같은 시각별 색감)과 창 너머 바깥색. 실내를 나가면 바깥색을 거두고 검정으로 되돌린다
  const { scene } = useThree();
  const lights = useMemo(() => {
    const ambient = new THREE.AmbientLight(0xffffff, 1.35);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(CLOTHING_OFFSET.x - 3, 8, CLOTHING_OFFSET.z + 6);
    sun.target.position.set(CLOTHING_OFFSET.x, 0, CLOTHING_OFFSET.z);
    return { ambient, sun };
  }, []);
  const outside = useMemo(() => new THREE.Color(SHOP_OUTSIDE_COLOR), []);
  useEffect(() => {
    scene.background = outside;
    return () => {
      scene.background = new THREE.Color(0x000000);
    };
  }, [scene, outside]);
  useFrame(() => {
    const a = daylight.ambience;
    lights.ambient.color.setHex(a.ambientColor);
    lights.ambient.intensity = a.ambientIntensity;
    lights.sun.color.setHex(a.sunColor);
    lights.sun.intensity = a.sunIntensity;
  });

  return (
    <>
      {/* react-three-fiber의 three 객체 속성(object)이라 RN 린트 규칙이 모르는 속성으로 본다. */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={built.root} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={lights.ambient} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={lights.sun} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <primitive object={lights.sun.target} />
    </>
  );
}

/** 층 모델(앱 자산)을 읽지 못하면 아무것도 그리지 않고 알린다(로비 화면이 떠나온 곳으로 되돌린다). 다음에 다시 읽게 캐시를 비운다. */
export class ClothingFloorErrorBoundary extends Component<{ children: ReactNode; floor: ClothingFloor; onFailed?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 옷집 층 모델을 불러오지 못했습니다", error);
    useLoader.clear(GLTFLoader, CLOTHING_FLOOR_ASSETS[this.props.floor] as unknown as string);
    this.props.onFailed?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
