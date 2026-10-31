// [spec] qa 테스트(작업 037-04 월 학습 현황 모달, 리팩터링). 모달을 answer-loop.tsx 밖으로 옮기기 전의 "지금 동작"을 기록한다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// 화면 바깥에서 동작만 보므로, 안쪽을 훅과 컴포넌트로 나눠도 같은 테스트가 그대로 통과해야 한다.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import type { AuthUser, HistoryMonthStatus, MonthStatusDay, TodayWritingStatus } from "../../lib/types";

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
  id: 4401,
  email: "month-status-spec@example.com",
  displayName: "월현황",
  admin: false
};

// 오늘 상태의 날짜(2026-04-15)는 테스트를 돌리는 날과 다르게 골랐다. 이번 달이 기기 날짜가 아니라 오늘 상태 기준인지 보려고.
const TODAY: TodayWritingStatus = {
  date: "2026-04-15",
  completed: true,
  completedSessions: 1,
  startedSessions: 1,
  streakDays: 7,
  totalAnswerSessions: 30,
  totalWrittenSentences: 1234
};

function day(date: string, partial: Partial<MonthStatusDay> = {}): MonthStatusDay {
  return {
    date,
    started: false,
    completed: false,
    startedSessions: 0,
    completedSessions: 0,
    isToday: false,
    ...partial
  };
}

const TODAY_COMPLETED = day("2026-04-15", {
  started: true,
  completed: true,
  startedSessions: 1,
  completedSessions: 1,
  isToday: true
});

function april(todayEntry: MonthStatusDay | null = TODAY_COMPLETED): HistoryMonthStatus {
  return {
    year: 2026,
    month: 4,
    streakDays: 5,
    days: [
      day("2026-04-02", { started: true, completed: true, startedSessions: 2, completedSessions: 2 }),
      day("2026-04-05"),
      day("2026-04-08", { started: true, startedSessions: 1 }),
      ...(todayEntry ? [todayEntry] : [])
    ]
  };
}

const MARCH: HistoryMonthStatus = {
  year: 2026,
  month: 3,
  streakDays: 3,
  days: [day("2026-03-20", { started: true, completed: true, startedSessions: 1, completedSessions: 4 })]
};

const FEBRUARY: HistoryMonthStatus = { year: 2026, month: 2, streakDays: 2, days: [] };

// 달마다 돌려줄 응답. 없는 달은 빈 기록이다. Error를 넣으면 그 달은 실패한다.
let monthResponses: Map<string, HistoryMonthStatus | Error>;

