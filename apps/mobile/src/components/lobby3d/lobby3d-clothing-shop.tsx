import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Component, Suspense, useEffect, useMemo, useSyncExternalStore, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { PlaceId } from "@/lib/lobby3d/engine";
import { CLOTHING_FITTING_ROOMS, CLOTHING_FLOOR_ROOTS, CLOTHING_HIDDEN_NODES, CLOTHING_OFFSET, type ClothingFloor } from "@/lib/lobby3d/clothing-shop";
import { CLOTHING_STOCK_ROOT, clothingDisplayed, clothingProduct, clothingProductsOnFloor, subscribeClothingDisplay } from "@/lib/lobby3d/clothing-stock";
import type { DaylightState } from "./lobby3d-daylight";
import { SHOP_OUTSIDE_COLOR, convertMaterials, type ShopPickData } from "./lobby3d-shop";

// 마을 옷집 실내(구역 clothing1·clothing2): 지금 층의 실내 모델 하나만 장면에 둔다(층을 옮기면 빠지고 다른 층이 붙는다).
// 층 모델은 앱에 들어 있다. 모델 좌표에 CLOTHING_OFFSET을 더한 자리에 놓는다(오프셋은 clothing-shop.ts의 한 값이다).
// 앞쪽 가림 노드(창틀·유리)는 숨기고 누르기 대상에서 뺀다. 그 밖의 부품은 누르면 그 자리로 걸어가는 물체다(장소는 없다).
// 진열 상품: 진열 상품 모델(clothing-display-samples.glb)에서 그 층의 진열 중인 상품마다 pickNode만 복제해 displayAnchor에 붙인다.
// 상품 메시는 userData.clothingProduct(상품 ID)로 누르기 판정을 받는다. 진열 상품 모델을 읽지 못하면 진열 없이 층만 보인다.
// 예비 진열 자리(빈 진열대·마네킹·벽걸이)에는 아무것도 붙이지 않는다(집기는 층 모델의 부품일 뿐이다).
// 선택한 상품이 이 층에 붙어 있으면 그 진열대의 명패 노드를 보인다(화면 이름표는 로비 화면이 textAnchor 자리에 띄운다).

/* eslint-disable @typescript-eslint/no-require-imports */
export const CLOTHING_FLOOR_ASSETS: Record<ClothingFloor, number> = {
  1: require("../../../assets/models/clothing-shop/clothing-shop-interior-1f.glb"),
  2: require("../../../assets/models/clothing-shop/clothing-shop-interior-2f.glb")
};
export const CLOTHING_STOCK_ASSET: number = require("../../../assets/models/clothing-shop/clothing-display-samples.glb");
/* eslint-enable @typescript-eslint/no-require-imports */

/** 피팅룸 앞면을 잘라 내는 자리: 라룹이(피팅룸 안 자리)보다 이만큼 앞(+z, m). */
const FITTING_CUT_AHEAD = 0.35;

/** 누르기 판정에 쓰는 진열 상품 메시의 표시. */
export interface ClothingPickData {
  clothingProduct?: string;
}

export interface BuiltClothingFloor {
  floor: ClothingFloor;
  /** 장면에 붙일 뿌리(CLOTHING_OFFSET 자리). */
  root: THREE.Group;
  /** 누르기 판정을 받는 층 부품(숨긴 앞쪽 노드·바닥·유리는 빠진다). 진열 상품은 productTargets()가 따로 준다. */
  pickTargets: THREE.Object3D[];
  /** 지금 붙은 진열 상품(상품 ID → 붙인 물체). */
  products: Map<string, THREE.Object3D>;
  /** 진열 상품 모델이 들어왔을 때: 이 층 상품마다 진열용 원본을 만든다(재질을 한 번 바꾼다). */
  setStockModel(gltf: GLTF): void;
  /** 진열을 맞춘다: 이 층의 상품 가운데 진열 중인 것만 붙이고, 진열 해제된 것은 뗀다(원본이 아직 없으면 붙이지 못한다). */
  setDisplayed(displayed: Readonly<Record<string, boolean>>): void;
  /** 지금 붙은 진열 상품(누르기 대상). */
  productTargets(): THREE.Object3D[];
  /** 선택한 상품: 그 상품이 이 층에 붙어 있으면 그 진열대의 명패를 보이고 나머지 명패는 숨긴다. null이면 모두 숨긴다. */
  setSelected(id: string | null): void;
  /** 상품 진열대의 이름표 자리(textAnchor 노드)의 세계 좌표. 이 층 상품이 아니면 null. */
  textAnchorPoint(id: string): THREE.Vector3 | null;
  /** 이 층 피팅룸 커튼을 닫는다(Closed 모프 1)·연다(0). */
  setCurtainClosed(closed: boolean): void;
  /** 지금 커튼 닫힘 모프 값(커튼 메시가 없으면 null). */
  curtainWeight(): number | null;
  /** 피팅 중 이 층 피팅룸의 앞쪽 절반(커튼·입구 벽)을 잘라 낸다(true)·되돌린다(false). */
  setFittingCut(cut: boolean): void;
  /** 피팅룸 앞면을 잘라 내고 있는지. */
  fittingCut(): boolean;
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

