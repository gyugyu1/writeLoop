// [spec] qa 테스트(작업 081, 결정 파일 09의 결정 2, 모바일): 기본 방에서 구운 방 껍데기가 첫 프레임 전에 들어온 채로(모델을 이미 읽어 둔 때)
// 몇 프레임을 그리면, 코드로 지은 방의 바닥 재질에 그림이 없다(바닥 그림을 만들지 않는다).
// 기대값은 명세(private 작업 폴더 081-2026-11-12-로비-장면-짓기-빠르게/01-main-spec.md 범위 2 "기본 방에서 구운 방 껍데기가 먼저 들어와
// 코드로 지은 방이 한 번도 그려지지 않으면 만들지 않는다")와 결정 파일(09-main-decision.md 결정 2)에서만 가져온다.
// 구분: 이미 있는 동작(구현 커밋 ee0e05e)을 지키는 테스트다. 테스트 커밋 시점에 통과가 맞다.
//
// 어떻게 보나: 가짜 모듈 구성, "한 프레임을 그린다"(drawFrame), 바닥 찾기는 lobby3d-room-floor-unchanged.spec(02-qa-tests.md)과 같다.
// - 구운 방 껍데기 파일은 처음부터 읽음으로 두어(앱 시작 때 미리 읽어 둔 것) 로비를 그린 뒤 React 반영이 끝나고 나서 첫 프레임을 그린다.
// - "그림이 없다"는 바닥 재질의 map이 null인 것으로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, applyRoom } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, currentRoom } from "@/lib/lobby3d/room";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
/** 파일마다 읽음(모델) 또는 읽지 못함(오류). */
const mockFiles = new Map<string, { value: unknown } | { error: Error }>();

/** 090-② 05 결정 3: 가구 일곱 파일 목록에 주는 가짜 모델 배열(같은 모델이면 같은 배열). */
const mockFurnitureLists = new Map<unknown, unknown[]>();
function mockFurnitureListOf(value: unknown, length: number): unknown[] {
  let list = mockFurnitureLists.get(value);
  if (!list || list.length !== length) {
    list = Array.from({ length }, () => value);
    mockFurnitureLists.set(value, list);
  }
  return list;
}

