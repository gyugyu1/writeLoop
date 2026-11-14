// [spec] qa 테스트(작업 090-② 가구 내려받기, 새 기능, 모바일): 가구 그리기 정보의 출처(받은 목록의 draw, 없으면 앱 기본값),
// 모델·아이콘 파일 받기와 기기 저장, 기기 저장 정리, 손님, 서버에서 더한 가구, 앱에 든 사본과 서버 파일 대조를 모듈 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/04-가구-내려받기/04-qa-scenarios.md)와
// 같은 폴더 05-main-decision.md에서만 가져온다. 테스트 이름 앞의 번호가 시나리오 번호다(03-qa-scenarios.md의 B28 포함).
// 05 결정이 시나리오를 바꾼 곳:
// - 결정 1(열넷 모두 앱 기본값): 목록에 draw가 없거나 목록이 없어도 지금 가구 열넷은 앱 값으로 그린다. 그래서 B4·B5·B6은
//   "그릴 줄 모르는 아이템"이 아니라 "그릴 줄 알고, 받을 주소가 없어 자리 표시 상자·첫 글자 칸"으로 기대값을 바꿨다(이름에 "05 결정 1").
// - 결정 2(처음 방 일곱의 해시가 다른데 아직 못 받았으면 앱에 든 모델): A6의 "받기 전" 기대값.
// - 메인 세션이 정한 것: 파일 주소 /api/catalog/files/<sha256>.<glb|png>(API 주소에 붙임), 받은 크기가 bytes와 다르면 실패(지우고 다음에 다시),
//   같은 파일을 동시에 두 번 받지 않음, 앱에 든 아이콘 셋도 해시 비교(C10·C11·A5).
// 부르는 방법은 구현(41f3213)에서 이름만 읽었다: item-catalog-store(setItemCatalog·parseItemCatalog·currentItemCatalog·catalogItem),
// item-catalog(refreshItemCatalog), item-files(retryFailedItemFiles), furniture-files(furnitureModelSource·furnitureIconSource),
// furniture-icons(furnitureIcon), furniture-catalog(FURNITURE_TYPES·findFurnitureType·furnitureType·fittedModel), furniture-layout, lobby-layout-payload,
// home-shopping-catalog(isShopKnown·shopPlacement), 기기 파일은 expo-file-system(File·Directory·Paths, File.downloadFileAsync).
// 가짜로 두는 것: 기기 파일(expo-file-system: 주소마다 크기를 두는 표, 받기는 테스트가 답을 정한다), 기기 저장소(AsyncStorage: 새 실행에도 남는 표),
// 서버 목록 API(getItemCatalog). "새 실행"은 jest.resetModules로 앱 모듈 상태를 비우는 것으로 본다(기기 파일·기기 저장소는 남는다).
// 093(창문 붙박이) 04-main-decision.md 1(사용자 결정 "qa가 4개 고침"): 앱 창문 정보에 draw.fixed(true)가 더해져, A2·B6이 비교하는 기준 표 BASE의 창문에
// 이 값 하나만 더했다(private 작업 폴더 093-2026-11-14-창문-붙박이, 보고 06-qa-tests.md). 다른 값과 단언은 그대로다.
/* eslint-disable @typescript-eslint/no-require-imports */
import { createHash } from "crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

type Reply = { bytes: number } | "fail" | "hold";

const mockDevice = {
  /** 기기 파일: 주소 → 크기 */
  files: new Map<string, number>(),
  dirs: new Set<string>(),
  /** 받기를 부른 주소(차례대로) */
  downloads: [] as string[],
  /** 받아서 쓴 기기 주소 */
  writes: [] as string[],
  /** 지운 기기 주소 */
  deletes: [] as string[],
  /** 받기 답: 파일 API 경로(/api/catalog/files/...) → 받은 크기, 실패, 기다림. 없으면 실패 */
  replies: new Map<string, Reply>(),
  held: new Map<string, { resolve: (bytes: number) => void; reject: (error: unknown) => void }>()
};
const mockStorage = new Map<string, string>();
const mockApi: { getItemCatalog: () => Promise<unknown> } = { getItemCatalog: () => Promise.reject(new Error("offline")) };

function mockReply(url: string): Promise<number> {
  const path = url.slice(url.indexOf("/api/"));
  const reply = mockDevice.replies.get(path);
  if (reply === "hold") {
    return new Promise((resolve, reject) => mockDevice.held.set(path, { resolve, reject }));
  }
  if (!reply || reply === "fail") return Promise.reject(new Error(`받지 못함(테스트 가짜): ${path}`));
  return Promise.resolve(reply.bytes);
}

jest.mock("expo-file-system", () => {
  const join2 = (parent: unknown, name: string) => {
    const base = typeof parent === "string" ? parent : (parent as { uri: string }).uri;
    return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
  };
  class File {
    uri: string;
    constructor(parent: unknown, name?: string) {
      this.uri = name === undefined ? (typeof parent === "string" ? parent : (parent as { uri: string }).uri) : join2(parent, name);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    get exists() {
      return mockDevice.files.has(this.uri);
    }
    get size() {
      return mockDevice.files.get(this.uri) ?? 0;
    }
    delete() {
      if (!mockDevice.files.has(this.uri)) throw new Error(`없는 파일: ${this.uri}`);
      mockDevice.files.delete(this.uri);
      mockDevice.deletes.push(this.uri);
    }
    static async downloadFileAsync(url: string, destination: { uri: string }) {
      mockDevice.downloads.push(url);
      const bytes = await mockReply(url);
      const file = new File(destination.uri);
      mockDevice.files.set(file.uri, bytes);
      mockDevice.writes.push(file.uri);
      return file;
    }
  }
  class Directory {
    uri: string;
    constructor(parent: unknown, name: string) {
      this.uri = `${join2(parent, name)}/`;
    }
    get exists() {
      return mockDevice.dirs.has(this.uri) || [...mockDevice.files.keys()].some((key) => key.startsWith(this.uri));
    }
    create() {
      mockDevice.dirs.add(this.uri);
    }
    list() {
      return [...mockDevice.files.keys()].filter((key) => key.startsWith(this.uri) && !key.slice(this.uri.length).includes("/")).map((key) => new File(key));
    }
  }
  return { File, Directory, Paths: { document: { uri: "file:///qa-document/" }, cache: { uri: "file:///qa-cache/" } } };
});
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStorage.set(key, value);
    },
    removeItem: async (key: string) => {
      mockStorage.delete(key);
    },
    clear: async () => {
      mockStorage.clear();
    }
  }
}));
jest.mock("@/lib/api", () => ({ getItemCatalog: () => mockApi.getItemCatalog() }));
// 앱에 든 처음 방 가구 일곱의 모델 파일(Jest가 읽지 못하는 파일이라 이름만 준다)
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");

// ---------- 공통 준비(04-qa-scenarios "공통 준비") ----------

