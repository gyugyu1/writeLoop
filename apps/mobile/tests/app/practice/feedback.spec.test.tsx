// [spec] qa 테스트(작업 039-04 피드백 화면 조각, 리팩터링의 "지금 동작" 기록).
// 피드백 화면(src/app/practice/feedback.tsx) 전체를 렌더하고 사용자처럼 눌러, 지금 보이는 문구·구조·접근성 속성과
// 부르는 API·기기 저장 동작을 좋고 나쁨과 관계없이 그대로 적는다. 화면을 여러 파일로 옮긴 뒤에도, 다시 쓰기 상태를
// 훅으로 옮긴 다음 단계에서도 이 테스트가 그대로 통과해야 한다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(expo-secure-store와 이 기기 임시저장 @/lib/writing-drafts, 저장된 피드백
// 상태 불러오기, 게스트 아이디), 로그인 상태(@/lib/session), 라우터·내비게이션, 네이티브 모듈(expo-symbols, expo-crypto).
// 메모리의 피드백 상태(getPracticeFeedbackState·savePracticeFeedbackState)는 실제 모듈을 쓴다.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useNavigation } from "@react-navigation/native";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Keyboard, ScrollView, StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";
import PracticeFeedbackScreen from "@/app/practice/feedback";
import {
  ApiError,
  completeFeedbackSession,
  deleteSavedExpression,
  getSavedExpressions,
  saveExpression,
  submitFeedback
} from "@/lib/api";
import { getOrCreateGuestId } from "@/lib/guest-id";
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
  Feedback,
  FeedbackCoachMove,
  FeedbackLanguageCorrection,
  Prompt,
  RefinementExpression,
  SavedExpression,
  VisibleFeedbackSnapshot,
  WritingDraft
} from "@/lib/types";
import { deleteLocalWritingDraft, getLocalWritingDraft, saveLocalWritingDraft } from "@/lib/writing-drafts";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn()
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: jest.fn() }));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));
// 저장 아이콘(SymbolView)은 네이티브 모듈이라, 받은 속성을 그대로 가진 호스트 요소로 대신한다.
jest.mock("expo-symbols", () => {
  const React = jest.requireActual("react");
  return {
    SymbolView: (props: object) => React.createElement("ExpoSymbolView", props)
  };
});
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
    completeFeedbackSession: jest.fn(),
    deleteSavedExpression: jest.fn(),
    getSavedExpressions: jest.fn(),
    saveExpression: jest.fn(),
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
jest.mock("@/lib/practice-feedback-state", () => ({
  ...jest.requireActual("@/lib/practice-feedback-state"),
  hydratePracticeFeedbackState: jest.fn()
}));

// ---------- 고정 데이터 ----------

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

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };
const GUEST_ID = "guest-device-0123456789abcdef";

const COACH_HELP = "전체를 완벽하게 바꾸려 하지 말고, 위 코치 포인트 하나만 반영하면 돼요.";
const READY_HELP = "이미 충분히 좋아요. 원하면 표현 하나만 가볍게 다듬어 보세요.";
const ENRICHMENT_HELP = "지금 답변은 그대로 두고, 위 제안처럼 내용 한 가지만 더해 보세요.";
const DEFAULT_PLACEHOLDER = "코치 포인트를 반영해서 다시 써보세요.";
const SUBMIT_LABEL = "다시 피드백 받아보기";
const SUBMITTING_LABEL = "피드백 받는 중...";
const REWRITE_OPEN_LABEL = "다시 다듬어 보기";
const ENRICHMENT_REWRITE_LABEL = "이 내용 넣어서 다시 써 보기";
const READY_WITH_PHRASES_HEADLINE = "좋아요! 원하면 표현 하나만 더해 보세요.";
const READY_WITHOUT_PHRASES_HEADLINE = "좋아요! 지금 단계에서 마무리해도 충분해요.";
const RESTORED_NOTICE = "이전에 쓰던 다시쓰기를 불러왔어요.";
const COMPLETED_NOTICE = "이 질문은 완료했어요. 다음 답변에서 이 내용을 넣어 써 보세요.";
const REWRITE_OVERLAY_NAME =
  "다시 쓴 답변을 읽고 있어요. 이전 피드백이 얼마나 반영됐는지 살펴보는 중이에요. 잠시만 기다려 주세요.";
const COACH_USAGE_TIP = "문장틀에 넣어볼 수 있는 표현이에요.";

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

function makeState(feedback: Feedback, overrides: Partial<PracticeFeedbackState> = {}): PracticeFeedbackState {
  return { difficulty: "A", prompt, answer: "I go to school.", feedback, ...overrides };
}

const detailCoachMove: FeedbackCoachMove = {
  focus: "이유를 한 문장 더해 보세요",
  focusType: "ADD_DETAIL",
  why: "이유가 있으면 답이 더 구체적이에요.",
  before: "I wake up early.",
  after: "I wake up early because I have class.",
  instruction: "because로 이유를 붙여 다시 써 보세요.",
  skeletonEn: "I do this because ____.",
  skeletonKo: "저는 ____해서 이렇게 해요.",
  successCheck: "because를 넣었다",
  suggestedPhrases: ["it helps me focus", { phrase: "I feel refreshed", meaningKo: "상쾌해요" }]
};

function coachFeedback(
  coachMove: FeedbackCoachMove = detailCoachMove,
  overrides: Partial<Feedback> = {},
  visibleOverrides: Partial<VisibleFeedbackSnapshot> = {}
): Feedback {
  return makeFeedback({
    visibleFeedback: {
      schemaVersion: 1,
      state: "NEEDS_REWRITE",
      strength: "아침 일과를 분명하게 말했어요.",
      coachMove,
      ...visibleOverrides
    },
    ...overrides
  });
}

function readyFeedback(
  visibleOverrides: Partial<VisibleFeedbackSnapshot> = {},
  overrides: Partial<Feedback> = {}
): Feedback {
  return makeFeedback({
    loopComplete: true,
    visibleFeedback: {
      schemaVersion: 1,
      state: "READY_TO_FINISH",
      strength: "필요한 내용을 다 담았어요.",
      ...visibleOverrides
    },
    ...overrides
  });
}

const sixCorrections: FeedbackLanguageCorrection[] = [
  { kind: "GRAMMAR_BLOCKING", label: "핵심 문법", before: "I go", after: "I went", reason: "어제 일이라 과거형이 필요해요." },
  { kind: "STRUCTURE", label: "구조", before: "school yesterday", after: "to school yesterday", reason: "장소 앞에 to가 필요해요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 문법 1", before: "a apple", after: "an apple", reason: "모음 앞에는 an을 써요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 문법 2", before: null, after: "the", reason: "정해진 대상이라 the를 붙여요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 문법 3", before: "very", after: null, reason: "없어도 뜻이 같아요." },
  { kind: "GRAMMAR_LOCAL", label: "세부 문법 4", before: "", after: "", reason: "다섯째 교정의 이유예요." }
];

const languageFixCoachMove: FeedbackCoachMove = {
  focus: "시제를 맞춰 보세요",
  focusType: "LANGUAGE_FIX",
  before: "I go to school yesterday.",
  after: "I went to school yesterday.",
  why: "어제 일이라 과거형을 써요.",
  instruction: "고친 문장을 넣어 다시 써 보세요.",
  skeletonEn: "Yesterday, I ____.",
  skeletonKo: "어제 저는 ____했어요.",
  suggestedPhrases: ["went to school"],
  languageCorrections: sixCorrections
};

const refinementExpressions: RefinementExpression[] = [
  {
    expression: "start my day",
    meaningKo: "하루를 시작하다",
    guidanceKo: "아침 일과를 말할 때 써요.",
    exampleEn: "I start my day with tea."
  },
  { expression: "hidden phrase", meaningKo: "숨김 표현", displayable: false },
  { expression: "[noun] time", meaningKo: "자리표시자 표현" },
  { expression: "go to school", meaningKo: "학교에 가다" },
  { expression: "read the news", meaningKo: "뉴스를 읽다" },
  { expression: "Start my  day", meaningKo: "중복 표현" },
  { expression: "on a regular basis", meaningKo: "규칙적으로" }
];

const enrichment: FeedbackCoachMove = {
  focus: "느낌을 한 가지 더해 보세요",
  why: "느낌이 있으면 답이 생생해져요.",
  instruction: "I feel로 그때 기분을 붙여 보세요.",
  skeletonEn: "I feel ____ when I ____.",
  skeletonKo: "저는 ____할 때 ____한 기분이에요.",
  suggestedPhrases: ["calm", { phrase: "full of energy", meaningKo: "힘이 넘치는" }, "relaxed", "happy", "proud"]
};

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

function rewriteDraft(overrides: Partial<WritingDraft> = {}): WritingDraft {
  return {
    promptId: "prompt-1",
    draftType: "REWRITE",
    selectedDifficulty: "A",
    sessionId: "session-1",
    answer: "I go to school.",
    rewrite: "I go to school because I like it.",
    lastSubmittedAnswer: "I go to school.",
    feedback: null,
    step: "rewrite",
    updatedAt: "2026-10-31T00:00:00.000Z",
    ...overrides
  };
}

// ---------- 도우미 ----------

const navigation = { canGoBack: jest.fn(), goBack: jest.fn() };
const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let keyboardDismissSpy: jest.SpyInstance;

function setParams(params: { difficulty?: string; promptId?: string }) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
}

