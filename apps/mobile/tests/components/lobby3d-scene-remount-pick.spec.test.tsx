// [spec] qa 재현 테스트(작업 091 로비 누르기 판정이 지워짐, 버그 수정, 모바일): 3D 그리기 안의 장면 부분(Scene)이 다시 만들어질 때
// 새 장면 부분이 먼저 누르기 판정(pickRef)을 넣고 옛 장면 부분의 정리가 뒤에 돌면, 그 뒤 방을 눌러도 라룹이가 움직이지 않는 증상을 본다.
// 기대값은 명세(private 작업 폴더 091-2026-11-14-로비-누르기-판정-지워짐/01-main-spec.md)의 "기대 동작"과 "그대로여야 할 동작"에서만 가져온다.
// - R1~R3(고치기 전 실패가 맞다): 장면 부분이 "새 것 넣기 → 옛 것 지우기" 순서로 다시 만들어진 뒤에도
//   바닥을 누르면 걷고(pointerUp "walk"), 라룹이를 누르면 반응하고(pointerUp "poke"), 장소를 누르면 장소로 간다(pointerUp "walk", 누른 장소).
// - K1·K2(그대로, 통과가 맞다): "옛 것 지우기 → 새 것 넣기" 순서(앱을 백그라운드로 보냈다 돌아온 경우)로 다시 만들어진 뒤에는 지금처럼 걷는다.
//   장면 부분이 하나도 없을 때(사라진 뒤)는 누르기 판정이 지금처럼 비어 있다(누른 자리 null).
//
// 어떻게 보나:
// - 판(lobby3d-tabletop-pick-scope.spec)과 같은 틀이다. three는 진짜, react-three-fiber만 가짜이고, 화면(Lobby3dScreen)과 3D 그리기는 진짜를 그린다.
// - 가짜 Canvas는 장면 부분을 세대(key)별로 그린다. 세대 목록을 [0] → [0, 1] → [1]로 바꾸면 새 장면 부분이 먼저 들어와 effect가 돌고(첫 커밋),
//   옛 장면 부분은 다음 커밋에서 빠져 정리가 돈다. 이것이 명세의 임시 로그 순서("넣기 → (옛 것의) 지우기")다.
//   [0] → [1]을 한 커밋에 바꾸면 React가 옛 것의 정리를 먼저 돌린다("지우기 → 넣기").
// - 라룹이(lobby3d-character)는 가짜다. 보이지 않는 통(isCharacter)을 단 묶음을 handleRef에 넣고, 정리할 때는 자기가 넣은 것일 때만 지운다
//   (라룹이 손잡이의 같은 문제는 lobby3d-character-handle-remount.spec이 진짜 Character로 본다. 여기서는 누르기 판정만 가린다).
// - 누르기 결과는 3D 그리기가 화면에 넘기는 onPointer의 hit과, 화면이 부르는 sim.pointerUp의 돌려준 값으로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, type LobbySim, type PointerHit } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type FramePart = (state: { camera: THREE.Camera; gl: unknown; clock: { elapsedTime: number }; scene: THREE.Scene }, delta: number) => void;

