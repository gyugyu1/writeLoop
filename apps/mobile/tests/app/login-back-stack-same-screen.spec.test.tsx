// [spec] qa 테스트(작업 096 로그인 뒤 뒤로 가기, 구현 뒤 결정 파일대로 더한 테스트).
// 기대값은 결정 파일(09-main-decision.md)의 "명세에 더하는 동작"과 "qa가 더할 테스트"에서만 가져온다.
// 로그인 관련 화면을 치운 아래 화면이 갈 곳과 같은 화면(같은 경로, 물음표 뒤 값 없음)이면 그 화면으로 돌아가고
// 같은 화면이 둘 쌓이지 않는다. /diary(화면 이름 diary/index)처럼 폴더의 첫 화면도 같은 화면으로 본다.
// 동적 경로(/diary/123)와 물음표가 붙은 갈 곳은 같은 화면으로 보지 않고 갈 곳 화면을 새로 둔다(뒤로를 누르면 앞 화면).
// 테스트 이름 끝의 [통과가 맞다]/[실패가 맞다]는 결정 파일이 정한 테스트 커밋 시점의 기대다.
//
// 방법은 login-back-stack.spec.test.tsx와 같다. 실제 expo-router(renderRouter)에 실제 로그인 화면을 올리고,
// Android 뒤로 버튼은 react-navigation이 BackHandler에 건 hardwareBackPress 처리기를 늦게 건 것부터 불러 흉내 낸다.
// 아무 처리기도 받지 않으면 앱이 닫힌 것으로 본다.
// 가짜로 두는 것: 로그인 상태(@/lib/session), Apple 로그인, 기기 저장소, 브라우저, 안전 영역, 홈·기록·일기 화면.
// 가짜 홈은 로그인 화면 아래에 홈이 쌓인 경우를 만들려고 로그인하지 않았어도 그려지고 "홈에서 로그인" 버튼(/login)을 둔다.
import type { ReactElement } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { act, fireEvent, isHiddenFromAccessibility, renderRouter, screen } from "expo-router/testing-library";
import type { TestInstance } from "test-renderer";
import { store } from "expo-router/build/global-state/router-store";
import LoginScreen from "@/app/login";
import { buildLoginHref } from "@/lib/login-redirect";
import type { AuthUser, SocialLoginResult } from "@/lib/types";

jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { CONTINUE: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
  AppleAuthenticationButton: () => null
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn()
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
// 로그인 상태: 실제 SessionProvider처럼 로그인하면 currentUser가 바뀌고, 그것을 쓰는 모든 화면이 다시 그려진다.
jest.mock("@/lib/session", () => {
  const React = jest.requireActual("react");
  return {
    useSession: () => {
      const currentUser = React.useSyncExternalStore(mockSession.subscribe, mockSession.get, mockSession.get);
      return {
        currentUser,
        isHydrating: false,
        refreshSession: jest.fn(),
        setSessionUser: mockSession.set,
        signIn: mockSession.signIn,
        signInWithApple: jest.fn(),
        signInWithSocial: mockSession.signInWithSocial,
        signOut: jest.fn()
      };
    }
  };
});

const USER: AuthUser = { id: 9, email: "same@example.com", displayName: "학습자", admin: false } as AuthUser;
const EMAIL = USER.email;
const PASSWORD = "pw123456";

const mockSession = (() => {
  let user: AuthUser | null = null;
  const listeners = new Set<() => void>();
  const set = (next: AuthUser | null) => {
    user = next;
    listeners.forEach((listener) => listener());
  };
  return {
    get: () => user,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set,
    signIn: jest.fn(async () => {
      set(USER);
      return USER;
    }),
    signInWithSocial: jest.fn(async (): Promise<SocialLoginResult> => {
      set(USER);
      return { status: "logged_in", user: USER };
    })
  };
})();

// ---------- 가짜 화면 ----------

function TestLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function FakeHome() {
  return (
    <View>
      <Text>홈 화면</Text>
      <Pressable onPress={() => router.push("/login")}>
        <Text>홈에서 로그인</Text>
      </Pressable>
    </View>
  );
}

function FakeRecords() {
  return (
    <View>
      <Text>기록 화면</Text>
      <Pressable onPress={() => router.push(buildLoginHref("/records"))}>
        <Text>기록으로 돌아오는 로그인</Text>
      </Pressable>
      <Pressable onPress={() => router.push(buildLoginHref("/records?date=2026-11-16"))}>
        <Text>날짜 붙은 기록으로 가는 로그인</Text>
      </Pressable>
    </View>
  );
}

function FakeDiary() {
  return (
    <View>
      <Text>일기 화면</Text>
      <Pressable onPress={() => router.push(buildLoginHref("/diary"))}>
        <Text>일기로 돌아오는 로그인</Text>
      </Pressable>
    </View>
  );
}

function FakeDiaryEntry() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return (
    <View>
      <Text>{`일기 ${entryId} 화면`}</Text>
      <Pressable onPress={() => router.push(buildLoginHref(`/diary/${entryId}`))}>
        <Text>일기 글로 돌아오는 로그인</Text>
      </Pressable>
    </View>
  );
}

