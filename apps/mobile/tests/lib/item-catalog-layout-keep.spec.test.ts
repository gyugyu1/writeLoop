// [spec] qa 테스트(작업 090-① 서버 아이템 목록, 기능 변경, 모바일): 방 배치에 앱이 그릴 줄 모르는 가구가 들어 있을 때.
// 기대값은 명세(private 작업 폴더 090-2026-11-13-아이템-목록-서버로/02-서버-아이템-목록/01-main-spec.md)의
// "바뀌는 동작 > 모바일"(방 배치: 모르는 가구가 들어 있어도 배치 전체를 버리지 않고, 저장할 때 그대로 다시 보낸다.
// 홈쇼핑 주문 결과의 배치에 모르는 가구가 있어도 주문을 실패로 보지 않는다)과 "그대로여야 할 동작"(배치 검사)에서만 가져온다.
// 테스트 이름 앞의 [바뀔]·[그대로]는 03-qa-tests.md의 분류와 같다. K10~K12는 같은 폴더 04-main-decision.md C6(받침과 함께 지킴, id 규칙, 40개 한도)에서 가져왔다.
// 구현 코드는 부르는 방법(parseLobbyLayoutPayload·toLobbyLayoutPayload, getLobbyLayout·saveLobbyLayout·orderHomeShopping,
// rememberLayout·loadRememberedLayout)을 알려고만 읽었다. 앱 안의 배치 값에서 모르는 가구를 어디에 두는지는 명세가 정하지 않아 보지 않고,
// "다시 본문으로 만들었을 때(저장할 때 보내는 본문) 그 가구가 받은 그대로 들어 있는가"로 본다.
// "모르는 가구"는 앱 가구 목록(furniture-catalog)에 없는 종류 id다(sofa, neonSign). 네트워크는 전역 fetch 가짜, 기기 저장소는 jest 가짜다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getLobbyLayout, orderHomeShopping, saveLobbyLayout } from "@/lib/api";
import { loadRememberedLayout, rememberLayout } from "@/lib/lobby3d/layout-storage";
import { parseLobbyLayoutPayload, toLobbyLayoutPayload } from "@/lib/lobby3d/lobby-layout-payload";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

type Item = Record<string, unknown>;
type Stored = { id: string; type: string };
type Payload = { version?: unknown; items?: Item[]; stored?: Stored[] };

/** 처음 배치(스탠드 없음)의 가구 여섯. */
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

/** 모르는 바닥 가구(앱 가구 목록에 없는 sofa). */
const SOFA: Item = { id: "sofa1", type: "sofa", floor: { x: 4.5, z: 9.5, facing: 0 } };
/** 모르는 벽 가구(앱 가구 목록에 없는 neonSign). */
const NEON: Item = { id: "neon1", type: "neonSign", wall: { wall: "back", along: 6.5 } };
/** 보관함의 모르는 가구. */
const STORED_SOFA: Stored = { id: "s1", type: "sofa" };
const STORED_WARDROBE: Stored = { id: "w2", type: "wardrobe" };

function body(items: Item[], stored?: Stored[]): Payload {
  return JSON.parse(JSON.stringify(stored ? { version: 2, items, stored } : { version: 2, items }));
}

