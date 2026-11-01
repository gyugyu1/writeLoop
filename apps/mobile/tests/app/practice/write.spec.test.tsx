// [spec] qa 테스트(작업 039-06 쓰기 화면 조각, 리팩터링의 "지금 동작" 기록).
// 작문 화면(src/app/practice/write.tsx) 전체를 렌더하고 사용자처럼 눌러, 지금 보이는 문구·구조·접근성 속성과
// 부르는 API·기기 저장 동작을 좋고 나쁨과 관계없이 그대로 적는다. 화면 조각·도우미·스타일·AI 코치 상태를 옮긴 뒤에도,
// 임시저장을 훅으로 옮길지 정하는 다음 단계에서도 이 테스트가 그대로 통과해야 한다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(expo-secure-store, 이 기기 임시저장 @/lib/writing-drafts, 이어 쓰기 상태
// @/lib/incomplete-loop의 저장·지우기, 저장된 피드백 상태 불러오기, 게스트 아이디), 로그인 상태(@/lib/session),
// 라우터·내비게이션(expo-router, @react-navigation/native), 네이티브 모듈(expo-crypto).
// 메모리의 피드백 상태(getPracticeFeedbackState·savePracticeFeedbackState)와 이어 쓰기 상태의 질문 요약 만들기는 실제 모듈을 쓴다.
// 임시저장 타이머(900ms)가 테스트 도중 저절로 돌지 않게 모든 테스트를 가짜 시계로 돌린다(시각 2026-11-01T06:00:00Z에서 멈춤).
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, AppState, Keyboard, StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";
import PracticeWriteScreen from "@/app/practice/write";
import {
  ApiError,
  deleteWritingDraft,
  getDailyPrompts,
  getPromptHints,
  getPrompts,
  getWritingDraft,
  requestCoachHelp,
  saveExpression,
  saveWritingDraft,
  submitFeedback
} from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
import { clearIncompleteLoopForPrompt, saveIncompleteLoop } from "@/lib/incomplete-loop";
import {
  clearPracticeFeedbackState,
  getPracticeFeedbackState,
  hydratePracticeFeedbackState,
  savePracticeFeedbackState,
  type PracticeFeedbackState
} from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  CoachExpression,
  CoachHelpResponse,
  DailyPromptRecommendation,
  Feedback,
  Prompt,
  PromptHint,
  SavedExpression,
  SaveWritingDraftRequest,
  WritingDraft
} from "@/lib/types";
import { deleteLocalWritingDraft, getLocalWritingDraft, saveLocalWritingDraft } from "@/lib/writing-drafts";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: jest.fn(), useNavigation: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/api", () => {
  class ApiError extends Error {
    code?: string;
    status: number;

    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }
  return {
    ApiError,
    deleteWritingDraft: jest.fn(),
    getDailyPrompts: jest.fn(),
    getPromptHints: jest.fn(),
    getPrompts: jest.fn(),
    getWritingDraft: jest.fn(),
    requestCoachHelp: jest.fn(),
    saveExpression: jest.fn(),
    saveWritingDraft: jest.fn(),
    submitFeedback: jest.fn()
  };
});
jest.mock("@/lib/guest-id", () => ({ getOrCreateGuestId: jest.fn() }));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/writing-drafts", () => ({
  deleteLocalWritingDraft: jest.fn(),
  getLocalWritingDraft: jest.fn(),
  saveLocalWritingDraft: jest.fn()
}));
jest.mock("@/lib/incomplete-loop", () => ({
  ...jest.requireActual("@/lib/incomplete-loop"),
  clearIncompleteLoopForPrompt: jest.fn(),
  saveIncompleteLoop: jest.fn()
}));
jest.mock("@/lib/practice-feedback-state", () => ({
  ...jest.requireActual("@/lib/practice-feedback-state"),
  hydratePracticeFeedbackState: jest.fn()
}));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-01T06:00:00.000Z");

function at(ms: number) {
  return new Date(NOW.getTime() + ms).toISOString();
}

const prompt: Prompt = {
  id: "prompt-1",
  topic: "Morning",
  topicCategory: "ROUTINE",
  topicDetail: "Morning routine",
  difficulty: "A",
  questionEn: "What do you usually do in the morning?",
  questionKo: "아침에 보통 무엇을 하나요?",
  tip: "usually를 써 보세요."
};
const prompt2: Prompt = {
  id: "prompt-2",
  topic: "Food",
  topicCategory: "FOOD",
  topicDetail: "Favorite food",
  difficulty: "A",
  questionEn: "What is your favorite food?",
  questionKo: "가장 좋아하는 음식은 무엇인가요?",
  tip: "because를 써 보세요."
};
const prompt3: Prompt = {
  id: "prompt-3",
  topic: "Hobby",
  topicCategory: "HOBBY",
  topicDetail: "Weekend hobby",
  difficulty: "A",
  questionEn: "What do you do on weekends?",
  questionKo: "주말에 무엇을 하나요?",
  tip: "on weekends를 써 보세요."
};

const promptSnapshot = {
  topic: "Morning",
  questionEn: "What do you usually do in the morning?",
  questionKo: "아침에 보통 무엇을 하나요?"
};

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };
const GUEST_ID = "guest-device-0123456789abcdef";

const QUESTION_EN = prompt.questionEn;
const ANSWER_PLACEHOLDER = "영어로 답안을 써 보세요.";
const COACH_PLACEHOLDER = '예: "근력을 키우고 싶다"를 어떻게 말해?';
const COACH_BUBBLE = "표현이 막히면 AI 코치에게 물어봐요.";
const NOT_FOUND_TITLE = "질문을 다시 골라 주세요";
const NOT_FOUND_BODY = "선택한 질문을 찾지 못했어요. 질문 목록으로 돌아가 다시 선택하면 바로 이어서 쓸 수 있어요.";
const NOT_FOUND_ERROR = "선택한 질문을 찾지 못했어요. 질문 목록으로 돌아가 다시 골라 주세요.";
const BACK_TO_LIST = "질문 목록으로 돌아가기";
const SUBMIT_INITIAL = "피드백 받기";
const SUBMIT_REWRITE = "다시 쓴 답변 제출하기";
const VIEW_FEEDBACK = "피드백 보기";
const PREVIOUS_FEEDBACK = "이전 피드백 보기";
const GUIDE_OPEN = "가이드 보기";
const COACH_TITLE = "표현 추천 받기";
const COACH_REQUEST = "표현 추천받기";
const COACH_META = "표현을 그대로 붙이지 말고, 내 문장 안에서 자연스럽게 풀어 써 보세요.";
const COACH_REPLY_BADGE = "코치 답변";
const REWRITE_EYEBROW = "오늘의 한 가지 적용";
const TAG_EYEBROW = "태그 연습";
const EMPTY_ANSWER_ERROR = "영어 답안을 입력해 주세요.";
const GUEST_LIMIT_ERROR = "게스트는 질문 1개와 다시쓰기 1회까지만 체험할 수 있어요. 이어서 학습하려면 로그인해 주세요.";
const COACH_EMPTY_ERROR = "코치에게 물어볼 내용을 먼저 적어 주세요.";
const INITIAL_OVERLAY_NAME = "피드백을 만들고 있어요. 답변을 바탕으로 맞춤 피드백을 정리하고 있어요. 잠시만 기다려 주세요.";
const REWRITE_OVERLAY_NAME =
  "다시 쓴 답변을 읽고 있어요. 이전 피드백이 얼마나 반영됐는지 살펴보는 중이에요. 잠시만 기다려 주세요.";
const CANCEL_TITLE = "작문을 취소할까요?";
const CANCEL_BODY = "작성 중인 내용과 임시저장이 삭제되고 질문 목록으로 돌아가요.";
const PROBLEM_REPORT = "반복되는 문제 보내기";
const GUIDE_TITLE = "작성 가이드";
const HINTS_LOADING = "지금 추천 단어와 표현을 준비하고 있어요.";
const HINTS_EMPTY = "이 질문에는 아직 추천 단어와 표현이 없어요.";
const PREVIOUS_EMPTY_TITLE = "이전 피드백을 찾지 못했어요";
const PREVIOUS_EMPTY_BODY = "다시쓰기용 이전 피드백 정보가 초기화됐을 수 있어요. 질문 목록으로 돌아가 다시 시작해 주세요.";
const LOCAL_SAVED_BADGE = "이 기기에 저장됨";

// 서버·이 기기 초안의 저장 시각은 이 기기 시간대의 15:04와 16:30으로 만든다. 화면은 ko-KR의 두 자리 시·분으로 보인다.
const DRAFT_SAVED_AT = new Date(2026, 10, 1, 15, 4).toISOString();
const DRAFT_SAVED_TIME = new Date(DRAFT_SAVED_AT).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
const DRAFT_SAVED_AT_2 = new Date(2026, 10, 1, 16, 30).toISOString();
const DRAFT_SAVED_TIME_2 = new Date(DRAFT_SAVED_AT_2).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

const LIST_ROUTE_A = { pathname: "/practice/[difficulty]", params: { difficulty: "A" } };
const FEEDBACK_ROUTE = { pathname: "/practice/feedback", params: { difficulty: "A", promptId: "prompt-1" } };

// 배지 모양(스타일 값): 보통과 실패
const BADGE_NORMAL = { backgroundColor: "#FFF3DA", color: "#8E652E" };
const BADGE_ERROR = { backgroundColor: "#FDE6DF", color: "#B34A2B" };

function recommendation(prompts: Prompt[] = [prompt, prompt2, prompt3]): DailyPromptRecommendation {
  return { recommendedDate: "2026-11-01", difficulty: "A", prompts };
}

function makeFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    promptId: "prompt-1",
    sessionId: "session-1",
    attemptNo: 1,
    loopComplete: false,
    completionMessage: null,
    summary: "",
    strengths: [],
    inlineFeedback: null,
    revisedAnswer: null,
    modelAnswer: "",
    rewriteChallenge: "",
    ...overrides
  };
}

const coachMove = {
  focus: "이유를 한 문장 더해 보세요",
  instruction: "because로 이유를 붙여 다시 써 보세요.",
  before: "I wake up early.",
  after: "I wake up early because I have class."
};

function coachFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return makeFeedback({
    coachMove,
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "아침 일과를 분명하게 말했어요.",
      coachMove
    },
    ...overrides
  });
}

const nextCoachMove = { focus: "시간 표현을 더해 보세요", instruction: "every morning을 넣어 다시 써 보세요." };

// 제출에 성공했을 때 서버가 돌려주는 피드백
function nextFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return makeFeedback({
    sessionId: "session-9",
    coachMove: nextCoachMove,
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "커피 이야기를 분명하게 했어요.",
      coachMove: nextCoachMove
    },
    ...overrides
  });
}

function savedState(feedback: Feedback = coachFeedback(), overrides: Partial<PracticeFeedbackState> = {}): PracticeFeedbackState {
  return {
    difficulty: "A",
    prompt,
    initialAnswer: "I wake up.",
    answer: "I wake up early.",
    feedback,
    ...overrides
  };
}

function writingDraft(overrides: Partial<WritingDraft> = {}): WritingDraft {
  return {
    promptId: "prompt-1",
    draftType: "ANSWER",
    selectedDifficulty: "A",
    sessionId: "",
    answer: "I drink coffee.",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    updatedAt: DRAFT_SAVED_AT,
    ...overrides
  };
}

function rewriteDraft(overrides: Partial<WritingDraft> = {}): WritingDraft {
  return writingDraft({
    draftType: "REWRITE",
    sessionId: "session-1",
    answer: "I wake up early every day.",
    rewrite: "I wake up early because I have class.",
    lastSubmittedAnswer: "I wake up early.",
    step: "rewrite",
    ...overrides
  });
}

function answerPayload(text: string): SaveWritingDraftRequest {
  return {
    draftType: "ANSWER",
    selectedDifficulty: "A",
    sessionId: "",
    answer: text,
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer"
  };
}

function rewritePayload(text: string): SaveWritingDraftRequest {
  return {
    draftType: "REWRITE",
    selectedDifficulty: "A",
    sessionId: "session-1",
    answer: "I wake up early.",
    rewrite: text,
    lastSubmittedAnswer: "I wake up early.",
    feedback: null,
    step: "rewrite"
  };
}

const coachExpressions: CoachExpression[] = [
  {
    id: "exp-1",
    expression: "build muscle",
    meaningKo: "근육을 키우다",
    usageTip: "운동 목표를 말할 때 써요.",
    example: "I want to build muscle.",
    tags: ["운동"]
  },
  {
    id: "exp-2",
    expression: "stay in shape",
    meaningKo: "몸매를 유지하다",
    usageTip: "건강 습관을 말할 때 써요.",
    example: "I run to stay in shape.",
    tags: []
  }
];

