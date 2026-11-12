// [spec] qa 테스트(작업 086-05 적립 알림, 새 기능). 웹 주 화면(AnswerLoop)의 질문 답하기 완료 단계에 보이는 룹 적립 안내.
// 기대값은 05-적립-알림/03-qa-scenarios-web.md의 B(W-B1~B10)와 04-main-decision.md 1번(W-B11)에서만 가져왔다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// 완료 화면의 축하 효과(canvas-confetti)는 jsdom에 canvas 그리기가 없어 가짜로 둔다.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import type {
  AuthUser,
  DailyPromptRecommendation,
  Feedback,
  FeedbackSessionStatus,
  Prompt,
  TodayWritingStatus,
  WritingDraft
} from "../../lib/types";

const api = vi.hoisted(() => ({
  checkCoachExpressionUsage: vi.fn(),
  completeFeedbackSession: vi.fn(),
  deleteSavedExpression: vi.fn(),
  deleteWritingDraft: vi.fn(),
  getFeaturedDailyPrompt: vi.fn(),
  getCurrentUser: vi.fn(),
  getDailyPrompts: vi.fn(),
  getMonthStatus: vi.fn(),
  getPrompts: vi.fn(),
  getPromptHints: vi.fn(),
  getSavedExpressions: vi.fn(),
  getTodayWritingStatus: vi.fn(),
  getWritingDraft: vi.fn(),
  saveExpression: vi.fn(),
  saveWritingDraft: vi.fn(),
  requestCoachHelp: vi.fn(),
  submitFeedback: vi.fn(),
  trackDailyPromptClick: vi.fn()
}));

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn()
}));

const confetti = vi.hoisted(() => ({
  create: vi.fn(),
  fire: vi.fn()
}));

vi.mock("../../lib/api", () => ({
  ...api,
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    <img src={src} alt={alt} className={className} />
  )
}));

vi.mock("canvas-confetti", () => ({
  default: { create: confetti.create }
}));

const USER: AuthUser = {
  id: 8605,
  email: "loop-points-spec@example.com",
  displayName: "룹적립",
  admin: false
};

const GUEST_ID = "guest-loop-points-spec-000000000001";

const TODAY: TodayWritingStatus = {
  date: "2026-11-12",
  completed: false,
  completedSessions: 0,
  startedSessions: 1,
  streakDays: 3,
  totalAnswerSessions: 10,
  totalWrittenSentences: 120
};

function prompt(id: string, topic: string, questionEn: string, questionKo: string): Prompt {
  return {
    id,
    topic,
    topicCategory: "Daily life",
    topicDetail: "Morning",
    difficulty: "I",
    questionEn,
    questionKo,
    tip: ""
  };
}

const P1 = prompt("prompt-loop-1", "Morning routine", "What do you do first in the morning?", "아침에 가장 먼저 무엇을 하나요?");
const P2 = prompt("prompt-loop-2", "Breakfast", "What did you eat for breakfast today?", "오늘 아침으로 무엇을 먹었나요?");
const ALL_PROMPTS = [P1, P2];

