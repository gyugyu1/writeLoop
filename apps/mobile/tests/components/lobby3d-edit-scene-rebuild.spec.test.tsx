// [spec] qa 재현 테스트(작업 068, 버그 수정: 모바일 로비 꾸미기에서 보관함에 넣은 가구의 3D가 남아 눌리면 오류,
// 편집을 시작할 때 보관함에 있던 가구를 꺼내면 3D가 없어 보이지 않음).
// 기대값은 명세(private 작업 폴더 068-2026-11-09-모바일-로비-보관함-3D-남은-가구/01-main-spec.md)에서만 가져온다.
// - 고칠 동작 1(고치기 전에는 실패해야 한다): G1~G6. 치운 가구는 모양·그림자·누르기 판정이 없어지고, 꺼낸 가구(처음 배치로로 돌아온 가구 포함)는 보이고 눌린다.
//   G1b는 사용자 보고와 같은 조작(옷장을 치우고 그 자리를 누름)이고, 고치기 전에는 Metro 로그와 같은 TypeError로 실패한다.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): K1(끌기·돌리기·띄우기는 3D를 다시 만들지 않고 자리만 옮김, 064 ④ 결정 06),
//   K2·K3(취소하면 꾸미기 밖 로비는 편집 전 배치 그대로 그려짐).
// 꺼낸 가구가 놓이는 자리는 066 ③ 결정 1(곧은 거리, 같으면 z, 그다음 x가 작은 쪽)로 정해진 값((3.5, 5.5, 0))을 쓴다(home-lobby-storage S12와 같은 배치).
//
// 어떻게 보나(구현 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen)과 3D 그리기(Lobby3dCanvas)는 진짜를 쓰고, Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다.
//   Canvas는 자식을 그대로 그리고, useThree는 고정 카메라(three의 PerspectiveCamera)·화면 크기·장면을, useFrame은 테스트가 부를 때 한 프레임씩 돈다.
//   <primitive object>는 테스트 렌더러에서 이름이 "primitive"인 요소가 되므로, 프레임마다 그 object들을 가짜 장면에 넣는다(실제 R3F가 장면에 붙이는 것과 같게).
// - 누르기: 3D 그리기의 터치 받는 View에 화면 좌표를 넣어 누르고, 3D 그리기가 화면에 넘기는 누르기 결과(piece)를 가로채 본다.
//   화면 좌표는 가구 가운데(바닥 가구는 높이 중간) 점을 지금 카메라로 화면에 옮긴 곳이다.
// - 보이는 모양·그림자: 장면에서 보이는(조상까지 visible) 메시 가운데 경계 상자가 그 가구 자리 둘레(칸) 안에 다 드는 것.
//   방 바닥·벽처럼 방 전체에 걸친 것은 들지 않는다. 칠한 칸이 섞이지 않게 고른 가구가 없을 때 본다.
// - 가구 묶음(lobby3d-furniture)은 진짜를 쓰고 glb 불러오기만 가짜로 둔다: 모델 이름마다 0.8칸 상자 하나를 준다.
//   그래서 "모양"은 가구 묶음이 놓은 모델(가짜 상자)과 대체 모양·그림자를 함께 본다. 실제 Kenney 모델의 모습은 보지 못한다.
// - 둥근 상자(RoundedBoxGeometry)는 같은 크기의 상자로, 창밖 장면(lobby3d-outdoor)·구운 방·캐릭터·햇빛 조명은 빈 것으로 바꾼다.
// - 화면은 홈처럼 배치를 넘기고 저장에 성공하면 저장한 배치를 다시 넘기는 작은 감싸개(LobbyHost)로 그린다(서버는 보낸 배치를 그대로 돌려준다).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, type PointerHit } from "@/lib/lobby3d/engine";
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

