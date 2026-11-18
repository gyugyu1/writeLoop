/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 107 라룹이 집 크기, 기능 변경, 모바일): 마을의 라룹이 집 땅을 가로 4칸에서 5칸으로 늘리고 마을 모델을 다시 굽는다.
// 기대값은 명세(private 작업 폴더 107-2026-11-18-라룹이-집-크기/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 c4b7693의 지금 값이다.
// 구현 전(기준 커밋)에 쓴 테스트다. 구현 코드는 부르는 방법(village.ts의 VILLAGE_BUILDINGS·VILLAGE_PLACES·VILLAGE_SOLID_TILES·VILLAGE_START·
// occludingBuildings, engine.ts의 applyArea·isFree·markInfo, village-layout.json, build-village.py의 place_model이 모델을 땅에 맞춰 놓는 방법과
// 마을 모델의 묶음 이름 bld-home)을 알려고만 읽었다. 값과 도우미는 tests/__fixtures__/village-home-size-107.ts(머리말에 잰 값).
//
// 바뀔 동작(구현 전 실패): H1~H5. 그대로 둘 동작(구현 전·뒤 통과): K1~K4.
// 집 모델(나무 프레임 집)이 그대로인지는 H4(기준 커밋의 집 점을 1.25배한 것과 같은 모양)와 작업 100 N1·098 C1(삼각형 수·색 그림)이 본다.
// 가리기 반투명·유리(106)는 106 qa 테스트(lobby3d-village-home-model·lobby3d-village-shops-glass)가 본다.
// 작업 114(마을 벤치 모델) 명세의 "고칠 기존 테스트"(벤치 방향 rot, 벤치 막히는 칸, 마을 모델 안 벤치 모양)로 qa가 K1·K2·K4를 고쳤다(114 qa 보고 02-qa-tests.md).
// 114는 배치 파일의 두 벤치 rot과 벤치가 막는 칸을 바꾸고, 마을 모델의 Kenney 벤치를 새 벤치 모델로 바꾼다. 벤치 말고 다른 것의 기대는 그대로다
// (도우미·값은 tests/__fixtures__/village-bench-114.ts):
// - K1: 배치 파일을 견줄 때 벤치의 rot만 뺀다(벤치 자리는 그대로 본다).
// - K2: 견주는 칸에서 벤치가 바꿀 수 있는 곳(지금 벤치 칸과 새 벤치 칸)도 뺀다. 기대값은 624개 목록에서 지금 벤치 칸 12개를 뺀 것(114 기준 커밋 d256ff4에서 잰 값).
// - K4: 소품 묶음에서 벤치 조각(점이 모두 벤치 둘레 상자 안인 프리미티브)만 빼고 견준다.
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(풍차, 마을 나무·바위 수와 자리, 사각형 가장자리 막힌 칸, 마을 모델 묶음)로 qa가 K1·K2·K4를 고쳤다
// (115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md). 경계·풍차·빠지는 나무·바위 말고 다른 것의 기대는 그대로다(도우미·값은 tests/__fixtures__/village-boundary-115.ts):
// - K1: 배치 파일을 견줄 때 양쪽에서 풍차와 경계 원 열쇠를 빼고, 나무는 원 가운데까지 24.5 안, 바위는 원 안의 것만 둔다(withoutBoundary115).
// - K2: 견주는 칸에서 115가 바꾸는 곳(원 밖, 사각형 가장자리 줄, 빠지는 나무·바위 칸)도 뺀다. 기대값은 115 기준 커밋 de49aef에서 잰 값(206개).
// - K4: 장면 뿌리 이름에서 빠지는 묶음(생울타리·울타리·풍차·풍차 날개)을 빼고, 소품 묶음에서 빠지는 바위 다섯의 삼각형을 뺀 뒤 견준다(withoutBoundaryGlb115).
import { applyArea, isFree, markInfo } from "@/lib/lobby3d/engine";
import { VILLAGE_BUILDINGS, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START, occludingBuildings } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { nowVillageGlb, triangleCount, meshNodesUnder, rootIndex, type Glb } from "../__fixtures__/village-glb-098";
import { describeGroups, rectTiles, sha256 } from "../__fixtures__/village-shops-106";
import { BENCH_TILE_RECTS, withoutBenchPrimitives, withoutBenchRot } from "../__fixtures__/village-bench-114";
import { SOLID_OUTSIDE_HOME_107_115, inKeepRegion115, rootNamesKept115, withoutBoundary115, withoutBoundaryGlb115 } from "../__fixtures__/village-boundary-115";
import {
  HOME_DEPTH_107,
  HOME_DOOR_X_107,
  HOME_FRONT_Z_107,
  HOME_NEAR_107,
  HOME_SCALE_107,
  HOME_TILES_RECT_107,
  HOME_WIDTH_107,
  HOME_WIDTH_BEFORE_106,
  HOME_WIDTH_NOW,
  HOME_X0_107,
  HOME_X1_107,
  HOME_Z0_107,
  baseLayout107,
  baseVillageGlb107,
  homeBuilding107,
  homePoints107,
  homeShape107,
  layoutHome107,
  uniquePoints,
  unmatchedPoints
} from "../__fixtures__/village-home-size-107";
import { withoutFountainAndLanternsGlb120 } from "../__fixtures__/village-streetlamp-120";

