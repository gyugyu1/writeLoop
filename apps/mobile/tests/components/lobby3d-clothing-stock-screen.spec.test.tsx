// [spec] qa 테스트(작업 133 ② 옷집 진열·상품 선택·장바구니 담기): 로비 화면에서 상품 누르기·이름표·상품 창·담기·장바구니 N·진열 해제·가진 옷·시험판 버튼.
// 기대값은 03-진열-상품선택-장바구니/02-qa-scenarios.md(S번호)에서만 가져온다. 3D 그리기는 가짜 캔버스로 바꾸고, 누르기는 캔버스가 넘기는 onPointer로 흉내 낸다.
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

describe("[spec] 상품 누르기와 선택(S13·S15·S16·S17)", () => {
  it("S13: 상품을 누르면 그 서는 자리로 걸어가고, 걷는 동안은 선택이 없고 도착하면 선택·상품 창이 열린다", async () => {
    await enterClothing();
    await tapProductNoWait("tshirtOrange");
    expect(canvas().clothingSelected ?? null).toBeNull();
    expect(texts("장바구니 담기")).toHaveLength(0);
    expect(texts("장바구니")).toHaveLength(0);
    await frames(20);
    expect(dist(pos(), stock.clothingProduct("tshirtOrange")!.approach)).toBeLessThan(0.1);
    expect(canvas().clothingSelected).toBe("tshirtOrange");
    expect(texts("장바구니").length).toBeGreaterThan(0);
  });

  it("S15: 상품이 아닌 집기(상품 정보 없는 누르기)를 누르면 선택도 상품 창도 없다", async () => {
    await enterClothing();
    const near = CLOTHING_NODES.fromUpper;
    await walkTo({ x: near.x, z: near.z }, null);
    expect(canvas().clothingSelected ?? null).toBeNull();
    expect(texts("장바구니 담기")).toHaveLength(0);
    expect(texts("장바구니")).toHaveLength(0);
  });

  it("S16: 상품 창을 닫고 다른 상품을 누르면 선택이 그 상품으로 옮겨 가고 이름표는 하나뿐이다", async () => {
    await enterClothing();
    await tapProduct("capOrange");
    expect(canvas().clothingSelected).toBe("capOrange");
    await press("닫기");
    await tapProduct("mufflerRed");
    expect(canvas().clothingSelected).toBe("mufflerRed");
    expect(textsContaining("빨강 머플러", "90룹")).toHaveLength(1);
    expect(textsContaining("주황 야구모자")).toHaveLength(0);
  });

  it("S17: 층을 옮기면 선택이 풀리고 이름표·상품 창이 사라진다", async () => {
    await enterClothing();
    await tapProduct("capOrange");
    expect(canvas().clothingSelected).toBe("capOrange");
    await press("닫기");
    await goUp();
    expect(canvas().clothingSelected ?? null).toBeNull();
    expect(textsContaining("주황 야구모자")).toHaveLength(0);
    expect(texts("장바구니 담기")).toHaveLength(0);
    expect(texts("장바구니")).toHaveLength(0);
  });

  it("S17: 옷집을 나가도 선택이 풀린다", async () => {
    await enterClothing();
    await tapProduct("capOrange");
    await press("닫기");
    await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
    await press("나가기");
    await frames(1.2);
    expect(area()).toBe("village");
    expect(canvas().clothingSelected ?? null).toBeNull();
  });
});

describe("[spec] 이름표와 상품 창(S19~S21, S24~S29)", () => {
  it("S19·S24·S25·S29: 등록 상품은 이름·'80룹'이 보이고 담으면 '장바구니 담았어요' 안내와 '장바구니 1'. 닫기는 창을 닫는다", async () => {
    await enterClothing();
    await tapProduct("tshirtOrange");
    expect(textsContaining("주황 티셔츠", "80룹").length).toBeGreaterThan(0);
    expect(texts("80룹").length).toBeGreaterThan(0);
    expect(texts("닫기").length).toBeGreaterThan(0);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual(["tshirtOrange"]);
    expect(texts("장바구니에 담았어요").length).toBeGreaterThan(0);
    expect(texts("장바구니 1")).toHaveLength(1);
  });

  it("S19: 등록 9종의 이름표 가격이 서버 가격과 같다(장바구니 담기 전 이름표)", async () => {
    await enterClothing();
    for (const id of ["capOrange", "shoesWhite", "backpackRed", "capBlue"]) {
      await tapProduct(id);
      expect({ id, found: textsContaining(stock.clothingProduct(id)!.name, `${PRICES[id]}룹`).length > 0 }).toEqual({ id, found: true });
      await press("닫기");
    }
  });

  it("S20·S26: 미등록 상품은 이름표 '판매 준비 중', 창에 '판매 준비 중인 옷이에요', 담을 수 없다", async () => {
    await enterClothing();
    await tapProduct("wear-top-kiln-jacket");
    expect(textsContaining("코랄 워크 재킷", "판매 준비 중").length).toBeGreaterThan(0);
    expect(texts("판매 준비 중인 옷이에요")).toHaveLength(1);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual([]);
    expect(texts("장바구니 1")).toHaveLength(0);
  });

  it("S28: 이미 담은 상품을 다시 열면 '장바구니에 담았어요'가 보이고 다시 담기지 않는다", async () => {
    await enterClothing();
    await tapProduct("capOrange");
    await press("장바구니");
    await tapProduct("capOrange");
    expect(texts("장바구니에 담았어요").length).toBeGreaterThan(0);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
  });

  it("S29: '닫기'를 누르면 상품 창이 닫히고 장바구니는 그대로다", async () => {
    await enterClothing();
    await tapProduct("capOrange");
    await press("장바구니");
    await tapProduct("shortsNavy");
    await press("닫기");
    expect(texts("장바구니 담기")).toHaveLength(0);
    expect(texts("장바구니")).toHaveLength(0);
    expect(stock.clothingCart()).toEqual(["capOrange"]);
  });
});

