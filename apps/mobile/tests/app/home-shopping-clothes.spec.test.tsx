// [spec] qa 테스트(작업 089 ④ 홈쇼핑 '옷' 분류, 새 기능, 모바일): 홈쇼핑의 '옷' 분류 탭, 옷 카드·방송 칸·상세창("입는 곳", "가진 옷"),
// 옷 주문 완료 판("옷장에 도착했어요", "계속 구경하기", "바로 입기"), '바로 입기' 저장과 홈 라룹이, 옷을 산 뒤 옷장, 가구 주문이 그대로인지를 홈 화면 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/06-홈쇼핑-옷/03-qa-scenarios.md의 T·N·B·D·G·O·W·K·H·F)와
// 04-main-decision.md C(1 옷 설명 문구, 2 방송 칸에도 "가진 옷", 3 ALREADY_OWNED면 문구를 보이고 목록을 다시 불러옴,
// 4 바로 입기 실패 문구는 늘 "입지 못했어요. 다시 시도해 주세요", 5 저장 중에는 닫기·뒤 누르기·홈쇼핑 닫기·뒤로 가기를 받지 않음,
// 6 홈이 앞서 부른 옷장 불러오기의 옛 응답은 버림, 7 주문 결과의 wardrobe가 없거나 깨졌으면 바로 입기 때 옷장을 불러와 그 부위만 바꿔 저장)에서만 가져온다.
// 구현 커밋 18898fb에서 읽은 것은 부르는 방법뿐이다:
// - 옷 주문은 orderHomeShoppingWearable({ type, price }), 가구 주문은 orderHomeShopping({ type, price }). 바로 입기는 saveWardrobeEquipped(일곱 부위), 옷장은 getWardrobe.
// - 실패 문구는 홈쇼핑의 알림 글로 보인다. '바로 입기' 버튼의 접근성 이름은 "바로 입기"(저장 중에는 글 대신 진행 표시).
// - 홈 착용 목록은 방 그리기(가짜)가 받은 wear에서 참인 부위다. 옷장 열기는 home-closet.spec.test.tsx처럼 옷장에 걸어가 '들어가기'.
// 서버 응답 모양(400 코드, 500, 401, 네트워크)을 거쳐야 하는 바로 입기 실패는 진짜 saveWardrobeEquipped를 부르고 전역 fetch를 가짜로 둔다.
// 상세창이 뒤를 접근성에서 가릴 수 있어(accessibilityViewIsModal) 질의는 가려진 것까지 찾는다(ALL).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
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
  getWardrobe,
  getWritingDraft,
  orderHomeShopping,
  orderHomeShoppingWearable,
  saveLobbyLayout,
  saveWardrobeEquipped,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { activeLobbyLayout, applyArea, applyLobbyLayout, markInfo, roomPlaceIds, type PlaceId, type PointerHit } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, storedItems, type LobbyLayout, type StoredItem } from "@/lib/lobby3d/lobby-layout";
