// [spec] qa 테스트(작업 064-④ 편집 모드: 벽 가구, 모바일): 벽 가구를 놓을 수 있는 배치인지, 옆벽 벽 가구에 딸린 장소, 옆벽 창문의 바닥 창문 빛.
// 기대값은 시나리오(private 작업 폴더 064/05-벽-가구-편집/02-qa-scenarios.md의 P1~P30, F1·F2, W1~W7)와 결정(같은 폴더 03-main-decision.md)에서만 가져온다.
// 구현 코드는 부르는 방법(isPlaceableLayout, layoutGeometry, windowLightPanes의 다섯째 인자 wall, daylightAt)을 알려고만 읽었다.
// 064-④ 결정 11의 1(책상도 게시판·창문 바로 아래 칸에 놓을 수 없음, 깔개만 됨)에 맞춰 P20을 고치고(창문 왼벽 5.0이 책상 칸 0,5 위),
// 같은 벽 겹치지 않음은 P20b·P20c(오른벽)로 옮겼으며, 책상·깔개와 벽 가구 아래를 N1~N7로 더했다.
// W1·W2의 숫자는 시나리오 가정 A6(옆벽 창도 뒷벽 창과 크기·높이 2.05·벽에서 0.05가 같다)에서 나온다. 창 안쪽 크기는 WINDOW_OPENING이다.
import { daylightAt, windowLightPanes, type SunPosition, type WindowLightPane } from "@/lib/lobby3d/daylight";
import { ROOM } from "@/lib/lobby3d/engine";
import { WINDOW_OPENING } from "@/lib/lobby3d/furniture-layout";
import { isPlaceableLayout } from "@/lib/lobby3d/lobby-edit";
import {
  DEFAULT_LOBBY_LAYOUT,
  layoutGeometry,
  type Facing,
  type FloorPieceId,
  type LobbyLayout,
  type WallPieceId,
  type WallSide
} from "@/lib/lobby3d/lobby-layout";

// ---------- 배치 ----------

type WallSpec = { wall: WallSide; along: number };
type FloorSpec = { x: number; z: number; facing: Facing };

/** P0(처음 배치)에서 적은 것만 바꾼 배치. */
function layoutOf(wall: Partial<Record<WallPieceId, WallSpec>>, floor: Partial<Record<FloorPieceId, FloorSpec>> = {}): LobbyLayout {
  return {
    floor: { ...DEFAULT_LOBBY_LAYOUT.floor, ...floor },
    wall: { ...DEFAULT_LOBBY_LAYOUT.wall, ...wall }
  };
}

const back = (along: number): WallSpec => ({ wall: "back", along });
const left = (along: number): WallSpec => ({ wall: "left", along });
const right = (along: number): WallSpec => ({ wall: "right", along });

// ---------- P. 놓을 수 없는 자리(명세 5~8) ----------

