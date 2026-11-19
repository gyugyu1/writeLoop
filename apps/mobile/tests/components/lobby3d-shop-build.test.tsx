// 메인 세션 테스트(작업 128 가구점 실내): 실제 모델 파일(실내·버들·상품 셋)을 GLTFLoader로 풀어 buildShop으로 지은 장면을 본다.
// 앞 창틀 숨김, 버들 자리·방향·배율, 슬롯별 진열·축소, 한 슬롯만 바꾸기, 다시 지어도(재입장) 버들 1명·슬롯마다 상품 1개.
// 버들 그림(PNG)은 Jest에서 풀 수 없어(그림 해석기가 없다) 모델의 그림 참조만 빼고 푼다.
import { readFileSync } from "fs";
import { join } from "path";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  // GLTFLoader·SkeletonUtils(모듈판)와 같은 three를 쓰게 모듈판을 읽는다
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "three.module.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "loaders", "GLTFLoader.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "utils", "SkeletonUtils.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => ({ useFrame: () => {}, useLoader: Object.assign(() => null, { clear: () => {} }), useThree: () => ({}) }));
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const three = require("three") as typeof import("three");
  return { OUTLINE_THICKNESS: 0.012, characterOutlineMaterial: () => new three.MeshBasicMaterial({ side: three.BackSide }) };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js") as typeof import("three/examples/jsm/loaders/GLTFLoader.js");
const { buildShop } = require("@/components/lobby3d/lobby3d-shop") as typeof import("@/components/lobby3d/lobby3d-shop");
const shop = require("@/lib/lobby3d/shop") as typeof import("@/lib/lobby3d/shop");
/* eslint-enable @typescript-eslint/no-require-imports */

// 가구점 모델은 앱에 들어 있지 않고 서버 아이템 목록 파일 폴더에 있다
const MODELS = join(__dirname, "../../../backend/src/main/resources/catalog/files");

