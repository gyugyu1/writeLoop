// [spec] qa 테스트(작업 070 꾸미기 화면 버튼·보관함 아이콘, 기능 변경, 모바일): 홈 '꾸미기'의 버튼 자리(위 여백·아래 줄),
// 보관함 아이콘 줄(가림막 없음, 다시 누르면 닫힘, 꺼낸 뒤에도 열린 채), 가구 모양 그림, 개발 빌드에서만 보이는 '가구 더하기' 탭.
// 기대값은 명세(private 작업 폴더 070-2026-11-11-꾸미기-화면-버튼-보관함-아이콘/01-main-spec.md)에서만 가져오고,
// 그대로 둘 동작은 지금(고치기 전) 동작에서 가져온다. 테스트 이름 앞의 [바뀔]·[그대로]는 보고(02-qa-tests.md)의 분류다.
//
// 어떻게 보나(구현 코드는 부르는 방법을 알려고만 읽었다):
// - 가짜로 두는 것은 기존 보관함 테스트(home-lobby-storage.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내,
//   라우터, 포커스, 3D 그리기). 3D 그리기는 가짜라서 어느 가구를 눌렀는지는 누르기 결과의 piece로 그대로 넣어 보낸다.
// - 운영 빌드·개발 빌드는 전역 __DEV__를 바꿔 흉내 낸다(기존 홈 테스트와 같다). 가정: 화면은 __DEV__를 그릴 때 읽는다.
//   '가구 더하기'를 보지 않는 시험(1~3절)은 탭이 없는 운영 빌드로 돌린다(명세 2·3은 빌드와 관계없다).
// - "줄(자리)": 두 버튼을 함께 품는 가장 가까운 조상(공통 조상)이 가로 줄(flexDirection row)이고, 다른 자리의 버튼을 품지 않는다.
//   "왼쪽·가운데·오른쪽": 그 줄 안의 그리는 순서. "밑": 그리는 순서가 뒤이고 그 둘을 품는 조상이 세로로 쌓는다(가로 줄이 아님).
//   실제 화면에서의 자리·크기는 보지 못한다(보고의 "사용자가 직접 볼 것").
// - 보관함 칸: 가구 이름 글(카탈로그 이름 그대로)을 가진 버튼. 가정: 칸은 accessibilityRole이 button인 누를 수 있는 것이다(기존 화면의 관례).
//   '가구 더하기' 쪽 칸과 구별할 때는 기존 테스트처럼 자신이나 조상의 접근성 이름이 "… 더하기"인 것을 뺀다.
// - 가구 모양 그림: 칸 안의 그림 요소(source가 있는 요소). 가정: 그림은 앱 에셋 PNG를 require로 넣는다(Jest에서는 { testUri: 파일 경로 }가 된다).
// - 개발 빌드의 탭 이름은 명세 그대로 "보관함"·"가구 더하기"이고 역할은 tab이나 button이다(가정). 처음 열면 '보관함' 쪽이 보인다(명세 2가 빌드와 관계없이
//   "'보관함'을 누르면 보관함의 가구가 늘어선 줄이 열린다"고 하므로).
// - 07 결정(2026-11-11 사용자): 보관함 줄의 칸은 보관함의 가구 하나마다 하나(같은 종류도 따로), 개수(×N) 없음, 순서는 보관함 순서,
//   칸을 누르면 그 칸의 가구를 꺼낸다, 칸 이름(접근성 이름)은 가구 이름만. 명세 2의 "종류마다 한 칸, ×N"을 이것으로 바꿔 R1·R8·R11 등을 고쳤다(08-qa-tests.md).
// 엔진의 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다.
// 071(꾸미기 보관함 늘 보이기·완료 위로) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 071-2026-11-11-꾸미기-보관함-늘-보이기-완료-위로/
// 01-main-spec.md, 보고 02-qa-tests.md): 줄은 꾸미기에 들어가면 늘 보이고 아래 '보관함' 버튼·줄의 닫기 버튼이 없어져, openStorage는 누르지 않고
// 줄 머리가 보이는지만 보며, 개수는 줄 머리의 "보관함 N"(개발 빌드는 '보관함 N' 탭 글)에서 읽는다. B1·B2·B3은 새 버튼 자리
// (위 줄: 취소·처음 배치로 … 완료·카메라, 줄 머리: 보관함 N … 돌리기·치우기)로, B5는 '보관함' 버튼 부분을 빼고 '저장 중…'의 자리를,
// R4·R5는 여닫는 버튼이 없는 것으로, R6은 뒤로 가기가 늘 '취소'와 같은 것으로, R7은 나오면 줄이 사라지고 다시 들어가면 바로 보이는 것으로,
// D2·D4의 탭 이름은 "보관함 1"(개수 규칙)로 바꿨다.
// 071에서 이름을 고친 테스트의 [바뀔]·[그대로]는 071 분류이고, 이름을 고치지 않은 테스트의 표시는 070 분류 그대로다
// (071 분류는 071 보고에 테스트마다 적었다. openStorage·storageBadge를 거치는 테스트는 071에서 모두 바뀔 동작이다).
// 가정(071): 줄 머리 글은 버튼이 아니고, 개발 빌드의 탭 역할은 070처럼 tab이다(그래서 버튼 안의 "보관함 N" 글은 없어질 '보관함' 버튼의 글로 본다).
// 086-③(라룹 홈쇼핑 화면) 03 결정 1(사용자)로 고친 것(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/04-홈쇼핑-화면/03-main-decision.md, 보고 05-qa-tests.md):
// 개발용 '가구 더하기' 탭이 없어져 개발 빌드도 운영 빌드처럼 줄 머리가 "보관함 N" 글이고 보관함 칸만 있다. 탭 자체를 보던 D2·D4는 "탭이 없다"로 바꿨고,
// 탭으로 침대를 더하던 D3은 "보관함에 산 침대(bed-1)가 든 배치로 시작해 칸 '침대'를 눌러 꺼낸다"로 준비를 바꿨다(놓인 자리·골라짐·남은 보관함 단언은 그대로,
// "줄은 열린 채"는 '가구 더하기' 칸 대신 남은 보관함 칸이 그대로 보이는지로 본다).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as fs from "fs";
import * as path from "path";
import { BackHandler, StyleSheet } from "react-native";
import * as zlib from "zlib";
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
import { applyLobbyLayout, type FloorPoint, type MarkId, type PointerHit } from "@/lib/lobby3d/engine";
import { FURNITURE_TYPES } from "@/lib/lobby3d/furniture-catalog";
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
const NO_ROOM = "놓을 자리가 없어요. 가구를 옮기거나 치운 뒤 다시 꺼내 주세요";
const STORAGE_EMPTY = "보관함이 비었어요";
const ADD_TAB = "가구 더하기";
/** 개발 빌드의 '보관함' 탭 이름. 071 명세 2: 탭 이름에 보관함 개수 규칙을 붙인다(아래 4절의 배치는 보관함에 옷장 하나라 "보관함 1"). */
const STORAGE_TAB = "보관함 1";
const CAMERA = "카메라 거리 설정";
/** 명세 3: 그림을 만들 치울 수 있는 모든 종류(옷장·깔개·스탠드·침대·협탁·바닥 스탠드·화분·작은 화분·책·액자). */
const REMOVABLE_IDS = ["wardrobe", "rug", "lamp", "bed", "nightstand", "floorLamp", "plant", "smallPlant", "books", "frame"];
const REMOVABLE_NAMES = ["옷장", "깔개", "스탠드", "침대", "협탁", "바닥 스탠드", "화분", "작은 화분", "책", "액자"];
const FURNITURE_NAMES = FURNITURE_TYPES.map((type) => type.name);

