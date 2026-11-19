import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, useSyncExternalStore, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { PlaceId } from "@/lib/lobby3d/engine";
import {
  SHOP_HIDDEN_NODES,
  SHOP_OFFSET,
  SHOP_PRODUCTS,
  SHOP_SLOTS,
  SHOPKEEPER_HEADING,
  SHOPKEEPER_SCALE,
  displayScale,
  shopDisplay,
  subscribeShopDisplay,
  type ShopProductId
} from "@/lib/lobby3d/shop";
import type { DaylightState } from "./lobby3d-daylight";
import { OUTLINE_THICKNESS, characterOutlineMaterial, type CharacterOutlineUniforms, type ToonKit } from "./lobby3d-character";

// 마을 가구점 실내(구역 shop): 실내 모델, 계산대 뒤 버들, 진열대 셋의 상품.
// 실내·버들 모델은 앱에 들어 있고, 진열 상품 셋은 서버 아이템 목록에서 받아 기기에 둔 것을 읽는다(shop-files). 3D 화면이 상품을 다 받은 뒤에 이것을 그린다.
// 실내에 있는 동안만 장면에 있고, 나가면 빠진다(다시 들어오면 새로 붙인다. 모델 파일은 useLoader가 한 번만 읽어 둔다).
// 실내 모델 좌표에 SHOP_OFFSET을 더한 자리에 놓는다(앱 좌표 = 모델 좌표 + (4.5, 0, 4.5)).

/* eslint-disable @typescript-eslint/no-require-imports */
const INTERIOR_ASSET = require("../../../assets/models/shop/furniture-shop-interior.glb");
const SHOPKEEPER_ASSET = require("../../../assets/models/shop/beodeul.glb");
/* eslint-enable @typescript-eslint/no-require-imports */

/** 진열 상품 셋 모델의 기기 주소(SHOP_PRODUCTS 순서. 서버에서 받아 둔 것). */
export interface ShopModelFiles {
  products: string[];
}

/** 유리 너머(실내 바깥)의 낮 바깥색. */
export const SHOP_OUTSIDE_COLOR = 0xdcebf2;

/** 누르기 판정에 쓰는 물체의 표시: 장소가 있으면 그 장소(버들·계산대 → shopCounter, 진열대·상품 → shopSlotN, 문 → shopExit). */
export interface ShopPickData {
  shopPlace?: PlaceId | null;
}

/** 원본 재질(PBR)을 빛을 받는 가벼운 재질로 바꾼다. 유리는 비치게 한다. */
function lambertOf(source: THREE.MeshStandardMaterial, vertexColors: boolean): THREE.MeshLambertMaterial {
  const map = source.map ?? null;
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  const glass = /glass/i.test(source.name) || source.transparent;
  return new THREE.MeshLambertMaterial({
    name: source.name,
    color: source.color?.clone() ?? new THREE.Color(0xffffff),
    map,
    vertexColors,
    transparent: glass,
    opacity: glass ? Math.max(0.18, source.opacity) : 1,
    depthWrite: !glass,
    side: glass ? THREE.DoubleSide : THREE.FrontSide
  });
}

