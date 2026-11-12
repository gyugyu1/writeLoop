// [spec] qa 테스트(작업 048-03 기록 화면 조각, 리팩터링의 "지금 동작" 기록).
// 기록 화면(src/app/records.tsx) 전체를 렌더하고 사용자처럼 눌러, 지금 보이는 문구·구조·접근성 속성과 부르는 API·기기 저장
// 동작을 좋고 나쁨과 관계없이 그대로 적는다. 타입·순수 함수·기록 상세 모달·스타일·화면 조각을 옮긴 뒤에도, 상태·효과를
// 훅으로 옮기는 다음 단계(부모 계획 3)에서도 이 테스트가 그대로 통과해야 한다.
// 가짜로 두는 것: API(@/lib/api), 로그인 상태(@/lib/session), 피드백 상태 저장(@/lib/practice-feedback-state),
// Now in English 기록 불러오기(@/lib/now-in-english의 getNowInEnglishSummary. 날짜·시각 문구 함수는 실제 것),
// 기기 저장소(AsyncStorage 가짜, expo-secure-store), 라우터(expo-router), Alert(spyOn), 네이티브 모듈(expo-symbols, expo-notifications, 안전 영역).
// 난이도 이름(@/lib/difficulty), 로그인 주소(@/lib/login-redirect), 그때 피드백 다시 그리기(VisiblePracticeFeedbackContent),
// 머리·아래 내비게이션·모달 안전 영역 컴포넌트는 실제 것을 쓴다.
// 날짜 계산이 오늘에 기대므로 모든 테스트를 가짜 시계로 돌린다(2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00에서 멈춤).
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactElement } from "react";
import { Alert, ScrollView, StyleSheet } from "react-native";
import type { TestInstance } from "test-renderer";
import RecordsScreen from "@/app/records";
import { deleteSavedExpression, getAnswerHistory, getSavedExpressions, getTodayWritingStatus } from "@/lib/api";
import { getNowInEnglishSummary, type NowInEnglishEntry, type NowInEnglishSummary } from "@/lib/now-in-english";
import { savePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  HistoryAttempt,
  HistorySession,
  SavedExpression,
  TodayWritingStatus,
  VisibleFeedbackSnapshot
} from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
  useLocalSearchParams: jest.fn()
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
// 알림(expo-notifications)은 네이티브 모듈이라 비워 둔다. 기록 화면은 알림 함수를 부르지 않는다.
jest.mock("expo-notifications", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/lib/api", () => ({
  deleteSavedExpression: jest.fn(),
  getAnswerHistory: jest.fn(),
  getSavedExpressions: jest.fn(),
  getTodayWritingStatus: jest.fn()
}));
// 날짜·시각 문구 함수(formatNowInEnglishDateLabel, formatNowInEnglishTime)는 실제 것을 쓰고, 불러오기만 가짜로 둔다.
jest.mock("@/lib/now-in-english", () => ({
  ...jest.requireActual<typeof import("@/lib/now-in-english")>("@/lib/now-in-english"),
  getNowInEnglishSummary: jest.fn()
}));
jest.mock("@/lib/practice-feedback-state", () => ({ savePracticeFeedbackState: jest.fn() }));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SEARCH_PLACEHOLDER = "표현, 뜻, 예문, 질문, 태그 검색";
const PRACTICE_TEXT = "이 표현으로 한 문장 써보기";
const PROMPT_OPEN_TEXT = "어떤 질문에서 저장했는지 보기";
const HISTORY_LINK_TEXT = "질문 히스토리로 가기";
const TAG_PRACTICE_TEXT = "이 태그로 다시 써보기";

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function todayStatus(overrides: Partial<TodayWritingStatus> = {}): TodayWritingStatus {
  return {
    date: "2026-11-12",
    completed: true,
    completedSessions: 1,
    startedSessions: 1,
    streakDays: 3,
    totalAnswerSessions: 42,
    totalWrittenSentences: 1234,
    ...overrides
  };
}

function attempt(overrides: Partial<HistoryAttempt> & Pick<HistoryAttempt, "id" | "attemptNo" | "createdAt">): HistoryAttempt {
  return {
    attemptType: "INITIAL",
    answerText: "I like it.",
    feedbackSummary: "",
    visibleFeedback: null,
    usedExpressions: [],
    ...overrides
  };
}

function historySession(overrides: Partial<HistorySession> & Pick<HistorySession, "sessionId">): HistorySession {
  return {
    promptId: "prompt-x",
    topic: "Topic",
    difficulty: "A",
    questionEn: "Question?",
    questionKo: "질문?",
    status: "IN_PROGRESS",
    createdAt: "2026-11-12T00:00:00.000Z",
    updatedAt: "2026-11-12T00:00:00.000Z",
    attempts: [],
    ...overrides
  };
}

const s1FirstFeedback: VisibleFeedbackSnapshot = {
  schemaVersion: 1,
  state: "NEEDS_REWRITE",
  strength: "커피 이야기를 분명하게 했어요.",
  coachMove: { focus: "시간 표현 더하기", instruction: "언제 마시는지 더해 보세요." }
};
const s1LatestFeedback: VisibleFeedbackSnapshot = {
  schemaVersion: 1,
  state: "NEEDS_REWRITE",
  strength: "문장이 자세해졌어요.",
  coachMove: { focus: "이유 더하기", instruction: "왜 마시는지 한 문장 더 써 보세요." },
  refinementExpressions: [{ expression: "start my day", meaningKo: "하루를 시작하다" }],
  modelAnswer: "I drink hot coffee every morning because it wakes me up.",
  modelAnswerKo: "아침마다 잠을 깨려고 뜨거운 커피를 마셔요."
};
const s2Feedback: VisibleFeedbackSnapshot = {
  schemaVersion: 1,
  state: "READY_TO_FINISH",
  strength: "질문에 맞게 답했어요.",
  coachMove: { focus: "마무리 문장" },
  completion: { headline: "점심 이야기를 잘 마쳤어요." },
  modelAnswer: "I ate kimchi stew for lunch."
};
const s3Feedback: VisibleFeedbackSnapshot = {
  schemaVersion: 1,
  state: "READY_TO_FINISH",
  completion: { headline: "여행 이야기를 끝냈어요." }
};

// 작문 기록(기본): 서울 날짜로 11-12(s1·s2), 11-11(s3·s5), 11-09(s4) 세 묶음.
// s1은 처음 시도가 11-10이지만 마지막 시도가 11-12라 11-12에 묶인다. s5는 UTC로 11-10 15:30, 서울로 11-11 00:30이다.
const s1 = historySession({
  sessionId: "session-1",
  promptId: "prompt-1",
  topic: "Morning",
  difficulty: "A",
  questionEn: "What do you do in the morning?",
  questionKo: "아침에 무엇을 하나요?",
  status: "IN_PROGRESS",
  createdAt: "2026-11-10T01:00:00.000Z",
  updatedAt: "2026-11-12T02:00:00.000Z",
  attempts: [
    attempt({
      id: 11,
      attemptNo: 1,
      attemptType: "INITIAL",
      answerText: "I drink coffee.",
      feedbackSummary: "첫 답 요약",
      visibleFeedback: s1FirstFeedback,
      createdAt: "2026-11-10T01:00:00.000Z"
    }),
    attempt({
      id: 12,
      attemptNo: 2,
      attemptType: "REWRITE",
      answerText: "I drink hot coffee every morning.",
      feedbackSummary: "다시 쓴 답 요약",
      visibleFeedback: s1LatestFeedback,
      createdAt: "2026-11-12T02:00:00.000Z"
    })
  ]
});
const s2 = historySession({
  sessionId: "session-2",
  promptId: "prompt-2",
  topic: "Food",
  difficulty: "B",
  questionEn: "What did you eat for lunch?",
  questionKo: "점심으로 무엇을 먹었나요?",
  status: "READY_TO_FINISH",
  createdAt: "2026-11-12T00:30:00.000Z",
  updatedAt: "2026-11-12T00:30:00.000Z",
  attempts: [
    attempt({
      id: 21,
      attemptNo: 1,
      answerText: "I ate kimchi stew.",
      feedbackSummary: "점심 요약",
      visibleFeedback: s2Feedback,
      createdAt: "2026-11-12T00:30:00.000Z"
    })
  ]
});
const s3 = historySession({
  sessionId: "session-3",
  promptId: "prompt-3",
  topic: "Travel",
  difficulty: "C",
  questionEn: "Where did you travel last year?",
  questionKo: "작년에 어디로 여행했나요?",
  status: "COMPLETED",
  createdAt: "2026-11-11T05:00:00.000Z",
  updatedAt: "2026-11-11T05:00:00.000Z",
  attempts: [
    attempt({
      id: 31,
      attemptNo: 1,
      answerText: "I went to Busan.",
      visibleFeedback: s3Feedback,
      createdAt: "2026-11-11T05:00:00.000Z"
    })
  ]
});
const s4 = historySession({
  sessionId: "session-4",
  promptId: "prompt-4",
  topic: "Hobby",
  difficulty: "I",
  questionEn: "What is your hobby?",
  questionKo: "취미가 무엇인가요?",
  createdAt: "2026-11-09T03:00:00.000Z",
  updatedAt: "2026-11-09T03:00:00.000Z",
  attempts: []
});
const s5 = historySession({
  sessionId: "session-5",
  promptId: "prompt-5",
  topic: "Sleep",
  difficulty: "B",
  questionEn: "When do you go to bed?",
  questionKo: "언제 자러 가나요?",
  createdAt: "2026-11-10T15:30:00.000Z",
  updatedAt: "2026-11-10T15:30:00.000Z",
  attempts: [
    attempt({
      id: 51,
      attemptNo: 1,
      answerText: "I go to bed at midnight.",
      visibleFeedback: null,
      createdAt: "2026-11-10T15:30:00.000Z"
    })
  ]
});
const baseHistory = [s1, s2, s3, s4, s5];

const HEADING_1112 = "2026년 11월 12일 목";
const HEADING_1111 = "2026년 11월 11일 수";
const HEADING_1109 = "2026년 11월 9일 월";

// 한 페이지(30개)를 꽉 채운 기록: 11-12 ~ 11-07의 여섯 날짜에 5개씩. 가장 오래된 기록 시각은 2026-11-07T01:20:00.000Z.
function pagedHistory(): HistorySession[] {
  return Array.from({ length: 30 }, (_, index) => {
    const day = 12 - Math.floor(index / 5);
    const createdAt = new Date(Date.UTC(2026, 10, day, 2, 0) - (index % 5) * 600000).toISOString();
    return historySession({
      sessionId: `page-${index}`,
      promptId: `prompt-page-${index}`,
      topic: `Topic ${index}`,
      questionEn: `Paged question ${index}?`,
      questionKo: `페이지 질문 ${index}`,
      createdAt,
      updatedAt: createdAt,
      attempts: [attempt({ id: 1000 + index, attemptNo: 1, createdAt })]
    });
  });
}
const PAGED_OLDEST = "2026-11-07T01:20:00.000Z";
const PAGED_HEADINGS = [
  "2026년 11월 12일 목",
  "2026년 11월 11일 수",
  "2026년 11월 10일 화",
  "2026년 11월 9일 월",
  "2026년 11월 8일 일",
  "2026년 11월 7일 토"
];

// 달력 넘기기용: 11월·10월·9월에 하나씩.
function sessionOn(dateIso: string, id: string): HistorySession {
  return historySession({
    sessionId: `session-${id}`,
    promptId: `prompt-${id}`,
    topic: `Topic ${id}`,
    questionEn: `Question on ${id}?`,
    questionKo: `${id}의 질문`,
    createdAt: dateIso,
    updatedAt: dateIso,
    attempts: [attempt({ id: Number(id.replace(/\D/g, "")), attemptNo: 1, createdAt: dateIso })]
  });
}
const calendarHistory = [
  sessionOn("2026-11-12T03:00:00.000Z", "1112"),
  sessionOn("2026-10-20T03:00:00.000Z", "1020"),
  sessionOn("2026-09-05T03:00:00.000Z", "0905")
];

