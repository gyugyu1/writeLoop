// [spec] qa 테스트(작업 090-① 서버 아이템 목록, 기능 변경, 모바일): 옷장(캐릭터 꾸미기 화면)의 칸 이름을 받은 아이템 목록에서 가져오는지,
// 그릴 줄 모르는 옷은 목록에 있어도 칸을 만들지 않는지.
// 기대값은 명세(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/02-서버-아이템-목록/01-main-spec.md)의 "바뀌는 동작 > 모바일"
// (이름·설명·분류를 목록에서 가져온다: 옷장 칸 이름. 그릴 줄 모르는 아이템은 옷장에서 칸을 만들지 않는다(지금과 같다))에서만 가져온다.
// 테스트 이름 앞의 [바뀔]·[그대로]는 03-qa-tests.md의 분류와 같다.
// 목록을 받는 함수 이름은 아직 없어서(구현 전) 모른다. 그래서 api 가짜는 진짜 모듈을 펼치고 홈이 부르는 다른 함수만 가짜로 바꾼다(목록 받기는 진짜 함수가 가짜 fetch를 부른다).
// 가정: 목록은 앱 화면(HomeScreen) 하나를 그리는 것으로 받고 쓰인다. 옷장은 기존 qa 테스트(home-closet.spec.test.tsx)처럼 옷장에 걸어가 '들어가기'로 연다.
// 테스트마다 서로 다른 날로 시계를 둔다(하루 한 번 받기에 막히지 않게).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
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
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { applyArea, applyLobbyLayout, markInfo, roomPlaceIds, type PlaceId, type PointerHit } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT } from "@/lib/lobby3d/lobby-layout";
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
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("@/components/home/closet-preview", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { __esModule: true, default: () => React.createElement("ClosetPreviewMock") };
});
// 진짜 api 모듈을 펼친다: 목록 받기(이름 모름)는 진짜 함수가 가짜 fetch를 부른다
jest.mock("@/lib/api", () => ({
  ...jest.requireActual<typeof import("@/lib/api")>("@/lib/api"),
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

// ---------- 아이템 목록(GET /api/catalog의 모양: 명세 "새 API") ----------
// 04-main-decision.md B: shopName은 늘 name과 같은 글(팔지 않는 것도), description은 늘 글(팔지 않으면 빈 글).

const wearable = (id: string, slot: string, name: string, price: number | null, description: string) => ({
  id,
  kind: "wearable",
  name,
  shopName: name,
  description,
  category: price === null ? null : "clothes",
  slot,
  price,
  assets: null
});

const furniture = (id: string, name: string) => ({
  id,
  kind: "furniture",
  name,
  shopName: name,
  description: "",
  category: null,
  slot: null,
  price: null,
  assets: null
});

const QA_CAP = "QA 주황 모자";
const QA_TSHIRT = "QA 주황 티";
const QA_GLASSES = "QA 둥근 안경";

/** 주황 모자·주황 티셔츠의 이름을 바꾸고, 앱이 그릴 줄 모르는 옷(glassesRound)을 더한 목록. */
function qaCatalog() {
  return {
    version: "qa-closet-v1",
    items: [
      furniture("desk", "일기 책상"),
      furniture("bookcase", "책장"),
      furniture("wardrobe", "옷장"),
      furniture("rug", "깔개"),
      furniture("lamp", "스탠드"),
      furniture("board", "오늘의 질문 게시판"),
      furniture("window", "창문"),
      wearable("capOrange", "hat", QA_CAP, 60, "QA 모자 설명이에요."),
      wearable("tshirtOrange", "top", QA_TSHIRT, 80, "QA 티셔츠 설명이에요."),
      wearable("shortsNavy", "bottom", "남색 반바지", 70, "가볍게 움직이기 좋은 남색 반바지예요."),
      wearable("goggles", "face", "라룹이 고글", null, ""),
      wearable("glassesRound", "face", QA_GLASSES, 90, "QA 안경 설명이에요.")
    ]
  };
}

const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

/** 가진 옷: 주황 모자(모자), 주황 티셔츠(상의), 앱이 그릴 줄 모르는 둥근 안경(얼굴장식). 모자를 입고 있다. */
function closetWardrobe(): Wardrobe {
  return JSON.parse(
    JSON.stringify({
      items: [
        { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T09:00:00Z" },
        { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T10:00:00Z" },
        { type: "glassesRound", slot: "face", acquiredAt: "2026-11-13T11:00:00Z" }
      ],
      equipped: { ...ALL_NULL, hat: "capOrange" }
    })
  ) as Wardrobe;
}

// ---------- 가짜 서버 ----------

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

function pathOf(url: string): string {
  return url.replace(/^[a-z]+:\/\/[^/]+/i, "").replace(/\?.*$/, "");
}

// ---------- 고정 데이터 ----------

const BASE = Date.parse("2026-11-13T01:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const dayAt = (n: number) => new Date(BASE + n * 3 * DAY_MS);
const userA: AuthUser = { id: 1, email: "a@example.com", displayName: "가", admin: false };
const SLOW_TEST_MS = 30_000;

function homeSnapshot(): MobileHomeSnapshot {
  return {
    todayStatus: {
      date: "2026-11-13",
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

// ---------- 도우미(home-closet.spec.test.tsx와 같은 방법) ----------

const ALL = { includeHiddenElements: true } as const;
const TITLE = "옷장";
const ENTER = "들어가기";
const OFF = "벗기";

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
  for (let index = 0; index < 16; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function sim() {
  return canvas().sim;
}

async function frames(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

async function tapHit(hit: PointerHit) {
  await act(async () => {
    canvas().onPointer("down", hit, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
}

function closetId(): PlaceId {
  const ids = roomPlaceIds().filter((id) => markInfo(id).label === TITLE);
  expect(ids).toHaveLength(1);
  return ids[0];
}

/** 홈을 그리고(목록을 받는다) 옷장에 걸어가 '들어가기'로 꾸미기 화면을 연다. */
async function openCloset(value: Wardrobe) {
  await render(<HomeScreen />);
  await flushAsync();
  await frames(0.1);
  const id = closetId();
  await tapHit({ point: null, mark: id, onCharacter: false });
  const done = () => sim().arrived === id && sim().vx === 0 && sim().vz === 0;
  for (let i = 0; i < 400 && !done(); i += 1) await frames(0.05);
  expect(done()).toBe(true);
  await frames(0.5);
  jest.mocked(getWardrobe).mockImplementationOnce(() => Promise.resolve(value));
  await fireEvent.press(screen.getByRole("button", { name: ENTER }));
  await flushAsync();
}

type Node = ReturnType<typeof screen.getByRole>;

function modal(): Node {
  const titles = screen.queryAllByRole("header", { name: TITLE, ...ALL });
  expect(titles).toHaveLength(1);
  for (let n: Node | null = titles[0]; n; n = n.parent) if ((n.type as unknown) === "Modal") return n;
  throw new Error("꾸미기 화면 Modal이 없다");
}

function labelOf(node: Node): string | undefined {
  const props = node.props as { accessibilityLabel?: string; "aria-label"?: string };
  return props["aria-label"] ?? props.accessibilityLabel;
}

/** 칸 줄: "벗기" 칸에서 위로, 부위 탭을 품지 않는 가장 높은 판. */
function cellRow(): Node {
  let row = within(modal()).getByRole("button", { name: OFF, ...ALL });
  for (let n: Node | null = row.parent; n; n = n.parent) {
    if (within(n).queryAllByRole("tab", ALL).length > 0) break;
    row = n;
  }
  return row;
}

function cellNames(): (string | undefined)[] {
  return within(cellRow()).queryAllByRole("button", ALL).map(labelOf);
}

async function chooseTab(name: string) {
  await fireEvent.press(within(modal()).getByRole("tab", { name, ...ALL }));
  await flushAsync();
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
  devGlobal.__DEV__ = false;
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  fetchMock.mockReset().mockImplementation(async (url) =>
    pathOf(String(url)) === "/api/catalog" ? respond(200, qaCatalog()) : respond(404, { message: "없음" })
  );
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  jest.mocked(getWardrobe).mockReset().mockResolvedValue(closetWardrobe());
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(120));
  jest.mocked(getHomeShopping).mockReset();
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

describe("[spec] 090-① 모바일: 옷장 칸 이름과 그릴 줄 모르는 옷", () => {
  it(
    "HC1 [바뀔] 옷장 칸 이름은 받은 목록의 name이다: 모자 탭은 '벗기'·'QA 주황 모자', 상의 탭은 '벗기'·'QA 주황 티'",
    async () => {
      jest.useFakeTimers({ now: dayAt(1) });
      await openCloset(closetWardrobe());

      await chooseTab("모자");
      expect(cellNames()).toEqual([OFF, QA_CAP]);
      await chooseTab("상의");
      expect(cellNames()).toEqual([OFF, QA_TSHIRT]);
    },
    SLOW_TEST_MS
  );

  it(
    "HC2 [그대로] 앱이 그릴 줄 모르는 옷(glassesRound)은 받은 목록에 이름('QA 둥근 안경')이 있어도 얼굴장식 탭에 칸이 없다",
    async () => {
      jest.useFakeTimers({ now: dayAt(2) });
      await openCloset(closetWardrobe());

      await chooseTab("얼굴장식");
      const names = cellNames();
      expect(names).toContain(OFF);
      expect(names).not.toContain(QA_GLASSES);
      expect(names).not.toContain("glassesRound");
      expect(within(modal()).queryAllByText(QA_GLASSES, ALL)).toHaveLength(0);
    },
    SLOW_TEST_MS
  );
});
