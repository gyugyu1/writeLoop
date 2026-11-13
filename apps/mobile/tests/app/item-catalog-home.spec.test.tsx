// [spec] qa 테스트(작업 090-① 서버 아이템 목록, 기능 변경, 모바일): 홈이 아이템 목록(GET /api/catalog)을 받아 저장하고,
// 꾸미기 보관함·홈쇼핑의 이름·설명·분류를 그 목록에서 가져오며, 그릴 줄 모르는 아이템은 홈쇼핑에서 보이지 않고 방 배치에서는 그리지 않되 지키는지.
// 기대값은 명세(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/02-서버-아이템-목록/01-main-spec.md)의 "바뀌는 동작 > 서버"(새 API 모양)·
// "바뀌는 동작 > 모바일"과 "그대로여야 할 동작"(보이는 이름·설명·가격·분류·상품 순서)에서만 가져온다. 지금 이름·설명·분류 값은 지금 앱 표(home-shopping-catalog,
// furniture-catalog, wear)의 값이다. 테스트 이름 앞의 [바뀔]·[그대로]는 03-qa-tests.md의 분류와 같다.
//
// 목록을 받는 함수 이름은 아직 없어서(구현 전) 모른다. 그래서 api 가짜는 진짜 모듈을 펼치고 홈이 부르는 다른 함수만 가짜로 바꾼다:
// 목록 받기·배치 불러오기·저장·가구 주문은 진짜 함수가 전역 fetch(가짜 서버)를 부른다. 가짜 서버는 경로로 답한다.
// 가정: 목록은 앱 화면(HomeScreen) 하나를 그리는 것으로 받고 쓰인다(루트 레이아웃의 Provider를 거쳐야 하면 이 테스트의 그리기를 감싸야 한다).
// 가정: "기기에 저장"은 이 앱의 다른 기기 저장처럼 AsyncStorage다(K-save의 저장소 확인 한 곳만 이 가정을 쓴다).
// 목록 상태가 모듈 안에 남을 수 있어(한 파일 안의 테스트가 이어서 돈다), 테스트마다 서로 다른 날로 시계를 두고(하루 한 번 받기에 막히지 않게),
// "한 번도 받지 못했을 때" 테스트(H1)를 이 파일 맨 앞에 둔다.
// 같은 폴더 04-main-decision.md의 B(목록 칸 값: shopName·description은 늘 글)와 C(모바일 답 1~7)를 기대값에 더했다. 그 결정에서 온 테스트는 이름에 "04 결정 C…"를 적었다.
// 3D 그리기는 가짜다. "그린다"는 3D 그리기가 가구를 만드는 목록(buildPlacements(엔진의 지금 배치))에 그 가구가 있는 것으로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { BackHandler } from "react-native";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getHomeShopping,
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
import { activeLobbyLayout, applyLobbyLayout } from "@/lib/lobby3d/engine";
import { buildPlacements } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, HomeShopping, LoopPointsSummary, MobileHomeSnapshot } from "@/lib/types";
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
  return {
    __esModule: true,
    default: (props: Lobby3dCanvasProps) => {
      mockCanvas.props = props;
      return React.createElement("Lobby3dCanvasMock");
    }
  };
});
// 진짜 api 모듈을 펼친다: 목록 받기(이름 모름)·배치 불러오기·저장·가구 주문은 진짜 함수가 가짜 fetch를 부른다
jest.mock("@/lib/api", () => ({
  ...jest.requireActual<typeof import("@/lib/api")>("@/lib/api"),
  getDiaryCalendarSummary: jest.fn(),
  getFeaturedDailyPrompt: jest.fn(),
  getHomeShopping: jest.fn(),
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
jest.mock("@/lib/practice-feedback-state", () => ({ hydratePracticeFeedbackState: jest.fn(), clearPracticeFeedbackState: jest.fn() }));
jest.mock("@/lib/session", () => ({ useSession: jest.fn() }));
jest.mock("@/lib/writing-drafts", () => ({ getLocalWritingDraft: jest.fn() }));

// ---------- 아이템 목록(GET /api/catalog의 모양: 명세 "새 API") ----------

type CatalogItem = {
  id: string;
  kind: "furniture" | "wearable";
  name: string;
  shopName: string;
  description: string;
  category: "furniture" | "lighting" | "decor" | "plants" | "clothes" | null;
  slot: string | null;
  price: number | null;
  assets: null;
};

// 04-main-decision.md B: 팔지 않는 아이템도 shopName은 name과 같은 글, description은 빈 글. 옷의 shopName은 name과 같다.
const furniture = (id: string, name: string, sale?: { shopName: string; description: string; category: CatalogItem["category"]; price: number }): CatalogItem => ({
  id,
  kind: "furniture",
  name,
  shopName: sale?.shopName ?? name,
  description: sale?.description ?? "",
  category: sale?.category ?? null,
  slot: null,
  price: sale?.price ?? null,
  assets: null
});

const wearable = (id: string, slot: string, name: string, sale?: { description: string; price: number }): CatalogItem => ({
  id,
  kind: "wearable",
  name,
  shopName: name,
  description: sale?.description ?? "",
  category: sale ? "clothes" : null,
  slot,
  price: sale?.price ?? null,
  assets: null
});

/** 지금 앱·서버와 같은 값의 목록(이름·설명·분류·가격). */
function currentCatalogItems(): CatalogItem[] {
  return [
    furniture("desk", "일기 책상"),
    furniture("bookcase", "책장"),
    furniture("wardrobe", "옷장", { shopName: "옷장", description: "방 한쪽을 차분하게 채우는 기본 옷장이에요.", category: "furniture", price: 180 }),
    furniture("rug", "깔개", { shopName: "러그", description: "가구 아래에 깔아 공간을 아늑하게 묶어 줘요.", category: "decor", price: 150 }),
    furniture("lamp", "스탠드", { shopName: "탁상 스탠드", description: "책상이나 협탁 위를 따뜻하게 밝혀 줘요.", category: "lighting", price: 60 }),
    furniture("bed", "침대", { shopName: "침대", description: "하루를 마무리하는 포근한 자리예요.", category: "furniture", price: 300 }),
    furniture("nightstand", "협탁", { shopName: "협탁", description: "윗면에 조명이나 작은 소품을 올려 보세요.", category: "furniture", price: 100 }),
    furniture("floorLamp", "바닥 스탠드", { shopName: "바닥 스탠드", description: "침대 옆이나 방 구석에 작은 빛을 더해요.", category: "lighting", price: 110 }),
    furniture("plant", "화분", { shopName: "큰 화분", description: "빈 공간에 싱그러운 초록을 더해 보세요.", category: "plants", price: 80 }),
    furniture("smallPlant", "작은 화분", { shopName: "작은 화분", description: "작은 초록 하나로 책상이 산뜻해져요.", category: "plants", price: 50 }),
    furniture("books", "책", { shopName: "책", description: "책 몇 권을 쌓아 나만의 독서 분위기를 만들어요.", category: "decor", price: 40 }),
    furniture("board", "오늘의 질문 게시판"),
    furniture("window", "창문"),
    furniture("frame", "액자", { shopName: "액자", description: "허전한 벽을 채우는 작은 그림이에요.", category: "decor", price: 70 }),
    wearable("capOrange", "hat", "주황 야구모자", { description: "발바닥 무늬가 들어간 산뜻한 주황 모자예요.", price: 60 }),
    wearable("tshirtOrange", "top", "주황 티셔츠", { description: "어디에나 잘 어울리는 편한 주황 티셔츠예요.", price: 80 }),
    wearable("shortsNavy", "bottom", "남색 반바지", { description: "가볍게 움직이기 좋은 남색 반바지예요.", price: 70 }),
    wearable("shoesBrown", "shoes", "갈색 운동화", { description: "폭신하게 걷기 좋은 갈색 운동화예요.", price: 90 }),
    wearable("goggles", "face", "라룹이 고글")
  ];
}

const QA_VERSION = "qa-catalog-v1";
const QA_BED = { name: "QA 침대", shopName: "QA 왕 침대", description: "QA 침대 설명이에요." };
const QA_PLANT_SHOP = "QA 큰 화분";
const QA_CAP = { name: "QA 주황 모자", description: "QA 모자 설명이에요." };

/** 서버가 이름·설명·분류를 바꾼 목록(침대·큰 화분·주황 모자)에, 앱이 그릴 줄 모르는 가구(sofa)·옷(glassesRound)을 더한 것. */
function qaCatalog() {
  const items = currentCatalogItems().map((item): CatalogItem => {
    if (item.id === "bed") return { ...item, name: QA_BED.name, shopName: QA_BED.shopName, description: QA_BED.description };
    if (item.id === "plant") return { ...item, shopName: QA_PLANT_SHOP, category: "decor" };
    if (item.id === "capOrange") return { ...item, name: QA_CAP.name, shopName: QA_CAP.name, description: QA_CAP.description };
    return item;
  });
  return { version: QA_VERSION, items: [...items, ...unknownCatalogItems()] };
}

/** 앱이 그릴 줄 모르는 가구(sofa)·옷(glassesRound)의 목록 칸. */
function unknownCatalogItems(): CatalogItem[] {
  return [
    furniture("sofa", "소파", { shopName: "QA 소파", description: "QA 소파 설명이에요.", category: "furniture", price: 200 }),
    wearable("glassesRound", "face", "QA 둥근 안경", { description: "QA 안경 설명이에요.", price: 90 })
  ];
}

/** 지금 이름 그대로인 목록에 앱이 그릴 줄 모르는 가구·옷만 더한 것(이름이 아니라 모르는 상품 처리만 볼 때). */
function currentWithUnknownCatalog() {
  return { version: "qa-current-unknown-v1", items: [...currentCatalogItems(), ...unknownCatalogItems()] };
}

// ---------- 가짜 서버(경로로 답한다) ----------

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

type Answer = { status: number; body?: unknown };

const mockServer: { catalog: Answer; lobbyLayout: Answer; order: Answer } = {
  catalog: { status: 500, body: { message: "목록 없음" } },
  lobbyLayout: { status: 404, body: { message: "없음" } },
  order: { status: 500, body: { message: "주문 없음" } }
};

const fetchMock = jest.fn<Promise<FakeResponse>, [string, RequestInit?]>();
const originalFetch = globalThis.fetch;

function pathOf(url: string): string {
  return url.replace(/^[a-z]+:\/\/[^/]+/i, "").replace(/\?.*$/, "");
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

function route(url: string, init?: RequestInit): FakeResponse {
  const path = pathOf(url);
  const method = methodOf(init);
  if (path === "/api/catalog") return respond(mockServer.catalog.status, mockServer.catalog.body);
  if (path === "/api/lobby-layout" && method === "GET") return respond(mockServer.lobbyLayout.status, mockServer.lobbyLayout.body);
  // 가짜 서버는 저장한 본문을 그대로 돌려준다
  if (path === "/api/lobby-layout" && method === "PUT") return respond(200, JSON.parse(String(init?.body)));
  if (path === "/api/home-shopping/orders" && method === "POST") return respond(mockServer.order.status, mockServer.order.body);
  return respond(404, { message: "없음" });
}

function catalogCalls() {
  return fetchMock.mock.calls.filter(([url]) => pathOf(String(url)) === "/api/catalog");
}

function lobbyLayoutPuts(): { items: Record<string, unknown>[]; stored?: Record<string, unknown>[] }[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => pathOf(String(url)) === "/api/lobby-layout" && methodOf(init) === "PUT")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

// ---------- 고정 데이터 ----------

/** 기준 시각: 서울 10시. 테스트마다 nextDay()로 앞 테스트보다 늦은 다른 날에 둔다(시계가 뒤로 가지 않게 파일 순서대로 늘어난다). */
const BASE = Date.parse("2026-11-13T01:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
let dayIndex = 0;
const nextDay = () => new Date(BASE + ++dayIndex * 3 * DAY_MS);

const userA: AuthUser = { id: 7, email: "a@example.com", displayName: "가", admin: false };

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

/** 홈쇼핑 목록(서버 순서). 방송은 침대(240룹). */
const SHOP_ITEMS = [
  { type: "books", price: 40, salePrice: null, owned: 0 },
  { type: "smallPlant", price: 50, salePrice: null, owned: 0 },
  { type: "lamp", price: 60, salePrice: null, owned: 1 },
  { type: "capOrange", price: 60, salePrice: null, owned: 0 },
  { type: "frame", price: 70, salePrice: null, owned: 0 },
  { type: "plant", price: 80, salePrice: null, owned: 0 },
  { type: "nightstand", price: 100, salePrice: null, owned: 0 },
  { type: "floorLamp", price: 110, salePrice: null, owned: 0 },
  { type: "rug", price: 150, salePrice: null, owned: 1 },
  { type: "wardrobe", price: 180, salePrice: null, owned: 1 },
  { type: "bed", price: 300, salePrice: 240, owned: 0 }
];

function shop(options: { broadcast?: { type: string; price: number; salePrice: number }; extra?: { type: string; price: number; salePrice: number | null; owned: number }[] } = {}): HomeShopping {
  const broadcast = options.broadcast ?? { type: "bed", price: 300, salePrice: 240 };
  const items = [...SHOP_ITEMS, ...(options.extra ?? [])].map((item) =>
    item.type === broadcast.type ? { ...item, salePrice: broadcast.salePrice } : item.type === "bed" ? { ...item, salePrice: null } : item
  );
  return JSON.parse(JSON.stringify({ balance: 500, broadcast, items })) as HomeShopping;
}

/** 지금 이름으로 본 SHOP_ITEMS 순서의 카드 이름(087 표). */
const CURRENT_CARD_NAMES = ["책", "작은 화분", "탁상 스탠드", "주황 야구모자", "액자", "큰 화분", "협탁", "바닥 스탠드", "러그", "옷장", "침대"];
/** qaCatalog로 본 카드 이름. */
const QA_CARD_NAMES = ["책", "작은 화분", "탁상 스탠드", QA_CAP.name, "액자", QA_PLANT_SHOP, "협탁", "바닥 스탠드", "러그", "옷장", QA_BED.shopName];

/** 처음 배치(스탠드 포함) 본문의 가구. */
function defBodyItems(): Record<string, unknown>[] {
  return JSON.parse(JSON.stringify(DEFAULT_LOBBY_LAYOUT.items));
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
  for (let index = 0; index < 16; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

let view: Awaited<ReturnType<typeof render>> | null = null;

async function renderHome() {
  view = await render(<HomeScreen />);
  await flushAsync();
  return view;
}

/** 앱을 끈다: 홈을 내리고 엔진 배치를 처음 배치로 되돌린다. 기기 저장소는 남는다. */
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
}

/** 다른 화면에 갔다가 홈으로 돌아온다(홈이 다시 보인다). */
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

const ALL = { includeHiddenElements: true } as const;
const SHOP_TITLE = "라룹 홈쇼핑";
const CARD_LABEL = /^(.+), (\d+)룹, (\d+% 할인, )?자세히 보기$/;
const DELIVERED = "보관함에 도착했어요";
const ORDER_FAILED = "주문하지 못했어요. 다시 시도해 주세요";

function labelOf(node: UiNode): string | undefined {
  const props = node.props as { accessibilityLabel?: string; "aria-label"?: string };
  return props["aria-label"] ?? props.accessibilityLabel;
}

async function pressNode(node: UiNode) {
  await fireEvent.press(node);
  await flushAsync();
}

async function openShop() {
  const buttons = screen.queryAllByRole("button", { name: "홈쇼핑" });
  expect(buttons.length).toBeGreaterThan(0);
  await pressNode(buttons[0]);
  expect(screen.queryAllByText(SHOP_TITLE, ALL).length).toBeGreaterThan(0);
}

/** 방송 칸(접근성 이름이 "오늘의 방송 상품 …"인 버튼). */
function broadcastButtons(): UiNode[] {
  return screen.queryAllByRole("button", { name: /^오늘의 방송 상품 /, ...ALL });
}

/** 목록 카드(접근성 이름이 카드 모양인 버튼, 방송 칸 뺌)의 이름(화면 순서). */
function cardNames(): string[] {
  const broadcast = new Set(broadcastButtons());
  return screen
    .queryAllByRole("button", { name: CARD_LABEL, ...ALL })
    .filter((button) => !broadcast.has(button))
    .map((button) => CARD_LABEL.exec(labelOf(button) ?? "")![1]);
}

function cardOf(name: string): UiNode {
  const broadcast = new Set(broadcastButtons());
  const cards = screen
    .queryAllByRole("button", { name: CARD_LABEL, ...ALL })
    .filter((button) => !broadcast.has(button) && CARD_LABEL.exec(labelOf(button) ?? "")![1] === name);
  expect(cards).toHaveLength(1);
  return cards[0];
}

async function pressTab(name: string) {
  await pressNode(screen.getByRole("tab", { name, ...ALL }));
}

async function enterEdit() {
  await pressNode(screen.getByText("꾸미기"));
}

/** 꾸미기 보관함 줄의 가구 칸 이름(돌리기·치우기·더하기 버튼은 뺀다). */
function trayCellNames(): string[] {
  const tray = screen.getByLabelText("보관함");
  return within(tray)
    .queryAllByRole("button")
    .map((button) => labelOf(button) ?? "")
    .filter((label) => label !== "돌리기" && label !== "치우기" && !label.endsWith(" 더하기"));
}

/** 3D 그리기가 만드는 가구(엔진의 지금 배치에서 buildPlacements). 입구 발판은 뺀다. 그리지 못하면(모르는 종류로 던지면) 그 오류로 실패한다. */
function drawnItemIds(): string[] {
  const ids = new Set(buildPlacements(activeLobbyLayout()).map((place) => place.item));
  ids.delete("exit");
  return [...ids].sort();
}

/** AsyncStorage의 모든 값(JSON 글). */
async function storedValues(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  const pairs = await AsyncStorage.multiGet(keys);
  return pairs.map(([, value]) => value ?? "");
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
  view = null;
  mockServer.catalog = { status: 500, body: { message: "목록 없음" } };
  mockServer.lobbyLayout = { status: 404, body: { message: "없음" } };
  mockServer.order = { status: 500, body: { message: "주문 없음" } };
  fetchMock.mockReset().mockImplementation(async (url, init) => route(String(url), init));
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(
    () => ({ remove: () => undefined }) as ReturnType<typeof BackHandler.addEventListener>
  );
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(500));
  jest.mocked(getWardrobe).mockReset().mockResolvedValue(null);
  jest.mocked(getHomeShopping).mockReset().mockResolvedValue(shop());
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

afterEach(async () => {
  await closeApp();
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- 목록을 한 번도 받지 못했을 때(이 파일 맨 앞이어야 한다) ----------

describe("[spec] 090-① 모바일: 목록을 한 번도 받은 적 없으면 앱에 든 기본 목록", () => {
  // 04 결정 C4: 받은 응답의 모양이 틀렸으면 못 받은 것으로 본다(저장한 목록이 없으면 앱 기본값)
  test.each<[string, Answer]>([
    ["500 응답", { status: 500, body: { message: "목록 없음" } }],
    ["모양이 틀린 응답(items가 목록이 아님)", { status: 200, body: { version: "broken-v1", items: "broken" } }],
    ["모양이 틀린 응답(version이 없음)", { status: 200, body: { items: currentCatalogItems().map((item) => (item.id === "bed" ? { ...item, shopName: "깨진 침대" } : item)) } }]
  ])("H1 [그대로] 목록 받기가 실패(%s)하고 저장해 둔 목록도 없으면, 홈쇼핑 이름·순서·분류·설명과 보관함 이름이 지금과 같다", async (_label, answer) => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = answer;
    mockServer.lobbyLayout = { status: 200, body: { version: 2, items: defBodyItems(), stored: [{ id: "bed-1", type: "bed" }] } };
    await renderHome();

    await openShop();
    expect(cardNames()).toEqual(CURRENT_CARD_NAMES);
    expect(labelOf(broadcastButtons()[0])).toBe("오늘의 방송 상품 침대, 240룹, 20% 할인, 자세히 보기");
    await pressTab("식물");
    expect(cardNames()).toEqual(["작은 화분", "큰 화분"]);
    await pressTab("장식");
    expect(cardNames()).toEqual(["책", "액자", "러그"]);
    await pressTab("전체");
    await pressNode(cardOf("침대"));
    expect(screen.getAllByText("하루를 마무리하는 포근한 자리예요.", ALL).length).toBeGreaterThan(0);
    await pressNode(screen.getByRole("button", { name: "상품 상세 닫기", ...ALL }));
    await pressNode(screen.getByRole("button", { name: "홈쇼핑 닫기", ...ALL }));

    await enterEdit();
    expect(trayCellNames()).toEqual(["침대"]);
  });
});

// ---------- 목록 받기와 저장 ----------

describe("[spec] 090-① 모바일: 목록 받기와 저장", () => {
  test("H2 [바뀔] 홈이 처음 보이면 GET /api/catalog를 한 번 받고, 같은 날 홈이 다시 보이면 받지 않으며, 하루가 지나 홈이 보이면 다시 한 번 받는다", async () => {
    const start = nextDay();
    jest.useFakeTimers({ now: start });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();

    expect(catalogCalls()).toHaveLength(1);
    expect(methodOf(catalogCalls()[0][1])).toBe("GET");

    jest.setSystemTime(new Date(start.getTime() + 2 * HOUR_MS));
    await leaveAndReturnHome();
    expect(catalogCalls()).toHaveLength(1);

    // 다음 날(서울 날짜도 바뀌고 24시간도 넘었다)
    jest.setSystemTime(new Date(start.getTime() + 25 * HOUR_MS));
    await leaveAndReturnHome();
    expect(catalogCalls()).toHaveLength(2);

    jest.setSystemTime(new Date(start.getTime() + 26 * HOUR_MS));
    await leaveAndReturnHome();
    expect(catalogCalls()).toHaveLength(2);
  });

  test("H3 [바뀔] 받은 목록을 기기에 저장하고, 다음에 앱을 켰을 때 목록 받기가 실패하면 저장해 둔 목록의 이름을 보인다", async () => {
    const start = nextDay();
    jest.useFakeTimers({ now: start });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();
    expect(catalogCalls()).toHaveLength(1);
    expect((await storedValues()).some((value) => value.includes(QA_VERSION) && value.includes(QA_BED.shopName))).toBe(true);
    await closeApp();

    jest.setSystemTime(new Date(start.getTime() + 25 * HOUR_MS));
    mockServer.catalog = { status: 500, body: { message: "목록 없음" } };
    await renderHome();
    expect(catalogCalls().length).toBeGreaterThanOrEqual(2);

    await openShop();
    expect(cardNames()).toEqual(QA_CARD_NAMES);
  });

  test("H2b [바뀔] (04 결정 C2) 하루는 서울 날짜다: 서울 23시에 받은 뒤 2시간 지나 서울 날짜가 바뀌면 홈이 보일 때 다시 받고, 같은 날 21시까지는 받지 않는다", async () => {
    // 서울 23시 = 기준(서울 10시)에서 13시간 뒤
    const start = new Date(nextDay().getTime() + 13 * HOUR_MS);
    jest.useFakeTimers({ now: start });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();
    expect(catalogCalls()).toHaveLength(1);

    // 다음 날 서울 1시(24시간은 지나지 않았다)
    jest.setSystemTime(new Date(start.getTime() + 2 * HOUR_MS));
    await leaveAndReturnHome();
    expect(catalogCalls()).toHaveLength(2);

    // 같은 날 서울 21시
    jest.setSystemTime(new Date(start.getTime() + 22 * HOUR_MS));
    await leaveAndReturnHome();
    expect(catalogCalls()).toHaveLength(2);
  });

  test("H14 [바뀔] (04 결정 C4) 저장해 둔 목록이 있을 때 받은 응답의 모양이 틀리면 못 받은 것으로 보고 저장해 둔 목록을 쓴다(저장한 목록도 바꾸지 않는다)", async () => {
    const start = nextDay();
    jest.useFakeTimers({ now: start });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();
    await closeApp();

    jest.setSystemTime(new Date(start.getTime() + 25 * HOUR_MS));
    mockServer.catalog = { status: 200, body: { version: "broken-v2", items: "broken" } };
    await renderHome();
    expect(catalogCalls()).toHaveLength(2);

    await openShop();
    expect(cardNames()).toEqual(QA_CARD_NAMES);
    const values = await storedValues();
    expect(values.some((value) => value.includes(QA_VERSION))).toBe(true);
    expect(values.some((value) => value.includes("broken-v2"))).toBe(false);
  });

  test("H15 [바뀔] (04 결정 C7) 다음에 받은 목록의 version이 저장한 것과 같으면 목록을 바꾸지 않는다(같은 version에 다른 이름이 와도 저장한 이름 그대로)", async () => {
    const start = nextDay();
    jest.useFakeTimers({ now: start });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();
    await closeApp();

    jest.setSystemTime(new Date(start.getTime() + 25 * HOUR_MS));
    const same = qaCatalog();
    same.items = same.items.map((item) => (item.id === "bed" ? { ...item, shopName: "같은 판 다른 침대" } : item));
    mockServer.catalog = { status: 200, body: same };
    await renderHome();
    expect(catalogCalls()).toHaveLength(2);

    await openShop();
    expect(cardNames()).toEqual(QA_CARD_NAMES);
    expect(screen.queryAllByText("같은 판 다른 침대", ALL)).toHaveLength(0);
  });

  test("H16 [그대로] (04 결정 C3) 로그인하지 않았으면 받은 목록을 기기에 저장하지 않는다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    setSessionUser(null);
    refreshSession.mockReset().mockResolvedValue(null);
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();

    expect((await storedValues()).some((value) => value.includes(QA_VERSION))).toBe(false);
  });
});

// ---------- 이름·설명·분류를 목록에서 ----------

describe("[spec] 090-① 모바일: 이름·설명·분류를 받은 목록에서", () => {
  test("H4 [바뀔] 홈쇼핑 카드·방송 칸의 이름은 목록의 shopName이다(침대 → 'QA 왕 침대', 큰 화분 → 'QA 큰 화분', 주황 모자 → 'QA 주황 모자'). 순서·가격은 서버 그대로다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();

    await openShop();
    expect(cardNames()).toEqual(QA_CARD_NAMES);
    expect(labelOf(broadcastButtons()[0])).toBe(`오늘의 방송 상품 ${QA_BED.shopName}, 240룹, 20% 할인, 자세히 보기`);
    expect(labelOf(cardOf(QA_BED.shopName))).toBe(`${QA_BED.shopName}, 240룹, 20% 할인, 자세히 보기`);
  });

  test("H5 [바뀔] 분류 탭은 목록의 category를 따른다: 큰 화분이 decor로 오면 '장식'에 보이고 '식물'에는 작은 화분만 보인다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();

    await openShop();
    await pressTab("장식");
    expect(cardNames()).toEqual(["책", "액자", QA_PLANT_SHOP, "러그"]);
    await pressTab("식물");
    expect(cardNames()).toEqual(["작은 화분"]);
    await pressTab("옷");
    expect(cardNames()).toEqual([QA_CAP.name]);
  });

  test("H6 [바뀔] 상품 상세의 설명은 목록의 description이다(침대 'QA 침대 설명이에요.', 주황 모자 'QA 모자 설명이에요.')", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    await renderHome();

    await openShop();
    await pressNode(cardOf(QA_BED.shopName));
    expect(screen.getAllByText(QA_BED.description, ALL).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("하루를 마무리하는 포근한 자리예요.", ALL)).toHaveLength(0);
    await pressNode(screen.getByRole("button", { name: "상품 상세 닫기", ...ALL }));

    await pressNode(cardOf(QA_CAP.name));
    expect(screen.getAllByText(QA_CAP.description, ALL).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("발바닥 무늬가 들어간 산뜻한 주황 모자예요.", ALL)).toHaveLength(0);
  });

  test("H7 [바뀔] 꾸미기 보관함의 가구 이름은 목록의 name이다(보관함의 침대 → 'QA 침대', 홈쇼핑 이름 'QA 왕 침대'가 아니다)", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    mockServer.lobbyLayout = { status: 200, body: { version: 2, items: defBodyItems(), stored: [{ id: "bed-1", type: "bed" }] } };
    await renderHome();

    await enterEdit();
    expect(trayCellNames()).toEqual([QA_BED.name]);
  });

  test("H17 [바뀔] (04 결정 C1) 앱이 그릴 줄 아는데 받은 목록에 없는 아이템(액자·주황 모자)은 앱에 든 기본값(지금 이름·설명·분류)으로 보이고, 목록에 있는 침대는 목록 이름이다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const partial = qaCatalog();
    partial.items = partial.items.filter((item) => item.id !== "frame" && item.id !== "capOrange");
    mockServer.catalog = { status: 200, body: partial };
    mockServer.lobbyLayout = { status: 200, body: { version: 2, items: defBodyItems(), stored: [{ id: "bed-1", type: "bed" }, { id: "frame-1", type: "frame" }] } };
    await renderHome();

    await openShop();
    expect(cardNames()).toEqual(["책", "작은 화분", "탁상 스탠드", "주황 야구모자", "액자", QA_PLANT_SHOP, "협탁", "바닥 스탠드", "러그", "옷장", QA_BED.shopName]);
    await pressTab("장식");
    expect(cardNames()).toEqual(["책", "액자", QA_PLANT_SHOP, "러그"]);
    await pressTab("옷");
    expect(cardNames()).toEqual(["주황 야구모자"]);
    await pressNode(cardOf("주황 야구모자"));
    expect(screen.getAllByText("발바닥 무늬가 들어간 산뜻한 주황 모자예요.", ALL).length).toBeGreaterThan(0);
    await pressNode(screen.getByRole("button", { name: "상품 상세 닫기", ...ALL }));
    await pressTab("장식");
    await pressNode(cardOf("액자"));
    expect(screen.getAllByText("허전한 벽을 채우는 작은 그림이에요.", ALL).length).toBeGreaterThan(0);
    await pressNode(screen.getByRole("button", { name: "상품 상세 닫기", ...ALL }));
    await pressNode(screen.getByRole("button", { name: "홈쇼핑 닫기", ...ALL }));

    await enterEdit();
    expect(trayCellNames()).toEqual([QA_BED.name, "액자"]);
  });
});

// ---------- 홈쇼핑: 그릴 줄 모르는 상품 ----------

describe("[spec] 090-① 모바일: 홈쇼핑에서 그릴 줄 모르는 상품은 보이지 않는다", () => {
  test("H8 [바뀔] 서버 목록에 앱이 그릴 줄 모르는 가구(sofa)·옷(glassesRound)이 있으면, 목록에 있어도 그 카드는 보이지 않고 나머지는 서버 순서 그대로다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    // 이름이 아니라 모르는 상품 처리를 본다: 지금 이름 그대로인 목록에 모르는 가구·옷만 더해 받는다
    mockServer.catalog = { status: 200, body: currentWithUnknownCatalog() };
    jest.mocked(getHomeShopping).mockResolvedValue(
      shop({
        extra: [
          { type: "glassesRound", price: 90, salePrice: null, owned: 0 },
          { type: "sofa", price: 200, salePrice: null, owned: 0 }
        ]
      })
    );
    await renderHome();

    await openShop();
    expect(cardNames()).toEqual(CURRENT_CARD_NAMES);
    for (const name of ["QA 소파", "소파", "sofa", "QA 둥근 안경", "glassesRound"]) {
      expect({ name, shown: screen.queryAllByText(name, ALL).length }).toEqual({ name, shown: 0 });
    }
    await pressTab("가구");
    expect(cardNames()).toEqual(["협탁", "옷장", "침대"]);
    await pressTab("옷");
    expect(cardNames()).toEqual(["주황 야구모자"]);
  });

  test.each([
    ["가구 sofa", { type: "sofa", price: 200, salePrice: 160 }],
    ["옷 glassesRound", { type: "glassesRound", price: 90, salePrice: 72 }]
  ])("H9 [바뀔] 오늘의 방송 상품이 그릴 줄 모르는 %s이면 방송 칸이 보이지 않고, 목록 카드는 아는 상품만 보인다", async (_label, broadcast) => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: currentWithUnknownCatalog() };
    jest.mocked(getHomeShopping).mockResolvedValue(shop({ broadcast, extra: [{ type: broadcast.type, price: broadcast.price, salePrice: null, owned: 0 }] }));
    await renderHome();

    await openShop();
    expect(broadcastButtons()).toHaveLength(0);
    expect(screen.queryAllByText("ON AIR", ALL)).toHaveLength(0);
    expect(cardNames()).toEqual(CURRENT_CARD_NAMES);
  });
});