const mockThree: { camera: THREE.PerspectiveCamera | null; scene: THREE.Scene | null; size: { width: number; height: number } } = {
  camera: null,
  scene: null,
  size: { width: 400, height: 800 }
};
const mockFrames = new Set<FramePart>();
const mockGltf: { value: unknown } = { value: null };
const mockGltfList: { source: unknown; value: unknown[] } = { source: undefined, value: [] };
const mockHits: { phase: string; hit: PointerHit | null }[] = [];
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
/** 가짜 Canvas가 그리는 장면 부분의 세대 목록을 바꾸는 손잡이. */
const mockGenerations: { set: ((update: (gens: number[]) => number[]) => void) | null } = { set: null };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    // 장면 부분(children)을 세대마다 따로(key) 그린다. 세대 목록은 테스트가 바꾼다
    Canvas: ({ children }: { children: React.ReactNode }) => {
      const [generations, setGenerations] = React.useState<number[]>([0]);
      mockGenerations.set = setGenerations;
      return React.createElement(
        React.Fragment,
        null,
        generations.map((generation) => React.createElement(React.Fragment, { key: `scene-${generation}` }, children))
      );
    },
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
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    loadAsync() {
      return Promise.resolve(mockGltf.value);
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
// 가짜 라룹이: 보이지 않는 통(isCharacter)을 단 묶음. 매 프레임 sim 자리로 옮긴다
jest.mock("@/components/lobby3d/lobby3d-character", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    BUBBLE_HEIGHT: 2,
    CharacterErrorBoundary: ({ children }: { children: unknown }) => children,
    Character: ({ handleRef }: { handleRef: { current: unknown } }) => {
      const group = React.useMemo(() => {
        const g = new T.Group();
        const hit = new T.Mesh(new T.CapsuleGeometry(0.6, 1.5, 4, 8), new T.MeshBasicMaterial());
        hit.visible = false;
        hit.position.y = 1.35;
        hit.userData.isCharacter = true;
        g.add(hit);
        return g;
      }, []);
      React.useEffect(() => {
        const handle = {
          group,
          update: (sim: { x: number; z: number }) => {
            group.position.set(sim.x, 0, sim.z);
            return 0;
          },
          bubblePoint: () => new T.Vector3(group.position.x, 2, group.position.z)
        };
        handleRef.current = handle;
        return () => {
          if (handleRef.current === handle) handleRef.current = null;
        };
      }, [group, handleRef]);
      return React.createElement("primitive", { object: group });
    }
  };
});
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

const NOW = new Date("2026-11-14T03:00:00.000Z");
const SLOW_TEST_MS = 30_000;
/** 누를 바닥 점(가구가 없는 빈 바닥). */
const FLOOR_POINT = { x: 5, y: 0, z: 6 };

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

