// [spec] qa 테스트(작업 060-09, 새 기능: 라룹이 방의 창문 빛과 시간대). 화면 쪽: 시각을 다시 읽기와 개발 화면의 시각·달 조절.
// 기대값은 시나리오(060-09의 02-qa-scenarios.md S4, D1~D6)와 결정(03-main-decision.md: 시각 조절은 15분 단위, 달만 고르면
// 그달 15일, 고른 값은 "지금 시각으로"를 누르기 전까지 유지)에서만 가져온다. 구현 코드는 부르는 방법(속성 이름, 조절의 이름)을
// 알려고만 읽었다.
// 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 받은 daylight(햇빛·하루의 때·계절·천장 조명)를 본다.
// 06-main-decision.md: 스탠드를 빼고 보이지 않는 천장 조명을 둔다. 켜지고 꺼지는 때는 스탠드와 같다.
// 폰 시각은 가짜 시계로 2026-06-21 12:30(폰 시간대)에 고정한다. 홈(D6)은 home-lobby.spec.test.tsx와 같은 가짜를 둔다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getMobileHomeSnapshot,
  getMonthWritingStatus,
  getTodayWritingStatus,
  getWritingDraft,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { dayPhaseWeights } from "@/lib/lobby3d/daylight";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, FeaturedDailyPromptRecommendation, MobileHomeSnapshot, TodayWritingStatus } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  function useFocusEffect(effect: () => void | (() => void)) {
    React.useEffect(() => effect(), [effect]);
  }
  return { useFocusEffect };
});
jest.mock("expo-symbols", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { SymbolView: (props: object) => React.createElement("ExpoSymbolView", props) };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      return React.createElement("Lobby3dCanvasMock");
    }
  };
});
jest.mock("@/lib/api", () => ({
  getDiaryCalendarSummary: jest.fn(),
  getFeaturedDailyPrompt: jest.fn(),
  getLobbyLayout: jest.fn(() => Promise.resolve(null)),
  getMobileHomeSnapshot: jest.fn(),
  getMonthWritingStatus: jest.fn(),
  getTodayWritingStatus: jest.fn(),
  getWritingDraft: jest.fn(),
  trackDailyPromptClick: jest.fn()
}));
jest.mock("@/lib/app-overlay-status", () => ({ useAppOverlayStatus: jest.fn() }));
jest.mock("@/lib/home-tutorial", () => ({
  completeHomeTutorial: jest.fn(),
  consumeHomeTutorialReplay: jest.fn(),
  hasCompletedHomeTutorial: jest.fn()
}));
jest.mock("@/lib/incomplete-loop", () => ({ clearIncompleteLoop: jest.fn(), getIncompleteLoop: jest.fn() }));
jest.mock("@/lib/now-in-english", () => ({
  NOW_IN_ENGLISH_NOTIFICATION_BODY: "지금 뭐하고 있나요?, 무슨 생각하고 있나요?",
  getNowInEnglishSummary: jest.fn()
}));
jest.mock("@/lib/practice-feedback-state", () => ({ hydratePracticeFeedbackState: jest.fn() }));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/writing-drafts", () => ({ getLocalWritingDraft: jest.fn() }));

// ---------- 고정 데이터 ----------

const NOW = new Date(2026, 5, 21, 12, 30);
const TODAY_KEY = "2026-06-21";
const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function todayStatus(): TodayWritingStatus {
  return {
    date: TODAY_KEY,
    completed: true,
    completedSessions: 1,
    startedSessions: 1,
    streakDays: 2,
    totalAnswerSessions: 10,
    totalWrittenSentences: 20
  };
}

function featured(): FeaturedDailyPromptRecommendation {
  return {
    recommendedDate: TODAY_KEY,
    difficulty: "B",
    featured: {
      slot: "FEATURED",
      prompt: {
        id: "prompt-featured",
        topic: "Travel",
        topicCategory: "TRAVEL",
        topicDetail: "Next trip",
        difficulty: "B",
        questionEn: "Where would you like to travel next?",
        questionKo: "다음에 어디로 여행 가고 싶나요?",
        tip: "would like to를 써 보세요."
      },
      reasonCode: "RECENT_TOPIC",
      reasonText: "요즘 여행 이야기를 자주 썼어요.",
      reasonFacts: [],
      score: 1
    }
  };
}