  // 진열대 명패는 처음에 숨긴다(선택한 상품의 진열대만 보인다)
  const floorProducts = clothingProductsOnFloor(floor);
  const nameplates = new Map<string, THREE.Object3D>();
  for (const product of floorProducts) {
    const plate = interior.getObjectByName(product.nameplate);
    if (!plate) continue;
    plate.visible = false;
    nameplates.set(product.nameplate, plate);
  }
  // 피팅룸 커튼: 커튼 노드 아래 메시들의 닫힘 모프(처음에는 열림)
  const room = CLOTHING_FITTING_ROOMS[floor];
  // 피팅룸 앞면 잘라 보기: 피팅룸(방 모델은 한 덩어리)과 커튼 메시의 재질을 따로 복제해, 라룹이 자리보다 앞(+z)을 잘라 내는 면을 켜고 끈다.
  // 앞 절반만 잘리고 뒤(거울 쪽)는 남는다. 다른 메시와 함께 쓰던 재질은 건드리지 않는다
  const cutZ = room.inside.z - CLOTHING_OFFSET.z + FITTING_CUT_AHEAD;
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), cutZ + CLOTHING_OFFSET.z);
  const cutMaterials: THREE.Material[] = [];
  // 피팅룸 위 '피팅룸' 표지도 앞쪽이라 함께 자른다(카메라가 라룹이를 비출 때 머리 위를 가리지 않게)
  for (const name of [room.curtain, room.curtain.replace(/Curtain\d+$/, "Room"), room.curtain.replace(/Curtain\d+$/, "SignText")]) {
    interior.getObjectByName(name)?.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const own = (m: THREE.Material) => {
        const copy = m.clone();
        owned.push(copy);
        cutMaterials.push(copy);
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
    });
  }
  let cutting = false;
  const curtains: { mesh: THREE.Mesh; index: number }[] = [];
  interior.getObjectByName(room.curtain)?.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const index = mesh.isMesh ? mesh.morphTargetDictionary?.[room.morph] : undefined;
    if (index === undefined || !mesh.morphTargetInfluences) return;
    mesh.morphTargetInfluences[index] = 0;
    curtains.push({ mesh, index });
  });
  const templates = new Map<string, THREE.Object3D>();
  const products = new Map<string, THREE.Object3D>();
  let shown: Readonly<Record<string, boolean>> = {};
  const attach = (id: string) => {
    const product = clothingProduct(id);
    const template = templates.get(id);
    const anchor = product ? interior.getObjectByName(product.displayAnchor) : undefined;
    if (!product || !template || !anchor || products.has(id)) return;
    // 로컬 위치·회전 0, 배율 1로 붙인다(stock.json의 규칙)
    const item = template.clone(true);
    item.name = `clothing-product-${id}`;
    item.position.set(0, 0, 0);
    item.quaternion.identity();
    item.scale.setScalar(1);
    item.traverse((o) => {
      (o.userData as ClothingPickData).clothingProduct = id;
    });
    anchor.add(item);
    products.set(id, item);
  };
  const detach = (id: string) => {
    const item = products.get(id);
    if (!item) return;
    item.removeFromParent();
    products.delete(id);
  };
  const built: BuiltClothingFloor = {
    floor,
    root,
    pickTargets,
    products,
    setStockModel(stock) {
      const source = stock.scene.getObjectByName(CLOTHING_STOCK_ROOT) ?? stock.scene;
      for (const product of floorProducts) {
        if (templates.has(product.id)) continue;
        const node = source.getObjectByName(product.pickNode);
        if (!node) continue;
        const template = node.clone(true);
        convertMaterials(template, owned);
        templates.set(product.id, template);
      }
      built.setDisplayed(shown);
    },
    setDisplayed(displayed) {
      shown = displayed;
      for (const product of floorProducts) {
        if (displayed[product.id]) attach(product.id);
        else detach(product.id);
      }
    },
    productTargets() {
      return [...products.values()];
    },
    setSelected(id) {
      const product = id ? clothingProduct(id) : undefined;
      const on = product && products.has(product.id) ? product.nameplate : null;
      for (const [name, plate] of nameplates) plate.visible = name === on;
    },
    setCurtainClosed(closed) {
      for (const { mesh, index } of curtains) mesh.morphTargetInfluences![index] = closed ? 1 : 0;
    },
    setFittingCut(cut) {
      cutting = cut;
      for (const m of cutMaterials) {
        m.clippingPlanes = cut ? [cutPlane] : null;
        m.needsUpdate = true;
      }
    },
    fittingCut() {
      return cutting;
    },
    curtainWeight() {
      const first = curtains[0];
      return first ? first.mesh.morphTargetInfluences![first.index] : null;
    },
    textAnchorPoint(id) {
      const product = clothingProduct(id);
      if (!product || product.floor !== floor) return null;
      const node = interior.getObjectByName(product.textAnchor);
      if (!node) return null;
      root.updateMatrixWorld(true);
      return node.getWorldPosition(new THREE.Vector3());
    },
    dispose() {
      for (const m of owned) m.dispose();
    }
  };
  return built;
}

