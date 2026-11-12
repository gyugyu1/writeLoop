// [spec] qa 테스트(작업 084 앱 비밀번호 찾기, 새 기능 3단계).
// 기대값은 시나리오(02-qa-scenarios.md)와 결정(03-main-decision.md)에서만 가져온다. 테스트 이름 앞의 번호가 시나리오 번호이고,
// "결정 N"은 03 결정 파일의 항목 번호다.
// 비밀번호 찾기 화면(src/app/forgot-password.tsx)을 렌더하고 사용자처럼 넣고 눌러 본다.
// 네트워크는 실제 @/lib/api를 쓰고 전역 fetch만 가짜로 둔다. 요청은 fetch에 들어온 URL·method·본문 JSON으로 단언한다.
// 가짜로 두는 것: fetch, 라우터(expo-router), 기기 저장소(expo-secure-store), 브라우저·링크(expo-web-browser, expo-linking), 안전 영역.
// 남은 시간 때문에 가짜 시계로 돌린다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { TestInstance } from "test-renderer";
import ForgotPasswordScreen from "@/app/forgot-password";

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

// ---------- 고정 값 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const EMAIL = "user@example.com";
const SOCIAL_NOTICE = "소셜 로그인(구글·애플 등)으로 가입한 계정은 비밀번호가 없어요. 그 버튼으로 로그인해 주세요.";
const EXPIRED = "인증코드 입력 시간이 지났어요. 다시 받아 주세요.";
const SEND = "인증코드 받기";
const RESEND = "인증코드 다시 받기";
const RESET = "비밀번호 바꾸기";
const SENT_NOTICE = "인증코드를 보냈어요.";
const VERIFIED_NOTICE = "인증코드를 확인했어요.";
const MSG_EMPTY_EMAIL = "이메일을 입력해 주세요.";
const MSG_SEND_FALLBACK = "인증코드를 보내지 못했어요.";
const MSG_VERIFY_FALLBACK = "인증코드를 확인하지 못했어요.";
const MSG_RESET_FALLBACK = "비밀번호를 바꾸지 못했어요.";
const MSG_PW_EMPTY = "새 비밀번호를 두 번 입력해 주세요.";
const MSG_PW_SHORT = "비밀번호는 8자 이상이어야 해요.";
const MSG_PW_MISMATCH = "새 비밀번호와 비밀번호 확인이 달라요.";

// ---------- 가짜 fetch ----------

type FetchReply = () => Promise<unknown>;
const replies: Record<string, FetchReply[]> = {};
const fetchMock = jest.fn();

function okReply(body: object): FetchReply {
  return () => Promise.resolve({ ok: true, status: 200, json: async () => body });
}
function failReply(body: object): FetchReply {
  return () => Promise.resolve({ ok: false, status: 400, json: async () => body });
}
function networkFailReply(): FetchReply {
  return () => Promise.reject(new TypeError("Network request failed"));
}
function pendingReply(): FetchReply {
  return () => new Promise(() => undefined);
}

// path는 send-code, verify-code, complete. 들어온 순서대로 쓴다.
function queue(path: string, ...items: FetchReply[]) {
  replies[path] = [...(replies[path] ?? []), ...items];
}

type Call = { url: string; method: string; body: unknown };

function allCalls(): Call[] {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: String((init as RequestInit | undefined)?.method ?? "GET"),
    body: (init as RequestInit | undefined)?.body ? JSON.parse(String((init as RequestInit).body)) : undefined
  }));
}

function callsTo(path: string) {
  return allCalls().filter((call) => call.url.endsWith(`/api/auth/password-reset/${path}`));
}

// ---------- 도우미 ----------

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flushAsync();
}

function setParams(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
}

