// [spec] qa 테스트(작업 037-07 코치 도우미, 리팩터링). AI 코치 도우미(표현 물어보기)를 answer-loop.tsx 밖의 훅과 컴포넌트로 옮기기 전의 "지금 동작"을 기록한다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// 완료 화면의 축하 효과(canvas-confetti)는 jsdom에 canvas 그리기가 없어 아무것도 하지 않는 가짜로 둔다.
// 화면 바깥에서 동작만 보므로, 안쪽을 훅과 컴포넌트로 나눠도 같은 테스트가 그대로 통과해야 한다.
//
// 코치 사용량(사용 확인 결과)은 화면에 직접 나오지 않고, 사용량의 관련 질문이 완료 화면의 "다음 질문 추천"이 된다.
// 그래서 사용량이 무엇인지는 완료 화면의 추천 질문으로 본다. 아래 질문 목록은 세 경우의 추천이 서로 다르게 나오도록 골랐다.
//   - 사용량이 없으면(지금 질문 기준): PROMPT_1에서 [PROMPT_3, PROMPT_5]
//   - 사용 확인 응답 USAGE_API(관련 질문 [PROMPT_4, PROMPT_3, 없는 id, PROMPT_1])면: PROMPT_1에서 [PROMPT_3, PROMPT_4]
//   - 사용 확인이 실패해 대체 계산(buildLocalCoachUsage)이면: PROMPT_1에서 [PROMPT_5, PROMPT_2]
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import { buildLocalCoachHelp } from "../../lib/coach";
import type {
  AuthUser,
  CoachHelpResponse,
  CoachUsageCheckResponse,
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
  default: ({ href, children, className }: { href: string; children?: ReactNode; className?: string }) => (
    <a href={href} className={className}>
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
  id: 4701,
  email: "coach-assistant-spec@example.com",
  displayName: "코치도우미",
  admin: false
};

// 로그인한 사용자도 게스트 id를 가진다(사용 확인 요청에 실린다). 형식 검사(guest-[a-z0-9-]{18,})를 통과하는 값.
const GUEST_ID = "guest-coach-spec-0000000000000001";

const TODAY: TodayWritingStatus = {
  date: "2026-04-15",
  completed: false,
  completedSessions: 0,
  startedSessions: 0,
  streakDays: 3,
  totalAnswerSessions: 10,
  totalWrittenSentences: 120
};

// 빠른 질문 칩이 질문에 맞춰 바뀌는지 보려고 첫 질문에만 코치 프로필(ROUTINE, DIRECT)을 넣었다.
const PROMPT_1: Prompt = {
  id: "prompt-coach-1",
  topic: "Health",
  topicCategory: "Daily life",
  topicDetail: "Exercise",
  difficulty: "I",
  questionEn: "How do you stay healthy these days?",
  questionKo: "요즘 어떻게 건강을 지키나요?",
  tip: "",
  coachProfile: {
    primaryCategory: "ROUTINE",
    secondaryCategories: [],
    preferredExpressionFamilies: [],
    avoidFamilies: [],
    starterStyle: "DIRECT",
    notes: ""
  }
};

const PROMPT_2: Prompt = {
  id: "prompt-coach-2",
  topic: "Travel",
  topicCategory: "Leisure",
  topicDetail: "Trips",
  difficulty: "I",
  questionEn: "Where would you like to travel next?",
  questionKo: "다음에 어디로 여행 가고 싶나요?",
  tip: ""
};

const PROMPT_3: Prompt = {
  id: "prompt-coach-3",
  topic: "Fitness",
  topicCategory: "Daily life",
  topicDetail: "Exercise",
  difficulty: "B",
  questionEn: "What kind of exercise would you recommend to a friend?",
  questionKo: "친구에게 어떤 운동을 추천하겠어요?",
  tip: ""
};

const PROMPT_4: Prompt = {
  id: "prompt-coach-4",
  topic: "Work",
  topicCategory: "Work",
  topicDetail: "Office",
  difficulty: "I",
  questionEn: "What do you usually do during your lunch break?",
  questionKo: "점심시간에 보통 무엇을 하나요?",
  tip: ""
};

const PROMPT_5: Prompt = {
  id: "prompt-coach-5",
  topic: "Food",
  topicCategory: "Daily life",
  topicDetail: "Food",
  difficulty: "I",
  questionEn: "What is your favorite home-cooked meal?",
  questionKo: "가장 좋아하는 집밥은 무엇인가요?",
  tip: ""
};

// 난이도 "쉬움"의 오늘의 질문. 전체 질문 목록(getPrompts)에는 없다.
const PROMPT_A1: Prompt = {
  id: "prompt-coach-a1",
  topic: "Hobby",
  topicCategory: "Leisure",
  topicDetail: "Hobbies",
  difficulty: "A",
  questionEn: "What hobby do you want to start this year?",
  questionKo: "올해 어떤 취미를 시작하고 싶나요?",
  tip: ""
};

const PROMPT_A2: Prompt = {
  id: "prompt-coach-a2",
  topic: "Music",
  topicCategory: "Leisure",
  topicDetail: "Music",
  difficulty: "A",
  questionEn: "What song do you listen to when you feel tired?",
  questionKo: "피곤할 때 어떤 노래를 듣나요?",
  tip: ""
};

const ALL_PROMPTS = [PROMPT_1, PROMPT_2, PROMPT_3, PROMPT_4, PROMPT_5];

const DAILY_I: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "I",
  prompts: [PROMPT_1, PROMPT_2]
};

const DAILY_A: DailyPromptRecommendation = {
  recommendedDate: "2026-04-15",
  difficulty: "A",
  prompts: [PROMPT_A1, PROMPT_A2]
};

// 코치 추천 응답. 앞뒤 빈칸이 있는 표현, 빈칸뿐인 표현, 앞뒤 빈칸이 있는 상호작용 id를 일부러 넣었다.
const COACH_HELP: CoachHelpResponse = {
  promptId: PROMPT_1.id,
  userQuestion: "체력을 기르고 싶다",
  coachReply: "운동 습관을 말할 때 쓰기 좋은 표현이에요.",
  interactionId: "  coach-int-501  ",
  expressions: [
    {
      id: "ce-1",
      expression: "  build up my stamina  ",
      meaningKo: "체력을 기르다",
      usageTip: "운동 목표를 말할 때 써요.",
      example: "I want to build up my stamina.",
      tags: ["health"]
    },
    {
      id: "ce-2",
      expression: "work out regularly",
      meaningKo: "규칙적으로 운동하다",
      usageTip: "습관을 말할 때 써요.",
      example: "I work out regularly.",
      tags: null
    },
    {
      id: "ce-3",
      expression: "   ",
      meaningKo: "빈칸뿐인 표현",
      usageTip: "",
      example: "",
      tags: []
    }
  ]
};

// 카드 구조 스냅숏용 응답. 앞뒤 빈칸이 없고, 둘째 표현은 팁·예문이 비었다.
const COACH_HELP_CARDS: CoachHelpResponse = {
  promptId: PROMPT_1.id,
  userQuestion: "체력을 기르고 싶다",
  coachReply: "체력 이야기를 할 때 바로 쓸 수 있는 표현이에요.",
  interactionId: "coach-int-502",
  expressions: [
    {
      id: "cc-1",
      expression: "build up my stamina",
      meaningKo: "체력을 기르다",
      usageTip: "운동 목표를 말할 때 써요.",
      example: "I want to build up my stamina.",
      tags: ["health"]
    },
    {
      id: "cc-2",
      expression: "stay active",
      meaningKo: "활동적으로 지내다",
      usageTip: "",
      example: "",
      tags: null
    }
  ]
};

