// [spec] qa 테스트(작업 071 꾸미기 보관함 늘 보이기·완료 위로, 기능 변경, 모바일): 홈 '꾸미기'의 보관함 줄이 늘 보이는지,
// 줄 머리의 "보관함 N"과 개발 빌드 탭, 탭이 꾸미기에 들어갈 때마다 '보관함'으로 시작하는지, 안드로이드 뒤로 가기가 늘 '취소'와 같은지,
// 안내 문구가 알림·카메라 거리 판이 떠 있는 동안 숨는지, '완료'가 하는 일과 저장 중 뒤로 가기가 그대로인지.
// 기대값은 명세(private 작업 폴더 071-2026-11-11-꾸미기-보관함-늘-보이기-완료-위로/01-main-spec.md)에서만 가져오고,
// 그대로 둘 동작은 지금(고치기 전) 동작에서 가져온다. 테스트 이름 앞의 [바뀔]·[그대로]는 보고(02-qa-tests.md)의 분류다.
// 버튼 자리(위 줄·줄 머리)와 줄 머리 개수의 기본 경우는 같은 폴더의 home-lobby-decorate-icons.spec.test.tsx(B1~B5)에서 고쳐 본다.
//
// 어떻게 보나(구현 코드는 부르는 방법을 알려고만 읽었다):
// - 가짜로 두는 것은 home-lobby-decorate-icons.spec.test.tsx와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기).
//   3D 그리기는 가짜라서 어느 가구를 눌렀는지는 누르기 결과의 piece로 그대로 넣어 보낸다.
// - 운영 빌드·개발 빌드는 전역 __DEV__를 바꿔 흉내 낸다(가정: 화면은 __DEV__를 그릴 때 읽는다). 기본은 운영 빌드다.
// - 줄 머리 왼쪽 글: "보관함" 또는 "보관함 N"과 똑같은 글(명세 2). 가정: 줄 머리 글은 버튼이 아니다(버튼 안의 글은 없어질 아래 '보관함' 버튼의 글로 보고 뺀다).
//   개발 빌드의 탭 이름은 "보관함 N"·"가구 더하기"이고 역할은 tab이나 button이다(070 테스트와 같은 가정).
// - '가구 더하기' 탭의 칸은 070처럼 자신이나 조상의 접근성 이름이 "… 더하기"인 것이다(070 그대로).
// - 알림이 "떠 있다"·"사라졌다"는 알림 글이 화면에 있는지로 본다. 알림이 사라지는 시간은 명세에 없어 넉넉히(10초) 흘려 본다.
//   카메라 거리 판은 카메라 버튼(이름 "카메라 거리 설정")으로 열고, 판의 '닫기'나 카메라 버튼을 다시 눌러 닫는다(지금 동작).
// 엔진의 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.

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
import { activeLobbyLayout, applyLobbyLayout, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

/** 화면 요소(Testing Library가 돌려주는 것). */
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

// ---------- 글(명세·지금 화면 그대로) ----------

const GUIDE = "가구를 눌러 고르고, 끌어서 옮겨요";
const RED_FINISH = "빨간 가구를 놓을 수 있는 자리로 옮기거나 돌려 주세요";
const SAVE_FAILED = "배치를 저장하지 못했어요. 다시 눌러 주세요";
const STORAGE_EMPTY = "보관함이 비었어요";
const ADD_TAB = "가구 더하기";
const CAMERA = "카메라 거리 설정";
const FURNITURE_NAMES = FURNITURE_TYPES.map((type) => type.name);
const ADDABLE_NAMES = FURNITURE_TYPES.filter((type) => type.removable).map((type) => type.name);

// ---------- 배치(기존 보관함 테스트와 같은 값) ----------

type LayoutItem = LobbyLayout["items"][number];
type Facing = 0 | 1 | 2 | 3;
type Stored = { id: string; type: string };

const floor = (id: string, type: string, x: number, z: number, facing: Facing = 0): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });

const DEF_ITEMS: LayoutItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8)
];
/** 066-③의 L-OVER: DEF + 책장 자리의 wardrobe2(돌리면 빨간 가구가 된다). */
const L_OVER_ITEMS: LayoutItem[] = [...DEF_ITEMS, floor("wardrobe2", "wardrobe", 0.5, 2.5, 0)];