function nowSummary(): NowInEnglishSummary {
  return {
    entries: [],
    todayEntries: [],
    todayCount: 0,
    settings: {
      enabled: false,
      intervalHours: 2,
      scheduleMode: "HOURLY_ANCHOR",
      notificationIds: [],
      scheduledReminderAts: [],
      quietHours: { enabled: true, startHour: 23, endHour: 8 },
      updatedAt: "2026-06-01T00:00:00.000Z"
    }
  };
}

function homeSnapshot(): MobileHomeSnapshot {
  return { todayStatus: todayStatus(), diaryCalendarSummary: { totalEntries: 0, days: [] }, featuredRecommendation: featured() };
}

// ---------- 도우미 ----------

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;
let appStateHandlers: ((state: AppStateStatus) => void)[] = [];

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

function daylight() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!.daylight;
}

async function renderDev() {
  devGlobal.__DEV__ = true;
  await render(<DevLobby3dRoute />);
  await flushAsync();
}

async function openPanel() {
  await fireEvent.press(screen.getByText("시험판 펴기"));
  await flushAsync();
}

async function nudge(name: "시각" | "달", action: "increment" | "decrement", times: number) {
  for (let index = 0; index < times; index += 1) {
    await fireEvent(screen.getByRole("adjustable", { name }), "accessibilityAction", { nativeEvent: { actionName: action } });
  }
  await flushAsync();
}

function sliderValue(name: "시각" | "달") {
  return screen.getByRole("adjustable", { name }).props.accessibilityValue as { min: number; max: number; now: number };
}

/** 시험판에서 21시·12월을 고른다(지금 12:30·6월에서 15분씩 34번, 달 6번). */
async function pickNineAtNightInDecember() {
  await nudge("시각", "increment", 34);
  await nudge("달", "increment", 6);
  expect(sliderValue("시각").now).toBe(21);
  expect(sliderValue("달").now).toBe(12);
}

function expectWinterNight() {
  const d = daylight();
  expect(d.season).toBe("winter");
  expect(d.phase).toBe("night");
  expect(dayPhaseWeights(d.sun).night).toBeCloseTo(1, 9);
  expect(d.ceilingLight).toBe(true);
}

