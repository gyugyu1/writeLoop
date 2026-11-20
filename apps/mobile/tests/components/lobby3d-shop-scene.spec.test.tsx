// [spec] qa 테스트(작업 128 가구점 실내, 새 기능, 모바일): 3D 장면 짓기(buildShop)를 실제 모델 파일로 본다.
// 작업 130(새 매장, 진열대 여섯, 상품 여섯, 원본 배율)에 맞게 고쳤다(06 결정 1). 좌표는 GLB 좌표 + (9, 8)이고 상품 배열은 SHOP_PRODUCTS 순서(여섯)다.
// 기대값은 private 작업 폴더 128-2026-11-19-가구점-실내/01-main-spec.md와 02-qa-scenarios.md에서만 가져온다(S번호는 시나리오 번호).
// 구현에서 읽은 것은 부르는 방법뿐이다: buildShop(실내, 버들, 상품 셋, kit)이 돌려주는 root·shopkeeper·slotNodes·slotItems·setStock.
// 모델 그림(PNG)은 Jest에서 풀 수 없어 모델의 그림 참조만 빼고 푼다(tests/components/lobby3d-shop-build.test.tsx와 같은 방식).
// 화면 밖에서 3D가 장면에서 빠지는 것(S31)은 Jest에서 3D 캔버스를 돌릴 수 없어 여기서 보지 못한다(보고에 적음).
import { readFileSync } from "fs";
import { join } from "path";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
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
const mockOutline = jest.fn();
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const three = require("three") as typeof import("three");
  return {
    OUTLINE_THICKNESS: 0.012,
    characterOutlineMaterial: () => {
      mockOutline();
      return new three.MeshBasicMaterial({ side: three.BackSide });
    }
  };
});

// 실내·버들은 앱 자산이라 장면 짓기가 불러오는 모듈이 require한다(Jest는 GLB를 풀지 못해 이름만 준다)
jest.mock("../../assets/models/shop/furniture-shop-interior.glb", () => "interior.glb");
jest.mock("../../assets/models/shop/beodeul.glb", () => "beodeul.glb");

/* eslint-disable @typescript-eslint/no-require-imports */
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js") as typeof import("three/examples/jsm/loaders/GLTFLoader.js");
const { buildShop } = require("@/components/lobby3d/lobby3d-shop") as typeof import("@/components/lobby3d/lobby3d-shop");
const shop = require("@/lib/lobby3d/shop") as typeof import("@/lib/lobby3d/shop");
/* eslint-enable @typescript-eslint/no-require-imports */

// 14 결정: 실내·버들은 앱 자산, 진열 상품 셋은 서버 아이템 목록 파일 폴더에서 읽는다
const APP_MODELS = join(__dirname, "../../assets/models/shop");
const SERVER_MODELS = join(__dirname, "../../../backend/src/main/resources/catalog/files");

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

interface RawNode {
  name: string;
  translation?: number[];
  extras?: Record<string, number>;
}
function rawNodes(file: string): RawNode[] {
  const data = readFileSync(join(APP_MODELS, file));
  const length = data.readUInt32LE(12);
  return (JSON.parse(data.subarray(20, 20 + length).toString("utf8")) as { nodes: RawNode[] }).nodes;
}
const rawInterior = rawNodes("furniture-shop-interior.glb");
const rawNode = (name: string) => rawInterior.find((n) => n.name === name)!;
/** GLB 좌표 → 앱 좌표(130 명세 2-2). */
const appOf = (name: string) => {
  const t = rawNode(name).translation ?? [0, 0, 0];
  return new THREE.Vector3(t[0] + 9, t[1], t[2] + 8);
};

let interior: GLTF;
let keeper: GLTF;
let products: GLTF[];

