// [spec] qa 테스트(작업 090-② 가구 내려받기, 새 기능, 모바일): 홈 화면 단위로 홈쇼핑·꾸미기 보관함의 가구 아이콘 받기(첫 글자 칸 → 받은 그림),
// 서버에서 더한 가구가 홈쇼핑·보관함에 나오고 사서 '바로 놓기'까지 되는지, 홈이 다시 보이면 받지 못한 파일을 다시 받는지를 본다(손님 G1~G3은 손님 홈에 홈쇼핑 버튼이 없어 furniture-download.spec에서 모듈 단위로 본다).
// 기대값은 시나리오(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/04-가구-내려받기/04-qa-scenarios.md의 B2·B4·E·H1·H2·H6·I3·C5·C8)와
// 같은 폴더 05-main-decision.md에서만 가져온다. 테스트 이름 앞의 번호가 시나리오 번호다.
// 05 결정 1(열넷 모두 앱 기본값)로 B4는 "목록이 없으면 침대가 홈쇼핑에 보이고 그림은 첫 글자 칸"이다.
// 홈 테스트 틀은 090-① 테스트(item-catalog-home.spec.test.tsx)와 같다: api는 진짜 모듈을 펼쳐 목록 받기·배치·주문은 전역 fetch(가짜 서버)를 부르고,
// 3D 그리기는 가짜다. 기기 파일과 파일 받기는 가짜 expo-file-system이다(받기의 답은 테스트가 정하고, 부른 주소를 적는다).
// 받은 파일 표는 모듈 상태라 한 파일 안의 테스트 사이에 이어지므로, 테스트마다 다른 해시를 쓴다(fresh).
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
import { applyLobbyLayout } from "@/lib/lobby3d/engine";
import { DEFAULT_LOBBY_LAYOUT } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, HomeShopping, LoopPointsSummary, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";

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

// ---------- 기기 파일(가짜 expo-file-system) ----------

type Reply = { bytes: number } | "fail" | "hold";
const mockDevice = {
  files: new Map<string, number>(),
  dirs: new Set<string>(),
  downloads: [] as string[],
  writes: [] as string[],
  replies: new Map<string, Reply>(),
  held: new Map<string, { resolve: (bytes: number) => void; reject: (error: unknown) => void }>()
};

function mockReply(url: string): Promise<number> {
  const path = url.slice(url.indexOf("/api/"));
  const reply = mockDevice.replies.get(path);
  if (reply === "hold") return new Promise((resolve, reject) => mockDevice.held.set(path, { resolve, reject }));
  if (!reply || reply === "fail") return Promise.reject(new Error(`받지 못함(테스트 가짜): ${path}`));
  return Promise.resolve(reply.bytes);
}

