// [spec] qa 재현 테스트(작업 068, 버그 수정: 모바일 로비 꾸미기에서 보관함에 넣은 가구의 3D가 남아 눌리면 오류).
// 고칠 동작 2: 편집기는 배치에 없는 가구가 눌린 결과를 받으면 오류 없이 무시한다(가구를 누르지 않은 것처럼).
// 기대값은 명세(private 작업 폴더 068-2026-11-09-모바일-로비-보관함-3D-남은-가구/01-main-spec.md)에서만 가져온다.
// "가구를 누르지 않은 것처럼"은 같은 누르기 결과에서 가구만 없는 것(piece: null)과 같은 결과로 읽는다.
// 그래서 같은 조작을 piece만 null로 바꾼 편집기와 견주고, 고른 것이 없을 때처럼 결과가 하나로 정해지는 곳은 값도 적는다.
// 구현 코드는 부르는 방법(LobbyEditor의 생성자·pointerDown/Move/Up·store·rotate·selected·red·layout·dragging)을 알려고만 읽었다.
// 고치기 전에는 pointerDown이 배치에 없는 id의 종류를 찾다가 TypeError("Cannot read properties of undefined (reading 'type')")로 실패한다.

import type { FloorPoint, PointerHit } from "@/lib/lobby3d/engine";
import { LobbyEditor } from "@/lib/lobby3d/lobby-edit";
import { makeLayout, type FurnitureItem, type LobbyLayout } from "@/lib/lobby3d/lobby-layout";

type Facing = 0 | 1 | 2 | 3;

const floor = (id: string, type: string, x: number, z: number, facing: Facing): FurnitureItem => ({ id, type, floor: { x, z, facing } });
const wall = (id: string, type: string, side: "back" | "left" | "right", along: number): FurnitureItem => ({ id, type, wall: { wall: side, along } });

/** 처음 배치와 같은 방(066 시나리오의 DEF). */
const DEF_ITEMS: FurnitureItem[] = [
  floor("desk", "desk", 1.5, 5.5, 0),
  floor("bookcase", "bookcase", 0.5, 2.5, 1),
  floor("wardrobe", "wardrobe", 7.5, 3.5, 3),
  floor("rug", "rug", 4.6, 7.2, 0),
  wall("board", "board", "back", 1.8),
  wall("window", "window", "back", 4.8)
];
const DEF: LobbyLayout = makeLayout(DEF_ITEMS, []);
/** DEF에 옷장 wardrobe2를 책장과 같은 칸에 더한 방(066 시나리오의 L-OVER). 돌리면 놓을 수 없는 자리가 된다. */
const L_OVER: LobbyLayout = makeLayout([...DEF_ITEMS, floor("wardrobe2", "wardrobe", 0.5, 2.5, 0)], []);

const AT: Record<string, FloorPoint> = {
  desk: { x: 1.5, z: 5.5 },
  wardrobe: { x: 7.5, z: 3.5 },
  rug: { x: 4.6, z: 7.2 },
  wardrobe2: { x: 0.5, z: 2.5 }
};

function hit(point: FloorPoint | null, piece: string | null): PointerHit {
  return { point, mark: null, onCharacter: false, piece };
}

/** 가구를 톡 눌러 고른다(같은 화면 자리에서 누르고 뗀다). */
function tap(editor: LobbyEditor, h: PointerHit) {
  editor.pointerDown(h, 200, 300);
  editor.pointerUp();
}

/** 고른 치울 수 있는 가구를 보관함에 넣는다. */
function selectAndStore(editor: LobbyEditor, id: string) {
  tap(editor, hit(AT[id], id));
  expect(editor.selected).toBe(id);
  editor.store();
  expect(editor.layout.items.some((item) => item.id === id)).toBe(false);
}

/** 편집기의 지금 상태(견주기용). */
function stateOf(editor: LobbyEditor) {
  return { layout: editor.layout, selected: editor.selected, red: editor.red, dragging: editor.dragging };
}

/** 같은 준비를 한 두 편집기에 한쪽은 배치에 없는 id, 다른 쪽은 가구 없음(null)으로 같은 조작을 한다. */
function pressBoth(prepare: (editor: LobbyEditor) => void, point: FloorPoint | null, ghost: string, start: LobbyLayout = DEF) {
  const withGhost = new LobbyEditor(start);
  const withNone = new LobbyEditor(start);
  prepare(withGhost);
  prepare(withNone);
  const before = stateOf(withGhost);
  let ghostDown: unknown;
  expect(() => {
    ghostDown = withGhost.pointerDown(hit(point, ghost), 200, 300);
  }).not.toThrow();
  const noneDown = withNone.pointerDown(hit(point, null), 200, 300);
  return { withGhost, withNone, before, ghostDown, noneDown };
}

