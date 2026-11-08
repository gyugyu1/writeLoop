// [spec] qa 테스트(작업 064-④ 편집 모드: 벽 가구, 모바일): 홈 '꾸미기'에서 게시판·창문을 고르고, 벽을 따라 끌어 놓고, 저장하는지.
// 기대값은 시나리오(private 작업 폴더 064/05-벽-가구-편집/02-qa-scenarios.md의 S1~S8, D1~D18, E1~E3, F3, W9)와
// 결정(같은 폴더 03-main-decision.md의 2·3)에서만 가져온다.
// 구현 코드는 부르는 방법(3D 그리기가 받는 edit의 layout·marks·wallMarks·dragging, 누르기 결과의 piece·wall)을 알려고만 읽었다.
// 가짜로 두는 것: ③의 홈 꾸미기 테스트(home-lobby-edit.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태,
// 라우터, 포커스, 3D 그리기). 3D 그리기는 가짜라서, 어느 가구·어느 벽을 눌렀는지는 3D 그리기가 판정한 값(piece, wall, 바닥 point)을
// 누르기 결과로 그대로 넣어 보낸다(시나리오 가정 A8). 그 판정 자체와 3D 그림(벽에 칠한 색, 창밖, 창문 빛)은 이 테스트로 보지 못한다.
// 엔진의 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
// 064-④ 결정 11에 맞춰 D17을 고치고(창문 왼벽 5.0은 책상 칸 0,5 바로 위라 놓을 수 없음), 게시판을 책상 위로 끄는 경우(결정11-가)와
// 벽 가구 앞 바닥 띠로 고르고 끄는 테스트(B1~B10)를 더했다. 띠를 누른 것은 3D 그리기가 바닥 점만 넘기고(piece·wall 없음) 화면·편집이
// 그 벽 가구로 본다고 가정한다(띠 판정을 3D 그리기 안에서 해 piece로 넘기는 구현이면 이 가정이 맞지 않는다. 12-qa-tests.md에 적음).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { BackHandler } from "react-native";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getLobbyLayout,
  getMobileHomeSnapshot,
  getMonthWritingStatus,
  getTodayWritingStatus,
  getWritingDraft,
  saveLobbyLayout,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { MARKS, activeLobbyLayout, applyLobbyLayout, markZoneAt, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type FloorPieceId, type LobbyLayout, type WallPieceId, type WallSide } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
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
  getLobbyLayout: jest.fn(),
  getMobileHomeSnapshot: jest.fn(),
  getMonthWritingStatus: jest.fn(),
  getTodayWritingStatus: jest.fn(),
  getWritingDraft: jest.fn(),
  saveLobbyLayout: jest.fn(),
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

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";
const userA: AuthUser = { id: 7, email: "a@example.com", displayName: "가", admin: false };

function homeSnapshot(): MobileHomeSnapshot {
  return {
    todayStatus: {
      date: TODAY_KEY,
      completed: true,
      completedSessions: 1,
      startedSessions: 1,
      streakDays: 2,
      totalAnswerSessions: 3,
      totalWrittenSentences: 9
    },
    diaryCalendarSummary: { totalEntries: 0, days: [] },
    featuredRecommendation: null
  } as unknown as MobileHomeSnapshot;
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

// ---------- 시나리오의 글과 배치 ----------

const RED_FIRST = "빨간 가구부터 옮겨 주세요";

const P0: LobbyLayout = {
  floor: {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 2.5, facing: 1 },
    wardrobe: { x: 7.5, z: 3.5, facing: 3 },
    rug: { x: 4.6, z: 7.2, facing: 0 }
  },
  wall: { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } }
};

type WallSpot = { wall: WallSide; along: number };

function withWall(base: LobbyLayout, id: WallPieceId, spot: WallSpot): LobbyLayout {
  return { floor: base.floor, wall: { ...base.wall, [id]: spot } };
}

const back = (along: number): WallSpot => ({ wall: "back", along });
const left = (along: number): WallSpot => ({ wall: "left", along });
const right = (along: number): WallSpot => ({ wall: "right", along });

