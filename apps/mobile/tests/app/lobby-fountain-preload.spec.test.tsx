// [spec] qa 테스트(작업 118 마을 분수대 교체, 기능 변경, 모바일): 새 분수 모델 파일(village-fountain.glb)을 앱이 시작될 때 미리 읽고, 마을은 그 읽기를 함께 써서 다시 읽지 않는다.
// 기대값은 명세(private 작업 폴더 118-2026-11-19-마을-분수대-교체/01-main-spec.md)의 바뀌는 동작 2("마을 모델과 따로 읽고, 미리 읽기도 같은 자산을 읽는다")와 그대로 둘 동작
// ("미리 읽기 실패가 앱 시작을 막지 않는 것")에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// 어떻게 보나(작업 113 qa 테스트 tests/app/lobby-tree-preload.spec.test.tsx와 같은 방법. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - "앱이 시작된다"는 앱 틀(src/app/_layout.tsx의 기본 내보내기)을 그리고 가짜 시계를 1초까지 돌리는 것이다. 화면 묶음(expo-router Stack)은 아무 화면도 그리지 않는 가짜다.
// - "모델을 읽는다"는 GLTFLoader의 load(또는 loadAsync)가 그 파일로 불리는 것이다. 가짜 GLTFLoader는 부른 파일을 적어 두고, 끝내는 것은 테스트가 정한다.
//   분수 파일은 앱 자산 폴더의 그 파일을 GLTFLoader 모양으로 푼 모델(tests/__fixtures__/village-fountain-model-118.ts)로, 나무 파일은 113 도우미의 모델로,
//   마을 모델·꽃 모델은 빈 장면으로, 그림은 빈 Texture로 끝낸다. 분수 모델 파일은 파일 이름 글자("village-fountain.glb")로 바꾼다.
// - react-three-fiber는 진짜(useLoader와 그 캐시)를 쓴다. Jest에서 돌지 않는 Canvas·useFrame·useThree만 가짜로 둔다.
// - "마을에 나간다"는 마을 그리기의 VillageNature와 VillageModel을 lobby3d-canvas의 VillageLayer와 같은 모양(모델 오류 경계 > Suspense > 모델)으로 그리는 것이다.
// - "분수가 그려졌다" = 그린 장면(<primitive object> 전부)에 석재(1534 삼각형)·물(1186 삼각형) 메시가 하나씩 있다(tests/__fixtures__/village-fountain-118.ts isFountainMesh118).
// - 구현이 모듈 상태를 둘 수 있고 useLoader 캐시도 모듈에 있으므로, 테스트마다 모듈을 새로 읽는다(jest.resetModules).
/* eslint-disable @typescript-eslint/no-require-imports */
import type { ComponentType } from "react";
import { FOUNTAIN_ASSET_NAME, isFountainMesh118, isFountainUrl } from "../__fixtures__/village-fountain-118";
import { buildFountainGltf } from "../__fixtures__/village-fountain-model-118";
import { buildTreeGltf, isTreeUrl, mockTreeAssets } from "../__fixtures__/village-trees-113";
// 120: 마을이 가로등 모델 파일도 읽으므로 그 파일에는 푼 모양을 준다(빈 장면이 아니다)
import { isLampUrl } from "../__fixtures__/village-streetlamp-120";
import { buildLampGltf } from "../__fixtures__/village-streetlamp-model-120";

type Load = { kind: "texture" | "gltf"; url: string; onLoad: (data: unknown) => void; onError: (error: unknown) => void; settled: boolean };

