// [spec] qa 테스트(작업 089 ② 착용 아이템 목록과 저장, 새 기능, 모바일): 홈의 라룹이가 서버에 저장된 입은 것을 입는지(H1~H13),
// 04-main-decision.md 모바일 1~3, 개발 화면의 '착용 시험'이 서버와 상관없는지(D1·D2).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/04-아이템-목록과-저장/03-qa-scenarios.md)와
// 04-main-decision.md(모바일 1: 모르는 종류·다른 부위 아이템은 그 부위만 빼고 입히고, 응답 모양이 깨졌으면 아무것도 입지 않는다,
// 2: 다시 보여 다시 불러오다 실패하면 벗기고, 다시 불러오는 동안은 앞서 입힌 것을 둔다, 처음 보일 때 응답 전에는 아무것도 입지 않는다,
// 3: 늦게 온 앞 응답은 버린다)에서만 가져온다.
// 구현 커밋 e98ad44에서 읽은 것은 부르는 방법뿐이다: 불러오기 함수 getWardrobe()(401이면 null), 저장 함수 saveWardrobeEquipped,
// 3D 그리기가 받는 착용 속성 wear(①과 같이 부위 hat·top·bottom·shoes마다 참·거짓).
// "착용 목록"은 3D 그리기에 넘어간 wear에서 참인 부위들이다(부위 순서 hat·top·bottom·shoes). wear를 넘기지 않으면 빈 목록이다.
// wear가 종류를 담지 않으므로 시나리오의 "부위 → 종류"는 부위만 견준다(시나리오 "용어와 가정").
// 가짜로 두는 것은 기존 홈 방↔마을 시험(home-lobby-travel.spec.test.tsx)과 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기).
// 서버 응답 모양을 거쳐야 하는 경우(500, 401, 깨진 응답)는 진짜 불러오기 함수(api.ts)를 부르고 전역 fetch를 가짜로 둔다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getHomeShopping,
  getLobbyLayout,
  getLoopPoints,
  getMobileHomeSnapshot,
  getMonthWritingStatus,
  getTodayWritingStatus,
  getWardrobe,
  getWritingDraft,
  orderHomeShopping,
  saveLobbyLayout,
  saveWardrobeEquipped,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { MARKS, activeLobbyLayout, applyArea, applyLobbyLayout, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, storedItems, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, LoopPointsSummary, MobileHomeSnapshot, Wardrobe } from "@/lib/types";
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
      if (!focused) return undefined;
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
jest.mock("@/lib/api", () => {
  class ApiError extends Error {
    code?: string;
    status: number;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    ApiError,
    getDiaryCalendarSummary: jest.fn(),
    getFeaturedDailyPrompt: jest.fn(),
    getHomeShopping: jest.fn(),
    getLobbyLayout: jest.fn(),
    getLoopPoints: jest.fn(),
    getMobileHomeSnapshot: jest.fn(),
    getMonthWritingStatus: jest.fn(),
    getTodayWritingStatus: jest.fn(),
    getWardrobe: jest.fn(),
    getWritingDraft: jest.fn(),
    orderHomeShopping: jest.fn(),
    saveLobbyLayout: jest.fn(),
    saveWardrobeEquipped: jest.fn(),
    trackDailyPromptClick: jest.fn()
  };
});
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

// ---------- 시나리오의 값 ----------

