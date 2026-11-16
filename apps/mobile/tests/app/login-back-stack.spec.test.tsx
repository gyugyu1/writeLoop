// [spec] qa 테스트(작업 096 로그인 뒤 뒤로 가기, 버그 수정 1단계).
// 기대값은 명세(01-main-spec.md)에서만 가져온다. 테스트 이름 앞의 "재현"은 고치기 전에 실패해야 할 재현 테스트,
// "그대로"는 명세의 "그대로" 항목을 지금 동작대로 기록한 테스트(고치기 전에도 통과)다.
//
// 실제 expo-router(renderRouter, 메모리 안의 라우터)에 실제 로그인·비밀번호 찾기·회원가입·소셜 가입 화면을 올리고,
// 사용자처럼 누른 뒤 화면 쌓임(stack)과 Android 뒤로 버튼의 결과를 본다.
// Android 뒤로 버튼은 react-navigation이 BackHandler에 건 hardwareBackPress 처리기를 기기처럼 늦게 건 것부터 불러 흉내 낸다.
// 아무 처리기도 받지 않으면 앱이 닫힌 것(Android 기본 동작)으로 본다.
//
// 가짜로 두는 것: 로그인 상태(@/lib/session, 로그인하면 currentUser가 바뀌어 모든 화면이 다시 그려지게 했다),
// 인증 API(@/lib/api의 회원가입·소셜 가입·비밀번호 찾기 함수), Apple 로그인, 기기 저장소, 브라우저, 안전 영역,
// 홈·기록·일기 화면(실제 홈은 3D 로비라 무겁다. 가짜 홈은 실제 홈처럼 로그인하지 않았으면 /login으로 Redirect한다).
import type { ReactElement } from "react";
import { BackHandler, Pressable, Text, View } from "react-native";
import { Redirect, router, Stack } from "expo-router";
import { act, fireEvent, isHiddenFromAccessibility, renderRouter, screen } from "expo-router/testing-library";
import type { TestInstance } from "test-renderer";
import { store } from "expo-router/build/global-state/router-store";
import ForgotPasswordScreen from "@/app/forgot-password";
import LoginScreen from "@/app/login";
import SignupScreen from "@/app/signup";
import SocialSignupScreen from "@/app/social-signup";
import {
  completeRegistration,
  completeSocialRegistration,
  getPendingSocialRegistration,
  resetPassword,
  sendPasswordResetCode,
  verifyPasswordResetCode
} from "@/lib/api";
import { buildLoginHref } from "@/lib/login-redirect";
import { useSession } from "@/lib/session";
import type { AuthUser, SocialLoginResult } from "@/lib/types";

jest.mock("expo-apple-authentication", () => {
  const { Pressable: MockPressable, Text: MockText } = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  return {
    isAvailableAsync: jest.fn(() => Promise.resolve(mockAppleAvailable.value)),
    signInAsync: jest.fn(),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { CONTINUE: 0 },
    AppleAuthenticationButtonStyle: { BLACK: 0 },
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) =>
      React.createElement(MockPressable, { onPress }, React.createElement(MockText, null, "Apple로 계속하기"))
  };
});
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
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  sendRegistrationCode: jest.fn(),
  completeRegistration: jest.fn(),
  getPendingSocialRegistration: jest.fn(),
  completeSocialRegistration: jest.fn(),
  sendPasswordResetCode: jest.fn(),
  verifyPasswordResetCode: jest.fn(),
  resetPassword: jest.fn()
}));
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
        setSessionUser: mockSession.setSessionUser,
        signIn: mockSession.signIn,
        signInWithApple: mockSession.signInWithApple,
        signInWithSocial: mockSession.signInWithSocial,
        signOut: jest.fn()
      };
    }
  };
});

const USER: AuthUser = { id: 7, email: "user@example.com", displayName: "학습자", admin: false } as AuthUser;
const EMAIL = USER.email;
const PASSWORD = "pw123456";

const mockAppleAvailable = { value: false };
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
    setSessionUser: jest.fn((next: AuthUser | null) => set(next)),
    signIn: jest.fn(async () => {
      set(USER);
      return USER;
    }),
    signInWithApple: jest.fn(async () => {
      set(USER);
      return USER;
    }),
    signInWithSocial: jest.fn(async (): Promise<SocialLoginResult> => ({ status: "logged_in", user: USER }))
  };
})();

