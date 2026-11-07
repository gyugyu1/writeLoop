// [spec] qa 테스트(작업 060-03, 새 기능: 모바일 홈을 라룹이의 방(3D 로비)으로 바꾸기).
// 기대값은 시나리오(060-03의 02-qa-scenarios.md S1~S28)와 결정(03-main-decision.md: Q1 앱으로 돌아올 때도 다시 읽기 → S29,
// Q2 일기 판의 일기 연속 배지 → S30, Q4 로비 안내는 옛 튜토리얼과 같은 규칙과 버튼, Q5 장소 말풍선 버튼은 지금 엔진의 이름,
// Q6 개발 화면 칩은 고정 "연속 1일"), 09-main-decision.md(사용자 결정 3: S7은 출시 빌드에만 초당 프레임 표시가 없음,
// "확실 1" 처리: 화면 밖 장소를 짚어도 카드가 나옴 → S31, 3초 안에 장소 좌표가 없으면 저장하지 않고 닫음 → S32)에서만 가져온다. 구현 코드는 부르는 방법(속성 이름, 판의 구조)을 알려고만 읽었다.
// 이미 있는 홈 테스트(index.spec.test.tsx)가 판 안 칸의 세부 동작을 보므로, 여기서는 로비 자체와 판을 여닫는 길, 칩, 말풍선,
// 로비 안내, 앱 복귀를 본다.
// 가짜로 두는 것: index.spec.test.tsx와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스, 네이티브 모듈).
// 3D 그리기(lobby3d-canvas)는 Jest에서 돌지 않으므로 가짜로 바꾸고, 받은 속성(sim, viewWidth, toon, onFrame, onPointer, onProject)을
// 잡아 장소를 누르고 프레임을 진행한다. 가짜 시계: 2026-11-12T03:00:00Z = 서울 2026-11-12(목) 12:00.
// 060-10(③ 학습 상태에 따른 말과 동작)의 03-main-decision.md(사용자 결정 2026-11-07 "③ 명세대로 고치기")에 따라 S3, S22 a~g의 말풍선 글만
// 기본 말에서 들어올 때의 인사 말로 바꿨다(기본 데이터는 오늘 완료라 "오늘도 해냈어!", 이어 쓰기 상태가 있으면 이어 쓰기 인사). 나머지 확인은 그대로다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { type ComponentProps } from "react";
import { AppState } from "react-native";
import type { TestInstance } from "test-renderer";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import HomeScreen from "@/app/index";
import type HomeFeatureTutorial from "@/components/home-feature-tutorial";
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
import type { MarkId } from "@/lib/lobby3d/engine";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState, type PracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  DiaryCalendarDay,
  DiaryCalendarSummary,
  FeaturedDailyPromptRecommendation,
  MobileHomeSnapshot,
  Prompt,
  TodayWritingStatus,
  WritingDraft
} from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

type TutorialProps = ComponentProps<typeof HomeFeatureTutorial>;

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockTutorialProps: TutorialProps[] = [];
const mockCanvas: { props: Lobby3dCanvasProps | null; renders: number } = { props: null, renders: 0 };

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
      mockCanvas.renders += 1;
      return React.createElement("Lobby3dCanvasMock");
    }
  };
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
const SKIP_LABEL = "홈 사용법 건너뛰기";
// 들어올 때의 인사 말(060-10 명세 1의 표). 기본 데이터(오늘 완료)는 DONE_GREETING, 이어 쓰기 상태가 있으면 RESUME_GREETING.
const DONE_GREETING = "오늘도 해냈어!";
const RESUME_GREETING = "쓰다 만 답이 있어. 이어서 써 볼까?";
const TUTORIAL_LINES = [
  "여기서 오늘의 질문에 답해요",
  "영어일기는 이 책상에서 써요",
  "생각나는 대로 짧게 남길 땐 창가로 와요"
];
const OLD_TUTORIAL_TEXTS = [
  "1/4 지금 영어로",
  "떠오른 생각을 바로 영어로 바꿔 봐요",
  "2/4 질문 답변",
  "3/4 난이도별 질문",
  "4/4 영어일기"
];
const SHEET_TITLES = { question: "질문에 답하기", diary: "영어일기", thought: "지금 생각나는대로" } as const;
type SheetKind = keyof typeof SHEET_TITLES;

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

