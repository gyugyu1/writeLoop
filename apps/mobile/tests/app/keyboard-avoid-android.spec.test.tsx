// [spec] qa 테스트(작업 097 안드로이드 키보드 가림, 버그 수정 1단계).
// 기대값은 명세(097의 01-main-spec.md)에서만 가져온다.
// - 재현(Android): 로그인(이메일)·비밀번호 찾기(인증코드 칸)·회원가입·소셜 가입·내 정보·지금 영어로·문의 보내기에서 입력칸을
//   고르고 Android 키보드가 올라오면, 그 칸을 감싼 화면이 키보드에 가리는 높이만큼 자리를 내줘야 한다(가려지지 않는다).
//   키보드를 내리면 화면이 원래대로 돌아와야 한다. 고치기 전에는 자리를 내주지 않아 실패해야 한다.
// - 그대로(iOS): iOS에서는 지금처럼 아래 여백(padding)으로 키보드 높이만큼(지금 영어로는 지금 쓰는 간격 12를 더해) 자리를 내주고,
//   키보드를 내리면 원래대로 돌아온다. 고치기 전에도 통과해야 한다.
//
// 기기처럼 재는 방법: 화면을 그린 뒤 입력칸의 조상 중 크기를 받는 요소(onLayout)에 화면 크기(높이 800)를 알려 주고,
// 키보드가 화면 아래 300을 덮는 이벤트(Android keyboardDidShow, iOS keyboardWillShow, 위쪽 끝 y=500)를 낸다.
// 그 뒤 입력칸의 조상들의 모양(style)이 얼마나 자리를 내줬는지(아래 여백·아래 바깥 여백·아래 위치가 늘어난 만큼, 높이가 줄어든 만큼)를 더해
// 본다. 키보드를 가리는 방법(behavior, 직접 만든 처리 등)은 단언하지 않는다. 내린 이벤트(keyboardDidHide/keyboardWillHide)는
// Android가 실제로 내는 모양(위쪽 끝 = 화면 높이, 높이 0)으로 낸다.
// 가짜로 두는 것: 라우터(expo-router), 로그인 상태(@/lib/session), API(@/lib/api의 요청 함수), 지금 영어로 저장(@/lib/now-in-english의
// 저장·요청 함수), 튜토리얼 저장, Apple 로그인, 기기 저장소, 브라우저·링크, 알림, 아이콘(expo-symbols), 안전 영역.
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
const KEYBOARD_HEIGHT = 300;
const KEYBOARD_TOP = SCREEN_HEIGHT - KEYBOARD_HEIGHT; // 500. 키보드가 화면 아래 300을 덮는다.
// iOS에서 지금 영어로 화면이 쓰는 간격(명세 "지금 쓰는 간격", now.tsx의 iOS keyboardVerticalOffset 12)
const NOW_IOS_GAP = 12;

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
  const name = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
  await act(async () => {
    DeviceEventEmitter.emit(name, keyboardEvent(KEYBOARD_TOP, KEYBOARD_HEIGHT));
  });
  await flushAsync();
}

async function hideKeyboard() {
  const name = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
  await act(async () => {
    DeviceEventEmitter.emit(name, keyboardEvent(SCREEN_HEIGHT, 0));
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
  iosGap: number;
};

const SCREENS: ScreenCase[] = [
  {
    name: "로그인(이메일 로그인 화면)의 아래쪽 비밀번호 칸",
    iosGap: 0,
    prepare: async () => {
      mockSession(null);
      setParams({ mode: "email" });
      await renderScreen(<LoginScreen />);
      return () => inputByPlaceholder("비밀번호를 입력해 주세요");
    }
  },
  {
    name: "비밀번호 찾기의 인증코드 칸",
    iosGap: 0,
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
    iosGap: 0,
    prepare: async () => {
      mockSession(null);
      setParams({});
      await renderScreen(<SignupScreen />);
      return () => inputByPlaceholder("비밀번호를 한 번 더 입력해 주세요.");
    }
  },
  {
    name: "소셜 가입의 닉네임 칸",
    iosGap: 0,
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
    iosGap: 0,
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
    iosGap: NOW_IOS_GAP,
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
    iosGap: 0,
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

describe("[spec] Android에서 키보드가 입력칸을 가리지 않는다(재현)", () => {
  it.each(SCREENS.map((item) => [item.name, item] as const))(
    "%s: 키보드가 올라오면 키보드가 덮는 높이(300)만큼 자리를 내주고, 내리면 원래대로 돌아온다",
    async (_name, item) => {
      setOS("android");
      const pickInput = await item.prepare();

      const { reserved, before, afterHide } = await openAndCloseKeyboard(pickInput);

      // 키보드가 화면 아래 300을 덮으므로, 입력칸을 감싼 화면이 적어도 300만큼 자리를 내줘야 입력칸이 키보드 위로 보인다.
      expect(reserved.total).toBeGreaterThanOrEqual(KEYBOARD_HEIGHT);
      // 키보드를 내리면 화면이 원래대로 돌아온다.
      expect(afterHide).toEqual(before);
    }
  );
});

describe("[spec] iOS 동작은 그대로다(아래 여백과 지금 쓰는 간격)", () => {
  it.each(SCREENS.map((item) => [item.name, item] as const))(
    "%s: 키보드가 올라오면 아래 여백으로만 키보드 높이(+지금 쓰는 간격)만큼 자리를 내주고, 내리면 원래대로 돌아온다",
    async (_name, item) => {
      setOS("ios");
      const pickInput = await item.prepare();

      const { reserved, before, afterHide } = await openAndCloseKeyboard(pickInput);

      expect(reserved).toEqual({
        padding: KEYBOARD_HEIGHT + item.iosGap,
        margin: 0,
        bottom: 0,
        height: 0,
        total: KEYBOARD_HEIGHT + item.iosGap
      });
      expect(afterHide).toEqual(before);
    }
  );
});
