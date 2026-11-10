// [spec] qa 재현 테스트(작업 069, 버그 수정: 모바일 로비 꾸미기에서 치우기·꺼내기 때마다 3D 방 전체를 다시 만들어 화면이 한참 멈춤).
// 기대값은 명세(private 작업 폴더 069-2026-11-09-모바일-로비-치우기-꺼내기-느림/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작의 기대값은 지금(고치기 전) 동작에서 가져온다.
//
// - 재현(고치기 전에는 실패해야 한다): R1~R5. "3D를 다시 만든다"를 "치우기·꺼내기 전에 장면에 있던 메시가 다른 메시로 바뀐다"로 본다.
//   고칠 동작 1: 3D를 만들 때 보관함 가구도 만들고 숨겨 둔다. 고칠 동작 2: 치우기·꺼내기는 3D를 다시 만들지 않고 그 가구의 보이기만 바꾼다.
//   고칠 동작 3: 미리 만든 가구만 나오고 들어가는 '처음 배치로'는 다시 만들지 않는다.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): K1~K6.
//   K1·K2 숨긴(보관함) 가구는 꾸미기 안팎에서 보이지 않고 누르기 판정을 받지 않는다(꾸미기 밖에서는 길을 막지 않는다).
//   K3 미리 만들지 않은 가구가 '처음 배치로'로 나오면 보이고 눌린다(드문 경우의 다시 만들기).
//   K4·K5 꾸미기에서 나오면 이름표가 지금 배치대로다(068 d3ea23c의 고친 동작, 명세 "사용자가 폰에서 볼 것"의 책상 이름표).
//   K6 아래 누르기 탐색이 막는 가구를 실제로 잡아내는지(K2가 헛돌지 않는다는 확인).
//
// 어떻게 보나(068 재현 테스트 lobby3d-edit-scene-rebuild.spec.test.tsx와 같은 틀. 구현 코드는 부르는 방법을 알려고만 읽었다):
// - 화면(Lobby3dScreen)과 3D 그리기(Lobby3dCanvas)는 진짜를 쓰고, Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다.
//   <primitive object>는 테스트 렌더러에서 이름이 "primitive"인 요소가 되므로, 프레임마다 그 object들을 가짜 장면에 넣는다.
// - 가구 묶음(lobby3d-furniture)은 진짜를 쓰고 glb 불러오기만 가짜로 둔다: 모델 이름마다 0.8칸 상자 하나(userData.fakeModel = 모델 이름).
// - "보인다": 조상까지 모두 visible인 메시. "누르기 판정": 3D 그리기의 터치 받는 View에 화면 좌표를 넣었을 때 3D 그리기가 화면에 넘기는 결과.
// - 누르기 탐색(probe): 방 바닥 전체와 높이 1.2칸의 점들을 화면 좌표로 옮겨 누르기 시작(down)과 취소(cancel)를 넣는다.
//   취소로 끝내므로 라이트루프가 걷거나 가구가 옮겨지지 않는다. 숨긴 가구가 어디 놓였는지 모르므로 방 전체를 훑는다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { ROOM, applyLobbyLayout, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
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
/** DEF_WARDROBE_STORED와 방의 가구는 같고 보관함이 빈 배치(옷장이 아예 없다). */
const ROOM_ONLY = layoutOf(DEF_ITEMS.filter((item) => item.id !== "wardrobe"));
/** 깔개가 방에도 보관함에도 없는 배치. '처음 배치로'를 누르면 깔개가 나오는데 편집 전 배치에 없던 가구다(명세 고칠 동작 3의 예). */
const NO_RUG = layoutOf(DEF_ITEMS.filter((item) => item.id !== "rug"));
// 066-④ 결정 2: 처음 배치에 스탠드(책상 왼쪽 자리)가 더해졌다. R4·R5는 '처음 배치로'로 미리 만든 가구만 나오고 들어가는 경우를 보므로,
// 시작 배치에도 스탠드를 넣는다(스탠드가 없던 배치에서 '처음 배치로'로 스탠드가 새로 나오면 069 명세대로 다시 만드는 것이 맞다).
const LAMP_ITEM: FurnitureItem = { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as FurnitureItem;
const DEF_LAMP_ITEMS: FurnitureItem[] = [...DEF_ITEMS, LAMP_ITEM];
const DEF_LAMP_WARDROBE_STORED = layoutOf(
  DEF_LAMP_ITEMS.filter((item) => item.id !== "wardrobe"),
  [{ id: "wardrobe", type: "wardrobe" }]
);
/** DEF에 처음 배치에 없는 옷장 wardrobe2를 (3.5, 5.5)에 더한 배치(066 시나리오의 L1). 066-④ 결정 2로 처음 배치의 스탠드도 있다. */
const L1 = layoutOf([...DEF_LAMP_ITEMS, floor("wardrobe2", "wardrobe", 3.5, 5.5, 0)]);

const WARDROBE_AT = { x: 7.5, z: 3.5 };
/** 보관함의 옷장을 꺼내면 놓이는 자리(066 ③ 결정 1, 068 재현 테스트 G3와 같은 값). */
const TAKEN_OUT_AT = { x: 3.5, z: 5.5 };
const RUG_AT = { x: 4.6, z: 7.2 };
const DESK_AT = { x: 1.5, z: 5.5 };
const WARDROBE_PRESS_Y = 1.2;
const RUG_PRESS_Y = 0.03;
const DESK_PRESS_Y = 0.6;
const WARDROBE_AROUND = 1;
const RUG_AROUND = 1.5;
/** 일기 책상 이름표 높이(카탈로그의 책상 장소 label.y, 책상 가운데 위). */
const DESK_LABEL_Y = 2.1;
const EMPTY_FLOOR = { x: 5.5, z: 3.5 };

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SLOW_TEST_MS = 30_000;
const PROBE_TEST_MS = 120_000;

// ---------- 가짜 glb ----------

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

/** 장면 점의 화면 좌표. 화면 밖이면 null. */
function projectToScreen(x: number, y: number, z: number): { x: number; y: number } | null {
  camera().updateMatrixWorld();
  const p = new THREE.Vector3(x, y, z).project(camera());
  const { width, height } = mockThree.size;
  const at = { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
  if (!(at.x > 0 && at.x < width && at.y > 0 && at.y < height) || p.z > 1 || p.z < -1) return null;
  return at;
}

/** 장면 점의 화면 좌표. 화면 안이어야 한다. */
function toScreen(x: number, y: number, z: number) {
  const at = projectToScreen(x, y, z);
  expect(at).not.toBeNull();
  return at!;
}

function floorUnder(at: { x: number; y: number }) {
  const { width, height } = mockThree.size;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((at.x / width) * 2 - 1, -(at.y / height) * 2 + 1), camera());
  const hit = new THREE.Vector3();
  expect(raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)).not.toBeNull();
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

/** 방 바닥(0.5칸 간격)과 높이 1.2칸(1칸 간격)의 점들 가운데 화면 안에 드는 점마다 누르기 결과. */
async function probeRoom(): Promise<{ at: { x: number; y: number; z: number }; hit: PointerHit | null }[]> {
  const points: { x: number; y: number; z: number }[] = [];
  for (let x = 0.25; x < ROOM.width; x += 0.5) for (let z = 0.25; z < ROOM.depth; z += 0.5) points.push({ x, y: 0, z });
  for (let x = 0.5; x < ROOM.width; x += 1) for (let z = 0.5; z < ROOM.depth; z += 1) points.push({ x, y: WARDROBE_PRESS_Y, z });
  const results: { at: { x: number; y: number; z: number }; hit: PointerHit | null }[] = [];
  for (const point of points) {
    const at = projectToScreen(point.x, point.y, point.z);
    if (!at) continue;
    results.push({ at: point, hit: await probeAt(at) });
  }
  return results;
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

function centerOf(object: THREE.Object3D) {
  scene().updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  return { x: c.x, z: c.z };
}

function describeMeshes(meshes: THREE.Object3D[]): string[] {
  return meshes.map((mesh) => {
    const c = centerOf(mesh);
    const name = typeof mesh.userData.fakeModel === "string" ? `model:${mesh.userData.fakeModel}` : mesh.type;
    return `${name}@(${c.x.toFixed(2)}, ${c.z.toFixed(2)})`;
  });
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

/** before에 있던 메시 가운데 지금 장면에 없는 것(다시 만들어져 다른 메시로 바뀐 것). 실패 메시지용으로 수와 앞 다섯 개를 준다. */
function replacedSince(before: Set<THREE.Object3D>): { count: number; sample: string[] } {
  const now = meshesInScene();
  const gone = [...before].filter((mesh) => !now.has(mesh));
  return { count: gone.length, sample: gone.slice(0, 5).map((mesh) => (typeof mesh.userData.fakeModel === "string" ? `model:${mesh.userData.fakeModel}` : mesh.type)) };
}

/** 보이는 메시의 종류(가짜 모델이면 모델 이름)와 경계 상자(0.01칸 반올림). 카메라와 상관없다. */
function visibleSignature(): string[] {
  syncScene();
  scene().updateMatrixWorld(true);
  const list: string[] = [];
  const r = (v: number) => (Math.round(v * 100) / 100).toFixed(2);
  scene().traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const name = typeof object.userData.fakeModel === "string" ? `model:${object.userData.fakeModel}` : object.type;
    list.push(`${name} ${r(box.min.x)},${r(box.min.y)},${r(box.min.z)} ${r(box.max.x)},${r(box.max.y)},${r(box.max.z)}`);
  });
  return list.sort();
}

function visibleFakeModels(model: string): THREE.Mesh[] {
  syncScene();
  const found: THREE.Mesh[] = [];
  scene().traverseVisible((object) => {
    if (object instanceof THREE.Mesh && object.userData.fakeModel === model) found.push(object);
  });
  return found;
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

/** 그린 로비를 내리고, 다음 로비를 처음부터 그릴 수 있게 지금 배치와 가짜를 되돌린다. */
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
  await fireEvent.press(screen.getByRole("button", { name: /보관함/ }));
  await flushAsync();
  await fireEvent.press(storageRowText("옷장"));
  await flushAsync();
  await frames();
}

async function deselect() {
  await tapAt(toScreen(EMPTY_FLOOR.x, 0, EMPTY_FLOOR.z));
  await frames();
  expect(lifted()).toBeNull();
}

async function selectWardrobeAt(at: { x: number; z: number }, id: string) {
  const hit = await tapAt(toScreen(at.x, WARDROBE_PRESS_Y, at.z));
  expect(hit?.piece).toBe(id);
  expect(lifted()).toBe(id);
  await frames();
}

/** 책상을 눌러 바닥 점이 dz칸 앞으로 옮겨 간 화면 자리로 끈다. */
async function dragDesk(dz: number) {
  const pressAt = toScreen(DESK_AT.x, DESK_PRESS_Y, DESK_AT.z);
  const pressFloor = floorUnder(pressAt);
  const moveAt = toScreen(pressFloor.x, 0, pressFloor.z + dz);
  await touch("onResponderGrant", pressAt);
  await touch("onResponderMove", moveAt);
  await touch("onResponderRelease", moveAt);
  await flushAsync();
  await frames();
}

/** 3D 그리기가 마지막 프레임에 넘긴 일기 책상 이름표가 장면 점 (x, y, z)의 화면 좌표에 있는지(0.5화소 안). */
function expectDeskLabelAt(x: number, y: number, z: number) {
  const want = toScreen(x, y, z);
  const got = mockLabels.value?.desk;
  expect(got).toBeDefined();
  expect(Math.abs(got!.x - want.x)).toBeLessThan(0.5);
  expect(Math.abs(got!.y - want.y)).toBeLessThan(0.5);
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

// ---------- 재현(고칠 동작) ----------

describe("[spec] 069 재현: 치우기·꺼내기는 3D를 다시 만들지 않고 그 가구의 보이기만 바꾼다", () => {
  test(
    "R1 (고칠 동작 2) 옷장을 치우면 장면의 메시가 하나도 바뀌지 않고, 옷장의 모양·그림자는 장면에 남은 채 보이지 않는다",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      const before = meshesInScene();
      const wardrobeMeshes = visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND);
      expect(wardrobeMeshes.length).toBeGreaterThan(0);
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");

      await storeSelected();

      expect(storedIds(edit().layout)).toEqual(["wardrobe"]);
      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      const now = meshesInScene();
      expect(wardrobeMeshes.filter((mesh) => !now.has(mesh))).toHaveLength(0);
      expect(describeMeshes(wardrobeMeshes.filter((mesh) => isShown(mesh)))).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "R2 (고칠 동작 1·2) 편집을 시작할 때 보관함에 있던 옷장을 꺼내면, 장면의 메시가 바뀌지 않고 (3.5, 5.5)에 보이는 옷장 메시는 꺼내기 전부터 장면에 있던(숨겨 둔) 것이다",
    async () => {
      await renderLobby(DEF_WARDROBE_STORED);
      await enterEdit();
      const before = meshesInScene();
      expect(describeMeshes(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND))).toEqual([]);

      await takeOutWardrobe();
      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 3.5, z: 5.5, facing: 0 });
      await deselect();

      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      const shown = visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND);
      expect(shown.length).toBeGreaterThan(0);
      expect(describeMeshes(shown.filter((mesh) => !before.has(mesh)))).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "R3 (고칠 동작 2) 옷장을 치웠다가 다시 꺼내면, 장면의 메시가 바뀌지 않고 치우기 전 옷장의 모양·그림자가 꺼낸 자리 (3.5, 5.5)에 다시 보인다",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      const before = meshesInScene();
      const wardrobeMeshes = visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND);
      expect(wardrobeMeshes.length).toBeGreaterThan(0);
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
      await storeSelected();

      await takeOutWardrobe();
      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 3.5, z: 5.5, facing: 0 });
      await deselect();

      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      const shown = new Set<THREE.Object3D>(visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND));
      expect(describeMeshes(wardrobeMeshes.filter((mesh) => !shown.has(mesh)))).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "R4 (고칠 동작 3) 보관함에 옷장이 든 배치에서 '처음 배치로'를 누르면 장면의 메시가 바뀌지 않고, (7.5, 3.5)에 보이는 옷장 메시는 누르기 전부터 장면에 있던 것이다",
    async () => {
      await renderLobby(DEF_LAMP_WARDROBE_STORED);
      await enterEdit();
      const before = meshesInScene();

      await pressButton("처음 배치로");
      await frames();

      expect(itemIn(edit().layout, "wardrobe")?.floor).toEqual({ x: 7.5, z: 3.5, facing: 3 });
      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      const shown = visibleMeshesAround(WARDROBE_AT, WARDROBE_AROUND);
      expect(shown.length).toBeGreaterThan(0);
      expect(describeMeshes(shown.filter((mesh) => !before.has(mesh)))).toEqual([]);
    },
    SLOW_TEST_MS
  );

  test(
    "R5 (고칠 동작 3) 처음 배치에 없는 옷장 wardrobe2가 있는 배치에서 '처음 배치로'를 누르면 장면의 메시가 바뀌지 않고, wardrobe2의 모양·그림자는 장면에 남은 채 보이지 않는다",
    async () => {
      await renderLobby(L1);
      await enterEdit();
      const before = meshesInScene();
      const wardrobe2Meshes = visibleMeshesAround(TAKEN_OUT_AT, WARDROBE_AROUND);
      expect(wardrobe2Meshes.length).toBeGreaterThan(0);

      await pressButton("처음 배치로");
      await frames();

      expect(storedIds(edit().layout)).toEqual(["wardrobe2"]);
      expect(replacedSince(before)).toEqual({ count: 0, sample: [] });
      expect(describeMeshes(wardrobe2Meshes.filter((mesh) => isShown(mesh)))).toEqual([]);
    },
    SLOW_TEST_MS
  );
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 069 그대로 둘 동작: 숨긴 가구는 보이지 않고 누르기를 받지 않으며, 꾸미기에서 나오면 지금 배치대로다", () => {
  test(
    "K1 꾸미기에서 보관함에 옷장이 든 배치는, 보이는 메시가 옷장이 아예 없는 같은 방과 같고, 방 어디를 눌러도 옷장이 눌리지 않는다",
    async () => {
      await renderLobby(ROOM_ONLY);
      await enterEdit();
      const roomOnly = visibleSignature();
      await unmountLobby();

      await renderLobby(DEF_WARDROBE_STORED);
      await enterEdit();

      expect(visibleSignature()).toEqual(roomOnly);
      expect(visibleFakeModels("wardrobe")).toHaveLength(0);
      const probes = await probeRoom();
      expect(probes.length).toBeGreaterThan(100);
      expect(probes.filter((p) => p.hit?.piece === "wardrobe").map((p) => p.at)).toEqual([]);
    },
    PROBE_TEST_MS
  );

  test(
    "K2 꾸미기 밖 로비에서 보관함에 옷장이 든 배치는, 보이는 메시가 옷장이 아예 없는 같은 방과 같고, 방 어디를 눌러도 막히지 않는다(바닥 점이 있다)",
    async () => {
      await renderLobby(ROOM_ONLY);
      const roomOnly = visibleSignature();
      await unmountLobby();

      await renderLobby(DEF_WARDROBE_STORED);

      expect(visibleSignature()).toEqual(roomOnly);
      expect(visibleFakeModels("wardrobe")).toHaveLength(0);
      const probes = await probeRoom();
      expect(probes.length).toBeGreaterThan(100);
      // 이 방에는 길을 막는 가구가 없다(책상·책장은 장소, 깔개는 막지 않는다). 막히면 바닥 점 없이(point null) 돌아온다
      expect(probes.filter((p) => p.hit?.point == null).map((p) => p.at)).toEqual([]);
    },
    PROBE_TEST_MS
  );

  test(
    "K3 (고칠 동작 3의 드문 경우) 깔개가 방에도 보관함에도 없는 배치에서 '처음 배치로'를 누르면 깔개가 (4.6, 7.2)에 보이고 그 자리를 누르면 깔개가 눌린다",
    async () => {
      await renderLobby(NO_RUG);
      await enterEdit();
      expect(describeMeshes(visibleMeshesAround(RUG_AT, RUG_AROUND))).toEqual([]);

      await pressButton("처음 배치로");
      await frames();

      expect(itemIn(edit().layout, "rug")?.floor).toEqual({ x: 4.6, z: 7.2, facing: 0 });
      expect(visibleFakeModels("rug")).toHaveLength(1);
      expect(visibleMeshesAround(RUG_AT, RUG_AROUND).length).toBeGreaterThan(0);
      const hit = await tapAt(toScreen(RUG_AT.x, RUG_PRESS_Y, RUG_AT.z));
      expect(hit?.piece).toBe("rug");
      expect(lifted()).toBe("rug");
    },
    SLOW_TEST_MS
  );

  test(
    "K4 책상을 (1.5, 6.5)로 옮기고 옷장을 치웠다 꺼낸 뒤 '취소'하면, 꾸미기 밖 로비에서 일기 책상 이름표가 편집 전 책상 위(1.5, 2.1, 5.5)에 있다",
    async () => {
      await renderLobby(DEF);
      await enterEdit();
      await dragDesk(1);
      expect(itemIn(edit().layout, "desk")?.floor).toEqual({ x: 1.5, z: 6.5, facing: 0 });
      await deselect();
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
      await storeSelected();
      await takeOutWardrobe();
      expect(itemIn(edit().layout, "wardrobe")).toBeDefined();

      await pressButton("취소");
      await frames();

      expect(screen.getByText("꾸미기")).toBeTruthy();
      expectDeskLabelAt(DESK_AT.x, DESK_LABEL_Y, DESK_AT.z);
      // 편집 전 책상 자리의 이름표와 옮긴 자리의 이름표는 화면에서 떨어져 있다(위 확인이 헛돌지 않는다)
      const moved = toScreen(1.5, DESK_LABEL_Y, 6.5);
      const original = toScreen(DESK_AT.x, DESK_LABEL_Y, DESK_AT.z);
      expect(Math.hypot(moved.x - original.x, moved.y - original.y)).toBeGreaterThan(5);
    },
    SLOW_TEST_MS
  );

  test(
    "K5 책상을 (1.5, 6.5)로 옮기고 옷장을 치웠다 꺼낸 뒤 '완료'하면, 꾸미기 밖 로비에서 일기 책상 이름표가 옮긴 책상 위(1.5, 2.1, 6.5)에 있다",
    async () => {
      const { onSaveLayout } = await renderLobby(DEF);
      await enterEdit();
      await dragDesk(1);
      expect(itemIn(edit().layout, "desk")?.floor).toEqual({ x: 1.5, z: 6.5, facing: 0 });
      await deselect();
      await selectWardrobeAt(WARDROBE_AT, "wardrobe");
      await storeSelected();
      await takeOutWardrobe();
      expect(itemIn(edit().layout, "wardrobe")).toBeDefined();

      await pressButton("완료");
      await frames();

      expect(onSaveLayout).toHaveBeenCalledTimes(1);
      expect(screen.getByText("꾸미기")).toBeTruthy();
      expectDeskLabelAt(1.5, DESK_LABEL_Y, 6.5);
    },
    SLOW_TEST_MS
  );

  test(
    "K6 (탐색 확인) 꾸미기 밖 로비에서 옷장이 (7.5, 3.5)에 놓인 배치는, 방을 훑으면 막힌 곳(바닥 점 없음)이 있다",
    async () => {
      await renderLobby(DEF);

      const probes = await probeRoom();

      expect(probes.filter((p) => p.hit?.point == null).length).toBeGreaterThan(0);
    },
    PROBE_TEST_MS
  );
});
