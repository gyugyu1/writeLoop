// [spec] qa 테스트(작업 133 08 즉석 입어보기·피팅 카메라, 기능 변경, 모바일): 상품 창 '입어보기'·'장바구니'·'벗기', 옷집 임시 착장,
// 피팅룸 시작 착장·'장바구니에 넣기' 글·나온 뒤 착장, 피팅 중 라룹이가 +z(카메라 쪽)를 봄.
// 기대값은 08-즉석-입어보기-피팅-카메라/01-main-spec.md에서만 가져온다. 3D는 가짜 캔버스로 바꾸고 캔버스 props(look·clothingCurtainClosed)와 sim으로 본다.
// 카메라·앞면 잘라 보기는 이 단계에서 캔버스에 넘기는 prop 이름을 알 수 없어 테스트하지 않는다(폰에서 볼 것).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { CLOTHING_MARKS, MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";
import STOCK from "@/lib/lobby3d/clothing-shop-stock.json";
import { setClothingCurtainClosed } from "@/lib/lobby3d/clothing-shop";
import * as stock from "@/lib/lobby3d/clothing-stock";
import * as catalogStore from "@/lib/item-catalog-store";
import { NO_LOOK, type WearLook } from "@/lib/lobby3d/wear";

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

const ALL = { includeHiddenElements: true } as const;
const PRICES: Record<string, number> = {
  tshirtOrange: 80, shortsNavy: 70, shoesWhite: 90, capOrange: 60, shoesBrown: 90, capBlue: 60, mufflerRed: 90, backpackRed: 120, necklaceGold: 110
};
const stockRows = STOCK.products as unknown as { id: string; category: string; catalogId: string | null }[];

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const look = () => canvas().look as WearLook;
const texts = (value: string) => screen.queryAllByText(value, ALL);
const buttons = (name: string) => screen.queryAllByRole("button", { name });
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
}

async function press(name: string) {
  await fireEvent.press(screen.getAllByRole("button", { name })[0]);
}

/** 상품 창이 열려 있으면 닫는다(열려 있는 동안은 로비를 누를 수 없다). */
async function closeSheetIfOpen() {
  if (buttons("입어보기").length > 0 || buttons("벗기").length > 0) await press("닫기");
}