const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const R4_ITEMS = [
  { type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T09:00:00Z" },
  { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T10:00:00Z" },
  { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T11:00:00Z" },
  { type: "shortsNavy", slot: "bottom", acquiredAt: "2026-11-13T12:00:00Z" }
];

function wardrobe(value: unknown): Wardrobe {
  return JSON.parse(JSON.stringify(value)) as Wardrobe;
}

const R0 = () => wardrobe({ items: [], equipped: ALL_NULL });
const R1 = () =>
  wardrobe({ items: [{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" }], equipped: { ...ALL_NULL, hat: "capOrange" } });
const R4 = () =>
  wardrobe({
    items: R4_ITEMS,
    equipped: { hat: "capOrange", top: "tshirtOrange", bottom: "shortsNavy", shoes: "shoesBrown", face: null, back: null, accessory: null }
  });
const R4_NONE = () => wardrobe({ items: R4_ITEMS, equipped: ALL_NULL });
const R2 = () => wardrobe({ items: R4_ITEMS, equipped: { ...ALL_NULL, top: "tshirtOrange", bottom: "shortsNavy" } });
const RB = () =>
  wardrobe({ items: [{ type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T08:00:00Z" }], equipped: { ...ALL_NULL, shoes: "shoesBrown" } });

const WEAR_BUTTONS = ["모자", "상의", "하의", "신발"];
const ROW_LABEL = "착용 시험";

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-13T03:00:00.000Z");
const TODAY_KEY = "2026-11-13";
const userA: AuthUser = { id: 1, email: "a@example.com", displayName: "가", admin: false };
const userB: AuthUser = { id: 2, email: "b@example.com", displayName: "나", admin: false };

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

function loopPoints(balance: number): LoopPointsSummary {
  return { balance, today: { question: { count: 0, limit: 3, points: 30 } } } as unknown as LoopPointsSummary;
}

// ---------- 가짜 fetch(진짜 불러오기 함수를 부를 때) ----------

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

/** 진짜 불러오기 함수를 거쳐 서버가 status·body로 답하게 한다. */
function serverAnswers(status: number, body?: unknown) {
  fetchMock.mockResolvedValue(respond(status, body));
  jest.mocked(getWardrobe).mockImplementation(() => actualApi.getWardrobe());
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

/** 3D 그리기에 넘어간 착용 목록(참인 부위, 순서 hat·top·bottom·shoes). */
function worn(): string[] {
  const wear = (canvas() as { wear?: Partial<Record<string, boolean>> }).wear;
  return ["hat", "top", "bottom", "shoes"].filter((slot) => wear?.[slot] === true);
}

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

/** 끝내기를 테스트가 쥐는 불러오기 응답. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sim() {
  return canvas().sim;
}

function area() {
  return canvas().area ?? "room";
}

function dist(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

async function frames(seconds: number) {
  const count = Math.round(seconds / 0.05);
  await act(async () => {
    for (let i = 0; i < count; i += 1) {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    }
  });
}

async function steps(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

async function tap(point: FloorPoint | null, mark: PointerHit["mark"] = null) {
  const hit: PointerHit = { point, mark, onCharacter: false };
  await act(async () => {
    canvas().onPointer("down", hit, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
}

async function walkTo(point: FloorPoint, mark: PointerHit["mark"] = null, seconds = 40) {
  await tap(point, mark);
  await frames(seconds);
  expect(dist({ x: sim().x, z: sim().z }, point)).toBeLessThanOrEqual(0.06);
}

/** 방의 '밖으로'에 걸어가 '나가기'를 눌러 마을로 나간다(전환). */
async function goOut() {
  await walkTo(MARKS.door.approach[0], "door", 10);
  await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
  await steps(1.2);
  expect(area()).toBe("village");
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flushAsync();
}

function useJsAnimation() {
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
}

/** 이 테스트가 보낸 요청 중 입은 것을 바꾸는 요청(PUT /api/wardrobe/equipped)의 수. */
function equippedPutCount(): number {
  const viaFetch = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/wardrobe/equipped")).length;
  return viaFetch + jest.mocked(saveWardrobeEquipped).mock.calls.length;
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  devGlobal.__DEV__ = false;
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  fetchMock.mockReset();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
  jest.mocked(getWardrobe).mockReset().mockResolvedValue(R0());
  jest.mocked(saveWardrobeEquipped).mockReset();
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (value: LobbyLayout) => JSON.parse(JSON.stringify(value)));
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(120));
  jest.mocked(getHomeShopping).mockReset();
  jest.mocked(orderHomeShopping).mockReset();
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
  applyArea("room");
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- H. 홈의 라룹이 ----------

describe("[spec] 홈: 로비가 보이면 입은 것을 불러와 입힌다(H1~H3, H7)", () => {
  it("H1: 불러오기가 R1이면 불러오기 함수가 한 번 불리고 착용 목록이 모자 하나다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    expect(getWardrobe).toHaveBeenCalledTimes(1);
    expect(worn()).toEqual(["hat"]);
  });

  it("H2: 불러오기가 R4이면 착용 목록이 모자·상의·하의·신발 넷이다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R4());
    await renderHome();
    expect(worn()).toEqual(["hat", "top", "bottom", "shoes"]);
  });

  it("H3: 넷을 가졌지만 입은 것이 모두 null(R4-none)이면 착용 목록이 비어 있다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R4_NONE());
    await renderHome();
    expect(worn()).toEqual([]);
  });

  it("H7: 처음 보일 때 응답 전에는 착용 목록이 비어 있고, R1로 끝나면 모자 하나다", async () => {
    const pending = deferred<Wardrobe | null>();
    jest.mocked(getWardrobe).mockReturnValue(pending.promise);
    await renderHome();
    expect(worn()).toEqual([]);
    await act(async () => {
      pending.resolve(R1());
    });
    await flushAsync();
    expect(worn()).toEqual(["hat"]);
  });
});

describe("[spec] 홈: 불러오지 못하거나 손님이면 아무것도 입지 않는다(H4~H6)", () => {
  it("H4(500): 서버가 500이면 착용 목록이 비어 있고, 로비가 그려지며 가구 배치(보관함 bed-1)가 그대로 들어간다", async () => {
    serverAnswers(500, { code: "INTERNAL", message: "boom" });
    const layout = JSON.parse(JSON.stringify(makeLayout(DEFAULT_LOBBY_LAYOUT.items, [{ id: "bed-1", type: "bed" }]))) as LobbyLayout;
    jest.mocked(getLobbyLayout).mockResolvedValue(layout);
    await renderHome();
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === "/api/wardrobe")).toBe(true);
    expect(worn()).toEqual([]);
    expect(storedItems(activeLobbyLayout())).toEqual([{ id: "bed-1", type: "bed" }]);
  });

  it("H4(네트워크): 불러오기가 네트워크 오류로 거절되면 착용 목록이 비어 있고 로비는 그려진다", async () => {
    jest.mocked(getWardrobe).mockRejectedValue(new TypeError("Network request failed"));
    await renderHome();
    expect(getWardrobe).toHaveBeenCalledTimes(1);
    expect(worn()).toEqual([]);
  });

  it("H5: 서버가 401이면 착용 목록이 비어 있고 로비는 그려진다", async () => {
    serverAnswers(401, { code: "UNAUTHORIZED", message: "로그인이 필요해요" });
    await renderHome();
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === "/api/wardrobe")).toBe(true);
    expect(worn()).toEqual([]);
  });

  it("H6: 로그인한 사용자가 없으면 불러오기 함수가 불리지 않는다", async () => {
    setSessionUser(null);
    await renderHome();
    expect(getWardrobe).not.toHaveBeenCalled();
  });
});

describe("[spec] 홈: 로비가 보일 때마다 불러온다(H8~H10)", () => {
  it("H8: R1로 보인 뒤 다른 화면에 갔다가, 불러오기가 R2일 때 돌아오면 모두 두 번 불리고 착용 목록이 상의·하의다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    expect(worn()).toEqual(["hat"]);
    await setFocused(false);
    jest.mocked(getWardrobe).mockResolvedValue(R2());
    await setFocused(true);
    expect(getWardrobe).toHaveBeenCalledTimes(2);
    expect(worn()).toEqual(["top", "bottom"]);
  });

  it("H9: R4로 보인 뒤 다른 화면에 갔다가, 불러오기가 R0일 때 돌아오면 착용 목록이 비어 있다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R4());
    await renderHome();
    expect(worn()).toEqual(["hat", "top", "bottom", "shoes"]);
    await setFocused(false);
    jest.mocked(getWardrobe).mockResolvedValue(R0());
    await setFocused(true);
    expect(worn()).toEqual([]);
  });

  it("H10: A로 R1을 입은 뒤 로그아웃했다가 B로 홈이 다시 보이면 다시 불러오고 착용 목록이 신발 하나다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    const view = await renderHome();
    expect(worn()).toEqual(["hat"]);
    await setFocused(false);
    setSessionUser(null);
    await view.rerender(<HomeScreen />);
    await flushAsync();
    jest.mocked(getWardrobe).mockClear().mockResolvedValue(RB());
    setSessionUser(userB);
    mockCanvas.props = null;
    await view.rerender(<HomeScreen />);
    await setFocused(true);
    expect(getWardrobe).toHaveBeenCalled();
    expect(worn()).toEqual(["shoes"]);
  });
});

describe("[spec] 홈: 마을, 시험판, 저장 요청(H11~H13)", () => {
  it("H11: R1로 입은 뒤 방의 '나가기'로 마을에 나가도 착용 목록이 모자 하나 그대로다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    expect(worn()).toEqual(["hat"]);
    await goOut();
    expect(area()).toBe("village");
    expect(worn()).toEqual(["hat"]);
  });

  it("H12: 홈에는 '착용 시험' 글과 '모자'·'상의'·'하의'·'신발' 착용 버튼이 없다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    expect(screen.queryByText(ROW_LABEL)).toBeNull();
    for (const name of WEAR_BUTTONS) expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("H13: 처음 보임·다시 보임·마을로 나가기를 거치는 동안 PUT /api/wardrobe/equipped가 한 번도 가지 않는다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    await setFocused(false);
    jest.mocked(getWardrobe).mockResolvedValue(R2());
    await setFocused(true);
    await goOut();
    expect(equippedPutCount()).toBe(0);
  });

  it("H13(진짜 불러오기 함수): 서버 응답을 거쳐 입혀도 fetch에 /api/wardrobe/equipped 요청이 없다", async () => {
    serverAnswers(200, R4());
    await renderHome();
    expect(worn()).toEqual(["hat", "top", "bottom", "shoes"]);
    expect(equippedPutCount()).toBe(0);
  });
});