/** 묶음 안 메시의 재질을 모두 가벼운 재질로 바꾸고, 만든 재질을 owned에 모은다(같은 원본 재질은 하나를 함께 쓴다). */
function convertMaterials(root: THREE.Object3D, owned: THREE.Material[]): void {
  const made = new Map<string, THREE.MeshLambertMaterial>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return;
    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const vertexColors = mesh.geometry.hasAttribute("color");
    const next = sources.map((m) => {
      const key = `${m.uuid}|${vertexColors}`;
      let material = made.get(key);
      if (!material) {
        material = lambertOf(m as THREE.MeshStandardMaterial, vertexColors);
        made.set(key, material);
        owned.push(material);
      }
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

/** 상품 하나의 진열용 원본: 재질을 바꾼 복제본과 크기(바닥 중앙 기준). 진열 인스턴스는 이것을 복제해 모양·재질을 함께 쓴다. */
interface ProductTemplate {
  id: ShopProductId;
  object: THREE.Object3D;
  box: { minX: number; maxX: number; minZ: number; maxZ: number; height: number };
}

export interface BuiltShop {
  /** 장면에 붙일 뿌리(SHOP_OFFSET 자리). */
  root: THREE.Group;
  /** 버들(뼈대째 복제한 모델을 담은 묶음). */
  shopkeeper: THREE.Group;
  /** 누르기 판정을 받는 물체들. */
  pickTargets: THREE.Object3D[];
  /** 진열대 슬롯 노드(SHOP_SLOTS 순서). */
  slotNodes: THREE.Object3D[];
  /** 지금 슬롯마다 붙은 진열 인스턴스(없으면 null). */
  slotItems: (THREE.Object3D | null)[];
  /** 지금 슬롯마다 붙은 상품. */
  slotProducts: (ShopProductId | null)[];
  /** 진열을 맞춘다: 바뀐 슬롯만 붙인 상품을 떼고 새 상품을 붙인다. 바뀐 슬롯 번호를 돌려준다. */
  setStock(stock: readonly ShopProductId[]): number[];
  /** 외곽선 굵기(배율). */
  setOutline(outline: number): void;
  /** 만든 재질을 버린다(모양은 useLoader의 원본과 함께 쓰므로 버리지 않는다). */
  dispose(): void;
}

/**
 * 실내·버들·상품 모델로 가구점 장면을 짓는다(3D 그리기와 테스트가 부른다). kit의 카툰 명암을 버들에 쓴다.
 * 진열은 처음에 비어 있고, setStock으로 붙인다.
 */
export function buildShop(interiorGltf: GLTF, shopkeeperGltf: GLTF, productGltfs: readonly GLTF[], kit: ToonKit): BuiltShop {
  const owned: THREE.Material[] = [];
  const root = new THREE.Group();
  root.name = "shop-root";
  root.position.set(SHOP_OFFSET.x, 0, SHOP_OFFSET.z);
  const pickTargets: THREE.Object3D[] = [];

  // 실내 모델: 원본은 앱 전체가 함께 쓰므로 복제해서 재질을 바꾼다
  const interior = interiorGltf.scene.clone(true);
  interior.name = "shop-interior";
  convertMaterials(interior, owned);
  for (const name of SHOP_HIDDEN_NODES) {
    const hidden = interior.getObjectByName(name);
    if (!hidden) continue;
    hidden.visible = false;
    hidden.traverse((o) => ((o as THREE.Mesh).raycast = () => {}));
  }
  root.add(interior);
  const placeOfNode = (name: string): PlaceId | null => {
    if (/^Checkout/.test(name)) return "shopCounter";
    const station = /^Station_0(\d)_Pedestal/.exec(name);
    if (station) return `shopSlot${station[1]}` as PlaceId;
    if (/^ShopDoor|^Entry_WovenRunner/.test(name)) return "shopExit";
    return null;
  };
  // 모델의 부품 노드는 뿌리 노드(FurnitureShopInterior) 아래에 있다
  const parts = interior.getObjectByName("FurnitureShopInterior") ?? interior;
  for (const child of parts.children) {
    if (SHOP_HIDDEN_NODES.includes(child.name)) continue;
    let mesh = false;
    child.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) mesh = true;
    });
    if (!mesh) continue;
    // 유리·바닥·천장 조명은 누르기 대상에서 뺀다(바닥은 바닥 점으로, 유리는 그 너머가 보인다)
    if (/Glass|ShopFloor|Pendant/.test(child.name)) {
      child.traverse((o) => ((o as THREE.Mesh).raycast = () => {}));
      continue;
    }
    (child.userData as ShopPickData).shopPlace = placeOfNode(child.name);
    child.traverse((o) => {
      (o.userData as ShopPickData).shopPlace = placeOfNode(child.name);
    });
    pickTargets.push(child);
  }

  // 버들: 뼈대째 복제해 기본 자세 그대로 둔다(애니메이션 없음). 라룹이와 같은 카툰 명암·갈색 외곽선
  const shopkeeper = new THREE.Group();
  shopkeeper.name = "shopkeeper";
  const npcNode = interior.getObjectByName("CheckoutNPC");
  if (npcNode) shopkeeper.position.copy(npcNode.position);
  shopkeeper.rotation.y = SHOPKEEPER_HEADING;
  const model = cloneSkinned(shopkeeperGltf.scene);
  model.scale.setScalar(SHOPKEEPER_SCALE);
  shopkeeper.add(model);
  const uniforms: CharacterOutlineUniforms = { thickness: { value: OUTLINE_THICKNESS }, scale: { value: SHOPKEEPER_SCALE } };
  const toonMaterials: THREE.MeshToonMaterial[] = [];
  const skinned: THREE.SkinnedMesh[] = [];
  model.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
  });
  for (const mesh of skinned) {
    const source = mesh.material as THREE.MeshStandardMaterial;
    if (source.map) source.map.colorSpace = THREE.SRGBColorSpace;
    const toon = new THREE.MeshToonMaterial({
      map: source.map ?? null,
      color: source.map ? 0xffffff : source.color?.clone() ?? 0xffffff,
      vertexColors: mesh.geometry.hasAttribute("color") && Boolean(source.vertexColors),
      gradientMap: kit.gradient,
      side: THREE.DoubleSide
    });
    mesh.material = toon;
    toonMaterials.push(toon);
    owned.push(toon);
    mesh.frustumCulled = false;
    // 뼈대로 휘는 메시는 누르기 판정에 쓰지 않는다(아래 보이지 않는 통이 맡는다)
    mesh.raycast = () => {};
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
    const shellMaterial = characterOutlineMaterial(uniforms);
    owned.push(shellMaterial);
    const shell = new THREE.SkinnedMesh(mesh.geometry, shellMaterial);
    shell.bind(mesh.skeleton, mesh.bindMatrix);
    shell.frustumCulled = false;
    shell.raycast = () => {};
    mesh.parent?.add(shell);
  }
  kit.toonMaterials.push(...toonMaterials);
  const hitMaterial = new THREE.MeshBasicMaterial();
  owned.push(hitMaterial);
  const hitGeometry = new THREE.CapsuleGeometry(0.45, 1.3, 4, 10);
  const hit = new THREE.Mesh(hitGeometry, hitMaterial);
  hit.visible = false;
  hit.position.y = 0.45 + 0.65;
  (hit.userData as ShopPickData).shopPlace = "shopCounter";
  shopkeeper.add(hit);
  pickTargets.push(hit);
  root.add(shopkeeper);

  // 상품 원본: 재질을 한 번 바꾸고 크기를 잰다
  const templates = new Map<ShopProductId, ProductTemplate>();
  SHOP_PRODUCTS.forEach((product, i) => {
    const gltf = productGltfs[i];
    if (!gltf) return;
    const object = gltf.scene.clone(true);
    convertMaterials(object, owned);
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    templates.set(product.id, {
      id: product.id,
      object,
      box: { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z, height: bounds.max.y - Math.min(0, bounds.min.y) }
    });
  });

  const slotNodes = SHOP_SLOTS.map((slot) => interior.getObjectByName(slot.node) ?? interior);
  const slotItems: (THREE.Object3D | null)[] = SHOP_SLOTS.map(() => null);
  const slotProducts: (ShopProductId | null)[] = SHOP_SLOTS.map(() => null);
  const pickIndex = (o: THREE.Object3D | null) => (o ? pickTargets.indexOf(o) : -1);

  const built: BuiltShop = {
    root,
    shopkeeper,
    pickTargets,
    slotNodes,
    slotItems,
    slotProducts,
    setStock(stock) {
      const changed: number[] = [];
      SHOP_SLOTS.forEach((slot, i) => {
        const want = stock[i] ?? null;
        if (want === slotProducts[i]) return;
        // 이 슬롯에 붙인 이전 상품만 뗀다(모양·재질은 원본과 함께 쓰므로 버리지 않는다)
        const old = slotItems[i];
        if (old) {
          old.removeFromParent();
          const at = pickIndex(old);
          if (at >= 0) pickTargets.splice(at, 1);
        }
        slotItems[i] = null;
        slotProducts[i] = want;
        changed.push(i);
        const template = want ? templates.get(want) : undefined;
        if (!template) return;
        const item = template.object.clone(true);
        item.name = `shop-display-${i + 1}`;
        // 큰 상품은 이 진열 인스턴스만 슬롯 반경·높이 안에 들게 균일 축소한다
        item.scale.setScalar(displayScale(template.box, slot));
        item.traverse((o) => {
          (o.userData as ShopPickData).shopPlace = `shopSlot${i + 1}` as PlaceId;
        });
        slotNodes[i].add(item);
        slotItems[i] = item;
        pickTargets.push(item);
      });
      return changed;
    },
    setOutline(outline) {
      uniforms.thickness.value = OUTLINE_THICKNESS * outline;
    },
    dispose() {
      for (const m of toonMaterials) {
        const at = kit.toonMaterials.indexOf(m);
        if (at >= 0) kit.toonMaterials.splice(at, 1);
      }
      hitGeometry.dispose();
      for (const m of owned) m.dispose();
    }
  };
  return built;
}