function savedExpression(overrides: Partial<SavedExpression> & Pick<SavedExpression, "id" | "expression">): SavedExpression {
  return {
    meaningKo: null,
    usageTipKo: null,
    exampleEn: null,
    tags: null,
    sourceType: "USED_EXPRESSION",
    promptId: null,
    promptDifficulty: null,
    promptTopic: null,
    promptQuestionEn: null,
    promptQuestionKo: null,
    saveCount: 1,
    lastSavedAt: "2026-11-01T03:00:00.000Z",
    createdAt: "2026-11-01T03:00:00.000Z",
    ...overrides
  };
}

// 저장 표현: 최근 저장 순서로 e2, e1, e3, e4, e5, e6.
const e1 = savedExpression({
  id: 1,
  expression: "grab a coffee",
  meaningKo: "커피 한잔하다",
  exampleEn: "Grab a coffee with me before work.",
  tags: ["used_expression", "verb_phrase", "daily_routine"],
  sourceType: "USED_EXPRESSION",
  promptId: "prompt-1",
  promptDifficulty: "A",
  promptQuestionEn: "What do you do in the morning?",
  saveCount: 2,
  lastSavedAt: "2026-11-11T03:00:00.000Z"
});
const e2 = savedExpression({
  id: 2,
  expression: "on the way to",
  meaningKo: "~로 가는 길에",
  exampleEn: "On the way to work, I listen to music.",
  tags: ["Verb_Phrase", "travel", "coach_recommendation"],
  sourceType: "COACH_RECOMMENDATION",
  promptId: "prompt-3",
  promptDifficulty: "B",
  promptQuestionKo: "출근길에 무엇을 하나요?",
  lastSavedAt: "2026-11-12T01:00:00.000Z"
});
const e3 = savedExpression({
  id: 3,
  expression: "stay up late",
  sourceType: "DIARY_EXPRESSION",
  promptId: "prompt-3",
  lastSavedAt: "2026-11-10T03:00:00.000Z"
});
const e4 = savedExpression({
  id: 4,
  expression: "Feel Refreshed",
  meaningKo: "개운하다",
  exampleEn: "I feel refreshed after a walk.",
  tags: [" Feeling_Expression ", "custom-tag", "used_expression"],
  sourceType: "REFINEMENT_EXPRESSION",
  promptId: "",
  promptTopic: "Morning",
  lastSavedAt: "2026-11-09T03:00:00.000Z"
});
const e5 = savedExpression({
  id: 5,
  expression: "wake up early",
  meaningKo: "일찍 일어나다",
  exampleEn: "I usually get up at six.",
  tags: ["verb_phrase"],
  sourceType: "USED_EXPRESSION",
  promptId: "prompt-1",
  promptDifficulty: "A",
  promptQuestionEn: "What do you do in the morning?",
  lastSavedAt: "2026-11-08T03:00:00.000Z"
});
const e6 = savedExpression({
  id: 6,
  expression: "by the way",
  exampleEn: "By the way, I found it.",
  tags: [],
  sourceType: "DIARY_EXPRESSION",
  promptQuestionEn: "Why do you like rainy days?",
  lastSavedAt: ""
});
const baseExpressions = [e1, e2, e3, e4, e5, e6];
const EXPRESSION_PATTERN = /^(grab a coffee|on the way to|stay up late|Feel Refreshed|wake up early|by the way)$/;

// Now in English 기록: 오늘(2개), 어제, 11-05.
function nowEntry(id: string, dateKey: string, createdAt: string, text: string): NowInEnglishEntry {
  return { id, dateKey, createdAt, text };
}
const nowEntries = [
  nowEntry("now-1", "2026-11-12", "2026-11-12T01:00:00.000Z", "I am having lunch."),
  nowEntry("now-3", "2026-11-11", "2026-11-11T10:00:00.000Z", "I am tired."),
  nowEntry("now-2", "2026-11-12", "2026-11-12T02:30:00.000Z", "I am reading a book."),
  nowEntry("now-4", "2026-11-05", "2026-11-05T03:00:00.000Z", "I am cooking.")
];

function nowSummary(entries: NowInEnglishEntry[] = nowEntries): NowInEnglishSummary {
  return {
    entries,
    todayEntries: [],
    todayCount: 0,
    settings: {
      enabled: false,
      intervalHours: 2,
      scheduleMode: "HOURLY_ANCHOR",
      notificationIds: [],
      scheduledReminderAts: [],
      quietHours: { enabled: true, startHour: 23, endHour: 8 },
      updatedAt: "2026-11-01T00:00:00.000Z"
    }
  };
}

// 실행 환경의 ko-KR 형식과 시간대에 따라 달라지는 문구는 화면과 같은 방식으로 기대값을 만든다.
function seoulTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}
function deviceTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function savedDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

// 스냅샷에서는 위 문구를 자리 표시로 바꿔, 실행 환경(ko-KR 형식, 기기 시간대)과 관계없이 같은 결과가 나오게 한다.
// 시간대에 따라 서로 다른 시각이 같은 문구가 될 수 있어 자리 표시는 종류만 남긴다(어떤 시각인지는 위 테스트들이 단언한다).
const VOLATILE_TEXT: [string, string][] = [
  ...[s1, s2, s3, s5]
    .flatMap((session) => session.attempts)
    .map((item): [string, string] => [seoulTime(item.createdAt), "<시각>"]),
  ...nowEntries.map((entry): [string, string] => [deviceTime(entry.createdAt), "<시각>"]),
  ...baseExpressions
    .filter((item) => item.lastSavedAt)
    .map((item): [string, string] => [savedDate(item.lastSavedAt), "<저장 날짜>"])
].sort((left, right) => right[0].length - left[0].length);

function normalizeText(value: string) {
  return VOLATILE_TEXT.reduce((text, [from, to]) => text.split(from).join(to), value);
}

// ---------- 도우미 ----------

type AlertButton = { text: string; style?: string; onPress?: () => void };

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
const scrollViewScrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;
let alertSpy: jest.SpyInstance;

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

