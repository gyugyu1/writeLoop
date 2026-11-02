// [spec] qa 테스트(작업 052 문장 교정 미션 정답 가리기, 기능 변경).
// 문장 교정 미션(coachMove.focusType LANGUAGE_FIX)의 모바일 피드백 화면(src/app/practice/feedback.tsx)에서
// 교정 줄의 고친 표현은 줄마다 "고친 표현 보기"를, 고친 문장 전체는 "고친 문장 전체 보기"를 눌러야 보이게 바꾸는 명세를 확인한다.
// "바뀔 동작" 테스트는 고치기 전 코드에서 실패하고, "그대로 둘 동작" 테스트는 통과해야 한다.
// 기록 상세(HistorySessionDetailModal)는 그대로 다 보여야 한다. 쓰기 화면의 이전 피드백 창은 03-main-decision.md 1번(사용자 결정)대로
// 가리며, write-language-fix-reveal.spec.test.tsx에서 본다. 다시쓰기 칸의 자리 표시 문구는 같은 결정 2번대로 본다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(expo-secure-store, @/lib/writing-drafts, 저장된 피드백 상태 불러오기,
// 게스트 아이디), 로그인 상태(@/lib/session), 라우터·내비게이션, 네이티브 모듈(expo-symbols, expo-crypto).
// "보인다"는 Testing Library의 기본 질의(접근성에서 숨긴 요소와 display:none은 찾지 않는다)로 본다.
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Keyboard, ScrollView } from "react-native";
import type { TestInstance } from "test-renderer";
import PracticeFeedbackScreen from "@/app/practice/feedback";
import { HistorySessionDetailModal } from "@/components/records/records-detail-modal";
import { completeFeedbackSession, getSavedExpressions, submitFeedback } from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import {
  clearPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  Feedback,
  FeedbackCoachMove,
  FeedbackLanguageCorrection,
  HistorySession,
  Prompt,
  VisibleFeedbackSnapshot
} from "@/lib/types";
import { deleteLocalWritingDraft, getLocalWritingDraft, saveLocalWritingDraft } from "@/lib/writing-drafts";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));
jest.mock("expo-symbols", () => {
  const React = jest.requireActual("react");
  return {
    SymbolView: (props: object) => React.createElement("ExpoSymbolView", props)
  };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
// 기록 상세 창이 부르는 기록 도우미가 @/lib/now-in-english(기기 저장소·알림)를 불러온다. 기록 화면 테스트와 같은 가짜를 쓴다.
jest.mock("expo-notifications", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/api", () => {
  class ApiError extends Error {
    code?: string;
    status: number;

    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }
  return {
    ApiError,
    completeFeedbackSession: jest.fn(),
    deleteSavedExpression: jest.fn(),
    getSavedExpressions: jest.fn(),
    saveExpression: jest.fn(),
    submitFeedback: jest.fn()
  };
});
jest.mock("@/lib/guest-id", () => ({ getOrCreateGuestId: jest.fn() }));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/writing-drafts", () => ({
  deleteLocalWritingDraft: jest.fn(),
  getLocalWritingDraft: jest.fn(),
  saveLocalWritingDraft: jest.fn()
}));
jest.mock("@/lib/practice-feedback-state", () => ({
  ...jest.requireActual("@/lib/practice-feedback-state"),
  hydratePracticeFeedbackState: jest.fn()
}));

// ---------- 고정 데이터 ----------

const prompt: Prompt = {
  id: "prompt-052",
  topic: "School",
  topicCategory: "ROUTINE",
  topicDetail: "Yesterday",
  difficulty: "A",
  questionEn: "What did you do yesterday?",
  questionKo: "어제 무엇을 했나요?",
  tip: ""
};

const prompt2: Prompt = { ...prompt, id: "prompt-052-b", questionEn: "What will you do this weekend?" };

const signedInUser: AuthUser = { id: 52, email: "language-fix@example.com", displayName: "학습자", admin: false };

