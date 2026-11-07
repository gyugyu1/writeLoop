// [spec] qa 테스트(작업 060-10, 새 기능: 홈 로비에 들어올 때 학습 상태에 따른 말과 동작, 오래 두면 앉기).
// 기대값은 시나리오(060-10의 02-qa-scenarios.md J1~J16, P1~P4, N1·N2, G1~G5, E1~E5, T1·T2, R1~R4, K11·K12)와
// 결정(04-main-decision.md: M1 방 안을 누를 때만 인사 말이 바뀜, M2 받은 정보만으로 판정, M3 오늘은 폰 날짜, M4 첫 방문 인사에도 이어 쓰기 버튼,
// M5 앉아 있으면 일어나서 인사, M6 홈을 보는 동안만 20초를 세고 돌아오면 처음부터)에서만 가져온다.
// 구현 코드는 부르는 방법(3D 그리기에 넘기는 속성, sim의 posture, 3D 그리기가 프레임 시간을 0.05초로 잘라 넘기는 것)을 알려고만 읽었다.
// 가짜로 두는 것: 060-03 홈 테스트(home-lobby.spec.test.tsx)와 같다. 3D 그리기는 받은 속성(sim, onFrame, onPointer, onProject)을 잡아
// 프레임을 진행하고 누르기를 보낸다. 프레임마다 시계도 0.05초씩 옮긴다(타이머는 돌리지 않는다).
// 가짜 시계: 2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00. 오늘 작문 상태의 date도 같은 날로 둔다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { AccessibilityInfo, AppState } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps, LobbyProjection } from "@/components/lobby3d/lobby3d-canvas";
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
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import type { FloorPoint, MarkId } from "@/lib/lobby3d/engine";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  DiaryCalendarSummary,
  FeaturedDailyPromptRecommendation,
  MobileHomeSnapshot,
  MonthWritingStatus,
  Prompt,
  TodayWritingStatus,
  WritingDraft
} from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

const mockFocus = { focused: true, listeners: new Set<() => void>() };
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
    const [focused, setFocused] = React.useState(mockFocus.focused);
    React.useEffect(() => {
      const listener = () => setFocused(mockFocus.focused);
      mockFocus.listeners.add(listener);
      return () => {
        mockFocus.listeners.delete(listener);
      };
    }, []);
    React.useEffect(() => {
      if (!focused) {
        return undefined;
      }
      return effect();
    }, [focused, effect]);
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

// ---------- 기대 문구(명세 1의 표 그대로) ----------

const FIRST = "안녕! 게시판에서 오늘의 질문을 골라 봐.";
const RESUME = "쓰다 만 답이 있어. 이어서 써 볼까?";
const DONE = "오늘도 해냈어!";
const LONG_TIME = "오랜만이야! 보고 싶었어.";
const IDLE_LINE = "오늘은 뭘 해 볼까?\n가고 싶은 곳을 눌러 봐.";
const streakLine = (days: number) => `${days}일째 함께하고 있어!`;
const BOARD_PROMPT = "오늘의 질문 게시판이야.\n질문에 답하러 갈까?";
const SKIP_LABEL = "홈 사용법 건너뛰기";
const ALL_GREETING_LINES = [FIRST, RESUME, DONE, LONG_TIME, IDLE_LINE];

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

const featuredPrompt: Prompt = {
  id: "prompt-featured",
  topic: "Travel",
  topicCategory: "TRAVEL",
  topicDetail: "Next trip",
  difficulty: "B",
  questionEn: "Where would you like to travel next?",
  questionKo: "다음에 어디로 여행 가고 싶나요?",
  tip: "would like to를 써 보세요."
};

function featured(): FeaturedDailyPromptRecommendation {
  return {
    recommendedDate: TODAY_KEY,
    difficulty: "B",
    featured: {
      slot: "FEATURED",
      prompt: featuredPrompt,
      reasonCode: "RECENT_TOPIC",
      reasonText: "요즘 여행 이야기를 자주 썼어요.",
      reasonFacts: [],
      score: 1
    }
  };
}

/** 기준 B(평범한 상태): 작문 5회, 오늘 미완료, 연속 0일. */
function status(overrides: Partial<TodayWritingStatus> = {}): TodayWritingStatus {
  return {
    date: TODAY_KEY,
    completed: false,
    completedSessions: 0,
    startedSessions: 0,
    streakDays: 0,
    totalAnswerSessions: 5,
    totalWrittenSentences: 20,
    ...overrides
  };
}

function diary(totalEntries = 2): DiaryCalendarSummary {
  return { totalEntries, days: [] };
}

