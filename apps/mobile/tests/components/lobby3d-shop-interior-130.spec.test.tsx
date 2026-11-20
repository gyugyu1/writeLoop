// [spec] qa 테스트(작업 130 가구점 새 매장·명패, 기능 변경, 모바일): 새 매장 모델 + 상품 여섯 + 명패를 3D 장면 짓기(buildShop)로 본다.
// 기대값은 private 작업 폴더 130-2026-11-20-가구점-새-매장-명패/01-main-spec.md(명세 2-1·2-6, 3, 4)에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다. 128·129의 buildShop(실내, 버들, 상품 배열, kit)·setStock·addProduct·slotItems·slotProducts·slotNodes·pickTargets는
// 그대로라고 가정하고, 명패 그림을 장면에 넘기는 방법은 알 수 없어 built.addNameplate(상품 id, THREE.Texture)라고 가정했다(구현과 다르면 이 부분만 고친다).
// 명패 받침·새겨진 글자는 모델의 노드 이름(Station_NN_Nameplate, Station_NN_Nameplate_Default)으로 찾는다.
// 상품·실내 모델은 실제 파일을 읽는다: 실내는 앱 자산, 상품 여섯은 서버 아이템 목록 파일 폴더(backend/src/main/resources/catalog/files). 파일 이름은 명세의 표.
import { existsSync, readFileSync } from "fs";
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

const APP_MODELS = join(__dirname, "../../assets/models/shop");
const SERVER_FILES = join(__dirname, "../../../backend/src/main/resources/catalog/files");
/** 명세 1의 표(슬롯 01~06 차례): 상품 id, 서버 파일. */
const PRODUCTS = [
  { id: "rainbootPlanter", file: "rainboot-planter.glb" },
  { id: "catPostDesk", file: "cat-post-desk.glb" },
  { id: "stargazerBed", file: "stargazer-bed.glb" },
  { id: "walnutBed", file: "walnut-bed.glb" },
  { id: "grandmasFloorBedding", file: "grandmas-floor-bedding.glb" },
  { id: "cloudDesk", file: "cloud-desk.glb" }
] as const;
type ProductId = (typeof PRODUCTS)[number]["id"];
/** 명세 4-2: 새겨진 글자와 이름이 같아 그것을 쓰는 슬롯(02·06)과 명패 그림이 필요한 슬롯(01·03·04·05). */
const GLYPH_SLOTS = [1, 5];
const IMAGE_SLOTS = [0, 2, 3, 4];

/** 슬롯 가운데(앱 좌표, shop-layout.json의 centerXZ + (9, 8)). */
const CENTERS = [
  [3.06, 11],
  [3.06, 6.62],
  [6.48, 3.02],
  [10.95, 3.02],
  [15.08, 5.66],
  [15.08, 10.06]
];

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

/** 가짜 상품: 바닥 중앙 기준 가로 w × 세로(깊이) d × 높이 h 상자. */
function boxProduct(w: number, d: number, h: number): GLTF {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(0, h / 2, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x888888 }));
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene } as unknown as GLTF;
}

let interior: GLTF;
let keeper: GLTF;
let products: GLTF[];

beforeAll(async () => {
  interior = await load(APP_MODELS, "furniture-shop-interior.glb");
  keeper = await load(APP_MODELS, "beodeul.glb");
  products = await Promise.all(PRODUCTS.map((p) => load(SERVER_FILES, p.file)));
}, 90000);

const kit = () => ({ gradient: new THREE.Texture(), toonMaterials: [] as THREE.MeshToonMaterial[] });

/** 상품마다 다른 명패 그림(구분용). */
function textures(): Record<ProductId, THREE.Texture> {
  const out = {} as Record<ProductId, THREE.Texture>;
  for (const p of PRODUCTS) out[p.id] = new THREE.Texture();
  return out;
}

interface NameplateApi {
  addNameplate(id: string, texture: THREE.Texture): void;
}
const addNameplate = (built: unknown, id: string, texture: THREE.Texture) => (built as NameplateApi).addNameplate(id, texture);

type Built = ReturnType<typeof buildShop>;

