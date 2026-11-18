// [spec] qa 테스트(작업 110, 버그 수정: 마을에 있는 동안에도 방 창밖 풍경을 그림판에 그려 FPS가 떨어진다).
// 기대값은 명세(private 작업 폴더 110-2026-11-18-마을-창밖-그리기/01-main-spec.md)에서만 가져온다.
// - 재현(고치기 전에는 실패해야 한다): H1~H5. 창이나 창을 담은 묶음 가운데 하나가 보이지 않는 동안(마을 등)은
//   창밖 풍경을 그림판(렌더 타깃)에 그리지 않고, 창밖 장면도 움직이지 않는다(update를 받지 않는다).
// - 고친 뒤의 동작(고치기 전에는 실패한다): V1~V4. 창이 다시 보이게 된 첫 프레임에 그린다(앞서 그린 그림을 오래된 채 두지 않는다).
//   그 그림은 그 순간의 시각·하루의 때·창 자리를 따르고, 그 뒤로는 방에서처럼 0.1초마다 그린다.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): K1~K2. 방이 보이는 동안 그리는 때는 고치기 전과 같다.
//   방에서 그리는 방식 전체는 작업 076의 lobby3d-window-view-rate.spec.test.tsx가 본다(그 파일은 그대로 둔다).
//
// 어떻게 보나(구현 코드는 부르는 방법을 알려고만 읽었다. 틀은 lobby3d-window-view-rate.spec.test.tsx와 같다):
// - 가구 묶음(lobby3d-furniture의 BakedFurniture)을 진짜로 그리고, Jest에서 돌지 않는 react-three-fiber만 가짜로 둔다.
//   useFrame은 테스트가 부를 때 한 프레임씩 돈다. 한 프레임은 16ms이고, 시계(clock)·Date.now·performance.now가 함께 16ms씩 간다.
// - 3D 화면(lobby3d-canvas)처럼 장면(scene) 아래 "방에만 있는 것" 묶음(<group visible={area === "room"}>)을 두고, 그 안에
//   가구 묶음을 넣는다. 마을에 간 것은 그 묶음의 visible을 false로 하는 것이다(3D 화면이 하는 것과 같다).
// - "창밖을 그렸다"는 gl.render가 창밖 장면을 받은 것이다. 그림판으로 바꾼 것(setRenderTarget에 그림판)과
//   창밖 장면이 update를 받은 것(움직임)도 프레임마다 적는다.
//
// 프레임 k(0부터)의 시계는 16(k+1)ms다. 카메라·창문이 그대로면 앞서 그린 뒤 96ms면 아직, 112ms면 그린다(7프레임마다).
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
const mockGltfList: { source: unknown; value: unknown[] } = { source: undefined, value: [] };
/** 가짜 창밖 장면이 받은 것. updates는 update를 받은 프레임 번호다. */
const mockOutdoor: {
  scene: THREE.Object3D | null;
  lastT: number | null;
  updates: number[];
  lastDaylight: { ambience: unknown; season: unknown; phase: unknown } | null;
} = { scene: null, lastT: null, updates: [], lastDaylight: null };
/** 지금 도는 프레임 번호(가짜 창밖 장면이 읽는다). */
const mockClock = { frame: -1 };

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
    createOutdoor: () => {
      const scene = new T.Scene();
      mockOutdoor.scene = scene;
      return {
        scene,
        setDaylight: (ambience: unknown, season: unknown, phase: unknown) => {
          mockOutdoor.lastDaylight = { ambience, season, phase };
        },
        update: (t: number) => {
          mockOutdoor.lastT = t;
          mockOutdoor.updates.push(mockClock.frame);
        },
        dispose: () => {}
      };
    }
  };
});

// ---------- 가짜 glb ----------