import { wearableIcon } from "@/lib/lobby3d/wearable-icons";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type {
  AuthUser,
  HomeShopping,
  HomeShoppingOrderResult,
  HomeShoppingWearableOrderResult,
  LoopPointsSummary,
  MobileHomeSnapshot,
  Wardrobe
} from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockPreview: { props: { wear?: Partial<Record<string, boolean>> } | null; mounted: number } = { props: null, mounted: 0 };

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
  function MockClosetPreview(props: { wear?: Partial<Record<string, boolean>> }) {
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

/** 진짜 저장 함수(api.ts). */
const actualApi = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");

// ---------- 시나리오의 값 ----------

const ALL = { includeHiddenElements: true } as const;
const SHOP_TITLE = "라룹 홈쇼핑";
const DETAIL_TITLE = "상품 자세히 보기";
const DETAIL_CLOSE = "상품 상세 닫기";
const SHOP_CLOSE = "홈쇼핑 닫기";
const OWNED = "가진 옷";
const OWNED_BUTTON = "이미 가진 옷이에요";
const ARRIVED_CLOTHES = "옷장에 도착했어요";
const ARRIVED_FURNITURE = "보관함에 도착했어요";
const KEEP_BROWSING = "계속 구경하기";
const WEAR_NOW = "바로 입기";
const PLACE_NOW = "바로 놓기";
const WEAR_FAILED = "입지 못했어요. 다시 시도해 주세요";
const WEAR_PLACE = "입는 곳";
const CLOSET_TITLE = "옷장";
const ENTER = "들어가기";
const OFF = "벗기";
const CAP = "주황 야구모자";
const TSHIRT = "주황 티셔츠";
const SHORTS = "남색 반바지";
const SHOES = "갈색 운동화";
const TABS = ["전체", "가구", "조명", "장식", "식물", "옷"];
/** 04 결정 C1: 옷 설명 문구. */
const CLOTHES_DESCRIPTION: Record<string, string> = {
  capOrange: "발바닥 무늬가 들어간 산뜻한 주황 모자예요.",
  tshirtOrange: "어디에나 잘 어울리는 편한 주황 티셔츠예요.",
  shortsNavy: "가볍게 움직이기 좋은 남색 반바지예요.",
  shoesBrown: "폭신하게 걷기 좋은 갈색 운동화예요."
};
const CLOTHES = [
  { type: "capOrange", name: CAP, price: 60, place: "모자" },
  { type: "shortsNavy", name: SHORTS, price: 70, place: "하의" },
  { type: "tshirtOrange", name: TSHIRT, price: 80, place: "상의" },
  { type: "shoesBrown", name: SHOES, price: 90, place: "신발" }
];

/** S14: 명세의 가격표 순서. */
const PRICE_LIST: [string, number][] = [
  ["books", 40],
  ["smallPlant", 50],
  ["lamp", 60],
  ["capOrange", 60],
  ["frame", 70],
  ["shortsNavy", 70],
  ["plant", 80],
  ["tshirtOrange", 80],
  ["shoesBrown", 90],
  ["nightstand", 100],
  ["floorLamp", 110],
  ["rug", 150],
  ["wardrobe", 180],
  ["bed", 300]
];
const NAMES14 = ["책", "작은 화분", "탁상 스탠드", CAP, "액자", SHORTS, "큰 화분", TSHIRT, SHOES, "협탁", "바닥 스탠드", "러그", "옷장", "침대"];
const SALE: Record<string, number> = { rug: 120, capOrange: 48, tshirtOrange: 64 };

function shop14(options: { balance?: number; cast?: string; owned?: Record<string, number>; reversed?: boolean } = {}): HomeShopping {
  const cast = options.cast ?? "rug";
  const castPrice = PRICE_LIST.find(([type]) => type === cast)![1];
  const items = PRICE_LIST.map(([type, price]) => ({
    type,
    price,
    salePrice: type === cast ? SALE[cast] : null,
    owned: options.owned?.[type] ?? 0
  }));
  return JSON.parse(
    JSON.stringify({
      balance: options.balance ?? 200,
      broadcast: { type: cast, price: castPrice, salePrice: SALE[cast] },
      items: options.reversed ? [...items].reverse() : items
    })
  ) as HomeShopping;
}

const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const H0_EQUIPPED = { ...ALL_NULL, top: "tshirtOrange", shoes: "shoesBrown" };
const H0_ITEMS = [
  { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T01:00:00Z" },
  { type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T02:00:00Z" }
];
const CAP_ITEM = { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T03:00:00Z" };

function wardrobe(value: unknown): Wardrobe {
  return JSON.parse(JSON.stringify(value)) as Wardrobe;
}

const H0 = () => wardrobe({ items: H0_ITEMS, equipped: H0_EQUIPPED });
const W_CAP = () => wardrobe({ items: [...H0_ITEMS, CAP_ITEM], equipped: H0_EQUIPPED });
const P_CAP = () => wardrobe({ items: [...H0_ITEMS, CAP_ITEM], equipped: { ...H0_EQUIPPED, hat: "capOrange" } });

function oCap(wardrobeValue: unknown = W_CAP()): HomeShoppingWearableOrderResult {
  return { type: "capOrange", price: 60, balance: 140, owned: 1, itemId: null, layout: null, wardrobe: wardrobeValue as Wardrobe | null };
}

function oCapOther(): HomeShoppingWearableOrderResult {
  return oCap(wardrobe({ items: [...H0_ITEMS, CAP_ITEM], equipped: { ...ALL_NULL, hat: "capBlue", top: "tshirtOrange", face: "glassesRound" } }));
}

function oShoes(): HomeShoppingWearableOrderResult {
  return {
    type: "shoesBrown",
    price: 90,
    balance: 110,
    owned: 1,
    itemId: null,
    layout: null,
    wardrobe: wardrobe({ items: [{ type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T03:00:00Z" }], equipped: ALL_NULL })
  };
}

function withStored(stored: StoredItem[]): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(DEFAULT_LOBBY_LAYOUT.items, stored))) as LobbyLayout;
}

function oBed(): HomeShoppingOrderResult {
  return { type: "bed", price: 300, balance: 0, owned: 1, itemId: "bed-1", layout: withStored([{ id: "bed-1", type: "bed" }]) };
}

function oWardrobeFurniture(): HomeShoppingOrderResult {
  return { type: "wardrobe", price: 180, balance: 20, owned: 1, itemId: "wardrobe-2", layout: withStored([{ id: "wardrobe-2", type: "wardrobe" }]) };
}

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-13T03:00:00.000Z");
const TODAY_KEY = "2026-11-13";
const userA: AuthUser = { id: 1, email: "a@example.com", displayName: "가", admin: false };
const SLOW_TEST_MS = 30_000;

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

// ---------- 가짜 fetch(진짜 저장 함수를 부를 때) ----------

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

/** 다음 바로 입기 저장은 진짜 함수를 거쳐 서버가 status·body로 답한다(네트워크 오류면 fetch가 거절). */
function saveAnswers(status: number | "network", body?: unknown) {
  if (status === "network") fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
  else fetchMock.mockResolvedValueOnce(respond(status, body));
  jest.mocked(saveWardrobeEquipped).mockImplementationOnce((equipped) => actualApi.saveWardrobeEquipped(equipped));
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function sim() {
  return canvas().sim;
}

/** 홈 착용 목록(방 그리기가 받은 wear에서 참인 부위). */
function homeWorn(): string[] {
  const wear = (canvas() as { wear?: Partial<Record<string, boolean>> }).wear;
  return ["hat", "top", "bottom", "shoes"].filter((slot) => wear?.[slot] === true);
}

function homeLayoutJson(): string {
  return JSON.stringify(activeLobbyLayout());
}

function storedIds(value: LobbyLayout | null | undefined): string[] {
  return storedItems(value ?? { items: [] }).map((item) => item.id);
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

function isSelected(node: UiNode): boolean {
  const props = node.props as { accessibilityState?: { selected?: boolean }; "aria-selected"?: boolean };
  return (props["aria-selected"] ?? props.accessibilityState?.selected) === true;
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

/** 목록 머리("N가지" 옆)에 그 분류 이름이 있는지(탭 글은 뺀다). */
function headerShowsTab(name: string): boolean {
  const count = within(shopModal()).getByText(/^\d+가지$/, ALL);
  const tabs = tabNodes();
  for (let n: UiNode | null = count.parent; n; n = n.parent) {
    if (tabs.some((tab) => contains(n!, tab))) return false;
    const same = within(n).queryAllByText(name, ALL);
    if (same.length > 0) return true;
  }
  return false;
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

/** 홈쇼핑을 닫고 머리 줄의 잔액 칩들("N룹" 글을 가진 버튼). */
function chips(): string[] {
  return screen
    .queryAllByText(/^\d+룹$/)
    .filter((node) => buttonOf(node) !== null)
    .map(textOf);
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

/** 홈을 그리고(처음 옷장 H0) 홈쇼핑을 열어 주황 야구모자를 사서 완료 판까지 간다. */
async function homeAndBuyCap(result: HomeShoppingWearableOrderResult = oCap()) {
  await renderHome();
  await openShop();
  await buy(CAP, 60, result);
}

async function pressBackInShop() {
  const modal = shopModal();
  await act(async () => {
    (modal.props as { onRequestClose?: () => void }).onRequestClose?.();
  });
  await flushAsync();
}

// ---------- 옷장(꾸미기 화면) 도우미 ----------

function closetId(): PlaceId {
  const ids = roomPlaceIds().filter((id) => markInfo(id).label === CLOSET_TITLE);
  expect(ids).toHaveLength(1);
  return ids[0];
}

/** 이미 그린 홈에서 옷장에 걸어가 도착하고 '들어가기'로 꾸미기 화면을 연다. 꾸미기 화면의 불러오기는 value로 답한다. */
async function walkAndOpenCloset(value: Wardrobe) {
  const id = closetId();
  await tapHit({ point: null, mark: id, onCharacter: false });
  const done = () => sim().arrived === id && sim().vx === 0 && sim().vz === 0;
  for (let i = 0; i < 400 && !done(); i += 1) await frames(0.05);
  expect(done()).toBe(true);
  await frames(0.5);
  jest.mocked(getWardrobe).mockResolvedValueOnce(value);
  await pressNode(screen.getByRole("button", { name: ENTER }));
}

function closetModal(): UiNode {
  const titles = screen.queryAllByRole("header", { name: CLOSET_TITLE, ...ALL });
  expect(titles).toHaveLength(1);
  for (let n: UiNode | null = titles[0]; n; n = n.parent) if ((n.type as unknown) === "Modal") return n;
  throw new Error("꾸미기 화면 Modal이 없다");
}

function cellRow(): UiNode {
  let row = within(closetModal()).getByRole("button", { name: OFF, ...ALL });
  for (let n: UiNode | null = row.parent; n; n = n.parent) {
    if (within(n).queryAllByRole("tab", ALL).length > 0) break;
    row = n;
  }
  return row;
}

function cellNames(): (string | undefined)[] {
  return within(cellRow()).queryAllByRole("button", ALL).map(labelOf);
}

function selectedCells(): (string | undefined)[] {
  return within(cellRow()).queryAllByRole("button", ALL).filter(isSelected).map(labelOf);
}

function useJsAnimation() {
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
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
  mockPreview.props = null;
  mockPreview.mounted = 0;
  fetchMock.mockReset();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
  jest.mocked(getWardrobe).mockReset().mockResolvedValue(H0());
  jest.mocked(saveWardrobeEquipped).mockReset().mockResolvedValue(P_CAP());
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (value: LobbyLayout) => JSON.parse(JSON.stringify(value)));
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(200));
  jest.mocked(getHomeShopping).mockReset().mockResolvedValue(shop14());
  jest.mocked(orderHomeShopping).mockReset();
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

// ---------- T. 분류 탭 ----------

describe("[spec] 089-④ T: 분류 탭 끝에 '옷'", () => {
  test("T1 탭은 이 순서로 정확히 여섯이다: 전체, 가구, 조명, 장식, 식물, 옷", async () => {
    await renderHome();
    await openShop();

    expect(tabNodes().map(textOf)).toEqual(TABS);
  });

  test("T2 '옷' 탭은 옷 넷만 서버 순서로(주황 야구모자, 남색 반바지, 주황 티셔츠, 갈색 운동화) 보이고 목록 머리가 '옷'·'4가지'이며 '옷' 탭만 선택됨이다", async () => {
    await renderHome();
    await openShop();

    await pressTab("옷");

    expect(cardNames()).toEqual([CAP, SHORTS, TSHIRT, SHOES]);
    expect(countHeader()).toBe("4가지");
    expect(headerShowsTab("옷")).toBe(true);
    expect(tabNodes().filter(isSelected).map(textOf)).toEqual(["옷"]);
  });

  test("T3·T5 '전체'에 옷이 서버 순서 그대로 섞여 열넷이고 '14가지'다. '옷' 탭에서 '전체'로 돌아와도 같다", async () => {
    await renderHome();
    await openShop();

    expect(cardNames()).toEqual(NAMES14);
    expect(countHeader()).toBe("14가지");
    await pressTab("옷");
    await pressTab("전체");
    expect(cardNames()).toEqual(NAMES14);
    expect(countHeader()).toBe("14가지");
  });

  test.each([
    ["가구", ["협탁", "옷장", "침대"], "3가지"],
    ["조명", ["탁상 스탠드", "바닥 스탠드"], "2가지"],
    ["장식", ["책", "액자", "러그"], "3가지"],
    ["식물", ["작은 화분", "큰 화분"], "2가지"]
  ])("T4 '%s' 탭은 옷 없이 %j(%s)다", async (tab, names, count) => {
    await renderHome();
    await openShop();

    await pressTab(tab);

    expect(cardNames()).toEqual(names);
    expect(countHeader()).toBe(count);
  });

  test("T6 items를 거꾸로 주면 '옷' 탭도 거꾸로다(갈색 운동화, 주황 티셔츠, 남색 반바지, 주황 야구모자)", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ reversed: true }));
    await renderHome();
    await openShop();

    await pressTab("옷");

    expect(cardNames()).toEqual([SHOES, TSHIRT, SHORTS, CAP]);
  });
});

// ---------- N. 이름·설명·그림 ----------

describe("[spec] 089-④ N: 옷의 이름·설명·그림", () => {
  test("N1·N2 옷 카드는 접근성 이름이 '<이름>, N룹, 자세히 보기'이고 이름·가격 글이 보이며, 그림은 ③의 아이템 그림(이름 첫 글자 칸이 아님)이다", async () => {
    await renderHome();
    await openShop();
    await pressTab("옷");

    for (const { type, name, price } of CLOTHES) {
      const card = cardOf(name);
      expect(labelOf(card)).toBe(`${name}, ${price}룹, 자세히 보기`);
      expect(hasText(name, card)).toBe(true);
      expect(hasText(`${price}룹`, card)).toBe(true);
      expect({ type, sources: imageSourcesIn(card) }).toEqual({ type, sources: [wearableIcon(type)] });
      expect({ type, initial: countText(name.slice(0, 1), card) }).toEqual({ type, initial: 0 });
    }
  });

  test.each(CLOTHES)("N3 $name 상세창: 제목이 이름이고, 그림이 ③의 아이템 그림이며, 설명이 04 결정 C1 문구다", async ({ type, name }) => {
    await renderHome();
    await openShop();

    await pressNode(cardOf(name));

    const panel = detailPanel();
    expect(within(panel).getByRole("header", { name, ...ALL })).toBeTruthy();
    expect(imageSourcesIn(panel)).toContainEqual(wearableIcon(type));
    expect(within(panel).getByText(CLOTHES_DESCRIPTION[type], ALL)).toBeTruthy();
  });

  test("N4 오늘의 방송이 주황 야구모자면 방송 칸에 이름, 줄 그은 '60룹', '48룹', '20%'와 그 옷 그림이 있고 접근성 이름이 명세 모양이다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ cast: "capOrange" }));
    await renderHome();
    await openShop();

    const broadcast = broadcastButton();
    expect(labelOf(broadcast)).toBe("오늘의 방송 상품 주황 야구모자, 48룹, 20% 할인, 자세히 보기");
    expect(hasText(CAP, broadcast)).toBe(true);
    const struck = within(broadcast).queryAllByText(/^\d+룹$/, ALL).filter(isStruck).map(textOf);
    expect(struck).toEqual(["60룹"]);
    expect(hasText("48룹", broadcast)).toBe(true);
    expect(hasText("20%", broadcast)).toBe(true);
    expect(imageSourcesIn(broadcast)).toContainEqual(wearableIcon("capOrange"));
  });

  test("N5 옷 완료 판의 그림은 ③의 아이템 그림이다", async () => {
    await homeAndBuyCap();

    expect(imageSourcesIn(successPanel())).toContainEqual(wearableIcon("capOrange"));
  });
});

// ---------- B. 방송이 옷일 때 ----------

describe("[spec] 089-④ B: 오늘의 방송이 옷일 때", () => {
  test("B1 방송 옷 카드는 '주황 야구모자, 48룹, 20% 할인, 자세히 보기'이고 '20%' 배지가 있으며 다른 옷 카드에는 할인 표시가 없다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ cast: "capOrange" }));
    await renderHome();
    await openShop();
    await pressTab("옷");

    expect(labelOf(cardOf(CAP))).toBe("주황 야구모자, 48룹, 20% 할인, 자세히 보기");
    expect(hasText("20%", cardOf(CAP))).toBe(true);
    for (const name of [SHORTS, TSHIRT, SHOES]) {
      expect({ name, sale: hasText(/%/, cardOf(name)) }).toEqual({ name, sale: false });
      expect({ name, label: /할인/.test(labelOf(cardOf(name)) ?? "") }).toEqual({ name, label: false });
    }
  });

  test("B2 방송 칸을 눌러 상세창의 '48룹에 주문하기'를 누르면 옷 주문이 { type: 'capOrange', price: 48 }로 한 번 불린다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ cast: "capOrange" }));
    jest.mocked(orderHomeShoppingWearable).mockResolvedValueOnce({ ...oCap(), price: 48, balance: 152 });
    await renderHome();
    await openShop();

    await pressNode(broadcastButton());
    await pressNode(orderButton(48));

    expect(wearableOrders()).toEqual([{ type: "capOrange", price: 48 }]);
  });

  test("B3 오늘의 방송이 주황 티셔츠면 방송 칸에 '주황 티셔츠', 줄 그은 '80룹', '64룹', '20%'와 그 옷 그림", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ cast: "tshirtOrange" }));
    await renderHome();
    await openShop();

    const broadcast = broadcastButton();
    expect(hasText(TSHIRT, broadcast)).toBe(true);
    expect(within(broadcast).queryAllByText(/^\d+룹$/, ALL).filter(isStruck).map(textOf)).toEqual(["80룹"]);
    expect(hasText("64룹", broadcast)).toBe(true);
    expect(hasText("20%", broadcast)).toBe(true);
    expect(imageSourcesIn(broadcast)).toContainEqual(wearableIcon("tshirtOrange"));
  });
});