const mockLoads: Load[] = [];
const mockSession = { mode: "pending" as "pending" | "loggedOut" | "loggedIn" };
const mockThree = { camera: null as unknown, scene: { background: null as unknown }, size: { width: 400, height: 800 } };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/utils/BufferGeometryUtils.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "utils", "BufferGeometryUtils.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const actual = jest.requireActual("@react-three/fiber/native");
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => mockThree,
    useFrame: () => {}
  };
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  class GLTFLoader {
    load(url: unknown, onLoad?: (data: unknown) => void, _onProgress?: unknown, onError?: (error: unknown) => void) {
      mockLoads.push({ kind: "gltf", url: String(url), onLoad: onLoad ?? (() => {}), onError: onError ?? (() => {}), settled: false });
    }
    loadAsync(url: unknown) {
      return new Promise((resolve, reject) => this.load(url, resolve, undefined, reject));
    }
    parse() {}
    setPath() {
      return this;
    }
    setResourcePath() {
      return this;
    }
    setCrossOrigin() {
      return this;
    }
    setRequestHeader() {
      return this;
    }
    setDRACOLoader() {
      return this;
    }
    setKTX2Loader() {
      return this;
    }
    setMeshoptDecoder() {
      return this;
    }
    register() {
      return this;
    }
  }
  return { GLTFLoader };
});
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (object: { clone: (recursive: boolean) => unknown }) => object.clone(true)
}));
jest.mock("three/examples/jsm/geometries/RoundedBoxGeometry.js", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    RoundedBoxGeometry: function RoundedBoxGeometry(width: number, height: number, depth: number) {
      return new T.BoxGeometry(width, height, depth);
    }
  };
});
jest.mock("@/assets/models/lobby-room.glb", () => "lobby-room.glb");
jest.mock("@/assets/models/writeloop.glb", () => "writeloop.glb");
jest.mock("@/assets/models/furniture/desk.glb", () => "furniture/desk.glb");
jest.mock("@/assets/models/furniture/bookcase.glb", () => "furniture/bookcase.glb");
jest.mock("@/assets/models/furniture/board.glb", () => "furniture/board.glb");
jest.mock("@/assets/models/furniture/window.glb", () => "furniture/window.glb");
jest.mock("@/assets/models/furniture/wardrobe.glb", () => "furniture/wardrobe.glb");
jest.mock("@/assets/models/furniture/rug.glb", () => "furniture/rug.glb");
jest.mock("@/assets/models/furniture/lamp.glb", () => "furniture/lamp.glb");
jest.mock("@/assets/models/lobby-village.glb", () => "lobby-village.glb");
// 118: 새 분수 모델 파일(village-fountain.glb)도 마을·미리 읽기가 읽으므로 파일 이름 글자로 가짜로 바꾼다(파일이 아직 없어도 되는 가상 모듈이다. 단언은 그대로다)
jest.mock("../../assets/models/village-fountain.glb", () => "village-fountain.glb", { virtual: true });
// 120: 새 가로등 모델 파일(village-streetlamp.glb)도 마을·미리 읽기가 읽으므로 가짜로 바꾼다(파일이 아직 없어도 되는 가상 모듈이다. 단언은 그대로다)
jest.mock("../../assets/models/village-streetlamp.glb", () => "village-streetlamp.glb", { virtual: true });
jest.mock("@/assets/models/wear-goggles.glb", () => "wear-goggles.glb");
jest.mock("@/assets/models/village-flowers.glb", () => "village-flowers.glb");
jest.mock("@/assets/textures/village/season-scatter.png", () => "village/season-scatter.png");
jest.mock("@/assets/textures/village/dirt.jpg", () => "village/dirt.jpg");
jest.mock("@/assets/textures/village/dirt-b.jpg", () => "village/dirt-b.jpg");
jest.mock("@/assets/textures/village/ground-grass-short.jpg", () => "village/ground-grass-short.jpg");
jest.mock("@/assets/textures/village/ground-grass-lush.jpg", () => "village/ground-grass-lush.jpg");
jest.mock("@/assets/textures/village/ground-clover.jpg", () => "village/ground-clover.jpg");
jest.mock("@/assets/textures/village/ground-moss.jpg", () => "village/ground-moss.jpg");
jest.mock("@/assets/textures/village/ground-bare.jpg", () => "village/ground-bare.jpg");
// 새 나무 파일(머리말)
mockTreeAssets((_name, rel) => rel);

