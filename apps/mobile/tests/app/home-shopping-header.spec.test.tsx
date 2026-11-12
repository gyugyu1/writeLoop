// [spec] qa 테스트(작업 086-③ 라룹 홈쇼핑 화면, 새 기능, 모바일): 로비 머리 줄의 '홈쇼핑' 버튼과 룹 잔액 칩(H),
// 꾸미기 보관함 줄의 '가구 더하기' 탭 없애기(T)를 홈 화면 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/04-홈쇼핑-화면/02-qa-scenarios.md의 H1~H13, T1~T4)와
// 같은 폴더 03-main-decision.md의 결정 4(홈에 돌아와 잔액을 다시 부르는 동안에는 앞 값을 보이고, 실패하면 칩을 숨긴다: H14·H15)에서만 가져온다.
// 구현(553cc67)에서 읽은 것은 부르는 방법뿐이다: API 함수 이름(getLoopPoints, getHomeShopping, orderHomeShopping), 버튼 글('홈쇼핑'),
// 칩은 "N룹" 글을 가진 버튼, 홈쇼핑 화면 제목 글 "라룹 홈쇼핑".
// 가짜로 두는 것은 기존 홈 로비 테스트(home-lobby-add-furniture.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기).
// 3D 그리기는 가짜라서 어느 가구를 눌렀는지는 누르기 결과의 piece로 넣어 보낸다. 엔진 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
// 시나리오 문서에서는 T를 따로 파일로 적었으나, 같은 홈 틀을 쓰므로 이 파일에 함께 둔다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { BackHandler, StyleSheet } from "react-native";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
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
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { applyLobbyLayout } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, HomeShopping, HomeShoppingOrderResult, LoopPointsSummary, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

type UiNode = ReturnType<typeof screen.getByRole>;

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

// ---------- 시나리오 공통 값 ----------

const TITLE = "라룹 홈쇼핑";
const STORAGE_EMPTY = "보관함이 비었어요";
const ADD_TAB = "가구 더하기";

const N0: LobbyLayout = JSON.parse(JSON.stringify(DEFAULT_LOBBY_LAYOUT)) as LobbyLayout;

function withStored(stored: StoredItem[]): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(DEFAULT_LOBBY_LAYOUT.items, stored))) as LobbyLayout;
}

function loopPoints(balance: number): LoopPointsSummary {
  return { balance, today: { question: { count: 0, limit: 3, points: 30 } } } as unknown as LoopPointsSummary;
}

const ITEMS_260 = [
  { type: "books", price: 40, salePrice: null, owned: 0 },
  { type: "smallPlant", price: 50, salePrice: null, owned: 0 },
  { type: "lamp", price: 60, salePrice: null, owned: 1 },
  { type: "frame", price: 70, salePrice: null, owned: 0 },
  { type: "plant", price: 80, salePrice: null, owned: 0 },
  { type: "nightstand", price: 100, salePrice: null, owned: 0 },
  { type: "floorLamp", price: 110, salePrice: null, owned: 0 },
  { type: "rug", price: 150, salePrice: null, owned: 1 },
  { type: "wardrobe", price: 180, salePrice: null, owned: 1 },
  { type: "bed", price: 300, salePrice: 240, owned: 0 }
];

function shop(balance: number): HomeShopping {
  return JSON.parse(JSON.stringify({ balance, broadcast: { type: "bed", price: 300, salePrice: 240 }, items: ITEMS_260 })) as HomeShopping;
}

