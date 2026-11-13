// [spec] qa 테스트(작업 089 ⑤ 아이템 늘리기, 새 기능, 모바일): 홈의 라룹이가 새 아이템을 그 종류로 입는지(시나리오 L1~L4)와
// 옷장(꾸미기 화면)의 일곱 부위 칸·그림·입은 칸·미리보기·저장(K1~K13).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/03-qa-scenarios.md의 L·K)와
// 04-main-decision.md B(A-4: 그리기에는 부위 일곱의 종류를 look으로 따로 넘기고 wear(①의 넷)는 그대로 둔다)에서만 가져온다.
// ③의 화면 규칙(얻은 순서, 입은 칸 표시, 모르는 종류·다른 부위 아이템은 칸 없음, 빈 부위 문구)은 ③ 폴더 명세·결정 그대로다.
// 구현 커밋 59b34f2에서 읽은 것은 부르는 방법뿐이다:
// - 방 그리기(Lobby3dCanvas)와 옷장 미리보기(closet-preview)가 받는 look(부위 일곱 → 종류·null). 둘 다 3D라 가짜로 두고 받은 속성을 읽는다.
// - 옷장 열기·탭·칸·저장의 조작은 ③ qa 테스트(home-closet.spec.test.tsx)와 같다(칸은 역할 button, 이름 = 아이템 이름, 입은 칸은 selected).
// "홈 착용" = 방 그리기가 받은 look에서 입은 부위만, "미리보기 착용" = 미리보기가 받은 look에서 입은 부위만(부위 → 종류).
// 꾸미기 화면 안의 질의는 확인 판이 뒤를 접근성에서 가릴 수 있어 가려진 것까지 찾는다(ALL).
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
  orderHomeShopping,
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
import type { AuthUser, LoopPointsSummary, MobileHomeSnapshot, Wardrobe } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

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
const SLOTS = ["hat", "top", "bottom", "shoes", "face", "back", "accessory"] as const;
type Slot = (typeof SLOTS)[number];
const EMPTY: Record<string, string> = {
  상의: "아직 가진 상의가 없어요",
  얼굴장식: "아직 가진 얼굴장식이 없어요",
  등장식: "아직 가진 등장식이 없어요",
  액세서리: "아직 가진 액세서리가 없어요"
};
/** 시나리오 "아이템 열여섯"(종류, 부위, 이름). 명세 표 순서. */
const ITEMS: [string, Slot, string][] = [
  ["capOrange", "hat", "주황 야구모자"],
  ["tshirtOrange", "top", "주황 티셔츠"],
  ["shortsNavy", "bottom", "남색 반바지"],
  ["shoesBrown", "shoes", "갈색 운동화"],
  ["capBlue", "hat", "파랑 야구모자"],
  ["capGreen", "hat", "초록 야구모자"],
  ["tshirtWhite", "top", "흰 티셔츠"],
  ["tshirtYellow", "top", "노랑 티셔츠"],
  ["shortsBrown", "bottom", "갈색 반바지"],
  ["shortsRed", "bottom", "빨강 반바지"],
  ["shoesRed", "shoes", "빨강 운동화"],
  ["shoesWhite", "shoes", "흰 운동화"],
  ["sunglassesBlack", "face", "검정 선글라스"],
  ["backpackRed", "back", "빨강 백팩"],
  ["mufflerRed", "accessory", "빨강 머플러"],
  ["necklaceGold", "accessory", "금 목걸이"]
];
const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
/** WA의 items: 명세 표 순서로 01:00부터 한 시간씩. */
const WA_ITEMS = ITEMS.map(([type, slot], i) => ({ type, slot, acquiredAt: `2026-11-13T${String(i + 1).padStart(2, "0")}:00:00Z` }));
const WA_EQUIPPED = { ...ALL_NULL, hat: "capOrange", top: "tshirtOrange", accessory: "mufflerRed" };
const WB_EQUIPPED = {
  hat: "capGreen",
  top: "tshirtYellow",
  bottom: "shortsRed",
  shoes: "shoesWhite",
  face: "sunglassesBlack",
  back: "backpackRed",
  accessory: "necklaceGold"
};