/** 바닥 가구 가운데(누를 곳). */
const AT = {
  desk: { x: 1.5, z: 5.5 },
  bookcase: { x: 0.5, z: 2.5 }
} as const;
const EMPTY_FLOOR: FloorPoint = { x: 4.5, z: 9.5 };

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

/** 3D 그리기가 넘기는 누르기 결과. 벽 위면 wall, 바닥 위면 point, 방 밖이면 둘 다 null이다. */
type Spot = WallSpot | { floor: FloorPoint } | "outside";

function hitAt(spot: Spot, piece: FloorPieceId | WallPieceId | null = null): PointerHit {
  if (spot === "outside") return { point: null, mark: null, onCharacter: false, piece, wall: null };
  if ("floor" in spot) return { point: spot.floor, mark: null, onCharacter: false, piece, wall: null };
  return { point: null, mark: piece === "board" || piece === "window" ? piece : null, onCharacter: false, piece, wall: { wall: spot.wall, along: spot.along } };
}

async function pointer(phase: "down" | "move" | "up" | "cancel", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

/** 톡(같은 화면 자리에서 누르고 뗀다). */
async function tap(spot: Spot, piece: FloorPieceId | WallPieceId | null = null) {
  await pointer("down", hitAt(spot, piece), 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

let screenStep = 0;

/** 벽 가구를 누른다(화면 200,300). */
async function press(piece: WallPieceId, spot: Spot) {
  screenStep = 0;
  await pointer("down", hitAt(spot, piece), 200, 300);
}

/** 손가락을 옮긴다(화면으로 처음 누른 곳에서 매번 100px 넘게 떨어진 곳). */
async function moveTo(spot: Spot) {
  screenStep += 1;
  await pointer("move", hitAt(spot), 200 + 100 * screenStep, 300 + 100 * screenStep);
}

async function release() {
  await pointer("up", null, 200 + 100 * screenStep, 300 + 100 * screenStep);
  await flushAsync();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

function rotateButton() {
  return screen.queryByRole("button", { name: "돌리기" });
}

/** 고른 바닥 가구를 돌리기 버튼으로 한 번 돌린다. */
async function rotateOnce() {
  const button = rotateButton();
  expect(button).not.toBeNull();
  await fireEvent.press(button!);
  await flushAsync();
}

function editLayout(): LobbyLayout {
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  return edit!.layout;
}

function r4(v: number): number {
  const n = Math.round(v * 1e4) / 1e4;
  return n === 0 ? 0 : n;
}

/** 벽에 칠한 자리(소수 넷째 자리). */
function wallMarks() {
  return canvas().edit!.wallMarks.map((m) => ({ piece: m.piece, wall: m.wall, from: r4(m.from), to: r4(m.to), ok: m.ok }));
}

function floorMarks() {
  return canvas().edit!.marks.map((m) => ({ piece: m.piece, ok: m.ok }));
}

const WIDTH: Record<WallPieceId, number> = { board: 1.8, window: 2.3 };

/** 벽 가구가 그 자리에 있을 때 칠하는 자리(가정 A7: along ± 폭/2). */
function markOf(piece: WallPieceId, spot: WallSpot, ok: boolean) {
  return { piece, wall: spot.wall, from: r4(spot.along - WIDTH[piece] / 2), to: r4(spot.along + WIDTH[piece] / 2), ok };
}

const backHandlers = new Set<() => boolean | null | undefined>();

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  backHandlers.clear();
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    backHandlers.add(handler);
    return { remove: () => backHandlers.delete(handler) } as ReturnType<typeof BackHandler.addEventListener>;
  });
  jest.mocked(router.push).mockReset();
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  // 저장 성공 때 서버는 보낸 배치를 그대로 돌려준다
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (layout: LobbyLayout) => JSON.parse(JSON.stringify(layout)));
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(homeSnapshot().todayStatus ?? null);
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue({ totalEntries: 0, days: [] });
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockResolvedValue(null as never);
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
  refreshSession.mockReset().mockResolvedValue(userA);
  setSessionUser(userA);
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function startEditing() {
  await renderHome();
  await enterEdit();
  expect(editLayout()).toEqual(P0);
}

/** D5: 게시판 가운데(뒷벽 1.8)를 눌러 왼벽 z 7.4로 끌어 놓는다 → 왼벽 7.5. */
async function moveBoardToLeft() {
  await press("board", back(1.8));
  await moveTo(left(7.4));
  await release();
  expect(editLayout()).toEqual(withWall(P0, "board", left(7.5)));
}

/** 책장을 골라 한 번 돌려(앞면이 벽을 봄) 빨간 가구로 만들고 고르기를 푼다(③과 같은 방법). */
async function makeRedBookcase() {
  await tap({ floor: AT.bookcase }, "bookcase");
  await rotateOnce();
  await tap({ floor: EMPTY_FLOOR });
  expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
}

// ---------- S. 고르기(명세 1, 4) ----------

describe("[spec] 064-④ S: 벽 가구 고르기", () => {
  test("S1 게시판을 톡하면 골라지고 돌리기 버튼이 없다. 칠하기: 뒷벽 0.9~2.7, 놓을 수 있음", async () => {
    await startEditing();

    await tap(back(1.8), "board");

    expect(rotateButton()).toBeNull();
    expect(wallMarks()).toEqual([{ piece: "board", wall: "back", from: 0.9, to: 2.7, ok: true }]);
    expect(floorMarks()).toEqual([]);
  });

  test("S2 창문을 톡하면 골라지고 돌리기 버튼이 없다. 칠하기: 뒷벽 3.65~5.95, 놓을 수 있음", async () => {
    await startEditing();

    await tap(back(4.8), "window");

    expect(rotateButton()).toBeNull();
    expect(wallMarks()).toEqual([{ piece: "window", wall: "back", from: 3.65, to: 5.95, ok: true }]);
  });

  test("S3 책상을 골라 둔 뒤 창문을 톡하면 창문으로 바뀌고 돌리기 버튼이 사라진다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expect(rotateButton()).not.toBeNull();

    await tap(back(4.8), "window");

    expect(rotateButton()).toBeNull();
    expect(floorMarks()).toEqual([]);
    expect(wallMarks()).toEqual([{ piece: "window", wall: "back", from: 3.65, to: 5.95, ok: true }]);
  });

  test("S4 게시판을 골라 둔 뒤 빈 바닥을 톡하면 고르기가 풀린다", async () => {
    await startEditing();
    await tap(back(1.8), "board");

    await tap({ floor: EMPTY_FLOOR });

    expect(wallMarks()).toEqual([]);
    expect(floorMarks()).toEqual([]);
    expect(rotateButton()).toBeNull();
  });

  test("S5 게시판을 골라 둔 뒤 책장을 톡하면 책장이 골라지고 돌리기 버튼이 나온다", async () => {
    await startEditing();
    await tap(back(1.8), "board");

    await tap({ floor: AT.bookcase }, "bookcase");

    expect(rotateButton()).not.toBeNull();
    expect(wallMarks()).toEqual([]);
    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: true }]);
  });

  test("S6 게시판·창문을 톡만 하고 '완료'하면 배치가 그대로이고 저장 요청이 없다", async () => {
    await startEditing();

    await tap(back(1.8), "board");
    await tap(back(4.8), "window");
    expect(editLayout()).toEqual(P0);

    await pressButton("완료");
    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(activeLobbyLayout()).toEqual(P0);
  });

  test("S7 빨간 책장이 있는 동안 게시판을 톡하면 '빨간 가구부터 옮겨 주세요'가 뜨고 게시판은 골라지지 않는다", async () => {
    await startEditing();
    await makeRedBookcase();

    await tap(back(1.8), "board");

    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expect(wallMarks()).toEqual([]);
    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
  });

  test("S8 빨간 책장이 있는 동안 창문을 뒷벽 4.8 → 6.4로 끌면 알림이 뜨고 창문은 그대로, 골라지지 않는다", async () => {
    await startEditing();
    await makeRedBookcase();

    await press("window", back(4.8));
    await moveTo(back(6.4));
    await release();

    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expect(editLayout().wall.window).toEqual(back(4.8));
    expect(wallMarks()).toEqual([]);
  });
});

