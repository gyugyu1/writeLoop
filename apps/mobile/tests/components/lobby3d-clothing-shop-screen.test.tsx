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

// 작업 133 ②: 진열 상품을 누르면 그 앞으로 걸어가 상품 창이 열리고, 담으면 '장바구니 N'. 미등록은 담을 수 없다
describe("옷집 진열 상품 선택과 장바구니", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
  const store = require("@/lib/item-catalog-store") as typeof import("@/lib/item-catalog-store");
  /* eslint-enable @typescript-eslint/no-require-imports */

  beforeEach(() => {
    store.setItemCatalog({
      version: "test-clothing",
      items: [
        { id: "capOrange", kind: "wearable", name: "주황 야구모자", shopName: "주황 야구모자", description: "", category: "clothes", slot: "hat", price: 60, draw: null, assets: null }
      ]
    });
  });
  afterEach(() => stock.resetClothingShop());

  async function tapProduct(id: string) {
    const product = stock.clothingProduct(id)!;
    await act(async () => {
      canvas().onPointer("down", { point: product.approach, mark: null, onCharacter: false, onScenery: true, building: null, product: id }, 100, 100);
    });
    await act(async () => {
      jest.advanceTimersByTime(30);
      canvas().onPointer("up", null, 100, 100);
    });
    await frames(20);
  }

  it("등록된 상품: 걸어가 상품 창이 열리고 이름표에 이름·가격, 담으면 안내와 '장바구니 1', 다시 열면 막힘", async () => {
    await toClothingDoor();
    await press("들어가기");
    await frames(1.2);
    await tapProduct("capOrange");
    expect(dist(pos(), stock.clothingProduct("capOrange")!.approach)).toBeLessThan(0.1);
    expect(canvas().clothingSelected).toBe("capOrange");
    expect(screen.queryAllByText("주황 야구모자 · 60룹", ALL)).toHaveLength(1);
    expect(screen.queryAllByText("60룹", ALL)).toHaveLength(1);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    expect(screen.queryAllByText("장바구니에 담았어요", ALL).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("장바구니 1", ALL)).toHaveLength(1);
    // 다른 층에 갔다 와도 장바구니는 그대로이고 선택은 풀린다
    await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
    await press("올라가기");
    await frames(1.2);
    expect(canvas().clothingSelected).toBeNull();
    expect(screen.queryAllByText("장바구니 1", ALL)).toHaveLength(1);
  });

  it("미등록 상품은 '판매 준비 중'이고 담을 수 없다", async () => {
    await toClothingDoor();
    await press("들어가기");
    await frames(1.2);
    await tapProduct("wear-face-honey-panto");
    expect(screen.queryAllByText("허니 팬토 선글라스 · 판매 준비 중", ALL)).toHaveLength(1);
    expect(screen.queryAllByText("판매 준비 중인 옷이에요", ALL)).toHaveLength(1);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual([]);
  });

  it("진열을 해제하면 선택·상품 창이 닫히고 장바구니에서 빠진다", async () => {
    await toClothingDoor();
    await press("들어가기");
    await frames(1.2);
    await tapProduct("capOrange");
    await press("장바구니");
    await tapProduct("capOrange");
    expect(canvas().clothingSelected).toBe("capOrange");
    await act(async () => {
      stock.setClothingDisplayed("capOrange", false);
    });
    expect(canvas().clothingSelected).toBeNull();
    expect(stock.clothingCart()).toEqual([]);
    expect(screen.queryAllByText("장바구니 1", ALL)).toHaveLength(0);
  });
});

