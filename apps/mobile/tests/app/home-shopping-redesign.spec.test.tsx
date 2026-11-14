// [spec] qa 테스트(작업 087 홈쇼핑 화면 개편, 기능 변경, 모바일): 새 홈쇼핑 화면의 분류 탭(C), 상품 상세창(D), 오늘의 방송 표시(B),
// 주문 완료 판(F)과, 그대로 둘 동작인 닫은 뒤 늦게 온 주문 응답 처리(K)를 홈 화면 단위로 본다.
// 기대값은 명세(private 작업 폴더 087-2026-11-13-홈쇼핑-화면-개편/01-main-spec.md의 "바뀌는 동작" 표·"화면" 1~8, "그대로여야 할 동작")에서만 가져온다.
// K는 지금 동작(5fa69bc·06dd161의 늦은 응답 처리)을 그대로 적는다. 주문을 시작하는 조작만 고치기 전 화면(확인 판)과 새 화면(상세창) 둘 다 되게 해,
// 고치기 전에도 통과해야 한다.
// 홈 틀(가짜 API·기기 저장소·로그인 상태·라우터·포커스·3D 그리기)과 홈쇼핑 화면 도우미는 home-shopping-screen.spec.test.tsx와 같다.
// 구현 전에 쓴 것이라 화면 요소는 명세가 준 글·접근성 이름으로만 찾는다: 카드 "<이름>, N룹(, 20% 할인), 자세히 보기", 방송 칸은 줄 그은 정가를 품은 버튼,
// 상세창은 "상품 자세히 보기"·"상품 상세 닫기", 주문 버튼 "N룹에 주문하기"/"N룹 더 필요해요", 완료 판 "보관함에 도착했어요".
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
import { activeLobbyLayout, applyLobbyLayout } from "@/lib/lobby3d/engine";
import { furnitureIcon } from "@/lib/lobby3d/furniture-icons";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, storedItems, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, HomeShopping, HomeShoppingOrderResult, LoopPointsSummary, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

type UiNode = ReturnType<typeof screen.getByRole>;

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

// 090-② 05 결정 3: 일곱 밖 가구의 모델·아이콘은 서버 목록의 파일을 받아 쓴다. 이 테스트는 그 파일을 기기에 이미 받아 둔 것으로 둔다
// (기기에 있는 파일이면 그 파일의 기기 주소를 준다. 받기·기기 저장 자체는 090-② 테스트 furniture-download*.spec이 본다).
jest.mock("@/lib/item-files", () => ({
  ...jest.requireActual<typeof import("@/lib/item-files")>("@/lib/item-files"),
  cachedItemFile: (ref: { url: string } | null | undefined) => (ref ? `file:///qa-received/${ref.url.split("/").pop()}` : null)
}));
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

// ---------- 090-② 05 결정 3: 일곱 밖 가구는 서버 목록의 받은 파일 ----------
// 앱에 든 가구 파일은 처음 방 일곱(모델)과 옷장·깔개·스탠드(아이콘)뿐이다. 그 밖의 가구는 서버 아이템 목록(assets)의 파일을 받아 그린다.
// 그래서 테스트마다 일곱 밖 가구의 파일이 든 목록을 지금 목록으로 둔다. 이름·홈쇼핑 이름·설명·분류는 앱에 든 값 그대로이고 그리기 정보는 없다(앱 값).
const RECEIVED_FURNITURE = ["bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame"];
const RECEIVED_CATEGORIES = ["furniture", "lighting", "decor", "plants"] as const;
function receivedFile(ext: "glb" | "png", digit: string) {
  const sha256 = digit.repeat(64);
  return { url: `/api/catalog/files/${sha256}.${ext}`, sha256, bytes: 1000 };
}
/** 일곱 밖 가구의 파일이 든 목록을 지금 목록으로 둔다. */
function setReceivedFurnitureCatalog() {
  const store = jest.requireActual<typeof import("@/lib/item-catalog-store")>("@/lib/item-catalog-store");
  const kinds = jest.requireActual<typeof import("@/lib/lobby3d/furniture-catalog")>("@/lib/lobby3d/furniture-catalog");
  const shop = jest.requireActual<typeof import("@/components/home/home-shopping-catalog")>("@/components/home/home-shopping-catalog");
  store.setItemCatalog({
    version: "qa-received-furniture",
    items: RECEIVED_FURNITURE.map((id, index) => ({
      id,
      kind: "furniture" as const,
      name: kinds.furnitureType(id).name,
      shopName: shop.shopProductName(id),
      description: shop.shopProductDescription(id),
      category: RECEIVED_CATEGORIES.find((category) => shop.inShopCategory(id, category)) ?? null,
      slot: null,
      price: null,
      draw: null,
      assets: { model: receivedFile("glb", String(index + 1)), icon: receivedFile("png", "abcdef9"[index]) }
    }))
  });
}

