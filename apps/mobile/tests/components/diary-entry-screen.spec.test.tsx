// [spec] qa 테스트(작업 047-04 일기 화면 조각, 리팩터링의 "지금 동작" 기록).
// 영어일기 화면(src/components/diary-entry-screen.tsx의 DiaryEntryScreen) 전체를 새 일기(initialEntryId 없음)와 기존 일기
// (있음) 두 경우로 렌더하고 사용자처럼 눌러, 지금 보이는 문구·구조·접근성 속성과 부르는 API·기기 저장 동작을 좋고 나쁨과
// 관계없이 그대로 적는다. 화면 조각·피드백 패널·순수 함수·스타일을 옮긴 뒤에도, AI 코치·표현 저장 상태를 훅으로 옮기는
// 다음 단계에서도 이 테스트가 그대로 통과해야 한다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(이 기기 임시저장 @/lib/diary-drafts), 로그인 상태(@/lib/session),
// 라우터(expo-router), Alert(spyOn), AppState(React Native 테스트 설정의 가짜에 듣는 함수를 모으게 함),
// 네이티브 모듈(expo-symbols, 안전 영역). 바뀐 곳 표시 계산(@/lib/inline-feedback)과 로그인 주소(@/lib/login-redirect),
// 기다림 화면·문제 보내기 링크·모달 안전 영역 컴포넌트는 실제 것을 쓴다.
// 날짜가 오늘에 기대므로 모든 테스트를 가짜 시계로 돌린다(2026-11-12T03:00:00Z = 서울 2026-11-12 12:00에서 멈춤).
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, AppState, ScrollView, StyleSheet, TextInput, type AppStateStatus } from "react-native";
import type { TestInstance } from "test-renderer";
import DiaryEntryScreen from "@/components/diary-entry-screen";
import {
  createDiaryEntry,
  deleteDiaryEntry,
  deleteSavedExpression,
  getDiaryEntry,
  getSavedExpressions,
  requestCoachHelp,
  requestDiaryFeedback,
  saveExpression,
  updateDiaryEntry
} from "@/lib/api";
import { deleteDiaryDraft, getDiaryDraft, saveDiaryDraft, type DiaryDraft } from "@/lib/diary-drafts";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  CoachHelpResponse,
  DiaryEntry,
  DiaryExpression,
  DiaryFeedback,
  SavedExpression
} from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() }
}));
// 아이콘(SymbolView)은 네이티브 모듈이라, 받은 속성을 그대로 가진 호스트 요소로 대신한다.
jest.mock("expo-symbols", () => {
  const React = jest.requireActual<typeof import("react")>("react");
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
jest.mock("@/lib/api", () => ({
  createDiaryEntry: jest.fn(),
  deleteDiaryEntry: jest.fn(),
  deleteSavedExpression: jest.fn(),
  getDiaryEntry: jest.fn(),
  getSavedExpressions: jest.fn(),
  requestCoachHelp: jest.fn(),
  requestDiaryFeedback: jest.fn(),
  saveExpression: jest.fn(),
  updateDiaryEntry: jest.fn()
}));
jest.mock("@/lib/diary-drafts", () => ({
  deleteDiaryDraft: jest.fn(),
  getDiaryDraft: jest.fn(),
  saveDiaryDraft: jest.fn()
}));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY = "2026-11-12";
const TODAY_TITLE = "2026년 11월 12일의 일기";
const DATE_PLACEHOLDER = "2026-04-23";
const WRITE_PLACEHOLDER = "Today, I...";
const REWRITE_PLACEHOLDER = "피드백을 반영해서 다시 써보세요.";
const COACH_PLACEHOLDER = '예: "아쉬웠다"를 자연스럽게 어떻게 써?';
const OVERLAY_NAME = "영어일기를 읽고 있어요. 문장 흐름과 자연스러운 표현을 함께 확인할게요.";
const COACH_BUBBLE = "막히면 AI 코치에게 물어봐요.";
const MOODS = [
  "calm",
  "happy",
  "grateful",
  "excited",
  "proud",
  "relaxed",
  "focused",
  "hopeful",
  "refreshed",
  "tired",
  "sleepy",
  "busy",
  "stressed",
  "worried",
  "sad",
  "lonely"
];
const QUICK_QUESTIONS = [
  "오늘 일기에 어울리는 표현 3개 알려줘.",
  "내 감정을 자연스럽게 쓰는 문장을 알려줘.",
  "마무리 문장을 어떻게 쓰면 좋을까?",
  "이 일기 문장을 조금 더 자연스럽게 만들고 싶어."
];
const DEFAULT_EMOTION = "다음에는 그때 기분이 어떻게 바뀌었는지 한 문장 더 붙여 보세요.";
const DEFAULT_REFLECTION = "마지막에 오늘 일로 무엇을 느꼈는지 짧게 정리해 보세요.";
const DEFAULT_CONNECTION = "Then, after that 같은 표현으로 장면을 이어 보세요.";

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function makeFeedback(overrides: Partial<DiaryFeedback> = {}): DiaryFeedback {
  return {
    schemaVersion: "diary-feedback-v1",
    entryId: "entry-1",
    attemptNo: 1,
    score: 70,
    finishable: true,
    diaryAnswerBand: "DIARY_CLEAR_BASIC",
    summaryKo: "",
    strengths: [],
    fixPoints: [],
    diaryFlow: { timeFlow: "", emotion: "", detail: "", reflection: "", commentKo: "", connectionTips: [] },
    rewriteIdeas: [],
    usedDiaryExpressions: [],
    diaryExpressions: [],
    nextDiaryMission: { focus: "", titleKo: "", instructionKo: "" },
    safetyFlags: [],
    ...overrides
  };
}

function expression(value: string, overrides: Partial<DiaryExpression> = {}): DiaryExpression {
  return { expression: value, meaningKo: "", exampleEn: null, usageTipKo: "", tags: [], ...overrides };
}

// 패널의 모든 칸을 채운 피드백.
const fullFeedback = makeFeedback({
  score: 84,
  diaryAnswerBand: "DIARY_FLOW_THIN",
  summaryKo: "하루의 흐름이 잘 보여요.",
  strengths: ["시간 순서가 분명해요.", "장소를 구체적으로 썼어요.", "감정을 한 번 넣었어요.", "넷째 장점은 안 보여요."],
  fixPoints: [
    {
      kind: "GRAMMAR",
      title: "시제 맞추기",
      originalText: "I go to the park yesterday.",
      revisedText: "I went to the park yesterday.",
      reasonKo: "어제 일이라 과거형을 써요.",
      exampleEn: "I went to the store yesterday."
    },
    { kind: "WORD", title: "", originalText: null, revisedText: "It was really fun.", reasonKo: "느낌을 덧붙여요.", exampleEn: null },
    { kind: "EMPTY", title: "", originalText: "hidden original", revisedText: "hidden revised", reasonKo: "" }
  ],
  diaryFlow: {
    timeFlow: "아침부터 저녁까지 이어져요.",
    emotion: "기분이 좋았어요.",
    detail: "",
    reflection: "마지막에 느낀 점을 한 문장 더 붙여 보세요.",
    commentKo: "흐름 요약 문장",
    connectionTips: ["Then", "After that"]
  },
  usedDiaryExpressions: [
    expression("take a walk", {
      meaningKo: "산책하다",
      exampleEn: "I took a walk after dinner.",
      usageTipKo: "가벼운 운동을 말할 때",
      tags: ["daily"]
    })
  ],
  diaryExpressions: [
    expression("Take a  Walk", { meaningKo: "중복이라 안 보여요" }),
    expression("feel refreshed", { meaningKo: "상쾌하다" }),
    expression("")
  ],
  rewriteIdeas: [
    { title: "저녁", meaningKo: "저녁 이야기 더하기", noteKo: "저녁에 한 일을 붙여요.", exampleEn: "In the evening, I read a book." },
    { title: "제목만 있는 아이디어", meaningKo: null, noteKo: "", exampleEn: null },
    { title: "", meaningKo: "", noteKo: "", exampleEn: "" }
  ],
  nextDiaryMission: {
    focus: "EMOTION",
    titleKo: "감정 미션",
    instructionKo: "기분이 바뀐 순간을 한 문장 더 써 보세요.",
    starterEn: "At first, I felt ..."
  }
});

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    entryId: "entry-1",
    title: "Rainy Tuesday",
    content: "I walked in the rain.",
    language: "en",
    entryDate: "2026-11-03",
    mood: null,
    tags: ["calm", "happy"],
    draft: true,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-03T00:00:00.000Z",
    attempts: [],
    ...overrides
  };
}

function attempt(diaryText: string, feedback: DiaryFeedback | null, attemptNo = 1) {
  return { id: attemptNo, attemptNo, diaryText, score: feedback?.score ?? 0, feedback, createdAt: "2026-11-03T00:00:00.000Z" };
}

// 피드백을 받은 임시 저장 일기: 마지막 시도의 본문이 다시 써보기 칸에 들어간다.
function feedbackEntry(feedback: DiaryFeedback = fullFeedback, overrides: Partial<DiaryEntry> = {}) {
  return makeEntry({
    attempts: [attempt("First try text.", makeFeedback({ score: 10 }), 1), attempt("I walked in the rain today.", feedback, 2)],
    ...overrides
  });
}

function draft(overrides: Partial<DiaryDraft> = {}): DiaryDraft {
  return {
    entryId: "",
    entryDate: "2026-11-10",
    title: "Draft title",
    moodTags: ["tired"],
    content: "I was writing this before.",
    rewriteText: "Rewrite in progress.",
    step: "write",
    updatedAt: "2026-11-11T00:00:00.000Z",
    ...overrides
  };
}

function savedExpression(id: number, value: string): SavedExpression {
  return {
    id,
    expression: value,
    sourceType: "DIARY_EXPRESSION",
    saveCount: 1,
    lastSavedAt: "2026-11-01T00:00:00Z",
    createdAt: "2026-11-01T00:00:00Z"
  };
}

const coachHelp: CoachHelpResponse = {
  promptId: "diary-free-writing",
  userQuestion: "How do I say it?",
  coachReply: "이렇게 써 보세요.",
  expressions: [
    {
      id: "c1",
      expression: "feel relieved",
      meaningKo: "안도하다",
      usageTip: "걱정이 끝났을 때",
      example: "I felt relieved after the test.",
      tags: ["emotion"]
    },
    {
      id: "c2",
      expression: "Call it a day",
      meaningKo: "하루를 마치다",
      usageTip: "일을 끝낼 때",
      example: "Let's call it a day.",
      tags: null
    }
  ]
};

// ---------- 도우미 ----------

