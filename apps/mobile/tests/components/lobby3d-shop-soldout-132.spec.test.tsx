// [spec] qa 테스트(작업 132 가구점 품절 안내판, 기능 변경, 모바일): 새 매장 모델의 품절 안내판을 3D 장면 짓기(buildShop)와 ShopModel로 본다.
// 기대값은 private 작업 폴더 132-2026-11-20-가구점-품절-안내판/01-main-spec.md(명세 1·3~7, "테스트가 쓸 이름")에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다: buildShop(실내, 버들, 상품 배열, kit)·setStock(stock, vacancy?)·soldOutBoards·addProduct·addNameplate·slotItems·pickTargets,
// ShopModel(products·daylight·kit·outline·pickTargets)과 shopVacancy 구독. 상품·실내 모델은 실제 파일을 읽는다(130 테스트와 같다).
import { act, render } from "@testing-library/react-native";
import { readFileSync } from "fs";
import { join } from "path";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ShopProductId } from "@/lib/lobby3d/shop";

const mockGltf: { interior: GLTF | null; keeper: GLTF | null } = { interior: null, keeper: null };

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
jest.mock("@react-three/fiber/native", () => ({
  useFrame: () => {},
  useLoader: Object.assign((_loader: unknown, url: string) => (url === "interior.glb" ? mockGltf.interior : mockGltf.keeper), { clear: () => {} }),
  useThree: () => ({ scene: {} })
}));
jest.mock("../../assets/models/shop/furniture-shop-interior.glb", () => "interior.glb");
jest.mock("../../assets/models/shop/beodeul.glb", () => "beodeul.glb");
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const three = require("three") as typeof import("three");
  return { OUTLINE_THICKNESS: 0.012, characterOutlineMaterial: () => new three.MeshBasicMaterial({ side: three.BackSide }) };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js") as typeof import("three/examples/jsm/loaders/GLTFLoader.js");
const { buildShop, ShopModel } = require("@/components/lobby3d/lobby3d-shop") as typeof import("@/components/lobby3d/lobby3d-shop");
const shop = require("@/lib/lobby3d/shop") as typeof import("@/lib/lobby3d/shop");
/* eslint-enable @typescript-eslint/no-require-imports */

const APP_MODELS = join(__dirname, "../../assets/models/shop");
const SERVER_FILES = join(__dirname, "../../../backend/src/main/resources/catalog/files");
const IDS: ShopProductId[] = ["rainbootPlanter", "catPostDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"];
const FILES = ["rainboot-planter.glb", "cat-post-desk.glb", "stargazer-bed.glb", "walnut-bed.glb", "grandmas-floor-bedding.glb", "cloud-desk.glb"];
/** 슬롯 가운데(앱 좌표 = shop-layout.json의 모델 좌표 + (9, 8)). */
const CENTERS = [
  [3.06, 11],
  [3.06, 6.62],
  [6.48, 3.02],
  [10.95, 3.02],
  [15.08, 5.66],
  [15.08, 10.06]
];
const NONE = [false, false, false, false, false, false];
const only = (i: number) => NONE.map((_, k) => k === i);

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

function boxProduct(w: number, d: number, h: number): GLTF {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(0, h / 2, 0);
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x888888 })));
  return { scene } as unknown as GLTF;
}

const loaded: Record<string, GLTF> = {};
let interior: GLTF;
let keeper: GLTF;
let products: GLTF[];
beforeAll(async () => {
  interior = await load(APP_MODELS, "furniture-shop-interior.glb");
  keeper = await load(APP_MODELS, "beodeul.glb");
  products = await Promise.all(FILES.map((f) => load(SERVER_FILES, f)));
  IDS.forEach((id, i) => (loaded[id] = products[i]));
  mockGltf.interior = interior;
  mockGltf.keeper = keeper;
}, 90000);

