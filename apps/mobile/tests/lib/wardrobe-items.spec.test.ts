// [spec] qa 테스트(작업 089 ② 착용 아이템 목록과 저장, 새 기능, 모바일): 앱의 착용 아이템 목록(C1~C3), 모바일 응답 타입(T1·T3),
// 아이템 종류에서 그릴 착용 부위로(W1~W5의 종류 → 모델 쪽).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/04-아이템-목록과-저장/03-qa-scenarios.md)와
// 04-main-decision.md(모바일 1: 모르는 종류·다른 부위 아이템은 그 부위만 입히지 않고, 응답 모양이 깨졌으면 아무것도 입지 않는다)에서만 가져온다.
// 구현 커밋 e98ad44에서 읽은 것은 부르는 방법뿐이다: 아이템 목록 WEARABLE_ITEMS(종류 → slot·label·wear),
// 서버의 입은 것을 그릴 착용 상태로 바꾸는 wearFromEquipped(equipped), 응답 타입 Wardrobe·WardrobeSlot(@/lib/types).
//
// W1~W5는 시나리오가 "라룹이 뼈에 붙는다"까지 적었다. 라룹이(Character)는 ①과 같이 부위마다 참·거짓(hat·top·bottom·shoes)을 받으므로,
// 여기서는 종류가 ①의 어느 부위 모델로 가는지(그 부위만 참)를 보고, 부위 모델이 뼈에 붙는 것은 ① qa 테스트
// (tests/components/lobby3d-wear-character.spec.test.tsx W1·W2·W5·U1, lobby3d-wear-right-shoe.spec.test.tsx)가 그대로 본다.
// T1·T3의 타입 확인은 모바일 타입 검사(tsc, 이 파일도 tsconfig에 든다)가 한다. 아래 상수가 컴파일되는 것이 단언이다.
import { WEARABLE_ITEMS, wearFromEquipped } from "@/lib/lobby3d/wear";
import type { Wardrobe, WardrobeSlot } from "@/lib/types";

// ---------- 시나리오의 값 ----------

const R0: Wardrobe = {
  items: [],
  equipped: { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null }
};

