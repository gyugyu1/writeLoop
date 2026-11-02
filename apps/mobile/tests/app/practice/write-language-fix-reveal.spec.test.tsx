// [spec] qa 테스트(작업 052 문장 교정 미션 정답 가리기, 기능 변경). 03-main-decision.md 1번(사용자 결정):
// 다시 쓰는 중에 보는 "이전 피드백"(모바일 작문 화면의 이전 피드백 창)도 피드백 화면과 같은 방식으로 가린다.
// 문장 교정 미션(coachMove.focusType LANGUAGE_FIX)이면 교정 줄의 고친 표현은 줄마다 "고친 표현 보기"를,
// 고친 문장 전체는 "고친 문장 전체 보기"를 눌러야 보인다. 기록 화면은 그대로 다 보인다(feedback-language-fix-reveal에서 본다).
// "바뀔 동작" 테스트는 고치기 전 코드에서 실패하고, "그대로 둘 동작" 테스트는 통과해야 한다.
// 작문 화면(src/app/practice/write.tsx) 전체를 다시 쓰기 모드로 렌더하고 사용자처럼 누른다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(expo-secure-store, @/lib/writing-drafts, 이어 쓰기 상태 저장·지우기,
// 저장된 피드백 상태 불러오기, 게스트 아이디), 로그인 상태(@/lib/session), 라우터·내비게이션, 네이티브 모듈(expo-crypto).
// 임시저장 타이머가 저절로 돌지 않게 가짜 시계로 돌린다(작문 화면 테스트와 같다).
// "보인다"는 Testing Library의 기본 질의(접근성에서 숨긴 요소와 display:none은 찾지 않는다)로 본다.
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, AppState, Keyboard } from "react-native";
import type { TestInstance } from "test-renderer";
import PracticeWriteScreen from "@/app/practice/write";
import { getDailyPrompts, getPromptHints, getPrompts, getWritingDraft, saveWritingDraft } from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { clearIncompleteLoopForPrompt, saveIncompleteLoop } from "@/lib/incomplete-loop";
import {
  clearPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, Feedback, FeedbackCoachMove, FeedbackLanguageCorrection, Prompt } from "@/lib/types";
import { deleteLocalWritingDraft, getLocalWritingDraft, saveLocalWritingDraft } from "@/lib/writing-drafts";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: jest.fn(), useNavigation: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
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
    deleteWritingDraft: jest.fn(),
    getDailyPrompts: jest.fn(),
    getPromptHints: jest.fn(),
    getPrompts: jest.fn(),
    getWritingDraft: jest.fn(),
    requestCoachHelp: jest.fn(),
    saveExpression: jest.fn(),
    saveWritingDraft: jest.fn(),
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
jest.mock("@/lib/incomplete-loop", () => ({
  ...jest.requireActual("@/lib/incomplete-loop"),
  clearIncompleteLoopForPrompt: jest.fn(),
  saveIncompleteLoop: jest.fn()
}));
jest.mock("@/lib/practice-feedback-state", () => ({
  ...jest.requireActual("@/lib/practice-feedback-state"),
  hydratePracticeFeedbackState: jest.fn()
}));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-03T06:00:00.000Z");

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

const signedInUser: AuthUser = { id: 52, email: "language-fix-write@example.com", displayName: "학습자", admin: false };

const PREVIOUS_FEEDBACK = "이전 피드백 보기";

// 명세의 문구.
const REVEAL_ROW = /고친 표현 보기/;
const REVEAL_SENTENCE = /고친 문장 전체 보기/;
// 서버가 문장 교정 미션에 보내는 안내(CanonicalFeedbackAssembler).
const SERVER_INSTRUCTION = "위 교정들을 반영해 문장 전체를 다시 써 보세요.";

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

function coachFeedback(coachMove: FeedbackCoachMove): Feedback {
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
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "하고 싶은 말을 끝까지 썼어요.",
      coachMove
    }
  };
}

function savedState(feedback: Feedback): PracticeFeedbackState {
  return { difficulty: "A", prompt, initialAnswer: ORIGINAL_SENTENCE, answer: ORIGINAL_SENTENCE, feedback };
}

// ---------- 도우미 ----------