// ---------- D. 상세창의 입는 곳 ----------

describe("[spec] 089-④ D: 상세창의 '입는 곳'", () => {
  test.each(CLOTHES)("D1·D2 $name 상세창은 '입는 곳'이 '$place'이고, 놓는 위치·차지하는 크기와 그 값이 없다", async ({ name, place }) => {
    await renderHome();
    await openShop();

    await pressNode(cardOf(name));

    const panel = detailPanel();
    expect(hasText(WEAR_PLACE, panel)).toBe(true);
    expect(hasText(place, panel)).toBe(true);
    for (const absent of ["놓는 위치", "차지하는 크기", "바닥에 놓기", "바닥에 깔기", "책상·협탁 위", "벽에 걸기", "소품 자리 1칸"]) {
      expect({ absent, shown: hasText(absent, panel) }).toEqual({ absent, shown: false });
    }
    expect(hasText(/^\d+ × \d+칸$/, panel)).toBe(false);
    expect(hasText(/^가로 \d+칸$/, panel)).toBe(false);
  });

  test.each([
    ["침대", "바닥에 놓기", "2 × 3칸"],
    ["탁상 스탠드", "책상·협탁 위", "소품 자리 1칸"],
    ["액자", "벽에 걸기", "가로 1칸"]
  ])("D3 가구 %s 상세창은 그대로 놓는 위치 '%s'·차지하는 크기 '%s'이고 '입는 곳'이 없다", async (name, where, size) => {
    await renderHome();
    await openShop();

    await pressNode(cardOf(name));

    const panel = detailPanel();
    expect(hasText("놓는 위치", panel)).toBe(true);
    expect(hasText(where, panel)).toBe(true);
    expect(hasText("차지하는 크기", panel)).toBe(true);
    expect(hasText(size, panel)).toBe(true);
    expect(hasText(WEAR_PLACE, panel)).toBe(false);
  });

  test("D4 가지지 않은 옷(잔액 200)의 주문 버튼은 '60룹에 주문하기'이고 쓸 수 있다", async () => {
    await renderHome();
    await openShop();

    await pressNode(cardOf(CAP));

    expect(isDisabled(orderButton(60))).toBe(false);
  });

  test("D5 룹이 모자란 가지지 않은 옷(잔액 50)의 주문 버튼은 '10룹 더 필요해요'로 꺼져 있고 '이미 가진 옷이에요'가 없다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ balance: 50 }));
    await renderHome();
    await openShop();

    await pressNode(cardOf(CAP));

    expect(isDisabled(button("10룹 더 필요해요"))).toBe(true);
    expect(hasText(OWNED_BUTTON)).toBe(false);
  });
});