type AlertButton = { text: string; style?: string; onPress?: () => void };

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
const appStateListeners: ((state: AppStateStatus) => void)[] = [];
const appStateRemove = jest.fn();
const scrollViewScrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;
const textInputFocus = (TextInput as unknown as { prototype: { focus: jest.Mock } }).prototype.focus;

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
  for (let index = 0; index < 12; index += 1) {
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

async function renderNew() {
  await render(<DiaryEntryScreen />);
  await flushAsync();
}

async function renderExisting(entry: DiaryEntry | null = makeEntry(), entryId = "entry-1") {
  if (entry !== undefined) {
    jest.mocked(getDiaryEntry).mockResolvedValue(entry);
  }
  await render(<DiaryEntryScreen initialEntryId={entryId} />);
  await flushAsync();
}

// 피드백 단계(피드백을 받은 임시 저장 일기)를 그린다.
async function renderFeedbackStep(feedback: DiaryFeedback = fullFeedback, overrides: Partial<DiaryEntry> = {}) {
  await renderExisting(feedbackEntry(feedback, overrides));
  expect(screen.getByText("일기쓰기 완료")).toBeOnTheScreen();
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function spinners(root: TestInstance = screen.root!) {
  return findHost(root, "ActivityIndicator");
}

function modalHosts() {
  return findHost(screen.root!, "Modal");
}

function openModal() {
  const modals = modalHosts();
  expect(modals).toHaveLength(1);
  return modals[0];
}

function textInputs() {
  return findHost(screen.root!, "TextInput");
}

function dateInput() {
  return screen.getByPlaceholderText(DATE_PLACEHOLDER);
}

// 편집 화면의 입력 칸 순서: 날짜, 제목, 본문(코치 창이 열려 있으면 그 뒤에 질문 칸).
function titleInput() {
  return textInputs()[1];
}

function bodyInput() {
  return textInputs()[2];
}

function coachInput() {
  return screen.getByPlaceholderText(COACH_PLACEHOLDER);
}

function styleOf(node: TestInstance) {
  return StyleSheet.flatten(node.props.style);
}

function lastAlert() {
  const call = alertSpy.mock.calls.at(-1) as [string, string, AlertButton[] | undefined, object | undefined];
  return { title: call[0], message: call[1], buttons: call[2], options: call[3] };
}

async function pressAlertButton(text: string) {
  const button = lastAlert().buttons!.find((item) => item.text === text)!;
  await act(async () => {
    button.onPress?.();
  });
  await flushAsync();
}

async function pressText(text: string) {
  await fireEvent.press(screen.getByText(text));
  await flushAsync();
}

async function pressButton(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flushAsync();
}

async function typeInto(input: TestInstance, value: string) {
  await fireEvent.changeText(input, value);
  await flushAsync();
}

async function emitAppState(state: AppStateStatus) {
  await act(async () => {
    appStateListeners.forEach((listener) => listener(state));
  });
  await flushAsync();
}

async function openCoach() {
  await pressButton("AI 코치 열기");
  openModal();
}

// 코치 창에서 질문을 적고 물어본다.
async function askCoach(question: string) {
  await typeInto(coachInput(), question);
  await pressText("코치에게 물어보기");
}

function moodChipStyles(tag: string) {
  const text = screen.getByText(tag);
  return { chip: styleOf(text.parent!), text: styleOf(text) };
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
  "collapsable",
  "color",
  "contentContainerStyle",
  "edges",
  "keyboardShouldPersistTaps",
  "multiline",
  "name",
  "placeholder",
  "placeholderTextColor",
  "pointerEvents",
  "showsVerticalScrollIndicator",
  "size",
  "source",
  "style",
  "textAlignVertical",
  "tintColor",
  "type",
  "value",
  "visible",
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

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  appStateListeners.length = 0;
  appStateRemove.mockReset();
  jest.mocked(AppState.addEventListener).mockReset().mockImplementation(((
    _type: string,
    listener: (state: AppStateStatus) => void
  ) => {
    appStateListeners.push(listener);
    return { remove: appStateRemove };
  }) as unknown as typeof AppState.addEventListener);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getDiaryEntry).mockReset().mockResolvedValue(makeEntry());
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(createDiaryEntry).mockReset().mockResolvedValue(makeEntry({ entryId: "entry-new" }));
  jest.mocked(updateDiaryEntry).mockImplementation(async (entryId) => makeEntry({ entryId }));
  jest.mocked(updateDiaryEntry).mockClear();
  jest.mocked(deleteDiaryEntry).mockReset().mockResolvedValue(undefined);
  jest.mocked(requestDiaryFeedback).mockReset().mockResolvedValue(fullFeedback);
  jest.mocked(requestCoachHelp).mockReset().mockResolvedValue(coachHelp);
  jest.mocked(saveExpression).mockReset().mockImplementation(async (request) => savedExpression(90, request.expression));
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  jest.mocked(getDiaryDraft).mockReset().mockResolvedValue(null);
  jest.mocked(saveDiaryDraft).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteDiaryDraft).mockReset().mockResolvedValue(undefined);
  scrollViewScrollTo.mockClear();
  textInputFocus.mockClear();
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 진입 ----------

describe("[spec] 진입", () => {
  it("[spec] 세션을 확인하는 동안에는 불러오는 중 표시만 보이고, 새 일기의 임시본 확인은 그래도 돈다", async () => {
    setSessionUser(null, true);
    await renderNew();

    const indicators = spinners();
    expect(indicators).toHaveLength(1);
    expect(indicators[0].props.color).toBe("#E38B12");
    expect(screen.queryByText("영어일기")).toBeNull();
    expect(screen.queryByText("로그인이 필요해요")).toBeNull();
    expect(getDiaryDraft).toHaveBeenCalledTimes(1);
    expect(getDiaryDraft).toHaveBeenCalledWith("");
    expect(getSavedExpressions).not.toHaveBeenCalled();
  });

  it("[spec] 기존 일기를 불러오는 동안에는 불러오는 중 표시만 보인다", async () => {
    jest.mocked(getDiaryEntry).mockReturnValue(new Promise(() => undefined));
    await render(<DiaryEntryScreen initialEntryId="entry-1" />);
    await flushAsync();

    expect(getDiaryEntry).toHaveBeenCalledTimes(1);
    expect(getDiaryEntry).toHaveBeenCalledWith("entry-1");
    const indicators = spinners();
    expect(indicators).toHaveLength(1);
    expect(indicators[0].props.color).toBe("#E38B12");
    expect(screen.queryByText("영어일기")).toBeNull();
    expect(getDiaryDraft).not.toHaveBeenCalled();
  });

  it("[spec] 로그인 전이면 로그인 안내를 보이고, 버튼은 일기 쓰기로 돌아오는 로그인 화면으로 보낸다", async () => {
    setSessionUser(null);
    await renderNew();

    expect(screen.getByText("로그인이 필요해요")).toBeOnTheScreen();
    expect(
      screen.getByText("영어일기는 계정에 저장되는 개인 기록이라 로그인 후 사용할 수 있어요.")
    ).toBeOnTheScreen();
    expect(screen.queryByText("영어일기")).toBeNull();
    expect(getSavedExpressions).not.toHaveBeenCalled();

    await pressText("로그인하고 일기 쓰기");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/login?redirectTo=%2Fdiary%2Fwrite");
  });

  it("[spec] 기존 일기도 로그인 전이면 같은 안내와 같은 돌아올 주소(/diary/write)를 쓰고, 일기는 불러 둔다", async () => {
    setSessionUser(null);
    await renderExisting();

    expect(getDiaryEntry).toHaveBeenCalledWith("entry-1");
    await pressText("로그인하고 일기 쓰기");
    expect(router.push).toHaveBeenCalledWith("/login?redirectTo=%2Fdiary%2Fwrite");
  });

  it("[spec] 로그인되면 같은 화면에서 저장된 표현을 부르지만 일기를 다시 불러오지는 않는다", async () => {
    setSessionUser(null);
    await renderExisting();
    expect(getSavedExpressions).not.toHaveBeenCalled();

    setSessionUser(signedInUser);
    await screen.rerender(<DiaryEntryScreen initialEntryId="entry-1" />);
    await flushAsync();

    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(getDiaryEntry).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue("I walked in the rain.")).toBeOnTheScreen();
  });

  it("[spec] 처음 그릴 때 불러오기(일기·임시본)를 저장된 표현보다 먼저 부르고, AppState 듣기를 한 번 건다", async () => {
    await renderExisting(makeEntry());

    expect(jest.mocked(getDiaryEntry).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(getSavedExpressions).mock.invocationCallOrder[0]
    );
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    expect(jest.mocked(AppState.addEventListener).mock.calls[0][0]).toBe("change");
  });

  it("[spec] 새 일기는 임시본 확인을 저장된 표현보다 먼저 부른다", async () => {
    await renderNew();

    expect(jest.mocked(getDiaryDraft).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(getSavedExpressions).mock.invocationCallOrder[0]
    );
  });
});

// ---------- 새 일기 ----------

describe("[spec] 새 일기", () => {
  it("[spec] 오늘 날짜와 기본 제목, 빈 본문의 편집 화면을 그린다", async () => {
    await renderNew();

    expect(getDiaryEntry).not.toHaveBeenCalled();
    expect(getDiaryDraft).toHaveBeenCalledWith("");
    expect(screen.getByRole("button", { name: "홈으로 이동" })).toBeOnTheScreen();
    expect(screen.getByText("영어일기")).toBeOnTheScreen();
    expect(screen.getByText("오늘을 영어로 남겨보세요.")).toBeOnTheScreen();
    expect(screen.getByText("짧게 써도 괜찮아요. AI가 자연스럽게 다듬어 줄게요.")).toBeOnTheScreen();
    expect(screen.getByText("날짜")).toBeOnTheScreen();
    expect(screen.getByText("제목")).toBeOnTheScreen();
    expect(screen.getByText("기분 태그")).toBeOnTheScreen();
    expect(dateInput().props.value).toBe(TODAY);
    expect(titleInput().props.value).toBe(TODAY_TITLE);
    expect(titleInput().props.placeholder).toBe(TODAY_TITLE);
    expect(screen.getByText("오늘의 영어일기")).toBeOnTheScreen();
    expect(bodyInput().props.value).toBe("");
    expect(bodyInput().props.placeholder).toBe(WRITE_PLACEHOLDER);
    expect(screen.getByText("0단어")).toBeOnTheScreen();
    expect(screen.getByText("임시저장")).toBeOnTheScreen();
    expect(screen.getByText("AI 피드백 받기")).toBeDisabled();
    expect(screen.queryByText("일기 삭제")).toBeNull();
    expect(screen.queryByText("일기쓰기 완료")).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("[spec] 기분 칩 16개를 정해진 순서로 보인다", async () => {
    await renderNew();

    const moodLabels = MOODS.map((tag) => screen.getByText(tag));
    expect(moodLabels).toHaveLength(16);
    const row = moodLabels[0].parent!.parent!;
    expect(row.children.map((chip) => ((chip as TestInstance).children[0] as TestInstance).children[0])).toEqual(MOODS);
  });

  it("[spec] 머리의 뒤로 버튼은 홈으로 바꿔 보낸다", async () => {
    await renderNew();
    await pressButton("홈으로 이동");

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("[spec] 이 기기에 다른 임시본이 있으면 이어 쓸지 묻는다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(draft());
    await renderNew();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      "저장하지 않은 일기가 있어요",
      "이 기기에 임시 저장된 내용을 이어서 쓸까요?",
      [
        { text: "버리기", style: "destructive", onPress: expect.any(Function) },
        { text: "이어서 쓰기", onPress: expect.any(Function) }
      ],
      { cancelable: false }
    );
    // 답하기 전에는 화면이 그대로다.
    expect(dateInput().props.value).toBe(TODAY);
  });

  it("[spec] 이어서 쓰기를 누르면 임시본의 날짜·제목·기분·본문을 채우고, 새 일기는 다시 써보기 단계로 가지 않는다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(draft({ step: "rewrite" }));
    await renderNew();
    await pressAlertButton("이어서 쓰기");

    expect(dateInput().props.value).toBe("2026-11-10");
    expect(titleInput().props.value).toBe("Draft title");
    expect(bodyInput().props.value).toBe("I was writing this before.");
    expect(screen.getByText("오늘의 영어일기")).toBeOnTheScreen();
    expect(screen.getByText("5단어")).toBeOnTheScreen();
    expect(moodChipStyles("tired").chip).toMatchObject({ borderColor: "#F3A13E", backgroundColor: "#FFF0D7" });
    expect(screen.getByText("AI 피드백 받기")).toBeEnabled();
    expect(deleteDiaryDraft).not.toHaveBeenCalled();
  });

  it("[spec] 버리기를 누르면 임시본을 지우고 화면은 그대로다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(draft());
    await renderNew();
    await pressAlertButton("버리기");

    expect(deleteDiaryDraft).toHaveBeenCalledTimes(1);
    expect(deleteDiaryDraft).toHaveBeenCalledWith("");
    expect(dateInput().props.value).toBe(TODAY);
    expect(titleInput().props.value).toBe(TODAY_TITLE);
    expect(bodyInput().props.value).toBe("");
  });

  it("[spec] 임시본이 지금 상태와 같으면 묻지 않고 조용히 지운다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(
      draft({ entryDate: TODAY, title: TODAY_TITLE, moodTags: [], content: "", rewriteText: "", step: "rewrite" })
    );
    await renderNew();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(deleteDiaryDraft).toHaveBeenCalledTimes(1);
    expect(deleteDiaryDraft).toHaveBeenCalledWith("");
  });

  it("[spec] 임시본을 읽다 실패하면 없는 것으로 보고 묻지 않는다", async () => {
    jest.mocked(getDiaryDraft).mockRejectedValue(new Error("저장소 오류"));
    await renderNew();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(deleteDiaryDraft).not.toHaveBeenCalled();
    expect(dateInput().props.value).toBe(TODAY);
  });
});

// ---------- 기존 일기 ----------

