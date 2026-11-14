// [spec] qa 테스트(작업 064-② 계정 저장, 모바일): 결정 08의 1(결정 04에서 정한 동작 다섯)과 2(로그인 만료 401이면 처음 배치).
// 기대값은 결정(private 작업 폴더 064/03-계정-저장/04-main-decision.md의 2·3, 08-main-decision.md의 1·2)과 시나리오 03의 배치 값에서만 가져온다.
// 결정 08의 1: 모두 이미 구현한 동작을 지키는 테스트라 테스트 커밋 시점(구현 1ebc54d 뒤)에 통과가 맞다.
// 가짜·도우미는 앞 qa 테스트(home-lobby-layout-load.spec.test.tsx)와 같다. 그 파일은 커밋됐으므로 고치지 않고 이 파일에 옮겨 적었다.
// 066-①(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서 배치 데이터와 저장 본문이 v2(version 2, 가구 인스턴스 목록)로 바뀌어,
// 명세의 "고칠 기존 테스트"대로 확인하는 뜻·기대 동작은 그대로 두고 배치 모양만 v2로 고쳤다. 배치 값(자리·방향·벽)은 그대로다.
// 067(private 작업 폴더 067/01-main-spec.md)에서 책상 장소의 바라볼 지점이 (1.25, 5.5) → (1.5, 5.5)로 옮겨져, 명세의 "고칠 기존 테스트"대로
// 처음 배치 장소 값(P0_PLACES)의 책상 바라볼 지점만 고쳤다.
// 작업 079 03 결정(사용자 2026-11-11 "가짜 그림판이 신호를 보내게"): 방이 처음 보이기 전에는 이름표·장소 안내·말풍선을 숨기므로,
// 가짜 3D 그림판이 처음 그려진 뒤 '방이 보였다'(onRoomShown)를 한 번 부르게 준비만 바꿨다. 단언·기대값·입력은 그대로다.
// 093(창문 붙박이) 07-main-decision.md(사용자 "qa가 창문 기대값만 4.8로", private 작업 폴더 093-2026-11-14-창문-붙박이, 보고 12-qa-tests.md):
// 앱이 불러온 배치의 창문은 늘 뒷벽 4.8이라, L1·L3을 받은 뒤의 기대값만 창문을 뒷벽 4.8로 바꿨다(L1_SEEN·L3_SEEN·L1_PLACES_SEEN·L3_PLACES_SEEN).
// 받는 배치(입력)와 다른 가구·걷기·동작의 기대값은 그대로다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AppState } from "react-native";
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
import {
  MARKS,
  SOLID_TILES,
  activeLobbyLayout,
  applyLobbyLayout,
  findPath,
  isFree,
  type FloorPoint,
  type MarkId
} from "@/lib/lobby3d/engine";
import { currentFurnitureLayout, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
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
  // 처음 그려진 뒤 '방이 보였다'를 한 번 알린다(작업 079 03 결정)
  function MockLobby3dCanvas(props: Lobby3dCanvasProps) {
    mockCanvas.props = props;
    const onRoomShown = (props as Lobby3dCanvasProps & { onRoomShown?: () => void }).onRoomShown;
    const roomShownSent = React.useRef(false);
    React.useEffect(() => {
      if (roomShownSent.current || !onRoomShown) return;
      roomShownSent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
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

/** 진짜 불러오기 함수(api.ts). 서버 응답 모양을 거쳐야 하는 시나리오에서 부른다. */
const actualApi = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");

// ---------- 시나리오의 배치 ----------

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

type PlaceId = "board" | "window" | "desk" | "bookcase";
type PlaceValues = Record<PlaceId, { approach: FloorPoint[]; faceTo: FloorPoint }>;

const P0_FLOOR: Record<string, FloorSpot> = {
  desk: { x: 1.5, z: 5.5, facing: 0 },
  bookcase: { x: 0.5, z: 2.5, facing: 1 },
  wardrobe: { x: 7.5, z: 3.5, facing: 3 },
  rug: { x: 4.6, z: 7.2, facing: 0 }
};
const P0_WALL: Record<string, WallSpot> = { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } };
// 066-④ 결정 2: 처음 배치에 스탠드(책상 왼쪽 자리)가 더해져, 처음 배치 P0에 스탠드를 넣는다(그 밖의 값은 그대로).
const P0: LobbyLayout = { items: [...v2(P0_FLOOR, P0_WALL).items, { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as LayoutItem] };
const P0_SOLID = ["0,2", "0,5", "1,5", "2,5", "7,3"];
const P0_PLACES: PlaceValues = {
  board: { approach: [{ x: 1.6, z: 1.3 }, { x: 2.2, z: 1.3 }], faceTo: { x: 1.8, z: 0 } },
  window: { approach: [{ x: 4.5, z: 1.55 }, { x: 5.1, z: 1.55 }], faceTo: { x: 4.8, z: 0 } },
  desk: { approach: [{ x: 1.5, z: 6.75 }], faceTo: { x: 1.5, z: 5.5 } },
  bookcase: { approach: [{ x: 1.4, z: 2.5 }], faceTo: { x: 0, z: 2.5 } }
};

const L1: LobbyLayout = v2(
  {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 4.5, facing: 1 },
    wardrobe: { x: 7.5, z: 6.5, facing: 3 },
    rug: { x: 3.0, z: 8.0, facing: 1 }
  },
  { board: { wall: "back", along: 2.0 }, window: { wall: "back", along: 5.6 } }
);
const L1_SOLID = ["0,4", "0,5", "1,5", "2,5", "7,6"];
const L1_PLACES: PlaceValues = {
  board: { approach: [{ x: 1.8, z: 1.3 }, { x: 2.4, z: 1.3 }], faceTo: { x: 2.0, z: 0 } },
  window: { approach: [{ x: 5.3, z: 1.55 }, { x: 5.9, z: 1.55 }], faceTo: { x: 5.6, z: 0 } },
  desk: P0_PLACES.desk,
  bookcase: { approach: [{ x: 1.4, z: 4.5 }], faceTo: { x: 0, z: 4.5 } }
};

const L3: LobbyLayout = v2(P0_FLOOR, { board: { wall: "right", along: 6.0 }, window: { wall: "left", along: 8.0 } });
const L3_PLACES: PlaceValues = {
  board: { approach: [{ x: 6.7, z: 5.8 }, { x: 6.7, z: 6.4 }], faceTo: { x: 8, z: 6.0 } },
  window: { approach: [{ x: 1.55, z: 8.3 }, { x: 1.55, z: 7.7 }], faceTo: { x: 0, z: 8.0 } },
  desk: P0_PLACES.desk,
  bookcase: P0_PLACES.bookcase
};

/** 093 07 결정: 앱이 불러온 배치의 창문은 늘 뒷벽 4.8이다. 창문이 다른 자리인 입력의 기대값에만 쓴다. */
function windowFixed(layout: LobbyLayout): LobbyLayout {
  return { ...layout, items: layout.items.map((item) => (item.type === "window" ? { id: item.id, type: item.type, wall: P0_WALL.window } : item)) };
}
/** 093: L1·L3을 받은 뒤 보이는 배치와 장소(창문만 뒷벽 4.8, 창가 장소는 처음 배치와 같다). */
const L1_SEEN = windowFixed(L1);
const L3_SEEN = windowFixed(L3);
const L1_PLACES_SEEN: PlaceValues = { ...L1_PLACES, window: P0_PLACES.window };
const L3_PLACES_SEEN: PlaceValues = { ...L3_PLACES, window: P0_PLACES.window };

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

// ---------- 서버 응답(전역 fetch 가짜) ----------

type FakeResponse = { ok: boolean; status: number; headers: Headers; json: () => Promise<unknown>; text: () => Promise<string> };

function respond(status: number, body?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => {
      if (body === undefined) throw new SyntaxError("no body");
      return JSON.parse(JSON.stringify(body));
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body))
  };
}

const fetchMock = jest.fn<Promise<FakeResponse>, [string, RequestInit?]>();
const originalFetch = globalThis.fetch;

/** 지금 버전(066-① 명세 2: version 2)을 붙인 본문. */
function payload(layout: LobbyLayout): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ version: 2, ...layout }));
}

