// [spec] qa 테스트(작업 058, 새 기능: 내 정보 화면의 개발용 3D 로비 진입 버튼).
// 기대값은 시나리오(02-qa-scenarios.md S3~S6)와 결정(03의 12: 로딩 중에도 개발 빌드면 버튼이 보인다)에서만 가져온다.
// 가짜로 두는 것: 로그인 상태(@/lib/session), API(@/lib/api), 튜토리얼 저장(@/lib/home-tutorial), 라우터(expo-router),
// 네이티브 모듈(expo-symbols). 개발·운영 빌드는 전역 __DEV__를 바꿔 흉내 낸다.
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { TestInstance } from "test-renderer";
import MeScreen from "@/app/me";
import { useSession } from "@/lib/session";
import type { AuthUser } from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
}));
jest.mock("expo-symbols", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { SymbolView: () => React.createElement("SymbolViewMock") };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/api", () => ({ deleteAccount: jest.fn(), updateProfile: jest.fn() }));
jest.mock("@/lib/home-tutorial", () => ({ requestHomeTutorialReplay: jest.fn() }));

const BUTTON_TEXT = "개발용: 3D 로비 시험";
const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

function user(): AuthUser {
  return { id: 7, email: "qa-058@example.com", displayName: "큐에이", socialProvider: null, admin: false };
}

function mockSession(currentUser: AuthUser | null, isHydrating = false) {
  jest.mocked(useSession).mockReturnValue({
    currentUser,
    isHydrating,
    refreshSession: jest.fn(async () => currentUser),
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn(async () => undefined)
  } as unknown as ReturnType<typeof useSession>);
}

function textOf(instance: TestInstance): string {
  return instance.children.map((child) => (typeof child === "string" ? child : textOf(child))).join("");
}

/** 스크롤 내용 안의 글자들을 화면 순서대로. */
function scrollTexts(): string[] {
  const scroll = screen.root!.queryAll((instance: TestInstance) => instance.type === "RCTScrollView")[0];
  expect(scroll).toBeTruthy();
  return scroll.queryAll((instance: TestInstance) => instance.type === "Text").map(textOf);
}

beforeEach(() => {
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
});

describe("[spec] 내 정보 화면의 개발용 버튼(S3~S6)", () => {
  it("S3: 개발 빌드, 로그인 안 함 → 버튼이 보이고 스크롤 내용의 맨 마지막이다", async () => {
    devGlobal.__DEV__ = true;
    mockSession(null);
    await render(<MeScreen />);

    expect(screen.getByRole("button", { name: BUTTON_TEXT })).toBeTruthy();
    const texts = scrollTexts();
    expect(texts[texts.length - 1]).toBe(BUTTON_TEXT);
  });

  it("S4: 개발 빌드, 로그인함 → 버튼이 보이고 로그아웃 등 기존 버튼보다 아래, 맨 마지막이다", async () => {
    devGlobal.__DEV__ = true;
    mockSession(user());
    await render(<MeScreen />);

    expect(screen.getByRole("button", { name: BUTTON_TEXT })).toBeTruthy();
    const texts = scrollTexts();
    expect(texts[texts.length - 1]).toBe(BUTTON_TEXT);
    expect(texts.indexOf("로그아웃")).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf("로그아웃")).toBeLessThan(texts.length - 1);
  });

  it.each([
    ["로그인 안 함", null],
    ["로그인함", user()]
  ])("S5: 운영 빌드, %s → 버튼이 없다", async (_name, currentUser) => {
    devGlobal.__DEV__ = false;
    mockSession(currentUser);
    await render(<MeScreen />);

    expect(screen.queryByText(BUTTON_TEXT)).toBeNull();
  });

  it.each([
    ["로그인 안 함", null],
    ["로그인함", user()]
  ])("S6: 개발 빌드, %s에서 버튼을 누르면 /dev/lobby-3d로 간다", async (_name, currentUser) => {
    devGlobal.__DEV__ = true;
    mockSession(currentUser);
    await render(<MeScreen />);

    await fireEvent.press(screen.getByRole("button", { name: BUTTON_TEXT }));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dev/lobby-3d");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("결정 03-12: 개발 빌드에서 로그인 상태를 불러오는 중(로딩 표시)에도 버튼이 보인다", async () => {
    devGlobal.__DEV__ = true;
    mockSession(undefined as unknown as null, true);
    await render(<MeScreen />);

    expect(screen.getByRole("button", { name: BUTTON_TEXT })).toBeTruthy();
  });

  it("결정 03-12: 운영 빌드에서는 로딩 중에도 버튼이 없다", async () => {
    devGlobal.__DEV__ = false;
    mockSession(undefined as unknown as null, true);
    await render(<MeScreen />);

    expect(screen.queryByText(BUTTON_TEXT)).toBeNull();
  });
});