beforeAll(async () => {
  interior = await load(APP_MODELS, "furniture-shop-interior.glb");
  keeper = await load(APP_MODELS, "beodeul.glb");
  products = await Promise.all(["rainboot-planter.glb", "cat-post-desk.glb", "stargazer-bed.glb", "walnut-bed.glb", "grandmas-floor-bedding.glb", "cloud-desk.glb"].map((f) => load(SERVER_MODELS, f)));
}, 60000);

const kit = () => ({ gradient: new THREE.Texture(), toonMaterials: [] as THREE.MeshToonMaterial[] });

function count(root: THREE.Object3D, test: (o: THREE.Object3D) => boolean): number {
  let n = 0;
  root.traverse((o) => {
    if (test(o)) n += 1;
  });
  return n;
}

const PRODUCT_NAMES = ["장화 화분", "고양이 편지 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상"];
const idOf = (name: string) => shop.SHOP_PRODUCTS.find((p) => p.name === name)!.id;
const isDisplay = (o: THREE.Object3D) => o.name.startsWith("shop-display-");

afterEach(() => {
  shop.resetShopDisplay();
  mockOutline.mockClear();
});

describe("[spec] 창틀 숨김(S19)", () => {
  it("S19: 앞쪽 창틀·유리·입구 틀(ShopFront_Frame·ShopFront_Glass·ShopFront_EntryCasing)은 보이지 않고, 왼쪽 창틀·유리(ShopLeft_*)·초록 문짝(ShopDoor)·입구 깔개는 보인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    for (const name of ["ShopFront_Frame", "ShopFront_Glass", "ShopFront_EntryCasing"]) {
      const node = built.root.getObjectByName(name);
      expect({ name, visible: node?.visible }).toEqual({ name, visible: false });
    }
    for (const name of ["ShopLeft_Frame", "ShopLeft_Glass", "ShopDoor", "Entry_WovenRunner"]) {
      const node = built.root.getObjectByName(name);
      expect({ name, visible: node?.visible }).toEqual({ name, visible: true });
    }
  });
});

describe("[spec] 버들(S33~S36)", () => {
  it("S33: 버들 발바닥 중앙이 앱 (10.53, 14.56)이고 바닥(y 0)에 서며 CheckoutInteract (10.75, 12.47) 쪽을 본다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.root.updateMatrixWorld(true);
    const at = built.shopkeeper.getWorldPosition(new THREE.Vector3());
    expect(at.x).toBeCloseTo(10.53, 2);
    expect(at.z).toBeCloseTo(14.56, 2);
    expect(at.y).toBeCloseTo(0, 3);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(built.shopkeeper.getWorldQuaternion(new THREE.Quaternion()));
    const toGuest = new THREE.Vector3(10.75 - at.x, 0, 12.47 - at.z).normalize();
    expect(forward.dot(toGuest)).toBeGreaterThan(0.999);
  });

  it("S34: 배율 2.27(키 1.0 모델이 라룹이와 같은 키 2.27로 선다). 발바닥이 바닥에 닿는다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(built.shopkeeper.children[0]);
    expect(box.max.y - box.min.y).toBeCloseTo(2.27, 1);
    expect(box.min.y).toBeCloseTo(0, 1);
  });

  it("S35: 리깅된 기본 자세 그대로: 뼈의 자리·회전·크기가 모델 원본과 같고, 뼈대 메시(SkinnedMesh)로 그려진다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const original = new Map<string, THREE.Bone>();
    keeper.scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) original.set(o.name, o as THREE.Bone);
    });
    expect(original.size).toBeGreaterThan(0);
    let seen = 0;
    built.shopkeeper.traverse((o) => {
      if (!(o as THREE.Bone).isBone) return;
      const src = original.get(o.name);
      expect({ name: o.name, found: Boolean(src) }).toEqual({ name: o.name, found: true });
      expect(o.position.distanceTo(src!.position)).toBeLessThan(1e-6);
      // 부동소수점 오차(약 0.01도)는 같은 자세로 본다. 자세가 바뀌면 이보다 훨씬 크다
      expect(1 - Math.abs(o.quaternion.dot(src!.quaternion))).toBeLessThan(1e-6);
      expect(o.scale.distanceTo(src!.scale)).toBeLessThan(1e-6);
      seen += 1;
    });
    expect(seen).toBeGreaterThanOrEqual(original.size);
    expect(count(built.shopkeeper, (o) => (o as THREE.SkinnedMesh).isSkinnedMesh)).toBeGreaterThan(0);
  });

  it("S36: 라룹이와 같은 카툰 명암(MeshToonMaterial)과 외곽선 재질로 그린다: 몸 메시마다 외곽선 껍질이 한 겹 있다", () => {
    const k = kit();
    const built = buildShop(interior, keeper, products, k);
    const bodies = count(built.shopkeeper, (o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.Mesh).material instanceof THREE.MeshToonMaterial);
    const shells = count(
      built.shopkeeper,
      (o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.Mesh).material instanceof THREE.MeshBasicMaterial && ((o as THREE.Mesh).material as THREE.Material).side === THREE.BackSide
    );
    expect(bodies).toBeGreaterThan(0);
    expect(shells).toBe(bodies);
    // 라룹이의 외곽선 재질 만들기(characterOutlineMaterial)를 몸 메시 수만큼 부른다
    expect(mockOutline).toHaveBeenCalledTimes(bodies);
    // 라룹이와 같은 명암 그라데이션을 쓴다
    const toon = (built.shopkeeper.getObjectByProperty("isSkinnedMesh", true) as THREE.SkinnedMesh).material as THREE.MeshToonMaterial;
    expect(toon.gradientMap).toBe(k.gradient);
  });
});

