// [spec] qa 테스트(작업 086-④ 적립 알림, 새 기능, 모바일): 지금 영어로 저장 뒤 상태 문구에 붙는 룹 적립 안내.
// 기대값은 시나리오(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/05-적립-알림/02-qa-scenarios-mobile.md 3-2절 N3~N10)와
// 결정 파일(04-main-decision.md 3번: 저장 뒤 기록을 다시 불러오지 못해 상태 문구가 "저장은 됐어요. 기록 목록은 잠시 후 다시
// 갱신해 주세요."로 바뀌어도, 적립했으면 그 뒤에 한 칸 띄우고 안내를 붙인다 → N11)에서만 가져온다.
// 지금 영어로 화면(src/app/now.tsx)을 렌더하고 사용자처럼 쓰고 누른다. 구현 코드는 화면·함수 이름과 버튼 문구를 알려고만 읽었다.
// 가짜는 네트워크 층(@/lib/api: 서버 저장 createNowInEnglishEntry, 서버 목록 getNowInEnglishEntries, 현재 사용자 getCurrentUser,
// 코치 피드백 등)까지만 둔다. 기기 저장 층의 저장 함수(saveNowInEnglishEntry)는 실제 것을 써서, 서버 응답의 loopPoints가 저장 층을
// 지나 화면까지 오는지를 본다. 화면이 열릴 때·저장 뒤 부르는 기록 불러오기(getNowInEnglishSummary)와 알림·회고 함수는 가짜다.
// 기기 저장소는 AsyncStorage 가짜, 알림(expo-notifications)은 비운다. 날짜가 오늘에 기대므로 가짜 시계로 돌린다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
import type { TestInstance } from "test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NowInEnglishScreen from "@/app/now";
import {
  createNowInEnglishEntry,
  deleteSavedExpression,
  getCurrentUser,
  getNowInEnglishEntries,
  getSavedExpressions,
  requestCoachHelp,
  requestNowInEnglishCoachFeedback,
  requestNowInEnglishReflection,
  saveExpression,
  syncNowInEnglishEntries
} from "@/lib/api";
import {
  getNowInEnglishAiReflection,
  getNowInEnglishSummary,
  saveNowInEnglishAiReflection,
  type NowInEnglishEntry,
  type NowInEnglishReminderSettings,
  type NowInEnglishSummary
} from "@/lib/now-in-english";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  LoopPointsReward,
  NowInEnglishCoachFeedbackResponse,
  NowInEnglishEntryPayload,
  NowInEnglishEntryRequest
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
  createNowInEnglishEntry: jest.fn(),
  deleteSavedExpression: jest.fn(),
  getCurrentUser: jest.fn(),
  getNowInEnglishEntries: jest.fn(),
  getSavedExpressions: jest.fn(),
  requestCoachHelp: jest.fn(),
  requestNowInEnglishCoachFeedback: jest.fn(),
  requestNowInEnglishReflection: jest.fn(),
  saveExpression: jest.fn(),
  syncNowInEnglishEntries: jest.fn()
}));
// 저장 함수(saveNowInEnglishEntry)는 실제 것. 기록 불러오기·알림·회고만 가짜로 둔다.
jest.mock("@/lib/now-in-english", () => ({
  ...jest.requireActual<typeof import("@/lib/now-in-english")>("@/lib/now-in-english"),
  disableNowInEnglishReminders: jest.fn(),
  enableNowInEnglishReminders: jest.fn(),
  getNowInEnglishAiReflection: jest.fn(),
  getNowInEnglishSummary: jest.fn(),
  saveNowInEnglishAiReflection: jest.fn(),
  updateNowInEnglishQuietHours: jest.fn(),
  updateNowInEnglishScheduleMode: jest.fn()
}));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY = "2026-11-12";
const MAIN_PLACEHOLDER = "I’m doing something small right now.";
const signedInUser: AuthUser = { id: 864, email: "now-loop@example.com", displayName: "학습자", admin: false };

