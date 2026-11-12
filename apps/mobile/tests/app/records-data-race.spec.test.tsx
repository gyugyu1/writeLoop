// [spec] qa 테스트(작업 083 기록 화면 데이터 꼬임 고치기, 버그 수정의 재현 테스트).
// 명세(01-main-spec.md)의 A1~A7, B1·B2, C1·C2를 기록 화면(src/app/records.tsx) 전체를 렌더해 재현한다.
// "[spec] 그대로:"로 시작하는 테스트는 재현이 아니라 명세의 "그대로여야 할 동작"이나 기대 동작 중 지금도 맞는 부분을 지키는 것이라
// 고치기 전에도 통과가 맞다. 나머지는 고치기 전에 실패해야 한다.
// 가짜로 두는 것은 records.spec.test.tsx와 같다(API, Now in English 불러오기, 라우터, 기기 저장소, Alert, 네이티브 모듈).
// 다른 점: 로그인 상태(@/lib/session)를 바뀌면 화면이 다시 그려지는 작은 저장소로 둔다. 당겨서 새로고침의 세션 다시 확인이
// 실제(session.tsx의 refreshSession → applySessionUser)처럼 새 사용자 객체를 넣는 상황(A4)과, 요청이 도는 중에 로그아웃·
// 계정 전환이 일어나는 상황(A1·A5·A6)을 만들기 위해서다.
// 날짜 계산이 오늘에 기대므로 가짜 시계로 돌린다(2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00).
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactElement } from "react";
import { Alert, ScrollView } from "react-native";
import type { TestInstance } from "test-renderer";
import RecordsScreen from "@/app/records";
import { deleteSavedExpression, getAnswerHistory, getSavedExpressions, getTodayWritingStatus } from "@/lib/api";
import { getNowInEnglishSummary, type NowInEnglishEntry, type NowInEnglishSummary } from "@/lib/now-in-english";
import * as sessionModule from "@/lib/session";
import type { AuthUser, HistorySession, SavedExpression, TodayWritingStatus } from "@/lib/types";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
  useLocalSearchParams: jest.fn()
}));
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
jest.mock("@/lib/now-in-english", () => ({
  ...jest.requireActual<typeof import("@/lib/now-in-english")>("@/lib/now-in-english"),
  getNowInEnglishSummary: jest.fn()
}));
jest.mock("@/lib/practice-feedback-state", () => ({ savePracticeFeedbackState: jest.fn() }));
// 로그인 상태: 바꾸면 구독한 화면이 다시 그려지는 저장소. useSession은 지금 사용자와 고정된 함수들을 돌려준다.
jest.mock("@/lib/session", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const state: { user: unknown; listeners: Set<() => void> } = { user: null, listeners: new Set() };
  const refreshSession = jest.fn();
  const fixed = {
    refreshSession,
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  };
  function subscribe(listener: () => void) {
    state.listeners.add(listener);
    return () => {
      state.listeners.delete(listener);
    };
  }
  return {
    __sessionStore: {
      get: () => state.user,
      set: (user: unknown) => {
        state.user = user;
        state.listeners.forEach((listener) => listener());
      },
      refreshSession
    },
    useSession: () => {
      const currentUser = React.useSyncExternalStore(subscribe, () => state.user);
      return { currentUser, isHydrating: false, ...fixed };
    }
  };
});

type SessionStore = {
  get: () => AuthUser | null;
  set: (user: AuthUser | null) => void;
  refreshSession: jest.Mock<Promise<AuthUser | null>, []>;
};
const sessionStore = (sessionModule as unknown as { __sessionStore: SessionStore }).__sessionStore;

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");

const userA: AuthUser = { id: 7, email: "a@example.com", displayName: "사용자A", admin: false };
const userB: AuthUser = { id: 8, email: "b@example.com", displayName: "사용자B", admin: false };

const statusA: TodayWritingStatus = {
  date: "2026-11-12",
  completed: true,
  completedSessions: 1,
  startedSessions: 1,
  streakDays: 3,
  totalAnswerSessions: 42,
  totalWrittenSentences: 1234
};
const statusB: TodayWritingStatus = {
  date: "2026-11-12",
  completed: false,
  completedSessions: 0,
  startedSessions: 1,
  streakDays: 9,
  totalAnswerSessions: 77,
  totalWrittenSentences: 5678
};

function sessionOn(dateIso: string, owner: string, id: number): HistorySession {
  return {
    sessionId: `${owner}-session-${id}`,
    promptId: `prompt-${owner}-${id}`,
    topic: `Topic ${owner} ${id}`,
    difficulty: "A",
    questionEn: `${owner} question ${id}?`,
    questionKo: `${owner} 질문 ${id}`,
    status: "IN_PROGRESS",
    createdAt: dateIso,
    updatedAt: dateIso,
    attempts: [
      {
        id,
        attemptNo: 1,
        attemptType: "INITIAL",
        answerText: "I like it.",
        feedbackSummary: "",
        visibleFeedback: null,
        usedExpressions: [],
        createdAt: dateIso
      }
    ]
  };
}

// 서울 날짜로 11-12, 11-11, 11-09 세 묶음.
function threeDays(owner: string, base = 1): HistorySession[] {
  return [
    sessionOn("2026-11-12T02:00:00.000Z", owner, base),
    sessionOn("2026-11-11T05:00:00.000Z", owner, base + 1),
    sessionOn("2026-11-09T03:00:00.000Z", owner, base + 2)
  ];
}
const H1112 = "2026년 11월 12일 목";
const H1111 = "2026년 11월 11일 수";
const H1109 = "2026년 11월 9일 월";

