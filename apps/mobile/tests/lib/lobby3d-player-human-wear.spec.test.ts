// [spec] qa 테스트(작업 134 ① 플레이어 교체, 기능 변경, 모바일): 앱의 몸판(WEAR_BODY)을 사람형(2)으로 올리고, 라룹이 고글을 기본으로 씌우지 않는다.
// 기대값은 명세(private 작업 폴더 134-2026-11-22-사람형-플레이어-교체/02-플레이어-교체/01-main-spec.md)의 "바뀌는 동작 6"에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
// - 앱의 몸판 WEAR_BODY는 2다. 그리기 정보의 body가 1인 옷은 '그릴 줄 모르는 옷'(wearDraw null, 그릴 수 없는 옷)이다.
//   body가 2인 옷은 지금 규칙대로 그릴 수 있다(②에서 서버 목록이 사람형으로 바뀌면 그 옷이 그려진다).
// - 개발 화면 시험판의 기본 모습(DEFAULT_LOOK)과, 입은 것을 모를 때(look 없음)의 모습(shownLook)은 고글 없이 기본 착장만이다(얼굴장식 없음).
// 옷은 서버 목록 파일(items.json)의 옷을 응답 모양으로 만든 도우미(tests/__fixtures__/wear-files-090.ts)에서 그리기 정보의 body만 바꿔 쓴다.
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { DEFAULT_LOOK, NO_LOOK, NO_WEAR, WEAR_BODY, isWearableDrawable, itemsInSlot, shownLook, wearDraw, type WearLook } from "@/lib/lobby3d/wear";
import { serverWearCatalog } from "../__fixtures__/wear-files-090";

jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());

/** 서버 목록 파일의 옷 중 그릴 정보가 있는 것을, 그리기 정보의 body만 바꿔 앱에 둔다. */
function setCatalogWithBody(body: number, version: string) {
  const catalog = serverWearCatalog(version);
  const items = catalog.items
    .filter((item) => item.draw && (item.assets as unknown))
    .map((item): Record<string, unknown> => ({ ...item, draw: { ...(item.draw as Record<string, unknown>), body } }));
  setItemCatalog(parseItemCatalog({ ...catalog, items })!);
  return items.map((item) => item.id as string);
}

describe("[spec] 134-① 앱의 몸판은 사람형(2)이다", () => {
  it("[바뀔] WEAR_BODY는 2다", () => {
    expect(WEAR_BODY).toBe(2);
  });

  it("[바뀔] 그리기 정보 body가 1인 옷(라룹이 몸 옷)은 그릴 줄 모르는 옷이다: wearDraw가 null, 그릴 수 없고, 부위 차례에서 빠진다", () => {
    const ids = setCatalogWithBody(1, "qa-134-body1");
    expect(ids.length).toBeGreaterThan(0);
    const result = ids.map((id) => ({ id, draw: wearDraw(id), drawable: isWearableDrawable(id) }));
    expect(result.filter((r) => r.draw !== null || r.drawable)).toEqual([]);
    expect(itemsInSlot("top").filter((id) => ids.includes(id))).toEqual([]);
    expect(itemsInSlot("shoes").filter((id) => ids.includes(id))).toEqual([]);
  });

  it("[바뀔] 그리기 정보 body가 2인 옷(사람형 옷)은 그릴 수 있다: wearDraw가 있고, 부위 차례에 든다", () => {
    const ids = setCatalogWithBody(2, "qa-134-body2");
    expect(ids.length).toBeGreaterThan(0);
    const result = ids.map((id) => ({ id, draw: wearDraw(id) !== null, drawable: isWearableDrawable(id) }));
    expect(result.filter((r) => !r.draw || !r.drawable)).toEqual([]);
    expect(itemsInSlot("top").length).toBeGreaterThan(0);
  });
});

describe("[spec] 134-① 라룹이 고글을 기본으로 씌우지 않는다", () => {
  it("[바뀔] 개발 화면 시험판의 기본 모습(DEFAULT_LOOK)은 아무것도 입지 않은 일곱 부위(얼굴장식 없음)다", () => {
    expect(DEFAULT_LOOK).toEqual({ hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null });
    expect(DEFAULT_LOOK).toEqual(NO_LOOK);
  });

  it("[바뀔] 입은 것을 모를 때(look 없음) 그릴 모습의 얼굴장식은 없음이다", () => {
    setCatalogWithBody(2, "qa-134-shown");
    expect(shownLook(NO_WEAR, null).face).toBeNull();
    expect(shownLook(NO_WEAR, undefined).face).toBeNull();
  });

  it("[그대로] 입은 것을 알면(look 있음) 그 모습을 그대로 그린다", () => {
    const look: WearLook = { ...NO_LOOK, top: "tshirtWhite", face: "sunglassesBlack" };
    expect(shownLook(NO_WEAR, look)).toBe(look);
  });
});
