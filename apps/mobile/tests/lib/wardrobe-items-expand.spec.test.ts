// [spec] qa 테스트(작업 089 ⑤ 아이템 늘리기, 새 기능, 모바일): 앱의 착용 아이템 목록 열여섯(시나리오 C1~C3), 서버의 입은 것을 그릴 값으로(C4~C6),
// 아이템마다 칸 그림(C7).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/03-qa-scenarios.md의 C)와
// 04-main-decision.md B(A-4: 그리기에는 부위 일곱의 종류를 look으로 따로 넘긴다)에서만 가져온다.
// 구현 커밋 59b34f2에서 읽은 것은 부르는 방법뿐이다: 아이템 목록 WEARABLE_ITEMS(종류 → slot·label), 서버의 입은 것을 그릴 값(look)으로 바꾸는
// lookFromEquipped(equipped), 칸 그림 wearableIcon(종류).
// 090-③ 옷 내려받기(05-main-decision 2, 사용자 결정 "qa가 새 동작에 맞게 고침"): 옷 칸 그림은 앱에서 빠지고 받은 아이템 목록의
// 그림 파일을 기기에 받아 쓴다. 그래서 C7은 서버 목록 파일의 옷으로 목록을 두고 그 그림 파일을 기기에 둔 채로 본다(단언은 그대로).
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { WEARABLE_ITEMS, lookFromEquipped } from "@/lib/lobby3d/wear";
import { wearableIcon } from "@/lib/lobby3d/wearable-icons";
import { putOnDevice, serverWearCatalog, serverWearable } from "../__fixtures__/wear-files-090";

jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());

// ---------- 시나리오의 값 ----------

/** 시나리오 "아이템 열여섯" 표(종류, 부위, 이름). */
const ITEMS: [string, string, string][] = [
  ["capOrange", "hat", "주황 야구모자"],
  ["capBlue", "hat", "파랑 야구모자"],
  ["capGreen", "hat", "초록 야구모자"],
  ["tshirtOrange", "top", "주황 티셔츠"],
  ["tshirtWhite", "top", "흰 티셔츠"],
  ["tshirtYellow", "top", "노랑 티셔츠"],
  ["shortsNavy", "bottom", "남색 반바지"],
  ["shortsBrown", "bottom", "갈색 반바지"],
  ["shortsRed", "bottom", "빨강 반바지"],
  ["shoesBrown", "shoes", "갈색 운동화"],
  ["shoesRed", "shoes", "빨강 운동화"],
  ["shoesWhite", "shoes", "흰 운동화"],
  ["sunglassesBlack", "face", "검정 선글라스"],
  ["backpackRed", "back", "빨강 백팩"],
  ["mufflerRed", "accessory", "빨강 머플러"],
  ["necklaceGold", "accessory", "금 목걸이"]
];

const NO_LOOK = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };
const WB_EQUIPPED = {
  hat: "capGreen",
  top: "tshirtYellow",
  bottom: "shortsRed",
  shoes: "shoesWhite",
  face: "sunglassesBlack",
  back: "backpackRed",
  accessory: "necklaceGold"
};
const WX_EQUIPPED = { hat: "capBlue", top: null, bottom: null, shoes: null, face: "glassesRound", back: "mufflerRed", accessory: null };

// ---------- C. 앱의 아이템 목록 ----------

describe("[spec] 089-⑤ C1~C3: 앱의 착용 아이템 목록", () => {
  // 작업 089 ⑤ 08-main-decision.md "기존 테스트"(사용자 결정)·12-B: 라룹이 고글(goggles)이 앱 아이템이 되어 열일곱으로 고쳤다.
  it("C1 종류가 정확히 열일곱(열여섯 + 라룹이 고글)이고 glassesRound(둥근 안경)는 없다", () => {
    expect(Object.keys(WEARABLE_ITEMS).sort()).toEqual([...ITEMS.map(([type]) => type), "goggles"].sort());
    expect(WEARABLE_ITEMS.glassesRound).toBeUndefined();
  });

  it("C2 열여섯 각각의 부위와 이름이 표와 글자까지 같다", () => {
    expect(ITEMS.map(([type]) => [type, WEARABLE_ITEMS[type]?.slot, WEARABLE_ITEMS[type]?.label])).toEqual(ITEMS);
  });

  it("C3 이미 있던 넷은 그대로다", () => {
    expect(
      ["capOrange", "tshirtOrange", "shortsNavy", "shoesBrown"].map((type) => [type, WEARABLE_ITEMS[type]?.slot, WEARABLE_ITEMS[type]?.label])
    ).toEqual([
      ["capOrange", "hat", "주황 야구모자"],
      ["tshirtOrange", "top", "주황 티셔츠"],
      ["shortsNavy", "bottom", "남색 반바지"],
      ["shoesBrown", "shoes", "갈색 운동화"]
    ]);
  });
});

// ---------- C4~C6. 서버의 입은 것 → 그릴 값 ----------

describe("[spec] 089-⑤ C4~C6: 서버의 입은 것을 그릴 값(부위 일곱 → 종류)으로", () => {
  it("C4 WB의 equipped는 일곱 부위 그대로 그린다", () => {
    expect(lookFromEquipped(WB_EQUIPPED)).toEqual(WB_EQUIPPED);
  });

  it("C5 모르는 종류(face glassesRound)와 다른 부위 아이템(back에 mufflerRed)은 그 부위만 입히지 않는다", () => {
    expect(lookFromEquipped(WX_EQUIPPED)).toEqual({ ...NO_LOOK, hat: "capBlue" });
  });

  it("C6 입은 것이 null·undefined면 아무것도 입지 않는다", () => {
    expect(lookFromEquipped(null)).toEqual(NO_LOOK);
    expect(lookFromEquipped(undefined)).toEqual(NO_LOOK);
  });
});

// ---------- C7. 칸 그림 ----------

describe("[spec] 089-⑤ C7: 아이템마다 칸 그림", () => {
  it("C7 열여섯 모두 그림이 있고 서로 다르며, glassesRound는 그림이 없다", () => {
    setItemCatalog(parseItemCatalog(serverWearCatalog())!);
    for (const [type] of ITEMS) putOnDevice(serverWearable(type).assets!.icon!);
    const icons = ITEMS.map(([type]) => wearableIcon(type));
    expect(icons.filter((icon) => icon === null || icon === undefined)).toEqual([]);
    expect(new Set(icons.map((icon) => JSON.stringify(icon))).size).toBe(16);
    expect(wearableIcon("glassesRound")).toBeNull();
  });
});
