/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 117 마을 나무 배치 다듬기, 기능 변경, 모바일): 마을 안 28자리의 종류·자리·규칙, 배치 파일 모양, 둘레 숲 심기 규칙.
// 기대값은 명세(private 작업 폴더 117-2026-11-18-마을-나무-배치-다듬기/01-main-spec.md)와 결정 파일(03-main-decision.md)에서만 가져온다.
// 그대로 둘 동작은 기준 커밋 02d6047의 지금 값이다. 도우미·값은 tests/__fixtures__/village-trees-117.ts.
//
// 바뀔 동작(구현 전 실패): T1~T5, T7, T8, F1, F2, F4. 그대로 둘 동작(구현 전·뒤 통과): T6, T9, F3, F5, F6, K1~K3.
// (T9는 옛 자리도 규칙을 지키고 있어, F3·F5·F6은 숲 밀도·크기·결정성이 그대로라서 지금도 통과한다.)
// 가정(02-qa-tests.md "가정"):
// - 마을 안 나무의 종류는 village-layout.json의 treeKinds(결정 파일: trees와 같은 순서의 "A"·"Pine" 28개)에서 읽는다. VILLAGE_TREES는 [x, z] 쌍 목록이다.
//   village.ts가 종류를 내보내는 이름은 명세가 정하지 않아, 종류는 배치 파일과 villageTreeSpots()(village-trees.ts, 종류 species)로만 본다.
// - 수관 반폭: 새 나무 모델 LOD1 잎(Tree_Foliage)의 가로 반폭. A 0.9, Pine 0.94(모델 파일에서 잰 값: A x -0.877~0.963·z -0.898~0.872, Pine x -0.942~0.941·z -0.936~0.936). 배율은 최대 1.845.
// - "약"의 폭: 줄기 간격 가운데값 약 3.8은 3.6~4.0, 숲 띠 가운데값 약 3.1은 2.8~3.4, 숲 그루 수 약 490은 440~540, 숲의 A 약 20%는 14~26%.
// - 숲 띠: 경계 원 가운데에서 반지름(26) + 5 이하의 그루는 모두 띠 그루다(안쪽 가장자리가 반지름~반지름+2이고 띠는 거기서 5칸).
//   숲 뒤쪽: 가운데에서 반지름 + 9 넘게 먼 그루(띠 밖).
// - 숲 범위 상자(옆 9·뒤 12·앞 4칸)는 흔들기 폭을 1칸 봐준다.
// - "수관이 길 칸에 걸리지 않는다"는 수관 원(반지름 = 수관 반폭 × 1.845)과 길 사각형 사이 거리가 수관 반지름 이상인 것으로, 밑동은 0.8칸 정사각형이 건물·분수(반지름 1.6)·가로등(0.6)·벤치(2.3×0.9, rot ±90은 0.9×2.3)·바위(1.8)와 겹치지 않는 것으로 본다.
// - 카메라 가림(분수·문·간판·걷는 라룹이)은 카메라가 따라가는 자리에 따라 달라 테스트로 옮기지 않았다(보고의 "테스트로 확인할 수 없는 것").
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE, VILLAGE_BOUNDARY, VILLAGE_BUILDINGS, VILLAGE_PATH_RECTS, VILLAGE_SOLID_TILES, VILLAGE_TREES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { villageTreeSpots, type VillageTreeSpot } from "@/lib/lobby3d/village-trees";
import { REPO } from "../__fixtures__/village-glb-098";
import { rectTiles } from "../__fixtures__/village-shops-106";
import {
  KEPT_TREES_117,
  NEW_TREES_117,
  REMOVED_TREES_117,
  TREE_BASE_117,
  TREE_MAX_OVERLAP_117,
  TREE_MIN_GAP_117,
  TREE_SCALE_MAX_117,
  TREE_SCALE_MIN_117,
  trunkRect117
} from "../__fixtures__/village-trees-117";

