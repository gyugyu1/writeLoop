// [spec] qa 테스트(작업 037-13 초안 저장·복구, 리팩터링). 초안 저장·복구(자동 임시저장, 저장된 초안 되살리기,
// 로그인 전 초안 넘기기, 이어 쓰기 상태)를 answer-loop.tsx 밖의 훅으로 옮기기 전의 "지금 동작"을 기록한다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜이고,
// 브라우저 저장소(localStorage, sessionStorage)는 테스트 환경(jsdom)의 것이다. 저장된 내용(키, 값, 키 순서)도 동작으로 기록한다.
// next/link 가짜는 받은 onClick을 부른 뒤 이동은 막는다(로그인 안내 창의 링크가 누를 때 초안을 넘겨 두는지 보려고).
// next/image 가짜는 src·alt만 <img>에 넘긴다(로그인 안내 창 스냅숏의 그림은 그 둘만 나온다).
// 완료 화면의 축하 효과(canvas-confetti)는 jsdom에 canvas 그리기가 없어 아무것도 하지 않는 가짜로 둔다.
// 자동 임시저장의 900ms는 진짜 시간으로 기다린다(Testing Library의 조작이 가짜 타이머에서 멈추므로). 저장 시각을 정확히 볼 때만 Date를 고정한다.
// 화면 바깥에서 동작만 보므로, 안쪽을 훅으로 나눠도 같은 테스트가 그대로 통과해야 한다.
//
// 이미 다른 qa 테스트가 기록한 것은 다시 쓰지 않는다(웹 테스트 전체 실행에 들어 있다).
//   - 임시저장 배지의 글자·title·클래스(저장 성공, 서버 실패, 모두 실패, 기기 저장 성공·실패), 되살린 초안의 배지 묶음 스냅숏:
//     answer-loop-writing-steps.spec.test.tsx
//   - 이어 쓰기 카드의 문구·구조·클래스·자리, 다른 사용자의 이어 쓰기가 안 보임, 이어 쓰기(답 쓰기 단계, 서버 초안),
//     이어 쓰기(피드백 단계, 서버 초안을 찾지 않음), 이어 쓰기(아무것도 없으면 질문 목록과 안내 문구),
//     질문 카드를 누르면 그 질문의 서버 초안을 되살려 엶: answer-loop-pick-step.spec.test.tsx
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import { ApiError } from "../../lib/api";
import type { IncompleteLoopState } from "../../lib/incomplete-loop";
import type {
  AuthUser,
  DailyPromptRecommendation,
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
  id: 5313,
  email: "drafts-spec@example.com",
  displayName: "초안",
  admin: false
};

// 로그인한 사용자도 게스트 id를 가진다(질문 고르기 기록, 제출에 실린다). 형식 검사(guest-[a-z0-9-]{18,})를 통과하는 값.
const GUEST_ID = "guest-drafts-spec-000000000000001";

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

const P1 = prompt("prompt-draft-1", "I", "Morning routine", "What do you do first in the morning?", "아침에 가장 먼저 무엇을 하나요?");
const P2 = prompt("prompt-draft-2", "I", "Breakfast", "What did you eat for breakfast today?", "오늘 아침으로 무엇을 먹었나요?");
const P3 = prompt("prompt-draft-3", "A", "Cooking", "What dish do you cook most often?", "가장 자주 만드는 요리는 무엇인가요?");
const P4 = prompt("prompt-draft-4", "I", "Travel", "Where did you go on your last trip?", "지난 여행에서 어디에 갔나요?");

const ALL_PROMPTS = [P1, P2, P3, P4];

const DAILY_I: DailyPromptRecommendation = { recommendedDate: "2026-04-15", difficulty: "I", prompts: [P1, P2] };
const DAILY_I_NEXT: DailyPromptRecommendation = { recommendedDate: "2026-04-15", difficulty: "I", prompts: [P4] };
const DAILY_A: DailyPromptRecommendation = { recommendedDate: "2026-04-15", difficulty: "A", prompts: [P3] };

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const REWRITE_PLACEHOLDER = "피드백을 반영한 영어 답변을 다시 작성해 주세요.";
const FIRST_ANSWER = "I drink water.";
const SECOND_ANSWER = "I drink two glasses of water.";
const FINISH_LABEL = "오늘 루프 완료하고 도장 받기";
const RESTORED = "이전 초안을 복원했어요.";
const RESUMED = "이어서 쓰던 흐름을 불러왔어요.";
const LOGIN_WALL = "로그인하면 계속 학습할 수 있어요";