// ---------- 배치(기존 보관함·가구 더하기 테스트와 같은 값) ----------

type LayoutItem = LobbyLayout["items"][number];
type Facing = 0 | 1 | 2 | 3;
type Stored = { id: string; type: string };

const floor = (id: string, type: string, x: number, z: number, facing: Facing = 0): LayoutItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): LayoutItem => ({ id, type, wall: { wall: side, along } });
const on = (id: string, type: string, parent: string, slot: number, facing: Facing = 0): LayoutItem => ({ id, type, on: { parent, slot, facing } }) as LayoutItem;

const DEF_ITEMS: LayoutItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8)
];
/** 066-⑤의 N0: DEF + 책상 자리 0의 스탠드. */
const N0_ITEMS: LayoutItem[] = [...DEF_ITEMS, on("lamp", "lamp", "desk", 0, 0)];
/** 066-③의 L-FULL: 깔개가 더 놓일 자리가 없는 방. */
const L_FULL_ITEMS: LayoutItem[] = [
  ...DEF_ITEMS.map((item) => (item.id === "rug" ? floor("rug", "rug", 4.5, 7.5, 0) : item)),
  floor("rug0", "rug", 1.5, 1.5, 0),
  floor("rug1", "rug", 4.5, 1.5, 0),
  floor("rug2", "rug", 1.5, 4.5, 0),
  floor("rug3", "rug", 4.5, 4.5, 0),
  floor("rug4", "rug", 1.5, 7.5, 0)
];

/** 방(items)과 보관함(stored)으로 만든 배치. 보관함이 비면 stored 키를 두지 않는다. */
function layout(items: LayoutItem[], stored: Stored[] = []): LobbyLayout {
  const value = stored.length > 0 ? { items, stored } : { items };
  return JSON.parse(JSON.stringify(value)) as LobbyLayout;
}

const DEF = layout(DEF_ITEMS);
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