async function renderScreen(params: Record<string, string> = {}) {
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
function codeInputs() {
  return textInputs().filter((input) => input.props.keyboardType !== "email-address" && !input.props.secureTextEntry);
}
function codeInput() {
  const found = codeInputs();
  expect(found).toHaveLength(1);
  return found[0];
}
function passwordInputs() {
  return textInputs().filter((input) => Boolean(input.props.secureTextEntry));
}
function spinners() {
  return screen.container.queryAll((instance) => instance.type === "ActivityIndicator");
}
// "분:초" 부분만 찾는다(앞뒤에 다른 글자가 붙어도 된다).
function timerText(label: string) {
  return screen.queryByText(new RegExp(`(^|[^0-9])${label}($|[^0-9])`));
}

// href(문자열이나 { pathname, params })를 경로와 파라미터로 푼다. 파라미터 이름 순서는 단언하지 않는다.
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

function lastReplaceHref() {
  expect(router.replace).toHaveBeenCalledTimes(1);
  return parseHref(jest.mocked(router.replace).mock.calls[0][0]);
}

async function typeEmail(value: string) {
  await fireEvent.changeText(emailInput(), value);
  await flushAsync();
}
async function typeCode(value: string) {
  await fireEvent.changeText(codeInput(), value);
  await flushAsync();
}
async function press(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}
async function typePasswords(newPassword: string, confirmPassword: string) {
  const [first, second] = passwordInputs();
  await fireEvent.changeText(first, newPassword);
  await fireEvent.changeText(second, confirmPassword);
  await flushAsync();
}

// 1-3 상태: 코드 받기 성공.
async function sendCodeSuccess(params: Record<string, string> = {}, email = EMAIL) {
  await renderScreen(params);
  queue("send-code", okReply({ email: email.trim(), message: SENT_NOTICE }));
  await typeEmail(email);
  await press(SEND);
}

// 2-5 상태: 코드 123456 확인 성공.
async function verifySuccess(params: Record<string, string> = {}, email = EMAIL) {
  await sendCodeSuccess(params, email);
  queue("verify-code", okReply({ email: email.trim(), message: VERIFIED_NOTICE }));
  await typeCode("123456");
}

function expectStage1Closed() {
  expect(codeInputs()).toHaveLength(0);
  expect(passwordInputs()).toHaveLength(0);
  expect(screen.queryByText(RESET)).toBeNull();
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  for (const key of Object.keys(replies)) {
    delete replies[key];
  }
  fetchMock.mockReset().mockImplementation((url: string) => {
    const path = String(url).split("/api/auth/password-reset/")[1] ?? "";
    const next = replies[path]?.shift();
    if (!next) {
      return Promise.reject(new Error(`예상하지 않은 요청: ${url}`));
    }
    return next();
  });
  (globalThis as { fetch: unknown }).fetch = fetchMock;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.back).mockReset();
});

afterEach(() => {
  // 5-1: check-email은 어떤 흐름에서도 부르지 않는다.
  expect(allCalls().filter((call) => call.url.includes("/api/auth/password-reset/check-email"))).toEqual([]);
  jest.useRealTimers();
});

// ---------- 0. 들어가기 ----------

describe("0. 들어가기", () => {
  test("0-4 뒤로: redirectTo가 있으면 router.replace로 /login(mode=email, redirectTo 유지)", async () => {
    await renderScreen({ redirectTo: "/practice/write" });
    await fireEvent.press(screen.getByText("뒤로"));
    expect(lastReplaceHref()).toEqual({ path: "/login", params: { mode: "email", redirectTo: "/practice/write" } });
  });

  test("0-5 뒤로: redirectTo가 없으면 router.replace로 /login?mode=email", async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText("뒤로"));
    expect(lastReplaceHref()).toEqual({ path: "/login", params: { mode: "email" } });
  });

  test("0-6 소셜 계정 안내 문구가 보인다", async () => {
    await renderScreen();
    expect(screen.getByText(SOCIAL_NOTICE)).toBeOnTheScreen();
  });

  test("0-7 처음 상태: 이메일 칸과 인증코드 받기만 있다", async () => {
    await renderScreen();
    expect(emailInput()).toBeTruthy();
    expect(screen.getByText(SEND)).toBeOnTheScreen();
    expectStage1Closed();
    expect(timerText("3:00")).toBeNull();
  });
});

// ---------- 1. 인증코드 받기 ----------

