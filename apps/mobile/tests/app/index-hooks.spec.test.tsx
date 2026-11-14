// [spec] qa 테스트(작업 047-05 홈 화면 훅, 리팩터링의 "지금 동작" 기록).
// 홈 화면(src/app/index.tsx)의 상태·효과를 데이터·튜토리얼·월 달력 훅으로 옮겨도 그대로여야 하는 것 중,
// 홈 ①의 화면 테스트(index.spec.test.tsx)가 보지 않는 것만 더 적는다.
// - 효과 실행 순서: 처음 그릴 때와 포커스를 다시 받을 때 각 효과가 부르는 API의 순서(효과 ④ → ⑤ → ⑥ → ⑦)
// - 효과 ①(사용자가 바뀌면 첫 불러오기 표시를 되돌림)이 효과 ⑥(포커스 때 일기 달력·지금 영어로 다시 부르기)보다 먼저 도는 것
// - 데이터 훅의 오늘 상태가 월 달력 훅의 기준 달로 넘어가는 것
// 가짜로 두는 것은 index.spec.test.tsx와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스,
// 네이티브 모듈, 3D 그리기, 카메라 거리 저장). 가짜 시계: 2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00.
// 작업 060-03(홈을 로비로)에서 고침: 학습 일지·월 달력은 로비의 질문 판(시트)을 연 뒤 보고, 옛 튜토리얼 대상 구역 테스트는
// 지웠다(옛 튜토리얼 단계. 분류는 060-03의 02-qa-scenarios.md 표와 03-main-decision.md).
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { type ComponentProps } from "react";
import type { TestInstance } from "test-renderer";
import HomeScreen from "@/app/index";
import type HomeFeatureTutorial from "@/components/home-feature-tutorial";
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
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
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
  TodayWritingStatus
} from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

type TutorialProps = ComponentProps<typeof HomeFeatureTutorial>;

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockTutorialProps: TutorialProps[] = [];

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
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
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { __esModule: true, default: () => React.createElement("Lobby3dCanvasMock") };
});
jest.mock("@/components/home-feature-tutorial", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const actual = jest.requireActual<typeof import("@/components/home-feature-tutorial")>(
    "@/components/home-feature-tutorial"
  );
  function SpyHomeFeatureTutorial(props: TutorialProps) {
    mockTutorialProps.push(props);
    return React.createElement(actual.default, props);
  }
  return { ...actual, __esModule: true, default: SpyHomeFeatureTutorial };
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

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };
const otherUser: AuthUser = { id: 8, email: "other@example.com", displayName: "다른 학습자", admin: false };

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

function todayStatus(overrides: Partial<TodayWritingStatus> = {}): TodayWritingStatus {
  return {
    date: TODAY_KEY,
    completed: true,
    completedSessions: 1,
    startedSessions: 1,
    streakDays: 2,
    totalAnswerSessions: 1234,
    totalWrittenSentences: 5678,
    ...overrides
  };
}

function diarySummary(): DiaryCalendarSummary {
  return {
    totalEntries: 12,
    days: [
      { date: "2026-11-12", entryId: "diary-1112", entryCount: 1 },
      { date: "2026-11-11", entryId: "diary-1111", entryCount: 1 },
      { date: "2026-11-10", entryId: "diary-1110", entryCount: 2 }
    ]
  };
}

function homeSnapshot(overrides: Partial<MobileHomeSnapshot> = {}): MobileHomeSnapshot {
  return {
    todayStatus: todayStatus(),
    diaryCalendarSummary: diarySummary(),
    featuredRecommendation: featured(),
    ...overrides
  };
}