async function drag(piece: string, from: FloorPoint, to: FloorPoint) {
  await pointer("down", hit(from, piece), 200, 300);
  await pointer("move", hit(to, null), 300, 400);
  await flushAsync();
  await pointer("up", null, 300, 400);
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

/** 보관함(순서 그대로). */
function storedOf(value: LobbyLayout | null | undefined): Stored[] {
  return ((value as { stored?: Stored[] } | null | undefined)?.stored ?? []).map((s) => ({ id: s.id, type: s.type }));
}

// ---------- 화면 나무(조상·순서·줄) ----------

function rootOf(node: UiNode): UiNode {
  let n = node;
  while (n.parent) n = n.parent;
  return n;
}

function contains(container: UiNode, node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) if (n === container) return true;
  return false;
}

/** 모두를 품는 가장 가까운 조상(자신 포함). */
function commonAncestor(...nodes: UiNode[]): UiNode {
  let found: UiNode | null = nodes[0];
  while (found && !nodes.every((node) => contains(found!, node))) found = found.parent;
  expect(found).not.toBeNull();
  return found!;
}

/** 그리는 순서(나무를 앞에서부터 깊이 우선으로 훑은 차례). */
function orderOf(node: UiNode): number {
  let index = 0;
  let result = -1;
  const visit = (n: UiNode) => {
    if (n === node) result = index;
    index += 1;
    for (const child of n.children) if (typeof child !== "string") visit(child);
  };
  visit(rootOf(node));
  expect(result).toBeGreaterThanOrEqual(0);
  return result;
}

function flexDirectionOf(node: UiNode): string {
  const style = StyleSheet.flatten((node.props as { style?: unknown }).style as never) as { flexDirection?: string } | undefined;
  return style?.flexDirection ?? "column";
}

function isRow(node: UiNode) {
  const direction = flexDirectionOf(node);
  return direction === "row" || direction === "row-reverse";
}

// ---------- 버튼 찾기 ----------

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

function doneButton(): UiNode {
  return screen.getByRole("button", { name: /^(완료|저장 중…)$/ });
}

function cameraButton(): UiNode {
  return screen.getByRole("button", { name: CAMERA });
}

/** 071 명세 2: 줄은 꾸미기에 들어가면 늘 보이고 여는 버튼이 없다. 누르지 않고 줄 머리가 보이는지만 본다. */
async function openStorage() {
  storageHeader();
  await flushAsync();
}

/** 자신이나 조상의 접근성 이름이 "… 더하기"인지(기존 '가구 더하기' 줄의 이름). */
function inAddGroup(node: UiNode): boolean {
  for (let n: UiNode | null = node; n; n = n.parent) {
    const label = (n.props as { accessibilityLabel?: unknown }).accessibilityLabel;
    if (typeof label === "string" && label.endsWith(" 더하기")) return true;
  }
  return false;
}

/** 칸에 보이는 가구 이름(카탈로그 이름 그대로인 글). */
function cellName(cell: UiNode): string {
  const names = FURNITURE_NAMES.filter((name) => within(cell).queryByText(name) !== null);
  expect(names).toHaveLength(1);
  return names[0];
}

/** 지금 보이는 가구 칸 모두(가구 이름 글을 가진 버튼, 그리는 순서). */
function visibleCells(): UiNode[] {
  return screen.queryAllByRole(/button/).filter((button) => FURNITURE_NAMES.some((name) => within(button).queryByText(name) !== null));
}

/** 보관함 쪽 칸('가구 더하기' 쪽을 뺀다). */
function storageCells(): UiNode[] {
  return visibleCells().filter((cell) => !inAddGroup(cell));
}

/** 그 이름의 보관함 칸 가운데 index번째(그리는 순서, 07 결정: 같은 종류도 칸이 따로다). */
function storageCell(name: string, index = 0): UiNode {
  const found = storageCells().filter((cell) => cellName(cell) === name);
  expect(found.length).toBeGreaterThan(index);
  return found[index];
}

/** 칸 안의 그림 요소(source가 있는 요소)들. */
function imagesIn(cell: UiNode): UiNode[] {
  return (cell as unknown as { queryAll: (p: (n: UiNode) => boolean) => UiNode[] }).queryAll((n) => n.props?.source != null);
}

/** 그림 요소의 source에서 찾은 파일 경로(Jest가 require한 PNG를 { testUri }로 바꾼 값). 없으면 null. */
function imageFileOf(image: UiNode): string | null {
  const find = (value: unknown): string | null => {
    if (!value || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = find(entry);
        if (found) return found;
      }
      return null;
    }
    const testUri = (value as { testUri?: unknown }).testUri;
    return typeof testUri === "string" ? testUri : null;
  };
  const testUri = find((image.props as { source?: unknown }).source);
  if (!testUri) return null;
  // react-native의 Jest 에셋 변환은 파일 경로를 react-native/jest 폴더에서 본 상대 경로로 준다
  const transformerDir = path.dirname(require.resolve("react-native/jest/assetFileTransformer.js"));
  return path.resolve(transformerDir, testUri);
}

