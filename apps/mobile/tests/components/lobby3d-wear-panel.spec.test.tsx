// [spec] qa 테스트(작업 089 ① 착용 기술 시험, 새 기능, 모바일): 개발 화면 시험판의 '착용 시험' 줄(D1~D8)과 홈(H1).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/02-착용-기술-시험/03-qa-scenarios.md D1~D6, H1)와
// 04-main-decision.md(1: 입은 채 방↔마을을 오가도(전환·시험판 '방'·'마을') 입은 것은 그대로다 → D7,
// 6: 시험판을 접었다 펴도 입은 것은 그대로다 → D8)에서만 가져온다.
// 구현 커밋 fbaec64에서 읽은 것은 부르는 방법뿐이다: 3D 그리기가 받는 착용 속성 wear(부위 hat·top·bottom·shoes마다 참·거짓),
// 시험판 버튼의 글과 accessibilityState.selected.
// "착용 목록"은 3D 그리기에 넘긴 wear에서 참인 부위들이다. wear를 넘기지 않으면 빈 목록으로 본다.
// 3D 그리기는 Jest에서 돌지 않으므로 가짜로 바꾼다. 가짜는 처음 그려진 뒤 '방이 보였다'(onRoomShown)를 한 번 부르고,
// 구역이 마을로 바뀌면 마을 모델이 장면에 들어왔다(onVillageReady)고 부른다. 방↔마을 전환의 도우미는 088 ② 테스트와 같은 방법이다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyArea, isFree, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
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

// ---------- 시나리오의 값 ----------

const NOW = new Date(2026, 5, 21, 12, 30);
const ROW_LABEL = "착용 시험";
/** 버튼 이름과 3D 그리기의 부위. */
const BUTTONS = [
  { name: "모자", slot: "hat" },
  { name: "상의", slot: "top" },
  { name: "하의", slot: "bottom" },
  { name: "신발", slot: "shoes" }
] as const;
type ButtonName = (typeof BUTTONS)[number]["name"];
const ALL_NAMES: ButtonName[] = BUTTONS.map((b) => b.name);

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

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

function area() {
  return canvas().area ?? "room";
}

/** 3D 그리기에 넘어간 착용 목록(입은 부위의 버튼 이름, 버튼 순서). */
function worn(): ButtonName[] {
  const wear = (canvas() as { wear?: Partial<Record<string, boolean>> }).wear;
  return BUTTONS.filter((b) => wear?.[b.slot] === true).map((b) => b.name);
}

function wearButton(name: ButtonName) {
  return screen.getByRole("button", { name });
}

/** 켜진(selected) 착용 버튼 이름들(버튼 순서). */
function selected(): ButtonName[] {
  return ALL_NAMES.filter((name) => wearButton(name).props.accessibilityState?.selected === true);
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
  await flushAsync();
}

async function renderDevWithPanel() {
  devGlobal.__DEV__ = true;
  await render(<DevLobby3dRoute />);
  await flushAsync();
  await press("시험판 펴기");
}