const R1: Wardrobe = {
  items: [{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" }],
  equipped: { hat: "capOrange", top: null, bottom: null, shoes: null, face: null, back: null, accessory: null }
};

// C3: 부위가 정확히 일곱이다(빠지면 키가 모자라고, 더 있으면 남는 키라 컴파일되지 않는다)
const SEVEN_SLOTS: Record<WardrobeSlot, true> = {
  hat: true,
  top: true,
  bottom: true,
  shoes: true,
  face: true,
  back: true,
  accessory: true
};

const NOTHING = { hat: false, top: false, bottom: false, shoes: false };

/** 참인 부위만(①의 착용 부위 넷). */
function wornSlots(wear: Record<string, boolean>): string[] {
  return ["hat", "top", "bottom", "shoes"].filter((slot) => wear[slot] === true);
}

// ---------- C. 앱의 아이템 목록 ----------

describe("[spec] 앱의 착용 아이템 목록(C1~C3)", () => {
  it("C1: 네 종류의 부위·이름이 명세 표대로다", () => {
    expect(WEARABLE_ITEMS.capOrange?.slot).toBe("hat");
    expect(WEARABLE_ITEMS.capOrange?.label).toBe("주황 야구모자");
    expect(WEARABLE_ITEMS.tshirtOrange?.slot).toBe("top");
    expect(WEARABLE_ITEMS.tshirtOrange?.label).toBe("주황 티셔츠");
    expect(WEARABLE_ITEMS.shortsNavy?.slot).toBe("bottom");
    expect(WEARABLE_ITEMS.shortsNavy?.label).toBe("남색 반바지");
    expect(WEARABLE_ITEMS.shoesBrown?.slot).toBe("shoes");
    expect(WEARABLE_ITEMS.shoesBrown?.label).toBe("갈색 운동화");
  });

  // 작업 089 ⑤ 04-main-decision.md A-2(사용자 결정): 아이템이 열여섯이 되어 "넷이고 face·back·accessory가 없다"를 새 목록(⑤ 명세 표)으로 고쳤다.
  it("C2: 종류가 정확히 열여섯이고, 부위가 명세 표와 같다", () => {
    expect(Object.entries(WEARABLE_ITEMS).map(([type, item]) => [type, item.slot]).sort()).toEqual(
      [
        ["capOrange", "hat"],
        ["capBlue", "hat"],
        ["capGreen", "hat"],
        ["tshirtOrange", "top"],
        ["tshirtWhite", "top"],
        ["tshirtYellow", "top"],
        ["shortsNavy", "bottom"],
        ["shortsBrown", "bottom"],
        ["shortsRed", "bottom"],
        ["shoesBrown", "shoes"],
        ["shoesRed", "shoes"],
        ["shoesWhite", "shoes"],
        ["sunglassesBlack", "face"],
        ["backpackRed", "back"],
        ["mufflerRed", "accessory"],
        ["necklaceGold", "accessory"]
      ].sort()
    );
  });

  it("C3: 부위는 hat·top·bottom·shoes·face·back·accessory 일곱이다", () => {
    expect(Object.keys(SEVEN_SLOTS)).toEqual(["hat", "top", "bottom", "shoes", "face", "back", "accessory"]);
  });
});

// ---------- T. 모바일 응답 타입 ----------

describe("[spec] 모바일 응답 타입(T1·T3)", () => {
  it("T1: 명세 JSON 예(R1)가 응답 타입으로 적히고, items[0]에 type·slot·acquiredAt, equipped에 일곱 부위가 있다", () => {
    expect(R1.items[0]).toEqual({ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" });
    expect(Object.keys(R1.equipped)).toEqual(["hat", "top", "bottom", "shoes", "face", "back", "accessory"]);
  });

  it("T3: 입지 않은 부위가 모두 null인 값(R0)도 응답 타입으로 적힌다", () => {
    expect(Object.values(R0.equipped)).toEqual([null, null, null, null, null, null, null]);
  });
});

// ---------- W. 종류에서 모델로 ----------

describe("[spec] 아이템 종류에서 그릴 착용 부위로(W1~W5, 결정 모바일 1)", () => {
  it("W1: hat이 capOrange이면 ①의 모자 부위만 입는다", () => {
    expect(wornSlots(wearFromEquipped(R1.equipped))).toEqual(["hat"]);
  });

  it("W2: top이 tshirtOrange이면 ①의 상의 부위만 입는다", () => {
    expect(wornSlots(wearFromEquipped({ ...R0.equipped, top: "tshirtOrange" }))).toEqual(["top"]);
  });

  it("W3: bottom이 shortsNavy이면 ①의 하의 부위만 입는다", () => {
    expect(wornSlots(wearFromEquipped({ ...R0.equipped, bottom: "shortsNavy" }))).toEqual(["bottom"]);
  });

  it("W4: shoes가 shoesBrown이면 ①의 신발 부위만 입는다", () => {
    expect(wornSlots(wearFromEquipped({ ...R0.equipped, shoes: "shoesBrown" }))).toEqual(["shoes"]);
  });

  it("W5: 일곱 부위가 모두 null이면 아무것도 입지 않는다", () => {
    expect(wearFromEquipped(R0.equipped)).toEqual(NOTHING);
  });

  it("결정 1: 모르는 종류가 든 부위만 빼고 나머지는 입는다(face의 모르는 종류, hat의 모르는 종류)", () => {
    expect(wornSlots(wearFromEquipped({ ...R0.equipped, hat: "capOrange", face: "glassesBlack" }))).toEqual(["hat"]);
    expect(wornSlots(wearFromEquipped({ ...R0.equipped, hat: "capPurple", top: "tshirtOrange" }))).toEqual(["top"]);
  });

  it("결정 1: 다른 부위에 든 아이템(hat에 tshirtOrange)은 그 부위만 입히지 않고 나머지는 입는다", () => {
    expect(wornSlots(wearFromEquipped({ ...R0.equipped, hat: "tshirtOrange", shoes: "shoesBrown" }))).toEqual(["shoes"]);
  });

  it("결정 1: 입은 것을 읽을 수 없으면(없음·null) 아무것도 입지 않는다", () => {
    expect(wearFromEquipped(undefined)).toEqual(NOTHING);
    expect(wearFromEquipped(null)).toEqual(NOTHING);
  });
});
