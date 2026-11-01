// [spec] qa 테스트(작업 040 웹 이어 쓰기 질문 바뀜, 버그 수정). 쓰던 흐름을 되살린 뒤 추천 질문 목록을 다시 받아도
// 화면 위의 질문(선택한 질문)이 그대로인지 본다.
// 재현 테스트(지금 코드에서 실패해야 한다): 되살리기 네 경로(이어 쓰기 카드의 '이어서 쓰기', '피드백 이어보기',
// 질문을 골라 저장된 초안이 되살아날 때, 로그인한 뒤 로그인 전 초안이 되살아날 때)와, 답 쓰기 화면에 있는 동안 목록을 다시 받는 경우.
// 지킴 테스트(지금 코드에서 통과해야 한다): 질문 고르기 화면에서는 지금처럼 새 목록의 첫 질문을 고르고,
// 되살릴 때 목록은 지금처럼 한 번 불러 새로 받은 것으로 바꾼다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜이고,
// 브라우저 저장소(localStorage, sessionStorage)는 테스트 환경(jsdom)의 것이다.
// 추천 질문 목록은 테스트가 정한 때에 오도록 기다리게 둔 약속(deferred)으로 돌려준다(되살린 뒤에 목록이 오는 순서를 고정한다).
// 자동 임시저장의 900ms는 진짜 시간으로 기다린다(Testing Library의 조작이 가짜 타이머에서 멈추므로).
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import type { IncompleteLoopState } from "../../lib/incomplete-loop";
import type {
  AuthUser,
  DailyPromptRecommendation,
  FeaturedDailyPromptRecommendation,
  Feedback,
  HomeDraftSnapshot,
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
  default: ({
    href,
    children,
    className,
    onClick
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
    >
      {children}
    </a>
  )
}));

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />
}));

vi.mock("canvas-confetti", () => ({
  default: { create: () => () => undefined }
}));

const USER: AuthUser = {
  id: 5401,
  email: "resume-prompt-spec@example.com",
  displayName: "이어쓰기",
  admin: false
};

// 형식 검사(guest-[a-z0-9-]{18,})를 통과하는 게스트 id. 로그인한 사용자도 이 값을 가진다.
const GUEST_ID = "guest-resume-spec-000000000000001";

const TODAY: TodayWritingStatus = {
  date: "2026-04-15",
  completed: false,
  completedSessions: 0,
  startedSessions: 1,
  streakDays: 3,
  totalAnswerSessions: 10,
  totalWrittenSentences: 1234
};

function prompt(id: string, difficulty: Prompt["difficulty"], topic: string, questionEn: string, questionKo: string): Prompt {
  return { id, topic, topicCategory: "Daily life", topicDetail: topic, difficulty, questionEn, questionKo, tip: "" };
}

const P1 = prompt("prompt-resume-1", "I", "Morning", "What do you do first in the morning?", "아침에 가장 먼저 무엇을 하나요?");
// 되살리는 질문. 처음 받은 목록에서는 첫 질문이 아니고, 다시 받은 목록에는 없다.
const P2 = prompt("prompt-resume-2", "I", "Breakfast", "What did you eat for breakfast today?", "오늘 아침으로 무엇을 먹었나요?");
const P3 = prompt("prompt-resume-3", "I", "Commute", "How do you get to work or school?", "회사나 학교에 어떻게 가나요?");
const P4 = prompt("prompt-resume-4", "I", "Music", "What song have you listened to a lot lately?", "요즘 많이 들은 노래는 무엇인가요?");
// 오늘의 추천 질문(난이도 화면의 카드). 추천 질문 목록에는 없다.
const PF = prompt("prompt-resume-f", "I", "Hobby", "What hobby would you like to try this year?", "올해 해 보고 싶은 취미는 무엇인가요?");
// 입문 목록에 섞여 나오는 난이도 보통 질문과, 보통 목록의 다른 질문.
const PB1 = prompt("prompt-resume-b1", "B", "Pets", "Would you like to have a pet someday?", "언젠가 반려동물을 키우고 싶나요?");
const PB2 = prompt("prompt-resume-b2", "B", "Cities", "Which city would you like to live in?", "어느 도시에 살고 싶나요?");

// 전체 질문 목록(getPrompts). 되살린 질문은 추천 목록에 없어도 여기서 찾는다.
const ALL_PROMPTS = [P1, P2, P3, P4, PF, PB1, PB2];

