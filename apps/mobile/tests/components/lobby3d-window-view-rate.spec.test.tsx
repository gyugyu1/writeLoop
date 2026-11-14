// [spec] qa 테스트(작업 076, 기능 변경: 로비 3D 창밖 풍경을 매 프레임 그리지 않고 초당 10번만 그린다).
// 기대값은 명세(private 작업 폴더 076-2026-11-11-로비-창밖-풍경-초당-10번/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작(K)의 숫자(창밖을 들여다보는 눈의 자리·원근)는 고치기 전 코드가 그리는 값을 그대로 적었다.
// - 바뀔 동작(고치기 전에는 실패해야 한다): C1~C5. 카메라·창문이 그대로면 앞서 그린 뒤 0.1초가 지났을 때만 창밖을 다시 그린다.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): K1~K7. 처음 보일 때·카메라가 움직이는 동안·창문이 옮겨지거나 떠 있는 동안·
//   다른 벽으로 옮긴 뒤에는 그 프레임에 그리고, 그린 그림은 그 순간의 시각·하루의 때·창문 자리·눈 자리를 따른다.
//
// 어떻게 보나(구현 코드는 부르는 방법을 알려고만 읽었다):
// - 가구 묶음(lobby3d-furniture의 BakedFurniture)을 진짜로 그리고, Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다.
//   useFrame은 테스트가 부를 때 한 프레임씩 돈다. 한 프레임은 16ms이고, 시계(clock)·Date.now·performance.now가 함께 16ms씩 간다.
// - glb 불러오기는 가짜다: 모델 이름마다 작은 상자 하나를 주고, 창 안쪽 판(windowView)은 창 안쪽 크기(1.87 × 1.66)의 판이다.
// - 창밖 장면(lobby3d-outdoor)은 받은 시각(update)·하루의 때(setDaylight)를 적어 두는 가짜다.
// - "창밖을 그렸다"는 gl.render가 창밖 장면을 받은 것이다. 그때의 그림판(setRenderTarget), 들여다본 눈(카메라), 창밖 장면의 자리와
//   창밖 장면이 그때까지 받은 시각·하루의 때를 적는다.
// - 카메라는 실제 3D 그리기처럼 자리·방향을 바꾼 뒤 updateMatrixWorld를 부른다. 창문 자리(lightLayout)·띄운 만큼(windowLift)은
//   3D 화면이 넘기는 것과 같은 ref를 테스트가 바꾸고, 창문 가구도 3D 화면처럼 그 자리에 띄운 만큼 더해 옮긴다(placeWindow).
//
// 프레임 k(0부터)의 시계는 16(k+1)ms다. 카메라·창문이 그대로면 그리는 프레임은 0, 7, 14, …(앞서 그린 뒤 96ms면 아직, 112ms면 그린다).
// 0.1초 경계(정확히 100ms)에 닿는 프레임은 없게 골랐다.
import { act, render } from "@testing-library/react-native";
import * as THREE from "three";
import type { TestInstance } from "test-renderer";
import { BakedFurniture } from "@/components/lobby3d/lobby3d-furniture";
import { createDaylightState, type DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { ambienceAt, daylightAt } from "@/lib/lobby3d/daylight";
import { ROOM, applyLobbyLayout } from "@/lib/lobby3d/engine";
import { furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, wallPiecePose, type LobbyLayout, type WallPlacementData } from "@/lib/lobby3d/lobby-layout";

type FrameState = {
  camera: THREE.Camera;
  gl: unknown;
  clock: { elapsedTime: number; getElapsedTime: () => number };
  scene: THREE.Scene;
};
type FramePart = (state: FrameState, delta: number) => void;

const mockFrames = new Set<FramePart>();
const mockGltf: { value: unknown } = { value: null };
/** 090-② 05 결정 3: 가구 일곱 파일 목록에 주는 가짜 모델 배열(같은 가짜 모델이면 같은 배열). */
const mockGltfList: { source: unknown; value: unknown[] } = { source: undefined, value: [] };
/** 가짜 창밖 장면이 받은 것. */
const mockOutdoor: {
  scene: THREE.Object3D | null;
  lastT: number | null;
  dtSum: number;
  lastDaylight: { ambience: unknown; season: unknown; phase: unknown } | null;
} = { scene: null, lastT: null, dtSum: 0, lastDaylight: null };

// three(0.187)는 ES 모듈만 있어 Jest를 거치지 않는 Node의 require로 읽는다(lobby3d-edit-scene-rebuild.spec과 같다)
jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => ({}),
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
    createOutdoor: () => {
      const scene = new T.Scene();
      mockOutdoor.scene = scene;
      return {
        scene,
        setDaylight: (ambience: unknown, season: unknown, phase: unknown) => {
          mockOutdoor.lastDaylight = { ambience, season, phase };
        },
        update: (t: number, dt: number) => {
          mockOutdoor.lastT = t;
          mockOutdoor.dtSum += dt;
        },
        dispose: () => {}
      };
    }
  };
});

