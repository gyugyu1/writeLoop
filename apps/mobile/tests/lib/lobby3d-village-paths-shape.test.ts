// 둥근 길 경계(village-paths)의 모양 세부. 099 검증에서 나온 지적(둥근 모서리 둘이 맞닿는 곳, 구멍 안의 길 섬)을 지킨다.
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { buildPathOutlines, insetLoop, type PathPoint, type PathRect } from "@/lib/lobby3d/village-paths";

type Seg = [PathPoint, PathPoint];

function segments(loop: readonly PathPoint[]): Seg[] {
  return loop.map((p, i) => [p, loop[(i + 1) % loop.length]] as Seg);
}

/** 두 선분이 끝점이 아닌 곳에서 교차하는가. */
function crosses([a, b]: Seg, [c, d]: Seg): boolean {
  const cross = (o: PathPoint, p: PathPoint, q: PathPoint) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function selfCrossings(loop: readonly PathPoint[]): number {
  const segs = segments(loop);
  let count = 0;
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 2; j < segs.length; j += 1) {
      if (i === 0 && j === segs.length - 1) continue;
      if (crosses(segs[i], segs[j])) count += 1;
    }
  }
  return count;
}

const allLoops = (rects: readonly PathRect[]) => buildPathOutlines(rects).flatMap((o) => [o.outer, ...o.holes]);

describe("둥근 길 경계의 모양 세부", () => {
  const rects = LAYOUT.paths as unknown as PathRect[];

  it("이어진 두 점이 같은 자리에 오지 않는다(둥근 모서리 둘이 맞닿는 곳도 한 번만)", () => {
    for (const loop of allLoops(rects)) {
      loop.forEach((p, i) => {
        const q = loop[(i + 1) % loop.length];
        expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeGreaterThan(1e-6);
      });
    }
  });

  it("경계와 가장자리 띠 안쪽 선(0.15칸)이 스스로 엇갈리지 않는다", () => {
    for (const loop of allLoops(rects)) {
      expect(selfCrossings(loop)).toBe(0);
      expect(selfCrossings(insetLoop(loop, 0.15))).toBe(0);
    }
  });

  it("1칸 폭 길의 끝(둥근 모서리 둘이 맞닿음)에서도 안쪽 선이 엇갈리지 않는다", () => {
    const narrow: PathRect[] = [[0, 0, 1, 6]];
    for (const loop of allLoops(narrow)) expect(selfCrossings(insetLoop(loop, 0.15))).toBe(0);
  });

  it("구멍 안에 길 섬이 있으면 섬은 따로 한 조각이 되고, 구멍은 그 구멍을 품은 바깥 고리에만 들어간다", () => {
    // 9×9 고리(폭 2) 안 가운데에 1×1 섬
    const ring: PathRect[] = [
      [0, 0, 9, 2],
      [0, 7, 9, 9],
      [0, 2, 2, 7],
      [7, 2, 9, 7],
      [4, 4, 5, 5]
    ];
    const outlines = buildPathOutlines(ring);
    expect(outlines).toHaveLength(2);
    const holeCounts = outlines.map((o) => o.holes.length).sort();
    expect(holeCounts).toEqual([0, 1]);
  });
});