describe("[spec] 진열 붙이기(S32·S40~S43)", () => {
  it("S40: 처음 진열은 01 장화 화분, 02 고양이 편지 책상, 03 별지기 침대, 04 호두 침대, 05 이부자리, 06 구름 책상이고 슬롯마다 하나다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts.map((id) => shop.shopProduct(id!).name)).toEqual(PRODUCT_NAMES);
    built.slotNodes.forEach((node, i) => {
      expect({ slot: i + 1, count: node.children.filter(isDisplay).length }).toEqual({ slot: i + 1, count: 1 });
    });
    expect(count(built.root, isDisplay)).toBe(6);
  });

  it("S41: 상품은 슬롯 노드의 변환을 따른다: 슬롯 노드 자리(GLB 슬롯 + (9, 8))에 놓이고 방향은 슬롯과 같다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    built.root.updateMatrixWorld(true);
    ["DisplaySlot_01", "DisplaySlot_02", "DisplaySlot_03", "DisplaySlot_04", "DisplaySlot_05", "DisplaySlot_06"].forEach((name, i) => {
      const item = built.slotItems[i]!;
      expect(item.parent).toBe(built.slotNodes[i]);
      const want = appOf(name);
      const at = built.slotNodes[i].getWorldPosition(new THREE.Vector3());
      expect(at.distanceTo(want)).toBeLessThan(1e-3);
      expect(item.getWorldPosition(new THREE.Vector3()).distanceTo(want)).toBeLessThan(1e-3);
      // 상품 +Z 정면이 슬롯 +Z(방향이 같다)
      expect(item.getWorldQuaternion(new THREE.Quaternion()).angleTo(built.slotNodes[i].getWorldQuaternion(new THREE.Quaternion()))).toBeLessThan(1e-3);
    });
  });

  it("S42(130): 진열 인스턴스는 줄이지 않는다(배율 (1, 1, 1)). 상품 여섯은 슬롯의 safe_radius_m·max_height_m 안에 든다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    built.root.updateMatrixWorld(true);
    ["DisplaySlot_01", "DisplaySlot_02", "DisplaySlot_03", "DisplaySlot_04", "DisplaySlot_05", "DisplaySlot_06"].forEach((name, i) => {
      const extras = rawNode(name).extras!;
      const item = built.slotItems[i]!;
      const box = new THREE.Box3().setFromObject(item);
      const c = appOf(name);
      const radius = Math.max(...[box.min.x, box.max.x].flatMap((x) => [box.min.z, box.max.z].map((z) => Math.hypot(x - c.x, z - c.z))));
      expect({ name, radiusOk: radius <= extras.safe_radius_m + 1e-3 }).toEqual({ name, radiusOk: true });
      expect({ name, heightOk: box.max.y - box.min.y <= extras.max_height_m + 1e-3 }).toEqual({ name, heightOk: true });
      expect(item.scale.toArray()).toEqual([1, 1, 1]);
    });
  });

  it("S43: 한 인스턴스의 배율을 바꿔도 원본 모델과 같은 상품의 다른 슬롯 인스턴스는 바뀌지 않는다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    const originalScales = products.map((p) => p.scene.scale.x);
    expect(originalScales).toEqual([1, 1, 1, 1, 1, 1]);
    // 같은 상품을 두 슬롯에 놓으면 서로 다른 인스턴스이고, 한쪽 배율이 다른 쪽을 바꾸지 않는다
    shop.setShopDisplay(1, idOf("구름 책상"));
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[1]).not.toBe(built.slotItems[5]);
    const first = built.slotItems[5]!.scale.x;
    built.slotItems[1]!.scale.setScalar(0.123);
    expect(built.slotItems[5]!.scale.x).toBe(first);
    expect(products[5].scene.scale.x).toBe(1);
    // 원본 모델에 진열 인스턴스가 붙지 않는다
    for (const p of products) expect(count(p.scene, isDisplay)).toBe(0);
  });

  it("S45: 한 진열대의 상품을 바꾸면 그 슬롯의 모델만 바뀐다(나머지 다섯 슬롯의 인스턴스는 같은 객체)", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    const before = [...built.slotItems];
    shop.setShopDisplay(1, idOf("구름 책상"));
    built.setStock(shop.shopDisplay());
    for (const i of [0, 2, 3, 4, 5]) expect(built.slotItems[i]).toBe(before[i]);
    expect(built.slotItems[1]).not.toBe(before[1]);
    expect(built.slotProducts.map((id) => shop.shopProduct(id!).name)).toEqual(["장화 화분", "구름 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상"]);
    expect(count(built.root, isDisplay)).toBe(6);
  });

  it("S32: 다시 들어와 새로 지어도(퇴장 뒤 재입장) 버들은 1명, 진열 상품은 슬롯마다 1개(6개)이고 반복해도 늘지 않으며 원본 실내에는 아무것도 붙지 않는다", () => {
    const k = kit();
    const interiorChildren = interior.scene.children.length;
    let previous: ReturnType<typeof buildShop> | null = null;
    for (let i = 0; i < 3; i += 1) {
      previous?.dispose();
      const built = buildShop(interior, keeper, products, k);
      built.setStock(shop.shopDisplay());
      expect(count(built.root, (o) => o.name === "shopkeeper")).toBe(1);
      expect(count(built.root, isDisplay)).toBe(6);
      expect(built.slotNodes.every((node) => node.children.filter(isDisplay).length === 1)).toBe(true);
      expect(interior.scene.children.length).toBe(interiorChildren);
      expect(count(interior.scene, (o) => o.name === "shopkeeper" || isDisplay(o))).toBe(0);
      previous = built;
    }
  });

  it("S32·S48: 재입장해도 지금 진열(바꿔 둔 것)대로 붙는다", () => {
    const k = kit();
    const first = buildShop(interior, keeper, products, k);
    first.setStock(shop.shopDisplay());
    shop.setShopDisplay(0, idOf("구름 책상"));
    first.setStock(shop.shopDisplay());
    first.dispose();
    const second = buildShop(interior, keeper, products, k);
    second.setStock(shop.shopDisplay());
    expect(second.slotProducts.map((id) => shop.shopProduct(id!).name)).toEqual(["구름 책상", "고양이 편지 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상"]);
  });
});