/** 불러오기를 진짜 함수로 돌리고, 서버가 이 응답을 주게 한다. */
function serverRespondsWith(make: (url: string, init?: RequestInit) => Promise<FakeResponse>) {
  fetchMock.mockImplementation(make);
  jest.mocked(getLobbyLayout).mockImplementation(() => actualApi.getLobbyLayout());
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

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function position(): FloorPoint {
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

async function tap(hit: { point: FloorPoint | null; mark: MarkId | null }) {
  await act(async () => {
    canvas().onPointer("down", { ...hit, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", { ...hit, onCharacter: false }, 200, 300);
  });
}

async function walkUntilArrived(mark: MarkId) {
  for (let index = 0; index < 400 && canvas().sim.arrived !== mark; index += 1) {
    await frames(1);
  }
  expect(canvas().sim.arrived).toBe(mark);
}

function sortedSolid() {
  return [...SOLID_TILES].sort();
}

/** "방에 적용됨": 배치·막힌 칸·장소 넷의 서는 자리·바라볼 지점·3D 가구 자리가 그 배치를 따른다. */
function expectApplied(layout: LobbyLayout, solid: string[], places: PlaceValues) {
  expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(layout));
  expect(sortedSolid()).toEqual([...solid].sort());
  for (const id of Object.keys(places) as PlaceId[]) {
    expect({ id, approach: MARKS[id].approach, faceTo: MARKS[id].faceTo }).toEqual({ id, ...places[id] });
  }
  expect(MARKS.door.approach).toEqual([{ x: 4.0, z: 10.5 }]);
  expect(currentFurnitureLayout()).toEqual(furniturePlacements(layout));
}

/** "처음 배치로 보임". */
function expectDefaultRoom() {
  expectApplied(P0, P0_SOLID, P0_PLACES);
  expect(activeLobbyLayout()).toEqual(DEFAULT_LOBBY_LAYOUT);
}

/** 마지막 불러오기가 이미 끝났는지(응답을 받은 뒤의 모습을 보는지) 확인한다. */
async function expectLastLoad(outcome: "failed" | "none") {
  const results = jest.mocked(getLobbyLayout).mock.results;
  expect(results.length).toBeGreaterThan(0);
  const last = results[results.length - 1].value as Promise<unknown>;
  if (outcome === "failed") await expect(last).rejects.toBeInstanceOf(Error);
  else await expect(last).resolves.toBeNull();
}

async function leaveAndReturnHome() {
  await setFocused(false);
  await setFocused(true);
}

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  fetchMock.mockReset().mockRejectedValue(new TypeError("fetch는 이 테스트에서 쓰지 않는다"));
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockResolvedValue(P0);
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
  jest.useRealTimers();
});

// ---------- 결정 08에서 더 쓰는 배치 ----------

/** 처음 자리 (4.2, 6.2)를 막고, 그 왼쪽 칸도 막는 배치(가장 가까운 설 수 있는 칸이 하나로 정해진다). P0에서 옷장 (4.5, 6.5, 0), 책장 (3.5, 6.5, 1). */
const L6: LobbyLayout = v2({ ...P0_FLOOR, wardrobe: { x: 4.5, z: 6.5, facing: 0 }, bookcase: { x: 3.5, z: 6.5, facing: 1 } }, P0_WALL);
const L6_SOLID = ["0,5", "1,5", "2,5", "3,6", "4,6"];
/** 가구가 겹치는 배치: P0에서 책장을 책상과 같은 자리 (1.5, 5.5, 0)로. */
const OVERLAP: LobbyLayout = v2({ ...P0_FLOOR, bookcase: { x: 1.5, z: 5.5, facing: 0 } }, P0_WALL);
const OVERLAP_SOLID = ["0,5", "1,5", "2,5", "7,3"];
/** 길을 막는 배치: P0에서 옷장을 책장 서는 자리 (1.4, 2.5)의 칸 "1,2"로 (1.5, 2.5, 3). */
const PATH_BLOCKED: LobbyLayout = v2({ ...P0_FLOOR, wardrobe: { x: 1.5, z: 2.5, facing: 3 } }, P0_WALL);
const PATH_BLOCKED_SOLID = ["0,2", "1,2", "0,5", "1,5", "2,5"];

// ---------- 더 쓰는 도우미 ----------

function bubbleOf(line: string) {
  let node = screen.getByText(line).parent!;
  while (node.props.pointerEvents === "none") node = node.parent!;
  return node;
}

/** 도착한 장소의 말풍선 버튼('들어가기')을 누른다. */
async function pressEnter(mark: MarkId) {
  await fireEvent.press(within(bubbleOf(MARKS[mark].prompt)).getByRole("button", { name: MARKS[mark].buttonLabel }));
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

function timeoutResponse(...args: [string, RequestInit?]) {
  return new Promise<FakeResponse>((_resolve, reject) => {
    args[1]?.signal?.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });
}

function snapshot() {
  return canvas().sim.snapshot(Date.now());
}

// ---------- 결정 08의 1-1: 이미 받은 배치는 실패해도 그대로 ----------

describe("결정 08 1-1. 이 계정의 배치를 이미 받았으면 다음 불러오기가 실패해도 그대로 둔다", () => {
  test("[spec] 1-1 (a) L1을 받은 뒤 다시 들어왔을 때 500이면 L1이 그대로다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(L1);
    await renderHome();
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);

    serverRespondsWith(async () => respond(500, { message: "오류" }));
    await leaveAndReturnHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    await expectLastLoad("failed");
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);
  });

  test("[spec] 1-1 (b) L1을 받은 뒤 다시 들어왔을 때 네트워크가 실패하면 L1이 그대로다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(L1);
    await renderHome();

    serverRespondsWith(async () => {
      throw new TypeError("Network request failed");
    });
    await leaveAndReturnHome();
    await advance(400);
    await advance(900);

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    await expectLastLoad("failed");
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);
  });

  test("[spec] 1-1 (c) L1을 받은 뒤 다시 들어왔을 때 시간 초과면 L1이 그대로다(결정 08의 2: 시간 초과도 실패)", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(L1);
    await renderHome();

    serverRespondsWith(timeoutResponse);
    await leaveAndReturnHome();
    for (let elapsed = 0; elapsed < 30_000; elapsed += 1000) {
      await advance(1000);
    }

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    await expectLastLoad("failed");
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);
  });
});