// ---------- G. 가진 옷 ----------

describe("[spec] 089-④ G: 가진 옷", () => {
  test("G1 가진 옷(주황 야구모자 owned 1) 카드에만 '가진 옷'이 있고 화면의 '가진 옷'은 하나다('옷' 탭)", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ owned: { capOrange: 1 } }));
    await renderHome();
    await openShop();
    await pressTab("옷");

    expect(hasText(OWNED, cardOf(CAP))).toBe(true);
    for (const name of [SHORTS, TSHIRT, SHOES]) expect({ name, owned: hasText(OWNED, cardOf(name)) }).toEqual({ name, owned: false });
    expect(countText(OWNED)).toBe(1);
  });

  test("G2 '전체'에서도 주황 야구모자 카드에만 '가진 옷'이 있다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ owned: { capOrange: 1 } }));
    await renderHome();
    await openShop();

    expect(hasText(OWNED, cardOf(CAP))).toBe(true);
    const others = listCards().filter((card) => cardName(card) !== CAP);
    expect(others.filter((card) => hasText(OWNED, card)).map(cardName)).toEqual([]);
  });

  test("G3·G4 가진 옷 상세창에 '가진 옷'이 있고 주문 버튼이 '이미 가진 옷이에요'로 꺼져 있으며, 눌러도 주문하지 않는다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ owned: { capOrange: 1 } }));
    await renderHome();
    await openShop();

    await pressNode(cardOf(CAP));

    const panel = detailPanel();
    expect(hasText(OWNED, panel)).toBe(true);
    const ownedButton = within(panel).getByRole("button", { name: OWNED_BUTTON, ...ALL });
    expect(isDisabled(ownedButton)).toBe(true);
    expect(within(panel).queryAllByRole("button", { name: "60룹에 주문하기", ...ALL })).toHaveLength(0);
    await pressNode(ownedButton);
    expect(orderHomeShoppingWearable).not.toHaveBeenCalled();
    expect(orderHomeShopping).not.toHaveBeenCalled();
    expect(successPanelOrNull()).toBeNull();
  });

  test("G5 룹이 모자라도(잔액 50) 가진 옷의 주문 버튼은 '이미 가진 옷이에요'(꺼짐)이고 '10룹 더 필요해요'가 없다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ balance: 50, owned: { capOrange: 1 } }));
    await renderHome();
    await openShop();

    await pressNode(cardOf(CAP));

    expect(isDisabled(button(OWNED_BUTTON))).toBe(true);
    expect(screen.queryAllByRole("button", { name: "10룹 더 필요해요", ...ALL })).toHaveLength(0);
  });

  test("G6 가구는 가진 개수가 있어도(침대 2, 옷장 1) '가진 옷'이 없고, 침대는 '100룹 더 필요해요'(꺼짐), 옷장은 '180룹에 주문하기'(쓸 수 있음)다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ owned: { bed: 2, wardrobe: 1 } }));
    await renderHome();
    await openShop();

    expect(hasText(OWNED)).toBe(false);
    await pressNode(cardOf("침대"));
    expect(isDisabled(button("100룹 더 필요해요"))).toBe(true);
    expect(hasText(OWNED)).toBe(false);
    expect(hasText(OWNED_BUTTON)).toBe(false);
    await pressNode(button(DETAIL_CLOSE));
    await pressNode(cardOf("옷장"));
    expect(isDisabled(orderButton(180))).toBe(false);
    expect(hasText(OWNED)).toBe(false);
    expect(hasText(OWNED_BUTTON)).toBe(false);
  });

  test("G7 가진 옷이 없으면(owned 모두 0) '가진 옷'이 어디에도 없다", async () => {
    await renderHome();
    await openShop();

    expect(hasText(OWNED)).toBe(false);
    await pressTab("옷");
    expect(hasText(OWNED)).toBe(false);
  });

  test("C2(04 결정) 방송 상품이 가진 옷이면 방송 칸에도 '가진 옷'이 붙는다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ cast: "capOrange", owned: { capOrange: 1 } }));
    await renderHome();
    await openShop();

    expect(hasText(OWNED, broadcastButton())).toBe(true);
    expect(hasText(OWNED, cardOf(CAP))).toBe(true);
  });
});