describe("[spec] 064-④ P: 벽 가구를 놓을 수 있는 배치인지(명세 5~8)", () => {
  const cases: [string, LobbyLayout, boolean][] = [
    ["P1 게시판 뒷벽 1.0(왼끝 간격 0.1)", layoutOf({ board: back(1.0) }), false],
    ["P2 게시판 뒷벽 1.1(간격 0.2, 경계)", layoutOf({ board: back(1.1) }), true],
    ["P3 게시판 뒷벽 1.5", layoutOf({ board: back(1.5) }), true],
    ["P4 게시판 뒷벽 6.5, 창문 오른벽 7.5", layoutOf({ board: back(6.5), window: right(7.5) }), true],
    ["P5 게시판 뒷벽 6.9(오른끝 7.8, 간격 0.2, 경계), 창문 오른벽 7.5", layoutOf({ board: back(6.9), window: right(7.5) }), true],
    ["P6 게시판 뒷벽 7.0, 창문 오른벽 7.5", layoutOf({ board: back(7.0), window: right(7.5) }), false],
    ["P7 창문 뒷벽 1.0(왼끝 −0.15), 게시판 왼벽 7.5", layoutOf({ window: back(1.0), board: left(7.5) }), false],
    ["P8 창문 뒷벽 1.5(간격 0.35), 게시판 왼벽 7.5", layoutOf({ window: back(1.5), board: left(7.5) }), true],
    ["P9 창문 뒷벽 6.5, 게시판 왼벽 7.5", layoutOf({ window: back(6.5), board: left(7.5) }), true],
    ["P10 창문 뒷벽 7.0(오른끝 8.15), 게시판 왼벽 7.5", layoutOf({ window: back(7.0), board: left(7.5) }), false],
    ["P11 게시판 오른벽 1.0(모서리 간격 0.1)", layoutOf({ board: right(1.0) }), false],
    ["P12 게시판 오른벽 1.5", layoutOf({ board: right(1.5) }), true],
    ["P13 게시판 왼벽 9.5(앞끝 10.4)", layoutOf({ board: left(9.5) }), true],
    ["P14 게시판 왼벽 10.0(앞끝 10.9, 간격 0.1)", layoutOf({ board: left(10.0) }), false],
    ["P15 창문 오른벽 9.5(앞끝 10.65)", layoutOf({ window: right(9.5) }), true],
    ["P16 창문 오른벽 10.0(앞끝 11.15)", layoutOf({ window: right(10.0) }), false],
    ["P17 창문 뒷벽 3.5(게시판 1.8과 겹침)", layoutOf({ window: back(3.5) }), false],
    ["P18 창문 뒷벽 4.0", layoutOf({ window: back(4.0) }), true],
    ["P19 게시판 왼벽 7.5, 창문 왼벽 9.5(겹침)", layoutOf({ board: left(7.5), window: left(9.5) }), false],
    ["P20(결정 11) 게시판 왼벽 7.5, 창문 왼벽 5.0(창문이 책상 칸 0,5 바로 위)", layoutOf({ board: left(7.5), window: left(5.0) }), false],
    ["P20b 게시판 오른벽 9.5, 창문 오른벽 6.5(같은 벽, 겹치지 않음)", layoutOf({ board: right(9.5), window: right(6.5) }), true],
    ["P20c 게시판 오른벽 9.5, 창문 오른벽 7.5(같은 벽, 겹침)", layoutOf({ board: right(9.5), window: right(7.5) }), false],
    ["P21 게시판 왼벽 7.5, 창문 오른벽 7.5(다른 벽)", layoutOf({ board: left(7.5), window: right(7.5) }), true],
    ["P22 게시판 뒷벽 6.5, 창문 오른벽 1.5(다른 벽, 같은 모서리)", layoutOf({ board: back(6.5), window: right(1.5) }), true],
    ["P23 게시판 왼벽 2.5(책장 칸 0,2 바로 위)", layoutOf({ board: left(2.5) }), false],
    ["P24 창문 오른벽 3.5(옷장 칸 7,3 바로 위)", layoutOf({ window: right(3.5) }), false],
    ["P25 게시판 왼벽 2.5, 책장 (2.5, 2.5, 1)(벽에 안 붙음)", layoutOf({ board: left(2.5) }, { bookcase: { x: 2.5, z: 2.5, facing: 1 } }), true],
    ["P26 게시판 왼벽 7.5, 책장 (0.5, 7.5, 1)", layoutOf({ board: left(7.5) }, { bookcase: { x: 0.5, z: 7.5, facing: 1 } }), false],
    ["P27 게시판 왼벽 5.5(서는 자리 둘 다 책상 칸)", layoutOf({ board: left(5.5) }), false],
    ["P28 창문 왼벽 5.5(서는 자리 둘 다 책상 칸)", layoutOf({ window: left(5.5) }), false],
    ["P29 게시판 왼벽 7.5, 옷장 (1.5, 7.5, 3)(서는 자리 막힘)", layoutOf({ board: left(7.5) }, { wardrobe: { x: 1.5, z: 7.5, facing: 3 } }), false],
    ["N1(결정 11) 책상 (4.5, 0.5, 0): 창문 바로 아래 칸 3~5,0", layoutOf({}, { desk: { x: 4.5, z: 0.5, facing: 0 } }), false],
    ["N2(결정 11) 책상 (6.5, 0.5, 0): 칸 5,0이 창문 바로 아래", layoutOf({}, { desk: { x: 6.5, z: 0.5, facing: 0 } }), false],
    ["N3 책상 (6.5, 0.5, 0), 창문 왼벽 8.5: 벽 가구 아래가 아님", layoutOf({ window: left(8.5) }, { desk: { x: 6.5, z: 0.5, facing: 0 } }), true],
    ["N4(결정 11) 창문 왼벽 5.0: 책상 칸 0,5 바로 위", layoutOf({ window: left(5.0) }), false],
    ["N5(결정 11) 게시판 왼벽 5.0: 책상 칸 0,5 바로 위", layoutOf({ board: left(5.0) }), false],
    ["N6 깔개 (4.6, 1.0, 0): 창문 아래라도 깔개는 됨", layoutOf({}, { rug: { x: 4.6, z: 1.0, facing: 0 } }), true],
    ["N7 깔개 (1.0, 1.0, 0): 게시판 아래라도 깔개는 됨", layoutOf({}, { rug: { x: 1.0, z: 1.0, facing: 0 } }), true],
    ["P30 P0", layoutOf({}), true],
    ["P30 게시판만 왼벽 7.5", layoutOf({ board: left(7.5) }), true],
    ["P30 창문만 오른벽 8.5", layoutOf({ window: right(8.5) }), true],
    ["P30 창문만 뒷벽 5.5", layoutOf({ window: back(5.5) }), true]
  ];

  test.each(cases)("%s → 놓을 수 있음 %s", (_label, layout, expected) => {
    expect(isPlaceableLayout(layout)).toBe(expected);
  });
});

