// [spec] qa 테스트(작업 070 꾸미기 화면 버튼·보관함 아이콘, 기능 변경, 모바일): 그림이 없는 종류의 보관함 칸.
// 기대값은 명세(private 작업 폴더 070-2026-11-11-꾸미기-화면-버튼-보관함-아이콘/01-main-spec.md 3절
// "그림이 없는 종류는 가구 이름 첫 글자를 담은 둥근 칸으로 대신한다(앱이 멈추지 않게)")와 2절(칸을 누르면 꺼내고 줄은 열린 채)에서 가져온다.
// 그림이 없는 종류를 만들려고, 기존 벽 가구 보관함 테스트(home-lobby-storage-wall.spec.test.tsx)처럼 카탈로그 모듈을 감싸
// 시험용 종류 POSTER(포스터, 치울 수 있는 벽 가구)를 더한다. 그림은 이번 작업에서 만든 종류에만 있으므로 POSTER에는 그림이 없다.
// 가정: 화면은 그림을 종류 id(또는 카탈로그 항목)로 찾으므로, 카탈로그에만 더한 종류는 그림이 없는 종류가 된다.
// "둥근" 모양은 보지 못한다(보고의 "사용자가 직접 볼 것"). 운영 빌드(__DEV__ = false)로 돌린다(탭이 없다).
// 나머지 틀(가짜로 두는 것, 칸·그림 찾기)은 같은 작업의 home-lobby-decorate-icons.spec.test.tsx와 같다.

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
import { applyLobbyLayout } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES, type FurnitureType } from "@/lib/lobby3d/furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

/** 화면 요소(Testing Library가 돌려주는 것). */
type UiNode = ReturnType<typeof screen.getByRole>;

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

// 시험용 벽 종류 POSTER(기존 벽 가구 보관함 테스트와 같은 값). 카탈로그를 읽는 곳이 모두 이 모듈을 거친다.
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

// ---------- 배치 ----------

type LayoutItem = LobbyLayout["items"][number];
type Stored = { id: string; type: string };

const floor = (id: string, type: string, x: number, z: number, facing: 0 | 1 | 2 | 3): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });

const DEF_ITEMS: LayoutItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8)
];
const STORED: Stored[] = [
  { id: "wardrobe2", type: "wardrobe" },
  { id: "poster1", type: "poster" }
];
const START: LobbyLayout = JSON.parse(JSON.stringify({ items: DEF_ITEMS, stored: STORED }));

const POSTER_NAME = "포스터";
const POSTER_FIRST = "포";
const FURNITURE_NAMES = FURNITURE_TYPES.map((type) => type.name);

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

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

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

function editLayout(): LobbyLayout {
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  return edit!.layout;
}

function storedOf(value: LobbyLayout): Stored[] {
  return ((value as { stored?: Stored[] }).stored ?? []).map((s) => ({ id: s.id, type: s.type }));
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

/** 아래 줄의 '보관함' 버튼(운영 빌드라 탭이 없어 하나뿐). */
function storageButton(): UiNode {
  return screen.getByRole("button", { name: /^보관함\s*\d*$/ });
}

async function openStorage() {
  await fireEvent.press(storageButton());
  await flushAsync();
}

function cellName(cell: UiNode): string {
  const names = FURNITURE_NAMES.filter((name) => within(cell).queryByText(name) !== null);
  expect(names).toHaveLength(1);
  return names[0];
}

/** 보관함 칸: 가구 이름 글을 가진 버튼('… 더하기' 이름을 가진 것과 그 안은 뺀다). */
function storageCells(): UiNode[] {
  const inAddGroup = (node: UiNode) => {
    for (let n: UiNode | null = node; n; n = n.parent) {
      const label = (n.props as { accessibilityLabel?: unknown }).accessibilityLabel;
      if (typeof label === "string" && label.endsWith(" 더하기")) return true;
    }
    return false;
  };
  return screen
    .queryAllByRole(/button/)
    .filter((button) => !inAddGroup(button) && FURNITURE_NAMES.some((name) => within(button).queryByText(name) !== null));
}

function storageCell(name: string): UiNode {
  const found = storageCells().filter((cell) => cellName(cell) === name);
  expect(found).toHaveLength(1);
  return found[0];
}

function imagesIn(cell: UiNode): UiNode[] {
  return (cell as unknown as { queryAll: (p: (n: UiNode) => boolean) => UiNode[] }).queryAll((n) => n.props?.source != null);
}

function orderIn(container: UiNode, node: UiNode): number {
  let index = 0;
  let result = -1;
  const visit = (n: UiNode) => {
    if (n === node) result = index;
    index += 1;
    for (const child of n.children) if (typeof child !== "string") visit(child);
  };
  visit(container);
  return result;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  devGlobal.__DEV__ = false;
  mockFocus.focused = true;
  mockCanvas.props = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(
    () => ({ remove: () => undefined }) as ReturnType<typeof BackHandler.addEventListener>
  );
  jest.mocked(router.push).mockReset();
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
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
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("[spec] 070 명세 3: 그림이 없는 종류", () => {
  test("F1 [바뀔] 그림이 없는 포스터 칸은 그림 대신 첫 글자 '포'를 이름보다 먼저 보이고, 그림이 있는 옷장 칸은 그림을 보인다", async () => {
    // 시험용 배치가 본문 검사를 통과하는지(전제)
    expect(parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(START))))).not.toBeNull();
    await renderHome(START);
    await enterEdit();

    await openStorage();

    expect(storageCells().map(cellName)).toEqual(["옷장", POSTER_NAME]);
    const poster = storageCell(POSTER_NAME);
    expect(imagesIn(poster)).toHaveLength(0);
    const first = within(poster).getByText(POSTER_FIRST);
    expect(orderIn(poster, first)).toBeLessThan(orderIn(poster, within(poster).getByText(POSTER_NAME)));
    expect(imagesIn(storageCell("옷장")).length).toBeGreaterThan(0);
  });

  test("F2 [바뀔] 그림이 없는 포스터 칸을 누르면 지금 꺼내기 규칙대로 뒷벽 6.5에 걸려 골라지고, 줄은 열린 채다", async () => {
    await renderHome(START);
    await enterEdit();
    await openStorage();

    await fireEvent.press(storageCell(POSTER_NAME));
    await flushAsync();

    expect(editLayout().items.find((item) => item.id === "poster1")).toEqual(wall("poster1", "poster", "back", 6.5));
    expect(canvas().edit?.lifted).toBe("poster1");
    expect(storedOf(editLayout())).toEqual([{ id: "wardrobe2", type: "wardrobe" }]);
    expect(storageCells().map(cellName)).toEqual(["옷장"]);
  });
});
