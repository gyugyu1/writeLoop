// [spec] qa 테스트(작업 054 지난 미션 결과 보여 주기, 새 기능). 시나리오: 04-qa-scenarios.md 4절(C1~C8).
// 05-main-decision.md 1번(사용자 결정): 카드는 피드백 화면(practice/feedback.tsx, 완료 상태 포함)에만 두고,
// "루프 완료하기"를 누른 뒤의 완료 화면(src/app/practice/complete.tsx)에는 두지 않는다.
// 그래서 4절의 기대값을 "카드가 없다"로 바꿔 옮겼다(C1~C4, C8이 바뀜. C5~C7은 원래도 카드 없음).
// 서버가 마지막 피드백에 previousMissionResult를 담아 보내도 완료 화면에는 "지난 미션" 글자와 판정 한 줄이 없고,
// 완료 화면은 지금처럼 그려진다("SUCCESS!"가 화면 내용의 맨 처음).
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(expo-secure-store, @/lib/writing-drafts, @/lib/incomplete-loop,
// 저장된 피드백 상태 불러오기, 게스트 아이디), 로그인 상태(@/lib/session), 라우터.
import { act, render, screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import PracticeCompleteScreen from "@/app/practice/complete";
import { deleteWritingDraft, getDailyPrompts, getTodayWritingStatus } from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { clearIncompleteLoop } from "@/lib/incomplete-loop";
import {
  clearPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, Feedback, PreviousMissionResult, Prompt } from "@/lib/types";
import { deleteLocalWritingDraft } from "@/lib/writing-drafts";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn()
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/api", () => ({
  deleteWritingDraft: jest.fn(),
  getDailyPrompts: jest.fn(),
  getTodayWritingStatus: jest.fn()
}));
jest.mock("@/lib/guest-id", () => ({ getOrCreateGuestId: jest.fn() }));
jest.mock("@/lib/incomplete-loop", () => ({ clearIncompleteLoop: jest.fn() }));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/writing-drafts", () => ({ deleteLocalWritingDraft: jest.fn() }));
jest.mock("@/lib/practice-feedback-state", () => ({
  ...jest.requireActual("@/lib/practice-feedback-state"),
  hydratePracticeFeedbackState: jest.fn()
}));

// ---------- 고정 데이터 ----------

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

const INITIAL_ANSWER = "I like read book.";
const FINAL_ANSWER = "I like to read books on weekends because they relax me.";
const NO_CARD = /지난 미션/;
const COMPLETION_HEADING = "루프를 완주했어요!";

type Case = { id: string; result: PreviousMissionResult; message: string };

// 시나리오 2절 P1~P8(입력). 완료 화면에서는 어느 것도 보이지 않아야 한다.
const CASES: Case[] = [
  {
    id: "P1",
    result: { focusType: "SLOT", title: "이유 붙여보기", targetSlot: "REASON", status: "RESOLVED", message: "해결했어요" },
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
    message: "조금 더 구체적으로 써 보세요"
  },
  {
    id: "P3",
    result: { focusType: "SLOT", title: "이유 붙여보기", targetSlot: "REASON", status: "UNRESOLVED", message: "아직 안 들어갔어요" },
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
    message: "아직 반영되지 않았어요"
  },
  {
    id: "P7",
    result: { focusType: "TASK_RESET", title: "질문에 맞게 다시 쓰기", status: "RESOLVED", message: "질문에 맞게 썼어요" },
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

// 마지막 피드백(완료한 시도): loopComplete true, 미션 없음.
function lastFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    promptId: prompt.id,
    sessionId: "session-054",
    attemptNo: 2,
    loopComplete: true,
    completionMessage: null,
    summary: "",
    strengths: ["좋은 시작이에요."],
    inlineFeedback: null,
    revisedAnswer: null,
    modelAnswer: "",
    rewriteChallenge: "",
    ...overrides
  };
}

function makeState(feedback: Feedback, overrides: Partial<PracticeFeedbackState> = {}): PracticeFeedbackState {
  return {
    difficulty: "A",
    prompt,
    initialAnswer: INITIAL_ANSWER,
    answer: FINAL_ANSWER,
    feedback,
    sessionCompleted: true,
    ...overrides
  };
}

// ---------- 도우미 ----------

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderScreen(state: PracticeFeedbackState) {
  savePracticeFeedbackState(state);
  await render(<PracticeCompleteScreen />);
  await flushEffects();
}

// 렌더 트리를 깊이 우선으로 펼친 글자 목록.
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