// 다시 쓰기에서 새로 받는 응답. 상호작용 id가 없다.
const COACH_HELP_REWRITE: CoachHelpResponse = {
  promptId: PROMPT_1.id,
  userQuestion: "이유를 더하고 싶다",
  coachReply: "이유를 한 문장 더할 때 쓰기 좋은 표현이에요.",
  expressions: [
    {
      id: "ce-9",
      expression: "because it clears my head",
      meaningKo: "머리가 맑아져서",
      usageTip: "이유를 말할 때 써요.",
      example: "I run because it clears my head.",
      tags: []
    }
  ]
};

// 표현이 하나도 없는 응답.
const COACH_HELP_EMPTY: CoachHelpResponse = {
  promptId: PROMPT_1.id,
  userQuestion: "아무 표현이나",
  coachReply: "지금은 추천할 표현을 찾지 못했어요.",
  expressions: []
};

const USAGE_API: CoachUsageCheckResponse = {
  promptId: PROMPT_1.id,
  praiseMessage: "추천 표현을 잘 살렸어요.",
  usedExpressions: [],
  unusedExpressions: [],
  relatedPromptIds: [PROMPT_4.id, PROMPT_3.id, "prompt-unknown", PROMPT_1.id]
};

const USAGE_NO_RELATED: CoachUsageCheckResponse = {
  promptId: PROMPT_1.id,
  praiseMessage: "",
  usedExpressions: [],
  unusedExpressions: [],
  relatedPromptIds: []
};

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";
const REWRITE_PLACEHOLDER = "피드백을 반영한 영어 답변을 다시 작성해 주세요.";
const COACH_PLACEHOLDER = '예: "근력을 키우고 싶다"를 어떻게 말해?';
const DIALOG_NAME = "AI에게 표현 물어보기";
const EMPTY_QUESTION_ERROR = "AI에게 물어볼 표현 질문을 입력해 주세요.";
const FINISH_LABEL = "오늘 루프 완료하고 도장 받기";

// 질문 1(코치 프로필 ROUTINE, DIRECT)의 빠른 질문 칩: ROUTINE 질문의 앞 6개.
const PROMPT_1_QUICK_QUESTIONS = [
  "주말엔 보통 친구를 만난다고 어떻게 말해?",
  "집에서 쉬는 편이라고 자연스럽게 말하고 싶어",
  "주말 루틴 첫 문장 뭐라고 시작해?",
  "빈도를 자연스럽게 말하는 표현 알려줘",
  "아침에는 운동하고 오후에는 쉰다고 어떻게 말해?",
  "가끔 가족이랑 시간을 보낸다고 어떻게 말해?"
];

// 코치 프로필이 없는 질문(또는 질문이 없을 때)의 빠른 질문 칩: GENERAL 질문의 앞 6개.
const GENERAL_QUICK_QUESTIONS = [
  '"근력을 키우고 싶다"를 어떻게 말해?',
  "이 답변 첫 문장 뭐라고 시작해?",
  "내 의견을 부드럽게 시작하는 표현 알려줘",
  "짧은 예시 하나 넣고 싶은데 어떻게 말해?",
  "이유를 한 문장으로 붙이는 표현 알려줘",
  "문장을 더 자연스럽게 이어주는 표현 알려줘"
];

type User = ReturnType<typeof userEvent.setup>;

