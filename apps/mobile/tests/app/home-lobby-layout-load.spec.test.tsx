// [spec] qa 테스트(작업 064-② 계정 저장, 모바일): 홈을 열 때 계정의 가구 배치를 불러와 방에 적용하는지.
// 기대값은 시나리오(private 작업 폴더 064/03-계정-저장/03-qa-scenarios.md)의 S1~S16·S19·S20과 배치 값 P0·L1·L2·L3에서만 가져온다.
// 시나리오가 정하지 못한 API 모양은 결정(같은 폴더 04-main-decision.md의 1: GET /api/lobby-layout, 본문에 맨 위 version 1, 없으면 404)을 따른다.
// 구현 코드는 부르는 방법(불러오기 함수 getLobbyLayout·저장 함수 saveLobbyLayout의 이름, 3D 그리기가 받는 sim)을 알려고만 읽었다.
// 가짜로 두는 것: 기존 홈 테스트(home-lobby.spec.test.tsx)와 같다(API, 기기 저장소, 로그인 상태, 앱 업데이트 안내 상태, 라우터, 포커스, 3D 그리기).
// 불러오기 함수는 가짜(jest.fn)로 두고, 서버 응답 모양을 거쳐야 하는 시나리오(S5, S8)에서는 진짜 함수(api.ts)를 그대로 부르고 전역 fetch를 가짜로 둔다.
// 엔진의 배치는 모듈 전역이라 테스트마다 끝에 처음 배치로 되돌린다(02-배치-데이터 결정 03).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
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
import {
  MARKS,
  SOLID_TILES,
  activeLobbyLayout,
  applyLobbyLayout,
  findPath,
  isFree,
  markZoneAt,
  type FloorPoint,
  type MarkId
} from "@/lib/lobby3d/engine";
import { currentFurnitureLayout, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, layoutGeometry, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
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

/** 진짜 불러오기 함수(api.ts). 서버 응답 모양을 거쳐야 하는 시나리오에서 부른다. */
const actualApi = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");

// ---------- 시나리오의 배치 ----------

type PlaceId = "board" | "window" | "desk" | "bookcase";
type PlaceValues = Record<PlaceId, { approach: FloorPoint[]; faceTo: FloorPoint }>;

const P0: LobbyLayout = {
  floor: {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 2.5, facing: 1 },
    wardrobe: { x: 7.5, z: 3.5, facing: 3 },
    rug: { x: 4.6, z: 7.2, facing: 0 }
  },
  wall: { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } }
};
const P0_SOLID = ["0,2", "0,5", "1,5", "2,5", "7,3"];
const P0_PLACES: PlaceValues = {
  board: { approach: [{ x: 1.6, z: 1.3 }, { x: 2.2, z: 1.3 }], faceTo: { x: 1.8, z: 0 } },
  window: { approach: [{ x: 4.5, z: 1.55 }, { x: 5.1, z: 1.55 }], faceTo: { x: 4.8, z: 0 } },
  desk: { approach: [{ x: 1.5, z: 6.75 }], faceTo: { x: 1.25, z: 5.5 } },
  bookcase: { approach: [{ x: 1.4, z: 2.5 }], faceTo: { x: 0, z: 2.5 } }
};

const L1: LobbyLayout = {
  floor: {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 4.5, facing: 1 },
    wardrobe: { x: 7.5, z: 6.5, facing: 3 },
    rug: { x: 3.0, z: 8.0, facing: 1 }
  },
  wall: { board: { wall: "back", along: 2.0 }, window: { wall: "back", along: 5.6 } }
};
const L1_SOLID = ["0,4", "0,5", "1,5", "2,5", "7,6"];
const L1_PLACES: PlaceValues = {
  board: { approach: [{ x: 1.8, z: 1.3 }, { x: 2.4, z: 1.3 }], faceTo: { x: 2.0, z: 0 } },
  window: { approach: [{ x: 5.3, z: 1.55 }, { x: 5.9, z: 1.55 }], faceTo: { x: 5.6, z: 0 } },
  desk: P0_PLACES.desk,
  bookcase: { approach: [{ x: 1.4, z: 4.5 }], faceTo: { x: 0, z: 4.5 } }
};

