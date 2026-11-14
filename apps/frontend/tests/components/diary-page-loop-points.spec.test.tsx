// [spec] qa 테스트(작업 086-05 적립 알림, 새 기능). 웹 영어일기 화면(DiaryPageClient)의 피드백 결과 맨 위에 보이는 룹 적립 안내.
// 기대값은 05-적립-알림/03-qa-scenarios-web.md의 C(W-C1~C11)와 04-main-decision.md 2번(W-C12)에서만 가져왔다.
// 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 next/link는 가짜다.
// 가짜 서버는 일기 목록을 들고 있다가 피드백을 받으면 그 일기의 지난 피드백(attempts[].feedback)으로 쌓는다.
// 지난 피드백에는 loopPoints 키가 없다(① 결정 03).
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiaryPageClient } from "../../components/diary-page-client";
import type { AuthUser, DiaryEntry, DiaryFeedback, LoopPointsReward } from "../../lib/types";

const api = vi.hoisted(() => ({
  createDiaryEntry: vi.fn(),
  deleteDiaryEntry: vi.fn(),
  getCurrentUser: vi.fn(),
  getDiaryEntries: vi.fn(),
  requestDiaryFeedback: vi.fn(),
  updateDiaryEntry: vi.fn()
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

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}));

const USER: AuthUser = {
  id: 8606,
  email: "diary-loop-points-spec@example.com",
  displayName: "일기룹",
  admin: false
};

const WRITE_PLACEHOLDER = "Today, I...";
const REWRITE_PLACEHOLDER = "I felt...";
// DIARY_CLEAR_BASIC 밴드의 피드백 제목(지금 화면 문구)
const HEADLINE = "일기를 더 자연스럽게 다듬었어요";
const EARNED_NOTICE = /룹 쌓였어요/;
const LIMIT_NOTICE = /룹은 다 모았어요/;

const EARNED_30: LoopPointsReward = { activity: "diary", earned: 30, balance: 230, dailyLimitReached: false };

type FeedbackOverrides = Partial<DiaryFeedback> & { loopPoints?: LoopPointsReward | null };

// 시나리오의 "일기 피드백 응답 예". loopPoints는 overrides에 넣을 때만 키가 생긴다.
function diaryFeedback(overrides: FeedbackOverrides = {}): DiaryFeedback {
  const base: DiaryFeedback = {
    schemaVersion: "diary-feedback-v1",
    entryId: "e-1",
    attemptNo: 1,
    score: 72,
    finishable: true,
    diaryAnswerBand: "DIARY_CLEAR_BASIC",
    summaryKo: "흐름이 자연스러워요.",
    strengths: ["시간 순서가 분명해요."],
    correctedDiary: null,
    modelDiary: null,
    modelDiaryKo: null,
    fixPoints: [],
    diaryFlow: {
      timeFlow: "아침에서 저녁으로",
      emotion: "편안함",
      detail: "공원",
      reflection: "내일도 걷기",
      commentKo: "시간 순서가 보여요.",
      connectionTips: []
    },
    rewriteIdeas: [],
    usedDiaryExpressions: [],
    diaryExpressions: [],
    nextDiaryMission: {
      focus: "detail",
      titleKo: "느낌을 한 문장 더",
      instructionKo: "그때 느낌을 한 문장 더 써 보세요.",
      starterEn: "I felt"
    },
    safetyFlags: []
  };
  return { ...base, ...overrides } as DiaryFeedback;
}

let serverEntries: DiaryEntry[];
let entrySeq: number;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// 피드백이 있는 지난 일기 B.
function pastEntryB(): DiaryEntry {
  const { loopPoints: _ignored, ...stored } = diaryFeedback({
    entryId: "e-b",
    score: 64,
    summaryKo: "지난 일기 요약이에요."
  }) as DiaryFeedback & { loopPoints?: unknown };
  return {
    entryId: "e-b",
    title: "Quiet park walk",
    content: "I walked in the park.",
    language: "en",
    entryDate: "2026-11-10",
    mood: null,
    tags: [],
    draft: false,
    createdAt: "2026-11-10T10:00:00Z",
    updatedAt: "2026-11-10T10:00:00Z",
    attempts: [
      {
        id: 1,
        attemptNo: 1,
        diaryText: "I walked in the park.",
        score: 64,
        feedbackSummary: "지난 일기 요약이에요.",
        feedback: stored as DiaryFeedback,
        createdAt: "2026-11-10T10:00:00Z"
      }
    ]
  };
}