function setParams(params: { tab?: string; date?: string }) {
  jest.mocked(useLocalSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useLocalSearchParams>);
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

async function renderScreen() {
  await render(<RecordsScreen />);
  await flushAsync();
}

async function rerenderScreen() {
  await screen.rerender(<RecordsScreen />);
  await flushAsync();
}

async function press(element: TestInstance) {
  await fireEvent.press(element);
  await flushAsync();
}

async function pressText(text: string | RegExp, index = 0) {
  await press(screen.getAllByText(text)[index]);
}

async function openTab(label: "영어 답변" | "영어조각" | "일기" | "저장 표현") {
  await pressText(label);
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function spinners(root: TestInstance = screen.container) {
  return findHost(root, "ActivityIndicator");
}

function modalHosts() {
  return findHost(screen.container, "Modal");
}

function openModal() {
  const modals = modalHosts();
  expect(modals).toHaveLength(1);
  return modals[0];
}

function scrollHost() {
  return findHost(screen.container, "RCTScrollView")[0];
}

type RefreshControlElement = ReactElement<{ refreshing: boolean; onRefresh: () => void }>;

function refreshControl() {
  return scrollHost().props.refreshControl as RefreshControlElement;
}

async function pullToRefresh() {
  await act(async () => {
    refreshControl().props.onRefresh();
  });
  await flushAsync();
}

// 날짜 묶음 머리의 "+"/"-" 표시.
function groupToggle(heading: string) {
  const headingPressable = screen.getByText(heading).parent!.parent!;
  return within(headingPressable).getByText(/^[-+]$/);
}

// 날짜 묶음의 위치가 정해졌다고 알린다(onLayout). 머리 글자에서 올라가 묶음 View의 onLayout이 불린다.
async function layoutGroup(heading: string, y: number) {
  await act(async () => {
    fireEvent(screen.getByText(heading), "layout", { nativeEvent: { layout: { x: 0, y, width: 320, height: 120 } } });
  });
  await flushAsync();
}

function visibleHeadings() {
  return screen.queryAllByText(/^\d{4}년 \d{1,2}월 \d{1,2}일 [일월화수목금토]$/).map((node) => node.children.join(""));
}

function expressionOrder() {
  return screen.queryAllByText(EXPRESSION_PATTERN).map((node) => node.children.join(""));
}

function filterChipTexts() {
  const scroll = findHost(screen.container, "RCTScrollView").find((node) => node.props.horizontal === true)!;
  return findHost(scroll, "Text").map((node) => node.children.join(""));
}

function deleteButtons() {
  return findHost(screen.container, "ExpoSymbolView").filter(
    (node) => (node.props.name as { android?: string }).android === "delete"
  );
}

function practiceButtons() {
  return screen.getAllByText(PRACTICE_TEXT, { includeHiddenElements: true });
}

function lastAlert() {
  const call = alertSpy.mock.calls.at(-1) as [string, string, AlertButton[] | undefined];
  return { title: call[0], message: call[1], buttons: call[2] };
}

async function pressAlertButton(text: string) {
  const button = lastAlert().buttons!.find((item) => item.text === text)!;
  await act(async () => {
    button.onPress?.();
  });
  await flushAsync();
}

function searchInput() {
  return screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
}

async function typeSearch(value: string) {
  await fireEvent.changeText(searchInput(), value);
  await flushAsync();
}

// 화면 구조 기록용: 호스트 요소의 종류, 이 화면이 정하는 속성(스타일은 펼친 값), 자식만 남긴다.
// React Native 안쪽에서 붙는 속성과 함수는 빼서, 화면 코드가 그대로면 같은 결과가 나오게 한다.
const STRUCTURE_PROPS = new Set([
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
  "accessibilityViewIsModal",
  "accessible",
  "adjustsFontSizeToFit",
  "animationType",
  "autoCapitalize",
  "autoCorrect",
  "collapsable",
  "color",
  "contentContainerStyle",
  "edges",
  "hitSlop",
  "horizontal",
  "name",
  "numberOfLines",
  "placeholder",
  "placeholderTextColor",
  "pointerEvents",
  "returnKeyType",
  "showsHorizontalScrollIndicator",
  "showsVerticalScrollIndicator",
  "size",
  "source",
  "style",
  "tintColor",
  "transparent",
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
  const children = node.children.map((child) => (typeof child === "string" ? normalizeText(child) : structureOf(child)));
  return { $$typeof: TEST_JSON, type: node.type, props, children: children.length > 0 ? children : null };
}

function screenStructure() {
  return structureOf(screen.container);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getAnswerHistory).mockReset().mockResolvedValue(baseHistory);
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue(baseExpressions);
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  jest.mocked(getNowInEnglishSummary).mockReset().mockResolvedValue(nowSummary());
  jest.mocked(savePracticeFeedbackState).mockReset();
  scrollViewScrollTo.mockClear();
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
  setParams({});
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 진입 ----------

describe("[spec] 진입", () => {
  it("[spec] 세션을 확인하는 동안에는 불러오는 중 표시와 아래 내비게이션만 보인다", async () => {
    setSessionUser(null, true);
    await renderScreen();

    expect(spinners()).toHaveLength(1);
    expect(spinners()[0].props.color).toBe("#E38B12");
    // "기록"은 아래 내비게이션의 이름 하나뿐이다(머리 제목 없음).
    expect(screen.getAllByText("기록")).toHaveLength(1);
    expect(screen.queryByText("로그인이 필요해요")).toBeNull();
    expect(screen.queryByText("영어 답변")).toBeNull();
    // 세션 확인 중에도 Now in English 기록은 불러오고, 로그인 전이라 작문 기록·표현은 부르지 않는다.
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(getAnswerHistory).not.toHaveBeenCalled();
    expect(getSavedExpressions).not.toHaveBeenCalled();
  });

  it("[spec] 경로 값이 없으면 작문 기록 탭으로 열고, 작문 기록과 저장 표현과 Now in English 기록을 한 번씩 부른다", async () => {
    await renderScreen();

    expect(screen.getAllByText("기록")).toHaveLength(2);
    expect(screen.getByText("날짜별 기록")).toBeOnTheScreen();
    expect(getAnswerHistory).toHaveBeenCalledTimes(1);
    expect(getAnswerHistory).toHaveBeenCalledWith({ limit: 30 });
    expect(getTodayWritingStatus).toHaveBeenCalledTimes(1);
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(getSavedExpressions).toHaveBeenCalledWith();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["diary", "영어일기 기록"],
    ["now", "영어조각 기록"],
    ["expressions", "저장한 표현"],
    ["history", "날짜별 기록"],
    ["weird", "날짜별 기록"]
  ])("[spec] 경로 값 tab=%s이면 그 탭(%s)으로 연다", async (tab, title) => {
    setParams({ tab });
    await renderScreen();

    expect(screen.getByText(title)).toBeOnTheScreen();
  });

  it("[spec] 경로 값 tab이 바뀌면 그 탭으로 바꾸고, 같은 값으로 다시 그리면 손으로 바꾼 탭을 그대로 둔다", async () => {
    setParams({ tab: "history" });
    await renderScreen();
    await openTab("일기");
    expect(screen.getByText("영어일기 기록")).toBeOnTheScreen();

    await rerenderScreen();
    expect(screen.getByText("영어일기 기록")).toBeOnTheScreen();

    setParams({ tab: "now" });
    await rerenderScreen();
    expect(screen.getByText("영어조각 기록")).toBeOnTheScreen();
  });

  it("[spec] 경로 값 date가 기록 있는 날이면 그 날짜 묶음만 열고 다른 묶음은 닫는다", async () => {
    setParams({ date: "2026-11-11" });
    await renderScreen();

    expect(groupToggle(HEADING_1111)).toHaveTextContent("-");
    expect(groupToggle(HEADING_1112)).toHaveTextContent("+");
    expect(groupToggle(HEADING_1109)).toHaveTextContent("+");
    expect(screen.getByText(s3.questionEn)).toBeOnTheScreen();
    expect(screen.queryByText(s1.questionEn)).toBeNull();
  });

  it.each(["2026-11", "2026-11-10"])("[spec] 경로 값 date=%s(형식에 맞지 않거나 기록 없는 날)이면 첫 묶음만 연다", async (date) => {
    setParams({ date });
    await renderScreen();

    expect(groupToggle(HEADING_1112)).toHaveTextContent("-");
    expect(groupToggle(HEADING_1111)).toHaveTextContent("+");
    expect(groupToggle(HEADING_1109)).toHaveTextContent("+");
  });

  it("[spec] 경로 값 date가 바뀌면 그 날짜를 고르고 묶음을 연다", async () => {
    await renderScreen();
    expect(groupToggle(HEADING_1109)).toHaveTextContent("+");

    setParams({ date: "2026-11-09" });
    await rerenderScreen();

    expect(groupToggle(HEADING_1109)).toHaveTextContent("-");
    // 이미 열려 있던 첫 묶음은 그대로 열려 있다.
    expect(groupToggle(HEADING_1112)).toHaveTextContent("-");
    expect(screen.getByText(s4.questionEn)).toBeOnTheScreen();
  });
});

// ---------- 로그인 전 ----------

describe("[spec] 로그인 전", () => {
  beforeEach(() => {
    setSessionUser(null);
  });

  it("[spec] 로그인 안내 카드만 보이고 탭 줄이 없으며, 작문 기록과 표현을 부르지 않는다", async () => {
    await renderScreen();

    expect(screen.getByText("로그인이 필요해요")).toBeOnTheScreen();
    expect(screen.getByText("작문과 일기 기록은 로그인한 뒤 날짜별로 모아볼 수 있어요.")).toBeOnTheScreen();
    expect(screen.queryByText("영어 답변")).toBeNull();
    expect(screen.queryByText("연속 루프")).toBeNull();
    expect(getAnswerHistory).not.toHaveBeenCalled();
    expect(getTodayWritingStatus).not.toHaveBeenCalled();
    expect(getSavedExpressions).not.toHaveBeenCalled();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
  });

  it("[spec] 로그인 하기를 누르면 지금 탭(저장 표현)의 기록 화면으로 돌아오는 로그인 주소로 간다", async () => {
    setParams({ tab: "expressions" });
    await renderScreen();

    await pressText("로그인 하기");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/login?redirectTo=%2Frecords%3Ftab%3Dexpressions");
  });

  it("[spec] 영어조각 탭은 로그인 전에도 프로필 없이 탭 줄과 기록을 보이고, 다른 탭을 누르면 로그인 안내로 바뀐다", async () => {
    setParams({ tab: "now" });
    await renderScreen();

    expect(screen.queryByText("로그인이 필요해요")).toBeNull();
    expect(screen.queryByText("연속 루프")).toBeNull();
    expect(screen.getByText("영어 답변")).toBeOnTheScreen();
    expect(screen.getByText("영어조각 기록")).toBeOnTheScreen();
    expect(screen.getByText("I am reading a book.")).toBeOnTheScreen();

    await openTab("저장 표현");

    expect(screen.getByText("로그인이 필요해요")).toBeOnTheScreen();
    expect(screen.queryByText("영어 답변")).toBeNull();
  });

  it("[spec] 로그인하면 작문 기록(첫 페이지)과 저장 표현을 부르고, Now in English 기록도 다시 부른다", async () => {
    await renderScreen();

    setSessionUser(signedInUser);
    await rerenderScreen();

    expect(getAnswerHistory).toHaveBeenCalledTimes(1);
    expect(getAnswerHistory).toHaveBeenCalledWith({ limit: 30 });
    expect(getTodayWritingStatus).toHaveBeenCalledTimes(1);
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(screen.getByText("학습자")).toBeOnTheScreen();
    expect(screen.getByText(s1.questionEn)).toBeOnTheScreen();
  });

  it("[spec] 로그아웃하면 기록·표현·열린 상세·검색어·태그를 비우고 로그인 안내를 보인다", async () => {
    setSessionUser(signedInUser);
    await renderScreen();
    await openTab("저장 표현");
    await typeSearch("coffee");
    await pressText(PROMPT_OPEN_TEXT, 0);
    await pressText(HISTORY_LINK_TEXT);
    expect(modalHosts()).toHaveLength(1);

    setSessionUser(null);
    await rerenderScreen();

    expect(modalHosts()).toHaveLength(0);
    expect(screen.getByText("로그인이 필요해요")).toBeOnTheScreen();

    // 다시 로그인하면 표현을 다시 부르고 검색어는 비어 있다.
    jest.mocked(getSavedExpressions).mockClear();
    setSessionUser(signedInUser);
    await rerenderScreen();
    await openTab("저장 표현");

    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(searchInput().props.value).toBe("");
    expect(screen.getByText("6개의 표현")).toBeOnTheScreen();
  });
});

// ---------- 프로필 카드 ----------

describe("[spec] 프로필 카드", () => {
  it("[spec] 이름·이메일과 연속 루프·질문 기록·총 문장 수를 보인다", async () => {
    await renderScreen();

    expect(screen.getByText("학습자")).toBeOnTheScreen();
    expect(screen.getByText("learner@example.com")).toBeOnTheScreen();
    expect(screen.getByText("3")).toBeOnTheScreen();
    expect(screen.getByText("연속 루프")).toBeOnTheScreen();
    expect(screen.getByText("42")).toBeOnTheScreen();
    expect(screen.getByText("질문 기록")).toBeOnTheScreen();
    expect(screen.getByText("1,234")).toBeOnTheScreen();
    expect(screen.getByText("총 문장")).toBeOnTheScreen();
  });

  it("[spec] 오늘 상태를 못 받으면 연속 0, 질문 기록은 받은 기록 수, 총 문장 0을 보인다", async () => {
    jest.mocked(getTodayWritingStatus).mockRejectedValue(new Error("오늘 상태 실패"));
    await renderScreen();

    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getByText("5")).toBeOnTheScreen();
    expect(screen.getByText("5개의 질문")).toBeOnTheScreen();
    expect(screen.queryByText("오늘 상태 실패")).toBeNull();
  });

  it("[spec] 오늘 일기 쓰기를 누르면 일기 쓰기 화면으로 간다", async () => {
    await renderScreen();

    expect(screen.getByText(">")).toBeOnTheScreen();
    await pressText("오늘 일기 쓰기");

    expect(router.push).toHaveBeenCalledWith("/diary/write");
  });
});

// ---------- 탭 줄 ----------

describe("[spec] 탭 줄", () => {
  it("[spec] 네 탭을 영어 답변·영어조각·일기·저장 표현 순서로 보이고, 고른 탭만 선택 모양이다", async () => {
    await renderScreen();

    const labels = ["영어 답변", "영어조각", "일기", "저장 표현"];
    const tabTexts = labels.map((label) => screen.getByText(label));
    const row = tabTexts[0].parent!.parent!;
    expect(row.children.map((child) => (child as TestInstance).children.map((text) => (text as TestInstance).children.join("")).join(""))).toEqual(labels);

    expect(tabTexts[0]).toHaveStyle({ color: "#232128" });
    expect(tabTexts[0].parent).toHaveStyle({ backgroundColor: "#F5A33B", borderColor: "#E49A3B" });
    for (const text of tabTexts.slice(1)) {
      expect(text).toHaveStyle({ color: "#7A6244" });
      expect(text.parent).toHaveStyle({ backgroundColor: "#FFF9F2", borderColor: "#E3D3BF" });
    }
  });

  it("[spec] 탭을 누르면 그 탭 내용으로 바뀌고 선택 모양이 옮겨 간다", async () => {
    await renderScreen();

    await openTab("영어조각");
    expect(screen.getByText("영어조각 기록")).toBeOnTheScreen();
    expect(screen.getByText("영어조각")).toHaveStyle({ color: "#232128" });
    expect(screen.getByText("영어 답변")).toHaveStyle({ color: "#7A6244" });

    await openTab("일기");
    expect(screen.getByText("영어일기 기록")).toBeOnTheScreen();

    await openTab("저장 표현");
    expect(screen.getByText("저장한 표현")).toBeOnTheScreen();

    await openTab("영어 답변");
    expect(screen.getByText("날짜별 기록")).toBeOnTheScreen();
  });
});

// ---------- 작문 기록 탭 ----------

describe("[spec] 작문 기록 탭", () => {
  it("[spec] 머리 문구와 질문 수(오늘 상태의 전체 질문 수), 달력 버튼을 보인다", async () => {
    await renderScreen();

    expect(screen.getByText("날짜별 기록")).toBeOnTheScreen();
    expect(screen.getByText("42개의 질문")).toBeOnTheScreen();
    expect(screen.getByText("달력")).toBeOnTheScreen();
  });

  it("[spec] 불러오는 동안 불러오는 중 카드를 보이고, 받으면 목록으로 바뀐다", async () => {
    const pending = deferred<HistorySession[]>();
    jest.mocked(getAnswerHistory).mockReturnValue(pending.promise);
    await renderScreen();

    expect(screen.getByText("작문 기록을 불러오고 있어요")).toBeOnTheScreen();
    expect(screen.getByText("잠시만 기다려 주세요.")).toBeOnTheScreen();

    await act(async () => {
      pending.resolve(baseHistory);
    });
    await flushAsync();

    expect(screen.queryByText("작문 기록을 불러오고 있어요")).toBeNull();
    expect(screen.getByText(HEADING_1112)).toBeOnTheScreen();
  });

  it("[spec] 기록이 없으면 빈 상태를 보이고, 홈으로 가기는 홈으로 바꿔 간다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue([]);
    await renderScreen();

    expect(screen.getByText("아직 기록이 없어요")).toBeOnTheScreen();
    expect(screen.getByText("오늘의 질문으로 첫 작문을 시작해 보세요.")).toBeOnTheScreen();
    await pressText("홈으로 가기");

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("[spec] 마지막 시도 시각(서울 날짜)으로 날짜 묶음을 만들고 최근 날짜부터 보이며, 첫 묶음만 열려 있다", async () => {
    await renderScreen();

    expect(visibleHeadings()).toEqual([HEADING_1112, HEADING_1111, HEADING_1109]);
    expect(screen.getAllByText("2개 질문")).toHaveLength(2);
    expect(screen.getByText("1개 질문")).toBeOnTheScreen();
    expect(groupToggle(HEADING_1112)).toHaveTextContent("-");
    expect(groupToggle(HEADING_1111)).toHaveTextContent("+");
    expect(groupToggle(HEADING_1109)).toHaveTextContent("+");

    // 열린 묶음 안은 마지막 시도가 늦은 기록부터.
    const questions = screen.getAllByText(/^(What do you do in the morning\?|What did you eat for lunch\?)$/);
    expect(questions.map((node) => node.children.join(""))).toEqual([s1.questionEn, s2.questionEn]);
    expect(screen.queryByText(s3.questionEn)).toBeNull();
  });

  it("[spec] 묶음 머리를 누르면 열고 닫는다", async () => {
    await renderScreen();

    await pressText(HEADING_1111);
    expect(groupToggle(HEADING_1111)).toHaveTextContent("-");
    // 서울 자정을 넘긴 s5는 11-11 묶음에 있고, 마지막 시도가 늦은 s3가 먼저다.
    const questions = screen.getAllByText(/^(Where did you travel last year\?|When do you go to bed\?)$/);
    expect(questions.map((node) => node.children.join(""))).toEqual([s3.questionEn, s5.questionEn]);

    await pressText(HEADING_1112);
    expect(groupToggle(HEADING_1112)).toHaveTextContent("+");
    expect(screen.queryByText(s1.questionEn)).toBeNull();

    await pressText(HEADING_1112);
    expect(groupToggle(HEADING_1112)).toHaveTextContent("-");
    expect(screen.getByText(s1.questionEn)).toBeOnTheScreen();
  });

  it("[spec] 기록 카드에 주제·난이도·마지막 시도 종류·질문(영어·한국어)을 보인다", async () => {
    await renderScreen();

    expect(screen.getByText("Morning")).toBeOnTheScreen();
    expect(screen.getByText("쉬움")).toBeOnTheScreen();
    expect(screen.getByText("다시쓰기")).toBeOnTheScreen();
    expect(screen.getByText(s1.questionKo)).toBeOnTheScreen();
    expect(screen.getByText("Food")).toBeOnTheScreen();
    expect(screen.getByText("보통")).toBeOnTheScreen();
    expect(screen.getByText("첫 답변")).toBeOnTheScreen();
    expect(screen.getByText(s2.questionKo)).toBeOnTheScreen();
  });

  it("[spec] 시도가 없는 기록 카드는 시도 종류 없이 보이고 눌리지 않는다", async () => {
    await renderScreen();
    await pressText(HEADING_1109);

    expect(screen.getByText("Hobby")).toBeOnTheScreen();
    expect(screen.getByText("입문")).toBeOnTheScreen();
    const card = screen.getByText(s4.questionEn);
    expect(card).toBeDisabled();
    expect(within(card.parent!).queryByText(/^(첫 답변|다시쓰기)$/)).toBeNull();

    await press(card);
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 기록 카드를 누르면 기록 상세 모달이 열린다", async () => {
    await renderScreen();

    expect(screen.getByText(s1.questionEn)).not.toBeDisabled();
    await pressText(s1.questionEn);

    const modal = openModal();
    expect(within(modal).getByText("질문 기록")).toBeOnTheScreen();
    expect(within(modal).getByText(s1.questionEn)).toBeOnTheScreen();
  });

  it("[spec] 날짜 묶음이 5개를 넘으면 처음 5개만 보이고, 전체 보기와 최근 기록만 보기로 바꾼다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    await renderScreen();

    expect(visibleHeadings()).toEqual(PAGED_HEADINGS.slice(0, 5));
    expect(screen.getByText("전체 보기 (1일 더)")).toBeOnTheScreen();

    await pressText("전체 보기 (1일 더)");
    expect(visibleHeadings()).toEqual(PAGED_HEADINGS);
    expect(screen.getByText("최근 기록만 보기")).toBeOnTheScreen();

    await pressText("최근 기록만 보기");
    expect(visibleHeadings()).toEqual(PAGED_HEADINGS.slice(0, 5));
  });

  it("[spec] 고른 날짜가 처음 5개 밖이면 그 날짜까지 보이고, 전체 보기에 남은 날 수가 없다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    setParams({ date: "2026-11-07" });
    await renderScreen();

    expect(visibleHeadings()).toEqual(PAGED_HEADINGS);
    expect(screen.getByText("전체 보기")).toBeOnTheScreen();
    expect(groupToggle(PAGED_HEADINGS[5])).toHaveTextContent("-");
    expect(groupToggle(PAGED_HEADINGS[0])).toHaveTextContent("+");
  });

  it("[spec] 받은 기록이 한 페이지(30개)보다 적으면 이전 기록 더 보기가 없다", async () => {
    await renderScreen();

    expect(screen.queryByText("이전 기록 더 보기")).toBeNull();
  });

  it("[spec] 이전 기록 더 보기는 가장 오래된 기록 시각을 기준으로 다음 페이지를 부르고, 부르는 동안 막히며 '불러오는 중'을 보인다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    await renderScreen();

    const button = screen.getByRole("button", { name: "이전 기록 더 보기" });
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });

    const pending = deferred<HistorySession[]>();
    jest.mocked(getAnswerHistory).mockReturnValue(pending.promise);
    await press(button);

    expect(getAnswerHistory).toHaveBeenCalledTimes(2);
    expect(getAnswerHistory).toHaveBeenLastCalledWith({ limit: 30, before: PAGED_OLDEST });
    const busyButton = screen.getByRole("button", { name: "불러오는 중" });
    expect(busyButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(busyButton).toBeDisabled();
    await press(busyButton);
    expect(getAnswerHistory).toHaveBeenCalledTimes(2);

    // 이미 받은 기록(같은 sessionId)은 다시 붙이지 않는다.
    const duplicate = { ...pagedHistory()[0], questionEn: "Duplicated question?" };
    const older = sessionOn("2026-10-01T03:00:00.000Z", "1001");
    await act(async () => {
      pending.resolve([duplicate, older]);
    });
    await flushAsync();

    expect(screen.queryByText("이전 기록 더 보기")).toBeNull();
    expect(screen.queryByText("불러오는 중")).toBeNull();
    expect(screen.queryByText("Duplicated question?")).toBeNull();
    // 더 받은 뒤에는 모든 날짜 묶음을 보인다.
    expect(visibleHeadings()).toEqual([...PAGED_HEADINGS, "2026년 10월 1일 목"]);
    expect(screen.getByText("최근 기록만 보기")).toBeOnTheScreen();
    expect(screen.getAllByText("5개 질문")).toHaveLength(6);
  });

  it("[spec] 다음 페이지도 꽉 차면 이전 기록 더 보기가 남고, 다시 누르면 새 가장 오래된 시각을 기준으로 부른다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    await renderScreen();

    const secondPage = Array.from({ length: 30 }, (_, index) =>
      sessionOn(new Date(Date.UTC(2026, 9, 20, 3, 0) - index * 3600000).toISOString(), `20${index}`)
    );
    jest.mocked(getAnswerHistory).mockResolvedValue(secondPage);
    await pressText("이전 기록 더 보기");
    expect(screen.getByText("이전 기록 더 보기")).toBeOnTheScreen();

    jest.mocked(getAnswerHistory).mockResolvedValue([]);
    await pressText("이전 기록 더 보기");

    expect(getAnswerHistory).toHaveBeenLastCalledWith({ limit: 30, before: "2026-10-18T22:00:00.000Z" });
    expect(screen.queryByText("이전 기록 더 보기")).toBeNull();
  });

  it("[spec] 이전 기록 더 보기가 실패하면 오류 문구를 보이고(기본 문구 포함) 버튼은 남는다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    await renderScreen();

    jest.mocked(getAnswerHistory).mockRejectedValue(new Error("이전 기록 서버 오류"));
    await pressText("이전 기록 더 보기");
    expect(screen.getByText("이전 기록 서버 오류")).toBeOnTheScreen();
    expect(screen.getByText("이전 기록 더 보기")).toBeOnTheScreen();

    jest.mocked(getAnswerHistory).mockRejectedValue("문자열 오류");
    await pressText("이전 기록 더 보기");
    expect(screen.getByText("이전 기록을 불러오지 못했어요.")).toBeOnTheScreen();
  });
});