/** 칸에 "×N"이 있으면 그 글, 없으면 null. */
function countText(cell: UiNode): string | null {
  const found = within(cell).queryAllByText(/×/);
  expect(found.length).toBeLessThanOrEqual(1);
  if (found.length === 0) return null;
  return ([] as unknown[]).concat(found[0].props.children).join("");
}

/** 줄이 사라졌다(꾸미기 밖): 칸·빈 보관함 안내·줄 머리 글·닫기 버튼·'가구 더하기' 글이 없다(카메라 창은 열지 않은 상태에서 본다). */
function expectRowClosed() {
  expect(visibleCells()).toHaveLength(0);
  expect(screen.queryByText(STORAGE_EMPTY)).toBeNull();
  expect(screen.queryAllByText(/^보관함(\s*\d+)?$/)).toHaveLength(0);
  expect(screen.queryAllByRole("button", { name: /닫기/ })).toHaveLength(0);
  expect(screen.queryByText(ADD_TAB)).toBeNull();
}

/** 개발 빌드의 탭(역할 tab이나 button, 이름이 정확히 그 글). */
function tabsNamed(name: string): UiNode[] {
  return screen.queryAllByRole(/^(tab|button)$/, { name });
}

// ---------- PNG 읽기 ----------

interface PngInfo {
  width: number;
  height: number;
  colorType: number;
  bitDepth: number;
  /** 왼쪽 위 모서리 점의 알파(0이면 투명). 알파 채널이 없으면 null. */
  cornerAlpha: number | null;
}

