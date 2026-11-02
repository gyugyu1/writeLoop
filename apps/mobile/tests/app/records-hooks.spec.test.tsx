// [spec] qa 테스트(작업 048-05 기록 화면 훅, 리팩터링의 "지금 동작" 기록).
// 기록 화면(src/app/records.tsx)의 상태·효과를 Now in English 기록·기록과 표현 불러오기·월 달력·저장 표현 검색과 태그·
// 날짜 스크롤 훅으로 옮겨도 그대로여야 하는 것 중, 기록 ①의 화면 테스트(records.spec.test.tsx)가 보지 않는 것만 더 적는다.
// - 효과 실행 순서: 처음 그릴 때 E2(Now in English 기록)가 E3(작문 기록·오늘 상태·저장 표현)보다 먼저 API를 부르는 것,
//   당겨서 새로고침이 부르는 API의 순서
// - E3이 다시 도는 때: 로그인 사용자(객체)가 바뀔 때만. 화면 조작·경로 값 변경으로는 다시 부르지 않고, 로그인 상태에서
//   사용자 객체만 바뀌면 다시 부르되 검색어는 비우지 않는다. 로그아웃하면 고른 태그도 풀린다
// - E7(날짜가 바뀌면 스크롤 기록 지우기)이 E8(고른 날짜로 스크롤)보다 먼저 도는 것, E8의 정리(clearTimeout)
// - 훅 사이 값 전달: 경로 값 날짜(E4)·열린 날짜(화면 상태)가 스크롤 훅으로, 더 불러온 기록(데이터 훅)이 월 달력 훅으로
// 가짜로 두는 것은 records.spec.test.tsx와 같다. 가짜 시계: 2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00.
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactElement } from "react";
import { Alert, ScrollView } from "react-native";
import type { TestInstance } from "test-renderer";
import RecordsScreen from "@/app/records";
import { deleteSavedExpression, getAnswerHistory, getSavedExpressions, getTodayWritingStatus } from "@/lib/api";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { savePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, HistoryAttempt, HistorySession, SavedExpression, TodayWritingStatus } from "@/lib/types";

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
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const SEARCH_PLACEHOLDER = "표현, 뜻, 예문, 질문, 태그 검색";

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function todayStatus(): TodayWritingStatus {
  return {
    date: "2026-11-12",
    completed: true,
    completedSessions: 1,
    startedSessions: 1,
    streakDays: 3,
    totalAnswerSessions: 42,
    totalWrittenSentences: 1234
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

function sessionOn(dateIso: string, id: string): HistorySession {
  return {
    sessionId: `session-${id}`,
    promptId: `prompt-${id}`,
    topic: `Topic ${id}`,
    difficulty: "A",
    questionEn: `Question on ${id}?`,
    questionKo: `${id}의 질문`,
    status: "IN_PROGRESS",
    createdAt: dateIso,
    updatedAt: dateIso,
    attempts: [attempt({ id: Number(id.replace(/\D/g, "")), attemptNo: 1, createdAt: dateIso })]
  };
}

// 작문 기록(기본): 서울 날짜로 11-12, 11-11, 11-09 세 묶음.
const baseHistory = [
  sessionOn("2026-11-12T02:00:00.000Z", "1112"),
  sessionOn("2026-11-11T05:00:00.000Z", "1111"),
  sessionOn("2026-11-09T03:00:00.000Z", "1109")
];
const HEADING_1111 = "2026년 11월 11일 수";
const HEADING_1109 = "2026년 11월 9일 월";

// 한 페이지(30개)를 꽉 채운 기록: 11-12 ~ 11-07의 여섯 날짜에 5개씩(모두 11월).
function pagedHistory(): HistorySession[] {
  return Array.from({ length: 30 }, (_, index) => {
    const day = 12 - Math.floor(index / 5);
    const createdAt = new Date(Date.UTC(2026, 10, day, 2, 0) - (index % 5) * 600000).toISOString();
    return sessionOn(createdAt, `${500 + index}`);
  });
}

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

const baseExpressions = [
  savedExpression({
    id: 1,
    expression: "grab a coffee",
    meaningKo: "커피 한잔하다",
    tags: ["verb_phrase"],
    promptId: "prompt-1112",
    promptDifficulty: "A",
    lastSavedAt: "2026-11-11T03:00:00.000Z"
  }),
  savedExpression({
    id: 2,
    expression: "stay up late",
    tags: ["travel"],
    lastSavedAt: "2026-11-10T03:00:00.000Z"
  })
];

function nowSummary(): NowInEnglishSummary {
  return {
    entries: [{ id: "now-1", dateKey: "2026-11-12", createdAt: "2026-11-12T01:00:00.000Z", text: "I am having lunch." }],
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

// ---------- 도우미 ----------

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

function modalHosts() {
  return screen.container.queryAll((instance) => instance.type === "Modal");
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

function groupToggle(heading: string) {
  const headingPressable = screen.getByText(heading).parent!.parent!;
  return within(headingPressable).getByText(/^[-+]$/);
}

async function layoutGroup(heading: string, y: number) {
  await act(async () => {
    fireEvent(screen.getByText(heading), "layout", { nativeEvent: { layout: { x: 0, y, width: 320, height: 120 } } });
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

type RefreshControlElement = ReactElement<{ refreshing: boolean; onRefresh: () => void }>;

async function pullToRefresh() {
  const scroll = screen.container.queryAll((instance) => instance.type === "RCTScrollView")[0];
  await act(async () => {
    (scroll.props.refreshControl as RefreshControlElement).props.onRefresh();
  });
  await flushAsync();
}

function callOrder(fn: unknown, index = 0) {
  return (fn as jest.Mock).mock.invocationCallOrder[index];
}

function expectApiCallCounts(counts: { history: number; today: number; expressions: number; now: number }) {
  expect(getAnswerHistory).toHaveBeenCalledTimes(counts.history);
  expect(getTodayWritingStatus).toHaveBeenCalledTimes(counts.today);
  expect(getSavedExpressions).toHaveBeenCalledTimes(counts.expressions);
  expect(getNowInEnglishSummary).toHaveBeenCalledTimes(counts.now);
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

// ---------- 효과 순서 ----------

describe("[spec] 훅 효과 순서", () => {
  it("[spec] 처음 그릴 때 Now in English 기록(E2)을 먼저 부르고, 그다음 작문 기록 → 오늘 상태 → 저장 표현(E3) 순서로 부른다", async () => {
    await renderScreen();

    expectApiCallCounts({ history: 1, today: 1, expressions: 1, now: 1 });
    expect(callOrder(getNowInEnglishSummary)).toBeLessThan(callOrder(getAnswerHistory));
    expect(callOrder(getAnswerHistory)).toBeLessThan(callOrder(getTodayWritingStatus));
    expect(callOrder(getTodayWritingStatus)).toBeLessThan(callOrder(getSavedExpressions));
  });

  it("[spec] 당겨서 새로고침은 세션 새로고침 → Now in English 기록, 세션이 있으면 그다음 작문 기록 → 오늘 상태 → 저장 표현 순서로 부른다", async () => {
    await renderScreen();
    jest.mocked(getAnswerHistory).mockClear();
    jest.mocked(getTodayWritingStatus).mockClear();
    jest.mocked(getSavedExpressions).mockClear();
    jest.mocked(getNowInEnglishSummary).mockClear();

    await pullToRefresh();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expectApiCallCounts({ history: 1, today: 1, expressions: 1, now: 1 });
    expect(callOrder(refreshSession)).toBeLessThan(callOrder(getNowInEnglishSummary));
    expect(callOrder(getNowInEnglishSummary)).toBeLessThan(callOrder(getAnswerHistory));
    expect(callOrder(getAnswerHistory)).toBeLessThan(callOrder(getTodayWritingStatus));
    expect(callOrder(getTodayWritingStatus)).toBeLessThan(callOrder(getSavedExpressions));
  });
});

// ---------- E3이 다시 도는 때 ----------

describe("[spec] 기록·표현 불러오기(E3)가 다시 도는 때", () => {
  it("[spec] 탭·검색·태그·묶음·달력·스크롤 조작과 경로 값 변경으로는 어느 기록도 다시 부르지 않는다", async () => {
    await renderScreen();
    expectApiCallCounts({ history: 1, today: 1, expressions: 1, now: 1 });

    await pressText(HEADING_1109);
    await layoutGroup(HEADING_1111, 640);
    await pickCalendarDay("11");
    await advance(200);
    await pressText("저장 표현");
    await typeSearch("coffee");
    await pressText("동사 표현", 0);
    await typeSearch("");
    await pressText("영어조각");
    await pressText("일기");
    setParams({ tab: "now", date: "2026-11-09" });
    await rerenderScreen();
    await rerenderScreen();

    expect(screen.getByText("영어조각 기록")).toBeOnTheScreen();
    expectApiCallCounts({ history: 1, today: 1, expressions: 1, now: 1 });
  });

  it("[spec] 로그인한 채 사용자 객체만 바뀌면 작문 기록·오늘 상태·저장 표현을 다시 부르되, Now in English 기록은 다시 부르지 않고 검색어도 그대로 둔다", async () => {
    setParams({ tab: "expressions" });
    await renderScreen();
    await typeSearch("coffee");
    expect(screen.getByText("1개 결과 · 전체 2개")).toBeOnTheScreen();

    setSessionUser({ ...signedInUser });
    await rerenderScreen();

    expectApiCallCounts({ history: 2, today: 2, expressions: 2, now: 1 });
    expect(getAnswerHistory).toHaveBeenLastCalledWith({ limit: 30 });
    expect(searchInput().props.value).toBe("coffee");
    expect(screen.getByText("1개 결과 · 전체 2개")).toBeOnTheScreen();
  });

  it("[spec] 태그를 고른 채 로그아웃했다가 다시 로그인하면 태그 고르기가 풀려 있다", async () => {
    setParams({ tab: "expressions" });
    await renderScreen();
    await pressText("동사 표현", 0);
    expect(screen.getByText("동사 표현 상단 우선 정렬")).toBeOnTheScreen();

    setSessionUser(null);
    await rerenderScreen();
    expect(screen.getByText("로그인이 필요해요")).toBeOnTheScreen();

    setSessionUser(signedInUser);
    await rerenderScreen();

    expect(screen.queryByText("동사 표현 상단 우선 정렬")).toBeNull();
    expect(screen.queryByText("이 태그로 다시 써보기")).toBeNull();
    expect(screen.getByText("2개의 표현")).toBeOnTheScreen();
  });
});

// ---------- 날짜 스크롤 훅 ----------

describe("[spec] 날짜 스크롤(E7·E8)", () => {
  it("[spec] 위치를 아는 묶음으로 경로 값 date가 바뀌면 그 묶음을 열고 80ms 뒤 그 위치보다 12 위로 스크롤한다", async () => {
    await renderScreen();
    await layoutGroup(HEADING_1109, 900);
    await advance(200);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    setParams({ date: "2026-11-09" });
    await rerenderScreen();
    expect(groupToggle(HEADING_1109)).toHaveTextContent("-");
    await advance(79);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    await advance(1);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 888, animated: true });
  });

  it("[spec] 고른 묶음을 닫은 채 위치가 정해졌다가 다시 열면 80ms 뒤 그 위치로 스크롤한다", async () => {
    setParams({ date: "2026-11-11" });
    await renderScreen();
    await pressText(HEADING_1111);
    expect(groupToggle(HEADING_1111)).toHaveTextContent("+");
    await layoutGroup(HEADING_1111, 640);
    await advance(200);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await pressText(HEADING_1111);
    await advance(79);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    await advance(1);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 628, animated: true });
  });

  it("[spec] 80ms가 지나기 전에 다른 날짜를 고르면 앞 날짜로의 스크롤은 취소되고 새 날짜로만 스크롤한다", async () => {
    await renderScreen();
    await layoutGroup(HEADING_1109, 900);
    await layoutGroup(HEADING_1111, 640);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await pickCalendarDay("9");
    await advance(40);
    await pickCalendarDay("11");
    await advance(40);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    await advance(40);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenCalledWith({ y: 628, animated: true });
    await advance(200);
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
  });

  it("[spec] 날짜가 바뀌면 스크롤 기록을 먼저 지우므로(E7 → E8), 다른 날짜를 거쳐 앞 날짜로 돌아오면 다시 스크롤한다", async () => {
    setParams({ date: "2026-11-11" });
    await renderScreen();
    // 위치가 정해지면 80ms 뒤 11-11로 스크롤하도록 걸린다.
    await layoutGroup(HEADING_1111, 640);
    // 그 전에 위치를 모르는 11-09를 고른다. 11-09로는 스크롤하지 않는다.
    await pickCalendarDay("9");
    await advance(80);
    // 걸려 있던 11-11 스크롤은 그대로 돈다(이때 마지막 스크롤 날짜가 11-11이 된다).
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: 628, animated: true });

    await pickCalendarDay("11");
    await advance(80);

    expect(scrollViewScrollTo).toHaveBeenCalledTimes(2);
    expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: 628, animated: true });
  });
});

// ---------- 훅 사이 값 전달 ----------

describe("[spec] 데이터 훅 → 월 달력 훅", () => {
  it("[spec] 이전 기록 더 보기로 이전 달 기록을 받으면 달력에서 이전 달로 갈 수 있고 그 날짜를 고를 수 있다", async () => {
    jest.mocked(getAnswerHistory).mockResolvedValue(pagedHistory());
    await renderScreen();

    await pressText("달력");
    expect(within(openModal()).getByText("2026년 11월")).toBeOnTheScreen();
    expect(within(openModal()).getByText("<")).toBeDisabled();
    await press(within(openModal()).getByText("닫기"));

    jest.mocked(getAnswerHistory).mockResolvedValue([sessionOn("2026-10-20T03:00:00.000Z", "1020")]);
    await pressText("이전 기록 더 보기");

    await pressText("달력");
    expect(within(openModal()).getByText("2026년 11월")).toBeOnTheScreen();
    expect(within(openModal()).getByText("<")).not.toBeDisabled();
    await press(within(openModal()).getByText("<"));
    expect(within(openModal()).getByText("2026년 10월")).toBeOnTheScreen();
    expect(within(openModal()).getByText("20")).not.toBeDisabled();

    await press(within(openModal()).getByText("20"));
    expect(modalHosts()).toHaveLength(0);
    expect(groupToggle("2026년 10월 20일 화")).toHaveTextContent("-");
    expect(screen.getByText("Question on 1020?")).toBeOnTheScreen();
  });
});
