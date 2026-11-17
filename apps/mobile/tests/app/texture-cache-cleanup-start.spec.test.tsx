// [spec] qa 테스트(작업 105, 버그 수정, 모바일): 3D 모델 안 그림을 읽을 때마다 캐시 폴더에 새 그림 파일이 쌓이는 문제 — 앱 시작 때 옛 파일 지우기.
// 기대값은 명세(private 작업 폴더 105-2026-11-18-3D-그림-캐시-파일/01-main-spec.md)의 "기대 동작 2"와 "그대로여야 할 동작"에서만 가져온다.
// 테스트마다 이름 앞에 [재현]·[그대로]를 붙였다. [재현]은 고치기 전 코드에서 버그 증상(옛 파일이 남음)으로 실패해야 하고,
// [그대로]는 고치기 전과 뒤 모두 통과해야 한다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - "앱이 시작된다"는 앱의 맨 바깥 화면 틀(src/app/_layout.tsx의 기본 내보내기)을 그리는 것으로 본다(작업 078 테스트와 같다).
//   그 안의 화면 묶음(expo-router Stack)은 아무 화면도 그리지 않는 가짜다. 3D 모델 읽기(GLTFLoader)는 부른 파일만 적는 가짜다.
// - 파일 시스템은 가짜다(tests/__fixtures__/texture-cache-105.ts). 옛 API와 새 API가 같은 표를 읽고 쓰므로 구현이 어느 쪽으로 목록을 읽고 지우든 같다.
// - 지우기를 시작 직후에 하든 조금 미뤄 하든 "시작될 때"로 보도록, 그린 뒤 가짜 시계를 30초까지 돌리며 기다린다.
// - "옛 방식 파일"은 명세대로 캐시 폴더 맨 위에 있고, 이름이 r3f의 uuid v4 모양(xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx, y는 8·9·a·b)이며
//   확장자가 png·jpeg·jpg·webp인 파일이다.
// - "앱은 그대로 이어진다"는 화면 틀이 그려지고(렌더가 오류를 던지지 않음) 3D 모델 미리 읽기가 시작되는 것으로 본다.
//   처리되지 않은 Promise 거절은 이 테스트 환경에서 잡히지 않아(process의 unhandledRejection 알림이 오지 않았다) 보지 않는다.
// - 구현이 "한 번만" 같은 모듈 상태를 둘 수 있어 테스트마다 모듈을 새로 읽는다(jest.resetModules). 화면 테스트 도구도 테스트 안에서 새로 읽는다.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { ComponentType } from "react";
import { CACHE, cacheFiles, fsState, resetFs } from "../__fixtures__/texture-cache-105";

// 작업 078·104 테스트와 같은, 앱이 시작될 때 읽는 모델 파일 목록(앱이 그대로 이어지는지 볼 때 쓴다)
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
  "village-flowers.glb",
  "wear-goggles.glb",
  "writeloop.glb"
];

const mockLoads: string[] = [];
const mockThree = { camera: null as unknown, scene: null as unknown, size: { width: 400, height: 800 } };

