// [spec] qa 테스트(작업 088 ② 방↔마을 오가기, 새 기능, 모바일): 홈(/) 화면 단위.
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/03-방-마을-오가기/02-qa-scenarios.md)와 03-main-decision.md에서만 가져온다.
// 여기서 보는 시나리오: X1·X2·X4·X6, N2·N4, H1~H6, O1~O3, O5. 로비 화면 단위는 tests/components/lobby3d-travel-screen.spec.test.tsx가 본다.
// 작업 092(홈쇼핑은 방에서만)에서 H1을 새 동작으로 고치고 H4·H5를 지웠다(092 명세의 "고칠 기존 테스트"와 02-main-decision.md).
//
// 구현(d58b7ca)에서 읽은 것은 부르는 방법뿐이다: 3D 그리기가 받는 onVillageReady·onVillageFailed, 동작 줄이기는 AccessibilityInfo.isReduceMotionEnabled.
// 가짜로 두는 것은 기존 홈쇼핑 시험(home-shopping-screen.spec.test.tsx)과 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기).
// 3D 그리기 가짜는 처음 그려진 뒤 '방이 보였다'(onRoomShown)를 한 번 부르고, 구역이 마을로 바뀔 때마다 마을 모델이 들어왔다(onVillageReady)고 알린다.
// Jest에는 네이티브 애니메이션 쪽이 없어 useNativeDriver: true인 움직임이 첫 프레임에 끝나므로, 테스트에서만 움직임을 자바스크립트 쪽에서 돌린다(시간은 그대로).
// 프레임은 0.05초씩, 가짜 시계·타이머와 함께 넣는다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { AccessibilityInfo, Animated, AppState, BackHandler } from "react-native";
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
  getWritingDraft,
  orderHomeShopping,
  saveLobbyLayout,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import { MARKS, applyArea, applyLobbyLayout, isFree, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { LobbyEditor } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, storedItems, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";
import { VILLAGE, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START } from "@/lib/lobby3d/village";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, HomeShopping, HomeShoppingOrderResult, LoopPointsSummary, MobileHomeSnapshot, WritingDraft } from "@/lib/types";
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
    getWritingDraft: jest.fn(),
    orderHomeShopping: jest.fn(),
    saveLobbyLayout: jest.fn(),
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

// ---------- 시나리오의 값 ----------

const DOOR_PROMPT = "밖으로 나가 볼까?";
const OLD_DOOR_MESSAGE = "마을은 다음 업데이트에서 열려요";
const HOME_PROMPT = "집으로 들어갈까?";
const VILLAGE_LABELS = ["라룹이 집", "가구점", "카페", "도서관"];
const ROOM_ONLY_LABELS = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로"];
const ROOM_ENTRY: FloorPoint = { x: 4.0, z: 10.5 };
const MENUS = ["질문에 답하기", "영어일기", "지금 생각나는대로", "학습 기록"];
const SHEET_MENUS = ["질문에 답하기", "영어일기", "지금 생각나는대로"];
const TABS = ["홈", "기록", "내정보"];
/** H1의 잔액(시험이 정한 가짜 응답 값). */
const BALANCE = 120;
const ALL = { includeHiddenElements: true } as const;

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

function loopPoints(balance: number): LoopPointsSummary {
  return { balance, today: { question: { count: 0, limit: 3, points: 30 } } } as unknown as LoopPointsSummary;
}

const ITEMS = [
  { type: "books", price: 40, salePrice: null, owned: 0 },
  { type: "lamp", price: 60, salePrice: null, owned: 1 },
  { type: "bed", price: 300, salePrice: 240, owned: 0 }
];

function shop(balance: number): HomeShopping {
  return JSON.parse(JSON.stringify({ balance, broadcast: { type: "bed", price: 300, salePrice: 240 }, items: ITEMS })) as HomeShopping;
}

function withStored(stored: StoredItem[]): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(DEFAULT_LOBBY_LAYOUT.items, stored))) as LobbyLayout;
}

function okBed(): HomeShoppingOrderResult {
  return { type: "bed", price: 240, balance: 60, owned: 1, itemId: "bed-1", layout: withStored([{ id: "bed-1", type: "bed" }]) };
}

