// [spec] qa 테스트(작업 078, 기능 변경, 모바일): 로비 세 모델을 앱 시작 직후부터 미리 읽어 두기 — 앱 시작 쪽.
// 기대값은 명세(private 작업 폴더 078-2026-11-11-로비-세-모델-미리-불러오기/01-main-spec.md)에서만 가져온다.
// 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(02-qa-tests.md의 분류와 같다).
//
// 명세 "바뀌는 동작": 앱이 시작되면(첫 화면을 그린 바로 뒤) 세 모델 파일(방 껍데기 lobby-room.glb, 라룹이 writeloop.glb,
//   가구 묶음 lobby-furniture.glb)을 읽어 3D 데이터로 푸는 일을 시작한다. 로그인 여부, 지금 보이는 화면(로그인 화면 포함)과 상관없다.
//
// 어떻게 보나(구현 전이라 구현 이름을 모른다. 지금 코드는 부르는 방법을 알려고만 읽었다):
// - "앱이 시작된다"는 앱의 맨 바깥 화면 틀(src/app/_layout.tsx의 기본 내보내기)을 그리는 것으로 본다.
//   그 안의 화면 묶음(expo-router Stack)은 아무 화면도 그리지 않는 가짜로 바꿔, 어떤 화면이 보이든(로그인 화면 포함) 상관없음을 본다.
// - "모델 파일을 읽어 3D 데이터로 푼다"는 GLTFLoader의 load(또는 loadAsync)가 그 모델 파일로 불리는 것으로 본다.
//   GLTFLoader는 부른 파일을 적어 두는 가짜다(풀어 주지 않는다. 시작했는지만 본다).
// - react-three-fiber는 진짜(useLoader와 그 캐시)를 쓴다. Jest에서 돌지 않는 Canvas·useFrame·useThree만 가짜로 둔다.
// - 모델 파일은 Jest가 읽지 못하므로 파일 이름 문자열로 바꾼다(지금 로비 테스트들과 같다).
// - "첫 화면을 그린 바로 뒤"는 그린 뒤 가짜 시계를 1초까지 돌려 기다리는 것으로 본다(바로 뒤라 1초면 넉넉하다고 보았다).
// - 구현이 "한 번만 시작" 같은 모듈 상태를 둘 수 있어, 테스트마다 모듈을 새로 읽는다(jest.resetModules). 그래서 화면 테스트 도구도
//   테스트 안에서 새로 읽는다(자동 정리를 쓰지 않는 pure 모듈, 정리는 afterEach에서 부른다).

// 테스트마다 모듈을 새로 읽어야 해서(jest.resetModules) require로 읽는다.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { ComponentType } from "react";

// 088 ② 03 결정 1(사용자, 2026-11-13 "qa가 새 동작에 맞게 고침"): 앱이 시작될 때 읽는 모델은 마을(lobby-village.glb)을 더한 넷이다
// (② 02-qa-scenarios L1). 이 목록과 마을 모델 파일을 이름 문자열로 바꾸는 가짜만 더했고, 단언은 그대로다.
const MODEL_FILES = ["lobby-furniture.glb", "lobby-room.glb", "lobby-village.glb", "writeloop.glb"];

const mockLoads: string[] = [];
const mockSession = { mode: "pending" as "pending" | "loggedOut" | "loggedIn" };
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
jest.mock("@/assets/models/lobby-furniture.glb", () => "lobby-furniture.glb");
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
    // 화면 묶음: 아무 화면도 고르지 않고 표시만 둔다
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
// 로그인 상태: pending은 기기에 기억한 로그인 사용자를 읽는 일이 끝나지 않는다(로그인이 확인되기 전),
// loggedOut은 기억한 사용자가 없고 서버도 로그인 안 됨(null), loggedIn은 서버가 로그인 사용자를 준다.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => (mockSession.mode === "pending" ? new Promise(() => {}) : Promise.resolve(null))),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("@/lib/api", () => ({
  getCurrentUser: jest.fn(() =>
    mockSession.mode === "loggedIn"
      ? Promise.resolve({ id: 7, email: "qa-078@example.com", displayName: "qa" })
      : mockSession.mode === "loggedOut"
        ? Promise.resolve(null)
        : new Promise(() => {})
  ),
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

/** 첫 화면을 그린 뒤 가짜 시계를 1초까지 돌리며 기다린다. */
async function waitAfterFirstScreen(lib: Rntl) {
  for (let step = 0; step < 10; step += 1) {
    await lib.act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
  }
}

async function startApp(lib: Rntl) {
  const RootLayout = require("@/app/_layout").default as ComponentType;
  const React = require("react") as typeof import("react");
  await lib.render(React.createElement(RootLayout));
  await waitAfterFirstScreen(lib);
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  mockLoads.length = 0;
  mockSession.mode = "pending";
});

afterEach(async () => {
  if (rntl) await rntl.cleanup();
  rntl = null;
  jest.useRealTimers();
});

describe("[spec] 앱이 시작되면 로비 세 모델을 읽기 시작한다(078 명세 바뀌는 동작 1)", () => {
  test("[그대로] 첫 화면을 그리기 전(앱 틀 모듈을 불러오기만 했을 때)에는 모델을 읽지 않는다", () => {
    loadTestingLibrary();
    require("@/app/_layout");
    expect(mockLoads).toEqual([]);
  });

  test("[바뀔] 로그인이 확인되기 전(기억한 로그인 사용자를 읽는 중)이고 어떤 화면도 그리지 않아도, 앱 틀을 그린 바로 뒤 세 모델을 한 번씩 읽기 시작한다", async () => {
    mockSession.mode = "pending";
    const lib = loadTestingLibrary();
    await startApp(lib);
    expect(lib.screen.getByText("화면 묶음")).toBeTruthy();
    expect([...mockLoads].sort()).toEqual(MODEL_FILES);
  });

  test("[바뀔] 로그인하지 않은 상태로 확인돼도(로그인 화면으로 가는 경우) 앱 틀을 그린 바로 뒤 세 모델을 한 번씩 읽기 시작한다", async () => {
    mockSession.mode = "loggedOut";
    const lib = loadTestingLibrary();
    await startApp(lib);
    expect([...mockLoads].sort()).toEqual(MODEL_FILES);
  });

  test("[바뀔] 로그인한 상태로 확인돼도 앱 틀을 그린 바로 뒤 세 모델을 한 번씩 읽기 시작한다", async () => {
    mockSession.mode = "loggedIn";
    const lib = loadTestingLibrary();
    await startApp(lib);
    expect([...mockLoads].sort()).toEqual(MODEL_FILES);
  });
});
