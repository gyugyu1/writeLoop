// [spec] qa 테스트(작업 037-12 답 쓰기·다시 쓰기·도움말·완료 화면, 리팩터링). 답 쓰기·다시 쓰기·완료 단계의 화면과 도움말 시트를
// answer-loop.tsx 밖의 컴포넌트로 옮기기 전의 "지금 동작"을 기록한다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// next/image 가짜는 받은 src·alt·width·height·sizes·quality(data-quality)·className을 그대로 <img>에 넘겨, 그림의 자리와 모양도 기록한다.
// 완료 화면의 축하 효과(canvas-confetti)는 jsdom에 canvas 그리기가 없어 부른 값만 기록하는 가짜로 둔다.
// jsdom에는 scrollIntoView가 없어(다시 쓰기 화면의 "이전 피드백 보기"가 부른다) 부른 것만 기록하는 함수로 둔다.
// 화면 바깥에서 동작만 보므로, 안쪽을 컴포넌트로 나눠도 같은 테스트가 그대로 통과해야 한다.
//
// 이미 다른 qa 테스트가 기록한 것은 다시 쓰지 않는다(웹 테스트 전체 실행에 들어 있다).
//   - AI 코치 열기 버튼·말풍선의 동작, 코치 창, 문장에 넣기: answer-loop-coach-assistant.spec.test.tsx
//   - 다시 쓰기 화면 "이전 피드백" 칸의 '피드백 보기' 버튼과 펼친 피드백 요약, 피드백 기다림 화면,
//     완료 화면 안내 문구(완료 메시지·피드백 수준 마무리 문구): answer-loop-feedback-screen.spec.test.tsx
//   - 질문 고르기 화면: answer-loop-pick-step.spec.test.tsx
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import { ApiError } from "../../lib/api";
import type {
  AuthUser,
  DailyPromptRecommendation,
  Feedback,
  HomeDraftSnapshot,
  Prompt,
  PromptHint,
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
  default: ({
    src,
    alt,
    width,
    height,
    sizes,
    quality,
    className
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    sizes?: string;
    quality?: number;
    className?: string;
  }) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      data-quality={quality}
      className={className}
    />
  )
}));

vi.mock("canvas-confetti", () => ({
  default: { create: confetti.create }
}));

const USER: AuthUser = {
  id: 5212,
  email: "writing-steps-spec@example.com",
  displayName: "답쓰기",
  admin: false
};

// 로그인한 사용자도 게스트 id를 가진다(제출, 완료, 질문 고르기 기록에 실린다). 형식 검사(guest-[a-z0-9-]{18,})를 통과하는 값.
const GUEST_ID = "guest-writing-steps-spec-0000000001";

const TODAY: TodayWritingStatus = {
  date: "2026-04-15",
  completed: false,
  completedSessions: 0,
  startedSessions: 1,
  streakDays: 3,
  totalAnswerSessions: 10,
  totalWrittenSentences: 1234
};

function prompt(
  id: string,
  difficulty: Prompt["difficulty"],
  topic: string,
  topicCategory: string,
  topicDetail: string,
  questionEn: string,
  questionKo: string
): Prompt {
  return { id, topic, topicCategory, topicDetail, difficulty, questionEn, questionKo, tip: "" };
}

// 완료 화면의 추천 질문(lib/prompt-recommendations)이 P1 기준으로 [P2, P3, P5] 셋이 되고, 화면에는 앞 둘만 나오도록 골랐다.
//   P2: 같은 주제 묶음·같은 세부 주제(가장 앞), P3·P5: 같은 주제 묶음(먼저 나온 P3가 앞), P4: 다른 주제 묶음(셋 안에 못 든다).
const P1 = prompt(
  "prompt-writing-1",
  "I",
  "Morning routine",
  "Daily life",
  "Morning",
  "What do you do first in the morning?",
  "아침에 가장 먼저 무엇을 하나요?"
);
const P2 = prompt(
  "prompt-writing-2",
  "I",
  "Breakfast",
  "Daily life",
  "Morning",
  "What did you eat for breakfast today?",
  "오늘 아침으로 무엇을 먹었나요?"
);
const P3 = prompt(
  "prompt-writing-3",
  "A",
  "Cooking",
  "Daily life",
  "Food",
  "What dish do you cook most often?",
  "가장 자주 만드는 요리는 무엇인가요?"
);
const P4 = prompt(
  "prompt-writing-4",
  "I",
  "Travel",
  "Leisure",
  "Trips",
  "Where did you go on your last trip?",
  "지난 여행에서 어디에 갔나요?"
);
const P5 = prompt(
  "prompt-writing-5",
  "A",
  "Sleep",
  "Daily life",
  "Sleep",
  "What time did you go to bed last night?",
  "어젯밤 몇 시에 잤나요?"
);

const ALL_PROMPTS = [P1, P2, P3, P4, P5];

const DAILY_I: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  prompts: [P1, P2, P4]
};

const DAILY_A: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "A",
  prompts: [P3, P5]
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const REWRITE_PLACEHOLDER = "피드백을 반영한 영어 답변을 다시 작성해 주세요.";
const FIRST_ANSWER = "I drink water.";
const EMPTY_ANSWER_ERROR = "영어 답변을 먼저 입력해 주세요.";
const FINISH_LABEL = "오늘 루프 완료하고 도장 받기";
const COMPLETE_HEADING = "루프를 완주했어요!";
const LOADING_HINTS = "지금 추천 단어와 표현을 준비하고 있어요.";
const NO_HINTS = "이 질문에는 아직 추천 단어와 표현이 없어요.";

// 서버 초안 저장 응답의 시각. 화면 문구는 toLocaleTimeString("ko-KR", 2자리 시·분)이고,
// 그 글자는 실행 환경의 시간대·ICU에 따라 달라서 같은 계산으로 기대값을 만든다.
const SAVED_AT = "2026-04-15T09:00:00Z";
const SAVED_AT_LABEL = new Date(SAVED_AT).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

// 축하 효과가 한 번 쏠 때 부르는 세 값(왼쪽, 오른쪽, 가운데).
const CONFETTI_COLORS = ["#ff9f1a", "#ffd57a", "#2f7cf6", "#173058", "#ffffff"];
const CONFETTI_LAUNCH = [
  {
    particleCount: 38,
    angle: 58,
    spread: 72,
    startVelocity: 56,
    gravity: 0.92,
    scalar: 1.18,
    origin: { x: 0.04, y: 0.92 },
    colors: CONFETTI_COLORS,
    zIndex: 0
  },
  {
    particleCount: 38,
    angle: 122,
    spread: 72,
    startVelocity: 56,
    gravity: 0.92,
    scalar: 1.18,
    origin: { x: 0.96, y: 0.92 },
    colors: CONFETTI_COLORS,
    zIndex: 0
  },
  {
    particleCount: 24,
    angle: 90,
    spread: 110,
    startVelocity: 46,
    gravity: 0.88,
    scalar: 0.96,
    origin: { x: 0.5, y: 0.78 },
    colors: CONFETTI_COLORS,
    zIndex: 0
  }
];

type User = ReturnType<typeof userEvent.setup>;

