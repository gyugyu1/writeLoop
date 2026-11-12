// [spec] qa 테스트(작업 084 앱 비밀번호 찾기, 새 기능 3단계).
// 기대값은 시나리오(02-qa-scenarios.md)에서만 가져온다. 테스트 이름 앞의 번호가 시나리오 번호다.
// 이메일 로그인 화면(src/app/login.tsx, mode=email)의 "비밀번호 찾기" 링크, 비밀번호 찾기 화면과 오가는 값(이메일, redirectTo),
// 완료 뒤 안내와 로그인 뒤 이동, 그리고 바꾸지 않을 기존 로그인 동작을 본다.
// 화면 사이 값의 파라미터 이름은 단언하지 않는다. 한 화면이 router에 넘긴 href를 풀어 다음 화면의 useLocalSearchParams로 넣고,
// 다음 화면에 보이는 결과를 단언한다.
// 가짜로 두는 것: fetch(비밀번호 찾기 요청), 로그인 상태(@/lib/session), 라우터(expo-router), Apple 로그인, 기기 저장소,
// 브라우저·링크, 안전 영역.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { TestInstance } from "test-renderer";
import ForgotPasswordScreen from "@/app/forgot-password";
import LoginScreen from "@/app/login";
import { useSession } from "@/lib/session";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true)
  },
  useLocalSearchParams: jest.fn()
}));
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 }
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
jest.mock("expo-linking", () => ({ createURL: jest.fn((path: string) => `writeloop://${path}`) }));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

const EMAIL = "user@example.com";
const RESET_DONE = "비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.";
const signIn = jest.fn();
const fetchMock = jest.fn();

function okReply(body: object) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function setParams(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
}

async function renderLogin(params: Record<string, string>) {
  setParams(params);
  await render(<LoginScreen />);
  await flushAsync();
}

async function renderForgot(params: Record<string, string>) {
  setParams(params);
  await render(<ForgotPasswordScreen />);
  await flushAsync();
}

function textInputs(): TestInstance[] {
  return screen.container.queryAll((instance) => instance.type === "TextInput");
}
function emailInput() {
  const found = textInputs().filter((input) => input.props.keyboardType === "email-address");
  expect(found).toHaveLength(1);
  return found[0];
}
function loginPasswordInput() {
  const found = textInputs().filter((input) => Boolean(input.props.secureTextEntry));
  expect(found).toHaveLength(1);
  return found[0];
}

// href(문자열이나 { pathname, params })를 경로와 파라미터로 푼다.
function parseHref(href: unknown): { path: string; params: Record<string, string> } {
  if (typeof href === "string") {
    const [path, query = ""] = href.split("?");
    const params = Object.fromEntries(
      query
        .split("&")
        .filter(Boolean)
        .map((pair) => {
          const [key, value = ""] = pair.split("=");
          return [decodeURIComponent(key), decodeURIComponent(value)];
        })
    );
    return { path, params };
  }
  const object = href as { pathname: string; params?: Record<string, string> };
  return { path: object.pathname, params: { ...(object.params ?? {}) } };
}

// 링크로 연 이동: push나 navigate 중 불린 것 하나.
function forwardNavigation() {
  const calls = [...jest.mocked(router.push).mock.calls, ...jest.mocked(router.navigate).mock.calls];
  expect(calls).toHaveLength(1);
  return parseHref(calls[0][0]);
}

// 비밀번호 찾기 화면에서 받기→확인→바꾸기를 끝내고 router.replace에 넘긴 이동을 돌려준다.
async function completeReset(forgotParams: Record<string, string>) {
  fetchMock
    .mockImplementationOnce(() => okReply({ email: EMAIL, message: "인증코드를 보냈어요." }))
    .mockImplementationOnce(() => okReply({ email: EMAIL, message: "인증코드를 확인했어요." }))
    .mockImplementationOnce(() => okReply({ email: EMAIL, message: "ok" }));
  await renderForgot(forgotParams);
  await fireEvent.changeText(emailInput(), EMAIL);
  await fireEvent.press(screen.getByText("인증코드 받기"));
  await flushAsync();
  const code = textInputs().filter((input) => input.props.keyboardType !== "email-address" && !input.props.secureTextEntry);
  await fireEvent.changeText(code[0], "123456");
  await flushAsync();
  const passwords = textInputs().filter((input) => Boolean(input.props.secureTextEntry));
  await fireEvent.changeText(passwords[0], "newpass123");
  await fireEvent.changeText(passwords[1], "newpass123");
  await fireEvent.press(screen.getByText("비밀번호 바꾸기"));
  await flushAsync();
  expect(router.replace).toHaveBeenCalledTimes(1);
  const result = parseHref(jest.mocked(router.replace).mock.calls[0][0]);
  await screen.unmount();
  jest.mocked(router.replace).mockClear();
  return result;
}

