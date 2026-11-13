// [spec] qa 테스트(작업 090-② 가구 내려받기, 새 기능, 모바일): 로비 3D 화면에서 가구 모델을 언제 받고, 받는 동안·받지 못했을 때 무엇을 그리며,
// 자리 표시 상자가 칸을 차지하고 골라지고 옮겨지는지, 서버에서 더한 가구가 방에 나오는지를 본다.
// 기대값은 시나리오(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/04-가구-내려받기/04-qa-scenarios.md의 A1·A4·A6·C·D·H3~H6)와
// 같은 폴더 05-main-decision.md에서만 가져온다. 테스트 이름 앞의 번호가 시나리오 번호다.
// 05 결정이 시나리오를 바꾼 곳: 결정 2(처음 방 일곱은 받을 때까지 앱에 든 모델, A6), 결정 4(자리 표시 상자는 "칸 크기만 한 옅은 상자"가 아니라
// 지금의 대체 상자: 모델을 불러오기 전에 보이던 그 가구의 대체 모양, D1·D5), 메인 세션 세부(같은 파일을 동시에 두 번 받지 않음, D6).
//
// 어떻게 보나(기존 로비 3D 테스트 lobby3d-edit-add-no-rebuild.spec과 같은 틀. 구현 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen)과 3D 그리기(Lobby3dCanvas, 가구 lobby3d-furniture)는 진짜이고, Jest에서 돌지 않는 react-three-fiber만 가짜다.
// - 앱에 든 처음 방 일곱 파일은 useLoader(목록)가 파일마다 가짜 모델을 준다. 기기에 받은 모델 파일은 GLTFLoader.loadAsync(기기 주소)가 가짜 모델을 준다.
//   가짜 모델은 모델 이름마다 0.8칸 상자이고, 그 메시에 어느 파일에서 읽었는지(fakeSource)를 적는다.
// - 기기 파일과 받기는 가짜 expo-file-system이다(받기의 답은 테스트가 정한다: 받음·실패·기다림). 받기를 부른 주소를 적는다.
// - "그 가구를 X로 그린다": 그 가구 id(furnitureOf)인 3D 물체 가운데 보이는 것이 X의 가짜 모델 메시를 가진다.
//   "자리 표시 상자": 보이는 그 물체가 모델 메시 없이, 3D 그리기의 대체 모양(대체 가구 상자)에서 복제한 메시를 가진다(05 결정 4).
// - 목록은 받은 것으로 둔다(item-catalog-store.setItemCatalog). "홈이 다시 보임"은 홈이 그때 부르는 retryFailedItemFiles를 부르는 것으로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { retryFailedItemFiles } from "@/lib/item-files";
import { applyLobbyLayout, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";
import { furniturePlacements, placementKey } from "@/lib/lobby3d/furniture-layout";
import { isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type FurnitureItem, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;
type Reply = { bytes: number } | "fail" | "hold";

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
const mockHits: { phase: string; hit: PointerHit | null }[] = [];
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
/** 모델 파일(앱 파일 이름이나 기기 주소)마다 가짜 모델. 목록으로 읽으면 같은 목록에 같은 배열을 준다. */
const mockModels = { byFile: new Map<string, unknown>(), lists: new Map<string, unknown[]>(), make: null as ((file: string) => unknown) | null };
/** GLTFLoader.loadAsync로 읽은 기기 주소 */
const mockLoads: string[] = [];
const mockDevice = {
  files: new Map<string, number>(),
  dirs: new Set<string>(),
  downloads: [] as string[],
  writes: [] as string[],
  replies: new Map<string, Reply>(),
  held: new Map<string, { resolve: (bytes: number) => void; reject: (error: unknown) => void }>()
};

function mockModelFor(file: string): unknown {
  let model = mockModels.byFile.get(file);
  if (!model) {
    model = mockModels.make!(file);
    mockModels.byFile.set(file, model);
  }
  return model;
}

function mockReply(url: string): Promise<number> {
  const path = url.slice(url.indexOf("/api/"));
  const reply = mockDevice.replies.get(path);
  if (reply === "hold") return new Promise((resolve, reject) => mockDevice.held.set(path, { resolve, reject }));
  if (!reply || reply === "fail") return Promise.reject(new Error(`받지 못함(테스트 가짜): ${path}`));
  return Promise.resolve(reply.bytes);
}

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => mockThree,
    useFrame: (callback: FramePart) => {
      const ref = React.useRef(callback);
      ref.current = callback;
      React.useEffect(() => {
        const entry: FramePart = (state, delta) => ref.current(state, delta);
        mockFrames.add(entry);
        return () => {
          mockFrames.delete(entry);
        };
      }, []);
    },
    useLoader: (_loader: unknown, input: unknown) => {
      if (!Array.isArray(input)) return mockModelFor(String(input));
      const key = input.map(String).join("|");
      let list = mockModels.lists.get(key);
      if (!list) {
        list = input.map((file) => mockModelFor(String(file)));
        mockModels.lists.set(key, list);
      }
      return list;
    }
  };
});
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync(url: string) {
      mockLoads.push(String(url));
      return Promise.resolve(mockModelFor(String(url)));
    }
  }
}));
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
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
      mockDevice.files.delete(this.uri);
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
      return [...mockDevice.files.keys()].filter((key) => key.startsWith(this.uri)).map((key) => new File(key));
    }
  }
  return { File, Directory, Paths: { document: { uri: "file:///qa-document/" }, cache: { uri: "file:///qa-cache/" } } };
});
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});
jest.mock("@/components/lobby3d/lobby3d-room", () => ({
  BakedRoom: () => null,
  BakedRoomErrorBoundary: ({ children }: { children: unknown }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-character", () => ({
  BUBBLE_HEIGHT: 2,
  Character: () => null,
  CharacterErrorBoundary: ({ children }: { children: unknown }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const actual = jest.requireActual("@/components/lobby3d/lobby3d-canvas");
  return {
    ...actual,
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      return React.createElement(actual.default, {
        ...props,
        onPointer: (phase: string, hit: PointerHit | null, x: number, y: number) => {
          mockHits.push({ phase, hit });
          props.onPointer(phase as Parameters<Lobby3dCanvasProps["onPointer"]>[0], hit, x, y);
        }
      });
    }
  };
});
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 목록(04-qa-scenarios "공통 준비"의 CAT1) ----------

const MOBILE = join(__dirname, "..", "..");
const SEVEN = ["desk", "bookcase", "board", "window", "wardrobe", "rug", "lamp"];
const SEVEN_ICONS = ["wardrobe", "rug", "lamp"];
const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
function fileRef(file: string) {
  const data = readFileSync(file);
  return { sha256: sha(data), bytes: data.length };
}
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
const BYTES: Record<string, number> = { [B]: 4101, [BI]: 4102, [S]: 4103, [SI]: 4104, [C]: 4105, [CI]: 4106, [M]: 4107, [MI]: 4108, [W2]: 4109 };
const ref = (hash: string, ext: "glb" | "png") => ({ url: `/api/catalog/files/${hash}.${ext}`, sha256: hash, bytes: BYTES[hash] });
const filePath = (hash: string, ext: "glb" | "png") => `/api/catalog/files/${hash}.${ext}`;
let freshBytes = 5000;
/** 이 테스트에서만 쓰는 새 해시(받은 파일 표가 한 파일 안의 테스트 사이에 이어지므로 테스트마다 다른 파일로 본다). */
function fresh(name: string): string {
  const hash = H(name);
  freshBytes += 1;
  BYTES[hash] = freshBytes;
  return hash;
}
/** 침대의 모델 파일만 그 해시로 바꾼 CAT1. */
const bedModel = (hash: string) => (item: ServerItem) => (item.id === "bed" ? { ...item, assets: { model: ref(hash, "glb"), icon: ref(BI, "png") } } : item);

/** 앱에 든 그 가구의 지금 값에서 id·name을 뺀 그리기 정보. */
function appDraw(id: string): Record<string, unknown> {
  const { id: _id, name: _name, ...draw } = JSON.parse(JSON.stringify(FURNITURE_TYPES.find((type) => type.id === id))) as Record<string, unknown>;
  return draw;
}

type ServerItem = Record<string, unknown> & { id: string };
const furnitureItem = (id: string, name: string, draw: Record<string, unknown>, assets: unknown, price: number | null = null): ServerItem => ({
  id,
  kind: "furniture",
  name,
  shopName: name,
  description: "",
  category: price === null ? null : "furniture",
  slot: null,
  price,
  draw,
  assets
});

function cat1(change: (item: ServerItem) => ServerItem = (item) => item) {
  const items: ServerItem[] = [
    ...SEVEN.map((id) =>
      furnitureItem(id, FURNITURE_TYPES.find((type) => type.id === id)!.name, appDraw(id), {
        model: { url: `/api/catalog/files/${APP(id).sha256}.glb`, ...APP(id) },
        icon: SEVEN_ICONS.includes(id) ? { url: `/api/catalog/files/${APPI(id).sha256}.png`, ...APPI(id) } : null
      })
    ),
    furnitureItem("bed", "침대", appDraw("bed"), { model: ref(B, "glb"), icon: ref(BI, "png") }, 300),
    furnitureItem(
      "qaSofa",
      "QA 소파",
      {
        mount: "floor",
        size: { width: 2, depth: 1 },
        height: { bottom: 0, top: 0.9 },
        blocksWalk: true,
        removable: true,
        model: { piece: "qaSofa", box: { width: 1.9, height: 0.9, depth: 0.95 }, y: 0, shadow: { floor: [2.2, 1.2, 0.5] } }
      },
      { model: ref(S, "glb"), icon: ref(SI, "png") },
      120
    ),
    furnitureItem(
      "qaClock",
      "QA 시계",
      {
        mount: "wall",
        size: { width: 1, depth: 0 },
        height: { bottom: 1.5, top: 2.1 },
        blocksWalk: false,
        removable: true,
        model: { piece: "qaClock", box: { width: 0.6, height: 0.6, depth: 0.08 }, y: 1.8, wallDepth: 0.04 }
      },
      { model: ref(C, "glb"), icon: ref(CI, "png") }
    ),
    furnitureItem(
      "qaMug",
      "QA 머그",
      {
        mount: "tabletop",
        size: { width: 1, depth: 1 },
        height: { bottom: 0, top: 0.2 },
        blocksWalk: false,
        removable: true,
        model: { piece: "qaMug", box: { width: 0.2, height: 0.2, depth: 0.2 }, y: 0 }
      },
      { model: ref(M, "glb"), icon: ref(MI, "png") }
    )
  ];
  return { version: "qa-v1", items: items.map(change) };
}

function receiveCatalog(value: unknown) {
  const parsed = parseItemCatalog(value);
  expect(parsed).not.toBeNull();
  // 화면을 그리기 전에 둔다(받은 목록이 이미 있는 상태)
  setItemCatalog(parsed!);
}

function serve(...hashes: [string, "glb" | "png"][]) {
  for (const [hash, ext] of hashes) mockDevice.replies.set(filePath(hash, ext), { bytes: BYTES[hash] });
}
const downloadedPaths = () => mockDevice.downloads.map((url) => url.slice(url.indexOf("/api/")));
const modelDownloads = () => downloadedPaths().filter((p) => p.endsWith(".glb"));

// ---------- 배치 ----------

type Facing = 0 | 1 | 2 | 3;
const floor = (id: string, type: string, x: number, z: number, facing: Facing): FurnitureItem => ({ id, type, floor: { x, z, facing } });
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const layoutOf = (items: FurnitureItem[], stored: StoredItem[] = []): LobbyLayout => copy(makeLayout(items, stored));
const DEF = layoutOf(DEFAULT_LOBBY_LAYOUT.items);
const BED_AT: FloorPoint = { x: 4, z: 5.5 };
const BED_ROOM = layoutOf([...DEFAULT_LOBBY_LAYOUT.items, floor("bed-1", "bed", BED_AT.x, BED_AT.z, 0)]);
const BED_STORED = layoutOf(DEFAULT_LOBBY_LAYOUT.items, [{ id: "bed-1", type: "bed" }]);
const TWO_BEDS = layoutOf([...DEFAULT_LOBBY_LAYOUT.items, floor("bed-1", "bed", BED_AT.x, BED_AT.z, 0), floor("bed-2", "bed", 5, 1.5, 0)]);
const SOFA_AT: FloorPoint = { x: 5, z: 1.5 };
const SOFA_ROOM = layoutOf([...DEFAULT_LOBBY_LAYOUT.items, floor("qaSofa-1", "qaSofa", SOFA_AT.x, SOFA_AT.z, 0)]);
const WARDROBE_AT: FloorPoint = { x: 7.5, z: 3.5 };
const NOW = new Date("2026-11-13T03:00:00.000Z");
const SLOW_TEST_MS = 60_000;

// ---------- 가짜 모델 ----------

/** 모델 이름마다 0.8칸 상자 하나. 메시에 모델 이름(fakeModel)과 읽은 파일(fakeSource)을 적는다. 창 안쪽 판은 없다. */
function fakeGltf(file: string) {
  const scene = new THREE.Group();
  (scene as unknown as { getObjectByName: (name: string) => THREE.Object3D | undefined }).getObjectByName = (name: string) => {
    if (name === "windowView") return undefined;
    const group = new THREE.Group();
    group.name = name;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial());
    mesh.position.y = 0.4;
    mesh.userData.fakeModel = name;
    mesh.userData.fakeSource = file;
    group.add(mesh);
    return group;
  };
  return { scene, animations: [] };
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 10; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function camera() {
  return mockThree.camera!;
}

function scene() {
  return mockThree.scene!;
}

function syncScene() {
  const objects = screen.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((instance) => (instance.props as { object: THREE.Object3D }).object);
  scene().clear();
  for (const object of objects) scene().add(object);
}

async function frames(n = 3) {
  for (let index = 0; index < n; index += 1) {
    await act(async () => {
      syncScene();
      for (const part of [...mockFrames]) part({ camera: camera(), gl: {}, clock: { elapsedTime: 0 }, scene: scene() }, 0.05);
      syncScene();
      scene().updateMatrixWorld(true);
    });
  }
  syncScene();
  scene().updateMatrixWorld(true);
}

/** 기다리던 받기를 끝내고(받음) 화면이 따라오게 한다. */
async function finishDownload(hash: string, ext: "glb" | "png", bytes = BYTES[hash]) {
  const held = mockDevice.held.get(filePath(hash, ext));
  expect(held).toBeDefined();
  await act(async () => {
    held!.resolve(bytes);
  });
  await flushAsync();
  await frames();
  await flushAsync();
  await frames();
}

async function settle() {
  await flushAsync();
  await frames();
  await flushAsync();
  await frames();
}

function toScreen(x: number, y: number, z: number) {
  camera().updateMatrixWorld();
  const p = new THREE.Vector3(x, y, z).project(camera());
  const { width, height } = mockThree.size;
  const at = { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
  expect(at.x).toBeGreaterThan(0);
  expect(at.x).toBeLessThan(width);
  expect(at.y).toBeGreaterThan(0);
  expect(at.y).toBeLessThan(height);
  return at;
}

function touchView(): TestInstance {
  const views = screen.container.queryAll((instance: TestInstance) => {
    const props = instance.props as { onResponderGrant?: unknown; onStartShouldSetResponderCapture?: unknown };
    return (
      typeof instance.type === "string" &&
      typeof props.onResponderGrant === "function" &&
      typeof props.onStartShouldSetResponderCapture === "function" &&
      instance.queryAll((child: TestInstance) => child.type === "primitive").length > 0
    );
  });
  expect(views).toHaveLength(1);
  return views[0];
}

async function touch(handler: "onResponderGrant" | "onResponderRelease", at: { x: number; y: number }) {
  const view = touchView();
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>)[handler]({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
}

/** 화면 좌표를 톡 누른다(진짜 누르기 판정). 누를 때 3D 그리기가 넘긴 누르기 결과. */
async function tapAt(at: { x: number; y: number }): Promise<PointerHit | null> {
  const before = mockHits.length;
  await touch("onResponderGrant", at);
  const down = mockHits.slice(before).find((entry) => entry.phase === "down");
  await touch("onResponderRelease", at);
  await flushAsync();
  await frames();
  expect(down).toBeDefined();
  return down!.hit;
}

function canvasProps() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function edit() {
  const value = mockCanvas.props?.edit;
  expect(value).toBeTruthy();
  return value!;
}

function lifted(): string | null {
  return mockCanvas.props?.edit?.lifted ?? null;
}

function hit(point: FloorPoint | null, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

async function pointer(phase: "down" | "move" | "up", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvasProps().onPointer(phase, h, x, y);
  });
  await flushAsync();
}

async function dragPiece(piece: string, from: FloorPoint, to: FloorPoint) {
  await pointer("down", hit(from, piece), 200, 300);
  await pointer("move", hit(to, null), 300, 400);
  await pointer("up", null, 300, 400);
  await frames();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
  await frames();
}

/** 보관함 줄의 가구 칸(가구 이름)을 눌러 꺼낸다. */
async function takeOut(name: string) {
  const tray = screen.getByLabelText("보관함");
  await fireEvent.press(within(tray).getByRole("button", { name }));
  await flushAsync();
  await frames();
}

function isShown(object: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = object;
  while (o) {
    if (!o.visible) return false;
    if (o === scene()) return true;
    o = o.parent;
  }
  return false;
}

function furnitureObjects(id: string): THREE.Object3D[] {
  syncScene();
  const found: THREE.Object3D[] = [];
  scene().traverse((object) => {
    if (object.userData.furnitureOf === id) found.push(object);
  });
  return found;
}

/** 그 가구의 3D 물체를 무엇으로 그렸는지: 보이는 것마다 "model:<읽은 파일>"이나 "placeholder"(대체 상자 복제). */
function drawnAs(id: string): string[] {
  const kinds: string[] = [];
  for (const object of furnitureObjects(id).filter(isShown)) {
    let source: string | null = null;
    let borrowed = false;
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (typeof child.userData.fakeSource === "string") source = child.userData.fakeSource;
      else if (child.userData.borrowed) borrowed = true;
    });
    if (source) kinds.push(`model:${source}`);
    else if (borrowed) kinds.push("placeholder");
  }
  return kinds;
}

/** 자리 표시 상자로 보이는 그 가구의 물체(하나여야 한다). */
function placeholderOf(id: string): THREE.Object3D {
  const found = furnitureObjects(id).filter((object) => {
    if (!isShown(object)) return false;
    let borrowed = false;
    let model = false;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.borrowed) borrowed = true;
      if (child instanceof THREE.Mesh && child.userData.fakeModel) model = true;
    });
    return borrowed && !model;
  });
  expect(found).toHaveLength(1);
  return found[0];
}