// ---------- 방 배치: 그릴 줄 모르는 가구 ----------

/**
 * 서버 배치: 처음 배치에 모르는 바닥 가구 sofa1·벽 가구 neon1, 모르는 sofa1 위에 올린 아는 소품 lamp2(04 결정 C6: 받침과 함께 지킨다),
 * 보관함에 아는 옷장 w2와 모르는 s1(sofa).
 */
const SOFA = { id: "sofa1", type: "sofa", floor: { x: 4.5, z: 9.5, facing: 0 } };
const NEON = { id: "neon1", type: "neonSign", wall: { wall: "back", along: 6.5 } };
const LAMP_ON_SOFA = { id: "lamp2", type: "lamp", on: { parent: "sofa1", slot: 0, facing: 0 } };
const STORED_SOFA = { id: "s1", type: "sofa" };
const STORED_WARDROBE = { id: "w2", type: "wardrobe" };

function unknownLayoutBody() {
  return { version: 2, items: [...defBodyItems(), SOFA, NEON, LAMP_ON_SOFA], stored: [STORED_WARDROBE, STORED_SOFA] };
}

/** 꾸미기 보관함 줄 머리의 "보관함"·"보관함 N" 글(버튼 안의 글은 뺀다). */
function storageHeaderText(): string {
  const insideButton = (node: UiNode) => {
    for (let n: UiNode | null = node; n; n = n.parent) if ((n.props as { accessibilityRole?: unknown }).accessibilityRole === "button") return true;
    return false;
  };
  const found = screen.queryAllByText(/^보관함(\s*\d+)?$/).filter((node) => !insideButton(node));
  expect(found).toHaveLength(1);
  return ([] as unknown[]).concat((found[0].props as { children?: unknown }).children).join("");
}

