// [spec] qa 테스트(작업 093 창문 붙박이, 기능 변경, 모바일): 꾸미기 편집기(LobbyEditor) 단위로 창문이 붙박이인지 본다.
// 기대값은 명세(private 작업 폴더 093-2026-11-14-창문-붙박이/01-main-spec.md)의 "바뀌는 동작" 1·2·3과 "그대로여야 할 동작"에서만 가져온다.
// - 창문은 늘 뒷벽 4.8에 있다. 꾸미기에서 창문을 누르면 고르지 않고(들리거나 옮겨지지 않는다) 짧은 안내를 보여 준다.
// - 서버 아이템 목록의 창문에 "옮길 수 없음" 값이 있고, 앱은 그 값을 보고 위 동작을 한다(값 이름은 구현이 정한다).
// - 다른 가구(게시판 등)의 고르기·옮기기와, 다른 가구를 창문 자리에 겹쳐 놓을 수 없는 것은 그대로다.
// 테스트 이름 앞의 [바뀔]·[그대로]는 03-qa-tests.md의 분류와 같다.
// 가정:
// - 안내는 지금의 다른 안내처럼 편집기가 pointerDown이나 pointerUp의 반환값(null이 아닌 값)으로 화면에 알린다. 값의 이름은 명세가 정하지 않아
//   누를 때·뗄 때 둘 중 하나가 null이 아닌지만 본다(글은 화면 테스트 home-lobby-window-fixed.spec.test.tsx가 본다).
// - 서버 목록 테스트(M1·M2)는 백엔드 목록 파일(apps/backend/src/main/resources/catalog/items.json)을 그대로 읽어 앱의 목록 읽기(parseItemCatalog)에 넣는다.
// 구현 코드는 부르는 방법(LobbyEditor의 생성자·pointerDown·pointerMove·pointerUp·selected·dragging·storable·handle·wallMarks·zone·layout,
// setItemCatalog·parseItemCatalog, findFurnitureType, fitLayoutToRoom·isPlaceableLayout)을 알려고만 읽었다.
// 04-main-decision.md(사용자 결정)로 더하거나 고친 것(보고 06-qa-tests.md):
// - 1: 값 이름은 draw.fixed(true). M2를 이름(draw.fixed)으로 다시 썼다(옛 M2는 창문에만 있는 칸을 옮겨 붙였다).
// - 2: 안내 순서. 다른 가구를 들고 있으면 지금처럼 "여기에는 둘 수 없어요"(cannot-move-here, H1·H2), 빨간 가구가 있으면 빨간 가구 안내(red-first, R1~R3),
//   아무것도 들지 않았을 때만 창문 안내. 메인 세션이 정한 것: 창문 앞 바닥 띠를 누르는 것도 창문을 누른 것과 같다(F4·F5에 알림 단언을 더함).
// - 3: 방에 배치 맞추기(fitLayoutToRoom)에서도 창문은 늘 뒷벽 4.8(P1~P4).

import { readFileSync } from "fs";
import { join } from "path";
import type { FloorPoint, PointerHit } from "@/lib/lobby3d/engine";
import { findFurnitureType } from "@/lib/lobby3d/furniture-catalog";
import { LobbyEditor, fitLayoutToRoom, isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, storedItems, type FurnitureItem, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, type RoomSpec, type WallSide } from "@/lib/lobby3d/room";
import { parseItemCatalog, setItemCatalog } from "@/lib/item-catalog-store";

type Side = "back" | "left" | "right";

const SERVER_ITEMS_JSON = join(__dirname, "..", "..", "..", "backend", "src", "main", "resources", "catalog", "items.json");

type RawItem = Record<string, unknown> & { id: string; draw?: Record<string, unknown> };

function rawServerItems(): RawItem[] {
  return (JSON.parse(readFileSync(SERVER_ITEMS_JSON, "utf8")) as { items: RawItem[] }).items;
}