// 카드 없음: "지난 미션" 글자도, 판정 한 줄(부분 일치)도 화면 어디에도 없다.
function expectNoCard(message?: string) {
  expect(screen.queryAllByText(NO_CARD)).toHaveLength(0);
  if (message) {
    expect(screen.queryAllByText(message, { exact: false })).toHaveLength(0);
  }
}

beforeEach(() => {
  clearPracticeFeedbackState();
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ difficulty: "A", promptId: prompt.id } as unknown as ReturnType<typeof useLocalSearchParams>);
  jest.mocked(getDailyPrompts).mockReset().mockResolvedValue({ prompts: [] } as unknown as Awaited<
    ReturnType<typeof getDailyPrompts>
  >);
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(null as unknown as Awaited<
    ReturnType<typeof getTodayWritingStatus>
  >);
  jest.mocked(deleteWritingDraft).mockReset().mockResolvedValue(undefined as never);
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue("guest-054");
  jest.mocked(clearIncompleteLoop).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);
  jest.mocked(useSession).mockReturnValue({
    currentUser: signedInUser,
    isHydrating: false,
    refreshSession: jest.fn(),
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  });
});

// ---------- 완료 화면에는 카드가 없다 ----------

describe("[spec] 지난 미션 결과 카드: 완료 화면(practice/complete.tsx)에는 두지 않는다(05 결정 1)", () => {
  it.each(CASES)(
    "[spec] C1(바뀜) $id: 마지막 피드백(attemptNo 2)에 필드가 있어도 '지난 미션' 글자와 '$message'가 없고, 완료 화면은 그려진다",
    async ({ result, message }) => {
      await renderScreen(makeState(lastFeedback({ previousMissionResult: result })));

      expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
      expectNoCard(message);
    }
  );

  it("[spec] C2(바뀜): P5가 있어도 화면 내용의 맨 처음은 그대로 'SUCCESS!'이고, 순서는 SUCCESS! < 루프를 완주했어요! < 최초 답안이다", async () => {
    const p5 = caseOf("P5");
    await renderScreen(makeState(lastFeedback({ previousMissionResult: p5.result })));

    expectNoCard(p5.message);
    const texts = textsInOrder();
    expect(texts[0]).toBe("SUCCESS!");
    const success = texts.indexOf("SUCCESS!");
    const heading = texts.indexOf(COMPLETION_HEADING);
    const initial = texts.indexOf("최초 답안");
    expect(heading).toBeGreaterThan(success);
    expect(initial).toBeGreaterThan(heading);
  });

  it("[spec] C3·C4(바뀜): 판정(RESOLVED·PARTIAL·UNRESOLVED, 주제 이탈 포함)과 관계없이 완료 화면에는 카드가 없다", async () => {
    const statuses = ["RESOLVED", "PARTIAL", "UNRESOLVED"];
    for (const status of statuses) {
      for (const focusType of ["SLOT", "TASK_RESET"]) {
        clearPracticeFeedbackState();
        await renderScreen(
          makeState(
            lastFeedback({
              previousMissionResult: { focusType, title: "이유 붙여보기", status, message: "해결했어요" }
            })
          )
        );
        expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
        expectNoCard("해결했어요");
        await screen.unmount();
      }
    }
  });

  it("[spec] C5: 첫 답에 바로 완료(attemptNo 1), 필드 없음이면 카드가 없고 '루프를 완주했어요!'는 보인다", async () => {
    await renderScreen(makeState(lastFeedback({ attemptNo: 1 }), { initialAnswer: undefined }));

    expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
    expectNoCard();
  });

  it("[spec] C6: 마지막 피드백 attemptNo 2, 필드 없음이면 카드가 없다", async () => {
    await renderScreen(makeState(lastFeedback()));

    expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
    expectNoCard();
  });

  it("[spec] C7: previousMissionResult가 null이면 카드가 없고 오류 없이 그려진다", async () => {
    await renderScreen(makeState(lastFeedback({ previousMissionResult: null })));

    expect(screen.getByText(COMPLETION_HEADING)).toBeOnTheScreen();
    expectNoCard();
  });

  it("[spec] C8(바뀜): 메모리 상태 없이 저장된 상태(마지막 피드백 + P7)를 불러와 연 완료 화면에도 카드가 없다", async () => {
    const p7 = caseOf("P7");
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(makeState(lastFeedback({ previousMissionResult: p7.result })));
    await render(<PracticeCompleteScreen />);

    expect(await screen.findByText(COMPLETION_HEADING)).toBeOnTheScreen();
    await flushEffects();
    expectNoCard(p7.message);
  });
});