export interface ShopModelProps {
  /** 받아 둔 모델 파일(기기 주소). */
  files: ShopModelFiles;
  daylight: DaylightState;
  kit: ToonKit;
  outline: number;
  /** 누르기 판정을 받을 물체(3D 화면이 가구점에서 누른 곳을 찾을 때 쓴다). */
  pickTargets: MutableRefObject<THREE.Object3D[]>;
}

/** 가구점 실내를 읽어 장면에 붙인다(다 읽을 때까지는 아무것도 그리지 않는다: Suspense). */
export function ShopModel({ files, daylight, kit, outline, pickTargets }: ShopModelProps) {
  const interiorGltf = useLoader(GLTFLoader, INTERIOR_ASSET as string) as GLTF;
  const shopkeeperGltf = useLoader(GLTFLoader, SHOPKEEPER_ASSET as string) as GLTF;
  const productGltfs = useLoader(GLTFLoader, files.products) as GLTF[];
  const built = useMemo(() => buildShop(interiorGltf, shopkeeperGltf, productGltfs, kit), [interiorGltf, shopkeeperGltf, productGltfs, kit]);
  useEffect(() => () => built.dispose(), [built]);
  const stock = useSyncExternalStore(subscribeShopDisplay, shopDisplay, shopDisplay);
  // 진열 목록에서 바꾸면 그 슬롯만 바뀐다(누르기 판정 목록도 함께 맞춘다)
  useEffect(() => {
    built.setStock(stock);
    pickTargets.current = [...built.pickTargets];
  }, [built, stock, pickTargets]);
  useEffect(
    () => () => {
      pickTargets.current = [];
    },
    [pickTargets]
  );
  useEffect(() => built.setOutline(outline), [built, outline]);

  // 실내 빛(방과 같은 시각별 색감)과 유리 너머 바깥색. 실내를 나가면 바깥색을 거두고 검정으로 되돌린다(방과 같다)
  const { scene } = useThree();
  const lights = useMemo(() => {
    const ambient = new THREE.AmbientLight(0xffffff, 1.35);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(SHOP_OFFSET.x - 3, 8, SHOP_OFFSET.z + 6);
    sun.target.position.set(SHOP_OFFSET.x, 0, SHOP_OFFSET.z);
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

/** 가구점 모델을 읽지 못하면 아무것도 그리지 않고 알린다(로비 화면이 마을로 되돌린다). 다음에 다시 읽게 캐시를 비운다. */
export class ShopModelErrorBoundary extends Component<{ children: ReactNode; files: ShopModelFiles; onFailed?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 가구점 모델을 불러오지 못했습니다", error);
    const { files } = this.props;
    useLoader.clear(GLTFLoader, INTERIOR_ASSET as string);
    useLoader.clear(GLTFLoader, SHOPKEEPER_ASSET as string);
    useLoader.clear(GLTFLoader, files.products);
    this.props.onFailed?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