// ---------- 고른 날짜로 스크롤 ----------

describe("[spec] 고른 날짜로 스크롤", () => {
  it("[spec] 경로 값 date의 묶음 위치가 정해지면 80ms 뒤 그 위치보다 12 위로 한 번 스크롤한다", async () => {
    setParams({ date: "2026-11-11" });
    await renderScreen();
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await layoutGroup(HEADING_1111, 640);
    await advance(79);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    await advance(1);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 628, animated: true });

    // 같은 날짜로는 다시 스크롤하지 않는다.
    await layoutGroup(HEADING_1111, 700);
    await advance(200);
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
  });

  it("[spec] 위치가 12보다 작으면 0으로 스크롤한다", async () => {
    setParams({ date: "2026-11-11" });
    await renderScreen();

    await layoutGroup(HEADING_1111, 5);
    await advance(80);

    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it("[spec] 고르지 않은 묶음이나 닫힌 고른 묶음의 위치가 정해져도 스크롤하지 않는다", async () => {
    setParams({ date: "2026-11-11" });
    await renderScreen();

    await layoutGroup(HEADING_1112, 300);
    await advance(200);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await pressText(HEADING_1111);
    expect(groupToggle(HEADING_1111)).toHaveTextContent("+");
    await layoutGroup(HEADING_1111, 640);
    await advance(200);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
  });

  it("[spec] 위치를 아는 묶음을 달력에서 고르면 80ms 뒤 그 위치로 스크롤한다", async () => {
    await renderScreen();
    await layoutGroup(HEADING_1109, 900);
    await advance(200);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await pressText("달력");
    await press(within(openModal()).getByText("9"));
    await advance(79);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    await advance(1);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 888, animated: true });
  });
});

// ---------- 기록 상세 모달 ----------

