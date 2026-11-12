// [spec] qa 테스트(작업 066-⑤ 새 가구, 새 기능, 모바일): 홈 '꾸미기'의 보관함 판에서 '가구 더하기'로 새 가구를 놓고,
// 안내(자리 없음·빨간 가구 먼저·40개)와 취소·완료가 더한 가구를 다루는지, 협탁을 치울 때 위 소품이 보관함에 함께 들어가는지 화면 단위로 본다.
// 기대값은 시나리오(private 작업 폴더 066/06-새-가구/03-qa-scenarios.md의 N1~N4·N11·N13·N14·N16·N18~N20, S1~S3·S5·S6, K3·K4)에서만 가져온다.
// 같은 폴더 04-main-decision.md의 결정 3은 부르는 방법으로만 쓴다: '가구 더하기' 줄의 접근성 이름은 "<가구 이름> 더하기"다.
// 구현(24995ee)에서 읽은 것은 부르는 방법뿐이다: 판의 '가구 더하기' 제목 글, 줄 버튼, 3D 그리기가 받는 edit의 layout·lifted, 버튼 이름("돌리기", "치우기").
// 가짜로 두는 것은 기존 보관함 테스트(home-lobby-storage.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기).
// 3D 그리기는 가짜라서 어느 가구를 눌렀는지는 누르기 결과의 piece로 그대로 넣어 보낸다. 엔진 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
// 070(꾸미기 화면 버튼·보관함 아이콘) 03 결정으로 고친 것(찾는 방법만, 단언의 뜻은 그대로): '가구 더하기'가 보관함 판의 글자 줄에서
// 개발 빌드에서만 보이는 보관함 줄의 '가구 더하기' 탭(아이콘 칸)이 되고, 더한 뒤에도 줄이 열린 채다. 그래서 개발 빌드(__DEV__ = true)로 돌리고,
// '가구 더하기' 칸은 그 탭을 누른 뒤 보이는 칸(가구 이름 글을 가진 버튼)으로 찾으며, 줄이 이미 열려 있으면 '보관함'을 다시 누르지 않는다(다시 누르면 닫힌다).
// 줄을 처음 열면 '보관함' 탭 쪽이 보인다(070 02 가정, 03 결정). N4의 "판이 닫히고"는 "줄이 열린 채"로 바꿨다.
// 070 07 결정(사용자)으로 고친 것: 보관함 쪽 칸은 가구 하나마다 하나, 개수(×N) 없음. 그래서 N3의 보관함 쪽은 [옷장, 옷장, 깔개]에 ×가 없는지 본다
// ('가구 더하기' 탭은 종류마다 한 칸 그대로).
// 071(꾸미기 보관함 늘 보이기·완료 위로) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 071-2026-11-11-꾸미기-보관함-늘-보이기-완료-위로/
// 01-main-spec.md, 보고 02-qa-tests.md): 줄은 꾸미기에 들어가면 늘 보이고 아래 '보관함' 버튼이 없어져, openStorage는 누르지 않고
// 줄 머리가 보이는지만 보며, 개수는 줄 머리의 "보관함 N"(개발 빌드는 '보관함 N' 탭 글)에서 읽는다.
// 가정(071): 줄 머리 글은 버튼이 아니고, 개발 빌드의 탭 역할은 070처럼 tab이다.
// 075(꾸미기: 들린 가구를 탭으로 옮기기) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/
// 01-main-spec.md, 보고 02-qa-tests.md): 가구가 골라져 있을 때 다른 가구를 톡하면 그 가구가 골라지지 않고 골라진 가구를 옮기려 한다.
// 그래서 K4에서 가구를 차례로 고를 때 사이에 앞 가구를 다시 톡해 확정한다(준비만 바꿈. 단언은 그대로).
// 086-③(라룹 홈쇼핑 화면) 03 결정 1(사용자)로 고친 것(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/04-홈쇼핑-화면/03-main-decision.md, 보고 05-qa-tests.md):
// 개발용 '가구 더하기' 탭이 없어져 가구는 홈쇼핑에서 사서 보관함으로 온다. 그래서 새 가구를 방에 넣던 준비는 "보관함에 산 가구(같은 id)가 든 배치로 시작해
// 보관함 줄의 그 칸을 누른다"로 바꿨다(편집기의 꺼내기는 더하기와 같은 자리 찾기를 쓴다). 꾸미기 규칙을 보는 단언과 기대값은 그대로다.
// - 탭 자체를 보던 N1·N2·N3의 탭 부분은 "탭과 '… 더하기' 칸이 없다"로 바꿨다.
// - N14(더하기의 40개 한도)는 꺼내기로는 개수가 늘지 않아 옮길 수 없어, 40개 배치에서도 탭이 없다는 시험으로 바꿨다(40개 한도는 서버 주문의 LAYOUT_FULL이 맡는다).
// - N11의 "보관함 그대로"는 보관함에 둔 산 책이 꺼내지지 않고 남아 있는지로 본다(시작 보관함 그대로).
// - "더한 뒤에도 줄이 열린 채"(expectAddRowOpen)는 꺼낸 뒤에도 보관함 줄 머리가 보이는지로 본다.
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
/** 개발 빌드 보관함 줄의 '가구 더하기' 탭 이름(070 명세 4). */
const ADD_TAB = "가구 더하기";

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