// ---------- D. 끌기(명세 2, 3, 5~8, 결정 03의 2·3) ----------

type DragCase = {
  label: string;
  /** D5를 먼저 해 둔다(게시판 왼벽 7.5에서 시작). */
  afterD5?: boolean;
  piece: WallPieceId;
  pressAt: Spot;
  /** 손가락 자리와, 그때(끌기 중) 편집 중 배치의 그 가구 자리, 칠하기의 놓을 수 있음(적은 것만 본다). */
  moves: { to: Spot; expect: WallSpot; ok?: boolean }[];
  /** 손을 뗀 뒤의 그 가구 자리. */
  after: WallSpot;
};

const DRAG_CASES: DragCase[] = [
  { label: "D1 게시판 뒷벽 1.8 → 뒷벽 1.9: 한 번 끌면 2.0", piece: "board", pressAt: back(1.8), moves: [{ to: back(1.9), expect: back(2.0), ok: true }], after: back(2.0) },
  { label: "D2 게시판 뒷벽 1.8 → 뒷벽 2.3: 2.5", piece: "board", pressAt: back(1.8), moves: [{ to: back(2.3), expect: back(2.5), ok: true }], after: back(2.5) },
  { label: "D3 게시판을 뒷벽 2.4에서 눌러 뒷벽 3.2로: 3.2 − 0.6 = 2.6 → 2.5", piece: "board", pressAt: back(2.4), moves: [{ to: back(3.2), expect: back(2.5) }], after: back(2.5) },
  { label: "D4 창문을 뒷벽 4.3에서 눌러 뒷벽 5.6으로: 5.6 + 0.5 = 6.1 → 6.0", piece: "window", pressAt: back(4.3), moves: [{ to: back(5.6), expect: back(6.0) }], after: back(6.0) },
  { label: "D5 게시판 뒷벽 1.8 → 왼벽 z 7.4: 왼벽 7.5", piece: "board", pressAt: back(1.8), moves: [{ to: left(7.4), expect: left(7.5), ok: true }], after: left(7.5) },
  { label: "D6 창문 뒷벽 4.8 → 바닥 (6.9, 8.6): 가장 가까운 오른벽 8.5", piece: "window", pressAt: back(4.8), moves: [{ to: { floor: { x: 6.9, z: 8.6 } }, expect: right(8.5) }], after: right(8.5) },
  { label: "D7 창문 뒷벽 4.8 → 바닥 (5.6, 1.0): 가장 가까운 뒷벽 5.5", piece: "window", pressAt: back(4.8), moves: [{ to: { floor: { x: 5.6, z: 1.0 } }, expect: back(5.5) }], after: back(5.5) },
  {
    label: "D8 게시판 뒷벽 1.8 → 왼벽 7.4 → 오른벽 7.4 → 뒷벽 2.3",
    piece: "board",
    pressAt: back(1.8),
    moves: [
      { to: left(7.4), expect: left(7.5) },
      { to: right(7.4), expect: right(7.5) },
      { to: back(2.3), expect: back(2.5) }
    ],
    after: back(2.5)
  },
  { label: "D9 게시판 → 왼벽 z 2.6: 왼벽 2.5는 책장 바로 위라 빨강, 떼면 뒷벽 1.8", piece: "board", pressAt: back(1.8), moves: [{ to: left(2.6), expect: left(2.5), ok: false }], after: back(1.8) },
  { label: "D10 창문 → 뒷벽 3.4: 3.5는 게시판과 겹쳐 빨강, 떼면 뒷벽 4.8", piece: "window", pressAt: back(4.8), moves: [{ to: back(3.4), expect: back(3.5), ok: false }], after: back(4.8) },
  { label: "D11 창문 → 뒷벽 4.1: 4.0은 놓을 수 있음", piece: "window", pressAt: back(4.8), moves: [{ to: back(4.1), expect: back(4.0), ok: true }], after: back(4.0) },
  { label: "D12 게시판 → 뒷벽 0.9: 1.0은 왼끝 간격 0.1이라 빨강, 떼면 1.8", piece: "board", pressAt: back(1.8), moves: [{ to: back(0.9), expect: back(1.0), ok: false }], after: back(1.8) },
  { label: "D13 게시판 → 왼벽 z 10.1: 10.0은 앞끝 간격 0.1이라 빨강, 떼면 뒷벽 1.8", piece: "board", pressAt: back(1.8), moves: [{ to: left(10.1), expect: left(10.0), ok: false }], after: back(1.8) },
  { label: "D14 게시판 → 왼벽 z 5.4: 5.5는 서는 자리가 책상 칸이라 빨강, 떼면 뒷벽 1.8", piece: "board", pressAt: back(1.8), moves: [{ to: left(5.4), expect: left(5.5), ok: false }], after: back(1.8) },
  {
    label: "D15 (D5 뒤) 게시판 왼벽 7.5 → 뒷벽 4.4: 4.5는 창문과 겹쳐 빨강, 떼면 왼벽 7.5(벽까지 끌기 전으로)",
    afterD5: true,
    piece: "board",
    pressAt: left(7.5),
    moves: [{ to: back(4.4), expect: back(4.5), ok: false }],
    after: left(7.5)
  },
  {
    label: "D16 (D5 뒤) 창문 → 왼벽 z 9.4: 9.5는 게시판과 겹쳐 빨강, 떼면 뒷벽 4.8",
    afterD5: true,
    piece: "window",
    pressAt: back(4.8),
    moves: [{ to: left(9.4), expect: left(9.5), ok: false }],
    after: back(4.8)
  },
  {
    label: "D17(결정 11) (D5 뒤) 창문 → 왼벽 z 5.1: 5.0은 책상 칸 0,5 바로 위라 빨강, 떼면 뒷벽 4.8",
    afterD5: true,
    piece: "window",
    pressAt: back(4.8),
    moves: [{ to: left(5.1), expect: left(5.0), ok: false }],
    after: back(4.8)
  },
  // 결정 11의 1: 벽 가구를 끌어 책상 바로 위가 되는 자리도 놓을 수 없다
  { label: "결정11-가 게시판 → 왼벽 z 5.1: 5.0은 책상 칸 0,5 바로 위라 빨강, 떼면 뒷벽 1.8", piece: "board", pressAt: back(1.8), moves: [{ to: left(5.1), expect: left(5.0), ok: false }], after: back(1.8) },
  // 결정 03의 2: 다른 벽으로 넘어가도 벽을 따라간 거리(along의 차이)를 숫자 그대로 더한다
  { label: "결정2-가 게시판을 뒷벽 2.4(가운데 −0.6)에서 눌러 왼벽 z 8.1로: 8.1 − 0.6 = 7.5", piece: "board", pressAt: back(2.4), moves: [{ to: left(8.1), expect: left(7.5) }], after: left(7.5) },
  { label: "결정2-나 창문을 뒷벽 4.3(가운데 +0.5)에서 눌러 오른벽 z 7.6으로: 7.6 + 0.5 = 8.1 → 8.0", piece: "window", pressAt: back(4.3), moves: [{ to: right(7.6), expect: right(8.0) }], after: right(8.0) },
  // 결정 03의 3: 방 밖으로 나가면 마지막 자리에 멈추고, 떼면 그 자리로 판단한다
  {
    label: "결정3-가 게시판 → 왼벽 7.4 → 방 밖: 왼벽 7.5에 멈추고, 떼면 왼벽 7.5에 놓인다",
    piece: "board",
    pressAt: back(1.8),
    moves: [
      { to: left(7.4), expect: left(7.5), ok: true },
      { to: "outside", expect: left(7.5), ok: true }
    ],
    after: left(7.5)
  },
  {
    label: "결정3-나 게시판 → 왼벽 2.6 → 방 밖: 왼벽 2.5(빨강)에 멈추고, 떼면 뒷벽 1.8로 돌아간다",
    piece: "board",
    pressAt: back(1.8),
    moves: [
      { to: left(2.6), expect: left(2.5), ok: false },
      { to: "outside", expect: left(2.5), ok: false }
    ],
    after: back(1.8)
  }
];