function snapshot(today: Partial<TodayWritingStatus> = {}, diaryEntries = 2): MobileHomeSnapshot {
  return { todayStatus: status(today), diaryCalendarSummary: diary(diaryEntries), featuredRecommendation: featured() };
}

/** 오늘 완료 데이터(J6). */
const DONE_TODAY: Partial<TodayWritingStatus> = { completed: true, completedSessions: 1, startedSessions: 1, streakDays: 1 };

type DayMark = { date: string; started?: boolean; completed?: boolean };

function month(year: number, monthNumber: number, days: DayMark[] = []): MonthWritingStatus {
  return {
    year,
    month: monthNumber,
    streakDays: 0,
    days: days.map((day) => {
      const completed = day.completed ?? false;
      const started = day.started ?? completed;
      return {
        date: day.date,
        started,
        completed,
        startedSessions: started ? 1 : 0,
        completedSessions: completed ? 1 : 0,
        isToday: day.date === TODAY_KEY
      };
    })
  };
}

/** 작문 달력: "연-월" → 그 달에 작문한 날. 없는 달은 빈 달. */
function setMonths(days: Record<string, DayMark[]>) {
  jest
    .mocked(getMonthWritingStatus)
    .mockImplementation(async (year: number, monthNumber: number) => month(year, monthNumber, days[`${year}-${monthNumber}`] ?? []));
}

/** 기준 B의 작문 달력: 11월 11일(어제) 하나. */
const BASE_MONTHS: Record<string, DayMark[]> = { "2026-11": [{ date: "2026-11-11", completed: true }] };

const SAVED_AT = new Date(2026, 10, 12, 9, 5).toISOString();

function loop(): IncompleteLoopState {
  return {
    promptId: "prompt-loop",
    difficulty: "A",
    step: "answer",
    updatedAt: SAVED_AT,
    promptSnapshot: { topic: "Morning", questionEn: "What do you usually do in the morning?", questionKo: "아침에 보통 무엇을 하나요?" }
  };
}

function writingDraft(): WritingDraft {
  return {
    promptId: "prompt-loop",
    draftType: "ANSWER",
    selectedDifficulty: "A",
    sessionId: "",
    answer: "I drink coffee.",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    updatedAt: SAVED_AT
  };
}

/** 기준 L: 유효한 끝내지 않은 답(답 단계, 서버 초안 있음). */
function arrangeIncomplete() {
  jest.mocked(getIncompleteLoop).mockResolvedValue(loop());
  jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
}

const RESUME_ROUTE = { pathname: "/practice/write", params: { difficulty: "A", promptId: "prompt-loop" } };

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
      updatedAt: "2026-11-01T00:00:00.000Z"
    }
  };
}

const LABELS: LobbyProjection["labels"] = {
  board: { x: 150, y: 260 },
  window: { x: 560, y: 260 },
  desk: { x: 150, y: 900 },
  door: { x: 690, y: 300 }
};

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function sim() {
  return canvas().sim;
}

/** 프레임을 seconds초만큼 진행한다. 3D 그리기처럼 한 프레임 0.05초, 시계도 같이 옮긴다. */
async function frames(seconds: number) {
  const count = Math.round(seconds / 0.05);
  await act(async () => {
    for (let index = 0; index < count; index += 1) {
      jest.setSystemTime(Date.now() + 50);
      canvas().onFrame(0.05, Date.now());
    }
  });
}

async function framesUntil(maxSeconds: number, done: () => boolean) {
  for (let elapsed = 0; elapsed < maxSeconds && !done(); elapsed += 0.05) {
    await frames(0.05);
  }
  return done();
}

async function renderHome() {
  const view = await render(<HomeScreen />);
  await flushAsync();
  return view;
}

/**
 * 준비 A: 홈 정보 응답을 미뤄 둔 채 프레임을 3초 진행해 두고(정보가 오기 전의 동작이 있다면 끝나게), 정보를 돌려준다.
 * 돌려준 뒤에는 프레임을 더 진행하지 않으므로, 바로 인사 동작을 볼 수 있다.
 */
async function renderWithGreetingReady(data: MobileHomeSnapshot) {
  const pending = deferred<MobileHomeSnapshot>();
  jest.mocked(getMobileHomeSnapshot).mockResolvedValue(data).mockReturnValueOnce(pending.promise);
  await renderHome();
  await frames(3);
  await act(async () => {
    pending.resolve(data);
  });
  await flushAsync();
}

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

function appStateListenersSince(callIndex: number) {
  return jest
    .mocked(AppState.addEventListener)
    .mock.calls.slice(callIndex)
    .filter(([type]) => type === "change")
    .map(([, listener]) => listener as (state: string) => void);
}