function coachHelp(overrides: Partial<CoachHelpResponse> = {}): CoachHelpResponse {
  return {
    promptId: "prompt-1",
    userQuestion: "근력을 키우고 싶다",
    coachReply: "운동 목표는 이렇게 말해 보세요.",
    expressions: coachExpressions,
    interactionId: "interaction-1",
    ...overrides
  };
}

function savedExpression(id: number, expression: string): SavedExpression {
  return {
    id,
    expression,
    sourceType: "COACH_RECOMMENDATION",
    saveCount: 1,
    lastSavedAt: "2026-11-01T00:00:00Z",
    createdAt: "2026-11-01T00:00:00Z"
  };
}

const hints: PromptHint[] = [
  {
    id: "hint-starter",
    promptId: "prompt-1",
    hintType: "STARTER",
    items: [
      { id: "s-1", hintId: "hint-starter", itemType: "STARTER", content: "   " },
      { id: "s-2", hintId: "hint-starter", itemType: "STARTER", content: "  Every morning, I ...  " }
    ]
  },
  {
    id: "hint-word",
    promptId: "prompt-1",
    hintType: "VOCAB_WORD",
    items: [
      { id: "w-1", hintId: "hint-word", itemType: "WORD", content: "coffee", meaningKo: "  커피  " },
      { id: "w-2", hintId: "hint-word", itemType: "WORD", content: "relax", meaningKo: "  " },
      { id: "w-3", hintId: "hint-word", itemType: "WORD", content: "alarm" },
      { id: "w-4", hintId: "hint-word", itemType: "WORD", content: "  " }
    ]
  },
  {
    id: "hint-phrase",
    promptId: "prompt-1",
    hintType: "VOCAB_PHRASE",
    items: [
      { id: "p-1", hintId: "hint-phrase", itemType: "PHRASE", content: "in the morning" },
      { id: "p-2", hintId: "hint-phrase", itemType: "PHRASE", content: "get ready", meaningKo: "준비하다" }
    ]
  }
];

// ---------- 도우미 ----------

type WriteParams = {
  difficulty?: string;
  promptId?: string;
  mode?: string;
  resume?: string;
  prefillExpression?: string;
  practiceTag?: string;
  practiceTagLabel?: string;
  practiceExpressions?: string;
};

const navigation = { canGoBack: jest.fn(), goBack: jest.fn() };
const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let keyboardDismissSpy: jest.SpyInstance;
let appStateSubscriptions: { listener: (state: string) => void; removed: boolean }[] = [];

function setParams(params: WriteParams) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
}