// ---------- F. 따라가는 것(명세 9) ----------

function r4(v: number): number {
  const n = Math.round(v * 1e4) / 1e4;
  return n === 0 ? 0 : n;
}

function placeOf(layout: LobbyLayout, id: "board" | "window") {
  const g = layoutGeometry(layout, ROOM.width);
  const p = g.places[id];
  const piece = g.pieces.find((q) => q.piece === id)!;
  return {
    approach: p.approach.map((a) => [r4(a.x), r4(a.z)]),
    faceTo: [r4(p.faceTo.x), r4(p.faceTo.z)],
    label: [r4(p.label.x), r4(p.label.y), r4(p.label.z)],
    piece: [r4(piece.x), r4(piece.y), r4(piece.z), r4(piece.rotY)]
  };
}

describe("[spec] 064-④ F: 옆벽 벽 가구에 딸린 장소·이름표·3D 자리(명세 9)", () => {
  test("F1 게시판 왼벽 7.5: 서는 자리 (1.3, 7.7)·(1.3, 7.1), 바라볼 지점 (0, 7.5), 이름표 (0.3, 2.75, 7.5), 3D (0.06, 1.75, 7.5) rotY π/2", () => {
    expect(placeOf(layoutOf({ board: left(7.5) }), "board")).toEqual({
      approach: [
        [1.3, 7.7],
        [1.3, 7.1]
      ],
      faceTo: [0, 7.5],
      label: [0.3, 2.75, 7.5],
      piece: [0.06, 1.75, 7.5, r4(Math.PI / 2)]
    });
  });

  test("F2 창문 오른벽 8.5: 서는 자리 (6.45, 8.2)·(6.45, 8.8), 바라볼 지점 (8, 8.5), 이름표 (7.7, 3.05, 8.5), 3D (7.83, 2.05, 8.5) rotY −π/2", () => {
    expect(placeOf(layoutOf({ window: right(8.5) }), "window")).toEqual({
      approach: [
        [6.45, 8.2],
        [6.45, 8.8]
      ],
      faceTo: [8, 8.5],
      label: [7.7, 3.05, 8.5],
      piece: [7.83, 2.05, 8.5, r4(-Math.PI / 2)]
    });
  });
});

// ---------- W. 창문 빛(명세 10) ----------

/** 창 가운데 높이 2.05, 벽을 따라간 자리 along에 건 창의 바닥 창문 빛. wall을 주지 않으면 기존 호출(뒷벽)이다. */
function lightOf(sun: SunPosition, along: number, wall?: WallSide): WindowLightPane[] {
  const opening = { ...WINDOW_OPENING, x: along, y: 2.05 };
  return wall === undefined ? windowLightPanes(sun, opening, ROOM.width, ROOM.depth) : windowLightPanes(sun, opening, ROOM.width, ROOM.depth, wall);
}

