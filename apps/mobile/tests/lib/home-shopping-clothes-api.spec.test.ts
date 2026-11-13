// [spec] qa 테스트(작업 089 ④ 홈쇼핑 '옷' 분류, 새 기능, 모바일): 앱의 주문 함수가 옷 주문 결과(layout null, wardrobe)와 가구 주문 결과(wardrobe null)를 받는 것.
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/06-홈쇼핑-옷/03-qa-scenarios.md의 A1~A5)와
// 04-main-decision.md C7(옷 주문 결과의 wardrobe가 없거나 깨져도 주문은 성공으로 본다)에서만 가져온다.
// 구현 커밋 18898fb에서 읽은 것은 부르는 방법뿐이다: 옷 주문은 orderHomeShoppingWearable({ type, price }), 가구 주문은 orderHomeShopping({ type, price }).
// 네트워크는 전역 fetch를 가짜로 바꿔 실제 서버에 닿지 않는다(home-shopping-api.spec.test.ts와 같은 틀).
import * as SecureStore from "expo-secure-store";
import { ApiError, orderHomeShopping, orderHomeShoppingWearable } from "@/lib/api";
import { DEFAULT_LOBBY_LAYOUT, storedItems } from "@/lib/lobby3d/lobby-layout";
import { toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

const ACCESS_TOKEN = "access-token-089-4";

type FakeResponse = {
  ok: boolean;
  status: number;
  headers: Headers;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

function respond(status: number, body?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => {
      if (body === undefined) throw new SyntaxError("no body");
      return JSON.parse(JSON.stringify(body));
    },
    text: async () => (body === undefined ? "" : JSON.stringify(body))
  };
}

const fetchMock = jest.fn<Promise<FakeResponse>, [string, RequestInit?]>();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => {
    if (key === "writeloop_access_token") return ACCESS_TOKEN;
    return null;
  });
});

// ---------- 시나리오의 값 ----------

/** W-cap: 주황 야구모자를 산 뒤의 옷장(입은 것은 H0 그대로). */
const W_CAP = {
  items: [
    { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T01:00:00Z" },
    { type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T02:00:00Z" },
    { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T03:00:00Z" }
  ],
  equipped: { hat: null, top: "tshirtOrange", bottom: null, shoes: "shoesBrown", face: null, back: null, accessory: null }
};

/** O-cap: 서버의 옷 주문 결과. */
function oCapBody() {
  return { type: "capOrange", price: 60, balance: 140, owned: 1, itemId: null, layout: null, wardrobe: W_CAP };
}

/** O-bed: 서버의 가구 주문 결과(지금 모양 + wardrobe null). */
function oBedBody() {
  const n0 = toLobbyLayoutPayload(DEFAULT_LOBBY_LAYOUT) as { version: number; items: unknown[] };
  return {
    type: "bed",
    price: 300,
    balance: 0,
    owned: 1,
    itemId: "bed-1",
    layout: { version: 2, items: n0.items, stored: [{ id: "bed-1", type: "bed" }] },
    wardrobe: null
  };
}

function sortedIds(items: readonly { id: string }[]) {
  return items.map((item) => item.id).sort();
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error
  );
}

// ---------- A ----------

describe("[spec] 089-④ 주문 함수(A)", () => {
  test("A1 옷 주문은 POST /api/home-shopping/orders에 JSON { type: 'capOrange', price: 60 }을 한 번 보낸다", async () => {
    fetchMock.mockResolvedValue(respond(200, oCapBody()));

    await orderHomeShoppingWearable({ type: "capOrange", price: 60 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.endsWith("/api/home-shopping/orders")).toBe(true);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ type: "capOrange", price: 60 });
  });

  test("A2 옷 주문 결과(O-cap)를 던지지 않고 type·price·balance 140·owned 1·itemId null·layout null·wardrobe(W-cap 그대로)로 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, oCapBody()));

    const result = await orderHomeShoppingWearable({ type: "capOrange", price: 60 });

    expect(result.type).toBe("capOrange");
    expect(result.price).toBe(60);
    expect(result.balance).toBe(140);
    expect(result.owned).toBe(1);
    expect(result.itemId).toBeNull();
    expect(result.layout).toBeNull();
    expect(result.wardrobe).toEqual(W_CAP);
  });

  test("A3 가구 주문 결과(O-bed, wardrobe null)는 지금처럼 배치(처음 배치 + 보관함 [bed-1])를 읽어 돌려주고 wardrobe는 null이다", async () => {
    fetchMock.mockResolvedValue(respond(200, oBedBody()));

    const result = await orderHomeShopping({ type: "bed", price: 300 });

    expect(result.type).toBe("bed");
    expect(result.balance).toBe(0);
    expect(result.owned).toBe(1);
    expect(result.itemId).toBe("bed-1");
    expect(sortedIds(result.layout.items)).toEqual(sortedIds(DEFAULT_LOBBY_LAYOUT.items));
    expect(storedItems(result.layout)).toEqual([{ id: "bed-1", type: "bed" }]);
    expect((result as { wardrobe?: unknown }).wardrobe ?? null).toBeNull();
  });

  test("A4 서버가 409 ALREADY_OWNED면 status 409, code 'ALREADY_OWNED', message '이미 가진 옷이에요.'인 ApiError를 던진다", async () => {
    fetchMock.mockResolvedValue(respond(409, { code: "ALREADY_OWNED", message: "이미 가진 옷이에요." }));

    const error = await caught(orderHomeShoppingWearable({ type: "capOrange", price: 60 }));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe("ALREADY_OWNED");
    expect((error as ApiError).message).toBe("이미 가진 옷이에요.");
  });

  test.each([
    ["PRICE_CHANGED", "가격이 바뀌었어요. 다시 확인해 주세요."],
    ["NOT_ENOUGH_LOOP_POINTS", "룹이 모자라요."]
  ])("A5 옷 주문에 서버가 409 %s면 code가 그 값이고 message가 서버 문구 그대로인 ApiError다", async (code, message) => {
    fetchMock.mockResolvedValue(respond(409, { code, message }));

    const error = await caught(orderHomeShoppingWearable({ type: "capOrange", price: 60 }));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe(code);
    expect((error as ApiError).message).toBe(message);
  });

  test.each([
    ["wardrobe가 없음", (() => {
      const { wardrobe: _omit, ...rest } = oCapBody();
      return rest;
    })()],
    ["wardrobe가 null", { ...oCapBody(), wardrobe: null }],
    ["wardrobe가 글", { ...oCapBody(), wardrobe: "broken" }]
  ])("C7(API 쪽) 옷 주문 결과의 %s이어도 던지지 않고 주문 결과(잔액 140, owned 1)를 돌려준다", async (_label, body) => {
    fetchMock.mockResolvedValue(respond(200, body));

    const result = await orderHomeShoppingWearable({ type: "capOrange", price: 60 });

    expect(result.type).toBe("capOrange");
    expect(result.balance).toBe(140);
    expect(result.owned).toBe(1);
    expect(result.layout).toBeNull();
  });
});