async function sendAppState(listeners: ((state: string) => void)[], state: string) {
  await act(async () => {
    listeners.forEach((listener) => listener(state));
  });
  await flushAsync();
}

/** 말풍선 글이 line이고, 다른 인사 말은 보이지 않는다. */
function expectBubble(line: string) {
  expect(screen.getByText(line)).toBeOnTheScreen();
  for (const other of ALL_GREETING_LINES.filter((text) => text !== line)) {
    expect(screen.queryByText(other)).toBeNull();
  }
  if (!line.endsWith("일째 함께하고 있어!")) {
    expect(screen.queryByText(/일째 함께하고 있어!$/)).toBeNull();
  }
}

function actionType() {
  return sim().action?.type ?? null;
}

function isSitting() {
  const kind = sim().posture?.kind;
  return kind === "sitting-down" || kind === "sitting";
}

async function tapCharacter() {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark: null, onCharacter: true }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", { point: null, mark: null, onCharacter: true }, 200, 300);
  });
}

async function tapMark(mark: MarkId) {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", { point: null, mark, onCharacter: false }, 200, 300);
  });
}

async function tapFloor(point: FloorPoint) {
  await act(async () => {
    canvas().onPointer("down", { point, mark: null, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", { point, mark: null, onCharacter: false }, 200, 300);
  });
}

async function walkUntilArrived(mark: MarkId) {
  expect(await framesUntil(20, () => sim().arrived === mark)).toBe(true);
  await frames(0.25);
}

async function walkUntilStoppedAt(point: FloorPoint) {
  expect(
    await framesUntil(20, () => {
      const s = sim();
      return Math.abs(s.x - point.x) < 1e-6 && Math.abs(s.z - point.z) < 1e-6 && s.vx === 0 && s.vz === 0;
    })
  ).toBe(true);
  await frames(0.1);
}

function bubbleOf(line: string) {
  return screen.getByText(line).parent!;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.back).mockReset();
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(snapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(status());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue(diary());
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockResolvedValue(featured());
  jest.mocked(getMonthWritingStatus).mockReset();
  setMonths(BASE_MONTHS);
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
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
  // 기기 설정 "동작 줄이기"는 기본 끔. R1~R4만 켠다.
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  jest.useRealTimers();
});

// ---------- J. 상태 판정 ----------

describe("[spec] 상태 판정(J1~J16)", () => {
  it("J1: 작문 0회·일기 0편이면 첫 방문 말과 wave. 말에 '나는 라룹이야'가 없다", async () => {
    setMonths({});
    await renderWithGreetingReady(snapshot({ totalAnswerSessions: 0 }, 0));

    expectBubble(FIRST);
    expect(screen.queryByText(/나는 라룹이야/)).toBeNull();
    expect(actionType()).toBe("wave");
  });

  it("J2: 작문 0회·일기 2편이면 첫 방문이 아니고, 오랜만도 아니어서 그 밖(기본 말, wave)", async () => {
    setMonths({});
    await renderWithGreetingReady(snapshot({ totalAnswerSessions: 0 }, 2));

    expectBubble(IDLE_LINE);
    expect(actionType()).toBe("wave");
  });

  it("J3: 작문 1회·일기 0편, 두 달에 기록이 없으면 첫 방문이 아니라 오랜만(wave)", async () => {
    setMonths({});
    await renderWithGreetingReady(snapshot({ totalAnswerSessions: 1 }, 0));

    expectBubble(LONG_TIME);
    expect(actionType()).toBe("wave");
  });

  it("J4: 끝내지 않은 답이 있으면 이어 쓰기 말과 같은 말풍선의 '이어 쓰기' 버튼, point. 버튼은 이어 쓰던 곳으로 간다", async () => {
    arrangeIncomplete();
    await renderWithGreetingReady(snapshot());

    expectBubble(RESUME);
    const button = screen.getByRole("button", { name: "이어 쓰기" });
    expect(within(bubbleOf(RESUME)).getByRole("button", { name: "이어 쓰기" })).toBe(button);
    expect(actionType()).toBe("point");

    await fireEvent.press(button);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(RESUME_ROUTE);
  });

  it("J5: 이어 쓰기 정보가 있어도 이 기기·서버 초안이 없으면(버튼을 붙이지 않는 조건) 이어 쓰기 말이 아니고 버튼도 없다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop());
    await renderWithGreetingReady(snapshot());

    expectBubble(IDLE_LINE);
    expect(screen.queryByRole("button", { name: "이어 쓰기" })).toBeNull();
  });

  it("J6: 오늘 작문을 마쳤으면 '오늘도 해냈어!'와 jump", async () => {
    await renderWithGreetingReady(snapshot(DONE_TODAY));

    expectBubble(DONE);
    expect(actionType()).toBe("jump");
  });

  it("J7: 연속 3일이면 '3일째 함께하고 있어!'와 hop, 머리 칩은 '연속 3일'", async () => {
    await renderWithGreetingReady(snapshot({ streakDays: 3 }));

    expectBubble(streakLine(3));
    expect(actionType()).toBe("hop");
    expect(screen.getByText("연속 3일")).toBeOnTheScreen();
  });

  it("J8: 연속 2일은 연속 기록이 아니어서 그 밖(기본 말, wave)", async () => {
    await renderWithGreetingReady(snapshot({ streakDays: 2 }));

    expectBubble(IDLE_LINE);
    expect(actionType()).toBe("wave");
  });

  it("J9: N은 머리 칩의 연속 일수와 같다(연속 12일)", async () => {
    await renderWithGreetingReady(snapshot({ streakDays: 12 }));

    expectBubble(streakLine(12));
    expect(screen.getByText("연속 12일")).toBeOnTheScreen();
  });

  it("J10: 마지막 작문이 3일 전(11-09)이면 오랜만(wave)", async () => {
    setMonths({ "2026-11": [{ date: "2026-11-09", completed: true }] });
    await renderWithGreetingReady(snapshot());

    expectBubble(LONG_TIME);
    expect(actionType()).toBe("wave");
  });

  it("J11: 마지막 작문이 2일 전(11-10)이면 그 밖", async () => {
    setMonths({ "2026-11": [{ date: "2026-11-10", completed: true }] });
    await renderWithGreetingReady(snapshot());

    expectBubble(IDLE_LINE);
  });

  it("J12: 시작만 한 날(11-11)도 작문한 날이어서, 11-01에 마친 기록이 있어도 오랜만이 아니다", async () => {
    setMonths({
      "2026-11": [
        { date: "2026-11-01", completed: true },
        { date: "2026-11-11", started: true, completed: false }
      ]
    });
    await renderWithGreetingReady(snapshot());

    expectBubble(IDLE_LINE);
  });

  describe("지난달 기록(J13, J14)", () => {
    beforeEach(() => {
      jest.setSystemTime(new Date("2026-11-02T03:00:00.000Z"));
    });

    it("J13: 11월이 비었고 10-30에 작문했으면(3일 전) 오랜만", async () => {
      setMonths({ "2026-10": [{ date: "2026-10-30", completed: true }] });
      await renderWithGreetingReady(snapshot({ date: "2026-11-02" }));

      expectBubble(LONG_TIME);
    });

    it("J14: 11월이 비었고 10-31에 작문했으면(2일 전) 그 밖", async () => {
      setMonths({ "2026-10": [{ date: "2026-10-31", completed: true }] });
      await renderWithGreetingReady(snapshot({ date: "2026-11-02" }));

      expectBubble(IDLE_LINE);
    });
  });

  it("J15: 작문 5회인데 두 달 모두 기록이 없으면 오랜만", async () => {
    setMonths({});
    await renderWithGreetingReady(snapshot());

    expectBubble(LONG_TIME);
  });

  it("M3: 오늘은 폰의 날짜로 본다(폰 11-12, 오늘 작문 상태의 date 11-13, 마지막 작문 11-10 → 폰으로 2일 전이라 그 밖)", async () => {
    setMonths({ "2026-11": [{ date: "2026-11-10", completed: true }] });
    await renderWithGreetingReady(snapshot({ date: "2026-11-13" }));

    expectBubble(IDLE_LINE);
  });

  it("J16: 1월의 지난달은 지난해 12월이다(2027-01-02에 2026-12-31 작문 → 2일 전, 그 밖)", async () => {
    jest.setSystemTime(new Date("2027-01-02T03:00:00.000Z"));
    setMonths({ "2026-12": [{ date: "2026-12-31", completed: true }] });
    await renderWithGreetingReady(snapshot({ date: "2027-01-02" }));

    expectBubble(IDLE_LINE);
  });
});