/** 서버 목록 파일의 아이템을 GET /api/catalog 응답 아이템 모양으로(파일 칸 files는 빼고 assets는 null). 맨 위 칸은 그대로 옮긴다. */
function responseItem(raw: RawItem): Record<string, unknown> {
  const item: Record<string, unknown> = { slot: null, ...raw, assets: null };
  delete item.files;
  return item;
}

function useServerCatalog(items: Record<string, unknown>[]) {
  const parsed = parseItemCatalog({ version: "qa-093", items });
  expect(parsed).not.toBeNull();
  setItemCatalog(parsed!);
}

afterEach(() => {
  // 목록을 비워 앱에 든 값으로 돌아간다
  setItemCatalog({ version: "qa-093-empty", items: [] });
});

function layoutOf(items: FurnitureItem[]): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(items, []))) as LobbyLayout;
}

/** 처음 배치(창문 뒷벽 4.8, 게시판 뒷벽 1.8). */
const N0 = () => layoutOf(DEFAULT_LOBBY_LAYOUT.items);

function moved(base: LobbyLayout, id: string, place: Partial<FurnitureItem>): LobbyLayout {
  return layoutOf(base.items.map((item) => (item.id === id ? ({ id: item.id, type: item.type, ...place } as FurnitureItem) : item)));
}

