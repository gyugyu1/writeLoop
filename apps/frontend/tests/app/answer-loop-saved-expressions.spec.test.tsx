// [spec] qa 테스트(작업 037-06 표현 저장, 리팩터링). 표현 저장을 answer-loop.tsx 밖의 훅으로 옮기기 전의 "지금 동작"을 기록한다.
// AnswerLoop 화면 전체를 렌더하고 사용자처럼 조작한다. API(lib/api)와 Next.js 모듈(next/navigation, next/link, next/image)은 가짜다.
// 완료 화면의 축하 효과(canvas-confetti)는 jsdom에 canvas 그리기가 없어 아무것도 하지 않는 가짜로 둔다.
// 화면 바깥에서 동작만 보므로, 안쪽을 훅으로 나눠도 같은 테스트가 그대로 통과해야 한다.
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerLoop } from "../../app/answer-loop";
import styles from "../../app/page.module.css";
import type {
  AuthUser,
  CoachHelpResponse,
  DailyPromptRecommendation,
  Feedback,
  Prompt,
  SaveExpressionRequest,
  SavedExpression,
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
  id: 4601,
  email: "saved-expression-spec@example.com",
  displayName: "표현저장",
  admin: false
};

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
  id: "prompt-saved-1",
  topic: "Health",
  topicCategory: "Daily life",
  topicDetail: "Exercise",
  difficulty: "I",
  questionEn: "How do you stay healthy these days?",
  questionKo: "요즘 어떻게 건강을 지키나요?",
  tip: ""
};

const PROMPT_2: Prompt = {
  id: "prompt-saved-2",
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

// 코치 추천 표현. 앞뒤 빈칸, 정리할 태그, 빈칸뿐인 팁, 빈칸뿐인 표현을 일부러 넣었다.
const COACH_HELP: CoachHelpResponse = {
  promptId: PROMPT_1.id,
  userQuestion: "체력을 기르고 싶다",
  coachReply: "운동 습관을 말할 때 쓰기 좋은 표현이에요.",
  interactionId: "  coach-int-77  ",
  expressions: [
    {
      id: "ce-1",
      expression: "  build up my stamina  ",
      meaningKo: "  체력을 기르다  ",
      usageTip: "  운동 목표를 말할 때 써요.  ",
      example: "  I want to build up my stamina.  ",
      tags: ["  Health ", "health", "", " Exercise "]
    },
    {
      id: "ce-2",
      expression: "work out regularly",
      meaningKo: "규칙적으로 운동하다",
      usageTip: "   ",
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

// 코치 도우미 패널의 표현 카드는 뜻으로 찾는다(표현 글자는 앞뒤 빈칸이 있거나 비어 있다).
const STAMINA = "체력을 기르다";
const REGULARLY = "규칙적으로 운동하다";
const BLANK = "빈칸뿐인 표현";

const EXPECTED_STAMINA_BEFORE_FEEDBACK = {
  expression: "build up my stamina",
  meaningKo: "체력을 기르다",
  exampleEn: "I want to build up my stamina.",
  usageTipKo: "운동 목표를 말할 때 써요.",
  tags: ["health", "exercise"],
  sourceType: "COACH_RECOMMENDATION",
  promptId: PROMPT_1.id,
  coachInteractionId: "coach-int-77"
  // answerSessionId, answerAttemptNo: 첫 제출 전이라 undefined다(요청 본문에서 빠진다). toEqual은 undefined 속성을 없는 것과 같게 본다.
};

function baseFeedback(partial: Partial<Feedback>): Feedback {
  return {
    promptId: PROMPT_1.id,
    sessionId: "sess-base",
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

// 다시 쓰기가 필요한 피드백: 코치 피드백 구간의 "넣어볼 표현"이 보인다.
function needsRewriteFeedback(sessionId: string, attemptNo: number): Feedback {
  return baseFeedback({
    sessionId,
    attemptNo,
    loopComplete: false,
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "운동 습관을 분명하게 말했어요.",
      coachMove: {
        focus: "운동하는 이유를 한 문장 더해 보세요.",
        focusType: "ADD_DETAIL",
        instruction: "왜 그 운동을 하는지 한 문장 더 써 보세요.",
        skeletonEn: "I work out because ___.",
        suggestedPhrases: [
          { phrase: "Build Up My Stamina", meaningKo: "체력을 기르다" },
          { phrase: " keep a steady routine ", meaningKo: " 꾸준한 습관을 유지하다 " },
          "stay motivated"
        ]
      }
    }
  });
}

// 마무리할 수 있는 피드백: 보충 표현 구간(enrichment)과 피드백 요약의 "가볍게 넣어볼 표현"이 보인다.
// "On a regular basis"(보충)와 "  on a regular basis "(요약)는 대소문자·빈칸만 다른 같은 표현이다.
function readyFeedback(sessionId: string, attemptNo: number): Feedback {
  return baseFeedback({
    sessionId,
    attemptNo,
    loopComplete: true,
    visibleFeedback: {
      schemaVersion: 1,
      state: "READY_TO_FINISH",
      strength: "하고 싶은 말을 끝까지 썼어요.",
      completion: {
        headline: "좋아요. 지금 단계에서 마무리해도 충분해요.",
        enrichment: {
          focus: "언제 운동하는지 더해 보세요.",
          skeletonEn: "I usually work out ___.",
          suggestedPhrases: [
            { phrase: "On a regular basis", meaningKo: "정기적으로" },
            { phrase: "after work", meaningKo: "퇴근 후에" }
          ]
        }
      },
      refinementExpressions: [
        {
          expression: "  on a regular basis ",
          meaningKo: " 정기적으로 ",
          guidanceKo: "  얼마나 자주 하는지 말할 때 써요. ",
          exampleEn: "  I swim on a regular basis.  "
        },
        { expression: "make time for", meaningKo: "~할 시간을 내다" }
      ]
    }
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

// 창을 열고 닫으면 앱은 다음 화면 프레임(requestAnimationFrame)에 포커스를 옮긴다(열면 창 안으로, 닫으면 연 버튼으로).
// 그 프레임 전에 다음 조작을 하면 느린 컴퓨터에서 타자 도중 포커스가 넘어가 입력이 엉뚱한 곳에 들어간다.
// 그래서 다음 조작 전에 프레임 하나를 걸고 기다린다. jsdom은 한 프레임의 콜백을 건 순서대로 부르므로, 이게 불리면 앱의 포커스 옮기기도 끝났다.
async function waitForNextFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  });
}

function classTokens(element: Element) {
  return (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).sort();
}

function sortedClasses(...classNames: string[]) {
  return [...classNames].sort();
}

// 첫 화면을 렌더한다. 로그인했으면 저장된 표현 불러오기가 끝난 뒤, 아니면 로그인 확인이 끝난 뒤(오늘의 추천 질문을 부른 뒤)를 기다린다.
async function renderHome({ loggedIn = true }: { loggedIn?: boolean } = {}) {
  if (!loggedIn) {
    api.getCurrentUser.mockResolvedValue(null);
  }
  const user = userEvent.setup();
  render(<AnswerLoop />);
  if (loggedIn) {
    await waitFor(() => expect(api.getSavedExpressions).toHaveBeenCalled());
  } else {
    await waitFor(() => expect(api.getFeaturedDailyPrompt).toHaveBeenCalled());
  }
  await flush();
  return user;
}

const ANSWER_PLACEHOLDER = "여기에 영어로 첫 답변을 작성해 주세요.";

// 난이도 화면에서 입문을 골라 질문 목록을 열고, 질문을 골라 답 쓰기 화면으로 간다.
async function openPromptFromDifficulty(user: ReturnType<typeof userEvent.setup>, prompt: Prompt = PROMPT_1) {
  await user.click(screen.getByRole("button", { name: /입문/ }));
  await user.click(await screen.findByText(prompt.questionEn));
  await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
}

async function openCoach(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "AI 코치 열기" }));
  await waitForNextFrame();
  return screen.getByRole("dialog", { name: "AI에게 표현 물어보기" });
}

async function closeCoach(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "AI 코치 닫기" }));
  expect(screen.queryByRole("dialog", { name: "AI에게 표현 물어보기" })).not.toBeInTheDocument();
  await waitForNextFrame();
}

