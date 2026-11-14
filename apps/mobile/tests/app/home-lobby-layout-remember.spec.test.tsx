// [spec] qa 테스트(작업 077, 기능 변경, 모바일): 홈 로비가 마지막으로 받은 가구 배치를 이 폰에 계정별로 기억해 두고,
// 다음에 로비를 열 때 처음부터 그 배치로 짓는지. 기대값은 명세(private 작업 폴더 077-2026-11-11-로비-마지막-배치-폰에-저장/01-main-spec.md)의
// "바뀌는 동작"·"그대로여야 할 동작"에서만 가져온다. 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(02-qa-tests.md의 분류와 같다).
//
// 앱을 껐다 켜는 것(다시 열기)은 홈을 내렸다가(unmount) 엔진의 배치를 처음 배치로 되돌린 뒤 다시 그리는 것으로 본다.
// 기기 저장소는 이 파일의 메모리 가짜(AsyncStorage와 expo-secure-store 둘 다)라 다시 열어도 남는다. 어디에 어떤 이름으로 적는지는 명세가
// 정하지 않아 보지 않고, "다시 열었을 때 어떤 배치로 짓는가"로 본다. 저장소 내용을 직접 보는 곳은 (1) 기억한 값이 저장소에 있는지(JSON 안에
// 그 배치의 가구 목록이 들어 있는지) (2) 모양이 맞지 않는 값으로 바꿔 넣는 것 두 곳뿐이다.
//
// "3D 방을 짓는다"는 3D 그리기(lobby3d-canvas, 가짜)가 그려지는 것으로 본다. 진짜 3D 그리기는 그릴 때 엔진의 지금 배치(activeLobbyLayout)로
// 가구를 만들고, layoutKey나 그 배치 객체가 바뀌면 다시 만든다(lobby3d-canvas.tsx Scene). 그래서
//   - "읽는 동안 짓지 않고 기다린다" = 저장소 읽기가 끝나지 않은 동안 3D 그리기가 한 번도 그려지지 않는다
//   - "그 배치로 짓는다" = 읽기가 끝난 뒤 3D 그리기가 있고, 엔진의 배치·3D 가구 자리가 그 배치다
//   - "다시 짓지 않는다" = 그 뒤 3D 그리기가 받는 layoutKey와 엔진의 배치 객체가 그대로다
// 로 본다.
// 가짜로 두는 것: 앞 qa 테스트(home-lobby-layout-load.spec.test.tsx)와 같다(API, 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스, 3D 그리기).
// 로그인 상태 가짜는 진짜 로그인 상태가 하듯 기기 저장소의 주인(storage-owner)도 그 계정으로 맞춘다.
// 구현 코드는 부르는 방법(홈 화면, 엔진의 배치, 불러오기·저장 함수 이름)을 알려고만 읽었다.
// 작업 090-① 명세의 "고칠 기존 테스트"대로 R12의 "모르는 가구 종류가 든 배치"를 빼고 새 동작의 R12-090으로 바꿨다(나머지 R12 경우는 그대로).
// 093(창문 붙박이) 07-main-decision.md(사용자 "qa가 창문 기대값만 4.8로", private 작업 폴더 093-2026-11-14-창문-붙박이, 보고 12-qa-tests.md):
// 앱이 받거나 기억해 둔 배치로 지을 때 창문은 늘 뒷벽 4.8이라, 짓기 확인(expectBuiltWith 등)의 기대값만 windowFixed()로 창문을 뒷벽 4.8로 바꿨다.
// 서버가 보내는 배치·기억해 둔 배치(입력)와 기기 저장소 확인, 다른 가구의 기대값은 그대로다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
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
import { activeLobbyLayout, applyLobbyLayout, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { currentFurnitureLayout, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import { setActiveStorageOwnerScope } from "@/lib/storage-owner";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

// ---------- 기기 저장소 가짜(메모리) ----------
// 읽기(getItem·multiGet·getAllKeys·getItemAsync)는 gate가 있으면 풀릴 때까지 기다리고, fail이면 실패한다. 쓰기는 늘 된다.

const mockStore = {
  async: new Map<string, string>(),
  secure: new Map<string, string>(),
  gate: null as Promise<void> | null,
  fail: false
};

async function mockRead<T>(read: () => T): Promise<T> {
  if (mockStore.fail) throw new Error("기기 저장소를 읽지 못했다(테스트 가짜)");
  while (mockStore.gate) await mockStore.gate;
  if (mockStore.fail) throw new Error("기기 저장소를 읽지 못했다(테스트 가짜)");
  return read();
}

jest.mock("@react-native-async-storage/async-storage", () => {
  const api = {
    getItem: jest.fn((key: string) => mockRead(() => mockStore.async.get(key) ?? null)),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore.async.set(key, String(value));
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStore.async.delete(key);
    }),
    mergeItem: jest.fn(async (key: string, value: string) => {
      const before = mockStore.async.get(key);
      mockStore.async.set(key, JSON.stringify({ ...(before ? JSON.parse(before) : {}), ...JSON.parse(value) }));
    }),
    clear: jest.fn(async () => {
      mockStore.async.clear();
    }),
    getAllKeys: jest.fn(() => mockRead(() => [...mockStore.async.keys()])),
    multiGet: jest.fn((keys: readonly string[]) => mockRead(() => keys.map((key) => [key, mockStore.async.get(key) ?? null]))),
    multiSet: jest.fn(async (pairs: readonly (readonly [string, string])[]) => {
      pairs.forEach(([key, value]) => mockStore.async.set(key, String(value)));
    }),
    multiRemove: jest.fn(async (keys: readonly string[]) => {
      keys.forEach((key) => mockStore.async.delete(key));
    }),
    multiMerge: jest.fn(async () => undefined),
    flushGetRequests: jest.fn()
  };
  return { __esModule: true, default: api, ...api };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn((key: string) => mockRead(() => mockStore.secure.get(key) ?? null)),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.secure.set(key, String(value));
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.secure.delete(key);
  })
}));

