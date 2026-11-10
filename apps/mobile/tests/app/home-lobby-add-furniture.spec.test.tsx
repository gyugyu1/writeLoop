// [spec] qa 테스트(작업 066-⑤ 새 가구, 새 기능, 모바일): 홈 '꾸미기'의 보관함 판에서 '가구 더하기'로 새 가구를 놓고,
// 안내(자리 없음·빨간 가구 먼저·40개)와 취소·완료가 더한 가구를 다루는지, 협탁을 치울 때 위 소품이 보관함에 함께 들어가는지 화면 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 066/06-새-가구/03-qa-scenarios.md의 N1~N4·N11·N13·N14·N16·N18~N20, S1~S3·S5·S6, K3·K4)에서만 가져온다.
// 같은 폴더 04-main-decision.md의 결정 3은 부르는 방법으로만 쓴다: '가구 더하기' 줄의 접근성 이름은 "<가구 이름> 더하기"다.
// 구현(24995ee)에서 읽은 것은 부르는 방법뿐이다: 판의 '가구 더하기' 제목 글, 줄 버튼, 3D 그리기가 받는 edit의 layout·lifted, 버튼 이름("돌리기", "치우기").
// 가짜로 두는 것은 기존 보관함 테스트(home-lobby-storage.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기).
// 3D 그리기는 가짜라서 어느 가구를 눌렀는지는 누르기 결과의 piece로 그대로 넣어 보낸다. 엔진 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import {
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getLobbyLayout,
  getMobileHomeSnapshot,
  getMonthWritingStatus,
  getTodayWritingStatus,
  getWritingDraft,
  saveLobbyLayout,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { activeLobbyLayout, applyLobbyLayout, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
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
jest.mock("@/lib/api", () => ({
  getDiaryCalendarSummary: jest.fn(),
  getFeaturedDailyPrompt: jest.fn(),
  getLobbyLayout: jest.fn(),
  getMobileHomeSnapshot: jest.fn(),
  getMonthWritingStatus: jest.fn(),
  getTodayWritingStatus: jest.fn(),
  getWritingDraft: jest.fn(),
  saveLobbyLayout: jest.fn(),
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

// ---------- 글(시나리오 0절, 명세 그대로) ----------

const GUIDE = "가구를 눌러 고르고, 끌어서 옮겨요";
const RED_FIRST = "빨간 가구부터 옮겨 주세요";
const NO_ROOM = "놓을 자리가 없어요. 가구를 옮기거나 치운 뒤 다시 꺼내 주세요";
const LIMIT = "가구는 40개까지 둘 수 있어요";
const STORAGE_EMPTY = "보관함이 비었어요";
const ADD_TITLE = "가구 더하기";
/** 명세 2: 지금 '가구 더하기'에 보일 종류(치울 수 있는 모든 종류). */
const ADDABLE_NAMES = ["옷장", "깔개", "스탠드", "침대", "협탁", "바닥 스탠드", "화분", "작은 화분", "책", "액자"];

// ---------- 배치(시나리오 0절) ----------

type LayoutItem = LobbyLayout["items"][number];
type Facing = 0 | 1 | 2 | 3;
type Stored = { id: string; type: string };

const floor = (id: string, type: string, x: number, z: number, facing: Facing = 0): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });
const on = (id: string, type: string, parent: string, slot: number, facing: Facing = 0): LayoutItem => ({ id, type, on: { parent, slot, facing } }) as LayoutItem;

const N0_ITEMS: LayoutItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8),
  on("lamp", "lamp", "desk", 0, 0)
];
const NS1 = floor("nightstand-1", "nightstand", 3.5, 5.5, 0);
const LNS_ITEMS: LayoutItem[] = [...N0_ITEMS, NS1, on("smallPlant-1", "smallPlant", "nightstand-1", 0)];
const LNS_STORED: Stored[] = [{ id: "wardrobe-1", type: "wardrobe" }];