async function tapProduct(id: string) {
  await closeSheetIfOpen();
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

/** 그 상품 앞에 가서 '입어보기'를 누른다(상품 창이 닫힌다). */
async function tryOn(id: string) {
  await tapProduct(id);
  await press("입어보기");
}

const BASE_LOOK: WearLook = { ...NO_LOOK, top: "tshirtOrange", face: "goggles" };

async function renderShop(props: Partial<React.ComponentProps<typeof Lobby3dScreen>> = {}) {
  await render(<Lobby3dScreen devPanel={false} look={BASE_LOOK} ownedItems={["tshirtOrange", "shortsBrown"]} {...props} />);
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

async function goDown() {
  await walkTo(CLOTHING_MARKS.clothingDown.approach[0], "clothingDown");
  await press("내려가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
}

async function leaveShop() {
  await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
}

async function enterFitting1() {
  await closeSheetIfOpen();
  await walkTo(CLOTHING_MARKS.clothingFitting1.approach[0], "clothingFitting1");
  await press("들어가기");
  await frames(6);
}

const rowName = (id: string, tag: string) => `${stock.clothingProduct(id)!.name}, ${tag}`;

function wearable(id: string, slot: string, price: number | null) {
  const file = { url: `/api/catalog/files/${id}.glb`, sha256: id.padEnd(64, "0").slice(0, 64), size: 1 };
  return {
    id, kind: "wearable" as const, name: id, shopName: id, description: "", category: price === null ? null : ("clothes" as const), slot, price,
    draw: { attach: "bone", bone: "head", body: 1 }, assets: { model: file, icon: null }
  };
}

let catalogVersion = 0;
function setCatalog(without: string[] = []) {
  const items = stockRows
    .map((p) => wearable(p.catalogId ?? p.id, p.category, p.catalogId ? PRICES[p.catalogId] : null))
    .concat(wearable("shortsBrown", "bottom", 70), wearable("capGreen", "hat", 60))
    .filter((item) => !without.includes(item.id));
  catalogStore.setItemCatalog({ version: `spec-tryon-${++catalogVersion}`, items: items as never });
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  setCatalog();
});

afterEach(() => {
  setClothingCurtainClosed(null);
  stock.resetClothingShop();
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("[spec] 상품 창 버튼(명세 1)", () => {
  it("버튼은 '입어보기'·'장바구니'·'닫기'이고 '장바구니 담기'는 없다. 이름·가격 글은 그대로", async () => {
    await renderShop();
    await tapProduct("capOrange");
    expect(buttons("입어보기").length).toBeGreaterThan(0);
    expect(buttons("장바구니").length).toBeGreaterThan(0);
    expect(buttons("닫기").length).toBeGreaterThan(0);
    expect(texts("장바구니 담기")).toHaveLength(0);
    expect(texts("60룹").length).toBeGreaterThan(0);
  });

  it("'장바구니'는 이전 '장바구니 담기'와 같다: 담고 '장바구니에 담았어요' 안내, 창이 닫힌다", async () => {
    await renderShop();
    await tapProduct("capOrange");
    await press("장바구니");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    expect(texts("장바구니에 담았어요").length).toBeGreaterThan(0);
    expect(buttons("입어보기")).toHaveLength(0);
  });

  it("'장바구니'는 가진 옷이면 막히고 '이미 가진 옷이에요'를 보인다(그대로)", async () => {
    await renderShop({ ownedItems: ["tshirtOrange", "capOrange"] });
    await tapProduct("capOrange");
    expect(texts("이미 가진 옷이에요").length).toBeGreaterThan(0);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual([]);
  });

  it("'장바구니'는 미등록 상품이면 막히고 '판매 준비 중인 옷이에요'를 보인다(그대로)", async () => {
    await renderShop();
    await tapProduct("wear-top-kiln-jacket");
    expect(texts("판매 준비 중인 옷이에요").length).toBeGreaterThan(0);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual([]);
  });
});

describe("[spec] 입어보기·벗기(명세 1)", () => {
  it("'입어보기'는 그 부위에 입히고 창을 닫는다. 다른 부위는 그대로, 담기·저장은 없다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    expect(look()).toEqual(BASE_LOOK);
    await tryOn("capOrange");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    expect(buttons("입어보기")).toHaveLength(0);
    expect(stock.clothingCart()).toEqual([]);
    expect(onSaveLook).not.toHaveBeenCalled();
  });

  it("가진 옷도, 등록 안 된 옷도 입어 볼 수 있다", async () => {
    await renderShop({ ownedItems: ["tshirtOrange", "capOrange"] });
    await tryOn("capOrange");
    expect(look().hat).toBe("capOrange");
    await tryOn("wear-top-kiln-jacket");
    expect(look().top).toBe("wear-top-kiln-jacket");
  });

  it("같은 부위는 바뀌고 다른 부위는 조합된다", async () => {
    await renderShop();
    await tryOn("capOrange");
    await tryOn("shoesWhite");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange", shoes: "shoesWhite" });
    await tryOn("capBlue");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capBlue", shoes: "shoesWhite" });
  });

  it("그리기 정보가 없는 옷은 막고 '입어 볼 수 없는 옷이에요'를 안내하며 착장은 그대로다", async () => {
    setCatalog(["capBlue"]);
    await renderShop();
    await tapProduct("capBlue");
    await press("입어보기");
    expect(texts("입어 볼 수 없는 옷이에요").length).toBeGreaterThan(0);
    expect(look()).toEqual(BASE_LOOK);
  });

  it("이미 입고 있는 상품이면 버튼이 '벗기'이고 '입어보기'는 없다", async () => {
    await renderShop();
    await tryOn("capOrange");
    await tapProduct("capOrange");
    expect(buttons("벗기").length).toBeGreaterThan(0);
    expect(buttons("입어보기")).toHaveLength(0);
  });

  it("'벗기'는 그 부위를 옷집에 들어오기 전 옷으로 돌린다(바로 앞에 입었던 옷이 아니다)", async () => {
    await renderShop({ look: { ...BASE_LOOK, hat: "capGreen" }, ownedItems: ["tshirtOrange", "capGreen"] });
    expect(look().hat).toBe("capGreen");
    await tryOn("capOrange");
    await tryOn("capBlue");
    expect(look().hat).toBe("capBlue");
    await tapProduct("capBlue");
    await press("벗기");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capGreen" });
  });

  it("들어오기 전에 그 부위가 비어 있었으면 '벗기'로 비운다", async () => {
    await renderShop();
    await tryOn("capOrange");
    await tapProduct("capOrange");
    await press("벗기");
    expect(look()).toEqual(BASE_LOOK);
  });
});

describe("[spec] 옷집 임시 착장(명세 2)", () => {
  it("들어갈 때 실제 착장으로 시작한다", async () => {
    await renderShop({ look: { ...BASE_LOOK, hat: "capGreen" }, ownedItems: ["tshirtOrange", "capGreen"] });
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capGreen" });
  });

  it("층을 오가도 유지된다", async () => {
    await renderShop();
    await tryOn("capOrange");
    await goUp();
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    await goDown();
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
  });

  it("옷집을 나가면 실제 착장으로 돌아가고, 서버·옷장에 저장하지 않는다. 다시 들어오면 실제 착장에서 시작한다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await tryOn("capOrange");
    await tryOn("shoesWhite");
    await leaveShop();
    expect(look()).toEqual(BASE_LOOK);
    expect(onSaveLook).not.toHaveBeenCalled();
    await walkTo(VILLAGE_PLACES.clothingShop.approach[0], "clothingShop");
    await press("들어가기");
    await frames(1.2);
    expect(area()).toBe("clothing1");
    expect(look()).toEqual(BASE_LOOK);
  });

  it("진열을 해제한 상품을 입고 있었으면 그 부위는 들어오기 전 옷으로 돌아간다", async () => {
    await renderShop({ look: { ...BASE_LOOK, hat: "capGreen" }, ownedItems: ["tshirtOrange", "capGreen"] });
    await tryOn("capOrange");
    await tryOn("shoesWhite");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange", shoes: "shoesWhite" });
    await act(async () => {
      stock.setClothingDisplayed("capOrange", false);
    });
    await flushAsync();
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capGreen", shoes: "shoesWhite" });
  });
});

describe("[spec] 피팅룸 시작·버튼·나온 뒤(명세 3·5·6)", () => {
  it("피팅 착장은 옷집 임시 착장에서 시작하고, 버튼은 '취소'와 '장바구니에 넣기'다('끝내기'는 없다)", async () => {
    await renderShop();
    await tryOn("capOrange");
    await enterFitting1();
    expect(canvas().clothingCurtainClosed).toBe(1);
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    expect(buttons("장바구니에 넣기").length).toBeGreaterThan(0);
    expect(buttons("취소").length).toBeGreaterThan(0);
    expect(buttons("끝내기")).toHaveLength(0);
  });

  it("'취소'는 들어오기 전(옷집 임시 착장)으로 돌리고 담기·저장이 없다. 옷집에는 임시 착장이 남는다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await tryOn("capOrange");
    await enterFitting1();
    await press(rowName("capBlue", "60룹"));
    await press("한국군 밀리터리");
    await press("취소");
    await frames(6);
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(stock.clothingCart()).toEqual([]);
    expect(onSaveLook).not.toHaveBeenCalled();
  });

  it("'장바구니에 넣기': 안 가진 등록 상품은 장바구니에 담고 그 부위는 들어오기 전 옷(임시 착장)으로, 안내는 '장바구니에 1개 담았어요'", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await tryOn("capOrange");
    await enterFitting1();
    await press(rowName("shoesWhite", "90룹"));
    await press("장바구니에 넣기");
    await flushAsync();
    expect(stock.clothingCart()).toEqual(["shoesWhite"]);
    expect(texts("장바구니에 1개 담았어요").length).toBeGreaterThan(0);
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    expect(onSaveLook).not.toHaveBeenCalled();
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
  });

  it("'장바구니에 넣기': 가진 옷으로 바꾼 착장은 입은 채 옷장 저장에 넘어간다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await enterFitting1();
    await press("shortsBrown, 가진 옷");
    await press("장바구니에 넣기");
    await flushAsync();
    expect(onSaveLook).toHaveBeenCalledTimes(1);
    expect(onSaveLook).toHaveBeenCalledWith({ ...BASE_LOOK, bottom: "shortsBrown" });
  });

  it("'장바구니에 넣기'로 나온 뒤 옷집을 나가면 실제 착장이다", async () => {
    await renderShop();
    await tryOn("capOrange");
    await enterFitting1();
    await press("장바구니에 넣기");
    await frames(6);
    await leaveShop();
    expect(look()).toEqual(BASE_LOOK);
  });
});