const MOBILE = join(__dirname, "..", "..");
const SERVER_FILES = join(MOBILE, "..", "backend", "src", "main", "resources", "catalog", "files");
const SEVEN = ["desk", "bookcase", "board", "window", "wardrobe", "rug", "lamp"];
const SEVEN_ICONS = ["wardrobe", "rug", "lamp"];
const OTHER_SEVEN = ["bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame"];
const STORAGE_KEY = "writeloop.item-catalog.v1";

const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
function fileRef(path: string) {
  const data = readFileSync(path);
  return { sha256: sha(data), bytes: data.length };
}
/** APP(id): 앱에 든 그 가구 모델 파일의 sha256·크기. APPI(id): 앱에 든 아이콘. */
const APP = (id: string) => fileRef(join(MOBILE, "assets", "models", "furniture", `${id}.glb`));
const APPI = (id: string) => fileRef(join(MOBILE, "assets", "icons", "furniture", `${id}.png`));

const H = (name: string) => sha(`qa-090-${name}`);
const B = H("bed-model");
const BI = H("bed-icon");
const S = H("sofa-model");
const SI = H("sofa-icon");
const C = H("clock-model");
const CI = H("clock-icon");
const M = H("mug-model");
const MI = H("mug-icon");
const W2 = H("wardrobe-model-2");
const OLD = H("old-model");
const OLDI = H("old-icon");
const BYTES = { [B]: 4101, [BI]: 4102, [S]: 4103, [SI]: 4104, [C]: 4105, [CI]: 4106, [M]: 4107, [MI]: 4108, [W2]: 4109, [OLD]: 4110, [OLDI]: 4111 };
const ref = (hash: string, ext: "glb" | "png") => ({ url: `/api/catalog/files/${hash}.${ext}`, sha256: hash, bytes: BYTES[hash] });
const path = (hash: string, ext: "glb" | "png") => `/api/catalog/files/${hash}.${ext}`;

/** 기준 커밋(2d9f184) furniture-catalog.ts의 가구 열넷(그대로여야 할 값. 05 결정 1로 열넷 모두 앱 기본값이다). */
const BASE = [
  {
    id: "desk",
    name: "일기 책상",
    mount: "floor",
    size: { width: 3, depth: 1 },
    height: { bottom: 0, top: 1.292 },
    blocksWalk: true,
    place: { id: "desk", approach: [{ x: 0, z: 1.25 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 2.1, z: 0 } },
    chair: {
      piece: "chair",
      at: { x: 0, z: 0.45 },
      pull: 0.5,
      seat: { x: 0, z: 0.95 },
      side: { x: 0.65, z: 1.05 },
      seatHeight: 0.67,
      box: { width: 0.56, height: 1.316, depth: 0.56 },
      shadow: [0.75, 0.75, 0.42]
    },
    surface: {},
    removable: false,
    model: { piece: "desk", box: { width: 2.468, height: 1.292, depth: 1.318 }, fillWidth: true, y: 0, shadow: { floor: [2.8, 1.65, 0.5] } }
  },
  {
    id: "bookcase",
    name: "책장",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 2.464 },
    blocksWalk: true,
    place: { id: "bookcase", approach: [{ x: 0, z: 0.9 }], faceTo: { x: 0, z: -0.5 }, label: { x: 0, y: 2.3, z: 0.4 } },
    removable: false,
    model: { piece: "bookcase", box: { width: 1.12, height: 2.464, depth: 0.876 }, y: 0, shadow: { floor: [1.4, 1.2, 0.52] } }
  },
  {
    id: "wardrobe",
    name: "옷장",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 2.38 },
    blocksWalk: true,
    closet: { approach: [{ x: 0, z: 0.9 }], faceTo: { x: 0, z: -0.5 }, label: { x: 0, y: 2.25, z: 0.4 } },
    removable: true,
    model: { piece: "wardrobe", box: { width: 1.12, height: 2.38, depth: 0.876 }, y: 0, shadow: { floor: [1.4, 1.2, 0.52] } }
  },
  {
    id: "rug",
    name: "깔개",
    mount: "cover",
    size: { width: 3, depth: 3 },
    height: { bottom: 0, top: 0.028 },
    blocksWalk: false,
    removable: true,
    model: { piece: "rug", box: { width: 2.576, height: 0.028, depth: 2.576 }, y: 0.004 }
  },
  {
    id: "lamp",
    name: "스탠드",
    mount: "tabletop",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 0.88 },
    blocksWalk: false,
    removable: true,
    model: { piece: "tableLamp", box: { width: 0.418, height: 0.88, depth: 0.475 }, y: 0 }
  },
  {
    id: "bed",
    name: "침대",
    mount: "floor",
    size: { width: 2, depth: 3 },
    height: { bottom: 0, top: 1.05 },
    blocksWalk: true,
    removable: true,
    model: { piece: "bed", box: { width: 1.599, height: 1.05, depth: 3.15 }, y: 0, shadow: { floor: [1.95, 3.35, 0.5] } }
  },
  {
    id: "nightstand",
    name: "협탁",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 0.74 },
    blocksWalk: true,
    surface: {},
    removable: true,
    model: { piece: "nightstand", box: { width: 0.745, height: 0.737, depth: 0.608 }, y: 0, shadow: { floor: [0.95, 0.85, 0.45] } }
  },
  {
    id: "floorLamp",
    name: "바닥 스탠드",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 2.41 },
    blocksWalk: true,
    removable: true,
    model: { piece: "floorLamp", box: { width: 0.418, height: 2.408, depth: 0.475 }, y: 0, shadow: { floor: [0.6, 0.65, 0.45] } }
  },
  {
    id: "plant",
    name: "화분",
    mount: "floor",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 1.83 },
    blocksWalk: true,
    removable: true,
    model: { piece: "plant", box: { width: 0.486, height: 1.636, depth: 0.574 }, y: 0, shadow: { floor: [0.7, 0.75, 0.45] } }
  },
  {
    id: "smallPlant",
    name: "작은 화분",
    mount: "tabletop",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 0.41 },
    blocksWalk: false,
    removable: true,
    model: { piece: "smallPlant", box: { width: 0.25, height: 0.37, depth: 0.249 }, y: 0 }
  },
  {
    id: "books",
    name: "책",
    mount: "tabletop",
    size: { width: 1, depth: 1 },
    height: { bottom: 0, top: 0.29 },
    blocksWalk: false,
    removable: true,
    model: { piece: "booksStack", box: { width: 0.419, height: 0.29, depth: 0.265 }, y: 0 }
  },
  {
    id: "board",
    name: "오늘의 질문 게시판",
    mount: "wall",
    size: { width: 1.8, depth: 0 },
    height: { bottom: 1.05, top: 2.45 },
    blocksWalk: false,
    place: { id: "board", approach: [{ x: -0.2, z: 1.3 }, { x: 0.4, z: 1.3 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 2.75, z: 0.3 } },
    removable: false,
    model: { piece: "board", box: { width: 1.792, height: 1.4, depth: 0.126 }, y: 1.75, wallDepth: 0.06, shadow: { wall: [2.0, 1.6, 0.3] } }
  },
  {
    id: "window",
    name: "창문",
    mount: "wall",
    size: { width: 2.3, depth: 0 },
    height: { bottom: 1.112, top: 2.988 },
    blocksWalk: false,
    place: { id: "window", approach: [{ x: -0.3, z: 1.55 }, { x: 0.3, z: 1.55 }], faceTo: { x: 0, z: 0 }, label: { x: 0, y: 3.05, z: 0.3 } },
    removable: false,
    view: true,
    fixed: true,
    model: { piece: "window", box: { width: 2.3, height: 1.876, depth: 0.35 }, y: 2.05, wallDepth: 0.17, shadow: { wall: [2.55, 2.15, 0.3] } }
  },
  {
    id: "frame",
    name: "액자",
    mount: "wall",
    size: { width: 1, depth: 0 },
    height: { bottom: 1.6, top: 2.4 },
    blocksWalk: false,
    removable: true,
    model: { piece: "frame", box: { width: 1, height: 0.8, depth: 0.084 }, y: 2.0, wallDepth: 0.042, shadow: { wall: [1.15, 0.95, 0.3] } }
  }
];

