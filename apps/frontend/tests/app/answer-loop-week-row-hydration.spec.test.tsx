// [spec] qa 테스트(작업 045 웹 요일 줄 hydration, 버그 수정). 재현 테스트.
// 첫 화면은 빌드할 때 미리 그려 두고(정적 생성) 브라우저가 이어받는다(hydration). 학습 일지의 '오늘까지 7일' 요일 줄을
// 미리 그릴 때의 날짜로 그리면, 다른 날 열었을 때 브라우저가 그린 요일과 달라 hydration 오류(#418)가 난다.
// 여기서는 미리 그리기(react-dom/server)와 브라우저 이어받기(hydrateRoot)를 서로 다른 기기 날짜로 해서 그 상황을 만든다.
// API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
//
// 명세(01-main-spec.md "고칠 동작")에서 가져온 기대 결과:
//   - 미리 그릴 때는 요일 글자와 오늘 표시 없이 빈 칸 7개를 그린다.
//   - 미리 그린 날과 다른 날 이어받아도 hydration 오류가 나지 않는다.
//   - 화면이 뜬 직후 그 기기의 오늘 기준으로 채운다.
//   - 로그인 사용자는 서버 오늘 상태가 오면 그 날짜 기준으로 바뀐다.
import { act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import type { AuthUser, FeaturedDailyPromptRecommendation, HistoryMonthStatus, Prompt, TodayWritingStatus } from "../../lib/types";

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
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />
}));

const USER: AuthUser = {
  id: 4511,
  email: "week-row-hydration-spec@example.com",
  displayName: "요일줄",
  admin: false
};

const GUEST_ID = "guest-week-row-hydration-spec-0001";

// 미리 그린 날(빌드한 날): 2026-08-20 목요일. 이 날로 그리면 요일 줄은 금 토 일 월 화 수 목(오늘=목)이다.
const BUILD_DATE = new Date(2026, 7, 20, 10, 0, 0);
// 브라우저에서 연 날(기기 날짜): 2026-08-21 금요일. 요일 줄은 08-15(토)부터 08-21(금)까지, 오늘=금.
const OPEN_DATE = new Date(2026, 7, 21, 10, 0, 0);

// 로그인 사용자의 서버 오늘 상태. 기기 날짜(08-21)와 다른 2026-04-15(수)로 골랐다. 요일 줄은 04-09(목)부터 04-15(수)까지.
const TODAY: TodayWritingStatus = {
  date: "2026-04-15",
  completed: false,
  completedSessions: 0,
  startedSessions: 0,
  streakDays: 0,
  totalAnswerSessions: 3,
  totalWrittenSentences: 40
};

// 4월 기록: 13일(월)만 완료.
const APRIL: HistoryMonthStatus = {
  year: 2026,
  month: 4,
  streakDays: 0,
  days: [
    { date: "2026-04-13", started: true, completed: true, startedSessions: 1, completedSessions: 1, isToday: false }
  ]
};

const STREAK_TEXT = `현재 ${TODAY.streakDays}일 연속으로 문장을 차분하게 쌓아가고 계십니다.`;

const P_F: Prompt = {
  id: "prompt-week-row-featured",
  topic: "Hobby",
  topicCategory: "Daily life",
  topicDetail: "Hobby",
  difficulty: "B",
  questionEn: "What hobby would you like to try this year?",
  questionKo: "올해 해 보고 싶은 취미는 무엇인가요?",
  tip: ""
};

const FEATURED: FeaturedDailyPromptRecommendation = {
  recommendedDate: "2026-08-21",
  difficulty: "I",
  featured: {
    slot: "featured",
    prompt: P_F,
    reasonCode: "SPEC",
    reasonText: "요즘 쓴 답과 이어지는 주제예요.",
    reasonFacts: [],
    score: 1
  }
};

const PAGE_CLASS_SUFFIX = (styles.pickFlow as string).slice("_pickFlow".length);

function pageClassTokens(element: Element) {
  return (element.getAttribute("class") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      token.startsWith("_") && token.endsWith(PAGE_CLASS_SUFFIX)
        ? `page:${token.slice(1, token.length - PAGE_CLASS_SUFFIX.length)}`
        : token
    )
    .sort();
}