// ---------- O. 옷 주문과 완료 판 ----------

describe("[spec] 089-④ O: 옷 주문과 완료 판", () => {
  test("O1·O2 주황 야구모자를 사면 옷 주문이 { type: 'capOrange', price: 60 }로 한 번 불리고, 완료 판이 '옷장에 도착했어요', '주황 야구모자 · 남은 룹 140', '계속 구경하기'·'바로 입기'이며 가구 완료 판 글이 없다", async () => {
    await homeAndBuyCap();

    expect(wearableOrders()).toEqual([{ type: "capOrange", price: 60 }]);
    expect(orderHomeShopping).not.toHaveBeenCalled();
    const panel = successPanel();
    expect(within(panel).getByRole("header", { name: ARRIVED_CLOTHES, ...ALL })).toBeTruthy();
    expect(within(panel).getByText("주황 야구모자 · 남은 룹 140", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: KEEP_BROWSING, ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: WEAR_NOW, ...ALL })).toBeTruthy();
    expect(hasText(ARRIVED_FURNITURE)).toBe(false);
    expect(screen.queryAllByRole("button", { name: PLACE_NOW, ...ALL })).toHaveLength(0);
    expect(hasText(/주황 야구모자 1개/)).toBe(false);
  });

  test("O3 갈색 운동화를 사면 완료 판이 '옷장에 도착했어요', '갈색 운동화 · 남은 룹 110', 버튼 둘이다", async () => {
    await renderHome();
    await openShop();

    await buy(SHOES, 90, oShoes());

    const panel = successPanel();
    expect(within(panel).getByRole("header", { name: ARRIVED_CLOTHES, ...ALL })).toBeTruthy();
    expect(within(panel).getByText("갈색 운동화 · 남은 룹 110", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: KEEP_BROWSING, ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: WEAR_NOW, ...ALL })).toBeTruthy();
  });

  test("O4 옷 주문은 방 배치를 바꾸지 않는다(방 그리기의 배치가 주문 전과 같고 배치 저장이 불리지 않음)", async () => {
    await renderHome();
    const before = homeLayoutJson();
    await openShop();

    await buy(CAP, 60, oCap());

    expect(successPanelOrNull()).not.toBeNull();
    expect(homeLayoutJson()).toBe(before);
    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });

  test("O5 옷을 산 뒤 홈쇼핑 위 줄 잔액은 '잔액 140룹'이고, 홈쇼핑을 닫으면 홈 잔액 칩도 140룹이다", async () => {
    await homeAndBuyCap();

    expect(screen.getByLabelText("잔액 140룹", ALL)).toBeTruthy();
    await pressNode(button(KEEP_BROWSING));
    await pressNode(button(SHOP_CLOSE));
    expect(shopOpen()).toBe(false);
    expect(chips()).toEqual(["140룹"]);
  });

  test("O6 산 직후(바로 입기 전) 홈 착용 목록은 [top, shoes] 그대로이고 바로 입기 저장은 불리지 않았다", async () => {
    await renderHome();
    expect(homeWorn()).toEqual(["top", "shoes"]);
    await openShop();

    await buy(CAP, 60, oCap());

    expect(homeWorn()).toEqual(["top", "shoes"]);
    expect(saveWardrobeEquipped).not.toHaveBeenCalled();
  });

  test("O7·C3 서버가 409 ALREADY_OWNED면 완료 판 없이 '이미 가진 옷이에요.'를 보이고, 목록을 다시 불러와 그 카드·상세창이 가진 옷이 된다. 배치·착용·잔액은 그대로", async () => {
    await renderHome();
    const layoutBefore = homeLayoutJson();
    await openShop();
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ owned: { capOrange: 1 } }));
    jest.mocked(orderHomeShoppingWearable).mockRejectedValueOnce(new ApiError("이미 가진 옷이에요.", 409, "ALREADY_OWNED"));

    await pressNode(cardOf(CAP));
    await pressNode(orderButton(60));

    expect(successPanelOrNull()).toBeNull();
    expect(hasText("이미 가진 옷이에요.")).toBe(true);
    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    const panel = detailPanel();
    expect(hasText(OWNED, panel)).toBe(true);
    expect(isDisabled(within(panel).getByRole("button", { name: OWNED_BUTTON, ...ALL }))).toBe(true);
    expect(homeLayoutJson()).toBe(layoutBefore);
    expect(homeWorn()).toEqual(["top", "shoes"]);
    expect(screen.getByLabelText("잔액 200룹", ALL)).toBeTruthy();
    await pressNode(button(DETAIL_CLOSE));
    expect(hasText(OWNED, cardOf(CAP))).toBe(true);
  });

  test("O8 옷 주문이 409 PRICE_CHANGED면 서버 문구를 보이고 목록을 다시 불러오며 완료 판이 없다", async () => {
    await renderHome();
    await openShop();
    jest.mocked(orderHomeShoppingWearable).mockRejectedValueOnce(new ApiError("가격이 바뀌었어요. 다시 확인해 주세요.", 409, "PRICE_CHANGED"));

    await pressNode(cardOf(CAP));
    await pressNode(orderButton(60));

    expect(hasText("가격이 바뀌었어요. 다시 확인해 주세요.")).toBe(true);
    expect(getHomeShopping).toHaveBeenCalledTimes(2);
    expect(successPanelOrNull()).toBeNull();
  });

  test("O9 옷 주문이 409 NOT_ENOUGH_LOOP_POINTS면 서버 문구 '룹이 모자라요.'를 보이고 완료 판이 없다", async () => {
    await renderHome();
    await openShop();
    jest.mocked(orderHomeShoppingWearable).mockRejectedValueOnce(new ApiError("룹이 모자라요.", 409, "NOT_ENOUGH_LOOP_POINTS"));

    await pressNode(cardOf(CAP));
    await pressNode(orderButton(60));

    expect(hasText("룹이 모자라요.")).toBe(true);
    expect(successPanelOrNull()).toBeNull();
  });
});

