// [spec] qa 테스트(작업 065 결정 19, 모바일): 홈 '꾸미기'에서 고른 가구를 다시 톡하면 고르기가 풀려 내려앉고,
// 끈 가구가 끌기 전 자리에서 움직이지 않았으면 놓을 수 없는 자리여도 알리지 않는지.
// 기대값은 결정(private 작업 폴더 065/19-main-decision.md의 1·2·3, 14-main-decision.md의 3, 09-main-decision.md의 1)과
// 064 ③ 명세의 글(빨간 가구 안내)에서만 가져온다. 구현 코드는 부르는 방법(3D 그리기가 받는 edit·editLive의 lifted·marks·
// wallMarks·zone, 누르기 결과의 piece·point·wall, 돌리기 버튼의 접근성 이름 "돌리기")을 알려고만 읽었다.
// 가짜로 두는 것과 도우미는 065의 고르면 뜨기 테스트(home-lobby-edit-lift.spec.test.tsx)와 같다(그 파일에서 옮겨 왔다).
// 3D 그리기는 가짜라서, "의자를 톡하면 책상" 판정은 3D 그리기가 넘기는 piece "desk"로 대신한다(이 테스트로 보지 못한다).
// 066-①(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서 배치 데이터와 저장 본문이 v2(version 2, 가구 인스턴스 목록)로 바뀌어,
// 명세의 "고칠 기존 테스트"대로 확인하는 뜻·기대 동작은 그대로 두고 배치 모양만 v2로 고쳤다. 배치 값(자리·방향·벽)은 그대로다.
// 075(꾸미기: 들린 가구를 탭으로 옮기기) 명세의 "고칠 기존 테스트"로 K5를 새 동작으로 고쳤다(private 작업 폴더
// 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/01-main-spec.md, 보고 02-qa-tests.md): 가구가 골라져 있을 때 다른 가구를 톡하면
// 골라진 가구를 그리로 옮기려 하고, 둘 수 없으면 옮기지 않고 "여기에는 둘 수 없어요" 안내를 띄우며 탭한 가구는 골라지지 않는다.
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
// 066-④ 결정 2: 처음 배치에 스탠드(책상 왼쪽 자리)가 더해져, 처음 배치 P0에 스탠드를 넣는다(그 밖의 값은 그대로).
const P0: LobbyLayout = { items: [...v2(P0_FLOOR, P0_WALL).items, { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as LayoutItem] };

const back = (along: number): WallSpot => ({ wall: "back", along });

/** 각 바닥 가구 가운데(누를 곳). */
const AT = {
  desk: { x: 1.5, z: 5.5 },
  bookcase: { x: 0.5, z: 2.5 },
  wardrobe: { x: 7.5, z: 3.5 },
  rug: { x: 4.6, z: 7.2 }
} as const;
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

// ---------- 결정 19에 쓰는 글·배치·도우미 ----------

/** 결정 14의 3: 끈 가구를 놓을 수 없는 자리에서 떼 끌기 전 자리로 돌아갈 때의 알림. */
const CANNOT_PLACE = "여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요";
/** 064 ③ 명세: 빨간 가구가 있어 '완료'가 막힐 때의 안내. */
const RED_FINISH = "빨간 가구를 놓을 수 있는 자리로 옮기거나 돌려 주세요";
/** 064 ③의 XB: 불러온 배치 자체가 놓을 수 없는 배치(옷장이 책상과 칸 1,5에서 겹침). */
const XB = withFloor(P0, "wardrobe", 1.5, 5.5, 3);
/** 책장을 한 번 돌린 배치(앞면이 벽을 봐 놓을 수 없음, 064 ③의 B2). */
const B2 = withFloor(P0, "bookcase", 0.5, 2.5, 2);

async function startEditingFrom(layout: LobbyLayout) {
  jest.mocked(getLobbyLayout).mockResolvedValue(layout);
  await render(<HomeScreen />);
  await flushAsync();
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
  expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(layout));
}

async function rotateOnce() {
  const button = rotateButton();
  expect(button).not.toBeNull();
  await fireEvent.press(button!);
  await flushAsync();
}

