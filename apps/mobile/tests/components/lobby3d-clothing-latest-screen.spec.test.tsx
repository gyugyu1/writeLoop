// [spec] qa 테스트(작업 133 05 최신 애셋 반영): 로비 화면에서 입구 → 선글라스 걷기·선택·이름표·상품 창, 새 자리 상품(백팩·2층으로 간 상품), 빈 자리 누르기, 그대로 둘 동작.
// 기대값은 05-최신-애셋-반영/01-main-spec.md에서만 가져왔다. 3D 그리기는 가짜 캔버스로 바꾸고, 누르기는 캔버스가 넘기는 onPointer로 흉내 낸다(기존 옷집 화면 테스트와 같은 방식).
// 구현 코드는 부르는 방법(캔버스 props의 onPointer·clothingSelected, PointerHit.product)을 알려고만 읽었다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { CLOTHING_MARKS, MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { CLOTHING_NODES } from "@/lib/lobby3d/clothing-shop";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

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
      if (area === "clothing1" || area === "clothing2") mockCanvas.props?.onClothingReady?.();
    }, [area]);
    return React.createElement("Lobby3dCanvasMock");
  }
  return { __esModule: true, default: MockLobby3dCanvas };
});
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

/* eslint-disable @typescript-eslint/no-require-imports */
const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
const catalogStore = require("@/lib/item-catalog-store") as typeof import("@/lib/item-catalog-store");
/* eslint-enable @typescript-eslint/no-require-imports */

const ALL = { includeHiddenElements: true } as const;
const PRICES: Record<string, number> = {
  tshirtOrange: 80,
  shortsNavy: 70,
  shoesWhite: 90,
  capOrange: 60,
  shoesBrown: 90,
  capBlue: 60,
  mufflerRed: 90,
  backpackRed: 120,
  necklaceGold: 110
};

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const texts = (value: string) => screen.queryAllByText(value, ALL);
/** 부분 글을 가진 글 노드(이름표처럼 '이름 · 가격'이 한 글에 들어 있어도 찾는다). */
const textsContaining = (...parts: string[]) =>
  screen.queryAllByText(new RegExp(parts.map((part) => `(?=.*${part})`).join("")), ALL);

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
}

async function press(name: string) {
  // 시트 머리의 닫기와 상품 창의 '닫기'처럼 이름이 겹치면 첫 버튼을 누른다
  await fireEvent.press(screen.getAllByRole("button", { name })[0]);
}

/** 진열 상품을 톡 누른다(캔버스가 그 상품의 서는 자리와 product를 넘기는 것을 흉내 낸다). 걷기는 기다리지 않는다. */
async function tapProductNoWait(id: string) {
  const product = stock.clothingProduct(id)!;
  await act(async () => {
    canvas().onPointer("down", { point: product.approach, mark: null, onCharacter: false, onScenery: true, building: null, product: id }, 100, 100);
  });
  await act(async () => {
    jest.advanceTimersByTime(30);
    canvas().onPointer("up", null, 100, 100);
  });
}

async function tapProduct(id: string) {
  await tapProductNoWait(id);
  await frames(20);
}

async function enterClothing(props: Partial<React.ComponentProps<typeof Lobby3dScreen>> = {}) {
  await render(<Lobby3dScreen devPanel={false} {...props} />);
  await flushAsync();
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  await walkTo(VILLAGE_PLACES.clothingShop.approach[0], "clothingShop");
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
}

async function goUp() {
  await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
  await press("올라가기");
  await frames(1.2);
  expect(area()).toBe("clothing2");
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  catalogStore.setItemCatalog({
    version: "spec-clothing",
    items: Object.entries(PRICES).map(([id, price]) => ({
      id,
      kind: "wearable",
      name: id,
      shopName: id,
      description: "",
      category: "clothes",
      slot: "hat",
      price,
      draw: null,
      assets: null
    })) as never
  });
});

afterEach(() => {
  stock.resetClothingShop();
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});