type Layout117 = typeof LAYOUT & { treeKinds: string[] };
const layout = LAYOUT as unknown as Layout117;
const key = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const CROWN_HALF_WIDTH: Record<string, number> = { A: 0.9, Pine: 0.94 };
const interiorSpots = (): VillageTreeSpot[] => villageTreeSpots().filter((s) => s.lod === 1);
const forestSpots = (): VillageTreeSpot[] => villageTreeSpots().filter((s) => s.lod === 2);
const centerDistance = (p: { x: number; z: number }) => Math.hypot(p.x - VILLAGE_BOUNDARY.x, p.z - VILLAGE_BOUNDARY.z);
const nearest = (spots: { x: number; z: number }[], p: { x: number; z: number }, skip?: object) =>
  Math.min(...spots.filter((s) => s !== skip && !(s.x === p.x && s.z === p.z)).map((s) => Math.hypot(s.x - p.x, s.z - p.z)));
/** 점에서 사각형 [x0, z0, x1, z1]까지의 거리(안이면 0). */
const rectDistance = (x: number, z: number, r: readonly number[]) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
const overlaps = (a: readonly number[], b: readonly number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

describe("[spec] 117 바뀔 동작: 마을 안 28그루(명세 1·3, 결정 03)", () => {
  it("T1 배치 파일(명세 3, 결정 03): trees는 지금처럼 [x, z] 쌍 28개이고 자리가 명세 표의 28자리이며, 같은 순서의 treeKinds 28개(\"A\"·\"Pine\")가 따로 있다", () => {
    expect(LAYOUT.trees).toHaveLength(28);
    expect(LAYOUT.trees.every((t) => Array.isArray(t) && t.length === 2)).toBe(true);
    expect(LAYOUT.trees.map(([x, z]) => key(x, z)).sort()).toEqual(NEW_TREES_117.map(([x, z]) => key(x, z)).sort());
    expect(Array.isArray(layout.treeKinds)).toBe(true);
    expect(layout.treeKinds).toHaveLength(28);
    expect(layout.treeKinds.every((k) => k === "A" || k === "Pine")).toBe(true);
  });

  it("T2 종류(명세 1): 자리마다 종류가 표대로다(treeKinds[i]가 trees[i]의 종류). A 20그루, Pine 8그루", () => {
    const expected = NEW_TREES_117.map(([x, z, kind]) => `${key(x, z)} ${kind}`).sort();
    const got = LAYOUT.trees.map(([x, z], i) => `${key(x, z)} ${layout.treeKinds?.[i]}`).sort();
    expect(got).toEqual(expected);
    const kinds = layout.treeKinds ?? [];
    expect({ A: kinds.filter((k) => k === "A").length, Pine: kinds.filter((k) => k === "Pine").length }).toEqual({ A: 20, Pine: 8 });
  });

  it("T3 VILLAGE_TREES(명세 3): 지금처럼 [x, z] 쌍 목록이고 배치 파일의 trees와 같다", () => {
    expect(VILLAGE_TREES).toHaveLength(28);
    expect(VILLAGE_TREES.every((t) => t.length === 2)).toBe(true);
    expect(VILLAGE_TREES.map(([x, z]) => key(x, z))).toEqual(LAYOUT.trees.map(([x, z]) => key(x, z)));
    expect(VILLAGE_TREES.map(([x, z]) => key(x, z)).sort()).toEqual(NEW_TREES_117.map(([x, z]) => key(x, z)).sort());
  });

  it("T4 자리(명세 1 표): 그대로 두는 11자리는 있고, 빠지는 옛 17자리에는 나무가 없다", () => {
    const now = new Set(LAYOUT.trees.map(([x, z]) => key(x, z)));
    expect({ kept: KEPT_TREES_117.length, missing: KEPT_TREES_117.filter(([x, z]) => !now.has(key(x, z))).map(([x, z]) => key(x, z)) }).toEqual({ kept: 11, missing: [] });
    expect({ removed: REMOVED_TREES_117.length, stillThere: REMOVED_TREES_117.filter(([x, z]) => now.has(key(x, z))).map(([x, z]) => key(x, z)) }).toEqual({ removed: 17, stillThere: [] });
  });

  it("T5 그리는 자리(명세 1): 마을 안 그루(LOD1)가 28그루이고, 자리마다 종류가 표대로(A 20·Pine 8)이며 배율 1.53~1.845·밝기 0.9~1.05다. 방향·배율·밝기는 그루마다 조금씩 다르다", () => {
    const inside = interiorSpots();
    expect(inside).toHaveLength(28);
    const kinds = inside.map((s) => `${key(s.x, s.z)} ${s.species}`).sort();
    expect(kinds).toEqual(NEW_TREES_117.map(([x, z, kind]) => `${key(x, z)} ${kind}`).sort());
    const bad = inside.filter((s) => s.scale < TREE_SCALE_MIN_117 - 1e-6 || s.scale > TREE_SCALE_MAX_117 + 1e-6 || s.shade < 0.9 - 1e-6 || s.shade > 1.05 + 1e-6);
    expect(bad).toEqual([]);
    expect({
      scales: new Set(inside.map((s) => s.scale.toFixed(4))).size > 5,
      turns: new Set(inside.map((s) => s.turn.toFixed(4))).size > 5,
      shades: new Set(inside.map((s) => s.shade.toFixed(4))).size > 5
    }).toEqual({ scales: true, turns: true, shades: true });
  });

  it("T6 늘 같은 결과(명세 1): 모듈을 새로 읽어 다시 계산해도 마을 안 그루의 종류·자리·배율·방향·밝기가 같다", () => {
    const first = interiorSpots().map((s) => ({ ...s }));
    let second: VillageTreeSpot[] = [];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require("@/lib/lobby3d/village-trees") as typeof import("@/lib/lobby3d/village-trees");
      second = fresh
        .villageTreeSpots()
        .filter((s) => s.lod === 1)
        .map((s) => ({ ...s }));
    });
    expect(second).toEqual(first);
  });

  it("T7 간격(명세 1 규칙): 가장 가까운 그루와의 줄기 간격이 모두 3.4칸 이상이고, 가운데값이 약 3.8칸(3.6~4.0)이다", () => {
    const pts = LAYOUT.trees.map(([x, z]) => ({ x, z }));
    const gaps = pts.map((p) => nearest(pts, p));
    expect({ minOk: Math.min(...gaps) >= TREE_MIN_GAP_117 - 1e-9, medianOk: median(gaps) >= 3.6 && median(gaps) <= 4.0 }).toEqual({ minOk: true, medianOk: true });
  });

  it("T8 수관(명세 1 규칙, 최대 배율 1.845): 수관 원이 길 사각형에 걸치지 않고, 두 수관이 겹치는 깊이는 0.9칸 이하다", () => {
    const crowns = LAYOUT.trees.map(([x, z], i) => ({ x, z, r: CROWN_HALF_WIDTH[layout.treeKinds?.[i] ?? "A"] * TREE_SCALE_MAX_117, kind: layout.treeKinds?.[i] }));
    expect(crowns.every((c) => c.kind === "A" || c.kind === "Pine")).toBe(true);
    const onPath = crowns.filter((c) => VILLAGE_PATH_RECTS.some((r) => rectDistance(c.x, c.z, r) < c.r)).map((c) => key(c.x, c.z));
    expect(onPath).toEqual([]);
    const deep: string[] = [];
    crowns.forEach((a, i) =>
      crowns.slice(i + 1).forEach((b) => {
        const depth = a.r + b.r - Math.hypot(a.x - b.x, a.z - b.z);
        if (depth > TREE_MAX_OVERLAP_117 + 1e-9) deep.push(`${key(a.x, a.z)}~${key(b.x, b.z)} ${depth.toFixed(2)}`);
      })
    );
    expect(deep).toEqual([]);
  });

  it("T9 밑동(명세 1 규칙): 밑동 0.8칸 정사각형이 길, 건물, 분수, 가로등, 벤치, 바위에 닿지 않고, 막힌 칸이 새 자리의 밑동 칸을 모두 덮는다", () => {
    const trunks = LAYOUT.trees.map(([x, z]) => ({ x, z, rect: trunkRect117([x, z]) }));
    const others: { name: string; rect: readonly number[] }[] = [
      ...VILLAGE_PATH_RECTS.map((r) => ({ name: "길", rect: r })),
      ...VILLAGE_BUILDINGS.map((b) => ({ name: "건물", rect: b.rect })),
      ...LAYOUT.lanterns.map(([x, z]) => ({ name: "가로등", rect: [x - 0.3, z - 0.3, x + 0.3, z + 0.3] })),
      ...LAYOUT.benches.map((b) => ({ name: "벤치", rect: Math.abs(b.rot) === 90 ? [b.x - 0.45, b.z - 1.15, b.x + 0.45, b.z + 1.15] : [b.x - 1.15, b.z - 0.45, b.x + 1.15, b.z + 0.45] })),
      ...LAYOUT.rocks.map(([x, z]) => ({ name: "바위", rect: [x - 0.9, z - 0.9, x + 0.9, z + 0.9] }))
    ];
    const touching = trunks.flatMap((t) => others.filter((o) => overlaps(t.rect, o.rect)).map((o) => `${key(t.x, t.z)} ${o.name}`));
    const fountain = trunks.filter((t) => rectDistance(LAYOUT.fountain.x, LAYOUT.fountain.z, t.rect) < LAYOUT.fountain.radius).map((t) => `${key(t.x, t.z)} 분수`);
    expect([...touching, ...fountain]).toEqual([]);
    expect(TREE_BASE_117).toBe(0.8);
    const covered = [...rectTiles(trunks.map((t) => t.rect as unknown as [number, number, number, number]))].filter((t) => !VILLAGE_SOLID_TILES.has(t));
    expect(covered).toEqual([]);
  });
});