const SAVED_AT = new Date(2026, 10, 12, 9, 5).toISOString();

function loop(): IncompleteLoopState {
  return {
    promptId: "prompt-loop",
    difficulty: "A",
    step: "answer",
    updatedAt: SAVED_AT,
    promptSnapshot: { topic: "Morning", questionEn: "What do you usually do in the morning?", questionKo: "아침에 보통 무엇을 하나요?" }
  } as unknown as IncompleteLoopState;
}

function writingDraft(): WritingDraft {
  return {
    promptId: "prompt-loop",
    draftType: "ANSWER",
    selectedDifficulty: "A",
    sessionId: "",
    answer: "I drink coffee.",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    updatedAt: SAVED_AT
  } as unknown as WritingDraft;
}

// ---------- 도우미 ----------

const refreshSession = jest.fn<Promise<AuthUser | null>, []>();
const backHandlers = new Set<() => boolean | null | undefined>();
const appStateListeners: ((state: string) => void)[] = [];

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

function sim() {
  return canvas().sim;
}

function area() {
  return canvas().area ?? "room";
}

function pos(): FloorPoint {
  return { x: sim().x, z: sim().z };
}

function dist(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleGap(a: number, b: number) {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
}

function textCount(text: string) {
  return screen.queryAllByText(text, ALL).length;
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

async function step() {
  await act(async () => {
    jest.advanceTimersByTime(50);
    canvas().onFrame(0.05, Date.now());
  });
}

async function steps(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let i = 0; i < count; i += 1) await step();
}

async function untilAreaLeaves(from: "room" | "village", already: number, limit = 3): Promise<number> {
  let elapsed = already;
  while (area() === from && elapsed < limit) {
    await step();
    elapsed += 0.05;
  }
  return elapsed;
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
  expect(dist(pos(), point)).toBeLessThanOrEqual(0.06);
}

function villageFreeNear(target: FloorPoint): FloorPoint {
  let best: FloorPoint | null = null;
  for (let c = 0; c < VILLAGE.width; c += 1) {
    for (let r = 0; r < VILLAGE.depth; r += 1) {
      const p = { x: c + 0.5, z: r + 0.5 };
      if (isFree(p.x, p.z, VILLAGE_SOLID_TILES, VILLAGE) && (!best || dist(p, target) < dist(best, target))) best = p;
    }
  }
  expect(best).not.toBeNull();
  return best!;
}

function farVillageFloor(): FloorPoint {
  const p = villageFreeNear({ x: VILLAGE_START.x + 4, z: VILLAGE_START.z + 3 });
  expect(dist(p, VILLAGE_START)).toBeGreaterThan(3);
  return p;
}

async function arriveAtDoor() {
  await walkTo(MARKS.door.approach[0], "door", 10);
  expect(sim().snapshot(Date.now()).bubbleButton).toBe("나가기");
}

async function pressButton(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flushAsync();
}

async function goOut() {
  await arriveAtDoor();
  await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
  await steps(1.2);
  expect(area()).toBe("village");
}

async function arriveAtHome() {
  await walkTo(farVillageFloor());
  await walkTo(VILLAGE_PLACES.home.approach[0], "home");
}

/** 열린 판(위로 올라오는 판)의 제목들. */
function openSheets(): string[] {
  const modals = screen.root!.queryAll((node) => (node.type as unknown) === "Modal");
  return SHEET_MENUS.filter((title) =>
    modals.some(
      (modal) =>
        (modal.props as { animationType?: string; visible?: boolean }).animationType === "slide" &&
        (modal.props as { visible?: boolean }).visible === true &&
        within(modal).queryAllByRole("header", { name: title }).length > 0
    )
  );
}

/** 열린 판 안의 '닫기' 버튼을 누른다. */
async function closeSheet(title: string) {
  const modal = screen
    .root!.queryAll((node) => (node.type as unknown) === "Modal")
    .find((node) => (node.props as { visible?: boolean }).visible === true && within(node).queryAllByRole("header", { name: title }).length > 0);
  expect(modal).toBeTruthy();
  await fireEvent.press(within(modal!).getByRole("button", { name: "닫기" }));
  await flushAsync();
}

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

async function sendAppState(state: string) {
  await act(async () => {
    [...appStateListeners].forEach((listener) => listener(state));
  });
  await flushAsync();
}

/** 등록된 기기 뒤로 가기 처리기를 모두 부르고, 가로챈(true를 돌려준) 수. */
async function pressBack(): Promise<number> {
  let consumed = 0;
  await act(async () => {
    for (const handler of [...backHandlers]) if (handler() === true) consumed += 1;
  });
  await flushAsync();
  return consumed;
}

async function orderBed() {
  await fireEvent.press(screen.getAllByRole("button", { name: "홈쇼핑" })[0]);
  await flushAsync();
  const bedButtons = screen.queryAllByRole("button", { name: /^침대, /, ...ALL });
  expect(bedButtons.length).toBeGreaterThan(0);
  await fireEvent.press(bedButtons[0]);
  await flushAsync();
  await fireEvent.press(screen.getByRole("button", { name: "240룹에 주문하기", ...ALL }));
  await flushAsync();
  expect(screen.getByText("보관함에 도착했어요", ALL)).toBeTruthy();
}

function referenceTakeOut(start: LobbyLayout, type: string, id: string) {
  const editor = new LobbyEditor(start);
  const notice = editor.takeOut(type, id);
  return { notice, layout: editor.layout, selected: editor.selected };
}

function expectBedTakenOut() {
  const reference = referenceTakeOut(okBed().layout, "bed", "bed-1");
  expect(reference.notice).toBeNull();
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  expect(edit!.layout.items.find((item) => item.id === "bed-1")).toEqual(reference.layout.items.find((item) => item.id === "bed-1"));
  expect(storedItems(edit!.layout).map((item) => item.id)).toEqual([]);
  expect(edit!.lifted).toBe("bed-1");
}

function useJsAnimation() {
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  devGlobal.__DEV__ = false;
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  backHandlers.clear();
  appStateListeners.length = 0;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    backHandlers.add(handler);
    return { remove: () => backHandlers.delete(handler) } as ReturnType<typeof BackHandler.addEventListener>;
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation((type, listener) => {
    if (type === "change") appStateListeners.push(listener as (state: string) => void);
    return {
      remove: () => {
        const index = appStateListeners.indexOf(listener as (state: string) => void);
        if (index >= 0) appStateListeners.splice(index, 1);
      }
    } as ReturnType<typeof AppState.addEventListener>;
  });
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (value: LobbyLayout) => JSON.parse(JSON.stringify(value)));
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(BALANCE));
  jest.mocked(getHomeShopping).mockReset().mockResolvedValue(shop(300));
  jest.mocked(orderHomeShopping).mockReset().mockResolvedValue(okBed());
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
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.back).mockReset();
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