// ---------- 결정 08의 2: 로그인 만료(401)면 처음 배치 ----------

describe("결정 08 2. 로그인이 만료돼 불러오기가 401이면 받은 배치가 있어도 처음 배치로 바꾼다", () => {
  test("[spec] 2 L1을 받은 뒤 다시 들어왔을 때 401이면 처음 배치로 보인다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(L1);
    await renderHome();
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);

    serverRespondsWith(async () => respond(401, { message: "로그인이 필요해요." }));
    await leaveAndReturnHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    await expectLastLoad("none");
    expectDefaultRoom();
  });
});

// ---------- 결정 08의 1-2: 앱 복귀로는 다시 불러오지 않는다 ----------

describe("결정 08 1-2. 배경에 두었던 앱으로 돌아오는 것으로는 다시 불러오지 않는다", () => {
  test("[spec] 1-2 홈 포커스는 그대로 두고 앱을 배경으로 보냈다가 앞으로 돌아와도 불러오기는 1번이고 L1이 그대로다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(L1).mockResolvedValue(L3);
    const callIndex = jest.mocked(AppState.addEventListener).mock.calls.length;
    await renderHome();
    const listeners = appStateListenersSince(callIndex);
    expect(listeners.length).toBeGreaterThan(0);

    await sendAppState(listeners, "background");
    await sendAppState(listeners, "active");

    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);
  });
});

