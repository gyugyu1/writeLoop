// [spec] qa 테스트(작업 052 문장 교정 미션 정답 가리기, 기능 변경).
// 문장 교정 미션(coachMove.focusType LANGUAGE_FIX)의 피드백 화면에서 고친 표현과 고친 문장 전체를 처음에 가리고,
// 줄마다 "고친 표현 보기", 전체는 "고친 문장 전체 보기"를 눌러야 보이게 바꾸는 명세를 확인한다.
// "바뀔 동작" 테스트는 고치기 전 코드에서 실패하고, "그대로 둘 동작" 테스트는 통과해야 한다.
// 03-main-decision.md 1번(사용자 결정)대로 다시 쓰는 화면의 "이전 피드백"도 같은 방식으로 가린다. 마이페이지 기록은 그대로 다 보인다.
// AnswerLoop(웹 답 쓰기 흐름)과 MyPageClient(웹 마이페이지 기록) 화면 전체를 렌더하고 사용자처럼 조작한다.
// API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// "보인다"는 화면에 그려진 글자(hidden 속성, display:none, visibility:hidden, 닫힌 details의 본문은 뺀다)로 본다.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import { MyPageClient } from "../../components/my-page-client";
import type {
  AuthUser,
  DailyPromptRecommendation,
  Feedback,
  FeedbackCoachMove,
  FeedbackLanguageCorrection,
  HistorySession,
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
  id: 5201,
  email: "language-fix-reveal-spec@example.com",
  displayName: "정답가리기",
  admin: false
};

const GUEST_ID = "guest-language-fix-spec-0000000001";

const TODAY: TodayWritingStatus = {
  date: "2026-11-03",
  completed: false,
  completedSessions: 0,
  startedSessions: 0,
  streakDays: 2,
  totalAnswerSessions: 4,
  totalWrittenSentences: 30
};

const PROMPT_1: Prompt = {
  id: "prompt-language-fix-1",
  topic: "School",
  topicCategory: "Daily life",
  topicDetail: "Yesterday",
  difficulty: "I",
  questionEn: "What did you do yesterday?",
  questionKo: "어제 무엇을 했나요?",
  tip: ""
};

const PROMPT_2: Prompt = {
  id: "prompt-language-fix-2",
  topic: "Weekend",
  topicCategory: "Leisure",
  topicDetail: "Plans",
  difficulty: "I",
  questionEn: "What will you do this weekend?",
  questionKo: "이번 주말에 무엇을 할 건가요?",
  tip: ""
};