/** 책장을 골라 한 번 돌려 빨간 가구로 만든다(골라진 채). */
async function makeRedBookcaseSelected() {
  await tap({ floor: AT.bookcase }, "bookcase");
  await rotateOnce();
  expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(B2));
  expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
  expectLifted("bookcase");
}

/** 고르기가 풀린 모습: 뜨는 가구, 칸 칠·벽 칠(빨간 칸 빼고), 서는 자리, 돌리기 버튼이 없다. */
function expectNothingSelected(redMarks: { piece: PieceId; ok: boolean }[] = []) {
  expectLifted(null);
  expect(floorMarks()).toEqual(redMarks);
  expect(wallMarkPieces()).toEqual([]);
  expectZone(null);
  expect(rotateButton()).toBeNull();
}

// ---------- 바뀔 동작: 고른 가구를 다시 톡하면 내려놓는다(결정 19의 1) ----------

describe("[spec] 065 결정 19 N: 고른 가구를 다시 톡하면 고르기가 풀린다", () => {
  test("[spec] N1 고른 책상을 다시 톡하면 고르기가 풀려 내려앉고 칸 칠·서는 자리·돌리기 버튼이 사라진다. 한 번 더 톡하면 다시 골라진다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");
    expect(rotateButton()).not.toBeNull();

    await tap({ floor: AT.desk }, "desk");

    expectNothingSelected();
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");
  });

  test("[spec] N2 고른 책상의 칸 안 (2.6, 5.3)을 톡하면(떠 있는 모양을 맞히지 않아도) 다시 톡한 것이라 고르기가 풀린다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");

    await tap({ floor: { x: 2.6, z: 5.3 } });

    expectNothingSelected();
  });

  test("[spec] N3 고른 옷장을 다시 톡하면 고르기가 풀린다(장소 없는 가구)", async () => {
    await startEditing();
    await tap({ floor: AT.wardrobe }, "wardrobe");
    expectLifted("wardrobe");

    await tap({ floor: AT.wardrobe }, "wardrobe");

    expectNothingSelected();
  });

  test("[spec] N4 고른 창문을 다시 톡하면 고르기가 풀려 벽 칠·서는 자리가 사라진다", async () => {
    await startEditing();
    await tap(back(4.8), "window");
    expectLifted("window");
    expect(wallMarkPieces()).toEqual(["window"]);

    await tap(back(4.8), "window");

    expectNothingSelected();
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
  });

  test("[spec] N5 바닥 띠 (4.8, 0.5)로 고른 창문은 그 띠를 다시 톡하면 고르기가 풀린다", async () => {
    await startEditing();
    await tap({ floor: WINDOW_STRIP });
    expectLifted("window");

    await tap({ floor: WINDOW_STRIP });

    expectNothingSelected();
  });

  test("[spec] N6 바닥 띠 (4.8, 0.5)로 고른 창문은 창문 자체를 다시 톡해도 고르기가 풀린다", async () => {
    await startEditing();
    await tap({ floor: WINDOW_STRIP });
    expectLifted("window");

    await tap(back(4.8), "window");

    expectNothingSelected();
  });

  test("[spec] N7 골라진 빨간 책장을 다시 톡하면 고르기만 풀리고 빨간 칸은 남으며, 빨간 가구 규칙(완료 막힘, 다른 가구 안내)은 그대로다", async () => {
    await startEditing();
    await makeRedBookcaseSelected();

    await tap({ floor: AT.bookcase }, "bookcase");

    expectNothingSelected([{ piece: "bookcase", ok: false }]);
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(B2));
    await pressButton("완료");
    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(screen.getByText(RED_FINISH)).toBeTruthy();

    await tap({ floor: AT.desk }, "desk");
    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expectNothingSelected([{ piece: "bookcase", ok: false }]);
  });

  test("[spec] N8 골라진 빨간 책장의 칸 안 (0.8, 2.2)을 톡해도 고르기만 풀리고 빨간 칸은 남는다", async () => {
    await startEditing();
    await makeRedBookcaseSelected();

    await tap({ floor: { x: 0.8, z: 2.2 } });

    expectNothingSelected([{ piece: "bookcase", ok: false }]);
  });
});

// ---------- 바뀔 동작: 제자리면 알리지 않는다(결정 19의 2) ----------

