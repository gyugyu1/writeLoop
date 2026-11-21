// [spec] qa 테스트(작업 133 ① 옷집 입장·두 층 이동, 새 기능, 모바일): 로비 화면(Lobby3dScreen) 흐름.
// 기대값은 private 작업 폴더 133-2026-11-21-옷가게-실내-구매/02-입장-두층-이동/02-qa-scenarios.md(S번호)와 03-main-decision.md 3('옷집 실내')에서만 가져온다.
// 좌표는 애셋 clothing-shop-layout.json의 값(앱 좌표 = 모델 좌표 + (9, 8))이다. 3D 그리기는 가짜로 바꾼다
// (구역이 마을이면 onVillageReady, 옷집 층이면 mockClothing.mode에 따라 onClothingReady·onClothingFailed를 부른다).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import DevLobby3dRoute from "@/app/dev/lobby-3d";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockClothing: { mode: Record<1 | 2, "ready" | "pending" | "failed"> } = { mode: { 1: "ready", 2: "ready" } };

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
      if (area === "shop") mockCanvas.props?.onShopReady?.();
      if (area !== "clothing1" && area !== "clothing2") return;
      const mode = mockClothing.mode[area === "clothing1" ? 1 : 2];
      if (mode === "ready") mockCanvas.props?.onClothingReady?.();
      else if (mode === "failed") mockCanvas.props?.onClothingFailed?.();
    }, [area]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const ALL = { includeHiddenElements: true } as const;
const OFFSET = { x: 9, z: 8 };
type Anchors = Record<string, { positionXYZ: number[]; rotationYDegrees: number }>;
const spot = (n: "1" | "2", key: string) => {
  const a = (LAYOUT.floors[n].anchors as Anchors)[key];
  return { x: a.positionXYZ[0] + OFFSET.x, z: a.positionXYZ[2] + OFFSET.z, yaw: (a.rotationYDegrees * Math.PI) / 180 };
};
const SPAWN = spot("1", "EntranceSpawn");
const EXIT_APPROACH = spot("1", "ExitApproach");
const STAIRS_UP = spot("1", "StairsUp");
const FROM_UPPER = spot("1", "FromUpper");
const STAIRS_DOWN = spot("2", "StairsDown");
const FROM_LOWER = spot("2", "FromLower");

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const angleGap = (a: number, b: number) => {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
};
const textCount = (text: string) => screen.queryAllByText(text, ALL).length;
const bubble = () => sim().snapshot(Date.now()).bubbleText;

async function flushAsync() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function frames(seconds: number) {
  const count = Math.round(seconds / 0.05);
  for (let i = 0; i < count; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(50);
      canvas().onFrame(0.05, Date.now());
    });
  }
}