async function loginWith(password: string, email?: string) {
  if (email !== undefined) {
    await fireEvent.changeText(emailInput(), email);
  }
  await fireEvent.changeText(loginPasswordInput(), password);
  await fireEvent.press(screen.getByText("로그인하기"));
  await flushAsync();
}

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  signIn.mockReset().mockResolvedValue({ id: 1, email: EMAIL, displayName: "학습자", admin: false });
  jest.mocked(useSession).mockReturnValue({
    currentUser: null,
    isHydrating: false,
    signIn,
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn()
  } as unknown as ReturnType<typeof useSession>);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.navigate).mockReset();
});

afterEach(() => {
  // 5-1: check-email은 부르지 않는다.
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("check-email"))).toEqual([]);
});

describe("0. 들어가기", () => {
  test("0-1 비밀번호 찾기 링크가 비밀번호 칸보다 뒤에 있다", async () => {
    await renderLogin({ mode: "email" });
    const link = screen.getByText("비밀번호 찾기");
    const nodes = screen.container.queryAll(() => true);
    expect(nodes.indexOf(link)).toBeGreaterThan(nodes.indexOf(loginPasswordInput()));
  });

  test("0-2 링크(redirectTo 없음, 이메일 비움)로 /forgot-password를 열면 이메일 칸이 비어 있다", async () => {
    await renderLogin({ mode: "email" });
    await fireEvent.press(screen.getByText("비밀번호 찾기"));
    const next = forwardNavigation();
    expect(next.path).toBe("/forgot-password");
    await screen.unmount();
    await renderForgot(next.params);
    expect(emailInput().props.value).toBe("");
  });

  test("0-3 링크가 redirectTo와 쓴 이메일을 넘긴다", async () => {
    await renderLogin({ mode: "email", redirectTo: "/practice/write" });
    await fireEvent.changeText(emailInput(), EMAIL);
    await fireEvent.press(screen.getByText("비밀번호 찾기"));
    const next = forwardNavigation();
    expect(next.path).toBe("/forgot-password");
    expect(next.params.redirectTo).toBe("/practice/write");
    await screen.unmount();
    await renderForgot(next.params);
    expect(emailInput().props.value).toBe(EMAIL);
  });
});

describe("4. 완료 뒤 로그인 화면", () => {
  test("4-1, 4-2 이메일을 채우고 안내를 보이며, 로그인하면 redirectTo로 간다", async () => {
    const back = await completeReset({ redirectTo: "/practice/write" });
    expect(back.path).toBe("/login");
    await renderLogin(back.params);
    expect(emailInput().props.value).toBe(EMAIL);
    expect(screen.getByText(RESET_DONE)).toBeOnTheScreen();
    await loginWith("newpass123");
    expect(signIn).toHaveBeenCalledWith({ email: EMAIL, password: "newpass123", rememberMe: true });
    expect(router.replace).toHaveBeenCalledWith("/practice/write");
  });

  test("4-3 redirectTo가 없으면 같은 안내를 보이고 로그인 뒤 / 로 간다", async () => {
    const back = await completeReset({});
    expect(back.path).toBe("/login");
    await renderLogin(back.params);
    expect(emailInput().props.value).toBe(EMAIL);
    expect(screen.getByText(RESET_DONE)).toBeOnTheScreen();
    await loginWith("newpass123");
    expect(signIn).toHaveBeenCalledWith({ email: EMAIL, password: "newpass123", rememberMe: true });
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

describe("5. 바꾸지 않는 것(지금 로그인 동작)", () => {
  test("5-2 보통의 이메일 로그인 화면은 이메일이 비어 있고 완료 안내가 없다", async () => {
    await renderLogin({ mode: "email" });
    expect(emailInput().props.value).toBe("");
    expect(screen.queryByText(RESET_DONE)).toBeNull();
  });

  test("5-3 빈 값으로 로그인하면 기존 오류 문구", async () => {
    await renderLogin({ mode: "email" });
    await fireEvent.press(screen.getByText("로그인하기"));
    await flushAsync();
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByText("이메일과 비밀번호를 입력해 주세요.")).toBeOnTheScreen();
  });

  test("5-4 로그인 뒤 redirectTo로 간다", async () => {
    await renderLogin({ mode: "email", redirectTo: "/practice/write" });
    await loginWith("pw123456", "a@example.com");
    expect(signIn).toHaveBeenCalledWith({ email: "a@example.com", password: "pw123456", rememberMe: true });
    expect(router.replace).toHaveBeenCalledWith("/practice/write");
  });

  test("5-5 뒤로는 기존대로 /login?redirectTo=... 로 바꾼다", async () => {
    await renderLogin({ mode: "email", redirectTo: "/practice/write" });
    await fireEvent.press(screen.getByText("뒤로"));
    expect(router.replace).toHaveBeenCalledWith("/login?redirectTo=%2Fpractice%2Fwrite");
  });
});