// ---------- 가짜 화면 ----------

function TestLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

// 실제 홈(src/app/index.tsx)처럼 로그인하지 않았으면 /login으로 보낸다.
function FakeHome() {
  const { currentUser } = useSession();
  if (!currentUser) {
    return <Redirect href="/login" />;
  }
  return <Text>홈 화면</Text>;
}

// 로그인하지 않은 채 열 수 있는 앞 화면. 버튼은 다른 갈 곳(/diary)을 redirectTo로 붙여 로그인 화면을 연다.
function FakeRecords() {
  return (
    <View>
      <Text>기록 화면</Text>
      <Pressable onPress={() => router.push(buildLoginHref("/diary"))}>
        <Text>기록에서 로그인</Text>
      </Pressable>
      <Pressable onPress={() => router.push(buildLoginHref("//evil.example.com"))}>
        <Text>잘못된 갈 곳으로 로그인</Text>
      </Pressable>
    </View>
  );
}

function FakeDiary() {
  return <Text>일기 화면</Text>;
}

const ROUTES: Record<string, () => ReactElement | null> = {
  _layout: TestLayout,
  index: FakeHome,
  login: LoginScreen,
  "forgot-password": ForgotPasswordScreen,
  signup: SignupScreen,
  "social-signup": SocialSignupScreen,
  records: FakeRecords,
  "diary/index": FakeDiary
};

const AUTH_ROUTE_NAMES = ["login", "forgot-password", "signup", "social-signup"];

// ---------- Android 뒤로 버튼 ----------

type BackListener = () => boolean | null | undefined;
let backListeners: BackListener[] = [];

// 기기처럼 늦게 건 처리기부터 부르고, 하나가 true를 돌려주면 멈춘다. 아무도 받지 않으면 앱이 닫힌다.
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
  // expo-router는 루트 아래에 __root 하나를 두고 그 안에 _layout의 Stack을 둔다.
  while (state?.routes?.length === 1 && state.routes[0].state && state.routes[0].name === "__root") {
    state = state.routes[0].state;
  }
  return (state?.routes ?? []).map((route) => route.name);
}

function authRoutesInStack() {
  return stackRouteNames().filter((name) => AUTH_ROUTE_NAMES.includes(name));
}

// 갈 곳에 도착한 직후의 쌓임에 남은 로그인 관련 화면과, 그 뒤 앱이 닫힐 때까지 뒤로 버튼을 눌러 보인 경로.
async function afterArrival() {
  const remaining = authRoutesInStack();
  return { authRoutesInStack: remaining, shownOnBack: await pressBackUntilClosed() };
}

// 갈 곳이 홈일 때: 뒤로 버튼은 앱을 닫거나 홈에 남아야 하므로 홈(/)이 아닌 경로가 보이면 안 된다.
async function afterArrivalHome() {
  const { authRoutesInStack: remaining, shownOnBack } = await afterArrival();
  return { authRoutesInStack: remaining, shownOnBackOtherThanHome: shownOnBack.filter((path) => path !== "/") };
}

// 쌓임 아래의 화면도 그려져 있으므로, Testing Library의 텍스트 찾기처럼 접근성에서 숨은(아래에 깔린) 화면의 칸은 뺀다.
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

// 처음 로그인 화면의 "로그인하기"(이메일 로그인으로 들어가기).
async function openEmailLogin() {
  await press("로그인하기");
  expect(currentPathname()).toBe("/login");
  expect(currentParams().mode).toBe("email");
}

// 이메일 로그인 화면에서 이메일·비밀번호를 넣고 로그인한다.
async function submitEmailLogin(fillEmail = true) {
  if (fillEmail) {
    await fireEvent.changeText(inputBy((input) => input.props.keyboardType === "email-address"), EMAIL);
  }
  await fireEvent.changeText(inputBy((input) => Boolean(input.props.secureTextEntry)), PASSWORD);
  await press("로그인하기");
}