const baseOf = (id: string) => BASE.find((entry) => entry.id === id)!;
/** 그 가구의 지금 값에서 id·name을 뺀 그리기 정보(목록의 draw 모양). */
function drawOf(id: string): Record<string, unknown> {
  const { id: _id, name: _name, ...draw } = baseOf(id) as Record<string, unknown>;
  return JSON.parse(JSON.stringify(draw)) as Record<string, unknown>;
}

type ServerItem = Record<string, unknown> & { id: string };
const furnitureItem = (id: string, name: string, draw: Record<string, unknown> | null, assets: unknown, sale?: { shopName: string; category: string; price: number }): ServerItem => ({
  id,
  kind: "furniture",
  name,
  shopName: sale?.shopName ?? name,
  description: "",
  category: sale?.category ?? null,
  slot: null,
  price: sale?.price ?? null,
  draw,
  assets
});

const QA_SOFA_DRAW = {
  mount: "floor",
  size: { width: 2, depth: 1 },
  height: { bottom: 0, top: 0.9 },
  blocksWalk: true,
  removable: true,
  model: { piece: "qaSofa", box: { width: 1.9, height: 0.9, depth: 0.95 }, y: 0, shadow: { floor: [2.2, 1.2, 0.5] } }
};
const QA_CLOCK_DRAW = {
  mount: "wall",
  size: { width: 1, depth: 0 },
  height: { bottom: 1.5, top: 2.1 },
  blocksWalk: false,
  removable: true,
  model: { piece: "qaClock", box: { width: 0.6, height: 0.6, depth: 0.08 }, y: 1.8, wallDepth: 0.04 }
};
const QA_MUG_DRAW = {
  mount: "tabletop",
  size: { width: 1, depth: 1 },
  height: { bottom: 0, top: 0.2 },
  blocksWalk: false,
  removable: true,
  model: { piece: "qaMug", box: { width: 0.2, height: 0.2, depth: 0.2 }, y: 0 }
};

/** QA 목록 CAT1(version "qa-v1"). change로 아이템을 바꿀 수 있다. */
function cat1(change: (item: ServerItem) => ServerItem = (item) => item, version = "qa-v1") {
  const seven: ServerItem[] = SEVEN.map((id) =>
    furnitureItem(id, baseOf(id).name, drawOf(id), {
      model: { url: `/api/catalog/files/${APP(id).sha256}.glb`, ...APP(id) },
      icon: SEVEN_ICONS.includes(id) ? { url: `/api/catalog/files/${APPI(id).sha256}.png`, ...APPI(id) } : null
    })
  );
  const items: ServerItem[] = [
    ...seven,
    furnitureItem("bed", "침대", drawOf("bed"), { model: ref(B, "glb"), icon: ref(BI, "png") }, { shopName: "침대", category: "furniture", price: 300 }),
    furnitureItem("qaSofa", "QA 소파", QA_SOFA_DRAW, { model: ref(S, "glb"), icon: ref(SI, "png") }, { shopName: "QA 소파", category: "furniture", price: 120 }),
    furnitureItem("qaClock", "QA 시계", QA_CLOCK_DRAW, { model: ref(C, "glb"), icon: ref(CI, "png") }, { shopName: "QA 시계", category: "decor", price: 90 }),
    furnitureItem("qaMug", "QA 머그", QA_MUG_DRAW, { model: ref(M, "glb"), icon: ref(MI, "png") }, { shopName: "QA 머그", category: "decor", price: 30 }),
    { id: "capOrange", kind: "wearable", name: "주황 야구모자", shopName: "주황 야구모자", description: "", category: "clothes", slot: "hat", price: 60, assets: null }
  ];
  return { version, items: items.map(change) };
}

/** 받기 답을 정한다: 그 해시의 파일은 목록의 크기로 받아진다. */
function serve(...hashes: [string, "glb" | "png"][]) {
  for (const [hash, ext] of hashes) mockDevice.replies.set(path(hash, ext), { bytes: BYTES[hash] });
}

function load() {
  return {
    store: require("@/lib/item-catalog-store") as typeof import("@/lib/item-catalog-store"),
    catalog: require("@/lib/item-catalog") as typeof import("@/lib/item-catalog"),
    files: require("@/lib/item-files") as typeof import("@/lib/item-files"),
    ff: require("@/lib/lobby3d/furniture-files") as typeof import("@/lib/lobby3d/furniture-files"),
    icons: require("@/lib/lobby3d/furniture-icons") as typeof import("@/lib/lobby3d/furniture-icons"),
    kinds: require("@/lib/lobby3d/furniture-catalog") as typeof import("@/lib/lobby3d/furniture-catalog"),
    layout: require("@/lib/lobby3d/furniture-layout") as typeof import("@/lib/lobby3d/furniture-layout"),
    lobby: require("@/lib/lobby3d/lobby-layout") as typeof import("@/lib/lobby3d/lobby-layout"),
    payload: require("@/lib/lobby3d/lobby-layout-payload") as typeof import("@/lib/lobby3d/lobby-layout-payload"),
    shop: require("@/components/home/home-shopping-catalog") as typeof import("@/components/home/home-shopping-catalog"),
    env: require("@/lib/env") as typeof import("@/lib/env"),
    engine: require("@/lib/lobby3d/engine") as typeof import("@/lib/lobby3d/engine")
  };
}
type App = ReturnType<typeof load>;

