// [spec] qa 테스트(작업 064-② 계정 저장, 모바일): 불러온 배치의 모양 검사가 서버와 같은 기준인지(결정 04의 1, 결정 08의 1 끝 줄).
// 결정 04의 1: "명세 목록에 없는 이상한 값도 모두 거절한다(방향 1.5, 문자열 숫자, null이나 빠진 값, 대문자 BACK, 모르는 키)",
// "바닥 가구는 가운데 점의 x 0~8, z 0~11이면 된다. 경계도 안이다", "벽 가구 along은 뒷벽 0~8, 옆벽 0~11", "버전이 빠졌거나 모르는 버전이면 거절",
// "폰도 불러온 배치를 같은 기준으로 본다. 틀리면 처음 배치다".
// 값은 서버 qa의 D1~D21(같은 폴더 06-qa-tests.md)과 같은 것을 쓴다. 폰에서 틀린 본문은 불러오기 함수가 null(→ 홈은 처음 배치)로 돌려준다.
// 홈에서 null이 처음 배치로 보이는 것은 home-lobby-layout-load.spec의 S4·S8이 본다.
// 네트워크는 전역 fetch 가짜다. 실제 서버에 닿지 않는다.
import * as SecureStore from "expo-secure-store";
import { getLobbyLayout } from "@/lib/api";
import type { LobbyLayout } from "@/lib/lobby3d/lobby-layout";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve())
}));

const P0: LobbyLayout = {
  floor: {
    desk: { x: 1.5, z: 5.5, facing: 0 },
    bookcase: { x: 0.5, z: 2.5, facing: 1 },
    wardrobe: { x: 7.5, z: 3.5, facing: 3 },
    rug: { x: 4.6, z: 7.2, facing: 0 }
  },
  wall: { board: { wall: "back", along: 1.8 }, window: { wall: "back", along: 4.8 } }
};

type Body = { version?: unknown; floor: Record<string, unknown>; wall: Record<string, unknown>; [key: string]: unknown };

function payload(layout: LobbyLayout): Body {
  return JSON.parse(JSON.stringify({ version: 1, ...layout }));
}

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
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => {
    if (key === "writeloop_access_token") return "access-token-064";
    if (key === "writeloop_refresh_token") return "refresh-token-064";
    return null;
  });
});

function floorPiece(body: Body, id: string) {
  return body.floor[id] as Record<string, unknown>;
}

function wallPiece(body: Body, id: string) {
  return body.wall[id] as Record<string, unknown>;
}

function rejectedCases(): [string, unknown][] {
  const cases: [string, unknown][] = [];
  const add = (label: string, change: (body: Body) => void | unknown) => {
    const body = payload(P0);
    const replaced = change(body);
    cases.push([label, replaced === undefined ? body : replaced]);
  };
  add("D1 버전이 빠짐", (b) => {
    delete b.version;
  });
  add("D2 버전 2", (b) => {
    b.version = 2;
  });
  add("D3 버전이 문자열 \"1\"", (b) => {
    b.version = "1";
  });
  add("D4 뒷벽 along 8.5(경계 바로 밖)", (b) => {
    wallPiece(b, "board").along = 8.5;
  });
  add("D5 바닥 z 11.5(경계 바로 밖)", (b) => {
    floorPiece(b, "rug").z = 11.5;
  });
  add("D6 바닥 x 8.5(경계 바로 밖)", (b) => {
    floorPiece(b, "wardrobe").x = 8.5;
  });
  add("D7 desk facing 1.5", (b) => {
    floorPiece(b, "desk").facing = 1.5;
  });
  add("D8 desk facing 문자열 \"1\"", (b) => {
    floorPiece(b, "desk").facing = "1";
  });
  add("D9 desk facing null", (b) => {
    floorPiece(b, "desk").facing = null;
  });
  add("D10 desk facing 빠짐", (b) => {
    delete floorPiece(b, "desk").facing;
  });
  add("D11 bookcase x 빠짐", (b) => {
    delete floorPiece(b, "bookcase").x;
  });
  add("D12 bookcase x 문자열 \"0.5\"", (b) => {
    floorPiece(b, "bookcase").x = "0.5";
  });
  add("D13 board wall 대문자 \"BACK\"", (b) => {
    wallPiece(b, "board").wall = "BACK";
  });
  add("D14 window along null", (b) => {
    wallPiece(b, "window").along = null;
  });
  add("D15 desk 안의 모르는 키 y", (b) => {
    floorPiece(b, "desk").y = 0;
  });
  add("D16 맨 위의 모르는 키 theme", (b) => {
    b.theme = "wood";
  });
  add("D17 바닥 묶음에 든 벽 가구 board", (b) => {
    b.floor.board = { x: 4.5, z: 4.5, facing: 0 };
  });
  add("D18 바닥 묶음이 null", (b) => {
    (b as { floor: unknown }).floor = null;
  });
  add("D19 board 안의 모르는 키 height", (b) => {
    wallPiece(b, "board").height = 1.75;
  });
  return cases;
}

describe("서버와 같은 기준으로 거절(결정 04의 1)", () => {
  test.each(rejectedCases())("[spec] %s → 불러오기가 배치를 돌려주지 않는다(null)", async (_label, body) => {
    fetchMock.mockResolvedValue(respond(200, body));

    await expect(getLobbyLayout()).resolves.toBeNull();
  });
});

describe("경계값은 방 안(결정 04의 1)", () => {
  test("[spec] D20 바닥 x 0·8, z 0·11과 뒷벽 along 0·8을 받아 값을 그대로 돌려준다", async () => {
    const layout: LobbyLayout = {
      floor: {
        desk: { x: 0, z: 0, facing: 0 },
        bookcase: { x: 8, z: 11, facing: 1 },
        wardrobe: { x: 0, z: 11, facing: 2 },
        rug: { x: 8, z: 0, facing: 3 }
      },
      wall: { board: { wall: "back", along: 0 }, window: { wall: "back", along: 8 } }
    };
    fetchMock.mockResolvedValue(respond(200, payload(layout)));

    await expect(getLobbyLayout()).resolves.toEqual(layout);
  });

  test("[spec] D21 옆벽 along 0·11(왼벽·오른벽)을 받아 값을 그대로 돌려준다", async () => {
    const first: LobbyLayout = { floor: P0.floor, wall: { board: { wall: "left", along: 0 }, window: { wall: "right", along: 11 } } };
    const second: LobbyLayout = { floor: P0.floor, wall: { board: { wall: "right", along: 0 }, window: { wall: "left", along: 11 } } };

    fetchMock.mockResolvedValue(respond(200, payload(first)));
    await expect(getLobbyLayout()).resolves.toEqual(first);

    fetchMock.mockResolvedValue(respond(200, payload(second)));
    await expect(getLobbyLayout()).resolves.toEqual(second);
  });
});