// ---------- 그 밖의 가짜(home-lobby-layout-load.spec.test.tsx와 같다) ----------

const mockFocus = { focused: true, listeners: new Set<() => void>() };
/** 3D 그리기가 그려질 때마다 적는다: 받은 layoutKey와 그때 엔진의 배치 객체. */
const mockCanvas: { props: Lobby3dCanvasProps | null; renders: { key: number; layout: LobbyLayout }[] } = { props: null, renders: [] };

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
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const engine = jest.requireActual<typeof import("@/lib/lobby3d/engine")>("@/lib/lobby3d/engine");
  return {
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      mockCanvas.renders.push({ key: props.layoutKey ?? 0, layout: engine.activeLobbyLayout() });
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
jest.mock("@/lib/practice-feedback-state", () => ({ hydratePracticeFeedbackState: jest.fn(), clearPracticeFeedbackState: jest.fn() }));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/writing-drafts", () => ({ getLocalWritingDraft: jest.fn() }));

// ---------- 배치(home-lobby-layout-load.spec.test.tsx의 값과 같다) ----------

type LayoutItem = LobbyLayout["items"][number];
type FloorSpot = NonNullable<LayoutItem["floor"]>;
type WallSpot = NonNullable<LayoutItem["wall"]>;
type PieceId = NonNullable<PointerHit["piece"]>;

function v2(floor: Record<string, FloorSpot>, wall: Record<string, WallSpot>): LobbyLayout {
  return {
    items: [
      ...Object.entries(floor).map(([id, spot]) => ({ id, type: id, floor: spot }) as LayoutItem),
      ...Object.entries(wall).map(([id, spot]) => ({ id, type: id, wall: spot }) as LayoutItem)
    ]
  };
}

const P0_FLOOR: Record<string, FloorSpot> = {
  desk: { x: 1.5, z: 5.5, facing: 0 },
  bookcase: { x: 0.5, z: 2.5, facing: 1 },
  wardrobe: { x: 7.5, z: 3.5, facing: 3 },
  rug: { x: 4.6, z: 7.2, facing: 0 }
};
const P0_WALL: Record<string, WallSpot> = { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } };
const LAMP = { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as LayoutItem;
/** 처음 배치. */
const P0: LobbyLayout = { items: [...v2(P0_FLOOR, P0_WALL).items, LAMP] };

const L1_FLOOR: Record<string, FloorSpot> = {
  desk: { x: 1.5, z: 5.5, facing: 0 },
  bookcase: { x: 0.5, z: 4.5, facing: 1 },
  wardrobe: { x: 7.5, z: 6.5, facing: 3 },
  rug: { x: 3.0, z: 8.0, facing: 1 }
};
const L1_WALL: Record<string, WallSpot> = { board: { wall: "back", along: 2.0 }, window: { wall: "back", along: 5.6 } };
/** 꾸민 계정의 배치 1(책장·옷장·깔개·게시판·창문이 처음 자리가 아니다). */
const L1: LobbyLayout = v2(L1_FLOOR, L1_WALL);
/** 배치 2(옷장만 방 가운데로). */
const L2: LobbyLayout = v2({ ...P0_FLOOR, wardrobe: { x: 4.5, z: 6.5, facing: 0 } }, P0_WALL);
/** 배치 3(게시판 오른벽, 창문 왼벽). */
const L3: LobbyLayout = v2(P0_FLOOR, { board: { wall: "right", along: 6.0 }, window: { wall: "left", along: 8.0 } });

/** 꾸미기에서 옷장을 (4.5, 6.5)로 끌어 놓은 배치(home-lobby-edit.spec.test.tsx의 W_CENTER). */
const W_CENTER: LobbyLayout = { items: P0.items.map((item) => (item.id === "wardrobe" ? { ...item, floor: { x: 4.5, z: 6.5, facing: 3 } } : item)) };
const WARDROBE_AT: FloorPoint = { x: 7.5, z: 3.5 };
const WARDROBE_CENTER: FloorPoint = { x: 4.5, z: 6.5 };

/** 같은 값의 새 객체(서버가 다시 보낸 배치처럼). */
function copy(layout: LobbyLayout): LobbyLayout {
  return JSON.parse(JSON.stringify(layout));
}

/** id 순으로 늘어놓은 인스턴스(목록 순서를 보지 않고 견준다). */
function sortedItems(layout: { items: readonly { id: string }[] } | null | undefined) {
  return [...(layout?.items ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 키 순서를 맞춘 JSON(값이 같은지 견줄 때). */
function canonical(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
    }
    return v;
  };
  return JSON.stringify(sortKeys(value === undefined ? null : value));
}

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";
const userA: AuthUser = { id: 7, email: "a@example.com", displayName: "가", admin: false };
const userB: AuthUser = { id: 8, email: "b@example.com", displayName: "나", admin: false };

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

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();

/** 로그인 상태를 바꾼다. 진짜 로그인 상태(session.tsx applySessionUser)처럼 기기 저장소의 주인도 그 계정으로 맞춘다. */
function setSessionUser(currentUser: AuthUser | null) {
  setActiveStorageOwnerScope(currentUser?.id ?? null);
  refreshSession.mockReset().mockResolvedValue(currentUser);
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
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** 끝나지 않는 서버 불러오기(서버 배치가 아직 오지 않은 동안을 본다). */
function serverNeverAnswers() {
  jest.mocked(getLobbyLayout).mockReset().mockReturnValue(new Promise<LobbyLayout | null>(() => undefined));
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

let view: Awaited<ReturnType<typeof render>> | null = null;

async function renderHome() {
  mockCanvas.props = null;
  mockCanvas.renders = [];
  view = await render(<HomeScreen />);
  await flushAsync();
  return view;
}

/** 앱을 끈다: 홈을 내리고, 엔진의 배치를 처음 배치로 되돌린다(새로 켠 앱의 엔진). 기기 저장소는 남는다. */
async function closeApp() {
  if (view) {
    const current = view;
    await act(async () => {
      current.unmount();
    });
    view = null;
  }
  await flushAsync();
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  mockCanvas.props = null;
  mockCanvas.renders = [];
}

/** 그 계정으로 홈을 열어 서버에서 그 배치를 받고(null이면 저장한 배치 없음) 앱을 끈다. */
async function receiveFromServerThenClose(user: AuthUser, layout: LobbyLayout | null) {
  setSessionUser(user);
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(layout === null ? null : copy(layout));
  await renderHome();
  expectBuiltWith(layout ?? P0);
  await closeApp();
}

/** 3D 그리기가 그려져 있고, 엔진의 배치와 3D 가구 자리가 그 배치다. */
/** 093 07 결정: 앱이 불러온 배치의 창문은 늘 뒷벽 4.8이다. 창문이 다른 자리인 입력의 기대값에만 쓴다. */
function windowFixed(layout: LobbyLayout): LobbyLayout {
  return { ...layout, items: layout.items.map((item) => (item.type === "window" ? { id: item.id, type: item.type, wall: { wall: "back" as const, along: 4.8 } } : item)) };
}

/** 093: 짓는 배치는 창문만 뒷벽 4.8로 본다(기대값만 바꿈. 넘기는 배치는 받은/기억한 그대로). */
function expectBuiltWith(layout: LobbyLayout) {
  expect(mockCanvas.props).not.toBeNull();
  expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(windowFixed(layout)));
  expect(currentFurnitureLayout()).toEqual(furniturePlacements(windowFixed(layout)));
}

/** 지금 3D 그리기가 받은 layoutKey와 엔진의 배치 객체(이 둘이 바뀌면 진짜 3D 그리기는 다시 짓는다). */
function builtMark() {
  expect(mockCanvas.props).not.toBeNull();
  return { key: mockCanvas.props!.layoutKey ?? 0, layout: activeLobbyLayout() };
}

function expectNotRebuiltSince(mark: { key: number; layout: LobbyLayout }) {
  const now = builtMark();
  expect(now.key).toBe(mark.key);
  expect(now.layout).toBe(mark.layout);
}

/** 기기 저장소 읽기를 막는다. 돌려주는 함수를 부르면 풀린다. */
function holdStorageReads() {
  const gate = deferred<void>();
  mockStore.gate = gate.promise;
  return async () => {
    mockStore.gate = null;
    gate.resolve();
    await flushAsync();
  };
}

type StoredHit = { where: "async" | "secure"; key: string; root: unknown; holder: { items: unknown[] } & Record<string, unknown> };

/** 기기 저장소(두 곳)에서 JSON 안에 그 배치의 가구 목록이 든 값을 찾는다. */
function storedEntriesWith(layout: LobbyLayout): StoredHit[] {
  const want = canonical(sortedItems(layout));
  const hits: StoredHit[] = [];
  const visit = (where: StoredHit["where"], key: string, root: unknown, node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach((child) => visit(where, key, root, child));
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.items) && canonical(sortedItems(record as { items: { id: string }[] })) === want) {
      hits.push({ where, key, root, holder: record as StoredHit["holder"] });
      return;
    }
    Object.values(record).forEach((child) => visit(where, key, root, child));
  };
  for (const [where, map] of [["async", mockStore.async], ["secure", mockStore.secure]] as const) {
    for (const [key, raw] of map) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      visit(where, key, parsed, parsed);
    }
  }
  return hits;
}