/** 받은 목록으로 둔다(서버가 준 모양을 앱이 읽은 것). */
function setCatalog(app: App, value: unknown) {
  const parsed = app.store.parseItemCatalog(value);
  expect(parsed).not.toBeNull();
  app.store.setItemCatalog(parsed!);
}

async function flush() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

const nameOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);
const downloadedPaths = () => mockDevice.downloads.map((url) => url.slice(url.indexOf("/api/")));
const deviceNames = () => [...mockDevice.files.keys()].map(nameOf).sort();

/** 처음 배치에 그 가구를 더한 배치 본문(서버가 준 모양). */
function payloadWith(items: Record<string, unknown>[], stored: Record<string, unknown>[] = []) {
  const base = load().lobby.DEFAULT_LOBBY_LAYOUT.items as unknown as Record<string, unknown>[];
  const body: Record<string, unknown> = { version: 2, items: [...JSON.parse(JSON.stringify(base)), ...items] };
  if (stored.length > 0) body.stored = stored;
  return body;
}
const BED_IN_ROOM = { id: "bed-1", type: "bed", floor: { x: 4, z: 5.5, facing: 0 } };

beforeEach(() => {
  jest.resetModules();
  mockDevice.files.clear();
  mockDevice.dirs.clear();
  mockDevice.downloads.length = 0;
  mockDevice.writes.length = 0;
  mockDevice.deletes.length = 0;
  mockDevice.replies.clear();
  mockDevice.held.clear();
  mockStorage.clear();
  mockApi.getItemCatalog = () => Promise.reject(new Error("offline"));
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------- A. 앱에 든 일곱 가구 ----------

describe("[spec] 090-② A: 앱에 든 처음 방 가구 일곱", () => {
  test("A1 저장한 목록이 없고 목록·파일 받기가 모두 실패해도, 처음 배치의 일곱 가구는 앱에 든 모델로 바로 그릴 수 있고 파일 요청이 0건이다", async () => {
    const app = load();
    await app.catalog.refreshItemCatalog({ store: true });
    await flush();

    const placed = app.layout.buildPlacements(app.lobby.DEFAULT_LOBBY_LAYOUT);
    // 입구 발판(#exit)은 가구가 아니다
    expect([...new Set(placed.filter((p) => app.layout.placementKey(p) !== "#exit").map((p) => p.item))].sort()).toEqual([...SEVEN].sort());
    for (const id of SEVEN) {
      const source = app.ff.furnitureModelSource(id, { fetch: true });
      expect({ id, bundled: source?.bundled ?? null }).toEqual({ id, bundled: true });
    }
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });

  test("A2 (05 결정 1) 목록이 없으면 가구 열넷의 그리기 정보는 기준 커밋의 앱 값과 같고, 칸 맞추기도 같다(책상 비율 x 3/2.468, 깔개 놓는 자리 (0, 0))", () => {
    const app = load();
    expect(JSON.parse(JSON.stringify(app.kinds.FURNITURE_TYPES))).toEqual(BASE);
    for (const entry of BASE) expect(JSON.parse(JSON.stringify(app.kinds.findFurnitureType(entry.id)))).toEqual(entry);
    expect(app.kinds.fittedModel(app.kinds.furnitureType("desk")).scale.x).toBeCloseTo(3 / 2.468, 6);
    expect(app.kinds.fittedModel(app.kinds.furnitureType("rug")).drawAt).toEqual({ x: 0, z: 0 });
  });

  test("A3 앱의 가구 모델은 일곱 각각 따로 파일이고 묶음(lobby-furniture.glb)을 부르지 않으며, 아이콘은 옷장·깔개·스탠드 셋뿐이고, 빠지는 일곱의 모델·아이콘은 앱에 없다", () => {
    expect(readdirSync(join(MOBILE, "assets", "models", "furniture")).sort()).toEqual(SEVEN.map((id) => `${id}.glb`).sort());
    expect(readdirSync(join(MOBILE, "assets", "icons", "furniture")).sort()).toEqual(SEVEN_ICONS.map((id) => `${id}.png`).sort());
    for (const id of OTHER_SEVEN) {
      expect({ id, model: existsSync(join(MOBILE, "assets", "models", "furniture", `${id}.glb`)), icon: existsSync(join(MOBILE, "assets", "icons", "furniture", `${id}.png`)) }).toEqual({
        id,
        model: false,
        icon: false
      });
    }
    // 앱 코드(src)가 부르는(require) 가구 모델·아이콘 파일: 묶음이 아니라 일곱 파일과 아이콘 셋
    const required = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) {
          for (const match of readFileSync(full, "utf8").matchAll(/require\(\s*["']([^"']+\.(?:glb|png))["']\s*\)/g)) {
            const target = relative(join(MOBILE, "assets"), join(dir, match[1])).split("\\").join("/");
            if (target.startsWith("models/") || target.startsWith("icons/furniture/")) required.add(target);
          }
        }
      }
    };
    walk(join(MOBILE, "src"));
    expect(required.has("models/lobby-furniture.glb")).toBe(false);
    expect([...required].filter((file) => file.startsWith("models/furniture/")).sort()).toEqual(SEVEN.map((id) => `models/furniture/${id}.glb`).sort());
    expect([...required].filter((file) => file.startsWith("icons/furniture/")).sort()).toEqual(SEVEN_ICONS.map((id) => `icons/furniture/${id}.png`).sort());
  });

  test("A4 CAT1(일곱의 해시가 앱 파일과 같음)을 받은 뒤 처음 배치를 그리면, 일곱 모두 앱에 든 모델이고 모델 요청이 0건이며 기기에 새로 쓰지 않는다", async () => {
    const app = load();
    setCatalog(app, cat1());
    for (const id of SEVEN) {
      const source = app.ff.furnitureModelSource(id, { fetch: true });
      expect({ id, bundled: source?.bundled ?? null }).toEqual({ id, bundled: true });
    }
    await flush();
    expect(mockDevice.downloads).toEqual([]);
    expect(mockDevice.writes).toEqual([]);
  });

  test("A5 CAT1(아이콘 셋의 해시가 앱 그림과 같음)이면 옷장·깔개·스탠드 아이콘은 앱에 든 그림이고 아이콘 요청이 0건이다", async () => {
    const before = load();
    const appIcons = SEVEN_ICONS.map((id) => before.icons.furnitureIcon(id));
    for (const icon of appIcons) expect(icon).toBeDefined();
    setCatalog(before, cat1());
    expect(SEVEN_ICONS.map((id) => before.icons.furnitureIcon(id))).toEqual(appIcons);
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });

  test("A6 (05 결정 2) 옷장 모델 해시만 W2로 바뀐 목록이면, 받기 전에는 앱에 든 옷장 모델을 그리고 <W2>.glb를 한 번만 요청해 받으면 기기에 <W2>.glb로 두고 그 파일로 그린다", async () => {
    const app = load();
    setCatalog(app, cat1((item) => (item.id === "wardrobe" ? { ...item, assets: { model: ref(W2, "glb"), icon: (item.assets as { icon: unknown }).icon } } : item)));
    mockDevice.replies.set(path(W2, "glb"), "hold");

    const first = app.ff.furnitureModelSource("wardrobe", { fetch: true });
    const again = app.ff.furnitureModelSource("wardrobe", { fetch: true });
    await flush();
    expect(first?.bundled).toBe(true);
    expect(again?.bundled).toBe(true);
    expect(downloadedPaths()).toEqual([path(W2, "glb")]);

    mockDevice.held.get(path(W2, "glb"))!.resolve(BYTES[W2]);
    await flush();
    expect(mockDevice.writes.map(nameOf)).toEqual([`${W2}.glb`]);
    const after = app.ff.furnitureModelSource("wardrobe", { fetch: true });
    expect(after).toEqual({ key: expect.any(String), url: mockDevice.writes[0], bundled: false });
    expect(downloadedPaths()).toEqual([path(W2, "glb")]);
  });

  test("B28 앱에 든 처음 방 일곱 모델과 아이콘 셋은 서버 파일(백엔드 catalog/files)과 내용 해시가 같다", () => {
    for (const id of SEVEN) {
      expect({ id, same: APP(id).sha256 === fileRef(join(SERVER_FILES, `${id}.glb`)).sha256 }).toEqual({ id, same: true });
    }
    for (const id of SEVEN_ICONS) {
      expect({ id, same: APPI(id).sha256 === fileRef(join(SERVER_FILES, `${id}.png`)).sha256 }).toEqual({ id, same: true });
    }
  });
});