// 작업 133 ③ 양 층 피팅룸: 들어가면 커튼이 닫히고 피팅 창, 입기·세트·취소·끝내기
describe("옷집 피팅룸", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
  const store = require("@/lib/item-catalog-store") as typeof import("@/lib/item-catalog-store");
  const shopData = require("@/lib/lobby3d/clothing-shop") as typeof import("@/lib/lobby3d/clothing-shop");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const file = (n: string) => ({ url: `/api/catalog/files/${n}.glb`, sha256: n.padEnd(64, "0").slice(0, 64), bytes: 1 });
  const wearable = (id: string, slot: string, price: number | null, draw: Record<string, unknown>) => ({
    id, kind: "wearable" as const, name: id, shopName: id, description: "", category: price === null ? null : ("clothes" as const), slot, price, draw, assets: { model: file(id), icon: null }
  });

  beforeEach(() => {
    store.setItemCatalog({
      version: "test-fitting",
      items: [
        wearable("capOrange", "hat", 60, { attach: "bone", bone: "head", body: 1 }),
        wearable("wear-hat-breakwater-bucket", "hat", null, { attach: "bone", bone: "head", body: 1 }),
        wearable("wear-top-tide-sailor", "top", null, { attach: "skin", body: 1 }),
        wearable("wear-bottom-jetty-denim", "bottom", null, { attach: "skin", body: 1 }),
        wearable("shoesWhite", "shoes", 90, { attach: "bone", bone: "foot_l", mirror: "foot_r", color: "#DCD8CF", body: 1 })
      ]
    });
  });
  afterEach(() => {
    stock.resetClothingShop();
    shopData.setClothingCurtainClosed(null);
  });

  /** 피팅룸 앞에서 '들어가기'를 누르기 직전의 착장(들어오기 전 착장). */
  let lookBefore: unknown = undefined;
  async function enterFitting(floor: 1 | 2) {
    await toClothingDoor();
    await press("들어가기");
    await frames(1.2);
    if (floor === 2) {
      await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
      await press("올라가기");
      await frames(1.2);
    }
    const id = floor === 1 ? "clothingFitting1" : "clothingFitting2";
    await walkTo(CLOTHING_MARKS[id].approach[0], id);
    expect(sim().snapshot(Date.now()).bubbleText).toBe("피팅룸에 들어갈까?");
    lookBefore = canvas().look;
    await press("들어가기");
    await frames(6);
  }

  it("1층: 들어가면 방 안에 서고 커튼이 닫히며 입구가 막히고, 입은 뒤 취소하면 들어오기 전 착장·커튼 열림·방 앞으로 나온다", async () => {
    await enterFitting(1);
    const room = shopData.CLOTHING_FITTING_ROOMS[1];
    expect(dist(pos(), room.inside)).toBeLessThan(1e-6);
    expect(canvas().clothingCurtainClosed).toBe(1);
    expect(shopData.clothingCurtainClosed()).toBe(1);
    expect(screen.queryAllByText("피팅룸", ALL).length).toBeGreaterThan(0);
    await press("마린 버킷햇, 판매 준비 중");
    expect(canvas().look?.hat).toBe("wear-hat-breakwater-bucket");
    await press("취소");
    expect(canvas().look).toEqual(lookBefore);
    expect(canvas().clothingCurtainClosed).toBeNull();
    expect(shopData.clothingCurtainClosed()).toBeNull();
    await frames(6);
    expect(dist(pos(), room.approach)).toBeLessThan(0.1);
  });

  it("2층: 세트를 입고 끝내면 가지지 않은 등록 상품만 장바구니에 담고(미등록은 안 담음) 들어오기 전 착장으로 돌아온다", async () => {
    await enterFitting(2);
    expect(canvas().clothingCurtainClosed).toBe(2);
    await press("항구 산책 · 마린");
    expect(canvas().look).toMatchObject({ hat: "wear-hat-breakwater-bucket", top: "wear-top-tide-sailor", bottom: "wear-bottom-jetty-denim", shoes: "shoesWhite" });
    await press("장바구니에 넣기");
    expect(stock.clothingCart()).toEqual(["shoesWhite"]);
    expect(screen.queryAllByText("장바구니에 1개 담았어요", ALL).length).toBeGreaterThan(0);
    expect(canvas().look?.shoes ?? null).not.toBe("shoesWhite");
    expect(canvas().clothingCurtainClosed).toBeNull();
  });
});

// 작업 133 ③ 4단계 의심 2: 피팅 중에 로비 화면이 사라지면 커튼 닫힘이 풀린다
describe("피팅 중 화면이 사라질 때", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const shopData = require("@/lib/lobby3d/clothing-shop") as typeof import("@/lib/lobby3d/clothing-shop");
  /* eslint-enable @typescript-eslint/no-require-imports */
  it("커튼 닫힘(임시 충돌)을 풀어 둔다", async () => {
    shopData.setClothingCurtainClosed(1);
    await act(async () => {
      screen.unmount();
    });
    expect(shopData.clothingCurtainClosed()).toBeNull();
  });
});

