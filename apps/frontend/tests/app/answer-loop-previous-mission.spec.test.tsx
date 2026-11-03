// [spec] qa 테스트(작업 054 지난 미션 결과 보여 주기, 새 기능, 웹 영역).
// 다시 쓴 답의 피드백 응답에 previousMissionResult가 있으면 웹 피드백 화면(미션 화면과 완료 상태) 맨 위에
// "지난 미션: <앞 미션 제목>"과 판정 한 줄을 담은 카드를 보여 주고, 필드가 없으면 그리지 않는다는 명세를 확인한다.
// 기대값은 03-qa-scenarios.md(W1~W17)와 05-main-decision.md(필드 이름, 완료 화면 범위, 그 밖의 결정)에서 가져왔다.
// AnswerLoop(웹 답 쓰기 흐름) 화면 전체를 렌더하고 사용자처럼 조작한다.
// API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image), canvas-confetti는 가짜다.
// "보인다"는 화면에 그려진 글자(hidden 속성, display:none, visibility:hidden, 닫힌 details의 본문은 뺀다)로 본다.
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import type {
  AuthUser,
  DailyPromptRecommendation,
  Feedback,
  FeedbackCoachMove,
  PreviousMissionResult,
  Prompt,
  TodayWritingStatus
} from "../../lib/types";

const api = vi.hoisted(() => ({
  checkCoachExpressionUsage: vi.fn(),
  completeFeedbackSession: vi.fn(),
  deleteAccount: vi.fn(),
  deleteSavedExpression: vi.fn(),
  deleteWritingDraft: vi.fn(),
  getAnswerHistory: vi.fn(),
  getFeaturedDailyPrompt: vi.fn(),
  getCurrentUser: vi.fn(),
  getDailyPrompts: vi.fn(),
  getMonthStatus: vi.fn(),
  getPrompts: vi.fn(),
  getPromptHints: vi.fn(),
  getSavedExpressions: vi.fn(),
  getTodayWritingStatus: vi.fn(),
  getWritingDraft: vi.fn(),
  logout: vi.fn(),
  saveExpression: vi.fn(),
  saveWritingDraft: vi.fn(),
  requestCoachHelp: vi.fn(),
  submitFeedback: vi.fn(),
  trackDailyPromptClick: vi.fn(),
  updateProfile: vi.fn()
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
  default: ({ src, alt, width, height, className }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
  }) => <img src={src} alt={alt} width={width} height={height} className={className} />
}));

vi.mock("canvas-confetti", () => ({
  default: { create: () => () => undefined }
}));

// ---------- 고정 데이터 ----------

const USER: AuthUser = {
  id: 5401,
  email: "previous-mission-spec@example.com",
  displayName: "지난미션",
  admin: false
};

const GUEST_ID = "guest-previous-mission-spec-000001";

const TODAY: TodayWritingStatus = {
  date: "2026-11-03",
  completed: false,
  completedSessions: 0,
  startedSessions: 0,
  streakDays: 2,
  totalAnswerSessions: 4,
  totalWrittenSentences: 30
};

const PROMPT: Prompt = {
  id: "prompt-previous-mission-1",
  topic: "Hobby",
  topicCategory: "Daily life",
  topicDetail: "Favorite",
  difficulty: "I",
  questionEn: "What is your favorite hobby and why?",
  questionKo: "가장 좋아하는 취미는 무엇이고 왜 좋아하나요?",
  tip: ""
};