// 다음 requestDiaryFeedback 한 번이 돌려줄 피드백. 가짜 서버는 loopPoints를 뺀 피드백을 그 일기의 지난 피드백으로 쌓는다.
function queueFeedback(response: FeedbackOverrides) {
  api.requestDiaryFeedback.mockImplementationOnce(async (entryId: string, request: { bodyText: string }) => {
    const entry = serverEntries.find((item) => item.entryId === entryId);
    const full = diaryFeedback({ ...response, entryId });
    const { loopPoints: _ignored, ...stored } = full as DiaryFeedback & { loopPoints?: unknown };
    entry?.attempts.push({
      id: (entry?.attempts.length ?? 0) + 100,
      attemptNo: full.attemptNo,
      diaryText: request.bodyText,
      score: full.score,
      feedbackSummary: full.summaryKo,
      feedback: stored as DiaryFeedback,
      createdAt: "2026-11-12T10:00:00Z"
    });
    return full;
  });
}

async function flush() {
  await act(async () => {});
}

async function renderDiary(loggedIn = true) {
  if (!loggedIn) {
    api.getCurrentUser.mockResolvedValue(null);
  }
  const user = userEvent.setup();
  render(<DiaryPageClient />);
  await waitFor(() => expect(api.getCurrentUser).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("영어일기장을 불러오는 중이에요.")).toBeNull());
  await flush();
  return user;
}

// 쓰는 칸에 본문을 쓰고 'AI 피드백 받기'를 누른 뒤 피드백 결과가 보일 때까지 기다린다.
async function writeAndRequest(user: ReturnType<typeof userEvent.setup>, text = "Today I walked.") {
  await user.type(screen.getByPlaceholderText(WRITE_PLACEHOLDER), text);
  await user.click(screen.getByRole("button", { name: "AI 피드백 받기" }));
  await screen.findByRole("heading", { name: HEADLINE });
  await flush();
}

function expectNoNotice() {
  expect(screen.queryByText(EARNED_NOTICE)).toBeNull();
  expect(screen.queryByText(LIMIT_NOTICE)).toBeNull();
}