const L2: LobbyLayout = { floor: { ...P0.floor, wardrobe: { x: 4.5, z: 6.5, facing: 0 } }, wall: P0.wall };
const L2_SOLID = ["0,2", "0,5", "1,5", "2,5", "4,6"];

const L3: LobbyLayout = { floor: P0.floor, wall: { board: { wall: "right", along: 6.0 }, window: { wall: "left", along: 8.0 } } };
const L3_PLACES: PlaceValues = {
  board: { approach: [{ x: 6.7, z: 5.8 }, { x: 6.7, z: 6.4 }], faceTo: { x: 8, z: 6.0 } },
  window: { approach: [{ x: 1.55, z: 8.3 }, { x: 1.55, z: 7.7 }], faceTo: { x: 0, z: 8.0 } },
  desk: P0_PLACES.desk,
  bookcase: P0_PLACES.bookcase
};

// S8-15: P0에서 게시판을 왼벽 along 10으로
const L4: LobbyLayout = { floor: P0.floor, wall: { board: { wall: "left", along: 10 }, window: P0.wall.window } };
const L4_PLACES: PlaceValues = {
  ...P0_PLACES,
  board: { approach: [{ x: 1.3, z: 10.2 }, { x: 1.3, z: 9.6 }], faceTo: { x: 0, z: 10 } }
};

const ALL_MARKS: MarkId[] = ["board", "window", "desk", "bookcase", "door"];

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";
const userA: AuthUser = { id: 7, email: "a@example.com", displayName: "가", admin: false };
const userB: AuthUser = { id: 8, email: "b@example.com", displayName: "나", admin: false };

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

// ---------- 서버 응답(전역 fetch 가짜) ----------

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

/** 지금 버전(결정 04의 1: version 1)을 붙인 본문. */
function payload(layout: LobbyLayout): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ version: 1, ...layout }));
}