// ---------- W. 바로 입기 ----------

describe("[spec] 089-④ W: '바로 입기'", () => {
  test(
    "W1·W4·W5·W6 '바로 입기'는 주문 결과의 입은 것에서 모자만 바꿔 한 번 저장하고, 성공하면 홈쇼핑을 닫으며, 다시 불러오지 않고 홈 라룹이가 [hat, top, shoes]를 입는다. 배치는 그대로",
    async () => {
      await renderHome();
      const layoutBefore = homeLayoutJson();
      await openShop();
      await buy(CAP, 60, oCap());
      const loadsBefore = jest.mocked(getWardrobe).mock.calls.length;

      await pressNode(button(WEAR_NOW));

      expect(savedBodies()).toEqual([{ hat: "capOrange", top: "tshirtOrange", bottom: null, shoes: "shoesBrown", face: null, back: null, accessory: null }]);
      expect(shopOpen()).toBe(false);
      expect(homeWorn()).toEqual(["hat", "top", "shoes"]);
      expect(jest.mocked(getWardrobe).mock.calls.length).toBe(loadsBefore);
      expect(homeLayoutJson()).toBe(layoutBefore);
      expect(saveLobbyLayout).not.toHaveBeenCalled();
      // 방이 다시 입력을 받는다(바닥을 누르면 라룹이가 걷는다)
      const before = { x: sim().x, z: sim().z };
      await tapHit({ point: { x: 4, z: 8 }, mark: null, onCharacter: false });
      await frames(1);
      expect({ x: sim().x, z: sim().z }).not.toEqual(before);
    },
    SLOW_TEST_MS
  );

  test("W2 다른 부위는 주문 결과 그대로 보낸다(모자만 capBlue에서 capOrange로, 얼굴장식 glassesRound는 그대로)", async () => {
    await homeAndBuyCap(oCapOther());

    await pressNode(button(WEAR_NOW));

    expect(savedBodies()).toEqual([{ hat: "capOrange", top: "tshirtOrange", bottom: null, shoes: null, face: "glassesRound", back: null, accessory: null }]);
  });

  test("W3 갈색 운동화의 '바로 입기'는 신발만 바꿔 보낸다", async () => {
    jest.mocked(saveWardrobeEquipped).mockResolvedValue(
      wardrobe({ items: oShoes().wardrobe!.items, equipped: { ...ALL_NULL, shoes: "shoesBrown" } })
    );
    await renderHome();
    await openShop();
    await buy(SHOES, 90, oShoes());

    await pressNode(button(WEAR_NOW));

    expect(savedBodies()).toEqual([{ hat: null, top: null, bottom: null, shoes: "shoesBrown", face: null, back: null, accessory: null }]);
  });

  test(
    "W7·W8 저장하는 동안 '계속 구경하기'·'바로 입기'는 꺼져 있고 눌러도 완료 판에 남으며 저장은 한 번이다. 저장이 끝나면 홈쇼핑이 닫히고 [hat, top, shoes]",
    async () => {
      const pending = deferred<Wardrobe>();
      jest.mocked(saveWardrobeEquipped).mockReset().mockReturnValueOnce(pending.promise);
      await homeAndBuyCap();

      await pressNode(button(WEAR_NOW));

      expect(isDisabled(button(KEEP_BROWSING))).toBe(true);
      expect(isDisabled(button(WEAR_NOW))).toBe(true);
      await pressNode(button(KEEP_BROWSING));
      expect(successPanelOrNull()).not.toBeNull();
      await pressNode(button(WEAR_NOW));
      expect(saveWardrobeEquipped).toHaveBeenCalledTimes(1);

      await act(async () => {
        pending.resolve(P_CAP());
      });
      await flushAsync();

      expect(saveWardrobeEquipped).toHaveBeenCalledTimes(1);
      expect(shopOpen()).toBe(false);
      expect(homeWorn()).toEqual(["hat", "top", "shoes"]);
    },
    SLOW_TEST_MS
  );

  test.each([
    ["네트워크 오류", "network" as const, undefined],
    ["500, 본문 없음", 500, undefined],
    ["400 WARDROBE_INVALID(서버 문구 있음)", 400, { code: "WARDROBE_INVALID", message: "입을 수 없는 아이템이에요" }],
    ["500 '서버 오류'", 500, { message: "서버 오류" }],
    ["401", 401, { message: "로그인이 필요해요" }]
  ])("W9~W11·C4 저장이 %s로 실패하면 늘 '입지 못했어요. 다시 시도해 주세요'를 보이고 완료 판에 남으며 홈 착용은 그대로다", async (_label, status, body) => {
    await homeAndBuyCap();
    saveAnswers(status, body);

    await pressNode(button(WEAR_NOW));

    expect(hasText(WEAR_FAILED)).toBe(true);
    if (body && typeof body === "object" && "message" in body) expect(hasText(String((body as { message: string }).message))).toBe(false);
    const panel = successPanel();
    expect(within(panel).getByRole("header", { name: ARRIVED_CLOTHES, ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: KEEP_BROWSING, ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: WEAR_NOW, ...ALL })).toBeTruthy();
    expect(shopOpen()).toBe(true);
    expect(homeWorn()).toEqual(["top", "shoes"]);
  });

  test("W12·W13 실패 뒤 두 버튼을 다시 쓸 수 있고, '바로 입기'를 다시 누르면 같은 본문으로 다시 저장해 성공하면 닫히고 [hat, top, shoes]", async () => {
    await homeAndBuyCap();
    saveAnswers("network");
    await pressNode(button(WEAR_NOW));
    expect(hasText(WEAR_FAILED)).toBe(true);

    expect(isDisabled(button(KEEP_BROWSING))).toBe(false);
    expect(isDisabled(button(WEAR_NOW))).toBe(false);
    jest.mocked(saveWardrobeEquipped).mockResolvedValueOnce(P_CAP());
    await pressNode(button(WEAR_NOW));

    const body = { hat: "capOrange", top: "tshirtOrange", bottom: null, shoes: "shoesBrown", face: null, back: null, accessory: null };
    expect(savedBodies()).toEqual([body, body]);
    expect(shopOpen()).toBe(false);
    expect(homeWorn()).toEqual(["hat", "top", "shoes"]);
  });

  test("W14 실패 뒤 '계속 구경하기'를 누르면 목록으로 돌아가 주황 야구모자 카드에 '가진 옷'이 붙고 홈 착용은 그대로다", async () => {
    await homeAndBuyCap();
    saveAnswers("network");
    await pressNode(button(WEAR_NOW));

    await pressNode(button(KEEP_BROWSING));

    expect(successPanelOrNull()).toBeNull();
    expect(shopOpen()).toBe(true);
    expect(hasText(OWNED, cardOf(CAP))).toBe(true);
    expect(homeWorn()).toEqual(["top", "shoes"]);
  });

  test(
    "C5(04 결정) 저장하는 동안 완료 판 닫기·어두운 뒤 누르기·홈쇼핑 닫기·기기 뒤로 가기를 받지 않고, 저장이 끝나면 닫히고 입는다",
    async () => {
      const pending = deferred<Wardrobe>();
      jest.mocked(saveWardrobeEquipped).mockReset().mockReturnValueOnce(pending.promise);
      await homeAndBuyCap();
      await pressNode(button(WEAR_NOW));

      await pressNode(button(DETAIL_CLOSE));
      expect(successPanelOrNull()).not.toBeNull();
      const shade = shopModal().queryAll(
        (node) => (node.props as { importantForAccessibility?: string }).importantForAccessibility === "no" && typeof node.type === "string"
      );
      expect(shade.length).toBeGreaterThan(0);
      await pressNode(shade[0]);
      expect(successPanelOrNull()).not.toBeNull();
      await pressNode(button(SHOP_CLOSE));
      expect(shopOpen()).toBe(true);
      await pressBackInShop();
      expect(shopOpen()).toBe(true);
      expect(successPanelOrNull()).not.toBeNull();

      await act(async () => {
        pending.resolve(P_CAP());
      });
      await flushAsync();

      expect(saveWardrobeEquipped).toHaveBeenCalledTimes(1);
      expect(shopOpen()).toBe(false);
      expect(homeWorn()).toEqual(["hat", "top", "shoes"]);
    },
    SLOW_TEST_MS
  );

  test("C6(04 결정) 홈이 앞서 부른 옷장 불러오기가 바로 입기 뒤에 늦게 오면(모자 없음) 버리고 [hat, top, shoes]를 그대로 입는다", async () => {
    const slow = deferred<Wardrobe | null>();
    jest.mocked(getWardrobe).mockReset().mockReturnValueOnce(slow.promise).mockResolvedValue(H0());
    await homeAndBuyCap();

    await pressNode(button(WEAR_NOW));
    expect(homeWorn()).toEqual(["hat", "top", "shoes"]);

    await act(async () => {
      slow.resolve(H0());
    });
    await flushAsync();

    expect(homeWorn()).toEqual(["hat", "top", "shoes"]);
  });

  test.each([
    ["없음(null)", null],
    ["equipped가 없는 모양", { items: [] }]
  ])("C7(04 결정) 주문 결과의 wardrobe가 %s이어도 완료 판이 뜨고, '바로 입기'는 옷장을 불러와 그 입은 것에서 모자만 바꿔 저장한다", async (_label, value) => {
    await homeAndBuyCap(oCap(value));
    expect(within(successPanel()).getByRole("header", { name: ARRIVED_CLOTHES, ...ALL })).toBeTruthy();
    const loadsBefore = jest.mocked(getWardrobe).mock.calls.length;
    jest.mocked(getWardrobe).mockResolvedValueOnce(W_CAP());

    await pressNode(button(WEAR_NOW));

    expect(jest.mocked(getWardrobe).mock.calls.length).toBe(loadsBefore + 1);
    expect(savedBodies()).toEqual([{ hat: "capOrange", top: "tshirtOrange", bottom: null, shoes: "shoesBrown", face: null, back: null, accessory: null }]);
    expect(shopOpen()).toBe(false);
    expect(homeWorn()).toEqual(["hat", "top", "shoes"]);
  });

  test.each([
    ["실패(오류)", "reject" as const],
    ["로그인 풀림(null)", "null" as const]
  ])("C7(04 결정) wardrobe가 없는데 옷장 불러오기도 %s면 저장하지 않고 '입지 못했어요. 다시 시도해 주세요'를 보이며 완료 판에 남는다", async (_label, mode) => {
    await homeAndBuyCap(oCap(null));
    if (mode === "reject") jest.mocked(getWardrobe).mockRejectedValueOnce(new Error("옷장을 불러오지 못했어요"));
    else jest.mocked(getWardrobe).mockResolvedValueOnce(null);

    await pressNode(button(WEAR_NOW));

    expect(saveWardrobeEquipped).not.toHaveBeenCalled();
    expect(hasText(WEAR_FAILED)).toBe(true);
    expect(within(successPanel()).getByRole("header", { name: ARRIVED_CLOTHES, ...ALL })).toBeTruthy();
    expect(shopOpen()).toBe(true);
    expect(homeWorn()).toEqual(["top", "shoes"]);
  });
});

