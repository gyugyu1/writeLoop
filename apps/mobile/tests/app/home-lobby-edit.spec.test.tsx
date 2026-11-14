// [spec] qa 테스트(작업 064-③ 편집 모드: 바닥 가구, 모바일): 홈 '꾸미기'에서 바닥 가구를 고르고 끌고 돌려 계정에 저장하는지.
// 기대값은 시나리오(private 작업 폴더 064/04-바닥-가구-편집/02-qa-scenarios.md, 04-qa-scenarios.md)와
// 결정(같은 폴더 03-main-decision.md, 06-main-decision.md)에서만 가져온다.
// 구현 코드는 부르는 방법(3D 그리기가 받는 edit·viewWidth, 누르기 결과의 piece, 돌리기 버튼의 접근성 이름 "돌리기")을 알려고만 읽었다.
// 가짜로 두는 것: 기존 홈 테스트(home-lobby-layout-load.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태,
// 라우터, 포커스, 3D 그리기). 3D 그리기는 가짜라서, 어느 가구를 눌렀는지(의자 → 책상, 깔개 위 가구, 벽 가구는 ④부터 골라짐)는
// 3D 그리기가 판정한 값(piece)을 누르기 결과로 그대로 넣어 보낸다. 그 판정 자체는 이 테스트로 보지 못한다(보고에 적음).
// 엔진의 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다(02 가정 A6).
// 071(private 작업 폴더 071-2026-11-11-꾸미기-보관함-늘-보이기-완료-위로) 03 결정 2로 고친 것: 안내 문구가 알림이 떠 있는 동안 숨으므로,
// 알림 바로 뒤의 편집 모드 확인(finishExpectRedBlocked, R7·R8의 '처음 배치로' 뒤, X5, X6)을 안내 대신 버튼으로 본다(expectEditingByButtons).
// 064-④ 결정 11의 1(책상도 게시판·창문 바로 아래 칸에 놓을 수 없음)에 맞춰 M10(책상 → 창문 아래)을 "돌아간다"로 옮기고,
// R10은 창문을 왼쪽 벽에 건 배치 LW에서 시작하게 고쳤다(K-right 칸 5~7,0이 창문 아래가 되어서).
// 065 결정 19(고른 가구를 다시 톡하면 고르기가 풀림)에 맞춰 R5에서 아직 골라진 책장을 다시 톡하던 조작을 뺐다(확인하는 뜻은 그대로).
// 066-①(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서 배치 데이터와 저장 본문이 v2(version 2, 가구 인스턴스 목록)로 바뀌어,
// 명세의 "고칠 기존 테스트"대로 확인하는 뜻·기대 동작은 그대로 두고 배치 모양만 v2로 고쳤다. 배치 값(자리·방향·벽)은 그대로다.
// 066-②(private 작업 폴더 066/03-모델-칸에-맞추기/01-main-spec.md)에서 깔개가 차지하는 칸이 2×2에서 3×3이 되어, 명세의 "고칠 기존 테스트"대로
// 2×2에 기대던 것만 고쳤다: 깔개 끌기 G1·G2·G5의 놓이는 자리를 3칸에 맞춘 자리(칸 가운데가 0.5 단위)로 고쳤다(G1 (2, 2) → (1.5, 2.5), G2 (7, 7) → (6.5, 7.5),
// G5 (5, 7) → (4.5, 7.5)). G3·G4·G6은 결과가 같아 이름 속 맞춘 자리만 고쳤다. 끄는 입력은 그대로다.
// 067(private 작업 폴더 067/01-main-spec.md)에서 책상 장소의 바라볼 지점이 가구 기준 (-0.25, 0) → (0, 0)으로 옮겨져, 명세의 "고칠 기존 테스트"대로
// M2의 바라볼 지점만 (5.25, 8.5) → (5.5, 8.5)로 고쳤다. 끄는 입력과 나머지 단언은 그대로다.
// 075(꾸미기: 들린 가구를 탭으로 옮기기) 명세의 "고칠 기존 테스트"로 고친 것(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/
// 01-main-spec.md, 보고 02-qa-tests.md): 가구가 골라져 있을 때 다른 곳을 톡하면 그 가구를 그리로 옮기고 골라진 채 두며(자신을 톡하면 확정),
// 둘 수 없으면 옮기지 않고 "여기에는 둘 수 없어요" 안내를 띄운다(탭한 곳의 가구는 골라지지 않는다).
// - S5·S6: 옛 동작(빈 곳이면 풀림, 벽 가구가 골라짐)을 새 동작으로 고쳤다. 기대 자리는 명세의 칸 맞춤으로 손으로 셈했다.
// - S3: 끈 옷장의 고르기를 빈 바닥 톡 대신 옷장을 다시 톡해 푼다(준비만 바꿈). R4·S8: 빨간 책장의 고르기를 책장을 다시 톡해 푼다(준비만 바꿈).

