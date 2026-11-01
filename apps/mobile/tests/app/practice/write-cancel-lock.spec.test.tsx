// [spec] qa 재현 테스트(작업 046 버그 수정: 작문 취소를 확정한 뒤 질문 목록으로 돌아갈 때까지 버튼과 답 칸이 그대로라
// 피드백 받기·작문 취소를 다시 누르거나 답을 칠 수 있는 버그).
// 작문 화면(src/app/practice/write.tsx) 전체를 렌더하고 사용자처럼 눌러, 명세의 고칠 동작을 확인한다.
// - 취소를 확정한 뒤 질문 목록으로 돌아갈 때까지 '피드백 받기'와 '작문 취소' 버튼을 막는다(제출 중과 같은 흐린 모양).
// - '작문 취소' 버튼에 돌아가는 표시를 넣는다.
// - 답 칸도 입력을 막는다.
// - 취소가 끝나면 지금처럼 질문 목록으로 간다.
// 취소가 기다리는 진행 중인 저장(서버 초안 저장) 또는 지우기 요청(서버 초안 지우기)을 끝나지 않은 약속으로 붙잡아 두고
// 취소를 확정한 뒤, 버튼·답 칸 상태와 그 사이 누르기·입력의 결과를 본다. 끝으로 붙잡은 요청을 끝내 질문 목록으로 가는지 본다.
// 서버 초안·이 기기 초안·이어 쓰기 상태는 메모리 저장소로 대신한다. 붙잡아 둔 요청은 끝내는 순간 저장소에 반영하고,
// 붙잡지 않은 저장·지우기는 부르는 순간 반영한다.
// 가짜로 두는 것은 write.spec.test.tsx와 같다: API, 기기 저장소, 로그인 상태, 라우터·내비게이션, expo-crypto.
// 03-main-decision.md로 범위에 넣은 두 경우(확인 창 없이 바로 도는 취소, 취소 중 AI 코치 '문장에 넣기')도 확인한다.
// 임시저장 타이머(900ms)가 저절로 돌지 않게 가짜 시계로 돌린다(시각 2026-11-02T06:00:00Z에서 멈춤).
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, AppState, Keyboard, StyleSheet } from "react-native";
import PracticeWriteScreen from "@/app/practice/write";
import { styles } from "@/components/practice-write/write-styles";
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
import { clearPracticeFeedbackState, hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  CoachHelpResponse,
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

const NOW = new Date("2026-11-02T06:00:00.000Z");

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

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };
const GUEST_ID = "guest-device-0123456789abcdef";

const QUESTION_EN = prompt.questionEn;
const ANSWER_PLACEHOLDER = "영어로 답안을 써 보세요.";
const SUBMIT_INITIAL = "피드백 받기";
const CANCEL_LABEL = "작문 취소";
const CANCEL_TITLE = "작문을 취소할까요?";
const EMPTY_ANSWER_ERROR = "영어 답안을 입력해 주세요.";
const COACH_PLACEHOLDER = '예: "근력을 키우고 싶다"를 어떻게 말해?';
const COACH_REQUEST = "표현 추천받기";
const COACH_REPLY = "운동 목표는 이렇게 말해 보세요.";
const COACH_INSERT = "문장에 넣기";

const ANSWER_TEXT = "I drink coffee.";
// 취소를 확정한 뒤 답 칸에 치려는 글
const TYPED_DURING_CANCEL = "I drink coffee every morning.";

const DRAFT_SAVED_AT = new Date(2026, 10, 2, 16, 30).toISOString();

// 코치가 추천하는 표현과, 쓰던 답에 '문장에 넣기'로 붙였을 때의 답
const COACH_EXPRESSION = "build muscle";
const ANSWER_WITH_COACH_EXPRESSION = "I drink coffee. build muscle";

function coachHelp(): CoachHelpResponse {
  return {
    promptId: "prompt-1",
    userQuestion: "근력을 키우고 싶다",
    coachReply: COACH_REPLY,
    expressions: [
      {
        id: "exp-1",
        expression: COACH_EXPRESSION,
        meaningKo: "근육을 키우다",
        usageTip: "운동 목표를 말할 때 써요.",
        example: "I want to build muscle.",
        tags: ["운동"]
      }
    ],
    interactionId: "interaction-1"
  };
}

const LIST_ROUTE_A = { pathname: "/practice/[difficulty]", params: { difficulty: "A" } };

