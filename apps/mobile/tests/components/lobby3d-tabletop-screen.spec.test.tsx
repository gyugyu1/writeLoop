// [spec] qa 테스트(작업 066-④ 탁상형(책상 위 소품), 새 기능, 모바일): 3D 화면에서 스탠드의 누르기 판정, 책상 따라가기·띄우기, 자리 표시 높이,
// 끌기·돌리기·치우기·꺼내기와 '완료'로 보내는 배치, 3D를 다시 만들지 않는 치우기·꺼내기, 불빛 없음.
// 기대값은 시나리오(private 작업 폴더 066/05-책상-위-소품/03-qa-scenarios.md)와 결정(같은 폴더 04-main-decision.md)에서만 가져온다.
// 시나리오 번호: B1·B2·B3·B4·B10·K5·B12(누르기), G11·S4(3D), D7·D8·D9(처음 배치로), B5·S3·R3·R4·R5(돌리기·치우기), S1·K1(끌기·표시),
// F2·F3·F5·F6(책상 따라가기·띄우기), T7·T8(꺼내기). 편집기 단위의 나머지는 tests/lib/lobby3d-tabletop.spec.test.ts가 본다.
// 스탠드를 직접 골랐을 때 뜨는지는 명세가 정하지 않아(시나리오 U3) 스탠드를 고른 뒤에는 높이를 보지 않고 바닥 자리만 본다.
// 어떻게 보나(069 재현 테스트 lobby3d-edit-store-no-rebuild.spec.test.tsx와 같은 틀. 구현 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen)과 3D 그리기(Lobby3dCanvas)는 진짜를 쓰고, Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다.
// - 가구 묶음은 glb 불러오기만 가짜(모델 이름마다 0.8칸 상자, userData.fakeModel)다. 가구 묶음 모델은 누르기 판정을 받지 않으므로,
//   누르기 판정은 3D 그리기의 대체 상자(카탈로그 크기: 스탠드 0.418×0.88×0.475)와 넓힌 판정이 받는다. 그래서 0.8칸 판정과 모델이 구별된다.
// - "누르기 판정": 3D 그리기의 터치 받는 View에 화면 좌표를 넣었을 때 3D 그리기가 화면에 넘기는 결과.
// - 3D 자리: 3D 그리기가 userData.furnitureOf에 가구 id를 적은 물체(대체 모양·가구 묶음 모델)의 자리.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type FurnitureItem, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
const mockGltf: { value: unknown } = { value: null };
const mockHits: { phase: string; hit: PointerHit | null }[] = [];
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
/** 3D 그리기가 마지막 프레임에 화면에 넘긴 이름표 화면 좌표. */
const mockLabels: { value: Record<MarkId, { x: number; y: number }> | null } = { value: null };

// three(0.187)는 ES 모듈만 있어 Jest의 require로는 읽지 못하므로 Node의 require로 읽는다(068 재현 테스트와 같다).
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
    useLoader: () => mockGltf.value
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
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {} }));
jest.mock("@/assets/models/lobby-furniture.glb", () => "lobby-furniture.glb");
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
// 3D 그리기는 진짜를 그리되, 화면에 넘기는 누르기 결과와 이름표 화면 좌표를 적어 둔다
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
        },
        onOverlayFrame: (bubble: { x: number; y: number }, labels: Record<MarkId, { x: number; y: number }>) => {
          mockLabels.value = JSON.parse(JSON.stringify(labels)) as Record<MarkId, { x: number; y: number }>;
          props.onOverlayFrame?.(bubble, labels);
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


// ---------- 배치 ----------

type Facing = 0 | 1 | 2 | 3;
const floor = (id: string, type: string, x: number, z: number, facing: Facing): FurnitureItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): FurnitureItem => ({ id, type, wall: { wall: side, along } });
const lampItem = (id: string, slot: number, facing: Facing = 0): FurnitureItem => ({ id, type: "lamp", on: { parent: "desk", slot, facing } }) as FurnitureItem;

