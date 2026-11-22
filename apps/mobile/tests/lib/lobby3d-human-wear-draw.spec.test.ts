// [spec] qa 테스트(작업 134 ② 사람형 착용물 연결, 기능 변경, 모바일): 그리기 정보의 hide 읽기, 사람형 고글(다시 그릴 수 있는 옷), 앱 파일 wear-goggles-human.glb,
// 서버 목록 파일(items.json)의 옷이 body 2·사람형 정보로 바뀐 뒤 앱이 그 옷을 그릴 수 있는 옷으로 읽는지.
// 기대값은 명세(private 작업 폴더 134-2026-11-22-사람형-플레이어-교체/03-사람형-착용물/01-main-spec.md)의 바뀌는 동작 1·3과 "그대로여야 할 동작"에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(03-qa-tests.md의 분류와 같다).
// 가정(명세에 이름이 없는 것): 그리기 정보를 읽은 값(wearDraw)의 hide 칸은 문자열 배열이다(없으면 빈 배열).
// 서버 목록은 서버 파일 그대로(fixture의 body 2 덮어쓰기 없이) 응답 모양으로 만들어 쓴다.
import { createHash } from "crypto";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { closetItems } from "@/lib/lobby3d/closet";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";
import { DEFAULT_LOOK, NO_WEAR, isWearableDrawable, itemsInSlot, shownLook, wearDraw } from "@/lib/lobby3d/wear";
import { MOBILE_DIR, fakeRef, rawServerItems, serverRef } from "../__fixtures__/wear-files-090";

jest.mock("expo-file-system", () => require("../__fixtures__/wear-files-090").fakeExpoFileSystem());

type Draw = Record<string, unknown>;
let round = 0;

/** 옷 하나를 받은 목록에 두고(모델 파일은 가짜 해시), 그 id로 그리기 정보를 읽는다. */
function drawOf(draw: Draw | undefined) {
  round += 1;
  const id = `qaHide${round}`;
  const item: Record<string, unknown> = {
    id,
    kind: "wearable",
    name: "QA 옷",
    shopName: "QA 옷",
    description: "",
    category: null,
    slot: "top",
    price: null,
    assets: { model: fakeRef(`qa134-2-${round}`, "glb"), icon: null }
  };
  if (draw) item.draw = draw;
  setItemCatalog(parseItemCatalog({ version: `qa134-2-${round}`, items: [item] })!);
  return wearDraw(id) as (ReturnType<typeof wearDraw> & { hide?: unknown }) | null;
}

describe("[spec] 134-② 그리기 정보의 hide(숨길 기본 메시 이름)를 읽는다", () => {
  it("[바뀔] hide 배열의 이름을 그대로 읽는다", () => {
    expect(drawOf({ attach: "skin", body: 2, hide: ["top_white_pocket_tee"] })!.hide).toEqual(["top_white_pocket_tee"]);
    expect(drawOf({ attach: "bone", bone: "foot_l", mirror: "foot_r", body: 2, hide: ["shoe_canvas_l", "shoe_canvas_r", "socks"] })!.hide).toEqual([
      "shoe_canvas_l",
      "shoe_canvas_r",
      "socks"
    ]);
  });

  it("[바뀔] hide가 없으면 빈 목록이고, 그려지는 옷이다", () => {
    const draw = drawOf({ attach: "skin", body: 2 });
    expect(draw).not.toBeNull();
    expect(draw!.hide).toEqual([]);
  });

  it("[바뀔] hide가 빈 배열이면 빈 목록이다", () => {
    expect(drawOf({ attach: "bone", bone: "head", body: 2, hide: [] })!.hide).toEqual([]);
  });

  it("[바뀔] hide에 문자열이 아닌 값이 섞이면 그 값만 무시하고 나머지 문자열을 읽는다(옷은 그대로 그려진다)", () => {
    const draw = drawOf({ attach: "skin", body: 2, hide: ["socks", 3, null, { a: 1 }, ["x"], true, "shoe_canvas_l"] });
    expect(draw).not.toBeNull();
    expect(draw!.hide).toEqual(["socks", "shoe_canvas_l"]);
  });

  it("[그대로] 부착·뼈·좌우·색 읽기는 바뀌지 않는다(hide를 더해도)", () => {
    const draw = drawOf({ attach: "bone", bone: "foot_l", mirror: "foot_r", color: "#C8443A", body: 2, hide: ["shoe_canvas_l"] })!;
    expect({ attach: draw.attach, bone: draw.bone, mirror: draw.mirror, color: draw.color }).toEqual({
      attach: "bone",
      bone: "foot_l",
      mirror: "foot_r",
      color: "#C8443A"
    });
  });

  it("[그대로] body가 2가 아닌 옷(조끼처럼 body 1)은 hide가 있어도 그릴 줄 모르는 옷이다", () => {
    expect(drawOf({ attach: "skin", body: 1, hide: ["top_white_pocket_tee"] })).toBeNull();
  });
});

