// [spec] qa 테스트(작업 119 마을 첫 프레임 끊김, 버그 수정, 모바일): 마을이 보이기 전(검은 화면으로 가린 동안)에
// 마을 장면의 셰이더를 미리 만들고 그림을 모두 올린 뒤, 프레임이 고르게 그려지면(연달아 5프레임이 각각 34ms 안, 또는 준비 시작 후 3초) onReady를 알린다.
// 기대값은 명세(119-2026-11-19-마을-첫-프레임-끊김/01-main-spec.md)의 기대 동작 1~4에서만 가져왔다.
// 구현 코드는 부르는 방법(Lobby3dCanvas 속성 area·onVillageReady·onVillageFailed, VillageLayer가 require하는 ./lobby3d-village의
// VillageNature·VillageModelErrorBoundary·VillageModel, 장면 준비는 gl.compile/compileAsync·gl.initTexture)을 알려고만 읽었다.
//
// 어떻게 보나: react-three-fiber와 방·가구·라룹이·창밖·마을 모듈을 가짜로 두고 진짜 Lobby3dCanvas만 그린다.
// 방을 먼저 그려 방 준비(warmUpScenes)를 끝낸 뒤(실제 흐름과 같다) 구역을 마을로 바꾸고, 그때부터 gl 호출과 알림 순서를 본다.
// 가짜 마을 모델은 장면에 뿌리 하나를 붙인다: 화면 안 건물(그림 near)과 화면 밖 가게(그림 far, 멀리 떨어진 자리).
//
// 바뀔 동작(고치기 전 실패): V1, V2, V3. 그대로 둘 동작(통과): V4, V5.
import { act, render } from "@testing-library/react-native";
import { createElement, type ReactNode } from "react";
import * as THREE from "three";
import Lobby3dCanvas, { type Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import { LobbySim } from "@/lib/lobby3d/engine";
import { daylightAt } from "@/lib/lobby3d/daylight";

type FrameState = Record<string, unknown>;
type FramePart = (state: FrameState, delta: number) => void;
type GlCall = { kind: "compile"; target: unknown } | { kind: "initTexture"; texture: unknown };

const mockFrames = new Set<FramePart>();
const mockGlLog: GlCall[] = [];
const mockThree: { scene: THREE.Scene; camera: THREE.PerspectiveCamera; size: { width: number; height: number }; gl: unknown } = {
  scene: null as unknown as THREE.Scene,
  camera: null as unknown as THREE.PerspectiveCamera,
  size: { width: 400, height: 800 },
  gl: null
};
const mockVillage: { status: "loaded" | "failed"; root: THREE.Group | null; compileThrows: boolean } = {
  status: "loaded",
  root: null,
  compileThrows: false
};
const mockClock = { elapsedTime: 0, getElapsedTime: () => mockClock.elapsedTime, getDelta: () => 0 };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const state = () => ({ ...mockThree, clock: mockClock });
  return {
    Canvas: ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: (selector?: (s: unknown) => unknown) => (selector ? selector(state()) : state()),
    useFrame: (callback: FramePart) => {
      const ref = React.useRef(callback);
      ref.current = callback;
      React.useEffect(() => {
        const entry: FramePart = (s, d) => ref.current(s, d);
        mockFrames.add(entry);
        return () => {
          mockFrames.delete(entry);
        };
      }, []);
    },
    useLoader: () => ({ scene: new (jest.requireMock<typeof import("three")>("three").Group)(), animations: [] })
  };
});
jest.mock("@/components/lobby3d/lobby3d-character", () => ({
  BUBBLE_HEIGHT: 2,
  Character: () => null,
  CharacterErrorBoundary: ({ children }: { children: ReactNode }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-furniture", () => ({
  BakedFurniture: () => null,
  BakedFurnitureErrorBoundary: ({ children }: { children: ReactNode }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-room", () => ({
  BakedRoom: () => null,
  BakedRoomErrorBoundary: ({ children }: { children: ReactNode }) => children
}));
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return { createOutdoor: () => ({ scene: new T.Scene(), setDaylight: () => {}, update: () => {}, dispose: () => {} }) };
});
jest.mock("@/components/lobby3d/lobby3d-daylight", () => ({
  ...jest.requireActual("@/components/lobby3d/lobby3d-daylight"),
  DaylightRig: () => null
}));
// 가짜 마을: 모델을 읽었으면 장면에 뿌리를 붙이고, 읽지 못했으면 오류 경계가 onFailed를 부른다
jest.mock("@/components/lobby3d/lobby3d-village", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  class Boundary extends React.Component<{ children: ReactNode; onFailed?: () => void }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch() {
      this.props.onFailed?.();
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }
  return {
    VillageNature: () => null,
    VillageModelErrorBoundary: Boundary,
    VillageModel: () => {
      if (mockVillage.status === "failed") throw new Error("마을 모델을 읽지 못했다(테스트 가짜)");
      return React.createElement("primitive", { object: mockVillage.root });
    }
  };
});