// 작업 079 03 결정(사용자 2026-11-11 "가짜 그림판이 신호를 보내게"): 방이 처음 보이기 전에는 이름표·장소 안내·말풍선을 숨기므로,
// 가짜 3D 그림판이 처음 그려진 뒤 '방이 보였다'(onRoomShown)를 한 번 부르게 준비만 바꿨다. 단언·기대값·입력은 그대로다.
// 작업 085 03 결정 1(사용자 2026-11-12, private 작업 폴더 085-2026-11-12-로비-꾸미기-완료-빠르게): '완료'로 나오면 로딩 표시("방을 정리하고 있어요")가
// 떠 있는 동안 이름표를 숨기므로, X3·X11은 '완료' 직후 표시가 보이고 이름표가 숨는지 본 뒤 1.5초가 지나 표시가 내려가면 이름표가 보이는지 보게 고쳤다.
// 저장 한 번·새 배치·막힌 칸·메뉴·탭 확인은 그대로다.
// 093(창문 붙박이) 07-main-decision.md(사용자 "qa가 창문 기대값만 4.8로", private 작업 폴더 093-2026-11-14-창문-붙박이, 보고 12-qa-tests.md):
// 창문이 늘 뒷벽 4.8이라 창문을 왼벽 8.5에 둔 배치 LW가 생기지 않는다. 13-main-decision.md(사용자 "창문 대신 다른 벽 가구로", 보고 14-qa-tests.md)대로
// LW를 게시판을 왼벽 8.5에 둔 배치 LB(창문 뒷벽 4.8)로 바꿨다. 게시판도 왼벽 7.6~9.4를 차지하고 아래 끝(1.05)이 옷장 윗면(2.38)보다 낮아,
// 옷장을 놓을 수 없는 칸(0,7·0,8·0,9)과 놓을 수 있는 칸(0,6·0,10)이 LW의 창문(7.35~9.65)과 같다(M14·U7·U8·U9·U10, 기대 결과 그대로).
// R10은 LW를 쓴 이유(뒷벽 오른쪽을 비워 책상을 K-right에 놓음)를 LB로 살린다: 게시판이 왼벽으로 가 뒷벽 왼쪽이 비므로, 책상을 K-left (1.5, 0.5)
// (칸 0~2,0, 창문 아래 칸 3~5와 겹치지 않음)로 옮겨 한 번 돌리면 방 밖으로 나가 빨간 가구가 된다(기대 결과 그대로).
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
import { clearIncompleteLoop, getIncompleteLoop, type IncompleteLoopState } from "@/lib/incomplete-loop";
import {
  CHAIR,
  MARKS,
  SOLID_TILES,
  activeLobbyLayout,
  applyLobbyLayout,
  isFree,
  type FloorPoint,
  type MarkId,
  type PointerHit
} from "@/lib/lobby3d/engine";
import { currentFurnitureLayout, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { LOBBY3D_VIEW_WIDTH_KEY } from "@/lib/lobby3d/view-storage";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot, WritingDraft } from "@/lib/types";
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
  // 처음 그려진 뒤 '방이 보였다'를 한 번 알린다(작업 079 03 결정)
  function MockLobby3dCanvas(props: Lobby3dCanvasProps) {
    mockCanvas.props = props;
    const onRoomShown = (props as Lobby3dCanvasProps & { onRoomShown?: () => void }).onRoomShown;
    const roomShownSent = React.useRef(false);
    React.useEffect(() => {
      if (roomShownSent.current || !onRoomShown) return;
      roomShownSent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
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

/** 진짜 저장 함수(api.ts). 로그인 만료(서버 401)를 거쳐야 하는 시나리오(X6)에서 부른다. */
const actualApi = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");

// ---------- 시나리오의 글(명세 그대로, 02 가정 A1) ----------

const GUIDE = "가구를 눌러 고르고, 끌어서 옮겨요";
const RED_FIRST = "빨간 가구부터 옮겨 주세요";
/** 075 명세: 골라진 가구를 둘 수 없는 곳을 톡했을 때의 안내(명세의 글 "여기에는 둘 수 없어요". 보고 02-qa-tests.md의 모호한 점 참고). */
const TAP_CANNOT = "여기에는 둘 수 없어요";
const RED_FINISH = "빨간 가구를 놓을 수 있는 자리로 옮기거나 돌려 주세요";
const SAVE_FAILED = "배치를 저장하지 못했어요. 다시 눌러 주세요";
const STREAK_CHIP = "연속 2일";
const MENU_LABELS = ["질문에 답하기", "영어일기", "지금 생각나는대로", "학습 기록"];
const TAB_LABELS = ["홈", "기록", "내정보"];
/** 085: '완료'로 꾸미기에서 나온 뒤 뜨는 로딩 표시 글(085 명세 바뀌는 동작 2). */
const DONE_LOADING = "방을 정리하고 있어요";
const NAME_TAGS = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로", "학습 기록"];
const ALL_MARKS: MarkId[] = ["board", "window", "desk", "bookcase", "door"];

// ---------- 시나리오의 배치(02 "좌표와 배치 이름", 04) ----------

// ---------- 066-① 배치 데이터 v2 ----------
// 배치는 { items: [{ id, type, floor?: { x, z, facing }, wall?: { wall, along } }] }이고 처음 배치의 인스턴스 id는 종류 id와 같다(066-① 명세 2).
// 064·065 때 적은 배치 값을 바닥 가구·벽 가구 묶음으로 그대로 두고 v2()로 목록을 만든다. 목록 순서는 명세가 정하지 않아 견줄 때 id 순으로 늘어놓는다.
type LayoutItem = LobbyLayout["items"][number];
type FloorSpot = NonNullable<LayoutItem["floor"]>;
type WallSpot = NonNullable<LayoutItem["wall"]>;

function v2(floor: Record<string, FloorSpot>, wall: Record<string, WallSpot>): LobbyLayout {
  return {
    items: [
      ...Object.entries(floor).map(([id, spot]) => ({ id, type: id, floor: spot }) as LayoutItem),
      ...Object.entries(wall).map(([id, spot]) => ({ id, type: id, wall: spot }) as LayoutItem)
    ]
  };
}

/** id 순으로 늘어놓은 인스턴스(목록 순서를 보지 않고 견준다). */
function sortedItems(layout: { items: readonly { id: string }[] } | null | undefined) {
  return [...(layout?.items ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 가구를 가리키는 값(누르기 결과의 piece, 고른 가구, 뜨는 가구, 칠한 칸의 piece)은 인스턴스 id다(066-① 명세 5. 처음 배치에서는 종류 id와 같다). */
type PieceId = NonNullable<PointerHit["piece"]>;
type Facing = FloorSpot["facing"];

/** 인스턴스 id가 id인 가구의 자리(바닥형·덮개형은 floor, 벽 부착형은 wall). */
function spotOf(layout: LobbyLayout, id: string) {
  const item = layout.items.find((i) => i.id === id);
  return item?.floor ?? item?.wall;
}

/** 인스턴스 id가 id인 바닥 가구만 그 자리로 옮긴 배치. */
function withFloor(base: LobbyLayout, id: PieceId, x: number, z: number, facing: Facing): LobbyLayout {
  return { items: base.items.map((item) => (item.id === id ? { ...item, floor: { x, z, facing } } : item)) };
}

const P0_FLOOR: Record<string, FloorSpot> = {
  desk: { x: 1.5, z: 5.5, facing: 0 },
  bookcase: { x: 0.5, z: 2.5, facing: 1 },
  wardrobe: { x: 7.5, z: 3.5, facing: 3 },
  rug: { x: 4.6, z: 7.2, facing: 0 }
};
const P0_WALL: Record<string, WallSpot> = { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } };
// 066-④ 결정 2: 처음 배치에 스탠드(책상 왼쪽 자리)가 더해져, 처음 배치 P0에 스탠드를 넣는다(그 밖의 값은 그대로).
const P0: LobbyLayout = { items: [...v2(P0_FLOOR, P0_WALL).items, { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as LayoutItem] };

const D1 = withFloor(P0, "desk", 1.5, 5.5, 1);
const D2 = withFloor(P0, "desk", 1.5, 5.5, 2);
const B3 = withFloor(P0, "bookcase", 1.5, 3.5, 2);
const W_CENTER = withFloor(P0, "wardrobe", 4.5, 6.5, 3);
const W_FAR = withFloor(P0, "wardrobe", 7.5, 0.5, 3);
const W_ON_RUG = withFloor(P0, "wardrobe", 4.5, 7.5, 3);
const K_FAR = withFloor(P0, "desk", 5.5, 8.5, 0);
/** 093 13 결정: 게시판을 왼벽 8.5에 건 배치(창문은 뒷벽 4.8). 옛 LW(창문 왼벽 8.5) 대신. */
const LB: LobbyLayout = v2(P0_FLOOR, { board: { wall: "left", along: 8.5 }, window: P0_WALL.window });
/** 04: 불러온 배치 자체가 놓을 수 없는 배치(옷장이 책상과 칸 1,5에서 겹침). */
const XB = withFloor(P0, "wardrobe", 1.5, 5.5, 3);

/** 각 가구 가운데(누를 곳). */
const AT = {
  desk: { x: 1.5, z: 5.5 },
  bookcase: { x: 0.5, z: 2.5 },
  wardrobe: { x: 7.5, z: 3.5 },
  rug: { x: 4.6, z: 7.2 }
} as const;
const EMPTY_FLOOR: FloorPoint = { x: 4.5, z: 9.5 };

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";
const SAVED_AT = new Date(2026, 10, 12, 9, 5).toISOString();
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

function loop(): IncompleteLoopState {
  return {
    promptId: "prompt-loop",
    difficulty: "A",
    step: "answer",
    updatedAt: SAVED_AT,
    promptSnapshot: { topic: "Morning", questionEn: "What do you usually do in the morning?", questionKo: "아침에 보통 무엇을 하나요?" }
  };
}

function writingDraft(): WritingDraft {
  return {
    promptId: "prompt-loop",
    draftType: "ANSWER",
    selectedDifficulty: "A",
    sessionId: "",
    answer: "I drink coffee.",
    rewrite: "",
    lastSubmittedAnswer: "",
    feedback: null,
    step: "answer",
    updatedAt: SAVED_AT
  };
}

// ---------- 서버 응답(전역 fetch 가짜, X6만) ----------

type FakeResponse = { ok: boolean; status: number; headers: Headers; json: () => Promise<unknown>; text: () => Promise<string> };

function respond(status: number, body?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => {
      if (body === undefined) throw new SyntaxError("no body");
      return JSON.parse(JSON.stringify(body));
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body))
  };
}

const fetchMock = jest.fn<Promise<FakeResponse>, [string, RequestInit?]>();
const originalFetch = globalThis.fetch;

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function renderHome() {
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

function position(): FloorPoint {
  const sim = canvas().sim;
  return { x: sim.x, z: sim.z };
}

async function frames(count: number) {
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      canvas().onFrame(0.05, Date.now());
    });
  }
}

function hit(point: FloorPoint | null, piece: PieceId | null = null, mark: MarkId | null = null): PointerHit {
  return { point, mark, onCharacter: false, piece };
}

async function pointer(phase: "down" | "move" | "up" | "cancel", h: PointerHit | null, x: number, y: number) {
  await act(async () => {
    canvas().onPointer(phase, h, x, y);
  });
}

/** 톡 누른다(같은 화면 자리에서 누르고 뗀다). */
async function tapAt(point: FloorPoint | null, piece: PieceId | null = null, mark: MarkId | null = null) {
  await pointer("down", hit(point, piece, mark), 200, 300);
  await pointer("up", null, 200, 300);
  await flushAsync();
}

/** 누르고(화면 200,300) 끈다(화면으로 100px씩 넘게 움직임). 떼지는 않는다. */
async function pressAndMove(piece: PieceId | null, from: FloorPoint, to: FloorPoint, mark: MarkId | null = null) {
  await pointer("down", hit(from, piece, mark), 200, 300);
  await pointer("move", hit(to, null), 300, 400);
}

/** 끌어서 놓는다. */
async function drag(piece: PieceId | null, from: FloorPoint, to: FloorPoint, mark: MarkId | null = null) {
  await pressAndMove(piece, from, to, mark);
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

function rotateButton() {
  return screen.queryByRole("button", { name: "돌리기" });
}

async function rotate(times = 1) {
  for (let index = 0; index < times; index += 1) {
    const button = rotateButton();
    expect(button).not.toBeNull();
    await fireEvent.press(button!);
    await flushAsync();
  }
}

async function selectAt(piece: keyof typeof AT, point: FloorPoint = AT[piece]) {
  await tapAt(point, piece);
  expect(rotateButton()).not.toBeNull();
}

/** 편집 모드다: 안내 줄과 세 버튼이 보이고 '꾸미기'가 없다. */
function expectEditing() {
  expect(screen.getByText(GUIDE)).toBeTruthy();
  for (const label of ["취소", "처음 배치로", "완료"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
  expect(screen.queryByText("꾸미기")).toBeNull();
}

/**
 * 편집 모드다(알림이 떠 있을 때): 세 버튼이 보이고 '꾸미기'가 없다. 071 명세 3(알림이 떠 있는 동안 안내 숨김)과
 * 071 03 결정 2(사용자: "버튼으로 꾸미기 중 확인")로, 알림 바로 뒤에는 안내 줄 대신 버튼으로 편집 모드인지 본다.
 */
function expectEditingByButtons() {
  for (const label of ["취소", "처음 배치로", "완료"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
  expect(screen.queryByText("꾸미기")).toBeNull();
}

/** 편집 모드가 아니다: 안내 줄과 세 버튼이 없고 '꾸미기'가 보인다. */
function expectNotEditing() {
  expect(screen.queryByText(GUIDE)).toBeNull();
  for (const label of ["취소", "처음 배치로", "완료"]) expect(screen.queryByRole("button", { name: label })).toBeNull();
  expect(screen.getByText("꾸미기")).toBeTruthy();
}

/** 편집 중인 배치(3D 그리기에 넘어간 것). */
function editLayout(): LobbyLayout {
  const edit = canvas().edit;
  expect(edit).toBeTruthy();
  return edit!.layout;
}

function sortedSolid() {
  return [...SOLID_TILES].sort();
}

/** 저장 안 불림 + 나옴(바꾼 것이 없을 때의 '완료'). */
async function finishExpectNoSave() {
  await pressButton("완료");
  expect(saveLobbyLayout).not.toHaveBeenCalled();
  expectNotEditing();
}

/** 저장이 이 배치로 한 번 불림 + 나옴. */
async function finishExpectSaved(layout: LobbyLayout) {
  await pressButton("완료");
  expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
  expect(sortedItems(jest.mocked(saveLobbyLayout).mock.calls[0][0])).toEqual(sortedItems(layout));
  expectNotEditing();
}

/** 빨간 가구가 있어 '완료'가 막힘: 저장하지 않고 안내를 보이고 편집 모드에 남는다. */
async function finishExpectRedBlocked() {
  await pressButton("완료");
  expect(saveLobbyLayout).not.toHaveBeenCalled();
  expect(screen.getByText(RED_FINISH)).toBeTruthy();
  expectEditingByButtons();
}

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

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
  fetchMock.mockReset().mockRejectedValue(new TypeError("fetch는 이 테스트에서 쓰지 않는다"));
  jest.mocked(router.push).mockReset();
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  // 저장 성공 때 서버는 보낸 배치를 그대로 돌려준다(02 가정 A3)
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

// ---------- 들어가기와 숨기기 (02 E1~E10) ----------

describe("들어가기와 숨기기", () => {
  test("[spec] E1 홈 머리 줄에 연속 일수 칩과 '꾸미기' 버튼이 보인다", async () => {
    await renderHome();

    expect(screen.getByText(STREAK_CHIP)).toBeTruthy();
    expect(screen.getByRole("button", { name: "꾸미기" })).toBeTruthy();
  });

  test("[spec] E2 '꾸미기'를 누르면 안내와 '취소'·'처음 배치로'·'완료'가 보인다", async () => {
    await renderHome();
    await enterEdit();

    expectEditing();
  });

  test("[spec] E3 편집 모드에서 칩·'꾸미기'·메뉴 넷·탭바·이름표·장소 안내를 숨기고 카메라 거리 버튼은 둔다. X11 나오면 다시 보인다", async () => {
    await renderHome();
    // 들어가기 전에는 보인다(대조)
    expect(screen.getByText(STREAK_CHIP)).toBeTruthy();
    for (const label of [...MENU_LABELS, ...TAB_LABELS, ...NAME_TAGS]) expect(screen.queryAllByText(label).length).toBeGreaterThan(0);

    await enterEdit();

    expect(screen.queryByText(STREAK_CHIP)).toBeNull();
    expect(screen.queryByText("꾸미기")).toBeNull();
    for (const label of [...MENU_LABELS, ...TAB_LABELS, ...NAME_TAGS]) expect({ label, shown: screen.queryAllByText(label).length }).toEqual({ label, shown: 0 });
    for (const id of ALL_MARKS) expect({ id, prompt: screen.queryAllByText(MARKS[id].prompt).length }).toEqual({ id, prompt: 0 });
    expect(screen.queryAllByRole("button", { name: "들어가기" })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "나가기" })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "카메라 거리 설정" })).toBeTruthy();

    await pressButton("취소");

    expect(screen.getByText(STREAK_CHIP)).toBeTruthy();
    expect(screen.getByText("꾸미기")).toBeTruthy();
    for (const label of [...MENU_LABELS, ...TAB_LABELS, ...NAME_TAGS]) expect(screen.queryAllByText(label).length).toBeGreaterThan(0);
    expect(screen.queryByText(GUIDE)).toBeNull();
  });

  test("[spec] E4 '이어 쓰기'가 보이는 상태에서 '꾸미기'를 누르면 '이어 쓰기'가 없고, '취소'로 나오면 다시 보인다", async () => {
    jest.mocked(getIncompleteLoop).mockResolvedValue(loop());
    jest.mocked(getWritingDraft).mockResolvedValue(writingDraft());
    const pending = deferred<MobileHomeSnapshot>();
    jest.mocked(getMobileHomeSnapshot).mockResolvedValue(homeSnapshot()).mockReturnValueOnce(pending.promise);
    await renderHome();
    await frames(3);
    await act(async () => {
      pending.resolve(homeSnapshot());
    });
    await flushAsync();
    expect(screen.getByRole("button", { name: "이어 쓰기" })).toBeTruthy();

    await enterEdit();
    expect(screen.queryByRole("button", { name: "이어 쓰기" })).toBeNull();

    await pressButton("취소");
    expect(screen.getByRole("button", { name: "이어 쓰기" })).toBeTruthy();
  });

  test("[spec] E5 편집 모드 동안 3D 그리기에 편집 상태가 넘어가고, 나오면 없어진다(라이트루프 숨김 자체는 사용자가 본다)", async () => {
    await renderHome();
    expect(canvas().edit ?? null).toBeNull();

    await enterEdit();
    expect(canvas().edit).toBeTruthy();

    await pressButton("취소");
    expect(canvas().edit ?? null).toBeNull();
  });

  test("[spec] E6 책장에서 들어가는 동작 중에 '꾸미기'를 누르면 동작이 없어지고, 1.3초 넘게 지나도 기록 화면으로 가지 않는다", async () => {
    await renderHome();
    await tapAt(null, null, "bookcase");
    for (let index = 0; index < 400 && !(canvas().sim.arrived === "bookcase" && canvas().sim.vx === 0 && canvas().sim.vz === 0); index += 1) {
      await frames(1);
    }
    expect(canvas().sim.arrived).toBe("bookcase");
    await frames(10);
    await fireEvent.press(screen.getByRole("button", { name: MARKS.bookcase.buttonLabel }));
    await flushAsync();
    expect(canvas().sim.scene?.phase).toBe("in");

    await enterEdit();
    expect(canvas().sim.scene).toBeNull();

    await frames(40);
    expect(router.push).not.toHaveBeenCalled();
  });

  test("[spec] E7 편집 모드에서 빈 바닥을 눌러도 라이트루프가 걷지 않는다", async () => {
    await renderHome();
    await enterEdit();
    const before = position();

    await tapAt(EMPTY_FLOOR);
    await frames(20);

    expect(position()).toEqual(before);
    expect(canvas().sim.snapshot(Date.now()).moving).toBe(false);
  });

  test("[spec] E8 편집 모드에서 책상을 눌러도 라이트루프가 책상으로 걷지 않고 장소 안내가 뜨지 않는다", async () => {
    await renderHome();
    await enterEdit();
    const before = position();

    await tapAt(AT.desk, "desk", "desk");
    await frames(40);

    expect(position()).toEqual(before);
    expect(canvas().sim.arrived).toBeNull();
    expect(screen.queryByText(MARKS.desk.prompt)).toBeNull();
  });

  test("[spec] E9 안드로이드 뒤로 가기는 '취소'와 같다: 저장하지 않고 나오며 홈을 떠나지 않는다", async () => {
    await renderHome();
    await enterEdit();

    const handled = await pressHardwareBack();

    expect(handled).toBe(true);
    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expectNotEditing();
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByText(STREAK_CHIP)).toBeTruthy();
  });

  test("[spec] E10 옷장을 W-center로 옮긴 뒤 뒤로 가기: 저장하지 않고 나오며 배치는 P0", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });
    expect(sortedItems(editLayout())).toEqual(sortedItems(W_CENTER));
    await pressHardwareBack();

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expectNotEditing();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(P0));
  });
});

