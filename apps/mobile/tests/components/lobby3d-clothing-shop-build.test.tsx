// 메인 세션 테스트(작업 133 ① 옷집 입장·두 층 이동): 층 모델로 지은 장면(앞쪽 가림 노드 숨김, 누르기 대상, 오프셋 자리).
import { readFileSync } from "fs";
import { join } from "path";
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
const clothing = require("@/lib/lobby3d/clothing-shop") as typeof import("@/lib/lobby3d/clothing-shop");
/* eslint-enable @typescript-eslint/no-require-imports */

const APP_MODELS = join(__dirname, "../../assets/models/clothing-shop");

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

const FILES = { 1: "clothing-shop-interior-1f.glb", 2: "clothing-shop-interior-2f.glb" } as const;

describe("옷집 층 장면", () => {
  for (const floor of [1, 2] as const) {
    it(`${floor}층: 앞쪽 가림 노드는 숨고 누르기 대상이 아니며, 뿌리는 오프셋 자리이고 장소 기준점 노드가 모델에 있다`, async () => {
      const gltf = await load(APP_MODELS, FILES[floor]);
      const built = buildClothingFloor(floor, gltf);
      expect(built.root.position.x).toBe(clothing.CLOTHING_OFFSET.x);
      expect(built.root.position.z).toBe(clothing.CLOTHING_OFFSET.z);
      for (const name of clothing.CLOTHING_HIDDEN_NODES[floor]) {
        const node = built.root.getObjectByName(name);
        expect({ name, visible: node?.visible }).toEqual({ name, visible: false });
        expect(built.pickTargets.some((t) => t.name === name)).toBe(false);
      }
      expect(built.pickTargets.length).toBeGreaterThan(0);
      expect(built.pickTargets.some((t) => /Floor/.test(t.name))).toBe(false);
      const nodes = floor === 1 ? ["entranceSpawn", "exitApproach", "exitTrigger", "stairsUp", "fromUpper"] : ["stairsDown", "fromLower"];
      for (const key of nodes) {
        const spot = clothing.CLOTHING_NODES[key as keyof typeof clothing.CLOTHING_NODES];
        const node = built.root.getObjectByName(spot.node);
        expect({ key, found: Boolean(node) }).toEqual({ key, found: true });
        expect(node!.position.x + clothing.CLOTHING_OFFSET.x).toBeCloseTo(spot.x, 2);
        expect(node!.position.z + clothing.CLOTHING_OFFSET.z).toBeCloseTo(spot.z, 2);
      }
      built.dispose();
    }, 60000);
  }
});

// 작업 133 ② 진열: 진열 상품 모델의 pickNode를 displayAnchor에 붙이고, 진열 해제·선택 명패·예비 자리
describe("옷집 진열 상품", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
  /* eslint-enable @typescript-eslint/no-require-imports */

  afterEach(() => stock.resetClothingShop());

  it("층마다 진열 중인 상품만 그 displayAnchor에 로컬 0·배율 1로 붙고(1층 11·2층 11), 빈 진열 자리 16곳에는 아무것도 붙지 않는다", async () => {
    const samples = await load(APP_MODELS, "clothing-display-samples.glb");
    for (const floor of [1, 2] as const) {
      const built = buildClothingFloor(floor, await load(APP_MODELS, FILES[floor]));
      built.setStockModel(samples);
      built.setDisplayed(stock.clothingDisplayed());
      const expected = stock.clothingProductsOnFloor(floor).map((p) => p.id);
      expect(expected).toHaveLength(11);
      expect([...built.products.keys()].sort()).toEqual([...expected].sort());
      for (const id of expected) {
        const item = built.products.get(id)!;
        expect(item.parent?.name).toBe(stock.clothingProduct(id)!.displayAnchor);
        expect(item.position.length()).toBe(0);
        expect(item.scale.x).toBe(1);
        let tagged = true;
        item.traverse((o) => {
          if ((o as { isMesh?: boolean }).isMesh && o.userData.clothingProduct !== id) tagged = false;
        });
        expect({ id, tagged }).toEqual({ id, tagged: true });
      }
      expect(built.productTargets()).toHaveLength(expected.length);
      expect(stock.CLOTHING_RESERVE_MOUNTS[floor]).toHaveLength(floor === 1 ? 7 : 9);
      for (const mount of stock.CLOTHING_RESERVE_MOUNTS[floor]) {
        const node = built.root.getObjectByName(mount);
        expect({ mount, found: Boolean(node) }).toEqual({ mount, found: true });
        expect(node!.children.some((c) => c.name.startsWith("clothing-product-"))).toBe(false);
      }
      built.dispose();
    }
  }, 60000);

  it("진열을 해제하면 떼고 다시 켜면 붙으며, 선택한 상품의 진열대 명패만 보인다", async () => {
    const samples = await load(APP_MODELS, "clothing-display-samples.glb");
    const built = buildClothingFloor(1, await load(APP_MODELS, FILES[1]));
    built.setStockModel(samples);
    built.setDisplayed(stock.clothingDisplayed());
    const cap = stock.clothingProduct("capOrange")!;
    built.setSelected("capOrange");
    expect(built.root.getObjectByName(cap.nameplate)!.visible).toBe(true);
    expect(built.root.getObjectByName(stock.clothingProduct("mufflerRed")!.nameplate)!.visible).toBe(false);
    expect(built.textAnchorPoint("capOrange")).not.toBeNull();
    expect(built.textAnchorPoint("necklaceGold")).toBeNull();
    stock.setClothingDisplayed("capOrange", false);
    built.setDisplayed(stock.clothingDisplayed());
    built.setSelected("capOrange");
    expect(built.products.has("capOrange")).toBe(false);
    expect(built.root.getObjectByName(cap.nameplate)!.visible).toBe(false);
    stock.setClothingDisplayed("capOrange", true);
    built.setDisplayed(stock.clothingDisplayed());
    expect(built.products.get("capOrange")!.parent!.name).toBe(cap.displayAnchor);
    built.setSelected(null);
    expect(built.root.getObjectByName(cap.nameplate)!.visible).toBe(false);
  }, 60000);
});

