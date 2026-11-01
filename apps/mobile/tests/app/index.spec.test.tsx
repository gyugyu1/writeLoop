// [spec] qa 테스트(작업 047-03 홈 화면 조각, 리팩터링의 "지금 동작" 기록).
// 홈 화면(src/app/index.tsx) 전체를 렌더하고 사용자처럼 눌러, 지금 보이는 문구·구조·접근성 속성과 부르는 API·기기 저장
// 동작을 좋고 나쁨과 관계없이 그대로 적는다. 화면 조각·순수 함수·스타일을 옮긴 뒤에도, 데이터·튜토리얼·월 달력 상태를
// 훅으로 옮기는 다음 단계에서도 이 테스트가 그대로 통과해야 한다.
// 가짜로 두는 것: API(@/lib/api), 기기 저장소(이어 쓰기 상태 @/lib/incomplete-loop, 이 기기 임시저장 @/lib/writing-drafts,
// 저장된 피드백 상태 불러오기, 튜토리얼 저장 @/lib/home-tutorial, 지금 영어로 요약 @/lib/now-in-english), 로그인 상태
// (@/lib/session), 앱 업데이트 안내 상태(@/lib/app-overlay-status), 라우터(expo-router), 포커스(@react-navigation/native의
// useFocusEffect: 화면이 포커스를 잃고 다시 받는 것을 흉내 낸다), 네이티브 모듈(expo-symbols, 화면 위치 재기 measureInWindow).
// 튜토리얼 컴포넌트(HomeFeatureTutorial)는 실제 컴포넌트를 그리되, 홈이 넘긴 속성을 보려고 한 겹 감싼다.
// 날짜 계산이 오늘에 기대므로 모든 테스트를 가짜 시계로 돌린다(2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00에서 멈춤).
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { isValidElement, type ComponentProps, type ReactElement } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
import { useAppOverlayStatus, type AppUpdateNoticePhase } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState, type PracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  DailyDifficulty,
  DiaryCalendarDay,
  DiaryCalendarSummary,
  FeaturedDailyPromptRecommendation,
  MobileHomeSnapshot,
  MonthWritingStatus,
  Prompt,
  PromptRecommendationItem,
  TodayWritingStatus,
  WritingDraft
} from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

type TutorialProps = ComponentProps<typeof HomeFeatureTutorial>;

// 포커스 흉내: focused를 바꾸고 listeners를 부르면, 각 useFocusEffect가 포커스를 잃을 때 정리하고 다시 받을 때 다시 돈다.
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
// 화면 문구로 쓰는 상수는 기준 커밋의 값을 그대로 둔다.
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
const NOW_BODY = "지금 뭐하고 있나요?, 무슨 생각하고 있나요?";
const FEATURED_FALLBACK = "오늘의 추천 질문을 준비하고 있어요.";
const FEEDBACK_ENTRY_LABEL = "라이트루프에 의견 보내기";
const REMINDER_LABEL = "루프 알림 설정 열기";
const SKIP_LABEL = "홈 사용법 건너뛰기";

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
const otherPrompt: Prompt = {
  ...featuredPrompt,
  id: "prompt-other",
  topic: "Food",
  questionEn: "What did you eat for lunch?",
  questionKo: "점심으로 무엇을 먹었나요?"
};

function featured(
  overrides: Partial<PromptRecommendationItem> = {},
  difficulty: DailyDifficulty = "B"
): FeaturedDailyPromptRecommendation {
  return {
    recommendedDate: TODAY_KEY,
    difficulty,
    featured: {
      slot: "FEATURED",
      prompt: featuredPrompt,
      reasonCode: "RECENT_TOPIC",
      reasonText: "요즘 여행 이야기를 자주 썼어요.",
      reasonFacts: [],
      score: 1,
      ...overrides
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

// 일기: 오늘(12)·11·10일이 이어져 일기 3일 연속, 7일과 지난달 30일에도 있다.
const DIARY_DAYS: DiaryCalendarDay[] = [
  { date: "2026-11-12", entryId: "diary-1112", entryCount: 1 },
  { date: "2026-11-11", entryId: "diary-1111", entryCount: 1 },
  { date: "2026-11-10", entryId: "diary-1110", entryCount: 2 },
  { date: "2026-11-07", entryId: "diary-1107", entryCount: 1 },
  { date: "2026-10-30", entryId: "diary-1030", entryCount: 1 }
];

function diarySummary(days: DiaryCalendarDay[] = DIARY_DAYS, totalEntries = 12): DiaryCalendarSummary {
  return { totalEntries, days };
}

function homeSnapshot(overrides: Partial<MobileHomeSnapshot> = {}): MobileHomeSnapshot {
  return {
    todayStatus: todayStatus(),
    diaryCalendarSummary: diarySummary(),
    featuredRecommendation: featured(),
    ...overrides
  };
}

// 지금 영어로: 12·10·5일과 지난달 15일에 조각이 있다.
function nowSummary(overrides: Partial<NowInEnglishSummary> = {}, enabled = true): NowInEnglishSummary {
  const entries = ["2026-11-12", "2026-11-10", "2026-11-05", "2026-10-15"].map((dateKey, index) => ({
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
      enabled,
      intervalHours: 2,
      scheduleMode: "HOURLY_ANCHOR",
      notificationIds: [],
      scheduledReminderAts: [],
      quietHours: { enabled: true, startHour: 23, endHour: 8 },
      updatedAt: "2026-11-01T00:00:00.000Z"
    },
    ...overrides
  };
}

function monthStatus(year: number, month: number, completedDates: string[], startedOnlyDates: string[] = []): MonthWritingStatus {
  return {
    year,
    month,
    streakDays: 0,
    days: [
      ...startedOnlyDates.map((date) => ({
        date,
        started: true,
        completed: false,
        startedSessions: 1,
        completedSessions: 0,
        isToday: false
      })),
      ...completedDates.map((date) => ({
        date,
        started: true,
        completed: true,
        startedSessions: 1,
        completedSessions: 1,
        isToday: false
      }))
    ]
  };
}

// 이어 쓰기 상태의 저장 시각은 이 기기 시간대의 09:05로 만든다. 화면은 ko-KR의 시(숫자)·분(두 자리)로 보인다.
const SAVED_AT = new Date(2026, 10, 12, 9, 5).toISOString();
const SAVED_TIME = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(SAVED_AT));

function loop(step: IncompleteLoopState["step"], overrides: Partial<IncompleteLoopState> = {}): IncompleteLoopState {
  return {
    promptId: "prompt-loop",
    difficulty: "A",
    step,
    updatedAt: SAVED_AT,
    promptSnapshot: {
      topic: "Morning",
      questionEn: "What do you usually do in the morning?",
      questionKo: "아침에 보통 무엇을 하나요?"
    },
    ...overrides
  };
}

function writingDraft(overrides: Partial<WritingDraft> = {}): WritingDraft {
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
    updatedAt: SAVED_AT,
    ...overrides
  };
}

function feedbackState(): PracticeFeedbackState {
  return {
    difficulty: "A",
    prompt: { ...featuredPrompt, id: "prompt-loop" },
    answer: "I drink coffee.",
    feedback: {
      promptId: "prompt-loop",
      sessionId: "session-1",
      attemptNo: 1,
      loopComplete: false,
      completionMessage: null,
      summary: "",
      strengths: [],
      inlineFeedback: null,
      revisedAnswer: null,
      modelAnswer: "",
      rewriteChallenge: ""
    }
  };
}

// 튜토리얼 위치 재기: 스크롤 뷰를 감싼 바깥 View(뷰포트)와 튜토리얼 대상 구역에 서로 다른 사각형을 돌려준다.
type Rect = { x: number; y: number; width: number; height: number };
const VIEWPORT_RECT: Rect = { x: 0, y: 80, width: 750, height: 1100 };
const TARGET_RECT: Rect = { x: 20, y: 300, width: 335, height: 180 };
// 스크롤 0에서: 대상의 내용 안 위치 = 0 + 300 - 80 = 220, 위 여백 = max(18, min(64, 1334 * 0.06)) = 64 → y = 156
// 테스트 창 크기는 React Native 테스트 설정의 750 x 1334다.
// 강조 영역 = 왼쪽 max(8, 20-7)=13, 위 max(8, 300-7)=293, 오른쪽 min(742, 20+335+7)=362, 아래 min(1326, 300+180+16)=496
const SPOTLIGHT = { x: 13, y: 293, width: 349, height: 203 };

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

function setAppUpdatePhase(phase: AppUpdateNoticePhase) {
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: phase, setAppUpdateNoticePhase: jest.fn() });
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
  await render(<HomeScreen />);
  await flushAsync();
}

// 홈 데이터를 다 불러온 화면까지 그린다.
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