// 명세의 문구.
const REVEAL_ROW = /고친 표현 보기/;
const REVEAL_SENTENCE = /고친 문장 전체 보기/;
const NEW_INSTRUCTION = "이유를 보고 표시된 곳을 직접 고쳐 보세요. 막히면 고친 표현을 눌러 확인해요.";
// 서버가 문장 교정 미션에 보내는 안내(CanonicalFeedbackAssembler). 서버는 그대로 보낸다.
const SERVER_INSTRUCTION = "위 교정들을 반영해 문장 전체를 다시 써 보세요.";
const SUBMIT_LABEL = "다시 피드백 받아보기";
// 다시쓰기 칸의 일반 안내(지금 화면에 있는 기본 자리 표시 문구).
const DEFAULT_PLACEHOLDER = "코치 포인트를 반영해서 다시 써보세요.";

const ORIGINAL_SENTENCE = "I go to school yesterday.";
const REVISED_SENTENCE = "I went to school yesterday.";

type Row = FeedbackLanguageCorrection & { after: string };

// 교정 6줄. 넷째 줄은 고치기 전 표현이 없고 고친 표현만 있다. 모든 줄에 고친 표현이 있다.
// 고친 표현(after)은 화면의 다른 글자(고치기 전 표현, 이유, 원래 문장)에 들어 있지 않은 글자로 골랐다.
const CORRECTIONS: Row[] = [
  { kind: "GRAMMAR_BLOCKING", label: "핵심 교정", before: "I go", after: "I went", reason: "어제 일이라 과거형을 써요." },
  {
    kind: "STRUCTURE",
    label: "문장 구조",
    before: "Because tired.",
    after: "Because I was tired.",
    reason: "주어와 동사가 있어야 해요."
  },
  { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: "a apple", after: "an apple", reason: "모음 앞에는 an을 써요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: null, after: "the morning", reason: "정해진 때라 the를 붙여요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: "very like", after: "really like", reason: "like 앞에는 really를 써요." },
  {
    kind: "GRAMMAR_BLOCKING",
    label: "핵심 교정",
    before: "he go",
    after: "he goes",
    reason: "3인칭 단수 주어에는 -s를 붙여요."
  }
];

function languageFixMove(overrides: Partial<FeedbackCoachMove> = {}): FeedbackCoachMove {
  return {
    focus: "문장 6곳 바로잡기",
    focusType: "LANGUAGE_FIX",
    why: "어제 한 일은 과거형으로 써야 자연스러워요.",
    before: ORIGINAL_SENTENCE,
    after: REVISED_SENTENCE,
    instruction: SERVER_INSTRUCTION,
    languageCorrections: CORRECTIONS,
    ...overrides
  };
}

function makeFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    promptId: prompt.id,
    sessionId: "session-052",
    attemptNo: 1,
    loopComplete: false,
    completionMessage: null,
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: REVISED_SENTENCE,
    modelAnswer: "",
    rewriteChallenge: "",
    ...overrides
  };
}

function coachFeedback(
  coachMove: FeedbackCoachMove,
  overrides: Partial<Feedback> = {},
  visibleOverrides: Partial<VisibleFeedbackSnapshot> = {}
): Feedback {
  return makeFeedback({
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "하고 싶은 말을 끝까지 썼어요.",
      coachMove,
      ...visibleOverrides
    },
    ...overrides
  });
}

function makeState(feedback: Feedback, overrides: Partial<PracticeFeedbackState> = {}): PracticeFeedbackState {
  return { difficulty: "A", prompt, answer: ORIGINAL_SENTENCE, feedback, ...overrides };
}

// ---------- 도우미 ----------

const navigation = { canGoBack: jest.fn(), goBack: jest.fn() };
const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let keyboardDismissSpy: jest.SpyInstance;

function setParams(params: { difficulty?: string; promptId?: string }) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
}

async function renderScreen(state: PracticeFeedbackState) {
  savePracticeFeedbackState(state);
  await render(<PracticeFeedbackScreen />);
}