// ---------- 결정 08의 1-3: 들어올 때마다 다시 불러와 적용 ----------

describe("결정 08 1-3. 성공한 뒤에도 홈에 들어올 때마다 다시 불러오고 새로 받은 배치를 적용한다", () => {
  test("[spec] 1-3 L1 → 다시 들어와 L3 → 다시 들어와 L1 → 다시 들어와 없음(처음 배치)", async () => {
    jest
      .mocked(getLobbyLayout)
      .mockResolvedValueOnce(L1)
      .mockResolvedValueOnce(L3)
      .mockResolvedValueOnce(L1)
      .mockResolvedValueOnce(null);

    await renderHome();
    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);

    await leaveAndReturnHome();
    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    expectApplied(L3_SEEN, P0_SOLID, L3_PLACES_SEEN);

    await leaveAndReturnHome();
    expect(getLobbyLayout).toHaveBeenCalledTimes(3);
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);

    await leaveAndReturnHome();
    expect(getLobbyLayout).toHaveBeenCalledTimes(4);
    await expectLastLoad("none");
    expectDefaultRoom();
  });
});

// ---------- 결정 08의 1-4: 적용할 때 멈추고, 막혔으면 가장 가까운 칸으로 ----------

describe("결정 08 1-4. 배치를 적용할 때 걷기·들어가기 동작을 멈추고, 서 있던 자리가 막혔으면 가장 가까운 설 수 있는 칸으로 옮긴다", () => {
  test("[spec] 1-4 (a) 게시판으로 걷는 중에 L1이 적용되면 그 자리에서 멈춘다(더 걷지 않고 도착하지 않는다)", async () => {
    const pending = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReturnValueOnce(pending.promise);
    await renderHome();

    await tap({ point: null, mark: "board" });
    await frames(3);
    expect(snapshot().moving).toBe(true);
    const before = position();

    await act(async () => {
      pending.resolve(L1);
    });
    await flushAsync();
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);

    await frames(40);
    expect(position()).toEqual(before);
    expect(snapshot().moving).toBe(false);
    expect(canvas().sim.arrived).toBeNull();
  });

  test("[spec] 1-4 (b) 게시판에서 '들어가기' 동작 중에 L1이 적용되면 동작을 멈추고 다시 시작하지 않는다", async () => {
    const pending = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReturnValueOnce(pending.promise);
    await renderHome();

    await tap({ point: null, mark: "board" });
    await walkUntilArrived("board");
    await pressEnter("board");
    await frames(2);
    expect(snapshot().scene).not.toBeNull();

    await act(async () => {
      pending.resolve(L1);
    });
    await flushAsync();
    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);
    expect(snapshot().scene).toBeNull();

    for (let index = 0; index < 60; index += 1) {
      await frames(1);
      expect(snapshot().scene).toBeNull();
    }
  });

  test("[spec] 1-4 (c) 서 있던 자리 (4.2, 6.2)를 막는 L6이 적용되면 가장 가까운 설 수 있는 칸 \"4,5\"로 옮긴다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L6);

    await renderHome();

    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(L6));
    expect([...SOLID_TILES].sort()).toEqual([...L6_SOLID].sort());
    expect(isFree(4.2, 6.2)).toBe(false);
    const at = position();
    expect(`${Math.floor(at.x)},${Math.floor(at.z)}`).toBe("4,5");
    expect(isFree(at.x, at.z)).toBe(true);
  });

  test("[spec] 1-4 (d) 서 있던 자리를 막지 않는 L1이 적용되면 자리를 옮기지 않는다(4.2, 6.2)", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L1);

    await renderHome();

    expectApplied(L1_SEEN, L1_SOLID, L1_PLACES_SEEN);
    expect(position()).toEqual({ x: 4.2, z: 6.2 });
  });
});