/** 버튼(또는 그 조상)의 접근성 이름. */
function labelOf(node: UiNode): string | null {
  const label = (node.props as { accessibilityLabel?: unknown }).accessibilityLabel;
  return typeof label === "string" ? label : null;
}

/**
 * '가구 더하기' 탭의 칸: 그 탭을 누른 뒤 보이는, 가구 이름 글을 가진 버튼(070 03 결정). 화면 순서대로다.
 * 탭을 누른 뒤에만 부른다(탭이 바뀌면 보관함 칸은 보이지 않는다).
 */
function addRows(): UiNode[] {
  return screen.queryAllByRole(/button/).filter((button) => FURNITURE_NAMES.some((name) => within(button).queryByText(name) !== null));
}

/** 보관함 줄의 '가구 더하기' 탭(역할 tab이나 button, 이름이 정확히 "가구 더하기"). */
function addTabs(): UiNode[] {
  return screen.queryAllByRole(/^(tab|button)$/, { name: ADD_TAB });
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

/**
 * 086-③ 03 결정 1: '가구 더하기' 탭 대신 보관함에 든 산 가구를 꺼낸다(보관함 줄의 그 이름 칸을 누른다).
 * 같은 이름의 칸이 여럿이면 첫 칸이다(보관함 순서).
 */
async function openAndAdd(name: string) {
  await openStorage();
  const rows = storageRows().filter((row) => rowName(row) === name);
  expect(rows.length).toBeGreaterThan(0);
  await fireEvent.press(rows[0]);
  await flushAsync();
}

/** 086-③: 탭이 없고 '… 더하기' 칸도 없다. */
function expectNoAddTab() {
  expect(addTabs()).toHaveLength(0);
  expect(screen.queryAllByText(ADD_TAB)).toHaveLength(0);
  expect(screen.queryAllByRole("button").filter((button) => labelOf(button)?.endsWith(" 더하기") ?? false)).toHaveLength(0);
}

/** 꺼낸 뒤에도 줄이 열린 채다: 보관함 줄 머리가 그대로 보인다(086-③ 03 결정 1로 '가구 더하기' 칸 대신 줄 머리를 본다). */
function expectAddRowOpen() {
  storageHeader();
}

/** 086-③: 산 가구 하나(그 종류의 `<type>-<n>`)가 보관함에 든 배치. */
const boughtStored = (id: string, type: string): Stored => ({ id, type });

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  // 070 03 결정: '가구 더하기'는 개발 빌드에서만 보인다
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

// ---------- N. 가구 더하기 ----------

describe("[spec] 066-⑤ 명세 2: 가구 더하기(N, 화면). 086-③부터는 보관함의 산 가구를 꺼낸다", () => {
  test("N1 보관함이 빈 N0에서 줄을 열면 '보관함이 비었어요'가 보이고 '가구 더하기' 탭이 없다(086-③)", async () => {
    await renderHome(N0);
    await enterEdit();
    await openStorage();

    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expectNoAddTab();
  });

  test("N2 보관함이 빈 N0의 보관함 줄에는 가구 칸이 하나도 없다(새로 만드는 칸이 없다, 086-③)", async () => {
    await renderHome(N0);
    await enterEdit();
    await openStorage();

    expectNoAddTab();
    expect(addRows()).toHaveLength(0);
  });

  test("N3 보관함 [wardrobe-1, wardrobe-2, rug-1]이면 '보관함' 쪽 칸은 '옷장', '옷장', '깔개'(× 없음, 070 07 결정), '가구 더하기' 탭은 없다(086-③)", async () => {
    await renderHome(
      layout(N0_ITEMS, [
        { id: "wardrobe-1", type: "wardrobe" },
        { id: "wardrobe-2", type: "wardrobe" },
        { id: "rug-1", type: "rug" }
      ])
    );
    await enterEdit();
    await openStorage();

    expect(storageRows().map(rowName)).toEqual(["옷장", "옷장", "깔개"]);
    for (const row of storageRows()) expect(within(row).queryAllByText(/×/)).toHaveLength(0);
    expectNoAddTab();
  });

  test("N4 보관함의 산 '침대'를 누르면 줄이 열린 채 bed-1이 (4, 5.5, 0)에 놓여 골라지며(돌리기·치우기 보임) 보관함은 비었다", async () => {
    await renderHome(layout(N0_ITEMS, [boughtStored("bed-1", "bed")]));
    await enterEdit();

    await openAndAdd("침대");

    expectAddRowOpen();
    expect(byId(editLayout().items)).toEqual(byId([...N0_ITEMS, floor("bed-1", "bed", 4, 5.5, 0)]));
    expect(lifted()).toBe("bed-1");
    expect(screen.queryByRole("button", { name: "돌리기" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "치우기" })).not.toBeNull();
    expect(storedOf(editLayout())).toEqual([]);
    expect(storageBadge()).toBeNull();
  });

  test("N11 받침 가구 자리가 다 찼으면 보관함의 산 '책'을 눌러도 놓지 않고 자리 없음 안내가 뜬다", async () => {
    const start = layout(
      [...N0_ITEMS, on("smallPlant-1", "smallPlant", "desk", 1), on("books-1", "books", "desk", 2)],
      [boughtStored("books-2", "books")]
    );
    await renderHome(start);
    await enterEdit();

    await openAndAdd("책");

    expect(screen.getByText(NO_ROOM)).toBeTruthy();
    expect(byId(editLayout().items)).toEqual(byId(start.items));
    // 086-③: 시작 보관함(산 책) 그대로
    expect(storedOf(editLayout())).toEqual(storedOf(start));
  });

  test("N13 산 침대를 꺼내 돌려 빨갛게 한 뒤 보관함의 '화분'을 누르면 놓지 않고 빨간 가구 먼저 안내가 뜬다", async () => {
    await renderHome(layout(N0_ITEMS, [boughtStored("bed-1", "bed"), boughtStored("plant-1", "plant")]));
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

  test("N14 방과 보관함을 합쳐 40개여도 꾸미기에서 새 가구를 만들 탭이 없고 배치는 그대로다(086-③: 40개 한도는 서버 주문이 맡는다)", async () => {
    const stored = Array.from({ length: 33 }, (_, i) => ({ id: `wardrobe-${i + 1}`, type: "wardrobe" }));
    await renderHome(layout(N0_ITEMS, stored));
    await enterEdit();
    await openStorage();

    expectNoAddTab();
    expect(screen.queryByText(LIMIT)).toBeNull();
    expect(byId(editLayout().items)).toEqual(byId(N0_ITEMS));
    expect(storedOf(editLayout())).toEqual(stored);
  });

  test("N16 산 '협탁'을 꺼낸 직후 돌리기를 누르면 nightstand-1의 방향이 1이다", async () => {
    await renderHome(layout(N0_ITEMS, [boughtStored("nightstand-1", "nightstand")]));
    await enterEdit();
    await openAndAdd("협탁");
    expect(lifted()).toBe("nightstand-1");

    await pressButton("돌리기");

    expect(itemIn(editLayout(), "nightstand-1")!.floor!.facing).toBe(1);
  });

  test("N18 산 침대를 꺼낸 직후에는 엔진의 지금 배치(방)에 bed-1이 없다", async () => {
    await renderHome(layout(N0_ITEMS, [boughtStored("bed-1", "bed")]));
    await enterEdit();

    await openAndAdd("침대");

    expect(itemIn(editLayout(), "bed-1")).toBeDefined();
    expect(itemIn(activeLobbyLayout(), "bed-1")).toBeUndefined();
  });

  test("N19 산 침대를 꺼낸 뒤 '취소'하면 저장하지 않고 지금 배치(방)는 N0이며, 다시 들어가 '침대'를 누르면 또 bed-1이다", async () => {
    await renderHome(layout(N0_ITEMS, [boughtStored("bed-1", "bed")]));
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

  test("N20 산 침대를 꺼낸 뒤 '완료'하면 저장이 한 번 불리고 보낸 방은 N0 + bed-1(보관함 없음)이며, 나온 뒤 지금 배치에 bed-1이 있다", async () => {
    await renderHome(layout(N0_ITEMS, [boughtStored("bed-1", "bed")]));
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
    // 075: 다른 가구를 고르기 전에 액자를 다시 톡해 확정한다
    await tapHit({ point: null, mark: null, onCharacter: false, piece: "frame-1", wall: { wall: "left", along: 7.5 } });
    expect(lifted()).toBeNull();

    for (const [id, along] of [
      ["board", 1.8],
      ["window", 4.8]
    ] as const) {
      await tapHit({ point: null, mark: null, onCharacter: false, piece: id, wall: { wall: "back", along } });
      expect(lifted()).toBe(id);
      expect(screen.queryByRole("button", { name: "돌리기" })).toBeNull();
      expect(screen.queryByRole("button", { name: "치우기" })).toBeNull();
      // 075: 다음 가구를 고르기 전에 이 가구를 다시 톡해 확정한다
      await tapHit({ point: null, mark: null, onCharacter: false, piece: id, wall: { wall: "back", along } });
      expect(lifted()).toBeNull();
    }
  });
});
