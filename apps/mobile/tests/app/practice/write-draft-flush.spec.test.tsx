// [spec] qa 재현 테스트(작업 041 버그 수정: 작문 취소·제출 때 쓰던 답을 다시 저장하는 버그).
// 작문 화면(src/app/practice/write.tsx) 전체를 렌더하고 사용자처럼 눌러, 명세의 고칠 동작을 확인한다.
// - "화면을 떠날 때 저장"은 화면이 실제로 사라질 때 한 번만, 그때의 최신 상태로 돈다. 저장 함수가 바뀌었다는 이유로는 돌지 않는다.
// - 그래서 작문 취소를 확정하면 쓰던 답과 임시저장(서버·이 기기 초안, 이어 쓰기 상태)이 남지 않는다.
// - 제출할 때 쓰던 답을 한 번 더 저장하지 않는다.
// 서버 초안·이 기기 초안·이어 쓰기 상태는 부른 순서대로 바뀌는 메모리 저장소로 대신해, 취소·제출이 끝난 뒤 무엇이 남는지 본다.
// 이어 쓰기 상태 지우기는 실제 모듈(@/lib/incomplete-loop)처럼 같은 질문일 때(단계를 주면 단계도 같을 때)만 지운다.
// 가짜로 두는 것은 write.spec.test.tsx와 같다: API, 기기 저장소, 로그인 상태, 라우터·내비게이션, expo-crypto.
// 임시저장 타이머(900ms)가 저절로 돌지 않게 가짜 시계로 돌린다(시각 2026-11-01T06:00:00Z에서 멈춤).
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, AppState, Keyboard } from "react-native";
import PracticeWriteScreen from "@/app/practice/write";
import {
  deleteWritingDraft,
  getDailyPrompts,
  getPromptHints,
  getPrompts,
  getWritingDraft,
  requestCoachHelp,
  saveExpression,
  saveWritingDraft,
  submitFeedback
} from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { clearIncompleteLoopForPrompt, saveIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import {
  clearPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  DailyPromptRecommendation,
  Feedback,
  Prompt,
  SaveWritingDraftRequest,
  WritingDraft,
  WritingDraftType
} from "@/lib/types";
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

const NOW = new Date("2026-11-01T06:00:00.000Z");

function at(ms: number) {
  return new Date(NOW.getTime() + ms).toISOString();
}

const prompt: Prompt = {
  id: "prompt-1",
  topic: "Morning",
  topicCategory: "ROUTINE",
  topicDetail: "Morning routine",
  difficulty: "A",
  questionEn: "What do you usually do in the morning?",
  questionKo: "아침에 보통 무엇을 하나요?",
  tip: "usually를 써 보세요."
};
const prompt2: Prompt = {
  id: "prompt-2",
  topic: "Food",
  topicCategory: "FOOD",
  topicDetail: "Favorite food",
  difficulty: "A",
  questionEn: "What is your favorite food?",
  questionKo: "가장 좋아하는 음식은 무엇인가요?",
  tip: "because를 써 보세요."
};
const prompt3: Prompt = {
  id: "prompt-3",
  topic: "Hobby",
  topicCategory: "HOBBY",
  topicDetail: "Weekend hobby",
  difficulty: "A",
  questionEn: "What do you do on weekends?",
  questionKo: "주말에 무엇을 하나요?",
  tip: "on weekends를 써 보세요."
};

const promptSnapshot = {
  topic: "Morning",
  questionEn: "What do you usually do in the morning?",
  questionKo: "아침에 보통 무엇을 하나요?"
};

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };
const GUEST_ID = "guest-device-0123456789abcdef";

const QUESTION_EN = prompt.questionEn;
const ANSWER_PLACEHOLDER = "영어로 답안을 써 보세요.";
const SUBMIT_INITIAL = "피드백 받기";
const CANCEL_TITLE = "작문을 취소할까요?";

// 서버가 돌려주는 초안 저장 시각(이 기기 시간대의 16:30)
const DRAFT_SAVED_AT_2 = new Date(2026, 10, 1, 16, 30).toISOString();