function sortedItems(layout: LobbyLayout) {
  return [...layout.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function expectLayout(editor: LobbyEditor, expected: LobbyLayout) {
  expect(sortedItems(editor.layout)).toEqual(sortedItems(expected));
}

function windowSpot(editor: LobbyEditor) {
  return editor.layout.items.find((item) => item.id === "window")?.wall;
}

function floorHit(point: FloorPoint, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece, wall: null };
}

function wallHit(side: Side, along: number, piece: string | null = null): PointerHit {
  const mark = piece === "board" || piece === "window" ? piece : null;
  return { point: null, mark, onCharacter: false, piece, wall: { wall: side, along } };
}

/** 창문 자체를 맞힌 누르기(뒷벽 4.8). */
const WINDOW_HIT = () => wallHit("back", 4.8, "window");
/** 뒷벽 창문 앞 바닥 띠 안의 점(064-④ B1과 같다). */
const WINDOW_STRIP: FloorPoint = { x: 4.8, z: 0.5 };

/** 톡. 누를 때와 뗄 때의 알림을 돌려준다. */
function tap(editor: LobbyEditor, hit: PointerHit) {
  const down = editor.pointerDown(hit, 200, 300);
  const up = editor.pointerUp();
  return { down, up };
}

/** 아무것도 골라지지 않은 것: 고른 가구·끄는 가구·치우기·돌리기·벽 칠·바닥 칠·장소 구역이 없다. */
function expectNothingSelected(editor: LobbyEditor) {
  expect(editor.selected).toBeNull();
  expect(editor.dragging).toBeNull();
  expect(editor.storable).toBeNull();
  expect(editor.handle).toBeNull();
  expect(editor.wallMarks()).toEqual([]);
  expect(editor.marks()).toEqual([]);
  expect(editor.zone()).toBeNull();
}

// ---------- 1. 창문을 누르면 고르지 않고 안내(바뀌는 동작 1·2) ----------

describe("[spec] 093 바뀌는 동작 2: 꾸미기에서 창문을 누르면 고르지 않고 안내를 보여 준다", () => {
  test("[바뀔] F1 아무것도 고르지 않은 채 창문(뒷벽 4.8)을 톡하면 골라지지 않고 알림이 있으며, 창문은 뒷벽 4.8 그대로다", () => {
    const editor = new LobbyEditor(N0());

    const { down, up } = tap(editor, WINDOW_HIT());

    expect(down ?? up).not.toBeNull();
    expectNothingSelected(editor);
    expectLayout(editor, N0());
    expect(editor.changed).toBe(false);
  });

  test("[바뀔] F2 창문을 두 번 톡해도 두 번 다 골라지지 않고 알림이 있다", () => {
    const editor = new LobbyEditor(N0());

    const first = tap(editor, WINDOW_HIT());
    const second = tap(editor, WINDOW_HIT());

    expect(first.down ?? first.up).not.toBeNull();
    expect(second.down ?? second.up).not.toBeNull();
    expectNothingSelected(editor);
    expectLayout(editor, N0());
  });

  test.each([
    ["뒷벽 6.4", wallHit("back", 6.4)],
    ["뒷벽 2.6(게시판 쪽)", wallHit("back", 2.6)],
    ["왼벽 8.5(다른 벽)", wallHit("left", 8.5)],
    ["오른벽 8.5(다른 벽)", wallHit("right", 8.5)],
    ["바닥 (6.9, 8.6)", floorHit({ x: 6.9, z: 8.6 })]
  ])("[바뀔] F3 창문을 눌러 %s로 끌어도 끄는 동안과 뗀 뒤 모두 창문은 뒷벽 4.8 그대로이고 끌리지도 골라지지도 않는다", (_label, to) => {
    const editor = new LobbyEditor(N0());

    const down = editor.pointerDown(WINDOW_HIT(), 200, 300);
    editor.pointerMove(to, 300, 400);
    expect(windowSpot(editor)).toEqual({ wall: "back", along: 4.8 });
    expect(editor.dragging).toBeNull();
    editor.pointerMove(to, 400, 500);
    expect(windowSpot(editor)).toEqual({ wall: "back", along: 4.8 });
    const up = editor.pointerUp();

    expect(down ?? up).not.toBeNull();
    expectNothingSelected(editor);
    expectLayout(editor, N0());
  });

  // 04 메인 세션이 정한 것: 창문 앞 바닥 띠를 누르는 것도 창문을 누른 것과 같다(알림 단언을 더함)
  test("[바뀔] F4 창문 앞 바닥 띠 (4.8, 0.5)를 톡해도 창문이 골라지지 않고 알림이 있으며 배치가 그대로다", () => {
    const editor = new LobbyEditor(N0());

    const { down, up } = tap(editor, floorHit(WINDOW_STRIP));

    expect(down ?? up).not.toBeNull();
    expectNothingSelected(editor);
    expectLayout(editor, N0());
  });

  test("[바뀔] F5 창문 앞 바닥 띠 (4.8, 0.5)를 눌러 뒷벽 6.4로 끌어도 창문은 뒷벽 4.8 그대로이고 골라지지 않으며 알림이 있다", () => {
    const editor = new LobbyEditor(N0());

    const down = editor.pointerDown(floorHit(WINDOW_STRIP), 200, 300);
    editor.pointerMove(wallHit("back", 6.4), 300, 400);
    expect(windowSpot(editor)).toEqual({ wall: "back", along: 4.8 });
    const up = editor.pointerUp();

    expect(down ?? up).not.toBeNull();
    expectNothingSelected(editor);
    expectLayout(editor, N0());
  });

  test("[바뀔] F6 게시판을 골라 확정한 뒤 창문을 톡해도 창문은 골라지지 않고 알림이 있다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, wallHit("back", 1.8, "board"));
    expect(editor.selected).toBe("board");
    tap(editor, wallHit("back", 1.8, "board"));
    expect(editor.selected).toBeNull();

    const { down, up } = tap(editor, WINDOW_HIT());

    expect(down ?? up).not.toBeNull();
    expectNothingSelected(editor);
    expectLayout(editor, N0());
  });
});

// ---------- 2. 다른 가구는 그대로(그대로여야 할 동작) ----------