// 다른 화면에 갔다가 돌아온다(포커스를 잃고 다시 받는다).
async function refocus() {
  await setFocused(false);
  await setFocused(true);
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

function scrollHost() {
  return findHost(screen.root!, "RCTScrollView")[0];
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

function pressText(text: string) {
  return fireEvent.press(screen.getByText(text));
}

async function openCalendar() {
  // 요일 줄을 누른다(오늘 요일 칸의 글자, 요일 줄이 영어일기 요일 머리보다 앞에 있다).
  await fireEvent.press(screen.getAllByText("목")[0]);
  await flushAsync();
}

function weekRowChips() {
  const weekRow = screen.getAllByText("목")[0].parent!.parent!;
  return weekRow.children.map((chip) => {
    const chipInstance = chip as TestInstance;
    const text = chipInstance.children[0] as TestInstance;
    return {
      label: text.children[0],
      chipStyle: StyleSheet.flatten(chipInstance.props.style),
      textStyle: StyleSheet.flatten(text.props.style)
    };
  });
}

function lastTutorialProps() {
  return mockTutorialProps.at(-1)!;
}

function installMeasure(viewport: Rect = VIEWPORT_RECT, target: Rect = TARGET_RECT) {
  viewMeasureInWindow.mockImplementation(function (
    this: { props: { children?: unknown } },
    callback: (x: number, y: number, width: number, height: number) => void
  ) {
    const children = this.props.children;
    const isViewport = isValidElement(children) && children.type === ScrollView;
    const rect = isViewport ? viewport : target;
    callback(rect.x, rect.y, rect.width, rect.height);
  });
}

const DOT_COLORS: Record<string, string> = { "#EA920D": "작문", "#32835B": "일기", "#2F74C0": "영어조각" };

function cellDots(cell: TestInstance) {
  return cell
    .queryAll((node) => node.type === "View")
    .map((node) => StyleSheet.flatten(node.props.style)?.backgroundColor as string | undefined)
    .filter((color): color is string => typeof color === "string" && color in DOT_COLORS)
    .map((color) => DOT_COLORS[color]);
}

// 화면 구조 기록용: 호스트 요소의 종류, 이 화면이 정하는 속성(스타일은 펼친 값), 자식만 남긴다.
// React Native 안쪽에서 붙는 속성과 함수는 빼서, 화면 코드가 그대로면 같은 결과가 나오게 한다.
const STRUCTURE_PROPS = new Set([
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
  "accessibilityViewIsModal",
  "accessible",
  "animationType",
  "collapsable",
  "color",
  "contentContainerStyle",
  "href",
  "name",
  "pointerEvents",
  "removeClippedSubviews",
  "scrollEventThrottle",
  "showsVerticalScrollIndicator",
  "size",
  "source",
  "style",
  "tintColor",
  "transparent",
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
  const children = node.children.map((child) => (typeof child === "string" ? child : structureOf(child)));
  return { $$typeof: TEST_JSON, type: node.type, props, children: children.length > 0 ? children : null };
}

function screenStructure() {
  return structureOf(screen.root!);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockFocus.focused = true;
  mockTutorialProps.length = 0;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue(diarySummary());
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockResolvedValue(featured());
  jest.mocked(getMonthWritingStatus).mockReset().mockResolvedValue(monthStatus(2026, 11, ["2026-11-09"], ["2026-11-08"]));
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
  setAppUpdatePhase("settled");
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------- 진입 ----------

describe("[spec] 진입", () => {
  it("[spec] 세션을 확인하는 동안에는 불러오는 중 표시만 보이고 홈 데이터를 부르지 않는다", async () => {
    setSessionUser(null, true);
    await renderScreen();

    const indicators = spinners();
    expect(indicators).toHaveLength(1);
    expect(indicators[0].props.color).toBe("#E38B12");
    expect(screen.queryByText("학습 일지")).toBeNull();
    expect(screen.queryByText("홈")).toBeNull();
    expect(findHost(screen.container, "Redirect")).toHaveLength(0);
    expect(getMobileHomeSnapshot).not.toHaveBeenCalled();
  });

  it("[spec] 로그인 전이면 /login으로 보내고 홈을 그리지 않는다", async () => {
    setSessionUser(null);
    await renderScreen();

    const redirects = findHost(screen.container, "Redirect");
    expect(redirects).toHaveLength(1);
    expect(redirects[0].props.href).toBe("/login");
    expect(screen.queryByText("학습 일지")).toBeNull();
    expect(getMobileHomeSnapshot).not.toHaveBeenCalled();
    expect(getTodayWritingStatus).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});

// ---------- 홈 데이터 ----------

describe("[spec] 홈 데이터", () => {
  it("[spec] 이어 쓰기 상태를 확인한 뒤 홈 스냅샷을 한 번 부르고, 학습 일지·일기·추천 질문을 그린다", async () => {
    const pendingLoop = deferred<IncompleteLoopState | null>();
    jest.mocked(getIncompleteLoop).mockReturnValue(pendingLoop.promise);
    await renderScreen();

    // 이어 쓰기 상태를 확인하는 동안: 스냅샷을 부르지 않고, 불러오는 중 표시 없이 추천 질문 자리에 준비 문구가 보인다.
    expect(getMobileHomeSnapshot).not.toHaveBeenCalled();
    expect(spinners()).toHaveLength(0);
    expect(screen.getByText(FEATURED_FALLBACK)).toBeOnTheScreen();

    await act(async () => {
      pendingLoop.resolve(null);
    });
    await flushAsync();

    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(getMobileHomeSnapshot).toHaveBeenCalledWith("I");
    expect(screen.getByText("작문 2일 연속")).toBeOnTheScreen();
    expect(screen.getByText("일기 3일 연속")).toBeOnTheScreen();
    expect(screen.getByText("총 1,234문항 작성 · 총 12개의 일기 작성")).toBeOnTheScreen();
    expect(screen.getByText("총 4개의 영어조각")).toBeOnTheScreen();
    expect(screen.getByText(featuredPrompt.questionEn)).toBeOnTheScreen();
    expect(screen.getByText("오늘 일기 이어보기")).toBeOnTheScreen();
    expect(getTodayWritingStatus).not.toHaveBeenCalled();
    expect(getDiaryCalendarSummary).not.toHaveBeenCalled();
    expect(getFeaturedDailyPrompt).not.toHaveBeenCalled();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
  });

  it("[spec] 이어 쓰기 상태가 있으면 그 난이도로 홈 스냅샷을 부른다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer", { difficulty: "C" }));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderLoaded();

    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(getMobileHomeSnapshot).toHaveBeenCalledWith("C");
  });

  it("[spec] 스냅샷을 기다리는 동안 추천 질문과 영어일기 달력에 불러오는 중 표시가 보이고, 받으면 사라진다", async () => {
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pending.promise);
    await renderScreen();

    const indicators = spinners();
    expect(indicators).toHaveLength(2);
    indicators.forEach((indicator) => expect(indicator.props.color).toBe("#E38B12"));
    expect(screen.queryByText(FEATURED_FALLBACK)).toBeNull();
    expect(screen.queryByText(featuredPrompt.questionEn)).toBeNull();
    expect(screen.getByText("작문 대기 중")).toBeOnTheScreen();

    await act(async () => {
      pending.resolve(homeSnapshot());
    });
    await flushAsync();

    expect(spinners()).toHaveLength(0);
    expect(screen.getByText(featuredPrompt.questionEn)).toBeOnTheScreen();
  });

  it("[spec] 스냅샷의 값이 비어 있으면 대기 중 배지, 0 통계, 추천 질문 준비 문구를 보인다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue({});
    await renderScreen();

    expect(screen.getByText("작문 대기 중")).toBeOnTheScreen();
    expect(screen.getByText("일기 대기 중")).toBeOnTheScreen();
    expect(screen.getByText("총 0문항 작성 · 총 0개의 일기 작성")).toBeOnTheScreen();
    expect(screen.getByText(FEATURED_FALLBACK)).toBeOnTheScreen();
    expect(screen.getByText("오늘의 일기 쓰기")).toBeOnTheScreen();
  });

  it("[spec] 스냅샷이 실패하면 오늘 상태·일기 달력·추천 질문을 하나씩 다시 불러 그린다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockRejectedValue(new Error("스냅샷 실패"));
    jest.mocked(getTodayWritingStatus).mockResolvedValue(todayStatus({ streakDays: 5, totalAnswerSessions: 9 }));
    jest.mocked(getDiaryCalendarSummary).mockResolvedValue(diarySummary([DIARY_DAYS[3]], 1));
    jest.mocked(getFeaturedDailyPrompt).mockResolvedValue(featured({ prompt: otherPrompt }));
    await renderScreen();

    expect(getTodayWritingStatus).toHaveBeenCalledTimes(1);
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(1);
    expect(getFeaturedDailyPrompt).toHaveBeenCalledTimes(1);
    expect(getFeaturedDailyPrompt).toHaveBeenCalledWith("I");
    expect(screen.getByText("작문 5일 연속")).toBeOnTheScreen();
    expect(screen.getByText("일기 대기 중")).toBeOnTheScreen();
    expect(screen.getByText("총 9문항 작성 · 총 1개의 일기 작성")).toBeOnTheScreen();
    expect(screen.getByText(otherPrompt.questionEn)).toBeOnTheScreen();
    expect(screen.queryByText("스냅샷 실패")).toBeNull();
    expect(spinners()).toHaveLength(0);
  });

  it("[spec] 다시 부른 것도 실패하면 학습 일지·영어일기·추천 질문 자리에 각 오류 문구를 보인다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockRejectedValue(new Error("스냅샷 실패"));
    jest.mocked(getTodayWritingStatus).mockRejectedValue(new Error("학습 일지 서버 오류"));
    jest.mocked(getDiaryCalendarSummary).mockRejectedValue(new Error("일기 서버 오류"));
    jest.mocked(getFeaturedDailyPrompt).mockRejectedValue(new Error("추천 서버 오류"));
    await renderScreen();

    expect(screen.getByText("학습 일지 서버 오류")).toBeOnTheScreen();
    expect(screen.getByText("일기 서버 오류")).toBeOnTheScreen();
    expect(screen.getByText("추천 서버 오류")).toBeOnTheScreen();
    expect(screen.queryByText(FEATURED_FALLBACK)).toBeNull();
    expect(spinners()).toHaveLength(0);
  });

  it("[spec] 오류가 Error가 아니면 기본 오류 문구를 보인다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockRejectedValue("snapshot");
    jest.mocked(getTodayWritingStatus).mockRejectedValue("status");
    jest.mocked(getDiaryCalendarSummary).mockRejectedValue("diary");
    jest.mocked(getFeaturedDailyPrompt).mockRejectedValue("featured");
    await renderScreen();

    expect(screen.getByText("학습 일지를 불러오지 못했어요.")).toBeOnTheScreen();
    expect(screen.getByText("영어일기 달력을 불러오지 못했어요.")).toBeOnTheScreen();
    expect(screen.getByText("오늘의 추천 질문을 불러오지 못했어요.")).toBeOnTheScreen();
  });

  it("[spec] 당겨서 새로고침하면 세션 확인 → 지금 영어로 요약 → 홈 스냅샷 순서로 부르고, 도는 동안만 새로고침 표시가 켜진다", async () => {
    await renderLoaded();
    expect(refreshControl().props.refreshing).toBe(false);
    const pendingSession = deferred<AuthUser | null>();
    refreshSession.mockReturnValue(pendingSession.promise);
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ todayStatus: todayStatus({ streakDays: 9 }) }));

    await pullToRefresh();
    expect(refreshControl().props.refreshing).toBe(true);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingSession.resolve(signedInUser);
    });
    await flushAsync();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenLastCalledWith("I");
    expect(refreshSession.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(getNowInEnglishSummary).mock.invocationCallOrder[1]
    );
    expect(jest.mocked(getNowInEnglishSummary).mock.invocationCallOrder[1]).toBeLessThan(
      jest.mocked(getMobileHomeSnapshot).mock.invocationCallOrder[1]
    );
    expect(screen.getByText("작문 9일 연속")).toBeOnTheScreen();
    expect(refreshControl().props.refreshing).toBe(false);
  });

  it("[spec] 새로고침에서 세션이 없어졌으면 홈 데이터를 비우고 스냅샷을 다시 부르지 않는다", async () => {
    await renderLoaded();
    refreshSession.mockResolvedValue(null);

    await pullToRefresh();

    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByText("작문 대기 중")).toBeOnTheScreen();
    expect(screen.getByText("일기 대기 중")).toBeOnTheScreen();
    expect(screen.getByText("총 0문항 작성 · 총 0개의 일기 작성")).toBeOnTheScreen();
    expect(screen.getByText(FEATURED_FALLBACK)).toBeOnTheScreen();
    expect(refreshControl().props.refreshing).toBe(false);
  });

  it("[spec] 포커스를 다시 받으면 이어 쓰기 상태·일기 달력·지금 영어로 요약·튜토리얼 요청을 다시 확인하고 스냅샷도 다시 부른다", async () => {
    await renderLoaded();
    expect(getIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(0);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(consumeHomeTutorialReplay).toHaveBeenCalledTimes(1);

    await refocus();

    expect(getIncompleteLoop).toHaveBeenCalledTimes(2);
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(consumeHomeTutorialReplay).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenLastCalledWith("I");
  });

  it("[spec] 첫 불러오기가 끝나기 전에 포커스를 다시 받으면 일기 달력과 지금 영어로 요약을 따로 부르지 않는다", async () => {
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pending.promise);
    await renderScreen();

    await refocus();

    expect(getDiaryCalendarSummary).not.toHaveBeenCalled();
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(getIncompleteLoop).toHaveBeenCalledTimes(2);

    await act(async () => {
      pending.resolve(homeSnapshot());
    });
    await flushAsync();
  });
});

