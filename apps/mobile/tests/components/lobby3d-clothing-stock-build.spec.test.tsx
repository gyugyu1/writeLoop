// [spec] qa 테스트(작업 133 ② 옷집 진열): 층 모델·진열 상품 모델(진짜 GLB)로 지은 장면에서 진열 상품 붙이기·진열 해제·명패·이름표 자리·예비 자리.
// 기대값은 03-진열-상품선택-장바구니/02-qa-scenarios.md(S08~S11, S14, S18, S22, S31, S34)에서만 가져온다. 층 모델 로딩 방법은 기존 옷집 장면 테스트의 방식(그림 참조를 뺀 GLB를 GLTFLoader로 읽기)을 따랐다.
import { readFileSync } from "fs";
import { join } from "path";
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
jest.mock("../../assets/models/shop/furniture-shop-interior.glb", () => "interior.glb");
jest.mock("../../assets/models/shop/beodeul.glb", () => "beodeul.glb");
jest.mock("../../assets/models/clothing-shop/clothing-shop-interior-1f.glb", () => "f1.glb");
jest.mock("../../assets/models/clothing-shop/clothing-shop-interior-2f.glb", () => "f2.glb");
jest.mock("../../assets/models/clothing-shop/clothing-display-samples.glb", () => "samples.glb");
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const three = require("three") as typeof import("three");
  return { OUTLINE_THICKNESS: 0.012, characterOutlineMaterial: () => new three.MeshBasicMaterial({ side: three.BackSide }) };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js") as typeof import("three/examples/jsm/loaders/GLTFLoader.js");
const { buildClothingFloor } = require("@/components/lobby3d/lobby3d-clothing-shop") as typeof import("@/components/lobby3d/lobby3d-clothing-shop");
const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
/* eslint-enable @typescript-eslint/no-require-imports */

const APP_MODELS = join(__dirname, "../../assets/models/clothing-shop");
const FILES = { 1: "clothing-shop-interior-1f.glb", 2: "clothing-shop-interior-2f.glb" } as const;

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
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
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

const load = (file: string): Promise<GLTF> => new GLTFLoader().parseAsync(withoutImages(readFileSync(join(APP_MODELS, file))), "");

const MANNEQUIN_1F = ["wear-hat-breakwater-bucket", "wear-top-tide-sailor", "wear-bottom-jetty-denim", "shoesWhite"];
const MANNEQUIN_2F = ["wear-hat-field-cap", "wear-top-field-blouse", "wear-bottom-field-trousers", "wear-shoe-combat-boot"];

afterEach(() => stock.resetClothingShop());

async function built(floor: 1 | 2, withStock = true) {
  const b = buildClothingFloor(floor, await load(FILES[floor]));
  if (withStock) b.setStockModel(await load("clothing-display-samples.glb"));
  b.setDisplayed(stock.clothingDisplayed());
  return b;
}

describe("[spec] 진열 붙이기(S08~S11)", () => {
  it("S08·S09·S10: 층마다 진열 상품이 displayAnchor 아래 한 개씩(1층 11·2층 11) 로컬 위치 0·배율 1로 붙고, 마네킹 네 상품이 따로 붙는다", async () => {
    for (const [floor, count, mannequin] of [[1, 11, MANNEQUIN_1F], [2, 11, MANNEQUIN_2F]] as const) {
      const b = await built(floor);
      expect(b.products.size).toBe(count);
      for (const p of stock.clothingProductsOnFloor(floor)) {
        const item = b.products.get(p.id)!;
        expect({ id: p.id, parent: item?.parent?.name }).toEqual({ id: p.id, parent: p.displayAnchor });
        expect(Math.abs(item.position.x)).toBe(0);
        expect(Math.abs(item.position.y)).toBe(0);
        expect(Math.abs(item.position.z)).toBe(0);
        expect(Math.abs(item.rotation.x)).toBe(0);
        expect(Math.abs(item.rotation.y)).toBe(0);
        expect(Math.abs(item.rotation.z)).toBe(0);
        expect(item.scale.x).toBe(1);
        expect(item.scale.y).toBe(1);
        expect(item.scale.z).toBe(1);
      }
      for (const id of mannequin) expect(b.products.has(id)).toBe(true);
      expect(b.productTargets()).toHaveLength(count);
      b.dispose();
    }
  }, 120000);

  it("S09: 1층에는 2층 상품이, 2층에는 1층 상품이 붙지 않는다", async () => {
    const b1 = await built(1);
    for (const p of stock.clothingProductsOnFloor(2)) expect(b1.products.has(p.id)).toBe(false);
    const b2 = await built(2);
    for (const p of stock.clothingProductsOnFloor(1)) expect(b2.products.has(p.id)).toBe(false);
    b1.dispose();
    b2.dispose();
  }, 120000);

  it("S31: 예비 자리(합계 10곳) 노드 아래에는 상품이 붙지 않는다", async () => {
    for (const floor of [1, 2] as const) {
      const b = await built(floor);
      for (const name of stock.CLOTHING_RESERVE_MOUNTS[floor]) {
        const node = b.root.getObjectByName(name);
        if (!node) continue;
        expect({ name, children: node.children.filter((c) => c.name.startsWith("clothing-product-")).length }).toEqual({ name, children: 0 });
      }
      for (const item of b.products.values()) expect(stock.CLOTHING_RESERVE_MOUNTS[floor]).not.toContain(item.parent?.name);
      b.dispose();
    }
  }, 120000);

  it("S11: 진열 상품 모델이 없으면 진열 없이 층은 그대로 있다(누르기 대상 층 부품은 그대로)", async () => {
    const b = await built(1, false);
    expect(b.products.size).toBe(0);
    expect(b.productTargets()).toHaveLength(0);
    expect(b.pickTargets.length).toBeGreaterThan(0);
    expect(b.root.getObjectByName("F1_StairsUp")).toBeDefined();
    b.dispose();
  }, 60000);
});