// three(0.187)는 ES 모듈만 있어 Jest의 require로는 읽지 못한다(jest-expo는 node_modules의 three를 변환하지 않는다).
// 그래서 Jest를 거치지 않는 Node의 require로 읽는다(Node 22.12 이상은 require로 ES 모듈을 읽는다. 로컬과 CI는 Node 24).
// 화면·3D 그리기 코드가 부르는 "three"도 모두 이 하나를 받는다.
jest.mock("three", () => {
  // Jest가 주는 "module"은 Jest의 require를 만들므로, Node가 가진 진짜 모듈 기능(process.getBuiltinModule, Node 22.3 이상)을 쓴다
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  // require.resolve는 Jest의 해석이라 three의 ES 모듈 파일 경로를 준다. 그 파일을 Node의 require로 읽는다
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
    // 둥근 상자의 뒤 인자(나눔 수·모서리 반지름)는 상자의 나눔 수가 아니므로 넘기지 않는다
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {} }));
// 가구 묶음 glb는 Jest가 읽지 못하는 파일이라 이름만 준다(불러오기는 위 useLoader가 가짜다)
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
// 3D 그리기는 진짜를 그리되, 화면에 넘기는 누르기 결과를 적어 둔다
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

// ---------- 배치(066 시나리오의 배치 모음) ----------

type Facing = 0 | 1 | 2 | 3;
const floor = (id: string, type: string, x: number, z: number, facing: Facing): FurnitureItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): FurnitureItem => ({ id, type, wall: { wall: side, along } });

const DEF_ITEMS: FurnitureItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8)
];
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const layoutOf = (items: FurnitureItem[], stored: StoredItem[] = []): LobbyLayout => copy(makeLayout(items, stored));
const DEF = layoutOf(DEF_ITEMS);
/** 옷장을 보관함에 넣은 채 저장한 배치. */
const DEF_WARDROBE_STORED = layoutOf(
  DEF_ITEMS.filter((item) => item.id !== "wardrobe"),
  [{ id: "wardrobe", type: "wardrobe" }]
);
/** DEF에 처음 배치에 없는 옷장 wardrobe2를 (3.5, 5.5)에 더한 배치(066 시나리오의 L1). */
const L1 = layoutOf([...DEF_ITEMS, floor("wardrobe2", "wardrobe", 3.5, 5.5, 0)]);

/** 가구 가운데(바닥)와, 누를 높이, 둘레(이 안에 경계 상자가 다 드는 메시를 그 가구의 것으로 본다). */
const WARDROBE_AT = { x: 7.5, z: 3.5 };
const TAKEN_OUT_AT = { x: 3.5, z: 5.5 };
const RUG_AT = { x: 4.6, z: 7.2 };
const DESK_AT = { x: 1.5, z: 5.5 };
const WARDROBE_PRESS_Y = 1.2;
const RUG_PRESS_Y = 0.03;
const WARDROBE_AROUND = 1;
const RUG_AROUND = 1.5;
const DESK_AROUND = 1.6;
/** 빈 바닥(가구 없음). 고르기를 풀 때 누른다. */
const EMPTY_FLOOR = { x: 5.5, z: 3.5 };

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SLOW_TEST_MS = 30_000;

// ---------- 가짜 glb ----------

/** 모델 이름마다 0.8칸 상자 하나(바닥에 놓인)를 주는 가구 묶음. 창밖 판(windowView)은 없다. */
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

/** 지금 그려진 <primitive>의 object들을 장면에 넣는다. */
function syncScene() {
  const objects = screen.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((instance) => (instance.props as { object: THREE.Object3D }).object);
  scene().clear();
  for (const object of objects) scene().add(object);
}

/** 3D 그리기의 프레임을 n번 돈다. */
async function frames(n = 3) {
  for (let index = 0; index < n; index += 1) {
    await act(async () => {
      syncScene();
      for (const part of [...mockFrames]) part({ camera: camera(), gl: {}, clock: { elapsedTime: 0 }, scene: scene() }, 0.05);
      // 실제 그리기(renderer.render)처럼 프레임 끝에 장면의 월드 행렬을 맞춘다(누르기 판정이 이 행렬을 쓴다)
      syncScene();
      scene().updateMatrixWorld(true);
    });
  }
  syncScene();
  scene().updateMatrixWorld(true);
}

/** 장면 점을 지금 카메라로 화면 좌표에 옮긴다. 화면 안이어야 한다. */
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

/** 화면 좌표를 지나는 시선이 바닥(높이 0)에 닿는 점. */
function floorUnder(at: { x: number; y: number }) {
  const { width, height } = mockThree.size;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((at.x / width) * 2 - 1, -(at.y / height) * 2 + 1), camera());
  const hit = new THREE.Vector3();
  expect(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)).not.toBeNull();
  return { x: hit.x, z: hit.z };
}

/** 3D 그리기의 터치 받는 View: 터치를 먼저 가져가고(capture) 그 안에 3D 장면(primitive)이 있는 View. */
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