const DAILY: DailyPromptRecommendation = {
  recommendedDate: "2026-11-03",
  difficulty: "I",
  prompts: [PROMPT_1, PROMPT_2]
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const REWRITE_PLACEHOLDER = "피드백을 반영한 영어 답변을 다시 작성해 주세요.";

// 명세의 문구.
const REVEAL_ROW = /고친 표현 보기/;
const REVEAL_SENTENCE = /고친 문장 전체 보기/;
const NEW_INSTRUCTION = "이유를 보고 표시된 곳을 직접 고쳐 보세요. 막히면 고친 표현을 눌러 확인해요.";
// 서버가 문장 교정 미션에 보내는 안내(CanonicalFeedbackAssembler). 서버는 그대로 보낸다.
const SERVER_INSTRUCTION = "위 교정들을 반영해 문장 전체를 다시 써 보세요.";

const ORIGINAL_SENTENCE = "I go to school yesterday.";
const REVISED_SENTENCE = "I went to school yesterday.";

// 교정 6줄. 넷째 줄은 고치기 전 표현이 없고 고친 표현만 있다. 모든 줄에 고친 표현이 있다.
// 고친 표현(after)은 화면의 다른 글자(고치기 전 표현, 이유, 원래 문장)에 들어 있지 않은 글자로 골랐다.
const CORRECTIONS: (FeedbackLanguageCorrection & { after: string })[] = [
  { kind: "GRAMMAR_BLOCKING", label: "핵심 교정", before: "I go", after: "I went", reason: "어제 일이라 과거형을 써요." },
  {
    kind: "STRUCTURE",
    label: "문장 구조",
    before: "Because tired.",
    after: "Because I was tired.",
    reason: "주어와 동사가 있어야 해요."
  },
  { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: "a apple", after: "an apple", reason: "모음 앞에는 an을 써요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: null, after: "the morning", reason: "정해진 때라 the를 붙여요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 교정", before: "very like", after: "really like", reason: "like 앞에는 really를 써요." },
  {
    kind: "GRAMMAR_BLOCKING",
    label: "핵심 교정",
    before: "he go",
    after: "he goes",
    reason: "3인칭 단수 주어에는 -s를 붙여요."
  }
];

function languageFixMove(overrides: Partial<FeedbackCoachMove> = {}): FeedbackCoachMove {
  return {
    focus: "문장 6곳 바로잡기",
    focusType: "LANGUAGE_FIX",
    why: "어제 한 일은 과거형으로 써야 자연스러워요.",
    before: ORIGINAL_SENTENCE,
    after: REVISED_SENTENCE,
    instruction: SERVER_INSTRUCTION,
    languageCorrections: CORRECTIONS,
    ...overrides
  };
}

function makeFeedback(partial: Partial<Feedback>): Feedback {
  return {
    promptId: PROMPT_1.id,
    sessionId: "sess-052",
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

function needsRewrite(attemptNo: number, coachMove: FeedbackCoachMove, partial: Partial<Feedback> = {}): Feedback {
  return makeFeedback({
    attemptNo,
    revisedAnswer: REVISED_SENTENCE,
    rewriteWorkspace: { seedText: ORIGINAL_SENTENCE, placeholder: REVISED_SENTENCE, lockMeaning: true },
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "하고 싶은 말을 끝까지 썼어요.",
      coachMove
    },
    ...partial
  });
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

// 교정 한 줄의 칸: 이유 글자에서 위로 올라가며 배지 이름(과 고치기 전 표현)을 함께 담은 가장 가까운 요소.
// container를 주면 그 안(다시 쓰는 화면의 이전 피드백 등)에서만 찾는다.
function correctionRow(correction: FeedbackLanguageCorrection, container: HTMLElement = document.body) {
  let node: HTMLElement | null = within(container).getByText(correction.reason);
  while (node) {
    const text = node.textContent ?? "";
    if (text.includes(correction.label) && (!correction.before || text.includes(correction.before))) {
      return node;
    }
    node = node.parentElement;
  }
  throw new Error(`교정 줄을 찾지 못함: ${correction.reason}`);
}

function revealButtonOf(correction: FeedbackLanguageCorrection, container: HTMLElement = document.body) {
  return within(correctionRow(correction, container)).getByRole("button", { name: REVEAL_ROW });
}

// 가려진 교정 줄: 배지, 고치기 전 표현(있으면), 화살표, 이유는 보이고 고친 표현은 보이지 않으며, 그 줄에 "고친 표현 보기" 버튼이 하나 있다.
function expectRowHidden(correction: FeedbackLanguageCorrection & { after: string }, container: HTMLElement = document.body) {
  const row = correctionRow(correction, container);
  const text = visibleText(row);
  expect(text, correction.reason).toContain(correction.label);
  if (correction.before) {
    expect(text, correction.reason).toContain(correction.before);
  }
  expect(text, correction.reason).toContain("→");
  expect(text, correction.reason).toContain(correction.reason);
  expect(text, correction.reason).not.toContain(correction.after);
  expect(within(row).getAllByRole("button", { name: REVEAL_ROW }), correction.reason).toHaveLength(1);
}

function expectRowRevealed(correction: FeedbackLanguageCorrection & { after: string }, container: HTMLElement = document.body) {
  const text = visibleText(correctionRow(correction, container));
  expect(text, correction.reason).toContain(correction.after);
  expect(text, correction.reason).toContain(correction.reason);
}

// 고친 문장 전체가 가려져 있다: 고친 문장이 화면에 없고 "고친 문장 전체 보기" 버튼이 하나 있다.
// "지금" 줄(내 원래 답, 바뀔 곳 강조)은 처음부터 보인다.
function expectSentenceHidden(container: HTMLElement = document.body) {
  expect(visibleText(container)).not.toContain(REVISED_SENTENCE);
  expect(within(container).getAllByRole("button", { name: REVEAL_SENTENCE })).toHaveLength(1);
  expectOriginalRowShown(container);
}

// 글자 전체가 text인 가장 안쪽 요소. 바뀐 곳 강조로 글자가 여러 span에 나뉘어 있어도 찾는다.
function paragraphWithText(text: string, container: HTMLElement = document.body) {
  return within(container).getByText(
    (_content, element) =>
      Boolean(element) &&
      element!.textContent === text &&
      !Array.from(element!.children).some((child) => child.textContent === text)
  );
}

function highlightedPieces(paragraph: HTMLElement, highlightClass: string) {
  return Array.from(paragraph.querySelectorAll("span"))
    .filter((span) => (span.getAttribute("class") ?? "").includes(highlightClass))
    .map((span) => span.textContent);
}

// "지금" 줄: 내 원래 답이 보이고 바뀔 곳 go만 강조된다(지금 동작).
function expectOriginalRowShown(container: HTMLElement = document.body) {
  const original = paragraphWithText(ORIGINAL_SENTENCE, container);
  expect(visibleText(original)).toBe(ORIGINAL_SENTENCE);
  expect(visibleText(original.parentElement as HTMLElement)).toContain("지금");
  expect(highlightedPieces(original, "coachMoveBeforeHighlight")).toEqual(["go"]);
}

// 고친 문장(바뀐 곳 강조)이 지금처럼 보인다: "이번에 고친 문장" 줄에 고친 문장이 있고 바뀐 낱말 went만 강조된다.
function expectSentenceRevealed(container: HTMLElement = document.body) {
  const sentence = paragraphWithText(REVISED_SENTENCE, container);
  expect(visibleText(sentence)).toBe(REVISED_SENTENCE);
  expect(visibleText(sentence.parentElement as HTMLElement)).toContain("이번에 고친 문장");
  expect(highlightedPieces(sentence, "coachMoveAfterHighlight")).toEqual(["went"]);
}

async function renderHome() {
  const user = userEvent.setup();
  render(<AnswerLoop />);
  await waitFor(() => expect(api.getSavedExpressions).toHaveBeenCalled());
  await flush();
  return user;
}

async function openPrompt(user: User, prompt: Prompt = PROMPT_1) {
  await user.click(screen.getByRole("button", { name: /입문/ }));
  await user.click(await screen.findByText(prompt.questionEn));
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
}

async function submitFirst(user: User, next: Feedback, text = ORIGINAL_SENTENCE) {
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.type(screen.getByPlaceholderText(ANSWER_PLACEHOLDER), text);
  await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
  await screen.findByText(`${next.attemptNo}번째 시도`);
}

async function rewriteAndSubmit(user: User, next: Feedback) {
  await user.click(screen.getByRole("button", { name: "다시 써보기" }));
  await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
  await screen.findByText(`${next.attemptNo}번째 시도`);
}

// 피드백 화면에서 "다시 써보기"로 다시 쓰는 화면에 가서, "이전 피드백" 칸의 "피드백 보기"를 눌러 펼친다. 그 칸을 돌려준다.
async function openRewriteFeedbackPanel(user: User) {
  await user.click(screen.getByRole("button", { name: "다시 써보기" }));
  await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
  const panel = screen.getByText("이전 피드백").closest("section") as HTMLElement;
  await user.click(within(panel).getByRole("button", { name: "피드백 보기" }));
  return panel;
}

describe("[spec] 문장 교정 미션 정답 가리기(웹 피드백 화면)", () => {
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("writeloop_guest_id", GUEST_ID);
    window.history.replaceState({}, "", "/");
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
    api.getPrompts.mockResolvedValue([PROMPT_1, PROMPT_2]);
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
      promptId: PROMPT_1.id,
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

  // ---------- 바뀔 동작 ----------

  it("[spec] 바뀔 동작: 처음에는 교정 줄의 배지·고치기 전 표현·화살표·이유만 보이고 고친 표현은 가려지며, 보이는 네 줄마다 '고친 표현 보기' 버튼(접근성 역할 button, 줄마다 다른 이름)이 하나씩 있다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));

    CORRECTIONS.slice(0, 4).forEach((correction) => expectRowHidden(correction));
    // 처음 네 줄만 보이는 지금 동작은 그대로다.
    expect(pageText()).not.toContain(CORRECTIONS[4].reason);
    expect(pageText()).not.toContain(CORRECTIONS[5].reason);
    const names: string[] = [];
    const buttons = screen.getAllByRole("button", {
      name: (accessibleName) => {
        const matched = REVEAL_ROW.test(accessibleName);
        if (matched) {
          names.push(accessibleName);
        }
        return matched;
      }
    });
    expect(buttons).toHaveLength(4);
    // 어느 줄의 버튼인지 알 수 있게 접근성 이름이 줄마다 다르다.
    expect(new Set(names).size).toBe(4);
    CORRECTIONS.forEach((correction) => expect(pageText(), correction.after).not.toContain(correction.after));
  });

  it("[spec] 바뀔 동작: 한 줄의 '고친 표현 보기'를 누르면 그 줄의 고친 표현만 보이고 다른 줄은 그대로 가려져 있다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));

    await user.click(revealButtonOf(CORRECTIONS[1]));
    expectRowRevealed(CORRECTIONS[1]);
    [CORRECTIONS[0], CORRECTIONS[2], CORRECTIONS[3]].forEach((correction) => expectRowHidden(correction));
    expect(pageText()).not.toContain(REVISED_SENTENCE);

    await user.click(revealButtonOf(CORRECTIONS[3]));
    expectRowRevealed(CORRECTIONS[1]);
    expectRowRevealed(CORRECTIONS[3]);
    [CORRECTIONS[0], CORRECTIONS[2]].forEach((correction) => expectRowHidden(correction));
  });

  it("[spec] 바뀔 동작: 고치기 전 표현이 없고 고친 표현만 있는 줄도 고친 표현이 가려지고, 눌러야 보인다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));

    expectRowHidden(CORRECTIONS[3]);
    expect(pageText()).not.toContain("the morning");

    await user.click(revealButtonOf(CORRECTIONS[3]));
    expectRowRevealed(CORRECTIONS[3]);
  });

  it("[spec] 바뀔 동작: '교정 2개 더 보기'로 펼친 다섯째·여섯째 줄도 고친 표현이 가려져 있고, 그 줄의 버튼을 눌러야 보인다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));

    await user.click(screen.getByRole("button", { name: "교정 2개 더 보기" }));
    CORRECTIONS.forEach((correction) => expectRowHidden(correction));
    expect(screen.getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(6);

    await user.click(revealButtonOf(CORRECTIONS[5]));
    expectRowRevealed(CORRECTIONS[5]);
    CORRECTIONS.slice(0, 5).forEach((correction) => expectRowHidden(correction));
  });

  it("[spec] 바뀔 동작: 고친 문장 전체('이번에 고친 문장' 줄)는 처음에 가려져 있고 '고친 문장 전체 보기'를 누르면 바뀐 곳이 강조된 고친 문장이 보인다. '지금' 줄은 처음부터 바뀔 곳(go)이 강조되어 보인다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));

    expectSentenceHidden();

    await user.click(screen.getByRole("button", { name: REVEAL_SENTENCE }));
    expectSentenceRevealed();
    // 고친 문장을 펼쳐도 교정 줄의 고친 표현은 그대로 가려져 있다.
    CORRECTIONS.slice(0, 4).forEach((correction) => expectRowHidden(correction));
  });

  it("[spec] 바뀔 동작: 다시 쓸 때 안내는 서버 안내 대신 '이유를 보고 표시된 곳을 직접 고쳐 보세요. 막히면 고친 표현을 눌러 확인해요.'이다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));

    expect(screen.getByText(NEW_INSTRUCTION)).toBeInTheDocument();
    expect(pageText()).not.toContain(SERVER_INSTRUCTION);
  });

  it("[spec] 바뀔 동작: 펼쳐 본 뒤 다시 써서 다음 피드백(같은 교정)을 받으면 고친 표현과 고친 문장이 모두 다시 가려진다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));
    await user.click(revealButtonOf(CORRECTIONS[0]));
    await user.click(revealButtonOf(CORRECTIONS[2]));
    await user.click(screen.getByRole("button", { name: REVEAL_SENTENCE }));
    expectRowRevealed(CORRECTIONS[0]);
    expectSentenceRevealed();

    await rewriteAndSubmit(user, needsRewrite(2, languageFixMove()));

    CORRECTIONS.slice(0, 4).forEach((correction) => expectRowHidden(correction));
    expectSentenceHidden();
    CORRECTIONS.forEach((correction) => expect(pageText(), correction.after).not.toContain(correction.after));
  });

  it("[spec] 바뀔 동작: 펼쳐 본 뒤 루프를 마치고 다른 질문에서 문장 교정 피드백을 받으면 모두 가려진 상태로 시작한다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));
    await user.click(revealButtonOf(CORRECTIONS[0]));
    await user.click(screen.getByRole("button", { name: REVEAL_SENTENCE }));
    expectRowRevealed(CORRECTIONS[0]);

    await rewriteAndSubmit(
      user,
      makeFeedback({
        attemptNo: 2,
        loopComplete: true,
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH", strength: "과거형으로 잘 고쳤어요." }
      })
    );
    await user.click(screen.getByRole("button", { name: "오늘 루프 완료하고 도장 받기" }));
    await screen.findByRole("heading", { name: "루프를 완주했어요!" });
    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    await user.click(await screen.findByText(PROMPT_2.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await submitFirst(
      user,
      needsRewrite(1, languageFixMove(), { promptId: PROMPT_2.id, sessionId: "sess-052-b" })
    );

    CORRECTIONS.slice(0, 4).forEach((correction) => expectRowHidden(correction));
    expectSentenceHidden();
  }, 30000);

  // ---------- 바뀔 동작: 다시 쓰는 화면의 이전 피드백(03-main-decision.md 1번, 사용자 결정) ----------

  it("[spec] 바뀔 동작: 다시 쓰는 화면의 '이전 피드백'에서도 문장 교정 미션의 고친 표현과 고친 문장 전체가 가려져 있고, 그 안에서 줄의 버튼을 누르면 그 줄의 고친 표현만, '고친 문장 전체 보기'를 누르면 고친 문장이 보인다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));
    const panel = await openRewriteFeedbackPanel(user);

    CORRECTIONS.slice(0, 4).forEach((correction) => expectRowHidden(correction, panel));
    expect(within(panel).getAllByRole("button", { name: REVEAL_ROW })).toHaveLength(4);
    expectSentenceHidden(panel);
    CORRECTIONS.forEach((correction) => expect(visibleText(panel), correction.after).not.toContain(correction.after));

    await user.click(revealButtonOf(CORRECTIONS[2], panel));
    expectRowRevealed(CORRECTIONS[2], panel);
    [CORRECTIONS[0], CORRECTIONS[1], CORRECTIONS[3]].forEach((correction) => expectRowHidden(correction, panel));
    expect(visibleText(panel)).not.toContain(REVISED_SENTENCE);

    await user.click(within(panel).getByRole("button", { name: REVEAL_SENTENCE }));
    expectSentenceRevealed(panel);
    [CORRECTIONS[0], CORRECTIONS[1], CORRECTIONS[3]].forEach((correction) => expectRowHidden(correction, panel));
  });

  it("[spec] 바뀔 동작: 피드백 화면에서 '고친 표현 보기'로 연 줄은 다시 쓰는 화면의 '이전 피드백'에서도 열려 있고, 열지 않은 줄은 가려져 있다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));
    await user.click(revealButtonOf(CORRECTIONS[1]));
    expectRowRevealed(CORRECTIONS[1]);

    const panel = await openRewriteFeedbackPanel(user);

    expectRowRevealed(CORRECTIONS[1], panel);
    [CORRECTIONS[0], CORRECTIONS[2], CORRECTIONS[3]].forEach((correction) => expectRowHidden(correction, panel));
  });

  // ---------- 그대로 둘 동작 ----------

  it("[spec] 그대로 둘 동작: 문장 교정이 아닌 고치기 미션(GRAMMAR_FIX)은 '적용' 줄의 고친 문장과 교정 줄의 고친 표현이 처음부터 보이고, 보기 버튼이 없으며 서버 안내를 보인다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove({ focusType: "GRAMMAR_FIX", instruction: "고친 문장을 넣어 다시 써 보세요." })));

    expect(pageText()).toContain("적용");
    expect(pageText()).toContain(REVISED_SENTENCE);
    CORRECTIONS.slice(0, 4).forEach((correction) => expect(pageText(), correction.after).toContain(correction.after));
    expect(screen.queryByRole("button", { name: REVEAL_ROW })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REVEAL_SENTENCE })).not.toBeInTheDocument();
    expect(screen.getByText("고친 문장을 넣어 다시 써 보세요.")).toBeInTheDocument();
    expect(pageText()).not.toContain(NEW_INSTRUCTION);
  });

  it("[spec] 그대로 둘 동작: 내용 보충 미션(ADD_DETAIL)은 서버 안내, 문장 틀, 넣어볼 표현이 그대로 보이고 보기 버튼이 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(
      user,
      needsRewrite(1, {
        focus: "이유를 한 문장 더해 보세요.",
        focusType: "ADD_DETAIL",
        why: "이유가 있으면 답이 더 설득력 있어져요.",
        instruction: "왜 학교에 갔는지 한 문장 더 써 보세요.",
        skeletonEn: "I went there because ___.",
        skeletonKo: "저는 ___ 때문에 거기 갔어요.",
        suggestedPhrases: ["to meet my friends"]
      })
    );

    expect(screen.getByText("왜 학교에 갔는지 한 문장 더 써 보세요.")).toBeInTheDocument();
    expect(screen.getByText("I went there because ___.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "to meet my friends 저장" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REVEAL_ROW })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REVEAL_SENTENCE })).not.toBeInTheDocument();
    expect(pageText()).not.toContain(NEW_INSTRUCTION);
  });

  it("[spec] 그대로 둘 동작: 루프 완료 화면(문장 교정 코치 미션이 들어 있어도)에는 코치 구간과 보기 버튼이 없고, 모범답안은 지금처럼 '펼쳐보기'를 눌러서 본다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(
      user,
      makeFeedback({
        attemptNo: 1,
        loopComplete: true,
        visibleFeedback: {
          schemaVersion: 1,
          state: "READY_TO_FINISH",
          strength: "과거형으로 잘 썼어요.",
          coachMove: languageFixMove(),
          modelAnswer: "I went to school yesterday with my sister.",
          modelAnswerKo: "저는 어제 여동생과 학교에 갔어요."
        }
      })
    );

    expect(screen.queryByRole("button", { name: REVEAL_ROW })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: REVEAL_SENTENCE })).not.toBeInTheDocument();
    expect(pageText()).not.toContain(NEW_INSTRUCTION);
    expect(pageText()).not.toContain(CORRECTIONS[0].reason);
    expect(pageText()).not.toContain("I went to school yesterday with my sister.");

    await user.click(screen.getByText("펼쳐보기"));
    expect(pageText()).toContain("I went to school yesterday with my sister.");
    expect(pageText()).toContain("저는 어제 여동생과 학교에 갔어요.");
  });

  it("[spec] 그대로 둘 동작: 문장 교정 피드백에서 '다시 써보기'를 누르면 다시쓰기 칸에 내 원래 답이 들어 있고, 그대로 제출하면 그 답을 REWRITE로 보낸다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, needsRewrite(1, languageFixMove()));

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    const rewrite = (await screen.findByPlaceholderText(REWRITE_PLACEHOLDER)) as HTMLTextAreaElement;
    expect(rewrite.value).toBe(ORIGINAL_SENTENCE);

    api.submitFeedback.mockResolvedValueOnce(needsRewrite(2, languageFixMove()));
    await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
    await screen.findByText("2번째 시도");
    expect(api.submitFeedback).toHaveBeenCalledTimes(2);
    expect(api.submitFeedback.mock.calls[1][0]).toMatchObject({
      promptId: PROMPT_1.id,
      answer: ORIGINAL_SENTENCE,
      sessionId: "sess-052",
      attemptType: "REWRITE"
    });
  });
});

