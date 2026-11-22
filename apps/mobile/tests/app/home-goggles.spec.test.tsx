// [spec] qa 테스트(작업 089 ⑤ 라룹이 고글, 새 기능, 모바일): 홈의 그릴 아이템(시나리오 10의 GH1~GH7), 옷장 얼굴장식 탭(GK1~GK7)과
// 고글 칸 그림(23의 NI3), 홈쇼핑 '바로 입기'와 '옷' 탭(GS1·GS2).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/10-qa-scenarios.md의 GH·GK·GS, 23-qa-scenarios.md의 NI3와
// "10 GC1~GC4, GH, GK, GP, GS 그대로 쓴다")와 08·11-main-decision.md(B2: 저장한 적 없으면 face goggles, B5: 불러오기 실패·손님·계정이 바뀐 직후는
// look을 "모름"(null)으로, 모르는 종류는 그 부위만 빼서 맨얼굴, B7: 얼굴장식 탭은 벗기·라룹이 고글·검정 선글라스)에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다(⑤ qa 테스트 home-closet-expand.spec·home-shopping-clothes-expand.spec와 같은 조작·가짜):
// 방 그리기(Lobby3dCanvas)와 옷장 미리보기(closet-preview)가 받는 look, 옷장 칸(역할 button, 이름 = 아이템 이름, 입은 칸은 selected),
// 홈쇼핑 카드·상세창·완료 판·'바로 입기', 옷 칸 그림 wearableIcon(종류).
// "홈 look이 없다" = 방 그리기가 받은 look이 null이나 undefined다. "홈 look = ALL_NULL" = 일곱 부위가 모두 null인 값이다(없음과 구별한다).
// 090-③ 뒤로 옷은 받은 아이템 목록의 파일로만 나오므로 테스트마다 서버 목록 파일의 옷으로 목록을 두고 그 파일을 기기에 둔 상태로 시작한다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import HomeScreen from "@/app/index";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
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
import { applyArea, applyLobbyLayout, markInfo, roomPlaceIds, type FloorPoint, type PlaceId, type PointerHit } from "@/lib/lobby3d/engine";
import { wearableIcon } from "@/lib/lobby3d/wearable-icons";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, HomeShopping, HomeShoppingWearableOrderResult, LoopPointsSummary, MobileHomeSnapshot, Wardrobe } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";
// 090-③ 옷 내려받기(05-main-decision 2, 사용자 결정 "qa가 새 동작에 맞게 고침"): 옷은 받은 아이템 목록의 그리기 정보·모델·그림 파일로만
// 홈쇼핑·옷장·라룹이에 나온다(목록이 없으면 그릴 줄 모르는 옷). 그래서 테스트마다 서버 목록 파일의 옷으로 목록을 두고 그 파일을 기기에 둔
// 상태(이미 받아 둠)로 시작한다. 단언·입력은 바꾸지 않았다.
import { parseItemCatalog as qaParseCatalog, setItemCatalog as qaSetCatalog } from "@/lib/item-catalog-store";
import { device, putWearFilesOnDevice, resetDevice, serverWearCatalog } from "../__fixtures__/wear-files-090";

jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockPreview: { props: { look?: Partial<Record<string, string | null>> | null } | null; mounted: number } = { props: null, mounted: 0 };

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
  function MockClosetPreview(props: { look?: Partial<Record<string, string | null>> | null }) {
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
const TITLE = "옷장";
const ENTER = "들어가기";
const OFF = "벗기";
const SAVE = "저장";
const GOGGLES = "라룹이 고글";
const SUNGLASSES = "검정 선글라스";
const SLOTS = ["hat", "top", "bottom", "shoes", "face", "back", "accessory"] as const;
type Slot = (typeof SLOTS)[number];
const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const TAB_EMPTY: [string, string][] = [
  ["모자", "아직 가진 모자가 없어요"],
  ["상의", "아직 가진 상의가 없어요"],
  ["하의", "아직 가진 하의가 없어요"],
  ["신발", "아직 가진 신발이 없어요"],
  ["등장식", "아직 가진 등장식이 없어요"],
  ["액세서리", "아직 가진 액세서리가 없어요"]
];
const FACE_EMPTY = "아직 가진 얼굴장식이 없어요";

function wardrobe(value: unknown): Wardrobe {
  return JSON.parse(JSON.stringify(value)) as Wardrobe;
}

const GOGGLES_ITEM = { type: "goggles", slot: "face", acquiredAt: "2026-11-01T00:00:00Z" };
/** 시나리오 GW0(새 계정 서버 응답). */
const GW0 = () => wardrobe({ items: [GOGGLES_ITEM], equipped: { ...ALL_NULL, face: "goggles" } });
/** 시나리오 GW1. */
const GW1_ITEMS = [GOGGLES_ITEM, { type: "sunglassesBlack", slot: "face", acquiredAt: "2026-11-13T01:00:00Z" }];
const GW1 = () => wardrobe({ items: GW1_ITEMS, equipped: { ...ALL_NULL, face: "goggles" } });
/** 03-qa-scenarios의 WB(일곱 부위 모두 입음, face sunglassesBlack). */
const WB_ITEMS = [
  ["capGreen", "hat"],
  ["tshirtYellow", "top"],
  ["shortsRed", "bottom"],
  ["shoesWhite", "shoes"],
  ["sunglassesBlack", "face"],
  ["backpackRed", "back"],
  ["necklaceGold", "accessory"]
].map(([type, slot], i) => ({ type, slot, acquiredAt: `2026-11-13T0${i + 1}:00:00Z` }));
const WB = () =>
  wardrobe({
    items: WB_ITEMS,
    equipped: { hat: "capGreen", top: "tshirtYellow", bottom: "shortsRed", shoes: "shoesWhite", face: "sunglassesBlack", back: "backpackRed", accessory: "necklaceGold" }
  });

/** S26: ⑤ 명세의 가격표 순서(서버가 고글을 주지 않는다). */
const PRICE_LIST: [string, number][] = [
  ["books", 40], ["smallPlant", 50], ["lamp", 60], ["capOrange", 60], ["capBlue", 60], ["capGreen", 60], ["frame", 70],
  ["shortsNavy", 70], ["shortsBrown", 70], ["shortsRed", 70], ["plant", 80], ["tshirtOrange", 80], ["tshirtWhite", 80],
  ["tshirtYellow", 80], ["shoesBrown", 90], ["shoesRed", 90], ["shoesWhite", 90], ["mufflerRed", 90], ["nightstand", 100],
  ["sunglassesBlack", 100], ["floorLamp", 110], ["necklaceGold", 110], ["backpackRed", 120], ["rug", 150], ["wardrobe", 180], ["bed", 300]
];
/** ⑤의 '옷' 탭 열여섯(서버 순서). */
const CLOTHES_NAMES = [
  "주황 야구모자", "파랑 야구모자", "초록 야구모자", "남색 반바지", "갈색 반바지", "빨강 반바지", "주황 티셔츠", "흰 티셔츠",
  "노랑 티셔츠", "갈색 운동화", "빨강 운동화", "흰 운동화", "빨강 머플러", "검정 선글라스", "금 목걸이", "빨강 백팩"
];

function shop26(): HomeShopping {
  const items = PRICE_LIST.map(([type, price]) => ({ type, price, salePrice: type === "rug" ? 120 : null, owned: 0 }));
  return JSON.parse(JSON.stringify({ balance: 200, broadcast: { type: "rug", price: 150, salePrice: 120 }, items })) as HomeShopping;
}

const SHOP_TITLE = "라룹 홈쇼핑";
const DETAIL_TITLE = "상품 자세히 보기";
const DETAIL_CLOSE = "상품 상세 닫기";
const ARRIVED_CLOTHES = "옷장에 도착했어요";
const ARRIVED_FURNITURE = "보관함에 도착했어요";
const KEEP_BROWSING = "계속 구경하기";
const WEAR_NOW = "바로 입기";

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-13T03:00:00.000Z");
const TODAY_KEY = "2026-11-13";
const userA: AuthUser = { id: 1, email: "a@example.com", displayName: "가", admin: false };
const userB: AuthUser = { id: 2, email: "b@example.com", displayName: "나", admin: false };
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

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function sim() {
  return canvas().sim;
}

/** 받은 look에서 입은 부위만(부위 → 종류). */
function wornOf(value: Partial<Record<string, string | null>> | null | undefined): Partial<Record<Slot, string>> {
  const out: Partial<Record<Slot, string>> = {};
  for (const slot of SLOTS) if (typeof value?.[slot] === "string") out[slot] = value[slot] as string;
  return out;
}

/** 홈 착용(방 그리기가 받은 look). */
function homeLook(): Partial<Record<Slot, string>> {
  return wornOf((canvas() as { look?: Partial<Record<string, string | null>> | null }).look);
}

/** 미리보기 착용. 미리보기가 그려져 있어야 한다. */
function previewLook(): Partial<Record<Slot, string>> {
  expect(mockPreview.mounted).toBeGreaterThan(0);
  return wornOf(mockPreview.props?.look);
}

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
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

/** 지금 방의 옷장 장소(이름표 "옷장"). */
function closetId(): PlaceId {
  const ids = roomPlaceIds().filter((id) => markInfo(id).label === TITLE);
  expect(ids).toHaveLength(1);
  return ids[0];
}

async function renderHome() {
  const view = await render(<HomeScreen />);
  await flushAsync();
  await frames(0.1);
  return view;
}

/** 홈을 그리고 옷장에 걸어가 도착한다. 도착한 자리를 돌려준다. */
async function arriveAtCloset(): Promise<FloorPoint> {
  await renderHome();
  const id = closetId();
  await tapHit({ point: null, mark: id, onCharacter: false });
  const done = () => sim().arrived === id && sim().vx === 0 && sim().vz === 0;
  for (let i = 0; i < 400 && !done(); i += 1) await frames(0.05);
  expect(done()).toBe(true);
  await frames(0.5);
  return { x: sim().x, z: sim().z };
}

async function pressEnter() {
  await fireEvent.press(screen.getByRole("button", { name: ENTER }));
  await flushAsync();
}

/** 홈을 그리고 옷장에 도착해 '들어가기'로 꾸미기 화면을 연다. 꾸미기 화면의 불러오기는 value(값이나 붙잡은 약속)로 답한다. */
async function openCloset(value: Wardrobe | Promise<Wardrobe | null> | null): Promise<FloorPoint> {
  const at = await arriveAtCloset();
  jest.mocked(getWardrobe).mockImplementationOnce(() => (value instanceof Promise ? value : Promise.resolve(value)));
  await pressEnter();
  return at;
}

function titles() {
  return screen.queryAllByRole("header", { name: TITLE, ...ALL });
}

function isOpen() {
  return titles().length === 1;
}

type Node = ReturnType<typeof screen.getByRole>;

function modal(): Node {
  const [title] = titles();
  expect(title).toBeDefined();
  for (let n: Node | null = title; n; n = n.parent) if ((n.type as unknown) === "Modal") return n;
  throw new Error("꾸미기 화면 Modal이 없다");
}

function inModal() {
  return within(modal());
}

function labelOf(node: Node): string | undefined {
  const props = node.props as { accessibilityLabel?: string; "aria-label"?: string };
  return props["aria-label"] ?? props.accessibilityLabel;
}

function isDisabled(node: Node): boolean {
  const props = node.props as { accessibilityState?: { disabled?: boolean }; "aria-disabled"?: boolean; disabled?: boolean };
  return (props["aria-disabled"] ?? props.accessibilityState?.disabled ?? props.disabled) === true;
}

function isSelected(node: Node): boolean {
  const props = node.props as { accessibilityState?: { selected?: boolean }; "aria-selected"?: boolean };
  return (props["aria-selected"] ?? props.accessibilityState?.selected) === true;
}

function tabs(): Node[] {
  return inModal().queryAllByRole("tab", ALL);
}

function tab(name: string): Node {
  return inModal().getByRole("tab", { name, ...ALL });
}

/** 칸 줄: "벗기" 칸에서 위로, 부위 탭을 품지 않는 가장 높은 판. */
function cellRow(): Node {
  let row = inModal().getByRole("button", { name: OFF, ...ALL });
  for (let n: Node | null = row.parent; n; n = n.parent) {
    if (within(n).queryAllByRole("tab", ALL).length > 0) break;
    row = n;
  }
  return row;
}

function cells(): Node[] {
  return within(cellRow()).queryAllByRole("button", ALL);
}

function cellNames(): (string | undefined)[] {
  return cells().map(labelOf);
}

function selectedCells(): (string | undefined)[] {
  return cells().filter(isSelected).map(labelOf);
}

function cell(name: string): Node {
  return within(cellRow()).getByRole("button", { name, ...ALL });
}

function saveButton(): Node {
  return inModal().getByRole("button", { name: SAVE, ...ALL });
}

function hasText(text: string): boolean {
  return screen.queryAllByText(text, ALL).length > 0;
}

async function pressNode(node: Node) {
  await fireEvent.press(node);
  await flushAsync();
}

async function chooseTab(name: string) {
  await pressNode(tab(name));
}

async function chooseCell(name: string) {
  await pressNode(cell(name));
}


function savedBodies(): unknown[] {
  return jest.mocked(saveWardrobeEquipped).mock.calls.map((call) => call[0]);
}

function useJsAnimation() {
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  resetDevice();
  qaSetCatalog(qaParseCatalog(serverWearCatalog())!);
  putWearFilesOnDevice();
  jest.useFakeTimers({ now: NOW });
  devGlobal.__DEV__ = false;
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  mockPreview.props = null;
  mockPreview.mounted = 0;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
  jest.mocked(getWardrobe).mockReset().mockResolvedValue(wardrobe({ items: [], equipped: ALL_NULL }));
  jest.mocked(saveWardrobeEquipped).mockReset();
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (value: LobbyLayout) => JSON.parse(JSON.stringify(value)));
  jest.mocked(getLoopPoints).mockReset().mockResolvedValue(loopPoints(120));
  jest.mocked(getHomeShopping).mockReset();
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

// ---------- 이 파일의 도우미 ----------

type UiNode = Node;

/** 방 그리기가 받은 look 그대로. */
function rawHomeLook(): unknown {
  return (canvas() as { look?: unknown }).look;
}

function expectNoHomeLook(label: string) {
  const value = rawHomeLook();
  expect({ label, none: value === null || value === undefined }).toEqual({ label, none: true });
}

/** 미리보기가 받은 look 그대로. */
function rawPreviewLook(): unknown {
  expect(mockPreview.mounted).toBeGreaterThan(0);
  return mockPreview.props?.look;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
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

function isStruck(node: UiNode): boolean {
  const style = (StyleSheet.flatten((node.props as { style?: unknown }).style as never) ?? {}) as { textDecorationLine?: string };
  return (style.textDecorationLine ?? "").includes("line-through");
}

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


function orderButton(price: number): UiNode {
  return button(`${price}룹에 주문하기`);
}

function button(name: string): UiNode {
  return screen.getByRole("button", { name, ...ALL });
}

function cellImages(name: string): unknown[] {
  return cell(name)
    .queryAll((node) => (node.type as unknown) === "Image")
    .map((node) => (node.props as { source?: unknown }).source);
}

// ---------- GH. 홈 ----------

describe("[spec] 089-⑤ 10 GH: 홈의 그릴 아이템", () => {
  it(
    "GH1 로그인 홈에서 옷장 불러오기가 GW0이면 홈 look = { ...ALL_NULL, face: goggles }",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(GW0());
      await renderHome();
      expect(rawHomeLook()).toEqual({ ...ALL_NULL, face: "goggles" });
    },
    SLOW_TEST_MS
  );

  it(
    "GH2 불러오기 equipped가 ALL_NULL(얼굴장식을 비운 계정)이면 홈 look = ALL_NULL(없음이 아니다)",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(wardrobe({ items: [GOGGLES_ITEM], equipped: ALL_NULL }));
      await renderHome();
      expect(rawHomeLook()).toEqual(ALL_NULL);
    },
    SLOW_TEST_MS
  );

  it.each([
    ["네트워크 오류", () => Promise.reject(new Error("network"))],
    ["401(null)", () => Promise.resolve(null)]
  ])(
    "GH3 불러오기가 실패(%s)하면 홈 look이 없고 wear는 모두 거짓이다",
    async (label, answer) => {
      jest.mocked(getWardrobe).mockImplementation(answer as () => Promise<Wardrobe | null>);
      await renderHome();
      expectNoHomeLook(label);
      expect((canvas() as { wear?: unknown }).wear).toEqual({ hat: false, top: false, bottom: false, shoes: false });
    },
    SLOW_TEST_MS
  );

  it(
    "GH4 처음 보일 때 불러오기를 붙잡아 두면 응답 전 홈 look이 없고, 응답 GW0이 오면 face goggles다",
    async () => {
      const held = deferred<Wardrobe | null>();
      jest.mocked(getWardrobe).mockReturnValue(held.promise);
      await renderHome();
      expectNoHomeLook("응답 전");
      await act(async () => {
        held.resolve(GW0());
      });
      await flushAsync();
      expect(rawHomeLook()).toEqual({ ...ALL_NULL, face: "goggles" });
    },
    SLOW_TEST_MS
  );

  it(
    "GH5 사용자 A(WB, face sunglassesBlack)로 그린 뒤 B로 바뀌고 B의 불러오기를 붙잡으면 응답 전 홈 look이 없고(A의 선글라스가 남지 않음), B의 응답 GW0이 오면 face goggles다",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(WB());
      const view = await renderHome();
      expect((rawHomeLook() as { face?: unknown }).face).toBe("sunglassesBlack");
      const fromB = deferred<Wardrobe | null>();
      jest.mocked(getWardrobe).mockReturnValue(fromB.promise);
      setSessionUser(userB);
      await view.rerender(<HomeScreen />);
      await flushAsync();
      expectNoHomeLook("B 응답 전");
      await act(async () => {
        fromB.resolve(GW0());
      });
      await flushAsync();
      expect(rawHomeLook()).toEqual({ ...ALL_NULL, face: "goggles" });
    },
    SLOW_TEST_MS
  );

  it(
    "GH6 불러오기 equipped { ...ALL_NULL, face: glassesRound }면 홈 look = ALL_NULL(없음이 아니다)",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(wardrobe({ items: [GOGGLES_ITEM], equipped: { ...ALL_NULL, face: "glassesRound" } }));
      await renderHome();
      expect(rawHomeLook()).toEqual(ALL_NULL);
    },
    SLOW_TEST_MS
  );

  it(
    "GH7 시험판 없는 로비(devPanel=false)를 look 없이 그리면 방 그리기가 받은 look이 없다",
    async () => {
      await render(<Lobby3dScreen devPanel={false} />);
      await flushAsync();
      expectNoHomeLook("GH7");
    },
    SLOW_TEST_MS
  );
});