// 교정 한 줄의 칸: 이유 글자에서 위로 올라가며 배지 이름(과 고치기 전 표현)을 함께 담은 가장 가까운 요소.
function correctionRow(correction: Row): TestInstance {
  let node: TestInstance | null = screen.getByText(correction.reason);
  while (node) {
    const hasLabel = within(node).queryAllByText(correction.label, { exact: false }).length > 0;
    const hasBefore = !correction.before || within(node).queryAllByText(correction.before, { exact: false }).length > 0;
    if (hasLabel && hasBefore) {
      return node;
    }
    node = node.parent;
  }
  throw new Error(`교정 줄을 찾지 못함: ${correction.reason}`);
}

function revealButtonOf(correction: Row) {
  return within(correctionRow(correction)).getByRole("button", { name: REVEAL_ROW });
}

// 요소 안의 글자를 모두 모은다(접근성 이름 비교용).
function textOf(node: TestInstance | string): string {
  if (typeof node === "string") {
    return node;
  }
  return node.children.map(textOf).join("");
}

function accessibleNameOf(button: TestInstance) {
  const label = button.props.accessibilityLabel ?? button.props["aria-label"];
  return typeof label === "string" ? label : textOf(button);
}

// 가려진 교정 줄: 배지, 고치기 전 표현(있으면), 화살표, 이유는 보이고 고친 표현은 보이지 않으며, 그 줄에 "고친 표현 보기" 버튼이 하나 있다.
function expectRowHidden(correction: Row) {
  const row = correctionRow(correction);
  expect(within(row).getAllByText(correction.label, { exact: false }).length).toBeGreaterThan(0);
  if (correction.before) {
    expect(within(row).getAllByText(correction.before, { exact: false }).length).toBeGreaterThan(0);
  }
  expect(within(row).getAllByText("→", { exact: false }).length).toBeGreaterThan(0);
  expect(within(row).getByText(correction.reason)).toBeOnTheScreen();
  expect(within(row).queryAllByText(correction.after, { exact: false })).toHaveLength(0);
  expect(within(row).getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(1);
}

function expectRowRevealed(correction: Row) {
  const row = correctionRow(correction);
  expect(within(row).getAllByText(correction.after, { exact: false }).length).toBeGreaterThan(0);
  expect(within(row).getByText(correction.reason)).toBeOnTheScreen();
}

// "지금" 줄(내 원래 답, 바뀔 곳 go 강조)은 처음부터 보인다(지금 동작).
function expectOriginalRowShown() {
  expect(screen.getByText("지금")).toBeOnTheScreen();
  expect(screen.getByText(ORIGINAL_SENTENCE)).toBeOnTheScreen();
  expect(screen.getByText("go")).toHaveStyle({ backgroundColor: "#F8CFC7", color: "#8F2F23", fontWeight: "900" });
}

// 고친 문장 전체가 가려져 있다: 고친 문장이 화면에 없고 "고친 문장 전체 보기" 버튼이 하나 있다.
function expectSentenceHidden() {
  expect(screen.queryByText(REVISED_SENTENCE)).toBeNull();
  expect(screen.queryByText("went")).toBeNull();
  expect(screen.getAllByRole("button", { name: REVEAL_SENTENCE })).toHaveLength(1);
  expectOriginalRowShown();
}

// 고친 문장(바뀐 곳 강조)이 지금처럼 보인다: "이번에 고친 문장" 줄에 고친 문장이 있고 바뀐 낱말 went가 강조된다.
function expectSentenceRevealed() {
  expect(screen.getByText("이번에 고친 문장")).toBeOnTheScreen();
  expect(screen.getByText(REVISED_SENTENCE)).toBeOnTheScreen();
  expect(screen.getByText("went")).toHaveStyle({ backgroundColor: "#BDEAC7", color: "#145F2A", fontWeight: "900" });
}

beforeEach(() => {
  clearPracticeFeedbackState();
  setParams({ difficulty: "A", promptId: prompt.id });
  navigation.canGoBack.mockReset().mockReturnValue(true);
  navigation.goBack.mockReset();
  jest.mocked(useNavigation).mockReset().mockReturnValue(navigation as unknown as ReturnType<typeof useNavigation>);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(randomUUID).mockReset().mockReturnValueOnce("uuid-1").mockReturnValueOnce("uuid-2").mockReturnValue("uuid-n");
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(submitFeedback).mockReset();
  jest.mocked(completeFeedbackSession).mockReset();
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue("guest-052");
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);
  jest.mocked(getLocalWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(ScrollView.prototype.scrollTo).mockClear();
  refreshSession.mockReset().mockResolvedValue(null);
  jest.mocked(useSession).mockReturnValue({
    currentUser: signedInUser,
    isHydrating: false,
    refreshSession,
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  keyboardDismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  keyboardDismissSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 바뀔 동작 ----------

describe("[spec] 문장 교정 미션 정답 가리기(모바일 피드백 화면): 바뀔 동작", () => {
  it("[spec] 처음에는 교정 줄의 배지·고치기 전 표현·화살표·이유만 보이고 고친 표현은 가려지며, 보이는 네 줄마다 '고친 표현 보기' 버튼(접근성 역할 button, 줄마다 다른 이름)이 하나씩 있다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));

    CORRECTIONS.slice(0, 4).forEach(expectRowHidden);
    // 처음 네 줄만 보이는 지금 동작은 그대로다.
    expect(screen.queryByText(CORRECTIONS[4].reason)).toBeNull();
    expect(screen.queryByText(CORRECTIONS[5].reason)).toBeNull();
    const buttons = screen.getAllByRole("button", { name: REVEAL_ROW });
    expect(buttons).toHaveLength(4);
    // 어느 줄의 버튼인지 알 수 있게 접근성 이름이 줄마다 다르다.
    expect(new Set(buttons.map(accessibleNameOf)).size).toBe(4);
    CORRECTIONS.forEach((correction) => expect(screen.queryAllByText(correction.after, { exact: false })).toHaveLength(0));
  });

  it("[spec] 한 줄의 '고친 표현 보기'를 누르면 그 줄의 고친 표현만 보이고 다른 줄은 그대로 가려져 있다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));

    await fireEvent.press(revealButtonOf(CORRECTIONS[1]));
    expectRowRevealed(CORRECTIONS[1]);
    [CORRECTIONS[0], CORRECTIONS[2], CORRECTIONS[3]].forEach(expectRowHidden);
    expect(screen.queryByText(REVISED_SENTENCE)).toBeNull();

    await fireEvent.press(revealButtonOf(CORRECTIONS[3]));
    expectRowRevealed(CORRECTIONS[1]);
    expectRowRevealed(CORRECTIONS[3]);
    [CORRECTIONS[0], CORRECTIONS[2]].forEach(expectRowHidden);
  });

  it("[spec] 고치기 전 표현이 없고 고친 표현만 있는 줄도 고친 표현이 가려지고, 눌러야 보인다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));

    expectRowHidden(CORRECTIONS[3]);
    expect(screen.queryAllByText("the morning", { exact: false })).toHaveLength(0);

    await fireEvent.press(revealButtonOf(CORRECTIONS[3]));
    expectRowRevealed(CORRECTIONS[3]);
  });

  it("[spec] '교정 2개 더 보기'로 펼친 다섯째·여섯째 줄도 고친 표현이 가려져 있고, 그 줄의 버튼을 눌러야 보인다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));

    await fireEvent.press(screen.getByRole("button", { name: "교정 2개 더 보기" }));
    CORRECTIONS.forEach(expectRowHidden);
    expect(screen.getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(6);

    await fireEvent.press(revealButtonOf(CORRECTIONS[5]));
    expectRowRevealed(CORRECTIONS[5]);
    CORRECTIONS.slice(0, 5).forEach(expectRowHidden);
  });

  it("[spec] 고친 문장 전체('이번에 고친 문장' 줄)는 처음에 가려져 있고 '고친 문장 전체 보기'를 누르면 바뀐 곳이 강조된 고친 문장이 보인다. '지금' 줄은 처음부터 바뀔 곳이 강조되어 보인다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));

    expectSentenceHidden();

    await fireEvent.press(screen.getByRole("button", { name: REVEAL_SENTENCE }));
    expectSentenceRevealed();
    expectOriginalRowShown();
    // 고친 문장을 펼쳐도 교정 줄의 고친 표현은 그대로 가려져 있다.
    CORRECTIONS.slice(0, 4).forEach(expectRowHidden);
  });

  it("[spec] 다시 쓸 때 안내는 서버 안내 대신 '이유를 보고 표시된 곳을 직접 고쳐 보세요. 막히면 고친 표현을 눌러 확인해요.'이다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));

    expect(screen.getByText(NEW_INSTRUCTION)).toBeOnTheScreen();
    expect(screen.queryByText(SERVER_INSTRUCTION)).toBeNull();
  });

  it("[spec] 펼쳐 본 뒤 다시 써서 다음 피드백(같은 교정)을 받으면 고친 표현과 고친 문장이 모두 다시 가려진다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));
    await fireEvent.press(revealButtonOf(CORRECTIONS[0]));
    await fireEvent.press(revealButtonOf(CORRECTIONS[2]));
    await fireEvent.press(screen.getByRole("button", { name: REVEAL_SENTENCE }));
    expectRowRevealed(CORRECTIONS[0]);
    expectSentenceRevealed();

    jest
      .mocked(submitFeedback)
      .mockResolvedValue(coachFeedback(languageFixMove(), { attemptNo: 2 }, { strength: "두 번째 시도의 잘한 점" }));
    await fireEvent.changeText(screen.getByDisplayValue(ORIGINAL_SENTENCE), "I goes to school yesterday.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    expect(await screen.findByText("두 번째 시도의 잘한 점")).toBeOnTheScreen();

    CORRECTIONS.slice(0, 4).forEach(expectRowHidden);
    expectSentenceHidden();
  });

  it("[spec] 펼쳐 본 뒤 같은 화면에서 다른 질문의 문장 교정 피드백(같은 시도 번호)으로 바뀌면 모두 가려진 상태로 시작한다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove())));
    await fireEvent.press(revealButtonOf(CORRECTIONS[0]));
    await fireEvent.press(screen.getByRole("button", { name: REVEAL_SENTENCE }));
    expectRowRevealed(CORRECTIONS[0]);
    expectSentenceRevealed();

    const secondState = makeState(
      coachFeedback(
        languageFixMove(),
        { promptId: prompt2.id, sessionId: "session-052-b", attemptNo: 1 },
        { strength: "두 번째 질문의 잘한 점" }
      ),
      { prompt: prompt2 }
    );
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(secondState);
    setParams({ difficulty: "A", promptId: prompt2.id });
    await screen.rerender(<PracticeFeedbackScreen />);
    expect(await screen.findByText("두 번째 질문의 잘한 점")).toBeOnTheScreen();

    CORRECTIONS.slice(0, 4).forEach(expectRowHidden);
    expectSentenceHidden();
  });

  it("[spec] 문장 교정 미션이면 다시쓰기 칸의 자리 표시 문구에 서버가 보낸 값(고친 문장 전체) 대신 화면의 일반 안내 '코치 포인트를 반영해서 다시 써보세요.'를 쓴다. 칸을 비워도 고친 문장이 보이지 않는다", async () => {
    await renderScreen(
      makeState(
        coachFeedback(languageFixMove(), {
          rewriteWorkspace: { seedText: ORIGINAL_SENTENCE, placeholder: REVISED_SENTENCE, lockMeaning: true }
        })
      )
    );

    const input = screen.getByDisplayValue(ORIGINAL_SENTENCE);
    expect(screen.queryByPlaceholderText(REVISED_SENTENCE)).toBeNull();
    expect(screen.getByPlaceholderText(DEFAULT_PLACEHOLDER)).toBe(input);

    await fireEvent.changeText(input, "");
    expect(screen.getByPlaceholderText(DEFAULT_PLACEHOLDER)).toHaveDisplayValue("");
    expect(screen.queryByPlaceholderText(REVISED_SENTENCE)).toBeNull();
  });

  it("[spec] 초점 종류의 앞뒤 빈칸과 대소문자는 무시한다(' language_fix '도 문장 교정 미션): 고친 표현·고친 문장 전체가 가려지고 안내가 바뀐다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixMove({ focusType: " language_fix " }))));

    CORRECTIONS.slice(0, 4).forEach((correction) => expectRowHidden(correction));
    expect(screen.getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(4);
    expectSentenceHidden();
    expect(screen.getByText(NEW_INSTRUCTION)).toBeOnTheScreen();
    expect(screen.queryByText(SERVER_INSTRUCTION)).toBeNull();
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 문장 교정 미션 정답 가리기(모바일): 그대로 둘 동작", () => {
  it("[spec] 문장 교정이 아닌 고치기 미션(GRAMMAR_FIX)은 '적용' 줄의 고친 문장과 교정 줄의 고친 표현이 처음부터 보이고, 보기 버튼이 없으며 서버 안내를 보인다", async () => {
    await renderScreen(
      makeState(coachFeedback(languageFixMove({ focusType: "GRAMMAR_FIX", instruction: "고친 문장을 넣어 다시 써 보세요." })))
    );

    expect(screen.getByText("적용")).toBeOnTheScreen();
    expect(screen.getByText(REVISED_SENTENCE)).toBeOnTheScreen();
    CORRECTIONS.slice(0, 4).forEach((correction) => expect(screen.getByText(correction.after)).toBeOnTheScreen());
    expect(screen.queryByRole("button", { name: REVEAL_ROW })).toBeNull();
    expect(screen.queryByRole("button", { name: REVEAL_SENTENCE })).toBeNull();
    expect(screen.getByText("고친 문장을 넣어 다시 써 보세요.")).toBeOnTheScreen();
    expect(screen.queryByText(NEW_INSTRUCTION)).toBeNull();
  });

  it("[spec] 내용 보충 미션(ADD_DETAIL)은 서버 안내, 문장 틀, 넣어볼 표현이 그대로 보이고 보기 버튼이 없다", async () => {
    await renderScreen(
      makeState(
        coachFeedback({
          focus: "이유를 한 문장 더해 보세요",
          focusType: "ADD_DETAIL",
          why: "이유가 있으면 답이 더 구체적이에요.",
          instruction: "왜 학교에 갔는지 한 문장 더 써 보세요.",
          skeletonEn: "I went there because ____.",
          skeletonKo: "저는 ____해서 거기 갔어요.",
          suggestedPhrases: ["to meet my friends"]
        })
      )
    );

    expect(screen.getByText("왜 학교에 갔는지 한 문장 더 써 보세요.")).toBeOnTheScreen();
    expect(screen.getByText("I went there because ____.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "to meet my friends 저장" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: REVEAL_ROW })).toBeNull();
    expect(screen.queryByRole("button", { name: REVEAL_SENTENCE })).toBeNull();
    expect(screen.queryByText(NEW_INSTRUCTION)).toBeNull();
  });

  it("[spec] 루프 완료 화면(문장 교정 코치 미션이 들어 있어도)에는 코치 카드와 보기 버튼이 없고, 모범답안은 지금처럼 눌러서 펼친다", async () => {
    await renderScreen(
      makeState(
        makeFeedback({
          loopComplete: true,
          visibleFeedback: {
            schemaVersion: 1,
            state: "READY_TO_FINISH",
            strength: "과거형으로 잘 썼어요.",
            coachMove: languageFixMove(),
            modelAnswer: "I went to school yesterday with my sister.",
            modelAnswerKo: "저는 어제 여동생과 학교에 갔어요."
          }
        })
      )
    );

    expect(screen.queryByRole("button", { name: REVEAL_ROW })).toBeNull();
    expect(screen.queryByRole("button", { name: REVEAL_SENTENCE })).toBeNull();
    expect(screen.queryByText(NEW_INSTRUCTION)).toBeNull();
    expect(screen.queryByText(CORRECTIONS[0].reason)).toBeNull();
    expect(screen.queryByText("I went to school yesterday with my sister.")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "모범답안 펼치기" }));
    expect(screen.getByText("I went to school yesterday with my sister.")).toBeOnTheScreen();
    expect(screen.getByText("저는 어제 여동생과 학교에 갔어요.")).toBeOnTheScreen();
  });

  it("[spec] 문장 교정 피드백의 다시쓰기 칸에는 내 원래 답이 들어 있고, 그대로 제출하면 그 답을 REWRITE로 보낸다", async () => {
    jest.mocked(submitFeedback).mockResolvedValue(coachFeedback(languageFixMove(), { attemptNo: 2 }));
    await renderScreen(makeState(coachFeedback(languageFixMove())));

    expect(screen.getByDisplayValue(ORIGINAL_SENTENCE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(submitFeedback).toHaveBeenCalledWith({
      promptId: prompt.id,
      answer: ORIGINAL_SENTENCE,
      sessionId: "session-052",
      attemptType: "REWRITE",
      guestId: undefined,
      submissionId: "uuid-1"
    });
  });

  it("[spec] 문장 교정이 아닌 미션(ADD_DETAIL)은 다시쓰기 칸의 자리 표시 문구로 서버가 보낸 값을 그대로 쓴다", async () => {
    await renderScreen(
      makeState(
        coachFeedback(
          {
            focus: "이유를 한 문장 더해 보세요",
            focusType: "ADD_DETAIL",
            why: "이유가 있으면 답이 더 구체적이에요.",
            instruction: "왜 학교에 갔는지 한 문장 더 써 보세요.",
            skeletonEn: "I went there because ____."
          },
          { rewriteWorkspace: { seedText: ORIGINAL_SENTENCE, placeholder: "I went to school because ____.", lockMeaning: true } }
        )
      )
    );

    const input = screen.getByDisplayValue(ORIGINAL_SENTENCE);
    expect(screen.getByPlaceholderText("I went to school because ____.")).toBe(input);
    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();
  });

  it("[spec] 기록 상세(작문 기록 상세 창)는 문장 교정 피드백의 '이번에 고친 문장', 교정 줄의 고친 표현, 서버 안내를 처음부터 다 보이고 보기 버튼이 없다", async () => {
    const session: HistorySession = {
      sessionId: "session-history-052",
      promptId: prompt.id,
      topic: prompt.topic,
      difficulty: "A",
      questionEn: prompt.questionEn,
      questionKo: prompt.questionKo,
      status: "IN_PROGRESS",
      createdAt: "2026-11-03T01:00:00Z",
      updatedAt: "2026-11-03T01:00:00Z",
      attempts: [
        {
          id: 52001,
          attemptNo: 1,
          attemptType: "INITIAL",
          answerText: ORIGINAL_SENTENCE,
          feedbackSummary: "",
          visibleFeedback: {
            schemaVersion: 1,
            state: "NEEDS_REWRITE",
            strength: "하고 싶은 말을 끝까지 썼어요.",
            coachMove: languageFixMove()
          },
          usedExpressions: [],
          createdAt: "2026-11-03T01:00:00Z"
        }
      ]
    };
    await render(<HistorySessionDetailModal session={session} onClose={jest.fn()} onResume={jest.fn()} />);

    expect(screen.getByText("이번에 고친 문장")).toBeOnTheScreen();
    expect(screen.getByText(REVISED_SENTENCE)).toBeOnTheScreen();
    expect(screen.getByText("I go → I went")).toBeOnTheScreen();
    expect(screen.getByText("Because tired. → Because I was tired.")).toBeOnTheScreen();
    expect(screen.getByText("a apple → an apple")).toBeOnTheScreen();
    expect(screen.getByText("the morning")).toBeOnTheScreen();
    expect(screen.getByText(SERVER_INSTRUCTION)).toBeOnTheScreen();
    expect(screen.queryByText(NEW_INSTRUCTION)).toBeNull();
    expect(screen.queryByRole("button", { name: REVEAL_ROW })).toBeNull();
    expect(screen.queryByRole("button", { name: REVEAL_SENTENCE })).toBeNull();
  });
});