// ---------- B. 그리기 정보의 출처 ----------

describe("[spec] 090-② B: 그리기 정보는 받은(저장한) 목록의 draw, 없으면 앱 기본값", () => {
  test("B1 목록이 옷장의 draw 크기를 2×1로 바꾸면 홈쇼핑 상세의 놓는 위치·크기는 '바닥에 놓기'·'2 × 1칸'이다", () => {
    const app = load();
    setCatalog(app, cat1((item) => (item.id === "wardrobe" ? { ...item, draw: { ...drawOf("wardrobe"), size: { width: 2, depth: 1 } } } : item)));
    expect(app.shop.shopPlacement("wardrobe")).toEqual({ where: "바닥에 놓기", size: "2 × 1칸" });
  });

  test("B1 (벽 가구) 목록이 액자의 draw 폭을 2로 바꾸면 홈쇼핑 상세의 놓는 위치·크기는 '벽에 걸기'·'가로 2칸'이다", () => {
    const app = load();
    const withFrame = cat1();
    withFrame.items.push(furnitureItem("frame", "액자", { ...drawOf("frame"), size: { width: 2, depth: 0 } }, { model: ref(OLD, "glb"), icon: ref(OLDI, "png") }));
    setCatalog(app, withFrame);
    expect(app.shop.shopPlacement("frame")).toEqual({ where: "벽에 걸기", size: "가로 2칸" });
  });

  test("B2 CAT1이면 침대의 놓는 위치·크기는 '바닥에 놓기'·'2 × 3칸'이다", () => {
    const app = load();
    setCatalog(app, cat1());
    expect(app.shop.shopPlacement("bed")).toEqual({ where: "바닥에 놓기", size: "2 × 3칸" });
  });

  test("B3 로그인 상태에서 CAT1을 받아 저장한 뒤 새 실행에서 목록·파일 받기가 모두 실패하면, 침대는 저장한 목록의 draw로 그릴 줄 아는 가구이고 침대 자리는 자리 표시 상자다", async () => {
    mockApi.getItemCatalog = () => Promise.resolve(cat1());
    const first = load();
    await first.catalog.refreshItemCatalog({ store: true });
    expect(mockStorage.has(STORAGE_KEY)).toBe(true);

    jest.resetModules();
    mockApi.getItemCatalog = () => Promise.reject(new Error("offline"));
    const app = load();
    await app.catalog.refreshItemCatalog({ store: true });
    await flush();

    expect(app.store.currentItemCatalog()?.version).toBe("qa-v1");
    expect(app.store.catalogItem("bed")?.draw).toEqual(drawOf("bed"));
    const layout = app.payload.parseLobbyLayoutPayload(payloadWith([BED_IN_ROOM]));
    expect(layout).not.toBeNull();
    expect(app.layout.buildPlacements(layout!).some((p) => p.item === "bed-1")).toBe(true);
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    await flush();
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    expect(mockDevice.writes).toEqual([]);
  });

  test("B4 (05 결정 1) 목록이 없으면(저장도 없음, 받기 실패) 침대는 홈쇼핑에 보이는 상품이고 아이콘은 없어 첫 글자 칸이며, 옷장은 앱 그림이다", async () => {
    const app = load();
    await app.catalog.refreshItemCatalog({ store: true });
    await flush();
    expect(app.shop.isShopKnown("bed")).toBe(true);
    expect(app.shop.isShopKnown("wardrobe")).toBe(true);
    expect(app.icons.furnitureIcon("bed")).toBeUndefined();
    expect(app.icons.furnitureIcon("wardrobe")).toBeDefined();
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });

  test("B5 (05 결정 1) 목록이 없을 때 방의 침대와 보관함의 협탁은 배치에 그대로 있고 그릴 줄 아는 가구이며, 침대는 받을 주소가 없어 자리 표시 상자다. 저장 본문에도 그대로다", async () => {
    const app = load();
    const body = payloadWith([BED_IN_ROOM], [{ id: "nightstand-1", type: "nightstand" }]);
    const layout = app.payload.parseLobbyLayoutPayload(body);
    expect(layout).not.toBeNull();
    expect(layout!.kept).toBeUndefined();
    expect(layout!.items.some((item) => item.id === "bed-1")).toBe(true);
    expect(app.lobby.storedItems(layout!)).toEqual([{ id: "nightstand-1", type: "nightstand" }]);
    const placed = app.layout.buildPlacements(layout!);
    expect(placed.find((p) => p.item === "bed-1")?.stowed).toBeFalsy();
    expect(placed.find((p) => p.item === "nightstand-1")?.stowed).toBe(true);
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    await flush();
    expect(mockDevice.downloads).toEqual([]);
    expect(app.payload.toLobbyLayoutPayload(layout!)).toEqual(body);
  });

  test("B6 (05 결정 1) ① 모양 목록(draw·assets 없음, version qa-old)을 저장해 둔 사용자가 목록 받기에 실패하면, 침대는 앱 값으로 그리고 받을 주소가 없어 자리 표시 상자이며 일곱 가구는 앱 값·앱 모델이다", async () => {
    const old = cat1((item) => {
      const { draw: _draw, assets: _assets, ...rest } = item;
      return rest as ServerItem;
    }, "qa-old");
    mockStorage.set(STORAGE_KEY, JSON.stringify(old));
    const app = load();
    await app.catalog.refreshItemCatalog({ store: true });
    await flush();

    expect(app.store.currentItemCatalog()?.version).toBe("qa-old");
    expect(JSON.parse(JSON.stringify(app.kinds.furnitureType("bed")))).toEqual(baseOf("bed"));
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    for (const id of SEVEN) {
      expect(JSON.parse(JSON.stringify(app.kinds.furnitureType(id)))).toEqual(baseOf(id));
      expect({ id, bundled: app.ff.furnitureModelSource(id, { fetch: true })?.bundled ?? null }).toEqual({ id, bundled: true });
    }
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });

  test("B7 앱이 모르는 두는 방식(ceiling)의 QA 소파는 홈쇼핑에 보이지 않고 방·보관함에 그리지 않으며, 저장 본문에는 받은 그대로 있다", () => {
    const app = load();
    setCatalog(app, cat1((item) => (item.id === "qaSofa" ? { ...item, draw: { ...QA_SOFA_DRAW, mount: "ceiling" } } : item)));
    expect(app.kinds.findFurnitureType("qaSofa")).toBeUndefined();
    expect(app.shop.isShopKnown("qaSofa")).toBe(false);
    const sofa = { id: "qaSofa-1", type: "qaSofa", floor: { x: 5, z: 1.5, facing: 0 } };
    const body = payloadWith([sofa], [{ id: "qaSofa-2", type: "qaSofa" }]);
    const layout = app.payload.parseLobbyLayoutPayload(body);
    expect(layout).not.toBeNull();
    expect(layout!.items.some((item) => item.type === "qaSofa")).toBe(false);
    expect(app.lobby.storedItems(layout!).some((item) => item.type === "qaSofa")).toBe(false);
    expect(app.layout.buildPlacements(layout!).some((p) => p.item.startsWith("qaSofa"))).toBe(false);
    expect(app.payload.toLobbyLayoutPayload(layout!)).toEqual(body);
  });

  describe("B8 ① 목록 받기 규칙은 draw·assets가 든 목록에도 그대로다", () => {
    test("같은 서울 날짜에 두 번째로 홈이 보이면 다시 받지 않는다", async () => {
      const calls: number[] = [];
      mockApi.getItemCatalog = () => {
        calls.push(1);
        return Promise.resolve(cat1());
      };
      const app = load();
      await app.catalog.refreshItemCatalog({ store: true });
      await app.catalog.refreshItemCatalog({ store: true });
      expect(calls).toHaveLength(1);
      expect(app.store.currentItemCatalog()?.version).toBe("qa-v1");
      expect(app.store.catalogItem("bed")?.assets?.model).toEqual(ref(B, "glb"));
    });

    test("받은 목록의 version이 저장해 둔 목록과 같으면 저장해 둔 목록을 그대로 쓴다", async () => {
      mockStorage.set(STORAGE_KEY, JSON.stringify(cat1()));
      mockApi.getItemCatalog = () => Promise.resolve(cat1((item) => (item.id === "bed" ? { ...item, name: "바뀐 이름" } : item)));
      const app = load();
      await app.catalog.refreshItemCatalog({ store: true });
      expect(app.store.catalogItem("bed")?.name).toBe("침대");
    });

    test("모양이 틀린 목록(version 없음)은 못 받은 것으로 본다", async () => {
      mockApi.getItemCatalog = () => Promise.resolve({ items: cat1().items });
      const app = load();
      await app.catalog.refreshItemCatalog({ store: true });
      expect(app.store.currentItemCatalog()).toBeNull();
      expect(mockStorage.has(STORAGE_KEY)).toBe(false);
    });
  });
});