const kit = () => ({ gradient: new THREE.Texture(), toonMaterials: [] as THREE.MeshToonMaterial[] });
type Built = ReturnType<typeof buildShop>;
type VacancyBuilt = { setStock(stock: readonly ShopProductId[], vacancy?: readonly boolean[]): number[]; soldOutBoards: (THREE.Object3D | null)[] };
const vac = (built: Built) => built as unknown as VacancyBuilt;
const stockOf = (built: Built, vacancy?: readonly boolean[]) => vac(built).setStock(shop.shopDisplay(), vacancy);
/** 안내판 여섯(모두 있어야 한다). 없는 모델의 null 확인은 vac(built).soldOutBoards를 직접 읽는다. */
function boardsOf(built: Built): THREE.Object3D[] {
  const boards = vac(built).soldOutBoards;
  if (!boards || boards.length !== 6 || boards.some((b) => !b)) throw new Error("soldOutBoards 여섯이 모두 있어야 합니다");
  return boards as THREE.Object3D[];
}

function shown(o: THREE.Object3D | null | undefined): boolean {
  for (let n = o ?? null; n; n = n.parent) if (!n.visible) return false;
  return Boolean(o);
}
const holderOf = (root: THREE.Object3D, slot: number) => root.getObjectByName(`Station_0${slot + 1}_Nameplate`)!;
const itemOf = (root: THREE.Object3D, slot: number) => root.getObjectByName(`DisplaySlot_0${slot + 1}`)!.children.find((c) => c.name.startsWith("shop-display-")) ?? null;
/** 모든 상품에 명패 그림을 넣어, 상품이 붙으면 명찰이 보이게 한다. */
function withTextures(built: Built): Built {
  for (const id of IDS) built.addNameplate(id, new THREE.Texture());
  return built;
}

afterEach(() => {
  shop.resetShopDisplay();
  (shop as { resetShopVacancy?: () => void }).resetShopVacancy?.();
});

describe("[spec] 매장을 지을 때 안내판 여섯을 붙이고 숨긴다(명세 3)", () => {
  it("B1: ShopNameplateTemplates 장면의 ShopDisplay_SoldOutBoard 복제본이 여섯, 이름 shop-soldout-N, 부모는 Station_NN_Pedestal, 로컬 (0, 0.25, 0)·회전 항등이다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const boards = boardsOf(built);
    boards.forEach((board, i) => {
      expect(board!.name).toBe(`shop-soldout-${i + 1}`);
      expect(board!.parent?.name).toBe(`Station_0${i + 1}_Pedestal`);
      expect(board!.position.toArray()).toEqual([0, 0.25, 0]);
      const q = board!.quaternion;
      expect([q.x, q.y, q.z, q.w]).toEqual([0, 0, 0, 1]);
    });
  });

  it("B2: 지은 직후 여섯 안내판은 모두 숨겨져 있다(진열을 붙인 뒤에도 빈 상태가 아니면 숨김)", () => {
    const built = buildShop(interior, keeper, products, kit());
    boardsOf(built).forEach((b) => expect(shown(b)).toBe(false));
    stockOf(built);
    boardsOf(built).forEach((b) => expect(shown(b)).toBe(false));
  });

  it("B3: 안내판은 진열대 한가운데(받침 자리)에서 앞(+Z, 앱 카메라 쪽)을 본다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.root.updateMatrixWorld(true);
    boardsOf(built).forEach((board, i) => {
      const p = board!.getWorldPosition(new THREE.Vector3());
      expect(p.x).toBeCloseTo(CENTERS[i][0], 2);
      expect(p.z).toBeCloseTo(CENTERS[i][1], 2);
      expect(p.y).toBeCloseTo(0.25, 3);
      const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(board!.getWorldQuaternion(new THREE.Quaternion()));
      expect(facing.x).toBeCloseTo(0, 3);
      expect(facing.y).toBeCloseTo(0, 3);
      expect(facing.z).toBeCloseTo(1, 3);
    });
  });

  it("B4: 안내판의 모든 메시는 그 진열대 장소(shopSlotN)를 누르기 데이터로 가진다(안내판을 누르면 그 진열대로 간다)", () => {
    const built = buildShop(interior, keeper, products, kit());
    boardsOf(built).forEach((board, i) => {
      let meshes = 0;
      board!.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        meshes += 1;
        expect({ i, place: (o.userData as { shopPlace?: string }).shopPlace }).toEqual({ i, place: `shopSlot${i + 1}` });
      });
      expect(meshes).toBeGreaterThan(0);
    });
  });

  it("B5: 원본 템플릿 장면은 건드리지 않는다(복제본을 붙이고, 다시 지어도 진열대마다 안내판은 하나다)", () => {
    const template = interior.scenes.find((s) => s.name === "ShopNameplateTemplates")!;
    expect(template).toBeDefined();
    const original = template.getObjectByName("ShopDisplay_SoldOutBoard")!;
    expect(original).toBeDefined();
    const parentBefore = original.parent;
    const k = kit();
    const first = buildShop(interior, keeper, products, k);
    first.dispose();
    const second = buildShop(interior, keeper, products, k);
    expect(original.parent).toBe(parentBefore);
    expect(boardsOf(second).every((b) => b !== original)).toBe(true);
    let count = 0;
    second.root.traverse((o) => {
      if (o.name.startsWith("shop-soldout-")) count += 1;
    });
    expect(count).toBe(6);
  });

  it("B6: 템플릿 장면이 없는 모델이면 안내판은 null이고(오류 없이), 빈 상태로 해도 상품은 비워진다", () => {
    const noTemplates = { ...interior, scenes: [interior.scene] } as unknown as GLTF;
    const built = buildShop(noTemplates, keeper, products, kit());
    expect(vac(built).soldOutBoards).toEqual([null, null, null, null, null, null]);
    stockOf(built);
    expect(() => stockOf(built, only(0))).not.toThrow();
    expect(itemOf(built.root, 0)).toBeNull();
  });
});