function nowSummary(): NowInEnglishSummary {
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

const SAVED_AT = new Date(2026, 10, 12, 9, 5).toISOString();

function loop(step: IncompleteLoopState["step"], overrides: Partial<IncompleteLoopState> = {}): IncompleteLoopState {
  return {
    promptId: "prompt-loop",
    difficulty: "A",
    step,
    updatedAt: SAVED_AT,
    promptSnapshot: { topic: "Morning", questionEn: "What do you usually do in the morning?", questionKo: "아침에 보통 무엇을 하나요?" },
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
    difficulty: "B",
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

// 로비 안내가 짚을 장소 이름표 좌표(테스트 창 750 x 1334 안에서 서로 멀리 떨어뜨림).
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

async function renderHome() {
  const view = await render(<HomeScreen />);
  await flushAsync();
  return view;
}

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

function findHost(root: TestInstance, type: string) {
  return root.queryAll((instance) => instance.type === type);
}

function canvases() {
  return findHost(screen.root!, "Lobby3dCanvasMock");
}

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function sheetIfOpen(kind: SheetKind): TestInstance | null {
  const sheets = findHost(screen.root!, "Modal").filter(
    (modal) =>
      modal.props.animationType === "slide" &&
      within(modal).queryAllByRole("header", { name: SHEET_TITLES[kind] }).length > 0
  );
  expect(sheets.length).toBeLessThanOrEqual(1);
  return sheets[0] ?? null;
}

function openSheets() {
  return (Object.keys(SHEET_TITLES) as SheetKind[]).filter((kind) => sheetIfOpen(kind) !== null);
}

function sheet(kind: SheetKind) {
  const found = sheetIfOpen(kind);
  expect(found).not.toBeNull();
  return found!;
}

async function pressMenu(kind: SheetKind) {
  await fireEvent.press(screen.getByRole("button", { name: SHEET_TITLES[kind] }));
  await flushAsync();
}

async function openSheet(kind: SheetKind) {
  await pressMenu(kind);
  return sheet(kind);
}

async function closeSheetWithButton(kind: SheetKind) {
  await fireEvent.press(within(sheet(kind)).getByRole("button", { name: "닫기" }));
  await flushAsync();
}

function position() {
  const sim = canvas().sim;
  return { x: sim.x, z: sim.z };
}

async function frames(count: number) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      canvas().onFrame(0.05, Date.now());
    });
  }
}

// 장소를 톡 누른다(같은 자리에서 바로 뗌).
async function tapMark(mark: MarkId) {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", { point: null, mark, onCharacter: false }, 200, 300);
  });
}

async function walkUntilArrived(mark: MarkId) {
  for (let index = 0; index < 400 && canvas().sim.arrived !== mark; index += 1) {
    await frames(1);
  }
  await frames(5);
  expect(canvas().sim.arrived).toBe(mark);
}

async function sendProjection(labels: LobbyProjection["labels"] = LABELS) {
  await act(async () => {
    canvas().onProject({ bubble: { x: 375, y: 600 }, labels, fps: 60 });
  });
  await flushAsync();
}

function lastTutorialProps() {
  return mockTutorialProps.at(-1)!;
}

function spotlightContains(spot: { x: number; y: number; width: number; height: number }, point: { x: number; y: number }) {
  return point.x >= spot.x && point.x <= spot.x + spot.width && point.y >= spot.y && point.y <= spot.y + spot.height;
}

function bubbleOfResumeGreeting() {
  // 말풍선 글의 부모(말풍선 판)
  return screen.getByText(RESUME_GREETING).parent!;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockTutorialProps.length = 0;
  mockCanvas.props = null;
  mockCanvas.renders = 0;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.back).mockReset();
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue(diarySummary());
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
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  jest.useRealTimers();
});

// ---------- 화면 구성 ----------