// ---------- 카메라 (02 C1·C2, 04 C4·C5) ----------

describe("카메라", () => {
  test("[spec] C1·C2·K2 저장된 거리 7.0: 편집 중에는 7.0보다 멀고, '취소'로 나오면 7.0, 저장값과 배치 값은 그대로", async () => {
    await AsyncStorage.setItem(LOBBY3D_VIEW_WIDTH_KEY, "7");
    await renderHome();
    expect(canvas().viewWidth).toBe(7);
    // 기기 저장소 가짜의 함수는 이미 jest.fn이라 테스트 사이에 부른 기록이 남는다. 여기서부터 부른 것만 본다
    const setItem = jest.mocked(AsyncStorage.setItem);
    const removeItem = jest.mocked(AsyncStorage.removeItem);
    setItem.mockClear();
    removeItem.mockClear();

    await enterEdit();
    expect(canvas().viewWidth).toBeGreaterThan(7);

    await pressButton("취소");
    expect(canvas().viewWidth).toBe(7);
    expect(await AsyncStorage.getItem(LOBBY3D_VIEW_WIDTH_KEY)).toBe("7");
    expect(setItem.mock.calls.filter(([key]) => key === LOBBY3D_VIEW_WIDTH_KEY)).toHaveLength(0);
    expect(removeItem.mock.calls.filter(([key]) => key === LOBBY3D_VIEW_WIDTH_KEY)).toHaveLength(0);
    // K2: 막힌 칸·장소 서는 자리가 P0 그대로
    expect(sortedSolid()).toEqual(["0,2", "0,5", "1,5", "2,5", "7,3"]);
    expect(MARKS.desk.approach).toEqual([{ x: 1.5, z: 6.75 }]);
    expect(MARKS.bookcase.approach).toEqual([{ x: 1.4, z: 2.5 }]);
  });

  test("[spec] C2 '완료'로 나와도 보는 폭이 7.0으로 돌아온다", async () => {
    await AsyncStorage.setItem(LOBBY3D_VIEW_WIDTH_KEY, "7");
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });

    await finishExpectSaved(W_CENTER);

    expect(canvas().viewWidth).toBe(7);
    expect(await AsyncStorage.getItem(LOBBY3D_VIEW_WIDTH_KEY)).toBe("7");
  });

  test("[spec] C4·C5 저장된 거리 12.8: 편집 중에도 12.8 그대로(다가오지 않음), 나와도 12.8이고 저장값 그대로", async () => {
    await AsyncStorage.setItem(LOBBY3D_VIEW_WIDTH_KEY, "12.8");
    await renderHome();
    expect(canvas().viewWidth).toBe(12.8);
    const setItem = jest.mocked(AsyncStorage.setItem);
    setItem.mockClear();

    await enterEdit();
    expect(canvas().viewWidth).toBe(12.8);

    await pressButton("취소");
    expect(canvas().viewWidth).toBe(12.8);
    expect(await AsyncStorage.getItem(LOBBY3D_VIEW_WIDTH_KEY)).toBe("12.8");
    expect(setItem.mock.calls.filter(([key]) => key === LOBBY3D_VIEW_WIDTH_KEY)).toHaveLength(0);
  });
});

