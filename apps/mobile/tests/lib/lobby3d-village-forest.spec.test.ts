/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 115 ② 숲과 땅 꾸밈, 기능 변경, 모바일): 계절 흩뿌림·꽃 장식 자리, 풀밭 무늬 자리 지도의 이끼, 자산 출처의 마을 모델 줄, 옛 경계 설명.
// 둘레 숲 그루(그리기)는 lobby3d-village-forest.spec.test.tsx가 본다.
// 기대값은 명세(private 작업 폴더 115-2026-11-18-마을-동그란-숲-경계/03-숲과-땅-꾸밈/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작의 값은 기준 커밋 be29bd1의 지금 동작에서 잰 값이다(tests/__fixtures__/village-forest-115-2.ts).
// 구현 코드는 부르는 방법(village-decor.ts의 villageSeasonScatter·villageDecorSpots, village-ground-splat.ts의 villageGroundPlaceMap)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): E1, E5, E7, E9. 그대로 둘 동작(지금도 통과): E2, E4, E6, E8. (E3은 없다.)
// 가정(02-qa-tests.md "가정"):
// - "원 안" = 자리(조각·장식의 가운데 x, z)가 원 가운데 (29, 26)까지 26 이하.
// - E2 "원 안의 흩뿌림 조각의 자리는 그대로(원 밖이 빠지는 것만 허용)": 지금 조각 가운데 원 안의 것과, 바뀐 뒤 조각 전부(E1로 모두 원 안)가
//   같은 모음이다(종류·자리·방향·크기·밝기, 차례는 보지 않는다).
// - E4 장식: 지금 장식 127개는 이미 모두 원 안이다(막힌 칸을 피해서). 그래서 명세 2의 "장식은 원 안에만"은 지금도 만족하고, 원 안 자리 그대로는 "장식 전부 그대로"다.
// - E5 "옛 사각형 가장자리 대신": 옛 사각형 끝 한 칸 띠(마을 칸 안에서 끝까지 1칸 이하) 가운데 원 가운데에서 32칸 넘게 먼 곳(원 경계·숲 가장자리에서 4칸 넘게)의
//   이끼 몫 평균이, 마을 나무 둘레(가운데에서 0.6~1.4칸, 102 테스트 G6과 같은 곳)의 평균의 절반 이하다(102 테스트 G7 "자리로 정한다"와 같은 기준).
// - E6 맨땅 규칙과 마을 나무 둘레 이끼 그대로: 지도 범위·픽셀 수가 같고, 맨땅 몫(R)은 지도 전체가, 이끼 몫(G)은 원 가운데에서 20칸 안(원 경계에서 6칸 넘게 안쪽,
//   옛 사각형 끝에서 6칸 넘게)이 지금과 같다.
// - E7 출처: 마을 모델 줄의 Kenney 부품 목록("Fantasy Town Kit"부터 `scripts/lobby3d/build-village.py` 앞까지)에 생울타리·울타리·풍차가 없고, 분수·가로등·바위·길은 있다(127: 노점은 일부러 보지 않는다. 노점이 빠진 것은 127 테스트가 본다).
// - E9 옛 경계 설명: 명세 5가 든 네 파일(lobby3d-village.tsx, village.ts, engine.ts, village-ground-splat.ts)에 "풍차"와 "울타리" 낱말이 없다(지금 네 파일의 이 낱말은
//   모두 명세 5가 든 옛 경계 설명이다).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE, VILLAGE_BUILDINGS, VILLAGE_SOLID_TILES, VILLAGE_TREES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import {
  BASE_115_2,
  CREDITS_PATH_115_2,
  DECOR_115_2,
  PLACE_MAP_EXTENT_115_2,
  PLACE_MAP_KEEP_115_2,
  REPO_115_2,
  SCATTER_INSIDE_115_2,
  centerDistance115b,
  gitShow115b,
  insideCircle115b,
  placeMapKeepDigest115b,
  scatterDigest115b
} from "../__fixtures__/village-forest-115-2";
import { sampleMap, splatModule } from "../__fixtures__/village-splat-102";
import { scatterModule } from "../__fixtures__/village-ground-103";
import { decorModule } from "../__fixtures__/village-decor-101";
import { shapeIndex, type PathShape, type Rect, type RoundedPathShapes } from "../__fixtures__/village-paths-099";