// 한 페이지(30개)를 꽉 채운 기록: 11-12 ~ 11-07 여섯 날짜에 5개씩.
function fullPage(owner: string, base = 100): HistorySession[] {
  return Array.from({ length: 30 }, (_, index) => {
    const day = 12 - Math.floor(index / 5);
    const createdAt = new Date(Date.UTC(2026, 10, day, 2, 0) - (index % 5) * 600000).toISOString();
    return sessionOn(createdAt, owner, base + index);
  });
}
const FULL_PAGE_HEADINGS = [
  H1112,
  H1111,
  "2026년 11월 10일 화",
  H1109,
  "2026년 11월 8일 일",
  "2026년 11월 7일 토"
];

// 이전 페이지(30개, 꽉 참): 10-06 ~ 10-01 여섯 날짜에 5개씩.
function olderFullPage(owner: string, base = 300): HistorySession[] {
  return Array.from({ length: 30 }, (_, index) => {
    const day = 6 - Math.floor(index / 5);
    const createdAt = new Date(Date.UTC(2026, 9, day, 3, 0) - (index % 5) * 600000).toISOString();
    return sessionOn(createdAt, owner, base + index);
  });
}

function savedExpression(id: number, expression: string, lastSavedAt: string): SavedExpression {
  return {
    id,
    expression,
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
    lastSavedAt,
    createdAt: lastSavedAt
  };
}
const expressionsA = [
  savedExpression(1, "grab a coffee", "2026-11-11T03:00:00.000Z"),
  savedExpression(2, "stay up late", "2026-11-10T03:00:00.000Z"),
  savedExpression(3, "by the way", "2026-11-09T03:00:00.000Z")
];
const expressionsB = [savedExpression(11, "on the way to", "2026-11-11T03:00:00.000Z")];

