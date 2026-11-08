// [spec] qa 테스트(작업 063, 기능 변경: 모바일 홈 로비 장소에서 '들어가기'를 누른 뒤의 흐름).
// 기대값은 명세(private 작업 폴더 063-2026-11-08-모바일-로비-들어가기-동작/01-main-spec.md)의 "바뀌는 동작 1~5"와 "그대로여야 할 동작"에서만 가져온다.
// 그대로 둘 동작은 기준 커밋(f5964c4)의 지금 동작이다. 구현 코드는 부르는 방법(홈 화면, 3D 그리기에 넘기는 sim·onFrame·onPointer,
// 판의 구조, 클립을 고르는 characterClipState)을 알려고만 읽었다.
// 가짜로 두는 것은 home-lobby-records.spec.test.tsx와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스, 3D 그리기).
// 프레임은 0.05초씩 진행하고, 프레임마다 가짜 타이머·시계도 0.05초 옮긴다(동작 시간을 프레임으로 재든 타이머로 재든 같이 흐르게).
//
// 결정: 03-main-decision.md(사용자 2026-11-08) 2 "동작을 마친 뒤 인사"(B2, G1), 3 "걷는 중에 누르면 그 자리에서 바로 동작"(W1, W2),
// 4 "메뉴로 멈추면 원래 자리에 바로 선다"(U1~U3), 5 "돌아오는 동안도 방을 누르지 못함"(X1).
// 05-main-decision.md(사용자 2026-11-08 "앞으로 돌아서서 펼치기"): 책장을 보고 책을 꺼낸 뒤 앞(카메라 쪽)으로 돌아서서 펼치고, 꽂을 때는 다시 책장 쪽으로
// 돌아선다(B1, B2). "앞"은 방향 0(방 앞쪽 +z)에서 0.35라디안(약 20도) 안으로 본다.
// - 바뀔 동작(고치기 전에는 실패해야 한다): D1~D3, T1~T4, B1·B2, I1, U1~U3, G1, W1·W2, X1.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): R1·R2(명세 5: 동작 줄이기면 지금처럼 바로), P1~P3.
// - 13-main-decision.md 1(사용자 2026-11-08 "떠나면 동작 거두기")로 더한 것: L1·L2. 구현 커밋(8c1447a) 뒤에 더한 새 동작이라 그 커밋에서 실패해야 한다.
//
// 명세에 없는 이름·숫자(02-qa-tests.md "가정"):
// - 새 클립 이름은 명세에 없다. "새 동작 중" = 지금 고른 동작 클립이 있고 기존 클립 11개(아래 OLD_CLIPS)가 아님.
//   "서 있기" = 고른 동작 클립이 없음. 클립은 characterClipState로 고르고, 입력은 sim의 필드와 snapshot을 합쳐 넘긴다
//   (지금 3D 캐릭터는 sim의 speed·action·posture를 넘긴다. 새 동작 상태가 sim이나 snapshot에 생겨도 받게).
// - "약 1초": 누른 바로 뒤와 0.4초 뒤에는 아직 판이 열리지 않았고(기록 화면으로 가지 않았고), 2.5초 안에는 열린다(간다).
// - 닫은 뒤 "일어나 서는 자리로 돌아온다", "손을 내리고 서 있기로", 기록 화면에서 돌아온 뒤 "책을 다시 꽂고 서 있기로"는 3초 안(책은 6초 안)으로 본다.
// - "의자 자리로 옮겨"는 서는 자리(일기 책상의 서는 자리, 지금 (1.5, 6.75))에서 0.1칸 넘게 옮겨진 것으로, "책상을 보며"는 바라보는 쪽으로 곧게 그은 선이
//   책상 칸(x 0~3, z 5~6)의 가운데 줄 z = 5.5를 x 0~3 사이에서 지나는 것으로 본다.
// - 생각하기·책 꺼내기는 명세에 옮긴다는 말이 없어 제자리에서 하는 것으로 보고(T1), "그 장소를 본 채"는 바라보는 방향이 장소의 바라볼 지점(faceTo)
//   쪽에서 0.35라디안 안인 것으로 본다.
// - "판이 열려 있는 동안 유지"는 25초 동안 본다(오래 두면 바닥에 앉는 20초를 넘겨도 바닥에 앉지 않고 그 자세 그대로).
// - 03 결정 4의 "바로"는 메뉴를 누르고 한 프레임(0.05초) 안으로 본다. 03 결정 2의 인사는 이 데이터(오늘 완료)에서 '오늘도 해냈어!'와 jump다(060-10 명세 1의 표).
// - 03 결정 3의 "그 자리"는 버튼을 누른 자리에서 0.3칸 안(걷던 속도가 줄며 조금 더 갈 수 있음)으로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { AccessibilityInfo } from "react-native";
import type { TestInstance } from "test-renderer";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import HomeScreen from "@/app/index";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import { characterClipState, type CharacterClipInput } from "@/lib/lobby3d/character-clips";
import { MARKS, headingTo, type FloorPoint, type MarkId } from "@/lib/lobby3d/engine";
import { getDiaryCalendarSummary, getFeaturedDailyPrompt, getMobileHomeSnapshot, getMonthWritingStatus, getTodayWritingStatus, getWritingDraft, trackDailyPromptClick } from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot, TodayWritingStatus } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

const mockFocus = { focused: true, listeners: new Set<() => void>() };
const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canDismiss: jest.fn(() => false), dismissAll: jest.fn() },
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
  getLobbyLayout: jest.fn(() => Promise.resolve(null)),
  getMobileHomeSnapshot: jest.fn(),
  getMonthWritingStatus: jest.fn(),
  getTodayWritingStatus: jest.fn(),
  getWritingDraft: jest.fn(),
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

