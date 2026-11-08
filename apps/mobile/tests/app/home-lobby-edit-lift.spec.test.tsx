// [spec] qa 테스트(작업 065 모바일 꾸미기: 고르면 뜨기, 기능 변경): 홈 '꾸미기'에서 3D 그리기에 넘기는 "뜨는 가구"(edit.lifted)가
// 끄는 동안만이 아니라 골라진 동안 내내 그 가구인지.
// 기대값은 명세(private 작업 폴더 065/01-main-spec.md의 "바뀌는 동작" 1, "그대로여야 할 동작")에서만 가져온다.
// 구현 코드는 부르는 방법(3D 그리기가 받는 edit·editLive와 그 lifted·dragging·handle·marks, 누르기 결과의 piece·wall·point,
// 돌리기 버튼의 접근성 이름 "돌리기")을 알려고만 읽었다.
// 가짜로 두는 것: 064의 홈 꾸미기 테스트(home-lobby-edit.spec.test.tsx, home-lobby-wall-edit.spec.test.tsx)와 같다(API, 기기 저장소,
// 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스, 3D 그리기). 3D 그리기는 가짜라서 아래는 이 테스트로 보지 못한다(02-qa-tests.md에 적음).
// - 의자를 누르면 책상으로 고르는 판정(3D 그리기 안의 일. 여기서는 판정된 값 piece "desk"를 넣는다)과, 책상이 뜨면 의자도 함께 뜨는 그림
// - 뜨는 세기(바닥 가구 0.6칸, 벽 가구 0.35칸), 출렁임(±0.06칸, 약 1.5초), 그림자가 제자리인 것
// 3D 그리기는 editLive가 있으면 매 프레임 그것을 읽으므로, lifted는 edit(다시 그린 값)과 editLive(바로 읽는 값) 둘 다 본다.
// 엔진의 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
// Z(결정 03, 같은 폴더 03-main-decision.md의 1·3): 장소 가구를 고르면 그 장소의 구역과 서는 자리를 3D 그리기에 넘긴다.
// 넘기는 값의 이름·모양(edit.zone = { place, center, reach, radius, approach } | null)은 메인 세션이 알려 준 부르는 방법이고,
// 기대값은 결정 03(구역 = 엔진의 장소 구역 판정과 같은 모양: 서는 자리들의 가운데를 중심으로 반지름 1칸, 게시판·창가·책장은 바라볼
// 지점까지 이어짐, 일기 책상은 원만. 편집 중인 배치로 계산)과, 지금 코드의 가구별 서는 자리·바라볼 지점(lobby-layout의 PLACE_OF를
// 배치에 놓은 값, 이 작업에서 바뀌지 않는 동작)으로 손으로 셈한 값이다. 칠의 노랑, 둥근 모서리는 3D라 보지 못한다.
// 066-①(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서 배치 데이터와 저장 본문이 v2(version 2, 가구 인스턴스 목록)로 바뀌어,
// 명세의 "고칠 기존 테스트"대로 확인하는 뜻·기대 동작은 그대로 두고 배치 모양만 v2로 고쳤다. 배치 값(자리·방향·벽)은 그대로다.
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
import { applyLobbyLayout, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
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

// ---------- 고정 데이터 ----------

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

// ---------- 글과 배치(064 테스트와 같은 처음 배치 P0) ----------

const RED_FIRST = "빨간 가구부터 옮겨 주세요";

// ---------- 066-① 배치 데이터 v2 ----------
// 배치는 { items: [{ id, type, floor?: { x, z, facing }, wall?: { wall, along } }] }이고 처음 배치의 인스턴스 id는 종류 id와 같다(066-① 명세 2).
// 064·065 때 적은 배치 값을 바닥 가구·벽 가구 묶음으로 그대로 두고 v2()로 목록을 만든다. 목록 순서는 명세가 정하지 않아 견줄 때 id 순으로 늘어놓는다.
type LayoutItem = LobbyLayout["items"][number];
type FloorSpot = NonNullable<LayoutItem["floor"]>;
type WallSpot = NonNullable<LayoutItem["wall"]>;

function v2(floor: Record<string, FloorSpot>, wall: Record<string, WallSpot>): LobbyLayout {
  return {
    items: [
      ...Object.entries(floor).map(([id, spot]) => ({ id, type: id, floor: spot }) as LayoutItem),
      ...Object.entries(wall).map(([id, spot]) => ({ id, type: id, wall: spot }) as LayoutItem)
    ]
  };
}

/** id 순으로 늘어놓은 인스턴스(목록 순서를 보지 않고 견준다). */
function sortedItems(layout: { items: readonly { id: string }[] } | null | undefined) {
  return [...(layout?.items ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 가구를 가리키는 값(누르기 결과의 piece, 고른 가구, 뜨는 가구, 칠한 칸의 piece)은 인스턴스 id다(066-① 명세 5. 처음 배치에서는 종류 id와 같다). */
type PieceId = NonNullable<PointerHit["piece"]>;
type Facing = FloorSpot["facing"];

/** 인스턴스 id가 id인 바닥 가구만 그 자리로 옮긴 배치. */
function withFloor(base: LobbyLayout, id: PieceId, x: number, z: number, facing: Facing): LobbyLayout {
  return { items: base.items.map((item) => (item.id === id ? { ...item, floor: { x, z, facing } } : item)) };
}

/** 인스턴스 id가 id인 벽 가구만 그 자리로 옮긴 배치. */
function withWall(base: LobbyLayout, id: PieceId, spot: WallSpot): LobbyLayout {
  return { items: base.items.map((item) => (item.id === id ? { ...item, wall: spot } : item)) };
}

const P0_FLOOR: Record<string, FloorSpot> = {
  desk: { x: 1.5, z: 5.5, facing: 0 },
  bookcase: { x: 0.5, z: 2.5, facing: 1 },
  wardrobe: { x: 7.5, z: 3.5, facing: 3 },
  rug: { x: 4.6, z: 7.2, facing: 0 }
};
const P0_WALL: Record<string, WallSpot> = { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } };
const P0: LobbyLayout = v2(P0_FLOOR, P0_WALL);

const back = (along: number): WallSpot => ({ wall: "back", along });

/** 옷장을 방 가운데 칸 4,6으로 옮긴 배치(064 ③의 W_CENTER와 같다). */
const W_CENTER = withFloor(P0, "wardrobe", 4.5, 6.5, 3);

/** 각 바닥 가구 가운데(누를 곳). */
const AT = {
  desk: { x: 1.5, z: 5.5 },
  bookcase: { x: 0.5, z: 2.5 },
  wardrobe: { x: 7.5, z: 3.5 },
  rug: { x: 4.6, z: 7.2 }
} as const;
const EMPTY_FLOOR: FloorPoint = { x: 4.5, z: 9.5 };
/** 뒷벽 창문(4.8) 앞 바닥 띠 안의 점(064 ④ B1과 같다). */
const WINDOW_STRIP: FloorPoint = { x: 4.8, z: 0.5 };

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

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

/** 3D 그리기가 넘기는 누르기 결과. 벽 위면 wall, 바닥 위면 point. */
type Spot = WallSpot | { floor: FloorPoint };

function hitAt(spot: Spot, piece: PieceId | null = null): PointerHit {
  if ("floor" in spot) return { point: spot.floor, mark: null, onCharacter: false, piece, wall: null };
  return { point: null, mark: (piece === "board" || piece === "window" ? piece : null) as PointerHit["mark"], onCharacter: false, piece, wall: { wall: spot.wall, along: spot.along } };
}

async function pointer(phase: "down" | "move" | "up" | "cancel", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

/** 톡(같은 화면 자리에서 누르고 뗀다). */
async function tap(spot: Spot, piece: PieceId | null = null) {
  await pointer("down", hitAt(spot, piece), 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

/** 누르고(화면 200,300) 손가락을 옮긴다(화면으로 100px 넘게). 떼지는 않는다. */
async function pressAndMove(from: Spot, piece: PieceId | null, to: Spot) {
  await pointer("down", hitAt(from, piece), 200, 300);
  await pointer("move", hitAt(to), 300, 400);
  await flushAsync();
}

async function release() {
  await pointer("up", null, 300, 400);
  await flushAsync();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

function rotateButton() {
  return screen.queryByRole("button", { name: "돌리기" });
}

async function startEditing() {
  await render(<HomeScreen />);
  await flushAsync();
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
  expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
}

/** 3D 그리기에 넘긴 뜨는 가구: 다시 그린 값(edit)과 매 프레임 바로 읽는 값(editLive) 둘 다. */
function expectLifted(expected: PieceId | null) {
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  expect(edit!.lifted).toBe(expected);
  const live = canvas().editLive?.current;
  expect(live).toBeTruthy();
  expect(live!.lifted).toBe(expected);
}

/** 편집 모드에서 나와 3D 그리기에 편집 모습을 넘기지 않는다(그래서 뜨는 가구도 없다). */
function expectNoEdit() {
  expect(canvas().edit ?? null).toBeNull();
  expect(canvas().editLive?.current ?? null).toBeNull();
}

type Point = { x: number; z: number };
type Zone = { place: "board" | "window" | "desk" | "bookcase"; center: Point; reach: Point | null; radius: number; approach: Point[] };

/** 덧셈 오차를 지운다(소수 여섯째 자리). */
function r6(v: number): number {
  const n = Math.round(v * 1e6) / 1e6;
  return n === 0 ? 0 : n;
}

function roundZone(zone: Zone): Zone {
  const p = (q: Point) => ({ x: r6(q.x), z: r6(q.z) });
  return { place: zone.place, center: p(zone.center), reach: zone.reach ? p(zone.reach) : null, radius: r6(zone.radius), approach: zone.approach.map(p) };
}

/** 3D 그리기에 넘긴 장소 구역·서는 자리(결정 03): 다시 그린 값(edit)과 바로 읽는 값(editLive) 둘 다. */
function expectZone(expected: Zone | null) {
  const read = (edit: unknown) => {
    expect(edit).toBeTruthy();
    const zone = (edit as { zone?: Zone | null }).zone;
    return zone ? roundZone(zone) : zone;
  };
  expect(read(canvas().edit)).toEqual(expected);
  expect(read(canvas().editLive?.current)).toEqual(expected);
}

// 처음 배치 P0에서 각 장소의 구역(손으로 셈한 값)
// 게시판: 뒷벽 1.8 → 서는 자리 (1.6, 1.3), (2.2, 1.3), 가운데 (1.9, 1.3), 바라볼 지점 (1.8, 0)
const ZONE_BOARD_P0: Zone = { place: "board", center: { x: 1.9, z: 1.3 }, reach: { x: 1.8, z: 0 }, radius: 1, approach: [{ x: 1.6, z: 1.3 }, { x: 2.2, z: 1.3 }] };
// 창가: 뒷벽 4.8 → 서는 자리 (4.5, 1.55), (5.1, 1.55), 가운데 (4.8, 1.55), 바라볼 지점 (4.8, 0)
const ZONE_WINDOW_P0: Zone = { place: "window", center: { x: 4.8, z: 1.55 }, reach: { x: 4.8, z: 0 }, radius: 1, approach: [{ x: 4.5, z: 1.55 }, { x: 5.1, z: 1.55 }] };
// 일기 책상: (1.5, 5.5) 앞 → 서는 자리 (1.5, 6.75), 원만이라 바라볼 지점까지 잇지 않는다
const ZONE_DESK_P0: Zone = { place: "desk", center: { x: 1.5, z: 6.75 }, reach: null, radius: 1, approach: [{ x: 1.5, z: 6.75 }] };
// 책장: (0.5, 2.5) 오른쪽 보기 → 서는 자리 (1.4, 2.5), 바라볼 지점 (0, 2.5)
const ZONE_BOOKCASE_P0: Zone = { place: "bookcase", center: { x: 1.4, z: 2.5 }, reach: { x: 0, z: 2.5 }, radius: 1, approach: [{ x: 1.4, z: 2.5 }] };

function floorMarks() {
  return canvas().edit!.marks.map((m) => ({ piece: m.piece, ok: m.ok }));
}

function wallMarkPieces() {
  return canvas().edit!.wallMarks.map((m) => m.piece);
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

// ---------- 바뀔 동작: 고르면 바로 뜬다(명세 바뀌는 동작 1) ----------

describe("[spec] 065 바뀔 동작: 골라진 가구가 뜬다", () => {
  test("[spec] L1 책상을 톡해 고르면 끄지 않아도 책상이 뜬다(배치·칸 칠은 그대로)", async () => {
    await startEditing();

    await tap({ floor: AT.desk }, "desk");

    expectLifted("desk");
    expect(canvas().edit!.dragging).toBe(false);
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
    expect(floorMarks()).toEqual([{ piece: "desk", ok: true }]);
  });

  test("[spec] L2 책상을 골라 둔 뒤 옷장을 톡하면 책상은 내려앉고 옷장이 뜬다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");

    await tap({ floor: AT.wardrobe }, "wardrobe");

    expectLifted("wardrobe");
  });

  test("[spec] L3 고른 책상을 둔 채 빈 바닥을 톡하면 고르기가 풀려 내려앉는다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");

    await tap({ floor: EMPTY_FLOOR });

    expectLifted(null);
    expect(floorMarks()).toEqual([]);
  });

  test("[spec] L4 옷장을 끌기 시작하면 뜨고, 칸 4,6에 놓은 뒤에도 골라진 채라 계속 떠 있다", async () => {
    await startEditing();

    await pressAndMove({ floor: AT.wardrobe }, "wardrobe", { floor: { x: 4.5, z: 6.5 } });
    expectLifted("wardrobe");

    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(W_CENTER));
    expect(canvas().edit!.dragging).toBe(false);
    expectLifted("wardrobe");
  });

  test("[spec] L5 책상을 골라 둔 채 옷장을 바로 끌면 옷장이 뜨고(책상은 내려앉음), 놓은 뒤에도 옷장이 떠 있다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");

    await pressAndMove({ floor: AT.wardrobe }, "wardrobe", { floor: { x: 4.5, z: 6.5 } });
    expectLifted("wardrobe");
    await release();

    expectLifted("wardrobe");
  });

  test("[spec] L6 옷장을 놓을 수 없는 책상 위로 끌어 놓아 제자리로 돌아가도, 골라진 채라 옷장이 떠 있다", async () => {
    await startEditing();

    await pressAndMove({ floor: AT.wardrobe }, "wardrobe", { floor: AT.desk });
    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
    expect(floorMarks()).toEqual([{ piece: "wardrobe", ok: true }]);
    expectLifted("wardrobe");
  });

  test("[spec] L7 창문을 톡해 고르면 창문이 뜬다(벽 가구)", async () => {
    await startEditing();

    await tap(back(4.8), "window");

    expectLifted("window");
    expect(wallMarkPieces()).toEqual(["window"]);
  });

  test("[spec] L8 창문을 뒷벽 5.6으로 끄는 동안 뜨고, 뒷벽 5.5에 놓은 뒤에도 떠 있다", async () => {
    await startEditing();

    await pressAndMove(back(4.8), "window", back(5.6));
    expectLifted("window");
    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withWall(P0, "window", back(5.5))));
    expectLifted("window");
  });

  test("[spec] L9 창문 앞 바닥 띠 (4.8, 0.5)를 톡해 창문을 고르면 창문이 뜬다", async () => {
    await startEditing();

    await tap({ floor: WINDOW_STRIP });

    expect(wallMarkPieces()).toEqual(["window"]);
    expectLifted("window");
  });

  test("[spec] L10 창문 앞 바닥 띠 (4.8, 0.5)를 눌러 뒷벽 5.6으로 끌면 끄는 동안과 놓은 뒤 모두 창문이 뜬다", async () => {
    await startEditing();

    await pressAndMove({ floor: WINDOW_STRIP }, null, back(5.6));
    expectLifted("window");
    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withWall(P0, "window", back(5.5))));
    expectLifted("window");
  });

  test("[spec] L11 게시판을 골라 둔 뒤 책상을 톡하면 게시판은 내려앉고 책상이 뜬다", async () => {
    await startEditing();
    await tap(back(1.8), "board");
    expectLifted("board");

    await tap({ floor: AT.desk }, "desk");

    expectLifted("desk");
  });

  test("[spec] L12 빨간 가구: 골라진 빨간 책장은 뜨고, 고르기가 풀린 채 남은 빨간 책장은 뜨지 않으며, 다시 고르면 뜬다", async () => {
    await startEditing();
    await tap({ floor: AT.bookcase }, "bookcase");
    // 책장을 한 번 돌리면 앞면이 벽을 봐 놓을 수 없는(빨간) 가구가 된다(064 ④ 테스트의 makeRedBookcase와 같다)
    await fireEvent.press(rotateButton()!);
    await flushAsync();
    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
    expectLifted("bookcase");

    await tap({ floor: EMPTY_FLOOR });
    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
    expectLifted(null);

    // 빨간 가구가 있는 동안 다른 가구를 누르면 안내만 뜨고 아무것도 뜨지 않는다
    await tap({ floor: AT.desk }, "desk");
    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expectLifted(null);

    await tap({ floor: AT.bookcase }, "bookcase");
    expectLifted("bookcase");
  });

  test("[spec] L13 책상을 골라 띄운 채 '취소'로 나오면 3D 그리기에 편집 모습(뜨는 가구 포함)을 넘기지 않는다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");

    await pressButton("취소");

    expectNoEdit();
  });

  test("[spec] L14 옷장을 옮겨 골라 띄운 채 '완료'로 저장하고 나오면 3D 그리기에 편집 모습을 넘기지 않는다(저장 본문은 그대로)", async () => {
    await startEditing();
    await pressAndMove({ floor: AT.wardrobe }, "wardrobe", { floor: { x: 4.5, z: 6.5 } });
    await release();
    expectLifted("wardrobe");

    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expect(sortedItems(jest.mocked(saveLobbyLayout).mock.calls[0][0])).toEqual(sortedItems(W_CENTER));
    expectNoEdit();
  });
});