describe("[spec] 134-② 사람형 고글은 다시 그릴 수 있는 옷이다(기본으로 씌우지는 않는다)", () => {
  function fresh() {
    let wear!: typeof import("@/lib/lobby3d/wear");
    jest.isolateModules(() => {
      wear = require("@/lib/lobby3d/wear");
    });
    return wear;
  }

  it("[바뀔] 받은 목록이 없을 때 isWearableDrawable(\"goggles\")는 참이고 얼굴장식 차례에 goggles와 sunglassesBlack이 든다", () => {
    const wear = fresh();
    expect(wear.isWearableDrawable("goggles")).toBe(true);
    expect(wear.itemsInSlot("face")).toContain("goggles");
    expect(wear.itemsInSlot("face")).toContain("sunglassesBlack");
  });

  it("[바뀔] 받은 목록에 goggles가 그리기 정보·모델 없이 있어도(서버 목록처럼) 그릴 수 있고 얼굴장식 차례에 든다", () => {
    setItemCatalog(
      parseItemCatalog({
        version: "qa134-2-goggles",
        items: [
          { id: "goggles", kind: "wearable", name: "라룹이 고글", shopName: "라룹이 고글", description: "", category: null, slot: "face", price: null, assets: null },
          { id: "sunglassesBlack", kind: "wearable", name: "검정 선글라스", shopName: "검정 선글라스", description: "", category: "clothes", slot: "face", price: 100, draw: { attach: "bone", bone: "head", body: 2 }, assets: { model: fakeRef("qa134-2-sg", "glb"), icon: null } }
        ]
      })!
    );
    expect(isWearableDrawable("goggles")).toBe(true);
    expect(itemsInSlot("face")).toContain("goggles");
    expect(itemsInSlot("face")).toContain("sunglassesBlack");
  });

  it("[바뀔] 옷장(closetItems)의 얼굴장식 칸에 가진 goggles가 나온다", () => {
    setItemCatalog(
      parseItemCatalog({
        version: "qa134-2-closet",
        items: [{ id: "goggles", kind: "wearable", name: "라룹이 고글", shopName: "라룹이 고글", description: "", category: null, slot: "face", price: null, assets: null }]
      })!
    );
    const wardrobe = { items: [{ type: "goggles", slot: "face" }] } as never;
    expect(closetItems(wardrobe, "face").map((item) => item.type)).toEqual(["goggles"]);
  });

  it("[그대로] 기본으로 씌우지 않는다: DEFAULT_LOOK과 입은 것을 모를 때(look 없음)의 모습은 얼굴장식 없음이다", () => {
    expect(DEFAULT_LOOK.face).toBeNull();
    expect(shownLook(NO_WEAR, null).face).toBeNull();
    expect(shownLook(NO_WEAR, undefined).face).toBeNull();
  });
});

