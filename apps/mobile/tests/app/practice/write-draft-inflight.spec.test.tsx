// [spec] qa 재현 테스트(작업 043 버그 수정: 진행 중인 임시저장이 작문 취소·제출 뒤에 늦게 끝나 초안과 이어 쓰기 상태를 남기는 버그).
// 작문 화면(src/app/practice/write.tsx) 전체를 렌더하고 사용자처럼 눌러, 명세의 고칠 동작을 확인한다.
// - 작문 취소와 제출은 진행 중인 임시저장(서버 저장, 실패 시 기기 저장, 이어 쓰기 상태 저장)이 끝날 때까지 기다린 뒤 지운다.
// - 그래서 늦게 끝난 저장이 아무것도 남기지 않는다(로그인 사용자: 서버 초안·이 기기 초안·작문 단계 이어 쓰기 상태. 게스트: 이 기기 초안·이어 쓰기 상태).
// 진행 중인 저장은 끝나지 않은 약속으로 붙잡아 두고, 취소·제출을 확정한 뒤 끝낸다.
// 서버 초안·이 기기 초안·이어 쓰기 상태는 메모리 저장소로 대신한다. 붙잡아 둔 저장은 끝내는 순간 저장소에 반영한다
// (저장 요청이 지우기 요청보다 늦게 서버·기기에 닿는 경우). 붙잡지 않은 저장·지우기는 부르는 순간 반영한다.
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

const ANSWER_TEXT = "I drink coffee.";
const REWRITE_TEXT = "I wake up early because I have class.";

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

// 제출에 성공한 뒤 남아야 하는 이어 쓰기 상태(피드백 단계). 제출 쪽의 지금 동작 그대로다.
const FEEDBACK_STEP_LOOP: IncompleteLoopState = {
  promptId: "prompt-1",
  difficulty: "A",
  step: "feedback",
  draftType: null,
  sessionId: "session-9",
  updatedAt: at(900),
  promptSnapshot
};

// ---------- 메모리 저장소(서버 초안, 이 기기 초안, 이어 쓰기 상태) ----------

let serverDrafts = new Map<string, SaveWritingDraftRequest>();
let localDrafts = new Map<string, WritingDraft>();
let storedIncompleteLoop: IncompleteLoopState | null = null;

function draftKey(promptId: string, draftType: WritingDraftType) {
  return `${promptId}:${draftType}`;
}

// ---------- 붙잡아 두는 저장(끝내기 전까지 약속이 끝나지 않고, 끝내는 순간 저장소에 반영한다) ----------

// 다음 서버 초안 저장 한 번. succeed()면 서버에 반영하고 저장 시각을 돌려주며, fail()이면 서버에 남기지 않고 실패한다.
function holdNextServerSave() {
  const gate = deferred<"ok" | "fail">();
  jest.mocked(saveWritingDraft).mockImplementationOnce(async (promptId, request) => {
    const outcome = await gate.promise;
    if (outcome === "fail") {
      throw new Error("서버 저장 실패");
    }
    serverDrafts.set(draftKey(promptId, request.draftType), request);
    return { promptId, ...request, updatedAt: DRAFT_SAVED_AT_2 };
  });
  return {
    succeed: () => gate.resolve("ok"),
    fail: () => gate.resolve("fail")
  };
}

// 다음 이 기기 초안 저장 한 번
function holdNextLocalSave() {
  const gate = deferred<void>();
  jest.mocked(saveLocalWritingDraft).mockImplementationOnce(async (draft) => {
    await gate.promise;
    localDrafts.set(draftKey(draft.promptId, draft.draftType), draft);
  });
  return { finish: () => gate.resolve() };
}