// 시나리오 0절의 loopPoints 값
const N_EARNED: LoopPointsReward = { activity: "nowInEnglish", earned: 10, balance: 270, dailyLimitReached: false };
const N_LIMIT: LoopPointsReward = { activity: "nowInEnglish", earned: 0, balance: 270, dailyLimitReached: true };
const N_NEITHER: LoopPointsReward = { activity: "nowInEnglish", earned: 0, balance: 270, dailyLimitReached: false };

const SAVED = "좋아요. 오늘의 영어 조각이 하나 쌓였어요.";
const POLISHED = "좋아요. 다듬은 문장의 전후를 기록했어요.";
const REFRESH_FAILED = "저장은 됐어요. 기록 목록은 잠시 후 다시 갱신해 주세요.";

function reminderSettings(): NowInEnglishReminderSettings {
  return {
    enabled: false,
    intervalHours: 2,
    scheduleMode: "HOURLY_ANCHOR",
    notificationIds: [],
    scheduledReminderAts: [],
    quietHours: { enabled: true, startHour: 23, endHour: 8 },
    updatedAt: "2026-11-01T00:00:00.000Z"
  };
}

function coachFeedback(originalText: string): NowInEnglishCoachFeedbackResponse {
  return {
    originalText,
    headlineKo: "장면이 잘 보여요",
    praiseKo: "현재진행형으로 지금을 잘 담았어요.",
    suggestionEn: "I'm curled up with a book.",
    suggestionTranslationKo: "책을 읽으며 쉬고 있어요.",
    suggestionKo: "curl up with a book도 자연스러워요.",
    nextQuestionKo: "무슨 책인가요?",
    expression: "curl up with a book",
    expressionMeaningKo: "편히 앉아 책을 읽다",
    expressionExampleEn: "I curled up with a book."
  };
}

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
let alertSpy: jest.SpyInstance;
// 서버 저장 응답에 담을 loopPoints(저장 차례대로). 값이 undefined면 키를 넣지 않는다.
let serverLoopPoints: (LoopPointsReward | null | undefined)[] = [];
let serverEntries: NowInEnglishEntryPayload[] = [];

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

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderScreen() {
  await render(<NowInEnglishScreen />);
  await flushAsync();
}

function mainInput() {
  return screen.getByPlaceholderText(MAIN_PLACEHOLDER);
}

async function typeInto(input: TestInstance, value: string) {
  await fireEvent.changeText(input, value);
  await flushAsync();
}

async function pressText(text: string) {
  await fireEvent.press(screen.getAllByText(text)[0]);
  await flushAsync();
}

async function saveText(value: string) {
  await typeInto(mainInput(), value);
  await pressText("저장하기");
}