function writeStored(hit: StoredHit, raw: string) {
  (hit.where === "async" ? mockStore.async : mockStore.secure).set(hit.key, raw);
}

function storageSnapshot() {
  return { async: [...mockStore.async.entries()].sort(), secure: [...mockStore.secure.entries()].sort() };
}

// 꾸미기 조작(home-lobby-edit.spec.test.tsx와 같은 방법)
function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

async function pointer(phase: "down" | "move" | "up" | "cancel", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

function hit(point: FloorPoint | null, piece: PieceId | null = null, mark: MarkId | null = null): PointerHit {
  return { point, mark, onCharacter: false, piece };
}

async function drag(piece: PieceId, from: FloorPoint, to: FloorPoint) {
  await pointer("down", hit(from, piece), 200, 300);
  await pointer("move", hit(to, null), 300, 400);
  await pointer("up", null, 300, 400);
  await flushAsync();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

async function pressDone() {
  await fireEvent.press(screen.getByRole("button", { name: "완료" }));
  await flushAsync();
}

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockStore.async.clear();
  mockStore.secure.clear();
  mockStore.gate = null;
  mockStore.fail = false;
  mockFocus.focused = true;
  mockCanvas.props = null;
  mockCanvas.renders = [];
  view = null;
  fetchMock.mockReset().mockRejectedValue(new TypeError("fetch는 이 테스트에서 쓰지 않는다"));
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (layout: LobbyLayout) => copy(layout));
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
  setSessionUser(userA);
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
});

