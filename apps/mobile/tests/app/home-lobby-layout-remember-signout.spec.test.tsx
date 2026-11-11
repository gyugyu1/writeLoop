// [spec] qa 테스트(작업 077, 기능 변경, 모바일): 로그아웃(회원 탈퇴로 로그아웃되는 것 포함)하면 이 폰에 기억해 둔 로비 배치를 모두 지우는지.
// 기대값은 명세(private 작업 폴더 077-2026-11-11-로비-마지막-배치-폰에-저장/01-main-spec.md)의 "바뀌는 동작"의 "지우기"와
// "그대로여야 할 동작"(카메라 거리 저장)에서만 가져온다. 테스트마다 이름 앞에 [바뀔]·[그대로]를 붙였다(02-qa-tests.md의 분류와 같다).
//
// 로그아웃은 사용자가 하는 그대로 내정보 화면의 '로그아웃' 버튼과 '계정 삭제 시작' → '계정 영구 삭제'로 한다. 로그인 상태는 진짜(SessionProvider)를 쓰고,
// 서버(API)만 가짜로 둔다. 어디서 지우는지(로그인 상태, 내정보 화면 등)는 명세가 정하지 않아 보지 않는다.
// 앱을 껐다 켜는 것과 "3D 방을 짓는다"를 보는 방법, 기기 저장소 메모리 가짜는 home-lobby-layout-remember.spec.test.tsx와 같다.
// "기억해 둔 값이 기기 저장소에 있다/없다"는 기기 저장소(AsyncStorage, expo-secure-store)의 JSON 값 안에 그 배치의 가구 목록이 있는지로 본다.
// 구현 코드는 부르는 방법(홈·내정보 화면, 로그인 상태, 엔진의 배치, API 함수 이름)을 알려고만 읽었다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import HomeScreen from "@/app/index";
import MeScreen from "@/app/me";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import {
  deleteAccount,
  getCurrentUser,
  getDiaryCalendarSummary,
  getFeaturedDailyPrompt,
  getLobbyLayout,
  getMobileHomeSnapshot,
  getMonthWritingStatus,
  getTodayWritingStatus,
  getWritingDraft,
  logout,
  saveLobbyLayout,
  trackDailyPromptClick
} from "@/lib/api";
import { useAppOverlayStatus } from "@/lib/app-overlay-status";
import { completeHomeTutorial, consumeHomeTutorialReplay, hasCompletedHomeTutorial } from "@/lib/home-tutorial";
import { clearIncompleteLoop, getIncompleteLoop } from "@/lib/incomplete-loop";
import { activeLobbyLayout, applyLobbyLayout } from "@/lib/lobby3d/engine";
import { currentFurnitureLayout, furniturePlacements } from "@/lib/lobby3d/furniture-layout";
import { DEFAULT_LOBBY_LAYOUT, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { LOBBY3D_VIEW_WIDTH_KEY } from "@/lib/lobby3d/view-storage";
import { getNowInEnglishSummary, type NowInEnglishSummary } from "@/lib/now-in-english";
import { hydratePracticeFeedbackState } from "@/lib/practice-feedback-state";
import { SessionProvider, useSession } from "@/lib/session";
import type { AuthUser, MobileHomeSnapshot } from "@/lib/types";
import { getLocalWritingDraft } from "@/lib/writing-drafts";

// ---------- 기기 저장소 가짜(메모리, home-lobby-layout-remember.spec.test.tsx와 같다) ----------

const mockStore = {
  async: new Map<string, string>(),
  secure: new Map<string, string>()
};

jest.mock("@react-native-async-storage/async-storage", () => {
  const api = {
    getItem: jest.fn(async (key: string) => mockStore.async.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore.async.set(key, String(value));
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStore.async.delete(key);
    }),
    mergeItem: jest.fn(async (key: string, value: string) => {
      const before = mockStore.async.get(key);
      mockStore.async.set(key, JSON.stringify({ ...(before ? JSON.parse(before) : {}), ...JSON.parse(value) }));
    }),
    clear: jest.fn(async () => {
      mockStore.async.clear();
    }),
    getAllKeys: jest.fn(async () => [...mockStore.async.keys()]),
    multiGet: jest.fn(async (keys: readonly string[]) => keys.map((key) => [key, mockStore.async.get(key) ?? null])),
    multiSet: jest.fn(async (pairs: readonly (readonly [string, string])[]) => {
      pairs.forEach(([key, value]) => mockStore.async.set(key, String(value)));
    }),
    multiRemove: jest.fn(async (keys: readonly string[]) => {
      keys.forEach((key) => mockStore.async.delete(key));
    }),
    multiMerge: jest.fn(async () => undefined),
    flushGetRequests: jest.fn()
  };
  return { __esModule: true, default: api, ...api };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.secure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.secure.set(key, String(value));
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.secure.delete(key);
  })
}));