function setSessionUser(currentUser: AuthUser | null | undefined) {
  jest.mocked(useSession).mockReturnValue({
    currentUser,
    isHydrating: false,
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

async function renderScreen(state: PracticeFeedbackState | null) {
  if (state) {
    savePracticeFeedbackState(state);
  }
  await render(<PracticeFeedbackScreen />);
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function rewriteInput() {
  return screen.getByPlaceholderText(DEFAULT_PLACEHOLDER);
}

function lastAlertButtons() {
  const call = alertSpy.mock.calls.at(-1) as [string, string, { text: string; style?: string; onPress?: () => void }[]];
  return call[2];
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
  });
}

// 화면 구조 기록용: 호스트 요소의 종류, 이 화면이 정하는 속성(스타일은 펼친 값), 자식만 남긴다.
// React Native 안쪽에서 붙는 속성과 함수는 빼서, 화면 코드가 그대로면 같은 결과가 나오게 한다.
const STRUCTURE_PROPS = new Set([
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
  "color",
  "contentContainerStyle",
  "keyboardDismissMode",
  "keyboardShouldPersistTaps",
  "multiline",
  "name",
  "placeholder",
  "placeholderTextColor",
  "showsVerticalScrollIndicator",
  "size",
  "source",
  "style",
  "textAlignVertical",
  "tintColor",
  "type",
  "value",
  "weight"
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
  if (typeof node.props.onLayout === "function") {
    props.onLayout = "(있음)";
  }
  const children = node.children.map((child) => (typeof child === "string" ? child : structureOf(child)));
  return { $$typeof: TEST_JSON, type: node.type, props, children: children.length > 0 ? children : null };
}

function screenStructure() {
  return structureOf(screen.root!);
}

// 기다리지 않고 누른 fireEvent는 안에서 act를 한 번 연다. 그 act가 끝날 때까지 act 밖에서 한 번 쉰다(act를 겹쳐 열지 않게).
async function letPressActFinish() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// 기다림 화면(FeedbackLoadingOverlay)은 보이는 동안 2.3초마다 안내 문구(접근성 이름)를 다음 단계로 바꾼다(setInterval).
// 그 문구를 단언하는 테스트는 setInterval만 가짜 시계에 두어, 실행이 느려도 단언 전에 문구가 바뀌지 않게 한다.
// 다른 시간(setTimeout, requestAnimationFrame, Date 등)은 진짜 그대로다. afterEach의 jest.useRealTimers()가 되돌린다.
function freezeLoadingCopyRotation() {
  jest.useFakeTimers({
    doNotFake: [
      "Date",
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setTimeout",
      "clearTimeout"
    ]
  });
}

beforeEach(() => {
  clearPracticeFeedbackState();
  setParams({ difficulty: "A", promptId: "prompt-1" });
  navigation.canGoBack.mockReset().mockReturnValue(true);
  navigation.goBack.mockReset();
  jest.mocked(useNavigation).mockReset().mockReturnValue(navigation as unknown as ReturnType<typeof useNavigation>);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(randomUUID).mockReset().mockReturnValueOnce("uuid-1").mockReturnValueOnce("uuid-2").mockReturnValue("uuid-n");
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(saveExpression).mockReset();
  jest.mocked(deleteSavedExpression).mockReset();
  jest.mocked(submitFeedback).mockReset();
  jest.mocked(completeFeedbackSession).mockReset();
  jest.mocked(getOrCreateGuestId).mockReset().mockResolvedValue(GUEST_ID);
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);
  jest.mocked(getLocalWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteLocalWritingDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(ScrollView.prototype.scrollTo).mockClear();
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

// ---------- 피드백 상태 ----------

describe("[spec] 피드백 상태", () => {
  it("[spec] 메모리에 피드백이 있으면 처음 그릴 때부터 보이고, 저장된 상태를 불러오지 않는다", async () => {
    await renderScreen(makeState(coachFeedback()));

    expect(screen.getByText("아침 일과를 분명하게 말했어요.")).toBeOnTheScreen();
    expect(findHost(screen.container, "ActivityIndicator")).toHaveLength(0);
    expect(hydratePracticeFeedbackState).not.toHaveBeenCalled();
  });

  it("[spec] 메모리에 없으면 저장된 상태를 불러오는 동안 불러오는 중 표시만 보이고, 불러오면 피드백이 보인다", async () => {
    const pending = deferred<PracticeFeedbackState | null>();
    jest.mocked(hydratePracticeFeedbackState).mockReturnValue(pending.promise);

    await renderScreen(null);

    expect(hydratePracticeFeedbackState).toHaveBeenCalledWith("A", "prompt-1");
    expect(screen.getByText("피드백")).toBeOnTheScreen();
    const spinners = findHost(screen.container, "ActivityIndicator");
    expect(spinners).toHaveLength(1);
    expect(spinners[0].props.color).toBe("#E38B12");
    expect(screen.queryByText("피드백을 찾지 못했어요")).toBeNull();
    expect(screen.queryByText("잘한 점")).toBeNull();
    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();

    await act(async () => {
      pending.resolve(makeState(coachFeedback()));
    });

    expect(screen.getByText("아침 일과를 분명하게 말했어요.")).toBeOnTheScreen();
    expect(findHost(screen.container, "ActivityIndicator")).toHaveLength(0);
  });

  it("[spec] 메모리의 피드백이 다른 질문이면 이 질문의 저장된 상태를 불러온다", async () => {
    savePracticeFeedbackState(makeState(coachFeedback(), { prompt: { ...prompt, id: "prompt-2" } }));
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(makeState(coachFeedback()));

    await renderScreen(null);

    expect(hydratePracticeFeedbackState).toHaveBeenCalledWith("A", "prompt-1");
    expect(await screen.findByText("아침 일과를 분명하게 말했어요.")).toBeOnTheScreen();
  });

  it("[spec] 저장된 상태가 없으면 빈 상태 안내를 보이고, 질문 목록으로 돌아가기를 누르면 그 난이도의 질문 목록으로 바꾼다", async () => {
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(null);

    await renderScreen(null);

    expect(await screen.findByText("피드백을 찾지 못했어요")).toBeOnTheScreen();
    expect(
      screen.getByText("방금 작성한 피드백이 초기화되었을 수 있어요. 질문 목록으로 돌아가 다시 시작해 주세요.")
    ).toBeOnTheScreen();
    expect(findHost(screen.container, "ActivityIndicator")).toHaveLength(0);
    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();
    expect(screen.queryByRole("button", { name: SUBMIT_LABEL })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "질문 목록으로 돌아가기" }));

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/practice/[difficulty]", params: { difficulty: "A" } });
  });

  it("[spec] 저장된 상태를 불러오다 실패해도 불러오는 중을 끝내고 빈 상태 안내를 보인다", async () => {
    jest.mocked(hydratePracticeFeedbackState).mockRejectedValue(new Error("읽기 실패"));

    await renderScreen(null);

    expect(await screen.findByText("피드백을 찾지 못했어요")).toBeOnTheScreen();
    expect(findHost(screen.container, "ActivityIndicator")).toHaveLength(0);
  });

  it("[spec] 난이도 값이 맞지 않으면 I 난이도로 찾고, 돌아가기도 I 난이도 질문 목록으로 간다", async () => {
    setParams({ difficulty: "Z", promptId: "prompt-1" });

    await renderScreen(null);

    expect(hydratePracticeFeedbackState).toHaveBeenCalledWith("I", "prompt-1");
    await fireEvent.press(await screen.findByRole("button", { name: "질문 목록으로 돌아가기" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/practice/[difficulty]", params: { difficulty: "I" } });
  });
});

// ---------- 머리 ----------

describe("[spec] 머리", () => {
  it("[spec] 피드백 제목과 뒤로가기 버튼이 있고, 돌아갈 화면이 있으면 뒤로 간다", async () => {
    await renderScreen(makeState(coachFeedback()));

    expect(screen.getByText("피드백")).toBeOnTheScreen();
    expect(screen.getByText("<")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "뒤로가기" }));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("[spec] 돌아갈 화면이 없으면 그 난이도의 질문 목록으로 바꾼다", async () => {
    navigation.canGoBack.mockReturnValue(false);
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: "뒤로가기" }));

    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/practice/[difficulty]", params: { difficulty: "A" } });
  });
});

// ---------- 잘한 점 ----------

describe("[spec] 잘한 점 카드", () => {
  it("[spec] 보이는 피드백의 잘한 점을 앞뒤 공백 없이 보인다", async () => {
    await renderScreen(
      makeState(coachFeedback(detailCoachMove, { strengths: ["옛 잘한 점"] }, { strength: "  또렷하게 썼어요.  " }))
    );

    expect(screen.getByText("잘한 점")).toBeOnTheScreen();
    expect(screen.getByText("또렷하게 썼어요.")).toBeOnTheScreen();
    expect(screen.queryByText("옛 잘한 점")).toBeNull();
  });

  it("[spec] 보이는 피드백의 잘한 점이 비어 있으면 strengths의 첫 항목을 보인다", async () => {
    await renderScreen(
      makeState(coachFeedback(detailCoachMove, { strengths: ["옛 잘한 점", "둘째"] }, { strength: "   " }))
    );

    expect(screen.getByText("옛 잘한 점")).toBeOnTheScreen();
    expect(screen.queryByText("둘째")).toBeNull();
  });

  it("[spec] 잘한 점이 하나도 없으면 카드가 없다", async () => {
    await renderScreen(makeState(coachFeedback(detailCoachMove, { strengths: [] }, { strength: null })));

    expect(screen.queryByText("잘한 점")).toBeNull();
  });

  it("[spec] 보이는 피드백이 없으면 feedback의 coachMove와 strengths로 그린다", async () => {
    await renderScreen(makeState(makeFeedback({ strengths: ["옛 형식의 잘한 점"], coachMove: detailCoachMove })));

    expect(screen.getByText("옛 형식의 잘한 점")).toBeOnTheScreen();
    expect(screen.getByText("이유를 한 문장 더해 보세요")).toBeOnTheScreen();
  });
});

// ---------- 코치 피드백 카드 ----------

describe("[spec] 코치 피드백 카드", () => {
  it("[spec] 고침이 아닌 코치는 비교 없이 제목, 이유, 다시 쓸 때, 문장 틀과 뜻, 넣어볼 표현을 보이고 성공 기준은 보이지 않는다", async () => {
    await renderScreen(makeState(coachFeedback()));

    expect(screen.getByText("이유를 한 문장 더해 보세요")).toBeOnTheScreen();
    expect(screen.queryByText("지금")).toBeNull();
    expect(screen.queryByText("적용")).toBeNull();
    expect(screen.queryByText("I wake up early.")).toBeNull();
    expect(screen.queryByText("I wake up early because I have class.")).toBeNull();
    expect(screen.getByText("이유가 있으면 답이 더 구체적이에요.")).toBeOnTheScreen();
    expect(screen.queryByText("왜 고치나요")).toBeNull();
    expect(screen.getByText("다시 쓸 때")).toBeOnTheScreen();
    expect(screen.getByText("because로 이유를 붙여 다시 써 보세요.")).toBeOnTheScreen();
    expect(screen.getByText("문장 틀")).toBeOnTheScreen();
    expect(screen.getByText("I do this because ____.")).toBeOnTheScreen();
    expect(screen.getByText("저는 ____해서 이렇게 해요.")).toBeOnTheScreen();
    expect(screen.getByText("넣어볼 표현")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "it helps me focus 저장" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "I feel refreshed 저장" })).toBeOnTheScreen();
    expect(screen.getByText("상쾌해요")).toBeOnTheScreen();
    expect(screen.queryByText("성공 기준")).toBeNull();
    expect(screen.queryByText("because를 넣었다")).toBeNull();
  });

  it("[spec] 목표 칸 문구가 있으면 제목은 그 문구, 문장 틀이 없으면 그 칸의 문장 틀과 뜻을 쓴다", async () => {
    await renderScreen(
      makeState(coachFeedback({ focus: "이유를 써 보세요", targetSlot: "reason", instruction: "이유를 붙여요." }))
    );

    expect(screen.getByText("이유 붙여보기")).toBeOnTheScreen();
    expect(screen.queryByText("이유를 써 보세요")).toBeNull();
    expect(screen.getByText("I do this because ____.")).toBeOnTheScreen();
    expect(screen.getByText("저는 ____해서 이렇게 해요.")).toBeOnTheScreen();
  });

  it("[spec] 제목과 다시 쓸 때 문구가 없으면 루프 제목과 다시 쓰기 과제를 쓴다", async () => {
    await renderScreen(
      makeState(
        coachFeedback(
          { why: "이유만 있는 코치예요." },
          { loop: { headline: "루프의 제목이에요" }, rewriteChallenge: "다시 쓰기 과제예요" }
        )
      )
    );

    expect(screen.getByText("루프의 제목이에요")).toBeOnTheScreen();
    expect(screen.getByText("다시 쓰기 과제예요")).toBeOnTheScreen();
    expect(screen.queryByText("문장 틀")).toBeNull();
    expect(screen.queryByText("넣어볼 표현")).toBeNull();
  });

  it("[spec] 그것도 없으면 기본 제목과 기본 다시 쓸 때 문구를 쓴다", async () => {
    await renderScreen(makeState(coachFeedback({ why: "이유만 있는 코치예요." })));

    expect(screen.getByText("오늘은 이것 하나만 적용해 볼게요.")).toBeOnTheScreen();
    expect(screen.getByText("의미는 유지하고 오늘의 한 가지 코치만 반영해 다시 써보세요.")).toBeOnTheScreen();
  });

  it("[spec] 고침 종류가 없는 비교는 지금·적용 줄에 바뀐 곳을 색으로 표시하고, 왜 고치나요 라벨은 없다", async () => {
    await renderScreen(
      makeState(
        coachFeedback({
          focus: "시제를 맞춰요",
          before: "I go to school yesterday.",
          after: "I went to school yesterday.",
          why: "과거 일이에요.",
          skeletonEn: "Yesterday, I ____."
        })
      )
    );

    expect(screen.getByText("지금")).toBeOnTheScreen();
    expect(screen.getByText("적용")).toBeOnTheScreen();
    expect(screen.queryByText("이번에 고친 문장")).toBeNull();
    expect(screen.getByText("I go to school yesterday.")).toBeOnTheScreen();
    expect(screen.getByText("I went to school yesterday.")).toBeOnTheScreen();
    expect(screen.getByText("go")).toHaveStyle({ backgroundColor: "#F8CFC7", color: "#8F2F23", fontWeight: "900" });
    expect(screen.getByText("went")).toHaveStyle({ backgroundColor: "#BDEAC7", color: "#145F2A", fontWeight: "900" });
    expect(screen.getByText("과거 일이에요.")).toBeOnTheScreen();
    expect(screen.queryByText("왜 고치나요")).toBeNull();
    expect(screen.getByText("Yesterday, I ____.")).toBeOnTheScreen();
  });

  it("[spec] 문법 고침(LANGUAGE_FIX)은 이번에 고친 문장과 왜 고치나요를 보이고, 문장 틀과 넣어볼 표현은 숨긴다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixCoachMove)));

    expect(screen.getByText("시제를 맞춰 보세요")).toBeOnTheScreen();
    expect(screen.getByText("지금")).toBeOnTheScreen();
    expect(screen.getByText("이번에 고친 문장")).toBeOnTheScreen();
    expect(screen.queryByText("적용")).toBeNull();
    expect(screen.getByText("왜 고치나요")).toBeOnTheScreen();
    expect(screen.getByText("어제 일이라 과거형을 써요.")).toBeOnTheScreen();
    expect(screen.getByText("다시 쓸 때")).toBeOnTheScreen();
    expect(screen.getByText("고친 문장을 넣어 다시 써 보세요.")).toBeOnTheScreen();
    expect(screen.queryByText("문장 틀")).toBeNull();
    expect(screen.queryByText("Yesterday, I ____.")).toBeNull();
    expect(screen.queryByText("넣어볼 표현")).toBeNull();
    expect(screen.queryByRole("button", { name: "went to school 저장" })).toBeNull();
  });

  it("[spec] 다른 바로 고침 종류(소문자 grammar_fix)도 비교와 왜 고치나요를 보이되 줄 이름은 적용이다", async () => {
    await renderScreen(
      makeState(
        coachFeedback({
          ...languageFixCoachMove,
          focusType: "grammar_fix",
          languageCorrections: null
        })
      )
    );

    expect(screen.getByText("지금")).toBeOnTheScreen();
    expect(screen.getByText("적용")).toBeOnTheScreen();
    expect(screen.queryByText("이번에 고친 문장")).toBeNull();
    expect(screen.getByText("왜 고치나요")).toBeOnTheScreen();
    expect(screen.queryByText("문장 틀")).toBeNull();
  });

  it("[spec] 두 문장의 범위가 많이 다르면 바뀐 곳 표시 없이 문장을 그대로 보인다", async () => {
    await renderScreen(
      makeState(coachFeedback({ focus: "문장으로 써요", before: "coffee", after: "I drink coffee every morning before work." }))
    );

    const before = screen.getByText("coffee");
    const after = screen.getByText("I drink coffee every morning before work.");
    expect(before.children).toEqual(["coffee"]);
    expect(after.children).toEqual(["I drink coffee every morning before work."]);
  });

  it("[spec] 두 문장이 같으면 바뀐 곳 표시 없이 두 줄 모두 그대로 보인다", async () => {
    await renderScreen(makeState(coachFeedback({ focus: "그대로예요", before: "I like tea.", after: "I like tea." })));

    const rows = screen.getAllByText("I like tea.");
    expect(rows).toHaveLength(2);
    expect(rows[0].children).toEqual(["I like tea."]);
    expect(rows[1].children).toEqual(["I like tea."]);
  });

  it("[spec] 고친 표현은 4개까지 보이고, 교정 N개 더 보기로 모두 펼치고 추가 교정 접기로 다시 접는다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixCoachMove)));

    expect(screen.getByText("핵심 문법")).toBeOnTheScreen();
    expect(screen.getByText("I go")).toBeOnTheScreen();
    expect(screen.getByText("I went")).toBeOnTheScreen();
    expect(screen.getByText("어제 일이라 과거형이 필요해요.")).toBeOnTheScreen();
    expect(screen.getByText("구조")).toBeOnTheScreen();
    expect(screen.getByText("세부 문법 1")).toBeOnTheScreen();
    expect(screen.getByText("세부 문법 2")).toBeOnTheScreen();
    expect(screen.getByText("the")).toBeOnTheScreen();
    expect(screen.queryByText("세부 문법 3")).toBeNull();
    expect(screen.queryByText("세부 문법 4")).toBeNull();
    expect(screen.getAllByText("→")).toHaveLength(4);
    expect(screen.getByText("핵심 문법").parent).toHaveStyle({ backgroundColor: "#F8D8D1" });
    expect(screen.getByText("구조").parent).toHaveStyle({ backgroundColor: "#F7E4C5" });
    expect(screen.getByText("세부 문법 1").parent).toHaveStyle({ backgroundColor: "#DCEEE5" });

    const more = screen.getByRole("button", { name: "교정 2개 더 보기" });
    expect(more).toBeCollapsed();
    await fireEvent.press(more);

    expect(screen.getByText("세부 문법 3")).toBeOnTheScreen();
    expect(screen.getByText("very")).toBeOnTheScreen();
    expect(screen.getByText("없어도 뜻이 같아요.")).toBeOnTheScreen();
    expect(screen.getByText("세부 문법 4")).toBeOnTheScreen();
    expect(screen.getByText("다섯째 교정의 이유예요.")).toBeOnTheScreen();
    expect(screen.getAllByText("→")).toHaveLength(5);
    const less = screen.getByRole("button", { name: "추가 교정 접기" });
    expect(less).toBeExpanded();
    expect(screen.queryByRole("button", { name: "교정 2개 더 보기" })).toBeNull();

    await fireEvent.press(less);

    expect(screen.queryByText("세부 문법 3")).toBeNull();
    expect(screen.getByRole("button", { name: "교정 2개 더 보기" })).toBeCollapsed();
  });

  it("[spec] 고친 표현이 4개 이하면 더 보기 버튼이 없다", async () => {
    await renderScreen(
      makeState(coachFeedback({ ...languageFixCoachMove, languageCorrections: sixCorrections.slice(0, 4) }))
    );

    expect(screen.getByText("세부 문법 2")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /더 보기$/ })).toBeNull();
  });

  it("[spec] 고친 표현을 펼친 뒤 다시 써서 새 시도의 피드백을 받으면 다시 접힌다", async () => {
    await renderScreen(makeState(coachFeedback(languageFixCoachMove)));
    await fireEvent.press(screen.getByRole("button", { name: "교정 2개 더 보기" }));
    expect(screen.getByText("세부 문법 3")).toBeOnTheScreen();

    jest
      .mocked(submitFeedback)
      .mockResolvedValue(coachFeedback(languageFixCoachMove, { attemptNo: 2 }, { strength: "두 번째 시도의 잘한 점" }));
    await fireEvent.changeText(rewriteInput(), "I went to school yesterday.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));

    expect(await screen.findByText("두 번째 시도의 잘한 점")).toBeOnTheScreen();
    expect(screen.queryByText("세부 문법 3")).toBeNull();
    expect(screen.getByRole("button", { name: "교정 2개 더 보기" })).toBeCollapsed();
  });

  it("[spec] 넣어볼 표현은 빈 표현을 빼고 6개까지 보인다", async () => {
    await renderScreen(
      makeState(
        coachFeedback({
          focus: "표현을 넣어요",
          suggestedPhrases: ["  ", { phrase: " " }, "one", "two", "three", "four", "five", "six", "seven"]
        })
      )
    );

    const chips = screen.getAllByRole("button", { name: /저장$/ });
    expect(chips).toHaveLength(6);
    expect(screen.getByRole("button", { name: "six 저장" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "seven 저장" })).toBeNull();
  });

  it.each([
    ["보이는 피드백이 READY_TO_FINISH", readyFeedback({ coachMove: detailCoachMove }, { loopComplete: false })],
    ["loopComplete", makeFeedback({ loopComplete: true, coachMove: detailCoachMove })],
    ["loop.nextAction이 finish", makeFeedback({ loop: { nextAction: "finish" }, coachMove: detailCoachMove })],
    ["loop.status가 READY_TO_FINISH", makeFeedback({ loop: { status: "READY_TO_FINISH" }, coachMove: detailCoachMove })]
  ])("[spec] 마칠 준비(%s)가 되면 코치 피드백 카드가 없다", async (_name, feedback) => {
    await renderScreen(makeState(feedback));

    expect(screen.queryByText("이유를 한 문장 더해 보세요")).toBeNull();
    expect(screen.queryByText("다시 쓸 때")).toBeNull();
    expect(screen.queryByRole("button", { name: "it helps me focus 저장" })).toBeNull();
  });

  it("[spec] 코치 내용이 비어 있으면 카드가 없고 다시 쓰기 칸은 보인다", async () => {
    await renderScreen(makeState(coachFeedback({ focus: "  ", suggestedPhrases: [" "], languageCorrections: [] })));

    expect(screen.queryByText("다시 쓸 때")).toBeNull();
    expect(screen.queryByText("오늘은 이것 하나만 적용해 볼게요.")).toBeNull();
    expect(screen.getByText(COACH_HELP)).toBeOnTheScreen();
  });
});