describe("[spec] 새 명찰 자리는 GLB 값 그대로다(명세 1)", () => {
  it("N0: 매장 장면의 명찰 받침 여섯은 GLB의 위치·회전을 앱이 옮기지 않은 채 쓴다(05는 01보다 22cm 높다)", () => {
    const built = buildShop(interior, keeper, products, kit());
    const names = [1, 2, 3, 4, 5, 6].map((n) => `Station_0${n}_Nameplate`);
    const raw = names.map((n) => interior.scene.getObjectByName(n)!);
    names.forEach((n, i) => {
      const o = built.root.getObjectByName(n)!;
      expect(o.position.toArray()).toEqual(raw[i].position.toArray());
      expect(o.quaternion.toArray()).toEqual(raw[i].quaternion.toArray());
    });
    expect(raw[4].position.y - raw[0].position.y).toBeCloseTo(0.22, 3);
  });
});

describe("[spec] 빈 상태 확정과 복구(명세 4·5): 진열대 여섯 각각", () => {
  it.each([0, 1, 2, 3, 4, 5])("E1: 진열대 %i: 상품 있음 → 빈 상태 확정(상품·누르기 대상 제거, 명찰 숨김, 안내판 보임) → 복구(상품·명찰 보임, 안내판 숨김)", (i) => {
    const built = withTextures(buildShop(interior, keeper, products, kit()));
    stockOf(built);
    const root = built.root;
    expect(itemOf(root, i)).not.toBeNull();
    expect(shown(holderOf(root, i))).toBe(true);
    expect(shown(boardsOf(built)[i])).toBe(false);
    const item = itemOf(root, i)!;

    stockOf(built, only(i));
    expect(itemOf(root, i)).toBeNull();
    expect(built.slotItems[i]).toBeNull();
    expect(built.pickTargets).not.toContain(item);
    expect(built.pickTargets.some((o) => o.name === `shop-display-${i + 1}`)).toBe(false);
    expect(shown(holderOf(root, i))).toBe(false);
    expect(shown(boardsOf(built)[i])).toBe(true);
    for (let k = 0; k < 6; k += 1) {
      if (k === i) continue;
      expect({ k, item: itemOf(root, k) !== null, holder: shown(holderOf(root, k)), board: shown(boardsOf(built)[k]) }).toEqual({ k, item: true, holder: true, board: false });
    }

    stockOf(built, NONE);
    expect(itemOf(root, i)).not.toBeNull();
    expect(built.slotItems[i]).toBe(itemOf(root, i));
    expect(built.pickTargets).toContain(built.slotItems[i]);
    expect(shown(holderOf(root, i))).toBe(true);
    expect(shown(boardsOf(built)[i])).toBe(false);
  });

  it("E2: setStock의 vacancy를 생략하면 모두 빈 상태가 아니다(안내판은 숨김, 상품은 붙는다)", () => {
    const built = buildShop(interior, keeper, products, kit());
    stockOf(built);
    for (let i = 0; i < 6; i += 1) expect(itemOf(built.root, i)).not.toBeNull();
    boardsOf(built).forEach((b) => expect(shown(b)).toBe(false));
  });

  it("E3: 여러 진열대를 함께 빈 상태로 해도 되고, 일부만 복구해도 나머지는 그대로다", () => {
    const built = withTextures(buildShop(interior, keeper, products, kit()));
    stockOf(built);
    stockOf(built, [true, false, true, false, true, true]);
    [0, 2, 4, 5].forEach((i) => expect({ i, item: itemOf(built.root, i), board: shown(boardsOf(built)[i]) }).toEqual({ i, item: null, board: true }));
    [1, 3].forEach((i) => expect({ i, item: itemOf(built.root, i) !== null, board: shown(boardsOf(built)[i]) }).toEqual({ i, item: true, board: false }));
    stockOf(built, [false, false, true, false, false, true]);
    [0, 1, 3, 4].forEach((i) => expect({ i, item: itemOf(built.root, i) !== null, board: shown(boardsOf(built)[i]) }).toEqual({ i, item: true, board: false }));
    [2, 5].forEach((i) => expect({ i, item: itemOf(built.root, i), board: shown(boardsOf(built)[i]) }).toEqual({ i, item: null, board: true }));
  });

  it("E4: 빈 상태 슬롯에 명찰 그림이 나중에 들어와도 명찰은 숨은 채다(안내판만 보인다)", () => {
    const built = buildShop(interior, keeper, products, kit());
    stockOf(built);
    stockOf(built, only(0));
    built.addNameplate("rainbootPlanter", new THREE.Texture());
    expect(shown(holderOf(built.root, 0))).toBe(false);
    expect(shown(boardsOf(built)[0])).toBe(true);
  });

  it("E5: 한 번도 상품을 붙이지 않은 채 처음부터 빈 상태여도 상품은 붙지 않고 안내판이 보인다", () => {
    const built = withTextures(buildShop(interior, keeper, products, kit()));
    stockOf(built, only(3));
    expect(itemOf(built.root, 3)).toBeNull();
    expect(shown(boardsOf(built)[3])).toBe(true);
    expect(shown(holderOf(built.root, 3))).toBe(false);
    expect(itemOf(built.root, 0)).not.toBeNull();
  });
});

