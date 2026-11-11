// [spec] qa 테스트(작업 077, 기능 변경, 모바일): 11 결정(private 작업 폴더 077-2026-11-11-로비-마지막-배치-폰에-저장/11-main-decision.md)과
// 10 검증의 의심 1(같은 폴더 10-qa-verify.md, 11 결정의 "함께 고치는 것")을 본다. 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(12-qa-tests.md의 분류와 같다).
//
// 11 결정: 불러오기가 인증 실패(401)이면 받은 배치로 보지 않아 기억하지 않는다(기억해 둔 배치를 그대로 둔다).
//   함께 지키는 앞 결정 064 08의 2: 401이면 받은 배치가 있어도 화면은 처음 배치로 바꾼다. 그래서 401이면 화면은 처음 배치, 기억은 그대로이고,
//   다음에 다시 열면 기억해 둔 배치로 짓는다.
//   401은 진짜 불러오기 함수(api.ts getLobbyLayout)를 거쳐 만든다(전역 fetch 가짜가 401을 준다. 기기에 로그인 토큰이 없어 토큰 갱신은 하지 않는다).
//   불러오기 함수가 401·404를 어떤 값으로 돌려주는지는 고칠 때 바뀔 수 있어 보지 않고, 화면과 기억(기기 저장소)만 본다.
// 의심 1: 서버 불러오기가 기억해 둔 배치 읽기보다 먼저 실패해도, 명세 "기억해 둔 배치를 읽는 동안에는 3D 방을 짓지 않고 기다린다"대로
//   읽는 동안 짓지 않고, 읽은 뒤 기억해 둔 배치로 짓는다(처음 배치로 한 번 지었다가 다시 짓지 않는다).
//
// 가짜·도우미와 "짓는다·다시 짓지 않는다"를 보는 방법은 home-lobby-layout-remember.spec.test.tsx와 같다(그 파일은 커밋됐으므로 고치지 않고 옮겨 적었다).
import { act, render, screen } from "@testing-library/react-native";
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
import { activeLobbyLayout, applyLobbyLayout } from "@/lib/lobby3d/engine";
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
function expectBuiltWith(layout: LobbyLayout) {
  expect(mockCanvas.props).not.toBeNull();
  expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(layout));
  expect(currentFurnitureLayout()).toEqual(furniturePlacements(layout));
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


// ---------- 서버 응답(진짜 불러오기 함수 + 전역 fetch 가짜) ----------

const actualApi = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");

function respond(status: number, body?: unknown) {
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

/** 불러오기를 진짜 함수로 돌리고, 서버가 그 상태 코드로 답하게 한다. */
function serverRespondsWithStatus(status: number, body?: unknown) {
  fetchMock.mockReset().mockImplementation(async () => respond(status, body));
  jest.mocked(getLobbyLayout).mockReset().mockImplementation(() => actualApi.getLobbyLayout());
}

async function leaveAndReturnHome() {
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
}

function isLayout(layout: LobbyLayout, want: LobbyLayout) {
  return canonical(sortedItems(layout)) === canonical(sortedItems(want));
}

// ---------- 11 결정: 401은 기억하지 않는다 ----------

describe("11 결정: 불러오기가 401이면 기억하지 않는다", () => {
  test("[spec] T1 [바뀔] 기억해 둔 L1로 다시 연 뒤 불러오기가 401이면 화면은 처음 배치로 바뀌지만(064 08-2) 기억해 둔 L1은 그대로 남고, 다시 열면 L1로 짓는다", async () => {
    await receiveFromServerThenClose(userA, L1);
    serverRespondsWithStatus(401, { message: "로그인이 필요해요." });

    await renderHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map((call) => String((call as unknown[])[0]))).toEqual([expect.stringContaining("/api/lobby-layout")]);
    expectBuiltWith(P0);
    expect(activeLobbyLayout()).toEqual(DEFAULT_LOBBY_LAYOUT);
    expect(storedEntriesWith(L1).length).toBeGreaterThan(0);

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L1);
  });

  test("[spec] T2 [바뀔] 홈에서 L1을 받은 뒤 다른 화면에 갔다 돌아와 불러오기가 401이면 화면은 처음 배치(064 08-2)이고, 기억해 둔 L1은 그대로 남아 다시 열면 L1로 짓는다", async () => {
    jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(copy(L1));
    await renderHome();
    expectBuiltWith(L1);

    serverRespondsWithStatus(401, { message: "로그인이 필요해요." });
    await leaveAndReturnHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    expectBuiltWith(P0);
    expect(storedEntriesWith(L1).length).toBeGreaterThan(0);

    await closeApp();
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(L1);
  });

  test("[spec] T3 [그대로] 저장한 배치가 없다는 응답(404)은 지금처럼 처음 배치를 받은 것으로 기억한다: 기억해 둔 L1을 덮어써 다시 열면 처음 배치로 짓는다", async () => {
    await receiveFromServerThenClose(userA, L1);
    serverRespondsWithStatus(404, { message: "저장한 배치가 없어요." });

    await renderHome();
    expect(fetchMock.mock.calls.map((call) => String((call as unknown[])[0]))).toEqual([expect.stringContaining("/api/lobby-layout")]);
    expectBuiltWith(P0);

    await closeApp();
    expect(storedEntriesWith(L1)).toEqual([]);
    serverNeverAnswers();
    await renderHome();
    expectBuiltWith(P0);
  });
});

// ---------- 10 검증 의심 1: 서버 실패가 기억 읽기보다 먼저 와도 읽는 동안 짓지 않는다 ----------

describe("의심 1: 서버 불러오기가 기억해 둔 배치 읽기보다 먼저 실패해도 읽는 동안 짓지 않는다", () => {
  test("[spec] T4 [바뀔] 기억해 둔 L1을 읽는 동안 서버 불러오기가 실패해도 3D 방을 짓지 않고 기다렸다가, 읽은 뒤 L1로 짓는다(처음 배치로 지은 적이 없다)", async () => {
    await receiveFromServerThenClose(userA, L1);
    jest.mocked(getLobbyLayout).mockReset().mockRejectedValue(new Error("가구 배치를 불러오지 못했어요."));

    const release = holdStorageReads();
    await renderHome();
    // 서버 불러오기는 이미 실패했다
    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    await expect(jest.mocked(getLobbyLayout).mock.results[0].value).rejects.toBeInstanceOf(Error);
    expect(mockCanvas.renders).toEqual([]);
    expect(mockCanvas.props).toBeNull();

    await release();
    expectBuiltWith(L1);
    expect(mockCanvas.renders.some((r) => isLayout(r.layout, P0))).toBe(false);
  });

  test("[spec] T5 [바뀔] 기억해 둔 배치가 없는 계정도 읽는 동안 서버 불러오기가 실패하면 짓지 않고 기다렸다가, 읽은 뒤 처음 배치로 짓는다", async () => {
    jest.mocked(getLobbyLayout).mockReset().mockRejectedValue(new Error("가구 배치를 불러오지 못했어요."));

    const release = holdStorageReads();
    await renderHome();
    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    expect(mockCanvas.renders).toEqual([]);
    expect(mockCanvas.props).toBeNull();

    await release();
    expectBuiltWith(P0);
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();
  });
});