// ---------- 시나리오 공통 값 ----------

const TITLE = "라룹 홈쇼핑";

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

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
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

/** 진짜 아이콘 표의 그림. */
function actualIcon(type: string) {
  return jest.requireActual<typeof import("@/lib/lobby3d/furniture-icons")>("@/lib/lobby3d/furniture-icons").furnitureIcon(type);
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
  // 090-② 05 결정 3: 일곱 밖 가구의 파일이 든 서버 목록
  setReceivedFurnitureCatalog();
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
const DELIVERED = "보관함에 도착했어요";
const DETAIL_TITLE = "상품 자세히 보기";
const DETAIL_CLOSE = "상품 상세 닫기";
const SHOP_CLOSE = "홈쇼핑 닫기";
const ORDER_FAILED = "주문하지 못했어요. 다시 시도해 주세요";
/** ITEMS_260 순서의 홈쇼핑 이름(087 명세 표). */
const ORDER_NAMES = ["책", "작은 화분", "탁상 스탠드", "액자", "큰 화분", "협탁", "바닥 스탠드", "러그", "옷장", "침대"];
/** 카드의 접근성 이름: "<이름>, N룹, 자세히 보기" 또는 "<이름>, N룹, 20% 할인, 자세히 보기". */
const CARD_LABEL = /^(.+), (\d+)룹, (20% 할인, )?자세히 보기$/;

async function openShop() {
  await fireEvent.press(shopButtons()[0]);
  await flushAsync();
}

async function pressNode(node: UiNode) {
  await fireEvent.press(node);
  await flushAsync();
}

/** 가려진 것까지 찾아 누른다(상세창 뒤의 위 줄 닫기 등). */
async function pressAnyButton(label: string) {
  await pressNode(screen.getByRole("button", { name: label, ...ALL }));
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

function storedIds(value: LobbyLayout | null | undefined): string[] {
  return storedItems(value ?? { items: [] }).map((item) => item.id);
}

// ---------- 087 추가 값·도우미 ----------

/** 087 명세 표: 종류 id → 홈쇼핑 이름, 분류, 짧은 설명, 놓는 위치, 차지하는 크기(furniture-catalog의 mount·size 규칙). */
const SHOP_TABLE: Record<string, { name: string; tab: string; description: string; mount: string; size: string }> = {
  bed: { name: "침대", tab: "가구", description: "하루를 마무리하는 포근한 자리예요.", mount: "바닥에 놓기", size: "2 × 3칸" },
  wardrobe: { name: "옷장", tab: "가구", description: "방 한쪽을 차분하게 채우는 기본 옷장이에요.", mount: "바닥에 놓기", size: "1 × 1칸" },
  nightstand: { name: "협탁", tab: "가구", description: "윗면에 조명이나 작은 소품을 올려 보세요.", mount: "바닥에 놓기", size: "1 × 1칸" },
  lamp: { name: "탁상 스탠드", tab: "조명", description: "책상이나 협탁 위를 따뜻하게 밝혀 줘요.", mount: "책상·협탁 위", size: "소품 자리 1칸" },
  floorLamp: { name: "바닥 스탠드", tab: "조명", description: "침대 옆이나 방 구석에 작은 빛을 더해요.", mount: "바닥에 놓기", size: "1 × 1칸" },
  frame: { name: "액자", tab: "장식", description: "허전한 벽을 채우는 작은 그림이에요.", mount: "벽에 걸기", size: "가로 1칸" },
  rug: { name: "러그", tab: "장식", description: "가구 아래에 깔아 공간을 아늑하게 묶어 줘요.", mount: "바닥에 깔기", size: "3 × 3칸" },
  books: { name: "책", tab: "장식", description: "책 몇 권을 쌓아 나만의 독서 분위기를 만들어요.", mount: "책상·협탁 위", size: "소품 자리 1칸" },
  smallPlant: { name: "작은 화분", tab: "식물", description: "작은 초록 하나로 책상이 산뜻해져요.", mount: "책상·협탁 위", size: "소품 자리 1칸" },
  plant: { name: "큰 화분", tab: "식물", description: "빈 공간에 싱그러운 초록을 더해 보세요.", mount: "바닥에 놓기", size: "1 × 1칸" }
};
const TABS = ["전체", "가구", "조명", "장식", "식물"];
const DESCRIPTIONS = Object.values(SHOP_TABLE).map((row) => row.description);

/** 누를 수 있는 조상(버튼·탭 역할이나 onPress). */
function pressableOf(node: UiNode): UiNode | null {
  for (let n: UiNode | null = node; n; n = n.parent) {
    const props = n.props as { accessibilityRole?: unknown; role?: unknown; onPress?: unknown };
    const role = props.accessibilityRole ?? props.role;
    if (role === "button" || role === "tab" || typeof props.onPress === "function") return n;
  }
  return null;
}

/** 분류 탭(글이 그 이름인 것 가운데 카드·방송 칸·상세창 밖의 것. 목록 머리에도 같은 글이 있으면 누를 수 있는 것). */
function tabNode(name: string): UiNode {
  const cards = listCards();
  const broadcast = broadcastButtonOrNull();
  const panel = detailPanelOrNull();
  const candidates = within(shopModal())
    .queryAllByText(name, ALL)
    .filter(
      (node) => !cards.some((card) => contains(card, node)) && !(broadcast && contains(broadcast, node)) && !(panel && contains(panel, node))
    );
  const pressable = candidates.length > 1 ? candidates.filter((node) => pressableOf(node) !== null) : candidates;
  expect(pressable).toHaveLength(1);
  return pressable[0];
}

async function pressTab(name: string) {
  await pressNode(tabNode(name));
}

/** 목록 머리의 "N가지" 글. */
function countHeader(): string {
  const found = within(shopModal()).queryAllByText(/\d+가지$/, ALL);
  expect(found).toHaveLength(1);
  return /(\d+가지)$/.exec(textOf(found[0]))![1];
}

/** 목록 머리에 분류 이름이 보이는지(누를 수 없는 글에 그 이름이 들어 있다). */
function headerShowsTab(name: string): boolean {
  return within(shopModal())
    .queryAllByText(new RegExp(name), ALL)
    .some((node) => pressableOf(node) === null);
}

/** 분류 탭의 접근성 요소(탭 글에서 올라가 처음 만나는 버튼·탭 역할). */
function tabElement(name: string): UiNode {
  for (let n: UiNode | null = tabNode(name); n; n = n.parent) {
    const props = n.props as { accessibilityRole?: unknown; role?: unknown };
    const role = props.accessibilityRole ?? props.role;
    if (role === "button" || role === "tab") return n;
  }
  throw new Error(`탭 '${name}'에 버튼·탭 역할이 없다`);
}

/** 접근성 상태 선택됨(aria-selected나 accessibilityState.selected). */
function isSelected(node: UiNode): boolean {
  const props = node.props as { accessibilityState?: { selected?: boolean }; "aria-selected"?: boolean };
  return (props["aria-selected"] ?? props.accessibilityState?.selected) === true;
}

/** 방송 종료까지 남은 시간 "H:MM:SS"(한 글이든, "방송 종료까지"와 시간이 따로 있든). */
function countdown(): string {
  const full = screen.queryAllByText(/^방송 종료까지\s*\d+:\d{2}:\d{2}$/, ALL);
  if (full.length > 0) {
    expect(full).toHaveLength(1);
    return /(\d+:\d{2}:\d{2})$/.exec(textOf(full[0]))![1];
  }
  expect(screen.queryAllByText(/방송 종료까지/, ALL)).toHaveLength(1);
  const time = screen.queryAllByText(/^\d+:\d{2}:\d{2}$/, ALL);
  expect(time).toHaveLength(1);
  return textOf(time[0]);
}

/** 완료 판(“보관함에 도착했어요”에서 '바로 놓기'를 품은 조상까지). */
function completionPanel(): UiNode {
  for (let n: UiNode | null = screen.getByText(DELIVERED, ALL); n; n = n.parent) {
    if (within(n).queryAllByRole("button", { name: "바로 놓기", ...ALL }).length > 0) return n;
  }
  throw new Error("완료 판이 없다");
}

/** 지금 맨 위 판의 기기 뒤로 가기: 그 글을 품은 가장 가까운 Modal의 닫기 요청(상세창이 따로 Modal이어도 그 Modal이 받는다). */
async function backFrom(text: string) {
  let modal: UiNode | null = null;
  for (let n: UiNode | null = screen.getByText(text, ALL); n; n = n.parent) {
    if ((n.type as unknown) === "Modal") {
      modal = n;
      break;
    }
  }
  expect(modal).not.toBeNull();
  await act(async () => {
    (modal!.props as { onRequestClose: () => void }).onRequestClose();
  });
  await flushAsync();
}

function okRug(): HomeShoppingOrderResult {
  return { type: "rug", price: 150, balance: 110, owned: 2, itemId: "rug-1", layout: withStored([{ id: "rug-1", type: "rug" }]) };
}

function chipText(): string | null {
  const found = chips();
  expect(found.length).toBeLessThanOrEqual(1);
  return found.length === 0 ? null : textOf(found[0]);
}

/**
 * (그대로 둘 동작 K) 침대 주문을 시작한다. 고치기 전 화면(방송 칸 '주문하기' → 확인 판 '주문')과
 * 새 화면(침대 카드 → 상세창 '240룹에 주문하기') 어느 쪽에서도 같은 주문을 보내게 해, 늦은 응답 처리를 고치기 전후로 같이 본다.
 */
async function startBedOrder() {
  const card = screen.queryAllByRole("button", { name: "침대, 240룹, 20% 할인, 자세히 보기", ...ALL });
  if (card.length > 0) {
    await pressNode(card[0]);
    await pressOrder(240);
    return;
  }
  const oldBox = screen.getByLabelText("오늘의 방송 상품");
  await pressNode(within(oldBox).getByText("주문하기"));
  await pressButton("주문");
}

function deliveredShown(): boolean {
  return screen.queryAllByText(/보관함에 도착했어요$/, ALL).length > 0;
}

// ---------- C. 분류 ----------

describe("[spec] 087 분류 탭(C)", () => {
  test("C1 탭 다섯 개(전체·가구·조명·장식·식물)가 보이고, 처음 목록은 전체 10가지이며 목록 머리에 '전체'와 '10가지'가 보인다", async () => {
    await renderHome(N0);

    await openShop();

    for (const name of TABS) expect({ name, tab: tabNode(name) !== null }).toEqual({ name, tab: true });
    expect(listCards().map(cardName)).toEqual(ORDER_NAMES);
    expect(countHeader()).toBe("10가지");
    expect(headerShowsTab("전체")).toBe(true);
  });

  test.each([
    ["가구", ["협탁", "옷장", "침대"], "3가지"],
    ["조명", ["탁상 스탠드", "바닥 스탠드"], "2가지"],
    ["장식", ["책", "액자", "러그"], "3가지"],
    ["식물", ["작은 화분", "큰 화분"], "2가지"]
  ])("C2 '%s' 탭을 누르면 목록이 그 분류만 서버 순서로(%j) 보이고 목록 머리가 그 이름과 '%s'다. '전체'로 돌아가면 10가지", async (tab, names, count) => {
    await renderHome(N0);
    await openShop();

    await pressTab(tab);

    expect(listCards().map(cardName)).toEqual(names);
    expect(countHeader()).toBe(count);
    expect(headerShowsTab(tab)).toBe(true);
    await pressTab("전체");
    expect(listCards().map(cardName)).toEqual(ORDER_NAMES);
    expect(countHeader()).toBe("10가지");
  });

  test("C3 items를 거꾸로 주면 '가구' 탭 순서도 거꾸로다(침대, 옷장, 협탁)", async () => {
    const reversed = shop(260);
    reversed.items = [...reversed.items].reverse();
    jest.mocked(getHomeShopping).mockResolvedValue(reversed);
    await renderHome(N0);
    await openShop();

    await pressTab("가구");

    expect(listCards().map(cardName)).toEqual(["침대", "옷장", "협탁"]);
  });

  test("C4 표에 없는 종류(bookcase)는 앱 가구 목록 이름 '책장'으로 '전체'에만 보이고(11가지), 상세창에 표의 설명이 없으며 놓는 위치·크기는 카탈로그 규칙('바닥에 놓기', '1 × 1칸')이다", async () => {
    const withUnknown = shop(260);
    withUnknown.items = [...withUnknown.items, { type: "bookcase", price: 90, salePrice: null, owned: 0 }];
    jest.mocked(getHomeShopping).mockResolvedValue(withUnknown);
    await renderHome(N0);
    await openShop();

    expect(listCards().map(cardName)).toEqual([...ORDER_NAMES, "책장"]);
    expect(labelOf(cardOf("책장"))).toBe("책장, 90룹, 자세히 보기");
    expect(countHeader()).toBe("11가지");
    for (const tab of ["가구", "조명", "장식", "식물"]) {
      await pressTab(tab);
      expect({ tab, names: listCards().map(cardName).includes("책장") }).toEqual({ tab, names: false });
    }
    await pressTab("전체");
    await pressNode(cardOf("책장"));
    const panel = detailPanel();
    expect(within(panel).getByText("책장", ALL)).toBeTruthy();
    for (const description of DESCRIPTIONS) expect({ description, shown: within(panel).queryAllByText(description, ALL).length }).toEqual({ description, shown: 0 });
    expect(within(panel).getByText("바닥에 놓기", ALL)).toBeTruthy();
    expect(within(panel).getByText("1 × 1칸", ALL)).toBeTruthy();
  });

  test("C5 (087 결정 2) 고른 분류 탭만 접근성 상태가 선택됨(selected)이다: 처음은 '전체', '조명'을 누르면 '조명'만", async () => {
    await renderHome(N0);
    await openShop();

    expect(TABS.map((name) => [name, isSelected(tabElement(name))])).toEqual(TABS.map((name) => [name, name === "전체"]));
    await pressTab("조명");
    expect(TABS.map((name) => [name, isSelected(tabElement(name))])).toEqual(TABS.map((name) => [name, name === "조명"]));
  });
});

// ---------- D. 상세창 ----------

describe("[spec] 087 상품 상세(D)", () => {
  test.each(Object.keys(SHOP_TABLE))("D1 %s 카드를 누르면 상세창에 제목·닫기·큰 그림·홈쇼핑 이름·짧은 설명·놓는 위치·차지하는 크기가 표대로 보이고 가진 개수는 없다", async (type) => {
    await renderHome(N0);
    await openShop();
    const row = SHOP_TABLE[type];

    await pressNode(cardOf(row.name));

    const panel = detailPanel();
    expect(within(panel).getByText(DETAIL_TITLE, ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: DETAIL_CLOSE, ...ALL })).toBeTruthy();
    expect(imageSourcesIn(panel)).toContainEqual(actualIcon(type));
    expect(within(panel).getByText(row.name, ALL)).toBeTruthy();
    expect(within(panel).getByText(row.description, ALL)).toBeTruthy();
    expect(within(panel).getByText("놓는 위치", ALL)).toBeTruthy();
    expect(within(panel).getByText(row.mount, ALL)).toBeTruthy();
    expect(within(panel).getByText("차지하는 크기", ALL)).toBeTruthy();
    expect(within(panel).getByText(row.size, ALL)).toBeTruthy();
    expect(within(panel).queryAllByText(/\d+\s*개/, ALL)).toHaveLength(0);
    expect(within(panel).queryAllByText(/보유/, ALL)).toHaveLength(0);
  });

  test("D2 방송 칸을 누르면 침대 상세창: 설명, '바닥에 놓기', '2 × 3칸', '주문 후 남는 룹' '20룹', 막히지 않은 '240룹에 주문하기'", async () => {
    await renderHome(N0);
    await openShop();

    await pressNode(broadcastButton());

    const panel = detailPanel();
    expect(within(panel).getByText("침대", ALL)).toBeTruthy();
    expect(within(panel).getByText(SHOP_TABLE.bed.description, ALL)).toBeTruthy();
    expect(within(panel).getByText("바닥에 놓기", ALL)).toBeTruthy();
    expect(within(panel).getByText("2 × 3칸", ALL)).toBeTruthy();
    expect(remainingIn(panel)).toBe("20룹");
    expect(isDisabled(within(panel).getByRole("button", { name: "240룹에 주문하기", ...ALL }))).toBe(false);
  });

  test("D3 가진 개수(owned 1인 탁상 스탠드·러그·옷장 포함)는 목록에도 상세창에도 보이지 않는다", async () => {
    await renderHome(N0);
    await openShop();

    expect(within(shopModal()).queryAllByText(/\d+\s*개|보유/, ALL)).toHaveLength(0);
    for (const name of ["탁상 스탠드", "러그", "옷장"]) {
      await pressNode(cardOf(name));
      expect({ name, owned: within(shopModal()).queryAllByText(/\d+\s*개|보유/, ALL).length }).toEqual({ name, owned: 0 });
      await pressButton(DETAIL_CLOSE);
    }
  });

  test("D4 상세창이 열려 있을 때 기기 뒤로 가기는 상세창만 닫고 홈쇼핑에 머물며, 한 번 더 누르면 홈쇼핑이 닫힌다", async () => {
    await renderHome(N0);
    await openShop();
    await pressNode(cardOf("옷장"));
    expect(detailPanelOrNull()).not.toBeNull();

    await backFrom(DETAIL_TITLE);

    expect(detailPanelOrNull()).toBeNull();
    expect(shopOpen()).toBe(true);
    expect(listCards()).toHaveLength(10);
    await backFrom(TITLE);
    expect(shopOpen()).toBe(false);
  });

  test("D5 '조명' 탭에서 카드를 열었다가 '상품 상세 닫기'로 닫으면 '조명' 목록(2가지) 그대로다", async () => {
    await renderHome(N0);
    await openShop();
    await pressTab("조명");

    await pressNode(cardOf("바닥 스탠드"));
    await pressButton(DETAIL_CLOSE);

    expect(detailPanelOrNull()).toBeNull();
    expect(listCards().map(cardName)).toEqual(["탁상 스탠드", "바닥 스탠드"]);
    expect(countHeader()).toBe("2가지");
  });

  test("D6 '식물' 탭에서 카드를 열었다가 기기 뒤로 가기로 닫으면 '식물' 목록(2가지) 그대로다", async () => {
    await renderHome(N0);
    await openShop();
    await pressTab("식물");

    await pressNode(cardOf("큰 화분"));
    await backFrom(DETAIL_TITLE);

    expect(shopOpen()).toBe(true);
    expect(listCards().map(cardName)).toEqual(["작은 화분", "큰 화분"]);
    expect(countHeader()).toBe("2가지");
  });

  test("D7 PRICE_CHANGED면 목록을 다시 불러(모두 2번) 상세창은 열린 채 새 가격('200룹에 주문하기', 남는 룹 '60룹')으로 바뀐다", async () => {
    const changed = shop(260);
    changed.items = changed.items.map((item) => (item.type === "wardrobe" ? { ...item, price: 200 } : item));
    jest.mocked(getHomeShopping).mockResolvedValueOnce(shop(260)).mockResolvedValueOnce(changed);
    jest.mocked(orderHomeShopping).mockRejectedValue(new ApiError("가격이 바뀌었어요. 다시 확인해 주세요.", 409, "PRICE_CHANGED"));
    await renderHome(N0);
    await openShop();
    await pressNode(cardOf("옷장"));

    await pressOrder(180);

    expect(screen.getByText("가격이 바뀌었어요. 다시 확인해 주세요.", ALL)).toBeTruthy();
    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    const panel = detailPanel();
    expect(within(panel).getByText("옷장", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "200룹에 주문하기", ...ALL })).toBeTruthy();
    expect(within(panel).queryAllByRole("button", { name: "180룹에 주문하기", ...ALL })).toHaveLength(0);
    expect(remainingIn(panel)).toBe("60룹");
  });

  test("D8 PRICE_CHANGED로 침대 할인이 끝나 300룹이 되면(잔액 260) 열린 상세창이 '40룹 부족'과 막힌 '40룹 더 필요해요'로 바뀐다", async () => {
    const changed = shop(260);
    changed.items = changed.items.map((item) => (item.type === "bed" ? { ...item, salePrice: null } : item));
    jest.mocked(getHomeShopping).mockResolvedValueOnce(shop(260)).mockResolvedValueOnce(changed);
    jest.mocked(orderHomeShopping).mockRejectedValue(new ApiError("가격이 바뀌었어요. 다시 확인해 주세요.", 409, "PRICE_CHANGED"));
    await renderHome(N0);
    await openShop();
    await pressNode(cardOf("침대"));

    await pressOrder(240);

    const panel = detailPanel();
    expect(within(panel).getByText("40룹 부족", ALL)).toBeTruthy();
    expect(within(panel).getByText("조금만 더 모으면 살 수 있어요", ALL)).toBeTruthy();
    expect(isDisabled(within(panel).getByRole("button", { name: "40룹 더 필요해요", ...ALL }))).toBe(true);
  });

  test("D9 (087 결정 2) 큰 화분(plant)에 그림이 없으면 상세창과 완료 판에 그림 대신 홈쇼핑 이름의 첫 글자 '큰'이 보인다", async () => {
    jest.mocked(furnitureIcon).mockImplementation((type: string) => (type === "plant" ? undefined : actualIcon(type)));
    jest
      .mocked(orderHomeShopping)
      .mockResolvedValue({ type: "plant", price: 80, balance: 180, owned: 1, itemId: "plant-1", layout: withStored([{ id: "plant-1", type: "plant" }]) });
    await renderHome(N0);
    await openShop();

    await pressNode(cardOf("큰 화분"));

    const panel = detailPanel();
    expect(imageSourcesIn(panel)).toEqual([]);
    expect(within(panel).getByText("큰", ALL)).toBeTruthy();
    expect(within(panel).queryAllByText("화", ALL)).toHaveLength(0);
    await pressOrder(80);
    const done = completionPanel();
    expect(imageSourcesIn(done)).toEqual([]);
    expect(within(done).getByText("큰", ALL)).toBeTruthy();
    expect(within(done).queryAllByText("화", ALL)).toHaveLength(0);
  });
});