describe("[spec] 134-② 앱 파일: 사람형 고글을 새 파일로 넣고 라룹이 고글은 남긴다", () => {
  const MODELS = join(MOBILE_DIR, "assets", "models");
  const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

  it("[바뀔] wear-goggles-human.glb가 있고 glTF 바이너리다", () => {
    const path = join(MODELS, "wear-goggles-human.glb");
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(0);
    expect(readFileSync(path).subarray(0, 4).toString("ascii")).toBe("glTF");
  });

  it("[바뀔] wear-goggles-human.glb는 사람형 고글 원본(꾸미기/기본/라룹이 고글/사람형/wear-goggles.glb)과 같은 파일이다(원본이 이 컴퓨터에 있을 때)", () => {
    const original = "C:\\WriteLoop-asset\\꾸미기\\기본\\라룹이 고글\\사람형\\wear-goggles.glb";
    if (!existsSync(original)) return;
    expect(sha(join(MODELS, "wear-goggles-human.glb"))).toBe(sha(original));
  });

  it("[바뀔] 사람형 고글 파일은 라룹이 고글 파일(wear-goggles.glb)과 다른 파일이다", () => {
    expect(sha(join(MODELS, "wear-goggles-human.glb"))).not.toBe(sha(join(MODELS, "wear-goggles.glb")));
  });

  it("[그대로] 라룹이 wear-goggles.glb와 writeloop.glb는 남아 있다", () => {
    expect(existsSync(join(MODELS, "wear-goggles.glb"))).toBe(true);
    expect(existsSync(join(MODELS, "writeloop.glb"))).toBe(true);
  });
});

// ---------- 서버 목록 파일 그대로 ----------

const ENTRY: Record<string, { attach: string; bone?: string; mirror?: string; hide: string[] }> = {};
const TEE = ["top_white_pocket_tee"];
const SHORTS = ["bottom_charcoal_cuffs"];
const SHOES = ["shoe_canvas_l", "shoe_canvas_r"];
for (const id of ["tshirtOrange", "tshirtWhite", "tshirtYellow", "wear-top-kiln-jacket", "wear-top-tide-sailor", "wear-top-field-blouse", "wear-top-quilted-liner", "wear-top-henley-oatmeal"]) ENTRY[id] = { attach: "skin", hide: TEE };
for (const id of ["shortsNavy", "shortsBrown", "shortsRed", "wear-bottom-sage-cargo", "wear-bottom-jetty-denim", "wear-bottom-field-trousers", "wear-bottom-chino-graphite"]) ENTRY[id] = { attach: "skin", hide: SHORTS };
for (const id of ["shoesBrown", "shoesRed", "shoesWhite", "wear-shoe-strap-sneaker"]) ENTRY[id] = { attach: "bone", bone: "foot_l", mirror: "foot_r", hide: SHOES };
ENTRY["wear-shoe-combat-boot"] = { attach: "bone", bone: "foot_l", mirror: "foot_r", hide: [...SHOES, "socks"] };
for (const id of ["capOrange", "capBlue", "capGreen", "wear-hat-breakwater-bucket", "wear-hat-peddler-straw", "wear-hat-bramble-beret", "wear-hat-field-cap", "wear-hat-newsboy-walnut", "wear-hat-pawprint-cap", "sunglassesBlack", "wear-face-honey-panto"])
  ENTRY[id] = { attach: "bone", bone: "head", hide: [] };
for (const id of ["mufflerRed", "necklaceGold", "backpackRed"]) ENTRY[id] = { attach: "bone", bone: "spine", hide: [] };

const NEW_FIVE = ["wear-top-henley-oatmeal", "wear-bottom-chino-graphite", "wear-shoe-strap-sneaker", "wear-hat-newsboy-walnut", "wear-hat-pawprint-cap"];

function loadServerList() {
  const items = rawServerItems()
    .filter((item) => item.kind === "wearable")
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      shopName: item.shopName,
      description: item.description,
      category: item.category,
      slot: item.slot ?? null,
      price: item.price,
      draw: item.draw ?? null,
      assets: item.files?.model ? { model: serverRef(item.files.model), icon: item.files.icon ? serverRef(item.files.icon) : null } : null
    }));
  setItemCatalog(parseItemCatalog({ version: "qa134-2-server", items })!);
  return items;
}