describe("[spec] 복구는 붙은 때만 안내판을 내린다(명세 5)", () => {
  it("F1: 상품 모델이 아직 없으면(받는 중·없음·읽기 실패) 빈 상태를 풀어도 안내판이 그대로 보이고 명찰은 숨는다. 모델이 들어와 붙으면 안내판이 내려가고 명찰이 보인다", () => {
    const without = products.map((p, i) => (i === 5 ? undefined : p)) as unknown as GLTF[];
    const built = withTextures(buildShop(interior, keeper, without, kit()));
    stockOf(built, only(5));
    expect(shown(boardsOf(built)[5])).toBe(true);
    stockOf(built, NONE);
    expect(itemOf(built.root, 5)).toBeNull();
    expect(shown(boardsOf(built)[5])).toBe(true);
    expect(shown(holderOf(built.root, 5))).toBe(false);
    built.addProduct("cloudDesk", loaded.cloudDesk);
    stockOf(built, NONE);
    expect(itemOf(built.root, 5)).not.toBeNull();
    expect(shown(boardsOf(built)[5])).toBe(false);
    expect(shown(holderOf(built.root, 5))).toBe(true);
  });

  it("F2: 크기 검사를 통과하지 못하면(크기 초과) 빈 상태를 풀어도 안내판이 그대로 보인다", () => {
    const huge = products.map((p, i) => (i === 0 ? boxProduct(5, 5, 1) : p));
    const built = withTextures(buildShop(interior, keeper, huge, kit()));
    expect(built.canPlace(0, "rainbootPlanter")).toBe("too-big");
    stockOf(built, only(0));
    stockOf(built, NONE);
    expect(itemOf(built.root, 0)).toBeNull();
    expect(shown(boardsOf(built)[0])).toBe(true);
    expect(shown(holderOf(built.root, 0))).toBe(false);
  });
});

