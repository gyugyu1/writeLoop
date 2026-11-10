// [spec] qa 테스트(작업 066-③ 제거·보관함·꺼내 놓기, 새 기능, 모바일): 치울 수 있는 벽 가구를 치우고, 보관함에서 꺼내 벽에 거는지.
// 기대값은 시나리오(private 작업 폴더 066/04-제거-보관함-꺼내기/03-qa-scenarios.md의 D21, R11, S15~S17)와
// 결정(같은 폴더 04-main-decision.md의 2: 벽을 따라 찾는 단위는 끌 때와 같은 반 칸, 그리고 메인 세션이 정한 것: 벽 가운데에서 같은 거리면
// 벽을 따라간 값이 작은 쪽)에서만 가져온다. 결정으로 더한 테스트는 이름을 "결정 2"·"결정(같은 거리)"으로 시작한다.
// 지금 카탈로그에는 치울 수 있는 벽 가구가 없어서, 시나리오대로 카탈로그 모듈을 감싸 시험용 종류 POSTER를 더한다(시나리오 A7):
// id poster, 이름 "포스터", 벽 가구, 벽을 따라 폭 1, 높이 2.5~3.0, 길 막지 않음, 장소 없음, 치울 수 있음. 모델 값은 시나리오에 없어
// 그리기용으로만 아무 값을 넣었다(3D 그리기는 가짜다).
// 그 밖에 가짜로 두는 것과 부르는 방법은 home-lobby-storage.spec.test.tsx와 같다. 3D 그리기는 가짜라서 어느 벽 가구를 눌렀는지는
// 누르기 결과의 piece·wall로 그대로 넣어 보낸다.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
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
import { applyLobbyLayout, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES, type FurnitureType } from "@/lib/lobby3d/furniture-catalog";
import { isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { parseLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

/** 화면 요소(Testing Library가 돌려주는 것). */
type UiNode = ReturnType<typeof screen.getByRole>;

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

// 시험용 벽 종류 POSTER(시나리오 03 "벽 가구 시나리오"). 카탈로그를 읽는 곳(배치 규칙·본문 검사·3D 자리·화면)이 모두 이 모듈을 거친다.
jest.mock("@/lib/lobby3d/furniture-catalog", () => {
  const actual = jest.requireActual<typeof import("@/lib/lobby3d/furniture-catalog")>("@/lib/lobby3d/furniture-catalog");
  const poster: FurnitureType = {
    id: "poster",
    name: "포스터",
    mount: "wall",
    size: { width: 1, depth: 0 },
    height: { bottom: 2.5, top: 3.0 },
    blocksWalk: false,
    removable: true,
    model: { piece: "board", box: { width: 1, height: 0.5, depth: 0.05 }, y: 2.75, wallDepth: 0.03 }
  };
  return {
    ...actual,
    FURNITURE_TYPES: [...actual.FURNITURE_TYPES, poster],
    findFurnitureType: (id: string) => (id === "poster" ? poster : actual.findFurnitureType(id)),
    furnitureType: (id: string) => (id === "poster" ? poster : actual.furnitureType(id))
  };
});

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

// ---------- 시나리오의 배치(03 "배치 모음"의 DEF·W1~W3) ----------

type LayoutItem = LobbyLayout["items"][number];
type Facing = NonNullable<LayoutItem["floor"]>["facing"];
type Stored = { id: string; type: string };

const floor = (id: string, type: string, x: number, z: number, facing: Facing): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });

const DEF_ITEMS: LayoutItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8)
];

/** 방(items)과 보관함(stored)으로 만든 배치. 보관함이 비면 stored 키를 두지 않는다. */
function layout(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  const value = stored.length > 0 ? { items, stored } : { items };
  return JSON.parse(JSON.stringify(value)) as LobbyLayout;
}

/** DEF에서 id가 같은 가구를 바꾸고(replace) 더한(add) 방. */
function defWith(replace: LayoutItem[] = [], add: LayoutItem[] = []): LayoutItem[] {
  return [...DEF_ITEMS.map((item) => replace.find((r) => r.id === item.id) ?? item), ...add];
}