const holderOf = (built: Built, slot: number) => built.root.getObjectByName(`Station_0${slot + 1}_Nameplate`)!;
const glyphOf = (built: Built, slot: number) => built.root.getObjectByName(`Station_0${slot + 1}_Nameplate_Default`)!;

/** 그 노드와 위 조상이 모두 보이는지(뿌리까지). */
function shown(o: THREE.Object3D | null | undefined): boolean {
  for (let n = o ?? null; n; n = n.parent) if (!n.visible) return false;
  return Boolean(o);
}

/** 받침 아래의 명패 그림 면(새겨진 글자가 아닌 메시 가운데 그 그림을 쓰는 것). 없으면 null. */
function imageMeshOf(built: Built, slot: number, texture: THREE.Texture): THREE.Mesh | null {
  const glyph = glyphOf(built, slot);
  let found: THREE.Mesh | null = null;
  holderOf(built, slot).traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o === glyph || glyph.getObjectById(o.id)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some((m) => (m as THREE.MeshBasicMaterial).map && ((m as THREE.MeshBasicMaterial).map === texture || (m as THREE.MeshBasicMaterial).map!.source === texture.source))) found = mesh;
  });
  return found;
}

/** 받침 아래에서 지금 보이는 명패 그림 면이 있는지(어느 그림이든). */
function anyImageShown(built: Built, slot: number): boolean {
  const glyph = glyphOf(built, slot);
  let any = false;
  holderOf(built, slot).traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || o === glyph || glyph.getObjectById(o.id)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some((m) => (m as THREE.MeshBasicMaterial).map) && shown(mesh)) any = true;
  });
  return any;
}

const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

afterEach(() => shop.resetShopDisplay());

describe("[spec] 새 매장 모델(명세 2-1, 2-2, 2-6)", () => {
  it("I1: 앱 자산 실내 모델이 새 매장이다: 진열 슬롯 여섯·명패 받침과 글자 여섯이 있고, 옛 슬롯 셋 구성이 아니다", () => {
    for (let i = 1; i <= 6; i += 1) {
      const n = `0${i}`;
      for (const name of [`DisplaySlot_${n}`, `Station_${n}_Pedestal`, `Station_${n}_Nameplate`, `Station_${n}_Nameplate_Default`]) {
        expect({ name, found: Boolean(interior.scene.getObjectByName(name)) }).toEqual({ name, found: true });
      }
    }
  });

  it("I2: 원본(C:/WriteLoop-asset)이 이 컴퓨터에 있으면 앱 자산과 바이트가 같다(없으면 건너뜀)", () => {
    const original = "C:/WriteLoop-asset/마을건물/가구점/내부/furniture-shop-interior.glb";
    if (existsSync(original)) expect(readFileSync(join(APP_MODELS, "furniture-shop-interior.glb")).equals(readFileSync(original))).toBe(true);
  });

  it("I3: 좌표 오프셋은 한 번만 더해진다: 슬롯 노드의 세계 자리 = 모델 좌표 + (9, 8), 높이 0.25", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.root.updateMatrixWorld(true);
    built.slotNodes.forEach((node, i) => {
      const p = worldPos(node);
      expect(p.x).toBeCloseTo(CENTERS[i][0], 2);
      expect(p.z).toBeCloseTo(CENTERS[i][1], 2);
      expect(p.y).toBeCloseTo(0.25, 3);
    });
    const slotCenters = shop.SHOP_SLOTS.map((s) => [s.center.x, s.center.z]);
    slotCenters.forEach(([x, z], i) => {
      expect(x).toBeCloseTo(CENTERS[i][0], 2);
      expect(z).toBeCloseTo(CENTERS[i][1], 2);
    });
  });

  it("I4: 버들은 CheckoutNPC 자리 (10.53, 14.56)에 선다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.root.updateMatrixWorld(true);
    const at = worldPos(built.shopkeeper);
    expect(at.x).toBeCloseTo(10.53, 2);
    expect(at.z).toBeCloseTo(14.56, 2);
  });

  it("I5: 앞쪽 창틀·유리·입구 틀은 숨기고 누르기 대상에서도 뺀다", () => {
    const built = buildShop(interior, keeper, products, kit());
    for (const name of shop.SHOP_HIDDEN_NODES) expect(built.root.getObjectByName(name)?.visible).toBe(false);
    expect(built.pickTargets.some((o) => shop.SHOP_HIDDEN_NODES.includes(o.name))).toBe(false);
  });

  it("I6: 누르기 대상: 진열대 받침 여섯은 각각 shopSlot1~6, 버들·계산대는 shopCounter, 문은 shopExit", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    const placeOf = (o: THREE.Object3D) => (o.userData as { shopPlace?: string | null }).shopPlace ?? null;
    for (let i = 1; i <= 6; i += 1) {
      const pedestal = built.pickTargets.find((o) => o.name === `Station_0${i}_Pedestal`);
      expect({ i, found: Boolean(pedestal) }).toEqual({ i, found: true });
      expect(placeOf(pedestal!)).toBe(`shopSlot${i}`);
      expect(placeOf(built.pickTargets.find((o) => o.name === `shop-display-${i}`)!)).toBe(`shopSlot${i}`);
    }
    expect(placeOf(built.pickTargets.find((o) => o.name.startsWith("Checkout"))!)).toBe("shopCounter");
    expect(placeOf(built.pickTargets.find((o) => o.name.startsWith("ShopDoor"))!)).toBe("shopExit");
  });
});