function feedbackFor(prompt: Prompt, sessionId: string, attemptNo: number, loopComplete: boolean): Feedback {
  return {
    promptId: prompt.id,
    sessionId,
    attemptNo,
    loopComplete,
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

function draftFor(prompt: Prompt, partial: Partial<WritingDraft>): WritingDraft {
  return {
    promptId: prompt.id,
    draftType: "ANSWER",
    updatedAt: "2026-04-15T09:00:00Z",
    selectedDifficulty: prompt.difficulty,
    selectedPromptId: prompt.id,
    sessionId: "",
    answer: "",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    ...partial
  };
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

// 창을 열고 닫으면 앱은 다음 화면 프레임(requestAnimationFrame)에 포커스를 옮긴다(열면 창 안으로, 닫으면 연 버튼으로).
// 그 프레임 전에 다음 조작을 하면 느린 컴퓨터에서 타자 도중 포커스가 넘어가 입력이 엉뚱한 곳에 들어간다.
// 그래서 다음 조작 전에 프레임 하나를 걸고 기다린다. jsdom은 한 프레임의 콜백을 건 순서대로 부르므로, 이게 불리면 앱의 포커스 옮기기도 끝났다.
// openCoach·closeCoach는 포커스가 간 것을 직접 기다린다. 이 함수는 제출·질문 바꾸기·초안 복구처럼 다른 조작으로 창이 닫혀
// 포커스를 돌려받을 버튼이 화면에서 사라졌을 수 있는 곳에 쓴다.
async function waitForNextFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

// page.module.css의 클래스는 테스트에서 "_<이름>_<파일 해시>"로 나온다. 이 파일의 클래스는 "page:<이름>"으로 바꿔 읽기 쉽게 하고,
// 다른 CSS 파일의 클래스는 그대로 둔다(다른 파일로 옮겨지면 해시가 달라져 드러난다).
// 클래스 문자열 안의 빈칸 수와 순서는 화면에 영향이 없으므로 정렬해 비교한다.
const PAGE_CLASS_SUFFIX = (styles.coachOverlay as string).slice("_coachOverlay".length);

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

// 첫 화면을 렌더하고 저장된 표현 불러오기(로그인 확인 뒤)가 끝날 때까지 기다린다.
async function renderHome() {
  const user = userEvent.setup();
  render(<AnswerLoop />);
  await waitFor(() => expect(api.getSavedExpressions).toHaveBeenCalled());
  await flush();
  return user;
}

// 난이도 화면에서 입문을 골라 질문 목록을 열고, 질문을 골라 답 쓰기 화면으로 간다.
async function openPromptFromDifficulty(user: User, prompt: Prompt = PROMPT_1) {
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

function triggerButton() {
  return screen.getByRole("button", { name: "AI 코치 열기" });
}

function queryDialog() {
  return screen.queryByRole("dialog", { name: DIALOG_NAME });
}

function coachInput(dialog: HTMLElement) {
  return within(dialog).getByPlaceholderText(COACH_PLACEHOLDER) as HTMLTextAreaElement;
}

function bubbles() {
  return document.getElementsByClassName(styles.coachTriggerBubble);
}

function quickChips(dialog: HTMLElement) {
  return Array.from(dialog.getElementsByClassName(styles.coachQuickChip)).map((node) => node.textContent);
}

function coachErrors(dialog: HTMLElement) {
  return Array.from(dialog.getElementsByClassName(styles.coachError)).map((node) => node.textContent);
}

// 표현 카드마다 [표현, 뜻, 팁, 예문, 버튼 글자들]. 글자는 화면 그대로(앞뒤 빈칸 포함)다.
function expressionCards(dialog: HTMLElement) {
  return Array.from(dialog.getElementsByClassName(styles.coachExpressionCard)).map((card) => {
    const top = byClass(card, styles.coachExpressionTop);
    return [
      top.children[0]?.textContent,
      top.children[1]?.textContent,
      card.querySelector(":scope > p")?.textContent,
      card.querySelector(":scope > small")?.textContent,
      Array.from(card.querySelectorAll("button")).map((button) => button.textContent)
    ];
  });
}

function insertButton(dialog: HTMLElement, meaningKo: string) {
  const card = within(dialog).getByText(meaningKo).closest("article") as HTMLElement;
  return within(card).getByRole("button", { name: "문장에 넣기" });
}

// 코치 창을 열고 질문 입력칸에 포커스가 갈 때까지 기다린다(그 전에 다른 칸에 입력하면 포커스가 옮겨 가 입력이 섞인다).
async function openCoach(user: User) {
  await user.click(triggerButton());
  const dialog = screen.getByRole("dialog", { name: DIALOG_NAME });
  await waitFor(() => expect(coachInput(dialog)).toHaveFocus());
  return dialog;
}

async function closeCoach(user: User) {
  const trigger = triggerButton();
  await user.click(screen.getByRole("button", { name: "AI 코치 닫기" }));
  expect(queryDialog()).not.toBeInTheDocument();
  await waitFor(() => expect(trigger).toHaveFocus());
}

async function ask(user: User, dialog: HTMLElement, question: string, help: CoachHelpResponse = COACH_HELP) {
  api.requestCoachHelp.mockResolvedValueOnce(help);
  const input = coachInput(dialog);
  await user.clear(input);
  await user.type(input, question);
  await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
  await within(dialog).findByText(help.coachReply);
}

// 추천을 받은 뒤 입력칸을 비우고 다시 눌러 안내 문구를 띄우고, 다음 질문을 써 둔다(보내지 않는다).
async function leaveCoachErrorAndQuestion(user: User, dialog: HTMLElement, nextQuestion: string) {
  await user.clear(coachInput(dialog));
  await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
  expect(coachErrors(dialog)).toEqual([EMPTY_QUESTION_ERROR]);
  await user.type(coachInput(dialog), nextQuestion);
}

function expectCoachEmpty(dialog: HTMLElement) {
  expect(coachInput(dialog).value).toBe("");
  expect(dialog.getElementsByClassName(styles.coachResult)).toHaveLength(0);
  expect(dialog.getElementsByClassName(styles.coachReplyCard)).toHaveLength(0);
  expect(coachErrors(dialog)).toEqual([]);
}

async function submitInitial(user: User, feedback: Feedback) {
  api.submitFeedback.mockResolvedValueOnce(feedback);
  await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
  await screen.findByText(`${feedback.attemptNo}번째 시도`);
}

async function submitRewrite(user: User, feedback: Feedback) {
  api.submitFeedback.mockResolvedValueOnce(feedback);
  await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
  await screen.findByText(`${feedback.attemptNo}번째 시도`);
}

async function finishLoop(user: User) {
  await user.click(screen.getByRole("button", { name: FINISH_LABEL }));
  await screen.findByRole("heading", { name: "루프를 완주했어요!" });
  await flush();
}

function recommendedQuestions() {
  return Array.from(document.getElementsByClassName(styles.completionRecommendationCard)).map(
    (card) => card.querySelector("strong")?.textContent
  );
}

function recommendationCard(prompt: Prompt) {
  return screen.getByText(prompt.questionEn, { selector: "strong" }).closest("button") as HTMLButtonElement;
}

describe("[spec] AnswerLoop 코치 도우미(지금 동작 기록)", () => {
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
      Promise.resolve({ ...request, promptId, selectedPromptId: promptId, updatedAt: "2026-04-15T09:00:00Z" })
    );
    api.deleteWritingDraft.mockResolvedValue(undefined);
    api.trackDailyPromptClick.mockResolvedValue(undefined);
    api.requestCoachHelp.mockResolvedValue(COACH_HELP);
    api.checkCoachExpressionUsage.mockResolvedValue(USAGE_NO_RELATED);
    api.completeFeedbackSession.mockImplementation((sessionId: string) =>
      Promise.resolve({ sessionId, status: "COMPLETED" })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    document.body.style.overflow = "";
  });

  it("[spec] 답 쓰기 화면의 'AI 코치 열기' 버튼과 말풍선의 문구·구조·클래스·aria가 지금과 같다. 말풍선은 창이 닫혀 있고 입력이 비었을(빈칸뿐 포함) 때만 보이고, aria-expanded가 열림 상태를 따른다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);

    const trigger = triggerButton();
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const dock = trigger.parentElement as HTMLElement;
    expect(classTokens(dock)).toEqual(["page:coachTriggerDock"]);
    // 열기 버튼 자리는 답 입력칸 묶음 안, 단어 수 표시 다음이다.
    expect(dock.parentElement).toBe(answerInput().parentElement);
    expect(classTokens(dock.previousElementSibling as Element)).toEqual(["page:composerMetaBadges"]);
    expect(normalizeForSnapshot(dock)).toMatchInlineSnapshot(`
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
            src="/coach/mascote-face.png"
          />
        </button>
      </div>
    `);

    await user.type(answerInput(), "I");
    expect(bubbles()).toHaveLength(0);
    await user.clear(answerInput());
    expect(bubbles()).toHaveLength(1);
    await user.type(answerInput(), "   ");
    expect(answerInput().value).toBe("   ");
    expect(bubbles()).toHaveLength(1);

    const dialog = await openCoach(user);
    expect(dialog).toBeInTheDocument();
    expect(triggerButton()).toHaveAttribute("aria-expanded", "true");
    expect(bubbles()).toHaveLength(0);
    await closeCoach(user);
    expect(triggerButton()).toHaveAttribute("aria-expanded", "false");
    expect(bubbles()).toHaveLength(1);

    await user.type(answerInput(), "I swim.");
    expect(bubbles()).toHaveLength(0);
    await openCoach(user);
    expect(bubbles()).toHaveLength(0);
    await closeCoach(user);
    expect(bubbles()).toHaveLength(0);
  });

  it("[spec] 코치 창의 문구·구조·클래스·aria가 지금과 같다(스냅숏). 창은 화면(main) 안에서 걸음 화면 뒤, 맨 끝에 그린다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "coach-assistant-title");
    expect(document.querySelectorAll("#coach-assistant-title")).toHaveLength(1);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    const overlay = dialog.parentElement as HTMLElement;
    const main = screen.getByRole("main");
    expect(overlay.parentElement).toBe(main);
    expect(main.lastElementChild).toBe(overlay);
    // 바로 앞은 답 쓰기 걸음 화면(입력칸이 든 section)이다.
    expect((overlay.previousElementSibling as Element).contains(answerInput())).toBe(true);
    expect(normalizeForSnapshot(overlay)).toMatchInlineSnapshot(`
      <div
        class="page:coachOverlay"
      >
        <section
          aria-labelledby="coach-assistant-title"
          aria-modal="true"
          class="page:coachDialog"
          role="dialog"
        >
          <button
            aria-label="AI 코치 닫기"
            class="page:coachDialogClose"
            type="button"
          >
            ×
          </button>
          <section
            class="page:coachPanel page:coachPanelDialog"
          >
            <div
              class="page:coachPanelHeader"
            >
              <div>
                <span
                  class="page:coachEyebrow"
                >
                  AI 코치
                </span>
                <strong
                  id="coach-assistant-title"
                >
                  AI에게 표현 물어보기
                </strong>
                <p>
                  사용자가 질문을 하면, 바로 쓸 수 있는 표현과 짧은 예문을 추천해 드려요.
                </p>
              </div>
            </div>
            <div
              class="page:coachPromptArea"
            >
              <textarea
                class="page:coachPromptInput"
                placeholder="예: "근력을 키우고 싶다"를 어떻게 말해?"
                rows="2"
              />
              <div
                class="page:coachQuickActions"
              >
                <button
                  class="page:coachQuickChip"
                  type="button"
                >
                  주말엔 보통 친구를 만난다고 어떻게 말해?
                </button>
                <button
                  class="page:coachQuickChip"
                  type="button"
                >
                  집에서 쉬는 편이라고 자연스럽게 말하고 싶어
                </button>
                <button
                  class="page:coachQuickChip"
                  type="button"
                >
                  주말 루틴 첫 문장 뭐라고 시작해?
                </button>
                <button
                  class="page:coachQuickChip"
                  type="button"
                >
                  빈도를 자연스럽게 말하는 표현 알려줘
                </button>
                <button
                  class="page:coachQuickChip"
                  type="button"
                >
                  아침에는 운동하고 오후에는 쉰다고 어떻게 말해?
                </button>
                <button
                  class="page:coachQuickChip"
                  type="button"
                >
                  가끔 가족이랑 시간을 보낸다고 어떻게 말해?
                </button>
              </div>
            </div>
            <div
              class="page:coachActionRow"
            >
              <button
                class="page:coachPrimaryButton"
                type="button"
              >
                표현 추천받기
              </button>
              <span
                class="page:coachActionMeta"
              >
                표현을 그대로 붙이지 말고, 내 문장 안에서 직접 풀어 써보세요.
              </span>
            </div>
          </section>
        </section>
      </div>
    `);
  });

  it("[spec] 열면 본문 스크롤이 잠기고 질문 입력칸에 포커스가 간다. 닫기 버튼·배경 클릭·Escape로 닫히고 스크롤은 앞 값으로, 포커스는 열기 버튼으로 돌아간다. 창 안을 눌러서는 닫히지 않는다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    document.body.style.overflow = "auto";
    const trigger = triggerButton();

    // 닫기 버튼
    await user.click(trigger);
    let dialog = screen.getByRole("dialog", { name: DIALOG_NAME });
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() => expect(coachInput(dialog)).toHaveFocus());
    await user.click(within(dialog).getByRole("button", { name: "AI 코치 닫기" }));
    expect(queryDialog()).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("auto");
    await waitFor(() => expect(trigger).toHaveFocus());

    // 창 안(제목)을 누르면 그대로, 배경을 누르면 닫힌다.
    await user.click(trigger);
    dialog = screen.getByRole("dialog", { name: DIALOG_NAME });
    await waitFor(() => expect(coachInput(dialog)).toHaveFocus());
    await user.click(within(dialog).getByText(DIALOG_NAME));
    expect(queryDialog()).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(dialog.parentElement as HTMLElement);
    expect(queryDialog()).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
    await waitFor(() => expect(trigger).toHaveFocus());

    // Escape: 입력칸에 포커스가 있을 때와 본문에 있을 때 모두 닫힌다.
    await user.click(trigger);
    dialog = screen.getByRole("dialog", { name: DIALOG_NAME });
    await waitFor(() => expect(coachInput(dialog)).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(queryDialog()).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("auto");
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    dialog = screen.getByRole("dialog", { name: DIALOG_NAME });
    await waitFor(() => expect(coachInput(dialog)).toHaveFocus());
    await user.click(within(dialog).getByText(DIALOG_NAME));
    expect(coachInput(dialog)).not.toHaveFocus();
    await user.keyboard("{Escape}");
    expect(queryDialog()).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("auto");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("[spec] 빠른 질문 칩은 질문에 맞춰 만든 6개이고, 누르면 입력칸이 그 질문이 되며 그대로 추천받으면 그 질문으로 요청한다. 다른 질문에서는 그 질문의 칩이 나온다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);

    expect(quickChips(dialog)).toEqual(PROMPT_1_QUICK_QUESTIONS);
    await user.type(coachInput(dialog), "지울 질문");
    await user.click(within(dialog).getByRole("button", { name: PROMPT_1_QUICK_QUESTIONS[2] }));
    expect(coachInput(dialog).value).toBe(PROMPT_1_QUICK_QUESTIONS[2]);
    expect(api.requestCoachHelp).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
    await within(dialog).findByText(COACH_HELP.coachReply);
    expect(api.requestCoachHelp.mock.calls).toEqual([
      [{ promptId: PROMPT_1.id, question: PROMPT_1_QUICK_QUESTIONS[2], attemptType: "INITIAL" }]
    ]);
    await closeCoach(user);

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await user.click(await screen.findByText(PROMPT_2.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    dialog = await openCoach(user);
    expect(quickChips(dialog)).toEqual(GENERAL_QUICK_QUESTIONS);
  });

  it("[spec] 표현 추천받기: 질문이 비었거나 빈칸뿐이면 안내 문구가 나오고 요청하지 않는다. 요청은 질문 id, 앞뒤 빈칸을 지운 질문, 세션 없음, 빈 답이면 답 없음, INITIAL로 보내고, 기다리는 동안 버튼이 '표현을 고르는 중...'으로 비활성이며 앞의 안내 문구는 지워진다. 답을 쓰고 다시 추천받으면 다듬은 답을 보내고 새 응답으로 바꿔 보여 준다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);

    const askButton = within(dialog).getByRole("button", { name: "표현 추천받기" });
    expect(askButton).toBeEnabled();
    await user.click(askButton);
    expect(coachErrors(dialog)).toEqual([EMPTY_QUESTION_ERROR]);
    const error = within(dialog).getByText(EMPTY_QUESTION_ERROR);
    expect(error.tagName).toBe("P");
    expect(classTokens(error)).toEqual(["page:coachError"]);

    await user.type(coachInput(dialog), "   ");
    await user.click(askButton);
    expect(coachErrors(dialog)).toEqual([EMPTY_QUESTION_ERROR]);
    expect(api.requestCoachHelp).not.toHaveBeenCalled();

    const pending = deferred<CoachHelpResponse>();
    api.requestCoachHelp.mockImplementationOnce(() => pending.promise);
    await user.clear(coachInput(dialog));
    await user.type(coachInput(dialog), "  체력을 기르고 싶다  ");
    await user.click(askButton);

    const waitingButton = within(dialog).getByRole("button", { name: "표현을 고르는 중..." });
    expect(waitingButton).toBe(askButton);
    expect(waitingButton).toBeDisabled();
    expect(coachErrors(dialog)).toEqual([]);
    expect(api.requestCoachHelp.mock.calls).toEqual([
      [{ promptId: PROMPT_1.id, question: "체력을 기르고 싶다", attemptType: "INITIAL" }]
    ]);
    const firstRequest = api.requestCoachHelp.mock.calls[0][0] as Record<string, unknown>;
    expect(firstRequest.sessionId).toBeUndefined();
    expect(firstRequest.answer).toBeUndefined();

    await act(async () => {
      pending.resolve(COACH_HELP);
    });
    expect(within(dialog).getByRole("button", { name: "표현 추천받기" })).toBeEnabled();
    expect(within(dialog).getByText(COACH_HELP.coachReply)).toBeInTheDocument();
    expect(expressionCards(dialog).map((card) => card[1])).toEqual(["체력을 기르다", "규칙적으로 운동하다", "빈칸뿐인 표현"]);
    // 추천받은 뒤에도 입력칸의 질문은 그대로다.
    expect(coachInput(dialog).value).toBe("  체력을 기르고 싶다  ");
    await closeCoach(user);

    await user.type(answerInput(), "  I swim twice a week.  ");
    dialog = await openCoach(user);
    expect(within(dialog).getByText(COACH_HELP.coachReply)).toBeInTheDocument();
    api.requestCoachHelp.mockResolvedValueOnce(COACH_HELP_REWRITE);
    await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
    await within(dialog).findByText(COACH_HELP_REWRITE.coachReply);
    expect(api.requestCoachHelp.mock.calls[1]).toEqual([
      { promptId: PROMPT_1.id, question: "체력을 기르고 싶다", answer: "I swim twice a week.", attemptType: "INITIAL" }
    ]);
    expect((api.requestCoachHelp.mock.calls[1][0] as Record<string, unknown>).sessionId).toBeUndefined();
    expect(within(dialog).queryByText(COACH_HELP.coachReply)).not.toBeInTheDocument();
    expect(expressionCards(dialog).map((card) => card[0])).toEqual(["because it clears my head"]);
  });

  it("[spec] 추천을 기다리는 동안 창을 닫았다 열어도 기다리는 중 표시가 남는다. 그동안 다른 질문으로 바꾸면 버튼이 '표현 추천받기'로 돌아오고, 늦게 온 응답은 바꾼 질문의 코치 창에 나타난다", async () => {
    const pending = deferred<CoachHelpResponse>();
    api.requestCoachHelp.mockImplementationOnce(() => pending.promise);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await user.type(coachInput(dialog), "체력을 기르고 싶다");
    await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
    expect(within(dialog).getByRole("button", { name: "표현을 고르는 중..." })).toBeDisabled();
    await closeCoach(user);

    dialog = await openCoach(user);
    expect(within(dialog).getByRole("button", { name: "표현을 고르는 중..." })).toBeDisabled();
    await closeCoach(user);

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await user.click(await screen.findByText(PROMPT_2.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    dialog = await openCoach(user);
    expect(within(dialog).getByRole("button", { name: "표현 추천받기" })).toBeEnabled();
    expectCoachEmpty(dialog);

    await act(async () => {
      pending.resolve(COACH_HELP);
    });
    expect(within(dialog).getByText(COACH_HELP.coachReply)).toBeInTheDocument();
    expect(expressionCards(dialog).map((card) => card[1])).toEqual(["체력을 기르다", "규칙적으로 운동하다", "빈칸뿐인 표현"]);
    expect(within(dialog).getByRole("button", { name: "표현 추천받기" })).toBeEnabled();
    expect(coachInput(dialog).value).toBe("");
    expect(api.requestCoachHelp.mock.calls).toEqual([
      [{ promptId: PROMPT_1.id, question: "체력을 기르고 싶다", attemptType: "INITIAL" }]
    ]);
  });

  it("[spec] 게스트로 시작한 그 질문의 세션이 있으면 추천 요청에 그 세션 id를 보낸다", async () => {
    window.localStorage.setItem("writeloop_guest_session_id", "guest-session-9");
    window.localStorage.setItem("writeloop_guest_prompt_id", PROMPT_1.id);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");

    expect(api.requestCoachHelp.mock.calls).toEqual([
      [{ promptId: PROMPT_1.id, question: "체력을 기르고 싶다", sessionId: "guest-session-9", attemptType: "INITIAL" }]
    ]);
  });

  it("[spec] 추천받은 표현 카드: 응답 순서대로 표현·뜻·팁·예문과 '문장에 넣기'·저장 버튼이 나오고 문구·구조·클래스가 지금과 같다(스냅숏). 안내 문구는 버튼 줄과 결과 사이에 나온다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");

    expect(expressionCards(dialog)).toEqual([
      [
        "  build up my stamina  ",
        "체력을 기르다",
        "운동 목표를 말할 때 써요.",
        "I want to build up my stamina.",
        ["문장에 넣기", "저장"]
      ],
      ["work out regularly", "규칙적으로 운동하다", "습관을 말할 때 써요.", "I work out regularly.", ["문장에 넣기", "저장"]],
      ["   ", "빈칸뿐인 표현", "", "", ["문장에 넣기", "저장"]]
    ]);
    // 스냅숏은 앞뒤 빈칸이 없는 응답으로 찍는다(빈칸 글자는 위에서 그대로 확인했다). 팁·예문이 빈 카드도 넣었다.
    await ask(user, dialog, "체력을 기르고 싶다", COACH_HELP_CARDS);
    const result = byClass(dialog, styles.coachResult);
    expect(classTokens(result.previousElementSibling as Element)).toEqual(["page:coachActionRow"]);
    expect(normalizeForSnapshot(result)).toMatchInlineSnapshot(`
      <div
        class="page:coachResult"
      >
        <div
          class="page:coachReplyCard"
        >
          <span
            class="page:coachReplyBadge"
          >
            코치 답변
          </span>
          <p>
            체력 이야기를 할 때 바로 쓸 수 있는 표현이에요.
          </p>
        </div>
        <div
          class="page:coachExpressionList"
        >
          <article
            class="page:coachExpressionCard"
          >
            <div
              class="page:coachExpressionTop"
            >
              <strong>
                build up my stamina
              </strong>
              <span>
                체력을 기르다
              </span>
            </div>
            <p>
              운동 목표를 말할 때 써요.
            </p>
            <small>
              I want to build up my stamina.
            </small>
            <div
              class="page:coachExpressionActionRow"
            >
              <button
                class="page:coachExpressionGhostButton"
                type="button"
              >
                문장에 넣기
              </button>
              <button
                class="page:coachExpressionSaveButton"
                type="button"
              >
                저장
              </button>
            </div>
          </article>
          <article
            class="page:coachExpressionCard"
          >
            <div
              class="page:coachExpressionTop"
            >
              <strong>
                stay active
              </strong>
              <span>
                활동적으로 지내다
              </span>
            </div>
            <p />
            <small />
            <div
              class="page:coachExpressionActionRow"
            >
              <button
                class="page:coachExpressionGhostButton"
                type="button"
              >
                문장에 넣기
              </button>
              <button
                class="page:coachExpressionSaveButton"
                type="button"
              >
                저장
              </button>
            </div>
          </article>
        </div>
      </div>
    `);

    // 응답이 있는 채로 빈 질문을 보내면 안내 문구가 버튼 줄과 결과 사이에 나오고, 응답은 그대로다.
    await user.clear(coachInput(dialog));
    await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
    const error = within(dialog).getByText(EMPTY_QUESTION_ERROR);
    expect(classTokens(error.previousElementSibling as Element)).toEqual(["page:coachActionRow"]);
    expect(error.nextElementSibling).toBe(byClass(dialog, styles.coachResult));
    expect(within(dialog).getByText(COACH_HELP_CARDS.coachReply)).toBeInTheDocument();
    expect(api.requestCoachHelp).toHaveBeenCalledTimes(2);
  });

  it("[spec] 추천 요청이 실패하면 그 질문에 맞춘 대체 응답(buildLocalCoachHelp)을 오류 문구 없이 보여 주고, 그 뒤 제출하면 대체 응답의 표현으로 사용 확인을 부른다(상호작용 id 없음)", async () => {
    const fallback = buildLocalCoachHelp(PROMPT_1, "체력을 기르고 싶다");
    expect(fallback.expressions.length).toBeGreaterThan(0);
    expect(fallback.interactionId).toBeUndefined();

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    api.requestCoachHelp.mockRejectedValueOnce(new Error("coach down"));
    await user.type(coachInput(dialog), "  체력을 기르고 싶다  ");
    await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
    await within(dialog).findByText(fallback.coachReply);

    expect(coachErrors(dialog)).toEqual([]);
    expect(expressionCards(dialog)).toEqual(
      fallback.expressions.map((expression) => [
        expression.expression,
        expression.meaningKo,
        expression.usageTip,
        expression.example,
        ["문장에 넣기", "저장"]
      ])
    );
    expect(within(dialog).getByRole("button", { name: "표현 추천받기" })).toBeEnabled();
    await closeCoach(user);

    await user.type(answerInput(), "I go to the gym every day.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-701", 1, false));
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1));
    expect(api.checkCoachExpressionUsage.mock.calls).toEqual([
      [
        {
          promptId: PROMPT_1.id,
          answer: "I go to the gym every day.",
          sessionId: "sess-701",
          guestId: GUEST_ID,
          attemptNo: 1,
          attemptType: "INITIAL",
          expressions: fallback.expressions
        }
      ]
    ]);
    expect((api.checkCoachExpressionUsage.mock.calls[0][0] as Record<string, unknown>).interactionId).toBeUndefined();
  });

  it("[spec] '문장에 넣기': 앞뒤 빈칸을 지운 표현을 답 끝(끝 빈칸은 지우고)에 한 칸 띄워 붙이고, 답이 비었거나 빈칸뿐이면 표현만 남는다. 빈칸뿐인 표현은 붙이지 않고, 창은 열린 채다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");

    await user.click(insertButton(dialog, "체력을 기르다"));
    expect(answerInput().value).toBe("build up my stamina");
    expect(queryDialog()).toBe(dialog);
    await user.click(insertButton(dialog, "규칙적으로 운동하다"));
    expect(answerInput().value).toBe("build up my stamina work out regularly");
    await user.click(insertButton(dialog, "빈칸뿐인 표현"));
    expect(answerInput().value).toBe("build up my stamina work out regularly");
    await closeCoach(user);
    // 붙인 뒤에는 입력이 있어 말풍선이 없다.
    expect(bubbles()).toHaveLength(0);

    await user.clear(answerInput());
    await user.type(answerInput(), "  I want to   ");
    dialog = await openCoach(user);
    await user.click(insertButton(dialog, "체력을 기르다"));
    expect(answerInput().value).toBe("  I want to build up my stamina");
    await closeCoach(user);

    await user.clear(answerInput());
    await user.type(answerInput(), "   ");
    dialog = await openCoach(user);
    await user.click(insertButton(dialog, "규칙적으로 운동하다"));
    expect(answerInput().value).toBe("work out regularly");
    expect(api.requestCoachHelp).toHaveBeenCalledTimes(1);
  });

  it("[spec] 다시 쓰기 화면: 말풍선은 다시 쓴 답 기준이고 창이 열린다. 추천 요청은 피드백의 세션 id, 다듬은 다시 쓴 답, REWRITE로 보내고, '문장에 넣기'는 다시 쓴 답 끝에 붙는다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    await user.type(answerInput(), "I go jogging.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-901", 1, false));
    expect(screen.queryByRole("button", { name: "AI 코치 열기" })).not.toBeInTheDocument();
    expect(bubbles()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    expect(rewriteInput().value).toBe("I go jogging.");
    expect(triggerButton()).toHaveAttribute("aria-expanded", "false");
    expect(bubbles()).toHaveLength(0);
    await user.clear(rewriteInput());
    expect(bubbles()).toHaveLength(1);
    expect(classTokens(triggerButton().parentElement as Element)).toEqual(["page:coachTriggerDock"]);
    expect(triggerButton().parentElement?.parentElement).toBe(rewriteInput().parentElement);
    await user.type(rewriteInput(), "  I go jogging every day.  ");
    expect(bubbles()).toHaveLength(0);

    const dialog = await openCoach(user);
    expect(triggerButton()).toHaveAttribute("aria-expanded", "true");
    await ask(user, dialog, "이유를 더하고 싶다");
    expect(api.requestCoachHelp.mock.calls).toEqual([
      [
        {
          promptId: PROMPT_1.id,
          question: "이유를 더하고 싶다",
          sessionId: "sess-901",
          answer: "I go jogging every day.",
          attemptType: "REWRITE"
        }
      ]
    ]);

    await user.click(insertButton(dialog, "체력을 기르다"));
    expect(rewriteInput().value).toBe("  I go jogging every day. build up my stamina");
    await closeCoach(user);
    // 첫 답(이전 답변)은 그대로다.
    expect(screen.getByText("I go jogging.")).toBeInTheDocument();
  });

  it("[spec] 답을 제출하면 창이 닫힌다: 답이 비어 막히면 창은 열린 채이고, 제출 요청이 실패해도 창은 닫히며 코치 질문·응답은 남는다. 실패하면 사용 확인을 부르지 않는다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");

    // 창이 열린 채 제출 버튼을 누른다(창 뒤의 버튼).
    await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
    expect(await screen.findByText("영어 답변을 먼저 입력해 주세요.")).toBeInTheDocument();
    expect(queryDialog()).toBe(dialog);
    expect(triggerButton()).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(api.submitFeedback).not.toHaveBeenCalled();
    await closeCoach(user);

    await user.type(answerInput(), "I swim.");
    dialog = await openCoach(user);
    api.submitFeedback.mockRejectedValueOnce(new Error("network down"));
    await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
    expect(queryDialog()).not.toBeInTheDocument();
    expect(await screen.findByText("지금은 피드백을 생성할 수 없어요. 잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
    expect(api.submitFeedback).toHaveBeenCalledTimes(1);
    expect(answerInput().value).toBe("I swim.");
    expect(triggerButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await flush();
    expect(api.checkCoachExpressionUsage).not.toHaveBeenCalled();
    await waitForNextFrame();

    dialog = await openCoach(user);
    expect(coachInput(dialog).value).toBe("체력을 기르고 싶다");
    expect(within(dialog).getByText(COACH_HELP.coachReply)).toBeInTheDocument();
  });

  it("[spec] 코치 표현을 받은 뒤 제출하면 창이 닫히고, 사용 확인을 질문 id·다듬은 답·받은 세션 id·게스트 id·시도 번호와 종류·받은 표현 그대로·상호작용 id 그대로 부른다. 코치 질문·응답은 다시 쓰기까지 남고, 다시 쓰기에서 새로 받은 표현은 REWRITE로 다시 확인하며, 마지막 사용량의 관련 질문이 완료 화면의 추천 질문이 된다", async () => {
    api.checkCoachExpressionUsage
      .mockResolvedValueOnce({ ...USAGE_NO_RELATED, relatedPromptIds: [PROMPT_5.id] })
      .mockResolvedValueOnce(USAGE_API);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await closeCoach(user);
    await user.type(answerInput(), "  I build up my stamina by running.  ");

    // 창이 열린 채 제출한다(창 뒤의 버튼).
    dialog = await openCoach(user);
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-1101", 1, false));
    expect(queryDialog()).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1));
    expect(api.checkCoachExpressionUsage.mock.calls[0]).toEqual([
      {
        promptId: PROMPT_1.id,
        answer: "I build up my stamina by running.",
        sessionId: "sess-1101",
        guestId: GUEST_ID,
        attemptNo: 1,
        attemptType: "INITIAL",
        expressions: COACH_HELP.expressions,
        interactionId: "  coach-int-501  "
      }
    ]);
    await waitForNextFrame();

    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    expect(queryDialog()).not.toBeInTheDocument();
    expect(triggerButton()).toHaveAttribute("aria-expanded", "false");
    dialog = await openCoach(user);
    expect(coachInput(dialog).value).toBe("체력을 기르고 싶다");
    expect(within(dialog).getByText(COACH_HELP.coachReply)).toBeInTheDocument();
    await ask(user, dialog, "이유를 더하고 싶다", COACH_HELP_REWRITE);
    await closeCoach(user);
    await user.clear(rewriteInput());
    await user.type(rewriteInput(), "I run because it clears my head.");

    await submitRewrite(user, feedbackFor(PROMPT_1, "sess-1101", 2, true));
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(2));
    expect(api.checkCoachExpressionUsage.mock.calls[1]).toEqual([
      {
        promptId: PROMPT_1.id,
        answer: "I run because it clears my head.",
        sessionId: "sess-1101",
        guestId: GUEST_ID,
        attemptNo: 2,
        attemptType: "REWRITE",
        expressions: COACH_HELP_REWRITE.expressions
      }
    ]);
    expect((api.checkCoachExpressionUsage.mock.calls[1][0] as Record<string, unknown>).interactionId).toBeUndefined();
    await flush();

    await finishLoop(user);
    expect(recommendedQuestions()).toEqual([PROMPT_3.questionEn, PROMPT_4.questionEn]);
  });

  it("[spec] 사용 확인이 실패하면 대체 계산(buildLocalCoachUsage)의 관련 질문이 완료 화면의 추천 질문이 된다", async () => {
    api.checkCoachExpressionUsage.mockRejectedValueOnce(new Error("usage down"));

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await closeCoach(user);
    await user.type(answerInput(), "I build up my stamina.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-1201", 1, true));
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1));
    await flush();

    await finishLoop(user);
    expect(recommendedQuestions()).toEqual([PROMPT_5.questionEn, PROMPT_2.questionEn]);
  });

  it("[spec] 코치 표현 없이 제출하면 사용 확인을 부르지 않고, 완료 화면의 추천 질문은 지금 질문 기준이다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    await user.type(answerInput(), "I swim.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-1301", 1, true));
    await flush();
    expect(api.checkCoachExpressionUsage).not.toHaveBeenCalled();

    await finishLoop(user);
    expect(recommendedQuestions()).toEqual([PROMPT_3.questionEn, PROMPT_5.questionEn]);
  });

  it("[spec] 표현이 0개인 추천 응답을 받은 뒤 제출해도 사용 확인을 부르지 않고, 완료 화면의 추천 질문은 지금 질문 기준이다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await ask(user, dialog, "아무 표현이나", COACH_HELP_EMPTY);
    expect(expressionCards(dialog)).toEqual([]);
    await closeCoach(user);
    await user.type(answerInput(), "I swim.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-1302", 1, true));
    await flush();
    expect(api.checkCoachExpressionUsage).not.toHaveBeenCalled();

    await finishLoop(user);
    expect(recommendedQuestions()).toEqual([PROMPT_3.questionEn, PROMPT_5.questionEn]);
  });

  it("[spec] 코치 표현 없이 제출하면 앞의 사용량을 비운다: 첫 제출의 사용 확인이 늦게 끝나 사용량이 생긴 뒤, 표현이 0개인 응답을 받고 다시 제출하면 완료 화면의 추천 질문은 지금 질문 기준이다", async () => {
    const lateUsage = deferred<CoachUsageCheckResponse>();
    api.checkCoachExpressionUsage.mockImplementationOnce(() => lateUsage.promise);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await closeCoach(user);
    await user.type(answerInput(), "I swim.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-1401", 1, true));
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "그래도 더 다듬어서 써보기" }));
    dialog = await openCoach(user);
    await ask(user, dialog, "아무 표현이나", COACH_HELP_EMPTY);
    await closeCoach(user);

    // 첫 제출의 사용 확인이 이제 끝나 사용량(관련 질문 USAGE_API)이 생긴다.
    await act(async () => {
      lateUsage.resolve(USAGE_API);
    });

    await user.clear(rewriteInput());
    await user.type(rewriteInput(), "I swim at the pool.");
    await submitRewrite(user, feedbackFor(PROMPT_1, "sess-1401", 2, true));
    await flush();
    expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1);

    await finishLoop(user);
    expect(recommendedQuestions()).toEqual([PROMPT_3.questionEn, PROMPT_5.questionEn]);
  });

  it("[spec] 같은 질문을 다시 열어도(초안 없음) 코치 질문·응답·안내 문구를 비우고 창을 닫는다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await leaveCoachErrorAndQuestion(user, dialog, "다음에 물어볼 말");

    // 창이 열린 채 "질문 다시 고르기"를 누른다(창 뒤의 버튼). 고르기 화면에서는 창을 그리지 않지만 열린 상태라 스크롤이 잠겨 있다.
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await user.click(await screen.findByText(PROMPT_1.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    expect(queryDialog()).not.toBeInTheDocument();
    expect(triggerButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await waitForNextFrame();
    dialog = await openCoach(user);
    expectCoachEmpty(dialog);
    expect(quickChips(dialog)).toEqual(PROMPT_1_QUICK_QUESTIONS);
  });

  it("[spec] 질문을 열면 도움말(가이드)을 닫는다: 난이도 화면에서 가이드를 켜 두고 질문을 열면 답 쓰기 화면의 가이드가 닫혀 있다", async () => {
    const user = await renderHome();
    await user.click(screen.getByRole("button", { name: "가이드 보기" }));
    await openPromptFromDifficulty(user);

    const guideButton = screen.getByRole("button", { name: "가이드 보기" });
    expect(guideButton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementsByClassName(styles.writingGuideSummary)).toHaveLength(0);

    // 대조: 답 쓰기 화면에서 가이드를 켜면 가이드가 보인다.
    await user.click(guideButton);
    expect(guideButton).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementsByClassName(styles.writingGuideSummary)).toHaveLength(1);
  });

  it("[spec] 다른 질문으로 바꾸면 그 질문의 초안을 복구해 열어도 코치 질문·응답·안내 문구가 비워진다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await leaveCoachErrorAndQuestion(user, dialog, "다음에 물어볼 말");
    await closeCoach(user);

    drafts.set(`${PROMPT_2.id}:ANSWER`, draftFor(PROMPT_2, { answer: "I want to visit Busan." }));
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await user.click(await screen.findByText(PROMPT_2.questionEn));
    await screen.findByDisplayValue("I want to visit Busan.");

    dialog = await openCoach(user);
    expectCoachEmpty(dialog);
    expect(quickChips(dialog)).toEqual(GENERAL_QUICK_QUESTIONS);
  });

  it("[spec] 난이도를 바꾸면 코치 질문·응답·안내 문구를 비우고 창을 닫는다(바꾼 난이도의 첫 질문을 초안 복구로 열어도 비어 있다)", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    // 답을 써 두면 고르기 화면에서 초안을 저절로 복구하지 않는다.
    await user.type(answerInput(), "I jog every morning.");
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await leaveCoachErrorAndQuestion(user, dialog, "다음에 물어볼 말");

    drafts.set(`${PROMPT_A1.id}:ANSWER`, draftFor(PROMPT_A1, { answer: "I want to learn the guitar." }));
    // 창이 열린 채 "질문 다시 고르기"를 누른다(창 뒤의 버튼). 고르기 화면에서는 창을 그리지 않지만 열린 상태라 스크롤이 잠겨 있다.
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await user.click(await screen.findByRole("button", { name: "난이도 선택" }));
    expect(queryDialog()).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(await screen.findByRole("button", { name: /쉬움/ }));
    // 난이도를 바꾸면 창이 닫혀(고르기 화면 그대로) 스크롤 잠금이 풀린다.
    await screen.findByText(PROMPT_A1.questionEn);
    expect(document.body.style.overflow).toBe("");
    await waitForNextFrame();
    await user.click(screen.getByText(PROMPT_A1.questionEn));
    await screen.findByDisplayValue("I want to learn the guitar.");

    dialog = await openCoach(user);
    expectCoachEmpty(dialog);
  });

  it("[spec] 완료 화면의 '다른 질문 보기'는 코치 질문·응답·안내 문구를 비운다(같은 질문을 초안 복구로 열어도 비어 있다)", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await leaveCoachErrorAndQuestion(user, dialog, "다음에 물어볼 말");
    await closeCoach(user);
    await user.type(answerInput(), "I swim.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-1801", 1, true));
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1));
    await finishLoop(user);

    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    drafts.set(`${PROMPT_1.id}:ANSWER`, draftFor(PROMPT_1, { answer: "I walk to work every day." }));
    await user.click(await screen.findByText(PROMPT_1.questionEn));
    await screen.findByDisplayValue("I walk to work every day.");

    dialog = await openCoach(user);
    expectCoachEmpty(dialog);
  });

  it("[spec] 완료 화면의 '다른 질문 보기'는 사용량을 비운다: 같은 질문의 피드백 초안을 복구해 다시 완료하면 추천 질문은 지금 질문 기준이다", async () => {
    api.checkCoachExpressionUsage.mockResolvedValueOnce(USAGE_API);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await closeCoach(user);
    await user.type(answerInput(), "I swim.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-1901", 1, true));
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1));
    await flush();
    await finishLoop(user);
    expect(recommendedQuestions()).toEqual([PROMPT_3.questionEn, PROMPT_4.questionEn]);

    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    drafts.set(
      `${PROMPT_1.id}:ANSWER`,
      draftFor(PROMPT_1, {
        sessionId: "sess-1902",
        answer: "I swim at the pool.",
        lastSubmittedAnswer: "I swim at the pool.",
        feedback: feedbackFor(PROMPT_1, "sess-1902", 1, true),
        step: "feedback"
      })
    );
    await user.click(await screen.findByText(PROMPT_1.questionEn));
    await screen.findByText("1번째 시도");
    await finishLoop(user);

    expect(api.completeFeedbackSession.mock.calls.map((call) => call[0])).toEqual(["sess-1901", "sess-1902"]);
    expect(recommendedQuestions()).toEqual([PROMPT_3.questionEn, PROMPT_5.questionEn]);
  });

  it("[spec] 완료 화면에서 추천 질문으로 바꾸면 사용량을 비운다: 그 질문의 피드백 초안을 복구해 완료하면 추천 질문은 새 질문 기준이다", async () => {
    api.checkCoachExpressionUsage.mockResolvedValueOnce(USAGE_API);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    await closeCoach(user);
    await user.type(answerInput(), "I swim.");
    await submitInitial(user, feedbackFor(PROMPT_1, "sess-2001", 1, true));
    await waitFor(() => expect(api.checkCoachExpressionUsage).toHaveBeenCalledTimes(1));
    await flush();
    await finishLoop(user);
    expect(recommendedQuestions()).toEqual([PROMPT_3.questionEn, PROMPT_4.questionEn]);

    drafts.set(
      `${PROMPT_4.id}:ANSWER`,
      draftFor(PROMPT_4, {
        sessionId: "sess-2002",
        answer: "I eat lunch with my team.",
        lastSubmittedAnswer: "I eat lunch with my team.",
        feedback: feedbackFor(PROMPT_4, "sess-2002", 1, true),
        step: "feedback"
      })
    );
    await user.click(recommendationCard(PROMPT_4));
    await screen.findByText("1번째 시도");
    await finishLoop(user);

    expect(api.completeFeedbackSession.mock.calls.map((call) => call[0])).toEqual(["sess-2001", "sess-2002"]);
    expect(recommendedQuestions()).toEqual([PROMPT_1.questionEn, PROMPT_2.questionEn]);
  });

  it("[spec] 창은 답 쓰기·다시 쓰기 화면에서만 그린다: 창이 열린 채 고르기 화면으로 가면 창은 없지만 열린 상태로 남아 본문 스크롤이 잠겨 있다. 같은 질문의 초안을 복구하면 창만 닫히고 코치 질문·응답은 남는다", async () => {
    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");

    // 창이 열린 채 "질문 다시 고르기"를 누른다(창 뒤의 버튼).
    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await screen.findByText(PROMPT_2.questionEn);
    expect(queryDialog()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "AI 코치 열기" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    drafts.set(`${PROMPT_1.id}:ANSWER`, draftFor(PROMPT_1, { answer: "Restored answer." }));
    await user.click(screen.getByText(PROMPT_1.questionEn));
    await screen.findByDisplayValue("Restored answer.");
    expect(queryDialog()).not.toBeInTheDocument();
    expect(triggerButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await waitForNextFrame();

    dialog = await openCoach(user);
    expect(coachInput(dialog).value).toBe("체력을 기르고 싶다");
    expect(within(dialog).getByText(COACH_HELP.coachReply)).toBeInTheDocument();
    expect(api.requestCoachHelp).toHaveBeenCalledTimes(1);
  });

  it("[spec] 로그인 직후 로그인 전 초안을 적용하면 창만 닫히고 코치 질문·응답은 남는다", async () => {
    // 연습 링크로 들어오면 로그인 확인이 끝나기 전에 답 쓰기 화면이 열린다.
    window.history.replaceState(
      {},
      "",
      `/?promptId=${PROMPT_1.id}&difficulty=I&prefillExpression=${encodeURIComponent("build up my stamina")}`
    );
    const loginDraft: HomeDraftSnapshot = {
      selectedDifficulty: "I",
      selectedPromptId: PROMPT_1.id,
      sessionId: "",
      answer: "Answer before login.",
      rewrite: "",
      lastSubmittedAnswer: "",
      feedback: null,
      step: "answer"
    };
    window.sessionStorage.setItem("writeloop_post_login_home_draft", JSON.stringify(loginDraft));
    const currentUser = deferred<AuthUser | null>();
    api.getCurrentUser.mockImplementationOnce(() => currentUser.promise);

    const user = userEvent.setup();
    render(<AnswerLoop />);
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    await screen.findByText(PROMPT_1.questionEn);
    let dialog = await openCoach(user);
    await ask(user, dialog, "체력을 기르고 싶다");
    expect(answerInput().value).toBe("");

    await act(async () => {
      currentUser.resolve(USER);
    });
    await screen.findByDisplayValue("Answer before login.");
    expect(queryDialog()).not.toBeInTheDocument();
    expect(triggerButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
    await waitForNextFrame();

    dialog = await openCoach(user);
    expect(coachInput(dialog).value).toBe("체력을 기르고 싶다");
    expect(within(dialog).getByText(COACH_HELP.coachReply)).toBeInTheDocument();
  });

  it("[spec] 질문을 정하지 못했으면(오늘의 질문을 불러오지 못함) '표현 추천받기'가 비활성이고, 빠른 질문 칩은 질문 없이 만든 것이다", async () => {
    window.history.replaceState(
      {},
      "",
      `/?promptId=${PROMPT_1.id}&difficulty=I&prefillExpression=${encodeURIComponent("build up my stamina")}`
    );
    api.getDailyPrompts.mockRejectedValue(new Error("daily down"));

    const user = userEvent.setup();
    render(<AnswerLoop />);
    await screen.findByText("오늘의 질문을 불러오지 못했어요.");
    await screen.findByText("질문을 불러오는 중입니다.");
    await flush();

    const dialog = await openCoach(user);
    const askButton = within(dialog).getByRole("button", { name: "표현 추천받기" });
    expect(askButton).toBeDisabled();
    expect(quickChips(dialog)).toEqual(GENERAL_QUICK_QUESTIONS);
    await user.type(coachInput(dialog), "체력을 기르고 싶다");
    await user.click(askButton);
    await flush();
    expect(api.requestCoachHelp).not.toHaveBeenCalled();
    expect(coachErrors(dialog)).toEqual([]);
  });
});