// ---------- X. 방 → 마을(홈) ----------

describe("[spec] 홈: 방 → 마을(X1·X2·X4·X6)", () => {
  it("X1(홈): '밖으로'에 도착하면 말풍선 글이 정확히 '밖으로 나가 볼까?'이고 버튼은 '나가기', 이름표는 '밖으로'다", async () => {
    await renderHome();
    await arriveAtDoor();
    const snap = sim().snapshot(Date.now());
    expect(snap.bubbleText).toBe(DOOR_PROMPT);
    expect(snap.bubbleButton).toBe("나가기");
    expect(screen.getByText(DOOR_PROMPT)).toBeTruthy();
    expect(screen.getByRole("button", { name: "나가기" })).toBeTruthy();
    expect(textCount("밖으로")).toBe(1);
  });

  it("X2: '나가기'를 누르면 0.1초에는 아직 방, 0.2~0.5초 사이에 마을로 바뀌어 VILLAGE_START에 방향 0으로 서고, 3초 뒤에도 그대로 서 있다", async () => {
    await renderHome();
    await arriveAtDoor();
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await steps(0.1);
    expect(area()).toBe("room");

    const switched = await untilAreaLeaves("room", 0.1);
    expect(area()).toBe("village");
    expect(switched).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(switched).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);

    await frames(3);
    expect(dist(pos(), VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, 0)).toBeLessThanOrEqual(1e-6);
    expect(sim().snapshot(Date.now()).moving).toBe(false);
  });

  it("X4: '나가기' 뒤 옛 안내가 뜨지 않고, 판이 열리지 않으며 다른 화면으로 가지 않는다", async () => {
    await renderHome();
    await arriveAtDoor();
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await steps(1.2);
    expect(screen.queryByText(OLD_DOOR_MESSAGE, ALL)).toBeNull();
    expect(openSheets()).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("X6: '꾸미기'를 열면 '나가기' 버튼이 없고 구역은 방 그대로다", async () => {
    await renderHome();
    await arriveAtDoor();
    await fireEvent.press(screen.getByText("꾸미기"));
    await flushAsync();
    expect(screen.queryAllByRole("button", { name: "나가기" })).toHaveLength(0);
    expect(area()).toBe("room");
  });
});

// ---------- N. 마을 → 방(홈) ----------

describe("[spec] 홈: 마을 → 방(N2·N4)", () => {
  it("N2: 마을의 라룹이 집에서 '들어가기'를 누르면 0.1초에는 아직 마을, 0.2~0.5초 사이에 방으로 바뀌어 (4.0, 10.5)에 방향 π로 서고, 방 이름표가 돌아온다", async () => {
    await renderHome();
    await goOut();
    await arriveAtHome();
    expect(sim().snapshot(Date.now()).bubbleText).toBe(HOME_PROMPT);
    await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
    await steps(0.1);
    expect(area()).toBe("village");

    const switched = await untilAreaLeaves("village", 0.1);
    expect(area()).toBe("room");
    expect(switched).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(switched).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(dist(pos(), ROOM_ENTRY)).toBeLessThanOrEqual(1e-6);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThanOrEqual(1e-6);
    await steps(1.0);
    for (const label of ROOM_ONLY_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 1 });
    for (const label of VILLAGE_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 0 });
  });

  it("N4: '들어가기' 뒤 1.0초 동안 판이 열리지 않고 다른 화면으로 가지 않으며, 들어갈 때 안내가 뜨지 않는다", async () => {
    await renderHome();
    await goOut();
    await arriveAtHome();
    await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
    await steps(1.0);
    expect(openSheets()).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("alert", ALL)).toHaveLength(0);
  });
});