/** 스탠드 전 처음 배치 여섯 개(시나리오의 P0). */
const P0_ITEMS: FurnitureItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8)
];
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const layoutOf = (items: FurnitureItem[], stored: StoredItem[] = []): LobbyLayout => copy(makeLayout(items, stored));
const P0 = layoutOf(P0_ITEMS);
/** 시나리오의 L(k, f). */
const L = (slot: number, facing: Facing = 0) => layoutOf([...P0_ITEMS, lampItem("lamp", slot, facing)]);
/** 새 처음 배치 N0(스탠드가 책상 자리 0). */
const N0 = L(0);
/** P0에 보관함 스탠드. */
const P0_LAMP_STORED = layoutOf(P0_ITEMS, [{ id: "lamp", type: "lamp" }]);

/** 책상 윗면 높이와 책상 자리 0·1·2(가구 기준 왼쪽부터) 가운데. */
const TOP = 1.292;
const SLOT = [
  { x: 0.5, z: 5.5 },
  { x: 1.5, z: 5.5 },
  { x: 2.5, z: 5.5 }
];
const DESK_AT = { x: 1.5, z: 5.5 };
const DESK_PRESS_Y = 0.6;
/** 스탠드 모델 안(가운데 위)을 누르는 점. */
const LAMP_PRESS = { x: 0.5, y: TOP + 0.4, z: 5.5 };
const EMPTY_FLOOR = { x: 5.5, z: 3.5 };
/** 편집 표시 초록(놓을 수 있음). */
const MARK_GREEN = 0x8fe3b0;
const LAMP_PIECE = furnitureType("lamp").model.piece;

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SLOW_TEST_MS = 30_000;

// ---------- 가짜 glb ----------
// 069 테스트와 같다: 모델 이름마다 0.8칸 상자 하나(userData.fakeModel = 모델 이름). 가구 묶음 모델은 누르기 판정을 받지 않고,
// 누르기 판정은 3D 그리기의 대체 상자(카탈로그의 칸에 맞춘 크기)와 넓힌 판정이 받는다.

function fakeFurnitureGltf() {
  const scene = new THREE.Group();
  (scene as unknown as { getObjectByName: (name: string) => THREE.Object3D | undefined }).getObjectByName = (name: string) => {
    if (name === "windowView") return undefined;
    const group = new THREE.Group();
    group.name = name;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial());
    mesh.position.y = 0.4;
    mesh.userData.fakeModel = name;
    group.add(mesh);
    return group;
  };
  return { scene };
}

// ---------- 도우미(069 테스트 lobby3d-edit-store-no-rebuild.spec.test.tsx와 같은 틀) ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
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

/** 장면 점의 화면 좌표. 화면 안이어야 한다. */
function toScreen(x: number, y: number, z: number) {
  camera().updateMatrixWorld();
  const p = new THREE.Vector3(x, y, z).project(camera());
  const { width, height } = mockThree.size;
  const at = { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
  expect(at.x > 0 && at.x < width && at.y > 0 && at.y < height && p.z <= 1 && p.z >= -1).toBe(true);
  return at;
}

function rayAt(at: { x: number; y: number }) {
  const { width, height } = mockThree.size;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((at.x / width) * 2 - 1, -(at.y / height) * 2 + 1), camera());
  return raycaster.ray;
}

function floorUnder(at: { x: number; y: number }) {
  const hit = new THREE.Vector3();
  expect(rayAt(at).intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)).not.toBeNull();
  return { x: hit.x, z: hit.z };
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