// 비밀번호 찾기 화면에서 받기→확인→바꾸기를 끝낸다(끝나면 이메일 로그인 화면으로 돌아간다).
async function completePasswordReset() {
  jest.mocked(sendPasswordResetCode).mockResolvedValue({ email: EMAIL, message: "인증코드를 보냈어요." } as never);
  jest.mocked(verifyPasswordResetCode).mockResolvedValue({ email: EMAIL, message: "인증코드를 확인했어요." } as never);
  jest.mocked(resetPassword).mockResolvedValue({ email: EMAIL, message: "ok" } as never);
  const emailInput = inputBy((input) => input.props.keyboardType === "email-address");
  if (!emailInput.props.value) {
    await fireEvent.changeText(emailInput, EMAIL);
  }
  await press("인증코드 받기");
  await fireEvent.changeText(
    inputBy((input) => input.props.keyboardType !== "email-address" && !input.props.secureTextEntry),
    "123456"
  );
  await flushAsync();
  const passwords = textInputs().filter((input) => Boolean(input.props.secureTextEntry));
  expect(passwords).toHaveLength(2);
  await fireEvent.changeText(passwords[0], "newpass123");
  await fireEvent.changeText(passwords[1], "newpass123");
  await press("비밀번호 바꾸기");
}

async function completeSignup() {
  jest.mocked(completeRegistration).mockResolvedValue(undefined as never);
  await fireEvent.changeText(inputBy((input) => input.props.placeholder === "앱에서 보여질 이름을 입력해 주세요."), "학습자");
  await fireEvent.changeText(inputBy((input) => input.props.keyboardType === "email-address"), EMAIL);
  await fireEvent.changeText(inputBy((input) => input.props.keyboardType === "number-pad"), "123456");
  const passwords = textInputs().filter((input) => Boolean(input.props.secureTextEntry));
  expect(passwords).toHaveLength(2);
  await fireEvent.changeText(passwords[0], "newpass123");
  await fireEvent.changeText(passwords[1], "newpass123");
  await press("[필수] 만 14세 이상입니다.");
  await press("[필수] 개인정보 수집·이용에 동의합니다.");
  await press("[필수] 개인정보처리방침을 확인했습니다.");
  await press("회원가입 완료");
  expect(completeRegistration).toHaveBeenCalledTimes(1);
}