const LIST_ROUTE_A = { pathname: "/practice/[difficulty]", params: { difficulty: "A" } };
const FEEDBACK_ROUTE = { pathname: "/practice/feedback", params: { difficulty: "A", promptId: "prompt-1" } };

function recommendation(prompts: Prompt[] = [prompt, prompt2, prompt3]): DailyPromptRecommendation {
  return { recommendedDate: "2026-11-01", difficulty: "A", prompts };
}

function makeFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    promptId: "prompt-1",
    sessionId: "session-1",
    attemptNo: 1,
    loopComplete: false,
    completionMessage: null,
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: null,
    modelAnswer: "",
    rewriteChallenge: "",
    ...overrides
  };
}

const coachMove = {
  focus: "이유를 한 문장 더해 보세요",
  instruction: "because로 이유를 붙여 다시 써 보세요.",
  before: "I wake up early.",
  after: "I wake up early because I have class."
};

function coachFeedback(): Feedback {
  return makeFeedback({
    coachMove,
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "아침 일과를 분명하게 말했어요.",
      coachMove
    }
  });
}

const nextCoachMove = { focus: "시간 표현을 더해 보세요", instruction: "every morning을 넣어 다시 써 보세요." };

// 제출에 성공했을 때 서버가 돌려주는 피드백
function nextFeedback(): Feedback {
  return makeFeedback({
    sessionId: "session-9",
    coachMove: nextCoachMove,
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "커피 이야기를 분명하게 했어요.",
      coachMove: nextCoachMove
    }
  });
}

function savedState(): PracticeFeedbackState {
  return {
    difficulty: "A",
    prompt,
    initialAnswer: "I wake up.",
    answer: "I wake up early.",
    feedback: coachFeedback()
  };
}

function answerPayload(text: string): SaveWritingDraftRequest {
  return {
    draftType: "ANSWER",
    selectedDifficulty: "A",
    sessionId: "",
    answer: text,
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer"
  };
}

function rewritePayload(text: string): SaveWritingDraftRequest {
  return {
    draftType: "REWRITE",
    selectedDifficulty: "A",
    sessionId: "session-1",
    answer: "I wake up early.",
    rewrite: text,
    lastSubmittedAnswer: "I wake up early.",
    feedback: null,
    step: "rewrite"
  };
}

// ---------- 메모리 저장소(서버 초안, 이 기기 초안, 이어 쓰기 상태) ----------

let serverDrafts = new Map<string, SaveWritingDraftRequest>();
let localDrafts = new Map<string, WritingDraft>();
let storedIncompleteLoop: IncompleteLoopState | null = null;

function draftKey(promptId: string, draftType: WritingDraftType) {
  return `${promptId}:${draftType}`;
}

// 취소·제출 앞의 부른 기록만 지운다(저장소 내용과 가짜 동작은 그대로 둔다).
function clearStorageCalls() {
  jest.mocked(saveWritingDraft).mockClear();
  jest.mocked(deleteWritingDraft).mockClear();
  jest.mocked(saveLocalWritingDraft).mockClear();
  jest.mocked(deleteLocalWritingDraft).mockClear();
  jest.mocked(saveIncompleteLoop).mockClear();
  jest.mocked(clearIncompleteLoopForPrompt).mockClear();
}

// ---------- 도우미 ----------

type WriteParams = {
  difficulty?: string;
  promptId?: string;
  mode?: string;
  resume?: string;
};

const navigation = { canGoBack: jest.fn(), goBack: jest.fn() };
const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let keyboardDismissSpy: jest.SpyInstance;

function setParams(params: WriteParams) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
}

