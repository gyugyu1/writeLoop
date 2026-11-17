/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 099 마을 길 둥글게, 기능 변경, 모바일): 길 칸을 합친 모양의 둥근 경계를 계산하는 함수(명세 바뀌는 동작 1).
// 기대값은 명세(private 작업 폴더 099-2026-11-17-마을-길-둥글게/01-main-spec.md, 모서리 반지름은 103-2026-11-18-마을-흩뿌림-흙길/01-main-spec.md)에서만 가져온다.
// 모두 바뀔 동작이다(구현 전 실패: 함수가 아직 없다).
// 함수의 부르는 방법은 명세에 없어 qa가 정했다(tests/__fixtures__/village-paths-099.ts 머리말, 02-qa-tests.md "부르는 방법"):
//   import { roundedPathShapes } from "@/lib/lobby3d/village-paths";  roundedPathShapes(rects) → { outer, holes }[]
//
// 작업 103(마을 흩뿌림·흙길) 명세의 "그 때문에 고칠 기존 테스트"(사용자 2026-11-18 "진행해")로 qa가 S2·S3·S4·S7의 모서리 범위를 고쳤다.
// 103은 바깥 모서리 반지름을 약 1.0칸, 안쪽 모서리를 약 0.7칸으로 키운다(099는 0.8·0.5). 범위를 정하는 방법(반지름 "약" ±0.1칸과 굽이 ±0.1칸)은 그대로다.
// 굽이가 있어 이 범위로는 옛 반지름과 새 반지름을 가르지 못한다. 새 반지름은 103 테스트 lobby3d-village-path-corners.spec.test.ts(E1)가 굽이 없이 본다.
//
// 작업 106(마을 가게 넣기) 명세의 "그 때문에 고칠 기존 테스트"(카페·도서관으로 가던 길을 보는 테스트)로 qa가 S10의 길 칸 수와 모서리 수를 고쳤다(106 qa 보고 02-qa-tests.md).
// 106은 카페·도서관으로 가던 흙길을 빼고 광장 동쪽 길을 옷집 문 앞까지 [42, 22, 50, 24]로 줄인다. 그 길 칸(tests/__fixtures__/village-shops-106.ts의 EXPECTED_PATH_RECTS)은
// 148칸, 바깥 모서리 12, 안쪽 모서리 12다(지금 248칸, 18, 16). 단언하는 규칙(길 칸 안팎, 분수, 모서리 깎기·채우기)은 그대로다.
//
// 명세의 값과 이 테스트가 받는 범위:
// - 바깥 모서리(볼록, 길 끝 포함) 반지름 약 1.0칸(103): 반지름 r로 깎으면 모서리 점에서 길 쪽 대각선으로 r(√2−1)만큼 가야 길 안이 된다(1.0이면 0.414).
//   "약"(0.9~1.1칸 → 0.373~0.456)과 굽이(±0.1)를 생각해 0.27~0.56칸에서 길 안이 되면 받는다(099의 0.8칸 때는 0.22~0.45칸).
// - 안쪽 모서리(오목) 반지름 약 0.7칸(103): 채우면 모서리 점에서 빈 쪽 대각선으로 r(√2−1)까지 길이다(0.7이면 0.290).
//   "약"(0.6~0.8칸 → 0.249~0.331)과 굽이를 생각해 0.15~0.43칸에서 길 밖이 되면 받는다(099의 0.5칸 때는 0.10~0.31칸).
// - 곧은 가장자리 굽이 약 ±0.1칸: 곧은 가장자리 가운데 점들이 원래 선에서 0.15칸 안이고, 안팎 양쪽으로 0.03칸 넘게 굽은 점이 있으면 받는다.
// - 원래 길 칸 밖으로 0.2칸 안(채운 안쪽 모서리 말고): 경계의 모든 점이 길 칸에서 0.2칸 안. 안쪽 모서리(와 명세가 정하지 않은 대각선 맞닿음) 둘레 0.75칸 안의 점은
//   채운 반지름 0.5칸 안으로 받는다.
// - 굽이는 정해진 씨앗값: 두 번 불러도, Math.random이 다른 값을 내도 결과가 같다.
// - 3D 그리기와 떨어진 함수: 모듈 파일이 three·react-three-fiber를 불러오지 않는다.
// 명세가 정하지 않아 보지 않는 것: 대각선으로만 맞닿은 칸(배치 파일의 (42, 28))을 이을지 떼어 둘지, 굽이의 물결 길이, 고리 점의 방향(시계·반시계).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import {
  alongDiagonal,
  cornersOf,
  firstAlongDiagonal,
  inShapes,
  ringsOf,
  tileDistance,
  tilesOf,
  type PathShape,
  type Rect,
  type RoundedPathShapes
} from "../__fixtures__/village-paths-099";