describe("[spec] 093 그대로여야 할 동작: 다른 가구의 고르기·옮기기와 창문 자리 겹침 검사", () => {
  // 창문을 먼저 톡하므로(지금은 창문이 골라져 게시판 톡이 창문 옮기기가 된다) 바뀔 동작에 기대는 테스트다
  test("[바뀔] K1 창문을 톡한 뒤에도 게시판(뒷벽 1.8)을 톡하면 골라지고, 뒷벽 2.6으로 끌면 뒷벽 2.5에 놓인다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, WINDOW_HIT());

    tap(editor, wallHit("back", 1.8, "board"));
    expect(editor.selected).toBe("board");
    editor.pointerDown(wallHit("back", 1.8, "board"), 200, 300);
    editor.pointerMove(wallHit("back", 2.6), 300, 400);
    expect(editor.pointerUp()).toBeNull();

    expectLayout(editor, moved(N0(), "board", { wall: { wall: "back", along: 2.5 } }));
    expect(editor.selected).toBe("board");
  });

  test("[그대로] K2 게시판을 뒷벽 4.4로 끌면 4.5는 창문(뒷벽 3.65~5.95)과 겹쳐 놓을 수 없어, 떼면 뒷벽 1.8로 돌아가고 알림이 있다", () => {
    const editor = new LobbyEditor(N0());

    editor.pointerDown(wallHit("back", 1.8, "board"), 200, 300);
    editor.pointerMove(wallHit("back", 4.4), 300, 400);
    expectLayout(editor, moved(N0(), "board", { wall: { wall: "back", along: 4.5 } }));
    expect(editor.wallMarks().map((m) => m.ok)).toEqual([false]);
    const notice = editor.pointerUp();

    expect(notice).not.toBeNull();
    expectLayout(editor, N0());
  });

  test("[그대로] K3 게시판을 고른 채 창문(뒷벽 4.8)을 톡하면 게시판을 창문 자리로 옮기지 않고(겹침) 창문은 뒷벽 4.8 그대로다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, wallHit("back", 1.8, "board"));
    expect(editor.selected).toBe("board");

    tap(editor, WINDOW_HIT());

    expectLayout(editor, N0());
  });

  // 04 결정 2: 다른 가구를 들고 있을 때 창문 자리를 누르면 지금처럼 "여기에는 둘 수 없어요"(cannot-move-here). 든 가구는 골라진 채다
  test.each([
    ["H1 창문 자체(뒷벽 4.8)", WINDOW_HIT()],
    ["H2 창문 앞 바닥 띠 (4.8, 0.5)", floorHit(WINDOW_STRIP)]
  ])("[그대로] %s를 게시판을 든 채 톡하면 누를 때는 알림이 없고 뗄 때 'cannot-move-here'이며, 게시판은 뒷벽 1.8에서 골라진 채이고 창문은 그대로다", (_label, hit) => {
    const editor = new LobbyEditor(N0());
    tap(editor, wallHit("back", 1.8, "board"));
    expect(editor.selected).toBe("board");

    const { down, up } = tap(editor, hit);

    expect({ down, up }).toEqual({ down: null, up: "cannot-move-here" });
    expect(editor.selected).toBe("board");
    expectLayout(editor, N0());
  });

  // 04 결정 2: 빨간(잘못 놓인) 가구가 있으면 지금의 빨간 가구 안내(red-first)가 먼저다
  /** 책장(0.5, 2.5, 방향 1)을 골라 한 번 돌려 빨간 가구(방향 2)로 만든다. keepSelected가 false면 책장을 다시 톡해 고르기를 푼다. */
  function redBookcase(keepSelected: boolean): LobbyEditor {
    const editor = new LobbyEditor(N0());
    tap(editor, floorHit({ x: 0.5, z: 2.5 }, "bookcase"));
    expect(editor.selected).toBe("bookcase");
    editor.rotate();
    expect(editor.red).toBe("bookcase");
    if (!keepSelected) {
      tap(editor, floorHit({ x: 0.5, z: 2.5 }, "bookcase"));
      expect(editor.selected).toBeNull();
    }
    return editor;
  }

  test.each([
    ["R1 고르기를 푼 빨간 책장이 있는 동안 창문 자체", false, WINDOW_HIT()],
    ["R2 고르기를 푼 빨간 책장이 있는 동안 창문 앞 바닥 띠 (4.8, 0.5)", false, floorHit(WINDOW_STRIP)],
    ["R3 빨간 책장을 든 채 창문 자체", true, WINDOW_HIT()]
  ])("[그대로] %s를 톡하면 누를 때 'red-first'이고, 창문은 뒷벽 4.8 그대로 골라지지 않으며 책장은 빨간 채다", (_label, keepSelected, hit) => {
    const editor = redBookcase(keepSelected);
    const before = editor.layout;

    const { down } = tap(editor, hit);

    expect(down).toBe("red-first");
    expect(editor.selected).toBe(keepSelected ? "bookcase" : null);
    expect(editor.red).toBe("bookcase");
    expectLayout(editor, before);
    expect(windowSpot(editor)).toEqual({ wall: "back", along: 4.8 });
  });

  test("[그대로] K4 액자(벽 가구, 치울 수 있음)를 창문과 겹치는 뒷벽 5.0으로 끌면 놓을 수 없어 왼벽 7.5로 돌아간다", () => {
    const start = layoutOf([...DEFAULT_LOBBY_LAYOUT.items, { id: "frame-1", type: "frame", wall: { wall: "left", along: 7.5 } }]);
    const editor = new LobbyEditor(start);

    editor.pointerDown(wallHit("left", 7.5, "frame-1"), 200, 300);
    editor.pointerMove(wallHit("back", 5.0), 300, 400);
    expect(editor.pointerUp()).not.toBeNull();

    expectLayout(editor, start);
  });

  // 064-④ 결정 11의 2(벽 가구 앞 바닥 띠, 두 띠에 모두 들면 가장 가까운 벽의 가구)를 화면 테스트 B7에서 옮겨 왔다(home-lobby-wall-edit.spec.test.tsx 참고).
  // 창문이 붙박이라 액자(뒷벽 7.0, 띠 x 6.5~7.5)와 게시판(오른벽 1.5, 띠 z 0.6~2.4)으로 뒤·오른쪽 모서리에서 두 띠를 겹친다.
  test("[그대로] K6 뒤·오른쪽 모서리에서 두 띠에 모두 들면 가장 가까운 벽의 가구: (7.3, 0.62)는 뒷벽 액자, (7.3, 0.9)는 오른벽 게시판", () => {
    const start = layoutOf(
      DEFAULT_LOBBY_LAYOUT.items
        .map((item) => (item.id === "board" ? { id: "board", type: "board", wall: { wall: "right" as const, along: 1.5 } } : item))
        .concat([{ id: "frame-1", type: "frame", wall: { wall: "back", along: 7.0 } }])
    );
    const editor = new LobbyEditor(start);

    tap(editor, floorHit({ x: 7.3, z: 0.62 }));
    expect(editor.selected).toBe("frame-1");
    tap(editor, floorHit({ x: 7.3, z: 0.62 }));
    expect(editor.selected).toBeNull();

    tap(editor, floorHit({ x: 7.3, z: 0.9 }));
    expect(editor.selected).toBe("board");
    expectLayout(editor, start);
  });

  test("[그대로] K5 창문을 톡한 뒤 '처음 배치로'를 해도 창문은 뒷벽 4.8이다", () => {
    const editor = new LobbyEditor(N0());
    tap(editor, WINDOW_HIT());

    editor.resetToDefault();

    expect(windowSpot(editor)).toEqual({ wall: "back", along: 4.8 });
  });
});