/** W1: DEF에서 창문을 (right, 7)로 옮김. */
const W1_ITEMS = defWith([wall("window", "window", "right", 7)]);
/** W2: DEF에서 게시판 (back, 1.1), 창문 (back, 3.35)로 옮기고 포스터 셋을 뒷벽 5·6·7에 더함. */
const W2_ITEMS = defWith(
  [wall("board", "board", "back", 1.1), wall("window", "window", "back", 3.35)],
  [wall("poster1", "poster", "back", 5), wall("poster2", "poster", "back", 6), wall("poster3", "poster", "back", 7)]
);
/** W3: W2 + 포스터 lp1~lp10을 왼벽 0.7, 1.7, …, 9.7에 더함. */
const W3_ITEMS = [...W2_ITEMS, ...Array.from({ length: 10 }, (_, i) => wall(`lp${i + 1}`, "poster", "left", Math.round((0.7 + i) * 10) / 10))];
/** 결정(같은 거리)용: 게시판 (back, 1.1), 창문 (right, 7), 포스터 p0 (back, 4). 뒷벽 3.0과 5.0이 벽 가운데(4)에서 같은 거리 1로 둘 다 비어 있다. */
const W_TIE_ITEMS = defWith([wall("board", "board", "back", 1.1), wall("window", "window", "right", 7)], [wall("p0", "poster", "back", 4)]);

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

// ---------- 안드로이드 뒤로 가기(가짜) ----------

const backHandlers = new Set<() => boolean | null | undefined>();

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

/** 이 배치를 불러온 홈을 그린다. */
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