afterEach(async () => {
  mockStore.gate = null;
  mockStore.fail = false;
  await closeApp();
  jest.useRealTimers();
});

// ---------- 기억하기와 처음 짓기 ----------

describe("기억하기와 처음 짓기(명세 '바뀌는 동작')", () => {
  test("[spec] R1 [바뀔] 서버에서 받은 배치를 기기 저장소에 기억해 둔다", async () => {
    await receiveFromServerThenClose(userA, L1);

    expect(storedEntriesWith(L1).length).toBeGreaterThan(0);
  });

  test("[spec] R2 [바뀔] 다시 열면 기억해 둔 배치를 읽는 동안 3D 방을 짓지 않고 기다렸다가, 처음부터 그 배치로 짓는다. 서버가 같은 배치를 보내면 다시 짓지 않고, 서버로는 아무것도 보내지 않는다", async () => {
    await receiveFromServerThenClose(userA, L1);
    const server = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(server.promise);
    jest.mocked(saveLobbyLayout).mockClear();
    fetchMock.mockClear();

    const release = holdStorageReads();
    await renderHome();
    // 읽는 동안: 3D 방을 한 번도 그리지 않았다
    expect(mockCanvas.renders).toEqual([]);
    expect(mockCanvas.props).toBeNull();

    await release();
    // 처음부터 기억해 둔 배치로 짓는다(서버 배치는 아직 오지 않았다)
    expectBuiltWith(L1);
    const mark = builtMark();

    await act(async () => {
      server.resolve(copy(L1));
    });
    await flushAsync();
    expectBuiltWith(L1);
    expectNotRebuiltSince(mark);

    // 기억해 둔 배치는 서버로 보내지 않는다
    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("[spec] R3 [바뀔] 기억해 둔 배치로 지은 뒤 서버 배치가 다르면(다른 폰에서 바꿈) 그 배치를 적용해 다시 짓고, 그 배치를 기억한다(이전 값을 덮어씀)", async () => {
    await receiveFromServerThenClose(userA, L1);
    const server = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(server.promise);

    await renderHome();
    expectBuiltWith(L1);
    const mark = builtMark();

    await act(async () => {
      server.resolve(copy(L3));
    });
    await flushAsync();
    expectBuiltWith(L3);
    expect(builtMark().key).not.toBe(mark.key);

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L3);
    expect(storedEntriesWith(L1)).toEqual([]);
  });

  test("[spec] R4 [바뀔] 기억해 둔 배치로 지은 뒤 서버에 저장한 배치가 없으면(처음 배치를 받음) 처음 배치로 다시 짓고, 처음 배치를 기억한다", async () => {
    await receiveFromServerThenClose(userA, L1);
    const server = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(server.promise);

    await renderHome();
    expectBuiltWith(L1);
    const mark = builtMark();

    await act(async () => {
      server.resolve(null);
    });
    await flushAsync();
    expectBuiltWith(P0);
    expect(activeLobbyLayout()).toEqual(DEFAULT_LOBBY_LAYOUT);
    expect(builtMark().key).not.toBe(mark.key);

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(P0);
    expect(storedEntriesWith(L1)).toEqual([]);
  });

  test("[spec] R5 [바뀔] 기억해 둔 배치가 없는 계정도 기기 저장소를 읽는 동안에는 3D 방을 짓지 않고 기다렸다가, 처음 배치로 짓는다", async () => {
    serverNeverAnswers();

    const release = holdStorageReads();
    await renderHome();
    expect(mockCanvas.renders).toEqual([]);
    expect(mockCanvas.props).toBeNull();

    await release();
    expectBuiltWith(P0);
  });

  test("[spec] R6 [바뀔] 기억해 둔 배치를 읽는 동안 서버 배치가 먼저 와도, 읽기가 끝난 뒤 방은 서버 배치이고 서버 배치를 기억한다", async () => {
    await receiveFromServerThenClose(userA, L1);
    jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(copy(L3));

    const release = holdStorageReads();
    await renderHome();
    await release();
    expectBuiltWith(L3);

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L3);
  });
});

