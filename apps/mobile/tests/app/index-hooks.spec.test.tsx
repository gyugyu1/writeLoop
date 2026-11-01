// [spec] qa 테스트(작업 047-05 홈 화면 훅, 리팩터링의 "지금 동작" 기록).
// 홈 화면(src/app/index.tsx)의 상태·효과를 데이터·튜토리얼·월 달력 훅으로 옮겨도 그대로여야 하는 것 중,
// 홈 ①의 화면 테스트(index.spec.test.tsx)가 보지 않는 것만 더 적는다.
// - 효과 실행 순서: 처음 그릴 때와 포커스를 다시 받을 때 각 효과가 부르는 API의 순서(효과 ④ → ⑤ → ⑥ → ⑦)
// - 효과 ①(사용자가 바뀌면 첫 불러오기 표시를 되돌림)이 효과 ⑥(포커스 때 일기 달력·지금 영어로 다시 부르기)보다 먼저 도는 것
// - 튜토리얼 단계마다 재는 대상 구역(튜토리얼 훅이 만든 ref가 화면의 어느 구역에 붙는지)과 창 크기 전달
// - 데이터 훅의 오늘 상태가 월 달력 훅의 기준 달로 넘어가는 것
// 가짜로 두는 것은 index.spec.test.tsx와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스,
// 네이티브 모듈, 화면 위치 재기). 가짜 시계: 2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00.
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { isValidElement, type ComponentProps } from "react";
import { ScrollView, View } from "react-native";
import HomeScreen from "@/app/index";
import type HomeFeatureTutorial from "@/components/home-feature-tutorial";
import {
  DifficultySectionContent,
  FeaturedRecommendationContent,
  HomeDiarySectionContent,
  NowInEnglishSectionContent
} from "@/components/home/home-sections";
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

// 튜토리얼 위치 재기: 스크롤 뷰를 감싼 바깥 View(뷰포트)와 튜토리얼 대상 구역 4개에 서로 다른 사각형을 돌려준다.
// 대상 구역은 그 View가 감싼 화면 조각(홈 ①의 조각 컴포넌트)으로 가린다. 그 밖의 View를 재면 크기 0을 돌려준다.
// 테스트 창 크기는 React Native 테스트 설정의 750 x 1334다.
// 스크롤 0, 뷰포트 y 80, 위 여백 max(18, min(64, 1334 * 0.06)) = 64 → 스크롤 y = 대상 y - 80 - 64.
// 강조 영역 = 왼쪽 max(8, x-7), 위 max(8, y-7), 오른쪽 min(742, x+w+7), 아래 min(1326, y+h+16).
type Rect = { x: number; y: number; width: number; height: number };
const VIEWPORT_RECT: Rect = { x: 0, y: 80, width: 750, height: 1100 };
const SECTION_RECTS = {
  now: { x: 20, y: 300, width: 335, height: 180 },
  featured: { x: 2, y: 520, width: 327, height: 240 },
  difficulty: { x: 400, y: 640, width: 345, height: 300 },
  diary: { x: 30, y: 900, width: 315, height: 420 }
} satisfies Record<string, Rect>;
// 단계별 기대값(위 식으로 계산한 값)
const STEP_EXPECTATIONS = [
  { scrollY: 156, spotlight: { x: 13, y: 293, width: 349, height: 203 } },
  // 왼쪽이 화면 가장자리 여백 8에 걸린다: max(8, 2-7)=8, 오른쪽 2+327+7=336
  { scrollY: 376, spotlight: { x: 8, y: 513, width: 328, height: 263 } },
  // 오른쪽이 창 너비에 걸린다: min(750-8, 400+345+7=752)=742
  { scrollY: 496, spotlight: { x: 393, y: 633, width: 349, height: 323 } },
  // 아래가 창 높이에 걸린다: min(1334-8, 900+420+16=1336)=1326
  { scrollY: 756, spotlight: { x: 23, y: 893, width: 329, height: 433 } }
];

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
const viewMeasureInWindow = (View as unknown as { prototype: { measureInWindow: jest.Mock } }).prototype.measureInWindow;
const scrollViewScrollTo = (ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype.scrollTo;

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

async function renderLoaded() {
  await renderScreen();
  expect(screen.getByText(featuredPrompt.questionEn)).toBeOnTheScreen();
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

function lastTutorialProps() {
  return mockTutorialProps.at(-1)!;
}

function installSectionMeasure() {
  viewMeasureInWindow.mockImplementation(function (
    this: { props: { children?: unknown } },
    callback: (x: number, y: number, width: number, height: number) => void
  ) {
    const children = this.props.children;
    let rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
    if (isValidElement(children)) {
      if (children.type === ScrollView) {
        rect = VIEWPORT_RECT;
      } else if (children.type === NowInEnglishSectionContent) {
        rect = SECTION_RECTS.now;
      } else if (children.type === FeaturedRecommendationContent) {
        rect = SECTION_RECTS.featured;
      } else if (children.type === DifficultySectionContent) {
        rect = SECTION_RECTS.difficulty;
      } else if (children.type === HomeDiarySectionContent) {
        rect = SECTION_RECTS.diary;
      }
    }
    callback(rect.x, rect.y, rect.width, rect.height);
  });
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
  viewMeasureInWindow.mockReset();
  scrollViewScrollTo.mockClear();
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
    expect(screen.getByText("작문 4일 연속")).toBeOnTheScreen();

    // 새 사용자의 첫 불러오기가 끝났으므로, 포커스를 다시 받으면 일기 달력·지금 영어로를 다시 부른다.
    await refocus();
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
  });
});

// ---------- 튜토리얼 대상 구역 ----------

describe("[spec] 튜토리얼 대상 구역", () => {
  it("[spec] 단계마다 지금 영어로 → 오늘의 추천 질문 → 난이도별 질문 → 영어일기 구역을 재어 그 위치로 스크롤하고 강조 영역을 넘긴다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    installSectionMeasure();
    await renderLoaded();

    await advance(180);
    expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: STEP_EXPECTATIONS[0].scrollY, animated: false });
    await advance(120);
    expect(lastTutorialProps()).toMatchObject({
      visible: true,
      stepIndex: 0,
      spotlight: STEP_EXPECTATIONS[0].spotlight,
      isPositioning: false
    });

    for (let stepIndex = 1; stepIndex < 4; stepIndex += 1) {
      await fireEvent.press(screen.getByRole("button", { name: "다음" }));
      await flushAsync();
      expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: STEP_EXPECTATIONS[stepIndex].scrollY, animated: true });
      await advance(520);
      expect(lastTutorialProps()).toMatchObject({
        visible: true,
        stepIndex,
        spotlight: STEP_EXPECTATIONS[stepIndex].spotlight,
        isPositioning: false
      });
    }
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(4);
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

    // 요일 줄(오늘 상태의 날짜가 맨 오른쪽)의 첫 칸을 누른다.
    await fireEvent.press(screen.getAllByText("일")[0]);
    await flushAsync();

    expect(getMonthWritingStatus).toHaveBeenCalledTimes(1);
    expect(getMonthWritingStatus).toHaveBeenCalledWith(2026, 10);
    const modals = screen.root!.queryAll((instance) => instance.type === "Modal");
    expect(modals).toHaveLength(1);
    expect(within(modals[0]).getByText("2026년 10월")).toBeOnTheScreen();
    expect(within(modals[0]).getByText(">")).toBeDisabled();
    expect(within(modals[0]).getByText("오늘도 학습 기록이 쌓였어요")).toBeOnTheScreen();
  });
});