// ---------- 가짜 glb ----------

/** 모델 이름마다 0.5칸 상자 하나를 주는 가구 묶음. 창 안쪽 판(windowView)은 창 안쪽 크기의 판이다. */
function fakeFurnitureGltf() {
  const scene = new THREE.Group();
  (scene as unknown as { getObjectByName: (name: string) => THREE.Object3D | undefined }).getObjectByName = (name: string) => {
    if (name === "windowView") return new THREE.Mesh(new THREE.PlaneGeometry(1.87, 1.66), new THREE.MeshStandardMaterial());
    const group = new THREE.Group();
    group.name = name;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial()));
    return group;
  };
  return { scene };
}

// ---------- 배치 ----------

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** 처음 배치에서 창문만 다른 자리에 건 배치. */
function windowAt(wall: WallPlacementData): LobbyLayout {
  const layout = copy(DEFAULT_LOBBY_LAYOUT);
  layout.items = layout.items.map((item) => (item.id === "window" ? { ...item, wall: { ...wall } } : item));
  return layout;
}

const BACK_WINDOW: WallPlacementData = { wall: "back", along: 4.8 };
const LEFT_WINDOW: WallPlacementData = { wall: "left", along: 3.5 };

// ---------- 그리기 기록 ----------

interface Draw {
  frame: number;
  elapsed: number;
  /** 그릴 때의 그림판 */
  target: unknown;
  eyePosition: THREE.Vector3;
  eyeQuaternion: THREE.Quaternion;
  projection: number[];
  outdoorPosition: THREE.Vector3;
  outdoorRotationY: number;
  /** 창밖 장면이 그때까지 받은 마지막 시각과, 받은 프레임 차이의 합 */
  updateT: number | null;
  dtSum: number;
  daylight: { ambience: unknown; season: unknown; phase: unknown } | null;
}

const BASE_MS = Date.UTC(2026, 10, 11, 3, 0, 0);
const FRAME_MS = 16;

let frameNo = -1;
let elapsedMs = 0;
let currentTarget: unknown = null;
let draws: Draw[] = [];
let restoredAfterDraw: boolean[] = [];
let camera: THREE.PerspectiveCamera;
let daylight: DaylightState;
let lightLayout: { current: LobbyLayout };
let windowLift: { current: { x: number; y: number; z: number } };
let fallback: THREE.Group;
let root: THREE.Object3D | null = null;

/** 화면(그림판이 아닌 곳). 3D 화면이 방을 그리는 곳이다. */
const SCREEN_TARGET = null;

const gl = {
  getRenderTarget: () => currentTarget,
  setRenderTarget: (target: unknown) => {
    // 창밖을 그린 바로 뒤에 화면으로 돌려놓는지 적는다
    if (draws.length > restoredAfterDraw.length && target === SCREEN_TARGET) restoredAfterDraw.push(true);
    currentTarget = target;
  },
  render: (scene: THREE.Object3D, eye: THREE.Camera) => {
    if (scene !== mockOutdoor.scene) return;
    const perspective = eye as THREE.PerspectiveCamera;
    draws.push({
      frame: frameNo,
      elapsed: elapsedMs / 1000,
      target: currentTarget,
      eyePosition: perspective.position.clone(),
      eyeQuaternion: perspective.quaternion.clone(),
      projection: [...perspective.projectionMatrix.elements],
      outdoorPosition: scene.position.clone(),
      outdoorRotationY: scene.rotation.y,
      updateT: mockOutdoor.lastT,
      dtSum: mockOutdoor.dtSum,
      daylight: mockOutdoor.lastDaylight ? { ...mockOutdoor.lastDaylight } : null
    });
  },
  clear: () => {},
  autoClear: true
};