const SEASONS = ["autumn", "spring", "summer"] as const;

function pathShapes(): PathShape[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/lobby3d/village-paths") as { roundedPathShapes: RoundedPathShapes };
  return mod.roundedPathShapes(LAYOUT.paths as unknown as Rect[]);
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const inVillage = (p: { x: number; z: number }) => p.x > 0 && p.x < VILLAGE.width && p.z > 0 && p.z < VILLAGE.depth;
const inBuilding = (p: { x: number; z: number }) => VILLAGE_BUILDINGS.some((b) => p.x >= b.rect[0] && p.x <= b.rect[2] && p.z >= b.rect[1] && p.z <= b.rect[3]);
const treeDistance = (p: { x: number; z: number }) => Math.min(...VILLAGE_TREES.map(([x, z]) => Math.hypot(p.x - x, p.z - z)));
/** 옛 사각형(마을 칸 0~70 × 0~60) 끝까지의 거리. */
const oldRectEdgeDistance = (p: { x: number; z: number }) => Math.min(p.x, VILLAGE.width - p.x, p.z, VILLAGE.depth - p.z);

function villageGrid(step = 0.25): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let x = step / 2; x < VILLAGE.width; x += step) for (let z = step / 2; z < VILLAGE.depth; z += step) out.push({ x, z });
  return out;
}

