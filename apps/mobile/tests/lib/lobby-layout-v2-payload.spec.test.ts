// [spec] qa 테스트(작업 066-① 가구 카탈로그와 배치 데이터 v2, 기능 변경, 모바일): 저장 본문 v2를 만들고 읽는 규칙.
// 기대값은 명세(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)의 2(배치 데이터 v2, 본문 모양),
// 4(서버 API 검사 v2: version 2만, 모르는 키 거절, items 1~40개, id 1~40자·영문·숫자·_·-·겹치지 않음, 아는 종류, 종류에 맞는 자리 하나,
// 장소 가구 넷은 꼭 있음)와 5(폰은 불러온 본문을 서버와 같은 규칙으로 검사하고, 맞지 않거나 v2가 아니면 처음 배치)에서만 가져온다.
// 부르는 이름(toLobbyLayoutPayload, parseLobbyLayoutPayload)과 "앱 안의 배치 값은 본문에서 version을 뺀 { items }"는 메인 세션이 알려 준 이름 약속이다.
// 맞지 않는 본문은 parseLobbyLayoutPayload가 null을 돌려준다(지금 코드의 약속. 홈에서 null이 처음 배치로 보이는 것은 home-lobby-layout-load.spec이 본다).
// 장소 가구가 둘 이상인 본문(X40)은 결정(같은 폴더 04-main-decision.md의 1: 장소 가구는 종류마다 정확히 하나)을 따른다.
// 모두 바뀔 동작이다(지금 코드는 v1만 읽는다).
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import type { LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type Item = Record<string, unknown>;
type Body = { version?: unknown; items?: unknown; [key: string]: unknown };

/** 처음 배치(명세 2: 지금 자리 그대로, 인스턴스 id = 종류 id). */
function p0Items(): Item[] {
  return [
    { id: "desk", type: "desk", floor: { x: 1.5, z: 5.5, facing: 0 } },
    { id: "bookcase", type: "bookcase", floor: { x: 0.5, z: 2.5, facing: 1 } },
    { id: "wardrobe", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } },
    { id: "rug", type: "rug", floor: { x: 4.6, z: 7.2, facing: 0 } },
    { id: "board", type: "board", wall: { wall: "back", along: 1.8 } },
    { id: "window", type: "window", wall: { wall: "back", along: 4.8 } }
  ];
}

/** 장소 가구 넷만(명세 4: 꼭 있어야 하는 것은 장소 가구뿐). */
function placeItems(): Item[] {
  return p0Items().filter((i) => i.type !== "wardrobe" && i.type !== "rug");
}

function body(items: unknown, version: unknown = 2): Body {
  return JSON.parse(JSON.stringify({ version, items }));
}

/** id 순으로 늘어놓은 인스턴스(목록 순서는 명세가 정하지 않았다). */
function sortedItems(layout: { items: readonly unknown[] } | null | undefined) {
  return [...((layout?.items ?? []) as { id: string }[])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function expectAccepted(value: Body) {
  const parsed = parseLobbyLayoutPayload(value);
  expect(parsed).not.toBeNull();
  expect(Object.keys(parsed as object)).toEqual(["items"]);
  expect(sortedItems(parsed)).toEqual(sortedItems({ items: value.items as unknown[] }));
}

// ---------- 본문 만들기(명세 2) ----------

describe("[spec] 066-① 명세 2: 저장 본문", () => {
  test("V1 toLobbyLayoutPayload는 배치({ items })에 version 2를 붙인 본문을 만든다(다른 키 없음, 가구 목록 그대로)", () => {
    const layout = { items: p0Items() } as unknown as LobbyLayout;

    const payload = toLobbyLayoutPayload(layout) as unknown as Body;

    expect(Object.keys(payload).sort()).toEqual(["items", "version"]);
    expect(payload.version).toBe(2);
    expect(sortedItems(payload as { items: unknown[] })).toEqual(sortedItems({ items: p0Items() }));
  });

  test("V2 만든 본문을 다시 읽으면 같은 배치다", () => {
    const layout = { items: p0Items() } as unknown as LobbyLayout;

    const parsed = parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(layout))));

    expect(sortedItems(parsed)).toEqual(sortedItems({ items: p0Items() }));
  });
});

// ---------- 받아들이는 본문(명세 2·4) ----------