// ---------- P. 여럿이 맞을 때 ----------

describe("[spec] 여럿이 맞으면 표의 위에서부터(P1~P4)", () => {
  it("P1: 첫 방문과 이어 쓰기가 함께 맞으면 첫 방문 말과 wave", async () => {
    setMonths({});
    arrangeIncomplete();
    await renderWithGreetingReady(snapshot({ totalAnswerSessions: 0 }, 0));

    expectBubble(FIRST);
    expect(actionType()).toBe("wave");
  });

  it("P2: 이어 쓰기·오늘 완료·연속 5일이 함께 맞으면 이어 쓰기 말과 point", async () => {
    arrangeIncomplete();
    await renderWithGreetingReady(snapshot({ ...DONE_TODAY, streakDays: 5 }));

    expectBubble(RESUME);
    expect(actionType()).toBe("point");
  });

  it("P3: 오늘 완료·연속 5일이 함께 맞으면 '오늘도 해냈어!'와 jump", async () => {
    await renderWithGreetingReady(snapshot({ ...DONE_TODAY, streakDays: 5 }));

    expectBubble(DONE);
    expect(screen.queryByText(streakLine(5))).toBeNull();
    expect(actionType()).toBe("jump");
  });

  it("P4: 연속 4일과 오랜만(두 달 기록 없음)이 함께 맞으면 '4일째 함께하고 있어!'와 hop", async () => {
    setMonths({});
    await renderWithGreetingReady(snapshot({ streakDays: 4 }));

    expectBubble(streakLine(4));
    expect(screen.queryByText(LONG_TIME)).toBeNull();
    expect(actionType()).toBe("hop");
  });
});

