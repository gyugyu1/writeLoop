// [spec] qa 테스트(작업 086-③ 라룹 홈쇼핑 화면, 새 기능, 모바일): 홈쇼핑 화면(S), 주문(O), 바로 놓기(P)를 홈 화면 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/04-홈쇼핑-화면/02-qa-scenarios.md의 S1~S19, O1~O19, P1~P7)와
// 같은 폴더 03-main-decision.md의 결정 2(확인 판은 받침에 맞게 조사: O1·O2), 결정 3(주문으로 보관함만 바뀐 배치는 로비 3D를 다시 짓지 않음, layoutKey 그대로: O20)에서만 가져온다.
// 구현(553cc67)에서 읽은 것은 부르는 방법뿐이다: API 함수 이름과 ApiError(code, message), 방송 상품 칸의 접근성 이름 "오늘의 방송 상품",
// 닫기 글 "✕", 홈쇼핑 화면이 Modal(기기 뒤로 가기는 onRequestClose), 알림은 화면 글, 3D 그리기가 받는 edit·layoutKey.
// "꺼내기 규칙은 지금과 같다"(P2·P4)는 편집기(LobbyEditor.takeOut)를 그대로 불러 기준으로 쓴다(지금 보관함 칸을 누를 때 화면이 부르는 것).
// 가짜로 두는 것은 기존 홈 로비 테스트(home-lobby-add-furniture.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기).
// 엔진 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
// 시나리오 S20은 1단계 보고를 쓰는 중에 뺐다(명세에 없는 짐작이라).
// (087 홈쇼핑 화면 개편, 기능 변경) 명세(private 작업 폴더 087-2026-11-13-홈쇼핑-화면-개편/01-main-spec.md)의 "고칠 기존 테스트"대로 고쳤다:
// 한 줄 목록의 '주문하기'·"N개 있음"·"N룹 더 모으면 살 수 있어요", 확인 판('취소'·'주문'), 완료 판 "택배가 보관함에 도착했어요"·'계속 쇼핑하기',
// 방송 칸의 '주문하기', 앱 가구 목록 이름을 보던 부분을 새 화면(카드 → 상세창 → 'N룹에 주문하기', 홈쇼핑 이름, 가진 개수 숨김)으로 바꿨다.
// 주문 요청 본문·잔액·배치·알림 문구·다시 불러오기·바로 놓기의 단언과 기대값은 그대로다. 새 화면에서 바뀐 기대값은 087 명세에서만 가져왔다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { BackHandler, StyleSheet } from "react-native";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import {
  ApiError,
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
import { activeLobbyLayout, applyLobbyLayout, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { furnitureIcon } from "@/lib/lobby3d/furniture-icons";
import { LobbyEditor } from "@/lib/lobby3d/lobby-edit";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, storedItems, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";
import { parseLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
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
// S8·S13·S14: 그림은 진짜 아이콘 표를 쓰되, S14에서 한 종류만 그림이 없게 바꿀 수 있게 감싼다.
jest.mock("@/lib/lobby3d/furniture-icons", () => {
  const actual = jest.requireActual<typeof import("@/lib/lobby3d/furniture-icons")>("@/lib/lobby3d/furniture-icons");
  return { furnitureIcon: jest.fn((type: string) => actual.furnitureIcon(type)) };
});
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

function buttonOf(node: UiNode): UiNode | null {
  for (let n: UiNode | null = node; n; n = n.parent) {
    const props = n.props as { accessibilityRole?: unknown; role?: unknown };
    if (props.accessibilityRole === "button" || props.role === "button") return n;
  }
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

function contains(container: UiNode, node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) if (n === container) return true;
  return false;
}

const FURNITURE_NAMES = FURNITURE_TYPES.map((type) => type.name);

/** 진짜 아이콘 표의 그림. */
function actualIcon(type: string) {
  return jest.requireActual<typeof import("@/lib/lobby3d/furniture-icons")>("@/lib/lobby3d/furniture-icons").furnitureIcon(type);
}

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
  jest.mocked(furnitureIcon).mockImplementation((type: string) => actualIcon(type));
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


// ---------- 홈쇼핑 화면 도우미 ----------
// (087) 한 줄 목록·확인 판이 2열 카드·상세창으로 바뀌어, 칸·판을 찾는 도우미를 새 화면(087 명세 "화면" 1~8)에 맞췄다.
// 상세창이 뒤를 접근성에서 가릴 수 있어(accessibilityViewIsModal) 뒤 화면을 찾는 질의는 가려진 것까지 찾는다(ALL).

const ALL = { includeHiddenElements: true } as const;
const HOST_LINES = ["오늘만 20%! 지금 주문하세요", "방송 중에만 이 가격이에요!", "매진되기 전에 서두르세요!"];
const DELIVERED = "보관함에 도착했어요";
const DETAIL_TITLE = "상품 자세히 보기";
const DETAIL_CLOSE = "상품 상세 닫기";
const SHOP_CLOSE = "홈쇼핑 닫기";
const ORDER_FAILED = "주문하지 못했어요. 다시 시도해 주세요";
const NO_ROOM = "놓을 자리가 없어요. 가구를 옮기거나 치운 뒤 다시 꺼내 주세요";
const GUIDE = "가구를 눌러 고르고, 끌어서 옮겨요";
const REMEMBER_KEY = "writeloop.lobby3d.layout.v1.7";
/** ITEMS_260 순서의 홈쇼핑 이름(087 명세 표). */
const ORDER_NAMES = ["책", "작은 화분", "탁상 스탠드", "액자", "큰 화분", "협탁", "바닥 스탠드", "러그", "옷장", "침대"];
/** 카드의 접근성 이름: "<이름>, N룹, 자세히 보기" 또는 "<이름>, N룹, 20% 할인, 자세히 보기". */
const CARD_LABEL = /^(.+), (\d+)룹, (20% 할인, )?자세히 보기$/;

async function openShop() {
  await fireEvent.press(shopButtons()[0]);
  await flushAsync();
}

async function closeShopWithX() {
  await fireEvent.press(screen.getByText("✕"));
  await flushAsync();
}

async function pressNode(node: UiNode) {
  await fireEvent.press(node);
  await flushAsync();
}

/** 홈쇼핑 화면을 담은 모달(제목 글을 품은 Modal). */
function shopModal(): UiNode {
  const title = screen.getByText(TITLE, ALL);
  for (let n: UiNode | null = title; n; n = n.parent) if ((n.type as unknown) === "Modal") return n;
  throw new Error("홈쇼핑 모달이 없다");
}

function labelOf(node: UiNode): string | undefined {
  const props = node.props as { accessibilityLabel?: string; "aria-label"?: string };
  return props["aria-label"] ?? props.accessibilityLabel;
}

function isStruck(node: UiNode): boolean {
  const style = (StyleSheet.flatten((node.props as { style?: unknown }).style as never) ?? {}) as { textDecorationLine?: string };
  return (style.textDecorationLine ?? "").includes("line-through");
}

function isDisabled(button: UiNode): boolean {
  const props = button.props as { accessibilityState?: { disabled?: boolean }; "aria-disabled"?: boolean };
  return (props["aria-disabled"] ?? props.accessibilityState?.disabled) === true;
}

/** 열린 상세창(제목에서 '상품 상세 닫기'와 주문 쪽 버튼이나 진행 표시를 함께 품은 조상까지). 없으면 null. */
function detailPanelOrNull(): UiNode | null {
  const titles = screen.queryAllByText(DETAIL_TITLE, ALL);
  if (titles.length === 0) return null;
  expect(titles).toHaveLength(1);
  for (let n: UiNode | null = titles[0]; n; n = n.parent) {
    const hasClose = within(n).queryAllByRole("button", { name: DETAIL_CLOSE, ...ALL }).length > 0;
    const hasBottom =
      within(n).queryAllByRole("button", { name: /룹에 주문하기$|룹 더 필요해요$/, ...ALL }).length > 0 || spinnersIn(n).length > 0;
    if (hasClose && hasBottom) return n;
    // 상세창을 담은 Modal 밖(로비)까지는 올라가지 않는다
    if ((n.type as unknown) === "Modal") break;
  }
  return null;
}

function detailPanel(): UiNode {
  const panel = detailPanelOrNull();
  expect(panel).not.toBeNull();
  return panel!;
}

/** 방송 칸(버튼): 줄 그은 정가를 품은 버튼. 목록 카드에는 줄 그은 정가가 없다(087 명세 화면 2·4). 없으면 null. */
function broadcastButtonOrNull(): UiNode | null {
  const titles = screen.queryAllByText(TITLE, ALL);
  if (titles.length === 0) return null;
  const panel = detailPanelOrNull();
  const struck = within(shopModal())
    .queryAllByText(/^\d+룹$/, ALL)
    .filter((node) => isStruck(node) && !(panel && contains(panel, node)));
  if (struck.length === 0) return null;
  expect(struck).toHaveLength(1);
  // 줄 그은 정가가 버튼 안에 없으면(방송 칸이 버튼이 아니면) null. broadcastButton()이 그때 실패한다
  return buttonOf(struck[0]);
}

function broadcastButton(): UiNode {
  const button = broadcastButtonOrNull();
  expect(button).not.toBeNull();
  return button!;
}

/** 목록 카드들(화면 순서): 접근성 이름이 카드 모양인 버튼. 방송 칸은 뺀다. */
function listCards(): UiNode[] {
  if (screen.queryAllByText(TITLE, ALL).length === 0) return [];
  const broadcast = broadcastButtonOrNull();
  return screen.queryAllByRole("button", { name: CARD_LABEL, ...ALL }).filter((button) => button !== broadcast);
}

function cardName(card: UiNode): string {
  const label = labelOf(card) ?? "";
  expect(label).toMatch(CARD_LABEL);
  return CARD_LABEL.exec(label)![1];
}

function cardOf(name: string): UiNode {
  const cards = listCards().filter((card) => cardName(card) === name);
  expect(cards).toHaveLength(1);
  return cards[0];
}

/** 칸 안의 "N룹" 글들. */
function pricesIn(container: UiNode): string[] {
  return within(container).queryAllByText(/^\d+룹$/, ALL).map(textOf);
}

/** 홈쇼핑 위 줄의 잔액 글: 제목에서 올라가며 처음 "N룹" 글을 품은 조상(방송 칸·카드를 품지 않은 것)의 그 글. */
function shopBalanceText(): string | null {
  const modal = shopModal();
  const cards = listCards();
  const broadcast = broadcastButtonOrNull();
  for (let n: UiNode | null = within(modal).getByText(TITLE, ALL); n; n = n.parent) {
    const found = within(n).queryAllByText(/^\d+룹$/, ALL);
    if (found.length === 0) {
      if (n === modal) return null;
      continue;
    }
    if (cards.some((card) => contains(n!, card)) || (broadcast && contains(n, broadcast))) return null;
    expect(found).toHaveLength(1);
    return textOf(found[0]);
  }
  return null;
}

function spinnersIn(container: UiNode): UiNode[] {
  return container.queryAll((node) => (node.type as unknown) === "ActivityIndicator");
}

function imageSourcesIn(container: UiNode): unknown[] {
  return container.queryAll((node) => (node.type as unknown) === "Image").map((node) => (node.props as { source?: unknown }).source);
}

function hostLinesShown(): string[] {
  return HOST_LINES.filter((line) => screen.queryAllByText(new RegExp(line.replace(/[.*+?^${}()|[\]\\!%]/g, "\\$&")), ALL).length > 0);
}

function orderButton(price: number): UiNode {
  return screen.getByRole("button", { name: `${price}룹에 주문하기`, ...ALL });
}

async function pressOrder(price: number) {
  await pressNode(orderButton(price));
}

/** 상세창 아래 "주문 후 남는 룹" 줄의 값("N룹"). */
function remainingIn(panel: UiNode): string {
  const label = within(panel).getByText("주문 후 남는 룹", ALL);
  for (let n: UiNode | null = label; n && n !== panel.parent; n = n.parent) {
    const found = within(n).queryAllByText(/^-?\d+룹$/, ALL);
    if (found.length > 0) {
      expect(found).toHaveLength(1);
      return textOf(found[0]);
    }
  }
  throw new Error("주문 후 남는 룹 값이 없다");
}

async function rememberedLayout(): Promise<LobbyLayout | null> {
  const raw = await AsyncStorage.getItem(REMEMBER_KEY);
  return raw === null ? null : parseLobbyLayoutPayload(JSON.parse(raw));
}

function storedIds(value: LobbyLayout | null | undefined): string[] {
  return storedItems(value ?? { items: [] }).map((item) => item.id);
}

function sortedItems(value: LobbyLayout) {
  return [...value.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** S260에서 방송 칸 → 상세창 '240룹에 주문하기'(OK-BED)까지. 완료 판이 열린 채다. */
async function orderBroadcastBed() {
  await openShop();
  await pressNode(broadcastButton());
  await pressOrder(240);
  expect(screen.getByText(DELIVERED, ALL)).toBeTruthy();
}

function editLayout(): LobbyLayout {
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  return edit!.layout;
}

/** 꾸미기 화면이다. 안내 문구는 알림이 떠 있는 동안 숨으므로(지금 동작) 알림을 띄우는 경우는 withGuide를 끈다. */
function expectEditing(withGuide = true) {
  if (withGuide) expect(screen.getByText(GUIDE)).toBeTruthy();
  expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "처음 배치로" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "완료" })).toBeTruthy();
  expect(screen.getByLabelText("보관함")).toBeTruthy();
}

function hit(point: FloorPoint | null, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

async function tapHit(h: PointerHit) {
  await act(async () => {
    canvas().onPointer("down", h, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", null, 200, 300);
  });
  await flushAsync();
}

/** 꺼내기 기준: 그 배치로 꾸미기에 들어가 보관함 칸을 누른 것(편집기 그대로)의 결과. */
function referenceTakeOut(start: LobbyLayout, type: string, id: string) {
  const editor = new LobbyEditor(start);
  const notice = editor.takeOut(type, id);
  return { notice, layout: editor.layout, selected: editor.selected };
}

// ---------- S. 홈쇼핑 화면 ----------

describe("[spec] 086-③ 홈쇼핑 화면(S)", () => {
  test("S1 열면 GET /api/home-shopping을 한 번 부르고, 끝나기 전에는 진행 표시가 보이며 가구 카드가 없다", async () => {
    jest.mocked(getHomeShopping).mockReturnValue(new Promise(() => undefined));
    await renderHome(N0);

    await openShop();

    expect(getHomeShopping).toHaveBeenCalledTimes(1);
    expect(spinnersIn(shopModal()).length).toBeGreaterThan(0);
    expect(listCards()).toHaveLength(0);
  });

  test("S2 불러오기가 실패하면 '홈쇼핑을 불러오지 못했어요'와 '다시 시도'가 보인다", async () => {
    jest.mocked(getHomeShopping).mockRejectedValue(new Error("boom"));
    await renderHome(N0);

    await openShop();

    expect(screen.getByText("홈쇼핑을 불러오지 못했어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  test("S3 '다시 시도'를 누르면 다시 불러(모두 2번) 실패 문구가 사라지고 목록이 보인다", async () => {
    jest.mocked(getHomeShopping).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(shop(260));
    await renderHome(N0);
    await openShop();

    await pressButton("다시 시도");

    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("홈쇼핑을 불러오지 못했어요")).toBeNull();
    expect(listCards()).toHaveLength(10);
  });

  test("S1b 닫았다가 다시 열 때도 GET /api/home-shopping을 다시 부르고(모두 2번), 끝나기 전에는 진행 표시가 보인다", async () => {
    await renderHome(N0);
    await openShop();
    expect(listCards()).toHaveLength(10);
    await closeShopWithX();
    jest.mocked(getHomeShopping).mockReturnValue(new Promise(() => undefined));

    await openShop();

    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    expect(spinnersIn(shopModal()).length).toBeGreaterThan(0);
  });

  test("S2b 닫았다가 다시 열 때 불러오기가 실패하면 '홈쇼핑을 불러오지 못했어요'와 '다시 시도'가 보인다", async () => {
    await renderHome(N0);
    await openShop();
    expect(listCards()).toHaveLength(10);
    await closeShopWithX();
    jest.mocked(getHomeShopping).mockRejectedValue(new Error("boom"));

    await openShop();

    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    expect(screen.getByText("홈쇼핑을 불러오지 못했어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
  });

  test("S4 위 줄: 닫기(✕, '홈쇼핑 닫기'), 제목 '라룹 홈쇼핑', 'ON AIR', 잔액 '260룹'", async () => {
    await renderHome(N0);

    await openShop();

    expect(screen.getByText("✕")).toBeTruthy();
    expect(buttonOf(screen.getByText("✕"))).toBe(screen.getByRole("button", { name: SHOP_CLOSE }));
    expect(screen.getByText(TITLE)).toBeTruthy();
    expect(screen.getByText("ON AIR")).toBeTruthy();
    expect(shopBalanceText()).toBe("260룹");
  });

  test("S5 방송 칸(버튼): '침대', 정가 '300룹'(줄 그음), 할인 가격 '240룹', '20%', '자세히 보기'", async () => {
    await renderHome(N0);

    await openShop();

    const box = broadcastButton();
    expect(within(box).getByText("침대", ALL)).toBeTruthy();
    expect(pricesIn(box)).toEqual(["300룹", "240룹"]);
    expect(isStruck(within(box).getByText("300룹", ALL))).toBe(true);
    expect(isStruck(within(box).getByText("240룹", ALL))).toBe(false);
    expect(within(box).getByText("20%", ALL)).toBeTruthy();
    expect(within(box).getByText("자세히 보기", ALL)).toBeTruthy();
  });

  test("S6 홈쇼핑 화면에 라룹이 말 셋 가운데 정확히 하나가 한 번 보인다", async () => {
    await renderHome(N0);

    await openShop();

    const shown = hostLinesShown();
    expect(shown).toHaveLength(1);
    expect(within(shopModal()).queryAllByText(new RegExp(shown[0].replace(/[.*+?^${}()|[\]\\!%]/g, "\\$&")), ALL)).toHaveLength(1);
  });

  test("S7 열 때마다 고르는 값에 따라 셋 모두 나올 수 있다(고르는 값을 바꿔 세 번 열기)", async () => {
    await renderHome(N0);
    const seen = new Set<string>();
    const random = jest.spyOn(Math, "random");

    for (const value of [0, 0.5, 0.99]) {
      random.mockReturnValue(value);
      await openShop();
      const shown = hostLinesShown();
      expect(shown).toHaveLength(1);
      seen.add(shown[0]);
      await closeShopWithX();
    }

    expect([...seen].sort()).toEqual([...HOST_LINES].sort());
  });

  test("S8 방송 칸의 그림은 꾸미기 보관함과 같은 침대 아이콘이다", async () => {
    await renderHome(N0);

    await openShop();

    const sources = imageSourcesIn(broadcastButton());
    expect(sources).toHaveLength(1);
    expect(sources[0]).toEqual(actualIcon("bed"));
  });

  test("S9 목록 카드가 10개이고 이름 순서가 응답 순서(책 … 침대)이며 침대도 목록에 있다", async () => {
    await renderHome(N0);

    await openShop();

    expect(listCards().map(cardName)).toEqual(ORDER_NAMES);
  });

  test("S10 items를 거꾸로 주면 목록도 거꾸로다(앱이 다시 줄 세우지 않는다)", async () => {
    const reversed = shop(260);
    reversed.items = [...reversed.items].reverse();
    jest.mocked(getHomeShopping).mockResolvedValue(reversed);
    await renderHome(N0);

    await openShop();

    expect(listCards().map(cardName)).toEqual([...ORDER_NAMES].reverse());
  });

  test("S11·S12 카드마다 접근성 이름·보이는 이름·가격이 명세대로이고(침대는 할인 가격 240룹과 '20%', 300룹이 없다) 가진 개수는 보이지 않는다", async () => {
    await renderHome(N0);

    await openShop();

    const expected: Record<string, [string, string]> = {
      책: ["40룹", "책, 40룹, 자세히 보기"],
      "작은 화분": ["50룹", "작은 화분, 50룹, 자세히 보기"],
      "탁상 스탠드": ["60룹", "탁상 스탠드, 60룹, 자세히 보기"],
      액자: ["70룹", "액자, 70룹, 자세히 보기"],
      "큰 화분": ["80룹", "큰 화분, 80룹, 자세히 보기"],
      협탁: ["100룹", "협탁, 100룹, 자세히 보기"],
      "바닥 스탠드": ["110룹", "바닥 스탠드, 110룹, 자세히 보기"],
      러그: ["150룹", "러그, 150룹, 자세히 보기"],
      옷장: ["180룹", "옷장, 180룹, 자세히 보기"],
      침대: ["240룹", "침대, 240룹, 20% 할인, 자세히 보기"]
    };
    const cards = listCards();
    expect(cards).toHaveLength(10);
    for (const card of cards) {
      const name = cardName(card);
      expect({
        name,
        label: labelOf(card),
        nameShown: within(card).queryAllByText(name, ALL).length,
        prices: pricesIn(card),
        discount: within(card).queryAllByText("20%", ALL).length
      }).toEqual({ name, label: expected[name][1], nameShown: 1, prices: [expected[name][0]], discount: name === "침대" ? 1 : 0 });
    }
    expect(within(shopModal()).queryAllByText(/개 있음/, ALL)).toHaveLength(0);
  });

  test("S13 카드마다 그 종류의 보관함 아이콘이 보인다", async () => {
    await renderHome(N0);

    await openShop();

    for (const item of ITEMS_260) {
      const card = cardOf(ORDER_NAMES[ITEMS_260.indexOf(item)]);
      expect({ type: item.type, sources: imageSourcesIn(card) }).toEqual({ type: item.type, sources: [actualIcon(item.type)] });
    }
  });

  test("S14 큰 화분(plant)에 그림이 없으면 그 카드에는 그림 대신 홈쇼핑 이름의 첫 글자 '큰'이 보이고(087 결정 2) 다른 카드는 그림 그대로다", async () => {
    jest.mocked(furnitureIcon).mockImplementation((type: string) => (type === "plant" ? undefined : actualIcon(type)));
    await renderHome(N0);

    await openShop();

    const plantCard = cardOf("큰 화분");
    expect(imageSourcesIn(plantCard)).toEqual([]);
    expect(within(plantCard).getByText("큰 화분", ALL)).toBeTruthy();
    expect(within(plantCard).getByText("큰", ALL)).toBeTruthy();
    expect(within(plantCard).queryAllByText("화", ALL)).toHaveLength(0);
    expect(imageSourcesIn(cardOf("옷장"))).toEqual([actualIcon("wardrobe")]);
  });

  test("S15 잔액 100이면 바닥 스탠드·러그·옷장·침대 카드도 열리고, 상세창에 '조금만 더 모으면 살 수 있어요'·'N룹 부족'(10, 50, 80, 140)과 막힌 'N룹 더 필요해요'가 보이며 눌러도 주문하지 않는다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop(100));
    await renderHome(N0);
    await openShop();

    const expected: Record<string, number> = { "바닥 스탠드": 10, 러그: 50, 옷장: 80, 침대: 140 };
    for (const [name, short] of Object.entries(expected)) {
      await pressNode(cardOf(name));
      const panel = detailPanel();
      const button = within(panel).getByRole("button", { name: `${short}룹 더 필요해요`, ...ALL });
      expect({
        name,
        hint: within(panel).queryAllByText("조금만 더 모으면 살 수 있어요", ALL).length,
        short: within(panel).queryAllByText(`${short}룹 부족`, ALL).length,
        disabled: isDisabled(button),
        orderButtons: within(panel).queryAllByRole("button", { name: /룹에 주문하기$/, ...ALL }).length
      }).toEqual({ name, hint: 1, short: 1, disabled: true, orderButtons: 0 });
      await pressNode(button);
      expect(orderHomeShopping).not.toHaveBeenCalled();
      await pressButton(DETAIL_CLOSE);
      expect(detailPanelOrNull()).toBeNull();
    }
  });

  test("S16 잔액 100이면 책·작은 화분·탁상 스탠드·액자·큰 화분·협탁(100 = 잔액) 상세창에 '주문 후 남는 룹'과 (100 − 가격)룹, 막히지 않은 'N룹에 주문하기'가 보이고 부족 안내가 없다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop(100));
    await renderHome(N0);
    await openShop();

    const expected: Record<string, [number, string]> = {
      책: [40, "60룹"],
      "작은 화분": [50, "50룹"],
      "탁상 스탠드": [60, "40룹"],
      액자: [70, "30룹"],
      "큰 화분": [80, "20룹"],
      협탁: [100, "0룹"]
    };
    for (const [name, [price, remaining]] of Object.entries(expected)) {
      await pressNode(cardOf(name));
      const panel = detailPanel();
      const button = within(panel).getByRole("button", { name: `${price}룹에 주문하기`, ...ALL });
      expect({
        name,
        remaining: remainingIn(panel),
        disabled: isDisabled(button),
        short: within(panel).queryAllByText(/룹 부족$|조금만 더 모으면 살 수 있어요/, ALL).length
      }).toEqual({ name, remaining, disabled: false, short: 0 });
      await pressButton(DETAIL_CLOSE);
      expect(detailPanelOrNull()).toBeNull();
    }
    expect(orderHomeShopping).not.toHaveBeenCalled();
  });

  test("S17 잔액 100이면 방송 칸을 눌러 연 침대 상세창도 '140룹 부족'과 막힌 '140룹 더 필요해요'이고 눌러도 주문하지 않는다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop(100));
    await renderHome(N0);
    await openShop();

    await pressNode(broadcastButton());

    const panel = detailPanel();
    expect(within(panel).getByText("140룹 부족", ALL)).toBeTruthy();
    const button = within(panel).getByRole("button", { name: "140룹 더 필요해요", ...ALL });
    expect(isDisabled(button)).toBe(true);
    await pressNode(button);
    expect(orderHomeShopping).not.toHaveBeenCalled();
  });

  test("S18 닫기(✕)를 누르면 홈쇼핑 제목이 사라지고 로비 머리 줄('꾸미기', '홈쇼핑')이 보인다", async () => {
    await renderHome(N0);
    await openShop();

    await closeShopWithX();

    expect(shopOpen()).toBe(false);
    expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
    expect(shopButtons()).toHaveLength(1);
  });

  test("S19 기기 뒤로 가기(모달의 닫기 요청)로 닫으면 로비로 돌아가고 꾸미기로 들어가지 않는다", async () => {
    await renderHome(N0);
    await openShop();
    const modal = shopModal();

    await act(async () => {
      (modal.props as { onRequestClose: () => void }).onRequestClose();
    });
    await flushAsync();

    expect(shopOpen()).toBe(false);
    expect(screen.queryByText(GUIDE)).toBeNull();
    expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
    expect(canvas().edit ?? null).toBeNull();
  });
});

// ---------- O. 주문 ----------

describe("[spec] 086-③ 주문(O)", () => {
  test("O1 방송 칸을 누르면 침대 상세창('상품 자세히 보기', '침대', '240룹에 주문하기', '상품 상세 닫기')이 열린다", async () => {
    await renderHome(N0);
    await openShop();

    await pressNode(broadcastButton());

    const panel = detailPanel();
    expect(within(panel).getByText("침대", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "240룹에 주문하기", ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: DETAIL_CLOSE, ...ALL })).toBeTruthy();
  });

  test.each([
    ["옷장", 180],
    ["탁상 스탠드", 60]
  ])("O2 목록의 %s 카드를 누르면 그 이름과 '%s룹에 주문하기'가 있는 상세창이 열린다", async (name, price) => {
    await renderHome(N0);
    await openShop();

    await pressNode(cardOf(name));

    const panel = detailPanel();
    expect(within(panel).getByText(name, ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: `${price}룹에 주문하기`, ...ALL })).toBeTruthy();
  });

  test("O3 상세창에서 '240룹에 주문하기'를 누르면 주문 API가 한 번 { type: 'bed', price: 240 }으로 불리고 완료 판(문구, '바로 놓기'·'계속 구경하기')이 열린다", async () => {
    await renderHome(N0);

    await orderBroadcastBed();

    expect(orderHomeShopping).toHaveBeenCalledTimes(1);
    expect(jest.mocked(orderHomeShopping).mock.calls[0][0]).toEqual({ type: "bed", price: 240 });
    expect(screen.getByRole("button", { name: "바로 놓기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "계속 구경하기" })).toBeTruthy();
  });

  test.each([
    ["침대", 240, { type: "bed", price: 240 }],
    ["옷장", 180, { type: "wardrobe", price: 180 }]
  ])("O4 목록의 %s 카드에서 주문하면 화면에 보인 가격으로 보낸다", async (name, price, body) => {
    await renderHome(N0);
    await openShop();

    await pressNode(cardOf(name));
    await pressOrder(price);

    expect(orderHomeShopping).toHaveBeenCalledTimes(1);
    expect(jest.mocked(orderHomeShopping).mock.calls[0][0]).toEqual(body);
  });

  test("O5 주문을 기다리는 동안 주문 버튼이 막히고 진행 표시가 보이며, 한 번 더 눌러도 주문 API는 1번만 불린다", async () => {
    jest.mocked(orderHomeShopping).mockReturnValue(new Promise(() => undefined));
    await renderHome(N0);
    await openShop();
    await pressNode(broadcastButton());
    const button = orderButton(240);
    expect(isDisabled(button)).toBe(false);
    expect(spinnersIn(shopModal())).toHaveLength(0);

    await pressNode(button);

    const spinners = spinnersIn(shopModal());
    expect(spinners.length).toBeGreaterThan(0);
    const busy = screen.queryByRole("button", { name: "240룹에 주문하기", ...ALL }) ?? buttonOf(spinners[0]);
    expect(busy).not.toBeNull();
    expect(isDisabled(busy!)).toBe(true);
    await pressNode(busy!);
    expect(orderHomeShopping).toHaveBeenCalledTimes(1);
  });

  test("O6 상세창을 '상품 상세 닫기'로 닫으면 주문 API가 불리지 않으며 잔액은 '260룹' 그대로다", async () => {
    await renderHome(N0);
    await openShop();
    await pressNode(broadcastButton());

    await pressButton(DETAIL_CLOSE);

    expect(detailPanelOrNull()).toBeNull();
    expect(orderHomeShopping).not.toHaveBeenCalled();
    expect(shopBalanceText()).toBe("260룹");
  });

  test("O7 주문 뒤 위 줄 잔액 '20룹'이고, 가진 개수는 목록에 보이지 않는다", async () => {
    await renderHome(N0);

    await orderBroadcastBed();

    expect(shopBalanceText()).toBe("20룹");
    await pressButton("계속 구경하기");
    expect(listCards()).toHaveLength(10);
    expect(within(shopModal()).queryAllByText(/개 있음/, ALL)).toHaveLength(0);
  });

  test("O8 주문 뒤 '계속 구경하기'하면 잔액 20이라 책 상세창 '20룹 부족'·'20룹 더 필요해요' 막힘, 침대 상세창 '220룹 더 필요해요'", async () => {
    await renderHome(N0);
    await orderBroadcastBed();

    await pressButton("계속 구경하기");

    await pressNode(cardOf("책"));
    expect(within(detailPanel()).getByText("20룹 부족", ALL)).toBeTruthy();
    expect(isDisabled(screen.getByRole("button", { name: "20룹 더 필요해요", ...ALL }))).toBe(true);
    await pressButton(DETAIL_CLOSE);
    await pressNode(cardOf("침대"));
    expect(within(detailPanel()).getByText("220룹 부족", ALL)).toBeTruthy();
    expect(within(detailPanel()).getByRole("button", { name: "220룹 더 필요해요", ...ALL })).toBeTruthy();
  });

  test("O9 주문 뒤 기기에 기억한 배치(writeloop.lobby3d.layout.v1.7)가 OK-BED의 배치(N0 + 보관함 [bed-1])다", async () => {
    await renderHome(N0);

    await orderBroadcastBed();
    await flushAsync();

    const remembered = await rememberedLayout();
    expect(remembered).not.toBeNull();
    expect(sortedItems(remembered!)).toEqual(sortedItems(N0));
    expect(storedItems(remembered!)).toEqual([{ id: "bed-1", type: "bed" }]);
  });

  test("O10 주문 뒤 '계속 구경하기' → 닫기 → '꾸미기'에서 보관함 줄 머리 '보관함 1', 칸 '침대'(배치를 다시 받지 않아도)", async () => {
    await renderHome(N0);
    const loadsBefore = jest.mocked(getLobbyLayout).mock.calls.length;
    await orderBroadcastBed();
    await pressButton("계속 구경하기");
    await closeShopWithX();

    await enterEdit();

    expect(jest.mocked(getLobbyLayout).mock.calls.length).toBe(loadsBefore);
    expect(storageHeaders()).toEqual(["보관함 1"]);
    expect(trayCells()).toEqual(["침대"]);
  });

  test("O11 O10에서 깔개를 치운 뒤 '완료'하면 배치 저장이 한 번 불리고 보낸 보관함에 bed-1과 rug가 모두 있다", async () => {
    await renderHome(N0);
    await orderBroadcastBed();
    await pressButton("계속 구경하기");
    await closeShopWithX();
    await enterEdit();

    await tapHit(hit({ x: 4.6, z: 7.2 }, "rug"));
    expect(canvas().edit!.lifted).toBe("rug");
    await pressButton("치우기");
    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const sent = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(storedIds(sent).sort()).toEqual(["bed-1", "rug"]);
  });

  test("O12 '계속 구경하기'를 누르면 완료 판이 닫히고 홈쇼핑 목록에 머문다(꾸미기에 들어가지 않는다)", async () => {
    await renderHome(N0);
    await orderBroadcastBed();

    await pressButton("계속 구경하기");

    expect(screen.queryByText(DELIVERED, ALL)).toBeNull();
    expect(detailPanelOrNull()).toBeNull();
    expect(shopOpen()).toBe(true);
    expect(listCards()).toHaveLength(10);
    expect(canvas().edit ?? null).toBeNull();
  });

  test("O13 이어서 책을 주문하면 { type: 'books', price: 40 }으로 불리고 잔액 '160룹'", async () => {
    jest
      .mocked(orderHomeShopping)
      .mockResolvedValueOnce({ ...okBed(), balance: 200 })
      .mockResolvedValueOnce({
        type: "books",
        price: 40,
        balance: 160,
        owned: 1,
        itemId: "books-1",
        layout: withStored([
          { id: "bed-1", type: "bed" },
          { id: "books-1", type: "books" }
        ])
      });
    await renderHome(N0);
    await orderBroadcastBed();
    await pressButton("계속 구경하기");

    await pressNode(cardOf("책"));
    await pressOrder(40);

    expect(orderHomeShopping).toHaveBeenCalledTimes(2);
    expect(jest.mocked(orderHomeShopping).mock.calls[1][0]).toEqual({ type: "books", price: 40 });
    expect(shopBalanceText()).toBe("160룹");
  });

  /** 실패한 주문 뒤 바뀐 것이 없는지: 완료 판 없음, 상세창은 남음(087 명세 7), 잔액 그대로, 로비 배치·기억한 배치에 bed-1 없음. */
  async function expectNothingChanged() {
    expect(screen.queryByText(DELIVERED, ALL)).toBeNull();
    expect(detailPanelOrNull()).not.toBeNull();
    expect(isDisabled(orderButton(240))).toBe(false);
    expect(shopBalanceText()).toBe("260룹");
    expect(storedIds(activeLobbyLayout())).toEqual([]);
    expect(storedIds(await rememberedLayout())).toEqual([]);
  }

  test.each([
    ["O14 룹 모자람", new ApiError("룹이 모자라요.", 409, "NOT_ENOUGH_LOOP_POINTS"), "룹이 모자라요."],
    ["O15 40개", new ApiError("가구는 40개까지 둘 수 있어요.", 409, "LAYOUT_FULL"), "가구는 40개까지 둘 수 있어요."],
    ["O17 서버 문구 없음(화면 쪽)", new ApiError("", 500), ORDER_FAILED],
    ["O18 네트워크 오류", new TypeError("Network request failed"), ORDER_FAILED]
  ])("%s: 상세창이 남고 알림 문구가 보이며 바뀐 것이 없다", async (_label, error, message) => {
    jest.mocked(orderHomeShopping).mockRejectedValue(error);
    await renderHome(N0);
    await openShop();
    await pressNode(broadcastButton());

    await pressOrder(240);

    expect(screen.getByText(message, ALL)).toBeTruthy();
    expect(screen.queryByText("Network request failed", ALL)).toBeNull();
    await expectNothingChanged();
  });

  test("O16 PRICE_CHANGED면 알림 '가격이 바뀌었어요. 다시 확인해 주세요.'가 보이고, 목록을 다시 불러(모두 2번) 방송 칸이 책 40룹(줄 그음)·32룹, 목록 침대가 300룹이 된다", async () => {
    const changed = shop(260);
    changed.broadcast = { type: "books", price: 40, salePrice: 32 };
    changed.items = changed.items.map((item) =>
      item.type === "books" ? { ...item, salePrice: 32 } : item.type === "bed" ? { ...item, salePrice: null } : item
    );
    jest.mocked(getHomeShopping).mockResolvedValueOnce(shop(260)).mockResolvedValueOnce(changed);
    jest.mocked(orderHomeShopping).mockRejectedValue(new ApiError("가격이 바뀌었어요. 다시 확인해 주세요.", 409, "PRICE_CHANGED"));
    await renderHome(N0);
    await openShop();
    await pressNode(broadcastButton());

    await pressOrder(240);

    expect(screen.getByText("가격이 바뀌었어요. 다시 확인해 주세요.", ALL)).toBeTruthy();
    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    const box = broadcastButton();
    expect(within(box).getByText("책", ALL)).toBeTruthy();
    expect(pricesIn(box)).toEqual(["40룹", "32룹"]);
    expect(isStruck(within(box).getByText("40룹", ALL))).toBe(true);
    expect(pricesIn(cardOf("침대"))).toEqual(["300룹"]);
    expect(screen.queryByText(DELIVERED, ALL)).toBeNull();
  });

  test("O19 실패 뒤 상세창의 '240룹에 주문하기'를 다시 누르면 주문을 다시 보낸다(모두 2번)", async () => {
    jest.mocked(orderHomeShopping).mockRejectedValue(new ApiError("룹이 모자라요.", 409, "NOT_ENOUGH_LOOP_POINTS"));
    await renderHome(N0);
    await openShop();
    await pressNode(broadcastButton());
    await pressOrder(240);
    expect(orderHomeShopping).toHaveBeenCalledTimes(1);

    await pressOrder(240);

    expect(orderHomeShopping).toHaveBeenCalledTimes(2);
    expect(jest.mocked(orderHomeShopping).mock.calls[1][0]).toEqual({ type: "bed", price: 240 });
  });

  test("O20 (03 결정 3) 주문으로 보관함만 바뀐 배치를 받으면 로비 3D를 다시 짓지 않는다(layoutKey 그대로, 로비의 지금 배치 보관함에 bed-1)", async () => {
    await renderHome(N0);
    const keyBefore = canvas().layoutKey;

    await orderBroadcastBed();
    await pressButton("계속 구경하기");
    await closeShopWithX();

    expect(storedIds(activeLobbyLayout())).toEqual(["bed-1"]);
    expect(canvas().layoutKey).toBe(keyBefore);
  });
});

// ---------- P. 바로 놓기 ----------

describe("[spec] 086-③ 바로 놓기(P)", () => {
  test("P1 '바로 놓기'를 누르면 홈쇼핑이 닫히고 꾸미기가 열린다(취소·처음 배치로·완료·보관함 줄, 아래 탭 막대 숨김)", async () => {
    await renderHome(N0);
    await orderBroadcastBed();
    expect(screen.getByText("내정보")).toBeTruthy();

    await pressButton("바로 놓기");

    expect(shopOpen()).toBe(false);
    expectEditing();
    expect(screen.queryByText("내정보")).toBeNull();
  });

  test("P2 꾸미기에서 bed-1이 방에 놓여 있고 보관함은 비었으며, 자리·방향·골라짐이 OK-BED 배치에서 '침대' 칸을 누른 결과와 같다", async () => {
    await renderHome(N0);
    await orderBroadcastBed();
    const reference = referenceTakeOut(okBed().layout, "bed", "bed-1");
    expect(reference.notice).toBeNull();

    await pressButton("바로 놓기");

    const placed = editLayout().items.find((item) => item.id === "bed-1");
    expect(placed).toEqual(reference.layout.items.find((item) => item.id === "bed-1"));
    expect(storedIds(editLayout())).toEqual([]);
    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(canvas().edit!.lifted).toBe(reference.selected);
    expect(canvas().edit!.lifted).toBe("bed-1");
  });

  test("P3 응답 배치가 깔개를 보관함에 넣은 배치 + bed-1이면, 꾸미기에서 깔개는 보관함('보관함 1', 칸 '깔개')이고 bed-1은 방에 있다", async () => {
    const items = DEFAULT_LOBBY_LAYOUT.items.filter((item) => item.id !== "rug");
    const response: HomeShoppingOrderResult = {
      ...okBed(),
      layout: JSON.parse(
        JSON.stringify(
          makeLayout(items, [
            { id: "rug", type: "rug" },
            { id: "bed-1", type: "bed" }
          ])
        )
      ) as LobbyLayout
    };
    jest.mocked(orderHomeShopping).mockResolvedValue(response);
    await renderHome(N0);
    await orderBroadcastBed();

    await pressButton("바로 놓기");

    expect(storageHeaders()).toEqual(["보관함 1"]);
    expect(trayCells()).toEqual(["깔개"]);
    expect(editLayout().items.some((item) => item.id === "bed-1")).toBe(true);
    expect(editLayout().items.some((item) => item.id === "rug")).toBe(false);
  });

  test("P4 놓을 자리가 없는 배치(책상 받침 자리가 다 참)에서 산 책을 바로 놓으면 '놓을 자리가 없어요…' 알림이 뜨고 책은 보관함 칸으로 남는다", async () => {
    const full = makeLayout(
      [
        ...DEFAULT_LOBBY_LAYOUT.items,
        { id: "smallPlant-1", type: "smallPlant", on: { parent: "desk", slot: 1, facing: 0 } },
        { id: "books-1", type: "books", on: { parent: "desk", slot: 2, facing: 0 } }
      ] as LobbyLayout["items"],
      [{ id: "books-2", type: "books" }]
    );
    const response: HomeShoppingOrderResult = {
      type: "books",
      price: 40,
      balance: 220,
      owned: 1,
      itemId: "books-2",
      layout: JSON.parse(JSON.stringify(full)) as LobbyLayout
    };
    // 전제: 지금 꺼내기 규칙으로 이 배치에서 books-2를 꺼내면 자리 없음이다
    expect(referenceTakeOut(response.layout, "books", "books-2").notice).toBe("no-room");
    jest.mocked(orderHomeShopping).mockResolvedValue(response);
    await renderHome(N0);
    await openShop();
    await pressNode(cardOf("책"));
    await pressOrder(40);
    expect(screen.getByText(DELIVERED, ALL)).toBeTruthy();

    await pressButton("바로 놓기");

    expectEditing(false);
    expect(screen.getByText(NO_ROOM)).toBeTruthy();
    expect(storedIds(editLayout())).toEqual(["books-2"]);
    expect(editLayout().items.some((item) => item.id === "books-2")).toBe(false);
    expect(trayCells()).toEqual(["책"]);
  });

  test("P5 바로 놓기 뒤 '완료'하면 배치 저장이 한 번 불리고 보낸 방에 bed-1이 P2의 자리로 있다", async () => {
    await renderHome(N0);
    await orderBroadcastBed();
    const reference = referenceTakeOut(okBed().layout, "bed", "bed-1");
    await pressButton("바로 놓기");

    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const sent = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(sent.items.find((item) => item.id === "bed-1")).toEqual(reference.layout.items.find((item) => item.id === "bed-1"));
  });

  test("P6 바로 놓기 뒤 '취소'하면 저장하지 않고, 다시 '꾸미기'에 들어가면 bed-1이 보관함에 있다('보관함 1', 칸 '침대')", async () => {
    await renderHome(N0);
    await orderBroadcastBed();
    await pressButton("바로 놓기");

    await pressButton("취소");
    await enterEdit();

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(storageHeaders()).toEqual(["보관함 1"]);
    expect(trayCells()).toEqual(["침대"]);
  });

  test("P7 바로 놓기로 연 꾸미기에서는 '홈쇼핑' 버튼과 잔액 칩이 없다", async () => {
    await renderHome(N0);
    await orderBroadcastBed();

    await pressButton("바로 놓기");

    expect(shopButtons()).toHaveLength(0);
    expect(chips()).toHaveLength(0);
  });
});
