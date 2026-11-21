// [spec] qa 테스트(작업 133 06 피팅룸 양층): 로비 화면에서 두 층 피팅룸 들어가기·피팅 창 목록·입기·세트·취소·끝내기.
// 기대값은 06-피팅룸-양층/02-qa-scenarios.md(B번호)와 앱 자산 clothing-shop-layout.json·clothing-shop-stock.json의 값에서만 가져온다.
// 3D 그리기는 가짜 캔버스로 바꾸고 걷기·누르기는 캔버스 props(onPointer·onFrame)로 흉내 낸다. 구현에서 읽은 것은 부르는 방법
// (캔버스 props의 look·clothingCurtainClosed, 화면 props ownedItems·onSaveLook, 장소 id clothingFitting1·2)뿐이다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { CLOTHING_MARKS, MARKS, applyArea, findPath, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";
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
const OFFSET = { x: 9, z: 8 };
const PRICES: Record<string, number> = {
  tshirtOrange: 80, shortsNavy: 70, shoesWhite: 90, capOrange: 60, shoesBrown: 90, capBlue: 60, mufflerRed: 90, backpackRed: 120, necklaceGold: 110
};
type Anchors = Record<string, { positionXYZ: number[]; rotationYDegrees: number }>;
const anchor = (floor: 1 | 2, key: string) => (LAYOUT.floors[String(floor) as "1" | "2"].anchors as Anchors)[key];
const appPoint = (floor: 1 | 2, key: string): FloorPoint => ({ x: anchor(floor, key).positionXYZ[0] + OFFSET.x, z: anchor(floor, key).positionXYZ[2] + OFFSET.z });
/** 그 층 피팅룸 앞에서 방 안까지 걸어갈 길이 있는지(커튼이 닫혀 입구가 막히면 없다). */
const roomReachable = (floor: 1 | 2) => findPath(appPoint(floor, "FittingApproach1"), [appPoint(floor, "Fitting1")]) !== null;
const stockRows = STOCK.products as unknown as { id: string; nameKO: string; category: string; catalogId: string | null; floor: number }[];
const UNREGISTERED = stockRows.filter((p) => p.catalogId === null).map((p) => p.id);

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const texts = (value: string) => screen.queryAllByText(value, ALL);
const look = () => canvas().look as WearLook;

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

/** 줄 이름: 상품 이름과 표시. */
const rowName = (id: string, tag: string) => `${stock.clothingProduct(id)!.name}, ${tag}`;
const rowCount = () => screen.queryAllByRole("button", { name: /, (판매 준비 중|가진 옷|\d+룹)$/ }).length;

const BASE_LOOK: WearLook = { ...NO_LOOK, top: "tshirtOrange", face: "goggles" };