jest.mock("expo-file-system", () => {
  const join2 = (parent: unknown, name: string) => {
    const base = typeof parent === "string" ? parent : (parent as { uri: string }).uri;
    return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`;
  };
  class File {
    uri: string;
    constructor(parent: unknown, name?: string) {
      this.uri = name === undefined ? (typeof parent === "string" ? parent : (parent as { uri: string }).uri) : join2(parent, name);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    get exists() {
      return mockDevice.files.has(this.uri);
    }
    get size() {
      return mockDevice.files.get(this.uri) ?? 0;
    }
    delete() {
      mockDevice.files.delete(this.uri);
    }
    static async downloadFileAsync(url: string, destination: { uri: string }) {
      mockDevice.downloads.push(url);
      const bytes = await mockReply(url);
      const file = new File(destination.uri);
      mockDevice.files.set(file.uri, bytes);
      mockDevice.writes.push(file.uri);
      return file;
    }
  }
  class Directory {
    uri: string;
    constructor(parent: unknown, name: string) {
      this.uri = `${join2(parent, name)}/`;
    }
    get exists() {
      return mockDevice.dirs.has(this.uri) || [...mockDevice.files.keys()].some((key) => key.startsWith(this.uri));
    }
    create() {
      mockDevice.dirs.add(this.uri);
    }
    list() {
      return [...mockDevice.files.keys()].filter((key) => key.startsWith(this.uri)).map((key) => new File(key));
    }
  }
  return { File, Directory, Paths: { document: { uri: "file:///qa-document/" }, cache: { uri: "file:///qa-cache/" } } };
});

// ---------- 목록 CAT1(04-qa-scenarios "공통 준비") ----------

const MOBILE = join(__dirname, "..", "..");
const SEVEN = ["desk", "bookcase", "board", "window", "wardrobe", "rug", "lamp"];
const SEVEN_ICONS = ["wardrobe", "rug", "lamp"];
const sha = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
function fileRef(file: string) {
  const data = readFileSync(file);
  return { sha256: sha(data), bytes: data.length };
}
const APP = (id: string) => fileRef(join(MOBILE, "assets", "models", "furniture", `${id}.glb`));
const APPI = (id: string) => fileRef(join(MOBILE, "assets", "icons", "furniture", `${id}.png`));
const BYTES: Record<string, number> = {};
let freshBytes = 6000;
/** 이 테스트에서만 쓰는 새 해시. */
function fresh(name: string): string {
  const hash = sha(`qa-090-home-${name}`);
  freshBytes += 1;
  BYTES[hash] = freshBytes;
  return hash;
}
const ref = (hash: string, ext: "glb" | "png") => ({ url: `/api/catalog/files/${hash}.${ext}`, sha256: hash, bytes: BYTES[hash] });
const filePath = (hash: string, ext: "glb" | "png") => `/api/catalog/files/${hash}.${ext}`;
function serve(...hashes: [string, "glb" | "png"][]) {
  for (const [hash, ext] of hashes) mockDevice.replies.set(filePath(hash, ext), { bytes: BYTES[hash] });
}
const downloadedPaths = () => mockDevice.downloads.map((url) => url.slice(url.indexOf("/api/")));

/** 앱에 든 그 가구의 지금 값에서 id·name을 뺀 그리기 정보. */
function appDraw(id: string): Record<string, unknown> {
  const { id: _id, name: _name, ...draw } = JSON.parse(JSON.stringify(FURNITURE_TYPES.find((type) => type.id === id))) as Record<string, unknown>;
  return draw;
}

type ServerItem = Record<string, unknown> & { id: string };
type Hashes = { bedModel: string; bedIcon: string; sofaModel: string; sofaIcon: string; clockModel: string; clockIcon: string | null };
function hashes(tag: string): Hashes {
  return {
    bedModel: fresh(`${tag}-bed-model`),
    bedIcon: fresh(`${tag}-bed-icon`),
    sofaModel: fresh(`${tag}-sofa-model`),
    sofaIcon: fresh(`${tag}-sofa-icon`),
    clockModel: fresh(`${tag}-clock-model`),
    clockIcon: fresh(`${tag}-clock-icon`)
  };
}
const shopItem = (id: string, name: string, shopName: string, description: string, category: string | null, price: number | null, draw: Record<string, unknown>, assets: unknown): ServerItem => ({
  id,
  kind: "furniture",
  name,
  shopName,
  description,
  category,
  slot: null,
  price,
  draw,
  assets
});

/** CAT1: 앱에 든 일곱(해시가 앱 파일과 같음), 침대(앱에 없는 파일), QA 소파(서버에서 더한 바닥 가구), QA 시계(벽, 아이콘은 h.clockIcon). 옷은 assets null. */
function cat1(h: Hashes) {
  const names: Record<string, [string, string, string, string | null]> = {
    desk: ["일기 책상", "일기 책상", "", null],
    bookcase: ["책장", "책장", "", null],
    board: ["오늘의 질문 게시판", "오늘의 질문 게시판", "", null],
    window: ["창문", "창문", "", null],
    wardrobe: ["옷장", "옷장", "방 한쪽을 차분하게 채우는 기본 옷장이에요.", "furniture"],
    rug: ["깔개", "러그", "가구 아래에 깔아 공간을 아늑하게 묶어 줘요.", "decor"],
    lamp: ["스탠드", "탁상 스탠드", "책상이나 협탁 위를 따뜻하게 밝혀 줘요.", "lighting"]
  };
  const items: ServerItem[] = [
    ...SEVEN.map((id) =>
      shopItem(id, names[id][0], names[id][1], names[id][2], names[id][3], null, appDraw(id), {
        model: { url: `/api/catalog/files/${APP(id).sha256}.glb`, ...APP(id) },
        icon: SEVEN_ICONS.includes(id) ? { url: `/api/catalog/files/${APPI(id).sha256}.png`, ...APPI(id) } : null
      })
    ),
    shopItem("bed", "침대", "침대", "하루를 마무리하는 포근한 자리예요.", "furniture", 300, appDraw("bed"), { model: ref(h.bedModel, "glb"), icon: ref(h.bedIcon, "png") }),
    shopItem(
      "qaSofa",
      "QA 소파",
      "QA 소파",
      "QA 소파 설명이에요.",
      "furniture",
      120,
      {
        mount: "floor",
        size: { width: 2, depth: 1 },
        height: { bottom: 0, top: 0.9 },
        blocksWalk: true,
        removable: true,
        model: { piece: "qaSofa", box: { width: 1.9, height: 0.9, depth: 0.95 }, y: 0, shadow: { floor: [2.2, 1.2, 0.5] } }
      },
      { model: ref(h.sofaModel, "glb"), icon: ref(h.sofaIcon, "png") }
    ),
    shopItem(
      "qaClock",
      "QA 시계",
      "QA 시계",
      "",
      null,
      null,
      {
        mount: "wall",
        size: { width: 1, depth: 0 },
        height: { bottom: 1.5, top: 2.1 },
        blocksWalk: false,
        removable: true,
        model: { piece: "qaClock", box: { width: 0.6, height: 0.6, depth: 0.08 }, y: 1.8, wallDepth: 0.04 }
      },
      { model: ref(h.clockModel, "glb"), icon: h.clockIcon ? ref(h.clockIcon, "png") : null }
    ),
    { id: "capOrange", kind: "wearable", name: "주황 야구모자", shopName: "주황 야구모자", description: "발바닥 무늬가 들어간 산뜻한 주황 모자예요.", category: "clothes", slot: "hat", price: 60, assets: null }
  ];
  return { version: `qa-v1-${h.bedIcon.slice(0, 8)}`, items };
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

// ---------- 고정 데이터 ----------

/** 기준 시각: 서울 10시. 테스트마다 nextDay()로 앞 테스트보다 늦은 다른 날에 둔다(시계가 뒤로 가지 않게 파일 순서대로 늘어난다). */
const BASE = Date.parse("2026-11-13T01:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
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
// 090-③ 옷 내려받기(05-main-decision 2, 사용자 결정 "qa가 새 동작에 맞게 고침"): 옷은 받은 목록에 그리기 정보와 모델 파일이 있어야 홈쇼핑에 보인다.
// 이 파일의 목록(CAT1)은 옷 assets가 null이고 draw가 없으며, 목록이 없을 때(B4)도 옷은 그릴 줄 모르는 옷이라 주황 야구모자 카드가 빠진다(나머지 단언은 그대로).
const CURRENT_CARD_NAMES = ["책", "작은 화분", "탁상 스탠드", "액자", "큰 화분", "협탁", "바닥 스탠드", "러그", "옷장", "침대"];

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


// ---------- 090-② 도우미 ----------

/** 그 안의 그림 요소(source가 있는 요소)의 source들. */
function imageSources(node: UiNode): unknown[] {
  return (node as unknown as { queryAll: (p: (n: UiNode) => boolean) => UiNode[] }).queryAll((n) => n.props?.source != null).map((n) => (n.props as { source: unknown }).source);
}

/** 보관함 줄에서 그 이름의 가구 칸. */
function trayCell(name: string): UiNode {
  const tray = screen.getByLabelText("보관함");
  const cells = within(tray)
    .queryAllByRole("button")
    .filter((button) => labelOf(button) === name);
  expect(cells).toHaveLength(1);
  return cells[0];
}

/** 받기를 기다리던 그 파일을 받은 것으로 끝낸다. */
async function finishDownload(hash: string, ext: "glb" | "png") {
  const held = mockDevice.held.get(filePath(hash, ext));
  expect(held).toBeDefined();
  await act(async () => {
    held!.resolve(BYTES[hash]);
  });
  await flushAsync();
}

const writtenUri = (hash: string, ext: "glb" | "png") => mockDevice.writes.find((uri) => uri.endsWith(`/${hash}.${ext}`));

beforeEach(() => {
  mockDevice.files.clear();
  mockDevice.dirs.clear();
  mockDevice.downloads.length = 0;
  mockDevice.writes.length = 0;
  mockDevice.replies.clear();
  mockDevice.held.clear();
});

describe("[spec] 090-② 홈쇼핑: 아이콘 받기와 서버에서 더한 가구", () => {
  test("B4 (05 결정 1) 목록이 없으면(저장도 없음, 받기 실패) 침대 카드는 홈쇼핑에 보이고 그림 없이 첫 글자 칸이며 옷장 카드는 앱 그림이다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    mockServer.catalog = { status: 500, body: { message: "목록 없음" } };
    await renderHome();
    await openShop();

    expect(cardNames()).toEqual(CURRENT_CARD_NAMES);
    const bed = cardOf("침대");
    expect(imageSources(bed)).toEqual([]);
    expect(within(bed).queryAllByText("침", ALL).length).toBeGreaterThan(0);
    expect(imageSources(cardOf("옷장"))).toHaveLength(1);
    expect(mockDevice.downloads).toEqual([]);
  });

  test("E1·C5·I3 홈쇼핑을 열면 침대 아이콘 <BI>.png를 한 번 요청하고 받기 전에는 첫 글자 칸, 받으면 기기 파일 그림이다. 모델은 요청하지 않고 카드 순서·가격은 응답 그대로다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = hashes("e1");
    mockServer.catalog = { status: 200, body: cat1(h) };
    mockDevice.replies.set(filePath(h.bedIcon, "png"), "hold");
    await renderHome();
    expect(downloadedPaths()).toEqual([]);
    await openShop();

    expect(cardNames()).toEqual(CURRENT_CARD_NAMES);
    expect(labelOf(cardOf("침대"))).toBe("침대, 240룹, 20% 할인, 자세히 보기");
    expect(labelOf(broadcastButtons()[0])).toBe("오늘의 방송 상품 침대, 240룹, 20% 할인, 자세히 보기");
    const bed = cardOf("침대");
    expect(imageSources(bed)).toEqual([]);
    expect(within(bed).queryAllByText("침", ALL).length).toBeGreaterThan(0);
    expect(downloadedPaths().filter((p) => p === filePath(h.bedIcon, "png"))).toHaveLength(1);
    expect(downloadedPaths().filter((p) => p.endsWith(".glb"))).toEqual([]);

    await finishDownload(h.bedIcon, "png");
    expect(imageSources(cardOf("침대"))).toEqual([{ uri: writtenUri(h.bedIcon, "png") }]);
    expect(downloadedPaths().filter((p) => p === filePath(h.bedIcon, "png"))).toHaveLength(1);
    expect(downloadedPaths().filter((p) => p.endsWith(".glb"))).toEqual([]);
  });

  test("E2 아이콘 받기에 실패하면 침대 카드·상세는 그림 없이 첫 글자 칸이고 옷장 카드는 앱 그림 그대로다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = hashes("e2");
    mockServer.catalog = { status: 200, body: cat1(h) };
    mockDevice.replies.set(filePath(h.bedIcon, "png"), "fail");
    await renderHome();
    await openShop();
    await flushAsync();

    expect(imageSources(cardOf("침대"))).toEqual([]);
    expect(imageSources(cardOf("옷장"))).toHaveLength(1);
  });

  test("C8 (홈) 아이콘 받기에 실패한 뒤 홈을 떠났다가 다시 보이면, 홈쇼핑을 다시 열 때 그 아이콘을 한 번 더 요청해 받으면 그림이다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = hashes("c8");
    mockServer.catalog = { status: 200, body: cat1(h) };
    mockDevice.replies.set(filePath(h.bedIcon, "png"), "fail");
    await renderHome();
    await openShop();
    await flushAsync();
    await pressNode(screen.getByRole("button", { name: "홈쇼핑 닫기", ...ALL }));
    expect(downloadedPaths().filter((p) => p === filePath(h.bedIcon, "png"))).toHaveLength(1);

    serve([h.bedIcon, "png"]);
    await leaveAndReturnHome();
    await openShop();
    await flushAsync();
    expect(downloadedPaths().filter((p) => p === filePath(h.bedIcon, "png"))).toHaveLength(2);
    expect(imageSources(cardOf("침대"))).toEqual([{ uri: writtenUri(h.bedIcon, "png") }]);
  });

  test("H1·B2 서버가 더한 QA 소파(120룹)는 '전체'와 '가구'에 카드가 보이고 상세는 바닥에 놓기 · 2 × 1칸 · '120룹에 주문하기'이며, 침대 상세는 2 × 3칸이다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = hashes("h1");
    mockServer.catalog = { status: 200, body: cat1(h) };
    jest.mocked(getHomeShopping).mockResolvedValue(shop({ extra: [{ type: "qaSofa", price: 120, salePrice: null, owned: 0 }] }));
    serve([h.bedIcon, "png"], [h.sofaIcon, "png"]);
    await renderHome();
    await openShop();

    expect(cardNames()).toEqual([...CURRENT_CARD_NAMES, "QA 소파"]);
    await pressTab("가구");
    expect(cardNames()).toContain("QA 소파");
    await pressTab("전체");
    await pressNode(cardOf("QA 소파"));
    expect(screen.queryAllByText("바닥에 놓기", ALL).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("2 × 1칸", ALL).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "120룹에 주문하기", ...ALL })).toBeTruthy();
    await pressNode(screen.getByRole("button", { name: "상품 상세 닫기", ...ALL }));
    await pressNode(cardOf("침대"));
    expect(screen.queryAllByText("2 × 3칸", ALL).length).toBeGreaterThan(0);
  });

  test("H6 QA 소파를 주문하면 완료 판에 '보관함에 도착했어요'·'QA 소파 1개 · 남은 룹 380'이 보이고, '바로 놓기'로 꾸미기가 QA 소파를 꺼낸 채 열린다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = hashes("h6");
    mockServer.catalog = { status: 200, body: cat1(h) };
    jest.mocked(getHomeShopping).mockResolvedValue(shop({ extra: [{ type: "qaSofa", price: 120, salePrice: null, owned: 0 }] }));
    mockServer.order = {
      status: 200,
      body: {
        type: "qaSofa",
        price: 120,
        balance: 380,
        owned: 1,
        itemId: "qaSofa-1",
        layout: { version: 2, items: defBodyItems(), stored: [{ id: "qaSofa-1", type: "qaSofa" }] },
        wardrobe: null
      }
    };
    serve([h.bedIcon, "png"], [h.sofaIcon, "png"]);
    await renderHome();
    await openShop();
    await pressNode(cardOf("QA 소파"));
    await pressNode(screen.getByRole("button", { name: "120룹에 주문하기", ...ALL }));

    expect(screen.getAllByText(DELIVERED, ALL).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/QA 소파 1개 · 남은 룹 380/, ALL).length).toBeGreaterThan(0);
    await pressNode(screen.getByRole("button", { name: "바로 놓기", ...ALL }));
    await flushAsync();
    expect(mockCanvas.props?.edit?.lifted).toBe("qaSofa-1");
    expect(mockCanvas.props?.edit?.layout.items.some((item) => item.id === "qaSofa-1")).toBe(true);
  });
});

describe("[spec] 090-② 꾸미기 보관함: 아이콘 받기와 서버에서 더한 가구", () => {
  test("E3·H2 보관함에 산 침대와 서버가 더한 QA 소파가 있으면 칸이 둘이고 '보관함 2'이며, 두 아이콘을 요청하고 받기 전 침대 칸은 첫 글자, 받으면 그 그림이다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = hashes("e3");
    mockServer.catalog = { status: 200, body: cat1(h) };
    mockServer.lobbyLayout = {
      status: 200,
      body: { version: 2, items: defBodyItems(), stored: [{ id: "bed-1", type: "bed" }, { id: "qaSofa-1", type: "qaSofa" }] }
    };
    mockDevice.replies.set(filePath(h.bedIcon, "png"), "hold");
    serve([h.sofaIcon, "png"]);
    await renderHome();
    await enterEdit();
    await flushAsync();

    expect(trayCellNames()).toEqual(["침대", "QA 소파"]);
    expect(screen.getAllByText("보관함 2").length).toBeGreaterThan(0);
    const pngs = downloadedPaths().filter((p) => p.endsWith(".png"));
    expect([...new Set(pngs)].sort()).toEqual([filePath(h.bedIcon, "png"), filePath(h.sofaIcon, "png")].sort());
    expect(imageSources(trayCell("침대"))).toEqual([]);
    expect(within(trayCell("침대")).queryAllByText("침").length).toBeGreaterThan(0);
    expect(imageSources(trayCell("QA 소파"))).toEqual([{ uri: writtenUri(h.sofaIcon, "png") }]);

    await finishDownload(h.bedIcon, "png");
    expect(imageSources(trayCell("침대"))).toEqual([{ uri: writtenUri(h.bedIcon, "png") }]);
  });

  test("E6 보관함의 QA 시계(벽 가구, 아이콘 null)는 칸이 있고 그림 없이 이름 첫 글자 'Q'이며 아이콘 요청이 0건이다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = { ...hashes("e6"), clockIcon: null };
    mockServer.catalog = { status: 200, body: cat1(h) };
    mockServer.lobbyLayout = { status: 200, body: { version: 2, items: defBodyItems(), stored: [{ id: "qaClock-1", type: "qaClock" }] } };
    await renderHome();
    await enterEdit();
    await flushAsync();

    expect(trayCellNames()).toEqual(["QA 시계"]);
    expect(imageSources(trayCell("QA 시계"))).toEqual([]);
    expect(within(trayCell("QA 시계")).queryAllByText("Q").length).toBeGreaterThan(0);
    expect(downloadedPaths().filter((p) => p.endsWith(".png"))).toEqual([]);
  });

  test("E4 보관함에 옷장만 있으면 꾸미기를 열어도(홈쇼핑은 열지 않음) 아이콘 요청이 0건이다", async () => {
    jest.useFakeTimers({ now: nextDay() });
    const h = hashes("e4");
    mockServer.catalog = { status: 200, body: cat1(h) };
    const items = defBodyItems().filter((item) => item.id !== "wardrobe");
    mockServer.lobbyLayout = { status: 200, body: { version: 2, items, stored: [{ id: "wardrobe", type: "wardrobe" }] } };
    await renderHome();
    await enterEdit();
    await flushAsync();
    expect(trayCellNames()).toEqual(["옷장"]);
    expect(downloadedPaths().filter((p) => p.endsWith(".png"))).toEqual([]);
  });
});