// ---------- B. 오늘의 방송 ----------

describe("[spec] 087 오늘의 방송(B)", () => {
  test("B1 'ON AIR', '오늘은 20% 할인', 서울 정오(03:00Z)면 '방송 종료까지 12:00:00'이고 1초 뒤 11:59:59, 다시 60초 뒤 11:58:59", async () => {
    await renderHome(N0);
    await openShop();

    expect(screen.getByText("ON AIR", ALL)).toBeTruthy();
    expect(screen.getByText("오늘은 20% 할인", ALL)).toBeTruthy();
    expect(countdown()).toBe("12:00:00");
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(countdown()).toBe("11:59:59");
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    expect(countdown()).toBe("11:58:59");
  });

  test("B2 서울 19:30:15(10:30:15Z)에 열면 '방송 종료까지 4:29:45'", async () => {
    jest.setSystemTime(new Date("2026-11-12T10:30:15.000Z"));
    await renderHome(N0);
    await openShop();

    expect(countdown()).toBe("4:29:45");
  });

  test("B3 (087 결정 2) 방송 강조 표시 '품절 임박'과 '주문 폭주 중'이 홈쇼핑 화면에 하나씩 보인다", async () => {
    await renderHome(N0);
    await openShop();

    expect(within(shopModal()).queryAllByText("품절 임박", ALL)).toHaveLength(1);
    expect(within(shopModal()).queryAllByText("주문 폭주 중", ALL)).toHaveLength(1);
  });
});