describe("[spec] 가진 옷(S21·S27·S44·S45)", () => {
  it("S21·S27·S44: 옷장에 있는 옷은 이름표가 '가진 옷', 창에 '이미 가진 옷이에요', 담을 수 없다", async () => {
    await enterClothing({ ownedItems: ["tshirtOrange"] });
    await tapProduct("tshirtOrange");
    expect(textsContaining("주황 티셔츠", "가진 옷").length).toBeGreaterThan(0);
    expect(textsContaining("주황 티셔츠", "80룹")).toHaveLength(0);
    expect(texts("이미 가진 옷이에요")).toHaveLength(1);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual([]);
  });

  it("S45: 옷장을 모르면(null) 가진 옷이 없는 것으로 보고 담을 수 있다", async () => {
    await enterClothing({ ownedItems: null });
    await tapProduct("tshirtOrange");
    expect(texts("이미 가진 옷이에요")).toHaveLength(0);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual(["tshirtOrange"]);
  });
});

describe("[spec] 장바구니 표시와 진열 해제(S35~S37, S41~S42)", () => {
  it("S41·S42: 담은 개수만큼 '장바구니 N'이 보이고 0이면 보이지 않는다. 층을 오가도 유지된다", async () => {
    await enterClothing();
    expect(textsContaining("장바구니 ")).toHaveLength(0);
    await tapProduct("capOrange");
    await press("장바구니");
    await tapProduct("shortsNavy");
    await press("장바구니");
    expect(texts("장바구니 2")).toHaveLength(1);
    await goUp();
    expect(texts("장바구니 2")).toHaveLength(1);
    expect(stock.clothingCart()).toEqual(["capOrange", "shortsNavy"]);
  });

  it("S35·S36·S42: 선택한 상품의 진열을 끄면 선택이 풀리고 창이 닫히고, 담겨 있었으면 장바구니에서 빠져 '장바구니 N'이 사라진다", async () => {
    await enterClothing();
    await tapProduct("capOrange");
    await press("장바구니");
    await tapProduct("capOrange");
    expect(canvas().clothingSelected).toBe("capOrange");
    await act(async () => {
      stock.setClothingDisplayed("capOrange", false);
    });
    expect(canvas().clothingSelected ?? null).toBeNull();
    expect(texts("장바구니 담기")).toHaveLength(0);
    expect(texts("장바구니")).toHaveLength(0);
    expect(texts("장바구니 1")).toHaveLength(0);
    expect(stock.clothingCart()).toEqual([]);
    await act(async () => {
      stock.setClothingDisplayed("capOrange", true);
    });
    expect(stock.clothingCart()).toEqual([]);
  });

  it("S07: 옷집을 나갔다 다시 들어와도 장바구니와 진열 여부가 유지된다", async () => {
    await enterClothing();
    await tapProduct("capOrange");
    await press("장바구니");
    stock.setClothingDisplayed("capBlue", false);
    await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
    await press("나가기");
    await frames(1.2);
    await press("들어가기");
    await frames(1.2);
    expect(area()).toBe("clothing1");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    expect(stock.clothingDisplayed().capBlue).toBe(false);
    expect(texts("장바구니 1")).toHaveLength(1);
  });
});

describe("[spec] 개발 화면 시험판(S39·S46)", () => {
  it("S39: 시험판에 상품별 '진열' 버튼이 22개(층과 이름) 있고 누르면 진열이 꺼지고 켜진다. 서버 호출은 없다", async () => {
    await render(<Lobby3dScreen devPanel />);
    await flushAsync();
    await fireEvent.press(screen.getByText("시험판 펴기"));
    for (const p of stock.CLOTHING_PRODUCTS) {
      expect({ id: p.id, found: texts(`${p.floor}층 ${p.name}`).length > 0 }).toEqual({ id: p.id, found: true });
    }
    expect(stock.CLOTHING_PRODUCTS).toHaveLength(22);
    await fireEvent.press(screen.getByText("1층 주황 야구모자"));
    expect(stock.clothingDisplayed().capOrange).toBe(false);
    await fireEvent.press(screen.getByText("1층 주황 야구모자"));
    expect(stock.clothingDisplayed().capOrange).toBe(true);
  });

  it("S39: 홈 화면(시험판 없음)에는 상품별 진열 버튼이 없다", async () => {
    await render(<Lobby3dScreen devPanel={false} />);
    await flushAsync();
    expect(texts("1층 주황 야구모자")).toHaveLength(0);
  });
});