async function renderHome(props: Partial<React.ComponentProps<typeof Lobby3dScreen>> = {}) {
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

/** 그 층 피팅룸 앞까지 가서 '들어가기'를 누르고 방 안에 설 때까지 기다린다. */
async function enterFitting(floor: 1 | 2) {
  const id = floor === 1 ? "clothingFitting1" : "clothingFitting2";
  await walkTo(CLOTHING_MARKS[id].approach[0], id);
  expect(sim().snapshot(Date.now()).bubbleText).toBe("피팅룸에 들어갈까?");
  await press("들어가기");
  await frames(6);
}

async function enterHomeFitting(floor: 1 | 2, props: Partial<React.ComponentProps<typeof Lobby3dScreen>> = {}) {
  await renderHome(props);
  if (floor === 2) await goUp();
  await enterFitting(floor);
}

function wearable(id: string, slot: string, price: number | null) {
  const file = { url: `/api/catalog/files/${id}.glb`, sha256: id.padEnd(64, "0").slice(0, 64), size: 1 };
  return {
    id, kind: "wearable" as const, name: id, shopName: id, description: "", category: price === null ? null : ("clothes" as const), slot, price,
    draw: { attach: "bone", bone: "head", body: 2 }, assets: { model: file, icon: null }
  };
}

let catalogVersion = 0;
function setCatalog(without: string[] = []) {
  const items = stockRows
    .map((p) => wearable(p.catalogId ?? p.id, p.category, p.catalogId ? PRICES[p.catalogId] : null))
    .concat(wearable("shortsBrown", "bottom", 70), wearable("capGreen", "hat", 60))
    .filter((item) => !without.includes(item.id));
  catalogStore.setItemCatalog({ version: `spec-fitting-${++catalogVersion}`, items: items as never });
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
  // 피팅 중에 끝난 시험이 닫힌 커튼(입구 막음)을 다음 시험에 남기지 않게 한다
  setClothingCurtainClosed(null);
  stock.resetClothingShop();
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("[spec] 피팅룸 장소와 들어가기(B1~B5, B31)", () => {
  it("B1·B2·B3·B4·B5·B31: 1층 피팅룸 이름표, 앞에서 안내, 들어가면 방 안 노드에 그 방향으로 서고 커튼이 닫히고 입구가 막히고 로비를 누를 수 없다", async () => {
    await renderHome();
    expect(texts("피팅룸").length).toBeGreaterThan(0);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(roomReachable(1)).toBe(true);
    await enterFitting(1);
    const inside = appPoint(1, "Fitting1");
    expect(dist(pos(), inside)).toBeLessThan(0.05);
    const gap = Math.abs(((((sim().heading - 0 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
    expect(gap).toBeLessThan(1e-3);
    expect(canvas().clothingCurtainClosed).toBe(1);
    expect(roomReachable(1)).toBe(false);
      expect(screen.queryAllByRole("button", { name: "장바구니에 넣기" }).length).toBeGreaterThan(0);
    // 피팅 중 로비를 눌러도 가지 않는다
    const before = pos();
    await walkTo(appPoint(1, "Fitting1"), null);
    await walkTo({ x: before.x + 1.5, z: before.z + 1.5 }, null);
    expect(dist(pos(), before)).toBeLessThan(1e-6);
    expect(area()).toBe("clothing1");
  });

  it("B1·B3·B4: 2층 피팅룸은 2층 그 방(F2_Fitting1)에 서고 2층 커튼만 닫히고 2층 입구가 막힌다", async () => {
    await renderHome();
    await goUp();
    expect(texts("피팅룸").length).toBeGreaterThan(0);
    expect(roomReachable(2)).toBe(true);
    await enterFitting(2);
    expect(dist(pos(), appPoint(2, "Fitting1"))).toBeLessThan(0.05);
    expect(canvas().clothingCurtainClosed).toBe(2);
    expect(roomReachable(2)).toBe(false);
    const before = pos();
    await walkTo({ x: before.x - 1.2, z: before.z + 1.2 }, null);
    expect(dist(pos(), before)).toBeLessThan(1e-6);
    expect(area()).toBe("clothing2");
  });
});

describe("[spec] 피팅 목록(B6~B11)", () => {
  it("B6·B7·B10: 모두 진열이면 어느 방에서 열어도 양 층 22종이 한 줄씩이고(가진 옷은 한 번), 부위 이름과 표시가 명세대로다", async () => {
    await enterHomeFitting(1);
    // 22종 + 가진 옷 중 진열되지 않은 shortsBrown(가진 옷). 가진 tshirtOrange는 진열 상품과 같은 옷이라 한 번만 나온다
    expect(rowCount()).toBe(23);
    for (const label of ["모자", "상의", "하의", "신발", "얼굴장식", "등장식", "액세서리"]) expect({ label, n: texts(label).length > 0 }).toEqual({ label, n: true });
    for (const p of stockRows) {
      const id = p.catalogId ?? p.id;
      const tag = p.catalogId === null ? "판매 준비 중" : id === "tshirtOrange" ? "가진 옷" : `${PRICES[id]}룹`;
      expect({ id, found: screen.queryAllByRole("button", { name: rowName(p.id, tag) }).length }).toEqual({ id, found: 1 });
    }
    // 2층 상품이 1층 방에서도 나온다
    expect(screen.queryAllByRole("button", { name: rowName("wear-hat-field-cap", "판매 준비 중") })).toHaveLength(1);
  });

  it("B6: 2층 방에서 열어도 같은 목록이다(1층 상품 포함)", async () => {
    await enterHomeFitting(2);
    expect(rowCount()).toBe(23);
    expect(screen.queryAllByRole("button", { name: rowName("wear-hat-breakwater-bucket", "판매 준비 중") })).toHaveLength(1);
    expect(screen.queryAllByRole("button", { name: rowName("necklaceGold", "110룹") })).toHaveLength(1);
  });

  it("B8: 진열을 끈 상품은 목록에 없고 다른 상품은 그대로다", async () => {
    stock.setClothingDisplayed("capOrange", false);
    stock.setClothingDisplayed("wear-top-kiln-jacket", false);
    await enterHomeFitting(1);
    expect(screen.queryAllByRole("button", { name: rowName("capOrange", "60룹") })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: rowName("wear-top-kiln-jacket", "판매 준비 중") })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: rowName("capBlue", "60룹") })).toHaveLength(1);
    expect(rowCount()).toBe(21);
  });

  it("B9: 진열되지 않은 가진 옷도 '가진 옷'으로 나온다", async () => {
    await enterHomeFitting(1, { ownedItems: ["capGreen"] });
    expect(screen.queryAllByRole("button", { name: "capGreen, 가진 옷" })).toHaveLength(1);
  });

  it("B10: 진열 상품과 같은 옷을 가졌으면 한 번만 나오고 '가진 옷'이다", async () => {
    await enterHomeFitting(1, { ownedItems: ["capOrange"] });
    expect(screen.queryAllByRole("button", { name: rowName("capOrange", "가진 옷") })).toHaveLength(1);
    expect(screen.queryAllByRole("button", { name: rowName("capOrange", "60룹") })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /capOrange/ })).toHaveLength(0);
  });

  it("B11: 서버 목록에 그리기 정보가 없는 옷은 목록에 없다", async () => {
    setCatalog(["wear-top-kiln-jacket", "capBlue"]);
    await enterHomeFitting(1);
    expect(screen.queryAllByRole("button", { name: rowName("wear-top-kiln-jacket", "판매 준비 중") })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: rowName("capBlue", "60룹") })).toHaveLength(0);
    expect(rowCount()).toBe(21);
  });
});

