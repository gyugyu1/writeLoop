// [spec] qa 재현 테스트(작업 066-④ 탁상형, 구현 뒤 테스트 더하기): 검증(private 작업 폴더 066/05-책상-위-소품/10-qa-verify.md)의 지적을
// 결정(같은 폴더 11-main-decision.md)대로 고칠 때의 누르기 판정을 본다. 기대값은 결정 파일과 명세(같은 폴더 01-main-spec.md 5·6)에서만 가져온다.
// - 결정 1(확실한 문제 1): 꾸미기에서 스탠드를 먼저 고르는 것은 스탠드 판정 앞에 맞은 것이 스탠드의 받침 가구(와 딸린 의자)뿐일 때만이다.
//   X1 스탠드 앞을 가린 옷장의 윗면·앞면 위쪽을 누르면 옷장이 골라진다(새 동작, 테스트 커밋 시점에 실패가 맞다).
//   K1 스탠드 판정이 책상과만 겹치는 곳을 누르면 스탠드가 골라진다(이미 있는 동작, 3단계 B3와 같다. 통과가 맞다).
// - 결정 2(의심 가는 문제 1): 꾸미기 밖에서는 넓힌 판정을 빼고 스탠드 모델 크기로만 누르기를 받는다. 누르면 책상 장소인 것은 그대로다(명세 5).
//   X2 꾸미기 밖에서 넓힌 판정 안이지만 책상·스탠드 모델에 닿지 않는 곳을 누르면 책상 장소가 아니다(새 동작, 실패가 맞다).
//   K2 꾸미기 밖에서 스탠드 모델을 누르면 책상 장소다(이미 있는 동작, 3단계 B10과 같다. 통과가 맞다).
// 어떻게 보나: 3단계 화면 테스트(lobby3d-tabletop-screen.spec.test.tsx)와 같은 틀이다(가짜 r3f, 가구 묶음은 0.8칸 가짜 상자이고 누르기 판정은
// 3D 그리기의 대체 상자(카탈로그의 칸에 맞춘 크기)와 넓힌 판정이 받는다). 누른 점마다 광선이 어느 상자를 지나는지를 전제로 단언해,
// 입력이 지적한 상황(가려짐, 넓힌 판정만)인지 확인한다. 상자는 카탈로그 값과 시나리오 0절의 좌표 약속으로 계산한다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { applyLobbyLayout, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { fittedModel, furnitureType } from "@/lib/lobby3d/furniture-catalog";
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
const LAMP: FurnitureItem = { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as FurnitureItem;

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const layoutOf = (items: FurnitureItem[], stored: StoredItem[] = []): LobbyLayout => copy(makeLayout(items, stored));

/** 새 처음 배치 N0(스탠드가 책상 자리 0). */
const N0_ITEMS: FurnitureItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8),
  LAMP
];
const N0 = layoutOf(N0_ITEMS);
/** 10-qa-verify의 재현 배치: 처음 배치에서 옷장을 책상 바로 앞, 스탠드 자리 0 앞 (0.5, 6.5, 방향 0)으로 옮긴 배치. */
const WARDROBE_FRONT = layoutOf(N0_ITEMS.map((item) => (item.id === "wardrobe" ? floor("wardrobe", "wardrobe", 0.5, 6.5, 0) : item)));

/** 책상 윗면 높이와 스탠드 자리 0 가운데. */
const TOP = 1.292;
const SLOT0 = { x: 0.5, z: 5.5 };

/** 칸에 맞춘 모델 상자(바닥 가구: 칸 뒤 끝에 붙임, 탁상형: 자리 가운데, 받침 윗면 위). 방향 0만 쓴다. */
function deskBox() {
  return new THREE.Box3(new THREE.Vector3(0, 0, 5), new THREE.Vector3(3, TOP, 6));
}
function lampModelBox() {
  const b = fittedModel(furnitureType("lamp")).box;
  return new THREE.Box3(
    new THREE.Vector3(SLOT0.x - b.width / 2, TOP, SLOT0.z - b.depth / 2),
    new THREE.Vector3(SLOT0.x + b.width / 2, TOP + b.height, SLOT0.z + b.depth / 2)
  );
}
/** 넓힌 판정(명세 6: 가로·깊이·높이가 적어도 0.8칸). */
function lampWideBox() {
  const b = fittedModel(furnitureType("lamp")).box;
  const w = Math.max(0.8, b.width);
  const h = Math.max(0.8, b.height);
  const d = Math.max(0.8, b.depth);
  return new THREE.Box3(new THREE.Vector3(SLOT0.x - w / 2, TOP, SLOT0.z - d / 2), new THREE.Vector3(SLOT0.x + w / 2, TOP + h, SLOT0.z + d / 2));
}
/** (0.5, 6.5, 방향 0)의 옷장 모델: 칸 x 0..1, z 6..7, 뒷면을 칸 뒤 끝(z 6)에 붙인다. */
function wardrobeBox() {
  const b = fittedModel(furnitureType("wardrobe")).box;
  return new THREE.Box3(new THREE.Vector3(0.5 - b.width / 2, 0, 6), new THREE.Vector3(0.5 + b.width / 2, b.height, 6 + b.depth));
}

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SLOW_TEST_MS = 30_000;

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

// ---------- 도우미(3단계 화면 테스트와 같다) ----------

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

function rayAt(at: { x: number; y: number }) {
  const { width, height } = mockThree.size;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((at.x / width) * 2 - 1, -(at.y / height) * 2 + 1), camera());
  return raycaster.ray;
}