describe("[spec] 기존 일기", () => {
  // 작업 049(APP-ETC-102) 사용자 결정(049-03)으로 새 동작대로 고쳤다. 옛 단언(오늘 날짜의 편집 화면, 뒤로 버튼,
  // 삭제 버튼이 보인다)을 "편집 화면 대신 불러오기 실패 화면(오류 문구·다시 시도·일기 목록으로)"으로 바꿨다.
  it("[spec] 일기가 없으면 편집 화면 대신 '일기를 찾을 수 없어요.'와 '다시 시도'·'일기 목록으로'의 실패 화면을 보이고 임시본은 보지 않는다", async () => {
    await renderExisting(null);

    expect(screen.getByText("일기를 찾을 수 없어요.")).toBeOnTheScreen();
    expect(screen.getByText("다시 시도")).toBeOnTheScreen();
    expect(screen.getByText("일기 목록으로")).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText(DATE_PLACEHOLDER)).toBeNull();
    expect(screen.queryByDisplayValue(TODAY)).toBeNull();
    expect(screen.queryByDisplayValue(TODAY_TITLE)).toBeNull();
    expect(textInputs()).toHaveLength(0);
    expect(screen.queryByText("<")).toBeNull();
    expect(screen.queryByText("영어일기")).toBeNull();
    expect(screen.queryByText("임시저장")).toBeNull();
    expect(screen.queryByText("AI 피드백 받기")).toBeNull();
    expect(screen.queryByRole("button", { name: "일기 삭제" })).toBeNull();
    expect(screen.queryByText("일기 삭제")).toBeNull();
    expect(screen.queryByRole("button", { name: "AI 코치 열기" })).toBeNull();
    expect(getDiaryDraft).not.toHaveBeenCalled();
    expect(screen.queryByText("문제가 반복되나요? 문제 보내기")).toBeNull();
  });

  it("[spec] 불러오기가 실패하면 오류 메시지를, 메시지가 없으면 '일기를 불러오지 못했어요.'를 보인다", async () => {
    jest.mocked(getDiaryEntry).mockRejectedValue(new Error("일기 서버 오류"));
    await render(<DiaryEntryScreen initialEntryId="entry-1" />);
    await flushAsync();
    expect(screen.getByText("일기 서버 오류")).toBeOnTheScreen();
    expect(getDiaryDraft).not.toHaveBeenCalled();

    await screen.unmount();
    jest.mocked(getDiaryEntry).mockRejectedValue("문자열 오류");
    await render(<DiaryEntryScreen initialEntryId="entry-2" />);
    await flushAsync();
    expect(screen.getByText("일기를 불러오지 못했어요.")).toBeOnTheScreen();
  });

  it("[spec] 완료된 일기는 읽기 전용 화면으로 보이고 임시본은 보지 않는다", async () => {
    await renderExisting(makeEntry({ draft: false, content: "I walked in the rain with my dog." }));

    expect(screen.getByText("영어일기")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "영어일기 기록으로 이동" })).toBeOnTheScreen();
    expect(screen.getByText("완료된 일기")).toBeOnTheScreen();
    expect(screen.getByText("2026-11-03")).toBeOnTheScreen();
    expect(screen.getByText("Rainy Tuesday")).toBeOnTheScreen();
    expect(screen.getByText("calm")).toBeOnTheScreen();
    expect(screen.getByText("happy")).toBeOnTheScreen();
    expect(screen.queryByText("tired")).toBeNull();
    expect(screen.getByText("오늘의 영어일기")).toBeOnTheScreen();
    expect(screen.getByText("I walked in the rain with my dog.")).toBeOnTheScreen();
    expect(screen.getByText("8단어")).toBeOnTheScreen();
    expect(screen.getByText("작성 완료")).toBeOnTheScreen();
    expect(screen.queryByText("피드백 보기")).toBeNull();
    expect(textInputs()).toHaveLength(0);
    expect(screen.queryByText("AI 피드백 받기")).toBeNull();
    expect(screen.queryByRole("button", { name: "AI 코치 열기" })).toBeNull();
    expect(getDiaryDraft).not.toHaveBeenCalled();
  });

  it("[spec] 읽기 전용 화면의 뒤로 버튼은 기록으로 바꿔 보낸다", async () => {
    await renderExisting(makeEntry({ draft: false }));
    await pressButton("영어일기 기록으로 이동");

    expect(router.replace).toHaveBeenCalledWith("/diary");
  });

  it("[spec] 제목이 비면 날짜로 만든 기본 제목을, 날짜도 없으면 오늘 날짜를 쓴다", async () => {
    await renderExisting(makeEntry({ draft: false, title: "" }));
    expect(screen.getByText("2026년 11월 3일의 일기")).toBeOnTheScreen();

    await screen.unmount();
    await renderExisting(makeEntry({ draft: false, title: null, entryDate: null }), "entry-2");
    expect(screen.getByText(TODAY)).toBeOnTheScreen();
    expect(screen.getByText(TODAY_TITLE)).toBeOnTheScreen();
  });

  it("[spec] 기분은 태그를 다듬어 겹치지 않게 쓰고, 태그가 없으면 mood 값을 쓴다", async () => {
    await renderExisting(makeEntry({ draft: false, tags: [" calm ", "calm", "", "sad"], mood: "happy" }));
    expect(screen.getAllByText("calm")).toHaveLength(1);
    expect(screen.getByText("sad")).toBeOnTheScreen();
    expect(screen.queryByText("happy")).toBeNull();

    await screen.unmount();
    await renderExisting(makeEntry({ draft: false, tags: [], mood: " proud " }), "entry-2");
    expect(screen.getByText("proud")).toBeOnTheScreen();

    await screen.unmount();
    await renderExisting(makeEntry({ draft: false, tags: [], mood: null }), "entry-3");
    expect(screen.queryByText("proud")).toBeNull();
    expect(screen.queryByText("calm")).toBeNull();
  });

  it("[spec] 임시 저장된 일기(피드백 없음)는 불러온 내용의 편집 화면이고 그 일기의 임시본을 확인한다", async () => {
    await renderExisting(makeEntry({ tags: ["calm", "happy"] }));

    expect(getDiaryDraft).toHaveBeenCalledTimes(1);
    expect(getDiaryDraft).toHaveBeenCalledWith("entry-1");
    expect(screen.getByRole("button", { name: "영어일기 기록으로 이동" })).toBeOnTheScreen();
    expect(dateInput().props.value).toBe("2026-11-03");
    expect(titleInput().props.value).toBe("Rainy Tuesday");
    expect(titleInput().props.placeholder).toBe("2026년 11월 3일의 일기");
    expect(bodyInput().props.value).toBe("I walked in the rain.");
    expect(screen.getByText("5단어")).toBeOnTheScreen();
    expect(moodChipStyles("calm").chip).toMatchObject({ backgroundColor: "#FFF0D7" });
    expect(moodChipStyles("happy").chip).toMatchObject({ backgroundColor: "#FFF0D7" });
    expect(moodChipStyles("tired").chip).toMatchObject({ backgroundColor: "#FFF9F2" });
    expect(screen.getByText("임시저장")).toBeOnTheScreen();
    expect(screen.getByText("AI 피드백 받기")).toBeEnabled();
    expect(screen.getByRole("button", { name: "일기 삭제" })).toBeOnTheScreen();
    expect(screen.queryByText("완료된 일기")).toBeNull();
  });

  it("[spec] 편집 화면의 뒤로 버튼은 기록으로 바꿔 보낸다", async () => {
    await renderExisting(makeEntry());
    await pressButton("영어일기 기록으로 이동");

    expect(router.replace).toHaveBeenCalledWith("/diary");
  });

  it("[spec] 피드백이 있는 임시 저장 일기는 마지막 시도의 피드백 단계로 연다", async () => {
    await renderFeedbackStep();

    expect(screen.getByText("일기의 흐름을 더 살릴 수 있어요")).toBeOnTheScreen();
    expect(screen.getByText("84")).toBeOnTheScreen();
    expect(screen.getByText("일기쓰기 완료")).toBeEnabled();
    expect(screen.getByText("다시 써보기")).toBeOnTheScreen();
    expect(screen.getByText("새 일기")).toBeOnTheScreen();
    expect(screen.queryByText("AI 피드백 받기")).toBeNull();
    expect(screen.getByText("오늘의 영어일기")).toBeOnTheScreen();
    expect(bodyInput().props.value).toBe("I walked in the rain.");
    expect(screen.getByText("임시저장")).toBeOnTheScreen();
    expect(getDiaryDraft).toHaveBeenCalledWith("entry-1");
  });

  it("[spec] 피드백이 있는 일기의 임시본(다시 써보기)을 이어 쓰면 다시 써보기 단계로 연다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(draft({ entryId: "entry-1", step: "rewrite" }));
    await renderExisting(feedbackEntry());
    await pressAlertButton("이어서 쓰기");

    expect(screen.getByText("다시 써보기")).toBeOnTheScreen();
    expect(screen.queryByText("오늘의 영어일기")).toBeNull();
    expect(bodyInput().props.value).toBe("Rewrite in progress.");
    expect(bodyInput().props.placeholder).toBe(REWRITE_PLACEHOLDER);
    expect(screen.getByText("3단어")).toBeOnTheScreen();
    expect(screen.queryByText("임시저장")).toBeNull();
    expect(screen.getByText("다시 쓴 일기 피드백 받기")).toBeEnabled();
    expect(screen.queryByText("일기쓰기 완료")).toBeNull();
    // 피드백 패널은 그대로 보인다.
    expect(screen.getByText("일기의 흐름을 더 살릴 수 있어요")).toBeOnTheScreen();
  });

  it("[spec] 피드백이 있는 일기의 임시본이 write 단계면 이어 써도 쓰기 단계다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(draft({ entryId: "entry-1", step: "write" }));
    await renderExisting(feedbackEntry());
    await pressAlertButton("이어서 쓰기");

    expect(screen.getByText("오늘의 영어일기")).toBeOnTheScreen();
    expect(bodyInput().props.value).toBe("I was writing this before.");
    expect(screen.getByText("AI 피드백 받기")).toBeEnabled();
  });

  it("[spec] 기존 일기의 임시본이 서버 상태(다시 써보기 칸은 마지막 시도 본문)와 같으면 조용히 지운다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(
      draft({
        entryId: "entry-1",
        entryDate: "2026-11-03",
        title: "Rainy Tuesday",
        moodTags: ["calm", "happy"],
        content: "I walked in the rain.",
        rewriteText: "I walked in the rain today."
      })
    );
    await renderExisting(feedbackEntry());

    expect(alertSpy).not.toHaveBeenCalled();
    expect(deleteDiaryDraft).toHaveBeenCalledWith("entry-1");
  });
});

// ---------- 편집 화면 ----------

