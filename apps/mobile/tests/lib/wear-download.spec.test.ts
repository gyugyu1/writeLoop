// [spec] qa 테스트(작업 090-③ 옷 내려받기, 새 기능, 모바일): 앱에서 빠지는 옷 파일(A), 받은·저장한 목록의 draw로만 그릴 수 있는 옷인지(B, 05 결정의 Q1~Q3·Q5),
// 옷 칸 그림 받기(E, 모듈 단위), 시험판의 옷 순서(V1, 모듈 단위), 실제 서버 목록 파일·모델·그림을 앱이 읽을 때(Z).
// 기대값은 시나리오(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/05-옷-내려받기/04-qa-scenarios.md)와 같은 폴더 05-main-decision.md에서만 가져온다.
// 테스트 이름 앞의 번호가 시나리오 번호다(05 결정에서 온 것은 "05 결정 Qn"을 적었다).
// 구현 커밋 2c23e2c에서 읽은 것은 부르는 방법뿐이다: 목록 두기 setItemCatalog(parseItemCatalog(응답)), 그리기 정보 wearDraw(종류)(그릴 수 없으면 null),
// 홈쇼핑에 보일 옷 isShopWearable(종류), 옷장 칸 closetItems(옷장, 부위), 칸 그림 wearableIcon(종류), 시험판 차례 itemsInSlot(부위),
// 기기 파일은 item-files(가짜 expo-file-system으로 본다).
// "Z"는 백엔드 목록 파일(apps/backend/src/main/resources/catalog/items.json)과 files/를 서버 응답 모양(assets: /api/catalog/files/<sha256>.<확장자>)으로
// 바꿔 앱에 넣는다. 기준 커밋 be00aac의 앱 착용 모델 묶음·옷 그림과 견준다(git show).
import { execFileSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { CLOSET_SLOTS, closetItems } from "@/lib/lobby3d/closet";
import { DEFAULT_LOOK, WEARABLE_ITEMS, itemsInSlot, wearDraw } from "@/lib/lobby3d/wear";
import { wearableIcon } from "@/lib/lobby3d/wearable-icons";
import { isShopWearable } from "@/components/home/home-shopping-catalog";
import type { Wardrobe, WardrobeSlot } from "@/lib/types";
import {
  MOBILE_DIR,
  REPO_DIR,
  SERVER_FILES_DIR,
  catW,
  device,
  downloadedPaths,
  failDownload,
  hold,
  pathOf,
  rawServerItems,
  release,
  resetDevice,
  serverRef,
  serverWearCatalog
} from "../__fixtures__/wear-files-090";

jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());

const BASE_COMMIT = "be00aac";
const SIXTEEN = [
  "capOrange", "capBlue", "capGreen", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shortsNavy", "shortsBrown",
  "shortsRed", "shoesBrown", "shoesRed", "shoesWhite", "sunglassesBlack", "backpackRed", "mufflerRed", "necklaceGold"
];
const SLOTS: WardrobeSlot[] = CLOSET_SLOTS.map((entry) => entry.slot);

let round = 0;
/** 테스트마다 새 해시의 CAT-W를 둔다. */
function useCatW(version?: string) {
  round += 1;
  const cat = catW(`lib-${round}`, version);
  setItemCatalog(parseItemCatalog(cat.catalog)!);
  return cat;
}

/** 목록이 없는 상태(앱을 켜고 아직 한 번도 받지 못함)를 흉내 낸다: 모듈을 새로 불러온다. */
function freshModules() {
  let mods!: {
    wear: typeof import("@/lib/lobby3d/wear");
    closet: typeof import("@/lib/lobby3d/closet");
    shop: typeof import("@/components/home/home-shopping-catalog");
    icons: typeof import("@/lib/lobby3d/wearable-icons");
    store: typeof import("@/lib/item-catalog-store");
  };
  jest.isolateModules(() => {
    mods = {
      wear: require("@/lib/lobby3d/wear"),
      closet: require("@/lib/lobby3d/closet"),
      shop: require("@/components/home/home-shopping-catalog"),
      icons: require("@/lib/lobby3d/wearable-icons"),
      store: require("@/lib/item-catalog-store")
    };
  });
  return mods;
}