// ---------- 바뀔 동작: 고른 장소 가구의 구역·서는 자리(결정 03의 1·3) ----------

describe("[spec] 065 결정 03 Z: 고른 장소 가구의 구역과 서는 자리를 넘긴다", () => {
  test.each([
    ["Z1 게시판", back(1.8) as Spot, "board" as PieceId, ZONE_BOARD_P0],
    ["Z2 창문(생각 창가)", back(4.8) as Spot, "window" as PieceId, ZONE_WINDOW_P0],
    ["Z3 일기 책상(의자를 눌러도 책상으로 골라진다)", { floor: AT.desk } as Spot, "desk" as PieceId, ZONE_DESK_P0],
    ["Z4 책장", { floor: AT.bookcase } as Spot, "bookcase" as PieceId, ZONE_BOOKCASE_P0]
  ])("[spec] %s를 톡해 고르면 처음 배치에서의 그 장소 구역(반지름 1칸)과 서는 자리를 넘긴다", async (_label, spot, piece, zone) => {
    await startEditing();

    await tap(spot, piece);

    expectZone(zone);
  });

  test("[spec] Z5 창문 앞 바닥 띠 (4.8, 0.5)로 창문을 고르면 창가 구역을 넘긴다", async () => {
    await startEditing();

    await tap({ floor: WINDOW_STRIP });

    expectZone(ZONE_WINDOW_P0);
  });

  test.each([
    ["Z6 옷장", AT.wardrobe, "wardrobe" as PieceId],
    ["Z7 깔개", AT.rug, "rug" as PieceId]
  ])("[spec] %s처럼 장소가 없는 가구를 고르면 구역이 없다", async (_label, at, piece) => {
    await startEditing();

    await tap({ floor: at }, piece);

    expect(floorMarks().map((m) => m.piece)).toEqual([piece]);
    expectZone(null);
  });

  test("[spec] Z8 편집 모드에 막 들어가 아무것도 고르지 않았으면 구역이 없다", async () => {
    await startEditing();

    expectZone(null);
  });

  test("[spec] Z9 책상을 골라 둔 뒤 빈 바닥을 톡해 고르기가 풀리면 구역이 사라진다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectZone(ZONE_DESK_P0);

    await tap({ floor: EMPTY_FLOOR });

    expectZone(null);
  });

  test("[spec] Z10 책상을 골라 둔 뒤 옷장을 고르면 책상 구역이 사라지고 구역이 없다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectZone(ZONE_DESK_P0);

    await tap({ floor: AT.wardrobe }, "wardrobe");

    expectZone(null);
  });

  test("[spec] Z11 게시판을 골라 둔 뒤 책장을 고르면 책장 구역으로 바뀐다", async () => {
    await startEditing();
    await tap(back(1.8), "board");
    expectZone(ZONE_BOARD_P0);

    await tap({ floor: AT.bookcase }, "bookcase");

    expectZone(ZONE_BOOKCASE_P0);
  });

  test("[spec] Z12 책상을 (2.5, 5.5)로 끄는 동안 구역이 책상을 따라가 서는 자리 (2.5, 6.75)이고, 놓은 뒤에도 그 자리다", async () => {
    await startEditing();

    await pressAndMove({ floor: AT.desk }, "desk", { floor: { x: 2.5, z: 5.5 } });
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withFloor(P0, "desk", 2.5, 5.5, 0)));
    const moved: Zone = { place: "desk", center: { x: 2.5, z: 6.75 }, reach: null, radius: 1, approach: [{ x: 2.5, z: 6.75 }] };
    expectZone(moved);

    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withFloor(P0, "desk", 2.5, 5.5, 0)));
    expectZone(moved);
  });

  test("[spec] Z13 창문을 뒷벽 5.6으로 끌면 끄는 동안과 뒷벽 5.5에 놓은 뒤 창가 구역이 창문을 따라간다", async () => {
    await startEditing();
    const moved: Zone = { place: "window", center: { x: 5.5, z: 1.55 }, reach: { x: 5.5, z: 0 }, radius: 1, approach: [{ x: 5.2, z: 1.55 }, { x: 5.8, z: 1.55 }] };

    await pressAndMove(back(4.8), "window", back(5.6));
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withWall(P0, "window", back(5.5))));
    expectZone(moved);
    await release();

    expectZone(moved);
  });

  test("[spec] Z14 책장을 놓을 수 없는 책상 위 (1.5, 5.5)로 끄는 동안은 구역이 따라가고, 놓아 제자리로 돌아가면 구역도 돌아간다", async () => {
    await startEditing();

    await pressAndMove({ floor: AT.bookcase }, "bookcase", { floor: AT.desk });
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withFloor(P0, "bookcase", 1.5, 5.5, 1)));
    // 책장 (1.5, 5.5) 오른쪽 보기 → 서는 자리 (2.4, 5.5), 바라볼 지점 (1.0, 5.5)
    expectZone({ place: "bookcase", center: { x: 2.4, z: 5.5 }, reach: { x: 1, z: 5.5 }, radius: 1, approach: [{ x: 2.4, z: 5.5 }] });

    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
    expectZone(ZONE_BOOKCASE_P0);
  });

  test("[spec] Z15 빨간 책장: 골라진 동안은 돌린 책장의 구역을 넘기고, 고르기가 풀린 채 남으면 구역이 없다", async () => {
    await startEditing();
    await tap({ floor: AT.bookcase }, "bookcase");
    await fireEvent.press(rotateButton()!);
    await flushAsync();
    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
    // 책장 (0.5, 2.5) 뒤 보기 → 서는 자리 (0.5, 1.6), 바라볼 지점 (0.5, 3.0)
    expectZone({ place: "bookcase", center: { x: 0.5, z: 1.6 }, reach: { x: 0.5, z: 3 }, radius: 1, approach: [{ x: 0.5, z: 1.6 }] });

    await tap({ floor: EMPTY_FLOOR });

    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
    expectZone(null);
  });
});