const outsideList = <T extends { x: number; z: number }>(items: T[]) =>
  items
    .filter((p) => !insideCircle115b(p.x, p.z))
    .slice(0, 5)
    .map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)} (가운데에서 ${centerDistance115b(p.x, p.z).toFixed(2)})`);

describe("[spec] 115 ② 흩뿌림·장식(명세 2)", () => {
  it("[바뀔] E1 낙엽·꽃잎·잎 흩뿌림은 원 안에만 둔다: 가을·봄·여름 모두 조각 가운데가 원 가운데 (29, 26)까지 26 이하이고, 원 밖 조각이 없다", () => {
    const mod = scatterModule();
    for (const season of SEASONS) {
      const pieces = mod.villageSeasonScatter(season);
      expect({ season, some: pieces.length > 0, outside: pieces.filter((p) => !insideCircle115b(p.x, p.z)).length, first: outsideList(pieces) }).toEqual({
        season,
        some: true,
        outside: 0,
        first: []
      });
    }
    expect(mod.villageSeasonScatter("winter")).toEqual([]);
  });

  it("[그대로] E2 원 안의 흩뿌림 조각은 지금 자리 그대로다: 계절마다 원 안 조각 모음(종류·자리·방향·크기·밝기)의 개수와 sha256이 기준 커밋 be29bd1의 원 안 조각과 같다", () => {
    const mod = scatterModule();
    for (const season of SEASONS) {
      const inside = mod.villageSeasonScatter(season).filter((p) => insideCircle115b(p.x, p.z));
      // 116 04 결정 3: 가을 낙엽은 A 그루 둘레에만 놓이므로 자리 모음은 바뀐다. 가을은 조각 크기(0.3~0.55)·밝기(0.85~1.15)·종류(0~7)가 그대로인지만 본다(봄·여름은 그대로 견준다)
      if (season === "autumn") {
        const bad = inside.filter((p) => p.size < 0.3 - 1e-6 || p.size > 0.55 + 1e-6 || p.shade < 0.85 - 1e-6 || p.shade > 1.15 + 1e-6 || !Number.isInteger(p.kind) || p.kind < 0 || p.kind > 7);
        expect({ season, some: inside.length > 0, bad: bad.length }).toEqual({ season, some: true, bad: 0 });
        continue;
      }
      expect({ season, ...scatterDigest115b(inside) }).toEqual({ season, ...SCATTER_INSIDE_115_2[season] });
    }
  });

  it("[그대로] E4 꽃·풀 장식은 원 안에만 있다: 장식이 모두 원 안이다(117: 막힌 칸을 피하는 규칙·종류·배율 범위는 그대로이고 자리 모음은 나무 자리를 따라 바뀐다. 117 전: 개수 127과 sha256이 기준 커밋 be29bd1과 같다)", () => {
    const spots = decorModule().villageDecorSpots();
    expect({ outside: spots.filter((p) => !insideCircle115b(p.x, p.z)).length, first: outsideList(spots) }).toEqual({ outside: 0, first: [] });
    // 117: 장식은 막힌 칸(나무 포함)을 피해 자리를 뽑으므로 나무 자리가 바뀌면 장식 모음도 바뀐다(115 전 기대: 개수 127과 sha256 69594c4c…). 개수 범위와 규칙만 본다
    expect({ countInRange: spots.length >= 100 && spots.length <= 150, count127: DECOR_115_2.count }).toEqual({ countInRange: true, count127: 127 });
    const KINDS = ["flowerWhite", "flowerYellow", "flowerPink", "flowerRed", "clover", "grassTuft"];
    const bad = spots.filter((p) => !KINDS.includes(p.kind) || p.scale < 0.75 - 1e-6 || p.scale > 1.1 + 1e-6 || VILLAGE_SOLID_TILES.has(`${Math.floor(p.x)},${Math.floor(p.z)}`));
    expect(bad).toEqual([]);
  });
});

describe("[spec] 115 ② 풀밭 무늬 이끼(명세 3)", () => {
  it("[바뀔] E5 옛 사각형 가장자리에는 이끼가 짙지 않다: 옛 사각형 끝 1칸 띠 가운데 원 가운데에서 32칸 넘게 먼 곳의 이끼 몫 평균이, 마을 나무 둘레(0.6~1.4칸) 평균의 절반 이하다", () => {
    const map = splatModule().villageGroundPlaceMap();
    const index = shapeIndex(pathShapes());
    const nearTree = villageGrid().filter((p) => {
      const d = treeDistance(p);
      return inVillage(p) && d >= 0.6 && d <= 1.4 && !index.inside(p) && index.distance(p) === Infinity && !inBuilding(p);
    });
    const oldEdge = villageGrid().filter((p) => oldRectEdgeDistance(p) <= 1 && centerDistance115b(p.x, p.z) > 32);
    expect({ tree: nearTree.length > 200, oldEdge: oldEdge.length > 1000 }).toEqual({ tree: true, oldEdge: true });
    const treeMoss = mean(nearTree.map((p) => sampleMap(map, 1, p.x, p.z)));
    const edgeMoss = mean(oldEdge.map((p) => sampleMap(map, 1, p.x, p.z)));
    expect({ tree: Number(treeMoss.toFixed(3)), oldEdge: Number(edgeMoss.toFixed(3)), notDense: edgeMoss <= treeMoss / 2 }).toEqual({
      tree: Number(treeMoss.toFixed(3)),
      oldEdge: Number(edgeMoss.toFixed(3)),
      notDense: true
    });
  });

  it("[그대로] E6 맨땅 규칙은 그대로다: 지도 범위·픽셀 수가 같고, 맨땅 몫(R) 전체가 기준 커밋 be29bd1과 같다(117: 마을 나무 둘레 이끼 몫(G)은 나무 자리를 따라 바뀐다)", () => {
    const map = splatModule().villageGroundPlaceMap();
    expect({ x0: map.x0, z0: map.z0, x1: map.x1, z1: map.z1, width: map.width, height: map.height }).toEqual(PLACE_MAP_EXTENT_115_2);
    // 117: 이끼 몫(G)은 마을 나무 둘레에 짙으므로 나무 자리가 바뀌면 지도도 바뀐다(115 전 기대: mossCount 5024와 moss sha256 69e10085…). 맨땅 몫(R) 전체는 그대로 견준다
    const digest = placeMapKeepDigest115b(map);
    expect({ bare: digest.bare, mossCount: digest.mossCount }).toEqual({ bare: PLACE_MAP_KEEP_115_2.bare, mossCount: PLACE_MAP_KEEP_115_2.mossCount });
  });
});

/** CREDITS.md에서 lobby-village.glb 줄(하나여야 한다)과, 그 줄의 Kenney 부품 목록·나머지. */
function villageCredit(text: string): { line: string; kenneyParts: string; rest: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.includes("`lobby-village.glb`"));
  expect(lines).toHaveLength(1);
  const line = lines[0];
  const from = line.indexOf("Fantasy Town Kit");
  const to = line.indexOf("`scripts/lobby3d/build-village.py`", from);
  expect({ from: from >= 0, to: to > from }).toEqual({ from: true, to: true });
  return { line, kenneyParts: line.slice(from, to), rest: line.slice(0, from) + line.slice(to) };
}

describe("[spec] 115 ② 자산 출처(명세 4)", () => {
  // 118(명세 6, 고칠 기존 테스트): 마을 모델 줄의 Kenney 부품에서 분수를 뺀다(분수는 WriteLoop 제작 모델 village-fountain.glb로 따로 적는다). 나머지 기대는 그대로다
  // 120(명세 6, 고칠 기존 테스트): 마을 모델 줄의 Kenney 부품에서 가로등도 뺀다(가로등은 WriteLoop 제작 모델 village-streetlamp.glb로 따로 적는다). 나머지 기대는 그대로다
  it("[바뀔] E7 CREDITS.md의 마을 모델 줄: Kenney 부품 목록에 생울타리·나무 울타리·풍차·분수·가로등이 없고, 바위·길은 그대로 있다(127: 노점은 보지 않는다)", () => {
    const { kenneyParts } = villageCredit(readFileSync(join(REPO_115_2, CREDITS_PATH_115_2), "utf8"));
    expect({
      kenneyParts,
      removed: ["생울타리", "울타리", "풍차", "분수", "가로등"].filter((w) => kenneyParts.includes(w)),
      missing: ["바위", "길"].filter((w) => !kenneyParts.includes(w))
    }).toEqual({ kenneyParts, removed: [], missing: [] });
  });

  it("[그대로] E8 CREDITS.md의 다른 것은 그대로다: 마을 모델 줄에서 Kenney 부품 목록 밖의 글과, 다른 모든 줄(차례 포함)이 기준 커밋 be29bd1과 같다", () => {
    const now = readFileSync(join(REPO_115_2, CREDITS_PATH_115_2), "utf8");
    const base = gitShow115b(BASE_115_2, CREDITS_PATH_115_2);
    expect(villageCredit(now).rest).toBe(villageCredit(base).rest);
    // 118(명세 6): 새 분수 모델 줄(village-fountain.glb)도 양쪽에서 뺀다(분수 줄은 118 qa 테스트가 본다). 120(명세 6): 새 가로등 모델 줄(village-streetlamp.glb)도 뺀다(120 qa 테스트가 본다)
    const others = (text: string) => text.split(/\r?\n/).filter((l) => !l.includes("`lobby-village.glb`") && !l.includes("WriteLoop_Tree") && !l.includes("`village-fountain.glb`") && !l.includes("`village-streetlamp.glb`") && !l.startsWith("| `shop/") && !l.startsWith("| `clothing-shop/")); // 128(가구점 실내, 03 결정 2): 가구점 모델 줄(`shop/…`)은 양쪽에서 뺀다. 116 06 결정 2: 나무 줄(A·Pine으로 바뀜)은 양쪽에서 뺀다
    expect(others(now)).toEqual(others(base));
  });
});

describe("[spec] 115 ② 옛 경계 설명(명세 5)", () => {
  it("[바뀔] E9 명세 5가 든 네 파일(lobby3d-village.tsx, village.ts, engine.ts, village-ground-splat.ts)에 옛 경계를 말하는 '풍차'·'울타리' 낱말이 없다", () => {
    const files = [
      "apps/mobile/src/components/lobby3d/lobby3d-village.tsx",
      "apps/mobile/src/lib/lobby3d/village.ts",
      "apps/mobile/src/lib/lobby3d/engine.ts",
      "apps/mobile/src/lib/lobby3d/village-ground-splat.ts"
    ];
    const found = files.flatMap((rel) =>
      readFileSync(join(REPO_115_2, rel), "utf8")
        .split(/\r?\n/)
        .map((line, i) => ({ rel, n: i + 1, line }))
        .filter((l) => /풍차|울타리/.test(l.line))
        .map((l) => `${l.rel}:${l.n}`)
    );
    expect(found).toEqual([]);
  });
});