beforeEach(() => {
  mockSession.set(null);
  mockAppleAvailable.value = false;
  jest.clearAllMocks();
  mockSession.signInWithSocial.mockImplementation(async () => {
    mockSession.set(USER);
    return { status: "logged_in", user: USER };
  });
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

// =====================================================================
// 재현: 고치기 전에는 실패해야 한다(뒤로 버튼으로 로그인 관련 화면이 다시 나온다).
// 갈 곳이 홈이면 뒤로 버튼은 앱을 닫거나 홈에 남아야 하고(명세 "홈이면 앱이 닫히거나 홈에 남는"),
// 다른 갈 곳이면 로그인 화면을 열기 전 화면으로 가야 한다(명세 "다른 갈 곳이면 그 앞 화면").
// =====================================================================

describe("재현: 로그인을 마치고 갈 곳으로 간 뒤 화면 쌓임에 로그인 관련 화면이 남지 않는다", () => {
  test("재현 1 보통 로그인(처음 로그인 화면 → 이메일 로그인 → 로그인) 뒤 홈, 뒤로 버튼은 로그인 화면을 보이지 않는다", async () => {
    await openApp("/");
    expect(currentPathname()).toBe("/login");
    await openEmailLogin();
    await submitEmailLogin();

    expect(mockSession.signIn).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD, rememberMe: true });
    expect(currentPathname()).toBe("/");
    expect(screen.getByText("홈 화면")).toBeOnTheScreen();
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });

  test("재현 2 비밀번호 찾기를 거친 로그인 뒤 홈, 뒤로 버튼은 로그인 화면을 보이지 않는다", async () => {
    await openApp("/");
    await openEmailLogin();
    await press("비밀번호 찾기");
    expect(currentPathname()).toBe("/forgot-password");
    await completePasswordReset();
    expect(currentPathname()).toBe("/login");
    expect(currentParams().reset).toBe("done");
    await submitEmailLogin(false);

    expect(currentPathname()).toBe("/");
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });

  test("재현 3 회원가입 뒤 홈, 뒤로 버튼은 로그인·회원가입 화면을 보이지 않는다", async () => {
    await openApp("/");
    await press("회원가입");
    expect(currentPathname()).toBe("/signup");
    await completeSignup();

    expect(mockSession.signIn).toHaveBeenCalledWith({ email: EMAIL, password: "newpass123", rememberMe: true });
    expect(currentPathname()).toBe("/");
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });

  // 처음 로그인 화면 하나에서 바로 소셜 로그인하면 그 화면 하나가 바뀌어 지금도 남지 않는다(그대로 16).
  // 이메일 로그인에 들어갔다가 "뒤로"로 처음 로그인 화면에 돌아온 뒤 소셜 로그인하면 로그인 화면이 둘 쌓여 있다.
  test("재현 4 이메일 로그인에 들어갔다 뒤로 돌아와 소셜 로그인(이미 가입한 계정) 뒤 홈, 뒤로 버튼은 로그인 화면을 보이지 않는다", async () => {
    await openApp("/");
    await openEmailLogin();
    await press("뒤로");
    expect(currentParams().mode).toBeUndefined();
    await press("구글로 계속하기");

    expect(mockSession.signInWithSocial).toHaveBeenCalledWith("google");
    expect(currentPathname()).toBe("/");
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });

  test("재현 5 소셜 가입(닉네임 설정) 뒤 홈, 뒤로 버튼은 로그인·소셜 가입 화면을 보이지 않는다", async () => {
    mockSession.signInWithSocial.mockImplementation(async () => ({
      status: "signup_required",
      token: "pending-token",
      provider: "kakao"
    }) as SocialLoginResult);
    jest.mocked(getPendingSocialRegistration).mockResolvedValue({
      provider: "kakao",
      suggestedDisplayName: "카카오학습자"
    } as never);
    jest.mocked(completeSocialRegistration).mockResolvedValue(USER as never);
    await openApp("/");
    await press("카카오로 계속하기");
    expect(currentPathname()).toBe("/social-signup");
    await press("가입 완료");

    expect(completeSocialRegistration).toHaveBeenCalledWith({ token: "pending-token", displayName: "카카오학습자" });
    expect(currentPathname()).toBe("/");
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });

  test("재현 6 이메일 로그인에 들어갔다 뒤로 돌아와 Apple 로그인 뒤 홈, 뒤로 버튼은 로그인 화면을 보이지 않는다", async () => {
    mockAppleAvailable.value = true;
    const apple = jest.requireMock("expo-apple-authentication") as { signInAsync: jest.Mock };
    apple.signInAsync.mockResolvedValue({ identityToken: "apple-token", email: EMAIL, fullName: null });
    await openApp("/");
    await openEmailLogin();
    await press("뒤로");
    await press("Apple로 계속하기");

    expect(mockSession.signInWithApple).toHaveBeenCalledTimes(1);
    expect(currentPathname()).toBe("/");
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });

  test("재현 7 다른 갈 곳(redirectTo=/diary): 로그인 뒤 일기, 뒤로 버튼은 로그인 화면을 연 앞 화면(기록)으로 간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    expect(currentPathname()).toBe("/login");
    await openEmailLogin();
    await submitEmailLogin();

    expect(currentPathname()).toBe("/diary");
    expect(await afterArrival()).toEqual({ authRoutesInStack: [], shownOnBack: ["/records"] });
  });

  test("재현 8 다른 갈 곳에서 비밀번호 찾기를 거친 로그인 뒤, 뒤로 버튼은 앞 화면(기록)으로 간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await openEmailLogin();
    await press("비밀번호 찾기");
    await completePasswordReset();
    await submitEmailLogin(false);

    expect(currentPathname()).toBe("/diary");
    expect(await afterArrival()).toEqual({ authRoutesInStack: [], shownOnBack: ["/records"] });
  });

  test("재현 9 다른 갈 곳에서 회원가입 뒤, 뒤로 버튼은 앞 화면(기록)으로 간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await press("회원가입");
    await completeSignup();

    expect(currentPathname()).toBe("/diary");
    expect(await afterArrival()).toEqual({ authRoutesInStack: [], shownOnBack: ["/records"] });
  });

  test("재현 10 다른 갈 곳에서 소셜 가입 뒤, 뒤로 버튼은 앞 화면(기록)으로 간다", async () => {
    mockSession.signInWithSocial.mockImplementation(async () => ({
      status: "signup_required",
      token: "pending-token",
      provider: "naver"
    }) as SocialLoginResult);
    jest.mocked(getPendingSocialRegistration).mockResolvedValue({
      provider: "naver",
      suggestedDisplayName: "네이버학습자"
    } as never);
    jest.mocked(completeSocialRegistration).mockResolvedValue(USER as never);
    await openApp("/records");
    await press("기록에서 로그인");
    await press("네이버로 계속하기");
    expect(currentPathname()).toBe("/social-signup");
    await press("가입 완료");

    expect(currentPathname()).toBe("/diary");
    expect(await afterArrival()).toEqual({ authRoutesInStack: [], shownOnBack: ["/records"] });
  });
});