const DAILY: DailyPromptRecommendation = {
  recommendedDate: "2026-11-03",
  difficulty: "I",
  prompts: [PROMPT]
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const REWRITE_PLACEHOLDER = "피드백을 반영한 영어 답변을 다시 작성해 주세요.";
const FIRST_ANSWER = "I like soccer.";
const SESSION_ID = "sess-054-web";

// 미션 제목(coachMove.focus)과 판정 한 줄(명세 3의 문구 그대로).
const TITLE_REASON = "이유 붙여보기";
const TITLE_EXAMPLE = "예시 하나 더하기";
const TITLE_FEELING = "느낌 한마디 더하기";
const TITLE_FIX_TWO = "문장 2곳 바로잡기";
const TITLE_FIX_ONE = "문장 1곳 바로잡기";
const TITLE_TASK_RESET = "질문에 맞게 다시 쓰기";

const MSG_SLOT_RESOLVED = "해결했어요";
const MSG_SLOT_PARTIAL = "조금 더 구체적으로 써 보세요";
const MSG_SLOT_UNRESOLVED = "아직 안 들어갔어요";
const MSG_FIX_RESOLVED_TWO = "2곳 모두 반영했어요";
const MSG_FIX_PARTIAL = "2곳 중 1곳 반영했어요";
const MSG_FIX_UNRESOLVED = "아직 반영되지 않았어요";
const MSG_TASK_RESOLVED = "질문에 맞게 썼어요";
const MSG_TASK_UNRESOLVED = "아직 질문과 거리가 있어요";

const STRENGTH_2 = "좋아하는 이유를 한 문장으로 붙였어요.";
const STRENGTH_3 = "예시가 들어가서 답이 또렷해졌어요.";
const COMPLETION_HEADLINE = "이번 답으로 마무리해도 좋아요.";
const MODEL_ANSWER = "I like soccer because it keeps me active with my friends.";

const CARD_LABEL = "지난 미션";

// 내용 보충 미션(SLOT). 새 미션 제목은 coachMove.focus로 보인다(targetSlot은 비워 제목이 focus 그대로 나오게 한다).
function slotMove(title: string, overrides: Partial<FeedbackCoachMove> = {}): FeedbackCoachMove {
  return {
    focus: title,
    focusType: "SLOT",
    why: "구체적인 내용이 있으면 답이 더 설득력 있어져요.",
    instruction: "한 문장만 더해서 다시 써 보세요.",
    skeletonEn: "For example, ___.",
    skeletonKo: "예를 들어 ___.",
    suggestedPhrases: ["for example"],
    ...overrides
  };
}

// 문장 교정 미션(LANGUAGE_FIX), 교정 2줄.
function languageFixTwoMove(): FeedbackCoachMove {
  return {
    focus: TITLE_FIX_TWO,
    focusType: "LANGUAGE_FIX",
    why: "관사와 부사를 바로잡으면 자연스러워요.",
    before: "I very like a apple.",
    after: "I really like an apple.",
    instruction: "위 교정들을 반영해 문장 전체를 다시 써 보세요.",
    languageCorrections: [
      { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: "a apple", after: "an apple", reason: "모음 앞에는 an을 써요." },
      { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: "very like", after: "really like", reason: "like 앞에는 really를 써요." }
    ]
  };
}

// W16: 다시 쓴 답의 새 문장 교정 미션(교정 1줄). 고친 표현 "I went"와 고친 문장은 화면의 다른 글자에 들어 있지 않다.
const W16_BEFORE_SENTENCE = "Yesterday i goes to the park.";
const W16_AFTER_SENTENCE = "Yesterday I went to the park.";
function languageFixOneMove(): FeedbackCoachMove {
  return {
    focus: TITLE_FIX_ONE,
    focusType: "LANGUAGE_FIX",
    why: "어제 일이라 과거형으로 써야 해요.",
    before: W16_BEFORE_SENTENCE,
    after: W16_AFTER_SENTENCE,
    instruction: "위 교정들을 반영해 문장 전체를 다시 써 보세요.",
    languageCorrections: [
      { kind: "GRAMMAR_BLOCKING", label: "핵심 교정", before: "i goes", after: "I went", reason: "어제 일은 과거형을 써요." }
    ]
  };
}

function taskResetMove(): FeedbackCoachMove {
  return {
    focus: TITLE_TASK_RESET,
    focusType: "TASK_RESET",
    why: "질문은 취미와 그 이유를 묻고 있어요.",
    instruction: "가장 좋아하는 취미와 이유를 써 보세요."
  };
}

function makeFeedback(partial: Partial<Feedback>): Feedback {
  return {
    promptId: PROMPT.id,
    sessionId: SESSION_ID,
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

function needsRewrite(
  attemptNo: number,
  coachMove: FeedbackCoachMove,
  strength: string,
  partial: Partial<Feedback> = {}
): Feedback {
  return makeFeedback({
    attemptNo,
    visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", strength, coachMove },
    ...partial
  });
}

function readyToFinish(attemptNo: number, strength: string, partial: Partial<Feedback> = {}): Feedback {
  return makeFeedback({
    attemptNo,
    loopComplete: true,
    visibleFeedback: {
      schemaVersion: 1,
      state: "READY_TO_FINISH",
      strength,
      completion: { headline: COMPLETION_HEADLINE },
      modelAnswer: MODEL_ANSWER
    },
    ...partial
  });
}

// 05-main-decision.md 2번의 필드 이름: focusType, title, targetSlot, status, appliedCount, totalCount, message.
function slotResult(
  status: string,
  message: string,
  title: string | null = TITLE_REASON
): PreviousMissionResult {
  return { focusType: "SLOT", title, targetSlot: "REASON", status, message };
}

function fixResult(status: string, appliedCount: number, message: string): PreviousMissionResult {
  return { focusType: "LANGUAGE_FIX", title: TITLE_FIX_TWO, status, appliedCount, totalCount: 2, message };
}

function taskResetResult(status: string, message: string): PreviousMissionResult {
  return { focusType: "TASK_RESET", title: TITLE_TASK_RESET, status, message };
}

// ---------- 도우미 ----------

type User = ReturnType<typeof userEvent.setup>;

async function flush() {
  await act(async () => {});
}

// 화면에 그려진 글자. hidden 속성, display:none, visibility:hidden인 요소와 닫힌 details의 summary 밖 내용은 뺀다.
function visibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }
  if (node.hidden) {
    return "";
  }
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") {
    return "";
  }
  if (node.tagName === "DETAILS" && !(node as HTMLDetailsElement).open) {
    const summary = Array.from(node.children).find((child) => child.tagName === "SUMMARY");
    return summary ? visibleText(summary) : "";
  }
  return Array.from(node.childNodes).map(visibleText).join("");
}