// ---------- 결정 모바일 1 ----------

describe("[spec] 결정 1: 모르는 종류·다른 부위·깨진 응답", () => {
  it("모르는 종류(face: glassesBlack)와 다른 부위 아이템(top에 shortsNavy)이 든 부위만 빼고 모자·신발은 입는다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(
      wardrobe({
        items: R4_ITEMS,
        equipped: { hat: "capOrange", top: "shortsNavy", bottom: null, shoes: "shoesBrown", face: "glassesBlack", back: null, accessory: null }
      })
    );
    await renderHome();
    expect(worn()).toEqual(["hat", "shoes"]);
  });

  it("모르는 종류가 모자 자리에 있으면(hat: capPurple) 모자만 빼고 상의는 입는다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(wardrobe({ items: R4_ITEMS, equipped: { ...ALL_NULL, hat: "capPurple", top: "tshirtOrange" } }));
    await renderHome();
    expect(worn()).toEqual(["top"]);
  });

  it.each([
    ["equipped가 없음", { items: R4_ITEMS }],
    ["본문이 null", null],
    ["equipped가 배열", { items: R4_ITEMS, equipped: ["capOrange", "tshirtOrange"] }]
  ])("응답 모양이 깨졌으면(%s) 아무것도 입지 않는다", async (_name, body) => {
    serverAnswers(200, body);
    await renderHome();
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === "/api/wardrobe")).toBe(true);
    expect(worn()).toEqual([]);
  });
});