/** 가진 것만 든 옷장 응답. */
function owned(...types: [string, WardrobeSlot][]): Pick<Wardrobe, "items"> {
  return { items: types.map(([type, slot], i) => ({ type, slot, acquiredAt: `2026-11-14T0${i}:00:00Z` })) } as Pick<Wardrobe, "items">;
}

async function flush() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

beforeEach(() => {
  resetDevice();
});

// ---------- A. 앱에서 빠지는 옷 파일 ----------

/** src의 ts·tsx가 require하는 assets 아래 파일(assets 기준 경로). */
function requiredAssets(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) {
        for (const match of readFileSync(full, "utf8").matchAll(/require\(\s*["']([^"']+\.(?:glb|png))["']\s*\)/g)) {
          found.add(relative(join(MOBILE_DIR, "assets"), join(dir, match[1])).split("\\").join("/"));
        }
      }
    }
  };
  walk(join(MOBILE_DIR, "src"));
  return found;
}

describe("[spec] 090-③ A: 앱에서 빠지는 옷 파일", () => {
  test("A1(부르기) 앱 코드(src)의 어떤 ts·tsx도 착용 모델 묶음 lobby-wearables.glb를 require하지 않는다", () => {
    expect(requiredAssets().has("models/lobby-wearables.glb")).toBe(false);
  });

  test("A1(파일) apps/mobile/assets/models/lobby-wearables.glb가 없다", () => {
    expect(existsSync(join(MOBILE_DIR, "assets", "models", "lobby-wearables.glb"))).toBe(false);
  });

  test("A2 assets/icons/wearables에는 goggles.png 하나뿐이고, wardrobe-slots는 일곱 png 그대로이며, src가 require하는 icons/wearables/ 파일은 goggles.png뿐이다", () => {
    expect(readdirSync(join(MOBILE_DIR, "assets", "icons", "wearables")).sort()).toEqual(["goggles.png"]);
    expect(readdirSync(join(MOBILE_DIR, "assets", "icons", "wardrobe-slots")).sort()).toEqual(
      ["accessory.png", "back.png", "bottom.png", "face.png", "hat.png", "shoes.png", "top.png"]
    );
    expect([...requiredAssets()].filter((file) => file.startsWith("icons/wearables/")).sort()).toEqual(["icons/wearables/goggles.png"]);
  });
});

// ---------- B. 그릴 수 있는 옷인지 ----------