describe("[spec] 064-④ D: 벽 가구 끌기", () => {
  test.each(DRAG_CASES.map((c) => [c.label, c] as const))("%s", async (_label, c) => {
    await startEditing();
    if (c.afterD5) await moveBoardToLeft();
    const before = editLayout();

    await press(c.piece, c.pressAt);
    for (const step of c.moves) {
      await moveTo(step.to);
      // 끌기 중: 그 가구만 옮겨지고, 돌리기 버튼은 없다
      expect(editLayout()).toEqual(withWall(before, c.piece, step.expect));
      expect(rotateButton()).toBeNull();
      if (step.ok !== undefined) expect(wallMarks()).toEqual([markOf(c.piece, step.expect, step.ok)]);
    }
    await release();

    // 뗀 뒤: 그 가구가 골라져 있고(벽에 칠함), 돌리기 버튼은 없다
    expect(editLayout()).toEqual(withWall(before, c.piece, c.after));
    expect(rotateButton()).toBeNull();
    expect(wallMarks().map((m) => m.piece)).toEqual([c.piece]);
    // D18: 끌기 전과 다른 자리에 놓였으면 반 칸(0.5) 단위다
    const placed = editLayout().wall[c.piece];
    const from = before.wall[c.piece];
    if (placed.wall !== from.wall || placed.along !== from.along) expect(Number.isInteger(placed.along * 2)).toBe(true);
  });
});

