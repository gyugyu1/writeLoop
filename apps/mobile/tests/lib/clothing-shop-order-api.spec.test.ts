// [spec] qa 테스트(작업 133 ④ 계산대·구매, 모바일): 주문 API 호출 모양과 실패 안내.
// 기대값은 private 작업 폴더 133-2026-11-21-옷가게-실내-구매/07-계산대-구매/02-qa-scenarios.md(M13·M14·M15·M24)와 명세의 요청·응답 모양에서만 가져온다.
import * as SecureStore from "expo-secure-store";
import { orderClothingShop } from "@/lib/api";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

type FakeResponse = { ok: boolean; status: number; headers: Headers; json: () => Promise<unknown>; text: () => Promise<string> };

function respond(status: number, body?: unknown): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => JSON.parse(JSON.stringify(body)),
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
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("token");
});

describe("[spec] orderClothingShop", () => {
  it("M13·M14: POST /api/clothing-shop/orders 로 { items: [{ type, price }] }를 보내고 응답의 items·total·balance·wardrobe를 돌려준다", async () => {
    const wardrobe = { items: [{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-21T00:00:00Z" }], equipped: { hat: null } };
    fetchMock.mockResolvedValue(respond(200, { items: [{ type: "capOrange", price: 60 }], total: 60, balance: 440, wardrobe }));
    const result = await orderClothingShop([{ type: "capOrange", price: 60 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/clothing-shop/orders");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ items: [{ type: "capOrange", price: 60 }] });
    expect(result.items).toEqual([{ type: "capOrange", price: 60 }]);
    expect(result.total).toBe(60);
    expect(result.balance).toBe(440);
    expect(result.wardrobe).toEqual(wardrobe);
  });

  it("M15: 서버가 409로 거절하면 서버가 준 안내 글로 던진다", async () => {
    fetchMock.mockResolvedValue(respond(409, { code: "PRICE_CHANGED", message: "가격이 바뀌었어요. 다시 확인해 주세요." }));
    await expect(orderClothingShop([{ type: "capOrange", price: 60 }])).rejects.toThrow("가격이 바뀌었어요. 다시 확인해 주세요.");
  });
});
