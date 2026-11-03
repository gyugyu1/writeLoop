// [spec] qa 테스트(작업 054 지난 미션 결과 보여 주기, 새 기능). 시나리오: 04-qa-scenarios.md 2절(P1~P8), 3절(F1~F16).
// 다시 쓴 답의 모바일 피드백 화면(src/app/practice/feedback.tsx, 미션 상태와 완료 상태)의 맨 위에
// "지난 미션: <앞 미션 제목>" 줄과 서버가 준 한국어 한 줄을 담은 카드가 보이고, 판정마다 구별되며,
// 응답에 previousMissionResult가 없거나 null이면 카드를 그리지 않는다는 명세를 확인한다.
// 기대값은 시나리오에서만 가져왔다. 필드 이름은 05-main-decision.md 2번(title, status, appliedCount, totalCount, message)이다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(expo-secure-store, @/lib/writing-drafts, 저장된 피드백 상태 불러오기,
// 게스트 아이디), 로그인 상태(@/lib/session), 라우터·내비게이션, 네이티브 모듈(expo-symbols, expo-crypto).
// "보인다/없다"는 Testing Library 기본 질의로 본다. 기대 글자는 문자열 전체 일치다(시나리오 2절).
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Keyboard, ScrollView, StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";
import PracticeFeedbackScreen from "@/app/practice/feedback";
import { completeFeedbackSession, getSavedExpressions, submitFeedback } from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import {
  clearPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, Feedback, FeedbackCoachMove, PreviousMissionResult, Prompt } from "@/lib/types";
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

// ---------- 고정 데이터(시나리오 1절 공통 입력 값) ----------

const prompt: Prompt = {
  id: "prompt-054",
  topic: "Hobby",
  topicCategory: "ROUTINE",
  topicDetail: "Weekend",
  difficulty: "A",
  questionEn: "What do you like to do on weekends?",
  questionKo: "주말에 무엇을 하는 것을 좋아하나요?",
  tip: ""
};

const signedInUser: AuthUser = { id: 54, email: "previous-mission@example.com", displayName: "학습자", admin: false };

const ANSWER = "I like to read books on weekends.";
const STRENGTH = "좋은 시작이에요.";
const CURRENT_MISSION_TITLE = "구체적인 예 더하기";
const SUBMIT_LABEL = "다시 피드백 받아보기";
const NO_CARD = /지난 미션/;

// 지금 미션(SLOT, 제목 "구체적인 예 더하기"). 대상 슬롯을 두지 않아 코치 카드 제목이 이 제목 그대로 보인다.
const slotMission: FeedbackCoachMove = {
  focus: CURRENT_MISSION_TITLE,
  focusType: "SLOT",
  why: "예가 있으면 답이 더 생생해요.",
  instruction: "좋아하는 책 하나를 예로 들어 한 문장 더 써 보세요."
};

type Case = {
  id: string;
  result: PreviousMissionResult;
  title: string;
  message: string;
};

// 시나리오 2절 P1~P8. 기대 글자: "지난 미션: <제목>"과 <한 줄>.
const CASES: Case[] = [
  {
    id: "P1",
    result: { focusType: "SLOT", title: "이유 붙여보기", targetSlot: "REASON", status: "RESOLVED", message: "해결했어요" },
    title: "지난 미션: 이유 붙여보기",
    message: "해결했어요"
  },
  {
    id: "P2",
    result: {
      focusType: "SLOT",
      title: "이유 붙여보기",
      targetSlot: "REASON",
      status: "PARTIAL",
      message: "조금 더 구체적으로 써 보세요"
    },
    title: "지난 미션: 이유 붙여보기",
    message: "조금 더 구체적으로 써 보세요"
  },
  {
    id: "P3",
    result: { focusType: "SLOT", title: "이유 붙여보기", targetSlot: "REASON", status: "UNRESOLVED", message: "아직 안 들어갔어요" },
    title: "지난 미션: 이유 붙여보기",
    message: "아직 안 들어갔어요"
  },
  {
    id: "P4",
    result: {
      focusType: "LANGUAGE_FIX",
      title: "문장 2곳 바로잡기",
      status: "RESOLVED",
      appliedCount: 2,
      totalCount: 2,
      message: "2곳 모두 반영했어요"
    },
    title: "지난 미션: 문장 2곳 바로잡기",
    message: "2곳 모두 반영했어요"
  },
  {
    id: "P5",
    result: {
      focusType: "LANGUAGE_FIX",
      title: "문장 2곳 바로잡기",
      status: "PARTIAL",
      appliedCount: 1,
      totalCount: 2,
      message: "2곳 중 1곳 반영했어요"
    },
    title: "지난 미션: 문장 2곳 바로잡기",
    message: "2곳 중 1곳 반영했어요"
  },
  {
    id: "P6",
    result: {
      focusType: "LANGUAGE_FIX",
      title: "문장 2곳 바로잡기",
      status: "UNRESOLVED",
      appliedCount: 0,
      totalCount: 2,
      message: "아직 반영되지 않았어요"
    },
    title: "지난 미션: 문장 2곳 바로잡기",
    message: "아직 반영되지 않았어요"
  },
  {
    id: "P7",
    result: { focusType: "TASK_RESET", title: "질문에 맞게 다시 쓰기", status: "RESOLVED", message: "질문에 맞게 썼어요" },
    title: "지난 미션: 질문에 맞게 다시 쓰기",
    message: "질문에 맞게 썼어요"
  },
  {
    id: "P8",
    result: {
      focusType: "TASK_RESET",
      title: "질문에 맞게 다시 쓰기",
      status: "UNRESOLVED",
      message: "아직 질문과 거리가 있어요"
    },
    title: "지난 미션: 질문에 맞게 다시 쓰기",
    message: "아직 질문과 거리가 있어요"
  }
];