describe("[spec] 진열: 원본 배율 1.0, 자동 축소 없음(명세 3-1, 3-2)", () => {
  it("D1: 처음 진열 여섯이 슬롯마다 하나씩 붙고, 모두 배율 (1, 1, 1)이며 슬롯 노드의 자리·회전 그대로(자기 노드 안에서 항등)다", () => {
    const built = buildShop(interior, keeper, products, kit());
    expect(built.setStock(shop.shopDisplay())).toEqual([0, 1, 2, 3, 4, 5]);
    built.root.updateMatrixWorld(true);
    expect(built.slotProducts).toEqual(PRODUCTS.map((p) => p.id));
    built.slotItems.forEach((item, i) => {
      expect(item).not.toBeNull();
      expect(item!.parent).toBe(built.slotNodes[i]);
      expect(built.slotNodes[i].children.filter((c) => c.name.startsWith("shop-display-"))).toHaveLength(1);
      expect(item!.scale.toArray()).toEqual([1, 1, 1]);
      expect(item!.position.toArray()).toEqual([0, 0, 0]);
      expect(item!.getWorldScale(new THREE.Vector3()).toArray().map((v) => Number(v.toFixed(6)))).toEqual([1, 1, 1]);
      // 슬롯 노드와 같은 세계 방향(Y축 회전 그대로)
      const q = item!.getWorldQuaternion(new THREE.Quaternion());
      const slotQ = built.slotNodes[i].getWorldQuaternion(new THREE.Quaternion());
      expect(Math.abs(q.dot(slotQ))).toBeCloseTo(1, 5);
    });
  });

  it("D2: 실제 상품 여섯은 크기 검사(가장 먼 바닥 모서리 1.79 안, 높이 2.55 안)를 원본 크기로 통과해 모두 붙는다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    built.root.updateMatrixWorld(true);
    built.slotItems.forEach((item, i) => {
      const box = new THREE.Box3().setFromObject(item!);
      const c = worldPos(built.slotNodes[i]);
      const radius = Math.max(...[box.min.x, box.max.x].flatMap((x) => [box.min.z, box.max.z].map((z) => Math.hypot(x - c.x, z - c.z))));
      expect(radius).toBeLessThanOrEqual(1.79 + 1e-3);
      expect(box.max.y - box.min.y).toBeLessThanOrEqual(2.55 + 1e-3);
    });
  });

  it("D3: 같은 상품을 여러 진열대에 놓아도 되고 인스턴스는 서로 다르다", () => {
    const built = buildShop(interior, keeper, products, kit());
    shop.setShopDisplay(0, "cloudDesk");
    shop.setShopDisplay(3, "cloudDesk");
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts[0]).toBe("cloudDesk");
    expect(built.slotProducts[3]).toBe("cloudDesk");
    expect(built.slotProducts[5]).toBe("cloudDesk");
    expect(new Set([built.slotItems[0], built.slotItems[3], built.slotItems[5]]).size).toBe(3);
  });

  it("D4: 원본(템플릿)은 건드리지 않는다: 다시 지어도(재입장) 슬롯마다 상품 1개, 버들 1명이고 원본 실내에는 아무것도 붙지 않는다", () => {
    const k = kit();
    const before = (() => {
      let n = 0;
      interior.scene.traverse(() => (n += 1));
      return n;
    })();
    const first = buildShop(interior, keeper, products, k);
    first.setStock(shop.shopDisplay());
    first.dispose();
    const second = buildShop(interior, keeper, products, k);
    second.setStock(shop.shopDisplay());
    let displays = 0;
    let keepers = 0;
    second.root.traverse((o) => {
      if (o.name.startsWith("shop-display-")) displays += 1;
      if (o.name === "shopkeeper") keepers += 1;
    });
    expect(displays).toBe(6);
    expect(keepers).toBe(1);
    let after = 0;
    interior.scene.traverse(() => (after += 1));
    expect(after).toBe(before);
  });
});