// ---------- 그대로 둘 동작(명세 "그대로여야 할 동작") ----------

describe("[spec] 065 그대로 둘 동작", () => {
  test("[spec] K1 편집 모드 밖(로비)에서는 3D 그리기에 편집 모습을 넘기지 않는다", async () => {
    await render(<HomeScreen />);
    await flushAsync();

    expectNoEdit();
  });

  test("[spec] K2 편집 모드에 막 들어가 아무것도 고르지 않았으면 뜨는 가구가 없고 끄는 중도 아니다", async () => {
    await startEditing();

    expectLifted(null);
    expect(canvas().edit!.dragging).toBe(false);
    expect(floorMarks()).toEqual([]);
    expect(rotateButton()).toBeNull();
  });

  test("[spec] K3 책상을 끄는 동안은 끄는 중이고 돌리기 버튼이 숨으며(바로 읽는 값도), 놓으면 끄는 중이 아니고 돌리기 버튼이 다시 보인다", async () => {
    await startEditing();

    await pressAndMove({ floor: AT.desk }, "desk", { floor: { x: 2.5, z: 5.5 } });
    expect(canvas().edit!.dragging).toBe(true);
    expect(canvas().edit!.handle).toBeNull();
    expect(canvas().editLive!.current!.dragging).toBe(true);
    expect(canvas().editLive!.current!.handle).toBeNull();
    expect(rotateButton()).toBeNull();

    await release();

    expect(canvas().edit!.dragging).toBe(false);
    expect(canvas().edit!.handle).toBe("desk");
    expect(canvas().editLive!.current!.handle).toBe("desk");
    expect(rotateButton()).not.toBeNull();
  });
});