async function touch(handler: "onResponderGrant" | "onResponderMove" | "onResponderRelease" | "onResponderTerminate", at: { x: number; y: number }) {
  const view = touchView();
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>)[handler]({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
}

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

/** 누르기 시작과 취소만 넣어, 누른 곳의 누르기 결과를 본다(걷기·고르기·끌기가 끝나지 않는다). */
async function probeAt(at: { x: number; y: number }): Promise<PointerHit | null> {
  const before = mockHits.length;
  await touch("onResponderGrant", at);
  const down = mockHits.slice(before).find((entry) => entry.phase === "down");
  await touch("onResponderTerminate", at);
  expect(down).toBeDefined();
  return down!.hit;
}

function edit() {
  const value = mockCanvas.props?.edit;
  expect(value).toBeTruthy();
  return value!;
}

function itemIn(layout: LobbyLayout, id: string) {
  return layout.items.find((item) => item.id === id);
}

function storedOf(layout: LobbyLayout): StoredItem[] {
  return (layout as { stored?: StoredItem[] }).stored ?? [];
}

/** 조상까지 모두 visible이고 지금 장면에 붙어 있는지. */
function isShown(object: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = object;
  while (o) {
    if (!o.visible) return false;
    if (o === scene()) return true;
    o = o.parent;
  }
  return false;
}

/** 지금 장면에 있는 모든 메시(보이지 않는 것 포함). */
function meshesInScene(): Set<THREE.Object3D> {
  syncScene();
  const all = new Set<THREE.Object3D>();
  scene().traverse((object) => {
    if (object instanceof THREE.Mesh) all.add(object);
  });
  return all;
}

/** before에 있던 메시 가운데 지금 장면에 없는 것의 수(다시 만들어져 다른 메시로 바뀐 것). */
function replacedCount(before: Set<THREE.Object3D>): number {
  const now = meshesInScene();
  return [...before].filter((mesh) => !now.has(mesh)).length;
}

function fakeModels(model: string): THREE.Mesh[] {
  syncScene();
  const found: THREE.Mesh[] = [];
  scene().traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.fakeModel === model) found.push(object);
  });
  return found;
}

function visibleFakeModels(model: string): THREE.Mesh[] {
  return fakeModels(model).filter((mesh) => isShown(mesh));
}

/** 그 가구의 3D 물체(대체 모양과 가구 묶음 모델. 3D 그리기가 furnitureOf에 가구 id를 적는다). */
function furnitureObjects(id: string): THREE.Object3D[] {
  syncScene();
  const found: THREE.Object3D[] = [];
  scene().traverse((object) => {
    if (object.userData.furnitureOf === id) found.push(object);
  });
  expect(found.length).toBeGreaterThan(0);
  return found;
}

/** 그 가구의 3D 물체가 모두 바닥 점 (x, z)에 있다(y를 주면 높이도). */
function expectFurnitureAt(id: string, x: number, z: number, y?: number) {
  for (const object of furnitureObjects(id)) {
    expect(object.position.x).toBeCloseTo(x, 4);
    expect(object.position.z).toBeCloseTo(z, 4);
    if (y !== undefined) expect(object.position.y).toBeCloseTo(y, 4);
  }
}

function lightCount(): number {
  syncScene();
  let count = 0;
  scene().traverse((object) => {
    if (object instanceof THREE.Light) count += 1;
  });
  return count;
}

function LobbyHost({ loaded, onSave }: { loaded: LobbyLayout; onSave: (value: LobbyLayout) => Promise<LobbyLayout> }) {
  const [layout, setLayout] = useState(loaded);
  const save = async (value: LobbyLayout) => {
    const saved = await onSave(value);
    setLayout(saved);
    return saved;
  };
  return <Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={save} />;
}

function resetMocks() {
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockHits.length = 0;
  mockCanvas.props = null;
  mockLabels.value = null;
  mockGltf.value = fakeFurnitureGltf();
}

async function renderLobby(loaded: LobbyLayout) {
  const onSaveLayout = jest.fn(async (value: LobbyLayout) => copy(value));
  await render(<LobbyHost loaded={loaded} onSave={onSaveLayout} />);
  await flushAsync();
  await frames();
  return { onSaveLayout };
}

async function unmountLobby() {
  await screen.unmount();
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  resetMocks();
}

async function pressText(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
  await frames();
}

async function enterEdit() {
  await pressText("꾸미기");
  await frames();
}

/**
 * 보관함 판의 '보관함' 묶음 줄에 있는 그 글. 066-⑤ 04 결정 1의 1: 판에 늘 보이는 '가구 더하기' 줄
 * (접근성 이름 "<가구 이름> 더하기", 같은 폴더 결정 3)에도 같은 이름이 있어, 찾는 범위를 '보관함' 묶음 안으로 좁힌다.
 */