// ---------- 이어 쓰기 ----------

describe("[spec] 이어 쓰기", () => {
  it("[spec] 이어 쓰기 상태가 없으면 학습 일지 카드에 이어 쓰기 줄이 없다", async () => {
    await renderLoaded();

    expect(screen.queryByText("이어서 쓰기 >")).toBeNull();
    expect(screen.queryByText("다시 쓰기 >")).toBeNull();
    expect(screen.queryByText("피드백 이어보기 >")).toBeNull();
    expect(clearIncompleteLoop).not.toHaveBeenCalled();
  });

  it("[spec] 피드백 단계는 저장된 피드백 상태가 있으면 '피드백 이어보기' 줄을 보이고, 누르면 피드백 화면으로 간다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("feedback", { difficulty: "B" }));
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(feedbackState());
    await renderLoaded();

    expect(hydratePracticeFeedbackState).toHaveBeenCalledWith("B", "prompt-loop");
    expect(getLocalWritingDraft).not.toHaveBeenCalled();
    expect(getWritingDraft).not.toHaveBeenCalled();
    expect(screen.getByText("피드백 이어보기 >")).toBeOnTheScreen();
    expect(screen.getByText(`받아둔 피드백이 있어요 · ${SAVED_TIME}`)).toBeOnTheScreen();

    await pressText("피드백 이어보기 >");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/feedback",
      params: { difficulty: "B", promptId: "prompt-loop" }
    });
  });

  it("[spec] 피드백 단계인데 저장된 피드백 상태가 없으면 이어 쓰기 상태를 지우고 줄을 숨긴다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("feedback"));
    jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(null);
    await renderLoaded();

    expect(clearIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("피드백 이어보기 >")).toBeNull();
    expect(getMobileHomeSnapshot).toHaveBeenCalledWith("I");
  });

  it("[spec] 답 단계는 이 기기와 서버의 답 초안을 확인하고, 서버 초안만 있어도 '이어서 쓰기' 줄을 보이며 누르면 작문 화면으로 간다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    jest.mocked(getLocalWritingDraft).mockResolvedValue(null);
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderLoaded();

    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-loop", "ANSWER");
    expect(getWritingDraft).toHaveBeenCalledWith("prompt-loop", "ANSWER");
    expect(screen.getByText("이어서 쓰기 >")).toBeOnTheScreen();
    expect(screen.getByText(`쓰던 답안이 있어요 · ${SAVED_TIME}`)).toBeOnTheScreen();

    await pressText("이어서 쓰기 >");

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/write",
      params: { difficulty: "A", promptId: "prompt-loop" }
    });
  });

  it("[spec] 다시 쓰기 단계는 다시 쓰기 초안을 확인하고, 이 기기 초안만 있어도 '다시 쓰기' 줄을 보이며 누르면 이어 쓰는 다시 쓰기로 간다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("rewrite"));
    jest.mocked(getLocalWritingDraft).mockResolvedValue(writingDraft({ draftType: "REWRITE" }));
    jest.mocked(getWritingDraft).mockResolvedValue(null);
    await renderLoaded();

    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-loop", "REWRITE");
    expect(getWritingDraft).toHaveBeenCalledWith("prompt-loop", "REWRITE");
    expect(screen.getByText("다시 쓰기 >")).toBeOnTheScreen();
    expect(screen.getByText(`다시 쓰던 답안이 있어요 · ${SAVED_TIME}`)).toBeOnTheScreen();

    await pressText("다시 쓰기 >");

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/write",
      params: { difficulty: "A", promptId: "prompt-loop", mode: "rewrite", resume: "1" }
    });
  });

  it("[spec] 저장된 초안 종류가 있으면 단계보다 그 종류로 초안을 찾는다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer", { draftType: "REWRITE" }));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderLoaded();

    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-loop", "REWRITE");
    expect(getWritingDraft).toHaveBeenCalledWith("prompt-loop", "REWRITE");
    expect(screen.getByText("이어서 쓰기 >")).toBeOnTheScreen();
  });

  it("[spec] 이 기기와 서버에 초안이 모두 없으면 이어 쓰기 상태를 지우고 줄을 숨긴다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    await renderLoaded();

    expect(clearIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("이어서 쓰기 >")).toBeNull();
    expect(getMobileHomeSnapshot).toHaveBeenCalledWith("I");
  });

  it("[spec] 서버 초안 확인이 실패하면 이 기기 초안이 없어도 줄을 남긴다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    jest.mocked(getWritingDraft).mockRejectedValue(new Error("네트워크 오류"));
    await renderLoaded();

    expect(clearIncompleteLoop).not.toHaveBeenCalled();
    expect(screen.getByText("이어서 쓰기 >")).toBeOnTheScreen();
    expect(getMobileHomeSnapshot).toHaveBeenCalledWith("A");
  });

  it("[spec] 저장 시각을 읽을 수 없으면 이어 쓰기 줄에 단계 문구만 보인다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer", { updatedAt: "not-a-date" }));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderLoaded();

    expect(screen.getByText("쓰던 답안이 있어요")).toBeOnTheScreen();
  });

  it("[spec] 포커스를 다시 받을 때 이어 쓰기 상태가 없어졌으면 줄을 숨기고 기본 난이도로 스냅샷을 다시 부른다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderLoaded();
    expect(screen.getByText("이어서 쓰기 >")).toBeOnTheScreen();

    jest.mocked(getIncompleteLoop).mockResolvedValue(null);
    await refocus();

    expect(screen.queryByText("이어서 쓰기 >")).toBeNull();
    expect(getMobileHomeSnapshot).toHaveBeenLastCalledWith("I");
  });

  it("[spec] 로그인하지 않은 상태에서는 서버 초안을 확인하지 않고, 이 기기 초안이 없으면 이어 쓰기 상태를 지운다", async () => {
    setSessionUser(null);
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    await renderScreen();

    expect(getLocalWritingDraft).toHaveBeenCalledWith("prompt-loop", "ANSWER");
    expect(getWritingDraft).not.toHaveBeenCalled();
    expect(clearIncompleteLoop).toHaveBeenCalledTimes(1);
  });
});