function caseOf(id: string): Case {
  const found = CASES.find((item) => item.id === id);
  if (!found) {
    throw new Error(`없는 조합: ${id}`);
  }
  return found;
}

function makeFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    promptId: prompt.id,
    sessionId: "session-054",
    attemptNo: 1,
    loopComplete: false,
    completionMessage: null,
    summary: "",
    strengths: [STRENGTH],
    inlineFeedback: null,
    revisedAnswer: null,
    modelAnswer: "",
    rewriteChallenge: "",
    ...overrides
  };
}

// 다시 쓴 답의 미션 피드백: attemptNo 2, loopComplete false, SLOT 미션.
function rewriteMissionFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return makeFeedback({ attemptNo: 2, loopComplete: false, coachMove: slotMission, ...overrides });
}

// 다시 쓴 답의 완료 피드백: attemptNo 2, loopComplete true, 미션 없음.
function rewriteCompleteFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return makeFeedback({ attemptNo: 2, loopComplete: true, coachMove: null, ...overrides });
}

function makeState(feedback: Feedback, overrides: Partial<PracticeFeedbackState> = {}): PracticeFeedbackState {
  return { difficulty: "A", prompt, answer: ANSWER, feedback, ...overrides };
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

// 렌더 트리를 깊이 우선으로 펼친 글자 목록(시나리오 1절 "맨 위"의 기준).
function textsInOrder(): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (node == null) {
      return;
    }
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const element = node as { children?: unknown[] | null };
    (element.children ?? []).forEach(walk);
  };
  walk(screen.toJSON());
  return out;
}

function indexOfText(texts: string[], text: string): number {
  const index = texts.indexOf(text);
  if (index < 0) {
    throw new Error(`글자를 찾지 못함: "${text}" / 화면 글자: ${JSON.stringify(texts)}`);
  }
  return index;
}

function textOf(node: TestInstance | string): string {
  if (typeof node === "string") {
    return node;
  }
  return node.children.map(textOf).join("");
}

// 카드 부분: 제목 줄 글자에서 위로 올라가며 한 줄 글자까지 함께 담은 가장 가까운 요소.
function cardPart(title: string, message: string): TestInstance {
  let node: TestInstance | null = screen.getByText(title);
  while (node) {
    if (textOf(node).includes(message)) {
      return node;
    }
    node = node.parent;
  }
  throw new Error(`카드 부분을 찾지 못함: ${title}`);
}

// 카드 부분의 렌더 결과에서 요소 종류, 스타일 값, 글자만 남긴다(시나리오 F3: "스타일 값과 글자 포함").
function renderedLook(node: TestInstance | string): unknown {
  if (typeof node === "string") {
    return node;
  }
  return {
    type: node.type,
    style: StyleSheet.flatten(node.props.style) ?? null,
    children: node.children.map(renderedLook)
  };
}