describe("[spec] 068 고칠 동작 2: 배치에 없는 가구가 눌린 결과는 오류 없이 무시한다", () => {
  test("M1 옷장을 치운 뒤 그 자리(7.5, 3.5)를 누른 결과에 piece 'wardrobe'가 오면 오류 없이 알림 없음(null), 떼도 아무것도 골라지지 않고 배치는 그대로", () => {
    const editor = new LobbyEditor(DEF);
    selectAndStore(editor, "wardrobe");
    const stored = editor.layout;

    let down: unknown = "not-called";
    expect(() => {
      down = editor.pointerDown(hit(AT.wardrobe, "wardrobe"), 200, 300);
    }).not.toThrow();
    expect(down).toBeNull();
    let up: unknown = "not-called";
    expect(() => {
      up = editor.pointerUp();
    }).not.toThrow();

    expect(up).toBeNull();
    expect(editor.selected).toBeNull();
    expect(editor.red).toBeNull();
    expect(editor.layout).toEqual(stored);
  });

  test("M2 옷장을 치운 뒤 그 자리에서 piece 'wardrobe'로 누르고 끌어도 오류 없이 끌기가 시작되지 않고 배치는 그대로", () => {
    const editor = new LobbyEditor(DEF);
    selectAndStore(editor, "wardrobe");
    const stored = editor.layout;

    expect(() => {
      editor.pointerDown(hit(AT.wardrobe, "wardrobe"), 200, 300);
      editor.pointerMove(hit({ x: 4.5, z: 6.5 }, null), 300, 400);
    }).not.toThrow();
    expect(editor.dragging).toBeNull();
    let up: unknown = "not-called";
    expect(() => {
      up = editor.pointerUp();
    }).not.toThrow();

    expect(up).toBeNull();
    expect(editor.dragging).toBeNull();
    expect(editor.selected).toBeNull();
    expect(editor.layout).toEqual(stored);
  });

  test("M3 깔개(덮개)를 치운 뒤 그 자리(4.6, 7.2)를 piece 'rug'로 눌러도 오류 없이 아무것도 골라지지 않는다", () => {
    const editor = new LobbyEditor(DEF);
    selectAndStore(editor, "rug");
    const stored = editor.layout;

    let down: unknown = "not-called";
    expect(() => {
      down = editor.pointerDown(hit(AT.rug, "rug"), 200, 300);
      editor.pointerUp();
    }).not.toThrow();

    expect(down).toBeNull();
    expect(editor.selected).toBeNull();
    expect(editor.layout).toEqual(stored);
  });

  test("M4 한 번도 배치에 없던 id('ghost')가 눌린 결과도 오류 없이 무시한다(고른 것 없음, 배치 그대로)", () => {
    const editor = new LobbyEditor(DEF);

    let down: unknown = "not-called";
    expect(() => {
      down = editor.pointerDown(hit({ x: 5.5, z: 4.5 }, "ghost"), 200, 300);
      editor.pointerUp();
    }).not.toThrow();

    expect(down).toBeNull();
    expect(editor.selected).toBeNull();
    expect(editor.layout).toEqual(DEF);
  });

  test("M5 책상을 골라 둔 채 치운 옷장 자리(책상 칸 밖)를 piece 'wardrobe'로 누르면, 가구 없는 같은 누르기처럼 고르기가 풀린다", () => {
    const prepare = (editor: LobbyEditor) => {
      selectAndStore(editor, "wardrobe");
      tap(editor, hit(AT.desk, "desk"));
      expect(editor.selected).toBe("desk");
    };
    const { withGhost, withNone, ghostDown, noneDown } = pressBoth(prepare, AT.wardrobe, "wardrobe");
    expect(ghostDown).toEqual(noneDown);

    let up: unknown = "not-called";
    expect(() => {
      up = withGhost.pointerUp();
    }).not.toThrow();

    expect(up).toEqual(withNone.pointerUp());
    expect(stateOf(withGhost)).toEqual(stateOf(withNone));
    // 가구 없는 곳을 누른 것과 같으므로 고르기가 풀린다
    expect(withGhost.selected).toBeNull();
  });

  test("M6 책상을 골라 둔 채 책상 칸 안(1.5, 5.5)을 배치에 없는 id로 누르면, 가구 없는 같은 누르기와 결과가 같다", () => {
    const prepare = (editor: LobbyEditor) => {
      selectAndStore(editor, "wardrobe");
      tap(editor, hit(AT.desk, "desk"));
      expect(editor.selected).toBe("desk");
    };
    const { withGhost, withNone, ghostDown, noneDown } = pressBoth(prepare, AT.desk, "wardrobe");
    expect(ghostDown).toEqual(noneDown);

    let up: unknown = "not-called";
    expect(() => {
      up = withGhost.pointerUp();
    }).not.toThrow();

    expect(up).toEqual(withNone.pointerUp());
    expect(stateOf(withGhost)).toEqual(stateOf(withNone));
  });

  test("M7 빨간 가구(wardrobe2)가 있을 때 배치에 없는 id가 눌리면 '빨간 가구부터' 알림 없이(가구 없는 같은 누르기처럼) 무시한다", () => {
    const prepare = (editor: LobbyEditor) => {
      tap(editor, hit(AT.wardrobe2, "wardrobe2"));
      expect(editor.selected).toBe("wardrobe2");
      editor.rotate();
      // 돌린 뒤 책장과 겹쳐 빨간 가구가 된다(시작 조건)
      expect(editor.red).toBe("wardrobe2");
    };
    const { withGhost, withNone, ghostDown, noneDown } = pressBoth(prepare, { x: 5.5, z: 4.5 }, "ghost", L_OVER);

    expect(ghostDown).toEqual(noneDown);
    expect(ghostDown).toBeNull();
    let up: unknown = "not-called";
    expect(() => {
      up = withGhost.pointerUp();
    }).not.toThrow();
    expect(up).toEqual(withNone.pointerUp());
    expect(stateOf(withGhost)).toEqual(stateOf(withNone));
    expect(withGhost.red).toBe("wardrobe2");
  });

  test("M8 무시한 뒤에도 편집기는 계속 쓸 수 있다: 남은 옷장 자리를 누른 다음 책상을 누르면 책상이 골라진다", () => {
    const editor = new LobbyEditor(DEF);
    selectAndStore(editor, "wardrobe");

    expect(() => tap(editor, hit(AT.wardrobe, "wardrobe"))).not.toThrow();
    tap(editor, hit(AT.desk, "desk"));

    expect(editor.selected).toBe("desk");
  });
});