// ---------- 머리 줄 ----------

describe("[spec] 머리 줄", () => {
  it("[spec] 의견 보내기 버튼을 누르면 홈에서 보낸 의견 화면으로 간다", async () => {
    await renderLoaded();

    const button = screen.getByRole("button", { name: FEEDBACK_ENTRY_LABEL });
    expect(within(button).getByText("의견 보내기")).toBeOnTheScreen();
    await fireEvent.press(button);

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/support-feedback", params: { source: "home" } });
  });
});

// ---------- 학습 일지 카드 ----------

describe("[spec] 학습 일지 카드", () => {
  it("[spec] 연속 일수에 맞는 마스코트를 보인다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ todayStatus: todayStatus({ streakDays: 7 }) }));
    await renderLoaded();

    const images = findHost(screen.root!, "Image");
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual(require("@/assets/images/streak-mascot/streak-07.png"));
  });

  it("[spec] 연속 일수가 3일보다 적으면 기본 마스코트를 보인다", async () => {
    await renderLoaded();

    expect(findHost(screen.root!, "Image")[0].props.source).toEqual(
      require("@/assets/images/streak-mascot/streak-default.png")
    );
  });

  it("[spec] 오늘 완료했으면 연속 일수가 0이어도 작문 1일 연속으로 보인다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ todayStatus: todayStatus({ streakDays: 0 }) }));
    await renderLoaded();

    expect(screen.getByText("작문 1일 연속")).toBeOnTheScreen();
  });

  it("[spec] 오늘 일기가 없으면 어제부터 이어진 날로 일기 연속을 센다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(
      homeSnapshot({ diaryCalendarSummary: diarySummary(DIARY_DAYS.slice(1)) })
    );
    await renderLoaded();

    expect(screen.getByText("일기 2일 연속")).toBeOnTheScreen();
  });

  it("[spec] 학습 일지 카드를 누르면 기록 화면으로 간다", async () => {
    await renderLoaded();

    await pressText("학습 일지");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/records");
  });

  it("[spec] 요일 줄은 오늘이 맨 오른쪽인 7일이고, 오늘 완료했으면 오늘부터 연속 일수만큼 완료로 표시한다", async () => {
    await renderLoaded();

    const chips = weekRowChips();
    expect(chips.map((chip) => chip.label)).toEqual(["금", "토", "일", "월", "화", "수", "목"]);
    // 오늘(목): 오늘 표시가 완료 표시를 덮는다.
    expect(chips[6].chipStyle).toMatchObject({ backgroundColor: "#FFF8F1", borderWidth: 3, borderColor: "#F2C28A" });
    expect(chips[6].textStyle).toMatchObject({ color: "#8C6433" });
    // 어제(수): 완료
    expect(chips[5].chipStyle).toMatchObject({ backgroundColor: "#FFE8CB" });
    expect(chips[5].chipStyle.borderWidth).toBeUndefined();
    expect(chips[5].textStyle).toMatchObject({ color: "#9A6A22" });
    // 그 전(화)부터: 기본
    for (const chip of chips.slice(0, 5)) {
      expect(chip.chipStyle).toMatchObject({ backgroundColor: "#EDE6DE" });
      expect(chip.textStyle).toMatchObject({ color: "#A39A8F" });
    }
  });

  it("[spec] 오늘 완료하지 않았으면 어제부터 연속 일수만큼 완료로 표시한다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(
      homeSnapshot({ todayStatus: todayStatus({ completed: false, streakDays: 2 }) })
    );
    await renderLoaded();

    const chips = weekRowChips();
    expect(chips[6].chipStyle).toMatchObject({ backgroundColor: "#FFF8F1" });
    expect(chips[5].chipStyle).toMatchObject({ backgroundColor: "#FFE8CB" });
    expect(chips[4].chipStyle).toMatchObject({ backgroundColor: "#FFE8CB" });
    expect(chips[3].chipStyle).toMatchObject({ backgroundColor: "#EDE6DE" });
  });

  it("[spec] 요일 줄을 누르면 월 달력 모달이 열린다", async () => {
    await renderLoaded();
    expect(modalHosts()).toHaveLength(0);

    await openCalendar();

    const modal = openModal();
    expect(within(modal).getByText("2026년 11월")).toBeOnTheScreen();
  });
});

// ---------- 지금 영어로 ----------

describe("[spec] 지금 영어로", () => {
  it("[spec] 안내 문구, 오늘 남긴 조각 수, 루프 알림 ON을 보이고 알림을 누르면 /now 알림 설정을 연다", async () => {
    await renderLoaded();

    expect(screen.getByText("지금 영어로")).toBeOnTheScreen();
    expect(screen.getByText(NOW_BODY)).toBeOnTheScreen();
    expect(screen.getByText("오늘 남긴 조각")).toBeOnTheScreen();
    const reminder = screen.getByRole("button", { name: REMINDER_LABEL });
    expect(within(reminder).getByText("ON")).toBeOnTheScreen();
    expect(within(reminder).getByText("루프 알림")).toBeOnTheScreen();
    expect(screen.getByText("오늘 남긴 조각").parent!.children[0]).toHaveTextContent("1");

    await fireEvent.press(reminder);

    expect(router.push).toHaveBeenCalledWith({ pathname: "/now", params: { reminder: "open" } });
  });

  it("[spec] 알림이 꺼져 있으면 OFF, 요약을 받기 전에는 0과 OFF를 보인다", async () => {
    const pending = deferred<NowInEnglishSummary>();
    jest.mocked(getNowInEnglishSummary).mockReturnValue(pending.promise);
    await renderLoaded();

    expect(within(screen.getByRole("button", { name: REMINDER_LABEL })).getByText("OFF")).toBeOnTheScreen();
    expect(screen.getByText("오늘 남긴 조각").parent!.children[0]).toHaveTextContent("0");
    expect(screen.getByText("총 0개의 영어조각")).toBeOnTheScreen();

    await act(async () => {
      pending.resolve(nowSummary({ todayCount: 3 }, false));
    });
    await flushAsync();

    expect(within(screen.getByRole("button", { name: REMINDER_LABEL })).getByText("OFF")).toBeOnTheScreen();
    expect(screen.getByText("오늘 남긴 조각").parent!.children[0]).toHaveTextContent("3");
  });

  it("[spec] 지금 쓰기는 /now로, 기록 보기는 기록 화면의 지금 영어로 탭으로 간다", async () => {
    await renderLoaded();

    await pressText("지금 쓰기");
    expect(router.push).toHaveBeenLastCalledWith("/now");

    await pressText("기록 보기");
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/records", params: { tab: "now" } });
    expect(router.push).toHaveBeenCalledTimes(2);
  });
});

// ---------- 질문 답하기와 학습 가이드 ----------

