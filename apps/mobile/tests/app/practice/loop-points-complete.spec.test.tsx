// [spec] qa 테스트(작업 086-④ 적립 알림, 새 기능, 모바일): 질문 답하기를 마친 완료 화면의 룹 적립 안내.
// 기대값은 시나리오(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/05-적립-알림/02-qa-scenarios-mobile.md 1절 Q1~Q11)와
// 결정 파일(04-main-decision.md 4번: 완료 직후 앱이 꺼졌다 다시 열려 완료 화면이 다시 그려지면 안내는 없다 → Q12)에서만 가져온다.
// 흐름: 피드백 화면(src/app/practice/feedback.tsx)에서 '루프 완료하기'를 누르고, 피드백 화면이 router.push로 넘긴 경로·params
// 그대로 완료 화면(src/app/practice/complete.tsx)을 이어서 렌더한다(같은 테스트 안이라 기기 메모리의 피드백 상태도 이어진다).
// 구현 코드는 화면·함수 이름과 부르는 방법을 알려고만 읽었다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(expo-secure-store, AsyncStorage, @/lib/writing-drafts, @/lib/incomplete-loop,
// 저장된 피드백 상태 불러오기), 게스트 아이디, 로그인 상태(@/lib/session), 라우터·내비게이션, 네이티브 모듈.
// 메모리의 피드백 상태(getPracticeFeedbackState·savePracticeFeedbackState)는 실제 모듈을 쓴다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Keyboard } from "react-native";
import PracticeCompleteScreen from "@/app/practice/complete";
import PracticeFeedbackScreen from "@/app/practice/feedback";
import {
  completeFeedbackSession,
  deleteSavedExpression,
  deleteWritingDraft,
  getDailyPrompts,
  getSavedExpressions,
  getTodayWritingStatus,
  saveExpression,
  submitFeedback
} from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { clearIncompleteLoop } from "@/lib/incomplete-loop";
import {
  clearPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, Feedback, FeedbackSessionStatus, Prompt } from "@/lib/types";
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
    deleteWritingDraft: jest.fn(),
    getDailyPrompts: jest.fn(),
    getSavedExpressions: jest.fn(),
    getTodayWritingStatus: jest.fn(),
    saveExpression: jest.fn(),
    submitFeedback: jest.fn()
  };
});
jest.mock("@/lib/guest-id", () => ({ getOrCreateGuestId: jest.fn() }));
jest.mock("@/lib/incomplete-loop", () => ({ clearIncompleteLoop: jest.fn() }));
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

const promptA: Prompt = {
  id: "prompt-a",
  topic: "Morning",
  topicCategory: "ROUTINE",
  topicDetail: "Morning routine",
  difficulty: "A",
  questionEn: "What do you usually do in the morning?",
  questionKo: "아침에 보통 무엇을 하나요?",
  tip: ""
};

const promptB: Prompt = {
  id: "prompt-b",
  topic: "Weekend",
  topicCategory: "ROUTINE",
  topicDetail: "Weekend",
  difficulty: "A",
  questionEn: "What do you like to do on weekends?",
  questionKo: "주말에 무엇을 하는 것을 좋아하나요?",
  tip: ""
};

const signedInUser: AuthUser = { id: 864, email: "loop-points@example.com", displayName: "학습자", admin: false };
const GUEST_ID = "guest-086-4";

// 시나리오 0절의 loopPoints 값
const Q_EARNED = { activity: "question", earned: 30, balance: 260, dailyLimitReached: false } as const;
const Q_LIMIT = { activity: "question", earned: 0, balance: 320, dailyLimitReached: true } as const;
const Q_NEITHER = { activity: "question", earned: 0, balance: 260, dailyLimitReached: false } as const;
const Q_EARNED_AND_LIMIT = { activity: "question", earned: 30, balance: 290, dailyLimitReached: true } as const;

const EARNED_30 = "+30룹 쌓였어요";
const LIMIT_QUESTION = "오늘 질문 답하기 룹은 다 모았어요";
const ANY_EARNED = /룹 쌓였어요/;
const ANY_LIMIT = /룹은 다 모았어요/;
const COMPLETION_HEADING = "루프를 완주했어요!";

function readyFeedback(prompt: Prompt, sessionId: string): Feedback {
  return {
    promptId: prompt.id,
    sessionId,
    attemptNo: 2,
    loopComplete: true,
    completionMessage: null,
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: null,
    modelAnswer: "",
    rewriteChallenge: "",
    visibleFeedback: {
      schemaVersion: 1,
      state: "READY_TO_FINISH",
      strength: "필요한 내용을 다 담았어요."
    }
  };
}

function readyState(prompt: Prompt, sessionId: string, overrides: Partial<PracticeFeedbackState> = {}): PracticeFeedbackState {
  return {
    difficulty: "A",
    prompt,
    initialAnswer: "I go school.",
    answer: "I go to school by bus.",
    feedback: readyFeedback(prompt, sessionId),
    ...overrides
  };
}