// 작업 133 ④: 계산대에서 장바구니 창을 열고 구매한다(홈이 주문). 개발 화면은 살 수 없다는 안내
describe("옷집 계산대", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
  const store = require("@/lib/item-catalog-store") as typeof import("@/lib/item-catalog-store");
  /* eslint-enable @typescript-eslint/no-require-imports */

  beforeEach(() => {
    store.setItemCatalog({
      version: "test-checkout",
      items: [
        { id: "capOrange", kind: "wearable", name: "주황 야구모자", shopName: "주황 야구모자", description: "", category: "clothes", slot: "hat", price: 60, draw: null, assets: null },
        { id: "mufflerRed", kind: "wearable", name: "빨강 머플러", shopName: "빨강 머플러", description: "", category: "clothes", slot: "accessory", price: 90, draw: null, assets: null }
      ]
    });
  });
  afterEach(() => stock.resetClothingShop());

  async function toCheckout(order?: (items: { type: string; price: number }[]) => Promise<void>, balance: number | null = 500) {
    await screen.unmount();
    mockCanvas.props = null;
    await render(<Lobby3dScreen devPanel={false} shopBalance={balance} onClothingOrder={order} />);
    await flushAsync();
    await toClothingDoor();
    await press("들어가기");
    await frames(1.2);
    await walkTo(CLOTHING_MARKS.clothingCheckout.approach[0], "clothingCheckout");
    expect(sim().snapshot(Date.now()).bubbleText).toBe("계산할까?");
    await press("계산하기");
  }

  it("담은 상품과 합계·잔액이 보이고, 구매하면 홈이 주문한 뒤 장바구니가 비고 안내가 뜬다", async () => {
    stock.addToClothingCart("capOrange");
    stock.addToClothingCart("mufflerRed");
    const order = jest.fn(async () => {});
    await toCheckout(order);
    expect(screen.queryAllByText("합계 150룹", ALL)).toHaveLength(1);
    expect(screen.queryAllByText("잔액 500룹", ALL)).toHaveLength(1);
    await press("구매");
    await flushAsync();
    expect(order).toHaveBeenCalledWith([
      { type: "capOrange", price: 60 },
      { type: "mufflerRed", price: 90 }
    ]);
    expect(stock.clothingCart()).toEqual([]);
    expect(screen.queryAllByText("옷 2개를 샀어요", ALL).length).toBeGreaterThan(0);
  });

  it("주문이 실패하면 서버 안내를 보이고 장바구니는 그대로, 룹이 모자라면 구매를 누를 수 없다", async () => {
    stock.addToClothingCart("capOrange");
    const order = jest.fn(async () => {
      throw new Error("이미 가진 옷이에요.");
    });
    await toCheckout(order);
    await press("구매");
    await flushAsync();
    expect(screen.queryAllByText("이미 가진 옷이에요.", ALL).length).toBeGreaterThan(0);
    expect(stock.clothingCart()).toEqual(["capOrange"]);
  });

  it("잔액이 합계보다 적으면 '룹이 N 모자라요'이고 구매가 막히며, 비었으면 '장바구니가 비었어요'", async () => {
    stock.addToClothingCart("mufflerRed");
    await toCheckout(jest.fn(async () => {}), 50);
    expect(screen.queryAllByText("룹이 40 모자라요", ALL)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "구매" }).props.accessibilityState).toMatchObject({ disabled: true });
    await press("빨강 머플러 빼기");
    expect(screen.queryAllByText("장바구니가 비었어요", ALL)).toHaveLength(1);
  });

  it("홈이 주문을 맡지 않으면(개발 화면) '홈 화면에서 살 수 있어요'", async () => {
    stock.addToClothingCart("capOrange");
    await toCheckout(undefined);
    await press("구매");
    expect(screen.queryAllByText("홈 화면에서 살 수 있어요", ALL).length).toBeGreaterThan(0);
    expect(stock.clothingCart()).toEqual(["capOrange"]);
  });
});