function weekRowElement(container: Element) {
  const found = container.getElementsByClassName(styles.difficultyHomeWeekRow);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

// 요일 줄: 날마다 [글자, 클래스].
function weekRow(container: Element) {
  return Array.from(weekRowElement(container).children).map((day) => [day.textContent, pageClassTokens(day)]);
}

type ConsoleErrorSpy = { mock: { calls: unknown[][] }; mockRestore: () => void };

let container: HTMLDivElement | null = null;
let root: Root | null = null;

// 기기 날짜를 buildDate로 두고 미리 그린 뒤(빌드), 기기 날짜를 openDate로 바꿔 브라우저가 이어받게 한다.
async function prerenderThenHydrate(buildDate: Date, openDate: Date) {
  vi.setSystemTime(buildDate);
  const html = renderToString(<AnswerLoop />);

  container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  vi.setSystemTime(openDate);
  const recoverableErrors: unknown[] = [];
  const target = container;
  await act(async () => {
    root = hydrateRoot(target, <AnswerLoop />, {
      onRecoverableError: (error) => {
        recoverableErrors.push(error);
      }
    });
  });
  return { html, recoverableErrors };
}

function hydrationConsoleErrors(spy: ConsoleErrorSpy) {
  return spy.mock.calls
    .map((args: unknown[]) => args.map((arg) => String(arg)).join(" "))
    .filter((message: string) => /hydrat/i.test(message));
}

describe("[spec] 첫 화면 요일 줄: 미리 그린 날과 다른 날 열어도 hydration 오류가 나지 않는다(재현)", () => {
  let consoleErrorSpy: ConsoleErrorSpy;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("writeloop_guest_id", GUEST_ID);
    window.history.replaceState({}, "", "/");
    Object.values(api).forEach((mock) => mock.mockReset());
    Object.values(router).forEach((mock) => mock.mockReset());

    api.getCurrentUser.mockResolvedValue(null);
    api.getTodayWritingStatus.mockResolvedValue(TODAY);
    api.getMonthStatus.mockImplementation((year: number, month: number) =>
      Promise.resolve(year === 2026 && month === 4 ? APRIL : { year, month, streakDays: 0, days: [] })
    );
    api.getSavedExpressions.mockResolvedValue([]);
    api.getPrompts.mockResolvedValue([P_F]);
    api.getFeaturedDailyPrompt.mockResolvedValue(FEATURED);
    api.getDailyPrompts.mockResolvedValue({ recommendedDate: "2026-08-21", difficulty: "I", featured: null, prompts: [P_F] });
    api.getPromptHints.mockResolvedValue([]);
    api.getWritingDraft.mockResolvedValue(null);
    api.deleteWritingDraft.mockResolvedValue(undefined);
    api.trackDailyPromptClick.mockResolvedValue(undefined);

    consoleErrorSpy = vi.spyOn(console, "error");
  });

  afterEach(async () => {
    const mounted = root;
    root = null;
    if (mounted) {
      await act(async () => {
        mounted.unmount();
      });
    }
    container?.remove();
    container = null;
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("[spec] 미리 그린 화면(서버 렌더)의 요일 줄은 요일 글자와 오늘 표시 없는 빈 칸 7개다", () => {
    vi.setSystemTime(BUILD_DATE);
    const html = renderToString(<AnswerLoop />);
    const parsed = document.createElement("div");
    parsed.innerHTML = html;

    const days = Array.from(weekRowElement(parsed).children);
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.textContent)).toEqual(["", "", "", "", "", "", ""]);
    expect(days.filter((day) => pageClassTokens(day).includes("page:difficultyHomeWeekDayToday"))).toEqual([]);
  });

  it("[spec] 로그인 안 함: 08-20(목)에 미리 그리고 08-21(금)에 열면 hydration 오류가 없고, 요일 줄이 기기 날짜(08-21) 기준으로 채워진다", async () => {
    const { recoverableErrors } = await prerenderThenHydrate(BUILD_DATE, OPEN_DATE);
    await waitFor(() => expect(api.getFeaturedDailyPrompt).toHaveBeenCalled());

    await waitFor(() =>
      expect(weekRow(container!)).toEqual([
        ["토", ["page:difficultyHomeWeekDay"]],
        ["일", ["page:difficultyHomeWeekDay"]],
        ["월", ["page:difficultyHomeWeekDay"]],
        ["화", ["page:difficultyHomeWeekDay"]],
        ["수", ["page:difficultyHomeWeekDay"]],
        ["목", ["page:difficultyHomeWeekDay"]],
        ["금", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayToday"]]
      ])
    );

    expect(recoverableErrors.map((error) => String(error))).toEqual([]);
    expect(hydrationConsoleErrors(consoleErrorSpy)).toEqual([]);
  });

  it("[spec] 로그인: 08-20(목)에 미리 그리고 08-21(금)에 열면 hydration 오류가 없고, 서버 오늘 상태(04-15)가 오면 그 날짜 기준 요일 줄(완료 표시 포함)로 바뀐다", async () => {
    api.getCurrentUser.mockResolvedValue(USER);

    const { recoverableErrors } = await prerenderThenHydrate(BUILD_DATE, OPEN_DATE);
    await waitFor(() => expect(container!.textContent).toContain(STREAK_TEXT));
    await waitFor(() => expect(api.getMonthStatus).toHaveBeenCalledWith(2026, 4));

    await waitFor(() =>
      expect(weekRow(container!)).toEqual([
        ["목", ["page:difficultyHomeWeekDay"]],
        ["금", ["page:difficultyHomeWeekDay"]],
        ["토", ["page:difficultyHomeWeekDay"]],
        ["일", ["page:difficultyHomeWeekDay"]],
        ["월", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayDone"]],
        ["화", ["page:difficultyHomeWeekDay"]],
        ["수", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayToday"]]
      ])
    );

    expect(recoverableErrors.map((error) => String(error))).toEqual([]);
    expect(hydrationConsoleErrors(consoleErrorSpy)).toEqual([]);
  });
});