function respondMonthStatus(year: number, month: number): Promise<HistoryMonthStatus> {
  const response = monthResponses.get(`${year}-${month}`);
  if (response instanceof Error) {
    return Promise.reject(response);
  }
  return Promise.resolve(response ?? { year, month, streakDays: 0, days: [] });
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

async function flush() {
  await act(async () => {});
}

// 로그인한 사용자로 첫 화면을 렌더한다. 오늘 상태와 첫 화면 일주일 기록(getMonthStatus를 따로 부르는 다른 기능)이
// 끝난 뒤 getMonthStatus 호출 기록을 비워서, 그 뒤의 호출은 모두 모달이 부른 것만 남게 한다.
async function renderLoggedIn(today: TodayWritingStatus = TODAY) {
  api.getTodayWritingStatus.mockResolvedValue(today);
  const user = userEvent.setup();
  render(<AnswerLoop />);
  const openButton = await screen.findByRole("button", { name: "이번 달 학습 기록 열기" });
  await screen.findByText(`현재 ${today.streakDays}일 연속으로 문장을 차분하게 쌓아가고 계십니다.`);
  const [year, month] = today.date.split("-").map(Number);
  await waitFor(() => expect(api.getMonthStatus).toHaveBeenCalledWith(year, month));
  await flush();
  api.getMonthStatus.mockClear();
  return { user, openButton };
}

async function openLoadedDialog(user: ReturnType<typeof userEvent.setup>, openButton: HTMLElement, monthLabel: string) {
  await user.click(openButton);
  const dialog = await screen.findByRole("dialog", { name: "학습 캘린더" });
  await within(dialog).findByLabelText(`${monthLabel} 달력`);
  return dialog;
}

function byClass(container: HTMLElement, className: string) {
  const found = container.getElementsByClassName(className);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

function monthDisplay(dialog: HTMLElement) {
  return [
    byClass(dialog, styles.monthStatusMonthYear).textContent,
    byClass(dialog, styles.monthStatusMonthValue).textContent
  ];
}

function streakText(dialog: HTMLElement) {
  return within(dialog).getByText("현재 연속 학습일").nextElementSibling?.textContent;
}

// page.module.css의 클래스는 테스트에서 "_<이름>_<파일 해시>"로 나온다. 이 파일의 클래스는 "page:<이름>"으로 바꿔 읽기 쉽게 하고,
// 다른 CSS 파일의 클래스는 그대로 둔다(다른 파일로 옮겨지면 해시가 달라져 드러난다).
// 클래스 문자열 안의 빈칸 수와 순서는 화면에 영향이 없으므로 정렬해 비교한다.
// 스냅숏은 이 class 정리, 반짝임 효과 안쪽 비우기, 붙은 글자 조각 합치기만 하고, 그 밖의 속성, 글자, 요소 구조는 화면 그대로다.
const PAGE_CLASS_SUFFIX = (styles.monthStatusOverlay as string).slice("_monthStatusOverlay".length);

function normalizeClassTokens(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      token.startsWith("_") && token.endsWith(PAGE_CLASS_SUFFIX)
        ? `page:${token.slice(1, token.length - PAGE_CLASS_SUFFIX.length)}`
        : token
    )
    .sort();
}

function classTokens(element: Element) {
  return normalizeClassTokens(element.getAttribute("class") ?? "");
}

function normalizeForSnapshot(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  // 반짝임 효과(StreakSparkleEffect) 안쪽은 motion 애니메이션이 스타일을 계속 바꾸므로 비운다. 효과를 그리는 자리(겉 요소)는 남긴다.
  Array.from(clone.getElementsByClassName(styles.monthStatusSummarySparkleLayer)).forEach((node) => node.replaceChildren());
  [clone, ...Array.from(clone.querySelectorAll("*"))].forEach((node) => {
    const value = node.getAttribute("class");
    if (value !== null) {
      node.setAttribute("class", normalizeClassTokens(value).join(" "));
    }
  });
  // 붙어 있는 글자 조각("5"와 "일")은 화면에서 한 글자열이므로 합친다.
  clone.normalize();
  return clone;
}

describe("[spec] AnswerLoop 월 학습 현황 모달(지금 동작 기록)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.body.style.overflow = "";
    Object.values(api).forEach((mock) => mock.mockReset());
    Object.values(router).forEach((mock) => mock.mockReset());

    monthResponses = new Map<string, HistoryMonthStatus | Error>([
      ["2026-4", april()],
      ["2026-3", MARCH],
      ["2026-2", FEBRUARY]
    ]);

    api.getCurrentUser.mockResolvedValue(USER);
    api.getTodayWritingStatus.mockResolvedValue(TODAY);
    api.getMonthStatus.mockImplementation(respondMonthStatus);
    api.getSavedExpressions.mockResolvedValue([]);
    api.getPrompts.mockResolvedValue([]);
    api.getFeaturedDailyPrompt.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.getDailyPrompts.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.getPromptHints.mockResolvedValue([]);
    api.getWritingDraft.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
  });

  it("[spec] 로그인하지 않았으면 학습 일지 버튼이 비활성이고, 눌러도 모달이 없으며 달 기록을 부르지 않는다", async () => {
    api.getCurrentUser.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<AnswerLoop />);
    // 로그인 확인이 끝나면 첫 화면이 오늘의 추천 질문을 부른다. 그 뒤를 로그인 확인이 끝난 시점으로 본다.
    await waitFor(() => expect(api.getFeaturedDailyPrompt).toHaveBeenCalled());
    await flush();

    const statusButton = screen.getByRole("button", { name: "학습 안내" });
    expect(statusButton).toBeDisabled();
    expect(statusButton).not.toHaveAttribute("aria-haspopup");
    expect(statusButton).not.toHaveAttribute("aria-expanded");
    expect(screen.queryByRole("button", { name: "이번 달 학습 기록 열기" })).not.toBeInTheDocument();

    await user.click(statusButton);
    await flush();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementsByClassName(styles.monthStatusOverlay)).toHaveLength(0);
    expect(api.getMonthStatus).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe("");
  });

  it("[spec] 로그인했으면 버튼이 눌리고, 열면 오늘 상태 날짜의 달을 불러오는 동안 불러오는 중 화면과 오늘 상태의 연속 학습일을 보여 준다", async () => {
    const { user, openButton } = await renderLoggedIn();
    expect(openButton).toBeEnabled();
    expect(openButton).toHaveAttribute("aria-haspopup", "dialog");
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const aprilRequest = deferred<HistoryMonthStatus>();
    api.getMonthStatus.mockImplementationOnce(() => aprilRequest.promise);
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "학습 캘린더" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "month-status-title");
    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(api.getMonthStatus.mock.calls).toEqual([[2026, 4]]);

    expect(monthDisplay(dialog)).toEqual(["2026", "4"]);
    expect(streakText(dialog)).toBe("7일");
    const nextButton = within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" });
    expect(nextButton).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "이전 달 보기" })).toBeEnabled();
    expect(within(dialog).queryByLabelText("2026년 4월 달력")).not.toBeInTheDocument();
    expect(normalizeForSnapshot(byClass(dialog, styles.monthStatusBody))).toMatchInlineSnapshot(`
      <div
        class="page:monthStatusBody"
      >
        <div
          class="page:monthStatusStatePanel"
        >
          <strong>
            달력을 불러오는 중이에요.
          </strong>
          <p>
            선택한 달의 학습 흐름을 정리하고 있어요. 잠시만 기다려 주세요.
          </p>
        </div>
      </div>
    `);

    await act(async () => {
      aprilRequest.resolve(april());
    });

    expect(within(dialog).queryByText("달력을 불러오는 중이에요.")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("2026년 4월 달력")).toBeInTheDocument();
    expect(streakText(dialog)).toBe("5일");
    expect(api.getMonthStatus.mock.calls).toEqual([[2026, 4]]);
  });

  it("[spec] 불러오기를 마친 이번 달 모달의 문구, 구조, 클래스, aria 속성이 지금과 같다(스냅숏)", async () => {
    const { user, openButton } = await renderLoggedIn();
    const dialog = await openLoadedDialog(user, openButton, "2026년 4월");

    const overlay = dialog.parentElement as HTMLElement;
    const main = screen.getByRole("main");
    // 모달은 화면(main)의 맨 끝에 그린다.
    expect(overlay.parentElement).toBe(main);
    expect(main.lastElementChild).toBe(overlay);
    expect(classTokens(overlay)).toEqual(["page:monthStatusOverlay"]);

    const calendar = within(dialog).getByLabelText("2026년 4월 달력");
    // 2026-04-01은 수요일이라 앞에 빈칸 3개, 그 뒤 30일.
    expect(calendar.children).toHaveLength(33);

    expect(normalizeForSnapshot(overlay)).toMatchInlineSnapshot(`
      <div
        class="page:monthStatusOverlay"
      >
        <section
          aria-labelledby="month-status-title"
          aria-modal="true"
          class="page:monthStatusDialog"
          role="dialog"
        >
          <button
            aria-label="학습 캘린더 닫기"
            class="page:monthStatusClose"
            type="button"
          >
            ×
          </button>
          <div
            class="page:monthStatusCopy"
          >
            <div
              class="page:monthStatusBadge"
            >
              전체 이력 달력
            </div>
            <h2
              id="month-status-title"
            >
              학습 캘린더
            </h2>
            <div
              aria-label="달 이동"
              class="page:monthStatusMonthRail"
            >
              <button
                aria-label="이전 달 보기"
                class="page:monthStatusNavButton"
                type="button"
              >
                ‹
              </button>
              <div
                aria-live="polite"
                class="page:monthStatusMonthDisplay"
              >
                <span
                  class="page:monthStatusMonthYear"
                >
                  2026
                </span>
                <strong
                  class="page:monthStatusMonthValue"
                >
                  4
                </strong>
              </div>
              <button
                aria-label="다음 달은 아직 볼 수 없어요"
                class="page:monthStatusNavButton"
                disabled=""
                type="button"
              >
                ›
              </button>
            </div>
            <div
              class="page:monthStatusSummary"
            >
              <div
                class="page:monthStatusSummaryItem"
              >
                <div
                  class="page:monthStatusSummaryCard"
                >
                  <div
                    aria-hidden="true"
                    class="_root_8b5f8d page:monthStatusSummarySparkleLayer"
                  />
                  <div
                    class="page:monthStatusSummaryCopy"
                  >
                    <span>
                      현재 연속 학습일
                    </span>
                    <strong>
                      5일
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            class="page:monthStatusBody"
          >
            <div
              aria-hidden="true"
              class="page:monthStatusWeekdays"
            >
              <span>
                일
              </span>
              <span>
                월
              </span>
              <span>
                화
              </span>
              <span>
                수
              </span>
              <span>
                목
              </span>
              <span>
                금
              </span>
              <span>
                토
              </span>
            </div>
            <div
              aria-label="2026년 4월 달력"
              class="page:monthStatusCalendar"
            >
              <span
                aria-hidden="true"
                class="page:monthStatusEmptyCell"
              />
              <span
                aria-hidden="true"
                class="page:monthStatusEmptyCell"
              />
              <span
                aria-hidden="true"
                class="page:monthStatusEmptyCell"
              />
              <div
                aria-label="2026년 4월 1일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    1
                  </span>
                </span>
              </div>
              <button
                aria-label="2026년 4월 2일, 완료 기록 보기"
                class="page:monthStatusDay page:monthStatusDayCompleted page:monthStatusDayInteractive"
                style="--month-status-day-bg: rgba(229, 106, 31, 0.36); --month-status-day-border: rgba(229, 106, 31, 0.48); --month-status-day-number-color: #8c4617; --month-status-day-state-color: #9a5425;"
                type="button"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    2
                  </span>
                </span>
                <span
                  class="page:monthStatusDayState"
                >
                  완료
                </span>
              </button>
              <div
                aria-label="2026년 4월 3일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    3
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 4일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    4
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 5일, 기록 없음"
                class="page:monthStatusDay"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    5
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 6일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    6
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 7일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    7
                  </span>
                </span>
              </div>
              <button
                aria-label="2026년 4월 8일, 진행 중 기록 보기"
                class="page:monthStatusDay page:monthStatusDayInteractive page:monthStatusDayStarted"
                style="--month-status-day-bg: rgba(255, 229, 179, 0.18); --month-status-day-border: rgba(217, 132, 35, 0.22);"
                type="button"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    8
                  </span>
                </span>
                <span
                  class="page:monthStatusDayState"
                >
                  진행 중
                </span>
              </button>
              <div
                aria-label="2026년 4월 9일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    9
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 10일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    10
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 11일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    11
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 12일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    12
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 13일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    13
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 14일, 기록 없음"
                class="page:monthStatusDay page:monthStatusDayIdle"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    14
                  </span>
                </span>
              </div>
              <button
                aria-label="2026년 4월 15일, 오늘 완료 기록 보기"
                class="page:monthStatusDay page:monthStatusDayCompleted page:monthStatusDayInteractive page:monthStatusDayToday"
                style="--month-status-day-bg: rgba(229, 106, 31, 0.27); --month-status-day-border: rgba(229, 106, 31, 0.36); --month-status-day-number-color: #9d5a25; --month-status-day-state-color: #9f6b3b;"
                type="button"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    15
                  </span>
                </span>
                <span
                  class="page:monthStatusDayState"
                >
                  오늘 완료
                </span>
              </button>
              <div
                aria-label="2026년 4월 16일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    16
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 17일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    17
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 18일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    18
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 19일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    19
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 20일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    20
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 21일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    21
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 22일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    22
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 23일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    23
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 24일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    24
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 25일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    25
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 26일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    26
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 27일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    27
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 28일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    28
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 29일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    29
                  </span>
                </span>
              </div>
              <div
                aria-label="2026년 4월 30일, "
                class="page:monthStatusDay page:monthStatusDayFuture"
              >
                <span
                  class="page:monthStatusDayHeader"
                >
                  <span
                    class="page:monthStatusDayNumber"
                  >
                    30
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    `);
  });

  it.each([
    {
      name: "오늘 완료",
      todayEntry: TODAY_COMPLETED,
      button: "2026년 4월 15일, 오늘 완료 기록 보기",
      label: null,
      visibleState: "오늘 완료",
      classes: [
        "page:monthStatusDay",
        "page:monthStatusDayCompleted",
        "page:monthStatusDayInteractive",
        "page:monthStatusDayToday"
      ]
    },
    {
      name: "오늘 진행 중",
      todayEntry: day("2026-04-15", { started: true, startedSessions: 2, isToday: true }),
      button: "2026년 4월 15일, 오늘 진행 중 기록 보기",
      label: null,
      visibleState: "오늘 진행 중",
      classes: [
        "page:monthStatusDay",
        "page:monthStatusDayInteractive",
        "page:monthStatusDayStarted",
        "page:monthStatusDayToday"
      ]
    },
    {
      name: "오늘(시작 전)",
      todayEntry: day("2026-04-15", { isToday: true }),
      button: null,
      label: "2026년 4월 15일, 오늘",
      visibleState: "오늘",
      classes: ["page:monthStatusDay", "page:monthStatusDayToday"]
    },
    {
      name: "오늘 기록이 응답에 없음",
      todayEntry: null,
      button: null,
      label: "2026년 4월 15일, 기록 없음",
      visibleState: null,
      classes: ["page:monthStatusDay", "page:monthStatusDayIdle"]
    }
  ])("[spec] 오늘 칸은 그날 기록 상태를 따른다: $name", async ({ todayEntry, button, label, visibleState, classes }) => {
    monthResponses.set("2026-4", april(todayEntry));
    const { user, openButton } = await renderLoggedIn();
    const dialog = await openLoadedDialog(user, openButton, "2026년 4월");

    const cell = button
      ? within(dialog).getByRole("button", { name: button })
      : within(dialog).getByLabelText(label as string);
    expect(cell.tagName).toBe(button ? "BUTTON" : "DIV");
    expect(classTokens(cell)).toEqual(classes);
    expect(byClass(cell, styles.monthStatusDayNumber).textContent).toBe("15");
    const stateNodes = cell.getElementsByClassName(styles.monthStatusDayState);
    if (visibleState === null) {
      expect(stateNodes).toHaveLength(0);
    } else {
      expect(stateNodes).toHaveLength(1);
      expect(stateNodes[0].textContent).toBe(visibleState);
    }
  });

  it("[spec] 불러오기에 실패하면 실패 화면을 보여 주고 연속 학습일은 0일이며, 다른 달을 불러오면 실패 화면이 사라진다", async () => {
    monthResponses.set("2026-4", new Error("서버 오류"));
    const { user, openButton } = await renderLoggedIn();
    await user.click(openButton);
    const dialog = await screen.findByRole("dialog", { name: "학습 캘린더" });

    await within(dialog).findByText("달력을 불러오지 못했어요.");
    expect(within(dialog).getByText("학습 기록을 불러오지 못했어요.")).toBeInTheDocument();
    expect(within(dialog).queryByText("달력을 불러오는 중이에요.")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("2026년 4월 달력")).not.toBeInTheDocument();
    expect(dialog.getElementsByClassName(styles.monthStatusWeekdays)).toHaveLength(0);
    expect(streakText(dialog)).toBe("0일");
    expect(monthDisplay(dialog)).toEqual(["2026", "4"]);
    expect(normalizeForSnapshot(byClass(dialog, styles.monthStatusBody))).toMatchInlineSnapshot(`
      <div
        class="page:monthStatusBody"
      >
        <div
          class="page:monthStatusStatePanel"
        >
          <strong>
            달력을 불러오지 못했어요.
          </strong>
          <p>
            학습 기록을 불러오지 못했어요.
          </p>
        </div>
      </div>
    `);

    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));
    await within(dialog).findByLabelText("2026년 3월 달력");
    expect(within(dialog).queryByText("달력을 불러오지 못했어요.")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("학습 기록을 불러오지 못했어요.")).not.toBeInTheDocument();
    expect(streakText(dialog)).toBe("3일");
    expect(api.getMonthStatus.mock.calls).toEqual([
      [2026, 4],
      [2026, 3]
    ]);
  });

  it("[spec] 이전 달·다음 달로 옮기면 그 달을 다시 불러오고, 이번 달이면 다음 달 버튼이 비활성이고 이름이 '다음 달은 아직 볼 수 없어요'다", async () => {
    const { user, openButton } = await renderLoggedIn();
    const dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    expect(within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "다음 달 보기" })).not.toBeInTheDocument();

    // 이전 달(3월): 불러오는 동안 달 표시는 옮긴 달, 연속 학습일은 오늘 상태 값이다.
    const marchRequest = deferred<HistoryMonthStatus>();
    api.getMonthStatus.mockImplementationOnce(() => marchRequest.promise);
    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));
    expect(monthDisplay(dialog)).toEqual(["2026", "3"]);
    expect(within(dialog).getByText("달력을 불러오는 중이에요.")).toBeInTheDocument();
    expect(streakText(dialog)).toBe("7일");
    expect(within(dialog).getByRole("button", { name: "다음 달 보기" })).toBeEnabled();
    expect(within(dialog).queryByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).not.toBeInTheDocument();
    await act(async () => {
      marchRequest.resolve(MARCH);
    });
    expect(within(dialog).getByLabelText("2026년 3월 달력")).toBeInTheDocument();
    expect(streakText(dialog)).toBe("3일");
    // 3월 1일은 일요일이라 앞 빈칸 없이 31일.
    expect(within(dialog).getByLabelText("2026년 3월 달력").children).toHaveLength(31);
    expect(within(dialog).getByRole("button", { name: "2026년 3월 20일, 완료 기록 보기" })).toBeInTheDocument();

    // 한 달 더 이전(2월)
    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));
    await within(dialog).findByLabelText("2026년 2월 달력");
    expect(monthDisplay(dialog)).toEqual(["2026", "2"]);
    expect(streakText(dialog)).toBe("2일");
    expect(within(dialog).getByRole("button", { name: "다음 달 보기" })).toBeEnabled();

    // 다음 달(3월), 다시 다음 달(4월 = 이번 달)
    await user.click(within(dialog).getByRole("button", { name: "다음 달 보기" }));
    await within(dialog).findByLabelText("2026년 3월 달력");
    expect(monthDisplay(dialog)).toEqual(["2026", "3"]);
    await user.click(within(dialog).getByRole("button", { name: "다음 달 보기" }));
    await within(dialog).findByLabelText("2026년 4월 달력");
    expect(monthDisplay(dialog)).toEqual(["2026", "4"]);
    expect(streakText(dialog)).toBe("5일");
    expect(within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).toBeDisabled();

    expect(api.getMonthStatus.mock.calls).toEqual([
      [2026, 4],
      [2026, 3],
      [2026, 2],
      [2026, 3],
      [2026, 4]
    ]);
  });

  it("[spec] 1월에서 이전 달로 가면 전년 12월을 불러온다", async () => {
    monthResponses.set("2026-1", { year: 2026, month: 1, streakDays: 4, days: [] });
    monthResponses.set("2025-12", { year: 2025, month: 12, streakDays: 4, days: [] });
    const { user, openButton } = await renderLoggedIn({ ...TODAY, date: "2026-01-10" });
    const dialog = await openLoadedDialog(user, openButton, "2026년 1월");
    expect(monthDisplay(dialog)).toEqual(["2026", "1"]);
    expect(within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));
    await within(dialog).findByLabelText("2025년 12월 달력");
    expect(monthDisplay(dialog)).toEqual(["2025", "12"]);
    expect(within(dialog).getByRole("button", { name: "다음 달 보기" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "다음 달 보기" }));
    await within(dialog).findByLabelText("2026년 1월 달력");
    expect(within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).toBeDisabled();
    expect(api.getMonthStatus.mock.calls).toEqual([
      [2026, 1],
      [2025, 12],
      [2026, 1]
    ]);
  });

  it("[spec] 오늘 상태를 불러오지 못하면 이번 달은 기기 날짜 기준이다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 20, 10, 0, 0));
    api.getTodayWritingStatus.mockRejectedValue(new Error("오늘 상태 실패"));
    const user = userEvent.setup();
    render(<AnswerLoop />);
    const openButton = await screen.findByRole("button", { name: "이번 달 학습 기록 열기" });
    await waitFor(() => expect(api.getTodayWritingStatus).toHaveBeenCalled());
    await waitFor(() => expect(api.getMonthStatus).toHaveBeenCalledWith(2026, 8));
    await flush();
    api.getMonthStatus.mockClear();

    await user.click(openButton);
    const dialog = await screen.findByRole("dialog", { name: "학습 캘린더" });
    await within(dialog).findByLabelText("2026년 8월 달력");
    expect(monthDisplay(dialog)).toEqual(["2026", "8"]);
    expect(within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).toBeDisabled();
    expect(api.getMonthStatus.mock.calls).toEqual([[2026, 8]]);
  });

  it("[spec] 오늘 상태가 오기 전에 열면 기기 날짜의 달을 열고, 오늘 상태가 오면 연 달을 다시 불러오며 다음 달 버튼은 새 이번 달 기준이다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 20, 10, 0, 0));
    const todayRequest = deferred<TodayWritingStatus>();
    api.getTodayWritingStatus.mockImplementation(() => todayRequest.promise);
    const user = userEvent.setup();
    render(<AnswerLoop />);
    const openButton = await screen.findByRole("button", { name: "이번 달 학습 기록 열기" });
    await waitFor(() => expect(api.getMonthStatus).toHaveBeenCalledWith(2026, 8));
    await flush();
    api.getMonthStatus.mockClear();

    await user.click(openButton);
    const dialog = await screen.findByRole("dialog", { name: "학습 캘린더" });
    await within(dialog).findByLabelText("2026년 8월 달력");
    expect(within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).toBeDisabled();
    expect(api.getMonthStatus.mock.calls).toEqual([[2026, 8]]);

    await act(async () => {
      todayRequest.resolve(TODAY);
    });
    await screen.findByText(`현재 ${TODAY.streakDays}일 연속으로 문장을 차분하게 쌓아가고 계십니다.`);
    await within(dialog).findByLabelText("2026년 8월 달력");
    await flush();

    // (2026, 4)는 첫 화면 일주일 기록(다른 기능)이 오늘 상태를 받고 부른 것이다. 기능 사이의 호출 순서는 기록하지 않는다.
    expect([...api.getMonthStatus.mock.calls].sort()).toEqual([
      [2026, 4],
      [2026, 8],
      [2026, 8]
    ]);
    expect(monthDisplay(dialog)).toEqual(["2026", "8"]);
    expect(within(dialog).queryByText("달력을 불러오는 중이에요.")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "다음 달 보기" })).toBeEnabled();
  });

  it("[spec] 닫기 버튼으로 닫는다. 열린 동안 본문 스크롤이 잠기고 닫기 버튼에 포커스가 가며, 닫으면 스크롤이 앞 값으로 풀리고 포커스가 열기 버튼으로 돌아간다", async () => {
    document.body.style.overflow = "auto";
    const { user, openButton } = await renderLoggedIn();
    expect(document.body.style.overflow).toBe("auto");

    const dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    expect(document.body.style.overflow).toBe("hidden");
    const closeButton = within(dialog).getByRole("button", { name: "학습 캘린더 닫기" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.click(closeButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("auto");
    await waitFor(() => expect(openButton).toHaveFocus());
  });

  it("[spec] 배경을 누르면 닫히고, 대화상자 안을 누르면 닫히지 않는다", async () => {
    const { user, openButton } = await renderLoggedIn();
    const dialog = await openLoadedDialog(user, openButton, "2026년 4월");

    await user.click(within(dialog).getByRole("heading", { name: "학습 캘린더" }));
    await user.click(within(dialog).getByLabelText("2026년 4월 5일, 기록 없음"));
    expect(screen.getByRole("dialog", { name: "학습 캘린더" })).toBe(dialog);
    expect(openButton).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(router.push).not.toHaveBeenCalled();

    await user.click(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(openButton).toHaveFocus());
  });

  it("[spec] Escape를 누르면 닫히고 포커스가 열기 버튼으로 돌아간다. 포커스가 대화상자 밖(본문)에 있어도 닫힌다", async () => {
    const { user, openButton } = await renderLoggedIn();
    let dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "학습 캘린더 닫기" })).toHaveFocus());

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(openButton).toHaveFocus());

    // 다시 열고, 포커스를 받지 않는 제목을 눌러 포커스를 본문으로 보낸 뒤 Escape.
    dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "학습 캘린더 닫기" })).toHaveFocus());
    await user.click(within(dialog).getByRole("heading", { name: "학습 캘린더" }));
    expect(document.activeElement).toBe(document.body);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("[spec] 앞 달의 응답이 늦게 와도 지금 고른 달을 보여 준다", async () => {
    const { user, openButton } = await renderLoggedIn();
    const aprilRequest = deferred<HistoryMonthStatus>();
    const marchRequest = deferred<HistoryMonthStatus>();
    api.getMonthStatus.mockImplementationOnce(() => aprilRequest.promise);
    api.getMonthStatus.mockImplementationOnce(() => marchRequest.promise);
    await user.click(openButton);
    const dialog = screen.getByRole("dialog", { name: "학습 캘린더" });
    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));

    // 4월 응답이 3월보다 먼저 와도 무시되고, 3월을 불러오는 중으로 남는다.
    await act(async () => {
      aprilRequest.resolve(april());
    });
    expect(monthDisplay(dialog)).toEqual(["2026", "3"]);
    expect(within(dialog).getByText("달력을 불러오는 중이에요.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("2026년 4월 달력")).not.toBeInTheDocument();
    expect(streakText(dialog)).toBe("7일");

    await act(async () => {
      marchRequest.resolve(MARCH);
    });
    expect(within(dialog).getByLabelText("2026년 3월 달력")).toBeInTheDocument();
    expect(streakText(dialog)).toBe("3일");

    // 다음 달(4월)을 부르고 곧바로 이전 달(3월)로 돌아간다. 3월 응답이 먼저 오고 4월 응답이 뒤에 와도 3월 그대로다.
    const lateAprilRequest = deferred<HistoryMonthStatus>();
    const secondMarchRequest = deferred<HistoryMonthStatus>();
    api.getMonthStatus.mockImplementationOnce(() => lateAprilRequest.promise);
    api.getMonthStatus.mockImplementationOnce(() => secondMarchRequest.promise);
    await user.click(within(dialog).getByRole("button", { name: "다음 달 보기" }));
    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));
    await act(async () => {
      secondMarchRequest.resolve(MARCH);
    });
    await act(async () => {
      lateAprilRequest.resolve(april());
    });
    expect(monthDisplay(dialog)).toEqual(["2026", "3"]);
    expect(within(dialog).getByLabelText("2026년 3월 달력")).toBeInTheDocument();
    expect(within(dialog).queryByText("달력을 불러오는 중이에요.")).not.toBeInTheDocument();
    expect(streakText(dialog)).toBe("3일");

    expect(api.getMonthStatus.mock.calls).toEqual([
      [2026, 4],
      [2026, 3],
      [2026, 4],
      [2026, 3]
    ]);
  });

  it("[spec] 다른 달로 옮긴 뒤 닫고 다시 열면 이번 달을 다시 불러온다", async () => {
    const { user, openButton } = await renderLoggedIn();
    let dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));
    await within(dialog).findByLabelText("2026년 3월 달력");
    await user.click(within(dialog).getByRole("button", { name: "학습 캘린더 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    expect(monthDisplay(dialog)).toEqual(["2026", "4"]);
    expect(within(dialog).getByRole("button", { name: "다음 달은 아직 볼 수 없어요" })).toBeDisabled();
    expect(api.getMonthStatus.mock.calls).toEqual([
      [2026, 4],
      [2026, 3],
      [2026, 4]
    ]);
  });

  it("[spec] 기록이 있는 날을 누르면 모달을 닫고 /me?tab=writing&date=<날짜>로 이동한다", async () => {
    const { user, openButton } = await renderLoggedIn();
    let dialog = await openLoadedDialog(user, openButton, "2026년 4월");

    // 기록 없는 날과 앞으로 올 날은 버튼이 아니라서 눌러도 이동하지 않는다.
    expect(within(dialog).queryByRole("button", { name: /2026년 4월 5일/ })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("2026년 4월 16일,")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /2026년 4월 16일/ })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "2026년 4월 2일, 완료 기록 보기" }));
    expect(router.push.mock.calls).toEqual([["/me?tab=writing&date=2026-04-02"]]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");

    dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    await user.click(within(dialog).getByRole("button", { name: "2026년 4월 8일, 진행 중 기록 보기" }));
    expect(router.push.mock.calls).toEqual([
      ["/me?tab=writing&date=2026-04-02"],
      ["/me?tab=writing&date=2026-04-08"]
    ]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // 옮긴 달의 날도 그 날짜로 이동한다.
    dialog = await openLoadedDialog(user, openButton, "2026년 4월");
    await user.click(within(dialog).getByRole("button", { name: "이전 달 보기" }));
    await within(dialog).findByLabelText("2026년 3월 달력");
    await user.click(within(dialog).getByRole("button", { name: "2026년 3월 20일, 완료 기록 보기" }));
    expect(router.push.mock.calls).toEqual([
      ["/me?tab=writing&date=2026-04-02"],
      ["/me?tab=writing&date=2026-04-08"],
      ["/me?tab=writing&date=2026-03-20"]
    ]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