describe("[spec] 누르기 표시(S13·S14)", () => {
  it("S14: 상품 메시마다 자기 상품 id를 달아 마네킹의 네 상품이 서로 다른 id로 잡힌다", async () => {
    const b = await built(1);
    for (const id of MANNEQUIN_1F) {
      const ids = new Set<string>();
      b.products.get(id)!.traverse((o) => {
        if ((o as { isMesh?: boolean }).isMesh) ids.add((o.userData as { clothingProduct?: string }).clothingProduct ?? "none");
      });
      expect({ id, ids: [...ids] }).toEqual({ id, ids: [id] });
    }
    b.dispose();
  }, 60000);
});

describe("[spec] 명패와 이름표 자리(S18·S22)", () => {
  it("S18: 선택한 상품의 진열대 명패만 보이고, 선택을 풀면 숨는다", async () => {
    const b = await built(1);
    const plateOf = (id: string) => b.root.getObjectByName(stock.clothingProduct(id)!.nameplate)!;
    b.setSelected(null);
    expect(plateOf("capOrange").visible).toBe(false);
    b.setSelected("capOrange");
    expect(plateOf("capOrange").visible).toBe(true);
    expect(plateOf("capBlue").visible).toBe(false);
    b.setSelected("capBlue");
    expect(plateOf("capOrange").visible).toBe(false);
    expect(plateOf("capBlue").visible).toBe(true);
    b.setSelected(null);
    expect(plateOf("capBlue").visible).toBe(false);
    b.dispose();
  }, 60000);

  it("S22: 이름표 자리는 선택 상품 진열대의 textAnchor 노드 위치이고, 다른 층 상품은 null이다", async () => {
    const b = await built(1);
    const point = b.textAnchorPoint("capOrange")!;
    const node = b.root.getObjectByName("F1_ProductName_Table")!;
    expect(node).toBeDefined();
    const world = node.getWorldPosition(point.clone());
    expect(point.x).toBeCloseTo(world.x, 5);
    expect(point.y).toBeCloseTo(world.y, 5);
    expect(point.z).toBeCloseTo(world.z, 5);
    expect(b.textAnchorPoint("necklaceGold")).toBeNull();
    b.dispose();
  }, 60000);
});

describe("[spec] 진열 해제(S34~S35, S37)", () => {
  it("S34: 진열을 끄면 그 상품만 떨어지고(누르기 대상에서도 빠짐), 켜면 같은 자리에 돌아온다", async () => {
    const b = await built(1);
    stock.setClothingDisplayed("capBlue", false);
    b.setDisplayed(stock.clothingDisplayed());
    expect(b.products.has("capBlue")).toBe(false);
    expect(b.products.size).toBe(10);
    expect(b.productTargets()).toHaveLength(10);
    stock.setClothingDisplayed("capBlue", true);
    b.setDisplayed(stock.clothingDisplayed());
    expect(b.products.get("capBlue")!.parent?.name).toBe("F1_Item_capBlue");
    expect(b.products.size).toBe(11);
    b.dispose();
  }, 60000);

  it("S35: 진열을 뗀 상품은 선택해도 그 명패가 보이지 않는다", async () => {
    const b = await built(1);
    b.setSelected("capBlue");
    stock.setClothingDisplayed("capBlue", false);
    b.setDisplayed(stock.clothingDisplayed());
    b.setSelected("capBlue");
    expect(b.root.getObjectByName("F1_Nameplate_WindowDress")!.visible).toBe(false);
    b.dispose();
  }, 60000);
});