/** 3D 그리기의 대체 모양(대체 가구 상자)에서 그 가구의 원본(복제가 아닌 것). */
function fallbackOf(id: string): THREE.Object3D {
  const found = furnitureObjects(id).filter((object) => {
    let meshes = 0;
    let borrowed = false;
    let model = false;
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      meshes += 1;
      if (child.userData.borrowed) borrowed = true;
      if (child.userData.fakeModel) model = true;
    });
    return meshes > 0 && !borrowed && !model;
  });
  expect(found.length).toBeGreaterThan(0);
  return found[0];
}

const meshGeometries = (object: THREE.Object3D) => {
  const list: THREE.BufferGeometry[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) list.push(child.geometry);
  });
  return list;
};

function worldXZ(object: THREE.Object3D) {
  const p = new THREE.Vector3();
  object.getWorldPosition(p);
  return { x: Math.round(p.x * 1000) / 1000, z: Math.round(p.z * 1000) / 1000 };
}

function placementOf(layout: LobbyLayout, id: string) {
  const place = furniturePlacements(layout).find((p) => placementKey(p) === id);
  expect(place).toBeDefined();
  return place!;
}

function itemIn(layout: LobbyLayout, id: string) {
  return layout.items.find((item) => item.id === id);
}

const host: { setPlace: ((value: { key: number; itemId: string; type: string } | null) => void) | null } = { setPlace: null };
function LobbyHost({ loaded, onSave }: { loaded: LobbyLayout; onSave: (value: LobbyLayout) => Promise<LobbyLayout> }) {
  const [layout, setLayout] = useState(loaded);
  const [placeRequest, setPlaceRequest] = useState<{ key: number; itemId: string; type: string } | null>(null);
  host.setPlace = setPlaceRequest;
  const save = async (value: LobbyLayout) => {
    const saved = await onSave(value);
    setLayout(saved);
    return saved;
  };
  return <Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={save} placeRequest={placeRequest} />;
}