// ---------- E. 완료·취소·처음 배치로, F3 따라가는 것 ----------

describe("[spec] 064-④ E·F3: 벽 가구를 옮긴 뒤 완료·취소·처음 배치로", () => {
  test("E1·F3 게시판을 왼벽 7.5로 옮기고 '완료': 그 배치로 한 번 저장하고, 나온 뒤 게시판 장소가 왼벽을 따라간다", async () => {
    await startEditing();
    await moveBoardToLeft();

    await pressButton("완료");

    const saved = withWall(P0, "board", left(7.5));
    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expect(saveLobbyLayout).toHaveBeenCalledWith(saved);
    expect(screen.getByText("꾸미기")).toBeTruthy();
    expect(activeLobbyLayout()).toEqual(saved);
    expect(MARKS.board.approach.map((p) => [r4(p.x), r4(p.z)])).toEqual([
      [1.3, 7.7],
      [1.3, 7.1]
    ]);
    expect([r4(MARKS.board.faceTo.x), r4(MARKS.board.faceTo.z)]).toEqual([0, 7.5]);
    expect({ wall: markZoneAt(0.1, 7.5), old: markZoneAt(1.9, 0.6) }).toEqual({ wall: "board", old: null });
  });

  test("E2 게시판을 왼벽 7.5, 창문을 뒷벽 4.0으로 옮기고 '취소': 저장 없이 나오고 방은 P0", async () => {
    await startEditing();
    await moveBoardToLeft();
    await press("window", back(4.8));
    await moveTo(back(4.1));
    await release();
    expect(editLayout()).toEqual(withWall(withWall(P0, "board", left(7.5)), "window", back(4.0)));

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(screen.getByText("꾸미기")).toBeTruthy();
    expect(activeLobbyLayout()).toEqual(P0);
  });

  test("E3 같은 두 가지를 옮기고 '처음 배치로': 편집 중 배치가 P0(게시판 뒷벽 1.8, 창문 뒷벽 4.8)이고 편집 모드에 남는다", async () => {
    await startEditing();
    await moveBoardToLeft();
    await press("window", back(4.8));
    await moveTo(back(4.1));
    await release();

    await pressButton("처음 배치로");

    expect(editLayout()).toEqual(P0);
    expect(screen.queryByText("꾸미기")).toBeNull();
    expect(screen.getByRole("button", { name: "완료" })).toBeTruthy();
  });
});