function pageText() {
  return visibleText(document.body);
}

function countOccurrences(text: string, part: string) {
  return text.split(part).length - 1;
}

// 카드: 제목 줄 글자와 판정 한 줄 글자를 함께 보이게 담은 가장 작은 요소. 하나여야 한다.
function missionCard(label: string, message: string) {
  const holders = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((element) => {
    const text = visibleText(element);
    return text.includes(label) && text.includes(message);
  });
  const smallest = holders.filter((element) => !holders.some((other) => other !== element && element.contains(other)));
  expect(smallest, `카드(${label} / ${message})`).toHaveLength(1);
  return smallest[0];
}

function expectCard(title: string, message: string) {
  const card = missionCard(`${CARD_LABEL}: ${title}`, message);
  const text = visibleText(card);
  expect(text).toContain(`${CARD_LABEL}: ${title}`);
  expect(text).toContain(message);
  return card;
}

function expectNoCard() {
  expect(pageText()).not.toContain(CARD_LABEL);
}

// a가 문서 순서에서 b보다 앞이다.
function expectBefore(a: HTMLElement, b: HTMLElement, what: string) {
  expect(Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING), what).toBe(true);
  expect(a.contains(b), what).toBe(false);
}

function strengthSection() {
  return screen.getByText("잘한 점").closest("section") as HTMLElement;
}

// 판정 표시 비교용: 카드 HTML에서 제목 줄과 판정 한 줄 글자를 지운 나머지(03 W10).
function cardSignature(card: HTMLElement, label: string, message: string) {
  return card.outerHTML.split(label).join("").split(message).join("");
}

// 눈에 보이는 표시만(05 결정 "세 판정 밖의 값은 미해결과 같은 표시"): 카드와 그 안 요소의 class, 제목·한 줄을 뺀 보이는 글자(기호).
function cardLook(card: HTMLElement, label: string, message: string) {
  const classes = [card, ...Array.from(card.querySelectorAll<HTMLElement>("*"))].map(
    (element) => element.getAttribute("class") ?? ""
  );
  const marks = visibleText(card).split(label).join("").split(message).join("");
  return { classes, marks };
}

function resetStorage() {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("writeloop_guest_id", GUEST_ID);
  window.history.replaceState({}, "", "/");
}