describe("[spec] 기록 상세 모달", () => {
  it("[spec] 주제·난이도·마지막 시도 종류·질문과 시도 수를 보이고, 시도를 순서대로 문장·시각·단어 수·피드백과 함께 보인다", async () => {
    await renderScreen();
    await pressText(s1.questionEn);

    const modal = openModal();
    expect(modal.props.animationType).toBe("slide");
    expect(modal.props.transparent).toBeUndefined();
    const inModal = within(modal);
    expect(inModal.getByText("Morning")).toBeOnTheScreen();
    expect(inModal.getByText("쉬움")).toBeOnTheScreen();
    expect(inModal.getByText("다시쓰기")).toBeOnTheScreen();
    expect(inModal.getByText(s1.questionKo)).toBeOnTheScreen();
    expect(inModal.getByText("이 질문에 남긴 답변")).toBeOnTheScreen();
    expect(inModal.getByText("2개 시도")).toBeOnTheScreen();

    const labels = inModal.getAllByText(/^\d차 (초안|다시쓰기)$/).map((node) => node.children.join(""));
    expect(labels).toEqual(["1차 초안", "2차 다시쓰기"]);
    expect(inModal.getAllByText("마지막 답변")).toHaveLength(1);
    expect(inModal.getByText(`${seoulTime("2026-11-10T01:00:00.000Z")} · 3단어`)).toBeOnTheScreen();
    expect(inModal.getByText(`${seoulTime("2026-11-12T02:00:00.000Z")} · 6단어`)).toBeOnTheScreen();
    expect(inModal.getByText("I drink coffee.")).toBeOnTheScreen();
    expect(inModal.getByText("I drink hot coffee every morning.")).toBeOnTheScreen();
    // 그때 화면에 보였던 피드백(VisiblePracticeFeedbackContent)
    expect(inModal.getAllByText("잘한 점")).toHaveLength(2);
    expect(inModal.getByText("커피 이야기를 분명하게 했어요.")).toBeOnTheScreen();
    expect(inModal.getByText("언제 마시는지 더해 보세요.")).toBeOnTheScreen();
    expect(inModal.getByText("왜 마시는지 한 문장 더 써 보세요.")).toBeOnTheScreen();
    expect(inModal.getByText("이어서 다시 쓰기")).toBeOnTheScreen();
  });

  it("[spec] 시도는 시도 번호 순으로 보이고, '마지막 답변'은 받은 목록의 마지막 시도에 붙는다", async () => {
    const reordered = historySession({
      sessionId: "session-r",
      promptId: "prompt-r",
      topic: "Order",
      questionEn: "Reordered question?",
      attempts: [
        attempt({ id: 92, attemptNo: 2, attemptType: "REWRITE", answerText: "Second answer.", createdAt: "2026-11-12T01:00:00.000Z" }),
        attempt({ id: 91, attemptNo: 1, attemptType: "INITIAL", answerText: "First answer.", createdAt: "2026-11-12T00:00:00.000Z" })
      ]
    });
    jest.mocked(getAnswerHistory).mockResolvedValue([reordered]);
    await renderScreen();
    expect(screen.getByText("첫 답변")).toBeOnTheScreen();
    await pressText("Reordered question?");

    const inModal = within(openModal());
    const labels = inModal.getAllByText(/^(\d차 (초안|다시쓰기)|마지막 답변)$/).map((node) => node.children.join(""));
    expect(labels).toEqual(["1차 초안", "마지막 답변", "2차 다시쓰기"]);
    expect(inModal.getByText("첫 답변")).toBeOnTheScreen();
  });

  it("[spec] 닫기 버튼과 닫기 요청으로 닫힌다", async () => {
    await renderScreen();
    await pressText(s1.questionEn);
    await press(within(openModal()).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);

    await pressText(s1.questionEn);
    await act(async () => {
      openModal().props.onRequestClose();
    });
    await flushAsync();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 진행 중 기록의 '이어서 다시 쓰기'는 마지막 시도로 피드백 상태를 저장하고 닫은 뒤 피드백 화면으로 간다", async () => {
    await renderScreen();
    await pressText(s1.questionEn);

    await press(within(openModal()).getByText("이어서 다시 쓰기"));

    expect(savePracticeFeedbackState).toHaveBeenCalledTimes(1);
    expect(savePracticeFeedbackState).toHaveBeenCalledWith({
      difficulty: "A",
      prompt: {
        id: "prompt-1",
        topic: "Morning",
        topicCategory: "",
        topicDetail: "",
        difficulty: "A",
        questionEn: s1.questionEn,
        questionKo: s1.questionKo,
        tip: ""
      },
      answer: "I drink hot coffee every morning.",
      feedback: {
        promptId: "prompt-1",
        sessionId: "session-1",
        attemptNo: 2,
        loopComplete: false,
        completionMessage: null,
        summary: "다시 쓴 답 요약",
        strengths: ["문장이 자세해졌어요."],
        inlineFeedback: null,
        revisedAnswer: null,
        refinementExpressions: [{ expression: "start my day", meaningKo: "하루를 시작하다" }],
        modelAnswer: "I drink hot coffee every morning because it wakes me up.",
        modelAnswerKo: "아침마다 잠을 깨려고 뜨거운 커피를 마셔요.",
        rewriteChallenge: "왜 마시는지 한 문장 더 써 보세요.",
        ui: null,
        loop: { status: "NEEDS_REWRITE", nextAction: "rewrite", nextActionLabel: "다시 써보기" },
        coachMove: s1LatestFeedback.coachMove,
        completion: null,
        visibleFeedback: s1LatestFeedback
      }
    });
    expect(modalHosts()).toHaveLength(0);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/feedback",
      params: { difficulty: "A", promptId: "prompt-1" }
    });
  });

  it("[spec] 마칠 준비 기록은 '완료 화면으로 이어가기'로 마칠 준비 상태의 피드백을 만들어 간다", async () => {
    await renderScreen();
    await pressText(s2.questionEn);

    await press(within(openModal()).getByText("완료 화면으로 이어가기"));

    expect(savePracticeFeedbackState).toHaveBeenCalledWith({
      difficulty: "B",
      prompt: {
        id: "prompt-2",
        topic: "Food",
        topicCategory: "",
        topicDetail: "",
        difficulty: "B",
        questionEn: s2.questionEn,
        questionKo: s2.questionKo,
        tip: ""
      },
      answer: "I ate kimchi stew.",
      feedback: {
        promptId: "prompt-2",
        sessionId: "session-2",
        attemptNo: 1,
        loopComplete: true,
        completionMessage: "점심 이야기를 잘 마쳤어요.",
        summary: "점심 요약",
        strengths: ["질문에 맞게 답했어요."],
        inlineFeedback: null,
        revisedAnswer: null,
        refinementExpressions: [],
        modelAnswer: "I ate kimchi stew for lunch.",
        modelAnswerKo: null,
        rewriteChallenge: "마무리 문장",
        ui: null,
        loop: { status: "READY_TO_FINISH", nextAction: "finish", nextActionLabel: "루프 완료하기" },
        coachMove: { focus: "마무리 문장" },
        completion: { headline: "점심 이야기를 잘 마쳤어요." },
        visibleFeedback: s2Feedback
      }
    });
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/feedback",
      params: { difficulty: "B", promptId: "prompt-2" }
    });
  });

  it("[spec] 완료한 기록과 마지막 시도에 피드백 스냅샷이 없는 기록은 이어 쓰기 버튼이 없다", async () => {
    await renderScreen();
    await pressText(HEADING_1111);

    await pressText(s3.questionEn);
    let inModal = within(openModal());
    expect(inModal.getByText("도전")).toBeOnTheScreen();
    expect(inModal.queryByText("이어서 다시 쓰기")).toBeNull();
    expect(inModal.queryByText("완료 화면으로 이어가기")).toBeNull();
    await press(inModal.getByText("닫기"));

    await pressText(s5.questionEn);
    inModal = within(openModal());
    expect(inModal.getByText("이전 형식의 피드백이라 당시 화면에 보였던 내용을 정확히 복원할 수 없어요.")).toBeOnTheScreen();
    expect(inModal.queryByText("이어서 다시 쓰기")).toBeNull();
    expect(inModal.getByText(`${seoulTime("2026-11-10T15:30:00.000Z")} · 6단어`)).toBeOnTheScreen();
  });
});

// ---------- 영어일기 탭 ----------

describe("[spec] 영어일기 탭", () => {
  it("[spec] 고정 안내를 보이고 일기 기록 보기는 일기 목록, 오늘 일기 쓰기는 일기 쓰기로 간다", async () => {
    await renderScreen();
    await openTab("일기");

    expect(screen.getByText("영어일기 기록")).toBeOnTheScreen();
    expect(screen.getByText("일기는 날짜별 달력에서 이어서 볼 수 있어요.")).toBeOnTheScreen();
    expect(screen.getByText("일기 기록은 일기 달력에 모아둘게요")).toBeOnTheScreen();
    expect(screen.getByText("긴 글은 일기 화면에서 종이 노트처럼 읽고, 날짜별로 다시 열어볼 수 있어요.")).toBeOnTheScreen();

    await pressText("일기 기록 보기");
    expect(router.push).toHaveBeenLastCalledWith("/diary");

    // 프로필 카드의 "오늘 일기 쓰기"가 먼저(0), 탭 안의 버튼이 다음(1)이다.
    expect(screen.getAllByText("오늘 일기 쓰기")).toHaveLength(2);
    await pressText("오늘 일기 쓰기", 1);
    expect(router.push).toHaveBeenLastCalledWith("/diary/write");
  });
});

// ---------- Now in English 탭 ----------

describe("[spec] Now in English 탭", () => {
  it("[spec] 불러오는 동안 불러오는 중 카드를 보인다", async () => {
    jest.mocked(getNowInEnglishSummary).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    await openTab("영어조각");

    expect(screen.getByText("영어조각 기록을 불러오고 있어요")).toBeOnTheScreen();
    expect(screen.getByText("잠시만 기다려 주세요.")).toBeOnTheScreen();
    expect(screen.getByText("0개의 한 줄")).toBeOnTheScreen();
  });

  it("[spec] 날짜별로 최근 날짜부터 묶고(오늘·어제·그 밖은 날짜), 묶음 안은 늦은 시각부터 시각과 문장을 보인다", async () => {
    await renderScreen();
    await openTab("영어조각");

    expect(screen.getByText("4개의 한 줄")).toBeOnTheScreen();
    const groupTitles = screen.getAllByText(/^(오늘|어제|2026년 11월 5일 목요일)$/).map((node) => node.children.join(""));
    expect(groupTitles).toEqual(["오늘", "어제", "2026년 11월 5일 목요일"]);
    expect(screen.getByText("2개 한 줄")).toBeOnTheScreen();
    expect(screen.getAllByText("1개 한 줄")).toHaveLength(2);
    const texts = screen.getAllByText(/^I am /).map((node) => node.children.join(""));
    expect(texts).toEqual(["I am reading a book.", "I am having lunch.", "I am tired.", "I am cooking."]);
    for (const entry of nowEntries) {
      expect(screen.getByText(deviceTime(entry.createdAt))).toBeOnTheScreen();
    }
    // 머리의 "지금 쓰기"는 Now in English 화면으로 간다.
    await pressText("지금 쓰기");
    expect(router.push).toHaveBeenCalledWith("/now");
  });

  it("[spec] 기록이 없으면 빈 상태를 보이고 지금 쓰기는 Now in English 화면으로 간다", async () => {
    jest.mocked(getNowInEnglishSummary).mockResolvedValue(nowSummary([]));
    await renderScreen();
    await openTab("영어조각");

    expect(screen.getByText("아직 남긴 영어조각이 없어요")).toBeOnTheScreen();
    expect(screen.getByText("지금 하고 있는 일이나 떠오른 생각을 한 줄로 먼저 남겨보세요.")).toBeOnTheScreen();
    expect(screen.getAllByText("지금 쓰기")).toHaveLength(2);
    await pressText("지금 쓰기", 1);

    expect(router.push).toHaveBeenCalledWith("/now");
  });
});

// ---------- 저장 표현 탭 ----------