describe("[spec] 134-② 서버 목록 파일 그대로를 앱이 읽으면 사람형 옷이 그려지는 옷이다", () => {
  it("[바뀔] 조끼(vestGreen)·고글을 뺀 모든 옷이 그릴 수 있는 옷이고, 부착·뼈·좌우·hide가 사람형 정보(human-wardrobe.json) 그대로다", () => {
    const items = loadServerList();
    const wearables = items.filter((item) => item.id !== "vestGreen" && item.id !== "goggles");
    expect(wearables.map((item) => item.id as string).sort()).toEqual(Object.keys(ENTRY).sort());
    const actual = wearables.map((item) => {
      const draw = wearDraw(item.id as string);
      return { id: item.id, draw: draw ? { attach: draw.attach, bone: draw.bone, mirror: draw.mirror, hide: (draw as { hide?: unknown }).hide } : null };
    });
    const expected = wearables.map((item) => {
      const e = ENTRY[item.id as string];
      return { id: item.id, draw: { attach: e.attach, bone: e.bone ?? null, mirror: e.mirror ?? null, hide: e.hide } };
    });
    expect(actual).toEqual(expected);
  });

  it("[바뀔] 색을 칠하던 아이템(반바지·티셔츠·신발)은 그대로 칠한다", () => {
    loadServerList();
    expect({
      shortsBrown: wearDraw("shortsBrown")!.color,
      shortsRed: wearDraw("shortsRed")!.color,
      tshirtWhite: wearDraw("tshirtWhite")!.color,
      tshirtYellow: wearDraw("tshirtYellow")!.color,
      shoesRed: wearDraw("shoesRed")!.color,
      shoesWhite: wearDraw("shoesWhite")!.color,
      shortsNavy: wearDraw("shortsNavy")!.color,
      tshirtOrange: wearDraw("tshirtOrange")!.color,
      shoesBrown: wearDraw("shoesBrown")!.color
    }).toEqual({
      shortsBrown: "#8A5A3B",
      shortsRed: "#C8443A",
      tshirtWhite: "#F4F0E8",
      tshirtYellow: "#F2C440",
      shoesRed: "#C8443A",
      shoesWhite: "#DCD8CF",
      shortsNavy: null,
      tshirtOrange: null,
      shoesBrown: null
    });
  });

  it("[바뀔] 새 사람형 옷 다섯은 목록에 있고 판매 안 함(가격·분류 없음)이다", () => {
    const items = loadServerList();
    for (const id of NEW_FIVE) {
      const item = items.find((i) => i.id === id);
      expect({ id, found: item !== undefined, price: item?.price, category: item?.category }).toEqual({ id, found: true, price: null, category: null });
    }
    const slots = Object.fromEntries(NEW_FIVE.map((id) => [id, items.find((i) => i.id === id)?.slot]));
    expect(slots).toEqual({
      "wear-top-henley-oatmeal": "top",
      "wear-bottom-chino-graphite": "bottom",
      "wear-shoe-strap-sneaker": "shoes",
      "wear-hat-newsboy-walnut": "hat",
      "wear-hat-pawprint-cap": "hat"
    });
  });

  it("[그대로] 조끼(vestGreen)는 body 1 그대로라 그릴 줄 모르는 옷이다(상의 차례에 없다)", () => {
    loadServerList();
    expect(rawServerItems().find((item) => item.id === "vestGreen")!.draw).toEqual({ attach: "skin", body: 1 });
    expect(wearDraw("vestGreen")).toBeNull();
    expect(isWearableDrawable("vestGreen")).toBe(false);
    expect(itemsInSlot("top")).not.toContain("vestGreen");
  });

  it("[바뀔] 서버 목록으로 얼굴장식 차례에 goggles가 다시 든다", () => {
    loadServerList();
    expect(itemsInSlot("face")).toContain("goggles");
    expect(itemsInSlot("face")).toContain("sunglassesBlack");
  });
});
