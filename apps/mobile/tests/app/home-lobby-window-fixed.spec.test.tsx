// [spec] qa 테스트(작업 093 창문 붙박이, 기능 변경, 모바일): 홈 '꾸미기'에서 창문을 누르면 고르지 않고(들리거나 옮겨지지 않는다)
// 짧은 안내 한 줄을 잠깐 보여 주는지, 다른 가구는 그대로 고르고 옮겨 저장되는지.
// 기대값은 명세(private 작업 폴더 093-2026-11-14-창문-붙박이/01-main-spec.md)의 "바뀌는 동작" 1·2와 "그대로여야 할 동작",
// "사용자가 직접 볼 것"의 두 줄에서만 가져온다. 테스트 이름 앞의 [바뀔]·[그대로]는 03-qa-tests.md의 분류와 같다.
// 가정(03-qa-tests.md에 적음):
// - 안내는 지금의 꾸미기 안내처럼 알림(접근성 역할 alert)으로 뜬다. 글은 명세가 "문구 예"만 주어 정확히 보지 않고,
//   비어 있지 않고 지금의 다른 꾸미기 안내(빨간 가구·놓을 수 없음·둘 수 없음·자리 없음)와 다른지만 본다.
// - "잠깐"은 길이를 명세가 정하지 않아, 5초 안에 사라지는지만 본다(지금 알림은 1.8초).
// 가짜로 두는 것과 도우미는 064-④ 벽 가구 꾸미기 테스트(home-lobby-wall-edit.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태,
// 앱 업데이트 안내 상태, 라우터, 포커스, 3D 그리기). 3D 그리기는 가짜라서 어느 가구를 눌렀는지는 3D 그리기가 판정한 값(piece, wall, 바닥 point)을
// 누르기 결과로 그대로 넣어 보낸다. 창문이 들리지 않는 그림 자체는 이 테스트로 보지 못한다(사용자가 기기에서 본다).
// 구현 코드는 부르는 방법(3D 그리기가 받는 edit의 layout·marks·wallMarks·zone·lifted·dragging, 버튼 이름)을 알려고만 읽었다.
// 04-main-decision.md(사용자 결정)로 더하거나 고친 것(보고 06-qa-tests.md):
// - 2: 안내 순서. 다른 가구를 들고 있으면 지금처럼 "여기에는 둘 수 없어요"(N1·N2), 빨간 가구가 있으면 빨간 가구 안내(N3·N4),
//   아무것도 들지 않았을 때만 창문 안내. 창문 앞 바닥 띠도 창문과 같다(V3에 창문 안내 단언을 더함).
// - 3: 창문이 다른 자리에 있는 배치를 불러오면 창문을 뒷벽 4.8에 두고 나머지는 그대로다. 그 배치를 저장하면 창문이 뒷벽 4.8로 나간다(L1·L2).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
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

// ---------- 글과 배치 ----------

/** 지금의 다른 꾸미기 안내(창문 안내는 이것들과 다른 글이어야 한다). */
const OTHER_EDIT_NOTICES = [
  "빨간 가구부터 옮겨 주세요",
  "빨간 가구를 놓을 수 있는 자리로 옮기거나 돌려 주세요",
  "배치를 저장하지 못했어요. 다시 눌러 주세요",
  "여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요",
  "여기에는 둘 수 없어요",
  "놓을 자리가 없어요. 가구를 옮기거나 치운 뒤 다시 꺼내 주세요"
];

type LayoutItem = LobbyLayout["items"][number];
type WallSpot = NonNullable<LayoutItem["wall"]>;
type PieceId = NonNullable<PointerHit["piece"]>;

/** 처음 배치(창문 뒷벽 4.8, 게시판 뒷벽 1.8). */
const P0: LobbyLayout = JSON.parse(JSON.stringify(DEFAULT_LOBBY_LAYOUT)) as LobbyLayout;