/** 불러오기를 진짜 함수로 돌리고, 서버가 이 응답을 주게 한다. */
function serverRespondsWith(make: (url: string, init?: RequestInit) => Promise<FakeResponse>) {
  fetchMock.mockImplementation(make);
  jest.mocked(getLobbyLayout).mockImplementation(() => actualApi.getLobbyLayout());
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
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushAsync() {
  for (let index = 0; index < 12; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flushAsync();
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

async function tap(hit: { point: FloorPoint | null; mark: MarkId | null }) {
  await act(async () => {
    canvas().onPointer("down", { ...hit, onCharacter: false }, 200, 300);
  });
  await act(async () => {
    canvas().onPointer("up", { ...hit, onCharacter: false }, 200, 300);
  });
}

async function walkUntilArrived(mark: MarkId) {
  for (let index = 0; index < 400 && canvas().sim.arrived !== mark; index += 1) {
    await frames(1);
  }
  expect(canvas().sim.arrived).toBe(mark);
}

function sortedSolid() {
  return [...SOLID_TILES].sort();
}

/** "방에 적용됨": 배치·막힌 칸·장소 넷의 서는 자리·바라볼 지점·3D 가구 자리가 그 배치를 따른다. */
function expectApplied(layout: LobbyLayout, solid: string[], places: PlaceValues) {
  expect(activeLobbyLayout()).toEqual(layout);
  expect(sortedSolid()).toEqual([...solid].sort());
  for (const id of Object.keys(places) as PlaceId[]) {
    expect({ id, approach: MARKS[id].approach, faceTo: MARKS[id].faceTo }).toEqual({ id, ...places[id] });
  }
  expect(MARKS.door.approach).toEqual([{ x: 4.0, z: 10.5 }]);
  expect(currentFurnitureLayout()).toEqual(furniturePlacements(layout));
}

/** "처음 배치로 보임". */
function expectDefaultRoom() {
  expectApplied(P0, P0_SOLID, P0_PLACES);
  expect(activeLobbyLayout()).toEqual(DEFAULT_LOBBY_LAYOUT);
}

function furniture(piece: string) {
  const found = currentFurnitureLayout().find((p) => p.piece === piece);
  expect(found).toBeDefined();
  return found!;
}

function expectPiece(piece: string, at: { x: number; y: number; z: number; rotY: number }) {
  const p = furniture(piece);
  expect({ piece, x: p.x, y: p.y, z: p.z }).toEqual({ piece, x: at.x, y: at.y, z: at.z });
  expect(p.rotY).toBeCloseTo(at.rotY, 9);
}

function expectStandsWithOpenPaths() {
  const at = position();
  expect(isFree(at.x, at.z)).toBe(true);
  for (const id of ALL_MARKS) {
    expect({ id, path: findPath(at, MARKS[id].approach) !== null }).toEqual({ id, path: true });
  }
}

/** 마지막 불러오기가 이미 끝났는지(응답을 받은 뒤의 모습을 보는지) 확인한다. */
async function expectLastLoad(outcome: "failed" | "none") {
  const results = jest.mocked(getLobbyLayout).mock.results;
  expect(results.length).toBeGreaterThan(0);
  const last = results[results.length - 1].value as Promise<unknown>;
  if (outcome === "failed") await expect(last).rejects.toBeInstanceOf(Error);
  else await expect(last).resolves.toBeNull();
}

async function leaveAndReturnHome() {
  await setFocused(false);
  await setFocused(true);
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
  fetchMock.mockReset().mockRejectedValue(new TypeError("fetch는 이 테스트에서 쓰지 않는다"));
  jest.mocked(getLobbyLayout).mockReset().mockResolvedValue(null);
  jest.mocked(saveLobbyLayout).mockReset().mockResolvedValue(P0);
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
  jest.useRealTimers();
});

// ---------- A. 홈을 열 때 불러와 적용 ----------

describe("A. 홈을 열 때 불러와 적용", () => {
  test("[spec] S1 로그인 상태로 홈을 열면 배치 불러오기를 1번 부른다", async () => {
    await renderHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
  });

  test("[spec] S2 L1을 받으면 방에 적용된다(막힌 칸, 장소의 서는 자리·바라볼 지점, 장소 구역, 3D 가구 자리)", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L1);

    await renderHome();

    expectApplied(L1, L1_SOLID, L1_PLACES);
    expect(markZoneAt(1.4, 4.5)).toBe("bookcase");
    expect(markZoneAt(1.4, 2.5)).toBeNull();
    expectPiece("bookcase", { x: 0.44, y: 0, z: 4.5, rotY: Math.PI / 2 });
    expectPiece("wardrobe", { x: 7.56, y: 0, z: 6.5, rotY: -Math.PI / 2 });
    expectPiece("rug", { x: 3.0, y: 0.004, z: 8.0, rotY: Math.PI / 2 });
    expectPiece("board", { x: 2.0, y: 1.75, z: 0.06, rotY: 0 });
    expectPiece("window", { x: 5.6, y: 2.05, z: 0.17, rotY: 0 });
  });

  test("[spec] S3 옆벽 배치 L3을 받으면 방에 적용된다(게시판 오른벽, 창문 왼벽)", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L3);

    await renderHome();

    expectApplied(L3, P0_SOLID, L3_PLACES);
    expectPiece("board", { x: 7.94, y: 1.75, z: 6.0, rotY: -Math.PI / 2 });
    expectPiece("window", { x: 0.17, y: 2.05, z: 8.0, rotY: Math.PI / 2 });
  });

  test("[spec] S4 저장한 배치가 없으면(서버 404) 처음 배치로 보인다", async () => {
    serverRespondsWith(async () => respond(404, { message: "없음" }));

    await renderHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    await expectLastLoad("none");
    expectDefaultRoom();
  });

  test("[spec] S5 (a) 서버 오류 500이면 처음 배치로 보이고, 홈은 그대로 쓸 수 있다", async () => {
    serverRespondsWith(async () => respond(500, { message: "오류" }));

    await renderHome();

    await expectLastLoad("failed");
    expectDefaultRoom();
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();
    await tap({ point: null, mark: "board" });
    await walkUntilArrived("board");
  });

  test("[spec] S5 (b) 네트워크가 실패하면 처음 배치로 보이고, 홈은 그대로 쓸 수 있다", async () => {
    serverRespondsWith(async () => {
      throw new TypeError("Network request failed");
    });

    await renderHome();
    // 진짜 함수는 GET을 두 번 더 시도한다(350ms, 800ms 뒤)
    await advance(400);
    await advance(900);

    await expectLastLoad("failed");
    expectDefaultRoom();
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();
    await tap({ point: null, mark: "board" });
    await walkUntilArrived("board");
  });

  test("[spec] S5 (c) 시간 초과면 처음 배치로 보이고, 홈은 그대로 쓸 수 있다", async () => {
    serverRespondsWith(
      (...args: [string, RequestInit?]) =>
        new Promise<FakeResponse>((_resolve, reject) => {
          args[1]?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
    );

    await renderHome();
    for (let elapsed = 0; elapsed < 30_000; elapsed += 1000) {
      await advance(1000);
    }

    await expectLastLoad("failed");
    expectDefaultRoom();
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();
    await tap({ point: null, mark: "board" });
    await walkUntilArrived("board");
  });

  test("[spec] S6 실패한 뒤 다른 화면에 갔다가 홈으로 돌아오면 다시 불러오고, 이번에 받은 L1이 적용된다", async () => {
    jest.mocked(getLobbyLayout).mockRejectedValueOnce(new Error("가구 배치를 불러오지 못했어요.")).mockResolvedValueOnce(L1);

    await renderHome();
    expectDefaultRoom();

    await leaveAndReturnHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    expectApplied(L1, L1_SOLID, L1_PLACES);
  });

  test("[spec] S7 다시 들어왔는데 또 실패하면 처음 배치로 보인다(불러오기는 모두 2번)", async () => {
    jest.mocked(getLobbyLayout).mockRejectedValue(new Error("가구 배치를 불러오지 못했어요."));

    await renderHome();
    await leaveAndReturnHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    await expectLastLoad("failed");
    expectDefaultRoom();
  });
});

