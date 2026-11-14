// [spec] qa 테스트(작업 092 홈쇼핑은 방에서만, 기능 변경, 모바일): 로비 화면(Lobby3dScreen) 단위.
// 기대값은 private 작업 폴더 092-2026-11-14-홈쇼핑-방에서만/01-main-spec.md(바뀌는 동작·그대로여야 할 동작)에서만 가져온다.
// - 바뀌는 동작: '홈쇼핑' 버튼과 "N룹" 잔액 칩은 방(집 안)에서만 보인다. 마을에서는 둘 다 없다. '꾸미기'와 같은 규칙이고 방으로 돌아오면 다시 보인다.
// - 그대로여야 할 동작: 방의 '홈쇼핑' 버튼·"N룹" 칩(누르면 홈쇼핑을 연다), 마을의 연속 기록 칩·카메라 거리 설정, '꾸미기'가 방에서만 보이는 것.
// 홈 화면 단위(가짜 API로 잔액 120)는 tests/app/home-lobby-travel.spec.test.tsx의 H1이 본다.
//
// 지금 코드(5dbd9aa)에서 읽은 것은 부르는 방법뿐이다: 위 줄은 onSaveLayout과 onOpenShop이 있어야 '꾸미기'·'홈쇼핑'이 보이고,
// 칩은 shopBalance가 숫자일 때 글 "N룹", 접근 이름 "N룹, 홈쇼핑 열기"인 버튼이다. 방↔마을은 '밖으로'의 '나가기', 라룹이 집의 '들어가기'로 오간다.
// 3D 그리기 가짜와 프레임 넣기는 tests/components/lobby3d-travel-screen.spec.test.tsx와 같다(처음 그려진 뒤 onRoomShown, 마을로 바뀌면 onVillageReady).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen, { type Lobby3dScreenProps } from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyArea, isFree, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import type { LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { VILLAGE, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START } from "@/lib/lobby3d/village";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Redirect: (props: object) => React.createElement("Redirect", props)
  };
});
jest.mock("@/components/lobby3d/lobby3d-canvas", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  function MockLobby3dCanvas(props: Lobby3dCanvasProps) {
    mockCanvas.props = props;
    const onRoomShown = props.onRoomShown;
    const sent = React.useRef(false);
    React.useEffect(() => {
      if (sent.current || !onRoomShown) return;
      sent.current = true;
      onRoomShown();
    }, [onRoomShown]);
    const area = props.area ?? "room";
    React.useEffect(() => {
      if (area === "village") mockCanvas.props?.onVillageReady?.();
    }, [area]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 시험이 정한 값 ----------

const NOW = new Date(2026, 10, 14, 12, 0);
const STREAK = "연속 5일";
/** 시험이 정한 잔액. */
const BALANCE = 120;
/** 마을에 있는 동안 바뀐 잔액(시험이 정한 값). */
const NEXT_BALANCE = 150;
const ALL = { includeHiddenElements: true } as const;

// ---------- 도우미 ----------

async function flushAsync() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function canvas(): Lobby3dCanvasProps {
  expect(mockCanvas.props).not.toBeNull();
  return mockCanvas.props!;
}

function sim() {
  return canvas().sim;
}

function area() {
  return canvas().area ?? "room";
}

function pos(): FloorPoint {
  return { x: sim().x, z: sim().z };
}

function dist(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

async function frames(seconds: number) {
  const count = Math.round(seconds / 0.05);
  await act(async () => {
    for (let i = 0; i < count; i += 1) {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    }
  });
}

async function step() {
  await act(async () => {
    jest.advanceTimersByTime(50);
    canvas().onFrame(0.05, Date.now());
  });
}

async function steps(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let i = 0; i < count; i += 1) await step();
}

async function tap(point: FloorPoint | null, mark: PointerHit["mark"] = null) {
  const hit: PointerHit = { point, mark, onCharacter: false };
  await act(async () => {
    canvas().onPointer("down", hit, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
}

async function walkTo(point: FloorPoint, mark: PointerHit["mark"] = null, seconds = 40) {
  await tap(point, mark);
  await frames(seconds);
  expect(dist(pos(), point)).toBeLessThanOrEqual(0.06);
}

function villageFreeNear(target: FloorPoint): FloorPoint {
  let best: FloorPoint | null = null;
  for (let c = 0; c < VILLAGE.width; c += 1) {
    for (let r = 0; r < VILLAGE.depth; r += 1) {
      const p = { x: c + 0.5, z: r + 0.5 };
      if (isFree(p.x, p.z, VILLAGE_SOLID_TILES, VILLAGE) && (!best || dist(p, target) < dist(best, target))) best = p;
    }
  }
  expect(best).not.toBeNull();
  return best!;
}

function farVillageFloor(): FloorPoint {
  const p = villageFreeNear({ x: VILLAGE_START.x + 4, z: VILLAGE_START.z + 3 });
  expect(dist(p, VILLAGE_START)).toBeGreaterThan(3);
  return p;
}

/** '나가기'를 눌러 마을로 나가고 밝아짐이 끝날 때까지 기다린다. */
async function goOut() {
  await walkTo(MARKS.door.approach[0], "door", 10);
  expect(sim().snapshot(Date.now()).bubbleButton).toBe("나가기");
  await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
  await steps(1.2);
  expect(area()).toBe("village");
}

/** 마을에서 라룹이 집에 도착해 '들어가기'를 누르고 밝아짐이 끝날 때까지 기다린다. */
async function goHome() {
  await walkTo(farVillageFloor());
  await walkTo(VILLAGE_PLACES.home.approach[0], "home");
  await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
  await steps(1.2);
  expect(area()).toBe("room");
}

const onOpenShop = jest.fn();
const onSaveLayout = jest.fn(async (layout: LobbyLayout) => layout);

function lobby(extra: Partial<Lobby3dScreenProps> = {}) {
  return (
    <Lobby3dScreen
      devPanel={false}
      streakLabel={STREAK}
      onSaveLayout={onSaveLayout}
      onOpenShop={onOpenShop}
      shopBalance={BALANCE}
      {...extra}
    />
  );
}

async function renderLobby(extra: Partial<Lobby3dScreenProps> = {}) {
  const view = await render(lobby(extra));
  await flushAsync();
  return view;
}

/** 위 줄의 '홈쇼핑' 버튼과 balance룹 칩이 몇 개 있는지(숨긴 것까지 센다). */
function shopCounts(balance: number) {
  return {
    shopButton: screen.queryAllByRole("button", { name: "홈쇼핑", ...ALL }).length,
    shopText: screen.queryAllByText("홈쇼핑", ALL).length,
    chipText: screen.queryAllByText(`${balance}룹`, ALL).length,
    chipLabel: screen.queryAllByLabelText(`${balance}룹, 홈쇼핑 열기`, ALL).length
  };
}

const SHOWN = { shopButton: 1, shopText: 1, chipText: 1, chipLabel: 1 };
const HIDDEN = { shopButton: 0, shopText: 0, chipText: 0, chipLabel: 0 };

function useJsAnimation() {
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  onOpenShop.mockReset();
  onSaveLayout.mockClear();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
});

afterEach(() => {
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- 바뀌는 동작 ----------

describe("[spec] 092 홈쇼핑·룹 칩은 방에서만(바뀌는 동작)", () => {
  it("B1: 방에서는 '홈쇼핑'과 '120룹' 칩이 있고, '나가기'로 마을에 나가면 둘 다 없다('꾸미기'도 없다)", async () => {
    await renderLobby();
    expect(area()).toBe("room");
    expect(shopCounts(BALANCE)).toEqual(SHOWN);
    expect(screen.queryAllByText("꾸미기")).toHaveLength(1);

    await goOut();
    expect(shopCounts(BALANCE)).toEqual(HIDDEN);
    expect(screen.queryAllByText("꾸미기", ALL)).toHaveLength(0);
  });

  it("B2: 마을에서 몇 초 지나도 '홈쇼핑'과 칩은 계속 없다", async () => {
    await renderLobby();
    await goOut();
    await frames(3);
    expect(area()).toBe("village");
    expect(shopCounts(BALANCE)).toEqual(HIDDEN);
  });

  it("B3: 마을에 있는 동안 잔액이 150으로 바뀌어도 칩은 없고, '들어가기'로 방에 돌아오면 '홈쇼핑'과 '150룹' 칩이 다시 있다", async () => {
    const view = await renderLobby();
    await goOut();
    await view.rerender(lobby({ shopBalance: NEXT_BALANCE }));
    await flushAsync();
    expect(area()).toBe("village");
    expect(shopCounts(NEXT_BALANCE)).toEqual(HIDDEN);
    expect(shopCounts(BALANCE)).toEqual(HIDDEN);

    await goHome();
    expect(shopCounts(NEXT_BALANCE)).toEqual(SHOWN);
    expect(screen.queryAllByText("꾸미기")).toHaveLength(1);
  });

  it("B4: 동작 줄이기면 '나가기'를 누르는 즉시 마을이고 '홈쇼핑'과 칩이 없으며, '들어가기'로 돌아오면 바로 다시 있다", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderLobby();
    await walkTo(MARKS.door.approach[0], "door", 10);
    await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
    await flushAsync();
    expect(area()).toBe("village");
    expect(shopCounts(BALANCE)).toEqual(HIDDEN);

    await walkTo(farVillageFloor());
    await walkTo(VILLAGE_PLACES.home.approach[0], "home");
    await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
    await flushAsync();
    expect(area()).toBe("room");
    expect(shopCounts(BALANCE)).toEqual(SHOWN);
  });
});

// ---------- 그대로여야 할 동작 ----------

describe("[spec] 092 그대로여야 할 동작", () => {
  it("K1: 방에서 '홈쇼핑'을 누르면 홈쇼핑 열기가 1번, '120룹' 칩을 누르면 또 1번 불린다", async () => {
    await renderLobby();
    await fireEvent.press(screen.getByRole("button", { name: "홈쇼핑" }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText(`${BALANCE}룹, 홈쇼핑 열기`));
    expect(onOpenShop).toHaveBeenCalledTimes(2);
  });

  it("K2: 마을에 다녀온 뒤 방에서도 '홈쇼핑'과 칩을 누르면 홈쇼핑 열기가 1번씩 불리고, 마을에 있는 동안에는 불리지 않았다", async () => {
    await renderLobby();
    await goOut();
    await goHome();
    expect(onOpenShop).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "홈쇼핑" }));
    expect(onOpenShop).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText(`${BALANCE}룹, 홈쇼핑 열기`));
    expect(onOpenShop).toHaveBeenCalledTimes(2);
  });

  it("K3: 마을에서도 연속 기록 칩('연속 5일')과 '카메라 거리 설정' 버튼은 있다", async () => {
    await renderLobby();
    await goOut();
    expect(screen.getByText(STREAK)).toBeTruthy();
    expect(screen.getByRole("button", { name: "카메라 거리 설정" })).toBeTruthy();
  });

  it("K4: 방에서 잔액을 아직 모르면(null) '홈쇼핑'만 있고 칩은 없다", async () => {
    await renderLobby({ shopBalance: null });
    expect(screen.queryAllByRole("button", { name: "홈쇼핑" })).toHaveLength(1);
    expect(screen.queryAllByText(/룹$/, ALL)).toHaveLength(0);
  });
});