// ---------- F. 주문 완료 ----------

describe("[spec] 087 주문 완료(F)", () => {
  test("F1 '장식' 탭에서 러그를 주문하면 같은 판이 완료로 바뀌어 러그 그림, '보관함에 도착했어요', '러그 1개 · 남은 룹 110', '계속 구경하기'·'바로 놓기'가 보이고 위 줄 잔액이 '110룹'이다", async () => {
    jest.mocked(orderHomeShopping).mockResolvedValue(okRug());
    await renderHome(N0);
    await openShop();
    await pressTab("장식");
    await pressNode(cardOf("러그"));

    await pressOrder(150);

    expect(jest.mocked(orderHomeShopping).mock.calls[0][0]).toEqual({ type: "rug", price: 150 });
    const panel = completionPanel();
    expect(imageSourcesIn(panel)).toContainEqual(actualIcon("rug"));
    expect(within(panel).getByText("러그 1개 · 남은 룹 110", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "계속 구경하기", ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "바로 놓기", ...ALL })).toBeTruthy();
    expect(shopBalanceText()).toBe("110룹");
  });

  test("F2 '계속 구경하기'를 누르면 판이 닫히고 '장식' 목록(책·액자·러그, 3가지) 그대로다", async () => {
    jest.mocked(orderHomeShopping).mockResolvedValue(okRug());
    await renderHome(N0);
    await openShop();
    await pressTab("장식");
    await pressNode(cardOf("러그"));
    await pressOrder(150);

    await pressButton("계속 구경하기");

    expect(deliveredShown()).toBe(false);
    expect(detailPanelOrNull()).toBeNull();
    expect(listCards().map(cardName)).toEqual(["책", "액자", "러그"]);
    expect(countHeader()).toBe("3가지");
  });

  test("F3 완료 판이 열려 있을 때 기기 뒤로 가기는 완료 판만 닫고 '장식' 목록에 머문다", async () => {
    jest.mocked(orderHomeShopping).mockResolvedValue(okRug());
    await renderHome(N0);
    await openShop();
    await pressTab("장식");
    await pressNode(cardOf("러그"));
    await pressOrder(150);

    await backFrom(DELIVERED);

    expect(deliveredShown()).toBe(false);
    expect(shopOpen()).toBe(true);
    expect(listCards().map(cardName)).toEqual(["책", "액자", "러그"]);
  });

  test("F4 완료 판의 이름은 홈쇼핑 이름이다(앱 가구 목록 이름 '화분'이 아니라, plant를 사면 '큰 화분 1개 · 남은 룹 180')", async () => {
    jest
      .mocked(orderHomeShopping)
      .mockResolvedValue({ type: "plant", price: 80, balance: 180, owned: 1, itemId: "plant-1", layout: withStored([{ id: "plant-1", type: "plant" }]) });
    await renderHome(N0);
    await openShop();
    await pressNode(cardOf("큰 화분"));

    await pressOrder(80);

    expect(within(completionPanel()).getByText("큰 화분 1개 · 남은 룹 180", ALL)).toBeTruthy();
  });
});