describe("[spec] 090-③ B: 받은·저장한 목록의 draw로만 그릴 수 있는 옷", () => {
  test("B1(모듈) 목록이 없으면 옷 열여섯 모두 그릴 줄 모르는 옷이다: 홈쇼핑에 보일 옷이 아니고 옷장 칸도 없으며(고글만 칸이 남는다), 그리기 정보가 없다", () => {
    const mods = freshModules();
    expect(mods.store.currentItemCatalog()).toBeNull();
    for (const type of SIXTEEN) {
      expect({ type, shop: mods.shop.isShopWearable(type), draw: mods.wear.wearDraw(type) }).toEqual({ type, shop: false, draw: null });
    }
    const wardrobe = owned(...SIXTEEN.map((type): [string, WardrobeSlot] => [type, WEARABLE_ITEMS[type].slot]), ["goggles", "face"]);
    const cells = Object.fromEntries(SLOTS.map((slot) => [slot, mods.closet.closetItems(wardrobe, slot).map((item) => item.type)]));
    expect(cells).toEqual({ hat: [], top: [], bottom: [], shoes: [], face: ["goggles"], back: [], accessory: [] });
  });

  test("B2 draw가 없는 옷(noDrawQa)은 그릴 줄 모르는 옷이다: 홈쇼핑에 보이지 않고 옷장 모자 칸이 없으며 그리기 정보가 없다", () => {
    useCatW();
    expect(isShopWearable("noDrawQa")).toBe(false);
    expect(wearDraw("noDrawQa")).toBeNull();
    expect(closetItems(owned(["noDrawQa", "hat"]), "hat")).toEqual([]);
  });

  test("B3 앱이 모르는 방식(clothQa, attach 'cloth')은 그릴 줄 모르는 옷이다(등장식 칸 없음)", () => {
    useCatW();
    expect(isShopWearable("clothQa")).toBe(false);
    expect(wearDraw("clothQa")).toBeNull();
    expect(closetItems(owned(["clothQa", "back"]), "back")).toEqual([]);
  });

  test("B4 몸 판이 2인 옷(hatBody2Qa)은 그릴 줄 모르는 옷이고, 같은 목록의 몸 판 1 옷(capOrange)은 홈쇼핑에 보이고 옷장 칸이 있다", () => {
    useCatW();
    expect(isShopWearable("hatBody2Qa")).toBe(false);
    expect(wearDraw("hatBody2Qa")).toBeNull();
    expect(isShopWearable("capOrange")).toBe(true);
    expect(closetItems(owned(["capOrange", "hat"], ["hatBody2Qa", "hat"]), "hat").map((item) => item.type)).toEqual(["capOrange"]);
  });

  test("B5 CAT-W를 받으면 열둘은 그릴 수 있는 옷이고 hatBody2Qa·clothQa·noDrawQa는 그릴 줄 모르는 옷이다", () => {
    useCatW();
    const drawable = ["capOrange", "capBlue", "tshirtOrange", "tshirtWhite", "shortsRed", "shoesBrown", "sunglassesBlack", "mufflerRed", "tshirtGreenQa", "bowtieQa", "vestQa", "plainQa"];
    for (const type of drawable) expect({ type, shop: isShopWearable(type), draw: wearDraw(type) !== null }).toEqual({ type, shop: true, draw: true });
    for (const type of ["hatBody2Qa", "clothQa", "noDrawQa"]) expect({ type, shop: isShopWearable(type), draw: wearDraw(type) }).toEqual({ type, shop: false, draw: null });
  });

  test("B7(모듈) 서버가 더한 새 색(tshirtGreenQa)·뼈 장식(bowtieQa)·휘는 새 모양(vestQa)은 그 부위의 옷장 칸에 목록 이름으로 나온다", () => {
    useCatW();
    const wardrobe = owned(["tshirtGreenQa", "top"], ["vestQa", "top"], ["bowtieQa", "accessory"]);
    expect(closetItems(wardrobe, "top")).toEqual([
      { type: "tshirtGreenQa", label: "QA 초록 티" },
      { type: "vestQa", label: "QA 조끼" }
    ]);
    expect(closetItems(wardrobe, "accessory")).toEqual([{ type: "bowtieQa", label: "QA 나비넥타이" }]);
  });

  test("B8(모듈) 라룹이 고글은 목록이 없어도, CAT-W(draw·파일 없음)여도 옷장 얼굴장식 칸이 있고 그림은 앱의 goggles.png이며 받기 요청이 없다", async () => {
    const appGoggles = require("../../assets/icons/wearables/goggles.png");
    const mods = freshModules();
    expect(mods.closet.closetItems(owned(["goggles", "face"]), "face")).toEqual([{ type: "goggles", label: "라룹이 고글" }]);
    expect(mods.icons.wearableIcon("goggles")).toEqual(appGoggles);
    useCatW();
    expect(closetItems(owned(["goggles", "face"]), "face")).toEqual([{ type: "goggles", label: "라룹이 고글" }]);
    expect(wearableIcon("goggles")).toEqual(appGoggles);
    await flush();
    expect(device.downloads).toEqual([]);
  });

  test("05 결정 Q1 draw는 맞는데 assets.model이 없는 옷은 그릴 줄 모르는 옷이다(홈쇼핑에 보이지 않음)", () => {
    const cat = catW(`lib-q1-${round}`);
    cat.catalog.items.push({ id: "noModelQa", kind: "wearable", name: "QA 모델 없는 모자", shopName: "QA 모델 없는 모자", description: "", category: "clothes", slot: "hat", price: 60, draw: { attach: "bone", bone: "head", body: 1 }, assets: null });
    setItemCatalog(parseItemCatalog(cat.catalog)!);
    expect(isShopWearable("noModelQa")).toBe(false);
    expect(wearDraw("noModelQa")).toBeNull();
    expect(closetItems(owned(["noModelQa", "hat"]), "hat")).toEqual([]);
  });

  test("05 결정 Q2 bone 방식인데 붙일 뼈가 없는 옷은 그릴 줄 모르는 옷이고, 뼈 이름이 라룹이에 없는 이름이어도 목록으로는 그릴 수 있는 옷이다", () => {
    const cat = catW(`lib-q2-${round}`);
    const assets = (cat.catalog.items[0] as { assets: unknown }).assets;
    cat.catalog.items.push(
      { id: "noBoneQa", kind: "wearable", name: "QA 뼈 없는 모자", shopName: "QA 뼈 없는 모자", description: "", category: "clothes", slot: "hat", price: 60, draw: { attach: "bone", body: 1 }, assets },
      { id: "oddBoneQa", kind: "wearable", name: "QA 낯선 뼈 모자", shopName: "QA 낯선 뼈 모자", description: "", category: "clothes", slot: "hat", price: 60, draw: { attach: "bone", bone: "antenna", body: 1 }, assets }
    );
    setItemCatalog(parseItemCatalog(cat.catalog)!);
    expect(isShopWearable("noBoneQa")).toBe(false);
    expect(wearDraw("noBoneQa")).toBeNull();
    expect(isShopWearable("oddBoneQa")).toBe(true);
  });

  test("05 결정 Q3 draw에 몸 판이 빠진 옷은 그릴 줄 모르는 옷이다", () => {
    const cat = catW(`lib-q3-${round}`);
    const assets = (cat.catalog.items[0] as { assets: unknown }).assets;
    cat.catalog.items.push({ id: "noBodyQa", kind: "wearable", name: "QA 판 없는 모자", shopName: "QA 판 없는 모자", description: "", category: "clothes", slot: "hat", price: 60, draw: { attach: "bone", bone: "head" }, assets });
    setItemCatalog(parseItemCatalog(cat.catalog)!);
    expect(isShopWearable("noBodyQa")).toBe(false);
    expect(wearDraw("noBodyQa")).toBeNull();
  });
});