function sim() {
  return canvas().sim;
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

async function steps(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
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
  expect(dist({ x: sim().x, z: sim().z }, point)).toBeLessThanOrEqual(0.06);
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

/** 방의 '밖으로'에 걸어가 '나가기'를 눌러 마을로 나간다(전환). */
async function goOutByTravel() {
  await walkTo(MARKS.door.approach[0], "door", 10);
  await fireEvent.press(screen.getByRole("button", { name: "나가기" }));
  await steps(1.2);
  expect(area()).toBe("village");
}

/** 마을의 라룹이 집에 걸어가 '들어가기'를 눌러 방으로 들어온다(전환). */
async function comeInByTravel() {
  await walkTo(villageFreeNear({ x: VILLAGE_START.x + 4, z: VILLAGE_START.z + 3 }));
  await walkTo(VILLAGE_PLACES.home.approach[0], "home");
  await fireEvent.press(screen.getByRole("button", { name: "들어가기" }));
  await steps(1.2);
  expect(area()).toBe("room");
}

/** Jest에서 네이티브 애니메이션이 바로 끝나지 않게 자바스크립트 쪽에서 돌린다(088 ② 테스트와 같은 시험 환경 맞춤). */
function useJsAnimation() {
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  useJsAnimation();
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// ---------- D. 개발 화면 ----------

describe("[spec] 개발 화면 시험판의 '착용 시험' 줄(D1~D8)", () => {
  it("D1: 시험판을 펴면 글 '착용 시험'과 버튼 '모자'·'상의'·'하의'·'신발'이 하나씩 있다", async () => {
    await renderDevWithPanel();
    expect(screen.getAllByText(ROW_LABEL)).toHaveLength(1);
    for (const name of ALL_NAMES) expect(screen.getAllByRole("button", { name })).toHaveLength(1);
  });

  it("D2: 처음에는 네 버튼 모두 selected가 false이고 착용 목록이 비어 있다", async () => {
    await renderDevWithPanel();
    for (const name of ALL_NAMES) expect(wearButton(name).props.accessibilityState?.selected).toBe(false);
    expect(worn()).toEqual([]);
  });

  it("D3: '모자'를 누르면 모자만 켜지고 착용 목록이 모자 하나다. 다시 누르면 꺼지고 목록이 빈다", async () => {
    await renderDevWithPanel();
    await press("모자");
    expect(selected()).toEqual(["모자"]);
    expect(wearButton("상의").props.accessibilityState?.selected).toBe(false);
    expect(worn()).toEqual(["모자"]);
    await press("모자");
    expect(wearButton("모자").props.accessibilityState?.selected).toBe(false);
    expect(selected()).toEqual([]);
    expect(worn()).toEqual([]);
  });

  it.each(["상의", "하의", "신발"] as const)("D4: '%s'도 D3과 같이 그 버튼만 켜지고 꺼지며 착용 목록에 그것만 들고 빠진다", async (name) => {
    await renderDevWithPanel();
    await press(name);
    expect(selected()).toEqual([name]);
    expect(worn()).toEqual([name]);
    await press(name);
    expect(wearButton(name).props.accessibilityState?.selected).toBe(false);
    expect(selected()).toEqual([]);
    expect(worn()).toEqual([]);
  });

  it("D5: 넷을 모두 누르면 넷이 켜지고 착용 목록이 넷이다. '상의'를 한 번 더 누르면 상의만 꺼지고 목록은 모자·하의·신발이다", async () => {
    await renderDevWithPanel();
    for (const name of ALL_NAMES) await press(name);
    expect(selected()).toEqual(ALL_NAMES);
    expect(worn()).toEqual(ALL_NAMES);
    await press("상의");
    expect(selected()).toEqual(["모자", "하의", "신발"]);
    expect(worn()).toEqual(["모자", "하의", "신발"]);
  });

  it("D6: 시험판 '마을'로 바꾸고 마을이 뜬 뒤에도 '모자'가 D3과 같이 켜지고 꺼진다(3D 그리기의 구역은 마을)", async () => {
    await renderDevWithPanel();
    await press("마을");
    expect(area()).toBe("village");
    await press("모자");
    expect(area()).toBe("village");
    expect(selected()).toEqual(["모자"]);
    expect(worn()).toEqual(["모자"]);
    await press("모자");
    expect(area()).toBe("village");
    expect(selected()).toEqual([]);
    expect(worn()).toEqual([]);
  });

  it("D7(결정 1, 시험판): 방에서 넷을 입고 시험판 '마을'로, 다시 '방'으로 바꿔도 네 버튼이 켜져 있고 착용 목록이 넷 그대로다", async () => {
    await renderDevWithPanel();
    for (const name of ALL_NAMES) await press(name);
    await press("마을");
    expect(area()).toBe("village");
    expect(selected()).toEqual(ALL_NAMES);
    expect(worn()).toEqual(ALL_NAMES);
    await press("방");
    expect(area()).toBe("room");
    expect(selected()).toEqual(ALL_NAMES);
    expect(worn()).toEqual(ALL_NAMES);
  });

  it("D7(결정 1, 전환): 방에서 넷을 입고 '나가기'로 마을에 나갔다가 '들어가기'로 방에 들어와도 착용 목록이 넷 그대로다", async () => {
    await renderDevWithPanel();
    for (const name of ALL_NAMES) await press(name);
    await press("시험판 접기");
    await goOutByTravel();
    expect(worn()).toEqual(ALL_NAMES);
    await comeInByTravel();
    expect(worn()).toEqual(ALL_NAMES);
    await press("시험판 펴기");
    expect(selected()).toEqual(ALL_NAMES);
  });

  it("D8(결정 6): 모자·하의를 입고 시험판을 접었다 펴도 모자·하의만 켜져 있고 착용 목록도 그대로다", async () => {
    await renderDevWithPanel();
    await press("모자");
    await press("하의");
    await press("시험판 접기");
    expect(worn()).toEqual(["모자", "하의"]);
    await press("시험판 펴기");
    expect(selected()).toEqual(["모자", "하의"]);
    expect(worn()).toEqual(["모자", "하의"]);
  });
});

// ---------- H. 홈 ----------

describe("[spec] 홈은 바꾸지 않는다(H1)", () => {
  it("H1: 시험판 없는 로비(홈이 그리는 모양, devPanel=false)에는 '착용 시험'과 착용 버튼이 없고 착용 목록이 비어 있다", async () => {
    await render(<Lobby3dScreen devPanel={false} />);
    await flushAsync();
    expect(screen.queryByText(ROW_LABEL)).toBeNull();
    for (const name of ALL_NAMES) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(worn()).toEqual([]);
  });
});