/** 막힌 칸 가운데 새 집 땅이 막는 칸(x 33~37, z 7~11) 밖의 칸: 개수와 정렬한 "열,행" 목록(줄바꿈으로 이음)의 sha256. 기준 커밋 c4b7693에서 이 테스트의 계산으로 잰 값. */
// { count: 624, sha256: "dbe5207c552fb6ccd93b85f2c40dbfb155f3852f6e1eaa72f5b16f1ea34fb4ea" }. 114에서 벤치가 바꿀 수 있는 곳도 빼서 SOLID_OUTSIDE_HOME_107_114(village-bench-114.ts)로 견준다.

const tileFree = (t: string) => {
  const [c, r] = t.split(",").map(Number);
  return !VILLAGE_SOLID_TILES.has(t) && isFree(c + 0.5, r + 0.5);
};
const sorted = (s: Iterable<string>) => [...s].sort();

function homeTriangles(glb: Glb): number {
  const root = rootIndex(glb, "bld-home");
  expect(root).toBeGreaterThanOrEqual(0);
  return meshNodesUnder(glb, root).reduce((sum, i) => sum + triangleCount(glb, i), 0);
}

beforeEach(() => {
  applyArea("village");
});

afterEach(() => {
  applyArea("room");
});

describe("[spec] 107 바뀔 동작: 라룹이 집 땅과 마을 모델 안 집 크기", () => {
  it("H1 땅(명세 1): 배치 파일과 앱 데이터의 라룹이 집 땅이 같고 [33, z0, 38, 12]다. 가로 5칸(지금 4칸보다 크고 106 전 6칸보다 작다), 깊이 약 4.2칸(4.1~4.3), z0 약 7.8(7.7~7.9), 문 x 35.5", () => {
    const home = homeBuilding107();
    const [x0, z0, x1, z1] = home.rect;
    expect([...layoutHome107().rect]).toEqual([x0, z0, x1, z1]);
    expect({ x0, x1, z1, doorX: home.doorX }).toEqual({ x0: HOME_X0_107, x1: HOME_X1_107, z1: HOME_FRONT_Z_107, doorX: HOME_DOOR_X_107 });
    expect({ width: x1 - x0, between: x1 - x0 > HOME_WIDTH_NOW && x1 - x0 < HOME_WIDTH_BEFORE_106 }).toEqual({ width: HOME_WIDTH_107, between: true });
    expect({ z0, near: Math.abs(z0 - HOME_Z0_107) <= HOME_NEAR_107 }).toEqual({ z0, near: true });
    expect({ depth: z1 - z0, near: Math.abs(z1 - z0 - HOME_DEPTH_107) <= HOME_NEAR_107 }).toEqual({ depth: z1 - z0, near: true });
  });

  it("H2 막힌 칸(명세 1의 땅): 집 칸 x 33~37, z 7~11(25칸)은 모두 걸어갈 수 없고, 그 둘레(x 32 열·x 38 열의 z 6~11, z 6 줄의 x 32~38)는 걸어갈 수 있다", () => {
    const home = sorted(rectTiles([HOME_TILES_RECT_107]));
    expect(home).toHaveLength(25);
    expect(home.filter(tileFree)).toEqual([]);
    const ring: string[] = [];
    for (let z = 6; z < 12; z += 1) ring.push(`32,${z}`, `38,${z}`);
    for (let x = 33; x < 38; x += 1) ring.push(`${x},6`);
    expect(ring.filter((t) => !tileFree(t))).toEqual([]);
  });

  it("H3 마을 모델 안 집 크기(명세 1·2): 벽 가로 5칸(±0.01), 벽 가로 가운데 x 35.5(±0.01), 벽 앞면 z 12(±0.01), 벽 깊이 약 4.16칸(4.13~4.18), 벽 뒷면이 땅 뒤 z0 언저리(±0.1), 높이 약 4.09칸(4.06~4.12)이고 가리기 계산 높이 5칸을 넘지 않는다", () => {
    const { box, wall } = homeShape107(nowVillageGlb());
    const wallWidth = wall.maxX - wall.minX;
    const centerX = (wall.minX + wall.maxX) / 2;
    const wallDepth = wall.maxZ - wall.minZ;
    const height = box.maxY - box.minY;
    expect({ wallWidth, ok: Math.abs(wallWidth - HOME_WIDTH_107) <= 0.01 }).toEqual({ wallWidth, ok: true });
    expect({ centerX, ok: Math.abs(centerX - HOME_DOOR_X_107) <= 0.01 }).toEqual({ centerX, ok: true });
    expect({ front: wall.maxZ, ok: Math.abs(wall.maxZ - HOME_FRONT_Z_107) <= 0.01 }).toEqual({ front: wall.maxZ, ok: true });
    expect({ wallDepth, ok: wallDepth >= 4.13 && wallDepth <= 4.18 }).toEqual({ wallDepth, ok: true });
    const z0 = homeBuilding107().rect[1];
    expect({ back: wall.minZ, z0, ok: Math.abs(wall.minZ - z0) <= 0.1 }).toEqual({ back: wall.minZ, z0, ok: true });
    expect({ height, ok: height >= 4.06 && height <= 4.12 }).toEqual({ height, ok: true });
    expect(homeBuilding107().height).toBe(5);
    expect(height).toBeLessThanOrEqual(5);
  });

  it("H4 집 전체가 1.25배(명세 1, 집 모델 그대로): 마을 모델 안 집의 점 자리가 기준 커밋 집의 점 자리를 (x 35.5, 바닥 0, z 12)를 가운데로 1.25배한 것과 0.002칸 안에서 서로 모두 맞고, 겹치지 않는 점 수와 삼각형 수가 같다", () => {
    const base = baseVillageGlb107();
    const now = nowVillageGlb();
    const k = HOME_SCALE_107;
    const expected = uniquePoints(homePoints107(base)).map(([x, y, z]): [number, number, number] => [HOME_DOOR_X_107 + (x - HOME_DOOR_X_107) * k, y * k, HOME_FRONT_Z_107 + (z - HOME_FRONT_Z_107) * k]);
    const got = uniquePoints(homePoints107(now));
    expect({ points: got.length, triangles: homeTriangles(now) }).toEqual({ points: expected.length, triangles: homeTriangles(base) });
    expect(unmatchedPoints(expected, got, 0.002)).toEqual({ count: 0, first: [] });
    expect(unmatchedPoints(got, expected, 0.002)).toEqual({ count: 0, first: [] });
  });

  it("H5 가리기(지금 규칙 그대로, 새 땅에 따라): 새 땅 왼쪽 끝 x 33에 몸이 걸치는 집 뒤 자리(x 32.8, z 6.5. 지금 땅 x 33.5에는 걸치지 않는다)에 서면 라룹이 집이 가린다", () => {
    expect(tileFree("32,6")).toBe(true);
    expect(occludingBuildings({ x: 32.8, z: 6.5 })).toEqual(["home"]);
  });
});

