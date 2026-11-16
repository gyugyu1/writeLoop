// [spec] qa 테스트(작업 097 안드로이드 키보드 가림, 결정 08에 따라 구현 뒤 더한 테스트).
// 기대값은 명세(097의 01-main-spec.md "키보드를 내리면 화면이 원래대로 돌아온다")와 결정(08-main-decision.md)의 기기 측정값에서만 가져온다.
// - 결정 08: Android 폰에서 찍은 실제 키보드 이벤트는 창·화면 높이 800(dp)에서 올릴 때 keyboardDidShow { screenY 458, height 294 },
//   내릴 때 keyboardDidHide { screenY 725.33, height 0 }이다. 이 값으로 명세의 화면 7곳(keyboard-avoid-android.spec.test.tsx의
//   A1~A7과 같은 칸)에서 키보드를 올렸다 내렸을 때, 내린 뒤 모양이 키보드 전과 같아야 한다. 구현 a23400d에서는 틈이 남아 실패가 맞다.
// - 키보드를 올렸을 때 칸이 키보드 위로 보이는 것(명세 "고친 뒤 기대" 1)은 이 측정값으로도 먼저 확인한다: 키보드 위쪽 끝(458)부터
//   화면 끝(800)까지 덮이므로 적어도 342만큼 자리를 내줘야 한다. 이 단언이 있어야 아무 일도 하지 않는 화면이 "내린 뒤 같다"로 통과하지 않는다.
//
// 재는 방법과 가짜로 두는 것은 keyboard-avoid-android.spec.test.tsx와 같다(키보드 이벤트 값만 기기 측정값으로 바꿨다).
// 화면을 그린 뒤 입력칸의 조상 중 크기를 받는 요소(onLayout)에 크기를 알리고, 입력칸을 고른 뒤 키보드 이벤트를 내고, 모양이 바뀌면 기기처럼
// 크기를 다시 알린다. 키보드를 피하는 방법(behavior 등)은 단언하지 않는다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import type { ReactElement } from "react";
import { DeviceEventEmitter, Platform, StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";
import ForgotPasswordScreen from "@/app/forgot-password";
import LoginScreen from "@/app/login";
import MeScreen from "@/app/me";
import NowInEnglishScreen from "@/app/now";
import SignupScreen from "@/app/signup";
import SocialSignupScreen from "@/app/social-signup";
import SupportFeedbackScreen from "@/app/support-feedback";
import {
  getPendingSocialRegistration,
  getSavedExpressions,
  sendPasswordResetCode
} from "@/lib/api";
import { getNowInEnglishAiReflection, getNowInEnglishSummary } from "@/lib/now-in-english";
import { useSession } from "@/lib/session";
import type { AuthUser } from "@/lib/types";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true),
    canDismiss: jest.fn(() => false),
    dismissAll: jest.fn()
  },
  useLocalSearchParams: jest.fn()
}));
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(false)),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 0, SIGN_IN: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1 }
}));
jest.mock("expo-symbols", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { SymbolView: (props: object) => React.createElement("ExpoSymbolView", props) };
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
jest.mock("expo-linking", () => ({ createURL: jest.fn((path: string) => `writeloop://${path}`) }));
jest.mock("expo-notifications", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/home-tutorial", () => ({ requestHomeTutorialReplay: jest.fn() }));
jest.mock("@/lib/api", () => ({
  ...jest.requireActual<typeof import("@/lib/api")>("@/lib/api"),
  sendPasswordResetCode: jest.fn(),
  verifyPasswordResetCode: jest.fn(),
  resetPassword: jest.fn(),
  sendRegistrationCode: jest.fn(),
  completeRegistration: jest.fn(),
  getPendingSocialRegistration: jest.fn(),
  completeSocialRegistration: jest.fn(),
  submitUserFeedback: jest.fn(),
  deleteAccount: jest.fn(),
  updateProfile: jest.fn(),
  deleteSavedExpression: jest.fn(),
  getSavedExpressions: jest.fn(),
  requestCoachHelp: jest.fn(),
  requestNowInEnglishCoachFeedback: jest.fn(),
  requestNowInEnglishReflection: jest.fn(),
  saveExpression: jest.fn()
}));
jest.mock("@/lib/now-in-english", () => ({
  ...jest.requireActual<typeof import("@/lib/now-in-english")>("@/lib/now-in-english"),
  disableNowInEnglishReminders: jest.fn(),
  enableNowInEnglishReminders: jest.fn(),
  getNowInEnglishAiReflection: jest.fn(),
  getNowInEnglishSummary: jest.fn(),
  saveNowInEnglishAiReflection: jest.fn(),
  saveNowInEnglishEntry: jest.fn(),
  updateNowInEnglishQuietHours: jest.fn(),
  updateNowInEnglishScheduleMode: jest.fn()
}));

// ---------- 화면과 키보드 크기 ----------

const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 800;
// 결정 08의 기기 측정값(Android, dp)
const SHOW_SCREEN_Y = 458;
const SHOW_HEIGHT = 294;
const HIDE_SCREEN_Y = 725.33;
const HIDE_HEIGHT = 0;
// 올렸을 때 키보드가 덮는 화면 높이: 위쪽 끝(458)부터 화면 끝(800)까지
const COVERED_ON_SHOW = SCREEN_HEIGHT - SHOW_SCREEN_Y; // 342

const EMAIL = "qa-097@example.com";

const emailUser: AuthUser = { id: 97, email: EMAIL, displayName: "큐에이", socialProvider: null, admin: false };

const originalOS = Platform.OS;

function setOS(os: "android" | "ios") {
  (Platform as { OS: string }).OS = os;
}

function mockSession(currentUser: AuthUser | null) {
  jest.mocked(useSession).mockReturnValue({
    currentUser,
    isHydrating: false,
    refreshSession: jest.fn(async () => currentUser),
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn(async () => undefined)
  } as unknown as ReturnType<typeof useSession>);
}

function setParams(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderScreen(element: ReactElement) {
  await render(element);
  await flushAsync();
}

function textInputs(): TestInstance[] {
  return screen.root!.queryAll((instance) => instance.type === "TextInput");
}

function inputByPlaceholder(placeholder: string) {
  const found = textInputs().filter((input) => input.props.placeholder === placeholder);
  expect(found).toHaveLength(1);
  return found[0];
}

function ancestorsOf(node: TestInstance): TestInstance[] {
  const chain: TestInstance[] = [];
  let current = node.parent;
  while (current) {
    chain.push(current);
    current = current.parent;
  }
  return chain;
}

// 입력칸의 조상 중 크기를 받는 요소에 크기를 알린다. 기기는 처음 그린 뒤와 모양(높이)이 바뀐 뒤에 크기를 다시 알린다.
// 높이를 정한 요소는 그 높이, 아니면 화면 높이(800)를 알린다.
async function layoutAncestors(pickInput: () => TestInstance) {
  const count = ancestorsOf(pickInput()).length;
  for (let index = 0; index < count; index += 1) {
    const ancestor = ancestorsOf(pickInput())[index];
    const onLayout = ancestor?.props.onLayout;
    if (typeof onLayout === "function") {
      const style = (StyleSheet.flatten(ancestor.props.style) ?? {}) as Flat;
      const height = num(style.height) ?? SCREEN_HEIGHT;
      await act(async () => {
        await onLayout({
          nativeEvent: { layout: { x: 0, y: 0, width: SCREEN_WIDTH, height } },
          persist: () => undefined
        });
      });
    }
  }
  await flushAsync();
}

function keyboardEvent(screenY: number, height: number) {
  return {
    duration: 0,
    easing: "keyboard",
    isEventFromThisApp: true,
    startCoordinates: { screenX: 0, screenY: SCREEN_HEIGHT, width: SCREEN_WIDTH, height: 0 },
    endCoordinates: { screenX: 0, screenY, width: SCREEN_WIDTH, height }
  };
}

async function showKeyboard() {
  await act(async () => {
    DeviceEventEmitter.emit("keyboardDidShow", keyboardEvent(SHOW_SCREEN_Y, SHOW_HEIGHT));
  });
  await flushAsync();
}

async function hideKeyboard() {
  await act(async () => {
    DeviceEventEmitter.emit("keyboardDidHide", keyboardEvent(HIDE_SCREEN_Y, HIDE_HEIGHT));
  });
  await flushAsync();
}

type Flat = Record<string, unknown>;

function flatStyles(input: TestInstance): Flat[] {
  return ancestorsOf(input).map((ancestor) => (StyleSheet.flatten(ancestor.props.style) ?? {}) as Flat);
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function bottomPadding(style: Flat) {
  return num(style.paddingBottom) ?? num(style.paddingVertical) ?? num(style.padding) ?? 0;
}
function bottomMargin(style: Flat) {
  return num(style.marginBottom) ?? num(style.marginVertical) ?? num(style.margin) ?? 0;
}

type Reserved = { padding: number; margin: number; bottom: number; height: number; total: number };

// 키보드 전과 뒤 조상 모양을 비교해 키보드에 내준 자리를 잰다.
function reservedSpace(before: Flat[], after: Flat[]): Reserved {
  expect(after).toHaveLength(before.length);
  const reserved = { padding: 0, margin: 0, bottom: 0, height: 0, total: 0 };
  before.forEach((was, index) => {
    const now = after[index];
    reserved.padding += bottomPadding(now) - bottomPadding(was);
    reserved.margin += bottomMargin(now) - bottomMargin(was);
    reserved.bottom += (num(now.bottom) ?? 0) - (num(was.bottom) ?? 0);
    const nowHeight = num(now.height);
    const wasHeight = num(was.height) ?? SCREEN_HEIGHT;
    if (nowHeight !== undefined) {
      reserved.height += wasHeight - nowHeight;
    }
  });
  reserved.total = reserved.padding + reserved.margin + reserved.bottom + reserved.height;
  return reserved;
}

type Measured = { reserved: Reserved; before: Flat[]; afterHide: Flat[] };

// 입력칸을 고르고(focus) 키보드를 올렸다가 내린다.
async function openAndCloseKeyboard(pickInput: () => TestInstance): Promise<Measured> {
  await layoutAncestors(pickInput);
  const before = flatStyles(pickInput());

  await fireEvent(pickInput(), "focus");
  await showKeyboard();
  await layoutAncestors(pickInput);
  const shown = flatStyles(pickInput());
  const reserved = reservedSpace(before, shown);

  await fireEvent(pickInput(), "blur");
  await hideKeyboard();
  await layoutAncestors(pickInput);
  const afterHide = flatStyles(pickInput());
  return { reserved, before, afterHide };
}

// ---------- 화면별 준비 ----------

type ScreenCase = {
  name: string;
  // 렌더하고 입력칸이 보이게 한 뒤, 고를 입력칸을 찾는 함수를 돌려준다.
  prepare: () => Promise<() => TestInstance>;
};

const SCREENS: ScreenCase[] = [
  {
    name: "로그인(이메일 로그인 화면)의 아래쪽 비밀번호 칸",
    prepare: async () => {
      mockSession(null);
      setParams({ mode: "email" });
      await renderScreen(<LoginScreen />);
      return () => inputByPlaceholder("비밀번호를 입력해 주세요");
    }
  },
  {
    name: "비밀번호 찾기의 인증코드 칸",
    prepare: async () => {
      setParams({ email: EMAIL });
      jest.mocked(sendPasswordResetCode).mockResolvedValue(undefined as never);
      await renderScreen(<ForgotPasswordScreen />);
      await fireEvent.press(screen.getByText("인증코드 받기"));
      await flushAsync();
      return () => {
        const found = textInputs().filter(
          (input) => input.props.keyboardType !== "email-address" && !input.props.secureTextEntry
        );
        expect(found).toHaveLength(1);
        return found[0];
      };
    }
  },
  {
    name: "회원가입의 아래쪽 비밀번호 확인 칸",
    prepare: async () => {
      mockSession(null);
      setParams({});
      await renderScreen(<SignupScreen />);
      return () => inputByPlaceholder("비밀번호를 한 번 더 입력해 주세요.");
    }
  },
  {
    name: "소셜 가입의 닉네임 칸",
    prepare: async () => {
      mockSession(null);
      setParams({ token: "qa-097-token", provider: "google" });
      jest
        .mocked(getPendingSocialRegistration)
        .mockResolvedValue({ provider: "google", suggestedDisplayName: "큐에이" } as never);
      await renderScreen(<SocialSignupScreen />);
      return () => inputByPlaceholder("앱에서 사용할 닉네임을 입력해 주세요.");
    }
  },
  {
    name: "내 정보의 입력칸(맨 아래 칸)",
    prepare: async () => {
      mockSession(emailUser);
      await renderScreen(<MeScreen />);
      return () => {
        const inputs = textInputs();
        expect(inputs.length).toBeGreaterThan(0);
        return inputs[inputs.length - 1];
      };
    }
  },
  {
    name: "지금 영어로의 쓰기 칸",
    prepare: async () => {
      mockSession(emailUser);
      setParams({});
      jest.mocked(getNowInEnglishSummary).mockResolvedValue({
        entries: [],
        todayEntries: [],
        todayCount: 0,
        settings: {
          enabled: false,
          intervalHours: 2,
          scheduleMode: "HOURLY_ANCHOR",
          notificationIds: [],
          scheduledReminderAts: [],
          quietHours: { enabled: true, startHour: 23, endHour: 8 },
          updatedAt: "2026-11-01T00:00:00.000Z"
        }
      } as never);
      jest.mocked(getNowInEnglishAiReflection).mockResolvedValue(null as never);
      jest.mocked(getSavedExpressions).mockResolvedValue([] as never);
      await renderScreen(<NowInEnglishScreen />);
      return () => inputByPlaceholder("I’m doing something small right now.");
    }
  },
  {
    name: "문의 보내기의 글 칸",
    prepare: async () => {
      setParams({ source: "qa_097" });
      await renderScreen(<SupportFeedbackScreen />);
      return () => {
        const found = textInputs().filter((input) => input.props.accessibilityLabel === "의견 내용");
        expect(found).toHaveLength(1);
        return found[0];
      };
    }
  }
];

beforeEach(() => {
  mockSession(null);
  setParams({});
});

afterEach(() => {
  setOS(originalOS as "android" | "ios");
});

describe("[spec] Android 기기 측정값으로 키보드를 내리면 화면이 키보드 전과 같다(결정 08)", () => {
  it.each(SCREENS.map((item) => [item.name, item] as const))(
    "%s: 올리면(screenY 458) 적어도 342만큼 자리를 내주고, 내리면(screenY 725.33, height 0) 모양이 키보드 전과 같다",
    async (_name, item) => {
      setOS("android");
      const pickInput = await item.prepare();

      const { reserved, before, afterHide } = await openAndCloseKeyboard(pickInput);

      expect(reserved.total).toBeGreaterThanOrEqual(COVERED_ON_SHOW);
      expect(afterHide).toEqual(before);
    }
  );
});