describe("[spec] 저장 표현 탭", () => {
  it("[spec] 머리 문구와 표현 수를 보이고, 표현을 최근 저장 순서로 보인다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    expect(screen.getByText("저장한 표현")).toBeOnTheScreen();
    expect(screen.getByText("6개의 표현")).toBeOnTheScreen();
    expect(expressionOrder()).toEqual([
      "on the way to",
      "grab a coffee",
      "stay up late",
      "Feel Refreshed",
      "wake up early",
      "by the way"
    ]);
    expect(searchInput().props.value).toBe("");
  });

  it("[spec] 불러오는 동안 불러오는 중 카드를 보이고 검색 칸은 없다", async () => {
    jest.mocked(getSavedExpressions).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    await openTab("저장 표현");

    expect(screen.getByText("표현 목록을 불러오고 있어요")).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull();
    expect(screen.getByText("0개의 표현")).toBeOnTheScreen();
  });

  it("[spec] 저장한 표현이 없으면 빈 상태를 보이고 질문 풀러 가기는 홈으로 바꿔 간다", async () => {
    jest.mocked(getSavedExpressions).mockResolvedValue([]);
    await renderScreen();
    await openTab("저장 표현");

    expect(screen.getByText("아직 저장한 표현이 없어요")).toBeOnTheScreen();
    expect(screen.getByText("피드백 화면이나 AI 코치 추천 카드에서 마음에 드는 표현을 저장해 보세요.")).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull();
    await pressText("질문 풀러 가기");

    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("[spec] 검색은 앞뒤 공백을 빼고 대소문자를 가리지 않으며, 결과 수 요약과 검색 문구를 보인다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    await typeSearch("  COFFEE ");

    expect(expressionOrder()).toEqual(["grab a coffee"]);
    expect(screen.getByText("1개 결과 · 전체 6개")).toBeOnTheScreen();
    expect(screen.getByText('"COFFEE" 검색')).toBeOnTheScreen();
    expect(screen.getByText("초기화")).toBeOnTheScreen();
    expect(screen.queryByText(TAG_PRACTICE_TEXT)).toBeNull();
  });

  it("[spec] 검색은 뜻·예문·질문·주제·출처 이름·태그 이름에서도 찾는다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    await typeSearch("morning");
    expect(expressionOrder()).toEqual(["grab a coffee", "Feel Refreshed", "wake up early"]);

    await typeSearch("감정");
    expect(expressionOrder()).toEqual(["Feel Refreshed"]);

    await typeSearch("ai 코치");
    expect(expressionOrder()).toEqual(["on the way to"]);

    await typeSearch("일찍");
    expect(expressionOrder()).toEqual(["wake up early"]);

    await typeSearch("diary_expression");
    expect(expressionOrder()).toEqual(["stay up late", "by the way"]);

    await typeSearch("rainy");
    expect(expressionOrder()).toEqual(["by the way"]);
  });

  it("[spec] 검색 결과가 없으면 안내를 보이고, 검색 초기화로 검색어를 비운다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    await typeSearch("zzz");
    expect(screen.getByText("검색 결과가 없어요")).toBeOnTheScreen();
    expect(screen.getByText("다른 검색어로 다시 찾아보거나 태그 정렬을 초기화해 보세요.")).toBeOnTheScreen();
    expect(screen.getByText("0개 결과 · 전체 6개")).toBeOnTheScreen();

    await pressText("검색 초기화");
    expect(searchInput().props.value).toBe("");
    expect(screen.getByText("6개의 표현")).toBeOnTheScreen();
    expect(expressionOrder()).toHaveLength(6);
  });

  it("[spec] 태그 칩은 출처 태그를 빼고 다른 출처 태그는 포함해 개수 많은 순·이름 순(ko 정렬: 한글 다음 영문)으로 개수와 함께 보인다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    expect(filterChipTexts()).toEqual([
      "동사 표현",
      "3",
      "감정 표현",
      "1",
      "내가 쓴 표현",
      "1",
      "여행",
      "1",
      "일상 루틴",
      "1",
      "custom tag",
      "1"
    ]);
  });

  it("[spec] 태그 칩을 누르면 그 태그 표현을 위로 올리고 요약을 보이며, 다시 누르면 해제한다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    await pressText("동사 표현", 0);

    expect(expressionOrder()).toEqual([
      "on the way to",
      "grab a coffee",
      "wake up early",
      "stay up late",
      "Feel Refreshed",
      "by the way"
    ]);
    expect(screen.getByText("동사 표현 상단 우선 정렬")).toBeOnTheScreen();
    expect(screen.getByText("6개 결과 · 전체 6개")).toBeOnTheScreen();
    const filterChipLabel = screen.getAllByText("동사 표현")[0];
    expect(filterChipLabel).toHaveStyle({ color: "#232128" });
    expect(filterChipLabel.parent).toHaveStyle({ backgroundColor: "#F5A33B", borderColor: "#E49A3B" });
    // 카드의 같은 태그 칩도 선택 모양이다.
    expect(screen.getAllByText("동사 표현")[1]).toHaveStyle({ color: "#A76518" });
    expect(screen.getByText(TAG_PRACTICE_TEXT)).toBeOnTheScreen();

    await pressText("동사 표현", 0);
    expect(screen.queryByText("동사 표현 상단 우선 정렬")).toBeNull();
    expect(screen.getByText("6개의 표현")).toBeOnTheScreen();
    expect(screen.getAllByText("동사 표현")[0]).toHaveStyle({ color: "#7A6244" });
  });

  it("[spec] 검색과 태그를 함께 쓰면 요약을 ' · '로 잇고, 초기화로 둘 다 비운다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    await typeSearch(" MORNING ");
    await pressText("동사 표현", 0);

    expect(screen.getByText('"MORNING" 검색 · 동사 표현 상단 우선 정렬')).toBeOnTheScreen();
    expect(screen.getByText("3개 결과 · 전체 6개")).toBeOnTheScreen();
    expect(expressionOrder()).toEqual(["grab a coffee", "wake up early", "Feel Refreshed"]);

    await pressText("초기화");
    expect(searchInput().props.value).toBe("");
    expect(screen.getByText("6개의 표현")).toBeOnTheScreen();
    expect(screen.queryByText(TAG_PRACTICE_TEXT)).toBeNull();
  });

  it("[spec] 태그 연습은 고른 태그로 연습할 수 있는 첫 표현(끝이 약한 단어면 건너뜀)과 같은 질문 표현을 모아 작문 화면으로 간다", async () => {
    await renderScreen();
    await openTab("저장 표현");
    await pressText("동사 표현", 0);

    await pressText(TAG_PRACTICE_TEXT);

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/write",
      params: {
        difficulty: "A",
        promptId: "prompt-1",
        prefillExpression: "grab a coffee",
        practiceTag: "verb_phrase",
        practiceTagLabel: "동사 표현",
        practiceExpressions: JSON.stringify(["grab a coffee", "wake up early"])
      }
    });
  });

  it("[spec] 카드의 태그 칩으로 고르면 그 카드 표현을 먼저 연습한다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    // 동사 표현 칩: 0 위 줄, 1 e2, 2 e1, 3 e5
    await pressText("동사 표현", 3);
    expect(screen.getByText("동사 표현 상단 우선 정렬")).toBeOnTheScreen();
    await pressText(TAG_PRACTICE_TEXT);

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/write",
      params: {
        difficulty: "A",
        promptId: "prompt-1",
        prefillExpression: "wake up early",
        practiceTag: "verb_phrase",
        practiceTagLabel: "동사 표현",
        practiceExpressions: JSON.stringify(["wake up early", "grab a coffee"])
      }
    });
  });

  it("[spec] 연습할 표현이 없는 태그는 태그 연습이 막힌 모양이고 눌러도 아무 일이 없다", async () => {
    await renderScreen();
    await openTab("저장 표현");
    await pressText("여행", 0);

    const link = screen.getByText(TAG_PRACTICE_TEXT);
    expect(link).toBeDisabled();
    expect(link).toHaveStyle({ color: "#B3A08B", textDecorationLine: "none" });
    await press(link);

    expect(router.push).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("[spec] 고른 태그가 목록에서 사라지면 태그 고르기를 해제한다", async () => {
    await renderScreen();
    await openTab("저장 표현");
    await pressText("custom tag", 0);
    expect(screen.getByText("custom tag 상단 우선 정렬")).toBeOnTheScreen();

    // 태그를 고르면 e4가 맨 위로 올라가 e4의 삭제 버튼이 첫째다.
    expect(expressionOrder()[0]).toBe("Feel Refreshed");
    await press(deleteButtons()[0]);
    await pressAlertButton("삭제");

    expect(deleteSavedExpression).toHaveBeenCalledWith(4);
    expect(screen.queryByText("custom tag 상단 우선 정렬")).toBeNull();
    expect(screen.queryByText("custom tag")).toBeNull();
    expect(screen.getByText("5개의 표현")).toBeOnTheScreen();
  });

  it("[spec] 표현 카드에 태그(출처 태그 뺌)·저장 횟수·표현·저장 날짜·뜻·예문을 보이고 예문 속 표현을 강조한다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    expect(screen.getByText("2번 저장")).toBeOnTheScreen();
    expect(screen.getAllByText(/번 저장$/)).toHaveLength(1);
    expect(screen.getByText("커피 한잔하다")).toBeOnTheScreen();
    expect(screen.getByText("~로 가는 길에")).toBeOnTheScreen();
    expect(screen.getByText(savedDate(e1.lastSavedAt))).toBeOnTheScreen();
    expect(screen.getByText(savedDate(e2.lastSavedAt))).toBeOnTheScreen();

    // 대소문자를 가리지 않고 예문 안의 표현을 굵게 보인다.
    const highlight = screen.getByText("On the way to");
    expect(highlight).toHaveStyle({ fontWeight: "900", color: "#866F56" });
    expect(screen.getByText("On the way to work, I listen to music.")).toHaveStyle({ fontSize: 13, color: "#866F56" });
    expect(screen.getByText("feel refreshed")).toHaveStyle({ fontWeight: "900" });
    expect(screen.getByText("By the way")).toHaveStyle({ fontWeight: "900" });
    // 표현이 없는 예문은 강조 없이 그대로.
    expect(screen.getByText("I usually get up at six.")).toHaveStyle({ fontSize: 13 });

    // e4 카드 태그: 감정 표현, custom tag, 내가 쓴 표현(다른 출처 태그)
    expect(screen.getAllByText("감정 표현")).toHaveLength(2);
    expect(screen.getAllByText("내가 쓴 표현")).toHaveLength(2);
    expect(screen.getAllByText("custom tag")).toHaveLength(2);
    // e1 카드: 자기 출처 태그(내가 쓴 표현)는 빼고 동사 표현·일상 루틴
    expect(screen.getAllByText("일상 루틴")).toHaveLength(2);
  });

  it("[spec] 질문 보기/숨기기: 누르면 저장한 질문(영어 → 한국어 → 주제 순)과 기록 보기 버튼을 보이고, 다시 누르면 숨긴다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    expect(screen.getAllByText(PROMPT_OPEN_TEXT)).toHaveLength(5);
    expect(screen.queryByText(HISTORY_LINK_TEXT)).toBeNull();

    // e2: 한국어 질문
    await pressText(PROMPT_OPEN_TEXT, 0);
    expect(screen.getByText("질문 숨기기")).toBeOnTheScreen();
    expect(screen.getByText("출근길에 무엇을 하나요?")).toBeOnTheScreen();
    expect(screen.getByText(HISTORY_LINK_TEXT)).toBeOnTheScreen();

    // e4(목록에서 셋째 링크): 주제
    await pressText(PROMPT_OPEN_TEXT, 1);
    expect(screen.getAllByText("질문 숨기기")).toHaveLength(2);
    expect(screen.getByText("Morning")).toBeOnTheScreen();

    await pressText("질문 숨기기", 0);
    expect(screen.queryByText("출근길에 무엇을 하나요?")).toBeNull();
    expect(screen.getAllByText("질문 숨기기")).toHaveLength(1);
  });

  it("[spec] 기록 보기는 연결된 작문 기록을 찾아 작문 기록 탭으로 바꾸고, 그 날짜 묶음을 열고 상세 모달을 연다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    // e2는 promptId(prompt-3)로 s3(11-11)와 이어진다.
    await pressText(PROMPT_OPEN_TEXT, 0);
    const link = screen.getByText(HISTORY_LINK_TEXT);
    expect(link).not.toBeDisabled();
    await press(link);

    const modal = openModal();
    expect(within(modal).getByText(s3.questionEn)).toBeOnTheScreen();
    await press(within(modal).getByText("닫기"));

    expect(screen.getByText("날짜별 기록")).toBeOnTheScreen();
    expect(screen.getByText("영어 답변")).toHaveStyle({ color: "#232128" });
    expect(groupToggle(HEADING_1111)).toHaveTextContent("-");
    expect(groupToggle(HEADING_1112)).toHaveTextContent("-");
    expect(groupToggle(HEADING_1109)).toHaveTextContent("+");
  });

  it("[spec] 연결된 작문 기록이 없으면 기록 보기 버튼이 막힌 모양이다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    // e6: 질문만 있고 기록이 없다(링크 다섯째).
    await pressText(PROMPT_OPEN_TEXT, 4);
    expect(screen.getByText("Why do you like rainy days?")).toBeOnTheScreen();
    const link = screen.getByText(HISTORY_LINK_TEXT);
    expect(link).toBeDisabled();
    expect(link).toHaveStyle({ color: "#B2A08B" });
    expect(link.parent).toHaveStyle({ backgroundColor: "#F6F1EB", borderColor: "#E7DDD2" });

    await press(link);
    expect(modalHosts()).toHaveLength(0);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("[spec] 연습하기 버튼: 질문 문구가 있는 카드는 숨긴 버튼과 줄 안 버튼, 질문 문구가 없는 카드는 보이는 버튼 하나, 연습 대상이 없으면 없음", async () => {
    await renderScreen();
    await openTab("저장 표현");

    const buttons = practiceButtons();
    expect(buttons).toHaveLength(9);
    // 질문 문구가 있는 카드의 첫 버튼은 display: none
    for (const index of [0, 2, 5, 7]) {
      expect(buttons[index].parent).toHaveStyle({ display: "none" });
    }
    for (const index of [1, 3, 4, 6, 8]) {
      expect(buttons[index].parent).not.toHaveStyle({ display: "none" });
    }
  });

  it("[spec] 연습하기를 누르면 표현의 질문(없으면 연결된 기록의 질문·난이도)으로 작문 화면에 표현을 채워 간다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    // e1 줄 안 버튼
    await press(practiceButtons()[3]);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/practice/write",
      params: { difficulty: "A", promptId: "prompt-1", prefillExpression: "grab a coffee" }
    });

    // e3: 질문 문구 없음, 난이도는 연결된 기록(s3, C)
    await press(practiceButtons()[4]);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/practice/write",
      params: { difficulty: "C", promptId: "prompt-3", prefillExpression: "stay up late" }
    });

    // e4: promptId가 비어 주제(Morning)로 s1과 이어진다
    await press(practiceButtons()[6]);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/practice/write",
      params: { difficulty: "A", promptId: "prompt-1", prefillExpression: "Feel Refreshed" }
    });

    // e2: 표현의 질문 정보(prompt-3, B)를 연결된 기록보다 먼저 쓴다
    await press(practiceButtons()[1]);
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/practice/write",
      params: { difficulty: "B", promptId: "prompt-3", prefillExpression: "on the way to" }
    });
  });

  it("[spec] 삭제는 확인 창을 띄우고, 취소하면 아무 일이 없다", async () => {
    await renderScreen();
    await openTab("저장 표현");

    expect(deleteButtons()).toHaveLength(6);
    const icon = deleteButtons()[1];
    expect(icon.props).toMatchObject({ size: 16, weight: "semibold", tintColor: "#B95A36", type: "hierarchical" });
    await press(icon);

    expect(lastAlert().title).toBe("저장한 표현을 삭제할까요?");
    expect(lastAlert().message).toBe("삭제하면 이 표현은 저장 목록에서 사라져요.");
    expect(lastAlert().buttons!.map(({ text, style }) => ({ text, style }))).toEqual([
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive" }
    ]);

    await pressAlertButton("취소");
    expect(deleteSavedExpression).not.toHaveBeenCalled();
    expect(expressionOrder()).toHaveLength(6);
  });

  it("[spec] 삭제를 고르면 그 카드에 삭제 중 표시를 보이고 막은 뒤, 끝나면 목록에서 뺀다", async () => {
    const pending = deferred<void>();
    jest.mocked(deleteSavedExpression).mockReturnValue(pending.promise);
    await renderScreen();
    await openTab("저장 표현");

    await press(deleteButtons()[1]);
    await pressAlertButton("삭제");

    expect(deleteSavedExpression).toHaveBeenCalledWith(1);
    const deleting = spinners().filter((node) => node.props.color === "#A3371A");
    expect(deleting).toHaveLength(1);
    expect(deleting[0].props.size).toBe("small");
    expect(deleteButtons()).toHaveLength(5);

    await act(async () => {
      pending.resolve();
    });
    await flushAsync();

    expect(spinners().filter((node) => node.props.color === "#A3371A")).toHaveLength(0);
    expect(expressionOrder()).toEqual(["on the way to", "stay up late", "Feel Refreshed", "wake up early", "by the way"]);
    expect(screen.getByText("5개의 표현")).toBeOnTheScreen();
  });

  it("[spec] 삭제가 실패하면 실패 창(기본 문구 포함)을 띄우고 카드는 남는다", async () => {
    jest.mocked(deleteSavedExpression).mockRejectedValue(new Error("삭제 서버 오류"));
    await renderScreen();
    await openTab("저장 표현");

    await press(deleteButtons()[0]);
    await pressAlertButton("삭제");
    expect(alertSpy).toHaveBeenLastCalledWith("삭제에 실패했어요", "삭제 서버 오류");
    expect(expressionOrder()).toHaveLength(6);
    expect(deleteButtons()).toHaveLength(6);

    jest.mocked(deleteSavedExpression).mockRejectedValue("문자열 오류");
    await press(deleteButtons()[0]);
    await pressAlertButton("삭제");
    expect(alertSpy).toHaveBeenLastCalledWith("삭제에 실패했어요", "잠시 후 다시 시도해 주세요.");
  });
});

