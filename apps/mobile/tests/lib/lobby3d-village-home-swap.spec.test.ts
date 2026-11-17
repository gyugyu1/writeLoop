/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 098 마을 라룹이 집 교체, 기능 변경, 모바일): 마을 배치 데이터와 마을 모델 파일(lobby-village.glb)에서 본 라룹이 집.
// 기대값은 명세(private 작업 폴더 098-2026-11-17-마을-라룹이-집-교체/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 95fc92f의 지금 값이다.
// 구현 전(기준 커밋)에 쓴 테스트다. 구현 코드는 부르는 방법(village.ts의 VILLAGE_BUILDINGS·VILLAGE_PLACES·VILLAGE_START·VILLAGE_SOLID_TILES·
// occludingBuildings, engine.ts의 applyArea·isFree, build-village.py가 만드는 묶음 이름)을 알려고만 읽었다.
//
// 넣을 모델(명세 1: 앱용 모델, 삼각형 1만, 색 그림 1024 한 장)에서 잰 값(저장소 밖 C:\WriteLoop-asset\마을-건물\라룹이-집\앱용\laroopi-house-app.glb와
// 창문 색만 다른 창문-불빛\laroopi-house-app-b.glb가 같다. 바뀔 수 있는 것은 창유리 색뿐이라 모양 값은 그대로다):
// - 크기 상자(모델 단위) x -48.959~48.931, y 0~76.786, z -37.603~37.618. 문은 +z 쪽.
// - 문(초록 색 그림을 읽는 앞면 자리)은 x -9.445~9.421이다. 문 가운데가 크기 상자 가운데와 0.012 단위(앱 칸으로 0.001칸) 차이라, "문 가운데가 x 35.5"를
//   마을 모델 안 집의 크기 상자 가운데 x로 본다.
// - 벽 앞면은 z 34.8 언저리, 처마 끝이 z 37.6이다(앱 칸으로 약 0.19칸 차이). 명세 3의 "앞면 z 12"가 벽 앞면인지 처마 끝인지 명세에 없어 둘 다 받는다
//   (지금 2층 집도 벽 앞면이 12이고 지붕 끝이 12.2다).
// "약 6.5칸·약 5칸"(명세 2)은 모델 비율 그대로 가로를 6.5로 하면 높이 5.10, 높이를 5로 하면 가로 6.37이 되므로 가로 6.2~6.8, 높이 4.8~5.4로 받는다.
//
// 바뀔 동작(구현 전 실패): C1~C3, C5~C10. 그대로 둘 동작(구현 전·뒤 통과): K1~K6.
// K6(명세 3 자리)은 명세의 "바뀌는 동작" 목록에 있지만 문 가운데 x 35.5·앞면 z 12를 "그대로 둔다"는 항목이라, 지금 2층 집도 통과하는 그대로 둘 동작으로 나눴다.
// 작업 100(마을 각진 집) 04 결정으로 C3에서 위 옛 모델의 크기 상자와 견주던 비율 단언을 뺐다(C3 앞 주석).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyArea, isFree } from "@/lib/lobby3d/engine";
import { VILLAGE_BUILDINGS, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START, occludingBuildings } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import {
  CREDITS_PATH,
  LAYOUT_PATH,
  REPO,
  accessorValues,
  baseFile,
  baseVillageGlb,
  boxOf,
  imageBytes,
  imageSize,
  meshNodesUnder,
  nowVillageGlb,
  rootIndex,
  sceneRoots,
  triangleCount,
  worldMatrices,
  worldPoints,
  type Glb
} from "../__fixtures__/village-glb-098";

/** 지금(기준 커밋) 라룹이 집 땅. */
const OLD_HOME_RECT = [31, 6, 40, 12] as const;
/** 넣을 모델의 삼각형 수(명세 1 "삼각형 1만"). */
const MODEL_TRIANGLES = 10000;
const DOOR_X = 35.5;
const FRONT_Z = 12;

function homeBuilding() {
  const found = VILLAGE_BUILDINGS.find((b) => b.id === "home");
  expect(found).toBeDefined();
  return found!;
}