/** 방(items)과 보관함(stored)으로 만든 배치. 보관함이 비면 stored 키를 두지 않는다. */
function layout(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  const value = stored.length > 0 ? { items, stored } : { items };
  return JSON.parse(JSON.stringify(value)) as LobbyLayout;
}

const DEF = layout(DEF_ITEMS);
const TWO_STORED: Stored[] = [
  { id: "wardrobe2", type: "wardrobe" },
  { id: "rug2", type: "rug" }
];
const WARDROBE_AT: FloorPoint = { x: 7.5, z: 3.5 };

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

// ---------- 개발·운영 빌드, 안드로이드 뒤로 가기(가짜) ----------

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

const backHandlers = new Set<() => boolean | null | undefined>();

async function pressHardwareBack(): Promise<boolean> {
  let handled = false;
  await act(async () => {
    for (const handler of [...backHandlers].reverse()) {
      if (handler()) {
        handled = true;
        break;
      }
    }
  });
  await flushAsync();
  return handled;
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

function hit(point: FloorPoint | null, piece: string | null = null, mark: MarkId | null = null): PointerHit {
  return { point, mark, onCharacter: false, piece };
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

/** 꾸미기 중: 취소·처음 배치로·완료가 있다(안내 문구는 알림에 따라 숨으므로 여기서는 보지 않는다). */
function expectEditingButtons() {
  for (const label of ["취소", "처음 배치로", "완료"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
  expect(screen.queryByText("꾸미기")).toBeNull();
}

function expectNotEditing() {
  expect(screen.queryByText(GUIDE)).toBeNull();
  for (const label of ["취소", "처음 배치로", "완료"]) expect(screen.queryByRole("button", { name: label })).toBeNull();
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

function itemIn(value: LobbyLayout, id: string) {
  return value.items.find((item) => item.id === id);
}

function storedOf(value: LobbyLayout | null | undefined): Stored[] {
  return ((value as { stored?: Stored[] } | null | undefined)?.stored ?? []).map((s) => ({ id: s.id, type: s.type }));
}

/** 자신이나 조상의 역할이 button인지. */
function insideButton(node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) if ((n.props as { accessibilityRole?: unknown }).accessibilityRole === "button") return true;
  return false;
}

/** 줄 머리 왼쪽의 "보관함"·"보관함 N" 글들(버튼 안의 글은 뺀다). */
function storageHeaders(): UiNode[] {
  return screen.queryAllByText(/^보관함(\s*\d+)?$/).filter((node) => !insideButton(node));
}

/** 그 글의 보이는 글자(자식 글을 이어 붙인 것). */
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

/** 줄 머리 글이 하나 있고 그 글이 정확히 text다. */
function expectHeaderText(text: string) {
  const found = storageHeaders();
  expect(found.map(textOf)).toEqual([text]);
}

/** 개발 빌드의 탭(역할 tab이나 button, 이름이 정확히 그 글). */
function tabsNamed(name: string): UiNode[] {
  return screen.queryAllByRole(/^(tab|button)$/, { name });
}

async function pressTab(name: string) {
  const found = tabsNamed(name);
  expect(found).toHaveLength(1);
  await fireEvent.press(found[0]);
  await flushAsync();
}

/** 자신이나 조상의 접근성 이름이 "… 더하기"인지('가구 더하기' 탭의 칸, 070 그대로). */
function inAddGroup(node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) {
    const label = (n.props as { accessibilityLabel?: unknown }).accessibilityLabel;
    if (typeof label === "string" && label.endsWith(" 더하기")) return true;
  }
  return false;
}

function cellName(cell: UiNode): string {
  const names = FURNITURE_NAMES.filter((name) => within(cell).queryByText(name) !== null);
  expect(names).toHaveLength(1);
  return names[0];
}

/** 지금 보이는 가구 칸 모두(가구 이름 글을 가진 버튼, 그리는 순서). */
function visibleCells(): UiNode[] {
  return screen.queryAllByRole(/button/).filter((button) => FURNITURE_NAMES.some((name) => within(button).queryByText(name) !== null));
}

function storageCells(): UiNode[] {
  return visibleCells().filter((cell) => !inAddGroup(cell));
}

function addCells(): UiNode[] {
  return visibleCells().filter((cell) => inAddGroup(cell));
}

/** 알림이 사라질 만큼 시간을 흘린다(명세에 시간이 없어 넉넉히 10초). */
async function letToastExpire() {
  await act(async () => {
    jest.advanceTimersByTime(10_000);
  });
  await flushAsync();
}

/** L-OVER에서 wardrobe2를 골라 돌려 빨간 가구를 만든다(066-③ R9와 같은 조작). */
async function makeRed() {
  await tapHit(hit({ x: 0.5, z: 2.5 }, "wardrobe2"));
  expect(lifted()).toBe("wardrobe2");
  await pressButton("돌리기");
  expect(canvas().edit!.marks.some((mark) => !mark.ok)).toBe(true);
}

// ---------- 준비 ----------

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  devGlobal.__DEV__ = false;
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
  devGlobal.__DEV__ = originalDev;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- 1. 위 버튼 줄: '완료'가 하는 일은 그대로 ----------

describe("[spec] 071 명세 1: '완료'가 하는 일은 그대로", () => {
  test("T1 [그대로] 빨간 가구가 있으면 '완료'를 눌러도 저장하지 않고 '빨간 가구를 … 돌려 주세요'가 뜨며 꾸미기에 남는다", async () => {
    await renderHome(layout(L_OVER_ITEMS));
    await enterEdit();
    await makeRed();

    await pressButton("완료");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(screen.getByText(RED_FINISH)).toBeTruthy();
    expectEditingButtons();
  });
});

// ---------- 2. 보관함 줄은 꾸미기 동안 늘 보인다 ----------

describe("[spec] 071 명세 2: 보관함 줄은 꾸미기 동안 늘 보인다", () => {
  test("T2 [바뀔] 운영 빌드: 보관함에 둘이면 꾸미기에 들어가자마자(아무것도 누르지 않고) 줄 머리 글이 정확히 '보관함 2'이고 칸이 옷장, 깔개다", async () => {
    await renderHome(layout(DEF_ITEMS, TWO_STORED));
    await enterEdit();

    expectHeaderText("보관함 2");
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개"]);
  });

  test("T3 [바뀔] 운영 빌드: 보관함이 비면 꾸미기에 들어가자마자 줄 머리 글이 정확히 '보관함'이고 '보관함이 비었어요'가 보인다", async () => {
    await renderHome(DEF);
    await enterEdit();

    expectHeaderText("보관함");
    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(storageCells()).toHaveLength(0);
  });

  test("T4 [바뀔] 꾸미기 밖 로비에는 줄 머리 글·칸·빈 보관함 안내가 없고, 들어가면 생기며, '취소'로 나오면 다시 없다", async () => {
    await renderHome(layout(DEF_ITEMS, TWO_STORED));
    expect(storageHeaders()).toHaveLength(0);
    expect(storageCells()).toHaveLength(0);

    await enterEdit();
    expect(storageHeaders()).toHaveLength(1);
    expect(storageCells()).toHaveLength(2);

    await pressButton("취소");
    expectNotEditing();
    expect(storageHeaders()).toHaveLength(0);
    expect(storageCells()).toHaveLength(0);
    expect(screen.queryByText(STORAGE_EMPTY)).toBeNull();
  });

  test("T5 [바뀔] 꾸미기 중 옷장을 치우면 줄 머리가 '보관함'에서 '보관함 1'로 바뀌고, 그 칸을 눌러 꺼내면 다시 '보관함'이다", async () => {
    await renderHome(DEF);
    await enterEdit();
    expectHeaderText("보관함");
    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    expect(lifted()).toBe("wardrobe");

    await pressButton("치우기");

    expectHeaderText("보관함 1");
    expect(storageCells().map(cellName)).toEqual(["옷장"]);

    await fireEvent.press(storageCells()[0]);
    await flushAsync();

    expectHeaderText("보관함");
    expect(itemIn(editLayout(), "wardrobe")).toBeDefined();
  });

  test("T6 [바뀔] 운영 빌드: 꾸미기 화면 어디에도 이름이 '보관함…'인 버튼과 이름에 '닫기'가 든 버튼이 없다(줄을 여닫는 방법이 없다)", async () => {
    await renderHome(layout(DEF_ITEMS, TWO_STORED));
    await enterEdit();
    expectHeaderText("보관함 2");

    expect(screen.queryAllByRole("button", { name: /^보관함/ })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /닫기/ })).toHaveLength(0);
  });

  test("T7 [바뀔] 개발 빌드: 보관함에 둘이면 꾸미기에 들어가자마자 탭 '보관함 2'·'가구 더하기'가 보이고 보관함 칸(옷장, 깔개)이 보인다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(layout(DEF_ITEMS, TWO_STORED));
    await enterEdit();

    expect(tabsNamed("보관함 2")).toHaveLength(1);
    expect(tabsNamed(ADD_TAB)).toHaveLength(1);
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개"]);
  });

  test("T7b [바뀔] 개발 빌드: 보관함이 빈 꾸미기의 탭 이름은 정확히 '보관함'이다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(DEF);
    await enterEdit();

    expect(tabsNamed("보관함")).toHaveLength(1);
    expect(tabsNamed(ADD_TAB)).toHaveLength(1);
    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
  });

  test("T8 [바뀔] 개발 빌드: '가구 더하기' 탭으로 바꾼 뒤 '취소'로 나왔다가 다시 들어가면 '보관함' 탭으로 시작한다(보관함 칸이 보이고 '… 더하기' 칸이 없다)", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(layout(DEF_ITEMS, TWO_STORED));
    await enterEdit();
    await pressTab(ADD_TAB);
    expect(addCells().map(cellName)).toEqual(ADDABLE_NAMES);

    await pressButton("취소");
    expectNotEditing();
    await enterEdit();

    expect(addCells()).toHaveLength(0);
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개"]);
  });

  test("T9 [바뀔] 개발 빌드: '가구 더하기' 탭에서 침대를 더하고 '완료'(저장)로 나왔다가 다시 들어가면 '보관함' 탭으로 시작한다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(layout(DEF_ITEMS, TWO_STORED));
    await enterEdit();
    await pressTab(ADD_TAB);
    const bed = addCells().filter((cell) => cellName(cell) === "침대");
    expect(bed).toHaveLength(1);
    await fireEvent.press(bed[0]);
    await flushAsync();
    expect(lifted()).not.toBeNull();

    await pressButton("완료");
    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expectNotEditing();
    await enterEdit();

    expect(addCells()).toHaveLength(0);
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개"]);
  });

  test("T10 [바뀔] 개발 빌드: '가구 더하기' 탭을 보는 중에도 안드로이드 뒤로 가기는 바로 '취소'와 같다(저장하지 않고 나오며 더한 침대는 없다)", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(layout(DEF_ITEMS, TWO_STORED));
    await enterEdit();
    await pressTab(ADD_TAB);
    const bed = addCells().filter((cell) => cellName(cell) === "침대");
    expect(bed).toHaveLength(1);
    await fireEvent.press(bed[0]);
    await flushAsync();

    const handled = await pressHardwareBack();

    expect(handled).toBe(true);
    expectNotEditing();
    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(activeLobbyLayout().items.some((item) => item.type === "bed")).toBe(false);
  });

  test("T11 [바뀔] 운영 빌드: 줄이 보이는 꾸미기에서 옷장을 치운 뒤 안드로이드 뒤로 가기는 '취소'와 같다(저장하지 않고 옷장은 처음 자리)", async () => {
    await renderHome(DEF);
    await enterEdit();
    expectHeaderText("보관함");
    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    await pressButton("치우기");
    expectHeaderText("보관함 1");

    const handled = await pressHardwareBack();

    expect(handled).toBe(true);
    expectNotEditing();
    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(itemIn(activeLobbyLayout(), "wardrobe")?.floor).toEqual({ x: 7.5, z: 3.5, facing: 3 });
  });

  test("T12 [그대로] 저장하는 동안 안드로이드 뒤로 가기는 아무 일도 하지 않는다('저장 중…'인 채 꾸미기에 남고, 저장이 끝나면 저장한 배치로 나온다)", async () => {
    let resolveSave: (value: LobbyLayout) => void = () => undefined;
    jest.mocked(saveLobbyLayout).mockReset().mockReturnValue(new Promise<LobbyLayout>((resolve) => (resolveSave = resolve)));
    await renderHome(DEF);
    await enterEdit();
    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    await pressButton("치우기");
    await pressButton("완료");
    expect(screen.getByRole("button", { name: "저장 중…" })).toBeTruthy();

    await pressHardwareBack();

    expect(screen.getByRole("button", { name: "저장 중…" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave(JSON.parse(JSON.stringify(jest.mocked(saveLobbyLayout).mock.calls[0][0])));
    });
    await flushAsync();
    expectNotEditing();
    expect(itemIn(activeLobbyLayout(), "wardrobe")).toBeUndefined();
    expect(storedOf(activeLobbyLayout())).toEqual([{ id: "wardrobe", type: "wardrobe" }]);
  });
});