function storageRowText(name: string) {
  const inAddRow = (node: ReturnType<typeof screen.getByText>) => {
    for (let n: ReturnType<typeof screen.getByText> | null = node; n; n = n.parent) {
      const label = (n.props as { accessibilityLabel?: unknown }).accessibilityLabel;
      if (typeof label === "string" && label.endsWith(" 더하기")) return true;
    }
    return false;
  };
  const found = screen.getAllByText(name).filter((node) => !inAddRow(node));
  expect(found).toHaveLength(1);
  return found[0];
}

async function takeOutLamp() {
  await fireEvent.press(screen.getByRole("button", { name: /보관함/ }));
  await flushAsync();
  await fireEvent.press(storageRowText("스탠드"));
  await flushAsync();
  await frames();
}

async function selectLamp() {
  const hit = await tapAt(toScreen(LAMP_PRESS.x, LAMP_PRESS.y, LAMP_PRESS.z));
  expect(hit?.piece).toBe("lamp");
  expect(edit().handle).toBe("lamp");
}

async function selectDesk() {
  const hit = await tapAt(toScreen(DESK_AT.x, DESK_PRESS_Y, DESK_AT.z));
  expect(hit?.piece).toBe("desk");
  expect(edit().lifted).toBe("desk");
}

async function deselect() {
  await tapAt(toScreen(EMPTY_FLOOR.x, 0, EMPTY_FLOOR.z));
  expect(edit().lifted).toBeNull();
}

/** 저장(onSaveLayout)에 한 번 보낸 배치. */
function savedOnce(onSaveLayout: jest.Mock): LobbyLayout {
  expect(onSaveLayout).toHaveBeenCalledTimes(1);
  return onSaveLayout.mock.calls[0][0] as LobbyLayout;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  resetMocks();
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
});

// ---------- 5. 고르기(누르기 판정) ----------