describe("[spec] 117 바뀔 동작: 둘레 숲(명세 2)", () => {
  it("F1 그루 수와 범위(명세 2): 둘레 숲 그루(LOD2)가 약 490그루(440~540)이고, 모두 경계 원 밖이며 숲 범위(옆 9·뒤 12·앞 4칸, 흔들기 1칸 여유) 안이다", () => {
    const forest = forestSpots();
    const { x: bx, z: bz, radius } = VILLAGE_BOUNDARY;
    expect({ count: forest.length >= 440 && forest.length <= 540, inside: forest.filter((s) => centerDistance(s) <= radius).length }).toEqual({ count: true, inside: 0 });
    const outOfBox = forest.filter((s) => s.x < bx - radius - 9 - 1 || s.x > bx + radius + 9 + 1 || s.z < bz - radius - 12 - 1 || s.z > bz + radius + 4 + 1);
    expect(outOfBox.map((s) => key(s.x, s.z))).toEqual([]);
  });

  it("F2 가장자리 띠(명세 2): 경계 원 가운데에서 반지름 + 5 이하의 그루는 가장 가까운 그루와의 간격 가운데값이 약 3.1칸(2.8~3.4)이고 모두 1.8칸 이상 떨어져 있다", () => {
    const forest = forestSpots();
    const band = forest.filter((s) => centerDistance(s) <= VILLAGE_BOUNDARY.radius + 5);
    expect(band.length).toBeGreaterThan(30);
    const gaps = band.map((s) => nearest(forest, s, s));
    expect({ minOk: Math.min(...gaps) >= 1.8, median: median(gaps) >= 2.8 && median(gaps) <= 3.4 }).toEqual({ minOk: true, median: true });
  });

  it("F3 뒤쪽(명세 2): 반지름 + 9 넘게 먼 그루가 가장 가까운 그루와의 간격 가운데값이 2칸 안팎(1.5~2.3)으로 빽빽하다. 지금(2칸 격자 흔들기)과 같은 밀도다", () => {
    const forest = forestSpots();
    const back = forest.filter((s) => centerDistance(s) > VILLAGE_BOUNDARY.radius + 9);
    expect(back.length).toBeGreaterThan(150);
    const gaps = back.map((s) => nearest(forest, s, s));
    expect(median(gaps) >= 1.5 && median(gaps) <= 2.3).toBe(true);
  });

  it("F4 종류(명세 2): 기본은 Pine이고 A는 숲 전체에서 약 20%(14~26%)이며 종류는 A·Pine 둘뿐이다. 가장자리 띠의 A는 대부분 무리 지어 있다(다른 A가 5.2칸 안에 있는 그루가 60% 이상)", () => {
    const forest = forestSpots();
    const aShare = forest.filter((s) => s.species === "A").length / forest.length;
    expect({ species: [...new Set(forest.map((s) => s.species))].sort(), aShare: aShare >= 0.14 && aShare <= 0.26 }).toEqual({ species: ["A", "Pine"], aShare: true });
    const bandA = forest.filter((s) => s.species === "A" && centerDistance(s) <= VILLAGE_BOUNDARY.radius + 5);
    expect(bandA.length).toBeGreaterThan(3);
    const grouped = bandA.filter((s) => forest.some((o) => o !== s && o.species === "A" && Math.hypot(o.x - s.x, o.z - s.z) <= 5.2));
    expect(grouped.length / bandA.length).toBeGreaterThanOrEqual(0.6);
  });

  it("F5 크기·단계(명세 2): 숲 그루의 배율은 1.44~1.89, 밝기는 0.9~1.05이고 모두 LOD2다", () => {
    const forest = forestSpots();
    expect(forest.length).toBeGreaterThan(0);
    const bad = forest.filter((s) => s.scale < 1.44 - 1e-6 || s.scale > 1.89 + 1e-6 || s.shade < 0.9 - 1e-6 || s.shade > 1.05 + 1e-6 || s.lod !== 2);
    expect(bad).toEqual([]);
  });

  it("F6 늘 같은 결과(명세 2): 모듈을 새로 읽어도 숲 그루의 종류·자리가 같다", () => {
    const first = forestSpots().map((s) => `${s.species} ${s.x.toFixed(4)},${s.z.toFixed(4)}`);
    let second: string[] = [];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require("@/lib/lobby3d/village-trees") as typeof import("@/lib/lobby3d/village-trees");
      second = fresh
        .villageTreeSpots()
        .filter((s) => s.lod === 2)
        .map((s) => `${s.species} ${s.x.toFixed(4)},${s.z.toFixed(4)}`);
    });
    expect(second).toEqual(first);
  });
});