function setSessionUser(currentUser: AuthUser | null, isHydrating = false) {
  jest.mocked(useSession).mockReturnValue({
    currentUser,
    isHydrating,
    refreshSession,
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  });
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

async function flushAsync() {
  for (let index = 0; index < 8; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flushAsync();
}

async function renderScreen() {
  await render(<PracticeWriteScreen />);
  await flushAsync();
}

// 질문을 불러온 화면까지 그린다.
async function renderLoaded() {
  await renderScreen();
  expect(screen.getByText(QUESTION_EN)).toBeOnTheScreen();
}

function rewriteParams(extra: WriteParams = {}): WriteParams {
  return { difficulty: "A", promptId: "prompt-1", mode: "rewrite", ...extra };
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function answerInput() {
  return screen.getByPlaceholderText(ANSWER_PLACEHOLDER, { includeHiddenElements: true });
}

function coachInput() {
  return screen.getByPlaceholderText(COACH_PLACEHOLDER);
}

function modalHosts() {
  return findHost(screen.root!, "Modal");
}

function openModal() {
  const modals = modalHosts();
  expect(modals).toHaveLength(1);
  return modals[0];
}

function lastAlert() {
  return alertSpy.mock.calls.at(-1) as [string, string, { text: string; style?: string; onPress?: () => void }[]?];
}

function pressText(text: string) {
  return fireEvent.press(screen.getByText(text));
}

function submitButtonText(label: string) {
  return screen.getAllByText(label).at(-1)!;
}

async function openCoach() {
  await fireEvent.press(screen.getByRole("button", { name: "AI 코치 열기" }));
}

async function askCoach(question: string) {
  await fireEvent.changeText(coachInput(), question);
  await pressText(COACH_REQUEST);
  await flushAsync();
}

async function typeAnswer(text: string) {
  await fireEvent.changeText(answerInput(), text);
}

// 제출을 누르고, 제출 중 화면이 끝까지 돈 뒤에 서버 응답을 돌려준다.
async function submitAndResolve(label: string, response: Feedback) {
  const pending = deferred<Feedback>();
  jest.mocked(submitFeedback).mockReturnValueOnce(pending.promise);
  await fireEvent.press(submitButtonText(label));
  await flushAsync();
  await act(async () => {
    pending.resolve(response);
  });
  await flushAsync();
}

async function submitAndReject(label: string, reason: unknown) {
  const pending = deferred<Feedback>();
  jest.mocked(submitFeedback).mockReturnValueOnce(pending.promise);
  await fireEvent.press(submitButtonText(label));
  await flushAsync();
  await act(async () => {
    pending.reject(reason);
  });
  await flushAsync();
}

async function emitAppState(state: string) {
  await act(async () => {
    appStateSubscriptions.filter((subscription) => !subscription.removed).forEach((subscription) => subscription.listener(state));
  });
  await flushAsync();
}

// 화면 구조 기록용: 호스트 요소의 종류, 이 화면이 정하는 속성(스타일은 펼친 값), 자식만 남긴다.
// React Native 안쪽에서 붙는 속성과 함수는 빼서, 화면 코드가 그대로면 같은 결과가 나오게 한다.
const STRUCTURE_PROPS = new Set([
  "accessibilityHint",
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
  "accessibilityViewIsModal",
  "accessible",
  "animationType",
  "color",
  "contentContainerStyle",
  "editable",
  "horizontal",
  "keyboardDismissMode",
  "keyboardShouldPersistTaps",
  "multiline",
  "placeholder",
  "placeholderTextColor",
  "pointerEvents",
  "resizeMode",
  "showsHorizontalScrollIndicator",
  "showsVerticalScrollIndicator",
  "source",
  "style",
  "textAlignVertical",
  "value",
  "visible"
]);
const TEST_JSON = Symbol.for("react.test.json");

type StructureNode = {
  $$typeof: symbol;
  type: string;
  props: Record<string, unknown>;
  children: (StructureNode | string)[] | null;
};

function structureOf(node: TestInstance): StructureNode {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (value === undefined || typeof value === "function") {
      continue;
    }
    if (STRUCTURE_PROPS.has(key)) {
      props[key] = key.endsWith("tyle") ? StyleSheet.flatten(value) : value;
    }
  }
  const children = node.children.map((child) => (typeof child === "string" ? child : structureOf(child)));
  return { $$typeof: TEST_JSON, type: node.type, props, children: children.length > 0 ? children : null };
}

function screenStructure() {
  return structureOf(screen.root!);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  clearPracticeFeedbackState();
  setParams({ difficulty: "A", promptId: "prompt-1" });
  navigation.canGoBack.mockReset().mockReturnValue(true);
  navigation.goBack.mockReset();
  jest.mocked(useNavigation).mockReset().mockReturnValue(navigation as unknown as ReturnType<typeof useNavigation>);
  jest.mocked(useIsFocused).mockReset().mockReturnValue(true);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(randomUUID).mockReset().mockReturnValueOnce("uuid-1").mockReturnValueOnce("uuid-2").mockReturnValue("uuid-n");
  jest.mocked(getDailyPrompts).mockReset().mockResolvedValue(recommendation());
  jest.mocked(getPrompts).mockReset().mockResolvedValue([]);
  jest.mocked(getPromptHints).mockReset().mockResolvedValue([]);
  jest.mocked(getWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveWritingDraft).mockReset().mockResolvedValue(writingDraft({ updatedAt: DRAFT_SAVED_AT_2 }));
  jest.mocked(deleteWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(requestCoachHelp).mockReset();
  jest.mocked(saveExpression).mockReset();
  jest.mocked(submitFeedback).mockReset();
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue(GUEST_ID);
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);
  jest.mocked(getLocalWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(saveIncompleteLoop).mockReset().mockResolvedValue(undefined);
  jest.mocked(clearIncompleteLoopForPrompt).mockReset().mockResolvedValue(undefined);
  appStateSubscriptions = [];
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation((_type, listener) => {
    const subscription = { listener: listener as (state: string) => void, removed: false };
    appStateSubscriptions.push(subscription);
    return {
      remove: () => {
        subscription.removed = true;
      }
    };
  });
  refreshSession.mockReset().mockResolvedValue(null);
  setSessionUser(signedInUser);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  keyboardDismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  keyboardDismissSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 질문 불러오기 ----------

describe("[spec] 질문 불러오기", () => {
  it("[spec] 불러오는 동안 머리와 불러오는 중 표시만 보이고, 불러오면 질문이 보인다", async () => {
    const pending = deferred<DailyPromptRecommendation>();
    jest.mocked(getDailyPrompts).mockReturnValue(pending.promise);

    await renderScreen();

    expect(screen.getByText("작문")).toBeOnTheScreen();
    const spinners = findHost(screen.root!, "ActivityIndicator");
    expect(spinners).toHaveLength(1);
    expect(spinners[0].props.color).toBe("#E38B12");
    expect(screen.queryByPlaceholderText(ANSWER_PLACEHOLDER)).toBeNull();
    expect(screen.queryByText(NOT_FOUND_TITLE)).toBeNull();
    expect(screen.queryByText(QUESTION_EN)).toBeNull();

    await act(async () => {
      pending.resolve(recommendation());
    });
    await flushAsync();

    expect(screen.getByText(QUESTION_EN)).toBeOnTheScreen();
    expect(findHost(screen.root!, "ActivityIndicator")).toHaveLength(0);
  });

  it("[spec] 로그인 상태를 불러오는 중이면 질문을 부르지 않고 불러오는 중 표시를 두다가, 끝나면 불러온다", async () => {
    setSessionUser(signedInUser, true);

    await renderScreen();

    expect(getDailyPrompts).not.toHaveBeenCalled();
    expect(findHost(screen.root!, "ActivityIndicator")).toHaveLength(1);

    setSessionUser(signedInUser, false);
    await screen.rerender(<PracticeWriteScreen />);
    await flushAsync();

    expect(getDailyPrompts).toHaveBeenCalledTimes(1);
    expect(screen.getByText(QUESTION_EN)).toBeOnTheScreen();
  });

  it("[spec] 로그인 사용자의 처음 쓰기: 게스트 아이디 없이 오늘 질문을 부르고, 서버·이 기기 초안을 찾고, 빈 답으로 시작한다", async () => {
    await renderLoaded();

    expect(refreshSession).not.toHaveBeenCalled();
    expect(getOrCreateGuestId).not.toHaveBeenCalled();
    expect(getDailyPrompts).toHaveBeenCalledTimes(1);
    expect(getDailyPrompts).toHaveBeenCalledWith("A", undefined);
    expect(getPrompts).not.toHaveBeenCalled();
    expect(hydratePracticeFeedbackState).toHaveBeenCalledWith("A", "prompt-1");
    expect(getWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(getPromptHints).toHaveBeenCalledTimes(1);
    expect(getPromptHints).toHaveBeenCalledWith("prompt-1");

    expect(answerInput()).toHaveDisplayValue("");
    expect(answerInput()).toBeEnabled();
    expect(screen.getByText("0단어")).toBeOnTheScreen();
    expect(screen.getByText(SUBMIT_INITIAL)).toBeOnTheScreen();
    expect(screen.getByText(COACH_BUBBLE)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "작문 취소" })).toBeOnTheScreen();
    expect(screen.getByText("해석 보기")).toBeOnTheScreen();
    expect(screen.getAllByText(GUIDE_OPEN)).toHaveLength(1);
    expect(screen.getAllByText(GUIDE_OPEN, { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByText(prompt.questionKo)).toBeNull();
    expect(screen.queryByText(REWRITE_EYEBROW)).toBeNull();
    expect(screen.queryByText(PREVIOUS_FEEDBACK)).toBeNull();
    expect(screen.queryByText(TAG_EYEBROW)).toBeNull();
    expect(screen.queryByText(/임시저장|저장됨/)).toBeNull();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 게스트: 로그인 상태를 다시 확인한 뒤 게스트 아이디로 오늘 질문을 부르고, 서버 초안은 찾지 않는다", async () => {
    setSessionUser(null);

    await renderLoaded();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(getOrCreateGuestId).toHaveBeenCalledTimes(1);
    expect(getDailyPrompts).toHaveBeenCalledWith("A", GUEST_ID);
    expect(getWritingDraft).not.toHaveBeenCalled();
    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
  });

  it("[spec] 게스트인데 다시 확인한 로그인 상태에 사용자가 있으면 게스트 아이디 없이 부르고, 서버 초안은 여전히 찾지 않는다", async () => {
    setSessionUser(null);
    refreshSession.mockResolvedValue(signedInUser);

    await renderLoaded();

    expect(getOrCreateGuestId).not.toHaveBeenCalled();
    expect(getDailyPrompts).toHaveBeenCalledWith("A", undefined);
    expect(getWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 로그인 상태 확인이 실패하면 게스트로 보고, 게스트 아이디가 비면 아이디 없이 부른다", async () => {
    setSessionUser(null);
    refreshSession.mockRejectedValue(new Error("세션 확인 실패"));
    jest.mocked(getOrCreateGuestId).mockResolvedValue("");

    await renderLoaded();

    expect(getOrCreateGuestId).toHaveBeenCalledTimes(1);
    expect(getDailyPrompts).toHaveBeenCalledWith("A", undefined);
  });

  it("[spec] 오늘 질문에 없으면 전체 질문에서 같은 난이도의 질문을 찾아 보인다", async () => {
    jest.mocked(getDailyPrompts).mockResolvedValue(recommendation([prompt2, prompt3]));
    jest.mocked(getPrompts).mockResolvedValue([prompt2, prompt]);

    await renderLoaded();

    expect(getPrompts).toHaveBeenCalledTimes(1);
  });

  it("[spec] 전체 질문에 있어도 난이도가 다르면 찾지 못한 안내를 보이고, 돌아가기를 누르면 그 난이도의 질문 목록으로 바꾼다", async () => {
    jest.mocked(getDailyPrompts).mockResolvedValue(recommendation([prompt2, prompt3]));
    jest.mocked(getPrompts).mockResolvedValue([{ ...prompt, difficulty: "C" }]);

    await renderScreen();

    expect(screen.getByText(NOT_FOUND_TITLE)).toBeOnTheScreen();
    expect(screen.getByText(NOT_FOUND_BODY)).toBeOnTheScreen();
    expect(screen.queryByText(NOT_FOUND_ERROR)).toBeNull();
    expect(screen.queryByPlaceholderText(ANSWER_PLACEHOLDER)).toBeNull();
    expect(findHost(screen.root!, "ActivityIndicator")).toHaveLength(0);

    await pressText(BACK_TO_LIST);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
  });

  it("[spec] 질문 아이디가 없으면 아무것도 부르지 않고 찾지 못한 안내를 보인다", async () => {
    setParams({ difficulty: "A" });

    await renderScreen();

    expect(getDailyPrompts).not.toHaveBeenCalled();
    expect(getLocalWritingDraft).not.toHaveBeenCalled();
    expect(screen.getByText(NOT_FOUND_TITLE)).toBeOnTheScreen();
    expect(screen.queryByText(NOT_FOUND_ERROR)).toBeNull();
  });

  it("[spec] 오늘 질문을 부르다 실패하면 찾지 못한 안내를 보이고, 실패 문구는 보이지 않는다", async () => {
    jest.mocked(getDailyPrompts).mockRejectedValue(new Error("서버가 바빠요"));

    await renderScreen();

    expect(screen.getByText(NOT_FOUND_TITLE)).toBeOnTheScreen();
    expect(screen.queryByText("서버가 바빠요")).toBeNull();
    expect(findHost(screen.root!, "ActivityIndicator")).toHaveLength(0);
  });

  it("[spec] 난이도 값이 맞지 않으면 I 난이도로 찾고, 돌아가기도 I 난이도 질문 목록으로 간다", async () => {
    setParams({ difficulty: "Z", promptId: "prompt-9" });

    await renderScreen();

    expect(getDailyPrompts).toHaveBeenCalledWith("I", undefined);
    await pressText(BACK_TO_LIST);
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/practice/[difficulty]", params: { difficulty: "I" } });
  });

  it("[spec] 로그인 사용자의 서버 초안이 있으면 그 답과 서버 저장 시각 배지로 시작하고, 이 기기 초안은 찾지 않는다", async () => {
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());

    await renderLoaded();

    expect(getLocalWritingDraft).not.toHaveBeenCalled();
    expect(answerInput()).toHaveDisplayValue("I drink coffee.");
    expect(screen.getByText("3단어")).toBeOnTheScreen();
    expect(screen.getByText(`임시저장됨 · ${DRAFT_SAVED_TIME}`)).toHaveStyle(BADGE_NORMAL);
    expect(screen.queryByText(COACH_BUBBLE)).toBeNull();
  });

  it("[spec] 로그인 사용자에게 서버 초안이 없고 이 기기 초안이 있으면 그 답과 저장 시각 배지로 시작한다", async () => {
    jest.mocked(getLocalWritingDraft).mockResolvedValue(writingDraft({ answer: "I drink tea." }));

    await renderLoaded();

    expect(answerInput()).toHaveDisplayValue("I drink tea.");
    expect(screen.getByText(`임시저장됨 · ${DRAFT_SAVED_TIME}`)).toBeOnTheScreen();
  });

  it("[spec] 로그인 사용자의 초안에 저장 시각이 없으면 '이 기기에 저장됨' 배지로 시작한다", async () => {
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft({ updatedAt: "" }));

    await renderLoaded();

    expect(screen.getByText(LOCAL_SAVED_BADGE)).toHaveStyle(BADGE_NORMAL);
  });

  it("[spec] 게스트의 이 기기 초안이 있으면 그 답과 '이 기기에 저장됨' 배지로 시작한다", async () => {
    setSessionUser(null);
    jest.mocked(getLocalWritingDraft).mockResolvedValue(writingDraft());

    await renderLoaded();

    expect(answerInput()).toHaveDisplayValue("I drink coffee.");
    expect(screen.getByText(LOCAL_SAVED_BADGE)).toBeOnTheScreen();
  });

  it("[spec] 초안을 읽다 실패하면 빈 답과 배지 없이 시작한다", async () => {
    jest.mocked(getWritingDraft).mockRejectedValue(new Error("읽기 실패"));

    await renderLoaded();

    expect(getLocalWritingDraft).not.toHaveBeenCalled();
    expect(answerInput()).toHaveDisplayValue("");
    expect(screen.queryByText(/임시저장|저장됨/)).toBeNull();
  });

  it("[spec] 처음 쓰기에서는 저장된 피드백이 있어도 다시 쓰기 안내 없이 시작한다", async () => {
    savePracticeFeedbackState(savedState());

    await renderLoaded();

    expect(hydratePracticeFeedbackState).not.toHaveBeenCalled();
    expect(answerInput()).toHaveDisplayValue("");
    expect(screen.queryByText(REWRITE_EYEBROW)).toBeNull();
    expect(screen.getByText(SUBMIT_INITIAL)).toBeOnTheScreen();
  });

  it("[spec] 다시 쓰기: 메모리의 피드백으로 다시 쓰기 안내를 보이고, 피드백 때 답으로 시작한다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());

    await renderLoaded();

    expect(hydratePracticeFeedbackState).not.toHaveBeenCalled();
    expect(getWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(answerInput()).toHaveDisplayValue("I wake up early.");
    expect(answerInput()).toBeEnabled();
    expect(screen.getByText(REWRITE_EYEBROW)).toBeOnTheScreen();
    expect(screen.getByText("이유를 한 문장 더해 보세요")).toBeOnTheScreen();
    expect(screen.getByText("because로 이유를 붙여 다시 써 보세요.")).toBeOnTheScreen();
    expect(screen.getAllByText(PREVIOUS_FEEDBACK)).toHaveLength(2);
    expect(screen.getByText(SUBMIT_REWRITE)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "작문 취소" })).toBeOnTheScreen();
    expect(screen.queryByText(/임시저장|저장됨/)).toBeNull();
    expect(deleteWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 다시 쓰기: 메모리에 없으면 저장된 피드백을 불러와 쓴다", async () => {
    setParams(rewriteParams());
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(savedState());

    await renderLoaded();

    expect(hydratePracticeFeedbackState).toHaveBeenCalledWith("A", "prompt-1");
    expect(answerInput()).toHaveDisplayValue("I wake up early.");
    expect(screen.getByText(REWRITE_EYEBROW)).toBeOnTheScreen();
  });

  it("[spec] 다시 쓰기 안내의 제목·본문은 코치 포인트가 없으면 루프 문구·완료 문구·요약·기본 문구 순서로 고른다", async () => {
    savePracticeFeedbackState(
      savedState(makeFeedback({ loop: { headline: "  루프 제목  " }, completionMessage: "   ", summary: "요약 문구" }))
    );
    setParams(rewriteParams());

    await renderLoaded();

    expect(screen.getByText("루프 제목")).toBeOnTheScreen();
    expect(screen.getByText("요약 문구")).toBeOnTheScreen();
  });

  it("[spec] 다시 쓰기 안내에 쓸 문구가 하나도 없으면 기본 제목과 본문을 보인다", async () => {
    savePracticeFeedbackState(savedState(makeFeedback({ coachMove: { focus: " ", instruction: "" } })));
    setParams(rewriteParams());

    await renderLoaded();

    expect(screen.getByText("이번엔 한 가지만 적용해 봐요")).toBeOnTheScreen();
    expect(screen.getByText("방금 받은 피드백을 반영해 다시 써 보세요.")).toBeOnTheScreen();
  });

  it("[spec] 다시 쓰기에서 이어 쓰기가 아니면 남은 다시 쓰기 초안을 서버·이 기기에서 지우고 피드백 때 답으로 시작한다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    jest.mocked(getWritingDraft).mockResolvedValue(rewriteDraft());

    await renderLoaded();

    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(answerInput()).toHaveDisplayValue("I wake up early.");
    expect(screen.queryByText(/임시저장|저장됨/)).toBeNull();
  });

  it("[spec] 남은 다시 쓰기 초안의 서버 지우기가 실패해도 이 기기 초안을 지우고, 이 기기 지우기 실패도 넘어간다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    jest.mocked(getWritingDraft).mockResolvedValue(rewriteDraft());
    jest.mocked(deleteWritingDraft).mockRejectedValue(new Error("서버 지우기 실패"));
    jest.mocked(deleteLocalWritingDraft).mockRejectedValue(new Error("기기 지우기 실패"));

    await renderLoaded();

    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(answerInput()).toHaveDisplayValue("I wake up early.");
    expect(screen.getByText(REWRITE_EYEBROW)).toBeOnTheScreen();
  });

  it("[spec] 게스트의 다시 쓰기에서는 남은 이 기기 다시 쓰기 초안만 지운다", async () => {
    setSessionUser(null);
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    jest.mocked(getLocalWritingDraft).mockResolvedValue(rewriteDraft());

    await renderLoaded();

    expect(deleteWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
  });

  it("[spec] 이어 쓰기(resume=1): 다시 쓰기 초안의 다시 쓴 글과 저장 시각 배지로 시작하고 초안을 지우지 않는다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams({ resume: "1" }));
    jest.mocked(getWritingDraft).mockResolvedValue(rewriteDraft());

    await renderLoaded();

    expect(answerInput()).toHaveDisplayValue("I wake up early because I have class.");
    expect(screen.getByText(`임시저장됨 · ${DRAFT_SAVED_TIME}`)).toBeOnTheScreen();
    expect(screen.getByText(REWRITE_EYEBROW)).toBeOnTheScreen();
    expect(deleteWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 이어 쓰기에서 초안의 다시 쓴 글이 비었으면 초안의 처음 답으로 시작한다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams({ resume: "1" }));
    jest.mocked(getWritingDraft).mockResolvedValue(rewriteDraft({ rewrite: "" }));

    await renderLoaded();

    expect(answerInput()).toHaveDisplayValue("I wake up early every day.");
  });

  it("[spec] 다시 쓰기인데 저장된 피드백이 없으면 피드백 없이 빈 답으로 시작한다", async () => {
    setParams(rewriteParams());

    await renderLoaded();

    expect(getWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(answerInput()).toHaveDisplayValue("");
    expect(screen.queryByText(REWRITE_EYEBROW)).toBeNull();
    expect(screen.getByText(SUBMIT_INITIAL)).toBeOnTheScreen();
  });

  it("[spec] 연습 표현(prefillExpression)으로 열면 초안 대신 그 표현으로 답을 채우고 배지를 비운다(태그 이름이 없으면 태그 카드 없음)", async () => {
    setParams({ difficulty: "A", promptId: "prompt-1", prefillExpression: "  on a regular basis  " });
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());

    await renderLoaded();

    expect(answerInput()).toHaveDisplayValue("on a regular basis");
    expect(screen.queryByText(/임시저장|저장됨/)).toBeNull();
    expect(screen.queryByText(TAG_EYEBROW)).toBeNull();
  });

  it("[spec] 태그 연습으로 열면 태그 카드에 고른 표현(중복·덜 끝난 표현·문자 아닌 값 제외)을 보이고 첫 표현으로 답을 채운다", async () => {
    setParams({
      difficulty: "A",
      promptId: "prompt-1",
      practiceTag: "routine",
      practiceTagLabel: "  일상  ",
      practiceExpressions: JSON.stringify(["take a walk", "Take  a  walk", "go to the", 3, "  read the news  ", "", "wake up early"])
    });

    await renderLoaded();

    expect(screen.getByText(TAG_EYEBROW)).toBeOnTheScreen();
    expect(screen.getByText("일상 태그로 저장한 표현을 활용해 새 문장을 써보세요.")).toBeOnTheScreen();
    expect(screen.getByText("take a walk")).toBeOnTheScreen();
    expect(screen.getByText("read the news")).toBeOnTheScreen();
    expect(screen.getByText("wake up early")).toBeOnTheScreen();
    expect(screen.queryByText("go to the")).toBeNull();
    expect(screen.queryByText("Take  a  walk")).toBeNull();
    expect(answerInput()).toHaveDisplayValue("take a walk");
  });

  it("[spec] 태그 연습의 표현 목록을 읽을 수 없으면 연습 표현 하나로 태그 카드를 만든다", async () => {
    setParams({
      difficulty: "A",
      promptId: "prompt-1",
      practiceTagLabel: "일상",
      practiceExpressions: "not json",
      prefillExpression: "take a walk"
    });

    await renderLoaded();

    expect(screen.getByText(TAG_EYEBROW)).toBeOnTheScreen();
    expect(screen.getByText("take a walk")).toBeOnTheScreen();
    expect(answerInput()).toHaveDisplayValue("take a walk");
  });

  it("[spec] 연습 표현이 덜 끝난 표현이면 답은 채우지만 태그 카드는 없다", async () => {
    setParams({ difficulty: "A", promptId: "prompt-1", practiceTagLabel: "일상", prefillExpression: "because of" });

    await renderLoaded();

    expect(answerInput()).toHaveDisplayValue("because of");
    expect(screen.queryByText(TAG_EYEBROW)).toBeNull();
  });

  it("[spec] 같은 화면에서 질문이 바뀌면 새 질문과 그 초안·추천을 불러오고, 해석을 숨기고 열린 창을 닫는다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await pressText("해석 보기");
    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);
    expect(modalHosts()).toHaveLength(1);

    setParams({ difficulty: "A", promptId: "prompt-2" });
    await screen.rerender(<PracticeWriteScreen />);
    await flushAsync();

    expect(screen.getByText(prompt2.questionEn)).toBeOnTheScreen();
    expect(getDailyPrompts).toHaveBeenCalledTimes(2);
    expect(getWritingDraft).toHaveBeenLastCalledWith("prompt-2", "ANSWER");
    expect(getPromptHints).toHaveBeenLastCalledWith("prompt-2");
    expect(answerInput()).toHaveDisplayValue("");
    expect(screen.getByText("해석 보기")).toBeOnTheScreen();
    expect(screen.queryByText(prompt2.questionKo)).toBeNull();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 다시 쓰기에서는 연습 표현으로 답을 채우지 않고, 피드백이 있어 태그 카드도 없다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams({ practiceTagLabel: "일상", prefillExpression: "take a walk" }));

    await renderLoaded();

    expect(answerInput()).toHaveDisplayValue("I wake up early.");
    expect(screen.queryByText(TAG_EYEBROW)).toBeNull();
  });
});