async function walkTo(point: FloorPoint, mark: PointerHit["mark"]) {
  await act(async () => {
    canvas().onPointer("down", { point, mark, onCharacter: false }, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
  await frames(25);
  expect(dist(pos(), point)).toBeLessThanOrEqual(0.06);
}

const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
};

async function toClothingDoor() {
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  await walkTo(VILLAGE_PLACES.clothingShop.approach[0], "clothingShop");
}

/** 장소 이름표를 누른 것과 같다: 점 없이 장소만 준다. */
async function goToPlace(id: string) {
  await act(async () => {
    canvas().onPointer("down", { point: null, mark: id as PointerHit["mark"], onCharacter: false }, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
  await frames(25);
  expect(sim().snapshot(Date.now()).arrived).toBe(id);
}

/** 장소 이름표 글로 장소 id를 찾는다(옷집 장소 id는 명세에 없어 이름표 글이 기준이다). */
function placeByLabel(label: string): string {
  const found = Object.entries({ clothingExit: "마을로", clothingUp: "2층", clothingDown: "1층" }).find(([, l]) => l === label);
  return found![0];
}

let reduceMotion = false;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  mockClothing.mode = { 1: "ready", 2: "ready" };
  reduceMotion = false;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(async () => reduceMotion);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
});

afterEach(() => {
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function renderLobby() {
  const view = await render(<Lobby3dScreen devPanel={false} />);
  await flushAsync();
  return view;
}

async function enterClothing() {
  await toClothingDoor();
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
}

describe("[spec] 입장(S4~S6, S22)", () => {
  it("S4: 마을 옷집 문 앞 말풍선은 '옷집에 들어갈까?'와 '들어가기'이고 '곧 열려요'는 없다", async () => {
    await renderLobby();
    await toClothingDoor();
    expect(textCount("옷집에 들어갈까?")).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "들어가기" })).toBeTruthy();
    expect(textCount("옷집은 곧 열려요")).toBe(0);
  });

  it("S5·S6: '들어가기'를 누르면 어두워지는 동안 '옷집에 들어가는 중…'이 보이고, 옷집 1층 입장 자리(F1_EntranceSpawn)에서 yaw 180(π)을 보고 선다", async () => {
    mockClothing.mode = { 1: "pending", 2: "ready" };
    await renderLobby();
    await toClothingDoor();
    await press("들어가기");
    await frames(1.0);
    expect(textCount("옷집에 들어가는 중…")).toBe(1);
    await act(async () => {
      canvas().onClothingReady?.();
    });
    await frames(0.8);
    expect(area()).toBe("clothing1");
    expect(textCount("옷집에 들어가는 중…")).toBe(0);
    expect(dist(pos(), SPAWN)).toBeLessThan(0.01);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThan(0.01);
  });

  it("S22: 1층 모델을 읽지 못하면 마을에 남고 '옷집에 들어가지 못했어요'를 안내한다", async () => {
    mockClothing.mode = { 1: "failed", 2: "ready" };
    await renderLobby();
    await toClothingDoor();
    await press("들어가기");
    await frames(1.5);
    expect(area()).toBe("village");
    expect(textCount("옷집에 들어가지 못했어요")).toBe(1);
  });
});

describe("[spec] 1층 장소와 층 이동(S11~S21, S23)", () => {
  it("S11~S13: 1층에서 이름표 '마을로'·'2층'이 보이고, '마을로'에 서면 문 쪽(0)을 보며 '마을로 나갈까?'/'나가기', 누르면 마을 옷집 문 앞에 나온다", async () => {
    await renderLobby();
    await enterClothing();
    expect(textCount("마을로")).toBeGreaterThan(0);
    expect(textCount("2층")).toBeGreaterThan(0);
    await goToPlace(placeByLabel("마을로"));
    expect(dist(pos(), EXIT_APPROACH)).toBeLessThanOrEqual(0.06);
    expect(angleGap(sim().heading, 0)).toBeLessThan(0.05);
    expect(bubble()).toBe("마을로 나갈까?");
    await press("나가기");
    await frames(1.2);
    expect(area()).toBe("village");
    expect(dist(pos(), VILLAGE_PLACES.clothingShop.approach[0])).toBeLessThan(0.06);
  });

  it("S14·S15: '2층'에 서면 '2층으로 올라갈까?'/'올라가기', 누르면 2층 F2_FromLower에 yaw 180으로 선다", async () => {
    await renderLobby();
    await enterClothing();
    await goToPlace(placeByLabel("2층"));
    expect(dist(pos(), STAIRS_UP)).toBeLessThanOrEqual(0.06);
    expect(bubble()).toBe("2층으로 올라갈까?");
    await press("올라가기");
    await frames(1.2);
    expect(area()).toBe("clothing2");
    expect(dist(pos(), FROM_LOWER)).toBeLessThan(0.01);
    expect(angleGap(sim().heading, FROM_LOWER.yaw)).toBeLessThan(0.01);
  });

  it("S16~S18: 2층 이름표는 '1층'이고, 서면 '1층으로 내려갈까?'/'내려가기', 누르면 1층 F1_FromUpper에 yaw 0으로 선다", async () => {
    await renderLobby();
    await enterClothing();
    await goToPlace(placeByLabel("2층"));
    await press("올라가기");
    await frames(1.2);
    expect(textCount("1층")).toBeGreaterThan(0);
    await goToPlace(placeByLabel("1층"));
    expect(dist(pos(), STAIRS_DOWN)).toBeLessThanOrEqual(0.06);
    expect(bubble()).toBe("1층으로 내려갈까?");
    await press("내려가기");
    await frames(1.2);
    expect(area()).toBe("clothing1");
    expect(dist(pos(), FROM_UPPER)).toBeLessThan(0.01);
    expect(angleGap(sim().heading, FROM_UPPER.yaw)).toBeLessThan(0.01);
  });

  it("S19: 층을 옮기는 전환 중에는 바닥 누르기를 받지 않는다", async () => {
    await renderLobby();
    await enterClothing();
    await goToPlace(placeByLabel("2층"));
    await press("올라가기");
    await frames(0.4);
    const far = { x: FROM_LOWER.x - 4, z: FROM_LOWER.z + 4 };
    await act(async () => {
      canvas().onPointer("down", { point: far, mark: null, onCharacter: false }, 100, 100);
    });
    await act(async () => {
      jest.advanceTimersByTime(30);
      canvas().onPointer("up", null, 100, 100);
    });
    await frames(0.3);
    expect(dist(pos(), FROM_LOWER)).toBeLessThan(0.01);
  });

  it("S20: 2층 모델을 읽지 못하면 1층에 남고 '2층으로 가지 못했어요'를 안내한다", async () => {
    mockClothing.mode = { 1: "ready", 2: "failed" };
    await renderLobby();
    await enterClothing();
    await goToPlace(placeByLabel("2층"));
    await press("올라가기");
    await frames(1.5);
    expect(area()).toBe("clothing1");
    expect(textCount("2층으로 가지 못했어요")).toBe(1);
  });

  it("S21: 1층 모델을 읽지 못하면 2층에 남고 '1층으로 가지 못했어요'를 안내한다", async () => {
    await renderLobby();
    await enterClothing();
    await goToPlace(placeByLabel("2층"));
    await press("올라가기");
    await frames(1.2);
    expect(area()).toBe("clothing2");
    mockClothing.mode = { 1: "failed", 2: "ready" };
    await goToPlace(placeByLabel("1층"));
    await press("내려가기");
    await frames(1.5);
    expect(area()).toBe("clothing2");
    expect(textCount("1층으로 가지 못했어요")).toBe(1);
  });

  it("S23: 2층까지 갔다 나가고 다시 들어오면 늘 1층 입장 자리(yaw 180)에서 시작한다", async () => {
    await renderLobby();
    await enterClothing();
    await goToPlace(placeByLabel("2층"));
    await press("올라가기");
    await frames(1.2);
    await goToPlace(placeByLabel("1층"));
    await press("내려가기");
    await frames(1.2);
    await goToPlace(placeByLabel("마을로"));
    await press("나가기");
    await frames(1.2);
    expect(area()).toBe("village");
    await press("들어가기");
    await frames(1.2);
    expect(area()).toBe("clothing1");
    expect(dist(pos(), SPAWN)).toBeLessThan(0.01);
    expect(angleGap(sim().heading, Math.PI)).toBeLessThan(0.01);
  });
});

describe("[spec] 개발 화면 시험판(S24, 03 결정 3)", () => {
  it("S24: 구역 버튼에 '옷집 실내'가 더해지고 누르면 바로 옷집 1층 입장 자리다. 방·마을·가구점 실내 버튼은 그대로 있다", async () => {
    const devGlobal = globalThis as unknown as { __DEV__: boolean };
    const original = devGlobal.__DEV__;
    devGlobal.__DEV__ = true;
    try {
      await render(<DevLobby3dRoute />);
      await flushAsync();
      await fireEvent.press(screen.getByText("시험판 펴기"));
      await flushAsync();
      for (const name of ["방", "마을", "가구점 실내"]) expect(screen.getByRole("button", { name })).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "옷집 실내" }));
      await flushAsync();
      await frames(1.2);
      expect(area()).toBe("clothing1");
      expect(dist(pos(), SPAWN)).toBeLessThan(0.01);
      expect(angleGap(sim().heading, Math.PI)).toBeLessThan(0.01);
    } finally {
      devGlobal.__DEV__ = original;
    }
  });
});
