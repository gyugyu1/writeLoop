// 메인 세션 테스트(작업 128 가구점 실내, 130 새 매장·명패): 실제 모델 파일(실내·버들·상품 여섯)을 GLTFLoader로 풀어 buildShop으로 지은 장면을 본다.
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
jest.mock("../../assets/models/shop/furniture-shop-interior.glb", () => "interior.glb");
jest.mock("../../assets/models/shop/beodeul.glb", () => "beodeul.glb");
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

// 실내·버들 모델은 앱에, 진열 상품 모델은 서버 아이템 목록 파일 폴더에 있다
const APP_MODELS = join(__dirname, "../../assets/models/shop");
const SERVER_FILES = join(__dirname, "../../../backend/src/main/resources/catalog/files");

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

async function load(dir: string, file: string): Promise<GLTF> {
  return new GLTFLoader().parseAsync(withoutImages(readFileSync(join(dir, file))), "");
}

let interior: GLTF;
let keeper: GLTF;
let products: GLTF[];

/** 상품 여섯의 서버 파일(SHOP_PRODUCTS 순서). */
const PRODUCT_FILES = ["rainboot-planter.glb", "cat-post-desk.glb", "stargazer-bed.glb", "walnut-bed.glb", "grandmas-floor-bedding.glb", "cloud-desk.glb"];

beforeAll(async () => {
  interior = await load(APP_MODELS, "furniture-shop-interior.glb");
  keeper = await load(APP_MODELS, "beodeul.glb");
  products = await Promise.all(PRODUCT_FILES.map((f) => load(SERVER_FILES, f)));
}, 60000);

const kit = () => ({ gradient: new THREE.Texture(), toonMaterials: [] as THREE.MeshToonMaterial[] });

function count(root: THREE.Object3D, test: (o: THREE.Object3D) => boolean): number {
  let n = 0;
  root.traverse((o) => {
    if (test(o)) n += 1;
  });
  return n;
}

/** 상품 여섯의 명패 그림을 모두 넣은 장면. */
function withTextures(built: ReturnType<typeof buildShop>) {
  for (const product of shop.SHOP_PRODUCTS) built.addNameplate(product.id, new THREE.Texture());
  return built;
}

afterEach(() => shop.resetShopDisplay());