function resetCamera() {
  camera = new THREE.PerspectiveCamera(30, 0.5, 0.1, 200);
  camera.position.set(4, 9, 15);
  camera.lookAt(4, 0, 4);
  camera.updateMatrixWorld();
}

async function mount() {
  frameNo = -1;
  elapsedMs = 0;
  currentTarget = SCREEN_TARGET;
  draws = [];
  restoredAfterDraw = [];
  mockOutdoor.scene = null;
  mockOutdoor.lastT = null;
  mockOutdoor.dtSum = 0;
  mockOutdoor.lastDaylight = null;
  resetCamera();
  daylight = createDaylightState(daylightAt(new Date(BASE_MS)));
  lightLayout = { current: windowAt(BACK_WINDOW) };
  windowLift = { current: { x: 0, y: 0, z: 0 } };
  fallback = new THREE.Group();
  const view = await render(
    <BakedFurniture fallback={fallback} daylight={daylight} layout={windowAt(BACK_WINDOW)} lightLayout={lightLayout} windowLift={windowLift} />
  );
  const primitives = view.container.queryAll((instance: TestInstance) => instance.type === "primitive");
  root = primitives.length === 1 ? (primitives[0].props as { object: THREE.Object3D }).object : null;
  return view;
}

/** 한 프레임을 돈다. before는 그 프레임 전에(앞 프레임 뒤에) 카메라·창문을 바꾸는 조작이다. */
async function frame(before?: () => void) {
  before?.();
  frameNo += 1;
  elapsedMs += FRAME_MS;
  const state: FrameState = {
    camera,
    gl,
    clock: { elapsedTime: elapsedMs / 1000, getElapsedTime: () => elapsedMs / 1000 },
    scene: new THREE.Scene()
  };
  await act(async () => {
    for (const part of [...mockFrames]) part(state, FRAME_MS / 1000);
  });
}

async function frames(n: number, before?: (index: number) => void) {
  for (let index = 0; index < n; index += 1) await frame(before ? () => before(index) : undefined);
}

const drawnFrames = () => draws.map((d) => d.frame);
/** first..last(둘 다 포함) 프레임 번호 */
const range = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => first + i);

/** 가구 묶음 안의 창문(창밖 판이 붙은 가구). */
function windowPiece(): THREE.Object3D {
  const found: THREE.Object3D[] = [];
  root!.traverse((o) => {
    if (o.userData.view === true) found.push(o);
  });
  expect(found).toHaveLength(1);
  return found[0];
}

/**
 * 3D 화면이 하는 것처럼 창문을 옮기고 띄운다: 창밖 장면이 따를 배치(lightLayout)와 띄운 만큼(windowLift)을 바꾸고,
 * 창문 가구도 그 배치의 자리에 띄운 만큼 더해 둔다(lobby3d-canvas의 poseFurniture·liftObjects와 같은 자리).
 */
function placeWindow(wall: WallPlacementData, lift = { x: 0, y: 0, z: 0 }) {
  const layout = windowAt(wall);
  lightLayout.current = layout;
  windowLift.current = { ...lift };
  const place = furniturePlacements(layout).find((p) => p.view);
  expect(place).toBeDefined();
  const piece = windowPiece();
  piece.position.set(place!.x + lift.x, place!.y + lift.y, place!.z + lift.z);
  piece.rotation.y = place!.rotY;
}

function moveCamera(dx: number) {
  camera.position.x += dx;
  camera.updateMatrixWorld();
}

function turnCamera(angle: number) {
  camera.rotateY(angle);
  camera.updateMatrixWorld();
}