let nearTexture: THREE.Texture;
let farTexture: THREE.Texture;
let readyCount = 0;
let failedCount = 0;
let shownCount = 0;
let sim: LobbySim;

function makeVillageRoot(): THREE.Group {
  nearTexture = new THREE.DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1, THREE.RGBAFormat);
  farTexture = new THREE.DataTexture(new Uint8Array([4, 5, 6, 255]), 1, 1, THREE.RGBAFormat);
  const root = new THREE.Group();
  const near = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: nearTexture }));
  const far = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: farTexture }));
  far.position.set(0, 0, -500);
  root.add(near, far);
  return root;
}

function makeGl(): unknown {
  const known: Record<string, unknown> = {
    compile: (target: unknown) => {
      if (mockVillage.compileThrows) throw new Error("셰이더 준비 오류(테스트 가짜)");
      mockGlLog.push({ kind: "compile", target });
      return new Set();
    },
    compileAsync: (target: unknown) => {
      if (mockVillage.compileThrows) return Promise.reject(new Error("셰이더 준비 오류(테스트 가짜)"));
      mockGlLog.push({ kind: "compile", target });
      return Promise.resolve(target);
    },
    initTexture: (texture: unknown) => {
      mockGlLog.push({ kind: "initTexture", texture });
    },
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    render: () => {}
  };
  return new Proxy(known, {
    get(target, property) {
      if (typeof property === "symbol" || property === "then") return undefined;
      if (property in target) return target[property];
      return () => {};
    }
  });
}

/** r3f는 primitive를 장면에 붙인다. 가짜 Canvas는 붙이지 않으므로 마을 뿌리가 그려졌으면(모델을 읽었으면) 직접 붙인다. */
function attachVillage(drawn: boolean) {
  if (drawn && mockVillage.root && mockVillage.root.parent !== mockThree.scene) mockThree.scene.add(mockVillage.root);
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

let villageDrawn = false;

async function frameAfter(ms: number, count = 1) {
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      mockClock.elapsedTime += ms / 1000;
      attachVillage(villageDrawn);
      const state: FrameState = { ...mockThree, clock: mockClock };
      for (const part of [...mockFrames]) part(state, ms / 1000);
      await Promise.resolve();
      jest.advanceTimersByTime(0);
    });
    await flush();
  }
}

function props(area: "room" | "village"): Lobby3dCanvasProps {
  return {
    sim,
    viewWidth: 12,
    toon: { steps: 3, outline: 1 },
    onFrame: () => {},
    onPointer: () => {},
    onProject: () => {},
    daylight: daylightAt(new Date(2026, 5, 21, 12, 30)),
    area,
    onRoomShown: () => {
      shownCount += 1;
    },
    onVillageReady: () => {
      readyCount += 1;
    },
    onVillageFailed: () => {
      failedCount += 1;
    }
  };
}

