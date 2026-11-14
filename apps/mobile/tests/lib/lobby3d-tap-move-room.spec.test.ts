// [spec] qa 테스트(작업 075 꾸미기: 들린 가구를 탭으로 옮기기, 결정 15로 더함, 모바일): 걸 수 있는 벽이 일부인 시험용 방에서
// 골라진 벽 가구를 탭으로 옮길 때 "바닥을 탭하면 가장 가까운 걸 수 있는 벽의 그 자리(반 칸 맞춤)", "걸 수 없는 벽을 직접 탭하면 옮기지 않고 안내"인지 본다.
// 기대값은 명세(private 작업 폴더 075-2026-11-11-꾸미기-탭으로-옮기기-보관함-줄-넓히기/01-main-spec.md "바뀌는 동작" 1의 벽 가구 줄과 "걸 수 없는 벽")와
// 결정(같은 폴더 03-main-decision.md 답 3: 반 칸 맞춤, 15-main-decision.md: 시험용 방 테스트를 더함)에서만 가져온다.
// 이미 구현된 동작(7eeacf1)을 지키는 테스트라 테스트 커밋 시점에 통과가 맞다(결정 15).
// 시험용 방 R: 기본 방과 같은 크기·입구(8×11, 입구 가운데 x 4)이고 오른벽에만 걸 수 없다(hangWalls: 뒷벽·왼벽). 처음 배치를 그대로 놓을 수 있다.
// 지금 방을 바꾸는 방법(engine의 applyRoom, 바꾼 뒤 applyLobbyLayout)은 기존 시험용 방 테스트(lobby3d-room-test-room.spec.test.ts)를 따랐다.
// 테스트마다 끝나면 기본 방과 처음 배치로 되돌린다. 알림은 pointerUp의 반환값이 null이 아닌지만 본다(02 보고의 가정과 같다).
// 093(창문 붙박이, private 작업 폴더 093-2026-11-14-창문-붙박이/01-main-spec.md "고칠 기존 테스트", 보고 03-qa-tests.md): 창문을 고를 수 없게 되어
// 창문을 골라 옮기던 W1·W3을 같은 벽 가구 동작의 액자(폭 1, 처음 배치에 왼벽 9.0으로 더함)로 바꿨다(이름에 [093 액자로]).
// 게시판은 뒷벽 6.5에 놓으면 창문과 겹쳐 W1의 뜻(뒷벽으로 옮겨 감)을 볼 수 없어 액자를 쓴다. 확인하는 동작은 그대로다.