function nowSummary(): NowInEnglishSummary {
  const entries = ["2026-11-12", "2026-11-10"].map((dateKey, index) => ({
    id: `now-${index}`,
    text: `I am writing ${index}.`,
    createdAt: `${dateKey}T01:00:00.000Z`,
    dateKey
  }));
  return {
    entries,
    todayEntries: [entries[0]],
    todayCount: 1,
    settings: {
      enabled: true,
      intervalHours: 2,
      scheduleMode: "HOURLY_ANCHOR",
      notificationIds: [],
      scheduledReminderAts: [],
      quietHours: { enabled: true, startHour: 23, endHour: 8 },
      updatedAt: "2026-11-01T00:00:00.000Z"
    }
  };
}

function monthStatus(year: number, month: number, completedDates: string[]): MonthWritingStatus {
  return {
    year,
    month,
    streakDays: 0,
    days: completedDates.map((date) => ({
      date,
      started: true,
      completed: true,
      startedSessions: 1,
      completedSessions: 1,
      isToday: false
    }))
  };
}

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();

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

async function renderScreen() {
  await render(<HomeScreen />);
  await flushAsync();
}

// 홈 데이터를 다 불러온 로비까지 그린다. 옮겨진 칸은 판을 열어야 보이므로, 로비가 그려졌고 스냅샷을 불렀는지로 본다.
async function renderLoaded() {
  await renderScreen();
  expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeOnTheScreen();
  expect(getMobileHomeSnapshot).toHaveBeenCalled();
}

// 로비의 "질문에 답하기" 메뉴로 질문 판을 열고 그 판(아래에서 올라오는 Modal)을 돌려준다.
async function openQuestionSheet(): Promise<TestInstance> {
  await fireEvent.press(screen.getByRole("button", { name: "질문에 답하기" }));
  await flushAsync();
  const sheets = screen.root!.queryAll(
    (instance) =>
      instance.type === "Modal" &&
      instance.props.animationType === "slide" &&
      within(instance).queryAllByRole("header", { name: "질문에 답하기" }).length > 0
  );
  expect(sheets).toHaveLength(1);
  return sheets[0];
}

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

async function refocus() {
  await setFocused(false);
  await setFocused(true);
}