// ---------- 머리 ----------

describe("[spec] 머리", () => {
  it("[spec] 작문 제목과 뒤로가기 버튼이 있고, 돌아갈 화면이 있으면 뒤로 간다", async () => {
    await renderLoaded();

    expect(screen.getByText("작문")).toBeOnTheScreen();
    expect(screen.getByText("<")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "뒤로가기" }));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("[spec] 돌아갈 화면이 없으면 그 난이도의 질문 목록으로 바꾼다", async () => {
    navigation.canGoBack.mockReturnValue(false);
    await renderLoaded();

    await fireEvent.press(screen.getByRole("button", { name: "뒤로가기" }));

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
  });
});

// ---------- 질문 요약 카드 ----------

describe("[spec] 질문 요약 카드", () => {
  it("[spec] 해석 보기를 누르면 질문 해석이 보이고 '해석 숨기기'로 바뀌며, 다시 누르면 숨는다", async () => {
    await renderLoaded();

    await pressText("해석 보기");
    expect(screen.getByText(prompt.questionKo)).toBeOnTheScreen();
    expect(screen.getByText("해석 숨기기")).toBeOnTheScreen();
    expect(screen.queryByText("해석 보기")).toBeNull();

    await pressText("해석 숨기기");
    expect(screen.queryByText(prompt.questionKo)).toBeNull();
    expect(screen.getByText("해석 보기")).toBeOnTheScreen();
  });

  it("[spec] 요약 카드의 가이드 보기를 누르면 작성 가이드 창이 열린다", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    expect(within(openModal()).getByText(GUIDE_TITLE)).toBeOnTheScreen();
  });

  it("[spec] 피드백이 있으면 요약 카드의 이전 피드백 보기를 누르면 이전 피드백 창이 열린다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[0]);

    expect(within(openModal()).getByText(PREVIOUS_FEEDBACK)).toBeOnTheScreen();
  });

  it("[spec] 제출해 피드백이 생기면 태그 카드가 사라진다", async () => {
    setParams({ difficulty: "A", promptId: "prompt-1", practiceTagLabel: "일상", prefillExpression: "take a walk" });
    await renderLoaded();
    expect(screen.getByText(TAG_EYEBROW)).toBeOnTheScreen();

    await submitAndResolve(SUBMIT_INITIAL, nextFeedback());

    expect(screen.queryByText(TAG_EYEBROW)).toBeNull();
  });
});

// ---------- 답 쓰기 카드 ----------