describe("[spec] 질문 답하기와 학습 가이드", () => {
  it("[spec] 가이드 보기를 누르면 학습 가이드 모달이 열려 단계 4개와 팁을 보이고, 닫기를 누르면 닫힌다", async () => {
    await renderLoaded();
    expect(screen.getByText("질문 답하기")).toBeOnTheScreen();

    await pressText("가이드 보기");

    const modal = openModal();
    expect(within(modal).getByText("바로 보는 학습 가이드")).toBeOnTheScreen();
    expect(within(modal).getByText("질문 선택, 코치 도움, 피드백까지 한 흐름으로 이어집니다.")).toBeOnTheScreen();
    const steps: [string, string, string][] = [
      ["1", "난이도 고르기", "지금 컨디션에 맞는 난이도를 하나 고르면 오늘 질문 세트가 바로 열려요."],
      ["2", "질문 하나 선택하기", "마음에 드는 질문을 고른 뒤 2~4문장 정도로 가볍게 먼저 써 보세요."],
      ["3", "AI 코치 활용하기", "표현이 막히면 작문칸 안의 마스코트를 눌러 코치에게 첫 문장이나 표현을 물어볼 수 있어요."],
      ["4", "피드백으로 다시 쓰기", "피드백에서 잘한 점과 다음 루프 제안을 보고 한 번 더 다듬으면 실력이 훨씬 빨리 붙어요."]
    ];
    for (const [index, title, body] of steps) {
      expect(within(modal).getByText(index)).toBeOnTheScreen();
      expect(within(modal).getByText(title)).toBeOnTheScreen();
      expect(within(modal).getByText(body)).toBeOnTheScreen();
    }
    expect(within(modal).getByText("작게 시작하는 게 가장 좋아요.")).toBeOnTheScreen();
    expect(
      within(modal).getByText(
        "완벽하게 길게 쓰려고 하기보다, 짧게 먼저 쓰고 AI 코치와 피드백으로 한 번 더 다듬는 방식이 가장 안정적으로 늘어요."
      )
    ).toBeOnTheScreen();
    expect(modal.props.animationType).toBe("slide");

    await fireEvent.press(within(modal).getByText("닫기"));

    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 학습 가이드 모달은 뒤로가기(닫기 요청)로도 닫힌다", async () => {
    await renderLoaded();
    await pressText("가이드 보기");

    await fireEvent(openModal(), "requestClose");

    expect(modalHosts()).toHaveLength(0);
  });
});

// ---------- 오늘의 추천 질문 ----------

describe("[spec] 오늘의 추천 질문", () => {
  function featuredHeader() {
    return screen.getByText("오늘의 추천 질문").parent!;
  }

  it("[spec] 추천의 난이도 배지, 질문, 이유, 주제, 해석 보기를 보이고 해석은 처음에 숨겨져 있다", async () => {
    await renderLoaded();

    const badgeText = within(featuredHeader()).getByText("보통");
    expect(badgeText).toHaveStyle({ color: "#2D7DA8" });
    expect(StyleSheet.flatten(badgeText.parent!.props.style)).toMatchObject({
      backgroundColor: "#E6F4FB",
      borderColor: "#2D7DA8"
    });
    expect(screen.getByText(featuredPrompt.questionEn)).toBeOnTheScreen();
    expect(screen.getByText("요즘 여행 이야기를 자주 썼어요.")).toBeOnTheScreen();
    expect(screen.getByText("Travel")).toBeOnTheScreen();
    expect(screen.getByText("해석 보기")).toBeOnTheScreen();
    expect(screen.queryByText(featuredPrompt.questionKo)).toBeNull();
  });

  it("[spec] 해석 보기를 누르면 해석이 보이고 해석 숨기기로 바뀌며, 다시 누르면 숨긴다. 질문으로 넘어가지 않는다", async () => {
    await renderLoaded();

    await pressText("해석 보기");
    expect(screen.getByText(featuredPrompt.questionKo)).toBeOnTheScreen();
    expect(screen.getByText("해석 숨기기")).toBeOnTheScreen();

    await pressText("해석 숨기기");
    expect(screen.queryByText(featuredPrompt.questionKo)).toBeNull();
    expect(screen.getByText("해석 보기")).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
    expect(trackDailyPromptClick).not.toHaveBeenCalled();
  });

  it("[spec] 추천 질문을 누르면 클릭을 기록하고 추천 난이도로 작문 화면에 간다", async () => {
    await renderLoaded();

    await pressText(featuredPrompt.questionEn);

    expect(trackDailyPromptClick).toHaveBeenCalledTimes(1);
    expect(trackDailyPromptClick).toHaveBeenCalledWith("prompt-featured");
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/practice/write",
      params: { difficulty: "B", promptId: "prompt-featured" }
    });
  });

  it("[spec] 클릭 기록이 실패해도 작문 화면으로 간다", async () => {
    jest.mocked(trackDailyPromptClick).mockRejectedValue(new Error("기록 실패"));
    await renderLoaded();

    await pressText(featuredPrompt.questionEn);
    await flushAsync();

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("기록 실패")).toBeNull();
  });

  it("[spec] 이유 문구가 비어 있으면 이유를 보이지 않는다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(
      homeSnapshot({ featuredRecommendation: featured({ reasonText: "" }) })
    );
    await renderLoaded();

    expect(screen.queryByText("요즘 여행 이야기를 자주 썼어요.")).toBeNull();
    expect(screen.getByText("Travel")).toBeOnTheScreen();
  });

  it("[spec] 추천 질문이 없으면 준비 문구를 보이고, 배지는 이어 쓰기 난이도(없으면 입문)를 쓴다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ featuredRecommendation: null }));
    await renderScreen();

    expect(screen.getByText(FEATURED_FALLBACK)).toBeOnTheScreen();
    expect(within(featuredHeader()).getByText("입문")).toHaveStyle({ color: "#F29A2E" });
  });

  it("[spec] 추천에 질문이 없고 이어 쓰기 상태가 C 난이도면 배지는 도전이다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer", { difficulty: "C" }));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pending.promise);
    await renderScreen();

    expect(within(featuredHeader()).getByText("도전")).toBeOnTheScreen();

    await act(async () => {
      pending.resolve(homeSnapshot({ featuredRecommendation: null }));
    });
    await flushAsync();

    expect(within(featuredHeader()).getByText("도전")).toBeOnTheScreen();
    expect(screen.getByText(FEATURED_FALLBACK)).toBeOnTheScreen();
  });

  it("[spec] 새로고침으로 추천 질문이 바뀌면 펼쳤던 해석이 다시 숨겨진다", async () => {
    await renderLoaded();
    await pressText("해석 보기");
    expect(screen.getByText(featuredPrompt.questionKo)).toBeOnTheScreen();
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ featuredRecommendation: featured({ prompt: otherPrompt }) }));

    await pullToRefresh();

    expect(screen.getByText(otherPrompt.questionEn)).toBeOnTheScreen();
    expect(screen.queryByText(otherPrompt.questionKo)).toBeNull();
    expect(screen.getByText("해석 보기")).toBeOnTheScreen();
  });

  it("[spec] 새로고침해도 같은 추천 질문이면 펼쳤던 해석이 그대로 보인다", async () => {
    await renderLoaded();
    await pressText("해석 보기");

    await pullToRefresh();

    expect(screen.getByText(featuredPrompt.questionKo)).toBeOnTheScreen();
    expect(screen.getByText("해석 숨기기")).toBeOnTheScreen();
  });
});

// ---------- 난이도별 질문 ----------

describe("[spec] 난이도별 질문", () => {
  it("[spec] 난이도 카드 4개를 보이고, 누르면 그 난이도의 질문 목록으로 간다", async () => {
    await renderLoaded();

    expect(screen.getByText("난이도별 질문")).toBeOnTheScreen();
    expect(screen.getByText("내 수준에 맞게 골라 보세요.")).toBeOnTheScreen();
    const cards: [DailyDifficulty, string][] = [
      ["I", "짧은 한두 문장으로 가볍게 시작해 보세요."],
      ["A", "쉬운 문장으로 부담 없이 이어가 보세요."],
      ["B", "이유와 예시를 붙여 답을 넓혀 보세요."],
      ["C", "비교와 전환 표현으로 더 탄탄하게 써 보세요."]
    ];
    for (const [difficulty, subtitle] of cards) {
      await pressText(subtitle);
      expect(router.push).toHaveBeenLastCalledWith({ pathname: "/practice/[difficulty]", params: { difficulty } });
    }
    expect(router.push).toHaveBeenCalledTimes(4);
    for (const title of ["입문", "쉬움", "도전"]) {
      expect(screen.getByText(title)).toBeOnTheScreen();
    }
    // "보통"은 추천 질문 배지에도 있다.
    expect(screen.getAllByText("보통")).toHaveLength(2);
  });
});

// ---------- 영어일기 ----------