function follows(first: Node, second: Node) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("[spec] 웹 영어일기 피드백 결과의 룹 적립 안내", () => {
  beforeEach(() => {
    vi.useRealTimers();
    Object.values(api).forEach((mock) => mock.mockReset());
    serverEntries = [];
    entrySeq = 0;

    api.getCurrentUser.mockResolvedValue(USER);
    api.getDiaryEntries.mockImplementation(async () => clone(serverEntries));
    api.createDiaryEntry.mockImplementation(
      async (payload: { title?: string; content: string; entryDate?: string; mood?: string; tags?: string[]; draft?: boolean }) => {
        entrySeq += 1;
        const entry: DiaryEntry = {
          entryId: entrySeq === 1 ? "e-1" : `e-${entrySeq}`,
          title: payload.title ?? null,
          content: payload.content,
          language: "en",
          entryDate: payload.entryDate ?? null,
          mood: payload.mood || null,
          tags: payload.tags ?? [],
          draft: Boolean(payload.draft),
          createdAt: "2026-11-12T09:00:00Z",
          updatedAt: "2026-11-12T09:00:00Z",
          attempts: []
        };
        serverEntries = [entry, ...serverEntries];
        return clone(entry);
      }
    );
    api.updateDiaryEntry.mockImplementation(
      async (entryId: string, payload: { title?: string; content: string; entryDate?: string; mood?: string; draft?: boolean }) => {
        const entry = serverEntries.find((item) => item.entryId === entryId);
        if (!entry) {
          throw new Error(`없는 일기 ${entryId}`);
        }
        entry.content = payload.content;
        entry.title = payload.title ?? null;
        entry.draft = Boolean(payload.draft);
        return clone(entry);
      }
    );
    api.deleteDiaryEntry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("[spec] W-C1 첫 피드백이 earned 30이면 '+30룹 쌓였어요'가 피드백 결과 맨 위(제목·점수 앞, '다시 써보기' 뒤)에 보인다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: EARNED_30 });
    await writeAndRequest(user);

    const notice = screen.getByText("+30룹 쌓였어요");
    const headline = screen.getByRole("heading", { name: HEADLINE });
    const score = screen.getByText("72");
    const rewriteButton = screen.getByRole("button", { name: "다시 써보기" });
    expect(follows(notice, headline)).toBe(true);
    expect(follows(notice, score)).toBe(true);
    expect(follows(rewriteButton, notice)).toBe(true);
  });

  it("[spec] W-C2 earned 0이고 한도에 닿았으면 '오늘 영어일기 룹은 다 모았어요'가 보이고 '룹 쌓였어요'는 없다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: { activity: "diary", earned: 0, balance: 230, dailyLimitReached: true } });
    await writeAndRequest(user);

    expect(screen.getByText("오늘 영어일기 룹은 다 모았어요")).toBeInTheDocument();
    expect(screen.queryByText(EARNED_NOTICE)).toBeNull();
  });

  it("[spec] W-C3 loopPoints가 null이면 피드백 결과는 보이고 안내가 없다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: null });
    await writeAndRequest(user);

    expect(screen.getByRole("heading", { name: HEADLINE })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-C4 loopPoints 키가 없으면 피드백 결과는 보이고 안내가 없다", async () => {
    const user = await renderDiary();
    queueFeedback({});
    await writeAndRequest(user);

    expect(screen.getByRole("heading", { name: HEADLINE })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-C5 earned 0이고 한도에 닿지 않았으면(둘 다 아닌 값) 피드백 결과는 보이고 안내가 없다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: { activity: "diary", earned: 0, balance: 230, dailyLimitReached: false } });
    await writeAndRequest(user);

    expect(screen.getByRole("heading", { name: HEADLINE })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-C6 같은 일기의 두 번째 피드백(loopPoints null)이 보이면 첫 피드백의 안내는 없다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: EARNED_30 });
    await writeAndRequest(user);
    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await user.type(screen.getByPlaceholderText(REWRITE_PLACEHOLDER), " calm.");
    queueFeedback({ attemptNo: 2, summaryKo: "두 번째 피드백 요약이에요.", loopPoints: null });
    await user.click(screen.getByRole("button", { name: "다시 쓴 일기 피드백 받기" }));
    await screen.findByText("두 번째 피드백 요약이에요.");
    await flush();

    expect(api.requestDiaryFeedback).toHaveBeenCalledTimes(2);
    expectNoNotice();
  });

  it("[spec] W-C7 다른 일기를 목록에서 열면 앞 안내는 사라지고 그 일기의 지난 피드백이 보인다", async () => {
    serverEntries = [pastEntryB()];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = await renderDiary();
    await screen.findByText("지난 일기 요약이에요.");

    await user.click(screen.getByRole("button", { name: "새 일기 쓰기" }));
    queueFeedback({ loopPoints: EARNED_30 });
    await writeAndRequest(user);
    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Quiet park walk/ }));
    await screen.findByText("지난 일기 요약이에요.");
    await flush();

    expect(screen.getByRole("heading", { name: HEADLINE })).toBeInTheDocument();
    expectNoNotice();
  });

  it("[spec] W-C8 화면을 처음 열 때 보이는 지난 피드백에는 안내가 없다", async () => {
    serverEntries = [pastEntryB()];
    await renderDiary();
    await screen.findByText("지난 일기 요약이에요.");

    expect(screen.getByRole("heading", { name: HEADLINE })).toBeInTheDocument();
    expect(api.requestDiaryFeedback).not.toHaveBeenCalled();
    expectNoNotice();
  });

  it("[spec] W-C9 피드백을 받지 못하면 오류 문구가 보이고 안내가 없다", async () => {
    const user = await renderDiary();
    const { ApiError } = await import("../../lib/api");
    api.requestDiaryFeedback.mockRejectedValueOnce(new ApiError("영어일기 피드백을 받지 못했어요.", 502));
    await user.type(screen.getByPlaceholderText(WRITE_PLACEHOLDER), "Today I walked.");
    await user.click(screen.getByRole("button", { name: "AI 피드백 받기" }));

    expect(await screen.findByText("영어일기 피드백을 받지 못했어요.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: HEADLINE })).toBeNull();
    expectNoNotice();
  });

  it("[spec] W-C10 안내와 함께 피드백 결과의 원래 내용(점수 72, 요약, '다시 써보기'·'새 일기')이 그대로 보인다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: EARNED_30 });
    await writeAndRequest(user);

    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("흐름이 자연스러워요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 써보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새 일기" })).toBeInTheDocument();
  });

  it("[spec] W-C11 손님이면 로그인 안내가 보이고 안내가 없으며 피드백을 요청하지 않는다", async () => {
    await renderDiary(false);

    expect(screen.getByText("로그인하고 나만의 영어일기장을 열어보세요.")).toBeInTheDocument();
    expect(api.requestDiaryFeedback).not.toHaveBeenCalled();
    expectNoNotice();
  });

  it("[spec] W-C12a(결정 04-2) '다시 써보기' 중에도 피드백이 보이는 동안 안내가 남는다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: EARNED_30 });
    await writeAndRequest(user);

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);

    expect(screen.getByRole("heading", { name: HEADLINE })).toBeInTheDocument();
    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();
  });

  it("[spec] W-C12b(결정 04-2) '새 일기'로 피드백이 사라지면 안내도 함께 사라진다", async () => {
    const user = await renderDiary();
    queueFeedback({ loopPoints: EARNED_30 });
    await writeAndRequest(user);
    expect(screen.getByText("+30룹 쌓였어요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "새 일기" }));
    await flush();

    expect(screen.queryByRole("heading", { name: HEADLINE })).toBeNull();
    expectNoNotice();
  });
});