// ---------- 표현 저장 ----------

describe("[spec] 표현 저장", () => {
  it.each([
    ["null", null],
    ["undefined", undefined]
  ])("[spec] 로그인 전(currentUser %s)이면 칩을 눌렀을 때 로그인 안내를 띄우고 저장하지 않는다", async (_name, user) => {
    setSessionUser(user);
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: "I feel refreshed 저장" }));

    expect(getSavedExpressions).not.toHaveBeenCalled();
    expect(saveExpression).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith("로그인이 필요해요", "표현 저장은 로그인 후 사용할 수 있어요.", [
      { text: "취소", style: "cancel" },
      { text: "로그인하기", onPress: expect.any(Function) }
    ]);
    lastAlertButtons()[1].onPress?.();
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("[spec] 로그인 사용자의 저장 목록을 불러와 이미 저장한 표현(공백·대소문자 무시)을 저장됨으로 표시한다", async () => {
    jest
      .mocked(getSavedExpressions)
      .mockResolvedValue([savedExpression(41, "  It Helps   me focus "), savedExpression(42, "something else")]);
    await renderScreen(makeState(coachFeedback()));

    const saved = await screen.findByRole("button", { name: "it helps me focus 저장 취소" });
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(saved).toBeSelected();
    expect(saved).toBeEnabled();
    expect(saved).toHaveStyle({ backgroundColor: "#EAF7ED", borderColor: "#AFD2B7" });
    const savedIcon = findHost(saved, "ExpoSymbolView")[0];
    expect(savedIcon.props.name).toEqual({ ios: "bookmark.fill", android: "bookmark", web: "bookmark" });
    expect(savedIcon.props.tintColor).toBe("#2F7A46");

    const unsaved = screen.getByRole("button", { name: "I feel refreshed 저장" });
    expect(unsaved).not.toBeSelected();
    const unsavedIcon = findHost(unsaved, "ExpoSymbolView")[0];
    expect(unsavedIcon.props.name).toEqual({ ios: "bookmark", android: "bookmark_border", web: "bookmark_border" });
    expect(unsavedIcon.props.tintColor).toBe("#8A5A1E");
  });

  it("[spec] 저장을 누르면 저장하는 동안 그 칩을 누를 수 없고, 저장되면 저장 취소로 바뀐다", async () => {
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValue(pending.promise);
    await renderScreen(makeState(coachFeedback()));

    // 칩의 onPress는 저장이 끝날 때까지 기다리는 Promise를 돌려주고 fireEvent는 그 값을 기다리므로, 끝나기 전 모습을 보려면 기다리지 않고 누른다.
    const pressing = fireEvent.press(screen.getByRole("button", { name: "I feel refreshed 저장" }));
    await letPressActFinish();

    expect(saveExpression).toHaveBeenCalledWith({
      expression: "I feel refreshed",
      meaningKo: "상쾌해요",
      exampleEn: undefined,
      usageTipKo: COACH_USAGE_TIP,
      tags: ["넣어볼 표현"],
      sourceType: "COACH_RECOMMENDATION",
      promptId: "prompt-1",
      answerSessionId: "session-1",
      answerAttemptNo: 1
    });
    const saving = screen.getByRole("button", { name: "I feel refreshed 저장" });
    expect(saving).toBeDisabled();
    expect(findHost(saving, "ActivityIndicator")).toHaveLength(1);
    expect(findHost(saving, "ExpoSymbolView")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "it helps me focus 저장" })).toBeEnabled();

    await fireEvent.press(saving);
    expect(saveExpression).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(savedExpression(77, "I feel refreshed"));
    });
    await pressing;

    const saved = screen.getByRole("button", { name: "I feel refreshed 저장 취소" });
    expect(saved).toBeSelected();
    expect(saved).toBeEnabled();
    expect(findHost(saved, "ActivityIndicator")).toHaveLength(0);
  });

  it("[spec] 저장한 표현을 다시 누르면 저장을 취소하고 저장으로 돌아간다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(41, "it helps me focus")]);
    const pending = deferred<void>();
    jest.mocked(deleteSavedExpression).mockReturnValue(pending.promise);
    await renderScreen(makeState(coachFeedback()));

    const pressing = fireEvent.press(await screen.findByRole("button", { name: "it helps me focus 저장 취소" }));
    await letPressActFinish();

    expect(deleteSavedExpression).toHaveBeenCalledWith(41);
    expect(saveExpression).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "it helps me focus 저장 취소" })).toBeDisabled();

    await act(async () => {
      pending.resolve();
    });
    await pressing;

    const unsaved = screen.getByRole("button", { name: "it helps me focus 저장" });
    expect(unsaved).not.toBeSelected();
    expect(unsaved).toBeEnabled();
  });

  it.each([
    ["Error", new Error("저장 서버 오류"), "저장 서버 오류"],
    ["Error가 아닌 값", "문자열 실패", "잠시 후 다시 시도해 주세요."]
  ])("[spec] 저장에 실패하면(%s) 안내를 띄우고 칩을 다시 누를 수 있게 한다", async (_name, failure, message) => {
    jest.mocked(saveExpression).mockRejectedValue(failure);
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: "I feel refreshed 저장" }));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith("표현 저장에 실패했어요", message);
    const chip = screen.getByRole("button", { name: "I feel refreshed 저장" });
    expect(chip).toBeEnabled();
    expect(chip).not.toBeSelected();
  });

  it("[spec] 저장 목록을 불러오지 못하면 저장됨 표시가 없다", async () => {
    jest.mocked(getSavedExpressions).mockRejectedValue(new Error("목록 실패"));
    await renderScreen(makeState(coachFeedback()));
    await flushAsync();

    expect(screen.getByRole("button", { name: "it helps me focus 저장" })).not.toBeSelected();
    expect(screen.queryByRole("button", { name: /저장 취소$/ })).toBeNull();
  });

  it("[spec] 가볍게 넣어볼 표현은 REFINEMENT_EXPRESSION으로 뜻·예문·안내를 함께 저장한다", async () => {
    jest.mocked(saveExpression).mockResolvedValue(savedExpression(90, "start my day"));
    await renderScreen(makeState(readyFeedback({ refinementExpressions })));

    await fireEvent.press(screen.getByRole("button", { name: "start my day 저장" }));

    expect(saveExpression).toHaveBeenCalledWith({
      expression: "start my day",
      meaningKo: "하루를 시작하다",
      exampleEn: "I start my day with tea.",
      usageTipKo: "아침 일과를 말할 때 써요.",
      tags: ["표현 더하기"],
      sourceType: "REFINEMENT_EXPRESSION",
      promptId: "prompt-1",
      answerSessionId: "session-1",
      answerAttemptNo: 1
    });
    const saved = await screen.findByRole("button", { name: "start my day 저장 취소" });
    expect(saved).toBeSelected();
    expect(saved).toHaveStyle({ backgroundColor: "#EAF7ED", borderColor: "#AFD2B7" });
  });

  it("[spec] 보충 표현 카드의 칩은 넣어볼 표현과 같이 COACH_RECOMMENDATION으로 저장한다", async () => {
    jest.mocked(saveExpression).mockResolvedValue(savedExpression(91, "full of energy"));
    await renderScreen(makeState(readyFeedback({ completion: { enrichment } })));

    await fireEvent.press(screen.getByRole("button", { name: "full of energy 저장" }));

    expect(saveExpression).toHaveBeenCalledWith({
      expression: "full of energy",
      meaningKo: "힘이 넘치는",
      exampleEn: undefined,
      usageTipKo: COACH_USAGE_TIP,
      tags: ["넣어볼 표현"],
      sourceType: "COACH_RECOMMENDATION",
      promptId: "prompt-1",
      answerSessionId: "session-1",
      answerAttemptNo: 1
    });
    expect(await screen.findByRole("button", { name: "full of energy 저장 취소" })).toBeSelected();
  });
});

