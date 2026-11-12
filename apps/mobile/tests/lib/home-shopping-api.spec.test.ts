// [spec] qa 테스트(작업 086-③ 라룹 홈쇼핑 화면, 새 기능, 모바일): 룹 잔액·홈쇼핑 목록·주문 API 함수가 서버와 어떻게 주고받는지.
// 기대값은 시나리오(private 작업 폴더 086-2026-11-12-라룹-홈쇼핑/04-홈쇼핑-화면/02-qa-scenarios.md의 A1~A4, O17)에서만 가져오고,
// API 모양은 시나리오가 끌어온 ② 명세(03-홈쇼핑-서버/01-main-spec.md의 API 절)를 따른다.
// 구현 코드(apps/mobile/src/lib/api.ts)는 함수 이름과 인자(getLoopPoints, getHomeShopping, orderHomeShopping({ type, price }))를 알려고만 읽었다.
// O17은 "서버가 문구 없이 실패하면 기본 문구"를 두 층으로 나눠 본다: 여기서는 주문 함수가 던지는 오류의 문구,
// 화면 쪽(tests/app/home-shopping-screen.spec.test.tsx)에서는 문구가 빈 오류를 받았을 때 화면 알림.
// 네트워크는 전역 fetch를 가짜로 바꿔 실제 서버에 닿지 않는다(lobby-layout-api.spec.test.ts와 같은 틀). 로그인 토큰은 기기 저장소 가짜가 돌려준다.
import * as SecureStore from "expo-secure-store";
import { ApiError, getHomeShopping, getLoopPoints, orderHomeShopping } from "@/lib/api";
import { DEFAULT_LOBBY_LAYOUT, storedItems } from "@/lib/lobby3d/lobby-layout";
import { toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

const ACCESS_TOKEN = "access-token-086";

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

// ---------- 시나리오 공통 값 ----------

const S260 = {
  balance: 260,
  broadcast: { type: "bed", price: 300, salePrice: 240 },
  items: [
    { type: "books", price: 40, salePrice: null, owned: 0 },
    { type: "smallPlant", price: 50, salePrice: null, owned: 0 },
    { type: "lamp", price: 60, salePrice: null, owned: 1 },
    { type: "frame", price: 70, salePrice: null, owned: 0 },
    { type: "plant", price: 80, salePrice: null, owned: 0 },
    { type: "nightstand", price: 100, salePrice: null, owned: 0 },
    { type: "floorLamp", price: 110, salePrice: null, owned: 0 },
    { type: "rug", price: 150, salePrice: null, owned: 1 },
    { type: "wardrobe", price: 180, salePrice: null, owned: 1 },
    { type: "bed", price: 300, salePrice: 240, owned: 0 }
  ]
};

/** OK-BED: 침대 주문 성공 응답(layout은 N0 + 보관함 [bed-1], 서버 본문 모양 version 2). */
function okBedBody() {
  const n0 = toLobbyLayoutPayload(DEFAULT_LOBBY_LAYOUT) as { version: number; items: unknown[] };
  return {
    type: "bed",
    price: 240,
    balance: 20,
    owned: 1,
    itemId: "bed-1",
    layout: { version: 2, items: n0.items, stored: [{ id: "bed-1", type: "bed" }] }
  };
}

function sortedIds(items: readonly { id: string }[]) {
  return items.map((item) => item.id).sort();
}

// ---------- A ----------

describe("[spec] 086-③ API 함수(A)", () => {
  test("A1 잔액 함수는 GET /api/loop-points를 한 번 부르고, 돌려준 값의 잔액이 260이다", async () => {
    fetchMock.mockResolvedValue(respond(200, { balance: 260, today: { question: { count: 0, limit: 3, points: 30 } } }));

    const summary = await getLoopPoints();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/loop-points");
    expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(summary?.balance).toBe(260);
  });

  test("A2 목록 함수는 GET /api/home-shopping을 부르고, 잔액·방송 상품·items 10개를 응답 그대로(순서·salePrice·owned) 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, S260));

    const shop = await getHomeShopping();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/home-shopping");
    expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(shop.balance).toBe(260);
    expect(shop.broadcast).toEqual({ type: "bed", price: 300, salePrice: 240 });
    expect(shop.items).toEqual(S260.items);
  });

  test("A3 주문 함수(bed, 240)는 POST /api/home-shopping/orders에 JSON { type: 'bed', price: 240 }을 보내고, 잔액 20·개수 1·itemId bed-1·배치(N0 + 보관함 [bed-1])를 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, okBedBody()));

    const result = await orderHomeShopping({ type: "bed", price: 240 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/home-shopping/orders");
    expect((init?.method ?? "GET").toUpperCase()).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ type: "bed", price: 240 });
    expect(result.balance).toBe(20);
    expect(result.owned).toBe(1);
    expect(result.itemId).toBe("bed-1");
    expect(result.type).toBe("bed");
    expect(result.price).toBe(240);
    expect(sortedIds(result.layout.items)).toEqual(sortedIds(DEFAULT_LOBBY_LAYOUT.items));
    expect(storedItems(result.layout)).toEqual([{ id: "bed-1", type: "bed" }]);
  });

  test("A4 서버가 409 PRICE_CHANGED면 던진 오류의 code가 'PRICE_CHANGED'이고 message가 서버 문구 그대로다", async () => {
    fetchMock.mockResolvedValue(respond(409, { code: "PRICE_CHANGED", message: "가격이 바뀌었어요. 다시 확인해 주세요." }));

    const error = await orderHomeShopping({ type: "bed", price: 240 }).then(
      () => null,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("PRICE_CHANGED");
    expect((error as ApiError).message).toBe("가격이 바뀌었어요. 다시 확인해 주세요.");
  });

  test.each([
    ["본문 없음", undefined],
    ["message 없는 본문", { code: "INTERNAL" }]
  ])("O17(API 쪽) 서버가 500을 %s으로 돌려주면 주문 함수가 던진 오류의 문구가 '주문하지 못했어요. 다시 시도해 주세요'다", async (_label, body) => {
    fetchMock.mockResolvedValue(respond(500, body));

    const error = await orderHomeShopping({ type: "bed", price: 240 }).then(
      () => null,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("주문하지 못했어요. 다시 시도해 주세요");
  });
});
