// [spec] qa 테스트(작업 133 ④ 계산대·구매, 새 기능, 모바일): 계산대 장소·장바구니 창·구매.
// 기대값은 private 작업 폴더 133-2026-11-21-옷가게-실내-구매/07-계산대-구매/02-qa-scenarios.md(M번호)에서만 가져온다.
// 3D 그리기는 가짜로 바꾼다(lobby3d-clothing-shop-flow.spec.test.tsx와 같은 틀). 가격은 서버 아이템 목록 값(가짜 목록): tshirtOrange 80, capOrange 60, mufflerRed 90.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import type { Lobby3dCanvasProps } from "@/components/lobby3d/lobby3d-canvas";
import Lobby3dScreen from "@/components/lobby3d/lobby3d-screen";
import { MARKS, applyArea, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";
import { setItemCatalog } from "@/lib/item-catalog-store";
import {
  addToClothingCart,
  clothingCart,
  clothingCartBlock,
  clothingProduct,
  resetClothingShop
} from "@/lib/lobby3d/clothing-stock";
import LAYOUT from "@/lib/lobby3d/clothing-shop-layout.json";

const mockCanvas: { props: Lobby3dCanvasProps | null } = { props: null };

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
type Anchors = Record<string, { positionXYZ: number[] }>;
const anchor1 = (key: string): FloorPoint => {
  const a = (LAYOUT.floors["1"].anchors as Anchors)[key].positionXYZ;
  return { x: a[0] + OFFSET.x, z: a[2] + OFFSET.z };
};
const CHECKOUT_INTERACT = anchor1("CheckoutInteract");

const canvas = () => mockCanvas.props!;
const sim = () => canvas().sim;
const area = () => canvas().area ?? "room";
const pos = (): FloorPoint => ({ x: sim().x, z: sim().z });
const dist = (a: FloorPoint, b: FloorPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const textCount = (text: string | RegExp) => screen.queryAllByText(text, ALL).length;
const bubble = () => sim().snapshot(Date.now()).bubbleText;
const buyButton = () => screen.getByRole("button", { name: "구매" });
const buyDisabled = () => Boolean(buyButton().props.accessibilityState?.disabled);

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
}

const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
};

type Order = (items: { type: string; price: number }[]) => Promise<void>;

async function atCheckout(props: { order?: Order; balance?: number | null; signedIn?: boolean } = {}) {
  const balance = props.balance === undefined ? 500 : props.balance;
  await render(<Lobby3dScreen devPanel={false} shopBalance={balance} onClothingOrder={props.order} signedIn={props.signedIn ?? true} />);
  await flushAsync();
  await walkTo(MARKS.door.approach[0], "door");
  await press("나가기");
  await frames(1.2);
  expect(area()).toBe("village");
  await walkTo(VILLAGE_PLACES.clothingShop.approach[0], "clothingShop");
  await press("들어가기");
  await frames(1.2);
  expect(area()).toBe("clothing1");
  await walkTo(CHECKOUT_INTERACT, "clothingCheckout" as PointerHit["mark"]);
  expect(dist(pos(), CHECKOUT_INTERACT)).toBeLessThanOrEqual(0.06);
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 5, 21, 12, 30) });
  await AsyncStorage.clear();
  mockCanvas.props = null;
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  const realTiming = Animated.timing;
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => realTiming(value, { ...config, useNativeDriver: false }));
  setItemCatalog({
    version: "spec-checkout",
    items: [
      ["tshirtOrange", "top", 80],
      ["capOrange", "hat", 60],
      ["mufflerRed", "accessory", 90]
    ].map(([id, slot, price]) => ({
      id,
      kind: "wearable",
      name: id,
      shopName: id,
      description: "",
      category: "clothes",
      slot,
      price,
      draw: null,
      assets: null
    })) as never
  });
});