// ---------- 다시 쓰기 칸 ----------

describe("[spec] 다시 쓰기 칸", () => {
  it("[spec] 처음에는 안내 문구, 지금 답이 든 입력 칸, 다시 피드백 받아보기 버튼이 보이고 칸 위치로 스크롤하지 않는다", async () => {
    await renderScreen(makeState(coachFeedback()));

    expect(screen.getByText(COACH_HELP)).toBeOnTheScreen();
    const input = rewriteInput();
    expect(input).toHaveDisplayValue("I go to school.");
    expect(input.props.multiline).toBe(true);
    expect(screen.queryByText(RESTORED_NOTICE)).toBeNull();
    const submit = screen.getByRole("button", { name: SUBMIT_LABEL });
    expect(submit).toBeEnabled();
    expect(submit).not.toBeBusy();
    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");

    // fireEvent.layout은 위로 전하지 않으므로 칸 자체(안내 문구의 부모)에 보낸다.
    const card = screen.getByText(COACH_HELP).parent;
    expect(card?.props.onLayout).toEqual(expect.any(Function));
    await fireEvent.layout(card!, { y: 500 });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
    expect(ScrollView.prototype.scrollTo).not.toHaveBeenCalled();
  });

  it("[spec] 자리 표시 문구는 다시 쓰기 칸 설정의 문구를 먼저 쓴다", async () => {
    await renderScreen(
      makeState(coachFeedback(detailCoachMove, { rewriteWorkspace: { placeholder: "이유를 넣어 다시 써 보세요." } }))
    );

    expect(screen.getByPlaceholderText("이유를 넣어 다시 써 보세요.")).toHaveDisplayValue("I go to school.");
    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();
  });

  it("[spec] 빈 답으로 제출하면 오류를 보이고 보내지 않으며, 다시 입력하면 오류를 지운다", async () => {
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "   ");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));

    expect(screen.getByText("다시 쓴 답변을 입력해 주세요.")).toBeOnTheScreen();
    expect(submitFeedback).not.toHaveBeenCalled();

    await fireEvent.changeText(rewriteInput(), "I");
    expect(screen.queryByText("다시 쓴 답변을 입력해 주세요.")).toBeNull();
  });

  it("[spec] 로그인 사용자가 제출하면 제출 중 표시와 기다림 화면을 보이고, 성공하면 새 피드백으로 바뀌고 초안을 지운다", async () => {
    freezeLoadingCopyRotation();
    const pending = deferred<Feedback>();
    jest.mocked(submitFeedback).mockReturnValue(pending.promise);
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "  I went to school yesterday.  ");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));

    expect(keyboardDismissSpy).toHaveBeenCalled();
    expect(refreshSession).not.toHaveBeenCalled();
    expect(getOrCreateGuestId).not.toHaveBeenCalled();
    expect(submitFeedback).toHaveBeenCalledTimes(1);
    expect(submitFeedback).toHaveBeenCalledWith({
      promptId: "prompt-1",
      answer: "I went to school yesterday.",
      sessionId: "session-1",
      attemptType: "REWRITE",
      guestId: undefined,
      submissionId: "uuid-1"
    });
    expect(screen.getByRole("progressbar", { name: REWRITE_OVERLAY_NAME })).toBeOnTheScreen();
    // 기다림 화면이 모달이라 그 밖의 요소는 접근성 트리에서 가려진다.
    expect(screen.queryByRole("button", { name: SUBMITTING_LABEL })).toBeNull();
    const submitting = screen.getByRole("button", { name: SUBMITTING_LABEL, includeHiddenElements: true });
    expect(submitting).toBeDisabled();
    expect(submitting).toBeBusy();
    expect(submitting).toHaveStyle({ opacity: 0.58 });

    const nextFeedback = coachFeedback(detailCoachMove, { attemptNo: 2 }, { strength: "두 번째 시도의 잘한 점" });
    await act(async () => {
      pending.resolve(nextFeedback);
    });

    expect(screen.getByText("두 번째 시도의 잘한 점")).toBeOnTheScreen();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(rewriteInput()).toHaveDisplayValue("I went to school yesterday.");
    expect(screen.getByRole("button", { name: SUBMIT_LABEL })).toBeEnabled();
    expect(getPracticeFeedbackState("A", "prompt-1")).toEqual({
      difficulty: "A",
      prompt,
      initialAnswer: "I go to school.",
      answer: "I went to school yesterday.",
      feedback: nextFeedback
    });
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    await waitFor(() => expect(ScrollView.prototype.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true }));
  });

  it("[spec] 처음 답(initialAnswer)이 있으면 새 상태에도 그대로 남긴다", async () => {
    jest.mocked(submitFeedback).mockResolvedValue(coachFeedback(detailCoachMove, { attemptNo: 3 }));
    await renderScreen(makeState(coachFeedback(detailCoachMove, { attemptNo: 2 }), { initialAnswer: "My first answer." }));

    await fireEvent.changeText(rewriteInput(), "My third answer.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();

    expect(getPracticeFeedbackState("A", "prompt-1")?.initialAnswer).toBe("My first answer.");
    expect(getPracticeFeedbackState("A", "prompt-1")?.answer).toBe("My third answer.");
  });

  it.each([
    ["세션을 다시 확인해도 로그인 전", () => refreshSession.mockResolvedValue(null), GUEST_ID, true],
    ["세션 확인이 실패", () => refreshSession.mockRejectedValue(new Error("network")), GUEST_ID, true],
    ["세션을 다시 확인하니 로그인", () => refreshSession.mockResolvedValue(signedInUser), undefined, false]
  ])(
    "[spec] 로그인 전 사용자가 제출하면 세션을 다시 확인하고(%s) 게스트 아이디를 정한다",
    async (_name, arrange, expectedGuestId, usesGuestId) => {
      setSessionUser(null);
      arrange();
      jest.mocked(submitFeedback).mockResolvedValue(coachFeedback(detailCoachMove, { attemptNo: 2 }));
      await renderScreen(makeState(coachFeedback()));

      await fireEvent.changeText(rewriteInput(), "I went to school.");
      await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
      await flushAsync();

      expect(refreshSession).toHaveBeenCalledTimes(1);
      expect(getOrCreateGuestId).toHaveBeenCalledTimes(usesGuestId ? 1 : 0);
      expect(submitFeedback).toHaveBeenCalledWith({
        promptId: "prompt-1",
        answer: "I went to school.",
        sessionId: "session-1",
        attemptType: "REWRITE",
        guestId: expectedGuestId,
        submissionId: "uuid-1"
      });
    }
  );

  it("[spec] 게스트 제한에 걸리면 안내 문구와 로그인 안내를 띄운다", async () => {
    setSessionUser(null);
    jest.mocked(submitFeedback).mockRejectedValue(new ApiError("limit", 403, "GUEST_LIMIT_REACHED"));
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "I went to school.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();

    expect(
      screen.getByText("게스트는 질문 1개와 다시쓰기 1회까지만 체험할 수 있어요. 이어서 학습하려면 로그인해 주세요.")
    ).toBeOnTheScreen();
    expect(screen.queryByText("limit")).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(
      "로그인하고 이어서 써 보세요",
      "로그인하면 지금 쓰던 답변을 그대로 이어서 다시 쓸 수 있어요.",
      [
        { text: "나중에", style: "cancel" },
        { text: "로그인하기", onPress: expect.any(Function) }
      ]
    );
    lastAlertButtons()[1].onPress?.();
    expect(router.push).toHaveBeenCalledWith("/login");
    expect(screen.getByRole("button", { name: SUBMIT_LABEL })).toBeEnabled();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it.each([
    ["Error", new Error("서버가 바빠요"), "서버가 바빠요"],
    ["게스트 제한이 아닌 ApiError", new ApiError("요청이 너무 많아요", 429, "RATE_LIMITED"), "요청이 너무 많아요"],
    ["Error가 아닌 값", "문자열 실패", "피드백을 생성하지 못했어요."]
  ])("[spec] 그 밖의 오류(%s)는 그 메시지를 칸에 보인다", async (_name, failure, message) => {
    jest.mocked(submitFeedback).mockRejectedValue(failure);
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "I went to school.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();

    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: SUBMIT_LABEL })).toBeEnabled();
    expect(rewriteInput()).toHaveDisplayValue("I went to school.");
  });

  it("[spec] 실패 뒤 고치지 않고 다시 내면 같은 제출 아이디를, 고친 뒤 내면 새 제출 아이디를 쓴다", async () => {
    jest.mocked(submitFeedback).mockRejectedValue(new Error("잠깐 실패"));
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "I went to school.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();
    await fireEvent.changeText(rewriteInput(), "I went to school early.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();

    expect(jest.mocked(submitFeedback).mock.calls.map(([request]) => request.submissionId)).toEqual([
      "uuid-1",
      "uuid-1",
      "uuid-2"
    ]);
  });

  it("[spec] 이 기기에 같은 세션의 다시 쓰기 초안이 있으면 불러와 칸에 넣고 안내를 보이며, 입력하면 안내를 지운다", async () => {
    jest.mocked(getLocalWritingDraft).mockResolvedValue(rewriteDraft());
    await renderScreen(makeState(coachFeedback()));

    expect(await screen.findByText(RESTORED_NOTICE)).toBeOnTheScreen();
    expect(rewriteInput()).toHaveDisplayValue("I go to school because I like it.");

    await fireEvent.changeText(rewriteInput(), "I go to school because I like it a lot.");
    expect(screen.queryByText(RESTORED_NOTICE)).toBeNull();
  });

  it.each([
    ["다른 세션의 초안", rewriteDraft({ sessionId: "session-0" })],
    ["처음 글과 같은(앞뒤 공백만 다른) 초안", rewriteDraft({ rewrite: "  I go to school.  " })],
    ["공백뿐인 초안", rewriteDraft({ rewrite: "   " })]
  ])("[spec] %s은 불러오지 않는다", async (_name, draft) => {
    jest.mocked(getLocalWritingDraft).mockResolvedValue(draft);
    await renderScreen(makeState(coachFeedback()));
    await flushAsync();

    expect(rewriteInput()).toHaveDisplayValue("I go to school.");
    expect(screen.queryByText(RESTORED_NOTICE)).toBeNull();
  });

  it("[spec] 초안을 읽기 전에 학습자가 고치기 시작하면 초안을 불러오지 않는다", async () => {
    const pending = deferred<WritingDraft | null>();
    jest.mocked(getLocalWritingDraft).mockReturnValue(pending.promise);
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "My own text.");
    await act(async () => {
      pending.resolve(rewriteDraft());
    });

    expect(rewriteInput()).toHaveDisplayValue("My own text.");
    expect(screen.queryByText(RESTORED_NOTICE)).toBeNull();
  });

  it("[spec] 고친 뒤 800ms가 지나면 이 기기에 다시 쓰기 초안을 임시저장한다", async () => {
    jest.useFakeTimers();
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "I went to school.");
    const typedAt = Date.now();
    await act(async () => {
      jest.advanceTimersByTime(799);
    });
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(saveLocalWritingDraft).toHaveBeenCalledWith({
      promptId: "prompt-1",
      draftType: "REWRITE",
      selectedDifficulty: "A",
      sessionId: "session-1",
      answer: "I go to school.",
      rewrite: "I went to school.",
      lastSubmittedAnswer: "I go to school.",
      feedback: null,
      step: "rewrite",
      updatedAt: new Date(typedAt + 800).toISOString()
    });
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 이어서 고치면 마지막 입력에서 800ms 뒤에 한 번만 임시저장한다", async () => {
    jest.useFakeTimers();
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "I went");
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await fireEvent.changeText(rewriteInput(), "I went to school.");
    await act(async () => {
      jest.advanceTimersByTime(799);
    });
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(saveLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveLocalWritingDraft).mock.calls[0][0].rewrite).toBe("I went to school.");
  });

  it("[spec] 칸을 비우면 800ms 뒤 이 기기의 다시 쓰기 초안을 지운다", async () => {
    jest.useFakeTimers();
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "   ");
    await act(async () => {
      jest.advanceTimersByTime(800);
    });

    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
    expect(deleteLocalWritingDraft).toHaveBeenCalledWith("prompt-1", "REWRITE");
    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 고치지 않으면(처음 채운 글, 불러온 초안) 임시저장하지 않는다", async () => {
    jest.useFakeTimers();
    jest.mocked(getLocalWritingDraft).mockResolvedValue(rewriteDraft());
    await renderScreen(makeState(coachFeedback()));
    await flushAsync();
    expect(rewriteInput()).toHaveDisplayValue("I go to school because I like it.");

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).not.toHaveBeenCalled();
  });

  it("[spec] 제출에 성공한 뒤에는 남은 입력을 임시저장하지 않는다", async () => {
    jest.useFakeTimers();
    jest.mocked(submitFeedback).mockResolvedValue(coachFeedback(detailCoachMove, { attemptNo: 2 }));
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.changeText(rewriteInput(), "I went to school.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(saveLocalWritingDraft).not.toHaveBeenCalled();
    expect(deleteLocalWritingDraft).toHaveBeenCalledTimes(1);
  });

  it("[spec] 이미 완료한 질문이면 다시 쓰기 칸이 없다", async () => {
    await renderScreen(makeState(readyFeedback(), { sessionCompleted: true }));

    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();
    expect(screen.queryByRole("button", { name: SUBMIT_LABEL })).toBeNull();
    expect(screen.queryByRole("button", { name: REWRITE_OPEN_LABEL })).toBeNull();
  });
});

