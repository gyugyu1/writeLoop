// [spec] qa 테스트(작업 075 꾸미기: 들린 가구를 탭으로 옮기기, 기능 변경, 모바일): 홈 '꾸미기' 화면 단위로
// 새로 더한 가구·보관함에서 꺼낸 가구·방에서 고른 가구를 다른 곳 탭으로 옮기고, 그 가구를 탭해 확정하며, 둘 수 없으면 안내가 뜨는지 본다.
// 기대값은 명세(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/01-main-spec.md의 "바뀌는 동작" 1,
// "사용자가 폰에서 볼 것"의 앞 두 줄)에서만 가져온다. 기대 자리는 명세의 칸 맞춤(가운데 = round(점 - 크기/2) + 크기/2, 방향 그대로)으로 손으로 셈했다.
// - 안내 글: 명세는 "\"여기에는 둘 수 없어요\" 같은 안내"라고만 적어, 명세에 적힌 그 글 그대로 본다(보고 02-qa-tests.md의 모호한 점. 글이 달라지면 이 값을 고친다).
// - 끌기의 안내("여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요")는 지금 그대로다(이번 작업에서 바뀌지 않는 동작).
// 가짜로 두는 것은 기존 '가구 더하기' 테스트(home-lobby-add-furniture.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내,
// 라우터, 포커스, 3D 그리기). 3D 그리기는 가짜라서 어느 가구를 눌렀는지는 누르기 결과의 piece로 넣는다. 엔진 배치는 테스트마다 끝에 처음 배치로 되돌린다.
// '가구 더하기'는 개발 빌드에서만 보여 개발 빌드(__DEV__ = true)로 돌린다.
// 구현 코드는 부르는 방법(3D 그리기가 받는 edit의 layout·lifted, 누르기 결과의 point·piece·wall, 보관함 줄 칸의 접근성 이름)을 알려고만 읽었다.
// 빨간 가구 경우(H8·H9)는 결정(같은 폴더 03-main-decision.md의 답 2)에서 가져온다: 탭한 곳으로 옮기고 둘 수 있으면 빨간 상태가 풀리며, 둘 수 없으면 안내만 뜨고 그대로다.
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
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

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

// ---------- 글 ----------

/** 075 명세: 골라진 가구를 둘 수 없는 곳을 톡했을 때의 안내(명세에 적힌 글). */
const TAP_CANNOT = "여기에는 둘 수 없어요";
/** 끌어서 놓을 수 없는 자리에 놓았을 때의 안내(지금 그대로). */
const DRAG_CANNOT = "여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요";
const ADD_TAB = "가구 더하기";
/** 빨간 가구가 있어 '완료'가 막힐 때의 안내(지금 그대로). */
const RED_FINISH = "빨간 가구를 놓을 수 있는 자리로 옮기거나 돌려 주세요";

// ---------- 배치 ----------

type LayoutItem = LobbyLayout["items"][number];
type Facing = 0 | 1 | 2 | 3;
type Stored = { id: string; type: string };

const floor = (id: string, type: string, x: number, z: number, facing: Facing = 0): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });
const on = (id: string, type: string, parent: string, slot: number, facing: Facing = 0): LayoutItem => ({ id, type, on: { parent, slot, facing } }) as LayoutItem;

/** 처음 배치(N0). */
const N0_ITEMS: LayoutItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8),
  on("lamp", "lamp", "desk", 0, 0)
];

function layout(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  const value = stored.length > 0 ? { items, stored } : { items };
  return JSON.parse(JSON.stringify(value)) as LobbyLayout;
}

const N0 = layout(N0_ITEMS);
/** 옷장을 보관함에 넣어 둔 배치. */
const WARDROBE_STORED = layout(
  N0_ITEMS.filter((item) => item.id !== "wardrobe"),
  [{ id: "wardrobe", type: "wardrobe" }]
);

const AT = {
  desk: { x: 1.5, z: 5.5 },
  wardrobe: { x: 7.5, z: 3.5 }
} as const;

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
  await render(<HomeScreen />);
  await flushAsync();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function floorHit(point: FloorPoint, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece, wall: null };
}