describe("[spec] 편집 화면", () => {
  it("[spec] 제목이 기본 제목이면 날짜를 바꿀 때 제목도 따라 바뀌고, 고친 제목은 그대로 둔다", async () => {
    await renderNew();

    await typeInto(dateInput(), "2026-11-10");
    expect(dateInput().props.value).toBe("2026-11-10");
    expect(titleInput().props.value).toBe("2026년 11월 10일의 일기");
    expect(titleInput().props.placeholder).toBe("2026년 11월 10일의 일기");

    await typeInto(titleInput(), "My day");
    await typeInto(dateInput(), "2026-11-09");
    expect(titleInput().props.value).toBe("My day");
    expect(titleInput().props.placeholder).toBe("2026년 11월 9일의 일기");

    await typeInto(titleInput(), "  ");
    await typeInto(dateInput(), "2026/11/08");
    expect(titleInput().props.value).toBe("2026/11/08의 일기");
  });

  it("[spec] 날짜 칸을 비우면 기본 제목이 오늘 날짜 문구가 된다", async () => {
    await renderNew();
    await typeInto(dateInput(), "");

    expect(titleInput().props.value).toBe(`${TODAY}의 일기`);
  });

  it("[spec] 기분 칩을 누르면 골라지고 다시 누르면 풀린다", async () => {
    await renderNew();
    expect(moodChipStyles("happy")).toEqual({
      chip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#E4D3BE",
        backgroundColor: "#FFF9F2",
        paddingHorizontal: 13,
        paddingVertical: 8
      },
      text: { fontSize: 13, fontWeight: "800", color: "#7D6A55" }
    });

    await pressText("happy");
    expect(moodChipStyles("happy").chip).toMatchObject({ borderColor: "#F3A13E", backgroundColor: "#FFF0D7" });
    expect(moodChipStyles("happy").text).toMatchObject({ color: "#A15F10" });

    await pressText("happy");
    expect(moodChipStyles("happy").chip).toMatchObject({ borderColor: "#E4D3BE", backgroundColor: "#FFF9F2" });
  });

  it("[spec] 본문을 쓰면 단어 수가 바뀌고 피드백 버튼이 풀린다(공백만이면 막힘)", async () => {
    await renderNew();

    await typeInto(bodyInput(), "   ");
    expect(screen.getByText("0단어")).toBeOnTheScreen();
    expect(screen.getByText("AI 피드백 받기")).toBeDisabled();

    await typeInto(bodyInput(), "  I went\nto   the park  ");
    expect(screen.getByText("5단어")).toBeOnTheScreen();
    expect(screen.getByText("AI 피드백 받기")).toBeEnabled();
  });

  it("[spec] 새 일기 임시저장은 일기를 만들고(draft: true), 새 일기 임시본과 새 id의 임시본을 지우고 알린다", async () => {
    await renderNew();
    await pressText("happy");
    await pressText("calm");
    await typeInto(titleInput(), "   ");
    await typeInto(bodyInput(), "  I went home.  ");
    await pressText("임시저장");

    expect(createDiaryEntry).toHaveBeenCalledTimes(1);
    expect(jest.mocked(createDiaryEntry).mock.calls[0][0]).toEqual({
      title: TODAY_TITLE,
      content: "  I went home.  ",
      language: "en",
      entryDate: TODAY,
      mood: "happy",
      tags: ["happy", "calm"],
      draft: true
    });
    expect(updateDiaryEntry).not.toHaveBeenCalled();
    expect(jest.mocked(deleteDiaryDraft).mock.calls).toEqual([[""], ["entry-new"]]);
    expect(alertSpy).toHaveBeenCalledWith("저장됐어요", "영어일기 초안을 저장했어요.");
    expect(screen.getByText("임시저장")).toBeOnTheScreen();
    // 새 일기 화면이라 저장한 뒤에도 삭제 버튼은 없다.
    expect(screen.queryByText("일기 삭제")).toBeNull();

    // 두 번째 저장은 만든 일기를 고친다.
    await pressText("임시저장");
    expect(createDiaryEntry).toHaveBeenCalledTimes(1);
    expect(updateDiaryEntry).toHaveBeenCalledTimes(1);
    expect(jest.mocked(updateDiaryEntry).mock.calls[0][0]).toBe("entry-new");
  });

  it("[spec] 빈 본문도 임시저장하고, 기분이 없으면 mood는 빈 문자열이다", async () => {
    await renderNew();
    await pressText("임시저장");

    expect(jest.mocked(createDiaryEntry).mock.calls[0][0]).toEqual({
      title: TODAY_TITLE,
      content: "",
      language: "en",
      entryDate: TODAY,
      mood: "",
      tags: [],
      draft: true
    });
  });

  it("[spec] 기존 일기 임시저장은 그 일기를 고친다", async () => {
    await renderExisting(makeEntry());
    await typeInto(titleInput(), "  New title ");
    await pressText("임시저장");

    expect(createDiaryEntry).not.toHaveBeenCalled();
    expect(updateDiaryEntry).toHaveBeenCalledTimes(1);
    expect(updateDiaryEntry).toHaveBeenCalledWith("entry-1", {
      title: "New title",
      content: "I walked in the rain.",
      language: "en",
      entryDate: "2026-11-03",
      mood: "calm",
      tags: ["calm", "happy"],
      draft: true
    });
    expect(deleteDiaryDraft).toHaveBeenCalledWith("entry-1");
    expect(alertSpy).toHaveBeenCalledWith("저장됐어요", "영어일기 초안을 저장했어요.");
  });

  it("[spec] 저장하는 동안 버튼은 '저장 중'으로 막히고 피드백 버튼도 막힌다", async () => {
    const pending = deferred<DiaryEntry>();
    jest.mocked(createDiaryEntry).mockReturnValue(pending.promise);
    await renderNew();
    await typeInto(bodyInput(), "I went home.");
    await pressText("임시저장");

    expect(screen.getByText("저장 중")).toBeDisabled();
    expect(screen.queryByText("임시저장")).toBeNull();
    expect(screen.getByText("AI 피드백 받기")).toBeDisabled();

    await act(async () => {
      pending.resolve(makeEntry({ entryId: "entry-new" }));
    });
    await flushAsync();
    expect(screen.getByText("임시저장")).toBeEnabled();
    expect(screen.getByText("AI 피드백 받기")).toBeEnabled();
  });

  it("[spec] 임시저장이 실패하면 오류 줄과 '저장 실패' 창을 보인다(메시지가 없으면 기본 문구)", async () => {
    jest.mocked(createDiaryEntry).mockRejectedValueOnce(new Error("저장 서버 오류"));
    await renderNew();
    await pressText("임시저장");

    expect(screen.getByText("저장 서버 오류")).toBeOnTheScreen();
    expect(alertSpy).toHaveBeenCalledWith("저장 실패", "저장 서버 오류");
    expect(deleteDiaryDraft).not.toHaveBeenCalled();
    expect(screen.getByText("임시저장")).toBeEnabled();
    expect(screen.queryByText("문제가 반복되나요? 문제 보내기")).toBeNull();

    jest.mocked(createDiaryEntry).mockRejectedValueOnce("문자열 오류");
    await pressText("임시저장");
    expect(screen.getByText("일기를 저장하지 못했어요.")).toBeOnTheScreen();
    expect(alertSpy).toHaveBeenLastCalledWith("저장 실패", "일기를 저장하지 못했어요.");
  });
});

// ---------- 피드백 요청 ----------

describe("[spec] 피드백 요청", () => {
  it("[spec] 저장한 뒤 다듬은 본문으로 피드백을 요청하고, 성공하면 피드백 단계로 간다", async () => {
    await renderNew();
    await typeInto(bodyInput(), "  I went to the park.  ");
    await pressText("AI 피드백 받기");

    expect(createDiaryEntry).toHaveBeenCalledTimes(1);
    expect(jest.mocked(createDiaryEntry).mock.calls[0][0]).toEqual({
      title: TODAY_TITLE,
      content: "I went to the park.",
      language: "en",
      entryDate: TODAY,
      mood: "",
      tags: [],
      draft: true
    });
    expect(requestDiaryFeedback).toHaveBeenCalledTimes(1);
    expect(requestDiaryFeedback).toHaveBeenCalledWith("entry-new", {
      bodyText: "I went to the park.",
      attemptType: "INITIAL"
    });
    expect(jest.mocked(createDiaryEntry).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(requestDiaryFeedback).mock.invocationCallOrder[0]
    );
    expect(bodyInput().props.value).toBe("I went to the park.");
    expect(screen.getByText("일기의 흐름을 더 살릴 수 있어요")).toBeOnTheScreen();
    expect(screen.getByText("일기쓰기 완료")).toBeOnTheScreen();
    expect(screen.queryByText("AI 피드백 받기")).toBeNull();
    expect(jest.mocked(deleteDiaryDraft).mock.calls).toEqual([[""], ["entry-new"]]);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(OVERLAY_NAME)).toBeNull();
  });

  it("[spec] 피드백을 기다리는 동안 기다림 화면을 보이고 버튼을 막는다", async () => {
    const pending = deferred<DiaryFeedback>();
    jest.mocked(requestDiaryFeedback).mockReturnValue(pending.promise);
    await renderNew();
    await typeInto(bodyInput(), "I went to the park.");
    await pressText("AI 피드백 받기");

    const overlay = screen.getByLabelText(OVERLAY_NAME);
    expect(overlay.props.accessibilityRole).toBe("progressbar");
    expect(overlay.props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByText("영어일기를 읽고 있어요")).toBeOnTheScreen();
    expect(screen.getByText("문장 흐름과 자연스러운 표현을 함께 확인할게요.")).toBeOnTheScreen();
    // 기다림 화면이 모달 역할이라 뒤의 버튼은 접근성 트리에서 숨는다.
    expect(screen.queryByText("AI 피드백 받기")).toBeNull();
    expect(screen.getByText("AI 피드백 받기", { includeHiddenElements: true })).toBeDisabled();

    await act(async () => {
      pending.resolve(fullFeedback);
    });
    await flushAsync();
    expect(screen.queryByLabelText(OVERLAY_NAME)).toBeNull();
    expect(screen.getByText("일기쓰기 완료")).toBeOnTheScreen();
  });

  it("[spec] 피드백 요청이 실패하면 오류 줄과 '피드백 실패' 창을 보이고 쓰기 단계에 남는다", async () => {
    jest.mocked(requestDiaryFeedback).mockRejectedValueOnce(new Error("피드백 서버 오류"));
    await renderNew();
    await typeInto(bodyInput(), "I went to the park.");
    await pressText("AI 피드백 받기");

    expect(screen.getByText("피드백 서버 오류")).toBeOnTheScreen();
    expect(alertSpy).toHaveBeenCalledWith("피드백 실패", "피드백 서버 오류");
    expect(screen.getByText("AI 피드백 받기")).toBeEnabled();
    expect(screen.queryByLabelText(OVERLAY_NAME)).toBeNull();
    // 일기는 만들었지만 새 일기 임시본만 지웠다.
    expect(jest.mocked(deleteDiaryDraft).mock.calls).toEqual([[""]]);

    jest.mocked(requestDiaryFeedback).mockRejectedValueOnce("문자열 오류");
    await pressText("AI 피드백 받기");
    expect(screen.getByText("일기 피드백을 받지 못했어요.")).toBeOnTheScreen();
    expect(alertSpy).toHaveBeenLastCalledWith("피드백 실패", "일기 피드백을 받지 못했어요.");
    // 두 번째는 만든 일기를 고친다.
    expect(updateDiaryEntry).toHaveBeenCalledTimes(1);
    expect(jest.mocked(updateDiaryEntry).mock.calls[0][0]).toBe("entry-new");
  });

  it("[spec] 저장이 실패해도 '피드백 실패'로 알리고 피드백은 요청하지 않는다", async () => {
    jest.mocked(createDiaryEntry).mockRejectedValueOnce(new Error("저장 서버 오류"));
    await renderNew();
    await typeInto(bodyInput(), "I went to the park.");
    await pressText("AI 피드백 받기");

    expect(requestDiaryFeedback).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("피드백 실패", "저장 서버 오류");
  });

  it("[spec] 다시 쓴 일기는 다시 쓴 본문을 저장하고 REWRITE로 요청한 뒤, 그 본문을 일기 본문으로 삼는다", async () => {
    const rewriteFeedback = makeFeedback({ score: 91, diaryAnswerBand: "DIARY_NATURAL_COMPLETE" });
    jest.mocked(requestDiaryFeedback).mockResolvedValue(rewriteFeedback);
    await renderFeedbackStep();
    await pressText("다시 써보기");
    await typeInto(bodyInput(), " I walked in the rain and felt calm. ");
    await pressText("다시 쓴 일기 피드백 받기");

    expect(updateDiaryEntry).toHaveBeenCalledWith("entry-1", {
      title: "Rainy Tuesday",
      content: "I walked in the rain and felt calm.",
      language: "en",
      entryDate: "2026-11-03",
      mood: "calm",
      tags: ["calm", "happy"],
      draft: true
    });
    expect(requestDiaryFeedback).toHaveBeenCalledWith("entry-1", {
      bodyText: "I walked in the rain and felt calm.",
      attemptType: "REWRITE"
    });
    expect(screen.getByText("이미 자연스러운 일기예요")).toBeOnTheScreen();
    expect(screen.getByText("91")).toBeOnTheScreen();
    expect(screen.getByText("오늘의 영어일기")).toBeOnTheScreen();
    expect(bodyInput().props.value).toBe("I walked in the rain and felt calm.");
    expect(screen.getByText("일기쓰기 완료")).toBeOnTheScreen();
    expect(deleteDiaryDraft).toHaveBeenCalledWith("entry-1");
  });
});

// ---------- 피드백 단계 ----------