describe("1. 인증코드 받기", () => {
  test("1-1 이메일이 비면 요청하지 않고 안내한다", async () => {
    await renderScreen();
    await press(SEND);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(MSG_EMPTY_EMAIL)).toBeOnTheScreen();
  });

  test("결정 4: 공백만 있는 이메일도 빈 값으로 보고 요청하지 않는다", async () => {
    await renderScreen();
    await typeEmail("   ");
    await press(SEND);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(MSG_EMPTY_EMAIL)).toBeOnTheScreen();
  });

  test("1-2 send-code 본문은 앞뒤 공백을 뺀 이메일 하나", async () => {
    await sendCodeSuccess({}, `  ${EMAIL}  `);
    expect(callsTo("send-code")).toEqual([
      { url: expect.stringMatching(/\/api\/auth\/password-reset\/send-code$/), method: "POST", body: { email: EMAIL } }
    ]);
  });

  test("1-3 성공: 서버 문구, 코드 칸, 3:00, 다시 받기 버튼", async () => {
    await sendCodeSuccess();
    expect(screen.getByText(SENT_NOTICE)).toBeOnTheScreen();
    expect(codeInputs()).toHaveLength(1);
    expect(timerText("3:00")).toBeOnTheScreen();
    expect(screen.getByText(RESEND)).toBeOnTheScreen();
    expect(screen.queryByText(SEND)).toBeNull();
  });

  test("1-4 남은 시간이 1초씩 준다(2:59, 2:00, 0:05)", async () => {
    await sendCodeSuccess();
    await advance(1000);
    expect(timerText("2:59")).toBeOnTheScreen();
    await advance(59_000);
    expect(timerText("2:00")).toBeOnTheScreen();
    await advance(115_000);
    expect(timerText("0:05")).toBeOnTheScreen();
  });

  test("1-5 실패(서버 문구): 문구를 보이고 1단계에 머문다", async () => {
    await renderScreen();
    queue("send-code", failReply({ message: "잠시 후 다시 시도해 주세요." }));
    await typeEmail(EMAIL);
    await press(SEND);
    expect(screen.getByText("잠시 후 다시 시도해 주세요.")).toBeOnTheScreen();
    expect(codeInputs()).toHaveLength(0);
    expect(timerText("3:00")).toBeNull();
    expect(screen.getByText(SEND)).toBeOnTheScreen();
  });

  test("1-6 실패(서버 문구 없음): 기본 문구", async () => {
    await renderScreen();
    queue("send-code", failReply({}));
    await typeEmail(EMAIL);
    await press(SEND);
    expect(screen.getByText(MSG_SEND_FALLBACK)).toBeOnTheScreen();
    expect(codeInputs()).toHaveLength(0);
  });

  test("결정 1: 네트워크 실패면 1단계 기본 문구", async () => {
    await renderScreen();
    queue("send-code", networkFailReply());
    await typeEmail(EMAIL);
    await press(SEND);
    expect(screen.getByText(MSG_SEND_FALLBACK)).toBeOnTheScreen();
    expect(codeInputs()).toHaveLength(0);
    expect(screen.getByText(SEND)).toBeOnTheScreen();
  });

  test("1-7 보내는 중: 버튼을 막고 진행 표시, 다시 눌러도 요청 1번", async () => {
    await renderScreen();
    queue("send-code", pendingReply(), okReply({ email: EMAIL, message: SENT_NOTICE }));
    await typeEmail(EMAIL);
    await press(SEND);
    const shown = spinners();
    expect(shown).toHaveLength(1);
    expect(shown[0].parent!).toBeDisabled();
    await fireEvent.press(shown[0]);
    await flushAsync();
    expect(callsTo("send-code")).toHaveLength(1);
  });

  test("1-8 코드를 받은 뒤 이메일을 고치면 코드 칸·남은 시간을 닫고 1단계로", async () => {
    await sendCodeSuccess();
    await typeEmail("other@example.com");
    expectStage1Closed();
    expect(timerText("3:00")).toBeNull();
    expect(screen.getByText(SEND)).toBeOnTheScreen();
    expect(screen.queryByText(RESEND)).toBeNull();
  });

  test("1-8 확인 성공 뒤 이메일을 고치면 확인 결과·새 비밀번호 칸까지 닫는다", async () => {
    await verifySuccess();
    expect(passwordInputs()).toHaveLength(2);
    await typeEmail("other@example.com");
    expectStage1Closed();
    expect(screen.queryByText(VERIFIED_NOTICE)).toBeNull();
    expect(timerText("3:00")).toBeNull();
    expect(screen.getByText(SEND)).toBeOnTheScreen();
  });

  test("결정 5: 이메일의 공백만 고쳐도 1단계로 돌아간다", async () => {
    await verifySuccess();
    await typeEmail(`${EMAIL} `);
    expectStage1Closed();
    expect(screen.getByText(SEND)).toBeOnTheScreen();
  });

  test("1-9 이메일을 고친 뒤 다시 받으면 새 이메일로 보낸다", async () => {
    await sendCodeSuccess();
    await typeEmail("other@example.com");
    queue("send-code", okReply({ email: "other@example.com", message: SENT_NOTICE }));
    await press(SEND);
    expect(callsTo("send-code").map((call) => call.body)).toEqual([{ email: EMAIL }, { email: "other@example.com" }]);
  });
});