describe("[spec] 답 쓰기 카드", () => {
  it("[spec] 답을 쓰면 단어 수가 바뀌고, 답이 비어 있을 때만 AI 코치 말풍선이 보인다", async () => {
    await renderLoaded();

    await typeAnswer("   ");
    expect(screen.getByText("0단어")).toBeOnTheScreen();
    expect(screen.getByText(COACH_BUBBLE)).toBeOnTheScreen();

    await typeAnswer("  I  wake up\n early  ");
    expect(screen.getByText("4단어")).toBeOnTheScreen();
    expect(screen.queryByText(COACH_BUBBLE)).toBeNull();
    expect(screen.getByRole("button", { name: "AI 코치 열기" })).toBeOnTheScreen();
  });

  it("[spec] AI 코치 열기 버튼은 안내 힌트를 갖고, 누르면 코치 창이 열리며 버튼이 사라진다", async () => {
    await renderLoaded();

    const trigger = screen.getByRole("button", { name: "AI 코치 열기" });
    expect(trigger.props.accessibilityHint).toBe("표현 추천 패널을 엽니다.");
    await fireEvent.press(trigger);

    expect(within(openModal()).getByText(COACH_TITLE)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "AI 코치 열기" })).toBeNull();
  });

  it("[spec] 답 쓰기 카드의 가이드 보기 줄은 숨겨져 있어(display: none) 요약 카드의 가이드 보기만 보인다", async () => {
    await renderLoaded();

    const guideButtons = screen.getAllByText(GUIDE_OPEN, { includeHiddenElements: true });
    expect(guideButtons).toHaveLength(2);
    expect(guideButtons[0]).toBeVisible();
    expect(guideButtons[1]).not.toBeVisible();
    expect(guideButtons[1].parent!.parent!).toHaveStyle({ display: "none" });
  });

  it("[spec] 빈 답으로 제출하면 입력 오류와 문제 보내기를 보이고 제출하지 않으며, 문제 보내기를 누르면 문제 보내기 화면으로 간다", async () => {
    await renderLoaded();
    await typeAnswer("   ");

    await pressText(SUBMIT_INITIAL);

    expect(screen.getByText(EMPTY_ANSWER_ERROR)).toBeOnTheScreen();
    expect(screen.getByText("문제가 반복되나요? 문제 보내기")).toBeOnTheScreen();
    expect(submitFeedback).not.toHaveBeenCalled();
    expect(keyboardDismissSpy).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: PROBLEM_REPORT }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/support-feedback",
      params: { source: "practice_write", errorCode: "PRACTICE_SCREEN_ERROR", category: "BUG" }
    });
  });

  it("[spec] 로그인 사용자가 제출에 성공하면 피드백 상태를 저장하고 초안·이어 쓰기 상태를 정리한 뒤 피드백 화면으로 간다", async () => {
    const response = nextFeedback();
    await renderLoaded();
    await typeAnswer("  I drink coffee.  ");

    await submitAndResolve(SUBMIT_INITIAL, response);

    expect(keyboardDismissSpy).toHaveBeenCalledTimes(1);
    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(submitFeedback).toHaveBeenCalledWith({
      promptId: "prompt-1",
      answer: "I drink coffee.",
      sessionId: undefined,
      attemptType: "INITIAL",
      guestId: undefined,
      submissionId: "uuid-1"
    });
    expect(getPracticeFeedbackState("A", "prompt-1")).toEqual({
      difficulty: "A",
      prompt,
      initialAnswer: "I drink coffee.",
      answer: "I drink coffee.",
      feedback: response
    });
    expect(deleteWritingDraft).toHaveBeenLastCalledWith("prompt-1", "ANSWER");
    expect(deleteLocalWritingDraft).toHaveBeenLastCalledWith("prompt-1", "ANSWER");
    expect(saveIncompleteLoop).toHaveBeenLastCalledWith({
      promptId: "prompt-1",
      difficulty: "A",
      step: "feedback",
      draftType: null,
      sessionId: "session-9",
      updatedAt: NOW.toISOString(),
      promptSnapshot
    });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(FEEDBACK_ROUTE);
  });

  it("[spec] 제출에 성공하면 답이 잠기고, 버튼이 '피드백 보기'로 바뀌며, 작문 취소가 사라지고, 새 피드백의 다시 쓰기 안내가 보인다", async () => {
    await renderLoaded();
    await typeAnswer("  I drink coffee.  ");

    await submitAndResolve(SUBMIT_INITIAL, nextFeedback());

    expect(answerInput()).toBeDisabled();
    expect(answerInput()).toHaveDisplayValue("  I drink coffee.  ");
    expect(screen.getAllByText(VIEW_FEEDBACK)).toHaveLength(3);
    expect(screen.queryByText(SUBMIT_INITIAL)).toBeNull();
    expect(screen.queryByText(PREVIOUS_FEEDBACK)).toBeNull();
    expect(screen.queryByRole("button", { name: "작문 취소" })).toBeNull();
    expect(screen.getByText(REWRITE_EYEBROW)).toBeOnTheScreen();
    expect(screen.getByText("시간 표현을 더해 보세요")).toBeOnTheScreen();
    expect(screen.getByText("every morning을 넣어 다시 써 보세요.")).toBeOnTheScreen();

    await fireEvent.changeText(answerInput(), "I drink tea.");
    expect(answerInput()).toHaveDisplayValue("  I drink coffee.  ");
  });

  it("[spec] 잠긴 뒤 '피드백 보기'를 누르면 다시 제출하지 않고 피드백 화면으로 간다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await submitAndResolve(SUBMIT_INITIAL, nextFeedback());

    await fireEvent.press(submitButtonText(VIEW_FEEDBACK));

    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenLastCalledWith(FEEDBACK_ROUTE);
  });

  it("[spec] 제출 중에는 버튼 문구 대신 불러오는 중 표시가 돌고, 제출·작문 취소가 눌리지 않으며, 처음 쓰기 기다림 화면이 보인다", async () => {
    const pending = deferred<Feedback>();
    jest.mocked(submitFeedback).mockReturnValue(pending.promise);
    await renderLoaded();
    await typeAnswer("I drink coffee.");

    await pressText(SUBMIT_INITIAL);
    await flushAsync();

    expect(screen.queryByText(SUBMIT_INITIAL, { includeHiddenElements: true })).toBeNull();
    const submitSpinners = findHost(screen.root!, "ActivityIndicator").filter((spinner) => spinner.props.color === "#2E2416");
    expect(submitSpinners).toHaveLength(1);
    expect(submitSpinners[0]).toBeDisabled();
    expect(screen.getByRole("button", { name: "작문 취소", includeHiddenElements: true })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(INITIAL_OVERLAY_NAME);

    await act(async () => {
      pending.resolve(nextFeedback());
    });
    await flushAsync();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("[spec] 같은 답으로 다시 제출하면 같은 제출 아이디를 쓰고, 답이 바뀌면 새 아이디를 쓴다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await submitAndReject(SUBMIT_INITIAL, new Error("잠깐 실패"));
    expect(screen.getByText("잠깐 실패")).toBeOnTheScreen();

    await typeAnswer(" I drink coffee. ");
    await submitAndReject(SUBMIT_INITIAL, new Error("또 실패"));
    await typeAnswer("I drink tea.");
    await submitAndReject(SUBMIT_INITIAL, new Error("세 번째 실패"));

    const submissionIds = jest.mocked(submitFeedback).mock.calls.map((call) => call[0].submissionId);
    expect(submissionIds).toEqual(["uuid-1", "uuid-1", "uuid-2"]);
    expect(screen.getByText("세 번째 실패")).toBeOnTheScreen();
    expect(screen.queryByText("잠깐 실패")).toBeNull();
  });

  it("[spec] 게스트 체험 한도에 걸리면 안내 오류와 로그인 권유 창을 보이고, 로그인하기를 누르면 로그인 화면으로 간다", async () => {
    setSessionUser(null);
    await renderLoaded();
    await typeAnswer("I drink coffee.");

    await submitAndReject(SUBMIT_INITIAL, new ApiError("한도 초과", 403, "GUEST_LIMIT_REACHED"));

    expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({ guestId: GUEST_ID }));
    expect(screen.getByText(GUEST_LIMIT_ERROR)).toBeOnTheScreen();
    expect(screen.queryByText("한도 초과")).toBeNull();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith("로그인하고 이어서 써 보세요", "로그인하면 지금 쓰던 답변을 그대로 이어서 쓸 수 있어요.", [
      { text: "나중에", style: "cancel" },
      { text: "로그인하기", onPress: expect.any(Function) }
    ]);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByText(SUBMIT_INITIAL)).toBeOnTheScreen();

    lastAlert()[2]![1].onPress!();
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("[spec] 그 밖의 제출 오류는 오류 문구를, 오류 객체가 아니면 기본 문구를 보이고 로그인 권유 창은 띄우지 않는다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");

    await submitAndReject(SUBMIT_INITIAL, new ApiError("서버가 바빠요", 503, "BUSY"));
    expect(screen.getByText("서버가 바빠요")).toBeOnTheScreen();

    await typeAnswer("I drink tea.");
    await submitAndReject(SUBMIT_INITIAL, "boom");
    expect(screen.getByText("피드백을 생성하지 못했어요.")).toBeOnTheScreen();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("[spec] 다시 쓰기에서 제출하면 앞 세션으로 다시 쓰기 제출을 하고, 다시 쓰기 기다림 화면을 보이며, 처음 답을 지켜 저장한다", async () => {
    const response = nextFeedback({ sessionId: "session-1", attemptNo: 2 });
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();
    await typeAnswer("I wake up early because I have class.");

    const pending = deferred<Feedback>();
    jest.mocked(submitFeedback).mockReturnValue(pending.promise);
    await pressText(SUBMIT_REWRITE);
    await flushAsync();
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(REWRITE_OVERLAY_NAME);
    await act(async () => {
      pending.resolve(response);
    });
    await flushAsync();

    expect(submitFeedback).toHaveBeenCalledWith({
      promptId: "prompt-1",
      answer: "I wake up early because I have class.",
      sessionId: "session-1",
      attemptType: "REWRITE",
      guestId: undefined,
      submissionId: "uuid-1"
    });
    expect(getPracticeFeedbackState("A", "prompt-1")).toEqual({
      difficulty: "A",
      prompt,
      initialAnswer: "I wake up.",
      answer: "I wake up early because I have class.",
      feedback: response
    });
    expect(deleteWritingDraft).toHaveBeenLastCalledWith("prompt-1", "REWRITE");
    expect(deleteLocalWritingDraft).toHaveBeenLastCalledWith("prompt-1", "REWRITE");
    expect(saveIncompleteLoop).toHaveBeenLastCalledWith({
      promptId: "prompt-1",
      difficulty: "A",
      step: "feedback",
      draftType: null,
      sessionId: "session-1",
      updatedAt: NOW.toISOString(),
      promptSnapshot
    });
    expect(router.push).toHaveBeenCalledWith(FEEDBACK_ROUTE);
  });

  it("[spec] 저장된 피드백에 처음 답이 없으면 피드백 때 답을 처음 답으로 저장한다", async () => {
    const response = nextFeedback();
    savePracticeFeedbackState(savedState(coachFeedback(), { initialAnswer: undefined }));
    setParams(rewriteParams());
    await renderLoaded();
    await typeAnswer("I wake up early because I have class.");

    await submitAndResolve(SUBMIT_REWRITE, response);

    expect(getPracticeFeedbackState("A", "prompt-1")?.initialAnswer).toBe("I wake up early.");
  });

  it("[spec] 처음 쓰기 제출 뒤 코치 표현으로 답을 바꾸면 잠김이 풀리고, 다시 쓴 답변을 첫 피드백의 세션으로 제출한다", async () => {
    const first = nextFeedback();
    const second = nextFeedback({ attemptNo: 2 });
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await submitAndResolve(SUBMIT_INITIAL, first);

    await openCoach();
    await askCoach("근력을 키우고 싶다");
    await fireEvent.press(screen.getAllByText("문장에 넣기")[0]);
    await pressText("닫기");

    expect(answerInput()).toHaveDisplayValue("I drink coffee. build muscle");
    expect(answerInput()).toBeEnabled();
    expect(screen.getByText(SUBMIT_REWRITE)).toBeOnTheScreen();
    expect(screen.getAllByText(PREVIOUS_FEEDBACK)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "작문 취소" })).toBeOnTheScreen();

    await submitAndResolve(SUBMIT_REWRITE, second);

    expect(jest.mocked(submitFeedback).mock.calls[1][0]).toEqual({
      promptId: "prompt-1",
      answer: "I drink coffee. build muscle",
      sessionId: "session-9",
      attemptType: "REWRITE",
      guestId: undefined,
      submissionId: "uuid-2"
    });
    expect(getPracticeFeedbackState("A", "prompt-1")).toEqual({
      difficulty: "A",
      prompt,
      initialAnswer: "I drink coffee.",
      answer: "I drink coffee. build muscle",
      feedback: second
    });
  });

  it("[spec] 답·배지·피드백이 모두 없으면 작문 취소를 묻지 않고 서버·이 기기 초안과 이어 쓰기 상태를 지운 뒤 질문 목록으로 간다", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByRole("button", { name: "작문 취소" }));
    await flushAsync();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(keyboardDismissSpy).toHaveBeenCalledTimes(1);
    // 취소가 지우는 것만 부른다. 화면을 떠날 때 저장은 저장 함수가 바뀌었다는 이유로 한 번 더 돌지 않는다(작업 041).
    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledTimes(1);
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledWith("prompt-1");
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
  });

  it("[spec] 답이 있으면 작문 취소를 묻고, 계속 쓰기면 아무것도 하지 않는다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");

    await fireEvent.press(screen.getByRole("button", { name: "작문 취소" }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(CANCEL_TITLE, CANCEL_BODY, [
      { text: "계속 쓰기", style: "cancel" },
      { text: "작문 취소", style: "destructive", onPress: expect.any(Function) }
    ]);
    expect(deleteWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(answerInput()).toHaveDisplayValue("I drink coffee.");
  });

  it("[spec] 작문 취소를 확정하면 초안과 이어 쓰기 상태를 지우고 답을 비운 뒤 질문 목록으로 가며, 쓰던 답을 다시 저장하지 않는다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await fireEvent.press(screen.getByRole("button", { name: "작문 취소" }));

    await act(async () => {
      lastAlert()[2]![1].onPress!();
    });
    await flushAsync();

    expect(keyboardDismissSpy).toHaveBeenCalledTimes(1);
    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledTimes(1);
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledWith("prompt-1");
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(LIST_ROUTE_A);
    expect(answerInput()).toHaveDisplayValue("");
    // 취소가 서버·이 기기 초안을 지운 뒤 쓰던 답을 다시 저장하지 않고, 이어 쓰기 상태도 남기지 않는다(작업 041).
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
  });

  it("[spec] 답이 비어도 임시저장 배지가 있으면 작문 취소를 묻는다", async () => {
    setSessionUser(null);
    jest.mocked(getLocalWritingDraft).mockResolvedValue(writingDraft({ answer: "" }));
    await renderLoaded();
    expect(screen.getByText(LOCAL_SAVED_BADGE)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "작문 취소" }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(lastAlert()[0]).toBe(CANCEL_TITLE);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("[spec] 답이 비어도 피드백이 있으면(다시 쓰기) 작문 취소를 묻는다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();
    await typeAnswer("");

    await fireEvent.press(screen.getByRole("button", { name: "작문 취소" }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(lastAlert()[0]).toBe(CANCEL_TITLE);
  });
});

// ---------- 임시저장 ----------

describe("[spec] 임시저장", () => {
  it("[spec] 불러온 뒤 답이 비어 있으면 900ms 뒤 서버·이 기기 초안과 답 쓰기 단계의 이어 쓰기 상태를 지운다", async () => {
    await renderLoaded();

    await advance(899);
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
    expect(clearIncompleteLoopForPrompt).not.toHaveBeenCalled();

    await advance(1);
    expect(deleteWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledTimes(1);
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledWith("prompt-1", "answer");
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
  });

  it("[spec] 게스트가 답을 지우면 900ms 뒤 이 기기 초안만 지우고 배지를 없앤다", async () => {
    setSessionUser(null);
    jest.mocked(getLocalWritingDraft).mockResolvedValue(writingDraft());
    await renderLoaded();
    expect(screen.getByText(LOCAL_SAVED_BADGE)).toBeOnTheScreen();

    await typeAnswer("  ");
    await advance(900);

    expect(deleteWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledWith("prompt-1", "answer");
    expect(screen.queryByText(LOCAL_SAVED_BADGE)).toBeNull();
  });

  it("[spec] 게스트가 답을 쓰면 마지막 입력 900ms 뒤 이 기기에 저장하고, 이어 쓰기 상태(답 쓰기)를 남기고, 배지가 '이 기기에 저장됨'이 된다", async () => {
    setSessionUser(null);
    await renderLoaded();

    await typeAnswer("I drink coffee.");
    await advance(899);
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(screen.queryByText(LOCAL_SAVED_BADGE)).toBeNull();

    await advance(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({
      promptId: "prompt-1",
      updatedAt: at(900),
      ...answerPayload("I drink coffee.")
    });
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenCalledWith({
      promptId: "prompt-1",
      difficulty: "A",
      step: "answer",
      draftType: "ANSWER",
      sessionId: "",
      updatedAt: at(900),
      promptSnapshot
    });
    expect(saveWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
    expect(screen.getByText(LOCAL_SAVED_BADGE)).toHaveStyle(BADGE_NORMAL);
  });

  it("[spec] 이어서 쓰면 마지막 입력에서 900ms 뒤에 한 번만 저장한다", async () => {
    setSessionUser(null);
    await renderLoaded();

    await typeAnswer("I drink");
    await advance(500);
    await typeAnswer("I drink coffee.");
    await advance(899);
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();

    await advance(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveLocalWritingDraft).mock.calls[0][0].answer).toBe("I drink coffee.");
    expect(jest.mocked(saveLocalWritingDraft).mock.calls[0][0].updatedAt).toBe(at(1400));
  });

  it("[spec] 로그인 사용자가 쓰면 서버에 저장하고, 이 기기 초안을 지우고, 서버 저장 시각으로 이어 쓰기 상태와 배지를 바꾼다", async () => {
    await renderLoaded();

    await typeAnswer("I drink coffee.");
    await advance(900);

    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).toHaveBeenCalledWith("prompt-1", answerPayload("I drink coffee."));
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenCalledWith({
      promptId: "prompt-1",
      difficulty: "A",
      step: "answer",
      draftType: "ANSWER",
      sessionId: "",
      updatedAt: DRAFT_SAVED_AT_2,
      promptSnapshot
    });
    const order = [
      jest.mocked(saveWritingDraft).mock.invocationCallOrder[0],
      jest.mocked(deleteLocalWritingDraft).mock.invocationCallOrder[0],
      jest.mocked(saveIncompleteLoop).mock.invocationCallOrder[0]
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(screen.getByText(`임시저장됨 · ${DRAFT_SAVED_TIME_2}`)).toHaveStyle(BADGE_NORMAL);
  });

  it("[spec] 불러온 초안은 고치지 않아도 900ms 뒤 다시 저장하고 배지가 새 저장 시각으로 바뀐다", async () => {
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderLoaded();
    expect(screen.getByText(`임시저장됨 · ${DRAFT_SAVED_TIME}`)).toBeOnTheScreen();

    await advance(900);

    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).toHaveBeenCalledWith("prompt-1", answerPayload("I drink coffee."));
    expect(screen.getByText(`임시저장됨 · ${DRAFT_SAVED_TIME_2}`)).toBeOnTheScreen();
  });

  it("[spec] 로그인 사용자의 서버 저장이 실패하면 이 기기에 저장하고 '서버 저장이 불안정해…' 배지(보통 모양)를 보인다", async () => {
    jest.mocked(saveWritingDraft).mockRejectedValue(new Error("서버 저장 실패"));
    await renderLoaded();

    await typeAnswer("I drink coffee.");
    await advance(900);

    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({
      promptId: "prompt-1",
      updatedAt: at(900),
      ...answerPayload("I drink coffee.")
    });
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenCalledWith(expect.objectContaining({ step: "answer", updatedAt: at(900) }));
    expect(screen.getByText("서버 저장이 불안정해 이 기기에 임시저장했어요.")).toHaveStyle(BADGE_NORMAL);
  });

  it("[spec] 로그인 사용자의 서버·이 기기 저장이 모두 실패하면 '임시저장 실패' 배지를 실패 모양으로 보인다", async () => {
    jest.mocked(saveWritingDraft).mockRejectedValue(new Error("서버 저장 실패"));
    jest.mocked(saveLocalWritingDraft).mockRejectedValue(new Error("기기 저장 실패"));
    await renderLoaded();

    await typeAnswer("I drink coffee.");
    await advance(900);

    expect(saveIncompleteLoop).not.toHaveBeenCalled();
    expect(screen.getByText("임시저장 실패")).toHaveStyle(BADGE_ERROR);
  });

  it("[spec] 게스트의 이 기기 저장이 실패하면 한 번 더 저장해 보고, 또 실패하면 '이 기기에 임시저장하지 못했어요.' 배지(보통 모양)를 보인다", async () => {
    setSessionUser(null);
    jest.mocked(saveLocalWritingDraft).mockRejectedValue(new Error("기기 저장 실패"));
    await renderLoaded();

    await typeAnswer("I drink coffee.");
    await advance(900);

    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(2);
    expect(saveLocalWritingDraft).toHaveBeenNthCalledWith(2, {
      promptId: "prompt-1",
      updatedAt: at(900),
      ...answerPayload("I drink coffee.")
    });
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
    expect(screen.getByText("이 기기에 임시저장하지 못했어요.")).toHaveStyle(BADGE_NORMAL);
  });

  it("[spec] 게스트의 첫 저장이 실패하고 다시 저장하면 성공하면 '이 기기에 저장됨' 배지를 보인다", async () => {
    setSessionUser(null);
    jest.mocked(saveLocalWritingDraft).mockRejectedValueOnce(new Error("기기 저장 실패"));
    await renderLoaded();

    await typeAnswer("I drink coffee.");
    await advance(900);

    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(2);
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(screen.getByText(LOCAL_SAVED_BADGE)).toBeOnTheScreen();
  });

  it("[spec] 다시 쓰기에서 쓰면 다시 쓰기 초안(피드백 때 답과 세션 포함)과 다시 쓰기 단계의 이어 쓰기 상태를 저장한다", async () => {
    setSessionUser(null);
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();

    await typeAnswer("I wake up early because I have class.");
    await advance(900);

    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({
      promptId: "prompt-1",
      updatedAt: at(900),
      ...rewritePayload("I wake up early because I have class.")
    });
    expect(saveIncompleteLoop).toHaveBeenCalledWith({
      promptId: "prompt-1",
      difficulty: "A",
      step: "rewrite",
      draftType: "REWRITE",
      sessionId: "session-1",
      updatedAt: at(900),
      promptSnapshot
    });
    expect(screen.getByText(LOCAL_SAVED_BADGE)).toBeOnTheScreen();
  });

  it("[spec] 다시 쓰기에서 답을 비우면 다시 쓰기 초안을 지우고 이어 쓰기 상태를 피드백 단계로 저장한다", async () => {
    setSessionUser(null);
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();

    await typeAnswer("");
    await advance(900);

    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(clearIncompleteLoopForPrompt).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenCalledWith({
      promptId: "prompt-1",
      difficulty: "A",
      step: "feedback",
      draftType: null,
      sessionId: "session-1",
      updatedAt: at(900),
      promptSnapshot
    });
  });

  it("[spec] 화면에 포커스가 없으면 자동 저장하지 않는다", async () => {
    setSessionUser(null);
    jest.mocked(useIsFocused).mockReturnValue(false);
    await renderLoaded();

    await typeAnswer("I drink coffee.");
    await advance(5000);

    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
    expect(clearIncompleteLoopForPrompt).not.toHaveBeenCalled();
  });

  it("[spec] 제출을 누르면 쓰던 답을 한 번 더 저장하지 않고, 성공하면 초안을 지우며, 그 뒤에는 자동 저장하지 않는다", async () => {
    setSessionUser(null);
    await renderLoaded();
    await typeAnswer("I drink coffee.");

    const pending = deferred<Feedback>();
    jest.mocked(submitFeedback).mockReturnValue(pending.promise);
    await pressText(SUBMIT_INITIAL);
    await flushAsync();

    // 제출 중으로 바뀌어도 쓰던 답을 바로 저장하지 않는다(작업 041).
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(saveIncompleteLoop).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
    expect(screen.queryByText(LOCAL_SAVED_BADGE, { includeHiddenElements: true })).toBeNull();

    await act(async () => {
      pending.resolve(nextFeedback());
    });
    await flushAsync();

    expect(deleteWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenLastCalledWith(expect.objectContaining({ step: "feedback", sessionId: "session-9" }));

    await advance(5000);
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
  });

  it("[spec] 제출이 실패하면 다시 자동 저장한다", async () => {
    setSessionUser(null);
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await submitAndReject(SUBMIT_INITIAL, new Error("잠깐 실패"));
    // 제출하는 동안에는 쓰던 답을 저장하지 않는다(작업 041).
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();

    await advance(900);

    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByText(LOCAL_SAVED_BADGE)).toBeOnTheScreen();
  });

  it("[spec] 제출에 성공한 뒤 코치 표현을 문장에 넣으면 다시 자동 저장한다(답 쓰기 초안에 받은 피드백의 세션을 담는다)", async () => {
    setSessionUser(null);
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await submitAndResolve(SUBMIT_INITIAL, nextFeedback());
    await openCoach();
    await askCoach("근력을 키우고 싶다");
    jest.mocked(saveLocalWritingDraft).mockClear();
    jest.mocked(saveIncompleteLoop).mockClear();

    await fireEvent.press(screen.getAllByText("문장에 넣기")[0]);
    await advance(900);

    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({
      promptId: "prompt-1",
      updatedAt: at(900),
      draftType: "ANSWER",
      selectedDifficulty: "A",
      sessionId: "session-9",
      answer: "I drink coffee. build muscle",
      rewrite: "",
      lastSubmittedAnswer: "",
      feedback: null,
      step: "answer"
    });
    expect(saveIncompleteLoop).toHaveBeenCalledWith({
      promptId: "prompt-1",
      difficulty: "A",
      step: "answer",
      draftType: "ANSWER",
      sessionId: "session-9",
      updatedAt: at(900),
      promptSnapshot
    });
  });

  it("[spec] 화면을 떠나면 기다리던 자동 저장을 멈추고 쓰던 답을 바로 저장한다", async () => {
    setSessionUser(null);
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await advance(300);

    await screen.unmount();
    await flushAsync();

    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({
      promptId: "prompt-1",
      updatedAt: at(300),
      ...answerPayload("I drink coffee.")
    });
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(saveIncompleteLoop).toHaveBeenCalledWith(expect.objectContaining({ step: "answer", updatedAt: at(300) }));

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
  });

  it("[spec] 로그인 사용자가 화면을 떠나면 서버에 바로 저장한다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");

    await screen.unmount();
    await flushAsync();

    expect(saveWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveWritingDraft).toHaveBeenCalledWith("prompt-1", answerPayload("I drink coffee."));
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(saveIncompleteLoop).toHaveBeenCalledWith(expect.objectContaining({ step: "answer", updatedAt: DRAFT_SAVED_AT_2 }));
  });

  it("[spec] 빈 답으로 화면을 떠나면 초안과 답 쓰기 단계의 이어 쓰기 상태를 바로 지운다", async () => {
    setSessionUser(null);
    await renderLoaded();

    await screen.unmount();
    await flushAsync();

    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "ANSWER");
    expect(clearIncompleteLoopForPrompt).toHaveBeenCalledWith("prompt-1", "answer");
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 앱이 앞에 있으면(active) 저장하지 않고, 뒤로 가면 기다리던 자동 저장을 멈추고 배지 변화 없이 바로 저장한다", async () => {
    setSessionUser(null);
    await renderLoaded();
    await typeAnswer("I drink coffee.");

    await emitAppState("active");
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();

    await emitAppState("background");
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({
      promptId: "prompt-1",
      updatedAt: NOW.toISOString(),
      ...answerPayload("I drink coffee.")
    });
    expect(saveIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(LOCAL_SAVED_BADGE)).toBeNull();

    await advance(5000);
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
  });
});