// ---------- 고르기 (02 S1~S8) ----------

describe("고르기", () => {
  test("[spec] S1 책상을 톡 → 돌리기 버튼이 보이고, 한 번 돌려 '완료'하면 D1로 저장된다", async () => {
    await renderHome();
    await enterEdit();
    expect(rotateButton()).toBeNull();

    await selectAt("desk");
    await rotate();

    await finishExpectSaved(D1);
  });

  test("[spec] S2 의자를 누르면(3D 판정: 책상) 책상이 골라져 D1로 저장된다", async () => {
    await renderHome();
    await enterEdit();

    // 의자 자리 (1.5, 5.95). 3D 그리기는 의자를 일기 책상으로 판정해 넘긴다
    await selectAt("desk", { x: 1.5, z: 5.95 });
    await rotate();

    await finishExpectSaved(D1);
  });

  test("[spec] S3 깔개 위 옷장(칸 4,7)을 누르면(3D 판정: 옷장) 옷장이 돌고 깔개는 그대로다", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 7.5 });
    expect(sortedItems(editLayout())).toEqual(sortedItems(W_ON_RUG));
    // 075: 끈 옷장의 고르기는 옷장을 다시 톡해 푼다(준비만 바꿈)
    await tapAt({ x: 4.5, z: 7.5 }, "wardrobe");
    expect(rotateButton()).toBeNull();

    await selectAt("wardrobe", { x: 4.5, z: 7.5 });
    await rotate();

    await finishExpectSaved(withFloor(P0, "wardrobe", 4.5, 7.5, 0));
  });

  test("[spec] S4 깔개만 있는 곳을 톡하면 깔개가 골라진다", async () => {
    await renderHome();
    await enterEdit();

    await tapAt({ x: 5.2, z: 6.6 }, "rug");

    expect(rotateButton()).not.toBeNull();
  });

  // 075 고칠 기존 테스트: 옛 S5 "고르기가 풀린다"를 새 동작(책상이 (4.5, 9.5)로 옮겨 가 골라진 채, 책상을 톡하면 풀림)으로 고쳤다
  test("[spec] S5 [075 바뀔] 책상을 골라 둔 뒤 빈 바닥 (4.5, 9.5)를 톡하면 책상이 (4.5, 9.5)로 옮겨 가 골라진 채이고, 그 책상을 톡하면 고르기가 풀리며 '완료'하면 그 배치로 저장된다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("desk");

    await tapAt(EMPTY_FLOOR);

    expect(rotateButton()).not.toBeNull();
    expect(sortedItems(editLayout())).toEqual(sortedItems(withFloor(P0, "desk", 4.5, 9.5, 0)));
    expect(screen.queryByText(TAP_CANNOT)).toBeNull();

    await tapAt(EMPTY_FLOOR, "desk");

    expect(rotateButton()).toBeNull();
    await finishExpectSaved(withFloor(P0, "desk", 4.5, 9.5, 0));
  });

  // 064-④ 결정 03의 1: ③의 옛 동작(벽 가구는 고르지 않음)을 ④ 명세 1대로 고쳤다. 벽 가구를 끄는 것은 home-lobby-wall-edit.spec.test.tsx가 본다.
  // 075 고칠 기존 테스트: 옛 S6 "그 벽 가구가 골라진다"를 새 동작(바닥 가구인 책상은 벽 위에 둘 수 없어 안내, 책상이 골라진 채)으로 고쳤다
  test.each([
    ["게시판", "board" as const, 1.8],
    ["창문", "window" as const, 4.8]
  ])("[spec] S6 [075 바뀔] 책상을 골라 둔 뒤 %s(벽 위)을 톡하면 그 벽 가구는 골라지지 않고, 책상은 벽 위에 둘 수 없어 옮기지 않고 안내하며 골라진 채이고 배치는 그대로다", async (_label, piece, along) => {
    await renderHome();
    await enterEdit();
    await selectAt("desk");

    const wallHit: PointerHit = { point: null, mark: piece, onCharacter: false, piece, wall: { wall: "back", along } };
    await pointer("down", wallHit, 200, 300);
    await pointer("up", null, 200, 300);
    await flushAsync();

    expect(screen.getByText(TAP_CANNOT)).toBeTruthy();
    expect(rotateButton()).not.toBeNull();
    expect(canvas().edit!.marks.map((m) => ({ piece: m.piece, ok: m.ok }))).toEqual([{ piece: "desk", ok: true }]);
    expect(canvas().edit!.wallMarks).toEqual([]);
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    await finishExpectNoSave();
  });

  test("[spec] S7 입구 발판은 톡해도 끌어도 골라지지 않고 바뀌는 것이 없다", async () => {
    await renderHome();
    await enterEdit();
    const door = { x: 4.0, z: 11.35 };

    await tapAt(door, null, "door");
    expect(rotateButton()).toBeNull();

    await drag(null, door, { x: 4.0, z: 8.0 }, "door");
    expect(rotateButton()).toBeNull();
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    await finishExpectNoSave();
  });

  test("[spec] S8(판정 부분) 고른 책상의 칸 0~3·5~6은 놓을 수 있음, 끌어 책상 위로 가는 책장은 놓을 수 없음으로 칠한다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("desk");
    expect(canvas().edit!.marks).toEqual([{ piece: "desk", minX: 0, maxX: 3, minZ: 5, maxZ: 6, ok: true }]);

    await pressAndMove("bookcase", AT.bookcase, { x: 1.5, z: 5.5 });
    expect(canvas().edit!.marks).toEqual([{ piece: "bookcase", minX: 1, maxX: 2, minZ: 5, maxZ: 6, ok: false }]);
    await pointer("up", null, 300, 400);
  });
});