// 앱 틀이 쓰는 기기·외부 모듈(078·104 앱 시작 테스트와 같다)
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const RN = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
    Stack: () => React.createElement(RN.Text, null, "화면 묶음")
  };
});
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn()
}));
jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@/lib/sentry", () => ({ initSentry: jest.fn(), wrapWithSentry: (component: unknown) => component }));
jest.mock("@/components/app-update-notice", () => ({ __esModule: true, default: () => null }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => (mockSession.mode === "pending" ? new Promise(() => {}) : Promise.resolve(null))),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("@/lib/api", () => ({
  getCurrentUser: jest.fn(() => new Promise(() => {})),
  login: jest.fn(),
  loginWithApple: jest.fn(),
  loginWithSocial: jest.fn(),
  logout: jest.fn(() => Promise.resolve())
}));

type Rntl = typeof import("@testing-library/react-native/pure");
type Three = typeof import("three");
type VillageModule = typeof import("@/components/lobby3d/lobby3d-village");
type Modules = { lib: Rntl; THREE: Three; village: VillageModule };

let rntl: Rntl | null = null;
let restoreTextureLoad: (() => void) | null = null;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

function loadModules(): Modules {
  const lib = require("@testing-library/react-native/pure") as Rntl;
  rntl = lib;
  require("@react-three/fiber/native");
  const THREE = require("three") as Three;
  const original = THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load = function load(url: unknown, onLoad?: (t: unknown) => void, _p?: unknown, onError?: (e: unknown) => void) {
    mockLoads.push({ kind: "texture", url: String(url), onLoad: onLoad ?? (() => {}), onError: onError ?? (() => {}), settled: false });
    return new THREE.Texture();
  } as typeof original;
  restoreTextureLoad = () => {
    THREE.TextureLoader.prototype.load = original;
  };
  const village = require("@/components/lobby3d/lobby3d-village") as VillageModule;
  return { lib, THREE, village };
}

async function flush(lib: Rntl) {
  for (let step = 0; step < 10; step += 1) {
    await lib.act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
  }
}

async function startApp(m: Modules) {
  const RootLayout = require("@/app/_layout").default as ComponentType;
  const React = require("react") as typeof import("react");
  await m.lib.render(React.createElement(RootLayout));
  await flush(m.lib);
}

/** 끝나지 않은 읽기를 모두 끝낸다(분수·나무 파일은 그 파일을 푼 모델, 그 밖의 모델은 빈 장면, 그림은 빈 Texture). */
async function settleLoads(m: Modules) {
  for (let round = 0; round < 5; round += 1) {
    const pending = mockLoads.filter((load) => !load.settled);
    if (pending.length === 0) break;
    await m.lib.act(async () => {
      for (const load of pending) {
        load.settled = true;
        if (load.kind === "texture") load.onLoad(new m.THREE.Texture());
        else if (isFountainUrl(load.url)) load.onLoad(buildFountainGltf());
        else if (isTreeUrl(load.url)) load.onLoad(buildTreeGltf(load.url.split("/").pop()!));
        else if (isLampUrl(load.url)) load.onLoad(buildLampGltf());
        else load.onLoad({ scene: new m.THREE.Group(), scenes: [], animations: [], cameras: [], asset: {}, parser: {}, userData: {} });
      }
      await Promise.resolve();
    });
    await flush(m.lib);
  }
}

const fountainLoads = (from = 0) => mockLoads.slice(from).filter((load) => load.kind === "gltf" && isFountainUrl(load.url)).map((load) => load.url);

/** 마을에 나간다(VillageLayer 모양). 그린 장면 조각(<primitive object>)을 돌려주는 함수를 준다. */
async function enterVillage(m: Modules) {
  const React = require("react") as typeof import("react");
  const { daylightAt } = require("@/lib/lobby3d/daylight") as typeof import("@/lib/lobby3d/daylight");
  const { VILLAGE_START } = require("@/lib/lobby3d/village") as typeof import("@/lib/lobby3d/village");
  const d = daylightAt(new Date(2026, 5, 21, 12, 30));
  const light = { ambience: d.ambience, ceiling: 0, target: d } as unknown as import("@/components/lobby3d/lobby3d-daylight").DaylightState;
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true } as unknown as import("@/lib/lobby3d/engine").LobbySim;
  const view = await m.lib.render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(m.village.VillageNature, { daylight: light }),
      React.createElement(
        m.village.VillageModelErrorBoundary,
        null,
        React.createElement(React.Suspense, { fallback: null }, React.createElement(m.village.VillageModel, { sim, daylight: light, pickTargets: { current: [] } }))
      )
    )
  );
  await flush(m.lib);
  return () =>
    view.container
      .queryAll((instance: { type: unknown }) => instance.type === "primitive")
      .map((p) => (p.props as { object: import("three").Object3D }).object);
}

