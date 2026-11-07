// [spec] qa 테스트(작업 060-03, 새 기능: 학습 가이드를 홈에서 내정보 "도움말과 의견" 칸의 "학습 가이드" 줄로 옮김).
// 기대값은 시나리오(060-03의 02-qa-scenarios.md S24)에서만 가져온다. "내용은 그대로"는 옛 홈 테스트가 적어 둔 문구와,
// 로비 전 학습 가이드 모달의 구조 기록(__fixtures__/home-guide-before-lobby.snap.txt, 커밋 d6aabd0에서 떼어 옴)과 같은지로 본다.
// 가짜로 두는 것: 로그인 상태(@/lib/session), API(@/lib/api), 튜토리얼 저장(@/lib/home-tutorial), 라우터(expo-router),
// 네이티브 모듈(expo-symbols). me-dev-lobby-entry.spec.test.tsx와 같다.
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { format, plugins } from "pretty-format";
import { StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";
import MeScreen from "@/app/me";
import { useSession } from "@/lib/session";
import type { AuthUser } from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
}));
// 옛 홈 기록과 같은 모양으로 비교하려고, 아이콘은 받은 속성을 가진 호스트 요소로 둔다(옛 홈 테스트와 같음).
jest.mock("expo-symbols", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { SymbolView: (props: object) => React.createElement("ExpoSymbolView", props) };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/api", () => ({ deleteAccount: jest.fn(), updateProfile: jest.fn() }));
jest.mock("@/lib/home-tutorial", () => ({ requestHomeTutorialReplay: jest.fn() }));

const GUIDE_TITLE = "바로 보는 학습 가이드";

function user(): AuthUser {
  return { id: 7, email: "qa-060@example.com", displayName: "큐에이", socialProvider: null, admin: false };
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

function guideModals() {
  return screen.root!.queryAll(
    (instance: TestInstance) => instance.type === "Modal" && within(instance).queryAllByText(GUIDE_TITLE).length > 0
  );
}

function guideModal() {
  const modals = guideModals();
  expect(modals).toHaveLength(1);
  return modals[0];
}

function helpCard() {
  // "도움말과 의견" 제목이 든 칸
  return screen.getByText("도움말과 의견").parent!;
}

// 옛 홈 테스트(index.spec.test.tsx)의 화면 구조 기록용 도우미와 같다.
const STRUCTURE_PROPS = new Set([
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
  "accessibilityViewIsModal",
  "accessible",
  "animationType",
  "collapsable",
  "color",
  "contentContainerStyle",
  "href",
  "name",
  "pointerEvents",
  "removeClippedSubviews",
  "scrollEventThrottle",
  "showsVerticalScrollIndicator",
  "size",
  "source",
  "style",
  "tintColor",
  "transparent",
  "visible",
  "weight"
]);
const TEST_JSON = Symbol.for("react.test.json");

type StructureNode = {
  $$typeof: symbol;
  type: string;
  props: Record<string, unknown>;
  children: (StructureNode | string)[] | null;
};

function structureOf(node: TestInstance): StructureNode {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (value === undefined || typeof value === "function") {
      continue;
    }
    if (STRUCTURE_PROPS.has(key)) {
      props[key] = key.endsWith("tyle") ? StyleSheet.flatten(value) : value;
    }
  }
  const children = node.children.map((child) => (typeof child === "string" ? child : structureOf(child)));
  return { $$typeof: TEST_JSON, type: node.type, props, children: children.length > 0 ? children : null };
}

function beforeLobbyGuide() {
  const text = readFileSync(join(__dirname, "__fixtures__", "home-guide-before-lobby.snap.txt"), "utf8");
  const match = /exports\[`\[spec\] 화면 구조 \[spec\] 학습 가이드 모달 1`\] = `\n([\s\S]*?)\n`;\n/.exec(text);
  expect(match).not.toBeNull();
  return match![1].replace(/\\(`|\\|\$\{)/g, "$1");
}

beforeEach(() => {
  mockSession(user());
});

describe("[spec] 내정보의 학습 가이드(S24)", () => {
  it("S24: '도움말과 의견' 칸에 '학습 가이드'가 있고, 같은 칸의 홈 사용법 다시 보기·의견·문제 보내기는 그대로 있다", async () => {
    await render(<MeScreen />);

    const card = helpCard();
    expect(within(card).getByRole("button", { name: "학습 가이드" })).toBeOnTheScreen();
    expect(within(card).getByText("홈 사용법 다시 보기")).toBeOnTheScreen();
    expect(within(card).getByText("의견·문제 보내기")).toBeOnTheScreen();
    expect(guideModals()).toHaveLength(0);
  });

  it("S24: 학습 가이드를 누르면 옛 홈의 학습 가이드와 같은 내용이 열리고, 닫기와 뒤로가기로 닫힌다", async () => {
    await render(<MeScreen />);

    await fireEvent.press(within(helpCard()).getByRole("button", { name: "학습 가이드" }));

    const modal = guideModal();
    expect(within(modal).getByText(GUIDE_TITLE)).toBeOnTheScreen();
    expect(within(modal).getByText("질문 선택, 코치 도움, 피드백까지 한 흐름으로 이어집니다.")).toBeOnTheScreen();
    const steps: [string, string, string][] = [
      ["1", "난이도 고르기", "지금 컨디션에 맞는 난이도를 하나 고르면 오늘 질문 세트가 바로 열려요."],
      ["2", "질문 하나 선택하기", "마음에 드는 질문을 고른 뒤 2~4문장 정도로 가볍게 먼저 써 보세요."],
      ["3", "AI 코치 활용하기", "표현이 막히면 작문칸 안의 마스코트를 눌러 코치에게 첫 문장이나 표현을 물어볼 수 있어요."],
      ["4", "피드백으로 다시 쓰기", "피드백에서 잘한 점과 다음 루프 제안을 보고 한 번 더 다듬으면 실력이 훨씬 빨리 붙어요."]
    ];
    for (const [index, title, body] of steps) {
      expect(within(modal).getByText(index)).toBeOnTheScreen();
      expect(within(modal).getByText(title)).toBeOnTheScreen();
      expect(within(modal).getByText(body)).toBeOnTheScreen();
    }
    expect(within(modal).getByText("작게 시작하는 게 가장 좋아요.")).toBeOnTheScreen();
    expect(
      within(modal).getByText(
        "완벽하게 길게 쓰려고 하기보다, 짧게 먼저 쓰고 AI 코치와 피드백으로 한 번 더 다듬는 방식이 가장 안정적으로 늘어요."
      )
    ).toBeOnTheScreen();
    expect(modal.props.animationType).toBe("slide");

    await fireEvent.press(within(modal).getByText("닫기"));
    expect(guideModals()).toHaveLength(0);

    await fireEvent.press(within(helpCard()).getByRole("button", { name: "학습 가이드" }));
    await fireEvent(guideModal(), "requestClose");
    expect(guideModals()).toHaveLength(0);
  });

  it("S24: 학습 가이드 창의 구조는 로비 전 홈의 학습 가이드 모달 기록과 같다", async () => {
    await render(<MeScreen />);
    await fireEvent.press(within(helpCard()).getByRole("button", { name: "학습 가이드" }));

    const serialized = format(structureOf(guideModal()), {
      escapeRegex: true,
      escapeString: false,
      indent: 2,
      plugins: [plugins.ReactTestComponent, plugins.ReactElement],
      printBasicPrototype: false,
      printFunctionName: false
    });

    expect(serialized).toBe(beforeLobbyGuide());
  });
});