describe("[spec] 066-① 명세 2·4: 받아들이는 본문", () => {
  test("A1 처음 배치(v2)를 받으면 { items }만 돌려주고 가구 여섯이 그대로다", () => {
    expectAccepted(body(p0Items()));
  });

  test("A2 장소 가구 넷(게시판·창문·책상·책장)만 있고 옷장·깔개가 없어도 받는다", () => {
    expectAccepted(body(placeItems()));
  });

  test("A3 같은 종류를 여러 개(옷장 둘, 깔개 둘, 서로 다른 id) 놓은 배치를 받는다", () => {
    expectAccepted(
      body([
        ...p0Items(),
        { id: "wardrobe-2", type: "wardrobe", floor: { x: 5.5, z: 9.5, facing: 0 } },
        { id: "rug_2", type: "rug", floor: { x: 1.0, z: 9.0, facing: 0 } }
      ])
    );
  });

  test("A4 장소 가구의 인스턴스 id가 종류 id와 달라도(책상 id my-desk) 받는다", () => {
    expectAccepted(body(p0Items().map((i) => (i.id === "desk" ? { ...i, id: "my-desk" } : i))));
  });

  test("A5 id 1자(w)와 40자(영문 대소문자·숫자·_·-)를 받는다", () => {
    const id40 = "Ab0_-".repeat(8);
    expect(id40).toHaveLength(40);
    expectAccepted(
      body([
        ...placeItems(),
        { id: "w", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } },
        { id: id40, type: "rug", floor: { x: 4.6, z: 7.2, facing: 0 } }
      ])
    );
  });

  test("A6 가구가 40개(장소 가구 넷 + 옷장 36)면 받는다(겹침은 모양 검사가 보지 않는다)", () => {
    const wardrobes = Array.from({ length: 36 }, (_, n) => ({ id: `w${n + 1}`, type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } }));
    const items = [...placeItems(), ...wardrobes];
    expect(items).toHaveLength(40);
    expectAccepted(body(items));
  });
});

// ---------- 거절하는 본문(명세 4·5) ----------