// ---------- 웹 마이페이지 기록(그대로 둘 동작) ----------

function historySession(): HistorySession {
  return {
    sessionId: "sess-history-052",
    promptId: PROMPT_1.id,
    topic: PROMPT_1.topic,
    difficulty: "I",
    questionEn: PROMPT_1.questionEn,
    questionKo: PROMPT_1.questionKo,
    status: "IN_PROGRESS",
    createdAt: "2026-11-03T01:00:00Z",
    updatedAt: "2026-11-03T01:00:00Z",
    attempts: [
      {
        id: 52001,
        attemptNo: 1,
        attemptType: "INITIAL",
        answerText: ORIGINAL_SENTENCE,
        feedbackSummary: "",
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          strength: "하고 싶은 말을 끝까지 썼어요.",
          coachMove: languageFixMove()
        },
        usedExpressions: [],
        createdAt: "2026-11-03T01:00:00Z"
      }
    ]
  };
}

describe("[spec] 문장 교정 미션 정답 가리기(웹 마이페이지 기록은 그대로)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/me");
    Element.prototype.scrollIntoView = vi.fn();
    Object.values(api).forEach((mock) => mock.mockReset());
    Object.values(router).forEach((mock) => mock.mockReset());
    api.getCurrentUser.mockResolvedValue(USER);
    api.getTodayWritingStatus.mockResolvedValue(TODAY);
    api.getAnswerHistory.mockResolvedValue([historySession()]);
    api.getSavedExpressions.mockResolvedValue([]);
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("[spec] 그대로 둘 동작: 기록 상세의 문장 교정 피드백은 '이번에 고친 문장'과 교정 줄의 고친 표현, 서버 안내가 처음부터 다 보이고 보기 버튼이 없다", async () => {
    const user = userEvent.setup();
    render(<MyPageClient />);

    // 가장 최근 날짜 묶음은 처음부터 펼쳐져 있다.
    await user.click(await screen.findByText(PROMPT_1.questionEn));
    const dialog = await screen.findByRole("dialog", { name: "작문 기록 상세" });

    const text = visibleText(dialog);
    expect(text).toContain("이번에 고친 문장");
    expect(text).toContain(REVISED_SENTENCE);
    CORRECTIONS.slice(0, 4).forEach((correction) => expect(text, correction.after).toContain(correction.after));
    expect(text).toContain(SERVER_INSTRUCTION);
    expect(text).not.toContain(NEW_INSTRUCTION);
    expect(within(dialog).queryByRole("button", { name: REVEAL_ROW })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: REVEAL_SENTENCE })).not.toBeInTheDocument();
  });
});