function sortedItems(layout: { items: readonly { id: string }[] } | null | undefined) {
  return [...(layout?.items ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function withWall(base: LobbyLayout, id: string, spot: WallSpot): LobbyLayout {
  return { items: base.items.map((item) => (item.id === id ? { ...item, wall: spot } : item)) };
}

const back = (along: number): WallSpot => ({ wall: "back", along });
const left = (along: number): WallSpot => ({ wall: "left", along });
const right = (along: number): WallSpot => ({ wall: "right", along });
/** 뒷벽 창문 앞 바닥 띠 안의 점(064-④ B1과 같다). */
const WINDOW_STRIP: FloorPoint = { x: 4.8, z: 0.5 };

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

type Spot = WallSpot | { floor: FloorPoint };

function hitAt(spot: Spot, piece: PieceId | null = null): PointerHit {
  if ("floor" in spot) return { point: spot.floor, mark: null, onCharacter: false, piece, wall: null };
  return { point: null, mark: (piece === "board" || piece === "window" ? piece : null) as PointerHit["mark"], onCharacter: false, piece, wall: { wall: spot.wall, along: spot.along } };
}

async function pointer(phase: "down" | "move" | "up" | "cancel", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

/** 톡(같은 화면 자리에서 누르고 뗀다). */
async function tap(spot: Spot, piece: PieceId | null = null) {
  await pointer("down", hitAt(spot, piece), 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

/** 누르고(화면 200,300) 손가락을 두 번 옮긴 뒤(화면으로 100px 넘게) 뗀다. 끄는 동안의 창문 자리·끄는 중인지·뜨는 가구를 돌려준다. */
async function pressDragRelease(from: Spot, piece: PieceId | null, to: Spot) {
  await pointer("down", hitAt(from, piece), 200, 300);
  await pointer("move", hitAt(to), 300, 400);
  await pointer("move", hitAt(to), 400, 500);
  await flushAsync();
  const during = { window: windowSpot(editLayout()), dragging: canvas().edit!.dragging, lifted: canvas().edit!.lifted };
  await pointer("up", null, 400, 500);
  await flushAsync();
  return during;
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

async function startEditing() {
  await render(<HomeScreen />);
  await flushAsync();
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
  expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
}

function editLayout(): LobbyLayout {
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  return edit!.layout;
}

function windowSpot(layout: LobbyLayout) {
  return layout.items.find((item) => item.id === "window")?.wall;
}

/** 아무것도 골라지지 않은 꾸미기 모습: 뜨는 가구·벽 칠·바닥 칠·장소 구역이 없고, 돌리기·치우기 버튼이 없다. */
function expectNothingSelected() {
  const edit = canvas().edit!;
  expect(edit.lifted).toBeNull();
  expect(edit.dragging).toBe(false);
  expect(edit.wallMarks).toEqual([]);
  expect(edit.marks).toEqual([]);
  expect(edit.zone ?? null).toBeNull();
  const live = canvas().editLive?.current;
  if (live) expect(live.lifted).toBeNull();
  expect(screen.queryByRole("button", { name: "돌리기" })).toBeNull();
  expect(screen.queryByRole("button", { name: "치우기" })).toBeNull();
}

/** 지금 뜬 알림의 글(없으면 null). */
function alertText(): string | null {
  // 알림 틀(View, accessibilityRole "alert")은 접근성 요소가 아니라서 *ByRole로 찾지 못한다. 글을 모두 찾아 알림 틀 안의 글만 모은다
  type Node = { parent: Node | null; props: Record<string, unknown> };
  const inAlert = (node: Node | null): boolean => {
    for (let at = node; at; at = at.parent) if (at.props.accessibilityRole === "alert") return true;
    return false;
  };
  const texts = screen
    .queryAllByText(/\S/)
    .filter((node) => inAlert(node as unknown as Node))
    .map((node) => [node.props.children].flat().join(""));
  return texts.length > 0 ? texts.join("\n") : null;
}

/** 창문 안내가 떠 있다: 알림 글이 한 줄이고 비어 있지 않으며 지금의 다른 꾸미기 안내와 다르다. */
function expectWindowNotice() {
  const text = alertText();
  expect(text).not.toBeNull();
  expect(text!.trim()).not.toBe("");
  expect(text!.includes("\n")).toBe(false);
  expect(OTHER_EDIT_NOTICES).not.toContain(text);
}

const backHandlers = new Set<() => boolean | null | undefined>();

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
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (layout: LobbyLayout) => JSON.parse(JSON.stringify(layout)));
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

// ---------- 바뀌는 동작 2: 창문을 누르면 안내 한 줄, 창문은 그대로 ----------

describe("[spec] 093 바뀌는 동작 2: 꾸미기에서 창문을 누르면 고르지 않고 안내 한 줄을 잠깐 보여 준다", () => {
  test("[바뀔] V1 창문(뒷벽 4.8)을 톡하면 안내 한 줄이 뜨고, 창문은 골라지지도 뜨지도 않으며 배치가 그대로다. 안내는 5초 안에 사라진다", async () => {
    await startEditing();
    expect(alertText()).toBeNull();

    await tap(back(4.8), "window");

    expectWindowNotice();
    expectNothingSelected();
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    await flushAsync();
    expect(alertText()).toBeNull();
    expectNothingSelected();
  });

  test.each([
    ["뒷벽 6.4", back(6.4) as Spot],
    ["왼벽 8.5(다른 벽)", left(8.5) as Spot],
    ["바닥 (6.9, 8.6)(가장 가까운 벽이 오른벽)", { floor: { x: 6.9, z: 8.6 } } as Spot]
  ])("[바뀔] V2 창문을 눌러 %s로 끌고 떼면, 끄는 동안과 뗀 뒤 모두 창문은 뒷벽 4.8이고 끄는 중이 아니며 뜨지 않고, 안내 한 줄이 떠 있다", async (_label, to) => {
    await startEditing();

    const during = await pressDragRelease(back(4.8), "window", to);

    expect(during).toEqual({ window: back(4.8), dragging: false, lifted: null });
    expectWindowNotice();
    expectNothingSelected();
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
  });

  // 04 메인 세션이 정한 것: 창문 앞 바닥 띠를 누르는 것도 창문을 누른 것과 같다(창문 안내 단언을 더함)
  test("[바뀔] V3 창문 앞 바닥 띠 (4.8, 0.5)를 톡해도 창문이 골라지지 않고 창문 안내 한 줄이 뜨며 배치가 그대로다", async () => {
    await startEditing();

    await tap({ floor: WINDOW_STRIP });

    expectWindowNotice();
    expectNothingSelected();
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
  });

  test("[바뀔] V4 창문을 톡한 뒤 '완료'하면 저장 요청이 없고 방의 창문은 뒷벽 4.8이다", async () => {
    await startEditing();
    await tap(back(4.8), "window");
    expectNothingSelected();

    await pressButton("완료");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(windowSpot(activeLobbyLayout() as LobbyLayout)).toEqual(back(4.8));
  });
});

// ---------- 그대로여야 할 동작: 다른 가구는 지금처럼 고르고 옮기고 저장한다 ----------

describe("[spec] 093 그대로여야 할 동작: 다른 가구의 고르기·옮기기·저장", () => {
  test("[그대로] K1 창문을 눌러 본 뒤에도 게시판을 뒷벽 1.8에서 끌어 왼벽 7.4에 놓으면 왼벽 7.5에 놓이고, '완료'하면 게시판 왼벽 7.5·창문 뒷벽 4.8로 한 번 저장된다", async () => {
    await startEditing();
    await tap(back(4.8), "window");

    await pointer("down", hitAt(back(1.8), "board"), 200, 300);
    await pointer("move", hitAt(left(7.4)), 300, 400);
    await pointer("up", null, 300, 400);
    await flushAsync();
    expect(sortedItems(editLayout())).toEqual(sortedItems(withWall(P0, "board", left(7.5))));

    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const saved = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(sortedItems(saved)).toEqual(sortedItems(withWall(P0, "board", left(7.5))));
    expect(windowSpot(saved)).toEqual(back(4.8));
  });

  test("[그대로] K2 게시판을 창문과 겹치는 뒷벽 4.4로 끌어 놓으면 뒷벽 1.8로 돌아가고 '여기에는 놓을 수 없어요' 안내가 뜬다", async () => {
    await startEditing();

    await pointer("down", hitAt(back(1.8), "board"), 200, 300);
    await pointer("move", hitAt(back(4.4)), 300, 400);
    expect(sortedItems(editLayout())).toEqual(sortedItems(withWall(P0, "board", back(4.5))));
    await pointer("up", null, 300, 400);
    await flushAsync();

    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    expect(screen.getByText("여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요")).toBeTruthy();
  });

  test("[그대로] K3 게시판을 고른 채 오른벽 9.5를 톡하면 게시판이 오른벽 9.5로 옮겨 가고 골라진 채다(창문은 뒷벽 4.8)", async () => {
    await startEditing();
    await tap(back(1.8), "board");
    expect(canvas().edit!.lifted).toBe("board");

    await tap(right(9.5));

    expect(sortedItems(editLayout())).toEqual(sortedItems(withWall(P0, "board", right(9.5))));
    expect(canvas().edit!.lifted).toBe("board");
    expect(windowSpot(editLayout())).toEqual(back(4.8));
  });
});

// ---------- 04 결정 2: 안내 순서(들고 있으면 둘 수 없음, 빨간 가구 먼저, 아무것도 들지 않았을 때만 창문 안내) ----------

const TAP_CANNOT = "여기에는 둘 수 없어요";
const RED_FIRST = "빨간 가구부터 옮겨 주세요";
const BOOKCASE_AT: FloorPoint = { x: 0.5, z: 2.5 };

/** 책장을 골라 한 번 돌려(앞면이 벽을 봄) 빨간 가구로 만들고, 책장을 다시 톡해 고르기를 푼다(064-④ makeRedBookcase와 같은 방법). */
async function makeRedBookcase() {
  await tap({ floor: BOOKCASE_AT }, "bookcase");
  await fireEvent.press(screen.getByRole("button", { name: "돌리기" }));
  await flushAsync();
  await tap({ floor: BOOKCASE_AT }, "bookcase");
  expect(canvas().edit!.marks.map((m) => ({ piece: m.piece, ok: m.ok }))).toEqual([{ piece: "bookcase", ok: false }]);
  // 앞 알림이 사라지게 둔다
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  await flushAsync();
  expect(alertText()).toBeNull();
}

describe("[spec] 093 04 결정 2: 창문 자리를 눌렀을 때의 안내 순서", () => {
  test.each([
    ["N1 창문 자체(뒷벽 4.8)", back(4.8) as Spot, "window" as PieceId | null],
    ["N2 창문 앞 바닥 띠 (4.8, 0.5)", { floor: WINDOW_STRIP } as Spot, null]
  ])("[그대로] 게시판을 든 채 %s를 톡하면 '여기에는 둘 수 없어요'만 뜨고, 게시판은 뒷벽 1.8에서 뜬 채이며 배치가 그대로다", async (_label, spot, piece) => {
    await startEditing();
    await tap(back(1.8), "board");
    expect(canvas().edit!.lifted).toBe("board");

    await tap(spot, piece);

    expect(alertText()).toBe(TAP_CANNOT);
    expect(canvas().edit!.lifted).toBe("board");
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
  });

  test.each([
    ["N3 창문 자체(뒷벽 4.8)", back(4.8) as Spot, "window" as PieceId | null],
    ["N4 창문 앞 바닥 띠 (4.8, 0.5)", { floor: WINDOW_STRIP } as Spot, null]
  ])("[그대로] 빨간 책장이 있는 동안 %s를 톡하면 '빨간 가구부터 옮겨 주세요'만 뜨고, 창문은 골라지지 않으며 뒷벽 4.8 그대로다", async (_label, spot, piece) => {
    await startEditing();
    await makeRedBookcase();

    await tap(spot, piece);

    expect(alertText()).toBe(RED_FIRST);
    expect(canvas().edit!.lifted).toBeNull();
    expect(canvas().edit!.wallMarks).toEqual([]);
    expect(windowSpot(editLayout())).toEqual(back(4.8));
  });
});

// ---------- 04 결정 3: 창문이 다른 자리에 있는 배치를 불러오면 창문을 뒷벽 4.8에 둔다 ----------

describe("[spec] 093 04 결정 3: 불러온 배치의 창문은 뒷벽 4.8이 되고 나머지는 그대로다", () => {
  test("[바뀔] L1 게시판 오른벽 6.0·창문 왼벽 8.0인 배치를 불러오면 방과 꾸미기의 창문은 뒷벽 4.8, 게시판은 오른벽 6.0이고, 게시판을 오른벽 8.0으로 옮겨 '완료'하면 창문 뒷벽 4.8로 저장된다", async () => {
    const loaded = withWall(withWall(P0, "board", right(6.0)), "window", left(8.0));
    const expected = withWall(P0, "board", right(6.0));
    jest.mocked(getLobbyLayout).mockResolvedValue(loaded);

    await render(<HomeScreen />);
    await flushAsync();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(expected));
    await fireEvent.press(screen.getByText("꾸미기"));
    await flushAsync();
    expect(sortedItems(editLayout())).toEqual(sortedItems(expected));

    await pointer("down", hitAt(right(6.0), "board"), 200, 300);
    await pointer("move", hitAt(right(7.9)), 300, 400);
    await pointer("up", null, 300, 400);
    await flushAsync();
    expect(sortedItems(editLayout())).toEqual(sortedItems(withWall(P0, "board", right(8.0))));
    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const saved = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(sortedItems(saved)).toEqual(sortedItems(withWall(P0, "board", right(8.0))));
    expect(windowSpot(saved)).toEqual(back(4.8));
  });

  test("[바뀔] L2 게시판 뒷벽 2.0·창문 뒷벽 5.6인 배치를 불러오면 창문은 뒷벽 4.8, 게시판은 뒷벽 2.0 그대로다(방과 꾸미기 모두)", async () => {
    const loaded = withWall(withWall(P0, "board", back(2.0)), "window", back(5.6));
    const expected = withWall(P0, "board", back(2.0));
    jest.mocked(getLobbyLayout).mockResolvedValue(loaded);

    await render(<HomeScreen />);
    await flushAsync();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(expected));
    await fireEvent.press(screen.getByText("꾸미기"));
    await flushAsync();
    expect(sortedItems(editLayout())).toEqual(sortedItems(expected));
  });
});