describe("[spec] 피팅 중 라룹이 방향(명세 4)", () => {
  it("커튼이 닫힌 뒤 라룹이가 카메라 쪽(+z, heading 0)을 보고, 커튼 닫힘은 그대로다", async () => {
    await renderShop();
    await enterFitting1();
    await frames(2);
    expect(canvas().clothingCurtainClosed).toBe(1);
    expect(angleGap(sim().heading, 0)).toBeLessThan(1e-2);
  });

  it("2층 피팅룸에서도 +z를 본다", async () => {
    await renderShop();
    await goUp();
    await walkTo(CLOTHING_MARKS.clothingFitting2.approach[0], "clothingFitting2");
    await press("들어가기");
    await frames(8);
    expect(canvas().clothingCurtainClosed).toBe(2);
    expect(angleGap(sim().heading, 0)).toBeLessThan(1e-2);
  });

  it("피팅 중 입는 옷이 바뀌면 캔버스에 넘기는 look이 바로 바뀐다", async () => {
    await renderShop();
    await enterFitting1();
    await press(rowName("capBlue", "60룹"));
    expect(look().hat).toBe("capBlue");
  });
});

describe("[spec] 옷장 저장 기준(03 결정 2)과 카메라 초점 prop", () => {
  it("안 가진 옷을 입어 본 채 가진 옷으로 바꾸고 넣으면, 실제 착장에 가진 옷만 얹어 저장하고 시착 옷은 저장하지 않는다. 옷집 안에는 시착이 남는다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await tryOn("capOrange");
    await enterFitting1();
    await press("shortsBrown, 가진 옷");
    await press("장바구니에 넣기");
    await flushAsync();
    expect(onSaveLook).toHaveBeenCalledTimes(1);
    expect(onSaveLook).toHaveBeenCalledWith({ ...BASE_LOOK, bottom: "shortsBrown" });
    expect(stock.clothingCart()).toEqual([]);
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange", bottom: "shortsBrown" });
  });

  it("가진 옷을 벗은 부위도 실제 착장에 반영해 저장하고 시착 옷은 저장하지 않는다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await tryOn("capOrange");
    await enterFitting1();
    await press(rowName("tshirtOrange", "가진 옷"));
    expect(look().top).toBeNull();
    await press("장바구니에 넣기");
    await flushAsync();
    expect(onSaveLook).toHaveBeenCalledTimes(1);
    expect(onSaveLook).toHaveBeenCalledWith({ ...BASE_LOOK, top: null });
  });

  it("피팅 결과가 실제 착장과 같으면(시착 옷만 있으면) 저장하지 않는다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await tryOn("capOrange");
    await enterFitting1();
    await press("장바구니에 넣기");
    await flushAsync();
    expect(onSaveLook).not.toHaveBeenCalled();
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
  });

  it("피팅 중에는 캔버스에 카메라 초점(clothingFittingFocus)을 넘기고 나오면 비운다", async () => {
    await renderShop();
    expect(canvas().clothingFittingFocus ?? null).toBeNull();
    await enterFitting1();
    expect(canvas().clothingFittingFocus ?? null).not.toBeNull();
    await press("취소");
    await frames(6);
    expect(canvas().clothingFittingFocus ?? null).toBeNull();
  });
});
