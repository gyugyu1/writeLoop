// [spec] qa 테스트(작업 088 ① 마을 장면, 새 기능, 모바일): 개발 화면에서 마을 열기(D1~D8), 마을 화면에서 누르기(B10),
// 카메라 거리를 방과 같이 쓰기(C5), 마을이 폰 시각·달을 따르기(E1).
// 기대값은 시나리오(private 작업 폴더 088-2026-11-13-바깥-마을/02-마을-장면/02-qa-scenarios.md)와
// 결정(04-main-decision.md 3: '꾸미기' 숨김은 '꾸미기'가 보이는 로비 화면(저장 함수를 준 화면)에서 본다)에서만 가져온다.
// 구현 코드는 부르는 방법(개발 화면 경로, Lobby3dScreen의 속성, 3D 그리기에 넘기는 sim·onFrame·onPointer·viewWidth·daylight·area,
// 시험판 '구역' 버튼의 글과 accessibilityState.selected, engine.ts의 applyArea·MARKS·SOLID_TILES·ROOM, village.ts의 데이터)을 알려고만 읽었다.
// 3D 그리기는 Jest에서 돌지 않으므로 가짜로 바꾸고, 처음 그려진 뒤 '방이 보였다'(onRoomShown)를 한 번 부르게 한다(기존 화면 시험과 같다).
// 시계는 가짜 시계(2026-06-21 12:30)이고, 프레임은 0.05초씩 시계와 함께 넣는다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import {
  MARKS,
  ROOM,
  SOLID_TILES,
  VIEW_WIDTH_MAX,
  VIEW_WIDTH_MIN,
  applyArea,
  isFree,
  type FloorPoint,
  type PointerHit
} from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_SOLID_TILES, VILLAGE_START } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";

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
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const NOW = new Date(2026, 5, 21, 12, 30);
const devGlobal = globalThis as unknown as { __DEV__: boolean };
const originalDev = devGlobal.__DEV__;

const VILLAGE_LABELS = ["라룹이 집", "가구점", "카페", "도서관"];
const ROOM_ONLY_LABELS = ["오늘의 질문", "생각 창가", "일기 책상", "밖으로"];

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

async function renderDev() {
  devGlobal.__DEV__ = true;
  await render(<DevLobby3dRoute />);
  await flushAsync();
}

async function openPanel() {
  await fireEvent.press(screen.getByText("시험판 펴기"));
  await flushAsync();
}

function areaButton(name: "방" | "마을") {
  return screen.getByRole("button", { name });
}

async function pressArea(name: "방" | "마을") {
  await fireEvent.press(areaButton(name));
  await flushAsync();
}

/** seconds만큼 프레임을 돌린다(가짜 시계도 함께). */
async function frames(seconds: number, eachFrame?: () => void) {
  const count = Math.round(seconds / 0.05);
  await act(async () => {
    for (let i = 0; i < count; i += 1) {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
      eachFrame?.();
    }
  });
}