// ---------- H. 위 줄과 아래 메뉴 ----------

describe("[spec] 홈: 마을의 위 줄과 아래 메뉴(H1~H6)", () => {
  // 092(홈쇼핑은 방에서만, 기능 변경): 명세의 "고칠 기존 테스트"대로 H1을 새 동작(마을에서는 '홈쇼핑'·"N룹" 칩이 없고, 방에 돌아오면 다시 있다)으로 고쳤다.
  // H4·H5(마을에서 홈쇼핑 주문 뒤 '바로 놓기')는 092 결정 파일(02-main-decision.md)의 사용자 결정("테스트만 지움")대로 지웠다.
  it("H1: 마을에서는 '꾸미기'·'홈쇼핑'·'120룹' 칩이 없고 연속 기록 칩·카메라 거리가 있으며, 방에 돌아오면 '꾸미기'·'홈쇼핑'·'120룹' 칩이 다시 있다", async () => {
    await renderHome();
    expect(screen.queryByText("꾸미기")).not.toBeNull();
    expect(screen.queryAllByRole("button", { name: "홈쇼핑" })).toHaveLength(1);
    expect(screen.queryAllByText(`${BALANCE}룹`)).toHaveLength(1);
    expect(screen.queryAllByLabelText(`${BALANCE}룹, 홈쇼핑 열기`)).toHaveLength(1);

    await goOut();
    expect(screen.queryByText("꾸미기")).toBeNull();
    expect(screen.queryAllByRole("button", { name: "홈쇼핑", ...ALL })).toHaveLength(0);
    expect(textCount("홈쇼핑")).toBe(0);
    expect(textCount(`${BALANCE}룹`)).toBe(0);
    expect(screen.queryAllByLabelText(`${BALANCE}룹, 홈쇼핑 열기`, ALL)).toHaveLength(0);
    expect(screen.getByText("연속 2일")).toBeTruthy();
    expect(screen.getByRole("button", { name: "카메라 거리 설정" })).toBeTruthy();

    await arriveAtHome();
    await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
    await steps(1.2);
    expect(area()).toBe("room");
    expect(screen.queryByText("꾸미기")).not.toBeNull();
    expect(screen.queryAllByRole("button", { name: "홈쇼핑" })).toHaveLength(1);
    expect(screen.queryAllByText(`${BALANCE}룹`)).toHaveLength(1);
    expect(screen.queryAllByLabelText(`${BALANCE}룹, 홈쇼핑 열기`)).toHaveLength(1);
  });

  it("H2: 마을에서도 아래 메뉴 넷과 아래 탭바(홈·기록·내정보)가 있다", async () => {
    await renderHome();
    await goOut();
    for (const menu of MENUS) expect({ menu, shown: screen.queryAllByRole("button", { name: menu }).length > 0 }).toEqual({ menu, shown: true });
    for (const tab of TABS) expect({ tab, shown: screen.queryAllByText(tab).length > 0 }).toEqual({ tab, shown: true });
  });

  it.each(SHEET_MENUS)("H3: 마을에서 '%s'로 판을 열고 닫아도 계속 마을이고 라룹이는 그 자리다", async (menu) => {
    await renderHome();
    await goOut();
    await frames(1);
    const before = pos();

    await pressButton(menu);
    expect(openSheets()).toEqual([menu]);
    expect(area()).toBe("village");
    await frames(1);
    await closeSheet(menu);
    expect(openSheets()).toEqual([]);
    await frames(1);
    expect(area()).toBe("village");
    expect(dist(pos(), before)).toBeLessThanOrEqual(1e-6);
  });

  it("H6: 방에서 '바로 놓기'를 누르면 프레임을 넣지 않아도 바로 산 가구를 꺼낸 꾸미기가 열리고 구역은 방이다", async () => {
    await renderHome();
    await orderBed();
    await fireEvent.press(screen.getByRole("button", { name: "바로 놓기" }));
    await flushAsync();
    expect(area()).toBe("room");
    expectBedTakenOut();
  });
});