// ---------- C. 모델 받기와 기기 저장 ----------

describe("[spec] 090-② C: 모델 파일 받기와 기기 저장", () => {
  test("C1 CAT1·기기에 파일 없음: 방에 놓인 침대는 /api/catalog/files/<B>.glb를 API 주소에 붙여 요청하고, 받으면 기기에 <B>.glb로 두고 그 파일로 그린다", async () => {
    const app = load();
    setCatalog(app, cat1());
    serve([B, "glb"]);

    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    await flush();
    expect(mockDevice.downloads).toEqual([`${app.env.apiBaseUrl}${path(B, "glb")}`]);
    expect(mockDevice.writes.map(nameOf)).toEqual([`${B}.glb`]);
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toEqual({ key: expect.any(String), url: mockDevice.writes[0], bundled: false });
  });

  test("C2 꺼내지 않은(보이지 않는) 가구는 모델을 받지 않는다", async () => {
    const app = load();
    setCatalog(app, cat1());
    serve([B, "glb"]);
    expect(app.ff.furnitureModelSource("bed", { fetch: false })).toBeNull();
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });

  test("C5 홈쇼핑에서 침대 그림을 그려도 모델(.glb)은 요청하지 않는다(아이콘만)", async () => {
    const app = load();
    setCatalog(app, cat1());
    serve([BI, "png"]);
    app.icons.furnitureIcon("bed");
    await flush();
    expect(downloadedPaths()).toEqual([path(BI, "png")]);
  });

  test("C6 받은 뒤에는 몇 번을 그려도 <B>.glb를 다시 요청하지 않는다(같은 실행)", async () => {
    const app = load();
    setCatalog(app, cat1());
    serve([B, "glb"]);
    app.ff.furnitureModelSource("bed", { fetch: true });
    await flush();
    for (let i = 0; i < 3; i += 1) app.ff.furnitureModelSource("bed", { fetch: true });
    await flush();
    expect(downloadedPaths()).toEqual([path(B, "glb")]);
  });

  test("C7 기기에 <B>.glb가 이미 있으면 새 실행에서 CAT1로 침대를 그려도 요청이 0건이고 기기 파일로 그린다", async () => {
    const first = load();
    setCatalog(first, cat1());
    serve([B, "glb"]);
    first.ff.furnitureModelSource("bed", { fetch: true });
    await flush();
    const saved = mockDevice.writes[0];
    mockDevice.downloads.length = 0;

    jest.resetModules();
    const app = load();
    setCatalog(app, cat1());
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toEqual({ key: expect.any(String), url: saved, bundled: false });
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });

  test("C8 받기에 실패하면 홈이 다시 보이기 전에는 다시 요청하지 않고, 다시 보이면(실패 기록 지움) 한 번 더 요청해 성공하면 그 파일로 그린다", async () => {
    const app = load();
    setCatalog(app, cat1());
    mockDevice.replies.set(path(B, "glb"), "fail");
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    await flush();
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    await flush();
    expect(downloadedPaths()).toEqual([path(B, "glb")]);

    serve([B, "glb"]);
    app.files.retryFailedItemFiles();
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    await flush();
    expect(downloadedPaths()).toEqual([path(B, "glb"), path(B, "glb")]);
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toEqual({ key: expect.any(String), url: mockDevice.writes[0], bundled: false });
  });

  test("C10 (05 메인 세션 세부) 받은 파일 크기가 목록의 bytes와 다르면 받기 실패다: 파일을 지우고 자리 표시 상자이며, 다시 보이기 전에는 다시 받지 않는다", async () => {
    const app = load();
    setCatalog(app, cat1());
    mockDevice.replies.set(path(B, "glb"), { bytes: BYTES[B] - 1 });
    app.ff.furnitureModelSource("bed", { fetch: true });
    await flush();
    expect(deviceNames()).toEqual([]);
    expect(app.ff.furnitureModelSource("bed", { fetch: true })).toBeNull();
    await flush();
    expect(downloadedPaths()).toEqual([path(B, "glb")]);

    serve([B, "glb"]);
    app.files.retryFailedItemFiles();
    app.ff.furnitureModelSource("bed", { fetch: true });
    await flush();
    expect(deviceNames()).toEqual([`${B}.glb`]);
  });

  test("C11 (05 메인 세션 세부) 받는 중에 같은 가구를 여러 번 부탁해도 그 파일은 한 번만 요청한다", async () => {
    const app = load();
    setCatalog(app, cat1());
    mockDevice.replies.set(path(B, "glb"), "hold");
    app.ff.furnitureModelSource("bed", { fetch: true });
    app.ff.requestFurnitureModel("bed");
    app.ff.furnitureModelSource("bed", { fetch: true });
    await flush();
    expect(downloadedPaths()).toEqual([path(B, "glb")]);
    mockDevice.held.get(path(B, "glb"))!.resolve(BYTES[B]);
    await flush();
    expect(deviceNames()).toEqual([`${B}.glb`]);
  });
});