// =====================================================================
// 그대로: 고치기 전에도 통과해야 하고, 고친 뒤에도 통과해야 한다.
// =====================================================================

describe("그대로: 로그인 뒤 갈 곳(redirectTo) 규칙", () => {
  test("그대로 1 redirectTo가 없으면 로그인 뒤 홈(/)으로 간다", async () => {
    await openApp("/");
    await openEmailLogin();
    await submitEmailLogin();
    expect(currentPathname()).toBe("/");
    expect(screen.getByText("홈 화면")).toBeOnTheScreen();
  });

  test("그대로 2 redirectTo=/diary면 로그인 뒤 /diary로 간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    expect(currentParams().redirectTo).toBe("/diary");
    await openEmailLogin();
    expect(currentParams().redirectTo).toBe("/diary");
    await submitEmailLogin();
    expect(currentPathname()).toBe("/diary");
    expect(screen.getByText("일기 화면")).toBeOnTheScreen();
  });

  test("그대로 3 redirectTo가 //로 시작하면 로그인 뒤 홈(/)으로 간다", async () => {
    await openApp("/records");
    await press("잘못된 갈 곳으로 로그인");
    await openEmailLogin();
    await submitEmailLogin();
    expect(currentPathname()).toBe("/");
    expect(screen.getByText("홈 화면")).toBeOnTheScreen();
  });

  test("그대로 4 비밀번호 찾기를 거쳐도 redirectTo를 잃지 않고 로그인 뒤 /diary로 간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await openEmailLogin();
    await press("비밀번호 찾기");
    expect(currentParams().redirectTo).toBe("/diary");
    await completePasswordReset();
    expect(currentParams().redirectTo).toBe("/diary");
    await submitEmailLogin(false);
    expect(currentPathname()).toBe("/diary");
  });

  test("그대로 5 회원가입으로 가도 redirectTo를 잃지 않고 가입 뒤 /diary로 간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await press("회원가입");
    expect(currentPathname()).toBe("/signup");
    expect(currentParams().redirectTo).toBe("/diary");
    await completeSignup();
    expect(currentPathname()).toBe("/diary");
  });
});

describe("그대로: 로그인 화면 사이의 이동", () => {
  test("그대로 6 처음 로그인 화면의 로그인하기 → 이메일 로그인(/login, mode=email)", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await press("로그인하기");
    expect(currentPathname()).toBe("/login");
    expect(currentParams()).toMatchObject({ mode: "email", redirectTo: "/diary" });
    expect(screen.getByText("이메일 로그인")).toBeOnTheScreen();
  });

  test("그대로 7 이메일 로그인의 비밀번호 찾기 → /forgot-password(쓴 이메일과 redirectTo를 넘긴다)", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await openEmailLogin();
    await fireEvent.changeText(inputBy((input) => input.props.keyboardType === "email-address"), EMAIL);
    await press("비밀번호 찾기");
    expect(currentPathname()).toBe("/forgot-password");
    expect(currentParams()).toMatchObject({ email: EMAIL, redirectTo: "/diary" });
    expect(inputBy((input) => input.props.keyboardType === "email-address").props.value).toBe(EMAIL);
  });

  test("그대로 8 처음 로그인 화면의 회원가입 → /signup", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await press("회원가입");
    expect(currentPathname()).toBe("/signup");
    expect(screen.getByText("회원가입 완료")).toBeOnTheScreen();
  });

  test("그대로 9 이메일 로그인 화면의 뒤로 → 처음 로그인 화면(/login, mode 없음, redirectTo 유지)", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await openEmailLogin();
    await press("뒤로");
    expect(currentPathname()).toBe("/login");
    expect(currentParams().mode).toBeUndefined();
    expect(currentParams().redirectTo).toBe("/diary");
    expect(screen.getByText("회원가입")).toBeOnTheScreen();
  });

  test("그대로 10 비밀번호 찾기 화면의 뒤로 → 이메일 로그인(/login, mode=email)", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await openEmailLogin();
    await press("비밀번호 찾기");
    await press("뒤로");
    expect(currentPathname()).toBe("/login");
    expect(currentParams()).toMatchObject({ mode: "email", redirectTo: "/diary" });
    expect(screen.getByText("이메일 로그인")).toBeOnTheScreen();
  });

  test("그대로 11 회원가입 화면의 로그인으로 → 처음 로그인 화면(/login, redirectTo 유지)", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await press("회원가입");
    await press("로그인으로");
    expect(currentPathname()).toBe("/login");
    expect(currentParams().mode).toBeUndefined();
    expect(currentParams().redirectTo).toBe("/diary");
  });

  test("그대로 12 이메일 로그인 화면에서 Android 뒤로 버튼 → 처음 로그인 화면", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await openEmailLogin();
    expect(await pressAndroidBack()).toBe("handled");
    expect(currentPathname()).toBe("/login");
    expect(currentParams().mode).toBeUndefined();
  });
});