function wardrobe(value: unknown): Wardrobe {
  return JSON.parse(JSON.stringify(value)) as Wardrobe;
}

const WA = () => wardrobe({ items: WA_ITEMS, equipped: WA_EQUIPPED });
const WB = () => wardrobe({ items: WA_ITEMS, equipped: WB_EQUIPPED });
const WX = () =>
  wardrobe({
    items: [...WA_ITEMS, { type: "glassesRound", slot: "face", acquiredAt: "2026-11-13T17:00:00Z" }],
    equipped: { ...ALL_NULL, hat: "capBlue", face: "glassesRound", back: "mufflerRed" }
  });
const WCAP = () =>
  wardrobe({
    items: [
      { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T01:00:00Z" },
      { type: "capBlue", slot: "hat", acquiredAt: "2026-11-13T02:00:00Z" }
    ],
    equipped: { ...ALL_NULL, hat: "capOrange" }
  });

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
const TAB_CELLS: [string, string[]][] = [
  ["모자", [OFF, "주황 야구모자", "파랑 야구모자", "초록 야구모자"]],
  ["상의", [OFF, "주황 티셔츠", "흰 티셔츠", "노랑 티셔츠"]],
  ["하의", [OFF, "남색 반바지", "갈색 반바지", "빨강 반바지"]],
  ["신발", [OFF, "갈색 운동화", "빨강 운동화", "흰 운동화"]],
  ["얼굴장식", [OFF, "검정 선글라스"]],
  ["등장식", [OFF, "빨강 백팩"]],
  ["액세서리", [OFF, "빨강 머플러", "금 목걸이"]]
];

// ---------- L. 홈의 라룹이 ----------

describe("[spec] 089-⑤ L: 홈의 라룹이가 새 아이템을 그 종류로 입는다", () => {
  it(
    "L1 옷장 불러오기가 WB면 홈 착용이 일곱 부위 그대로다",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(WB());
      await renderHome();
      expect(homeLook()).toEqual(WB_EQUIPPED);
    },
    SLOW_TEST_MS
  );

  it(
    "L2 모르는 종류(얼굴장식 glassesRound)·다른 부위 아이템(등장식에 mufflerRed)은 빼고 모자(capBlue)만 입는다",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(WX());
      await renderHome();
      expect(homeLook()).toEqual({ hat: "capBlue" });
    },
    SLOW_TEST_MS
  );

  it(
    "L3 홈이 다시 보이면 다시 불러와 같은 부위의 다른 아이템으로 바뀐다(모자 주황 → 파랑, 액세서리 머플러 → 목걸이)",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(WA());
      await renderHome();
      expect(homeLook()).toEqual({ hat: "capOrange", top: "tshirtOrange", accessory: "mufflerRed" });
      await setFocused(false);
      jest.mocked(getWardrobe).mockResolvedValue(wardrobe({ items: WA_ITEMS, equipped: { ...WA_EQUIPPED, hat: "capBlue", accessory: "necklaceGold" } }));
      await setFocused(true);
      expect(homeLook()).toEqual({ hat: "capBlue", top: "tshirtOrange", accessory: "necklaceGold" });
    },
    SLOW_TEST_MS
  );

  it(
    "L4 불러오기에 실패하면 아무것도 입지 않는다",
    async () => {
      jest.mocked(getWardrobe).mockRejectedValue(new Error("network"));
      await renderHome();
      expect(homeLook()).toEqual({});
    },
    SLOW_TEST_MS
  );
});

// ---------- K. 옷장 ----------