jest.mock("expo-file-system/legacy", () => require("../__fixtures__/texture-cache-105").legacyFsModule());
jest.mock("expo-file-system", () => require("../__fixtures__/texture-cache-105").newFsModule());
jest.mock("expo-crypto", () => require("../__fixtures__/texture-cache-105").cryptoModule());

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("@react-three/fiber/native", () => {
  const actual = jest.requireActual("@react-three/fiber/native");
  const React = jest.requireActual<typeof import("react")>("react");
  // 그림 불러오기는 끝내지 않는 가짜다(Jest에서는 기기의 그림 크기 읽기가 돌지 않는다. 작업 104 테스트와 같다)
  const T = jest.requireMock<typeof import("three")>("three");
  T.TextureLoader.prototype.load = function load() {
    return new T.Texture();
  } as unknown as typeof T.TextureLoader.prototype.load;
  return {
    ...actual,
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => mockThree,
    useFrame: () => {}
  };
});
// 부른 파일을 적어 두기만 하는 GLTFLoader(끝내지 않는다)
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  class GLTFLoader {
    load(url: unknown) {
      mockLoads.push(String(url));
    }
    loadAsync(url: unknown) {
      mockLoads.push(String(url));
      return new Promise(() => {});
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
jest.mock("@/assets/models/wear-goggles.glb", () => "wear-goggles.glb");
jest.mock("@/assets/models/village-flowers.glb", () => "village-flowers.glb");
jest.mock("@/components/lobby3d/lobby3d-outdoor", () => {
  const T = jest.requireMock<typeof import("three")>("three");
  return {
    createOutdoor: () => ({ scene: new T.Group(), setDaylight: () => {}, update: () => {}, dispose: () => {} })
  };
});

// 앱 틀이 쓰는 기기·외부 모듈(작업 078 테스트와 같다. 로그인 확인은 끝나지 않는 상태로 둔다)
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
  getItemAsync: jest.fn(() => new Promise(() => {})),
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
let rntl: Rntl | null = null;

function loadTestingLibrary(): Rntl {
  rntl = require("@testing-library/react-native/pure") as Rntl;
  return rntl;
}

/** 첫 화면을 그린 뒤 가짜 시계를 30초까지(0.1초씩) 돌리며, 그 사이의 비동기 일을 끝낸다. */
async function waitAfterStart(lib: Rntl) {
  for (let step = 0; step < 300; step += 1) {
    await lib.act(async () => {
      jest.advanceTimersByTime(100);
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
  }
}

async function startApp(lib: Rntl) {
  const RootLayout = require("@/app/_layout").default as ComponentType;
  const React = require("react") as typeof import("react");
  await lib.render(React.createElement(RootLayout));
  await waitAfterStart(lib);
}

function bytes(n: number): Uint8Array {
  return new Uint8Array(n).fill(7);
}

// 옛 방식 파일: 캐시 폴더 맨 위, uuid v4 모양 이름, 그림 확장자(png·jpeg·jpg·webp) — 지워져야 한다
const LEGACY_FILES = [
  `${CACHE}1b4e28ba-2fa1-41d2-883f-0016d3cca427.png`,
  `${CACHE}9f8c7a6b-5d4e-4f3a-a2b1-c0d9e8f7a6b5.jpeg`,
  `${CACHE}0a1b2c3d-4e5f-4a6b-b7c8-d9e0f1a2b3c4.jpg`,
  `${CACHE}fedcba98-7654-4321-8fed-cba987654321.webp`
];

// 그 밖의 파일과 폴더 — 남아야 한다
const KEEP_FILES = [
  // 번들 그림·모델을 꺼내 둔 고정 이름
  `${CACHE}ExponentAsset-3f2a9c1d.png`,
  `${CACHE}ExponentAsset-77aa01bc.glb`,
  // 하위 폴더 안의 uuid 모양 그림(맨 위가 아니다)
  `${CACHE}ImagePicker/2c5d8e1f-3a4b-4c6d-9e8f-0a1b2c3d4e5f.png`,
  `${CACHE}some-dir/nested/4d3c2b1a-0f9e-4d8c-b7a6-958473625140.jpeg`,
  // 다른 이름
  `${CACHE}notes.txt`,
  `${CACHE}${"ab".repeat(32)}.png`,
  // uuid v4 모양이지만 그림 확장자가 아니다
  `${CACHE}5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9.txt`,
  `${CACHE}6f7a8b9c-0d1e-4f2a-b3c4-d5e6f7a8b9c0.glb`
];

// 비어 있는 하위 폴더 — 남아야 한다
const KEEP_DIRS = [`${CACHE}http-cache/`];

function seedCache(files: string[]) {
  for (const uri of files) fsState().files.set(uri, bytes(8));
  for (const dir of KEEP_DIRS) fsState().dirs.add(dir);
  fsState().dirs.add(`${CACHE}ImagePicker/`);
  fsState().dirs.add(`${CACHE}some-dir/`);
  fsState().dirs.add(`${CACHE}some-dir/nested/`);
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockLoads.length = 0;
  resetFs();
});

afterEach(async () => {
  if (rntl) await rntl.cleanup();
  rntl = null;
  jest.useRealTimers();
});

describe("[spec] 앱이 시작될 때 캐시 폴더 맨 위의 옛 방식 그림 파일을 지운다(105 명세 기대 동작 2)", () => {
  test("[재현] 시작 뒤 옛 방식 파일(uuid v4 이름의 png·jpeg·jpg·webp)은 모두 없어지고, 그 밖의 파일과 폴더는 그대로 남는다", async () => {
    seedCache([...LEGACY_FILES, ...KEEP_FILES]);
    const lib = loadTestingLibrary();

    await startApp(lib);

    expect(cacheFiles()).toEqual([...KEEP_FILES].sort());
    for (const dir of [...KEEP_DIRS, `${CACHE}ImagePicker/`, `${CACHE}some-dir/`, `${CACHE}some-dir/nested/`]) {
      expect(fsState().dirs.has(dir)).toBe(true);
    }
  });

  test("[그대로] uuid 모양이어도 v4 모양이 아닌 이름(셋째 묶음이 4로 시작하지 않거나 넷째 묶음이 8·9·a·b로 시작하지 않음)의 그림은 지우지 않는다", async () => {
    const notV4 = [
      `${CACHE}1b4e28ba-2fa1-11d2-883f-0016d3cca427.png`,
      `${CACHE}1b4e28ba-2fa1-41d2-c83f-0016d3cca427.png`
    ];
    seedCache(notV4);
    const lib = loadTestingLibrary();

    await startApp(lib);

    expect(cacheFiles()).toEqual([...notV4].sort());
  });

  test("[그대로] 지우기가 실패해도 앱은 그대로 이어진다(화면 틀이 그려지고 3D 모델 미리 읽기가 시작된다)", async () => {
    seedCache([...LEGACY_FILES, ...KEEP_FILES]);
    fsState().deleteError = new Error("지우기 실패");
    const lib = loadTestingLibrary();

    await startApp(lib);

    expect(lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect([...mockLoads].sort()).toEqual(MODEL_FILES);
  });

  test("[그대로] 캐시 폴더 목록을 읽지 못해도 앱은 그대로 이어진다(화면 틀이 그려지고 3D 모델 미리 읽기가 시작된다)", async () => {
    seedCache([...LEGACY_FILES, ...KEEP_FILES]);
    fsState().listError = new Error("목록 읽기 실패");
    const lib = loadTestingLibrary();

    await startApp(lib);

    expect(lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect([...mockLoads].sort()).toEqual(MODEL_FILES);
  });
});
