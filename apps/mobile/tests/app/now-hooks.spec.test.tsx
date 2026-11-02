// [spec] qa 테스트(작업 048-06 Now in English 화면 훅, 리팩터링의 "지금 동작" 기록).
// Now in English 화면(src/app/now.tsx)의 상태·효과를 알림 설정·AI 코치·바로 코치 피드백·기록 보기·돌아보기·표현 저장 훅으로
// 옮겨도 그대로여야 하는 것 중, Now in English ①의 화면 테스트(now.spec.test.tsx)가 보지 않는 것만 더 적는다.
// - 효과 실행 순서: 처음 그릴 때 E2(요약 불러오기)가 E3(저장 표현 불러오기)보다 먼저 API를 부르는 것
// - 다시 도는 때: 화면 조작(입력, 코치 창, 알림 설정, 달력 넘기기, 1분 시계)과 경로 값 변경으로는 요약(E2)·저장 표현(E3)·
//   돌아보기(E5)를 다시 부르지 않는 것. E3은 로그인 사용자(객체)가 바뀔 때만 다시 돌고, 요약은 다시 부르지 않는 것.
//   표현 저장 중에 로그아웃하면 "저장 중" 표시가 풀리는 것
// - 훅 사이 값 전달:
//   - 알림 설정 훅 → 화면: 저장 뒤 목록 갱신(화면의 요약 불러오기)이 받은 알림 설정을 반영하는 것, 꺼진 상태에서 켜면 그때
//     시계를 다시 맞추고 1분 시계(E6)가 돌기 시작하며, 끄면 멈추는 것, 켜기가 바꾼 기준·방해금지·간격을 그대로 쓰는 것
//   - 바로 코치 훅 → AI 코치 훅: 수정해보기(화면)가 열린 코치 창을 닫는 것
//   - 기록 보기 훅 → 돌아보기 훅 → 화면의 E5: 날짜가 없는 보기(전체)를 거치면 앞 돌아보기를 비워, 다른 날짜를 받는 동안
//     앞 날짜의 돌아보기가 남지 않는 것
// E1(돌아보기 보는 날짜 ref)이 E5보다 먼저 도는 것은 같은 커밋 안의 순서라 늦은 응답 확인(await 뒤)에서 차이가 나지 않는다.
// E1이 있어야 하는 것(늦은 응답·오류 버리기)은 now.spec.test.tsx가 본다.
// 가짜로 두는 것은 now.spec.test.tsx와 같다. 가짜 시계: 2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00.
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
import type { TestInstance } from "test-renderer";
import NowInEnglishScreen from "@/app/now";
import {
  deleteSavedExpression,
  getSavedExpressions,
  requestCoachHelp,
  requestNowInEnglishCoachFeedback,
  requestNowInEnglishReflection,
  saveExpression
} from "@/lib/api";
import {
  disableNowInEnglishReminders,
  enableNowInEnglishReminders,
  getNowInEnglishAiReflection,
  getNowInEnglishSummary,
  saveNowInEnglishAiReflection,
  saveNowInEnglishEntry,
  updateNowInEnglishQuietHours,
  updateNowInEnglishScheduleMode,
  type NowInEnglishEntry,
  type NowInEnglishReminderSettings,
  type NowInEnglishSummary
} from "@/lib/now-in-english";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  CoachHelpResponse,
  NowInEnglishCoachFeedbackResponse,
  NowInEnglishReflectionResponse,
  SavedExpression
} from "@/lib/types";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    canDismiss: jest.fn(() => false),
    dismissAll: jest.fn()
  },
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
  getSavedExpressions: jest.fn(),
  requestCoachHelp: jest.fn(),
  requestNowInEnglishCoachFeedback: jest.fn(),
  requestNowInEnglishReflection: jest.fn(),
  saveExpression: jest.fn()
}));
jest.mock("@/lib/now-in-english", () => ({
  ...jest.requireActual<typeof import("@/lib/now-in-english")>("@/lib/now-in-english"),
  disableNowInEnglishReminders: jest.fn(),
  enableNowInEnglishReminders: jest.fn(),
  getNowInEnglishAiReflection: jest.fn(),
  getNowInEnglishSummary: jest.fn(),
  saveNowInEnglishAiReflection: jest.fn(),
  saveNowInEnglishEntry: jest.fn(),
  updateNowInEnglishQuietHours: jest.fn(),
  updateNowInEnglishScheduleMode: jest.fn()
}));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY = "2026-11-12";
const YESTERDAY = "2026-11-11";
const MAIN_PLACEHOLDER = "I’m doing something small right now.";
const COACH_PLACEHOLDER = '예: "퇴근길에 피곤해"를 영어로 어떻게 말해?';
const QUICK_QUESTION = "내 문장이 자연스러운지 봐줘.";

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function nowEntry(id: string, dateKey: string, createdAt: string, text: string): NowInEnglishEntry {
  return { id, dateKey, createdAt, text, polishedFromEntryId: null, polishedFromText: null };
}