// ---------- 마무리 구간 ----------

describe("[spec] 마무리 구간", () => {
  it("[spec] 마칠 준비가 되고 가볍게 넣어볼 표현이 있으면 그 완료 말풍선과 마스코트를 보인다", async () => {
    await renderScreen(makeState(readyFeedback({ refinementExpressions })));

    expect(screen.getByText(READY_WITH_PHRASES_HEADLINE)).toBeOnTheScreen();
    const images = findHost(screen.container, "Image");
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual(require("@/assets/images/feedback-completion-mascot.png"));
  });

  it("[spec] 마칠 준비가 되고 넣어볼 표현이 없으면 마무리해도 충분하다는 말풍선을 보인다", async () => {
    await renderScreen(makeState(readyFeedback({ completion: { headline: "쓰지 않는 완료 문구" } })));

    expect(screen.getByText(READY_WITHOUT_PHRASES_HEADLINE)).toBeOnTheScreen();
    expect(screen.queryByText("쓰지 않는 완료 문구")).toBeNull();
  });

  it.each([
    ["completion.headline", { completion: { headline: "완료 문구예요" } }, {}, "완료 문구예요"],
    ["loop.headline", {}, { loop: { headline: "루프 문구예요" } }, "루프 문구예요"],
    ["loopStatus.headline", {}, { loopStatusHeadline: "상태 문구예요" }, "상태 문구예요"],
    ["completionMessage", {}, { completionMessage: "완료 메시지예요" }, "완료 메시지예요"],
    ["summary", {}, { summary: "요약이에요" }, "요약이에요"],
    ["아무것도 없음", {}, {}, READY_WITH_PHRASES_HEADLINE]
  ])(
    "[spec] 마칠 준비 전이라도 완료 버튼 문구가 있으면 말풍선을 보이고, 문구는 %s 순서로 고른다(완료 버튼은 없다)",
    async (_name, visibleOverrides, extra, expected) => {
      const { loopStatusHeadline, ...feedbackOverrides } = extra as Partial<Feedback> & { loopStatusHeadline?: string };
      await renderScreen(
        makeState(
          coachFeedback(
            detailCoachMove,
            {
              ...feedbackOverrides,
              summary: feedbackOverrides.summary ?? "",
              ui: { loopStatus: { headline: loopStatusHeadline ?? "", finishCtaLabel: "여기서 마치기" } }
            },
            visibleOverrides
          )
        )
      );

      expect(screen.getByText(expected)).toBeOnTheScreen();
      expect(findHost(screen.container, "Image")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "여기서 마치기" })).toBeNull();
      expect(screen.queryByRole("button", { name: REWRITE_OPEN_LABEL })).toBeNull();
      expect(screen.getByText("이유를 한 문장 더해 보세요")).toBeOnTheScreen();
      expect(screen.getByText(COACH_HELP)).toBeOnTheScreen();
    }
  );

  it("[spec] 마칠 준비 전이고 완료 버튼 문구가 없으면 말풍선도 완료 버튼도 없다", async () => {
    await renderScreen(makeState(coachFeedback(detailCoachMove, { summary: "요약이에요" })));

    expect(screen.queryByText("요약이에요")).toBeNull();
    expect(findHost(screen.container, "Image")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "루프 완료하기" })).toBeNull();
  });

  it("[spec] 마칠 준비가 되었어도 완료 버튼 문구가 비면 말풍선은 없고 완료 버튼은 루프 완료하기다", async () => {
    await renderScreen(makeState(readyFeedback({ refinementExpressions }, { loopComplete: false })));

    expect(screen.queryByText(READY_WITH_PHRASES_HEADLINE)).toBeNull();
    expect(findHost(screen.container, "Image")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "루프 완료하기" })).toBeEnabled();
    expect(screen.getByText("가볍게 넣어볼 표현")).toBeOnTheScreen();
  });

  it.each([
    [
      "다음 할 일이 finish면 그 문구",
      { loopComplete: false, loop: { nextAction: "finish", nextActionLabel: "오늘 루프 마치기" }, ui: { loopStatus: { headline: "", finishCtaLabel: "마무리하기" } } },
      {},
      "오늘 루프 마치기"
    ],
    [
      "다음 할 일이 finish가 아니면 상태의 완료 문구",
      { loopComplete: true, loop: { nextAction: "rewrite", nextActionLabel: "다시 쓰기" }, ui: { loopStatus: { headline: "", finishCtaLabel: "마무리하기" } } },
      {},
      "마무리하기"
    ],
    ["loopComplete만 있으면 루프 완료하기", { loopComplete: true }, {}, "루프 완료하기"],
    [
      "이미 완료한 질문이면 완료 화면으로 돌아가기",
      { loopComplete: true, ui: { loopStatus: { headline: "", finishCtaLabel: "마무리하기" } } },
      { sessionCompleted: true },
      "완료 화면으로 돌아가기"
    ]
  ])("[spec] 완료 버튼 문구: %s", async (_name, overrides, stateOverrides, label) => {
    await renderScreen(makeState(readyFeedback({}, overrides as Partial<Feedback>), stateOverrides));

    expect(screen.getByRole("button", { name: label })).toBeEnabled();
    expect(screen.getByText(READY_WITHOUT_PHRASES_HEADLINE)).toBeOnTheScreen();
  });

  it("[spec] 보충 표현 카드는 제목·이유·다시 쓸 때·문장 틀·넣어볼 표현 4개를 보이고, 이 내용 넣어서 다시 써 보기로 칸을 연다", async () => {
    await renderScreen(makeState(readyFeedback({ completion: { enrichment } })));

    expect(screen.getByText("더 풍부하게 써 보기 · 선택")).toBeOnTheScreen();
    expect(screen.getByText("느낌을 한 가지 더해 보세요")).toBeOnTheScreen();
    expect(screen.getByText("느낌이 있으면 답이 생생해져요.")).toBeOnTheScreen();
    expect(screen.getByText("다시 쓸 때")).toBeOnTheScreen();
    expect(screen.getByText("I feel로 그때 기분을 붙여 보세요.")).toBeOnTheScreen();
    expect(screen.getByText("문장 틀")).toBeOnTheScreen();
    expect(screen.getByText("I feel ____ when I ____.")).toBeOnTheScreen();
    expect(screen.getByText("저는 ____할 때 ____한 기분이에요.")).toBeOnTheScreen();
    expect(screen.getByText("넣어볼 표현")).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: /저장$/ })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "calm 저장" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "full of energy 저장" })).toBeOnTheScreen();
    expect(screen.getByText("힘이 넘치는")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "happy 저장" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "proud 저장" })).toBeNull();
    expect(screen.getByText(READY_WITHOUT_PHRASES_HEADLINE)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: REWRITE_OPEN_LABEL })).toBeNull();
    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: ENRICHMENT_REWRITE_LABEL }));

    expect(screen.getByText(ENRICHMENT_HELP)).toBeOnTheScreen();
    expect(rewriteInput()).toHaveDisplayValue("I go to school.");
    expect(screen.queryByRole("button", { name: ENRICHMENT_REWRITE_LABEL })).toBeNull();
    expect(screen.getByRole("button", { name: SUBMIT_LABEL })).toBeEnabled();
  });

  it("[spec] 보충 표현에 문장 틀이 없으면 카드가 없고 다시 다듬어 보기가 보인다", async () => {
    await renderScreen(makeState(readyFeedback({ completion: { enrichment: { ...enrichment, skeletonEn: " " } } })));

    expect(screen.queryByText("더 풍부하게 써 보기 · 선택")).toBeNull();
    expect(screen.getByRole("button", { name: REWRITE_OPEN_LABEL })).toBeOnTheScreen();
  });

  it("[spec] 이미 완료한 질문이면 보충 표현 카드에 완료 안내를 보이고 다시 쓰기 버튼은 없다", async () => {
    await renderScreen(makeState(readyFeedback({ completion: { enrichment } }), { sessionCompleted: true }));

    expect(screen.getByText("더 풍부하게 써 보기 · 선택")).toBeOnTheScreen();
    expect(screen.getByText(COMPLETED_NOTICE)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: ENRICHMENT_REWRITE_LABEL })).toBeNull();
    expect(screen.queryByRole("button", { name: REWRITE_OPEN_LABEL })).toBeNull();
    expect(screen.getByRole("button", { name: "완료 화면으로 돌아가기" })).toBeEnabled();
  });

  it("[spec] 가볍게 넣어볼 표현은 숨김·자리표시자·이미 쓴 표현·중복을 빼고 보이는 피드백의 목록에서 고른다", async () => {
    await renderScreen(
      makeState(
        readyFeedback(
          { refinementExpressions },
          { revisedAnswer: "I usually read the news.", refinementExpressions: [{ expression: "legacy phrase" }] }
        )
      )
    );

    expect(screen.getByText("가볍게 넣어볼 표현")).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: /저장$/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "start my day 저장" })).toBeOnTheScreen();
    expect(screen.getByText("하루를 시작하다")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "on a regular basis 저장" })).toBeOnTheScreen();
    expect(screen.getByText("규칙적으로")).toBeOnTheScreen();
    for (const hidden of ["숨김 표현", "자리표시자 표현", "학교에 가다", "뉴스를 읽다", "중복 표현", "legacy phrase"]) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
  });

  it("[spec] 마칠 준비 전에는 가볍게 넣어볼 표현과 모범답안이 없다", async () => {
    await renderScreen(
      makeState(
        coachFeedback(detailCoachMove, { modelAnswer: "I usually start my day with tea." }, { refinementExpressions })
      )
    );

    expect(screen.queryByText("가볍게 넣어볼 표현")).toBeNull();
    expect(screen.queryByRole("button", { name: "start my day 저장" })).toBeNull();
    expect(screen.queryByRole("button", { name: "모범답안 펼치기" })).toBeNull();
    expect(screen.queryByText("모범답안")).toBeNull();
  });

  it("[spec] 모범답안은 접힌 채로 보이고 눌러서 펼치고 접는다", async () => {
    await renderScreen(
      makeState(
        readyFeedback(
          { modelAnswer: "I usually start my day with a cup of tea.", modelAnswerKo: "저는 보통 차 한 잔으로 하루를 시작해요." },
          { modelAnswer: "쓰지 않는 옛 모범답안" }
        )
      )
    );

    const open = screen.getByRole("button", { name: "모범답안 펼치기" });
    expect(open).toBeCollapsed();
    expect(screen.getByText("참고용")).toBeOnTheScreen();
    expect(screen.getByText("모범답안")).toBeOnTheScreen();
    expect(screen.getByText("+")).toBeOnTheScreen();
    expect(screen.queryByText("I usually start my day with a cup of tea.")).toBeNull();

    await fireEvent.press(open);

    const close = screen.getByRole("button", { name: "모범답안 접기" });
    expect(close).toBeExpanded();
    expect(screen.getByText("−")).toBeOnTheScreen();
    expect(screen.getByText("I usually start my day with a cup of tea.")).toBeOnTheScreen();
    expect(screen.getByText("저는 보통 차 한 잔으로 하루를 시작해요.")).toBeOnTheScreen();
    expect(screen.queryByText("쓰지 않는 옛 모범답안")).toBeNull();

    await fireEvent.press(close);

    expect(screen.getByRole("button", { name: "모범답안 펼치기" })).toBeCollapsed();
    expect(screen.queryByText("I usually start my day with a cup of tea.")).toBeNull();
  });

  it("[spec] 보이는 피드백에 모범답안이 없으면 feedback의 모범답안을 쓴다", async () => {
    await renderScreen(makeState(readyFeedback({}, { modelAnswer: "Feedback model answer." })));

    await fireEvent.press(screen.getByRole("button", { name: "모범답안 펼치기" }));

    expect(screen.getByText("Feedback model answer.")).toBeOnTheScreen();
  });

  it("[spec] 다시 다듬어 보기를 누르면 칸이 열리고 버튼이 사라지며, 칸 위치(12 위)로 스크롤한다", async () => {
    await renderScreen(makeState(readyFeedback()));

    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: REWRITE_OPEN_LABEL }));

    expect(screen.getByText(READY_HELP)).toBeOnTheScreen();
    expect(rewriteInput()).toHaveDisplayValue("I go to school.");
    expect(screen.queryByRole("button", { name: REWRITE_OPEN_LABEL })).toBeNull();
    expect(screen.getByRole("button", { name: "루프 완료하기" })).toBeEnabled();

    const card = screen.getByText(READY_HELP).parent;
    expect(card?.props.onLayout).toEqual(expect.any(Function));
    await fireEvent.layout(card!, { y: 500 });
    await waitFor(() => expect(ScrollView.prototype.scrollTo).toHaveBeenCalledWith({ y: 488, animated: true }));
  });

  it("[spec] 다시 다듬은 답을 내서 마칠 준비가 된 새 피드백을 받으면 칸이 다시 닫힌다", async () => {
    jest
      .mocked(submitFeedback)
      .mockResolvedValue(readyFeedback({ strength: "두 번째 완성 답의 잘한 점" }, { attemptNo: 2 }));
    await renderScreen(makeState(readyFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: REWRITE_OPEN_LABEL }));
    await fireEvent.changeText(rewriteInput(), "I go to school by bus.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));

    expect(await screen.findByText("두 번째 완성 답의 잘한 점")).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();
    expect(screen.getByRole("button", { name: REWRITE_OPEN_LABEL })).toBeOnTheScreen();
  });

  it("[spec] 완료를 누르면 완료 중 표시를 보이고, 세션을 완료한 뒤 완료 화면으로 가며 화면은 완료한 질문이 된다", async () => {
    const pending = deferred<{ sessionId: string; status: "COMPLETED" }>();
    jest.mocked(completeFeedbackSession).mockReturnValue(pending.promise);
    await renderScreen(makeState(readyFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: "루프 완료하기" }));

    expect(completeFeedbackSession).toHaveBeenCalledWith("session-1", undefined);
    expect(refreshSession).not.toHaveBeenCalled();
    const finishing = screen.getByRole("button", { name: "완료하는 중..." });
    expect(finishing).toBeDisabled();
    expect(finishing).toBeBusy();
    expect(finishing).toHaveStyle({ opacity: 0.58 });

    await act(async () => {
      pending.resolve({ sessionId: "session-1", status: "COMPLETED" });
    });

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/complete",
      params: { difficulty: "A", promptId: "prompt-1" }
    });
    expect(getPracticeFeedbackState("A", "prompt-1")?.sessionCompleted).toBe(true);
    expect(screen.getByRole("button", { name: "완료 화면으로 돌아가기" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: REWRITE_OPEN_LABEL })).toBeNull();
  });

  it.each([
    ["세션을 다시 확인해도 로그인 전", () => refreshSession.mockResolvedValue(null), GUEST_ID],
    ["세션 확인이 실패", () => refreshSession.mockRejectedValue(new Error("network")), GUEST_ID],
    ["세션을 다시 확인하니 로그인", () => refreshSession.mockResolvedValue(signedInUser), undefined]
  ])("[spec] 로그인 전 사용자가 완료하면 세션을 다시 확인하고(%s) 게스트 아이디를 정한다", async (_name, arrange, guestId) => {
    setSessionUser(null);
    arrange();
    jest.mocked(completeFeedbackSession).mockResolvedValue({ sessionId: "session-1", status: "COMPLETED" });
    await renderScreen(makeState(readyFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: "루프 완료하기" }));
    await flushAsync();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(completeFeedbackSession).toHaveBeenCalledWith("session-1", guestId);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Error", new Error("이미 끝난 세션이에요"), "이미 끝난 세션이에요"],
    ["Error가 아닌 값", "문자열 실패", "잠시 후 다시 시도해 주세요."]
  ])("[spec] 완료에 실패하면(%s) 안내를 띄우고 버튼을 되돌린다", async (_name, failure, message) => {
    jest.mocked(completeFeedbackSession).mockRejectedValue(failure);
    await renderScreen(makeState(readyFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: "루프 완료하기" }));
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith("완료하지 못했어요", message);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "루프 완료하기" })).toBeEnabled();
    expect(getPracticeFeedbackState("A", "prompt-1")?.sessionCompleted).toBeUndefined();
  });

  it("[spec] 이미 완료한 질문에서 완료 화면으로 돌아가기를 누르면 세션 완료를 다시 부르고 완료 화면으로 간다", async () => {
    jest.mocked(completeFeedbackSession).mockResolvedValue({ sessionId: "session-1", status: "COMPLETED" });
    await renderScreen(makeState(readyFeedback(), { sessionCompleted: true }));

    await fireEvent.press(screen.getByRole("button", { name: "완료 화면으로 돌아가기" }));
    await flushAsync();

    expect(completeFeedbackSession).toHaveBeenCalledWith("session-1", undefined);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/complete",
      params: { difficulty: "A", promptId: "prompt-1" }
    });
  });
});