// 작업 133 즉석 입어보기·피팅 카메라: 진열 상품 앞에서 입어보기·벗기, 옷집 안에서만 유지, 피팅 중 카메라 초점
describe("옷집 즉석 입어보기와 피팅 카메라", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
  const store = require("@/lib/item-catalog-store") as typeof import("@/lib/item-catalog-store");
  const shopData = require("@/lib/lobby3d/clothing-shop") as typeof import("@/lib/lobby3d/clothing-shop");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const file = (n: string) => ({ url: `/api/catalog/files/${n}.glb`, sha256: n.padEnd(64, "0").slice(0, 64), bytes: 1 });
  beforeEach(() => {
    store.setItemCatalog({
      version: "test-try",
      items: [
        { id: "capOrange", kind: "wearable", name: "주황 야구모자", shopName: "주황 야구모자", description: "", category: "clothes", slot: "hat", price: 60, draw: { attach: "bone", bone: "head", body: 1 }, assets: { model: file("capOrange"), icon: null } },
        { id: "wear-face-honey-panto", kind: "wearable", name: "허니 팬토 선글라스", shopName: "허니 팬토 선글라스", description: "", category: null, slot: "face", price: null, draw: { attach: "bone", bone: "head", body: 1 }, assets: { model: file("panto"), icon: null } }
      ]
    });
  });
  afterEach(() => {
    stock.resetClothingShop();
    shopData.setClothingCurtainClosed(null);
  });

  async function tapProduct(id: string) {
    const product = stock.clothingProduct(id)!;
    await act(async () => {
      canvas().onPointer("down", { point: product.approach, mark: null, onCharacter: false, onScenery: true, building: null, product: id }, 100, 100);
    });
    await act(async () => {
      jest.advanceTimersByTime(30);
      canvas().onPointer("up", null, 100, 100);
    });
    await frames(20);
  }

  it("입어보기를 누르면 창이 닫히고 바로 입으며, 다시 열면 '벗기'로 들어오기 전 옷으로, 층을 옮겨도 유지되고 옷집을 나가면 돌아온다", async () => {
    await toClothingDoor();
    const before = canvas().look;
    await press("들어가기");
    await frames(1.2);
    await tapProduct("capOrange");
    await press("입어보기");
    expect(canvas().look?.hat).toBe("capOrange");
    expect(screen.queryByRole("button", { name: "입어보기" })).toBeNull();
    await tapProduct("wear-face-honey-panto");
    await press("입어보기");
    expect(canvas().look).toMatchObject({ hat: "capOrange", face: "wear-face-honey-panto" });
    await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
    await press("올라가기");
    await frames(1.2);
    expect(canvas().look).toMatchObject({ hat: "capOrange", face: "wear-face-honey-panto" });
    await walkTo(CLOTHING_MARKS.clothingDown.approach[0], "clothingDown");
    await press("내려가기");
    await frames(1.2);
    await tapProduct("capOrange");
    await press("벗기");
    expect(canvas().look?.hat ?? null).not.toBe("capOrange");
    await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
    await press("나가기");
    await frames(1.2);
    expect(canvas().look).toEqual(before);
  });

  it("피팅룸 안에서는 카메라 초점이 그 방 안 자리이고 라룹이는 카메라 쪽을 보며, 버튼은 '장바구니에 넣기', 나오면 초점이 풀린다", async () => {
    await toClothingDoor();
    await press("들어가기");
    await frames(1.2);
    await walkTo(CLOTHING_MARKS.clothingFitting1.approach[0], "clothingFitting1");
    await press("들어가기");
    await frames(6);
    const room = shopData.CLOTHING_FITTING_ROOMS[1];
    expect(canvas().clothingFittingFocus).toEqual({ x: room.inside.x, z: room.inside.z });
    expect(angleGap(sim().heading, 0)).toBeLessThan(1e-3);
    expect(screen.getByRole("button", { name: "장바구니에 넣기" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "끝내기" })).toBeNull();
    await press("취소");
    expect(canvas().clothingFittingFocus).toBeNull();
  });
});