// ---------- 3. 안내 문구 ----------

describe("[spec] 071 명세 3: 안내 문구는 알림·카메라 거리 판이 떠 있는 동안 숨는다", () => {
  test("T13 [그대로] 꾸미기에 들어가 알림·카메라 거리 판이 없으면 안내 문구가 보인다", async () => {
    await renderHome(DEF);
    await enterEdit();

    expect(screen.getByText(GUIDE)).toBeTruthy();
  });

  test("T14 [바뀔] 저장 실패 알림이 떠 있는 동안 안내 문구가 없고, 알림이 사라지면 다시 보인다(꾸미기에 남는다)", async () => {
    jest.mocked(saveLobbyLayout).mockReset().mockRejectedValue(new Error("저장 실패"));
    await renderHome(DEF);
    await enterEdit();
    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    await pressButton("치우기");
    expect(screen.getByText(GUIDE)).toBeTruthy();

    await pressButton("완료");

    expect(screen.getByText(SAVE_FAILED)).toBeTruthy();
    expect(screen.queryByText(GUIDE)).toBeNull();
    expectEditingButtons();

    await letToastExpire();

    expect(screen.queryByText(SAVE_FAILED)).toBeNull();
    expect(screen.getByText(GUIDE)).toBeTruthy();
    expectEditingButtons();
  });

  test("T15 [바뀔] 빨간 가구로 '완료'가 막혀 알림이 떠 있는 동안 안내 문구가 없고, 알림이 사라지면 다시 보인다", async () => {
    await renderHome(layout(L_OVER_ITEMS));
    await enterEdit();
    await makeRed();
    expect(screen.getByText(GUIDE)).toBeTruthy();

    await pressButton("완료");

    expect(screen.getByText(RED_FINISH)).toBeTruthy();
    expect(screen.queryByText(GUIDE)).toBeNull();

    await letToastExpire();

    expect(screen.queryByText(RED_FINISH)).toBeNull();
    expect(screen.getByText(GUIDE)).toBeTruthy();
  });

  test("T16 [바뀔] 카메라 거리 판을 연 동안 안내 문구가 없고, 판의 '닫기'로 닫으면 다시 보인다", async () => {
    await renderHome(DEF);
    await enterEdit();
    expect(screen.getByText(GUIDE)).toBeTruthy();

    await pressButton(CAMERA);

    expect(screen.queryAllByLabelText("카메라 거리").length).toBeGreaterThan(0);
    expect(screen.queryByText(GUIDE)).toBeNull();

    await pressButton("닫기");

    expect(screen.queryAllByLabelText("카메라 거리")).toHaveLength(0);
    expect(screen.getByText(GUIDE)).toBeTruthy();
  });

  test("T17 [바뀔] 카메라 거리 판을 카메라 버튼으로 열고 다시 눌러 닫으면, 연 동안만 안내 문구가 없다", async () => {
    await renderHome(DEF);
    await enterEdit();

    await pressButton(CAMERA);
    expect(screen.queryAllByLabelText("카메라 거리").length).toBeGreaterThan(0);
    expect(screen.queryByText(GUIDE)).toBeNull();

    await pressButton(CAMERA);

    expect(screen.queryAllByLabelText("카메라 거리")).toHaveLength(0);
    expect(screen.getByText(GUIDE)).toBeTruthy();
  });
});