// ---------- N. 정보가 없을 때, 결정 M2 ----------

describe("[spec] 정보를 다 받은 뒤 판정(N1, N2), 받은 정보만으로 판정(결정 M2)", () => {
  it("N1: 홈 정보를 받기 전에는 기본 말이고 '오늘도 해냈어!'가 없다. 받은 뒤 '오늘도 해냈어!'와 jump", async () => {
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pending.promise);
    await renderHome();
    await frames(3);

    expect(screen.getByText(IDLE_LINE)).toBeOnTheScreen();
    expect(screen.queryByText(DONE)).toBeNull();

    await act(async () => {
      pending.resolve(snapshot(DONE_TODAY));
    });
    await flushAsync();
    expectBubble(DONE);
    expect(actionType()).toBe("jump");
  });

  it("N2: 작문 달력을 받기 전에는 기본 말이고 오랜만이 아니다. 두 달 모두 빈 달로 받은 뒤 오랜만", async () => {
    const months = deferred<void>();
    jest.mocked(getMonthWritingStatus).mockImplementation(async (year: number, monthNumber: number) => {
      await months.promise;
      return month(year, monthNumber, []);
    });
    await renderHome();
    await frames(1);

    expect(screen.getByText(IDLE_LINE)).toBeOnTheScreen();
    expect(screen.queryByText(LONG_TIME)).toBeNull();

    await act(async () => {
      months.resolve();
    });
    await flushAsync();
    expectBubble(LONG_TIME);
  });

  it("M2 a: 작문 달력을 받지 못하면(실패) 오랜만이 아니다(작문 5회, 미완료, 연속 0 → 그 밖)", async () => {
    jest.mocked(getMonthWritingStatus).mockRejectedValue(new Error("네트워크 오류"));
    await renderHome();
    await frames(1);

    expectBubble(IDLE_LINE);
  });

  it("M2 b: 오늘 작문 상태를 받지 못하면(작문 횟수를 모름) 일기 0편이어도 첫 방문이 아니다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockRejectedValue(new Error("네트워크 오류"));
    jest.mocked(getTodayWritingStatus).mockRejectedValue(new Error("네트워크 오류"));
    jest.mocked(getDiaryCalendarSummary).mockResolvedValue(diary(0));
    await renderHome();
    await frames(1);

    expectBubble(IDLE_LINE);
  });

  it("M2 c: 일기 요약을 받지 못하면(일기 편수를 모름) 작문 0회여도 첫 방문이 아니다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockRejectedValue(new Error("네트워크 오류"));
    jest.mocked(getTodayWritingStatus).mockResolvedValue(status({ totalAnswerSessions: 0 }));
    jest.mocked(getDiaryCalendarSummary).mockRejectedValue(new Error("네트워크 오류"));
    setMonths({});
    await renderHome();
    await frames(1);

    expectBubble(IDLE_LINE);
  });
});

// ---------- G. 인사 말을 남겨 두는 시간, 결정 M1·M4 ----------

