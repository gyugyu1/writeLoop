// [spec] qa 테스트(작업 066-⑤ 새 가구, 새 기능, 모바일): 진짜 3D 그리기(가짜 r3f, 가짜 glb)로 새 가구의 3D 모습·자리와,
// 받침 가구가 여럿일 때 꾸미기 고르기(누르기 판정)를 본다.
// 기대값은 시나리오(private 작업 폴더 066/06-새-가구/03-qa-scenarios.md의 P1~P5·P7, G1·G3~G7)에서만 가져온다.
// 같은 폴더 04-main-decision.md의 결정 3은 부르는 방법으로만 쓴다('가구 더하기' 줄의 접근성 이름 "<가구 이름> 더하기").
// 070(꾸미기 화면 버튼·보관함 아이콘) 03 결정으로 고친 것(찾는 방법만, 단언의 뜻은 그대로): '가구 더하기'가 개발 빌드에서만 보이는
// 보관함 줄의 탭이 되어, G3·G4는 개발 빌드(__DEV__ = true)에서 '가구 더하기' 탭을 누른 뒤 '침대' 칸(가구 이름 글을 가진 버튼)을 누른다.
// 어떻게 보나: ④ 판정 테스트(lobby3d-tabletop-pick-scope.spec.test.tsx)와 같은 틀이다. 가구 묶음은 모델 이름마다 0.8칸 가짜 상자이고
// 누르기를 받지 않는다. 누르기 판정은 3D 그리기의 대체 상자(카탈로그의 칸에 맞춘 크기)와 소품의 넓힌 판정(가로·깊이·높이 적어도 0.8칸)이 받는다.
// 누른 점마다 광선이 어느 상자를 먼저 지나는지를 먼저 단언해(전제), 시나리오가 말한 상황인지 확인한 뒤 결과를 본다.
// 상자는 카탈로그 값(fittedModel)과 시나리오 0절의 좌표 약속으로 계산한다.
// 고르기·끌기·치우기처럼 판정 자체를 보지 않는 조작은 3D 그리기가 화면에 넘기는 onPointer에 누르기 결과(piece)를 직접 넣어 한다.
// 시나리오와 다르게 만든 입력(보고 07-qa-tests.md에 적음): P5는 시나리오 배치 그대로 스탠드를 꺼낸 뒤, 책상 위 소품 셋을 치워
// 광선이 책상을 먼저 지나게 한다(책상 위 소품의 넓힌 판정이 광선 앞을 가려 "책상이 먼저"라는 시나리오의 전제를 만들 수 없어서).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { TABLETOP_PICK_MIN, fittedModel, furnitureType } from "@/lib/lobby3d/furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";


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




// ---------- 배치(시나리오 0절) ----------

type LayoutItem = LobbyLayout["items"][number];
type Facing = 0 | 1 | 2 | 3;
type Stored = { id: string; type: string };

const floor = (id: string, type: string, x: number, z: number, facing: Facing = 0): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });
const on = (id: string, type: string, parent: string, slot: number, facing: Facing = 0): LayoutItem => ({ id, type, on: { parent, slot, facing } }) as LayoutItem;

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const layoutOf = (items: LayoutItem[], stored: Stored[] = []): LobbyLayout => copy(makeLayout(items, stored));

const N0_ITEMS: LayoutItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8),
  on("lamp", "lamp", "desk", 0, 0)
];
const N0 = layoutOf(N0_ITEMS);
const LNS_ITEMS: LayoutItem[] = [...N0_ITEMS, floor("nightstand-1", "nightstand", 3.5, 5.5, 0), on("smallPlant-1", "smallPlant", "nightstand-1", 0)];
const LNS_STORED: Stored[] = [{ id: "wardrobe-1", type: "wardrobe" }];
/** L-NS: N0 + 협탁 (3.5, 5.5, 0) + 작은 화분 {nightstand-1, 0, 0}, 보관함 [wardrobe-1]. */
const LNS = layoutOf(LNS_ITEMS, LNS_STORED);
/** 협탁을 책상 바로 뒤 (1.5, 4.5, 0)에 둔 배치(P2~P5). */
const BEHIND = { x: 1.5, z: 4.5 };
const NS_BEHIND = floor("nightstand-1", "nightstand", BEHIND.x, BEHIND.z, 0);
const DESK_AT = { x: 1.5, z: 5.5 };
/** V-ALL: N0 + 새 일곱 종. */
const V_ALL_ITEMS: LayoutItem[] = [
  ...N0_ITEMS,
  floor("bed-1", "bed", 4, 5.5, 0),
  floor("nightstand-1", "nightstand", 6.5, 9.5, 0),
  floor("floorLamp-1", "floorLamp", 5.5, 9.5, 0),
  floor("plant-1", "plant", 7.5, 9.5, 0),
  wall("frame-1", "frame", "left", 7.5),
  on("smallPlant-1", "smallPlant", "nightstand-1", 0),
  on("books-1", "books", "desk", 1)
];