async function renderLobby(loaded: LobbyLayout) {
  const onSaveLayout = jest.fn(async (value: LobbyLayout) => copy(value));
  await render(<LobbyHost loaded={loaded} onSave={onSaveLayout} />);
  await settle();
  return { onSaveLayout };
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
  await frames();
  expect(edit()).toBeTruthy();
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockHits.length = 0;
  mockCanvas.props = null;
  mockModels.byFile.clear();
  mockModels.lists.clear();
  mockModels.make = fakeGltf;
  mockLoads.length = 0;
  mockDevice.files.clear();
  mockDevice.dirs.clear();
  mockDevice.downloads.length = 0;
  mockDevice.writes.length = 0;
  mockDevice.replies.clear();
  mockDevice.held.clear();
  host.setPlace = null;
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// 모듈 상태(받은 파일 표·목록)는 한 파일 안에서 이어지므로, 테스트마다 서로 다른 해시를 쓰거나 처음에 둔다.
// 목록이 없는 테스트(A1)를 맨 앞에 둔다.

describe("[spec] 090-② A: 처음 방 일곱은 앱에 든 모델로 바로 그린다(3D)", () => {
  test(
    "A1 목록이 없고 모든 받기가 실패해도 처음 배치의 일곱 가구는 앱에 든 모델로 그려지고, 파일 요청이 0건이며 자리 표시 상자가 없다",
    async () => {
      await renderLobby(DEF);
      for (const id of SEVEN) {
        const drawn = drawnAs(id);
        expect({ id, drawn }).toEqual({ id, drawn: [`model:furniture/${id}.glb`] });
      }
      expect(drawnAs("desk#chair")).toEqual(["model:furniture/desk.glb"]);
      expect(mockDevice.downloads).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "A4 CAT1(일곱의 해시가 앱 파일과 같음)을 받은 뒤 처음 배치를 그리면 일곱 모두 앱에 든 모델이고 모델 요청이 0건이다",
    async () => {
      receiveCatalog(cat1());
      await renderLobby(DEF);
      for (const id of SEVEN) expect({ id, drawn: drawnAs(id) }).toEqual({ id, drawn: [`model:furniture/${id}.glb`] });
      expect(modelDownloads()).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "A6 (05 결정 2) 옷장 모델 해시가 W2인 목록이면 받을 때까지 앱에 든 옷장 모델을 그리고(상자가 아님), <W2>.glb를 받으면 기기에 둔 그 파일로 바꿔 그린다",
    async () => {
      receiveCatalog(cat1((item) => (item.id === "wardrobe" ? { ...item, assets: { model: ref(W2, "glb"), icon: (item.assets as { icon: unknown }).icon } } : item)));
      mockDevice.replies.set(filePath(W2, "glb"), "hold");
      await renderLobby(DEF);
      expect(drawnAs("wardrobe")).toEqual(["model:furniture/wardrobe.glb"]);
      expect(modelDownloads()).toEqual([filePath(W2, "glb")]);

      await finishDownload(W2, "glb");
      expect(mockDevice.writes.map((uri) => uri.slice(uri.lastIndexOf("/") + 1))).toEqual([`${W2}.glb`]);
      expect(drawnAs("wardrobe")).toEqual([`model:${mockDevice.writes[0]}`]);
      expect(modelDownloads()).toEqual([filePath(W2, "glb")]);
    },
    SLOW_TEST_MS
  );
});

describe("[spec] 090-② C·D: 모델 받기와 자리 표시 상자(3D)", () => {
  test(
    "C1·C9·D1 CAT1·침대가 놓인 배치: 받는 동안 다른 가구는 그대로 그려지고 침대 자리에는 그 가구의 대체 상자(같은 모양)가 침대 자리에 있으며, 받으면 같은 화면에서 침대 모델(기기 파일)로 바뀐다",
    async () => {
      receiveCatalog(cat1());
      mockDevice.replies.set(filePath(B, "glb"), "hold");
      await renderLobby(BED_ROOM);

      expect(modelDownloads()).toEqual([filePath(B, "glb")]);
      for (const id of SEVEN) expect({ id, drawn: drawnAs(id) }).toEqual({ id, drawn: [`model:furniture/${id}.glb`] });
      expect(drawnAs("bed-1")).toEqual(["placeholder"]);
      // 05 결정 4: 자리 표시 상자는 지금의 대체 상자(모델을 불러오기 전에 보이던 그 가구의 대체 모양)와 같은 모양이고, 침대 자리에 있다
      const box = placeholderOf("bed-1");
      expect(meshGeometries(box)).toEqual(meshGeometries(fallbackOf("bed-1")));
      const place = placementOf(BED_ROOM, "bed-1");
      expect(worldXZ(box)).toEqual({ x: Math.round(place.x * 1000) / 1000, z: Math.round(place.z * 1000) / 1000 });

      await finishDownload(B, "glb");
      expect(drawnAs("bed-1")).toEqual([`model:${mockDevice.writes[0]}`]);
      expect(mockDevice.writes.map((uri) => uri.slice(uri.lastIndexOf("/") + 1))).toEqual([`${B}.glb`]);
    },
    SLOW_TEST_MS
  );

  test(
    "C2·C3 침대가 보관함에만 있으면 홈에서 모델을 받지 않고, 꾸미기에서 보관함의 침대를 꺼내면 그때 <B>.glb를 요청한다",
    async () => {
      const X = fresh("c3-bed");
      receiveCatalog(cat1(bedModel(X)));
      mockDevice.replies.set(filePath(X, "glb"), "hold");
      await renderLobby(BED_STORED);
      expect(modelDownloads()).toEqual([]);

      await enterEdit();
      expect(modelDownloads()).toEqual([]);
      await takeOut("침대");
      await settle();
      expect(itemIn(edit().layout, "bed-1")?.floor).toBeDefined();
      expect(modelDownloads()).toEqual([filePath(X, "glb")]);
    },
    SLOW_TEST_MS
  );

  test(
    "C4 홈쇼핑 '바로 놓기'(그 가구를 꺼낸 채 꾸미기를 염)면 <해시>.glb를 요청한다",
    async () => {
      const X = fresh("c4-bed");
      receiveCatalog(cat1(bedModel(X)));
      mockDevice.replies.set(filePath(X, "glb"), "hold");
      await renderLobby(BED_STORED);
      expect(modelDownloads()).toEqual([]);

      await act(async () => {
        host.setPlace!({ key: 1, itemId: "bed-1", type: "bed" });
      });
      await settle();
      expect(lifted()).toBe("bed-1");
      expect(modelDownloads()).toEqual([filePath(X, "glb")]);
    },
    SLOW_TEST_MS
  );

  test(
    "C8 받기에 실패하면 자리 표시 상자가 남고 다시 요청하지 않으며, 홈이 다시 보이면(실패 기록 지움) 다시 요청해 받으면 모델로 바뀐다",
    async () => {
      const X = fresh("c8-bed");
      receiveCatalog(cat1(bedModel(X)));
      mockDevice.replies.set(filePath(X, "glb"), "fail");
      await renderLobby(BED_ROOM);
      expect(drawnAs("bed-1")).toEqual(["placeholder"]);
      await settle();
      expect(modelDownloads()).toEqual([filePath(X, "glb")]);

      serve([X, "glb"]);
      await act(async () => {
        retryFailedItemFiles();
      });
      await settle();
      expect(modelDownloads()).toEqual([filePath(X, "glb"), filePath(X, "glb")]);
      expect(drawnAs("bed-1")).toEqual([`model:${mockDevice.writes[0]}`]);
    },
    SLOW_TEST_MS
  );

  test(
    "D6 (05 메인 세션 세부) 같은 가구가 방에 둘이어도 그 모델 파일은 한 번만 요청하고, 받으면 둘 다 모델로 그린다",
    async () => {
      const T2 = fresh("two-beds");
      receiveCatalog(cat1(bedModel(T2)));
      mockDevice.replies.set(filePath(T2, "glb"), "hold");
      await renderLobby(TWO_BEDS);
      expect(drawnAs("bed-1")).toEqual(["placeholder"]);
      expect(drawnAs("bed-2")).toEqual(["placeholder"]);
      expect(modelDownloads()).toEqual([filePath(T2, "glb")]);

      await finishDownload(T2, "glb");
      expect(drawnAs("bed-1")).toEqual([`model:${mockDevice.writes[0]}`]);
      expect(drawnAs("bed-2")).toEqual([`model:${mockDevice.writes[0]}`]);
      expect(modelDownloads()).toEqual([filePath(T2, "glb")]);
    },
    SLOW_TEST_MS
  );

  test(
    "D2·D3 자리 표시 상자인 침대도 칸을 차지하고(옷장을 겹치게 옮긴 결과가 모델일 때와 같다) 그 자리를 누르면 침대가 골라진다(모델일 때와 같다)",
    async () => {
      const D = fresh("d2-bed");
      receiveCatalog(cat1(bedModel(D)));
      mockDevice.replies.set(filePath(D, "glb"), "hold");
      await renderLobby(BED_ROOM);
      expect(drawnAs("bed-1")).toEqual(["placeholder"]);

      const attempt = async () => {
        await enterEdit();
        const tapped = await tapAt(toScreen(BED_AT.x, 0.9, BED_AT.z));
        if (lifted()) await tapAt(toScreen(BED_AT.x, 0.9, BED_AT.z));
        await dragPiece("wardrobe", WARDROBE_AT, BED_AT);
        const result = { tapped: tapped?.piece ?? null, wardrobe: itemIn(edit().layout, "wardrobe"), marks: edit().marks, lifted: lifted() };
        await pressButton("취소");
        return result;
      };
      const withBox = await attempt();
      expect(withBox.tapped).toBe("bed-1");

      await finishDownload(D, "glb");
      expect(drawnAs("bed-1")).toEqual([`model:${mockDevice.writes[0]}`]);
      const withModel = await attempt();
      expect(withBox).toEqual(withModel);
    },
    SLOW_TEST_MS
  );

  test(
    "D4 자리 표시 상자인 침대를 빈 자리로 옮기고 '완료'하면 저장 본문에 옮긴 자리이고, 상자도 옮긴 자리에 있다",
    async () => {
      const D = fresh("d4-bed");
      receiveCatalog(cat1(bedModel(D)));
      mockDevice.replies.set(filePath(D, "glb"), "hold");
      const { onSaveLayout } = await renderLobby(BED_ROOM);
      await enterEdit();
      // 옮길 곳: 지금 꾸미기 규칙(isPlaceableLayout)으로 놓을 수 있는 첫 빈 자리(침대 2×3이 칸에 맞는 가운데 좌표)
      const candidates: FloorPoint[] = [
        { x: 6, z: 4.5 },
        { x: 6, z: 6.5 },
        { x: 3, z: 1.5 },
        { x: 6, z: 1.5 },
        { x: 2, z: 3.5 }
      ];
      const to = candidates.find((spot) =>
        isPlaceableLayout(layoutOf([...DEFAULT_LOBBY_LAYOUT.items, floor("bed-1", "bed", spot.x, spot.z, 0)]))
      )!;
      expect(to).toBeDefined();
      // 골라서(띄워서) 끌고, 골라진 침대 자신을 다시 톡해 내려놓는다(다른 꾸미기 테스트와 같은 조작)
      await pointer("down", hit(BED_AT, "bed-1"), 200, 300);
      await pointer("up", null, 200, 300);
      await frames();
      expect(lifted()).toBe("bed-1");
      await dragPiece("bed-1", BED_AT, to);
      expect(itemIn(edit().layout, "bed-1")?.floor).toEqual({ x: to.x, z: to.z, facing: 0 });
      await pointer("down", hit(to, "bed-1"), 200, 300);
      await pointer("up", null, 200, 300);
      await frames();
      expect(lifted()).toBeNull();
      await pressButton("완료");
      await settle();

      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      const saved = onSaveLayout.mock.calls[0][0];
      expect(itemIn(saved, "bed-1")?.floor).toEqual({ x: to.x, z: to.z, facing: 0 });
      expect(drawnAs("bed-1")).toEqual(["placeholder"]);
      const place = placementOf(saved, "bed-1");
      expect(worldXZ(placeholderOf("bed-1"))).toEqual({ x: Math.round(place.x * 1000) / 1000, z: Math.round(place.z * 1000) / 1000 });
    },
    SLOW_TEST_MS
  );
});

describe("[spec] 090-② D5·H: 서버에서 더한 가구가 방에 나온다(3D)", () => {
  test(
    "D5·H3 방에 놓인 QA 소파는 모델을 받지 못하면 그 가구의 대체 상자가 소파 자리에 있고 골라지며, 받으면 소파 모델로 그린다",
    async () => {
      const X = fresh("d5-sofa");
      receiveCatalog(cat1((item) => (item.id === "qaSofa" ? { ...item, assets: { model: ref(X, "glb"), icon: ref(SI, "png") } } : item)));
      mockDevice.replies.set(filePath(X, "glb"), "fail");
      await renderLobby(SOFA_ROOM);
      expect(drawnAs("qaSofa-1")).toEqual(["placeholder"]);
      const box = placeholderOf("qaSofa-1");
      expect(meshGeometries(box)).toEqual(meshGeometries(fallbackOf("qaSofa-1")));
      const place = placementOf(SOFA_ROOM, "qaSofa-1");
      expect(worldXZ(box)).toEqual({ x: Math.round(place.x * 1000) / 1000, z: Math.round(place.z * 1000) / 1000 });

      await enterEdit();
      const tapped = await tapAt(toScreen(SOFA_AT.x, 0.6, SOFA_AT.z));
      expect(tapped?.piece).toBe("qaSofa-1");
      await pressButton("취소");

      serve([X, "glb"]);
      await act(async () => {
        retryFailedItemFiles();
      });
      await settle();
      expect(drawnAs("qaSofa-1")).toEqual([`model:${mockDevice.writes[mockDevice.writes.length - 1]}`]);
    },
    SLOW_TEST_MS
  );

  test(
    "H4 보관함의 QA 시계(벽 가구)를 꺼내면 벽에 걸리고 <C>.glb를 요청한다",
    async () => {
      const C2 = fresh("h4-clock");
      receiveCatalog(cat1((item) => (item.id === "qaClock" ? { ...item, assets: { model: ref(C2, "glb"), icon: ref(CI, "png") } } : item)));
      mockDevice.replies.set(filePath(C2, "glb"), "hold");
      await renderLobby(layoutOf(DEFAULT_LOBBY_LAYOUT.items, [{ id: "qaClock-1", type: "qaClock" }]));
      await enterEdit();
      await takeOut("QA 시계");
      await settle();
      expect(itemIn(edit().layout, "qaClock-1")?.wall).toBeDefined();
      expect(modelDownloads()).toEqual([filePath(C2, "glb")]);
    },
    SLOW_TEST_MS
  );

  test(
    "H5 보관함의 QA 머그(탁상 소품)를 꺼내면 받침 가구(책상) 자리에 올라가고 <M>.glb를 요청한다",
    async () => {
      const M2 = fresh("h5-mug");
      receiveCatalog(cat1((item) => (item.id === "qaMug" ? { ...item, assets: { model: ref(M2, "glb"), icon: ref(MI, "png") } } : item)));
      mockDevice.replies.set(filePath(M2, "glb"), "hold");
      await renderLobby(layoutOf(DEFAULT_LOBBY_LAYOUT.items, [{ id: "qaMug-1", type: "qaMug" }]));
      await enterEdit();
      await takeOut("QA 머그");
      await settle();
      expect(itemIn(edit().layout, "qaMug-1")?.on?.parent).toBe("desk");
      expect(modelDownloads()).toEqual([filePath(M2, "glb")]);
    },
    SLOW_TEST_MS
  );
});