import { applyLobbyLayout, applyRoom, type FloorPoint, type PointerHit } from "@/lib/lobby3d/engine";
import { LobbyEditor } from "@/lib/lobby3d/lobby-edit";
import { DEFAULT_LOBBY_LAYOUT, makeLayout, type FurnitureItem, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";
import { BASIC_ROOM, type RoomSpec } from "@/lib/lobby3d/room";

type Side = "back" | "left" | "right";

/** 시험용 방 R: 기본 방과 같고 오른벽에만 걸 수 없다. */
const ROOM_NO_RIGHT: RoomSpec = {
  id: "qa-075-no-right",
  width: 8,
  depth: 11,
  wallHeight: 3.2,
  wallThickness: 0.4,
  hangWalls: ["back", "left"],
  exits: [{ kind: "outside", x: 4, width: 2.0, depth: 0.7 }]
};

beforeEach(() => {
  applyRoom(ROOM_NO_RIGHT);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

afterEach(() => {
  applyRoom(BASIC_ROOM);
  applyLobbyLayout(DEFAULT_LOBBY_LAYOUT);
});

function layoutOf(items: FurnitureItem[]): LobbyLayout {
  return JSON.parse(JSON.stringify(makeLayout(items, []))) as LobbyLayout;
}

const N0 = () => layoutOf(DEFAULT_LOBBY_LAYOUT.items);
/** 093: 처음 배치에 액자(frame-1)를 왼벽 9.0(8.5~9.5)에 더한 배치. */
const N0F = () => layoutOf([...DEFAULT_LOBBY_LAYOUT.items, { id: "frame-1", type: "frame", wall: { wall: "left", along: 9.0 } }]);

function moved(base: LobbyLayout, id: string, place: Partial<FurnitureItem>): LobbyLayout {
  return layoutOf(base.items.map((item) => (item.id === id ? ({ id: item.id, type: item.type, ...place } as FurnitureItem) : item)));
}

function sortedItems(layout: LobbyLayout) {
  return [...layout.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function expectLayout(editor: LobbyEditor, expected: LobbyLayout) {
  expect(sortedItems(editor.layout)).toEqual(sortedItems(expected));
}

function floorHit(point: FloorPoint, piece: string | null = null): PointerHit {
  return { point, mark: null, onCharacter: false, piece, wall: null };
}

function wallHit(side: Side, along: number, piece: string | null = null): PointerHit {
  const mark = piece === "board" || piece === "window" ? piece : null;
  return { point: null, mark, onCharacter: false, piece, wall: { wall: side, along } };
}

function tap(editor: LobbyEditor, hit: PointerHit) {
  editor.pointerDown(hit, 200, 300);
  return editor.pointerUp();
}

function select(editor: LobbyEditor, hit: PointerHit, id: string) {
  expect(editor.selected).toBeNull();
  expect(tap(editor, hit)).toBeNull();
  expect(editor.selected).toBe(id);
}

describe("[spec] 075 결정 15: 걸 수 있는 벽이 일부인 방에서 벽 가구를 탭으로 옮긴다", () => {
  test("W1 [093 액자로] 오른벽이 가장 가까운 바닥 (6.6, 2.0)을 탭하면(오른벽 1.4, 뒷벽 2.0, 왼벽 6.6) 걸 수 있는 벽 가운데 가장 가까운 뒷벽의 6.5(반 칸 맞춤)로 액자가 옮겨 가고 골라진 채이며 알림이 없다", () => {
    const editor = new LobbyEditor(N0F());
    select(editor, wallHit("left", 9.0, "frame-1"), "frame-1");

    const notice = tap(editor, floorHit({ x: 6.6, z: 2.0 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0F(), "frame-1", { wall: { wall: "back", along: 6.5 } }));
    expect(editor.selected).toBe("frame-1");
  });

  test("W2 오른벽이 가장 가까운 바닥 (6.6, 9.1)을 탭하면(오른벽 1.4, 왼벽 6.6, 뒷벽 9.1) 걸 수 있는 벽 가운데 가장 가까운 왼벽의 9.0(반 칸 맞춤)으로 게시판이 옮겨 가고 골라진 채이며 알림이 없다", () => {
    const editor = new LobbyEditor(N0());
    select(editor, wallHit("back", 1.8, "board"), "board");

    const notice = tap(editor, floorHit({ x: 6.6, z: 9.1 }));

    expect(notice).toBeNull();
    expectLayout(editor, moved(N0(), "board", { wall: { wall: "left", along: 9.0 } }));
    expect(editor.selected).toBe("board");
  });

  test.each([
    { label: "W3 [093 액자로] 액자(왼벽 9.0)", id: "frame-1", side: "left", along: 9.0, rightAlong: 6.0, base: N0F },
    { label: "W4 게시판(뒷벽 1.8)", id: "board", side: "back", along: 1.8, rightAlong: 8.0, base: N0 }
  ] as const)("$label을 고른 채 걸 수 없는 오른벽 $rightAlong을 직접 탭하면 옮기지 않고 알림이 있으며, 원래 자리에서 골라진 채다", ({ id, side, along, rightAlong, base }) => {
    const editor = new LobbyEditor(base());
    select(editor, wallHit(side, along, id), id);

    const notice = tap(editor, wallHit("right", rightAlong));

    expect(notice).not.toBeNull();
    expectLayout(editor, base());
    expect(editor.selected).toBe(id);
  });
});
