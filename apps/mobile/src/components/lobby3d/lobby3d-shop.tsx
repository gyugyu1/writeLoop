import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Component, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MutableRefObject, type ReactNode } from "react";
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
  fitsShopSlot,
  notifyShopSwapFailed,
  setShopDisplay,
  shopDisplay,
  shopProduct,
  subscribeShopDisplay,
  shopVacancy,
  subscribeShopVacancy,
  type ShopProductId
} from "@/lib/lobby3d/shop";
import type { ShopProductFiles } from "@/lib/lobby3d/shop-files";
import type { DaylightState } from "./lobby3d-daylight";
import { OUTLINE_THICKNESS, characterOutlineMaterial, type CharacterOutlineUniforms, type ToonKit } from "./lobby3d-character";

// 마을 가구점 실내(구역 shop, 생활 쇼룸): 실내 모델, 계산대 뒤 버들, 진열대 여섯의 상품과 그 앞 명패.
// 실내·버들 모델은 앱에 들어 있고, 진열 상품의 모델·명패 그림은 서버 아이템 목록에서 받아 기기에 둔 것을 읽는다(shop-files).
// 상품은 기다리지 않는다: 슬롯마다 받은 상품을 읽고 크기 검사(원본 배율)를 통과하면 그때 이전 상품과 명패를 함께 바꾼다.
// 교체에 실패하면(목록에 없음·받기/읽기 실패·크기 초과) 이전 상품과 명패를 그대로 두고 진열 상태를 되돌린다.
// 실내에 있는 동안만 장면에 있고, 나가면 빠진다(다시 들어오면 새로 붙인다. 모델 파일은 useLoader가 한 번만 읽어 둔다).
// 실내 모델 좌표에 SHOP_OFFSET을 더한 자리에 놓는다(오프셋은 shop.ts의 한 값이다).

/* eslint-disable @typescript-eslint/no-require-imports */
const INTERIOR_ASSET = require("../../../assets/models/shop/furniture-shop-interior.glb");
const SHOPKEEPER_ASSET = require("../../../assets/models/shop/beodeul.glb");
/* eslint-enable @typescript-eslint/no-require-imports */

/** 진열 상품마다 모델·명패 그림의 지금 상태(기기 주소 / loading / missing). */
export type ShopProductFileMap = Record<ShopProductId, ShopProductFiles>;

/** 받은 명패 그림을 읽은 결과(주소마다 한 번만 읽는다). 읽지 못하면 null이고, 다음에 다시 읽게 지운다. */
const nameplateLoads = new Map<string, Promise<THREE.Texture | null>>();

function loadNameplateTexture(uri: string): Promise<THREE.Texture | null> {
  let job = nameplateLoads.get(uri);
  if (!job) {
    job = new THREE.TextureLoader()
      .loadAsync(uri)
      .then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      })
      .catch((error: unknown) => {
        console.warn("[lobby3d] 가구점 명패 그림을 읽지 못했습니다", error);
        nameplateLoads.delete(uri);
        return null;
      });
    nameplateLoads.set(uri, job);
  }
  return job;
}

/** '품절' 안내판: 실내 모델에서 원본이 든 장면·노드 이름, 진열대 받침 기준 자리. */
const SOLD_OUT_SCENE = "ShopNameplateTemplates";
const SOLD_OUT_BOARD = "ShopDisplay_SoldOutBoard";
const SOLD_OUT_POSITION = { x: 0, y: 0.25, z: 0 };

/** 명패 그림을 붙이는 판의 크기(받침 윗면, 새겨진 글자 메시 자리. 가로 5 : 세로 1). */
const NAMEPLATE_SIZE = { width: 1.0, height: 0.2 } as const;
/** 명패 판을 받침 윗면에서 띄우는 높이(받침 면과 겹쳐 깜빡이지 않게). */
const NAMEPLATE_LIFT = 0.003;

/** 받은 상품 파일을 읽은 결과(주소마다 한 번만 읽는다). 읽지 못하면 null이고, 다음에 다시 읽게 지운다. */
const productLoads = new Map<string, Promise<GLTF | null>>();