describe("[spec] 빈 상태가 아닌 슬롯의 실패는 품절이 아니다(명세 6)", () => {
  it("G1: 처음부터 상품 모델이 없거나 크기 초과인 슬롯은 비고 명찰은 숨고 안내판은 숨김이다", () => {
    const odd = products.map((p, i) => (i === 1 ? undefined : i === 2 ? boxProduct(5, 5, 1) : p)) as unknown as GLTF[];
    const built = withTextures(buildShop(interior, keeper, odd, kit()));
    stockOf(built);
    for (const i of [1, 2]) {
      expect({ i, item: itemOf(built.root, i) }).toEqual({ i, item: null });
      expect(shown(holderOf(built.root, i))).toBe(false);
      expect(shown(boardsOf(built)[i])).toBe(false);
    }
  });

  it("G2: 교체 실패(크기 초과)·교체 대기(모델 없음)에서는 이전 상품·명찰을 유지하고 안내판은 숨김이다", () => {
    const withoutCloud = products.map((p, i) => (i === 5 ? undefined : p)) as unknown as GLTF[];
    const built = withTextures(buildShop(interior, keeper, withoutCloud, kit()));
    stockOf(built);
    const old = itemOf(built.root, 0);
    shop.setShopDisplay(0, "cloudDesk");
    stockOf(built);
    expect(itemOf(built.root, 0)).toBe(old);
    expect(shown(holderOf(built.root, 0))).toBe(true);
    expect(shown(boardsOf(built)[0])).toBe(false);
    built.addProduct("cloudDesk", boxProduct(5, 5, 1));
    stockOf(built);
    expect(itemOf(built.root, 0)).toBe(old);
    expect(shown(holderOf(built.root, 0))).toBe(true);
    expect(shown(boardsOf(built)[0])).toBe(false);
  });
});

describe("[spec] 빈 상태인 슬롯에서 진열을 바꿔도 빈 상태 표시는 그대로다(명세 7)", () => {
  it("H1: 빈 상태 슬롯에서 진열 목록으로 상품을 바꾸면 그 슬롯은 계속 비고 안내판이 보이며, 빈 상태를 풀면 바뀐 상품이 붙는다", () => {
    const built = withTextures(buildShop(interior, keeper, products, kit()));
    stockOf(built);
    stockOf(built, only(0));
    shop.setShopDisplay(0, "cloudDesk");
    stockOf(built, only(0));
    expect(itemOf(built.root, 0)).toBeNull();
    expect(shown(boardsOf(built)[0])).toBe(true);
    stockOf(built, NONE);
    expect(built.slotProducts[0]).toBe("cloudDesk");
    expect(itemOf(built.root, 0)).not.toBeNull();
    expect(shown(boardsOf(built)[0])).toBe(false);
    expect(shown(holderOf(built.root, 0))).toBe(true);
  });
});

/* ---------------- ShopModel(빈 상태 구독) ---------------- */