function nowSummary(entries: NowInEnglishEntry[]): NowInEnglishSummary {
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
const nowGuest = nowSummary([
  { id: "now-g", dateKey: "2026-11-12", createdAt: "2026-11-12T01:00:00.000Z", text: "Guest is walking." }
]);
const nowA = nowSummary([
  { id: "now-a", dateKey: "2026-11-12", createdAt: "2026-11-12T01:00:00.000Z", text: "A is having lunch." }
]);
const nowB = nowSummary([
  { id: "now-b", dateKey: "2026-11-12", createdAt: "2026-11-12T01:00:00.000Z", text: "B is reading." }
]);

// ---------- 도우미 ----------

const scrollViewScrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;
let alertSpy: jest.SpyInstance;

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

// 로그인 사용자를 바꾼다(로그아웃은 null).
async function changeUser(user: AuthUser | null) {
  await act(async () => {
    sessionStore.set(user);
  });
  await flushAsync();
}

async function settle(action: () => void) {
  await act(async () => {
    action();
  });
  await flushAsync();
}

async function press(element: TestInstance) {
  await fireEvent.press(element);
  await flushAsync();
}

async function pressText(text: string | RegExp, index = 0) {
  await press(screen.getAllByText(text)[index]);
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function scrollHost() {
  return findHost(screen.container, "RCTScrollView")[0];
}

type RefreshControlElement = ReactElement<{ refreshing: boolean; onRefresh: () => void }>;

async function pullToRefresh() {
  await act(async () => {
    (scrollHost().props.refreshControl as RefreshControlElement).props.onRefresh();
  });
  await flushAsync();
}

function modalHosts() {
  return findHost(screen.container, "Modal");
}

function openModal() {
  const modals = modalHosts();
  expect(modals).toHaveLength(1);
  return modals[0];
}

async function pickCalendarDay(day: string) {
  await pressText("달력");
  await press(within(openModal()).getByText(day));
}

function textOf(node: TestInstance): string {
  return node.children.map((child) => (typeof child === "string" ? child : textOf(child))).join("");
}

function visibleHeadings() {
  return screen.queryAllByText(/^\d{4}년 \d{1,2}월 \d{1,2}일 [일월화수목금토]$/).map((node) => textOf(node));
}

// 날짜 묶음 머리의 "+"/"-" 표시와, 접혀 있으면("+") 머리를 눌러 펼치기. 접힌 묶음은 질문 카드를 그리지 않는다.
function groupToggle(heading: string) {
  const headingPressable = screen.getByText(heading).parent!.parent!;
  return within(headingPressable).getByText(/^[-+]$/);
}

async function openGroup(heading: string) {
  if (textOf(groupToggle(heading)) === "+") {
    await pressText(heading);
  }
  expect(groupToggle(heading)).toHaveTextContent("-");
}

// 프로필 카드의 지표 값: 이름표("연속 루프" 등) 바로 앞의 값 글자.
function metricValue(label: "연속 루프" | "질문 기록" | "총 문장") {
  const labelNode = screen.getByText(label);
  const card = labelNode.parent!;
  const texts = findHost(card, "Text");
  return textOf(texts[0]);
}

const DELETING_COLOR = "#A3371A";

// 표현 카드의 삭제 자리: 표현 글자에서 올라가 삭제 아이콘이나 삭제 중 표시가 들어 있는 가장 가까운 묶음.
function deleteSlotOf(expression: string) {
  let node: TestInstance | null = screen.getByText(expression);
  while (node) {
    const icon = findHost(node, "ExpoSymbolView").find(
      (item) => (item.props.name as { android?: string }).android === "delete"
    );
    const spinner = findHost(node, "ActivityIndicator").find((item) => item.props.color === DELETING_COLOR);
    if (icon || spinner) {
      return { icon: icon ?? null, spinner: spinner ?? null };
    }
    node = node.parent;
  }
  throw new Error(`삭제 자리를 찾지 못함: ${expression}`);
}

function deletingSpinners() {
  return findHost(screen.container, "ActivityIndicator").filter((item) => item.props.color === DELETING_COLOR);
}

type AlertButton = { text: string; style?: string; onPress?: () => void };

async function confirmDelete(expression: string) {
  const { icon } = deleteSlotOf(expression);
  expect(icon).not.toBeNull();
  await press(icon!);
  const call = alertSpy.mock.calls.at(-1) as [string, string, AlertButton[]];
  const button = call[2].find((item) => item.text === "삭제")!;
  await settle(() => button.onPress?.());
}

// 스크롤 내용 안의 배치를 정해 onLayout이 있는 모든 요소에 알린다(부모 먼저, 문서 순서).
// 배치 모형: 스크롤 내용(ScrollView와 그 바로 아래 요소)의 위치는 0이다. 그 밖의 요소의 스크롤 내용 안 절대 위치는
// 자기 안에서 문서 순서로 처음 나오는 기준 글자의 위치이고, 기준 글자가 없으면 부모의 위치와 같다.
// onLayout의 y는 부모 요소 안에서의 위치(자기 절대 위치 - 부모 절대 위치)로 준다. 그래서 어느 요소에 onLayout을 달든
// 날짜 묶음까지의 y를 모두 더하면 그 묶음의 절대 위치가 된다.
const HISTORY_TITLE = "날짜별 기록";

function firstAnchor(node: TestInstance, anchors: Record<string, number>): number | undefined {
  if (node.type === "Text") {
    const text = textOf(node);
    if (Object.prototype.hasOwnProperty.call(anchors, text)) {
      return anchors[text];
    }
  }
  for (const child of node.children) {
    if (typeof child === "string") {
      continue;
    }
    const found = firstAnchor(child, anchors);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

async function layoutContent(anchors: Record<string, number>) {
  const events: { node: TestInstance; y: number }[] = [];
  function visit(node: TestInstance, parentAbsolute: number, depth: number) {
    const absolute = depth <= 1 ? 0 : firstAnchor(node, anchors) ?? parentAbsolute;
    if (depth >= 1 && typeof node.props.onLayout === "function") {
      events.push({ node, y: absolute - parentAbsolute });
    }
    for (const child of node.children) {
      if (typeof child !== "string") {
        visit(child, absolute, depth + 1);
      }
    }
  }
  visit(scrollHost(), 0, 0);
  for (const { node, y } of events) {
    await act(async () => {
      (node.props.onLayout as (event: unknown) => void)({
        nativeEvent: { layout: { x: 0, y, width: 320, height: 100 } }
      });
    });
  }
  await flushAsync();
}

// 날짜 묶음 하나의 onLayout만 다시 알린다(묶음을 열거나 닫아 크기가 바뀐 때처럼). 머리 글자에서 올라가 처음 만나는
// onLayout이 있는 요소(날짜 묶음 View)에 직접 알린다.
async function relayoutGroup(heading: string, y: number) {
  let node: TestInstance | null = screen.getByText(heading).parent;
  while (node && typeof node.props.onLayout !== "function") {
    node = node.parent;
  }
  expect(node).not.toBeNull();
  await act(async () => {
    (node!.props.onLayout as (event: unknown) => void)({
      nativeEvent: { layout: { x: 0, y, width: 320, height: 100 } }
    });
  });
  await flushAsync();
}

function expectApiCallCounts(counts: { history: number; today: number; expressions: number; now: number }) {
  expect(getAnswerHistory).toHaveBeenCalledTimes(counts.history);
  expect(getTodayWritingStatus).toHaveBeenCalledTimes(counts.today);
  expect(getSavedExpressions).toHaveBeenCalledTimes(counts.expressions);
  expect(getNowInEnglishSummary).toHaveBeenCalledTimes(counts.now);
}

function clearApiCalls() {
  jest.mocked(getAnswerHistory).mockClear();
  jest.mocked(getTodayWritingStatus).mockClear();
  jest.mocked(getSavedExpressions).mockClear();
  jest.mocked(getNowInEnglishSummary).mockClear();
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getAnswerHistory).mockReset().mockResolvedValue(threeDays("A"));
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(statusA);
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue(expressionsA);
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  jest.mocked(getNowInEnglishSummary).mockReset().mockResolvedValue(nowA);
  scrollViewScrollTo.mockClear();
  sessionStore.set(userA);
  // 기본: 세션 다시 확인은 사용자를 바꾸지 않고 지금 사용자를 돌려준다.
  sessionStore.refreshSession.mockReset().mockImplementation(async () => sessionStore.get());
  setParams({});
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- A1. 로그인 사용자가 바뀐 뒤 늦게 온 응답 ----------

describe("[spec] A1 로그인 사용자가 바뀐 뒤 늦게 온 응답", () => {
  it("[spec] 계정 전환 뒤 앞 사용자의 작문 기록·오늘 상태·저장 표현 응답이 늦게 와도 새 사용자의 것만 보인다", async () => {
    const historyA = deferred<HistorySession[]>();
    const todayA = deferred<TodayWritingStatus>();
    const expressionsALate = deferred<SavedExpression[]>();
    jest
      .mocked(getAnswerHistory)
      .mockReturnValueOnce(historyA.promise)
      .mockResolvedValueOnce(threeDays("B", 51));
    jest.mocked(getTodayWritingStatus).mockReturnValueOnce(todayA.promise).mockResolvedValueOnce(statusB);
    jest.mocked(getSavedExpressions).mockReturnValueOnce(expressionsALate.promise).mockResolvedValueOnce(expressionsB);
    await renderScreen();

    await changeUser(userB);
    expect(screen.getByText("B question 51?")).toBeOnTheScreen();

    await settle(() => {
      historyA.resolve(threeDays("A"));
      todayA.resolve(statusA);
      expressionsALate.resolve(expressionsA);
    });

    expect(screen.queryByText("A question 1?")).toBeNull();
    expect(screen.getByText("B question 51?")).toBeOnTheScreen();
    expect(screen.getByText("사용자B")).toBeOnTheScreen();
    expect(metricValue("연속 루프")).toBe("9");
    expect(metricValue("질문 기록")).toBe("77");
    expect(metricValue("총 문장")).toBe("5,678");
    await pressText("저장 표현");
    expect(screen.getByText("on the way to")).toBeOnTheScreen();
    expect(screen.queryByText("grab a coffee")).toBeNull();
    expect(screen.getByText("1개의 표현")).toBeOnTheScreen();
  });

  it("[spec] 계정 전환 뒤 앞 사용자의 요청이 늦게 실패해도 그 오류 문구가 새 화면에 뜨지 않는다", async () => {
    const historyA = deferred<HistorySession[]>();
    const expressionsALate = deferred<SavedExpression[]>();
    jest
      .mocked(getAnswerHistory)
      .mockReturnValueOnce(historyA.promise)
      .mockResolvedValueOnce(threeDays("B", 51));
    jest.mocked(getTodayWritingStatus).mockResolvedValueOnce(statusA).mockResolvedValueOnce(statusB);
    jest.mocked(getSavedExpressions).mockReturnValueOnce(expressionsALate.promise).mockResolvedValueOnce(expressionsB);
    await renderScreen();

    await changeUser(userB);
    await settle(() => {
      historyA.reject(new Error("A 기록 오류"));
      expressionsALate.reject(new Error("A 표현 오류"));
    });

    expect(screen.queryByText("A 기록 오류")).toBeNull();
    expect(screen.getByText("B question 51?")).toBeOnTheScreen();
    await pressText("저장 표현");
    expect(screen.queryByText("A 표현 오류")).toBeNull();
    expect(screen.getByText("on the way to")).toBeOnTheScreen();
  });

  it("[spec] 계정 전환 뒤 앞 사용자의 요청이 먼저 끝나도 불러오는 중 표시가 꺼지지 않고, 새 사용자의 요청이 끝날 때 꺼진다", async () => {
    const historyA = deferred<HistorySession[]>();
    const historyB = deferred<HistorySession[]>();
    jest.mocked(getAnswerHistory).mockReturnValueOnce(historyA.promise).mockReturnValueOnce(historyB.promise);
    jest.mocked(getTodayWritingStatus).mockResolvedValueOnce(statusA).mockResolvedValueOnce(statusB);
    jest.mocked(getSavedExpressions).mockResolvedValueOnce(expressionsA).mockResolvedValueOnce(expressionsB);
    await renderScreen();

    await changeUser(userB);
    await settle(() => historyA.resolve(threeDays("A")));

    expect(screen.getByText("작문 기록을 불러오고 있어요")).toBeOnTheScreen();
    expect(screen.queryByText("A question 1?")).toBeNull();

    await settle(() => historyB.resolve(threeDays("B", 51)));

    expect(screen.queryByText("작문 기록을 불러오고 있어요")).toBeNull();
    expect(screen.getByText("B question 51?")).toBeOnTheScreen();
  });

  it("[spec] 로그아웃 뒤 앞 사용자의 응답이 와도 빈 상태 그대로라, 다시 로그인해 불러오는 동안 앞 사용자의 오늘 상태가 보이지 않는다", async () => {
    const historyA = deferred<HistorySession[]>();
    const todayA = deferred<TodayWritingStatus>();
    const expressionsALate = deferred<SavedExpression[]>();
    jest
      .mocked(getAnswerHistory)
      .mockReturnValueOnce(historyA.promise)
      .mockReturnValueOnce(new Promise(() => undefined));
    jest
      .mocked(getTodayWritingStatus)
      .mockReturnValueOnce(todayA.promise)
      .mockReturnValueOnce(new Promise(() => undefined));
    jest
      .mocked(getSavedExpressions)
      .mockReturnValueOnce(expressionsALate.promise)
      .mockReturnValueOnce(new Promise(() => undefined));
    await renderScreen();

    await changeUser(null);
    await settle(() => {
      historyA.resolve(threeDays("A"));
      todayA.resolve(statusA);
      expressionsALate.resolve(expressionsA);
    });
    expect(screen.getByText("로그인이 필요해요")).toBeOnTheScreen();

    await changeUser(userB);

    expect(screen.getByText("사용자B")).toBeOnTheScreen();
    expect(metricValue("연속 루프")).toBe("0");
    expect(metricValue("질문 기록")).toBe("0");
    expect(metricValue("총 문장")).toBe("0");
    expect(screen.queryByText("A question 1?")).toBeNull();
  });

  it("[spec] '이전 기록 더 보기' 중에 계정이 바뀌면 앞 사용자의 이전 페이지가 새 사용자의 목록에 붙지 않는다", async () => {
    const moreA = deferred<HistorySession[]>();
    jest.mocked(getAnswerHistory).mockResolvedValueOnce(fullPage("A"));
    await renderScreen();
    expect(screen.getByText("이전 기록 더 보기")).toBeOnTheScreen();

    jest.mocked(getAnswerHistory).mockReturnValueOnce(moreA.promise).mockResolvedValueOnce(threeDays("B", 51));
    jest.mocked(getTodayWritingStatus).mockResolvedValue(statusB);
    jest.mocked(getSavedExpressions).mockResolvedValue(expressionsB);
    await pressText("이전 기록 더 보기");
    expect(getAnswerHistory).toHaveBeenLastCalledWith(expect.objectContaining({ before: expect.any(String) }));

    await changeUser(userB);
    expect(screen.getByText("B question 51?")).toBeOnTheScreen();
    await settle(() => moreA.resolve(olderFullPage("A")));

    expect(visibleHeadings()).toEqual([H1112, H1111, H1109]);
    expect(screen.queryByText(/^A question/)).toBeNull();
    expect(screen.queryByText("이전 기록 더 보기")).toBeNull();
    expect(screen.queryByText("불러오는 중")).toBeNull();
  });
});

// ---------- A2. '이전 기록 더 보기' 중 당겨서 새로고침 ----------

describe("[spec] A2 '이전 기록 더 보기' 중 당겨서 새로고침", () => {
  it("[spec] 새로고침 뒤 늦게 온 더 보기 응답이 새 목록 뒤에 붙지 않고, '더 있음'도 새로고침 응답대로다", async () => {
    const more = deferred<HistorySession[]>();
    jest.mocked(getAnswerHistory).mockResolvedValueOnce(fullPage("A"));
    await renderScreen();

    jest
      .mocked(getAnswerHistory)
      .mockReturnValueOnce(more.promise)
      .mockResolvedValueOnce([sessionOn("2026-11-12T02:00:00.000Z", "R", 901), sessionOn("2026-11-11T05:00:00.000Z", "R", 902)]);
    await pressText("이전 기록 더 보기");
    await pullToRefresh();
    expect(visibleHeadings()).toEqual([H1112, H1111]);

    await settle(() => more.resolve(olderFullPage("A")));

    expect(visibleHeadings()).toEqual([H1112, H1111]);
    // 두 묶음 모두 새로고침 응답의 1개씩이다(접힌 묶음도 머리의 질문 수는 보인다).
    expect(screen.getAllByText("1개 질문")).toHaveLength(2);
    expect(screen.queryByText("이전 기록 더 보기")).toBeNull();
    expect(screen.queryByText("불러오는 중")).toBeNull();
    // 펼쳐 보면 새로고침 응답의 질문만 있다. 펼친 상태는 목록이 바뀌어도 날짜 키별로 이어지므로 접힌 묶음만 펼친다.
    await openGroup(H1112);
    await openGroup(H1111);
    expect(screen.getByText("R question 901?")).toBeOnTheScreen();
    expect(screen.getByText("R question 902?")).toBeOnTheScreen();
    expect(screen.queryByText(/^A question/)).toBeNull();
  });

  it("[spec] 새로고침 뒤 늦게 실패한 더 보기 요청의 오류 문구가 뜨지 않는다", async () => {
    const more = deferred<HistorySession[]>();
    jest.mocked(getAnswerHistory).mockResolvedValueOnce(fullPage("A"));
    await renderScreen();

    jest
      .mocked(getAnswerHistory)
      .mockReturnValueOnce(more.promise)
      .mockResolvedValueOnce([sessionOn("2026-11-12T02:00:00.000Z", "R", 901)]);
    await pressText("이전 기록 더 보기");
    await pullToRefresh();

    await settle(() => more.reject(new Error("이전 기록 서버 오류")));

    expect(screen.queryByText("이전 기록 서버 오류")).toBeNull();
    expect(visibleHeadings()).toEqual([H1112]);
    expect(screen.getByText("R question 901?")).toBeOnTheScreen();
  });
});

// ---------- A3. 새로고침 때 오늘 상태 요청만 실패 ----------

describe("[spec] A3 새로고침 때 오늘 상태 요청만 실패", () => {
  it("[spec] 오늘 상태 요청만 실패하면 지금 보이던 연속 학습일·질문 기록 수·총 문장을 그대로 둔다", async () => {
    await renderScreen();
    expect(metricValue("연속 루프")).toBe("3");
    expect(metricValue("질문 기록")).toBe("42");
    expect(metricValue("총 문장")).toBe("1,234");

    jest.mocked(getTodayWritingStatus).mockRejectedValueOnce(new Error("오늘 상태 실패"));
    jest.mocked(getAnswerHistory).mockResolvedValueOnce([sessionOn("2026-11-12T02:00:00.000Z", "R", 901)]);
    await pullToRefresh();

    expect(screen.getByText("R question 901?")).toBeOnTheScreen();
    expect(metricValue("연속 루프")).toBe("3");
    expect(metricValue("질문 기록")).toBe("42");
    expect(metricValue("총 문장")).toBe("1,234");
  });

  it("[spec] 그대로: 처음 불러올 때 오늘 상태 요청이 실패하면 비어 있다(연속 0, 질문 기록은 받은 기록 수, 총 문장 0)", async () => {
    jest.mocked(getTodayWritingStatus).mockRejectedValueOnce(new Error("오늘 상태 실패"));
    await renderScreen();

    expect(metricValue("연속 루프")).toBe("0");
    expect(metricValue("질문 기록")).toBe("3");
    expect(metricValue("총 문장")).toBe("0");
  });
});

// ---------- A4. 새로고침 한 번에 같은 요청이 두 번 ----------

describe("[spec] A4 새로고침 한 번에 같은 요청이 두 번", () => {
  it("[spec] 세션 다시 확인이 같은 id의 새 사용자 객체를 넣어도, 새로고침 한 번에 작문 기록·오늘 상태·저장 표현·영어조각 요청이 한 번씩만 나간다", async () => {
    await renderScreen();
    clearApiCalls();
    sessionStore.refreshSession.mockImplementation(async () => {
      const fresh = { ...userA };
      sessionStore.set(fresh);
      return fresh;
    });

    await pullToRefresh();

    expect(sessionStore.refreshSession).toHaveBeenCalledTimes(1);
    expectApiCallCounts({ history: 1, today: 1, expressions: 1, now: 1 });
    expect(getAnswerHistory).toHaveBeenCalledWith({ limit: 30 });
  });

  it("[spec] 그대로: 새로고침에서 세션 다시 확인이 다른 사용자를 넣으면 새 사용자 기준으로 불러와 그 사용자의 기록이 보인다", async () => {
    await renderScreen();
    jest.mocked(getAnswerHistory).mockResolvedValue(threeDays("B", 51));
    jest.mocked(getTodayWritingStatus).mockResolvedValue(statusB);
    jest.mocked(getSavedExpressions).mockResolvedValue(expressionsB);
    sessionStore.refreshSession.mockImplementation(async () => {
      sessionStore.set(userB);
      return userB;
    });

    await pullToRefresh();

    expect(screen.getByText("사용자B")).toBeOnTheScreen();
    expect(screen.getByText("B question 51?")).toBeOnTheScreen();
    expect(screen.queryByText("A question 1?")).toBeNull();
    expect(metricValue("연속 루프")).toBe("9");
  });
});

// ---------- A5. 로그아웃해도 '더 보기' 상태가 남음 ----------

describe("[spec] A5 로그아웃하면 '더 보기' 상태를 처음 값으로", () => {
  it("[spec] 더 불러와 모든 날짜 묶음을 보인 뒤 로그아웃했다가 다시 로그인하면 처음 연 것과 같이 보인다('더 있음' 없음에서 시작, 처음 5묶음만)", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValueOnce(fullPage("A")).mockResolvedValueOnce(olderFullPage("A"));
    await renderScreen();
    await pressText("이전 기록 더 보기");
    expect(screen.getByText("최근 기록만 보기")).toBeOnTheScreen();
    expect(screen.getByText("이전 기록 더 보기")).toBeOnTheScreen();

    await changeUser(null);
    const relogin = deferred<HistorySession[]>();
    jest.mocked(getAnswerHistory).mockReturnValueOnce(relogin.promise);
    await changeUser(userA);

    // 다시 로그인해 첫 페이지를 불러오는 동안: '더 있음'이 처음 값(없음)이라 더 보기 버튼이 없다.
    expect(screen.getByText("작문 기록을 불러오고 있어요")).toBeOnTheScreen();
    expect(screen.queryByText("이전 기록 더 보기")).toBeNull();
    expect(screen.queryByText("불러오는 중")).toBeNull();

    await settle(() => relogin.resolve(fullPage("A")));

    expect(visibleHeadings()).toEqual(FULL_PAGE_HEADINGS.slice(0, 5));
    expect(screen.getByText("전체 보기 (1일 더)")).toBeOnTheScreen();
    expect(screen.queryByText("최근 기록만 보기")).toBeNull();
    expect(screen.getByText("이전 기록 더 보기")).toBeOnTheScreen();
  });

  it("[spec] 더 불러오는 중에 로그아웃했다가 다시 로그인하면 '더 불러오는 중'이 아니라 더 보기 버튼을 누를 수 있다", async () => {
    jest
      .mocked(getAnswerHistory)
      .mockResolvedValueOnce(fullPage("A"))
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce(fullPage("A"));
    await renderScreen();
    await pressText("이전 기록 더 보기");
    expect(screen.getByText("불러오는 중")).toBeOnTheScreen();

    await changeUser(null);
    await changeUser(userA);

    expect(screen.queryByText("불러오는 중")).toBeNull();
    const button = screen.getByRole("button", { name: "이전 기록 더 보기" });
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
  });
});

// ---------- A6. 영어조각 기록을 로그인 사용자가 바뀐 뒤 다시 불러오지 않음 ----------

describe("[spec] A6 로그인 사용자가 바뀌면 영어조각 기록을 다시 불러옴", () => {
  it("[spec] 영어조각 탭에 머문 채 다른 계정으로 바뀌면 영어조각 기록을 다시 불러와 새 사용자의 기록을 보인다", async () => {
    setParams({ tab: "now" });
    await renderScreen();
    expect(screen.getByText("A is having lunch.")).toBeOnTheScreen();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);

    jest.mocked(getNowInEnglishSummary).mockResolvedValue(nowB);
    await changeUser(userB);

    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(screen.getByText("B is reading.")).toBeOnTheScreen();
    expect(screen.queryByText("A is having lunch.")).toBeNull();
  });

  it("[spec] 영어조각 탭에 머문 채 로그아웃·로그인해도 그때마다 영어조각 기록을 다시 불러온다", async () => {
    setParams({ tab: "now" });
    await renderScreen();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);

    jest.mocked(getNowInEnglishSummary).mockResolvedValue(nowGuest);
    await changeUser(null);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Guest is walking.")).toBeOnTheScreen();
    expect(screen.queryByText("A is having lunch.")).toBeNull();

    jest.mocked(getNowInEnglishSummary).mockResolvedValue(nowB);
    await changeUser(userB);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(3);
    expect(screen.getByText("B is reading.")).toBeOnTheScreen();
  });

  it("[spec] 바뀌기 전에 보낸 영어조각 요청의 응답이 늦게 와도 새 사용자의 영어조각 기록을 덮지 않는다", async () => {
    setParams({ tab: "now" });
    const nowALate = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(nowALate.promise).mockResolvedValueOnce(nowB);
    await renderScreen();

    await changeUser(userB);
    expect(screen.getByText("B is reading.")).toBeOnTheScreen();

    await settle(() => nowALate.resolve(nowA));
    expect(screen.getByText("B is reading.")).toBeOnTheScreen();
    expect(screen.queryByText("A is having lunch.")).toBeNull();
  });

  it("[spec] 바뀌기 전에 보낸 영어조각 요청이 늦게 실패해도 그 오류 문구가 뜨지 않는다", async () => {
    setParams({ tab: "now" });
    const nowALate = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(nowALate.promise).mockResolvedValueOnce(nowB);
    await renderScreen();

    await changeUser(userB);
    await settle(() => nowALate.reject(new Error("A 영어조각 오류")));

    expect(screen.queryByText("A 영어조각 오류")).toBeNull();
    expect(screen.getByText("B is reading.")).toBeOnTheScreen();
  });
});

// ---------- A7. 저장 표현 두 개를 잇달아 지울 때 '지우는 중' 표시 ----------

describe("[spec] A7 저장 표현 두 개를 잇달아 지울 때", () => {
  it("[spec] 지우는 중인 표현마다 따로 '지우는 중'으로 보이고, 각 삭제가 끝날 때 그 표현만 표시가 꺼지고 목록에서 빠진다", async () => {
    const deleteX = deferred<void>();
    const deleteY = deferred<void>();
    jest.mocked(deleteSavedExpression).mockReturnValueOnce(deleteX.promise).mockReturnValueOnce(deleteY.promise);
    setParams({ tab: "expressions" });
    await renderScreen();

    await confirmDelete("grab a coffee");
    await confirmDelete("stay up late");
    expect(deleteSavedExpression).toHaveBeenNthCalledWith(1, 1);
    expect(deleteSavedExpression).toHaveBeenNthCalledWith(2, 2);

    expect(deletingSpinners()).toHaveLength(2);
    expect(deleteSlotOf("grab a coffee").spinner).not.toBeNull();
    expect(deleteSlotOf("stay up late").spinner).not.toBeNull();
    expect(deleteSlotOf("by the way").spinner).toBeNull();

    await settle(() => deleteX.resolve());

    expect(screen.queryByText("grab a coffee")).toBeNull();
    expect(deletingSpinners()).toHaveLength(1);
    expect(deleteSlotOf("stay up late").spinner).not.toBeNull();
    expect(screen.getByText("2개의 표현")).toBeOnTheScreen();

    await settle(() => deleteY.resolve());

    expect(screen.queryByText("stay up late")).toBeNull();
    expect(deletingSpinners()).toHaveLength(0);
    expect(screen.getByText("by the way")).toBeOnTheScreen();
    expect(screen.getByText("1개의 표현")).toBeOnTheScreen();
  });

  it("[spec] 먼저 지운 표현의 삭제가 실패해도 다른 표현의 '지우는 중'은 남고, 실패한 표현은 목록에 남는다", async () => {
    const deleteX = deferred<void>();
    const deleteY = deferred<void>();
    jest.mocked(deleteSavedExpression).mockReturnValueOnce(deleteX.promise).mockReturnValueOnce(deleteY.promise);
    setParams({ tab: "expressions" });
    await renderScreen();

    await confirmDelete("grab a coffee");
    await confirmDelete("stay up late");

    await settle(() => deleteX.reject(new Error("삭제 서버 오류")));

    expect(alertSpy).toHaveBeenLastCalledWith("삭제에 실패했어요", "삭제 서버 오류");
    expect(screen.getByText("grab a coffee")).toBeOnTheScreen();
    expect(deleteSlotOf("grab a coffee").spinner).toBeNull();
    expect(deleteSlotOf("grab a coffee").icon).not.toBeNull();
    expect(deleteSlotOf("stay up late").spinner).not.toBeNull();
    expect(deletingSpinners()).toHaveLength(1);
    expect(screen.getByText("3개의 표현")).toBeOnTheScreen();
  });
});

// ---------- B1. 날짜로 스크롤할 때 위치 ----------

// 배치: 머리·프로필 카드·탭 줄이 500을 차지하고, 작문 기록 구역 머리("날짜별 기록")가 500, 날짜 묶음이 620·1260·1900.
const LAYOUT = { [HISTORY_TITLE]: 500, [H1112]: 620, [H1111]: 1260, [H1109]: 1900 };

describe("[spec] B1 날짜로 스크롤할 때 스크롤 내용 전체에서의 위치를 쓴다", () => {
  it("[spec] 경로 값 date의 날짜 묶음으로 스크롤할 때, 그 묶음의 스크롤 내용 안 위치보다 12 위로 스크롤한다", async () => {
    setParams({ date: "2026-11-11" });
    await renderScreen();

    await layoutContent(LAYOUT);
    await advance(200);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 1248, animated: true });
  });

  it("[spec] 저장 표현의 '기록 보기'로 날짜를 고르면 그 날짜 묶음의 스크롤 내용 안 위치보다 12 위로 스크롤한다", async () => {
    jest
      .mocked(getSavedExpressions)
      .mockResolvedValue([
        { ...savedExpression(1, "grab a coffee", "2026-11-11T03:00:00.000Z"), promptId: "prompt-A-3", promptQuestionEn: "A question 3?" }
      ]);
    setParams({ tab: "expressions" });
    await renderScreen();

    await pressText("어떤 질문에서 저장했는지 보기");
    await pressText("질문 히스토리로 가기");
    // 상세 창이 함께 열리므로 닫고, 작문 기록 탭의 배치를 알린다.
    await pressText("닫기");
    await layoutContent(LAYOUT);
    await advance(200);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 1888, animated: true });
  });
});