function layoutHome() {
  const found = LAYOUT.buildings.find((b) => b.id === "home");
  expect(found).toBeDefined();
  return found!;
}

/** 마을 모델의 bld-home 묶음 아래 메시 노드들(하나는 있어야 한다). */
function homeMeshNodes(glb: Glb): number[] {
  const root = rootIndex(glb, "bld-home");
  expect(root).toBeGreaterThanOrEqual(0);
  const nodes = meshNodesUnder(glb, root);
  expect(nodes.length).toBeGreaterThan(0);
  return nodes;
}

function homePoints(glb: Glb): [number, number, number][] {
  const m = worldMatrices(glb);
  return homeMeshNodes(glb).flatMap((i) => worldPoints(glb, i, m));
}

/** 밤 불빛 판 중 창 불빛(가로등 glow-lamp-*가 아닌 glow-* 묶음)의 점들. */
function windowGlowPoints(glb: Glb): [number, number, number][] {
  const m = worldMatrices(glb);
  return sceneRoots(glb)
    .filter((i) => {
      const name = glb.json.nodes[i].name ?? "";
      return name.startsWith("glow") && !name.startsWith("glow-lamp");
    })
    .flatMap((i) => meshNodesUnder(glb, i).flatMap((n) => worldPoints(glb, n, m)));
}

/** 지금 라룹이 집 둘레(창 불빛을 찾는 곳): 옛 땅에서 1칸 넓힌 곳. */
const inHomeArea = ([x, , z]: [number, number, number]) => x >= OLD_HOME_RECT[0] - 1 && x <= OLD_HOME_RECT[2] + 1 && z >= OLD_HOME_RECT[1] - 1 && z <= OLD_HOME_RECT[3] + 1;

beforeEach(() => {
  applyArea("village");
});

afterEach(() => {
  applyArea("room");
});