function okBed(): HomeShoppingOrderResult {
  return { type: "bed", price: 240, balance: 20, owned: 1, itemId: "bed-1", layout: withStored([{ id: "bed-1", type: "bed" }]) };
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

async function renderHome(loaded: LobbyLayout | null = null) {
  jest.mocked(getLobbyLayout).mockResolvedValue(loaded);
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

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

function shopButtons(): UiNode[] {
  return screen.queryAllByRole("button", { name: "홈쇼핑" });
}

/** 잔액 칩: "N룹"과 똑같은 글을 가진 버튼(자신이나 조상이 버튼). 홈쇼핑 화면이 닫혀 있을 때 부른다. */
function chips(): UiNode[] {
  return screen.queryAllByText(/^\d+룹$/).filter((node) => buttonOf(node) !== null);
}

function chipText(): string | null {
  const found = chips();
  expect(found.length).toBeLessThanOrEqual(1);
  return found.length === 0 ? null : textOf(found[0]);
}

function buttonOf(node: UiNode): UiNode | null {
  for (let n: UiNode | null = node; n; n = n.parent) if ((n.props as { accessibilityRole?: unknown }).accessibilityRole === "button") return n;
  return null;
}

function textOf(node: UiNode): string {
  const join = (value: unknown): string => {
    if (value === null || value === undefined || typeof value === "boolean") return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(join).join("");
    const props = (value as { props?: { children?: unknown } }).props;
    return props ? join(props.children) : "";
  };
  return join((node.props as { children?: unknown }).children);
}

function shopOpen(): boolean {
  return screen.queryByText(TITLE) !== null;
}

function rootOf(node: UiNode): UiNode {
  let n = node;
  while (n.parent) n = n.parent;
  return n;
}

function contains(container: UiNode, node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) if (n === container) return true;
  return false;
}

function commonAncestor(...nodes: UiNode[]): UiNode {
  let found: UiNode | null = nodes[0];
  while (found && !nodes.every((node) => contains(found!, node))) found = found.parent;
  expect(found).not.toBeNull();
  return found!;
}

function orderOf(node: UiNode): number {
  let index = 0;
  let result = -1;
  const visit = (n: UiNode) => {
    if (n === node) result = index;
    index += 1;
    for (const child of n.children) if (typeof child !== "string") visit(child);
  };
  visit(rootOf(node));
  expect(result).toBeGreaterThanOrEqual(0);
  return result;
}

function flexDirectionOf(node: UiNode): string {
  const style = StyleSheet.flatten((node.props as { style?: unknown }).style as never) as { flexDirection?: string } | undefined;
  return style?.flexDirection ?? "column";
}

const FURNITURE_NAMES = FURNITURE_TYPES.map((type) => type.name);

function insideButton(node: UiNode): boolean {
  return buttonOf(node) !== null;
}

/** 보관함 줄 머리 왼쪽의 "보관함"·"보관함 N" 글(버튼이 아닌 것). */
function storageHeaders(): string[] {
  return screen
    .queryAllByText(/^보관함(\s*\d+)?$/)
    .filter((node) => !insideButton(node))
    .map(textOf);
}

/** 보관함 줄의 가구 칸(가구 이름 글을 가진 버튼). */
function trayCells(): string[] {
  const tray = screen.getByLabelText("보관함");
  return within(tray)
    .queryAllByRole("button")
    .map((button) => FURNITURE_NAMES.filter((name) => within(button).queryByText(name) !== null))
    .filter((names) => names.length === 1)
    .map((names) => names[0]);
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  devGlobal.__DEV__ = false;
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(
    () => ({ remove: () => undefined }) as ReturnType<typeof BackHandler.addEventListener>
  );
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (value: LobbyLayout) => JSON.parse(JSON.stringify(value)));
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(260));
  jest.mocked(getHomeShopping).mockReset().mockResolvedValue(shop(260));
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
  refreshSession.mockReset().mockResolvedValue(userA);
  setSessionUser(userA);
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
});

