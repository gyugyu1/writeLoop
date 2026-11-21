// 옷집 계산 창의 '지금 입고 있는 옷'(메인 세션 테스트): 입은 옷은 처음부터 체크되어 장바구니와 함께 사고, 체크를 풀면 빼며,
// 판매 준비 중인 옷은 체크할 수 없고, 장바구니가 비어도 입은 옷만으로 살 수 있다. 장바구니에 같은 옷이 있으면 한 번만 센다.
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import ClothingCartSheet from "@/components/lobby3d/clothing-cart-sheet";
import { setItemCatalog } from "@/lib/item-catalog-store";
import { addToClothingCart, resetClothingShop } from "@/lib/lobby3d/clothing-stock";

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

beforeEach(() => {
  setItemCatalog({
    version: "cart-worn",
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
});

const buy = () => screen.getByRole("button", { name: "구매" });

describe("계산 창 '지금 입고 있는 옷'", () => {
  it("입은 옷은 체크된 채로 장바구니와 함께 산다(합계도 함께)", async () => {
    addToClothingCart("tshirtOrange");
    const onBuy = jest.fn();
    await render(<ClothingCartSheet visible worn={["capOrange", "mufflerRed"]} balance={500} buying={false} onClose={jest.fn()} onBuy={onBuy} />);
    expect(screen.getByText("지금 입고 있는 옷")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "주황 야구모자 60룹" }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByText("합계 230룹")).toBeTruthy();
    await act(async () => fireEvent.press(buy()));
    expect(onBuy).toHaveBeenCalledWith(
      [
        { type: "capOrange", price: 60 },
        { type: "mufflerRed", price: 90 },
        { type: "tshirtOrange", price: 80 }
      ],
      ["capOrange", "mufflerRed", "tshirtOrange"]
    );
  });

  it("체크를 풀면 그 옷은 빼고 산다", async () => {
    const onBuy = jest.fn();
    await render(<ClothingCartSheet visible worn={["capOrange", "mufflerRed"]} balance={500} buying={false} onClose={jest.fn()} onBuy={onBuy} />);
    await act(async () => fireEvent.press(screen.getByRole("checkbox", { name: "빨강 머플러 90룹" })));
    expect(screen.getByText("합계 60룹")).toBeTruthy();
    await act(async () => fireEvent.press(buy()));
    expect(onBuy).toHaveBeenCalledWith([{ type: "capOrange", price: 60 }], ["capOrange"]);
  });

  it("장바구니가 비어도 입은 옷만으로 살 수 있고, 모두 풀면 살 수 없다", async () => {
    await render(<ClothingCartSheet visible worn={["capOrange"]} balance={500} buying={false} onClose={jest.fn()} onBuy={jest.fn()} />);
    expect(buy().props.accessibilityState.disabled).toBe(false);
    await act(async () => fireEvent.press(screen.getByRole("checkbox", { name: "주황 야구모자 60룹" })));
    expect(buy().props.accessibilityState.disabled).toBe(true);
  });

  it("판매 준비 중인 옷은 체크할 수 없고 주문에 들어가지 않는다", async () => {
    const onBuy = jest.fn();
    await render(
      <ClothingCartSheet visible worn={["wear-hat-breakwater-bucket", "capOrange"]} balance={500} buying={false} onClose={jest.fn()} onBuy={onBuy} />
    );
    const row = screen.getByRole("checkbox", { name: /판매 준비 중/ });
    expect(row.props.accessibilityState).toEqual(expect.objectContaining({ checked: false, disabled: true }));
    await act(async () => fireEvent.press(buy()));
    expect(onBuy).toHaveBeenCalledWith([{ type: "capOrange", price: 60 }], ["capOrange"]);
  });

  it("장바구니에 같은 옷이 있으면 입은 옷 줄에 다시 보이지 않고 한 번만 센다", async () => {
    addToClothingCart("capOrange");
    await render(<ClothingCartSheet visible worn={["capOrange"]} balance={500} buying={false} onClose={jest.fn()} onBuy={jest.fn()} />);
    expect(screen.queryByText("지금 입고 있는 옷")).toBeNull();
    expect(screen.getByText("합계 60룹")).toBeTruthy();
  });

  it("입은 옷 합계가 잔액보다 크면 모자란다고 보이고 살 수 없다", async () => {
    await render(<ClothingCartSheet visible worn={["capOrange", "mufflerRed"]} balance={100} buying={false} onClose={jest.fn()} onBuy={jest.fn()} />);
    expect(screen.getByText("룹이 50 모자라요")).toBeTruthy();
    expect(buy().props.accessibilityState.disabled).toBe(true);
  });
});