const navigation = { canGoBack: jest.fn(), goBack: jest.fn() };
const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let keyboardDismissSpy: jest.SpyInstance;

function setParams(params: Record<string, string>) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
}

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

// 다시 쓰기 모드의 작문 화면을 열고 "이전 피드백 보기"를 눌러 이전 피드백 창을 연다. 열린 창(Modal)을 돌려준다.
async function openPreviousFeedback(feedback: Feedback) {
  savePracticeFeedbackState(savedState(feedback));
  setParams({ difficulty: "A", promptId: prompt.id, mode: "rewrite" });
  await render(<PracticeWriteScreen />);
  await flushAsync();
  expect(screen.getByText(prompt.questionEn)).toBeOnTheScreen();

  await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[0]);
  const modals = screen.root!.queryAll((instance) => instance.type === "Modal");
  expect(modals).toHaveLength(1);
  return modals[0];
}

// 교정 한 줄의 칸: 이유 글자에서 위로 올라가며 배지 이름(과 고치기 전 표현)을 함께 담은 가장 가까운 요소.
function correctionRow(correction: Row, container: TestInstance): TestInstance {
  let node: TestInstance | null = within(container).getByText(correction.reason);
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

function revealButtonOf(correction: Row, container: TestInstance) {
  return within(correctionRow(correction, container)).getByRole("button", { name: REVEAL_ROW });
}

// 가려진 교정 줄: 배지, 고치기 전 표현(있으면), 이유는 보이고 고친 표현은 보이지 않으며, 그 줄에 "고친 표현 보기" 버튼이 하나 있다.
// (이 창은 지금 고치기 전 표현과 화살표, 고친 표현을 한 글자 줄로 보이고, 고치기 전 표현이 없으면 화살표도 없다.
// 가린 뒤 화살표의 모양은 결정에 없어 보지 않는다.)
function expectRowHidden(correction: Row, container: TestInstance) {
  const row = correctionRow(correction, container);
  expect(within(row).getAllByText(correction.label, { exact: false }).length).toBeGreaterThan(0);
  if (correction.before) {
    expect(within(row).getAllByText(correction.before, { exact: false }).length).toBeGreaterThan(0);
  }
  expect(within(row).getByText(correction.reason)).toBeOnTheScreen();
  expect(within(row).queryAllByText(correction.after, { exact: false })).toHaveLength(0);
  expect(within(row).getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(1);
}

function expectRowRevealed(correction: Row, container: TestInstance) {
  const row = correctionRow(correction, container);
  expect(within(row).getAllByText(correction.after, { exact: false }).length).toBeGreaterThan(0);
  expect(within(row).getByText(correction.reason)).toBeOnTheScreen();
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  clearPracticeFeedbackState();
  navigation.canGoBack.mockReset().mockReturnValue(true);
  navigation.goBack.mockReset();
  jest.mocked(useNavigation).mockReset().mockReturnValue(navigation as unknown as ReturnType<typeof useNavigation>);
  jest.mocked(useIsFocused).mockReset().mockReturnValue(true);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(randomUUID).mockReset().mockReturnValue("uuid-n");
  jest.mocked(getDailyPrompts).mockReset().mockResolvedValue({ recommendedDate: "2026-11-03", difficulty: "A", prompts: [prompt] });
  jest.mocked(getPrompts).mockReset().mockResolvedValue([]);
  jest.mocked(getPromptHints).mockReset().mockResolvedValue([]);
  jest.mocked(getWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveWritingDraft).mockReset();
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue("guest-052");
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);
  jest.mocked(getLocalWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(saveIncompleteLoop).mockReset().mockResolvedValue(undefined);
  jest.mocked(clearIncompleteLoopForPrompt).mockReset().mockResolvedValue(undefined);
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation(() => ({ remove: jest.fn() }));
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

describe("[spec] 문장 교정 미션 정답 가리기(모바일 작문 화면의 이전 피드백 창): 바뀔 동작", () => {
  it("[spec] 이전 피드백 창에서 문장 교정 미션의 교정 줄은 배지·고치기 전 표현·이유만 보이고 고친 표현은 가려져 줄마다 '고친 표현 보기'가 있으며, 고친 문장 전체는 가려져 '고친 문장 전체 보기'가 있다. '지금' 줄(내 원래 답)은 보인다", async () => {
    const modal = await openPreviousFeedback(coachFeedback(languageFixMove()));

    CORRECTIONS.slice(0, 4).forEach((correction) => expectRowHidden(correction, modal));
    expect(within(modal).getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(4);
    CORRECTIONS.forEach((correction) =>
      expect(within(modal).queryAllByText(correction.after, { exact: false })).toHaveLength(0)
    );
    expect(within(modal).getByText("지금")).toBeOnTheScreen();
    expect(within(modal).getByText(ORIGINAL_SENTENCE)).toBeOnTheScreen();
    expect(within(modal).queryByText(REVISED_SENTENCE)).toBeNull();
    expect(within(modal).getAllByRole("button", { name: REVEAL_SENTENCE })).toHaveLength(1);
  });

  it("[spec] 이전 피드백 창에서 한 줄의 '고친 표현 보기'를 누르면 그 줄의 고친 표현만 보이고, '고친 문장 전체 보기'를 누르면 '이번에 고친 문장' 줄에 고친 문장이 보인다", async () => {
    const modal = await openPreviousFeedback(coachFeedback(languageFixMove()));

    await fireEvent.press(revealButtonOf(CORRECTIONS[1], modal));
    expectRowRevealed(CORRECTIONS[1], modal);
    [CORRECTIONS[0], CORRECTIONS[2], CORRECTIONS[3]].forEach((correction) => expectRowHidden(correction, modal));
    expect(within(modal).queryByText(REVISED_SENTENCE)).toBeNull();

    await fireEvent.press(within(modal).getByRole("button", { name: REVEAL_SENTENCE }));
    expect(within(modal).getByText("이번에 고친 문장")).toBeOnTheScreen();
    expect(within(modal).getByText(REVISED_SENTENCE)).toBeOnTheScreen();
    [CORRECTIONS[0], CORRECTIONS[2], CORRECTIONS[3]].forEach((correction) => expectRowHidden(correction, modal));
  });

  it("[spec] 이전 피드백 창에서 '교정 2개 더 보기'로 펼친 다섯째·여섯째 줄도 고친 표현이 가려져 있고, 그 줄의 버튼을 눌러야 보인다", async () => {
    const modal = await openPreviousFeedback(coachFeedback(languageFixMove()));

    await fireEvent.press(within(modal).getByRole("button", { name: "교정 2개 더 보기" }));
    CORRECTIONS.forEach((correction) => expectRowHidden(correction, modal));
    expect(within(modal).getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(6);

    await fireEvent.press(revealButtonOf(CORRECTIONS[5], modal));
    expectRowRevealed(CORRECTIONS[5], modal);
    CORRECTIONS.slice(0, 5).forEach((correction) => expectRowHidden(correction, modal));
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 문장 교정 미션 정답 가리기(모바일 작문 화면의 이전 피드백 창): 그대로 둘 동작", () => {
  it("[spec] 문장 교정이 아닌 고치기 미션(GRAMMAR_FIX)은 이전 피드백 창에서 '적용' 줄의 고친 문장과 교정 줄의 고친 표현이 지금처럼 다 보이고 보기 버튼이 없다", async () => {
    const modal = await openPreviousFeedback(
      coachFeedback(languageFixMove({ focusType: "GRAMMAR_FIX", instruction: "고친 문장을 넣어 다시 써 보세요." }))
    );

    expect(within(modal).getByText("적용")).toBeOnTheScreen();
    expect(within(modal).getByText(REVISED_SENTENCE)).toBeOnTheScreen();
    expect(within(modal).getByText("I go → I went")).toBeOnTheScreen();
    expect(within(modal).getByText("Because tired. → Because I was tired.")).toBeOnTheScreen();
    expect(within(modal).getByText("a apple → an apple")).toBeOnTheScreen();
    expect(within(modal).getByText("the morning")).toBeOnTheScreen();
    expect(within(modal).getByText("고친 문장을 넣어 다시 써 보세요.")).toBeOnTheScreen();
    expect(within(modal).queryByRole("button", { name: REVEAL_ROW })).toBeNull();
    expect(within(modal).queryByRole("button", { name: REVEAL_SENTENCE })).toBeNull();
  });
});