/** PNG 머리(IHDR)와 첫 줄 첫 점의 알파를 읽는다. 첫 줄 첫 점은 어떤 필터든 앞 점·윗줄이 0이라 압축만 풀면 원래 값이다. */
function readPng(file: string): PngInfo {
  const data = fs.readFileSync(file);
  expect(data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  let cornerAlpha: number | null = null;
  if (colorType === 6 || colorType === 4) {
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const channels = colorType === 6 ? 4 : 2;
    const bytes = bitDepth / 8;
    // raw[0]은 첫 줄의 필터 종류, 그다음이 첫 점(채널마다 bytes 바이트), 알파는 마지막 채널이다
    const alphaAt = 1 + (channels - 1) * bytes;
    cornerAlpha = bytes === 2 ? raw.readUInt16BE(alphaAt) : raw[alphaAt];
  }
  return { width, height, colorType, bitDepth, cornerAlpha };
}

// ---------- 준비 ----------

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  // 기본은 운영 빌드(탭 없음). 개발 빌드를 보는 시험은 그리기 전에 바꾼다
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

// ---------- 1. 버튼 자리 ----------

describe("[spec] 070 명세 1: 버튼 자리", () => {
  test("B1 [바뀔] 위 줄(071 명세 1): '취소'·'처음 배치로'·'완료'·카메라가 한 가로 줄에 있고 왼쪽부터 취소, 처음 배치로, 완료, 카메라 순서이며, 그 줄에 줄 머리·돌리기·치우기·보관함 칸이 없다", async () => {
    await renderHome(layout(DEF_ITEMS, [{ id: "rug2", type: "rug" }]));
    await enterEdit();
    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    expect(lifted()).toBe("wardrobe");

    const cancel = screen.getByRole("button", { name: "취소" });
    const reset = screen.getByRole("button", { name: "처음 배치로" });
    const done = doneButton();
    const camera = cameraButton();
    const topRow = commonAncestor(cancel, reset, done, camera);

    expect(isRow(topRow)).toBe(true);
    expect(orderOf(cancel)).toBeLessThan(orderOf(reset));
    expect(orderOf(reset)).toBeLessThan(orderOf(done));
    expect(orderOf(done)).toBeLessThan(orderOf(camera));
    expect(contains(topRow, storageHeader())).toBe(false);
    expect(contains(topRow, screen.getByRole("button", { name: "돌리기" }))).toBe(false);
    expect(contains(topRow, screen.getByRole("button", { name: "치우기" }))).toBe(false);
    expect(contains(topRow, storageCell("깔개"))).toBe(false);
  });

  test("B2 [바뀔] 줄 머리(071 명세 2): 고른 옷장의 돌리기·치우기가 줄 머리의 '보관함 N' 글과 한 가로 줄에 있고 그 글보다 뒤(오른쪽)이며, 그 줄에 취소·처음 배치로·완료·카메라와 칸이 없고, 칸은 줄 머리 뒤에 세로로 쌓인다", async () => {
    await renderHome(layout(DEF_ITEMS, [{ id: "rug2", type: "rug" }]));
    await enterEdit();
    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    expect(lifted()).toBe("wardrobe");

    const header = storageHeader();
    const rotate = screen.getByRole("button", { name: "돌리기" });
    const store = screen.getByRole("button", { name: "치우기" });
    const headRow = commonAncestor(header, rotate, store);
    const cell = storageCell("깔개");

    expect(isRow(headRow)).toBe(true);
    expect(orderOf(header)).toBeLessThan(orderOf(rotate));
    expect(orderOf(header)).toBeLessThan(orderOf(store));
    for (const label of ["취소", "처음 배치로"]) expect(contains(headRow, screen.getByRole("button", { name: label }))).toBe(false);
    expect(contains(headRow, doneButton())).toBe(false);
    expect(contains(headRow, cameraButton())).toBe(false);
    expect(contains(headRow, cell)).toBe(false);
    expect(orderOf(header)).toBeLessThan(orderOf(cell));
    const tray = commonAncestor(header, cell);
    expect(isRow(tray)).toBe(false);
    for (const label of ["취소", "처음 배치로"]) expect(contains(tray, screen.getByRole("button", { name: label }))).toBe(false);
    expect(contains(tray, doneButton())).toBe(false);
  });

  test("B3 [바뀔] 안내 문구는 위 버튼 줄 밑: 보관함 줄 밖이고, '취소'·'처음 배치로'·'완료'보다 뒤에 그리며, 그 버튼들과 안내를 품는 조상은 세로로 쌓는다", async () => {
    await renderHome(layout(DEF_ITEMS, [{ id: "rug2", type: "rug" }]));
    await enterEdit();

    const guide = screen.getByText(GUIDE);
    const cancel = screen.getByRole("button", { name: "취소" });
    const reset = screen.getByRole("button", { name: "처음 배치로" });
    const done = doneButton();
    const tray = commonAncestor(storageHeader(), storageCell("깔개"));

    expect(contains(tray, guide)).toBe(false);
    expect(orderOf(cancel)).toBeLessThan(orderOf(guide));
    expect(orderOf(reset)).toBeLessThan(orderOf(guide));
    expect(orderOf(done)).toBeLessThan(orderOf(guide));
    expect(isRow(commonAncestor(cancel, reset, done, guide))).toBe(false);
  });

  test("B4a [바뀔] 줄 머리: 보관함이 비면 개수 없이 '보관함'이다", async () => {
    await renderHome(DEF);
    await enterEdit();

    expect(storageBadge()).toBeNull();
  });

  test("B4b [바뀔] 줄 머리: 보관함에 3개면 '보관함 3'이다", async () => {
    await renderHome(
      layout(DEF_ITEMS, [
        { id: "wardrobe2", type: "wardrobe" },
        { id: "wardrobe3", type: "wardrobe" },
        { id: "rug2", type: "rug" }
      ])
    );
    await enterEdit();
    expect(storageBadge()).toBe(3);
  });

  test("B5 [바뀔] 저장하는 동안 '취소'·'처음 배치로'는 누를 수 없고 '완료'는 위 줄 그 자리(처음 배치로와 카메라 사이)에서 '저장 중…'이다", async () => {
    let resolveSave: (value: LobbyLayout) => void = () => undefined;
    jest.mocked(saveLobbyLayout).mockReset().mockReturnValue(new Promise<LobbyLayout>((resolve) => (resolveSave = resolve)));
    await renderHome(DEF);
    await enterEdit();
    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    await pressButton("치우기");

    await pressButton("완료");

    const saving = screen.getByRole("button", { name: "저장 중…" });
    const cancel = screen.getByRole("button", { name: "취소" });
    const reset = screen.getByRole("button", { name: "처음 배치로" });
    expect(cancel).toBeDisabled();
    expect(reset).toBeDisabled();
    expect(isRow(commonAncestor(cancel, reset, saving, cameraButton()))).toBe(true);
    expect(orderOf(reset)).toBeLessThan(orderOf(saving));
    expect(orderOf(saving)).toBeLessThan(orderOf(cameraButton()));

    await act(async () => {
      resolveSave(JSON.parse(JSON.stringify(jest.mocked(saveLobbyLayout).mock.calls[0][0])));
    });
    await flushAsync();
    expectNotEditing();
  });
});

// ---------- 2. 보관함 아이콘 줄 ----------

describe("[spec] 070 명세 2: 보관함 아이콘 줄", () => {
  const S3: Stored[] = [
    { id: "wardrobe2", type: "wardrobe" },
    { id: "rug2", type: "rug" },
    { id: "wardrobe3", type: "wardrobe" }
  ];

  test("R1 [바뀔] 꾸미기에 들어가면(누르지 않아도) 가구 하나마다 칸 하나가 보관함 순서로 늘어서고(옷장, 깔개, 옷장), 칸에 개수(×N)가 없고 이름(접근성 이름)은 가구 이름만이며, 칸은 그림 → 이름 순, 칸들은 가로로 넘기는 줄 안에 있다", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();

    await openStorage();

    const cells = storageCells();
    expect(cells.map(cellName)).toEqual(["옷장", "깔개", "옷장"]);
    for (const cell of cells) expect({ name: cellName(cell), count: countText(cell) }).toEqual({ name: cellName(cell), count: null });
    // 07 결정: 칸 이름은 가구 이름만이다(같은 종류 칸이 둘이면 그 이름의 칸이 둘)
    expect(screen.queryAllByRole(/button/, { name: "옷장" }).map((node) => cells.indexOf(node))).toEqual([0, 2]);
    expect(screen.queryAllByRole(/button/, { name: "깔개" }).map((node) => cells.indexOf(node))).toEqual([1]);
    for (const cell of cells) {
      const images = imagesIn(cell);
      expect(images.length).toBeGreaterThan(0);
      // 그림 밑에 이름: 그림을 이름보다 먼저 그린다
      expect(orderOf(images[0])).toBeLessThan(orderOf(within(cell).getByText(cellName(cell))));
    }
    // 넘치면 줄 안에서 옆으로 넘긴다: 칸들을 품는 가로 넘기기(horizontal) 목록이 있다
    let scroller: UiNode | null = commonAncestor(...cells);
    while (scroller && (scroller.props as { horizontal?: unknown }).horizontal !== true) scroller = scroller.parent;
    expect(scroller).not.toBeNull();
  });

  test("R2 [바뀔] 화면을 덮는 가림막이 없다: 줄을 품는 조상(3D 그리기를 품지 않는 것)을 눌러도 줄이 닫히지 않고 배치·보관함이 그대로다", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();
    await openStorage();
    const cell = storageCell("옷장");
    const namesBefore = storageCells().map(cellName);
    const canvasNode = (rootOf(cell) as unknown as { queryAll: (p: (n: UiNode) => boolean) => UiNode[] }).queryAll(
      (n) => n.type === "Lobby3dCanvasMock"
    )[0];
    expect(canvasNode).toBeTruthy();
    const before = JSON.stringify(editLayout());

    const around: UiNode[] = [];
    for (let n: UiNode | null = cell.parent; n && !contains(n, canvasNode); n = n.parent) around.push(n);
    for (const node of around) {
      await fireEvent.press(node);
      await flushAsync();
      expect(storageCells().map(cellName)).toEqual(namesBefore);
      expect(JSON.stringify(editLayout())).toBe(before);
    }
  });

  test("R3 [바뀔, 지금도 통과] 줄이 열린 채로 방의 옷장을 고르고 끌고 돌릴 수 있고, 그동안 줄은 열려 있다", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();
    await openStorage();
    const namesBefore = storageCells().map(cellName);
    expect(namesBefore.length).toBeGreaterThan(0);

    await tapHit(hit(WARDROBE_AT, "wardrobe"));
    expect(lifted()).toBe("wardrobe");
    await drag("wardrobe", WARDROBE_AT, { x: 4.5, z: 6.5 });
    expect(itemIn(editLayout(), "wardrobe")?.floor).toEqual({ x: 4.5, z: 6.5, facing: 3 });
    await pressButton("돌리기");

    expect(itemIn(editLayout(), "wardrobe")?.floor?.facing).toBe(0);
    expect(storageCells().map(cellName)).toEqual(namesBefore);
  });

  test("R4 [바뀔] 줄을 여닫는 '보관함' 버튼이 없고(이름이 '보관함…'인 버튼 없음), 줄은 칸 셋을 보인 채이며 배치·보관함·개수는 그대로다", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();
    await openStorage();
    expect(storageCells()).toHaveLength(3);

    expect(screen.queryAllByRole("button", { name: /^보관함/ })).toHaveLength(0);
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개", "옷장"]);
    expect(editLayout().items).toEqual(layout(DEF_ITEMS).items);
    expect(storedOf(editLayout())).toEqual(S3);
    expect(storageBadge()).toBe(3);
  });

  test("R5 [바뀔] 줄에 닫기 버튼이 없고(이름에 '닫기'인 버튼 없음), 줄은 보인 채이며 배치·보관함은 그대로다", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();
    await openStorage();
    expect(storageCells().map(cellName)).toContain("옷장");

    expect(screen.queryAllByRole("button", { name: /닫기/ })).toHaveLength(0);
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개", "옷장"]);
    expect(storedOf(editLayout())).toEqual(S3);
    expect(storageBadge()).toBe(3);
  });

  test("R6 [바뀔] 줄이 보이는 꾸미기에서 안드로이드 뒤로 가기는 바로 꾸미기 취소다(저장하지 않음)", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();
    await openStorage();
    expect(storageCells().map(cellName)).toContain("옷장");

    const handled = await pressHardwareBack();

    expect(handled).toBe(true);
    expectNotEditing();
    expectRowClosed();
    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });

  test("R7 [바뀔] '취소'나 '완료'로 꾸미기에서 나오면 줄이 사라지고, 다시 들어가면 누르지 않아도 줄이 바로 보인다", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();
    await openStorage();
    expect(storageCells().map(cellName)).toContain("옷장");

    await pressButton("취소");
    expectNotEditing();
    expectRowClosed();
    await enterEdit();
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개", "옷장"]);
    expect(storageBadge()).toBe(3);

    // 바꾼 것이 없어 '완료'는 저장 없이 나온다
    await fireEvent.press(doneButton());
    await flushAsync();
    expectNotEditing();
    expectRowClosed();
    await enterEdit();
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개", "옷장"]);
    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });

  test("R8 [바뀔] 앞 옷장 칸을 누르면 그 칸의 가구(wardrobe2)를 꺼내 고르고 그 칸만 빠져 [깔개, 옷장]이 되며 줄은 열린 채다. 이어서 남은 옷장 칸을 눌러 wardrobe3을 꺼낼 수 있다", async () => {
    await renderHome(layout(DEF_ITEMS, S3));
    await enterEdit();
    await openStorage();
    expect(storageCells().map(cellName)).toEqual(["옷장", "깔개", "옷장"]);

    await fireEvent.press(storageCell("옷장", 0));
    await flushAsync();

    expect(itemIn(editLayout(), "wardrobe2")).toBeDefined();
    expect(lifted()).toBe("wardrobe2");
    expect(storedOf(editLayout())).toEqual([
      { id: "rug2", type: "rug" },
      { id: "wardrobe3", type: "wardrobe" }
    ]);
    expect(storageBadge()).toBe(2);
    // 07 결정: 줄이 열린 채 누른 칸만 빠지고 남은 칸이 앞으로 당겨진다(개수 표시 없음)
    expect(storageCells().map(cellName)).toEqual(["깔개", "옷장"]);
    for (const cell of storageCells()) expect(countText(cell)).toBeNull();

    await fireEvent.press(storageCell("옷장", 0));
    await flushAsync();

    expect(itemIn(editLayout(), "wardrobe3")).toBeDefined();
    expect(lifted()).toBe("wardrobe3");
    expect(storedOf(editLayout())).toEqual([{ id: "rug2", type: "rug" }]);
    expect(storageBadge()).toBe(1);
    expect(storageCells().map(cellName)).toEqual(["깔개"]);
  });

  test("R9 [바뀔] 놓을 자리가 없어 꺼내지 못하면 '놓을 자리가 없어요…'가 뜨고 배치·보관함은 그대로이며 줄은 열린 채다", async () => {
    await renderHome(layout(L_FULL_ITEMS, [{ id: "rug5", type: "rug" }]));
    await enterEdit();
    await openStorage();

    await fireEvent.press(storageCell("깔개"));
    await flushAsync();

    expect(screen.getByText(NO_ROOM)).toBeTruthy();
    expect(itemIn(editLayout(), "rug5")).toBeUndefined();
    expect(storedOf(editLayout())).toEqual([{ id: "rug5", type: "rug" }]);
    expect(storageCells().map(cellName)).toEqual(["깔개"]);
  });

  test("R10 [그대로] 보관함이 비었으면 줄에 '보관함이 비었어요'가 보이고 칸이 없다", async () => {
    await renderHome(DEF);
    await enterEdit();

    await openStorage();

    expect(screen.getByText(STORAGE_EMPTY)).toBeTruthy();
    expect(storageCells()).toHaveLength(0);
  });

  test("R11 [바뀔] 칸 순서는 보관함 순서다: [깔개, 옷장, 깔개]면 칸이 깔개, 옷장, 깔개이고 개수(×N)가 없다", async () => {
    await renderHome(
      layout(DEF_ITEMS, [
        { id: "rug2", type: "rug" },
        { id: "wardrobe2", type: "wardrobe" },
        { id: "rug3", type: "rug" }
      ])
    );
    await enterEdit();

    await openStorage();

    const cells = storageCells();
    expect(cells.map(cellName)).toEqual(["깔개", "옷장", "깔개"]);
    for (const cell of cells) expect(countText(cell)).toBeNull();
  });
});

