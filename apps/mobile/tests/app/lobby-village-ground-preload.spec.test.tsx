// [spec] qa 테스트(작업 104 마을 진입 오류, 버그 수정, 모바일): 마을 땅 그림과 꽃 모델을 앱이 시작될 때 미리 읽고, 마을에 나갈 때 다시 읽지 않는다.
// 기대값은 명세(private 작업 폴더 104-2026-11-18-마을-진입-오류/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 f59d7cc의 지금 동작이다.
// 테스트 이름 앞의 [재현]은 고치기 전에 실패해야 하는 재현 테스트, [그대로]는 고치기 전·뒤 모두 통과해야 하는 테스트다.
//
// 명세 "원인": 마을에 나가는 순간 땅 그림 8장·꽃 모델을 처음 읽어 Suspense가 걸렸다 풀리며 3D 트리를 크게 다시 그리므로, 이때 오류가 잘 난다.
// 명세 "고치는 방법 2": 땅 꾸밈이 읽는 그림(계절 흩뿌림, 흙 a·b, 풀밭 무늬 다섯)과 꽃 모델을 마을 모델처럼 앱이 시작될 때(lobby3d-preload) 미리 읽기 시작한다.
//   땅 꾸밈은 같은 것을 함께 써서 마을에 나가는 순간 다시 읽지 않는다.
// 명세 "그대로여야 할 동작": 그림이나 모델을 못 읽으면 그 부분만 빠지는 동작(땅 꾸밈 오류 경계 등).
//
// 어떻게 보나(지금 코드는 부르는 방법을 알려고만 읽었다):
// - "앱이 시작된다"는 078의 tests/app/lobby-model-preload-start.spec.test.tsx와 같다: 앱 틀(src/app/_layout.tsx의 기본 내보내기)을 그리고 가짜 시계를 1초까지 돌린다.
//   화면 묶음(expo-router Stack)은 아무 화면도 그리지 않는 가짜다. 로그인은 확인되기 전(기억한 로그인 사용자를 읽는 중)으로 둔다.
// - "그림을 읽는다"는 THREE.TextureLoader의 load가 그 그림 파일로 불리는 것으로, "모델을 읽는다"는 GLTFLoader의 load(또는 loadAsync)가 그 모델 파일로 불리는 것으로 본다
//   (지금 땅 꾸밈이 쓰는 불러오기다). 두 불러오기는 부른 파일을 적어 두고, 끝내는 것(성공·실패)은 테스트가 정한다.
// - react-three-fiber는 진짜(useLoader와 그 캐시)를 쓴다. Jest에서 돌지 않는 Canvas·useFrame·useThree만 가짜로 둔다.
// - 그림·모델 파일은 Jest가 읽지 못하므로 "village/<파일 이름>" 같은 이름 문자열로 바꾼다(지금 로비 테스트들과 같다).
// - "마을에 나간다"는 마을 그리기의 VillageNature(땅 꾸밈을 자체 Suspense·오류 경계 안에 둔다)를 그리는 것으로 본다.
// - 구현이 모듈 상태를 둘 수 있고 useLoader 캐시도 모듈에 있으므로, 테스트마다 모듈을 새로 읽는다(jest.resetModules).
// 테스트마다 모듈을 새로 읽어야 해서(jest.resetModules) require로 읽는다.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { ComponentType } from "react";

/** 땅 꾸밈이 읽는 그림 여덟(계절 흩뿌림, 흙 a·b, 풀밭 무늬 다섯). 이름 문자열로 바꾼 값이다. */
const GROUND_PICTURES = [
  "village/dirt-b.jpg",
  "village/dirt.jpg",
  "village/ground-bare.jpg",
  "village/ground-clover.jpg",
  "village/ground-grass-lush.jpg",
  "village/ground-grass-short.jpg",
  "village/ground-moss.jpg",
  "village/season-scatter.png"
];
const FLOWER_MODEL = "village-flowers.glb";

type Load = { kind: "texture" | "gltf"; url: string; onLoad: (data: unknown) => void; onError: (error: unknown) => void; settled: boolean };

const mockLoads: Load[] = [];
const mockFailing = new Set<string>();
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
// 부른 파일을 적어 두고, 끝내는 것(성공·실패)은 테스트가 정하는 GLTFLoader
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

// 앱 틀이 쓰는 기기·외부 모듈(078 앱 시작 테스트와 같다)
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
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason);
};

/** 모듈을 새로 읽고, 그림 불러오기(TextureLoader.load)를 부른 파일을 적어 두는 것으로 바꾼다(r3f가 불러올 때 바꿔 둔 뒤에 덮어쓴다). */
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

/** 아직 끝나지 않은 읽기를 모두 끝낸다(실패로 정한 파일은 실패로). 그림은 빈 Texture, 모델은 빈 장면을 준다. */
async function settleLoads(m: Modules) {
  for (let round = 0; round < 5; round += 1) {
    const pending = mockLoads.filter((load) => !load.settled);
    if (pending.length === 0) break;
    await m.lib.act(async () => {
      for (const load of pending) {
        load.settled = true;
        if (mockFailing.has(load.url)) load.onError(new Error(`읽지 못함: ${load.url}`));
        else if (load.kind === "texture") load.onLoad(new m.THREE.Texture());
        else load.onLoad({ scene: new m.THREE.Group(), scenes: [], animations: [], cameras: [], asset: {}, parser: {}, userData: {} });
      }
      await Promise.resolve();
    });
    await flush(m.lib);
  }
}