describe("[spec] 영어일기", () => {
  it("[spec] 전체 보기를 누르면 영어일기 목록으로 간다", async () => {
    await renderLoaded();
    expect(screen.getByText("영어일기")).toBeOnTheScreen();

    await pressText("전체 보기");

    expect(router.push).toHaveBeenCalledWith("/diary");
  });

  it("[spec] 이번 달 달력을 보이고, 다음 달 버튼은 막혀 있으며 이전 달로 갔다가 돌아올 수 있다", async () => {
    await renderLoaded();

    expect(screen.getByText("2026년 11월")).toBeOnTheScreen();
    expect(screen.getByText(">")).toBeDisabled();
    expect(screen.getByText(">")).toHaveStyle({ color: "#BFAE9D" });
    await pressText(">");
    expect(screen.getByText("2026년 11월")).toBeOnTheScreen();

    await pressText("<");
    expect(screen.getByText("2026년 10월")).toBeOnTheScreen();
    expect(screen.getByText(">")).toBeEnabled();
    expect(screen.getByText(">")).toHaveStyle({ color: "#8A6431" });
    expect(screen.getByRole("button", { name: "2026-09-27 영어일기 보기" })).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: /영어일기 보기$/ })).toHaveLength(35);

    await pressText(">");
    expect(screen.getByText("2026년 11월")).toBeOnTheScreen();
    expect(getDiaryCalendarSummary).not.toHaveBeenCalled();
  });

  it("[spec] 요일 머리와 이번 달 칸 35개(11월 1일 ~ 12월 5일)를 보인다", async () => {
    await renderLoaded();

    const cells = screen.getAllByRole("button", { name: /영어일기 보기$/ });
    expect(cells).toHaveLength(35);
    expect(cells[0]).toHaveAccessibleName("2026-11-01 영어일기 보기");
    expect(cells[34]).toHaveAccessibleName("2026-12-05 영어일기 보기");
    const weekHeader = screen.getAllByText("일").at(-1)!.parent!;
    expect(weekHeader.children.map((child) => (child as TestInstance).children[0])).toEqual([
      "일",
      "월",
      "화",
      "수",
      "목",
      "금",
      "토"
    ]);
  });

  it("[spec] 칸의 모양: 일기 있음·오늘·다른 달·미래", async () => {
    await renderLoaded();

    const withEntry = screen.getByRole("button", { name: "2026-11-07 영어일기 보기" });
    expect(withEntry).toHaveStyle({ backgroundColor: "#FFF0D7" });
    expect(within(withEntry).getByText("7")).toHaveStyle({ color: "#8A5A1E" });
    expect(cellHasDot(withEntry)).toBe(true);

    const today = screen.getByRole("button", { name: "2026-11-12 영어일기 보기" });
    expect(today).toHaveStyle({ borderWidth: 1, borderColor: "#F2A14A", backgroundColor: "#FFF0D7" });
    expect(within(today).getByText("12")).toHaveStyle({ color: "#2E2416" });

    const empty = screen.getByRole("button", { name: "2026-11-08 영어일기 보기" });
    expect(cellHasDot(empty)).toBe(false);
    expect(within(empty).getByText("8")).toHaveStyle({ color: "#5E5247" });
    expect(empty).toBeEnabled();

    const future = screen.getByRole("button", { name: "2026-11-13 영어일기 보기" });
    expect(future).toHaveStyle({ opacity: 0.25 });
    expect(within(future).getByText("13")).toHaveStyle({ color: "#C4B8AC" });
    expect(future).toBeDisabled();

    const outside = screen.getByRole("button", { name: "2026-12-01 영어일기 보기" });
    expect(outside).toHaveStyle({ opacity: 0.25 });
    expect(outside).toBeDisabled();
  });

  function cellHasDot(cell: TestInstance) {
    return cell.queryAll(
      (node) => node.type === "View" && StyleSheet.flatten(node.props.style)?.backgroundColor === "#A76518"
    ).length > 0;
  }

  it("[spec] 일기가 있는 칸을 누르면 그 일기를 연다", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByRole("button", { name: "2026-11-07 영어일기 보기" }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/diary/[entryId]", params: { entryId: "diary-1107" } });

    await fireEvent.press(screen.getByRole("button", { name: "2026-11-12 영어일기 보기" }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/diary/[entryId]", params: { entryId: "diary-1112" } });
  });

  it("[spec] 일기가 없는 지난 날은 목록으로, 미래 칸은 눌러도 아무 일이 없다", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByRole("button", { name: "2026-11-08 영어일기 보기" }));
    expect(router.push).toHaveBeenLastCalledWith("/diary");

    await fireEvent.press(screen.getByRole("button", { name: "2026-11-13 영어일기 보기" }));
    await fireEvent.press(screen.getByRole("button", { name: "2026-12-01 영어일기 보기" }));
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("[spec] 지난달의 다른 달 칸(9월)도 일기가 없으면 목록으로, 지난달 일기 칸은 그 일기로 간다", async () => {
    await renderLoaded();
    await pressText("<");

    const september = screen.getByRole("button", { name: "2026-09-30 영어일기 보기" });
    expect(september).toHaveStyle({ opacity: 0.45 });
    await fireEvent.press(september);
    expect(router.push).toHaveBeenLastCalledWith("/diary");

    await fireEvent.press(screen.getByRole("button", { name: "2026-10-30 영어일기 보기" }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/diary/[entryId]", params: { entryId: "diary-1030" } });
  });

  it("[spec] 오늘 일기가 있으면 '오늘 일기 이어보기'로 그 일기를 연다", async () => {
    await renderLoaded();

    await pressText("오늘 일기 이어보기");

    expect(router.push).toHaveBeenCalledWith({ pathname: "/diary/[entryId]", params: { entryId: "diary-1112" } });
  });

  it("[spec] 오늘 일기가 없으면 '오늘의 일기 쓰기'와 오늘 칸이 일기 쓰기로 간다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(
      homeSnapshot({ diaryCalendarSummary: diarySummary(DIARY_DAYS.slice(1)) })
    );
    await renderLoaded();

    await pressText("오늘의 일기 쓰기");
    expect(router.push).toHaveBeenLastCalledWith("/diary/write");

    await fireEvent.press(screen.getByRole("button", { name: "2026-11-12 영어일기 보기" }));
    expect(router.push).toHaveBeenLastCalledWith("/diary/write");
    expect(router.push).toHaveBeenCalledTimes(2);
  });

  it("[spec] 포커스를 다시 받아 일기 달력을 부르는 동안 달력에 불러오는 중 표시가 보인다", async () => {
    await renderLoaded();
    const pendingDiary = deferred<DiaryCalendarSummary>();
    jest.mocked(getDiaryCalendarSummary).mockReturnValue(pendingDiary.promise);
    const pendingSnapshot = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pendingSnapshot.promise);

    await refocus();

    // 일기 달력 표시 1개 + 다시 부른 스냅샷의 추천 질문 표시 1개
    expect(spinners()).toHaveLength(2);

    await act(async () => {
      pendingSnapshot.resolve(homeSnapshot());
    });
    await flushAsync();
    // 스냅샷이 끝나면 일기 달력을 기다리는 중이어도 표시를 끈다.
    expect(spinners()).toHaveLength(0);

    await act(async () => {
      pendingDiary.resolve(diarySummary());
    });
    await flushAsync();
    expect(spinners()).toHaveLength(0);
  });
});

// ---------- 월 달력 모달 ----------