async function askCoach(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.type(within(dialog).getByPlaceholderText('예: "근력을 키우고 싶다"를 어떻게 말해?'), "체력을 기르고 싶다");
  await user.click(within(dialog).getByRole("button", { name: "표현 추천받기" }));
  await within(dialog).findByText(COACH_HELP.coachReply);
}

function coachSaveButton(dialog: HTMLElement, meaningKo: string) {
  const card = within(dialog).getByText(meaningKo).closest("article") as HTMLElement;
  return within(card).getByRole("button", { name: /^(저장|저장됨|저장 중)$/ }) as HTMLButtonElement;
}

// 코치 도우미 패널 안의 알림(coachNotice)과 오류(coachError) 문구. 코치 질문 오류도 coachError지만 이 테스트에서는 나오지 않는다.
function coachMessages(container: HTMLElement) {
  return {
    notices: Array.from(container.getElementsByClassName(styles.coachNotice)).map((node) => node.textContent),
    errors: Array.from(container.getElementsByClassName(styles.coachError)).map((node) => node.textContent)
  };
}

async function submitAnswer(user: ReturnType<typeof userEvent.setup>, text: string, feedback: Feedback) {
  api.submitFeedback.mockResolvedValueOnce(feedback);
  await user.type(screen.getByPlaceholderText(ANSWER_PLACEHOLDER), text);
  await user.click(screen.getByRole("button", { name: "답변 제출하기" }));
  await screen.findByText(`${feedback.attemptNo}번째 시도`);
}

// 피드백 화면의 표현 칩. 칩 안의 <strong>이 표현 글자다.
function chip(phrase: string) {
  return screen.getByText(phrase, { selector: "strong" }).closest("button") as HTMLButtonElement;
}

function chipLabel(button: HTMLElement) {
  return button.querySelector("em")?.textContent;
}