// ---------- W9 놓인 뒤 다시 계산 ----------

describe("[spec] 064-④ W9: 창문을 끄는 동안과 놓은 뒤 3D 그리기에 넘기는 값", () => {
  test("W9 창문을 오른벽 8.5로 끄는 동안은 끄는 중(dragging)으로 넘기고, 놓은 뒤에는 끄는 중이 아니며 배치의 창문이 오른벽 8.5다", async () => {
    await startEditing();

    await press("window", back(4.8));
    await moveTo({ floor: { x: 6.9, z: 8.6 } });
    expect(canvas().edit!.dragging).toBe(true);

    await release();
    expect(canvas().edit!.dragging).toBe(false);
    expect(editLayout().wall.window).toEqual(right(8.5));
  });
});

// ---------- B. 벽 가구 앞 바닥 띠로 고르기·끌기(결정 11의 2) ----------
// 띠: 그 벽에서 1칸 안(뒷벽 z < 1, 왼벽 x < 1, 오른벽 x > 7)이고 벽을 따라 그 벽 가구 폭 안(along ± 폭/2)인 바닥.
// 바닥 가구를 맞혔으면 바닥 가구가 먼저, 벽 가구를 직접 맞혔으면 그 벽 가구, 두 벽 띠에 모두 들면 가장 가까운 벽의 가구.

