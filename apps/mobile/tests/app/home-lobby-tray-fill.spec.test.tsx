// [spec] qa 테스트(작업 075 꾸미기: 보관함 줄이 아래 공간을 꽉 채우기, 기능 변경, 모바일): 홈 '꾸미기' 동안 보관함 줄이
// 화면 맨 아래·좌우 끝에 붙고, 휴대폰 아래 안전 영역은 줄 안쪽 여백으로 비우며, 테두리·둥근 모서리는 위쪽에만 있는지 본다.
// 꾸미기 밖 로비의 아래 메뉴 배치와 줄 안의 내용은 지금 그대로인지도 본다.
// 기대값은 명세(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/01-main-spec.md의 "바뀌는 동작" 2,
// "그대로여야 할 동작")에서만 가져오고, 그대로 둘 값(아래 메뉴 자리, 칸 크기)은 지금 코드의 값이다.
// 화면 배치는 테스트 도구에 배치 계산이 없어 스타일 값으로 본다(가정, 보고 02-qa-tests.md):
// - "끝에 붙음": 보관함 줄(접근성 이름 "보관함")에서 로비 화면 맨 바깥(3D 그리기가 든 View) 바로 안까지의 View들에 바깥 여백(margin)이 없고,
//   줄을 감싼 View들에 안쪽 여백(padding)이 없으며, 절대 위치인 View는 left·right·bottom이 모두 0이고(그런 View가 하나 이상 있어 아래에 붙는다),
//   가로로 늘이지 않는 맞춤(alignItems·alignSelf가 stretch가 아닌 것)이 없다.
// - "안전 영역은 줄 안쪽 여백": 기기 아래 안전 영역이 34일 때 보관함 줄 자신의 아래 안쪽 여백이 34 이상이다(명세는 비우라고만 해 하한만 본다).
// - "테두리·둥근 모서리는 위쪽에만": 보관함 줄 자신의 스타일에서 아래·왼쪽·오른쪽 테두리 굵기와 아래 두 모서리 둥글기가 0이고, 위쪽 테두리와 위 두 모서리 둥글기가 0보다 크다.
// 가짜로 두는 것은 기존 꾸미기 테스트와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내, 라우터, 포커스, 3D 그리기). 기기 안전 영역은 가짜 값을 준다.
// 운영 빌드(__DEV__ = false)로 돌린다. 실제 폰에서 칸과 제스처 막대가 겹치지 않는지는 사용자가 직접 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { BackHandler, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
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

// ---------- 배치·고정 데이터 ----------

type LayoutItem = LobbyLayout["items"][number];

/** 처음 배치에서 옷장을 보관함에 넣은 배치(보관함 줄에 칸 하나). */
const WARDROBE_STORED: LobbyLayout = JSON.parse(
  JSON.stringify({
    items: DEFAULT_LOBBY_LAYOUT.items.filter((item: LayoutItem) => item.id !== "wardrobe"),
    stored: [{ id: "wardrobe", type: "wardrobe" }]
  })
) as LobbyLayout;

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

/** 기기 안전 영역(아래). 테스트마다 정한다. */
let deviceBottomInset = 0;

async function renderHome(loaded: LobbyLayout | null = null) {
  jest.mocked(getLobbyLayout).mockResolvedValue(loaded);
  await render(<HomeScreen />);
  await flushAsync();
}

async function enterEdit() {
  await fireEvent.press(screen.getByText("꾸미기"));
  await flushAsync();
}

type Style = Record<string, unknown>;

function styleOf(node: UiNode): Style {
  return (StyleSheet.flatten((node.props as { style?: unknown }).style as never) ?? {}) as Style;
}

const num = (value: unknown): number => (typeof value === "number" ? value : 0);
/** 한쪽의 값: 그쪽 이름(paddingBottom) → 가로·세로 묶음(paddingVertical) → 전체(padding) 순으로 읽는다. */
function side(style: Style, base: "margin" | "padding", edge: "Left" | "Right" | "Bottom" | "Top"): number {
  const pair = edge === "Left" || edge === "Right" ? "Horizontal" : "Vertical";
  return num(style[`${base}${edge}`] ?? style[`${base}${pair}`] ?? style[base]);
}
function borderWidth(style: Style, edge: "Left" | "Right" | "Bottom" | "Top"): number {
  return num(style[`border${edge}Width`] ?? style.borderWidth);
}
function cornerRadius(style: Style, corner: "TopLeft" | "TopRight" | "BottomLeft" | "BottomRight"): number {
  const logical = corner.replace("Left", "Start").replace("Right", "End");
  return num(style[`border${corner}Radius`] ?? style[`border${logical}Radius`] ?? style.borderRadius);
}