async function pointer(phase: "down" | "move" | "up", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

/** 톡(같은 화면 자리에서 누르고 뗀다). */
async function tap(h: PointerHit) {
  await pointer("down", h, 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

/** 누르고(화면 200,300) 끌어(화면으로 100px씩) 뗀다. */
async function drag(piece: string, from: FloorPoint, to: FloorPoint) {
  await pointer("down", floorHit(from, piece), 200, 300);
  await pointer("move", floorHit(to), 300, 400);
  await pointer("up", null, 300, 400);
  await flushAsync();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
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

function itemIn(value: LobbyLayout, id: string) {
  return value.items.find((item) => item.id === id);
}

function byId<T extends { id: string }>(list: readonly T[] | null | undefined): T[] {
  return [...(list ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function storedOf(value: LobbyLayout | null | undefined): Stored[] {
  return ((value as { stored?: Stored[] } | null | undefined)?.stored ?? []).map((s) => ({ id: s.id, type: s.type }));
}

/** '가구 더하기' 탭을 눌러 그 종류("<이름> 더하기" 칸)를 더한다. */
async function addFurniture(name: string) {
  const tabs = screen.queryAllByRole(/^(tab|button)$/, { name: ADD_TAB });
  expect(tabs).toHaveLength(1);
  await fireEvent.press(tabs[0]);
  await flushAsync();
  await pressButton(`${name} 더하기`);
}

/** 보관함 줄(보관함 쪽)의 그 가구 칸을 눌러 꺼낸다. */
async function takeOut(name: string) {
  const tray = screen.getByLabelText("보관함");
  await fireEvent.press(within(tray).getByRole("button", { name }));
  await flushAsync();
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  devGlobal.__DEV__ = true;
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
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- 들린 가구 모두(더한 가구·꺼낸 가구·방에서 고른 가구) ----------

describe("[spec] 075 바뀌는 동작 1: 들린 가구를 탭으로 옮기고, 그 가구를 탭해 확정한다(화면)", () => {
  test("H1 '가구 더하기'로 화분을 더한 뒤 빈 바닥 (5.3, 9.6)을 탭하면 화분이 (5.5, 9.5)로 옮겨 가 들린 채이고, 화분을 탭하면 내려앉으며 '완료'하면 그 자리로 저장된다", async () => {
    await renderHome(N0);
    await enterEdit();
    await addFurniture("화분");
    expect(lifted()).toBe("plant-1");
    const before = itemIn(editLayout(), "plant-1")!.floor!;

    await tap(floorHit({ x: 5.3, z: 9.6 }));

    expect(itemIn(editLayout(), "plant-1")).toEqual(floor("plant-1", "plant", 5.5, 9.5, before.facing));
    expect(lifted()).toBe("plant-1");
    expect(screen.queryByText(TAP_CANNOT)).toBeNull();

    await tap(floorHit({ x: 5.5, z: 9.5 }, "plant-1"));

    expect(lifted()).toBeNull();
    await pressButton("완료");
    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expect(byId(jest.mocked(saveLobbyLayout).mock.calls[0][0].items)).toEqual(byId([...N0_ITEMS, floor("plant-1", "plant", 5.5, 9.5, before.facing)]));
  });

  test("H2 보관함에서 옷장을 꺼낸 뒤 빈 바닥 (5.3, 9.6)을 탭하면 옷장이 (5.5, 9.5)로 옮겨 가 들린 채이고, 다른 곳 (2.4, 9.4)를 또 탭하면 (2.5, 9.5)로 또 옮겨 가며, 옷장을 탭하면 내려앉는다", async () => {
    await renderHome(WARDROBE_STORED);
    await enterEdit();
    await takeOut("옷장");
    expect(lifted()).toBe("wardrobe");
    expect(storedOf(editLayout())).toEqual([]);
    const facing = itemIn(editLayout(), "wardrobe")!.floor!.facing;

    await tap(floorHit({ x: 5.3, z: 9.6 }));
    expect(itemIn(editLayout(), "wardrobe")).toEqual(floor("wardrobe", "wardrobe", 5.5, 9.5, facing));
    expect(lifted()).toBe("wardrobe");

    await tap(floorHit({ x: 2.4, z: 9.4 }));
    expect(itemIn(editLayout(), "wardrobe")).toEqual(floor("wardrobe", "wardrobe", 2.5, 9.5, facing));
    expect(lifted()).toBe("wardrobe");

    await tap(floorHit({ x: 2.5, z: 9.5 }, "wardrobe"));

    expect(lifted()).toBeNull();
    expect(itemIn(editLayout(), "wardrobe")).toEqual(floor("wardrobe", "wardrobe", 2.5, 9.5, facing));
  });

  test("H3 방에서 고른 옷장을 둔 채 빈 바닥 (5.3, 9.6)을 탭하면 (5.5, 9.5, 방향 3)으로 옮겨 가 들린 채이고, 옷장을 탭해 확정한 뒤 '완료'하면 그 자리로 저장된다", async () => {
    await renderHome(N0);
    await enterEdit();
    await tap(floorHit(AT.wardrobe, "wardrobe"));
    expect(lifted()).toBe("wardrobe");

    await tap(floorHit({ x: 5.3, z: 9.6 }));

    expect(itemIn(editLayout(), "wardrobe")).toEqual(floor("wardrobe", "wardrobe", 5.5, 9.5, 3));
    expect(lifted()).toBe("wardrobe");

    await tap(floorHit({ x: 5.5, z: 9.5 }, "wardrobe"));
    expect(lifted()).toBeNull();
    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expect(byId(jest.mocked(saveLobbyLayout).mock.calls[0][0].items)).toEqual(
      byId(N0_ITEMS.map((item) => (item.id === "wardrobe" ? floor("wardrobe", "wardrobe", 5.5, 9.5, 3) : item)))
    );
  });

  test("H7 옷장을 탭으로 옮긴 뒤 '취소'하면(취소는 지금 그대로) 저장하지 않고 편집 전 배치로 나온다", async () => {
    await renderHome(N0);
    await enterEdit();
    await tap(floorHit(AT.wardrobe, "wardrobe"));
    await tap(floorHit({ x: 5.3, z: 9.6 }));
    expect(itemIn(editLayout(), "wardrobe")).toEqual(floor("wardrobe", "wardrobe", 5.5, 9.5, 3));

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(canvas().edit ?? null).toBeNull();
    expect(screen.getByText("꾸미기")).toBeTruthy();
    expect(byId(activeLobbyLayout().items)).toEqual(byId(N0_ITEMS));
  });
});

// ---------- 둘 수 없는 곳 ----------

describe("[spec] 075 바뀌는 동작 1: 다른 가구가 있어 둘 수 없는 곳을 탭하면 안내가 뜨고 가구는 그대로다(화면)", () => {
  test("H4 더한 화분을 들고 책상 (1.5, 5.5)를 탭하면 '여기에는 둘 수 없어요'가 뜨고, 화분은 원래 자리에서 들린 채이며 책상은 골라지지 않는다", async () => {
    await renderHome(N0);
    await enterEdit();
    await addFurniture("화분");
    const before = editLayout();

    await tap(floorHit(AT.desk, "desk"));

    expect(screen.getByText(TAP_CANNOT)).toBeTruthy();
    expect(byId(editLayout().items)).toEqual(byId(before.items));
    expect(lifted()).toBe("plant-1");
  });

  test("H5 방에서 고른 옷장을 들고 책상을 탭하면 안내가 뜨고 옷장은 (7.5, 3.5)에서 들린 채이며, 옷장을 탭해 확정한 뒤에 책상을 탭하면 책상이 골라진다", async () => {
    await renderHome(N0);
    await enterEdit();
    await tap(floorHit(AT.wardrobe, "wardrobe"));

    await tap(floorHit(AT.desk, "desk"));

    expect(screen.getByText(TAP_CANNOT)).toBeTruthy();
    expect(byId(editLayout().items)).toEqual(byId(N0_ITEMS));
    expect(lifted()).toBe("wardrobe");

    await tap(floorHit(AT.wardrobe, "wardrobe"));
    expect(lifted()).toBeNull();
    await tap(floorHit(AT.desk, "desk"));

    expect(lifted()).toBe("desk");
    expect(byId(editLayout().items)).toEqual(byId(N0_ITEMS));
  });

  test("H6 꺼낸 옷장을 들고 창문 바로 아래 칸 (4.5, 0.5)를 탭하면(창문 밑이라 둘 수 없음) 안내가 뜨고 옷장은 꺼낸 자리에서 들린 채다", async () => {
    await renderHome(WARDROBE_STORED);
    await enterEdit();
    await takeOut("옷장");
    const before = editLayout();

    await tap(floorHit({ x: 4.5, z: 0.5 }));

    expect(screen.getByText(TAP_CANNOT)).toBeTruthy();
    expect(byId(editLayout().items)).toEqual(byId(before.items));
    expect(lifted()).toBe("wardrobe");
  });
});

// ---------- 빨간 가구(03 결정 답 2) ----------

describe("[spec] 075 03 결정 답 2: 빨간 가구가 골라진 채 다른 곳을 탭하면 옮기고, 둘 수 있으면 빨간 상태가 풀린다(화면)", () => {
  /** 책장을 골라 돌리기 버튼으로 한 번 돌려 빨간 가구(방향 2)로 만든다(골라진 채). */
  async function makeRedBookcase() {
    await tap(floorHit({ x: 0.5, z: 2.5 }, "bookcase"));
    await pressButton("돌리기");
    expect(itemIn(editLayout(), "bookcase")).toEqual(floor("bookcase", "bookcase", 0.5, 2.5, 2));
    expect(canvas().edit!.marks.map((m) => ({ piece: m.piece, ok: m.ok }))).toEqual([{ piece: "bookcase", ok: false }]);
    expect(lifted()).toBe("bookcase");
  }

  test("H8 빨간 책장을 고른 채 빈 바닥 (5.3, 9.6)을 탭하면 (5.5, 9.5, 방향 2)로 옮겨 가 빨간 칸이 풀리고(놓을 수 있음) 들린 채이며, 책장을 탭해 확정한 뒤 '완료'하면 그 자리로 저장된다", async () => {
    await renderHome(N0);
    await enterEdit();
    await makeRedBookcase();

    await tap(floorHit({ x: 5.3, z: 9.6 }));

    expect(itemIn(editLayout(), "bookcase")).toEqual(floor("bookcase", "bookcase", 5.5, 9.5, 2));
    expect(canvas().edit!.marks.map((m) => ({ piece: m.piece, ok: m.ok }))).toEqual([{ piece: "bookcase", ok: true }]);
    expect(lifted()).toBe("bookcase");
    expect(screen.queryByText(TAP_CANNOT)).toBeNull();

    await tap(floorHit({ x: 5.5, z: 9.5 }, "bookcase"));
    expect(lifted()).toBeNull();
    expect(canvas().edit!.marks).toEqual([]);
    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expect(byId(jest.mocked(saveLobbyLayout).mock.calls[0][0].items)).toEqual(
      byId(N0_ITEMS.map((item) => (item.id === "bookcase" ? floor("bookcase", "bookcase", 5.5, 9.5, 2) : item)))
    );
  });

  test("H9 빨간 책장을 고른 채 뒷벽 앞 빈 칸 (6.5, 0.5)를 탭하면(옮긴 자리에서도 앞면이 벽을 봐 둘 수 없음) '여기에는 둘 수 없어요'만 뜨고 책장은 (0.5, 2.5, 방향 2) 그대로 빨간 칸이며 들린 채이고, '완료'는 지금처럼 막힌다", async () => {
    await renderHome(N0);
    await enterEdit();
    await makeRedBookcase();

    // 다른 가구 위를 탭하는 경우는 안내 글이 '빨간 가구부터'인지 '둘 수 없어요'인지 결정이 갈라 말하지 않아(보고 04-qa-tests.md) 빈 칸을 탭한다
    await tap(floorHit({ x: 6.5, z: 0.5 }));

    expect(screen.getByText(TAP_CANNOT)).toBeTruthy();
    expect(itemIn(editLayout(), "bookcase")).toEqual(floor("bookcase", "bookcase", 0.5, 2.5, 2));
    expect(canvas().edit!.marks.map((m) => ({ piece: m.piece, ok: m.ok }))).toEqual([{ piece: "bookcase", ok: false }]);
    expect(lifted()).toBe("bookcase");

    await pressButton("완료");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(screen.getByText(RED_FINISH)).toBeTruthy();
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 075 그대로여야 할 동작(화면)", () => {
  test("K1 옷장을 책상 위로 끌어 놓으면 지금처럼 원래 자리로 돌아가며 끌기 안내('여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요')가 뜬다", async () => {
    await renderHome(N0);
    await enterEdit();

    await drag("wardrobe", AT.wardrobe, AT.desk);

    expect(byId(editLayout().items)).toEqual(byId(N0_ITEMS));
    expect(screen.getByText(DRAG_CANNOT)).toBeTruthy();
  });

  test("K2 아무것도 고르지 않은 채 빈 바닥을 탭하면 아무 일도 없고, 가구를 탭하면 그 가구가 골라진다", async () => {
    await renderHome(N0);
    await enterEdit();

    await tap(floorHit({ x: 5.3, z: 9.6 }));
    expect(lifted()).toBeNull();
    expect(byId(editLayout().items)).toEqual(byId(N0_ITEMS));
    expect(screen.queryByText(TAP_CANNOT)).toBeNull();

    await tap(floorHit(AT.wardrobe, "wardrobe"));
    expect(lifted()).toBe("wardrobe");
  });
});