describe("[spec] 월 달력 모달", () => {
  it("[spec] 열면 그 달 기록을 부르고, 부르는 동안 불러오는 중 표시를 보인다", async () => {
    const pending = deferred<MonthWritingStatus | null>();
    jest.mocked(getMonthWritingStatus).mockReturnValue(pending.promise);
    await renderLoaded();

    await openCalendar();

    expect(getMonthWritingStatus).toHaveBeenCalledTimes(1);
    expect(getMonthWritingStatus).toHaveBeenCalledWith(2026, 11);
    const modal = openModal();
    expect(spinners(modal)).toHaveLength(1);
    expect(spinners(modal)[0].props.color).toBe("#E38B12");
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe("fade");

    await act(async () => {
      pending.resolve(monthStatus(2026, 11, ["2026-11-09"]));
    });
    await flushAsync();

    expect(spinners(openModal())).toHaveLength(0);
  });

  it("[spec] 제목, 이번 달에서 막힌 다음 달 버튼, 요약 문구, 범례, 총 문장 수를 보인다", async () => {
    await renderLoaded();
    await openCalendar();

    const modal = openModal();
    expect(within(modal).getByText("2026년 11월")).toBeOnTheScreen();
    expect(within(modal).getByText(">")).toBeDisabled();
    expect(within(modal).getByText(">")).toHaveStyle({ color: "#B7A38A" });
    expect(within(modal).getByText("현재 2일 연속 학습 중")).toBeOnTheScreen();
    expect(within(modal).getByText("작문")).toBeOnTheScreen();
    expect(within(modal).getByText("일기")).toBeOnTheScreen();
    expect(within(modal).getByText("영어조각")).toBeOnTheScreen();
    expect(within(modal).getByText("총 5,678문장 작성")).toBeOnTheScreen();
    for (const label of ["일", "월", "화", "수", "목", "금", "토"]) {
      expect(within(modal).getByText(label)).toBeOnTheScreen();
    }
  });

  it("[spec] 칸마다 작문·일기·영어조각 점과 접근성 이름을 단다", async () => {
    await renderLoaded();
    await openCalendar();

    const modal = openModal();
    const cases: [string, string[]][] = [
      ["12일, 작문 완료, 일기 작성, 영어조각 작성", ["작문", "일기", "영어조각"]],
      ["11일, 작문 완료, 일기 작성", ["작문", "일기"]],
      ["10일, 일기 작성, 영어조각 작성", ["일기", "영어조각"]],
      ["9일, 작문 완료", ["작문"]],
      ["8일", []],
      ["7일, 일기 작성", ["일기"]],
      ["5일, 영어조각 작성", ["영어조각"]]
    ];
    for (const [name, dots] of cases) {
      const cell = within(modal).getByRole("button", { name });
      expect(cellDots(cell)).toEqual(dots);
    }
    expect(within(modal).getAllByRole("button", { name: /^\d+일/ })).toHaveLength(35);
    expect(within(modal).getByRole("button", { name: "12일, 작문 완료, 일기 작성, 영어조각 작성" })).toHaveStyle({
      borderWidth: 1,
      borderColor: "#F2A14A"
    });
  });

  it("[spec] 일기만 있는 칸을 누르면 닫고 그 일기를 연다", async () => {
    await renderLoaded();
    await openCalendar();

    await fireEvent.press(within(openModal()).getByRole("button", { name: "7일, 일기 작성" }));

    expect(modalHosts()).toHaveLength(0);
    expect(router.push).toHaveBeenCalledWith({ pathname: "/diary/[entryId]", params: { entryId: "diary-1107" } });
  });

  it("[spec] 작문 없이 영어조각이 있는 칸은 닫고 기록 화면의 지금 영어로 탭으로 간다(일기가 함께 있어도)", async () => {
    await renderLoaded();
    await openCalendar();
    await fireEvent.press(within(openModal()).getByRole("button", { name: "5일, 영어조각 작성" }));
    expect(modalHosts()).toHaveLength(0);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/records", params: { tab: "now" } });

    await openCalendar();
    await fireEvent.press(within(openModal()).getByRole("button", { name: "10일, 일기 작성, 영어조각 작성" }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/records", params: { tab: "now" } });
  });

  it("[spec] 작문이 있거나 아무 기록이 없는 칸은 닫고 그 날짜의 기록 화면으로 간다", async () => {
    await renderLoaded();
    await openCalendar();
    await fireEvent.press(within(openModal()).getByRole("button", { name: "12일, 작문 완료, 일기 작성, 영어조각 작성" }));
    expect(modalHosts()).toHaveLength(0);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/records", params: { date: "2026-11-12" } });

    await openCalendar();
    await fireEvent.press(within(openModal()).getByRole("button", { name: "8일" }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/records", params: { date: "2026-11-08" } });
  });

  it("[spec] 이전 달로 가면 그 달 기록을 부르고 다음 달 버튼이 풀리며, 기록 수 요약을 보인다", async () => {
    await renderLoaded();
    await openCalendar();
    jest.mocked(getMonthWritingStatus).mockResolvedValue(monthStatus(2026, 10, ["2026-10-05", "2026-10-20"]));

    await fireEvent.press(within(openModal()).getByText("<"));
    await flushAsync();

    expect(getMonthWritingStatus).toHaveBeenLastCalledWith(2026, 10);
    const modal = openModal();
    expect(within(modal).getByText("2026년 10월")).toBeOnTheScreen();
    expect(within(modal).getByText(">")).toBeEnabled();
    expect(within(modal).getByText("2일 기록이 있어요")).toBeOnTheScreen();
    expect(within(modal).getByRole("button", { name: "30일, 일기 작성" })).toBeOnTheScreen();
    expect(within(modal).getByRole("button", { name: "15일, 영어조각 작성" })).toBeOnTheScreen();

    await fireEvent.press(within(modal).getByText(">"));
    await flushAsync();
    expect(getMonthWritingStatus).toHaveBeenLastCalledWith(2026, 11);
    expect(within(openModal()).getByText("2026년 11월")).toBeOnTheScreen();
  });

  it("[spec] 기록이 없는 달은 '기록이 없어요'", async () => {
    await renderLoaded();
    await openCalendar();
    jest.mocked(getMonthWritingStatus).mockResolvedValue(null);

    await fireEvent.press(within(openModal()).getByText("<"));
    await flushAsync();

    expect(within(openModal()).getByText("기록이 없어요")).toBeOnTheScreen();
  });

  it("[spec] 이번 달에 연속이 1일 이하이고 오늘 완료했으면 '오늘도 학습 기록이 쌓였어요'", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ todayStatus: todayStatus({ streakDays: 1 }) }));
    await renderLoaded();
    await openCalendar();

    expect(within(openModal()).getByText("오늘도 학습 기록이 쌓였어요")).toBeOnTheScreen();
  });

  it("[spec] 이번 달이라도 연속이 없고 오늘 완료하지 않았으면 그 달 기록 수를 보인다", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(
      homeSnapshot({ todayStatus: todayStatus({ completed: false, streakDays: 0 }) })
    );
    await renderLoaded();
    await openCalendar();

    expect(within(openModal()).getByText("1일 기록이 있어요")).toBeOnTheScreen();
  });

  it("[spec] 닫기 버튼, 바깥 배경, 닫기 요청으로 닫히고, 다시 열면 이번 달로 돌아온다", async () => {
    await renderLoaded();
    await openCalendar();

    await fireEvent.press(within(openModal()).getByText("닫기"));
    expect(modalHosts()).toHaveLength(0);

    await openCalendar();
    const overlay = openModal().children[0] as TestInstance;
    await fireEvent.press(overlay.children[0] as TestInstance);
    expect(modalHosts()).toHaveLength(0);

    await openCalendar();
    await fireEvent.press(within(openModal()).getByText("<"));
    await flushAsync();
    expect(within(openModal()).getByText("2026년 10월")).toBeOnTheScreen();
    await fireEvent(openModal(), "requestClose");
    expect(modalHosts()).toHaveLength(0);

    await openCalendar();
    expect(within(openModal()).getByText("2026년 11월")).toBeOnTheScreen();
    expect(getMonthWritingStatus).toHaveBeenLastCalledWith(2026, 11);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("[spec] 기록을 부르다 실패하면 오류 문구를 보인다", async () => {
    jest.mocked(getMonthWritingStatus).mockRejectedValue(new Error("달력 서버 오류"));
    await renderLoaded();
    await openCalendar();

    expect(within(openModal()).getByText("달력 서버 오류")).toBeOnTheScreen();
    expect(spinners(openModal())).toHaveLength(0);
  });

  it("[spec] 오류가 Error가 아니면 기본 오류 문구를 보인다", async () => {
    jest.mocked(getMonthWritingStatus).mockRejectedValue("month");
    await renderLoaded();
    await openCalendar();

    expect(within(openModal()).getByText("달력을 불러오지 못했어요.")).toBeOnTheScreen();
  });
});

// ---------- 튜토리얼 ----------

describe("[spec] 튜토리얼", () => {
  async function renderWithTutorialRequested() {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    installMeasure();
    await renderLoaded();
  }

  it("[spec] 처음 보는 사용자면 첫 불러오기 뒤 180ms에 1단계를 띄우고, 대상 위치로 스크롤한 뒤 강조 영역을 넘긴다", async () => {
    await renderWithTutorialRequested();
    expect(consumeHomeTutorialReplay).toHaveBeenCalledTimes(1);
    expect(hasCompletedHomeTutorial).toHaveBeenCalledTimes(1);

    await advance(179);
    expect(lastTutorialProps().visible).toBe(false);
    expect(modalHosts()).toHaveLength(0);

    await advance(1);
    expect(lastTutorialProps()).toMatchObject({ visible: true, stepIndex: 0, spotlight: null, isPositioning: true });
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: 156, animated: false });

    await advance(119);
    expect(lastTutorialProps()).toMatchObject({ spotlight: null, isPositioning: true });

    await advance(1);
    expect(lastTutorialProps()).toMatchObject({ visible: true, stepIndex: 0, spotlight: SPOTLIGHT, isPositioning: false });
    expect(screen.getByText("1/4 지금 영어로")).toBeOnTheScreen();
    expect(screen.getByText("떠오른 생각을 바로 영어로 바꿔 봐요")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: SKIP_LABEL })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "다음" })).toBeOnTheScreen();
  });

  it("[spec] 스크롤한 만큼을 더해 대상 위치로 스크롤한다", async () => {
    await renderWithTutorialRequested();
    await fireEvent.scroll(scrollHost(), { nativeEvent: { contentOffset: { x: 0, y: 400 } } });

    await advance(180);

    expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: 556, animated: false });
  });

  it("[spec] 다시 보기 요청이 있으면 완료했어도 띄우고, 완료 여부는 읽지 않는다", async () => {
    jest.mocked(consumeHomeTutorialReplay).mockResolvedValue(true);
    installMeasure();
    await renderLoaded();

    await advance(180);
    await advance(120);

    expect(hasCompletedHomeTutorial).not.toHaveBeenCalled();
    expect(screen.getByText("1/4 지금 영어로")).toBeOnTheScreen();
  });

  it("[spec] 이미 완료했고 다시 보기 요청이 없으면 띄우지 않는다", async () => {
    installMeasure();
    await renderLoaded();

    await advance(2000);

    expect(lastTutorialProps().visible).toBe(false);
    expect(scrollViewScrollTo).not.toHaveBeenCalled();
    expect(modalHosts()).toHaveLength(0);
  });

  it("[spec] 저장소를 읽지 못하면 띄우지 않고 홈은 그대로 보인다", async () => {
    jest.mocked(consumeHomeTutorialReplay).mockRejectedValue(new Error("저장소 오류"));
    installMeasure();
    await renderLoaded();

    await advance(2000);

    expect(lastTutorialProps().visible).toBe(false);
    expect(screen.getByText("학습 일지")).toBeOnTheScreen();
  });

  it("[spec] 첫 불러오기가 끝나기 전에는 띄우지 않고, 끝난 뒤 180ms에 띄운다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    installMeasure();
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pending.promise);
    await renderScreen();

    await advance(1000);
    expect(lastTutorialProps().visible).toBe(false);

    await act(async () => {
      pending.resolve(homeSnapshot());
    });
    await flushAsync();
    await advance(179);
    expect(lastTutorialProps().visible).toBe(false);
    await advance(1);
    expect(lastTutorialProps().visible).toBe(true);
  });

  it("[spec] 앱 업데이트 안내가 끝나기 전에는 띄우지 않고, 끝나면 180ms 뒤에 띄운다", async () => {
    setAppUpdatePhase("visible");
    await renderWithTutorialRequested();

    await advance(1000);
    expect(lastTutorialProps().visible).toBe(false);

    setAppUpdatePhase("settled");
    await screen.rerender(<HomeScreen />);
    await flushAsync();
    await advance(179);
    expect(lastTutorialProps().visible).toBe(false);
    await advance(1);
    expect(lastTutorialProps().visible).toBe(true);
  });

  it("[spec] 앱 업데이트 확인 중(checking)에도 띄우지 않는다", async () => {
    setAppUpdatePhase("checking");
    await renderWithTutorialRequested();

    await advance(1000);

    expect(lastTutorialProps().visible).toBe(false);
  });

  it("[spec] 추천 질문을 불러오는 중에는 띄우지 않는다", async () => {
    setAppUpdatePhase("checking");
    await renderWithTutorialRequested();
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pending.promise);
    await pullToRefresh();
    expect(spinners().length).toBeGreaterThan(0);

    setAppUpdatePhase("settled");
    await screen.rerender(<HomeScreen />);
    await flushAsync();
    await advance(1000);
    expect(lastTutorialProps().visible).toBe(false);

    await act(async () => {
      pending.resolve(homeSnapshot());
    });
    await flushAsync();
    await advance(180);
    expect(lastTutorialProps().visible).toBe(true);
  });

  it("[spec] 학습 가이드가 열려 있으면 띄우지 않고(기다리던 180ms도 취소), 닫으면 180ms 뒤에 띄운다", async () => {
    await renderWithTutorialRequested();
    await advance(100);
    await pressText("가이드 보기");

    await advance(1000);
    expect(lastTutorialProps().visible).toBe(false);

    await fireEvent.press(within(openModal()).getByText("닫기"));
    await advance(179);
    expect(lastTutorialProps().visible).toBe(false);
    await advance(1);
    expect(lastTutorialProps().visible).toBe(true);
  });

  it("[spec] 월 달력이 열려 있으면 띄우지 않고, 닫으면 180ms 뒤에 띄운다", async () => {
    await renderWithTutorialRequested();
    await openCalendar();

    await advance(1000);
    expect(lastTutorialProps().visible).toBe(false);

    await fireEvent.press(within(openModal()).getByText("닫기"));
    await advance(180);
    expect(lastTutorialProps().visible).toBe(true);
  });

  it("[spec] 다음을 누르면 단계가 넘어가며 애니메이션으로 스크롤하고, 마지막 단계의 시작하기를 누르면 완료를 저장하고 닫는다", async () => {
    await renderWithTutorialRequested();
    await advance(180);
    await advance(120);

    const steps: [string, string][] = [
      ["2/4 질문 답변", "질문을 따라 문장을 완성해요"],
      ["3/4 난이도별 질문", "내 수준에 맞게 골라요"],
      ["4/4 영어일기", "하루를 영어로 기록해요"]
    ];
    for (const [index, [eyebrow, title]] of steps.entries()) {
      await fireEvent.press(screen.getByRole("button", { name: "다음" }));
      await flushAsync();
      expect(lastTutorialProps()).toMatchObject({ visible: true, stepIndex: index + 1, spotlight: null, isPositioning: true });
      expect(scrollViewScrollTo).toHaveBeenLastCalledWith({ y: 156, animated: true });

      await advance(519);
      expect(lastTutorialProps().isPositioning).toBe(true);
      await advance(1);
      expect(lastTutorialProps()).toMatchObject({ stepIndex: index + 1, spotlight: SPOTLIGHT, isPositioning: false });
      expect(screen.getByText(eyebrow)).toBeOnTheScreen();
      expect(screen.getByText(title)).toBeOnTheScreen();
    }
    expect(screen.queryByRole("button", { name: "다음" })).toBeNull();
    expect(completeHomeTutorial).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "시작하기" }));
    await flushAsync();

    expect(completeHomeTutorial).toHaveBeenCalledTimes(1);
    expect(lastTutorialProps()).toMatchObject({ visible: false, spotlight: null, isPositioning: false });
    expect(modalHosts()).toHaveLength(0);
    expect(scrollViewScrollTo).toHaveBeenCalledTimes(4);

    await advance(2000);
    expect(lastTutorialProps().visible).toBe(false);
  });

  it("[spec] 건너뛰기를 누르면 완료를 저장하고 닫으며, 다시 띄우지 않는다", async () => {
    await renderWithTutorialRequested();
    await advance(180);
    await advance(120);

    await fireEvent.press(screen.getByRole("button", { name: SKIP_LABEL }));
    await flushAsync();

    expect(completeHomeTutorial).toHaveBeenCalledTimes(1);
    expect(lastTutorialProps()).toMatchObject({ visible: false, spotlight: null, isPositioning: false });
    expect(modalHosts()).toHaveLength(0);

    await advance(2000);
    expect(lastTutorialProps().visible).toBe(false);
  });

  it("[spec] 완료 저장이 실패해도 닫히고 오류가 드러나지 않는다", async () => {
    jest.mocked(completeHomeTutorial).mockRejectedValue(new Error("저장 실패"));
    await renderWithTutorialRequested();
    await advance(180);
    await advance(120);

    await fireEvent.press(screen.getByRole("button", { name: SKIP_LABEL }));
    await flushAsync();

    expect(lastTutorialProps().visible).toBe(false);
    expect(screen.queryByText("저장 실패")).toBeNull();
  });

  it("[spec] 대상 위치를 6번(100ms 간격) 재지 못하면 완료를 저장하지 않고 조용히 닫는다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    installMeasure(VIEWPORT_RECT, { x: 20, y: 300, width: 0, height: 180 });
    await renderLoaded();

    await advance(180);
    expect(lastTutorialProps()).toMatchObject({ visible: true, isPositioning: true });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await advance(100);
    }
    expect(lastTutorialProps()).toMatchObject({ visible: true, isPositioning: true, spotlight: null });

    await advance(100);

    expect(lastTutorialProps()).toMatchObject({ visible: false, isPositioning: false });
    expect(completeHomeTutorial).not.toHaveBeenCalled();
    expect(scrollViewScrollTo).not.toHaveBeenCalled();

    await advance(2000);
    expect(lastTutorialProps().visible).toBe(false);
  });
});