describe("[spec] 인사 말은 방 안을 누를 때까지 남는다(G1~G5, 결정 M1·M4)", () => {
  it("G1: 오늘 완료 인사 뒤 아무것도 누르지 않고 10초가 지나도 '오늘도 해냈어!'", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    expectBubble(DONE);

    await frames(10);
    expectBubble(DONE);
  });

  it("G2: 라이트루프를 누르면 '헤헤, 간지러워!', 2초 뒤에는 기본 말이고 '오늘도 해냈어!'로 돌아가지 않는다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    await frames(1);

    await tapCharacter();
    expect(screen.getByText("헤헤, 간지러워!")).toBeOnTheScreen();
    await frames(2);
    expectBubble(IDLE_LINE);
  });

  it("G3: 게시판을 누르면 걷는 동안 말풍선이 없고, 도착하면 게시판 안내, 바닥 점에 멈추면 기본 말. '오늘도 해냈어!'는 다시 나오지 않는다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();

    await tapMark("board");
    await frames(0.5);
    for (const line of [...ALL_GREETING_LINES, BOARD_PROMPT]) {
      expect(screen.queryByText(line)).toBeNull();
    }
    await walkUntilArrived("board");
    expect(screen.getByText(BOARD_PROMPT)).toBeOnTheScreen();
    expect(within(bubbleOf(BOARD_PROMPT)).getByRole("button", { name: "들어가기" })).toBeOnTheScreen();
    expect(screen.queryByText(DONE)).toBeNull();

    const point = { x: 4.5, z: 8.5 };
    await tapFloor(point);
    await walkUntilStoppedAt(point);
    expectBubble(IDLE_LINE);
  });

  it("G4: 이어 쓰기 인사 뒤 라이트루프를 누르고 2초가 지나면 기본 말에 '이어 쓰기' 버튼이 붙고, 누르면 이어 쓰던 곳으로 간다", async () => {
    arrangeIncomplete();
    await renderHome();
    expectBubble(RESUME);

    await tapCharacter();
    await frames(2);
    expectBubble(IDLE_LINE);
    const button = within(bubbleOf(IDLE_LINE)).getByRole("button", { name: "이어 쓰기" });
    await fireEvent.press(button);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(RESUME_ROUTE);
  });

  it("G5·K11: 오늘 완료 인사 뒤 누르지 않고 25초가 지나면 라이트루프가 앉아 있고, 말풍선은 여전히 '오늘도 해냈어!'", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();

    await frames(25);
    expect(isSitting()).toBe(true);
    expectBubble(DONE);
  });

  it("M1 a: 바닥 빈 곳을 누르면(걷기) 멈춘 뒤 기본 말이다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    expectBubble(DONE);

    const point = { x: 4.5, z: 8.5 };
    await tapFloor(point);
    await walkUntilStoppedAt(point);
    expectBubble(IDLE_LINE);
  });

  it("M1 b: 방 안을 끌면 끌기를 마치고 멈춘 뒤 기본 말이다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    expectBubble(DONE);

    const start = { x: sim().x, z: sim().z };
    await act(async () => {
      canvas().onPointer("down", { point: start, mark: null, onCharacter: false }, 200, 300);
    });
    await act(async () => {
      canvas().onPointer("move", { point: { x: start.x, z: start.z + 2 }, mark: null, onCharacter: false }, 200, 360);
    });
    await frames(1.5);
    await act(async () => {
      canvas().onPointer("up", { point: { x: start.x, z: start.z + 2 }, mark: null, onCharacter: false }, 200, 360);
    });
    await frames(2);
    expectBubble(IDLE_LINE);
  });

  it("M1 c: 아래 메뉴(판을 열고 닫기), 위쪽 연속 칩, 카메라 거리 버튼을 눌러도 '오늘도 해냈어!'가 남는다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    expectBubble(DONE);

    await fireEvent.press(screen.getByRole("button", { name: "질문에 답하기" }));
    await flushAsync();
    const sheets = screen.root!.queryAll(
      (instance) => instance.type === "Modal" && instance.props.animationType === "slide" && instance.props.visible === true
    );
    expect(sheets.length).toBe(1);
    await fireEvent.press(within(sheets[0]).getByRole("button", { name: "닫기" }));
    await flushAsync();
    await frames(0.5);
    expectBubble(DONE);

    await fireEvent.press(screen.getByRole("button", { name: "연속 1일" }));
    await flushAsync();
    await frames(0.5);
    expectBubble(DONE);

    await fireEvent.press(screen.getByRole("button", { name: "카메라 거리 설정" }));
    await fireEvent.press(screen.getByRole("button", { name: "카메라 거리 설정" }));
    await flushAsync();
    await frames(0.5);
    expectBubble(DONE);
  });

  it("M4: 첫 방문 인사가 이겼는데 끝내지 않은 답도 있으면 첫 방문 말풍선에 '이어 쓰기' 버튼이 붙는다", async () => {
    setMonths({});
    arrangeIncomplete();
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot({ totalAnswerSessions: 0 }, 0));
    await renderHome();

    expectBubble(FIRST);
    expect(within(bubbleOf(FIRST)).getByRole("button", { name: "이어 쓰기" })).toBeOnTheScreen();
  });
});

