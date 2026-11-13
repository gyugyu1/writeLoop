// [spec] qa 테스트(작업 089 ③ 옷장 장소와 캐릭터 꾸미기 화면, 새 기능, 모바일): 홈에서 옷장 '들어가기'로 여는 꾸미기 화면(제목 "옷장").
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/05-옷장과-꾸미기-화면/02-qa-scenarios.md의 P3, SA1~SA12, SB1~SB3·SB5,
// SC1~SC13, SD1~SD16, SE1~SE9, I2)와 03-main-decision.md B(3: 빈 부위 문구는 받침에 맞춤, 4: 저장 중 네트워크 오류는 "입지 못했어요. 다시 시도해 주세요",
// 5: 저장 401은 닫고 홈으로, 6: 앱이 모르는 입은 값은 저장 본문에 그대로 보내고 그 탭은 아무 칸도 입은 것으로 표시하지 않는다,
// 7: 앱 목록과 부위가 다르게 온 아이템은 칸을 만들지 않는다, 10: '들어가기' 뒤 동작 없이 바로 연다)에서만 가져온다.
// 구현 커밋 5832ac1에서 읽은 것은 부르는 방법뿐이다:
// - 꾸미기 화면은 홈 위의 Modal(기기 뒤로 가기는 onRequestClose)이고 제목은 접근성 역할 header인 글 "옷장"이다.
// - 미리보기 라룹이는 components/home/closet-preview(속성 wear: 부위 hat·top·bottom·shoes마다 참·거짓, reduceMotion)다. 3D라 가짜로 둔다.
// - 부위 탭은 역할 tab(이름 = 부위 이름), 칸·저장·닫기·다시 시도는 역할 button(닫기는 이름에 "닫기"가 든 버튼), 고른 표시·못 씀은 accessibilityState.selected·disabled다.
// - 불러오기 getWardrobe(401이면 null), 저장 saveWardrobeEquipped(실패면 ApiError). 방 화면이 3D 그리기에 넘기는 paused·wear·sim·onFrame·onPointer.
// "미리보기 착용 목록"은 가짜 미리보기가 받은 wear에서 참인 부위(순서 hat·top·bottom·shoes)다. "홈 착용 목록"은 방 그리기가 받은 wear다.
// 서버 응답 모양(400 코드, 500 메시지, 401, 네트워크)을 거쳐야 하는 저장·불러오기는 진짜 함수(api.ts)를 부르고 전역 fetch를 가짜로 둔다.
// 그래서 api 가짜는 ApiError만 진짜 클래스를 쓴다(진짜 함수가 던진 오류를 화면이 같은 클래스로 알아보게).
// 꾸미기 화면 안의 질의는 확인 판(accessibilityViewIsModal)이 뒤를 접근성에서 가릴 수 있어 가려진 것까지 찾는다(ALL).
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
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, LoopPointsSummary, MobileHomeSnapshot, Wardrobe } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";
// 090-③ 옷 내려받기(05-main-decision 2, 사용자 결정 "qa가 새 동작에 맞게 고침"): 옷은 받은 아이템 목록의 그리기 정보·모델·그림 파일로만
// 홈쇼핑·옷장·라룹이에 나온다(목록이 없으면 그릴 줄 모르는 옷). 그래서 테스트마다 서버 목록 파일의 옷으로 목록을 두고 그 파일을 기기에 둔
// 상태(이미 받아 둠)로 시작한다. 단언·입력은 바꾸지 않았다.
import { parseItemCatalog as qaParseCatalog, setItemCatalog as qaSetCatalog } from "@/lib/item-catalog-store";
import { putWearFilesOnDevice, resetDevice, serverWearCatalog } from "../__fixtures__/wear-files-090";

jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockPreview: { props: { wear?: Partial<Record<string, boolean>>; reduceMotion?: boolean } | null; mounted: number } = { props: null, mounted: 0 };

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
  function MockClosetPreview(props: { wear?: Partial<Record<string, boolean>>; reduceMotion?: boolean }) {
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

/** 진짜 불러오기·저장 함수(api.ts). */
const actualApi = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");

// ---------- 시나리오의 값 ----------

const ALL = { includeHiddenElements: true } as const;
const TITLE = "옷장";
const ENTER = "들어가기";
const OFF = "벗기";
const SAVE = "저장";
const LOAD_FAILED = "옷장을 불러오지 못했어요";
const RETRY = "다시 시도";
const SAVE_INVALID = "입을 수 없는 아이템이 있어요";
const SAVE_FAILED = "입지 못했어요. 다시 시도해 주세요";
const CONFIRM = "저장하지 않고 나갈까요?";
const LEAVE = "나가기";
const KEEP = "계속 꾸미기";
const TABS = ["모자", "상의", "하의", "신발", "얼굴장식", "등장식", "액세서리"];
/** 03 결정 B3: 빈 부위 문구(받침에 맞춤). */
const EMPTY: Record<string, string> = {
  모자: "아직 가진 모자가 없어요",
  상의: "아직 가진 상의가 없어요",
  하의: "아직 가진 하의가 없어요",
  신발: "아직 가진 신발이 없어요",
  얼굴장식: "아직 가진 얼굴장식이 없어요",
  등장식: "아직 가진 등장식이 없어요",
  액세서리: "아직 가진 액세서리가 없어요"
};
const CAP = "주황 야구모자";
const TSHIRT = "주황 티셔츠";
const SHORTS = "남색 반바지";
const SHOES = "갈색 운동화";

const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const R4_ITEMS = [
  { type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T09:00:00Z" },
  { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T10:00:00Z" },
  { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T11:00:00Z" },
  { type: "shortsNavy", slot: "bottom", acquiredAt: "2026-11-13T12:00:00Z" }
];
const R4_EQUIPPED = { hat: "capOrange", top: "tshirtOrange", bottom: "shortsNavy", shoes: "shoesBrown", face: null, back: null, accessory: null };

function wardrobe(value: unknown): Wardrobe {
  return JSON.parse(JSON.stringify(value)) as Wardrobe;
}

const R0 = () => wardrobe({ items: [], equipped: ALL_NULL });
const R1 = () =>
  wardrobe({ items: [{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" }], equipped: { ...ALL_NULL, hat: "capOrange" } });
const R4 = () => wardrobe({ items: R4_ITEMS, equipped: R4_EQUIPPED });
const R4_NONE = () => wardrobe({ items: R4_ITEMS, equipped: ALL_NULL });
// 작업 089 ⑤ 04-main-decision.md A-2(사용자 결정): capBlue가 앱 목록에 들어와, 모르는 종류의 예를 여전히 모르는 이름 capPurple로 바꿨다.
const RX = () =>
  wardrobe({
    items: [
      { type: "capPurple", slot: "hat", acquiredAt: "2026-11-13T08:00:00Z" },
      { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T09:00:00Z" },
      { type: "glassesRound", slot: "face", acquiredAt: "2026-11-13T10:00:00Z" },
      { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T11:00:00Z" }
    ],
    equipped: { ...ALL_NULL, hat: "capOrange" }
  });
/** 03 결정 B6: 앱이 모르는 종류(glassesRound)를 얼굴장식에 입고 있다. */
const R_UNKNOWN_WORN = () =>
  wardrobe({
    items: [...R4_ITEMS, { type: "glassesRound", slot: "face", acquiredAt: "2026-11-13T13:00:00Z" }],
    equipped: { ...R4_EQUIPPED, face: "glassesRound" }
  });
/** 03 결정 B7: capOrange가 상의 부위로 왔다. */
const R_WRONG_SLOT = () =>
  wardrobe({
    items: [
      { type: "capOrange", slot: "top", acquiredAt: "2026-11-13T09:00:00Z" },
      { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T10:00:00Z" }
    ],
    equipped: ALL_NULL
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

// ---------- 가짜 fetch(진짜 함수를 부를 때) ----------

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

/** 다음 저장은 진짜 함수를 거쳐 서버가 status·body로 답한다(네트워크 오류면 fetch가 거절). */
function saveAnswers(status: number | "network", body?: unknown) {
  if (status === "network") fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
  else fetchMock.mockResolvedValueOnce(respond(status, body));
  jest.mocked(saveWardrobeEquipped).mockImplementationOnce((equipped) => actualApi.saveWardrobeEquipped(equipped));
}

/** 다음 불러오기(꾸미기 화면)는 진짜 함수를 거쳐 서버가 status·body로 답한다. */
function loadAnswers(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(respond(status, body));
  jest.mocked(getWardrobe).mockImplementationOnce(() => actualApi.getWardrobe());
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

/** 미리보기 착용 목록. 미리보기가 그려져 있어야 한다. */
function previewWorn(): string[] {
  expect(mockPreview.mounted).toBeGreaterThan(0);
  const wear = mockPreview.props?.wear;
  return ["hat", "top", "bottom", "shoes"].filter((slot) => wear?.[slot] === true);
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

function closeButton(): Node {
  return inModal().getByRole("button", { name: /닫기/, ...ALL });
}

function hasText(text: string): boolean {
  return screen.queryAllByText(text, ALL).length > 0;
}

function spinnersIn(container: Node): Node[] {
  return container.queryAll((node) => (node.type as unknown) === "ActivityIndicator");
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

async function pressBack() {
  const m = modal();
  await act(async () => {
    (m.props as { onRequestClose?: () => void }).onRequestClose?.();
  });
  await flushAsync();
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

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

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
  fetchMock.mockReset();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
  jest.mocked(getWardrobe).mockReset().mockResolvedValue(R0());
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

// ---------- P3, S-A. 열기·불러오기 ----------

describe("[spec] 089-③ P3·S-A: 홈에서 옷장 '들어가기'로 꾸미기 화면을 열고 불러온다", () => {
  it(
    "P3·SA1: 옷장에 도착해 '들어가기'를 누르면 프레임을 진행하지 않아도 제목 '옷장'인 꾸미기 화면이 열리고, 열린 동안 방을 눌러도 라룹이가 걷지 않는다",
    async () => {
      expect(await arriveAtCloset()).toBeTruthy();
      expect(isOpen()).toBe(false);
      jest.mocked(getWardrobe).mockResolvedValueOnce(R4());
      await pressEnter();
      expect(isOpen()).toBe(true);
      const before = { x: sim().x, z: sim().z };
      await tapHit({ point: { x: 4, z: 8 }, mark: null, onCharacter: false });
      await frames(2);
      expect({ x: sim().x, z: sim().z }).toEqual(before);
    },
    SLOW_TEST_MS
  );

  it(
    "SA2·SA3: 열리는 동안 방 그리기는 멈추고(paused 참), 바뀐 것 없이 닫으면 이어서 그리며(paused 거짓) 미리보기는 더 그려지지 않는다",
    async () => {
      await openCloset(R4());
      expect(canvas().paused).toBe(true);
      expect(mockPreview.mounted).toBe(1);
      await pressNode(closeButton());
      expect(isOpen()).toBe(false);
      expect(canvas().paused).toBe(false);
      expect(mockPreview.mounted).toBe(0);
    },
    SLOW_TEST_MS
  );

  it(
    "SA4: '들어가기'를 누르면 옷장 불러오기가 정확히 한 번 더 불린다",
    async () => {
      await arriveAtCloset();
      const before = jest.mocked(getWardrobe).mock.calls.length;
      jest.mocked(getWardrobe).mockResolvedValueOnce(R4());
      await pressEnter();
      expect(jest.mocked(getWardrobe).mock.calls.length - before).toBe(1);
    },
    SLOW_TEST_MS
  );

  it(
    "SA5: 불러오는 동안 불러오는 중 표시가 있고, 부위 탭은 눌러도 고른 탭이 바뀌지 않으며(비활성), '저장'은 비활성이다",
    async () => {
      const pending = deferred<Wardrobe | null>();
      await openCloset(pending.promise);
      expect(spinnersIn(modal()).length).toBeGreaterThan(0);
      expect(tabs().map(isDisabled)).toEqual(TABS.map(() => true));
      await pressNode(tab("신발"));
      expect(isSelected(tab("신발"))).toBe(false);
      expect(isDisabled(saveButton())).toBe(true);
    },
    SLOW_TEST_MS
  );

  it(
    "SA6: 불러오는 동안 닫기를 누르면 묻지 않고 닫히고 방 그리기가 이어진다",
    async () => {
      const pending = deferred<Wardrobe | null>();
      await openCloset(pending.promise);
      await pressNode(closeButton());
      expect(hasText(CONFIRM)).toBe(false);
      expect(isOpen()).toBe(false);
      expect(canvas().paused).toBe(false);
    },
    SLOW_TEST_MS
  );

  it(
    "SA7: 불러오기가 500(메시지 '서버 오류')이면 '옷장을 불러오지 못했어요'와 '다시 시도'가 보이고 '서버 오류'는 보이지 않는다",
    async () => {
      await arriveAtCloset();
      loadAnswers(500, { message: "서버 오류" });
      await pressEnter();
      expect(hasText(LOAD_FAILED)).toBe(true);
      expect(inModal().queryAllByRole("button", { name: RETRY, ...ALL })).toHaveLength(1);
      expect(hasText("서버 오류")).toBe(false);
    },
    SLOW_TEST_MS
  );

  it(
    "SA8: 불러오기가 500(본문 없음)이면 SA7과 같다",
    async () => {
      await arriveAtCloset();
      loadAnswers(500);
      await pressEnter();
      expect(hasText(LOAD_FAILED)).toBe(true);
      expect(inModal().queryAllByRole("button", { name: RETRY, ...ALL })).toHaveLength(1);
    },
    SLOW_TEST_MS
  );

  it(
    "SA9: 불러오기가 네트워크 오류로 거절되면 '옷장을 불러오지 못했어요'와 '다시 시도'가 보인다",
    async () => {
      await arriveAtCloset();
      jest.mocked(getWardrobe).mockRejectedValueOnce(new TypeError("Network request failed"));
      await pressEnter();
      expect(hasText(LOAD_FAILED)).toBe(true);
      expect(inModal().queryAllByRole("button", { name: RETRY, ...ALL })).toHaveLength(1);
    },
    SLOW_TEST_MS
  );

  it(
    "SA10: 불러오기에 실패한 화면에서 닫기를 누르면 묻지 않고 닫히고 방 그리기가 이어진다",
    async () => {
      await arriveAtCloset();
      loadAnswers(500, { message: "서버 오류" });
      await pressEnter();
      await pressNode(closeButton());
      expect(hasText(CONFIRM)).toBe(false);
      expect(isOpen()).toBe(false);
      expect(canvas().paused).toBe(false);
    },
    SLOW_TEST_MS
  );

  it(
    "SA11: 실패 화면에서 '다시 시도'를 누르면 불러오기가 한 번 더 불리고, R4로 끝나면 실패 문구가 사라지고 부위 탭과 칸이 보인다",
    async () => {
      await arriveAtCloset();
      loadAnswers(500, { message: "서버 오류" });
      await pressEnter();
      const before = jest.mocked(getWardrobe).mock.calls.length;
      jest.mocked(getWardrobe).mockResolvedValueOnce(R4());
      await pressNode(inModal().getByRole("button", { name: RETRY, ...ALL }));
      expect(jest.mocked(getWardrobe).mock.calls.length - before).toBe(1);
      expect(hasText(LOAD_FAILED)).toBe(false);
      expect(tabs().map(labelOf)).toEqual(TABS);
      expect(cellNames()).toEqual([OFF, CAP]);
    },
    SLOW_TEST_MS
  );

  it(
    "SA12: 불러오기가 401(로그인이 풀림)이면 꾸미기 화면이 닫히고 방 그리기가 이어지며 실패 문구는 보이지 않는다",
    async () => {
      await arriveAtCloset();
      loadAnswers(401, { message: "로그인이 필요해요" });
      await pressEnter();
      expect(isOpen()).toBe(false);
      expect(canvas().paused).toBe(false);
      expect(hasText(LOAD_FAILED)).toBe(false);
    },
    SLOW_TEST_MS
  );
});

// ---------- S-B. 라룹이 ----------

describe("[spec] 089-③ S-B: 처음에는 서버에 저장된 입은 것을 입고 있다", () => {
  it.each([
    ["SB1(R4)", R4, ["hat", "top", "bottom", "shoes"]],
    ["SB2(R4-none)", R4_NONE, []],
    ["SB3(R1)", R1, ["hat"]]
  ])("%s: 미리보기 착용 목록이 서버의 입은 것과 같다", async (_name, value, expected) => {
    await openCloset(value());
    expect(previewWorn()).toEqual(expected);
  }, SLOW_TEST_MS);

  it(
    "SB5(가): 동작 줄이기가 꺼져 있으면 미리보기의 reduceMotion이 거짓이다",
    async () => {
      await openCloset(R4());
      expect(mockPreview.props?.reduceMotion).toBe(false);
    },
    SLOW_TEST_MS
  );

  it(
    "SB5(나): 동작 줄이기가 켜져 있으면 미리보기의 reduceMotion이 참이다(동작이 멈춘다)",
    async () => {
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
      await openCloset(R4());
      expect(mockPreview.props?.reduceMotion).toBe(true);
    },
    SLOW_TEST_MS
  );
});

// ---------- S-C. 부위 탭과 칸 ----------

describe("[spec] 089-③ S-C: 부위 탭 일곱과 고른 탭의 칸", () => {
  it(
    "SC1·SC2: 탭은 모자·상의·하의·신발·얼굴장식·등장식·액세서리 순서이고, 처음에는 모자 탭만 골라져 있으며 칸은 '벗기', '주황 야구모자'다",
    async () => {
      await openCloset(R4());
      expect(tabs().map(labelOf)).toEqual(TABS);
      expect(tabs().filter(isSelected).map(labelOf)).toEqual(["모자"]);
      expect(cellNames()).toEqual([OFF, CAP]);
    },
    SLOW_TEST_MS
  );

  it(
    "SC3·SC13: 탭을 고르면 그 부위의 칸만 나온다(상의: 벗기·주황 티셔츠, 하의: 벗기·남색 반바지, 신발: 벗기·갈색 운동화)",
    async () => {
      await openCloset(R4());
      const seen: Record<string, (string | undefined)[]> = {};
      for (const name of ["상의", "하의", "신발"]) {
        await chooseTab(name);
        expect(isSelected(tab(name))).toBe(true);
        seen[name] = cellNames();
      }
      expect(seen).toEqual({ 상의: [OFF, TSHIRT], 하의: [OFF, SHORTS], 신발: [OFF, SHOES] });
    },
    SLOW_TEST_MS
  );

  it(
    "SC4: 아이템 칸마다 이름과 그림(출처가 있는 이미지)이 있고, 네 칸의 그림 출처가 서로 다르다",
    async () => {
      await openCloset(R4());
      const sources: unknown[] = [];
      const pairs: [string, string][] = [
        ["모자", CAP],
        ["상의", TSHIRT],
        ["하의", SHORTS],
        ["신발", SHOES]
      ];
      for (const [tabName, item] of pairs) {
        await chooseTab(tabName);
        const images = cell(item).queryAll((node) => (node.type as unknown) === "Image");
        expect(images).toHaveLength(1);
        const source = (images[0].props as { source?: unknown }).source;
        expect(source == null).toBe(false);
        sources.push(JSON.stringify(source));
      }
      expect(new Set(sources).size).toBe(4);
    },
    SLOW_TEST_MS
  );

  it(
    "SC5: R4에서 모자 탭은 '주황 야구모자'만 고른 표시이고 '벗기'는 아니다",
    async () => {
      await openCloset(R4());
      expect(selectedCells()).toEqual([CAP]);
    },
    SLOW_TEST_MS
  );

  it(
    "SC6: R4-none에서 모자 탭은 '벗기'만 고른 표시다",
    async () => {
      await openCloset(R4_NONE());
      expect(selectedCells()).toEqual([OFF]);
    },
    SLOW_TEST_MS
  );

  it(
    "SC7: R4-none에서 '주황 야구모자'를 누르면 미리보기가 모자를 입고 그 칸이 고른 표시가 되며, 저장은 불리지 않고 홈 착용 목록은 그대로 비어 있다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      expect(previewWorn()).toEqual(["hat"]);
      expect(selectedCells()).toEqual([CAP]);
      expect(saveWardrobeEquipped).not.toHaveBeenCalled();
      expect(homeWorn()).toEqual([]);
    },
    SLOW_TEST_MS
  );

  it(
    "SC8: R4에서 모자 '벗기'를 누르면 미리보기가 상의·하의·신발만 입고 '벗기'가 고른 표시이며, 저장은 불리지 않는다",
    async () => {
      await openCloset(R4());
      await chooseCell(OFF);
      expect(previewWorn()).toEqual(["top", "bottom", "shoes"]);
      expect(selectedCells()).toEqual([OFF]);
      expect(saveWardrobeEquipped).not.toHaveBeenCalled();
    },
    SLOW_TEST_MS
  );

  it(
    "SC9: 모자 벗기 → 상의 탭 벗기 → 모자 탭으로 돌아오면 미리보기는 하의·신발이고 모자 탭의 '벗기'가 고른 표시다",
    async () => {
      await openCloset(R4());
      await chooseCell(OFF);
      await chooseTab("상의");
      await chooseCell(OFF);
      await chooseTab("모자");
      expect(previewWorn()).toEqual(["bottom", "shoes"]);
      expect(selectedCells()).toEqual([OFF]);
    },
    SLOW_TEST_MS
  );

  it(
    "SC10(03 결정 B3): R0에서 일곱 탭마다 칸은 '벗기' 하나로 고른 표시이고, 받침에 맞춘 빈 부위 문구가 보인다",
    async () => {
      await openCloset(R0());
      const seen: Record<string, unknown> = {};
      for (const name of TABS) {
        await chooseTab(name);
        seen[name] = { cells: cellNames(), selected: selectedCells(), empty: hasText(EMPTY[name]) };
      }
      expect(seen).toEqual(Object.fromEntries(TABS.map((name) => [name, { cells: [OFF], selected: [OFF], empty: true }])));
    },
    SLOW_TEST_MS
  );

  it(
    "SC11: R4에서도 얼굴장식·등장식·액세서리 탭은 칸이 '벗기' 하나이고 빈 부위 문구가 보인다",
    async () => {
      await openCloset(R4());
      const seen: Record<string, unknown> = {};
      for (const name of ["얼굴장식", "등장식", "액세서리"]) {
        await chooseTab(name);
        seen[name] = { cells: cellNames(), empty: hasText(EMPTY[name]) };
      }
      expect(seen).toEqual({
        얼굴장식: { cells: [OFF], empty: true },
        등장식: { cells: [OFF], empty: true },
        액세서리: { cells: [OFF], empty: true }
      });
    },
    SLOW_TEST_MS
  );

  it(
    "SC12: 앱이 모르는 종류(RX의 capPurple, glassesRound)는 칸이 없다: 모자는 벗기·주황 야구모자, 얼굴장식은 벗기와 빈 부위 문구, 상의는 벗기·주황 티셔츠",
    async () => {
      await openCloset(RX());
      const seen: Record<string, unknown> = { 모자: cellNames() };
      await chooseTab("얼굴장식");
      seen.얼굴장식 = { cells: cellNames(), empty: hasText(EMPTY.얼굴장식) };
      await chooseTab("상의");
      seen.상의 = cellNames();
      expect(seen).toEqual({ 모자: [OFF, CAP], 얼굴장식: { cells: [OFF], empty: true }, 상의: [OFF, TSHIRT] });
    },
    SLOW_TEST_MS
  );

  it(
    "03 결정 B7: 앱 목록과 부위가 다르게 온 아이템(capOrange가 top으로)은 칸을 만들지 않는다: 상의는 벗기·주황 티셔츠, 모자는 벗기와 빈 부위 문구",
    async () => {
      await openCloset(R_WRONG_SLOT());
      const seen: Record<string, unknown> = { 모자: { cells: cellNames(), empty: hasText(EMPTY.모자) } };
      await chooseTab("상의");
      seen.상의 = cellNames();
      expect(seen).toEqual({ 모자: { cells: [OFF], empty: true }, 상의: [OFF, TSHIRT] });
    },
    SLOW_TEST_MS
  );

  it(
    "I2: 일곱 탭마다 아이콘 그림이 있다",
    async () => {
      await openCloset(R4());
      expect(tabs().map((node) => node.queryAll((n) => (n.type as unknown) === "Image").length > 0)).toEqual(TABS.map(() => true));
    },
    SLOW_TEST_MS
  );
});

// ---------- S-D. 저장 ----------

describe("[spec] 089-③ S-D: '저장'", () => {
  it(
    "SD1·SD2·SD3: 처음에는 '저장'을 누를 수 없고, 모자를 벗기면 누를 수 있으며, 다시 입히면 누를 수 없다",
    async () => {
      await openCloset(R4());
      const states = [isDisabled(saveButton())];
      await pressNode(saveButton());
      expect(saveWardrobeEquipped).not.toHaveBeenCalled();
      await chooseCell(OFF);
      states.push(isDisabled(saveButton()));
      await chooseCell(CAP);
      states.push(isDisabled(saveButton()));
      expect(states).toEqual([true, false, true]);
    },
    SLOW_TEST_MS
  );

  it(
    "SD4: R4-none에서 모자 '주황 야구모자'와 신발 '갈색 운동화'를 고르고 저장하면 일곱 부위를 한 번 보낸다",
    async () => {
      await openCloset(R4_NONE());
      jest.mocked(saveWardrobeEquipped).mockReturnValueOnce(deferred<Wardrobe>().promise);
      await chooseCell(CAP);
      await chooseTab("신발");
      await chooseCell(SHOES);
      await pressNode(saveButton());
      expect(savedBodies()).toEqual([{ hat: "capOrange", top: null, bottom: null, shoes: "shoesBrown", face: null, back: null, accessory: null }]);
    },
    SLOW_TEST_MS
  );

  it(
    "SD5: R4에서 모자 '벗기' 뒤 저장하면 모자만 null인 일곱 부위를 보낸다",
    async () => {
      await openCloset(R4());
      jest.mocked(saveWardrobeEquipped).mockReturnValueOnce(deferred<Wardrobe>().promise);
      await chooseCell(OFF);
      await pressNode(saveButton());
      expect(savedBodies()).toEqual([{ hat: null, top: "tshirtOrange", bottom: "shortsNavy", shoes: "shoesBrown", face: null, back: null, accessory: null }]);
    },
    SLOW_TEST_MS
  );

  it(
    "SD6: 진짜 저장 함수로 보내면 경로 /api/wardrobe/equipped, 방법 PUT, 본문 JSON이 SD4의 값이다",
    async () => {
      await openCloset(R4_NONE());
      const saved = wardrobe({ items: R4_ITEMS, equipped: { ...ALL_NULL, hat: "capOrange", shoes: "shoesBrown" } });
      saveAnswers(200, saved);
      await chooseCell(CAP);
      await chooseTab("신발");
      await chooseCell(SHOES);
      await pressNode(saveButton());
      const puts = fetchMock.mock.calls.filter(([url]) => new URL(url).pathname === "/api/wardrobe/equipped");
      expect(puts).toHaveLength(1);
      const [, init] = puts[0];
      expect({ method: init?.method, body: JSON.parse(String(init?.body)) }).toEqual({
        method: "PUT",
        body: { hat: "capOrange", top: null, bottom: null, shoes: "shoesBrown", face: null, back: null, accessory: null }
      });
    },
    SLOW_TEST_MS
  );

  it(
    "SD7: 보내는 동안 저장·닫기·칸·뒤로 버튼을 눌러도 저장은 한 번뿐이고, 화면은 닫히지 않고 묻지도 않으며, 미리보기는 모자·신발 그대로다",
    async () => {
      await openCloset(R4_NONE());
      jest.mocked(saveWardrobeEquipped).mockReturnValueOnce(deferred<Wardrobe>().promise);
      await chooseCell(CAP);
      await chooseTab("신발");
      await chooseCell(SHOES);
      await pressNode(saveButton());
      await pressNode(saveButton());
      await pressNode(closeButton());
      await pressNode(cell(OFF));
      await pressNode(cell(SHOES));
      await pressBack();
      expect(saveWardrobeEquipped).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(true);
      expect(hasText(CONFIRM)).toBe(false);
      expect(previewWorn()).toEqual(["hat", "shoes"]);
    },
    SLOW_TEST_MS
  );

  it(
    "SD8: 저장에 성공하면 화면이 닫히고 방 그리기가 이어지며, 홈의 다음 불러오기가 끝나기 전에 홈 착용 목록이 모자·신발이다",
    async () => {
      await openCloset(R4_NONE());
      expect(homeWorn()).toEqual([]);
      jest.mocked(getWardrobe).mockImplementation(() => deferred<Wardrobe | null>().promise);
      jest
        .mocked(saveWardrobeEquipped)
        .mockResolvedValueOnce(wardrobe({ items: R4_ITEMS, equipped: { ...ALL_NULL, hat: "capOrange", shoes: "shoesBrown" } }));
      await chooseCell(CAP);
      await chooseTab("신발");
      await chooseCell(SHOES);
      await pressNode(saveButton());
      expect(isOpen()).toBe(false);
      expect(canvas().paused).toBe(false);
      expect(homeWorn()).toEqual(["hat", "shoes"]);
    },
    SLOW_TEST_MS
  );

  it(
    "SD9: 저장이 400 WARDROBE_INVALID면 '입을 수 없는 아이템이 있어요'가 보이고(서버 메시지 아님) 다시 불러와 R0으로 돌아가며, 화면은 열린 채 '저장'을 누를 수 없다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      saveAnswers(400, { code: "WARDROBE_INVALID", message: "입을 수 없는 아이템이에요" });
      const before = jest.mocked(getWardrobe).mock.calls.length;
      jest.mocked(getWardrobe).mockResolvedValueOnce(R0());
      await pressNode(saveButton());
      expect(hasText(SAVE_INVALID)).toBe(true);
      expect(hasText("입을 수 없는 아이템이에요")).toBe(false);
      expect(jest.mocked(getWardrobe).mock.calls.length - before).toBe(1);
      expect(isOpen()).toBe(true);
      expect({ cells: cellNames(), empty: hasText(EMPTY.모자), worn: previewWorn(), saveOff: isDisabled(saveButton()) }).toEqual({
        cells: [OFF],
        empty: true,
        worn: [],
        saveOff: true
      });
    },
    SLOW_TEST_MS
  );

  it(
    "SD10: 400 WARDROBE_INVALID 뒤 다시 불러온 값이 R1이면 미리보기는 모자, 모자 탭은 '주황 야구모자'가 고른 표시, 신발 탭은 벗기와 빈 부위 문구, '저장'은 못 누른다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      await chooseTab("신발");
      await chooseCell(SHOES);
      saveAnswers(400, { code: "WARDROBE_INVALID", message: "입을 수 없는 아이템이에요" });
      jest.mocked(getWardrobe).mockResolvedValueOnce(R1());
      await pressNode(saveButton());
      expect(previewWorn()).toEqual(["hat"]);
      expect(isDisabled(saveButton())).toBe(true);
      await chooseTab("모자");
      expect(selectedCells()).toEqual([CAP]);
      await chooseTab("신발");
      expect({ cells: cellNames(), empty: hasText(EMPTY.신발) }).toEqual({ cells: [OFF], empty: true });
    },
    SLOW_TEST_MS
  );

  it(
    "SD11: 저장이 500(메시지 '잠시 후 다시 해 주세요')이면 그 메시지가 보이고, 화면은 열린 채 고른 것 그대로, '저장'을 다시 누를 수 있으며 다시 불러오지 않는다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      saveAnswers(500, { message: "잠시 후 다시 해 주세요" });
      const before = jest.mocked(getWardrobe).mock.calls.length;
      await pressNode(saveButton());
      expect(hasText("잠시 후 다시 해 주세요")).toBe(true);
      expect({ open: isOpen(), worn: previewWorn(), selected: selectedCells(), saveOff: isDisabled(saveButton()) }).toEqual({
        open: true,
        worn: ["hat"],
        selected: [CAP],
        saveOff: false
      });
      expect(jest.mocked(getWardrobe).mock.calls.length).toBe(before);
    },
    SLOW_TEST_MS
  );

  it(
    "SD12: 저장이 500(본문 없음)이면 '입지 못했어요. 다시 시도해 주세요'가 보이고 나머지는 SD11과 같다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      saveAnswers(500);
      const before = jest.mocked(getWardrobe).mock.calls.length;
      await pressNode(saveButton());
      expect(hasText(SAVE_FAILED)).toBe(true);
      expect({ open: isOpen(), worn: previewWorn(), selected: selectedCells(), saveOff: isDisabled(saveButton()) }).toEqual({
        open: true,
        worn: ["hat"],
        selected: [CAP],
        saveOff: false
      });
      expect(jest.mocked(getWardrobe).mock.calls.length).toBe(before);
    },
    SLOW_TEST_MS
  );

  it(
    "SD13: 저장이 400이지만 다른 코드(BAD_REQUEST, '요청이 잘못됐어요')면 그 메시지가 보이고 고른 것 그대로, 다시 불러오지 않는다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      saveAnswers(400, { code: "BAD_REQUEST", message: "요청이 잘못됐어요" });
      const before = jest.mocked(getWardrobe).mock.calls.length;
      await pressNode(saveButton());
      expect(hasText("요청이 잘못됐어요")).toBe(true);
      expect({ open: isOpen(), worn: previewWorn(), selected: selectedCells() }).toEqual({ open: true, worn: ["hat"], selected: [CAP] });
      expect(jest.mocked(getWardrobe).mock.calls.length).toBe(before);
    },
    SLOW_TEST_MS
  );

  it(
    "SD14(03 결정 B4): 저장 중 네트워크 오류면 '입지 못했어요. 다시 시도해 주세요'가 보이고, 화면은 열린 채 고른 것 그대로, '저장'을 다시 누를 수 있다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      saveAnswers("network");
      await pressNode(saveButton());
      expect(hasText(SAVE_FAILED)).toBe(true);
      expect({ open: isOpen(), worn: previewWorn(), selected: selectedCells(), saveOff: isDisabled(saveButton()) }).toEqual({
        open: true,
        worn: ["hat"],
        selected: [CAP],
        saveOff: false
      });
    },
    SLOW_TEST_MS
  );

  it(
    "SD15(03 결정 B5): 저장이 401이면 화면을 닫고 홈으로 돌아가며(방 그리기 이어짐), 홈 착용 목록은 열기 전 그대로다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      saveAnswers(401, { message: "로그인이 필요해요" });
      await pressNode(saveButton());
      expect(isOpen()).toBe(false);
      expect(canvas().paused).toBe(false);
      expect(homeWorn()).toEqual([]);
    },
    SLOW_TEST_MS
  );

  it(
    "SD16: 500으로 실패한 뒤 다시 저장해 성공하면 화면이 닫히고 홈 착용 목록이 모자 하나다",
    async () => {
      await openCloset(R4_NONE());
      await chooseCell(CAP);
      saveAnswers(500, { message: "잠시 후 다시 해 주세요" });
      await pressNode(saveButton());
      expect(isOpen()).toBe(true);
      jest.mocked(saveWardrobeEquipped).mockResolvedValueOnce(wardrobe({ items: R4_ITEMS, equipped: { ...ALL_NULL, hat: "capOrange" } }));
      await pressNode(saveButton());
      expect(isOpen()).toBe(false);
      expect(homeWorn()).toEqual(["hat"]);
    },
    SLOW_TEST_MS
  );

  it(
    "03 결정 B6(가): 앱이 모르는 종류를 얼굴장식에 입고 있으면 얼굴장식 탭은 아무 칸도 고른 표시가 아니고('벗기'도 아님), 모자만 벗겨 저장하면 얼굴장식은 서버 값 그대로 보낸다",
    async () => {
      await openCloset(R_UNKNOWN_WORN());
      jest.mocked(saveWardrobeEquipped).mockReturnValueOnce(deferred<Wardrobe>().promise);
      await chooseTab("얼굴장식");
      expect(selectedCells()).toEqual([]);
      await chooseTab("모자");
      await chooseCell(OFF);
      await pressNode(saveButton());
      expect(savedBodies()).toEqual([{ ...R4_EQUIPPED, hat: null, face: "glassesRound" }]);
    },
    SLOW_TEST_MS
  );

  it(
    "03 결정 B6(나): 그 얼굴장식 탭에서 '벗기'를 고르면 '벗기'가 고른 표시가 되고, 저장하면 얼굴장식을 null로 보낸다",
    async () => {
      await openCloset(R_UNKNOWN_WORN());
      jest.mocked(saveWardrobeEquipped).mockReturnValueOnce(deferred<Wardrobe>().promise);
      await chooseTab("얼굴장식");
      await chooseCell(OFF);
      expect(selectedCells()).toEqual([OFF]);
      await pressNode(saveButton());
      expect(savedBodies()).toEqual([{ ...R4_EQUIPPED, face: null }]);
    },
    SLOW_TEST_MS
  );
});

// ---------- S-E. 닫기 ----------

describe("[spec] 089-③ S-E: 닫기", () => {
  it(
    "SE1: 바뀐 것이 없으면 닫기로 묻지 않고 바로 닫히고, 저장은 불리지 않으며 홈 착용 목록은 열기 전 그대로다",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(R4());
      await openCloset(R4());
      expect(homeWorn()).toEqual(["hat", "top", "bottom", "shoes"]);
      await pressNode(closeButton());
      expect(hasText(CONFIRM)).toBe(false);
      expect(isOpen()).toBe(false);
      expect(saveWardrobeEquipped).not.toHaveBeenCalled();
      expect(homeWorn()).toEqual(["hat", "top", "bottom", "shoes"]);
    },
    SLOW_TEST_MS
  );

  it(
    "SE2: 바꾼 뒤 닫기를 누르면 화면이 닫히지 않고 '저장하지 않고 나갈까요?'와 '나가기', '계속 꾸미기'가 보인다",
    async () => {
      await openCloset(R4());
      await chooseCell(OFF);
      await pressNode(closeButton());
      expect(isOpen()).toBe(true);
      expect(hasText(CONFIRM)).toBe(true);
      expect(inModal().queryAllByRole("button", { name: LEAVE, ...ALL })).toHaveLength(1);
      expect(inModal().queryAllByRole("button", { name: KEEP, ...ALL })).toHaveLength(1);
    },
    SLOW_TEST_MS
  );

  it(
    "SE3: '나가기'를 누르면 화면이 닫히고 저장은 불리지 않으며 홈 착용 목록은 열기 전(넷 다) 그대로다",
    async () => {
      jest.mocked(getWardrobe).mockResolvedValue(R4());
      await openCloset(R4());
      await chooseCell(OFF);
      await pressNode(closeButton());
      await pressNode(inModal().getByRole("button", { name: LEAVE, ...ALL }));
      expect(isOpen()).toBe(false);
      expect(saveWardrobeEquipped).not.toHaveBeenCalled();
      expect(homeWorn()).toEqual(["hat", "top", "bottom", "shoes"]);
    },
    SLOW_TEST_MS
  );

  it(
    "SE4: '계속 꾸미기'를 누르면 묻는 글이 사라지고 화면은 열린 채, 미리보기는 상의·하의·신발 그대로이고 '저장'을 누를 수 있다",
    async () => {
      await openCloset(R4());
      await chooseCell(OFF);
      await pressNode(closeButton());
      await pressNode(inModal().getByRole("button", { name: KEEP, ...ALL }));
      expect({ confirm: hasText(CONFIRM), open: isOpen(), worn: previewWorn(), saveOff: isDisabled(saveButton()) }).toEqual({
        confirm: false,
        open: true,
        worn: ["top", "bottom", "shoes"],
        saveOff: false
      });
    },
    SLOW_TEST_MS
  );

  it(
    "SE5: 모자를 벗겼다 다시 입혀 바뀐 것이 없으면 닫기로 묻지 않고 바로 닫힌다",
    async () => {
      await openCloset(R4());
      await chooseCell(OFF);
      await chooseCell(CAP);
      await pressNode(closeButton());
      expect(hasText(CONFIRM)).toBe(false);
      expect(isOpen()).toBe(false);
    },
    SLOW_TEST_MS
  );

  it(
    "SE6: 바뀐 것이 없을 때 안드로이드 뒤로 버튼은 닫기와 같다(묻지 않고 닫힘)",
    async () => {
      await openCloset(R4());
      await pressBack();
      expect(hasText(CONFIRM)).toBe(false);
      expect(isOpen()).toBe(false);
      expect(saveWardrobeEquipped).not.toHaveBeenCalled();
    },
    SLOW_TEST_MS
  );

  it(
    "SE7: 바뀐 것이 있을 때 안드로이드 뒤로 버튼은 닫기와 같다(닫히지 않고 묻는다)",
    async () => {
      await openCloset(R4());
      await chooseCell(OFF);
      await pressBack();
      expect(isOpen()).toBe(true);
      expect(hasText(CONFIRM)).toBe(true);
    },
    SLOW_TEST_MS
  );

  it(
    "SE8(가): 바뀐 것 없이 닫고 몇 초 지나도 라룹이는 옷장 앞 도착한 자리에서 0.05칸 안이다",
    async () => {
      const at = await openCloset(R4());
      await pressNode(closeButton());
      await frames(3);
      expect(Math.hypot(sim().x - at.x, sim().z - at.z)).toBeLessThanOrEqual(0.05);
    },
    SLOW_TEST_MS
  );

  it(
    "SE8(나): 저장에 성공해 닫히고 몇 초 지나도 라룹이는 옷장 앞 도착한 자리에서 0.05칸 안이다",
    async () => {
      const at = await openCloset(R4_NONE());
      jest.mocked(saveWardrobeEquipped).mockResolvedValueOnce(wardrobe({ items: R4_ITEMS, equipped: { ...ALL_NULL, hat: "capOrange" } }));
      await chooseCell(CAP);
      await pressNode(saveButton());
      expect(isOpen()).toBe(false);
      await frames(3);
      expect(Math.hypot(sim().x - at.x, sim().z - at.z)).toBeLessThanOrEqual(0.05);
    },
    SLOW_TEST_MS
  );

  it(
    "SE8(다): 바꾼 뒤 '나가기'로 닫고 몇 초 지나도 라룹이는 옷장 앞 도착한 자리에서 0.05칸 안이다",
    async () => {
      const at = await openCloset(R4());
      await chooseCell(OFF);
      await pressNode(closeButton());
      await pressNode(inModal().getByRole("button", { name: LEAVE, ...ALL }));
      expect(isOpen()).toBe(false);
      await frames(3);
      expect(Math.hypot(sim().x - at.x, sim().z - at.z)).toBeLessThanOrEqual(0.05);
    },
    SLOW_TEST_MS
  );

  it(
    "SE9: '나가기'로 버린 뒤 다시 '들어가기'로 열어 R4를 받으면 미리보기는 넷이고 '저장'을 누를 수 없다(버린 고름이 남지 않음)",
    async () => {
      await openCloset(R4());
      await chooseCell(OFF);
      await pressNode(closeButton());
      await pressNode(inModal().getByRole("button", { name: LEAVE, ...ALL }));
      expect(isOpen()).toBe(false);
      await frames(0.5);
      jest.mocked(getWardrobe).mockResolvedValueOnce(R4());
      await pressEnter();
      expect(isOpen()).toBe(true);
      expect(previewWorn()).toEqual(["hat", "top", "bottom", "shoes"]);
      expect(isDisabled(saveButton())).toBe(true);
    },
    SLOW_TEST_MS
  );
});

