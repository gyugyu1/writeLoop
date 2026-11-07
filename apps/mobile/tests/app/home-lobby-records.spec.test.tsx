// [spec] qa 테스트(작업 062, 기능 변경: 모바일 홈 로비의 책장 '들어가기'와 아래 메뉴 '학습 기록'이 기록 화면으로 감).
// 기대값은 명세(private 작업 폴더 062-2026-11-08-모바일-로비-책장-학습기록/01-main-spec.md 3)에서만 가져온다.
// 구현 코드는 부르는 방법(홈 화면, 3D 그리기에 넘기는 sim·onFrame·onPointer, 판의 구조)을 알려고만 읽었다.
// 가짜로 두는 것은 home-lobby.spec.test.tsx와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스, 3D 그리기).
// - 바뀔 동작(고치기 전에는 실패해야 한다): H1, H2.
// 기록 화면으로 가는 방법(push·replace·navigate)은 명세에 없어 셋 다 모으고, 간 곳이 "/records" 한 번인지만 본다
// (지금 연속 기록 칩은 push("/records"), 아래 탭바 "기록"은 replace("/records")).
// 로그인하지 않았을 때 로그인으로 가는 것은 홈이 로그인 전에는 로비를 그리지 않고 /login으로 보내므로(home-lobby S2) 화면에서 볼 수 없다(02-qa-tests.md).
// 작업 063 03 결정 1(사용자 2026-11-08 "고치기"): H2의 '들어가기' 뒤 확인을 동작(약 1초)이 끝난 뒤로 옮겼다(waitEnterMotion). 단언은 그대로다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import type { TestInstance } from "test-renderer";
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
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { MARKS, type MarkId, type MarkInfo } from "@/lib/lobby3d/engine";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot, TodayWritingStatus } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
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

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";
const BOOK_LABEL = "학습 기록";
const BOOK_PROMPT = "지금까지 쓴 기록이 모여 있어.\n기록을 볼까?";
const BOOK_BUTTON = "들어가기";
const SHEET_TITLES = ["질문에 답하기", "영어일기", "지금 생각나는대로"];

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function todayStatus(): TodayWritingStatus {
  return {
    date: TODAY_KEY,
    completed: true,
    completedSessions: 1,
    startedSessions: 1,
    streakDays: 2,
    totalAnswerSessions: 12,
    totalWrittenSentences: 30
  };
}

function homeSnapshot(): MobileHomeSnapshot {
  return { todayStatus: todayStatus(), diaryCalendarSummary: { totalEntries: 0, days: [] }, featuredRecommendation: null };
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
      updatedAt: "2026-11-01T00:00:00.000Z"
    }
  };
}

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();

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

function bookcase(): MarkInfo {
  const found = Object.values(MARKS).filter((mark) => mark.label === BOOK_LABEL);
  expect(found.map((mark) => mark.label)).toEqual([BOOK_LABEL]);
  return found[0];
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderHome() {
  const view = await render(<HomeScreen />);
  await flushAsync();
  return view;
}

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

async function frames(count: number) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

/**
 * 작업 063 03 결정 1: '들어가기'를 누른 뒤 같은 일이 동작(약 1초)이 끝난 뒤에 일어난다. 그 일이 일어날 때까지(최대 2.5초)
 * 0.05초씩 프레임을 진행한다(타이머·시계도 함께). 이미 일어났으면 진행하지 않는다.
 */
async function waitEnterMotion(done: () => boolean) {
  for (let elapsed = 0; elapsed < 2.5 && !done(); elapsed += 0.05) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

async function tapMark(mark: MarkId) {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", { point: null, mark, onCharacter: false }, 200, 300);
  });
}

/** 열린 판(질문·일기·생각)의 제목. */
function openSheets() {
  return screen.root!
    .queryAll((instance: TestInstance) => instance.type === "Modal" && instance.props.animationType === "slide" && instance.props.visible !== false)
    .flatMap((modal) => SHEET_TITLES.filter((title) => within(modal).queryAllByRole("header", { name: title }).length > 0));
}

/** 다른 화면으로 간 곳(push·replace·navigate를 모두 모은다). */
function navigatedTo() {
  return [
    ...jest.mocked(router.push).mock.calls,
    ...jest.mocked(router.replace).mock.calls,
    ...jest.mocked(router.navigate).mock.calls
  ].map((call) => call[0]);
}

function bubbleOf(line: string) {
  let node = screen.getByText(line).parent!;
  while (node.props.pointerEvents === "none") node = node.parent!;
  return node;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.navigate).mockReset();
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue({ totalEntries: 0, days: [] });
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockRejectedValue(new Error("추천 질문은 이 테스트에서 보지 않음"));
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
  jest.useRealTimers();
});

describe("[spec] 작업 062 바뀔 동작: 책장의 '들어가기'와 '학습 기록' 메뉴는 기록 화면(/records)으로 간다(명세 3)", () => {
  it("H1: 로그인한 홈에서 아래 '학습 기록' 메뉴를 누르면 걸어가지 않고 기록 화면(/records)으로 한 번 가며, 판은 열리지 않는다", async () => {
    await renderHome();
    const before = { x: canvas().sim.x, z: canvas().sim.z };

    await fireEvent.press(screen.getByRole("button", { name: BOOK_LABEL }));
    await flushAsync();
    await frames(10);

    expect(navigatedTo()).toEqual(["/records"]);
    expect(openSheets()).toEqual([]);
    expect({ x: canvas().sim.x, z: canvas().sim.z }).toEqual(before);
  });

  it("H2: 로그인한 홈에서 책장을 눌러 도착한 뒤 말풍선의 '들어가기'를 누르면 기록 화면(/records)으로 한 번 가며, 판은 열리지 않는다", async () => {
    const book = bookcase();
    await renderHome();

    await tapMark(book.id);
    for (let index = 0; index < 400 && !(canvas().sim.arrived === book.id && canvas().sim.vx === 0 && canvas().sim.vz === 0); index += 1) {
      await frames(1);
    }
    await frames(5);
    expect(canvas().sim.arrived).toBe(book.id);
    expect(navigatedTo()).toEqual([]);

    await fireEvent.press(within(bubbleOf(BOOK_PROMPT)).getByRole("button", { name: BOOK_BUTTON }));
    await flushAsync();
    await waitEnterMotion(() => navigatedTo().length > 0);

    expect(navigatedTo()).toEqual(["/records"]);
    expect(openSheets()).toEqual([]);
  });
});