/** 창문을 왼벽 8.5에 건 배치(③의 LW와 같다). 창문 띠: x < 1, z 7.35~9.65. */
const LW: LobbyLayout = withWall(P0, "window", left(8.5));
/** 게시판 오른벽 6.0, 창문 왼벽 8.0. 게시판 띠: x > 7, z 5.1~6.9. */
const L3: LobbyLayout = withWall(withWall(P0, "board", right(6.0)), "window", left(8.0));
/** 게시판 뒷벽 6.5(띠 x 5.6~7.4, z < 1), 창문 오른벽 1.5(띠 x > 7, z 0.35~2.65). 뒤·오른쪽 모서리에서 두 띠가 겹친다. */
const CORNER: LobbyLayout = withWall(withWall(P0, "board", back(6.5)), "window", right(1.5));
/** 깔개를 창문 아래(4.6, 1.0)에 둔 배치(깔개는 벽 가구 아래도 된다). */
const RUG_UNDER: LobbyLayout = { floor: { ...P0.floor, rug: { x: 4.6, z: 1.0, facing: 0 } }, wall: P0.wall };

async function startEditingFrom(layout: LobbyLayout) {
  jest.mocked(getLobbyLayout).mockResolvedValue(layout);
  await renderHome();
  expect(activeLobbyLayout()).toEqual(layout);
  await enterEdit();
  expect(editLayout()).toEqual(layout);
}

/** 바닥만 누른 것(3D 그리기가 바닥 가구도 벽 가구도 맞히지 못함). */
async function tapFloor(point: FloorPoint) {
  await tap({ floor: point });
}