// ---------- 같은 화면에서 질문이 바뀔 때(화면 상태 되돌리기) ----------

describe("[spec] 같은 화면에서 질문이 바뀔 때", () => {
  const prompt2: Prompt = { ...prompt, id: "prompt-2", questionEn: "What do you do before bed?" };

  function secondState(feedback: Feedback): PracticeFeedbackState {
    return makeState({ ...feedback, promptId: "prompt-2", sessionId: "session-2" }, { prompt: prompt2, answer: "I read books." });
  }

  async function switchToSecondPrompt(state: PracticeFeedbackState) {
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(state);
    setParams({ difficulty: "A", promptId: "prompt-2" });
    await screen.rerender(<PracticeFeedbackScreen />);
  }

  it("[spec] 새 질문의 피드백을 불러오고, 저장 중이던 칩의 저장 중 표시를 지운다", async () => {
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValue(pending.promise);
    await renderScreen(makeState(coachFeedback()));
    const pressing = fireEvent.press(screen.getByRole("button", { name: "I feel refreshed 저장" }));
    await letPressActFinish();
    expect(screen.getByRole("button", { name: "I feel refreshed 저장" })).toBeDisabled();

    await switchToSecondPrompt(secondState(coachFeedback(detailCoachMove, {}, { strength: "두 번째 질문의 잘한 점" })));

    expect(await screen.findByText("두 번째 질문의 잘한 점")).toBeOnTheScreen();
    expect(hydratePracticeFeedbackState).toHaveBeenCalledWith("A", "prompt-2");
    expect(screen.getByRole("button", { name: "I feel refreshed 저장" })).toBeEnabled();
    expect(rewriteInput()).toHaveDisplayValue("I read books.");

    // 앞 질문에서 늦게 끝난 저장도 이 화면의 저장 목록에 들어간다(지금 동작).
    await act(async () => {
      pending.resolve(savedExpression(77, "I feel refreshed"));
    });
    await pressing;
    expect(screen.getByRole("button", { name: "I feel refreshed 저장 취소" })).toBeSelected();
  });

  it("[spec] 펼친 모범답안과 연 다시 다듬기 칸을 닫고, 앞 질문의 제출 아이디를 버린다", async () => {
    jest.mocked(submitFeedback).mockRejectedValueOnce(new Error("잠깐 실패"));
    await renderScreen(makeState(readyFeedback({ modelAnswer: "Model answer one." })));
    await fireEvent.press(screen.getByRole("button", { name: "모범답안 펼치기" }));
    await fireEvent.press(screen.getByRole("button", { name: REWRITE_OPEN_LABEL }));
    await fireEvent.changeText(rewriteInput(), "I go to school by bus.");
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();
    expect(screen.getByText("잠깐 실패")).toBeOnTheScreen();
    expect(jest.mocked(submitFeedback).mock.calls[0][0].submissionId).toBe("uuid-1");

    await switchToSecondPrompt(secondState(readyFeedback({ modelAnswer: "Model answer two." })));

    expect(await screen.findByRole("button", { name: "모범답안 펼치기" })).toBeCollapsed();
    expect(screen.queryByText("Model answer two.")).toBeNull();
    expect(screen.queryByPlaceholderText(DEFAULT_PLACEHOLDER)).toBeNull();
    expect(screen.queryByText("잠깐 실패")).toBeNull();

    jest.mocked(submitFeedback).mockResolvedValue(secondState(readyFeedback({}, { attemptNo: 2 })).feedback);
    await fireEvent.press(screen.getByRole("button", { name: REWRITE_OPEN_LABEL }));
    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await flushAsync();

    expect(jest.mocked(submitFeedback).mock.calls[1][0]).toEqual({
      promptId: "prompt-2",
      answer: "I read books.",
      sessionId: "session-2",
      attemptType: "REWRITE",
      guestId: undefined,
      submissionId: "uuid-2"
    });
  });
});

