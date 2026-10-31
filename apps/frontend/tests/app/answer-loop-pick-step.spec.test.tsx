// [spec] qa 테스트(작업 037-11 질문 고르기 화면, 리팩터링). 질문 고르기 단계(난이도 고르기 화면, 질문 목록 화면, 이어 쓰기 카드)를
// answer-loop.tsx 밖의 컴포넌트로 옮기기 전의 "지금 동작"을 기록한다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// 화면 바깥에서 동작만 보므로, 안쪽을 컴포넌트로 나눠도 같은 테스트가 그대로 통과해야 한다.
//
// 이미 다른 qa 테스트가 기록한 것은 다시 쓰지 않는다(웹 테스트 전체 실행에 들어 있다).
//   - 월 학습 현황 모달 안쪽: answer-loop-month-status.spec.test.tsx
//   - 난이도를 바꾸면 코치 상태를 비움, 난이도 화면에서 켠 가이드가 질문을 열면 닫힘: answer-loop-coach-assistant.spec.test.tsx
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import type { IncompleteLoopState } from "../../lib/incomplete-loop";
import type {
  AuthUser,
  DailyPromptRecommendation,
  FeaturedDailyPromptRecommendation,
  Feedback,
  HistoryMonthStatus,
  HomeDraftSnapshot,
  Prompt,
  PromptRecommendationItem,
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
  id: 5111,
  email: "pick-step-spec@example.com",
  displayName: "질문고르기",
  admin: false
};

// 로그인한 사용자도 게스트 id를 가진다(오늘의 질문 요청, 질문 고르기 기록에 실린다). 형식 검사(guest-[a-z0-9-]{18,})를 통과하는 값.
const GUEST_ID = "guest-pick-step-spec-000000000001";

// 2026-04-15는 수요일. 이번 주 기록 줄은 04-09(목)부터 04-15(수)까지다.
const TODAY: TodayWritingStatus = {
  date: "2026-04-15",
  completed: true,
  completedSessions: 1,
  startedSessions: 1,
  streakDays: 3,
  totalAnswerSessions: 12,
  totalWrittenSentences: 1234
};

// 4월 기록: 10일·13일·15일 완료, 12일은 시작만 했다(완료가 아니라 이번 주 줄에 표시하지 않는다).
const APRIL: HistoryMonthStatus = {
  year: 2026,
  month: 4,
  streakDays: 1,
  days: [
    { date: "2026-04-10", started: true, completed: true, startedSessions: 1, completedSessions: 1, isToday: false },
    { date: "2026-04-12", started: true, completed: false, startedSessions: 1, completedSessions: 0, isToday: false },
    { date: "2026-04-13", started: true, completed: true, startedSessions: 1, completedSessions: 2, isToday: false },
    { date: "2026-04-15", started: true, completed: true, startedSessions: 1, completedSessions: 1, isToday: true }
  ]
};

function prompt(id: string, difficulty: Prompt["difficulty"], topic: string, questionEn: string, questionKo: string): Prompt {
  return {
    id,
    topic,
    topicCategory: "Daily life",
    topicDetail: topic,
    difficulty,
    questionEn,
    questionKo,
    tip: ""
  };
}

const P_I1 = prompt("prompt-pick-i1", "I", "Breakfast", "What do you usually eat for breakfast?", "아침으로 보통 무엇을 먹나요?");
const P_I2 = prompt("prompt-pick-i2", "I", "Weekend", "How did you spend last weekend?", "지난 주말을 어떻게 보냈나요?");
// 카드의 data-tone이 고른 난이도가 아니라 질문의 난이도를 따르는지 보려고, 입문 목록에 난이도 보통인 질문을 하나 넣었다.
const P_I3 = prompt("prompt-pick-i3", "B", "Pets", "Would you like to have a pet someday?", "언젠가 반려동물을 키우고 싶나요?");
const P_N1 = prompt("prompt-pick-n1", "I", "Commute", "How do you get to work or school?", "회사나 학교에 어떻게 가나요?");
const P_N2 = prompt("prompt-pick-n2", "I", "Music", "What song have you listened to a lot lately?", "요즘 많이 들은 노래는 무엇인가요?");
const P_N3 = prompt("prompt-pick-n3", "I", "Cooking", "What dish can you cook well?", "잘 만드는 요리는 무엇인가요?");
const P_A1 = prompt("prompt-pick-a1", "A", "Shopping", "What did you buy recently?", "최근에 무엇을 샀나요?");
const P_A2 = prompt("prompt-pick-a2", "A", "Sleep", "What time do you usually go to bed?", "보통 몇 시에 자나요?");
// 첫 화면 오늘의 추천 질문. 난이도가 보통이고 전체 질문 목록(getPrompts)에 있다.
const P_F = prompt("prompt-pick-featured", "B", "Hobby", "What hobby would you like to try this year?", "올해 해 보고 싶은 취미는 무엇인가요?");

const ALL_PROMPTS = [P_I1, P_I2, P_I3, P_A1, P_A2, P_F];

function item(target: Prompt, reasonText: string): PromptRecommendationItem {
  return {
    slot: "featured",
    prompt: target,
    reasonCode: "SPEC",
    reasonText,
    reasonFacts: [],
    score: 1
  };
}

const DAILY_I: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  featured: item(P_I2, "입문 목록의 추천"),
  prompts: [P_I1, P_I2, P_I3]
};

const DAILY_I_NEXT: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  featured: null,
  prompts: [P_N1, P_N2]
};

const DAILY_I_THIRD: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  featured: item(P_N3, "세 번째 목록의 추천"),
  prompts: [P_N3]
};

const DAILY_A: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "A",
  featured: item(P_A1, "쉬움 목록의 추천"),
  prompts: [P_A1, P_A2]
};

const FEATURED_REASON = "요즘 쓴 답과 이어지는 주제예요.";

const FEATURED_I: FeaturedDailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  featured: item(P_F, FEATURED_REASON)
};

const FEATURED_A: FeaturedDailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "A",
  featured: item(P_A2, "쉬움 난이도의 오늘 추천")
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const STREAK_TEXT = `현재 ${TODAY.streakDays}일 연속으로 문장을 차분하게 쌓아가고 계십니다.`;
const REFRESH_ERROR = "이 난이도에서 새로 보여드릴 질문을 아직 고르지 못했어요.";
const RESUME_MESSAGE = "이어서 쓰던 흐름을 불러왔어요.";

// 이어 쓰기 저장 시각. 기기 시간대와 관계없이 그 시간대의 09:05가 되도록 만든다.
// 화면 문구는 toLocaleTimeString("ko-KR", 2자리 시·분)이고, 그 글자는 실행 환경의 ICU에 따라 달라서 같은 계산으로 기대값을 만든다.
const RESUME_SAVED_AT = new Date(2026, 3, 15, 9, 5, 0).toISOString();
const RESUME_SAVED_AT_LABEL = new Date(RESUME_SAVED_AT).toLocaleTimeString("ko-KR", {
  hour: "2-digit",
  minute: "2-digit"
});

type User = ReturnType<typeof userEvent.setup>;

function feedbackFor(target: Prompt, sessionId: string, attemptNo: number): Feedback {
  return {
    promptId: target.id,
    sessionId,
    attemptNo,
    loopComplete: false,
    completionMessage: null,
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: null,
    refinementExpressions: null,
    modelAnswer: "",
    rewriteChallenge: ""
  };
}

function snapshotFor(target: Prompt, partial: Partial<HomeDraftSnapshot>): HomeDraftSnapshot {
  return {
    selectedDifficulty: target.difficulty as HomeDraftSnapshot["selectedDifficulty"],
    selectedPromptId: target.id,
    sessionId: "",
    answer: "",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    ...partial
  };
}

function draftFor(target: Prompt, partial: Partial<WritingDraft>): WritingDraft {
  return {
    promptId: target.id,
    draftType: "ANSWER",
    updatedAt: "2026-04-15T09:00:00Z",
    selectedDifficulty: target.difficulty as WritingDraft["selectedDifficulty"],
    selectedPromptId: target.id,
    sessionId: "",
    answer: "",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    ...partial
  };
}

function incompleteLoopFor(target: Prompt, partial: Partial<IncompleteLoopState>): IncompleteLoopState {
  return {
    promptId: target.id,
    difficulty: target.difficulty as IncompleteLoopState["difficulty"],
    step: "answer",
    draftType: "ANSWER",
    updatedAt: RESUME_SAVED_AT,
    promptSnapshot: { topic: target.topic, questionEn: target.questionEn, questionKo: target.questionKo },
    snapshot: null,
    ...partial
  };
}

// 이어 쓰기 상태는 브라우저 저장소에 사용자별로 둔다(lib/incomplete-loop).
function storeIncompleteLoop(state: IncompleteLoopState, ownerId: number | null = USER.id) {
  const scope = ownerId ? `user:${ownerId}` : "guest";
  window.localStorage.setItem(`writeloop_incomplete_loop:${scope}`, JSON.stringify(state));
}

// 서버의 쓰기 초안. "<질문 id>:<ANSWER|REWRITE>"마다 하나. 테스트 중에 넣는다.
let drafts: Map<string, WritingDraft>;

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

// page.module.css의 클래스는 테스트에서 "_<이름>_<파일 해시>"로 나온다. 이 파일의 클래스는 "page:<이름>"으로 바꿔 읽기 쉽게 하고,
// 다른 CSS 파일의 클래스는 그대로 둔다(다른 파일로 옮겨지면 해시가 달라져 드러난다).
// 클래스 문자열 안의 빈칸 수와 순서는 화면에 영향이 없으므로 정렬해 비교한다.
const PAGE_CLASS_SUFFIX = (styles.pickFlow as string).slice("_pickFlow".length);

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