// ---------- E. 칸 그림 받기(모듈 단위) ----------

describe("[spec] 090-③ E(모듈): 옷 칸 그림은 목록의 그림 파일을 받아 기기에 둔다", () => {
  test("E1(모듈) 기기에 없는 capOrange 그림은 처음 부를 때 목록 url로 한 번 요청하고 그동안 그림이 없으며(첫 글자 칸), 받으면 기기 파일 그림이다", async () => {
    const cat = useCatW();
    hold(cat.icon.capOrange);
    expect(wearableIcon("capOrange")).toBeNull();
    expect(wearableIcon("capOrange")).toBeNull();
    await flush();
    expect(downloadedPaths()).toEqual([pathOf(cat.icon.capOrange.url)]);
    release(cat.icon.capOrange);
    await flush();
    expect(wearableIcon("capOrange")).toEqual({ uri: `file:///qa-document/item-files/${cat.icon.capOrange.sha256}.png` });
    expect(downloadedPaths()).toEqual([pathOf(cat.icon.capOrange.url)]);
  });

  test("E2(모듈) 그림 받기에 실패하면 그림이 없고(첫 글자 칸), 같은 실행에서 다시 불러도 다시 요청하지 않는다", async () => {
    const cat = useCatW();
    failDownload(cat.icon.capOrange);
    expect(wearableIcon("capOrange")).toBeNull();
    await flush();
    expect(wearableIcon("capOrange")).toBeNull();
    await flush();
    expect(downloadedPaths()).toEqual([pathOf(cat.icon.capOrange.url)]);
  });

  test("E4(모듈) icon이 null인 옷(plainQa)은 그림이 없고 요청이 0건이다", async () => {
    useCatW();
    expect(wearableIcon("plainQa")).toBeNull();
    await flush();
    expect(device.downloads).toEqual([]);
  });
});

