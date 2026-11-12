// [spec] qa 테스트(작업 088 ① 마을 장면, 새 기능, 모바일): 홈(/)에는 아직 마을로 가는 길이 없다(D9).
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/02-마을-장면/02-qa-scenarios.md D9)에서만 가져온다.
// '밖으로' 장소의 말풍선 글·버튼·안내는 ①이 홈을 바꾸지 않으므로 지금 그대로의 값이다.
// 가짜로 두는 것(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기)은 기존 홈 시각 시험(lobby3d-clock.spec.test.tsx)과 같다.
// 3D 그리기 가짜는 처음 그려진 뒤 '방이 보였다'(onRoomShown)를 한 번 부른다. 구현 코드는 부르는 방법(3D 그리기에 넘기는 sim·onFrame·onPointer)만 읽었다.
// 088 ② 03 결정 1(사용자, 2026-11-13 "qa가 새 동작에 맞게 고침")로 D9를 ②의 새 동작으로 고쳤다: 홈에 시험판 '방'·'마을' 버튼이 없는 것은 그대로이고,
// '밖으로' 말풍선은 "밖으로 나가 볼까?"·버튼 "나가기", 누르면 옛 안내 없이 마을로 나간다(② 02-qa-scenarios X1·X2·X4).
// 이를 위해 3D 그리기 가짜가 구역이 마을로 바뀌면 마을 모델이 들어왔다(onVillageReady, ② 구현의 부르는 방법)고 알리게 준비만 더했다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { AppState } from "react-native";
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
import { MARKS, applyArea, type PointerHit } from "@/lib/lobby3d/engine";
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
  function MockLobby3dCanvas(props: Lobby3dCanvasProps) {
    mockCanvas.props = props;
    const onRoomShown = props.onRoomShown;
    const sent = React.useRef(false);
    React.useEffect(() => {
      if (sent.current || !onRoomShown) return;
      sent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    const area = props.area ?? "room";
    React.useEffect(() => {
      if (area === "village") mockCanvas.props?.onVillageReady?.();
    }, [area]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
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
  return { todayStatus: todayStatus(), diaryCalendarSummary: { totalEntries: 0, days: [] }, featuredRecommendation: null } as unknown as MobileHomeSnapshot;
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

async function flushAsync() {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function canvas(): Lobby3dCanvasProps {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation(() => ({ remove: jest.fn() }));
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue({ totalEntries: 0, days: [] });
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockResolvedValue(null as unknown as FeaturedDailyPromptRecommendation);
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
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("[spec] 홈에는 시험판 구역 버튼이 없고, '밖으로'의 '나가기'로 마을에 간다(D9, 088 ② 03 결정 1로 고침)", () => {
  for (const dev of [false, true]) {
    it(`D9 ${dev ? "개발" : "출시"} 빌드: '방'·'마을' 버튼이 없고, '밖으로'에 가면 말풍선 '밖으로 나가 볼까?'·버튼 '나가기'이며 누르면 옛 안내 없이 마을로 나간다`, async () => {
      devGlobal.__DEV__ = dev;
      await render(<HomeScreen />);
      await flushAsync();

      expect(screen.queryByRole("button", { name: "마을" })).toBeNull();
      expect(screen.queryByRole("button", { name: "방" })).toBeNull();
      expect(screen.queryByText("마을", { includeHiddenElements: true })).toBeNull();

      // '밖으로' 장소로 걸어간다(누르면 인사는 거둔다)
      const hit: PointerHit = { point: MARKS.door.approach[0], mark: "door", onCharacter: false };
      await act(async () => {
        canvas().onPointer("down", hit, 100, 100);
      });
      await act(async () => {
        jest.advanceTimersByTime(30);
        canvas().onPointer("up", null, 100, 100);
      });
      await act(async () => {
        for (let i = 0; i < 300; i += 1) {
          jest.advanceTimersByTime(50);
          canvas().onFrame(0.05, Date.now());
        }
      });
      await flushAsync();

      const snap = canvas().sim.snapshot(Date.now());
      expect(snap.arrived).toBe("door");
      expect(snap.bubbleText).toBe("밖으로 나가 볼까?");
      expect(snap.bubbleButton).toBe("나가기");

      await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
      await flushAsync();
      await act(async () => {
        for (let i = 0; i < 30; i += 1) {
          jest.advanceTimersByTime(50);
          canvas().onFrame(0.05, Date.now());
        }
      });
      await flushAsync();
      expect(screen.queryByText("마을은 다음 업데이트에서 열려요", { includeHiddenElements: true })).toBeNull();
      expect(canvas().area).toBe("village");
    });
  }
});
