// [spec] qa 테스트(작업 133 09 피팅 아이콘 목록·진열대 앞 상호작용 칸, 기능 변경, 모바일): 피팅 창 아이콘 칸, 진열대 앞 상호작용 칸, 상품 누르기.
// 기대값은 09-피팅-아이콘-상호작용칸/01-main-spec.md(명세 2·4·5·6)에서만 가져온다. 3D는 가짜 캔버스로 바꾸고 캔버스 props(look·clothingSelected·sim)로 본다.
// 피팅 카메라 전신(명세 3)은 거리를 캔버스 안(three 카메라)에서 계산해 캔버스를 가짜로 바꾼 이 방식으로는 볼 수 없다(폰에서 볼 것).
// 아이콘 파일은 기기 저장 대신 item-files의 cachedItemFile을 가짜로 바꿔(.png는 file:///icons/<sha>.png) 이미지 주소로 본다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Animated, Image } from "react-native";
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
jest.mock("@/lib/item-files", () => {
  const actual = jest.requireActual<typeof import("@/lib/item-files")>("@/lib/item-files");
  return {
    ...actual,
    cachedItemFile: (ref: { url: string; sha256: string } | null | undefined) =>
      ref && ref.url.endsWith(".png") ? `file:///icons/${ref.sha256}.png` : actual.cachedItemFile(ref as never)
  };
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
const stockRows = STOCK.products as unknown as { id: string; category: string; catalogId: string | null; floor: number; playerApproachXZ: number[] }[];
const approachOf = (id: string): FloorPoint => {
  const row = stockRows.find((p) => p.id === id)!;
  return { x: row.playerApproachXZ[0] + OFFSET.x, z: row.playerApproachXZ[1] + OFFSET.z };
};

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const look = () => canvas().look as WearLook;
const texts = (value: string) => screen.queryAllByText(value, ALL);
const buttons = (name: string) => screen.queryAllByRole("button", { name });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const selected = () => canvas().clothingSelected ?? null;

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

/** 그 상품 앞(서는 자리)으로 로비를 눌러(상품을 누르지 않고) 걸어가 선다. */
async function standAt(id: string) {
  await walkTo(approachOf(id), null);
  expect(dist(pos(), approachOf(id))).toBeLessThan(0.15);
}

/** 상품을 눌러 그 앞으로 걸어간다. */
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

async function goUp() {
  await walkTo(CLOTHING_MARKS.clothingUp.approach[0], "clothingUp");
  await press("올라가기");
  await frames(1.2);
  expect(area()).toBe("clothing2");
}

async function enterFitting(id: "clothingFitting1" | "clothingFitting2") {
  await walkTo(CLOTHING_MARKS[id].approach[0], id);
  await press("들어가기");
  await frames(6);
}

/** 상호작용 칸이 떠 있다: 입어보기(또는 벗기)와 장바구니 버튼이 있다. */
const panelOpen = () => (buttons("입어보기").length > 0 || buttons("벗기").length > 0) && buttons("장바구니").length > 0;

const rowName = (id: string, tag: string) => `${stock.clothingProduct(id)!.name}, ${tag}`;
const ROW_NAME = /, (판매 준비 중|가진 옷|\d+룹)$/;

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

const hex = (text: string) => Buffer.from(text).toString("hex").padEnd(64, "0").slice(0, 64);
/** 목록에 그림이 없는 옷. */
const NO_ICON = ["wear-hat-field-cap", "capGreen"];
const iconUri = (id: string) => `file:///icons/${hex(`icon-${id}`)}.png`;

function wearable(id: string, slot: string, price: number | null) {
  const model = { url: `/api/catalog/files/${hex(`model-${id}`)}.glb`, sha256: hex(`model-${id}`), bytes: 1 };
  const icon = NO_ICON.includes(id) ? null : { url: `/api/catalog/files/${hex(`icon-${id}`)}.png`, sha256: hex(`icon-${id}`), bytes: 1 };
  return {
    id, kind: "wearable" as const, name: id, shopName: id, description: "", category: price === null ? null : ("clothes" as const), slot, price,
    draw: { attach: "bone", bone: "head", body: 1 }, assets: { model, icon }
  };
}

let catalogVersion = 0;
function setCatalog(without: string[] = []) {
  const items = stockRows
    .map((p) => wearable(p.catalogId ?? p.id, p.category, p.catalogId ? PRICES[p.catalogId] : null))
    .concat(wearable("shortsBrown", "bottom", 70), wearable("capGreen", "hat", 60))
    .filter((item) => !without.includes(item.id));
  catalogStore.setItemCatalog({ version: `spec-icons-${catalogVersion++}`, items: items as never });
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

describe("[spec] 피팅 목록 아이콘 칸(명세 2)", () => {
  const cell = (name: string) => screen.getAllByRole("button", { name })[0];
  /** 그 칸 안에 그린 이미지들의 그림 주소(화면 트리에서 칸을 찾아 그 안의 이미지를 모은다). */
  type Json = { type: string; props: Record<string, unknown>; children?: (Json | string)[] | null };
  const imageUris = (name: string): (string | undefined)[] => {
    const tree = screen.toJSON() as Json | Json[] | null;
    const roots = Array.isArray(tree) ? tree : tree ? [tree] : [];
    const found: Json[] = [];
    const walk = (node: Json | string) => {
      if (typeof node === "string") return;
      if (node.props?.accessibilityLabel === name && node.props?.accessibilityRole === "button") found.push(node);
      for (const child of node.children ?? []) walk(child);
    };
    roots.forEach(walk);
    expect({ name, cells: found.length }).toEqual({ name, cells: 1 });
    const uris: (string | undefined)[] = [];
    const collect = (node: Json | string) => {
      if (typeof node === "string") return;
      if (node.type === "Image") uris.push((node.props.source as { uri?: string } | undefined)?.uri);
      for (const child of node.children ?? []) collect(child);
    };
    collect(found[0]);
    return uris;
  };
  it("칸마다 옷 아이콘(서버 목록의 그림)이 있고, 접근성 이름은 '이름, 표시' 그대로다", async () => {
    await renderShop();
    await enterFitting("clothingFitting1");
    for (const [id, tag] of [["capOrange", "60룹"], ["shoesWhite", "90룹"], ["wear-top-kiln-jacket", "판매 준비 중"], ["tshirtOrange", "가진 옷"]] as const) {
      expect({ id, uris: imageUris(rowName(id, tag)) }).toEqual({ id, uris: [iconUri(id)] });
    }
  });

  it("칸 안에 표시 글('가진 옷'·'판매 준비 중'·'60룹')이 따로 있다", async () => {
    await renderShop();
    await enterFitting("clothingFitting1");
    expect(within(cell(rowName("tshirtOrange", "가진 옷"))).queryAllByText("가진 옷")).toHaveLength(1);
    expect(within(cell(rowName("wear-top-kiln-jacket", "판매 준비 중"))).queryAllByText("판매 준비 중")).toHaveLength(1);
    expect(within(cell(rowName("capOrange", "60룹"))).queryAllByText("60룹")).toHaveLength(1);
  });

  it("칸 안에 그 옷의 이름이 있다(짧게 줄일 수 있어, 이름을 포함하거나 이름에 들어 있는 글)", async () => {
    await renderShop();
    await enterFitting("clothingFitting1");
    const name = stock.clothingProduct("capOrange")!.name;
    const inside = within(cell(rowName("capOrange", "60룹"))).queryAllByText(/./).map((node) => String(node.props.children));
    expect(inside.some((text) => text !== "60룹" && (name.includes(text) || text.includes(name)))).toBe(true);
  });

  it("그림이 없는 옷은 이름 첫 글자 칸이다(이미지 없음)", async () => {
    await renderShop({ ownedItems: ["tshirtOrange", "shortsBrown", "capGreen"] });
    await enterFitting("clothingFitting1");
    const noIcon = cell(rowName("wear-hat-field-cap", "판매 준비 중"));
    expect(imageUris(rowName("wear-hat-field-cap", "판매 준비 중"))).toHaveLength(0);
    expect(within(noIcon).queryAllByText(stock.clothingProduct("wear-hat-field-cap")!.name[0]).length).toBeGreaterThan(0);
    const owned = cell("capGreen, 가진 옷");
    expect(imageUris("capGreen, 가진 옷")).toHaveLength(0);
    expect(within(owned).queryAllByText("c").length).toBeGreaterThan(0);
  });

  it("입은 칸은 선택 상태로 강조되고, 누르면 입고 다시 누르면 벗는다(그대로)", async () => {
    await renderShop();
    await enterFitting("clothingFitting1");
    const name = rowName("capOrange", "60룹");
    expect(screen.queryAllByRole("button", { name, selected: true })).toHaveLength(0);
    await press(name);
    expect(look().hat).toBe("capOrange");
    expect(screen.queryAllByRole("button", { name, selected: true })).toHaveLength(1);
    await press(name);
    expect(look().hat).toBeNull();
    expect(screen.queryAllByRole("button", { name, selected: true })).toHaveLength(0);
  });

  it("부위 묶음 이름은 그대로 보이고 목록 내용은 22종 + 가진 옷(23칸)이다", async () => {
    await renderShop();
    await enterFitting("clothingFitting1");
    for (const label of ["모자", "상의", "하의", "신발", "얼굴장식", "등장식", "액세서리"]) expect({ label, n: texts(label).length > 0 }).toEqual({ label, n: true });
    expect(screen.queryAllByRole("button", { name: ROW_NAME })).toHaveLength(23);
  });
});

describe("[spec] 진열대 앞 상호작용 칸(명세 4)", () => {
  it("처음 들어서면(어느 상품에서도 멀면) 칸도 선택도 없다", async () => {
    await renderShop();
    expect(panelOpen()).toBe(false);
    expect(selected()).toBeNull();
  });

  it("상품의 서는 자리에 멈춰 서면 상품을 누르지 않아도 그 상품의 칸이 뜨고 이름·가격·입어보기·장바구니가 있다. 그 상품이 선택된다", async () => {
    await renderShop();
    await standAt("capOrange");
    expect(selected()).toBe("capOrange");
    expect(panelOpen()).toBe(true);
    expect(buttons("입어보기").length).toBeGreaterThan(0);
    expect(texts("60룹").length).toBeGreaterThan(0);
    expect(texts(stock.clothingProduct("capOrange")!.name).length).toBeGreaterThan(0);
    expect(buttons("닫기")).toHaveLength(0);
  });

  it("멀어지면(0.9m 밖) 칸과 선택이 사라진다", async () => {
    await renderShop();
    await standAt("capOrange");
    expect(panelOpen()).toBe(true);
    await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
    for (const row of stockRows.filter((p) => p.floor === 1)) expect(dist(pos(), approachOf(row.id))).toBeGreaterThan(0.9);
    expect(panelOpen()).toBe(false);
    expect(selected()).toBeNull();
  });

  it("칸이 떠 있어도 로비를 누르면 걷는다(로비를 막지 않는다)", async () => {
    await renderShop();
    await standAt("capOrange");
    const before = pos();
    await walkTo(approachOf("capBlue"), null);
    expect(dist(pos(), before)).toBeGreaterThan(1);
    expect(selected()).toBe("capBlue");
  });

  it("서는 자리가 같은 상품(마네킹 네 벌)은 stock.json 순서로 앞의 것이 뜬다", async () => {
    await renderShop();
    const same = stockRows.filter((p) => p.floor === 1 && dist(approachOf(p.id), approachOf("shoesWhite")) < 1e-6).map((p) => p.id);
    expect(same).toHaveLength(4);
    await standAt(same[0]);
    expect(selected()).toBe(same[0]);
    expect(panelOpen()).toBe(true);
  });

  it("진열을 해제한 상품은 그 앞에 서도 선택되지 않는다", async () => {
    await renderShop();
    stock.setClothingDisplayed("capOrange", false);
    await standAt("capOrange");
    expect(selected()).not.toBe("capOrange");
    expect(panelOpen()).toBe(false);
  });

  it("칸의 '입어보기'는 옷집 임시 착장에 입히고, 칸은 그대로 있고 버튼이 '벗기'로 바뀐다. 저장은 없다", async () => {
    const onSaveLook = jest.fn().mockResolvedValue(undefined);
    await renderShop({ onSaveLook });
    await standAt("capOrange");
    await press("입어보기");
    expect(look()).toEqual({ ...BASE_LOOK, hat: "capOrange" });
    expect(buttons("벗기").length).toBeGreaterThan(0);
    expect(buttons("입어보기")).toHaveLength(0);
    expect(onSaveLook).not.toHaveBeenCalled();
    await press("벗기");
    expect(look()).toEqual(BASE_LOOK);
    expect(buttons("입어보기").length).toBeGreaterThan(0);
  });

  it("칸의 '장바구니'는 담고 '장바구니에 담았어요' 안내를 보인다", async () => {
    await renderShop();
    await standAt("capOrange");
    await press("장바구니");
    expect(stock.clothingCart()).toEqual(["capOrange"]);
    expect(texts("장바구니에 담았어요").length).toBeGreaterThan(0);
  });

  it("막힘 사유·안내는 지금 상품 창과 같다: 가진 옷·미등록", async () => {
    await renderShop({ ownedItems: ["tshirtOrange", "capOrange"] });
    await standAt("capOrange");
    expect(texts("이미 가진 옷이에요").length).toBeGreaterThan(0);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual([]);
    await standAt("wear-top-kiln-jacket");
    expect(texts("판매 준비 중인 옷이에요").length).toBeGreaterThan(0);
    await press("장바구니");
    expect(stock.clothingCart()).toEqual([]);
  });

  it("그리기 정보가 없는 옷 앞에서는 '입어 볼 수 없는 옷이에요'를 안내하고 착장은 그대로다", async () => {
    setCatalog(["capBlue"]);
    await renderShop();
    await standAt("capBlue");
    await press("입어보기");
    expect(texts("입어 볼 수 없는 옷이에요").length).toBeGreaterThan(0);
    expect(look()).toEqual(BASE_LOOK);
  });

  it("2층에서도 그 층 상품 앞에 서면 칸이 뜬다", async () => {
    await renderShop();
    await goUp();
    await standAt("shoesBrown");
    expect(selected()).toBe("shoesBrown");
    expect(panelOpen()).toBe(true);
  });
});

describe("[spec] 상품 누르기(명세 5)", () => {
  it("상품을 누르면 그 앞으로 걸어가고, 도착하면 따로 창(판·'닫기') 없이 상호작용 칸에 그 상품이 뜬다", async () => {
    await renderShop();
    await tapProduct("capBlue");
    expect(dist(pos(), approachOf("capBlue"))).toBeLessThan(0.15);
    expect(selected()).toBe("capBlue");
    expect(panelOpen()).toBe(true);
    expect(buttons("닫기")).toHaveLength(0);
    expect(texts("60룹").length).toBeGreaterThan(0);
  });

  it("같은 자리의 상품 중 누른 상품이 먼저 뜬다(stock.json 순서 앞의 상품이 아니라 누른 상품)", async () => {
    await renderShop();
    await tapProduct("wear-top-tide-sailor");
    expect(selected()).toBe("wear-top-tide-sailor");
    expect(texts(stock.clothingProduct("wear-top-tide-sailor")!.name).length).toBeGreaterThan(0);
    await tapProduct("shoesWhite");
    expect(selected()).toBe("shoesWhite");
    expect(texts("90룹").length).toBeGreaterThan(0);
  });

  it("누른 상품은 멀어질 때까지 이어지고, 멀어지면 사라진다", async () => {
    await renderShop();
    await tapProduct("wear-top-tide-sailor");
    await frames(2);
    expect(selected()).toBe("wear-top-tide-sailor");
    await walkTo(CLOTHING_MARKS.clothingExit.approach[0], "clothingExit");
    expect(selected()).toBeNull();
    expect(panelOpen()).toBe(false);
  });

  it("누르고 도착한 상품의 칸에서 입어보기·벗기가 된다", async () => {
    await renderShop();
    await tapProduct("capOrange");
    await press("입어보기");
    expect(look().hat).toBe("capOrange");
    await press("벗기");
    expect(look()).toEqual(BASE_LOOK);
  });
});

describe("[spec] 칸이 뜨지 않을 때(명세 6)", () => {
  it("피팅 중에는 칸이 없고 피팅 창 버튼만 있다", async () => {
    await renderShop();
    await enterFitting("clothingFitting1");
    expect(canvas().clothingFittingFocus ?? null).not.toBeNull();
    expect(panelOpen()).toBe(false);
    expect(selected()).toBeNull();
    expect(buttons("장바구니에 넣기").length).toBeGreaterThan(0);
  });

  it("계산대 창이 열려 있는 동안 칸이 없다", async () => {
    await renderShop({ signedIn: true, shopBalance: 500 });
    await walkTo(CLOTHING_MARKS.clothingCheckout.approach[0], "clothingCheckout");
    await press("계산하기");
    expect(panelOpen()).toBe(false);
    expect(selected()).toBeNull();
  });
});