/** 장면 점의 화면 좌표. 화면 안이어야 한다. */
function toScreen(p: { x: number; y: number; z: number }) {
  camera().updateMatrixWorld();
  const v = new THREE.Vector3(p.x, p.y, p.z).project(camera());
  const { width, height } = mockThree.size;
  const at = { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  expect(at.x > 0 && at.x < width && at.y > 0 && at.y < height && v.z <= 1 && v.z >= -1).toBe(true);
  return at;
}

function touchView(): TestInstance {
  const views = screen.container.queryAll((instance: TestInstance) => {
    const props = instance.props as { onResponderGrant?: unknown; onStartShouldSetResponderCapture?: unknown; onResponderRelease?: unknown };
    return (
      typeof instance.type === "string" &&
      typeof props.onResponderGrant === "function" &&
      typeof props.onResponderRelease === "function" &&
      typeof props.onStartShouldSetResponderCapture === "function" &&
      instance.queryAll((child: TestInstance) => child.type === "primitive").length > 0
    );
  });
  expect(views).toHaveLength(1);
  return views[0];
}

async function touch(handler: "onResponderGrant" | "onResponderRelease" | "onResponderTerminate", at: { x: number; y: number }, known?: TestInstance) {
  const view = known ?? touchView();
  await act(async () => {
    (view.props as Record<string, (event: unknown) => void>)[handler]({ nativeEvent: { locationX: at.x, locationY: at.y } });
  });
}

function sim(): LobbySim {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!.sim;
}

/** 누르고 바로 뗀다(톡). 누를 때 3D 그리기가 넘긴 누른 자리와, 뗄 때 sim.pointerUp이 돌려준 값을 돌려준다. */
async function tapAt(at: { x: number; y: number }): Promise<{ hit: PointerHit | null; result: string | undefined }> {
  const spy = jest.spyOn(sim(), "pointerUp");
  const before = mockHits.length;
  try {
    await touch("onResponderGrant", at);
    await touch("onResponderRelease", at);
    const down = mockHits.slice(before).find((entry) => entry.phase === "down");
    expect(down).toBeDefined();
    const results = spy.mock.results;
    expect(results).toHaveLength(1);
    return { hit: down!.hit, result: results[0].value as string };
  } finally {
    spy.mockRestore();
  }
}

/** 누르기 시작과 취소만 넣어, 누른 자리만 본다(걷기가 시작되지 않는다). */
async function probeAt(at: { x: number; y: number }, known?: TestInstance): Promise<PointerHit | null> {
  const before = mockHits.length;
  await touch("onResponderGrant", at, known);
  const down = mockHits.slice(before).find((entry) => entry.phase === "down");
  await touch("onResponderTerminate", at, known);
  expect(down).toBeDefined();
  return down!.hit;
}

async function setGenerations(update: (gens: number[]) => number[]) {
  expect(mockGenerations.set).not.toBeNull();
  await act(async () => {
    mockGenerations.set!(update);
  });
  await flushAsync();
  await frames();
}

/** 명세의 재현 순서: 새 장면 부분이 먼저 들어와 누르기 판정을 넣고(첫 커밋), 옛 장면 부분이 뒤에 빠지며 정리가 돈다(다음 커밋). */
async function rebuildSceneNewFirst() {
  await setGenerations((gens) => [...gens, 1]);
  expect(screen.container.queryAll((instance: TestInstance) => instance.type === "primitive").length > 0).toBe(true);
  await setGenerations((gens) => gens.filter((generation) => generation !== 0));
}

/** 앱을 백그라운드로 보냈다 돌아온 순서: 한 커밋에 옛 장면 부분이 빠지고 새 장면 부분이 들어온다(옛 정리 → 새 넣기). */
async function rebuildSceneOldFirst() {
  await setGenerations(() => [1]);
}

/** 장소 가구(대체 모양 묶음)의 상자 가운데. 처음 장면 부분만 있을 때 부른다. */
function markCenter(mark: string): { x: number; y: number; z: number } {
  const groups: THREE.Object3D[] = [];
  scene().traverse((o) => {
    if (o.userData.mark === mark && typeof o.userData.furnitureOf === "string") groups.push(o);
  });
  expect(groups).toHaveLength(1);
  const center = new THREE.Box3().setFromObject(groups[0]).getCenter(new THREE.Vector3());
  return { x: center.x, y: center.y, z: center.z };
}

function LobbyHost({ loaded }: { loaded: LobbyLayout }) {
  const [layout, setLayout] = useState(loaded);
  const save = async (value: LobbyLayout) => {
    const saved = JSON.parse(JSON.stringify(value)) as LobbyLayout;
    setLayout(saved);
    return saved;
  };
  return <Lobby3dScreen devPanel={false} layout={layout} onSaveLayout={save} />;
}

async function renderLobby() {
  await render(<LobbyHost loaded={JSON.parse(JSON.stringify(DEFAULT_LOBBY_LAYOUT)) as LobbyLayout} />);
  await flushAsync();
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
  mockGenerations.set = null;
  mockGltf.value = fakeFurnitureGltf();
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
});

// ---------- 기대 동작: 새 것 넣기 → 옛 것 지우기 순서로 다시 만들어진 뒤 ----------

