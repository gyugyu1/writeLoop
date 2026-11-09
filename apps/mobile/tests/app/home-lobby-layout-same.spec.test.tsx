// [spec] qa 테스트(작업 064-② 계정 저장, 모바일): 결정 14(12 검증의 확실한 문제 1을 고친 것을 지킨다).
// 기대값은 결정(private 작업 폴더 064/03-계정-저장/14-main-decision.md)에서만 가져온다: 저장한 배치(처음 배치가 아닌 것)를 받은 계정이
// 홈에 다시 들어와 같은 값의 배치를 새 객체로 다시 받으면, 걷던 라이트루프는 계속 걸어 목적지에 닿고, '들어가기' 동작이 끊기지 않고, 방을 다시 그리지 않는다.
// 결정 14: 고친 뒤(498892e 뒤)에는 통과, 고치기 전(e21a60a)에는 실패가 맞다.
// "방을 다시 그린다"는 3D 그리기(lobby3d-canvas)가 받는 layoutKey가 바뀌는 것으로 본다(바뀌면 가구·이름표·창문 빛을 다시 만든다. 1ebc54d의 속성 설명).
// 가짜·도우미는 앞 qa 테스트(home-lobby-layout-decisions.spec.test.tsx)와 같다. 그 파일은 커밋됐으므로 고치지 않고 이 파일에 옮겨 적었다.
// 066-①(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서 배치 데이터와 저장 본문이 v2(version 2, 가구 인스턴스 목록)로 바뀌어,
// 명세의 "고칠 기존 테스트"대로 확인하는 뜻·기대 동작은 그대로 두고 배치 모양만 v2로 고쳤다. 배치 값(자리·방향·벽)은 그대로다.
// 067(private 작업 폴더 067/01-main-spec.md)에서 책상 장소의 바라볼 지점이 (1.25, 5.5) → (1.5, 5.5)로 옮겨져, 명세의 "고칠 기존 테스트"대로
// 처음 배치 장소 값(P0_PLACES)의 책상 바라볼 지점만 고쳤다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
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

const P0: LobbyLayout = v2(
  {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 2.5, facing: 1 },
    wardrobe: { x: 7.5, z: 3.5, facing: 3 },
    rug: { x: 4.6, z: 7.2, facing: 0 }
  },
  { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } }
);
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

const fetchMock = jest.fn<Promise<FakeResponse>, [string, RequestInit?]>();
const originalFetch = globalThis.fetch;

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

function snapshot() {
  return canvas().sim.snapshot(Date.now());
}

// ---------- 결정 14: 같은 값의 배치를 새 객체로 다시 받을 때 ----------

/** 서버에서 받을 때마다 새 객체가 되듯, 같은 값의 새 객체를 만든다. */
function sameValueCopy(layout: LobbyLayout): LobbyLayout {
  return JSON.parse(JSON.stringify(layout));
}

/** 3D 그리기가 받은 배치 표시 수. 바뀌면 3D가 가구·이름표·창문 빛을 다시 만든다(lobby3d-canvas의 layoutKey). */
function canvasLayoutKey() {
  return canvas().layoutKey ?? 0;
}

/** '들어가기' 동작이 끝나 무언가 일어날 때까지(최대 3초) 0.05초씩 프레임과 시계를 진행한다. */
async function waitMotion(done: () => boolean) {
  for (let elapsed = 0; elapsed < 3 && !done(); elapsed += 0.05) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

function pushedTo(): unknown[] {
  return jest.mocked(router.push).mock.calls.map(([href]) => href);
}

describe("결정 14. 저장한 배치를 받은 계정이 홈에 다시 들어와 같은 값의 배치를 새 객체로 다시 받으면", () => {
  test("[spec] 14-1 걷던 라이트루프는 멈추지 않고 계속 걸어 게시판에 닿고, 방을 다시 그리지 않는다", async () => {
    const again = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(sameValueCopy(L1)).mockReturnValueOnce(again.promise);
    await renderHome();
    expectApplied(L1, L1_SOLID, L1_PLACES);
    const keyAfterFirst = canvasLayoutKey();

    await leaveAndReturnHome();
    expect(getLobbyLayout).toHaveBeenCalledTimes(2);

    await tap({ point: null, mark: "board" });
    await frames(3);
    expect(snapshot().moving).toBe(true);

    await act(async () => {
      again.resolve(sameValueCopy(L1));
    });
    await flushAsync();

    expect(snapshot().moving).toBe(true);
    await walkUntilArrived("board");
    expect(canvasLayoutKey()).toBe(keyAfterFirst);
    expectApplied(L1, L1_SOLID, L1_PLACES);
  });

  test("[spec] 14-2 책장에서 '들어가기' → 기록 화면 → 돌아와 책을 다시 꽂는 동작 중에 같은 배치를 받아도 동작이 끊기지 않고 끝까지 이어지며, 방을 다시 그리지 않는다", async () => {
    jest.mocked(router.push).mockClear();
    const again = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(sameValueCopy(L1)).mockReturnValueOnce(again.promise);
    await renderHome();
    expectApplied(L1, L1_SOLID, L1_PLACES);
    const keyAfterFirst = canvasLayoutKey();

    await tap({ point: null, mark: "bookcase" });
    await walkUntilArrived("bookcase");
    await frames(5);
    await pressEnter("bookcase");
    await waitMotion(() => pushedTo().length > 0);
    expect(pushedTo()).toEqual(["/records"]);
    expect(snapshot().scene?.phase).toBe("hold");

    // 기록 화면에 갔다가 돌아온다. 돌아오면 책을 다시 꽂는 동작("out")이 시작되고, 배치를 다시 불러온다.
    await setFocused(false);
    await setFocused(true);
    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    expect(snapshot().scene?.phase).toBe("out");
    await frames(2);
    const tBefore = snapshot().scene?.t ?? -1;

    await act(async () => {
      again.resolve(sameValueCopy(L1));
    });
    await flushAsync();

    expect(snapshot().scene?.phase).toBe("out");
    expect(snapshot().scene?.mark).toBe("bookcase");
    await frames(1);
    expect(snapshot().scene?.t ?? -1).toBeGreaterThan(tBefore);

    // 동작은 스스로 끝난다(3초 안)
    for (let index = 0; index < 60 && snapshot().scene !== null; index += 1) {
      await frames(1);
    }
    expect(snapshot().scene).toBeNull();
    expect(canvasLayoutKey()).toBe(keyAfterFirst);
  });

  test("[spec] 14-3 가만히 서 있을 때 같은 배치를 두 번 더 받아도 방을 다시 그리지 않고 자리도 그대로다", async () => {
    jest
      .mocked(getLobbyLayout)
      .mockResolvedValueOnce(sameValueCopy(L1))
      .mockResolvedValueOnce(sameValueCopy(L1))
      .mockResolvedValueOnce(sameValueCopy(L1));
    await renderHome();
    expectApplied(L1, L1_SOLID, L1_PLACES);
    const keyAfterFirst = canvasLayoutKey();
    const before = position();

    await leaveAndReturnHome();
    await leaveAndReturnHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(3);
    expect(canvasLayoutKey()).toBe(keyAfterFirst);
    expect(position()).toEqual(before);
    expectApplied(L1, L1_SOLID, L1_PLACES);
  });
});