// ---------- O. 그 밖 ----------

describe("[spec] 홈: 그 밖의 동작(O1~O3·O5)", () => {
  it("O1: 마을에서 다른 화면에 다녀오면(포커스를 잃었다 되찾음) 계속 마을이고 라룹이는 떠나기 전 자리다", async () => {
    await renderHome();
    await goOut();
    await frames(1);
    const before = pos();
    await setFocused(false);
    await setFocused(true);
    await frames(1);
    expect(area()).toBe("village");
    expect(dist(pos(), before)).toBeLessThanOrEqual(1e-6);
  });

  it("O2(홈): 마을에 나온 뒤 홈을 내리고 다시 그리면 방에서 시작한다", async () => {
    const view = await renderHome();
    await goOut();
    await view.unmount();
    mockCanvas.props = null;
    await renderHome();
    expect(area()).toBe("room");
    for (const label of ROOM_ONLY_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 1 });
    for (const label of VILLAGE_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 0 });
  });

  it("O3: 마을에서도 방에서처럼 기기 뒤로 가기를 가로채지 않고, 마을 그대로이며 router.back·replace가 불리지 않는다", async () => {
    await renderHome();
    const inRoom = await pressBack();
    await goOut();
    const inVillage = await pressBack();
    expect({ inRoom, inVillage }).toEqual({ inRoom: 0, inVillage: 0 });
    expect(area()).toBe("village");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("O5: 이어 쓰기 상태가 있는 홈에서 마을에 나온 뒤 앱이 다시 앞으로 오면, 마을 그대로 방에서와 같은 인사 글과 '이어 쓰기' 버튼이 보인다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop());
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    await renderHome();
    const roomLine = sim().snapshot(Date.now()).bubbleText;
    expect(roomLine).not.toBe("");
    expect(screen.getByRole("button", { name: "이어 쓰기" })).toBeTruthy();

    await goOut();
    expect(appStateListeners.length).toBeGreaterThan(0);
    await sendAppState("background");
    await sendAppState("active");
    await frames(0.5);

    expect(area()).toBe("village");
    expect(sim().snapshot(Date.now()).bubbleText).toBe(roomLine);
    expect(screen.getByText(roomLine)).toBeTruthy();
    expect(screen.getByRole("button", { name: "이어 쓰기" })).toBeTruthy();
  });
});