// ---------- 2. 코드 확인 ----------

describe("2. 코드 확인", () => {
  test("2-1 숫자만 남는다", async () => {
    await sendCodeSuccess();
    await typeCode("12a34b");
    expect(codeInput().props.value).toBe("1234");
    expect(callsTo("verify-code")).toHaveLength(0);
  });

  test("2-2 6자리까지만 남는다", async () => {
    await sendCodeSuccess();
    queue("verify-code", okReply({ email: EMAIL, message: VERIFIED_NOTICE }));
    await typeCode("12345678");
    expect(codeInput().props.value).toBe("123456");
  });

  test("2-3 6자리 전에는 확인하지 않는다", async () => {
    await sendCodeSuccess();
    await typeCode("12345");
    expect(callsTo("verify-code")).toHaveLength(0);
  });

  test("2-4 6자리가 되면 verify-code를 정확히 한 번 보낸다", async () => {
    await verifySuccess();
    await advance(5000);
    expect(callsTo("verify-code")).toEqual([
      {
        url: expect.stringMatching(/\/api\/auth\/password-reset\/verify-code$/),
        method: "POST",
        body: { email: EMAIL, code: "123456" }
      }
    ]);
  });

  test("결정 5: verify-code 본문의 email도 앞뒤 공백을 뺀 값", async () => {
    await verifySuccess({}, `  ${EMAIL}  `);
    expect(callsTo("verify-code").map((call) => call.body)).toEqual([{ email: EMAIL, code: "123456" }]);
  });

  test("2-5 확인 성공: 서버 문구와 새 비밀번호 칸·버튼", async () => {
    await verifySuccess();
    expect(screen.getByText(VERIFIED_NOTICE)).toBeOnTheScreen();
    expect(passwordInputs()).toHaveLength(2);
    expect(screen.getByText(RESET)).toBeOnTheScreen();
  });

  test("2-6 확인 실패(서버 문구): 문구를 보이고 새 비밀번호 칸은 닫혀 있다", async () => {
    await sendCodeSuccess();
    queue("verify-code", failReply({ message: "인증코드가 맞지 않아요." }));
    await typeCode("111111");
    expect(screen.getByText("인증코드가 맞지 않아요.")).toBeOnTheScreen();
    expect(passwordInputs()).toHaveLength(0);
    expect(screen.queryByText(RESET)).toBeNull();
  });

  test("2-7 확인 실패(서버 문구 없음): 기본 문구", async () => {
    await sendCodeSuccess();
    queue("verify-code", failReply({}));
    await typeCode("111111");
    expect(screen.getByText(MSG_VERIFY_FALLBACK)).toBeOnTheScreen();
    expect(passwordInputs()).toHaveLength(0);
  });

  test("결정 1: 확인 중 네트워크 실패면 2단계 기본 문구", async () => {
    await sendCodeSuccess();
    queue("verify-code", networkFailReply());
    await typeCode("111111");
    expect(screen.getByText(MSG_VERIFY_FALLBACK)).toBeOnTheScreen();
    expect(passwordInputs()).toHaveLength(0);
  });

  test("2-8 실패 뒤 고쳐 다시 6자리가 되면 다시 확인한다", async () => {
    await sendCodeSuccess();
    queue("verify-code", failReply({ message: "인증코드가 맞지 않아요." }));
    await typeCode("111111");
    await typeCode("11111");
    expect(callsTo("verify-code")).toHaveLength(1);
    queue("verify-code", okReply({ email: EMAIL, message: VERIFIED_NOTICE }));
    await typeCode("654321");
    expect(callsTo("verify-code").map((call) => call.body)).toEqual([
      { email: EMAIL, code: "111111" },
      { email: EMAIL, code: "654321" }
    ]);
    expect(passwordInputs()).toHaveLength(2);
  });

  test("2-9 확인 뒤 코드를 지우면 새 비밀번호 칸을 닫는다", async () => {
    await verifySuccess();
    await typeCode("12345");
    expect(passwordInputs()).toHaveLength(0);
    expect(screen.queryByText(RESET)).toBeNull();
  });

  test("2-10 풀린 뒤 다시 6자리가 되면 다시 확인한다", async () => {
    await verifySuccess();
    await typeCode("12345");
    queue("verify-code", okReply({ email: EMAIL, message: VERIFIED_NOTICE }));
    await typeCode("123456");
    expect(callsTo("verify-code")).toHaveLength(2);
    expect(passwordInputs()).toHaveLength(2);
  });

  test("2-11 시간이 끝나면 코드 칸을 막고 안내하며, 확인을 보내지 않는다", async () => {
    await sendCodeSuccess();
    await advance(180_000);
    expect(codeInput().props.editable).toBe(false);
    expect(screen.getAllByText(EXPIRED).length).toBeGreaterThanOrEqual(1);
    await fireEvent.changeText(codeInput(), "123456");
    await flushAsync();
    expect(callsTo("verify-code")).toHaveLength(0);
  });

  test("2-12 시간이 끝난 뒤 비밀번호 바꾸기는 요청하지 않고 같은 안내", async () => {
    await verifySuccess();
    await advance(180_000);
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(callsTo("complete")).toHaveLength(0);
    expect(screen.getAllByText(EXPIRED).length).toBeGreaterThanOrEqual(1);
  });

  test("2-13 다시 받기: 코드 비움, 확인 풀림, 남은 시간 3:00부터", async () => {
    await verifySuccess();
    await advance(60_000);
    expect(timerText("2:00")).toBeOnTheScreen();
    queue("send-code", okReply({ email: EMAIL, message: SENT_NOTICE }));
    await press(RESEND);
    expect(callsTo("send-code").map((call) => call.body)).toEqual([{ email: EMAIL }, { email: EMAIL }]);
    expect(codeInput().props.value).toBe("");
    expect(passwordInputs()).toHaveLength(0);
    expect(screen.queryByText(RESET)).toBeNull();
    expect(timerText("3:00")).toBeOnTheScreen();
    await advance(1000);
    expect(timerText("2:59")).toBeOnTheScreen();
  });

  test("2-14 시간이 끝난 뒤 다시 받으면 다시 넣고 확인할 수 있다", async () => {
    await sendCodeSuccess();
    await advance(180_000);
    queue("send-code", okReply({ email: EMAIL, message: SENT_NOTICE }));
    await press(RESEND);
    expect(timerText("3:00")).toBeOnTheScreen();
    queue("verify-code", okReply({ email: EMAIL, message: VERIFIED_NOTICE }));
    await typeCode("123456");
    expect(callsTo("verify-code").map((call) => call.body)).toEqual([{ email: EMAIL, code: "123456" }]);
  });

  test("결정 2: 다시 받기가 실패하면 열린 칸과 남은 시간은 그대로 두고 오류만 보인다", async () => {
    await verifySuccess();
    await advance(60_000);
    queue("send-code", failReply({ message: "잠시 후 다시 시도해 주세요." }));
    await press(RESEND);
    expect(screen.getByText("잠시 후 다시 시도해 주세요.")).toBeOnTheScreen();
    expect(codeInputs()).toHaveLength(1);
    expect(passwordInputs()).toHaveLength(2);
    expect(screen.getByText(RESET)).toBeOnTheScreen();
    expect(timerText("2:00")).toBeOnTheScreen();
  });
});