describe("[spec] 066-④ 명세 5·6: 스탠드 누르기 판정", () => {
  test(
    "B1·B2 꾸미기에서 스탠드 모델 안 (0.5, 1.692, 5.5)과, 광선이 모델에 닿지 않지만 0.8칸 판정 안인 점(가로 ±0.3, 깊이 ±0.3)을 누르면 스탠드다",
    async () => {
      await renderLobby(N0);
      await enterEdit();
      const b = furnitureType("lamp").model.box;
      const model = new THREE.Box3(new THREE.Vector3(0.5 - b.width / 2, TOP, 5.5 - b.depth / 2), new THREE.Vector3(0.5 + b.width / 2, TOP + b.height, 5.5 + b.depth / 2));
      const b1 = await probeAt(toScreen(LAMP_PRESS.x, LAMP_PRESS.y, LAMP_PRESS.z));
      expect(b1?.piece).toBe("lamp");
      // 가운데에서 가로 0.3(왼쪽·오른쪽), 깊이 0.3(앞쪽 아래·뒤쪽 위). 모두 모델(카탈로그 크기) 밖이고 0.8칸 판정(가운데에서 0.4) 안이다
      const widened = [
        { x: 0.8, y: TOP + 0.3, z: 5.5 },
        { x: 0.2, y: TOP + 0.3, z: 5.5 },
        { x: 0.5, y: TOP + 0.05, z: 5.8 },
        { x: 0.5, y: TOP + 0.85, z: 5.2 }
      ];
      for (const p of widened) {
        const at = toScreen(p.x, p.y, p.z);
        // 전제: 이 광선은 스탠드 모델에 닿지 않는다(넓힌 판정이 없으면 스탠드가 골라지지 않는 점이다)
        expect({ at: p, hitsModel: rayAt(at).intersectsBox(model) }).toEqual({ at: p, hitsModel: false });
        const hit = await probeAt(at);
        expect({ at: p, piece: hit?.piece ?? null }).toEqual({ at: p, piece: "lamp" });
      }
    },
    SLOW_TEST_MS
  );

  test(
    "B3 누른 점의 광선이 스탠드 판정과 책상을 함께 지나는 (0.5, 1.30, 5.85)를 누르면 스탠드다",
    async () => {
      await renderLobby(N0);
      await enterEdit();
      const at = toScreen(0.5, 1.3, 5.85);
      // 전제: 이 광선이 책상(칸 x 0..3, z 5..6, 높이 0..1.292)도 지난다
      expect(rayAt(at).intersectsBox(new THREE.Box3(new THREE.Vector3(0, 0, 5), new THREE.Vector3(3, TOP, 6)))).toBe(true);
      const hit = await probeAt(at);
      expect(hit?.piece).toBe("lamp");
    },
    SLOW_TEST_MS
  );

  test(
    "B4 꾸미기에서 책상 윗면의 자리 1·2 가운데 (1.5, 1.30, 5.5)·(2.5, 1.30, 5.5)를 누르면 책상이다",
    async () => {
      await renderLobby(N0);
      await enterEdit();
      for (const p of [SLOT[1], SLOT[2]]) {
        const hit = await probeAt(toScreen(p.x, 1.3, p.z));
        expect({ at: p, piece: hit?.piece ?? null }).toEqual({ at: p, piece: "desk" });
      }
    },
    SLOW_TEST_MS
  );

  test(
    "B10·K5 꾸미기 밖 로비에서 스탠드 모델·넓힌 판정 자리와 책상 자리 2 위를 누르면 책상 장소(desk)를 누른 것이다",
    async () => {
      await renderLobby(N0);
      for (const p of [LAMP_PRESS, { x: 0.8, y: TOP + 0.3, z: 5.5 }, { x: 0.5, y: TOP + 0.3, z: 5.8 }, { x: 2.5, y: 1.3, z: 5.5 }]) {
        const hit = await probeAt(toScreen(p.x, p.y, p.z));
        expect({ at: p, mark: hit?.mark ?? null, hasPoint: hit?.point != null }).toEqual({ at: p, mark: "desk", hasPoint: true });
      }
    },
    SLOW_TEST_MS
  );

  test(
    "B12 보관함의 스탠드는 꾸미기 밖에서도 안에서도 보이지 않고, 스탠드 자리를 누르면 꾸미기 밖은 책상 장소, 안은 책상이다",
    async () => {
      await renderLobby(P0_LAMP_STORED);
      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(0);
      const outside = await probeAt(toScreen(LAMP_PRESS.x, LAMP_PRESS.y, LAMP_PRESS.z));
      expect(outside?.mark).toBe("desk");

      await enterEdit();
      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(0);
      const inside = await probeAt(toScreen(LAMP_PRESS.x, LAMP_PRESS.y, LAMP_PRESS.z));
      expect(inside?.piece).toBe("desk");
    },
    SLOW_TEST_MS
  );
});

// ---------- 4. 3D 자리·불빛 ----------

describe("[spec] 066-④ 명세 2·4·5: 스탠드의 3D", () => {
  test(
    "G11 스탠드가 있는 N0과 없는 P0의 장면 조명 수가 같다(스탠드는 불빛을 내지 않는다)",
    async () => {
      await renderLobby(P0);
      const without = lightCount();
      await unmountLobby();

      await renderLobby(N0);

      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(1);
      expect(lightCount()).toBe(without);
    },
    SLOW_TEST_MS
  );

  test(
    "S4 저장한 배치 L(2, 0)으로 열면 스탠드가 (2.5, 1.292, 5.5)에 보인다",
    async () => {
      await renderLobby(L(2));
      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(1);
      expectFurnitureAt("lamp", 2.5, 5.5, TOP);
    },
    SLOW_TEST_MS
  );
});

// ---------- 2. 처음 배치 ----------