// ---------- E. 인사하는 때 ----------

describe("[spec] 홈에 들어올 때마다 인사(E1~E5)", () => {
  it("E2: 다른 화면에서 홈으로 돌아오면 다시 '오늘도 해냈어!'와 jump", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    expectBubble(DONE);
    await tapCharacter();
    await frames(2);
    expectBubble(IDLE_LINE);
    expect(actionType()).toBeNull();

    await setFocused(false);
    await setFocused(true);

    expectBubble(DONE);
    expect(actionType()).toBe("jump");
  });

  it("E3: 배경에 두었던 앱으로 돌아오면 다시 '오늘도 해냈어!'와 jump", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    const callIndex = jest.mocked(AppState.addEventListener).mock.calls.length;
    await renderHome();
    const listeners = appStateListenersSince(callIndex);
    expect(listeners.length).toBeGreaterThan(0);
    await tapCharacter();
    await frames(2);
    expectBubble(IDLE_LINE);
    expect(actionType()).toBeNull();

    await sendAppState(listeners, "background");
    await sendAppState(listeners, "active");

    expectBubble(DONE);
    expect(actionType()).toBe("jump");
  });

  it("E4: 작문을 마치고 돌아오면(돌아온 뒤 받은 정보가 오늘 완료) '오늘도 해냈어!'와 jump", async () => {
    await renderHome();
    expectBubble(IDLE_LINE);
    await frames(3);

    await setFocused(false);
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot({ ...DONE_TODAY, totalAnswerSessions: 6 }));
    await setFocused(true);

    expectBubble(DONE);
    expect(actionType()).toBe("jump");
  });

  it("E5: 게시판에 서서 질문 판으로 연습에 갔다가 마치고 돌아오면 게시판 안내가 아니라 '오늘도 해냈어!'와 jump", async () => {
    await renderHome();
    await tapMark("board");
    await walkUntilArrived("board");
    await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
    await flushAsync();
    await fireEvent.press(screen.getByText(featuredPrompt.questionEn));
    expect(router.push).toHaveBeenCalledTimes(1);
    await frames(1);

    await setFocused(false);
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot({ ...DONE_TODAY, totalAnswerSessions: 6 }));
    await setFocused(true);

    expect(screen.queryByText(BOARD_PROMPT)).toBeNull();
    expectBubble(DONE);
    expect(actionType()).toBe("jump");
  });
});

// ---------- T. 처음 방문 안내 ----------

describe("[spec] 처음 방문 안내가 끝난 뒤 인사(T1, T2)", () => {
  async function sendProjection() {
    await act(async () => {
      canvas().onProject({ bubble: { x: 375, y: 600 }, labels: LABELS, fps: 60 });
    });
    await flushAsync();
  }

  it("T1: 안내가 떠 있는 동안에는 '오늘도 해냈어!'도 jump도 없고, 건너뛰면 '오늘도 해냈어!'와 jump", async () => {
    jest.mocked(consumeHomeTutorialReplay).mockResolvedValue(true);
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY)).mockReturnValueOnce(pending.promise);
    await renderHome();
    await frames(3);
    await act(async () => {
      pending.resolve(snapshot(DONE_TODAY));
    });
    await flushAsync();
    await sendProjection();
    await advance(180);

    expect(screen.getByRole("button", { name: SKIP_LABEL })).toBeOnTheScreen();
    expect(screen.queryByText(DONE)).toBeNull();
    expect(actionType()).not.toBe("jump");

    await fireEvent.press(screen.getByRole("button", { name: SKIP_LABEL }));
    await flushAsync();

    expectBubble(DONE);
    expect(actionType()).toBe("jump");
  });

  it("T2: 처음 방문이면 안내가 떠 있는 동안 첫 방문 말이 없고, 세 단계를 끝까지 넘겨 닫으면 첫 방문 말", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    setMonths({});
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot({ totalAnswerSessions: 0 }, 0));
    await renderHome();
    await sendProjection();
    await advance(180);

    for (let step = 0; step < 3; step += 1) {
      expect(screen.getByRole("button", { name: SKIP_LABEL })).toBeOnTheScreen();
      expect(screen.queryByText(FIRST)).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: step === 2 ? "시작하기" : "다음" }));
      await flushAsync();
    }

    expect(screen.queryByRole("button", { name: SKIP_LABEL })).toBeNull();
    expectBubble(FIRST);
  });
});

// ---------- R. 동작 줄이기 ----------