// ---------- 꾸미기 저장 ----------

describe("꾸미기에서 저장(명세 '바뀌는 동작')", () => {
  test("[spec] R7 [바뀔] '꾸미기'에서 저장에 성공하면 서버가 돌려준 배치를 기억해, 다시 열면 처음부터 그 배치로 짓는다", async () => {
    jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
    // 서버가 보낸 것(W_CENTER)과 다른 배치(L2)를 돌려준다: 기억하는 것은 서버가 돌려준 것이다
    jest.mocked(saveLobbyLayout).mockReset().mockResolvedValue(copy(L2));
    await renderHome();
    await enterEdit();
    await drag("wardrobe", WARDROBE_AT, WARDROBE_CENTER);
    await pressDone();
    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expect(sortedItems(jest.mocked(saveLobbyLayout).mock.calls[0][0])).toEqual(sortedItems(W_CENTER));

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L2);
  });

  test("[spec] R8 [바뀔] 저장에 실패한 배치는 기억하지 않는다: 다시 열면 마지막으로 저장에 성공한 배치로 짓는다", async () => {
    jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
    jest.mocked(saveLobbyLayout)
      .mockReset()
      .mockImplementationOnce(async (layout: LobbyLayout) => copy(layout))
      .mockRejectedValueOnce(new Error("배치를 저장하지 못했어요."));
    await renderHome();
    await enterEdit();
    await drag("wardrobe", WARDROBE_AT, WARDROBE_CENTER);
    await pressDone();
    expectBuiltWith(W_CENTER);

    await enterEdit();
    await drag("wardrobe", WARDROBE_CENTER, WARDROBE_AT);
    await pressDone();
    expect(saveLobbyLayout).toHaveBeenCalledTimes(2);

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(W_CENTER);
  });
});

