// [spec] qa 테스트(작업 066-③ 제거·보관함·꺼내 놓기, 새 기능, 모바일): 보관함(stored)이 붙은 저장 본문을 만들고 읽는 규칙, 저장·불러오기 API, 배치 비교.
// 기대값은 시나리오(private 작업 폴더 066/04-제거-보관함-꺼내기/03-qa-scenarios.md의 D1~D20·D22~D24·C8)와
// 결정(같은 폴더 04-main-decision.md의 3: "stored": null은 잘못된 본문으로 거절, 모바일 null)에서만 가져온다.
// 구현 코드는 부르는 방법(parseLobbyLayoutPayload·toLobbyLayoutPayload·sameLobbyLayout, 배치의 stored 목록, getLobbyLayout·saveLobbyLayout)을 알려고만 읽었다.
// 빈 보관함의 표현(stored가 없거나 빈 목록)은 명세가 정하지 않아(시나리오 A1) stored ?? []로 읽고, 보관함·방 목록의 순서는 보지 않는다.
// 시험용 벽 종류(POSTER)가 필요한 D21은 카탈로그를 감싸야 해서 home-lobby-storage-wall.spec.test.tsx에 둔다.
// 네트워크는 전역 fetch를 가짜로 바꿔 실제 서버에 닿지 않는다. 로그인 토큰은 기기 저장소(expo-secure-store) 가짜가 돌려준다.
import * as SecureStore from "expo-secure-store";
import { getLobbyLayout, saveLobbyLayout } from "@/lib/api";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";
import { sameLobbyLayout, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

type Item = Record<string, unknown>;
type Stored = { id: string; type: string };

/** 시나리오의 DEF(처음 배치). */
function defItems(): Item[] {
  return [
    { id: "desk", type: "desk", floor: { x: 1.5, z: 5.5, facing: 0 } },
    { id: "bookcase", type: "bookcase", floor: { x: 0.5, z: 2.5, facing: 1 } },
    { id: "wardrobe", type: "wardrobe", floor: { x: 7.5, z: 3.5, facing: 3 } },
    { id: "rug", type: "rug", floor: { x: 4.6, z: 7.2, facing: 0 } },
    { id: "board", type: "board", wall: { wall: "back", along: 1.8 } },
    { id: "window", type: "window", wall: { wall: "back", along: 4.8 } }
  ];
}

/** JSON으로 한 번 오간 본문(깊은 복사). stored를 주지 않으면 키가 없다. */
function body(stored?: unknown, items: unknown = defItems(), extra: Record<string, unknown> = {}): Record<string, unknown> {
  const value: Record<string, unknown> = { version: 2, items };
  if (stored !== undefined) value.stored = stored;
  return JSON.parse(JSON.stringify({ ...value, ...extra }));
}

function byId<T extends { id: string }>(list: readonly T[] | null | undefined): T[] {
  return [...(list ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function storedOf(layout: LobbyLayout | null | undefined): Stored[] {
  return byId(((layout as { stored?: Stored[] } | null | undefined)?.stored ?? []) as Stored[]);
}

function itemsOf(layout: LobbyLayout | null | undefined) {
  return byId((layout?.items ?? []) as unknown as { id: string }[]);
}

/** 읽혔고 방은 DEF, 보관함은 기대한 목록(순서 무관). */
function expectRead(value: unknown, stored: Stored[]) {
  const parsed = parseLobbyLayoutPayload(value);
  expect(parsed).not.toBeNull();
  expect(itemsOf(parsed)).toEqual(byId(defItems() as unknown as { id: string }[]));
  expect(storedOf(parsed)).toEqual(byId(stored));
}

const wardrobes = (n: number): Stored[] => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, type: "wardrobe" }));

// ---------- 1. 받아들이는 본문 ----------

describe("[spec] 066-③ 명세 1: 보관함이 붙은 본문 읽기", () => {
  test("D1 stored가 없는 v2 본문은 배치로 읽히고, 방은 DEF, 보관함은 비었다", () => {
    expectRead(body(), []);
  });

  test("D2 stored에 옷장 하나가 있으면 보관함이 [{id:wardrobe2, type:wardrobe}]이다", () => {
    expectRead(body([{ id: "wardrobe2", type: "wardrobe" }]), [{ id: "wardrobe2", type: "wardrobe" }]);
  });

  test("D3 stored가 빈 목록이면 D1과 같은 배치(방 같음, 보관함 빔)로 읽힌다", () => {
    const withEmpty = parseLobbyLayoutPayload(body([]));
    const without = parseLobbyLayoutPayload(body());

    expect(withEmpty).not.toBeNull();
    expect(itemsOf(withEmpty)).toEqual(itemsOf(without));
    expect(storedOf(withEmpty)).toEqual([]);
    expect(storedOf(without)).toEqual([]);
  });

  test("D12 치울 수 있는 종류(옷장·깔개) 둘은 그대로 읽힌다", () => {
    const stored = [
      { id: "s1", type: "wardrobe" },
      { id: "s2", type: "rug" }
    ];
    expectRead(body(stored), stored);
  });

  test("D6 보관함 id 40자(a×40)는 읽힌다", () => {
    const stored = [{ id: "a".repeat(40), type: "wardrobe" }];
    expectRead(body(stored), stored);
  });

  test("D13 방 6개 + 보관함 34개(합 40)는 읽힌다", () => {
    expectRead(body(wardrobes(34)), wardrobes(34));
  });
});

// ---------- 1. 받지 않는 본문(모바일은 null) ----------

describe("[spec] 066-③ 명세 1: 보관함 규칙을 어긴 본문은 null", () => {
  test.each<[string, unknown]>([
    ["D4 보관함 항목에 자리(floor)가 붙음", [{ id: "wardrobe2", type: "wardrobe", floor: { x: 3.5, z: 5.5, facing: 0 } }]],
    ["D5 보관함 항목에 type이 없음", [{ id: "wardrobe2" }]],
    ["D5 보관함 항목에 id가 없음", [{ type: "wardrobe" }]],
    ["D6 id에 빈칸(a b)", [{ id: "a b", type: "wardrobe" }]],
    ["D6 id에 #(#x)", [{ id: "#x", type: "wardrobe" }]],
    ["D6 빈 id", [{ id: "", type: "wardrobe" }]],
    ["D6 41자 id", [{ id: "a".repeat(41), type: "wardrobe" }]],
    ["D7 id가 숫자", [{ id: 7, type: "wardrobe" }]],
    ["D7 type이 숫자", [{ id: "x1", type: 7 }]],
    [
      "D8 보관함 안에서 id가 겹침",
      [
        { id: "s1", type: "wardrobe" },
        { id: "s1", type: "rug" }
      ]
    ],
    ["D9 보관함 id가 방의 옷장 id와 같음", [{ id: "wardrobe", type: "wardrobe" }]],
    ["D10 모르는 종류(sofa)", [{ id: "s1", type: "sofa" }]],
    ["D11 장소 가구 desk", [{ id: "s1", type: "desk" }]],
    ["D11 장소 가구 bookcase", [{ id: "s1", type: "bookcase" }]],
    ["D11 장소 가구 board", [{ id: "s1", type: "board" }]],
    ["D11 장소 가구 window", [{ id: "s1", type: "window" }]],
    ["D14 방 6개 + 보관함 35개(합 41)", wardrobes(35)],
    ["D16 stored가 객체", { id: "s1", type: "wardrobe" }],
    ["D16 stored가 글자", "wardrobe"],
    ["D17 보관함 항목이 글자", ["wardrobe"]],
    ["결정 3 stored가 null", null]
  ])("%s → null", (_label, stored) => {
    expect(parseLobbyLayoutPayload(body(stored))).toBeNull();
  });

  test("D15 방에서 책상을 빼고 보관함에 책상을 넣은 본문 → null", () => {
    const items = defItems().filter((i) => i.id !== "desk");

    expect(parseLobbyLayoutPayload(body([{ id: "desk", type: "desk" }], items))).toBeNull();
  });

  test("D18 stored가 있어도 모르는 최상위 키(extra)가 있으면 → null", () => {
    expect(parseLobbyLayoutPayload(body([], defItems(), { extra: 1 }))).toBeNull();
  });
});

// ---------- 1·5. 본문 만들기와 왕복 ----------

const D19_STORED: Stored[] = [
  { id: "wardrobe2", type: "wardrobe" },
  { id: "rug2", type: "rug" }
];

function d19Layout(): LobbyLayout {
  return JSON.parse(JSON.stringify({ items: defItems(), stored: D19_STORED })) as LobbyLayout;
}

describe("[spec] 066-③ 명세 1·5: 본문 만들기와 왕복", () => {
  test("D19 방 DEF·보관함 둘인 배치를 본문으로 만들면 version 2, items는 DEF, stored는 id·type 두 키인 두 항목이다", () => {
    const payload = toLobbyLayoutPayload(d19Layout()) as unknown as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual(["items", "stored", "version"]);
    expect(payload.version).toBe(2);
    expect(byId(payload.items as { id: string }[])).toEqual(byId(defItems() as unknown as { id: string }[]));
    const stored = payload.stored as Record<string, unknown>[];
    for (const entry of stored) expect(Object.keys(entry).sort()).toEqual(["id", "type"]);
    expect(byId(stored as Stored[])).toEqual(byId(D19_STORED));
  });

  test("D20 D19의 배치를 본문으로 만들어 다시 읽으면 방·보관함이 처음과 같다", () => {
    const parsed = parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(d19Layout()))));

    expect(parsed).not.toBeNull();
    expect(itemsOf(parsed)).toEqual(byId(defItems() as unknown as { id: string }[]));
    expect(storedOf(parsed)).toEqual(byId(D19_STORED));
  });

  test("D20 보관함이 빈 배치도 왕복하면 방이 같고 보관함이 빈다", () => {
    const empty = JSON.parse(JSON.stringify({ items: defItems() })) as LobbyLayout;
    const emptyList = JSON.parse(JSON.stringify({ items: defItems(), stored: [] })) as LobbyLayout;

    for (const layout of [empty, emptyList]) {
      const parsed = parseLobbyLayoutPayload(JSON.parse(JSON.stringify(toLobbyLayoutPayload(layout))));
      expect(parsed).not.toBeNull();
      expect(itemsOf(parsed)).toEqual(byId(defItems() as unknown as { id: string }[]));
      expect(storedOf(parsed)).toEqual([]);
    }
  });
});