function lookOfCard(title: string, message: string): string {
  return JSON.stringify(renderedLook(cardPart(title, message)));
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
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue("guest-054");
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

// ---------- 카드 글자와 위치 ----------

describe("[spec] 지난 미션 결과 카드(모바일 피드백 화면): 카드 글자와 위치", () => {
  it.each(CASES)(
    "[spec] F1 $id: 다시 쓴 답의 미션 피드백에 '$title'과 '$message'가 보인다",
    async ({ result, title, message }) => {
      await renderScreen(makeState(rewriteMissionFeedback({ previousMissionResult: result })));

      expect(screen.getByText(title)).toBeOnTheScreen();
      expect(screen.getByText(message)).toBeOnTheScreen();
    }
  );

  it("[spec] F2: 카드는 머리('피드백') 바로 아래, '잘한 점'과 지금 미션 카드보다 위에 있다", async () => {
    const p1 = caseOf("P1");
    await renderScreen(makeState(rewriteMissionFeedback({ previousMissionResult: p1.result })));

    const texts = textsInOrder();
    const header = indexOfText(texts, "피드백");
    const cardTitle = indexOfText(texts, p1.title);
    const cardMessage = indexOfText(texts, p1.message);
    const strength = indexOfText(texts, "잘한 점");
    const mission = indexOfText(texts, CURRENT_MISSION_TITLE);

    expect(header).toBeLessThan(cardTitle);
    expect(cardTitle).toBeLessThan(cardMessage);
    expect(cardMessage).toBeLessThan(strength);
    expect(strength).toBeLessThan(mission);
    // 머리 바로 아래: 머리 제목과 카드 제목 사이에 다른 글자가 없다.
    expect(texts.slice(header + 1, cardTitle)).toEqual([]);
  });

  it("[spec] F5: 다시 쓴 답의 완료 피드백(미션 없음)에도 카드가 보이고, '잘한 점'과 완료 문구보다 위에 있다", async () => {
    const p2 = caseOf("P2");
    await renderScreen(makeState(rewriteCompleteFeedback({ previousMissionResult: p2.result })));

    expect(screen.getByText(p2.title)).toBeOnTheScreen();
    expect(screen.getByText(p2.message)).toBeOnTheScreen();

    const texts = textsInOrder();
    const cardTitle = indexOfText(texts, p2.title);
    const cardMessage = indexOfText(texts, p2.message);
    const strength = indexOfText(texts, "잘한 점");
    const completionHeadline = indexOfText(texts, "좋아요! 지금 단계에서 마무리해도 충분해요.");
    expect(cardTitle).toBeLessThan(cardMessage);
    expect(cardMessage).toBeLessThan(strength);
    expect(cardMessage).toBeLessThan(completionHeadline);
  });

  it("[spec] F6: 완료 화면에서 '마지막 피드백 다시 보기'로 돌아온 상태(sessionCompleted)에도 카드가 보인다", async () => {
    const p1 = caseOf("P1");
    await renderScreen(
      makeState(rewriteCompleteFeedback({ previousMissionResult: p1.result }), { sessionCompleted: true })
    );

    expect(screen.getByText(p1.title)).toBeOnTheScreen();
    expect(screen.getByText(p1.message)).toBeOnTheScreen();
  });

  it("[spec] F16: 메모리 상태 없이 저장된 상태를 불러와 연 화면에도 불러오기가 끝난 뒤 카드가 보인다", async () => {
    const p3 = caseOf("P3");
    jest
      .mocked(hydratePracticeFeedbackState)
      .mockResolvedValue(makeState(rewriteMissionFeedback({ previousMissionResult: p3.result })));
    await render(<PracticeFeedbackScreen />);

    expect(await screen.findByText(p3.title)).toBeOnTheScreen();
    expect(screen.getByText(p3.message)).toBeOnTheScreen();
  });
});

// ---------- 판정별 구별 ----------

describe("[spec] 지난 미션 결과 카드(모바일 피드백 화면): 판정별 구별", () => {
  async function lookFor(result: PreviousMissionResult, title: string, message: string) {
    await renderScreen(makeState(rewriteMissionFeedback({ previousMissionResult: result })));
    const look = lookOfCard(title, message);
    await screen.unmount();
    clearPracticeFeedbackState();
    return look;
  }

  it("[spec] F3: SLOT에서 제목·한 줄을 같게 두고 판정만 RESOLVED·PARTIAL·UNRESOLVED로 바꾸면 카드 부분의 렌더 결과(스타일·글자)가 셋 모두 다르다", async () => {
    const title = "지난 미션: 이유 붙여보기";
    const message = "해결했어요";
    const base = { focusType: "SLOT", title: "이유 붙여보기", targetSlot: "REASON", message };

    const resolved = await lookFor({ ...base, status: "RESOLVED" }, title, message);
    const partial = await lookFor({ ...base, status: "PARTIAL" }, title, message);
    const unresolved = await lookFor({ ...base, status: "UNRESOLVED" }, title, message);

    expect(resolved).not.toBe(partial);
    expect(resolved).not.toBe(unresolved);
    expect(partial).not.toBe(unresolved);
  });

  it("[spec] F4: TASK_RESET에서 판정만 RESOLVED·UNRESOLVED로 바꾸면 카드 부분의 렌더 결과(스타일·글자)가 다르다", async () => {
    const title = "지난 미션: 질문에 맞게 다시 쓰기";
    const message = "질문에 맞게 썼어요";
    const base = { focusType: "TASK_RESET", title: "질문에 맞게 다시 쓰기", message };

    const resolved = await lookFor({ ...base, status: "RESOLVED" }, title, message);
    const unresolved = await lookFor({ ...base, status: "UNRESOLVED" }, title, message);

    expect(resolved).not.toBe(unresolved);
  });
});

// ---------- 필드가 없을 때 ----------

describe("[spec] 지난 미션 결과 카드(모바일 피드백 화면): 필드가 없으면 카드 없음", () => {
  it("[spec] F7: 첫 답(attemptNo 1), 필드 없음, 미션 있음이면 카드가 없고 머리·잘한 점·코치 카드·다시쓰기 칸은 보인다", async () => {
    await renderScreen(makeState(makeFeedback({ attemptNo: 1, coachMove: slotMission })));

    expect(screen.queryAllByText(NO_CARD)).toHaveLength(0);
    expect(screen.getByText("피드백")).toBeOnTheScreen();
    expect(screen.getByText("잘한 점")).toBeOnTheScreen();
    expect(screen.getByText(CURRENT_MISSION_TITLE)).toBeOnTheScreen();
    expect(screen.getByDisplayValue(ANSWER)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: SUBMIT_LABEL })).toBeOnTheScreen();
  });

  it("[spec] F8: 다시 쓴 답(attemptNo 2)이라도 필드가 없으면 카드가 없다", async () => {
    await renderScreen(makeState(rewriteMissionFeedback()));

    expect(screen.getByText("잘한 점")).toBeOnTheScreen();
    expect(screen.queryAllByText(NO_CARD)).toHaveLength(0);
  });

  it("[spec] F9: previousMissionResult가 null이면 카드가 없고 화면이 오류 없이 그려진다", async () => {
    await renderScreen(makeState(rewriteMissionFeedback({ previousMissionResult: null })));

    expect(screen.getByText("잘한 점")).toBeOnTheScreen();
    expect(screen.getByText(CURRENT_MISSION_TITLE)).toBeOnTheScreen();
    expect(screen.queryAllByText(NO_CARD)).toHaveLength(0);
  });

  it("[spec] F10: 첫 답에 바로 완료(attemptNo 1, loopComplete true), 필드 없음이면 카드가 없다", async () => {
    await renderScreen(makeState(makeFeedback({ attemptNo: 1, loopComplete: true })));

    expect(screen.getByText("잘한 점")).toBeOnTheScreen();
    expect(screen.queryAllByText(NO_CARD)).toHaveLength(0);
  });
});