describe("[spec] 090-① 모바일: 방 배치의 그릴 줄 모르는 가구", () => {
  test("H10 [바뀔] 서버 배치에 모르는 가구가 있어도 배치를 버리지 않는다: 아는 가구(보관함의 w2 포함)는 그대로 그리고, 모르는 가구와 그 위의 소품(lamp2)은 그리지 않는다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    mockServer.lobbyLayout = { status: 200, body: unknownLayoutBody() };
    await renderHome();

    expect(mockCanvas.props).not.toBeNull();
    expect(drawnItemIds()).toEqual(["board", "bookcase", "desk", "lamp", "rug", "w2", "wardrobe", "window"]);
  });

  test("H11 [바뀔] 꾸미기 보관함에는 아는 가구(옷장 w2)만 보이고 모르는 가구(s1 sofa)는 보이지 않으며, 줄 머리 개수도 보이는 것만 센다(04 결정 C5: '보관함 1')", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    mockServer.lobbyLayout = { status: 200, body: unknownLayoutBody() };
    await renderHome();

    await enterEdit();
    expect(trayCellNames()).toEqual(["옷장"]);
    expect(storageHeaderText()).toBe("보관함 1");
  });

  test("H12 [바뀔] 꾸미기에서 옷장 w2를 꺼내고 '완료'하면, 저장 본문에 모르는 가구(sofa1·neon1, 그 위의 lamp2, 보관함 s1)가 받은 그대로 들어 있고 저장이 끝난다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    mockServer.lobbyLayout = { status: 200, body: unknownLayoutBody() };
    await renderHome();

    await enterEdit();
    await pressNode(within(screen.getByLabelText("보관함")).getByRole("button", { name: "옷장" }));
    await pressNode(screen.getByRole("button", { name: "완료" }));

    const puts = lobbyLayoutPuts();
    expect(puts).toHaveLength(1);
    expect(puts[0].items).toContainEqual(SOFA);
    expect(puts[0].items).toContainEqual(NEON);
    expect(puts[0].items).toContainEqual(LAMP_ON_SOFA);
    expect(puts[0].items.filter((item) => item.id === "w2")).toHaveLength(1);
    expect(puts[0].stored ?? []).toEqual([STORED_SOFA]);
    // 저장이 성공하면 꾸미기가 끝난다(저장 응답에 모르는 가구가 있어도 실패로 보지 않는다)
    expect(screen.queryByRole("button", { name: "완료" })).toBeNull();
    expect(screen.getByText("꾸미기")).toBeTruthy();
    expect(drawnItemIds()).toEqual(["board", "bookcase", "desk", "lamp", "rug", "w2", "wardrobe", "window"]);
  });

  test("H13 [바뀔] 홈쇼핑에서 침대를 주문했는데 결과 배치에 모르는 가구(sofa1)가 있어도 주문을 실패로 보지 않는다: 완료 판이 뜨고 실패 알림이 없으며, 산 침대는 보관함 가구로 그려 둔다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    // 이 테스트는 이름이 아니라 주문 결과를 본다: 지금 이름과 같은 목록을 받게 해 침대 카드 이름이 늘 "침대"다
    mockServer.catalog = { status: 200, body: { version: "qa-current-v1", items: currentCatalogItems() } };
    jest.mocked(getHomeShopping).mockResolvedValue(shop({ broadcast: { type: "books", price: 40, salePrice: 32 } }));
    mockServer.order = {
      status: 200,
      body: {
        type: "bed",
        price: 300,
        balance: 200,
        owned: 1,
        itemId: "bed-1",
        layout: { version: 2, items: [...defBodyItems(), SOFA], stored: [{ id: "bed-1", type: "bed" }] },
        wardrobe: null
      }
    };
    await renderHome();

    await openShop();
    await pressNode(cardOf("침대"));
    await pressNode(screen.getByRole("button", { name: "300룹에 주문하기", ...ALL }));

    const orders = fetchMock.mock.calls.filter(([url, init]) => pathOf(String(url)) === "/api/home-shopping/orders" && methodOf(init) === "POST");
    expect(orders.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([{ type: "bed", price: 300 }]);
    expect(screen.getAllByText(DELIVERED, ALL).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(ORDER_FAILED, ALL)).toHaveLength(0);
    expect(drawnItemIds()).toEqual(["bed-1", "board", "bookcase", "desk", "lamp", "rug", "wardrobe", "window"]);
  });

  // 04 결정 C6: '처음 배치로'에서 모르는 가구는 지킨다(보관함 쪽에 그대로 두어 저장 때 함께 보낸다).
  // 본문의 어느 목록(items·stored)에 들어가는지는 결정이 "보관함 쪽"이라고만 적어, id·종류가 그대로 한 번씩 들어 있는지만 본다.
  test("H18 [바뀔] 책장을 옮겨 둔 배치에서 '처음 배치로' 뒤 '완료'하면, 저장 본문에 모르는 가구 sofa1·neon1·s1이 종류 그대로 한 번씩 들어 있다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 200, body: qaCatalog() };
    const moved = defBodyItems().map((item) => (item.id === "bookcase" ? { ...item, floor: { x: 0.5, z: 4.5, facing: 1 } } : item));
    mockServer.lobbyLayout = { status: 200, body: { version: 2, items: [...moved, SOFA, NEON], stored: [STORED_WARDROBE, STORED_SOFA] } };
    await renderHome();

    await enterEdit();
    await pressNode(screen.getByRole("button", { name: "처음 배치로" }));
    await pressNode(screen.getByRole("button", { name: "완료" }));

    const puts = lobbyLayoutPuts();
    expect(puts).toHaveLength(1);
    const sent = [...puts[0].items, ...(puts[0].stored ?? [])].map((entry) => ({ id: entry.id, type: entry.type }));
    for (const unknown of [
      { id: "sofa1", type: "sofa" },
      { id: "neon1", type: "neonSign" },
      { id: "s1", type: "sofa" }
    ]) {
      expect({ unknown, count: sent.filter((entry) => entry.id === unknown.id && entry.type === unknown.type).length }).toEqual({ unknown, count: 1 });
    }
  });
});