// ---------- B. 모르는 모양 버전, 맞지 않는 모양 ----------

function invalidPayloadCases(): [string, unknown][] {
  const base = () => payload(L1) as { version?: unknown; floor: Record<string, unknown>; wall: Record<string, unknown> };
  const cases: [string, unknown][] = [];
  const add = (label: string, change: (p: ReturnType<typeof base>) => unknown) => {
    const p = base();
    const changed = change(p);
    cases.push([label, changed === undefined ? p : changed]);
  };
  add("S8-1 모양 버전이 V+1(2)", (p) => {
    p.version = 2;
  });
  add("S8-2 모양 버전이 999", (p) => {
    p.version = 999;
  });
  add("S8-3 모양 버전 필드가 없음", (p) => {
    delete p.version;
  });
  add("S8-4 바닥에서 wardrobe가 빠짐", (p) => {
    delete p.floor.wardrobe;
  });
  add("S8-5 벽에서 window가 빠짐", (p) => {
    delete p.wall.window;
  });
  add("S8-6 바닥에 모르는 가구 lamp", (p) => {
    p.floor.lamp = { x: 4.5, z: 4.5, facing: 0 };
  });
  add("S8-7 desk facing 4", (p) => {
    (p.floor.desk as { facing: number }).facing = 4;
  });
  add("S8-8 rug facing -1", (p) => {
    (p.floor.rug as { facing: number }).facing = -1;
  });
  add("S8-9 board wall front", (p) => {
    (p.wall.board as { wall: string }).wall = "front";
  });
  add("S8-10 bookcase x -1(방 밖)", (p) => {
    (p.floor.bookcase as { x: number }).x = -1;
  });
  add("S8-11 wardrobe z 13(깊이 11 밖)", (p) => {
    (p.floor.wardrobe as { z: number }).z = 13;
  });
  add("S8-12 board along 10(뒷벽, 가로 8 밖)", (p) => {
    (p.wall.board as { along: number }).along = 10;
  });
  add("S8-13 window left along 13(옆벽, 깊이 11 밖)", (p) => {
    p.wall.window = { wall: "left", along: 13 };
  });
  add("S8-14 desk 자리가 null", (p) => {
    p.floor.desk = null;
  });
  add("S8-14 board 자리가 문자열", (p) => {
    p.wall.board = "x";
  });
  add("S8-14 본문 전체가 null", () => null);
  return cases;
}