const MOBILE = join(__dirname, "..", "..");

function load(): RoundedPathShapes {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/lobby3d/village-paths") as { roundedPathShapes: RoundedPathShapes };
  expect(typeof mod.roundedPathShapes).toBe("function");
  return mod.roundedPathShapes;
}

const STRAIGHT: Rect[] = [[0, 0, 12, 2]];
/** T: 가로 길(0~12, 0~2)과 그 아래로 내려가는 길(5~7, 2~8). 안쪽 모서리 (5,2)·(7,2). */
const TEE: Rect[] = [
  [0, 0, 12, 2],
  [5, 2, 7, 8]
];
/** L: 가로 길(0~10, 0~2)과 오른쪽 끝에서 내려가는 길(8~10, 0~10). 안쪽 모서리 (8,2). */
const ELL: Rect[] = [
  [0, 0, 10, 2],
  [8, 0, 10, 10]
];
/** 고리: 분수 광장 둘레처럼 가운데(2~8, 2~8)가 빈 길. */
const RING: Rect[] = [
  [0, 0, 10, 2],
  [0, 8, 10, 10],
  [0, 2, 2, 8],
  [8, 2, 10, 8]
];
const LAYOUT_PATHS = LAYOUT.paths as unknown as Rect[];

/** 모든 경계 점(바깥·구멍 고리의 점). */
const pointsOf = (shapes: PathShape[]) => ringsOf(shapes).flat();

/** 0.2칸 규칙을 어긴 경계 점(안쪽 모서리·대각선 맞닿음 둘레 0.75칸 안은 0.5칸까지 받는다). */
function outsideBand(rects: Rect[], shapes: PathShape[]): string[] {
  const tiles = tilesOf(rects);
  const { concave } = cornersOf(tiles);
  const pinches: { x: number; z: number }[] = [];
  for (const t of tiles) {
    const [c, r] = t.split(",").map(Number);
    // 대각선으로만 맞닿은 격자 점: (c+1, r+1) 쪽 칸이 길이고 그 사이 두 칸이 빈 곳, (c+1, r-1) 쪽도 같다
    if (tiles.has(`${c + 1},${r + 1}`) && !tiles.has(`${c + 1},${r}`) && !tiles.has(`${c},${r + 1}`)) pinches.push({ x: c + 1, z: r + 1 });
    if (tiles.has(`${c + 1},${r - 1}`) && !tiles.has(`${c + 1},${r}`) && !tiles.has(`${c},${r - 1}`)) pinches.push({ x: c + 1, z: r });
  }
  const special = [...concave, ...pinches];
  const bad: string[] = [];
  for (const p of pointsOf(shapes)) {
    const d = tileDistance(tiles, p);
    const nearSpecial = special.some((c) => Math.hypot(p.x - c.x, p.z - c.z) <= 0.75);
    if (d > (nearSpecial ? 0.5 : 0.2) + 1e-9) bad.push(`(${p.x.toFixed(3)}, ${p.z.toFixed(3)}) ${d.toFixed(3)}칸`);
  }
  return bad;
}