function layout(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  const value = stored.length > 0 ? { items, stored } : { items };
  return JSON.parse(JSON.stringify(value)) as LobbyLayout;
}

const N0 = layout(N0_ITEMS);

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

function hit(point: FloorPoint | null, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

async function pointer(phase: "down" | "move" | "up" | "cancel", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

async function tapHit(h: PointerHit) {
  await pointer("down", h, 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

function expectEditing() {
  expect(screen.getByText(GUIDE)).toBeTruthy();
}

function expectNotEditing() {
  expect(screen.queryByText(GUIDE)).toBeNull();
  expect(screen.getByText("꾸미기")).toBeTruthy();
}

function editLayout(): LobbyLayout {
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  return edit!.layout;
}

function lifted(): string | null {
  return canvas().edit?.lifted ?? null;
}

function byId<T extends { id: string }>(list: readonly T[] | null | undefined): T[] {
  return [...(list ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 보관함(순서 그대로). */
function storedOf(value: LobbyLayout | null | undefined): Stored[] {
  return ((value as { stored?: Stored[] } | null | undefined)?.stored ?? []).map((s) => ({ id: s.id, type: s.type }));
}

function itemIn(value: LobbyLayout, id: string) {
  return value.items.find((item) => item.id === id);
}

function storageButton(): UiNode {
  return screen.getByRole("button", { name: /보관함/ });
}

function storageBadge(): number | null {
  const digits = within(storageButton()).queryAllByText(/\d/);
  if (digits.length === 0) return null;
  const text = ([] as unknown[]).concat(digits[0].props.children).join("");
  return Number(text.match(/\d+/)![0]);
}

async function openStorage() {
  await fireEvent.press(storageButton());
  await flushAsync();
}

const FURNITURE_NAMES = FURNITURE_TYPES.map((type) => type.name);

/** 버튼(또는 그 조상)의 접근성 이름. */
function labelOf(node: UiNode): string | null {
  const label = (node.props as { accessibilityLabel?: unknown }).accessibilityLabel;
  return typeof label === "string" ? label : null;
}

/** '가구 더하기' 묶음의 줄(접근성 이름 "<가구 이름> 더하기", 결정 3). 화면 순서대로다. */
function addRows(): UiNode[] {
  return screen.getAllByRole("button").filter((button) => labelOf(button)?.endsWith(" 더하기") ?? false);
}

/** 줄에 보이는 가구 이름. */
function rowName(row: UiNode): string {
  const names = FURNITURE_NAMES.filter((name) => within(row).queryByText(name) !== null);
  expect(names).toHaveLength(1);
  return names[0];
}

/** '보관함' 묶음의 줄: 가구 이름 글을 가진 버튼 가운데 '가구 더하기' 줄이 아닌 것(화면 순서대로). */
function storageRows(): UiNode[] {
  return screen
    .getAllByRole("button")
    .filter((button) => !(labelOf(button)?.endsWith(" 더하기") ?? false) && FURNITURE_NAMES.some((name) => within(button).queryByText(name) !== null));
}

function storageRow(name: string): UiNode {
  const rows = storageRows().filter((row) => rowName(row) === name);
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function addFurniture(name: string) {
  await fireEvent.press(screen.getByRole("button", { name: `${name} 더하기` }));
  await flushAsync();
}

async function openAndAdd(name: string) {
  await openStorage();
  await addFurniture(name);
}

function expectPanelClosed() {
  expect(screen.queryByText(ADD_TITLE)).toBeNull();
  expect(addRows()).toHaveLength(0);
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(
    () => ({ remove: () => undefined }) as ReturnType<typeof BackHandler.addEventListener>
  );
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  // 저장 성공 때 서버는 보낸 배치를 그대로 돌려준다
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (value: LobbyLayout) => JSON.parse(JSON.stringify(value)));
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
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- N. 가구 더하기 ----------

describe("[spec] 066-⑤ 명세 2: 가구 더하기(N, 화면)", () => {
  test("N1 보관함이 빈 N0에서 판을 열면 '보관함이 비었어요'가 보이고 '가구 더하기' 줄이 10개다", async () => {
    await renderHome(N0);
    await enterEdit();
    await openStorage();

    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(screen.getByText(ADD_TITLE)).toBeTruthy();
    expect(addRows()).toHaveLength(10);
  });

  test("N2 '가구 더하기' 줄은 치울 수 있는 열 종류를 카탈로그 순서로 보이고, 장소 가구 줄과 개수(×N)가 없다", async () => {
    await renderHome(N0);
    await enterEdit();
    await openStorage();

    const names = addRows().map(rowName);
    expect([...names].sort()).toEqual([...ADDABLE_NAMES].sort());
    expect(names).toEqual(FURNITURE_TYPES.filter((type) => type.removable).map((type) => type.name));
    for (const name of ["일기 책상", "책장", "오늘의 질문 게시판", "창문"]) expect(names).not.toContain(name);
    for (const row of addRows()) expect(within(row).queryAllByText(/×/)).toHaveLength(0);
  });

  test("N3 보관함 [wardrobe-1, wardrobe-2, rug-1]이면 '보관함' 묶음은 '옷장 ×2'와 '깔개'(× 없음), '가구 더하기'는 N2와 같다", async () => {
    await renderHome(
      layout(N0_ITEMS, [
        { id: "wardrobe-1", type: "wardrobe" },
        { id: "wardrobe-2", type: "wardrobe" },
        { id: "rug-1", type: "rug" }
      ])
    );
    await enterEdit();
    await openStorage();

    expect(storageRows().map(rowName)).toEqual(["옷장", "깔개"]);
    expect(within(storageRow("옷장")).getByText("×2")).toBeTruthy();
    expect(within(storageRow("깔개")).queryAllByText(/×/)).toHaveLength(0);
    expect(addRows().map(rowName)).toEqual(FURNITURE_TYPES.filter((type) => type.removable).map((type) => type.name));
  });

  test("N4 '침대'를 누르면 판이 닫히고 bed-1이 (4, 5.5, 0)에 놓여 골라지며(돌리기·치우기 보임) 보관함은 그대로다", async () => {
    await renderHome(N0);
    await enterEdit();

    await openAndAdd("침대");

    expectPanelClosed();
    expect(byId(editLayout().items)).toEqual(byId([...N0_ITEMS, floor("bed-1", "bed", 4, 5.5, 0)]));
    expect(lifted()).toBe("bed-1");
    expect(screen.queryByRole("button", { name: "돌리기" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "치우기" })).not.toBeNull();
    expect(storedOf(editLayout())).toEqual([]);
    expect(storageBadge()).toBeNull();
  });

  test("N11 받침 가구 자리가 다 찼으면 '책'을 눌러도 만들지 않고 자리 없음 안내가 뜬다", async () => {
    const start = layout([...N0_ITEMS, on("smallPlant-1", "smallPlant", "desk", 1), on("books-1", "books", "desk", 2)]);
    await renderHome(start);
    await enterEdit();

    await openAndAdd("책");

    expect(screen.getByText(NO_ROOM)).toBeTruthy();
    expect(byId(editLayout().items)).toEqual(byId(start.items));
    expect(storedOf(editLayout())).toEqual([]);
  });

  test("N13 침대를 더해 돌려 빨갛게 한 뒤 '화분'을 누르면 만들지 않고 빨간 가구 먼저 안내가 뜬다", async () => {
    await renderHome(N0);
    await enterEdit();
    await openAndAdd("침대");
    await pressButton("돌리기");
    expect(canvas().edit!.marks.some((mark) => !mark.ok)).toBe(true);
    const before = editLayout();

    await openAndAdd("화분");

    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expect(editLayout()).toEqual(before);
    expect(itemIn(editLayout(), "plant-1")).toBeUndefined();
  });

  test("N14 방과 보관함을 합쳐 40개면 '침대'를 눌러도 만들지 않고 '가구는 40개까지 둘 수 있어요'가 뜬다", async () => {
    const stored = Array.from({ length: 33 }, (_, i) => ({ id: `wardrobe-${i + 1}`, type: "wardrobe" }));
    await renderHome(layout(N0_ITEMS, stored));
    await enterEdit();

    await openAndAdd("침대");

    expect(screen.getByText(LIMIT)).toBeTruthy();
    expect(byId(editLayout().items)).toEqual(byId(N0_ITEMS));
    expect(storedOf(editLayout())).toEqual(stored);
  });

  test("N16 '협탁'을 더한 직후 돌리기를 누르면 nightstand-1의 방향이 1이다", async () => {
    await renderHome(N0);
    await enterEdit();
    await openAndAdd("협탁");
    expect(lifted()).toBe("nightstand-1");

    await pressButton("돌리기");

    expect(itemIn(editLayout(), "nightstand-1")!.floor!.facing).toBe(1);
  });

  test("N18 더한 직후에는 엔진의 지금 배치에 bed-1이 없다", async () => {
    await renderHome(N0);
    await enterEdit();

    await openAndAdd("침대");

    expect(itemIn(editLayout(), "bed-1")).toBeDefined();
    expect(itemIn(activeLobbyLayout(), "bed-1")).toBeUndefined();
  });

  test("N19 더한 뒤 '취소'하면 저장하지 않고 지금 배치는 N0이며, 다시 들어가 '침대'를 누르면 또 bed-1이다", async () => {
    await renderHome(N0);
    await enterEdit();
    await openAndAdd("침대");

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expectNotEditing();
    expect(byId(activeLobbyLayout().items)).toEqual(byId(N0_ITEMS));
    await enterEdit();
    expectEditing();
    expect(itemIn(editLayout(), "bed-1")).toBeUndefined();
    await openAndAdd("침대");
    expect(itemIn(editLayout(), "bed-1")).toEqual(floor("bed-1", "bed", 4, 5.5, 0));
  });

  test("N20 더한 뒤 '완료'하면 저장이 한 번 불리고 보낸 방은 N0 + bed-1(보관함 없음)이며, 나온 뒤 지금 배치에 bed-1이 있다", async () => {
    await renderHome(N0);
    await enterEdit();
    await openAndAdd("침대");

    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const sent = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(byId(sent.items)).toEqual(byId([...N0_ITEMS, floor("bed-1", "bed", 4, 5.5, 0)]));
    expect(storedOf(sent)).toEqual([]);
    expectNotEditing();
    expect(itemIn(activeLobbyLayout(), "bed-1")).toEqual(floor("bed-1", "bed", 4, 5.5, 0));
  });
});

// ---------- S. 받침 가구를 치울 때 ----------

describe("[spec] 066-⑤ 명세 3: 받침 가구를 치울 때(S, 화면)", () => {
  async function storeNightstand() {
    await renderHome(layout(LNS_ITEMS, LNS_STORED));
    await enterEdit();
    await tapHit(hit({ x: 3.5, z: 5.5 }, "nightstand-1"));
    expect(lifted()).toBe("nightstand-1");
    await pressButton("치우기");
  }

  test("S1 L-NS에서 협탁을 치우면 협탁과 작은 화분이 빠지고 보관함이 [wardrobe-1, nightstand-1, smallPlant-1], 개수 3이다", async () => {
    await storeNightstand();

    expect(itemIn(editLayout(), "nightstand-1")).toBeUndefined();
    expect(itemIn(editLayout(), "smallPlant-1")).toBeUndefined();
    expect(storedOf(editLayout())).toEqual([
      { id: "wardrobe-1", type: "wardrobe" },
      { id: "nightstand-1", type: "nightstand" },
      { id: "smallPlant-1", type: "smallPlant" }
    ]);
    expect(lifted()).toBeNull();
    expect(storageBadge()).toBe(3);
  });

  test("S2 이어서 판을 열면 '보관함' 묶음 줄이 옷장·협탁·작은 화분 순서다", async () => {
    await storeNightstand();

    await openStorage();

    expect(storageRows().map(rowName)).toEqual(["옷장", "협탁", "작은 화분"]);
  });

  test("S3 이어서 '보관함' 묶음의 '협탁'을 누르면 (3.5, 5.5, 0)에 빈 채로 놓이고 골라지며 보관함은 [wardrobe-1, smallPlant-1]이다", async () => {
    await storeNightstand();
    await openStorage();

    await fireEvent.press(storageRow("협탁"));
    await flushAsync();

    expect(itemIn(editLayout(), "nightstand-1")).toEqual(NS1);
    expect(editLayout().items.filter((item) => item.on?.parent === "nightstand-1")).toEqual([]);
    expect(lifted()).toBe("nightstand-1");
    expect(storedOf(editLayout())).toEqual([
      { id: "wardrobe-1", type: "wardrobe" },
      { id: "smallPlant-1", type: "smallPlant" }
    ]);
  });

  test("S5 협탁을 치운 뒤 '취소'하면 저장하지 않고 지금 배치는 L-NS 그대로다", async () => {
    await storeNightstand();

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(byId(activeLobbyLayout().items)).toEqual(byId(LNS_ITEMS));
    expect(storedOf(activeLobbyLayout())).toEqual(LNS_STORED);
  });

  test("S6 협탁을 치운 뒤 '완료'하면 보낸 보관함이 [wardrobe-1, nightstand-1, smallPlant-1] 순서이고 방에 둘 다 없으며 본문 검사를 통과한다", async () => {
    await storeNightstand();

    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const sent = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(storedOf(sent)).toEqual([
      { id: "wardrobe-1", type: "wardrobe" },
      { id: "nightstand-1", type: "nightstand" },
      { id: "smallPlant-1", type: "smallPlant" }
    ]);
    expect(itemIn(sent, "nightstand-1")).toBeUndefined();
    expect(itemIn(sent, "smallPlant-1")).toBeUndefined();
    expect(parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(sent))))).not.toBeNull();
  });
});

// ---------- K. 그대로여야 할 동작 ----------

describe("[spec] 066-⑤ 명세 5: 그대로여야 할 동작(K, 화면)", () => {
  test("K3 N0 + 보관함 [wardrobe-1]에서 '보관함' 묶음의 '옷장'을 누르면 wardrobe-1이 (3.5, 5.5, 0)에 놓인다", async () => {
    await renderHome(layout(N0_ITEMS, [{ id: "wardrobe-1", type: "wardrobe" }]));
    await enterEdit();
    await openStorage();

    await fireEvent.press(storageRow("옷장"));
    await flushAsync();

    expect(itemIn(editLayout(), "wardrobe-1")).toEqual(floor("wardrobe-1", "wardrobe", 3.5, 5.5, 0));
    expect(storedOf(editLayout())).toEqual([]);
  });

  test("K4 액자를 고르면 돌리기 버튼이 없고 치우기 버튼이 있다. 게시판·창문은 둘 다 없다", async () => {
    await renderHome(layout([...N0_ITEMS, wall("frame-1", "frame", "left", 7.5)]));
    await enterEdit();

    await tapHit({ point: null, mark: null, onCharacter: false, piece: "frame-1", wall: { wall: "left", along: 7.5 } });
    expect(lifted()).toBe("frame-1");
    expect(screen.queryByRole("button", { name: "돌리기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "치우기" })).not.toBeNull();

    for (const [id, along] of [
      ["board", 1.8],
      ["window", 4.8]
    ] as const) {
      await tapHit({ point: null, mark: null, onCharacter: false, piece: id, wall: { wall: "back", along } });
      expect(lifted()).toBe(id);
      expect(screen.queryByRole("button", { name: "돌리기" })).toBeNull();
      expect(screen.queryByRole("button", { name: "치우기" })).toBeNull();
    }
  });
});