describe("[spec] 117 그대로 둘 동작", () => {
  it("K1 마을 크기와 경계 원: 마을은 70×60, 경계 원은 (29, 26)·반지름 26이다", () => {
    expect({ width: VILLAGE.width, depth: VILLAGE.depth, boundary: { ...VILLAGE_BOUNDARY } }).toEqual({ width: 70, depth: 60, boundary: { x: 29, z: 26, radius: 26 } });
  });

  it("K2 나무가 걷기를 막는 넓이(밑동 0.8칸): 배치 파일의 자리마다 가운데에서 0.8×0.8칸이 막힌 칸이다", () => {
    const tiles = rectTiles(LAYOUT.trees.map(([x, z]) => [x - 0.4, z - 0.4, x + 0.4, z + 0.4] as [number, number, number, number]));
    expect([...tiles].filter((t) => !VILLAGE_SOLID_TILES.has(t))).toEqual([]);
  });

  it("K3 마을 모델 스크립트(build-village.py)는 나무 자리를 읽지 않는다: 배치 파일의 trees·treeKinds를 가리키는 글이 없다", () => {
    const script = readFileSync(join(REPO, "scripts", "lobby3d", "build-village.py"), "utf8");
    expect(/["']trees["']|\btreeKinds\b|\.trees\b/.test(script)).toBe(false);
  });
});