const DESK_TOP = 1.292;
const NS_TOP = 0.74;
const EMPTY_FLOOR = { x: 5.5, z: 3.5 };

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SLOW_TEST_MS = 30_000;

// ---------- 상자(카탈로그 값으로 계산, 방향 0만) ----------

/** 바닥 가구 (x, z, 방향 0)의 칸에 맞춘 모델 상자: 칸 뒤 끝에 붙인다(fittedModel.drawAt). */
function floorBox(type: string, at: FloorPoint) {
  const fit = fittedModel(furnitureType(type));
  const cx = at.x + fit.drawAt.x;
  const cz = at.z + fit.drawAt.z;
  return new THREE.Box3(new THREE.Vector3(cx - fit.box.width / 2, 0, cz - fit.box.depth / 2), new THREE.Vector3(cx + fit.box.width / 2, fit.box.height, cz + fit.box.depth / 2));
}

/** 책상의 딸린 의자 상자(카탈로그의 의자 자리와 크기, 책상 방향 0). */
function chairBox(desk: FloorPoint) {
  const chair = furnitureType("desk").chair!;
  const cx = desk.x + chair.at.x;
  const cz = desk.z + chair.at.z;
  return new THREE.Box3(new THREE.Vector3(cx - chair.box.width / 2, 0, cz - chair.box.depth / 2), new THREE.Vector3(cx + chair.box.width / 2, chair.box.height, cz + chair.box.depth / 2));
}

/** 받침 윗면 top의 자리 (x, z)에 올린 소품의 모델 상자. */
function tabletopModelBox(type: string, at: FloorPoint, top: number) {
  const b = fittedModel(furnitureType(type)).box;
  return new THREE.Box3(new THREE.Vector3(at.x - b.width / 2, top, at.z - b.depth / 2), new THREE.Vector3(at.x + b.width / 2, top + b.height, at.z + b.depth / 2));
}

/** 같은 소품의 넓힌 판정 상자(가로·깊이·높이가 적어도 0.8칸). */
function tabletopWideBox(type: string, at: FloorPoint, top: number) {
  const b = fittedModel(furnitureType(type)).box;
  const w = Math.max(TABLETOP_PICK_MIN, b.width);
  const h = Math.max(TABLETOP_PICK_MIN, b.height);
  const d = Math.max(TABLETOP_PICK_MIN, b.depth);
  return new THREE.Box3(new THREE.Vector3(at.x - w / 2, top, at.z - d / 2), new THREE.Vector3(at.x + w / 2, top + h, at.z + d / 2));
}

// ---------- 가짜 glb(④ 테스트와 같다) ----------

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

// ---------- 도우미 ----------

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

function toScreen(p: { x: number; y: number; z: number }) {
  camera().updateMatrixWorld();
  const v = new THREE.Vector3(p.x, p.y, p.z).project(camera());
  const { width, height } = mockThree.size;
  const at = { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  expect(at.x > 0 && at.x < width && at.y > 0 && at.y < height && v.z <= 1 && v.z >= -1).toBe(true);
  return at;
}

function rayAt(at: { x: number; y: number }) {
  const { width, height } = mockThree.size;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((at.x / width) * 2 - 1, -(at.y / height) * 2 + 1), camera());
  return raycaster.ray;
}