// ---------- E. 아이콘 받기 ----------

describe("[spec] 090-② E: 아이콘 받기", () => {
  test("E1 CAT1·기기에 아이콘 없음: 침대 그림을 처음 찾으면 없음(첫 글자 칸)이고 <BI>.png를 요청하며, 받으면 기기에 저장한 그 파일 그림이다", async () => {
    const app = load();
    setCatalog(app, cat1());
    serve([BI, "png"]);
    expect(app.icons.furnitureIcon("bed")).toBeUndefined();
    await flush();
    expect(downloadedPaths()).toEqual([path(BI, "png")]);
    expect(mockDevice.writes.map(nameOf)).toEqual([`${BI}.png`]);
    expect(app.icons.furnitureIcon("bed")).toEqual({ uri: mockDevice.writes[0] });
  });

  test("E2 아이콘 받기에 실패하면 침대는 그림이 없고(첫 글자 칸) 옷장은 앱 그림 그대로다", async () => {
    const app = load();
    const wardrobeIcon = app.icons.furnitureIcon("wardrobe");
    setCatalog(app, cat1());
    mockDevice.replies.set(path(BI, "png"), "fail");
    app.icons.furnitureIcon("bed");
    await flush();
    expect(app.icons.furnitureIcon("bed")).toBeUndefined();
    expect(app.icons.furnitureIcon("wardrobe")).toEqual(wardrobeIcon);
  });

  test("E5 받은 아이콘은 기기에 남아, 새 실행에서는 요청 없이 처음부터 그 그림이다", async () => {
    const first = load();
    setCatalog(first, cat1());
    serve([BI, "png"]);
    first.icons.furnitureIcon("bed");
    await flush();
    const saved = mockDevice.writes[0];
    mockDevice.downloads.length = 0;

    jest.resetModules();
    const app = load();
    setCatalog(app, cat1());
    expect(app.icons.furnitureIcon("bed")).toEqual({ uri: saved });
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });

  test("E6 아이콘이 null인 가구(QA 시계)는 그림이 없고(첫 글자 칸) 아이콘 요청이 0건이다", async () => {
    const app = load();
    setCatalog(app, cat1((item) => (item.id === "qaClock" ? { ...item, assets: { model: ref(C, "glb"), icon: null } } : item)));
    expect(app.icons.furnitureIcon("qaClock")).toBeUndefined();
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });
});

// ---------- F. 기기 저장 정리 ----------

describe("[spec] 090-② F: 받은 목록이 바뀌면 새 목록에 없는 해시의 파일을 지운다", () => {
  const FOLDER_FILES = [`${B}.glb`, `${BI}.png`, `${OLD}.glb`, `${OLDI}.png`];

  /** 저장한 목록 qa-v0(B·BI·OLD·OLDI를 가리킴)과 그 네 파일을 기기에 둔다(앱이 받아 둔 것처럼 받아서 둔다). */
  async function deviceWithFourFiles() {
    const v0 = cat1((item) => (item.id === "qaSofa" ? { ...item, assets: { model: ref(OLD, "glb"), icon: ref(OLDI, "png") } } : item), "qa-v0");
    mockStorage.set(STORAGE_KEY, JSON.stringify(v0));
    const before = load();
    setCatalog(before, v0);
    serve([B, "glb"], [BI, "png"], [OLD, "glb"], [OLDI, "png"]);
    before.ff.furnitureModelSource("bed", { fetch: true });
    before.icons.furnitureIcon("bed");
    before.ff.furnitureModelSource("qaSofa", { fetch: true });
    before.icons.furnitureIcon("qaSofa");
    await flush();
    expect(deviceNames()).toEqual([...FOLDER_FILES].sort());
    jest.resetModules();
    mockDevice.downloads.length = 0;
  }

  test("F1 새로 받은 목록이 CAT1(OLD·OLDI 없음)이면 <OLD>.glb·<OLDI>.png가 지워지고 <B>.glb·<BI>.png는 남는다", async () => {
    await deviceWithFourFiles();
    mockApi.getItemCatalog = () => Promise.resolve(cat1());
    const app = load();
    await app.catalog.refreshItemCatalog({ store: true });
    await flush();
    expect(deviceNames()).toEqual([`${B}.glb`, `${BI}.png`].sort());
    expect(mockDevice.deletes.map(nameOf).sort()).toEqual([`${OLD}.glb`, `${OLDI}.png`].sort());
  });

  test("F2 목록 받기에 실패하면 네 파일이 모두 남는다", async () => {
    await deviceWithFourFiles();
    const app = load();
    await app.catalog.refreshItemCatalog({ store: true });
    await flush();
    expect(deviceNames()).toEqual([...FOLDER_FILES].sort());
    expect(mockDevice.deletes).toEqual([]);
  });

  test("F3 목록이 바뀌어 정리한 뒤에도 앱에 든 일곱 모델과 아이콘 셋은 그대로 쓰인다(받지 않는다)", async () => {
    await deviceWithFourFiles();
    mockApi.getItemCatalog = () => Promise.resolve(cat1());
    const app = load();
    const appIcons = SEVEN_ICONS.map((id) => app.icons.furnitureIcon(id));
    await app.catalog.refreshItemCatalog({ store: true });
    await flush();
    for (const id of SEVEN) expect({ id, bundled: app.ff.furnitureModelSource(id, { fetch: true })?.bundled ?? null }).toEqual({ id, bundled: true });
    expect(SEVEN_ICONS.map((id) => app.icons.furnitureIcon(id))).toEqual(appIcons);
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });
});