// 스냅숏은 class 정리, 붙은 글자 조각 합치기, 저장 시각 글자를 "{저장 시각}"으로 바꾸기(실행 환경마다 글자가 달라서)만 하고,
// 그 밖의 속성, 글자, 요소 구조는 화면 그대로다.
function normalizeForSnapshot(element: Element) {
  const clone = element.cloneNode(true) as HTMLElement;
  [clone, ...Array.from(clone.querySelectorAll("*"))].forEach((node) => {
    const value = node.getAttribute("class");
    if (value !== null) {
      node.setAttribute("class", normalizeClassTokens(value).join(" "));
    }
  });
  clone.normalize();
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue?.includes(RESUME_SAVED_AT_LABEL)) {
      node.nodeValue = node.nodeValue.split(RESUME_SAVED_AT_LABEL).join("{저장 시각}");
    }
  }
  return clone;
}

function byClass(container: Element, className: string) {
  const found = container.getElementsByClassName(className);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

function main() {
  return screen.getByRole("main");
}

function pickFlow() {
  return byClass(main(), styles.pickFlow);
}

function queryPickFlow() {
  return main().getElementsByClassName(styles.pickFlow)[0] as HTMLElement | undefined;
}

function errorTexts() {
  return Array.from(main().getElementsByClassName(styles.errorText)).map((node) => node.textContent);
}

function statusButton() {
  return byClass(main(), styles.difficultyHomeStatusPanel) as HTMLButtonElement;
}

// 이번 주 기록 줄: 날마다 [글자, 클래스].
function weekRow() {
  return Array.from(byClass(main(), styles.difficultyHomeWeekRow).children).map((day) => [
    day.textContent,
    classTokens(day)
  ]);
}

function featuredSection() {
  return byClass(main(), styles.prefeaturedPromptSection);
}

function featuredCard() {
  return byClass(main(), styles.prefeaturedPromptCard);
}

// 질문 목록 카드마다 [번호, 질문, 배지, 해석, 주제, 해석 버튼 글자, data-tone].
function promptCards() {
  return Array.from(main().getElementsByClassName(styles.promptSelectionCardCompact)).map((card) => [
    card.getElementsByClassName(styles.promptSelectionCardIndex)[0]?.textContent ?? null,
    card.querySelector(`.${styles.promptSelectionCardCopy} > strong`)?.textContent ?? null,
    card.getElementsByClassName(styles.promptSelectionFeaturedBadge)[0]?.textContent ?? null,
    card.getElementsByClassName(styles.translationText)[0]?.textContent ?? null,
    card.getElementsByClassName(styles.promptSelectionCardMeta)[0]?.textContent ?? null,
    card.querySelector("button")?.textContent ?? null,
    card.getAttribute("data-tone")
  ]);
}

function promptCard(target: Prompt) {
  const grid = byClass(main(), styles.promptSelectionCardGrid);
  return within(grid).getByText(target.questionEn, { selector: "strong" }).closest("article") as HTMLElement;
}

// 난이도 카드(이름으로 찾는다). 추천 질문 카드의 이유 글자에도 난이도 이름이 들어갈 수 있어 역할·이름으로 찾지 않는다.
function difficultyCard(label: string) {
  const found = Array.from(main().getElementsByClassName(styles.difficultyHomeCard)).filter(
    (card) => card.querySelector(`.${styles.difficultyHomeCardCopy} > strong`)?.textContent === label
  );
  expect(found).toHaveLength(1);
  return found[0] as HTMLButtonElement;
}

function promptQuestions() {
  return promptCards().map((card) => card[1]);
}

function refreshButton() {
  return within(pickFlow()).getByRole("button", { name: /새 질문|불러오는 중\.\.\./ }) as HTMLButtonElement;
}

function resumeCards() {
  return main().getElementsByClassName(styles.difficultyHomeResumeCard);
}

function composerQuestion() {
  return byClass(main(), styles.writingComposerQuestionText).textContent;
}

// 첫 화면을 렌더한다. 로그인했으면 오늘 상태와 이번 주 기록(4월)을 받을 때까지, 아니면 로그인 확인이 끝나
// 오늘의 추천 질문을 부를 때까지 기다린다. 오늘의 추천 질문 응답은 기다리지 않는다(테스트마다 다르다).
async function renderHome(loggedIn = true) {
  if (!loggedIn) {
    api.getCurrentUser.mockResolvedValue(null);
  }
  const user = userEvent.setup();
  render(<AnswerLoop />);
  await waitFor(() => expect(api.getFeaturedDailyPrompt).toHaveBeenCalled());
  if (loggedIn) {
    await screen.findByText(STREAK_TEXT);
    await waitFor(() => expect(api.getMonthStatus).toHaveBeenCalledWith(2026, 4));
  }
  await flush();
  await flush();
  return user;
}

// 난이도 카드를 눌러 질문 목록을 열고, 첫 질문이 보일 때까지 기다린다.
async function openPromptList(user: User, difficultyLabel: string, firstPrompt: Prompt) {
  await user.click(difficultyCard(difficultyLabel));
  await waitFor(() => expect(promptQuestions()[0]).toBe(firstPrompt.questionEn));
  await flush();
}

async function expectAnswerStepFor(target: Prompt) {
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
  expect(queryPickFlow()).toBeUndefined();
  expect(composerQuestion()).toBe(target.questionEn);
}

// 그 단계의 이어 쓰기를 저장해 두고 첫 화면을 렌더해, 이어 쓰기 카드를 돌려준다. 주제·저장 시각 줄도 여기서 본다.
async function renderResumeCard(step: IncompleteLoopState["step"]) {
  storeIncompleteLoop(incompleteLoopFor(P_I2, { step, draftType: step === "rewrite" ? "REWRITE" : "ANSWER" }));
  await renderHome();
  expect(resumeCards()).toHaveLength(1);
  const card = resumeCards()[0] as HTMLElement;
  expect(byClass(card, styles.difficultyHomeResumeMeta).textContent).toBe(`${P_I2.topic} · ${RESUME_SAVED_AT_LABEL}에 저장`);
  return card;
}

function mockMobileViewport() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

describe("[spec] AnswerLoop 질문 고르기 화면(지금 동작 기록)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("writeloop_guest_id", GUEST_ID);
    window.history.replaceState({}, "", "/");
    document.body.style.overflow = "";
    Object.values(api).forEach((mock) => mock.mockReset());
    Object.values(router).forEach((mock) => mock.mockReset());
    drafts = new Map();

    api.getCurrentUser.mockResolvedValue(USER);
    api.getTodayWritingStatus.mockResolvedValue(TODAY);
    api.getMonthStatus.mockImplementation((year: number, month: number) =>
      Promise.resolve(year === 2026 && month === 4 ? APRIL : { year, month, streakDays: 0, days: [] })
    );
    api.getSavedExpressions.mockResolvedValue([]);
    api.getPrompts.mockResolvedValue(ALL_PROMPTS);
    api.getFeaturedDailyPrompt.mockImplementation((difficulty: string) =>
      Promise.resolve(difficulty === "A" ? FEATURED_A : FEATURED_I)
    );
    api.getDailyPrompts.mockImplementation((difficulty: string) =>
      Promise.resolve(difficulty === "A" ? DAILY_A : DAILY_I)
    );
    api.getPromptHints.mockResolvedValue([]);
    api.getWritingDraft.mockImplementation((promptId: string, draftType: string) =>
      Promise.resolve(drafts.get(`${promptId}:${draftType}`) ?? null)
    );
    api.saveWritingDraft.mockImplementation((promptId: string, request: object) =>
      Promise.resolve({ ...request, promptId, selectedPromptId: promptId, updatedAt: "2026-04-15T09:00:00Z" })
    );
    api.deleteWritingDraft.mockResolvedValue(undefined);
    api.trackDailyPromptClick.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    document.body.style.overflow = "";
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  // ---------------------------------------------------------------- 난이도 고르기 화면

  it("[spec] 난이도 고르기 화면(로그인, 추천 질문 있음)의 문구·구조·클래스·aria·링크 주소가 지금과 같다(스냅숏). 화면(main)의 첫 자식이고 질문 목록은 부르지 않는다", async () => {
    await renderHome();
    await screen.findByText(P_F.questionEn);

    const flow = pickFlow();
    expect(flow.tagName).toBe("SECTION");
    expect(flow.parentElement).toBe(main());
    expect(main().firstElementChild).toBe(flow);
    expect(errorTexts()).toEqual([]);
    expect(api.getDailyPrompts).not.toHaveBeenCalled();
    expect(api.getFeaturedDailyPrompt.mock.calls).toEqual([["I", GUEST_ID]]);
    expect(normalizeForSnapshot(flow)).toMatchInlineSnapshot(`
      <section
        class="page:pickFlow"
      >
        <section
          class="page:difficultyHomeHero"
        >
          <div
            class="page:mobileSyncHeaderRow"
          >
            <div
              class="page:mobileSyncTitleBlock"
            >
              <h1
                class="page:difficultyHomeTitle"
              >
                난이도 선택
              </h1>
              <span
                aria-hidden="true"
                class="page:difficultyHomeUnderline"
              />
            </div>
            <button
              class="page:mobileSyncHeaderButton"
              type="button"
            >
              가이드 보기
            </button>
          </div>
          <button
            aria-expanded="false"
            aria-haspopup="dialog"
            aria-label="이번 달 학습 기록 열기"
            class="page:difficultyHomeStatusPanel page:difficultyHomeStatusPanelInteractive"
            type="button"
          >
            <div
              class="page:difficultyHomeStatusLead"
            >
              <span
                aria-hidden="true"
                class="page:difficultyHomeStatusIcon"
              >
                <span
                  class="materialSymbols page:difficultyHomeStatusIconGlyph"
                >
                  calendar_today
                </span>
              </span>
              <div
                class="page:difficultyHomeStatusCopy"
              >
                <div
                  class="page:difficultyHomeStatusTop"
                >
                  <strong>
                    학습 일지
                  </strong>
                  <span
                    class="page:difficultyHomeStatusBadge"
                  >
                    ACTIVE
                  </span>
                </div>
                <p>
                  현재 3일 연속으로 문장을 차분하게 쌓아가고 계십니다.
                </p>
                <span
                  class="page:difficultyHomeStatusMeta"
                >
                  총 1,234문장 작성
                </span>
              </div>
            </div>
            <div
              class="page:difficultyHomeWeekRow"
            >
              <span
                class="page:difficultyHomeWeekDay"
              >
                <span
                  class="page:difficultyHomeWeekDayText"
                >
                  목
                </span>
              </span>
              <span
                class="page:difficultyHomeWeekDay page:difficultyHomeWeekDayDone"
              >
                <span
                  class="page:difficultyHomeWeekDayText"
                >
                  금
                </span>
              </span>
              <span
                class="page:difficultyHomeWeekDay"
              >
                <span
                  class="page:difficultyHomeWeekDayText"
                >
                  토
                </span>
              </span>
              <span
                class="page:difficultyHomeWeekDay"
              >
                <span
                  class="page:difficultyHomeWeekDayText"
                >
                  일
                </span>
              </span>
              <span
                class="page:difficultyHomeWeekDay page:difficultyHomeWeekDayDone"
              >
                <span
                  class="page:difficultyHomeWeekDayText"
                >
                  월
                </span>
              </span>
              <span
                class="page:difficultyHomeWeekDay"
              >
                <span
                  class="page:difficultyHomeWeekDayText"
                >
                  화
                </span>
              </span>
              <span
                class="page:difficultyHomeWeekDay page:difficultyHomeWeekDayDone page:difficultyHomeWeekDayToday"
              >
                <span
                  class="page:difficultyHomeWeekDayText"
                >
                  수
                </span>
              </span>
            </div>
          </button>
        </section>
        <a
          class="page:difficultyHomeDiaryShortcut"
          href="/diary"
        >
          <span
            aria-hidden="true"
            class="page:difficultyHomeDiaryIcon"
          >
            <span
              class="materialSymbols page:difficultyHomeDiaryIconGlyph"
            >
              edit_note
            </span>
          </span>
          <span
            class="page:difficultyHomeDiaryCopy"
          >
            <strong>
              자유 영어일기 쓰기
            </strong>
            <small>
              질문 없이 오늘 있었던 일을 영어로 쓰고 일기 전용 피드백을 받아보세요.
            </small>
          </span>
          <span
            aria-hidden="true"
            class="materialSymbols page:difficultyHomeDiaryArrow"
          >
            arrow_forward
          </span>
        </a>
        <section
          class="page:prefeaturedPromptSection"
        >
          <div
            class="page:prefeaturedPromptHeader"
          >
            <strong>
              오늘의 추천 질문
            </strong>
            <span
              class="page:prefeaturedPromptDifficultyBadge"
            >
              입문
            </span>
          </div>
          <article
            class="page:prefeaturedPromptCard"
            role="button"
            tabindex="0"
          >
            <div
              class="page:prefeaturedPromptCardCopy"
            >
              <strong>
                What hobby would you like to try this year?
              </strong>
              <small>
                요즘 쓴 답과 이어지는 주제예요.
              </small>
            </div>
            <div
              class="page:prefeaturedPromptCardFooter"
            >
              <span>
                Hobby
              </span>
              <button
                class="page:promptTranslationButton"
                type="button"
              >
                해석 보기
              </button>
            </div>
          </article>
        </section>
        <section
          class="page:difficultyHomeStage"
        >
          <div
            class="page:difficultyHomeCardGrid"
          >
            <button
              class="page:difficultyHomeCard"
              data-tone="I"
              type="button"
            >
              <span
                class="page:difficultyHomeCardLevel"
              >
                LEVEL 01
              </span>
              <span
                aria-hidden="true"
                class="page:difficultyHomeCardIconWrap"
              >
                <span
                  class="materialSymbols page:difficultyHomeCardIcon"
                >
                  auto_stories
                </span>
              </span>
              <div
                class="page:difficultyHomeCardCopy"
              >
                <strong>
                  입문
                </strong>
                <p>
                  짧은 한두 문장으로도 바로 답할 수 있는 가장 가벼운 질문부터 시작해 보세요.
                </p>
              </div>
            </button>
            <button
              class="page:difficultyHomeCard"
              data-tone="A"
              type="button"
            >
              <span
                class="page:difficultyHomeCardLevel"
              >
                LEVEL 02
              </span>
              <span
                aria-hidden="true"
                class="page:difficultyHomeCardIconWrap"
              >
                <span
                  class="materialSymbols page:difficultyHomeCardIcon"
                >
                  auto_stories
                </span>
              </span>
              <div
                class="page:difficultyHomeCardCopy"
              >
                <strong>
                  쉬움
                </strong>
                <p>
                  기본 어휘와 쉬운 문장 구조로 부담 없이 첫 루프를 시작해 보세요.
                </p>
              </div>
            </button>
            <button
              class="page:difficultyHomeCard"
              data-tone="B"
              type="button"
            >
              <span
                class="page:difficultyHomeCardLevel"
              >
                LEVEL 03
              </span>
              <span
                aria-hidden="true"
                class="page:difficultyHomeCardIconWrap"
              >
                <span
                  class="materialSymbols page:difficultyHomeCardIcon"
                >
                  menu_book
                </span>
              </span>
              <div
                class="page:difficultyHomeCardCopy"
              >
                <strong>
                  보통
                </strong>
                <p>
                  일상적인 주제와 문장 구조로 표현의 폭을 차분하게 넓혀 보세요.
                </p>
              </div>
            </button>
            <button
              class="page:difficultyHomeCard"
              data-tone="C"
              type="button"
            >
              <span
                class="page:difficultyHomeCardLevel"
              >
                LEVEL 04
              </span>
              <span
                aria-hidden="true"
                class="page:difficultyHomeCardIconWrap"
              >
                <span
                  class="materialSymbols page:difficultyHomeCardIcon"
                >
                  psychology
                </span>
              </span>
              <div
                class="page:difficultyHomeCardCopy"
              >
                <strong>
                  어려움
                </strong>
                <p>
                  한 단계 더 복잡한 내용과 논리를 담아 깊이 있는 작문에 도전해 보세요.
                </p>
              </div>
            </button>
          </div>
        </section>
      </section>
    `);
  });

  it("[spec] 학습 일지(로그인): '이번 달 학습 기록 열기' 버튼이 눌리고 ACTIVE·연속 학습일·총 문장 수가 보이며, 누르면 월 학습 현황이 열리고 aria-expanded가 따라간다", async () => {
    const user = await renderHome();
    const button = screen.getByRole("button", { name: "이번 달 학습 기록 열기" });
    expect(button).toBe(statusButton());
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(classTokens(button)).toEqual(["page:difficultyHomeStatusPanel", "page:difficultyHomeStatusPanelInteractive"]);
    expect(byClass(button, styles.difficultyHomeStatusBadge).textContent).toBe("ACTIVE");
    expect(button.querySelector(`.${styles.difficultyHomeStatusCopy} > p`)?.textContent).toBe(STREAK_TEXT);
    expect(byClass(button, styles.difficultyHomeStatusMeta).textContent).toBe("총 1,234문장 작성");

    api.getMonthStatus.mockClear();
    await user.click(button);
    const dialog = await screen.findByRole("dialog", { name: "학습 캘린더" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    await within(dialog).findByLabelText("2026년 4월 달력");
    expect(api.getMonthStatus.mock.calls).toEqual([[2026, 4]]);

    await user.click(within(dialog).getByRole("button", { name: "학습 캘린더 닫기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("[spec] 학습 일지(로그인 안 함): '학습 안내' 버튼이 비활성이고 aria-haspopup·aria-expanded가 없으며 START와 안내 문구만 보인다. 이번 주 줄은 기기 날짜 기준이고 표시가 없다(스냅숏). 눌러도 아무것도 열리지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 20, 10, 0, 0));
    const user = await renderHome(false);

    const button = screen.getByRole("button", { name: "학습 안내" });
    expect(button).toBe(statusButton());
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(button).not.toHaveAttribute("aria-expanded");
    expect(screen.queryByRole("button", { name: "이번 달 학습 기록 열기" })).not.toBeInTheDocument();
    expect(normalizeForSnapshot(button)).toMatchInlineSnapshot(`
      <button
        aria-label="학습 안내"
        class="page:difficultyHomeStatusPanel"
        disabled=""
        type="button"
      >
        <div
          class="page:difficultyHomeStatusLead"
        >
          <span
            aria-hidden="true"
            class="page:difficultyHomeStatusIcon"
          >
            <span
              class="materialSymbols page:difficultyHomeStatusIconGlyph"
            >
              calendar_today
            </span>
          </span>
          <div
            class="page:difficultyHomeStatusCopy"
          >
            <div
              class="page:difficultyHomeStatusTop"
            >
              <strong>
                학습 일지
              </strong>
              <span
                class="page:difficultyHomeStatusBadge"
              >
                START
              </span>
            </div>
            <p>
              부담 없이 첫 루프를 시작하고 오늘의 작문 감각을 깨워 보세요.
            </p>
          </div>
        </div>
        <div
          class="page:difficultyHomeWeekRow"
        >
          <span
            class="page:difficultyHomeWeekDay"
          >
            <span
              class="page:difficultyHomeWeekDayText"
            >
              금
            </span>
          </span>
          <span
            class="page:difficultyHomeWeekDay"
          >
            <span
              class="page:difficultyHomeWeekDayText"
            >
              토
            </span>
          </span>
          <span
            class="page:difficultyHomeWeekDay"
          >
            <span
              class="page:difficultyHomeWeekDayText"
            >
              일
            </span>
          </span>
          <span
            class="page:difficultyHomeWeekDay"
          >
            <span
              class="page:difficultyHomeWeekDayText"
            >
              월
            </span>
          </span>
          <span
            class="page:difficultyHomeWeekDay"
          >
            <span
              class="page:difficultyHomeWeekDayText"
            >
              화
            </span>
          </span>
          <span
            class="page:difficultyHomeWeekDay"
          >
            <span
              class="page:difficultyHomeWeekDayText"
            >
              수
            </span>
          </span>
          <span
            class="page:difficultyHomeWeekDay page:difficultyHomeWeekDayToday"
          >
            <span
              class="page:difficultyHomeWeekDayText"
            >
              목
            </span>
          </span>
        </div>
      </button>
    `);

    await user.click(button);
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.getTodayWritingStatus).not.toHaveBeenCalled();
    expect(api.getMonthStatus).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "달 기록의 완료한 날을 표시하고 오늘을 따로 표시한다",
      today: TODAY,
      april: APRIL,
      expected: [
        ["목", ["page:difficultyHomeWeekDay"]],
        ["금", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayDone"]],
        ["토", ["page:difficultyHomeWeekDay"]],
        ["일", ["page:difficultyHomeWeekDay"]],
        ["월", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayDone"]],
        ["화", ["page:difficultyHomeWeekDay"]],
        ["수", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayDone", "page:difficultyHomeWeekDayToday"]]
      ]
    },
    {
      name: "달 기록에 완료한 날이 없으면 연속 학습일만큼 어제부터 거슬러 표시한다(오늘 미완료)",
      today: { ...TODAY, completed: false, streakDays: 2 },
      april: { year: 2026, month: 4, streakDays: 0, days: [] },
      expected: [
        ["목", ["page:difficultyHomeWeekDay"]],
        ["금", ["page:difficultyHomeWeekDay"]],
        ["토", ["page:difficultyHomeWeekDay"]],
        ["일", ["page:difficultyHomeWeekDay"]],
        ["월", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayDone"]],
        ["화", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayDone"]],
        ["수", ["page:difficultyHomeWeekDay", "page:difficultyHomeWeekDayToday"]]
      ]
    }
  ])("[spec] 연속 학습일과 이번 주 기록: $name", async ({ today, april, expected }) => {
    api.getTodayWritingStatus.mockResolvedValue(today);
    api.getMonthStatus.mockImplementation((year: number, month: number) =>
      Promise.resolve(year === 2026 && month === 4 ? april : { year, month, streakDays: 0, days: [] })
    );
    render(<AnswerLoop />);
    await screen.findByText(`현재 ${today.streakDays}일 연속으로 문장을 차분하게 쌓아가고 계십니다.`);
    await waitFor(() => expect(api.getMonthStatus).toHaveBeenCalledWith(2026, 4));
    await flush();
    await flush();
    expect(weekRow()).toEqual(expected);
  });

  it("[spec] 가이드 보기(데스크톱 화면): 눌러도 고르기 화면에 아무것도 열리지 않고 화면과 본문 스크롤이 그대로다", async () => {
    const user = await renderHome();
    await screen.findByText(P_F.questionEn);
    const before = pickFlow().outerHTML;

    await user.click(screen.getByRole("button", { name: "가이드 보기" }));
    await flush();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementsByClassName(styles.helpOverlay)).toHaveLength(0);
    expect(document.body.style.overflow).toBe("");
    expect(pickFlow().outerHTML).toBe(before);
  });

  it("[spec] 가이드 보기(모바일 화면): 누르면 창은 그리지 않지만 본문 스크롤이 잠기고, 다시 눌러도 잠긴 채이며 Escape로 풀린다. 켠 채 다른 난이도를 고르면 풀리고, 같은 난이도를 고르면 질문 목록에서도 잠긴 채다", async () => {
    mockMobileViewport();
    const user = await renderHome();
    await screen.findByText(P_F.questionEn);
    const guideButton = screen.getByRole("button", { name: "가이드 보기" });

    await user.click(guideButton);
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.getElementsByClassName(styles.helpOverlay)).toHaveLength(0);
    await user.click(guideButton);
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");

    // 켠 채 다른 난이도(쉬움)를 고르면 꺼진다.
    await user.click(guideButton);
    expect(document.body.style.overflow).toBe("hidden");
    await openPromptList(user, "쉬움", P_A1);
    expect(document.body.style.overflow).toBe("");

    // 난이도 화면으로 돌아가 켠 채 같은 난이도(쉬움)를 고르면 켜진 채 질문 목록이 열린다.
    await user.click(within(pickFlow()).getByRole("button", { name: "난이도 선택" }));
    await user.click(await screen.findByRole("button", { name: "가이드 보기" }));
    expect(document.body.style.overflow).toBe("hidden");
    await openPromptList(user, "쉬움", P_A1);
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("[spec] 자유 영어일기 쓰기 링크는 /diary로 가고, 이어 쓰기 카드가 없으면 첫 화면 위 묶음 바로 다음에 있다", async () => {
    await renderHome();
    const link = screen.getByRole("link", { name: /자유 영어일기 쓰기/ });
    expect(link).toHaveAttribute("href", "/diary");
    expect(classTokens(link)).toEqual(["page:difficultyHomeDiaryShortcut"]);
    expect(link.parentElement).toBe(pickFlow());
    expect(classTokens(link.previousElementSibling as Element)).toEqual(["page:difficultyHomeHero"]);
    expect(classTokens(link.nextElementSibling as Element)).toEqual(["page:prefeaturedPromptSection"]);
  });

  // ---------------------------------------------------------------- 오늘의 추천 질문

  it("[spec] 오늘의 추천 질문: 불러오는 동안 '추천 질문을 고르고 있어요.'를 보여 주고(스냅숏), 받으면 추천 질문 카드로 바뀐다. 머리의 난이도 배지는 고른 난이도다", async () => {
    const featuredRequest = deferred<FeaturedDailyPromptRecommendation>();
    api.getFeaturedDailyPrompt.mockImplementation(() => featuredRequest.promise);
    await renderHome();

    expect(normalizeForSnapshot(featuredSection())).toMatchInlineSnapshot(`
      <section
        class="page:prefeaturedPromptSection"
      >
        <div
          class="page:prefeaturedPromptHeader"
        >
          <strong>
            오늘의 추천 질문
          </strong>
          <span
            class="page:prefeaturedPromptDifficultyBadge"
          >
            입문
          </span>
        </div>
        <div
          class="page:prefeaturedPromptLoadingCard"
        >
          <span
            aria-hidden="true"
            class="materialSymbols page:prefeaturedPromptLoadingIcon"
          >
            hourglass_top
          </span>
          <p>
            추천 질문을 고르고 있어요.
          </p>
        </div>
      </section>
    `);

    await act(async () => {
      featuredRequest.resolve(FEATURED_I);
    });
    expect(featuredSection().getElementsByClassName(styles.prefeaturedPromptLoadingCard)).toHaveLength(0);
    expect(within(featuredSection()).getByText(P_F.questionEn)).toBeInTheDocument();
    expect(byClass(featuredSection(), styles.prefeaturedPromptDifficultyBadge).textContent).toBe("입문");
  });

  it("[spec] 오늘의 추천 질문 카드: 질문·추천 이유·주제와 '해석 보기'가 보이고, 해석 버튼은 질문을 시작하지 않고 해석을 펼치고 접는다(펼친 상태 스냅숏)", async () => {
    const user = await renderHome();
    await screen.findByText(P_F.questionEn);
    const card = featuredCard();
    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("tabindex", "0");
    expect(within(card).queryByText(P_F.questionKo)).not.toBeInTheDocument();
    expect(within(card).getByText(FEATURED_REASON).tagName).toBe("SMALL");

    await user.click(within(card).getByRole("button", { name: "해석 보기" }));
    expect(within(card).getByText(P_F.questionKo).tagName).toBe("P");
    expect(normalizeForSnapshot(featuredSection())).toMatchInlineSnapshot(`
      <section
        class="page:prefeaturedPromptSection"
      >
        <div
          class="page:prefeaturedPromptHeader"
        >
          <strong>
            오늘의 추천 질문
          </strong>
          <span
            class="page:prefeaturedPromptDifficultyBadge"
          >
            입문
          </span>
        </div>
        <article
          class="page:prefeaturedPromptCard"
          role="button"
          tabindex="0"
        >
          <div
            class="page:prefeaturedPromptCardCopy"
          >
            <strong>
              What hobby would you like to try this year?
            </strong>
            <p>
              올해 해 보고 싶은 취미는 무엇인가요?
            </p>
            <small>
              요즘 쓴 답과 이어지는 주제예요.
            </small>
          </div>
          <div
            class="page:prefeaturedPromptCardFooter"
          >
            <span>
              Hobby
            </span>
            <button
              class="page:promptTranslationButton"
              type="button"
            >
              해석 숨기기
            </button>
          </div>
        </article>
      </section>
    `);
    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
    expect(api.getWritingDraft).not.toHaveBeenCalled();
    expect(pickFlow()).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "해석 숨기기" }));
    expect(within(card).queryByText(P_F.questionKo)).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "해석 보기" })).toBeInTheDocument();
    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
  });

  it("[spec] 오늘의 추천 질문 카드: 추천 이유가 빈 글자면 이유 줄을 그리지 않는다", async () => {
    api.getFeaturedDailyPrompt.mockResolvedValue({ ...FEATURED_I, featured: item(P_F, "") });
    await renderHome();
    await screen.findByText(P_F.questionEn);
    expect(featuredCard().querySelector("small")).toBeNull();
    expect(Array.from(byClass(featuredCard(), styles.prefeaturedPromptCardCopy).children).map((node) => node.tagName)).toEqual([
      "STRONG"
    ]);
  });

  it.each([
    { name: "요청이 실패함", setup: () => api.getFeaturedDailyPrompt.mockRejectedValue(new Error("featured down")) },
    { name: "추천이 없음(featured: null)", setup: () => api.getFeaturedDailyPrompt.mockResolvedValue({ ...FEATURED_I, featured: null }) }
  ])("[spec] 오늘의 추천 질문이 없으면 안내 문구를 보여 준다(스냅숏): $name", async ({ setup }) => {
    setup();
    await renderHome();
    await waitFor(() =>
      expect(featuredSection().getElementsByClassName(styles.prefeaturedPromptLoadingCard)).toHaveLength(0)
    );
    expect(featuredSection().getElementsByClassName(styles.prefeaturedPromptCard)).toHaveLength(0);
    expect(normalizeForSnapshot(featuredSection())).toMatchInlineSnapshot(`
      <section
        class="page:prefeaturedPromptSection"
      >
        <div
          class="page:prefeaturedPromptHeader"
        >
          <strong>
            오늘의 추천 질문
          </strong>
          <span
            class="page:prefeaturedPromptDifficultyBadge"
          >
            입문
          </span>
        </div>
        <div
          class="page:prefeaturedPromptFallbackCard"
        >
          <p>
            오늘의 추천 질문을 준비하지 못했어요. 아래에서 난이도를 골라 시작할 수 있어요.
          </p>
        </div>
      </section>
    `);
  });

  it("[spec] 오늘의 추천 질문 카드를 누르면 그 질문으로 시작한다: 고르기 기록(질문 id, 게스트 id)을 남기고 그 질문의 초안을 찾은 뒤 답 쓰기 화면이 그 질문이다. 질문 난이도가 다르면 고른 난이도가 그 난이도로 바뀐다", async () => {
    const user = await renderHome();
    await screen.findByText(P_F.questionEn);
    api.getWritingDraft.mockClear();

    await user.click(featuredCard());
    await expectAnswerStepFor(P_F);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([[P_F.id, GUEST_ID]]);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P_F.id, "REWRITE"],
      [P_F.id, "ANSWER"]
    ]);

    // 질문 다시 고르기로 돌아오면 난이도 화면이고, 추천 질문의 난이도(보통)가 고른 난이도다.
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "난이도 선택" });
    await waitFor(() => expect(byClass(featuredSection(), styles.prefeaturedPromptDifficultyBadge).textContent).toBe("보통"));
    await waitFor(() => expect(api.getFeaturedDailyPrompt).toHaveBeenLastCalledWith("B", GUEST_ID));
  });

  it("[spec] 오늘의 추천 질문 카드에 포커스를 두고 Enter나 Space를 누르면 그 질문으로 시작하고, 다른 키는 아무것도 하지 않는다", async () => {
    const user = await renderHome();
    await screen.findByText(P_F.questionEn);

    featuredCard().focus();
    await user.keyboard("a");
    await flush();
    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
    expect(pickFlow()).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await expectAnswerStepFor(P_F);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([[P_F.id, GUEST_ID]]);

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "난이도 선택" });
    await screen.findByText(P_F.questionEn);
    featuredCard().focus();
    await user.keyboard(" ");
    await expectAnswerStepFor(P_F);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([
      [P_F.id, GUEST_ID],
      [P_F.id, GUEST_ID]
    ]);
  });

  // ---------------------------------------------------------------- 난이도 카드

  it("[spec] 난이도 카드 4개(입문·쉬움·보통·어려움)의 단계·아이콘·이름·설명·data-tone이 지금과 같다", async () => {
    await renderHome();
    const cards = Array.from(main().getElementsByClassName(styles.difficultyHomeCard));
    expect(
      cards.map((card) => [
        card.tagName,
        card.getAttribute("type"),
        card.getAttribute("data-tone"),
        card.getElementsByClassName(styles.difficultyHomeCardLevel)[0]?.textContent,
        card.getElementsByClassName(styles.difficultyHomeCardIcon)[0]?.textContent,
        card.querySelector(`.${styles.difficultyHomeCardCopy} > strong`)?.textContent,
        card.querySelector(`.${styles.difficultyHomeCardCopy} > p`)?.textContent
      ])
    ).toEqual([
      ["BUTTON", "button", "I", "LEVEL 01", "auto_stories", "입문", "짧은 한두 문장으로도 바로 답할 수 있는 가장 가벼운 질문부터 시작해 보세요."],
      ["BUTTON", "button", "A", "LEVEL 02", "auto_stories", "쉬움", "기본 어휘와 쉬운 문장 구조로 부담 없이 첫 루프를 시작해 보세요."],
      ["BUTTON", "button", "B", "LEVEL 03", "menu_book", "보통", "일상적인 주제와 문장 구조로 표현의 폭을 차분하게 넓혀 보세요."],
      ["BUTTON", "button", "C", "LEVEL 04", "psychology", "어려움", "한 단계 더 복잡한 내용과 논리를 담아 깊이 있는 작문에 도전해 보세요."]
    ]);
  });

  it("[spec] 다른 난이도 카드를 누르면 그 난이도의 질문 목록을 부르며 질문 목록 화면으로 가고, 불러오는 동안 목록이 비고 '새 질문'이 비활성이다(스냅숏). 돌아가면 그 난이도의 추천 질문을 다시 부른다", async () => {
    const user = await renderHome();
    await screen.findByText(P_F.questionEn);
    const dailyRequest = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => dailyRequest.promise);

    await user.click(difficultyCard("쉬움"));
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(api.getDailyPrompts.mock.calls).toEqual([["A", GUEST_ID]]);
    expect(promptCards()).toEqual([]);
    expect(refreshButton()).toBeDisabled();
    expect(refreshButton()).toHaveTextContent("새 질문");
    expect(normalizeForSnapshot(pickFlow())).toMatchInlineSnapshot(`
      <section
        class="page:pickFlow"
      >
        <section
          class="page:difficultyHomeHero"
        >
          <div
            class="page:promptSelectionHeroCompact"
          >
            <div
              class="page:promptSelectionHeaderRow"
            >
              <div
                class="page:promptSelectionTitleBlock"
              >
                <h1
                  class="page:promptSelectionTitle"
                >
                  질문 선택
                </h1>
                <div
                  class="page:promptSelectionMetaRow"
                >
                  <span
                    aria-hidden="true"
                    class="page:promptSelectionMetaUnderline"
                  />
                  <span
                    class="page:promptSelectionDifficultyText"
                  >
                    쉬움
                  </span>
                </div>
              </div>
              <div
                class="page:promptSelectionHeaderActions"
              >
                <button
                  class="page:promptSelectionStatusButton"
                  type="button"
                >
                  난이도 선택
                </button>
                <button
                  class="page:promptSelectionStatusButton"
                  disabled=""
                  type="button"
                >
                  새 질문
                </button>
              </div>
            </div>
          </div>
        </section>
        <section
          class="page:difficultyHomeStage"
        >
          <div
            class="page:promptSelectionCardGrid"
          />
        </section>
      </section>
    `);

    await act(async () => {
      dailyRequest.resolve(DAILY_A);
    });
    expect(promptCards().map((card) => card[1])).toEqual([P_A1.questionEn, P_A2.questionEn]);
    expect(refreshButton()).toBeEnabled();
    expect(byClass(pickFlow(), styles.promptSelectionDifficultyText).textContent).toBe("쉬움");

    // 난이도 선택으로 돌아가면 쉬움의 추천 질문을 다시 부르고, 받는 동안 불러오는 중 카드가 보인다.
    const featuredRequest = deferred<FeaturedDailyPromptRecommendation>();
    api.getFeaturedDailyPrompt.mockImplementationOnce(() => featuredRequest.promise);
    await user.click(within(pickFlow()).getByRole("button", { name: "난이도 선택" }));
    expect(screen.getByRole("heading", { name: "난이도 선택" })).toBeInTheDocument();
    expect(api.getFeaturedDailyPrompt).toHaveBeenLastCalledWith("A", GUEST_ID);
    expect(featuredSection().getElementsByClassName(styles.prefeaturedPromptLoadingCard)).toHaveLength(1);
    expect(byClass(featuredSection(), styles.prefeaturedPromptDifficultyBadge).textContent).toBe("쉬움");
    await act(async () => {
      featuredRequest.resolve(FEATURED_A);
    });
    expect(within(featuredSection()).getByText(P_A2.questionEn)).toBeInTheDocument();
  });

  it("[spec] 같은 난이도 카드를 다시 누르면 앞 목록을 그대로 보여 준 채 다시 부르고, 받는 동안 '새 질문'이 비활성이며 받으면 새 목록으로 바뀐다", async () => {
    const user = await renderHome();
    await openPromptList(user, "입문", P_I1);
    expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]);

    await user.click(within(pickFlow()).getByRole("button", { name: "난이도 선택" }));
    const dailyRequest = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => dailyRequest.promise);
    await user.click(difficultyCard("입문"));

    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(promptCards().map((card) => card[1])).toEqual([P_I1.questionEn, P_I2.questionEn, P_I3.questionEn]);
    expect(refreshButton()).toBeDisabled();
    expect(api.getDailyPrompts.mock.calls).toEqual([
      ["I", GUEST_ID],
      ["I", GUEST_ID]
    ]);

    await act(async () => {
      dailyRequest.resolve(DAILY_I_NEXT);
    });
    expect(promptCards().map((card) => card[1])).toEqual([P_N1.questionEn, P_N2.questionEn]);
    expect(refreshButton()).toBeEnabled();
  });

  // ---------------------------------------------------------------- 질문 목록 화면

  it("[spec] 질문 목록 화면(입문)의 문구·구조·클래스·aria가 지금과 같다(스냅숏). 카드 번호는 QUESTION 01부터, 목록의 추천 질문에 배지가 붙고, data-tone은 질문의 난이도다", async () => {
    const user = await renderHome();
    await openPromptList(user, "입문", P_I1);

    const flow = pickFlow();
    expect(flow.parentElement).toBe(main());
    expect(main().firstElementChild).toBe(flow);
    expect(promptCards()).toEqual([
      ["QUESTION 01", P_I1.questionEn, null, null, P_I1.topic, "해석 보기", "I"],
      ["QUESTION 02", P_I2.questionEn, "오늘의 추천 질문", null, P_I2.topic, "해석 보기", "I"],
      ["QUESTION 03", P_I3.questionEn, null, null, P_I3.topic, "해석 보기", "B"]
    ]);
    expect(normalizeForSnapshot(flow)).toMatchInlineSnapshot(`
      <section
        class="page:pickFlow"
      >
        <section
          class="page:difficultyHomeHero"
        >
          <div
            class="page:promptSelectionHeroCompact"
          >
            <div
              class="page:promptSelectionHeaderRow"
            >
              <div
                class="page:promptSelectionTitleBlock"
              >
                <h1
                  class="page:promptSelectionTitle"
                >
                  질문 선택
                </h1>
                <div
                  class="page:promptSelectionMetaRow"
                >
                  <span
                    aria-hidden="true"
                    class="page:promptSelectionMetaUnderline"
                  />
                  <span
                    class="page:promptSelectionDifficultyText"
                  >
                    입문
                  </span>
                </div>
              </div>
              <div
                class="page:promptSelectionHeaderActions"
              >
                <button
                  class="page:promptSelectionStatusButton"
                  type="button"
                >
                  난이도 선택
                </button>
                <button
                  class="page:promptSelectionStatusButton"
                  type="button"
                >
                  새 질문
                </button>
              </div>
            </div>
          </div>
        </section>
        <section
          class="page:difficultyHomeStage"
        >
          <div
            class="page:promptSelectionCardGrid"
          >
            <article
              class="page:promptSelectionCardCompact"
              data-tone="I"
              role="button"
              tabindex="0"
            >
              <div
                class="page:promptSelectionCardTopRow"
              >
                <span
                  class="page:promptSelectionCardIndex"
                >
                  QUESTION 01
                </span>
              </div>
              <div
                class="page:promptSelectionCardCopy"
              >
                <strong>
                  What do you usually eat for breakfast?
                </strong>
              </div>
              <div
                class="page:promptSelectionCardFooter"
              >
                <span
                  class="page:promptSelectionCardMeta"
                >
                  Breakfast
                </span>
                <button
                  class="page:promptSelectionCardTranslateButton page:promptTranslationButton"
                  type="button"
                >
                  해석 보기
                </button>
              </div>
            </article>
            <article
              class="page:promptSelectionCardCompact"
              data-tone="I"
              role="button"
              tabindex="0"
            >
              <div
                class="page:promptSelectionCardTopRow"
              >
                <span
                  class="page:promptSelectionCardIndex"
                >
                  QUESTION 02
                </span>
                <span
                  class="page:promptSelectionFeaturedBadge"
                >
                  오늘의 추천 질문
                </span>
              </div>
              <div
                class="page:promptSelectionCardCopy"
              >
                <strong>
                  How did you spend last weekend?
                </strong>
              </div>
              <div
                class="page:promptSelectionCardFooter"
              >
                <span
                  class="page:promptSelectionCardMeta"
                >
                  Weekend
                </span>
                <button
                  class="page:promptSelectionCardTranslateButton page:promptTranslationButton"
                  type="button"
                >
                  해석 보기
                </button>
              </div>
            </article>
            <article
              class="page:promptSelectionCardCompact"
              data-tone="B"
              role="button"
              tabindex="0"
            >
              <div
                class="page:promptSelectionCardTopRow"
              >
                <span
                  class="page:promptSelectionCardIndex"
                >
                  QUESTION 03
                </span>
              </div>
              <div
                class="page:promptSelectionCardCopy"
              >
                <strong>
                  Would you like to have a pet someday?
                </strong>
              </div>
              <div
                class="page:promptSelectionCardFooter"
              >
                <span
                  class="page:promptSelectionCardMeta"
                >
                  Pets
                </span>
                <button
                  class="page:promptSelectionCardTranslateButton page:promptTranslationButton"
                  type="button"
                >
                  해석 보기
                </button>
              </div>
            </article>
          </div>
        </section>
      </section>
    `);
  });

  it("[spec] 질문 카드의 해석 버튼은 질문을 시작하지 않고 그 카드의 해석만 펼치고 접으며(펼친 카드 스냅숏), 목록을 새로 고치면 모두 접힌다", async () => {
    const user = await renderHome();
    await openPromptList(user, "입문", P_I1);
    api.getWritingDraft.mockClear();

    await user.click(within(promptCard(P_I2)).getByRole("button", { name: "해석 보기" }));
    expect(promptCards().map((card) => [card[3], card[5]])).toEqual([
      [null, "해석 보기"],
      [P_I2.questionKo, "해석 숨기기"],
      [null, "해석 보기"]
    ]);
    expect(normalizeForSnapshot(promptCard(P_I2))).toMatchInlineSnapshot(`
      <article
        class="page:promptSelectionCardCompact"
        data-tone="I"
        role="button"
        tabindex="0"
      >
        <div
          class="page:promptSelectionCardTopRow"
        >
          <span
            class="page:promptSelectionCardIndex"
          >
            QUESTION 02
          </span>
          <span
            class="page:promptSelectionFeaturedBadge"
          >
            오늘의 추천 질문
          </span>
        </div>
        <div
          class="page:promptSelectionCardCopy"
        >
          <strong>
            How did you spend last weekend?
          </strong>
          <small
            class="page:translationText"
          >
            지난 주말을 어떻게 보냈나요?
          </small>
        </div>
        <div
          class="page:promptSelectionCardFooter"
        >
          <span
            class="page:promptSelectionCardMeta"
          >
            Weekend
          </span>
          <button
            class="page:promptSelectionCardTranslateButton page:promptTranslationButton"
            type="button"
          >
            해석 숨기기
          </button>
        </div>
      </article>
    `);

    await user.click(within(promptCard(P_I1)).getByRole("button", { name: "해석 보기" }));
    expect(promptCards().map((card) => card[3])).toEqual([P_I1.questionKo, P_I2.questionKo, null]);
    await user.click(within(promptCard(P_I2)).getByRole("button", { name: "해석 숨기기" }));
    expect(promptCards().map((card) => card[3])).toEqual([P_I1.questionKo, null, null]);

    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
    expect(api.getWritingDraft).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();

    api.getDailyPrompts.mockResolvedValueOnce(DAILY_I_THIRD);
    await user.click(refreshButton());
    await screen.findByText(P_N3.questionEn, { selector: "strong" });
    expect(promptCards()).toEqual([["QUESTION 01", P_N3.questionEn, "오늘의 추천 질문", null, P_N3.topic, "해석 보기", "I"]]);
  });

  it("[spec] 질문 카드를 누르면 그 질문으로 시작한다: 고르기 기록(질문 id, 게스트 id)을 남기고 그 질문의 초안을 찾은 뒤 답 쓰기 화면이 그 질문이다", async () => {
    const user = await renderHome();
    await openPromptList(user, "입문", P_I1);
    api.getWritingDraft.mockClear();

    await user.click(promptCard(P_I2));
    await expectAnswerStepFor(P_I2);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([[P_I2.id, GUEST_ID]]);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P_I2.id, "REWRITE"],
      [P_I2.id, "ANSWER"]
    ]);
  });

  it("[spec] 질문 카드를 누르면 그 질문의 서버 초안이 있으면 초안을 되살려 연다", async () => {
    drafts.set(`${P_I2.id}:ANSWER`, draftFor(P_I2, { answer: "I went hiking with my friends." }));
    const user = await renderHome();
    await openPromptList(user, "입문", P_I1);

    await user.click(promptCard(P_I2));
    await screen.findByDisplayValue("I went hiking with my friends.");
    expect(composerQuestion()).toBe(P_I2.questionEn);
    expect(queryPickFlow()).toBeUndefined();
  });

  it("[spec] 질문 카드에 포커스를 두고 Enter나 Space를 누르면 그 질문으로 시작하고, 다른 키는 아무것도 하지 않는다", async () => {
    const user = await renderHome();
    await openPromptList(user, "입문", P_I1);

    promptCard(P_I1).focus();
    await user.keyboard("a");
    await flush();
    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await expectAnswerStepFor(P_I1);

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    promptCard(P_I2).focus();
    await user.keyboard(" ");
    await expectAnswerStepFor(P_I2);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([
      [P_I1.id, GUEST_ID],
      [P_I2.id, GUEST_ID]
    ]);
  });

  it("[spec] 새 질문: 누르면 '불러오는 중...'으로 비활성이 되고, 지금 목록과 앞서 본 질문을 빼고 다시 부른다. 받으면 새 목록이 되고, 빈 목록이나 실패면 안내 문구를 보여 주고 목록은 그대로이며, 다음에 받으면 안내 문구가 지워진다", async () => {
    const user = await renderHome();
    await openPromptList(user, "입문", P_I1);

    const firstRefresh = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => firstRefresh.promise);
    await user.click(refreshButton());
    expect(refreshButton()).toHaveTextContent("불러오는 중...");
    expect(refreshButton()).toBeDisabled();
    expect(within(pickFlow()).getByRole("button", { name: "난이도 선택" })).toBeEnabled();
    expect(promptCards().map((card) => card[1])).toEqual([P_I1.questionEn, P_I2.questionEn, P_I3.questionEn]);
    await act(async () => {
      firstRefresh.resolve(DAILY_I_NEXT);
    });
    expect(refreshButton()).toHaveTextContent("새 질문");
    expect(refreshButton()).toBeEnabled();
    expect(promptCards()).toEqual([
      ["QUESTION 01", P_N1.questionEn, null, null, P_N1.topic, "해석 보기", "I"],
      ["QUESTION 02", P_N2.questionEn, null, null, P_N2.topic, "해석 보기", "I"]
    ]);
    expect(errorTexts()).toEqual([]);

    api.getDailyPrompts.mockResolvedValueOnce(DAILY_I_THIRD);
    await user.click(refreshButton());
    await screen.findByText(P_N3.questionEn, { selector: "strong" });

    api.getDailyPrompts.mockResolvedValueOnce({ ...DAILY_I_NEXT, prompts: [] });
    await user.click(refreshButton());
    await waitFor(() => expect(errorTexts()).toEqual([REFRESH_ERROR]));
    expect(promptCards().map((card) => card[1])).toEqual([P_N3.questionEn]);
    expect(refreshButton()).toHaveTextContent("새 질문");
    expect(refreshButton()).toBeEnabled();

    api.getDailyPrompts.mockRejectedValueOnce(new Error("refresh down"));
    await user.click(refreshButton());
    await waitFor(() => expect(refreshButton()).toHaveTextContent("새 질문"));
    expect(errorTexts()).toEqual([REFRESH_ERROR]);
    expect(promptCards().map((card) => card[1])).toEqual([P_N3.questionEn]);

    api.getDailyPrompts.mockResolvedValueOnce(DAILY_I_NEXT);
    await user.click(refreshButton());
    await screen.findByText(P_N1.questionEn, { selector: "strong" });
    expect(errorTexts()).toEqual([]);

    const afterThird = [P_I1.id, P_I2.id, P_I3.id, P_N1.id, P_N2.id, P_N3.id];
    expect(api.getDailyPrompts.mock.calls).toEqual([
      ["I", GUEST_ID],
      ["I", GUEST_ID, [P_I1.id, P_I2.id, P_I3.id]],
      ["I", GUEST_ID, [P_I1.id, P_I2.id, P_I3.id, P_N1.id, P_N2.id]],
      ["I", GUEST_ID, afterThird],
      ["I", GUEST_ID, afterThird],
      ["I", GUEST_ID, afterThird]
    ]);
  });

  it("[spec] 질문 목록을 불러오지 못하면 '오늘의 질문을 불러오지 못했어요.'가 보이고 목록이 비며 '새 질문'이 비활성이다", async () => {
    api.getDailyPrompts.mockRejectedValue(new Error("daily down"));
    const user = await renderHome();
    await user.click(difficultyCard("입문"));
    await waitFor(() => expect(errorTexts()).toEqual(["오늘의 질문을 불러오지 못했어요."]));
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(promptCards()).toEqual([]);
    expect(refreshButton()).toBeDisabled();
    // 오류 문구는 화면(main)의 첫 자식이고 고르기 화면이 그 다음이다.
    const errorNode = byClass(main(), styles.errorText);
    expect(errorNode.parentElement).toBe(main());
    expect(errorNode.nextElementSibling).toBe(pickFlow());
  });

  it("[spec] 질문 목록이 비면 목록이 비고 '새 질문'이 비활성이며 안내 문구는 없다(스냅숏)", async () => {
    api.getDailyPrompts.mockResolvedValue({ ...DAILY_I, featured: null, prompts: [] });
    const user = await renderHome();
    await user.click(difficultyCard("입문"));
    await waitFor(() => expect(api.getDailyPrompts).toHaveBeenCalled());
    await flush();
    expect(promptCards()).toEqual([]);
    expect(refreshButton()).toBeDisabled();
    expect(errorTexts()).toEqual([]);
    expect(normalizeForSnapshot(byClass(pickFlow(), styles.promptSelectionCardGrid).parentElement as HTMLElement)).toMatchInlineSnapshot(`
      <section
        class="page:difficultyHomeStage"
      >
        <div
          class="page:promptSelectionCardGrid"
        />
      </section>
    `);
  });

  it("[spec] 게스트가 다른 질문으로 시작한 세션이 있으면 다른 질문 카드나 추천 질문 카드를 눌러도 로그인 안내와 안내 문구만 뜨고 시작하지 않는다. 시작한 그 질문은 연다", async () => {
    window.localStorage.setItem("writeloop_guest_session_id", "guest-session-77");
    window.localStorage.setItem("writeloop_guest_prompt_id", P_I1.id);
    const user = await renderHome(false);
    await screen.findByText(P_F.questionEn);
    const guestError = "게스트는 질문 1개만 시작할 수 있어요. 다른 질문으로 이어서 학습하려면 로그인해 주세요.";

    await user.click(featuredCard());
    expect(await screen.findByRole("dialog", { name: "로그인하면 계속 학습할 수 있어요" })).toBeInTheDocument();
    expect(errorTexts()).toEqual([guestError]);
    expect(screen.getByRole("heading", { name: "난이도 선택" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "지금은 둘러보기" }));

    await openPromptList(user, "입문", P_I1);
    await user.click(promptCard(P_I2));
    expect(await screen.findByRole("dialog", { name: "로그인하면 계속 학습할 수 있어요" })).toBeInTheDocument();
    expect(errorTexts()).toEqual([guestError]);
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "지금은 둘러보기" }));

    await user.click(promptCard(P_I1));
    await expectAnswerStepFor(P_I1);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([[P_I1.id, GUEST_ID]]);
    expect(api.getWritingDraft).not.toHaveBeenCalled();
    expect(errorTexts()).toEqual([]);
  });

  it("[spec] 고르기 화면의 해석 펼침 상태는 답 쓰기 화면에 갔다 와도 남는다(추천 질문 카드와 질문 카드)", async () => {
    const user = await renderHome();
    await screen.findByText(P_F.questionEn);
    await user.click(within(featuredCard()).getByRole("button", { name: "해석 보기" }));

    await openPromptList(user, "입문", P_I1);
    await user.click(within(promptCard(P_I2)).getByRole("button", { name: "해석 보기" }));
    await user.click(promptCard(P_I1));
    await expectAnswerStepFor(P_I1);

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    expect(promptCards().map((card) => card[3])).toEqual([null, P_I2.questionKo, null]);

    await user.click(within(pickFlow()).getByRole("button", { name: "난이도 선택" }));
    await screen.findByText(P_F.questionEn);
    expect(within(featuredCard()).getByText(P_F.questionKo)).toBeInTheDocument();
    expect(within(featuredCard()).getByRole("button", { name: "해석 숨기기" })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------- 이어 쓰기 카드

  it("[spec] 이어 쓰기 카드(답 쓰기 단계)의 문구·구조·클래스·aria가 지금과 같다(스냅숏). 질문, 주제·저장 시각 줄과 '이어서 쓰기' 버튼이 보인다", async () => {
    const card = await renderResumeCard("answer");
    expect(normalizeForSnapshot(card)).toMatchInlineSnapshot(`
      <section
        class="page:difficultyHomeResumeCard"
      >
        <div
          class="page:difficultyHomeResumeLead"
        >
          <span
            aria-hidden="true"
            class="page:difficultyHomeResumeIcon"
          >
            <span
              class="materialSymbols page:difficultyHomeResumeIconGlyph"
            >
              edit
            </span>
          </span>
          <div
            class="page:difficultyHomeResumeCopy"
          >
            <div
              class="page:difficultyHomeResumeTop"
            >
              <strong>
                작성하던 초안이 남아 있어요
              </strong>
              <span
                class="page:difficultyHomeResumeBadge"
              >
                DRAFT
              </span>
            </div>
            <p>
              멈춘 지점부터 바로 이어서 쓰고 오늘의 루프를 계속 진행할 수 있어요.
            </p>
            <strong
              class="page:difficultyHomeResumeQuestion"
            >
              How did you spend last weekend?
            </strong>
            <span
              class="page:difficultyHomeResumeMeta"
            >
              Weekend · {저장 시각}에 저장
            </span>
          </div>
        </div>
        <button
          class="page:difficultyHomeResumeButton"
          type="button"
        >
          <span>
            이어서 쓰기
          </span>
          <span
            aria-hidden="true"
            class="materialSymbols page:difficultyHomeResumeButtonIcon"
          >
            arrow_forward
          </span>
        </button>
      </section>
    `);
  });

  it("[spec] 이어 쓰기 카드(다시 쓰기 단계)의 문구·구조·클래스·aria가 지금과 같다(스냅숏)", async () => {
    const card = await renderResumeCard("rewrite");
    expect(normalizeForSnapshot(card)).toMatchInlineSnapshot(`
      <section
        class="page:difficultyHomeResumeCard"
      >
        <div
          class="page:difficultyHomeResumeLead"
        >
          <span
            aria-hidden="true"
            class="page:difficultyHomeResumeIcon"
          >
            <span
              class="materialSymbols page:difficultyHomeResumeIconGlyph"
            >
              edit_note
            </span>
          </span>
          <div
            class="page:difficultyHomeResumeCopy"
          >
            <div
              class="page:difficultyHomeResumeTop"
            >
              <strong>
                다시쓰기 초안이 남아 있어요
              </strong>
              <span
                class="page:difficultyHomeResumeBadge"
              >
                REWRITE
              </span>
            </div>
            <p>
              방금 다듬던 문장을 이어서 마무리하고 한 번 더 정리해 볼 수 있어요.
            </p>
            <strong
              class="page:difficultyHomeResumeQuestion"
            >
              How did you spend last weekend?
            </strong>
            <span
              class="page:difficultyHomeResumeMeta"
            >
              Weekend · {저장 시각}에 저장
            </span>
          </div>
        </div>
        <button
          class="page:difficultyHomeResumeButton"
          type="button"
        >
          <span>
            다시 쓰러 가기
          </span>
          <span
            aria-hidden="true"
            class="materialSymbols page:difficultyHomeResumeButtonIcon"
          >
            arrow_forward
          </span>
        </button>
      </section>
    `);
  });

  it("[spec] 이어 쓰기 카드(피드백 단계)의 문구·구조·클래스·aria가 지금과 같다(스냅숏)", async () => {
    const card = await renderResumeCard("feedback");
    expect(normalizeForSnapshot(card)).toMatchInlineSnapshot(`
      <section
        class="page:difficultyHomeResumeCard"
      >
        <div
          class="page:difficultyHomeResumeLead"
        >
          <span
            aria-hidden="true"
            class="page:difficultyHomeResumeIcon"
          >
            <span
              class="materialSymbols page:difficultyHomeResumeIconGlyph"
            >
              chat
            </span>
          </span>
          <div
            class="page:difficultyHomeResumeCopy"
          >
            <div
              class="page:difficultyHomeResumeTop"
            >
              <strong>
                받아둔 피드백이 남아 있어요
              </strong>
              <span
                class="page:difficultyHomeResumeBadge"
              >
                FEEDBACK
              </span>
            </div>
            <p>
              코치가 남긴 포인트를 확인하고 다음 루프로 자연스럽게 이어가 볼 수 있어요.
            </p>
            <strong
              class="page:difficultyHomeResumeQuestion"
            >
              How did you spend last weekend?
            </strong>
            <span
              class="page:difficultyHomeResumeMeta"
            >
              Weekend · {저장 시각}에 저장
            </span>
          </div>
        </div>
        <button
          class="page:difficultyHomeResumeButton"
          type="button"
        >
          <span>
            피드백 이어보기
          </span>
          <span
            aria-hidden="true"
            class="materialSymbols page:difficultyHomeResumeButtonIcon"
          >
            arrow_forward
          </span>
        </button>
      </section>
    `);
  });

  it("[spec] 이어 쓰기 카드: 질문이 빈칸뿐이면 질문 줄이 없고, 주제가 빈칸뿐이고 저장 시각이 날짜가 아니면 주제·저장 시각 줄이 없다", async () => {
    storeIncompleteLoop(
      incompleteLoopFor(P_I2, {
        updatedAt: "not-a-date",
        promptSnapshot: { topic: "   ", questionEn: "  ", questionKo: P_I2.questionKo }
      })
    );
    await renderHome();
    const card = resumeCards()[0] as HTMLElement;
    expect(card.getElementsByClassName(styles.difficultyHomeResumeQuestion)).toHaveLength(0);
    expect(card.getElementsByClassName(styles.difficultyHomeResumeMeta)).toHaveLength(0);
    expect(Array.from(byClass(card, styles.difficultyHomeResumeCopy).children).map((node) => node.tagName)).toEqual([
      "DIV",
      "P"
    ]);
  });

  it("[spec] 이어 쓰기 카드: 주제만 빈칸뿐이면 저장 시각만 보이고, 질문은 앞뒤 빈칸을 지워 보인다", async () => {
    storeIncompleteLoop(
      incompleteLoopFor(P_I2, {
        promptSnapshot: { topic: " ", questionEn: `  ${P_I2.questionEn}  `, questionKo: P_I2.questionKo }
      })
    );
    await renderHome();
    const card = resumeCards()[0] as HTMLElement;
    expect(byClass(card, styles.difficultyHomeResumeQuestion).textContent).toBe(P_I2.questionEn);
    expect(byClass(card, styles.difficultyHomeResumeMeta).textContent).toBe(`${RESUME_SAVED_AT_LABEL}에 저장`);
  });

  it("[spec] 이어 쓰기 카드는 저장된 이어 쓰기가 없으면 없고, 있으면 난이도 화면에서는 위 묶음과 일기 링크 사이에, 질문 목록 화면에서는 위 묶음과 목록 사이에 있다. 다른 사용자의 이어 쓰기는 보이지 않는다", async () => {
    storeIncompleteLoop(incompleteLoopFor(P_I2, {}), 9999);
    const first = render(<AnswerLoop />);
    await screen.findByText(STREAK_TEXT);
    await flush();
    expect(resumeCards()).toHaveLength(0);
    first.unmount();
    api.getFeaturedDailyPrompt.mockClear();
    api.getMonthStatus.mockClear();

    storeIncompleteLoop(incompleteLoopFor(P_I2, {}));
    const user = await renderHome();
    expect(resumeCards()).toHaveLength(1);
    let card = resumeCards()[0] as HTMLElement;
    expect(card.tagName).toBe("SECTION");
    expect(card.parentElement).toBe(pickFlow());
    expect(classTokens(card.previousElementSibling as Element)).toEqual(["page:difficultyHomeHero"]);
    expect((card.nextElementSibling as Element).getAttribute("href")).toBe("/diary");

    await openPromptList(user, "입문", P_I1);
    expect(resumeCards()).toHaveLength(1);
    card = resumeCards()[0] as HTMLElement;
    expect(card.parentElement).toBe(pickFlow());
    expect(classTokens(card.previousElementSibling as Element)).toEqual(["page:difficultyHomeHero"]);
    expect(classTokens(card.nextElementSibling as Element)).toEqual(["page:difficultyHomeStage"]);
    expect((card.nextElementSibling as Element).getElementsByClassName(styles.promptSelectionCardGrid)).toHaveLength(1);
  });

  it("[spec] 이어 쓰기(답 쓰기 단계): 누르면 그 질문의 서버 초안을 되살려 답 쓰기 화면을 열고 '이어서 쓰던 흐름을 불러왔어요.'를 보여 준다", async () => {
    // 되살린 뒤 자동 임시저장이 끝나면 안내가 바뀌므로, 이 테스트에서는 임시저장이 끝나지 않게 둔다.
    api.saveWritingDraft.mockImplementation(() => new Promise(() => undefined));
    drafts.set(`${P_I2.id}:ANSWER`, draftFor(P_I2, { answer: "I cleaned my room on Saturday." }));
    storeIncompleteLoop(incompleteLoopFor(P_I2, { step: "answer" }));
    const user = await renderHome();
    api.getWritingDraft.mockClear();

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await screen.findByDisplayValue("I cleaned my room on Saturday.");
    expect(composerQuestion()).toBe(P_I2.questionEn);
    expect(queryPickFlow()).toBeUndefined();
    const badge = byClass(main(), styles.composerStatusBadge);
    expect(badge.textContent).toBe(RESUME_MESSAGE);
    expect(badge).toHaveAttribute("title", RESUME_MESSAGE);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P_I2.id, "REWRITE"],
      [P_I2.id, "ANSWER"]
    ]);
    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
  });

  it("[spec] 이어 쓰기(피드백 단계): 서버 초안을 찾지 않고 저장된 흐름으로 피드백 화면을 연다", async () => {
    const feedback = feedbackFor(P_I2, "sess-pick-1", 1);
    storeIncompleteLoop(
      incompleteLoopFor(P_I2, {
        step: "feedback",
        sessionId: "sess-pick-1",
        snapshot: snapshotFor(P_I2, {
          step: "feedback",
          sessionId: "sess-pick-1",
          answer: "I stayed home.",
          lastSubmittedAnswer: "I stayed home.",
          feedback
        })
      })
    );
    const user = await renderHome();
    api.getWritingDraft.mockClear();

    await user.click(screen.getByRole("button", { name: /피드백 이어보기/ }));
    await screen.findByText("1번째 시도");
    expect(queryPickFlow()).toBeUndefined();
    expect(api.getWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 이어 쓰기: 서버 초안도 저장된 흐름도 없으면 그 질문의 난이도로 질문 목록을 연다. 난이도 화면에서 누르면 목록을 다시 불러오며 안내 문구가 지워지고, 이미 그 난이도의 목록 화면이면 '이전 내용을 바로 불러오지 못해 질문부터 다시 열어두었어요.'가 남는다", async () => {
    storeIncompleteLoop(incompleteLoopFor(P_A2, { step: "answer", snapshot: null }));
    const user = await renderHome();

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await waitFor(() => expect(promptQuestions()).toEqual([P_A1.questionEn, P_A2.questionEn]));
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(byClass(pickFlow(), styles.promptSelectionDifficultyText).textContent).toBe("쉬움");
    expect(promptCards().map((card) => card[1])).toEqual([P_A1.questionEn, P_A2.questionEn]);
    await flush();
    expect(errorTexts()).toEqual([]);
    expect(api.getDailyPrompts).toHaveBeenLastCalledWith("A", GUEST_ID);
    const dailyCallsBefore = api.getDailyPrompts.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await waitFor(() =>
      expect(errorTexts()).toEqual(["이전 내용을 바로 불러오지 못해 질문부터 다시 열어두었어요."])
    );
    await flush();
    expect(errorTexts()).toEqual(["이전 내용을 바로 불러오지 못해 질문부터 다시 열어두었어요."]);
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(api.getDailyPrompts.mock.calls).toHaveLength(dailyCallsBefore);
  });
});