describe("[spec] 화면 구성(S1~S4)", () => {
  it("S1: 세션 확인 중에는 불러오는 중 표시만 보이고, 3D·메뉴·내비게이션 바가 없고 홈 데이터를 부르지 않는다", async () => {
    setSessionUser(null, true);
    await renderHome();

    const indicators = findHost(screen.root!, "ActivityIndicator");
    expect(indicators).toHaveLength(1);
    expect(indicators[0].props.color).toBe("#E38B12");
    expect(canvases()).toHaveLength(0);
    for (const label of ["질문에 답하기", "영어일기", "지금 생각나는대로", "홈", "기록", "내정보"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(getMobileHomeSnapshot).not.toHaveBeenCalled();
  });

  it("S2: 로그인 전이면 /login으로 보내고 3D를 그리지 않으며 홈 데이터를 부르지 않는다", async () => {
    setSessionUser(null);
    await renderHome();

    const redirects = findHost(screen.container, "Redirect");
    expect(redirects).toHaveLength(1);
    expect(redirects[0].props.href).toBe("/login");
    expect(canvases()).toHaveLength(0);
    expect(getMobileHomeSnapshot).not.toHaveBeenCalled();
  });

  it("S3: 로그인한 사용자의 홈은 3D 로비다(이름표 4개, 말풍선, 메뉴 3개, 카메라 거리 버튼, 내비게이션 바)", async () => {
    await renderHome();

    expect(canvases()).toHaveLength(1);
    for (const label of ["오늘의 질문", "생각 창가", "일기 책상", "밖으로"]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    expect(screen.getByText(DONE_GREETING)).toBeOnTheScreen();
    for (const menu of ["질문에 답하기", "영어일기", "지금 생각나는대로"]) {
      expect(screen.getByRole("button", { name: menu })).toBeOnTheScreen();
    }
    expect(screen.getByRole("button", { name: "카메라 거리 설정" })).toBeOnTheScreen();
    for (const tab of ["홈", "기록", "내정보"]) {
      expect(screen.getByText(tab)).toBeOnTheScreen();
    }
  });

  it("S4: 내비게이션 바는 홈 탭이 켜져 있어 홈은 아무 데도 가지 않고, 기록·내정보는 그 화면으로 바꾼다", async () => {
    await renderHome();

    await fireEvent.press(screen.getByText("홈"));
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("기록"));
    expect(router.replace).toHaveBeenLastCalledWith("/records");
    await fireEvent.press(screen.getByText("내정보"));
    expect(router.replace).toHaveBeenLastCalledWith("/me");
    expect(router.replace).toHaveBeenCalledTimes(2);
  });
});

// ---------- 연속 칩 ----------

describe("[spec] 연속 칩(S5, S6)", () => {
  const cases: [string, Partial<TodayWritingStatus>, string][] = [
    ["a", { streakDays: 2, completed: true }, "연속 2일"],
    ["b", { streakDays: 0, completed: true }, "연속 1일"],
    ["c", { streakDays: 0, completed: false }, "작문 대기 중"],
    ["d", { streakDays: 3, completed: false }, "연속 3일"]
  ];
  it.each(cases)("S5 %s: 오늘 상태 %j → 칩 '%s'", async (_name, status, label) => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot({ todayStatus: todayStatus(status) }));
    await renderHome();

    expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it("S5 e: 스냅샷이 빈 값이면 '작문 대기 중'", async () => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue({});
    await renderHome();

    expect(screen.getByText("작문 대기 중")).toBeOnTheScreen();
  });

  it("S5 f: 스냅샷을 기다리는 동안 '작문 대기 중', 받은 뒤 '연속 2일'", async () => {
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockReturnValue(pending.promise);
    await renderHome();
    expect(screen.getByText("작문 대기 중")).toBeOnTheScreen();

    await act(async () => {
      pending.resolve(homeSnapshot());
    });
    await flushAsync();

    expect(screen.getByText("연속 2일")).toBeOnTheScreen();
    expect(screen.queryByText("작문 대기 중")).toBeNull();
  });

  it("S5 g: 스냅샷이 실패해 하나씩 부른 오늘 상태가 연속 5일이면 '연속 5일'", async () => {
    jest.mocked(getMobileHomeSnapshot).mockRejectedValue(new Error("스냅샷 실패"));
    jest.mocked(getTodayWritingStatus).mockResolvedValue(todayStatus({ streakDays: 5 }));
    await renderHome();

    expect(screen.getByText("연속 5일")).toBeOnTheScreen();
  });

  it("S6: 칩을 누르면 기록 화면으로 간다", async () => {
    await renderHome();

    await fireEvent.press(screen.getByText("연속 2일"));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/records");
  });
});

// ---------- 시험판 ----------

describe("[spec] 시험판(S7, S8)", () => {
  const PANEL_TEXTS = ["시험판 펴기", "시험판 접기", "손 흔들기", "신나게 점프", "깡충깡충", "가리키기", "한 바퀴", "두리번", "명암 단계", "2단", "3단"];
  const PANEL_SLIDERS = ["걷는 속도", "돌아서는 빠르기", "외곽선 굵기"];

  // 09 결정(사용자 결정 2·3): 초당 프레임·동작 표시는 출시 빌드의 홈에는 없고 개발 빌드의 홈에는 보인다.
  // 시험판이 없고 명암 3단·외곽선 1배인 것은 두 경우 모두 그대로다.
  function expectNoDevPanelAndHomeToon() {
    for (const text of PANEL_TEXTS) {
      expect(screen.queryByText(text)).toBeNull();
    }
    for (const name of PANEL_SLIDERS) {
      expect(screen.queryByRole("adjustable", { name })).toBeNull();
    }
    expect(canvas().toon).toEqual({ steps: 3, outline: 1 });
  }

  it("S7 출시 빌드: 홈에는 시험판·초당 프레임·동작 표시가 없고, 명암 3단·외곽선 1배로 그린다", async () => {
    devGlobal.__DEV__ = false;
    await renderHome();

    expect(screen.queryByText(/^FPS/)).toBeNull();
    expect(screen.queryByText(/^동작:/)).toBeNull();
    expectNoDevPanelAndHomeToon();
  });

  it("S7 개발 빌드: 홈에 초당 프레임·동작 표시는 보이고, 시험판은 없으며 명암 3단·외곽선 1배로 그린다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome();

    expect(screen.getByText(/^FPS/)).toBeOnTheScreen();
    expect(screen.getByText(/^동작:/)).toBeOnTheScreen();
    expectNoDevPanelAndHomeToon();
  });

  it("S8: 개발 진입 화면은 지금처럼 시험판을 보이고(칩은 고정 '연속 1일'), 명암을 바꾸면 3D에 넘어간다", async () => {
    devGlobal.__DEV__ = true;
    await render(<DevLobby3dRoute />);
    await flushAsync();

    expect(screen.getByText("연속 1일")).toBeOnTheScreen();
    expect(screen.getByText("시험판 펴기")).toBeOnTheScreen();
    expect(screen.getByText(/^FPS/)).toBeOnTheScreen();
    expect(screen.getByText(/^동작:/)).toBeOnTheScreen();
    expect(canvas().toon).toEqual({ steps: 3, outline: 1 });

    await fireEvent.press(screen.getByText("시험판 펴기"));

    for (const action of ["손 흔들기", "신나게 점프", "깡충깡충", "가리키기", "한 바퀴", "두리번"]) {
      expect(screen.getByRole("button", { name: action })).toBeOnTheScreen();
    }
    for (const name of PANEL_SLIDERS) {
      expect(screen.getByRole("adjustable", { name })).toBeOnTheScreen();
    }
    expect(screen.getByText("2단")).toBeOnTheScreen();
    expect(screen.getByText("3단")).toBeOnTheScreen();
    expect(screen.getByText("시험판 접기")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("2단"));
    expect(canvas().toon.steps).toBe(2);
  });
});

