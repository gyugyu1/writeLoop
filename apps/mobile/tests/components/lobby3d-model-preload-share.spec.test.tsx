// [spec] qa 테스트(작업 078, 기능 변경, 모바일): 로비 세 모델을 앱 시작 직후부터 미리 읽어 두기 — 로비가 미리 읽은 모델을 쓰는 쪽과 실패.
// 기대값은 명세(private 작업 폴더 078-2026-11-11-로비-세-모델-미리-불러오기/01-main-spec.md)에서만 가져온다.
// 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(02-qa-tests.md의 분류와 같다).
//
// 명세 "바뀌는 동작": 미리 읽은 모델은 로비가 쓰는 것과 같은 곳(앱 전체에서 한 번만 두는 불러온 모델)에 둔다. 그래서
//   - 로비가 열릴 때 이미 다 읽혔으면 다시 읽지 않고 바로 쓴다.
//   - 아직 읽는 중이면 그 읽기가 끝나기를 기다린다(같은 파일을 두 번 읽지 않는다).
// 명세 "그대로여야 할 동작": 모델 하나를 읽지 못하면 로비에서 그 부분만 지금처럼 대신 그린다(코드로 지은 방 껍데기·가구·라룹이).
//   미리 읽기가 실패해도 앱 시작과 다른 화면은 멈추거나 오류를 내지 않는다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - "앱이 시작된다"는 앱 틀(src/app/_layout.tsx의 기본 내보내기)을 그리고 가짜 시계를 1초까지 돌리는 것으로 본다.
// - "로비가 열린다"는 앱 틀을 그대로 둔 채 그 화면 묶음(expo-router Stack 가짜) 안에 로비의 세 부분을 지금 3D 그리기
//   (lobby3d-canvas.tsx 끝부분)와 같은 모양(각 부분의 오류 경계 > Suspense > 부분)으로 그리는 것으로 본다.
//   방 껍데기(BakedRoom), 가구 묶음(BakedFurniture), 라룹이(Character)는 진짜다.
// - "모델을 읽는다"는 GLTFLoader의 load(또는 loadAsync)가 그 파일로 불리는 것으로 보고, 가짜 GLTFLoader가 부른 횟수를 센다.
//   읽기를 끝내는 때(성공·실패)는 테스트가 정한다.
// - "부분이 모델로 그려졌다": 방 껍데기·가구는 코드로 지은 대체 모양(fallback)이 숨는다(visible false). 라룹이는 handleRef가 채워진다.
//   "대신 그린다(지금처럼)": 방 껍데기·가구는 대체 모양이 보이는 채로 남는다. 라룹이는 지금 코드에서 오류 경계가 아무것도 그리지 않으므로
//   handleRef가 비어 있다(지금 동작을 그대로 적었다).
// - react-three-fiber는 진짜(useLoader와 그 캐시)를 쓴다. Jest에서 돌지 않는 Canvas·useFrame·useThree만 가짜로 둔다.
// - 구현이 "한 번만 시작" 같은 모듈 상태를 둘 수 있고 useLoader 캐시도 모듈에 있으므로, 테스트마다 모듈을 새로 읽는다(jest.resetModules).
// 테스트마다 모듈을 새로 읽어야 해서(jest.resetModules) require로 읽는다.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { ComponentType, MutableRefObject, ReactNode } from "react";

// 088 ② 03 결정 1(사용자, 2026-11-13 "qa가 새 동작에 맞게 고침"): 앱이 미리 읽는 모델은 마을(lobby-village.glb)을 더한 넷이다.
// 이 목록과 마을 모델 파일을 이름 문자열로 바꾸는 가짜만 더했고, 단언은 그대로다.
// 090-② 05 결정 3(사용자, 2026-11-13 "qa가 새 동작에 맞게 고침"): 가구 묶음(lobby-furniture.glb) 대신 앱에 든 처음 방 가구 일곱의
// 파일(assets/models/furniture/<id>.glb)을 읽는다. 이 목록과 일곱 파일을 이름 문자열로 바꾸는 가짜만 바꿨고, 단언은 그대로다.
const MODEL_FILES = [
  "furniture/board.glb",
  "furniture/bookcase.glb",
  "furniture/desk.glb",
  "furniture/lamp.glb",
  "furniture/rug.glb",
  "furniture/wardrobe.glb",
  "furniture/window.glb",
  "lobby-room.glb",
  "lobby-village.glb",
  "writeloop.glb"
];

type PendingLoad = { url: string; onLoad: (data: unknown) => void; onError: (error: unknown) => void; settled: boolean };

