/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 100 마을 각진 집, 기능 변경, 모바일): 마을의 라룹이 집을 각진 벽돌집 모델로 바꾸고 집 땅을 앞뒤로 조금 늘린다.
// 기대값은 명세(private 작업 폴더 100-2026-11-17-마을-각진-집/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 fcd7e6d의 지금 값이다.
// 구현 전(기준 커밋)에 쓴 테스트다. 구현 코드는 부르는 방법(village.ts의 VILLAGE_BUILDINGS·VILLAGE_SOLID_TILES, build-village.py의 place_model이
// 집을 놓는 방법, 마을 모델의 묶음 이름 bld-home)을 알려고만 읽었다.
//
// 넣을 모델(명세 1, 저장소 밖 C:\WriteLoop-asset\마을-건물\라룹이-집\단계\07-앱용-불빛\laroopi-house-angular-app.glb, sha256 0d08a7b8…)에서 잰 값.
// 테스트는 저장소 밖 파일을 읽지 않는다(CI에는 없다). 값만 옮겨 적었다:
// - 메시 하나, 프리미티브 하나, 삼각형 10000, 색 그림 한 장(JPEG 1024, 188146바이트, sha256 아래 NEW_COLOR_MAP_SHA256).
//   옛 집(098)에서 마을 모델 안 집의 색 그림 바이트가 넣은 모델의 그림 바이트와 sha256까지 같았다(Blender 내보내기가 JPEG를 그대로 싣는다).
// - 크기 상자(모델 단위) 가로 0.98108, 높이 0.746, 깊이 0.81757 → 가로:높이 1.31512, 가로:깊이 1.20000.
// - build-village.py의 place_model 방식(벽 둘레 = 높이 1/4 아래 점, 벽 가로를 땅 가로 6에 맞춰 고르게 키움)으로 놓으면
//   벽 가로 6, 벽 깊이 4.986, 높이 4.907이다(명세 2 "벽 깊이 약 4.99칸", "높이는 약 4.9칸"). 벽 앞면을 z 12에 두면 벽 뒷면은 z 7.014다.
//
// 바뀔 동작(구현 전 실패): N1~N6. 그대로 둘 동작(구현 전·뒤 통과): S1~S4.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE_BUILDINGS, VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import {
  CREDITS_PATH,
  LAYOUT_PATH,
  REPO,
  boxOf,
  imageBytes,
  meshNodesUnder,
  nowVillageGlb,
  rootIndex,
  triangleCount,
  worldMatrices,
  worldPoints,
  type Glb
} from "../__fixtures__/village-glb-098";