describe("[spec] 크기 검사와 교체(명세 3-3, 3-4)", () => {
  it("R1: 새 상품을 받는 동안·읽는 동안(아직 모델이 없음)에는 이전 상품이 그대로 보인다(슬롯이 비지 않는다)", () => {
    const withoutCloud = products.map((p, i) => (i === 5 ? undefined : p)) as unknown as GLTF[];
    const built = buildShop(interior, keeper, withoutCloud, kit());
    built.setStock(shop.shopDisplay());
    const old = built.slotItems[0];
    expect(old).not.toBeNull();
    shop.setShopDisplay(0, "cloudDesk");
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[0]).toBe(old);
    expect(old!.parent).toBe(built.slotNodes[0]);
    expect(built.slotProducts[0]).toBe("rainbootPlanter");
  });

  it("R2: 새 상품 모델이 들어와 크기 검사를 통과하면 그 슬롯의 이전 상품을 떼고 새 상품을 붙인다. 다른 슬롯은 그대로다", () => {
    const withoutCloud = products.map((p, i) => (i === 5 ? undefined : p)) as unknown as GLTF[];
    const built = buildShop(interior, keeper, withoutCloud, kit());
    built.setStock(shop.shopDisplay());
    const before = [...built.slotItems];
    shop.setShopDisplay(0, "cloudDesk");
    built.addProduct("cloudDesk", products[5]);
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts[0]).toBe("cloudDesk");
    expect(built.slotItems[0]).not.toBe(before[0]);
    expect(built.slotItems[0]!.parent).toBe(built.slotNodes[0]);
    expect(before[0]!.parent).toBeNull();
    for (const i of [1, 2, 3, 4]) expect(built.slotItems[i]).toBe(before[i]);
    expect(built.slotNodes[0].children.filter((c) => c.name.startsWith("shop-display-"))).toHaveLength(1);
    expect(built.slotItems[0]!.scale.toArray()).toEqual([1, 1, 1]);
  });

  it("R3: 크기 검사 경계: 가장 먼 바닥 모서리 1.79 안·높이 2.55 안이면 통과(배율 1), 넘으면 거절한다(바닥 반지름 / 높이)", () => {
    const cases: [string, GLTF, boolean][] = [
      ["반지름 1.70, 높이 2.50", boxProduct(2.4, 2.4, 2.5), true],
      ["반지름 1.84(바닥 넘침)", boxProduct(2.6, 2.6, 1), false],
      ["높이 2.60(높이 넘침)", boxProduct(1, 1, 2.6), false]
    ];
    for (const [label, gltf, ok] of cases) {
      const built = buildShop(interior, keeper, products, kit());
      built.setStock(shop.shopDisplay());
      const old = built.slotItems[0];
      shop.setShopDisplay(0, "cloudDesk");
      built.addProduct("cloudDesk", gltf);
      built.setStock(shop.shopDisplay());
      if (ok) {
        expect({ label, replaced: built.slotItems[0] !== old, scale: built.slotItems[0]!.scale.toArray() }).toEqual({ label, replaced: true, scale: [1, 1, 1] });
      } else {
        expect({ label, kept: built.slotItems[0] === old, parent: old!.parent === built.slotNodes[0] }).toEqual({ label, kept: true, parent: true });
        expect(built.slotProducts[0]).toBe("rainbootPlanter");
      }
      shop.resetShopDisplay();
    }
  });

  it("R4: 크기 검사에 걸린 상품은 줄여서라도 붙이지 않는다(자동 축소 없음)", () => {
    const huge = products.map((p, i) => (i === 5 ? boxProduct(6, 6, 6) : p));
    const built = buildShop(interior, keeper, huge, kit());
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[5]).toBeNull();
    built.root.traverse((o) => {
      if (o.name.startsWith("shop-display-")) expect(o.scale.toArray()).toEqual([1, 1, 1]);
    });
  });
});