// ---------- 오류 문구 ----------

describe("[spec] 오류 문구", () => {
  it("[spec] 작문 기록 오류는 작문 기록 탭에만 보인다", async () => {
    jest.mocked(getAnswerHistory).mockRejectedValue(new Error("기록 서버 오류"));
    await renderScreen();

    expect(screen.getByText("기록 서버 오류")).toHaveStyle({ fontSize: 14, lineHeight: 20, color: "#B34A2B" });
    expect(screen.getByText("아직 기록이 없어요")).toBeOnTheScreen();
    await openTab("저장 표현");
    expect(screen.queryByText("기록 서버 오류")).toBeNull();
    await openTab("영어조각");
    expect(screen.queryByText("기록 서버 오류")).toBeNull();
  });

  it("[spec] 작문 기록 오류가 Error가 아니면 기본 문구를 보인다", async () => {
    jest.mocked(getAnswerHistory).mockRejectedValue({ reason: "알 수 없음" });
    await renderScreen();
    expect(screen.getByText("작문 기록을 불러오지 못했어요.")).toBeOnTheScreen();
  });

  it("[spec] 저장 표현 오류는 저장 표현 탭에만 보인다", async () => {
    jest.mocked(getSavedExpressions).mockRejectedValue(new Error("표현 서버 오류"));
    await renderScreen();

    expect(screen.queryByText("표현 서버 오류")).toBeNull();
    await openTab("저장 표현");
    expect(screen.getByText("표현 서버 오류")).toBeOnTheScreen();
    expect(screen.getByText("아직 저장한 표현이 없어요")).toBeOnTheScreen();
  });

  it("[spec] 저장 표현 오류가 Error가 아니면 기본 문구를 보인다", async () => {
    jest.mocked(getSavedExpressions).mockRejectedValue("문자열 오류");
    setParams({ tab: "expressions" });
    await renderScreen();
    expect(screen.getByText("저장한 표현을 불러오지 못했어요.")).toBeOnTheScreen();
  });

  it("[spec] Now in English 오류는 영어조각 탭에만 보인다", async () => {
    jest.mocked(getNowInEnglishSummary).mockRejectedValue(new Error("영어조각 서버 오류"));
    await renderScreen();

    expect(screen.queryByText("영어조각 서버 오류")).toBeNull();
    await openTab("영어조각");
    expect(screen.getByText("영어조각 서버 오류")).toBeOnTheScreen();
    expect(screen.getByText("아직 남긴 영어조각이 없어요")).toBeOnTheScreen();
  });

  it("[spec] Now in English 오류가 Error가 아니면 기본 문구를 보인다", async () => {
    jest.mocked(getNowInEnglishSummary).mockRejectedValue("문자열 오류");
    setParams({ tab: "now" });
    await renderScreen();
    expect(screen.getByText("영어조각 기록을 불러오지 못했어요.")).toBeOnTheScreen();
  });
});

// ---------- 월 달력 모달 ----------

