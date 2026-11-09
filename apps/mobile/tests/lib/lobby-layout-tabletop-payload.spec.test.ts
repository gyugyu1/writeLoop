// [spec] qa 테스트(작업 066-④ 탁상형(책상 위 소품), 새 기능, 모바일): 저장 본문에 탁상형 소품(스탠드)이 들어간 배치를 만들고 읽는 규칙.
// 기대값은 시나리오(private 작업 폴더 066/05-책상-위-소품/03-qa-scenarios.md의 3절 P1~P33, 2절 D2)에서만 가져온다.
// 시나리오의 근거는 명세(같은 폴더 01-main-spec.md) 3 "배치 데이터와 저장 본문"이다:
// - 탁상형 종류는 id·type·on 세 키, on은 parent·slot·facing 세 키. 탁상형이 아닌 종류는 on을 가질 수 없다.
// - parent는 방(items)에 있는 윗면이 있는 가구의 id(보관함의 가구·탁상형 가구는 안 된다). slot은 그 받침 가구에 있는 자리 번호(책상 0~2) 정수,
//   facing은 0~3 정수. 같은 받침 가구의 같은 자리에 둘 이상 올리지 않는다. 보관함의 탁상형은 id·type만. 탁상형도 항목 수(40)에 든다.
// - 어기면 모바일(parseLobbyLayoutPayload)은 null.
// 스탠드의 종류 id는 명세 3의 예대로 "lamp"다. 부르는 이름(parseLobbyLayoutPayload, toLobbyLayoutPayload)은 지금 이름이다.
// 목록 순서는 명세가 정하지 않아 견줄 때 id 순으로 늘어놓는다.
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import type { LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type Item = Record<string, unknown>;

/** 스탠드 전 처음 배치 여섯 개(시나리오의 P0). */
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

function lamp(id: string, parent: unknown, slot: unknown, facing: unknown): Item {
  return { id, type: "lamp", on: { parent, slot, facing } };
}

/** 시나리오의 L(k, f): P0 + 스탠드(책상 자리 k, 방향 f). */
function lItems(slot: number, facing: number): Item[] {
  return [...p0Items(), lamp("lamp", "desk", slot, facing)];
}

function body(items: unknown, stored?: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(stored === undefined ? { version: 2, items } : { version: 2, items, stored }));
}

function sortedById(list: readonly unknown[] | undefined) {
  return [...((list ?? []) as { id: string }[])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** "받음": null이 아니고, 받은 배치가 본문에서 version을 뺀 것과 같다. */
function expectAccepted(value: Record<string, unknown>) {
  const parsed = parseLobbyLayoutPayload(value) as (LobbyLayout & { stored?: unknown[] }) | null;
  expect(parsed).not.toBeNull();
  expect(sortedById(parsed!.items)).toEqual(sortedById(value.items as unknown[]));
  expect(sortedById(parsed!.stored)).toEqual(sortedById(value.stored as unknown[] | undefined));
}

function stoodLamps(n: number, prefix = "s"): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, type: "lamp" }));
}

function wardrobes(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `w${i + 1}`, type: "wardrobe", floor: { x: 5.5, z: 9.5, facing: 0 } }));
}

