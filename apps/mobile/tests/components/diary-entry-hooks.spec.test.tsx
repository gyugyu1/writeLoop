// [spec] qa 테스트(작업 047-06 일기 화면 훅, 리팩터링의 "지금 동작" 기록).
// 영어일기 화면(src/components/diary-entry-screen.tsx)의 AI 코치 상태와 표현 저장 상태·효과(E2)를 훅으로 옮겨도
// 그대로여야 하는 것 중, 일기 ①의 화면 테스트(diary-entry-screen.spec.test.tsx)가 보지 않는 것만 더 적는다.
// - 효과 실행 순서: 처음 그릴 때 E1(일기·임시본 불러오기) → E2(저장된 표현) → E4(AppState 듣기)
// - E2가 로그인 사용자를 따라 다시 도는 것: 로그아웃하면 저장됨·저장 중 표시를 비우고, 사용자가 바뀌면 앞 사용자의
//   늦은 응답을 버린다
// - 코치 훅이 받는 지금 쓰는 글·단계: 질문을 바꾸지 않고 다시 물어도 그 사이 바뀐 본문·단계로 묻는다
// - 표현 저장 훅 안의 값 전달: 코치에서 저장한 표현의 id로 패널에서 저장을 취소한다. 패널에서 저장해도 코치 창은
//   "저장"으로 남는다(두 상태가 따로다)
// 가짜로 두는 것은 diary-entry-screen.spec.test.tsx와 같다(API, 기기 저장소, 로그인 상태, 라우터, Alert, AppState,
// 네이티브 모듈). 가짜 시계: 2026-11-12T03:00:00Z = 서울 2026-11-12 12:00.
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, AppState, type AppStateStatus } from "react-native";
import type { TestInstance } from "test-renderer";
import DiaryEntryScreen from "@/components/diary-entry-screen";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  deleteSavedExpression,
  getDiaryEntry,
  getSavedExpressions,
  requestCoachHelp,
  requestDiaryFeedback,
  saveExpression,
  updateDiaryEntry
} from "@/lib/api";
import { deleteDiaryDraft, getDiaryDraft, saveDiaryDraft } from "@/lib/diary-drafts";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  CoachHelpResponse,
  DiaryEntry,
  DiaryExpression,
  DiaryFeedback,
  SavedExpression
} from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() }
}));
jest.mock("expo-symbols", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    SymbolView: (props: object) => React.createElement("ExpoSymbolView", props)
  };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/api", () => ({
  createDiaryEntry: jest.fn(),
  deleteDiaryEntry: jest.fn(),
  deleteSavedExpression: jest.fn(),
  getDiaryEntry: jest.fn(),
  getSavedExpressions: jest.fn(),
  requestCoachHelp: jest.fn(),
  requestDiaryFeedback: jest.fn(),
  saveExpression: jest.fn(),
  updateDiaryEntry: jest.fn()
}));
jest.mock("@/lib/diary-drafts", () => ({
  deleteDiaryDraft: jest.fn(),
  getDiaryDraft: jest.fn(),
  saveDiaryDraft: jest.fn()
}));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const COACH_PLACEHOLDER = '예: "아쉬웠다"를 자연스럽게 어떻게 써?';

const userA: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };
const userB: AuthUser = { id: 8, email: "other@example.com", displayName: "다른 학습자", admin: false };

function makeFeedback(overrides: Partial<DiaryFeedback> = {}): DiaryFeedback {
  return {
    schemaVersion: "diary-feedback-v1",
    entryId: "entry-1",
    attemptNo: 1,
    score: 70,
    finishable: true,
    diaryAnswerBand: "DIARY_CLEAR_BASIC",
    summaryKo: "",
    strengths: [],
    fixPoints: [],
    diaryFlow: { timeFlow: "", emotion: "", detail: "", reflection: "", commentKo: "", connectionTips: [] },
    rewriteIdeas: [],
    usedDiaryExpressions: [],
    diaryExpressions: [],
    nextDiaryMission: { focus: "", titleKo: "", instructionKo: "" },
    safetyFlags: [],
    ...overrides
  };
}

function expression(value: string, overrides: Partial<DiaryExpression> = {}): DiaryExpression {
  return { expression: value, meaningKo: "", exampleEn: null, usageTipKo: "", tags: [], ...overrides };
}

// 패널의 써볼 표현이 코치 표현 둘과 같은 피드백.
const coachPairFeedback = makeFeedback({
  diaryExpressions: [expression("feel relieved", { meaningKo: "안도하다" }), expression("call it a day")]
});

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    entryId: "entry-1",
    title: "Rainy Tuesday",
    content: "I walked in the rain.",
    language: "en",
    entryDate: "2026-11-03",
    mood: null,
    tags: ["calm", "happy"],
    draft: true,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-03T00:00:00.000Z",
    attempts: [],
    ...overrides
  };
}

