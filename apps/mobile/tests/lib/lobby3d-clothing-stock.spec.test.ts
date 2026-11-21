// [spec] qa 테스트(작업 133 ② 옷집 진열·상품 선택·장바구니 담기, 새 기능, 모바일): 상품 자료·상태(진열 여부·장바구니)·가격 글·담기 판정·예비 자리.
// 기대값은 private 작업 폴더 133-2026-11-21-옷가게-실내-구매/03-진열-상품선택-장바구니/02-qa-scenarios.md(S번호)의 표에서만 가져온다.
// 구현 코드는 부르는 방법(clothing-stock의 함수 이름)을 알려고만 읽었다.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { activePlaceIds, applyArea } from "@/lib/lobby3d/engine";
import {
  CLOTHING_PRODUCTS,
  CLOTHING_RESERVE_MOUNTS,
  addToClothingCart,
  clothingCart,
  clothingCartBlock,
  clothingDisplayed,
  clothingPriceText,
  clothingProduct,
  clothingProductsOnFloor,
  removeFromClothingCart,
  resetClothingShop,
  setClothingDisplayed
} from "@/lib/lobby3d/clothing-stock";

const MOBILE = join(__dirname, "..", "..");
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

// [id, 이름, 부위, 층, 진열대, 가격(미등록 null)]
const TABLE: [string, string, string, 1 | 2, string, number | null][] = [
  ["wear-top-kiln-jacket", "코랄 워크 재킷", "top", 1, "F1_Slot_WallWest", null],
  ["wear-bottom-sage-cargo", "세이지 카고 쇼츠", "bottom", 1, "F1_Slot_WallEast", null],
  ["wear-hat-breakwater-bucket", "마린 버킷햇", "hat", 1, "F1_Slot_WindowJacket", null],
  ["wear-top-tide-sailor", "스트라이프 세일러 니트", "top", 1, "F1_Slot_WindowJacket", null],
  ["wear-bottom-jetty-denim", "인디고 데님 쇼츠", "bottom", 1, "F1_Slot_WindowJacket", null],
  ["shoesWhite", "흰 운동화", "shoes", 1, "F1_Slot_WindowJacket", 90],
  ["capOrange", "주황 야구모자", "hat", 1, "F1_Slot_Table", 60],
  ["capBlue", "파랑 야구모자", "hat", 1, "F1_Slot_WindowDress", 60],
  ["mufflerRed", "빨강 머플러", "accessory", 1, "F1_Slot_RailEast", 90],
  ["wear-top-field-blouse", "디지털 무늬 전투복 상의", "top", 2, "F2_Slot_AtelierDress", null],
  ["wear-bottom-field-trousers", "카고 포켓 전투복 하의", "bottom", 2, "F2_Slot_AtelierDress", null],
  ["wear-shoe-combat-boot", "끈 전투화 한 켤레", "shoes", 2, "F2_Slot_AtelierDress", null],
  ["wear-top-quilted-liner", "군대 깔깔이", "top", 2, "F2_Slot_AtelierJacket", null],
  ["wear-hat-peddler-straw", "장돌뱅이 모자", "hat", 2, "F2_Slot_Peddler", null],
  ["wear-hat-bramble-beret", "베리 베레모", "hat", 2, "F2_Slot_Beret", null],
  ["necklaceGold", "금 목걸이", "accessory", 2, "F2_Slot_BucketHat", 110],
  ["wear-face-honey-panto", "허니 팬토 선글라스", "face", 1, "F1_Slot_HarborTable", null],
  ["backpackRed", "빨강 백팩", "back", 1, "F1_Slot_HarborRail", 120],
  ["shoesBrown", "갈색 운동화", "shoes", 2, "F2_Slot_FieldBootTable", 90],
  ["wear-hat-field-cap", "차양형 전투모", "hat", 2, "F2_Slot_FieldCapTable", null],
  ["tshirtOrange", "주황 티셔츠", "top", 2, "F2_Slot_StudioRail", 80],
  ["shortsNavy", "남색 반바지", "bottom", 2, "F2_Slot_FieldRail", 70]
];

afterEach(() => {
  resetClothingShop();
  applyArea("room");
});