describe("[spec] 입구에서 선글라스까지(사용자 확인 요청)", () => {
  it("입구에서 선글라스를 누르면 그 서는 자리까지 걸어가 선택되고 이름표·상품 창이 열린다", async () => {
    await enterClothing();
    const start = pos();
    const goal = stock.clothingProduct("wear-face-honey-panto")!.approach;
    expect(dist(start, { x: CLOTHING_NODES.entranceSpawn.x, z: CLOTHING_NODES.entranceSpawn.z })).toBeLessThan(0.5);
    await tapProductNoWait("wear-face-honey-panto");
    expect(canvas().clothingSelected ?? null).toBeNull();
    await frames(20);
    expect(dist(pos(), goal)).toBeLessThan(0.1);
    expect(canvas().clothingSelected).toBe("wear-face-honey-panto");
    expect(textsContaining("허니 팬토 선글라스", "판매 준비 중").length).toBeGreaterThan(0);
    expect(texts("판매 준비 중인 옷이에요")).toHaveLength(1);
  });

  it("선글라스까지 걷는 시간은 곧은 거리 걷는 시간에 가깝다(8초 안에 도착)", async () => {
    await enterClothing();
    await tapProductNoWait("wear-face-honey-panto");
    await frames(8);
    expect(dist(pos(), stock.clothingProduct("wear-face-honey-panto")!.approach)).toBeLessThan(0.1);
  });

  it("선글라스는 장바구니에 담을 수 없다(미등록)", async () => {
    await enterClothing();
    await tapProduct("wear-face-honey-panto");
    await press("장바구니 담기");
    expect(stock.clothingCart()).toEqual([]);
  });
});

describe("[spec] 새 자리 상품(그대로 둘 가격·이름, 바뀐 자리)", () => {
  it("빨강 백팩(1층 새 행거)은 120룹 이름표가 뜨고 담을 수 있다", async () => {
    await enterClothing();
    await tapProduct("backpackRed");
    expect(canvas().clothingSelected).toBe("backpackRed");
    expect(textsContaining("빨강 백팩", "120룹").length).toBeGreaterThan(0);
    await press("장바구니 담기");
    expect(stock.clothingCart()).toEqual(["backpackRed"]);
  });

  it("2층으로 옮겨진 주황 티셔츠·갈색 운동화는 1층에서 누를 수 없고, 2층에서 누르면 80룹·90룹 이름표가 뜬다", async () => {
    await enterClothing();
    await goUp();
    await tapProduct("tshirtOrange");
    expect(canvas().clothingSelected).toBe("tshirtOrange");
    expect(dist(pos(), stock.clothingProduct("tshirtOrange")!.approach)).toBeLessThan(0.1);
    expect(textsContaining("주황 티셔츠", "80룹").length).toBeGreaterThan(0);
    await press("닫기");
    await tapProduct("shoesBrown");
    expect(canvas().clothingSelected).toBe("shoesBrown");
    expect(textsContaining("갈색 운동화", "90룹").length).toBeGreaterThan(0);
  });
});

describe("[spec] 빈 진열 자리(바뀌는 동작 4)", () => {
  it("빈 자리(상품 정보 없는 누르기)를 눌러도 선택·이름표·상품 창이 없다", async () => {
    await enterClothing();
    const spots = [
      { x: -2.42, z: 1.75 }, // F1_Reserve_Table_Visit
      { x: 4.58, z: 3.38 }, // F1_HarborTable_Mount02_Visit(새 진열대의 빈 자리)
      { x: -1.87, z: -1.64 } // F1_HarborRail_Mount02_Visit(새 행거의 빈 자리)
    ];
    for (const s of spots) {
      await walkTo({ x: s.x + 9, z: s.z + 8 }, null);
      expect(canvas().clothingSelected ?? null).toBeNull();
      expect(texts("장바구니 담기")).toHaveLength(0);
    }
  });
});

describe("[spec] 그대로 둘 동작", () => {
  it("시험판의 진열 버튼은 22개고 끄면 그 상품이 장바구니에서 빠진다", async () => {
    await enterClothing({ devPanel: true });
    expect(stock.CLOTHING_PRODUCTS).toHaveLength(22);
    await tapProduct("capOrange");
    await press("장바구니 담기");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    stock.setClothingDisplayed("capOrange", false);
    expect(stock.clothingCart()).toEqual([]);
  });

  it("1층 → 2층 → 1층을 오가도 길이 막히지 않는다(계단 통로)", async () => {
    await enterClothing();
    await goUp();
    await walkTo(CLOTHING_MARKS.clothingDown.approach[0], "clothingDown");
    await press("내려가기");
    await frames(1.2);
    expect(area()).toBe("clothing1");
  });
});