function rejectedCases(): [string, unknown][] {
  const cases: [string, unknown][] = [];
  const add = (label: string, value: unknown) => cases.push([label, value]);
  const withItem = (id: string, change: (item: Item) => Item) => body(p0Items().map((i) => (i.id === id ? change({ ...i }) : i)));

  // 버전(명세 4: version은 2만. 5: v2가 아니면 처음 배치)
  add("X1 v1 본문(version 1, 옛 모양 floor·wall 묶음)", {
    version: 1,
    floor: {
      desk: { x: 1.5, z: 5.5, facing: 0 },
      bookcase: { x: 0.5, z: 2.5, facing: 1 },
      wardrobe: { x: 7.5, z: 3.5, facing: 3 },
      rug: { x: 4.6, z: 7.2, facing: 0 }
    },
    wall: { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } }
  });
  add("X2 v2 목록에 version 1", body(p0Items(), 1));
  add("X3 version이 없음", { items: p0Items() });

  // 모르는 키(명세 4)
  add("X4 맨 위 모르는 키 floor(옛 모양 키를 함께 보냄)", { ...body(p0Items()), floor: {} });
  add("X5 가구 항목 안의 모르는 키 rotation", withItem("wardrobe", (i) => ({ ...i, rotation: 0 })));
  add("X6 floor 안의 모르는 키 y", withItem("desk", (i) => ({ ...i, floor: { x: 1.5, z: 5.5, facing: 0, y: 0 } })));
  add("X7 wall 안의 모르는 키 height", withItem("board", (i) => ({ ...i, wall: { wall: "back", along: 1.8, height: 1.75 } })));

  // items(명세 4: 1~40개)
  add("X8 items가 없음", { version: 2 });
  add("X9 items가 빈 목록", body([]));
  add("X10 items가 41개(장소 가구 넷 + 옷장 37)", body([...placeItems(), ...Array.from({ length: 37 }, (_, n) => ({ id: `w${n + 1}`, type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } }))]));
  add("X11 items가 목록이 아니라 객체", body({ desk: p0Items()[0] }));
  add("X12 items 안에 null", body([...p0Items(), null]));

  // id(명세 4: 1~40자, 영문·숫자·_·-, 목록 안에서 겹치지 않음)
  add("X13 id가 없음", withItem("wardrobe", (i) => ({ type: i.type, floor: i.floor })));
  add("X14 id가 빈 문자열", withItem("wardrobe", (i) => ({ ...i, id: "" })));
  add("X15 id가 41자", withItem("wardrobe", (i) => ({ ...i, id: "a".repeat(41) })));
  add("X16 id에 빈칸(my wardrobe)", withItem("wardrobe", (i) => ({ ...i, id: "my wardrobe" })));
  add("X17 id에 한글(옷장)", withItem("wardrobe", (i) => ({ ...i, id: "옷장" })));
  add("X18 id에 점(wardrobe.2)", withItem("wardrobe", (i) => ({ ...i, id: "wardrobe.2" })));
  add("X19 id가 숫자 7", withItem("wardrobe", (i) => ({ ...i, id: 7 })));
  add("X20 옷장 둘의 id가 같음(w)", body([...placeItems(), { id: "w", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } }, { id: "w", type: "wardrobe", floor: { x: 5.5, z: 9.5, facing: 0 } }]));
  add("X21 다른 종류 둘의 id가 같음(옷장 id가 desk)", withItem("wardrobe", (i) => ({ ...i, id: "desk" })));

  // type(명세 4: 아는 종류)
  add("X22 type이 없음", withItem("wardrobe", (i) => ({ id: i.id, floor: i.floor })));
  add("X23 모르는 종류 lamp", body([...p0Items(), { id: "lamp", type: "lamp", floor: { x: 4.5, z: 4.5, facing: 0 } }]));
  add("X24 대문자 종류 Wardrobe", withItem("wardrobe", (i) => ({ ...i, type: "Wardrobe" })));
  add("X25 type이 null", withItem("wardrobe", (i) => ({ ...i, type: null })));

  // 종류에 맞는 자리 하나(명세 4: 바닥형·덮개형은 floor만, 벽 부착형은 wall만)
  add("X26 바닥형(옷장)에 wall만", withItem("wardrobe", (i) => ({ id: i.id, type: i.type, wall: { wall: "right", along: 3.5 } })));
  add("X27 바닥형(책상)에 floor와 wall 둘 다", withItem("desk", (i) => ({ ...i, wall: { wall: "back", along: 1.5 } })));
  add("X28 바닥형(책장)에 자리가 없음", withItem("bookcase", (i) => ({ id: i.id, type: i.type })));
  add("X29 덮개형(깔개)에 wall만", withItem("rug", (i) => ({ id: i.id, type: i.type, wall: { wall: "left", along: 7.0 } })));
  add("X30 벽 부착형(창문)에 floor만", withItem("window", (i) => ({ id: i.id, type: i.type, floor: { x: 4.5, z: 0.5, facing: 0 } })));
  add("X31 벽 부착형(게시판)에 wall과 floor 둘 다", withItem("board", (i) => ({ ...i, floor: { x: 1.5, z: 0.5, facing: 0 } })));
  add("X32 벽 부착형(게시판)에 자리가 없음", withItem("board", (i) => ({ id: i.id, type: i.type })));

  // 자리 값(명세 4: x 0~8, z 0~11 안의 수, facing 0~3 정수, wall back·left·right, along은 그 벽 길이 안)
  add("X33 새 옷장 floor x 8.5", body([...p0Items(), { id: "wardrobe-2", type: "wardrobe", floor: { x: 8.5, z: 9.5, facing: 0 } }]));
  add("X34 새 깔개 floor facing 1.5", body([...p0Items(), { id: "rug-2", type: "rug", floor: { x: 1.0, z: 9.0, facing: 1.5 } }]));
  add("X35 창문 wall front", withItem("window", (i) => ({ ...i, wall: { wall: "front", along: 4.8 } })));
  add("X36 게시판 오른벽 along 11.5(옆벽 11 밖)", withItem("board", (i) => ({ ...i, wall: { wall: "right", along: 11.5 } })));

  // 장소 가구(명세 4: 게시판·창문·책상·책장은 꼭 있어야 한다)
  for (const type of ["board", "window", "desk", "bookcase"]) {
    add(`X37 장소 가구 ${type}가 없음`, body(p0Items().filter((i) => i.type !== type)));
  }
  // 장소 가구는 종류마다 정확히 하나(04-main-decision.md의 1: 둘 이상이어도 앱은 불러온 본문을 처음 배치로 본다)
  const second: Record<string, Item> = {
    board: { id: "board-2", type: "board", wall: { wall: "right", along: 6.0 } },
    window: { id: "window-2", type: "window", wall: { wall: "left", along: 8.0 } },
    desk: { id: "desk-2", type: "desk", floor: { x: 5.5, z: 9.5, facing: 0 } },
    bookcase: { id: "bookcase-2", type: "bookcase", floor: { x: 7.5, z: 8.5, facing: 3 } }
  };
  for (const type of ["board", "window", "desk", "bookcase"]) {
    add(`X40(결정 04) 장소 가구 ${type}가 둘(id ${type}, ${type}-2)`, body([...p0Items(), second[type]]));
  }

  add("X38 본문이 null", null);
  add("X39 본문이 목록", [p0Items()]);
  return cases;
}

describe("[spec] 066-① 명세 4·5: 맞지 않거나 v2가 아닌 본문은 배치로 받아들이지 않는다(null)", () => {
  test.each(rejectedCases())("%s → null", (_label, value) => {
    expect(parseLobbyLayoutPayload(value)).toBeNull();
  });
});