// ---------- B2. 같은 날짜로 두 번 스크롤하고 옛 위치를 씀 ----------

describe("[spec] B2 고른 날짜 하나마다 스크롤은 한 번, 지금 그려진 위치로", () => {
  it("[spec] 위치를 아는 묶음을 달력에서 고른 뒤 그 묶음의 onLayout이 다시 와도 스크롤은 한 번만 한다", async () => {
    await renderScreen();
    await layoutContent(LAYOUT);
    await advance(200);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await pickCalendarDay("11");
    // 묶음이 열려 크기가 바뀐 것처럼 그 묶음의 onLayout이 80ms 안에 다시 온다(위치는 같다).
    await advance(40);
    await relayoutGroup(H1111, 640);
    await advance(200);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: 1248, animated: true });
  });

  it("[spec] 목록이 바뀌어 없어졌던 날짜 묶음이 다른 자리로 돌아오면, 옛 위치로 스크롤하지 않고 지금 그려진 위치로 한 번 스크롤한다", async () => {
    await renderScreen();
    await layoutContent(LAYOUT);
    await advance(200);

    // 새로고침으로 11-09 묶음이 없어진다.
    jest.mocked(getAnswerHistory).mockResolvedValueOnce(threeDays("A").slice(0, 2));
    await pullToRefresh();
    expect(visibleHeadings()).toEqual([H1112, H1111]);

    // 다시 새로고침하면 11-09 묶음만 돌아온다(맨 위 자리). 새 위치는 아직 알리지 않았다.
    jest.mocked(getAnswerHistory).mockResolvedValueOnce([threeDays("A")[2]]);
    await pullToRefresh();
    expect(visibleHeadings()).toEqual([H1109]);

    await pickCalendarDay("9");
    await advance(200);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await layoutContent({ [HISTORY_TITLE]: 500, [H1109]: 620 });
    await advance(200);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 608, animated: true });
  });
});

