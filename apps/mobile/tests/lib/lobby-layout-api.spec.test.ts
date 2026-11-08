// [spec] qa 테스트(작업 064-② 계정 저장, 모바일): 배치 저장 함수와 불러오기 함수가 서버 응답을 어떻게 받는지.
// 기대값은 시나리오(private 작업 폴더 064/03-계정-저장/03-qa-scenarios.md)의 S4·S5·S8·S17·S18과 배치 값 L1·L3에서 가져오고,
// 시나리오가 정하지 못한 API 모양(M1·M2·M4)은 결정(같은 폴더 04-main-decision.md의 1: 경로 /api/lobby-layout, 불러오기 GET·저장 PUT,
// 본문은 배치 데이터에 맨 위 version 1, 저장한 배치가 없으면 404)을 따른다.
// 066-①(private 작업 폴더 066/02-카탈로그-배치v2-공통규칙/01-main-spec.md)에서 본문이 v2(version 2, items 목록)로 바뀌어,
// 명세의 "고칠 기존 테스트"대로 확인하는 뜻은 그대로 두고 배치 모양만 v2로 고쳤다. 배치 값(자리·방향·벽)은 그대로다.
// S8-1의 "V+1"은 3이 되고, S8-4는 v2에서 꼭 있어야 하는 가구가 장소 가구뿐이라(066-① 명세 4) 빠뜨리는 가구를 옷장에서 책장으로 바꿨다.
// 구현 코드(apps/mobile/src/lib/api.ts)는 함수 이름과 인자를 알려고만 읽었다.
// 네트워크는 전역 fetch를 가짜로 바꿔 실제 서버에 닿지 않는다. 로그인 토큰은 기기 저장소(expo-secure-store) 가짜가 돌려준다.
import * as SecureStore from "expo-secure-store";
import { getLobbyLayout, saveLobbyLayout } from "@/lib/api";
import type { LobbyLayout } from "@/lib/lobby3d/lobby-layout";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

const ACCESS_TOKEN = "access-token-064";
const REFRESH_TOKEN = "refresh-token-064";

// ---------- 066-① 배치 데이터 v2 ----------
// 배치는 { items: [{ id, type, floor?: { x, z, facing }, wall?: { wall, along } }] }이고 처음 배치의 인스턴스 id는 종류 id와 같다(066-① 명세 2).
// 064 때 적은 배치 값을 바닥 가구·벽 가구 묶음으로 그대로 두고 v2()로 목록을 만든다. 목록 순서는 명세가 정하지 않아 견줄 때 id 순으로 늘어놓는다.
type LayoutItem = LobbyLayout["items"][number];
type FloorSpot = NonNullable<LayoutItem["floor"]>;
type WallSpot = NonNullable<LayoutItem["wall"]>;

function v2(floor: Record<string, FloorSpot>, wall: Record<string, WallSpot>): LobbyLayout {
  return {
    items: [
      ...Object.entries(floor).map(([id, spot]) => ({ id, type: id, floor: spot }) as LayoutItem),
      ...Object.entries(wall).map(([id, spot]) => ({ id, type: id, wall: spot }) as LayoutItem)
    ]
  };
}

/** id 순으로 늘어놓은 인스턴스(목록 순서를 보지 않고 견준다). */
function sortedItems(layout: { items: readonly { id: string }[] } | null | undefined) {
  return [...(layout?.items ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const P0_FLOOR: Record<string, FloorSpot> = {
  desk: { x: 1.5, z: 5.5, facing: 0 },
  bookcase: { x: 0.5, z: 2.5, facing: 1 },
  wardrobe: { x: 7.5, z: 3.5, facing: 3 },
  rug: { x: 4.6, z: 7.2, facing: 0 }
};
const P0_WALL: Record<string, WallSpot> = {
  board: { wall: "back", along: 1.8 },
  window: { wall: "back", along: 4.8 }
};

// 시나리오의 배치 L1(바닥 가구를 옮기고 돌림, 벽 가구를 뒷벽에서 옮김)
const L1: LobbyLayout = v2(
  {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 4.5, facing: 1 },
    wardrobe: { x: 7.5, z: 6.5, facing: 3 },
    rug: { x: 3.0, z: 8.0, facing: 1 }
  },
  {
    board: { wall: "back", along: 2.0 },
    window: { wall: "back", along: 5.6 }
  }
);

// 시나리오의 처음 배치 P0
const P0: LobbyLayout = v2(P0_FLOOR, P0_WALL);

// 시나리오의 배치 L3(P0에서 게시판은 오른벽 6.0, 창문은 왼벽 8.0)
const L3: LobbyLayout = v2(P0_FLOOR, { board: { wall: "right", along: 6.0 }, window: { wall: "left", along: 8.0 } });
// S8-15(P0에서 게시판을 왼벽 along 10으로: 뒷벽이면 밖, 옆벽이면 안)
const L4: LobbyLayout = v2(P0_FLOOR, { board: { wall: "left", along: 10 }, window: P0_WALL.window });

/** 지금 버전(066-① 명세 2: version 2)을 붙인 본문. JSON으로 한 번 오가 깊은 복사가 된다. */
function payload(layout: LobbyLayout): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ version: 2, ...layout }));
}

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

