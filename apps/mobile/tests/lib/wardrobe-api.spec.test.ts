// [spec] qa 테스트(작업 089 ② 착용 아이템 목록과 저장, 새 기능, 모바일): 옷장 불러오기 API 함수가 서버와 어떻게 주고받는지(A1~A4).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/04-아이템-목록과-저장/03-qa-scenarios.md A1~A4)에서만 가져온다.
// 구현 커밋 e98ad44(apps/mobile/src/lib/api.ts)에서 읽은 것은 함수 이름과 인자뿐이다(getWardrobe()).
// 네트워크는 전역 fetch를 가짜로 바꿔 실제 서버에 닿지 않는다(home-shopping-api.spec.test.ts와 같은 틀). 로그인 토큰은 기기 저장소 가짜가 돌려준다.
import * as SecureStore from "expo-secure-store";
import { getWardrobe } from "@/lib/api";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

const ACCESS_TOKEN = "access-token-089";
// 앱은 접근 토큰과 갱신 토큰이 둘 다 있어야 로그인 토큰으로 본다(api.ts getStoredTokenSession)
const REFRESH_TOKEN = "refresh-token-089";

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
    if (key === "writeloop_refresh_token") return REFRESH_TOKEN;
    return null;
  });
});

// ---------- 시나리오의 값 ----------

const ALL_NULL = { hat: null, top: null, bottom: null, shoes: null, face: null, back: null, accessory: null };

const R0 = { items: [], equipped: ALL_NULL };

const R1 = {
  items: [{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" }],
  equipped: { ...ALL_NULL, hat: "capOrange" }
};

const R4 = {
  items: [
    { type: "shoesBrown", slot: "shoes", acquiredAt: "2026-11-13T09:00:00Z" },
    { type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T10:00:00Z" },
    { type: "tshirtOrange", slot: "top", acquiredAt: "2026-11-13T11:00:00Z" },
    { type: "shortsNavy", slot: "bottom", acquiredAt: "2026-11-13T12:00:00Z" }
  ],
  equipped: { hat: "capOrange", top: "tshirtOrange", bottom: "shortsNavy", shoes: "shoesBrown", face: null, back: null, accessory: null }
};

function headerOf(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

// ---------- A ----------

describe("[spec] 옷장 불러오기 API 함수(A1~A4)", () => {
  test("A1: GET /api/wardrobe를 한 번, Authorization 'Bearer <저장된 토큰>'으로 부른다", async () => {
    fetchMock.mockResolvedValue(respond(200, R1));

    await getWardrobe();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/wardrobe");
    expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(headerOf(init, "Authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  test("A2: 200 R1(명세 JSON 예)이면 items와 equipped를 응답 그대로 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, R1));

    const wardrobe = await getWardrobe();

    expect(wardrobe?.items).toEqual([{ type: "capOrange", slot: "hat", acquiredAt: "2026-11-13T12:00:00Z" }]);
    expect(wardrobe?.equipped).toEqual({ hat: "capOrange", top: null, bottom: null, shoes: null, face: null, back: null, accessory: null });
  });

  test("A3: 200 R4이면 items가 얻은 순서(shoesBrown, capOrange, tshirtOrange, shortsNavy)와 acquiredAt 그대로이고 equipped도 R4와 같다", async () => {
    fetchMock.mockResolvedValue(respond(200, R4));

    const wardrobe = await getWardrobe();

    expect(wardrobe?.items.map((item) => item.type)).toEqual(["shoesBrown", "capOrange", "tshirtOrange", "shortsNavy"]);
    expect(wardrobe?.items).toEqual(R4.items);
    expect(wardrobe?.equipped).toEqual(R4.equipped);
  });

  test("A4: 200 R0(가진 것 없음)이면 items가 빈 배열이고 equipped의 일곱 부위가 모두 null이다", async () => {
    fetchMock.mockResolvedValue(respond(200, R0));

    const wardrobe = await getWardrobe();

    expect(wardrobe?.items).toEqual([]);
    expect(wardrobe?.equipped).toEqual(ALL_NULL);
  });
});