describe("[spec] 피드백 단계", () => {
  it("[spec] 일기쓰기 완료는 본문을 완료로 저장하고 완료 화면으로 바꿔 보낸다", async () => {
    await renderFeedbackStep();
    await pressText("일기쓰기 완료");

    expect(updateDiaryEntry).toHaveBeenCalledTimes(1);
    expect(updateDiaryEntry).toHaveBeenCalledWith("entry-1", {
      title: "Rainy Tuesday",
      content: "I walked in the rain.",
      language: "en",
      entryDate: "2026-11-03",
      mood: "calm",
      tags: ["calm", "happy"],
      draft: false
    });
    expect(deleteDiaryDraft).toHaveBeenCalledWith("entry-1");
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/diary/complete", params: { entryId: "entry-1" } });
    // 이동은 가짜라 화면에 남는다: 읽기 전용 화면으로 바뀐다.
    expect(screen.getByText("완료된 일기")).toBeOnTheScreen();
    expect(screen.getByText("피드백 보기")).toBeOnTheScreen();
  });

  it("[spec] 완료하는 동안 버튼은 '완료 중'으로 막히고, 다시 써보기·새 일기는 막히지 않는다", async () => {
    const pending = deferred<DiaryEntry>();
    jest.mocked(updateDiaryEntry).mockReturnValueOnce(pending.promise);
    await renderFeedbackStep();
    await pressText("일기쓰기 완료");

    expect(screen.getByText("완료 중")).toBeDisabled();
    expect(screen.getByText("다시 써보기")).toBeEnabled();
    expect(screen.getByText("새 일기")).toBeEnabled();

    await act(async () => {
      pending.resolve(makeEntry());
    });
    await flushAsync();
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/diary/complete", params: { entryId: "entry-1" } });
  });

  it("[spec] 완료가 실패하면 오류 줄과 '완료 실패' 창을 보이고 피드백 단계에 남는다(메시지가 없으면 기본 문구)", async () => {
    jest.mocked(updateDiaryEntry).mockRejectedValueOnce(new Error("완료 서버 오류"));
    await renderFeedbackStep();
    await pressText("일기쓰기 완료");

    expect(screen.getByText("완료 서버 오류")).toBeOnTheScreen();
    expect(alertSpy).toHaveBeenCalledWith("완료 실패", "완료 서버 오류");
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText("일기쓰기 완료")).toBeEnabled();

    jest.mocked(updateDiaryEntry).mockRejectedValueOnce("문자열 오류");
    await pressText("일기쓰기 완료");
    expect(screen.getByText("일기를 완료하지 못했어요.")).toBeOnTheScreen();
    expect(alertSpy).toHaveBeenLastCalledWith("완료 실패", "일기를 완료하지 못했어요.");
  });

  it("[spec] 본문이 비면 다시 써보기 칸의 글로 완료하고, 둘 다 비면 저장 없이 기록으로 보낸다", async () => {
    await renderFeedbackStep(fullFeedback, { content: "" });
    expect(bodyInput().props.value).toBe("");
    await pressText("일기쓰기 완료");
    expect(jest.mocked(updateDiaryEntry).mock.calls[0][1]).toMatchObject({
      content: "I walked in the rain today.",
      draft: false
    });

    await screen.unmount();
    jest.mocked(updateDiaryEntry).mockClear();
    jest.mocked(router.replace).mockReset();
    await renderExisting(makeEntry({ content: "", attempts: [attempt("", fullFeedback)] }), "entry-2");
    await pressText("일기쓰기 완료");
    expect(updateDiaryEntry).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/diary");
  });

  it("[spec] 피드백 단계에서도 본문을 고칠 수 있고, 고친 본문으로 완료한다", async () => {
    await renderFeedbackStep();
    await typeInto(bodyInput(), "Edited after feedback.");
    await pressText("일기쓰기 완료");

    expect(jest.mocked(updateDiaryEntry).mock.calls[0][1]).toMatchObject({ content: "Edited after feedback.", draft: false });
  });

  it("[spec] 다시 써보기는 다시 써보기 단계로 바꾸고, 80ms 뒤 본문 카드 위로 스크롤해 본문 칸에 초점을 둔다", async () => {
    await renderFeedbackStep();
    const editorCard = screen.getByText("오늘의 영어일기").parent!;
    await fireEvent.layout(editorCard, { x: 0, y: 640, width: 300, height: 200 });
    await pressText("다시 써보기");

    expect(screen.queryByText("일기쓰기 완료")).toBeNull();
    expect(screen.getByText("다시 쓴 일기 피드백 받기")).toBeEnabled();
    expect(bodyInput().props.value).toBe("I walked in the rain today.");
    expect(bodyInput().props.placeholder).toBe(REWRITE_PLACEHOLDER);
    expect(screen.queryByText("임시저장")).toBeNull();
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    expect(textInputFocus).not.toHaveBeenCalled();

    await advance(80);
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 624, animated: true });
    expect(textInputFocus).toHaveBeenCalledTimes(1);
    expect((textInputFocus.mock.contexts[0] as { props: { placeholder: string } }).props.placeholder).toBe(
      REWRITE_PLACEHOLDER
    );
  });

  it("[spec] 다시 써보기 칸이 비어 있으면 본문으로 채우고, 본문 카드 위치를 모르면 0으로 스크롤한다", async () => {
    await renderFeedbackStep(fullFeedback, { attempts: [attempt("  ", fullFeedback)], content: "Content text here." });
    await pressText("다시 써보기");
    expect(bodyInput().props.value).toBe("Content text here.");

    await advance(80);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it("[spec] 새 일기는 오늘 날짜의 빈 쓰기 화면으로 되돌리고 새 일기 임시본을 확인한 뒤 /diary/write로 바꾼다", async () => {
    await renderFeedbackStep();
    jest.mocked(getDiaryDraft).mockClear();
    await pressText("새 일기");

    expect(router.replace).toHaveBeenCalledWith("/diary/write");
    expect(getDiaryDraft).toHaveBeenCalledTimes(1);
    expect(getDiaryDraft).toHaveBeenCalledWith("");
    expect(dateInput().props.value).toBe(TODAY);
    expect(titleInput().props.value).toBe(TODAY_TITLE);
    expect(bodyInput().props.value).toBe("");
    expect(moodChipStyles("calm").chip).toMatchObject({ backgroundColor: "#FFF9F2" });
    expect(screen.getByText("오늘의 영어일기")).toBeOnTheScreen();
    expect(screen.getByText("AI 피드백 받기")).toBeDisabled();
    expect(screen.queryByText("일기의 흐름을 더 살릴 수 있어요")).toBeNull();
    expect(screen.queryByText("일기 삭제")).toBeNull();
    // 화면 속성(initialEntryId)은 그대로라 뒤로 버튼 이름은 기록 쪽이다.
    expect(screen.getByRole("button", { name: "영어일기 기록으로 이동" })).toBeOnTheScreen();
  });

  it("[spec] 새 일기 뒤 임시본이 있으면 다시 이어 쓸지 묻는다", async () => {
    await renderFeedbackStep();
    jest.mocked(getDiaryDraft).mockResolvedValue(draft());
    await pressText("새 일기");

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(lastAlert().title).toBe("저장하지 않은 일기가 있어요");
    await pressAlertButton("이어서 쓰기");
    expect(bodyInput().props.value).toBe("I was writing this before.");
  });
});

// ---------- 피드백 패널 ----------

describe("[spec] 피드백 패널", () => {
  it.each([
    ["DIARY_TOO_SHORT", "조금만 더 쓰면 좋은 일기가 돼요"],
    ["DIARY_NOT_ENGLISH", "쉬운 영어 문장으로 옮겨보면 좋아요"],
    ["DIARY_GRAMMAR_BLOCKING", "의미가 보이도록 문장을 먼저 정리했어요"],
    ["DIARY_FLOW_THIN", "일기의 흐름을 더 살릴 수 있어요"],
    ["DIARY_NATURAL_COMPLETE", "이미 자연스러운 일기예요"],
    ["DIARY_CLEAR_BASIC", "일기를 더 자연스럽게 다듬었어요"]
  ] as const)("[spec] 머리말: %s → %s", async (band, headline) => {
    await renderFeedbackStep(makeFeedback({ diaryAnswerBand: band, score: 55 }));

    expect(screen.getByText(headline)).toBeOnTheScreen();
    expect(screen.getByText("55")).toBeOnTheScreen();
  });

  it("[spec] 요약·좋았던 점(3개까지)·미션을 보인다", async () => {
    await renderFeedbackStep();

    expect(screen.getByText("하루의 흐름이 잘 보여요.")).toBeOnTheScreen();
    expect(screen.queryByText("흐름 요약 문장")).toBeNull();
    expect(screen.getByText("좋았던 점")).toBeOnTheScreen();
    expect(screen.getByText("• 시간 순서가 분명해요.")).toBeOnTheScreen();
    expect(screen.getByText("• 장소를 구체적으로 썼어요.")).toBeOnTheScreen();
    expect(screen.getByText("• 감정을 한 번 넣었어요.")).toBeOnTheScreen();
    expect(screen.queryByText("• 넷째 장점은 안 보여요.")).toBeNull();
    expect(screen.getByText("다시 써보기 미션")).toBeOnTheScreen();
    expect(screen.getByText("기분이 바뀐 순간을 한 문장 더 써 보세요.")).toBeOnTheScreen();
    expect(screen.queryByText("감정 미션")).toBeNull();
    expect(screen.getByText("At first, I felt ...")).toBeOnTheScreen();
  });

  it("[spec] 요약이 비면 흐름 코멘트를, 둘 다 비면 요약을 숨긴다. 미션은 안내가 비면 제목, 둘 다 비면 숨긴다", async () => {
    await renderFeedbackStep(
      makeFeedback({
        summaryKo: "  ",
        diaryFlow: { ...fullFeedback.diaryFlow, commentKo: "흐름 코멘트" },
        nextDiaryMission: { focus: "", titleKo: "제목 미션", instructionKo: " ", starterEn: null }
      })
    );
    expect(screen.getByText("흐름 코멘트")).toBeOnTheScreen();
    expect(screen.getByText("제목 미션")).toBeOnTheScreen();

    await screen.unmount();
    await renderFeedbackStep(makeFeedback());
    expect(screen.queryByText("다시 써보기 미션")).toBeNull();
    expect(screen.queryByText("좋았던 점")).toBeNull();
    expect(screen.queryByText("고치면 더 자연스러운 부분")).toBeNull();
    expect(screen.queryByText("일기에 써볼 표현")).toBeNull();
    expect(screen.queryByText("다시 쓸 때 붙여볼 아이디어")).toBeNull();
  });

  it("[spec] 고칠 부분: 제목이나 이유가 있는 것만, 제목이 없으면 '포인트 N', 바뀐 곳을 빼고 더한 색으로 보인다", async () => {
    await renderFeedbackStep();

    expect(screen.getByText("고치면 더 자연스러운 부분")).toBeOnTheScreen();
    expect(screen.getByText("시제 맞추기")).toBeOnTheScreen();
    expect(screen.getByText("어제 일이라 과거형을 써요.")).toBeOnTheScreen();
    expect(screen.getByText("I went to the store yesterday.")).toBeOnTheScreen();
    expect(screen.getByText("포인트 2")).toBeOnTheScreen();
    expect(screen.getByText("느낌을 덧붙여요.")).toBeOnTheScreen();
    expect(screen.getByText("It was really fun.")).toBeOnTheScreen();
    expect(screen.queryByText("hidden original")).toBeNull();
    expect(screen.queryByText("포인트 3")).toBeNull();

    // 원래 문장과 고친 문장은 바뀐 곳만 색이 다른 조각으로 나뉜다.
    const original = screen.getByText("I go to the park yesterday.");
    const revised = screen.getByText("I went to the park yesterday.");
    const removed = original.queryAll((node) => node.type === "Text" && styleOf(node)?.color === "#B23A22");
    const added = revised.queryAll((node) => node.type === "Text" && styleOf(node)?.color === "#1F6B32");
    expect(removed.map((node) => node.children.join(""))).toEqual(["go"]);
    expect(added.map((node) => node.children.join(""))).toEqual(["went"]);
    expect(styleOf(removed[0])).toEqual({
      color: "#B23A22",
      backgroundColor: "#FFD9D2",
      borderRadius: 6,
      paddingHorizontal: 2,
      fontWeight: "900"
    });
    expect(styleOf(added[0])).toEqual({
      color: "#1F6B32",
      backgroundColor: "#DDF3DF",
      borderRadius: 6,
      paddingHorizontal: 2,
      fontWeight: "900"
    });
    // 고친 문장만 있으면 조각 없이 그대로 보인다.
    const onlyRevised = screen.getByText("It was really fun.");
    expect(onlyRevised.children).toEqual(["It was really fun."]);
  });

  it("[spec] 고칠 부분·좋았던 점·표현·아이디어는 각각 5·3·6·5개까지 보인다", async () => {
    await renderFeedbackStep(
      makeFeedback({
        strengths: ["s1", "s2", "s3", "s4"],
        fixPoints: Array.from({ length: 6 }, (_, index) => ({ kind: "K", title: `fix ${index + 1}`, reasonKo: "r" })),
        diaryExpressions: Array.from({ length: 7 }, (_, index) => expression(`phrase ${index + 1}`)),
        rewriteIdeas: Array.from({ length: 6 }, (_, index) => ({ title: "", meaningKo: `idea ${index + 1}`, noteKo: "" }))
      })
    );

    expect(screen.getByText("• s3")).toBeOnTheScreen();
    expect(screen.queryByText("• s4")).toBeNull();
    expect(screen.getByText("fix 5")).toBeOnTheScreen();
    expect(screen.queryByText("fix 6")).toBeNull();
    expect(screen.getByText("phrase 6")).toBeOnTheScreen();
    expect(screen.queryByText("phrase 7")).toBeNull();
    expect(screen.getByText("idea 5")).toBeOnTheScreen();
    expect(screen.queryByText("idea 6")).toBeNull();
  });

  it("[spec] 흐름 코칭: 좋았던 흐름은 있는 칸만, 다음 흐름은 실천할 문장이 아니면 기본 문구, 연결 표현은 짧으면 묶는다", async () => {
    await renderFeedbackStep();

    expect(screen.getByText("일기 흐름 코칭")).toBeOnTheScreen();
    expect(screen.getByText("좋았던 흐름")).toBeOnTheScreen();
    expect(screen.getByText("시간 흐름: 아침부터 저녁까지 이어져요.")).toBeOnTheScreen();
    expect(screen.queryByText(/^디테일:/)).toBeNull();
    expect(screen.getByText("다음에 더 붙이면 좋을 흐름")).toBeOnTheScreen();
    expect(screen.getByText(`감정 더하기: ${DEFAULT_EMOTION}`)).toBeOnTheScreen();
    expect(screen.getByText("마무리 더하기: 마지막에 느낀 점을 한 문장 더 붙여 보세요.")).toBeOnTheScreen();
    expect(screen.getByText("연결 표현: 다음에는 Then · After that 같은 표현으로 장면을 이어 보세요.")).toBeOnTheScreen();
  });

  it("[spec] 흐름 칸이 모두 비어도 다음 흐름 세 줄은 기본 문구로 보이고, 문장 같은 연결 팁은 그대로 잇는다", async () => {
    await renderFeedbackStep(makeFeedback());
    expect(screen.getByText("일기 흐름 코칭")).toBeOnTheScreen();
    expect(screen.queryByText("좋았던 흐름")).toBeNull();
    expect(screen.getByText(`감정 더하기: ${DEFAULT_EMOTION}`)).toBeOnTheScreen();
    expect(screen.getByText(`마무리 더하기: ${DEFAULT_REFLECTION}`)).toBeOnTheScreen();
    expect(screen.getByText(`연결 표현: ${DEFAULT_CONNECTION}`)).toBeOnTheScreen();

    await screen.unmount();
    await renderFeedbackStep(
      makeFeedback({
        diaryFlow: {
          timeFlow: "",
          emotion: "Try adding how you felt.",
          detail: "카페 이름까지 썼어요.",
          reflection: "",
          commentKo: "",
          connectionTips: ["시간 순서대로 이어 보세요.", " Later "]
        }
      })
    );
    expect(screen.getByText("디테일: 카페 이름까지 썼어요.")).toBeOnTheScreen();
    expect(screen.getByText("감정 더하기: Try adding how you felt.")).toBeOnTheScreen();
    expect(screen.getByText("연결 표현: 시간 순서대로 이어 보세요. Later")).toBeOnTheScreen();
  });

  it("[spec] 써볼 표현: 쓴 표현과 추천 표현을 합쳐 같은 표현은 한 번만, 뜻·예문과 저장 버튼을 보인다", async () => {
    await renderFeedbackStep();

    expect(screen.getByText("일기에 써볼 표현")).toBeOnTheScreen();
    expect(screen.getByText("take a walk")).toBeOnTheScreen();
    expect(screen.getByText("산책하다")).toBeOnTheScreen();
    expect(screen.getByText("I took a walk after dinner.")).toBeOnTheScreen();
    expect(screen.queryByText("Take a  Walk")).toBeNull();
    expect(screen.queryByText("중복이라 안 보여요")).toBeNull();
    expect(screen.getByText("feel refreshed")).toBeOnTheScreen();
    expect(screen.getByText("상쾌하다")).toBeOnTheScreen();

    const saveButtons = screen.getAllByRole("button", { name: "표현 저장" });
    expect(saveButtons).toHaveLength(2);
    const icon = findHost(saveButtons[0], "ExpoSymbolView")[0];
    expect(icon.props).toMatchObject({
      name: { ios: "bookmark", android: "bookmark_border", web: "bookmark_border" },
      size: 16,
      weight: "semibold",
      tintColor: "#8A5A1E",
      type: "hierarchical"
    });
  });

  it("[spec] 아이디어: 뜻·메모·예문이 하나라도 있는 것만, 뜻이 없으면 '아이디어 N'", async () => {
    await renderFeedbackStep();

    expect(screen.getByText("다시 쓸 때 붙여볼 아이디어")).toBeOnTheScreen();
    expect(screen.getByText("저녁 이야기 더하기")).toBeOnTheScreen();
    expect(screen.getByText("저녁에 한 일을 붙여요.")).toBeOnTheScreen();
    expect(screen.getByText("In the evening, I read a book.")).toBeOnTheScreen();
    expect(screen.getByText("아이디어 2")).toBeOnTheScreen();
    expect(screen.queryByText("제목만 있는 아이디어")).toBeNull();
    expect(screen.queryByText("아이디어 3")).toBeNull();
  });
});