/** 칸마다 꼭짓점 범위(직사각형이면 그 사각형). 칸 순서를 보지 않게 정렬한다. */
function rects(panes: WindowLightPane[]): number[][] {
  return panes
    .map((p) => {
      const xs = p.points.map((q) => q.x);
      const zs = p.points.map((q) => q.z);
      return [r4(Math.min(...xs)), r4(Math.max(...xs)), r4(Math.min(...zs)), r4(Math.max(...zs))];
    })
    .sort((a, b) => a[0] - b[0] || a[2] - b[2]);
}

/** 칸마다 꼭짓점 모음(소수 넷째 자리, 정렬). 칸 순서·꼭짓점 순서를 보지 않는다. */
function pointSets(panes: { points: { x: number; z: number }[] }[]): string[] {
  return panes
    .map((p) =>
      p.points
        .map((q) => `${r4(q.x)},${r4(q.z)}`)
        .sort()
        .join(" ")
    )
    .sort();
}

/** 모든 칸이 직사각형인지(꼭짓점 넷, 각 꼭짓점이 범위의 모서리). */
function allRectangles(panes: WindowLightPane[]): boolean {
  return panes.every((p) => {
    if (p.points.length !== 4) return false;
    const xs = p.points.map((q) => r4(q.x));
    const zs = p.points.map((q) => r4(q.z));
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    return p.points.every((q) => (r4(q.x) === x0 || r4(q.x) === x1) && (r4(q.z) === z0 || r4(q.z) === z1));
  });
}

function meanZ(panes: WindowLightPane[]): number {
  const zs = panes.flatMap((p) => p.points.map((q) => q.z));
  return zs.reduce((a, b) => a + b, 0) / zs.length;
}