const mockLoads: PendingLoad[] = [];
const mockFailing = new Set<string>();
const mockSlot: { set: ((node: ReactNode) => void) | null } = { set: null };
const mockThree = { camera: null as unknown, scene: null as unknown, size: { width: 400, height: 800 } };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
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
      mockLoads.push({ url: String(url), onLoad: onLoad ?? (() => {}), onError: onError ?? (() => {}), settled: false });
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
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});

// 앱 틀이 쓰는 기기·외부 모듈
jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const RN = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
    // 화면 묶음: 테스트가 넣는 화면(로비)을 그린다
    Stack: () => {
      const [node, setNode] = React.useState<React.ReactNode>(null);
      mockSlot.set = setNode;
      return React.createElement(React.Fragment, null, React.createElement(RN.Text, null, "화면 묶음"), node);
    }
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
// 로그인한 상태로 시작한다(로비를 여는 사용자)
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("@/lib/api", () => ({
  getCurrentUser: jest.fn(() => Promise.resolve({ id: 7, email: "qa-078@example.com", displayName: "qa" })),
  login: jest.fn(),
  loginWithApple: jest.fn(),
  loginWithSocial: jest.fn(),
  logout: jest.fn(() => Promise.resolve())
}));

type Rntl = typeof import("@testing-library/react-native/pure");
type Three = typeof import("three");
let rntl: Rntl | null = null;

/** 테스트마다 새로 읽은 모듈들. */
function loadModules() {
  rntl = require("@testing-library/react-native/pure") as Rntl;
  return {
    lib: rntl,
    React: require("react") as typeof import("react"),
    THREE: require("three") as Three,
    RootLayout: require("@/app/_layout").default as ComponentType,
    room: require("@/components/lobby3d/lobby3d-room") as typeof import("@/components/lobby3d/lobby3d-room"),
    furniture: require("@/components/lobby3d/lobby3d-furniture") as typeof import("@/components/lobby3d/lobby3d-furniture"),
    character: require("@/components/lobby3d/lobby3d-character") as typeof import("@/components/lobby3d/lobby3d-character")
  };
}
type Modules = ReturnType<typeof loadModules>;

async function flush(lib: Rntl, steps = 10) {
  for (let step = 0; step < steps; step += 1) {
    await lib.act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
  }
}

/** 앱 틀을 그리고 첫 화면을 그린 뒤 1초까지 기다린다. */
async function startApp(m: Modules) {
  await m.lib.render(m.React.createElement(m.RootLayout));
  await flush(m.lib);
}

/** 아직 끝나지 않은 읽기를 모두 끝낸다(mockFailing에 든 파일은 실패, 나머지는 성공). */
async function settleLoads(m: Modules) {
  for (const load of mockLoads) {
    if (load.settled) continue;
    load.settled = true;
    if (mockFailing.has(load.url)) {
      load.onError(new Error(`읽지 못했다(테스트 가짜): ${load.url}`));
    } else {
      load.onLoad({ scene: new m.THREE.Group(), scenes: [], animations: [], cameras: [], asset: {}, parser: {}, userData: {} });
    }
  }
  await flush(m.lib);
}

function loadedFiles(): string[] {
  return mockLoads.map((load) => load.url).sort();
}

/** 로비의 세 부분과, 모델로 그려졌는지 볼 대체 모양·라룹이 손잡이. */
function lobbyParts(m: Modules) {
  const roomFallback = new m.THREE.Group();
  const furnitureFallback = new m.THREE.Group();
  const handleRef: MutableRefObject<unknown> = { current: null };
  const kit = { gradient: new m.THREE.Texture(), toonMaterials: [] };
  const { createElement, Suspense } = m.React;
  const node = createElement(
    m.React.Fragment,
    null,
    createElement(
      m.furniture.BakedFurnitureErrorBoundary,
      null,
      createElement(
        Suspense,
        { fallback: null },
        createElement(m.furniture.BakedFurniture, {
          fallback: furnitureFallback,
          daylight: {} as never
        })
      )
    ),
    createElement(
      m.room.BakedRoomErrorBoundary,
      null,
      createElement(Suspense, { fallback: null }, createElement(m.room.BakedRoom, { fallback: roomFallback, tint: new m.THREE.Color(1, 1, 1) }))
    ),
    createElement(
      m.character.CharacterErrorBoundary,
      null,
      createElement(Suspense, { fallback: null }, createElement(m.character.Character, { kit, outline: 1, handleRef: handleRef as never }))
    )
  );
  return { node, roomFallback, furnitureFallback, handleRef };
}

/** 앱 틀은 그대로 둔 채 화면 묶음에 로비를 연다(한 번의 act). */
async function openLobby(m: Modules, node: ReactNode) {
  await m.lib.act(async () => {
    mockSlot.set?.(node);
  });
}