function isCanvas(node: UiNode | string): boolean {
  return typeof node !== "string" && (node.type as unknown) === "Lobby3dCanvasMock";
}

/** 꾸미기 중의 보관함 줄(접근성 이름 "보관함"). */
function tray(): UiNode {
  return screen.getByLabelText("보관함");
}

/** 보관함 줄에서 로비 화면 맨 바깥(3D 그리기가 든 View) 바로 안까지의 View들(줄 자신이 처음). */
function chainToLobbyRoot(node: UiNode): UiNode[] {
  const chain: UiNode[] = [];
  let current: UiNode | null = node;
  while (current) {
    const parent: UiNode | null = current.parent;
    chain.push(current);
    if (parent && parent.children.some((child) => isCanvas(child as UiNode | string))) return chain;
    current = parent;
  }
  throw new Error("로비 화면 맨 바깥 View를 찾지 못했다");
}

function expectFlushToBottomAndSides() {
  const chain = chainToLobbyRoot(tray());
  const absolute: { left: unknown; right: unknown; bottom: unknown }[] = [];
  chain.forEach((node, index) => {
    const style = styleOf(node);
    const isTray = index === 0;
    expect({ node: index, margin: ["Left", "Right", "Bottom"].map((e) => side(style, "margin", e as "Left")) }).toEqual({ node: index, margin: [0, 0, 0] });
    if (!isTray) {
      expect({ node: index, padding: ["Left", "Right", "Bottom"].map((e) => side(style, "padding", e as "Left")) }).toEqual({ node: index, padding: [0, 0, 0] });
      expect({ node: index, alignItems: style.alignItems ?? "stretch" }).toEqual({ node: index, alignItems: "stretch" });
    }
    expect({ node: index, alignSelf: style.alignSelf ?? "stretch" }).toEqual({ node: index, alignSelf: "stretch" });
    if (style.position === "absolute") absolute.push({ left: style.left, right: style.right, bottom: style.bottom });
    else expect({ node: index, offsets: [num(style.left), num(style.right), num(style.bottom)] }).toEqual({ node: index, offsets: [0, 0, 0] });
  });
  expect(absolute.length).toBeGreaterThan(0);
  for (const offsets of absolute) expect(offsets).toEqual({ left: 0, right: 0, bottom: 0 });
}

/** 꾸미기 밖 아래 메뉴('질문에 답하기' 버튼)를 감싼 절대 위치 View의 스타일. */
function menuBoxStyle(): Style {
  const buttons = screen.getAllByRole("button", { name: "질문에 답하기" });
  expect(buttons).toHaveLength(1);
  for (let node: UiNode | null = buttons[0].parent; node; node = node.parent) {
    const style = styleOf(node);
    if (style.position === "absolute") return style;
  }
  throw new Error("아래 메뉴를 감싼 절대 위치 View를 찾지 못했다");
}

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  devGlobal.__DEV__ = false;
  deviceBottomInset = 0;
  jest.mocked(useSafeAreaInsets).mockImplementation(() => ({ top: 0, left: 0, right: 0, bottom: deviceBottomInset }));
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  jest.spyOn(BackHandler, "addEventListener").mockImplementation(
    () => ({ remove: () => undefined }) as ReturnType<typeof BackHandler.addEventListener>
  );
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

// ---------- 바뀌는 동작 2 ----------