describe("그대로: 로그인하지 않은 채 로그인 화면에서 뒤로 가기", () => {
  test("그대로 13 로그인하지 않은 채 로그인 화면에서 Android 뒤로 버튼 → 앞 화면(기록)으로 돌아간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    expect(currentPathname()).toBe("/login");
    expect(await pressAndroidBack()).toBe("handled");
    expect(currentPathname()).toBe("/records");
    expect(screen.getByText("기록 화면")).toBeOnTheScreen();
    expect(mockSession.signIn).not.toHaveBeenCalled();
  });
});

describe("그대로: 이미 로그인한 채 로그인 화면이 열리면 갈 곳으로 보낸다", () => {
  test("그대로 14 이미 로그인한 채 /login?redirectTo=/diary가 열리면 /diary로 간다", async () => {
    mockSession.set(USER);
    await openApp("/records");
    await press("기록에서 로그인");
    expect(currentPathname()).toBe("/diary");
    expect(screen.getByText("일기 화면")).toBeOnTheScreen();
    expect(mockSession.signIn).not.toHaveBeenCalled();
  });

  test("그대로 15 이미 로그인한 채 redirectTo 없는 /login이 열리면 홈(/)으로 간다", async () => {
    mockSession.set(USER);
    await openApp("/login");
    expect(currentPathname()).toBe("/");
    expect(screen.getByText("홈 화면")).toBeOnTheScreen();
  });
});

// 처음 로그인 화면 하나만 쌓인 채 바로 소셜·Apple 로그인하는 경로는 router.replace가 그 하나를 바꿔 지금도 남지 않는다.
// 명세의 고친 뒤 기대("소셜 로그인 뒤 로그인 관련 화면이 남지 않는다")와 같은 결과라 고치기 전에도 통과한다. 고친 뒤에도 통과해야 한다.
describe("그대로: 처음 로그인 화면에서 바로 소셜 로그인(지금도 기대대로인 경로)", () => {
  test("그대로 16 처음 로그인 화면에서 바로 구글 로그인 뒤 홈, 쌓임에 로그인 화면이 없고 뒤로 버튼은 로그인 화면을 보이지 않는다", async () => {
    await openApp("/");
    await press("구글로 계속하기");
    expect(mockSession.signInWithSocial).toHaveBeenCalledWith("google");
    expect(currentPathname()).toBe("/");
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });

  test("그대로 17 앞 화면(기록)에서 연 로그인 화면에서 바로 구글 로그인 뒤 /diary, 뒤로 버튼은 기록으로 간다", async () => {
    await openApp("/records");
    await press("기록에서 로그인");
    await press("구글로 계속하기");
    expect(currentPathname()).toBe("/diary");
    expect(await afterArrival()).toEqual({ authRoutesInStack: [], shownOnBack: ["/records"] });
  });

  test("그대로 18 처음 로그인 화면에서 바로 Apple 로그인 뒤 홈, 쌓임에 로그인 화면이 없다", async () => {
    mockAppleAvailable.value = true;
    const apple = jest.requireMock("expo-apple-authentication") as { signInAsync: jest.Mock };
    apple.signInAsync.mockResolvedValue({ identityToken: "apple-token", email: EMAIL, fullName: null });
    await openApp("/");
    await press("Apple로 계속하기");
    expect(mockSession.signInWithApple).toHaveBeenCalledTimes(1);
    expect(currentPathname()).toBe("/");
    expect(await afterArrivalHome()).toEqual({ authRoutesInStack: [], shownOnBackOtherThanHome: [] });
  });
});