// ---------- 3. 서버 목록의 "옮길 수 없음" 값(바뀌는 동작 3) ----------

describe("[spec] 093 바뀌는 동작 3: 앱은 서버 목록의 '옮길 수 없음' 값을 보고 창문을 고르지 않는다", () => {
  test("[바뀔] M1 서버 목록 파일(items.json) 그대로의 목록(창문 draw.fixed true)을 받았을 때도 창문을 톡하면 골라지지 않고 알림이 있으며, 게시판은 골라진다", () => {
    const raw = rawServerItems();
    // 04 결정 1: 서버 목록의 창문 draw에 fixed: true가 있다(입력 준비 확인)
    expect(raw.find((item) => item.id === "window")?.draw?.fixed).toBe(true);
    useServerCatalog(raw.filter((item) => item.kind === "furniture").map(responseItem));

    const editor = new LobbyEditor(N0());
    const { down, up } = tap(editor, WINDOW_HIT());

    expect(down ?? up).not.toBeNull();
    expectNothingSelected(editor);
    tap(editor, wallHit("back", 1.8, "board"));
    expect(editor.selected).toBe("board");
  });

  // 04 결정 1로 값 이름(draw.fixed)이 정해져, 옛 M2(창문에만 있는 칸을 옮겨 붙임)를 이름으로 다시 썼다
  test("[바뀔] M2 서버 목록에서 게시판 draw에 fixed: true를 붙이면, 게시판도 톡해서 골라지지 않고 알림이 있다(앱이 이름이 아니라 값을 본다)", () => {
    const raw = rawServerItems();
    const boardRaw = raw.find((item) => item.id === "board")!;
    const fixedBoard: RawItem = { ...boardRaw, draw: { ...(boardRaw.draw ?? {}), fixed: true } };
    useServerCatalog(raw.filter((item) => item.kind === "furniture").map((item) => responseItem(item.id === "board" ? fixedBoard : item)));

    const editor = new LobbyEditor(N0());
    const { down, up } = tap(editor, wallHit("back", 1.8, "board"));

    expect(down ?? up).not.toBeNull();
    expectNothingSelected(editor);
    expectLayout(editor, N0());
  });

  test("[그대로] M3 앱에 든 창문 값은 서버 목록 파일의 창문 값과 같다(목록이 없을 때도 같은 값으로 붙박이다)", () => {
    const appWindow = findFurnitureType("window");
    expect(appWindow).toBeDefined();
    const appCopy = JSON.parse(JSON.stringify(appWindow));

    useServerCatalog(rawServerItems().filter((item) => item.id === "window").map(responseItem));
    const serverWindow = JSON.parse(JSON.stringify(findFurnitureType("window")));

    expect(appCopy).toEqual(serverWindow);
  });
});