// ---------- 다시쓰기 흐름 ----------

describe("[spec] 지난 미션 결과 카드(모바일 피드백 화면): 다시쓰기 흐름", () => {
  // 다시쓰기 칸(지금 들어 있는 글로 찾는다)에 새 글을 쓰고 제출한다.
  async function submitRewrite(currentText: string, text: string, next: Feedback) {
    jest.mocked(submitFeedback).mockResolvedValueOnce(next);
    await fireEvent.changeText(screen.getByDisplayValue(currentText), text);
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
  }

  it("[spec] F11: 카드 없는 첫 답 화면에서 다시 써 제출하면, 응답(attemptNo 2, P5) 뒤 카드가 보인다", async () => {
    const p5 = caseOf("P5");
    await renderScreen(makeState(makeFeedback({ attemptNo: 1, coachMove: slotMission })));
    expect(screen.queryAllByText(NO_CARD)).toHaveLength(0);

    await submitRewrite(ANSWER, "I like to read books on weekends, like Harry Potter.", rewriteMissionFeedback({ previousMissionResult: p5.result }));

    expect(await screen.findByText(p5.title)).toBeOnTheScreen();
    expect(screen.getByText(p5.message)).toBeOnTheScreen();
  });

  it("[spec] F12: 이어서 다시 제출해 attemptNo 3, P1을 받으면 P1 카드만 보이고 앞 카드(P5)는 없다", async () => {
    const p5 = caseOf("P5");
    const p1 = caseOf("P1");
    await renderScreen(makeState(makeFeedback({ attemptNo: 1, coachMove: slotMission })));
    await submitRewrite(ANSWER, "I like to read books on weekends, like Harry Potter.", rewriteMissionFeedback({ previousMissionResult: p5.result }));
    await screen.findByText(p5.title);

    await submitRewrite(
      "I like to read books on weekends, like Harry Potter.",
      "I like to read books on weekends because they relax me.",
      rewriteMissionFeedback({ attemptNo: 3, previousMissionResult: p1.result })
    );

    expect(await screen.findByText(p1.title)).toBeOnTheScreen();
    expect(screen.getByText(p1.message)).toBeOnTheScreen();
    expect(screen.queryByText(p5.title)).toBeNull();
    expect(screen.queryByText(p5.message)).toBeNull();
  });

  it("[spec] F13: 이어서 다시 제출해 attemptNo 4, 필드 없는 피드백을 받으면 카드가 없다", async () => {
    const p5 = caseOf("P5");
    const p1 = caseOf("P1");
    await renderScreen(makeState(makeFeedback({ attemptNo: 1, coachMove: slotMission })));
    await submitRewrite(ANSWER, "I like to read books on weekends, like Harry Potter.", rewriteMissionFeedback({ previousMissionResult: p5.result }));
    await screen.findByText(p5.title);
    await submitRewrite(
      "I like to read books on weekends, like Harry Potter.",
      "I like to read books on weekends because they relax me.",
      rewriteMissionFeedback({ attemptNo: 3, previousMissionResult: p1.result })
    );
    await screen.findByText(p1.title);

    await submitRewrite(
      "I like to read books on weekends because they relax me.",
      "I like to read books on weekends because they relax me after work.",
      rewriteMissionFeedback({ attemptNo: 4, strengths: ["네 번째 시도의 잘한 점"] })
    );

    expect(await screen.findByText("네 번째 시도의 잘한 점")).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryAllByText(NO_CARD)).toHaveLength(0));
  });
});