function requestHeaders(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers);
}

// ---------- 저장 함수(S17, S18) ----------

describe("저장 함수", () => {
  test("[spec] S17 로그인 토큰을 붙여 L1과 지금 버전(2)을 그대로 보내고(PUT /api/lobby-layout, 1번), 서버가 돌려준 배치(L1)를 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, payload(L1)));

    const saved = await saveLobbyLayout(L1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/lobby-layout");
    expect((init?.method ?? "GET").toUpperCase()).toBe("PUT");
    expect(requestHeaders(init).get("Authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
    const body = JSON.parse(String(init?.body));
    expect(Object.keys(body).sort()).toEqual(["items", "version"]);
    expect(body.version).toBe(2);
    expect(sortedItems(body)).toEqual([
      { id: "board", type: "board", wall: { wall: "back", along: 2.0 } },
      { id: "bookcase", type: "bookcase", floor: { x: 0.5, z: 4.5, facing: 1 } },
      { id: "desk", type: "desk", floor: { x: 1.5, z: 5.5, facing: 0 } },
      { id: "rug", type: "rug", floor: { x: 3.0, z: 8.0, facing: 1 } },
      { id: "wardrobe", type: "wardrobe", floor: { x: 7.5, z: 6.5, facing: 3 } },
      { id: "window", type: "window", wall: { wall: "back", along: 5.6 } }
    ]);
    expect(sortedItems(saved)).toEqual(sortedItems(L1));
  });

  test("[spec] S17 소수 자리(4.6, 7.2, 1.8, 4.8)를 반올림하지 않고 보낸다(P0)", async () => {
    fetchMock.mockResolvedValue(respond(200, payload(P0)));

    const saved = await saveLobbyLayout(P0);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const item = (id: string) => (body.items as { id: string; floor?: unknown; wall?: unknown }[]).find((i) => i.id === id);
    expect(item("rug")?.floor).toEqual({ x: 4.6, z: 7.2, facing: 0 });
    expect(item("board")?.wall).toEqual({ wall: "back", along: 1.8 });
    expect(item("window")?.wall).toEqual({ wall: "back", along: 4.8 });
    expect(body.version).toBe(2);
    expect(sortedItems(saved)).toEqual(sortedItems(P0));
  });

  test.each([
    ["(a) 400", 400],
    ["(b) 500", 500]
  ])("[spec] S18 %s를 받으면 저장 함수가 실패로 끝난다(Promise 거절)", async (_label, status) => {
    fetchMock.mockResolvedValue(respond(status, { message: "오류", code: "ERR" }));

    await expect(saveLobbyLayout(L1)).rejects.toBeInstanceOf(Error);
  });

  test("[spec] S18 (c) 네트워크가 실패하면 저장 함수가 실패로 끝난다(Promise 거절)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    await expect(saveLobbyLayout(L1)).rejects.toBeInstanceOf(Error);
  });
});

// ---------- 불러오기 함수가 서버 응답을 받는 방법(S4, S5, S8의 바탕) ----------

describe("불러오기 함수", () => {
  test("[spec] S2 바탕: 200에 L1(지금 버전)을 받으면 L1을 돌려준다(GET /api/lobby-layout, 로그인 토큰)", async () => {
    fetchMock.mockResolvedValue(respond(200, payload(L1)));

    const loaded = await getLobbyLayout();

    expect(sortedItems(loaded)).toEqual(sortedItems(L1));
    expect(Object.keys(loaded ?? {})).toEqual(["items"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe("/api/lobby-layout");
    expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
    expect(requestHeaders(init).get("Authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  test("[spec] S3 바탕: 옆벽 배치 L3을 받으면 L3을 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(200, payload(L3)));

    expect(sortedItems(await getLobbyLayout())).toEqual(sortedItems(L3));
  });

  test("[spec] S8-15 바탕: 옆벽 along 10(뒷벽이면 밖, 옆벽이면 안)은 받아들인다", async () => {
    fetchMock.mockResolvedValue(respond(200, payload(L4)));

    expect(sortedItems(await getLobbyLayout())).toEqual(sortedItems(L4));
  });

  test("[spec] S4 바탕: 저장한 배치가 없으면(404) 오류가 아니라 '없음'(null)을 돌려준다", async () => {
    fetchMock.mockResolvedValue(respond(404, { message: "없음" }));

    await expect(getLobbyLayout()).resolves.toBeNull();
  });

  test("[spec] S5 바탕: (a) 서버 오류 500이면 실패로 끝난다", async () => {
    fetchMock.mockResolvedValue(respond(500, { message: "오류" }));

    await expect(getLobbyLayout()).rejects.toBeInstanceOf(Error);
  });

  test("[spec] S5 바탕: (b) 네트워크가 실패하면 실패로 끝난다", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    await expect(getLobbyLayout()).rejects.toBeInstanceOf(Error);
  });

  // S8: L1을 한 군데만 바꾼 본문 → 불러오기가 배치를 돌려주지 않는다(null). 홈에서 처음 배치로 보이는지는 홈 테스트가 본다.
  test.each(invalidPayloadCases())("[spec] %s → 배치로 받아들이지 않는다(null)", async (_label, body) => {
    fetchMock.mockResolvedValue(respond(200, body));

    await expect(getLobbyLayout()).resolves.toBeNull();
  });
});

/** 시나리오 S8-1~14의 본문(066-①에서 v2 모양으로). 그 밖은 지금 버전의 L1이다. */
function invalidPayloadCases(): [string, unknown][] {
  type Body = { version?: unknown; items: Record<string, unknown>[] };
  const base = () => payload(L1) as unknown as Body;
  const item = (p: Body, id: string) => p.items.find((i) => i.id === id)!;
  const floorOf = (p: Body, id: string) => item(p, id).floor as Record<string, unknown>;
  const wallOf = (p: Body, id: string) => item(p, id).wall as Record<string, unknown>;
  const cases: [string, unknown][] = [];
  const add = (label: string, change: (p: Body) => unknown) => {
    const p = base();
    const changed = change(p);
    cases.push([label, changed === undefined ? p : changed]);
  };
  add("S8-1 모양 버전이 V+1(3)", (p) => {
    p.version = 3;
  });
  add("S8-2 모양 버전이 999", (p) => {
    p.version = 999;
  });
  add("S8-3 모양 버전 필드가 없음", (p) => {
    delete p.version;
  });
  add("S8-4 꼭 있어야 하는 가구(장소 가구 bookcase)가 빠짐", (p) => {
    p.items = p.items.filter((i) => i.id !== "bookcase");
  });
  add("S8-5 벽 가구 window가 빠짐", (p) => {
    p.items = p.items.filter((i) => i.id !== "window");
  });
  add("S8-6 모르는 가구 lamp", (p) => {
    p.items.push({ id: "lamp", type: "lamp", floor: { x: 4.5, z: 4.5, facing: 0 } });
  });
  add("S8-7 desk facing 4", (p) => {
    floorOf(p, "desk").facing = 4;
  });
  add("S8-8 rug facing -1", (p) => {
    floorOf(p, "rug").facing = -1;
  });
  add("S8-9 board wall front", (p) => {
    wallOf(p, "board").wall = "front";
  });
  add("S8-10 bookcase x -1(방 밖)", (p) => {
    floorOf(p, "bookcase").x = -1;
  });
  add("S8-11 wardrobe z 13(깊이 11 밖)", (p) => {
    floorOf(p, "wardrobe").z = 13;
  });
  add("S8-12 board along 10(뒷벽, 가로 8 밖)", (p) => {
    wallOf(p, "board").along = 10;
  });
  add("S8-13 window left along 13(옆벽, 깊이 11 밖)", (p) => {
    item(p, "window").wall = { wall: "left", along: 13 };
  });
  add("S8-14 desk 자리가 null", (p) => {
    item(p, "desk").floor = null;
  });
  add("S8-14 board 자리가 문자열", (p) => {
    item(p, "board").wall = "x";
  });
  add("S8-14 본문 전체가 null", () => null);
  return cases;
}