// ---------- 이전 피드백 창 ----------

describe("[spec] 이전 피드백 창", () => {
  it("[spec] 다시 쓰기 안내의 이전 피드백 보기를 누르면 그때 보인 피드백을 보여 주고, 닫기를 누르면 닫힌다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[1]);

    const modal = openModal();
    expect(within(modal).getByText(PREVIOUS_FEEDBACK)).toBeOnTheScreen();
    expect(within(modal).getByText("잘한 점")).toBeOnTheScreen();
    expect(within(modal).getByText("아침 일과를 분명하게 말했어요.")).toBeOnTheScreen();
    expect(within(modal).getByText("이유를 한 문장 더해 보세요")).toBeOnTheScreen();
    expect(within(modal).queryByText(PREVIOUS_EMPTY_TITLE)).toBeNull();

    await fireEvent.press(within(modal).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 피드백 때 답이 비어 있으면 이전 피드백을 찾지 못했다는 안내를 보인다", async () => {
    savePracticeFeedbackState(savedState(coachFeedback(), { answer: "" }));
    setParams(rewriteParams());
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[0]);

    const modal = openModal();
    expect(within(modal).getByText(PREVIOUS_EMPTY_TITLE)).toBeOnTheScreen();
    expect(within(modal).getByText(PREVIOUS_EMPTY_BODY)).toBeOnTheScreen();
    expect(within(modal).queryByText("잘한 점")).toBeNull();
  });

  it("[spec] 그때 보인 피드백 기록이 없으면 이전 형식 안내를 보인다", async () => {
    savePracticeFeedbackState(savedState(makeFeedback({ coachMove })));
    setParams(rewriteParams());
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[0]);

    expect(
      within(openModal()).getByText("이전 형식의 피드백이라 당시 화면에 보였던 내용을 정확히 복원할 수 없어요.")
    ).toBeOnTheScreen();
  });

  it("[spec] 제출한 뒤에는 '피드백 보기' 창에 방금 받은 피드백을 보여 준다", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await submitAndResolve(SUBMIT_INITIAL, nextFeedback());

    await fireEvent.press(screen.getAllByText(VIEW_FEEDBACK)[0]);

    const modal = openModal();
    expect(within(modal).getByText(VIEW_FEEDBACK)).toBeOnTheScreen();
    expect(within(modal).getByText("커피 이야기를 분명하게 했어요.")).toBeOnTheScreen();
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("[spec] 창 밖 닫기 요청(안드로이드 뒤로가기)으로도 닫힌다", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();
    await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[0]);

    await fireEvent(openModal(), "requestClose");

    expect(modalHosts()).toHaveLength(0);
  });
});

// ---------- 작성 가이드 창 ----------