async function tapFloor(point: FloorPoint | null, mark: PointerHit["mark"] = null) {
  const hit: PointerHit = { point, mark, onCharacter: false };
  await act(async () => {
    canvas().onPointer("down", hit, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
}

function textCount(text: string) {
  return screen.queryAllByText(text, { includeHiddenElements: true }).length;
}

function dist(a: FloorPoint, b: FloorPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

async function nudge(name: string, action: "increment" | "decrement", times: number) {
  for (let i = 0; i < times; i += 1) {
    await fireEvent(screen.getByRole("adjustable", { name }), "accessibilityAction", { nativeEvent: { actionName: action } });
  }
  await flushAsync();
}

function sliderNow(name: string) {
  return (screen.getByRole("adjustable", { name }).props.accessibilityValue as { now: number }).now;
}

/** 마을에서 걸어갈 수 있는, target에 가장 가까운 칸 가운데. */
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

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  await AsyncStorage.clear();
  mockCanvas.props = null;
});

afterEach(() => {
  devGlobal.__DEV__ = originalDev;
  applyArea("room");
  jest.useRealTimers();
});

// ---------- D. 개발 화면에서 열기 ----------

describe("[spec] 개발 화면에서 마을 열기(D1~D8)", () => {
  it("D1: 시험판에 '방'·'마을' 버튼이 있고, 처음에는 '방'이 선택됨이다", async () => {
    await renderDev();
    await openPanel();
    expect(areaButton("방").props.accessibilityState).toMatchObject({ selected: true });
    expect(areaButton("마을").props.accessibilityState?.selected ?? false).toBe(false);
  });

  it("D2: '마을'을 누르면 '마을'이 선택됨이고, 마을 이름표 넷이 보이며 방 이름표는 없다", async () => {
    await renderDev();
    await openPanel();
    const recordsInRoom = textCount("학습 기록");
    await pressArea("마을");

    expect(areaButton("마을").props.accessibilityState).toMatchObject({ selected: true });
    expect(areaButton("방").props.accessibilityState?.selected ?? false).toBe(false);
    for (const label of VILLAGE_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 1 });
    for (const label of ROOM_ONLY_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 0 });
    // "학습 기록"은 아래 메뉴에도 있어, 방 이름표 몫 하나만 빠진다
    expect(textCount("학습 기록")).toBe(recordsInRoom - 1);
  });

  it("D3: 방에서 걷는 중에 '마을'을 누르면 바로 라룹이 집 문 앞에서 카메라 쪽을 보고 서고, 몇 초 뒤에도 그 자리에 서 있다", async () => {
    await renderDev();
    await openPanel();
    await tapFloor({ x: 4.2, z: 9.5 });
    await frames(0.2);
    expect(sim().snapshot(Date.now()).moving).toBe(true);

    await pressArea("마을");
    expect({ x: sim().x, z: sim().z }).toEqual({ x: VILLAGE_START.x, z: VILLAGE_START.z });
    expect(sim().heading).toBeCloseTo(0, 6);
    await frames(0.05);
    expect(dist({ x: sim().x, z: sim().z }, VILLAGE_START)).toBeLessThanOrEqual(1e-6);

    await frames(3);
    expect(dist({ x: sim().x, z: sim().z }, VILLAGE_START)).toBeLessThanOrEqual(1e-6);
    expect(sim().snapshot(Date.now()).moving).toBe(false);
    expect(sim().heading).toBeCloseTo(0, 6);
  });

  it("D4: 마을에서 '방'을 누르면 '방'이 선택됨이고, 입구 발판 안쪽 (4.0, 10.5)에 서며, 방 이름표가 돌아오고 마을 이름표는 없다", async () => {
    await renderDev();
    await openPanel();
    const recordsInRoom = textCount("학습 기록");
    await pressArea("마을");
    await frames(0.5);
    await pressArea("방");

    expect(areaButton("방").props.accessibilityState).toMatchObject({ selected: true });
    expect(areaButton("마을").props.accessibilityState?.selected ?? false).toBe(false);
    expect(sim().x).toBeCloseTo(4.0, 9);
    expect(sim().z).toBeCloseTo(10.5, 9);
    for (const label of ROOM_ONLY_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 1 });
    expect(textCount("학습 기록")).toBe(recordsInRoom);
    for (const label of VILLAGE_LABELS) expect({ label, count: textCount(label) }).toEqual({ label, count: 0 });
  });

  it("D5: 방으로 돌아온 뒤 방의 막힌 칸·장소·크기가 마을에 가기 전과 같고, 일기 책상으로 걸어가면 그 안내가 뜬다", async () => {
    await renderDev();
    await openPanel();
    const before = {
      solid: [...SOLID_TILES].sort(),
      marks: JSON.parse(JSON.stringify(MARKS)) as unknown,
      size: { width: ROOM.width, depth: ROOM.depth }
    };
    await pressArea("마을");
    await frames(0.5);
    await pressArea("방");
    expect({ solid: [...SOLID_TILES].sort(), marks: JSON.parse(JSON.stringify(MARKS)) as unknown, size: { width: ROOM.width, depth: ROOM.depth } }).toEqual(before);

    await tapFloor(MARKS.desk.approach[0], "desk");
    await frames(10);
    const goal = MARKS.desk.approach[0];
    expect(dist({ x: sim().x, z: sim().z }, goal)).toBeLessThanOrEqual(0.06);
    const snap = sim().snapshot(Date.now());
    expect(snap.bubbleText).toBe("일기 책상이야.\n오늘 일기를 써 볼까?");
    expect(snap.bubbleButton).toBe("들어가기");
  });

  it("D6: 마을에서도 시험판의 동작 버튼과 걷는 속도 조절이 된다", async () => {
    await renderDev();
    await openPanel();
    await pressArea("마을");

    await fireEvent.press(screen.getByRole("button", { name: "손 흔들기" }));
    await flushAsync();
    expect(sim().action?.type).toBe("wave");
    expect(screen.getByText("동작: 손 흔들기")).toBeTruthy();

    await nudge("걷는 속도", "decrement", 12);
    expect(sliderNow("걷는 속도")).toBeCloseTo(2.0, 9);
    expect(sim().settings.speed).toBeCloseTo(2.0, 9);
  });

  it("D7: '꾸미기'가 보이는 로비 화면에서 마을에 있는 동안은 '꾸미기'가 없고, 방으로 돌아오면 다시 있다(04 결정 3)", async () => {
    const onSaveLayout = jest.fn((layout) => Promise.resolve(layout));
    await render(<Lobby3dScreen onSaveLayout={onSaveLayout} />);
    await flushAsync();
    expect(screen.queryByText("꾸미기")).not.toBeNull();
    await openPanel();
    await pressArea("마을");
    expect(screen.queryByText("꾸미기")).toBeNull();
    await pressArea("방");
    expect(screen.queryByText("꾸미기")).not.toBeNull();
  });

  it("D8: 마을에서 고른 시각·달이 마을에 그대로 적용되고, '지금 시각으로'를 누르면 폰 시각으로 돌아간다", async () => {
    await renderDev();
    await openPanel();
    await pressArea("마을");
    expect(canvas().area).toBe("village");

    // 12:30 → 22:00(15분씩 38번), 6월 → 1월(5번)
    await nudge("시각", "increment", 38);
    await nudge("달", "decrement", 5);
    expect(sliderNow("시각")).toBe(22);
    expect(sliderNow("달")).toBe(1);
    expect({ area: canvas().area, phase: canvas().daylight.phase, season: canvas().daylight.season }).toEqual({
      area: "village",
      phase: "night",
      season: "winter"
    });

    // 22:00 → 12:30, 1월 → 7월
    await nudge("시각", "decrement", 38);
    await nudge("달", "increment", 6);
    expect(sliderNow("시각")).toBe(12.5);
    expect(sliderNow("달")).toBe(7);
    expect({ phase: canvas().daylight.phase, season: canvas().daylight.season }).toEqual({ phase: "day", season: "summer" });

    await fireEvent.press(screen.getByRole("button", { name: "지금 시각으로" }));
    await flushAsync();
    // 폰 시각 2026-06-21 12:30: 낮, 여름
    expect({ area: canvas().area, phase: canvas().daylight.phase, season: canvas().daylight.season }).toEqual({
      area: "village",
      phase: "day",
      season: "summer"
    });
  });
});