const groundLoads = (from = 0) =>
  mockLoads
    .slice(from)
    .filter((load) => (load.kind === "texture" && GROUND_PICTURES.includes(load.url)) || (load.kind === "gltf" && load.url === FLOWER_MODEL))
    .map((load) => `${load.kind}:${load.url}`);

/** 마을에 나간다: 마을 그리기의 VillageNature를 그린다. 그린 장면 조각(<primitive object>)을 돌려준다. */
async function enterVillage(m: Modules) {
  const React = require("react") as typeof import("react");
  const { daylightAt } = require("@/lib/lobby3d/daylight") as typeof import("@/lib/lobby3d/daylight");
  const d = daylightAt(new Date(2026, 9, 15, 12, 30));
  const light = { ambience: d.ambience, ceiling: 0, target: d };
  const view = await m.lib.render(
    React.createElement(m.village.VillageNature, { daylight: light as unknown as import("@/components/lobby3d/lobby3d-daylight").DaylightState })
  );
  await flush(m.lib);
  return () =>
    view.container
      .queryAll((instance: { type: unknown }) => instance.type === "primitive")
      .map((p) => (p.props as { object: import("three").Object3D }).object);
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockLoads.length = 0;
  mockFailing.clear();
  mockSession.mode = "pending";
  mockThree.scene.background = null;
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  if (rntl) await rntl.cleanup();
  rntl = null;
  restoreTextureLoad?.();
  restoreTextureLoad = null;
  process.off("unhandledRejection", onUnhandled);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

describe("[spec] 앱이 시작되면 마을 땅 그림 여덟과 꽃 모델을 미리 읽기 시작한다(104 고치는 방법 2)", () => {
  test("[재현] P1: 앱 틀을 그린 바로 뒤(어떤 화면도 그리지 않고 로그인 확인 전이어도) 땅 그림 여덟을 한 번씩, 꽃 모델을 한 번 읽기 시작한다", async () => {
    const m = loadModules();
    await startApp(m);
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
    const pictures = mockLoads.filter((load) => load.kind === "texture").map((load) => load.url);
    expect([...pictures].sort()).toEqual(GROUND_PICTURES);
    expect(mockLoads.filter((load) => load.kind === "gltf" && load.url === FLOWER_MODEL)).toHaveLength(1);
  });
});

// 05-main-decision.md(사용자 결정 2026-11-18 "qa가 시간 제한을 늘림"): P2·P3은 땅 꾸밈을 실제로 만들어 혼자 돌려도 약 3.5초 걸리고,
// 모바일 테스트 전체를 함께 돌리면 Jest 기본 시간 제한 5초를 넘는다. 두 테스트에만 시간 제한 30초를 둔다(단언·입력은 그대로).
const VILLAGE_TEST_TIMEOUT_MS = 30000;

describe("[spec] 땅 꾸밈은 미리 읽은 것을 함께 써서 마을에 나가는 순간 다시 읽지 않는다(104 고치는 방법 2)", () => {
  test("[재현] P2: 미리 읽기가 다 끝난 뒤 마을에 나가면, 땅 그림과 꽃 모델을 하나도 다시 읽지 않는다", async () => {
    const m = loadModules();
    await startApp(m);
    await settleLoads(m);
    const before = mockLoads.length;

    const drawn = await enterVillage(m);
    await settleLoads(m);
    expect(groundLoads(before)).toEqual([]);
    // 땅 꾸밈이 그려졌다(P4에서 빠지는 것과 대조)
    expect(drawn().some((o) => o.name === "village-ground")).toBe(true);
  }, VILLAGE_TEST_TIMEOUT_MS);

  test("[재현] P3: 미리 읽기가 아직 끝나지 않았을 때 마을에 나가도, 땅 그림과 꽃 모델을 다시 읽지 않는다(같은 읽기를 함께 쓴다)", async () => {
    const m = loadModules();
    await startApp(m);
    const before = mockLoads.length;

    await enterVillage(m);
    expect(groundLoads(before)).toEqual([]);
    await settleLoads(m);
    expect(groundLoads(before)).toEqual([]);
  }, VILLAGE_TEST_TIMEOUT_MS);
});

describe("[spec] 그림을 못 읽으면 그 부분만 빠진다(104 그대로여야 할 동작 2)", () => {
  test("[그대로] P4: 흙 그림을 읽지 못해도 앱 시작은 오류 없이 이어지고, 마을에 나가면 풀밭·빛은 그리고 땅 꾸밈만 빠지며 그 사실을 개발 콘솔에 남긴다", async () => {
    mockFailing.add("village/dirt.jpg");
    const m = loadModules();
    await startApp(m);
    await settleLoads(m);
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(unhandled).toEqual([]);

    const drawn = await enterVillage(m);
    await settleLoads(m);
    const objects = drawn();
    expect(objects.some((o) => o instanceof m.THREE.HemisphereLight)).toBe(true);
    expect(objects.some((o) => o instanceof m.THREE.DirectionalLight)).toBe(true);
    expect(objects.some((o) => o.name === "village-ground")).toBe(false);
    expect(warnSpy.mock.calls.some((call) => call[0] === "[lobby3d] 마을 땅 그림·장식을 불러오지 못했습니다")).toBe(true);
    expect(unhandled).toEqual([]);
  });
});