describe("[spec] 명패(명세 4)", () => {
  it("N1: 매장을 지은 직후 명패 받침 여섯은 모두 숨겨져 있다", () => {
    const built = buildShop(interior, keeper, products, kit());
    for (let i = 0; i < 6; i += 1) expect({ i, shown: shown(holderOf(built, i)) }).toEqual({ i, shown: false });
  });

  it("N2: 새겨진 글자와 이름이 같은 슬롯(02 고양이 편지 책상·06 구름 책상)은 그림 없이도 새겨진 글자를 보이고 받침을 보인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    for (const i of GLYPH_SLOTS) {
      expect({ i, holder: shown(holderOf(built, i)), glyph: shown(glyphOf(built, i)), image: anyImageShown(built, i) }).toEqual({ i, holder: true, glyph: true, image: false });
    }
  });

  it("N3: 이름이 다른 슬롯(01 장화 화분·03 별지기 침대·04 호두 침대·05 이부자리)은 명패 그림이 아직 없으면 상품은 붙이되 받침을 숨겨 둔다", () => {
    const built = buildShop(interior, keeper, products, kit());
    built.setStock(shop.shopDisplay());
    for (const i of IMAGE_SLOTS) {
      expect({ i, item: built.slotItems[i] !== null, holder: shown(holderOf(built, i)) }).toEqual({ i, item: true, holder: false });
    }
  });

  it("N4: 명패 그림이 들어오면 새겨진 글자를 숨기고 그 상품의 그림을 같은 받침에 붙여 보이고 받침을 보인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const tex = textures();
    built.setStock(shop.shopDisplay());
    for (const i of IMAGE_SLOTS) addNameplate(built, PRODUCTS[i].id, tex[PRODUCTS[i].id]);
    built.setStock(shop.shopDisplay());
    for (const i of IMAGE_SLOTS) {
      const mesh = imageMeshOf(built, i, tex[PRODUCTS[i].id]);
      expect({ i, holder: shown(holderOf(built, i)), glyph: shown(glyphOf(built, i)), image: mesh !== null && shown(mesh) }).toEqual({ i, holder: true, glyph: false, image: true });
    }
    // 02·06은 새겨진 글자 그대로
    for (const i of GLYPH_SLOTS) expect({ i, glyph: shown(glyphOf(built, i)), image: anyImageShown(built, i) }).toEqual({ i, glyph: true, image: false });
  });

  it("N5: 이름 비교는 그 슬롯에 새겨진 글자와 한다: 구름 책상을 01에 놓으면 새겨진 글자(달토끼 화분)를 숨기고 그림을 쓰며, 고양이 편지 책상을 06에 놓아도 그림을 쓴다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const tex = textures();
    for (const p of PRODUCTS) addNameplate(built, p.id, tex[p.id]);
    shop.setShopDisplay(0, "cloudDesk");
    shop.setShopDisplay(5, "catPostDesk" as never);
    built.setStock(shop.shopDisplay());
    expect({ glyph: shown(glyphOf(built, 0)), image: shown(imageMeshOf(built, 0, tex.cloudDesk)) }).toEqual({ glyph: false, image: true });
    expect({ glyph: shown(glyphOf(built, 5)), image: shown(imageMeshOf(built, 5, tex.catPostDesk)) }).toEqual({ glyph: false, image: true });
  });

  it("N6: 02에 다시 고양이 편지 책상을 놓으면 새겨진 글자로 돌아가고 그림은 보이지 않는다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const tex = textures();
    for (const p of PRODUCTS) addNameplate(built, p.id, tex[p.id]);
    shop.setShopDisplay(1, "cloudDesk");
    built.setStock(shop.shopDisplay());
    expect(shown(glyphOf(built, 1))).toBe(false);
    shop.setShopDisplay(1, "catPostDesk" as never);
    built.setStock(shop.shopDisplay());
    expect({ holder: shown(holderOf(built, 1)), glyph: shown(glyphOf(built, 1)), image: anyImageShown(built, 1) }).toEqual({ holder: true, glyph: true, image: false });
  });

  it("N7: 교체하면 명패도 같은 때 새 상품 것으로 바뀐다(이전 그림은 보이지 않고 새 그림이 보인다)", () => {
    const built = buildShop(interior, keeper, products, kit());
    const tex = textures();
    for (const p of PRODUCTS) addNameplate(built, p.id, tex[p.id]);
    built.setStock(shop.shopDisplay());
    expect(shown(imageMeshOf(built, 3, tex.walnutBed))).toBe(true);
    shop.setShopDisplay(3, "stargazerBed" as never);
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts[3]).toBe("stargazerBed");
    const old = imageMeshOf(built, 3, tex.walnutBed);
    expect(old === null || !shown(old)).toBe(true);
    expect({ holder: shown(holderOf(built, 3)), image: shown(imageMeshOf(built, 3, tex.stargazerBed)), glyph: shown(glyphOf(built, 3)) }).toEqual({ holder: true, image: true, glyph: false });
  });

  it("N8: 새 상품의 명패 그림이 없는 채 교체되면 상품은 바뀌고 받침은 숨겨지며, 그림이 들어오면 보인다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const tex = textures();
    for (const p of PRODUCTS) if (p.id !== "stargazerBed") addNameplate(built, p.id, tex[p.id]);
    built.setStock(shop.shopDisplay());
    shop.setShopDisplay(3, "stargazerBed" as never);
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts[3]).toBe("stargazerBed");
    expect(shown(holderOf(built, 3))).toBe(false);
    addNameplate(built, "stargazerBed", tex.stargazerBed);
    built.setStock(shop.shopDisplay());
    expect({ holder: shown(holderOf(built, 3)), image: shown(imageMeshOf(built, 3, tex.stargazerBed)) }).toEqual({ holder: true, image: true });
  });

  it("N9: 빈 슬롯(상품을 한 번도 붙이지 못함)은 받침만 보이고 명패를 숨긴다. 새겨진 글자와 이름이 같은 06도 마찬가지다. 상품이 붙으면 명패도 함께 나타난다", () => {
    const withoutCloud = products.map((p, i) => (i === 5 ? undefined : p)) as unknown as GLTF[];
    const built = buildShop(interior, keeper, withoutCloud, kit());
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[5]).toBeNull();
    expect(shown(holderOf(built, 5))).toBe(false);
    built.addProduct("cloudDesk", products[5]);
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[5]).not.toBeNull();
    expect({ holder: shown(holderOf(built, 5)), glyph: shown(glyphOf(built, 5)) }).toEqual({ holder: true, glyph: true });
  });

  it("N10: 교체에 실패하면(크기 검사 실패) 그 슬롯의 이전 상품과 명패를 함께 유지한다. 새 상품의 명패 그림이 있어도 바뀌지 않는다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const tex = textures();
    for (const p of PRODUCTS) addNameplate(built, p.id, tex[p.id]);
    built.setStock(shop.shopDisplay());
    const old = built.slotItems[0];
    shop.setShopDisplay(0, "cloudDesk");
    built.addProduct("cloudDesk", boxProduct(8, 8, 1));
    built.setStock(shop.shopDisplay());
    expect(built.slotItems[0]).toBe(old);
    expect(built.slotProducts[0]).toBe("rainbootPlanter");
    expect({ holder: shown(holderOf(built, 0)), glyph: shown(glyphOf(built, 0)), image: shown(imageMeshOf(built, 0, tex.rainbootPlanter)) }).toEqual({ holder: true, glyph: false, image: true });
    expect(imageMeshOf(built, 0, tex.cloudDesk) === null || !shown(imageMeshOf(built, 0, tex.cloudDesk))).toBe(true);
  });

  it("N11: 교체를 기다리는 동안(새 상품 모델이 아직 없음)에도 이전 명패가 그대로 보인다", () => {
    const withoutCloud = products.map((p, i) => (i === 5 ? undefined : p)) as unknown as GLTF[];
    const built = buildShop(interior, keeper, withoutCloud, kit());
    const tex = textures();
    for (const p of PRODUCTS) addNameplate(built, p.id, tex[p.id]);
    built.setStock(shop.shopDisplay());
    shop.setShopDisplay(2, "cloudDesk");
    built.setStock(shop.shopDisplay());
    expect(built.slotProducts[2]).toBe("stargazerBed");
    expect({ holder: shown(holderOf(built, 2)), image: shown(imageMeshOf(built, 2, tex.stargazerBed)) }).toEqual({ holder: true, image: true });
  });

  it("N12: 다시 지으면(재입장) 받침은 모두 숨겨진 채 시작하고 진열을 붙이면 다시 맞게 보이며, 원본 실내의 명패는 건드리지 않는다", () => {
    const k = kit();
    const tex = textures();
    const before = holderOf({ root: interior.scene } as unknown as Built, 0).visible;
    const first = buildShop(interior, keeper, products, k);
    for (const p of PRODUCTS) addNameplate(first, p.id, tex[p.id]);
    first.setStock(shop.shopDisplay());
    first.dispose();
    expect(holderOf({ root: interior.scene } as unknown as Built, 0).visible).toBe(before);
    const second = buildShop(interior, keeper, products, k);
    for (let i = 0; i < 6; i += 1) expect({ i, shown: shown(holderOf(second, i)) }).toEqual({ i, shown: false });
    second.setStock(shop.shopDisplay());
    for (const i of GLYPH_SLOTS) expect(shown(holderOf(second, i))).toBe(true);
  });

  it("N13: 명패를 누르면 그 진열대로 간다: 받침(진열대 받침의 자식)과 명패 그림 면의 누르기 장소가 그 진열대이고 누를 수 있다", () => {
    const built = buildShop(interior, keeper, products, kit());
    const tex = textures();
    for (const p of PRODUCTS) addNameplate(built, p.id, tex[p.id]);
    built.setStock(shop.shopDisplay());
    built.root.updateMatrixWorld(true);
    const placeOf = (o: THREE.Object3D) => (o.userData as { shopPlace?: string | null }).shopPlace ?? null;
    for (let i = 0; i < 6; i += 1) {
      const holder = holderOf(built, i);
      expect({ i, place: placeOf(holder) }).toEqual({ i, place: `shopSlot${i + 1}` });
      // 받침이 진열대 받침 아래에 있어 누르기 대상(pickTargets)에 들어 있다
      const pedestal = built.pickTargets.find((o) => o.name === `Station_0${i + 1}_Pedestal`)!;
      expect(Boolean(pedestal.getObjectById(holder.id))).toBe(true);
    }
    for (const i of IMAGE_SLOTS) {
      const mesh = imageMeshOf(built, i, tex[PRODUCTS[i].id])!;
      expect({ i, place: placeOf(mesh) }).toEqual({ i, place: `shopSlot${i + 1}` });
      // 그림 면 위에서 아래로 쏜 광선이 닿는다(두 방향 중 한쪽)
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
      const rays = [normal, normal.clone().negate(), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)];
      const hit = rays.some((dir) => new THREE.Raycaster(center.clone().addScaledVector(dir, 0.5), dir.clone().negate()).intersectObject(mesh, false).length > 0);
      expect({ i, hit }).toEqual({ i, hit: true });
    }
  });
});
