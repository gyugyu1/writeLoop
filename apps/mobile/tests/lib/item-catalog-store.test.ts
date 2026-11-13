// 아이템 목록 읽기(item-catalog-store): 응답 모양이 틀리면 목록 전체를 못 받은 것으로 보고,
// 칸 값이 틀리거나 앱이 모르는 값(새 종류·분류)이 든 아이템은 그 아이템만 건너뛴다(090-① 12 결정).
import { parseItemCatalog } from "@/lib/item-catalog-store";

const bed = {
  id: "bed",
  kind: "furniture",
  name: "침대",
  shopName: "침대",
  description: "하루를 마무리하는 포근한 자리예요.",
  category: "furniture",
  slot: null,
  price: 300,
  assets: null
};

describe("parseItemCatalog", () => {
  test("응답 모양이 틀리면 null", () => {
    expect(parseItemCatalog(null)).toBeNull();
    expect(parseItemCatalog([bed])).toBeNull();
    expect(parseItemCatalog({ items: [bed] })).toBeNull();
    expect(parseItemCatalog({ version: "", items: [bed] })).toBeNull();
    expect(parseItemCatalog({ version: "v1", items: "broken" })).toBeNull();
  });

  test("모르는 종류·분류나 틀린 칸 값이 든 아이템만 건너뛰고 나머지는 쓴다", () => {
    const parsed = parseItemCatalog({
      version: "v2",
      items: [
        { ...bed, id: "pet", kind: "pet" },
        { ...bed, id: "sofa", category: "seasonal" },
        { ...bed, id: "broken", name: 3 },
        "not an item",
        bed
      ]
    });

    expect(parsed).toEqual({
      version: "v2",
      items: [{ id: "bed", kind: "furniture", name: "침대", shopName: "침대", description: "하루를 마무리하는 포근한 자리예요.", category: "furniture", slot: null, price: 300 }]
    });
  });
});