// ---------- 계정별 ----------

describe("계정별(명세 '지우기'의 둘째 문장)", () => {
  test("[spec] R9 [바뀔] 다른 계정은 다른 계정 몫을 쓰지 않는다: B는 처음 배치로 짓고, B가 받은 배치는 B 몫으로, A 몫은 그대로 남는다", async () => {
    await receiveFromServerThenClose(userA, L1);

    setSessionUser(userB);
    const serverB = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(serverB.promise);
    await renderHome();
    expectBuiltWith(P0);
    expect(mockCanvas.renders.some((r) => canonical(sortedItems(r.layout)) === canonical(sortedItems(L1)))).toBe(false);
    await act(async () => {
      serverB.resolve(copy(L2));
    });
    await flushAsync();
    expectBuiltWith(L2);
    await closeApp();

    setSessionUser(userA);
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L1);
    await closeApp();

    setSessionUser(userB);
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L2);
  });

  test("[spec] R10 [그대로] 홈이 열린 채 계정이 A에서 B로 바뀌면, B의 서버 배치가 오기 전에는 A의 배치가 아닌 처음 배치다", async () => {
    jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(copy(L1));
    const current = await renderHome();
    expectBuiltWith(L1);

    serverNeverAnswers();
    await act(async () => {
      mockFocus.focused = false;
      mockFocus.listeners.forEach((listener) => listener());
    });
    setSessionUser(userB);
    await current.rerender(<HomeScreen />);
    await flushAsync();
    await act(async () => {
      mockFocus.focused = true;
      mockFocus.listeners.forEach((listener) => listener());
    });
    await flushAsync();

    expectBuiltWith(P0);
  });
});

// ---------- 처음 배치로 짓는 경우 ----------

describe("기억해 둔 배치를 쓰지 못할 때(명세 '처음 짓기'의 둘째 항목)", () => {
  test("[spec] R11 [그대로] 기억해 둔 배치를 읽지 못하면 처음 배치로 짓고, 서버 배치가 오면 지금처럼 적용한다. 홈은 그대로 쓸 수 있다", async () => {
    await receiveFromServerThenClose(userA, L1);
    const server = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(server.promise);

    mockStore.fail = true;
    await renderHome();
    expectBuiltWith(P0);
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();

    await act(async () => {
      server.resolve(copy(L1));
    });
    await flushAsync();
    expectBuiltWith(L1);
  });

  // 기억해 둔 값(JSON 안에 L1의 가구 목록이 든 값)을 모양이 맞지 않는 값으로 바꿔 넣는다
  const brokenCases: [string, (hit: StoredHit) => string][] = [
    ["JSON이 아닌 깨진 값", () => "{\"items\": [깨짐"],
    ["옛 판의 배치(version 1, 바닥·벽 묶음, L1의 값)", () => JSON.stringify({ version: 1, floor: L1_FLOOR, wall: L1_WALL })],
    // 작업 090-① 명세 "고칠 기존 테스트": "모르는 가구 종류가 든 배치"는 새 동작(그 가구만 빼고 그 배치로 짓는다)으로 바꿔 아래 R12-090으로 따로 둔다
    [
      "장소 가구(책상)가 빠진 배치",
      (hit) => {
        hit.holder.items = (hit.holder.items as Record<string, unknown>[]).filter((item) => item.id !== "desk");
        return JSON.stringify(hit.root);
      }
    ],
    [
      "가구 목록이 빈 배치",
      (hit) => {
        hit.holder.items = [];
        return JSON.stringify(hit.root);
      }
    ],
    [
      "방 밖 자리의 배치(옷장 x 99)",
      (hit) => {
        hit.holder.items = (hit.holder.items as Record<string, unknown>[]).map((item) =>
          item.id === "wardrobe" ? { ...item, floor: { x: 99, z: 6.5, facing: 3 } } : item
        );
        return JSON.stringify(hit.root);
      }
    ]
  ];

  test.each(brokenCases)("[spec] R12 [바뀔] 기억해 둔 값이 %s이면 처음 배치로 짓고, 서버 배치가 오면 지금처럼 적용한다", async (_label, breakIt) => {
    await receiveFromServerThenClose(userA, L1);
    const hits = storedEntriesWith(L1);
    expect(hits.length).toBeGreaterThan(0);
    for (const target of hits) writeStored(target, breakIt(target));

    const server = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(server.promise);
    await renderHome();
    expectBuiltWith(P0);
    expect(activeLobbyLayout()).toEqual(DEFAULT_LOBBY_LAYOUT);
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();

    await act(async () => {
      server.resolve(copy(L1));
    });
    await flushAsync();
    expectBuiltWith(L1);
  });

  // 작업 090-①(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/02-서버-아이템-목록/01-main-spec.md)의 "고칠 기존 테스트"로 고친 것.
  // 기대값은 그 명세(방 배치: 모르는 가구가 들어 있어도 배치 전체를 버리지 않고, 그 가구는 그리지 않는다)에서만 가져왔다.
  // 앱 안의 배치 값에 모르는 가구를 어디에 두는지는 명세가 정하지 않아, 3D 가구 자리(currentFurnitureLayout)로만 본다.
  test("[spec] R12-090 [바뀔] 기억해 둔 배치에 모르는 가구 종류(옷장 자리의 spaceship)가 들어 있어도 처음 배치로 되돌리지 않고, 그 가구만 빼고 그 배치로 짓는다. 서버 배치가 오면 지금처럼 적용한다", async () => {
    await receiveFromServerThenClose(userA, L1);
    const hits = storedEntriesWith(L1);
    expect(hits.length).toBeGreaterThan(0);
    for (const target of hits) {
      target.holder.items = (target.holder.items as Record<string, unknown>[]).map((item) => (item.id === "wardrobe" ? { ...item, type: "spaceship" } : item));
      writeStored(target, JSON.stringify(target.root));
    }

    const server = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(server.promise);
    await renderHome();
    expect(mockCanvas.props).not.toBeNull();
    expect(currentFurnitureLayout()).toEqual(furniturePlacements(windowFixed({ items: L1.items.filter((item) => item.id !== "wardrobe") })));
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();

    await act(async () => {
      server.resolve(copy(L1));
    });
    await flushAsync();
    expectBuiltWith(L1);
  });
});