// ---------- B10. 마을 화면에서 누르기 ----------

describe("[spec] 마을 화면에서 누르기(B10)", () => {
  it("B10: 마을에서 바닥을 톡하면 라룹이가 그곳에 멈추고, 걷는 내내 마을에서 걸어갈 수 있는 자리에 있다", async () => {
    await renderDev();
    await openPanel();
    await pressArea("마을");
    const target = villageFreeNear({ x: LAYOUT.fountain.x - 3.5, z: LAYOUT.fountain.z + 2.5 });
    await tapFloor(target);
    const bad: string[] = [];
    await frames(20, () => {
      const s = canvas().sim;
      if (!isFree(s.x, s.z, VILLAGE_SOLID_TILES, VILLAGE)) bad.push(`${s.x.toFixed(2)},${s.z.toFixed(2)}`);
    });
    expect(bad).toEqual([]);
    expect(dist({ x: sim().x, z: sim().z }, target)).toBeLessThanOrEqual(0.06);
  });
});

// ---------- C5. 카메라 거리 ----------

describe("[spec] 카메라 거리는 방과 같은 값(C5)", () => {
  it("C5: 방에서 고른 거리가 마을에서 그대로이고, 마을에서 바꾼 거리가 방에서도 그대로이며, 4.0~12.8 밖으로 가지 않는다", async () => {
    await renderDev();
    await openPanel();
    await fireEvent.press(screen.getByRole("button", { name: /카메라 거리/ }));
    await flushAsync();
    await nudge("카메라 거리", "increment", 5);
    const inRoom = canvas().viewWidth;

    await pressArea("마을");
    expect(canvas().viewWidth).toBe(inRoom);

    if (!screen.queryByRole("adjustable", { name: "카메라 거리" })) {
      await fireEvent.press(screen.getByRole("button", { name: /카메라 거리/ }));
      await flushAsync();
    }
    await nudge("카메라 거리", "decrement", 12);
    const inVillage = canvas().viewWidth;
    expect(inVillage).not.toBe(inRoom);

    await pressArea("방");
    expect(canvas().viewWidth).toBe(inVillage);

    await pressArea("마을");
    if (!screen.queryByRole("adjustable", { name: "카메라 거리" })) {
      await fireEvent.press(screen.getByRole("button", { name: /카메라 거리/ }));
      await flushAsync();
    }
    await nudge("카메라 거리", "decrement", 120);
    expect(canvas().viewWidth).toBeLessThanOrEqual(VIEW_WIDTH_MAX);
    expect(canvas().viewWidth).toBeGreaterThanOrEqual(VIEW_WIDTH_MIN);
    await nudge("카메라 거리", "increment", 120);
    expect(canvas().viewWidth).toBeLessThanOrEqual(VIEW_WIDTH_MAX);
    expect(canvas().viewWidth).toBeGreaterThanOrEqual(VIEW_WIDTH_MIN);
  });
});

// ---------- E1. 폰 시각·달 ----------

describe("[spec] 마을은 폰 시각과 달을 따른다(E1)", () => {
  it.each([
    ["2026-06-21 12:30", new Date(2026, 5, 21, 12, 30), "day", "summer"],
    ["2026-01-15 23:00", new Date(2026, 0, 15, 23, 0), "night", "winter"]
  ] as [string, Date, string, string][])("E1 %s: 마을이 받는 하루의 때·계절이 방과 같다(%s, %s)", async (_name, at, phase, season) => {
    jest.setSystemTime(at);
    await renderDev();
    const room = canvas().daylight;
    await openPanel();
    await pressArea("마을");
    const village = canvas().daylight;
    expect(canvas().area).toBe("village");
    expect({ phase: village.phase, season: village.season, ceilingLight: village.ceilingLight }).toEqual({
      phase: room.phase,
      season: room.season,
      ceilingLight: room.ceilingLight
    });
    expect({ phase: village.phase, season: village.season }).toEqual({ phase, season });
  });
});