// 작업 133 즉석 입어보기 4단계 의심: 옷집을 나간 뒤 늦게 도착한 저장 실패는 옷집 착장을 되살리지 않는다
describe("피팅 저장이 옷집을 나간 뒤 실패할 때", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const stock = require("@/lib/lobby3d/clothing-stock") as typeof import("@/lib/lobby3d/clothing-stock");
  const store = require("@/lib/item-catalog-store") as typeof import("@/lib/item-catalog-store");
  const shopData = require("@/lib/lobby3d/clothing-shop") as typeof import("@/lib/lobby3d/clothing-shop");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const file = (n: string) => ({ url: `/api/catalog/files/${n}.glb`, sha256: n.padEnd(64, "0").slice(0, 64), bytes: 1 });
  afterEach(() => {
    stock.resetClothingShop();
    shopData.setClothingCurtainClosed(null);
  });

  it("마을에서는 실제 착장 그대로다", async () => {
    store.setItemCatalog({
      version: "test-late-fail",
      items: [
        { id: "capOrange", kind: "wearable", name: "주황 야구모자", shopName: "주황 야구모자", description: "", category: "clothes", slot: "hat", price: 60, draw: { attach: "bone", bone: "head", body: 1 }, assets: { model: file("capOrange"), icon: null } },
        { id: "mufflerRed", kind: "wearable", name: "빨강 머플러", shopName: "빨강 머플러", description: "", category: "clothes", slot: "accessory", price: 90, draw: { attach: "bone", bone: "spine", body: 1 }, assets: { model: file("mufflerRed"), icon: null } }
      ]
    });
    let rejectSave: (e: Error) => void = () => {};
    const onSaveLook = jest.fn(() => new Promise<void>((_, reject) => (rejectSave = reject)));
    await screen.unmount();
    mockCanvas.props = null;
    await render(<Lobby3dScreen devPanel={false} ownedItems={["capOrange", "mufflerRed"]} onSaveLook={onSaveLook} />);
    await flushAsync();
    await toClothingDoor();
    const villageLook = canvas().look;
    await press("들어가기");
    await frames(1.2);
    // 진열 상품 앞에서 모자를 입어 본다(옷집 임시 착장 = 피팅 시작 착장에 모자)
    const cap = stock.clothingProduct("capOrange")!;
    await act(async () => {
      canvas().onPointer("down", { point: cap.approach, mark: null, onCharacter: false, onScenery: true, building: null, product: "capOrange" }, 100, 100);
    });
    await act(async () => {
      jest.advanceTimersByTime(30);
      canvas().onPointer("up", null, 100, 100);
    });
    await frames(20);
    await press("입어보기");
    expect(canvas().look?.hat).toBe("capOrange");
    await walkTo(CLOTHING_MARKS.clothingFitting1.approach[0], "clothingFitting1");
    await press("들어가기");
    await frames(6);
    await press("빨강 머플러, 가진 옷");
    await press("장바구니에 넣기");
    expect(onSaveLook).toHaveBeenCalled();
    await frames(6);
    await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
    await press("나가기");
    await frames(1.2);
    expect(area()).toBe("village");
    await act(async () => {
      rejectSave(new Error("fail"));
      await Promise.resolve();
    });
    await flushAsync();
    // 옷집 착장(모자)이 되살아나지 않는다
    expect(canvas().look).toEqual(villageLook);
    expect(canvas().look?.hat ?? null).not.toBe("capOrange");
  });
});

// 작업 133 피팅 회전판: 피팅 창 바깥(testID lobby-sheet-backdrop)을 옆으로 끌면 라룹이가 돈다. 바깥을 눌러도 취소되지 않는다
describe("옷집 피팅 회전판", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const shopData = require("@/lib/lobby3d/clothing-shop") as typeof import("@/lib/lobby3d/clothing-shop");
  const { Dimensions } = require("react-native") as typeof import("react-native");
  /* eslint-enable @typescript-eslint/no-require-imports */
  afterEach(() => shopData.setClothingCurtainClosed(null));

  let startX = 0;
  let prevX = 0;
  let clock = 1000;
  const touch = (x: number, start = false) => {
    if (start) startX = prevX = x;
    // PanResponder는 시각이 같은 움직임을 한 번만 센다(가짜 타이머라 Date.now가 멈춰 있어 직접 늘린다)
    clock += 16;
    const t = clock;
    const entry = { touchActive: true, startPageX: startX, startPageY: 120, startTimeStamp: t, currentPageX: x, currentPageY: 120, currentTimeStamp: t, previousPageX: prevX, previousPageY: 120, previousTimeStamp: t };
    prevX = x;
    const point = { identifier: 0, pageX: x, pageY: 120, locationX: x, locationY: 120, timestamp: t, target: 1 };
    return { persist: () => {}, nativeEvent: { ...point, touches: [point], changedTouches: [point] }, touchHistory: { numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: t, touchBank: [entry] } };
  };

  it("화면 폭의 1/4을 오른쪽으로 끌면 얼굴이 오른쪽으로 90° 돌고(heading +π/2), 안내가 사라지며, 바깥만 눌러서는 취소되지 않는다", async () => {
    await toClothingDoor();
    await press("들어가기");
    await frames(1.2);
    await walkTo(CLOTHING_MARKS.clothingFitting1.approach[0], "clothingFitting1");
    await press("들어가기");
    await frames(6);
    expect(screen.queryAllByText("옆으로 밀어 돌려 보세요", ALL)).toHaveLength(1);
    const backdrop = screen.getByTestId("lobby-sheet-backdrop", ALL);
    const width = Dimensions.get("window").width;
    await act(async () => {
      backdrop.props.onResponderGrant?.(touch(100, true));
      backdrop.props.onResponderMove?.(touch(100 + width / 8));
      backdrop.props.onResponderMove?.(touch(100 + width / 4));
      backdrop.props.onResponderRelease?.(touch(100 + width / 4));
    });
    expect(angleGap(sim().heading, Math.PI / 2)).toBeLessThan(1e-3);
    expect(screen.queryAllByText("옆으로 밀어 돌려 보세요", ALL)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });
});