// ---------- 로그인하지 않은 로비 ----------

describe("로그인하지 않은 상태(명세 '그대로여야 할 동작')", () => {
  // 지금 홈은 로그인하지 않았으면 로그인 화면으로 보낸다(index.tsx). 명세는 이 상태를 "지금처럼, 기억하지 않음"으로 두었다.
  test("[spec] R13 [그대로] 로그인하지 않은 상태로 홈을 열면, 기억해 둔 계정 몫이 있어도 지금처럼 로그인 화면으로 보내고 3D 방을 짓지 않으며, 배치를 불러오지 않고 기기 저장소에 아무것도 적지 않는다", async () => {
    await receiveFromServerThenClose(userA, L1);
    const before = storageSnapshot();
    jest.mocked(getLobbyLayout).mockClear();

    setSessionUser(null);
    await renderHome();

    const redirects = screen.container.queryAll((instance) => instance.type === "Redirect");
    expect(redirects.map((instance) => instance.props.href)).toEqual(["/login"]);
    expect(mockCanvas.renders).toEqual([]);
    expect(getLobbyLayout).not.toHaveBeenCalled();
    expect(storageSnapshot()).toEqual(before);
  });
});

// ---------- 03 결정(private 작업 폴더 077의 03-main-decision.md)의 1·2·3 ----------
// 기대값은 03 결정에서만 가져온다. 1 기억해 둔 배치로 지은 뒤 서버 불러오기가 실패하면 기억해 둔 배치 그대로(기본 배치로 되돌리지 않는다),
// 2 로그아웃 없이 계정이 바뀌었는데 그 계정 몫이 기억돼 있으면 그 계정 배치로 바로(앱을 새로 열 때와 같은 규칙, 그 뒤 서버 배치가 다르면 다시 짓는다),
// 3 계정이 바뀐 뒤 늦게 온 앞 계정의 서버 응답은 버린다(기억하지 않는다).