// ---------- 그 밖의 가짜 ----------

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
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
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
  deleteAccount: jest.fn(),
  getCurrentUser: jest.fn(),
  getDiaryCalendarSummary: jest.fn(),
  getFeaturedDailyPrompt: jest.fn(),
  getLobbyLayout: jest.fn(),
  getMobileHomeSnapshot: jest.fn(),
  getMonthWritingStatus: jest.fn(),
  getTodayWritingStatus: jest.fn(),
  getWritingDraft: jest.fn(),
  login: jest.fn(),
  loginWithApple: jest.fn(),
  loginWithSocial: jest.fn(),
  logout: jest.fn(),
  saveLobbyLayout: jest.fn(),
  trackDailyPromptClick: jest.fn(),
  updateProfile: jest.fn()
}));
jest.mock("@/lib/app-overlay-status", () => ({ useAppOverlayStatus: jest.fn() }));
jest.mock("@/lib/home-tutorial", () => ({
  completeHomeTutorial: jest.fn(),
  consumeHomeTutorialReplay: jest.fn(),
  hasCompletedHomeTutorial: jest.fn(),
  requestHomeTutorialReplay: jest.fn()
}));
jest.mock("@/lib/incomplete-loop", () => ({ clearIncompleteLoop: jest.fn(), getIncompleteLoop: jest.fn() }));
jest.mock("@/lib/now-in-english", () => ({
  NOW_IN_ENGLISH_NOTIFICATION_BODY: "지금 뭐하고 있나요?, 무슨 생각하고 있나요?",
  getNowInEnglishSummary: jest.fn()
}));
jest.mock("@/lib/practice-feedback-state", () => ({ hydratePracticeFeedbackState: jest.fn(), clearPracticeFeedbackState: jest.fn() }));
jest.mock("@/lib/writing-drafts", () => ({ getLocalWritingDraft: jest.fn() }));

// ---------- 배치(home-lobby-layout-load.spec.test.tsx의 값과 같다) ----------

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

const P0_FLOOR: Record<string, FloorSpot> = {
  desk: { x: 1.5, z: 5.5, facing: 0 },
  bookcase: { x: 0.5, z: 2.5, facing: 1 },
  wardrobe: { x: 7.5, z: 3.5, facing: 3 },
  rug: { x: 4.6, z: 7.2, facing: 0 }
};
const P0_WALL: Record<string, WallSpot> = { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } };
/** 처음 배치. */
const P0: LobbyLayout = { items: [...v2(P0_FLOOR, P0_WALL).items, { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } } as LayoutItem] };
/** 꾸민 계정의 배치 1. */
const L1: LobbyLayout = v2(
  {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 4.5, facing: 1 },
    wardrobe: { x: 7.5, z: 6.5, facing: 3 },
    rug: { x: 3.0, z: 8.0, facing: 1 }
  },
  { board: { wall: "back", along: 2.0 }, window: { wall: "back", along: 5.6 } }
);
/** 배치 3(게시판 오른벽, 창문 왼벽). */
const L3: LobbyLayout = v2(P0_FLOOR, { board: { wall: "right", along: 6.0 }, window: { wall: "left", along: 8.0 } });

function copy(layout: LobbyLayout): LobbyLayout {
  return JSON.parse(JSON.stringify(layout));
}

function sortedItems(layout: { items: readonly { id: string }[] } | null | undefined) {
  return [...(layout?.items ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function canonical(value: unknown): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
    }
    return v;
  };
  return JSON.stringify(sortKeys(value === undefined ? null : value));
}

// ---------- 고정 데이터 ----------

const NOW = new Date("2026-11-12T03:00:00.000Z");
const TODAY_KEY = "2026-11-12";
const userA: AuthUser = { id: 7, email: "a@example.com", displayName: "가", socialProvider: null, admin: false };
const userB: AuthUser = { id: 8, email: "b@example.com", displayName: "나", socialProvider: null, admin: false };

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

/** 서버가 지금 로그인했다고 알려 주는 계정(getCurrentUser). */
let serverUser: AuthUser | null = userA;
/** 서버가 돌려줄 가구 배치. undefined면 끝나지 않는다(서버 배치가 아직 오지 않은 동안). */
let serverLayout: LobbyLayout | null | undefined = null;

const sessionProbe: { session: ReturnType<typeof useSession> | null } = { session: null };
function SessionProbe() {
  sessionProbe.session = useSession();
  return null;
}

