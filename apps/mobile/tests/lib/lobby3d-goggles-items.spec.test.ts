// [spec] qa 테스트(작업 089 ⑤ 라룹이 고글·새 몸 넣기, 새 기능, 모바일): 앱 목록과 그릴 값(시나리오 10-qa-scenarios.md의 GC1~GC4),
// 실제 서버 목록 파일의 옷을 앱이 읽을 때(23-qa-scenarios.md의 NF8)와 앱의 몸 판(NF2의 "앱의 WEAR_BODY도 1").
// 기대값은 시나리오 10(GC)·23(NF2·NF8)과 08·11-main-decision.md(B1: 고글은 앱 목록에서 얼굴장식의 첫 아이템, B5: 모르는 종류는 그 부위만 빼서 맨얼굴)에서만 가져온다.
// 구현에서 읽은 것은 부르는 방법뿐이다: 앱 이름표 WEARABLE_ITEMS, 부위의 아이템 차례 itemsInSlot(부위), 서버의 입은 것을 그릴 값으로 lookFromEquipped,
// 그리기 정보 wearDraw(종류), 앱의 몸 판 WEAR_BODY, 목록 두기 setItemCatalog(parseItemCatalog(응답)).
// "받은 목록 없음"은 모듈을 새로 불러와(jest.isolateModules) 앱을 켜고 아직 목록을 받지 못한 상태를 흉내 낸다.
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { WEARABLE_ITEMS, WEAR_BODY, itemsInSlot, lookFromEquipped, wearDraw } from "@/lib/lobby3d/wear";
import { serverWearCatalog } from "../__fixtures__/wear-files-090";

jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());

const SIXTEEN = [
  "capOrange", "capBlue", "capGreen", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shortsNavy", "shortsBrown",
  "shortsRed", "shoesBrown", "shoesRed", "shoesWhite", "sunglassesBlack", "backpackRed", "mufflerRed", "necklaceGold"
];
const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

/** 목록을 받지 못한 상태의 모듈. */
function freshWear(): typeof import("@/lib/lobby3d/wear") {
  let mod!: typeof import("@/lib/lobby3d/wear");
  jest.isolateModules(() => {
    mod = require("@/lib/lobby3d/wear");
  });
  return mod;
}

describe("[spec] 089-⑤ 10 GC1~GC4: 앱 목록과 그릴 값", () => {
  it("GC1 앱 착용 아이템 목록의 종류가 열일곱(⑤의 열여섯 + goggles)이고 goggles의 부위는 face, 이름은 \"라룹이 고글\"이다", () => {
    expect(Object.keys(WEARABLE_ITEMS).sort()).toEqual([...SIXTEEN, "goggles"].sort());
    expect({ slot: WEARABLE_ITEMS.goggles?.slot, label: WEARABLE_ITEMS.goggles?.label }).toEqual({ slot: "face", label: "라룹이 고글" });
  });

  it("GC2 받은 목록이 없을 때 얼굴장식 아이템 순서가 [goggles, sunglassesBlack]이다", () => {
    expect(freshWear().itemsInSlot("face")).toEqual(["goggles", "sunglassesBlack"]);
  });

  it("GC2 서버 목록 파일의 옷을 받은 뒤에도 얼굴장식 아이템 순서가 [goggles, sunglassesBlack]이다(고글이 얼굴장식의 첫 아이템)", () => {
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-089-gc2"))!);
    expect(itemsInSlot("face")).toEqual(["goggles", "sunglassesBlack"]);
  });

  it("GC3 서버 equipped { ...ALL_NULL, face: goggles }를 그릴 값으로 바꾸면 { ...ALL_NULL, face: goggles }다(목록 없음·서버 목록 모두)", () => {
    const equipped = { ...ALL_NULL, face: "goggles" };
    expect(freshWear().lookFromEquipped(equipped)).toEqual({ ...ALL_NULL, face: "goggles" });
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-089-gc3"))!);
    expect(lookFromEquipped(equipped)).toEqual({ ...ALL_NULL, face: "goggles" });
  });

  it("GC4 equipped { ...ALL_NULL, face: glassesRound }면 look.face가 null(맨얼굴)이고 look 자체는 null이 아니다", () => {
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-089-gc4"))!);
    const value = lookFromEquipped({ ...ALL_NULL, face: "glassesRound" });
    expect(value).not.toBeNull();
    expect(value).toEqual(ALL_NULL);
  });
});

describe("[spec] 089-⑤ 23 NF2·NF8: 새 옷 파일을 앱이 읽을 때", () => {
  it("NF2 앱의 WEAR_BODY는 1이다", () => {
    expect(WEAR_BODY).toBe(1);
  });

  it("NF8 지금 서버 목록 파일의 옷을 응답 모양으로 앱에 넣으면 열여섯과 조끼 모두 그릴 수 있는 옷(wearDraw가 null 아님)이다", () => {
    setItemCatalog(parseItemCatalog(serverWearCatalog("qa-089-nf8"))!);
    for (const type of [...SIXTEEN, "vestGreen"]) expect({ type, drawable: wearDraw(type) !== null }).toEqual({ type, drawable: true });
  });
});