describe("가구점 장면 짓기", () => {
  it("앞쪽 창틀·유리·입구 틀은 숨기고, 문짝은 보인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    for (const name of shop.SHOP_HIDDEN_NODES) expect(built.root.getObjectByName(name)?.visible).toBe(false);
    expect(built.root.getObjectByName("ShopDoor")?.visible).toBe(true);
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
    const bodies = count(built.shopkeeper, (o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.Mesh).material instanceof THREE.MeshToonMaterial);
    const shells = count(built.shopkeeper, (o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.Mesh).material instanceof THREE.MeshBasicMaterial);
    expect(bodies).toBeGreaterThan(0);
    expect(shells).toBe(bodies);
  });

  it("(130) 지은 직후 명패 받침은 모두 숨어 있고, 처음 진열 여섯을 붙이면 슬롯마다 원본 배율 상품 하나가 슬롯 회전으로 놓인다", () => {
    const built = withTextures(buildShop(interior, keeper, products, kit()));
    expect(built.nameplates.map((n) => n.holder?.visible)).toEqual([false, false, false, false, false, false]);
    expect(built.setStock(shop.shopDisplay())).toEqual([0, 1, 2, 3, 4, 5]);
    built.root.updateMatrixWorld(true);
    shop.SHOP_SLOTS.forEach((slot, i) => {
      expect(built.slotNodes[i].children.filter((c) => c.name.startsWith("shop-display-"))).toHaveLength(1);
      const item = built.slotItems[i]!;
      // 원본 배율, 자리·회전은 슬롯 노드에서(인스턴스는 항등)
      expect(item.scale.toArray()).toEqual([1, 1, 1]);
      expect(item.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      const box = new THREE.Box3().setFromObject(item);
      const center = built.slotNodes[i].getWorldPosition(new THREE.Vector3());
      expect(box.min.y).toBeCloseTo(center.y, 2);
      // 원본 크기 그대로(템플릿과 같은 높이)
      const original = new THREE.Box3().setFromObject(products[i].scene);
      expect(box.max.y - box.min.y).toBeCloseTo(original.max.y - original.min.y, 3);
    });
    expect(built.slotProducts).toEqual(shop.DEFAULT_SHOP_DISPLAY);
  });

  it("(130) 명패: 새겨진 글자와 이름이 같은 고양이 편지 책상(02)·구름 책상(06)은 새겨진 글자, 나머지 넷은 명패 그림 판을 보인다", () => {
    const built = withTextures(buildShop(interior, keeper, products, kit()));
    built.setStock(shop.shopDisplay());
    built.nameplates.forEach(({ holder, glyph, plate }, i) => {
      expect(holder?.visible).toBe(true);
      const usesGlyph = i === 1 || i === 5;
      expect({ slot: i + 1, glyph: glyph?.visible, plate: plate.visible }).toEqual({ slot: i + 1, glyph: usesGlyph, plate: !usesGlyph });
    });
  });

  it("(130) 명패 그림이 아직 없으면 상품은 붙고 명패 받침만 숨고, 그림이 들어오면 보인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[3]).not.toBeNull();
    expect(built.nameplates[3].holder?.visible).toBe(false);
    // 새겨진 글자를 쓰는 진열대는 그림 없이도 보인다
    expect(built.nameplates[5].holder?.visible).toBe(true);
    built.addNameplate("walnutBed", new THREE.Texture());
    expect(built.nameplates[3].holder?.visible).toBe(true);
    expect(built.nameplates[3].plate.visible).toBe(true);
  });

  it("(130) 한 슬롯을 바꾸면 그 슬롯의 상품과 명패만 바뀌고, 다른 진열대에 새겨진 글자는 빌리지 않고 명패 그림을 쓴다", () => {
    const built = withTextures(buildShop(interior, keeper, products, kit()));
    built.setStock(shop.shopDisplay());
    const before = [...built.slotItems];
    shop.setShopDisplay(3, "catPostDesk");
    expect(built.setStock(shop.shopDisplay())).toEqual([3]);
    before.forEach((item, i) => {
      if (i !== 3) expect(built.slotItems[i]).toBe(item);
    });
    expect(before[3]!.parent).toBeNull();
    expect(built.slotProducts[3]).toBe("catPostDesk");
    // 04 진열대에 새겨진 글자는 "호두껍질 침대"라 숨기고, 고양이 편지 책상의 명패 그림을 쓴다
    expect(built.nameplates[3].glyph?.visible).toBe(false);
    expect(built.nameplates[3].plate.visible).toBe(true);
    expect(built.pickTargets.filter((o) => o.name.startsWith("shop-display-"))).toHaveLength(6);
  });

  it("(130) 새 상품 모델이 아직 없거나 크기 검사를 통과하지 못하면 이전 상품과 명패를 그대로 둔다", () => {
    const built = withTextures(buildShop(interior, keeper, [products[0], null, null, products[3], null, null], kit()));
    built.setStock(shop.shopDisplay());
    // 모델이 없는 슬롯은 비고 명패도 숨는다
    expect(built.slotItems[1]).toBeNull();
    expect(built.nameplates[1].holder?.visible).toBe(false);
    expect(built.canPlace(1, "catPostDesk")).toBe("no-model");
    // 01(장화 화분) 자리에 아직 받지 않은 구름 책상으로 바꾸면 그대로 둔다
    const planter = built.slotItems[0];
    shop.setShopDisplay(0, "cloudDesk");
    expect(built.setStock(shop.shopDisplay())).toEqual([]);
    expect(built.slotItems[0]).toBe(planter);
    expect(built.slotProducts[0]).toBe("rainbootPlanter");
    expect(built.nameplates[0].holder?.visible).toBe(true);
    // 크기 검사에 걸리는 모델(반경 2m 상자)은 붙이지 않는다
    const big = new THREE.Group();
    big.add(new THREE.Mesh(new THREE.BoxGeometry(4, 1, 4), new THREE.MeshBasicMaterial()));
    built.addProduct("cloudDesk", { scene: big } as unknown as GLTF);
    expect(built.canPlace(0, "cloudDesk")).toBe("too-big");
    expect(built.setStock(shop.shopDisplay())).toEqual([]);
    expect(built.slotItems[0]).toBe(planter);
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
    expect(count(second.root, (o) => o.name.startsWith("shop-display-"))).toBe(6);
    expect(second.slotProducts[0]).toBe("grandmasFloorBedding");
    expect(count(interior.scene, (o) => o.name.startsWith("shop-display-"))).toBe(0);
  });

  it("누르기 대상: 버들·계산대는 계산대 장소, 진열대·명패·상품은 그 진열대, 문은 출입문", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    const placeOf = (o: THREE.Object3D) => (o.userData as { shopPlace?: string | null }).shopPlace ?? null;
    const byName = (prefix: string) => built.pickTargets.find((o) => o.name.startsWith(prefix));
    expect(placeOf(byName("Checkout")!)).toBe("shopCounter");
    expect(placeOf(byName("Station_05_Pedestal")!)).toBe("shopSlot5");
    expect(placeOf(built.root.getObjectByName("Station_05_Nameplate")!)).toBe("shopSlot5");
    expect(placeOf(byName("ShopDoor")!)).toBe("shopExit");
    expect(placeOf(byName("shop-display-6")!)).toBe("shopSlot6");
    expect(built.pickTargets.some((o) => shop.SHOP_HIDDEN_NODES.includes(o.name))).toBe(false);
  });
});