/** 그린 장면에서 보이는 분수 메시 수(석재·물). */
function drawnFountainMeshes(m: Modules, roots: import("three").Object3D[]): { stone: number; water: number } {
  const out = { stone: 0, water: 0 };
  for (const r of roots)
    r.traverse((o) => {
      if (!(o instanceof m.THREE.Mesh) || !isFountainMesh118(o)) return;
      let shown = true;
      for (let n: import("three").Object3D | null = o; n; n = n.parent) if (!n.visible) shown = false;
      if (!shown) return;
      const triangles = (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute("position").count) / 3;
      if (triangles === 1534) out.stone += 1;
      else out.water += 1;
    });
  return out;
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockLoads.length = 0;
  mockSession.mode = "pending";
  mockThree.scene.background = null;
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  if (rntl) await rntl.cleanup();
  rntl = null;
  restoreTextureLoad?.();
  restoreTextureLoad = null;
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

const VILLAGE_TEST_TIMEOUT_MS = 60000;

describe("[spec] 118 바뀌는 동작 2: 분수 모델 파일을 앱이 시작될 때 미리 읽고, 마을은 같은 읽기를 함께 쓴다", () => {
  test("[바뀔] F1 앱 틀을 그린 바로 뒤(어떤 화면도 그리지 않고 로그인 확인 전이어도) 분수 모델 파일(village-fountain.glb)을 한 번 읽기 시작한다", async () => {
    const m = loadModules();
    await startApp(m);
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect(fountainLoads()).toEqual([FOUNTAIN_ASSET_NAME]);
  });

  test(
    "[바뀔] F2 미리 읽기가 다 끝난 뒤 마을에 나가면, 분수 모델을 다시 읽지 않고 분수를 하나(석재·물 하나씩) 그린다",
    async () => {
      const m = loadModules();
      await startApp(m);
      expect(fountainLoads()).toEqual([FOUNTAIN_ASSET_NAME]);
      await settleLoads(m);
      const before = mockLoads.length;
      const drawn = await enterVillage(m);
      await settleLoads(m);
      expect(fountainLoads(before)).toEqual([]);
      expect(drawnFountainMeshes(m, drawn())).toEqual({ stone: 1, water: 1 });
    },
    VILLAGE_TEST_TIMEOUT_MS
  );

  test(
    "[바뀔] F3 미리 읽기가 아직 끝나지 않았을 때 마을에 나가도, 분수 모델을 다시 읽지 않고(같은 읽기를 기다린다) 읽기가 끝나면 분수를 그린다",
    async () => {
      const m = loadModules();
      await startApp(m);
      expect(fountainLoads()).toEqual([FOUNTAIN_ASSET_NAME]);
      const before = mockLoads.length;
      const drawn = await enterVillage(m);
      expect(fountainLoads(before)).toEqual([]);
      await settleLoads(m);
      expect(fountainLoads(before)).toEqual([]);
      expect(drawnFountainMeshes(m, drawn())).toEqual({ stone: 1, water: 1 });
    },
    VILLAGE_TEST_TIMEOUT_MS
  );

  test("[바뀔] F4 분수 모델 읽기가 실패해도 앱 시작은 이어진다(앱 틀이 그려지고 오류 화면이 뜨지 않는다)", async () => {
    const m = loadModules();
    await startApp(m);
    await m.lib.act(async () => {
      for (const load of mockLoads.filter((l) => l.kind === "gltf" && isFountainUrl(l.url) && !l.settled)) {
        load.settled = true;
        load.onError(new Error("분수 모델을 읽지 못했다"));
      }
      await Promise.resolve();
    });
    await flush(m.lib);
    expect(fountainLoads()).toEqual([FOUNTAIN_ASSET_NAME]);
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
  });
});