// ---------- G. 손님 ----------

describe("[spec] 090-② G: 손님(02 결정 4)", () => {
  const W2_CATALOG = () => cat1((item) => (item.id === "wardrobe" ? { ...item, assets: { model: ref(W2, "glb"), icon: (item.assets as { icon: unknown }).icon } } : item));

  test("G1 손님도 받은 모델(<W2>.glb)을 기기에 파일로 저장한다", async () => {
    mockApi.getItemCatalog = () => Promise.resolve(W2_CATALOG());
    const app = load();
    await app.catalog.refreshItemCatalog({ store: false });
    serve([W2, "glb"]);
    app.ff.furnitureModelSource("wardrobe", { fetch: true });
    await flush();
    expect(mockDevice.writes.map(nameOf)).toEqual([`${W2}.glb`]);
  });

  test("G2 손님도 받은 아이콘(<BI>.png)을 기기에 파일로 저장한다", async () => {
    mockApi.getItemCatalog = () => Promise.resolve(cat1());
    const app = load();
    await app.catalog.refreshItemCatalog({ store: false });
    serve([BI, "png"]);
    app.icons.furnitureIcon("bed");
    await flush();
    expect(mockDevice.writes.map(nameOf)).toEqual([`${BI}.png`]);
  });

  test("G3 손님은 목록을 기기에 적지 않는다(writeloop.item-catalog.v1에 아무것도 쓰지 않음)", async () => {
    mockApi.getItemCatalog = () => Promise.resolve(W2_CATALOG());
    const app = load();
    await app.catalog.refreshItemCatalog({ store: false });
    serve([W2, "glb"], [BI, "png"]);
    app.ff.furnitureModelSource("wardrobe", { fetch: true });
    app.icons.furnitureIcon("bed");
    await flush();
    expect(mockStorage.has(STORAGE_KEY)).toBe(false);
  });
});

// ---------- H. 서버에서 더한 가구 ----------

describe("[spec] 090-② H: 서버에서 더한 가구는 앱을 다시 내지 않고 나온다(모듈 단위)", () => {
  test("H1 CAT1의 QA 소파는 홈쇼핑에 보일 수 있는 상품이고 상세의 놓는 위치·크기는 '바닥에 놓기'·'2 × 1칸'이다", () => {
    const app = load();
    setCatalog(app, cat1());
    expect(app.shop.isShopKnown("qaSofa")).toBe(true);
    expect(app.shop.shopProductName("qaSofa")).toBe("QA 소파");
    expect(app.shop.inShopCategory("qaSofa", "furniture")).toBe(true);
    expect(app.shop.shopPlacement("qaSofa")).toEqual({ where: "바닥에 놓기", size: "2 × 1칸" });
  });

  test("H3 방에 놓인 QA 소파는 칸 2×1을 차지하고, 모델은 비율 (1, 1)·크기 1.9×0.9×0.95·놓는 자리 (0, -0.025)·그림자 floor [2.2, 1.2, 0.5]로 그린다", () => {
    const app = load();
    setCatalog(app, cat1());
    const sofa = { id: "qaSofa-1", type: "qaSofa", floor: { x: 5, z: 1.5, facing: 0 } };
    const layout = app.payload.parseLobbyLayoutPayload(payloadWith([sofa]));
    expect(layout).not.toBeNull();
    expect(layout!.items.some((item) => item.id === "qaSofa-1")).toBe(true);
    expect(app.lobby.floorPieceSize("qaSofa", 0)).toEqual({ width: 2, depth: 1 });
    expect(app.layout.buildPlacements(layout!).some((p) => p.item === "qaSofa-1")).toBe(true);
    const fit = app.kinds.fittedModel(app.kinds.furnitureType("qaSofa"));
    expect(fit.scale).toEqual({ x: 1, z: 1 });
    expect(fit.box).toEqual({ width: 1.9, height: 0.9, depth: 0.95 });
    expect(fit.drawAt.x).toBeCloseTo(0, 6);
    expect(fit.drawAt.z).toBeCloseTo(-0.025, 6);
    expect(fit.shadow).toEqual({ floor: [2.2, 1.2, 0.5] });
  });

  test("H4 QA 시계(벽 가구)의 홈쇼핑 상세는 '벽에 걸기'·'가로 1칸'이다", () => {
    const app = load();
    setCatalog(app, cat1());
    expect(app.shop.shopPlacement("qaClock")).toEqual({ where: "벽에 걸기", size: "가로 1칸" });
  });

  test("H5 QA 머그(탁상 소품)의 홈쇼핑 상세는 '책상·협탁 위'·'소품 자리 1칸'이다", () => {
    const app = load();
    setCatalog(app, cat1());
    expect(app.shop.shopPlacement("qaMug")).toEqual({ where: "책상·협탁 위", size: "소품 자리 1칸" });
  });
});

// ---------- I. 그대로여야 할 동작 ----------

describe("[spec] 090-② I: 그대로여야 할 동작(모듈 단위)", () => {
  test("I1 처음 배치의 가구 자리(장소·의자·창문 포함)는 목록이 없을 때와 CAT1을 받았을 때가 같다", () => {
    const app = load();
    const without = JSON.parse(JSON.stringify(app.layout.furniturePlacements(app.lobby.DEFAULT_LOBBY_LAYOUT)));
    const geometryWithout = JSON.parse(JSON.stringify(app.lobby.layoutGeometry(app.lobby.DEFAULT_LOBBY_LAYOUT, app.engine.ROOM.width)));
    setCatalog(app, cat1());
    expect(JSON.parse(JSON.stringify(app.layout.furniturePlacements(app.lobby.DEFAULT_LOBBY_LAYOUT)))).toEqual(without);
    expect(JSON.parse(JSON.stringify(app.lobby.layoutGeometry(app.lobby.DEFAULT_LOBBY_LAYOUT, app.engine.ROOM.width)))).toEqual(geometryWithout);
  });

  test("I4 옷은 바뀌지 않는다: CAT1의 옷(assets null)은 그림을 받지 않는다", async () => {
    const app = load();
    setCatalog(app, cat1());
    expect(app.store.catalogItem("capOrange")?.assets).toBeNull();
    expect(app.icons.furnitureIcon("capOrange")).toBeUndefined();
    await flush();
    expect(mockDevice.downloads).toEqual([]);
  });
});