describe("[spec] 064-④ 결정 11 B: 벽 가구 앞 바닥 띠", () => {
  test("B1 뒷벽 창문 앞 띠 (4.8, 0.5)를 톡하면 창문이 골라진다", async () => {
    await startEditing();

    await tapFloor({ x: 4.8, z: 0.5 });

    expect(wallMarks()).toEqual([{ piece: "window", wall: "back", from: 3.65, to: 5.95, ok: true }]);
    expect(rotateButton()).toBeNull();
  });

  test("B2 뒷벽 게시판 앞 띠 (1.8, 0.6)를 톡하면 게시판이 골라진다", async () => {
    await startEditing();

    await tapFloor({ x: 1.8, z: 0.6 });

    expect(wallMarks()).toEqual([{ piece: "board", wall: "back", from: 0.9, to: 2.7, ok: true }]);
  });

  test("B3 왼벽 창문(8.5) 앞 띠 (0.5, 8.5)를 톡하면 창문이 골라진다", async () => {
    await startEditingFrom(LW);

    await tapFloor({ x: 0.5, z: 8.5 });

    expect(wallMarks().map((m) => ({ piece: m.piece, wall: m.wall }))).toEqual([{ piece: "window", wall: "left" }]);
  });

  test("B4 오른벽 게시판(6.0) 앞 띠 (7.6, 6.0)을 톡하면 게시판이 골라진다", async () => {
    await startEditingFrom(L3);

    await tapFloor({ x: 7.6, z: 6.0 });

    expect(wallMarks().map((m) => ({ piece: m.piece, wall: m.wall }))).toEqual([{ piece: "board", wall: "right" }]);
  });

  test("B5 뒷벽 창문 띠 (4.8, 0.5)를 눌러 뒷벽 x 5.6으로 끌면 창문이 끌려 뒷벽 5.5에 놓인다", async () => {
    await startEditing();

    screenStep = 0;
    await pointer("down", hitAt({ floor: { x: 4.8, z: 0.5 } }), 200, 300);
    await moveTo(back(5.6));
    expect(editLayout()).toEqual(withWall(P0, "window", back(5.5)));
    await release();

    expect(editLayout()).toEqual(withWall(P0, "window", back(5.5)));
    expect(wallMarks().map((m) => m.piece)).toEqual(["window"]);
  });

  test("B6 왼벽 창문 띠 (0.5, 8.5)를 눌러 왼벽 z 9.4로 끌면 창문이 왼벽 9.5에 놓인다", async () => {
    await startEditingFrom(LW);

    screenStep = 0;
    await pointer("down", hitAt({ floor: { x: 0.5, z: 8.5 } }), 200, 300);
    await moveTo(left(9.4));
    await release();

    expect(editLayout()).toEqual(withWall(P0, "window", left(9.5)));
  });

  test("B7 뒤·오른쪽 모서리에서 두 띠에 모두 들면 가장 가까운 벽의 가구: (7.3, 0.5)는 뒷벽 게시판, (7.3, 0.9)는 오른벽 창문", async () => {
    await startEditingFrom(CORNER);

    await tapFloor({ x: 7.3, z: 0.5 });
    expect(wallMarks().map((m) => m.piece)).toEqual(["board"]);

    await tapFloor({ x: 7.3, z: 0.9 });
    expect(wallMarks().map((m) => m.piece)).toEqual(["window"]);
  });

  test("B8 빨간 책장이 있는 동안 창문 띠 (4.8, 0.5)를 톡하면 '빨간 가구부터 옮겨 주세요'가 뜨고 창문은 골라지지 않는다", async () => {
    await startEditing();
    await makeRedBookcase();

    await tapFloor({ x: 4.8, z: 0.5 });

    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expect(wallMarks()).toEqual([]);
    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
  });

  test.each([
    ["뒷벽에서 1칸 넘음 (4.8, 1.2)", P0, { x: 4.8, z: 1.2 }],
    ["창문 폭 밖 (6.2, 0.5)", P0, { x: 6.2, z: 0.5 }],
    ["게시판과 창문 사이 (3.2, 0.5)", P0, { x: 3.2, z: 0.5 }],
    ["왼벽에서 1칸 넘음 (1.2, 8.5)", LW, { x: 1.2, z: 8.5 }],
    ["왼벽 창문 폭 밖 (0.5, 7.0)", LW, { x: 0.5, z: 7.0 }]
  ])("B9 띠 밖 %s 를 톡하거나 끌어도 아무것도 골라지지 않고 배치가 그대로다", async (_label, layout, point) => {
    await startEditingFrom(layout);

    await tapFloor(point);
    expect(wallMarks()).toEqual([]);
    expect(floorMarks()).toEqual([]);

    screenStep = 0;
    await pointer("down", hitAt({ floor: point }), 200, 300);
    await moveTo(back(6.4));
    await release();
    expect(editLayout()).toEqual(layout);
    expect(wallMarks()).toEqual([]);
  });

  test("B10 띠 안이라도 바닥 가구를 맞혔으면 바닥 가구가 먼저: 창문 아래 깔개를 (4.8, 0.5)에서 톡하면 깔개가 골라진다", async () => {
    await startEditingFrom(RUG_UNDER);

    await tap({ floor: { x: 4.8, z: 0.5 } }, "rug");

    expect(rotateButton()).not.toBeNull();
    expect(floorMarks()).toEqual([{ piece: "rug", ok: true }]);
    expect(wallMarks()).toEqual([]);
  });

  test("B11 게시판 띠 (1.8, 0.5) 위라도 창문을 직접 맞혔으면 창문이 골라진다", async () => {
    await startEditing();

    await pointer("down", { point: { x: 1.8, z: 0.5 }, mark: "window", onCharacter: false, piece: "window", wall: { wall: "back", along: 4.8 } }, 200, 300);
    await pointer("up", null, 200, 300);
    await flushAsync();

    expect(wallMarks().map((m) => m.piece)).toEqual(["window"]);
  });
});