// ---------- 명세·지금 동작의 값 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";
/** 기존 클립 11개(명세 "지금 모습"). 이것이 아닌 클립이 새 클립이다. */
const OLD_CLIPS = ["idle", "walk", "wave", "jump", "hop", "point", "look_around", "poke", "sit_down", "sit_idle", "stand_up"];
/** 판 제목(지금 그대로). */
const SHEET = { question: "질문에 답하기", diary: "영어일기", thought: "지금 생각나는대로" } as const;
const RECORDS_MENU = "학습 기록";
/** 장소와 '들어가기'가 여는 판(지금 그대로: 게시판 → 질문, 책상 → 일기, 창가 → 생각). */
const SHEET_FOR: Record<"board" | "desk" | "window", string> = { board: SHEET.question, desk: SHEET.diary, window: SHEET.thought };
/** 일기 책상의 서는 자리(지금 값). */
const DESK_STAND: FloorPoint = { x: 1.5, z: 6.75 };
const DOOR_MESSAGE = "마을은 다음 업데이트에서 열려요";
const POKE_LINES = ["헤헤, 간지러워!", "응? 불렀어?", "오늘도 같이 쓰자!"];
/** 오늘 완료 데이터에서 홈에 들어올 때의 인사(060-10 명세 1의 표). */
const DONE_GREETING = "오늘도 해냈어!";
const GREETING_ACTION = "jump";
/** 장소 구역을 곧게 지나가는 길(061 화면 테스트 V5·V6과 같은 길). 시작과 끝은 어느 구역에도 들지 않는다. */
const PASS: Record<"board" | "window" | "desk", { start: FloorPoint; goal: FloorPoint }> = {
  board: { start: { x: 0.6, z: 1.2 }, goal: { x: 3.3, z: 1.2 } },
  window: { start: { x: 3.3, z: 1.2 }, goal: { x: 6.4, z: 1.2 } },
  desk: { start: { x: 0.6, z: 7.6 }, goal: { x: 3.0, z: 6.5 } }
};
const SLOW_TEST_MS = 60_000;

const signedInUser: AuthUser = { id: 7, email: "learner@example.com", displayName: "학습자", admin: false };

function todayStatus(): TodayWritingStatus {
  return {
    date: TODAY_KEY,
    completed: true,
    completedSessions: 1,
    startedSessions: 1,
    streakDays: 2,
    totalAnswerSessions: 12,
    totalWrittenSentences: 30
  };
}