function summaryOf(entries: NowInEnglishEntry[]): NowInEnglishSummary {
  return { entries, todayEntries: [], todayCount: 0, settings: reminderSettings() };
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  serverLoopPoints = [];
  serverEntries = [];
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(useLocalSearchParams).mockReturnValue({} as ReturnType<typeof useLocalSearchParams>);
  jest.mocked(getCurrentUser).mockReset().mockResolvedValue(signedInUser);
  jest.mocked(createNowInEnglishEntry).mockReset().mockImplementation(async (request: NowInEnglishEntryRequest) => {
    const loopPoints = serverLoopPoints.shift();
    const entry: NowInEnglishEntryPayload = {
      id: request.id ?? "server-id",
      text: request.text,
      polishedFromEntryId: request.polishedFromEntryId ?? null,
      polishedFromText: request.polishedFromText ?? null,
      createdAt: request.createdAt ?? NOW.toISOString(),
      dateKey: request.dateKey ?? TODAY,
      ...(loopPoints !== undefined ? { loopPoints } : {})
    };
    const { loopPoints: _ignored, ...stored } = entry;
    serverEntries = [stored, ...serverEntries.filter((item) => item.id !== stored.id)];
    return entry;
  });
  jest.mocked(getNowInEnglishEntries).mockReset().mockImplementation(async () => serverEntries.slice());
  jest.mocked(syncNowInEnglishEntries).mockReset().mockResolvedValue([]);
  jest.mocked(getNowInEnglishSummary).mockReset().mockImplementation(async () => summaryOf(serverEntries.slice()));
  jest.mocked(getNowInEnglishAiReflection).mockReset().mockResolvedValue(null);
  jest.mocked(saveNowInEnglishAiReflection).mockReset().mockImplementation(async (reflection) => reflection);
  jest.mocked(requestNowInEnglishReflection).mockReset().mockImplementation(async (request) => ({
    dateKey: request.dateKey,
    entryCount: request.entries.length,
    headlineKo: "책과 함께한 하루",
    summaryKo: "짧은 문장으로 장면을 남겼어요.",
    highlightsKo: [],
    patternKo: "",
    gentleCorrectionKo: "",
    nextActionKo: "",
    nextActionExampleEn: "",
    expressions: [],
    closingKo: ""
  }));
  jest
    .mocked(requestNowInEnglishCoachFeedback)
    .mockReset()
    .mockImplementation(async (request) => coachFeedback(request.text));
  jest.mocked(requestCoachHelp).mockReset();
  jest.mocked(getSavedExpressions).mockReset().mockResolvedValue([]);
  jest.mocked(saveExpression).mockReset();
  jest.mocked(deleteSavedExpression).mockReset().mockResolvedValue(undefined);
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.useRealTimers();
});

// ---------- 3-2절 ----------