describe("[spec] 동작 줄이기면 큰 동작은 하지 않고 말만(R1~R4)", () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  });

  it("R1: 오늘 완료는 '오늘도 해냈어!'만 하고 동작이 없다", async () => {
    await renderWithGreetingReady(snapshot(DONE_TODAY));

    expectBubble(DONE);
    expect(actionType()).toBeNull();
  });

  it("R2: 연속 3일은 '3일째 함께하고 있어!'만 하고 동작이 없다", async () => {
    await renderWithGreetingReady(snapshot({ streakDays: 3 }));

    expectBubble(streakLine(3));
    expect(actionType()).toBeNull();
  });

  it("R3: 첫 방문은 말과 wave(큰 동작이 아니다)", async () => {
    setMonths({});
    await renderWithGreetingReady(snapshot({ totalAnswerSessions: 0 }, 0));

    expectBubble(FIRST);
    expect(actionType()).toBe("wave");
  });

  it("R4: 이어 쓰기는 말과 버튼, point(큰 동작이 아니다)", async () => {
    arrangeIncomplete();
    await renderWithGreetingReady(snapshot());

    expectBubble(RESUME);
    expect(within(bubbleOf(RESUME)).getByRole("button", { name: "이어 쓰기" })).toBeOnTheScreen();
    expect(actionType()).toBe("point");
  });
});

// ---------- K. 홈·개발 화면에서 앉기, 결정 M5·M6 ----------

describe("[spec] 홈·개발 화면에서 오래 두면 앉기(K11, K12, 결정 M5·M6)", () => {
  it("K11: 홈(기준 B)에서 인사 동작이 끝난 뒤 누르지 않고 21초가 지나면 앉아 있다", async () => {
    await renderHome();
    expect(await framesUntil(5, () => sim().action === null)).toBe(true);

    await frames(21);
    expect(isSitting()).toBe(true);
  });

  it("K12: 개발 진입 화면(/dev/lobby-3d)에서도 누르지 않고 25초가 지나면 앉아 있다", async () => {
    devGlobal.__DEV__ = true;
    await render(<DevLobby3dRoute />);
    await flushAsync();

    await frames(25);
    expect(isSitting()).toBe(true);
  });

  it("M5: 앉아 있을 때 홈에 다시 들어오면 일어나고(stand_up), 일어난 뒤 인사 동작(jump)을 한다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    await frames(25);
    expect(isSitting()).toBe(true);

    await setFocused(false);
    await setFocused(true);

    expect(sim().posture?.kind).toBe("standing-up");
    expectBubble(DONE);
    expect(await framesUntil(2, () => sim().posture === null)).toBe(true);
    expect(actionType()).toBe("jump");
  });

  it("M6 a: 질문 판이 열려 있어도 20초를 센다(판을 연 채 25초 → 앉아 있음)", async () => {
    await renderHome();
    await fireEvent.press(screen.getByRole("button", { name: "질문에 답하기" }));
    await flushAsync();

    await frames(25);
    expect(isSitting()).toBe(true);
  });

  it("M6 b: 다른 화면에 가 있는 동안은 세지 않는다(15초 보고 → 다른 화면에서 60초 → 돌아온 뒤 정보가 오기 전 1초, 인사 뒤 10초에도 서 있음)", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    await renderHome();
    await frames(15);
    expect(isSitting()).toBe(false);

    await setFocused(false);
    jest.setSystemTime(Date.now() + 60_000);
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValueOnce(pending.promise);
    await setFocused(true);
    await frames(1);
    expect(isSitting()).toBe(false);

    await act(async () => {
      pending.resolve(snapshot(DONE_TODAY));
    });
    await flushAsync();
    expect(actionType()).toBe("jump");
    await frames(10);
    expect(isSitting()).toBe(false);
  });

  it("M6 c: 앱이 배경에 있는 동안은 세지 않는다(15초 보고 → 배경에서 60초 → 돌아온 뒤 정보가 오기 전 1초, 인사 뒤 10초에도 서 있음)", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot(DONE_TODAY));
    const callIndex = jest.mocked(AppState.addEventListener).mock.calls.length;
    await renderHome();
    const listeners = appStateListenersSince(callIndex);
    await frames(15);
    expect(isSitting()).toBe(false);

    await sendAppState(listeners, "background");
    jest.setSystemTime(Date.now() + 60_000);
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValueOnce(pending.promise);
    await sendAppState(listeners, "active");
    await frames(1);
    expect(isSitting()).toBe(false);

    await act(async () => {
      pending.resolve(snapshot(DONE_TODAY));
    });
    await flushAsync();
    expect(actionType()).toBe("jump");
    await frames(10);
    expect(isSitting()).toBe(false);
  });
});