async function flushAsync() {
  for (let index = 0; index < 16; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

let view: Awaited<ReturnType<typeof render>> | null = null;

/** 앱을 켜서 그 화면을 연다(진짜 로그인 상태가 기기에 남은 계정을 읽고 서버에 다시 묻는다). */
async function openApp(screenElement: React.ReactElement) {
  mockCanvas.props = null;
  view = await render(
    <SessionProvider>
      <SessionProbe />
      {screenElement}
    </SessionProvider>
  );
  await flushAsync();
}

/** 앱을 끈다: 화면을 내리고 엔진의 배치를 처음 배치로 되돌린다. 기기 저장소는 남는다. */
async function closeApp() {
  if (view) {
    const current = view;
    await act(async () => {
      current.unmount();
    });
    view = null;
  }
  await flushAsync();
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
  mockCanvas.props = null;
  sessionProbe.session = null;
}

function expectBuiltWith(layout: LobbyLayout) {
  expect(mockCanvas.props).not.toBeNull();
  expect(sortedItems(activeLobbyLayout())).toEqual(sortedItems(layout));
  expect(currentFurnitureLayout()).toEqual(furniturePlacements(layout));
}

/** 기기 저장소(두 곳)의 JSON 값 가운데 그 배치의 가구 목록이 든 값의 수. */
function storedCountWith(layout: LobbyLayout): number {
  const want = canonical(sortedItems(layout));
  let count = 0;
  const visit = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(visit);
    if (!node || typeof node !== "object") return false;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.items) && canonical(sortedItems(record as { items: { id: string }[] })) === want) return true;
    return Object.values(record).some(visit);
  };
  for (const raw of [...mockStore.async.values(), ...mockStore.secure.values()]) {
    try {
      if (visit(JSON.parse(raw))) count += 1;
    } catch {
      // JSON이 아닌 값은 배치가 아니다
    }
  }
  return count;
}

/** 그 계정으로 홈을 열어 서버에서 그 배치를 받고 앱을 끈다. */
async function receiveFromServerThenClose(user: AuthUser, layout: LobbyLayout) {
  serverUser = user;
  serverLayout = layout;
  await openApp(<HomeScreen />);
  expectBuiltWith(layout);
  await closeApp();
}

/** 서버 배치가 오지 않는 동안 그 계정으로 홈을 열었을 때 지은 배치를 본다. */
async function expectReopenBuiltWith(user: AuthUser, layout: LobbyLayout) {
  serverUser = user;
  serverLayout = undefined;
  await openApp(<HomeScreen />);
  expectBuiltWith(layout);
  await closeApp();
}

/** 내정보 화면에서 '로그아웃'을 누른다. */
async function signOutFromMe() {
  await openApp(<MeScreen />);
  await fireEvent.press(screen.getByText("로그아웃"));
  await flushAsync();
  serverUser = null;
  expect(logout).toHaveBeenCalledTimes(1);
  await closeApp();
}

/** 내정보 화면에서 회원 탈퇴한다(비밀번호 계정). */
async function deleteAccountFromMe() {
  await openApp(<MeScreen />);
  await fireEvent.press(screen.getByText("계정 삭제 시작"));
  await flushAsync();
  await fireEvent.changeText(screen.getByPlaceholderText("확인 문구로 '탈퇴'를 입력해 주세요."), "탈퇴");
  const passwordInputs = screen.getAllByPlaceholderText("현재 비밀번호를 입력해 주세요.");
  await fireEvent.changeText(passwordInputs[passwordInputs.length - 1], "pw-1234");
  await fireEvent.press(screen.getByText("계정 영구 삭제"));
  await flushAsync();
  serverUser = null;
  expect(deleteAccount).toHaveBeenCalledTimes(1);
  await closeApp();
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockStore.async.clear();
  mockStore.secure.clear();
  mockFocus.focused = true;
  mockCanvas.props = null;
  sessionProbe.session = null;
  view = null;
  serverUser = userA;
  serverLayout = null;
  jest.mocked(getCurrentUser).mockReset().mockImplementation(async () => serverUser);
  jest.mocked(logout).mockReset().mockResolvedValue(undefined);
  jest.mocked(deleteAccount).mockReset().mockResolvedValue(undefined as never);
  jest.mocked(getLobbyLayout).mockReset().mockImplementation(() =>
    serverLayout === undefined ? new Promise<LobbyLayout | null>(() => undefined) : Promise.resolve(serverLayout === null ? null : copy(serverLayout))
  );
  jest.mocked(saveLobbyLayout).mockReset().mockImplementation(async (layout: LobbyLayout) => copy(layout));
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
  jest.mocked(useAppOverlayStatus).mockReturnValue({ appUpdateNoticePhase: "settled", setAppUpdateNoticePhase: jest.fn() });
});

afterEach(async () => {
  await closeApp();
  jest.useRealTimers();
});