// ---------- 끌기 (02 M1~M15) ----------

describe("끌기", () => {
  test("[spec] M1·M3 책상 왼쪽 끝을 눌러 끌면 처음 누른 곳과의 거리를 지켜 K-far(5.5, 8.5)에 놓이고, 끄는 동안 돌리기 버튼이 없다", async () => {
    await renderHome();
    await enterEdit();

    await pressAndMove("desk", { x: 0.3, z: 5.5 }, { x: 4.3, z: 8.5 });
    expect(rotateButton()).toBeNull();
    await pointer("up", null, 300, 400);
    await flushAsync();
    expect(rotateButton()).not.toBeNull();

    await finishExpectSaved(K_FAR);
  });

  test("[spec] M2 K-far 저장 뒤 일기 책상 장소·막힌 칸·의자·3D 가구 자리가 따라간다", async () => {
    await renderHome();
    await enterEdit();
    await drag("desk", { x: 0.3, z: 5.5 }, { x: 4.3, z: 8.5 });
    await finishExpectSaved(K_FAR);

    expect(MARKS.desk.approach).toEqual([{ x: 5.5, z: 9.75 }]);
    expect(MARKS.desk.faceTo).toEqual({ x: 5.5, z: 8.5 });
    expect(sortedSolid()).toEqual(["0,2", "4,8", "5,8", "6,8", "7,3"]);
    expect(CHAIR.home).toEqual({ x: 5.5, z: 8.95 });
    expect(currentFurnitureLayout()).toEqual(furniturePlacements(K_FAR));
  });

  test.each([
    ["M4 책장 → 책상 위(12)", "bookcase" as PieceId, AT.bookcase, { x: 1.5, z: 5.5 }],
    ["M5 책장 → 방 밖(11)", "bookcase" as PieceId, AT.bookcase, { x: -0.5, z: 2.5 }],
    ["M7 책장 → 게시판 아래 칸 1,0(13)", "bookcase" as PieceId, AT.bookcase, { x: 1.5, z: 0.5 }],
    ["M8 옷장 → 창문 아래 칸 4,0(13)", "wardrobe" as PieceId, AT.wardrobe, { x: 4.5, z: 0.5 }],
    ["M10 책상 → 창문 아래 칸 3~5,0(④ 결정 11의 1: 책상도 안 됨)", "desk" as PieceId, AT.desk, { x: 4.5, z: 0.5 }],
    ["M11 옷장 → 입구 발판 앞 칸 4,10(14)", "wardrobe" as PieceId, AT.wardrobe, { x: 4.5, z: 10.5 }],
    ["M12 옷장 → 게시판 앞 칸 1,1(14)", "wardrobe" as PieceId, AT.wardrobe, { x: 1.5, z: 1.5 }],
    ["M13 옷장 → 책장 앞 칸 1,2(14)", "wardrobe" as PieceId, AT.wardrobe, { x: 1.5, z: 2.5 }]
  ])("[spec] %s: 놓을 수 없어 끌기 전 자리로 돌아가고 '완료'는 저장하지 않는다", async (_label, piece, from, to) => {
    await renderHome();
    await enterEdit();

    await drag(piece, from, to);

    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    await finishExpectNoSave();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(P0));
  });

  test.each([
    ["M6 옷장 → 깔개 위 칸 4,7(12 깔개는 겹쳐도 됨)", "wardrobe" as PieceId, AT.wardrobe, { x: 4.5, z: 7.5 }, W_ON_RUG],
    ["M9 옷장 → 칸 7,0(벽 가구 아래 아님)", "wardrobe" as PieceId, AT.wardrobe, { x: 7.5, z: 0.5 }, W_FAR]
  ])("[spec] %s: 놓이고 그 배치로 저장된다", async (_label, piece, from, to, expected) => {
    await renderHome();
    await enterEdit();

    await drag(piece, from, to);

    expect(sortedItems(editLayout())).toEqual(sortedItems(expected));
    await finishExpectSaved(expected);
  });

  test("[spec] M14·U-LW [093 게시판으로] 불러온 배치 LB에서 옷장을 왼쪽 벽 게시판 아래 칸 0,8로 끌면 돌아간다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(LB);
    await renderHome();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(LB));
    await enterEdit();

    await drag("wardrobe", AT.wardrobe, { x: 0.5, z: 8.5 });

    expect(sortedItems(editLayout())).toEqual(sortedItems(LB));
    await finishExpectNoSave();
  });
});