// ---------- C1. "오늘 일기 쓰기" 버튼이 가는 곳 ----------

describe("[spec] C1 '오늘 일기 쓰기'는 두 곳 모두 쓰기 화면으로", () => {
  it("[spec] 작문 기록 탭 프로필 카드의 '오늘 일기 쓰기'는 쓰기 화면(/diary/write)으로 간다", async () => {
    await renderScreen();

    await pressText("오늘 일기 쓰기");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/diary/write");
  });

  it("[spec] 그대로: 영어일기 탭의 '오늘 일기 쓰기'는 쓰기 화면, '일기 기록 보기'는 /diary로 간다", async () => {
    setParams({ tab: "diary" });
    await renderScreen();

    // 프로필 카드의 버튼이 먼저(0), 탭 안의 버튼이 다음(1)이다.
    await pressText("오늘 일기 쓰기", 1);
    expect(router.push).toHaveBeenLastCalledWith("/diary/write");
    await pressText("일기 기록 보기");
    expect(router.push).toHaveBeenLastCalledWith("/diary");
  });
});

// ---------- C2. 로그인 안내의 돌아올 곳 ----------

describe("[spec] C2 로그인 안내의 돌아올 곳에 지금 탭을 넣음", () => {
  beforeEach(() => {
    sessionStore.set(null);
    jest.mocked(getNowInEnglishSummary).mockResolvedValue(nowGuest);
  });

  it("[spec] 저장 표현 탭에서 '로그인 하기'를 누르면 /records?tab=expressions로 돌아오는 로그인 주소로 간다", async () => {
    setParams({ tab: "expressions" });
    await renderScreen();

    await pressText("로그인 하기");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/login?redirectTo=%2Frecords%3Ftab%3Dexpressions");
  });

  it("[spec] 영어일기 탭에서 '로그인 하기'를 누르면 /records?tab=diary로 돌아오는 로그인 주소로 간다", async () => {
    setParams({ tab: "diary" });
    await renderScreen();

    await pressText("로그인 하기");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/login?redirectTo=%2Frecords%3Ftab%3Ddiary");
  });

  it("[spec] 영어조각 탭에서 저장 표현 탭을 눌러 나온 로그인 안내도 누른 탭(expressions)으로 돌아온다", async () => {
    setParams({ tab: "now" });
    await renderScreen();
    await pressText("저장 표현");

    await pressText("로그인 하기");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/login?redirectTo=%2Frecords%3Ftab%3Dexpressions");
  });

  it("[spec] 그대로: 작문 기록 탭에서 누르면 작문 기록 탭으로 돌아온다(/records 또는 /records?tab=history)", async () => {
    await renderScreen();

    await pressText("로그인 하기");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(["/login?redirectTo=%2Frecords", "/login?redirectTo=%2Frecords%3Ftab%3Dhistory"]).toContain(
      jest.mocked(router.push).mock.calls[0][0]
    );
  });
});