// 처음 받은 추천 목록과, 다시 부를 때 받는 다른 목록(게스트는 부를 때마다 목록이 달라진다).
const DAILY_FIRST: DailyPromptRecommendation = { recommendedDate: "2026-04-15", difficulty: "I", prompts: [P1, P2] };
const DAILY_SECOND: DailyPromptRecommendation = { recommendedDate: "2026-04-15", difficulty: "I", prompts: [P3, P4] };
const DAILY_MIXED: DailyPromptRecommendation = { recommendedDate: "2026-04-15", difficulty: "I", prompts: [P1, PB1] };
const DAILY_B: DailyPromptRecommendation = { recommendedDate: "2026-04-15", difficulty: "B", prompts: [PB2] };

const FEATURED: FeaturedDailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  featured: { slot: "featured", prompt: PF, reasonCode: "SPEC", reasonText: "요즘 쓴 답과 이어지는 주제예요.", reasonFacts: [], score: 1 }
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const REWRITE_PLACEHOLDER = "피드백을 반영한 영어 답변을 다시 작성해 주세요.";
const RESUMED = "이어서 쓰던 흐름을 불러왔어요.";
const RESTORED = "이전 초안을 복원했어요.";

// 브라우저 저장소의 키(lib/auth-flow, lib/incomplete-loop, lib/home-writing-drafts).
const LOGIN_DRAFT_KEY = "writeloop_post_login_home_draft";

function scope(ownerId: number | null) {
  return ownerId ? `user:${ownerId}` : "guest";
}

function loopKey(ownerId: number | null) {
  return `writeloop_incomplete_loop:${scope(ownerId)}`;
}

function localDraftKey(promptId: string, draftType: "ANSWER" | "REWRITE", ownerId: number | null) {
  return `writeloop_home_writing_draft:${scope(ownerId)}:${promptId}:${draftType}`;
}

function readJson(key: string) {
  const raw = window.localStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
}

type User = ReturnType<typeof userEvent.setup>;

function makeFeedback(partial: Partial<Feedback>): Feedback {
  return {
    promptId: P2.id,
    sessionId: "sess-resume-2",
    attemptNo: 1,
    loopComplete: false,
    completionMessage: null,
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: null,
    refinementExpressions: null,
    modelAnswer: "",
    rewriteChallenge: "",
    ...partial
  };
}

// 다시 쓰기가 필요한 피드백. 피드백 화면의 다시 쓰기 버튼은 '다시 써보기'다.
function needsRewrite(attemptNo: number, sessionId: string, promptId: string): Feedback {
  return makeFeedback({
    promptId,
    sessionId,
    attemptNo,
    visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", coachMove: { focus: "이유를 한 문장 더해 보세요." } }
  });
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
    updatedAt: "2026-04-15T08:00:00Z",
    ...snapshotFor(target, {}),
    ...partial
  };
}

function incompleteLoopFor(target: Prompt, partial: Partial<IncompleteLoopState>): IncompleteLoopState {
  return {
    promptId: target.id,
    difficulty: target.difficulty as IncompleteLoopState["difficulty"],
    step: "answer",
    draftType: "ANSWER",
    updatedAt: "2026-04-15T08:30:00.000Z",
    promptSnapshot: { topic: target.topic, questionEn: target.questionEn, questionKo: target.questionKo },
    snapshot: null,
    ...partial
  };
}

// 게스트가 P2에 답을 쓰다 둔 상태(새로 고친 뒤): 이 기기(게스트 칸)의 답 초안과 이어 쓰기 상태.
const GUEST_ANSWER = "I had eggs.";