// ---------- 카메라 거리 ----------

describe("[spec] 카메라 거리(S9)", () => {
  async function nudge(action: "increment" | "decrement", times: number) {
    for (let index = 0; index < times; index += 1) {
      await fireEvent(screen.getByRole("adjustable", { name: "카메라 거리" }), "accessibilityAction", {
        nativeEvent: { actionName: action }
      });
    }
  }

  it("S9: 홈에서 바꾼 카메라 거리는 다시 들어와도 유지되고, 기본값을 누르면 다시 들어와도 기본값이다", async () => {
    const first = await renderHome();
    const defaultWidth = canvas().viewWidth;

    await fireEvent.press(screen.getByRole("button", { name: "카메라 거리 설정" }));
    await nudge("increment", 5);
    const changedWidth = canvas().viewWidth;
    expect(changedWidth).not.toBe(defaultWidth);
    await act(async () => {
      first.unmount();
    });
    await flushAsync();

    const second = await renderHome();
    expect(canvas().viewWidth).toBe(changedWidth);
    await fireEvent.press(screen.getByRole("button", { name: "카메라 거리 설정" }));
    await fireEvent.press(screen.getByRole("button", { name: "기본값" }));
    expect(canvas().viewWidth).toBe(defaultWidth);
    await act(async () => {
      second.unmount();
    });
    await flushAsync();

    await renderHome();
    expect(canvas().viewWidth).toBe(defaultWidth);
  });
});

// ---------- 메뉴와 장소 ----------