// ---------- 깔개 칸 맞추기 (04 G1~G7, 결정 03의 1) ----------

describe("깔개 끌기: 칸에 맞춰 놓기", () => {
  test.each([
    ["G1(02 M16 대신) (1.6, 2.2)까지 → (1.5, 2.5)", { x: 1.6, z: 2.2 }, { x: 1.5, z: 2.5 }],
    ["G2 +2칸 (6.6, 7.2)까지 → (6.5, 7.5)", { x: 6.6, z: 7.2 }, { x: 6.5, z: 7.5 }],
    ["G5 조금 (4.9, 7.3)까지 → (4.5, 7.5)", { x: 4.9, z: 7.3 }, { x: 4.5, z: 7.5 }]
  ])("[spec] %s 에 놓이고 저장된다", async (_label, to, at) => {
    await renderHome();
    await enterEdit();

    await drag("rug", AT.rug, to);

    const expected = withFloor(P0, "rug", at.x, at.z, 0);
    expect(sortedItems(editLayout())).toEqual(sortedItems(expected));
    await finishExpectSaved(expected);
  });

  test.each([
    ["G3 +3칸 (7.6, 7.2)까지 → (7.5, 7.5) 방 밖", { x: 7.6, z: 7.2 }],
    ["G4(02 M15) +4칸 (8.6, 7.2)까지 → (8.5, 7.5) 방 밖", { x: 8.6, z: 7.2 }]
  ])("[spec] %s: 돌아가고 저장하지 않는다", async (_label, to) => {
    await renderHome();
    await enterEdit();

    await drag("rug", AT.rug, to);

    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    await finishExpectNoSave();
  });

  test("[spec] G6 깔개를 (1.5, 2.5)로 옮긴 뒤 '처음 배치로' → 깔개가 (4.6, 7.2)이고 '완료'는 저장하지 않는다", async () => {
    await renderHome();
    await enterEdit();
    await drag("rug", AT.rug, { x: 1.6, z: 2.2 });

    await pressButton("처음 배치로");

    expect(spotOf(editLayout(), "rug")).toEqual({ x: 4.6, z: 7.2, facing: 0 });
    await finishExpectNoSave();
  });

  test("[spec] G7 깔개를 돌리면 자리는 그대로 (4.6, 7.2)이고 방향만 1로 저장된다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("rug", { x: 5.2, z: 6.6 });

    await rotate();

    await finishExpectSaved(withFloor(P0, "rug", 4.6, 7.2, 1));
  });
});

// ---------- 돌리기와 빨간 가구 (02 R1~R10) ----------

describe("돌리기와 빨간 가구", () => {
  test.each([
    ["R1 한 번 → D1", 1, D1],
    ["R1 두 번 → D2", 2, D2]
  ])("[spec] %s 로 저장된다(가운데 (1.5, 5.5) 그대로)", async (_label, times, expected) => {
    await renderHome();
    await enterEdit();
    await selectAt("desk");

    await rotate(times);

    await finishExpectSaved(expected);
  });

  test("[spec] R2·R3 책상을 세 번 돌리면 빨간 가구(완료 막힘), 네 번째에 풀려 바뀐 것이 없으니 저장 없이 나온다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("desk");

    await rotate(3);
    expect(sortedItems(editLayout())).toEqual(sortedItems(withFloor(P0, "desk", 1.5, 5.5, 3)));
    await finishExpectRedBlocked();

    await rotate();
    await finishExpectNoSave();
  });

  test("[spec] R4·S8 책장을 한 번 돌려(B2) 고르기를 풀어도 빨간 가구가 남는다: 빨간 칸이 남고, 옷장을 누르면 고르지 않고 안내", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("bookcase");
    await rotate();

    // 075: 고르기는 책장을 다시 톡해 푼다(준비만 바꿈)
    await tapAt(AT.bookcase, "bookcase");
    expect(rotateButton()).toBeNull();
    expect(canvas().edit!.marks).toEqual([{ piece: "bookcase", minX: 0, maxX: 1, minZ: 2, maxZ: 3, ok: false }]);

    await tapAt(AT.wardrobe, "wardrobe");
    expect(rotateButton()).toBeNull();
    expect(screen.getByText(RED_FIRST)).toBeTruthy();
  });

  test("[spec] R5 빨간 책장이 있는 동안 옷장을 끌면 움직이지 않고 안내, 책장을 세 번 더 돌려 P0이 되면 저장 없이 나온다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("bookcase");
    await rotate();

    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 7.5 });
    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    expect(spotOf(editLayout(), "wardrobe")).toEqual({ x: 7.5, z: 3.5, facing: 3 });

    // 책장은 아직 골라져 있다(빨간 가구 안내로 고르기가 바뀌지 않음). 다시 톡하면 고르기가 풀리므로(065 결정 19) 바로 돌린다
    await rotate(3);
    await finishExpectNoSave();
  });

  test("[spec] R6 빨간 책장(B2)을 칸 1,3으로 끌어 놓으면 풀리고 B3로 저장된다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("bookcase");
    await rotate();

    await drag("bookcase", AT.bookcase, { x: 1.5, z: 3.5 });

    await finishExpectSaved(B3);
  });

  test("[spec] R7·R8 빨간 책장을 책상 위로 끌면 빨간 자리로 돌아가 '완료'가 막히고, '처음 배치로' 뒤에는 저장 없이 나온다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("bookcase");
    await rotate();

    await drag("bookcase", AT.bookcase, { x: 1.5, z: 5.5 });
    expect(spotOf(editLayout(), "bookcase")).toEqual({ x: 0.5, z: 2.5, facing: 2 });
    await finishExpectRedBlocked();

    await pressButton("처음 배치로");
    expectEditingByButtons();
    await finishExpectNoSave();
  });

  test("[spec] R9 빨간 책장이 있어도 '취소'는 저장 없이 나오고 배치는 P0", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("bookcase");
    await rotate();

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expectNotEditing();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(P0));
  });

  test("[spec] R10 [093 게시판으로] (배치 LB에서) 책상을 K-left로 옮겨 한 번 돌리면(방 밖으로 나감) 돌고 빨간 가구라 '완료'가 막힌다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(LB);
    await renderHome();
    await enterEdit();
    await drag("desk", AT.desk, { x: 1.5, z: 0.5 });
    expect(sortedItems(editLayout())).toEqual(sortedItems(withFloor(LB, "desk", 1.5, 0.5, 0)));
    await rotate();

    expect(sortedItems(editLayout())).toEqual(sortedItems(withFloor(LB, "desk", 1.5, 0.5, 1)));
    await finishExpectRedBlocked();
  });
});

// ---------- 나오기와 저장 (02 X1~X13) ----------

