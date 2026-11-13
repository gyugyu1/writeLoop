// [spec] qa 테스트(작업 089 ⑤ 아이템 늘리기, 새 기능, 모바일): 홈쇼핑 "옷" 분류의 열여섯(시나리오 S1~S15): 카드·그림·설명·"입는 곳"·방송 할인·
// "가진 옷", 새 옷의 완료 판과 '바로 입기'(새 부위, 액세서리 하나만, 같은 부위 다른 색), 앱이 모르는 옷은 그대로.
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/03-qa-scenarios.md의 S)와
// 04-main-decision.md B(B-5 새 열둘의 설명 문구, A-4 홈 라룹이는 부위 일곱의 종류를 look으로 받는다)에서만 가져온다.
// 홈쇼핑 화면 규칙(카드 접근성 이름, 할인 표시, 완료 판 글, 바로 입기 본문)은 ④ 폴더 명세·결정 그대로다.
// 구현 커밋 59b34f2에서 읽은 것은 부르는 방법뿐이다: 옷 주문 orderHomeShoppingWearable, 가구 주문 orderHomeShopping,
// 앱이 모르는 상품 주문 orderHomeShoppingAny(6e2f069), 바로 입기 saveWardrobeEquipped, 옷장 getWardrobe, 방 그리기(가짜)가 받는 look.
// 화면 도우미는 ④ qa 테스트(home-shopping-clothes.spec.test.tsx)와 같다. 상세창이 뒤를 접근성에서 가릴 수 있어 질의는 가려진 것까지 찾는다(ALL).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
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
  orderHomeShoppingAny,
  orderHomeShoppingWearable,
  saveLobbyLayout,
  saveWardrobeEquipped,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { activeLobbyLayout, applyArea, applyLobbyLayout } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { wearableIcon } from "@/lib/lobby3d/wearable-icons";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  HomeShopping,
  HomeShoppingWearableOrderResult,
  LoopPointsSummary,
  MobileHomeSnapshot,
  Wardrobe
} from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockPreview: { props: unknown; mounted: number } = { props: null, mounted: 0 };

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
  function MockClosetPreview(props: unknown) {
    mockPreview.props = props;
    React.useEffect(() => {
      mockPreview.mounted += 1;
      return () => {
        mockPreview.mounted -= 1;
      };
    }, []);
    return React.createElement("ClosetPreviewMock");
  }
  return { __esModule: true, default: MockClosetPreview };
});
jest.mock("@/lib/api", () => ({
  ApiError: jest.requireActual<typeof import("@/lib/api")>("@/lib/api").ApiError,
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
  orderHomeShoppingAny: jest.fn(),
  orderHomeShoppingWearable: jest.fn(),
  saveLobbyLayout: jest.fn(),
  saveWardrobeEquipped: jest.fn(),
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

// ---------- 시나리오의 값 ----------

const ALL = { includeHiddenElements: true } as const;
const SHOP_TITLE = "라룹 홈쇼핑";
const DETAIL_TITLE = "상품 자세히 보기";
const DETAIL_CLOSE = "상품 상세 닫기";
const OWNED = "가진 옷";
const OWNED_BUTTON = "이미 가진 옷이에요";
const ARRIVED_CLOTHES = "옷장에 도착했어요";
const ARRIVED_FURNITURE = "보관함에 도착했어요";
const KEEP_BROWSING = "계속 구경하기";
const WEAR_NOW = "바로 입기";
const WEAR_PLACE = "입는 곳";
const SLOTS = ["hat", "top", "bottom", "shoes", "face", "back", "accessory"] as const;
type Slot = (typeof SLOTS)[number];

/** 옷 열여섯(서버 순서 = 명세 가격표 순서): 종류, 이름, 가격, 입는 곳. */
const CLOTHES: { type: string; name: string; price: number; place: string }[] = [
  { type: "capOrange", name: "주황 야구모자", price: 60, place: "모자" },
  { type: "capBlue", name: "파랑 야구모자", price: 60, place: "모자" },
  { type: "capGreen", name: "초록 야구모자", price: 60, place: "모자" },
  { type: "shortsNavy", name: "남색 반바지", price: 70, place: "하의" },
  { type: "shortsBrown", name: "갈색 반바지", price: 70, place: "하의" },
  { type: "shortsRed", name: "빨강 반바지", price: 70, place: "하의" },
  { type: "tshirtOrange", name: "주황 티셔츠", price: 80, place: "상의" },
  { type: "tshirtWhite", name: "흰 티셔츠", price: 80, place: "상의" },
  { type: "tshirtYellow", name: "노랑 티셔츠", price: 80, place: "상의" },
  { type: "shoesBrown", name: "갈색 운동화", price: 90, place: "신발" },
  { type: "shoesRed", name: "빨강 운동화", price: 90, place: "신발" },
  { type: "shoesWhite", name: "흰 운동화", price: 90, place: "신발" },
  { type: "mufflerRed", name: "빨강 머플러", price: 90, place: "액세서리" },
  { type: "sunglassesBlack", name: "검정 선글라스", price: 100, place: "얼굴장식" },
  { type: "necklaceGold", name: "금 목걸이", price: 110, place: "액세서리" },
  { type: "backpackRed", name: "빨강 백팩", price: 120, place: "등장식" }
];
const BY_TYPE = Object.fromEntries(CLOTHES.map((c) => [c.type, c]));
/** 04 결정 B-5: 새 열둘의 설명. */
const NEW_DESCRIPTION: Record<string, string> = {
  capBlue: "발바닥 무늬가 들어간 시원한 파랑 모자예요.",
  capGreen: "발바닥 무늬가 들어간 싱그러운 초록 모자예요.",
  tshirtWhite: "무엇과도 잘 어울리는 깔끔한 흰 티셔츠예요.",
  tshirtYellow: "기분까지 밝아지는 노랑 티셔츠예요.",
  shortsBrown: "차분한 갈색이라 어디에나 잘 맞는 반바지예요.",
  shortsRed: "눈에 확 띄는 빨강 반바지예요.",
  shoesRed: "한 걸음마다 신나는 빨강 운동화예요.",
  shoesWhite: "어떤 옷에도 잘 어울리는 흰 운동화예요.",
  sunglassesBlack: "햇살 좋은 날 멋을 더하는 동그란 선글라스예요.",
  backpackRed: "어디든 함께 떠날 수 있는 작은 빨강 백팩이에요.",
  mufflerRed: "목을 포근하게 감싸는 빨강 머플러예요.",
  necklaceGold: "동그란 펜던트가 반짝이는 금 목걸이예요."
};

/** S26: 명세의 가격표 순서. */
const PRICE_LIST: [string, number][] = [
  ["books", 40],
  ["smallPlant", 50],
  ["lamp", 60],
  ["capOrange", 60],
  ["capBlue", 60],
  ["capGreen", 60],
  ["frame", 70],
  ["shortsNavy", 70],
  ["shortsBrown", 70],
  ["shortsRed", 70],
  ["plant", 80],
  ["tshirtOrange", 80],
  ["tshirtWhite", 80],
  ["tshirtYellow", 80],
  ["shoesBrown", 90],
  ["shoesRed", 90],
  ["shoesWhite", 90],
  ["mufflerRed", 90],
  ["nightstand", 100],
  ["sunglassesBlack", 100],
  ["floorLamp", 110],
  ["necklaceGold", 110],
  ["backpackRed", 120],
  ["rug", 150],
  ["wardrobe", 180],
  ["bed", 300]
];
const FURNITURE_NAME: Record<string, string> = {
  books: "책",
  smallPlant: "작은 화분",
  lamp: "탁상 스탠드",
  frame: "액자",
  plant: "큰 화분",
  nightstand: "협탁",
  floorLamp: "바닥 스탠드",
  rug: "러그",
  wardrobe: "옷장",
  bed: "침대"
};
const NAMES26 = PRICE_LIST.map(([type]) => FURNITURE_NAME[type] ?? BY_TYPE[type].name);
const SALE: Record<string, number> = { rug: 120, backpackRed: 96 };

function shop26(options: { cast?: string; owned?: Record<string, number>; extra?: [string, number][] } = {}): HomeShopping {
  const cast = options.cast ?? "rug";
  const list = [...PRICE_LIST, ...(options.extra ?? [])];
  const castPrice = list.find(([type]) => type === cast)![1];
  const items = list.map(([type, price]) => ({ type, price, salePrice: type === cast ? SALE[cast] : null, owned: options.owned?.[type] ?? 0 }));
  return JSON.parse(JSON.stringify({ balance: 200, broadcast: { type: cast, price: castPrice, salePrice: SALE[cast] }, items })) as HomeShopping;
}

const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const H0_ITEMS = [
  { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T01:00:00Z" },
  { type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T02:00:00Z" }
];
const H0_EQUIPPED = { ...ALL_NULL, top: "tshirtOrange", shoes: "shoesBrown" };

function wardrobe(value: unknown): Wardrobe {
  return JSON.parse(JSON.stringify(value)) as Wardrobe;
}

/** 홈 옷장(items·equipped)에서 type을 산 주문 결과(입은 것은 그대로). */
function orderOf(type: string, slot: Slot, home: { items: unknown[]; equipped: Record<string, string | null> }): HomeShoppingWearableOrderResult {
  const price = BY_TYPE[type].price;
  return {
    type,
    price,
    balance: 200 - price,
    owned: 1,
    itemId: null,
    layout: null,
    wardrobe: wardrobe({ items: [...home.items, { type, slot, acquiredAt: "2026-11-13T03:00:00Z" }], equipped: home.equipped })
  };
}

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-13T03:00:00.000Z");
const TODAY_KEY = "2026-11-13";
const userA: AuthUser = { id: 1, email: "a@example.com", displayName: "가", admin: false };

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
// ---------- 도우미 ----------

type UiNode = ReturnType<typeof screen.getByRole>;

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

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function homeLayoutJson(): string {
  return JSON.stringify(activeLobbyLayout());
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

async function renderHome() {
  const view = await render(<HomeScreen />);
  await flushAsync();
  await frames(0.1);
  return view;
}

async function pressNode(node: UiNode) {
  await fireEvent.press(node);
  await flushAsync();
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

function contains(container: UiNode, node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) if (n === container) return true;
  return false;
}

function labelOf(node: UiNode): string | undefined {
  const props = node.props as { accessibilityLabel?: string; "aria-label"?: string };
  return props["aria-label"] ?? props.accessibilityLabel;
}

function isDisabled(node: UiNode): boolean {
  const props = node.props as { accessibilityState?: { disabled?: boolean }; "aria-disabled"?: boolean; disabled?: boolean };
  return (props["aria-disabled"] ?? props.accessibilityState?.disabled ?? props.disabled) === true;
}

function isStruck(node: UiNode): boolean {
  const style = (StyleSheet.flatten((node.props as { style?: unknown }).style as never) ?? {}) as { textDecorationLine?: string };
  return (style.textDecorationLine ?? "").includes("line-through");
}

function imageSourcesIn(container: UiNode): unknown[] {
  return container.queryAll((node) => (node.type as unknown) === "Image").map((node) => (node.props as { source?: unknown }).source);
}

function hasText(text: string | RegExp, container?: UiNode): boolean {
  return (container ? within(container) : screen).queryAllByText(text, ALL).length > 0;
}

function countText(text: string | RegExp, container?: UiNode): number {
  return (container ? within(container) : screen).queryAllByText(text, ALL).length;
}

// ---------- 홈쇼핑 화면 도우미 ----------

const CARD_LABEL = /^(.+), (\d+)룹, (20% 할인, )?자세히 보기$/;

function shopOpen(): boolean {
  return screen.queryAllByText(SHOP_TITLE, ALL).length > 0;
}

async function openShop() {
  await pressNode(screen.getAllByRole("button", { name: "홈쇼핑" })[0]);
}

function shopModal(): UiNode {
  const title = screen.getByText(SHOP_TITLE, ALL);
  for (let n: UiNode | null = title; n; n = n.parent) if ((n.type as unknown) === "Modal") return n;
  throw new Error("홈쇼핑 모달이 없다");
}

function tabNodes(): UiNode[] {
  return within(shopModal()).queryAllByRole("tab", ALL);
}

function tabNode(name: string): UiNode {
  const found = tabNodes().filter((node) => textOf(node) === name);
  expect(found).toHaveLength(1);
  return found[0];
}

async function pressTab(name: string) {
  await pressNode(tabNode(name));
}

/** 방송 칸(버튼): 줄 그은 정가를 품은 버튼(상세창 안은 뺀다). 없으면 null. */
function broadcastButtonOrNull(): UiNode | null {
  if (!shopOpen()) return null;
  const panel = detailPanelOrNull();
  const struck = within(shopModal())
    .queryAllByText(/^\d+룹$/, ALL)
    .filter((node) => isStruck(node) && !(panel && contains(panel, node)));
  if (struck.length === 0) return null;
  expect(struck).toHaveLength(1);
  return buttonOf(struck[0]);
}

function broadcastButton(): UiNode {
  const button = broadcastButtonOrNull();
  expect(button).not.toBeNull();
  return button!;
}

function listCards(): UiNode[] {
  if (!shopOpen()) return [];
  const broadcast = broadcastButtonOrNull();
  return screen.queryAllByRole("button", { name: CARD_LABEL, ...ALL }).filter((button) => button !== broadcast);
}

function cardName(card: UiNode): string {
  const label = labelOf(card) ?? "";
  expect(label).toMatch(CARD_LABEL);
  return CARD_LABEL.exec(label)![1];
}

function cardNames(): string[] {
  return listCards().map(cardName);
}

function cardOf(name: string): UiNode {
  const cards = listCards().filter((card) => cardName(card) === name);
  expect(cards).toHaveLength(1);
  return cards[0];
}

/** 목록 머리의 "N가지". */
function countHeader(): string {
  const found = within(shopModal()).queryAllByText(/^\d+가지$/, ALL);
  expect(found).toHaveLength(1);
  return textOf(found[0]);
}

const BOTTOM_BUTTON = /룹에 주문하기$|룹 더 필요해요$|^이미 가진 옷이에요$/;

/** 열린 상세창(제목에서 '상품 상세 닫기'와 주문 버튼을 함께 품은 조상까지). 없으면 null. */
function detailPanelOrNull(): UiNode | null {
  const titles = screen.queryAllByText(DETAIL_TITLE, ALL);
  if (titles.length === 0) return null;
  expect(titles).toHaveLength(1);
  for (let n: UiNode | null = titles[0]; n; n = n.parent) {
    const hasClose = within(n).queryAllByRole("button", { name: DETAIL_CLOSE, ...ALL }).length > 0;
    const hasBottom = within(n).queryAllByRole("button", { name: BOTTOM_BUTTON, ...ALL }).length > 0;
    if (hasClose && hasBottom) return n;
    if ((n.type as unknown) === "Modal") break;
  }
  return null;
}

function detailPanel(): UiNode {
  const panel = detailPanelOrNull();
  expect(panel).not.toBeNull();
  return panel!;
}

/** 완료 판: 제목(옷장에/보관함에 도착했어요)에서 '계속 구경하기'와 '상품 상세 닫기'를 함께 품은 조상까지. 없으면 null. */
function successPanelOrNull(): UiNode | null {
  const headers = [...screen.queryAllByText(ARRIVED_CLOTHES, ALL), ...screen.queryAllByText(ARRIVED_FURNITURE, ALL)];
  if (headers.length === 0) return null;
  expect(headers).toHaveLength(1);
  for (let n: UiNode | null = headers[0]; n; n = n.parent) {
    const hasKeep = within(n).queryAllByRole("button", { name: KEEP_BROWSING, ...ALL }).length > 0;
    const hasClose = within(n).queryAllByRole("button", { name: DETAIL_CLOSE, ...ALL }).length > 0;
    if (hasKeep && hasClose) return n;
    if ((n.type as unknown) === "Modal") break;
  }
  return null;
}

function successPanel(): UiNode {
  const panel = successPanelOrNull();
  expect(panel).not.toBeNull();
  return panel!;
}

function button(name: string): UiNode {
  return screen.getByRole("button", { name, ...ALL });
}

function orderButton(price: number): UiNode {
  return button(`${price}룹에 주문하기`);
}

function wearableOrders(): unknown[] {
  return jest.mocked(orderHomeShoppingWearable).mock.calls.map((call) => call[0]);
}

function savedBodies(): unknown[] {
  return jest.mocked(saveWardrobeEquipped).mock.calls.map((call) => call[0]);
}

/** 상세창을 열고 그 옷을 주문해 완료 판까지 간다. */
async function buy(name: string, price: number, result: HomeShoppingWearableOrderResult) {
  jest.mocked(orderHomeShoppingWearable).mockResolvedValueOnce(result);
  await pressNode(cardOf(name));
  await pressNode(orderButton(price));
}

/** 홈 착용(방 그리기가 받은 look에서 입은 부위만). */
function homeLook(): Partial<Record<Slot, string>> {
  const value = (canvas() as { look?: Partial<Record<string, string | null>> | null }).look;
  const result: Partial<Record<Slot, string>> = {};
  for (const slot of SLOTS) if (typeof value?.[slot] === "string") result[slot] = value[slot] as string;
  return result;
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
  mockPreview.props = null;
  mockPreview.mounted = 0;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
  jest.mocked(getWardrobe).mockReset().mockResolvedValue(wardrobe({ items: H0_ITEMS, equipped: H0_EQUIPPED }));
  jest.mocked(saveWardrobeEquipped).mockReset().mockImplementation(async (equipped) => wardrobe({ items: H0_ITEMS, equipped }));
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (value: LobbyLayout) => JSON.parse(JSON.stringify(value)));
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(200));
  jest.mocked(getHomeShopping).mockReset().mockResolvedValue(shop26());
  jest.mocked(orderHomeShopping).mockReset();
  jest.mocked(orderHomeShoppingAny).mockReset();
  jest.mocked(orderHomeShoppingWearable).mockReset();
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

const CLOTHES_NAMES = CLOTHES.map((c) => c.name);
const NEW_CLOTHES = CLOTHES.filter((c) => c.type in NEW_DESCRIPTION);

/** 홈을 그리고 홈쇼핑을 연 뒤 그 옷을 사서 완료 판까지 간다. home은 홈 옷장(처음 불러오기). */
async function homeAndBuy(type: string, slot: Slot, home = { items: H0_ITEMS as unknown[], equipped: H0_EQUIPPED as Record<string, string | null> }) {
  jest.mocked(getWardrobe).mockResolvedValue(wardrobe(home));
  await renderHome();
  await openShop();
  await buy(BY_TYPE[type].name, BY_TYPE[type].price, orderOf(type, slot, home));
}

/** '바로 입기'를 누른다. 홈의 옷장 불러오기는 그 뒤 응답하지 않는다(다시 불러오기를 기다리지 않고 바뀌는지 본다). */
async function wearNow() {
  jest.mocked(getWardrobe).mockImplementation(() => new Promise<Wardrobe | null>(() => {}));
  await pressNode(button(WEAR_NOW));
}

// ---------- S1~S5. 목록 ----------

describe("[spec] 089-⑤ S1~S5: '옷' 분류의 열여섯", () => {
  test("S1 '옷' 탭은 열여섯이 서버 순서로 보이고 목록 머리가 '16가지'다", async () => {
    await renderHome();
    await openShop();
    await pressTab("옷");
    expect(cardNames()).toEqual(CLOTHES_NAMES);
    expect(countHeader()).toBe("16가지");
  });

  test("S2 '전체'는 스물여섯이 서버 순서로 보이고 '26가지'다", async () => {
    await renderHome();
    await openShop();
    expect(cardNames()).toEqual(NAMES26);
    expect(countHeader()).toBe("26가지");
  });

  test.each([
    ["가구", ["협탁", "옷장", "침대"]],
    ["조명", ["탁상 스탠드", "바닥 스탠드"]],
    ["장식", ["책", "액자", "러그"]],
    ["식물", ["작은 화분", "큰 화분"]]
  ])("S3 '%s' 탭은 가구만(%j)이다", async (tab, names) => {
    await renderHome();
    await openShop();
    await pressTab(tab);
    expect(cardNames()).toEqual(names);
  });

  test("S4·S5 옷 카드 열여섯의 접근성 이름이 '<이름>, <가격>룹, 자세히 보기'이고 그림이 그 옷의 칸 그림이다", async () => {
    await renderHome();
    await openShop();
    await pressTab("옷");
    const seen = CLOTHES.map(({ type, name }) => ({ type, label: labelOf(cardOf(name)), sources: imageSourcesIn(cardOf(name)) }));
    expect(seen).toEqual(CLOTHES.map(({ type, name, price }) => ({ type, label: `${name}, ${price}룹, 자세히 보기`, sources: [wearableIcon(type)] })));
  });
});

// ---------- S6·S7. 상세창 ----------

describe("[spec] 089-⑤ S6·S7: 상세창의 이름·그림·설명·입는 곳", () => {
  test.each(NEW_CLOTHES.map((c) => [c.name, c.type] as const))("S6 %s 상세창: 제목이 이름, 그림이 칸 그림, 설명이 04 결정 B-5 문구다", async (name, type) => {
    await renderHome();
    await openShop();
    await pressNode(cardOf(name));
    const panel = detailPanel();
    expect(within(panel).getByRole("header", { name, ...ALL })).toBeTruthy();
    expect(imageSourcesIn(panel)).toContainEqual(wearableIcon(type));
    expect(within(panel).getByText(NEW_DESCRIPTION[type], ALL)).toBeTruthy();
  });

  test.each(CLOTHES.map((c) => [c.name, c.place] as const))("S7 %s 상세창의 '입는 곳'은 '%s'이고 놓는 위치·차지하는 크기가 없다", async (name, place) => {
    await renderHome();
    await openShop();
    await pressNode(cardOf(name));
    const panel = detailPanel();
    expect(hasText(WEAR_PLACE, panel)).toBe(true);
    expect(hasText(place, panel)).toBe(true);
    expect(hasText("놓는 위치", panel)).toBe(false);
    expect(hasText("차지하는 크기", panel)).toBe(false);
  });
});

// ---------- S8·S9. 방송·가진 옷 ----------

describe("[spec] 089-⑤ S8·S9: 방송 할인과 가진 옷", () => {
  test("S8 방송이 빨강 백팩이면 방송 칸에 이름·줄 그은 '120룹'·'96룹'·'20%'·그림이 있고, 카드가 할인 표시이며, 방송 칸에서 96룹으로 주문한다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop26({ cast: "backpackRed" }));
    jest.mocked(orderHomeShoppingWearable).mockResolvedValueOnce({ ...orderOf("backpackRed", "back", { items: H0_ITEMS, equipped: H0_EQUIPPED }), price: 96, balance: 104 });
    await renderHome();
    await openShop();
    const broadcast = broadcastButton();
    expect(hasText("빨강 백팩", broadcast)).toBe(true);
    expect(within(broadcast).queryAllByText(/^\d+룹$/, ALL).filter(isStruck).map(textOf)).toEqual(["120룹"]);
    expect(hasText("96룹", broadcast)).toBe(true);
    expect(hasText("20%", broadcast)).toBe(true);
    expect(imageSourcesIn(broadcast)).toContainEqual(wearableIcon("backpackRed"));
    await pressTab("옷");
    expect(labelOf(cardOf("빨강 백팩"))).toBe("빨강 백팩, 96룹, 20% 할인, 자세히 보기");
    await pressNode(broadcastButton());
    await pressNode(orderButton(96));
    expect(wearableOrders()).toEqual([{ type: "backpackRed", price: 96 }]);
  });

  test("S9 검정 선글라스·금 목걸이를 가졌으면 그 두 카드에만 '가진 옷'이 있고, 두 상세창은 '가진 옷'과 꺼진 '이미 가진 옷이에요'다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop26({ owned: { sunglassesBlack: 1, necklaceGold: 1 } }));
    await renderHome();
    await openShop();
    await pressTab("옷");
    expect(CLOTHES.filter(({ name }) => hasText(OWNED, cardOf(name))).map((c) => c.type)).toEqual(["sunglassesBlack", "necklaceGold"]);
    expect(countText(OWNED)).toBe(2);
    for (const name of ["검정 선글라스", "금 목걸이"]) {
      await pressNode(cardOf(name));
      const panel = detailPanel();
      expect({ name, owned: hasText(OWNED, panel), disabled: isDisabled(button(OWNED_BUTTON)) }).toEqual({ name, owned: true, disabled: true });
      await pressNode(button(DETAIL_CLOSE));
    }
  });
});

// ---------- S10~S14. 새 옷 주문과 바로 입기 ----------

describe("[spec] 089-⑤ S10~S14: 새 옷의 완료 판과 '바로 입기'", () => {
  test("S10 빨강 백팩을 사면 주문이 { type: 'backpackRed', price: 120 }이고 완료 판이 '옷장에 도착했어요', '빨강 백팩 · 남은 룹 80', 버튼 둘, 그 그림이며 홈 배치는 그대로다", async () => {
    jest.mocked(getWardrobe).mockResolvedValue(wardrobe({ items: H0_ITEMS, equipped: H0_EQUIPPED }));
    await renderHome();
    const before = homeLayoutJson();
    await openShop();
    await buy("빨강 백팩", 120, orderOf("backpackRed", "back", { items: H0_ITEMS, equipped: H0_EQUIPPED }));
    expect(wearableOrders()).toEqual([{ type: "backpackRed", price: 120 }]);
    const panel = successPanel();
    expect(within(panel).getByRole("header", { name: ARRIVED_CLOTHES, ...ALL })).toBeTruthy();
    expect(within(panel).getByText("빨강 백팩 · 남은 룹 80", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: KEEP_BROWSING, ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: WEAR_NOW, ...ALL })).toBeTruthy();
    expect(imageSourcesIn(panel)).toContainEqual(wearableIcon("backpackRed"));
    expect(hasText(ARRIVED_FURNITURE)).toBe(false);
    expect(homeLayoutJson()).toBe(before);
    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });

  test("S11 빨강 백팩 '바로 입기'는 등장식만 바꿔 저장하고, 홈쇼핑이 닫히며 다시 불러오기 없이 홈 라룹이가 상의·신발·백팩을 입는다", async () => {
    await homeAndBuy("backpackRed", "back");
    await wearNow();
    expect(savedBodies()).toEqual([{ hat: null, top: "tshirtOrange", bottom: null, shoes: "shoesBrown", face: null, back: "backpackRed", accessory: null }]);
    expect(shopOpen()).toBe(false);
    expect(homeLook()).toEqual({ top: "tshirtOrange", shoes: "shoesBrown", back: "backpackRed" });
  });

  test("S12 금 목걸이를 입은 홈에서 빨강 머플러를 사서 '바로 입기'하면 액세서리가 머플러 하나로 바뀐다", async () => {
    const home = {
      items: [...H0_ITEMS, { type: "necklaceGold", slot: "accessory", acquiredAt: "2026-11-13T02:30:00Z" }],
      equipped: { ...H0_EQUIPPED, accessory: "necklaceGold" }
    };
    await homeAndBuy("mufflerRed", "accessory", home);
    expect(homeLook()).toEqual({ top: "tshirtOrange", shoes: "shoesBrown", accessory: "necklaceGold" });
    await wearNow();
    expect(savedBodies()).toEqual([{ ...H0_EQUIPPED, accessory: "mufflerRed" }]);
    expect(homeLook()).toEqual({ top: "tshirtOrange", shoes: "shoesBrown", accessory: "mufflerRed" });
  });

  test("S13 주황 야구모자를 입은 홈에서 파랑 야구모자를 사서 '바로 입기'하면 모자가 capBlue로 바뀐다", async () => {
    const home = {
      items: [...H0_ITEMS, { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T02:30:00Z" }],
      equipped: { ...H0_EQUIPPED, hat: "capOrange" }
    };
    await homeAndBuy("capBlue", "hat", home);
    await wearNow();
    expect(savedBodies()).toEqual([{ ...H0_EQUIPPED, hat: "capBlue" }]);
    expect(homeLook()).toEqual({ hat: "capBlue", top: "tshirtOrange", shoes: "shoesBrown" });
  });

  test("S14 검정 선글라스 '바로 입기'는 얼굴장식만 바꾼다", async () => {
    await homeAndBuy("sunglassesBlack", "face");
    await wearNow();
    expect(savedBodies()).toEqual([{ ...H0_EQUIPPED, face: "sunglassesBlack" }]);
    expect(homeLook()).toEqual({ top: "tshirtOrange", shoes: "shoesBrown", face: "sunglassesBlack" });
  });
});

// ---------- S15. 앱이 모르는 옷 ----------

// 작업 090-①(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/02-서버-아이템-목록/01-main-spec.md "홈쇼핑 목록: 그릴 줄 모르는 상품은 보이지 않는다")과
// 같은 폴더 04-main-decision.md A(사용자 결정: qa가 새 동작에 맞게 고침)대로 고쳤다. 앞 기대값(모르는 상품 주문으로 가고 완료 판이 뜬다)은
// 카드가 보이지 않아 더는 일어나지 않으므로, 기대값을 "카드가 없고 나머지 목록은 그대로, 주문하지 않는다"로 바꿨다. 준비 데이터는 그대로다.
describe("[spec] 089-⑤ S15(090 고침): 앱이 모르는 옷(둥근 안경)은 홈쇼핑에 보이지 않는다", () => {
  test("S15(090) 서버 목록에 glassesRound가 있어도 그 카드가 없고 나머지 카드는 그대로이며, 모르는 상품 주문은 일어나지 않는다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop26({ extra: [["glassesRound", 90]] }));
    await renderHome();
    await openShop();
    expect(cardNames()).toEqual(NAMES26);
    expect(screen.queryAllByText("glassesRound", ALL)).toHaveLength(0);
    expect(orderHomeShoppingAny).not.toHaveBeenCalled();
    expect(orderHomeShoppingWearable).not.toHaveBeenCalled();
  });
});