function loadProductModel(uri: string): Promise<GLTF | null> {
  let job = productLoads.get(uri);
  if (!job) {
    job = new GLTFLoader().loadAsync(uri).catch((error: unknown) => {
      console.warn("[lobby3d] 가구점 상품 모델을 읽지 못했습니다", error);
      productLoads.delete(uri);
      return null;
    });
    productLoads.set(uri, job);
  }
  return job;
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
  /** 지금 슬롯마다 붙은 상품(붙이지 못했으면 null). */
  slotProducts: (ShopProductId | null)[];
  /** 슬롯마다 명패 받침(Station_NN_Nameplate)·새겨진 글자(…_Default)·명패 그림 판. */
  nameplates: { holder: THREE.Object3D | null; glyph: THREE.Mesh | null; glyphName: string | null; plate: THREE.Mesh }[];
  /** 슬롯마다 진열대 받침(Station_NN_Pedestal) 가운데에 붙인 '품절' 안내판(모델에 안내판 원본이 없으면 null). 처음에는 숨긴다. */
  soldOutBoards: (THREE.Object3D | null)[];
  /**
   * 진열을 맞춘다: 바뀐 슬롯마다 새 상품을 붙일 수 있으면(진열용 원본이 있고 크기 검사를 통과) 이전 상품을 떼고 새 상품과 명패를 붙인다.
   * 붙일 수 없으면 그 슬롯은 그대로다(이전 상품·명패 유지, 비어 있었으면 빈 채). 바뀐 슬롯 번호를 돌려준다.
   * vacancy[i]가 true(빈 상태 확정)면 그 슬롯의 상품을 떼고 명패를 숨기고 '품절' 안내판을 보인다. 빈 상태가 풀린 슬롯은 상품을 붙인 때에 안내판을 내린다
   * (붙이기 전에는 안내판을 그대로 둔다).
   */
  setStock(stock: readonly ShopProductId[], vacancy?: readonly boolean[]): number[];
  /** 그 슬롯에 그 상품을 붙일 수 있는지: ready(붙일 수 있음), no-model(진열용 원본이 아직 없음), too-big(크기 검사 실패). */
  canPlace(slot: number, id: ShopProductId): "ready" | "no-model" | "too-big";
  /** 상품 모델이 들어왔을 때(받아서 읽음): 진열용 원본을 만든다(이미 있으면 새 모델로 바꾼다. 붙어 있는 인스턴스는 그대로). */
  addProduct(id: ShopProductId, gltf: GLTF): void;
  /** 그 상품의 진열용 원본이 있는지. */
  hasProduct(id: ShopProductId): boolean;
  /** 상품의 명패 그림이 들어왔을 때: 그 상품을 진열한 슬롯의 명패를 맞춘다. */
  addNameplate(id: ShopProductId, texture: THREE.Texture): void;
  /** 그 상품의 명패 그림이 있는지. */
  hasNameplateTexture(id: ShopProductId): boolean;
  /** 외곽선 굵기(배율). */
  setOutline(outline: number): void;
  /** 만든 재질을 버린다(모양은 useLoader의 원본과 함께 쓰므로 버리지 않는다). */
  dispose(): void;
}

/**
 * 실내·버들·상품 모델로 가구점 장면을 짓는다(3D 그리기와 테스트가 부른다). kit의 카툰 명암을 버들에 쓴다.
 * 진열은 처음에 비어 있고, setStock으로 붙인다.
 */