// ---------- 4. 배치 비교(완료의 '바뀐 것이 없으면 저장하지 않음') ----------

describe("[spec] 066-③ 명세 4: 배치 비교는 보관함도 본다", () => {
  test("C8 방이 DEF로 같고 보관함이 []와 [rug2]면 같지 않다(false)", () => {
    const a = JSON.parse(JSON.stringify({ items: defItems(), stored: [] })) as LobbyLayout;
    const b = JSON.parse(JSON.stringify({ items: defItems(), stored: [{ id: "rug2", type: "rug" }] })) as LobbyLayout;

    expect(sameLobbyLayout(a, b)).toBe(false);
    expect(sameLobbyLayout(b, a)).toBe(false);
  });

  test("C8 방과 보관함이 모두 같으면 true다", () => {
    const a = JSON.parse(JSON.stringify({ items: defItems(), stored: [{ id: "rug2", type: "rug" }] })) as LobbyLayout;
    const b = JSON.parse(JSON.stringify({ items: defItems(), stored: [{ id: "rug2", type: "rug" }] })) as LobbyLayout;

    expect(sameLobbyLayout(a, b)).toBe(true);
  });
});

// ---------- 1. 저장·불러오기 API ----------

type FakeResponse = { ok: boolean; status: number; headers: Headers; json: () => Promise<unknown>; text: () => Promise<string> };