describe("[spec] 065 결정 19 Q: 끌기 전 자리에서 움직이지 않았으면 놓을 수 없는 자리여도 알리지 않는다", () => {
  test("[spec] Q1 빨간 책장을 칸이 바뀌지 않게 조금 끌고 떼면 알림이 없고, 빨간 칸·자리는 그대로이며 고른 채다", async () => {
    await startEditing();
    await makeRedBookcaseSelected();

    await pressAndMove({ floor: AT.bookcase }, "bookcase", { floor: { x: 0.6, z: 2.6 } });
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(B2));
    await release();

    expect(screen.queryByText(CANNOT_PLACE)).toBeNull();
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(B2));
    expect(floorMarks()).toEqual([{ piece: "bookcase", ok: false }]);
    expectLifted("bookcase");
  });

  test("[spec] Q2 불러온 배치가 놓을 수 없는 배치(XB)에서 책장을 칸이 바뀌지 않게 조금 끌고 떼면 알림이 없고 배치는 XB 그대로다", async () => {
    await startEditingFrom(XB);

    await pressAndMove({ floor: AT.bookcase }, "bookcase", { floor: { x: 0.6, z: 2.6 } });
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(XB));
    await release();

    expect(screen.queryByText(CANNOT_PLACE)).toBeNull();
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(XB));
  });
});

// ---------- 지키는 동작(결정 19의 3: 지금도 통과가 맞다) ----------

describe("[spec] 065 결정 19 K: 지키는 동작", () => {
  test("[spec] K4 고른 책상을 눌러 (2.5, 5.5)로 끌면 끌리고, 놓은 뒤에도 고른 채 떠 있으며 돌리기 버튼이 보인다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");
    expectLifted("desk");

    await pressAndMove({ floor: AT.desk }, "desk", { floor: { x: 2.5, z: 5.5 } });
    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withFloor(P0, "desk", 2.5, 5.5, 0)));
    expectLifted("desk");
    expect(floorMarks()).toEqual([{ piece: "desk", ok: true }]);
    expect(rotateButton()).not.toBeNull();
  });

  // 075 고칠 기존 테스트: 옛 K5 "옷장으로 바뀐다"를 새 동작(책상을 옷장 자리로 옮기면 방 밖이라 안내, 책상이 골라진 채)으로 고쳤다
  test("[spec] K5 [075 바뀔] 책상을 고른 채 옷장을 톡하면 옷장은 골라지지 않고, 책상은 칸 맞춤 (7.5, 3.5)가 방 밖이라 옮기지 않고 안내하며 골라진 채다", async () => {
    await startEditing();
    await tap({ floor: AT.desk }, "desk");

    await tap({ floor: AT.wardrobe }, "wardrobe");

    expect(screen.getByText("여기에는 둘 수 없어요")).toBeTruthy();
    expectLifted("desk");
    expect(floorMarks()).toEqual([{ piece: "desk", ok: true }]);
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
  });

  test("[spec] K6 옷장을 놓을 수 없는 책상 위로 끌어 놓으면 원래 자리로 돌아가며 알림이 뜬다", async () => {
    await startEditing();

    await pressAndMove({ floor: AT.wardrobe }, "wardrobe", { floor: AT.desk });
    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
    expect(screen.getByText(CANNOT_PLACE)).toBeTruthy();
  });

  test("[spec] K7 빨간 책장을 책상 위로 끌어 놓으면 빨간 자리로 돌아가며 알림이 뜬다", async () => {
    await startEditing();
    await makeRedBookcaseSelected();

    await pressAndMove({ floor: AT.bookcase }, "bookcase", { floor: AT.desk });
    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(B2));
    expect(screen.getByText(CANNOT_PLACE)).toBeTruthy();
  });

  test("[spec] K8 창문을 책상 바로 위인 왼벽 5.0으로 끌어 놓으면 뒷벽 4.8로 돌아가며 알림이 뜬다(벽 가구)", async () => {
    await startEditing();

    await pressAndMove(back(4.8), "window", { wall: "left", along: 5.0 });
    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(withWall(P0, "window", { wall: "left", along: 5.0 })));
    await release();

    expect(sortedItems(canvas().edit!.layout)).toEqual(sortedItems(P0));
    expect(screen.getByText(CANNOT_PLACE)).toBeTruthy();
  });
});