// ---------- 3. 가구 모양 그림 ----------

describe("[spec] 070 명세 3: 가구 모양 그림", () => {
  test("P1 [바뀔] 치울 수 있는 열 종류 모두 칸에 그림이 있고, 그림은 앱 에셋(apps/mobile/assets) 안의 서로 다른 정사각 PNG이며 왼쪽 위 모서리가 투명하다", async () => {
    // 카탈로그의 치울 수 있는 종류가 명세의 열 종류와 같은지(전제)
    expect(FURNITURE_TYPES.filter((type) => type.removable).map((type) => type.id)).toEqual(REMOVABLE_IDS);
    const stored = REMOVABLE_IDS.map((type) => ({ id: `${type}-9`, type }));
    const start = layout(N0_ITEMS, stored);
    expect(parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(start))))).not.toBeNull();
    await renderHome(start);
    await enterEdit();

    await openStorage();

    const cells = storageCells();
    expect(cells.map(cellName)).toEqual(REMOVABLE_NAMES);
    const assetsDir = path.resolve(path.dirname(require.resolve("react-native/jest/assetFileTransformer.js")), "../../../assets");
    const files = new Set<string>();
    for (const cell of cells) {
      const name = cellName(cell);
      const images = imagesIn(cell);
      expect({ name, images: images.length }).toEqual({ name, images: 1 });
      const file = imageFileOf(images[0]);
      expect({ name, file: file !== null }).toEqual({ name, file: true });
      expect({ name, inAssets: path.relative(assetsDir, file!).startsWith("..") }).toEqual({ name, inAssets: false });
      expect({ name, png: path.extname(file!).toLowerCase() }).toEqual({ name, png: ".png" });
      expect({ name, exists: fs.existsSync(file!) }).toEqual({ name, exists: true });
      const png = readPng(file!);
      expect({ name, square: png.width === png.height && png.width > 0 }).toEqual({ name, square: true });
      expect({ name, alphaChannel: png.colorType === 6 || png.colorType === 4 }).toEqual({ name, alphaChannel: true });
      expect({ name, cornerAlpha: png.cornerAlpha }).toEqual({ name, cornerAlpha: 0 });
      files.add(file!);
    }
    expect(files.size).toBe(REMOVABLE_IDS.length);
  });
});