// ---------- 화면 구조 ----------
// 문구·구조·접근성 속성·스타일 값이 지금과 같은지 호스트 트리 스냅샷으로 기록한다(tests/app/practice/__snapshots__).
// 기다림 화면(FeedbackLoadingOverlay)은 이번에 옮기지 않는 컴포넌트이고 움직이는 값이 들어 있어 넣지 않는다.

describe("[spec] 화면 구조", () => {
  it("[spec] 불러오는 중 화면", async () => {
    jest.mocked(hydratePracticeFeedbackState).mockReturnValue(new Promise(() => undefined));
    await renderScreen(null);

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 빈 상태 화면", async () => {
    await renderScreen(null);
    await screen.findByText("피드백을 찾지 못했어요");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 고침이 아닌 코치 피드백 화면(넣어볼 표현 하나는 저장됨)", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(41, "it helps me focus")]);
    await renderScreen(makeState(coachFeedback()));
    await screen.findByRole("button", { name: "it helps me focus 저장 취소" });

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 문법 고침 피드백 화면(교정 모두 펼침, 완료 말풍선 있음)", async () => {
    await renderScreen(
      makeState(
        coachFeedback(languageFixCoachMove, {
          ui: { loopStatus: { headline: "여기까지도 좋아요", finishCtaLabel: "여기서 마치기" } }
        })
      )
    );
    await fireEvent.press(screen.getByRole("button", { name: "교정 2개 더 보기" }));

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 마칠 준비 화면(가볍게 넣어볼 표현 하나는 저장됨, 모범답안 펼침)", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(90, "start my day")]);
    await renderScreen(
      makeState(
        readyFeedback(
          {
            refinementExpressions,
            modelAnswer: "I usually start my day with a cup of tea.",
            modelAnswerKo: "저는 보통 차 한 잔으로 하루를 시작해요."
          },
          { revisedAnswer: "I usually read the news." }
        )
      )
    );
    await screen.findByRole("button", { name: "start my day 저장 취소" });
    await fireEvent.press(screen.getByRole("button", { name: "모범답안 펼치기" }));

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 보충 표현 화면에서 이 내용 넣어서 다시 써 보기를 누른 뒤", async () => {
    await renderScreen(makeState(readyFeedback({ completion: { enrichment } })));
    await fireEvent.press(screen.getByRole("button", { name: ENRICHMENT_REWRITE_LABEL }));

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 이미 완료한 질문의 보충 표현 화면", async () => {
    await renderScreen(makeState(readyFeedback({ completion: { enrichment } }), { sessionCompleted: true }));

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 다시 쓰기 칸: 불러온 초안 안내와 제출 오류가 함께 보일 때", async () => {
    jest.mocked(getLocalWritingDraft).mockResolvedValue(rewriteDraft());
    jest.mocked(submitFeedback).mockRejectedValue(new Error("서버가 바빠요"));
    await renderScreen(makeState(coachFeedback()));
    await screen.findByText(RESTORED_NOTICE);

    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));
    await screen.findByText("서버가 바빠요");

    expect(structureOf(screen.getByText(COACH_HELP).parent!)).toMatchSnapshot();
  });

  it("[spec] 다시 쓰기 칸: 제출 중", async () => {
    const pending = deferred<Feedback>();
    jest.mocked(submitFeedback).mockReturnValue(pending.promise);
    await renderScreen(makeState(coachFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: SUBMIT_LABEL }));

    const card = screen.getByText(COACH_HELP, { includeHiddenElements: true }).parent!;
    expect(structureOf(card)).toMatchSnapshot();

    await act(async () => {
      pending.resolve(coachFeedback(detailCoachMove, { attemptNo: 2 }));
    });
  });

  it("[spec] 저장 중인 넣어볼 표현 칩", async () => {
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValue(pending.promise);
    await renderScreen(makeState(coachFeedback()));

    const pressing = fireEvent.press(screen.getByRole("button", { name: "I feel refreshed 저장" }));
    await letPressActFinish();

    expect(structureOf(screen.getByRole("button", { name: "I feel refreshed 저장" }))).toMatchSnapshot();

    await act(async () => {
      pending.resolve(savedExpression(77, "I feel refreshed"));
    });
    await pressing;
  });

  it("[spec] 완료 중인 완료 버튼", async () => {
    const pending = deferred<{ sessionId: string; status: "COMPLETED" }>();
    jest.mocked(completeFeedbackSession).mockReturnValue(pending.promise);
    await renderScreen(makeState(readyFeedback()));

    await fireEvent.press(screen.getByRole("button", { name: "루프 완료하기" }));

    expect(structureOf(screen.getByRole("button", { name: "완료하는 중..." }))).toMatchSnapshot();

    await act(async () => {
      pending.resolve({ sessionId: "session-1", status: "COMPLETED" });
    });
  });
});