const ROUTES: Record<string, () => ReactElement | null> = {
  _layout: TestLayout,
  index: FakeHome,
  login: LoginScreen,
  records: FakeRecords,
  "diary/index": FakeDiary,
  "diary/[entryId]": FakeDiaryEntry
};

// ---------- Android 뒤로 버튼 ----------

type BackListener = () => boolean | null | undefined;
let backListeners: BackListener[] = [];

async function pressAndroidBack(): Promise<"handled" | "app-closed"> {
  let handled = false;
  await act(async () => {
    for (const listener of [...backListeners].reverse()) {
      if (listener()) {
        handled = true;
        break;
      }
    }
  });
  await flushAsync();
  return handled ? "handled" : "app-closed";
}

// 앱이 닫힐 때까지(최대 limit번) 뒤로 버튼을 누르며 그때마다 보인 경로를 모은다.
async function pressBackUntilClosed(limit = 6): Promise<string[]> {
  const visited: string[] = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await pressAndroidBack();
    if (result === "app-closed") {
      return visited;
    }
    visited.push(currentPathname());
  }
  visited.push("(앱이 닫히지 않음)");
  return visited;
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  for (let index = 0; index < 4; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function openApp(initialUrl: string) {
  await renderRouter(ROUTES, { initialUrl });
  await flushAsync();
}

function currentPathname() {
  return store.getRouteInfo().pathname;
}

function currentParams() {
  return store.getRouteInfo().params as Record<string, string | string[]>;
}

type StateLike = { routes?: { name: string; state?: StateLike }[]; index?: number };

// 루트 Stack의 화면 쌓임(아래부터 위로)의 화면 이름.
function stackRouteNames(): string[] {
  let state = store.state as StateLike | undefined;
  while (state?.routes?.length === 1 && state.routes[0].state && state.routes[0].name === "__root") {
    state = state.routes[0].state;
  }
  return (state?.routes ?? []).map((route) => route.name);
}

// 갈 곳에 도착한 직후의 쌓임과, 그 뒤 앱이 닫힐 때까지 뒤로 버튼을 눌러 보인 경로.
async function afterArrival() {
  const stack = stackRouteNames();
  return { stack, shownOnBack: await pressBackUntilClosed() };
}

function textInputs(): TestInstance[] {
  return screen.container.queryAll(
    (instance) => instance.type === "TextInput" && !isHiddenFromAccessibility(instance as never)
  );
}

function inputBy(predicate: (input: TestInstance) => boolean) {
  const found = textInputs().filter(predicate);
  expect(found).toHaveLength(1);
  return found[0];
}

async function press(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}

// 처음 로그인 화면 → 이메일 로그인 → 이메일·비밀번호를 넣고 로그인.
async function loginWithEmail() {
  await press("로그인하기");
  expect(currentPathname()).toBe("/login");
  expect(currentParams().mode).toBe("email");
  await fireEvent.changeText(inputBy((input) => input.props.keyboardType === "email-address"), EMAIL);
  await fireEvent.changeText(inputBy((input) => Boolean(input.props.secureTextEntry)), PASSWORD);
  await press("로그인하기");
  expect(mockSession.signIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD, rememberMe: true });
}

beforeEach(() => {
  mockSession.set(null);
  jest.clearAllMocks();
  backListeners = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((eventName, handler) => {
    if (eventName === "hardwareBackPress") {
      backListeners.push(handler as BackListener);
    }
    return {
      remove: () => {
        backListeners = backListeners.filter((listener) => listener !== handler);
      }
    };
  });
});