// 함수가 마지막으로 불린 순번(jest 전체에서 늘어나는 값). 서로 다른 가짜 함수의 호출 순서를 비교한다.
function lastCallOrder(fn: jest.Mock | ((...args: never[]) => unknown)) {
  const order = jest.mocked(fn as jest.Mock).mock.invocationCallOrder;
  return order[order.length - 1];
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockFocus.focused = true;
  mockTutorialProps.length = 0;
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue(diarySummary());
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockResolvedValue(featured());
  jest.mocked(getMonthWritingStatus).mockReset().mockResolvedValue(monthStatus(2026, 11, ["2026-11-09"]));
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
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------- 효과 실행 순서 ----------

describe("[spec] 효과 실행 순서", () => {
  it("[spec] 처음 그리면 지금 영어로 요약(④) → 이어 쓰기 확인(⑤) → 튜토리얼 요청 확인(⑦) 순서로 부르고, 스냅샷은 이어 쓰기 확인이 끝난 뒤 부른다", async () => {
    const pendingLoop = deferred<null>();
    jest.mocked(getIncompleteLoop).mockReturnValue(pendingLoop.promise);
    await render(<HomeScreen />);

    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(getIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(consumeHomeTutorialReplay).toHaveBeenCalledTimes(1);
    expect(getDiaryCalendarSummary).not.toHaveBeenCalled();
    expect(getMobileHomeSnapshot).not.toHaveBeenCalled();
    expect(lastCallOrder(getNowInEnglishSummary)).toBeLessThan(lastCallOrder(getIncompleteLoop));
    expect(lastCallOrder(getIncompleteLoop)).toBeLessThan(lastCallOrder(consumeHomeTutorialReplay));

    await act(async () => {
      pendingLoop.resolve(null);
    });
    await flushAsync();

    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(lastCallOrder(consumeHomeTutorialReplay)).toBeLessThan(lastCallOrder(getMobileHomeSnapshot));
  });

  it("[spec] 포커스를 다시 받으면 이어 쓰기 확인(⑤) → 일기 달력(⑥) → 지금 영어로 요약(⑥) → 튜토리얼 요청 확인(⑦) 순서로 부르고, 스냅샷은 그 뒤에 부른다", async () => {
    await renderLoaded();
    const pendingLoop = deferred<null>();
    jest.mocked(getIncompleteLoop).mockReturnValue(pendingLoop.promise);

    await refocus();

    expect(getIncompleteLoop).toHaveBeenCalledTimes(2);
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(consumeHomeTutorialReplay).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(lastCallOrder(getIncompleteLoop)).toBeLessThan(lastCallOrder(getDiaryCalendarSummary));
    expect(lastCallOrder(getDiaryCalendarSummary)).toBeLessThan(lastCallOrder(getNowInEnglishSummary));
    expect(lastCallOrder(getNowInEnglishSummary)).toBeLessThan(lastCallOrder(consumeHomeTutorialReplay));

    await act(async () => {
      pendingLoop.resolve(null);
    });
    await flushAsync();

    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenLastCalledWith("I");
    expect(lastCallOrder(consumeHomeTutorialReplay)).toBeLessThan(lastCallOrder(getMobileHomeSnapshot));
  });

  it("[spec] 로그인한 사용자가 바뀌면 첫 불러오기 표시를 먼저 되돌려(①) 일기 달력·지금 영어로를 따로 부르지 않고(⑥), 이어 쓰기·튜토리얼 요청을 다시 확인한 뒤 새 사용자의 스냅샷을 그린다", async () => {
    await renderLoaded();
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ todayStatus: todayStatus({ streakDays: 4 }) }));

    setSessionUser(otherUser);
    await screen.rerender(<HomeScreen />);
    await flushAsync();

    expect(getDiaryCalendarSummary).not.toHaveBeenCalled();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(getIncompleteLoop).toHaveBeenCalledTimes(2);
    expect(consumeHomeTutorialReplay).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(3);
    expect(getMobileHomeSnapshot).toHaveBeenLastCalledWith("I");
    expect(within(await openQuestionSheet()).getByText("작문 4일 연속")).toBeOnTheScreen();

    // 새 사용자의 첫 불러오기가 끝났으므로, 포커스를 다시 받으면 일기 달력·지금 영어로를 다시 부른다.
    await refocus();
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
  });
});

// ---------- 훅 사이 값 전달 ----------

describe("[spec] 월 달력 기준 달", () => {
  it("[spec] 월 달력은 기기 날짜가 아니라 받은 오늘 상태의 날짜가 든 달로 열리고, 그 달에서 다음 달로 갈 수 없다", async () => {
    // 기기는 2026-11-12, 서버가 준 오늘은 2026-10-31(토)
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(
      homeSnapshot({ todayStatus: todayStatus({ date: "2026-10-31", streakDays: 1 }) })
    );
    jest.mocked(getMonthWritingStatus).mockResolvedValue(monthStatus(2026, 10, ["2026-10-31"]));
    await renderLoaded();

    // 질문 판의 요일 줄(오늘 상태의 날짜가 맨 오른쪽)의 첫 칸을 누른다.
    await fireEvent.press(within(await openQuestionSheet()).getAllByText("일")[0]);
    await flushAsync();

    expect(getMonthWritingStatus).toHaveBeenCalledTimes(1);
    expect(getMonthWritingStatus).toHaveBeenCalledWith(2026, 10);
    // 월 달력 모달: 질문 판(slide) 안에 있는 fade Modal
    const modals = screen.root!.queryAll((instance) => instance.type === "Modal" && instance.props.animationType === "fade");
    expect(modals).toHaveLength(1);
    expect(within(modals[0]).getByText("2026년 10월")).toBeOnTheScreen();
    expect(within(modals[0]).getByText(">")).toBeDisabled();
    expect(within(modals[0]).getByText("오늘도 학습 기록이 쌓였어요")).toBeOnTheScreen();
  });
});