/** 폰 시각 2026-06-21 12:30: 여름, 낮 = 1, 천장 조명 꺼짐, 해 방위 180°(남중). */
function expectPhoneNoonInJune() {
  const d = daylight();
  expect(d.season).toBe("summer");
  expect(d.phase).toBe("day");
  expect(dayPhaseWeights(d.sun).day).toBeCloseTo(1, 9);
  expect(d.ceilingLight).toBe(false);
  expect(Math.abs(d.sun.azimuth - 180)).toBeLessThanOrEqual(0.5);
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  appStateHandlers = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((type, handler) => {
    if (type === "change") appStateHandlers.push(handler as (state: AppStateStatus) => void);
    return { remove: jest.fn() };
  });
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue({ totalEntries: 0, days: [] });
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockResolvedValue(featured());
  jest.mocked(getMonthWritingStatus).mockReset().mockResolvedValue(null);
  jest.mocked(getWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(trackDailyPromptClick).mockReset().mockResolvedValue(undefined);
  jest.mocked(getIncompleteLoop).mockReset().mockResolvedValue(null);
  jest.mocked(clearIncompleteLoop).mockReset().mockResolvedValue(undefined);
  jest.mocked(getLocalWritingDraft).mockReset().mockResolvedValue(null);
  jest.mocked(hydratePracticeFeedbackState).mockReset().mockResolvedValue(null);
  jest.mocked(getNowInEnglishSummary).mockReset().mockResolvedValue(nowSummary());
  jest.mocked(consumeHomeTutorialReplay).mockReset().mockResolvedValue(false);
  jest.mocked(hasCompletedHomeTutorial).mockReset().mockResolvedValue(true);
  jest.mocked(completeHomeTutorial).mockReset().mockResolvedValue(undefined);
  jest.mocked(useSession).mockReturnValue({
    currentUser: signedInUser,
    isHydrating: false,
    refreshSession: jest.fn(() => Promise.resolve(signedInUser)),
    setSessionUser: jest.fn(),
    signIn: jest.fn(),
    signInWithApple: jest.fn(),
    signInWithSocial: jest.fn(),
    signOut: jest.fn()
  });
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- 다시 정하기 ----------

describe("[spec] 시각을 다시 정하기(S4)", () => {
  it("S4 (가): 60초가 지나면 바뀐 폰 시각으로 다시 정하고, 그 전에는 다시 정하지 않는다", async () => {
    await renderDev();
    expectPhoneNoonInJune();

    jest.setSystemTime(new Date(2026, 11, 21, 21, 0));
    await advance(30_000);
    expectPhoneNoonInJune();

    await advance(30_000);
    expectWinterNight();
  });

  it("S4 (나): 앱이 배경에서 돌아오면(active) 바뀐 폰 시각으로 다시 정한다", async () => {
    await renderDev();
    expectPhoneNoonInJune();

    jest.setSystemTime(new Date(2026, 11, 21, 21, 0));
    await act(async () => {
      appStateHandlers.forEach((handler) => handler("active"));
    });
    await flushAsync();

    expectWinterNight();
  });
});

// ---------- 개발 화면 ----------

describe("[spec] 개발 화면에서 미리 보기(D1~D5)", () => {
  it("D1: 시험판을 펴면 시각(0~24시, 15분 단위)·달(1~12월) 조절과 '지금 시각으로' 버튼이 있다", async () => {
    await renderDev();
    await openPanel();

    expect(sliderValue("시각")).toMatchObject({ min: 0, max: 24 });
    expect(sliderValue("달")).toMatchObject({ min: 1, max: 12 });
    expect(screen.getByRole("button", { name: "지금 시각으로" })).toBeOnTheScreen();

    // 03 결정: 15분 단위
    const before = sliderValue("시각").now;
    await nudge("시각", "increment", 1);
    expect(sliderValue("시각").now).toBeCloseTo(before + 0.25, 9);
  });

  it("D2: 21시·12월을 고르면 그 시각·계절(겨울, 밤 = 1, 천장 조명 켜짐)로 보인다", async () => {
    await renderDev();
    await openPanel();
    await pickNineAtNightInDecember();

    expectWinterNight();
    expect(daylight().sun.elevation).toBeLessThan(-6);
  });

  it("D3: 12:30에 달만 4월로 고르면 봄, 낮 = 1, 천장 조명 꺼짐, 해 방위 180°", async () => {
    await renderDev();
    await openPanel();
    expect(sliderValue("시각").now).toBe(12.5);
    await nudge("달", "decrement", 2);
    expect(sliderValue("달").now).toBe(4);

    const d = daylight();
    expect(d.season).toBe("spring");
    expect(d.phase).toBe("day");
    expect(dayPhaseWeights(d.sun).day).toBeCloseTo(1, 9);
    expect(d.ceilingLight).toBe(false);
    expect(Math.abs(d.sun.azimuth - 180)).toBeLessThanOrEqual(0.5);
  });

  it("D4: 고른 뒤 '지금 시각으로'를 누르면 폰 시각(6월 21일 12:30)으로 돌아간다", async () => {
    await renderDev();
    await openPanel();
    await pickNineAtNightInDecember();
    expectWinterNight();

    await fireEvent.press(screen.getByRole("button", { name: "지금 시각으로" }));
    await flushAsync();

    expectPhoneNoonInJune();
  });

  it("D5: 고른 값은 1분이 지나도 '지금 시각으로'를 누르기 전까지 그대로다", async () => {
    await renderDev();
    await openPanel();
    await pickNineAtNightInDecember();

    await advance(60_000);
    expectWinterNight();
    await advance(60_000);
    expectWinterNight();
  });
});

describe("[spec] 홈에는 시험판이 없다(D6)", () => {
  for (const dev of [false, true]) {
    it(`D6 ${dev ? "개발" : "출시"} 빌드: 홈에 시각·달 조절과 '지금 시각으로'가 없고, 폰 시각 그대로 보인다`, async () => {
      devGlobal.__DEV__ = dev;
      await render(<HomeScreen />);
      await flushAsync();

      expect(screen.queryByRole("adjustable", { name: "시각" })).toBeNull();
      expect(screen.queryByRole("adjustable", { name: "달" })).toBeNull();
      expect(screen.queryByText("지금 시각으로")).toBeNull();
      expect(screen.queryByText("시험판 펴기")).toBeNull();
      expectPhoneNoonInJune();
    });
  }
});
