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