/** 광선이 상자에 처음 닿는 거리(닿지 않으면 null). */
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

/** 누르기 시작과 취소만 넣어, 누른 곳의 누르기 결과를 본다(걷기·고르기·끌기가 끝나지 않는다). */
async function probeAt(at: { x: number; y: number }): Promise<PointerHit | null> {
  const before = mockHits.length;
  await touch("onResponderGrant", at);
  const down = mockHits.slice(before).find((entry) => entry.phase === "down");
  await touch("onResponderTerminate", at);
  expect(down).toBeDefined();
  return down!.hit;
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

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  resetMocks();
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.useRealTimers();
});

// ---------- 결정 1: 꾸미기에서 스탠드를 먼저 고르는 범위 ----------

describe("[spec] 066-④ 결정 1: 꾸미기에서 스탠드를 먼저 고르는 것은 앞에 받침 가구만 있을 때다", () => {
  test(
    "X1 (새 동작) 옷장을 (0.5, 6.5)로 옮긴 배치에서 스탠드 앞을 가린 옷장의 윗면 (0.5, 2.38, 6.2/6.5/6.8)과 앞면 위쪽 (0.5, 2.2, 6.9)을 누르면 옷장이 골라진다",
    async () => {
      await renderLobby(WARDROBE_FRONT);
      await enterEdit();
      const points = [
        { x: 0.5, y: 2.38, z: 6.2 },
        { x: 0.5, y: 2.38, z: 6.5 },
        { x: 0.5, y: 2.38, z: 6.8 },
        { x: 0.5, y: 2.2, z: 6.9 }
      ];
      // 전제(점마다 먼저 모두 본다): 광선이 옷장에 먼저 닿고, 그 뒤에 스탠드의 넓힌 판정도 지난다(스탠드가 옷장에 가려진 곳)
      for (const p of points) {
        const ray = rayAt(toScreen(p));
        const toWardrobe = distanceTo(ray, wardrobeBox());
        const toLamp = distanceTo(ray, lampWideBox());
        expect({ at: p, wardrobeFirst: toWardrobe !== null && toLamp !== null && toWardrobe < toLamp }).toEqual({ at: p, wardrobeFirst: true });
      }
      for (const p of points) {
        const hit = await probeAt(toScreen(p));
        expect({ at: p, piece: hit?.piece ?? null }).toEqual({ at: p, piece: "wardrobe" });
      }
    },
    SLOW_TEST_MS
  );

  test(
    "K1 (그대로) 스탠드의 넓힌 판정이 책상과만 겹치는 곳(모델 밖, 광선이 책상도 지남)을 누르면 스탠드가 골라진다",
    async () => {
      await renderLobby(N0);
      await enterEdit();
      const points = [
        { x: 0.8, y: TOP + 0.3, z: 5.5 },
        { x: 0.2, y: TOP + 0.3, z: 5.5 },
        { x: 0.5, y: TOP + 0.05, z: 5.8 }
      ];
      // 전제(점마다 먼저 모두 본다): 넓힌 판정과 책상을 지나고 스탠드 모델에는 닿지 않는다
      for (const p of points) {
        const ray = rayAt(toScreen(p));
        expect({
          at: p,
          wide: distanceTo(ray, lampWideBox()) !== null,
          desk: distanceTo(ray, deskBox()) !== null,
          model: distanceTo(ray, lampModelBox()) !== null
        }).toEqual({ at: p, wide: true, desk: true, model: false });
      }
      for (const p of points) {
        const hit = await probeAt(toScreen(p));
        expect({ at: p, piece: hit?.piece ?? null }).toEqual({ at: p, piece: "lamp" });
      }
    },
    SLOW_TEST_MS
  );
});

// ---------- 결정 2: 꾸미기 밖의 누르기 판정 ----------

describe("[spec] 066-④ 결정 2: 꾸미기 밖에서는 넓힌 판정을 빼고 스탠드 모델 크기로만 누른다", () => {
  test(
    "X2 (새 동작) 꾸미기 밖에서 넓힌 판정 안이지만 광선이 책상·스탠드 모델에 닿지 않는 (0.5, 2.142, 5.12)를 누르면 책상 장소가 아니다",
    async () => {
      await renderLobby(N0);
      // 스탠드 자리 0의 뒤쪽 위(가운데에서 깊이 -0.38, 윗면에서 0.85 위). 넓힌 판정(가운데에서 0.4, 높이 0.88) 안이고 모델 밖이다
      const p = { x: 0.5, y: TOP + 0.85, z: 5.12 };
      const at = toScreen(p);
      const ray = rayAt(at);
      expect({
        wide: distanceTo(ray, lampWideBox()) !== null,
        desk: distanceTo(ray, deskBox()) !== null,
        model: distanceTo(ray, lampModelBox()) !== null
      }).toEqual({ wide: true, desk: false, model: false });

      const hit = await probeAt(at);

      expect(hit?.mark ?? null).not.toBe("desk");
    },
    SLOW_TEST_MS
  );

  test(
    "K2 (그대로) 꾸미기 밖에서 스탠드 모델 (0.5, 1.692, 5.5)을 누르면 책상 장소다",
    async () => {
      await renderLobby(N0);
      const p = { x: 0.5, y: TOP + 0.4, z: 5.5 };
      const at = toScreen(p);
      expect(distanceTo(rayAt(at), lampModelBox())).not.toBeNull();

      const hit = await probeAt(at);

      expect(hit?.mark ?? null).toBe("desk");
    },
    SLOW_TEST_MS
  );
});