function distanceTo(ray: THREE.Ray, box: THREE.Box3): number | null {
  const point = ray.intersectBox(box, new THREE.Vector3());
  return point ? point.distanceTo(ray.origin) : null;
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

async function touch(handler: "onResponderGrant" | "onResponderTerminate", at: { x: number; y: number }) {
  const view = touchView();
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>)[handler]({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
}

/** 누르기 시작과 취소만 넣어 누른 곳의 누르기 결과를 본다(고르기·끌기가 끝나지 않는다). */
async function probeAt(at: { x: number; y: number }): Promise<PointerHit | null> {
  const before = mockHits.length;
  await touch("onResponderGrant", at);
  const down = mockHits.slice(before).find((entry) => entry.phase === "down");
  await touch("onResponderTerminate", at);
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

function hit(point: FloorPoint | null, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

/** 화면에 누르기 결과를 직접 넣는다(판정은 보지 않는 조작). */
async function pointer(phase: "down" | "move" | "up", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvasProps().onPointer(phase, h, x, y);
  });
  await flushAsync();
}

async function tapPiece(piece: string | null, at: FloorPoint) {
  await pointer("down", hit(at, piece), 200, 300);
  await pointer("up", null, 200, 300);
  await frames();
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

async function openStorage() {
  // 071 명세 2(고칠 기존 테스트): 보관함 줄은 꾸미기에 들어가면 늘 보이고 여는 '보관함' 버튼이 없어, 누르지 않는다
  await flushAsync();
}

/** '보관함' 묶음 줄의 그 가구 이름 글('가구 더하기' 줄 "<이름> 더하기" 안의 글은 뺀다). */
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

async function takeOut(name: string) {
  await openStorage();
  await fireEvent.press(storageRowText(name));
  await flushAsync();
  await frames();
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

/** 그 가구의 3D 물체(대체 모양과 가구 묶음 모델, furnitureOf가 가구 id). 없을 수도 있다. */
function furnitureObjects(id: string): THREE.Object3D[] {
  syncScene();
  const found: THREE.Object3D[] = [];
  scene().traverse((object) => {
    if (object.userData.furnitureOf === id) found.push(object);
  });
  return found;
}

function shownFurniture(id: string): THREE.Object3D[] {
  return furnitureObjects(id).filter((object) => isShown(object));
}

function visibleFakeModels(model: string): THREE.Mesh[] {
  syncScene();
  const found: THREE.Mesh[] = [];
  scene().traverse((object) => {
    if (object instanceof THREE.Mesh && object.userData.fakeModel === model && isShown(object)) found.push(object);
  });
  return found;
}

function LobbyHost({ loaded }: { loaded: LobbyLayout }) {
  const [layout, setLayout] = useState(loaded);
  const save = async (value: LobbyLayout) => {
    const saved = copy(value);
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
  await render(<LobbyHost loaded={loaded} />);
  await flushAsync();
  await frames();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
  await frames();
}

async function deselect() {
  await tapPiece(null, EMPTY_FLOOR);
  expect(edit().lifted).toBeNull();
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  resetMocks();
});

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  devGlobal.__DEV__ = originalDev;
  jest.useRealTimers();
});

// ---------- P. 꾸미기 고르기 ----------

/** 광선이 책상(또는 딸린 의자)을 먼저 지나고 그다음 소품의 넓힌 판정을 지나는지. */
function deskThenWide(p: { x: number; y: number; z: number }, wide: THREE.Box3) {
  const ray = rayAt(toScreen(p));
  const toDesk = [distanceTo(ray, floorBox("desk", DESK_AT)), distanceTo(ray, chairBox(DESK_AT))].filter((d): d is number => d !== null);
  const toWide = distanceTo(ray, wide);
  return toDesk.length > 0 && toWide !== null && Math.min(...toDesk) < toWide;
}

/** 책상 뒤 협탁 위 소품을 가리키는 점들(넓힌 판정의 앞 아래쪽). */
const BEHIND_POINTS = [
  { x: 1.5, y: NS_TOP + 0.3, z: BEHIND.z + 0.35 },
  { x: 1.35, y: NS_TOP + 0.3, z: BEHIND.z + 0.35 },
  { x: 1.65, y: NS_TOP + 0.3, z: BEHIND.z + 0.35 }
];
/** 같은 소품을 책상 위로 비켜 가리키는 점들(넓힌 판정의 위쪽). */
const BEHIND_TOP_POINTS = [
  { x: 1.5, y: NS_TOP + 0.84, z: BEHIND.z },
  { x: 1.8, y: NS_TOP + 0.75, z: BEHIND.z }
];

describe("[spec] 066-⑤ 명세 3: 받침 가구가 여럿일 때 꾸미기 고르기(P)", () => {
  test(
    "P1 L-NS에서 광선이 작은 화분의 넓힌 판정과 협탁만 지나는 점(모델 밖)을 누르면 작은 화분이 골라진다",
    async () => {
      await renderLobby(LNS);
      await enterEdit();
      const ns = { x: 3.5, z: 5.5 };
      const wide = tabletopWideBox("smallPlant", ns, NS_TOP);
      const model = tabletopModelBox("smallPlant", ns, NS_TOP);
      const points = [
        { x: 3.85, y: NS_TOP + 0.4, z: 5.5 },
        { x: 3.5, y: NS_TOP + 0.75, z: 5.5 },
        { x: 3.5, y: NS_TOP + 0.04, z: 5.85 }
      ];
      // 전제: 넓힌 판정을 지나고 소품 모델·책상에는 닿지 않는다
      for (const p of points) {
        const ray = rayAt(toScreen(p));
        expect({
          at: p,
          wide: distanceTo(ray, wide) !== null,
          model: distanceTo(ray, model) !== null,
          desk: distanceTo(ray, floorBox("desk", DESK_AT)) !== null
        }).toEqual({ at: p, wide: true, model: false, desk: false });
      }
      for (const p of points) {
        const result = await probeAt(toScreen(p));
        expect({ at: p, piece: result?.piece ?? null }).toEqual({ at: p, piece: "smallPlant-1" });
      }
    },
    SLOW_TEST_MS
  );

  test(
    "P2 협탁을 책상 바로 뒤 (1.5, 4.5)에 둔 L-NS에서 광선이 책상을 먼저 지나고 그다음 작은 화분 넓힌 판정을 지나는 점을 누르면 책상이 골라진다",
    async () => {
      await renderLobby(layoutOf([...N0_ITEMS, NS_BEHIND, on("smallPlant-1", "smallPlant", "nightstand-1", 0)], LNS_STORED));
      await enterEdit();
      const wide = tabletopWideBox("smallPlant", BEHIND, NS_TOP);
      for (const p of BEHIND_POINTS) expect({ at: p, deskFirst: deskThenWide(p, wide) }).toEqual({ at: p, deskFirst: true });
      for (const p of BEHIND_POINTS) {
        const result = await probeAt(toScreen(p));
        expect({ at: p, piece: result?.piece ?? null }).toEqual({ at: p, piece: "desk" });
      }
    },
    SLOW_TEST_MS
  );

  async function lampMovedBehind() {
    await renderLobby(layoutOf([...N0_ITEMS, NS_BEHIND]));
    await enterEdit();
    await dragPiece("lamp", { x: 0.5, z: 5.5 }, BEHIND);
    expect(edit().layout.items.find((item) => item.id === "lamp")!.on).toEqual({ parent: "nightstand-1", slot: 0, facing: 0 });
    await deselect();
  }

  test(
    "P3 꾸미기 중 스탠드를 책상에서 책상 뒤 협탁으로 옮긴 뒤, 광선이 책상을 먼저 지나고 그다음 스탠드 넓힌 판정을 지나는 점을 누르면 책상이 골라진다",
    async () => {
      await lampMovedBehind();
      const wide = tabletopWideBox("lamp", BEHIND, NS_TOP);
      for (const p of BEHIND_POINTS) expect({ at: p, deskFirst: deskThenWide(p, wide) }).toEqual({ at: p, deskFirst: true });
      for (const p of BEHIND_POINTS) {
        const result = await probeAt(toScreen(p));
        expect({ at: p, piece: result?.piece ?? null }).toEqual({ at: p, piece: "desk" });
      }
    },
    SLOW_TEST_MS
  );

  test(
    "P4 같은 배치에서 광선이 협탁과 스탠드 넓힌 판정만 지나는 점(책상 위로 비킴)을 누르면 스탠드가 골라진다",
    async () => {
      await lampMovedBehind();
      const wide = tabletopWideBox("lamp", BEHIND, NS_TOP);
      // 전제: 넓힌 판정을 지나고 책상·의자에는 닿지 않는다
      for (const p of BEHIND_TOP_POINTS) {
        const ray = rayAt(toScreen(p));
        expect({
          at: p,
          wide: distanceTo(ray, wide) !== null,
          desk: distanceTo(ray, floorBox("desk", DESK_AT)) !== null,
          chair: distanceTo(ray, chairBox(DESK_AT)) !== null
        }).toEqual({ at: p, wide: true, desk: false, chair: false });
      }
      for (const p of BEHIND_TOP_POINTS) {
        const result = await probeAt(toScreen(p));
        expect({ at: p, piece: result?.piece ?? null }).toEqual({ at: p, piece: "lamp" });
      }
    },
    SLOW_TEST_MS
  );

  test(
    "P5 책상 자리가 다 찬 배치에서 보관함의 스탠드를 꺼내 책상 뒤 협탁에 놓은 뒤(책상 위 소품은 치움), 책상이 먼저인 광선을 누르면 책상이 골라진다",
    async () => {
      await renderLobby(
        layoutOf([...N0_ITEMS, on("smallPlant-1", "smallPlant", "desk", 1), on("books-1", "books", "desk", 2), NS_BEHIND], [{ id: "lamp-1", type: "lamp" }])
      );
      await enterEdit();
      await takeOut("스탠드");
      expect(edit().layout.items.find((item) => item.id === "lamp-1")!.on).toEqual({ parent: "nightstand-1", slot: 0, facing: 0 });
      // 책상 위 소품(넓힌 판정이 광선 앞을 가린다)을 치워, 광선이 책상을 먼저 지나게 한다
      for (const [id, x] of [
        ["lamp", 0.5],
        ["smallPlant-1", 1.5],
        ["books-1", 2.5]
      ] as const) {
        await tapPiece(id, { x, z: 5.5 });
        expect(edit().lifted).toBe(id);
        await pressButton("치우기");
      }
      expect(edit().layout.items.filter((item) => item.on?.parent === "desk")).toEqual([]);
      const wide = tabletopWideBox("lamp", BEHIND, NS_TOP);
      for (const p of BEHIND_POINTS) expect({ at: p, deskFirst: deskThenWide(p, wide) }).toEqual({ at: p, deskFirst: true });
      for (const p of BEHIND_POINTS) {
        const result = await probeAt(toScreen(p));
        expect({ at: p, piece: result?.piece ?? null }).toEqual({ at: p, piece: "desk" });
      }
    },
    SLOW_TEST_MS
  );

  // P6(의자가 먼저인 광선)은 옮기지 못했다: 의자 윗면(1.316)이 책상 윗면(1.292)보다 0.024만 높아, 내려오는 광선이 의자를 먼저 지나고
  // 그다음 책상 위 소품의 넓힌 판정(앞면 z = 자리 + 0.4)에 들어가는 점이 없다. 보고 07-qa-tests.md에 적었다.

  test(
    "P7 협탁 바로 앞 (3.5, 6.5)에 화분을 둔 L-NS에서 광선이 화분을 먼저 지나고 그다음 작은 화분 넓힌 판정을 지나는 점을 누르면 화분이 골라진다",
    async () => {
      await renderLobby(layoutOf([...LNS_ITEMS, floor("plant-1", "plant", 3.5, 6.5, 0)], LNS_STORED));
      await enterEdit();
      const wide = tabletopWideBox("smallPlant", { x: 3.5, z: 5.5 }, NS_TOP);
      const plant = floorBox("plant", { x: 3.5, z: 6.5 });
      const points = [
        { x: 3.5, y: NS_TOP + 0.3, z: 5.8 },
        { x: 3.5, y: NS_TOP + 0.1, z: 5.85 }
      ];
      for (const p of points) {
        const ray = rayAt(toScreen(p));
        const toPlant = distanceTo(ray, plant);
        const toWide = distanceTo(ray, wide);
        expect({ at: p, plantFirst: toPlant !== null && toWide !== null && toPlant < toWide }).toEqual({ at: p, plantFirst: true });
      }
      for (const p of points) {
        const result = await probeAt(toScreen(p));
        expect({ at: p, piece: result?.piece ?? null }).toEqual({ at: p, piece: "plant-1" });
      }
    },
    SLOW_TEST_MS
  );
});

// ---------- G. 3D ----------

describe("[spec] 066-⑤ 명세 1·2·3: 3D(G)", () => {
  test(
    "G1 V-ALL을 그리면 일곱 가구가 보이고 각 종류의 모델을 그린다. 작은 화분은 협탁 윗면 0.74, 책은 책상 윗면 1.292에 있다",
    async () => {
      await renderLobby(layoutOf(V_ALL_ITEMS));
      for (const id of ["bed-1", "nightstand-1", "floorLamp-1", "plant-1", "frame-1", "smallPlant-1", "books-1"]) {
        expect(`${id}:${shownFurniture(id).length > 0}`).toBe(`${id}:true`);
      }
      for (const type of ["bed", "nightstand", "floorLamp", "plant", "frame", "smallPlant", "books"]) {
        const piece = furnitureType(type).model.piece;
        expect(`${type}:${visibleFakeModels(piece).length > 0}`).toBe(`${type}:true`);
      }
      for (const object of furnitureObjects("smallPlant-1")) expect(object.position.y).toBeCloseTo(NS_TOP + furnitureType("smallPlant").model.y, 4);
      for (const object of furnitureObjects("books-1")) expect(object.position.y).toBeCloseTo(DESK_TOP + furnitureType("books").model.y, 4);
    },
    SLOW_TEST_MS
  );

  test(
    "G3·G4 꾸미기에서 '침대'를 더하면 bed-1이 (4, 5.5)에 보이고, '취소'하면 보이지 않는다",
    async () => {
      // 070 03 결정: 개발 빌드의 '가구 더하기' 탭에서 '침대' 칸을 누른다
      devGlobal.__DEV__ = true;
      await renderLobby(N0);
      await enterEdit();
      await openStorage();
      const addTabs = screen.queryAllByRole(/^(tab|button)$/, { name: "가구 더하기" });
      expect(addTabs).toHaveLength(1);
      await fireEvent.press(addTabs[0]);
      await flushAsync();
      const bedCells = screen.queryAllByRole(/button/).filter((button) => within(button).queryByText("침대") !== null);
      expect(bedCells).toHaveLength(1);
      await fireEvent.press(bedCells[0]);
      await flushAsync();
      await frames();

      const shown = shownFurniture("bed-1");
      expect(shown.length).toBeGreaterThan(0);
      for (const object of shown) {
        expect(object.position.x).toBeCloseTo(4, 4);
        expect(object.position.z).toBeCloseTo(5.5, 4);
      }

      await pressButton("취소");

      expect(shownFurniture("bed-1")).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "G5·G6 협탁을 치우면 협탁과 작은 화분이 둘 다 보이지 않고, 협탁을 꺼내면 협탁만 (3.5, 5.5) 칸에 보인다",
    async () => {
      await renderLobby(LNS);
      await enterEdit();
      await tapPiece("nightstand-1", { x: 3.5, z: 5.5 });
      expect(edit().lifted).toBe("nightstand-1");
      await pressButton("치우기");

      expect(shownFurniture("nightstand-1")).toEqual([]);
      expect(shownFurniture("smallPlant-1")).toEqual([]);

      await takeOut("협탁");

      const shown = shownFurniture("nightstand-1");
      expect(shown.length).toBeGreaterThan(0);
      for (const object of shown) {
        expect(object.position.x).toBeCloseTo(3.5, 4);
        expect(object.position.z >= 5 && object.position.z <= 6).toBe(true);
      }
      expect(shownFurniture("smallPlant-1")).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "G7 L-NS에서 협탁을 고르면 협탁과 작은 화분이 함께 뜬다(둘 다 놓인 높이보다 위)",
    async () => {
      await renderLobby(LNS);
      await enterEdit();
      await tapPiece("nightstand-1", { x: 3.5, z: 5.5 });
      expect(edit().lifted).toBe("nightstand-1");
      await frames();

      const nightstand = furnitureObjects("nightstand-1");
      const plant = furnitureObjects("smallPlant-1");
      expect(nightstand.length).toBeGreaterThan(0);
      expect(plant.length).toBeGreaterThan(0);
      for (const object of nightstand) expect(object.position.y).toBeGreaterThan(0.3);
      for (const object of plant) expect(object.position.y).toBeGreaterThan(NS_TOP + 0.3);
    },
    SLOW_TEST_MS
  );
});