async function renderHome() {
  const user = userEvent.setup();
  render(<AnswerLoop />);
  await waitFor(() => expect(api.getSavedExpressions).toHaveBeenCalled());
  await flush();
  return user;
}

async function openPrompt(user: User) {
  await user.click(screen.getByRole("button", { name: /입문/ }));
  await user.click(await screen.findByText(PROMPT.questionEn));
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
}

async function submitFirst(user: User, next: Feedback, text = FIRST_ANSWER) {
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.type(screen.getByPlaceholderText(ANSWER_PLACEHOLDER), text);
  await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
  await screen.findByText(`${next.attemptNo}번째 시도`);
}

async function rewriteAndSubmit(user: User, next: Feedback, rewriteButton = "다시 써보기") {
  await user.click(screen.getByRole("button", { name: rewriteButton }));
  await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
  await screen.findByText(`${next.attemptNo}번째 시도`);
}

// 질문 고르기 → 첫 답 제출 → 다시 써서 제출. 다시 쓴 답의 피드백 화면에서 끝난다.
async function runRewriteFlow(first: Feedback, second: Feedback, firstText = FIRST_ANSWER, rewriteButton = "다시 써보기") {
  const user = await renderHome();
  await openPrompt(user);
  await submitFirst(user, first, firstText);
  await rewriteAndSubmit(user, second, rewriteButton);
  return user;
}

// 한 테스트 안에서 화면을 새로 렌더하기 전에 지운다.
async function restart() {
  cleanup();
  resetStorage();
  await flush();
}

const FIRST_SLOT = () => needsRewrite(1, slotMove(TITLE_REASON), "좋아하는 취미를 분명히 말했어요.");
const SECOND_SLOT = (result?: PreviousMissionResult | null) =>
  needsRewrite(2, slotMove(TITLE_EXAMPLE), STRENGTH_2, result === undefined ? {} : { previousMissionResult: result });
const FIRST_FIX = () => needsRewrite(1, languageFixTwoMove(), "하고 싶은 말을 끝까지 썼어요.");
const FIRST_TASK_RESET = () => needsRewrite(1, taskResetMove(), "영어로 끝까지 썼어요.");
const FIRST_COMPLETE = () => readyToFinish(1, "취미와 이유를 모두 잘 썼어요.");