describe("[spec] 107 그대로 둘 동작: 배치 파일, 막힌 칸, 장소, 마을 모델의 집 밖 묶음", () => {
  it("K1 배치 파일에서 라룹이 집 땅(rect) 말고는 기준 커밋과 같다(집의 id·이름·층수 1·모델·문 35.5, 가구점·옷집 전체, 길, 나무, 분수·가로등·노점·벤치·바위·풍차·마을 크기). 설명(_comment)은 보지 않는다", () => {
    type Layout = typeof LAYOUT & { _comment?: string };
    const strip = (layout: Layout) => {
      // 114: 벤치의 rot은 보지 않는다(벤치 자리는 본다). 115: 풍차·경계 원 열쇠를 빼고 나무·바위는 남는 것만 본다
      const { _comment: _c, buildings, ...rest } = withoutBoundary115(withoutBenchRot(layout));
      return { ...rest, buildings: buildings.map((b) => (b.id === "home" ? { ...b, rect: "home-rect" } : b)) };
    };
    expect(strip(LAYOUT as Layout)).toEqual(strip(baseLayout107()));
    const home = layoutHome107();
    expect({ id: home.id, label: home.label, floors: home.floors, model: home.model, door: home.door }).toEqual({ id: "home", label: "라룹이 집", floors: 1, model: "laroopi-house", door: 35.5 });
  });

  it("K2 막힌 칸 가운데 새 집 칸(x 33~37, z 7~11) 밖은 기준 커밋과 같다(개수 624와 목록의 sha256. 114: 벤치가 바꿀 수 있는 곳도 빼서 612. 115: 원 밖·가장자리 줄·빠지는 나무·바위 칸도 빼서 206)", () => {
    const region = rectTiles([HOME_TILES_RECT_107, ...BENCH_TILE_RECTS]);
    // 115: 115가 바꾸는 곳 밖(inKeepRegion115)만 본다(115 전 기대값 { count: 612, sha256: "2d68c371…" })
    const outside = sorted(VILLAGE_SOLID_TILES).filter((t) => !region.has(t) && inKeepRegion115(t));
    expect({ count: outside.length, sha256: sha256(outside.join("\n")) }).toEqual(SOLID_OUTSIDE_HOME_107_115);
  });

  it("K3 장소 셋(문 앞 자리·바라볼 곳·이름표)과 라룹이가 나타나는 자리, 집 말풍선('집으로 들어갈까?', '들어가기')이 그대로다", () => {
    expect(VILLAGE_PLACES).toEqual({
      home: { id: "home", label: "라룹이 집", faceTo: { x: 35.5, z: 12 }, approach: [{ x: 35.5, z: 12.9 }], labelPoint: { x: 35.5, y: 3 * 0.92, z: 12.2 } },
      furnitureShop: { id: "furnitureShop", label: "가구점", faceTo: { x: 13, z: 31 }, approach: [{ x: 13, z: 31.9 }], labelPoint: { x: 13, y: 3 * 0.92, z: 31.2 } },
      clothingShop: { id: "clothingShop", label: "옷집", faceTo: { x: 49.2, z: 22 }, approach: [{ x: 49.2, z: 22.9 }], labelPoint: { x: 49.2, y: 3 * 0.92, z: 22.2 } }
    });
    expect({ ...VILLAGE_START }).toEqual({ x: 35.5, z: 12.9, heading: 0 });
    const info = markInfo("home");
    expect({ prompt: info.prompt, buttonLabel: info.buttonLabel }).toEqual({ prompt: "집으로 들어갈까?", buttonLabel: "들어가기" });
    expect(VILLAGE_BUILDINGS.map((b) => b.id)).toEqual(["home", "furnitureShop", "clothingShop"]);
  });

  it("K4 마을 모델(lobby-village.glb)에서 장면 뿌리 묶음 이름이 기준 커밋과 같고, bld-home 밖 묶음(가구점·옷집, 길, 소품, 생울타리, 울타리, 풍차, 나무 틀, 불빛 판)의 메시(삼각형 수·점 자리)가 기준 커밋과 같다", () => {
    const now = nowVillageGlb();
    const base = baseVillageGlb107();
    // 115: 빠지는 묶음(생울타리·울타리·풍차·풍차 날개)은 양쪽에서 뺀다
    expect(rootNamesKept115(now)).toEqual(rootNamesKept115(base));
    const keep = (name: string) => name !== "bld-home";
    // 114: 소품 묶음의 벤치 조각만 빼고 견준다. 115: 빠지는 묶음과 소품의 빠지는 바위 삼각형도 뺀다
    // 118: 마을 모델에서 옛 Kenney 분수가 빠진다(명세 바뀌는 동작 1). 양쪽에서 옛 분수 삼각형(소품 묶음, 가운데에서 1.7칸 안)을 뺀 뒤 견준다
    const baseMeshes = describeGroups(withoutFountainAndLanternsGlb120(withoutBenchPrimitives(withoutBoundaryGlb115(base))), keep);
    expect(Object.keys(baseMeshes).length).toBeGreaterThan(0);
    expect(describeGroups(withoutFountainAndLanternsGlb120(withoutBenchPrimitives(withoutBoundaryGlb115(now))), keep)).toEqual(baseMeshes);
  });
});