// ---------- K. 그대로 둘 동작: 닫은 뒤 늦게 온 주문 응답 ----------

describe("[spec] 087 그대로 둘 동작: 늦은 주문 응답(K)", () => {
  test("K1 주문을 기다리는 동안 닫고 다시 연 뒤 성공 응답이 오면, 새 화면에 완료 판이 열리지 않고 위 줄 잔액은 새로 불러온 '260룹'이며, 로비 배치에는 bed-1이 들어가고 닫으면 로비 칩이 '20룹'이다. 새 화면에서 다시 주문할 수 있다", async () => {
    let resolveOrder: (value: HomeShoppingOrderResult) => void = () => undefined;
    jest.mocked(orderHomeShopping).mockReturnValueOnce(
      new Promise<HomeShoppingOrderResult>((resolve) => {
        resolveOrder = resolve;
      })
    );
    await renderHome(N0);
    await openShop();
    await startBedOrder();
    await pressAnyButton(SHOP_CLOSE);
    expect(shopOpen()).toBe(false);
    await openShop();
    expect(getHomeShopping).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveOrder(okBed());
    });
    await flushAsync();

    expect(deliveredShown()).toBe(false);
    expect(shopBalanceText()).toBe("260룹");
    expect(storedIds(activeLobbyLayout())).toEqual(["bed-1"]);
    await startBedOrder();
    expect(orderHomeShopping).toHaveBeenCalledTimes(2);
    expect(jest.mocked(orderHomeShopping).mock.calls[1][0]).toEqual({ type: "bed", price: 240 });
    expect(deliveredShown()).toBe(true);
  });

  test("K2 주문을 기다리는 동안 닫은 뒤 성공 응답이 오고 다시 열면 완료 판이 없고, 닫았을 때 로비 칩은 '20룹'이다", async () => {
    let resolveOrder: (value: HomeShoppingOrderResult) => void = () => undefined;
    jest.mocked(orderHomeShopping).mockReturnValueOnce(
      new Promise<HomeShoppingOrderResult>((resolve) => {
        resolveOrder = resolve;
      })
    );
    await renderHome(N0);
    await openShop();
    await startBedOrder();
    await pressAnyButton(SHOP_CLOSE);

    await act(async () => {
      resolveOrder(okBed());
    });
    await flushAsync();

    expect(chipText()).toBe("20룹");
    expect(storedIds(activeLobbyLayout())).toEqual(["bed-1"]);
    await openShop();
    expect(deliveredShown()).toBe(false);
  });

  test("K3 주문을 기다리는 동안 닫고 다시 연 뒤 실패 응답(룹 모자람)이 오면 새 화면에 알림이 뜨지 않는다", async () => {
    let rejectOrder: (error: unknown) => void = () => undefined;
    jest.mocked(orderHomeShopping).mockReturnValueOnce(
      new Promise<HomeShoppingOrderResult>((_resolve, reject) => {
        rejectOrder = reject;
      })
    );
    await renderHome(N0);
    await openShop();
    await startBedOrder();
    await pressAnyButton(SHOP_CLOSE);
    await openShop();

    await act(async () => {
      rejectOrder(new ApiError("룹이 모자라요.", 409, "NOT_ENOUGH_LOOP_POINTS"));
    });
    await flushAsync();

    expect(screen.queryAllByText("룹이 모자라요.", ALL)).toHaveLength(0);
    expect(screen.queryAllByText(ORDER_FAILED, ALL)).toHaveLength(0);
  });

  test("K4 주문을 기다리는 동안 닫고 다시 연 뒤 PRICE_CHANGED가 오면 목록을 또 부르지 않는다(여는 두 번뿐)", async () => {
    let rejectOrder: (error: unknown) => void = () => undefined;
    jest.mocked(orderHomeShopping).mockReturnValueOnce(
      new Promise<HomeShoppingOrderResult>((_resolve, reject) => {
        rejectOrder = reject;
      })
    );
    await renderHome(N0);
    await openShop();
    await startBedOrder();
    await pressAnyButton(SHOP_CLOSE);
    await openShop();

    await act(async () => {
      rejectOrder(new ApiError("가격이 바뀌었어요. 다시 확인해 주세요.", 409, "PRICE_CHANGED"));
    });
    await flushAsync();

    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    expect(screen.queryAllByText("가격이 바뀌었어요. 다시 확인해 주세요.", ALL)).toHaveLength(0);
  });
});