export function buildShop(
  interiorGltf: GLTF,
  shopkeeperGltf: GLTF,
  productGltfs: readonly (GLTF | null | undefined)[],
  kit: ToonKit
): BuiltShop {
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

  // 상품 원본: 재질을 한 번 바꾸고 크기를 잰다(지금 있는 상품만. 나머지는 들어오는 대로 addProduct가 만든다)
  const templates = new Map<ShopProductId, ProductTemplate>();
  const addTemplate = (id: ShopProductId, gltf: GLTF) => {
    const object = gltf.scene.clone(true);
    convertMaterials(object, owned);
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    templates.set(id, {
      id,
      object,
      box: { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z, height: bounds.max.y - Math.min(0, bounds.min.y) }
    });
  };
  SHOP_PRODUCTS.forEach((product, i) => {
    const gltf = productGltfs[i];
    if (gltf) addTemplate(product.id, gltf);
  });

  const slotNodes = SHOP_SLOTS.map((slot) => interior.getObjectByName(slot.node) ?? interior);
  const slotItems: (THREE.Object3D | null)[] = SHOP_SLOTS.map(() => null);
  const slotProducts: (ShopProductId | null)[] = SHOP_SLOTS.map(() => null);
  const pickIndex = (o: THREE.Object3D | null) => (o ? pickTargets.indexOf(o) : -1);

  // 명패: 진열대마다 모델에 새겨진 글자(그 진열대의 이름)와, 명패 그림 판을 받침 윗면(새겨진 글자 자리)에 하나씩 둔다.
  // 처음에는 받침을 모두 숨긴다
  const nameplateTextures = new Map<ShopProductId, THREE.Texture>();
  const plateGeometry = new THREE.PlaneGeometry(NAMEPLATE_SIZE.width, NAMEPLATE_SIZE.height);
  // 판의 +Y(그림 위쪽)가 받침의 −Z(글자 위쪽)를 보고, 판의 앞면이 받침 윗면(+Y)을 보게 눕힌다
  plateGeometry.rotateX(-Math.PI / 2);
  const nameplates = SHOP_SLOTS.map((slot, i) => {
    const holder = interior.getObjectByName(slot.nameplate) ?? null;
    const glyph = (interior.getObjectByName(slot.glyph) as THREE.Mesh | undefined) ?? null;
    const glyphName = glyph ? (glyph.userData as { display_name_ko?: string }).display_name_ko ?? null : null;
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    owned.push(material);
    const plate = new THREE.Mesh(plateGeometry, material);
    plate.name = `shop-nameplate-${i + 1}`;
    plate.position.y = NAMEPLATE_LIFT;
    plate.visible = false;
    // 명패를 누르면 그 진열대로 간다(받침·새겨진 글자도 진열대 받침 아래라 같은 장소다)
    (plate.userData as ShopPickData).shopPlace = `shopSlot${i + 1}` as PlaceId;
    holder?.add(plate);
    if (holder) holder.visible = false;
    return { holder, glyph, glyphName, plate };
  });

  // '품절' 안내판: 실내 모델의 다른 장면(ShopNameplateTemplates)에 든 원본을 진열대마다 복제해 받침 가운데에 붙인다.
  // 받침 기준 (0, 0.25, 0)·회전 없음이라 진열대 한가운데에서 +Z(카메라 쪽)를 본다. 진열 슬롯 노드는 좌우 회전이 있어 쓰지 않는다
  const boardSource =
    interiorGltf.scenes?.find((scene) => scene.name === SOLD_OUT_SCENE)?.getObjectByName(SOLD_OUT_BOARD) ?? null;
  const boardTemplate = boardSource ? boardSource.clone(true) : null;
  if (boardTemplate) {
    boardTemplate.position.set(0, 0, 0);
    boardTemplate.quaternion.identity();
    convertMaterials(boardTemplate, owned);
  }
  const soldOutBoards = SHOP_SLOTS.map((slot, i) => {
    const pedestal = interior.getObjectByName(slot.pedestal);
    if (!boardTemplate || !pedestal) return null;
    const board = boardTemplate.clone(true);
    board.name = `shop-soldout-${i + 1}`;
    board.position.set(SOLD_OUT_POSITION.x, SOLD_OUT_POSITION.y, SOLD_OUT_POSITION.z);
    board.quaternion.identity();
    board.visible = false;
    // 안내판을 누르면 그 진열대로 간다
    board.traverse((o) => {
      (o.userData as ShopPickData).shopPlace = `shopSlot${i + 1}` as PlaceId;
    });
    pedestal.add(board);
    return board;
  });
  const vacantShown: boolean[] = SHOP_SLOTS.map(() => false);
  /** 슬롯 i를 비운다: 붙은 상품을 떼고(누르기 대상에서도 뺀다) 명패를 숨기고 안내판을 보인다. */
  const showVacant = (i: number) => {
    const old = slotItems[i];
    if (old) {
      old.removeFromParent();
      const at = pickIndex(old);
      if (at >= 0) pickTargets.splice(at, 1);
    }
    slotItems[i] = null;
    slotProducts[i] = null;
    vacantShown[i] = true;
    const holder = nameplates[i].holder;
    if (holder) holder.visible = false;
    const board = soldOutBoards[i];
    if (board) board.visible = true;
  };

  /** 슬롯 i의 명패를 지금 상품에 맞춘다: 그 진열대에 새겨진 글자가 이름과 같으면 그 글자, 아니면 명패 그림, 그림도 없으면 받침을 숨긴다. */
  const refreshNameplate = (i: number) => {
    const { holder, glyph, glyphName, plate } = nameplates[i];
    if (!holder) return;
    const id = slotProducts[i];
    if (!id) {
      holder.visible = false;
      return;
    }
    if (glyph && glyphName === shopProduct(id).name) {
      glyph.visible = true;
      plate.visible = false;
      holder.visible = true;
      return;
    }
    const texture = nameplateTextures.get(id);
    if (glyph) glyph.visible = false;
    if (!texture) {
      holder.visible = false;
      return;
    }
    (plate.material as THREE.MeshBasicMaterial).map = texture;
    (plate.material as THREE.MeshBasicMaterial).needsUpdate = true;
    plate.visible = true;
    holder.visible = true;
  };

  const canPlace = (i: number, id: ShopProductId): "ready" | "no-model" | "too-big" => {
    const template = templates.get(id);
    if (!template) return "no-model";
    return fitsShopSlot(template.box, SHOP_SLOTS[i]) ? "ready" : "too-big";
  };

  const built: BuiltShop = {
    root,
    shopkeeper,
    pickTargets,
    slotNodes,
    slotItems,
    slotProducts,
    nameplates,
    soldOutBoards,
    setStock(stock, vacancy) {
      const changed: number[] = [];
      SHOP_SLOTS.forEach((_, i) => {
        if (vacancy?.[i]) {
          if (!vacantShown[i]) {
            showVacant(i);
            changed.push(i);
          }
          return;
        }
        const want = stock[i] ?? null;
        if (!want || want === slotProducts[i]) return;
        // 붙일 수 없으면(원본이 아직 없거나 크기 초과) 그대로 둔다: 이전 상품과 명패를 유지한다
        if (canPlace(i, want) !== "ready") return;
        const template = templates.get(want)!;
        // 이 슬롯에 붙인 이전 상품만 뗀다(모양·재질은 원본과 함께 쓰므로 버리지 않는다)
        const old = slotItems[i];
        if (old) {
          old.removeFromParent();
          const at = pickIndex(old);
          if (at >= 0) pickTargets.splice(at, 1);
        }
        // 원본 배율 그대로, 슬롯 노드의 자리·회전으로 붙인다(자동 축소 없음)
        const item = template.object.clone(true);
        item.name = `shop-display-${i + 1}`;
        item.scale.setScalar(1);
        item.traverse((o) => {
          (o.userData as ShopPickData).shopPlace = `shopSlot${i + 1}` as PlaceId;
        });
        slotNodes[i].add(item);
        slotItems[i] = item;
        slotProducts[i] = want;
        pickTargets.push(item);
        // 상품을 붙였으니 안내판을 내린다(빈 상태에서 돌아온 슬롯)
        vacantShown[i] = false;
        const board = soldOutBoards[i];
        if (board) board.visible = false;
        refreshNameplate(i);
        changed.push(i);
      });
      return changed;
    },
    canPlace,
    addNameplate(id, texture) {
      nameplateTextures.set(id, texture);
      slotProducts.forEach((product, i) => {
        if (product === id) refreshNameplate(i);
      });
    },
    hasNameplateTexture(id) {
      return nameplateTextures.has(id);
    },
    addProduct(id, gltf) {
      addTemplate(id, gltf);
    },
    hasProduct(id) {
      return templates.has(id);
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
      plateGeometry.dispose();
      for (const m of owned) m.dispose();
    }
  };
  return built;
}