describe("[spec] 자료 읽기(S01~S04)", () => {
  it("S01: 상품 22종, id·층 구성이 표와 같다(1층 11·2층 11, 등록 9·미등록 13)", () => {
    expect(CLOTHING_PRODUCTS.map((p) => p.id)).toEqual(TABLE.map((t) => t[0]));
    expect(clothingProductsOnFloor(1)).toHaveLength(11);
    expect(clothingProductsOnFloor(2)).toHaveLength(11);
    expect(CLOTHING_PRODUCTS.filter((p) => p.catalogId)).toHaveLength(9);
    expect(CLOTHING_PRODUCTS.filter((p) => !p.catalogId)).toHaveLength(13);
  });

  it("S02: 상품마다 이름·부위·층·진열대·pickNode·displayAnchor가 표와 stock.json 규칙 그대로다", () => {
    for (const [id, name, slot, floor, station] of TABLE) {
      const p = clothingProduct(id)!;
      expect({ id, name: p.name, slot: p.slot, floor: p.floor, station: p.station }).toEqual({ id, name, slot, floor, station });
      expect(p.pickNode).toBe(`Stock_${id}`);
      expect(p.displayAnchor).toBe(`F${floor}_Item_${id}`);
    }
    expect(clothingProduct("shoesWhite")!.outfitIds).toEqual(["harborMarine"]);
    expect(clothingProduct("wear-hat-field-cap")!.outfitIds).toEqual(["fieldUniform"]);
    expect(clothingProduct("tshirtOrange")!.outfitIds).toEqual([]);
    expect(clothingProduct("tshirtOrange")!.catalogId).toBe("tshirtOrange");
    expect(clothingProduct("wear-top-kiln-jacket")!.catalogId).toBeNull();
  });

  it("S03: 명패·이름표 자리는 layout 슬롯에서 진열대 이름으로 읽는다(F1_Slot_X -> F1_Nameplate_X·F1_ProductName_X)", () => {
    for (const [id, , , floor, station] of TABLE) {
      const suffix = station.replace(`F${floor}_Slot_`, "");
      const p = clothingProduct(id)!;
      expect({ id, nameplate: p.nameplate, textAnchor: p.textAnchor }).toEqual({
        id,
        nameplate: `F${floor}_Nameplate_${suffix}`,
        textAnchor: `F${floor}_ProductName_${suffix}`
      });
    }
  });

  it("S04: 앱 자산 진열 상품 GLB와 stock.json이 애셋 최종본과 같고 CREDITS.md에 진열 상품 모델 줄이 있다", () => {
    const glb = join(MOBILE, "assets", "models", "clothing-shop", "clothing-display-samples.glb");
    expect(readFileSync(glb).length).toBe(2694924);
    expect(sha256(glb)).toBe("b1a9078e910e00433b33e34cf353477aad2f67e33ae59ad3983c39ddb277e62f");
    expect(sha256(join(MOBILE, "src", "lib", "lobby3d", "clothing-shop-stock.json"))).toBe(
      "261420f62340e9ca0978009f2aff0162616a8c630955001816f4fb57687e71bc"
    );
    const lines = readFileSync(join(MOBILE, "assets", "models", "CREDITS.md"), "utf8").split(/\r?\n/);
    const found = lines.filter((l) => l.includes("`clothing-shop/clothing-display-samples.glb`"));
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("WriteLoop");
    expect(found[0]).toContain("Blender");
  });
});

describe("[spec] 상태(S05~S06)", () => {
  it("S05: 처음은 22종 모두 진열, 장바구니는 비어 있다", () => {
    const shown = clothingDisplayed();
    expect(CLOTHING_PRODUCTS.every((p) => shown[p.id] === true)).toBe(true);
    expect(clothingCart()).toEqual([]);
  });

  it("S06: 같은 상품은 한 번만, 담은 순서가 유지된다", () => {
    addToClothingCart("tshirtOrange");
    addToClothingCart("shortsNavy");
    addToClothingCart("tshirtOrange");
    expect(clothingCart()).toEqual(["tshirtOrange", "shortsNavy"]);
  });

  it("S06b: 장바구니 빼기는 그 상품만 뺀다", () => {
    addToClothingCart("tshirtOrange");
    addToClothingCart("shortsNavy");
    removeFromClothingCart("tshirtOrange");
    expect(clothingCart()).toEqual(["shortsNavy"]);
  });
});