function byId<T extends { id: string }>(list: readonly T[] | undefined): T[] {
  return [...(list ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** 받은 본문을 읽고 다시 본문으로 만든다(저장할 때 보내는 본문). 읽지 못하면 null. */
function roundTrip(value: Payload): Payload | null {
  const parsed = parseLobbyLayoutPayload(value);
  if (parsed === null) return null;
  return JSON.parse(JSON.stringify(toLobbyLayoutPayload(parsed))) as Payload;
}

// ---------- 본문 읽기와 다시 만들기 ----------

describe("[spec] 090-① 모바일 방 배치: 모르는 가구가 든 본문", () => {
  test("K1 [바뀔] 방에 모르는 바닥 가구(sofa)가 있어도 배치를 버리지 않는다(null이 아니다)", () => {
    expect(parseLobbyLayoutPayload(body([...defItems(), SOFA]))).not.toBeNull();
  });

  test("K2 [바뀔] K1의 배치를 다시 본문으로 만들면 가구가 일곱이고, 아는 가구 여섯과 모르는 sofa가 받은 그대로다", () => {
    const sent = roundTrip(body([...defItems(), SOFA]));

    expect(sent).not.toBeNull();
    expect(sent!.version).toBe(2);
    expect(byId(sent!.items as { id: string }[])).toEqual(byId([...defItems(), SOFA] as { id: string }[]));
  });

  test("K3 [바뀔] 모르는 벽 가구(neonSign)도 버리지 않고 다시 본문으로 만들면 받은 그대로다", () => {
    const sent = roundTrip(body([...defItems(), NEON]));

    expect(sent).not.toBeNull();
    expect(byId(sent!.items as { id: string }[])).toEqual(byId([...defItems(), NEON] as { id: string }[]));
  });

  test("K4 [바뀔] 보관함의 모르는 가구(s1 sofa)도 버리지 않고, 다시 본문으로 만들면 보관함이 아는 옷장 w2와 s1 둘 그대로다", () => {
    const sent = roundTrip(body(defItems(), [STORED_WARDROBE, STORED_SOFA]));

    expect(sent).not.toBeNull();
    expect(byId(sent!.items as { id: string }[])).toEqual(byId(defItems() as { id: string }[]));
    expect(byId(sent!.stored)).toEqual(byId([STORED_WARDROBE, STORED_SOFA]));
  });

  test("K5 [그대로] 모르는 가구가 있어도 장소 가구(책상)가 빠진 배치는 지금처럼 읽지 않는다(null)", () => {
    const items = defItems().filter((item) => item.id !== "desk");

    expect(parseLobbyLayoutPayload(body([...items, SOFA]))).toBeNull();
  });

  test("K6 [그대로] 아는 종류의 모양이 틀린 배치(탁상 소품 스탠드에 바닥 자리)는 지금처럼 읽지 않는다(null)", () => {
    expect(parseLobbyLayoutPayload(body([...defItems(), { id: "lamp", type: "lamp", floor: { x: 4.5, z: 4.5, facing: 0 } }]))).toBeNull();
  });

  // 04 결정 C6: 모르는 받침 가구 위의 소품은 받침과 함께 지키고, 모르는 가구에도 id 규칙을 적용하며 40개 한도에 센다
  test("K10 [바뀔] 모르는 받침 가구(sofa1) 위에 올린 아는 소품(lamp2)도 받침과 함께 버리지 않고, 다시 본문으로 만들면 둘 다 받은 그대로다", () => {
    const lampOnSofa: Item = { id: "lamp2", type: "lamp", on: { parent: "sofa1", slot: 0, facing: 0 } };
    const sent = roundTrip(body([...defItems(), SOFA, lampOnSofa]));

    expect(sent).not.toBeNull();
    expect(byId(sent!.items as { id: string }[])).toEqual(byId([...defItems(), SOFA, lampOnSofa] as { id: string }[]));
  });

  test.each<[string, Item]>([
    ["빈칸이 든 id(a b)", { ...SOFA, id: "a b" }],
    ["41자 id", { ...SOFA, id: "a".repeat(41) }],
    ["id가 방의 옷장 id와 같음", { ...SOFA, id: "wardrobe" }]
  ])("K11 [그대로] 모르는 가구라도 id 규칙을 어기면(%s) 지금처럼 읽지 않는다(null)", (_label, item) => {
    expect(parseLobbyLayoutPayload(body([...defItems(), item]))).toBeNull();
  });

  test("K12 [바뀔] 모르는 가구도 40개 한도에 센다: 방 6 + 보관함 옷장 33 + 모르는 sofa1 = 40은 읽고, 모르는 가구가 하나 더 있어 41이면 null", () => {
    const wardrobes = Array.from({ length: 33 }, (_, i) => ({ id: `w${i + 1}`, type: "wardrobe" }));

    expect(parseLobbyLayoutPayload(body([...defItems(), SOFA], wardrobes))).not.toBeNull();
    expect(parseLobbyLayoutPayload(body([...defItems(), SOFA, NEON], wardrobes))).toBeNull();
  });
});

// ---------- 서버에서 받고 다시 보내기 ----------

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

describe("[spec] 090-① 모바일 방 배치: 서버와 주고받기", () => {
  beforeAll(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(async () => {
    fetchMock.mockReset();
    await AsyncStorage.clear();
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => {
      if (key === "writeloop_access_token") return "access-token-090";
      if (key === "writeloop_refresh_token") return "refresh-token-090";
      return null;
    });
  });

  test("K7 [바뀔] 불러온 배치(방에 sofa1·neon1, 보관함에 w2·s1)를 그대로 저장하면 보내는 본문에 모르는 가구 셋이 받은 그대로 있고, 저장도 성공한다", async () => {
    const server = body([...defItems(), SOFA, NEON], [STORED_WARDROBE, STORED_SOFA]);
    fetchMock.mockResolvedValueOnce(respond(200, server));

    const loaded = await getLobbyLayout();
    expect(loaded).not.toBeNull();

    // 가짜 서버는 받은 본문을 그대로 돌려준다
    fetchMock.mockImplementationOnce(async (_url, init) => respond(200, JSON.parse(String(init?.body))));
    const saved = await saveLobbyLayout(loaded!);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toMatch(/\/api\/lobby-layout$/);
    expect(init?.method).toBe("PUT");
    const sent = JSON.parse(String(init?.body)) as Payload;
    expect(byId(sent.items as { id: string }[])).toEqual(byId([...defItems(), SOFA, NEON] as { id: string }[]));
    expect(byId(sent.stored)).toEqual(byId([STORED_WARDROBE, STORED_SOFA]));
    expect(saved).not.toBeNull();
  });

  test("K8 [바뀔] 가구 주문(bed)의 결과 배치에 모르는 가구(sofa1)가 있어도 주문이 실패하지 않고, 결과의 배치를 다시 본문으로 만들면 sofa1이 그대로다", async () => {
    const layout = body([...defItems(), SOFA], [{ id: "bed-1", type: "bed" }]);
    fetchMock.mockResolvedValueOnce(respond(200, { type: "bed", price: 300, balance: 200, owned: 1, itemId: "bed-1", layout, wardrobe: null }));

    const result = await orderHomeShopping({ type: "bed", price: 300 });

    expect(result.type).toBe("bed");
    expect(result.balance).toBe(200);
    expect(result.owned).toBe(1);
    expect(result.itemId).toBe("bed-1");
    const sent = JSON.parse(JSON.stringify(toLobbyLayoutPayload(result.layout))) as Payload;
    expect(byId(sent.items as { id: string }[])).toEqual(byId([...defItems(), SOFA] as { id: string }[]));
    expect(byId(sent.stored)).toEqual([{ id: "bed-1", type: "bed" }]);
  });

  test("K9 [바뀔] 모르는 가구가 든 배치를 이 기기에 기억해 두었다가 읽어도 버리지 않고, 다시 본문으로 만들면 sofa1·s1이 그대로다", async () => {
    const parsed = parseLobbyLayoutPayload(body([...defItems(), SOFA], [STORED_SOFA]));
    expect(parsed).not.toBeNull();

    await rememberLayout(7, parsed!);
    const remembered = await loadRememberedLayout(7);

    expect(remembered).not.toBeNull();
    const sent = JSON.parse(JSON.stringify(toLobbyLayoutPayload(remembered!))) as Payload;
    expect(byId(sent.items as { id: string }[])).toEqual(byId([...defItems(), SOFA] as { id: string }[]));
    expect(byId(sent.stored)).toEqual([STORED_SOFA]);
  });
});
