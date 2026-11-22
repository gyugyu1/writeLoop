// [spec] qa 테스트(작업 090-③ 옷 내려받기, 새 기능, 모바일): 홈쇼핑·옷장 화면에서 그릴 수 있는 옷만 보이는지(B1·B6·S1~S4·K1~K3),
// 옷 칸 그림을 받아 보이는지(E1~E4), 옷장에서 고른 옷이 미리보기에 넘어가는지(D7·K3), 열기만 해서는 옷 모델을 받지 않는지(D8), 옷장 저장 뒤 입힐 값(H2).
// 기대값은 시나리오(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/05-옷-내려받기/04-qa-scenarios.md)와 같은 폴더 05-main-decision.md에서만 가져온다.
// 테스트 이름 앞의 번호가 시나리오 번호다. 입력 목록은 시나리오의 CAT-W(tests/__fixtures__/wear-files-090.ts의 catW)다.
// 구현 커밋 2c23e2c에서 읽은 것은 부르는 방법뿐이다:
// - 홈쇼핑 HomeShoppingSheet(visible·onClose·onBalance·onOrdered·onPlaceNow·onWore), 옷장 ClosetSheet(visible·onClose·onSaved)를 화면 단위로 그린다
//   (홈은 이 둘을 그대로 띄운다. 홈을 거치는 흐름은 기존 home-shopping-clothes·home-closet 테스트가 본다).
// - api: getHomeShopping, orderHomeShoppingWearable, getWardrobe, saveWardrobeEquipped, getItemCatalog. 미리보기는 closet-preview(옷장이 require로 부른다)를 가짜로 두고 넘긴 look을 적는다.
// - 목록 받기 refreshItemCatalog({ store }), 목록 두기 setItemCatalog(parseItemCatalog(응답)), 저장한 목록은 AsyncStorage "writeloop.item-catalog.v1"(B6만 쓴다).
// - 옷장 칸·홈쇼핑 카드의 그림은 받은 파일이면 { uri }, 받기 전·실패면 이름 첫 글자 글이다. 3D로 그리는 것은 tests/components/wear-download-3d.spec이 본다.
// 목록은 모듈 상태라 한 파일 안에서 이어진다. 그래서 "목록이 아직 없는" B1과 "저장한 목록으로 시작하는" B6을 이 파일 맨 앞에 둔다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import ClosetSheet from "@/components/home/closet-sheet";
import HomeShoppingSheet from "@/components/home/home-shopping-sheet";
import { getHomeShopping, getItemCatalog, getWardrobe, orderHomeShoppingWearable, saveWardrobeEquipped } from "@/lib/api";
import { refreshItemCatalog } from "@/lib/item-catalog";
import { currentItemCatalog, parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { lookFromEquipped } from "@/lib/lobby3d/wear";
import type { HomeShopping, HomeShoppingWearableOrderResult, Wardrobe, WardrobeSlot } from "@/lib/types";
import { catW, device, downloadedPaths, failDownload, hold, pathOf, putOnDevice, release, resetDevice, type CatW } from "../__fixtures__/wear-files-090";

type UiNode = ReturnType<typeof screen.getByRole>;
const mockPreview: { looks: unknown[] } = { looks: [] };

jest.mock("@/lib/api", () => ({
  ApiError: jest.requireActual<typeof import("@/lib/api")>("@/lib/api").ApiError,
  getHomeShopping: jest.fn(),
  getItemCatalog: jest.fn(),
  getWardrobe: jest.fn(),
  orderHomeShopping: jest.fn(),
  orderHomeShoppingAny: jest.fn(),
  orderHomeShoppingWearable: jest.fn(),
  saveWardrobeEquipped: jest.fn()
}));
jest.mock("@/components/home/closet-preview", () => ({
  __esModule: true,
  default: (props: { look?: unknown }) => {
    mockPreview.looks.push(props.look ?? null);
    return null;
  }
}));
jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// ---------- 값과 도우미 ----------

const ALL = { includeHiddenElements: true } as const;
const CARD_LABEL = /^(.+), (\d+)룹, (\d+% 할인, )?자세히 보기$/;
const ALL_NULL: Record<WardrobeSlot, string | null> = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const SLOT_LABEL: Record<WardrobeSlot, string> = { hat: "모자", top: "상의", bottom: "하의", shoes: "신발", face: "얼굴장식", back: "등장식", accessory: "액세서리" };

let round = 0;
function useCatW(): CatW {
  round += 1;
  const cat = catW(`screen-${round}`);
  setItemCatalog(parseItemCatalog(cat.catalog)!);
  return cat;
}

/** 모든 그림 파일을 기기에 둔다(이미 받아 둠). */
function iconsOnDevice(cat: CatW) {
  for (const ref of Object.values(cat.icon)) putOnDevice(ref);
}

async function flushAsync() {
  for (let index = 0; index < 10; index += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const labelOf = (node: UiNode) => (node.props as { accessibilityLabel?: string }).accessibilityLabel;

function imageSources(node: UiNode): unknown[] {
  const sources = (node as unknown as { queryAll: (p: (n: UiNode) => boolean) => UiNode[] }).queryAll((n) => n.props?.source != null).map((n) => (n.props as { source: unknown }).source);
  return [...new Map(sources.map((s) => [JSON.stringify(s), s])).values()];
}

const texts = (node: UiNode, text: string) => within(node).queryAllByText(text, ALL).length;

function shop(types: [string, number][]): HomeShopping {
  return { balance: 500, broadcast: { type: "bed", price: 300, salePrice: 240 }, items: types.map(([type, price]) => ({ type, price, salePrice: null, owned: 0 })) };
}

function wardrobe(items: [string, WardrobeSlot][], equipped: Partial<Record<WardrobeSlot, string | null>>): Wardrobe {
  return JSON.parse(
    JSON.stringify({ items: items.map(([type, slot], i) => ({ type, slot, acquiredAt: `2026-11-14T0${i}:00:00Z` })), equipped: { ...ALL_NULL, ...equipped } })
  ) as Wardrobe;
}

async function openShop() {
  await render(<HomeShoppingSheet visible onClose={jest.fn()} onBalance={jest.fn()} onOrdered={jest.fn()} onPlaceNow={jest.fn()} onWore={mockOnWore} />);
  await flushAsync();
}
const mockOnWore = jest.fn();

function cardNames(): string[] {
  return screen
    .queryAllByRole("button", { name: CARD_LABEL, ...ALL })
    .filter((button) => !(labelOf(button) ?? "").startsWith("오늘의 방송 상품"))
    .map((button) => CARD_LABEL.exec(labelOf(button) ?? "")![1]);
}

function cardOf(name: string): UiNode {
  const cards = screen.queryAllByRole("button", { name: CARD_LABEL, ...ALL }).filter((button) => CARD_LABEL.exec(labelOf(button) ?? "")![1] === name && !(labelOf(button) ?? "").startsWith("오늘의 방송 상품"));
  expect(cards).toHaveLength(1);
  return cards[0];
}

async function press(node: UiNode) {
  await fireEvent.press(node);
  await flushAsync();
}

async function pressTab(name: string) {
  await press(screen.getByRole("tab", { name, ...ALL }));
}

const onSaved = jest.fn();
async function openCloset(value: Wardrobe) {
  jest.mocked(getWardrobe).mockResolvedValue(value);
  await render(<ClosetSheet visible onClose={jest.fn()} onSaved={onSaved} />);
  await flushAsync();
}

function cellNames(): string[] {
  const tabs = new Set(screen.queryAllByRole("tab", ALL));
  return screen
    .queryAllByRole("button", ALL)
    .filter((button) => !tabs.has(button))
    .map((button) => labelOf(button) ?? "")
    .filter((name) => name !== "" && name !== "옷장 닫기");
}

function cellOf(name: string): UiNode {
  const cells = screen.queryAllByRole("button", { name, ...ALL }).filter((button) => labelOf(button) === name);
  expect(cells).toHaveLength(1);
  return cells[0];
}

const selected = (node: UiNode) => (node.props as { accessibilityState?: { selected?: boolean } }).accessibilityState?.selected === true;

beforeEach(() => {
  resetDevice();
  mockPreview.looks.length = 0;
  mockOnWore.mockReset();
  onSaved.mockReset();
  jest.mocked(getHomeShopping).mockReset();
  jest.mocked(getItemCatalog).mockReset();
  jest.mocked(getWardrobe).mockReset();
  jest.mocked(orderHomeShoppingWearable).mockReset();
  jest.mocked(saveWardrobeEquipped).mockReset();
});

// ---------- B1·B6(이 파일 맨 앞) ----------

describe("[spec] 090-③ B1·B6: 목록이 없을 때와 저장한 목록으로 시작할 때", () => {
  test("B1(홈쇼핑) 목록이 없으면 옷 카드가 하나도 없고('옷' 탭·'전체') 가구 카드는 서버 순서 그대로다", async () => {
    expect(currentItemCatalog()).toBeNull();
    jest.mocked(getHomeShopping).mockResolvedValue(shop([["books", 40], ["capOrange", 60], ["tshirtOrange", 80], ["nightstand", 100], ["shoesBrown", 90]]));
    await openShop();
    expect(cardNames()).toEqual(["책", "협탁"]);
    await pressTab("옷");
    expect(cardNames()).toEqual([]);
  });

  test("B1(옷장) 목록이 없으면 모자·상의·신발 탭에 '벗기'만 있고 얼굴장식 탭에 '라룹이 고글'이 있으며, 상의를 '벗기'로 저장하면 본문은 모자 capOrange·상의 null·얼굴장식 goggles다", async () => {
    expect(currentItemCatalog()).toBeNull();
    const value = wardrobe(
      [["capOrange", "hat"], ["tshirtOrange", "top"], ["shoesBrown", "shoes"], ["goggles", "face"]],
      { hat: "capOrange", top: "tshirtOrange", face: "goggles" }
    );
    jest.mocked(saveWardrobeEquipped).mockImplementation(async (body) => wardrobe([], body));
    await openCloset(value);
    for (const slot of ["hat", "top", "shoes"] as WardrobeSlot[]) {
      await pressTab(SLOT_LABEL[slot]);
      expect({ slot, cells: cellNames().filter((name) => name !== "저장") }).toEqual({ slot, cells: ["벗기"] });
    }
    await pressTab("얼굴장식");
    expect(cellNames().filter((name) => name !== "저장")).toEqual(["벗기", "라룹이 고글"]);
    await pressTab("상의");
    await press(cellOf("벗기"));
    await press(screen.getByRole("button", { name: "저장", ...ALL }));
    expect(jest.mocked(saveWardrobeEquipped).mock.calls).toEqual([[{ ...ALL_NULL, hat: "capOrange", top: null, face: "goggles" }]]);
  });

  test("B6 로그인 사용자가 전에 받아 저장한 CAT-W가 있고 이번 목록 받기가 실패(500)하면, 저장한 CAT-W의 draw로 홈쇼핑에 옷 카드가 보인다", async () => {
    expect(currentItemCatalog()).toBeNull();
    round += 1;
    const cat = catW(`screen-b6-${round}`);
    await AsyncStorage.setItem("writeloop.item-catalog.v1", JSON.stringify(parseItemCatalog(cat.catalog)));
    jest.mocked(getItemCatalog).mockRejectedValue(new Error("500"));
    await act(async () => {
      await refreshItemCatalog({ store: true });
    });
    expect(currentItemCatalog()?.version).toBe(cat.catalog.version);
    jest.mocked(getHomeShopping).mockResolvedValue(shop([["capOrange", 60], ["tshirtGreenQa", 80], ["hatBody2Qa", 60]]));
    await openShop();
    expect(cardNames()).toEqual(["주황 야구모자", "QA 초록 티"]);
  });
});

// ---------- S. 홈쇼핑 ----------

describe("[spec] 090-③ S: 홈쇼핑은 그릴 수 있는 옷만 보이고 서버가 더한 옷도 판다", () => {
  const SHOP_ORDER: [string, number][] = [
    ["capOrange", 60],
    ["tshirtGreenQa", 80],
    ["hatBody2Qa", 60],
    ["vestQa", 50],
    ["clothQa", 60],
    ["noDrawQa", 60],
    ["bowtieQa", 70]
  ];

  test("S1 '옷' 탭 카드는 주황 야구모자·QA 초록 티·QA 조끼·QA 나비넥타이 순서이고 가격은 서버 그대로이며, 그릴 줄 모르는 셋은 '옷'에도 '전체'에도 없다", async () => {
    iconsOnDevice(useCatW());
    jest.mocked(getHomeShopping).mockResolvedValue(shop(SHOP_ORDER));
    await openShop();
    const expected = ["주황 야구모자", "QA 초록 티", "QA 조끼", "QA 나비넥타이"];
    expect(cardNames()).toEqual(expected);
    expect(["주황 야구모자", "QA 초록 티", "QA 조끼", "QA 나비넥타이"].map((name) => labelOf(cardOf(name)))).toEqual([
      "주황 야구모자, 60룹, 자세히 보기",
      "QA 초록 티, 80룹, 자세히 보기",
      "QA 조끼, 50룹, 자세히 보기",
      "QA 나비넥타이, 70룹, 자세히 보기"
    ]);
    await pressTab("옷");
    expect(cardNames()).toEqual(expected);
    for (const hidden of ["QA 새 몸 모자", "QA 천 망토", "QA 그림만 모자"]) expect({ hidden, shown: screen.queryAllByText(hidden, ALL).length }).toEqual({ hidden, shown: 0 });
  });

  test("S2 QA 조끼 상세는 이름 'QA 조끼', 목록 description, '입는 곳' '상의', '50룹에 주문하기'이고 QA 나비넥타이의 '입는 곳'은 '액세서리'다", async () => {
    iconsOnDevice(useCatW());
    jest.mocked(getHomeShopping).mockResolvedValue(shop(SHOP_ORDER));
    await openShop();
    await press(cardOf("QA 조끼"));
    expect(screen.getAllByRole("header", { name: "QA 조끼", ...ALL }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("QA 조끼 설명이에요.", ALL).length).toBeGreaterThan(0);
    expect(screen.getAllByText("입는 곳", ALL).length).toBe(1);
    expect(screen.getAllByText("상의", ALL).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "50룹에 주문하기", ...ALL }).length).toBe(1);
    await press(screen.getByRole("button", { name: "상품 상세 닫기", ...ALL }));
    await press(cardOf("QA 나비넥타이"));
    expect(screen.getAllByText("액세서리", ALL).length).toBeGreaterThan(0);
  });

  test.each([
    ["QA 조끼", "vestQa", 50, "top"],
    ["주황 야구모자", "capOrange", 60, "hat"]
  ] as const)("S3·S4 %s를 사면 완료 판에 '옷장에 도착했어요'·'계속 구경하기'·'바로 입기'가 있고, '바로 입기'는 주문 결과의 입은 것에서 그 부위만 바꿔 저장하며 그 옷을 입힐 값이 된다", async (name, type, price, slot) => {
    iconsOnDevice(useCatW());
    jest.mocked(getHomeShopping).mockResolvedValue(shop(SHOP_ORDER));
    const base = { ...ALL_NULL, hat: "capBlue", top: "tshirtOrange" };
    const result: HomeShoppingWearableOrderResult = { type, price, balance: 500 - price, owned: 1, itemId: null, layout: null, wardrobe: wardrobe([], base) };
    jest.mocked(orderHomeShoppingWearable).mockResolvedValue(result);
    jest.mocked(saveWardrobeEquipped).mockImplementation(async (body) => wardrobe([], body));
    await openShop();
    await press(cardOf(name));
    await press(screen.getByRole("button", { name: `${price}룹에 주문하기`, ...ALL }));
    expect(jest.mocked(orderHomeShoppingWearable).mock.calls).toEqual([[{ type, price }]]);
    expect(screen.getAllByText("옷장에 도착했어요", ALL).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "계속 구경하기", ...ALL }).length).toBe(1);
    await press(screen.getByRole("button", { name: "바로 입기", ...ALL }));
    expect(jest.mocked(saveWardrobeEquipped).mock.calls).toEqual([[{ ...base, [slot]: type }]]);
    expect(mockOnWore).toHaveBeenCalledTimes(1);
    const saved = mockOnWore.mock.calls[0][0] as Wardrobe;
    expect(lookFromEquipped(saved.equipped)[slot]).toBe(type);
  });

  test("D8(나) 홈쇼핑을 열어 옷 카드와 상세를 봐도 옷 모델(.glb) 요청은 0건이다", async () => {
    const cat = useCatW();
    iconsOnDevice(cat);
    jest.mocked(getHomeShopping).mockResolvedValue(shop(SHOP_ORDER));
    await openShop();
    await press(cardOf("QA 조끼"));
    await flushAsync();
    expect(downloadedPaths().filter((path) => path.endsWith(".glb"))).toEqual([]);
  });
});