export interface ClothingFloorModelProps {
  floor: ClothingFloor;
  daylight: DaylightState;
  /** 누르기 판정 대상(로비 캔버스가 넘긴 자리에 넣는다). 진열 상품과 층 부품. */
  pickTargets: MutableRefObject<THREE.Object3D[]>;
  /** 선택한 상품(그 진열대 명패를 보인다). */
  selected: string | null;
  /** 지은 층 장면(로비 캔버스가 이름표 자리를 읽는다). */
  builtRef?: MutableRefObject<BuiltClothingFloor | null>;
  /** 이 층 피팅룸 커튼이 닫혀 있는지(피팅 중). */
  curtainClosed?: boolean;
  /** 피팅 중 카메라가 라룹이 앞을 비추는 동안 피팅룸 앞면을 잘라 낼지. */
  fittingCut?: boolean;
}

export function ClothingFloorModel({ floor, daylight, pickTargets, selected, builtRef, curtainClosed = false, fittingCut = false }: ClothingFloorModelProps) {
  const gltf = useLoader(GLTFLoader, CLOTHING_FLOOR_ASSETS[floor] as unknown as string) as GLTF;
  const built = useMemo(() => buildClothingFloor(floor, gltf), [floor, gltf]);
  useEffect(() => () => built.dispose(), [built]);
  const displayed = useSyncExternalStore(subscribeClothingDisplay, clothingDisplayed, clothingDisplayed);
  useEffect(() => {
    built.setDisplayed(displayed);
    built.setSelected(selected);
    pickTargets.current = [...built.productTargets(), ...built.pickTargets];
  }, [built, displayed, selected, pickTargets]);
  useEffect(() => built.setCurtainClosed(curtainClosed), [built, curtainClosed]);
  // 잘라 보기는 재질의 자르는 면을 쓰므로 그리기 쪽에서 켠다
  const { gl } = useThree();
  useEffect(() => {
    gl.localClippingEnabled = true;
    built.setFittingCut(fittingCut);
  }, [built, fittingCut, gl]);
  useEffect(() => {
    if (builtRef) builtRef.current = built;
    return () => {
      pickTargets.current = [];
      if (builtRef && builtRef.current === built) builtRef.current = null;
    };
  }, [built, pickTargets, builtRef]);

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
      {/* 진열 상품 모델은 따로 읽는다(못 읽어도 층은 그대로 보인다. 층이 뜨는 것을 기다리게 하지 않는다) */}
      <ClothingStockErrorBoundary>
        <Suspense fallback={null}>
          <ClothingStock built={built} selected={selected} pickTargets={pickTargets} />
        </Suspense>
      </ClothingStockErrorBoundary>
    </>
  );
}

/** 진열 상품 모델을 읽어 지금 층에 붙인다. */
function ClothingStock({ built, selected, pickTargets }: { built: BuiltClothingFloor; selected: string | null; pickTargets: MutableRefObject<THREE.Object3D[]> }) {
  const stock = useLoader(GLTFLoader, CLOTHING_STOCK_ASSET as unknown as string) as GLTF;
  const displayed = useSyncExternalStore(subscribeClothingDisplay, clothingDisplayed, clothingDisplayed);
  useEffect(() => {
    built.setStockModel(stock);
    built.setDisplayed(displayed);
    built.setSelected(selected);
    pickTargets.current = [...built.productTargets(), ...built.pickTargets];
  }, [built, stock, displayed, selected, pickTargets]);
  return null;
}

/** 진열 상품 모델을 읽지 못하면 진열 없이 둔다(층은 그대로). 다음에 다시 읽게 캐시를 비운다. */
class ClothingStockErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 옷집 진열 상품 모델을 불러오지 못했습니다", error);
    useLoader.clear(GLTFLoader, CLOTHING_STOCK_ASSET as unknown as string);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
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