/** 가구 종류의 fixed 값(구현 전에는 타입에 없는 칸이라 이렇게 읽는다). */
const fixedOf = (id: string) => (findFurnitureType(id) as { fixed?: unknown } | undefined)?.fixed;

describe("[spec] 093 04 결정 1: 앱에 든 창문 값", () => {
  test("[바뀔] M4 목록이 없을 때 앱의 창문은 fixed가 true이고, 게시판·액자에는 fixed가 없다", () => {
    expect(fixedOf("window")).toBe(true);
    expect(fixedOf("board")).toBeUndefined();
    expect(fixedOf("frame")).toBeUndefined();
  });
});

// ---------- 4. 방에 배치 맞추기(04 결정 3) ----------

/** 066-⑥ 시험용 방 T(9×13, 입구 가운데 x 3.0). 걸 수 있는 벽을 고른다. */
function roomT(hangWalls: WallSide[]): RoomSpec {
  return { id: "qa-093-t", width: 9, depth: 13, wallHeight: 3.6, wallThickness: 0.5, hangWalls, exits: [{ kind: "outside", x: 3.0, width: 2.0, depth: 0.7 }] };
}

/** 075 시험용 방 R(기본 방과 같고 오른벽에만 걸 수 없다). */
const ROOM_NO_RIGHT: RoomSpec = {
  id: "qa-093-no-right",
  width: 8,
  depth: 11,
  wallHeight: 3.2,
  wallThickness: 0.4,
  hangWalls: ["back", "left"],
  exits: [{ kind: "outside", x: 4, width: 2.0, depth: 0.7 }]
};