describe("[spec] 메뉴와 장소(S10~S14)", () => {
  const MENU_CASES: [string, SheetKind, string][] = [
    ["S10", "question", "오늘의 추천 질문"],
    ["S11", "diary", "전체 보기"],
    ["S12", "thought", "지금 쓰기"]
  ];

  it.each(MENU_CASES)("%s: 메뉴 '%s'는 걸어가지 않고 바로 그 판을 연다", async (_name, kind, contentText) => {
    await renderHome();
    const before = position();

    await pressMenu(kind);
    await frames(20);

    expect(openSheets()).toEqual([kind]);
    expect(within(sheet(kind)).getByText(contentText)).toBeOnTheScreen();
    expect(position()).toEqual(before);
    expect(canvas().sim.arrived).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  const MARK_CASES: [string, MarkId, SheetKind][] = [
    ["S13 a", "board", "question"],
    ["S13 b", "desk", "diary"],
    ["S13 c", "window", "thought"]
  ];

  it.each(MARK_CASES)("%s: 장소 %s를 누르면 걸어가 도착하고, 말풍선의 '들어가기'가 그 판을 연다", async (_name, mark, kind) => {
    await renderHome();
    const before = position();

    await tapMark(mark);
    await frames(5);
    expect(position()).not.toEqual(before);
    await walkUntilArrived(mark);
    expect(openSheets()).toEqual([]);

    await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
    await flushAsync();

    expect(openSheets()).toEqual([kind]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("S14: 문(밖으로)에 도착해 '나가기'를 누르면 지금 시험판의 안내만 뜨고 판이 열리지 않는다", async () => {
    await renderHome();

    await tapMark("door");
    await walkUntilArrived("door");
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await flushAsync();

    // 안내는 role alert인 짧은 알림(지금 시험판과 같음)
    const toast = screen.getByText("마을은 다음 업데이트에서 열려요");
    expect(toast.parent!.props.accessibilityRole).toBe("alert");
    expect(openSheets()).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
  });
});

// ---------- 판의 내용 ----------

describe("[spec] 판의 내용(S15~S18, S30)", () => {
  it("S15: 질문 판에 학습 일지 카드·오늘의 추천 질문·난이도 고르기가 있다", async () => {
    await renderHome();

    const question = await openSheet("question");
    for (const text of [
      "학습 일지",
      "작문 2일 연속",
      "일기 3일 연속",
      "총 1,234문항 작성 · 총 12개의 일기 작성",
      "총 4개의 영어조각",
      "오늘의 추천 질문",
      featuredPrompt.questionEn,
      "요즘 여행 이야기를 자주 썼어요.",
      "Travel",
      "해석 보기",
      "난이도별 질문",
      "내 수준에 맞게 골라 보세요.",
      "짧은 한두 문장으로 가볍게 시작해 보세요.",
      "쉬운 문장으로 부담 없이 이어가 보세요.",
      "이유와 예시를 붙여 답을 넓혀 보세요.",
      "비교와 전환 표현으로 더 탄탄하게 써 보세요."
    ]) {
      expect(within(question).getByText(text)).toBeOnTheScreen();
    }
    // "보통"은 추천 질문 배지와 난이도 카드에 하나씩
    expect(within(question).getAllByText("보통")).toHaveLength(2);
    const images = findHost(question, "Image");
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual(require("@/assets/images/streak-mascot/streak-default.png"));
    for (const day of ["금", "토", "일", "월", "화", "수", "목"]) {
      expect(within(question).getByText(day)).toBeOnTheScreen();
    }
  });

  it("S16: 이어 쓰기 상태가 있어도 질문 판에는 이어 쓰기 줄이 없다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderHome();
    expect(screen.getByRole("button", { name: "이어 쓰기" })).toBeOnTheScreen();

    const question = await openSheet("question");
    for (const text of ["이어서 쓰기 >", "다시 쓰기 >", "피드백 이어보기 >"]) {
      expect(within(question).queryByText(text)).toBeNull();
    }
    expect(within(question).queryByText(/^쓰던 답안이 있어요/)).toBeNull();
  });

  it("S17: 일기 판에 영어일기 칸(전체 보기, 이번 달 달력 35칸, 오늘 일기 이어보기)이 있다", async () => {
    await renderHome();

    const diary = await openSheet("diary");
    expect(within(diary).getByText("전체 보기")).toBeOnTheScreen();
    expect(within(diary).getByText("2026년 11월")).toBeOnTheScreen();
    expect(within(diary).getByText(">")).toBeDisabled();
    expect(within(diary).getByText("<")).toBeOnTheScreen();
    const cells = within(diary).getAllByRole("button", { name: /영어일기 보기$/ });
    expect(cells).toHaveLength(35);
    expect(cells[0]).toHaveAccessibleName("2026-11-01 영어일기 보기");
    expect(cells[34]).toHaveAccessibleName("2026-12-05 영어일기 보기");
    expect(within(diary).getByText("오늘 일기 이어보기")).toBeOnTheScreen();
  });

  it("S18: 생각 판에 지금 영어로 칸이 있고, 알림·지금 쓰기·기록 보기가 지금 홈과 같은 곳으로 간다", async () => {
    await renderHome();

    const thought = await openSheet("thought");
    expect(within(thought).getByText("지금 영어로")).toBeOnTheScreen();
    expect(within(thought).getByText("지금 뭐하고 있나요?, 무슨 생각하고 있나요?")).toBeOnTheScreen();
    expect(within(thought).getByText("오늘 남긴 조각").parent!.children[0]).toHaveTextContent("1");
    const reminder = within(thought).getByRole("button", { name: "루프 알림 설정 열기" });
    expect(within(reminder).getByText("ON")).toBeOnTheScreen();

    await fireEvent.press(reminder);
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/now", params: { reminder: "open" } });
    await fireEvent.press(within(sheetIfOpen("thought") ?? (await openSheet("thought"))).getByText("지금 쓰기"));
    expect(router.push).toHaveBeenLastCalledWith("/now");
    await fireEvent.press(within(sheetIfOpen("thought") ?? (await openSheet("thought"))).getByText("기록 보기"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/records", params: { tab: "now" } });
    expect(router.push).toHaveBeenCalledTimes(3);
  });

  const DIARY_BADGE_CASES: [string, MobileHomeSnapshot, string][] = [
    ["오늘까지 3일", homeSnapshot(), "일기 3일 연속"],
    ["오늘 없이 어제부터 2일", homeSnapshot({ diaryCalendarSummary: diarySummary(DIARY_DAYS.slice(1)) }), "일기 2일 연속"],
    ["일기 없음", homeSnapshot({ diaryCalendarSummary: diarySummary([], 0) }), "일기 대기 중"]
  ];

  it.each(DIARY_BADGE_CASES)("S30: 일기 판 위에 학습 일지 카드와 같은 일기 연속 배지가 있다(%s)", async (_name, snapshot, label) => {
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(snapshot);
    await renderHome();

    expect(within(await openSheet("diary")).getByText(label)).toBeOnTheScreen();
    await closeSheetWithButton("diary");
    // 학습 일지 카드(질문 판)의 배지도 그대로 있다.
    expect(within(await openSheet("question")).getByText(label)).toBeOnTheScreen();
  });
});

// ---------- 판 여닫기 ----------

describe("[spec] 판 여닫기(S19~S21)", () => {
  const KINDS: SheetKind[] = ["question", "diary", "thought"];

  it.each(KINDS)("S19: %s 판은 닫기 버튼, 뒤로가기, 바깥 누르기로 닫히고 다른 화면으로 가지 않는다", async (kind) => {
    await renderHome();

    await openSheet(kind);
    await closeSheetWithButton(kind);
    expect(openSheets()).toEqual([]);

    await openSheet(kind);
    await fireEvent(sheet(kind), "requestClose");
    await flushAsync();
    expect(openSheets()).toEqual([]);

    await openSheet(kind);
    // 바깥 판은 접근성 트리에서 판에 가려지지만 손가락으로는 누를 수 있다.
    await fireEvent.press(within(sheet(kind)).getByLabelText(`${SHEET_TITLES[kind]} 닫기`, { includeHiddenElements: true }));
    await flushAsync();
    expect(openSheets()).toEqual([]);

    for (const menu of Object.values(SHEET_TITLES)) {
      expect(screen.getByRole("button", { name: menu })).toBeOnTheScreen();
    }
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("S20: 판을 연 동안에도 3D는 내려가지 않고 같은 로비(sim)를 그린다", async () => {
    await renderHome();
    const simBefore = canvas().sim;

    await openSheet("question");
    await frames(3);

    expect(canvases()).toHaveLength(1);
    expect(canvas().sim).toBe(simBefore);
  });

  it("S21: 판을 연 동안 장소를 눌러도 라룹이가 움직이지 않고 다른 판이 열리지 않는다", async () => {
    await renderHome();
    await openSheet("question");
    const before = position();

    await tapMark("desk");
    await frames(40);

    expect(position()).toEqual(before);
    expect(canvas().sim.arrived).toBeNull();
    expect(openSheets()).toEqual(["question"]);
  });
});

// ---------- 이어 쓰기 말풍선 ----------

describe("[spec] 이어 쓰기 말풍선(S22)", () => {
  it("S22 a: 이어 쓰기 상태가 없으면 인사 말풍선에 이어 쓰기 버튼이 없다", async () => {
    await renderHome();

    expect(screen.getByText(DONE_GREETING)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "이어 쓰기" })).toBeNull();
  });

  const ROUTE_CASES: [string, () => void, object][] = [
    [
      "b 피드백 단계(저장된 피드백 있음)",
      () => {
        jest.mocked(getIncompleteLoop).mockResolvedValue(loop("feedback", { difficulty: "B" }));
        jest.mocked(hydratePracticeFeedbackState).mockResolvedValue(feedbackState());
      },
      { pathname: "/practice/feedback", params: { difficulty: "B", promptId: "prompt-loop" } }
    ],
    [
      "c 답 단계(서버 초안만)",
      () => {
        jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
        jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
      },
      { pathname: "/practice/write", params: { difficulty: "A", promptId: "prompt-loop" } }
    ],
    [
      "d 다시 쓰기 단계(이 기기 초안만)",
      () => {
        jest.mocked(getIncompleteLoop).mockResolvedValue(loop("rewrite"));
        jest.mocked(getLocalWritingDraft).mockResolvedValue(writingDraft({ draftType: "REWRITE" }));
      },
      { pathname: "/practice/write", params: { difficulty: "A", promptId: "prompt-loop", mode: "rewrite", resume: "1" } }
    ],
    [
      "g 답 단계(서버 초안 확인 실패)",
      () => {
        jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
        jest.mocked(getWritingDraft).mockRejectedValue(new Error("네트워크 오류"));
      },
      { pathname: "/practice/write", params: { difficulty: "A", promptId: "prompt-loop" } }
    ]
  ];

  it.each(ROUTE_CASES)("S22 %s: 이어 쓰기 인사 말풍선에 이어 쓰기 버튼이 붙고, 누르면 이어 쓰던 곳으로 간다", async (_name, arrange, route) => {
    arrange();
    await renderHome();

    const button = screen.getByRole("button", { name: "이어 쓰기" });
    expect(within(bubbleOfResumeGreeting()).getByRole("button", { name: "이어 쓰기" })).toBe(button);
    expect(clearIncompleteLoop).not.toHaveBeenCalled();

    await fireEvent.press(button);

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(route);
  });

  it("S22 e: 피드백 단계인데 저장된 피드백이 없으면 이어 쓰기 상태를 지우고 버튼이 없다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("feedback"));
    await renderHome();
    expect(clearIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "이어 쓰기" })).toBeNull();
    expect(screen.getByText(DONE_GREETING)).toBeOnTheScreen();
  });

  it("S22 f: 답 단계인데 이 기기와 서버에 초안이 없으면 이어 쓰기 상태를 지우고 버튼이 없다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    await renderHome();
    expect(clearIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "이어 쓰기" })).toBeNull();
    expect(screen.getByText(DONE_GREETING)).toBeOnTheScreen();
  });

  it("S22 h: 들어온 뒤 이어 쓰기 상태가 없어지고 포커스를 다시 받으면 버튼이 사라진다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop("answer"));
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderHome();
    expect(screen.getByRole("button", { name: "이어 쓰기" })).toBeOnTheScreen();

    jest.mocked(getIncompleteLoop).mockResolvedValue(null);
    await setFocused(false);
    await setFocused(true);

    expect(screen.queryByRole("button", { name: "이어 쓰기" })).toBeNull();
  });
});