// ---------- GK·NI3. 옷장 ----------

describe("[spec] 089-⑤ 10 GK·23 NI3: 옷장의 얼굴장식 탭과 고글 칸 그림", () => {
  it(
    "GK1 GW1로 열면 얼굴장식 탭의 칸이 [벗기, 라룹이 고글, 검정 선글라스]이고 '라룹이 고글'이 입은 칸이며 빈 부위 문구가 없다",
    async () => {
      await openCloset(GW1());
      await chooseTab("얼굴장식");
      expect(cellNames()).toEqual([OFF, GOGGLES, SUNGLASSES]);
      expect(selectedCells()).toEqual([GOGGLES]);
      expect(hasText(FACE_EMPTY)).toBe(false);
    },
    SLOW_TEST_MS
  );

  it(
    "GK2·NI3 '라룹이 고글' 칸 그림이 고글의 칸 그림(wearableIcon goggles = 앱의 goggles.png)이고 받기 요청이 없다(다른 옷 파일은 기기에 둔 상태)",
    async () => {
      await openCloset(GW1());
      await chooseTab("얼굴장식");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bundled = require("@/assets/icons/wearables/goggles.png");
      expect(wearableIcon("goggles")).toBe(bundled);
      expect(cellImages(GOGGLES)).toEqual([bundled]);
      expect(device.downloads).toEqual([]);
    },
    SLOW_TEST_MS
  );

  it(
    "GK3 GW1로 열면 처음 미리보기 look.face가 goggles다",
    async () => {
      await openCloset(GW1());
      expect((rawPreviewLook() as { face?: unknown }).face).toBe("goggles");
    },
    SLOW_TEST_MS
  );

  it(
    "GK4 '검정 선글라스' → '벗기' → '라룹이 고글'을 차례로 누르면 미리보기 look.face가 sunglassesBlack → null → goggles이고 표시되는 칸도 차례로 바뀐다",
    async () => {
      await openCloset(GW1());
      await chooseTab("얼굴장식");
      const seen: unknown[] = [];
      for (const name of [SUNGLASSES, OFF, GOGGLES]) {
        await chooseCell(name);
        seen.push({ face: (rawPreviewLook() as { face?: unknown }).face, selected: selectedCells() });
      }
      expect(seen).toEqual([
        { face: "sunglassesBlack", selected: [SUNGLASSES] },
        { face: null, selected: [OFF] },
        { face: "goggles", selected: [GOGGLES] }
      ]);
    },
    SLOW_TEST_MS
  );

  it(
    "GK5 GW1로 열어 바꾸지 않으면 '저장'이 꺼져 있고, '검정 선글라스'를 고르고 저장하면 본문이 { ...ALL_NULL, face: sunglassesBlack }이며 닫힌 뒤 홈 look.face가 sunglassesBlack이다",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(GW1());
      await openCloset(GW1());
      expect(isDisabled(saveButton())).toBe(true);
      const saved = { ...ALL_NULL, face: "sunglassesBlack" };
      jest.mocked(saveWardrobeEquipped).mockResolvedValueOnce(wardrobe({ items: GW1_ITEMS, equipped: saved }));
      jest.mocked(getWardrobe).mockImplementation(() => new Promise<Wardrobe | null>(() => {}));
      await chooseTab("얼굴장식");
      await chooseCell(SUNGLASSES);
      await pressNode(saveButton());
      expect(savedBodies()).toEqual([saved]);
      expect(isOpen()).toBe(false);
      expect((rawHomeLook() as { face?: unknown }).face).toBe("sunglassesBlack");
    },
    SLOW_TEST_MS
  );

  it(
    "GK6 GW1에서 얼굴장식 '벗기'로 저장하면 본문 face가 null이고 닫힌 뒤 홈 look = ALL_NULL(없음이 아니다)",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(GW1());
      await openCloset(GW1());
      jest.mocked(saveWardrobeEquipped).mockResolvedValueOnce(wardrobe({ items: GW1_ITEMS, equipped: ALL_NULL }));
      jest.mocked(getWardrobe).mockImplementation(() => new Promise<Wardrobe | null>(() => {}));
      await chooseTab("얼굴장식");
      await chooseCell(OFF);
      await pressNode(saveButton());
      expect(savedBodies().map((body) => (body as { face?: unknown }).face)).toEqual([null]);
      expect(isOpen()).toBe(false);
      expect(rawHomeLook()).toEqual(ALL_NULL);
    },
    SLOW_TEST_MS
  );

  it(
    "GK7 GW0으로 열면 얼굴장식 탭은 [벗기, 라룹이 고글](고글 표시)이고 다른 여섯 탭은 [벗기]와 빈 부위 문구다",
    async () => {
      await openCloset(GW0());
      const seen: Record<string, unknown> = {};
      for (const [name, empty] of TAB_EMPTY) {
        await chooseTab(name);
        seen[name] = { cells: cellNames(), empty: hasText(empty) };
      }
      await chooseTab("얼굴장식");
      seen["얼굴장식"] = { cells: cellNames(), selected: selectedCells(), empty: hasText(FACE_EMPTY) };
      expect(seen).toEqual({
        ...Object.fromEntries(TAB_EMPTY.map(([name]) => [name, { cells: [OFF], empty: true }])),
        얼굴장식: { cells: [OFF, GOGGLES], selected: [GOGGLES], empty: false }
      });
    },
    SLOW_TEST_MS
  );
});