/** 모델 이름마다 0.5칸 상자 하나를 주는 가구 모델. 창 안쪽 판(windowView)은 창 안쪽 크기의 판이다. */
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
  outdoorPosition: THREE.Vector3;
  outdoorRotationY: number;
  updateT: number | null;
  daylight: { ambience: unknown; season: unknown; phase: unknown } | null;
}

const BASE_MS = Date.UTC(2026, 10, 18, 3, 0, 0);
const FRAME_MS = 16;

let frameNo = -1;
let elapsedMs = 0;
let currentTarget: unknown = null;
let draws: Draw[] = [];
/** 그림판(화면이 아닌 곳)으로 바꾼 프레임 번호. */
let targetSwitches: number[] = [];
let camera: THREE.PerspectiveCamera;
let daylight: DaylightState;
let lightLayout: { current: LobbyLayout };
let windowLift: { current: { x: number; y: number; z: number } };
let fallback: THREE.Group;
let root: THREE.Object3D | null = null;
/** 3D 화면의 장면과, 그 안의 "방에만 있는 것" 묶음(마을에서 숨긴다). */
let scene: THREE.Scene;
let roomGroup: THREE.Group;

const SCREEN_TARGET = null;

const gl = {
  getRenderTarget: () => currentTarget,
  setRenderTarget: (target: unknown) => {
    if (target !== SCREEN_TARGET) targetSwitches.push(frameNo);
    currentTarget = target;
  },
  render: (drawnScene: THREE.Object3D) => {
    if (drawnScene !== mockOutdoor.scene) return;
    draws.push({
      frame: frameNo,
      elapsed: elapsedMs / 1000,
      outdoorPosition: drawnScene.position.clone(),
      outdoorRotationY: drawnScene.rotation.y,
      updateT: mockOutdoor.lastT,
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
  mockClock.frame = -1;
  elapsedMs = 0;
  currentTarget = SCREEN_TARGET;
  draws = [];
  targetSwitches = [];
  mockOutdoor.scene = null;
  mockOutdoor.lastT = null;
  mockOutdoor.updates = [];
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
  expect(primitives).toHaveLength(1);
  root = (primitives[0].props as { object: THREE.Object3D }).object;
  // 3D 화면처럼 장면 > 방에만 있는 것 묶음 > 가구 묶음으로 넣는다
  scene = new THREE.Scene();
  roomGroup = new THREE.Group();
  scene.add(roomGroup);
  roomGroup.add(root);
  return view;
}

async function frame(before?: () => void) {
  before?.();
  frameNo += 1;
  mockClock.frame = frameNo;
  elapsedMs += FRAME_MS;
  const state: FrameState = {
    camera,
    gl,
    clock: { elapsedTime: elapsedMs / 1000, getElapsedTime: () => elapsedMs / 1000 },
    scene
  };
  await act(async () => {
    for (const part of [...mockFrames]) part(state, FRAME_MS / 1000);
  });
}

async function frames(n: number, before?: (index: number) => void) {
  for (let index = 0; index < n; index += 1) await frame(before ? () => before(index) : undefined);
}

const drawnFrames = () => draws.map((d) => d.frame);
const inRange = (list: number[], first: number, last: number) => list.filter((f) => f >= first && f <= last);

function windowPiece(): THREE.Object3D {
  const found: THREE.Object3D[] = [];
  root!.traverse((o) => {
    if (o.userData.view === true) found.push(o);
  });
  expect(found).toHaveLength(1);
  return found[0];
}

/** 3D 화면이 하는 것처럼 창문을 다른 자리로 옮긴다(창밖 장면이 따를 배치와 창문 가구의 자리를 함께 바꾼다). */
function placeWindow(wall: WallPlacementData) {
  const layout = windowAt(wall);
  lightLayout.current = layout;
  windowLift.current = { x: 0, y: 0, z: 0 };
  const place = furniturePlacements(layout).find((p) => p.view);
  expect(place).toBeDefined();
  const piece = windowPiece();
  piece.position.set(place!.x, place!.y, place!.z);
  piece.rotation.y = place!.rotY;
}

function moveCamera(dx: number) {
  camera.position.x += dx;
  camera.updateMatrixWorld();
}

/** 마을에 간다/방으로 돌아온다(3D 화면의 방에만 있는 것 묶음을 숨기고 보인다). */
const goVillage = () => {
  roomGroup.visible = false;
};
const backToRoom = () => {
  roomGroup.visible = true;
};

/** 숨긴 프레임 first..last 동안 창밖을 그리지 않았고, 그림판으로 바꾸지 않았고, 창밖 장면이 움직이지 않았다. */
function expectNothingWhileHidden(first: number, last: number) {
  expect(inRange(drawnFrames(), first, last)).toEqual([]);
  expect(inRange(targetSwitches, first, last)).toEqual([]);
  expect(inRange(mockOutdoor.updates, first, last)).toEqual([]);
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

// ---------- 재현: 보이지 않는 동안 그리지 않는다 ----------

describe("[spec] 110 창이 보이지 않는 동안 창밖을 그리지 않는다(재현)", () => {
  it("H1: 마을에 간 동안(방에만 있는 것 묶음이 숨겨짐) 카메라가 그대로여도 0.1초가 지나도 그리지 않고, 창밖 장면도 움직이지 않는다", async () => {
    await mount();
    await frame();
    expect(drawnFrames()).toEqual([0]);
    goVillage();
    // 프레임 1~40(0.64초): 고치기 전에는 7, 14, 21, 28, 35에 그린다
    await frames(40);
    expectNothingWhileHidden(1, 40);
    expect(drawnFrames()).toEqual([0]);
    expect(mockOutdoor.updates).toEqual([0]);
  });

  it("H2: 마을에서 걷는 동안(카메라가 프레임마다 움직임)도 그리지 않고, 창밖 장면도 움직이지 않는다", async () => {
    await mount();
    await frame();
    goVillage();
    // 프레임 1~20: 고치기 전에는 카메라가 움직여 매 프레임 그린다
    await frames(20, () => moveCamera(0.3));
    expectNothingWhileHidden(1, 20);
    expect(drawnFrames()).toEqual([0]);
    expect(mockOutdoor.updates).toEqual([0]);
  });

  it("H3: 가구 묶음이 숨겨진 동안 그리지 않는다", async () => {
    await mount();
    await frame();
    root!.visible = false;
    await frames(20, (index) => {
      if (index % 2 === 0) moveCamera(0.3);
    });
    expectNothingWhileHidden(1, 20);
    expect(drawnFrames()).toEqual([0]);
  });

  it("H4: 창문 가구 자체가 숨겨진 동안(창을 담은 묶음은 보여도) 그리지 않는다", async () => {
    await mount();
    await frame();
    windowPiece().visible = false;
    await frames(20, (index) => {
      if (index % 2 === 0) moveCamera(0.3);
    });
    expectNothingWhileHidden(1, 20);
    expect(drawnFrames()).toEqual([0]);
  });

  it("H5: 처음부터 마을이면(창이 한 번도 보인 적 없음) 처음 프레임에도 그리지 않는다", async () => {
    await mount();
    goVillage();
    await frames(30, (index) => {
      if (index % 3 === 0) moveCamera(0.3);
    });
    expectNothingWhileHidden(0, 29);
    expect(drawnFrames()).toEqual([]);
    expect(mockOutdoor.updates).toEqual([]);
  });
});

// ---------- 고친 뒤: 다시 보이게 된 첫 프레임에 그린다 ----------

describe("[spec] 110 창이 다시 보이면 그 첫 프레임에 그린다", () => {
  it("V1: 마을에 오래 있다가(카메라 그대로) 방으로 돌아오면 돌아온 첫 프레임에 그 순간의 모습을 그리고, 그 뒤로는 0.1초마다 그린다", async () => {
    await mount();
    await frame();
    goVillage();
    await frames(30); // 프레임 1~30
    backToRoom();
    await frames(20); // 프레임 31~50
    // 돌아온 프레임 31(512ms), 그 뒤 0.1초가 지난 첫 프레임 38(624ms), 45(736ms)
    expect(drawnFrames()).toEqual([0, 31, 38, 45]);
    const back = draws[1];
    expect(back.updateT).toBeCloseTo(back.elapsed, 9);
    expect(back.updateT).toBeCloseTo(0.512, 9);
  });

  it("V2: 앞서 그린 뒤 0.1초가 안 되어 돌아와도(카메라·창 그대로) 돌아온 첫 프레임에 그린다", async () => {
    await mount();
    await frame(); // 프레임 0에 그린다
    goVillage();
    await frames(3); // 프레임 1~3(마지막으로 그린 뒤 48ms)
    backToRoom();
    await frames(17); // 프레임 4~20
    // 돌아온 프레임 4(80ms), 그 뒤 11(192ms), 18(304ms)
    expect(drawnFrames()).toEqual([0, 4, 11, 18]);
  });

  it("V3: 마을에 있는 동안 걸었고 창 자리와 하루의 때가 바뀌었으면, 돌아온 첫 프레임의 그림은 지금 창 자리와 하루의 때를 따른다", async () => {
    await mount();
    await frame();
    goVillage();
    await frames(10, () => moveCamera(0.3)); // 프레임 1~10
    // 마을에 있는 동안 창 자리(꾸미기로 옮긴 배치)와 하루의 때(밤)가 바뀐다
    placeWindow(LEFT_WINDOW);
    const night = daylightAt(new Date(Date.UTC(2026, 0, 15, 13, 0, 0)));
    daylight.ambience = ambienceAt(night.sun);
    daylight.target = night;
    await frames(5); // 프레임 11~15
    backToRoom();
    await frame(); // 프레임 16
    expectNothingWhileHidden(1, 15);
    expect(drawnFrames()).toEqual([0, 16]);
    const back = draws[1];
    const leftMount = wallPiecePose(LEFT_WINDOW, ROOM.width);
    expect(back.outdoorRotationY).toBeCloseTo(leftMount.rotY, 9);
    expect(back.outdoorPosition.x).toBeCloseTo(leftMount.x, 9);
    expect(back.outdoorPosition.z).toBeCloseTo(leftMount.z, 9);
    expect(back.daylight).toEqual({ ambience: daylight.ambience, season: night.season, phase: night.phase });
    expect(back.updateT).toBeCloseTo(back.elapsed, 9);
  });

  it("V4: 숨겨졌던 창문 가구가 다시 보이면 그 첫 프레임에 그린다", async () => {
    await mount();
    await frame();
    windowPiece().visible = false;
    await frames(4); // 프레임 1~4
    windowPiece().visible = true;
    await frames(10); // 프레임 5~14
    // 보인 프레임 5(96ms), 그 뒤 12(208ms)
    expect(drawnFrames()).toEqual([0, 5, 12]);
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 110 방이 보이는 동안 창밖 그리기는 그대로다", () => {
  it("K1: 방이 보이는 동안 카메라·창문이 그대로면 처음 한 번 그리고, 그 뒤에는 0.1초마다 그린다(1.12초에 10번)", async () => {
    await mount();
    await frames(70);
    expect(drawnFrames()).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56, 63]);
    expect(mockOutdoor.updates).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56, 63]);
  });

  it("K2: 방이 보이는 동안 카메라가 움직이면 매 프레임 그리고, 멈추면 마지막으로 그린 뒤 0.1초가 지나야 다시 그린다", async () => {
    await mount();
    await frames(14);
    await frames(10, () => moveCamera(0.3)); // 프레임 14~23
    await frames(26); // 프레임 24~49
    expect(drawnFrames()).toEqual([0, 7, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 30, 37, 44]);
  });
});
