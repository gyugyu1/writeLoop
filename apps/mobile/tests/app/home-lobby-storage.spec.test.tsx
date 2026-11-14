// [spec] qa 테스트(작업 066-③ 제거·보관함·꺼내 놓기, 새 기능, 모바일): 홈 '꾸미기'에서 가구를 치워 보관함에 넣고, 보관함에서 꺼내 놓고,
// 취소·처음 배치로·완료가 보관함까지 다루는지. 편집 모드 밖의 로비가 보관함 가구를 그리지도 막지도 않는지.
// 기대값은 시나리오(private 작업 폴더 066/04-제거-보관함-꺼내기/03-qa-scenarios.md의 R1~R10, S1~S14, S18, C1~C7, C9, C10, K1~K4)와
// 결정(같은 폴더 04-main-decision.md)에서만 가져온다. 결정으로 시나리오의 모호한 점이 정해진 곳:
// - 결정 1(곧은 거리, 같으면 z가 작은 쪽, 그다음 x가 작은 쪽): S12·S18의 "둘 중 하나"를 (3.5, 5.5)로 정했다.
// - 결정 4(목록이 열린 채 뒤로 가기는 목록만 닫음): C3에 더해 "결정 4" 테스트를 더했다.
// - 메인 세션이 정한 것(같은 종류가 여럿이면 보관함 목록에서 앞선 것을 꺼냄): S9에서 꺼내는 id를 wardrobe2로 정했다.
// - 메인 세션이 정한 것(빨간 가구가 있으면 목록은 열리고 줄을 누를 때 막음): S14에서 목록이 열리는 것까지 본다.
// 구현 코드는 부르는 방법을 알려고만 읽었다: 3D 그리기가 받는 edit의 layout(보관함은 layout.stored)·marks·lifted, 버튼의 접근성 이름
// ("돌리기", "치우기"), '보관함' 버튼(글 "보관함"에 개수를 붙임), 목록 줄(가구 이름 글과 "×N" 글을 가진 버튼), 닫기 버튼(글 "닫기"),
// 알림(글).
// 070(꾸미기 화면 버튼·보관함 아이콘) 03 결정으로 고친 것(찾는 방법·닫는 방법만, 단언의 뜻은 그대로): 보관함 판이 아래 버튼 줄 위의
// 아이콘 줄이 되어 가림막이 없어지고, '보관함'을 다시 누르면 닫히며, 칸을 눌러 꺼낸 뒤에도 줄이 열린 채다. 그래서
// '보관함' 버튼은 아래 줄 버튼(이름 "보관함" 또는 "보관함 N", 개발 빌드의 '보관함' 탭과 겹치면 '완료'와 더 가까운 쪽)으로 좁히고,
// S5는 줄의 닫기 버튼(이름에 "닫기"), S6은 가림막 대신 '보관함' 다시 누르기, S7은 "목록이 닫히고"를 "줄이 열린 채"로 바꿨다.
// 070 07 결정(사용자)으로 고친 것: 보관함 줄의 칸은 가구 하나마다 하나(같은 종류도 따로), 개수(×N) 없음, 순서는 보관함 순서.
// 그래서 S3은 [옷장, 옷장, 깔개] 세 칸에 ×가 없는지 보고, 같은 이름의 칸이 여럿일 수 있어 storageRow·takeOut은 그 이름의 앞 칸을,
// storageText는 그 이름의 칸이 있는지를 본다(S9의 "목록에서 앞선 wardrobe2"는 앞 옷장 칸을 눌러 그대로 본다).
// 가짜로 두는 것: 기존 홈 꾸미기 테스트(home-lobby-edit.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태,
// 라우터, 포커스, 3D 그리기). 3D 그리기는 가짜라서, 어느 가구를 눌렀는지는 누르기 결과의 piece로 그대로 넣어 보낸다(그 판정은 보지 못한다).
// 엔진의 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
// 071(꾸미기 보관함 늘 보이기·완료 위로) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 071-2026-11-11-꾸미기-보관함-늘-보이기-완료-위로/
// 01-main-spec.md, 보고 02-qa-tests.md): 줄은 꾸미기에 들어가면 늘 보이고 아래 '보관함' 버튼·줄의 닫기 버튼이 없어져, openStorage는 누르지 않고
// 줄 머리가 보이는지만 보며, 개수는 줄 머리의 "보관함 N"(이 파일은 개발 빌드라 '보관함 N' 탭 글)에서 읽는다. S1은 줄 머리로, S5는 닫기 버튼이 없는 것으로,
// S6은 '보관함' 버튼이 없는 것으로, 결정 4는 줄이 보이는 채 뒤로 가기가 바로 취소인 것으로 바꿨다.
// 071 03 결정 2(사용자: "버튼으로 꾸미기 중 확인"): C10은 저장 실패 알림 바로 뒤의 편집 모드 확인을 안내 문구 대신 버튼으로 본다.
// 가정(071): 줄 머리 글은 버튼이 아니고, 개발 빌드의 탭 역할은 070처럼 tab이다(그래서 버튼 안의 "보관함 N" 글은 없어질 '보관함' 버튼의 글로 본다).
// 보관함·방 목록의 순서는 명세가 정하지 않아 id 순으로 늘어놓고 견준다. 빈 보관함은 stored ?? []로 읽는다(시나리오 A1).
// 075(꾸미기: 들린 가구를 탭으로 옮기기) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/
// 01-main-spec.md, 보고 02-qa-tests.md): 가구가 골라져 있을 때 다른 가구를 톡하면 그 가구가 골라지지 않고 골라진 가구를 옮기려 한다.
// 그래서 R3·R4에서 가구를 차례로 고를 때 사이에 앞 가구를 다시 톡해 확정한다(준비만 바꿈. 단언은 그대로).
// 093(창문 붙박이) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 093-2026-11-14-창문-붙박이/01-main-spec.md, 보고 03-qa-tests.md):
// 창문은 꾸미기에서 눌러도 골라지지 않는다. R4의 창문 부분을 새 동작(창문을 톡해도 골라지지 않고 '치우기' 버튼이 없다)으로 고쳤다.

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
import { SOLID_TILES, activeLobbyLayout, applyLobbyLayout, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";
import { currentFurnitureLayout, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
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

// ---------- 글(명세 그대로) ----------

const GUIDE = "가구를 눌러 고르고, 끌어서 옮겨요";
const RED_FIRST = "빨간 가구부터 옮겨 주세요";
const RED_FINISH = "빨간 가구를 놓을 수 있는 자리로 옮기거나 돌려 주세요";
const CANNOT_PLACE = "여기에는 놓을 수 없어요. 원래 자리로 돌려놓았어요";
const NO_ROOM = "놓을 자리가 없어요. 가구를 옮기거나 치운 뒤 다시 꺼내 주세요";
const SAVE_FAILED = "배치를 저장하지 못했어요. 다시 눌러 주세요";
const STORAGE_EMPTY = "보관함이 비었어요";
const EDIT_NOTICES = [RED_FIRST, CANNOT_PLACE, NO_ROOM];

// ---------- 시나리오의 배치(03 "배치 모음") ----------

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

/** 방(items)과 보관함(stored)으로 만든 배치. 보관함이 비면 stored 키를 두지 않는다(불러온 v2 본문에 stored가 없는 모양). */
function layout(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  const value = stored.length > 0 ? { items, stored } : { items };
  return JSON.parse(JSON.stringify(value)) as LobbyLayout;
}

/** DEF에서 id가 같은 가구를 바꾸고(replace) 더한(add) 방. */
function defWith(replace: LayoutItem[] = [], add: LayoutItem[] = []): LayoutItem[] {
  return [...DEF_ITEMS.map((item) => replace.find((r) => r.id === item.id) ?? item), ...add];
}

const DEF = layout(DEF_ITEMS);
const L1_ITEMS = defWith([], [floor("wardrobe2", "wardrobe", 3.5, 5.5, 0)]);
const L_RUGM_ITEMS = defWith([floor("rug", "rug", 2.5, 5.5, 0)]);
const L_PATH_ITEMS = defWith(
  [],
  [
    floor("w1", "wardrobe", 3.5, 5.5, 0),
    floor("w2", "wardrobe", 5.5, 5.5, 0),
    floor("w3", "wardrobe", 6.5, 5.5, 0),
    floor("w4", "wardrobe", 7.5, 5.5, 0),
    floor("w5", "wardrobe", 3.5, 6.5, 0)
  ]
);
const L_FULL_ITEMS = defWith(
  [floor("rug", "rug", 4.5, 7.5, 0)],
  [
    floor("rug0", "rug", 1.5, 1.5, 0),
    floor("rug1", "rug", 4.5, 1.5, 0),
    floor("rug2", "rug", 1.5, 4.5, 0),
    floor("rug3", "rug", 4.5, 4.5, 0),
    floor("rug4", "rug", 1.5, 7.5, 0)
  ]
);
const L_OVER_ITEMS = defWith([], [floor("wardrobe2", "wardrobe", 0.5, 2.5, 0)]);

/** 각 가구 가운데(누를 곳). */
const AT: Record<string, FloorPoint> = {
  desk: { x: 1.5, z: 5.5 },
  bookcase: { x: 0.5, z: 2.5 },
  wardrobe: { x: 7.5, z: 3.5 },
  rug: { x: 4.6, z: 7.2 }
};

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

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

async function leaveAndReturnHome() {
  await setFocused(false);
  await setFocused(true);
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

/** 가구를 톡 누른다(같은 화면 자리에서 누르고 뗀다). */
async function tapHit(h: PointerHit) {
  await pointer("down", h, 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

/** 바닥 가구를 골라 둔다(그 가구가 띄운 가구가 된 것까지 확인). */
async function selectFloor(id: string, at: FloorPoint) {
  await tapHit(hit(at, id));
  expect(lifted()).toBe(id);
}

/** 벽 가구를 골라 둔다. */
async function selectWall(id: string, side: "back" | "left" | "right", along: number, mark: MarkId | null = null) {
  await tapHit({ point: null, mark, onCharacter: false, piece: id, wall: { wall: side, along } });
  expect(lifted()).toBe(id);
}

/** 누르고(화면 200,300) 끈다(화면으로 100px씩 넘게 움직임). 떼지는 않는다. */
async function pressAndMove(piece: string, from: FloorPoint, to: FloorPoint) {
  await pointer("down", hit(from, piece), 200, 300);
  await pointer("move", hit(to, null), 300, 400);
  await flushAsync();
}

async function release() {
  await pointer("up", null, 300, 400);
  await flushAsync();
}

async function drag(piece: string, from: FloorPoint, to: FloorPoint) {
  await pressAndMove(piece, from, to);
  await release();
}

async function pressButton(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

function rotateButton() {
  return screen.queryByRole("button", { name: "돌리기" });
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

/** 편집 모드다(알림이 떠 있을 때): 세 버튼이 보이고 '꾸미기'가 없다(071 03 결정 2: 안내 문구 대신 버튼으로 본다). */
function expectEditingByButtons() {
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

function hasRedMark() {
  return canvas().edit!.marks.some((mark) => !mark.ok);
}

/** 자신이나 조상의 역할이 button인지. */
function insideButton(node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) if ((n.props as { accessibilityRole?: unknown }).accessibilityRole === "button") return true;
  return false;
}

/**
 * 071 명세 2: 줄 머리 왼쪽의 "보관함"·"보관함 N" 글(운영 빌드는 줄 머리 글, 개발 빌드는 '보관함 N' 탭의 글).
 * 버튼 안의 글은 뺀다(071에서 없어지는 아래 '보관함' 버튼의 글). 줄이 안 보이면 없다.
 */
function storageHeader(): UiNode {
  const found = screen.queryAllByText(/^보관함(\s*\d+)?$/).filter((node) => !insideButton(node));
  expect(found).toHaveLength(1);
  return found[0];
}

/** 줄 머리 "보관함 N"의 개수. 숫자가 없으면 null(지금 '보관함' 버튼의 규칙: 0이면 "보관함"만). */
function storageBadge(): number | null {
  const text = ([] as unknown[]).concat(storageHeader().props.children).join("");
  const digits = text.match(/\d+/);
  return digits ? Number(digits[0]) : null;
}

/** 071 명세 2: 줄은 꾸미기에 들어가면 늘 보이고 여는 버튼이 없다. 누르지 않고 줄 머리가 보이는지만 본다. */
async function openStorage() {
  storageHeader();
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

/** 그 이름의 칸 가운데 index번째(070 07 결정: 같은 종류도 칸이 따로라 여럿일 수 있다. 기본은 앞 칸). */
function storageRow(name: string, index = 0): UiNode {
  const rows = storageRows().filter((row) => within(row).queryByText(name) !== null);
  expect(rows.length).toBeGreaterThan(index);
  return rows[index];
}

/** 그 이름의 앞 칸(보관함에서 앞선 가구)을 눌러 꺼낸다. */
async function takeOut(name: string) {
  await fireEvent.press(storageRow(name));
  await flushAsync();
}

/**
 * '보관함' 묶음 줄에 보이는 그 글(없으면 null). 066-⑤ 04 결정 1의 1로 화면 전체에서 찾던 것을 이 묶음 안으로 좁혔다.
 * 070 07 결정으로 같은 이름의 칸이 여럿일 수 있어 앞 칸의 글을 돌려준다(있는지만 본다).
 */
function storageText(name: string): UiNode | null {
  const found = storageRows()
    .map((row) => within(row).queryByText(name))
    .filter((node): node is UiNode => node !== null);
  return found[0] ?? null;
}

function expectNoNotice() {
  for (const text of EDIT_NOTICES) expect(screen.queryByText(text)).toBeNull();
  expect(screen.queryAllByRole("alert")).toHaveLength(0);
}

function sortedSolid() {
  return [...SOLID_TILES].sort();
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

// ---------- 2. 치우기 ----------

describe("[spec] 066-③ 명세 2: 치우기", () => {
  test("R1 옷장을 고르면 '치우기' 버튼이 보이고 돌리기 버튼도 보인다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);

    expect(storeButton()).not.toBeNull();
    expect(rotateButton()).not.toBeNull();
  });

  test("R2 깔개를 고르면 '치우기' 버튼이 보인다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("rug", AT.rug);

    expect(storeButton()).not.toBeNull();
  });

  test("R3 장소 가구 책상·책장을 각각 고르면 '치우기' 버튼이 없다", async () => {
    await renderHome(DEF);
    await enterEdit();

    await selectFloor("desk", AT.desk);
    expect(storeButton()).toBeNull();
    // 075: 다른 가구를 고르기 전에 책상을 다시 톡해 확정한다
    await tapHit(hit(AT.desk, "desk"));
    expect(lifted()).toBeNull();

    await selectFloor("bookcase", AT.bookcase);
    expect(storeButton()).toBeNull();
  });

  test("R4 [093 바뀔] 벽 가구 게시판(장소 가구)을 고르면 '치우기' 버튼이 없고, 창문은 톡해도 골라지지 않으며 '치우기' 버튼이 없다", async () => {
    await renderHome(DEF);
    await enterEdit();

    await selectWall("board", "back", 1.8, "board");
    expect(storeButton()).toBeNull();
    // 075: 다른 가구를 고르기 전에 게시판을 다시 톡해 확정한다
    await tapHit({ point: null, mark: "board", onCharacter: false, piece: "board", wall: { wall: "back", along: 1.8 } });
    expect(lifted()).toBeNull();

    // 093: 창문은 골라지지 않는다(옛: selectWall로 골라진 것을 확인)
    await tapHit({ point: null, mark: "window", onCharacter: false, piece: "window", wall: { wall: "back", along: 4.8 } });
    expect(lifted()).toBeNull();
    expect(storeButton()).toBeNull();
  });

  test("R5 편집 모드에 들어가기만 하면 '치우기' 버튼이 없다", async () => {
    await renderHome(DEF);
    await enterEdit();

    expect(storeButton()).toBeNull();
  });

  test("R6 옷장을 고른 뒤 끄는 동안(떼기 전) '치우기' 버튼이 없고, 놓을 수 있는 자리에서 떼면 다시 보인다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    expect(storeButton()).not.toBeNull();

    await pressAndMove("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });
    expect(storeButton()).toBeNull();

    await release();
    expect(itemIn(editLayout(), "wardrobe")?.floor).toEqual({ x: 4.5, z: 6.5, facing: 3 });
    expect(storeButton()).not.toBeNull();
  });

  test("R7 옷장을 고르고 '치우기'를 누르면 방에서 빠지고 보관함에 [{wardrobe, wardrobe}]가 들어가며 고르기가 풀린다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);

    await storeSelected();

    expect(itemIn(editLayout(), "wardrobe")).toBeUndefined();
    expect(storedOf(editLayout())).toEqual([{ id: "wardrobe", type: "wardrobe" }]);
    expect(lifted()).toBeNull();
    expect(storeButton()).toBeNull();
    expect(rotateButton()).toBeNull();
  });

  test("R8 치우기 전에는 보관함 버튼에 개수가 없고, 치운 뒤에는 알림 없이 개수 1이 보인다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    expect(storageBadge()).toBeNull();

    await storeSelected();

    expectNoNotice();
    expect(storageBadge()).toBe(1);
  });

  test("R9 L-OVER에서 wardrobe2를 돌려 빨갛게 한 뒤 치우면 빨간 칸이 없고 '완료'가 막히지 않으며 보관함에 wardrobe2가 있다", async () => {
    await renderHome(layout(L_OVER_ITEMS));
    await enterEdit();
    await selectFloor("wardrobe2", { x: 0.5, z: 2.5 });
    await fireEvent.press(rotateButton()!);
    await flushAsync();
    // 돌린 뒤 놓을 수 없는 배치라 빨간 가구가 된다(시작 조건)
    expect(hasRedMark()).toBe(true);

    await storeSelected();

    expect(hasRedMark()).toBe(false);
    expect(storedOf(editLayout())).toEqual([{ id: "wardrobe2", type: "wardrobe" }]);
    await pressButton("완료");
    expect(screen.queryByText(RED_FINISH)).toBeNull();
    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
  });

  test("R10 L1에서 wardrobe2를 치운 뒤 책상을 한 칸 오른쪽(가운데 2.5, 5.5)으로 끌면 놓인다", async () => {
    await renderHome(layout(L1_ITEMS));
    await enterEdit();
    await selectFloor("wardrobe2", { x: 3.5, z: 5.5 });
    await storeSelected();

    await selectFloor("desk", AT.desk);
    await drag("desk", AT.desk, { x: 2.5, z: 5.5 });

    expect(screen.queryByText(CANNOT_PLACE)).toBeNull();
    expect(itemIn(editLayout(), "desk")?.floor).toEqual({ x: 2.5, z: 5.5, facing: 0 });
  });

  test("R10 대조: L1에서 치우기 전에 같은 끌기를 하면 옷장과 겹쳐 돌아가고 '여기에는 놓을 수 없어요…'가 뜬다", async () => {
    await renderHome(layout(L1_ITEMS));
    await enterEdit();

    await selectFloor("desk", AT.desk);
    await drag("desk", AT.desk, { x: 2.5, z: 5.5 });

    expect(screen.getByText(CANNOT_PLACE)).toBeTruthy();
    expect(itemIn(editLayout(), "desk")?.floor).toEqual({ x: 1.5, z: 5.5, facing: 0 });
  });
});

// ---------- 3. 보관함 열기와 꺼내 놓기 ----------

describe("[spec] 066-③ 명세 3: 보관함 열기와 꺼내 놓기", () => {
  test("S1 보관함이 빈 편집 모드에서 줄 머리에 '보관함'이 보이고 숫자가 없다(071)", async () => {
    await renderHome(DEF);
    await enterEdit();

    expect(storageHeader()).toBeTruthy();
    expect(storageBadge()).toBeNull();
  });

  const S2_STORED: Stored[] = [
    { id: "wardrobe2", type: "wardrobe" },
    { id: "wardrobe3", type: "wardrobe" },
    { id: "rug2", type: "rug" }
  ];

  test("S2 보관함에 옷장 둘·깔개 하나를 불러오면 '보관함' 버튼에 3이 보인다", async () => {
    await renderHome(layout(DEF_ITEMS, S2_STORED));
    await enterEdit();

    expect(storageBadge()).toBe(3);
  });

  test("S3 '보관함'을 누르면 칸이 가구마다 3개: 보관함 순서로 '옷장', '옷장', '깔개'이고 어느 칸에도 '×'가 없다(070 07 결정)", async () => {
    await renderHome(layout(DEF_ITEMS, S2_STORED));
    await enterEdit();

    await openStorage();

    expect(storageRows()).toHaveLength(3);
    expect(storageRows().map((row) => FURNITURE_NAMES.filter((name) => within(row).queryByText(name) !== null))).toEqual([["옷장"], ["옷장"], ["깔개"]]);
    for (const row of storageRows()) expect(within(row).queryAllByText(/×/)).toHaveLength(0);
  });

  test("S4 보관함이 빈 채 '보관함'을 누르면 '보관함이 비었어요'가 보이고 가구 줄이 없다", async () => {
    await renderHome(DEF);
    await enterEdit();

    await openStorage();

    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(storageRows()).toHaveLength(0);
  });

  test("S5 줄에 닫기 버튼이 없고(071), 목록은 보인 채 배치와 보관함은 그대로(개수 3)", async () => {
    await renderHome(layout(DEF_ITEMS, S2_STORED));
    await enterEdit();
    await openStorage();
    expect(storageText("옷장")).not.toBeNull();

    expect(screen.queryAllByRole("button", { name: /닫기/ })).toHaveLength(0);
    expect(storageText("옷장")).not.toBeNull();
    expect(roomOf(editLayout())).toEqual(byId(DEF_ITEMS));
    expect(storedOf(editLayout())).toEqual(byId(S2_STORED));
    expect(storageBadge()).toBe(3);
  });

  test("S6 줄을 여닫는 '보관함' 버튼이 없고(071: 이름이 '보관함…'인 버튼 없음), 목록은 보인 채 배치와 보관함은 그대로", async () => {
    await renderHome(layout(DEF_ITEMS, S2_STORED));
    await enterEdit();
    await openStorage();
    expect(storageText("옷장")).not.toBeNull();

    expect(screen.queryAllByRole("button", { name: /^보관함/ })).toHaveLength(0);
    expect(storageText("옷장")).not.toBeNull();
    expect(roomOf(editLayout())).toEqual(byId(DEF_ITEMS));
    expect(storedOf(editLayout())).toEqual(byId(S2_STORED));
    expect(storageBadge()).toBe(3);
  });

  test("S7 L1 + 보관함 wardrobe3: '옷장' 칸을 누르면 줄이 열린 채 wardrobe3이 (4.5, 5.5, 0)에 놓여 골라진 상태가 되며 보관함이 빈다", async () => {
    await renderHome(layout(L1_ITEMS, [{ id: "wardrobe3", type: "wardrobe" }]));
    await enterEdit();
    await openStorage();

    await takeOut("옷장");

    expect(storageText("옷장")).toBeNull();
    // 070 03 결정: 꺼낸 뒤 줄은 열린 채다. 보관함이 비었으므로 줄에 빈 보관함 안내가 보인다
    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(itemIn(editLayout(), "wardrobe3")).toEqual({ id: "wardrobe3", type: "wardrobe", floor: { x: 4.5, z: 5.5, facing: 0 } });
    expect(storedOf(editLayout())).toEqual([]);
    expect(storageBadge()).toBeNull();
    expect(lifted()).toBe("wardrobe3");
    expect(rotateButton()).not.toBeNull();
    expect(storeButton()).not.toBeNull();
  });

  test("S8 S7 다음 다른 조작 없이 돌리기를 누르면 wardrobe3의 방향이 1이 된다", async () => {
    await renderHome(layout(L1_ITEMS, [{ id: "wardrobe3", type: "wardrobe" }]));
    await enterEdit();
    await openStorage();
    await takeOut("옷장");

    await fireEvent.press(rotateButton()!);
    await flushAsync();

    expect(itemIn(editLayout(), "wardrobe3")?.floor?.facing).toBe(1);
  });

  test("S9 보관함에 옷장 wardrobe2·wardrobe3: '옷장' 줄을 누르면 목록에서 앞선 wardrobe2 하나만 방에 놓이고 wardrobe3은 남는다(개수 1)", async () => {
    await renderHome(
      layout(DEF_ITEMS, [
        { id: "wardrobe2", type: "wardrobe" },
        { id: "wardrobe3", type: "wardrobe" }
      ])
    );
    await enterEdit();
    await openStorage();

    await takeOut("옷장");

    expect(itemIn(editLayout(), "wardrobe2")).toBeDefined();
    expect(itemIn(editLayout(), "wardrobe3")).toBeUndefined();
    expect(storedOf(editLayout())).toEqual([{ id: "wardrobe3", type: "wardrobe" }]);
    expect(storageBadge()).toBe(1);
  });

  test("S10 L-RUGM + 보관함 rug2: '깔개' 줄을 누르면 rug2가 (5.5, 5.5, 0)", async () => {
    await renderHome(layout(L_RUGM_ITEMS, [{ id: "rug2", type: "rug" }]));
    await enterEdit();
    await openStorage();

    await takeOut("깔개");

    expect(itemIn(editLayout(), "rug2")?.floor).toEqual({ x: 5.5, z: 5.5, facing: 0 });
  });

  test("S11 L-PATH + 보관함 w6: '옷장' 줄을 누르면 w6가 (3.5, 4.5, 0)이고 빨간 칸이 없다", async () => {
    await renderHome(layout(L_PATH_ITEMS, [{ id: "w6", type: "wardrobe" }]));
    await enterEdit();
    await openStorage();

    await takeOut("옷장");

    expect(itemIn(editLayout(), "w6")?.floor).toEqual({ x: 3.5, z: 4.5, facing: 0 });
    expect(hasRedMark()).toBe(false);
  });

  test("S12·S18 DEF에서 옷장을 치우고 다시 꺼내면 옷장 wardrobe가 (3.5, 5.5, 0)에 놓이고 골라진 상태이며 보관함이 빈다(결정 1)", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    await storeSelected();
    await openStorage();

    await takeOut("옷장");

    expect(itemIn(editLayout(), "wardrobe")?.floor).toEqual({ x: 3.5, z: 5.5, facing: 0 });
    expect(lifted()).toBe("wardrobe");
    expect(storedOf(editLayout())).toEqual([]);
    expect(storageBadge()).toBeNull();
  });

  test("S13 L-FULL + 보관함 rug5: '깔개' 줄을 누르면 꺼내지 않고 '놓을 자리가 없어요…'가 뜬다(배치 그대로, 개수 1)", async () => {
    await renderHome(layout(L_FULL_ITEMS, [{ id: "rug5", type: "rug" }]));
    await enterEdit();
    await openStorage();

    await takeOut("깔개");

    expect(roomOf(editLayout())).toEqual(byId(L_FULL_ITEMS));
    expect(storedOf(editLayout())).toEqual([{ id: "rug5", type: "rug" }]);
    expect(storageBadge()).toBe(1);
    expect(screen.getByText(NO_ROOM)).toBeTruthy();
  });

  test("S14 빨간 가구(wardrobe2)가 있으면 목록은 열리고, '깔개' 줄을 누르면 꺼내지 않고 '빨간 가구부터 옮겨 주세요'가 뜬다", async () => {
    await renderHome(layout(L_OVER_ITEMS, [{ id: "rug2", type: "rug" }]));
    await enterEdit();
    await selectFloor("wardrobe2", { x: 0.5, z: 2.5 });
    await fireEvent.press(rotateButton()!);
    await flushAsync();
    expect(canvas().edit!.marks).toContainEqual(expect.objectContaining({ piece: "wardrobe2", ok: false }));

    await openStorage();
    // 메인 세션이 정한 것: 목록은 열린다
    expect(storageRows()).toHaveLength(1);
    await takeOut("깔개");

    expect(itemIn(editLayout(), "rug2")).toBeUndefined();
    expect(storedOf(editLayout())).toEqual([{ id: "rug2", type: "rug" }]);
    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expect(canvas().edit!.marks).toContainEqual(expect.objectContaining({ piece: "wardrobe2", ok: false }));
  });
});

// ---------- 4. 취소·처음 배치로·완료 ----------

describe("[spec] 066-③ 명세 4: 취소·처음 배치로·완료", () => {
  test("C1 옷장을 치운 뒤 '취소'하면 로비 배치에 옷장이 (7.5, 3.5, 3)으로 있고, 다시 들어가면 보관함 숫자가 없으며 저장하지 않았다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    await storeSelected();

    await pressButton("취소");

    expectNotEditing();
    expect(itemIn(activeLobbyLayout(), "wardrobe")?.floor).toEqual({ x: 7.5, z: 3.5, facing: 3 });
    await enterEdit();
    expect(storageBadge()).toBeNull();
    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });

  test("C2 보관함의 rug2를 꺼낸 뒤 '취소'하면 로비 배치에 rug2가 없고, 다시 들어가면 보관함 개수 1, 목록에 '깔개' 줄", async () => {
    await renderHome(layout(DEF_ITEMS, [{ id: "rug2", type: "rug" }]));
    await enterEdit();
    await openStorage();
    await takeOut("깔개");
    expect(itemIn(editLayout(), "rug2")).toBeDefined();

    await pressButton("취소");

    expect(itemIn(activeLobbyLayout(), "rug2")).toBeUndefined();
    await enterEdit();
    expect(storageBadge()).toBe(1);
    await openStorage();
    expect(storageRows()).toHaveLength(1);
    expect(storageRow("깔개")).toBeTruthy();
  });

  test("C3 옷장을 치운 뒤 (목록이 닫힌 채) 안드로이드 뒤로 가기는 C1과 같다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    await storeSelected();

    await pressHardwareBack();

    expectNotEditing();
    expect(itemIn(activeLobbyLayout(), "wardrobe")?.floor).toEqual({ x: 7.5, z: 3.5, facing: 3 });
    await enterEdit();
    expect(storageBadge()).toBe(null);
    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });

  test("결정 4(071로 바뀜) 보관함 목록이 보이는 채 안드로이드 뒤로 가기는 바로 편집 취소다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await openStorage();
    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();

    await pressHardwareBack();

    expect(screen.queryByText(STORAGE_EMPTY)).toBeNull();
    expectNotEditing();
    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });

  const C4_ITEMS = [...DEF_ITEMS.filter((item) => item.id !== "wardrobe"), floor("wardrobe2", "wardrobe", 3.5, 5.5, 0)];
  const C4_STORED: Stored[] = [
    { id: "wardrobe", type: "wardrobe" },
    { id: "rug2", type: "rug" }
  ];
  const C4_AFTER_STORED: Stored[] = [
    { id: "wardrobe2", type: "wardrobe" },
    { id: "rug2", type: "rug" }
  ];
  // 066-④ 결정 2: 처음 배치에 스탠드(책상 왼쪽 자리)가 더해져, '처음 배치로' 뒤의 방은 DEF에 스탠드를 더한 것이다.
  const DEF_ROOM_AFTER_RESET: LayoutItem[] = [...DEF_ITEMS, { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as LayoutItem];

  test("C4 '처음 배치로': 보관함에 있던 wardrobe도 처음 자리로, 처음 배치에 없는 wardrobe2·rug2는 보관함으로(개수 2, 가구 8개에 처음 배치의 스탠드가 더해져 9개)", async () => {
    await renderHome(layout(C4_ITEMS, C4_STORED));
    await enterEdit();

    await pressButton("처음 배치로");

    expect(roomOf(editLayout())).toEqual(byId(DEF_ROOM_AFTER_RESET));
    expect(storedOf(editLayout())).toEqual(byId(C4_AFTER_STORED));
    expect(storageBadge()).toBe(2);
    const ids = [...editLayout().items.map((item) => item.id), ...storedOf(editLayout()).map((item) => item.id)].sort();
    expect(ids).toEqual(["board", "bookcase", "desk", "lamp", "rug", "rug2", "wardrobe", "wardrobe2", "window"]);
  });

  test("C5 C4 다음 '완료'하면 저장이 한 번 불리고 보낸 배치의 방이 DEF(+ 처음 배치의 스탠드), 보관함이 wardrobe2·rug2", async () => {
    await renderHome(layout(C4_ITEMS, C4_STORED));
    await enterEdit();
    await pressButton("처음 배치로");

    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const sent = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(roomOf(sent)).toEqual(byId(DEF_ROOM_AFTER_RESET));
    expect(storedOf(sent)).toEqual(byId(C4_AFTER_STORED));
  });

  test("C6 옷장을 치운 뒤 '완료'하면 저장이 한 번 불리고 보낸 배치에 옷장이 없으며 보관함이 [wardrobe], 나온 뒤 로비 배치에도 옷장이 없다", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    await storeSelected();

    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    const sent = jest.mocked(saveLobbyLayout).mock.calls[0][0];
    expect(itemIn(sent, "wardrobe")).toBeUndefined();
    expect(storedOf(sent)).toEqual([{ id: "wardrobe", type: "wardrobe" }]);
    expectNotEditing();
    expect(itemIn(activeLobbyLayout(), "wardrobe")).toBeUndefined();
  });

  test("C7 보관함의 rug2를 꺼낸 뒤 바로 치우고 '완료'하면 저장하지 않고 편집 모드가 끝난다", async () => {
    await renderHome(layout(DEF_ITEMS, [{ id: "rug2", type: "rug" }]));
    await enterEdit();
    await openStorage();
    await takeOut("깔개");
    expect(lifted()).toBe("rug2");
    await storeSelected();

    await pressButton("완료");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expectNotEditing();
  });

  test("C9 C6 뒤 홈을 떠났다 돌아와 저장한 배치를 불러오고 '꾸미기'에 들어가면 보관함 1, 목록에 '옷장' 줄", async () => {
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    await storeSelected();
    await pressButton("완료");
    const saved = await jest.mocked(saveLobbyLayout).mock.results[0].value;
    jest.mocked(getLobbyLayout).mockResolvedValue(JSON.parse(JSON.stringify(saved)));

    await leaveAndReturnHome();
    await enterEdit();

    expect(storageBadge()).toBe(1);
    await openStorage();
    expect(storageRows()).toHaveLength(1);
    expect(storageRow("옷장")).toBeTruthy();
  });

  test("C10 옷장을 치운 뒤 '완료'에서 저장이 실패하면 '배치를 저장하지 못했어요…'가 뜨고 편집 모드가 남으며 보관함 개수 1 그대로", async () => {
    jest.mocked(saveLobbyLayout).mockReset().mockRejectedValue(new Error("저장 실패"));
    await renderHome(DEF);
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    await storeSelected();

    await pressButton("완료");

    expect(screen.getByText(SAVE_FAILED)).toBeTruthy();
    // 071 03 결정 2: 알림이 떠 있는 동안 안내 문구가 숨으므로 버튼으로 편집 모드인지 본다
    expectEditingByButtons();
    expect(storageBadge()).toBe(1);
  });
});

// ---------- 5. 그대로여야 할 동작 ----------

describe("[spec] 066-③ 명세 5: 편집 모드 밖의 로비", () => {
  test("K1·K2 보관함에 wardrobe2가 든 배치를 불러오면(편집 모드 아님) 가구 자리와 막힌 칸이 DEF와 같다", async () => {
    const defSolid = sortedSolid();
    const defPlacements = furniturePlacements(DEF);

    await renderHome(layout(DEF_ITEMS, [{ id: "wardrobe2", type: "wardrobe" }]));

    const current = currentFurnitureLayout();
    expect(current.some((place) => place.item === "wardrobe2")).toBe(false);
    expect(current).toEqual(defPlacements);
    expect(sortedSolid()).toEqual(defSolid);
    // 불러온 배치가 실제로 들어왔는지(보관함 1)
    await enterEdit();
    expect(storageBadge()).toBe(1);
  });

  test("K3 C6 뒤(편집 모드 밖) 막힌 칸에 옷장 칸 '7,3'이 없고 가구 자리에 wardrobe가 없다", async () => {
    await renderHome(DEF);
    expect(sortedSolid()).toContain("7,3");
    await enterEdit();
    await selectFloor("wardrobe", AT.wardrobe);
    await storeSelected();
    await pressButton("완료");
    expectNotEditing();

    expect(sortedSolid()).not.toContain("7,3");
    expect(currentFurnitureLayout().some((place) => place.item === "wardrobe")).toBe(false);
  });

  test("K4 stored 없는 v2 본문을 불러와 '꾸미기'에 들어가면 DEF가 보이고 '보관함' 버튼에 숫자가 없다", async () => {
    const loaded = parseLobbyLayoutPayload(JSON.parse(JSON.stringify({ version: 2, items: DEF_ITEMS })));
    expect(loaded).not.toBeNull();
    await renderHome(loaded);

    await enterEdit();

    expect(roomOf(editLayout())).toEqual(byId(DEF_ITEMS));
    expect(storageBadge()).toBeNull();
  });
});