// ---------- K. 계속 구경하기 ----------

describe("[spec] 089-④ K: '계속 구경하기'", () => {
  test("K1·K2·K3 '옷' 탭에서 산 뒤 '계속 구경하기'를 누르면 '옷' 탭 목록으로 돌아가고, 다시 불러오지 않아도 카드에 '가진 옷'이 붙으며, 다시 연 상세창은 가진 옷이다", async () => {
    await renderHome();
    await openShop();
    await pressTab("옷");
    await buy(CAP, 60, oCap());

    await pressNode(button(KEEP_BROWSING));

    expect(successPanelOrNull()).toBeNull();
    expect(detailPanelOrNull()).toBeNull();
    expect(shopOpen()).toBe(true);
    expect(tabNodes().filter(isSelected).map(textOf)).toEqual(["옷"]);
    expect(cardNames()).toEqual([CAP, SHORTS, TSHIRT, SHOES]);
    expect(hasText(OWNED, cardOf(CAP))).toBe(true);
    expect(getHomeShopping).toHaveBeenCalledTimes(1);
    await pressNode(cardOf(CAP));
    const panel = detailPanel();
    expect(hasText(OWNED, panel)).toBe(true);
    expect(isDisabled(within(panel).getByRole("button", { name: OWNED_BUTTON, ...ALL }))).toBe(true);
  });

  test("K4 '계속 구경하기' 뒤 홈쇼핑을 닫아도 홈 착용은 [top, shoes], 바로 입기 저장 없음, 배치 그대로", async () => {
    await renderHome();
    const layoutBefore = homeLayoutJson();
    await openShop();
    await buy(CAP, 60, oCap());

    await pressNode(button(KEEP_BROWSING));
    await pressNode(button(SHOP_CLOSE));

    expect(shopOpen()).toBe(false);
    expect(homeWorn()).toEqual(["top", "shoes"]);
    expect(saveWardrobeEquipped).not.toHaveBeenCalled();
    expect(homeLayoutJson()).toBe(layoutBefore);
  });
});