describe("[spec] 091 기대 동작: 장면 부분이 다시 만들어진 뒤(새 것 넣기 → 옛 것 지우기)에도 지금처럼 누를 수 있다", () => {
  test(
    "R1 바닥을 누르면 걷는다(누른 자리에 바닥 점이 있고 pointerUp이 walk)",
    async () => {
      await renderLobby();
      // 전제: 다시 만들기 전에는 같은 바닥 점을 눌러 걷는다
      const before = await tapAt(toScreen(FLOOR_POINT));
      expect({ point: before.hit?.point !== null && before.hit?.point !== undefined, result: before.result }).toEqual({ point: true, result: "walk" });

      await rebuildSceneNewFirst();

      const after = await tapAt(toScreen(FLOOR_POINT));
      expect(after.hit).not.toBeNull();
      expect(after.hit!.point).not.toBeNull();
      expect(after.hit!.point!.x).toBeCloseTo(FLOOR_POINT.x, 1);
      expect(after.hit!.point!.z).toBeCloseTo(FLOOR_POINT.z, 1);
      expect(after.result).toBe("walk");
    },
    SLOW_TEST_MS
  );

  test(
    "R2 라룹이를 누르면 반응한다(누른 자리가 라룹이이고 pointerUp이 poke)",
    async () => {
      await renderLobby();
      const at = () => toScreen({ x: sim().x, y: 1.2, z: sim().z });
      const before = await tapAt(at());
      expect({ onCharacter: before.hit?.onCharacter ?? null, result: before.result }).toEqual({ onCharacter: true, result: "poke" });

      await rebuildSceneNewFirst();

      const after = await tapAt(at());
      expect(after.hit).not.toBeNull();
      expect(after.hit!.onCharacter).toBe(true);
      expect(after.result).toBe("poke");
    },
    SLOW_TEST_MS
  );

  test(
    "R3 장소(책장)를 누르면 장소로 간다(누른 자리가 bookcase이고 pointerUp이 walk, sim.goTo가 bookcase로 불려 true)",
    async () => {
      await renderLobby();
      const point = markCenter("bookcase");
      const before = await probeAt(toScreen(point));
      expect(before?.mark ?? null).toBe("bookcase");

      await rebuildSceneNewFirst();

      const goTo = jest.spyOn(sim(), "goTo");
      try {
        const after = await tapAt(toScreen(point));
        expect(after.hit).not.toBeNull();
        expect(after.hit!.mark).toBe("bookcase");
        expect(after.result).toBe("walk");
        // 장소로 가는 길을 잡았다(sim.goTo가 그 장소로 불려 true)
        expect(goTo.mock.calls.map((call) => call[1])).toEqual(["bookcase"]);
        expect(goTo.mock.results.map((r) => r.value)).toEqual([true]);
      } finally {
        goTo.mockRestore();
      }
    },
    SLOW_TEST_MS
  );
});

// ---------- 그대로여야 할 동작 ----------

describe("[spec] 091 그대로: 옛 것 지우기 → 새 것 넣기 순서와 장면 부분이 사라진 뒤", () => {
  test(
    "K1 옛 것 지우기 → 새 것 넣기 순서(백그라운드에서 돌아옴)로 다시 만들어진 뒤 바닥을 누르면 걷는다",
    async () => {
      await renderLobby();
      await rebuildSceneOldFirst();

      const after = await tapAt(toScreen(FLOOR_POINT));
      expect(after.hit).not.toBeNull();
      expect(after.hit!.point).not.toBeNull();
      expect(after.hit!.point!.x).toBeCloseTo(FLOOR_POINT.x, 1);
      expect(after.hit!.point!.z).toBeCloseTo(FLOOR_POINT.z, 1);
      expect(after.result).toBe("walk");
    },
    SLOW_TEST_MS
  );

  test(
    "K2 장면 부분이 하나도 없을 때(사라진 뒤)는 누르기 판정이 비어 있어 누른 자리가 null이다",
    async () => {
      await renderLobby();
      const at = toScreen(FLOOR_POINT);
      // 장면 부분이 없으면 3D 물체(primitive)가 없어 누르는 판을 그것으로 찾지 못하므로, 미리 찾아 둔다
      const view = touchView();
      await setGenerations(() => []);
      expect(screen.container.queryAll((instance: TestInstance) => instance.type === "primitive")).toHaveLength(0);

      const hit = await probeAt(at, view);
      expect(hit).toBeNull();
    },
    SLOW_TEST_MS
  );
});