/** 홈이 열린 채 계정을 바꾼다(다른 화면에 갔다가 바뀐 계정으로 돌아온다. R10과 같은 조작). */
async function switchUserInPlace(current: Awaited<ReturnType<typeof renderHome>>, user: AuthUser) {
  await act(async () => {
    mockFocus.focused = false;
    mockFocus.listeners.forEach((listener) => listener());
  });
  setSessionUser(user);
  await current.rerender(<HomeScreen />);
  await flushAsync();
  await act(async () => {
    mockFocus.focused = true;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

function isLayout(layout: LobbyLayout, want: LobbyLayout) {
  return canonical(sortedItems(layout)) === canonical(sortedItems(want));
}

describe("03 결정 1·2·3", () => {
  test("[spec] R14 [바뀔] (결정 1) 기억해 둔 배치로 지은 뒤 서버 불러오기가 실패하면 기억해 둔 배치 그대로다(처음 배치로 되돌리지 않고 다시 짓지 않음). 다시 들어와 또 실패해도 그대로이고, 기억도 그대로 남는다", async () => {
    await receiveFromServerThenClose(userA, L1);
    const server = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(server.promise);

    await renderHome();
    expectBuiltWith(L1);
    const mark = builtMark();

    await act(async () => {
      server.reject(new Error("가구 배치를 불러오지 못했어요."));
    });
    await flushAsync();
    expectBuiltWith(L1);
    expectNotRebuiltSince(mark);

    // 다른 화면에 갔다가 돌아와 다시 불러오는데 또 실패한다
    jest.mocked(getLobbyLayout).mockReset().mockRejectedValue(new Error("가구 배치를 불러오지 못했어요."));
    await act(async () => {
      mockFocus.focused = false;
      mockFocus.listeners.forEach((listener) => listener());
    });
    await flushAsync();
    await act(async () => {
      mockFocus.focused = true;
      mockFocus.listeners.forEach((listener) => listener());
    });
    await flushAsync();
    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    expectBuiltWith(L1);
    expectNotRebuiltSince(mark);
    expect(mockCanvas.renders.some((r) => isLayout(r.layout, P0))).toBe(false);

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L1);
  });

  test("[spec] R15 [바뀔] (결정 2) 홈이 열린 채 A에서 B로 바뀌고 B 몫(L2)이 기억돼 있으면 처음 배치를 거치지 않고 L2로 바로 짓고, 그 뒤 B의 서버 배치가 다르면(L3) 다시 짓는다", async () => {
    await receiveFromServerThenClose(userB, L2);
    setSessionUser(userA);
    jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(copy(L1));
    const current = await renderHome();
    expectBuiltWith(L1);

    const serverB = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(serverB.promise);
    const before = mockCanvas.renders.length;
    await switchUserInPlace(current, userB);

    expectBuiltWith(L2);
    expect(mockCanvas.renders.slice(before).some((r) => isLayout(r.layout, P0))).toBe(false);
    const mark = builtMark();

    await act(async () => {
      serverB.resolve(copy(L3));
    });
    await flushAsync();
    expectBuiltWith(L3);
    expect(builtMark().key).not.toBe(mark.key);
  });

  test("[spec] R16 [바뀔] (결정 2) 홈이 열린 채 B로 바뀌어 기억해 둔 L2로 지은 뒤 B의 서버 배치가 같은 L2면 다시 짓지 않는다", async () => {
    await receiveFromServerThenClose(userB, L2);
    setSessionUser(userA);
    jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(copy(L1));
    const current = await renderHome();
    expectBuiltWith(L1);

    const serverB = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValue(serverB.promise);
    await switchUserInPlace(current, userB);
    expectBuiltWith(L2);
    const mark = builtMark();

    await act(async () => {
      serverB.resolve(copy(L2));
    });
    await flushAsync();
    expectBuiltWith(L2);
    expectNotRebuiltSince(mark);
  });

  test("[spec] R17 [바뀔] (결정 3) A에서 B로 바뀐 뒤 늦게 온 A의 서버 응답(L1)은 버린다: B의 방은 그대로이고, A 몫으로도 B 몫으로도 기억하지 않는다(A는 전에 기억한 L3 그대로)", async () => {
    await receiveFromServerThenClose(userA, L3);
    const lateA = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValueOnce(lateA.promise).mockReturnValue(new Promise<LobbyLayout | null>(() => undefined));
    const current = await renderHome();
    expectBuiltWith(L3);

    await switchUserInPlace(current, userB);
    expectBuiltWith(P0);
    const mark = builtMark();

    await act(async () => {
      lateA.resolve(copy(L1));
    });
    await flushAsync();
    expectBuiltWith(P0);
    expectNotRebuiltSince(mark);
    expect(storedEntriesWith(L1)).toEqual([]);

    await closeApp();
    setSessionUser(userA);
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L3);
    await closeApp();

    setSessionUser(userB);
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(P0);
  });
});