// 제출 중 버튼과 같은 흐린 모양
const DISABLED_LOOK = StyleSheet.flatten(styles.disabledButton);

function recommendation(prompts: Prompt[] = [prompt]): DailyPromptRecommendation {
  return { recommendedDate: "2026-11-02", difficulty: "A", prompts };
}

function nextFeedback(): Feedback {
  return {
    promptId: "prompt-1",
    sessionId: "session-9",
    attemptNo: 1,
    loopComplete: false,
    completionMessage: null,
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: null,
    modelAnswer: "",
    rewriteChallenge: ""
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

// ---------- 메모리 저장소(서버 초안, 이 기기 초안, 이어 쓰기 상태) ----------

let serverDrafts = new Map<string, SaveWritingDraftRequest>();
let localDrafts = new Map<string, WritingDraft>();
let storedIncompleteLoop: IncompleteLoopState | null = null;

function draftKey(promptId: string, draftType: WritingDraftType) {
  return `${promptId}:${draftType}`;
}

function expectNothingLeft() {
  expect(Object.fromEntries(serverDrafts)).toEqual({});
  expect(Object.fromEntries(localDrafts)).toEqual({});
  expect(storedIncompleteLoop).toBeNull();
}

// ---------- 붙잡아 두는 요청(끝내기 전까지 약속이 끝나지 않고, 끝내는 순간 저장소에 반영한다) ----------

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// 다음 서버 초안 저장 한 번
function holdNextServerSave() {
  const gate = deferred<void>();
  jest.mocked(saveWritingDraft).mockImplementationOnce(async (promptId, request) => {
    await gate.promise;
    serverDrafts.set(draftKey(promptId, request.draftType), request);
    return { promptId, ...request, updatedAt: DRAFT_SAVED_AT };
  });
  return { finish: () => gate.resolve() };
}

// 다음 서버 초안 지우기 한 번
function holdNextServerDelete() {
  const gate = deferred<void>();
  jest.mocked(deleteWritingDraft).mockImplementationOnce(async (promptId, draftType) => {
    await gate.promise;
    serverDrafts.delete(draftKey(promptId, draftType));
  });
  return { finish: () => gate.resolve() };
}

// ---------- 도우미 ----------

const navigation = { canGoBack: jest.fn(), goBack: jest.fn() };
const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let keyboardDismissSpy: jest.SpyInstance;

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

async function renderLoaded() {
  await render(<PracticeWriteScreen />);
  await flushAsync();
  expect(screen.getByText(QUESTION_EN)).toBeOnTheScreen();
}

function answerInput() {
  return screen.getByPlaceholderText(ANSWER_PLACEHOLDER, { includeHiddenElements: true });
}

function cancelButton() {
  return screen.getByRole("button", { name: CANCEL_LABEL, includeHiddenElements: true });
}

// '피드백 받기' 글자를 품은 버튼(Pressable)
function submitButton() {
  return screen.getByText(SUBMIT_INITIAL, { includeHiddenElements: true }).parent!;
}

async function typeAnswer(text: string) {
  await fireEvent.changeText(answerInput(), text);
}

// 작문 취소를 누르고, 확인 창에서 "작문 취소"를 확정한다.
async function confirmCancelWriting() {
  await fireEvent.press(cancelButton());
  expect(alertSpy).toHaveBeenCalledTimes(1);
  const [title, , buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; onPress?: () => void }[]];
  expect(title).toBe(CANCEL_TITLE);
  await act(async () => {
    buttons.find((button) => button.text === CANCEL_LABEL)!.onPress!();
  });
  await flushAsync();
}

async function release(finish: () => void) {
  await act(async () => {
    finish();
  });
  await flushAsync();
}

async function unmountAndWait() {
  await screen.unmount();
  await flushAsync();
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  await flushAsync();
}

// AI 코치 창을 열어 표현을 추천받고 창을 닫는다(코치 답변은 창을 닫아도 남는다).
async function askCoachAndClose() {
  await fireEvent.press(screen.getByRole("button", { name: "AI 코치 열기" }));
  await fireEvent.changeText(screen.getByPlaceholderText(COACH_PLACEHOLDER), "근력을 키우고 싶다");
  await fireEvent.press(screen.getByText(COACH_REQUEST));
  await flushAsync();
  expect(screen.getByText(COACH_REPLY)).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("닫기"));
  await flushAsync();
  expect(screen.queryByText(COACH_REPLY)).toBeNull();
}