describe("[spec] 098 바뀔 동작: 라룹이 집 모델·크기·땅·가리기·불빛·출처", () => {
  it("C1 집 모델(명세 1): 마을 모델에 묶음 bld-home이 하나 있고, 그 아래 메시의 삼각형이 넣을 모델과 같은 10000개다", () => {
    const glb = nowVillageGlb();
    expect(sceneRoots(glb).filter((i) => glb.json.nodes[i].name === "bld-home")).toHaveLength(1);
    const triangles = homeMeshNodes(glb).reduce((sum, i) => sum + triangleCount(glb, i), 0);
    expect(triangles).toBe(MODEL_TRIANGLES);
  });

  it("C2 집 모델(명세 1): bld-home 메시는 모두 색 그림이 있는 재질을 쓰고, 그 색 그림은 한 장이며 1024×1024다", () => {
    const glb = nowVillageGlb();
    const images = new Set<number>();
    for (const i of homeMeshNodes(glb)) {
      for (const p of glb.json.meshes[glb.json.nodes[i].mesh!].primitives) {
        expect(p.material).toBeDefined();
        const texture = glb.json.materials![p.material!].pbrMetallicRoughness?.baseColorTexture;
        expect({ node: glb.json.nodes[i].name, hasColorMap: texture !== undefined }).toEqual({ node: glb.json.nodes[i].name, hasColorMap: true });
        const source = glb.json.textures![texture!.index].source;
        expect(source).toBeDefined();
        images.add(source!);
      }
    }
    expect(images.size).toBe(1);
    const [image] = [...images];
    expect(imageSize(imageBytes(glb, image))).toEqual({ width: 1024, height: 1024 });
  });

  // 작업 100 04 결정(사용자 2026-11-17 "비율 확인만 빼기"): 옛 둥근 집의 크기 상자(모델 단위)와 견주던 "모델 비율 그대로 고르게 키웠다" 단언을 뺐다.
  // 집 모델을 각진 집으로 바꾸면 비율이 달라져서다. 넣은 모델 기준의 고르게 키움은 작업 100 qa 테스트 N2(lobby3d-village-angular-home.spec.test.ts)가 본다.
  it("C3 크기(명세 2): 마을 모델 안 집은 가로 약 6.5칸(6.2~6.8), 높이 약 5칸(4.8~5.4)이다", () => {
    const box = boxOf(homePoints(nowVillageGlb()));
    const width = box.maxX - box.minX;
    const height = box.maxY - box.minY;
    expect({ width, inRange: width >= 6.2 && width <= 6.8 }).toEqual({ width, inRange: true });
    expect({ height, inRange: height >= 4.8 && height <= 5.4 }).toEqual({ height, inRange: true });
  });

  it("C5 땅(명세 4): 배치 파일과 앱 데이터의 라룹이 집 층수가 1이다", () => {
    expect(layoutHome().floors).toBe(1);
    expect(homeBuilding().floors).toBe(1);
  });

  it("C6 땅(명세 4): 집 땅이 옛 땅 [31,6,40,12] 안에서 줄었고, 마을 모델 안 집의 바닥(높이 0.3 아래 점)을 덮는다", () => {
    const [x0, z0, x1, z1] = homeBuilding().rect;
    expect({ inside: x0 >= OLD_HOME_RECT[0] && z0 >= OLD_HOME_RECT[1] && x1 <= OLD_HOME_RECT[2] && z1 <= OLD_HOME_RECT[3] }).toEqual({ inside: true });
    const oldArea = (OLD_HOME_RECT[2] - OLD_HOME_RECT[0]) * (OLD_HOME_RECT[3] - OLD_HOME_RECT[1]);
    expect((x1 - x0) * (z1 - z0)).toBeLessThan(oldArea);
    const ground = homePoints(nowVillageGlb()).filter(([, y]) => y < 0.3);
    expect(ground.length).toBeGreaterThan(0);
    const g = boxOf(ground);
    const tol = 0.05;
    expect({ rect: [x0, z0, x1, z1], covers: g.minX >= x0 - tol && g.maxX <= x1 + tol && g.minZ >= z0 - tol && g.maxZ <= z1 + tol, ground: [g.minX, g.minZ, g.maxX, g.maxZ] }).toEqual({
      rect: [x0, z0, x1, z1],
      covers: true,
      ground: [g.minX, g.minZ, g.maxX, g.maxZ]
    });
  });

  // 가로 약 6.5칸을 문 가운데 35.5에 두면 x 32.25~38.75(6.8이면 32.1~38.9), 깊이(비율로 약 5칸)를 앞면 12에서 재면 뒤가 z 7 언저리(7.05 넘음)다.
  // 그래서 옛 땅의 왼쪽 열(x 31), 오른쪽 열(x 39), 뒷줄(z 6)은 집 밖이라 풀밭이 되고 걸어갈 수 있다(그 칸에 나무·소품은 없다).
  // 집 바닥(x 약 32.5~38.5, z 약 7.3~12)이 닿는 칸 x 32~38, z 7~11은 막힌 채다.
  it("C7 땅(명세 4): 줄어 남는 옛 땅(x 31 열, x 39 열, z 6 줄)은 걸어갈 수 있고, 집 바닥이 닿는 칸(x 32~38, z 7~11)은 막혀 있다", () => {
    const freed: string[] = [];
    for (let z = 6; z < 12; z += 1) freed.push(`31,${z}`, `39,${z}`);
    for (let x = 32; x < 39; x += 1) freed.push(`${x},6`);
    const notFree = freed.filter((k) => {
      const [c, r] = k.split(",").map(Number);
      return !isFree(c + 0.5, r + 0.5) || VILLAGE_SOLID_TILES.has(k);
    });
    expect(notFree).toEqual([]);
    const open: string[] = [];
    for (let x = 32; x < 39; x += 1) for (let z = 7; z < 12; z += 1) if (isFree(x + 0.5, z + 0.5)) open.push(`${x},${z}`);
    expect(open).toEqual([]);
  });

  it("C8 가리기(명세 5): 라룹이를 가리는지 보는 집 높이가 5칸이다(1층: 지금 계산으로 5). 집 뒷면에서 5칸 뒤는 가리고 6칸 뒤는 가리지 않는다(기울기 42도)", () => {
    const home = homeBuilding();
    expect(home.height).toBe(5);
    const back = home.rect[1];
    // 시선이 뒷면에 닿는 높이: 5칸 뒤 5 × tan42° ≈ 4.50 < 5(가림), 6칸 뒤 ≈ 5.40 > 5(가리지 않음)
    expect(occludingBuildings({ x: DOOR_X, z: back - 5 })).toEqual(["home"]);
    expect(occludingBuildings({ x: DOOR_X, z: back - 6 })).toEqual([]);
  });

  it("C9 밤 불빛(명세 6): 마을 모델의 창 불빛 판 중 라룹이 집 둘레(옛 땅에서 1칸 넓힌 곳)에 있는 점이 없다", () => {
    const near = windowGlowPoints(nowVillageGlb()).filter(inHomeArea);
    expect({ count: near.length, first: near[0] ?? null }).toEqual({ count: 0, first: null });
  });

  it("C10 출처(그 밖): CREDITS.md의 lobby-village.glb 줄이 하나이고, 라룹이 집 출처(Tripo로 만든 모델)가 들어 있다", () => {
    const lines = readFileSync(join(REPO, CREDITS_PATH), "utf8").split(/\r?\n/).filter((line) => line.includes("`lobby-village.glb`"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/라룹이.*집/);
    expect(lines[0]).toContain("Tripo");
  });
});

/** 지금(기준 커밋) 막힌 칸 중 옛 라룹이 집 땅 밖의 칸: 개수와 정렬한 "열,행" 목록(줄바꿈으로 이음)의 sha256. 기준 커밋 95fc92f에서 잰 값. */
const SOLID_OUTSIDE_HOME = { count: 654, sha256: "2ff411c1bd80d6ad2a9199e35600150da1689227232955e013a206150f62178c" };

describe("[spec] 098 그대로 둘 동작: 문 앞 자리, 다른 건물·소품, 막힌 칸, 마을 모델 묶음", () => {
  it("K6 자리(명세 3, 자리는 그대로): 집의 문 가운데(모델에서 크기 상자 가운데와 같다)가 x 35.5(±0.15)이고, 앞면이 z 12다(벽 앞면이 12면 처마 끝은 약 12.19라 11.95~12.25로 받는다)", () => {
    const box = boxOf(homePoints(nowVillageGlb()));
    const centerX = (box.minX + box.maxX) / 2;
    expect({ centerX, atDoor: Math.abs(centerX - DOOR_X) <= 0.15 }).toEqual({ centerX, atDoor: true });
    expect({ front: box.maxZ, atFront: box.maxZ >= FRONT_Z - 0.05 && box.maxZ <= FRONT_Z + 0.25 }).toEqual({ front: box.maxZ, atFront: true });
  });

  it("K1 집 문 앞 자리(라룹이가 나타나는 곳, 시작 방향)와 이름표 자리, 장소 이름이 그대로다", () => {
    const home = VILLAGE_PLACES.home;
    expect({ id: home.id, label: home.label, faceTo: home.faceTo, approach: home.approach, labelPoint: home.labelPoint }).toEqual({
      id: "home",
      label: "라룹이 집",
      faceTo: { x: 35.5, z: 12 },
      approach: [{ x: 35.5, z: 12.9 }],
      labelPoint: { x: 35.5, y: 3 * 0.92, z: 12.2 }
    });
    expect({ ...VILLAGE_START }).toEqual({ x: 35.5, z: 12.9, heading: 0 });
    expect({ door: layoutHome().door, front: homeBuilding().rect[3] }).toEqual({ door: DOOR_X, front: FRONT_Z });
  });

  it("K2 배치 파일에서 라룹이 집 말고는 기준 커밋과 같다(다른 건물 셋, 분수, 가로등, 노점, 벤치, 나무, 바위, 길, 풍차, 마을 크기). 집의 id·이름·문 자리도 같다", () => {
    const base = JSON.parse(baseFile(LAYOUT_PATH).toString("utf8")) as typeof LAYOUT;
    const strip = (layout: typeof LAYOUT) => {
      const { buildings, _comment: _ignored, ...rest } = layout as typeof LAYOUT & { _comment?: string };
      return { rest, others: buildings.filter((b) => b.id !== "home") };
    };
    expect(strip(LAYOUT)).toEqual(strip(base));
    const baseHome = base.buildings.find((b) => b.id === "home")!;
    const home = layoutHome();
    expect({ id: home.id, label: home.label, door: home.door }).toEqual({ id: baseHome.id, label: baseHome.label, door: baseHome.door });
    expect(LAYOUT.buildings.map((b) => b.id)).toEqual(base.buildings.map((b) => b.id));
  });

  it("K3 옛 라룹이 집 땅 밖의 막힌 칸이 기준 커밋과 같다(개수와 목록의 sha256)", () => {
    const outside = [...VILLAGE_SOLID_TILES]
      .filter((k) => {
        const [c, r] = k.split(",").map(Number);
        return !(c >= OLD_HOME_RECT[0] && c < OLD_HOME_RECT[2] && r >= OLD_HOME_RECT[1] && r < OLD_HOME_RECT[3]);
      })
      .sort();
    expect({ count: outside.length, sha256: createHash("sha256").update(outside.join("\n")).digest("hex") }).toEqual(SOLID_OUTSIDE_HOME);
  });

  it("K4 마을 모델 파일 이름 그대로이고, 장면 뿌리의 묶음 이름이 기준 커밋과 같다(bld-home 포함)", () => {
    const names = (glb: Glb) => sceneRoots(glb).map((i) => glb.json.nodes[i].name ?? "").sort();
    const now = names(nowVillageGlb());
    expect(now).toEqual(names(baseVillageGlb()));
    expect(now).toContain("bld-home");
  });

  // 같은 이름의 메시 노드마다 프리미티브의 삼각형 수와, 겹치지 않는 점 자리(소수 넷째 자리로 반올림) 목록의 sha256을 견준다.
  // 점 수는 보지 않는다: 구석 어둠(꼭짓점 색)을 새 집과 함께 다시 구우면 집 둘레 점의 색이 바뀌어, 내보내기가 점을 나누는 수가 달라질 수 있다(모양은 같다).
  // 재질 번호도 집 재질이 더해져 밀릴 수 있어 보지 않는다.
  // 창 불빛 판(glow-windows)은 집 둘레 밖의 점 자리(소수 넷째 자리)를 견준다.
  it("K5 집 말고 다른 묶음(건물 셋, 소품, 길, 생울타리, 울타리, 풍차, 나무 틀, 가로등 불빛)의 메시가 기준 커밋과 같고, 집 밖 창 불빛 판도 그대로다", () => {
    const now = nowVillageGlb();
    const base = baseVillageGlb();
    const describeMeshes = (glb: Glb) => {
      const out: Record<string, unknown> = {};
      for (const root of sceneRoots(glb)) {
        const rootName = glb.json.nodes[root].name ?? "";
        if (rootName === "bld-home" || (rootName.startsWith("glow") && !rootName.startsWith("glow-lamp"))) continue;
        for (const i of meshNodesUnder(glb, root)) {
          const node = glb.json.nodes[i];
          const prims = glb.json.meshes[node.mesh!].primitives.map((p) => {
            const a = glb.json.accessors[p.attributes.POSITION];
            const tris = (p.indices !== undefined ? glb.json.accessors[p.indices].count : a.count) / 3;
            const points = [...new Set(accessorValues(glb, p.attributes.POSITION).map((v) => v.map((n) => (Math.round(n * 1e4) / 1e4).toFixed(4)).join(",")))].sort();
            return `${tris}/${points.length}/${createHash("sha256").update(points.join("\n")).digest("hex")}`;
          });
          out[`${rootName} > ${node.name ?? i}`] = [...prims].sort();
        }
      }
      return out;
    };
    expect(describeMeshes(now)).toEqual(describeMeshes(base));
    const glowsOutside = (glb: Glb) =>
      windowGlowPoints(glb)
        .filter((p) => !inHomeArea(p))
        .map((p) => p.map((n) => (Math.round(n * 1e4) / 1e4).toFixed(4)).join(","))
        .sort();
    const baseGlows = glowsOutside(base);
    expect(baseGlows.length).toBeGreaterThan(0);
    expect(glowsOutside(now)).toEqual(baseGlows);
  });
});

