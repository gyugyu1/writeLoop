// 메인 세션 테스트(작업 128 가구점 실내, 130 진열 여섯): 로비 화면에서 마을 → 가구점 입장 → 실내 이동 → 버들 인사 → 진열 교체 → 퇴장 → 재입장.
// 3D 그리기는 Jest에서 돌지 않으므로 가짜로 바꾼다. 가짜는 구역이 마을이면 onVillageReady, 가구점이면 mockShop.mode에 따라
// onShopReady(ready)·onShopFailed(failed)를 부르고, pending이면 부르지 않는다(테스트가 나중에 부른다).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { MARKS, SHOP_MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { SHOP_NODES, resetShopDisplay, shopDisplay } from "@/lib/lobby3d/shop";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };
const mockShop: { mode: "ready" | "pending" | "failed" } = { mode: "ready" };

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
      if (area !== "shop") return;
      if (mockShop.mode === "ready") mockCanvas.props?.onShopReady?.();
      else if (mockShop.mode === "failed") mockCanvas.props?.onShopFailed?.();
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

/** 방 → 마을 → 가구점 문 앞. */
async function toShopDoor() {
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  await walkTo(VILLAGE_PLACES.furnitureShop.approach[0], "furnitureShop");
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  mockShop.mode = "ready";
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  await render(<Lobby3dScreen devPanel={false} />);
  await flushAsync();
});

afterEach(() => {
  applyArea("room");
  resetShopDisplay();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("마을 → 가구점 입장 → 버들 인사 → 진열 교체 → 퇴장 → 재입장", async () => {
  await toShopDoor();
  expect(sim().snapshot(Date.now()).bubbleText).toBe("가구점에 들어갈까?");
  await press("들어가기");
  await frames(1.2);
  // 들어서는 자리에서 매장 안쪽을 보고, 출입문 안내가 뜬다. 꾸미기·홈쇼핑은 없다
  expect(area()).toBe("shop");
  expect(dist(pos(), SHOP_NODES.playerSpawn)).toBeLessThan(1e-6);
  expect(angleGap(sim().heading, Math.PI)).toBeLessThan(1e-3);
  expect(sim().snapshot(Date.now()).bubbleText).toBe("마을로 나갈까?");
  for (const label of ["마을로", "버들", "진열대"]) expect(screen.queryAllByText(label, ALL).length).toBeGreaterThan(0);

  // 버들에게 인사
  await walkTo(SHOP_MARKS.shopCounter.approach[0], "shopCounter");
  await press("인사하기");
  expect(screen.queryAllByText("어서 와! 천천히 둘러보렴.", ALL)).toHaveLength(1);
  await frames(3.2);
  expect(screen.queryAllByText("어서 와! 천천히 둘러보렴.", ALL)).toHaveLength(0);

  // 진열대 2를 구름 책상으로
  await walkTo(SHOP_MARKS.shopSlot2.approach[0], "shopSlot2");
  expect(sim().snapshot(Date.now()).bubbleText).toBe("고양이 편지 책상이야.\n다른 가구로 바꿔 볼까?");
  await press("바꾸기");
  expect(screen.getByText("진열대 2 바꾸기")).toBeTruthy();
  expect(screen.getByRole("button", { name: "고양이 편지 책상, 진열 중" })).toBeTruthy();
  await press("구름 책상");
  expect(shopDisplay()).toEqual(["rainbootPlanter", "cloudDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"]);
  expect(screen.queryByText("진열대 2 바꾸기")).toBeNull();
  await frames(0.1);
  expect(sim().snapshot(Date.now()).bubbleText).toBe("구름 책상이야.\n다른 가구로 바꿔 볼까?");

  // 퇴장: 마을 가구점 문 앞에서 카메라 쪽을 본다
  await walkTo(SHOP_MARKS.shopExit.approach[0], "shopExit");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  expect(dist(pos(), VILLAGE_PLACES.furnitureShop.approach[0])).toBeLessThan(1e-6);
  expect(angleGap(sim().heading, 0)).toBeLessThan(1e-3);

  // 재입장: 진열은 그대로
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("shop");
  expect(shopDisplay()).toEqual(["rainbootPlanter", "cloudDesk", "stargazerBed", "walnutBed", "grandmasFloorBedding", "cloudDesk"]);
});

it("가구점 모델을 기다리면 어두운 채 '가구점에 들어가는 중…'을 보이고, 다 뜨면 밝아진다", async () => {
  mockShop.mode = "pending";
  await toShopDoor();
  await press("들어가기");
  await frames(1.0);
  expect(area()).toBe("shop");
  expect(screen.queryAllByText("가구점에 들어가는 중…", ALL)).toHaveLength(1);
  await act(async () => {
    canvas().onShopReady?.();
  });
  await frames(0.5);
  expect(screen.queryAllByText("가구점에 들어가는 중…", ALL)).toHaveLength(0);
});

it("가구점 모델을 읽지 못하면 마을 가구점 문 앞으로 돌아와 안내한다", async () => {
  mockShop.mode = "failed";
  await toShopDoor();
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("village");
  expect(dist(pos(), VILLAGE_PLACES.furnitureShop.approach[0])).toBeLessThan(1e-6);
  expect(screen.queryAllByText("가구점을 불러오지 못했어요", ALL)).toHaveLength(1);
});