// ---------- GS. 홈쇼핑 ----------

describe("[spec] 089-⑤ 10 GS: 홈쇼핑 '바로 입기'와 '옷' 탭", () => {
  it(
    "GS1 홈 옷장 GW0에서 검정 선글라스(100)를 사서 '바로 입기'하면 저장 본문이 { ...ALL_NULL, face: sunglassesBlack }이고 홈 look.face가 sunglassesBlack이다",
    async () => {
      jest.mocked(getHomeShopping).mockResolvedValue(shop26());
      jest.mocked(getLoopPoints).mockResolvedValue(loopPoints(200));
      jest.mocked(getWardrobe).mockResolvedValue(GW0());
      await renderHome();
      const result: HomeShoppingWearableOrderResult = {
        type: "sunglassesBlack",
        price: 100,
        balance: 100,
        owned: 1,
        itemId: null,
        layout: null,
        wardrobe: wardrobe({
          items: [GOGGLES_ITEM, { type: "sunglassesBlack", slot: "face", acquiredAt: "2026-11-13T03:00:00Z" }],
          equipped: { ...ALL_NULL, face: "goggles" }
        })
      };
      jest.mocked(orderHomeShoppingWearable).mockResolvedValueOnce(result);
      jest.mocked(saveWardrobeEquipped).mockImplementation(async (equipped) => wardrobe({ items: result.wardrobe!.items, equipped }));
      await openShop();
      await pressNode(cardOf(SUNGLASSES));
      await pressNode(orderButton(100));
      expect(successPanelOrNull()).not.toBeNull();
      jest.mocked(getWardrobe).mockImplementation(() => new Promise<Wardrobe | null>(() => {}));
      await pressNode(button(WEAR_NOW));
      expect(savedBodies()).toEqual([{ ...ALL_NULL, face: "sunglassesBlack" }]);
      expect((rawHomeLook() as { face?: unknown }).face).toBe("sunglassesBlack");
    },
    SLOW_TEST_MS
  );

  it(
    "GS2 목록 S26(서버가 고글을 주지 않음)이면 '옷' 탭이 열여섯 그대로이고 '라룹이 고글' 카드가 없다",
    async () => {
      jest.mocked(getHomeShopping).mockResolvedValue(shop26());
      jest.mocked(getWardrobe).mockResolvedValue(GW0());
      await renderHome();
      await openShop();
      await pressTab("옷");
      expect(cardNames()).toEqual(CLOTHES_NAMES);
      expect(cardNames()).not.toContain(GOGGLES);
    },
    SLOW_TEST_MS
  );
});
