// 메인 세션 테스트(작업 133 ① 옷집 입장·두 층 이동): 로비 화면에서 마을 → 옷집 1층 → 2층 → 1층 → 마을, 층 모델을 기다릴 때·읽지 못할 때.
// 3D 그리기는 가짜로 바꾼다. 가짜는 구역이 마을이면 onVillageReady, 옷집 층이면 mockClothing.mode에 따라 onClothingReady·onClothingFailed를 부른다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { CLOTHING_MARKS, MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { CLOTHING_NODES } from "@/lib/lobby3d/clothing-shop";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
/** 층마다 가짜 3D가 할 일: ready(onClothingReady), pending(부르지 않음), failed(onClothingFailed). */
const mockClothing: { mode: Record<1 | 2, "ready" | "pending" | "failed"> } = { mode: { 1: "ready", 2: "ready" } };

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));
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

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const angleGap = (a: number, b: number) => {
  const twoPi = Math.PI * 2;
  return Math.abs(((((a - b + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI);
};

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
  await frames(20);
  expect(dist(pos(), point)).toBeLessThanOrEqual(0.06);
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole("button", { name }));
}

/** 방 → 마을 → 옷집 문 앞. */
async function toClothingDoor() {
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  await walkTo(VILLAGE_PLACES.clothingShop.approach[0], "clothingShop");
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  mockClothing.mode = { 1: "ready", 2: "ready" };
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  await render(<Lobby3dScreen devPanel={false} />);
  await flushAsync();
});

afterEach(() => {
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("마을 → 옷집 1층 입장 → 2층 → 1층 → 마을, 다시 들어오면 1층 입장 자리", async () => {
  await toClothingDoor();
  expect(sim().snapshot(Date.now()).bubbleText).toBe("옷집에 들어갈까?");
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
  expect(dist(pos(), CLOTHING_NODES.entranceSpawn)).toBeLessThan(1e-6);
  expect(angleGap(sim().heading, Math.PI)).toBeLessThan(1e-3);
  for (const label of ["마을로", "2층"]) expect(screen.queryAllByText(label, ALL).length).toBeGreaterThan(0);

  await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
  expect(sim().snapshot(Date.now()).bubbleText).toBe("2층으로 올라갈까?");
  await press("올라가기");
  await frames(1.2);
  expect(area()).toBe("clothing2");
  expect(dist(pos(), CLOTHING_NODES.fromLower)).toBeLessThan(1e-6);
  expect(angleGap(sim().heading, Math.PI)).toBeLessThan(1e-3);
  expect(screen.queryAllByText("1층", ALL).length).toBeGreaterThan(0);

  await walkTo(CLOTHING_MARKS.clothingDown.approach[0], "clothingDown");
  expect(sim().snapshot(Date.now()).bubbleText).toBe("1층으로 내려갈까?");
  await press("내려가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
  expect(dist(pos(), CLOTHING_NODES.fromUpper)).toBeLessThan(1e-6);
  expect(angleGap(sim().heading, 0)).toBeLessThan(1e-3);

  await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
  expect(sim().snapshot(Date.now()).bubbleText).toBe("마을로 나갈까?");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  expect(dist(pos(), VILLAGE_PLACES.clothingShop.approach[0])).toBeLessThan(1e-6);

  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
  expect(dist(pos(), CLOTHING_NODES.entranceSpawn)).toBeLessThan(1e-6);
});

it("1층 모델을 기다리면 '옷집에 들어가는 중…'을 보이고, 읽지 못하면 마을 옷집 문 앞으로 돌아와 안내한다", async () => {
  mockClothing.mode = { 1: "pending", 2: "ready" };
  await toClothingDoor();
  await press("들어가기");
  await frames(1.0);
  expect(screen.queryAllByText("옷집에 들어가는 중…", ALL)).toHaveLength(1);
  await act(async () => {
    canvas().onClothingFailed?.();
  });
  await frames(0.6);
  expect(area()).toBe("village");
  expect(dist(pos(), VILLAGE_PLACES.clothingShop.approach[0])).toBeLessThan(1e-6);
  expect(screen.queryAllByText("옷집에 들어가지 못했어요", ALL)).toHaveLength(1);
});

it("2층 모델을 읽지 못하면 1층 계단 자리에 남고 '2층으로 가지 못했어요'를 안내한다", async () => {
  mockClothing.mode = { 1: "ready", 2: "failed" };
  await toClothingDoor();
  await press("들어가기");
  await frames(1.2);
  await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
  await press("올라가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
  expect(dist(pos(), CLOTHING_MARKS.clothingUp.approach[0])).toBeLessThan(1e-6);
  expect(screen.queryAllByText("2층으로 가지 못했어요", ALL)).toHaveLength(1);
});