// 취소가 도는 동안 AI 코치 창을 다시 열고 '문장에 넣기'를 누른다.
async function insertCoachExpressionDuringCancel() {
  await fireEvent.press(screen.getByRole("button", { name: "AI 코치 열기", includeHiddenElements: true }));
  await flushAsync();
  expect(screen.getByText(COACH_REPLY)).toBeOnTheScreen();
  await fireEvent.press(screen.getByText(COACH_INSERT));
  await flushAsync();
}

// 답·임시저장 배지·피드백이 모두 없는 화면에서 작문 취소를 누르면 확인 창 없이 바로 취소가 돈다.
// 서버 초안 지우기 요청을 붙잡아 두어 취소가 그 응답을 기다리게 한다.
async function cancelWithoutConfirmWhileDeleteInFlight() {
  await renderLoaded();
  expect(answerInput()).toHaveDisplayValue("");
  const remove = holdNextServerDelete();

  await fireEvent.press(cancelButton());
  await flushAsync();
  // 준비: 확인 창 없이 취소가 시작돼 서버 초안 지우기 응답을 기다리고 있고, 아직 질문 목록으로 가지 않았다.
  expect(alertSpy).not.toHaveBeenCalled();
  expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
  expect(deleteWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
  expect(router.replace).not.toHaveBeenCalled();
  return remove;
}

// 답을 쓰고, 900ms 자동 임시저장이 서버 저장 요청을 보냈지만 아직 끝나지 않은 상태에서 취소를 확정한다.
async function confirmCancelWhileSaveInFlight(prepare?: () => Promise<void>) {
  await renderLoaded();
  await prepare?.();
  const save = holdNextServerSave();
  await typeAnswer(ANSWER_TEXT);
  await advance(900);
  // 준비: 서버 저장 요청이 진행 중이다.
  expect(saveWritingDraft).toHaveBeenCalledTimes(1);
  expect(saveWritingDraft).toHaveBeenCalledWith("prompt-1", answerPayload(ANSWER_TEXT));
  expect(Object.fromEntries(serverDrafts)).toEqual({});

  await confirmCancelWriting();
  // 준비: 취소가 진행 중인 저장을 기다리고 있어 아직 지우지도, 질문 목록으로 가지도 않았다.
  expect(deleteWritingDraft).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  return save;
}

// 답을 쓰고 자동 임시저장이 끝난 뒤, 서버 초안 지우기 요청을 붙잡아 둔 채 취소를 확정한다.
async function confirmCancelWhileDeleteInFlight(prepare?: () => Promise<void>) {
  await renderLoaded();
  await prepare?.();
  await typeAnswer(ANSWER_TEXT);
  await advance(900);
  // 준비: 서버 초안과 답 쓰기 단계의 이어 쓰기 상태가 저장됐다.
  expect(saveWritingDraft).toHaveBeenCalledTimes(1);
  expect(Object.fromEntries(serverDrafts)).toEqual({ "prompt-1:ANSWER": answerPayload(ANSWER_TEXT) });
  expect(storedIncompleteLoop).toEqual(expect.objectContaining({ promptId: "prompt-1", step: "answer" }));

  const remove = holdNextServerDelete();
  await confirmCancelWriting();
  // 준비: 취소가 서버 초안 지우기 응답을 기다리고 있어 아직 질문 목록으로 가지 않았다.
  expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
  expect(deleteWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
  expect(router.replace).not.toHaveBeenCalled();
  return remove;
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  clearPracticeFeedbackState();
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ difficulty: "A", promptId: "prompt-1" } as unknown as ReturnType<typeof useLocalSearchParams>);
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
  // 제출이 나가면 바로 피드백을 돌려준다(그 사이 제출이 나가는지 보려고).
  jest.mocked(submitFeedback).mockReset().mockResolvedValue(nextFeedback());
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue(GUEST_ID);
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);

  serverDrafts = new Map();
  localDrafts = new Map();
  storedIncompleteLoop = null;
  jest.mocked(saveWritingDraft).mockReset().mockImplementation((promptId, request) => {
    serverDrafts.set(draftKey(promptId, request.draftType), request);
    return Promise.resolve({ promptId, ...request, updatedAt: DRAFT_SAVED_AT });
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

// ---------- 진행 중인 저장을 기다리는 동안 ----------

describe("[spec] 작문 취소를 확정하고 진행 중인 임시저장(서버 저장 응답)을 기다리는 동안", () => {
  it("[spec] 피드백 받기·작문 취소 버튼이 막혀 흐린 모양이 되고, 작문 취소 버튼에 돌아가는 표시가 있으며, 답 칸이 입력을 막는다. 끝나면 질문 목록으로 간다", async () => {
    const save = await confirmCancelWhileSaveInFlight();

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveStyle(DISABLED_LOOK);
    expect(cancelButton()).toBeDisabled();
    expect(cancelButton()).toHaveStyle(DISABLED_LOOK);
    expect(cancelButton().queryAll((instance) => instance.type === "ActivityIndicator")).toHaveLength(1);
    expect(answerInput()).toBeDisabled();

    await release(save.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 피드백 받기를 눌러도 제출이 나가지 않고, 끝나면 피드백 화면이 아니라 질문 목록으로 간다", async () => {
    const save = await confirmCancelWhileSaveInFlight();

    await fireEvent.press(screen.getByText(SUBMIT_INITIAL, { includeHiddenElements: true }));
    await flushAsync();

    expect(submitFeedback).not.toHaveBeenCalled();

    await release(save.finish);

    expect(submitFeedback).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 작문 취소를 다시 눌러도 확인 창이 다시 뜨지 않고 취소가 한 번만 돈다", async () => {
    const save = await confirmCancelWhileSaveInFlight();

    await fireEvent.press(cancelButton());
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledTimes(1);

    await release(save.finish);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
    // 이 기기 초안 지우기: 늦게 끝난 첫 저장의 서버 저장 뒤 한 번, 취소에서 한 번
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(2);
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 답 칸에 글을 쳐도 들어가지 않고 임시저장이 다시 돌지 않으며, 끝나면 질문 목록으로 가고 초안이 남지 않는다", async () => {
    const save = await confirmCancelWhileSaveInFlight();

    await typeAnswer(TYPED_DURING_CANCEL);
    await advance(900);

    // 붙잡아 둔 첫 저장 말고는 저장 요청이 나가지 않는다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(answerInput()).not.toHaveDisplayValue(TYPED_DURING_CANCEL);

    await release(save.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).not.toHaveBeenCalledWith("prompt-1", answerPayload(TYPED_DURING_CANCEL));
    expectNothingLeft();
  });
});

// ---------- 지우기 요청을 기다리는 동안 ----------

describe("[spec] 작문 취소를 확정하고 서버 초안 지우기 응답을 기다리는 동안", () => {
  it("[spec] 피드백 받기·작문 취소 버튼이 막혀 흐린 모양이 되고, 작문 취소 버튼에 돌아가는 표시가 있으며, 답 칸이 입력을 막는다. 끝나면 질문 목록으로 간다", async () => {
    const remove = await confirmCancelWhileDeleteInFlight();

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveStyle(DISABLED_LOOK);
    expect(cancelButton()).toBeDisabled();
    expect(cancelButton()).toHaveStyle(DISABLED_LOOK);
    expect(cancelButton().queryAll((instance) => instance.type === "ActivityIndicator")).toHaveLength(1);
    expect(answerInput()).toBeDisabled();

    await release(remove.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 피드백 받기를 눌러도 제출이 나가지 않고, 끝나면 피드백 화면이 아니라 질문 목록으로 간다", async () => {
    const remove = await confirmCancelWhileDeleteInFlight();

    await fireEvent.press(screen.getByText(SUBMIT_INITIAL, { includeHiddenElements: true }));
    await flushAsync();

    expect(submitFeedback).not.toHaveBeenCalled();

    await release(remove.finish);

    expect(submitFeedback).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 작문 취소를 다시 눌러도 확인 창이 다시 뜨지 않고 취소가 한 번만 돈다", async () => {
    const remove = await confirmCancelWhileDeleteInFlight();

    await fireEvent.press(cancelButton());
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledTimes(1);

    await release(remove.finish);

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
    // 이 기기 초안 지우기: 취소 전 첫 저장의 서버 저장 뒤 한 번, 취소에서 한 번
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(2);
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 답 칸에 글을 쳐도 들어가지 않고 임시저장이 다시 돌지 않으며, 끝나면 질문 목록으로 가고 초안이 남지 않는다", async () => {
    const remove = await confirmCancelWhileDeleteInFlight();

    await typeAnswer(TYPED_DURING_CANCEL);
    await advance(900);

    // 취소 전에 끝난 첫 저장 말고는 저장 요청이 나가지 않는다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(answerInput()).not.toHaveDisplayValue(TYPED_DURING_CANCEL);

    await release(remove.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).not.toHaveBeenCalledWith("prompt-1", answerPayload(TYPED_DURING_CANCEL));
    expectNothingLeft();
  });
});

// ---------- 확인 창 없이 바로 도는 취소(03-main-decision.md 1) ----------

describe("[spec] 확인 창 없이 바로 도는 작문 취소가 서버 초안 지우기 응답을 기다리는 동안", () => {
  it("[spec] 피드백 받기·작문 취소 버튼이 막혀 흐린 모양이 되고, 작문 취소 버튼에 돌아가는 표시가 있으며, 답 칸이 입력을 막는다. 끝나면 질문 목록으로 간다", async () => {
    const remove = await cancelWithoutConfirmWhileDeleteInFlight();

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveStyle(DISABLED_LOOK);
    expect(cancelButton()).toBeDisabled();
    expect(cancelButton()).toHaveStyle(DISABLED_LOOK);
    expect(cancelButton().queryAll((instance) => instance.type === "ActivityIndicator")).toHaveLength(1);
    expect(answerInput()).toBeDisabled();

    await release(remove.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 피드백 받기를 눌러도 아무 일도 없고(빈 답 오류도 뜨지 않음), 끝나면 질문 목록으로 간다", async () => {
    const remove = await cancelWithoutConfirmWhileDeleteInFlight();

    await fireEvent.press(screen.getByText(SUBMIT_INITIAL, { includeHiddenElements: true }));
    await flushAsync();

    expect(screen.queryByText(EMPTY_ANSWER_ERROR, { includeHiddenElements: true })).toBeNull();
    expect(submitFeedback).not.toHaveBeenCalled();

    await release(remove.finish);

    expect(submitFeedback).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 작문 취소를 다시 눌러도 취소가 한 번만 돈다", async () => {
    const remove = await cancelWithoutConfirmWhileDeleteInFlight();

    await fireEvent.press(cancelButton());
    await flushAsync();

    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);

    await release(remove.finish);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();
  });

  it("[spec] 답 칸에 글을 쳐도 들어가지 않고 임시저장이 다시 돌지 않으며, 끝나면 질문 목록으로 가고 초안이 남지 않는다", async () => {
    const remove = await cancelWithoutConfirmWhileDeleteInFlight();

    await typeAnswer(TYPED_DURING_CANCEL);
    await advance(900);

    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(answerInput()).not.toHaveDisplayValue(TYPED_DURING_CANCEL);

    await release(remove.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expect(saveWritingDraft).not.toHaveBeenCalled();
    expectNothingLeft();
  });
});

// ---------- 취소 중 AI 코치 '문장에 넣기'(03-main-decision.md 2) ----------

describe("[spec] 작문 취소가 도는 동안 AI 코치 '문장에 넣기'를 누르면", () => {
  beforeEach(() => {
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
  });

  it("[spec] 진행 중인 임시저장을 기다리는 동안: 답에 넣지 않고 임시저장도 다시 돌지 않으며, 끝나면 질문 목록으로 가고 초안이 남지 않는다", async () => {
    const save = await confirmCancelWhileSaveInFlight(askCoachAndClose);

    await insertCoachExpressionDuringCancel();
    await advance(900);

    // 붙잡아 둔 첫 저장 말고는 저장 요청이 나가지 않는다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(answerInput()).not.toHaveDisplayValue(ANSWER_WITH_COACH_EXPRESSION);

    await release(save.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).not.toHaveBeenCalledWith("prompt-1", answerPayload(ANSWER_WITH_COACH_EXPRESSION));
    expectNothingLeft();
  });

  it("[spec] 서버 초안 지우기 응답을 기다리는 동안: 답에 넣지 않고 임시저장도 다시 돌지 않으며, 끝나면 질문 목록으로 가고 초안이 남지 않는다", async () => {
    const remove = await confirmCancelWhileDeleteInFlight(askCoachAndClose);

    await insertCoachExpressionDuringCancel();
    await advance(900);

    // 취소 전에 끝난 첫 저장 말고는 저장 요청이 나가지 않는다.
    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(answerInput()).not.toHaveDisplayValue(ANSWER_WITH_COACH_EXPRESSION);

    await release(remove.finish);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expectNothingLeft();

    await unmountAndWait();

    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).not.toHaveBeenCalledWith("prompt-1", answerPayload(ANSWER_WITH_COACH_EXPRESSION));
    expectNothingLeft();
  });
});