export interface ShopModelProps {
  /** 진열 상품마다 모델·명패 그림의 지금 상태. 바뀌면(새로 받음·실패) 슬롯을 다시 맞춘다. */
  products: ShopProductFileMap;
  daylight: DaylightState;
  kit: ToonKit;
  outline: number;
  /** 누르기 판정을 받을 물체(3D 화면이 가구점에서 누른 곳을 찾을 때 쓴다). */
  pickTargets: MutableRefObject<THREE.Object3D[]>;
}

/**
 * 가구점 실내를 읽어 장면에 붙인다. 실내·버들(앱 자산)을 다 읽을 때까지는 아무것도 그리지 않는다(Suspense).
 * 진열 상품은 기다리지 않는다: 받아 둔 상품 모델·명패 그림을 읽는 대로 슬롯을 맞춘다.
 * 진열 목록에서 바꾼 슬롯의 새 상품을 붙일 수 없으면(목록에 없음·받기/읽기 실패·크기 초과) 진열을 이전 상품으로 되돌리고 알린다.
 */
export function ShopModel({ products, daylight, kit, outline, pickTargets }: ShopModelProps) {
  const interiorGltf = useLoader(GLTFLoader, INTERIOR_ASSET as string) as GLTF;
  const shopkeeperGltf = useLoader(GLTFLoader, SHOPKEEPER_ASSET as string) as GLTF;
  const built = useMemo(() => buildShop(interiorGltf, shopkeeperGltf, [], kit), [interiorGltf, shopkeeperGltf, kit]);
  useEffect(() => () => built.dispose(), [built]);
  const stock = useSyncExternalStore(subscribeShopDisplay, shopDisplay, shopDisplay);
  const vacancy = useSyncExternalStore(subscribeShopVacancy, shopVacancy, shopVacancy);
  // 상품 모델·명패 그림을 다 읽거나 읽지 못하면 슬롯을 다시 맞추게 하는 수
  const [loadTick, setLoadTick] = useState(0);
  // 읽지 못한 상품 모델(받은 파일이 깨졌을 때). 이번에 들어와 있는 동안 그 상품은 진열할 수 없는 것으로 본다
  const failedModels = useRef(new Set<ShopProductId>());
  // 진열 목록에서 사용자가 바꾼 슬롯(교체에 실패하면 되돌리고 알린다). 처음 진열은 사용자가 바꾼 것이 아니다
  const lastStock = useRef(stock);
  const userSwaps = useRef(new Set<number>());
  if (lastStock.current !== stock) {
    stock.forEach((id, i) => {
      if (id !== lastStock.current[i] && id !== built.slotProducts[i]) userSwaps.current.add(i);
    });
    lastStock.current = stock;
  }
  // 받아 둔 상품 모델·명패 그림을 읽는다(주소마다 한 번)
  const fileKey = SHOP_PRODUCTS.map((p) => `${products[p.id].model}|${products[p.id].nameplate}`).join(";");
  useEffect(() => {
    let alive = true;
    for (const product of SHOP_PRODUCTS) {
      const files = products[product.id];
      const isUri = (v: string) => v !== "loading" && v !== "missing";
      if (isUri(files.model) && !built.hasProduct(product.id) && !failedModels.current.has(product.id)) {
        void loadProductModel(files.model).then((gltf) => {
          if (!alive) return;
          if (gltf) built.addProduct(product.id, gltf);
          else failedModels.current.add(product.id);
          setLoadTick((t) => t + 1);
        });
      }
      if (isUri(files.nameplate) && !built.hasNameplateTexture(product.id)) {
        void loadNameplateTexture(files.nameplate).then((texture) => {
          if (!alive || !texture) return;
          built.addNameplate(product.id, texture);
        });
      }
    }
    return () => {
      alive = false;
    };
    // 파일 상태가 바뀔 때만 다시 본다(products 객체는 그릴 때마다 새로 만들어진다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, fileKey]);
  // 진열을 맞춘다: 붙일 수 있는 슬롯은 붙이고, 사용자가 바꾼 슬롯의 새 상품을 붙일 수 없으면(목록에 없음·받기/읽기 실패·크기 초과)
  // 이전 상품으로 되돌리고 알린다. 아직 받는 중이면 기다린다(이전 상품·명패가 그대로 보인다)
  useEffect(() => {
    built.setStock(stock, vacancy);
    pickTargets.current = [...built.pickTargets];
    stock.forEach((id, i) => {
      // 빈 상태인 슬롯은 붙이지 않으므로 교체 실패도 아니다(진열 상태는 그대로 둔다)
      if (vacancy[i] || id === built.slotProducts[i]) {
        userSwaps.current.delete(i);
        return;
      }
      const placeable = built.canPlace(i, id);
      const missing = products[id].model === "missing" || failedModels.current.has(id);
      const failed = placeable === "too-big" || (placeable === "no-model" && missing);
      if (!failed || !userSwaps.current.has(i)) return;
      userSwaps.current.delete(i);
      notifyShopSwapFailed(i);
      const shown = built.slotProducts[i];
      if (shown) setShopDisplay(i, shown);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, stock, vacancy, fileKey, loadTick, pickTargets]);
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

/** 실내·버들 모델(앱 자산)을 읽지 못하면 아무것도 그리지 않고 알린다(로비 화면이 마을로 되돌린다). 다음에 다시 읽게 캐시를 비운다. */
export class ShopModelErrorBoundary extends Component<{ children: ReactNode; onFailed?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[lobby3d] 가구점 모델을 불러오지 못했습니다", error);
    useLoader.clear(GLTFLoader, INTERIOR_ASSET as string);
    useLoader.clear(GLTFLoader, SHOPKEEPER_ASSET as string);
    this.props.onFailed?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