beforeEach(() => {
  mockGltf.value = fakeFurnitureGltf();
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.spyOn(Date, "now").mockImplementation(() => BASE_MS + elapsedMs);
  if (typeof performance !== "undefined") jest.spyOn(performance, "now").mockImplementation(() => elapsedMs);
});

afterEach(() => {
  jest.restoreAllMocks();
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

// ---------- 바뀔 동작 ----------

describe("[spec] 076 창밖을 초당 10번만 그린다(바뀔 동작)", () => {
  it("C1: 카메라·창문이 그대로면 처음 한 번 그리고, 그 뒤에는 앞서 그린 뒤 0.1초가 지난 프레임에만 그린다(1.12초에 10번)", async () => {
    await mount();
    await frames(70);
    expect(drawnFrames()).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56, 63]);
  });

  it("C2: 카메라가 움직이는 동안은 매 프레임 그리고, 멈추면 마지막으로 그린 뒤 0.1초가 지나야 다시 그린다", async () => {
    await mount();
    await frames(14);
    // 프레임 14~23: 프레임마다 카메라 자리가 앞 프레임과 다르다(카메라 거리 바꾸기·라이트루프 따라가기처럼)
    await frames(10, () => moveCamera(0.3));
    // 프레임 24~49: 카메라가 멈춘다. 마지막으로 그린 프레임 23(384ms) 뒤 0.1초가 지난 첫 프레임은 30(496ms)이다
    await frames(26);
    expect(drawnFrames()).toEqual([0, 7, ...range(14, 23), 30, 37, 44]);
  });

  it("C3: 고른 창문이 떠 있는 동안(띄운 만큼이 프레임마다 다르다) 매 프레임 그리고, 내려놓으면 다시 0.1초마다 그린다", async () => {
    await mount();
    await frames(14);
    // 프레임 14~23: 고른 창문이 방 안쪽으로 떠서 출렁인다(3D 화면이 매 프레임 띄운 만큼을 바꾼다)
    await frames(10, (index) => {
      placeWindow(BACK_WINDOW, { x: 0, y: 0.02 * Math.sin(index + 1), z: 0.3 });
    });
    // 프레임 24~49: 내려놓아 띄운 만큼이 0으로 그대로다. 프레임 24는 앞 프레임과 띄운 만큼이 달라(0.3 → 0) 그린다
    placeWindow(BACK_WINDOW);
    await frames(26);
    // 프레임 24(400ms) 뒤 0.1초가 지난 첫 프레임은 31(512ms)이다
    expect(drawnFrames()).toEqual([0, 7, ...range(14, 24), 31, 38, 45]);
  });

  it("C4: 창문을 끌어 자리가 프레임마다 바뀌는 동안 매 프레임 그리고, 멈추면 다시 0.1초마다 그린다", async () => {
    await mount();
    await frames(14);
    // 프레임 14~19: 뒷벽을 따라 창문 자리가 프레임마다 바뀐다
    await frames(6, (index) => {
      placeWindow({ wall: "back", along: 4.8 + 0.3 * (index + 1) });
    });
    // 프레임 20~45: 그대로. 프레임 19(320ms) 뒤 0.1초가 지난 첫 프레임은 26(432ms)이다
    await frames(26);
    expect(drawnFrames()).toEqual([0, 7, ...range(14, 19), 26, 33, 40]);
  });

  it("C5: 창문을 다른 벽으로 옮기면 그 프레임에 바로 한 번 그리고, 그 뒤에는 그때부터 0.1초마다 그린다", async () => {
    await mount();
    await frames(10);
    // 프레임 10: 창문이 왼쪽 벽으로 옮겨진다(꾸미기에서 놓은 배치)
    placeWindow(LEFT_WINDOW);
    await frames(30);
    // 프레임 10(176ms) 뒤 0.1초가 지난 첫 프레임은 17(288ms)이다
    expect(drawnFrames()).toEqual([0, 7, 10, 17, 24, 31, 38]);
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 076 창밖 그리기에서 그대로 둘 동작", () => {
  it("K1: 처음 창이 보이는 프레임에 바로 그린다. 창 안쪽 판은 그 그림판을 보여 주고, 그린 뒤에는 화면으로 돌려놓는다", async () => {
    await mount();
    await frame();
    expect(drawnFrames()).toEqual([0]);
    const drawn = draws[0];
    expect(drawn.target).toBeInstanceOf(THREE.WebGLRenderTarget);
    expect(currentTarget).toBe(SCREEN_TARGET);
    // 창 안쪽 판(가구 묶음 안에서 그림판의 그림을 붙인 판)이 그 그림판의 그림을 보여 준다
    expect(root).not.toBeNull();
    const maps: unknown[] = [];
    root!.traverse((o) => {
      if (o instanceof THREE.Mesh && !Array.isArray(o.material) && (o.material as THREE.MeshBasicMaterial).map) {
        maps.push((o.material as THREE.MeshBasicMaterial).map);
      }
    });
    expect(maps).toEqual([(drawn.target as THREE.WebGLRenderTarget).texture]);
    // 그린 뒤로 더 돌려도 매번 같은 그림판에 그리고 화면으로 돌려놓는다
    await frames(30, () => moveCamera(0.01));
    expect(draws.length).toBeGreaterThan(1);
    for (const d of draws) expect(d.target).toBe(drawn.target);
    expect(restoredAfterDraw).toHaveLength(draws.length);
    expect(currentTarget).toBe(SCREEN_TARGET);
  });

  it("K2: 카메라 자리가 프레임마다 바뀌는 동안은 그 프레임마다 그린다", async () => {
    await mount();
    await frames(14);
    await frames(10, () => moveCamera(0.3));
    expect(drawnFrames()).toEqual(expect.arrayContaining(range(14, 23)));
  });

  it("K3: 카메라 방향만 프레임마다 바뀌는 동안도 그 프레임마다 그린다", async () => {
    await mount();
    await frames(14);
    await frames(10, () => turnCamera(0.02));
    expect(drawnFrames()).toEqual(expect.arrayContaining(range(14, 23)));
  });

  it("K4: 고른 창문이 떠 있는 동안과 창문 자리가 바뀌는 동안은 그 프레임마다 그리고, 다른 벽으로 옮긴 프레임에도 그린다", async () => {
    await mount();
    await frames(14);
    await frames(10, (index) => {
      placeWindow(BACK_WINDOW, { x: 0, y: 0.02 * Math.sin(index + 1), z: 0.3 });
    });
    placeWindow(BACK_WINDOW);
    await frames(30);
    await frames(6, (index) => {
      placeWindow({ wall: "back", along: 4.8 + 0.3 * (index + 1) });
    });
    await frames(30);
    placeWindow(LEFT_WINDOW);
    await frame();
    expect(drawnFrames()).toEqual(expect.arrayContaining([...range(14, 23), ...range(54, 59), 90]));
  });

  it("K5: 그린 그림은 그 순간의 모습이다. 창밖 장면은 그 프레임의 시각을 받았고, 받은 프레임 차이의 합은 지난 시간 전체다(구름이 느려지지 않는다)", async () => {
    await mount();
    await frames(14);
    await frames(10, () => moveCamera(0.3));
    await frames(26);
    expect(draws.length).toBeGreaterThan(0);
    for (const d of draws) {
      expect(d.updateT).toBeCloseTo(d.elapsed, 9);
      expect(d.dtSum).toBeCloseTo(d.elapsed, 9);
    }
  });

  it("K6: 그린 그림은 그 순간의 하루의 때 색감과 계절을 따른다", async () => {
    await mount();
    await frames(10);
    // 하루의 때가 밤으로 넘어간다(3D 화면의 햇빛이 같은 상태 객체를 바꾼다)
    const night = daylightAt(new Date(Date.UTC(2026, 0, 15, 13, 0, 0)));
    daylight.ambience = ambienceAt(night.sun);
    daylight.target = night;
    await frames(20);
    expect(draws.length).toBeGreaterThan(0);
    const after = draws.filter((d) => d.frame >= 10);
    expect(after.length).toBeGreaterThan(0);
    for (const d of after) expect(d.daylight).toEqual({ ambience: daylight.ambience, season: night.season, phase: night.phase });
  });

  it("K7: 창밖이 보이는 자리·눈 높이·원근과 창문이 걸린 벽을 따라가는 것은 고치기 전과 같다", async () => {
    await mount();
    await frame();
    // 뒷벽(along 4.8), 카메라 (4, 9, 15)에서 (4, 0, 4)를 볼 때
    const first = draws[0];
    const backMount = wallPiecePose(BACK_WINDOW, ROOM.width);
    expect(first.outdoorRotationY).toBeCloseTo(backMount.rotY, 9);
    expect(first.outdoorPosition.x).toBeCloseTo(backMount.x, 9);
    expect(first.outdoorPosition.z).toBeCloseTo(backMount.z, 9);
    expectVector(first.outdoorPosition, EXPECTED.back.outdoorPosition);
    expectVector(first.eyePosition, EXPECTED.back.eyePosition);
    expectQuaternion(first.eyeQuaternion, EXPECTED.back.eyeQuaternion);
    expectMatrix(first.projection, EXPECTED.back.projection);

    // 왼쪽 벽(along 3.5)으로 옮기고 방 안쪽으로 띄운 채, 카메라를 옮긴 뒤 그린 그림
    placeWindow(LEFT_WINDOW, { x: 0.3, y: 0.05, z: 0 });
    await frame(() => moveCamera(-1));
    const moved = draws[draws.length - 1];
    expect(moved.frame).toBe(1);
    const leftMount = wallPiecePose(LEFT_WINDOW, ROOM.width);
    expect(moved.outdoorRotationY).toBeCloseTo(leftMount.rotY, 9);
    expect(moved.outdoorPosition.x).toBeCloseTo(leftMount.x + 0.3, 9);
    expect(moved.outdoorPosition.y).toBeCloseTo(first.outdoorPosition.y + 0.05, 9);
    expect(moved.outdoorPosition.z).toBeCloseTo(leftMount.z, 9);
    expectVector(moved.eyePosition, EXPECTED.left.eyePosition);
    expectQuaternion(moved.eyeQuaternion, EXPECTED.left.eyeQuaternion);
    expectMatrix(moved.projection, EXPECTED.left.projection);
  });
});

// ---------- 고치기 전 코드가 그린 값(K7) ----------

const EXPECTED = {
  back: {
    outdoorPosition: [4.8, 0, 0],
    eyePosition: [4.4, 2.25, 2.77],
    eyeQuaternion: [0, 0, 0, 1],
    projection: [
      2.9411764630884374, 0, 0, 0, 0, 3.3132530786697307, 0, 0, 0.42780748554013626, -0.24096386026688946, -1.0458333333333334, -1, 0, 0,
      -5.626041666666667, 0
    ]
  },
  left: {
    eyePosition: [3.0699999999999994, 2.3, 5.000000000000001],
    eyeQuaternion: [0, 0.7071067811865475, 0, 0.7071067811865476],
    projection: [
      2.9411764630884374, 0, 0, 0, 0, 3.3132530786697307, 0, 0, 1.6042780707755113, -0.24096386026688946, -1.0458333333333334, -1, 0, 0,
      -5.626041666666667, 0
    ]
  }
};

/** 소수 여섯째 자리까지 같다. 다르면 받은 값 전체를 보여 준다. */
function expectNumbers(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  const same = actual.every((v, i) => Math.abs(v - expected[i]) < 5e-7);
  if (!same) throw new Error(`값이 다르다
받은 값: ${JSON.stringify(actual)}
기대 값: ${JSON.stringify(expected)}`);
}

function expectVector(actual: THREE.Vector3, expected: number[]) {
  expectNumbers([actual.x, actual.y, actual.z], expected);
}

function expectQuaternion(actual: THREE.Quaternion, expected: number[]) {
  expectNumbers([actual.x, actual.y, actual.z, actual.w], expected);
}

function expectMatrix(actual: number[], expected: number[]) {
  expectNumbers(actual, expected);
}