function setSessionUser(currentUser: AuthUser | null) {
  jest.mocked(useSession).mockReturnValue({
    currentUser,
    isHydrating: false,
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
  for (let index = 0; index < 8; index += 1) {
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

// 질문을 불러온 화면까지 그린다.
async function renderLoaded() {
  await render(<PracticeWriteScreen />);
  await flushAsync();
  expect(screen.getByText(QUESTION_EN)).toBeOnTheScreen();
}

function answerInput() {
  return screen.getByPlaceholderText(ANSWER_PLACEHOLDER, { includeHiddenElements: true });
}

async function typeAnswer(text: string) {
  await fireEvent.changeText(answerInput(), text);
}

// 작문 취소를 누르고, 확인 창에서 "작문 취소"를 확정한다.
async function confirmCancelWriting() {
  await fireEvent.press(screen.getByRole("button", { name: "작문 취소" }));
  expect(alertSpy).toHaveBeenCalledTimes(1);
  const [title, , buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
  expect(title).toBe(CANCEL_TITLE);
  await act(async () => {
    buttons.find((button) => button.text === "작문 취소")!.onPress!();
  });
  await flushAsync();
}

// 화면이 실제로 사라지게 하고, 남은 타이머가 있으면 다 돌린다.
async function unmountAndWait() {
  await screen.unmount();
  await flushAsync();
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  await flushAsync();
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  clearPracticeFeedbackState();
  setParams({ difficulty: "A", promptId: "prompt-1" });
  navigation.canGoBack.mockReset().mockReturnValue(true);
  navigation.goBack.mockReset();
  jest.mocked(useNavigation).mockReset().mockReturnValue(navigation as unknown as ReturnType<typeof useNavigation>);
  jest.mocked(useIsFocused).mockReset().mockReturnValue(true);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(randomUUID).mockReset().mockReturnValue("uuid-1");
  jest.mocked(getDailyPrompts).mockReset().mockResolvedValue(recommendation());
  jest.mocked(getPrompts).mockReset().mockResolvedValue([]);
  jest.mocked(getPromptHints).mockReset().mockResolvedValue([]);
  jest.mocked(getWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(getLocalWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(requestCoachHelp).mockReset();
  jest.mocked(saveExpression).mockReset();
  jest.mocked(submitFeedback).mockReset();
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue(GUEST_ID);
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);

  serverDrafts = new Map();
  localDrafts = new Map();
  storedIncompleteLoop = null;
  jest.mocked(saveWritingDraft).mockReset().mockImplementation((promptId, request) => {
    serverDrafts.set(draftKey(promptId, request.draftType), request);
    return Promise.resolve({ promptId, ...request, updatedAt: DRAFT_SAVED_AT_2 });
  });
  jest.mocked(deleteWritingDraft).mockReset().mockImplementation((promptId, draftType) => {
    serverDrafts.delete(draftKey(promptId, draftType));
    return Promise.resolve();
  });
  jest.mocked(saveLocalWritingDraft).mockReset().mockImplementation((draft) => {
    localDrafts.set(draftKey(draft.promptId, draft.draftType), draft);
    return Promise.resolve();
  });
  jest.mocked(deleteLocalWritingDraft).mockReset().mockImplementation((promptId, draftType) => {
    localDrafts.delete(draftKey(promptId, draftType));
    return Promise.resolve();
  });
  jest.mocked(saveIncompleteLoop).mockReset().mockImplementation((state) => {
    storedIncompleteLoop = state;
    return Promise.resolve();
  });
  jest.mocked(clearIncompleteLoopForPrompt).mockReset().mockImplementation((promptId, step) => {
    if (storedIncompleteLoop && storedIncompleteLoop.promptId === promptId && (!step || storedIncompleteLoop.step === step)) {
      storedIncompleteLoop = null;
    }
    return Promise.resolve();
  });

  jest.mocked(AppState.addEventListener).mockReset().mockImplementation(() => ({ remove: jest.fn() }));
  refreshSession.mockReset().mockResolvedValue(null);
  setSessionUser(signedInUser);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  keyboardDismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  keyboardDismissSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 작문 취소 ----------

describe("[spec] 작문 취소를 확정하면 쓰던 답과 임시저장이 남지 않는다", () => {
  it("[spec] 로그인 사용자: 임시저장된 답을 두고 취소하면 서버·이 기기 초안과 이어 쓰기 상태가 남지 않고, 화면이 사라진 뒤에도 쓰던 답을 다시 저장하지 않는다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await advance(900);
    // 준비: 자동 임시저장으로 서버 초안과 답 쓰기 단계의 이어 쓰기 상태가 있다.
    expect(Object.fromEntries(serverDrafts)).toEqual({ "prompt-1:ANSWER": answerPayload("I drink coffee.") });
    expect(storedIncompleteLoop).toEqual(expect.objectContaining({ promptId: "prompt-1", step: "answer" }));
    clearStorageCalls();

    await confirmCancelWriting();

    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expect(answerInput()).toHaveDisplayValue("");
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();

    await unmountAndWait();

    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
  });

  it("[spec] 게스트: 임시저장된 답을 두고 취소하면 이 기기 초안과 이어 쓰기 상태가 남지 않고, 화면이 사라진 뒤에도 쓰던 답을 다시 저장하지 않는다", async () => {
    setSessionUser(null);
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await advance(900);
    // 준비: 자동 임시저장으로 이 기기 초안과 답 쓰기 단계의 이어 쓰기 상태가 있다.
    expect(Object.fromEntries(localDrafts)).toEqual({
      "prompt-1:ANSWER": { promptId: "prompt-1", updatedAt: at(900), ...answerPayload("I drink coffee.") }
    });
    expect(storedIncompleteLoop).toEqual(expect.objectContaining({ promptId: "prompt-1", step: "answer" }));
    clearStorageCalls();

    await confirmCancelWriting();

    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expect(answerInput()).toHaveDisplayValue("");
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();

    await unmountAndWait();

    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
  });

  it("[spec] 임시저장 전(입력 300ms 뒤)에 취소해도 기다리던 자동 저장과 화면이 사라질 때를 포함해 쓰던 답을 저장하지 않는다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await advance(300);
    expect(saveWritingDraft).not.toHaveBeenCalled();

    await confirmCancelWriting();
    await advance(5000);

    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();

    await unmountAndWait();

    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
  });

  it("[spec] 다시 쓰기: 임시저장된 다시 쓴 글을 두고 취소하면 다시 쓰기 초안과 이어 쓰기 상태가 남지 않고, 화면이 사라진 뒤에도 다시 저장하지 않는다", async () => {
    setSessionUser(null);
    savePracticeFeedbackState(savedState());
    setParams({ difficulty: "A", promptId: "prompt-1", mode: "rewrite" });
    await renderLoaded();
    await typeAnswer("I wake up early because I have class.");
    await advance(900);
    // 준비: 자동 임시저장으로 이 기기 다시 쓰기 초안과 다시 쓰기 단계의 이어 쓰기 상태가 있다.
    expect(Object.fromEntries(localDrafts)).toEqual({
      "prompt-1:REWRITE": { promptId: "prompt-1", updatedAt: at(900), ...rewritePayload("I wake up early because I have class.") }
    });
    expect(storedIncompleteLoop).toEqual(expect.objectContaining({ promptId: "prompt-1", step: "rewrite" }));
    clearStorageCalls();

    await confirmCancelWriting();

    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expect(answerInput()).toHaveDisplayValue("");
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();

    await unmountAndWait();

    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toBeNull();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
  });
});

// ---------- 제출 ----------

describe("[spec] 제출할 때 쓰던 답을 한 번 더 저장하지 않는다", () => {
  it("[spec] 로그인 사용자: 임시저장된 답을 제출하면 제출하는 동안 다시 저장하지 않고, 성공하면 초안은 남지 않고 이어 쓰기 상태는 피드백 단계가 된다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await advance(900);
    // 준비: 자동 임시저장이 한 번 돌았다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    clearStorageCalls();

    const pending = deferred<Feedback>();
    jest.mocked(submitFeedback).mockReturnValueOnce(pending.promise);
    await fireEvent.press(screen.getByText(SUBMIT_INITIAL));
    await flushAsync();

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve(nextFeedback());
    });
    await flushAsync();

    expect(router.push).toHaveBeenCalledWith(FEEDBACK_ROUTE);
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toEqual({
      promptId: "prompt-1",
      difficulty: "A",
      step: "feedback",
      draftType: null,
      sessionId: "session-9",
      updatedAt: at(900),
      promptSnapshot
    });
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
  });
});