describe("B. 모르는 모양 버전, 맞지 않는 모양", () => {
  test.each(invalidPayloadCases())("[spec] %s → 처음 배치로 보이고 홈은 그대로 보인다", async (_label, body) => {
    serverRespondsWith(async () => respond(200, body));

    await renderHome();

    expect(getLobbyLayout).toHaveBeenCalledTimes(1);
    await expectLastLoad("none");
    expectDefaultRoom();
    expect(screen.getByRole("button", { name: "질문에 답하기" })).toBeTruthy();
  });

  test("[spec] S8-15 옆벽 along 10(뒷벽이면 밖, 옆벽이면 안)은 적용된다", async () => {
    serverRespondsWith(async () => respond(200, payload(L4)));

    await renderHome();

    expectApplied(L4, P0_SOLID, L4_PLACES);
  });

  test("[spec] S2·S3 짝: 서버 본문(지금 버전)으로 받은 L1·L3도 같은 검사를 지나 적용된다", async () => {
    serverRespondsWith(async () => respond(200, payload(L1)));
    await renderHome();
    expectApplied(L1, L1_SOLID, L1_PLACES);

    serverRespondsWith(async () => respond(200, payload(L3)));
    await leaveAndReturnHome();
    expectApplied(L3, P0_SOLID, L3_PLACES);
  });
});

// ---------- C. 계정이 바뀔 때 ----------

describe("C. 계정이 바뀔 때", () => {
  async function switchUserTo(user: AuthUser, view: Awaited<ReturnType<typeof renderHome>>) {
    await setFocused(false);
    setSessionUser(user);
    await view.rerender(<HomeScreen />);
    await flushAsync();
    await setFocused(true);
  }

  test("[spec] S9 A의 L1이 적용된 뒤 B로 바꾸고 B가 '없음'이면 처음 배치로 보인다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(L1).mockResolvedValue(null);
    const view = await renderHome();
    expectApplied(L1, L1_SOLID, L1_PLACES);

    await switchUserTo(userB, view);

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    await expectLastLoad("none");
    expectDefaultRoom();
  });

  test("[spec] S10 A의 L1이 적용된 뒤 B로 바꾸고 B의 불러오기가 실패하면 처음 배치로 보인다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValueOnce(L1).mockRejectedValue(new Error("가구 배치를 불러오지 못했어요."));
    const view = await renderHome();
    expectApplied(L1, L1_SOLID, L1_PLACES);

    await switchUserTo(userB, view);

    expect(getLobbyLayout).toHaveBeenCalledTimes(2);
    await expectLastLoad("failed");
    expectDefaultRoom();
  });

  test("[spec] S11 A의 불러오기가 B로 바뀐 뒤 늦게 L1로 끝나도 B의 홈은 처음 배치다", async () => {
    const late = deferred<LobbyLayout | null>();
    jest.mocked(getLobbyLayout).mockReturnValueOnce(late.promise).mockResolvedValue(null);
    const view = await renderHome();

    await switchUserTo(userB, view);
    expectDefaultRoom();

    await act(async () => {
      late.resolve(L1);
    });
    await flushAsync();

    expectDefaultRoom();
  });
});