// ---------- V. 시험판 차례(모듈 단위) ----------

describe("[spec] 090-③ V(모듈): 시험판 옷 고르기는 받은 목록의 옷으로", () => {
  test("V1(모듈) CAT-W에서 모자 차례는 capOrange·capBlue(그릴 줄 모르는 hatBody2Qa·noDrawQa 없음), 상의 차례는 tshirtOrange·tshirtWhite·tshirtGreenQa·vestQa다", () => {
    useCatW();
    expect(itemsInSlot("hat")).toEqual(["capOrange", "capBlue"]);
    expect(itemsInSlot("top")).toEqual(["tshirtOrange", "tshirtWhite", "tshirtGreenQa", "vestQa"]);
  });

  test("V2 시험판의 처음 모습은 얼굴장식 goggles 하나다", () => {
    expect(DEFAULT_LOOK).toEqual({ hat: null, top: null, bottom: null, shoes: null, face: "goggles", back: null, accessory: null });
  });

  test("05 결정 Q5 목록이 없으면 시험판 차례는 앱 이름표 순서다(모자: capOrange·capBlue·capGreen, 얼굴장식: goggles·sunglassesBlack)", () => {
    const mods = freshModules();
    expect(mods.wear.itemsInSlot("hat")).toEqual(["capOrange", "capBlue", "capGreen"]);
    expect(mods.wear.itemsInSlot("face")).toEqual(["goggles", "sunglassesBlack"]);
  });
});

// ---------- Z. 실제 목록 파일·서버 파일 ----------

type GltfNode = { name?: string; mesh?: number; skin?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] };
type Gltf = {
  nodes: GltfNode[];
  scenes: { nodes: number[] }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  skins?: { joints: number[]; inverseBindMatrices?: number }[];
  accessors: { bufferView?: number; byteOffset?: number; count: number; componentType: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
};
type Glb = { json: Gltf; bin: Buffer };

function parseGlb(buf: Buffer): Glb {
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength + 8;
  return { json, bin: buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLength)) };
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function floats(glb: Glb, accessorIndex: number): number[] {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView ?? 0];
  const size = COMPONENTS[accessor.type];
  const stride = view.byteStride ?? size * 4;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out: number[] = [];
  for (let i = 0; i < accessor.count; i += 1) for (let k = 0; k < size; k += 1) out.push(glb.bin.readFloatLE(start + i * stride + k * 4));
  return out;
}

type Mat = number[];
const IDENTITY: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a: Mat, b: Mat): Mat {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) for (let k = 0; k < 4; k += 1) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
function localMatrix(node: GltfNode): Mat {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1
  ];
}
/** 노드마다 장면 기준 행렬. */
function worldMatrices(glb: Glb): Map<number, Mat> {
  const world = new Map<number, Mat>();
  const visit = (index: number, parent: Mat) => {
    const m = multiply(parent, localMatrix(glb.json.nodes[index]));
    world.set(index, m);
    for (const child of glb.json.nodes[index].children ?? []) visit(child, m);
  };
  for (const scene of glb.json.scenes) for (const root of scene.nodes) visit(root, IDENTITY);
  return world;
}
/** 그 이름 노드의 메시 점을 장면 기준 자리로(뼈대로 휘는 메시는 glTF 규칙대로 노드 변환을 쓰지 않는다). */
function scenePositions(glb: Glb, name: string): number[] {
  const index = glb.json.nodes.findIndex((n) => n.name === name);
  expect({ name, found: index >= 0 }).toEqual({ name, found: true });
  const node = glb.json.nodes[index];
  const m = node.skin !== undefined ? IDENTITY : worldMatrices(glb).get(index)!;
  const out: number[] = [];
  for (const primitive of glb.json.meshes[node.mesh!].primitives) {
    const p = floats(glb, primitive.attributes.POSITION);
    for (let i = 0; i < p.length; i += 3) {
      out.push(m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12], m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13], m[2] * p[i] + m[6] * p[i + 1] + m[10] * p[i + 2] + m[14]);
    }
  }
  return out;
}
function skinOf(glb: Glb, name: string): { joints: string[]; inverse: number[] } | null {
  const node = glb.json.nodes.find((n) => n.name === name);
  if (!node || node.skin === undefined) return null;
  const skin = glb.json.skins![node.skin];
  return { joints: skin.joints.map((j) => glb.json.nodes[j].name ?? ""), inverse: skin.inverseBindMatrices === undefined ? [] : floats(glb, skin.inverseBindMatrices) };
}
function expectClose(label: string, actual: number[], expected: number[]) {
  expect({ label, count: actual.length }).toEqual({ label, count: expected.length });
  const diff = actual.reduce((max, v, i) => Math.max(max, Math.abs(v - expected[i])), 0);
  expect({ label, close: diff < 1e-5 }).toEqual({ label, close: true });
}
const baseFile = (path: string) => execFileSync("git", ["show", `${BASE_COMMIT}:${path}`], { cwd: REPO_DIR, maxBuffer: 64 * 1024 * 1024 });
const serverModelFile = (id: string) => rawServerItems().find((item) => item.id === id)!.files!.model!;