describe("[spec] 진열 해제와 복구(S34~S38)", () => {
  it("S36: 진열을 끄면 장바구니에서 빠지고 다른 담은 상품은 순서 그대로", () => {
    addToClothingCart("tshirtOrange");
    addToClothingCart("shortsNavy");
    addToClothingCart("capBlue");
    setClothingDisplayed("shortsNavy", false);
    expect(clothingDisplayed().shortsNavy).toBe(false);
    expect(clothingCart()).toEqual(["tshirtOrange", "capBlue"]);
  });

  it("S37: 다시 켜면 진열이 돌아오고 장바구니에는 다시 들어가지 않는다", () => {
    addToClothingCart("shortsNavy");
    setClothingDisplayed("shortsNavy", false);
    setClothingDisplayed("shortsNavy", true);
    expect(clothingDisplayed().shortsNavy).toBe(true);
    expect(clothingCart()).toEqual([]);
  });

  it("S34: 한 상품을 꺼도 다른 상품은 모두 진열 그대로", () => {
    setClothingDisplayed("capBlue", false);
    const shown = clothingDisplayed();
    expect(CLOTHING_PRODUCTS.filter((p) => !shown[p.id]).map((p) => p.id)).toEqual(["capBlue"]);
  });

  it("S38: 진열을 끈 상품은 담을 수 없다(담기 판정이 막힌다)", () => {
    setClothingDisplayed("capBlue", false);
    expect(clothingCartBlock(clothingProduct("capBlue")!, 60, false)).not.toBeNull();
  });
});

describe("[spec] 가격 글과 담기 판정(S19~S21, S25~S28)", () => {
  it("S19: 등록 9종의 가격 글은 서버 가격 그대로 '<가격>룹'이다", () => {
    for (const [id, , , , , price] of TABLE) {
      if (price === null) continue;
      expect({ id, text: clothingPriceText(clothingProduct(id)!, price, false) }).toEqual({ id, text: `${price}룹` });
    }
  });

  it("S20: 미등록 13종은 '판매 준비 중'이다", () => {
    for (const [id, , , , , price] of TABLE) {
      if (price !== null) continue;
      expect({ id, text: clothingPriceText(clothingProduct(id)!, null, false) }).toEqual({ id, text: "판매 준비 중" });
    }
  });

  it("S21: 가진 옷은 가격 대신 '가진 옷'이다", () => {
    expect(clothingPriceText(clothingProduct("tshirtOrange")!, 80, true)).toBe("가진 옷");
  });

  it("S25: 등록·미보유·미담음이면 담을 수 있다(막는 이유 없음)", () => {
    expect(clothingCartBlock(clothingProduct("tshirtOrange")!, 80, false)).toBeNull();
  });

  it("S26: 미등록은 담을 수 없다", () => {
    expect(clothingCartBlock(clothingProduct("wear-top-kiln-jacket")!, null, false)).not.toBeNull();
  });

  it("S27: 가진 옷은 담을 수 없다", () => {
    expect(clothingCartBlock(clothingProduct("tshirtOrange")!, 80, true)).not.toBeNull();
  });

  it("S28: 이미 담은 상품은 다시 담을 수 없다", () => {
    addToClothingCart("tshirtOrange");
    expect(clothingCartBlock(clothingProduct("tshirtOrange")!, 80, false)).not.toBeNull();
  });
});

describe("[spec] 예비 진열 자리(S31, S33)", () => {
  it("S31: 빈 자리 노드는 합계 16개이고 상품의 displayAnchor와 겹치지 않는다", () => {
    for (const floor of [1, 2] as const) {
      for (const p of clothingProductsOnFloor(floor)) expect(CLOTHING_RESERVE_MOUNTS[floor]).not.toContain(p.displayAnchor);
    }
    expect(CLOTHING_RESERVE_MOUNTS[1].length + CLOTHING_RESERVE_MOUNTS[2].length).toBe(16);
  });

  it("S33: 1·2층 장소 목록에 예비 자리로 가는 장소가 없다", () => {
    applyArea("clothing1");
    expect([...activePlaceIds()].sort()).toEqual(["clothingExit", "clothingFitting1", "clothingUp"]);
    applyArea("clothing2");
    expect([...activePlaceIds()]).toEqual(["clothingDown", "clothingFitting2"]);
  });
});