describe("[spec] 086-④ 지금 영어로 저장 뒤 상태 문구의 룹 적립 안내(시나리오 3-2절)", () => {
  it("[spec] N3 새 조각 저장 응답이 적립 10이면 상태 문구가 '… 쌓였어요. +10룹 쌓였어요'다", async () => {
    serverLoopPoints = [N_EARNED];
    await renderScreen();
    await saveText("I am reading a book.");

    expect(createNowInEnglishEntry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(`${SAVED} +10룹 쌓였어요`)).toBeOnTheScreen();
  });

  it("[spec] N4 새 조각 저장 응답이 한도(적립 0)면 상태 문구가 '… 쌓였어요. 오늘 지금 영어로 룹은 다 모았어요'다", async () => {
    serverLoopPoints = [N_LIMIT];
    await renderScreen();
    await saveText("I am reading a book.");

    expect(screen.getByText(`${SAVED} 오늘 지금 영어로 룹은 다 모았어요`)).toBeOnTheScreen();
  });

  it("[spec] N5 저장 응답의 loopPoints가 null이면 상태 문구는 원래 문장 그대로다", async () => {
    serverLoopPoints = [null];
    await renderScreen();
    await saveText("I am reading a book.");

    expect(screen.getByText(SAVED)).toBeOnTheScreen();
    expect(screen.queryAllByText(/룹/)).toHaveLength(0);
  });

  it("[spec] N6 적립 0이고 한도도 아니면 상태 문구는 원래 문장 그대로다", async () => {
    serverLoopPoints = [N_NEITHER];
    await renderScreen();
    await saveText("I am reading a book.");

    expect(screen.getByText(SAVED)).toBeOnTheScreen();
    expect(screen.queryAllByText(/룹/)).toHaveLength(0);
  });

  it("[spec] N7 '+10룹'을 받은 뒤 그 조각을 다듬어 저장(응답 null)하면 상태 문구가 '좋아요. 다듬은 문장의 전후를 기록했어요.'만이다", async () => {
    serverLoopPoints = [N_EARNED, null];
    await renderScreen();
    await saveText("I am reading a book.");
    expect(screen.getByText(`${SAVED} +10룹 쌓였어요`)).toBeOnTheScreen();

    await pressText("수정해보기");
    await typeInto(mainInput(), "I'm curled up with a book.");
    await pressText("수정 저장하기");

    expect(createNowInEnglishEntry).toHaveBeenCalledTimes(2);
    expect(jest.mocked(createNowInEnglishEntry).mock.calls[1][0].polishedFromText).toBe("I am reading a book.");
    expect(screen.getByText(POLISHED)).toBeOnTheScreen();
    expect(screen.queryAllByText(/룹 쌓였어요/)).toHaveLength(0);
    expect(screen.queryAllByText(/룹은 다 모았어요/)).toHaveLength(0);
  });

  it("[spec] N8 서버 저장이 네트워크 오류면 기기에 저장되고, 상태 문구는 원래 문장이며 실패 알림은 없고 조각이 기록에 보인다", async () => {
    jest.mocked(createNowInEnglishEntry).mockRejectedValueOnce(new TypeError("Network request failed"));
    // 기록 불러오기는 실제 것: 기기에 저장된 조각을 읽어 기록에 보인다(서버 목록은 비어 있고, 다시 올리기는 가짜가 받는다).
    const actualNow = jest.requireActual<typeof import("@/lib/now-in-english")>("@/lib/now-in-english");
    jest.mocked(getNowInEnglishSummary).mockImplementation(() => actualNow.getNowInEnglishSummary());
    await renderScreen();
    await saveText("I am reading a book.");

    expect(createNowInEnglishEntry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(SAVED)).toBeOnTheScreen();
    expect(screen.queryAllByText(/룹/)).toHaveLength(0);
    expect(alertSpy).not.toHaveBeenCalledWith("저장하지 못했어요", expect.anything());
    expect(screen.getByText("1개 남겼어요")).toBeOnTheScreen();
    const timeline = screen.getByText("1개 남겼어요").parent!.parent!;
    const timelineTexts = timeline
      .queryAll((instance) => instance.type === "Text")
      .map((node) => node.children.filter((child): child is string => typeof child === "string").join(""));
    expect(timelineTexts).toContain("I am reading a book.");
  });

  it("[spec] N9 손님이 저장하면 서버 저장을 부르지 않고 상태 문구는 원래 문장이다", async () => {
    setSessionUser(null);
    refreshSession.mockResolvedValue(null);
    jest.mocked(getCurrentUser).mockResolvedValue(null);
    await renderScreen();
    await saveText("I am reading a book.");

    expect(createNowInEnglishEntry).not.toHaveBeenCalled();
    expect(screen.getByText(SAVED)).toBeOnTheScreen();
    expect(screen.queryAllByText(/룹/)).toHaveLength(0);
  });

  it("[spec] N10 '+10룹'을 받은 뒤 두 번째 새 조각의 응답이 null이면 상태 문구가 원래 문장이다", async () => {
    serverLoopPoints = [N_EARNED, null];
    await renderScreen();
    await saveText("I am reading a book.");
    expect(screen.getByText(`${SAVED} +10룹 쌓였어요`)).toBeOnTheScreen();

    await saveText("I am drinking coffee.");

    expect(createNowInEnglishEntry).toHaveBeenCalledTimes(2);
    expect(screen.getByText(SAVED)).toBeOnTheScreen();
    expect(screen.queryAllByText(/룹/)).toHaveLength(0);
  });

  it("[spec] N11(04 결정 3) 적립 10으로 저장된 뒤 기록을 다시 불러오지 못하면 '저장은 됐어요. … +10룹 쌓였어요'다", async () => {
    serverLoopPoints = [N_EARNED];
    await renderScreen();
    jest.mocked(getNowInEnglishSummary).mockRejectedValueOnce(new Error("목록 오류"));
    await saveText("I am reading a book.");

    expect(screen.getByText(`${REFRESH_FAILED} +10룹 쌓였어요`)).toBeOnTheScreen();
  });
});