describe("[spec] 입기·벗기·세트(B12~B19, B20)", () => {
  it("B12·B13·B14: 줄을 누르면 그 부위만 바뀌고, 같은 부위의 다른 줄은 바꾸고, 입은 줄을 다시 누르면 벗는다", async () => {
    await enterHomeFitting(1);
    expect(look()).toEqual(BASE_LOOK);
    await press(rowName("capOrange", "60룹"));
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    await press(rowName("capBlue", "60룹"));
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capBlue" });
    await press(rowName("capBlue", "60룹"));
    expect(look()).toEqual(BASE_LOOK);
    await press(rowName("wear-face-honey-panto", "판매 준비 중"));
    expect(look().face).toBe("wear-face-honey-panto");
    expect(look().top).toBe("tshirtOrange");
  });

  it("B16~B18: 피팅 창 위에 세트 버튼 둘이 있고, 누르면 구성품을 각 부위에 입히되 다른 부위는 그대로다", async () => {
    await enterHomeFitting(1);
    expect(screen.queryAllByRole("button", { name: "항구 산책 · 마린" })).toHaveLength(1);
    expect(screen.queryAllByRole("button", { name: "한국군 밀리터리" })).toHaveLength(1);
    await press("항구 산책 · 마린");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "wear-hat-breakwater-bucket", top: "wear-top-tide-sailor", bottom: "wear-bottom-jetty-denim", shoes: "shoesWhite" });
    await press("한국군 밀리터리");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "wear-hat-field-cap", top: "wear-top-field-blouse", bottom: "wear-bottom-field-trousers", shoes: "wear-shoe-combat-boot" });
  });

  it("B19: 진열을 끈 구성품은 건너뛰고 그 부위는 바뀌지 않는다", async () => {
    stock.setClothingDisplayed("wear-top-tide-sailor", false);
    await enterHomeFitting(2);
    await press("항구 산책 · 마린");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "wear-hat-breakwater-bucket", bottom: "wear-bottom-jetty-denim", shoes: "shoesWhite" });
  });

  it("B20: 피팅 중 착장을 바꿔도 저장 호출이 없고 기기 저장소 키도 늘지 않는다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderHome({ onSaveLook });
    const keysBefore = await AsyncStorage.getAllKeys();
    await enterFitting(1);
    await press(rowName("capOrange", "60룹"));
    await press("항구 산책 · 마린");
    expect(onSaveLook).not.toHaveBeenCalled();
    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual([...keysBefore].sort());
  });
});