// ---------- 4. 가구 더하기는 개발 빌드에서만 ----------

describe("[spec] 070 명세 4: 가구 더하기는 개발 빌드에서만", () => {
  const ONE_WARDROBE = layout(N0_ITEMS, [{ id: "wardrobe-1", type: "wardrobe" }]);

  test("D1 [바뀔] 운영 빌드: 꾸미기에서 '가구 더하기'(글·탭·'… 더하기' 칸)가 없고, 줄에는 보관함 칸만 있다", async () => {
    devGlobal.__DEV__ = false;
    await renderHome(ONE_WARDROBE);
    await enterEdit();
    expect(screen.queryByText(ADD_TAB)).toBeNull();

    await openStorage();

    expect(screen.queryByText(ADD_TAB)).toBeNull();
    expect(screen.queryAllByRole(/^(tab|button)$/, { name: /더하기/ })).toHaveLength(0);
    expect(screen.queryAllByLabelText(/더하기/)).toHaveLength(0);
    expect(visibleCells().map(cellName)).toEqual(["옷장"]);
  });

  test("D2 [바뀔] 개발 빌드(086-③): 꾸미기에 들어가면 칸 위에 줄 머리 글 '보관함 1'(개수 규칙)이 있고 '가구 더하기' 탭(글·탭·'… 더하기' 칸)이 없으며 보관함 칸이 보인다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(ONE_WARDROBE);
    await enterEdit();

    await openStorage();

    expect(storageBadge()).toBe(1);
    expect(tabsNamed(STORAGE_TAB)).toHaveLength(0);
    expect(tabsNamed(ADD_TAB)).toHaveLength(0);
    expect(screen.queryByText(ADD_TAB)).toBeNull();
    expect(screen.queryAllByLabelText(/더하기/)).toHaveLength(0);
    const cells = visibleCells();
    expect(cells.map(cellName)).toEqual(["옷장"]);
    expect(orderOf(storageHeader())).toBeLessThan(orderOf(cells[0]));
  });

  test("D3 [바뀔] 개발 빌드(086-③): 보관함의 산 침대 칸은 그림 칸이고(×N 없음), 누르면 bed-1이 (4, 5.5, 0)에 놓여 골라지며 줄은 열린 채다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(layout(N0_ITEMS, [{ id: "wardrobe-1", type: "wardrobe" }, { id: "bed-1", type: "bed" }]));
    await enterEdit();
    await openStorage();

    const cells = visibleCells();
    expect(cells.map(cellName)).toEqual(["옷장", "침대"]);
    for (const cell of cells) {
      expect({ name: cellName(cell), images: imagesIn(cell).length > 0 }).toEqual({ name: cellName(cell), images: true });
      expect(within(cell).queryAllByText(/×/)).toHaveLength(0);
    }

    await fireEvent.press(cells[1]);
    await flushAsync();

    expect(itemIn(editLayout(), "bed-1")).toEqual(floor("bed-1", "bed", 4, 5.5, 0));
    expect(lifted()).toBe("bed-1");
    expect(storedOf(editLayout())).toEqual([{ id: "wardrobe-1", type: "wardrobe" }]);
    // 줄은 열린 채(남은 보관함 칸이 그대로 보인다)
    expect(visibleCells().map(cellName)).toEqual(["옷장"]);
  });

  test("D4 [바뀔] 개발 빌드(086-③): 고를 탭이 없어(역할 tab 없음) 보관함 칸이 늘 보인다", async () => {
    devGlobal.__DEV__ = true;
    await renderHome(ONE_WARDROBE);
    await enterEdit();
    await openStorage();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);

    expect(visibleCells().map(cellName)).toEqual(["옷장"]);
  });
});