// 칩 안의 요소 구조: [태그, 글자]. 글자는 화면 그대로(앞뒤 빈칸 포함)다.
function chipParts(button: HTMLElement) {
  return Array.from(button.children).map((node) => [node.tagName, node.textContent]);
}

const SAVE_NOTICE = "표현을 저장했어요.";
const DELETE_NOTICE = "저장을 취소했어요.";

describe("[spec] AnswerLoop 표현 저장(지금 동작 기록)", () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.body.style.overflow = "";
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
    api.requestCoachHelp.mockResolvedValue(COACH_HELP);
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
    document.body.style.overflow = "";
  });

  it("[spec] 로그인하면 저장된 표현을 한 번 불러와, 대소문자·빈칸만 다른 표현의 버튼이 저장됨으로 보인다. 누르면 불러온 id로 저장을 취소하고, 다시 누르면 저장한다", async () => {
    api.getSavedExpressions.mockResolvedValue([
      savedExpression(71, "Work  Out   REGULARLY"),
      savedExpression(72, "Something Else")
    ]);
    api.deleteSavedExpression.mockResolvedValue(undefined);
    api.saveExpression.mockResolvedValue(savedExpression(502, "work out regularly"));

    const user = await renderHome();
    expect(api.getSavedExpressions.mock.calls).toEqual([[]]);

    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await askCoach(user, dialog);

    const regularly = coachSaveButton(dialog, REGULARLY);
    expect(regularly.textContent).toBe("저장됨");
    expect(regularly).toBeEnabled();
    expect(classTokens(regularly)).toEqual([styles.coachExpressionSaveButtonActive]);
    const stamina = coachSaveButton(dialog, STAMINA);
    expect(stamina.textContent).toBe("저장");
    expect(stamina).toBeEnabled();
    expect(classTokens(stamina)).toEqual([styles.coachExpressionSaveButton]);
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });

    await user.click(regularly);
    await waitFor(() => expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장"));
    expect(api.deleteSavedExpression.mock.calls).toEqual([[71]]);
    expect(api.saveExpression).not.toHaveBeenCalled();
    expect(classTokens(coachSaveButton(dialog, REGULARLY))).toEqual([styles.coachExpressionSaveButton]);
    expect(coachMessages(dialog)).toEqual({ notices: [DELETE_NOTICE], errors: [] });

    await user.click(coachSaveButton(dialog, REGULARLY));
    await waitFor(() => expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장됨"));
    expect(api.saveExpression).toHaveBeenCalledTimes(1);
    expect(api.deleteSavedExpression).toHaveBeenCalledTimes(1);
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });
    expect(api.getSavedExpressions).toHaveBeenCalledTimes(1);
  });

  it("[spec] 저장된 표현을 불러오지 못하면 저장된 것이 없는 것으로 보고, 누르면 취소가 아니라 저장을 부른다", async () => {
    api.getSavedExpressions.mockRejectedValue(new Error("불러오기 실패"));
    api.saveExpression.mockResolvedValue(savedExpression(503, "work out regularly"));
    api.deleteSavedExpression.mockResolvedValue(undefined);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await askCoach(user, dialog);

    expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장");
    expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장");
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });

    await user.click(coachSaveButton(dialog, REGULARLY));
    await waitFor(() => expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장됨"));
    expect(api.saveExpression).toHaveBeenCalledTimes(1);
    expect(api.deleteSavedExpression).not.toHaveBeenCalled();
  });

  it("[spec] 코치 도우미 패널: 저장 버튼을 누르면 앞뒤 빈칸을 지운 값, 정리한 태그, 출처 COACH_RECOMMENDATION, 질문 id, 코치 상호작용 id로 저장하고 저장됨과 알림이 나온다. 빈칸뿐인 표현은 아무 일도 없고, 저장된 것을 누르면 취소한다", async () => {
    api.saveExpression
      .mockResolvedValueOnce(savedExpression(511, "work out regularly"))
      .mockResolvedValueOnce(savedExpression(512, "build up my stamina"));
    api.deleteSavedExpression.mockResolvedValue(undefined);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await askCoach(user, dialog);

    // 빈칸뿐인 팁은 보내지 않고(undefined), 태그가 없으면 빈 배열을 보낸다.
    await user.click(coachSaveButton(dialog, REGULARLY));
    await waitFor(() => expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장됨"));
    expect(api.saveExpression.mock.calls).toEqual([
      [
        {
          expression: "work out regularly",
          meaningKo: "규칙적으로 운동하다",
          exampleEn: "I work out regularly.",
          tags: [],
          sourceType: "COACH_RECOMMENDATION",
          promptId: PROMPT_1.id,
          coachInteractionId: "coach-int-77"
        }
      ]
    ]);
    const firstRequest = api.saveExpression.mock.calls[0][0] as SaveExpressionRequest;
    expect(firstRequest.usageTipKo).toBeUndefined();
    expect(firstRequest.answerSessionId).toBeUndefined();
    expect(firstRequest.answerAttemptNo).toBeUndefined();
    expect(classTokens(coachSaveButton(dialog, REGULARLY))).toEqual([styles.coachExpressionSaveButtonActive]);

    // 알림은 코치 도우미 패널 안, 버튼 줄 다음이자 코치 답변 앞에 나온다.
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });
    const notice = within(dialog).getByText(SAVE_NOTICE);
    expect(notice.tagName).toBe("P");
    expect(classTokens(notice)).toEqual([styles.coachNotice]);
    expect(classTokens(notice.previousElementSibling as Element)).toEqual([styles.coachActionRow]);
    expect(classTokens(notice.nextElementSibling as Element)).toEqual([styles.coachResult]);

    // 표현이 빈칸뿐이면 눌러도 부르지 않고, 앞의 알림도 그대로다.
    const blank = coachSaveButton(dialog, BLANK);
    expect(blank.textContent).toBe("저장");
    await user.click(blank);
    await flush();
    expect(api.saveExpression).toHaveBeenCalledTimes(1);
    expect(api.deleteSavedExpression).not.toHaveBeenCalled();
    expect(coachSaveButton(dialog, BLANK).textContent).toBe("저장");
    expect(coachSaveButton(dialog, BLANK)).toBeEnabled();
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });
    expect(screen.queryByRole("dialog", { name: "로그인하면 계속 학습할 수 있어요" })).not.toBeInTheDocument();

    await user.click(coachSaveButton(dialog, STAMINA));
    await waitFor(() => expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장됨"));
    expect(api.saveExpression).toHaveBeenCalledTimes(2);
    expect(api.saveExpression.mock.calls[1]).toEqual([EXPECTED_STAMINA_BEFORE_FEEDBACK]);
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });

    await user.click(coachSaveButton(dialog, STAMINA));
    await waitFor(() => expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장"));
    expect(api.deleteSavedExpression.mock.calls).toEqual([[512]]);
    expect(api.saveExpression).toHaveBeenCalledTimes(2);
    expect(classTokens(coachSaveButton(dialog, STAMINA))).toEqual([styles.coachExpressionSaveButton]);
    expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장됨");
    expect(coachMessages(dialog)).toEqual({ notices: [DELETE_NOTICE], errors: [] });
  });

  it("[spec] 저장·취소하는 동안 그 표현의 버튼은 '저장 중'으로 비활성이고 다시 눌러도 다시 부르지 않는다. 다른 표현의 버튼은 그대로이고, 그동안 앞의 알림은 지워진다", async () => {
    const saveRequest = deferred<SavedExpression>();
    const deleteRequest = deferred<void>();
    api.saveExpression.mockImplementationOnce(() => saveRequest.promise);
    api.deleteSavedExpression.mockImplementationOnce(() => deleteRequest.promise);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await askCoach(user, dialog);

    await user.click(coachSaveButton(dialog, REGULARLY));
    const savingButton = coachSaveButton(dialog, REGULARLY);
    expect(savingButton.textContent).toBe("저장 중");
    expect(savingButton).toBeDisabled();
    expect(classTokens(savingButton)).toEqual([styles.coachExpressionSaveButton]);
    expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장");
    expect(coachSaveButton(dialog, STAMINA)).toBeEnabled();
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });

    await user.click(savingButton);
    await flush();
    expect(api.saveExpression).toHaveBeenCalledTimes(1);

    await act(async () => {
      saveRequest.resolve(savedExpression(521, "work out regularly"));
    });
    expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장됨");
    expect(coachSaveButton(dialog, REGULARLY)).toBeEnabled();
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });

    await user.click(coachSaveButton(dialog, REGULARLY));
    const deletingButton = coachSaveButton(dialog, REGULARLY);
    expect(deletingButton.textContent).toBe("저장 중");
    expect(deletingButton).toBeDisabled();
    expect(classTokens(deletingButton)).toEqual([styles.coachExpressionSaveButtonActive]);
    expect(coachSaveButton(dialog, STAMINA)).toBeEnabled();
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });

    await user.click(deletingButton);
    await flush();
    expect(api.deleteSavedExpression.mock.calls).toEqual([[521]]);
    expect(api.saveExpression).toHaveBeenCalledTimes(1);

    await act(async () => {
      deleteRequest.resolve();
    });
    expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장");
    expect(coachSaveButton(dialog, REGULARLY)).toBeEnabled();
    expect(coachMessages(dialog)).toEqual({ notices: [DELETE_NOTICE], errors: [] });
  });

  it("[spec] 저장에 실패하면 오류의 메시지를, 던진 값이 Error가 아니면 '표현을 저장하지 못했어요.'를 보여 주고 버튼은 저장으로 돌아간다. 메시지가 빈 Error면 오류 문구가 없다. 다음에 누르면 오류가 지워지고, 취소 실패도 같다", async () => {
    api.saveExpression
      .mockRejectedValueOnce(new Error("오늘은 더 저장할 수 없어요."))
      .mockRejectedValueOnce("network down")
      .mockRejectedValueOnce(new Error(""))
      .mockResolvedValueOnce(savedExpression(531, "work out regularly"));
    api.deleteSavedExpression.mockRejectedValueOnce(new Error("지금은 저장을 취소할 수 없어요."));

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await askCoach(user, dialog);

    await user.click(coachSaveButton(dialog, REGULARLY));
    await within(dialog).findByText("오늘은 더 저장할 수 없어요.");
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: ["오늘은 더 저장할 수 없어요."] });
    expect(classTokens(within(dialog).getByText("오늘은 더 저장할 수 없어요."))).toEqual([styles.coachError]);
    expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장");
    expect(coachSaveButton(dialog, REGULARLY)).toBeEnabled();

    await user.click(coachSaveButton(dialog, REGULARLY));
    await within(dialog).findByText("표현을 저장하지 못했어요.");
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: ["표현을 저장하지 못했어요."] });
    expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장");

    // 지금 코드는 Error면 그 메시지를 그대로 쓴다. 메시지가 빈 Error면 오류 문구가 비어 아무것도 보이지 않는다.
    await user.click(coachSaveButton(dialog, REGULARLY));
    await waitFor(() => expect(api.saveExpression).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장"));
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });

    await user.click(coachSaveButton(dialog, REGULARLY));
    await waitFor(() => expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장됨"));
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });
    expect(api.saveExpression).toHaveBeenCalledTimes(4);

    await user.click(coachSaveButton(dialog, REGULARLY));
    await within(dialog).findByText("지금은 저장을 취소할 수 없어요.");
    expect(api.deleteSavedExpression.mock.calls).toEqual([[531]]);
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: ["지금은 저장을 취소할 수 없어요."] });
    expect(coachSaveButton(dialog, REGULARLY).textContent).toBe("저장됨");
    expect(coachSaveButton(dialog, REGULARLY)).toBeEnabled();
    expect(classTokens(coachSaveButton(dialog, REGULARLY))).toEqual([styles.coachExpressionSaveButtonActive]);
  });

  it("[spec] 로그인하지 않았으면 저장된 표현을 부르지 않고, 저장 버튼을 누르면 로그인 안내가 뜨며 '표현 저장은 로그인 후 사용할 수 있어요.'가 나오고 API를 부르지 않는다. 빈칸뿐인 표현은 로그인 안내도 없다", async () => {
    const user = await renderHome({ loggedIn: false });
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await askCoach(user, dialog);

    expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장");

    await user.click(coachSaveButton(dialog, BLANK));
    await flush();
    expect(screen.queryByRole("dialog", { name: "로그인하면 계속 학습할 수 있어요" })).not.toBeInTheDocument();
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });

    await user.click(coachSaveButton(dialog, STAMINA));
    expect(await screen.findByRole("dialog", { name: "로그인하면 계속 학습할 수 있어요" })).toBeInTheDocument();
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: ["표현 저장은 로그인 후 사용할 수 있어요."] });
    expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장");
    expect(coachSaveButton(dialog, STAMINA)).toBeEnabled();

    expect(api.saveExpression).not.toHaveBeenCalled();
    expect(api.deleteSavedExpression).not.toHaveBeenCalled();
    expect(api.getSavedExpressions).not.toHaveBeenCalled();
  });

  it("[spec] 로그인한 사용자가 게스트로 시작한 그 질문의 세션이 있으면 첫 제출 전 저장에 그 세션 id를 보낸다", async () => {
    window.localStorage.setItem("writeloop_guest_session_id", "guest-session-9");
    window.localStorage.setItem("writeloop_guest_prompt_id", PROMPT_1.id);
    api.saveExpression.mockResolvedValue(savedExpression(541, "build up my stamina"));

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    const dialog = await openCoach(user);
    await askCoach(user, dialog);

    await user.click(coachSaveButton(dialog, STAMINA));
    await waitFor(() => expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장됨"));
    expect(api.saveExpression.mock.calls).toEqual([
      [{ ...EXPECTED_STAMINA_BEFORE_FEEDBACK, answerSessionId: "guest-session-9" }]
    ]);
  });

  it("[spec] 피드백 화면 코치 피드백 구간: 넣어볼 표현 칩이 저장 상태를 코치 도우미 패널과 함께 쓰고, 누르면 정해진 팁·태그와 답 세션·시도 번호로 저장·취소한다. 알림은 피드백 화면에 없고 다시 쓰기의 코치 도우미 패널에 나온다", async () => {
    api.getSavedExpressions.mockResolvedValue([savedExpression(81, "keep a steady routine")]);
    api.saveExpression
      .mockResolvedValueOnce(savedExpression(551, "build up my stamina"))
      .mockResolvedValueOnce(savedExpression(552, "stay motivated"))
      .mockResolvedValueOnce(savedExpression(553, "keep a steady routine"))
      .mockResolvedValueOnce(savedExpression(554, "build up my stamina"));
    api.deleteSavedExpression.mockResolvedValue(undefined);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await askCoach(user, dialog);
    await user.click(coachSaveButton(dialog, STAMINA));
    await waitFor(() => expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장됨"));
    await closeCoach(user);

    await submitAnswer(user, "I go to the gym three times a week.", needsRewriteFeedback("sess-401", 1));

    // 코치 도우미 패널에서 저장한 "  build up my stamina  "와 대소문자만 다른 칩, 불러온 목록에 있는 칩은 저장됨이다.
    const staminaChip = chip("Build Up My Stamina");
    expect(staminaChip).toHaveAttribute("aria-pressed", "true");
    expect(staminaChip).toHaveAttribute("aria-label", "Build Up My Stamina 저장 취소");
    expect(chipLabel(staminaChip)).toBe("저장됨");
    expect(staminaChip).toBeEnabled();
    expect(classTokens(staminaChip)).toEqual(sortedClasses(styles.coachMovePhraseChip, styles.coachMovePhraseChipSaved));
    expect(chipParts(staminaChip)).toEqual([
      ["STRONG", "Build Up My Stamina"],
      ["SMALL", "체력을 기르다"],
      ["EM", "저장됨"]
    ]);
    const routineChip = chip("keep a steady routine");
    expect(routineChip).toHaveAttribute("aria-pressed", "true");
    expect(routineChip).toHaveAttribute("aria-label", "keep a steady routine 저장 취소");
    const motivatedChip = chip("stay motivated");
    expect(motivatedChip).toHaveAttribute("aria-pressed", "false");
    expect(motivatedChip).toHaveAttribute("aria-label", "stay motivated 저장");
    expect(chipLabel(motivatedChip)).toBe("저장");
    expect(classTokens(motivatedChip)).toEqual([styles.coachMovePhraseChip]);
    expect(chipParts(motivatedChip)).toEqual([
      ["STRONG", "stay motivated"],
      ["EM", "저장"]
    ]);

    // 뜻이 없는 칩: 뜻은 보내지 않고, 팁과 태그는 정해진 값, 출처는 COACH_RECOMMENDATION, 답 세션·시도 번호는 피드백의 값.
    await user.click(motivatedChip);
    await waitFor(() => expect(chip("stay motivated")).toHaveAttribute("aria-pressed", "true"));
    expect(api.saveExpression.mock.calls[1]).toEqual([
      {
        expression: "stay motivated",
        usageTipKo: "문장틀에 넣어볼 수 있는 표현이에요.",
        tags: ["넣어볼 표현"],
        sourceType: "COACH_RECOMMENDATION",
        promptId: PROMPT_1.id,
        answerSessionId: "sess-401",
        answerAttemptNo: 1
      }
    ]);
    const motivatedRequest = api.saveExpression.mock.calls[1][0] as SaveExpressionRequest;
    expect(motivatedRequest.meaningKo).toBeUndefined();
    expect(motivatedRequest.exampleEn).toBeUndefined();
    expect(motivatedRequest.coachInteractionId).toBeUndefined();
    expect(chip("stay motivated")).toHaveAttribute("aria-label", "stay motivated 저장 취소");
    expect(chipLabel(chip("stay motivated"))).toBe("저장됨");
    expect(screen.queryByText(SAVE_NOTICE)).not.toBeInTheDocument();
    expect(coachMessages(document.body)).toEqual({ notices: [], errors: [] });

    // 불러온 목록의 id로 취소하고, 다시 누르면 앞뒤 빈칸을 지운 뜻과 함께 저장한다.
    await user.click(chip("keep a steady routine"));
    await waitFor(() => expect(chip("keep a steady routine")).toHaveAttribute("aria-pressed", "false"));
    expect(api.deleteSavedExpression.mock.calls).toEqual([[81]]);
    expect(screen.queryByText(DELETE_NOTICE)).not.toBeInTheDocument();

    await user.click(chip("keep a steady routine"));
    await waitFor(() => expect(chip("keep a steady routine")).toHaveAttribute("aria-pressed", "true"));
    expect(api.saveExpression.mock.calls[2]).toEqual([
      {
        expression: "keep a steady routine",
        meaningKo: "꾸준한 습관을 유지하다",
        usageTipKo: "문장틀에 넣어볼 수 있는 표현이에요.",
        tags: ["넣어볼 표현"],
        sourceType: "COACH_RECOMMENDATION",
        promptId: PROMPT_1.id,
        answerSessionId: "sess-401",
        answerAttemptNo: 1
      }
    ]);

    // 코치 도우미 패널에서 저장한 것을 피드백 화면에서 취소하면 그 저장 id로 취소한다.
    await user.click(chip("Build Up My Stamina"));
    await waitFor(() => expect(chip("Build Up My Stamina")).toHaveAttribute("aria-pressed", "false"));
    expect(api.deleteSavedExpression.mock.calls).toEqual([[81], [551]]);
    expect(chipLabel(chip("Build Up My Stamina"))).toBe("저장");
    expect(screen.queryByText(DELETE_NOTICE)).not.toBeInTheDocument();
    expect(coachMessages(document.body)).toEqual({ notices: [], errors: [] });

    // 다시 쓰기에서 코치 도우미 패널을 열면 마지막 알림이 보이고, 패널의 저장 상태도 피드백 화면에서 바꾼 대로다.
    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    dialog = await openCoach(user);
    expect(coachMessages(dialog)).toEqual({ notices: [DELETE_NOTICE], errors: [] });
    expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장");

    await user.click(coachSaveButton(dialog, STAMINA));
    await waitFor(() => expect(coachSaveButton(dialog, STAMINA).textContent).toBe("저장됨"));
    expect(api.saveExpression.mock.calls[3]).toEqual([
      { ...EXPECTED_STAMINA_BEFORE_FEEDBACK, answerSessionId: "sess-401", answerAttemptNo: 1 }
    ]);
    expect(api.saveExpression).toHaveBeenCalledTimes(4);
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });
  });

  it("[spec] 피드백 화면 보충 표현 구간과 피드백 요약: 칩마다 정해진 출처·태그·팁으로 저장하고, 대소문자·빈칸만 다른 같은 표현은 두 구간에서 함께 '저장 중'·저장됨이 되며, 저장 중에 다른 칩은 그대로다", async () => {
    const regularRequest = deferred<SavedExpression>();
    api.saveExpression
      .mockImplementationOnce(() => regularRequest.promise)
      .mockResolvedValueOnce(savedExpression(562, "after work"));
    api.deleteSavedExpression.mockResolvedValue(undefined);

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    await submitAnswer(user, "I go swimming with my friends.", readyFeedback("sess-402", 1));

    const enrichmentRegular = chip("On a regular basis");
    const summaryRegular = chip("on a regular basis");
    const afterWork = chip("after work");
    const makeTime = chip("make time for");
    expect(enrichmentRegular).not.toBe(summaryRegular);
    expect(enrichmentRegular).toHaveAttribute("aria-pressed", "false");
    expect(enrichmentRegular).toHaveAttribute("aria-label", "On a regular basis 저장");
    expect(classTokens(enrichmentRegular)).toEqual([styles.coachMovePhraseChip]);
    expect(chipLabel(summaryRegular)).toBe("저장");
    expect(summaryRegular).not.toHaveAttribute("aria-pressed");
    expect(summaryRegular).not.toHaveAttribute("aria-label");
    expect(classTokens(summaryRegular)).toEqual([styles.visibleExpressionChip]);
    expect(chipParts(summaryRegular)).toEqual([
      ["STRONG", "  on a regular basis "],
      ["SMALL", " 정기적으로 "],
      ["EM", "저장"]
    ]);
    expect(chipParts(enrichmentRegular)).toEqual([
      ["STRONG", "On a regular basis"],
      ["SMALL", "정기적으로"],
      ["EM", "저장"]
    ]);

    // 피드백 요약의 칩: 앞뒤 빈칸을 지운 표현·뜻·예문·안내, 태그 "표현 더하기", 출처 REFINEMENT_EXPRESSION.
    await user.click(summaryRegular);
    expect(chipLabel(chip("on a regular basis"))).toBe("저장 중");
    expect(chip("on a regular basis")).toBeDisabled();
    expect(chipLabel(chip("On a regular basis"))).toBe("저장 중");
    expect(chip("On a regular basis")).toBeDisabled();
    expect(chipLabel(chip("after work"))).toBe("저장");
    expect(chip("after work")).toBeEnabled();
    expect(chip("make time for")).toBeEnabled();

    await user.click(chip("On a regular basis"));
    await flush();
    expect(api.saveExpression.mock.calls).toEqual([
      [
        {
          expression: "on a regular basis",
          meaningKo: "정기적으로",
          exampleEn: "I swim on a regular basis.",
          usageTipKo: "얼마나 자주 하는지 말할 때 써요.",
          tags: ["표현 더하기"],
          sourceType: "REFINEMENT_EXPRESSION",
          promptId: PROMPT_1.id,
          answerSessionId: "sess-402",
          answerAttemptNo: 1
        }
      ]
    ]);
    expect((api.saveExpression.mock.calls[0][0] as SaveExpressionRequest).coachInteractionId).toBeUndefined();

    await act(async () => {
      regularRequest.resolve(savedExpression(561, "on a regular basis"));
    });
    expect(chipLabel(chip("on a regular basis"))).toBe("저장됨");
    expect(classTokens(chip("on a regular basis"))).toEqual(
      sortedClasses(styles.visibleExpressionChip, styles.visibleExpressionChipSaved)
    );
    expect(chip("On a regular basis")).toHaveAttribute("aria-pressed", "true");
    expect(chip("On a regular basis")).toHaveAttribute("aria-label", "On a regular basis 저장 취소");
    expect(chipLabel(chip("On a regular basis"))).toBe("저장됨");
    expect(screen.queryByText(SAVE_NOTICE)).not.toBeInTheDocument();

    // 보충 표현 구간의 칩: 팁 "문장틀에 넣어볼 수 있는 표현이에요.", 태그 "넣어볼 표현", 출처 COACH_RECOMMENDATION.
    await user.click(afterWork);
    await waitFor(() => expect(chip("after work")).toHaveAttribute("aria-pressed", "true"));
    expect(api.saveExpression.mock.calls[1]).toEqual([
      {
        expression: "after work",
        meaningKo: "퇴근 후에",
        usageTipKo: "문장틀에 넣어볼 수 있는 표현이에요.",
        tags: ["넣어볼 표현"],
        sourceType: "COACH_RECOMMENDATION",
        promptId: PROMPT_1.id,
        answerSessionId: "sess-402",
        answerAttemptNo: 1
      }
    ]);
    expect(chipLabel(makeTime)).toBe("저장");

    // 보충 표현 구간에서 취소하면 피드백 요약에서 저장한 id로 취소되고, 두 칩 모두 저장으로 돌아간다.
    await user.click(chip("On a regular basis"));
    await waitFor(() => expect(chip("On a regular basis")).toHaveAttribute("aria-pressed", "false"));
    expect(api.deleteSavedExpression.mock.calls).toEqual([[561]]);
    expect(chipLabel(chip("on a regular basis"))).toBe("저장");
    expect(classTokens(chip("on a regular basis"))).toEqual([styles.visibleExpressionChip]);
    expect(api.saveExpression).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(DELETE_NOTICE)).not.toBeInTheDocument();
    expect(coachMessages(document.body)).toEqual({ notices: [], errors: [] });
  });

  it("[spec] 다른 질문을 고르면 알림이 지워진다. 코치 도우미 창을 닫았다 열기만 하면 남아 있다", async () => {
    api.saveExpression.mockResolvedValue(savedExpression(571, "work out regularly"));

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await askCoach(user, dialog);
    await user.click(coachSaveButton(dialog, REGULARLY));
    await waitFor(() => expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] }));

    await closeCoach(user);
    dialog = await openCoach(user);
    expect(coachMessages(dialog)).toEqual({ notices: [SAVE_NOTICE], errors: [] });
    await closeCoach(user);

    await user.click(screen.getByRole("button", { name: "질문 다시 고르기" }));
    await user.click(await screen.findByText(PROMPT_2.questionEn));
    await screen.findByPlaceholderText(ANSWER_PLACEHOLDER);
    expect(screen.getByText(PROMPT_2.questionEn)).toBeInTheDocument();

    dialog = await openCoach(user);
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });
    expect(within(dialog).queryByText(SAVE_NOTICE)).not.toBeInTheDocument();
  });

  it("[spec] 완료 화면에서 '다른 질문 보기'로 고르기 화면으로 돌아가면 오류가 지워진다. 답 제출과 다시 쓰기로는 지워지지 않는다", async () => {
    const draftForPrompt2: WritingDraft = {
      promptId: PROMPT_2.id,
      draftType: "ANSWER",
      updatedAt: "2026-04-15T09:00:00Z",
      selectedDifficulty: "I",
      selectedPromptId: PROMPT_2.id,
      sessionId: "",
      answer: "I want to visit Busan.",
      rewrite: "",
      lastSubmittedAnswer: "",
      feedback: null,
      step: "answer"
    };
    // 둘째 질문에는 서버에 답 초안이 있어, 고르면 질문을 새로 여는 대신 초안을 복구한다(그 길은 알림·오류를 지우지 않는다).
    api.getWritingDraft.mockImplementation((promptId: string, draftType: string) =>
      Promise.resolve(promptId === PROMPT_2.id && draftType === "ANSWER" ? draftForPrompt2 : null)
    );
    api.saveExpression.mockRejectedValueOnce(new Error("저장 서버를 점검하고 있어요."));

    const user = await renderHome();
    await openPromptFromDifficulty(user);
    let dialog = await openCoach(user);
    await askCoach(user, dialog);
    await user.click(coachSaveButton(dialog, REGULARLY));
    await within(dialog).findByText("저장 서버를 점검하고 있어요.");
    await closeCoach(user);

    await submitAnswer(user, "I go to the gym three times a week.", needsRewriteFeedback("sess-403", 1));
    await user.click(screen.getByRole("button", { name: "다시 써보기" }));
    dialog = await openCoach(user);
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: ["저장 서버를 점검하고 있어요."] });
    await closeCoach(user);

    api.submitFeedback.mockResolvedValueOnce(readyFeedback("sess-403", 2));
    await user.click(screen.getByRole("button", { name: "다시 쓴 답변 제출하기" }));
    await screen.findByText("2번째 시도");
    await user.click(screen.getByRole("button", { name: "오늘 루프 완료하고 도장 받기" }));
    await screen.findByRole("heading", { name: "루프를 완주했어요!" });

    await user.click(screen.getByRole("button", { name: "다른 질문 보기" }));
    await user.click(await screen.findByText(PROMPT_2.questionEn));
    await screen.findByDisplayValue("I want to visit Busan.");

    dialog = await openCoach(user);
    expect(coachMessages(dialog)).toEqual({ notices: [], errors: [] });
    expect(within(dialog).queryByText("저장 서버를 점검하고 있어요.")).not.toBeInTheDocument();
    expect(api.saveExpression).toHaveBeenCalledTimes(1);
  });
});