/** 칸 가운데가 모두 길 안이다. */
function uncoveredTileCenters(rects: Rect[], shapes: PathShape[]): string[] {
  return [...tilesOf(rects)].filter((t) => {
    const [c, r] = t.split(",").map(Number);
    return !inShapes(shapes, { x: c + 0.5, z: r + 0.5 });
  });
}

describe("[spec] 099 바뀔 동작: 둥근 길 경계 함수(명세 1)", () => {
  it("S1 길 칸이 없으면 빈 목록이다", () => {
    expect(load()([])).toEqual([]);
  });

  it("S2 곧은 길 하나: 조각 하나(구멍 없음), 칸 가운데는 모두 길 안, 길 끝 네 모서리는 둥글게 깎였다(대각선 0.27~0.56칸에서 길 안)", () => {
    const shapes = load()(STRAIGHT);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toEqual([]);
    expect(uncoveredTileCenters(STRAIGHT, shapes)).toEqual([]);
    const { convex } = cornersOf(tilesOf(STRAIGHT));
    expect(convex).toHaveLength(4);
    for (const c of convex) {
      const s = firstAlongDiagonal(shapes, c, true);
      expect({ corner: [c.x, c.z], inRange: s !== null && s >= 0.27 && s <= 0.56, s }).toEqual({ corner: [c.x, c.z], inRange: true, s });
    }
  });

  it("S3 T자 길: 바깥 모서리 여섯은 깎이고(대각선 0.27~0.56칸에서 길 안), 안쪽 모서리 (5,2)·(7,2)는 채워졌다(모서리 점은 길 안, 빈 쪽 대각선 0.15~0.43칸에서 길 밖)", () => {
    const shapes = load()(TEE);
    expect(shapes).toHaveLength(1);
    expect(uncoveredTileCenters(TEE, shapes)).toEqual([]);
    const { convex, concave } = cornersOf(tilesOf(TEE));
    expect(convex).toHaveLength(6);
    expect(concave.map((c) => [c.x, c.z]).sort()).toEqual([
      [5, 2],
      [7, 2]
    ]);
    for (const c of convex) {
      const s = firstAlongDiagonal(shapes, c, true);
      expect({ corner: [c.x, c.z], inRange: s !== null && s >= 0.27 && s <= 0.56, s }).toEqual({ corner: [c.x, c.z], inRange: true, s });
    }
    for (const c of concave) {
      expect({ corner: [c.x, c.z], cornerInside: inShapes(shapes, alongDiagonal(c, 0)) }).toEqual({ corner: [c.x, c.z], cornerInside: true });
      const s = firstAlongDiagonal(shapes, c, false);
      expect({ corner: [c.x, c.z], inRange: s !== null && s >= 0.15 && s <= 0.43, s }).toEqual({ corner: [c.x, c.z], inRange: true, s });
    }
  });

  it("S4 L자 길: 꺾여 나가는 바깥 모서리 (10,0)은 깎이고 안쪽 모서리 (8,2)는 채워졌다", () => {
    const shapes = load()(ELL);
    expect(shapes).toHaveLength(1);
    expect(uncoveredTileCenters(ELL, shapes)).toEqual([]);
    const outer = { x: 10, z: 0, dx: -1, dz: 1 };
    const s = firstAlongDiagonal(shapes, outer, true);
    expect({ inRange: s !== null && s >= 0.27 && s <= 0.56, s }).toEqual({ inRange: true, s });
    const inner = { x: 8, z: 2, dx: -1, dz: 1 };
    expect(inShapes(shapes, alongDiagonal(inner, 0))).toBe(true);
    const e = firstAlongDiagonal(shapes, inner, false);
    expect({ inRange: e !== null && e >= 0.15 && e <= 0.43, e }).toEqual({ inRange: true, e });
  });

  it("S5 곧은 가장자리는 약 ±0.1칸으로 굽이친다: T의 위 가장자리(z 0, x 1.5~10.5)와 세로 길 양옆(x 5·7, z 3~7)의 경계 점이 선에서 0.15칸 안이고, 안팎으로 0.03칸 넘게 굽은 점이 있으며, 0.2칸 안쪽은 길이고 0.2칸 바깥은 길이 아니다", () => {
    const shapes = load()(TEE);
    const points = pointsOf(shapes);
    const edges = [
      { name: "위 z=0", along: (p: { x: number; z: number }) => p.x, across: (p: { x: number; z: number }) => p.z, line: 0, from: 1.5, to: 10.5, inward: 1 },
      { name: "왼쪽 x=5", along: (p: { x: number; z: number }) => p.z, across: (p: { x: number; z: number }) => p.x, line: 5, from: 3, to: 7, inward: 1 },
      { name: "오른쪽 x=7", along: (p: { x: number; z: number }) => p.z, across: (p: { x: number; z: number }) => p.x, line: 7, from: 3, to: 7, inward: -1 }
    ];
    for (const edge of edges) {
      const near = points.filter((p) => edge.along(p) >= edge.from && edge.along(p) <= edge.to && Math.abs(edge.across(p) - edge.line) < 0.3);
      const devs = near.map((p) => (edge.across(p) - edge.line) * edge.inward);
      const maxAbs = Math.max(0, ...devs.map(Math.abs));
      expect({ edge: edge.name, within015: maxAbs <= 0.15, inward: devs.some((d) => d > 0.03), outward: devs.some((d) => d < -0.03), maxAbs }).toEqual({
        edge: edge.name,
        within015: true,
        inward: true,
        outward: true,
        maxAbs
      });
      const wrongInside: number[] = [];
      const wrongOutside: number[] = [];
      for (let a = edge.from; a <= edge.to + 1e-9; a += 0.25) {
        const at = (off: number) => (edge.name.startsWith("위") ? { x: a, z: edge.line + off } : { x: edge.line + off, z: a });
        if (!inShapes(shapes, at(0.2 * edge.inward))) wrongInside.push(a);
        if (inShapes(shapes, at(-0.2 * edge.inward))) wrongOutside.push(a);
      }
      expect({ edge: edge.name, wrongInside, wrongOutside }).toEqual({ edge: edge.name, wrongInside: [], wrongOutside: [] });
    }
  });

  it.each([
    ["곧은 길", STRAIGHT],
    ["T자 길", TEE],
    ["L자 길", ELL],
    ["고리", RING],
    ["배치 파일의 길", LAYOUT_PATHS]
  ] as [string, Rect[]][])("S6 %s: 둥근 경계의 모든 점이 길 칸에서 0.2칸 안이다(채운 안쪽 모서리 둘레는 0.5칸 안)", (_name, rects) => {
    const shapes = load()(rects);
    expect(pointsOf(shapes).length).toBeGreaterThan(0);
    expect(outsideBand(rects, shapes)).toEqual([]);
  });

  it("S7 고리 모양 길: 조각 하나에 구멍 하나이고, 가운데 빈 곳은 길이 아니며, 구멍의 네 모서리(안쪽 모서리)도 채워졌다", () => {
    const shapes = load()(RING);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].holes).toHaveLength(1);
    expect(inShapes(shapes, { x: 5, z: 5 })).toBe(false);
    expect(uncoveredTileCenters(RING, shapes)).toEqual([]);
    const { concave } = cornersOf(tilesOf(RING));
    expect(concave.map((c) => [c.x, c.z]).sort()).toEqual([
      [2, 2],
      [2, 8],
      [8, 2],
      [8, 8]
    ]);
    for (const c of concave) {
      expect({ corner: [c.x, c.z], cornerInside: inShapes(shapes, alongDiagonal(c, 0)) }).toEqual({ corner: [c.x, c.z], cornerInside: true });
      const s = firstAlongDiagonal(shapes, c, false);
      expect({ corner: [c.x, c.z], inRange: s !== null && s >= 0.15 && s <= 0.43, s }).toEqual({ corner: [c.x, c.z], inRange: true, s });
    }
  });

  it("S8 떨어진 길 둘은 조각 둘이고, 겹치는 사각형은 합친 모양 하나로 본다(겹친 자리에 모서리를 만들지 않는다)", () => {
    const run = load();
    expect(run([
      [0, 0, 4, 2],
      [8, 0, 12, 2]
    ])).toHaveLength(2);
    const merged = run([
      [0, 0, 4, 2],
      [2, 0, 6, 2]
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].holes).toEqual([]);
    for (const p of [
      { x: 2, z: 0.2 },
      { x: 4, z: 0.2 },
      { x: 2, z: 1.8 },
      { x: 4, z: 1.8 }
    ]) {
      expect({ p, inside: inShapes(merged, p) }).toEqual({ p, inside: true });
    }
    expect(cornersOf(tilesOf([[0, 0, 4, 2], [2, 0, 6, 2]])).convex).toHaveLength(4);
  });

  it("S9 굽이는 정해진 씨앗값으로 만든다: 두 번 불러도 같고, Math.random이 다른 값을 내도 같다", () => {
    const run = load();
    const first = run(LAYOUT_PATHS);
    expect(run(LAYOUT_PATHS)).toEqual(first);
    let n = 0;
    const spy = jest.spyOn(Math, "random").mockImplementation(() => {
      n += 1;
      return (n * 0.618033) % 1;
    });
    try {
      expect(run(LAYOUT_PATHS)).toEqual(first);
    } finally {
      spy.mockRestore();
    }
  });

  it("S10 배치 파일의 길: 길 칸 가운데는 모두 길 안이고, 길이 아닌 칸 가운데는 길 밖이며, 분수 자리는 길이 아니다. 바깥 모서리는 깎이고 안쪽 모서리는 채워졌다", () => {
    const shapes = load()(LAYOUT_PATHS);
    const tiles = tilesOf(LAYOUT_PATHS);
    expect(tiles.size).toBe(148);
    expect(uncoveredTileCenters(LAYOUT_PATHS, shapes)).toEqual([]);
    const wrong: string[] = [];
    for (let c = 0; c < LAYOUT.width; c += 1) {
      for (let r = 0; r < LAYOUT.depth; r += 1) {
        if (!tiles.has(`${c},${r}`) && inShapes(shapes, { x: c + 0.5, z: r + 0.5 })) wrong.push(`${c},${r}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(inShapes(shapes, { x: LAYOUT.fountain.x, z: LAYOUT.fountain.z })).toBe(false);
    const { convex, concave } = cornersOf(tiles);
    expect({ convex: convex.length, concave: concave.length }).toEqual({ convex: 12, concave: 12 });
    // 바깥 모서리: 모서리에서 길 쪽 대각선 0.07칸(각 축 0.05칸, 칸 안) 점이 깎여 길 밖이다
    const sharp = convex.filter((c) => inShapes(shapes, alongDiagonal(c, 0.07))).map((c) => `${c.x},${c.z}`);
    expect(sharp).toEqual([]);
    // 안쪽 모서리: 모서리에서 빈 쪽 대각선 0.03칸(칸 밖) 점이 채워져 길 안이다
    const unfilled = concave.filter((c) => !inShapes(shapes, alongDiagonal(c, 0.03))).map((c) => `${c.x},${c.z}`);
    expect(unfilled).toEqual([]);
  });

  it("S11 3D 그리기와 떨어진 함수: village-paths 모듈은 three·react-three-fiber를 불러오지 않는다", () => {
    load();
    const source = readFileSync(join(MOBILE, "src", "lib", "lobby3d", "village-paths.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["'](three|@react-three\/[^"']+)(\/[^"']*)?["']/);
    expect(source).not.toMatch(/require\(\s*["'](three|@react-three\/[^"']+)(\/[^"']*)?["']\s*\)/);
  });
});