const DAILY_I: DailyPromptRecommendation = {
  recommendedDate: "2026-11-12",
  difficulty: "I",
  prompts: [P1, P2]
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const FINISH_LABEL = "오늘 루프 완료하고 도장 받기";
const COMPLETE_HEADING = "루프를 완주했어요!";

const EARNED_NOTICE = /룹 쌓였어요/;
const LIMIT_NOTICE = /룹은 다 모았어요/;

type User = ReturnType<typeof userEvent.setup>;

function ready(sessionId: string, promptId = P1.id): Feedback {
  return {
    promptId,
    sessionId,
    attemptNo: 1,
    loopComplete: true,
    completionMessage: "오늘도 끝까지 썼어요.",
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: null,
    refinementExpressions: null,
    modelAnswer: "",
    rewriteChallenge: "",
    visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
  };
}

let drafts: Map<string, WritingDraft>;

async function flush() {
  await act(async () => {});
}

async function renderHome(loggedIn = true) {
  if (!loggedIn) {
    api.getCurrentUser.mockResolvedValue(null);
  }
  const user = userEvent.setup();
  render(<AnswerLoop />);
  await waitFor(() => expect(api.getFeaturedDailyPrompt).toHaveBeenCalled());
  if (loggedIn) {
    await waitFor(() => expect(api.getSavedExpressions).toHaveBeenCalled());
  }
  await flush();
  await flush();
  return user;
}

async function openPrompt(user: User, target: Prompt = P1) {
  await user.click(screen.getByRole("button", { name: /입문/ }));
  await user.click(await screen.findByText(target.questionEn));
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
  await flush();
}

async function submitAnswer(user: User, next: Feedback) {
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.type(screen.getByPlaceholderText(ANSWER_PLACEHOLDER), "I drink water.");
  await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
  await screen.findByText(`${next.attemptNo}번째 시도`);
}

// 답을 제출해 마칠 준비가 된 피드백을 받고, '루프 완료하기'(마치기 버튼)를 눌러 완료 단계로 간다.
async function finishLoop(user: User, sessionId: string, status: FeedbackSessionStatus | object) {
  api.completeFeedbackSession.mockResolvedValueOnce(status);
  await submitAnswer(user, ready(sessionId));
  await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
  await screen.findByRole("heading", { name: COMPLETE_HEADING });
  await flush();
}

function expectNoNotice() {
  expect(screen.queryByText(EARNED_NOTICE)).toBeNull();
  expect(screen.queryByText(LIMIT_NOTICE)).toBeNull();
}

describe("[spec] 웹 질문 답하기 완료 단계의 룹 적립 안내", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("writeloop_guest_id", GUEST_ID);
    window.history.replaceState({}, "", "/");
    Element.prototype.scrollIntoView = vi.fn();
    Object.values(api).forEach((mock) => mock.mockReset());
    Object.values(router).forEach((mock) => mock.mockReset());
    confetti.fire.mockReset();
    confetti.create.mockReset();
    confetti.create.mockImplementation(() => confetti.fire);
    drafts = new Map();

    api.getCurrentUser.mockResolvedValue(USER);
    api.getTodayWritingStatus.mockResolvedValue(TODAY);
    api.getMonthStatus.mockImplementation((year: number, month: number) =>
      Promise.resolve({ year, month, streakDays: 0, days: [] })
    );
    api.getSavedExpressions.mockResolvedValue([]);
    api.getPrompts.mockResolvedValue(ALL_PROMPTS);
    api.getFeaturedDailyPrompt.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.getDailyPrompts.mockResolvedValue(DAILY_I);
    api.getPromptHints.mockResolvedValue([]);
    api.getWritingDraft.mockImplementation((promptId: string, draftType: string) =>
      Promise.resolve(drafts.get(`${promptId}:${draftType}`) ?? null)
    );
    api.saveWritingDraft.mockImplementation((promptId: string, request: object) =>
      Promise.resolve({ ...request, promptId, selectedPromptId: promptId, updatedAt: "2026-11-12T09:00:00Z" })
    );
    api.deleteWritingDraft.mockResolvedValue(undefined);
    api.trackDailyPromptClick.mockResolvedValue(undefined);
    api.requestCoachHelp.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.checkCoachExpressionUsage.mockResolvedValue({
      promptId: P1.id,
      praiseMessage: "",
      usedExpressions: [],
      unusedExpressions: [],
      relatedPromptIds: []
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  it("[spec] W-B1 earned 30이면 완료 단계에 '+30룹 쌓였어요'가 보이고 '다 모았어요'는 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b1", {
      sessionId: "sess-loop-b1",
      status: "COMPLETED",
      loopPoints: { activity: "question", earned: 30, balance: 260, dailyLimitReached: false }
    });

    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();
    expect(screen.queryByText(LIMIT_NOTICE)).toBeNull();
  });

  it("[spec] W-B2 N은 earned 값이다: earned 45면 '+45룹 쌓였어요'가 보이고 '+30룹 쌓였어요'는 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b2", {
      sessionId: "sess-loop-b2",
      status: "COMPLETED",
      loopPoints: { activity: "question", earned: 45, balance: 275, dailyLimitReached: false }
    });

    expect(screen.getByText("+45룹 쌓였어요")).toBeInTheDocument();
    expect(screen.queryByText("+30룹 쌓였어요")).toBeNull();
  });

  it("[spec] W-B3 earned 0이고 한도에 닿았으면 '오늘 질문 답하기 룹은 다 모았어요'가 보이고 '룹 쌓였어요'는 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b3", {
      sessionId: "sess-loop-b3",
      status: "COMPLETED",
      loopPoints: { activity: "question", earned: 0, balance: 290, dailyLimitReached: true }
    });

    expect(screen.getByText("오늘 질문 답하기 룹은 다 모았어요")).toBeInTheDocument();
    expect(screen.queryByText(EARNED_NOTICE)).toBeNull();
  });

  it("[spec] W-B4 loopPoints가 null이면 완료 단계가 열리고 안내가 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b4", { sessionId: "sess-loop-b4", status: "COMPLETED", loopPoints: null });

    expect(screen.getByRole("heading", { name: COMPLETE_HEADING })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-B5 loopPoints 키가 없으면 완료 단계가 열리고 안내가 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b5", { sessionId: "sess-loop-b5", status: "COMPLETED" });

    expect(screen.getByRole("heading", { name: COMPLETE_HEADING })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-B6 earned 0이고 한도에 닿지 않았으면(둘 다 아닌 값) 안내가 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b6", {
      sessionId: "sess-loop-b6",
      status: "COMPLETED",
      loopPoints: { activity: "question", earned: 0, balance: 260, dailyLimitReached: false }
    });

    expect(screen.getByRole("heading", { name: COMPLETE_HEADING })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-B7 손님으로 완료하면(서버는 loopPoints null) 완료 단계가 열리고 안내가 없다", async () => {
    const user = await renderHome(false);
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b7", { sessionId: "sess-loop-b7", status: "COMPLETED", loopPoints: null });

    expect(screen.getByRole("heading", { name: COMPLETE_HEADING })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-B8 첫 완료의 안내는 다음 루프 완료(loopPoints null)에 남지 않는다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b8-1", {
      sessionId: "sess-loop-b8-1",
      status: "COMPLETED",
      loopPoints: { activity: "question", earned: 30, balance: 260, dailyLimitReached: false }
    });
    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    await user.click(await screen.findByText(P2.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await flush();
    api.completeFeedbackSession.mockResolvedValueOnce({
      sessionId: "sess-loop-b8-2",
      status: "COMPLETED",
      loopPoints: null
    });
    await submitAnswer(user, ready("sess-loop-b8-2", P2.id));
    await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
    await screen.findByRole("heading", { name: COMPLETE_HEADING });
    await flush();

    expect(api.completeFeedbackSession).toHaveBeenCalledTimes(2);
    expect(api.completeFeedbackSession).toHaveBeenLastCalledWith("sess-loop-b8-2", GUEST_ID);
    expectNoNotice();
  });

  it("[spec] W-B9 완료가 실패하면 완료 단계로 가지 않고 오류 문구가 보이며 안내가 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    const { ApiError } = await import("../../lib/api");
    api.completeFeedbackSession.mockRejectedValueOnce(new ApiError("지금은 완료할 수 없어요.", 500));
    await submitAnswer(user, ready("sess-loop-b9"));
    await user.click(screen.getByRole("button", { name: FINISH_LABEL }));

    expect(await screen.findByText("지금은 완료할 수 없어요.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: COMPLETE_HEADING })).toBeNull();
    expectNoNotice();
  });

  it("[spec] W-B10 안내와 함께 완료 단계의 원래 내용(제목, '다른 질문 보기'·'마지막 피드백 다시 보기')이 그대로 있고 완료는 한 번 부른다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b10", {
      sessionId: "sess-loop-b10",
      status: "COMPLETED",
      loopPoints: { activity: "question", earned: 30, balance: 260, dailyLimitReached: false }
    });

    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: COMPLETE_HEADING })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다른 질문 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "마지막 피드백 다시 보기" })).toBeInTheDocument();
    expect(api.completeFeedbackSession).toHaveBeenCalledTimes(1);
    expect(api.completeFeedbackSession).toHaveBeenCalledWith("sess-loop-b10", GUEST_ID);
  });

  it("[spec] W-B11(결정 04-1) '마지막 피드백 다시 보기'에 갔다가 '완료 화면으로 돌아가기'로 돌아오면 같은 완료의 안내를 다시 보인다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await finishLoop(user, "sess-loop-b11", {
      sessionId: "sess-loop-b11",
      status: "COMPLETED",
      loopPoints: { activity: "question", earned: 30, balance: 260, dailyLimitReached: false }
    });
    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "마지막 피드백 다시 보기" }));
    expect(screen.queryByRole("heading", { name: COMPLETE_HEADING })).toBeNull();
    await user.click(screen.getByRole("button", { name: "완료 화면으로 돌아가기" }));
    await screen.findByRole("heading", { name: COMPLETE_HEADING });

    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();
    expect(api.completeFeedbackSession).toHaveBeenCalledTimes(1);
  });
});