describe("[spec] 066-④ 명세 3: 탁상형이 든 본문을 받는다", () => {
  test("P1 처음 배치 N0(P0 + 스탠드 책상 자리 0, 방향 0)을 받고, 스탠드 항목은 { id, type, on: { parent, slot, facing } } 그대로다", () => {
    const value = body(lItems(0, 0));
    expectAccepted(value);
    const parsed = parseLobbyLayoutPayload(value)!;
    expect(parsed.items.find((item) => item.id === "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0 } });
  });

  test.each([1, 2])("P2 책상 자리 %i의 스탠드를 받는다", (slot) => {
    expectAccepted(body(lItems(slot, 0)));
  });

  test.each([1, 2, 3])("P3 방향 %i의 스탠드를 받는다", (facing) => {
    expectAccepted(body(lItems(0, facing)));
  });

  test("P4 책상 자리 0·1·2에 스탠드 셋을 받는다", () => {
    expectAccepted(body([...p0Items(), lamp("lamp", "desk", 0, 0), lamp("lamp2", "desk", 1, 0), lamp("lamp3", "desk", 2, 0)]));
  });

  test("P5 스탠드 항목이 책상 항목보다 앞에 있어도 받는다(명세에 목록 순서 조건이 없다)", () => {
    expectAccepted(body([lamp("lamp", "desk", 0, 0), ...p0Items()]));
  });

  test("P6 parent는 인스턴스 id다: 책상 id가 my-desk이고 스탠드가 my-desk를 가리키면 받는다", () => {
    const items = p0Items().map((item) => (item.id === "desk" ? { ...item, id: "my-desk" } : item));
    expectAccepted(body([...items, lamp("lamp", "my-desk", 0, 0)]));
  });

  test("P7 보관함의 스탠드는 id·type만으로 받는다", () => {
    expectAccepted(body(p0Items(), [{ id: "lamp", type: "lamp" }]));
  });

  test("P8 방 7개(P0 + 스탠드) + 보관함 스탠드 33개 = 40개를 받는다", () => {
    expectAccepted(body(lItems(0, 0), stoodLamps(33)));
  });

  test("P9 탁상형이 없는 v2 본문(P0)은 보관함이 있든 없든 받는다", () => {
    expectAccepted(body(p0Items()));
    expectAccepted(body(p0Items().filter((item) => item.id !== "wardrobe"), [{ id: "wardrobe", type: "wardrobe" }]));
  });

  test("P10 toLobbyLayoutPayload(L(2, 3))는 { version: 2, items }이고 스탠드 항목이 그대로이며, JSON 왕복해 다시 읽으면 L(2, 3)이다", () => {
    const layout = { items: lItems(2, 3) } as unknown as LobbyLayout;

    const payload = toLobbyLayoutPayload(layout) as unknown as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(["items", "version"]);
    expect(payload.version).toBe(2);
    expect((payload.items as Item[]).find((item) => item.id === "lamp")).toEqual({ id: "lamp", type: "lamp", on: { parent: "desk", slot: 2, facing: 3 } });
    const again = parseLobbyLayoutPayload(JSON.parse(JSON.stringify(payload)));
    expect(again).not.toBeNull();
    expect(sortedById(again!.items)).toEqual(sortedById(lItems(2, 3)));
  });

  test("P33 대조: 방 항목이 정확히 40개(P0 + 스탠드 셋 + 옷장 31개)면 받는다", () => {
    const items = [...p0Items(), lamp("lamp", "desk", 0, 0), lamp("lamp2", "desk", 1, 0), lamp("lamp3", "desk", 2, 0), ...wardrobes(31)];
    expect(items).toHaveLength(40);
    expectAccepted(body(items));
  });
});

describe("[spec] 066-④ 명세 3: 규칙을 어긴 본문은 null이다", () => {
  const rejected: [string, Record<string, unknown>][] = [
    ["P11 방의 스탠드에 on이 없다", body([...p0Items(), { id: "lamp", type: "lamp" }])],
    ["P12 스탠드가 on 대신 floor를 가진다", body([...p0Items(), { id: "lamp", type: "lamp", floor: { x: 0.5, z: 5.5, facing: 0 } }])],
    [
      "P13 스탠드가 on과 floor를 함께 가진다",
      body([...p0Items(), { ...lamp("lamp", "desk", 0, 0), floor: { x: 0.5, z: 5.5, facing: 0 } }])
    ],
    ["P14 스탠드가 wall을 가진다", body([...p0Items(), { id: "lamp", type: "lamp", wall: { wall: "back", along: 3 } }])],
    ["P15 스탠드 항목에 모르는 키가 있다", body([...p0Items(), { ...lamp("lamp", "desk", 0, 0), extra: 1 }])],
    ["P16 on에 facing이 없다", body([...p0Items(), { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0 } }])],
    ["P16 on에 slot이 없다", body([...p0Items(), { id: "lamp", type: "lamp", on: { parent: "desk", facing: 0 } }])],
    ["P16 on에 parent가 없다", body([...p0Items(), { id: "lamp", type: "lamp", on: { slot: 0, facing: 0 } }])],
    ["P17 on에 모르는 키가 있다", body([...p0Items(), { id: "lamp", type: "lamp", on: { parent: "desk", slot: 0, facing: 0, x: 0 } }])],
    ["P18 on이 문자열이다", body([...p0Items(), { id: "lamp", type: "lamp", on: "desk" }])],
    ["P18 on이 null이다", body([...p0Items(), { id: "lamp", type: "lamp", on: null }])],
    ["P18 on이 배열이다", body([...p0Items(), { id: "lamp", type: "lamp", on: [] }])],
    [
      "P19 책상(탁상형 아님)이 floor와 함께 on을 가진다",
      body(p0Items().map((item) => (item.id === "desk" ? { ...item, on: { parent: "desk", slot: 0, facing: 0 } } : item)))
    ],
    [
      "P20 옷장이 on을 가진다",
      body(p0Items().map((item) => (item.id === "wardrobe" ? { ...item, on: { parent: "desk", slot: 0, facing: 0 } } : item)))
    ],
    [
      "P20 게시판(벽)이 on을 가진다",
      body(p0Items().map((item) => (item.id === "board" ? { ...item, on: { parent: "desk", slot: 0, facing: 0 } } : item)))
    ],
    ["P21 parent가 방에 없는 id다", body([...p0Items(), lamp("lamp", "nope", 0, 0)])],
    ["P22 parent가 보관함 가구의 id다", body([...p0Items(), lamp("lamp", "wardrobe-2", 0, 0)], [{ id: "wardrobe-2", type: "wardrobe" }])],
    ["P23 parent가 책장이다", body([...p0Items(), lamp("lamp", "bookcase", 0, 0)])],
    ["P23 parent가 옷장이다", body([...p0Items(), lamp("lamp", "wardrobe", 0, 0)])],
    ["P23 parent가 깔개다", body([...p0Items(), lamp("lamp", "rug", 0, 0)])],
    ["P23 parent가 게시판이다", body([...p0Items(), lamp("lamp", "board", 0, 0)])],
    ["P23 parent가 창문이다", body([...p0Items(), lamp("lamp", "window", 0, 0)])],
    ["P24 parent가 다른 스탠드다", body([...p0Items(), lamp("lamp", "desk", 0, 0), lamp("lamp2", "lamp", 0, 0)])],
    ["P25 parent가 숫자다", body([...p0Items(), lamp("lamp", 1, 0, 0)])],
    ["P25 parent가 null이다", body([...p0Items(), lamp("lamp", null, 0, 0)])],
    ["P26 slot이 3이다(책상은 0~2)", body([...p0Items(), lamp("lamp", "desk", 3, 0)])],
    ["P26 slot이 -1이다", body([...p0Items(), lamp("lamp", "desk", -1, 0)])],
    ["P26 slot이 0.5다", body([...p0Items(), lamp("lamp", "desk", 0.5, 0)])],
    ["P26 slot이 문자열 \"0\"이다", body([...p0Items(), lamp("lamp", "desk", "0", 0)])],
    ["P26 slot이 null이다", body([...p0Items(), lamp("lamp", "desk", null, 0)])],
    ["P27 facing이 4다", body([...p0Items(), lamp("lamp", "desk", 0, 4)])],
    ["P27 facing이 -1이다", body([...p0Items(), lamp("lamp", "desk", 0, -1)])],
    ["P27 facing이 1.5다", body([...p0Items(), lamp("lamp", "desk", 0, 1.5)])],
    ["P27 facing이 문자열 \"1\"이다", body([...p0Items(), lamp("lamp", "desk", 0, "1")])],
    ["P27 facing이 null이다", body([...p0Items(), lamp("lamp", "desk", 0, null)])],
    ["P28 두 스탠드가 책상의 같은 자리 1에 있다", body([...p0Items(), lamp("lamp", "desk", 1, 0), lamp("lamp2", "desk", 1, 0)])],
    ["P29 보관함의 스탠드가 on을 가진다", body(p0Items(), [lamp("lamp", "desk", 0, 0)])],
    ["P30 스탠드 id에 쓸 수 없는 글자(#)가 있다", body([...p0Items(), lamp("lamp#1", "desk", 0, 0)])],
    ["P30 스탠드 id가 41자다", body([...p0Items(), lamp("l".repeat(41), "desk", 0, 0)])],
    ["P31 스탠드 id가 다른 가구 id(desk)와 겹친다", body([...p0Items(), lamp("desk", "desk", 0, 0)])],
    ["P32 방 7개 + 보관함 스탠드 34개 = 41개", body(lItems(0, 0), stoodLamps(34))],
    [
      "P33 방 항목이 41개(P0 + 스탠드 셋 + 옷장 32개)",
      body([...p0Items(), lamp("lamp", "desk", 0, 0), lamp("lamp2", "desk", 1, 0), lamp("lamp3", "desk", 2, 0), ...wardrobes(32)])
    ]
  ];

  test.each(rejected)("%s → null", (_label, value) => {
    expect(parseLobbyLayoutPayload(value)).toBeNull();
  });
});