afterEach(() => {
  resetClothingShop();
  applyArea("room");
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("[spec] 계산대 장소와 창 열기(M1~M5)", () => {
  it("M1·M2·M4: 계산대 앞에 서면 '계산할까?'와 '계산하기'가 뜨고, 누르면 장바구니 창이 열린다", async () => {
    await atCheckout();
    expect(bubble()).toBe("계산할까?");
    await press("계산하기");
    expect(textCount("장바구니가 비었어요")).toBe(1);
    expect(screen.getByRole("button", { name: "구매" })).toBeTruthy();
  });

  it("M3: 손님이면 '로그인하면 옷을 살 수 있어'만 보이고 '계산하기' 버튼이 없다", async () => {
    await atCheckout({ signedIn: false });
    expect(bubble()).toBe("로그인하면 옷을 살 수 있어");
    expect(screen.queryByRole("button", { name: "계산하기" })).toBeNull();
  });

  it("M5: 창이 열린 동안 로비를 눌러도 걷지 않는다", async () => {
    await atCheckout();
    await press("계산하기");
    const before = pos();
    await act(async () => {
      canvas().onPointer("down", { point: { x: before.x + 1.5, z: before.z }, mark: null, onCharacter: false }, 100, 100);
    });
    await act(async () => {
      jest.advanceTimersByTime(30);
      canvas().onPointer("up", null, 100, 100);
    });
    await frames(2);
    expect(dist(pos(), before)).toBeLessThanOrEqual(0.01);
  });
});

describe("[spec] 장바구니 창(M6~M12)", () => {
  it("M6·M7·M8: 담은 상품마다 이름·가격·'빼기'가 있고 합계와 잔액이 보이며, 빼면 합계가 줄어든다", async () => {
    addToClothingCart("capOrange");
    addToClothingCart("mufflerRed");
    await atCheckout({ order: jest.fn(async () => {}) });
    await press("계산하기");
    expect(textCount("60룹")).toBe(1);
    expect(textCount("90룹")).toBe(1);
    expect(textCount(/150룹/)).toBe(1);
    expect(textCount(/500룹/)).toBe(1);
    expect(screen.getAllByRole("button", { name: /빼기/ })).toHaveLength(2);
    await press("빨강 머플러 빼기");
    expect(textCount(/60룹/)).toBeGreaterThan(0);
    expect(textCount(/150룹/)).toBe(0);
    expect(clothingCart()).toEqual(["capOrange"]);
  });

  it("M9: 잔액을 모르면 잔액이 숨겨지고 룹 부족 안내도 없으며 구매가 막히지 않는다", async () => {
    addToClothingCart("capOrange");
    await atCheckout({ order: jest.fn(async () => {}), balance: null });
    await press("계산하기");
    expect(textCount(/잔액/)).toBe(0);
    expect(textCount(/모자라요/)).toBe(0);
    expect(buyDisabled()).toBe(false);
  });

  it("M10: 장바구니가 비었으면 '장바구니가 비었어요'이고 구매를 누를 수 없다", async () => {
    const order = jest.fn(async () => {});
    await atCheckout({ order });
    await press("계산하기");
    expect(textCount("장바구니가 비었어요")).toBe(1);
    expect(buyDisabled()).toBe(true);
    await press("구매");
    expect(order).not.toHaveBeenCalled();
  });

  it("M11: 잔액 100, 합계 150이면 '룹이 50 모자라요'이고 구매를 누를 수 없다", async () => {
    addToClothingCart("capOrange");
    addToClothingCart("mufflerRed");
    const order = jest.fn(async () => {});
    await atCheckout({ order, balance: 100 });
    await press("계산하기");
    expect(textCount("룹이 50 모자라요")).toBe(1);
    expect(buyDisabled()).toBe(true);
    await press("구매");
    expect(order).not.toHaveBeenCalled();
  });

  it("M12: 잔액이 합계와 같으면 모자란다는 안내가 없고 구매할 수 있다", async () => {
    addToClothingCart("capOrange");
    addToClothingCart("mufflerRed");
    await atCheckout({ order: jest.fn(async () => {}), balance: 150 });
    await press("계산하기");
    expect(textCount(/모자라요/)).toBe(0);
    expect(buyDisabled()).toBe(false);
  });
});

describe("[spec] 구매(M13~M19)", () => {
  it("M13·M14: 구매하면 장바구니의 아이템 ID와 보인 가격으로 주문하고, 성공하면 장바구니가 비고 창이 닫히고 '옷 2개를 샀어요'가 안내된다", async () => {
    addToClothingCart("capOrange");
    addToClothingCart("mufflerRed");
    const order = jest.fn(async () => {});
    await atCheckout({ order });
    await press("계산하기");
    await press("구매");
    await flushAsync();
    expect(order).toHaveBeenCalledTimes(1);
    expect(order).toHaveBeenCalledWith([
      { type: "capOrange", price: 60 },
      { type: "mufflerRed", price: 90 }
    ]);
    expect(clothingCart()).toEqual([]);
    expect(textCount("옷 2개를 샀어요")).toBeGreaterThan(0);
    // 창이 닫혔다: 구매 버튼이 없다
    expect(screen.queryByRole("button", { name: "구매" })).toBeNull();
  });

  it.each(["이미 가진 옷이에요.", "가격이 바뀌었어요. 다시 확인해 주세요.", "옷집에 진열하지 않은 옷이에요.", "판매 준비 중인 옷이에요.", "룹이 모자라요."])(
    "M15·M16·M18: 서버가 '%s'로 거절하면 그 안내를 보이고 장바구니는 그대로이며 창은 열려 있고 다시 구매할 수 있다",
    async (message) => {
      addToClothingCart("capOrange");
      const order = jest.fn(async () => {
        throw new Error(message);
      });
      await atCheckout({ order });
      await press("계산하기");
      await press("구매");
      await flushAsync();
      expect(textCount(message)).toBeGreaterThan(0);
      expect(clothingCart()).toEqual(["capOrange"]);
      expect(buyDisabled()).toBe(false);
      await press("구매");
      await flushAsync();
      expect(order).toHaveBeenCalledTimes(2);
    }
  );

  it("M17: 주문하는 동안 '구매'를 다시 눌러도 주문은 한 번만 나간다", async () => {
    addToClothingCart("capOrange");
    let finish: () => void = () => {};
    const order = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    await atCheckout({ order });
    await press("계산하기");
    await press("구매");
    // 주문하는 동안 버튼 글이 바뀌어도(구현 몫) 그 버튼은 눌러지지 않는다
    expect(screen.queryByRole("button", { name: "구매" })).toBeNull();
    const busy = screen.getAllByRole("button").filter((b) => b.props.accessibilityState?.busy);
    expect(busy.length).toBeGreaterThan(0);
    for (const b of busy) {
      expect(b.props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(b);
    }
    expect(order).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    await flushAsync();
    expect(order).toHaveBeenCalledTimes(1);
  });

  it("M19: 홈이 주문을 맡지 않는 개발 화면 시험판에서는 '홈 화면에서 살 수 있어요'를 안내하고 장바구니는 그대로다", async () => {
    addToClothingCart("capOrange");
    await atCheckout({ order: undefined });
    await press("계산하기");
    await press("구매");
    await flushAsync();
    expect(textCount("홈 화면에서 살 수 있어요")).toBeGreaterThan(0);
    expect(clothingCart()).toEqual(["capOrange"]);
  });
});

describe("[spec] 미등록 13종은 담기에서 막힌다(M20)", () => {
  it("M20: 미등록 상품은 담기 단계에서 막힌다", () => {
    const product = clothingProduct("wear-top-kiln-jacket")!;
    expect(clothingCartBlock(product, null, false)).not.toBeNull();
  });
});