// ---------- 결정 모바일 2 ----------

describe("[spec] 결정 2: 다시 보여 다시 불러올 때", () => {
  it("다시 불러오다 오류로 실패하면 앞서 입힌 모자를 벗긴다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    expect(worn()).toEqual(["hat"]);
    await setFocused(false);
    jest.mocked(getWardrobe).mockRejectedValue(new Error("옷장을 불러오지 못했어요"));
    await setFocused(true);
    expect(getWardrobe).toHaveBeenCalledTimes(2);
    expect(worn()).toEqual([]);
  });

  it("다시 불러오다 401이면 앞서 입힌 모자를 벗긴다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    expect(worn()).toEqual(["hat"]);
    await setFocused(false);
    serverAnswers(401, { code: "UNAUTHORIZED", message: "로그인이 필요해요" });
    await setFocused(true);
    expect(fetchMock.mock.calls.some(([url]) => new URL(url).pathname === "/api/wardrobe")).toBe(true);
    expect(worn()).toEqual([]);
  });

  it("다시 불러오는 동안(응답 전)에는 앞서 입힌 모자를 그대로 두고, R2로 끝나면 상의·하의다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R1());
    await renderHome();
    expect(worn()).toEqual(["hat"]);
    await setFocused(false);
    const pending = deferred<Wardrobe | null>();
    jest.mocked(getWardrobe).mockReturnValue(pending.promise);
    await setFocused(true);
    expect(getWardrobe).toHaveBeenCalledTimes(2);
    expect(worn()).toEqual(["hat"]);
    await act(async () => {
      pending.resolve(R2());
    });
    await flushAsync();
    expect(worn()).toEqual(["top", "bottom"]);
  });
});

