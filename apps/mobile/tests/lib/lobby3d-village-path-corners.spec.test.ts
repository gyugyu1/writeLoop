/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 103 마을 흩뿌림·흙길, 기능 변경, 모바일): 꺾이는 곳의 둥근 반지름(명세 "바뀌는 동작" 3: 바깥 모서리 약 1.0칸, 안쪽 모서리 약 0.7칸. 지금 0.8·0.5).
// 기대값은 명세(private 작업 폴더 103-2026-11-18-마을-흩뿌림-흙길/01-main-spec.md)에서만 가져온다.
// 어떻게 보나(02-qa-tests.md "관찰하는 방법"):
// - 곧은 가장자리 굽이(±0.1칸)가 모서리 자리를 흔들어, 굽이를 넣은 모양으로는 0.8과 1.0을 가를 수 없다. 그래서 village-paths의 buildPathOutlines를
//   굽이만 0으로 주고(반지름은 기본값 그대로) 부른다. 반지름 r로 깎은 바깥 모서리는 모서리 점에서 길 쪽 대각선으로 r(√2−1)만큼 가야 길 안이 되고,
//   채운 안쪽 모서리는 빈 쪽 대각선으로 r(√2−1)까지 길이다. "약"은 ±0.1칸으로 본다: 바깥 0.9~1.1칸 → 0.373~0.456칸, 안쪽 0.6~0.8칸 → 0.249~0.331칸.
//   (지금 0.8·0.5는 0.331·0.207로 범위 밖이다. 대각선은 0.005칸씩 걸어 잰다.)
// - 그리기와 다른 쓰임(둥근 길 경계 roundedPathShapes, 땅 무늬 자리)이 같은 반지름을 쓰는지는, roundedPathShapes가 buildPathOutlines의 기본값 결과와 같은지로 본다.
//   (그리기도 지금처럼 buildPathOutlines를 기본값으로 부른다고 가정한다. 099 P3이 그린 판과 roundedPathShapes를 견준다.)
// 바뀔 동작(구현 전 실패: 반지름이 0.8·0.5): E1. 그대로 둘 동작(구현 전·뒤 통과): E2.
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { cornersOf, firstAlongDiagonal, tilesOf, type PathShape, type Rect, type RoundedPathShapes } from "../__fixtures__/village-paths-099";

type Outline = { outer: readonly (readonly [number, number])[]; holes: readonly (readonly (readonly [number, number])[])[] };
type PathsModule = { buildPathOutlines: (rects: readonly Rect[], options?: { wobble?: number }) => Outline[]; roundedPathShapes: RoundedPathShapes };

function load(): PathsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/lobby3d/village-paths") as PathsModule;
}

const toShapes = (outlines: Outline[]): PathShape[] =>
  outlines.map((o) => ({ outer: o.outer.map(([x, z]) => ({ x, z })), holes: o.holes.map((h) => h.map(([x, z]) => ({ x, z }))) }));

/** 모든 모서리의 양옆 변이 2칸 이상인 모양들(반지름이 변 길이의 절반에 걸리지 않는다). 099 테스트의 곧은 길·T·L·고리와 같다. */
const SHAPES: [string, Rect[]][] = [
  ["곧은 길", [[0, 0, 12, 2]]],
  [
    "T자 길",
    [
      [0, 0, 12, 2],
      [5, 2, 7, 8]
    ]
  ],
  [
    "L자 길",
    [
      [0, 0, 10, 2],
      [8, 0, 10, 10]
    ]
  ],
  [
    "고리",
    [
      [0, 0, 10, 2],
      [0, 8, 10, 10],
      [0, 2, 2, 8],
      [8, 2, 10, 8]
    ]
  ]
];

const OUTER = { lo: 0.373, hi: 0.456 };
const INNER = { lo: 0.249, hi: 0.331 };

describe("[spec] 103 바뀔 동작: 부드러운 길 모서리(명세 3)", () => {
  it.each(SHAPES)("E1 %s: 굽이 없이 지은 경계에서 바깥 모서리는 반지름 약 1.0칸(대각선 0.373~0.456칸에서 길 안), 안쪽 모서리는 약 0.7칸(빈 쪽 대각선 0.249~0.331칸에서 길 밖)이다", (_name, rects) => {
    const shapes = toShapes(load().buildPathOutlines(rects, { wobble: 0 }));
    const { convex, concave } = cornersOf(tilesOf(rects));
    expect(convex.length).toBeGreaterThan(0);
    const outer = convex.map((c) => ({ corner: [c.x, c.z], s: firstAlongDiagonal(shapes, c, true) }));
    expect(outer.filter((o) => o.s === null || o.s < OUTER.lo || o.s > OUTER.hi)).toEqual([]);
    const inner = concave.map((c) => ({ corner: [c.x, c.z], s: firstAlongDiagonal(shapes, c, false) }));
    expect(inner.filter((o) => o.s === null || o.s < INNER.lo || o.s > INNER.hi)).toEqual([]);
  });

});

describe("[spec] 103 그대로 둘 동작: 둥근 길 경계와 그리기가 같은 반지름", () => {
  it("E2 둥근 길 경계(roundedPathShapes)는 buildPathOutlines의 기본값 결과와 같다(같은 반지름을 쓴다): 배치 파일의 길과 T자 길", () => {
    const mod = load();
    const layout = LAYOUT.paths as unknown as Rect[];
    for (const rects of [layout, SHAPES[1][1]]) expect(mod.roundedPathShapes(rects)).toEqual(toShapes(mod.buildPathOutlines(rects)));
  });
});
