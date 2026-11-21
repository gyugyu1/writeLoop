// [spec] qa 테스트(작업 133 05 최신 애셋 반영): 최신 층 모델·진열 상품 모델(진짜 GLB)로 지은 장면에서 진열 붙이기·선글라스·빈 자리 16곳·이름표 자리.
// 기대값은 05-최신-애셋-반영/01-main-spec.md(바뀌는 동작 3·4, 사용자가 확인을 요청한 것)에서만 가져왔다. 층 모델 로딩은 기존 옷집 장면 테스트의 방식(그림 참조를 뺀 GLB를 GLTFLoader로 읽기)을 따랐다.
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
const LAYOUT = require("@/lib/lobby3d/clothing-shop-layout.json") as typeof import("@/lib/lobby3d/clothing-shop-layout.json");
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

afterEach(() => stock.resetClothingShop());

async function built(floor: 1 | 2, withStock = true) {
  const b = buildClothingFloor(floor, await load(FILES[floor]));
  if (withStock) b.setStockModel(await load("clothing-display-samples.glb"));
  b.setDisplayed(stock.clothingDisplayed());
  return b;
}

type Mount = { node: string; occupancy?: string };
function emptyMountNodes(floor: 1 | 2): string[] {
  const f = LAYOUT.floors[String(floor) as "1" | "2"] as unknown as { reserveStations: { mounts: Mount[] }[]; merchandisingFixtures: { mounts: Mount[] }[] };
  return [...f.reserveStations, ...f.merchandisingFixtures].flatMap((s) => s.mounts.filter((m) => m.occupancy === "empty").map((m) => m.node));
}

describe("[spec] 진열 붙이기(바뀌는 동작 3)", () => {
  it("층마다 상품 11종이 displayAnchor 아래 한 개씩 로컬 위치 0·배율 1로 붙는다(1층 11·2층 11)", async () => {
    for (const floor of [1, 2] as const) {
      const b = await built(floor);
      expect(b.products.size).toBe(11);
      for (const p of stock.clothingProductsOnFloor(floor)) {
        const item = b.products.get(p.id)!;
        expect({ id: p.id, parent: item?.parent?.name }).toEqual({ id: p.id, parent: p.displayAnchor });
        expect(Math.abs(item.position.x) + Math.abs(item.position.y) + Math.abs(item.position.z)).toBe(0);
        expect(item.scale.x).toBe(1);
        expect(item.scale.y).toBe(1);
        expect(item.scale.z).toBe(1);
      }
      expect(b.productTargets()).toHaveLength(11);
      b.dispose();
    }
  }, 120000);

  it("선글라스는 1층에, 갈색 운동화·주황 티셔츠·남색 반바지·차양형 전투모는 2층에만 붙는다", async () => {
    const b1 = await built(1);
    const b2 = await built(2);
    for (const id of ["wear-face-honey-panto", "backpackRed"]) {
      expect({ id, f1: b1.products.has(id), f2: b2.products.has(id) }).toEqual({ id, f1: true, f2: false });
    }
    for (const id of ["shoesBrown", "tshirtOrange", "shortsNavy", "wear-hat-field-cap"]) {
      expect({ id, f1: b1.products.has(id), f2: b2.products.has(id) }).toEqual({ id, f1: false, f2: true });
    }
    expect(b1.products.get("wear-face-honey-panto")!.parent?.name).toBe("F1_Item_wear-face-honey-panto");
    b1.dispose();
    b2.dispose();
  }, 120000);

  it("선글라스 상품 메시가 자기 id를 달고 있고, 층 모델에 새 진열대 명패·이름표 노드가 있다", async () => {
    const b = await built(1);
    const ids = new Set<string>();
    let meshes = 0;
    b.products.get("wear-face-honey-panto")!.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) {
        meshes += 1;
        ids.add((o.userData as { clothingProduct?: string }).clothingProduct ?? "none");
      }
    });
    expect(meshes).toBeGreaterThan(0);
    expect([...ids]).toEqual(["wear-face-honey-panto"]);
    expect(b.root.getObjectByName("F1_Nameplate_HarborTable")).toBeDefined();
    expect(b.root.getObjectByName("F1_ProductName_HarborTable")).toBeDefined();
    expect(b.root.getObjectByName("F1_CheckoutCounter")).toBeDefined();
    b.dispose();
  }, 60000);
});

describe("[spec] 빈 진열 자리 16곳(바뀌는 동작 4)", () => {
  it("빈 자리는 두 층 합쳐 16곳이고 그 노드 아래에 상품이 없으며 누르기 대상이 아니다", async () => {
    expect(emptyMountNodes(1).length + emptyMountNodes(2).length).toBe(16);
    for (const floor of [1, 2] as const) {
      const b = await built(floor);
      for (const name of emptyMountNodes(floor)) {
        const node = b.root.getObjectByName(name);
        expect({ name, found: node !== undefined }).toEqual({ name, found: true });
        let products = 0;
        node!.traverse((o) => {
          if ((o.userData as { clothingProduct?: string }).clothingProduct) products += 1;
        });
        expect({ name, products }).toEqual({ name, products: 0 });
      }
      for (const item of b.products.values()) expect(emptyMountNodes(floor)).not.toContain(item.parent?.name);
      expect(b.productTargets()).toHaveLength(11);
      for (const t of b.productTargets()) expect(emptyMountNodes(floor)).not.toContain(t.parent?.name);
      b.dispose();
    }
  }, 120000);
});

describe("[spec] 명패와 이름표 자리(바뀌는 동작 3)", () => {
  it("선글라스를 고르면 새 진열대의 명패만 보이고, 이름표 자리는 F1_ProductName_HarborTable 노드 위치다", async () => {
    const b = await built(1);
    const plate = b.root.getObjectByName("F1_Nameplate_HarborTable")!;
    b.setSelected(null);
    expect(plate.visible).toBe(false);
    b.setSelected("wear-face-honey-panto");
    expect(plate.visible).toBe(true);
    const point = b.textAnchorPoint("wear-face-honey-panto")!;
    const world = b.root.getObjectByName("F1_ProductName_HarborTable")!.getWorldPosition(point.clone());
    expect(point.x).toBeCloseTo(world.x, 5);
    expect(point.y).toBeCloseTo(world.y, 5);
    expect(point.z).toBeCloseTo(world.z, 5);
    b.setSelected("capBlue");
    expect(plate.visible).toBe(false);
    expect(b.textAnchorPoint("tshirtOrange")).toBeNull();
    b.dispose();
  }, 60000);

  it("2층 상품(전투모·운동화·티셔츠·반바지)도 새 진열대 명패와 이름표 자리를 쓴다", async () => {
    const b = await built(2);
    for (const [id, plate, text] of [
      ["wear-hat-field-cap", "F2_Nameplate_FieldCapTable", "F2_ProductName_FieldCapTable"],
      ["shoesBrown", "F2_Nameplate_FieldBootTable", "F2_ProductName_FieldBootTable"],
      ["tshirtOrange", "F2_Nameplate_StudioRail", "F2_ProductName_StudioRail"],
      ["shortsNavy", "F2_Nameplate_FieldRail", "F2_ProductName_FieldRail"]
    ] as const) {
      b.setSelected(id);
      expect({ id, visible: b.root.getObjectByName(plate)!.visible }).toEqual({ id, visible: true });
      const point = b.textAnchorPoint(id)!;
      const world = b.root.getObjectByName(text)!.getWorldPosition(point.clone());
      expect(point.distanceTo(world)).toBeLessThan(1e-4);
    }
    b.dispose();
  }, 60000);
});