// ---------- 홈에서 뺀 것 ----------

describe("[spec] 홈에서 뺀 것(S23)", () => {
  function expectRemovedAbsent() {
    expect(screen.queryByRole("button", { name: "라이트루프에 의견 보내기" })).toBeNull();
    expect(screen.queryByText("의견 보내기")).toBeNull();
    expect(screen.queryByText("가이드 보기")).toBeNull();
    expect(screen.root!.queryAll((instance) => instance.props.refreshControl !== undefined)).toHaveLength(0);
  }

  it("S23: 로비와 세 판 어디에도 의견 보내기·가이드 보기·당겨서 새로 고침이 없다", async () => {
    await renderHome();
    expectRemovedAbsent();

    for (const kind of ["question", "diary", "thought"] as SheetKind[]) {
      await openSheet(kind);
      expectRemovedAbsent();
      await closeSheetWithButton(kind);
    }
  });
});

// ---------- 로비 안내 ----------

describe("[spec] 로비 안내(S25~S28, S31, S32)", () => {
  it("S25·S28: 처음이면 질문 게시판 → 일기 책상 → 생각 창가를 한 줄씩 짚고, 끝내면 완료를 저장하고 다시 뜨지 않는다. 옛 튜토리얼 문구는 나오지 않는다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    await renderHome();
    await sendProjection();
    await advance(180);

    const targets: MarkId[] = ["board", "desk", "window"];
    for (const [index, line] of TUTORIAL_LINES.entries()) {
      expect(screen.getByText(line)).toBeOnTheScreen();
      for (const other of TUTORIAL_LINES.filter((text) => text !== line)) {
        expect(screen.queryByText(other)).toBeNull();
      }
      const spot = lastTutorialProps().spotlight;
      expect(spot).not.toBeNull();
      expect(spotlightContains(spot!, LABELS[targets[index]])).toBe(true);
      for (const other of targets.filter((mark) => mark !== targets[index])) {
        expect(spotlightContains(spot!, LABELS[other])).toBe(false);
      }
      for (const old of OLD_TUTORIAL_TEXTS) {
        expect(screen.queryByText(old)).toBeNull();
      }
      expect(completeHomeTutorial).not.toHaveBeenCalled();
      const isLast = index === TUTORIAL_LINES.length - 1;
      expect(screen.getByRole("button", { name: SKIP_LABEL })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole("button", { name: isLast ? "시작하기" : "다음" }));
      await flushAsync();
    }

    expect(completeHomeTutorial).toHaveBeenCalledTimes(1);
    expect(lastTutorialProps().visible).toBe(false);
    await advance(2000);
    for (const line of TUTORIAL_LINES) {
      expect(screen.queryByText(line)).toBeNull();
    }
    expect(completeHomeTutorial).toHaveBeenCalledTimes(1);
  });

  it("S26: 이미 본 사용자에게는 뜨지 않는다", async () => {
    await renderHome();
    await sendProjection();
    await advance(2000);

    for (const line of TUTORIAL_LINES) {
      expect(screen.queryByText(line)).toBeNull();
    }
    expect(completeHomeTutorial).not.toHaveBeenCalled();
  });

  it("S27: 다시 보기 요청이 있으면 본 사용자에게도 뜨고, 완료 여부는 읽지 않는다", async () => {
    jest.mocked(consumeHomeTutorialReplay).mockResolvedValue(true);
    await renderHome();
    await sendProjection();
    await advance(180);

    expect(screen.getByText(TUTORIAL_LINES[0])).toBeOnTheScreen();
    expect(hasCompletedHomeTutorial).not.toHaveBeenCalled();
  });

  // 09 결정 "확실 1" 처리: 짚는 영역을 화면 안으로 끌어오고, 3D가 장소 좌표를 3초 안에 보내지 않으면 옛 튜토리얼처럼
  // 저장하지 않고 닫는다. 테스트 창은 750 x 1334다.
  const WINDOW = { width: 750, height: 1334 };
  // 카메라를 가깝게 해 장소 이름표가 화면 밖에 온 경우(게시판·책상은 왼쪽 밖, 창가는 오른쪽 밖)
  const OFFSCREEN_LABELS: LobbyProjection["labels"] = {
    board: { x: -39, y: 260 },
    window: { x: 900, y: 260 },
    desk: { x: -102, y: 900 },
    door: { x: 1000, y: 300 }
  };

  it("S31: 짚을 장소가 화면 밖이어도 단계마다 카드와 다음·건너뛰기가 나오고, 짚는 영역은 화면 안에 있으며, 끝까지 넘기면 완료를 저장한다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    await renderHome();
    await sendProjection(OFFSCREEN_LABELS);
    await advance(180);

    for (const [index, line] of TUTORIAL_LINES.entries()) {
      expect(screen.getByText(line)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: SKIP_LABEL })).toBeOnTheScreen();
      const isLast = index === TUTORIAL_LINES.length - 1;
      expect(screen.getByRole("button", { name: isLast ? "시작하기" : "다음" })).toBeOnTheScreen();
      const props = lastTutorialProps();
      expect(props).toMatchObject({ visible: true, stepIndex: index, isPositioning: false });
      const spot = props.spotlight;
      expect(spot).not.toBeNull();
      expect(spot!.width).toBeGreaterThan(0);
      expect(spot!.height).toBeGreaterThan(0);
      expect(spot!.x).toBeGreaterThanOrEqual(0);
      expect(spot!.y).toBeGreaterThanOrEqual(0);
      expect(spot!.x + spot!.width).toBeLessThanOrEqual(WINDOW.width);
      expect(spot!.y + spot!.height).toBeLessThanOrEqual(WINDOW.height);
      await fireEvent.press(screen.getByRole("button", { name: isLast ? "시작하기" : "다음" }));
      await flushAsync();
    }

    expect(completeHomeTutorial).toHaveBeenCalledTimes(1);
    expect(lastTutorialProps().visible).toBe(false);
  });

  it("S31: 짚을 장소가 화면 밖인 단계에서도 건너뛰기로 닫히고 완료를 저장한다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    await renderHome();
    await sendProjection(OFFSCREEN_LABELS);
    await advance(180);
    await fireEvent.press(screen.getByRole("button", { name: "다음" }));
    await flushAsync();
    expect(screen.getByText(TUTORIAL_LINES[1])).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: SKIP_LABEL }));
    await flushAsync();

    expect(completeHomeTutorial).toHaveBeenCalledTimes(1);
    expect(lastTutorialProps().visible).toBe(false);
    expect(screen.queryByText(TUTORIAL_LINES[1])).toBeNull();
  });

  it("S32: 3D가 장소 좌표를 보내지 않으면 안내가 뜬 뒤 3초 동안 기다리다가, 저장하지 않고 조용히 닫고 다시 띄우지 않는다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    await renderHome();

    await advance(180);
    expect(lastTutorialProps()).toMatchObject({ visible: true, isPositioning: true, spotlight: null });

    await advance(2900);
    expect(lastTutorialProps()).toMatchObject({ visible: true, isPositioning: true, spotlight: null });

    await advance(200);
    expect(lastTutorialProps()).toMatchObject({ visible: false, isPositioning: false });
    expect(completeHomeTutorial).not.toHaveBeenCalled();
    for (const line of TUTORIAL_LINES) {
      expect(screen.queryByText(line)).toBeNull();
    }
    // 닫힌 뒤에는 홈을 쓸 수 있다(안내 Modal이 남지 않음).
    expect(findHost(screen.root!, "Modal")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeOnTheScreen();

    await advance(2000);
    expect(lastTutorialProps().visible).toBe(false);
    expect(completeHomeTutorial).not.toHaveBeenCalled();
  });

  it("S32: 3초 안에 장소 좌표가 오면 닫지 않고 카드를 보인다", async () => {
    jest.mocked(hasCompletedHomeTutorial).mockResolvedValue(false);
    await renderHome();
    await advance(180);
    expect(lastTutorialProps()).toMatchObject({ visible: true, isPositioning: true });

    await advance(1000);
    await sendProjection();
    expect(screen.getByText(TUTORIAL_LINES[0])).toBeOnTheScreen();

    await advance(3000);
    expect(lastTutorialProps()).toMatchObject({ visible: true, stepIndex: 0, isPositioning: false });
    expect(screen.getByText(TUTORIAL_LINES[0])).toBeOnTheScreen();
    expect(completeHomeTutorial).not.toHaveBeenCalled();
  });
});


// ---------- 앱으로 돌아올 때 ----------

describe("[spec] 앱으로 돌아올 때 다시 읽기(S29, 결정 Q1)", () => {
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

  it("S29: 배경으로 갔다가 다시 앞으로 오면 포커스 때처럼 이어 쓰기·일기 달력·지금 영어로·스냅샷을 다시 읽는다(배경으로 가기만 해서는 읽지 않는다)", async () => {
    const callIndex = jest.mocked(AppState.addEventListener).mock.calls.length;
    await renderHome();
    const listeners = appStateListenersSince(callIndex);
    expect(listeners.length).toBeGreaterThan(0);
    expect(getIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(0);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);

    await sendAppState(listeners, "background");
    expect(getIncompleteLoop).toHaveBeenCalledTimes(1);
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(0);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(1);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(1);

    await sendAppState(listeners, "active");
    expect(getIncompleteLoop).toHaveBeenCalledTimes(2);
    expect(getDiaryCalendarSummary).toHaveBeenCalledTimes(1);
    expect(getNowInEnglishSummary).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenCalledTimes(2);
    expect(getMobileHomeSnapshot).toHaveBeenLastCalledWith("I");
  });
});