describe("[spec] 취소·끝내기(B21~B29, B32)", () => {
  it("B21: 1층에서 여러 부위를 입고 취소하면 들어오기 전 착장·커튼 열림·입구 풀림·방 앞으로 나옴·창 닫힘이고, 담기도 저장도 없다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await enterHomeFitting(1, { onSaveLook });
    await press(rowName("capOrange", "60룹"));
    await press("항구 산책 · 마린");
    await press("취소");
    expect(canvas().look).toEqual(BASE_LOOK);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(roomReachable(1)).toBe(true);
    await frames(6);
    expect(dist(pos(), appPoint(1, "FittingApproach1"))).toBeLessThan(0.1);
    expect(screen.queryAllByRole("button", { name: "끝내기" })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "장바구니에 넣기" })).toHaveLength(0);
    expect(stock.clothingCart()).toEqual([]);
    expect(onSaveLook).not.toHaveBeenCalled();
  });

  it("B21: 2층에서 취소하면 2층 방 앞(F2_FittingApproach1)으로 나온다", async () => {
    await enterHomeFitting(2);
    await press("한국군 밀리터리");
    await press("취소");
    await frames(6);
    expect(canvas().look).toEqual(BASE_LOOK);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(dist(pos(), appPoint(2, "FittingApproach1"))).toBeLessThan(0.1);
  });

  it("B22·B27: 가지지 않은 등록 상품 둘을 입고 끝내면 장바구니에 둘 담고 그 부위는 들어오기 전 옷으로 돌아오며 '장바구니에 2개 담았어요'가 안내된다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await enterHomeFitting(1, { onSaveLook });
    await press(rowName("capOrange", "60룹"));
    await press(rowName("shoesWhite", "90룹"));
    await press("장바구니에 넣기");
    await flushAsync();
    expect([...stock.clothingCart()].sort()).toEqual(["capOrange", "shoesWhite"]);
    expect(texts("장바구니에 2개 담았어요").length).toBeGreaterThan(0);
    expect(canvas().look).toEqual(BASE_LOOK);
    expect(onSaveLook).not.toHaveBeenCalled();
  });

  it("B22·B27: 하나만 담으면 '장바구니에 1개 담았어요'", async () => {
    await enterHomeFitting(1);
    await press(rowName("capOrange", "60룹"));
    await press("장바구니에 넣기");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    expect(texts("장바구니에 1개 담았어요").length).toBeGreaterThan(0);
  });

  it("B23: 이미 장바구니에 있는 상품을 입고 끝내도 한 번만 있고 담았다는 안내가 없다", async () => {
    stock.addToClothingCart("capOrange");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    await enterHomeFitting(1);
    await press(rowName("capOrange", "60룹"));
    await press("장바구니에 넣기");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    expect(screen.queryAllByText(/장바구니에 \d+개 담았어요/, ALL)).toHaveLength(0);
  });

  it("B24·B27: 미등록 옷만 입고 끝내면 담지 않고 그 부위는 들어오기 전 옷이며 담았다는 안내가 없다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await enterHomeFitting(1, { onSaveLook });
    await press(rowName("wear-top-kiln-jacket", "판매 준비 중"));
    expect(look().top).toBe("wear-top-kiln-jacket");
    await press("장바구니에 넣기");
    await flushAsync();
    expect(stock.clothingCart()).toEqual([]);
    expect(canvas().look).toEqual(BASE_LOOK);
    expect(screen.queryAllByText(/장바구니에 \d+개 담았어요/, ALL)).toHaveLength(0);
    expect(onSaveLook).not.toHaveBeenCalled();
  });

  it("B25: 가진 옷으로 바꾼 착장으로 끝내면 그 착장이 옷장 저장에 넘어가고 커튼이 열리고 걸어 나온다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await enterHomeFitting(2, { onSaveLook });
    await press("shortsBrown, 가진 옷");
    await press("장바구니에 넣기");
    await flushAsync();
    expect(onSaveLook).toHaveBeenCalledTimes(1);
    expect(onSaveLook).toHaveBeenCalledWith({ ...BASE_LOOK, bottom: "shortsBrown" });
    expect(stock.clothingCart()).toEqual([]);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(roomReachable(2)).toBe(true);
    await frames(6);
    expect(dist(pos(), appPoint(2, "FittingApproach1"))).toBeLessThan(0.1);
    expect(screen.queryAllByRole("button", { name: "끝내기" })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "장바구니에 넣기" })).toHaveLength(0);
  });

  it("B26: 저장이 실패하면 들어오기 전 착장으로 돌아가고 '옷을 저장하지 못했어요'가 안내된다", async () => {
    const onSaveLook = jest.fn().mockRejectedValue(new Error("fail"));
    await enterHomeFitting(1, { onSaveLook });
    await press("shortsBrown, 가진 옷");
    await press("장바구니에 넣기");
    await flushAsync();
    expect(onSaveLook).toHaveBeenCalledTimes(1);
    expect(texts("옷을 저장하지 못했어요").length).toBeGreaterThan(0);
    expect(canvas().look).toEqual(BASE_LOOK);
  });

  it("B29: 가지지 않은 등록 상품과 가진 옷을 함께 입고 끝내면 담기와 저장이 둘 다 일어난다(담은 부위는 들어오기 전 옷)", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await enterHomeFitting(1, { onSaveLook });
    await press(rowName("capOrange", "60룹"));
    await press("shortsBrown, 가진 옷");
    await press("장바구니에 넣기");
    await flushAsync();
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    expect(onSaveLook).toHaveBeenCalledWith({ ...BASE_LOOK, bottom: "shortsBrown" });
    expect(texts("장바구니에 1개 담았어요").length).toBeGreaterThan(0);
  });

  it("B32: 1층에서 들어갔다 취소한 뒤 2층에서 들어가면 각 방 기준으로 동작한다", async () => {
    await enterHomeFitting(1);
    expect(canvas().clothingCurtainClosed).toBe(1);
    await press("취소");
    await frames(6);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(dist(pos(), appPoint(1, "FittingApproach1"))).toBeLessThan(0.1);
    await goUp();
    await enterFitting(2);
    expect(canvas().clothingCurtainClosed).toBe(2);
    expect(dist(pos(), appPoint(2, "Fitting1"))).toBeLessThan(0.05);
    expect(roomReachable(2)).toBe(false);
    await press("장바구니에 넣기");
    await frames(6);
    expect(canvas().clothingCurtainClosed ?? null).toBeNull();
    expect(dist(pos(), appPoint(2, "FittingApproach1"))).toBeLessThan(0.1);
  });
});

it("(기준) 미등록 13종이 stock.json에서 온다", () => {
  expect(UNREGISTERED).toHaveLength(13);
});