describe("[spec] 064-④ W: 옆벽 창문의 바닥 창문 빛(명세 10: 실제 해 방향, 뒷벽 남·왼벽 동·오른벽 서)", () => {
  test("W1 왼벽 5.5, 해 {60, 90}: 네 칸 직사각형, x 0.7544~1.2105·1.2567~1.7128, z 4.565~5.46·5.54~6.435", () => {
    const panes = lightOf({ elevation: 60, azimuth: 90 }, 5.5, "left");
    expect(panes).toHaveLength(4);
    expect(allRectangles(panes)).toBe(true);
    expect(rects(panes)).toEqual([
      [0.7544, 1.2105, 4.565, 5.46],
      [0.7544, 1.2105, 5.54, 6.435],
      [1.2567, 1.7128, 4.565, 5.46],
      [1.2567, 1.7128, 5.54, 6.435]
    ]);
  });

  test("W2 오른벽 5.5, 해 {60, 270}: 네 칸 직사각형, x 6.7895~7.2456·6.2872~6.7433, z 4.565~5.46·5.54~6.435", () => {
    const panes = lightOf({ elevation: 60, azimuth: 270 }, 5.5, "right");
    expect(panes).toHaveLength(4);
    expect(allRectangles(panes)).toBe(true);
    expect(rects(panes)).toEqual([
      [6.2872, 6.7433, 4.565, 5.46],
      [6.2872, 6.7433, 5.54, 6.435],
      [6.7895, 7.2456, 4.565, 5.46],
      [6.7895, 7.2456, 5.54, 6.435]
    ]);
  });

  test("W3(가) 왼벽 5.5, 해 {45, 135}는 뒷벽 4.0, 해 {45, 225}의 빛을 (x, z) → (z, 5.5 − (x − 4.0))로 옮긴 것과 같고, 창 가운데보다 앞(+z)에 비친다", () => {
    const side = lightOf({ elevation: 45, azimuth: 135 }, 5.5, "left");
    const backLight = lightOf({ elevation: 45, azimuth: 225 }, 4.0);
    expect(side).toHaveLength(4);
    expect(backLight).toHaveLength(4);
    const moved = backLight.map((p) => ({ points: p.points.map((q) => ({ x: q.z, z: 5.5 - (q.x - 4.0) })) }));
    expect(pointSets(side)).toEqual(pointSets(moved));
    expect(meanZ(side)).toBeGreaterThan(5.5);
  });

  test("W3(나) 오른벽 5.5, 해 {45, 250}은 뒷벽 4.0, 해 {45, 160}의 빛을 (x, z) → (8 − z, 5.5 + (x − 4.0))로 옮긴 것과 같고, 창 가운데보다 앞(+z)에 비친다", () => {
    const side = lightOf({ elevation: 45, azimuth: 250 }, 5.5, "right");
    const backLight = lightOf({ elevation: 45, azimuth: 160 }, 4.0);
    expect(side).toHaveLength(4);
    expect(backLight).toHaveLength(4);
    const moved = backLight.map((p) => ({ points: p.points.map((q) => ({ x: 8 - q.z, z: 5.5 + (q.x - 4.0) })) }));
    expect(pointSets(side)).toEqual(pointSets(moved));
    expect(meanZ(side)).toBeGreaterThan(5.5);
  });

  test.each([
    ["왼벽, 해 {30, 270}(서)", "left" as WallSide, { elevation: 30, azimuth: 270 }],
    ["왼벽, 해 {30, 200}(남남서)", "left" as WallSide, { elevation: 30, azimuth: 200 }],
    ["왼벽, 해 {−5, 90}(짐)", "left" as WallSide, { elevation: -5, azimuth: 90 }],
    ["오른벽, 해 {30, 90}(동)", "right" as WallSide, { elevation: 30, azimuth: 90 }],
    ["오른벽, 해 {30, 160}(남남동)", "right" as WallSide, { elevation: 30, azimuth: 160 }],
    ["오른벽, 해 {−5, 270}(짐)", "right" as WallSide, { elevation: -5, azimuth: 270 }]
  ])("W4 %s 창문 5.5: 빛이 없다", (_label, wall, sun) => {
    expect(lightOf(sun, 5.5, wall)).toEqual([]);
  });

  test.each([
    ["왼벽, 해 {40, 45}(북동)", "left" as WallSide, { elevation: 40, azimuth: 45 }],
    ["오른벽, 해 {40, 300}(북서)", "right" as WallSide, { elevation: 40, azimuth: 300 }]
  ])("W5 %s 창문 5.5: 빛이 있고, 창 가운데보다 뒤(−z)에 비친다", (_label, wall, sun) => {
    const panes = lightOf(sun, 5.5, wall);
    expect(panes.length).toBeGreaterThanOrEqual(1);
    expect(meanZ(panes)).toBeLessThan(5.5);
  });

  test("W6 2026-03-20 09:00에는 왼벽 창만, 16:00에는 오른벽 창만 빛이 든다(창문 5.5)", () => {
    const morning = daylightAt(new Date(2026, 2, 20, 9, 0)).sun;
    const afternoon = daylightAt(new Date(2026, 2, 20, 16, 0)).sun;
    expect({
      morningLeft: lightOf(morning, 5.5, "left").length > 0,
      morningRight: lightOf(morning, 5.5, "right").length > 0,
      afternoonLeft: lightOf(afternoon, 5.5, "left").length > 0,
      afternoonRight: lightOf(afternoon, 5.5, "right").length > 0
    }).toEqual({ morningLeft: true, morningRight: false, afternoonLeft: false, afternoonRight: true });
  });

  test("W7 뒷벽 4.0, 해 {60, 180}은 지금(87b44c0) 값 그대로: x 3.065~3.96·4.04~4.935, z 0.7544~1.2105·1.2567~1.7128(벽을 주지 않아도, back을 주어도 같다)", () => {
    const expected = [
      [3.065, 3.96, 0.7544, 1.2105],
      [3.065, 3.96, 1.2567, 1.7128],
      [4.04, 4.935, 0.7544, 1.2105],
      [4.04, 4.935, 1.2567, 1.7128]
    ];
    expect(rects(lightOf({ elevation: 60, azimuth: 180 }, 4.0))).toEqual(expected);
    expect(rects(lightOf({ elevation: 60, azimuth: 180 }, 4.0, "back"))).toEqual(expected);
  });
});