afterEach(() => {
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- H. 로비 머리 줄 ----------

describe("[spec] 086-③ 로비 머리 줄(H)", () => {
  test("H1 로그인한 홈을 열면 '꾸미기'·'홈쇼핑' 버튼과 잔액 칩 '260룹'이 보이고 GET /api/loop-points가 불렸다", async () => {
    await renderHome(N0);

    expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
    expect(shopButtons()).toHaveLength(1);
    expect(chipText()).toBe("260룹");
    expect(getLoopPoints).toHaveBeenCalled();
  });

  test("H2 머리 줄에서 '꾸미기' 다음이 '홈쇼핑', 그 다음이 '260룹' 칩이고 셋은 한 가로 줄에 있다", async () => {
    await renderHome(N0);

    const decor = screen.getByRole("button", { name: "꾸미기" });
    const shopButton = shopButtons()[0];
    const chip = buttonOf(chips()[0])!;
    expect(orderOf(decor)).toBeLessThan(orderOf(shopButton));
    expect(orderOf(shopButton)).toBeLessThan(orderOf(chip));
    expect(flexDirectionOf(commonAncestor(decor, shopButton, chip))).toBe("row");
  });

  test("H3 잔액을 불러오는 동안 '홈쇼핑' 버튼은 보이고 잔액 칩은 없다", async () => {
    jest.mocked(getLoopPoints).mockReturnValue(new Promise(() => undefined));
    await renderHome(N0);

    expect(shopButtons()).toHaveLength(1);
    expect(chips()).toHaveLength(0);
  });

  test("H4 잔액 불러오기가 실패하면 '홈쇼핑' 버튼은 보이고 잔액 칩은 없다", async () => {
    jest.mocked(getLoopPoints).mockRejectedValue(new Error("boom"));
    await renderHome(N0);

    expect(shopButtons()).toHaveLength(1);
    expect(chips()).toHaveLength(0);
  });

  test("H5 다른 화면에 갔다가 돌아오면 잔액을 한 번 더 불러(모두 2번) 칩이 '290룹'이 된다", async () => {
    await renderHome(N0);
    expect(chipText()).toBe("260룹");
    expect(getLoopPoints).toHaveBeenCalledTimes(1);
    jest.mocked(getLoopPoints).mockResolvedValue(loopPoints(290));

    await setFocused(false);
    await setFocused(true);

    expect(getLoopPoints).toHaveBeenCalledTimes(2);
    expect(chipText()).toBe("290룹");
  });

  test("H6 '홈쇼핑'을 누르면 홈쇼핑 화면이 열린다(제목 '라룹 홈쇼핑')", async () => {
    await renderHome(N0);
    expect(shopOpen()).toBe(false);

    await fireEvent.press(shopButtons()[0]);
    await flushAsync();

    expect(shopOpen()).toBe(true);
  });

  test("H7 '260룹' 칩을 누르면 홈쇼핑 화면이 열린다", async () => {
    await renderHome(N0);

    await fireEvent.press(buttonOf(chips()[0])!);
    await flushAsync();

    expect(shopOpen()).toBe(true);
  });

  test("H8 꾸미기 중에는 '홈쇼핑' 버튼과 잔액 칩이 없고, '취소'로 나오면 둘 다 다시 보인다", async () => {
    await renderHome(N0);

    await enterEdit();
    expect(shopButtons()).toHaveLength(0);
    expect(chips()).toHaveLength(0);

    await pressButton("취소");
    expect(shopButtons()).toHaveLength(1);
    expect(chipText()).toBe("260룹");
  });

  test("H9 홈쇼핑 목록의 잔액이 300이면, 홈쇼핑을 닫은 뒤 로비 칩이 '300룹'이다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop(300));
    await renderHome(N0);
    expect(chipText()).toBe("260룹");

    await fireEvent.press(shopButtons()[0]);
    await flushAsync();
    await fireEvent.press(screen.getByText("✕"));
    await flushAsync();

    expect(shopOpen()).toBe(false);
    expect(chipText()).toBe("300룹");
  });

  test("H10 침대를 주문(OK-BED)한 뒤 홈쇼핑을 닫으면 로비 칩이 '20룹'이다", async () => {
    await renderHome(N0);
    await fireEvent.press(shopButtons()[0]);
    await flushAsync();
    const broadcast = screen.getByLabelText("오늘의 방송 상품");
    await fireEvent.press(within(broadcast).getByText("주문하기"));
    await flushAsync();
    await pressButton("주문");
    expect(screen.getByText("택배가 보관함에 도착했어요")).toBeTruthy();
    await pressButton("계속 쇼핑하기");

    await fireEvent.press(screen.getByText("✕"));
    await flushAsync();

    expect(shopOpen()).toBe(false);
    expect(chipText()).toBe("20룹");
  });

  test("H11 로그인하지 않은 홈은 로그인 화면으로 보내고(Redirect /login) '홈쇼핑' 버튼과 잔액 칩이 없다", async () => {
    setSessionUser(null);
    await renderHome(null);

    const redirects = screen.container.queryAll((node) => (node.type as unknown) === "Redirect");
    expect(redirects.map((node) => (node.props as { href?: unknown }).href)).toEqual(["/login"]);
    expect(shopButtons()).toHaveLength(0);
    expect(chips()).toHaveLength(0);
  });

  test("H12 배치 저장이 없는 로비(개발 화면처럼 Lobby3dScreen만)에는 '꾸미기'·'홈쇼핑' 버튼과 잔액 칩이 없다", async () => {
    await render(<Lobby3dScreen />);
    await flushAsync();

    expect(screen.queryByText("꾸미기")).toBeNull();
    expect(shopButtons()).toHaveLength(0);
    expect(chips()).toHaveLength(0);
  });

  test("H13 그대로 둘 동작: 연속 칩(누르면 기록 화면), 카메라 거리 버튼, 아래 메뉴 4개가 있다", async () => {
    await renderHome(N0);

    expect(screen.getByRole("button", { name: "카메라 거리 설정" })).toBeTruthy();
    for (const label of ["질문에 답하기", "영어일기", "지금 생각나는대로", "학습 기록"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText("연속 2일"));
    await flushAsync();
    expect(router.push).toHaveBeenCalledWith("/records");
  });

  test("H14 (03 결정 4) 홈에 돌아와 잔액을 다시 부르는 동안에는 앞 값 '260룹'을 그대로 보이고, 끝나면 '290룹'이 된다", async () => {
    await renderHome(N0);
    expect(chipText()).toBe("260룹");
    let resolveSecond: (value: LoopPointsSummary) => void = () => undefined;
    jest.mocked(getLoopPoints).mockReturnValue(
      new Promise<LoopPointsSummary>((resolve) => {
        resolveSecond = resolve;
      })
    );

    await setFocused(false);
    await setFocused(true);

    expect(getLoopPoints).toHaveBeenCalledTimes(2);
    expect(chipText()).toBe("260룹");
    await act(async () => {
      resolveSecond(loopPoints(290));
    });
    await flushAsync();
    expect(chipText()).toBe("290룹");
  });

  test("H15 (03 결정 4) 홈에 돌아와 다시 부르기가 실패하면 칩을 숨긴다('홈쇼핑' 버튼은 보인다)", async () => {
    await renderHome(N0);
    expect(chipText()).toBe("260룹");
    jest.mocked(getLoopPoints).mockRejectedValue(new Error("boom"));

    await setFocused(false);
    await setFocused(true);

    expect(getLoopPoints).toHaveBeenCalledTimes(2);
    expect(chips()).toHaveLength(0);
    expect(shopButtons()).toHaveLength(1);
  });
});

// ---------- T. '가구 더하기' 탭 없애기 ----------

describe("[spec] 086-③ '가구 더하기' 탭 없애기(T)", () => {
  function expectNoAddTab() {
    expect(screen.queryAllByText(ADD_TAB)).toHaveLength(0);
    expect(screen.queryAllByRole(/^(tab|button)$/, { name: ADD_TAB })).toHaveLength(0);
    expect(screen.queryAllByLabelText(/ 더하기$/)).toHaveLength(0);
  }

  test.each([
    ["개발 빌드", true],
    ["운영 빌드", false]
  ])("T1·T2·T3 %s: 보관함이 비면 줄 머리 '보관함', '보관함이 비었어요'이고 '가구 더하기'(글·탭·'… 더하기' 칸)와 탭(역할 tab)이 없다", async (_label, dev) => {
    devGlobal.__DEV__ = dev;
    await renderHome(N0);

    await enterEdit();

    expectNoAddTab();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(storageHeaders()).toEqual(["보관함"]);
    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(trayCells()).toEqual([]);
  });

  test.each([
    ["개발 빌드", true],
    ["운영 빌드", false]
  ])("T2·T3 %s: 보관함 [rug-1]이면 줄 머리 '보관함 1', 칸 '깔개' 하나이고 탭이 없다", async (_label, dev) => {
    devGlobal.__DEV__ = dev;
    await renderHome(withStored([{ id: "rug-1", type: "rug" }]));

    await enterEdit();

    expectNoAddTab();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(storageHeaders()).toEqual(["보관함 1"]);
    expect(trayCells()).toEqual(["깔개"]);
  });

  test("T4 그대로 둘 동작: 보관함 [rug-1]에서 '깔개' 칸을 누르면 방에 놓이고 '보관함이 비었어요', 그 깔개를 '치우기'하면 다시 '보관함 1'이다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(withStored([{ id: "rug-1", type: "rug" }]));
    await enterEdit();

    const tray = screen.getByLabelText("보관함");
    await fireEvent.press(within(tray).getByRole("button", { name: "깔개" }));
    await flushAsync();

    expect(canvas().edit!.layout.items.some((item) => item.id === "rug-1")).toBe(true);
    expect(storageHeaders()).toEqual(["보관함"]);
    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(canvas().edit!.lifted).toBe("rug-1");

    await pressButton("치우기");

    expect(canvas().edit!.layout.items.some((item) => item.id === "rug-1")).toBe(false);
    expect(storageHeaders()).toEqual(["보관함 1"]);
    expect(trayCells()).toEqual(["깔개"]);
  });
});