async function touch(handler: "onResponderGrant" | "onResponderMove" | "onResponderRelease", at: { x: number; y: number }) {
  const view = touchView();
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>)[handler]({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
}

/** 화면 좌표를 톡 누른다. 누를 때 3D 그리기가 넘긴 누르기 결과를 돌려준다. */
async function tapAt(at: { x: number; y: number }): Promise<PointerHit | null> {
  const before = mockHits.length;
  await touch("onResponderGrant", at);
  const down = mockHits.slice(before).find((entry) => entry.phase === "down");
  await touch("onResponderRelease", at);
  await flushAsync();
  expect(down).toBeDefined();
  return down!.hit;
}

function edit() {
  const value = mockCanvas.props?.edit;
  expect(value).toBeTruthy();
  return value!;
}

function lifted(): string | null {
  return mockCanvas.props?.edit?.lifted ?? null;
}

function itemIn(layout: LobbyLayout, id: string) {
  return layout.items.find((item) => item.id === id);
}

function storedIds(layout: LobbyLayout): string[] {
  return ((layout as { stored?: StoredItem[] }).stored ?? []).map((item) => item.id).sort();
}

/** 보이는 메시 가운데 경계 상자가 (x, z) 둘레 around칸 안에 다 드는 것. */
function visibleMeshesAround(at: { x: number; z: number }, around: number): THREE.Mesh[] {
  syncScene();
  scene().updateMatrixWorld(true);
  const found: THREE.Mesh[] = [];
  scene().traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    if (box.min.x >= at.x - around && box.max.x <= at.x + around && box.min.z >= at.z - around && box.max.z <= at.z + around) found.push(object);
  });
  return found;
}

/** 실패 메시지용: 메시마다 종류(가짜 모델이면 모델 이름)와 경계 상자 가운데. */
function describeMeshes(meshes: THREE.Mesh[]): string[] {
  return meshes.map((mesh) => {
    const c = centerOf(mesh);
    const name = typeof mesh.userData.fakeModel === "string" ? `model:${mesh.userData.fakeModel}` : mesh.type;
    return `${name}@(${c.x.toFixed(2)}, ${c.z.toFixed(2)})`;
  });
}

/** 지금 장면에 있는 모든 메시. */
function meshesInScene(): Set<THREE.Object3D> {
  syncScene();
  const all = new Set<THREE.Object3D>();
  scene().traverse((object) => {
    if (object instanceof THREE.Mesh) all.add(object);
  });
  return all;
}

function centerOf(object: THREE.Object3D) {
  scene().updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  return { x: c.x, z: c.z };
}

/** 홈처럼 불러온 배치를 넘기고, 저장에 성공하면 저장한 배치를 다시 넘기는 화면. 서버는 보낸 배치를 그대로 돌려준다. */
function LobbyHost({ loaded, onSave }: { loaded: LobbyLayout; onSave: (value: LobbyLayout) => Promise<LobbyLayout> }) {
  const [layout, setLayout] = useState(loaded);
  const save = async (value: LobbyLayout) => {
    const saved = await onSave(value);
    setLayout(saved);
    return saved;
  };
  return <Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={save} />;
}

async function renderLobby(loaded: LobbyLayout) {
  const onSaveLayout = jest.fn(async (value: LobbyLayout) => copy(value));
  await render(<LobbyHost loaded={loaded} onSave={onSaveLayout} />);
  await flushAsync();
  await frames();
  return { onSaveLayout };
}

