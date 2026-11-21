// [spec] qa 테스트(작업 133 06 피팅룸 양층): 진짜 층 GLB로 지은 장면에서 피팅룸 커튼의 Closed 모프(시나리오 B3·B21·B28·B31).
// 기대값은 06-피팅룸-양층/01-main-spec.md(화면 동작 1·6·7·8)에서만 가져왔다. 층 모델 로딩은 기존 옷집 장면 테스트의 방식(그림 참조를 뺀 GLB를 GLTFLoader로 읽기)을 따랐다.
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


type MorphMesh = import("three").Mesh;
const ROOMS = LAYOUT.fittingRooms as unknown as Record<string, { curtain: string; closedMorph: { name: string; openWeight: number; closedWeight: number } }>;

/** 장면 안에서 Closed 모프를 가진 메시와 그 모프 값. */
function closedMorphs(root: import("three").Object3D, morph: string) {
  const list: { mesh: MorphMesh; under: (name: string) => boolean; weight: number }[] = [];
  root.traverse((o) => {
    const mesh = o as MorphMesh;
    const index = mesh.isMesh ? mesh.morphTargetDictionary?.[morph] : undefined;
    if (index === undefined || !mesh.morphTargetInfluences) return;
    list.push({
      mesh,
      under: (name) => {
        for (let p: import("three").Object3D | null = mesh; p; p = p.parent) if (p.name === name) return true;
        return false;
      },
      weight: mesh.morphTargetInfluences[index]
    });
  });
  return list;
}

describe("[spec] 피팅룸 커튼 Closed 모프(양 층)", () => {
  for (const floor of [1, 2] as const) {
    it(`${floor}층: 커튼 메시가 있고, 처음에는 모두 열림(0), 닫으면 그 방 커튼의 Closed만 1, 열면 다시 0이고 다른 모프는 그대로다`, async () => {
      const room = ROOMS[String(floor)];
      const b = buildClothingFloor(floor, await load(FILES[floor]));
      const morph = room.closedMorph.name;
      expect(morph).toBe("Closed");
      const before = closedMorphs(b.root, morph);
      const curtain = before.filter((m) => m.under(room.curtain));
      expect(curtain.length).toBeGreaterThan(0);
      for (const m of curtain) expect({ floor, open: m.weight }).toEqual({ floor, open: room.closedMorph.openWeight });
      const others = before.filter((m) => !m.under(room.curtain)).map((m) => m.weight);
      b.setCurtainClosed(true);
      const closed = closedMorphs(b.root, morph);
      for (const m of closed.filter((x) => x.under(room.curtain))) expect(m.weight).toBe(room.closedMorph.closedWeight);
      expect(closed.filter((x) => !x.under(room.curtain)).map((m) => m.weight)).toEqual(others);
      b.setCurtainClosed(false);
      for (const m of closedMorphs(b.root, morph).filter((x) => x.under(room.curtain))) expect(m.weight).toBe(room.closedMorph.openWeight);
      b.dispose();
    }, 60000);
  }
});