/** GLB의 JSON 조각에서 그림 참조를 빼고 다시 GLB로 묶는다. */
function withoutImages(data: Buffer): ArrayBuffer {
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.toString("utf8", 20, 20 + jsonLength)) as {
    images?: unknown;
    textures?: unknown;
    samplers?: unknown;
    materials?: { pbrMetallicRoughness?: Record<string, unknown>; normalTexture?: unknown; emissiveTexture?: unknown; occlusionTexture?: unknown }[];
  };
  delete json.images;
  delete json.textures;
  delete json.samplers;
  for (const m of json.materials ?? []) {
    if (m.pbrMetallicRoughness) {
      delete m.pbrMetallicRoughness.baseColorTexture;
      delete m.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete m.normalTexture;
    delete m.emissiveTexture;
    delete m.occlusionTexture;
  }
  let text = Buffer.from(JSON.stringify(json), "utf8");
  const pad = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const bin = data.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + bin.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const out = Buffer.concat([header, text, bin]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

async function load(file: string): Promise<GLTF> {
  return new GLTFLoader().parseAsync(withoutImages(readFileSync(join(MODELS, file))), "");
}

let interior: GLTF;
let keeper: GLTF;
let products: GLTF[];

beforeAll(async () => {
  interior = await load("shop-interior.glb");
  keeper = await load("shopkeeper-beodeul.glb");
  products = await Promise.all(["walnut-bed.glb", "grandmas-floor-bedding.glb", "cloud-desk.glb"].map((f) => load(f)));
}, 60000);

const kit = () => ({ gradient: new THREE.Texture(), toonMaterials: [] as THREE.MeshToonMaterial[] });

function count(root: THREE.Object3D, test: (o: THREE.Object3D) => boolean): number {
  let n = 0;
  root.traverse((o) => {
    if (test(o)) n += 1;
  });
  return n;
}

afterEach(() => shop.resetShopDisplay());

describe("가구점 장면 짓기", () => {
  it("앞쪽 창틀·유리·입구 틀은 숨기고, 왼쪽 창틀·문짝은 보인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    for (const name of shop.SHOP_HIDDEN_NODES) expect(built.root.getObjectByName(name)?.visible).toBe(false);
    for (const name of ["ShopLeft_Frame", "ShopLeft_Glass", "ShopDoor"]) expect(built.root.getObjectByName(name)?.visible).toBe(true);
  });

  it("버들은 CheckoutNPC 자리에 계산대 앞 손님 쪽을 보고, 배율 2.27로 선다(뼈대 있는 기본 자세)", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.root.updateMatrixWorld(true);
    const at = built.shopkeeper.getWorldPosition(new THREE.Vector3());
    expect(at.x).toBeCloseTo(shop.SHOP_NODES.checkoutNpc.x, 3);
    expect(at.z).toBeCloseTo(shop.SHOP_NODES.checkoutNpc.z, 3);
    expect(at.y).toBeCloseTo(0, 3);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(built.shopkeeper.getWorldQuaternion(new THREE.Quaternion()));
    const toGuest = new THREE.Vector3(shop.SHOP_NODES.checkoutInteract.x - at.x, 0, shop.SHOP_NODES.checkoutInteract.z - at.z).normalize();
    expect(forward.dot(toGuest)).toBeGreaterThan(0.999);
    const box = new THREE.Box3().setFromObject(built.shopkeeper.children[0]);
    expect(box.max.y - box.min.y).toBeCloseTo(2.27, 1);
    // 뼈대로 휘는 몸과 외곽선 껍질(같은 수), 몸은 카툰 재질
    const bodies = count(built.shopkeeper, (o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.Mesh).material instanceof THREE.MeshToonMaterial);
    const shells = count(built.shopkeeper, (o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.Mesh).material instanceof THREE.MeshBasicMaterial);
    expect(bodies).toBeGreaterThan(0);
    expect(shells).toBe(bodies);
  });

  it("처음 진열을 붙이면 슬롯마다 상품 하나이고, 큰 상품은 그 인스턴스만 슬롯 반경·높이 안으로 줄인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    expect(built.setStock(shop.shopDisplay())).toEqual([0, 1, 2]);
    built.root.updateMatrixWorld(true);
    shop.SHOP_SLOTS.forEach((slot, i) => {
      expect(built.slotNodes[i].children.filter((c) => c.name.startsWith("shop-display-"))).toHaveLength(1);
      const item = built.slotItems[i]!;
      const box = new THREE.Box3().setFromObject(item);
      const center = built.slotNodes[i].getWorldPosition(new THREE.Vector3());
      const radius = Math.max(
        ...[box.min.x, box.max.x].flatMap((x) => [box.min.z, box.max.z].map((z) => Math.hypot(x - center.x, z - center.z)))
      );
      expect(radius).toBeLessThanOrEqual(slot.safeRadius + 1e-3);
      expect(box.max.y - box.min.y).toBeLessThanOrEqual(slot.maxHeight + 1e-3);
      // 바닥 중앙이 슬롯 원점에 놓인다
      expect(box.min.y).toBeCloseTo(center.y, 2);
    });
    // 원본(템플릿)은 줄이지 않는다
    expect(products[0].scene.scale.x).toBe(1);
  });

  it("한 슬롯을 바꾸면 그 슬롯의 인스턴스만 바뀌고 다른 슬롯의 인스턴스는 그대로다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    const before = [...built.slotItems];
    shop.setShopDisplay(1, "cloudDesk");
    expect(built.setStock(shop.shopDisplay())).toEqual([1]);
    expect(built.slotItems[0]).toBe(before[0]);
    expect(built.slotItems[2]).toBe(before[2]);
    expect(built.slotItems[1]).not.toBe(before[1]);
    expect(before[1]!.parent).toBeNull();
    expect(built.slotNodes[1].children.filter((c) => c.name.startsWith("shop-display-"))).toHaveLength(1);
    // 같은 상품을 두 슬롯에 놓아도 서로 다른 인스턴스이고, 각 슬롯 크기에 맞춘다
    expect(built.slotItems[1]).not.toBe(built.slotItems[2]);
    expect(built.slotProducts).toEqual(["walnutBed", "cloudDesk", "cloudDesk"]);
    expect(built.pickTargets.filter((o) => o.name.startsWith("shop-display-"))).toHaveLength(3);
  });

  it("다시 지어도(나갔다 다시 들어옴) 버들은 1명, 슬롯마다 상품 1개이고 지금 진열을 따른다", () => {
    const k = kit();
    const first = buildShop(interior, keeper, products, k);
    first.setStock(shop.shopDisplay());
    shop.setShopDisplay(0, "grandmasFloorBedding");
    first.setStock(shop.shopDisplay());
    first.dispose();
    expect(k.toonMaterials).toHaveLength(0);
    const second = buildShop(interior, keeper, products, k);
    second.setStock(shop.shopDisplay());
    expect(count(second.root, (o) => o.name === "shopkeeper")).toBe(1);
    expect(count(second.root, (o) => o.name.startsWith("shop-display-"))).toBe(3);
    expect(second.slotProducts).toEqual(["grandmasFloorBedding", "grandmasFloorBedding", "cloudDesk"]);
    // 원본 실내 장면에는 상품이 붙지 않는다(복제본에만 붙는다)
    expect(count(interior.scene, (o) => o.name.startsWith("shop-display-"))).toBe(0);
  });

  it("누르기 대상: 버들·계산대는 계산대 장소, 진열대·상품은 그 진열대, 문은 출입문", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    const placeOf = (o: THREE.Object3D) => (o.userData as { shopPlace?: string | null }).shopPlace ?? null;
    const byName = (prefix: string) => built.pickTargets.find((o) => o.name.startsWith(prefix));
    expect(placeOf(byName("Checkout")!)).toBe("shopCounter");
    expect(placeOf(byName("Station_02_Pedestal")!)).toBe("shopSlot2");
    expect(placeOf(byName("ShopDoor")!)).toBe("shopExit");
    expect(placeOf(byName("shop-display-3")!)).toBe("shopSlot3");
    expect(built.pickTargets.some((o) => placeOf(o) === "shopCounter" && !o.visible)).toBe(true);
    // 숨긴 앞 창틀은 누르기 대상이 아니다
    expect(built.pickTargets.some((o) => shop.SHOP_HIDDEN_NODES.includes(o.name))).toBe(false);
  });
});