describe("[spec] 089-⑤ K: 옷장의 일곱 부위 칸", () => {
  it(
    "K1 WA로 열면 일곱 탭 모두에 가진 아이템 칸이 얻은 순서로 있고 빈 부위 문구가 없다",
    async () => {
      await openCloset(WA());
      expect(tabs().map(labelOf)).toEqual(TAB_CELLS.map(([name]) => name));
      const seen: Record<string, unknown> = {};
      for (const [name] of TAB_CELLS) {
        await chooseTab(name);
        seen[name] = cellNames();
      }
      expect(seen).toEqual(Object.fromEntries(TAB_CELLS));
      expect(Object.values(EMPTY).filter(hasText)).toEqual([]);
    },
    SLOW_TEST_MS
  );

  it(
    "K2 items를 거꾸로 주면 칸도 거꾸로다(액세서리: 금 목걸이, 빨강 머플러 / 모자: 초록, 파랑, 주황 야구모자)",
    async () => {
      await openCloset(wardrobe({ items: [...WA_ITEMS].reverse(), equipped: WA_EQUIPPED }));
      const hat = cellNames();
      await chooseTab("액세서리");
      expect({ hat, accessory: cellNames() }).toEqual({
        hat: [OFF, "초록 야구모자", "파랑 야구모자", "주황 야구모자"],
        accessory: [OFF, "금 목걸이", "빨강 머플러"]
      });
    },
    SLOW_TEST_MS
  );

  it(
    "K3 새 열둘의 칸마다 그림이 그 아이템의 칸 그림(wearableIcon)이다",
    async () => {
      await openCloset(WA());
      const fresh = ITEMS.slice(4);
      const seen: Record<string, unknown[]> = {};
      for (const [tabName] of TAB_CELLS) {
        await chooseTab(tabName);
        for (const [type, , name] of fresh) {
          if (!cellNames().includes(name)) continue;
          seen[type] = cell(name)
            .queryAll((node) => (node.type as unknown) === "Image")
            .map((node) => (node.props as { source?: unknown }).source);
        }
      }
      expect(seen).toEqual(Object.fromEntries(fresh.map(([type]) => [type, [wearableIcon(type)]])));
    },
    SLOW_TEST_MS
  );

  it(
    "K4·K5 WB로 열면 탭마다 입은 칸이 표시되고, 처음 미리보기 착용이 WB 그대로다",
    async () => {
      await openCloset(WB());
      expect(previewLook()).toEqual(WB_EQUIPPED);
      const seen: Record<string, unknown> = {};
      for (const [name] of TAB_CELLS) {
        await chooseTab(name);
        seen[name] = selectedCells();
      }
      expect(seen).toEqual({
        모자: ["초록 야구모자"],
        상의: ["노랑 티셔츠"],
        하의: ["빨강 반바지"],
        신발: ["흰 운동화"],
        얼굴장식: ["검정 선글라스"],
        등장식: ["빨강 백팩"],
        액세서리: ["금 목걸이"]
      });
    },
    SLOW_TEST_MS
  );

  it(
    "K6 WA에서 모자 탭 '파랑 야구모자'를 누르면 미리보기 모자가 capBlue로 바뀌고 다른 부위는 그대로이며, 그 칸만 표시되고 '저장'을 쓸 수 있다",
    async () => {
      await openCloset(WA());
      expect(isDisabled(saveButton())).toBe(true);
      await chooseCell("파랑 야구모자");
      expect(previewLook()).toEqual({ hat: "capBlue", top: "tshirtOrange", accessory: "mufflerRed" });
      expect(selectedCells()).toEqual(["파랑 야구모자"]);
      expect(isDisabled(saveButton())).toBe(false);
    },
    SLOW_TEST_MS
  );

  it(
    "K7 머플러를 입은 WA에서 액세서리 탭 '금 목걸이'를 누르면 미리보기 액세서리가 목걸이 하나이고 금 목걸이만 표시된다",
    async () => {
      await openCloset(WA());
      await chooseTab("액세서리");
      expect(selectedCells()).toEqual(["빨강 머플러"]);
      await chooseCell("금 목걸이");
      expect(previewLook()).toEqual({ hat: "capOrange", top: "tshirtOrange", accessory: "necklaceGold" });
      expect(selectedCells()).toEqual(["금 목걸이"]);
    },
    SLOW_TEST_MS
  );

  it(
    "K8 얼굴장식 '검정 선글라스', 등장식 '빨강 백팩'을 누른 뒤 얼굴장식 '벗기'를 누르면 미리보기에 백팩만 남고 얼굴장식 탭은 '벗기'가 표시된다",
    async () => {
      await openCloset(WA());
      await chooseTab("얼굴장식");
      await chooseCell("검정 선글라스");
      await chooseTab("등장식");
      await chooseCell("빨강 백팩");
      await chooseTab("얼굴장식");
      await chooseCell(OFF);
      expect(previewLook()).toEqual({ hat: "capOrange", top: "tshirtOrange", back: "backpackRed", accessory: "mufflerRed" });
      expect(selectedCells()).toEqual([OFF]);
    },
    SLOW_TEST_MS
  );

  it(
    "K9·K10 초록 야구모자·검정 선글라스·빨강 백팩·금 목걸이를 고르고 저장하면 본문이 일곱 부위이고, 닫힌 뒤 다시 불러오기 없이 홈 착용이 그 종류다",
    async () => {
      await openCloset(WA());
      const saved = { hat: "capGreen", top: "tshirtOrange", bottom: null, shoes: null, face: "sunglassesBlack", back: "backpackRed", accessory: "necklaceGold" };
      jest.mocked(saveWardrobeEquipped).mockResolvedValueOnce(wardrobe({ items: WA_ITEMS, equipped: saved }));
      jest.mocked(getWardrobe).mockImplementation(() => new Promise<Wardrobe | null>(() => {}));
      await chooseCell("초록 야구모자");
      await chooseTab("얼굴장식");
      await chooseCell("검정 선글라스");
      await chooseTab("등장식");
      await chooseCell("빨강 백팩");
      await chooseTab("액세서리");
      await chooseCell("금 목걸이");
      await pressNode(saveButton());
      expect(savedBodies()).toEqual([saved]);
      expect(isOpen()).toBe(false);
      expect(homeLook()).toEqual({ hat: "capGreen", top: "tshirtOrange", face: "sunglassesBlack", back: "backpackRed", accessory: "necklaceGold" });
    },
    SLOW_TEST_MS
  );

  it(
    "K11 모자만 가진 옷장(WCAP)은 얼굴장식·등장식·액세서리·상의 탭이 '벗기'만이고 빈 부위 문구가 보이며, 모자 탭은 벗기·주황·파랑 야구모자다",
    async () => {
      await openCloset(WCAP());
      const seen: Record<string, unknown> = { 모자: cellNames() };
      for (const name of ["얼굴장식", "등장식", "액세서리", "상의"]) {
        await chooseTab(name);
        seen[name] = { cells: cellNames(), empty: hasText(EMPTY[name]) };
      }
      expect(seen).toEqual({
        모자: [OFF, "주황 야구모자", "파랑 야구모자"],
        얼굴장식: { cells: [OFF], empty: true },
        등장식: { cells: [OFF], empty: true },
        액세서리: { cells: [OFF], empty: true },
        상의: { cells: [OFF], empty: true }
      });
    },
    SLOW_TEST_MS
  );

  it(
    "K12 WX로 열면 얼굴장식 탭은 벗기·검정 선글라스(둥근 안경 칸 없음)이고 입은 칸 표시가 없으며, 모자 탭은 파랑 야구모자가 표시된다",
    async () => {
      await openCloset(WX());
      const hat = selectedCells();
      await chooseTab("얼굴장식");
      expect({ hat, face: cellNames(), faceSelected: selectedCells() }).toEqual({
        hat: ["파랑 야구모자"],
        face: [OFF, "검정 선글라스"],
        faceSelected: []
      });
    },
    SLOW_TEST_MS
  );

  it(
    "K13 mufflerRed가 부위 back으로 오면 등장식 탭에도 액세서리 탭에도 빨강 머플러 칸이 없다",
    async () => {
      await openCloset(
        wardrobe({
          items: [
            { type: "mufflerRed", slot: "back", acquiredAt: "2026-11-13T01:00:00Z" },
            { type: "backpackRed", slot: "back", acquiredAt: "2026-11-13T02:00:00Z" }
          ],
          equipped: ALL_NULL
        })
      );
      await chooseTab("등장식");
      const back = cellNames();
      await chooseTab("액세서리");
      expect({ back, accessory: cellNames() }).toEqual({ back: [OFF, "빨강 백팩"], accessory: [OFF] });
    },
    SLOW_TEST_MS
  );
});