// 그린 화면은 Testing Library의 자동 정리(cleanup)가 테스트마다 내린다.
afterEach(() => {
  jest.useRealTimers();
});

describe("결정 09: 치운 아래 화면이 갈 곳과 같은 화면이면 그 화면으로 돌아간다", () => {
  test("추가 1 홈 → 로그인 → 이메일 로그인 → 로그인 → 홈: 쌓임이 홈 하나이고 뒤로를 누르면 앱이 닫힌다 [통과가 맞다]", async () => {
    await openApp("/");
    await press("홈에서 로그인");
    expect(stackRouteNames()).toEqual(["index", "login"]);
    await loginWithEmail();

    expect(currentPathname()).toBe("/");
    expect(screen.getByText("홈 화면")).toBeOnTheScreen();
    expect(await afterArrival()).toEqual({ stack: ["index"], shownOnBack: [] });
  });

  test("추가 2 홈 → 로그인 → 바로 구글 로그인 → 홈: 쌓임이 홈 하나이고 뒤로를 누르면 앱이 닫힌다 [통과가 맞다]", async () => {
    await openApp("/");
    await press("홈에서 로그인");
    await press("구글로 계속하기");

    expect(mockSession.signInWithSocial).toHaveBeenCalledWith("google");
    expect(currentPathname()).toBe("/");
    expect(await afterArrival()).toEqual({ stack: ["index"], shownOnBack: [] });
  });

  test("추가 3 기록 화면에서 로그인(redirectTo=/records): 기록 화면으로 돌아가고 기록 화면이 둘 쌓이지 않는다 [통과가 맞다]", async () => {
    await openApp("/records");
    await press("기록으로 돌아오는 로그인");
    expect(currentParams().redirectTo).toBe("/records");
    await loginWithEmail();

    expect(currentPathname()).toBe("/records");
    expect(screen.getByText("기록 화면")).toBeOnTheScreen();
    expect(await afterArrival()).toEqual({ stack: ["records"], shownOnBack: [] });
  });

  test("추가 4 일기 화면(/diary, 화면 이름 diary/index)에서 로그인(redirectTo=/diary): 일기 화면으로 돌아가고 일기 화면이 둘 쌓이지 않는다 [실패가 맞다]", async () => {
    await openApp("/diary");
    await press("일기로 돌아오는 로그인");
    expect(currentParams().redirectTo).toBe("/diary");
    await loginWithEmail();

    expect(currentPathname()).toBe("/diary");
    expect(screen.getByText("일기 화면")).toBeOnTheScreen();
    expect(await afterArrival()).toEqual({ stack: ["diary/index"], shownOnBack: [] });
  });
});

describe("결정 09: 동적 경로·물음표가 붙은 갈 곳은 지금처럼 갈 곳 화면을 새로 둔다", () => {
  test("추가 5 일기 글 화면(/diary/123)에서 로그인(redirectTo=/diary/123): 일기 글 화면을 새로 두고, 뒤로를 누르면 앞의 일기 글 화면이 나온다 [통과가 맞다]", async () => {
    await openApp("/diary/123");
    await press("일기 글로 돌아오는 로그인");
    expect(currentParams().redirectTo).toBe("/diary/123");
    await loginWithEmail();

    expect(currentPathname()).toBe("/diary/123");
    expect(await afterArrival()).toEqual({
      stack: ["diary/[entryId]", "diary/[entryId]"],
      shownOnBack: ["/diary/123"]
    });
  });

  test("추가 6 기록 화면에서 로그인(redirectTo=/records?date=2026-11-16): 기록 화면을 새로 두고(날짜 값을 받음), 뒤로를 누르면 앞의 기록 화면이 나온다 [통과가 맞다]", async () => {
    await openApp("/records");
    await press("날짜 붙은 기록으로 가는 로그인");
    expect(currentParams().redirectTo).toBe("/records?date=2026-11-16");
    await loginWithEmail();

    expect(currentPathname()).toBe("/records");
    expect(currentParams().date).toBe("2026-11-16");
    const arrival = await afterArrival();
    expect(arrival).toEqual({ stack: ["records", "records"], shownOnBack: ["/records"] });
  });
});