describe("[spec] 작성 가이드 창", () => {
  it("[spec] 추천을 불러오는 동안 준비 중 문구와 난이도의 팁·기본 스타터를 보인다(A 난이도는 설명 없음)", async () => {
    const pending = deferred<PromptHint[]>();
    jest.mocked(getPromptHints).mockReturnValue(pending.promise);
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    const modal = openModal();
    expect(within(modal).getByText(GUIDE_TITLE)).toBeOnTheScreen();
    expect(within(modal).getByText("최고의 팁!")).toBeOnTheScreen();
    expect(within(modal).getByText("완벽하지 않아도 일단 쓰는 것!")).toBeOnTheScreen();
    expect(within(modal).getByText("첫 문장 스타터")).toBeOnTheScreen();
    expect(within(modal).getByText("I think ... because ...")).toBeOnTheScreen();
    expect(within(modal).getByText(HINTS_LOADING)).toBeOnTheScreen();
    expect(within(modal).queryByText(HINTS_EMPTY)).toBeNull();

    await act(async () => {
      pending.resolve([]);
    });
    await flushAsync();
    expect(within(openModal()).getByText(HINTS_EMPTY)).toBeOnTheScreen();
    expect(within(openModal()).queryByText(HINTS_LOADING)).toBeNull();
  });

  it("[spec] 추천 단어·표현과 스타터 힌트를 보인다(뜻이 없으면 기본 뜻, 그것도 없으면 단어만, 빈 항목은 뺀다)", async () => {
    jest.mocked(getPromptHints).mockResolvedValue(hints);
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    const modal = openModal();
    expect(within(modal).getByText("Every morning, I ...")).toBeOnTheScreen();
    expect(within(modal).queryByText("I think ... because ...")).toBeNull();
    expect(within(modal).getByText("추천 단어")).toBeOnTheScreen();
    expect(within(modal).getByText("coffee · 커피")).toBeOnTheScreen();
    expect(within(modal).getByText("relax · 휴식을 취하다")).toBeOnTheScreen();
    expect(within(modal).getByText("alarm")).toBeOnTheScreen();
    expect(within(modal).getByText("추천 표현")).toBeOnTheScreen();
    expect(within(modal).getByText("in the morning · 아침에")).toBeOnTheScreen();
    expect(within(modal).getByText("get ready · 준비하다")).toBeOnTheScreen();
    expect(within(modal).queryByText(HINTS_EMPTY)).toBeNull();
    expect(within(modal).queryByText(HINTS_LOADING)).toBeNull();
  });

  it("[spec] 추천을 부르다 실패하면 추천이 없다는 문구를 보인다", async () => {
    jest.mocked(getPromptHints).mockRejectedValue(new Error("힌트 실패"));
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    expect(within(openModal()).getByText(HINTS_EMPTY)).toBeOnTheScreen();
  });

  it.each([
    ["I", "짧게라도 바로 영어로 시작해 보세요.", "한두 문장만 써도 충분해요. 먼저 영어로 답하는 감각부터 익히면 됩니다.", "I usually ..."],
    ["B", "생각, 이유, 예시를 흐름 있게 적어 보세요.", "한 문장씩 차근차근 이어 가면 답이 더 안정적으로 들려요.", "In my opinion, ... One reason is that ..."],
    ["C", "주장과 근거를 구조적으로 보여 주세요.", "길게 쓰기보다 흐름이 보이게 정리하면 더 설득력 있어요.", "I believe ... because ... For example, ..."]
  ] as const)("[spec] 질문 난이도 %s의 팁·설명·기본 스타터를 보인다", async (difficulty, title, description, starter) => {
    jest.mocked(getDailyPrompts).mockResolvedValue(recommendation([{ ...prompt, difficulty }, prompt2, prompt3]));
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    const modal = openModal();
    expect(within(modal).getByText(title)).toBeOnTheScreen();
    expect(within(modal).getByText(description)).toBeOnTheScreen();
    expect(within(modal).getByText(starter)).toBeOnTheScreen();
  });

  it("[spec] 질문 난이도 값이 맞지 않으면 고른 난이도의 가이드를 보인다", async () => {
    setParams({ difficulty: "B", promptId: "prompt-1" });
    jest.mocked(getDailyPrompts).mockResolvedValue(
      recommendation([{ ...prompt, difficulty: "Z" as Prompt["difficulty"] }, prompt2, prompt3])
    );
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    expect(within(openModal()).getByText("생각, 이유, 예시를 흐름 있게 적어 보세요.")).toBeOnTheScreen();
  });

  it("[spec] 닫기와 창 밖 닫기 요청으로 닫힌다", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);
    await fireEvent.press(within(openModal()).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);

    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);
    await fireEvent(openModal(), "requestClose");
    expect(modalHosts()).toHaveLength(0);
  });
});

// ---------- AI 코치 창 ----------

describe("[spec] AI 코치 창", () => {
  it("[spec] 열면 제목·질문 입력·주제에 맞는 빠른 질문·안내 문구가 보이고, 닫기를 누르면 닫히며 코치 열기 버튼이 돌아온다", async () => {
    await renderLoaded();

    await openCoach();

    const modal = openModal();
    expect(within(modal).getByText(COACH_TITLE)).toBeOnTheScreen();
    expect(coachInput()).toHaveDisplayValue("");
    expect(within(modal).getByText("Morning 주제에 어울리는 표현 3개 알려줘.")).toBeOnTheScreen();
    expect(within(modal).getByText("첫 문장을 어떻게 시작하면 좋을까?")).toBeOnTheScreen();
    expect(within(modal).getByText("이유를 자연스럽게 붙이는 표현을 알려줘.")).toBeOnTheScreen();
    expect(within(modal).getByText("마무리 문장을 어떻게 쓰면 좋을까?")).toBeOnTheScreen();
    expect(within(modal).getByText(COACH_REQUEST)).toBeOnTheScreen();
    expect(within(modal).getByText(COACH_META)).toBeOnTheScreen();
    expect(within(modal).queryByText(COACH_REPLY_BADGE)).toBeNull();

    await fireEvent.press(within(modal).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "AI 코치 열기" })).toBeOnTheScreen();
  });

  it("[spec] 질문 주제가 비면 일반 빠른 질문을 보인다", async () => {
    jest.mocked(getDailyPrompts).mockResolvedValue(recommendation([{ ...prompt, topic: "  " }, prompt2, prompt3]));
    await renderLoaded();

    await openCoach();

    expect(within(openModal()).getByText("이 질문에 어울리는 표현 3개 알려줘.")).toBeOnTheScreen();
  });

  it("[spec] 주제 앞뒤 공백을 뺀 이름으로 빠른 질문을 만든다", async () => {
    jest.mocked(getDailyPrompts).mockResolvedValue(recommendation([{ ...prompt, topic: "  Morning  " }, prompt2, prompt3]));
    await renderLoaded();

    await openCoach();

    expect(within(openModal()).getByText("Morning 주제에 어울리는 표현 3개 알려줘.")).toBeOnTheScreen();
  });

  it("[spec] 빈 질문으로 추천받기를 누르면 코치에게 묻지 않고 오류를 보이며, 질문을 고치면 오류가 사라진다", async () => {
    await renderLoaded();
    await openCoach();

    await askCoach("   ");

    expect(requestCoachHelp).not.toHaveBeenCalled();
    expect(screen.getByText(COACH_EMPTY_ERROR)).toBeOnTheScreen();

    await fireEvent.changeText(coachInput(), "근력");
    expect(screen.queryByText(COACH_EMPTY_ERROR)).toBeNull();
  });

  it("[spec] 빠른 질문을 누르면 질문 칸에 채우기만 하고 묻지는 않는다", async () => {
    await renderLoaded();
    await openCoach();

    await pressText("첫 문장을 어떻게 시작하면 좋을까?");

    expect(coachInput()).toHaveDisplayValue("첫 문장을 어떻게 시작하면 좋을까?");
    expect(requestCoachHelp).not.toHaveBeenCalled();
  });

  it("[spec] 묻는 동안 추천받기 버튼에 불러오는 중 표시가 돌고 눌리지 않으며, 답이 오면 코치 답변과 표현 카드를 보이고 질문 칸을 다듬는다", async () => {
    const pending = deferred<CoachHelpResponse>();
    jest.mocked(requestCoachHelp).mockReturnValue(pending.promise);
    await renderLoaded();
    await openCoach();

    await askCoach("  근력을 키우고 싶다  ");

    expect(requestCoachHelp).toHaveBeenCalledTimes(1);
    expect(requestCoachHelp).toHaveBeenCalledWith({
      promptId: "prompt-1",
      question: "근력을 키우고 싶다",
      sessionId: undefined,
      answer: undefined,
      attemptType: "INITIAL"
    });
    expect(screen.queryByText(COACH_REQUEST)).toBeNull();
    const spinners = findHost(openModal(), "ActivityIndicator");
    expect(spinners).toHaveLength(1);
    expect(spinners[0].props.color).toBe("#2E2416");
    expect(spinners[0]).toBeDisabled();

    await act(async () => {
      pending.resolve(coachHelp());
    });
    await flushAsync();

    const modal = openModal();
    expect(within(modal).getByText(COACH_REQUEST)).toBeOnTheScreen();
    expect(within(modal).getByText(COACH_REPLY_BADGE)).toBeOnTheScreen();
    expect(within(modal).getByText("운동 목표는 이렇게 말해 보세요.")).toBeOnTheScreen();
    expect(within(modal).getByText("build muscle")).toBeOnTheScreen();
    expect(within(modal).getByText("근육을 키우다")).toBeOnTheScreen();
    expect(within(modal).getByText("운동 목표를 말할 때 써요.")).toBeOnTheScreen();
    expect(within(modal).getByText("I want to build muscle.")).toBeOnTheScreen();
    expect(within(modal).getByText("stay in shape")).toBeOnTheScreen();
    expect(within(modal).getAllByText("문장에 넣기")).toHaveLength(2);
    expect(within(modal).getAllByText("저장")).toHaveLength(2);
    expect(coachInput()).toHaveDisplayValue("근력을 키우고 싶다");
  });

  it("[spec] 답을 쓰고 있으면 다듬은 답을 함께 보내고, 다시 쓰기에서는 앞 세션과 다시 쓰기로 묻는다", async () => {
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();
    await typeAnswer("  I wake up early.  ");
    await openCoach();

    await askCoach("이유를 붙이고 싶어");

    expect(requestCoachHelp).toHaveBeenCalledWith({
      promptId: "prompt-1",
      question: "이유를 붙이고 싶어",
      sessionId: "session-1",
      answer: "I wake up early.",
      attemptType: "REWRITE"
    });
  });

  it("[spec] 묻다 실패하면 오류 문구를, 오류 객체가 아니면 기본 문구를 보이고, 질문을 고치면 사라진다", async () => {
    jest.mocked(requestCoachHelp).mockRejectedValueOnce(new Error("코치가 바빠요")).mockRejectedValueOnce("boom");
    await renderLoaded();
    await openCoach();

    await askCoach("근력을 키우고 싶다");
    expect(screen.getByText("코치가 바빠요")).toBeOnTheScreen();
    expect(screen.queryByText(COACH_REPLY_BADGE)).toBeNull();

    await askCoach("근력을 키우고 싶어");
    expect(screen.getByText("AI 코치를 불러오지 못했어요.")).toBeOnTheScreen();

    await fireEvent.changeText(coachInput(), "근력");
    expect(screen.queryByText("AI 코치를 불러오지 못했어요.")).toBeNull();
  });

  it("[spec] 답변이 보인 뒤 질문을 고치거나 빠른 질문을 누르면 답변이 사라진다", async () => {
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");
    expect(screen.getByText(COACH_REPLY_BADGE)).toBeOnTheScreen();

    await fireEvent.changeText(coachInput(), "근력을 키우고 싶어");
    expect(screen.queryByText(COACH_REPLY_BADGE)).toBeNull();

    await pressText(COACH_REQUEST);
    await flushAsync();
    expect(screen.getByText(COACH_REPLY_BADGE)).toBeOnTheScreen();
    await pressText("마무리 문장을 어떻게 쓰면 좋을까?");
    expect(screen.queryByText(COACH_REPLY_BADGE)).toBeNull();
    expect(coachInput()).toHaveDisplayValue("마무리 문장을 어떻게 쓰면 좋을까?");
  });

  it("[spec] 창을 닫았다 다시 열어도 질문과 답변이 그대로 있다", async () => {
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await pressText("닫기");
    await openCoach();

    expect(coachInput()).toHaveDisplayValue("근력을 키우고 싶다");
    expect(screen.getByText("운동 목표는 이렇게 말해 보세요.")).toBeOnTheScreen();
  });

  it("[spec] 문장에 넣기는 빈 답이면 표현만, 공백으로 끝나면 바로 뒤에, 그 밖에는 한 칸 띄워 붙이고 창은 열어 둔다", async () => {
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await fireEvent.press(screen.getAllByText("문장에 넣기")[0]);
    expect(answerInput()).toHaveDisplayValue("build muscle");
    expect(modalHosts()).toHaveLength(1);

    await typeAnswer("I want to");
    await fireEvent.press(screen.getAllByText("문장에 넣기")[0]);
    expect(answerInput()).toHaveDisplayValue("I want to build muscle");

    await typeAnswer("I want to\n");
    await fireEvent.press(screen.getAllByText("문장에 넣기")[1]);
    expect(answerInput()).toHaveDisplayValue("I want to\nstay in shape");

    await typeAnswer("   ");
    await fireEvent.press(screen.getAllByText("문장에 넣기")[1]);
    expect(answerInput()).toHaveDisplayValue("stay in shape");
  });

  it("[spec] 로그인 전에 표현을 저장하면 로그인 안내 창을 띄우고 저장하지 않으며, 로그인하기를 누르면 로그인 화면으로 간다", async () => {
    setSessionUser(null);
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await fireEvent.press(screen.getAllByText("저장")[0]);

    expect(saveExpression).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
      { text: "취소", style: "cancel" },
      { text: "로그인하기", onPress: expect.any(Function) }
    ]);
    lastAlert()[2]![1].onPress!();
    expect(router.push).toHaveBeenCalledWith("/login");
    expect(screen.getAllByText("저장")).toHaveLength(2);
  });

  it("[spec] 표현을 저장하는 동안 '저장 중'으로 눌리지 않고, 저장되면 '저장됨'으로 눌리지 않는다", async () => {
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValue(pending.promise);
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await fireEvent.press(screen.getAllByText("저장")[0]);

    expect(saveExpression).toHaveBeenCalledTimes(1);
    expect(saveExpression).toHaveBeenCalledWith({
      expression: "build muscle",
      meaningKo: "근육을 키우다",
      usageTipKo: "운동 목표를 말할 때 써요.",
      exampleEn: "I want to build muscle.",
      tags: ["운동"],
      sourceType: "COACH_RECOMMENDATION",
      promptId: "prompt-1",
      coachInteractionId: "interaction-1"
    });
    expect(screen.getByText("저장 중")).toBeDisabled();
    expect(screen.getAllByText("저장")).toHaveLength(1);
    expect(screen.getByText("저장")).toBeEnabled();

    await act(async () => {
      pending.resolve(savedExpression(1, "build muscle"));
    });
    await flushAsync();

    expect(screen.getByText("저장됨")).toBeDisabled();
    expect(screen.queryByText("저장 중")).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("[spec] 태그가 비었거나 코치 기록 아이디가 없으면 그 값을 비워 저장한다", async () => {
    jest.mocked(saveExpression).mockResolvedValue(savedExpression(2, "stay in shape"));
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp({ interactionId: undefined }));
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await fireEvent.press(screen.getAllByText("저장")[1]);
    await flushAsync();

    expect(saveExpression).toHaveBeenCalledWith({
      expression: "stay in shape",
      meaningKo: "몸매를 유지하다",
      usageTipKo: "건강 습관을 말할 때 써요.",
      exampleEn: "I run to stay in shape.",
      tags: undefined,
      sourceType: "COACH_RECOMMENDATION",
      promptId: "prompt-1",
      coachInteractionId: undefined
    });
    expect(screen.getByText("저장됨")).toBeOnTheScreen();
  });

  it("[spec] 저장이 실패하면 실패 안내 창을 띄우고(오류 객체가 아니면 기본 문구) 다시 '저장'으로 돌아간다", async () => {
    jest.mocked(saveExpression).mockRejectedValueOnce(new Error("저장 서버 오류")).mockRejectedValueOnce("boom");
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await fireEvent.press(screen.getAllByText("저장")[0]);
    await flushAsync();
    expect(alertSpy).toHaveBeenLastCalledWith("표현 저장에 실패했어요.", "저장 서버 오류");
    expect(screen.getAllByText("저장")).toHaveLength(2);
    expect(screen.getAllByText("저장")[0]).toBeEnabled();

    await fireEvent.press(screen.getAllByText("저장")[0]);
    await flushAsync();
    expect(alertSpy).toHaveBeenLastCalledWith("표현 저장에 실패했어요.", "잠시 후 다시 시도해 주세요.");
  });

  it("[spec] 표현 글이 비어 있으면 저장을 눌러도 로그인 안내도 저장도 하지 않는다", async () => {
    setSessionUser(null);
    jest.mocked(requestCoachHelp).mockResolvedValue(
      coachHelp({ expressions: [{ ...coachExpressions[0], id: "exp-blank", expression: "   " }] })
    );
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await fireEvent.press(screen.getByText("저장"));
    await flushAsync();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(saveExpression).not.toHaveBeenCalled();
    expect(screen.getByText("저장")).toBeEnabled();
  });

  it("[spec] 대소문자·공백만 다른 표현은 같은 표현으로 보고 함께 저장됨으로 바뀐다", async () => {
    jest.mocked(saveExpression).mockResolvedValue(savedExpression(1, "build muscle"));
    jest.mocked(requestCoachHelp).mockResolvedValue(
      coachHelp({ expressions: [coachExpressions[0], { ...coachExpressions[0], id: "exp-3", expression: "Build  Muscle" }] })
    );
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    await fireEvent.press(screen.getAllByText("저장")[0]);
    await flushAsync();

    expect(saveExpression).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("저장됨")).toHaveLength(2);
  });

  it("[spec] 같은 화면에서 질문이 바뀌면 코치 창을 닫고 질문·답변을 비우며, 저장됨 표시도 지운다", async () => {
    jest.mocked(saveExpression).mockResolvedValue(savedExpression(1, "build muscle"));
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");
    await fireEvent.press(screen.getAllByText("저장")[0]);
    await flushAsync();
    expect(screen.getByText("저장됨")).toBeOnTheScreen();

    setParams({ difficulty: "A", promptId: "prompt-2" });
    await screen.rerender(<PracticeWriteScreen />);
    await flushAsync();

    expect(screen.getByText(prompt2.questionEn)).toBeOnTheScreen();
    expect(modalHosts()).toHaveLength(0);
    await openCoach();
    expect(coachInput()).toHaveDisplayValue("");
    expect(screen.queryByText(COACH_REPLY_BADGE)).toBeNull();
    expect(screen.getByText("Food 주제에 어울리는 표현 3개 알려줘.")).toBeOnTheScreen();

    await askCoach("근력을 키우고 싶다");
    expect(requestCoachHelp).toHaveBeenLastCalledWith({
      promptId: "prompt-2",
      question: "근력을 키우고 싶다",
      sessionId: undefined,
      answer: undefined,
      attemptType: "INITIAL"
    });
    expect(screen.queryByText("저장됨")).toBeNull();
    expect(screen.getAllByText("저장")).toHaveLength(2);
  });

  it("[spec] 저장 중에 질문이 바뀌면 저장 중 표시를 지우고, 늦게 끝난 앞 질문의 저장은 새 질문의 같은 표현에 저장됨으로 남는다", async () => {
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValue(pending.promise);
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");
    await fireEvent.press(screen.getAllByText("저장")[0]);
    expect(screen.getByText("저장 중")).toBeOnTheScreen();

    setParams({ difficulty: "A", promptId: "prompt-2" });
    await screen.rerender(<PracticeWriteScreen />);
    await flushAsync();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    expect(screen.queryByText("저장 중")).toBeNull();
    expect(screen.getAllByText("저장")).toHaveLength(2);
    expect(screen.getAllByText("저장")[0]).toBeEnabled();

    await act(async () => {
      pending.resolve(savedExpression(1, "build muscle"));
    });
    await flushAsync();
    expect(screen.getByText("저장됨")).toBeOnTheScreen();
  });

  it("[spec] 창 밖 닫기 요청(안드로이드 뒤로가기)으로도 닫힌다", async () => {
    await renderLoaded();
    await openCoach();

    await fireEvent(openModal(), "requestClose");

    expect(modalHosts()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "AI 코치 열기" })).toBeOnTheScreen();
  });
});