// ---------- 표현 저장 ----------

describe("[spec] 표현 저장", () => {
  it("[spec] 저장된 표현을 불러와 같은 표현(대소문자·공백 무시)은 '표현 저장 취소'로 보인다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(5, " Take  a WALK ")]);
    await renderFeedbackStep();

    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    const cancel = screen.getByRole("button", { name: "표현 저장 취소" });
    expect(styleOf(cancel)).toMatchObject({ backgroundColor: "#EAF7ED", borderColor: "#AFD2B7" });
    expect(findHost(cancel, "ExpoSymbolView")[0].props).toMatchObject({
      name: { ios: "bookmark.fill", android: "bookmark", web: "bookmark" },
      tintColor: "#2F7A46"
    });
    expect(screen.getAllByRole("button", { name: "표현 저장" })).toHaveLength(1);
  });

  it("[spec] 저장을 누르면 일기 표현으로 저장하고 '표현 저장 취소'로 바뀐다", async () => {
    await renderFeedbackStep();
    await fireEvent.press(screen.getAllByRole("button", { name: "표현 저장" })[0]);
    await flushAsync();

    expect(saveExpression).toHaveBeenCalledTimes(1);
    expect(saveExpression).toHaveBeenCalledWith({
      expression: "take a walk",
      meaningKo: "산책하다",
      exampleEn: "I took a walk after dinner.",
      usageTipKo: "가벼운 운동을 말할 때",
      tags: ["daily"],
      sourceType: "DIARY_EXPRESSION"
    });
    expect(screen.getByRole("button", { name: "표현 저장 취소" })).toBeOnTheScreen();
  });

  it("[spec] 뜻·예문·팁·태그가 비면 빼고 저장한다", async () => {
    await renderFeedbackStep();
    await fireEvent.press(screen.getAllByRole("button", { name: "표현 저장" })[1]);
    await flushAsync();

    const request = jest.mocked(saveExpression).mock.calls[0][0];
    expect(request).toEqual({ expression: "feel refreshed", meaningKo: "상쾌하다", sourceType: "DIARY_EXPRESSION" });
  });

  it("[spec] 저장 취소를 누르면 저장된 표현을 지우고 '표현 저장'으로 돌아간다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(5, "take a walk")]);
    await renderFeedbackStep();
    await pressButton("표현 저장 취소");

    expect(deleteSavedExpression).toHaveBeenCalledWith(5);
    expect(saveExpression).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "표현 저장 취소" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "표현 저장" })).toHaveLength(2);
  });

  // 패널의 저장 버튼은 누르면 저장 요청의 promise를 그대로 돌려줘서, fireEvent가 저장이 끝날 때까지 기다린다.
  // 그래서 이 테스트는 누른 것을 기다리지 않고 진짜 시계로 한 번 쉰 뒤 저장 중 화면을 보고, 저장을 끝낸 다음 기다린다.
  // 오늘 날짜를 쓰지 않는 화면(불러온 일기)이라 진짜 시계로 돌려도 기대값이 같다.
  it("[spec] 저장하는 동안 그 버튼은 막히고 아이콘 대신 불러오는 중 표시가 보인다", async () => {
    jest.useRealTimers();
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValue(pending.promise);
    await renderFeedbackStep();
    const pressed = fireEvent.press(screen.getAllByRole("button", { name: "표현 저장" })[0]);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const saving = screen.getAllByRole("button", { name: "표현 저장" })[0];
    expect(saving).toBeDisabled();
    const indicator = spinners(saving);
    expect(indicator).toHaveLength(1);
    expect(indicator[0].props).toMatchObject({ color: "#8A5A1E", size: "small" });
    expect(findHost(saving, "ExpoSymbolView")).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "표현 저장" })[1]).toBeEnabled();

    pending.resolve(savedExpression(9, "take a walk"));
    await pressed;
    await flushAsync();
    expect(screen.getByRole("button", { name: "표현 저장 취소" })).toBeEnabled();
  });

  it("[spec] 저장이 실패하면 '표현 저장에 실패했어요' 창을 보이고 그대로 '표현 저장'이다", async () => {
    jest.mocked(saveExpression).mockRejectedValueOnce(new Error("표현 서버 오류"));
    await renderFeedbackStep();
    await fireEvent.press(screen.getAllByRole("button", { name: "표현 저장" })[0]);
    await flushAsync();

    expect(alertSpy).toHaveBeenCalledWith("표현 저장에 실패했어요", "표현 서버 오류");
    expect(screen.getAllByRole("button", { name: "표현 저장" })).toHaveLength(2);

    jest.mocked(deleteSavedExpression).mockRejectedValueOnce("문자열 오류");
    jest.mocked(saveExpression).mockImplementation(async (request) => savedExpression(90, request.expression));
    await fireEvent.press(screen.getAllByRole("button", { name: "표현 저장" })[0]);
    await flushAsync();
    await pressButton("표현 저장 취소");
    expect(alertSpy).toHaveBeenLastCalledWith("표현 저장에 실패했어요", "잠시 후 다시 시도해 주세요.");
    expect(screen.getByRole("button", { name: "표현 저장 취소" })).toBeOnTheScreen();
  });

  it("[spec] 저장된 표현을 불러오지 못하면 모두 '표현 저장'이다", async () => {
    jest.mocked(getSavedExpressions).mockRejectedValue(new Error("목록 오류"));
    await renderFeedbackStep();

    expect(screen.getAllByRole("button", { name: "표현 저장" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "표현 저장 취소" })).toBeNull();
  });
});

// ---------- AI 코치 ----------