/** 방을 먼저 그려 방 준비를 끝내고(실제 흐름), 구역을 마을로 바꾼 뒤 gl 기록을 비운다. */
async function goVillage(status: "loaded" | "failed" = "loaded", compileThrows = false) {
  const view = await render(createElement(Lobby3dCanvas, props("room")));
  await flush();
  await frameAfter(16, 8);
  expect(shownCount).toBe(1);
  mockVillage.status = status;
  mockVillage.compileThrows = compileThrows;
  villageDrawn = status === "loaded";
  mockGlLog.length = 0;
  readyCount = 0;
  failedCount = 0;
  await view.rerender(createElement(Lobby3dCanvas, props("village")));
  await flush();
  return view;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockFrames.clear();
  mockGlLog.length = 0;
  mockThree.scene = new THREE.Scene();
  mockThree.camera = new THREE.PerspectiveCamera(40, 0.5, 1, 200);
  mockThree.gl = makeGl();
  mockVillage.status = "loaded";
  mockVillage.compileThrows = false;
  mockVillage.root = makeVillageRoot();
  mockClock.elapsedTime = 0;
  villageDrawn = false;
  readyCount = 0;
  failedCount = 0;
  shownCount = 0;
  sim = new LobbySim();
});
afterEach(() => {
  jest.useRealTimers();
});

const compiled = () => mockGlLog.filter((c) => c.kind === "compile").map((c) => (c as { target: THREE.Object3D }).target);
const uploaded = () => mockGlLog.filter((c) => c.kind === "initTexture").map((c) => (c as { texture: unknown }).texture);
/** 마을 뿌리를 포함하는 장면(또는 뿌리 자신)을 셰이더 미리 만들기에 넘겼는지. */
const compiledVillage = () =>
  compiled().some((t) => t === mockVillage.root || t === mockThree.scene || t.getObjectById(mockVillage.root!.id) !== undefined);

describe("[spec] 마을 첫 프레임 준비", () => {
  test("V1 마을 모델이 들어와도 프레임 전에는 알리지 않고, 첫 프레임에서 마을 장면 전체(화면 밖 그림 포함)를 미리 만들고 올린다", async () => {
    await goVillage();
    expect(readyCount).toBe(0);
    await frameAfter(16);
    expect(compiledVillage()).toBe(true);
    expect(uploaded()).toContain(nearTexture);
    expect(uploaded()).toContain(farTexture);
    // 준비한 프레임에서는 아직 고르게 그려졌는지 모르므로 알리지 않는다
    expect(readyCount).toBe(0);
  });

  test("V2 준비 뒤 연달아 5프레임이 각각 34ms 안이면 그때 한 번 알린다(4프레임까지는 알리지 않는다)", async () => {
    await goVillage();
    await frameAfter(16); // 준비
    await frameAfter(16, 4);
    expect(readyCount).toBe(0);
    await frameAfter(16);
    expect(readyCount).toBe(1);
    await frameAfter(16, 3);
    expect(readyCount).toBe(1);
  });

  test("V3 프레임이 계속 느리면(50ms) 준비를 시작하고 3초가 지난 프레임에 알린다", async () => {
    await goVillage();
    await frameAfter(50); // 준비
    await frameAfter(50, 50); // 2.5초
    expect(readyCount).toBe(0);
    await frameAfter(50, 12); // 3.1초 넘김
    expect(readyCount).toBe(1);
  });

  test("V4 미리 준비 중에 오류가 나도 마을은 보인다(준비를 건너뛰고 알린다)", async () => {
    await goVillage("loaded", true);
    await frameAfter(16, 10);
    expect(readyCount).toBe(1);
    expect(failedCount).toBe(0);
  });

  test("V5 마을 모델을 읽지 못하면 onFailed로 알리고 onReady는 알리지 않는다", async () => {
    await goVillage("failed");
    await frameAfter(16, 10);
    expect(failedCount).toBe(1);
    expect(readyCount).toBe(0);
  });
});