async function pointer(phase: "down" | "move" | "up" | "cancel", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

/** 가구를 톡 누른다(같은 화면 자리에서 누르고 뗀다). */
async function tapHit(h: PointerHit) {
  await pointer("down", h, 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

/** 벽 가구를 골라 둔다. */
async function selectWall(id: string, side: "back" | "left" | "right", along: number, mark: MarkId | null = null) {
  await tapHit({ point: null, mark, onCharacter: false, piece: id, wall: { wall: side, along } });
  expect(lifted()).toBe(id);
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

function storeButton() {
  return screen.queryByRole("button", { name: "치우기" });
}

async function storeSelected() {
  const button = storeButton();
  expect(button).not.toBeNull();
  await fireEvent.press(button!);
  await flushAsync();
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

function roomOf(value: LobbyLayout | null | undefined) {
  return byId(value?.items ?? []);
}

function storedOf(value: LobbyLayout | null | undefined): Stored[] {
  return byId(((value as { stored?: Stored[] } | null | undefined)?.stored ?? []).map((s) => ({ id: s.id, type: s.type })));
}

function itemIn(value: LobbyLayout, id: string) {
  return value.items.find((item) => item.id === id);
}

/** '보관함' 버튼(글 "보관함"을 가진 버튼, 하나뿐). */
function storageButton(): UiNode {
  return screen.getByRole("button", { name: /보관함/ });
}

/** '보관함' 버튼에 보이는 개수. 숫자가 없으면 null(시나리오 A3: 붙이는 모양은 보지 않고 숫자만 본다). */
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

/**
 * 보관함 목록의 줄: '보관함' 묶음 안의, 가구 이름 글을 가진 버튼.
 * 066-⑤ 04 결정 1의 1: 판에 늘 보이는 '가구 더하기' 줄(접근성 이름 "<가구 이름> 더하기", 같은 폴더 결정 3)은 이 묶음이 아니라 뺀다.
 */
function storageRows(): UiNode[] {
  return screen
    .getAllByRole("button")
    .filter((button) => !isAddRow(button) && FURNITURE_NAMES.some((name) => within(button).queryByText(name) !== null));
}

/** '가구 더하기' 묶음의 줄(또는 그 안)인지: 자신이나 조상의 접근성 이름이 "… 더하기"다. */
function isAddRow(node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) {
    const label = (n.props as { accessibilityLabel?: unknown }).accessibilityLabel;
    if (typeof label === "string" && label.endsWith(" 더하기")) return true;
  }
  return false;
}

function storageRow(name: string): UiNode {
  const rows = storageRows().filter((row) => within(row).queryByText(name) !== null);
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function takeOut(name: string) {
  await fireEvent.press(storageRow(name));
  await flushAsync();
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  backHandlers.clear();
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    backHandlers.add(handler);
    return { remove: () => backHandlers.delete(handler) } as ReturnType<typeof BackHandler.addEventListener>;
  });
  jest.mocked(router.push).mockReset();
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


const POSTER_NAME = "포스터";

/** 시작 배치가 공통 배치 규칙을 지키는지(시나리오가 이 배치에서 꺼낼 자리를 구했다는 전제). */
function expectPlaceable(items: LayoutItem[]) {
  expect(isPlaceableLayout(layout(items))).toBe(true);
}

// ---------- 1. 본문 ----------

describe("[spec] 066-③ 명세 1: 장소 없는 벽 가구도 치울 수 있는 종류", () => {
  test("D21 POSTER를 더한 상태에서 stored:[{p1, poster}]는 읽힌다", () => {
    const parsed = parseLobbyLayoutPayload(JSON.parse(JSON.stringify({ version: 2, items: DEF_ITEMS, stored: [{ id: "p1", type: "poster" }] })));

    expect(parsed).not.toBeNull();
    expect(roomOf(parsed)).toEqual(byId(DEF_ITEMS));
    expect(storedOf(parsed)).toEqual([{ id: "p1", type: "poster" }]);
  });
});

// ---------- 2. 치우기 ----------

describe("[spec] 066-③ 명세 2: 치울 수 있는 벽 가구", () => {
  test("R11 W1 + poster1(back, 4)에서 poster1을 고르면 '치우기'가 보이고, 누르면 방에서 빠져 보관함에 {poster1, poster}", async () => {
    await renderHome(layout([...W1_ITEMS, wall("poster1", "poster", "back", 4)]));
    await enterEdit();
    await selectWall("poster1", "back", 4);

    expect(storeButton()).not.toBeNull();
    await storeSelected();

    expect(itemIn(editLayout(), "poster1")).toBeUndefined();
    expect(storedOf(editLayout())).toEqual([{ id: "poster1", type: "poster" }]);
    expect(storageBadge()).toBe(1);
  });
});

// ---------- 3. 꺼내 놓기: 벽 가구 ----------

describe("[spec] 066-③ 명세 3: 벽 가구는 뒷벽·왼벽·오른벽 차례로 벽 가운데에서 가까운 자리", () => {
  test("S15 W1 + 보관함 poster1: 꺼내면 poster1이 (back, 4)", async () => {
    expectPlaceable(W1_ITEMS);
    await renderHome(layout(W1_ITEMS, [{ id: "poster1", type: "poster" }]));
    await enterEdit();
    await openStorage();

    await takeOut(POSTER_NAME);

    expect(itemIn(editLayout(), "poster1")).toEqual({ id: "poster1", type: "poster", wall: { wall: "back", along: 4 } });
    expect(storedOf(editLayout())).toEqual([]);
    expect(lifted()).toBe("poster1");
  });

  test("S16 W2 + 보관함 poster4: 뒷벽에 틈이 없어 poster4가 (left, 5.5)", async () => {
    expectPlaceable(W2_ITEMS);
    await renderHome(layout(W2_ITEMS, [{ id: "poster4", type: "poster" }]));
    await enterEdit();
    await openStorage();

    await takeOut(POSTER_NAME);

    expect(itemIn(editLayout(), "poster4")?.wall).toEqual({ wall: "left", along: 5.5 });
  });

  test("S17 W3 + 보관함 poster4: 뒷벽·왼벽 모두 틈이 없어 poster4가 (right, 5.5)", async () => {
    expectPlaceable(W3_ITEMS);
    await renderHome(layout(W3_ITEMS, [{ id: "poster4", type: "poster" }]));
    await enterEdit();
    await openStorage();

    await takeOut(POSTER_NAME);

    expect(itemIn(editLayout(), "poster4")?.wall).toEqual({ wall: "right", along: 5.5 });
  });

  test("결정 2 DEF + 보관함 poster1: 벽 가운데 쪽이 창문·게시판에 막혀, 반 칸 단위로 찾으면 poster1이 (back, 6.5)", async () => {
    // 뒷벽 가운데(4)에서 가까운 반 칸 자리 중 창문(4.8, 폭 2.3)·게시판(1.8, 폭 1.8)과 겹치지 않는 첫 자리가 6.5다(더 잘게 찾으면 6.45가 된다)
    expectPlaceable(DEF_ITEMS);
    await renderHome(layout(DEF_ITEMS, [{ id: "poster1", type: "poster" }]));
    await enterEdit();
    await openStorage();

    await takeOut(POSTER_NAME);

    expect(itemIn(editLayout(), "poster1")?.wall).toEqual({ wall: "back", along: 6.5 });
  });

  test("결정(같은 거리) 뒷벽 3.0과 5.0이 벽 가운데에서 같은 거리면 벽을 따라간 값이 작은 쪽 (back, 3.0)에 건다", async () => {
    expectPlaceable(W_TIE_ITEMS);
    await renderHome(layout(W_TIE_ITEMS, [{ id: "poster1", type: "poster" }]));
    await enterEdit();
    await openStorage();

    await takeOut(POSTER_NAME);

    expect(itemIn(editLayout(), "poster1")?.wall).toEqual({ wall: "back", along: 3 });
  });
});