// 피드백을 받은 임시 저장 일기: 본문은 "I walked in the rain.", 다시 써보기 칸은 마지막 시도 본문.
function feedbackEntry(feedback: DiaryFeedback) {
  return makeEntry({
    attempts: [
      {
        id: 1,
        attemptNo: 1,
        diaryText: "I walked in the rain today.",
        score: feedback.score,
        feedback,
        createdAt: "2026-11-03T00:00:00.000Z"
      }
    ]
  });
}

function savedExpression(id: number, value: string): SavedExpression {
  return {
    id,
    expression: value,
    sourceType: "DIARY_EXPRESSION",
    saveCount: 1,
    lastSavedAt: "2026-11-01T00:00:00Z",
    createdAt: "2026-11-01T00:00:00Z"
  };
}

const coachHelp: CoachHelpResponse = {
  promptId: "diary-free-writing",
  userQuestion: "How do I say it?",
  coachReply: "이렇게 써 보세요.",
  expressions: [
    {
      id: "c1",
      expression: "feel relieved",
      meaningKo: "안도하다",
      usageTip: "걱정이 끝났을 때",
      example: "I felt relieved after the test.",
      tags: ["emotion"]
    },
    {
      id: "c2",
      expression: "Call it a day",
      meaningKo: "하루를 마치다",
      usageTip: "일을 끝낼 때",
      example: "Let's call it a day.",
      tags: null
    }
  ]
};

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;