// ---------- 화면 구조 ----------
// 문구·구조·접근성 속성·스타일 값이 지금과 같은지 호스트 트리 스냅샷으로 기록한다(tests/app/practice/__snapshots__).
// 이전 피드백 내용(VisiblePracticeFeedbackContent)은 이번에 옮기지 않는 컴포넌트지만 창 안에 함께 찍힌다.
// 기다림 화면(FeedbackLoadingOverlay)은 움직이는 값이 들어 있어, 제출 중에는 답 쓰기 카드만 찍는다.

describe("[spec] 화면 구조", () => {
  it("[spec] 불러오는 중 화면", async () => {
    jest.mocked(getDailyPrompts).mockReturnValue(new Promise(() => undefined));
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 질문을 찾지 못한 화면", async () => {
    setParams({ difficulty: "A" });
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 처음 쓰기 화면(빈 답, 말풍선)", async () => {
    await renderLoaded();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 태그 연습 화면(해석 펼침, 표현으로 채운 답)", async () => {
    setParams({
      difficulty: "A",
      promptId: "prompt-1",
      practiceTagLabel: "일상",
      practiceExpressions: JSON.stringify(["take a walk", "read the news"])
    });
    await renderLoaded();
    await pressText("해석 보기");

    expect(screenStructure()).toMatchSnapshot();
  });

  // 저장 시각 문구는 실행 환경의 ko-KR 시각 형식에 따라 달라서, 시각이 없는 초안으로 "이 기기에 저장됨" 배지를 찍는다.
  it("[spec] 이어 쓰는 다시 쓰기 화면(이 기기에 저장됨 배지, 제출 오류와 문제 보내기)", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams({ resume: "1" }));
    jest.mocked(getWritingDraft).mockResolvedValue(rewriteDraft({ updatedAt: "" }));
    await renderLoaded();
    await submitAndReject(SUBMIT_REWRITE, new Error("서버가 바빠요"));

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 제출한 뒤 잠긴 화면", async () => {
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await submitAndResolve(SUBMIT_INITIAL, nextFeedback());

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 임시저장 실패 배지", async () => {
    jest.mocked(saveWritingDraft).mockRejectedValue(new Error("서버 저장 실패"));
    jest.mocked(saveLocalWritingDraft).mockRejectedValue(new Error("기기 저장 실패"));
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await advance(900);

    expect(structureOf(screen.getByText("임시저장 실패").parent!)).toMatchSnapshot();
  });

  it("[spec] 제출 중인 답 쓰기 카드", async () => {
    const pending = deferred<Feedback>();
    jest.mocked(submitFeedback).mockReturnValue(pending.promise);
    await renderLoaded();
    await typeAnswer("I drink coffee.");
    await pressText(SUBMIT_INITIAL);
    await flushAsync();

    const composerCard = screen.getByRole("button", { name: "작문 취소", includeHiddenElements: true }).parent!;
    expect(structureOf(composerCard)).toMatchSnapshot();

    await act(async () => {
      pending.resolve(nextFeedback());
    });
    await flushAsync();
  });

  it("[spec] 작성 가이드 창(스타터·추천 단어·추천 표현)", async () => {
    jest.mocked(getPromptHints).mockResolvedValue(hints);
    await renderLoaded();
    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 작성 가이드 창(추천 불러오는 중)", async () => {
    jest.mocked(getPromptHints).mockReturnValue(new Promise(() => undefined));
    await renderLoaded();
    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 작성 가이드 창(추천 없음, B 난이도)", async () => {
    jest.mocked(getDailyPrompts).mockResolvedValue(recommendation([{ ...prompt, difficulty: "B" }, prompt2, prompt3]));
    await renderLoaded();
    await fireEvent.press(screen.getAllByText(GUIDE_OPEN)[0]);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 이전 피드백 창(그때 보인 피드백)", async () => {
    savePracticeFeedbackState(savedState());
    setParams(rewriteParams());
    await renderLoaded();
    await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[0]);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 이전 피드백 창(찾지 못함)", async () => {
    savePracticeFeedbackState(savedState(coachFeedback(), { answer: "" }));
    setParams(rewriteParams());
    await renderLoaded();
    await fireEvent.press(screen.getAllByText(PREVIOUS_FEEDBACK)[0]);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(처음)", async () => {
    await renderLoaded();
    await openCoach();

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(묻는 중)", async () => {
    jest.mocked(requestCoachHelp).mockReturnValue(new Promise(() => undefined));
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(답변: 하나는 저장됨, 하나는 저장 중)", async () => {
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockResolvedValueOnce(savedExpression(1, "build muscle")).mockReturnValueOnce(pending.promise);
    jest.mocked(requestCoachHelp).mockResolvedValue(coachHelp());
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");
    await fireEvent.press(screen.getAllByText("저장")[0]);
    await flushAsync();
    await fireEvent.press(screen.getAllByText("저장")[0]);
    await flushAsync();

    expect(structureOf(openModal())).toMatchSnapshot();

    await act(async () => {
      pending.resolve(savedExpression(2, "stay in shape"));
    });
    await flushAsync();
  });

  it("[spec] AI 코치 창(오류)", async () => {
    jest.mocked(requestCoachHelp).mockRejectedValue(new Error("코치가 바빠요"));
    await renderLoaded();
    await openCoach();
    await askCoach("근력을 키우고 싶다");

    expect(structureOf(openModal())).toMatchSnapshot();
  });
});