// ---------- H. 홈과 옷장 ----------

describe("[spec] 089-④ H: 산 옷은 다음에 옷장을 열면 그 부위 칸에 나온다", () => {
  test(
    "H1 주황 야구모자를 사고 홈쇼핑을 닫은 뒤 옷장을 열면 불러오기가 한 번 더 불리고 모자 탭이 '벗기', '주황 야구모자' 칸이다",
    async () => {
      await homeAndBuyCap();
      await pressNode(button(KEEP_BROWSING));
      await pressNode(button(SHOP_CLOSE));
      const loadsBefore = jest.mocked(getWardrobe).mock.calls.length;

      await walkAndOpenCloset(W_CAP());

      expect(jest.mocked(getWardrobe).mock.calls.length).toBe(loadsBefore + 1);
      expect(cellNames()).toEqual([OFF, CAP]);
    },
    SLOW_TEST_MS
  );

  test(
    "H2 '바로 입기' 뒤 옷장을 열면 모자 탭에서 '주황 야구모자' 칸이 입은 것으로 표시된다",
    async () => {
      await homeAndBuyCap();
      await pressNode(button(WEAR_NOW));
      expect(shopOpen()).toBe(false);

      await walkAndOpenCloset(P_CAP());

      expect(selectedCells()).toEqual([CAP]);
    },
    SLOW_TEST_MS
  );
});

// ---------- F. 가구 주문은 그대로 ----------

describe("[spec] 089-④ F: 가구 주문은 그대로", () => {
  test("F1·F2·F5 침대를 사면 완료 판이 '보관함에 도착했어요', '침대 1개 · 남은 룹 0', '계속 구경하기'·'바로 놓기'이고 옷 완료 판 글이 없으며, 배치 보관함에 bed-1이 있고 홈 착용은 그대로다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ balance: 300 }));
    jest.mocked(orderHomeShopping).mockResolvedValueOnce(oBed());
    await renderHome();
    await openShop();

    await pressNode(cardOf("침대"));
    await pressNode(orderButton(300));

    expect(jest.mocked(orderHomeShopping).mock.calls.map((call) => call[0])).toEqual([{ type: "bed", price: 300 }]);
    expect(orderHomeShoppingWearable).not.toHaveBeenCalled();
    const panel = successPanel();
    expect(within(panel).getByRole("header", { name: ARRIVED_FURNITURE, ...ALL })).toBeTruthy();
    expect(within(panel).getByText("침대 1개 · 남은 룹 0", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: KEEP_BROWSING, ...ALL })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: PLACE_NOW, ...ALL })).toBeTruthy();
    expect(hasText(ARRIVED_CLOTHES)).toBe(false);
    expect(screen.queryAllByRole("button", { name: WEAR_NOW, ...ALL })).toHaveLength(0);
    expect(storedIds(activeLobbyLayout())).toContain("bed-1");
    expect(homeWorn()).toEqual(["top", "shoes"]);
  });

  test("F3 침대 완료 판의 '바로 놓기'는 홈쇼핑을 닫고 bed-1을 든 꾸미기를 열며 바로 입기 저장은 없다", async () => {
    jest.mocked(getHomeShopping).mockResolvedValue(shop14({ balance: 300 }));
    jest.mocked(orderHomeShopping).mockResolvedValueOnce(oBed());
    await renderHome();
    await openShop();
    await pressNode(cardOf("침대"));
    await pressNode(orderButton(300));

    await pressNode(button(PLACE_NOW));

    expect(shopOpen()).toBe(false);
    expect(canvas().edit?.lifted).toBe("bed-1");
    expect(saveWardrobeEquipped).not.toHaveBeenCalled();
  });

  test("F4 가구 옷장(wardrobe)은 상세창이 '바닥에 놓기'·'1 × 1칸'이고 '입는 곳'이 없으며, 사면 가구 주문으로 '보관함에 도착했어요', '옷장 1개 · 남은 룹 20', '바로 놓기'이고 보관함에 wardrobe-2가 있다", async () => {
    jest.mocked(orderHomeShopping).mockResolvedValueOnce(oWardrobeFurniture());
    await renderHome();
    await openShop();

    await pressNode(cardOf("옷장"));
    const detail = detailPanel();
    expect(hasText("바닥에 놓기", detail)).toBe(true);
    expect(hasText("1 × 1칸", detail)).toBe(true);
    expect(hasText(WEAR_PLACE, detail)).toBe(false);
    await pressNode(orderButton(180));

    expect(jest.mocked(orderHomeShopping).mock.calls.map((call) => call[0])).toEqual([{ type: "wardrobe", price: 180 }]);
    expect(orderHomeShoppingWearable).not.toHaveBeenCalled();
    const panel = successPanel();
    expect(within(panel).getByRole("header", { name: ARRIVED_FURNITURE, ...ALL })).toBeTruthy();
    expect(within(panel).getByText("옷장 1개 · 남은 룹 20", ALL)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: PLACE_NOW, ...ALL })).toBeTruthy();
    expect(hasText(ARRIVED_CLOTHES)).toBe(false);
    expect(screen.queryAllByRole("button", { name: WEAR_NOW, ...ALL })).toHaveLength(0);
    expect(hasText(OWNED)).toBe(false);
    expect(storedIds(activeLobbyLayout())).toContain("wardrobe-2");
  });
});