// ---------- 화면 구조 ----------
// 문구·구조·접근성 속성·스타일 값이 지금과 같은지 호스트 트리 스냅샷으로 기록한다(tests/app/__snapshots__).
// 이어 쓰기 줄의 저장 시각은 실행 환경의 ko-KR 시각 형식에 따라 달라서, 시각을 읽을 수 없는 이어 쓰기 상태로 찍는다.
// 튜토리얼(HomeFeatureTutorial)은 이번에 옮기지 않는 컴포넌트라 찍지 않는다.

describe("[spec] 화면 구조", () => {
  it("[spec] 세션 확인 중 화면", async () => {
    setSessionUser(null, true);
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 홈 데이터를 불러오는 중 화면", async () => {
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(new Promise(() => undefined));
    await renderScreen();

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 다 불러온 홈(이어 쓰기 줄, 해석 펼친 추천 질문, 알림 ON)", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("rewrite", { updatedAt: "" }));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft({ draftType: "REWRITE" }));
    await renderLoaded();
    await pressText("해석 보기");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 오류 화면(학습 일지·영어일기·추천 질문 오류, 지난달 일기 달력)", async () => {
    jest.mocked(getMobileHomeSnapshot).mockRejectedValue(new Error("스냅샷 실패"));
    jest.mocked(getTodayWritingStatus).mockRejectedValue(new Error("학습 일지 서버 오류"));
    jest.mocked(getDiaryCalendarSummary).mockRejectedValue(new Error("일기 서버 오류"));
    jest.mocked(getFeaturedDailyPrompt).mockRejectedValue(new Error("추천 서버 오류"));
    jest.mocked(getNowInEnglishSummary).mockResolvedValue(nowSummary({ todayCount: 0 }, false));
    await renderScreen();
    await pressText("<");

    expect(screenStructure()).toMatchSnapshot();
  });

  it("[spec] 월 달력 모달(점과 접근성 이름)", async () => {
    await renderLoaded();
    await openCalendar();

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 월 달력 모달(불러오는 중, 지난달)", async () => {
    await renderLoaded();
    await openCalendar();
    jest.mocked(getMonthWritingStatus).mockReturnValue(new Promise(() => undefined));
    await fireEvent.press(within(openModal()).getByText("<"));
    await flushAsync();

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 월 달력 모달(오류)", async () => {
    jest.mocked(getMonthWritingStatus).mockRejectedValue(new Error("달력 서버 오류"));
    await renderLoaded();
    await openCalendar();

    expect(structureOf(openModal())).toMatchSnapshot();
  });

  it("[spec] 학습 가이드 모달", async () => {
    await renderLoaded();
    await pressText("가이드 보기");

    expect(structureOf(openModal())).toMatchSnapshot();
  });
});