describe("[spec] 066-④ 명세 4: 스탠드 없이 저장한 배치와 '처음 배치로'", () => {
  test(
    "D7·D8·D9 P0으로 열면 스탠드가 없고, '꾸미기' → '처음 배치로'면 스탠드가 (0.5, 1.292, 5.5)에 보이며, '완료'하면 보낸 배치에 스탠드가 책상 자리 0으로 있다",
    async () => {
      const { onSaveLayout } = await renderLobby(P0);
      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(0);

      await enterEdit();
      await pressButton("처음 배치로");

      expect(itemIn(edit().layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(1);
      expectFurnitureAt("lamp", 0.5, 5.5, TOP);

      await pressButton("완료");

      expect(itemIn(savedOnce(onSaveLayout), "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
    },
    SLOW_TEST_MS
  );
});

// ---------- 6. 돌리기·치우기 ----------

describe("[spec] 066-④ 명세 6: 화면에서 돌리기·치우기", () => {
  test(
    "B5·S3 스탠드를 누르면 '돌리기'·'치우기'가 보이고, 한 번 돌려 '완료'하면 보낸 배치의 스탠드 방향이 1이다",
    async () => {
      const { onSaveLayout } = await renderLobby(N0);
      await enterEdit();
      await selectLamp();
      expect(screen.getByRole("button", { name: "돌리기" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "치우기" })).toBeTruthy();

      await pressButton("돌리기");
      await pressButton("완료");

      expect(itemIn(savedOnce(onSaveLayout), "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 1 } });
    },
    SLOW_TEST_MS
  );

  test(
    "R3·R4·R5 스탠드를 치우면 3D를 다시 만들지 않고 스탠드만 보이지 않게 되며 '보관함 1'이고, '완료'하면 보낸 배치의 보관함에 { id: lamp, type: lamp }가 있고 방에는 없다",
    async () => {
      const { onSaveLayout } = await renderLobby(N0);
      await enterEdit();
      const before = meshesInScene();
      await selectLamp();

      await pressButton("치우기");

      expect(replacedCount(before)).toBe(0);
      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(0);
      expect(fakeModels(LAMP_PIECE).length).toBeGreaterThan(0);
      expect(screen.getByText("보관함 1")).toBeTruthy();

      await pressButton("완료");

      const sent = savedOnce(onSaveLayout);
      expect(itemIn(sent, "lamp")).toBeUndefined();
      expect(storedOf(sent)).toEqual([{ id: "lamp", type: "lamp" }]);
    },
    SLOW_TEST_MS
  );
});

// ---------- 7. 끌기와 자리 표시 ----------

describe("[spec] 066-④ 명세 6: 화면에서 끌기와 자리 표시", () => {
  test(
    "S1 스탠드를 눌러 손가락을 오른쪽으로 2칸 끌고 놓은 뒤 '완료'하면 보낸 배치의 스탠드가 책상 자리 2다",
    async () => {
      const { onSaveLayout } = await renderLobby(N0);
      await enterEdit();
      const pressAt = toScreen(LAMP_PRESS.x, LAMP_PRESS.y, LAMP_PRESS.z);
      const pressFloor = floorUnder(pressAt);
      const moveAt = toScreen(pressFloor.x + 2, 0, pressFloor.z);

      await touch("onResponderGrant", pressAt);
      await touch("onResponderMove", moveAt);
      await touch("onResponderRelease", moveAt);
      await flushAsync();
      await frames();

      expect(itemIn(edit().layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 2, facing: 0 } });
      expectFurnitureAt("lamp", 2.5, 5.5);
      await pressButton("완료");
      expect(itemIn(savedOnce(onSaveLayout), "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 2, facing: 0 } });
    },
    SLOW_TEST_MS
  );

  test(
    "K1 스탠드를 고르면 책상 윗면 높이에 그 칸(가운데 (0.5, 5.5)) 초록 표시가 칠해진다",
    async () => {
      await renderLobby(N0);
      await enterEdit();
      await selectLamp();

      syncScene();
      const greens: THREE.Mesh[] = [];
      scene().traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const material = object.material as THREE.MeshBasicMaterial;
        if (material?.color?.getHex?.() === MARK_GREEN && object.geometry instanceof THREE.ShapeGeometry) greens.push(object);
      });
      expect(greens).toHaveLength(1);
      expect(greens[0].position.x).toBeCloseTo(0.5, 4);
      expect(greens[0].position.z).toBeCloseTo(5.5, 4);
      expect(greens[0].position.y).toBeGreaterThanOrEqual(TOP);
      expect(greens[0].position.y).toBeLessThan(TOP + 0.1);
    },
    SLOW_TEST_MS
  );
});

// ---------- 8. 책상을 옮기고 돌리고 띄울 때 ----------

describe("[spec] 066-④ 명세 5: 책상을 따라가는 스탠드(3D)", () => {
  test(
    "F2 책상을 1칸 앞으로 끄는 도중(떼기 전) 프레임에서 스탠드가 책상의 지금 자리 0 (0.5, 6.5)에 있다",
    async () => {
      await renderLobby(N0);
      await enterEdit();
      const pressAt = toScreen(DESK_AT.x, DESK_PRESS_Y, DESK_AT.z);
      const pressFloor = floorUnder(pressAt);
      const moveAt = toScreen(pressFloor.x, 0, pressFloor.z + 1);

      await touch("onResponderGrant", pressAt);
      await touch("onResponderMove", moveAt);
      await flushAsync();
      await frames(1);

      expect(itemIn(edit().layout, "desk")?.floor).toEqual({ x: 1.5, z: 6.5, facing: 0 });
      expectFurnitureAt("lamp", 0.5, 6.5);
      await touch("onResponderRelease", moveAt);
      await flushAsync();
    },
    SLOW_TEST_MS
  );

  test(
    "F3 책상을 골라 돌리면 스탠드가 (1.5, 6.5)로 옮겨지고 rotY π/2로 돈다",
    async () => {
      await renderLobby(N0);
      await enterEdit();
      await selectDesk();

      await pressButton("돌리기");

      expect(itemIn(edit().layout, "desk")?.floor).toEqual({ x: 1.5, z: 5.5, facing: 1 });
      expectFurnitureAt("lamp", 1.5, 6.5);
      for (const object of furnitureObjects("lamp")) {
        expect(Math.cos(object.rotation.y)).toBeCloseTo(0, 4);
        expect(Math.sin(object.rotation.y)).toBeCloseTo(1, 4);
      }
    },
    SLOW_TEST_MS
  );

  test(
    "F5·F6 책상을 고르면 같은 프레임에서 스탠드가 책상과 같은 만큼 뜨고(자리는 그대로), 고르기를 풀면 스탠드가 윗면 1.292로 내려앉는다",
    async () => {
      await renderLobby(N0);
      await enterEdit();

      await selectDesk();

      const deskY = furnitureObjects("desk").map((object) => object.position.y);
      const lampY = furnitureObjects("lamp").map((object) => object.position.y);
      expect(deskY[0]).toBeGreaterThan(0.3);
      for (const y of deskY) expect(y).toBeCloseTo(deskY[0], 6);
      for (const y of lampY) expect(y - TOP).toBeCloseTo(deskY[0], 6);
      expectFurnitureAt("lamp", 0.5, 5.5);

      await deselect();

      expectFurnitureAt("lamp", 0.5, 5.5, TOP);
    },
    SLOW_TEST_MS
  );
});

// ---------- 9. 보관함에서 꺼내기 ----------

describe("[spec] 066-④ 명세 7: 화면에서 꺼내기", () => {
  test(
    "T7·T8 보관함 스탠드를 꺼내면 3D를 다시 만들지 않고 스탠드가 책상 자리 0 (0.5, 5.5)에 보이며, '완료'하면 보낸 배치에 스탠드가 자리 0·방향 0이고 보관함이 없다",
    async () => {
      const { onSaveLayout } = await renderLobby(P0_LAMP_STORED);
      await enterEdit();
      const before = meshesInScene();

      await takeOutLamp();

      expect(itemIn(edit().layout, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
      expect(replacedCount(before)).toBe(0);
      expect(visibleFakeModels(LAMP_PIECE)).toHaveLength(1);
      expectFurnitureAt("lamp", 0.5, 5.5);

      await pressButton("완료");

      const sent = savedOnce(onSaveLayout);
      expect(itemIn(sent, "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
      expect("stored" in sent).toBe(false);
    },
    SLOW_TEST_MS
  );
});