// ---------- D. 라이트루프가 서는 자리 ----------

describe("D. 라이트루프가 서는 자리", () => {
  test("[spec] S12 처음 자리를 막는 L2를 받으면, 설 수 있고 다섯 장소로 갈 수 있는 자리에 선다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L2);

    await renderHome();

    expect(sortedSolid()).toEqual([...L2_SOLID].sort());
    expect(isFree(4.2, 6.2)).toBe(false);
    expectStandsWithOpenPaths();
  });

  test("[spec] S13 처음 자리를 막지 않는 L1을 받아도, 설 수 있고 다섯 장소로 갈 수 있는 자리에 선다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L1);

    await renderHome();

    expectStandsWithOpenPaths();
  });

  test("[spec] S14 L2 적용 뒤 빈 바닥 (5.5, 8.5)을 누르면 그곳으로 걸어가고, 게시판을 누르면 게시판에 도착한다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L2);
    await renderHome();

    await tap({ point: { x: 5.5, z: 8.5 }, mark: null });
    for (let index = 0; index < 400; index += 1) {
      const at = position();
      if (Math.abs(at.x - 5.5) < 1e-6 && Math.abs(at.z - 8.5) < 1e-6) break;
      await frames(1);
    }
    expect(position().x).toBeCloseTo(5.5, 6);
    expect(position().z).toBeCloseTo(8.5, 6);

    await tap({ point: null, mark: "board" });
    await walkUntilArrived("board");
  });
});

// ---------- E. 3D 다시 그리기 ----------

describe("E. 3D 다시 그리기", () => {
  test("[spec] S15 L1을 받으면 3D가 읽는 가구 자리와 이름표 자리가 L1 값이다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(L1);

    await renderHome();

    expect(currentFurnitureLayout()).toEqual(furniturePlacements(L1));
    const labels = layoutGeometry(activeLobbyLayout(), 8).places;
    expect(labels.bookcase.label).toEqual({ x: 0.9, y: 2.3, z: 4.5 });
    expect(labels.board.label).toEqual({ x: 2.0, y: 2.75, z: 0.3 });
    expect(labels.window.label).toEqual({ x: 5.6, y: 3.05, z: 0.3 });
  });
});

// ---------- F. 저장 함수는 홈에서 부르지 않는다 ----------

describe("F. 홈에서 저장하지 않는다", () => {
  test.each([
    ["L1을 받음", () => jest.mocked(getLobbyLayout).mockResolvedValue(L1)],
    ["불러오기 실패", () => jest.mocked(getLobbyLayout).mockRejectedValue(new Error("실패"))],
    ["없음", () => jest.mocked(getLobbyLayout).mockResolvedValue(null)]
  ])("[spec] S19 %s: 홈을 열고 장소를 누르고 떠났다 돌아와도 저장 함수를 부르지 않는다", async (_label, arrange) => {
    // 064-③ 결정 03의 6: ③에서 '꾸미기'를 넣어 "'꾸미기' 버튼이 없다" 확인만 뺐다
    arrange();

    await renderHome();
    await tap({ point: null, mark: "board" });
    await walkUntilArrived("board");
    await leaveAndReturnHome();

    expect(saveLobbyLayout).not.toHaveBeenCalled();
  });
});

// ---------- G. 그대로여야 할 것 ----------

describe("G. 그대로", () => {
  test("[spec] S20 저장한 배치가 없으면 처음 배치이고 라이트루프는 처음 자리 (4.2, 6.2)에 선다", async () => {
    jest.mocked(getLobbyLayout).mockResolvedValue(null);

    await renderHome();

    await expectLastLoad("none");
    expectDefaultRoom();
    expect(position()).toEqual({ x: 4.2, z: 6.2 });
  });
});