describe("[spec] AI 코치", () => {
  it("[spec] 본문이 비면 코치 버튼에 말풍선이 붙고, 글을 쓰면 말풍선이 사라진다", async () => {
    await renderNew();

    const trigger = screen.getByRole("button", { name: "AI 코치 열기" });
    expect(trigger.props.accessibilityHint).toBe("일기 표현과 문장 아이디어를 물어볼 수 있어요.");
    expect(screen.getByText(COACH_BUBBLE)).toBeOnTheScreen();
    expect(styleOf(trigger)).toMatchObject({ minWidth: 204 });
    expect(findHost(trigger, "Image")).toHaveLength(1);

    await typeInto(bodyInput(), "I went home.");
    expect(screen.queryByText(COACH_BUBBLE)).toBeNull();
    expect(styleOf(screen.getByRole("button", { name: "AI 코치 열기" }))).toMatchObject({ minWidth: 58 });
  });

  it("[spec] 열면 코치 창(제목, 닫기, 질문 칸, 빠른 질문 4개, 묻기 버튼, 안내)이 보이고 코치 버튼은 숨는다", async () => {
    await renderNew();
    expect(modalHosts()).toHaveLength(0);
    await openCoach();

    const modal = openModal();
    expect(modal.props.animationType).toBe("slide");
    expect(within(modal).getByText("AI 코치")).toBeOnTheScreen();
    expect(within(modal).getByText("닫기")).toBeOnTheScreen();
    expect(coachInput().props.value).toBe("");
    QUICK_QUESTIONS.forEach((question) => {
      expect(within(modal).getByText(question)).toBeOnTheScreen();
    });
    expect(within(modal).getByText("코치에게 물어보기")).toBeEnabled();
    expect(within(modal).getByText("지금 쓴 일기 내용을 참고해서 표현과 문장을 추천해 줄게요.")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "AI 코치 열기" })).toBeNull();
    expect(requestCoachHelp).not.toHaveBeenCalled();
  });

  it("[spec] 닫기나 닫기 요청(뒤로 가기)으로 창을 닫는다", async () => {
    await renderNew();
    await openCoach();
    await pressText("닫기");
    expect(modalHosts()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "AI 코치 열기" })).toBeOnTheScreen();

    await openCoach();
    await act(async () => {
      openModal().props.onRequestClose();
    });
    await flushAsync();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 빠른 질문을 누르면 질문 칸에 들어가기만 하고 묻지는 않는다", async () => {
    await renderNew();
    await openCoach();
    await pressText(QUICK_QUESTIONS[1]);

    expect(coachInput().props.value).toBe(QUICK_QUESTIONS[1]);
    expect(requestCoachHelp).not.toHaveBeenCalled();
  });

  it("[spec] 빈 질문으로 물으면 오류 문구를 보이고 요청하지 않는다", async () => {
    await renderNew();
    await openCoach();
    await typeInto(coachInput(), "   ");
    await pressText("코치에게 물어보기");

    expect(screen.getByText("코치에게 물어볼 내용을 먼저 적어 주세요.")).toBeOnTheScreen();
    expect(requestCoachHelp).not.toHaveBeenCalled();
    openModal();
  });

  it("[spec] 묻기는 일기 코치 질문 id·다듬은 질문·지금 본문으로 요청하고, 답변과 표현 카드를 보인다", async () => {
    await renderNew();
    await typeInto(bodyInput(), "  I went home.  ");
    await openCoach();
    await askCoach("  How do I say 아쉬웠다?  ");

    expect(requestCoachHelp).toHaveBeenCalledTimes(1);
    expect(requestCoachHelp).toHaveBeenCalledWith({
      promptId: "diary-free-writing",
      question: "How do I say 아쉬웠다?",
      answer: "I went home.",
      attemptType: "INITIAL"
    });
    expect(coachInput().props.value).toBe("How do I say 아쉬웠다?");
    const modal = openModal();
    expect(within(modal).getByText("코치 답변")).toBeOnTheScreen();
    expect(within(modal).getByText("이렇게 써 보세요.")).toBeOnTheScreen();
    expect(within(modal).getByText("feel relieved")).toBeOnTheScreen();
    expect(within(modal).getByText("안도하다")).toBeOnTheScreen();
    expect(within(modal).getByText("걱정이 끝났을 때")).toBeOnTheScreen();
    expect(within(modal).getByText("I felt relieved after the test.")).toBeOnTheScreen();
    expect(within(modal).getByText("Call it a day")).toBeOnTheScreen();
    expect(within(modal).getAllByText("일기에 넣기")).toHaveLength(2);
    expect(within(modal).getAllByText("저장")).toHaveLength(2);
  });

  it("[spec] 본문이 비면 answer 없이, 다시 써보기 단계면 다시 쓴 글과 REWRITE로 묻는다", async () => {
    await renderNew();
    await openCoach();
    await askCoach("Help me");
    expect(jest.mocked(requestCoachHelp).mock.calls[0][0]).toEqual({
      promptId: "diary-free-writing",
      question: "Help me",
      answer: undefined,
      attemptType: "INITIAL"
    });

    await screen.unmount();
    jest.mocked(requestCoachHelp).mockClear();
    await renderFeedbackStep();
    await pressText("다시 써보기");
    await openCoach();
    await askCoach("Help me again");
    expect(requestCoachHelp).toHaveBeenCalledWith({
      promptId: "diary-free-writing",
      question: "Help me again",
      answer: "I walked in the rain today.",
      attemptType: "REWRITE"
    });
  });

  it("[spec] 묻는 동안 버튼은 막히고 글자 대신 불러오는 중 표시가 보인다", async () => {
    const pending = deferred<CoachHelpResponse>();
    jest.mocked(requestCoachHelp).mockReturnValue(pending.promise);
    await renderNew();
    await openCoach();
    await askCoach("Help me");

    const modal = openModal();
    expect(within(modal).queryByText("코치에게 물어보기")).toBeNull();
    const indicators = spinners(modal);
    expect(indicators).toHaveLength(1);
    expect(indicators[0].props.color).toBe("#2E2416");
    expect(indicators[0].parent).toBeDisabled();

    await act(async () => {
      pending.resolve(coachHelp);
    });
    await flushAsync();
    expect(within(openModal()).getByText("코치에게 물어보기")).toBeEnabled();
  });

  it("[spec] 묻기가 실패하면 오류 메시지를, 메시지가 없으면 기본 문구를 보인다", async () => {
    jest.mocked(requestCoachHelp).mockRejectedValueOnce(new Error("코치 서버 오류"));
    await renderNew();
    await openCoach();
    await askCoach("Help me");
    expect(screen.getByText("코치 서버 오류")).toBeOnTheScreen();
    expect(screen.queryByText("코치 답변")).toBeNull();

    jest.mocked(requestCoachHelp).mockRejectedValueOnce("문자열 오류");
    await pressText("코치에게 물어보기");
    expect(screen.getByText("AI 코치를 불러오지 못했어요.")).toBeOnTheScreen();
  });

  it("[spec] 질문을 고치거나 빠른 질문을 누르면 답변과 오류가 지워진다", async () => {
    await renderNew();
    await openCoach();
    await askCoach("Help me");
    expect(screen.getByText("코치 답변")).toBeOnTheScreen();

    await typeInto(coachInput(), "Help me more");
    expect(screen.queryByText("코치 답변")).toBeNull();

    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치 답변")).toBeOnTheScreen();
    await pressText(QUICK_QUESTIONS[0]);
    expect(screen.queryByText("코치 답변")).toBeNull();

    await typeInto(coachInput(), "");
    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치에게 물어볼 내용을 먼저 적어 주세요.")).toBeOnTheScreen();
    await typeInto(coachInput(), "x");
    expect(screen.queryByText("코치에게 물어볼 내용을 먼저 적어 주세요.")).toBeNull();
  });

  it("[spec] 일기에 넣기는 본문 끝에 표현을 붙이고 창을 닫은 뒤, 80ms 뒤 본문 칸으로 스크롤·초점을 옮긴다", async () => {
    await renderNew();
    const editorCard = screen.getByText("오늘의 영어일기").parent!;
    await fireEvent.layout(editorCard, { x: 0, y: 10, width: 300, height: 200 });
    await typeInto(bodyInput(), "I went home.  ");
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getAllByText("일기에 넣기")[0]);
    await flushAsync();

    expect(bodyInput().props.value).toBe("I went home. feel relieved");
    expect(modalHosts()).toHaveLength(0);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    await advance(80);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    expect((textInputFocus.mock.contexts.at(-1) as { props: { placeholder: string } }).props.placeholder).toBe(
      WRITE_PLACEHOLDER
    );
  });

  it("[spec] 본문이 비면 표현만 넣고, 다시 써보기 단계면 다시 쓴 글에 붙인다", async () => {
    await renderNew();
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getAllByText("일기에 넣기")[1]);
    await flushAsync();
    expect(bodyInput().props.value).toBe("Call it a day");

    await screen.unmount();
    await renderFeedbackStep();
    await pressText("다시 써보기");
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getAllByText("일기에 넣기")[0]);
    await flushAsync();
    expect(bodyInput().props.value).toBe("I walked in the rain today. feel relieved");
    expect(screen.getByText("다시 써보기")).toBeOnTheScreen();
  });

  it("[spec] 코치 표현 저장은 일기 표현으로 저장하고 '저장됨'으로 막히며, 패널의 같은 표현도 저장 취소로 바뀐다", async () => {
    await renderFeedbackStep(makeFeedback({ diaryExpressions: [expression("Feel  Relieved")] }));
    expect(screen.getByRole("button", { name: "표현 저장" })).toBeOnTheScreen();
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getAllByText("저장")[0]);
    await flushAsync();

    expect(saveExpression).toHaveBeenCalledWith({
      expression: "feel relieved",
      meaningKo: "안도하다",
      usageTipKo: "걱정이 끝났을 때",
      exampleEn: "I felt relieved after the test.",
      tags: ["emotion"],
      sourceType: "DIARY_EXPRESSION"
    });
    const saved = within(openModal()).getByText("저장됨");
    expect(saved).toBeDisabled();
    expect(styleOf(saved)).toMatchObject({ color: "#2E6C35" });
    expect(styleOf(saved.parent!)).toMatchObject({ backgroundColor: "#EAF7ED", borderColor: "#AFD2B7" });

    await pressText("닫기");
    expect(screen.getByRole("button", { name: "표현 저장 취소" })).toBeOnTheScreen();
  });

  it("[spec] 태그가 없는 코치 표현은 tags 없이 저장하고, 저장하는 동안 '저장 중'으로 막힌다", async () => {
    const pending = deferred<SavedExpression>();
    jest.mocked(saveExpression).mockReturnValue(pending.promise);
    await renderNew();
    await openCoach();
    await askCoach("Help me");
    await fireEvent.press(within(openModal()).getAllByText("저장")[1]);
    await flushAsync();

    expect(jest.mocked(saveExpression).mock.calls[0][0]).toEqual({
      expression: "Call it a day",
      meaningKo: "하루를 마치다",
      usageTipKo: "일을 끝낼 때",
      exampleEn: "Let's call it a day.",
      tags: undefined,
      sourceType: "DIARY_EXPRESSION"
    });
    expect(within(openModal()).getByText("저장 중")).toBeDisabled();

    await act(async () => {
      pending.resolve(savedExpression(11, "Call it a day"));
    });
    await flushAsync();
    expect(within(openModal()).getByText("저장됨")).toBeDisabled();
  });

  it("[spec] 이미 저장된 코치 표현은 처음부터 '저장됨'이고, 저장이 실패하면 창을 띄우고 '저장'으로 돌아간다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(3, "FEEL relieved")]);
    jest.mocked(saveExpression).mockRejectedValueOnce(new Error("코치 표현 오류"));
    await renderNew();
    await openCoach();
    await askCoach("Help me");

    expect(within(openModal()).getByText("저장됨")).toBeDisabled();
    await fireEvent.press(within(openModal()).getByText("저장"));
    await flushAsync();
    expect(alertSpy).toHaveBeenCalledWith("표현 저장에 실패했어요", "코치 표현 오류");
    expect(within(openModal()).getByText("저장")).toBeEnabled();
  });

  it("[spec] 패널에서 저장 취소해도 코치 창의 같은 표현은 '저장됨'으로 남는다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(3, "feel relieved")]);
    await renderFeedbackStep(makeFeedback({ diaryExpressions: [expression("feel relieved")] }));
    await pressButton("표현 저장 취소");
    expect(deleteSavedExpression).toHaveBeenCalledWith(3);

    await openCoach();
    await askCoach("Help me");
    expect(within(openModal()).getByText("저장됨")).toBeDisabled();
  });
});

// ---------- 읽기 전용 화면 ----------

describe("[spec] 읽기 전용 화면", () => {
  it("[spec] 본문이 비면 '아직 작성된 내용이 없어요.'와 0단어를 보인다", async () => {
    await renderExisting(makeEntry({ draft: false, content: "   " }));

    expect(screen.getByText("아직 작성된 내용이 없어요.")).toBeOnTheScreen();
    expect(screen.getByText("0단어")).toBeOnTheScreen();
  });

  it("[spec] 공책 줄 12개를 누르기 막힘으로 깐다", async () => {
    await renderExisting(makeEntry({ draft: false }));

    const notebook = screen.getByText("I walked in the rain.").parent!;
    const lines = notebook.children[0] as TestInstance;
    expect(lines.props.pointerEvents).toBe("none");
    expect(lines.children).toHaveLength(12);
  });

  it("[spec] 피드백이 있으면 '피드백 보기'로 펼치고 접는다", async () => {
    await renderExisting(feedbackEntry(fullFeedback, { draft: false }));

    const toggle = screen.getByRole("button", { name: "피드백 펼치기" });
    expect(within(toggle).getByText("피드백 보기")).toBeOnTheScreen();
    expect(within(toggle).getByText("+")).toBeOnTheScreen();
    expect(screen.queryByText("일기의 흐름을 더 살릴 수 있어요")).toBeNull();

    await pressButton("피드백 펼치기");
    expect(screen.getByText("일기의 흐름을 더 살릴 수 있어요")).toBeOnTheScreen();
    expect(within(screen.getByRole("button", { name: "피드백 접기" })).getByText("-")).toBeOnTheScreen();
    // 읽기 전용 화면의 패널에서도 표현을 저장할 수 있다.
    await fireEvent.press(screen.getAllByRole("button", { name: "표현 저장" })[0]);
    await flushAsync();
    expect(saveExpression).toHaveBeenCalledTimes(1);

    await pressButton("피드백 접기");
    expect(screen.queryByText("일기의 흐름을 더 살릴 수 있어요")).toBeNull();
  });

  it("[spec] 읽기 전용 화면의 오류에는 문제 보내기 링크가 붙는다", async () => {
    jest.mocked(deleteDiaryEntry).mockRejectedValueOnce(new Error("삭제 서버 오류"));
    await renderExisting(makeEntry({ draft: false }));
    await pressButton("일기 삭제");
    await pressAlertButton("삭제하기");

    expect(screen.getByText("삭제 서버 오류")).toBeOnTheScreen();
    await pressButton("반복되는 문제 보내기");
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/support-feedback",
      params: { source: "diary_entry", errorCode: "DIARY_SCREEN_ERROR", category: "BUG" }
    });
  });

  it("[spec] 새 일기를 완료해 읽기 전용이 되면 삭제 버튼이 보이고 뒤로 버튼은 홈으로 보낸다", async () => {
    await renderNew();
    await typeInto(bodyInput(), "I went home.");
    await pressText("AI 피드백 받기");
    await pressText("일기쓰기 완료");

    expect(screen.getByText("완료된 일기")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "일기 삭제" })).toBeOnTheScreen();
    jest.mocked(router.replace).mockReset();
    await pressButton("영어일기 기록으로 이동");
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

// ---------- 삭제 ----------

