// [spec] qa 테스트(작업 037-09 피드백 화면, 리팩터링). 피드백 화면 조각과 피드백 응답에서 계산하는 값을 answer-loop.tsx 밖으로 옮기기 전의 "지금 동작"을 기록한다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// next/image 가짜는 src·alt·width·height·className을 그대로 <img>에 넘겨, 그림의 자리와 모양도 기록한다.
// 완료 화면의 축하 효과(canvas-confetti)는 jsdom에 canvas 그리기가 없어 아무것도 하지 않는 가짜로 둔다.
// jsdom에는 scrollIntoView가 없어(다시 쓰기 화면의 "피드백 보기"가 부른다) 아무것도 하지 않는 함수로 둔다.
// 화면 바깥에서 동작만 보므로, 안쪽을 다른 파일로 나눠도 같은 테스트가 그대로 통과해야 한다.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import type {
  AuthUser,
  DailyPromptRecommendation,
  Feedback,
  FeedbackLanguageCorrection,
  FeedbackLoopStatus,
  HomeDraftSnapshot,
  Prompt,
  SavedExpression,
  TodayWritingStatus
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
  default: ({
    src,
    alt,
    width,
    height,
    className
  }: {
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

const USER: AuthUser = {
  id: 4901,
  email: "feedback-screen-spec@example.com",
  displayName: "피드백화면",
  admin: false
};

const GUEST_ID = "guest-feedback-spec-000000000000001";

const TODAY: TodayWritingStatus = {
  date: "2026-04-15",
  completed: false,
  completedSessions: 0,
  startedSessions: 0,
  streakDays: 3,
  totalAnswerSessions: 10,
  totalWrittenSentences: 120
};

const PROMPT_1: Prompt = {
  id: "prompt-feedback-1",
  topic: "Health",
  topicCategory: "Daily life",
  topicDetail: "Exercise",
  difficulty: "I",
  questionEn: "How do you stay healthy these days?",
  questionKo: "요즘 어떻게 건강을 지키나요?",
  tip: ""
};

const PROMPT_2: Prompt = {
  id: "prompt-feedback-2",
  topic: "Travel",
  topicCategory: "Leisure",
  topicDetail: "Trips",
  difficulty: "I",
  questionEn: "Where would you like to travel next?",
  questionKo: "다음에 어디로 여행 가고 싶나요?",
  tip: ""
};

const DAILY: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  prompts: [PROMPT_1, PROMPT_2]
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const REWRITE_PLACEHOLDER = "피드백을 반영한 영어 답변을 다시 작성해 주세요.";
const FIRST_ANSWER = "I go to the gym after work.";
const FINISH_LABEL = "오늘 루프 완료하고 도장 받기";
const PRIMARY = ["page:footerButtonRewrite"];
const SECONDARY = ["page:footerButtonOutline", "page:footerButtonSecondary"];
const COMPLETED_NOTE = "이 질문은 완료했어요. 다음 답변에서 이 내용을 넣어 써 보세요.";

// 서버가 진행 상태를 주지 않을 때 화면이 만드는 문구 가운데 화면에 그리지 않는 것(배지, 도움말, 답변 취소).
const GENERATED_STATUS_TEXTS_NOT_SHOWN = [
  "다시 써보기 추천",
  "루프 완료 가능",
  "위 starter를 바탕으로 바로 다시 써 볼 수 있어요.",
  "원하면 한 번 더 다듬어 볼 수 있어요.",
  "답변 취소"
];

const INITIAL_STAGES = [
  ["피드백을 만들고 있어요", "답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요."],
  ["문장을 찬찬히 읽고 있어요", "좋은 점과 먼저 고칠 점을 나눠 보고 있어요."],
  ["더 자연스럽게 들리도록 다듬는 중이에요", "바로 써볼 수 있는 표현도 함께 고르고 있어요."],
  ["표현을 하나 더 붙일 곳도 찾고 있어요", "다음 다시쓰기에 도움이 될 힌트까지 챙기고 있어요."]
];

const REWRITE_STAGES = [
  ["다시 쓴 답변을 읽고 있어요", "이전 피드백이 얼마나 반영됐는지 살펴보고 있어요. 잠시만 기다려 주세요."],
  ["문장을 한 줄씩 비교하고 있어요", "좋아진 부분과 아직 다듬을 부분을 함께 찾고 있어요."],
  ["더 자연스럽게 들리도록 다듬는 중이에요", "흐름이 매끄러워지는 표현도 함께 고르고 있어요."],
  ["이번 다시쓰기의 포인트를 정리하고 있어요", "한 번 더 성장한 답안이 되도록 핵심 힌트를 정리하고 있어요."]
];

type User = ReturnType<typeof userEvent.setup>;

function makeFeedback(partial: Partial<Feedback>): Feedback {
  return {
    promptId: PROMPT_1.id,
    sessionId: "sess-feedback",
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

// 다시 쓰기가 필요한 피드백. 코치 피드백 구간의 모든 칸이 차 있고, 마칠 준비가 된 피드백에서만 보이는 값(보충 표현, 마무리 표현, 모범답안)도 일부러 넣었다.
function needsRewriteFull(attemptNo: number): Feedback {
  return makeFeedback({
    sessionId: "sess-501",
    attemptNo,
    loopComplete: false,
    completionMessage: "다시 쓰기 메시지(화면에 없음)",
    strengths: ["응답의 강점 목록(화면에 없음)"],
    rewriteChallenge: "응답의 다시 쓰기 과제(화면에 없음)",
    refinementExpressions: [{ expression: "unwind after work", meaningKo: "퇴근 후 긴장을 풀다" }],
    modelAnswer: "I go to the gym after work because it helps me relax.",
    modelAnswerKo: "저는 긴장을 풀려고 퇴근 후 헬스장에 가요.",
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "  운동하는 때를 분명하게 말했어요.  ",
      coachMove: {
        focus: "운동하는 이유를 한 문장 더해 보세요.",
        focusType: "ADD_DETAIL",
        why: "이유가 있으면 답이 더 설득력 있어져요.",
        before: "I go to the gym.",
        after: "I go to the gym because it helps me relax.",
        instruction: "왜 운동하는지 한 문장 더 써 보세요.",
        skeletonEn: "I work out because ___.",
        skeletonKo: "저는 ___ 때문에 운동해요.",
        successCheck: "이유 문장이 하나 있으면 성공(화면에 없음)",
        suggestedPhrases: [
          { phrase: " it helps me relax ", meaningKo: " 긴장을 푸는 데 도움이 되다 " },
          "stay in shape",
          "   ",
          { phrase: "clear my head" },
          { phrase: "", meaningKo: "빈 표현(화면에 없음)" },
          "relieve stress",
          { phrase: "feel refreshed", meaningKo: "개운해지다" },
          "sleep better",
          "build stamina"
        ]
      },
      completion: {
        headline: "완료 제목(화면에 없음)",
        enrichment: { focus: "보충 초점(화면에 없음)", skeletonEn: "I also ___." }
      },
      refinementExpressions: [{ expression: "unwind after work", meaningKo: "퇴근 후 긴장을 풀다" }],
      modelAnswer: "I go to the gym after work because it helps me relax.",
      modelAnswerKo: "저는 긴장을 풀려고 퇴근 후 헬스장에 가요."
    }
  });
}

// 고친 표현 6개: 종류별 배지, 고치기 전·후가 한쪽만 있거나 빈칸뿐인 것을 섞었다.
const SIX_CORRECTIONS: FeedbackLanguageCorrection[] = [
  { kind: "GRAMMAR_BLOCKING", label: "시제", before: "go", after: "went", reason: "어제 일이라 과거형을 써요." },
  {
    kind: "STRUCTURE",
    label: "문장 구조",
    before: "Because tired.",
    after: "Because I was tired.",
    reason: "주어와 동사가 있어야 해요."
  },
  { kind: "GRAMMAR_LOCAL", label: "관사", before: null, after: "a", reason: "셀 수 있는 명사 앞에는 a를 써요." },
  { kind: "GRAMMAR_LOCAL", label: "전치사", before: "in", after: "  ", reason: "여기서는 전치사가 필요 없어요." },
  { kind: "GRAMMAR_LOCAL", label: "철자", before: "  ", after: null, reason: "철자를 다시 확인해 보세요." },
  {
    kind: "GRAMMAR_BLOCKING",
    label: "주어 동사 일치",
    before: "he go",
    after: "he goes",
    reason: "3인칭 단수 주어에는 -s를 붙여요."
  }
];

const CORRECTION_VIEWS = [
  {
    badge: ["시제", ["page:languageCorrectionBadge", "page:languageCorrectionBadgeCore"]],
    swap: [
      ["DEL", "go"],
      ["SPAN", "→"],
      ["STRONG", "went"]
    ],
    reason: "어제 일이라 과거형을 써요."
  },
  {
    badge: ["문장 구조", ["page:languageCorrectionBadge", "page:languageCorrectionBadgeStructure"]],
    swap: [
      ["DEL", "Because tired."],
      ["SPAN", "→"],
      ["STRONG", "Because I was tired."]
    ],
    reason: "주어와 동사가 있어야 해요."
  },
  {
    badge: ["관사", ["page:languageCorrectionBadge", "page:languageCorrectionBadgeDetail"]],
    swap: [
      ["SPAN", "→"],
      ["STRONG", "a"]
    ],
    reason: "셀 수 있는 명사 앞에는 a를 써요."
  },
  {
    badge: ["전치사", ["page:languageCorrectionBadge", "page:languageCorrectionBadgeDetail"]],
    swap: [
      ["DEL", "in"],
      ["SPAN", "→"]
    ],
    reason: "여기서는 전치사가 필요 없어요."
  },
  {
    badge: ["철자", ["page:languageCorrectionBadge", "page:languageCorrectionBadgeDetail"]],
    swap: null,
    reason: "철자를 다시 확인해 보세요."
  },
  {
    badge: ["주어 동사 일치", ["page:languageCorrectionBadge", "page:languageCorrectionBadgeCore"]],
    swap: [
      ["DEL", "he go"],
      ["SPAN", "→"],
      ["STRONG", "he goes"]
    ],
    reason: "3인칭 단수 주어에는 -s를 붙여요."
  }
];

// 직접 고치기(LANGUAGE_FIX, 앞뒤 빈칸과 소문자). 문장 틀과 넣어볼 표현도 넣었지만 직접 고치기에서는 보이지 않는다.
function languageFix(attemptNo: number, corrections: FeedbackLanguageCorrection[] = SIX_CORRECTIONS): Feedback {
  return makeFeedback({
    sessionId: "sess-502",
    attemptNo,
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "하고 싶은 말을 끝까지 썼어요.",
      coachMove: {
        focus: "과거 시제로 고쳐 보세요.",
        focusType: " language_fix ",
        why: "어제 한 일은 과거형으로 써야 자연스러워요.",
        before: "I go to school yesterday.",
        after: "I went to school yesterday.",
        instruction: "고친 문장을 넣어 다시 써 보세요.",
        skeletonEn: "Yesterday, I ___.",
        skeletonKo: "어제 저는 ___했어요.",
        suggestedPhrases: ["went to school"],
        languageCorrections: corrections
      }
    }
  });
}

// 마칠 준비가 된 피드백. 보충 표현, 마무리 표현(걸러지는 것 포함), 모범답안이 다 있고, 코치 미션도 일부러 넣었다(보이지 않는다).
function readyFull(attemptNo: number, sessionId = "sess-601"): Feedback {
  return makeFeedback({
    sessionId,
    attemptNo,
    loopComplete: true,
    completionMessage: "  서버의 완료 메시지  ",
    revisedAnswer: "I go to the gym after work to relieve stress.",
    strengths: ["응답의 강점 목록(화면에 없음)"],
    modelAnswer: "응답의 모범답안(화면에 없음)",
    visibleFeedback: {
      schemaVersion: 1,
      state: "READY_TO_FINISH",
      strength: "하고 싶은 말을 끝까지 썼어요.",
      coachMove: { focus: "코치 초점(화면에 없음)", instruction: "코치 안내(화면에 없음)" },
      completion: {
        headline: "좋아요. 이대로 마무리해도 돼요.",
        enrichment: {
          focus: "언제 운동하는지 더해 보세요.",
          why: "때를 말하면 장면이 그려져요.",
          instruction: "운동하는 때를 한 구절 더해 보세요.",
          skeletonEn: "I usually work out ___.",
          skeletonKo: "저는 보통 ___ 운동해요.",
          suggestedPhrases: [
            "after dinner",
            { phrase: " in the morning ", meaningKo: " 아침에 " },
            "  ",
            "on weekends",
            "twice a week",
            "every day"
          ]
        }
      },
      refinementExpressions: [
        {
          expression: "make time for",
          meaningKo: "~할 시간을 내다",
          guidanceKo: "시간을 따로 낸다고 말할 때 써요.",
          exampleEn: "I make time for exercise."
        },
        { expression: "hidden expression", meaningKo: "숨긴 표현(화면에 없음)", displayable: false },
        { expression: "[place] lover", meaningKo: "자리표시가 든 표현(화면에 없음)" },
        { expression: "Make time for!", meaningKo: "같은 표현(화면에 없음)" },
        { expression: "go to the gym", meaningKo: "이미 쓴 표현(화면에 없음)" },
        { expression: "relieve stress", meaningKo: "고친 답에 있는 표현(화면에 없음)" },
        { expression: "stay consistent", meaningKo: "꾸준히 하다" }
      ],
      modelAnswer: "  I usually go to the gym after work to relieve stress.  ",
      modelAnswerKo: "저는 보통 스트레스를 풀려고 퇴근 후 헬스장에 가요."
    }
  });
}

function needsRewrite(attemptNo: number, focus: string): Feedback {
  return makeFeedback({
    sessionId: "sess-503",
    attemptNo,
    visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", coachMove: { focus } }
  });
}

function savedExpression(id: number, expression: string): SavedExpression {
  return {
    id,
    expression,
    sourceType: "COACH_RECOMMENDATION",
    saveCount: 1,
    lastSavedAt: "2026-04-15T09:00:00Z",
    createdAt: "2026-04-15T09:00:00Z"
  };
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

// page.module.css의 클래스는 테스트에서 "_<이름>_<파일 해시>"로 나온다. 이 파일의 클래스는 "page:<이름>"으로 바꿔 읽기 쉽게 하고,
// 다른 CSS 파일의 클래스는 그대로 둔다(다른 파일로 옮겨지면 해시가 달라져 드러난다).
// 클래스 문자열 안의 빈칸 수와 순서는 화면에 영향이 없으므로 정렬해 비교한다.
const PAGE_CLASS_SUFFIX = (styles.feedbackBody as string).slice("_feedbackBody".length);

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
function normalizeForSnapshot(element: HTMLElement) {
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

function textOfClass(container: Element, className: string) {
  const found = container.getElementsByClassName(className);
  expect(found.length).toBeLessThanOrEqual(1);
  return found[0]?.textContent ?? null;
}

// 첫 화면을 렌더하고 저장된 표현 불러오기(로그인 확인 뒤)가 끝날 때까지 기다린다.
async function renderHome() {
  const user = userEvent.setup();
  render(<AnswerLoop />);
  await waitFor(() => expect(api.getSavedExpressions).toHaveBeenCalled());
  await flush();
  return user;
}

// 난이도 화면에서 입문을 골라 질문 목록을 열고, 질문을 골라 답 쓰기 화면으로 간다.
async function openPrompt(user: User, prompt: Prompt = PROMPT_1) {
  await user.click(screen.getByRole("button", { name: /입문/ }));
  await user.click(await screen.findByText(prompt.questionEn));
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
}

function answerInput() {
  return screen.getByPlaceholderText(ANSWER_PLACEHOLDER) as HTMLTextAreaElement;
}

function rewriteInput() {
  return screen.getByPlaceholderText(REWRITE_PLACEHOLDER) as HTMLTextAreaElement;
}

// 피드백 화면(걸음 화면 section). 시도 번호 글자에서 가장 가까운 section이다.
function feedbackSection() {
  const meta = byClass(document.body, styles.feedbackAttemptMetaOnly);
  return meta.closest("section") as HTMLElement;
}

async function submitFirst(user: User, next: Feedback, text = FIRST_ANSWER) {
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.type(answerInput(), text);
  await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
  await screen.findByText(`${next.attemptNo}번째 시도`);
  return feedbackSection();
}

// 피드백 화면의 다시 쓰기 버튼(글자로 찾는다)을 눌러 다시 쓰기 화면으로 가고, 채워진 답을 그대로 제출한다.
async function rewriteAndSubmit(user: User, rewriteLabel: string, next: Feedback) {
  await user.click(screen.getByRole("button", { name: rewriteLabel }));
  await screen.findByPlaceholderText(REWRITE_PLACEHOLDER);
  api.submitFeedback.mockResolvedValueOnce(next);
  await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
  await screen.findByText(`${next.attemptNo}번째 시도`);
  return feedbackSection();
}

function summaryStack(container: Element) {
  return byClass(container, styles.visibleFeedbackStack);
}

// 피드백 요약의 구간 순서. 코치 피드백 구간과 보충 표현 구간은 같은 coachMoveCard라 안의 제목 클래스로 가린다.
function summaryParts(stack: Element) {
  return Array.from(stack.children).map((child) => {
    const tokens = classTokens(child);
    if (tokens.includes("page:visibleStrengthCard")) {
      return "잘한 점";
    }
    if (tokens.includes("page:coachMoveCard")) {
      return child.getElementsByClassName(styles.enrichmentEyebrow).length > 0 ? "보충 표현" : "코치 피드백";
    }
    if (tokens.includes("page:visibleExpressionCard")) {
      return "가볍게 넣어볼 표현";
    }
    if (tokens.includes("page:visibleModelAnswerCard")) {
      return "모범답안";
    }
    return `알 수 없음: ${tokens.join(" ")}`;
  });
}

function strengthText(container: Element) {
  const card = container.getElementsByClassName(styles.visibleStrengthCard)[0];
  return card ? [card.children[0]?.textContent, card.children[1]?.textContent] : null;
}

function queryCard(container: Element, titleClass: string) {
  const cards = Array.from(container.getElementsByClassName(styles.coachMoveCard)).filter(
    (card) => card.getElementsByClassName(titleClass).length > 0
  );
  expect(cards.length).toBeLessThanOrEqual(1);
  return (cards[0] as HTMLElement | undefined) ?? null;
}

function coachCard(container: Element) {
  const card = queryCard(container, styles.coachMoveHeadline);
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function enrichmentCard(container: Element) {
  const card = queryCard(container, styles.enrichmentEyebrow);
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

// 원문과 고친 문장 비교 줄. pieces는 문장 안의 조각(span)마다 [글자, 클래스]다. 조각이 없으면 글자만 있다.
function swapRows(card: Element) {
  const swap = card.getElementsByClassName(styles.coachMoveSwap)[0];
  if (!swap) {
    return null;
  }
  return Array.from(swap.children).map((row) => ({
    classes: classTokens(row),
    label: row.children[0]?.textContent,
    sentenceClasses: row.children[1] ? classTokens(row.children[1]) : null,
    text: row.children[1]?.textContent,
    pieces: Array.from(row.children[1]?.children ?? []).map((piece) => [piece.textContent, classTokens(piece)])
  }));
}

function correctionItems(card: Element) {
  return Array.from(card.getElementsByClassName(styles.languageCorrectionItem)).map((item) => {
    const badge = item.children[0];
    const swap = item.getElementsByClassName(styles.languageCorrectionSwap)[0];
    return {
      badge: [badge.textContent, classTokens(badge)],
      swap: swap ? Array.from(swap.children).map((node) => [node.tagName, node.textContent]) : null,
      reason: textOfClass(item, styles.languageCorrectionReason)
    };
  });
}

function correctionToggle(card: Element) {
  const toggles = card.getElementsByClassName(styles.languageCorrectionToggle);
  expect(toggles.length).toBeLessThanOrEqual(1);
  const toggle = toggles[0] as HTMLButtonElement | undefined;
  return toggle ? { text: toggle.textContent, expanded: toggle.getAttribute("aria-expanded") } : null;
}

// ---------- 작업 052(문장 교정 미션 정답 가리기)에서 더한 도우미 ----------
// 문장 교정 미션의 교정 줄은 고친 표현을 처음에 가리고 줄마다 "고친 표현 보기" 버튼을 두며, 고친 문장 전체는
// "고친 문장 전체 보기"를 눌러야 보인다. 안내는 서버 안내 대신 화면의 문장 교정 안내다.
// "보인다"는 화면에 그려진 글자(hidden 속성, display:none, visibility:hidden, 닫힌 details의 본문은 뺀다)로 본다.
const REVEAL_ROW = /고친 표현 보기/;
const REVEAL_SENTENCE = /고친 문장 전체 보기/;
const LANGUAGE_FIX_INSTRUCTION = "이유를 보고 표시된 곳을 직접 고쳐 보세요. 막히면 고친 표현을 눌러 확인해요.";

function isSelfRendered(element: Element) {
  if (element instanceof HTMLElement && element.hidden) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function renderedChildren(element: Element) {
  const children = Array.from(element.childNodes);
  if (element.tagName === "DETAILS" && !(element as HTMLDetailsElement).open) {
    return children.filter((child) => child instanceof Element && child.tagName === "SUMMARY");
  }
  return children;
}

function renderedText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof Element) || !isSelfRendered(node)) {
    return "";
  }
  return renderedChildren(node).map(renderedText).join("");
}

// 보이는 요소마다 그 요소에 그려진 글자(앞뒤 빈칸 제외).
function renderedElementTexts(root: Element) {
  const texts: string[] = [];
  const walk = (node: Node) => {
    if (!(node instanceof Element) || !isSelfRendered(node)) {
      return;
    }
    texts.push(renderedText(node).trim());
    renderedChildren(node).forEach(walk);
  };
  renderedChildren(root).forEach(walk);
  return texts;
}

// 가려진 교정 줄의 기대값: 배지(글자·클래스), 고치기 전 표현(del), 보이는 화살표(aria-hidden "→") 수, 이유. 고친 표현은 없다.
const HIDDEN_CORRECTION_VIEWS = CORRECTION_VIEWS.map((view) => ({
  badge: view.badge,
  before: view.swap?.find(([tag]) => tag === "DEL")?.[1] ?? null,
  arrows: view.swap ? 1 : 0,
  reason: view.reason
}));

function hiddenCorrectionItems(card: Element) {
  return Array.from(card.getElementsByClassName(styles.languageCorrectionItem)).map((item) => {
    const badge = item.children[0];
    const del = item.querySelector("del");
    return {
      badge: [badge.textContent, classTokens(badge)],
      before: del ? renderedText(del) : null,
      arrows: Array.from(item.querySelectorAll('[aria-hidden="true"]')).filter((node) => renderedText(node) === "→")
        .length,
      reason: textOfClass(item, styles.languageCorrectionReason)
    };
  });
}

function correctionItemElements(card: Element) {
  return Array.from(card.getElementsByClassName(styles.languageCorrectionItem)) as HTMLElement[];
}

// 고친 표현이 있는 줄(빈칸뿐인 고친 표현은 뺀다)은 고친 표현이 보이지 않고, 그 줄에 "고친 표현 보기" 버튼이 하나 있다.
// 고친 표현이 없는 줄(뺄 말만 있거나 둘 다 없는 줄)의 버튼 여부는 명세에 없어 보지 않는다.
function expectAftersHidden(card: Element, corrections: FeedbackLanguageCorrection[]) {
  const items = correctionItemElements(card);
  expect(items).toHaveLength(corrections.length);
  corrections.forEach((correction, index) => {
    const after = correction.after?.trim();
    if (!after) {
      return;
    }
    expect(renderedElementTexts(items[index]), correction.reason).not.toContain(after);
    expect(within(items[index]).getAllByRole("button", { name: REVEAL_ROW }), correction.reason).toHaveLength(1);
  });
}

function expectAfterShown(item: Element, after: string) {
  expect(renderedElementTexts(item)).toContain(after);
}

function whyBox(card: Element) {
  const box = card.getElementsByClassName(styles.coachMoveWhyBox)[0];
  if (!box) {
    return null;
  }
  return { label: textOfClass(box, styles.coachMoveWhyLabel), text: textOfClass(box, styles.coachMoveWhy) };
}

// 표현 칩: 칩 안의 요소 [태그, 글자](글자는 화면 그대로), aria, 클래스, 비활성.
function chips(container: Element) {
  return Array.from(container.querySelectorAll("button")).map((button) => ({
    parts: Array.from(button.children).map((node) => [node.tagName, node.textContent]),
    ariaLabel: button.getAttribute("aria-label"),
    ariaPressed: button.getAttribute("aria-pressed"),
    classes: classTokens(button),
    disabled: button.disabled
  }));
}

// "다시 쓸 때" 칸: 안내, 문장 틀과 뜻, 넣어볼 표현.
function instructionBox(card: Element) {
  const box = byClass(card, styles.coachMoveInstructionBox);
  const phraseBox = box.getElementsByClassName(styles.coachMovePhraseBox)[0];
  return {
    label: textOfClass(box, styles.coachMoveInstructionLabel),
    instruction: textOfClass(box, styles.coachMoveInstruction),
    skeletonLabel: textOfClass(box, styles.coachMoveSkeletonLabel),
    skeleton: textOfClass(box, styles.coachMoveSkeleton),
    skeletonKo: textOfClass(box, styles.coachMoveSkeletonMeaning),
    phraseLabel: phraseBox ? textOfClass(phraseBox, styles.coachMovePhraseLabel) : null,
    phrases: phraseBox ? chips(phraseBox).map((chip) => chip.parts[0]?.[1]) : []
  };
}

function footerButtons(section: Element) {
  const footer = section.getElementsByClassName(styles.feedbackCompletionFooter)[0];
  if (!footer) {
    return null;
  }
  return Array.from(footer.querySelectorAll("button")).map((button) => [
    button.textContent,
    classTokens(button),
    button.disabled
  ]);
}

// 완료 카드(마칠 준비가 됐을 때 버튼 위 말풍선)의 제목. 카드가 없으면 null.
function completionHeadline(section: Element) {
  const cards = section.getElementsByClassName(styles.feedbackCompletionCard);
  expect(cards.length).toBeLessThanOrEqual(1);
  return cards[0] ? byClass(cards[0], styles.feedbackCompletionHeadline).textContent : null;
}

function expectTextsNotOnScreen(texts: string[]) {
  const pageText = document.body.textContent ?? "";
  texts.forEach((text) => expect(pageText, text).not.toContain(text));
}

function loadingOverlays() {
  return document.getElementsByClassName(styles.feedbackLoadingOverlay);
}

function loadingStage() {
  const overlay = byClass(document.body, styles.feedbackLoadingOverlay);
  return [textOfClass(overlay, styles.feedbackLoadingTitle), textOfClass(overlay, styles.feedbackLoadingMessage)];
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("[spec] AnswerLoop 피드백 화면(지금 동작 기록)", () => {
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
      Promise.resolve({ ...request, promptId, selectedPromptId: promptId, updatedAt: "2026-04-15T09:00:00Z" })
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

  it("[spec] 다시 쓰기가 필요한 피드백: 시도 번호, 잘한 점, 코치 피드백 구간(초점 제목, 이유, '다시 쓸 때' 안내, 문장 틀과 뜻, 넣어볼 표현 칩 6개까지)만 보인다. 비교(ADD_DETAIL)·성공 기준·보충 표현·마무리 표현·모범답안·완료 카드는 없고, 버튼은 '다시 써보기' 하나다. 진행 상태의 배지·제목·도움말·답변 취소 문구는 화면에 없다. 문구·구조·클래스·aria가 지금과 같다(스냅숏)", async () => {
    api.getSavedExpressions.mockResolvedValue([savedExpression(91, "Stay  In Shape")]);
    const user = await renderHome();
    await openPrompt(user);
    const section = await submitFirst(user, needsRewriteFull(1));

    expect(section.parentElement).toBe(screen.getByRole("main"));
    expect(classTokens(section)).toEqual(["page:premiumFeedbackTheme", "page:stage"]);
    expect(byClass(section, styles.feedbackAttemptMetaOnly).textContent).toBe("1번째 시도");

    const stack = summaryStack(section);
    expect(summaryParts(stack)).toEqual(["잘한 점", "코치 피드백"]);
    expect(strengthText(stack)).toEqual(["잘한 점", "운동하는 때를 분명하게 말했어요."]);

    const coach = coachCard(stack);
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("운동하는 이유를 한 문장 더해 보세요.");
    expect(swapRows(coach)).toBeNull();
    expect(correctionItems(coach)).toEqual([]);
    expect(whyBox(coach)).toEqual({ label: null, text: "이유가 있으면 답이 더 설득력 있어져요." });
    expect(coach.getElementsByClassName(styles.coachMoveSuccessBox)).toHaveLength(0);
    expect(instructionBox(coach)).toEqual({
      label: "다시 쓸 때",
      instruction: "왜 운동하는지 한 문장 더 써 보세요.",
      skeletonLabel: "문장 틀",
      skeleton: "I work out because ___.",
      skeletonKo: "저는 ___ 때문에 운동해요.",
      phraseLabel: "넣어볼 표현",
      phrases: ["it helps me relax", "stay in shape", "clear my head", "relieve stress", "feel refreshed", "sleep better"]
    });
    expect(chips(byClass(coach, styles.coachMovePhraseList))).toEqual([
      {
        parts: [
          ["STRONG", "it helps me relax"],
          ["SMALL", "긴장을 푸는 데 도움이 되다"],
          ["EM", "저장"]
        ],
        ariaLabel: "it helps me relax 저장",
        ariaPressed: "false",
        classes: ["page:coachMovePhraseChip"],
        disabled: false
      },
      {
        parts: [
          ["STRONG", "stay in shape"],
          ["EM", "저장됨"]
        ],
        ariaLabel: "stay in shape 저장 취소",
        ariaPressed: "true",
        classes: ["page:coachMovePhraseChip", "page:coachMovePhraseChipSaved"],
        disabled: false
      },
      {
        parts: [
          ["STRONG", "clear my head"],
          ["EM", "저장"]
        ],
        ariaLabel: "clear my head 저장",
        ariaPressed: "false",
        classes: ["page:coachMovePhraseChip"],
        disabled: false
      },
      {
        parts: [
          ["STRONG", "relieve stress"],
          ["EM", "저장"]
        ],
        ariaLabel: "relieve stress 저장",
        ariaPressed: "false",
        classes: ["page:coachMovePhraseChip"],
        disabled: false
      },
      {
        parts: [
          ["STRONG", "feel refreshed"],
          ["SMALL", "개운해지다"],
          ["EM", "저장"]
        ],
        ariaLabel: "feel refreshed 저장",
        ariaPressed: "false",
        classes: ["page:coachMovePhraseChip"],
        disabled: false
      },
      {
        parts: [
          ["STRONG", "sleep better"],
          ["EM", "저장"]
        ],
        ariaLabel: "sleep better 저장",
        ariaPressed: "false",
        classes: ["page:coachMovePhraseChip"],
        disabled: false
      }
    ]);

    expect(completionHeadline(section)).toBeNull();
    expect(section.querySelectorAll("img")).toHaveLength(0);
    expect(footerButtons(section)).toEqual([["다시 써보기", PRIMARY, false]]);
    expectTextsNotOnScreen([
      ...GENERATED_STATUS_TEXTS_NOT_SHOWN,
      "지금은 한 가지만 먼저 고쳐서 다시 써 보세요.",
      "다시 쓰기 메시지(화면에 없음)",
      "응답의 강점 목록(화면에 없음)",
      "응답의 다시 쓰기 과제(화면에 없음)",
      "이유 문장이 하나 있으면 성공(화면에 없음)",
      "성공 기준",
      "빈 표현(화면에 없음)",
      "build stamina",
      "완료 제목(화면에 없음)",
      "보충 초점(화면에 없음)",
      "unwind after work",
      "모범답안",
      "I go to the gym after work because it helps me relax."
    ]);

    expect(normalizeForSnapshot(section)).toMatchInlineSnapshot(`
      <section
        class="page:premiumFeedbackTheme page:stage"
      >
        <div
          class="page:feedbackBody"
        >
          <div
            class="page:feedbackAttemptMetaRow"
          >
            <span
              class="page:feedbackAttemptMetaOnly"
            >
              1번째 시도
            </span>
          </div>
          <div
            class="page:visibleFeedbackStack"
          >
            <section
              class="page:visibleStrengthCard"
            >
              <span>
                잘한 점
              </span>
              <p>
                운동하는 때를 분명하게 말했어요.
              </p>
            </section>
            <section
              class="page:coachMoveCard"
            >
              <h2
                class="page:coachMoveHeadline"
              >
                운동하는 이유를 한 문장 더해 보세요.
              </h2>
              <div
                class="page:coachMoveBody"
              >
                <div
                  class="page:coachMoveWhyBox"
                >
                  <p
                    class="page:coachMoveWhy"
                  >
                    이유가 있으면 답이 더 설득력 있어져요.
                  </p>
                </div>
              </div>
              <div
                class="page:coachMoveInstructionBox"
              >
                <span
                  class="page:coachMoveInstructionLabel"
                >
                  다시 쓸 때
                </span>
                <p
                  class="page:coachMoveInstruction"
                >
                  왜 운동하는지 한 문장 더 써 보세요.
                </p>
                <div
                  class="page:coachMoveSkeletonBox"
                >
                  <span
                    class="page:coachMoveSkeletonLabel"
                  >
                    문장 틀
                  </span>
                  <p
                    class="page:coachMoveSkeleton"
                  >
                    I work out because ___.
                  </p>
                  <p
                    class="page:coachMoveSkeletonMeaning"
                  >
                    저는 ___ 때문에 운동해요.
                  </p>
                </div>
                <div
                  class="page:coachMovePhraseBox"
                >
                  <span
                    class="page:coachMovePhraseLabel"
                  >
                    넣어볼 표현
                  </span>
                  <div
                    class="page:coachMovePhraseList"
                  >
                    <button
                      aria-label="it helps me relax 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        it helps me relax
                      </strong>
                      <small>
                        긴장을 푸는 데 도움이 되다
                      </small>
                      <em>
                        저장
                      </em>
                    </button>
                    <button
                      aria-label="stay in shape 저장 취소"
                      aria-pressed="true"
                      class="page:coachMovePhraseChip page:coachMovePhraseChipSaved"
                      type="button"
                    >
                      <strong>
                        stay in shape
                      </strong>
                      <em>
                        저장됨
                      </em>
                    </button>
                    <button
                      aria-label="clear my head 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        clear my head
                      </strong>
                      <em>
                        저장
                      </em>
                    </button>
                    <button
                      aria-label="relieve stress 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        relieve stress
                      </strong>
                      <em>
                        저장
                      </em>
                    </button>
                    <button
                      aria-label="feel refreshed 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        feel refreshed
                      </strong>
                      <small>
                        개운해지다
                      </small>
                      <em>
                        저장
                      </em>
                    </button>
                    <button
                      aria-label="sleep better 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        sleep better
                      </strong>
                      <em>
                        저장
                      </em>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        <div
          class="page:feedbackCompletionFooter page:stageFooter"
        >
          <button
            class="page:footerButtonRewrite"
            type="button"
          >
            다시 써보기
          </button>
        </div>
      </section>
    `);
  });

  // 작업 052에서 새 동작(고친 표현과 고친 문장 전체를 처음에 가리고 눌러서 본다)으로 고쳤다(03-main-decision.md 3번, 사용자 결정).
  // 고치기 전에는 고친 문장 줄·교정 줄의 고친 표현(strong)·서버 안내가 처음부터 보이는 것을 인라인 스냅숏 두 개로 찍었다.
  // 가리는 칸의 모양(버튼 자리, 글자)은 명세에 없어 스냅숏 대신, 그대로여야 할 부분(비교 '지금' 줄, 배지 글자·클래스,
  // 고치기 전 표현 del, aria-hidden 화살표, 이유, 접기 버튼, 이유 칸, '다시 쓸 때' 칸)을 같은 값으로 단언한다.
  it("[spec] 직접 고치기(LANGUAGE_FIX): '지금' 줄은 바뀐 부분이 표시되어 처음부터 보이고 '이번에 고친 문장'은 '고친 문장 전체 보기'를 눌러야 지금처럼 보인다. 이유에 '왜 고치나요'가 붙으며 문장 틀·넣어볼 표현은 없고, 안내는 화면의 문장 교정 안내다. 교정 줄은 종류별 배지·고치기 전 표현·화살표·이유가 보이고 고친 표현은 가려져 줄마다 '고친 표현 보기'로 보며, 4개까지 보이고 '교정 N개 더 보기'로 모두 보며 '추가 교정 접기'로 다시 접는다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    const section = await submitFirst(user, languageFix(1));

    const stack = summaryStack(section);
    expect(summaryParts(stack)).toEqual(["잘한 점", "코치 피드백"]);
    const coach = coachCard(stack);
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("과거 시제로 고쳐 보세요.");
    // 본문 안의 순서: 비교, 고친 표현 목록, 이유. 가리기 버튼의 자리는 명세에 없어 이 세 칸의 순서만 본다.
    expect(
      Array.from(byClass(coach, styles.coachMoveBody).children)
        .map((child) => classTokens(child))
        .filter((tokens) =>
          ["page:coachMoveSwap", "page:languageCorrectionList", "page:coachMoveWhyBox"].some((name) => tokens.includes(name))
        )
    ).toEqual([["page:coachMoveSwap"], ["page:languageCorrectionList"], ["page:coachMoveWhyBox"]]);
    const originalRow = {
      classes: ["page:coachMoveBeforeRow", "page:coachMoveSwapRow"],
      label: "지금",
      sentenceClasses: ["page:coachMoveBefore"],
      text: "I go to school yesterday.",
      pieces: [
        ["I ", []],
        ["go", ["page:coachMoveBeforeHighlight"]],
        [" to school yesterday.", []]
      ]
    };
    const revisedRow = {
      classes: ["page:coachMoveAfterRow", "page:coachMoveSwapRow"],
      label: "이번에 고친 문장",
      sentenceClasses: ["page:coachMoveAfter"],
      text: "I went to school yesterday.",
      pieces: [
        ["I ", []],
        ["went", ["page:coachMoveAfterHighlight"]],
        [" to school yesterday.", []]
      ]
    };
    // '지금' 줄은 처음부터 지금과 같다.
    expect(swapRows(coach)?.find((row) => row.label === "지금")).toEqual(originalRow);
    expect(renderedText(coach)).toContain("I go to school yesterday.");
    // 고친 문장 전체는 처음에 보이지 않고 '고친 문장 전체 보기' 버튼이 하나 있다.
    expect(renderedText(coach)).not.toContain("I went to school yesterday.");
    expect(within(coach).getAllByRole("button", { name: REVEAL_SENTENCE })).toHaveLength(1);

    // 교정 줄: 배지·고치기 전 표현·화살표·이유는 지금과 같고 고친 표현은 가려져 있다.
    expect(hiddenCorrectionItems(coach)).toEqual(HIDDEN_CORRECTION_VIEWS.slice(0, 4));
    expectAftersHidden(coach, SIX_CORRECTIONS.slice(0, 4));
    expect(correctionToggle(coach)).toEqual({ text: "교정 2개 더 보기", expanded: "false" });
    expect(byClass(coach, styles.languageCorrectionList).lastElementChild).toBe(
      screen.getByRole("button", { name: "교정 2개 더 보기" })
    );
    expect(whyBox(coach)).toEqual({ label: "왜 고치나요", text: "어제 한 일은 과거형으로 써야 자연스러워요." });
    expect(instructionBox(coach)).toEqual({
      label: "다시 쓸 때",
      instruction: LANGUAGE_FIX_INSTRUCTION,
      skeletonLabel: null,
      skeleton: null,
      skeletonKo: null,
      phraseLabel: null,
      phrases: []
    });
    expect(renderedText(coach)).not.toContain("고친 문장을 넣어 다시 써 보세요.");
    expectTextsNotOnScreen(["Yesterday, I ___.", "어제 저는 ___했어요.", "철자를 다시 확인해 보세요."]);

    await user.click(screen.getByRole("button", { name: "교정 2개 더 보기" }));
    expect(hiddenCorrectionItems(coach)).toEqual(HIDDEN_CORRECTION_VIEWS);
    expectAftersHidden(coach, SIX_CORRECTIONS);
    expect(correctionToggle(coach)).toEqual({ text: "추가 교정 접기", expanded: "true" });
    expect(byClass(coach, styles.languageCorrectionList).lastElementChild).toBe(
      screen.getByRole("button", { name: "추가 교정 접기" })
    );

    await user.click(screen.getByRole("button", { name: "추가 교정 접기" }));
    expect(hiddenCorrectionItems(coach)).toEqual(HIDDEN_CORRECTION_VIEWS.slice(0, 4));
    expectAftersHidden(coach, SIX_CORRECTIONS.slice(0, 4));
    expect(correctionToggle(coach)).toEqual({ text: "교정 2개 더 보기", expanded: "false" });

    // 첫 줄의 '고친 표현 보기'를 누르면 그 줄의 고친 표현만 보인다.
    const firstItem = correctionItemElements(coach)[0];
    await user.click(within(firstItem).getByRole("button", { name: REVEAL_ROW }));
    expectAfterShown(correctionItemElements(coach)[0], "went");
    expectAftersHidden(coach, [
      { ...SIX_CORRECTIONS[0], after: null },
      SIX_CORRECTIONS[1],
      SIX_CORRECTIONS[2],
      SIX_CORRECTIONS[3]
    ]);
    expect(renderedText(coach)).not.toContain("I went to school yesterday.");

    // '고친 문장 전체 보기'를 누르면 '이번에 고친 문장' 줄이 지금처럼(바뀐 부분 표시) 보인다.
    await user.click(within(coach).getByRole("button", { name: REVEAL_SENTENCE }));
    expect(swapRows(coach)?.find((row) => row.label === "이번에 고친 문장")).toEqual(revisedRow);
    expect(swapRows(coach)?.find((row) => row.label === "지금")).toEqual(originalRow);
    expect(renderedText(coach)).toContain("I went to school yesterday.");
  });

  // 작업 052에서 새 동작으로 고쳤다(03-main-decision.md 1·3번, 사용자 결정): 다시 쓰는 화면의 이전 피드백도 문장 교정 미션의 고친 표현을 가린다.
  it("[spec] 교정 목록을 펼친 상태는 다시 쓰기 화면의 피드백 요약에도 이어지고(고친 표현은 거기서도 가려져 있다), 새 시도의 피드백에서는 다시 접혀 있다. 고친 표현이 4개 이하면 더 보기 버튼이 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);
    let section = await submitFirst(user, languageFix(1));
    await user.click(screen.getByRole("button", { name: "교정 2개 더 보기" }));
    expect(correctionItems(section)).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    const panel = byClass(document.body, styles.rewriteFeedbackPanel);
    await user.click(within(panel).getByRole("button", { name: "피드백 보기" }));
    const body = byClass(panel, styles.rewriteFeedbackBody);
    expect(hiddenCorrectionItems(body)).toEqual(HIDDEN_CORRECTION_VIEWS);
    expectAftersHidden(body, SIX_CORRECTIONS);
    expect(correctionToggle(body)).toEqual({ text: "추가 교정 접기", expanded: "true" });

    api.submitFeedback.mockResolvedValueOnce(languageFix(2));
    await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
    await screen.findByText("2번째 시도");
    section = feedbackSection();
    expect(hiddenCorrectionItems(section)).toEqual(HIDDEN_CORRECTION_VIEWS.slice(0, 4));
    expectAftersHidden(section, SIX_CORRECTIONS.slice(0, 4));
    expect(correctionToggle(section)).toEqual({ text: "교정 2개 더 보기", expanded: "false" });

    section = await rewriteAndSubmit(user, "다시 써보기", languageFix(3, SIX_CORRECTIONS.slice(0, 4)));
    expect(hiddenCorrectionItems(section)).toEqual(HIDDEN_CORRECTION_VIEWS.slice(0, 4));
    expectAftersHidden(section, SIX_CORRECTIONS.slice(0, 4));
    expect(correctionToggle(section)).toBeNull();
    expect(screen.queryByRole("button", { name: /교정 .*더 보기/ })).not.toBeInTheDocument();
  });

  it("[spec] 원문과 고친 문장 비교: 초점 종류가 없거나 고치기 종류(EXPRESSION, grammar 등)이면 '지금'·'적용' 줄이 나오고, 바뀐 부분(더한 말, 뺀 말)만 표시된다. 길이가 많이 다르거나 같은 문장이면 표시 없이 글자만 나오고, 고친 문장이 비면 비교가 없다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    // 초점 종류가 없다: 비교가 나오고 직접 고치기가 아니라 '왜 고치나요'가 없으며 문장 틀이 보인다. 단어 수가 많이 달라 바뀐 부분 표시가 없다.
    let section = await submitFirst(
      user,
      makeFeedback({
        sessionId: "sess-511",
        attemptNo: 1,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: {
            focus: "문장을 완성해 보세요.",
            focusType: null,
            why: "주어와 동사가 있어야 뜻이 분명해요.",
            before: "go school",
            after: "I go to school every day by bus with my friends.",
            skeletonEn: "I ___ every day.",
            suggestedPhrases: ["by bus"]
          }
        }
      })
    );
    let coach = coachCard(section);
    expect(swapRows(coach)).toEqual([
      {
        classes: ["page:coachMoveBeforeRow", "page:coachMoveSwapRow"],
        label: "지금",
        sentenceClasses: ["page:coachMoveBefore"],
        text: "go school",
        pieces: []
      },
      {
        classes: ["page:coachMoveAfterRow", "page:coachMoveSwapRow"],
        label: "적용",
        sentenceClasses: ["page:coachMoveAfter"],
        text: "I go to school every day by bus with my friends.",
        pieces: []
      }
    ]);
    expect(whyBox(coach)).toEqual({ label: null, text: "주어와 동사가 있어야 뜻이 분명해요." });
    expect(instructionBox(coach)).toMatchObject({ skeleton: "I ___ every day.", phrases: ["by bus"] });

    // EXPRESSION: 더한 말만 고친 문장에 표시된다. 직접 고치기라 '왜 고치나요'가 붙고 문장 틀·표현이 없다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-511",
        attemptNo: 2,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: {
            focus: "느낌을 살려 보세요.",
            focusType: "EXPRESSION",
            why: "정도를 말하면 느낌이 살아나요.",
            before: "I like coffee.",
            after: "I really like coffee.",
            skeletonEn: "I really ___.",
            suggestedPhrases: ["really"]
          }
        }
      })
    );
    coach = coachCard(section);
    expect(swapRows(coach)).toEqual([
      {
        classes: ["page:coachMoveBeforeRow", "page:coachMoveSwapRow"],
        label: "지금",
        sentenceClasses: ["page:coachMoveBefore"],
        text: "I like coffee.",
        pieces: [
          ["I ", []],
          ["like coffee.", []]
        ]
      },
      {
        classes: ["page:coachMoveAfterRow", "page:coachMoveSwapRow"],
        label: "적용",
        sentenceClasses: ["page:coachMoveAfter"],
        text: "I really like coffee.",
        pieces: [
          ["I ", []],
          ["really ", ["page:coachMoveAfterHighlight"]],
          ["like coffee.", []]
        ]
      }
    ]);
    expect(whyBox(coach)).toEqual({ label: "왜 고치나요", text: "정도를 말하면 느낌이 살아나요." });
    expect(instructionBox(coach)).toMatchObject({ skeleton: null, phraseLabel: null, phrases: [] });

    // grammar(소문자): 뺀 말만 원문에 표시된다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-511",
        attemptNo: 3,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: {
            focus: "필요 없는 말을 빼 보세요.",
            focusType: "grammar",
            before: "I very like coffee a lot.",
            after: "I like coffee a lot."
          }
        }
      })
    );
    coach = coachCard(section);
    expect(swapRows(coach)).toEqual([
      {
        classes: ["page:coachMoveBeforeRow", "page:coachMoveSwapRow"],
        label: "지금",
        sentenceClasses: ["page:coachMoveBefore"],
        text: "I very like coffee a lot.",
        pieces: [
          ["I ", []],
          ["very ", ["page:coachMoveBeforeHighlight"]],
          ["like coffee a lot.", []]
        ]
      },
      {
        classes: ["page:coachMoveAfterRow", "page:coachMoveSwapRow"],
        label: "적용",
        sentenceClasses: ["page:coachMoveAfter"],
        text: "I like coffee a lot.",
        pieces: [
          ["I ", []],
          ["like coffee a lot.", []]
        ]
      }
    ]);
    expect(whyBox(coach)).toBeNull();

    // 고친 문장이 빈칸뿐: 비교가 없다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-511",
        attemptNo: 4,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: { focus: "동사 모양을 고쳐 보세요.", focusType: "MICRO_FIX", before: "I goed home.", after: "  " }
        }
      })
    );
    coach = coachCard(section);
    expect(swapRows(coach)).toBeNull();
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("동사 모양을 고쳐 보세요.");

    // 초점 종류가 고치기 종류가 아니면(ADD_DETAIL) 원문·고친 문장이 있어도 비교가 없다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-511",
        attemptNo: 5,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: { focus: "내용을 더해 보세요.", focusType: "add_detail", before: "I like it.", after: "I like it a lot." }
        }
      })
    );
    expect(swapRows(coachCard(section))).toBeNull();

    // 원문과 고친 문장이 같으면 두 줄 모두 표시 없이 글자만 나온다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-511",
        attemptNo: 6,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: { focus: "그대로 좋아요.", before: " I like it. ", after: "I like it." }
        }
      })
    );
    expect(swapRows(coachCard(section))).toEqual([
      {
        classes: ["page:coachMoveBeforeRow", "page:coachMoveSwapRow"],
        label: "지금",
        sentenceClasses: ["page:coachMoveBefore"],
        text: "I like it.",
        pieces: []
      },
      {
        classes: ["page:coachMoveAfterRow", "page:coachMoveSwapRow"],
        label: "적용",
        sentenceClasses: ["page:coachMoveAfter"],
        text: "I like it.",
        pieces: []
      }
    ]);
  }, 30000);

  it("[spec] 코치 피드백 구간의 제목·안내·문장 틀: 슬롯 제목 > 초점 > 루프 제목 > 기본 문구, 안내 > 다시 쓰기 과제 > 기본 문구, 문장 틀과 뜻은 코치 값 > 슬롯 값이다. 내용이 빈칸뿐이면 구간이 없고, visibleFeedback이 없거나 그 코치 미션이 없으면 응답의 coachMove를 쓴다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    // 슬롯(앞뒤 빈칸, 소문자)이 있으면 초점 대신 슬롯 제목, 문장 틀이 없으면 슬롯의 문장 틀과 뜻.
    let section = await submitFirst(
      user,
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 1,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: {
            focus: "초점(슬롯 제목에 가려 화면에 없음)",
            targetSlot: " reason ",
            instruction: "이유를 붙여 다시 써 보세요."
          }
        }
      })
    );
    let coach = coachCard(section);
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("이유 붙여보기");
    expect(instructionBox(coach)).toMatchObject({
      instruction: "이유를 붙여 다시 써 보세요.",
      skeleton: "I do this because ____.",
      skeletonKo: "저는 ____해서 이렇게 해요."
    });
    expectTextsNotOnScreen(["초점(슬롯 제목에 가려 화면에 없음)"]);

    // 코치의 문장 틀이 슬롯 문장 틀보다 앞서고, 코치의 뜻이 없으면 슬롯의 뜻을 쓴다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 2,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: { focus: "장소", targetSlot: "PLACE", skeletonEn: "At ___, I relax.", skeletonKo: "  " }
        }
      })
    );
    coach = coachCard(section);
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("어디에서인지 붙여보기");
    expect(instructionBox(coach)).toMatchObject({
      instruction: "전체를 완벽하게 바꾸려 하지 말고, 위 코치 포인트 하나만 반영해 다시 써 보세요.",
      skeleton: "At ___, I relax.",
      skeletonKo: "저는 ____에서 이 일을 해요."
    });

    // 모르는 슬롯, 빈칸뿐인 초점: 루프 제목(앞뒤 빈칸 지움). 안내가 없으면 다시 쓰기 과제(앞뒤 빈칸 지움). 문장 틀 칸이 없다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 3,
        rewriteChallenge: "  이유를 한 문장 더 써 보세요.  ",
        loop: { headline: "  루프가 정한 제목  " },
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: { focus: "  ", targetSlot: "UNKNOWN", why: "이유가 빠졌어요." }
        }
      })
    );
    coach = coachCard(section);
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("루프가 정한 제목");
    expect(whyBox(coach)).toEqual({ label: null, text: "이유가 빠졌어요." });
    expect(instructionBox(coach)).toEqual({
      label: "다시 쓸 때",
      instruction: "이유를 한 문장 더 써 보세요.",
      skeletonLabel: null,
      skeleton: null,
      skeletonKo: null,
      phraseLabel: null,
      phrases: []
    });

    // 고친 표현 하나뿐: 기본 제목과 기본 안내, 이유 칸 없음, 더 보기 없음.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 4,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          coachMove: { languageCorrections: [SIX_CORRECTIONS[0]] }
        }
      })
    );
    coach = coachCard(section);
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("지금은 한 가지만 먼저 고쳐서 다시 써 보세요.");
    expect(textOfClass(coach, styles.coachMoveInstruction)).toBe(
      "전체를 완벽하게 바꾸려 하지 말고, 위 코치 포인트 하나만 반영해 다시 써 보세요."
    );
    expect(whyBox(coach)).toBeNull();
    expect(correctionItems(coach)).toEqual([CORRECTION_VIEWS[0]]);
    expect(correctionToggle(coach)).toBeNull();

    // 코치 미션의 내용이 모두 빈칸뿐이면 코치 피드백 구간이 없다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 5,
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          strength: "잘한 점만 있어요.",
          coachMove: {
            focus: "  ",
            why: " ",
            before: "",
            after: "  ",
            instruction: " ",
            skeletonEn: "  ",
            suggestedPhrases: ["  ", { phrase: " " }],
            languageCorrections: []
          }
        }
      })
    );
    expect(summaryParts(summaryStack(section))).toEqual(["잘한 점"]);
    expect(queryCard(section, styles.coachMoveHeadline)).toBeNull();
    expect(footerButtons(section)).toEqual([["다시 써보기", PRIMARY, false]]);

    // visibleFeedback이 없는 응답: 응답의 coachMove와 strengths 첫째(앞뒤 빈칸 지움)를 쓴다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 6,
        strengths: ["  응답의 첫 강점  ", "응답의 둘째 강점(화면에 없음)"],
        coachMove: { focus: "응답의 코치 초점", instruction: "응답의 코치 안내" }
      })
    );
    expect(summaryParts(summaryStack(section))).toEqual(["잘한 점", "코치 피드백"]);
    expect(strengthText(section)).toEqual(["잘한 점", "응답의 첫 강점"]);
    coach = coachCard(section);
    expect(textOfClass(coach, styles.coachMoveHeadline)).toBe("응답의 코치 초점");
    expect(textOfClass(coach, styles.coachMoveInstruction)).toBe("응답의 코치 안내");
    expectTextsNotOnScreen(["응답의 둘째 강점(화면에 없음)"]);

    // visibleFeedback의 코치 미션이 응답의 coachMove보다 앞서고, 빈칸뿐인 잘한 점은 응답의 strengths로 넘어간다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 7,
        strengths: ["응답의 강점"],
        coachMove: { focus: "응답의 코치 초점(화면에 없음)" },
        visibleFeedback: {
          schemaVersion: 1,
          state: "NEEDS_REWRITE",
          strength: "  ",
          coachMove: { focus: "보이는 코치 초점" }
        }
      })
    );
    expect(strengthText(section)).toEqual(["잘한 점", "응답의 강점"]);
    expect(textOfClass(coachCard(section), styles.coachMoveHeadline)).toBe("보이는 코치 초점");
    expectTextsNotOnScreen(["응답의 코치 초점(화면에 없음)"]);

    // visibleFeedback에 코치 미션이 없으면 응답의 coachMove를 쓴다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 8,
        coachMove: { focus: "응답에만 있는 코치 초점" },
        visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", coachMove: null }
      })
    );
    expect(textOfClass(coachCard(section), styles.coachMoveHeadline)).toBe("응답에만 있는 코치 초점");

    // 잘한 점도 코치 미션도 없으면 피드백 요약은 빈 칸이고, 버튼은 그대로다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-521",
        attemptNo: 9,
        visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE" }
      })
    );
    expect(summaryStack(section).children).toHaveLength(0);
    expect(footerButtons(section)).toEqual([["다시 써보기", PRIMARY, false]]);
  }, 30000);

  it("[spec] 마칠 준비가 된 피드백: 잘한 점, 보충 표현 구간(4개까지), 가볍게 넣어볼 표현(숨김·자리표시·중복·제출한 답과 고친 답에 이미 있는 것은 뺌), 모범답안(접힘)이 이 순서로 보이고 코치 피드백 구간은 없다. 완료 카드 제목은 visibleFeedback의 완료 제목, 버튼은 '오늘 루프 완료하고 도장 받기'와 '이 내용 넣어서 다시 써 보기'다. 문구·구조·클래스·aria가 지금과 같다(스냅숏)", async () => {
    api.getSavedExpressions.mockResolvedValue([savedExpression(92, "stay consistent")]);
    const user = await renderHome();
    await openPrompt(user);
    const section = await submitFirst(user, readyFull(1));

    const stack = summaryStack(section);
    expect(summaryParts(stack)).toEqual(["잘한 점", "보충 표현", "가볍게 넣어볼 표현", "모범답안"]);
    expect(strengthText(stack)).toEqual(["잘한 점", "하고 싶은 말을 끝까지 썼어요."]);
    expect(queryCard(stack, styles.coachMoveHeadline)).toBeNull();

    const enrichment = enrichmentCard(stack);
    expect(Array.from(enrichment.children).map((child) => [child.tagName, classTokens(child)])).toEqual([
      ["SPAN", ["page:enrichmentEyebrow"]],
      ["H2", ["page:enrichmentHeadline"]],
      ["DIV", ["page:coachMoveWhyBox"]],
      ["DIV", ["page:coachMoveInstructionBox"]]
    ]);
    expect(textOfClass(enrichment, styles.enrichmentEyebrow)).toBe("더 풍부하게 써 보기 · 선택");
    expect(textOfClass(enrichment, styles.enrichmentHeadline)).toBe("언제 운동하는지 더해 보세요.");
    expect(whyBox(enrichment)).toEqual({ label: null, text: "때를 말하면 장면이 그려져요." });
    expect(instructionBox(enrichment)).toEqual({
      label: "다시 쓸 때",
      instruction: "운동하는 때를 한 구절 더해 보세요.",
      skeletonLabel: "문장 틀",
      skeleton: "I usually work out ___.",
      skeletonKo: "저는 보통 ___ 운동해요.",
      phraseLabel: "넣어볼 표현",
      phrases: ["after dinner", "in the morning", "on weekends", "twice a week"]
    });
    expect(chips(byClass(enrichment, styles.coachMovePhraseList))[1]).toEqual({
      parts: [
        ["STRONG", "in the morning"],
        ["SMALL", "아침에"],
        ["EM", "저장"]
      ],
      ariaLabel: "in the morning 저장",
      ariaPressed: "false",
      classes: ["page:coachMovePhraseChip"],
      disabled: false
    });

    const refinement = byClass(stack, styles.visibleExpressionCard);
    expect(textOfClass(refinement, styles.visibleExpressionLabel)).toBe("가볍게 넣어볼 표현");
    expect(chips(byClass(refinement, styles.visibleExpressionList))).toEqual([
      {
        parts: [
          ["STRONG", "make time for"],
          ["SMALL", "~할 시간을 내다"],
          ["EM", "저장"]
        ],
        ariaLabel: null,
        ariaPressed: null,
        classes: ["page:visibleExpressionChip"],
        disabled: false
      },
      {
        parts: [
          ["STRONG", "stay consistent"],
          ["SMALL", "꾸준히 하다"],
          ["EM", "저장됨"]
        ],
        ariaLabel: null,
        ariaPressed: null,
        classes: ["page:visibleExpressionChip", "page:visibleExpressionChipSaved"],
        disabled: false
      }
    ]);

    const modelAnswer = byClass(stack, styles.visibleModelAnswerCard);
    expect(modelAnswer.tagName).toBe("DETAILS");
    expect(modelAnswer).not.toHaveAttribute("open");
    expect(modelAnswer.querySelector("summary")?.textContent).toBe("참고용모범답안펼쳐보기");
    expect(Array.from(byClass(modelAnswer, styles.visibleModelAnswerBody).children).map((p) => p.textContent)).toEqual([
      "I usually go to the gym after work to relieve stress.",
      "저는 보통 스트레스를 풀려고 퇴근 후 헬스장에 가요."
    ]);

    expect(completionHeadline(section)).toBe("좋아요. 이대로 마무리해도 돼요.");
    const mascot = byClass(section, styles.feedbackCompletionMascot);
    expect(mascot.tagName).toBe("IMG");
    expect(mascot).toHaveAttribute("src", "/feedback/good.png");
    expect(mascot).toHaveAttribute("alt", "");
    expect(mascot).toHaveAttribute("width", "88");
    expect(mascot).toHaveAttribute("height", "88");
    expect(footerButtons(section)).toEqual([
      [FINISH_LABEL, PRIMARY, false],
      ["이 내용 넣어서 다시 써 보기", SECONDARY, false]
    ]);
    expectTextsNotOnScreen([
      ...GENERATED_STATUS_TEXTS_NOT_SHOWN,
      "코치 초점(화면에 없음)",
      "코치 안내(화면에 없음)",
      "서버의 완료 메시지",
      "응답의 강점 목록(화면에 없음)",
      "응답의 모범답안(화면에 없음)",
      "숨긴 표현(화면에 없음)",
      "자리표시가 든 표현(화면에 없음)",
      "같은 표현(화면에 없음)",
      "이미 쓴 표현(화면에 없음)",
      "고친 답에 있는 표현(화면에 없음)",
      "every day",
      COMPLETED_NOTE
    ]);

    expect(normalizeForSnapshot(section)).toMatchInlineSnapshot(`
      <section
        class="page:premiumFeedbackTheme page:stage"
      >
        <div
          class="page:feedbackBody"
        >
          <div
            class="page:feedbackAttemptMetaRow"
          >
            <span
              class="page:feedbackAttemptMetaOnly"
            >
              1번째 시도
            </span>
          </div>
          <div
            class="page:visibleFeedbackStack"
          >
            <section
              class="page:visibleStrengthCard"
            >
              <span>
                잘한 점
              </span>
              <p>
                하고 싶은 말을 끝까지 썼어요.
              </p>
            </section>
            <section
              class="page:coachMoveCard"
            >
              <span
                class="page:enrichmentEyebrow"
              >
                더 풍부하게 써 보기 · 선택
              </span>
              <h2
                class="page:enrichmentHeadline"
              >
                언제 운동하는지 더해 보세요.
              </h2>
              <div
                class="page:coachMoveWhyBox"
              >
                <p
                  class="page:coachMoveWhy"
                >
                  때를 말하면 장면이 그려져요.
                </p>
              </div>
              <div
                class="page:coachMoveInstructionBox"
              >
                <span
                  class="page:coachMoveInstructionLabel"
                >
                  다시 쓸 때
                </span>
                <p
                  class="page:coachMoveInstruction"
                >
                  운동하는 때를 한 구절 더해 보세요.
                </p>
                <div
                  class="page:coachMoveSkeletonBox"
                >
                  <span
                    class="page:coachMoveSkeletonLabel"
                  >
                    문장 틀
                  </span>
                  <p
                    class="page:coachMoveSkeleton"
                  >
                    I usually work out ___.
                  </p>
                  <p
                    class="page:coachMoveSkeletonMeaning"
                  >
                    저는 보통 ___ 운동해요.
                  </p>
                </div>
                <div
                  class="page:coachMovePhraseBox"
                >
                  <span
                    class="page:coachMovePhraseLabel"
                  >
                    넣어볼 표현
                  </span>
                  <div
                    class="page:coachMovePhraseList"
                  >
                    <button
                      aria-label="after dinner 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        after dinner
                      </strong>
                      <em>
                        저장
                      </em>
                    </button>
                    <button
                      aria-label="in the morning 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        in the morning
                      </strong>
                      <small>
                        아침에
                      </small>
                      <em>
                        저장
                      </em>
                    </button>
                    <button
                      aria-label="on weekends 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        on weekends
                      </strong>
                      <em>
                        저장
                      </em>
                    </button>
                    <button
                      aria-label="twice a week 저장"
                      aria-pressed="false"
                      class="page:coachMovePhraseChip"
                      type="button"
                    >
                      <strong>
                        twice a week
                      </strong>
                      <em>
                        저장
                      </em>
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <section
              class="page:visibleExpressionCard"
            >
              <span
                class="page:visibleExpressionLabel"
              >
                가볍게 넣어볼 표현
              </span>
              <div
                class="page:visibleExpressionList"
              >
                <button
                  class="page:visibleExpressionChip"
                  type="button"
                >
                  <strong>
                    make time for
                  </strong>
                  <small>
                    ~할 시간을 내다
                  </small>
                  <em>
                    저장
                  </em>
                </button>
                <button
                  class="page:visibleExpressionChip page:visibleExpressionChipSaved"
                  type="button"
                >
                  <strong>
                    stay consistent
                  </strong>
                  <small>
                    꾸준히 하다
                  </small>
                  <em>
                    저장됨
                  </em>
                </button>
              </div>
            </section>
            <details
              class="page:visibleModelAnswerCard"
            >
              <summary>
                <span>
                  <small>
                    참고용
                  </small>
                  <strong>
                    모범답안
                  </strong>
                </span>
                <span
                  class="page:visibleModelAnswerToggle"
                >
                  펼쳐보기
                </span>
              </summary>
              <div
                class="page:visibleModelAnswerBody"
              >
                <p>
                  I usually go to the gym after work to relieve stress.
                </p>
                <p>
                  저는 보통 스트레스를 풀려고 퇴근 후 헬스장에 가요.
                </p>
              </div>
            </details>
          </div>
        </div>
        <div
          class="page:feedbackCompletionFooter page:stageFooter"
        >
          <div
            class="page:feedbackCompletionCard"
          >
            <div
              class="page:feedbackCompletionSpeechRow"
            >
              <div
                class="page:feedbackCompletionBubble"
              >
                <strong
                  class="page:feedbackCompletionHeadline"
                >
                  좋아요. 이대로 마무리해도 돼요.
                </strong>
              </div>
              <div
                class="page:feedbackCompletionMascotFrame"
              >
                <img
                  alt=""
                  class="page:feedbackCompletionMascot"
                  height="88"
                  src="/feedback/good.png"
                  width="88"
                />
              </div>
            </div>
          </div>
          <button
            class="page:footerButtonRewrite"
            type="button"
          >
            오늘 루프 완료하고 도장 받기
          </button>
          <button
            class="page:footerButtonOutline page:footerButtonSecondary"
            type="button"
          >
            이 내용 넣어서 다시 써 보기
          </button>
        </div>
      </section>
    `);
  });

  it("[spec] 진행 상태를 서버가 주지 않을 때 마칠 준비가 된 피드백의 완료 카드 제목과 버튼 문구: 완료 메시지(앞뒤 빈칸 지움, 빈 글자면 빈 제목) > 기본 문구, loopComplete가 아니면 '루프 완료하기'·'다시 써보기'. visibleFeedback이 없으면 loop의 finish·READY_TO_FINISH로 마칠 준비를 보고 응답의 completion 보충 표현을 쓴다", async () => {
    const user = await renderHome();
    await openPrompt(user);

    // 완료 제목이 없으면 완료 메시지(앞뒤 빈칸 지움). visibleFeedback의 마무리 표현이 null이면 응답의 것, 모범답안이 빈칸뿐이면 응답의 것.
    let section = await submitFirst(
      user,
      makeFeedback({
        sessionId: "sess-611",
        attemptNo: 1,
        loopComplete: true,
        completionMessage: "  잘 마무리했어요.  ",
        refinementExpressions: [{ expression: "keep it up", meaningKo: "계속 이어 가다" }],
        modelAnswer: "I go to the gym to stay healthy.",
        modelAnswerKo: "  ",
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH", refinementExpressions: null, modelAnswer: "  " }
      })
    );
    expect(summaryParts(summaryStack(section))).toEqual(["가볍게 넣어볼 표현", "모범답안"]);
    expect(chips(byClass(section, styles.visibleExpressionList)).map((chip) => chip.parts)).toEqual([
      [
        ["STRONG", "keep it up"],
        ["SMALL", "계속 이어 가다"],
        ["EM", "저장"]
      ]
    ]);
    expect(
      Array.from(byClass(section, styles.visibleModelAnswerBody).children).map((p) => p.textContent)
    ).toEqual(["I go to the gym to stay healthy."]);
    expect(completionHeadline(section)).toBe("잘 마무리했어요.");
    expect(footerButtons(section)).toEqual([
      [FINISH_LABEL, PRIMARY, false],
      ["그래도 더 다듬어서 써보기", SECONDARY, false]
    ]);

    // 완료 메시지가 없으면 기본 문구. 보충 표현의 문장 틀이 빈칸뿐이면 보충 표현 구간이 없다. visibleFeedback의 마무리 표현이 빈 배열이면 응답의 것도 쓰지 않는다.
    section = await rewriteAndSubmit(
      user,
      "그래도 더 다듬어서 써보기",
      makeFeedback({
        sessionId: "sess-611",
        attemptNo: 2,
        loopComplete: true,
        refinementExpressions: [{ expression: "never shown", meaningKo: "응답의 마무리 표현(화면에 없음)" }],
        visibleFeedback: {
          schemaVersion: 1,
          state: "READY_TO_FINISH",
          completion: { headline: null, enrichment: { focus: "보충 초점(화면에 없음)", skeletonEn: "  " } },
          refinementExpressions: []
        }
      })
    );
    expect(summaryStack(section).children).toHaveLength(0);
    expect(completionHeadline(section)).toBe("지금 단계에서 마무리해도 괜찮아요.");
    expect(footerButtons(section)).toEqual([
      [FINISH_LABEL, PRIMARY, false],
      ["그래도 더 다듬어서 써보기", SECONDARY, false]
    ]);
    expectTextsNotOnScreen(["보충 초점(화면에 없음)", "응답의 마무리 표현(화면에 없음)"]);

    // 완료 메시지가 빈 글자면 제목도 빈 글자다.
    section = await rewriteAndSubmit(
      user,
      "그래도 더 다듬어서 써보기",
      makeFeedback({
        sessionId: "sess-611",
        attemptNo: 3,
        loopComplete: true,
        completionMessage: "",
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      })
    );
    expect(completionHeadline(section)).toBe("");
    expectTextsNotOnScreen(["지금 단계에서 마무리해도 괜찮아요."]);

    // loopComplete가 아니어도 visibleFeedback이 READY_TO_FINISH면 마칠 준비: '루프 완료하기'와 '다시 써보기', 제목은 다시 쓰기 쪽 기본 문구. 보충 표현 구간(안내·이유·뜻·표현이 없는 것)이 보인다.
    section = await rewriteAndSubmit(
      user,
      "그래도 더 다듬어서 써보기",
      makeFeedback({
        sessionId: "sess-611",
        attemptNo: 4,
        loopComplete: false,
        visibleFeedback: {
          schemaVersion: 1,
          state: "READY_TO_FINISH",
          completion: { enrichment: { focus: "언제 하는지 더해 보세요.", skeletonEn: "I do it ___." } }
        }
      })
    );
    expect(summaryParts(summaryStack(section))).toEqual(["보충 표현"]);
    const enrichment = enrichmentCard(section);
    expect(whyBox(enrichment)).toBeNull();
    expect(instructionBox(enrichment)).toEqual({
      label: "다시 쓸 때",
      instruction: null,
      skeletonLabel: "문장 틀",
      skeleton: "I do it ___.",
      skeletonKo: null,
      phraseLabel: null,
      phrases: []
    });
    expect(completionHeadline(section)).toBe("지금은 한 가지만 먼저 고쳐서 다시 써 보세요.");
    expect(footerButtons(section)).toEqual([
      ["루프 완료하기", PRIMARY, false],
      ["다시 써보기", SECONDARY, false]
    ]);

    // visibleFeedback이 없는 응답, loop.nextAction이 finish: 응답의 completion 보충 표현·strengths·마무리 표현·모범답안을 쓴다.
    // 완료 카드 제목에는 응답의 completion 제목을 쓰지 않고 완료 메시지(앞뒤 빈칸 지움)를 쓴다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-611",
        attemptNo: 5,
        loopComplete: false,
        completionMessage: "  응답의 완료 메시지  ",
        strengths: ["응답의 강점"],
        refinementExpressions: [{ expression: "on a regular basis", meaningKo: "정기적으로" }],
        modelAnswer: "I work out on a regular basis.",
        modelAnswerKo: "저는 정기적으로 운동해요.",
        loop: { nextAction: "finish", headline: "루프 제목(화면에 없음)" },
        completion: {
          headline: "응답의 완료 제목(화면에 없음)",
          enrichment: { focus: "응답의 보충 초점", skeletonEn: "I also ___.", suggestedPhrases: ["on weekends"] }
        }
      })
    );
    expect(summaryParts(summaryStack(section))).toEqual(["잘한 점", "보충 표현", "가볍게 넣어볼 표현", "모범답안"]);
    expect(textOfClass(enrichmentCard(section), styles.enrichmentHeadline)).toBe("응답의 보충 초점");
    expect(instructionBox(enrichmentCard(section)).phrases).toEqual(["on weekends"]);
    expect(completionHeadline(section)).toBe("응답의 완료 메시지");
    expect(footerButtons(section)).toEqual([
      ["루프 완료하기", PRIMARY, false],
      ["다시 써보기", SECONDARY, false]
    ]);
    expectTextsNotOnScreen(["응답의 완료 제목(화면에 없음)", "루프 제목(화면에 없음)"]);

    // loop.status가 READY_TO_FINISH여도 마칠 준비다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({ sessionId: "sess-611", attemptNo: 6, loop: { status: "READY_TO_FINISH" } })
    );
    expect(summaryStack(section).children).toHaveLength(0);
    expect(completionHeadline(section)).toBe("지금은 한 가지만 먼저 고쳐서 다시 써 보세요.");
    expect(footerButtons(section)).toEqual([
      ["루프 완료하기", PRIMARY, false],
      ["다시 써보기", SECONDARY, false]
    ]);

    // visibleFeedback에 completion이 있으면(보충 표현 없음) 응답의 completion 보충 표현을 쓰지 않는다.
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-611",
        attemptNo: 7,
        loopComplete: true,
        completion: { enrichment: { focus: "응답의 보충 초점(화면에 없음)", skeletonEn: "I ___." } },
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH", completion: { headline: "보이는 완료 제목" } }
      })
    );
    expect(queryCard(section, styles.enrichmentEyebrow)).toBeNull();
    expect(completionHeadline(section)).toBe("보이는 완료 제목");
    expect(footerButtons(section)).toEqual([
      [FINISH_LABEL, PRIMARY, false],
      ["그래도 더 다듬어서 써보기", SECONDARY, false]
    ]);
    expectTextsNotOnScreen(["응답의 보충 초점(화면에 없음)"]);

    // loop.status가 COMPLETE이고 nextAction이 rewrite면 마칠 준비가 아니다.
    section = await rewriteAndSubmit(
      user,
      "그래도 더 다듬어서 써보기",
      makeFeedback({ sessionId: "sess-611", attemptNo: 8, loop: { status: "COMPLETE", nextAction: "rewrite" } })
    );
    expect(completionHeadline(section)).toBeNull();
    expect(footerButtons(section)).toEqual([["다시 써보기", PRIMARY, false]]);
  }, 30000);

  it("[spec] 서버가 진행 상태(ui.loopStatus)를 주면 그 제목과 버튼 문구를 쓰고, 배지·도움말·취소 문구는 화면에 없다. 버튼 문구가 비면 기본 문구, 제목이 없으면 완료 메시지(그대로) > 피드백 수준 정보의 요약을 쓴다", async () => {
    const fullStatus: FeedbackLoopStatus = {
      badge: "서버 배지",
      headline: "서버 제목",
      supportText: "서버 도움말",
      rewriteCtaLabel: "서버가 정한 다시 쓰기",
      finishCtaLabel: "서버가 정한 완료",
      cancelCtaLabel: "서버가 정한 취소"
    };
    const statusWithoutHeadline = { rewriteCtaLabel: null, finishCtaLabel: null } as unknown as FeedbackLoopStatus;
    const user = await renderHome();
    await openPrompt(user);

    // 다시 쓰기가 필요: 다시 쓰기 버튼만 서버 문구. 완료 버튼 문구가 있어도 완료 버튼은 없다.
    let section = await submitFirst(
      user,
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 1,
        completionMessage: "완료 메시지(화면에 없음)",
        ui: { loopStatus: fullStatus },
        visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", coachMove: { focus: "코치 초점" } }
      })
    );
    expect(completionHeadline(section)).toBeNull();
    expect(footerButtons(section)).toEqual([["서버가 정한 다시 쓰기", PRIMARY, false]]);
    expectTextsNotOnScreen([
      "서버 배지",
      "서버 제목",
      "서버 도움말",
      "서버가 정한 완료",
      "서버가 정한 취소",
      "완료 메시지(화면에 없음)",
      ...GENERATED_STATUS_TEXTS_NOT_SHOWN
    ]);

    // 마칠 준비: 제목·두 버튼 모두 서버 문구. 보충 표현이 있어도 '이 내용 넣어서 다시 써 보기'가 아니다.
    section = await rewriteAndSubmit(
      user,
      "서버가 정한 다시 쓰기",
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 2,
        loopComplete: true,
        ui: { loopStatus: fullStatus },
        visibleFeedback: {
          schemaVersion: 1,
          state: "READY_TO_FINISH",
          completion: { enrichment: { focus: "보충 초점", skeletonEn: "I ___ too." } }
        }
      })
    );
    expect(summaryParts(summaryStack(section))).toEqual(["보충 표현"]);
    expect(completionHeadline(section)).toBe("서버 제목");
    expect(footerButtons(section)).toEqual([
      ["서버가 정한 완료", PRIMARY, false],
      ["서버가 정한 다시 쓰기", SECONDARY, false]
    ]);
    expectTextsNotOnScreen(["서버 배지", "서버 도움말", "서버가 정한 취소", "이 내용 넣어서 다시 써 보기"]);

    // visibleFeedback의 완료 제목이 서버 제목보다 앞선다.
    section = await rewriteAndSubmit(
      user,
      "서버가 정한 다시 쓰기",
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 3,
        loopComplete: true,
        ui: { loopStatus: fullStatus },
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH", completion: { headline: "보이는 완료 제목" } }
      })
    );
    expect(completionHeadline(section)).toBe("보이는 완료 제목");

    // 버튼 문구가 null이면 마칠 준비에서는 '루프 완료하기'·'그래도 더 다듬어서 써보기'.
    section = await rewriteAndSubmit(
      user,
      "서버가 정한 다시 쓰기",
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 4,
        loopComplete: true,
        ui: { loopStatus: { headline: "서버 제목", rewriteCtaLabel: null, finishCtaLabel: null } },
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      })
    );
    expect(completionHeadline(section)).toBe("서버 제목");
    expect(footerButtons(section)).toEqual([
      ["루프 완료하기", PRIMARY, false],
      ["그래도 더 다듬어서 써보기", SECONDARY, false]
    ]);

    // 다시 쓰기가 필요하고 버튼 문구가 null이면 '다시 써보기'.
    section = await rewriteAndSubmit(
      user,
      "그래도 더 다듬어서 써보기",
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 5,
        ui: { loopStatus: { headline: "서버 제목", rewriteCtaLabel: null } },
        visibleFeedback: { schemaVersion: 1, state: "NEEDS_REWRITE", coachMove: { focus: "코치 초점" } }
      })
    );
    expect(footerButtons(section)).toEqual([["다시 써보기", PRIMARY, false]]);

    // 제목이 없고 완료 메시지도 없으면 피드백 수준 정보의 요약(loopComplete).
    section = await rewriteAndSubmit(
      user,
      "다시 써보기",
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 6,
        loopComplete: true,
        ui: { loopStatus: statusWithoutHeadline },
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      })
    );
    expect(completionHeadline(section)).toBe("핵심이 잘 전달됐어요. 여기서 마무리해도 충분해요.");
    expect(footerButtons(section)).toEqual([
      ["루프 완료하기", PRIMARY, false],
      ["그래도 더 다듬어서 써보기", SECONDARY, false]
    ]);

    // loopComplete가 아니면(마칠 준비는 visibleFeedback) 다듬기 쪽 요약.
    section = await rewriteAndSubmit(
      user,
      "그래도 더 다듬어서 써보기",
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 7,
        loopComplete: false,
        ui: { loopStatus: statusWithoutHeadline },
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      })
    );
    expect(completionHeadline(section)).toBe("표현을 한 번 더 다듬으면 훨씬 자연스러워져요.");

    // 제목이 없고 완료 메시지가 있으면 완료 메시지를 앞뒤 빈칸까지 그대로 쓴다.
    section = await rewriteAndSubmit(
      user,
      "그래도 더 다듬어서 써보기",
      makeFeedback({
        sessionId: "sess-621",
        attemptNo: 8,
        loopComplete: true,
        completionMessage: "  서버 완료 메시지  ",
        ui: { loopStatus: statusWithoutHeadline },
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      })
    );
    expect(completionHeadline(section)).toBe("  서버 완료 메시지  ");
  }, 30000);

  it("[spec] 루프 마치기: 누르면 세션 id·게스트 id로 완료를 부르고, 기다리는 동안 버튼이 '완료하는 중...'으로 비활성이며 다시 쓰기 버튼은 그대로다. 완료 화면 뒤 '마지막 피드백 다시 보기'에서는 '완료 화면으로 돌아가기' 하나만 있고 보충 표현 구간에 완료 안내가 붙으며, 누르면 완료를 다시 부르지 않고 완료 화면으로 간다(스냅숏)", async () => {
    const finishing = deferred<{ sessionId: string; status: "COMPLETED" }>();
    api.completeFeedbackSession.mockImplementationOnce(() => finishing.promise);
    const user = await renderHome();
    await openPrompt(user);
    let section = await submitFirst(user, readyFull(1, "sess-701"));

    await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
    expect(footerButtons(section)).toEqual([
      ["완료하는 중...", PRIMARY, true],
      ["이 내용 넣어서 다시 써 보기", SECONDARY, false]
    ]);
    expect(api.completeFeedbackSession.mock.calls).toEqual([["sess-701", GUEST_ID]]);

    await act(async () => {
      finishing.resolve({ sessionId: "sess-701", status: "COMPLETED" });
    });
    const heading = await screen.findByRole("heading", { name: "루프를 완주했어요!" });
    expect(heading.nextElementSibling?.textContent).toBe("서버의 완료 메시지");

    await user.click(screen.getByRole("button", { name: "마지막 피드백 다시 보기" }));
    section = feedbackSection();
    expect(footerButtons(section)).toEqual([["완료 화면으로 돌아가기", PRIMARY, false]]);
    expect(completionHeadline(section)).toBe("좋아요. 이대로 마무리해도 돼요.");
    const enrichment = enrichmentCard(section);
    const note = enrichment.lastElementChild as HTMLElement;
    expect(note.tagName).toBe("P");
    expect(classTokens(note)).toEqual(["page:coachMoveWhy"]);
    expect(note.textContent).toBe(COMPLETED_NOTE);
    expectTextsNotOnScreen(["이 내용 넣어서 다시 써 보기"]);
    expect(normalizeForSnapshot(byClass(section, styles.feedbackCompletionFooter))).toMatchInlineSnapshot(`
      <div
        class="page:feedbackCompletionFooter page:stageFooter"
      >
        <div
          class="page:feedbackCompletionCard"
        >
          <div
            class="page:feedbackCompletionSpeechRow"
          >
            <div
              class="page:feedbackCompletionBubble"
            >
              <strong
                class="page:feedbackCompletionHeadline"
              >
                좋아요. 이대로 마무리해도 돼요.
              </strong>
            </div>
            <div
              class="page:feedbackCompletionMascotFrame"
            >
              <img
                alt=""
                class="page:feedbackCompletionMascot"
                height="88"
                src="/feedback/good.png"
                width="88"
              />
            </div>
          </div>
        </div>
        <button
          class="page:footerButtonRewrite"
          type="button"
        >
          완료 화면으로 돌아가기
        </button>
      </div>
    `);

    await user.click(screen.getByRole("button", { name: "완료 화면으로 돌아가기" }));
    expect(await screen.findByRole("heading", { name: "루프를 완주했어요!" })).toBeInTheDocument();
    expect(api.completeFeedbackSession).toHaveBeenCalledTimes(1);
  });

  it("[spec] 루프 마치기가 실패하면 오류의 메시지를, Error가 아니면 '지금은 루프를 완료할 수 없어요.'를 보여 주고 피드백 화면과 버튼이 그대로다. 다시 눌러 성공하면 오류가 지워지고 완료 화면으로 간다", async () => {
    api.completeFeedbackSession
      .mockRejectedValueOnce(new Error("오늘은 루프를 완료할 수 없어요."))
      .mockRejectedValueOnce("network down");
    const user = await renderHome();
    await openPrompt(user);
    let section = await submitFirst(user, readyFull(1, "sess-702"));

    await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
    const error = await screen.findByText("오늘은 루프를 완료할 수 없어요.");
    expect(classTokens(error)).toEqual(["page:errorText"]);
    section = feedbackSection();
    expect(footerButtons(section)).toEqual([
      [FINISH_LABEL, PRIMARY, false],
      ["이 내용 넣어서 다시 써 보기", SECONDARY, false]
    ]);

    await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
    expect(await screen.findByText("지금은 루프를 완료할 수 없어요.")).toBeInTheDocument();
    expect(screen.queryByText("오늘은 루프를 완료할 수 없어요.")).not.toBeInTheDocument();
    expect(footerButtons(feedbackSection())).toEqual([
      [FINISH_LABEL, PRIMARY, false],
      ["이 내용 넣어서 다시 써 보기", SECONDARY, false]
    ]);

    await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
    expect(await screen.findByRole("heading", { name: "루프를 완주했어요!" })).toBeInTheDocument();
    expect(document.getElementsByClassName(styles.errorText)).toHaveLength(0);
    expect(api.completeFeedbackSession).toHaveBeenCalledTimes(3);
  });

  it.each([
    {
      name: "loopComplete이고 완료 메시지가 없으면 피드백 수준 정보의 마무리 문구",
      feedback: makeFeedback({
        sessionId: "sess-711",
        loopComplete: true,
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      }),
      finishLabel: FINISH_LABEL,
      subcopy: "오늘 루프를 충분히 좋은 흐름으로 마무리했어요."
    },
    {
      name: "loopComplete가 아니고(마칠 준비는 visibleFeedback) 완료 메시지가 없으면 다듬기 쪽 마무리 문구",
      feedback: makeFeedback({
        sessionId: "sess-712",
        loopComplete: false,
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      }),
      finishLabel: "루프 완료하기",
      subcopy: "한 번 더 다듬으면 더 자연스러운 답변이 될 수 있어요."
    },
    {
      name: "완료 메시지가 있으면 앞뒤 빈칸을 지운 완료 메시지",
      feedback: makeFeedback({
        sessionId: "sess-713",
        loopComplete: true,
        completionMessage: "  오늘도 잘 썼어요.  ",
        visibleFeedback: { schemaVersion: 1, state: "READY_TO_FINISH" }
      }),
      finishLabel: FINISH_LABEL,
      subcopy: "오늘도 잘 썼어요."
    }
  ])("[spec] 완료 화면의 안내 문구: $name", async ({ feedback, finishLabel, subcopy }) => {
    const user = await renderHome();
    await openPrompt(user);
    await submitFirst(user, feedback);
    await user.click(screen.getByRole("button", { name: finishLabel }));
    const heading = await screen.findByRole("heading", { name: "루프를 완주했어요!" });
    expect(heading.nextElementSibling?.tagName).toBe("P");
    expect(heading.nextElementSibling?.textContent).toBe(subcopy);
  });

  it("[spec] 피드백 기다림 화면: 제출하는 동안 걸음 화면 바로 뒤에 status 영역(aria-live polite, aria-busy)으로 보이고, 첫 답은 첫 답용, 다시 쓴 답은 다시 쓰기용 네 단계 문구가 2.3초마다 돌아가며 바뀐다. 제출할 때마다 첫 단계부터 시작하고, 끝나거나 실패하면 사라진다(스냅숏)", async () => {
    const user = await renderHome();
    await openPrompt(user);
    await user.type(answerInput(), FIRST_ANSWER);
    expect(loadingOverlays()).toHaveLength(0);

    // 단계 바꾸기는 setInterval이다. 사용자 조작(setTimeout)은 그대로 두고 setInterval만 가짜로 돌린다.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const first = deferred<Feedback>();
    api.submitFeedback.mockImplementationOnce(() => first.promise);
    await user.click(screen.getByRole("button", { name: "답변 제출하기" }));

    const overlay = byClass(document.body, styles.feedbackLoadingOverlay);
    expect(overlay).toBe(screen.getByRole("status"));
    expect(overlay).toHaveAttribute("aria-live", "polite");
    expect(overlay).toHaveAttribute("aria-busy", "true");
    expect(overlay.parentElement).toBe(screen.getByRole("main"));
    expect((overlay.previousElementSibling as Element).contains(answerInput())).toBe(true);
    expect(loadingStage()).toEqual(INITIAL_STAGES[0]);
    expect(normalizeForSnapshot(overlay)).toMatchInlineSnapshot(`
      <div
        aria-busy="true"
        aria-live="polite"
        class="page:feedbackLoadingOverlay"
        role="status"
      >
        <div
          class="page:feedbackLoadingCard"
        >
          <div
            class="page:feedbackLoadingIllustration"
          >
            <div
              aria-hidden="true"
              class="page:feedbackLoadingHalo"
            />
            <div
              class="page:feedbackLoadingMascotFrame"
            >
              <img
                alt=""
                class="page:feedbackLoadingMascot"
                height="132"
                src="/coach/mascote-face.png"
                width="132"
              />
            </div>
          </div>
          <strong
            class="page:feedbackLoadingTitle"
          >
            피드백을 만들고 있어요
          </strong>
          <p
            class="page:feedbackLoadingMessage"
          >
            답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요.
          </p>
          <div
            aria-hidden="true"
            class="page:feedbackLoadingDots"
          >
            <span
              class="page:feedbackLoadingDot"
              style="animation-delay: 0s;"
            />
            <span
              class="page:feedbackLoadingDot"
              style="animation-delay: 0.14s;"
            />
            <span
              class="page:feedbackLoadingDot"
              style="animation-delay: 0.28s;"
            />
          </div>
        </div>
      </div>
    `);

    advance(2299);
    expect(loadingStage()).toEqual(INITIAL_STAGES[0]);
    advance(1);
    expect(loadingStage()).toEqual(INITIAL_STAGES[1]);
    advance(2300);
    expect(loadingStage()).toEqual(INITIAL_STAGES[2]);
    advance(2300);
    expect(loadingStage()).toEqual(INITIAL_STAGES[3]);
    advance(2300);
    expect(loadingStage()).toEqual(INITIAL_STAGES[0]);

    await act(async () => {
      first.resolve(needsRewrite(1, "이유를 더해 보세요."));
    });
    expect(loadingOverlays()).toHaveLength(0);
    expect(screen.getByText("1번째 시도")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    const second = deferred<Feedback>();
    api.submitFeedback.mockImplementationOnce(() => second.promise);
    await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
    const rewriteOverlay = byClass(document.body, styles.feedbackLoadingOverlay);
    expect((rewriteOverlay.previousElementSibling as Element).contains(rewriteInput())).toBe(true);
    expect(loadingStage()).toEqual(REWRITE_STAGES[0]);
    advance(2300);
    expect(loadingStage()).toEqual(REWRITE_STAGES[1]);
    advance(2300);
    expect(loadingStage()).toEqual(REWRITE_STAGES[2]);
    advance(2300);
    expect(loadingStage()).toEqual(REWRITE_STAGES[3]);
    advance(2300);
    expect(loadingStage()).toEqual(REWRITE_STAGES[0]);
    advance(2300);
    expect(loadingStage()).toEqual(REWRITE_STAGES[1]);

    await act(async () => {
      second.reject(new Error("network down"));
    });
    expect(loadingOverlays()).toHaveLength(0);
    expect(screen.getByText("지금은 피드백을 생성할 수 없어요. 잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
    expect(rewriteInput()).toBeInTheDocument();

    const third = deferred<Feedback>();
    api.submitFeedback.mockImplementationOnce(() => third.promise);
    await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
    expect(loadingStage()).toEqual(REWRITE_STAGES[0]);
    advance(2300);
    expect(loadingStage()).toEqual(REWRITE_STAGES[1]);
    await act(async () => {
      third.resolve(needsRewrite(2, "예시를 더해 보세요."));
    });
    expect(loadingOverlays()).toHaveLength(0);
    expect(screen.getByText("2번째 시도")).toBeInTheDocument();
  }, 20000);

  it("[spec] 다시 쓰기 화면의 '이전 피드백': 처음엔 접혀 있고 '피드백 보기'를 누르면 피드백 화면과 똑같은 피드백 요약이 나오며 '피드백 숨기기'로 접힌다(다시 쓰기가 필요한 피드백, 마칠 준비가 된 피드백 모두)", async () => {
    api.getSavedExpressions.mockResolvedValue([savedExpression(93, "stay in shape"), savedExpression(94, "stay consistent")]);
    const user = await renderHome();
    await openPrompt(user);

    for (const [index, step] of [
      { label: "다시 써보기", next: needsRewriteFull(1) },
      { label: "이 내용 넣어서 다시 써 보기", next: readyFull(2) }
    ].entries()) {
      if (index === 0) {
        await submitFirst(user, step.next);
      } else {
        api.submitFeedback.mockResolvedValueOnce(step.next);
        await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
        await screen.findByText(`${step.next.attemptNo}번째 시도`);
      }
      const onFeedbackScreen = normalizeForSnapshot(summaryStack(feedbackSection())).outerHTML;

      await user.click(screen.getByRole("button", { name: step.label }));
      expect(rewriteInput().value).toBe(FIRST_ANSWER);
      const panel = byClass(document.body, styles.rewriteFeedbackPanel);
      expect(panel.tagName).toBe("SECTION");
      expect(byClass(panel, styles.rewriteFeedbackHeader).querySelector("strong")?.textContent).toBe("이전 피드백");
      expect(panel.getElementsByClassName(styles.rewriteFeedbackBody)).toHaveLength(0);
      expect(document.getElementsByClassName(styles.visibleFeedbackStack)).toHaveLength(0);

      await user.click(within(panel).getByRole("button", { name: "피드백 보기" }));
      const body = byClass(panel, styles.rewriteFeedbackBody);
      expect(body.children).toHaveLength(1);
      expect(normalizeForSnapshot(body.children[0] as HTMLElement).outerHTML).toBe(onFeedbackScreen);

      await user.click(within(panel).getByRole("button", { name: "피드백 숨기기" }));
      expect(panel.getElementsByClassName(styles.rewriteFeedbackBody)).toHaveLength(0);
      expect(within(panel).getByRole("button", { name: "피드백 보기" })).toBeInTheDocument();
    }
  }, 20000);

  it("[spec] 피드백 없이 피드백 단계가 되면(로그인 뒤 되살린 초안) '답변을 제출하면 여기에 피드백이 표시됩니다.'만 보이고 버튼 줄이 없다(스냅숏)", async () => {
    const draft: HomeDraftSnapshot = {
      selectedDifficulty: "I",
      selectedPromptId: PROMPT_1.id,
      sessionId: "",
      answer: FIRST_ANSWER,
      rewrite: "",
      lastSubmittedAnswer: "",
      feedback: null,
      step: "feedback"
    };
    window.sessionStorage.setItem("writeloop_post_login_home_draft", JSON.stringify(draft));
    await renderHome();

    const placeholder = await screen.findByText("답변을 제출하면 여기에 피드백이 표시됩니다.");
    const section = placeholder.closest("section") as HTMLElement;
    expect(section.parentElement).toBe(screen.getByRole("main"));
    expect(section.getElementsByClassName(styles.feedbackCompletionFooter)).toHaveLength(0);
    expect(normalizeForSnapshot(section)).toMatchInlineSnapshot(`
      <section
        class="page:premiumFeedbackTheme page:stage"
      >
        <p
          class="page:placeholderText"
        >
          답변을 제출하면 여기에 피드백이 표시됩니다.
        </p>
      </section>
    `);
  });
});