function homeSnapshot(): MobileHomeSnapshot {
  return { todayStatus: todayStatus(), diaryCalendarSummary: { totalEntries: 0, days: [] }, featuredRecommendation: null };
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
const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

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

async function renderHome() {
  const view = await render(<HomeScreen />);
  await flushAsync();
  return view;
}

function canvas() {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function sim() {
  return canvas().sim;
}

function position(): FloorPoint {
  return { x: sim().x, z: sim().z };
}

/** seconds초 동안 0.05초씩 프레임을 진행한다(타이머·시계도 함께). 프레임마다 each를 부른다. */
async function frames(seconds: number, each?: () => void) {
  const count = Math.round(seconds / 0.05);
  for (let index = 0; index < count; index += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
    each?.();
  }
}

/** done이 참이 될 때까지 최대 maxSeconds초 프레임을 진행한다. */
async function framesUntil(maxSeconds: number, done: () => boolean) {
  for (let elapsed = 0; elapsed < maxSeconds && !done(); elapsed += 0.05) {
    await frames(0.05);
  }
  return done();
}

async function tap(hit: { point: FloorPoint | null; mark: MarkId | null; onCharacter: boolean }) {
  await act(async () => {
    canvas().onPointer("down", hit, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", hit, 200, 300);
  });
}

/** 장소를 눌러 걸어가 도착해 멈추고, 그 장소를 바라보게 0.5초 더 둔다. */
async function arriveAt(mark: MarkId) {
  await tap({ point: null, mark, onCharacter: false });
  expect(await framesUntil(20, () => sim().arrived === mark && sim().vx === 0 && sim().vz === 0)).toBe(true);
  await frames(0.5);
}

function bubbleOf(line: string) {
  let node = screen.getByText(line).parent!;
  while (node.props.pointerEvents === "none") node = node.parent!;
  return node;
}

/** 도착한 장소의 말풍선 버튼('들어가기'·'나가기')을 누른다(프레임은 진행하지 않는다). */
async function pressEnter(mark: MarkId) {
  await fireEvent.press(within(bubbleOf(MARKS[mark].prompt)).getByRole("button", { name: MARKS[mark].buttonLabel }));
  await flushAsync();
}

/** 아래 메뉴 버튼을 누른다(프레임은 진행하지 않는다). */
async function pressMenu(label: string) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
  await flushAsync();
}

/** 열려 있는 판(질문·일기·생각)의 제목. */
function openSheets(): string[] {
  return screen.root!
    .queryAll((instance: TestInstance) => instance.type === "Modal" && instance.props.animationType === "slide" && instance.props.visible !== false)
    .flatMap((modal) => Object.values(SHEET).filter((title) => within(modal).queryAllByRole("header", { name: title }).length > 0));
}

async function closeSheet(title: string) {
  const modal = screen.root!.queryAll(
    (instance: TestInstance) =>
      instance.type === "Modal" &&
      instance.props.animationType === "slide" &&
      instance.props.visible !== false &&
      within(instance).queryAllByRole("header", { name: title }).length > 0
  );
  expect(modal).toHaveLength(1);
  await fireEvent.press(within(modal[0]).getByRole("button", { name: "닫기" }));
  await flushAsync();
}

/** 다른 화면으로 간 곳(push·replace·navigate를 모두 모은다). */
function navigatedTo() {
  return [
    ...jest.mocked(router.push).mock.calls,
    ...jest.mocked(router.replace).mock.calls,
    ...jest.mocked(router.navigate).mock.calls
  ].map((call) => call[0]);
}

/** 지금 3D 캐릭터가 고를 클립 상태. sim의 필드와 snapshot을 합쳐 넘긴다(머리말 "가정"). */
function clipState() {
  const s = sim();
  const input = { ...(s as unknown as Record<string, unknown>), ...s.snapshot(Date.now()) } as unknown as CharacterClipInput;
  return characterClipState(input);
}

/** 지금 하는 새 동작 클립(기존 11개가 아닌 동작 클립). 없으면 null. */
function newClip(): string | null {
  const clip = clipState().actionClip;
  return clip !== null && !OLD_CLIPS.includes(clip) ? clip : null;
}

function standing() {
  return clipState().actionClip === null;
}

function distance(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleOff(a: number, b: number) {
  const d = Math.abs((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  return d;
}

/** 라이트루프가 장소의 바라볼 지점 쪽을 보고 있는지(0.35라디안 안). */
function facesPlace(mark: MarkId) {
  return angleOff(sim().heading, headingTo(position(), MARKS[mark].faceTo)) <= 0.35;
}

/** 라이트루프가 앞(카메라 쪽, 방 앞쪽 +z = 방향 0)을 보고 있는지(0.35라디안 안). 05 결정의 "앞"을 qa가 이 범위로 정했다. */
function facesFront() {
  return angleOff(sim().heading, 0) <= 0.35;
}

/** 바라보는 쪽으로 곧게 그은 선이 책상 칸 가운데 줄(z = 5.5)을 x 0~3 사이에서 지나는지. */
function facesDesk() {
  const h = sim().heading;
  const dz = Math.cos(h);
  if (dz >= 0) return false;
  const t = (5.5 - sim().z) / dz;
  if (t <= 0) return false;
  const x = sim().x + Math.sin(h) * t;
  return x >= 0 && x <= 3;
}

function alertTexts() {
  return screen.root!
    .queryAll((instance: TestInstance) => instance.props.accessibilityRole === "alert" && typeof instance.type === "string")
    .map((node) => node.queryAll((child: TestInstance) => typeof child.props.children === "string").map((child) => child.props.children as string).join(""));
}

async function setFocused(focused: boolean) {
  await act(async () => {
    mockFocus.focused = focused;
    mockFocus.listeners.forEach((listener) => listener());
  });
  await flushAsync();
}

/**
 * '들어가기'를 누른 뒤, 판(또는 기록 화면)이 열릴 때까지 프레임을 진행하며 본다.
 * 누른 바로 뒤와 0.4초 뒤에는 아직 열리지 않았는지, 그 사이 새 클립이 보였는지, 2.5초 안에 열렸는지를 돌려준다.
 */
async function watchEnterUntil(opened: () => boolean, each?: (elapsed: number) => void) {
  const result = {
    openAtPress: opened(),
    openAt04: false,
    openWithin25: false,
    newClipsBeforeOpen: new Set<string>(),
    secondsToOpen: Number.NaN
  };
  let elapsed = 0;
  while (elapsed < 2.5 && !opened()) {
    // each는 열리기 전 프레임마다, 누른 뒤 지난 시간(초)과 함께 부른다(0은 누른 바로 뒤)
    each?.(+elapsed.toFixed(2));
    const clip = newClip();
    if (clip) result.newClipsBeforeOpen.add(clip);
    await frames(0.05);
    elapsed += 0.05;
    if (Math.abs(elapsed - 0.4) < 1e-6) result.openAt04 = opened();
  }
  if (elapsed < 0.4) result.openAt04 = opened();
  result.openWithin25 = opened();
  result.secondsToOpen = +elapsed.toFixed(2);
  return result;
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  jest.mocked(router.push).mockReset();
  jest.mocked(router.replace).mockReset();
  jest.mocked(router.navigate).mockReset();
  jest.mocked(getMobileHomeSnapshot).mockReset().mockResolvedValue(homeSnapshot());
  jest.mocked(getTodayWritingStatus).mockReset().mockResolvedValue(todayStatus());
  jest.mocked(getDiaryCalendarSummary).mockReset().mockResolvedValue({ totalEntries: 0, days: [] });
  jest.mocked(getFeaturedDailyPrompt).mockReset().mockRejectedValue(new Error("추천 질문은 이 테스트에서 보지 않음"));
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
  refreshSession.mockReset().mockResolvedValue(signedInUser);
  setSessionUser(signedInUser);
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
  // 기기 설정 "동작 줄이기"는 기본 끔. R1·R2만 켠다.
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  jest.useRealTimers();
});

// ---------- 바뀔 동작: 일기 책상 ----------

describe("[spec] 작업 063 바뀔 동작: 일기 책상에서 '들어가기'(명세 1)", () => {
  it("D1: 누르면 바로 판이 열리지 않고 의자에 앉는 동작(새 클립)을 한 뒤(약 1초) 영어일기 판만 열린다. 열릴 때 라이트루프는 서는 자리에서 의자 자리로 옮겨 책상을 보고 있다", async () => {
    await renderHome();
    await arriveAt("desk");
    expect(distance(position(), DESK_STAND)).toBeLessThan(1e-6);

    await pressEnter("desk");
    const watched = await watchEnterUntil(() => openSheets().length > 0);

    expect({
      openAtPress: watched.openAtPress,
      openAt04: watched.openAt04,
      openWithin25: watched.openWithin25,
      sawNewClip: watched.newClipsBeforeOpen.size > 0,
      sheets: openSheets(),
      navigated: navigatedTo()
    }).toEqual({ openAtPress: false, openAt04: false, openWithin25: true, sawNewClip: true, sheets: [SHEET.diary], navigated: [] });
    expect(distance(position(), DESK_STAND)).toBeGreaterThan(0.1);
    expect(facesDesk()).toBe(true);
  });

  it("D2: 판이 열려 있는 동안(25초) 판 뒤 로비의 라이트루프는 의자 자리에 앉은 채 그대로다(매 프레임 새 클립, 바닥에 앉기 아님, 자리·방향 그대로)", async () => {
    await renderHome();
    await arriveAt("desk");
    await pressEnter("desk");
    expect((await watchEnterUntil(() => openSheets().length > 0)).openWithin25).toBe(true);
    const seat = position();
    const problems: string[] = [];

    let second = 0;
    await frames(25, () => {
      second += 0.05;
      const clip = clipState();
      if (!(clip.actionClip !== null && !OLD_CLIPS.includes(clip.actionClip) && Math.abs(clip.actionWeight - 1) < 1e-6)) {
        problems.push(`${second.toFixed(2)}초: ${clip.actionClip} 무게 ${clip.actionWeight}`);
      }
    });

    expect(problems.slice(0, 5)).toEqual([]);
    expect(openSheets()).toEqual([SHEET.diary]);
    expect(sim().x).toBeCloseTo(seat.x, 3);
    expect(sim().z).toBeCloseTo(seat.z, 3);
    expect(facesDesk()).toBe(true);
  }, SLOW_TEST_MS);

  it("D3: 판을 닫으면 일어나는 동작(새 클립)을 하고 3초 안에 서는 자리로 돌아와 서 있으며, 그 뒤 바닥을 누르면 걸어간다", async () => {
    await renderHome();
    await arriveAt("desk");
    await pressEnter("desk");
    expect((await watchEnterUntil(() => openSheets().length > 0)).openWithin25).toBe(true);
    await frames(1);
    const holdClip = newClip();

    await closeSheet(SHEET.diary);
    const seen = new Set<string>();
    await frames(3, () => {
      const clip = newClip();
      if (clip) seen.add(clip);
    });

    expect(openSheets()).toEqual([]);
    expect(holdClip).not.toBeNull();
    expect([...seen].filter((clip) => clip !== holdClip).length).toBeGreaterThan(0);
    expect(sim().x).toBeCloseTo(DESK_STAND.x, 2);
    expect(sim().z).toBeCloseTo(DESK_STAND.z, 2);
    expect(standing()).toBe(true);

    const goal = { x: 4.5, z: 9.5 };
    await tap({ point: goal, mark: null, onCharacter: false });
    expect(await framesUntil(8, () => distance(position(), goal) < 1e-3)).toBe(true);
  }, SLOW_TEST_MS);
});

// ---------- 바뀔 동작: 생각 창가·오늘의 질문 ----------

describe("[spec] 작업 063 바뀔 동작: 생각 창가·오늘의 질문에서 '들어가기'(명세 2)", () => {
  const PLACES: ["board" | "window"][] = [["board"], ["window"]];

  it.each(PLACES)("T1 %s: 누르면 바로 판이 열리지 않고 그 장소를 본 채 생각하는 동작(새 클립)을 한 뒤(약 1초) 그 판만 열린다. 자리는 그대로다", async (mark) => {
    await renderHome();
    await arriveAt(mark);
    const spot = position();

    await pressEnter(mark);
    const watched = await watchEnterUntil(() => openSheets().length > 0);

    expect({
      openAtPress: watched.openAtPress,
      openAt04: watched.openAt04,
      openWithin25: watched.openWithin25,
      sawNewClip: watched.newClipsBeforeOpen.size > 0,
      sheets: openSheets(),
      navigated: navigatedTo()
    }).toEqual({ openAtPress: false, openAt04: false, openWithin25: true, sawNewClip: true, sheets: [SHEET_FOR[mark]], navigated: [] });
    expect(position()).toEqual(spot);
    expect(facesPlace(mark)).toBe(true);
  });

  it.each(PLACES)("T2 %s: 판이 열려 있는 동안(25초) 생각하는 자세(새 클립)를 유지하고, 자리와 장소를 보는 방향이 그대로다(바닥에 앉지 않는다)", async (mark) => {
    await renderHome();
    await arriveAt(mark);
    const spot = position();
    await pressEnter(mark);
    expect((await watchEnterUntil(() => openSheets().length > 0)).openWithin25).toBe(true);
    const problems: string[] = [];

    let second = 0;
    await frames(25, () => {
      second += 0.05;
      const clip = clipState();
      if (!(clip.actionClip !== null && !OLD_CLIPS.includes(clip.actionClip) && Math.abs(clip.actionWeight - 1) < 1e-6)) {
        problems.push(`${second.toFixed(2)}초: ${clip.actionClip} 무게 ${clip.actionWeight}`);
      }
    });

    expect(problems.slice(0, 5)).toEqual([]);
    expect(openSheets()).toEqual([SHEET_FOR[mark]]);
    expect(position()).toEqual(spot);
    expect(facesPlace(mark)).toBe(true);
  }, SLOW_TEST_MS);

  it.each(PLACES)("T3 %s: 판을 닫으면 손을 내리는 동작(새 클립)을 하고 3초 안에 서 있기로 돌아오며 자리는 그대로다", async (mark) => {
    await renderHome();
    await arriveAt(mark);
    const spot = position();
    await pressEnter(mark);
    expect((await watchEnterUntil(() => openSheets().length > 0)).openWithin25).toBe(true);
    await frames(1);
    const holdClip = newClip();

    await closeSheet(SHEET_FOR[mark]);
    const seen = new Set<string>();
    await frames(3, () => {
      const clip = newClip();
      if (clip) seen.add(clip);
    });

    expect(openSheets()).toEqual([]);
    expect(holdClip).not.toBeNull();
    expect([...seen].filter((clip) => clip !== holdClip).length).toBeGreaterThan(0);
    expect(standing()).toBe(true);
    expect(position()).toEqual(spot);
  }, SLOW_TEST_MS);

  it("T4: 게시판과 창가의 생각하는 자세는 같은 클립이고, 일기 책상에 앉아 있는 자세와는 다른 클립이다", async () => {
    await renderHome();
    const holdOf = async (mark: "board" | "window" | "desk") => {
      await arriveAt(mark);
      await pressEnter(mark);
      expect((await watchEnterUntil(() => openSheets().length > 0)).openWithin25).toBe(true);
      await frames(1.5);
      const clip = newClip();
      await closeSheet(SHEET_FOR[mark]);
      await frames(3);
      return clip;
    };

    const board = await holdOf("board");
    const window = await holdOf("window");
    const desk = await holdOf("desk");

    expect(board).not.toBeNull();
    expect(desk).not.toBeNull();
    expect(window).toBe(board);
    expect(desk).not.toBe(board);
  }, SLOW_TEST_MS);
});

// ---------- 바뀔 동작: 책장 ----------

describe("[spec] 작업 063 바뀔 동작: 책장에서 '들어가기'(명세 3)", () => {
  it("B1(05 결정): 누르면 바로 기록 화면으로 가지 않고, 책장을 보고 책을 꺼낸 뒤 앞(카메라 쪽)으로 돌아서서 펼치는 동작(새 클립)을 한 뒤(약 1초) 기록 화면(/records)으로 한 번 간다. 판은 열리지 않는다", async () => {
    await renderHome();
    await arriveAt("bookcase");

    await pressEnter("bookcase");
    // 꺼낼 때(누른 바로 뒤와 0.1초 뒤)는 책장을 본다
    const takingOut: Record<string, boolean> = {};
    const watched = await watchEnterUntil(
      () => navigatedTo().length > 0,
      (elapsed) => {
        if (elapsed === 0 || elapsed === 0.1) takingOut[String(elapsed)] = facesPlace("bookcase");
      }
    );

    expect({
      goneAtPress: watched.openAtPress,
      goneAt04: watched.openAt04,
      goneWithin25: watched.openWithin25,
      sawNewClip: watched.newClipsBeforeOpen.size > 0,
      navigated: navigatedTo(),
      sheets: openSheets(),
      facesBookcaseWhileTakingOut: takingOut,
      // 펼친 뒤(기록 화면으로 갈 때)는 앞을 본다
      facesFrontWhenOpened: facesFront()
    }).toEqual({
      goneAtPress: false,
      goneAt04: false,
      goneWithin25: true,
      sawNewClip: true,
      navigated: ["/records"],
      sheets: [],
      facesBookcaseWhileTakingOut: { "0": true, "0.1": true },
      facesFrontWhenOpened: true
    });
  });

  it("B2(03 결정 2, 05 결정): 기록 화면에서 홈으로 돌아오면 다시 책장 쪽으로 돌아서서 책을 꽂는 동작(꺼낼 때와 다른 새 클립)을 하고, 그 동작이 끝나 제자리에 선 뒤에 인사('오늘도 해냈어!'와 jump)를 한다(6초 안)", async () => {
    await renderHome();
    await arriveAt("bookcase");
    const spot = position();
    await pressEnter("bookcase");
    const watched = await watchEnterUntil(() => navigatedTo().length > 0);
    expect(watched.openWithin25).toBe(true);
    const takeOut = new Set(watched.newClipsBeforeOpen);
    expect(takeOut.size).toBeGreaterThan(0);

    // 기록 화면이 홈 위에 올라왔다가(포커스 잃음) 돌아온다(포커스 받음)
    await setFocused(false);
    await setFocused(true);
    const putBack = new Set<string>();
    let lastNewClipAt = Number.NaN;
    let greetedAt = Number.NaN;
    let greetedAtSpot = false;
    let lineDuringPutBack = false;
    let facedBookcaseWhilePutBack = false;
    let second = 0;
    await frames(6, () => {
      second += 0.05;
      const clip = newClip();
      if (clip) {
        if (!takeOut.has(clip)) {
          putBack.add(clip);
          if (facesPlace("bookcase")) facedBookcaseWhilePutBack = true;
        }
        lastNewClipAt = second;
        if (screen.queryByText(DONE_GREETING) !== null) lineDuringPutBack = true;
      }
      if (Number.isNaN(greetedAt) && sim().action?.type === GREETING_ACTION) {
        greetedAt = second;
        greetedAtSpot = distance(position(), spot) < 1e-3;
      }
    });

    expect({
      putBack: putBack.size > 0,
      facedBookcaseWhilePutBack,
      greeted: !Number.isNaN(greetedAt),
      greetedAfterPutBack: greetedAt > lastNewClipAt,
      greetedAtSpot,
      lineDuringPutBack,
      lineNow: screen.queryByText(DONE_GREETING) !== null,
      navigated: navigatedTo()
    }).toEqual({
      putBack: true,
      facedBookcaseWhilePutBack: true,
      greeted: true,
      greetedAfterPutBack: true,
      greetedAtSpot: true,
      lineDuringPutBack: false,
      lineNow: true,
      navigated: ["/records"]
    });
  }, SLOW_TEST_MS);
});

// ---------- 바뀔 동작: 동작하는 동안의 누르기 ----------

describe("[spec] 작업 063 바뀔 동작: 동작하는 약 1초 동안(명세 4)", () => {
  it("I1: 동작하는 동안 바닥·라이트루프·다른 장소를 눌러도 받지 않는다(걸어가지 않고, 눌렀을 때 반응도 없다). 동작이 끝나면 판이 열린다", async () => {
    await renderHome();
    await arriveAt("board");
    const spot = position();
    await pressEnter("board");
    await frames(0.2);
    // 정말 동작하는 중(판이 아직 열리지 않음)에 누르는지 먼저 본다
    expect(openSheets()).toEqual([]);

    await tap({ point: { x: 4.5, z: 9.5 }, mark: null, onCharacter: false });
    await tap({ point: null, mark: null, onCharacter: true });
    await tap({ point: null, mark: "window", onCharacter: false });
    let farthest = 0;
    let poked = false;
    await frames(3, () => {
      farthest = Math.max(farthest, distance(position(), spot));
      if (sim().action?.type === "poke" || POKE_LINES.some((line) => screen.queryByText(line) !== null)) poked = true;
    });

    expect({ farthest: farthest <= 0.3, poked, arrived: sim().arrived, sheets: openSheets() }).toEqual({
      farthest: true,
      poked: false,
      arrived: "board",
      sheets: [SHEET.question]
    });
  }, SLOW_TEST_MS);

  /** 메뉴를 누른 뒤 한 프레임 안에 원래 자리에 서 있고(새 클립 없음), 그 뒤 3초 동안도 새 클립 없이 그 자리인지 본다. */
  async function standsRightAway(spot: FloorPoint) {
    await frames(0.05);
    const right = { atSpot: distance(position(), spot) < 1e-6, standing: standing(), newClip: newClip() };
    const later = new Set<string>();
    let moved = false;
    await frames(3, () => {
      const clip = newClip();
      if (clip) later.add(clip);
      if (distance(position(), spot) >= 1e-6) moved = true;
    });
    return { right, laterNewClips: [...later], moved };
  }

  it("U1(03 결정 4): 일기 책상의 동작 중에 아래 '질문에 답하기'를 누르면 동작을 멈추고 질문 판이 바로 열리며, 일어나기 없이 서는 자리에 바로 서고, 그 뒤에도 일기 판은 열리지 않는다", async () => {
    await renderHome();
    await arriveAt("desk");
    await pressEnter("desk");
    await frames(0.2);
    expect(openSheets()).toEqual([]);

    await pressMenu(SHEET.question);
    const sheetsRight = openSheets();
    const stood = await standsRightAway(DESK_STAND);

    expect({ sheetsRight, ...stood, later: openSheets(), navigated: navigatedTo() }).toEqual({
      sheetsRight: [SHEET.question],
      right: { atSpot: true, standing: true, newClip: null },
      laterNewClips: [],
      moved: false,
      later: [SHEET.question],
      navigated: []
    });
  }, SLOW_TEST_MS);

  it("U2(03 결정 4): 일기 책상의 동작 중에 아래 '학습 기록'을 누르면 동작을 멈추고 기록 화면(/records)으로 바로 한 번 가며, 서는 자리에 바로 서고, 그 뒤에도 일기 판은 열리지 않는다", async () => {
    await renderHome();
    await arriveAt("desk");
    await pressEnter("desk");
    await frames(0.2);
    expect(openSheets()).toEqual([]);

    await pressMenu(RECORDS_MENU);
    const navigatedRight = navigatedTo();
    const stood = await standsRightAway(DESK_STAND);

    expect({ navigatedRight, ...stood, later: navigatedTo(), sheets: openSheets() }).toEqual({
      navigatedRight: ["/records"],
      right: { atSpot: true, standing: true, newClip: null },
      laterNewClips: [],
      moved: false,
      later: ["/records"],
      sheets: []
    });
  }, SLOW_TEST_MS);

  it("U3(03 결정 4): 책장의 동작 중에 아래 '영어일기'를 누르면 동작을 멈추고 일기 판이 바로 열리며, 책 꽂기 없이 그 자리에 바로 서고, 그 뒤에도 기록 화면으로 가지 않는다", async () => {
    await renderHome();
    await arriveAt("bookcase");
    const spot = position();
    await pressEnter("bookcase");
    await frames(0.2);
    expect(navigatedTo()).toEqual([]);

    await pressMenu(SHEET.diary);
    const sheetsRight = openSheets();
    const stood = await standsRightAway(spot);

    expect({ sheetsRight, ...stood, later: openSheets(), navigated: navigatedTo() }).toEqual({
      sheetsRight: [SHEET.diary],
      right: { atSpot: true, standing: true, newClip: null },
      laterNewClips: [],
      moved: false,
      later: [SHEET.diary],
      navigated: []
    });
  }, SLOW_TEST_MS);
});

// ---------- 바뀔 동작: 03 결정 2·3·5 ----------

describe("[spec] 작업 063 바뀔 동작: 판을 연 채 다른 화면에 갔다 오면 동작을 마친 뒤 인사(03 결정 2)", () => {
  const PLACES: ["desk" | "board"][] = [["desk"], ["board"]];

  it.each(PLACES)("G1 %s: 판이 열린 채 돌아오면 판이 열려 있는 동안(3초)은 자세를 유지하고 인사하지 않으며, 판을 닫고 제자리에 선 뒤 '오늘도 해냈어!'와 jump", async (mark) => {
    await renderHome();
    await arriveAt(mark);
    const spot = position();
    await pressEnter(mark);
    expect((await watchEnterUntil(() => openSheets().length > 0)).openWithin25).toBe(true);
    await frames(1);

    // 판 안에서 다른 화면으로 갔다가(포커스 잃음) 돌아온다(포커스 받음). 판은 그대로 열려 있다
    await setFocused(false);
    await setFocused(true);
    const problems: string[] = [];
    let second = 0;
    await frames(3, () => {
      second += 0.05;
      const clip = clipState();
      if (!(clip.actionClip !== null && !OLD_CLIPS.includes(clip.actionClip) && Math.abs(clip.actionWeight - 1) < 1e-6)) {
        problems.push(`${second.toFixed(2)}초: ${clip.actionClip} 무게 ${clip.actionWeight}`);
      }
      if (sim().action?.type === GREETING_ACTION || screen.queryByText(DONE_GREETING) !== null) problems.push(`${second.toFixed(2)}초: 인사`);
    });
    expect({ problems: problems.slice(0, 5), sheets: openSheets() }).toEqual({ problems: [], sheets: [SHEET_FOR[mark]] });

    await closeSheet(SHEET_FOR[mark]);
    let greeted = false;
    let greetedAtSpot = false;
    let newClipWhenGreeted: string | null = "(인사 없음)";
    let lineBeforeGreeting = false;
    for (let elapsed = 0; elapsed < 4 && !greeted; elapsed += 0.05) {
      if (screen.queryByText(DONE_GREETING) !== null) lineBeforeGreeting = true;
      await frames(0.05);
      if (sim().action?.type === GREETING_ACTION) {
        greeted = true;
        greetedAtSpot = distance(position(), spot) < 1e-3;
        newClipWhenGreeted = newClip();
      }
    }
    await flushAsync();

    expect({ greeted, greetedAtSpot, newClipWhenGreeted, lineBeforeGreeting, line: screen.queryByText(DONE_GREETING) !== null }).toEqual({
      greeted: true,
      greetedAtSpot: true,
      newClipWhenGreeted: null,
      lineBeforeGreeting: false,
      line: true
    });
  }, SLOW_TEST_MS);
});

describe("[spec] 작업 063 바뀔 동작: 구역 안에서 걷는 중에 '들어가기'를 누르면 그 자리에서 바로 동작(03 결정 3)", () => {
  /** start에서 goal로 걸어가게 하고, 장소 구역 가운데에서 0.6칸 안을 걷는 중일 때까지 프레임을 진행한다. */
  async function walkIntoZone(mark: "board" | "window" | "desk") {
    const { start, goal } = PASS[mark];
    await tap({ point: start, mark: null, onCharacter: false });
    expect(await framesUntil(20, () => distance(position(), start) < 1e-6 && sim().vx === 0 && sim().vz === 0)).toBe(true);
    await frames(0.5);
    await tap({ point: goal, mark: null, onCharacter: false });
    const approach = MARKS[mark].approach;
    const center = {
      x: approach.reduce((sum, p) => sum + p.x, 0) / approach.length,
      z: approach.reduce((sum, p) => sum + p.z, 0) / approach.length
    };
    const walkingInZone = () => {
      const snap = sim().snapshot(Date.now());
      return snap.place === mark && snap.speed > 0.3 && distance(position(), center) < 0.6;
    };
    expect(await framesUntil(10, walkingInZone)).toBe(true);
    return goal;
  }

  const THINK: ["board" | "window"][] = [["board"], ["window"]];

  it.each(THINK)("W1 %s: 걷는 중에 누르면 그 자리에 멈춰 장소를 보며 생각하는 동작(새 클립)을 한 뒤 판이 열리고, 판이 열린 동안 그 자리 그대로다(걷던 곳으로 가지 않는다)", async (mark) => {
    await renderHome();
    const goal = await walkIntoZone(mark);
    const pressedAt = position();

    await pressEnter(mark);
    const watched = await watchEnterUntil(() => openSheets().length > 0);
    const openAt = position();
    await frames(1);

    expect({
      openAtPress: watched.openAtPress,
      openWithin25: watched.openWithin25,
      sawNewClip: watched.newClipsBeforeOpen.size > 0,
      sheets: openSheets(),
      nearPressed: distance(openAt, pressedAt) <= 0.3,
      stayed: distance(position(), openAt) < 1e-6,
      stopped: Math.hypot(sim().vx, sim().vz) < 0.05,
      reachedGoal: distance(position(), goal) < 0.3,
      faces: facesPlace(mark)
    }).toEqual({
      openAtPress: false,
      openWithin25: true,
      sawNewClip: true,
      sheets: [SHEET_FOR[mark]],
      nearPressed: true,
      stayed: true,
      stopped: true,
      reachedGoal: false,
      faces: true
    });
  }, SLOW_TEST_MS);

  it("W2 desk: 걷는 중에 누르면 그 자리에서 의자로 옮겨 책상을 보며 앉는 동작을 한 뒤 일기 판이 열리고, 판을 닫으면 3초 안에 누른 자리로 돌아와 서 있다(걷던 곳으로 가지 않는다)", async () => {
    await renderHome();
    const goal = await walkIntoZone("desk");
    const pressedAt = position();

    await pressEnter("desk");
    const watched = await watchEnterUntil(() => openSheets().length > 0);
    expect({
      openAtPress: watched.openAtPress,
      openWithin25: watched.openWithin25,
      sawNewClip: watched.newClipsBeforeOpen.size > 0,
      sheets: openSheets(),
      facesDesk: facesDesk()
    }).toEqual({ openAtPress: false, openWithin25: true, sawNewClip: true, sheets: [SHEET.diary], facesDesk: true });

    await closeSheet(SHEET.diary);
    await frames(3);

    expect({
      backNearPressed: distance(position(), pressedAt) <= 0.3,
      stopped: Math.hypot(sim().vx, sim().vz) < 0.05,
      standing: standing(),
      reachedGoal: distance(position(), goal) < 0.3
    }).toEqual({ backNearPressed: true, stopped: true, standing: true, reachedGoal: false });
  }, SLOW_TEST_MS);
});

describe("[spec] 작업 063 바뀔 동작: 판을 닫은 뒤 제자리로 돌아오는 동안도 방을 누르지 못한다(03 결정 5)", () => {
  const PLACES: ["desk" | "board"][] = [["desk"], ["board"]];

  it.each(PLACES)("X1 %s: 판을 닫고 돌아오는 동작 중에 바닥·라이트루프를 눌러도 받지 않고 제자리에 서며, 선 뒤에는 바닥을 누르면 걸어간다", async (mark) => {
    await renderHome();
    await arriveAt(mark);
    const spot = position();
    await pressEnter(mark);
    expect((await watchEnterUntil(() => openSheets().length > 0)).openWithin25).toBe(true);
    await frames(1);

    await closeSheet(SHEET_FOR[mark]);
    await frames(0.2);
    // 정말 돌아오는 동작 중(새 클립)에 누르는지 먼저 본다
    expect(newClip()).not.toBeNull();
    const goal = { x: 4.5, z: 9.5 };
    await tap({ point: goal, mark: null, onCharacter: false });
    await tap({ point: null, mark: null, onCharacter: true });
    let poked = false;
    let closest = Infinity;
    await frames(3, () => {
      closest = Math.min(closest, distance(position(), goal));
      if (sim().action?.type === "poke" || POKE_LINES.some((line) => screen.queryByText(line) !== null)) poked = true;
    });

    expect({ poked, walkedToGoal: closest < 3, atSpot: distance(position(), spot) < 1e-3, standing: standing() }).toEqual({
      poked: false,
      walkedToGoal: false,
      atSpot: true,
      standing: true
    });

    await tap({ point: goal, mark: null, onCharacter: false });
    expect(await framesUntil(8, () => distance(position(), goal) < 1e-3)).toBe(true);
  }, SLOW_TEST_MS);
});

// ---------- 바뀔 동작: 13 결정 1 ----------

describe("[spec] 작업 063 바뀔 동작: 들어가는 동작 중에 다른 화면으로 가면 들어가기를 거두고 원래 자리에 선다(13 결정 1)", () => {
  /**
   * 들어가는 동작 중(누르고 0.2초, 아직 판·기록 화면 전)에 다른 화면으로 갔다가(포커스 잃음) 돌아온다(포커스 받음).
   * 일기 책상은 의자를 빼는 동안 새 클립이 아직 없을 수 있어, 동작 중인지는 판·기록 화면이 아직인 것으로만 본다.
   * 다른 화면에 있는 동안은 3D 그리기가 멈추므로 프레임을 진행하지 않는다.
   */
  async function leaveDuringEnter(mark: MarkId) {
    await renderHome();
    await arriveAt(mark);
    const spot = position();
    await pressEnter(mark);
    await frames(0.2);
    // 정말 들어가는 동작 중에 떠나는지 먼저 본다
    expect({ sheets: openSheets(), navigated: navigatedTo() }).toEqual({ sheets: [], navigated: [] });

    await setFocused(false);
    await setFocused(true);
    await frames(0.05);
    const right = { atSpot: distance(position(), spot) < 1e-6, newClip: newClip() };
    const sheetsSeen = new Set<string>();
    const newClips = new Set<string>();
    await frames(3, () => {
      openSheets().forEach((title) => sheetsSeen.add(title));
      const clip = newClip();
      if (clip) newClips.add(clip);
    });
    return { right, sheetsSeen: [...sheetsSeen], newClips: [...newClips], navigated: navigatedTo(), atSpotLater: distance(position(), spot) < 1e-6 };
  }

  const SHEET_PLACES: ["desk" | "board" | "window"][] = [["desk"], ["board"], ["window"]];

  it.each(SHEET_PLACES)("L1 %s: 동작 중에 다른 화면에 갔다 오면 원래 자리에 새 클립 없이 서 있고, 그 뒤 3초 동안 판이 열리지 않는다", async (mark) => {
    expect(await leaveDuringEnter(mark)).toEqual({
      right: { atSpot: true, newClip: null },
      sheetsSeen: [],
      newClips: [],
      navigated: [],
      atSpotLater: true
    });
  }, SLOW_TEST_MS);

  it("L2 bookcase: 책을 꺼내는 동작 중에 다른 화면에 갔다 오면 원래 자리에 새 클립 없이 서 있고, 그 뒤 3초 동안 기록 화면으로 가지 않는다", async () => {
    expect(await leaveDuringEnter("bookcase")).toEqual({
      right: { atSpot: true, newClip: null },
      sheetsSeen: [],
      newClips: [],
      navigated: [],
      atSpotLater: true
    });
  }, SLOW_TEST_MS);
});

// ---------- 그대로 둘 동작: 동작 줄이기(명세 5) ----------

describe("[spec] 작업 063 그대로 둘 동작: \"동작 줄이기\"가 켜져 있으면 동작 없이 지금처럼 바로(명세 5)", () => {
  const PLACES: ["board" | "desk" | "window"][] = [["board"], ["desk"], ["window"]];

  it.each(PLACES)("R1 %s: '들어가기'를 누르면 바로 그 판이 열리고, 그 뒤 2초 동안 새 클립이 없다", async (mark) => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderHome();
    await arriveAt(mark);

    await pressEnter(mark);
    const right = openSheets();
    const seen = new Set<string>();
    await frames(2, () => {
      const clip = newClip();
      if (clip) seen.add(clip);
    });

    expect({ right, newClips: [...seen], later: openSheets(), navigated: navigatedTo() }).toEqual({
      right: [SHEET_FOR[mark]],
      newClips: [],
      later: [SHEET_FOR[mark]],
      navigated: []
    });
  });

  it("R2 bookcase: '들어가기'를 누르면 바로 기록 화면(/records)으로 한 번 가고, 그 뒤 2초 동안 새 클립이 없다", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderHome();
    await arriveAt("bookcase");

    await pressEnter("bookcase");
    const right = navigatedTo();
    const seen = new Set<string>();
    await frames(2, () => {
      const clip = newClip();
      if (clip) seen.add(clip);
    });

    expect({ right, newClips: [...seen], later: navigatedTo(), sheets: openSheets() }).toEqual({
      right: ["/records"],
      newClips: [],
      later: ["/records"],
      sheets: []
    });
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 작업 063 그대로 둘 동작(지금 동작)", () => {
  it("P1: 밖으로에서 '나가기'를 누르면 바로 마을 안내가 짧은 안내로 뜨고, 판이 열리지 않고 다른 화면으로 가지 않으며, 새 클립 없이 자리 그대로다", async () => {
    await renderHome();
    await arriveAt("door");
    const spot = position();

    await pressEnter("door");
    const right = alertTexts();
    const seen = new Set<string>();
    await frames(2, () => {
      const clip = newClip();
      if (clip) seen.add(clip);
    });

    expect({ right, newClips: [...seen], sheets: openSheets(), navigated: navigatedTo() }).toEqual({
      right: [DOOR_MESSAGE],
      newClips: [],
      sheets: [],
      navigated: []
    });
    expect(position()).toEqual(spot);
  });

  const MENUS: [string, string][] = [
    ["질문에 답하기", SHEET.question],
    ["영어일기", SHEET.diary],
    ["지금 생각나는대로", SHEET.thought]
  ];

  it.each(MENUS)("P2: 일기 책상에 서 있을 때 아래 메뉴 '%s'를 누르면 동작 없이 바로 그 판이 열린다(새 클립 없음, 자리 그대로)", async (label, title) => {
    await renderHome();
    await arriveAt("desk");
    const spot = position();

    await pressMenu(label);
    const right = openSheets();
    const seen = new Set<string>();
    await frames(2, () => {
      const clip = newClip();
      if (clip) seen.add(clip);
    });

    expect({ right, newClips: [...seen], later: openSheets(), navigated: navigatedTo() }).toEqual({
      right: [title],
      newClips: [],
      later: [title],
      navigated: []
    });
    expect(position()).toEqual(spot);
  });

  it("P2 학습 기록: 책장에 서 있을 때 아래 메뉴 '학습 기록'을 누르면 동작 없이 바로 기록 화면(/records)으로 한 번 간다(새 클립 없음)", async () => {
    await renderHome();
    await arriveAt("bookcase");

    await pressMenu(RECORDS_MENU);
    const right = navigatedTo();
    const seen = new Set<string>();
    await frames(2, () => {
      const clip = newClip();
      if (clip) seen.add(clip);
    });

    expect({ right, newClips: [...seen], later: navigatedTo(), sheets: openSheets() }).toEqual({
      right: ["/records"],
      newClips: [],
      later: ["/records"],
      sheets: []
    });
  });

  const DEV_PLACES: [MarkId][] = [["board"], ["desk"], ["window"], ["bookcase"]];

  it.each(DEV_PLACES)("P3 %s: 개발 화면(/dev/lobby-3d)에서 '들어가기'를 누르면 2.5초 안에 그 장소의 들어갈 때 안내가 짧은 안내로 뜨고 다른 화면으로 가지 않는다", async (mark) => {
    devGlobal.__DEV__ = true;
    await render(<DevLobby3dRoute />);
    await flushAsync();
    await arriveAt(mark);

    await pressEnter(mark);
    const shown = new Set<string>(alertTexts());
    await frames(2.5, () => alertTexts().forEach((text) => shown.add(text)));

    expect({ shown: [...shown], navigated: navigatedTo() }).toEqual({ shown: [MARKS[mark].enterMessage], navigated: [] });
  });
});