describe("[spec] 지난 미션 결과 카드(웹 피드백 화면)", () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    vi.useRealTimers();
    resetStorage();
    document.body.style.overflow = "";
    Element.prototype.scrollIntoView = vi.fn();
    Object.values(api).forEach((mock) => mock.mockReset());
    Object.values(router).forEach((mock) => mock.mockReset());

    api.getCurrentUser.mockResolvedValue(USER);
    api.getTodayWritingStatus.mockResolvedValue(TODAY);
    api.getMonthStatus.mockImplementation((year: number, month: number) =>
      Promise.resolve({ year, month, streakDays: 0, days: [] })
    );
    api.getSavedExpressions.mockResolvedValue([]);
    api.getPrompts.mockResolvedValue([PROMPT]);
    api.getFeaturedDailyPrompt.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.getDailyPrompts.mockResolvedValue(DAILY);
    api.getPromptHints.mockResolvedValue([]);
    api.getWritingDraft.mockResolvedValue(null);
    api.saveWritingDraft.mockImplementation((promptId: string, request: object) =>
      Promise.resolve({ ...request, promptId, selectedPromptId: promptId, updatedAt: "2026-11-03T09:00:00Z" })
    );
    api.deleteWritingDraft.mockResolvedValue(undefined);
    api.trackDailyPromptClick.mockResolvedValue(undefined);
    api.requestCoachHelp.mockRejectedValue(new Error("이 테스트에서는 쓰지 않는다"));
    api.checkCoachExpressionUsage.mockResolvedValue({
      promptId: PROMPT.id,
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
    Element.prototype.scrollIntoView = originalScrollIntoView;
    window.history.replaceState({}, "", "/");
    document.body.style.overflow = "";
  });

  // ---------- 카드가 붙지 않는 경우 ----------

  it("[spec] W1: 첫 답(시도 1, previousMissionResult 없음)의 피드백 화면에는 '지난 미션' 카드가 없고, 새 미션 제목과 '1번째 시도'는 보인다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, FIRST_SLOT());

    expectNoCard();
    expect(screen.getByRole("heading", { name: TITLE_REASON })).toBeInTheDocument();
    expect(pageText()).toContain("1번째 시도");
  });

  it("[spec] W11: 앞 시도가 완료였고 다시 쓴 답의 응답에 previousMissionResult 키가 없으면 카드가 없고, '2번째 시도'·잘한 점·완료 말풍선은 보인다", async () => {
    await runRewriteFlow(FIRST_COMPLETE(), readyToFinish(2, STRENGTH_2), FIRST_ANSWER, "그래도 더 다듬어서 써보기");

    expectNoCard();
    expect(pageText()).toContain("2번째 시도");
    expect(visibleText(strengthSection())).toContain(STRENGTH_2);
    expect(pageText()).toContain(COMPLETION_HEADLINE);
  });

  it("[spec] W12: previousMissionResult가 null이면 카드가 없고 화면이 깨지지 않는다(잘한 점이 보인다)", async () => {
    await runRewriteFlow(
      FIRST_COMPLETE(),
      readyToFinish(2, STRENGTH_2, { previousMissionResult: null }),
      FIRST_ANSWER,
      "그래도 더 다듬어서 써보기"
    );

    expectNoCard();
    expect(pageText()).toContain("2번째 시도");
    expect(visibleText(strengthSection())).toContain(STRENGTH_2);
  });

  // ---------- 다시 쓴 답의 미션 화면: SLOT ----------

  it("[spec] W2: 다시 쓴 답(시도 2)의 미션 화면 맨 위에 '지난 미션: 이유 붙여보기'와 '조금 더 구체적으로 써 보세요' 카드가 잘한 점·새 미션 제목보다 앞에 있고, '2번째 시도'는 그대로 보인다", async () => {
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", MSG_SLOT_PARTIAL)));

    const card = expectCard(TITLE_REASON, MSG_SLOT_PARTIAL);
    expectBefore(card, strengthSection(), "카드가 잘한 점보다 앞");
    expectBefore(card, screen.getByRole("heading", { name: TITLE_EXAMPLE }), "카드가 새 미션 제목보다 앞");
    expect(pageText()).toContain("2번째 시도");
    expect(countOccurrences(pageText(), CARD_LABEL)).toBe(1);
  });

  it("[spec] W3: SLOT 해결이면 카드에 '지난 미션: 이유 붙여보기'와 '해결했어요'", async () => {
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("RESOLVED", MSG_SLOT_RESOLVED)));

    expectCard(TITLE_REASON, MSG_SLOT_RESOLVED);
  });

  it("[spec] W4: SLOT 미해결이면 카드에 '지난 미션: 이유 붙여보기'와 '아직 안 들어갔어요'", async () => {
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("UNRESOLVED", MSG_SLOT_UNRESOLVED)));

    expectCard(TITLE_REASON, MSG_SLOT_UNRESOLVED);
  });

  // ---------- 완료 상태의 피드백 화면, LANGUAGE_FIX ----------

  it("[spec] W5: 다시 쓴 답이 완료 상태면 그 피드백 화면 맨 위에 '지난 미션: 문장 2곳 바로잡기'와 '2곳 모두 반영했어요' 카드가 잘한 점·완료 말풍선 제목·모범답안보다 앞에 있고, 완료 버튼은 그대로 있다", async () => {
    await runRewriteFlow(
      FIRST_FIX(),
      readyToFinish(2, STRENGTH_2, { previousMissionResult: fixResult("RESOLVED", 2, MSG_FIX_RESOLVED_TWO) }),
      "I very like a apple."
    );

    const card = expectCard(TITLE_FIX_TWO, MSG_FIX_RESOLVED_TWO);
    expectBefore(card, strengthSection(), "카드가 잘한 점보다 앞");
    expectBefore(card, screen.getByText(COMPLETION_HEADLINE), "카드가 완료 말풍선 제목보다 앞");
    expectBefore(card, screen.getByText("모범답안"), "카드가 모범답안보다 앞");
    expect(screen.getByRole("button", { name: "오늘 루프 완료하고 도장 받기" })).toBeInTheDocument();
  });

  it("[spec] W6: LANGUAGE_FIX 일부면 카드에 '지난 미션: 문장 2곳 바로잡기'와 '2곳 중 1곳 반영했어요'", async () => {
    await runRewriteFlow(
      FIRST_FIX(),
      needsRewrite(2, languageFixOneMove(), STRENGTH_2, {
        previousMissionResult: fixResult("PARTIAL", 1, MSG_FIX_PARTIAL)
      }),
      "I very like a apple."
    );

    expectCard(TITLE_FIX_TWO, MSG_FIX_PARTIAL);
  });

  it("[spec] W7: LANGUAGE_FIX 미해결이면 카드에 '지난 미션: 문장 2곳 바로잡기'와 '아직 반영되지 않았어요'", async () => {
    await runRewriteFlow(
      FIRST_FIX(),
      needsRewrite(2, languageFixOneMove(), STRENGTH_2, {
        previousMissionResult: fixResult("UNRESOLVED", 0, MSG_FIX_UNRESOLVED)
      }),
      "I very like a apple."
    );

    expectCard(TITLE_FIX_TWO, MSG_FIX_UNRESOLVED);
  });

  // ---------- TASK_RESET ----------

  it("[spec] W8: TASK_RESET 해결이면 카드에 '지난 미션: 질문에 맞게 다시 쓰기'와 '질문에 맞게 썼어요'", async () => {
    await runRewriteFlow(
      FIRST_TASK_RESET(),
      SECOND_SLOT(taskResetResult("RESOLVED", MSG_TASK_RESOLVED)),
      "I went to the store."
    );

    expectCard(TITLE_TASK_RESET, MSG_TASK_RESOLVED);
  });

  it("[spec] W9: TASK_RESET 미해결이면 카드에 '지난 미션: 질문에 맞게 다시 쓰기'와 '아직 질문과 거리가 있어요'", async () => {
    await runRewriteFlow(
      FIRST_TASK_RESET(),
      needsRewrite(2, taskResetMove(), STRENGTH_2, {
        previousMissionResult: taskResetResult("UNRESOLVED", MSG_TASK_UNRESOLVED)
      }),
      "I went to the store."
    );

    expectCard(TITLE_TASK_RESET, MSG_TASK_UNRESOLVED);
  });

  // ---------- 판정 구별 ----------

  it("[spec] W10: 해결·일부·미해결 카드의 표시(제목 줄과 판정 한 줄 글자를 지운 카드 HTML)가 서로 다르고, 같은 판정(SLOT 해결과 LANGUAGE_FIX 해결)은 같다", async () => {
    const signatures: Record<string, string> = {};

    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", MSG_SLOT_PARTIAL)));
    signatures.partial = cardSignature(expectCard(TITLE_REASON, MSG_SLOT_PARTIAL), `${CARD_LABEL}: ${TITLE_REASON}`, MSG_SLOT_PARTIAL);

    await restart();
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("RESOLVED", MSG_SLOT_RESOLVED)));
    signatures.resolved = cardSignature(expectCard(TITLE_REASON, MSG_SLOT_RESOLVED), `${CARD_LABEL}: ${TITLE_REASON}`, MSG_SLOT_RESOLVED);

    await restart();
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("UNRESOLVED", MSG_SLOT_UNRESOLVED)));
    signatures.unresolved = cardSignature(
      expectCard(TITLE_REASON, MSG_SLOT_UNRESOLVED),
      `${CARD_LABEL}: ${TITLE_REASON}`,
      MSG_SLOT_UNRESOLVED
    );

    await restart();
    await runRewriteFlow(
      FIRST_FIX(),
      readyToFinish(2, STRENGTH_2, { previousMissionResult: fixResult("RESOLVED", 2, MSG_FIX_RESOLVED_TWO) }),
      "I very like a apple."
    );
    signatures.resolvedFix = cardSignature(
      expectCard(TITLE_FIX_TWO, MSG_FIX_RESOLVED_TWO),
      `${CARD_LABEL}: ${TITLE_FIX_TWO}`,
      MSG_FIX_RESOLVED_TWO
    );

    expect(new Set([signatures.partial, signatures.resolved, signatures.unresolved]).size).toBe(3);
    expect(signatures.resolvedFix).toBe(signatures.resolved);
  }, 60000);

  // ---------- 다음 시도에서 카드가 바뀌거나 사라짐 ----------

  it("[spec] W13: 카드가 보인 뒤 다시 써서 받은 시도 3 응답에 필드가 없으면 카드가 없고, 시도 2의 카드 글자가 남지 않는다", async () => {
    const user = await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", MSG_SLOT_PARTIAL)));
    expectCard(TITLE_REASON, MSG_SLOT_PARTIAL);

    await rewriteAndSubmit(user, needsRewrite(3, slotMove(TITLE_FEELING), STRENGTH_3));

    expect(pageText()).toContain("3번째 시도");
    expectNoCard();
    expect(pageText()).not.toContain(TITLE_REASON);
    expect(pageText()).not.toContain(MSG_SLOT_PARTIAL);
  });

  it("[spec] W14: 시도 3 응답의 previousMissionResult가 다르면 카드는 그 값('지난 미션: 예시 하나 더하기', '해결했어요') 하나만 보이고 시도 2의 카드 글자는 없다", async () => {
    const user = await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", MSG_SLOT_PARTIAL)));
    expectCard(TITLE_REASON, MSG_SLOT_PARTIAL);

    await rewriteAndSubmit(
      user,
      needsRewrite(3, slotMove(TITLE_FEELING), STRENGTH_3, {
        previousMissionResult: slotResult("RESOLVED", MSG_SLOT_RESOLVED, TITLE_EXAMPLE)
      })
    );

    expectCard(TITLE_EXAMPLE, MSG_SLOT_RESOLVED);
    expect(pageText()).not.toContain(`${CARD_LABEL}: ${TITLE_REASON}`);
    expect(pageText()).not.toContain(MSG_SLOT_PARTIAL);
    expect(countOccurrences(pageText(), CARD_LABEL)).toBe(1);
  });

  // ---------- 루프를 마친 뒤 ----------

  it("[spec] W15: 루프를 마친 축하 화면에는 카드가 없고(05 결정 1), '마지막 피드백 다시 보기'로 돌아간 피드백 화면에는 '지난 미션: 문장 2곳 바로잡기'와 '2곳 모두 반영했어요' 카드가 있다", async () => {
    const user = await runRewriteFlow(
      FIRST_FIX(),
      readyToFinish(2, STRENGTH_2, { previousMissionResult: fixResult("RESOLVED", 2, MSG_FIX_RESOLVED_TWO) }),
      "I very like a apple."
    );
    expectCard(TITLE_FIX_TWO, MSG_FIX_RESOLVED_TWO);

    await user.click(screen.getByRole("button", { name: "오늘 루프 완료하고 도장 받기" }));
    await screen.findByRole("heading", { name: "루프를 완주했어요!" });
    expectNoCard();

    await user.click(screen.getByRole("button", { name: "마지막 피드백 다시 보기" }));
    await screen.findByText("2번째 시도");
    expectCard(TITLE_FIX_TWO, MSG_FIX_RESOLVED_TWO);
  });

  // ---------- 그대로여야 할 동작 ----------

  it("[spec] W16: 카드가 보이는 다시 쓴 답의 새 문장 교정 미션에서도 고친 표현 'I went'와 고친 문장 전체는 처음에 가려져 있고, '1번째 교정 i goes의 고친 표현 보기'·'고친 문장 전체 보기'를 누르면 보인다", async () => {
    const user = await runRewriteFlow(
      FIRST_FIX(),
      needsRewrite(2, languageFixOneMove(), STRENGTH_2, {
        previousMissionResult: fixResult("PARTIAL", 1, MSG_FIX_PARTIAL)
      }),
      W16_BEFORE_SENTENCE
    );

    expectCard(TITLE_FIX_TWO, MSG_FIX_PARTIAL);
    expect(pageText()).not.toContain("I went");
    expect(pageText()).not.toContain(W16_AFTER_SENTENCE);
    const rowButton = screen.getByRole("button", { name: "1번째 교정 i goes의 고친 표현 보기" });
    const sentenceButton = screen.getByRole("button", { name: "고친 문장 전체 보기" });

    await user.click(rowButton);
    expect(pageText()).toContain("I went");
    expect(pageText()).not.toContain(W16_AFTER_SENTENCE);

    await user.click(sentenceButton);
    expect(pageText()).toContain(W16_AFTER_SENTENCE);
  });

  it("[spec] W17: previousMissionResult만 뺀 응답과 그대로 둔 응답의 화면은 카드를 뺀 나머지 보이는 글자(시도 번호, 잘한 점, 새 미션, 버튼)가 같다", async () => {
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT());
    expectNoCard();
    const withoutField = pageText();

    await restart();
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", MSG_SLOT_PARTIAL)));
    const card = expectCard(TITLE_REASON, MSG_SLOT_PARTIAL);
    const withField = pageText();
    const cardText = visibleText(card);

    expect(countOccurrences(withField, cardText)).toBe(1);
    expect(withField.replace(cardText, "")).toBe(withoutField);
    // 비교한 글자에 화면의 주요 부분이 들어 있다.
    [
      "2번째 시도",
      STRENGTH_2,
      TITLE_EXAMPLE,
      "구체적인 내용이 있으면 답이 더 설득력 있어져요.",
      "한 문장만 더해서 다시 써 보세요.",
      "For example, ___.",
      "for example",
      "다시 써보기"
    ].forEach((part) => expect(withoutField, part).toContain(part));
  }, 30000);

  // ---------- 05-main-decision.md 2번(메인 판단)으로 정해진 화면 동작 ----------

  it("[spec] 결정: 다시 쓰는 화면의 '이전 피드백' 패널에는 카드가 없다(이전 피드백의 잘한 점은 보인다)", async () => {
    const user = await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", MSG_SLOT_PARTIAL)));
    expectCard(TITLE_REASON, MSG_SLOT_PARTIAL);

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    const panel = screen.getByText("이전 피드백").closest("section") as HTMLElement;
    await user.click(within(panel).getByRole("button", { name: "피드백 보기" }));

    expect(visibleText(panel)).toContain(STRENGTH_2);
    expect(visibleText(panel)).not.toContain(CARD_LABEL);
    expectNoCard();
  });

  it("[spec] 결정: 제목(title)이 비었으면 카드에 '지난 미션'만(콜론과 제목 없이) 판정 한 줄과 함께 보인다", async () => {
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", MSG_SLOT_PARTIAL, "")));

    const card = missionCard(CARD_LABEL, MSG_SLOT_PARTIAL);
    const text = visibleText(card);
    expect(text).toContain(MSG_SLOT_PARTIAL);
    expect(text).not.toContain(`${CARD_LABEL}:`);
    expect(countOccurrences(pageText(), CARD_LABEL)).toBe(1);
  });

  it("[spec] 결정: 판정 한 줄(message)이 비었으면 카드를 그리지 않는다", async () => {
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("PARTIAL", "")));

    expect(pageText()).toContain("2번째 시도");
    expectNoCard();
    expect(pageText()).not.toContain(TITLE_REASON);
  });

  it("[spec] 결정: 세 판정 밖의 값은 미해결과 같은 표시(class, 표시 기호)로 그린다", async () => {
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("UNRESOLVED", MSG_SLOT_UNRESOLVED)));
    const unresolved = cardLook(
      expectCard(TITLE_REASON, MSG_SLOT_UNRESOLVED),
      `${CARD_LABEL}: ${TITLE_REASON}`,
      MSG_SLOT_UNRESOLVED
    );

    await restart();
    await runRewriteFlow(FIRST_SLOT(), SECOND_SLOT(slotResult("SOMETHING_NEW", MSG_SLOT_UNRESOLVED)));
    const unknown = cardLook(
      expectCard(TITLE_REASON, MSG_SLOT_UNRESOLVED),
      `${CARD_LABEL}: ${TITLE_REASON}`,
      MSG_SLOT_UNRESOLVED
    );

    expect(unknown).toEqual(unresolved);
  }, 30000);
});