/** writeloop.glb 뼈대(스킨 관절)의 뼈 이름. */
function characterBones(): Set<string> {
  const glb = parseGlb(readFileSync(join(MOBILE_DIR, "assets", "models", "writeloop.glb")));
  return new Set((glb.json.skins ?? []).flatMap((skin) => skin.joints.map((j) => glb.json.nodes[j].name ?? "")));
}

describe("[spec] 090-③ Z: 실제 서버 목록 파일·모델·그림을 앱이 읽을 때", () => {
  test("Z1 서버 목록 파일의 옷을 응답 모양으로 앱에 넣으면 열여섯 모두 그릴 수 있는 옷이고 몸 판이 1이다", () => {
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-z1"))!);
    for (const type of SIXTEEN) expect({ type, drawable: wearDraw(type) !== null, shop: isShopWearable(type) }).toEqual({ type, drawable: true, shop: true });
    const raw = rawServerItems();
    for (const type of SIXTEEN) expect({ type, body: raw.find((item) => item.id === type)!.draw!.body }).toEqual({ type, body: 1 });
  });

  test("Z2 열여섯의 방식·뼈·뒤집을 뼈·색이 지금 앱과 같고, 서로 다른 모델 해시는 열이다(모자 셋은 서로 다르고 티셔츠·반바지·신발 셋은 각각 하나)", () => {
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-z2"))!);
    const seen = Object.fromEntries(
      SIXTEEN.map((type) => {
        const d = wearDraw(type)!;
        return [type, { attach: d.attach, bone: d.bone, mirror: d.mirror, color: d.color }];
      })
    );
    const head = { attach: "bone", bone: "head", mirror: null, color: null };
    const spine = { attach: "bone", bone: "spine", mirror: null, color: null };
    const shoe = (color: string | null) => ({ attach: "bone", bone: "foot_l", mirror: "foot_r", color });
    const skin = (color: string | null) => ({ attach: "skin", bone: null, mirror: null, color });
    expect(seen).toEqual({
      capOrange: head,
      capBlue: head,
      capGreen: head,
      sunglassesBlack: head,
      backpackRed: spine,
      mufflerRed: spine,
      necklaceGold: spine,
      shoesBrown: shoe(null),
      shoesRed: shoe("#C8443A"),
      shoesWhite: shoe("#DCD8CF"),
      tshirtOrange: skin(null),
      tshirtWhite: skin("#F4F0E8"),
      tshirtYellow: skin("#F2C440"),
      shortsNavy: skin(null),
      shortsBrown: skin("#8A5A3B"),
      shortsRed: skin("#C8443A")
    });
    const sha = (type: string) => wearDraw(type)!.model.sha256;
    expect(new Set(SIXTEEN.map(sha)).size).toBe(10);
    expect(new Set(["capOrange", "capBlue", "capGreen"].map(sha)).size).toBe(3);
    for (const group of [["tshirtOrange", "tshirtWhite", "tshirtYellow"], ["shortsNavy", "shortsBrown", "shortsRed"], ["shoesBrown", "shoesRed", "shoesWhite"]]) {
      expect({ group, hashes: new Set(group.map(sha)).size }).toEqual({ group, hashes: 1 });
    }
  });

  test("Z3 서버 옷 모델 파일의 메시 점 자리가 기준 커밋 묶음의 같은 모델과 같고, 상의·하의의 skin 뼈 이름·묶음 역행렬이 묶음과 같으며 뼈 이름은 모두 라룹이 뼈대에 있다", () => {
    const bundle = parseGlb(baseFile("apps/mobile/assets/models/lobby-wearables.glb"));
    const bones = characterBones();
    const pairs: [string, string][] = [
      ["capOrange", "wear-hat"],
      ["capBlue", "wear-hat-blue"],
      ["capGreen", "wear-hat-green"],
      ["tshirtOrange", "wear-top"],
      ["shortsNavy", "wear-bottom"],
      ["shoesBrown", "wear-shoe-l"],
      ["sunglassesBlack", "wear-sunglasses"],
      ["backpackRed", "wear-backpack"],
      ["mufflerRed", "wear-muffler"],
      ["necklaceGold", "wear-necklace"]
    ];
    for (const [type, node] of pairs) {
      const server = parseGlb(readFileSync(join(SERVER_FILES_DIR, serverModelFile(type))));
      const serverNode = server.json.nodes.find((n) => n.mesh !== undefined)!;
      expectClose(`${type} 점 자리`, scenePositions(server, serverNode.name!), scenePositions(bundle, node));
      const before = skinOf(bundle, node);
      const now = server.json.nodes.filter((n) => n.skin !== undefined).map((n) => skinOf(server, n.name!)!);
      if (!before) {
        expect({ type, skins: now.length }).toEqual({ type, skins: 0 });
        continue;
      }
      expect({ type, skins: now.length }).toEqual({ type, skins: 1 });
      expect({ type, joints: now[0].joints }).toEqual({ type, joints: before.joints });
      expectClose(`${type} 묶음 역행렬`, now[0].inverse, before.inverse);
      expect({ type, missing: now[0].joints.filter((name) => !bones.has(name)) }).toEqual({ type, missing: [] });
    }
  });

  test("Z4 서버 옷 그림 열여섯은 기준 커밋 앱 그림과 바이트가 같다", () => {
    for (const type of SIXTEEN) {
      const iconFile = rawServerItems().find((item) => item.id === type)!.files!.icon!;
      const now = readFileSync(join(SERVER_FILES_DIR, iconFile));
      expect({ type, same: now.equals(baseFile(`apps/mobile/assets/icons/wearables/${type}.png`)) }).toEqual({ type, same: true });
    }
  });

  test("Z5 조끼는 목록에 옷·상의·price null·draw skin 몸 판 1로 있고, 모델의 skin 뼈 이름이 모두 라룹이 뼈대에 있으며, 앱이 읽으면 그릴 수 있는 옷이다", () => {
    const vest = rawServerItems().filter((item) => item.kind === "wearable" && item.slot === "top" && item.price === null && (item.draw as { attach?: string } | undefined)?.attach === "skin");
    expect(vest.length).toBe(1);
    const item = vest[0];
    expect({ kind: item.kind, slot: item.slot, price: item.price, draw: item.draw }).toEqual({ kind: "wearable", slot: "top", price: null, draw: { attach: "skin", body: 1 } });
    const glb = parseGlb(readFileSync(join(SERVER_FILES_DIR, item.files!.model!)));
    const skins = glb.json.nodes.filter((n) => n.skin !== undefined).map((n) => skinOf(glb, n.name!)!);
    expect(skins.length).toBeGreaterThan(0);
    const bones = characterBones();
    for (const skin of skins) expect(skin.joints.filter((name) => !bones.has(name))).toEqual([]);
    expect(serverRef(item.files!.model!).bytes).toBeGreaterThan(0);
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-z5"))!);
    expect(wearDraw(item.id)).not.toBeNull();
    expect(wearDraw(item.id)!.attach).toBe("skin");
  });
});