// ---------- E. 칸 그림 ----------

describe("[spec] 090-③ E: 옷 칸 그림은 받기 전·실패면 이름 첫 글자, 받으면 받은 그림", () => {
  test("E1 홈쇼핑을 열면 주황 야구모자 카드는 그림 없이 '주'이고 그 그림을 한 번 요청하며, 받으면 카드 그림이 기기 파일이고 상세도 같은 그림이며 요청이 늘지 않는다", async () => {
    const cat = useCatW();
    hold(cat.icon.capOrange);
    jest.mocked(getHomeShopping).mockResolvedValue(shop([["capOrange", 60]]));
    await openShop();
    const card = cardOf("주황 야구모자");
    expect(imageSources(card)).toEqual([]);
    expect(texts(card, "주")).toBeGreaterThan(0);
    expect(downloadedPaths().filter((path) => path === pathOf(cat.icon.capOrange.url))).toHaveLength(1);
    await act(async () => {
      release(cat.icon.capOrange);
    });
    await flushAsync();
    const uri = { uri: `file:///qa-document/item-files/${cat.icon.capOrange.sha256}.png` };
    expect(imageSources(cardOf("주황 야구모자"))).toEqual([uri]);
    await press(cardOf("주황 야구모자"));
    expect(screen.queryAllByRole("header", { name: "주황 야구모자", ...ALL }).length).toBeGreaterThan(0);
    expect(downloadedPaths().filter((path) => path === pathOf(cat.icon.capOrange.url))).toHaveLength(1);
  });

  test("E2 그림 받기에 실패하면 카드와 상세에 그림 없이 '주'다", async () => {
    const cat = useCatW();
    failDownload(cat.icon.capOrange);
    jest.mocked(getHomeShopping).mockResolvedValue(shop([["capOrange", 60]]));
    await openShop();
    await flushAsync();
    const card = cardOf("주황 야구모자");
    expect(imageSources(card)).toEqual([]);
    expect(texts(card, "주")).toBeGreaterThan(0);
    await press(card);
    expect(screen.queryAllByText("주", ALL).length).toBeGreaterThan(1);
  });

  test("E3 옷장(모자 탭)의 '주황 야구모자' 칸은 받기 전 그림 없이 '주' 글자이고 '✕'가 아니며, 받으면 기기 파일 그림이다", async () => {
    const cat = useCatW();
    hold(cat.icon.capOrange);
    await openCloset(wardrobe([["capOrange", "hat"]], {}));
    const cell = cellOf("주황 야구모자");
    expect(imageSources(cell)).toEqual([]);
    expect(texts(cell, "주")).toBe(1);
    expect(texts(cell, "✕")).toBe(0);
    await act(async () => {
      release(cat.icon.capOrange);
    });
    await flushAsync();
    expect(imageSources(cellOf("주황 야구모자"))).toEqual([{ uri: `file:///qa-document/item-files/${cat.icon.capOrange.sha256}.png` }]);
  });

  test("E4(옷장) icon이 null인 QA 무늬 없는 목걸이의 옷장 칸은 그림 없이 'Q'이고 그림 요청이 0건이다", async () => {
    useCatW();
    await openCloset(wardrobe([["plainQa", "accessory"]], {}));
    await pressTab("액세서리");
    const cell = cellOf("QA 무늬 없는 목걸이");
    expect(imageSources(cell)).toEqual([]);
    expect(texts(cell, "Q")).toBe(1);
    expect(device.downloads).toEqual([]);
  });

  test("E4(홈쇼핑) icon이 null인 QA 무늬 없는 목걸이의 홈쇼핑 카드는 그림 없이 'Q'이고 그림 요청이 0건이다", async () => {
    useCatW();
    jest.mocked(getHomeShopping).mockResolvedValue(shop([["plainQa", 60]]));
    await openShop();
    const card = cardOf("QA 무늬 없는 목걸이");
    expect(imageSources(card)).toEqual([]);
    expect(texts(card, "Q")).toBeGreaterThan(0);
    expect(device.downloads).toEqual([]);
  });
});