// ---------- 도우미 ----------

const navigation = { canGoBack: jest.fn(), goBack: jest.fn() };
const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let keyboardDismissSpy: jest.SpyInstance;

function setParams(params: Record<string, string>) {
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

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

type PushArg = { pathname: string; params: Record<string, string> };

// 피드백 화면에서 '루프 완료하기'를 누르고, 피드백 화면이 넘긴 push 인자를 돌려준다.
async function finishOnFeedbackScreen(prompt: Prompt, sessionId: string, response: unknown): Promise<PushArg> {
  jest.mocked(router.push).mockClear();
  jest.mocked(completeFeedbackSession).mockResolvedValueOnce(response as FeedbackSessionStatus);
  savePracticeFeedbackState(readyState(prompt, sessionId));
  setParams({ difficulty: "A", promptId: prompt.id });
  const view = await render(<PracticeFeedbackScreen />);
  await flushAsync();

  await fireEvent.press(screen.getByRole("button", { name: "루프 완료하기" }));
  await flushAsync();

  expect(completeFeedbackSession).toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledTimes(1);
  const pushArg = jest.mocked(router.push).mock.calls[0][0] as unknown as PushArg;
  await view.unmount();
  return pushArg;
}

// 피드백 화면이 넘긴 경로·params 그대로 완료 화면을 그린다.
async function openCompleteFrom(pushArg: PushArg) {
  expect(pushArg.pathname).toBe("/practice/complete");
  setParams(pushArg.params);
  const view = await render(<PracticeCompleteScreen />);
  await flushAsync();
  expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
  return view;
}

async function finishAndOpenComplete(prompt: Prompt, sessionId: string, response: unknown) {
  const pushArg = await finishOnFeedbackScreen(prompt, sessionId, response);
  return openCompleteFrom(pushArg);
}

function expectNoNotice() {
  expect(screen.queryAllByText(ANY_EARNED)).toHaveLength(0);
  expect(screen.queryAllByText(ANY_LIMIT)).toHaveLength(0);
}

beforeEach(() => {
  clearPracticeFeedbackState();
  navigation.canGoBack.mockReset().mockReturnValue(true);
  navigation.goBack.mockReset();
  jest.mocked(useNavigation).mockReset().mockReturnValue(navigation as unknown as ReturnType<typeof useNavigation>);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(randomUUID).mockReset().mockReturnValue("uuid-n");
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(saveExpression).mockReset();
  jest.mocked(deleteSavedExpression).mockReset();
  jest.mocked(submitFeedback).mockReset();
  jest.mocked(completeFeedbackSession).mockReset();
  jest.mocked(deleteWritingDraft).mockReset().mockResolvedValue(undefined as never);
  jest
    .mocked(getDailyPrompts)
    .mockReset()
    .mockResolvedValue({ prompts: [] } as unknown as Awaited<ReturnType<typeof getDailyPrompts>>);
  jest
    .mocked(getTodayWritingStatus)
    .mockReset()
    .mockResolvedValue(null as unknown as Awaited<ReturnType<typeof getTodayWritingStatus>>);
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue(GUEST_ID);
  jest.mocked(clearIncompleteLoop).mockReset().mockResolvedValue(undefined);
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);
  jest.mocked(getLocalWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  refreshSession.mockReset().mockResolvedValue(null);
  setSessionUser(signedInUser);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  keyboardDismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  keyboardDismissSpy.mockRestore();
});

// ---------- 1절 ----------

describe("[spec] 086-④ 질문 답하기 완료 화면의 룹 적립 안내(시나리오 1절)", () => {
  it("[spec] Q1 완료 응답이 적립 30이면 완료 화면에 '+30룹 쌓였어요'가 한 번 보이고 한도 문구는 없다", async () => {
    await finishAndOpenComplete(promptA, "session-a", { sessionId: "session-a", status: "COMPLETED", loopPoints: Q_EARNED });

    expect(screen.getAllByText(EARNED_30)).toHaveLength(1);
    expect(screen.queryAllByText(ANY_LIMIT)).toHaveLength(0);
  });

  it("[spec] Q2 완료 응답이 한도(적립 0)면 '오늘 질문 답하기 룹은 다 모았어요'가 보이고 적립 문구는 없다", async () => {
    await finishAndOpenComplete(promptA, "session-a", { sessionId: "session-a", status: "COMPLETED", loopPoints: Q_LIMIT });

    expect(screen.getByText(LIMIT_QUESTION)).toBeOnTheScreen();
    expect(screen.queryAllByText(ANY_EARNED)).toHaveLength(0);
  });

  it("[spec] Q3 완료 응답의 loopPoints가 null이면 안내가 없다", async () => {
    await finishAndOpenComplete(promptA, "session-a", { sessionId: "session-a", status: "COMPLETED", loopPoints: null });

    expectNoNotice();
  });

  it("[spec] Q4 완료 응답에 loopPoints 키가 없으면 안내가 없다", async () => {
    await finishAndOpenComplete(promptA, "session-a", { sessionId: "session-a", status: "COMPLETED" });

    expectNoNotice();
  });

  it("[spec] Q5 적립 0이고 한도도 아니면 안내가 없다('+0룹 쌓였어요'도 없다)", async () => {
    await finishAndOpenComplete(promptA, "session-a", { sessionId: "session-a", status: "COMPLETED", loopPoints: Q_NEITHER });

    expectNoNotice();
    expect(screen.queryByText("+0룹 쌓였어요")).toBeNull();
  });

  it("[spec] Q6 적립 30이면서 한도 true면 '+30룹 쌓였어요'만 보이고 한도 문구는 없다", async () => {
    await finishAndOpenComplete(promptA, "session-a", {
      sessionId: "session-a",
      status: "COMPLETED",
      loopPoints: Q_EARNED_AND_LIMIT
    });

    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();
    expect(screen.queryByText(LIMIT_QUESTION)).toBeNull();
  });

  it("[spec] Q7 피드백 화면을 거치지 않고 완료 화면을 바로 열면 안내가 없고 완료 화면은 그려진다", async () => {
    savePracticeFeedbackState(readyState(promptA, "session-a", { sessionCompleted: true }));
    setParams({ difficulty: "A", promptId: promptA.id });
    await render(<PracticeCompleteScreen />);
    await flushAsync();

    expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
    expectNoNotice();
  });

  it("[spec] Q8 질문 A를 적립 30으로 마친 뒤 질문 B를 null로 마치면 B의 완료 화면에 안내가 없다", async () => {
    const firstView = await finishAndOpenComplete(promptA, "session-a", {
      sessionId: "session-a",
      status: "COMPLETED",
      loopPoints: Q_EARNED
    });
    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();
    await firstView.unmount();

    await finishAndOpenComplete(promptB, "session-b", { sessionId: "session-b", status: "COMPLETED", loopPoints: null });

    expectNoNotice();
  });

  it("[spec] Q9 손님이 마치면 완료 API를 부르고 /practice/complete로 difficulty·promptId를 넘기며, 완료 화면에 안내가 없다", async () => {
    setSessionUser(null);
    refreshSession.mockResolvedValue(null);

    const pushArg = await finishOnFeedbackScreen(promptA, "session-a", {
      sessionId: "session-a",
      status: "COMPLETED",
      loopPoints: null
    });

    expect(completeFeedbackSession).toHaveBeenCalledWith("session-a", GUEST_ID);
    expect(pushArg.pathname).toBe("/practice/complete");
    expect(pushArg.params).toMatchObject({ difficulty: "A", promptId: "prompt-a" });
    await openCompleteFrom(pushArg);
    expectNoNotice();
  });

  it("[spec] Q10 완료 API가 실패하면 '완료하지 못했어요' 알림을 띄우고 완료 화면으로 가지 않는다", async () => {
    jest.mocked(completeFeedbackSession).mockRejectedValueOnce(new Error("세션을 완료하지 못했어요"));
    savePracticeFeedbackState(readyState(promptA, "session-a"));
    setParams({ difficulty: "A", promptId: promptA.id });
    await render(<PracticeFeedbackScreen />);
    await flushAsync();

    await fireEvent.press(screen.getByRole("button", { name: "루프 완료하기" }));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith("완료하지 못했어요", "세션을 완료하지 못했어요");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("[spec] Q11 안내와 함께 완료 화면의 원래 내용('루프를 완주했어요!', 'SUCCESS!')도 보인다", async () => {
    await finishAndOpenComplete(promptA, "session-a", { sessionId: "session-a", status: "COMPLETED", loopPoints: Q_EARNED });

    expect(screen.getByText(EARNED_30)).toBeOnTheScreen();
    expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
    expect(screen.getByText("SUCCESS!")).toBeOnTheScreen();
  });

  it("[spec] Q12(04 결정 4) 적립 30으로 마친 뒤 앱이 다시 열려 완료 화면이 저장된 상태로 다시 그려지면 안내가 없다", async () => {
    const pushArg = await finishOnFeedbackScreen(promptA, "session-a", {
      sessionId: "session-a",
      status: "COMPLETED",
      loopPoints: Q_EARNED
    });
    expect(pushArg.pathname).toBe("/practice/complete");

    // 앱이 다시 열림: 메모리 상태는 사라지고, 완료 화면은 저장된 피드백 상태를 불러와 다시 그린다.
    // 다시 열린 화면의 주소는 질문 정보(difficulty·promptId)만 가진다(완료 응답이 없다).
    clearPracticeFeedbackState();
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(readyState(promptA, "session-a", { sessionCompleted: true }));
    setParams({ difficulty: "A", promptId: promptA.id });
    await render(<PracticeCompleteScreen />);
    await flushAsync();

    expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
    expectNoNotice();
  });
});