// 서버 초안 저장 응답의 시각. 화면 문구는 toLocaleTimeString("ko-KR", 2자리 시·분)이고,
// 그 글자는 실행 환경의 시간대·ICU에 따라 달라서 같은 계산으로 기대값을 만든다.
const SAVED_AT = "2026-04-15T09:00:00Z";
const SAVED_MESSAGE = `임시저장됨 · ${new Date(SAVED_AT).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;

// 저장 시각을 정확히 볼 때 고정하는 기기 시각.
const NOW = "2026-04-15T10:20:30.000Z";

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

// 자동 저장 요청(saveWritingDraft의 둘째 인자)의 키 순서.
const SAVE_REQUEST_KEYS = ["draftType", "selectedDifficulty", "sessionId", "answer", "rewrite", "lastSubmittedAnswer", "feedback", "step"];

type User = ReturnType<typeof userEvent.setup>;

function makeFeedback(partial: Partial<Feedback>): Feedback {
  return {
    promptId: P1.id,
    sessionId: "sess-draft-1",
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
function needsRewrite(attemptNo: number, sessionId = "sess-draft-1", promptId = P1.id): Feedback {
  return makeFeedback({
    promptId,
    sessionId,
    attemptNo,
    visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", coachMove: { focus: "이유를 한 문장 더해 보세요." } }
  });
}

// 마칠 준비가 된 피드백. 피드백 화면의 마치기 버튼은 FINISH_LABEL이다.
function ready(attemptNo: number, sessionId = "sess-draft-1"): Feedback {
  return makeFeedback({
    sessionId,
    attemptNo,
    loopComplete: true,
    completionMessage: "오늘도 끝까지 썼어요.",
    visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
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

function storeIncompleteLoop(state: IncompleteLoopState, ownerId: number | null) {
  window.localStorage.setItem(loopKey(ownerId), JSON.stringify(state));
}

function storeLocalDraft(draft: WritingDraft, ownerId: number | null) {
  window.localStorage.setItem(localDraftKey(draft.promptId, draft.draftType, ownerId), JSON.stringify(draft));
}

function readJson(storage: Storage, key: string) {
  const raw = storage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
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

async function wait(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

// page.module.css의 클래스는 테스트에서 "_<이름>_<파일 해시>"로 나온다. 이 파일의 클래스는 "page:<이름>"으로 바꿔 읽기 쉽게 하고,
// 다른 CSS 파일의 클래스는 그대로 둔다. 클래스 문자열 안의 빈칸 수와 순서는 화면에 영향이 없으므로 정렬해 비교한다.
const PAGE_CLASS_SUFFIX = (styles.loginWall as string).slice("_loginWall".length);

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

// 스냅숏은 class 정리와 붙은 글자 조각 합치기만 하고, 그 밖의 속성, 글자, 요소 구조는 화면 그대로다.
function normalizeForSnapshot(element: Element) {
  const clone = element.cloneNode(true) as HTMLElement;
  [clone, ...Array.from(clone.querySelectorAll("*"))].forEach((node) => {
    const value = node.getAttribute("class");
    if (value !== null) {
      node.setAttribute("class", normalizeClassTokens(value).join(" "));
    }
  });
  clone.normalize();
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

function composerQuestion() {
  return byClass(stage(), styles.writingComposerQuestionText).textContent;
}

function desktopSubmit() {
  return byClass(stage(), styles.composerDesktopActions).querySelector("button") as HTMLButtonElement;
}

function rewriteSubmit() {
  return byClass(stage(), styles.writingEditorFooter).querySelector("button") as HTMLButtonElement;
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

function errorTexts() {
  return Array.from(main().getElementsByClassName(styles.errorText)).map((node) => node.textContent);
}

function resumeCards() {
  return Array.from(main().getElementsByClassName(styles.difficultyHomeResumeCard)) as HTMLElement[];
}

function resumeCardTitle() {
  const cards = resumeCards();
  expect(cards).toHaveLength(1);
  return byClass(cards[0], styles.difficultyHomeResumeTop).querySelector("strong")?.textContent;
}

function promptCard(target: Prompt) {
  const grid = byClass(main(), styles.promptSelectionCardGrid);
  return within(grid).getByText(target.questionEn, { selector: "strong" }).closest("article") as HTMLElement;
}

// 난이도 카드(이름으로 찾는다).
function difficultyCard(label: string) {
  const found = Array.from(main().getElementsByClassName(styles.difficultyHomeCard)).filter(
    (card) => card.querySelector(`.${styles.difficultyHomeCardCopy} > strong`)?.textContent === label
  );
  expect(found).toHaveLength(1);
  return found[0] as HTMLButtonElement;
}

// 첫 화면을 렌더한다. 로그인 확인이 끝나 오늘의 추천 질문을 부를 때까지, 로그인했으면 저장된 표현을 부를 때까지 기다린다.
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

// 화면을 지우고 새로 연다(새로 고침). 브라우저 저장소는 그대로다.
async function remount(loggedIn = true) {
  cleanup();
  api.getFeaturedDailyPrompt.mockClear();
  api.getSavedExpressions.mockClear();
  return renderHome(loggedIn);
}

// 난이도 카드를 눌러 질문 목록을 열고, 첫 질문이 보일 때까지 기다린다.
async function openList(user: User, difficultyLabel = "입문", first: Prompt = P1) {
  await user.click(difficultyCard(difficultyLabel));
  await waitFor(() => expect(promptCard(first)).toBeInTheDocument());
  await flush();
  await flush();
}

// 질문 목록에서 질문을 골라 빈 답 쓰기 화면으로 간다.
async function openPrompt(user: User, target: Prompt = P1) {
  await openList(user);
  await user.click(promptCard(target));
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
  await waitFor(() => expect(composerQuestion()).toBe(target.questionEn));
  await flush();
}

// 자동 임시저장의 900ms를 진짜 시간으로 여러 번 기다리는 테스트가 있어, 테스트마다 시간 제한을 기본(5초)보다 넉넉히 둔다.
describe("[spec] AnswerLoop 초안 저장·복구(지금 동작 기록)", { timeout: 20000 }, () => {
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
      Promise.resolve({ year, month, streakDays: 0, days: [] })
    );
    api.getSavedExpressions.mockResolvedValue([]);
    api.getPrompts.mockResolvedValue(ALL_PROMPTS);
    api.getFeaturedDailyPrompt.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.getDailyPrompts.mockImplementation((difficulty: string) =>
      Promise.resolve(difficulty === "A" ? DAILY_A : DAILY_I)
    );
    api.getPromptHints.mockResolvedValue([]);
    api.getWritingDraft.mockImplementation((promptId: string, draftType: string) =>
      Promise.resolve(drafts.get(`${promptId}:${draftType}`) ?? null)
    );
    api.saveWritingDraft.mockImplementation((promptId: string, request: object) =>
      Promise.resolve({ ...request, promptId, selectedPromptId: promptId, updatedAt: SAVED_AT })
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
    api.completeFeedbackSession.mockImplementation((sessionId: string) =>
      Promise.resolve({ sessionId, status: "COMPLETED" })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    document.body.style.overflow = "";
  });

  // ---------------------------------------------------------------- 자동 임시저장

  it("[spec] 자동 임시저장(로그인, 답 쓰기): 마지막으로 쓴 뒤 900ms가 지나야 저장하고, 900ms 안에 다시 쓰면 앞 저장은 하지 않는다. 서버에 그 질문의 ANSWER 초안(요청 키 순서 그대로)으로 한 번만 저장하고, 이 기기(사용자 칸)의 같은 종류 초안은 지우며 '임시저장됨 · 시각'을 보인다. 글이 그대로면 다시 저장하지 않는다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    // 질문을 연 뒤에 넣어 되살리기에는 쓰이지 않는다.
    window.localStorage.setItem(localDraftKey(P1.id, "ANSWER", USER.id), "이 기기의 같은 종류 초안");
    window.localStorage.setItem(localDraftKey(P1.id, "REWRITE", USER.id), "이 기기의 다른 종류 초안");

    await user.type(answerInput(), "I");
    await wait(400);
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
    await user.type(answerInput(), " run.");
    await wait(650);
    // 첫 글자만 쓴 때의 저장은 900ms가 지났지만 하지 않았고, 마지막으로 쓴 뒤로는 아직 900ms가 안 됐다.
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });

    const [promptId, request] = api.saveWritingDraft.mock.calls[0];
    expect(promptId).toBe(P1.id);
    expect(Object.keys(request)).toEqual(SAVE_REQUEST_KEYS);
    expect(request).toEqual({
      draftType: "ANSWER",
      selectedDifficulty: "I",
      sessionId: "",
      answer: "I run.",
      rewrite: "",
      lastSubmittedAnswer: "",
      feedback: null,
      step: "answer"
    });
    await waitFor(() => expect(draftStatus()).toBe(SAVED_MESSAGE));
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", USER.id))).toBeNull();
    expect(window.localStorage.getItem(localDraftKey(P1.id, "REWRITE", USER.id))).toBe("이 기기의 다른 종류 초안");

    await wait(1000);
    expect(api.saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(api.deleteWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 자동 임시저장(로그인 안 함): 서버에 저장하지 않고 이 기기(게스트 칸)에 그 질문의 ANSWER 초안을 저장한다. 저장 내용은 질문 id·종류·저장 시각과 지금 상태(키 순서 그대로)이고 '이 기기에 임시저장됨'을 보인다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    const user = await renderHome(false);
    await openPrompt(user);

    await user.type(answerInput(), "I run.");
    await waitFor(() => expect(draftStatus()).toBe("이 기기에 임시저장됨"), { timeout: 3000 });
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", null))).toBe(
      JSON.stringify({
        promptId: P1.id,
        draftType: "ANSWER",
        updatedAt: NOW,
        selectedDifficulty: "I",
        selectedPromptId: P1.id,
        sessionId: "",
        answer: "I run.",
        rewrite: "",
        lastSubmittedAnswer: "",
        feedback: null,
        step: "answer"
      })
    );
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", USER.id))).toBeNull();
  });

  it("[spec] 자동 임시저장(로그인, 서버 저장 실패): 서버 저장을 한 번 시도한 뒤 이 기기(사용자 칸)에 같은 내용(키 순서 그대로)으로 저장하고 '서버 저장이 불안정해 이 기기에 임시저장했어요.'를 보인다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    api.saveWritingDraft.mockRejectedValue(new Error("서버 저장 실패(가짜)"));
    const user = await renderHome();
    await openPrompt(user);

    await user.type(answerInput(), "I run.");
    await waitFor(() => expect(draftStatus()).toBe("서버 저장이 불안정해 이 기기에 임시저장했어요."), { timeout: 3000 });
    expect(api.saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", USER.id))).toBe(
      JSON.stringify({
        promptId: P1.id,
        draftType: "ANSWER",
        updatedAt: NOW,
        selectedDifficulty: "I",
        selectedPromptId: P1.id,
        sessionId: "",
        answer: "I run.",
        rewrite: "",
        lastSubmittedAnswer: "",
        feedback: null,
        step: "answer"
      })
    );
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", null))).toBeNull();
  });

  it("[spec] 자동 임시저장(다시 쓰기): 다시 쓰기 화면에 들어오면 쓰지 않아도 채워진 답을 900ms 뒤 서버에 REWRITE 초안(세션 id, 첫 답, 다시 쓴 답, 제출한 답, 피드백, 단계 rewrite)으로 저장하고, 고쳐 쓰면 그 글로 다시 저장한다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    api.submitFeedback.mockResolvedValueOnce(needsRewrite(1));
    await user.type(answerInput(), FIRST_ANSWER);
    await user.click(desktopSubmit());
    await screen.findByText("1번째 시도");
    // 피드백 화면에서는 자동 저장하지 않는다.
    api.saveWritingDraft.mockClear();
    await wait(1200);
    expect(api.saveWritingDraft).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const expectedRequest = {
      draftType: "REWRITE",
      selectedDifficulty: "I",
      sessionId: "sess-draft-1",
      answer: FIRST_ANSWER,
      rewrite: FIRST_ANSWER,
      lastSubmittedAnswer: FIRST_ANSWER,
      feedback: needsRewrite(1),
      step: "rewrite"
    };
    expect(api.saveWritingDraft.mock.calls[0]).toEqual([P1.id, expectedRequest]);
    expect(Object.keys(api.saveWritingDraft.mock.calls[0][1])).toEqual(SAVE_REQUEST_KEYS);

    await user.type(rewriteInput(), " Every day.");
    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(api.saveWritingDraft.mock.calls[1]).toEqual([P1.id, { ...expectedRequest, rewrite: `${FIRST_ANSWER} Every day.` }]);
  });

  it("[spec] 자동 임시저장: 서버 저장을 기다리는 동안 다시 써서 다음 저장이 잡히면, 늦게 온 앞 저장의 응답은 문구를 바꾸지 않고 다음 저장의 응답 시각만 보인다", async () => {
    const first = deferred<WritingDraft>();
    const second = deferred<WritingDraft>();
    api.saveWritingDraft.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const user = await renderHome();
    await openPrompt(user);

    await user.type(answerInput(), "I run.");
    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await user.type(answerInput(), " Fast.");
    await act(async () => {
      first.resolve(draftFor(P1, { answer: "I run.", updatedAt: "2026-04-15T01:11:00Z" }));
    });
    await flush();
    expect(draftStatus()).toBeNull();

    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(api.saveWritingDraft.mock.calls[1][1]).toMatchObject({ answer: "I run. Fast." });
    await act(async () => {
      second.resolve(draftFor(P1, { answer: "I run. Fast.", updatedAt: SAVED_AT }));
    });
    await waitFor(() => expect(draftStatus()).toBe(SAVED_MESSAGE));
  });

  it("[spec] 글을 다 지우면(로그인): 저장된 적 없는 초안은 지우기 요청을 보내지 않는다. 저장한 뒤 다 지우면 900ms 뒤 서버 초안을 지우고 이 기기(사용자 칸)의 같은 초안도 지우며 문구가 없어진다. 지운 뒤에는 다시 모르는 초안이다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    await user.type(answerInput(), "a");
    await user.clear(answerInput());
    await wait(1300);
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
    expect(api.deleteWritingDraft).not.toHaveBeenCalled();
    expect(draftStatus()).toBeNull();

    await user.type(answerInput(), "I run.");
    await waitFor(() => expect(draftStatus()).toBe(SAVED_MESSAGE), { timeout: 3000 });
    window.localStorage.setItem(localDraftKey(P1.id, "ANSWER", USER.id), "이 기기의 같은 초안");
    await user.clear(answerInput());
    await wait(500);
    expect(api.deleteWritingDraft).not.toHaveBeenCalled();
    await waitFor(() => expect(api.deleteWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.deleteWritingDraft.mock.calls[0]).toEqual([P1.id, "ANSWER"]);
    await waitFor(() => expect(draftStatus()).toBeNull());
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", USER.id))).toBeNull();
    expect(api.saveWritingDraft).toHaveBeenCalledTimes(1);

    await user.type(answerInput(), "b");
    await user.clear(answerInput());
    await wait(1300);
    expect(api.deleteWritingDraft).toHaveBeenCalledTimes(1);
    expect(api.saveWritingDraft).toHaveBeenCalledTimes(1);
  });

  it("[spec] 글을 다 지우면(로그인 안 함): 이 기기(게스트 칸)에 저장한 초안을 지우고 문구가 없어지며, 서버 지우기 요청은 없다", async () => {
    const user = await renderHome(false);
    await openPrompt(user);

    await user.type(answerInput(), "I run.");
    await waitFor(() => expect(draftStatus()).toBe("이 기기에 임시저장됨"), { timeout: 3000 });
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", null))).not.toBeNull();

    await user.clear(answerInput());
    await waitFor(() => expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", null))).toBeNull(), {
      timeout: 3000
    });
    await waitFor(() => expect(draftStatus()).toBeNull());
    expect(api.deleteWritingDraft).not.toHaveBeenCalled();
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------- 초안 되살리기

  it("[spec] 초안 되살리기(로그인): 질문을 고르면 서버의 다시 쓰기 초안부터 찾고, 있으면 답 초안은 찾지 않고 그 초안의 단계(다시 쓰기)·답·다시 쓴 답·피드백으로 열며 '이전 초안을 복원했어요.'를 보인다. 제출한 답이 비어 있으면 첫 답(앞뒤 빈칸 지움)을 제출한 답으로 둔다(900ms 뒤 자동 저장 요청으로 확인)", async () => {
    const feedback = needsRewrite(1, "sess-draft-2", P2.id);
    drafts.set(
      `${P2.id}:REWRITE`,
      draftFor(P2, {
        draftType: "REWRITE",
        step: "rewrite",
        sessionId: "sess-draft-2",
        answer: "  I ate rice.  ",
        rewrite: "I ate rice and soup.",
        lastSubmittedAnswer: "",
        feedback
      })
    );
    drafts.set(`${P2.id}:ANSWER`, draftFor(P2, { answer: "쓰이지 않는 답 초안" }));
    const user = await renderHome();
    await openList(user);
    api.getWritingDraft.mockClear();

    await user.click(promptCard(P2));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    expect(rewriteInput().value).toBe("I ate rice and soup.");
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(draftStatus()).toBe(RESTORED);
    expect(api.getWritingDraft.mock.calls).toEqual([[P2.id, "REWRITE"]]);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([[P2.id, GUEST_ID]]);

    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.saveWritingDraft.mock.calls[0]).toEqual([
      P2.id,
      {
        draftType: "REWRITE",
        selectedDifficulty: "I",
        sessionId: "sess-draft-2",
        answer: "  I ate rice.  ",
        rewrite: "I ate rice and soup.",
        lastSubmittedAnswer: "I ate rice.",
        feedback,
        step: "rewrite"
      }
    ]);
    // 되살린 뒤 자동 저장이 끝나면 문구가 저장 시각으로 바뀐다.
    await waitFor(() => expect(draftStatus()).toBe(SAVED_MESSAGE));
  });

  it("[spec] 초안 되살리기(로그인): 서버에 다시 쓰기 초안이 없으면 답 초안을 찾아 답 쓰기 화면으로 열고, 답 초안의 빈 제출한 답은 그대로 비어 있다. 되살린 초안은 저장된 초안으로 알아서, 다 지우면 900ms 뒤 서버 초안을 지운다", async () => {
    drafts.set(`${P2.id}:ANSWER`, draftFor(P2, { answer: "I had toast." }));
    // 자동 저장 응답이 오지 않게 두어, 지우기 요청이 되살린 초안 때문인지만 본다.
    api.saveWritingDraft.mockImplementation(() => new Promise(() => undefined));
    const user = await renderHome();
    await openList(user);
    api.getWritingDraft.mockClear();

    await user.click(promptCard(P2));
    await screen.findByDisplayValue("I had toast.");
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(draftStatus()).toBe(RESTORED);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P2.id, "REWRITE"],
      [P2.id, "ANSWER"]
    ]);
    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.saveWritingDraft.mock.calls[0]).toEqual([
      P2.id,
      {
        draftType: "ANSWER",
        selectedDifficulty: "I",
        sessionId: "",
        answer: "I had toast.",
        rewrite: "",
        lastSubmittedAnswer: "",
        feedback: null,
        step: "answer"
      }
    ]);

    await user.clear(answerInput());
    await waitFor(() => expect(api.deleteWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.deleteWritingDraft.mock.calls[0]).toEqual([P2.id, "ANSWER"]);
    await waitFor(() => expect(draftStatus()).toBeNull());
  });

  it("[spec] 초안 되살리기(로그인, 서버 초안 조회 실패): 다시 쓰기 초안 조회가 실패하면 답 초안은 찾지 않고 이 기기(사용자 칸)의 초안을 쓴다. 이 기기에 다시 쓰기 초안과 답 초안이 다 있으면 다시 쓰기 초안이다", async () => {
    api.getWritingDraft.mockRejectedValue(new Error("서버 초안 조회 실패(가짜)"));
    storeLocalDraft(
      draftFor(P2, {
        draftType: "REWRITE",
        step: "rewrite",
        sessionId: "sess-local-2",
        answer: "Local answer.",
        rewrite: "Local rewrite.",
        lastSubmittedAnswer: "Local answer.",
        feedback: needsRewrite(1, "sess-local-2", P2.id)
      }),
      USER.id
    );
    storeLocalDraft(draftFor(P2, { answer: "Local answer only." }), USER.id);
    const user = await renderHome();
    await openList(user);
    api.getWritingDraft.mockClear();

    await user.click(promptCard(P2));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    expect(rewriteInput().value).toBe("Local rewrite.");
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(draftStatus()).toBe(RESTORED);
    expect(api.getWritingDraft.mock.calls).toEqual([[P2.id, "REWRITE"]]);
  });

  it("[spec] 초안 되살리기(로그인): 서버에 두 초안이 다 없으면 이 기기(사용자 칸)의 초안을 쓰고, 게스트 칸의 초안은 쓰지 않는다", async () => {
    storeLocalDraft(draftFor(P2, { answer: "User local answer." }), USER.id);
    storeLocalDraft(draftFor(P1, { answer: "Guest local answer." }), null);
    const user = await renderHome();
    // 목록을 열면 첫 질문(P1)의 초안을 자동으로 찾지만, 게스트 칸의 초안은 쓰지 않아 목록에 남는다.
    await openList(user);
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P1.id, "REWRITE"],
      [P1.id, "ANSWER"]
    ]);
    api.getWritingDraft.mockClear();

    await user.click(promptCard(P2));
    await screen.findByDisplayValue("User local answer.");
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(draftStatus()).toBe(RESTORED);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P2.id, "REWRITE"],
      [P2.id, "ANSWER"]
    ]);
  });

  it("[spec] 초안 되살리기(로그인 안 함): 서버 초안은 찾지 않고 이 기기(게스트 칸)의 초안을 쓴다. 사용자 칸의 초안은 쓰지 않는다", async () => {
    storeLocalDraft(draftFor(P2, { answer: "Guest local answer." }), null);
    storeLocalDraft(draftFor(P1, { answer: "User local answer." }), USER.id);
    const user = await renderHome(false);
    await openList(user);
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();

    await user.click(promptCard(P2));
    await screen.findByDisplayValue("Guest local answer.");
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(draftStatus()).toBe(RESTORED);
    expect(api.getWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 초안 되살리기: 초안이 없으면 빈 답 쓰기 화면으로 열고 문구가 없으며, 900ms가 지나도 저장하거나 지우지 않는다", async () => {
    const user = await renderHome();
    await openPrompt(user, P2);

    expect(answerInput().value).toBe("");
    expect(draftStatus()).toBeNull();
    await wait(1300);
    expect(draftStatus()).toBeNull();
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
    expect(api.deleteWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 초안 되살리기: 피드백 단계 초안이면 피드백 화면으로 열고 자동 저장하지 않는다. 제출한 답이 비어 있으면 답(앞뒤 빈칸 지움)을 제출한 답으로 둔다(이어 쓰기 저장 내용으로 확인)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    const feedback = needsRewrite(1, "sess-draft-3", P2.id);
    drafts.set(
      `${P2.id}:ANSWER`,
      draftFor(P2, { step: "feedback", sessionId: "sess-draft-3", answer: "  I stayed home.  ", lastSubmittedAnswer: "", feedback })
    );
    const user = await renderHome();
    await openList(user);

    await user.click(promptCard(P2));
    await screen.findByText("1번째 시도");
    expect(main().getElementsByClassName(styles.writingEditorStage)).toHaveLength(0);
    expect(readJson(window.localStorage, loopKey(USER.id))).toEqual({
      promptId: P2.id,
      difficulty: "I",
      step: "feedback",
      draftType: "ANSWER",
      sessionId: "sess-draft-3",
      updatedAt: NOW,
      promptSnapshot: { topic: P2.topic, questionEn: P2.questionEn, questionKo: P2.questionKo },
      snapshot: {
        selectedDifficulty: "I",
        selectedPromptId: P2.id,
        sessionId: "sess-draft-3",
        answer: "  I stayed home.  ",
        rewrite: "",
        lastSubmittedAnswer: "I stayed home.",
        feedback,
        step: "feedback"
      }
    });
    await wait(1300);
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 자동 되살리기: 질문 고르기 단계에서 질문 목록을 열어 첫 질문이 골라지면, 이어 쓰기 카드가 없을 때 그 질문의 초안을 찾아 있으면 바로 그 초안으로 연다(질문 고르기 기록은 없다). 난이도 화면에서는 찾지 않는다", async () => {
    drafts.set(`${P1.id}:ANSWER`, draftFor(P1, { answer: "Auto restored answer." }));
    api.saveWritingDraft.mockImplementation(() => new Promise(() => undefined));
    const user = await renderHome();
    expect(api.getWritingDraft).not.toHaveBeenCalled();

    await user.click(difficultyCard("입문"));
    await screen.findByDisplayValue("Auto restored answer.");
    expect(composerQuestion()).toBe(P1.questionEn);
    expect(draftStatus()).toBe(RESTORED);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P1.id, "REWRITE"],
      [P1.id, "ANSWER"]
    ]);
    expect(api.trackDailyPromptClick).not.toHaveBeenCalled();
  });

  it("[spec] 자동 되살리기: 이어 쓰기 카드가 있으면 목록을 열어도 첫 질문의 초안을 찾지 않는다", async () => {
    drafts.set(`${P1.id}:ANSWER`, draftFor(P1, { answer: "Auto restored answer." }));
    storeIncompleteLoop(incompleteLoopFor(P2, {}), USER.id);
    const user = await renderHome();
    expect(resumeCards()).toHaveLength(1);

    await openList(user);
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
    expect(resumeCards()).toHaveLength(1);
    expect(screen.queryByPlaceholderText(ANSWER_PLACEHOLDER)).toBeNull();
    expect(api.getWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 자동 되살리기는 난이도마다 한 번이다: 초안이 없어 목록에 남은 뒤 '새 질문'으로 첫 질문이 바뀌어도 다시 찾지 않고, 다른 난이도로 바꾸면 그 목록의 첫 질문으로 다시 찾는다", async () => {
    const user = await renderHome();
    await openList(user);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P1.id, "REWRITE"],
      [P1.id, "ANSWER"]
    ]);

    api.getDailyPrompts.mockResolvedValueOnce(DAILY_I_NEXT);
    await user.click(within(byClass(main(), styles.pickFlow)).getByRole("button", { name: "새 질문" }));
    await waitFor(() => expect(promptCard(P4)).toBeInTheDocument());
    await flush();
    await flush();
    expect(api.getWritingDraft).toHaveBeenCalledTimes(2);

    await user.click(within(byClass(main(), styles.pickFlow)).getByRole("button", { name: "난이도 선택" }));
    await openList(user, "쉬움", P3);
    await waitFor(() =>
      expect(api.getWritingDraft.mock.calls).toEqual([
        [P1.id, "REWRITE"],
        [P1.id, "ANSWER"],
        [P3.id, "REWRITE"],
        [P3.id, "ANSWER"]
      ])
    );
    expect(screen.getByRole("heading", { name: "질문 선택" })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------- 이어 쓰기

  it("[spec] 이어 쓰기 저장(답 쓰기): 글이 생기면 900ms를 기다리지 않고 바로 이 기기(사용자 칸)에 이어 쓰기 상태(키 순서 그대로, 세션이 없으면 세션 키 없음)를 저장하고, 글을 다 지우면 바로 지운다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    const user = await renderHome();
    await openPrompt(user);
    expect(window.localStorage.getItem(loopKey(USER.id))).toBeNull();

    await user.type(answerInput(), "I");
    expect(window.localStorage.getItem(loopKey(USER.id))).toBe(
      JSON.stringify({
        promptId: P1.id,
        difficulty: "I",
        step: "answer",
        draftType: "ANSWER",
        updatedAt: NOW,
        promptSnapshot: { topic: P1.topic, questionEn: P1.questionEn, questionKo: P1.questionKo },
        snapshot: {
          selectedDifficulty: "I",
          selectedPromptId: P1.id,
          sessionId: "",
          answer: "I",
          rewrite: "",
          lastSubmittedAnswer: "",
          feedback: null,
          step: "answer"
        }
      })
    );
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(loopKey(null))).toBeNull();

    await user.clear(answerInput());
    expect(window.localStorage.getItem(loopKey(USER.id))).toBeNull();
  });

  it("[spec] 이어 쓰기 저장: 피드백 단계(세션 id·피드백, 종류 ANSWER), 다시 쓰기 단계(종류 REWRITE)가 될 때마다 덮어쓰고, 루프를 마쳐 완료 화면이 되면 지운다. '다른 질문 보기'로 돌아온 질문 목록에 카드가 없다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    const promptSnapshot = { topic: P1.topic, questionEn: P1.questionEn, questionKo: P1.questionKo };
    const user = await renderHome();
    await openPrompt(user);

    api.submitFeedback.mockResolvedValueOnce(needsRewrite(1));
    await user.type(answerInput(), FIRST_ANSWER);
    await user.click(desktopSubmit());
    await screen.findByText("1번째 시도");
    const afterFirst = readJson(window.localStorage, loopKey(USER.id));
    expect(Object.keys(afterFirst ?? {})).toEqual([
      "promptId",
      "difficulty",
      "step",
      "draftType",
      "sessionId",
      "updatedAt",
      "promptSnapshot",
      "snapshot"
    ]);
    expect(afterFirst).toEqual({
      promptId: P1.id,
      difficulty: "I",
      step: "feedback",
      draftType: "ANSWER",
      sessionId: "sess-draft-1",
      updatedAt: NOW,
      promptSnapshot,
      snapshot: snapshotFor(P1, {
        sessionId: "sess-draft-1",
        answer: FIRST_ANSWER,
        lastSubmittedAnswer: FIRST_ANSWER,
        feedback: needsRewrite(1),
        step: "feedback"
      })
    });

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    expect(readJson(window.localStorage, loopKey(USER.id))).toEqual({
      promptId: P1.id,
      difficulty: "I",
      step: "rewrite",
      draftType: "REWRITE",
      sessionId: "sess-draft-1",
      updatedAt: NOW,
      promptSnapshot,
      snapshot: snapshotFor(P1, {
        sessionId: "sess-draft-1",
        answer: FIRST_ANSWER,
        rewrite: FIRST_ANSWER,
        lastSubmittedAnswer: FIRST_ANSWER,
        feedback: needsRewrite(1),
        step: "rewrite"
      })
    });

    api.submitFeedback.mockResolvedValueOnce(ready(2));
    await user.clear(rewriteInput());
    await user.type(rewriteInput(), SECOND_ANSWER);
    await user.click(rewriteSubmit());
    await screen.findByText("2번째 시도");
    expect(readJson(window.localStorage, loopKey(USER.id))).toEqual({
      promptId: P1.id,
      difficulty: "I",
      step: "feedback",
      draftType: "ANSWER",
      sessionId: "sess-draft-1",
      updatedAt: NOW,
      promptSnapshot,
      snapshot: snapshotFor(P1, {
        sessionId: "sess-draft-1",
        answer: FIRST_ANSWER,
        rewrite: SECOND_ANSWER,
        lastSubmittedAnswer: SECOND_ANSWER,
        feedback: ready(2),
        step: "feedback"
      })
    });

    await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
    await screen.findByRole("heading", { name: "루프를 완주했어요!" });
    expect(window.localStorage.getItem(loopKey(USER.id))).toBeNull();

    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    await flush();
    expect(resumeCards()).toHaveLength(0);
    expect(window.localStorage.getItem(loopKey(USER.id))).toBeNull();
  });

  it("[spec] 이어 쓰기 카드: 답을 쓰다 '질문 다시 고르기'로 돌아가면 질문 목록에 그 질문의 카드가 보이고, 새로 연 화면에도 보인다. '이어서 쓰기'를 누르면 서버 초안부터 찾고, 없으면 저장된 화면 상태로 되살려 '이어서 쓰던 흐름을 불러왔어요.'를 보인다", async () => {
    let user = await renderHome();
    await openPrompt(user, P2);
    await user.type(answerInput(), "I had eggs.");
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    expect(resumeCardTitle()).toBe("작성하던 초안이 남아 있어요");
    expect(within(resumeCards()[0]).getByText(P2.questionEn)).toBeInTheDocument();

    user = await remount();
    expect(resumeCardTitle()).toBe("작성하던 초안이 남아 있어요");
    expect(within(resumeCards()[0]).getByText(P2.questionEn)).toBeInTheDocument();
    api.getWritingDraft.mockClear();

    await user.click(screen.getByRole("button", { name: /이어서 쓰기/ }));
    await screen.findByDisplayValue("I had eggs.");
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(draftStatus()).toBe(RESUMED);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P2.id, "REWRITE"],
      [P2.id, "ANSWER"]
    ]);
  });

  it("[spec] 이어 쓰기(다시 쓰기 단계, 로그인 안 함): 게스트 칸의 이어 쓰기 카드가 보이고, 누르면 서버는 찾지 않고 이 기기(게스트 칸)의 다시 쓰기 초안을 저장된 화면 상태보다 먼저 써서 다시 쓰기 화면을 열고 '이어서 쓰던 흐름을 불러왔어요.'를 보인다", async () => {
    storeIncompleteLoop(
      incompleteLoopFor(P2, {
        step: "rewrite",
        draftType: "REWRITE",
        snapshot: snapshotFor(P2, { step: "rewrite", answer: "Snapshot answer.", rewrite: "Snapshot rewrite." })
      }),
      null
    );
    storeLocalDraft(
      draftFor(P2, {
        draftType: "REWRITE",
        step: "rewrite",
        answer: "Local answer.",
        rewrite: "Local rewrite.",
        lastSubmittedAnswer: "Local answer."
      }),
      null
    );
    const user = await renderHome(false);
    expect(resumeCardTitle()).toBe("다시쓰기 초안이 남아 있어요");

    await user.click(screen.getByRole("button", { name: /다시 쓰러 가기/ }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    expect(rewriteInput().value).toBe("Local rewrite.");
    expect(composerQuestion()).toBe(P2.questionEn);
    expect(draftStatus()).toBe(RESUMED);
    expect(api.getWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 이어 쓰기 상태는 글이 빈 채 같은 단계가 되면 지운다: 답 쓰기 단계로 저장된 질문을 목록에서 골라 빈 답 쓰기 화면이 되면 지워지고(돌아가면 카드가 없고 고른 질문의 초안을 한 번 자동으로 찾는다), 다시 쓰기 단계로 저장된 것은 빈 답 쓰기 화면이 되어도 남는다", async () => {
    storeIncompleteLoop(incompleteLoopFor(P2, { step: "answer" }), USER.id);
    let user = await renderHome();
    expect(resumeCardTitle()).toBe("작성하던 초안이 남아 있어요");
    await openList(user);
    await user.click(promptCard(P2));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    expect(window.localStorage.getItem(loopKey(USER.id))).toBeNull();
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    await flush();
    await flush();
    expect(resumeCards()).toHaveLength(0);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P2.id, "REWRITE"],
      [P2.id, "ANSWER"],
      [P2.id, "REWRITE"],
      [P2.id, "ANSWER"]
    ]);

    const rewriteLoop = incompleteLoopFor(P2, {
      step: "rewrite",
      draftType: "REWRITE",
      snapshot: snapshotFor(P2, { step: "rewrite", rewrite: "Snapshot rewrite." })
    });
    storeIncompleteLoop(rewriteLoop, USER.id);
    user = await remount();
    expect(resumeCardTitle()).toBe("다시쓰기 초안이 남아 있어요");
    await openList(user);
    await user.click(promptCard(P2));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    expect(answerInput().value).toBe("");
    expect(window.localStorage.getItem(loopKey(USER.id))).toBe(JSON.stringify(rewriteLoop));
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    expect(resumeCardTitle()).toBe("다시쓰기 초안이 남아 있어요");
  });

  // ---------------------------------------------------------------- 로그인 전 초안 넘기기

  it("[spec] 로그인 전 초안 넘기기: 게스트 제한으로 뜬 로그인 안내 창(덮개 안의 대화상자, 스냅숏)에서 '로그인하러 가기'를 누르면 지금 상태(키 순서 그대로)를 이 탭 저장소에 넘겨 둔다. 누르기 전에는 넘겨 두지 않는다", async () => {
    const user = await renderHome(false);
    await openPrompt(user);
    api.submitFeedback.mockRejectedValueOnce(new ApiError("게스트 제한(가짜)", 403, "GUEST_LIMIT_REACHED"));
    await user.type(answerInput(), FIRST_ANSWER);
    await user.click(desktopSubmit());
    const dialog = await screen.findByRole("dialog", { name: LOGIN_WALL });
    expect(window.sessionStorage.getItem(LOGIN_DRAFT_KEY)).toBeNull();
    expect(errorTexts()).toEqual(["게스트 제한(가짜)"]);
    // 덮개는 화면(main)의 첫 자식이다.
    expect(main().firstElementChild).toBe(dialog.parentElement);
    expect(normalizeForSnapshot(dialog.parentElement as HTMLElement)).toMatchInlineSnapshot(`
      <div
        class="page:loginWallOverlay"
      >
        <section
          aria-labelledby="guest-limit-title"
          aria-modal="true"
          class="page:loginWall"
          role="dialog"
        >
          <button
            aria-label="로그인 안내 닫기"
            class="page:loginWallClose"
            type="button"
          >
            ×
          </button>
          <div
            aria-hidden="true"
            class="page:loginWallMascotWrap"
          >
            <div
              class="page:loginWallMascotFrame"
            >
              <img
                alt=""
                src="/login/welcome.png"
              />
            </div>
          </div>
          <div
            class="page:loginWallCopy"
          >
            <h2
              id="guest-limit-title"
            >
              로그인하면 계속 학습할 수 있어요
            </h2>
            <p>
              지금까지 완료한 문장과 피드백, 작성 중인 흐름을 안전하게 이어서 저장해 드릴게요.
            </p>
          </div>
          <div
            class="page:loginWallBenefits"
          >
            <div
              class="page:loginWallBenefit"
            >
              <span
                aria-hidden="true"
                class="material-symbols-outlined page:loginWallBenefitIcon"
              >
                cloud_done
              </span>
              <span>
                모든 기기에서 기록 자동 이어쓰기
              </span>
            </div>
            <div
              class="page:loginWallBenefit"
            >
              <span
                aria-hidden="true"
                class="material-symbols-outlined page:loginWallBenefitIcon"
              >
                auto_graph
              </span>
              <span>
                내 답변과 성장 기록 계속 확인
              </span>
            </div>
          </div>
          <div
            class="page:loginActions"
          >
            <a
              class="page:loginWallPrimaryAction page:primaryLink"
              href="/login?returnTo=%2F"
            >
              로그인하러 가기
            </a>
            <a
              class="page:ghostLink page:loginWallSecondaryAction"
              href="/register?returnTo=%2F"
            >
              회원가입하러 가기
            </a>
            <button
              class="page:loginWallDismiss"
              type="button"
            >
              지금은 둘러보기
            </button>
          </div>
        </section>
      </div>
    `);

    const loginLink = within(dialog).getByRole("link", { name: "로그인하러 가기" });
    expect(loginLink).toHaveAttribute("href", "/login?returnTo=%2F");
    await user.click(loginLink);
    expect(window.sessionStorage.getItem(LOGIN_DRAFT_KEY)).toBe(
      JSON.stringify({
        selectedDifficulty: "I",
        selectedPromptId: P1.id,
        sessionId: "",
        answer: FIRST_ANSWER,
        rewrite: "",
        lastSubmittedAnswer: "",
        feedback: null,
        step: "answer"
      })
    );
  });

  it("[spec] 로그인 전 초안 넘기기: 게스트 다시 쓰기 1회를 마친 뒤 다시 쓰기에서 뜬 로그인 안내 창의 '회원가입하러 가기'도 지금 상태(다시 쓰기 단계, 세션, 피드백)를 넘겨 두고, 로그인한 뒤 새로 연 화면이 그 상태로 열린다. 한 번만 되살린다", async () => {
    const user = await renderHome(false);
    await openPrompt(user);
    api.submitFeedback.mockResolvedValueOnce(needsRewrite(1, "sess-guest-1"));
    await user.type(answerInput(), FIRST_ANSWER);
    await user.click(desktopSubmit());
    await screen.findByText("1번째 시도");
    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    api.submitFeedback.mockResolvedValueOnce(needsRewrite(2, "sess-guest-1"));
    await user.clear(rewriteInput());
    await user.type(rewriteInput(), SECOND_ANSWER);
    await user.click(rewriteSubmit());
    await screen.findByText("2번째 시도");
    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    await user.click(rewriteSubmit());
    const dialog = await screen.findByRole("dialog", { name: LOGIN_WALL });
    expect(api.submitFeedback).toHaveBeenCalledTimes(2);

    const registerLink = within(dialog).getByRole("link", { name: "회원가입하러 가기" });
    expect(registerLink).toHaveAttribute("href", "/register?returnTo=%2F");
    await user.click(registerLink);
    const handedOver = {
      selectedDifficulty: "I",
      selectedPromptId: P1.id,
      sessionId: "sess-guest-1",
      answer: FIRST_ANSWER,
      rewrite: SECOND_ANSWER,
      lastSubmittedAnswer: SECOND_ANSWER,
      feedback: needsRewrite(2, "sess-guest-1"),
      step: "rewrite"
    };
    expect(window.sessionStorage.getItem(LOGIN_DRAFT_KEY)).toBe(JSON.stringify(handedOver));

    // 로그인하고 첫 화면으로 돌아온다.
    cleanup();
    api.getCurrentUser.mockResolvedValue(USER);
    api.saveWritingDraft.mockClear();
    render(<AnswerLoop />);
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    expect(rewriteInput().value).toBe(SECOND_ANSWER);
    expect(composerQuestion()).toBe(P1.questionEn);
    expect(window.sessionStorage.getItem(LOGIN_DRAFT_KEY)).toBeNull();
    expect(screen.queryByRole("dialog", { name: LOGIN_WALL })).toBeNull();
    expect(draftStatus()).toBeNull();
    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.saveWritingDraft.mock.calls[0]).toEqual([
      P1.id,
      {
        draftType: "REWRITE",
        selectedDifficulty: "I",
        sessionId: "sess-guest-1",
        answer: FIRST_ANSWER,
        rewrite: SECOND_ANSWER,
        lastSubmittedAnswer: SECOND_ANSWER,
        feedback: needsRewrite(2, "sess-guest-1"),
        step: "rewrite"
      }
    ]);

    await remount();
    expect(screen.getByRole("heading", { name: "난이도 선택" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(REWRITE_PLACEHOLDER)).toBeNull();
  });

  it("[spec] 로그인한 뒤 되살리기: 넘겨 둔 상태가 있어도 로그인하지 않았으면 되살리지 않고 그대로 둔다. 로그인했으면 그 상태(단계·답·다시 쓴 답·세션 그대로, 빈 제출한 답도 그대로)로 열고 넘겨 둔 것은 지우며 '이전 초안을 복원했어요.'는 보이지 않는다", async () => {
    const handedOver = JSON.stringify(
      snapshotFor(P2, {
        step: "rewrite",
        sessionId: "sess-login-7",
        answer: "  Login answer.  ",
        rewrite: "Login rewrite.",
        lastSubmittedAnswer: "",
        feedback: null
      })
    );
    window.sessionStorage.setItem(LOGIN_DRAFT_KEY, handedOver);
    await renderHome(false);
    expect(screen.getByRole("heading", { name: "난이도 선택" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(LOGIN_DRAFT_KEY)).toBe(handedOver);

    cleanup();
    api.getCurrentUser.mockResolvedValue(USER);
    render(<AnswerLoop />);
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    expect(rewriteInput().value).toBe("Login rewrite.");
    expect(window.sessionStorage.getItem(LOGIN_DRAFT_KEY)).toBeNull();
    expect(draftStatus()).toBeNull();
    expect(errorTexts()).toEqual([]);
    await waitFor(() => expect(api.saveWritingDraft).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(api.saveWritingDraft.mock.calls[0]).toEqual([
      P2.id,
      {
        draftType: "REWRITE",
        selectedDifficulty: "I",
        sessionId: "sess-login-7",
        answer: "  Login answer.  ",
        rewrite: "Login rewrite.",
        lastSubmittedAnswer: "",
        feedback: null,
        step: "rewrite"
      }
    ]);
  });

  // ---------------------------------------------------------------- 제출, 새 질문

  it("[spec] 답을 제출하면(로그인) 그 질문의 ANSWER 초안을 서버와 이 기기(사용자 칸)에서 지운다(저장된 적이 없어도 지우기 요청을 보낸다). 다시 쓴 답을 제출하면 REWRITE 초안을 지운다", async () => {
    // 자동 저장 응답이 오지 않게 두어, 이 기기 초안이 지워진 것이 제출 때문인지만 본다.
    api.saveWritingDraft.mockImplementation(() => new Promise(() => undefined));
    const user = await renderHome();
    await openPrompt(user);
    window.localStorage.setItem(localDraftKey(P1.id, "ANSWER", USER.id), "이 기기의 답 초안");

    api.submitFeedback.mockResolvedValueOnce(needsRewrite(1));
    await user.type(answerInput(), FIRST_ANSWER);
    await user.click(desktopSubmit());
    await screen.findByText("1번째 시도");
    await waitFor(() => expect(api.deleteWritingDraft.mock.calls).toEqual([[P1.id, "ANSWER"]]));
    await waitFor(() => expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", USER.id))).toBeNull());

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    window.localStorage.setItem(localDraftKey(P1.id, "REWRITE", USER.id), "이 기기의 다시 쓰기 초안");
    api.submitFeedback.mockResolvedValueOnce(needsRewrite(2));
    await user.click(rewriteSubmit());
    await screen.findByText("2번째 시도");
    await waitFor(() =>
      expect(api.deleteWritingDraft.mock.calls).toEqual([
        [P1.id, "ANSWER"],
        [P1.id, "REWRITE"]
      ])
    );
    await waitFor(() => expect(window.localStorage.getItem(localDraftKey(P1.id, "REWRITE", USER.id))).toBeNull());
  });

  it("[spec] 답을 제출하면(로그인 안 함) 이 기기(게스트 칸)의 초안을 지우고 서버 지우기 요청은 없다. 임시저장 문구도 비워, 다시 쓰기 화면에 들어온 직후에는 문구가 없고 900ms 뒤 다시 쓰기 초안을 이 기기에 저장한다", async () => {
    const user = await renderHome(false);
    await openPrompt(user);
    await user.type(answerInput(), FIRST_ANSWER);
    await waitFor(() => expect(draftStatus()).toBe("이 기기에 임시저장됨"), { timeout: 3000 });
    expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", null))).not.toBeNull();

    api.submitFeedback.mockResolvedValueOnce(needsRewrite(1));
    await user.click(desktopSubmit());
    await screen.findByText("1번째 시도");
    await waitFor(() => expect(window.localStorage.getItem(localDraftKey(P1.id, "ANSWER", null))).toBeNull());
    expect(api.deleteWritingDraft).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    expect(draftStatus()).toBeNull();
    await waitFor(() => expect(draftStatus()).toBe("이 기기에 임시저장됨"), { timeout: 3000 });
    expect(readJson(window.localStorage, localDraftKey(P1.id, "REWRITE", null))).toMatchObject({
      promptId: P1.id,
      draftType: "REWRITE",
      rewrite: FIRST_ANSWER,
      step: "rewrite"
    });
    expect(api.saveWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 새 질문을 열면 임시저장 문구를 비운다: 한 질문에서 '임시저장됨'이 보인 뒤 질문 목록으로 돌아가 초안이 없는 다른 질문을 열면 바로 문구가 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await user.type(answerInput(), "I run.");
    await waitFor(() => expect(draftStatus()).toBe(SAVED_MESSAGE), { timeout: 3000 });

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByRole("heading", { name: "질문 선택" });
    await user.click(promptCard(P2));
    await waitFor(() => expect(composerQuestion()).toBe(P2.questionEn));
    expect(answerInput().value).toBe("");
    expect(draftStatus()).toBeNull();
  });
});