function setSessionUser(currentUser: AuthUser | null, isHydrating = false) {
  jest.mocked(useSession).mockReturnValue({
    currentUser,
    isHydrating,
    refreshSession,
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

async function renderFeedbackStep(feedback: DiaryFeedback) {
  jest.mocked(getDiaryEntry).mockResolvedValue(feedbackEntry(feedback));
  await render(<DiaryEntryScreen initialEntryId="entry-1" />);
  await flushAsync();
  expect(screen.getByText("일기쓰기 완료")).toBeOnTheScreen();
}

async function rerenderScreen() {
  await screen.rerender(<DiaryEntryScreen initialEntryId="entry-1" />);
  await flushAsync();
}

function modalHosts() {
  return screen.root!.queryAll((instance: TestInstance) => instance.type === "Modal");
}

function openModal() {
  const modals = modalHosts();
  expect(modals).toHaveLength(1);
  return modals[0];
}

// 편집 화면의 입력 칸 순서: 날짜, 제목, 본문(코치 창이 열려 있으면 그 뒤에 질문 칸).
function bodyInput() {
  return screen.root!.queryAll((instance: TestInstance) => instance.type === "TextInput")[2];
}

function coachInput() {
  return screen.getByPlaceholderText(COACH_PLACEHOLDER);
}

async function pressText(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}

async function pressButton(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flushAsync();
}

async function typeInto(input: TestInstance, value: string) {
  await fireEvent.changeText(input, value);
  await flushAsync();
}

async function openCoach() {
  await pressButton("AI 코치 열기");
  openModal();
}

async function askCoach(question: string) {
  await typeInto(coachInput(), question);
  await pressText("코치에게 물어보기");
}

// 코치 창 표현 카드의 저장 버튼 글자들(표현 순서: feel relieved, Call it a day).
function coachSaveLabels() {
  const modal = openModal();
  return ["feel relieved", "Call it a day"].map((value) => {
    const card = within(modal).getByText(value).parent!;
    const label = within(card).getByText(/^(저장|저장 중|저장됨)$/);
    const button = label.parent!;
    const disabled = Boolean(button.props.accessibilityState?.disabled ?? button.props["aria-disabled"]);
    return { text: label.props.children as string, disabled };
  });
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation(((
    _type: string,
    _listener: (state: AppStateStatus) => void
  ) => ({ remove: jest.fn() })) as unknown as typeof AppState.addEventListener);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getDiaryEntry).mockReset().mockResolvedValue(makeEntry());
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(createDiaryEntry).mockReset().mockResolvedValue(makeEntry({ entryId: "entry-new" }));
  jest.mocked(updateDiaryEntry).mockReset().mockImplementation(async (entryId) => makeEntry({ entryId }));
  jest.mocked(deleteDiaryEntry).mockReset().mockResolvedValue(undefined);
  jest.mocked(requestDiaryFeedback).mockReset().mockResolvedValue(coachPairFeedback);
  jest.mocked(requestCoachHelp).mockReset().mockResolvedValue(coachHelp);
  jest.mocked(saveExpression).mockReset().mockImplementation(async (request) => savedExpression(90, request.expression));
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  jest.mocked(getDiaryDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveDiaryDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteDiaryDraft).mockReset().mockResolvedValue(undefined);
  refreshSession.mockReset().mockResolvedValue(userA);
  setSessionUser(userA);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 효과 실행 순서 ----------

describe("[spec] 효과 실행 순서", () => {
  it("[spec] 기존 일기를 처음 그릴 때 일기 불러오기(E1) → 저장된 표현(E2) → AppState 듣기(E4) 순으로 한 번씩 부른다", async () => {
    await render(<DiaryEntryScreen initialEntryId="entry-1" />);
    await flushAsync();

    expect(getDiaryEntry).toHaveBeenCalledTimes(1);
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    const e1 = jest.mocked(getDiaryEntry).mock.invocationCallOrder[0];
    const e2 = jest.mocked(getSavedExpressions).mock.invocationCallOrder[0];
    const e4 = jest.mocked(AppState.addEventListener).mock.invocationCallOrder[0];
    expect(e1).toBeLessThan(e2);
    expect(e2).toBeLessThan(e4);
  });

  it("[spec] 새 일기를 처음 그릴 때 임시본 확인(E1) → 저장된 표현(E2) → AppState 듣기(E4) 순으로 한 번씩 부른다", async () => {
    await render(<DiaryEntryScreen />);
    await flushAsync();

    expect(getDiaryDraft).toHaveBeenCalledTimes(1);
    expect(getDiaryDraft).toHaveBeenCalledWith("");
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    const e1 = jest.mocked(getDiaryDraft).mock.invocationCallOrder[0];
    const e2 = jest.mocked(getSavedExpressions).mock.invocationCallOrder[0];
    const e4 = jest.mocked(AppState.addEventListener).mock.invocationCallOrder[0];
    expect(e1).toBeLessThan(e2);
    expect(e2).toBeLessThan(e4);
  });
});

// ---------- 로그인 사용자와 저장된 표현(E2) ----------

describe("[spec] 로그인 사용자와 저장된 표현", () => {
  it("[spec] 로그아웃하면 저장됨·저장 중 표시를 비우고, 다시 로그인하면 새 사용자의 목록을 불러 그 표현만 저장됨으로 보인다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValueOnce([savedExpression(3, "feel relieved")]);
    const pendingCoachSave = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValueOnce(pendingCoachSave.promise);
    await renderFeedbackStep(coachPairFeedback);
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getByText("저장"));
    await flushAsync();
    expect(coachSaveLabels()).toEqual([
      { text: "저장됨", disabled: true },
      { text: "저장 중", disabled: true }
    ]);

    setSessionUser(null);
    await rerenderScreen();
    expect(screen.getByText("로그인이 필요해요")).toBeOnTheScreen();

    const userBList = deferred<SavedExpression[]>();
    jest.mocked(getSavedExpressions).mockReturnValueOnce(userBList.promise);
    setSessionUser(userB);
    await rerenderScreen();

    expect(getSavedExpressions).toHaveBeenCalledTimes(2);
    expect(getDiaryEntry).toHaveBeenCalledTimes(1);
    // 코치 창은 열린 채, 답변도 그대로 남는다. 저장됨·저장 중 표시만 비었다.
    expect(within(openModal()).getByText("이렇게 써 보세요.")).toBeOnTheScreen();
    expect(coachSaveLabels()).toEqual([
      { text: "저장", disabled: false },
      { text: "저장", disabled: false }
    ]);
    await pressText("닫기");
    expect(screen.getAllByRole("button", { name: "표현 저장" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "표현 저장 취소" })).toBeNull();

    await act(async () => {
      userBList.resolve([savedExpression(8, "Call It A Day")]);
    });
    await flushAsync();
    const panelButtons = screen.getAllByRole("button", { name: /^표현 저장/ });
    expect(panelButtons.map((button) => button.props.accessibilityLabel)).toEqual(["표현 저장", "표현 저장 취소"]);
    await openCoach();
    expect(coachSaveLabels()).toEqual([
      { text: "저장", disabled: false },
      { text: "저장됨", disabled: true }
    ]);

    await act(async () => {
      pendingCoachSave.resolve(savedExpression(11, "Call it a day"));
    });
    await flushAsync();
  });

  it("[spec] 사용자가 바뀌면 앞 사용자의 저장된 표현 목록이 늦게 와도 버린다", async () => {
    const userAList = deferred<SavedExpression[]>();
    jest.mocked(getSavedExpressions).mockReturnValueOnce(userAList.promise).mockResolvedValueOnce([]);
    await renderFeedbackStep(coachPairFeedback);

    setSessionUser(userB);
    await rerenderScreen();
    expect(getSavedExpressions).toHaveBeenCalledTimes(2);

    await act(async () => {
      userAList.resolve([savedExpression(3, "feel relieved"), savedExpression(4, "call it a day")]);
    });
    await flushAsync();

    expect(screen.getAllByRole("button", { name: "표현 저장" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "표현 저장 취소" })).toBeNull();
    await openCoach();
    await askCoach("Help me");
    expect(coachSaveLabels()).toEqual([
      { text: "저장", disabled: false },
      { text: "저장", disabled: false }
    ]);
  });

  it("[spec] 같은 사용자로 다시 그리거나 화면을 조작해도 저장된 표현을 다시 부르지 않는다", async () => {
    await renderFeedbackStep(coachPairFeedback);
    await rerenderScreen();
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getAllByText("저장")[0]);
    await flushAsync();
    await pressText("닫기");
    await pressButton("표현 저장 취소");

    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
  });
});