describe("로그아웃하면 기억해 둔 로비 배치를 지운다(명세 '지우기')", () => {
  test("[spec] D1 [바뀔] 내정보에서 '로그아웃'하면 기억해 둔 배치를 지운다: 같은 계정으로 다시 로그인해 열면 처음 배치로 짓는다", async () => {
    await receiveFromServerThenClose(userA, L1);
    // 로그아웃 전에는 기억해 둔 배치로 짓는다
    await expectReopenBuiltWith(userA, L1);
    expect(storedCountWith(L1)).toBeGreaterThan(0);

    await signOutFromMe();

    expect(storedCountWith(L1)).toBe(0);
    await expectReopenBuiltWith(userA, P0);
  });

  test("[spec] D2 [바뀔] 회원 탈퇴로 로그아웃되어도 기억해 둔 배치를 지운다", async () => {
    await receiveFromServerThenClose(userA, L1);
    await expectReopenBuiltWith(userA, L1);
    expect(storedCountWith(L1)).toBeGreaterThan(0);

    await deleteAccountFromMe();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(storedCountWith(L1)).toBe(0);
    await expectReopenBuiltWith(userA, P0);
  });

  test("[spec] D3 [바뀔] 이 폰에 두 계정 몫이 기억돼 있으면 로그아웃할 때 모두 지운다", async () => {
    // A로 L1을 받은 뒤, 홈이 열린 채 B로 바뀌어(로그아웃 없이 계정이 바뀜) B의 L3을 받는다
    serverUser = userA;
    serverLayout = L1;
    await openApp(<HomeScreen />);
    expectBuiltWith(L1);
    serverUser = userB;
    serverLayout = L3;
    await act(async () => {
      sessionProbe.session!.setSessionUser(userB);
    });
    await flushAsync();
    expectBuiltWith(L3);
    await closeApp();
    expect(storedCountWith(L1)).toBeGreaterThan(0);
    expect(storedCountWith(L3)).toBeGreaterThan(0);

    await signOutFromMe();

    expect(storedCountWith(L1)).toBe(0);
    expect(storedCountWith(L3)).toBe(0);
    await expectReopenBuiltWith(userB, P0);
    await expectReopenBuiltWith(userA, P0);
  });
});

describe("로그아웃해도 그대로(명세 '그대로여야 할 동작': 카메라 거리 저장)", () => {
  test("[spec] D4 [그대로] 로그아웃해도 이 폰에 저장한 카메라 거리는 지우지 않는다", async () => {
    mockStore.async.set(LOBBY3D_VIEW_WIDTH_KEY, "7");
    await receiveFromServerThenClose(userA, L1);

    await signOutFromMe();

    expect(mockStore.async.get(LOBBY3D_VIEW_WIDTH_KEY)).toBe("7");
  });
});

// ---------- 03 결정(private 작업 폴더 077의 03-main-decision.md)의 4 ----------
// 서버 로그아웃 요청이 실패해도 폰에서 로그아웃되면 기억해 둔 배치를 모두 지운다.
// 서버 로그아웃 요청은 진짜 logout(api.ts)을 그대로 부르고 그 안의 fetch를 실패시킨다(진짜 logout은 실패를 삼키고 폰의 로그인 정보를 지운다).
// 진짜 logout이 서버에 요청을 보내도록 기기 저장소에 로그인 토큰을 넣어 둔다(키 이름은 api.ts의 ACCESS_TOKEN_KEY·REFRESH_TOKEN_KEY를 읽어 맞췄다).

describe("03 결정 4", () => {
  test("[spec] D5 [바뀔] (결정 4) 서버 로그아웃 요청이 실패해도 폰에서 로그아웃되면 기억해 둔 배치를 지운다", async () => {
    await receiveFromServerThenClose(userA, L1);
    await expectReopenBuiltWith(userA, L1);
    expect(storedCountWith(L1)).toBeGreaterThan(0);

    const actualApi = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
    mockStore.secure.set("writeloop_access_token", "access-qa-077");
    mockStore.secure.set("writeloop_refresh_token", "refresh-qa-077");
    const fetchMock = jest.fn(async () => {
      throw new TypeError("Network request failed");
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    jest.mocked(logout).mockReset().mockImplementation(() => actualApi.logout());

    try {
      await openApp(<MeScreen />);
      expect(sessionProbe.session?.currentUser?.id).toBe(userA.id);
      await fireEvent.press(screen.getByText("로그아웃"));
      await flushAsync();
      serverUser = null;
      expect(logout).toHaveBeenCalledTimes(1);
      // 서버 로그아웃 요청을 보냈고 실패했다
      expect(fetchMock.mock.calls.map((call) => String((call as unknown[])[0]))).toEqual([expect.stringContaining("/api/auth/token/logout")]);
      // 폰에서는 로그아웃됐다
      expect(sessionProbe.session?.currentUser).toBeNull();
      await closeApp();
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(storedCountWith(L1)).toBe(0);
    await expectReopenBuiltWith(userA, P0);
  });
});