// 작업 133 ③: 층마다 피팅룸 커튼의 Closed 모프를 닫고 연다
describe("옷집 피팅룸 커튼", () => {
  for (const floor of [1, 2] as const) {
    it(`${floor}층: 커튼은 처음 열려 있고(0) 닫으면 1, 열면 0`, async () => {
      const built = buildClothingFloor(floor, await load(APP_MODELS, FILES[floor]));
      expect(built.curtainWeight()).toBe(0);
      built.setCurtainClosed(true);
      expect(built.curtainWeight()).toBe(1);
      built.setCurtainClosed(false);
      expect(built.curtainWeight()).toBe(0);
      built.dispose();
    }, 60000);
  }
});

// 작업 133 피팅 카메라: 피팅룸 앞면 잘라 보기(피팅룸·커튼 재질에만 자르는 면)
describe("옷집 피팅룸 잘라 보기", () => {
  for (const floor of [1, 2] as const) {
    it(`${floor}층: 켜면 피팅룸·커튼·표지 메시 재질에만 라룹이 자리 앞을 자르는 면이 생기고, 끄면 없어진다`, async () => {
      const built = buildClothingFloor(floor, await load(APP_MODELS, FILES[floor]));
      const room = clothing.CLOTHING_FITTING_ROOMS[floor];
      const materialsOf = (name: string) => {
        const out: { clippingPlanes: unknown }[] = [];
        built.root.getObjectByName(name)?.traverse((o) => {
          const m = (o as unknown as { material?: { clippingPlanes: unknown } | { clippingPlanes: unknown }[] }).material;
          if (m) out.push(...(Array.isArray(m) ? m : [m]));
        });
        return out;
      };
      const booth = room.curtain.replace(/Curtain\d+$/, "Room");
      const sign = room.curtain.replace(/Curtain\d+$/, "SignText");
      expect(built.fittingCut()).toBe(false);
      built.setFittingCut(true);
      expect(built.fittingCut()).toBe(true);
      for (const name of [room.curtain, booth, sign]) {
        const mats = materialsOf(name);
        expect({ name, n: mats.length > 0 }).toEqual({ name, n: true });
        for (const m of mats) expect(Array.isArray(m.clippingPlanes) && (m.clippingPlanes as unknown[]).length === 1).toBe(true);
      }
      // 다른 부품(바닥 등)은 자르지 않는다
      const others = materialsOf(clothing.CLOTHING_FLOOR_ROOTS[floor]).filter((m) => Array.isArray(m.clippingPlanes) && (m.clippingPlanes as unknown[]).length > 0);
      expect(others.length).toBe(materialsOf(room.curtain).length + materialsOf(booth).length + materialsOf(sign).length);
      built.setFittingCut(false);
      for (const m of [...materialsOf(room.curtain), ...materialsOf(booth), ...materialsOf(sign)]) expect(m.clippingPlanes).toBeNull();
      built.dispose();
    }, 60000);
  }
});