// ---------- 코치 훅이 받는 지금 쓰는 글·단계 ----------

describe("[spec] 코치에게 다시 묻기", () => {
  it("[spec] 질문을 바꾸지 않고 다시 물어도 그 사이 고친 본문, 바뀐 단계(다시 써보기)와 다시 쓴 글로 묻는다", async () => {
    await renderFeedbackStep(coachPairFeedback);
    await openCoach();
    await askCoach("Help me");
    await pressText("닫기");

    await typeInto(bodyInput(), "I changed my diary.");
    await openCoach();
    expect(coachInput().props.value).toBe("Help me");
    await pressText("코치에게 물어보기");
    await pressText("닫기");

    await pressText("다시 써보기");
    await advance(80);
    await openCoach();
    await pressText("코치에게 물어보기");
    await pressText("닫기");

    await typeInto(bodyInput(), "Rewritten again.");
    await openCoach();
    await pressText("코치에게 물어보기");

    expect(jest.mocked(requestCoachHelp).mock.calls.map((call) => call[0])).toEqual([
      { promptId: "diary-free-writing", question: "Help me", answer: "I walked in the rain.", attemptType: "INITIAL" },
      { promptId: "diary-free-writing", question: "Help me", answer: "I changed my diary.", attemptType: "INITIAL" },
      {
        promptId: "diary-free-writing",
        question: "Help me",
        answer: "I walked in the rain today.",
        attemptType: "REWRITE"
      },
      { promptId: "diary-free-writing", question: "Help me", answer: "Rewritten again.", attemptType: "REWRITE" }
    ]);
  });
});

// ---------- 표현 저장 훅 안의 값 전달 ----------

describe("[spec] 코치 표현과 패널 표현", () => {
  it("[spec] 코치에서 저장한 표현은 패널에서 그 저장 id로 취소하고, 취소한 뒤에도 코치 창은 '저장됨'이다", async () => {
    await renderFeedbackStep(coachPairFeedback);
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getAllByText("저장")[0]);
    await flushAsync();
    expect(saveExpression).toHaveBeenCalledTimes(1);
    await pressText("닫기");

    await pressButton("표현 저장 취소");
    expect(deleteSavedExpression).toHaveBeenCalledTimes(1);
    expect(deleteSavedExpression).toHaveBeenCalledWith(90);
    expect(screen.getAllByRole("button", { name: "표현 저장" })).toHaveLength(2);

    await openCoach();
    expect(coachSaveLabels()).toEqual([
      { text: "저장됨", disabled: true },
      { text: "저장", disabled: false }
    ]);
  });

  it("[spec] 패널에서 저장한 표현은 코치 창에서 '저장'으로 남고, 코치에서 다시 저장할 수 있다", async () => {
    await renderFeedbackStep(coachPairFeedback);
    await fireEvent.press(screen.getAllByRole("button", { name: "표현 저장" })[0]);
    await flushAsync();
    expect(saveExpression).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveExpression).mock.calls[0][0]).toEqual({
      expression: "feel relieved",
      meaningKo: "안도하다",
      sourceType: "DIARY_EXPRESSION"
    });
    expect(screen.getByRole("button", { name: "표현 저장 취소" })).toBeOnTheScreen();

    await openCoach();
    await askCoach("Help me");
    expect(coachSaveLabels()).toEqual([
      { text: "저장", disabled: false },
      { text: "저장", disabled: false }
    ]);
    jest.mocked(saveExpression).mockImplementationOnce(async (request) => savedExpression(91, request.expression));
    await fireEvent.press(within(openModal()).getAllByText("저장")[0]);
    await flushAsync();
    expect(saveExpression).toHaveBeenCalledTimes(2);
    expect(coachSaveLabels()).toEqual([
      { text: "저장됨", disabled: true },
      { text: "저장", disabled: false }
    ]);

    await pressText("닫기");
    await pressButton("표현 저장 취소");
    expect(deleteSavedExpression).toHaveBeenCalledWith(91);
  });
});