// 다음 이어 쓰기 상태 저장 한 번
function holdNextIncompleteLoopSave() {
  const gate = deferred<void>();
  jest.mocked(saveIncompleteLoop).mockImplementationOnce(async (state) => {
    await gate.promise;
    storedIncompleteLoop = state;
  });
  return { finish: () => gate.resolve() };
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
let appStateSubscriptions: { listener: (state: string) => void; removed: boolean }[] = [];

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

// 대기 중인 약속 사슬이 끝까지 돌게 한다(가짜 시계는 움직이지 않는다).
async function flushAsync() {
  for (let index = 0; index < 30; index += 1) {
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

async function emitAppState(state: string) {
  await act(async () => {
    appStateSubscriptions.filter((subscription) => !subscription.removed).forEach((subscription) => subscription.listener(state));
  });
  await flushAsync();
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

// 피드백 받기를 누르고, 서버가 피드백을 돌려준다(제출이 진행 중인 저장을 기다리는지와 관계없이 쓸 수 있게 응답을 미리 정해 둔다).
async function submitAndRespond() {
  const pending = deferred<Feedback>();
  jest.mocked(submitFeedback).mockReturnValueOnce(pending.promise);
  await fireEvent.press(screen.getByText(SUBMIT_INITIAL));
  await flushAsync();
  await act(async () => {
    pending.resolve(nextFeedback());
  });
  await flushAsync();
}

// 붙잡아 둔 저장을 끝낸다.
async function release(finish: () => void) {
  await act(async () => {
    finish();
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

  appStateSubscriptions = [];
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation((_type, listener) => {
    const subscription = { listener: listener as (state: string) => void, removed: false };
    appStateSubscriptions.push(subscription);
    return {
      remove: () => {
        subscription.removed = true;
      }
    };
  });
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

function expectNothingLeft() {
  expect(Object.fromEntries(serverDrafts)).toEqual({});
  expect(Object.fromEntries(localDrafts)).toEqual({});
  expect(storedIncompleteLoop).toBeNull();
}

// ---------- 작문 취소 ----------

describe("[spec] 작문 취소: 진행 중인 임시저장이 취소 뒤에 늦게 끝나도 아무것도 남지 않는다", () => {
  it("[spec] 로그인 사용자: 서버 저장 응답을 기다리는 사이 취소하고 저장이 늦게 성공해도 서버·이 기기 초안과 이어 쓰기 상태가 남지 않는다", async () => {
    await renderLoaded();
    const save = holdNextServerSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 900ms 자동 임시저장이 서버 저장 요청을 보냈고 아직 끝나지 않았다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).toHaveBeenCalledWith("prompt-1", answerPayload(ANSWER_TEXT));
    expectNothingLeft();

    await confirmCancelWriting();
    await release(save.succeed);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expectNothingLeft();
  });

  it("[spec] 로그인 사용자: 서버 저장 응답을 기다리는 사이 취소하고 저장이 늦게 실패해 이 기기에 저장하더라도 서버·이 기기 초안과 이어 쓰기 상태가 남지 않는다", async () => {
    await renderLoaded();
    const save = holdNextServerSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 서버 저장 요청이 진행 중이고, 이 기기 저장은 아직 하지 않았다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expectNothingLeft();

    await confirmCancelWriting();
    await release(save.fail);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expectNothingLeft();
  });

  it("[spec] 로그인 사용자: 서버 저장은 끝나고 이어 쓰기 상태 저장이 진행 중일 때 취소해도 서버·이 기기 초안과 이어 쓰기 상태가 남지 않는다", async () => {
    await renderLoaded();
    const loopSave = holdNextIncompleteLoopSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 서버 초안은 저장됐고, 이어 쓰기 상태 저장이 진행 중이다.
    expect(Object.fromEntries(serverDrafts)).toEqual({ "prompt-1:ANSWER": answerPayload(ANSWER_TEXT) });
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenCalledWith(expect.objectContaining({ promptId: "prompt-1", step: "answer" }));
    expect(storedIncompleteLoop).toBeNull();

    await confirmCancelWriting();
    await release(loopSave.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expectNothingLeft();
  });

  it("[spec] 게스트: 이 기기 저장이 진행 중일 때 취소하고 저장이 늦게 끝나도 이 기기 초안과 이어 쓰기 상태가 남지 않는다", async () => {
    setSessionUser(null);
    await renderLoaded();
    const save = holdNextLocalSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 900ms 자동 임시저장이 이 기기 저장을 시작했고 아직 끝나지 않았다.
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({ promptId: "prompt-1", updatedAt: at(900), ...answerPayload(ANSWER_TEXT) });
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expectNothingLeft();

    await confirmCancelWriting();
    await release(save.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expectNothingLeft();
  });

  it("[spec] 로그인 사용자의 다시 쓰기: 다시 쓰기 초안의 서버 저장을 기다리는 사이 취소하고 저장이 늦게 성공해도 다시 쓰기 초안과 이어 쓰기 상태가 남지 않는다", async () => {
    savePracticeFeedbackState(savedState());
    setParams({ difficulty: "A", promptId: "prompt-1", mode: "rewrite" });
    await renderLoaded();
    const save = holdNextServerSave();
    await typeAnswer(REWRITE_TEXT);
    await advance(900);
    // 준비: 다시 쓰기 초안의 서버 저장 요청이 진행 중이다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).toHaveBeenCalledWith("prompt-1", rewritePayload(REWRITE_TEXT));
    expectNothingLeft();

    await confirmCancelWriting();
    await release(save.succeed);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expectNothingLeft();
  });

  it("[spec] 로그인 사용자: 앱이 뒤로 갈 때 시작한 서버 저장을 기다리는 사이 돌아와 취소하고 저장이 늦게 성공해도 서버·이 기기 초안과 이어 쓰기 상태가 남지 않는다", async () => {
    await renderLoaded();
    const save = holdNextServerSave();
    await typeAnswer(ANSWER_TEXT);
    await emitAppState("background");
    // 준비: 앱이 뒤로 갈 때의 저장이 서버 저장 요청을 보냈고 아직 끝나지 않았다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).toHaveBeenCalledWith("prompt-1", answerPayload(ANSWER_TEXT));
    expectNothingLeft();
    await emitAppState("active");

    await confirmCancelWriting();
    await release(save.succeed);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expectNothingLeft();
  });
});

// ---------- 제출 ----------

describe("[spec] 제출: 진행 중인 임시저장이 제출 뒤에 늦게 끝나도 초안과 작문 단계 이어 쓰기 상태가 남지 않는다", () => {
  it("[spec] 로그인 사용자: 서버 저장 응답을 기다리는 사이 제출하고 저장이 피드백보다 늦게 성공해도 초안이 남지 않고 이어 쓰기 상태는 피드백 단계다", async () => {
    await renderLoaded();
    const save = holdNextServerSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 900ms 자동 임시저장이 서버 저장 요청을 보냈고 아직 끝나지 않았다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expectNothingLeft();

    await submitAndRespond();
    await release(save.succeed);

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(FEEDBACK_ROUTE);
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toEqual(FEEDBACK_STEP_LOOP);
  });

  it("[spec] 로그인 사용자: 서버 저장 응답을 기다리는 사이 제출하고 저장이 늦게 실패해 이 기기에 저장하더라도 초안이 남지 않고 이어 쓰기 상태는 피드백 단계다", async () => {
    await renderLoaded();
    const save = holdNextServerSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 서버 저장 요청이 진행 중이고, 이 기기 저장은 아직 하지 않았다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expectNothingLeft();

    await submitAndRespond();
    await release(save.fail);

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(FEEDBACK_ROUTE);
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toEqual(FEEDBACK_STEP_LOOP);
  });

  it("[spec] 로그인 사용자: 서버 저장은 끝나고 이어 쓰기 상태 저장이 진행 중일 때 제출해도 초안이 남지 않고 이어 쓰기 상태는 피드백 단계다", async () => {
    await renderLoaded();
    const loopSave = holdNextIncompleteLoopSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 서버 초안은 저장됐고, 이어 쓰기 상태(답 쓰기) 저장이 진행 중이다.
    expect(Object.fromEntries(serverDrafts)).toEqual({ "prompt-1:ANSWER": answerPayload(ANSWER_TEXT) });
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(storedIncompleteLoop).toBeNull();

    await submitAndRespond();
    await release(loopSave.finish);

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(FEEDBACK_ROUTE);
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toEqual(FEEDBACK_STEP_LOOP);
  });

  it("[spec] 게스트: 이 기기 저장이 진행 중일 때 제출하고 저장이 피드백보다 늦게 끝나도 이 기기 초안이 남지 않고 이어 쓰기 상태는 피드백 단계다", async () => {
    setSessionUser(null);
    await renderLoaded();
    const save = holdNextLocalSave();
    await typeAnswer(ANSWER_TEXT);
    await advance(900);
    // 준비: 900ms 자동 임시저장이 이 기기 저장을 시작했고 아직 끝나지 않았다.
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expectNothingLeft();

    await submitAndRespond();
    await release(save.finish);

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({ answer: ANSWER_TEXT, guestId: GUEST_ID }));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(FEEDBACK_ROUTE);
    expect(Object.fromEntries(serverDrafts)).toEqual({});
    expect(Object.fromEntries(localDrafts)).toEqual({});
    expect(storedIncompleteLoop).toEqual(FEEDBACK_STEP_LOOP);
  });
});