// ---------- 3. 새 비밀번호 ----------

describe("3. 새 비밀번호", () => {
  test("3-1 두 칸 모두 가려서 입력한다", async () => {
    await verifySuccess();
    const inputs = passwordInputs();
    expect(inputs).toHaveLength(2);
    expect(inputs.every((input) => input.props.secureTextEntry === true)).toBe(true);
  });

  test.each([
    ["(가) 둘 다 비움", "", ""],
    ["(나) 새 비밀번호만", "newpass123", ""],
    ["(다) 확인만", "", "newpass123"],
    ["결정 4: 공백만", "        ", "        "]
  ])("3-2 빈 칸 %s: 요청하지 않고 두 번 입력 안내", async (_label, newPassword, confirmPassword) => {
    await verifySuccess();
    await typePasswords(newPassword, confirmPassword);
    await press(RESET);
    expect(callsTo("complete")).toHaveLength(0);
    expect(screen.getByText(MSG_PW_EMPTY)).toBeOnTheScreen();
  });

  test("3-3 8자 미만이면 요청하지 않는다", async () => {
    await verifySuccess();
    await typePasswords("pass123", "pass123");
    await press(RESET);
    expect(callsTo("complete")).toHaveLength(0);
    expect(screen.getByText(MSG_PW_SHORT)).toBeOnTheScreen();
  });

  test("3-4 8자는 통과한다", async () => {
    await verifySuccess();
    queue("complete", okReply({ email: EMAIL, message: "ok" }));
    await typePasswords("pass1234", "pass1234");
    await press(RESET);
    expect(callsTo("complete")).toHaveLength(1);
    expect(screen.queryByText(MSG_PW_SHORT)).toBeNull();
  });

  test("3-5 두 값이 다르면 요청하지 않는다", async () => {
    await verifySuccess();
    await typePasswords("newpass123", "newpass124");
    await press(RESET);
    expect(callsTo("complete")).toHaveLength(0);
    expect(screen.getByText(MSG_PW_MISMATCH)).toBeOnTheScreen();
  });

  test("결정 6: 빈 칸이 8자 미만보다 먼저, 하나만 보인다", async () => {
    await verifySuccess();
    await typePasswords("abc", "");
    await press(RESET);
    expect(screen.getByText(MSG_PW_EMPTY)).toBeOnTheScreen();
    expect(screen.queryByText(MSG_PW_SHORT)).toBeNull();
    expect(screen.queryByText(MSG_PW_MISMATCH)).toBeNull();
  });

  test("결정 6: 8자 미만이 두 값 다름보다 먼저, 하나만 보인다", async () => {
    await verifySuccess();
    await typePasswords("pass123", "different123");
    await press(RESET);
    expect(callsTo("complete")).toHaveLength(0);
    expect(screen.getByText(MSG_PW_SHORT)).toBeOnTheScreen();
    expect(screen.queryByText(MSG_PW_MISMATCH)).toBeNull();
    expect(screen.queryByText(MSG_PW_EMPTY)).toBeNull();
  });

  test("3-6 complete 본문은 email, code, newPassword", async () => {
    await verifySuccess();
    queue("complete", okReply({ email: EMAIL, message: "ok" }));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(callsTo("complete")).toEqual([
      {
        url: expect.stringMatching(/\/api\/auth\/password-reset\/complete$/),
        method: "POST",
        body: { email: EMAIL, code: "123456", newPassword: "newpass123" }
      }
    ]);
  });

  test("결정 5: complete 본문의 email도 앞뒤 공백을 뺀 값", async () => {
    await verifySuccess({}, `  ${EMAIL}  `);
    queue("complete", okReply({ email: EMAIL, message: "ok" }));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(callsTo("complete").map((call) => call.body)).toEqual([
      { email: EMAIL, code: "123456", newPassword: "newpass123" }
    ]);
  });

  test("3-7 성공(redirectTo 있음): router.replace로 /login, mode=email과 redirectTo", async () => {
    await verifySuccess({ redirectTo: "/practice/write" });
    queue("complete", okReply({ email: EMAIL, message: "ok" }));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(router.push).not.toHaveBeenCalled();
    const { path, params } = lastReplaceHref();
    expect(path).toBe("/login");
    expect(params.mode).toBe("email");
    expect(params.redirectTo).toBe("/practice/write");
  });

  test("3-8 성공(redirectTo 없음): router.replace로 /login, mode=email", async () => {
    await verifySuccess();
    queue("complete", okReply({ email: EMAIL, message: "ok" }));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(router.push).not.toHaveBeenCalled();
    const { path, params } = lastReplaceHref();
    expect(path).toBe("/login");
    expect(params.mode).toBe("email");
    expect(params.redirectTo).toBeUndefined();
  });

  test("3-9 실패(서버 문구): 문구를 보이고 이동하지 않는다", async () => {
    await verifySuccess();
    queue("complete", failReply({ message: "인증코드를 다시 받아 주세요." }));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(screen.getByText("인증코드를 다시 받아 주세요.")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  test("3-10 실패(서버 문구 없음): 기본 문구, 이동하지 않는다", async () => {
    await verifySuccess();
    queue("complete", failReply({}));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(screen.getByText(MSG_RESET_FALLBACK)).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  test("결정 1: 바꾸는 중 네트워크 실패면 3단계 기본 문구", async () => {
    await verifySuccess();
    queue("complete", networkFailReply());
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(screen.getByText(MSG_RESET_FALLBACK)).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });

  test("3-11 바꾸는 중: 버튼을 막고 진행 표시, 다시 눌러도 요청 1번", async () => {
    await verifySuccess();
    queue("complete", pendingReply(), okReply({ email: EMAIL, message: "ok" }));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    const shown = spinners();
    expect(shown).toHaveLength(1);
    expect(shown[0].parent!).toBeDisabled();
    await fireEvent.press(shown[0]);
    await flushAsync();
    expect(callsTo("complete")).toHaveLength(1);
  });
});

// ---------- 5. 바꾸지 않는 것 ----------

describe("5. 바꾸지 않는 것", () => {
  test("5-1 흐름 전체(받기·다시 받기·확인·바꾸기)에서 check-email을 부르지 않는다", async () => {
    await verifySuccess();
    queue("send-code", okReply({ email: EMAIL, message: SENT_NOTICE }));
    await press(RESEND);
    queue("verify-code", okReply({ email: EMAIL, message: VERIFIED_NOTICE }));
    await typeCode("123456");
    queue("complete", okReply({ email: EMAIL, message: "ok" }));
    await typePasswords("newpass123", "newpass123");
    await press(RESET);
    expect(allCalls().map((call) => call.url.split("/api/auth/password-reset/")[1])).toEqual([
      "send-code",
      "verify-code",
      "send-code",
      "verify-code",
      "complete"
    ]);
  });
});

// ---------- 6. 응답을 기다리는 사이 칸을 고칠 때(09 결정, 08 검증의 확실한 문제 1·2) ----------
// 두 테스트는 버그를 겨냥한 재현 테스트라 고치기 전 코드에서는 실패가 맞다.
// 고치는 방법(기다리는 동안 칸을 막거나, 응답을 버리지 않거나)과 관계없이 명세의 성공 결과만 본다.
// 칸이 막혀 있으면 changeText는 아무 일도 하지 않으므로 "고치려 해도"가 된다.

describe("6. 응답을 기다리는 사이 칸을 고칠 때", () => {
  function deferredReply() {
    let resolveReply!: (value: unknown) => void;
    const reply: FetchReply = () =>
      new Promise((resolve) => {
        resolveReply = resolve;
      });
    return {
      reply,
      resolveOk: async (body: object) => {
        await act(async () => {
          resolveReply({ ok: true, status: 200, json: async () => body });
        });
        await flushAsync();
      }
    };
  }

  test("결정 9-1: 다시 받기 응답 전에 코드 칸을 고쳐도, 성공하면 코드 비움·확인 풀림·3:00·버튼 복귀", async () => {
    await verifySuccess();
    await advance(60_000);
    expect(timerText("2:00")).toBeOnTheScreen();
    const pending = deferredReply();
    queue("send-code", pending.reply);
    await press(RESEND);
    await fireEvent.changeText(codeInput(), "12345");
    await flushAsync();
    await pending.resolveOk({ email: EMAIL, message: SENT_NOTICE });

    expect(callsTo("send-code")).toHaveLength(2);
    expect(spinners()).toHaveLength(0);
    expect(screen.getByText(RESEND)).not.toBeDisabled();
    expect(codeInput().props.value).toBe("");
    expect(passwordInputs()).toHaveLength(0);
    expect(screen.queryByText(RESET)).toBeNull();
    expect(timerText("3:00")).toBeOnTheScreen();
    await advance(1000);
    expect(timerText("2:59")).toBeOnTheScreen();
  });

  test.each([
    ["코드 칸", "code"],
    ["이메일 칸", "email"]
  ])("결정 9-2: 비밀번호 바꾸기 응답 전에 %s을 고치려 해도, 성공하면 로그인 화면으로 바꾼다", async (_label, field) => {
    await verifySuccess();
    await typePasswords("newpass123", "newpass123");
    const pending = deferredReply();
    queue("complete", pending.reply);
    await press(RESET);
    if (field === "code") {
      await fireEvent.changeText(codeInput(), "12345");
    } else {
      await fireEvent.changeText(emailInput(), "other@example.com");
    }
    await flushAsync();
    await pending.resolveOk({ email: EMAIL, message: "ok" });

    expect(callsTo("complete")).toHaveLength(1);
    expect(router.push).not.toHaveBeenCalled();
    const { path, params } = lastReplaceHref();
    expect(path).toBe("/login");
    expect(params.mode).toBe("email");
  });
});