const replies = new Map<string, GLTF | "fail">();
let run = 0;
beforeEach(() => {
  run += 1;
  replies.clear();
  jest.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async (url: string) => {
    const reply = replies.get(url);
    if (!reply || reply === "fail") throw new Error(`읽지 못함(테스트 가짜): ${url}`);
    return reply;
  });
  jest.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(async () => new THREE.Texture());
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

type FileState = { model: string; nameplate: string };
type FileMap = Record<ShopProductId, FileState>;
const uriOf = (id: ShopProductId) => `file:///run${run}/${id}.glb`;
const plateOf = (id: ShopProductId) => `file:///run${run}/${id}.png`;
function fileMap(override: Partial<Record<ShopProductId, Partial<FileState>>> = {}): FileMap {
  const out = {} as FileMap;
  for (const id of IDS) {
    out[id] = { model: uriOf(id), nameplate: plateOf(id), ...(override[id] ?? {}) };
    if (out[id].model.startsWith("file:") && !replies.has(out[id].model)) replies.set(out[id].model, loaded[id]);
  }
  return out;
}
const daylight = { ambience: { ambientColor: 0xffffff, ambientIntensity: 1, sunColor: 0xffffff, sunIntensity: 1 } } as never;
const lastPick = { current: [] as THREE.Object3D[] };
async function renderShop(files: FileMap) {
  const k = kit();
  lastPick.current = [];
  const view = await render(<ShopModel products={files} daylight={daylight} kit={k} outline={1} pickTargets={lastPick} />);
  const again = async (next: FileMap) => view.rerender(<ShopModel products={next} daylight={daylight} kit={k} outline={1} pickTargets={lastPick} />);
  return { view, again };
}
async function settle() {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}
function shopRoot(): THREE.Object3D {
  for (let n: THREE.Object3D | null = lastPick.current[0] ?? null; n; n = n.parent) if (n.name === "shop-root") return n;
  throw new Error("가구점 장면이 그려지지 않았습니다");
}
const board = (slot: number) => {
  const found = shopRoot().getObjectByName(`shop-soldout-${slot + 1}`);
  if (!found) throw new Error(`shop-soldout-${slot + 1}이 없습니다`);
  return found;
};
const setVacant = async (slot: number, vacant: boolean) => {
  await act(async () => {
    (shop as unknown as { setShopSlotVacant(slot: number, vacant: boolean): void }).setShopSlotVacant(slot, vacant);
  });
  await settle();
};

describe("[spec] ShopModel은 빈 상태 표시를 구독해 3D에 반영한다(명세 2·4·5)", () => {
  it("M1: 진열대 여섯 각각: 상품 있음 → 빈 상태 켜기(상품 제거·누르기 대상 제거·명찰 숨김·안내판) → 끄기(상품·명찰, 안내판 숨김)", async () => {
    await renderShop(fileMap());
    await settle();
    for (let i = 0; i < 6; i += 1) {
      expect({ i, item: itemOf(shopRoot(), i) !== null, board: shown(board(i)), holder: shown(holderOf(shopRoot(), i)) }).toEqual({ i, item: true, board: false, holder: true });
      await setVacant(i, true);
      expect({ i, item: itemOf(shopRoot(), i), board: shown(board(i)), holder: shown(holderOf(shopRoot(), i)) }).toEqual({ i, item: null, board: true, holder: false });
      expect(lastPick.current.some((o) => o.name === `shop-display-${i + 1}`)).toBe(false);
      await setVacant(i, false);
      expect({ i, item: itemOf(shopRoot(), i) !== null, board: shown(board(i)), holder: shown(holderOf(shopRoot(), i)) }).toEqual({ i, item: true, board: false, holder: true });
      expect(lastPick.current.some((o) => o.name === `shop-display-${i + 1}`)).toBe(true);
    }
  });

  it("M2: 이미 빈 상태인 진열대로 가구점에 들어오면(ShopModel이 새로 지어져도) 상품 없이 안내판이 보인다", async () => {
    (shop as unknown as { setShopSlotVacant(slot: number, vacant: boolean): void }).setShopSlotVacant(4, true);
    await renderShop(fileMap());
    await settle();
    expect(itemOf(shopRoot(), 4)).toBeNull();
    expect(shown(board(4))).toBe(true);
    expect(itemOf(shopRoot(), 0)).not.toBeNull();
  });

  it("M3: 빈 상태에서 풀었는데 상품 모델을 아직 받는 중이면 안내판이 그대로이고, 받아 읽으면 안내판이 내려가고 상품·명찰이 보인다", async () => {
    const { again } = await renderShop(fileMap({ catPostDesk: { model: "loading" } }));
    await settle();
    expect(itemOf(shopRoot(), 1)).toBeNull();
    await setVacant(1, true);
    expect(shown(board(1))).toBe(true);
    await setVacant(1, false);
    expect(itemOf(shopRoot(), 1)).toBeNull();
    expect(shown(board(1))).toBe(true);
    await again(fileMap());
    await settle();
    expect(itemOf(shopRoot(), 1)).not.toBeNull();
    expect(shown(board(1))).toBe(false);
    expect(shown(holderOf(shopRoot(), 1))).toBe(true);
  });

  it("M4: 빈 상태에서 풀었는데 상품 파일이 없거나(missing) 읽기에 실패하면 안내판이 그대로 보인다", async () => {
    const files = fileMap({ catPostDesk: { model: "missing" } });
    replies.set(files.walnutBed.model, "fail");
    await renderShop(files);
    await settle();
    for (const i of [1, 3]) {
      await setVacant(i, true);
      await setVacant(i, false);
      expect({ i, item: itemOf(shopRoot(), i), board: shown(board(i)) }).toEqual({ i, item: null, board: true });
    }
  });

  it("M5: 빈 상태가 아닌 슬롯의 상품 파일 없음·읽기 실패는 품절이 아니다: 안내판은 숨김이다", async () => {
    const files = fileMap({ catPostDesk: { model: "missing" } });
    replies.set(files.walnutBed.model, "fail");
    await renderShop(files);
    await settle();
    for (const i of [1, 3]) expect({ i, item: itemOf(shopRoot(), i), board: shown(board(i)), holder: shown(holderOf(shopRoot(), i)) }).toEqual({ i, item: null, board: false, holder: false });
  });

  it("M6: 빈 상태인 슬롯에서 진열을 바꿔도 교체 실패 안내·진열 되돌림이 없고, 진열 상태는 바뀐 채이며 그 슬롯은 계속 빈 상태다", async () => {
    const failures: number[] = [];
    const off = shop.onShopSwapFailed((slot) => failures.push(slot));
    await renderShop(fileMap({ cloudDesk: { model: "missing" } }));
    await settle();
    await setVacant(0, true);
    await act(async () => {
      shop.setShopDisplay(0, "cloudDesk");
    });
    await settle();
    off();
    expect(failures).toEqual([]);
    expect(shop.shopDisplay()[0]).toBe("cloudDesk");
    expect((shop as unknown as { isShopSlotVacant(i: number): boolean }).isShopSlotVacant(0)).toBe(true);
    expect(itemOf(shopRoot(), 0)).toBeNull();
    expect(shown(board(0))).toBe(true);
  });

  it("M7: 빈 상태가 아닌 슬롯의 교체 실패는 130 그대로 안내와 되돌림이 있다(다른 슬롯의 빈 상태가 이를 바꾸지 않는다)", async () => {
    const failures: number[] = [];
    const off = shop.onShopSwapFailed((slot) => failures.push(slot));
    await renderShop(fileMap({ cloudDesk: { model: "missing" } }));
    await settle();
    await setVacant(3, true);
    await act(async () => {
      shop.setShopDisplay(0, "cloudDesk");
    });
    await settle();
    off();
    expect(failures).toEqual([0]);
    expect(shop.shopDisplay()[0]).toBe("rainbootPlanter");
    expect(shown(board(0))).toBe(false);
  });
});