/** 작업 100의 기준 커밋(명세 첫 줄). */
const BASE = "fcd7e6d";
const baseText = (path: string) => execFileSync("git", ["show", `${BASE}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString("utf8").replace(/\r\n/g, "\n");
const nowText = (path: string) => readFileSync(join(REPO, path), "utf8").replace(/\r\n/g, "\n");
const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

const SCRIPT_PATH = "scripts/lobby3d/build-village.py";
/** 명세 1의 넣을 모델 경로(스크립트 머리말에 적을 경로). */
const NEW_MODEL_PATH = "C:\\WriteLoop-asset\\마을-건물\\라룹이-집\\단계\\07-앱용-불빛\\laroopi-house-angular-app.glb";
/** 지금 머리말에 적힌 옛 경로(2026-11-17 폴더 정리로 없어졌다). */
const OLD_MODEL_PATH_TAIL = "창문-불빛\\laroopi-house-app-b.glb";
/** 넣을 모델의 색 그림(JPEG 1024) 바이트의 sha256. */
const NEW_COLOR_MAP_SHA256 = "6deb7265d547cc158e73fa8859282bf9200e88bbc7bc0cda2c27704bb5a96c4d";
/** 넣을 모델의 크기 상자 비율. */
const NEW_MODEL_RATIO = { widthToHeight: 0.9810789823532104 / 0.7459999918937683, widthToDepth: 0.9810789823532104 / 0.81756591796875 };
/** 명세 2의 새 집 땅. */
const NEW_HOME_RECT = [32.5, 7.0, 38.5, 12];
const DOOR_X = 35.5;
const FRONT_Z = 12;
/** 막힌 칸(개수와 정렬한 "열,행" 목록을 줄바꿈으로 이은 것의 sha256). 099 qa 테스트 K4가 기준 커밋 1144c47에서 잰 값이고, fcd7e6d까지 배치 파일은 그대로다. */
const SOLID = { count: 689, sha256: "f2c256b91d2a666df265b1c7f71e8103e4bbd33cde4a122094ea94d46682166b" };

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

/** 마을 모델 안 집의 크기 상자와, build-village.py와 같은 뜻의 벽 둘레(바닥에서 높이 1/4 아래 점)의 상자. */
function homeShape() {
  const points = homePoints(nowVillageGlb());
  const box = boxOf(points);
  const wall = boxOf(points.filter(([, y]) => y - box.minY < (box.maxY - box.minY) / 4));
  return { box, wall };
}

/** 스크립트 머리말(맨 앞의 # 줄들)과 그 뒤 코드로 나눈다. */
function splitScript(text: string) {
  const lines = text.split("\n");
  const firstCode = lines.findIndex((line) => !line.startsWith("#"));
  return { header: lines.slice(0, firstCode).join("\n"), code: lines.slice(firstCode).join("\n") };
}

/** CREDITS.md에서 lobby-village.glb 줄(하나여야 한다). */
function villageCreditLine(text: string): string {
  const lines = text.split("\n").filter((line) => line.includes("`lobby-village.glb`"));
  expect(lines).toHaveLength(1);
  return lines[0];
}

describe("[spec] 100 바뀔 동작: 각진 집 모델, 땅, 스크립트 머리말, 출처", () => {
  it("N1 집 모델(명세 1): 마을 모델의 bld-home은 넣을 각진 집이다. 삼각형 10000개이고, 쓰는 색 그림 한 장의 바이트가 넣을 모델의 색 그림과 같다", () => {
    const glb = nowVillageGlb();
    const nodes = homeMeshNodes(glb);
    expect(nodes.reduce((sum, i) => sum + triangleCount(glb, i), 0)).toBe(10000);
    const images = new Set<number>();
    for (const i of nodes) {
      for (const p of glb.json.meshes[glb.json.nodes[i].mesh!].primitives) {
        const texture = glb.json.materials![p.material!].pbrMetallicRoughness?.baseColorTexture;
        expect(texture).toBeDefined();
        images.add(glb.json.textures![texture!.index].source!);
      }
    }
    expect(images.size).toBe(1);
    const [image] = [...images];
    expect(sha256(imageBytes(glb, image))).toBe(NEW_COLOR_MAP_SHA256);
  });

  it("N2 집 모델(명세 1, 지금처럼 고르게 키움): 마을 모델 안 집의 크기 상자 비율이 넣을 모델과 1% 안에서 같다(가로:높이 1.31512, 가로:깊이 1.20000)", () => {
    const { box } = homeShape();
    const width = box.maxX - box.minX;
    const widthToHeight = width / (box.maxY - box.minY);
    const widthToDepth = width / (box.maxZ - box.minZ);
    const near = (got: number, want: number) => Math.abs(got / want - 1) <= 0.01;
    expect({ widthToHeight, same: near(widthToHeight, NEW_MODEL_RATIO.widthToHeight) }).toEqual({ widthToHeight, same: true });
    expect({ widthToDepth, same: near(widthToDepth, NEW_MODEL_RATIO.widthToDepth) }).toEqual({ widthToDepth, same: true });
  });

  it("N3 크기(명세 2): 벽 가로는 6칸(땅 가로, ±0.01), 벽 깊이는 약 4.99칸(4.97~5.01), 높이는 약 4.9칸(4.85~4.95)이고 가리기 계산 높이 5칸을 넘지 않는다", () => {
    const { box, wall } = homeShape();
    const wallWidth = wall.maxX - wall.minX;
    const wallDepth = wall.maxZ - wall.minZ;
    const height = box.maxY - box.minY;
    expect({ wallWidth, ok: Math.abs(wallWidth - 6) <= 0.01 }).toEqual({ wallWidth, ok: true });
    expect({ wallDepth, ok: wallDepth >= 4.97 && wallDepth <= 5.01 }).toEqual({ wallDepth, ok: true });
    expect({ height, ok: height >= 4.85 && height <= 4.95 }).toEqual({ height, ok: true });
    expect(homeBuilding().height).toBe(5);
    expect(height).toBeLessThanOrEqual(homeBuilding().height);
  });

  it("N4 땅(명세 2): 배치 파일과 앱 데이터의 라룹이 집 땅이 [32.5, 7.0, 38.5, 12]이고, 벽 뒷면이 새 땅 뒤 z 7.0 언저리(6.98~7.05)다", () => {
    expect(layoutHome().rect).toEqual(NEW_HOME_RECT);
    expect([...homeBuilding().rect]).toEqual(NEW_HOME_RECT);
    const { wall } = homeShape();
    expect({ back: wall.minZ, ok: wall.minZ >= 6.98 && wall.minZ <= 7.05 }).toEqual({ back: wall.minZ, ok: true });
  });

  it("N5 스크립트(명세 1): build-village.py 머리말의 집 모델 경로가 새 파일이고, 옛 경로는 없다", () => {
    const { header } = splitScript(nowText(SCRIPT_PATH));
    expect(header).toContain(NEW_MODEL_PATH);
    expect(header).not.toContain(OLD_MODEL_PATH_TAIL);
  });

  it("N6 출처 기록(명세 3): CREDITS.md의 lobby-village.glb 줄이 라룹이 집을 각진 벽돌집으로 적고(라룹이 집·Tripo 출처 그대로), 그 줄의 Kenney 부분과 라이선스 칸, 다른 줄은 기준 커밋과 같다", () => {
    const now = nowText(CREDITS_PATH);
    const base = baseText(CREDITS_PATH);
    const line = villageCreditLine(now);
    const cells = line.split("|");
    const baseCells = villageCreditLine(base).split("|");
    expect(cells).toHaveLength(baseCells.length);
    expect(cells[2]).toMatch(/각진[^|.]*벽돌집/);
    expect(cells[2]).toMatch(/라룹이 집/);
    expect(cells[2]).toContain("Tripo");
    // 라룹이 집 설명 앞(Kenney 부품·스크립트·밤 불빛 판)은 그대로다
    const kenneyPart = "밤 불빛 판은 새로 만들었다.";
    const baseKenney = baseCells[2].slice(0, baseCells[2].indexOf(kenneyPart) + kenneyPart.length);
    expect(baseKenney.length).toBeGreaterThan(kenneyPart.length);
    expect(cells[2].startsWith(baseKenney)).toBe(true);
    expect([cells[0], cells[1], cells[3], cells[4]]).toEqual([baseCells[0], baseCells[1], baseCells[3], baseCells[4]]);
    const others = (text: string) => text.split("\n").filter((l) => !l.includes("`lobby-village.glb`"));
    expect(others(now)).toEqual(others(base));
  });
});

describe("[spec] 100 그대로 둘 동작: 집 자리, 배치 파일, 막힌 칸, 스크립트 코드", () => {
  it("S1 집 자리(명세 2 \"문 가운데 x 35.5와 앞면 z 12\"): 벽 가로 가운데가 x 35.5(±0.01), 벽 앞면이 z 12(±0.01)이고, 배치 파일의 문 자리 35.5·땅 앞 12·층수 1이다", () => {
    const { wall } = homeShape();
    const centerX = (wall.minX + wall.maxX) / 2;
    expect({ centerX, ok: Math.abs(centerX - DOOR_X) <= 0.01 }).toEqual({ centerX, ok: true });
    expect({ front: wall.maxZ, ok: Math.abs(wall.maxZ - FRONT_Z) <= 0.01 }).toEqual({ front: wall.maxZ, ok: true });
    const home = layoutHome();
    expect({ door: home.door, front: home.rect[3], floors: home.floors, model: home.model }).toEqual({ door: DOOR_X, front: FRONT_Z, floors: 1, model: "laroopi-house" });
  });

  it("S2 배치 파일에서 라룹이 집 땅(rect) 말고는 기준 커밋과 같다(집의 id·이름·층수·모델·문, 다른 건물, 분수·가로등·나무·길·풍차·마을 크기 등)", () => {
    type Layout = typeof LAYOUT & { _comment?: string };
    const strip = (layout: Layout) => ({
      ...layout,
      buildings: layout.buildings.map((b) => (b.id === "home" ? { ...b, rect: "home-rect" } : b))
    });
    const base = JSON.parse(baseText(LAYOUT_PATH)) as Layout;
    expect(strip(LAYOUT as Layout)).toEqual(strip(base));
  });

  it("S3 막힌 칸은 바뀌지 않는다(명세 2: 땅 z 7.0과 7.4 모두 z 7 줄부터 막는다): 개수 689와 목록의 sha256이 기준 커밋 값과 같다", () => {
    const solid = [...VILLAGE_SOLID_TILES].sort();
    expect({ count: solid.length, sha256: sha256(solid.join("\n")) }).toEqual(SOLID);
  });

  it("S4 스크립트(명세 1 \"지금처럼 집 모델을 인자로 받아 땅에 맞춰 놓는다\"): build-village.py에서 머리말(맨 앞 # 줄들) 뒤의 코드는 기준 커밋과 같다(줄 끝 말고)", () => {
    const now = splitScript(nowText(SCRIPT_PATH)).code;
    const base = splitScript(baseText(SCRIPT_PATH)).code;
    expect(base).toContain("def place_model(b, path):");
    expect(sha256(now)).toBe(sha256(base));
  });
});