/** 처음 배치에서 id 하나만 자리를 바꾼 가구 목록. */
function replacedItems(id: string, patch: Partial<FurnitureItem>): FurnitureItem[] {
  return JSON.parse(JSON.stringify(DEFAULT_LOBBY_LAYOUT.items)).map((item: FurnitureItem) => (item.id === id ? { id: item.id, type: item.type, ...patch } : item));
}

const BACK_48 = { wall: "back", along: 4.8 };

describe("[spec] 093 04 결정 3: 방에 배치를 맞출 때(fitLayoutToRoom)도 창문은 늘 뒷벽 4.8이다", () => {
  test("[바뀔] P1 기본 방, 창문만 오른벽 6(그 자리도 놓을 수 있음)인 배치 → 창문이 뒷벽 4.8이 되고 나머지는 처음 배치 그대로, 보관함 없음", () => {
    const result = fitLayoutToRoom(makeLayout(replacedItems("window", { wall: { wall: "right", along: 6 } }), []), BASIC_ROOM);

    expect(sortedItems(result)).toEqual(sortedItems(N0()));
    expect(storedItems(result)).toEqual([]);
    expect(isPlaceableLayout(result, BASIC_ROOM)).toBe(true);
  });

  test("[바뀔] P2 기본 방, 창문이 오른벽 11.5(벽 밖)인 배치 → 창문이 뒷벽 4.8이고 나머지는 그대로(옛 기대 뒷벽 4.0이 아니다)", () => {
    const result = fitLayoutToRoom(makeLayout(replacedItems("window", { wall: { wall: "right", along: 11.5 } }), []), BASIC_ROOM);

    expect(sortedItems(result)).toEqual(sortedItems(N0()));
    expect(storedItems(result)).toEqual([]);
  });

  test("[바뀔] P3 오른벽에 걸 수 없는 방 T로, 창문 오른벽 6·액자 오른벽 11 → 창문은 뒷벽 4.8, 액자는 보관함", () => {
    const room = roomT(["back", "left"]);
    const layout = makeLayout([...replacedItems("window", { wall: { wall: "right", along: 6 } }), { id: "frame-1", type: "frame", wall: { wall: "right", along: 11 } }], []);

    const result = fitLayoutToRoom(layout, room);

    expect(sortedItems(result)).toEqual(sortedItems(N0()));
    expect(storedItems(result)).toEqual([{ id: "frame-1", type: "frame" }]);
    expect(isPlaceableLayout(result, room)).toBe(true);
  });

  test("[바뀔] P4 오른벽에 걸 수 없는 방 R로, 게시판이 오른벽 6이고 창문은 뒷벽 4.8 → 게시판은 걸 수 있는 벽으로 옮겨 가도 창문은 뒷벽 4.8 그대로이고 놓을 수 있는 배치다", () => {
    const layout = makeLayout(replacedItems("board", { wall: { wall: "right", along: 6 } }), []);

    const result = fitLayoutToRoom(layout, ROOM_NO_RIGHT);

    expect(result.items.find((item) => item.id === "window")?.wall).toEqual(BACK_48);
    const board = result.items.find((item) => item.id === "board");
    expect(board?.wall?.wall === "back" || board?.wall?.wall === "left").toBe(true);
    expect(sortedItems(result).filter((item) => item.id !== "board")).toEqual(sortedItems(N0()).filter((item) => item.id !== "board"));
    expect(storedItems(result)).toEqual([]);
    expect(isPlaceableLayout(result, ROOM_NO_RIGHT)).toBe(true);
  });
});