// 기록: 오늘 둘(t1, t2), 어제 하나(y1), 11-05 하나(o1).
const t1 = nowEntry("now-t1", TODAY, "2026-11-12T01:00:00.000Z", "I am having lunch.");
const t2 = nowEntry("now-t2", TODAY, "2026-11-12T02:30:00.000Z", "I am reading a book.");
const y1 = nowEntry("now-y1", YESTERDAY, "2026-11-11T10:00:00.000Z", "I am tired.");
const o1 = nowEntry("now-o1", "2026-11-05", "2026-11-05T03:00:00.000Z", "I am cooking.");
const baseEntries = [t1, y1, t2, o1];

function reminderSettings(overrides: Partial<NowInEnglishReminderSettings> = {}): NowInEnglishReminderSettings {
  return {
    enabled: false,
    intervalHours: 2,
    scheduleMode: "HOURLY_ANCHOR",
    notificationIds: [],
    scheduledReminderAts: [],
    quietHours: { enabled: true, startHour: 23, endHour: 8 },
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides
  };
}

function summaryOf(entries: NowInEnglishEntry[], settings: NowInEnglishReminderSettings): NowInEnglishSummary {
  return { entries: entries.slice(), todayEntries: [], todayCount: 0, settings };
}

function reflectionResponse(
  dateKey: string,
  entryCount: number,
  overrides: Partial<NowInEnglishReflectionResponse> = {}
): NowInEnglishReflectionResponse {
  return {
    dateKey,
    entryCount,
    headlineKo: `${dateKey} 회고`,
    summaryKo: "짧은 문장으로 하루의 장면을 잘 남겼어요.",
    highlightsKo: [],
    patternKo: "",
    gentleCorrectionKo: "",
    nextActionKo: "",
    nextActionExampleEn: "",
    expressions: [
      { expression: "grab a bite", meaningKo: "간단히 먹다", usageTip: "점심 이야기에", example: "I grabbed a bite at noon." },
      { expression: "curl up with a book", meaningKo: "", usageTip: "", example: "" }
    ],
    closingKo: "",
    ...overrides
  };
}

function coachFeedback(): NowInEnglishCoachFeedbackResponse {
  return {
    originalText: "I am walking.",
    headlineKo: "산책 장면이 잘 보여요",
    praiseKo: "현재진행형으로 지금을 잘 담았어요.",
    suggestionEn: "I'm taking a walk.",
    suggestionTranslationKo: "산책하고 있어요.",
    suggestionKo: "take a walk가 더 자연스러워요.",
    nextQuestionKo: "어디를 걷고 있나요?",
    expression: "take a walk",
    expressionMeaningKo: "산책하다",
    expressionExampleEn: "I take a walk after lunch."
  };
}

const coachHelp: CoachHelpResponse = {
  promptId: "diary-free-writing",
  userQuestion: "피곤하다를 어떻게 말해?",
  coachReply: "지친 느낌은 이렇게 말해 보세요.",
  expressions: [
    { id: "ex-1", expression: "feel drained", meaningKo: "기운이 빠지다", usageTip: "많이 지쳤을 때", example: "I feel drained after work." }
  ]
};