function storeGuestAnswerLoop() {
  const snapshot = snapshotFor(P2, { answer: GUEST_ANSWER });
  window.localStorage.setItem(
    localDraftKey(P2.id, "ANSWER", null),
    JSON.stringify(draftFor(P2, { answer: GUEST_ANSWER }))
  );
  window.localStorage.setItem(loopKey(null), JSON.stringify(incompleteLoopFor(P2, { snapshot })));
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

// 기다리게 둔 추천 목록을 보내고, 받은 뒤의 화면 갱신이 끝날 때까지 기다린다.
async function deliver(request: ReturnType<typeof deferred<DailyPromptRecommendation>>, recommendation: DailyPromptRecommendation) {
  await act(async () => {
    request.resolve(recommendation);
  });
  await flush();
  await flush();
}

function byClass(container: Element, className: string) {
  const found = container.getElementsByClassName(className);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

function main() {
  return screen.getByRole("main");
}

// 답 쓰기·다시 쓰기 걸음 화면.
function stage() {
  return byClass(main(), styles.writingEditorStage);
}

function answerInput() {
  return screen.getByPlaceholderText(ANSWER_PLACEHOLDER) as HTMLTextAreaElement;
}

function rewriteInput() {
  return screen.getByPlaceholderText(REWRITE_PLACEHOLDER) as HTMLTextAreaElement;
}

// 화면 위의 질문 글자.
function composerQuestion() {
  return byClass(stage(), styles.writingComposerQuestionText).textContent;
}

function desktopSubmit() {
  return byClass(stage(), styles.composerDesktopActions).querySelector("button") as HTMLButtonElement;
}

// 임시저장 문구(배지의 title에 문구 전체가 있다). 배지가 없으면 null.
function draftStatus() {
  const nodes = Array.from(byClass(stage(), styles.composerMetaBadges).children);
  if (nodes.length === 1) {
    return null;
  }
  expect(nodes).toHaveLength(2);
  return nodes[0].getAttribute("title");
}

function promptCard(target: Prompt) {
  const grid = byClass(main(), styles.promptSelectionCardGrid);
  return within(grid).getByText(target.questionEn, { selector: "strong" }).closest("article") as HTMLElement;
}

// 질문 목록 카드의 질문 글자(순서대로).
function listedQuestions() {
  const grid = byClass(main(), styles.promptSelectionCardGrid);
  return Array.from(grid.querySelectorAll("article strong")).map((node) => node.textContent);
}

function difficultyCard(label: string) {
  const found = Array.from(main().getElementsByClassName(styles.difficultyHomeCard)).filter(
    (card) => card.querySelector(`.${styles.difficultyHomeCardCopy} > strong`)?.textContent === label
  );
  expect(found).toHaveLength(1);
  return found[0] as HTMLButtonElement;
}

function pickFlow() {
  return byClass(main(), styles.pickFlow);
}

// 첫 화면을 렌더한다. 로그인 확인이 끝나 오늘의 추천 질문을 부를 때까지, 로그인했으면 저장된 표현을 부를 때까지 기다린다.
async function renderHome(loggedIn: boolean) {
  api.getCurrentUser.mockResolvedValue(loggedIn ? USER : null);
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

// 화면을 지우고 새로 연다(새로 고침). 브라우저 저장소는 그대로다.
async function remount(loggedIn: boolean) {
  cleanup();
  api.getFeaturedDailyPrompt.mockClear();
  api.getSavedExpressions.mockClear();
  return renderHome(loggedIn);
}

// 난이도 카드를 눌러 질문 목록을 열고, 첫 질문이 보일 때까지 기다린다.
async function openList(user: User, difficultyLabel: string, first: Prompt) {
  await user.click(difficultyCard(difficultyLabel));
  await waitFor(() => expect(promptCard(first)).toBeInTheDocument());
  await flush();
  await flush();
}

describe("[spec] AnswerLoop 되살린 뒤 추천 목록을 다시 받아도 질문이 그대로다(작업 040)", { timeout: 20000 }, () => {
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

    api.getTodayWritingStatus.mockResolvedValue(TODAY);
    api.getMonthStatus.mockImplementation((year: number, month: number) =>
      Promise.resolve({ year, month, streakDays: 0, days: [] })
    );
    api.getSavedExpressions.mockResolvedValue([]);
    api.getPrompts.mockResolvedValue(ALL_PROMPTS);
    api.getFeaturedDailyPrompt.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.getDailyPrompts.mockResolvedValue(DAILY_FIRST);
    api.getPromptHints.mockResolvedValue([]);
    api.getWritingDraft.mockImplementation((promptId: string, draftType: string) =>
      Promise.resolve(drafts.get(`${promptId}:${draftType}`) ?? null)
    );
    api.saveWritingDraft.mockImplementation((promptId: string, request: object) =>
      Promise.resolve({ ...request, promptId, selectedPromptId: promptId, updatedAt: "2026-04-15T09:00:00Z" })
    );
    api.deleteWritingDraft.mockResolvedValue(undefined);
    api.trackDailyPromptClick.mockResolvedValue(undefined);
    api.requestCoachHelp.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.checkCoachExpressionUsage.mockResolvedValue({
      promptId: P2.id,
      praiseMessage: "",
      usedExpressions: [],
      unusedExpressions: [],
      relatedPromptIds: []
    });
    api.completeFeedbackSession.mockImplementation((sessionId: string) =>
      Promise.resolve({ sessionId, status: "COMPLETED" })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    document.body.style.overflow = "";
  });

  // ---------------------------------------------------------------- 재현(지금 코드에서 실패)

  it("[spec] 재현: 게스트가 목록의 두 번째 질문에 답을 쓰다 새로 고친 뒤 '이어서 쓰기'를 누르면, 다시 받은 추천 목록에 그 질문이 없어도 화면 위의 질문은 쓰던 질문이고 답·안내 문구도 그대로다", async () => {
    let user = await renderHome(false);
    await openList(user, "입문", P1);
    await user.click(promptCard(P2));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    await user.type(answerInput(), GUEST_ANSWER);
    await waitFor(() => expect(draftStatus()).toBe("이 기기에 임시저장됨"), { timeout: 3000 });

    // 새로 고친 뒤에는 추천 목록을 부르면 다른 목록이 온다.
    user = await remount(false);
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    expect(api.getDailyPrompts).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await screen.findByDisplayValue(GUEST_ANSWER);
    expect(composerQuestion()).toBe(P2.questionEn);
    // 되살리면서 추천 목록을 다시 부른다.
    expect(api.getDailyPrompts).toHaveBeenCalledTimes(2);

    await deliver(daily, DAILY_SECOND);
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(answerInput().value).toBe(GUEST_ANSWER);
    expect(draftStatus()).toBe(RESUMED);
  });

  it("[spec] 재현: '이어서 쓰기'로 되살린 뒤 추천 목록이 와도, 그대로 제출하면 쓰던 질문의 답으로 제출한다", async () => {
    storeGuestAnswerLoop();
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    api.submitFeedback.mockResolvedValueOnce(needsRewrite(1, "sess-resume-2", P2.id));
    const user = await renderHome(false);

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await screen.findByDisplayValue(GUEST_ANSWER);
    await deliver(daily, DAILY_SECOND);
    await waitFor(() => expect(desktopSubmit()).toBeEnabled());

    await user.click(desktopSubmit());
    await screen.findByText("1번째 시도");
    expect(api.submitFeedback).toHaveBeenCalledTimes(1);
    expect(api.submitFeedback.mock.calls[0][0]).toMatchObject({
      promptId: P2.id,
      answer: GUEST_ANSWER,
      attemptType: "INITIAL",
      guestId: GUEST_ID
    });
  });

  it("[spec] 재현: '이어서 쓰기'로 되살린 뒤 추천 목록이 와도, 이어 쓰기 상태와 자동 임시저장은 쓰던 질문으로 저장한다(목록의 첫 질문으로 저장하지 않는다)", async () => {
    storeGuestAnswerLoop();
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    const user = await renderHome(false);

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await screen.findByDisplayValue(GUEST_ANSWER);
    await deliver(daily, DAILY_SECOND);
    expect(readJson(loopKey(null))?.promptId).toBe(P2.id);

    await user.type(answerInput(), " Every day.");
    await waitFor(() => expect(draftStatus()).toBe("이 기기에 임시저장됨"), { timeout: 3000 });
    expect(readJson(localDraftKey(P2.id, "ANSWER", null))).toMatchObject({
      promptId: P2.id,
      selectedPromptId: P2.id,
      answer: `${GUEST_ANSWER} Every day.`
    });
    expect(window.localStorage.getItem(localDraftKey(P3.id, "ANSWER", null))).toBeNull();
    expect(readJson(loopKey(null))).toMatchObject({
      promptId: P2.id,
      promptSnapshot: { topic: P2.topic, questionEn: P2.questionEn, questionKo: P2.questionKo }
    });
  });

  it("[spec] 재현: '피드백 이어보기'로 피드백 화면을 되살린 뒤 추천 목록이 와도, '다시 써보기'를 누르면 화면 위의 질문은 피드백을 받은 질문이고 이어 쓰기 상태도 그 질문이다", async () => {
    const feedback = needsRewrite(1, "sess-resume-2", P2.id);
    window.localStorage.setItem(
      loopKey(null),
      JSON.stringify(
        incompleteLoopFor(P2, {
          step: "feedback",
          sessionId: "sess-resume-2",
          snapshot: snapshotFor(P2, {
            step: "feedback",
            sessionId: "sess-resume-2",
            answer: GUEST_ANSWER,
            lastSubmittedAnswer: GUEST_ANSWER,
            feedback
          })
        })
      )
    );
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    const user = await renderHome(false);

    await user.click(screen.getByRole("button", { name: /피드백 이어보기/ }));
    await screen.findByText("1번째 시도");
    expect(api.getDailyPrompts).toHaveBeenCalledTimes(1);
    await deliver(daily, DAILY_SECOND);

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(rewriteInput().value).toBe(GUEST_ANSWER);
    expect(readJson(loopKey(null))).toMatchObject({ promptId: P2.id, step: "rewrite", sessionId: "sess-resume-2" });
  });

  it("[spec] 재현: 로그인한 뒤 로그인 전 초안이 되살아나고 추천 목록이 와도, 화면 위의 질문은 로그인 전에 쓰던 질문이다", async () => {
    window.sessionStorage.setItem(
      LOGIN_DRAFT_KEY,
      JSON.stringify(snapshotFor(P2, { step: "answer", answer: "Login answer." }))
    );
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    api.getCurrentUser.mockResolvedValue(USER);

    render(<AnswerLoop />);
    await screen.findByDisplayValue("Login answer.");
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    await waitFor(() => expect(api.getDailyPrompts).toHaveBeenCalledTimes(1));
    await deliver(daily, DAILY_SECOND);

    expect(composerQuestion()).toBe(P2.questionEn);
    expect(answerInput().value).toBe("Login answer.");
  });

  it("[spec] 재현: 난이도 화면의 오늘의 추천 질문을 골라 저장된 초안이 되살아나고 추천 목록이 와도, 화면 위의 질문은 고른 질문이다", async () => {
    api.getFeaturedDailyPrompt.mockResolvedValue(FEATURED);
    drafts.set(`${PF.id}:ANSWER`, draftFor(PF, { answer: "I want to try climbing." }));
    // 되살린 뒤 자동 임시저장 응답이 오지 않게 두어, 안내 문구가 되살리기 문구로 남게 한다.
    api.saveWritingDraft.mockImplementation(() => new Promise(() => undefined));
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    const user = await renderHome(true);
    await screen.findByText(PF.questionEn);

    await user.click(byClass(main(), styles.prefeaturedPromptCard));
    await screen.findByDisplayValue("I want to try climbing.");
    expect(composerQuestion()).toBe(PF.questionEn);
    expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]);
    await deliver(daily, DAILY_SECOND);

    expect(composerQuestion()).toBe(PF.questionEn);
    expect(answerInput().value).toBe("I want to try climbing.");
    expect(draftStatus()).toBe(RESTORED);
  });

  it("[spec] 재현(고칠 동작 1): 입문 목록에서 난이도가 다른 질문을 골라 답 쓰기 화면이 열린 뒤 그 난이도의 추천 목록이 와도, 화면 위의 질문은 고른 질문이다", async () => {
    api.getDailyPrompts.mockResolvedValueOnce(DAILY_MIXED);
    const user = await renderHome(true);
    await openList(user, "입문", P1);
    const dailyB = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => dailyB.promise);

    await user.click(promptCard(PB1));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(composerQuestion()).toBe(PB1.questionEn));
    expect(api.getDailyPrompts.mock.calls).toEqual([
      ["I", GUEST_ID],
      ["B", GUEST_ID]
    ]);
    await deliver(dailyB, DAILY_B);

    expect(composerQuestion()).toBe(PB1.questionEn);
  });

  it("[spec] 재현(고칠 동작 1): 표현 연습 주소(/?promptId=...)로 바로 열린 답 쓰기 화면은 추천 목록이 와서 그 질문이 목록에 없어도, 화면 위의 질문이 주소의 질문이다", async () => {
    window.history.replaceState(
      {},
      "",
      `/?${new URLSearchParams({ promptId: P2.id, difficulty: "I", prefillExpression: "make time for" }).toString()}`
    );
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    api.getCurrentUser.mockResolvedValue(USER);

    render(<AnswerLoop />);
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    await waitFor(() => expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]));
    await deliver(daily, DAILY_SECOND);

    expect(composerQuestion()).toBe(P2.questionEn);
  });

  // ---------------------------------------------------------------- 지킴(지금 코드에서 통과, 고친 뒤에도 통과)

  it("[spec] 지킴: 질문 고르기 화면(step pick)에서 추천 목록을 다시 받으면, 선택한 질문이 새 목록에 없을 때 새 목록의 첫 질문을 고른다(그 질문의 힌트를 부른다)", async () => {
    const user = await renderHome(false);
    await openList(user, "입문", P1);
    await user.click(promptCard(P2));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    await waitFor(() => expect(api.getPromptHints).toHaveBeenLastCalledWith(P2.id));

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    await user.click(within(pickFlow()).getByRole("button", { name: "난이도 선택" }));
    await screen.findByRole("heading", { name: "난이도 선택" });
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    await user.click(difficultyCard("입문"));
    expect(api.getDailyPrompts).toHaveBeenCalledTimes(2);
    await deliver(daily, DAILY_SECOND);

    expect(listedQuestions()).toEqual([P3.questionEn, P4.questionEn]);
    await waitFor(() => expect(api.getPromptHints).toHaveBeenLastCalledWith(P3.id));
  });

  it("[spec] 지킴: '이어서 쓰기'로 되살릴 때 추천 목록은 지금처럼 한 번(고른 난이도, 게스트 id) 부르고, 받은 목록으로 바꾼다('질문 다시 고르기'로 돌아가면 새 목록이 보인다)", async () => {
    storeGuestAnswerLoop();
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    const user = await renderHome(false);
    expect(api.getDailyPrompts).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await screen.findByDisplayValue(GUEST_ANSWER);
    await deliver(daily, DAILY_SECOND);
    expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]);

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    await flush();
    expect(listedQuestions()).toEqual([P3.questionEn, P4.questionEn]);
    expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]);
  });

  // ---------------------------------------------------------------- 지킴(결정 10의 1, 구현 뒤에 더함. 테스트 커밋 시점에 통과)
  // 결정 03의 1 둘째 문장: 전체 질문 목록(getPrompts)을 아직 불러오지 못했으면 선택한 질문을 바꾸지 않는다.
  // 전체 질문 목록을 기다리게 둔 채 되살리고, 되살린 질문이 없는 추천 목록을 먼저 보낸 뒤 전체 질문 목록을 보낸다.

  it("[spec] 지킴(결정 10-1): 전체 질문 목록이 아직 오지 않은 채 '이어서 쓰기'로 되살리고 되살린 질문이 없는 추천 목록이 먼저 와도, 전체 질문 목록이 온 뒤 화면 위의 질문은 되살린 질문이다", async () => {
    storeGuestAnswerLoop();
    const allPromptsRequest = deferred<Prompt[]>();
    api.getPrompts.mockImplementation(() => allPromptsRequest.promise);
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    const user = await renderHome(false);

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await screen.findByDisplayValue(GUEST_ANSWER);
    expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]);
    await deliver(daily, DAILY_SECOND);
    expect(api.getPrompts).toHaveBeenCalledTimes(1);

    await act(async () => {
      allPromptsRequest.resolve(ALL_PROMPTS);
    });
    await flush();
    await flush();
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(answerInput().value).toBe(GUEST_ANSWER);
  });

  it("[spec] 지킴(결정 10-1): 전체 질문 목록이 아직 오지 않은 채 로그인 뒤 로그인 전 초안이 되살아나고 되살린 질문이 없는 추천 목록이 먼저 와도, 전체 질문 목록이 온 뒤 화면 위의 질문은 로그인 전에 쓰던 질문이다", async () => {
    window.sessionStorage.setItem(
      LOGIN_DRAFT_KEY,
      JSON.stringify(snapshotFor(P2, { step: "answer", answer: "Login answer." }))
    );
    const allPromptsRequest = deferred<Prompt[]>();
    api.getPrompts.mockImplementation(() => allPromptsRequest.promise);
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementationOnce(() => daily.promise);
    api.getCurrentUser.mockResolvedValue(USER);

    render(<AnswerLoop />);
    await screen.findByDisplayValue("Login answer.");
    await waitFor(() => expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]));
    await deliver(daily, DAILY_SECOND);
    expect(api.getPrompts).toHaveBeenCalledTimes(1);

    await act(async () => {
      allPromptsRequest.resolve(ALL_PROMPTS);
    });
    await flush();
    await flush();
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(answerInput().value).toBe("Login answer.");
  });
});