// ---------- K. 옷장 ----------

describe("[spec] 090-③ K: 옷장은 그릴 수 있는 옷에 칸을 만들고 서버가 더한 옷도 고른다", () => {
  const OWNED: [string, WardrobeSlot][] = [
    ["capOrange", "hat"],
    ["capBlue", "hat"],
    ["hatBody2Qa", "hat"],
    ["tshirtGreenQa", "top"],
    ["vestQa", "top"],
    ["goggles", "face"]
  ];

  test("K1 모자 탭은 '벗기'·'주황 야구모자'·'파랑 야구모자'(QA 새 몸 모자 없음), 상의 탭은 '벗기'·'QA 초록 티'·'QA 조끼'이고 'QA 조끼'가 고른 표시, 얼굴장식 탭은 '벗기'·'라룹이 고글'이다", async () => {
    iconsOnDevice(useCatW());
    await openCloset(wardrobe(OWNED, { hat: "capOrange", top: "vestQa", face: "goggles" }));
    const cells = () => cellNames().filter((name) => name !== "저장");
    expect(cells()).toEqual(["벗기", "주황 야구모자", "파랑 야구모자"]);
    await pressTab("상의");
    expect(cells()).toEqual(["벗기", "QA 초록 티", "QA 조끼"]);
    expect(selected(cellOf("QA 조끼"))).toBe(true);
    expect(selected(cellOf("QA 초록 티"))).toBe(false);
    await pressTab("얼굴장식");
    expect(cells()).toEqual(["벗기", "라룹이 고글"]);
  });

  test("K2 QA 새 몸 모자를 입고 있으면 모자 탭은 어느 칸도 고른 표시가 아니고, 상의에서 QA 초록 티를 골라 저장하면 본문은 모자 hatBody2Qa·상의 tshirtGreenQa다", async () => {
    iconsOnDevice(useCatW());
    jest.mocked(saveWardrobeEquipped).mockImplementation(async (body) => wardrobe(OWNED, body));
    await openCloset(wardrobe(OWNED, { hat: "hatBody2Qa" }));
    expect(["벗기", "주황 야구모자", "파랑 야구모자"].map((name) => selected(cellOf(name)))).toEqual([false, false, false]);
    await pressTab("상의");
    await press(cellOf("QA 초록 티"));
    await press(screen.getByRole("button", { name: "저장", ...ALL }));
    expect(jest.mocked(saveWardrobeEquipped).mock.calls).toEqual([[{ ...ALL_NULL, hat: "hatBody2Qa", top: "tshirtGreenQa" }]]);
  });

  test("K3·D7(옷장) 'QA 조끼'·'빨강 반바지' 칸을 고르면 저장하지 않아도 미리보기에 넘기는 입은 것이 상의 vestQa·하의 shortsRed가 된다", async () => {
    iconsOnDevice(useCatW());
    await openCloset(wardrobe([["vestQa", "top"], ["shortsRed", "bottom"]], {}));
    await pressTab("상의");
    await press(cellOf("QA 조끼"));
    await pressTab("하의");
    await press(cellOf("빨강 반바지"));
    expect(mockPreview.looks.at(-1)).toEqual({ ...ALL_NULL, top: "vestQa", bottom: "shortsRed" });
    expect(saveWardrobeEquipped).not.toHaveBeenCalled();
  });

  test("D8(가) 옷장을 열고 칸을 누르지 않으면 미리보기에 넘기는 입은 것은 입은 옷뿐이고(입지 않은 파랑 야구모자 없음) 옷 모델 요청은 0건이다", async () => {
    iconsOnDevice(useCatW());
    await openCloset(wardrobe(OWNED, { hat: "capOrange" }));
    expect(mockPreview.looks.at(-1)).toEqual({ ...ALL_NULL, hat: "capOrange" });
    expect(JSON.stringify(mockPreview.looks)).not.toContain("capBlue");
    expect(downloadedPaths().filter((path) => path.endsWith(".glb"))).toEqual([]);
  });

  test("H2 옷장에서 흰 티셔츠를 골라 저장하면 홈에 넘기는 저장 결과의 입힐 값이 상의 tshirtWhite다", async () => {
    iconsOnDevice(useCatW());
    jest.mocked(saveWardrobeEquipped).mockImplementation(async (body) => wardrobe([["tshirtWhite", "top"]], body));
    await openCloset(wardrobe([["tshirtWhite", "top"]], {}));
    await pressTab("상의");
    await press(cellOf("흰 티셔츠"));
    await press(screen.getByRole("button", { name: "저장", ...ALL }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(lookFromEquipped((onSaved.mock.calls[0][0] as Wardrobe).equipped).top).toBe("tshirtWhite");
  });
});