describe("[spec] 월 달력 모달", () => {
  it("[spec] 달력 버튼을 누르면 첫 묶음의 달을 열고, 요일 머리·칸 35개·안내 문구를 보인다", async () => {
    await renderScreen();
    await pressText("달력");

    const modal = openModal();
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe("fade");
    const inModal = within(modal);
    expect(inModal.getByText("2026년 11월")).toBeOnTheScreen();
    for (const label of ["일", "월", "화", "수", "목", "금", "토"]) {
      expect(inModal.getByText(label)).toBeOnTheScreen();
    }
    const cells = inModal.getAllByText(/^\d{1,2}$/).map((node) => node.children.join(""));
    expect(cells).toEqual([...Array.from({ length: 30 }, (_, index) => `${index + 1}`), "1", "2", "3", "4", "5"]);
    expect(inModal.getByText("기록이 있는 날짜만 바로 이동할 수 있어요.")).toBeOnTheScreen();
  });

  it("[spec] 기록이 한 달뿐이면 이전·다음 달 버튼이 모두 막혀 있다", async () => {
    await renderScreen();
    await pressText("달력");

    const inModal = within(openModal());
    expect(inModal.getByText("<")).toBeDisabled();
    expect(inModal.getByText(">")).toBeDisabled();
    expect(inModal.getByText("<")).toHaveStyle({ color: "#A99987" });
    expect(inModal.getByText("<").parent).toHaveStyle({ opacity: 0.35 });
  });

  it("[spec] 기록 있는 날은 눌리는 모양, 없는 날과 다른 달 칸은 막혀 있다", async () => {
    await renderScreen();
    await pressText("달력");

    const inModal = within(openModal());
    for (const day of ["12", "11", "9"]) {
      expect(inModal.getByText(day)).not.toBeDisabled();
      expect(inModal.getByText(day)).toHaveStyle({ color: "#8A5A1E" });
      expect(inModal.getByText(day).parent).toHaveStyle({ backgroundColor: "#FFF1D7", borderColor: "#EACFA9" });
    }
    expect(inModal.getByText("10")).toBeDisabled();
    expect(inModal.getByText("10")).toHaveStyle({ color: "#6E573A" });
    const outside = inModal.getAllByText("1")[1];
    expect(outside).toBeDisabled();
    expect(outside).toHaveStyle({ color: "#BCA98B" });
    expect(outside.parent).toHaveStyle({ opacity: 0.42 });
  });

  it("[spec] 날짜를 누르면 닫고 그 날짜를 골라 묶음을 열며, 다시 열면 고른 날짜를 선택 모양으로 보인다", async () => {
    await renderScreen();
    await pressText("달력");

    await press(within(openModal()).getByText("11"));

    expect(modalHosts()).toHaveLength(0);
    expect(groupToggle(HEADING_1111)).toHaveTextContent("-");
    expect(groupToggle(HEADING_1112)).toHaveTextContent("-");
    expect(screen.getByText(s3.questionEn)).toBeOnTheScreen();

    await pressText("달력");
    const selected = within(openModal()).getByText("11");
    expect(selected).toHaveStyle({ color: "#2E2416" });
    expect(selected.parent).toHaveStyle({ backgroundColor: "#F2A14A", borderColor: "#E09128" });
  });

  it("[spec] 기록 없는 날은 눌러도 닫히지 않는다", async () => {
    await renderScreen();
    await pressText("달력");

    await press(within(openModal()).getByText("10"));

    expect(modalHosts()).toHaveLength(1);
  });

  it("[spec] 이전·다음 달은 기록이 있는 가장 이른 달과 가장 늦은 달 사이에서만 움직인다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(calendarHistory);
    await renderScreen();
    await pressText("달력");

    let inModal = within(openModal());
    expect(inModal.getByText("2026년 11월")).toBeOnTheScreen();
    expect(inModal.getByText(">")).toBeDisabled();
    expect(inModal.getByText("<")).not.toBeDisabled();
    expect(inModal.getByText("<")).toHaveStyle({ color: "#7A6244" });

    await press(inModal.getByText("<"));
    inModal = within(openModal());
    expect(inModal.getByText("2026년 10월")).toBeOnTheScreen();
    expect(inModal.getByText(">")).not.toBeDisabled();
    expect(inModal.getByText("<")).not.toBeDisabled();
    // 10월: 9/27 ~ 10/31
    expect(inModal.getAllByText(/^\d{1,2}$/)).toHaveLength(35);
    expect(inModal.getByText("20")).toHaveStyle({ color: "#8A5A1E" });

    await press(inModal.getByText("<"));
    inModal = within(openModal());
    expect(inModal.getByText("2026년 9월")).toBeOnTheScreen();
    expect(inModal.getByText("<")).toBeDisabled();
    expect(inModal.getAllByText("5")[0]).toHaveStyle({ color: "#8A5A1E" });

    await press(inModal.getByText(">"));
    expect(within(openModal()).getByText("2026년 10월")).toBeOnTheScreen();
  });

  it("[spec] 다른 달의 날짜를 고른 뒤 다시 열면 그 달로 열린다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(calendarHistory);
    await renderScreen();
    await pressText("달력");
    await press(within(openModal()).getByText("<"));

    await press(within(openModal()).getByText("20"));
    expect(modalHosts()).toHaveLength(0);
    expect(groupToggle("2026년 10월 20일 화")).toHaveTextContent("-");
    expect(screen.getByText("Question on 1020?")).toBeOnTheScreen();

    await pressText("달력");
    expect(within(openModal()).getByText("2026년 10월")).toBeOnTheScreen();
    expect(within(openModal()).getByText("20")).toHaveStyle({ color: "#2E2416" });
  });

  it("[spec] 기록이 없으면 이번 달로 열고 모든 칸과 이전·다음 달 버튼이 막혀 있다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue([]);
    await renderScreen();
    await pressText("달력");

    const inModal = within(openModal());
    expect(inModal.getByText("2026년 11월")).toBeOnTheScreen();
    expect(inModal.getByText("<")).toBeDisabled();
    expect(inModal.getByText(">")).toBeDisabled();
    for (const cell of inModal.getAllByText(/^\d{1,2}$/)) {
      expect(cell).toBeDisabled();
    }
  });

  it("[spec] 닫기 버튼, 바깥 배경, 닫기 요청으로 닫히고, 다시 열면 고른 날짜(없으면 첫 묶음)의 달로 돌아온다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(calendarHistory);
    await renderScreen();

    await pressText("달력");
    await press(within(openModal()).getByText("<"));
    await press(within(openModal()).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);

    await pressText("달력");
    expect(within(openModal()).getByText("2026년 11월")).toBeOnTheScreen();
    const overlay = openModal().children[0] as TestInstance;
    await press(overlay.children[0] as TestInstance);
    expect(modalHosts()).toHaveLength(0);

    await pressText("달력");
    await act(async () => {
      openModal().props.onRequestClose();
    });
    await flushAsync();
    expect(modalHosts()).toHaveLength(0);
  });
});

// ---------- 당겨서 새로고침 ----------

describe("[spec] 당겨서 새로고침", () => {
  it("[spec] 세션 새로고침과 Now in English 기록을 함께 부르고, 세션이 있으면 작문 기록과 저장 표현을 다시 부르며, 도는 동안만 새로고침 표시가 켜진다", async () => {
    await renderScreen();
    expect(refreshControl().props.refreshing).toBe(false);
    jest.mocked(getAnswerHistory).mockClear();
    jest.mocked(getTodayWritingStatus).mockClear();
    jest.mocked(getSavedExpressions).mockClear();
    jest.mocked(getNowInEnglishSummary).mockClear();
    const sessionRefresh = deferred<AuthUser | null>();
    refreshSession.mockReturnValue(sessionRefresh.promise);

    await pullToRefresh();

    expect(refreshControl().props.refreshing).toBe(true);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(getAnswerHistory).not.toHaveBeenCalled();
    expect(getSavedExpressions).not.toHaveBeenCalled();

    jest.mocked(getAnswerHistory).mockResolvedValue([s3]);
    await act(async () => {
      sessionRefresh.resolve(signedInUser);
    });
    await flushAsync();

    expect(getAnswerHistory).toHaveBeenCalledTimes(1);
    expect(getAnswerHistory).toHaveBeenCalledWith({ limit: 30 });
    expect(getTodayWritingStatus).toHaveBeenCalledTimes(1);
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(refreshControl().props.refreshing).toBe(false);
    expect(visibleHeadings()).toEqual([HEADING_1111]);
  });

  it("[spec] 새로고침에서 세션이 없으면 저장 표현만 비우고 작문 기록은 다시 부르지 않는다", async () => {
    await renderScreen();
    jest.mocked(getAnswerHistory).mockClear();
    refreshSession.mockResolvedValue(null);

    await pullToRefresh();

    expect(getAnswerHistory).not.toHaveBeenCalled();
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);
    expect(refreshControl().props.refreshing).toBe(false);
    expect(visibleHeadings()).toEqual([HEADING_1112, HEADING_1111, HEADING_1109]);
    await openTab("저장 표현");
    expect(screen.getByText("아직 저장한 표현이 없어요")).toBeOnTheScreen();
  });

  it("[spec] 새로고침한 Now in English 기록을 영어조각 탭에 보인다", async () => {
    setParams({ tab: "now" });
    await renderScreen();
    jest.mocked(getNowInEnglishSummary).mockResolvedValue(nowSummary([nowEntries[3]]));

    await pullToRefresh();

    expect(screen.getByText("1개의 한 줄")).toBeOnTheScreen();
    expect(screen.queryByText("I am reading a book.")).toBeNull();
  });
});

// ---------- 화면 구조 ----------
// 문구·구조·접근성 속성·스타일 값이 지금과 같은지 호스트 트리 스냅샷으로 기록한다(tests/app/__snapshots__).
// 실행 환경의 ko-KR 형식·시간대에 따라 달라지는 시각·저장 날짜는 자리 표시로 바꿔 찍는다.

describe("[spec] 화면 구조", () => {
  it("[spec] 세션 확인 중 화면", async () => {
    setSessionUser(null, true);
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 로그인 전(작문 기록 탭)", async () => {
    setSessionUser(null);
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 로그인 전 영어조각 탭", async () => {
    setSessionUser(null);
    setParams({ tab: "now" });
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 작문 기록을 불러오는 중", async () => {
    jest.mocked(getAnswerHistory).mockReturnValue(new Promise(() => undefined));
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 작문 기록 탭(묶음 둘 열림, 시도 없는 카드)", async () => {
    await renderScreen();
    await pressText(HEADING_1109);

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 작문 기록 탭(빈 상태와 오류, 오늘 상태 없음)", async () => {
    jest.mocked(getAnswerHistory).mockRejectedValue(new Error("기록 서버 오류"));
    jest.mocked(getTodayWritingStatus).mockRejectedValue(new Error("오늘 상태 실패"));
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 작문 기록 탭(전체 보기와 이전 기록 더 보기)", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 작문 기록 탭(이전 기록을 불러오는 중)", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    await renderScreen();
    jest.mocked(getAnswerHistory).mockReturnValue(new Promise(() => undefined));
    await pressText("이전 기록 더 보기");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 영어일기 탭", async () => {
    await renderScreen();
    await openTab("일기");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 영어조각 탭(목록)", async () => {
    await renderScreen();
    await openTab("영어조각");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 영어조각 탭(불러오는 중)", async () => {
    jest.mocked(getNowInEnglishSummary).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    await openTab("영어조각");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 영어조각 탭(빈 상태와 오류)", async () => {
    jest.mocked(getNowInEnglishSummary).mockRejectedValue(new Error("영어조각 서버 오류"));
    await renderScreen();
    await openTab("영어조각");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 저장 표현 탭(목록)", async () => {
    await renderScreen();
    await openTab("저장 표현");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 저장 표현 탭(검색·태그 고름, 질문 둘 펼침, 삭제 중)", async () => {
    jest.mocked(deleteSavedExpression).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    await openTab("저장 표현");
    await typeSearch(" MORNING ");
    await pressText("동사 표현", 0);
    await pressText(PROMPT_OPEN_TEXT, 0);
    await pressText(PROMPT_OPEN_TEXT, 1);
    await press(deleteButtons()[2]);
    await pressAlertButton("삭제");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 저장 표현 탭(막힌 태그 연습, 막힌 기록 보기)", async () => {
    await renderScreen();
    await openTab("저장 표현");
    await pressText("여행", 0);
    await pressText(PROMPT_OPEN_TEXT, 4);

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 저장 표현 탭(불러오는 중)", async () => {
    jest.mocked(getSavedExpressions).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    await openTab("저장 표현");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 저장 표현 탭(빈 상태와 오류)", async () => {
    jest.mocked(getSavedExpressions).mockRejectedValue(new Error("표현 서버 오류"));
    await renderScreen();
    await openTab("저장 표현");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 저장 표현 탭(검색 결과 없음)", async () => {
    await renderScreen();
    await openTab("저장 표현");
    await typeSearch("zzz");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 기록 상세 모달(진행 중, 시도 둘)", async () => {
    await renderScreen();
    await pressText(s1.questionEn);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 기록 상세 모달(마칠 준비)", async () => {
    await renderScreen();
    await pressText(s2.questionEn);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 기록 상세 모달(이전 형식 피드백)", async () => {
    await renderScreen();
    await pressText(HEADING_1111);
    await pressText(s5.questionEn);

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 월 달력 모달(고른 날짜, 이전 달 가능)", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(calendarHistory);
    setParams({ date: "2026-11-12" });
    await renderScreen();
    await pressText("달력");

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 월 달력 모달(가운데 달)", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(calendarHistory);
    await renderScreen();
    await pressText("달력");
    await press(within(openModal()).getByText("<"));

    expect(structureOf(openModal())).toMatchSnapshot();
  });
});