async function pressText(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

async function enterEdit() {
  await pressText("꾸미기");
  await frames();
}

async function storeSelected() {
  await pressButton("치우기");
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

async function takeOutWardrobe() {
  // 071 명세 2(고칠 기존 테스트): 보관함 줄은 꾸미기에 들어가면 늘 보이고 여는 '보관함' 버튼이 없어, 누르지 않는다
  await flushAsync();
  await fireEvent.press(storageRowText("옷장"));
  await flushAsync();
  await frames();
}

/** 빈 바닥을 눌러 고르기를 푼다. */
async function deselect() {
  await tapAt(toScreen(EMPTY_FLOOR.x, 0, EMPTY_FLOOR.z));
  await frames();
  expect(lifted()).toBeNull();
}

/** 옷장 자리를 눌러 고른다(3D가 그 옷장을 누른 결과로 넘겨야 한다). */
async function selectWardrobeAt(at: { x: number; z: number }, id: string) {
  const hit = await tapAt(toScreen(at.x, WARDROBE_PRESS_Y, at.z));
  expect(hit?.piece).toBe(id);
  expect(lifted()).toBe(id);
  await frames();
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockHits.length = 0;
  mockCanvas.props = null;
  mockGltf.value = fakeFurnitureGltf();
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
});

// ---------- 고칠 동작 1 ----------

describe("[spec] 068 고칠 동작 1: 꾸미기 중 방의 가구 목록이 바뀌면 3D 가구를 편집 중인 배치로 다시 만든다", () => {
  test(
    "G1a 옷장을 치우면 그 자리(7.5, 3.5) 둘레에 보이는 모양·그림자가 하나도 없다",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      // 치우기 전에는 옷장의 모양·그림자가 보인다(시작 조건)
      expect(visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND).length).toBeGreaterThan(0);
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");

      await storeSelected();

      expect(storedIds(edit().layout)).toEqual(["wardrobe"]);
      expect(lifted()).toBeNull();
      expect(describeMeshes(visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND))).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "G1b (사용자 보고) 옷장을 치운 뒤 그 자리를 누르면 오류 없이 옷장이 눌리지 않고 아무것도 골라지지 않으며 배치는 그대로",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
      await storeSelected();
      const afterStore = copy(edit().layout);

      const hit = await tapAt(toScreen(WARDROBE_AT.x, WARDROBE_PRESS_Y, WARDROBE_AT.z));

      expect(hit?.piece ?? null).not.toBe("wardrobe");
      expect(lifted()).toBeNull();
      expect(edit().layout).toEqual(afterStore);
      expect(screen.queryAllByRole("alert")).toHaveLength(0);
    },
    SLOW_TEST_MS
  );

  test(
    "G2 깔개를 치우면 그 자리(4.6, 7.2) 둘레에 보이는 모양이 없고, 그 자리를 눌러도 오류 없이 깔개가 눌리지 않는다",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      const rugAt = toScreen(RUG_AT.x, RUG_PRESS_Y, RUG_AT.z);
      expect((await tapAt(rugAt))?.piece).toBe("rug");
      expect(lifted()).toBe("rug");
      await frames();

      await storeSelected();

      expect(storedIds(edit().layout)).toEqual(["rug"]);
      expect(describeMeshes(visibleMeshesAround(RUG_AT, RUG_AROUND))).toEqual([]);
      const hit = await tapAt(rugAt);
      expect(hit?.piece ?? null).not.toBe("rug");
      expect(lifted()).toBeNull();
    },
    SLOW_TEST_MS
  );

  test(
    "G3 편집을 시작할 때 보관함에 있던 옷장을 꺼내면 (3.5, 5.5)에 보이고, 그 자리를 누르면 옷장이 눌려 골라진다",
    async () => {
      await renderLobby(DEF_WARDROBE_STORED);
      await enterEdit();
      expect(describeMeshes(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND))).toEqual([]);

      await takeOutWardrobe();
      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 3.5, z: 5.5, facing: 0 });
      await deselect();

      expect(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND).length).toBeGreaterThan(0);
      await selectWardrobeAt(TAKEN_OUT_AT, "wardrobe");
    },
    SLOW_TEST_MS
  );

  test(
    "G4 옷장을 보관함에 넣은 채 완료하고 다시 꾸미기에 들어가 꺼내면 (3.5, 5.5)에 보이고 눌린다",
    async () => {
      const { onSaveLayout } = await renderLobby(DEF);
      await enterEdit();
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
      await storeSelected();
      await pressButton("완료");
      await frames();
      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      expect(screen.getByText("꾸미기")).toBeTruthy();

      await enterEdit();
      await takeOutWardrobe();
      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 3.5, z: 5.5, facing: 0 });
      await deselect();

      expect(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND).length).toBeGreaterThan(0);
      await selectWardrobeAt(TAKEN_OUT_AT, "wardrobe");
    },
    SLOW_TEST_MS
  );

  test(
    "G5 보관함에 옷장이 든 배치에서 '처음 배치로'를 누르면 옷장이 (7.5, 3.5)에 보이고 그 자리를 누르면 옷장이 눌린다",
    async () => {
      await renderLobby(DEF_WARDROBE_STORED);
      await enterEdit();
      expect(describeMeshes(visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND))).toEqual([]);

      await pressButton("처음 배치로");
      await frames();

      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 7.5, z: 3.5, facing: 3 });
      expect(visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND).length).toBeGreaterThan(0);
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
    },
    SLOW_TEST_MS
  );

  test(
    "G6 처음 배치에 없는 옷장 wardrobe2가 있는 배치에서 '처음 배치로'를 누르면 (3.5, 5.5) 둘레에 모양·그림자가 없고, 그 자리를 눌러도 오류 없이 눌리지 않는다",
    async () => {
      await renderLobby(L1);
      await enterEdit();
      expect(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND).length).toBeGreaterThan(0);

      await pressButton("처음 배치로");
      await frames();

      expect(storedIds(edit().layout)).toEqual(["wardrobe2"]);
      expect(describeMeshes(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND))).toEqual([]);
      const hit = await tapAt(toScreen(TAKEN_OUT_AT.x, WARDROBE_PRESS_Y, TAKEN_OUT_AT.z));
      expect(hit?.piece ?? null).not.toBe("wardrobe2");
      expect(lifted()).toBeNull();
    },
    SLOW_TEST_MS
  );
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 068 그대로 둘 동작: 끌기·돌리기·띄우기는 자리만 옮기고, 취소하면 편집 전 배치로 그린다", () => {
  test(
    "K1 옷장을 골라 띄우고, 돌리고, (4.5, 6.5)로 끌어도 옷장과 책상의 3D 메시는 같은 것이고 옷장의 것은 새 자리로 옮겨진다",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      const wardrobeMeshes = visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND);
      const deskMeshes = visibleMeshesAround(DESK_AT, DESK_AROUND);
      expect(wardrobeMeshes.length).toBeGreaterThan(0);
      expect(deskMeshes.length).toBeGreaterThan(0);
      const expectSameMeshes = () => {
        const now = meshesInScene();
        for (const mesh of [...wardrobeMeshes, ...deskMeshes]) expect(now.has(mesh)).toBe(true);
      };

      // 띄우기(고르기)
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
      expectSameMeshes();
      // 돌리기
      await pressButton("돌리기");
      await frames();
      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 7.5, z: 3.5, facing: 0 });
      expectSameMeshes();
      // 끌기: 고르기를 풀고 옷장을 눌러 바닥 점이 (-3, +3)칸 옮겨 간 화면 자리로 끈다
      await deselect();
      const pressAt = toScreen(WARDROBE_AT.x, WARDROBE_PRESS_Y, WARDROBE_AT.z);
      const pressFloor = floorUnder(pressAt);
      const moveAt = toScreen(pressFloor.x - 3, 0, pressFloor.z + 3);
      await touch("onResponderGrant", pressAt);
      await touch("onResponderMove", moveAt);
      await touch("onResponderRelease", moveAt);
      await flushAsync();
      await frames();

      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 4.5, z: 6.5, facing: 0 });
      expectSameMeshes();
      for (const mesh of wardrobeMeshes) {
        const c = centerOf(mesh);
        expect(Math.abs(c.x - 4.5)).toBeLessThan(WARDROBE_AROUND);
        expect(Math.abs(c.z - 6.5)).toBeLessThan(WARDROBE_AROUND);
      }
    },
    SLOW_TEST_MS
  );

  test(
    "K2 옷장을 치운 뒤 '취소'하면 꾸미기 밖 로비에서 옷장 자리(7.5, 3.5)에 모양·그림자가 다시 보인다",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
      await storeSelected();

      await pressButton("취소");
      await frames();

      expect(screen.getByText("꾸미기")).toBeTruthy();
      expect(visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND).length).toBeGreaterThan(0);
    },
    SLOW_TEST_MS
  );

  test(
    "K3 보관함의 옷장을 꺼낸 뒤 '취소'하면 꾸미기 밖 로비에서 (3.5, 5.5) 둘레에 모양·그림자가 없다",
    async () => {
      await renderLobby(DEF_WARDROBE_STORED);
      await enterEdit();
      await takeOutWardrobe();
      expect(itemIn(edit().layout, "wardrobe")).toBeDefined();

      await pressButton("취소");
      await frames();

      expect(screen.getByText("꾸미기")).toBeTruthy();
      expect(describeMeshes(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND))).toEqual([]);
    },
    SLOW_TEST_MS
  );
});
