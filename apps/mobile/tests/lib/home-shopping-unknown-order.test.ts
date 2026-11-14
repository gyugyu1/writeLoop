// 메인 세션 테스트(작업 089 ④, 10-qa-verify 의심 1): 앱이 모르는 상품(⑤에서 서버가 더할 옷 등)을 주문하면
// 응답 모양으로 가구·옷을 가려, 룹이 쓰인 주문을 실패로 보이지 않는다.
import * as SecureStore from "expo-secure-store";
import { orderHomeShoppingAny } from "@/lib/api";
import { DEFAULT_LOBBY_LAYOUT } from "@/lib/lobby3d/lobby-layout";
import { toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

function respond(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => JSON.parse(JSON.stringify(body)),
    text: async () => JSON.stringify(body)
  };
}

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => (key === "writeloop_access_token" ? "token" : null));
});

describe("앱이 모르는 상품 주문", () => {
  it("배치가 null인 응답(옷)은 던지지 않고 옷 결과로 돌려준다", async () => {
    const wardrobe = { items: [{ type: "glassesRound", slot: "face", acquiredAt: "2026-12-01T00:00:00Z" }], equipped: { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null } };
    fetchMock.mockResolvedValue(respond(200, { type: "glassesRound", price: 90, balance: 10, owned: 1, itemId: null, layout: null, wardrobe }));

    const result = await orderHomeShoppingAny({ type: "glassesRound", price: 90 });

    expect(result).toEqual({ type: "glassesRound", price: 90, balance: 10, owned: 1, itemId: null, layout: null, wardrobe });
  });

  it("배치가 있는 응답(새 가구)은 가구 결과로 돌려준다", async () => {
    const layout = toLobbyLayoutPayload(DEFAULT_LOBBY_LAYOUT);
    fetchMock.mockResolvedValue(respond(200, { type: "sofa", price: 200, balance: 50, owned: 1, itemId: "sofa-1", layout, wardrobe: null }));

    const result = await orderHomeShoppingAny({ type: "sofa", price: 200 });

    expect(result.layout).not.toBeNull();
    expect(result.itemId).toBe("sofa-1");
    expect(result.balance).toBe(50);
  });
});