describe("나오기와 저장", () => {
  test("[spec] X1 아무것도 바꾸지 않고 '완료'하면 저장하지 않고 나온다", async () => {
    await renderHome();
    await enterEdit();

    await finishExpectNoSave();
  });

  test("[spec] X2 옷장을 옮겼다가 제자리로 되돌리고 '완료'하면 저장하지 않는다", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 7.5, z: 0.5 });
    await drag("wardrobe", { x: 7.5, z: 0.5 }, AT.wardrobe);

    await finishExpectNoSave();
  });

  test("[spec] X3·X11 옷장을 W-center로 옮겨 '완료'하면 저장이 한 번 불리고 나와 W-center로 보이며 숨긴 것이 다시 보인다", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });

    await finishExpectSaved(W_CENTER);

    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
    expect(sortedSolid()).toContain("4,6");
    expect(screen.getByText(STREAK_CHIP)).toBeTruthy();
    for (const label of [...MENU_LABELS, ...TAB_LABELS]) expect(screen.queryAllByText(label).length).toBeGreaterThan(0);
    // 085 03 결정 1: '완료' 직후에는 로딩 표시가 보이고 이름표가 숨는다("학습 기록"은 메뉴 버튼 글과 같아 이름표만인 넷을 본다)
    expect(screen.queryAllByText(DONE_LOADING).length).toBeGreaterThan(0);
    for (const label of NAME_TAGS.filter((tag) => !MENU_LABELS.includes(tag))) {
      expect({ label, shown: screen.queryAllByText(label).length }).toEqual({ label, shown: 0 });
    }
    // 이 파일의 가짜 3D 그림판은 프레임을 그리지 않으므로, 085 03 결정 2-2(프레임이 없어도 나온 때부터 1.5초 뒤 내림)로 표시가 내려간 뒤 본다
    await act(async () => {
      jest.advanceTimersByTime(1600);
    });
    await flushAsync();
    expect(screen.queryAllByText(DONE_LOADING)).toHaveLength(0);
    for (const label of [...MENU_LABELS, ...TAB_LABELS, ...NAME_TAGS]) expect(screen.queryAllByText(label).length).toBeGreaterThan(0);
  });

  test("[spec] X4 저장 응답을 기다리는 동안 세 버튼을 눌러도 저장은 한 번, 나오지도 바뀌지도 않고, 성공한 뒤 W-center로 나온다", async () => {
    const pending = deferred<LobbyLayout>();
    jest.mocked(saveLobbyLayout).mockReset().mockReturnValue(pending.promise);
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });
    const done = screen.getByRole("button", { name: "완료" });
    const cancel = screen.getByRole("button", { name: "취소" });
    const reset = screen.getByRole("button", { name: "처음 배치로" });

    await fireEvent.press(done);
    await flushAsync();
    await fireEvent.press(done);
    await fireEvent.press(cancel);
    await fireEvent.press(reset);
    await flushAsync();

    expect(saveLobbyLayout).toHaveBeenCalledTimes(1);
    expect(screen.getByText(GUIDE)).toBeTruthy();
    expect(sortedItems(editLayout())).toEqual(sortedItems(W_CENTER));
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(P0));
    await act(async () => {
      pending.resolve(JSON.parse(JSON.stringify(W_CENTER)));
    });
    await flushAsync();

    expectNotEditing();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
  });

  test("[spec] X5 저장에 실패하면 안내를 보이고 편집 모드에 남으며, 다시 '완료'하면 같은 배치로 다시 저장한다", async () => {
    jest.mocked(saveLobbyLayout).mockReset().mockRejectedValueOnce(new Error("네트워크")).mockImplementation(async (layout: LobbyLayout) => layout);
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });

    await pressButton("완료");

    expect(screen.getByText(SAVE_FAILED)).toBeTruthy();
    expectEditingByButtons();
    expect(sortedItems(editLayout())).toEqual(sortedItems(W_CENTER));
    await pressButton("완료");

    expect(saveLobbyLayout).toHaveBeenCalledTimes(2);
    expect(sortedItems(jest.mocked(saveLobbyLayout).mock.calls[1][0])).toEqual(sortedItems(W_CENTER));
    expectNotEditing();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
  });

  test("[spec] X6 로그인 만료(서버 401)로 저장이 실패해도 X5와 같은 안내, 편집 모드에 남는다", async () => {
    jest.mocked(saveLobbyLayout).mockReset().mockImplementation((layout: LobbyLayout) => actualApi.saveLobbyLayout(layout));
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/api/lobby-layout") ? respond(401, { message: "로그인이 필요해요." }) : respond(404)
    );
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });

    await pressButton("완료");

    expect(fetchMock.mock.calls.some(([url, init]) => url.includes("/api/lobby-layout") && init?.method === "PUT")).toBe(true);
    expect(screen.getByText(SAVE_FAILED)).toBeTruthy();
    expectEditingByButtons();
    expect(sortedItems(editLayout())).toEqual(sortedItems(W_CENTER));
  });

  test("[spec] X7 여러 가구를 바꾼 뒤 '취소'하면 묻지 않고 나오고 저장 없이 P0", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });
    await selectAt("desk");
    await rotate();

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expectNotEditing();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(P0));
  });

  test("[spec] X8 불러온 배치가 W-center일 때 '처음 배치로' → '완료'하면 P0로 저장된다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(W_CENTER);
    await renderHome();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
    await enterEdit();

    await pressButton("처음 배치로");

    await finishExpectSaved(P0);
  });

  test("[spec] X9·X10 옷장을 옮긴 뒤 '처음 배치로'를 누르면 편집 모드에 남고 저장하지 않으며, '완료'는 편집 전과 같아 저장 없이 나온다", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });

    await pressButton("처음 배치로");

    expectEditing();
    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    await finishExpectNoSave();
  });

  test("[spec] X12 라이트루프가 선 (4.2, 6.2)에 옷장을 두고 '완료'하면 가장 가까운 설 수 있는 칸 가운데로 옮겨진다", async () => {
    await renderHome();
    expect(position()).toEqual({ x: 4.2, z: 6.2 });
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });

    await finishExpectSaved(W_CENTER);

    const at = position();
    expect([
      { x: 3.5, z: 6.5 },
      { x: 4.5, z: 5.5 }
    ]).toContainEqual(at);
    expect(isFree(at.x, at.z)).toBe(true);
  });

  test("[spec] X13 저장하고 나온 뒤 책상을 누르면 라이트루프가 일기 책상으로 걸어간다", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });
    await finishExpectSaved(W_CENTER);

    await tapAt(null, null, "desk");
    for (let index = 0; index < 400 && canvas().sim.arrived !== "desk"; index += 1) {
      await frames(1);
    }

    expect(canvas().sim.arrived).toBe("desk");
  });
});

// ---------- 편집 중에 온 불러오기 (02 L1~L3, 04 L4·L5) ----------

describe("편집 중에 온 불러오기", () => {
  async function enterWhileLoading() {
    const pending = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReset().mockReturnValueOnce(pending.promise).mockResolvedValue(null);
    await renderHome();
    await enterEdit();
    await act(async () => {
      pending.resolve(W_CENTER);
    });
    await flushAsync();
  }

  test("[spec] L1 편집 중에 W-center가 도착해도 편집 화면에 들어오지 않고, 옷장을 W-far로 옮겨 저장하면 저장한 배치로 보인다", async () => {
    await enterWhileLoading();
    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    await drag("wardrobe", AT.wardrobe, { x: 7.5, z: 0.5 });

    await finishExpectSaved(W_FAR);
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_FAR));
  });

  test("[spec] L2 편집 중에 W-center가 도착한 뒤 '취소'하면 저장 없이 W-center로 보인다", async () => {
    await enterWhileLoading();

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
  });

  test("[spec] L3 저장한 뒤 홈에 다시 들어와 불러오기가 실패해도 저장한 W-center가 그대로다", async () => {
    await renderHome();
    await enterEdit();
    await drag("wardrobe", AT.wardrobe, { x: 4.5, z: 6.5 });
    await finishExpectSaved(W_CENTER);
    jest.mocked(getLobbyLayout).mockRejectedValue(new Error("실패"));
    const callsBefore = jest.mocked(getLobbyLayout).mock.calls.length;

    await leaveAndReturnHome();

    expect(jest.mocked(getLobbyLayout).mock.calls.length).toBeGreaterThan(callsBefore);
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
  });

  test("[spec] L4 편집 중에 W-center가 도착한 뒤 바꾸지 않고 '완료'하면 저장 없이 나와 W-center로 보인다", async () => {
    await enterWhileLoading();

    await finishExpectNoSave();

    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
    expect(sortedSolid()).toContain("4,6");
  });

  test("[spec] L5 도착한 뒤 옷장을 옮겼다 되돌리고 '완료'하면 저장 없이 W-center로 보인다", async () => {
    await enterWhileLoading();
    await drag("wardrobe", AT.wardrobe, { x: 7.5, z: 0.5 });
    await drag("wardrobe", { x: 7.5, z: 0.5 }, AT.wardrobe);

    await finishExpectNoSave();

    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(W_CENTER));
  });
});