// ---------- 결정 모바일 3 ----------

describe("[spec] 결정 3: 늦게 온 앞 응답은 버린다", () => {
  it("다음에 다시 보여 새로 부른 응답(R2)이 먼저 오고 앞 응답(R1)이 늦게 오면 R2대로 둔다", async () => {
    const first = deferred<Wardrobe | null>();
    jest.mocked(getWardrobe).mockReturnValue(first.promise);
    await renderHome();
    await setFocused(false);
    jest.mocked(getWardrobe).mockResolvedValue(R2());
    await setFocused(true);
    expect(worn()).toEqual(["top", "bottom"]);
    await act(async () => {
      first.resolve(R1());
    });
    await flushAsync();
    expect(worn()).toEqual(["top", "bottom"]);
  });

  it("앞 응답이 늦게 실패해도 새 응답(R2)대로 둔다", async () => {
    const first = deferred<Wardrobe | null>();
    jest.mocked(getWardrobe).mockReturnValue(first.promise);
    await renderHome();
    await setFocused(false);
    jest.mocked(getWardrobe).mockResolvedValue(R2());
    await setFocused(true);
    expect(worn()).toEqual(["top", "bottom"]);
    await act(async () => {
      first.reject(new Error("늦은 실패"));
    });
    await flushAsync();
    expect(worn()).toEqual(["top", "bottom"]);
  });

  it("계정이 A에서 B로 바뀐 뒤 A의 응답(R1)이 늦게 오면 버리고 B의 신발만 입는다", async () => {
    const fromA = deferred<Wardrobe | null>();
    jest.mocked(getWardrobe).mockReturnValue(fromA.promise);
    const view = await renderHome();
    jest.mocked(getWardrobe).mockResolvedValue(RB());
    setSessionUser(userB);
    await view.rerender(<HomeScreen />);
    await flushAsync();
    expect(worn()).toEqual(["shoes"]);
    await act(async () => {
      fromA.resolve(R1());
    });
    await flushAsync();
    expect(worn()).toEqual(["shoes"]);
  });
});

// ---------- D. 개발 화면 ----------

describe("[spec] 개발 화면의 '착용 시험'은 서버와 상관없다(D1·D2)", () => {
  async function renderDevWithPanel() {
    devGlobal.__DEV__ = true;
    await render(<DevLobby3dRoute />);
    await flushAsync();
    await press("시험판 펴기");
  }

  function selected(): string[] {
    return WEAR_BUTTONS.filter((name) => screen.getByRole("button", { name }).props.accessibilityState?.selected === true);
  }

  it("D1: 불러오기가 R4여도 개발 화면을 열고 시험판을 펴면 착용 목록이 비어 있고 네 버튼이 모두 꺼져 있다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R4());
    await renderDevWithPanel();
    expect(worn()).toEqual([]);
    expect(selected()).toEqual([]);
  });

  it("D2: '모자'를 누르면 착용 목록이 모자 하나, 다시 누르면 빈다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(R4());
    await renderDevWithPanel();
    await press("모자");
    expect(worn()).toEqual(["hat"]);
    await press("모자");
    expect(worn()).toEqual([]);
  });
});