// ---------- 결정 08의 1-5: 겹치거나 길을 막아도 모양이 맞으면 적용 ----------

describe("결정 08 1-5. 모양이 맞으면 가구가 겹치거나 길을 막는 배치도 적용한다", () => {
  test("[spec] 1-5 (a) 책장이 책상과 겹치는 배치(서버 본문)를 받으면 그대로 적용한다", async () => {
    serverRespondsWith(async () => respond(200, payload(OVERLAP)));

    await renderHome();

    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(OVERLAP));
    expect([...SOLID_TILES].sort()).toEqual([...OVERLAP_SOLID].sort());
    expect(MARKS.bookcase.approach).toEqual([{ x: 1.5, z: 6.4 }]);
    expect(currentFurnitureLayout()).toEqual(furniturePlacements(OVERLAP));
  });

  test("[spec] 1-5 (b) 옷장이 책장 서는 자리를 막는 배치(서버 본문)를 받으면 그대로 적용하고, 책장으로 가는 길은 없다", async () => {
    serverRespondsWith(async () => respond(200, payload(PATH_BLOCKED)));

    await renderHome();

    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(PATH_BLOCKED));
    expect([...SOLID_TILES].sort()).toEqual([...PATH_BLOCKED_SOLID].sort());
    expect(MARKS.bookcase.approach).toEqual([{ x: 1.4, z: 2.5 }]);
    expect(findPath(position(), MARKS.bookcase.approach)).toBeNull();
    expect(currentFurnitureLayout()).toEqual(furniturePlacements(PATH_BLOCKED));
  });
});