// ---------- 불러온 배치가 놓을 수 없는 배치 (04 V1~V5, 결정 06) ----------

describe("불러온 배치가 놓을 수 없는 배치(XB)", () => {
  beforeEach(() => {
    jest.mocked(getLobbyLayout).mockResolvedValue(XB);
  });

  test("[spec] V1 겹치지 않은 책장을 칸 1,3으로 끌어도 배치 전체가 놓을 수 없어 돌아가고 저장하지 않는다", async () => {
    await renderHome();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(XB));
    await enterEdit();

    await drag("bookcase", AT.bookcase, { x: 1.5, z: 3.5 });

    expect(sortedItems(editLayout())).toEqual(sortedItems(XB));
    await finishExpectNoSave();
  });

  test("[spec] V2 깔개를 끌어도 돌아가고 저장하지 않는다", async () => {
    await renderHome();
    await enterEdit();

    await drag("rug", AT.rug, { x: 6.6, z: 7.2 });

    expect(sortedItems(editLayout())).toEqual(sortedItems(XB));
    await finishExpectNoSave();
  });

  test("[spec] V3 '처음 배치로' → '완료'하면 P0로 저장된다", async () => {
    await renderHome();
    await enterEdit();

    await pressButton("처음 배치로");

    await finishExpectSaved(P0);
  });

  test("[spec] V4 '취소'하면 저장 없이 XB 그대로다", async () => {
    await renderHome();
    await enterEdit();

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(XB));
  });

  test("[spec] V5 들어가도 따로 안내하지 않는다(안내 줄 하나, 알림 없음)", async () => {
    await renderHome();
    await enterEdit();

    expect(screen.getByText(GUIDE)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("[spec] 결정 06-1(Q6) 문제를 일으킨 옷장을 칸 7,0으로 끌면 배치 전체가 놓을 수 있게 되어 놓이고 그 배치로 저장된다", async () => {
    await renderHome();
    await enterEdit();

    await drag("wardrobe", { x: 1.5, z: 5.5 }, { x: 7.5, z: 0.5 });

    expect(sortedItems(editLayout())).toEqual(sortedItems(W_FAR));
    await finishExpectSaved(W_FAR);
  });

  test("[spec] 결정 06-2(Q7) 깔개를 돌리면 빨간 가구가 되어 다른 가구를 누르면 안내, '완료'는 막히고 '처음 배치로' 뒤 P0로 저장된다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("rug", { x: 5.2, z: 6.6 });

    await rotate();
    expect(spotOf(editLayout(), "rug")).toEqual({ x: 4.6, z: 7.2, facing: 1 });

    await tapAt(AT.bookcase, "bookcase");
    expect(screen.getByText(RED_FIRST)).toBeTruthy();
    // 책장은 골라지지 않는다(칠한 칸은 빨간 깔개뿐)
    expect(canvas().edit!.marks.map((m) => m.piece)).toEqual(["rug"]);
    await finishExpectRedBlocked();

    await pressButton("처음 배치로");
    await finishExpectSaved(P0);
  });

  test("[spec] 결정 06-2(Q7) 돌려서 빨간 가구가 된 뒤에도 '취소'로 풀린다(저장 없이 XB)", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("rug", { x: 5.2, z: 6.6 });
    await rotate();

    await pressButton("취소");

    expect(saveLobbyLayout).not.toHaveBeenCalled();
    expectNotEditing();
    expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(XB));
  });
});

// ---------- 벽 가구 바로 아래 칸의 경계 (04 U1~U10, 결정 03의 4) ----------

describe("벽 가구 바로 아래 칸의 경계", () => {
  test.each([
    ["U1 칸 0,0(게시판 왼쪽 끝)", { x: 0.5, z: 0.5 }],
    ["U2 칸 2,0(게시판 오른쪽 끝)", { x: 2.5, z: 0.5 }],
    ["U3 칸 3,0(창문 왼쪽 끝)", { x: 3.5, z: 0.5 }],
    ["U4 칸 5,0(창문 오른쪽 끝)", { x: 5.5, z: 0.5 }]
  ])("[spec] %s 로 옷장을 끌면 돌아가고 저장하지 않는다", async (_label, to) => {
    await renderHome();
    await enterEdit();

    await drag("wardrobe", AT.wardrobe, to);

    expect(sortedItems(editLayout())).toEqual(sortedItems(P0));
    await finishExpectNoSave();
  });

  test("[spec] U5 칸 6,0(창문 폭 밖)으로 옷장을 끌면 놓이고 (6.5, 0.5, 3)으로 저장된다", async () => {
    await renderHome();
    await enterEdit();

    await drag("wardrobe", AT.wardrobe, { x: 6.5, z: 0.5 });

    await finishExpectSaved(withFloor(P0, "wardrobe", 6.5, 0.5, 3));
  });

  test("[spec] U6 빨간 책장(방향 0)을 게시판 아래 칸 2,0으로 끌면 빨간 자리로 돌아가고 '완료'가 막힌다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("bookcase");
    await rotate(3);
    expect(spotOf(editLayout(), "bookcase")).toEqual({ x: 0.5, z: 2.5, facing: 0 });

    await drag("bookcase", AT.bookcase, { x: 2.5, z: 0.5 });

    expect(spotOf(editLayout(), "bookcase")).toEqual({ x: 0.5, z: 2.5, facing: 0 });
    await finishExpectRedBlocked();
  });

  test("[spec] U6b 빨간 책장(방향 0)을 칸 6,0으로 끌면 놓이고 풀려 (6.5, 0.5, 0)으로 저장된다", async () => {
    await renderHome();
    await enterEdit();
    await selectAt("bookcase");
    await rotate(3);

    await drag("bookcase", AT.bookcase, { x: 6.5, z: 0.5 });

    await finishExpectSaved(withFloor(P0, "bookcase", 6.5, 0.5, 0));
  });

  test.each([
    ["U7 [093 게시판으로] LB 칸 0,7", { x: 0.5, z: 7.5 }],
    ["U8 [093 게시판으로] LB 칸 0,9", { x: 0.5, z: 9.5 }]
  ])("[spec] %s(왼쪽 벽 게시판 아래)로 옷장을 끌면 돌아가고 저장하지 않는다", async (_label, to) => {
    jest.mocked(getLobbyLayout).mockResolvedValue(LB);
    await renderHome();
    await enterEdit();

    await drag("wardrobe", AT.wardrobe, to);

    expect(sortedItems(editLayout())).toEqual(sortedItems(LB));
    await finishExpectNoSave();
  });

  test.each([
    ["U9 [093 게시판으로] LB 칸 0,6", 0.5, 6.5],
    ["U10 [093 게시판으로] LB 칸 0,10", 0.5, 10.5]
  ])("[spec] %s(게시판 폭 밖)으로 옷장을 끌면 놓이고 저장된다", async (_label, x, z) => {
    jest.mocked(getLobbyLayout).mockResolvedValue(LB);
    await renderHome();
    await enterEdit();

    await drag("wardrobe", AT.wardrobe, { x, z });

    await finishExpectSaved(withFloor(LB, "wardrobe", x, z, 3));
  });
});