// ---------- 그대로 둘 동작: 문장 교정 미션의 정답 가리기(052) ----------

describe("[spec] 지난 미션 결과 카드(모바일 피드백 화면): 문장 교정 정답 가리기(052)는 그대로", () => {
  const languageFixMission: FeedbackCoachMove = {
    focus: "문장 2곳 바로잡기",
    focusType: "LANGUAGE_FIX",
    why: "시제와 관사를 바로잡으면 자연스러워요.",
    before: "I go to the park and ate a apple.",
    after: "I went to the park and ate an apple.",
    instruction: "위 교정들을 반영해 문장 전체를 다시 써 보세요.",
    languageCorrections: [
      { kind: "GRAMMAR_BLOCKING", label: "핵심 교정", before: "I go", after: "I went", reason: "어제 일이라 과거형을 써요." },
      { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: "a apple", after: "an apple", reason: "모음 앞에는 an을 써요." }
    ]
  };

  it("[spec] F14: 다시 받은 미션이 문장 교정이고 카드가 P5면, 카드 글자는 보이고 지금 교정 줄의 고친 표현(I went, an apple)은 보이지 않으며 카드 안에도 없다", async () => {
    const p5 = caseOf("P5");
    await renderScreen(
      makeState(rewriteMissionFeedback({ coachMove: languageFixMission, previousMissionResult: p5.result }), {
        answer: "I go to the park and ate a apple."
      })
    );

    expect(screen.getByText(p5.title)).toBeOnTheScreen();
    expect(screen.getByText(p5.message)).toBeOnTheScreen();
    expect(screen.queryAllByText("I went", { exact: false })).toHaveLength(0);
    expect(screen.queryAllByText("an apple", { exact: false })).toHaveLength(0);
    const card = textOf(cardPart(p5.title, p5.message));
    expect(card).not.toContain("I went");
    expect(card).not.toContain("an apple");
  });

  it("[spec] F15: F14에서 첫 줄의 '고친 표현 보기'를 누르면 'I went'가 보이고 카드 글자는 그대로 보인다", async () => {
    const p5 = caseOf("P5");
    await renderScreen(
      makeState(rewriteMissionFeedback({ coachMove: languageFixMission, previousMissionResult: p5.result }), {
        answer: "I go to the park and ate a apple."
      })
    );

    await fireEvent.press(screen.getAllByRole("button", { name: /고친 표현 보기/ })[0]);

    expect(screen.getByText("I went")).toBeOnTheScreen();
    expect(screen.getByText(p5.title)).toBeOnTheScreen();
    expect(screen.getByText(p5.message)).toBeOnTheScreen();
  });
});