function makeFeedback(partial: Partial<Feedback>): Feedback {
  return {
    promptId: P1.id,
    sessionId: "sess-writing-1",
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
function needsRewrite(attemptNo: number, sessionId = "sess-writing-1"): Feedback {
  return makeFeedback({
    sessionId,
    attemptNo,
    visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", coachMove: { focus: "이유를 한 문장 더해 보세요." } }
  });
}

// 마칠 준비가 된 피드백. 피드백 화면의 마치기 버튼은 FINISH_LABEL이다.
function ready(sessionId: string, completionMessage: string | null = "오늘도 끝까지 썼어요."): Feedback {
  return makeFeedback({
    sessionId,
    attemptNo: 1,
    loopComplete: true,
    completionMessage,
    visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
  });
}

function hint(id: string, hintType: string, items?: Array<[string, string | null]>): PromptHint {
  return {
    id,
    promptId: P1.id,
    hintType,
    title: null,
    displayOrder: 1,
    items: items?.map(([content, meaningKo], index) => ({
      id: `${id}-item-${index}`,
      hintId: id,
      itemType: "TEXT",
      content,
      meaningKo,
      displayOrder: index + 1
    }))
  };
}

// 질문 힌트. 빈칸뿐인 스타터·단어, 앞뒤 빈칸이 있는 단어와 뜻, 빈칸뿐이거나 없는 뜻, 자리표시([...])가 든 단어와 뜻,
// 항목이 없는 힌트, 화면에 쓰지 않는 종류의 힌트를 일부러 넣었다.
const HINTS_FULL: PromptHint[] = [
  hint("h-starter", "STARTER", [
    ["   ", null],
    ["I usually [verb] right after I wake up.", null]
  ]),
  hint("h-word-1", "VOCAB_WORD", [
    ["  routine ", "  일과  "],
    ["   ", "빈 단어(화면에 없음)"],
    ["[Adjective] habit", "[adj] 습관"]
  ]),
  hint("h-word-empty", "VOCAB_WORD"),
  hint("h-word-2", "VOCAB_WORD", [
    ["stretch", null],
    ["wake up", "   "]
  ]),
  hint("h-phrase", "VOCAB_PHRASE", [
    ["[Thing] gets me going", "[thing]이 나를 움직이게 해"],
    ["[Foo] near [place]", "모르는 [Foo] 근처"]
  ]),
  hint("h-other", "STRUCTURE", [["구조 힌트(화면에 없음)", null]])
];

const SLOT = (label: string) => ["EM", `[${label}]`, ["page:expressionSlotToken"]];

// HINTS_FULL의 단어·표현 힌트 카드. content·meaning은 카드 안 글자 조각(글자, 또는 [태그, 글자, 클래스])이다.
const HINT_GROUPS_FULL = [
  {
    title: "추천 단어",
    cards: [
      { content: ["  routine "], meaning: ["일과"] },
      { content: [SLOT("형용사"), " habit"], meaning: [SLOT("형용사"), " 습관"] },
      { content: ["stretch"], meaning: null },
      { content: ["wake up"], meaning: null }
    ]
  },
  {
    title: "추천 표현",
    cards: [
      { content: [SLOT("내용"), " gets me going"], meaning: [SLOT("내용"), "이 나를 움직이게 해"] },
      { content: [SLOT("Foo"), " near ", SLOT("장소")], meaning: ["모르는 ", SLOT("Foo"), " 근처"] }
    ]
  }
];

// 자리표시 이름과 화면의 한국어 이름(지금 코드의 표 그대로).
const SLOT_LABELS: Array<[string, string]> = [
  ["action", "동사"],
  ["actions", "동사"],
  ["activity", "동사"],
  ["activities", "동사"],
  ["adj", "형용사"],
  ["adjective", "형용사"],
  ["adjectives", "형용사"],
  ["detail", "세부 내용"],
  ["details", "세부 내용"],
  ["example", "예시"],
  ["examples", "예시"],
  ["how", "방법"],
  ["issue", "문제"],
  ["issues", "문제"],
  ["item", "항목"],
  ["items", "항목"],
  ["language", "언어"],
  ["languages", "언어"],
  ["method", "방법"],
  ["methods", "방법"],
  ["noun", "명사"],
  ["nouns", "명사"],
  ["number", "횟수"],
  ["numbers", "횟수"],
  ["opinion", "의견"],
  ["opinions", "의견"],
  ["period", "기간"],
  ["periods", "기간"],
  ["place", "장소"],
  ["places", "장소"],
  ["process", "과정"],
  ["processes", "과정"],
  ["reason", "이유"],
  ["reasons", "이유"],
  ["result", "결과"],
  ["results", "결과"],
  ["thing", "내용"],
  ["things", "내용"],
  ["topic", "주제"],
  ["topics", "주제"],
  ["verb", "동사"],
  ["verbs", "동사"]
];

// 서버의 쓰기 초안. "<질문 id>:<ANSWER|REWRITE>"마다 하나. 테스트 중에 넣는다.
let drafts: Map<string, WritingDraft>;

// 테스트 중에 만든 spyOn. 테스트가 끝나면 되돌린다.
let spies: Array<{ mockRestore: () => void }>;

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
// 다른 CSS 파일의 클래스는 그대로 둔다(다른 파일로 옮겨지면 해시가 달라져 드러난다).
// 클래스 문자열 안의 빈칸 수와 순서는 화면에 영향이 없으므로 정렬해 비교한다.
const PAGE_CLASS_SUFFIX = (styles.writingEditorStage as string).slice("_writingEditorStage".length);

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

// 화면(main)의 자식마다 [태그, 클래스].
function mainChildren() {
  return Array.from(main().children).map((child) => [child.tagName, classTokens(child)]);
}

// 답 쓰기·다시 쓰기 걸음 화면.
function stage() {
  return byClass(main(), styles.writingEditorStage);
}

function stageChildren() {
  return Array.from(stage().children).map((child) => [child.tagName, classTokens(child)]);
}

function completeStage() {
  return byClass(main(), styles.completeStage);
}

function answerInput() {
  return screen.getByPlaceholderText(ANSWER_PLACEHOLDER) as HTMLTextAreaElement;
}

function rewriteInput() {
  return screen.getByPlaceholderText(REWRITE_PLACEHOLDER) as HTMLTextAreaElement;
}

function errorTexts() {
  return Array.from(main().getElementsByClassName(styles.errorText)).map((node) => node.textContent);
}

function questionBox() {
  return byClass(stage(), styles.writingComposerQuestion);
}

function questionText() {
  return byClass(stage(), styles.writingComposerQuestionText).textContent;
}

function translationText() {
  const found = stage().getElementsByClassName(styles.writingComposerTranslation);
  expect(found.length).toBeLessThanOrEqual(1);
  return found[0]?.textContent ?? null;
}

function wordCount() {
  return byClass(stage(), styles.composerWordCount).textContent;
}

// 초안 상태 배지. 단어 수 앞에 있다. 없으면 null.
function draftBadge() {
  const badges = byClass(stage(), styles.composerMetaBadges);
  const nodes = Array.from(badges.children);
  expect(classTokens(nodes[nodes.length - 1])).toEqual(["page:composerWordCount"]);
  if (nodes.length === 1) {
    return null;
  }
  expect(nodes).toHaveLength(2);
  return { text: nodes[0].textContent, title: nodes[0].getAttribute("title"), classes: classTokens(nodes[0]) };
}

function desktopSubmit() {
  return byClass(stage(), styles.composerDesktopActions).querySelector("button") as HTMLButtonElement;
}

function mobileSubmit() {
  return byClass(stage(), styles.mobileComposerPrimary) as HTMLButtonElement;
}

// 답 쓰기 화면의 제출 버튼 둘(넓은 화면, 모바일 입력 막대)마다 [글자, 비활성].
function answerSubmitButtons() {
  return [desktopSubmit(), mobileSubmit()].map((button) => [button.textContent, button.disabled]);
}

function rewriteSubmit() {
  return byClass(stage(), styles.writingEditorFooter).querySelector("button") as HTMLButtonElement;
}

function guideButton() {
  return within(stage()).getByRole("button", { name: "가이드 보기" });
}

function queryHelpDialog() {
  return screen.queryByRole("dialog", { name: "작성 가이드" });
}

function querySummary() {
  const found = stage().getElementsByClassName(styles.writingGuideSummary);
  expect(found.length).toBeLessThanOrEqual(1);
  return (found[0] as HTMLElement | undefined) ?? null;
}

// 글자 조각: 글자 노드는 글자, 요소는 [태그, 글자, 클래스].
function nodeParts(element: Element) {
  return Array.from(element.childNodes).map((node) =>
    node.nodeType === Node.TEXT_NODE
      ? node.textContent
      : [(node as Element).tagName, node.textContent, classTokens(node as Element)]
  );
}

// 힌트 묶음마다 제목과 카드(내용·뜻의 글자 조각).
function hintGroups(container: Element) {
  return Array.from(container.getElementsByClassName(styles.hintGroup)).map((group) => ({
    title: byClass(group, styles.hintGroupTitle).textContent,
    cards: Array.from(group.getElementsByClassName(styles.hintChip)).map((card) => {
      expect(card.tagName).toBe("ARTICLE");
      const meaning = card.getElementsByClassName(styles.hintChipMeaning);
      expect(meaning.length).toBeLessThanOrEqual(1);
      return {
        content: nodeParts(byClass(card, styles.hintChipContent)),
        meaning: meaning[0] ? nodeParts(meaning[0]) : null
      };
    })
  }));
}

// 가이드(요약 또는 시트)의 위쪽 안내: [제목, 설명(없으면 null), 첫 문장 스타터].
function guideOverview(container: Element) {
  const body = container.getElementsByClassName(styles.guideOverviewBody);
  expect(body.length).toBeLessThanOrEqual(1);
  return [
    byClass(container, styles.guideOverviewTitle).textContent,
    body[0]?.textContent ?? null,
    byClass(container, styles.guideStarterSurfaceText).textContent
  ];
}

function barHeightStyle() {
  return stage().style.getPropertyValue("--mobile-composer-bar-height");
}

function previousAnswerBody() {
  const card = byClass(stage(), styles.responseCard);
  return byClass(card, styles.mobileSectionBody);
}

function recommendationCards() {
  return Array.from(completeStage().getElementsByClassName(styles.completionRecommendationCard)).map((card) => [
    card.querySelector("span")?.textContent,
    card.querySelector("strong")?.textContent
  ]);
}

// 연속 학습일 칸: [굵은 글자, 총 문장 수].
function streakPanel() {
  const panel = byClass(completeStage(), styles.completionStreakPanel);
  return [panel.querySelector("strong")?.textContent, byClass(panel, styles.completionStreakMeta).textContent];
}

function completionSubcopy() {
  const heading = screen.getByRole("heading", { name: COMPLETE_HEADING });
  const next = heading.nextElementSibling as HTMLElement;
  expect(next.tagName).toBe("P");
  return next.textContent;
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

// 표현 연습 주소(/?promptId=...)로 렌더한다. 답 쓰기 화면이 바로 열리고, 그 난이도의 오늘의 질문을 부를 때까지 기다린다.
async function renderPractice(query: Record<string, string>) {
  window.history.replaceState({}, "", `/?${new URLSearchParams(query).toString()}`);
  const user = userEvent.setup();
  render(<AnswerLoop />);
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
  await waitFor(() => expect(api.getDailyPrompts).toHaveBeenCalled());
  await flush();
  await flush();
  return user;
}

// 로그인 직후 되살릴 로그인 전 초안(lib/auth-flow).
function storeLoginDraft(partial: Partial<HomeDraftSnapshot>) {
  const draft: HomeDraftSnapshot = {
    selectedDifficulty: "I",
    selectedPromptId: P1.id,
    sessionId: "",
    answer: "",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    ...partial
  };
  window.sessionStorage.setItem("writeloop_post_login_home_draft", JSON.stringify(draft));
}

// 난이도 화면에서 난이도 카드를 눌러 질문 목록을 열고, 질문을 골라 답 쓰기 화면으로 간다.
async function openPrompt(user: User, target: Prompt = P1, difficultyLabel = /입문/) {
  await user.click(screen.getByRole("button", { name: difficultyLabel }));
  await user.click(await screen.findByText(target.questionEn));
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
  await waitFor(() => expect(questionText()).toBe(target.questionEn));
  await flush();
}

async function submitFirst(user: User, next: Feedback, text = FIRST_ANSWER) {
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.type(answerInput(), text);
  await user.click(desktopSubmit());
  await screen.findByText(`${next.attemptNo}번째 시도`);
}

// 첫 답을 제출해 다시 쓰기가 필요한 피드백을 받고, '다시 써보기'로 다시 쓰기 화면에 간다.
async function goToRewrite(user: User, text = FIRST_ANSWER) {
  await submitFirst(user, needsRewrite(1), text);
  await user.click(screen.getByRole("button", { name: "다시 써보기" }));
  await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
}

// 첫 답을 제출해 마칠 준비가 된 피드백을 받고, 마치기 버튼으로 완료 화면에 간다.
async function goToComplete(user: User, next: Feedback = ready("sess-writing-9")) {
  await submitFirst(user, next);
  await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
  await screen.findByRole("heading", { name: COMPLETE_HEADING });
  await flush();
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

// 브라우저 저장소의 쓰기 초안 저장(lib/home-writing-drafts)만 실패하게 한다.
function failLocalDraftSave() {
  const originalSetItem = Storage.prototype.setItem;
  spies.push(
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith("writeloop_home_writing_draft")) {
        throw new Error("저장 공간이 부족해요(가짜)");
      }
      originalSetItem.call(this, key, value);
    })
  );
}

describe("[spec] AnswerLoop 답 쓰기·다시 쓰기·도움말·완료 화면(지금 동작 기록)", () => {
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
    confetti.fire.mockReset();
    confetti.create.mockReset();
    confetti.create.mockImplementation(() => confetti.fire);
    drafts = new Map();
    spies = [];

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
    spies.forEach((spy) => spy.mockRestore());
    vi.useRealTimers();
    Element.prototype.scrollIntoView = originalScrollIntoView;
    window.history.replaceState({}, "", "/");
    document.body.style.overflow = "";
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  // ---------------------------------------------------------------- 답 쓰기 화면

  it("[spec] 답 쓰기 화면(넓은 화면, 도움말 꺼짐)의 문구·구조·클래스·aria·style·그림 속성이 지금과 같다(스냅숏). 걸음 화면은 화면(main)의 유일한 자식이고, 입력창·단어 수 0단어·AI 코치 열기·번역·가이드·제출 버튼과 모바일 입력 막대가 있으며, 초안 배지·표현 연습 카드·가이드 요약은 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    expect(mainChildren()).toEqual([["SECTION", ["page:stage", "page:writingEditorStage"]]]);
    expect(stageChildren()).toEqual([
      ["SECTION", ["page:writingComposer"]],
      ["DIV", ["page:mobileComposerBar"]]
    ]);
    expect(answerInput().value).toBe("");
    expect(wordCount()).toBe("0단어");
    expect(draftBadge()).toBeNull();
    expect(answerSubmitButtons()).toEqual([
      ["답변 제출하기", false],
      ["답변 제출", false]
    ]);
    expect(normalizeForSnapshot(stage())).toMatchInlineSnapshot(`
      <section
        class="page:stage page:writingEditorStage"
        style="--mobile-composer-bar-height: 0px;"
      >
        <section
          class="page:writingComposer"
        >
          <div
            class="page:writingComposerQuestion"
          >
            <p
              class="page:writingComposerQuestionLabel"
            >
              질문
            </p>
            <p
              class="page:writingComposerQuestionText"
            >
              What do you do first in the morning?
            </p>
            <button
              class="page:writingComposerQuestionAction"
              type="button"
            >
              <span
                aria-hidden="true"
                class="materialSymbols"
              >
                refresh
              </span>
              질문 다시 고르기
            </button>
          </div>
          <div
            class="page:writingComposerAnswer"
          >
            <textarea
              class="page:composerTextarea page:textarea"
              placeholder="여기에 영어로 첫 답변을 작성해 주세요."
              rows="8"
            />
            <div
              class="page:composerMetaBadges"
            >
              <span
                class="page:composerWordCount"
              >
                0단어
              </span>
            </div>
            <div
              class="page:coachTriggerDock"
            >
              <div
                class="page:coachTriggerBubble"
              >
                <span>
                  표현이 막히면
                </span>
                <span>
                  AI 코치에게 물어봐요.
                </span>
              </div>
              <button
                aria-expanded="false"
                aria-haspopup="dialog"
                aria-label="AI 코치 열기"
                class="page:coachTriggerButton"
                type="button"
              >
                <img
                  alt=""
                  class="page:coachTriggerMascot"
                  data-quality="100"
                  height="60"
                  sizes="(max-width: 768px) 50px, 60px"
                  src="/coach/mascote-face.png"
                  width="60"
                />
              </button>
            </div>
          </div>
          <div
            class="page:writingComposerFooterRow"
          >
            <div
              class="page:writingComposerTools"
            >
              <button
                class="page:writingComposerToolButton"
                type="button"
              >
                <span>
                  한국어 번역 보기
                </span>
                <span
                  aria-hidden="true"
                  class="materialSymbols page:writingComposerToolGlyph"
                >
                  translate
                </span>
              </button>
              <button
                aria-expanded="false"
                class="page:writingComposerToolButton"
                type="button"
              >
                <span>
                  가이드 보기
                </span>
                <span
                  aria-hidden="true"
                  class="materialSymbols page:writingComposerToolGlyph"
                >
                  auto_awesome
                </span>
              </button>
            </div>
            <div
              class="page:composerDesktopActions"
            >
              <button
                class="page:writingEditorPrimaryButton"
                type="button"
              >
                답변 제출하기
              </button>
            </div>
          </div>
        </section>
        <div
          class="page:mobileComposerBar"
        >
          <div
            class="page:mobileComposerActions"
          >
            <button
              class="page:mobileComposerGhost"
              type="button"
            >
              질문 목록
            </button>
            <button
              class="page:mobileComposerPrimary"
              type="button"
            >
              답변 제출
            </button>
          </div>
        </div>
      </section>
    `);
  });

  it("[spec] '한국어 번역 보기'를 누르면 질문 아래에 해석(small)이 보이고 버튼이 '한국어 번역 숨기기'가 되며, 다시 누르면 접힌다. 펼친 상태는 제출 뒤 다시 쓰기 화면에도 이어진다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    expect(translationText()).toBeNull();
    await user.click(within(stage()).getByRole("button", { name: "한국어 번역 보기" }));
    expect(translationText()).toBe(P1.questionKo);
    const translation = byClass(stage(), styles.writingComposerTranslation);
    expect(translation.tagName).toBe("SMALL");
    expect(translation.previousElementSibling).toBe(byClass(stage(), styles.writingComposerQuestionText));
    expect(within(stage()).queryByRole("button", { name: "한국어 번역 보기" })).toBeNull();

    await user.click(within(stage()).getByRole("button", { name: "한국어 번역 숨기기" }));
    expect(translationText()).toBeNull();
    expect(within(stage()).getByRole("button", { name: "한국어 번역 보기" })).toBeInTheDocument();

    await user.click(within(stage()).getByRole("button", { name: "한국어 번역 보기" }));
    await goToRewrite(user);
    expect(translationText()).toBe(P1.questionKo);
    expect(within(stage()).getByRole("button", { name: "한국어 번역 숨기기" })).toBeInTheDocument();
  });

  it("[spec] 단어 수는 앞뒤 빈칸을 지우고 빈칸 묶음으로 나눈 수다. 빈칸뿐이면 0단어다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    await user.type(answerInput(), "  I   like  tea ");
    expect(answerInput().value).toBe("  I   like  tea ");
    expect(wordCount()).toBe("3단어");
    await user.clear(answerInput());
    expect(wordCount()).toBe("0단어");
    await user.type(answerInput(), "   ");
    expect(wordCount()).toBe("0단어");
  });

  it("[spec] 고른 질문을 아직 찾지 못했으면 '질문을 불러오는 중입니다.'와 해석 '질문 해석을 불러오는 중입니다.'가 보이고, 오늘의 질문을 불러오는 동안 두 제출 버튼이 글자는 그대로 비활성이다. 받으면 그 목록의 첫 질문이 되고 버튼이 풀린다", async () => {
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementation(() => daily.promise);
    const user = await renderPractice({
      promptId: "prompt-writing-unknown",
      difficulty: "I",
      prefillExpression: "make time for"
    });

    expect(api.getDailyPrompts.mock.calls).toEqual([["I", GUEST_ID]]);
    expect(questionText()).toBe("질문을 불러오는 중입니다.");
    expect(answerSubmitButtons()).toEqual([
      ["답변 제출하기", true],
      ["답변 제출", true]
    ]);
    await user.click(within(stage()).getByRole("button", { name: "한국어 번역 보기" }));
    expect(translationText()).toBe("질문 해석을 불러오는 중입니다.");

    await act(async () => {
      daily.resolve(DAILY_I);
    });
    expect(questionText()).toBe(P1.questionEn);
    expect(translationText()).toBe(P1.questionKo);
    expect(answerSubmitButtons()).toEqual([
      ["답변 제출하기", false],
      ["답변 제출", false]
    ]);
  });

  it("[spec] 제출: 답이 비었거나 빈칸뿐이면 버튼은 눌리지만 '영어 답변을 먼저 입력해 주세요.'가 걸음 화면 앞에 보이고 요청하지 않는다. 답이 있으면 앞뒤 빈칸을 지운 답으로 INITIAL 요청을 보내고, 기다리는 동안 두 버튼이 '피드백 생성 중...'으로 비활성이다. 실패하면 서버 안내를 보여 주고 버튼과 답이 그대로이며, 모바일 입력 막대의 '답변 제출'로 다시 내면 같은 제출 id로 보내 피드백 화면으로 간다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    await user.click(desktopSubmit());
    expect(errorTexts()).toEqual([EMPTY_ANSWER_ERROR]);
    expect(mainChildren()).toEqual([
      ["P", ["page:errorText"]],
      ["SECTION", ["page:stage", "page:writingEditorStage"]]
    ]);
    await user.type(answerInput(), "   ");
    await user.click(mobileSubmit());
    expect(errorTexts()).toEqual([EMPTY_ANSWER_ERROR]);
    expect(api.submitFeedback).not.toHaveBeenCalled();

    await user.clear(answerInput());
    await user.type(answerInput(), "  I drink a glass of water.  ");
    const pending = deferred<Feedback>();
    api.submitFeedback.mockImplementationOnce(() => pending.promise);
    await user.click(desktopSubmit());
    expect(errorTexts()).toEqual([]);
    expect(answerSubmitButtons()).toEqual([
      ["피드백 생성 중...", true],
      ["피드백 생성 중...", true]
    ]);
    expect(answerInput().value).toBe("  I drink a glass of water.  ");
    expect(api.submitFeedback.mock.calls).toEqual([
      [
        {
          promptId: P1.id,
          answer: "I drink a glass of water.",
          sessionId: undefined,
          attemptType: "INITIAL",
          guestId: GUEST_ID,
          submissionId: expect.any(String)
        }
      ]
    ]);

    await act(async () => {
      pending.reject(new ApiError("답변을 조금 더 길게 써 주세요.", 400));
    });
    expect(errorTexts()).toEqual(["답변을 조금 더 길게 써 주세요."]);
    expect(answerSubmitButtons()).toEqual([
      ["답변 제출하기", false],
      ["답변 제출", false]
    ]);
    expect(answerInput().value).toBe("  I drink a glass of water.  ");

    api.submitFeedback.mockResolvedValueOnce(needsRewrite(1));
    await user.click(mobileSubmit());
    expect(await screen.findByText("1번째 시도")).toBeInTheDocument();
    expect(api.submitFeedback).toHaveBeenCalledTimes(2);
    expect(api.submitFeedback.mock.calls[1]).toEqual([{ ...api.submitFeedback.mock.calls[0][0] }]);
    expect(main().getElementsByClassName(styles.writingEditorStage)).toHaveLength(0);
  });

  it("[spec] '질문 다시 고르기'와 모바일 입력 막대의 '질문 목록'은 질문 목록 화면으로 돌아간다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    await user.click(within(questionBox()).getByRole("button", { name: "질문 다시 고르기" }));
    expect(main().getElementsByClassName(styles.writingEditorStage)).toHaveLength(0);
    expect(byClass(main(), styles.promptSelectionCardGrid)).toBeInTheDocument();

    await user.click(screen.getByText(P2.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(questionText()).toBe(P2.questionEn));

    await user.click(within(stage()).getByRole("button", { name: "질문 목록" }));
    expect(main().getElementsByClassName(styles.writingEditorStage)).toHaveLength(0);
    expect(byClass(main(), styles.promptSelectionCardGrid)).toBeInTheDocument();
  });

  it("[spec] 모바일 입력 막대의 높이(올림)를 걸음 화면 style의 --mobile-composer-bar-height로 넘긴다: 답 쓰기 화면에 들어올 때, 창 크기가 바뀔 때, 단어 수나 제출 중 상태가 바뀔 때 다시 잰다. 다시 쓰기 화면에는 막대가 없고 마지막으로 잰 높이가 남는다", async () => {
    let barHeight = 57.2;
    spies.push(
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const height = this.classList.contains(styles.mobileComposerBar) ? barHeight : 0;
        return { x: 0, y: 0, width: 0, height, top: 0, left: 0, right: 0, bottom: height, toJSON: () => ({}) } as DOMRect;
      })
    );
    const user = await renderHome();
    await openPrompt(user);

    expect(barHeightStyle()).toBe("58px");
    expect(stage().getAttribute("style")).toBe("--mobile-composer-bar-height: 58px;");

    barHeight = 63.1;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(barHeightStyle()).toBe("64px");

    barHeight = 70;
    await user.type(answerInput(), "I");
    expect(barHeightStyle()).toBe("70px");

    // 단어 수가 그대로면 다시 재지 않는다.
    barHeight = 80;
    await user.type(answerInput(), "x");
    expect(answerInput().value).toBe("Ix");
    expect(barHeightStyle()).toBe("70px");

    barHeight = 90;
    const pending = deferred<Feedback>();
    api.submitFeedback.mockImplementationOnce(() => pending.promise);
    await user.click(desktopSubmit());
    expect(barHeightStyle()).toBe("90px");
    await act(async () => {
      pending.resolve(needsRewrite(1));
    });
    await user.click(await screen.findByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);

    expect(stage().getElementsByClassName(styles.mobileComposerBar)).toHaveLength(0);
    expect(barHeightStyle()).toBe("90px");
    barHeight = 100;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(barHeightStyle()).toBe("90px");
  });

  it.each([
    {
      name: "로그인, 서버 저장 성공: 서버가 준 시각의 '임시저장됨 · 시각'",
      loggedIn: true,
      serverFails: false,
      localFails: false,
      badge: { text: `임시저장됨 · ${SAVED_AT_LABEL}`, title: `임시저장됨 · ${SAVED_AT_LABEL}`, classes: ["page:composerStatusBadge"] }
    },
    {
      name: "로그인, 서버 저장 실패·기기 저장 성공: '이 기기에 임시저장'(전체 문구는 title)",
      loggedIn: true,
      serverFails: true,
      localFails: false,
      badge: {
        text: "이 기기에 임시저장",
        title: "서버 저장이 불안정해 이 기기에 임시저장했어요.",
        classes: ["page:composerStatusBadge"]
      }
    },
    {
      name: "로그인, 서버·기기 저장 모두 실패: 오류 모양의 '임시저장 실패'",
      loggedIn: true,
      serverFails: true,
      localFails: true,
      badge: { text: "임시저장 실패", title: "임시저장에 실패했어요.", classes: ["page:composerStatusBadgeError"] }
    },
    {
      name: "로그인 안 함, 기기 저장 성공: '이 기기에 임시저장'",
      loggedIn: false,
      serverFails: false,
      localFails: false,
      badge: { text: "이 기기에 임시저장", title: "이 기기에 임시저장됨", classes: ["page:composerStatusBadge"] }
    },
    {
      name: "로그인 안 함, 기기 저장 실패: 문구에 '실패'가 없어 보통 모양의 '이 기기에 임시저장'",
      loggedIn: false,
      serverFails: false,
      localFails: true,
      badge: { text: "이 기기에 임시저장", title: "이 기기에 임시저장하지 못했어요.", classes: ["page:composerStatusBadge"] }
    }
  ])("[spec] 초안 상태 배지($name). 단어 수 앞에 있고, 입력 전에는 없다", async ({ loggedIn, serverFails, localFails, badge }) => {
    if (serverFails) {
      api.saveWritingDraft.mockRejectedValue(new Error("서버 저장 실패(가짜)"));
    }
    if (localFails) {
      failLocalDraftSave();
    }
    const user = await renderHome(loggedIn);
    await openPrompt(user);

    expect(draftBadge()).toBeNull();
    await user.type(answerInput(), "I run.");
    await waitFor(() => expect(draftBadge()).toEqual(badge), { timeout: 3000 });
    expect(byClass(stage(), styles.composerMetaBadges).firstElementChild?.tagName).toBe("SPAN");
  });

  it("[spec] 초안 상태 배지: 서버 초안을 되살려 열면 '이전 초안을 복원했어요.'를 그대로 보여 준다(배지 묶음 스냅숏)", async () => {
    drafts.set(`${P2.id}:ANSWER`, {
      promptId: P2.id,
      draftType: "ANSWER",
      updatedAt: SAVED_AT,
      selectedDifficulty: "I",
      selectedPromptId: P2.id,
      sessionId: "",
      answer: "I had toast and eggs.",
      rewrite: "",
      lastSubmittedAnswer: "",
      feedback: null,
      step: "answer"
    });
    // 되살린 뒤 자동 저장이 배지를 바꾸지 않도록 서버 저장 응답을 오지 않게 둔다.
    api.saveWritingDraft.mockImplementation(() => new Promise(() => {}));
    const user = await renderHome();
    await user.click(screen.getByRole("button", { name: /입문/ }));
    await user.click(await screen.findByText(P2.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);

    expect(answerInput().value).toBe("I had toast and eggs.");
    expect(draftBadge()).toEqual({
      text: "이전 초안을 복원했어요.",
      title: "이전 초안을 복원했어요.",
      classes: ["page:composerStatusBadge"]
    });
    expect(normalizeForSnapshot(byClass(stage(), styles.composerMetaBadges))).toMatchInlineSnapshot(`
      <div
        class="page:composerMetaBadges"
      >
        <span
          class="page:composerStatusBadge"
          title="이전 초안을 복원했어요."
        >
          이전 초안을 복원했어요.
        </span>
        <span
          class="page:composerWordCount"
        >
          5단어
        </span>
      </div>
    `);
  });

  it("[spec] 표현 연습 카드(태그 연습): 연습할 표현(문자열만, 앞뒤 빈칸을 지우고 빈 것은 빼고 5개까지)이 칩으로 나오고 첫 칩만 강조된다. 카드는 입력 영역과 모바일 입력 막대 사이에 있다(스냅숏)", async () => {
    await renderPractice({
      promptId: P1.id,
      difficulty: "i",
      practiceTag: "routine",
      practiceTagLabel: "루틴",
      practiceExpressions: JSON.stringify([
        " make time for ",
        "",
        "   ",
        3,
        "stay consistent",
        "wind down",
        "get going",
        "call it a day",
        "sixth one"
      ]),
      prefillExpression: "prefill(쓰지 않음)"
    });

    expect(questionText()).toBe(P1.questionEn);
    expect(stageChildren()).toEqual([
      ["SECTION", ["page:writingComposer"]],
      ["SECTION", ["page:practiceExpressionCard"]],
      ["DIV", ["page:mobileComposerBar"]]
    ]);
    const card = byClass(stage(), styles.practiceExpressionCard);
    expect(Array.from(card.querySelectorAll("button")).map((button) => [button.textContent, classTokens(button)])).toEqual([
      ["make time for", ["page:practiceExpressionChip", "page:practiceExpressionChipPrimary"]],
      ["stay consistent", ["page:practiceExpressionChip"]],
      ["wind down", ["page:practiceExpressionChip"]],
      ["get going", ["page:practiceExpressionChip"]],
      ["call it a day", ["page:practiceExpressionChip"]]
    ]);
    expect(normalizeForSnapshot(card)).toMatchInlineSnapshot(`
      <section
        class="page:practiceExpressionCard"
      >
        <span
          class="page:practiceExpressionEyebrow"
        >
          태그 연습
        </span>
        <p>
          루틴 태그로 저장한 표현을 활용해 새 문장을 써보세요.
        </p>
        <div
          class="page:practiceExpressionScroller"
        >
          <button
            class="page:practiceExpressionChip page:practiceExpressionChipPrimary"
            type="button"
          >
            make time for
          </button>
          <button
            class="page:practiceExpressionChip"
            type="button"
          >
            stay consistent
          </button>
          <button
            class="page:practiceExpressionChip"
            type="button"
          >
            wind down
          </button>
          <button
            class="page:practiceExpressionChip"
            type="button"
          >
            get going
          </button>
          <button
            class="page:practiceExpressionChip"
            type="button"
          >
            call it a day
          </button>
        </div>
      </section>
    `);
  });

  it("[spec] 표현 연습 칩을 누르면 답 끝(끝 빈칸은 지우고)에 한 칸 띄워 붙이고, 답이 비었거나 빈칸뿐이면 그 표현만 남는다. 카드는 그대로다", async () => {
    const user = await renderPractice({
      promptId: P1.id,
      difficulty: "I",
      practiceExpressions: JSON.stringify(["make time for", "stay consistent", "wind down"])
    });
    const card = byClass(stage(), styles.practiceExpressionCard);

    await user.click(within(card).getByRole("button", { name: "make time for" }));
    expect(answerInput().value).toBe("make time for");
    await user.type(answerInput(), " exercise   ");
    await user.click(within(card).getByRole("button", { name: "stay consistent" }));
    expect(answerInput().value).toBe("make time for exercise stay consistent");
    expect(wordCount()).toBe("6단어");

    await user.clear(answerInput());
    await user.type(answerInput(), "   ");
    await user.click(within(card).getByRole("button", { name: "wind down" }));
    expect(answerInput().value).toBe("wind down");
    expect(byClass(stage(), styles.practiceExpressionCard)).toBeInTheDocument();
  });

  it("[spec] 표현 연습 카드(표현 연습): 표현 목록이 JSON이 아니면 prefillExpression(앞뒤 빈칸 지움) 하나로 '표현 연습' 카드가 나온다(스냅숏)", async () => {
    await renderPractice({
      promptId: P1.id,
      difficulty: "I",
      practiceExpressions: "not-json",
      prefillExpression: "  wind down  "
    });

    expect(normalizeForSnapshot(byClass(stage(), styles.practiceExpressionCard))).toMatchInlineSnapshot(`
      <section
        class="page:practiceExpressionCard"
      >
        <span
          class="page:practiceExpressionEyebrow"
        >
          표현 연습
        </span>
        <p>
          저장한 표현을 활용해 새 문장을 써보세요.
        </p>
        <div
          class="page:practiceExpressionScroller"
        >
          <button
            class="page:practiceExpressionChip page:practiceExpressionChipPrimary"
            type="button"
          >
            wind down
          </button>
        </div>
      </section>
    `);
  });

  it("[spec] 표현 연습 카드는 피드백이 있으면 답 쓰기 화면에 없다(표현 연습 주소로 연 뒤 피드백이 든 로그인 전 초안을 되살린 경우)", async () => {
    storeLoginDraft({ step: "answer", answer: "I wake up early.", sessionId: "sess-writing-3", feedback: needsRewrite(1, "sess-writing-3") });
    window.history.replaceState(
      {},
      "",
      `/?${new URLSearchParams({ promptId: P1.id, difficulty: "I", prefillExpression: "make time for" }).toString()}`
    );
    render(<AnswerLoop />);
    await waitFor(() => expect(answerInput().value).toBe("I wake up early."));
    await flush();
    await flush();

    expect(questionText()).toBe(P1.questionEn);
    expect(stage().getElementsByClassName(styles.practiceExpressionCard)).toHaveLength(0);
  });

  // ---------------------------------------------------------------- 가이드(넓은 화면의 요약, 모바일의 도움말 시트)

  it("[spec] 넓은 화면에서 '가이드 보기'(aria-haspopup 없음)는 걸음 화면 맨 끝의 가이드 요약을 켜고 끈다. 요약에는 난이도 안내·첫 문장 스타터·추천 단어·추천 표현이 있고(스냅숏), 대화상자·본문 스크롤 잠금은 없으며 Escape로 닫히지 않는다", async () => {
    api.getPromptHints.mockResolvedValue(HINTS_FULL);
    const user = await renderHome();
    await openPrompt(user);
    await waitFor(() => expect(api.getPromptHints).toHaveBeenCalledWith(P1.id));
    await flush();

    const guide = guideButton();
    expect(guide).not.toHaveAttribute("aria-haspopup");
    expect(guide).toHaveAttribute("aria-expanded", "false");
    expect(querySummary()).toBeNull();

    await user.click(guide);
    expect(guide).toHaveAttribute("aria-expanded", "true");
    const summary = querySummary() as HTMLElement;
    expect(stage().lastElementChild).toBe(summary);
    expect(stageChildren()).toEqual([
      ["SECTION", ["page:writingComposer"]],
      ["DIV", ["page:mobileComposerBar"]],
      ["DIV", ["page:writingGuideSummary"]]
    ]);
    expect(queryHelpDialog()).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(guideOverview(summary)).toEqual([
      "짧게라도 바로 영어로 시작해 보세요.",
      "한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각을 만드는 데 집중해 보세요.",
      "I usually [verb] right after I wake up."
    ]);
    expect(hintGroups(summary)).toEqual(HINT_GROUPS_FULL);
    expect(normalizeForSnapshot(summary)).toMatchInlineSnapshot(`
      <div
        class="page:writingGuideSummary"
      >
        <section
          class="page:guideOverviewCard"
        >
          <span
            class="page:guideOverviewLabel"
          >
            최고의 팁!
          </span>
          <strong
            class="page:guideOverviewTitle"
          >
            짧게라도 바로 영어로 시작해 보세요.
          </strong>
          <p
            class="page:guideOverviewBody"
          >
            한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각을 만드는 데 집중해 보세요.
          </p>
        </section>
        <section
          class="page:guideStarterSection"
        >
          <strong
            class="page:guideStarterSectionLabel"
          >
            첫 문장 스타터
          </strong>
          <div
            class="page:guideStarterSurface"
          >
            <span
              class="page:guideStarterSurfaceText"
            >
              I usually [verb] right after I wake up.
            </span>
          </div>
        </section>
        <section
          class="page:writingGuideHintSection"
        >
          <div
            class="page:writingGuideHintGroups"
          >
            <div
              class="page:hintGroup"
            >
              <strong
                class="page:hintGroupTitle"
              >
                추천 단어
              </strong>
              <div
                class="page:hintChipList"
              >
                <article
                  class="page:hintChip"
                >
                  <strong
                    class="page:hintChipContent"
                  >
                      routine 
                  </strong>
                  <span
                    class="page:hintChipMeaning"
                  >
                    일과
                  </span>
                </article>
                <article
                  class="page:hintChip"
                >
                  <strong
                    class="page:hintChipContent"
                  >
                    <em
                      class="page:expressionSlotToken"
                    >
                      [형용사]
                    </em>
                     habit
                  </strong>
                  <span
                    class="page:hintChipMeaning"
                  >
                    <em
                      class="page:expressionSlotToken"
                    >
                      [형용사]
                    </em>
                     습관
                  </span>
                </article>
                <article
                  class="page:hintChip"
                >
                  <strong
                    class="page:hintChipContent"
                  >
                    stretch
                  </strong>
                </article>
                <article
                  class="page:hintChip"
                >
                  <strong
                    class="page:hintChipContent"
                  >
                    wake up
                  </strong>
                </article>
              </div>
            </div>
            <div
              class="page:hintGroup"
            >
              <strong
                class="page:hintGroupTitle"
              >
                추천 표현
              </strong>
              <div
                class="page:hintChipList"
              >
                <article
                  class="page:hintChip"
                >
                  <strong
                    class="page:hintChipContent"
                  >
                    <em
                      class="page:expressionSlotToken"
                    >
                      [내용]
                    </em>
                     gets me going
                  </strong>
                  <span
                    class="page:hintChipMeaning"
                  >
                    <em
                      class="page:expressionSlotToken"
                    >
                      [내용]
                    </em>
                    이 나를 움직이게 해
                  </span>
                </article>
                <article
                  class="page:hintChip"
                >
                  <strong
                    class="page:hintChipContent"
                  >
                    <em
                      class="page:expressionSlotToken"
                    >
                      [Foo]
                    </em>
                     near 
                    <em
                      class="page:expressionSlotToken"
                    >
                      [장소]
                    </em>
                  </strong>
                  <span
                    class="page:hintChipMeaning"
                  >
                    모르는 
                    <em
                      class="page:expressionSlotToken"
                    >
                      [Foo]
                    </em>
                     근처
                  </span>
                </article>
              </div>
            </div>
          </div>
        </section>
      </div>
    `);

    await user.keyboard("{Escape}");
    expect(querySummary()).not.toBeNull();

    await user.click(guide);
    expect(guide).toHaveAttribute("aria-expanded", "false");
    expect(querySummary()).toBeNull();
  });

  it("[spec] 가이드 요약: 힌트를 불러오는 동안 '지금 추천 단어와 표현을 준비하고 있어요.', 힌트가 없으면 '이 질문에는 아직 추천 단어와 표현이 없어요.'를 보여 주고, 스타터 힌트가 없으면 난이도의 기본 스타터다", async () => {
    const hints = deferred<PromptHint[]>();
    api.getPromptHints.mockImplementation(() => hints.promise);
    const user = await renderHome();
    await openPrompt(user);
    await user.click(guideButton());

    const loading = byClass(querySummary() as HTMLElement, styles.writingGuideHintEmpty);
    expect(loading.tagName).toBe("P");
    expect(loading.textContent).toBe(LOADING_HINTS);
    expect(guideOverview(querySummary() as HTMLElement)[2]).toBe("I usually ...");

    await act(async () => {
      hints.resolve([hint("h-word-empty", "VOCAB_WORD"), hint("h-other", "STRUCTURE", [["구조 힌트", null]])]);
    });
    expect(byClass(querySummary() as HTMLElement, styles.writingGuideHintEmpty).textContent).toBe(NO_HINTS);
    expect(hintGroups(querySummary() as HTMLElement)).toEqual([]);
  });

  it("[spec] 가이드 요약: 질문의 난이도로 안내를 고른다. 쉬움 질문은 설명 줄이 없고 기본 스타터가 'I think ... because ...'이며, 표현 힌트만 있으면 '추천 표현' 묶음만 나온다", async () => {
    api.getPromptHints.mockResolvedValue([
      hint("h-phrase-only", "VOCAB_PHRASE", [["cook from scratch", "처음부터 직접 요리하다"]])
    ]);
    const user = await renderHome();
    await openPrompt(user, P3, /쉬움/);
    await flush();
    await user.click(guideButton());

    const summary = querySummary() as HTMLElement;
    expect(guideOverview(summary)).toEqual(["완벽하지 않아도 일단 쓰는 것!", null, "I think ... because ..."]);
    expect(hintGroups(summary)).toEqual([
      { title: "추천 표현", cards: [{ content: ["cook from scratch"], meaning: ["처음부터 직접 요리하다"] }] }
    ]);
  });

  it("[spec] 힌트의 자리표시([영문자])는 표의 한국어 이름(대소문자 무시)으로 바꿔 강조(em)하고, 표에 없으면 원래 글자 그대로 강조한다. 영문자가 아닌 것이 든 괄호는 글자 그대로다", async () => {
    const content = [...SLOT_LABELS.map(([key]) => `[${key}]`), "[VERB]", "[Place]", "[unknown]", "[two words]", "[a1]"].join(" ");
    api.getPromptHints.mockResolvedValue([hint("h-slots", "VOCAB_WORD", [[content, null]])]);
    const user = await renderHome();
    await openPrompt(user);
    await flush();
    await user.click(guideButton());

    const strong = byClass(querySummary() as HTMLElement, styles.hintChipContent);
    const expectedLabels = [...SLOT_LABELS.map(([, label]) => label), "동사", "장소", "unknown"];
    expect(Array.from(strong.querySelectorAll("em")).map((em) => [em.textContent, classTokens(em)])).toEqual(
      expectedLabels.map((label) => [`[${label}]`, ["page:expressionSlotToken"]])
    );
    expect(strong.textContent).toBe(`${expectedLabels.map((label) => `[${label}]`).join(" ")} [two words] [a1]`);
  });

  it("[spec] 모바일에서 '가이드 보기'(aria-haspopup dialog)를 누르면 걸음 화면 뒤에 도움말 시트(대화상자 '작성 가이드')가 열리고 걸음 화면 안의 요약은 없다(스냅숏). 열리면 본문 스크롤이 잠기고 닫기 버튼에 포커스가 가며, 닫기 버튼으로 닫으면 스크롤이 풀리고 포커스가 '가이드 보기'로 돌아간다", async () => {
    mockMobileViewport();
    api.getPromptHints.mockResolvedValue(HINTS_FULL);
    const user = await renderHome();
    await openPrompt(user);
    await flush();

    const guide = guideButton();
    expect(guide).toHaveAttribute("aria-haspopup", "dialog");
    expect(guide).toHaveAttribute("aria-expanded", "false");
    await user.click(guide);

    const dialog = screen.getByRole("dialog", { name: "작성 가이드" });
    expect(guide).toHaveAttribute("aria-expanded", "true");
    const overlay = dialog.parentElement as HTMLElement;
    expect(mainChildren()).toEqual([
      ["SECTION", ["page:stage", "page:writingEditorStage"]],
      ["DIV", ["page:helpOverlay"]]
    ]);
    expect(querySummary()).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    const close = within(dialog).getByRole("button", { name: "작성 가이드 닫기" });
    await waitFor(() => expect(close).toHaveFocus());
    expect(guideOverview(dialog)).toEqual([
      "짧게라도 바로 영어로 시작해 보세요.",
      "한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각을 만드는 데 집중해 보세요.",
      "I usually [verb] right after I wake up."
    ]);
    expect(hintGroups(dialog)).toEqual(HINT_GROUPS_FULL);
    expect(normalizeForSnapshot(overlay)).toMatchInlineSnapshot(`
      <div
        class="page:helpOverlay"
      >
        <section
          aria-labelledby="writing-help-title"
          aria-modal="true"
          class="page:helpSheet"
          role="dialog"
        >
          <button
            aria-label="작성 가이드 닫기"
            class="page:helpSheetClose"
            type="button"
          >
            ×
          </button>
          <div
            class="page:helpSheetHeader"
          >
            <strong
              id="writing-help-title"
            >
              작성 가이드
            </strong>
          </div>
          <div
            class="page:helpSheetBody"
          >
            <section
              class="page:guideOverviewCard"
            >
              <span
                class="page:guideOverviewLabel"
              >
                최고의 팁!
              </span>
              <strong
                class="page:guideOverviewTitle"
              >
                짧게라도 바로 영어로 시작해 보세요.
              </strong>
              <p
                class="page:guideOverviewBody"
              >
                한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각을 만드는 데 집중해 보세요.
              </p>
            </section>
            <section
              class="page:guideStarterSection"
            >
              <strong
                class="page:guideStarterSectionLabel"
              >
                첫 문장 스타터
              </strong>
              <div
                class="page:guideStarterSurface"
              >
                <span
                  class="page:guideStarterSurfaceText"
                >
                  I usually [verb] right after I wake up.
                </span>
              </div>
            </section>
            <section
              class="page:helpSheetSection"
            >
              <div
                class="page:helpSheetHintGroups"
              >
                <div
                  class="page:hintGroup"
                >
                  <strong
                    class="page:hintGroupTitle"
                  >
                    추천 단어
                  </strong>
                  <div
                    class="page:hintChipList"
                  >
                    <article
                      class="page:hintChip"
                    >
                      <strong
                        class="page:hintChipContent"
                      >
                          routine 
                      </strong>
                      <span
                        class="page:hintChipMeaning"
                      >
                        일과
                      </span>
                    </article>
                    <article
                      class="page:hintChip"
                    >
                      <strong
                        class="page:hintChipContent"
                      >
                        <em
                          class="page:expressionSlotToken"
                        >
                          [형용사]
                        </em>
                         habit
                      </strong>
                      <span
                        class="page:hintChipMeaning"
                      >
                        <em
                          class="page:expressionSlotToken"
                        >
                          [형용사]
                        </em>
                         습관
                      </span>
                    </article>
                    <article
                      class="page:hintChip"
                    >
                      <strong
                        class="page:hintChipContent"
                      >
                        stretch
                      </strong>
                    </article>
                    <article
                      class="page:hintChip"
                    >
                      <strong
                        class="page:hintChipContent"
                      >
                        wake up
                      </strong>
                    </article>
                  </div>
                </div>
                <div
                  class="page:hintGroup"
                >
                  <strong
                    class="page:hintGroupTitle"
                  >
                    추천 표현
                  </strong>
                  <div
                    class="page:hintChipList"
                  >
                    <article
                      class="page:hintChip"
                    >
                      <strong
                        class="page:hintChipContent"
                      >
                        <em
                          class="page:expressionSlotToken"
                        >
                          [내용]
                        </em>
                         gets me going
                      </strong>
                      <span
                        class="page:hintChipMeaning"
                      >
                        <em
                          class="page:expressionSlotToken"
                        >
                          [내용]
                        </em>
                        이 나를 움직이게 해
                      </span>
                    </article>
                    <article
                      class="page:hintChip"
                    >
                      <strong
                        class="page:hintChipContent"
                      >
                        <em
                          class="page:expressionSlotToken"
                        >
                          [Foo]
                        </em>
                         near 
                        <em
                          class="page:expressionSlotToken"
                        >
                          [장소]
                        </em>
                      </strong>
                      <span
                        class="page:hintChipMeaning"
                      >
                        모르는 
                        <em
                          class="page:expressionSlotToken"
                        >
                          [Foo]
                        </em>
                         근처
                      </span>
                    </article>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    `);

    await user.click(close);
    expect(queryHelpDialog()).toBeNull();
    expect(guide).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(guide).toHaveFocus());
  });

  it("[spec] 도움말 시트: 시트 안을 누르면 닫히지 않고, 바깥(덮개)을 누르거나 Escape를 누르면 닫히며 스크롤 잠금이 풀린다. 힌트를 불러오는 중·없음 문구도 보여 준다", async () => {
    mockMobileViewport();
    const hints = deferred<PromptHint[]>();
    api.getPromptHints.mockImplementation(() => hints.promise);
    const user = await renderHome();
    await openPrompt(user);

    await user.click(guideButton());
    let dialog = screen.getByRole("dialog", { name: "작성 가이드" });
    expect(byClass(dialog, styles.helpSheetEmpty).textContent).toBe(LOADING_HINTS);
    await user.click(within(dialog).getByText("첫 문장 스타터"));
    expect(queryHelpDialog()).toBeInTheDocument();
    await user.click(dialog.parentElement as HTMLElement);
    expect(queryHelpDialog()).toBeNull();
    expect(document.body.style.overflow).toBe("");

    await act(async () => {
      hints.resolve([]);
    });
    await user.click(guideButton());
    dialog = screen.getByRole("dialog", { name: "작성 가이드" });
    expect(byClass(dialog, styles.helpSheetEmpty).textContent).toBe(NO_HINTS);
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(queryHelpDialog()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("[spec] 도움말 시트가 열린 채 코치 창도 열었다가 Escape로 둘이 함께 닫히면 본문 스크롤 잠금이 풀린다(두 창의 효과 실행 순서). 화면(main)에는 걸음 화면, 도움말 시트, 코치 창 순서로 있다", async () => {
    mockMobileViewport();
    const user = await renderHome();
    await openPrompt(user);

    await user.click(guideButton());
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(screen.getByRole("button", { name: "AI 코치 열기" }));
    expect(mainChildren()).toEqual([
      ["SECTION", ["page:stage", "page:writingEditorStage"]],
      ["DIV", ["page:helpOverlay"]],
      ["DIV", ["page:coachOverlay"]]
    ]);
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(queryHelpDialog()).toBeNull();
    expect(main().getElementsByClassName(styles.coachOverlay)).toHaveLength(0);
    expect(document.body.style.overflow).toBe("");
  });

  it("[spec] 다시 쓰기 화면에서도 넓은 화면은 걸음 화면 맨 끝에 가이드 요약을 켜고, 첫 답을 낼 때 켜 둔 가이드는 닫혀 있다", async () => {
    api.getPromptHints.mockResolvedValue(HINTS_FULL);
    const user = await renderHome();
    await openPrompt(user);
    await user.click(guideButton());
    expect(querySummary()).not.toBeNull();

    await goToRewrite(user);
    expect(querySummary()).toBeNull();
    expect(guideButton()).toHaveAttribute("aria-expanded", "false");
    await user.click(guideButton());
    const summary = querySummary() as HTMLElement;
    expect(stage().lastElementChild).toBe(summary);
    expect(hintGroups(summary)).toEqual(HINT_GROUPS_FULL);
    expect(queryHelpDialog()).toBeNull();
  });

  it("[spec] 다시 쓰기 화면에서도 모바일은 '가이드 보기'로 도움말 시트가 열리고 Escape로 닫힌다", async () => {
    mockMobileViewport();
    api.getPromptHints.mockResolvedValue(HINTS_FULL);
    const user = await renderHome();
    await openPrompt(user);
    await goToRewrite(user);

    await user.click(guideButton());
    const dialog = screen.getByRole("dialog", { name: "작성 가이드" });
    expect(hintGroups(dialog)).toEqual(HINT_GROUPS_FULL);
    expect(querySummary()).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(queryHelpDialog()).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  // ---------------------------------------------------------------- 다시 쓰기 화면

  it("[spec] 다시 쓰기 화면(넓은 화면)의 문구·구조·클래스·aria·style이 지금과 같다(스냅숏). 입력창에는 제출한 답(앞뒤 빈칸 지움)이 채워지고, '이전 피드백 보기'·이전 답변(접힘)·이전 피드백 칸(접힘)·제출 버튼이 있으며 모바일 입력 막대와 넓은 화면 제출 버튼 자리는 없다", async () => {
    // 자동 저장이 배지를 바꾸지 않도록 서버 저장 응답을 오지 않게 둔다.
    api.saveWritingDraft.mockImplementation(() => new Promise(() => {}));
    const user = await renderHome();
    await openPrompt(user);
    await goToRewrite(user, "  I drink water.  ");

    expect(mainChildren()).toEqual([["SECTION", ["page:stage", "page:writingEditorStage"]]]);
    expect(stageChildren()).toEqual([
      ["SECTION", ["page:writingComposer"]],
      ["DIV", ["page:responseCard"]],
      ["SECTION", ["page:rewriteFeedbackPanel"]],
      ["DIV", ["page:writingEditorFooterStack"]]
    ]);
    expect(rewriteInput().value).toBe("I drink water.");
    expect(wordCount()).toBe("3단어");
    expect(draftBadge()).toBeNull();
    expect(stage().getElementsByClassName(styles.composerDesktopActions)).toHaveLength(0);
    expect([rewriteSubmit().textContent, rewriteSubmit().disabled]).toEqual(["다시 쓴 답변 제출하기", false]);
    expect(normalizeForSnapshot(stage())).toMatchInlineSnapshot(`
      <section
        class="page:stage page:writingEditorStage"
        style="--mobile-composer-bar-height: 0px;"
      >
        <section
          class="page:writingComposer"
        >
          <div
            class="page:writingComposerQuestion"
          >
            <p
              class="page:writingComposerQuestionLabel"
            >
              질문
            </p>
            <p
              class="page:writingComposerQuestionText"
            >
              What do you do first in the morning?
            </p>
            <button
              class="page:writingComposerQuestionAction"
              type="button"
            >
              <span
                aria-hidden="true"
                class="materialSymbols"
              >
                refresh
              </span>
              이전 피드백 보기
            </button>
          </div>
          <div
            class="page:writingComposerAnswer"
          >
            <textarea
              class="page:composerTextarea page:textarea"
              placeholder="피드백을 반영한 영어 답변을 다시 작성해 주세요."
              rows="8"
            >
              I drink water.
            </textarea>
            <div
              class="page:composerMetaBadges"
            >
              <span
                class="page:composerWordCount"
              >
                3단어
              </span>
            </div>
            <div
              class="page:coachTriggerDock"
            >
              <button
                aria-expanded="false"
                aria-haspopup="dialog"
                aria-label="AI 코치 열기"
                class="page:coachTriggerButton"
                type="button"
              >
                <img
                  alt=""
                  class="page:coachTriggerMascot"
                  data-quality="100"
                  height="60"
                  sizes="(max-width: 768px) 50px, 60px"
                  src="/coach/mascote-face.png"
                  width="60"
                />
              </button>
            </div>
          </div>
          <div
            class="page:writingComposerFooterRow"
          >
            <div
              class="page:writingComposerTools"
            >
              <button
                class="page:writingComposerToolButton"
                type="button"
              >
                <span>
                  한국어 번역 보기
                </span>
                <span
                  aria-hidden="true"
                  class="materialSymbols page:writingComposerToolGlyph"
                >
                  translate
                </span>
              </button>
              <button
                aria-expanded="false"
                class="page:writingComposerToolButton"
                type="button"
              >
                <span>
                  가이드 보기
                </span>
                <span
                  aria-hidden="true"
                  class="materialSymbols page:writingComposerToolGlyph"
                >
                  auto_awesome
                </span>
              </button>
            </div>
          </div>
        </section>
        <div
          class="page:responseCard"
        >
          <div
            class="page:mobileSectionHeader"
          >
            <h3>
              이전 답변
            </h3>
            <button
              class="page:mobileSectionToggle"
              type="button"
            >
              보기
            </button>
          </div>
          <div
            class="page:mobileSectionBody"
          >
            <p>
              I drink water.
            </p>
          </div>
        </div>
        <section
          class="page:rewriteFeedbackPanel"
        >
          <div
            class="page:rewriteFeedbackHeader"
          >
            <div>
              <strong>
                이전 피드백
              </strong>
              <p>
                직전 답변에서 받은 피드백을 같은 구조로 다시 보면서 문장을 다듬어 보세요.
              </p>
            </div>
            <button
              class="page:rewriteFeedbackToggle"
              type="button"
            >
              피드백 보기
            </button>
          </div>
        </section>
        <div
          class="page:writingEditorFooterStack"
        >
          <div
            class="page:writingEditorFooter"
          >
            <button
              class="page:writingEditorPrimaryButton"
              type="button"
            >
              다시 쓴 답변 제출하기
            </button>
          </div>
        </div>
      </section>
    `);
  });

  it("[spec] 이전 답변: '보기'를 누르면 본문이 열린 모양(mobileSectionBodyOpen)이 되고 '접기'로 닫힌다. 다시 쓴 답을 내고 다시 쓰기 화면에 오면 이전 답변은 방금 낸 답이고 다시 접혀 있다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToRewrite(user);

    const card = byClass(stage(), styles.responseCard);
    expect(card.querySelector("h3")?.textContent).toBe("이전 답변");
    expect(classTokens(previousAnswerBody())).toEqual(["page:mobileSectionBody"]);
    expect(previousAnswerBody().textContent).toBe(FIRST_ANSWER);
    await user.click(within(card).getByRole("button", { name: "보기" }));
    expect(classTokens(previousAnswerBody())).toEqual(["page:mobileSectionBody", "page:mobileSectionBodyOpen"]);
    expect(within(card).queryByRole("button", { name: "보기" })).toBeNull();
    await user.click(within(card).getByRole("button", { name: "접기" }));
    expect(classTokens(previousAnswerBody())).toEqual(["page:mobileSectionBody"]);
    await user.click(within(card).getByRole("button", { name: "보기" }));

    await user.clear(rewriteInput());
    await user.type(rewriteInput(), "I drink two glasses of water.");
    api.submitFeedback.mockResolvedValueOnce(needsRewrite(2));
    await user.click(rewriteSubmit());
    await screen.findByText("2번째 시도");
    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);

    expect(rewriteInput().value).toBe("I drink two glasses of water.");
    expect(previousAnswerBody().textContent).toBe("I drink two glasses of water.");
    expect(classTokens(previousAnswerBody())).toEqual(["page:mobileSectionBody"]);
  });

  it("[spec] 입력창 위 '이전 피드백 보기'도 이전 피드백 칸을 펼치고 접으며, 칸의 버튼 글자('피드백 보기'·'피드백 숨기기')와 함께 바뀐다. 펼칠 때만 그 칸으로 부드럽게 스크롤한다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToRewrite(user);
    const scrollIntoView = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    const panel = byClass(stage(), styles.rewriteFeedbackPanel);
    await user.click(within(questionBox()).getByRole("button", { name: "이전 피드백 보기" }));
    expect(panel.getElementsByClassName(styles.rewriteFeedbackBody)).toHaveLength(1);
    expect(within(panel).getByRole("button", { name: "피드백 숨기기" })).toBeInTheDocument();
    expect(within(questionBox()).getByRole("button", { name: "이전 피드백 숨기기" })).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(panel);
    expect(scrollIntoView.mock.calls[0]).toEqual([{ behavior: "smooth", block: "start" }]);

    await user.click(within(questionBox()).getByRole("button", { name: "이전 피드백 숨기기" }));
    expect(panel.getElementsByClassName(styles.rewriteFeedbackBody)).toHaveLength(0);
    expect(within(panel).getByRole("button", { name: "피드백 보기" })).toBeInTheDocument();
    expect(within(questionBox()).getByRole("button", { name: "이전 피드백 보기" })).toBeInTheDocument();
    await wait(50);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    await user.click(within(panel).getByRole("button", { name: "피드백 보기" }));
    expect(within(questionBox()).getByRole("button", { name: "이전 피드백 숨기기" })).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
    expect(scrollIntoView.mock.contexts[1]).toBe(panel);
  });

  it("[spec] 다시 쓴 답: 단어 수가 따라가고 초안 배지가 보인다. 비우고 내면 '영어 답변을 먼저 입력해 주세요.'만 보이고 요청하지 않는다. 내면 피드백의 세션 id로 앞뒤 빈칸을 지운 REWRITE 요청을 보내고, 기다리는 동안 버튼이 '피드백 생성 중...'으로 비활성이며 받으면 피드백 화면으로 간다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToRewrite(user);

    await user.clear(rewriteInput());
    expect(wordCount()).toBe("0단어");
    await user.click(rewriteSubmit());
    expect(errorTexts()).toEqual([EMPTY_ANSWER_ERROR]);
    expect(api.submitFeedback).toHaveBeenCalledTimes(1);

    await user.type(rewriteInput(), "  I drink two glasses of water.  ");
    expect(wordCount()).toBe("6단어");
    await waitFor(
      () =>
        expect(draftBadge()).toEqual({
          text: `임시저장됨 · ${SAVED_AT_LABEL}`,
          title: `임시저장됨 · ${SAVED_AT_LABEL}`,
          classes: ["page:composerStatusBadge"]
        }),
      { timeout: 3000 }
    );

    const pending = deferred<Feedback>();
    api.submitFeedback.mockImplementationOnce(() => pending.promise);
    await user.click(rewriteSubmit());
    expect(errorTexts()).toEqual([]);
    expect([rewriteSubmit().textContent, rewriteSubmit().disabled]).toEqual(["피드백 생성 중...", true]);
    expect(api.submitFeedback.mock.calls[1]).toEqual([
      {
        promptId: P1.id,
        answer: "I drink two glasses of water.",
        sessionId: "sess-writing-1",
        attemptType: "REWRITE",
        guestId: GUEST_ID,
        submissionId: expect.any(String)
      }
    ]);
    await act(async () => {
      pending.resolve(needsRewrite(2));
    });
    expect(await screen.findByText("2번째 시도")).toBeInTheDocument();
    expect(main().getElementsByClassName(styles.writingEditorStage)).toHaveLength(0);
  });

  it("[spec] 피드백 없이 다시 쓰기 단계가 되면(로그인 뒤 되살린 초안) 이전 답변은 '먼저 첫 답변을 제출해 주세요.'이고 이전 피드백 칸이 없으며 제출 버튼이 비활성이다. '이전 피드백 보기'는 글자만 바뀌고 스크롤하지 않는다", async () => {
    storeLoginDraft({ step: "rewrite" });
    const user = await renderHome();
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
    await flush();

    expect(previousAnswerBody().textContent).toBe("먼저 첫 답변을 제출해 주세요.");
    expect(stage().getElementsByClassName(styles.rewriteFeedbackPanel)).toHaveLength(0);
    expect([rewriteSubmit().textContent, rewriteSubmit().disabled]).toEqual(["다시 쓴 답변 제출하기", true]);
    await user.click(within(questionBox()).getByRole("button", { name: "이전 피드백 보기" }));
    expect(within(questionBox()).getByRole("button", { name: "이전 피드백 숨기기" })).toBeInTheDocument();
    await wait(50);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "제출한 답이 빈칸뿐이면 첫 답(앞뒤 빈칸 지움)",
      draft: { lastSubmittedAnswer: "   ", answer: "  First answer here.  ", rewrite: "Draft rewrite." },
      previous: "First answer here."
    },
    {
      name: "제출한 답과 첫 답이 빈칸뿐이면 다시 쓴 답(앞뒤 빈칸 지움)",
      draft: { lastSubmittedAnswer: "  ", answer: "  ", rewrite: "  Only rewrite.  " },
      previous: "Only rewrite."
    }
  ])("[spec] 이전 답변의 글자: $name", async ({ draft, previous }) => {
    storeLoginDraft({ step: "rewrite", ...draft });
    await renderHome();
    await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);

    expect(previousAnswerBody().textContent).toBe(previous);
    expect(rewriteInput().value).toBe(draft.rewrite);
  });

  // ---------------------------------------------------------------- 완료 화면

  it("[spec] 완료 화면(로그인, 연속 3일, 추천 질문 셋 중 둘)의 문구·구조·클래스·aria·그림 속성이 지금과 같다(스냅숏). 걸음 화면은 화면(main)의 유일한 자식이고, 축하 효과는 이 화면의 canvas로 만들어 정해진 세 값으로 쏜다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToComplete(user);

    expect(mainChildren()).toEqual([["SECTION", ["page:completeStage"]]]);
    expect(completionSubcopy()).toBe("오늘도 끝까지 썼어요.");
    expect(streakPanel()).toEqual(["3일 연속 학습 중", "총 1,234문장 작성"]);
    expect(recommendationCards()).toEqual([
      ["입문 • Breakfast", P2.questionEn],
      ["쉬움 • Cooking", P3.questionEn]
    ]);
    expect(normalizeForSnapshot(completeStage())).toMatchInlineSnapshot(`
      <section
        class="page:completeStage"
      >
        <canvas
          aria-hidden="true"
          class="page:celebrationCanvas"
        />
        <div
          class="page:completionStoryShell"
        >
          <div
            class="page:completionMascotStage"
          >
            <div
              class="page:completionMascotFrame"
            >
              <img
                alt="WriteLoop 완료 마스코트"
                class="page:completionMascotImage"
                height="120"
                src="/complete/excellent.png"
                width="120"
              />
            </div>
            <span
              class="page:completionMascotBadge"
            >
              SUCCESS!
            </span>
          </div>
          <div
            class="page:completionStoryCopy"
          >
            <h2>
              루프를 완주했어요!
            </h2>
            <p>
              오늘도 끝까지 썼어요.
            </p>
          </div>
          <div
            class="page:completionStreakPanel"
          >
            <div
              class="page:completionStreakIcon"
            >
              <span
                class="materialSymbols"
              >
                local_fire_department
              </span>
            </div>
            <span
              class="page:completionStreakEyebrow"
            >
              CURRENT STREAK
            </span>
            <strong>
              3일 연속 학습 중
            </strong>
            <p
              class="page:completionStreakMeta"
            >
              총 1,234문장 작성
            </p>
          </div>
          <div
            class="page:completionRecommendationSection"
          >
            <div
              class="page:completionRecommendationTitle"
            >
              <span
                class="materialSymbols"
              >
                timelapse
              </span>
              <strong>
                다음 질문 추천
              </strong>
            </div>
            <div
              class="page:completionRecommendationList"
            >
              <button
                class="page:completionRecommendationCard"
                type="button"
              >
                <span>
                  입문 • Breakfast
                </span>
                <strong>
                  What did you eat for breakfast today?
                </strong>
              </button>
              <button
                class="page:completionRecommendationCard"
                type="button"
              >
                <span>
                  쉬움 • Cooking
                </span>
                <strong>
                  What dish do you cook most often?
                </strong>
              </button>
            </div>
          </div>
          <div
            class="page:completionActionStack"
          >
            <button
              class="page:completionActionPrimary page:primaryButton"
              type="button"
            >
              추천 질문에 이어서 답변하기
            </button>
            <div
              class="page:completionActionRow"
            >
              <button
                class="page:completionActionSecondary page:ghostButton"
                type="button"
              >
                다른 질문 보기
              </button>
              <button
                class="page:completionActionSecondary page:ghostButton"
                type="button"
              >
                마지막 피드백 다시 보기
              </button>
            </div>
          </div>
        </div>
      </section>
    `);

    const canvas = byClass(completeStage(), styles.celebrationCanvas);
    await waitFor(() => expect(confetti.create).toHaveBeenCalledTimes(1));
    expect(confetti.create.mock.calls[0][0]).toBe(canvas);
    expect(confetti.create.mock.calls[0].slice(1)).toEqual([{ resize: true, useWorker: true }]);
    await waitFor(() => expect(confetti.fire.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(confetti.fire.mock.calls.slice(0, 3)).toEqual(CONFETTI_LAUNCH.map((options) => [options]));
  });

  it("[spec] 축하 효과는 0.26초마다 다시 쏘고, 완료 화면을 떠나면('다른 질문 보기') 더 쏘지 않는다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToComplete(user);

    await waitFor(() => expect(confetti.fire.mock.calls.length).toBeGreaterThanOrEqual(6), { timeout: 2000 });
    expect(confetti.fire.mock.calls.slice(3, 6)).toEqual(CONFETTI_LAUNCH.map((options) => [options]));
    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    const firedAtLeave = confetti.fire.mock.calls.length;
    await wait(700);
    expect(confetti.fire.mock.calls.length).toBe(firedAtLeave);
    expect(confetti.create).toHaveBeenCalledTimes(1);
  });

  it("[spec] 완료 화면의 안내 문구: 완료 메시지가 빈칸뿐이면 앞뒤 빈칸을 지운 빈 글자다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToComplete(user, ready("sess-writing-10", "   "));

    expect(completionSubcopy()).toBe("");
  });

  it("[spec] 완료 화면의 안내 문구: 피드백이 없으면(로그인 뒤 되살린 완료 단계 초안) '꾸준함이 실력을 만듭니다. 오늘도 멋진 글을 썼네요!'다", async () => {
    storeLoginDraft({ step: "complete" });
    await renderHome();
    await screen.findByRole("heading", { name: COMPLETE_HEADING });

    expect(completionSubcopy()).toBe("꾸준함이 실력을 만듭니다. 오늘도 멋진 글을 썼네요!");
  });

  it.each([
    {
      name: "로그인, 연속 0일이면 마친 뒤 1일, 총 문장 수는 천 단위 쉼표",
      loggedIn: true,
      today: { ...TODAY, streakDays: 0, totalWrittenSentences: 1234567 } as TodayWritingStatus | null,
      panel: ["1일 연속 학습 중", "총 1,234,567문장 작성"]
    },
    {
      name: "로그인, 오늘 상태를 불러오지 못했으면 마친 뒤 1일, 총 0문장",
      loggedIn: true,
      today: null,
      panel: ["1일 연속 학습 중", "총 0문장 작성"]
    },
    {
      name: "로그인 안 함이면 '오늘 첫 루프 완료', 총 0문장",
      loggedIn: false,
      today: TODAY,
      panel: ["오늘 첫 루프 완료", "총 0문장 작성"]
    }
  ])("[spec] 완료 화면의 연속 학습일: $name", async ({ loggedIn, today, panel }) => {
    if (today) {
      api.getTodayWritingStatus.mockResolvedValue(today);
    } else {
      api.getTodayWritingStatus.mockRejectedValue(new Error("오늘 상태 실패(가짜)"));
    }
    const user = await renderHome(loggedIn);
    await openPrompt(user);
    await goToComplete(user);

    expect(streakPanel()).toEqual(panel);
  });

  it("[spec] 완료 화면의 연속 학습일: 마치기를 거치지 않은 완료 화면(로그인 뒤 되살린 초안)은 오늘 상태 그대로라 연속 0일이면 '오늘 첫 루프 완료'다", async () => {
    api.getTodayWritingStatus.mockResolvedValue({ ...TODAY, streakDays: 0, totalWrittenSentences: 7 });
    storeLoginDraft({ step: "complete" });
    await renderHome();
    await screen.findByRole("heading", { name: COMPLETE_HEADING });
    await flush();

    expect(streakPanel()).toEqual(["오늘 첫 루프 완료", "총 7문장 작성"]);
  });

  it("[spec] 추천 질문 카드를 누르면 그 질문으로 시작한다: 고르기 기록(질문 id, 게스트 id)을 남기고 그 질문의 초안을 찾은 뒤 답 쓰기 화면이 그 질문이다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToComplete(user);
    api.trackDailyPromptClick.mockClear();
    api.getWritingDraft.mockClear();

    await user.click(screen.getByText(P3.questionEn, { selector: "strong" }).closest("button") as HTMLButtonElement);
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(questionText()).toBe(P3.questionEn));
    await waitFor(() => expect(api.getDailyPrompts).toHaveBeenLastCalledWith("A", GUEST_ID));
    await flush();

    expect(questionText()).toBe(P3.questionEn);
    expect(api.trackDailyPromptClick.mock.calls).toEqual([[P3.id, GUEST_ID]]);
    expect(api.getWritingDraft.mock.calls).toEqual([
      [P3.id, "REWRITE"],
      [P3.id, "ANSWER"]
    ]);
    expect(answerInput().value).toBe("");
  });

  it("[spec] '추천 질문에 이어서 답변하기'는 첫 추천 질문으로 시작한다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToComplete(user);
    api.trackDailyPromptClick.mockClear();

    await user.click(screen.getByRole("button", { name: "추천 질문에 이어서 답변하기" }));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await waitFor(() => expect(questionText()).toBe(P2.questionEn));

    expect(api.trackDailyPromptClick.mock.calls).toEqual([[P2.id, GUEST_ID]]);
  });

  it("[spec] 추천할 질문이 없으면 추천 칸과 '추천 질문에 이어서 답변하기'가 없고 '다른 질문 보기'·'마지막 피드백 다시 보기'만 있다(버튼 묶음 스냅숏)", async () => {
    api.getPrompts.mockResolvedValue([P1]);
    api.getDailyPrompts.mockResolvedValue({ ...DAILY_I, prompts: [P1] });
    const user = await renderHome();
    await openPrompt(user);
    await goToComplete(user);

    expect(completeStage().getElementsByClassName(styles.completionRecommendationSection)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "추천 질문에 이어서 답변하기" })).toBeNull();
    expect(normalizeForSnapshot(byClass(completeStage(), styles.completionActionStack))).toMatchInlineSnapshot(`
      <div
        class="page:completionActionStack"
      >
        <div
          class="page:completionActionRow"
        >
          <button
            class="page:completionActionSecondary page:ghostButton"
            type="button"
          >
            다른 질문 보기
          </button>
          <button
            class="page:completionActionSecondary page:ghostButton"
            type="button"
          >
            마지막 피드백 다시 보기
          </button>
        </div>
      </div>
    `);
  });

  it("[spec] 오늘의 질문을 불러오는 동안 '추천 질문에 이어서 답변하기'는 비활성이고 추천 카드는 눌린다. 받으면 풀린다(로그인 뒤 되살린 완료 단계 초안)", async () => {
    const daily = deferred<DailyPromptRecommendation>();
    api.getDailyPrompts.mockImplementation(() => daily.promise);
    storeLoginDraft({ step: "complete" });
    await renderHome();
    await screen.findByRole("heading", { name: COMPLETE_HEADING });
    await waitFor(() => expect(api.getDailyPrompts).toHaveBeenCalled());
    const primary = await screen.findByRole("button", { name: "추천 질문에 이어서 답변하기" });

    expect(primary).toBeDisabled();
    expect(recommendationCards()).toEqual([
      ["입문 • Breakfast", P2.questionEn],
      ["쉬움 • Cooking", P3.questionEn]
    ]);
    Array.from(completeStage().getElementsByClassName(styles.completionRecommendationCard)).forEach((card) =>
      expect(card).not.toBeDisabled()
    );
    await act(async () => {
      daily.resolve(DAILY_I);
    });
    expect(primary).not.toBeDisabled();
  });

  it("[spec] '마지막 피드백 다시 보기'는 피드백 화면으로, '다른 질문 보기'는 질문 목록 화면으로 간다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await goToComplete(user);

    await user.click(screen.getByRole("button", { name: "마지막 피드백 다시 보기" }));
    expect(main().getElementsByClassName(styles.completeStage)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "완료 화면으로 돌아가기" }));
    await screen.findByRole("heading", { name: COMPLETE_HEADING });

    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    expect(main().getElementsByClassName(styles.completeStage)).toHaveLength(0);
    expect(byClass(main(), styles.promptSelectionCardGrid)).toBeInTheDocument();
    expect(screen.getByText(P4.questionEn)).toBeInTheDocument();
  });
});