describe("[spec] 075 바뀌는 동작 2: 꾸미기 중 보관함 줄이 아래 공간을 꽉 채운다", () => {
  test("Y1 안전 영역이 없는 기기(아래 0)에서 보관함 줄은 화면 맨 아래·좌우 끝에 붙는다(좌우 여백 12·줄 밑 빈 공간이 없다)", async () => {
    await renderHome(WARDROBE_STORED);
    await enterEdit();

    expectFlushToBottomAndSides();
  });

  test("Y2 제스처 막대가 있는 기기(아래 안전 영역 34)에서도 보관함 줄은 맨 아래·좌우 끝에 붙고, 안전 영역 34는 줄 안쪽 아래 여백으로 비운다", async () => {
    deviceBottomInset = 34;
    await renderHome(WARDROBE_STORED);
    await enterEdit();

    expectFlushToBottomAndSides();
    expect(side(styleOf(tray()), "padding", "Bottom")).toBeGreaterThanOrEqual(34);
  });

  test("Y3 보관함 줄의 테두리·둥근 모서리는 위쪽에만 있다(아래·좌우 테두리 0, 아래 두 모서리 둥글기 0)", async () => {
    await renderHome(WARDROBE_STORED);
    await enterEdit();
    const style = styleOf(tray());

    expect({
      left: borderWidth(style, "Left"),
      right: borderWidth(style, "Right"),
      bottom: borderWidth(style, "Bottom"),
      bottomLeft: cornerRadius(style, "BottomLeft"),
      bottomRight: cornerRadius(style, "BottomRight")
    }).toEqual({ left: 0, right: 0, bottom: 0, bottomLeft: 0, bottomRight: 0 });
    expect(borderWidth(style, "Top")).toBeGreaterThan(0);
    expect(cornerRadius(style, "TopLeft")).toBeGreaterThan(0);
    expect(cornerRadius(style, "TopRight")).toBeGreaterThan(0);
  });
});

// ---------- 그대로여야 할 동작 ----------

describe("[spec] 075 그대로여야 할 동작: 꾸미기 밖 아래 메뉴·탭 막대, 줄 안의 내용", () => {
  // 아래 = 내비게이션 바 자리(72 + 기기 안전 영역에서 24를 뺀 만큼, 0 미만이면 0) + 12. 지금 코드의 값이다.
  test.each([
    { label: "안전 영역 0", inset: 0, bottom: 72 + 12 },
    { label: "안전 영역 34", inset: 34, bottom: 72 + 10 + 12 }
  ])("K1 꾸미기 밖($label)에서는 아래 메뉴가 지금처럼 좌우 12, 아래 $bottom에 있고 탭 막대가 보인다", async ({ inset, bottom }) => {
    deviceBottomInset = inset;
    await renderHome(WARDROBE_STORED);

    const style = menuBoxStyle();
    expect({ left: style.left, right: style.right, bottom: style.bottom }).toEqual({ left: 12, right: 12, bottom });
    expect(screen.getByText("내정보")).toBeTruthy();
  });

  test("K2 꾸미기 중에는 아래 탭 막대가 숨고, 꾸미기를 마치면(취소) 아래 메뉴가 지금 자리(좌우 12, 아래 84)로 돌아온다", async () => {
    await renderHome(WARDROBE_STORED);
    await enterEdit();
    expect(screen.queryByText("내정보")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "취소" }));
    await flushAsync();

    const style = menuBoxStyle();
    expect({ left: style.left, right: style.right, bottom: style.bottom }).toEqual({ left: 12, right: 12, bottom: 84 });
    expect(screen.getByText("내정보")).toBeTruthy();
  });

  test("K3 줄 안의 내용은 그대로다: 줄 머리 '보관함 1', 옷장 칸(폭 76) 안의 그림 상자 64×64(둥글기 16)와 이름 '옷장'", async () => {
    await renderHome(WARDROBE_STORED);
    await enterEdit();
    const box = tray();

    expect(within(box).getByText("보관함 1")).toBeTruthy();
    const tile = within(box).getByRole("button", { name: "옷장" });
    expect(styleOf(tile).width).toBe(76);
    const picture = tile.children.find((child) => typeof child !== "string") as UiNode;
    expect(picture).toBeDefined();
    const pictureStyle = styleOf(picture);
    expect({ width: pictureStyle.width, height: pictureStyle.height, borderRadius: pictureStyle.borderRadius }).toEqual({ width: 64, height: 64, borderRadius: 16 });
    expect(within(tile).getByText("옷장")).toBeTruthy();
  });
});
