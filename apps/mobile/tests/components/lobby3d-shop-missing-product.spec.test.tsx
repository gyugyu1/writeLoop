// 작업 130(상품 여섯, 교체 실패 때 이전 상품·명패 유지)에 맞게 고쳤다(06 결정 1): 상품 배열은 SHOP_PRODUCTS 순서 여섯이고,
// 129의 M5(파일 없는 상품으로 바꾸면 그 슬롯이 빔)는 130 명세 3-4대로 '이전 상품·명패 유지'로 바꿨다.
// [spec] qa 테스트(작업 129 가구점 상품 없이 입장, 기능 변경, 모바일): 01-main-spec.md 명세 2(슬롯마다 따로 붙음, 파일 없는 상품의 슬롯은 비어 있음)와
// "그대로여야 할 동작"(비어 있는 슬롯에서 상품을 바꿔도 진열 상태는 바뀜)을 3D 장면 짓기(buildShop)로 본다.
// 기대값은 private 작업 폴더 129-2026-11-20-가구점-상품-없이-입장/01-main-spec.md에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다: buildShop(실내, 버들, 상품 셋, kit)의 상품 배열에서 파일이 없는 상품은 빈 칸(undefined)으로 준다고 가정했다.
// 나중에 받은 상품이 슬롯에 붙는 것(다 받는 대로 나타남)은 구현 방식을 몰라 여기서 보지 못한다(보고에 적음).
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

const isDisplay = (o: THREE.Object3D) => o.name.startsWith("shop-display-");

afterEach(() => {
  shop.resetShopDisplay();
  mockOutline.mockClear();
});

/** 상품 여섯 중 파일이 없는 것(번호)은 빈 칸으로 둔다. */
const without = (...missing: number[]) => products.map((gltf, i) => (missing.includes(i) ? undefined : gltf)) as unknown as GLTF[];

const NAMES = ["장화 화분", "고양이 편지 책상", "별지기 침대", "호두 침대", "이부자리", "구름 책상"];

describe("[spec] 파일 없는 상품의 슬롯(129 명세 2, 130 여섯)", () => {
  it("M1: 둘째 상품 파일이 없으면 슬롯 2만 비어 있고(받침만) 나머지 다섯 슬롯의 상품은 붙는다", () => {
    const built = buildShop(interior, keeper, without(1), kit());
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[1]).toBeNull();
    for (const i of [0, 2, 3, 4, 5]) expect(built.slotItems[i]).not.toBeNull();
    expect(built.slotNodes[1].children.filter(isDisplay)).toHaveLength(0);
    expect(count(built.root, isDisplay)).toBe(5);
  });

  it("M2: 상품 파일이 여섯 다 없어도 장면이 지어지고(오류 없음) 진열 상품은 하나도 붙지 않지만 실내·버들은 있다", () => {
    const built = buildShop(interior, keeper, without(0, 1, 2, 3, 4, 5), kit());
    built.setStock(shop.shopDisplay());
    expect(count(built.root, isDisplay)).toBe(0);
    expect(built.root.getObjectByName("shop-interior")).toBeTruthy();
    expect(built.shopkeeper.parent).toBe(built.root);
  });

  it("M3: 비어 있는 슬롯의 진열 상태는 그대로다(슬롯 2는 여전히 고양이 편지 책상)", () => {
    const built = buildShop(interior, keeper, without(1), kit());
    built.setStock(shop.shopDisplay());
    expect(shop.shopDisplay().map((id) => shop.shopProduct(id).name)).toEqual(NAMES);
  });
});

describe("[spec] 비어 있는 슬롯에서 바꾸기(129 명세 그대로 둘 동작)", () => {
  it("M4: 비어 있는 슬롯 2의 진열을 파일이 있는 상품(구름 책상)으로 바꾸면 진열 상태가 바뀌고 그 슬롯에 구름 책상이 붙는다. 다른 슬롯은 그대로다", () => {
    const built = buildShop(interior, keeper, without(1), kit());
    built.setStock(shop.shopDisplay());
    const others = [0, 2, 3, 4, 5].map((i) => built.slotItems[i]);
    shop.setShopDisplay(1, "cloudDesk");
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts[1]).toBe("cloudDesk");
    expect(built.slotItems[1]).not.toBeNull();
    expect(built.slotItems[1]!.parent).toBe(built.slotNodes[1]);
    [0, 2, 3, 4, 5].forEach((i, k) => expect(built.slotItems[i]).toBe(others[k]));
  });
});

describe("[spec] 130 명세 3-4: 파일 없는 상품으로 바꾸면 이전 상품·명패 유지(129 M5를 바꿈)", () => {
  it("M5: 파일이 있는 슬롯 1을 파일 없는 상품(고양이 편지 책상)으로 바꾸려 해도 그 슬롯의 이전 상품(장화 화분)이 그대로 붙어 있고, 다른 슬롯도 그대로다", () => {
    const built = buildShop(interior, keeper, without(1), kit());
    built.setStock(shop.shopDisplay());
    const before = [...built.slotItems];
    shop.setShopDisplay(0, "catPostDesk" as never);
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts[0]).toBe("rainbootPlanter");
    expect(built.slotItems[0]).toBe(before[0]);
    expect(built.slotItems[0]!.parent).toBe(built.slotNodes[0]);
    expect(built.slotNodes[0].children.filter(isDisplay)).toHaveLength(1);
    for (const i of [1, 2, 3, 4, 5]) expect(built.slotItems[i]).toBe(before[i]);
    expect(count(built.root, isDisplay)).toBe(5);
  });

  it("M5: 이전 명패도 그대로다(받침이 보이고 이전 상품의 그림이 보임)", () => {
    const built = buildShop(interior, keeper, without(1), kit());
    const texture = new THREE.Texture();
    built.addNameplate("rainbootPlanter", texture);
    built.setStock(shop.shopDisplay());
    const holder = built.root.getObjectByName("Station_01_Nameplate")!;
    expect(holder.visible).toBe(true);
    shop.setShopDisplay(0, "catPostDesk" as never);
    built.setStock(shop.shopDisplay());
    expect(holder.visible).toBe(true);
    expect(built.root.getObjectByName("Station_01_Nameplate_Default")!.visible).toBe(false);
    expect(built.slotProducts[0]).toBe("rainbootPlanter");
  });
});