// three는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(다른 lobby3d spec과 같다)
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
    // 090-② 05 결정 3: 가구는 앱에 든 처음 방 일곱 파일을 목록으로 한 번에 읽는다. 그 목록은 FURNITURE_FILE("furniture/처음-방-일곱") 하나로 보고,
    // 읽은 값은 파일마다 같은 가짜 모델의 배열이다(진짜 useLoader처럼 같은 모델이면 같은 배열)
    useLoader: (_loader: unknown, input: unknown) => {
      const furnitureList = Array.isArray(input);
      const value = ((url: unknown) => {
        const file = mockFiles.get(String(url));
        if (!file) throw new Error(`테스트가 모르는 모델 파일: ${String(url)}`);
        if ("error" in file) throw file.error;
        return file.value;
      })(furnitureList ? "furniture/처음-방-일곱" : input);
      return furnitureList ? mockFurnitureListOf(value, (input as unknown[]).length) : value;
    }
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {} }));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@/assets/models/lobby-room.glb", () => "lobby-room.glb");
// 090-② 05 결정 3: 가구 묶음 대신 앱에 든 처음 방 가구 일곱의 파일이다(Jest가 읽지 못하는 파일이라 이름만 준다)
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});
jest.mock("@/components/lobby3d/lobby3d-character", () => ({
  BUBBLE_HEIGHT: 2,
  Character: () => null,
  CharacterErrorBoundary: ({ children }: { children: unknown }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
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

// ---------- 고정 값 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const ROOM_FILE = "lobby-room.glb";
// 090-② 05 결정 3: 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱 파일(목록)이다. 그 목록을 이 이름 하나로 본다
const FURNITURE_FILE = "furniture/처음-방-일곱";

// ---------- 가짜 모델 ----------

/** 모델 이름마다 0.8칸 상자 하나를 주는 가구 묶음(창밖 판은 없다). */
function fakeFurnitureGltf() {
  const scene = new THREE.Group();
  (scene as unknown as { getObjectByName: (name: string) => THREE.Object3D | undefined }).getObjectByName = (name: string) => {
    if (name === "windowView") return undefined;
    const group = new THREE.Group();
    group.name = name;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial()));
    return group;
  };
  return { scene, animations: [] };
}

function fakeRoomGltf() {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return { scene, animations: [] };
}

function roomLoads() {
  mockFiles.set(ROOM_FILE, { value: fakeRoomGltf() });
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function lobby(layout: LobbyLayout) {
  return <Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={async (value: LobbyLayout) => value} />;
}

async function renderLobby(layout: LobbyLayout) {
  await render(lobby(layout));
  await flushAsync();
}

/** 3D 그리기가 내놓은 <primitive>의 three 물체들. */
function primitives(): THREE.Object3D[] {
  return screen.container.queryAll((instance: TestInstance) => instance.type === "primitive").map((instance) => instance.props.object as THREE.Object3D);
}

function isFloor(o: THREE.Object3D, width: number, depth: number): boolean {
  const geometry = (o as THREE.Mesh).geometry as THREE.PlaneGeometry | undefined;
  if (!(o as THREE.Mesh).isMesh || !geometry || geometry.type !== "PlaneGeometry") return false;
  const p = geometry.parameters;
  return p.width === width && p.height === depth && p.widthSegments === 32 && p.heightSegments === 44;
}

/** 방(world.root), 코드로 지은 방(world.shell), 바닥. */
function codeRoom(width: number, depth: number): { root: THREE.Object3D; shell: THREE.Object3D; floor: THREE.Mesh } {
  const found: { root: THREE.Object3D; floor: THREE.Mesh }[] = [];
  for (const root of primitives()) {
    root.traverse((o) => {
      if (isFloor(o, width, depth)) found.push({ root, floor: o as THREE.Mesh });
    });
  }
  expect(found).toHaveLength(1);
  const { root, floor } = found[0];
  return { root, shell: floor.parent!, floor };
}

/** 물체와 그 위 조상이 방(root)까지 모두 보이는지. */
function shownUpTo(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false;
    if (p === root) return true;
  }
  return false;
}

/**
 * 한 프레임을 그린다: useFrame을 모두 부른 뒤, 방에서 보이는 것만 훑어 그리는 물체마다
 * WebGLRenderer.renderObject처럼 object.onBeforeRender, material.onBeforeRender를 부른다.
 */
async function drawFrame() {
  await act(async () => {
    const state = { camera: mockThree.camera!, gl: {}, clock: { elapsedTime: 0 }, scene: mockThree.scene! };
    for (const part of [...mockFrames]) part(state, 0.05);
    const renderer = {} as THREE.WebGLRenderer;
    for (const root of primitives()) {
      root.traverseVisible((o) => {
        const mesh = o as THREE.Mesh;
        if (!(mesh.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine)) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          o.onBeforeRender(renderer, mockThree.scene!, mockThree.camera!, mesh.geometry, material, null as unknown as THREE.Group);
          material.onBeforeRender(renderer, mockThree.scene!, mockThree.camera!, mesh.geometry, o, null as unknown as THREE.Group);
        }
      });
    }
  });
  await flushAsync();
}

// ---------- 준비 ----------

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockFiles.clear();
  mockFiles.set(FURNITURE_FILE, { value: fakeFurnitureGltf() });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ---------- 테스트 ----------

describe("[spec] 구운 방 껍데기가 먼저 들어오면 바닥 그림을 만들지 않는다(081 결정 2)", () => {
  test("K-F7 기본 방에서 구운 방 껍데기를 미리 읽어 둔 채로 로비를 열고 5프레임을 그리면, 코드로 지은 방은 숨어 있고 바닥 재질에 그림이 없다", async () => {
    roomLoads();
    expect(currentRoom().id).toBe("basic");
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    // 3D 그리기 자체는 그려졌다(방이 없어서 그림이 없는 것이 아니다)
    const { root, shell, floor } = codeRoom(8, 11);
    expect(shell.visible).toBe(false);
    for (let frame = 0; frame < 5; frame += 1) {
      await drawFrame();
      expect(shell.visible).toBe(false);
      expect(shownUpTo(floor, root)).toBe(false);
      expect((floor.material as THREE.MeshLambertMaterial).map).toBeNull();
    }
  });
});