function savedExpression(id: number, expression: string): SavedExpression {
  return {
    id,
    expression,
    sourceType: "COACH_RECOMMENDATION",
    saveCount: 1,
    lastSavedAt: "2026-11-01T03:00:00.000Z",
    createdAt: "2026-11-01T03:00:00.000Z"
  };
}

// 실행 환경의 ko-KR 형식에 따라 달라지는 시각 문구는 화면과 같은 방식으로 기대값을 만든다.
function seoulTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
let storedEntries: NowInEnglishEntry[] = [];
let storedSettings: NowInEnglishReminderSettings = reminderSettings();
let savedEntryCount = 0;

function setSessionUser(currentUser: AuthUser | null) {
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

function setParams(params: { reminder?: string }) {
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
  await render(<NowInEnglishScreen />);
  await flushAsync();
}

async function rerenderScreen() {
  await screen.rerender(<NowInEnglishScreen />);
  await flushAsync();
}

async function press(element: TestInstance) {
  await fireEvent.press(element);
  await flushAsync();
}

async function pressText(text: string | RegExp, index = 0) {
  await press(screen.getAllByText(text)[index]);
}

async function pressLabel(label: string) {
  await press(screen.getByLabelText(label));
}

function textOf(node: TestInstance) {
  return node.children.filter((child): child is string => typeof child === "string").join("");
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function modalHosts() {
  return findHost(screen.container, "Modal");
}

function openModal() {
  const modals = modalHosts();
  expect(modals).toHaveLength(1);
  return modals[0];
}

function mainInput() {
  return screen.getByPlaceholderText(MAIN_PLACEHOLDER);
}

function coachInput() {
  return screen.getByPlaceholderText(COACH_PLACEHOLDER);
}

async function typeInto(input: TestInstance, value: string) {
  await fireEvent.changeText(input, value);
  await flushAsync();
}

async function saveText(value: string) {
  await typeInto(mainInput(), value);
  await pressText("저장하기");
}

function reminderSummaryTexts() {
  return findHost(screen.getByLabelText("알림 설정 열기"), "Text").map(textOf);
}

// 알림 설정 창의 조절 칸(알림 주기·시작·종료)의 버튼.
function stepper(label: "알림 주기" | "시작" | "종료") {
  const box = within(openModal()).getByText(label).parent!;
  return {
    minus: within(box).getByText("-"),
    plus: within(box).getByText("+")
  };
}

function reflectionAiCard() {
  return screen.getByText("AI 회고").parent!.parent!;
}

function reflectionSaveButtons() {
  return screen.getAllByLabelText(/^(표현 저장|저장한 표현 취소)$/);
}

function reflectionSaveState() {
  return reflectionSaveButtons().map((button) => [
    button.props.accessibilityLabel as string,
    findHost(button, "Text").map(textOf).join("")
  ]);
}

function callOrder(fn: unknown) {
  return (fn as jest.Mock).mock.invocationCallOrder[0];
}

function expectLoadCounts(counts: { summary: number; expressions: number; reflection: number; reflectionRequest: number }) {
  expect({
    summary: jest.mocked(getNowInEnglishSummary).mock.calls.length,
    expressions: jest.mocked(getSavedExpressions).mock.calls.length,
    reflection: jest.mocked(getNowInEnglishAiReflection).mock.calls.length,
    reflectionRequest: jest.mocked(requestNowInEnglishReflection).mock.calls.length
  }).toEqual(counts);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  storedEntries = baseEntries.slice();
  storedSettings = reminderSettings();
  savedEntryCount = 0;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.back).mockReset();
  jest.mocked(router.canGoBack).mockReset().mockReturnValue(true);
  jest.mocked(getNowInEnglishSummary).mockReset().mockImplementation(async () => summaryOf(storedEntries, storedSettings));
  jest.mocked(saveNowInEnglishEntry).mockReset().mockImplementation(async (text, options = {}) => {
    savedEntryCount += 1;
    const entry: NowInEnglishEntry = {
      id: options.entryId ?? `now-new-${savedEntryCount}`,
      text,
      polishedFromEntryId: options.polishedFromEntryId ?? null,
      polishedFromText: options.polishedFromText ?? null,
      createdAt: options.createdAt ?? new Date().toISOString(),
      dateKey: options.dateKey ?? TODAY
    };
    storedEntries = [entry, ...storedEntries.filter((item) => item.id !== entry.id)];
    return entry;
  });
  jest.mocked(enableNowInEnglishReminders).mockReset().mockImplementation(async (intervalHours, quietHours, scheduleMode) => {
    storedSettings = {
      ...storedSettings,
      enabled: true,
      intervalHours,
      quietHours: quietHours ?? storedSettings.quietHours,
      scheduleMode: scheduleMode ?? storedSettings.scheduleMode,
      updatedAt: new Date().toISOString()
    };
    return storedSettings;
  });
  jest.mocked(disableNowInEnglishReminders).mockReset().mockImplementation(async () => {
    storedSettings = { ...storedSettings, enabled: false, updatedAt: new Date().toISOString() };
    return storedSettings;
  });
  jest.mocked(updateNowInEnglishScheduleMode).mockReset().mockImplementation(async (scheduleMode) => {
    storedSettings = { ...storedSettings, scheduleMode };
    return storedSettings;
  });
  jest.mocked(updateNowInEnglishQuietHours).mockReset().mockImplementation(async (quietHours) => {
    storedSettings = { ...storedSettings, quietHours };
    return storedSettings;
  });
  jest.mocked(getNowInEnglishAiReflection).mockReset().mockResolvedValue(null);
  jest.mocked(saveNowInEnglishAiReflection).mockReset().mockImplementation(async (reflection) => reflection);
  jest
    .mocked(requestNowInEnglishReflection)
    .mockReset()
    .mockImplementation(async (request) => reflectionResponse(request.dateKey, request.entries.length));
  jest.mocked(requestNowInEnglishCoachFeedback).mockReset().mockResolvedValue(coachFeedback());
  jest.mocked(requestCoachHelp).mockReset().mockResolvedValue(coachHelp);
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(saveExpression).mockReset().mockImplementation(async (request) => savedExpression(77, request.expression));
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
  setParams({});
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 효과 순서와 다시 도는 때 ----------

describe("[spec] 효과 순서와 다시 도는 때", () => {
  it("[spec] 처음 그릴 때 요약(E2)을 먼저 부르고 그다음 저장 표현(E3)을 부르며, 돌아보기(E5)는 요약을 받은 뒤 부른다", async () => {
    const summary = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValueOnce(summary.promise);
    await renderScreen();

    expectLoadCounts({ summary: 1, expressions: 1, reflection: 0, reflectionRequest: 0 });
    expect(callOrder(getNowInEnglishSummary)).toBeLessThan(callOrder(getSavedExpressions));

    await act(async () => {
      summary.resolve(summaryOf(baseEntries, reminderSettings()));
    });
    await flushAsync();

    expectLoadCounts({ summary: 1, expressions: 1, reflection: 1, reflectionRequest: 1 });
    expect(callOrder(getSavedExpressions)).toBeLessThan(callOrder(getNowInEnglishAiReflection));
  });

  it("[spec] 입력·코치 창·알림 설정·달력 넘기기·1분 시계와 경로 값 변경으로는 요약·저장 표현·돌아보기를 다시 부르지 않는다", async () => {
    storedSettings = reminderSettings({ enabled: true, scheduleMode: "FROM_NOW" });
    await renderScreen();
    expectLoadCounts({ summary: 1, expressions: 1, reflection: 1, reflectionRequest: 1 });

    await typeInto(mainInput(), "I am walking.");
    await pressLabel("AI 코치 열기");
    await pressText(QUICK_QUESTION);
    await pressText("코치에게 물어보기");
    expect(screen.getByText("코치 답변")).toBeOnTheScreen();
    await press(within(openModal()).getByText("닫기"));

    await pressLabel("알림 설정 열기");
    await press(within(openModal()).getByText("정각 기준"));
    await press(stepper("시작").plus);
    await press(within(openModal()).getByText("닫기"));

    await pressText("달력");
    await press(within(openModal()).getByText("<"));
    await press(within(openModal()).getByText("닫기"));

    await advance(60_000);
    await advance(60_000);

    setParams({ reminder: "settings" });
    await rerenderScreen();
    await rerenderScreen();

    expect(mainInput().props.value).toBe("I am walking.");
    expect(requestCoachHelp).toHaveBeenCalledTimes(1);
    expect(updateNowInEnglishScheduleMode).toHaveBeenCalledTimes(1);
    expect(updateNowInEnglishQuietHours).toHaveBeenCalledTimes(1);
    expectLoadCounts({ summary: 1, expressions: 1, reflection: 1, reflectionRequest: 1 });
  });

  it("[spec] 로그인한 채 같은 사용자 객체면 저장 표현을 다시 부르지 않고, 사용자 객체만 바뀌어도 다시 불러 표시를 바꾸며, 요약·돌아보기는 다시 부르지 않는다", async () => {
    jest
      .mocked(getSavedExpressions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedExpression(31, "curl up with a book")]);
    await renderScreen();
    expect(reflectionSaveState()).toEqual([
      ["표현 저장", "저장"],
      ["표현 저장", "저장"]
    ]);

    await rerenderScreen();
    expectLoadCounts({ summary: 1, expressions: 1, reflection: 1, reflectionRequest: 1 });

    setSessionUser({ ...signedInUser });
    await rerenderScreen();

    expectLoadCounts({ summary: 1, expressions: 2, reflection: 1, reflectionRequest: 1 });
    expect(getSavedExpressions).toHaveBeenLastCalledWith();
    expect(reflectionSaveState()).toEqual([
      ["표현 저장", "저장"],
      ["저장한 표현 취소", "저장됨"]
    ]);
  });

  it("[spec] 표현을 저장하는 중에 로그아웃하면 '저장 중' 표시를 풀고, 다시 로그인하면 저장 표현을 다시 불러 표시한다", async () => {
    await renderScreen();
    jest.mocked(saveExpression).mockReturnValueOnce(new Promise(() => undefined));
    await press(reflectionSaveButtons()[0]);
    expect(reflectionSaveState()[0]).toEqual(["표현 저장", "저장 중"]);
    expect(reflectionSaveButtons()[0]).toBeDisabled();

    setSessionUser(null);
    await rerenderScreen();

    expect(reflectionSaveState()).toEqual([
      ["표현 저장", "저장"],
      ["표현 저장", "저장"]
    ]);
    expect(reflectionSaveButtons()[0]).not.toBeDisabled();
    expect(getSavedExpressions).toHaveBeenCalledTimes(1);

    jest.mocked(getSavedExpressions).mockResolvedValueOnce([savedExpression(31, "curl up with a book")]);
    setSessionUser(signedInUser);
    await rerenderScreen();

    expect(getSavedExpressions).toHaveBeenCalledTimes(2);
    expect(reflectionSaveState()).toEqual([
      ["표현 저장", "저장"],
      ["저장한 표현 취소", "저장됨"]
    ]);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
  });
});

// ---------- 알림 설정 훅과 화면 ----------

describe("[spec] 알림 설정 훅과 화면 사이 값 전달", () => {
  it("[spec] 저장 뒤 목록 갱신(요약 다시 불러오기)이 받은 알림 설정을 요약 버튼과 설정 창에 반영한다", async () => {
    await renderScreen();
    expect(reminderSummaryTexts()).toEqual(["알림 설정", "알림이 꺼져 있어요", "OFF"]);

    // 다른 곳(알림 화면 등)에서 바뀐 설정이 기기 저장소에 있다고 둔다.
    storedSettings = reminderSettings({
      enabled: true,
      intervalHours: 3,
      scheduleMode: "FROM_NOW",
      quietHours: { enabled: false, startHour: 22, endHour: 7 }
    });
    await saveText("I am walking.");

    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(reminderSummaryTexts()).toEqual(["알림 설정", `다음 알림 · ${seoulTime("2026-11-12T06:00:00.000Z")}`, "ON"]);

    await pressLabel("알림 설정 열기");
    const modal = within(openModal());
    expect(modal.getByText("3시간마다")).toBeOnTheScreen();
    expect(modal.getByText("알림 끄기")).toBeOnTheScreen();
    expect(modal.getByText("설정한 순간부터 간격을 세요.")).toBeOnTheScreen();
    expect(modal.getByText("밤에도 알림을 받을 수 있어요.")).toBeOnTheScreen();
  });

  it("[spec] 꺼진 상태에서 시간이 지난 뒤 켜면 그때 시각으로 다음 알림을 계산하고 1분 시계가 돌기 시작하며, 끄면 시계가 멈춘다", async () => {
    storedSettings = reminderSettings({ scheduleMode: "FROM_NOW" });
    const setIntervalSpy = jest.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = jest.spyOn(globalThis, "clearInterval");
    const minuteClocks = () => setIntervalSpy.mock.calls.filter((call) => call[1] === 60_000).length;
    await renderScreen();
    expect(minuteClocks()).toBe(0);

    // 꺼져 있으면 1분 시계가 없으므로 30분이 지나도 화면 시계는 처음 그린 때(03:00)에 머문다.
    await advance(30 * 60_000);
    expect(reminderSummaryTexts()).toEqual(["알림 설정", "알림이 꺼져 있어요", "OFF"]);

    // 설정 시각을 과거로 돌려줘, 다음 알림이 화면 시계(지금 + 2시간)로 정해지게 한다.
    jest.mocked(enableNowInEnglishReminders).mockResolvedValueOnce(reminderSettings({ enabled: true, scheduleMode: "FROM_NOW" }));
    await pressLabel("알림 설정 열기");
    await press(within(openModal()).getByText("알림 켜기"));

    expect(enableNowInEnglishReminders).toHaveBeenCalledWith(2, { enabled: true, startHour: 23, endHour: 8 }, "FROM_NOW");
    expect(reminderSummaryTexts()).toEqual(["알림 설정", `다음 알림 · ${seoulTime("2026-11-12T05:30:00.000Z")}`, "ON"]);
    expect(minuteClocks()).toBe(1);
    const clockIndex = setIntervalSpy.mock.calls.findIndex((call) => call[1] === 60_000);
    const clockId = setIntervalSpy.mock.results[clockIndex].value as unknown;
    expect(clearIntervalSpy).not.toHaveBeenCalledWith(clockId);

    await advance(60_000);
    expect(reminderSummaryTexts()[1]).toBe(`다음 알림 · ${seoulTime("2026-11-12T05:31:00.000Z")}`);

    await press(within(openModal()).getByText("알림 끄기"));
    expect(reminderSummaryTexts()).toEqual(["알림 설정", "알림이 꺼져 있어요", "OFF"]);
    expect(clearIntervalSpy).toHaveBeenCalledWith(clockId);
    expect(minuteClocks()).toBe(1);
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("[spec] 알림 켜기는 앞서 바꾼 알림 기준·방해금지 시간·간격을 그대로 쓴다", async () => {
    await renderScreen();
    await pressLabel("알림 설정 열기");

    await press(within(openModal()).getByText("지금부터"));
    await press(stepper("시작").minus);
    await press(stepper("종료").plus);
    await press(stepper("알림 주기").plus);
    await press(stepper("알림 주기").plus);
    await press(within(openModal()).getByText("알림 켜기"));

    expect(enableNowInEnglishReminders).toHaveBeenCalledTimes(1);
    expect(enableNowInEnglishReminders).toHaveBeenCalledWith(4, { enabled: true, startHour: 22, endHour: 9 }, "FROM_NOW");
    expect(screen.getByText("4시간마다 지금 영어로 알림을 보내드릴게요.")).toBeOnTheScreen();

    // 켠 뒤 간격을 바꾸면 켠 설정의 기준·방해금지로 다시 켠다.
    await press(stepper("알림 주기").minus);
    expect(enableNowInEnglishReminders).toHaveBeenLastCalledWith(3, { enabled: true, startHour: 22, endHour: 9 }, "FROM_NOW");
  });
});

// ---------- 바로 코치 훅과 AI 코치 훅 ----------

describe("[spec] 바로 코치와 AI 코치 사이 값 전달", () => {
  it("[spec] AI 코치에게 더 물어보기로 연 코치 창은 수정해보기를 누르면 닫히고, 이대로 남기기로는 닫히지 않는다", async () => {
    await renderScreen();
    await saveText("I am walking.");
    await pressText("AI 코치에게 더 물어보기");
    expect(within(openModal()).getByText("AI 코치")).toBeOnTheScreen();

    await pressText("수정해보기");
    expect(modalHosts()).toHaveLength(0);
    expect(mainInput().props.value).toBe("I am walking.");
    expect(screen.getByText("기존 기록 수정 중")).toBeOnTheScreen();

    await pressText("AI 코치에게 더 물어보기");
    expect(within(openModal()).getByText("AI 코치")).toBeOnTheScreen();
    await pressText("이대로 남기기");

    expect(within(openModal()).getByText("AI 코치")).toBeOnTheScreen();
    expect(screen.queryByText("방금 문장 AI 코치")).toBeNull();
    expect(screen.queryByText("기존 기록 수정 중")).toBeNull();
    expect(coachInput().props.value).toBe("");
  });
});

// ---------- 기록 보기 훅 → 돌아보기 훅 → E5 ----------

describe("[spec] 기록 보기·돌아보기와 E5 사이 값 전달", () => {
  it("[spec] 날짜가 없는 전체 보기를 거치면 앞 돌아보기를 비워, 다른 날짜를 받는 동안 앞 날짜의 돌아보기가 남지 않는다", async () => {
    await renderScreen();
    expect(within(reflectionAiCard()).getByText(`${TODAY} 회고`)).toBeOnTheScreen();

    await pressText("전체");
    expect(screen.queryByText("AI 회고")).toBeNull();

    const yesterdayPending = deferred<NowInEnglishReflectionResponse>();
    jest.mocked(requestNowInEnglishReflection).mockReturnValueOnce(yesterdayPending.promise);
    await pressText("어제");

    expect(findHost(reflectionAiCard(), "Text").map(textOf)).toEqual(["AI 회고", "남긴 문장들을 살펴보고 있어요."]);
    expect(jest.mocked(requestNowInEnglishReflection).mock.calls.at(-1)).toStrictEqual([
      { dateKey: YESTERDAY, forceRefresh: false, entries: [{ text: y1.text, createdAt: y1.createdAt }] }
    ]);

    await act(async () => {
      yesterdayPending.resolve(reflectionResponse(YESTERDAY, 1));
    });
    await flushAsync();
    expect(within(reflectionAiCard()).getByText(`${YESTERDAY} 회고`)).toBeOnTheScreen();
  });

  it("[spec] 기록 없는 날짜를 거쳐도 앞 돌아보기를 비운다", async () => {
    await renderScreen();
    expect(within(reflectionAiCard()).getByText(`${TODAY} 회고`)).toBeOnTheScreen();

    await pressText("달력");
    await press(within(openModal()).getAllByText("10")[0]);
    expect(screen.queryByText("AI 회고")).toBeNull();

    jest.mocked(requestNowInEnglishReflection).mockReturnValueOnce(new Promise(() => undefined));
    await pressText("달력");
    await press(within(openModal()).getAllByText("5")[0]);

    expect(screen.getByText("2026년 11월 5일 목요일의 영어 조각")).toBeOnTheScreen();
    expect(findHost(reflectionAiCard(), "Text").map(textOf)).toEqual(["AI 회고", "남긴 문장들을 살펴보고 있어요."]);
  });
});
