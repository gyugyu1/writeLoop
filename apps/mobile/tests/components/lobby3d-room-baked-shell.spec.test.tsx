// [spec] qa 재현 테스트(작업 066-⑥ 방 구조 데이터, 검증 지적 뒤 테스트 더하기, 모바일): 구운 방 껍데기는 지금 방이 기본 방일 때만 그린다.
// 기대값은 결정 파일(private 작업 폴더 066/07-방-구조-데이터/11-main-decision.md 2의 의심 2, 명세 2 "구운 방 껍데기는 기본 방 전용")에서만 가져온다.
// - K1(지금 방이 기본 방이면 그린다): 이미 있는 동작이라 테스트 커밋 시점에도 통과가 맞다.
// - R5(지금 방이 기본 방이 아니면 그리지 않는다): 테스트 커밋 시점(고치기 전)에는 실패가 맞다.
//
// 어떻게 보나(구현 코드는 부르는 방법을 알려고만 읽었다. 가짜 모듈 구성은 lobby3d-edit-scene-rebuild.spec과 같다):
// - 화면(Lobby3dScreen)과 3D 그리기(Lobby3dCanvas)는 진짜를 쓰고, Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다.
// - 구운 방(lobby3d-room의 BakedRoom)은 그려질 때마다 횟수를 세는 가짜로 바꿔, 3D 그리기가 그것을 그렸는지 본다.
// - 다른 방은 engine의 applyRoom으로 그리기 전에 바꾸고, 테스트가 끝나면 기본 방과 처음 배치로 되돌린다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, applyRoom } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, currentRoom, type RoomSpec } from "@/lib/lobby3d/room";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
const mockGltf: { value: unknown } = { value: null };
/** 090-② 05 결정 3: 가구 일곱 파일 목록에 주는 가짜 모델 배열(같은 가짜 모델이면 같은 배열). */
const mockGltfList: { source: unknown; value: unknown[] } = { source: undefined, value: [] };
const mockBaked = { renders: 0 };

// three는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(lobby3d-edit-scene-rebuild.spec과 같다)
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
    // 090-② 05 결정 3: 가구는 앱에 든 처음 방 일곱 파일을 한 번에(목록으로) 읽는다. 목록이면 파일마다 같은 가짜 모델을 준다
    // (진짜 useLoader처럼 같은 파일 목록에는 같은 배열을 준다)
    useLoader: (_loader: unknown, input: unknown) => {
      if (!Array.isArray(input)) return mockGltf.value;
      if (mockGltfList.source !== mockGltf.value || mockGltfList.value.length !== input.length) {
        mockGltfList.source = mockGltf.value;
        mockGltfList.value = input.map(() => mockGltf.value);
      }
      return mockGltfList.value;
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
// 090-② 05 결정 3: 일곱 밖 가구는 기기에 받은 모델 파일을 GLTFLoader.loadAsync로 읽는다(같은 가짜 모델을 준다)
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync() {
      return Promise.resolve(mockGltf.value);
    }
  }
}));
// 090-② 05 결정 3: 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱의 파일이다(Jest가 읽지 못하는 파일이라 이름만 준다)
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
// 구운 방: 그려질 때마다 센다
jest.mock("@/components/lobby3d/lobby3d-room", () => ({
  BakedRoom: () => {
    mockBaked.renders += 1;
    return null;
  },
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

const NOW = new Date("2026-11-12T03:00:00.000Z");

/** 시험용 방 T(03-qa-scenarios 0절): 9×13, 벽 높이 3.6, 벽 두께 0.5, 세 벽, 밖으로 출입구 하나(가운데 x 3.0, 폭 2.0, 깊이 0.7). */
const ROOM_T: RoomSpec = {
  id: "qa-test",
  width: 9,
  depth: 13,
  wallHeight: 3.6,
  wallThickness: 0.5,
  hangWalls: ["back", "left", "right"],
  exits: [{ kind: "outside", x: 3.0, width: 2.0, depth: 0.7 }]
};

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
  return { scene };
}

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** 3D 그리기가 내놓은 <primitive> 수(방·가구 장면이 그려졌는지). */
function primitiveCount(): number {
  return screen.container.queryAll((instance: TestInstance) => instance.type === "primitive").length;
}

async function frames(n = 3) {
  for (let index = 0; index < n; index += 1) {
    await act(async () => {
      for (const part of [...mockFrames]) part({ camera: mockThree.camera!, gl: {}, clock: { elapsedTime: 0 }, scene: mockThree.scene! }, 0.05);
    });
  }
}

async function renderLobby(layout: LobbyLayout) {
  await render(<Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={async (value: LobbyLayout) => value} />);
  await flushAsync();
  await frames();
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockThree.camera = new THREE.PerspectiveCamera(30, mockThree.size.width / mockThree.size.height, 1, 200);
  mockThree.scene = new THREE.Scene();
  mockFrames.clear();
  mockGltf.value = fakeFurnitureGltf();
  mockBaked.renders = 0;
});

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
});

describe("[spec] 구운 방 껍데기는 기본 방 전용(11 결정 2, 의심 2)", () => {
  test("K1 지금 방이 기본 방이면 구운 방 껍데기를 그린다", async () => {
    expect(currentRoom().id).toBe("basic");
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    expect(primitiveCount()).toBeGreaterThan(0);
    expect(mockBaked.renders).toBeGreaterThan(0);
  });

  test("R5 지금 방이 기본 방이 아니면(시험용 방 T) 구운 방 껍데기를 그리지 않는다", async () => {
    applyRoom(ROOM_T);
    applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
    expect(currentRoom().id).toBe("qa-test");
    await renderLobby(DEFAULT_LOBBY_LAYOUT);
    // 3D 그리기 자체는 그려졌다(방이 없어서 안 그린 것이 아니다)
    expect(primitiveCount()).toBeGreaterThan(0);
    expect(mockBaked.renders).toBe(0);
  });
});