describe("[spec] 삭제", () => {
  it("[spec] 일기 삭제는 확인 창을 띄우고, 삭제하기를 누르면 지운 뒤 기록으로 바꿔 보낸다", async () => {
    await renderExisting(makeEntry({ draft: false }));
    const deleteText = screen.getByText("일기 삭제");
    expect(styleOf(deleteText)).toEqual({
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "800",
      color: "#A84228",
      textDecorationLine: "underline"
    });
    await pressButton("일기 삭제");

    expect(alertSpy).toHaveBeenCalledWith("이 일기를 삭제할까요?", "삭제하면 피드백 기록도 함께 사라져요.", [
      { text: "취소", style: "cancel" },
      { text: "삭제하기", style: "destructive", onPress: expect.any(Function) }
    ]);
    expect(deleteDiaryEntry).not.toHaveBeenCalled();

    await pressAlertButton("삭제하기");
    expect(deleteDiaryEntry).toHaveBeenCalledWith("entry-1");
    expect(deleteDiaryDraft).toHaveBeenCalledWith("entry-1");
    expect(router.replace).toHaveBeenCalledWith("/diary");
  });

  it("[spec] 취소를 누르면 아무것도 지우지 않는다", async () => {
    await renderExisting(makeEntry({ draft: false }));
    await pressButton("일기 삭제");
    await pressAlertButton("취소");

    expect(deleteDiaryEntry).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("[spec] 지우는 동안 '삭제 중'으로 막히고 흐려진다", async () => {
    const pending = deferred<void>();
    jest.mocked(deleteDiaryEntry).mockReturnValue(pending.promise);
    await renderExisting(makeEntry({ draft: false }));
    await pressButton("일기 삭제");
    await pressAlertButton("삭제하기");

    const button = screen.getByRole("button", { name: "일기 삭제" });
    expect(button).toBeDisabled();
    expect(within(button).getByText("삭제 중")).toBeOnTheScreen();
    expect(styleOf(within(button).getByText("삭제 중"))).toMatchObject({ opacity: 0.45 });

    await act(async () => {
      pending.resolve();
    });
    await flushAsync();
    expect(router.replace).toHaveBeenCalledWith("/diary");
  });

  it("[spec] 삭제가 실패하면 '삭제 실패' 창과 오류를 보이고 이동하지 않는다(메시지가 없으면 기본 문구)", async () => {
    jest.mocked(deleteDiaryEntry).mockRejectedValueOnce(new Error("삭제 서버 오류"));
    await renderExisting(makeEntry());
    await pressButton("일기 삭제");
    await pressAlertButton("삭제하기");

    expect(alertSpy).toHaveBeenLastCalledWith("삭제 실패", "삭제 서버 오류");
    expect(screen.getByText("삭제 서버 오류")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
    expect(deleteDiaryDraft).not.toHaveBeenCalledWith("entry-1");
    expect(screen.getByRole("button", { name: "일기 삭제" })).toBeEnabled();
    // 편집 화면의 오류에는 문제 보내기 링크가 없다.
    expect(screen.queryByText("문제가 반복되나요? 문제 보내기")).toBeNull();

    jest.mocked(deleteDiaryEntry).mockRejectedValueOnce("문자열 오류");
    await pressButton("일기 삭제");
    await pressAlertButton("삭제하기");
    expect(alertSpy).toHaveBeenLastCalledWith("삭제 실패", "일기를 삭제하지 못했어요.");
  });

  it("[spec] 편집 화면에서는 기존 일기일 때만 삭제 버튼이 보인다", async () => {
    await renderExisting(makeEntry());
    expect(screen.getByRole("button", { name: "일기 삭제" })).toBeOnTheScreen();
    await pressButton("일기 삭제");
    await pressAlertButton("삭제하기");
    expect(deleteDiaryEntry).toHaveBeenCalledWith("entry-1");
    expect(router.replace).toHaveBeenCalledWith("/diary");

    await screen.unmount();
    await renderNew();
    expect(screen.queryByRole("button", { name: "일기 삭제" })).toBeNull();
    await typeInto(bodyInput(), "I went home.");
    await pressText("AI 피드백 받기");
    expect(screen.queryByRole("button", { name: "일기 삭제" })).toBeNull();
  });
});

// ---------- 이 기기 임시저장 ----------

describe("[spec] 이 기기 임시저장", () => {
  it("[spec] 쓰다가 800ms 멈추면 지금 편집 내용을 기기에 저장한다", async () => {
    await renderNew();
    const typedAt = new Date(Date.now()).toISOString();
    await typeInto(bodyInput(), "I went home");

    await advance(799);
    expect(saveDiaryDraft).not.toHaveBeenCalled();
    await advance(1);
    expect(saveDiaryDraft).toHaveBeenCalledTimes(1);
    expect(saveDiaryDraft).toHaveBeenCalledWith({
      entryId: "",
      entryDate: TODAY,
      title: TODAY_TITLE,
      moodTags: [],
      content: "I went home",
      rewriteText: "",
      step: "write",
      updatedAt: typedAt
    });
  });

  it("[spec] 800ms 안에 다시 바꾸면 마지막 내용만 한 번 저장한다", async () => {
    await renderNew();
    await typeInto(bodyInput(), "I");
    await advance(500);
    await pressText("sad");
    await advance(500);
    expect(saveDiaryDraft).not.toHaveBeenCalled();
    await advance(300);

    expect(saveDiaryDraft).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveDiaryDraft).mock.calls[0][0]).toMatchObject({ content: "I", moodTags: ["sad"] });
  });

  it("[spec] 처음 그린 뒤 바뀐 것이 없으면 800ms 뒤 저장 대신 임시본을 지운다", async () => {
    await renderNew();
    expect(deleteDiaryDraft).not.toHaveBeenCalled();
    await typeInto(bodyInput(), "x");
    await typeInto(bodyInput(), "");
    await advance(800);

    expect(saveDiaryDraft).not.toHaveBeenCalled();
    expect(deleteDiaryDraft).toHaveBeenCalledTimes(1);
    expect(deleteDiaryDraft).toHaveBeenCalledWith("");
  });

  it("[spec] 임시본을 이어 쓸지 답하기 전에는 기기에 저장하지 않는다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(draft());
    await renderNew();
    await typeInto(bodyInput(), "Typing before answering");
    await advance(2000);

    expect(saveDiaryDraft).not.toHaveBeenCalled();
    expect(deleteDiaryDraft).not.toHaveBeenCalled();
  });

  it("[spec] 이어서 쓰기 뒤에는 이어 쓴 내용(서버 상태와 다름)을 800ms 뒤 저장한다", async () => {
    jest.mocked(getDiaryDraft).mockResolvedValue(draft());
    await renderNew();
    await pressAlertButton("이어서 쓰기");
    await advance(800);

    expect(saveDiaryDraft).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveDiaryDraft).mock.calls[0][0]).toMatchObject({
      entryId: "",
      entryDate: "2026-11-10",
      title: "Draft title",
      moodTags: ["tired"],
      content: "I was writing this before.",
      rewriteText: "Rewrite in progress.",
      step: "write"
    });
  });

  it("[spec] 기존 일기는 그 일기 id로 저장하고, 피드백 단계는 write, 다시 써보기 단계는 rewrite로 저장한다", async () => {
    await renderFeedbackStep();
    await typeInto(bodyInput(), "Edited.");
    await advance(800);
    expect(jest.mocked(saveDiaryDraft).mock.calls.at(-1)![0]).toMatchObject({
      entryId: "entry-1",
      content: "Edited.",
      rewriteText: "I walked in the rain today.",
      step: "write"
    });

    await pressText("다시 써보기");
    await typeInto(bodyInput(), "Rewritten.");
    await advance(800);
    expect(jest.mocked(saveDiaryDraft).mock.calls.at(-1)![0]).toMatchObject({
      entryId: "entry-1",
      content: "Edited.",
      rewriteText: "Rewritten.",
      step: "rewrite"
    });
  });

  it("[spec] 앱이 백그라운드로 가면 기다리지 않고 저장하고, active면 저장하지 않는다", async () => {
    await renderNew();
    await typeInto(bodyInput(), "I went home");

    await emitAppState("active");
    expect(saveDiaryDraft).not.toHaveBeenCalled();
    await emitAppState("background");
    expect(saveDiaryDraft).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveDiaryDraft).mock.calls[0][0]).toMatchObject({ entryId: "", content: "I went home" });
    await emitAppState("inactive");
    expect(saveDiaryDraft).toHaveBeenCalledTimes(2);
  });

  it("[spec] 저장할 변경이 없으면 백그라운드로 가도 저장하지 않는다", async () => {
    await renderNew();
    await emitAppState("background");
    expect(saveDiaryDraft).not.toHaveBeenCalled();

    await typeInto(bodyInput(), "x");
    await typeInto(bodyInput(), "");
    await emitAppState("background");
    expect(saveDiaryDraft).not.toHaveBeenCalled();
  });

  it("[spec] 화면을 떠나면 듣기를 풀고 저장하지 않은 최신 임시본을 바로 저장한다", async () => {
    await renderNew();
    await typeInto(bodyInput(), "Leaving soon");
    await screen.unmount();

    expect(appStateRemove).toHaveBeenCalledTimes(1);
    expect(saveDiaryDraft).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveDiaryDraft).mock.calls[0][0]).toMatchObject({ content: "Leaving soon" });
  });

  it("[spec] 서버에 임시저장한 뒤에는 백그라운드로 가도, 800ms가 지나도 기기에 저장하지 않는다", async () => {
    await renderNew();
    await typeInto(bodyInput(), "I went home.");
    await pressText("임시저장");
    await emitAppState("background");
    expect(saveDiaryDraft).not.toHaveBeenCalled();

    await screen.unmount();
    expect(saveDiaryDraft).not.toHaveBeenCalled();
  });

  it("[spec] 읽기 전용 화면은 기기에 저장하지 않는다", async () => {
    await renderExisting(makeEntry({ draft: false }));
    await advance(2000);
    await emitAppState("background");
    await screen.unmount();

    expect(saveDiaryDraft).not.toHaveBeenCalled();
    expect(deleteDiaryDraft).not.toHaveBeenCalled();
  });

  it("[spec] 저장소 저장이 실패해도 화면은 그대로다", async () => {
    jest.mocked(saveDiaryDraft).mockRejectedValue(new Error("저장소 오류"));
    await renderNew();
    await typeInto(bodyInput(), "I went home");
    await advance(800);
    await emitAppState("background");

    expect(saveDiaryDraft).toHaveBeenCalledTimes(2);
    expect(bodyInput().props.value).toBe("I went home");
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

// ---------- 화면 구조 ----------
// 문구·구조·접근성 속성·스타일 값이 지금과 같은지 호스트 트리 스냅샷으로 기록한다(tests/components/__snapshots__).
// 기다림 화면(FeedbackLoadingOverlay)은 이번에 옮기지 않는 컴포넌트이고 움직이는 값이 들어 있어 찍지 않는다.

describe("[spec] 화면 구조", () => {
  it("[spec] 불러오는 중 화면", async () => {
    setSessionUser(null, true);
    await renderNew();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 로그인 안내 화면", async () => {
    setSessionUser(null);
    await renderNew();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 새 일기 편집 화면(빈 본문, 말풍선)", async () => {
    await renderNew();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 기존 일기 편집 화면(본문, 고른 기분, 삭제 버튼, 오류 줄)", async () => {
    jest.mocked(updateDiaryEntry).mockRejectedValueOnce(new Error("저장 서버 오류"));
    await renderExisting(makeEntry());
    await pressText("임시저장");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 피드백 단계(모든 칸을 채운 패널, 저장된 표현 하나)", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(5, "take a walk")]);
    await renderFeedbackStep();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 다시 써보기 단계", async () => {
    await renderFeedbackStep();
    await pressText("다시 써보기");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 읽기 전용 화면(펼친 피드백, 오류와 문제 보내기, 삭제 버튼)", async () => {
    jest.mocked(deleteDiaryEntry).mockRejectedValueOnce(new Error("삭제 서버 오류"));
    await renderExisting(feedbackEntry(fullFeedback, { draft: false }));
    await pressButton("피드백 펼치기");
    await pressButton("일기 삭제");
    await pressAlertButton("삭제하기");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 읽기 전용 화면(빈 본문, 피드백 없음)", async () => {
    await renderExisting(makeEntry({ draft: false, content: "", tags: [], title: "" }));

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(답변과 표현 카드, 저장됨 하나)", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([savedExpression(3, "call it a day")]);
    await renderNew();
    await openCoach();
    await askCoach("Help me");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(묻는 중)", async () => {
    jest.mocked(requestCoachHelp).mockReturnValue(new Promise(() => undefined));
    await renderNew();
    await openCoach();
    await askCoach("Help me");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] AI 코치 창(오류)", async () => {
    await renderNew();
    await openCoach();
    await pressText("코치에게 물어보기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });
});