function respond(status: number, value?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => {
      if (value === undefined) throw new SyntaxError("no body");
      return JSON.parse(JSON.stringify(value));
    },
    text: async () => (value === undefined ? "" : JSON.stringify(value))
  };
}

const fetchMock = jest.fn<Promise<FakeResponse>, [string, RequestInit?]>();
const originalFetch = globalThis.fetch;

describe("[spec] 066-③ 명세 1: 저장·불러오기 API", () => {
  beforeAll(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => {
      if (key === "writeloop_access_token") return "access-token-066";
      if (key === "writeloop_refresh_token") return "refresh-token-066";
      return null;
    });
  });

  test("D22 saveLobbyLayout에 D19의 배치를 주면 보낸 본문의 stored가 두 항목이고, 돌려받은 배치의 보관함도 같은 두 항목이다", async () => {
    // 가짜 서버는 받은 본문을 그대로 돌려준다
    fetchMock.mockImplementation(async (_url, init) => respond(200, JSON.parse(String(init?.body))));

    const saved = await saveLobbyLayout(d19Layout());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { stored?: Stored[] };
    expect(byId(sent.stored ?? [])).toEqual(byId(D19_STORED));
    expect(storedOf(saved)).toEqual(byId(D19_STORED));
  });

  test("D23 getLobbyLayout: 서버가 D2의 본문을 돌려주면 보관함이 [{id:wardrobe2, type:wardrobe}]다", async () => {
    fetchMock.mockResolvedValue(respond(200, body([{ id: "wardrobe2", type: "wardrobe" }])));

    const loaded = await getLobbyLayout();

    expect(loaded).not.toBeNull();
    expect(storedOf(loaded)).toEqual([{ id: "wardrobe2", type: "wardrobe" }]);
  });

  test("D24 getLobbyLayout: 서버가 보관함에 책상이 든 본문(D11)을 돌려주면 null이다", async () => {
    fetchMock.mockResolvedValue(respond(200, body([{ id: "s1", type: "desk" }])));

    await expect(getLobbyLayout()).resolves.toBeNull();
  });
});