let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason);
};

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockLoads.length = 0;
  mockFailing.clear();
  mockSlot.set = null;
  unhandled.length = 0;
  process.on("unhandledRejection", onUnhandled);
  // 오류 출력은 막되 불린 것은 센다(로비를 연 뒤 오류 경계가 잡은 오류를 React가 출력하는 것은 지금 동작이다)
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  // 오류 경계가 개발 콘솔에 남기는 경고(지금 동작)는 출력만 막는다
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  if (rntl) await rntl.cleanup();
  rntl = null;
  process.off("unhandledRejection", onUnhandled);
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  jest.useRealTimers();
});

describe("[spec] 로비는 미리 읽은 모델을 같은 곳에서 쓴다(078 명세 바뀌는 동작 2)", () => {
  test("[바뀔] 앱 시작 뒤 미리 읽기가 다 끝났으면, 로비를 열 때 다시 읽지 않고 세 부분을 여는 즉시 모델로 그린다", async () => {
    const m = loadModules();
    await startApp(m);
    await settleLoads(m);
    // 로비를 열기 전에 세 파일이 한 번씩 읽혔다
    expect(loadedFiles()).toEqual(MODEL_FILES);

    const parts = lobbyParts(m);
    await openLobby(m, parts.node);
    // 여는 순간(읽기를 기다리지 않고) 세 부분이 모델로 그려졌다
    expect(parts.roomFallback.visible).toBe(false);
    expect(parts.furnitureFallback.visible).toBe(false);
    expect(parts.handleRef.current).not.toBeNull();
    // 로비가 열린 뒤에도 더 읽지 않았다
    await flush(m.lib);
    expect(loadedFiles()).toEqual(MODEL_FILES);
  });

  test("[바뀔] 미리 읽기가 아직 끝나지 않았을 때 로비를 열면, 같은 파일을 다시 읽지 않고 그 읽기가 끝나기를 기다렸다가 모델로 그린다", async () => {
    const m = loadModules();
    await startApp(m);
    // 앱 시작 뒤 세 파일 읽기가 시작됐고 아직 끝나지 않았다
    expect(loadedFiles()).toEqual(MODEL_FILES);

    const parts = lobbyParts(m);
    await openLobby(m, parts.node);
    await flush(m.lib);
    // 같은 파일을 두 번 읽지 않았다
    expect(loadedFiles()).toEqual(MODEL_FILES);
    // 읽는 중이라 아직 모델로 그리지 않았다(대체 모양이 보인다)
    expect(parts.roomFallback.visible).toBe(true);
    expect(parts.furnitureFallback.visible).toBe(true);
    expect(parts.handleRef.current).toBeNull();

    // 미리 읽기가 끝나면 로비가 그 결과로 그린다
    await settleLoads(m);
    expect(parts.roomFallback.visible).toBe(false);
    expect(parts.furnitureFallback.visible).toBe(false);
    expect(parts.handleRef.current).not.toBeNull();
    expect(loadedFiles()).toEqual(MODEL_FILES);
  });
});

describe("[spec] 모델을 읽지 못해도 앱은 멈추지 않고 로비는 그 부분만 지금처럼 대신 그린다(078 명세 그대로여야 할 동작 2)", () => {
  test("[그대로] 방 껍데기 파일만 읽지 못하면, 앱 시작은 오류 없이 이어지고 로비에서 방 껍데기만 코드로 지은 모양이 남고 가구·라룹이는 모델로 그린다", async () => {
    mockFailing.add("lobby-room.glb");
    const m = loadModules();
    await startApp(m);
    await settleLoads(m);
    // 앱 시작: 화면 묶음이 그대로 있고, 오류 출력·처리되지 않은 실패가 없다
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(unhandled).toEqual([]);

    const parts = lobbyParts(m);
    await openLobby(m, parts.node);
    await settleLoads(m);
    expect(parts.roomFallback.visible).toBe(true);
    expect(parts.furnitureFallback.visible).toBe(false);
    expect(parts.handleRef.current).not.toBeNull();
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect(unhandled).toEqual([]);
  });

  test("[그대로] 세 파일을 모두 읽지 못하면, 앱 시작은 오류 없이 이어지고 로비에서 방 껍데기·가구는 코드로 지은 모양이 남고 라룹이는 그리지 않는다", async () => {
    MODEL_FILES.forEach((file) => mockFailing.add(file));
    const m = loadModules();
    await startApp(m);
    await settleLoads(m);
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(unhandled).toEqual([]);

    const parts = lobbyParts(m);
    await openLobby(m, parts.node);
    await settleLoads(m);
    expect(parts.roomFallback.visible).toBe(true);
    expect(parts.furnitureFallback.visible).toBe(true);
    expect(parts.handleRef.current).toBeNull();
    expect(m.lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect(unhandled).toEqual([]);
  });
});
