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
// N6은 작업 113(새 나무 모델 넣기) 15-main-decision.md 결정 1(사용자 2026-11-18 "3MB 받아들이고 qa가 고침")으로 qa가 다시 고쳤다: 113 명세 13대로
// CREDITS.md에 새 나무 줄(파일 칸 `trees/WriteLoop_Tree_A_LOD1.glb` 외 다섯)을 더하므로, 파일 칸에 새 나무 GLB 이름이 든 표 줄도 더해진 새 모델 줄로 허용한다.
// 나머지 단언(마을 모델 줄, 기준 커밋 줄이 차례대로 남음, 그 밖에 더해진 줄은 새 모델 파일 한 줄)은 그대로다.
// N6은 작업 101(마을 땅 무늬) 11 결정(사용자 2026-11-17 "N6을 고침 (추천)")으로 qa가 고쳤다. 작업 101이 새 모델(village-flowers.glb)을 넣으며
// 모델마다 출처를 적는 규칙대로 CREDITS.md에 그 줄을 더하므로, "다른 줄은 기준 커밋과 같다" 대신 "기준 커밋의 다른 줄은 차례 그대로 모두 있고,
// 더해진 줄은 기준 커밋에 없던 모델 파일(.glb/.gltf)의 표 줄뿐이다"로 본다. lobby-village.glb 줄에 대한 단언은 그대로다.
// 작업 106(마을 가게 넣기) 명세의 "그 때문에 고칠 기존 테스트"와 바뀌는 동작 3-1로 qa가 고쳤다(106 qa 보고 02-qa-tests.md).
// 106은 라룹이 집을 나무 프레임 집 모델(C:\WriteLoop-asset\마을-건물\라룹이-집\단계\09-나무-프레임\laroopi-house-angular-app3.glb)로 바꾸고
// 땅 가로를 4칸으로 줄여(문 x 35.5·땅 앞 z 12 그대로, 깊이는 모델 비율로 약 3.3칸) 집 전체를 2/3로 줄이며, 카페·도서관·길·나무·가구점도 바꾼다.
// 그 모델에서 잰 값은 tests/__fixtures__/village-shops-106.ts 머리말에 있다(크기 상자 비율은 이 파일의 옛 모델과 같다: 가로:높이 1.31512, 가로:깊이 1.20000).
// - N1: 삼각형 10000·옛 색 그림 → 10852·나무 프레임 집의 색 그림(sha256 HOME_MODEL.colorMapSha256). N2(비율)는 그대로다.
// - N3: 벽 가로 6·깊이 약 4.99·높이 약 4.9 → 벽 가로 4(±0.01)·깊이 3.3242(3.30~3.35)·높이 3.2712(3.24~3.30). 가리기 높이 5 이하는 그대로다.
// - N4: 땅 [32.5, 7.0, 38.5, 12] → 가로 4칸·땅 앞 z 12·깊이 약 3.3칸(3.0~3.6)이고, 벽 뒷면이 땅 뒤 z0 언저리(±0.1)다.
// - N5: 머리말의 집 모델 경로 → 나무 프레임 집 경로(qa 가정: 100이 정한 "머리말에 넣을 집 모델 경로를 적는다"를 그대로 따른다. 106 명세에는 머리말 말이 없다).
// - S2: 집 땅 말고 → 106이 바꾸는 건물·길·나무 말고(집의 땅 밖 값과 가구점의 id·이름·땅·층수는 그대로 본다).
// - S3: 막힌 칸 전체 → 106이 바꾸는 곳 밖의 막힌 칸(106 기준 커밋 c728f00에서 잰 개수·sha256).
// - N6(106 03-main-decision.md, 사용자 2026-11-18 "고치고 N6도 고침 (추천)"): 106이 CREDITS.md의 lobby-village.glb 줄을 실제대로 고친다
//   (Kenney는 소품·길·울타리·풍차, 건물 셋은 WriteLoop이 Tripo로 만든 모델). 그래서 "라룹이 집을 각진 벽돌집으로 적고 Kenney 부분·나머지 칸이 기준 커밋과 같다" 대신
//   "마을 모델 줄이 하나이고 Kenney와 CC0, 건물 셋(라룹이 집·가구점·옷집)이 적혀 있다"로 본다. 다른 줄은 기준 커밋 그대로 차례대로 있고 더해진 줄은 새 모델 파일의
//   출처 줄뿐이라는 단언(101 11 결정)은 그대로다.
// - S4(스크립트 코드가 기준 커밋과 같다)는 뺐다: 106이 가게 모델을 놓으려고 스크립트를 고친다. 집을 땅에 맞춰 놓는 방법은 N3·S1(벽 가로 = 땅 가로, 벽 가운데·앞면)이 본다.
// 작업 107(라룹이 집 크기) 명세의 "그 때문에 고칠 기존 테스트"(100 테스트 가운데 106에서 2/3 크기로 고친 집 크기)와 바뀌는 동작 1
// (땅 가로 4칸 → 5칸, 깊이 약 4.2칸(z0 약 7.8), 집 전체 1.25배)로 qa가 N3·N4를 고쳤다(107 qa 보고 02-qa-tests.md). 값은 tests/__fixtures__/village-home-size-107.ts.
// - N3: 벽 가로 4(±0.01)·깊이 3.3242(3.30~3.35)·높이 3.2712(3.24~3.30) → 1.25배: 벽 가로 5(±0.01)·깊이 4.1553(4.13~4.18)·높이 4.0890(4.06~4.12).
//   가리기 높이 5 이하는 그대로다.
// - N4: 가로 4칸·깊이 약 3.3칸(3.0~3.6) → 가로 5칸·깊이 약 4.2칸(4.1~4.3). 땅 앞 z 12, 벽 뒷면이 땅 뒤 z0 언저리(±0.1)는 그대로다.
// 작업 114(마을 벤치 모델) 명세의 "고칠 기존 테스트"(벤치 방향 rot, 벤치 막히는 칸)로 qa가 S2·S3을 고쳤다(114 qa 보고 02-qa-tests.md).
// 벤치 말고 다른 것의 기대는 그대로다(도우미·값은 tests/__fixtures__/village-bench-114.ts):
// - S2: 배치 파일을 견줄 때 벤치의 rot만 뺀다(벤치 자리는 그대로 본다).
// - S3: 견주는 칸에서 벤치가 바꿀 수 있는 곳(지금 벤치 칸과 새 벤치 칸)도 뺀다. 기대값은 587개 목록에서 지금 벤치 칸 12개를 뺀 575개(114 기준 커밋 d256ff4에서 잰 값).
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(풍차, 바위, 사각형 가장자리 막힌 칸)로 qa가 S2·S3을 고쳤다(115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md).
// 경계·풍차·빠지는 나무·바위 말고 다른 것의 기대는 그대로다(도우미·값은 tests/__fixtures__/village-boundary-115.ts):
// - S2: 배치 파일을 견줄 때 양쪽에서 풍차와 경계 원 열쇠를 빼고, 바위는 원 안의 것만 둔다(withoutBoundary115. 나무는 이 테스트가 원래 보지 않는다).
// - S3: 견주는 칸에서 115가 바꾸는 곳(원 밖, 사각형 가장자리 줄, 빠지는 나무·바위 칸)도 뺀다. 기대값은 115 기준 커밋 de49aef에서 잰 값(169개).
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
import { HOME_FRONT_Z, HOME_MODEL } from "../__fixtures__/village-shops-106";
import { HOME_DEPTH_107, HOME_NEAR_107, HOME_WIDTH_107 } from "../__fixtures__/village-home-size-107";
import { BENCH_TILE_RECTS, withoutBenchRot } from "../__fixtures__/village-bench-114";
import { SOLID_OUTSIDE_CHANGED_115, solidOutsideChanged115, withoutBoundary115 } from "../__fixtures__/village-boundary-115";

/** 작업 100의 기준 커밋(명세 첫 줄). */
const BASE = "fcd7e6d";
const baseText = (path: string) => execFileSync("git", ["show", `${BASE}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString("utf8").replace(/\r\n/g, "\n");
const nowText = (path: string) => readFileSync(join(REPO, path), "utf8").replace(/\r\n/g, "\n");
const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

const SCRIPT_PATH = "scripts/lobby3d/build-village.py";
/** 명세 1의 넣을 모델 경로(스크립트 머리말에 적을 경로). 106 명세 3-1의 나무 프레임 집 경로로 고쳤다. */
const NEW_MODEL_PATH = "C:\\WriteLoop-asset\\마을-건물\\라룹이-집\\단계\\09-나무-프레임\\laroopi-house-angular-app3.glb";
/** 옛 경로(106 전에 머리말에 적혀 있던 100의 각진 벽돌집). */
const OLD_MODEL_PATH_TAIL = "07-앱용-불빛\\laroopi-house-angular-app.glb";
/** 넣을 모델의 색 그림(JPEG 1024) 바이트의 sha256(106: 나무 프레임 집). */
const NEW_COLOR_MAP_SHA256 = HOME_MODEL.colorMapSha256;
/** 넣을 모델의 크기 상자 비율. */
const NEW_MODEL_RATIO = { widthToHeight: 0.9810789823532104 / 0.7459999918937683, widthToDepth: 0.9810789823532104 / 0.81756591796875 };
const DOOR_X = 35.5;
const FRONT_Z = 12;
/** 막힌 칸 가운데 106이 바꾸는 곳 밖의 칸(개수와 정렬한 "열,행" 목록을 줄바꿈으로 이은 것의 sha256). 106 기준 커밋 c728f00에서 잰 값. */
// { count: 587, sha256: "a261d8ba50c1bf7ef47178706c1f74c5d952842b04c545454301b92038299651" }. 114에서 벤치가 바꿀 수 있는 곳도 빼서 SOLID_OUTSIDE_CHANGED_114(village-bench-114.ts)로 견준다.

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
  it("N1 집 모델(명세 1, 106 명세 3-1): 마을 모델의 bld-home은 넣을 나무 프레임 집이다. 삼각형 10852개이고, 쓰는 색 그림 한 장의 바이트가 넣을 모델의 색 그림과 같다", () => {
    const glb = nowVillageGlb();
    const nodes = homeMeshNodes(glb);
    expect(nodes.reduce((sum, i) => sum + triangleCount(glb, i), 0)).toBe(HOME_MODEL.triangles);
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

  it("N3 크기(107 명세 1): 벽 가로는 5칸(땅 가로, ±0.01), 벽 깊이는 약 4.16칸(4.13~4.18), 높이는 약 4.09칸(4.06~4.12)이고 가리기 계산 높이 5칸을 넘지 않는다", () => {
    const { box, wall } = homeShape();
    const wallWidth = wall.maxX - wall.minX;
    const wallDepth = wall.maxZ - wall.minZ;
    const height = box.maxY - box.minY;
    expect({ wallWidth, ok: Math.abs(wallWidth - HOME_WIDTH_107) <= 0.01 }).toEqual({ wallWidth, ok: true });
    expect({ wallDepth, ok: wallDepth >= 4.13 && wallDepth <= 4.18 }).toEqual({ wallDepth, ok: true });
    expect({ height, ok: height >= 4.06 && height <= 4.12 }).toEqual({ height, ok: true });
    expect(homeBuilding().height).toBe(5);
    expect(height).toBeLessThanOrEqual(homeBuilding().height);
  });

  it("N4 땅(107 명세 1): 배치 파일과 앱 데이터의 라룹이 집 땅이 같고 가로 5칸·땅 앞 z 12·깊이 약 4.2칸(4.1~4.3)이며, 벽 뒷면이 새 땅 뒤 z0 언저리(±0.1)다", () => {
    const [x0, z0, x1, z1] = homeBuilding().rect;
    expect([...layoutHome().rect]).toEqual([x0, z0, x1, z1]);
    expect({ width: x1 - x0, front: z1 }).toEqual({ width: HOME_WIDTH_107, front: HOME_FRONT_Z });
    expect({ depth: z1 - z0, ok: Math.abs(z1 - z0 - HOME_DEPTH_107) <= HOME_NEAR_107 }).toEqual({ depth: z1 - z0, ok: true });
    const { wall } = homeShape();
    expect({ back: wall.minZ, z0, ok: Math.abs(wall.minZ - z0) <= 0.1 }).toEqual({ back: wall.minZ, z0, ok: true });
  });

  it("N5 스크립트(명세 1): build-village.py 머리말의 집 모델 경로가 새 파일이고, 옛 경로는 없다", () => {
    const { header } = splitScript(nowText(SCRIPT_PATH));
    expect(header).toContain(NEW_MODEL_PATH);
    expect(header).not.toContain(OLD_MODEL_PATH_TAIL);
  });

  it("N6 출처 기록(106 03 결정): CREDITS.md의 lobby-village.glb 줄이 하나이고 Kenney와 CC0, 건물 셋(라룹이 집·가구점·옷집)이 적혀 있으며, 다른 줄은 기준 커밋 그대로 차례대로 있고 더해진 줄은 새 모델 파일의 출처 줄뿐이다", () => {
    const now = nowText(CREDITS_PATH);
    const base = baseText(CREDITS_PATH);
    const line = villageCreditLine(now);
    const missing = ["Kenney", "CC0", "라룹이 집", "가구점", "옷집"].filter((word) => !line.includes(word));
    expect({ line, missing }).toEqual({ line, missing: [] });
    const others = (text: string) => text.split("\n").filter((l) => !l.includes("`lobby-village.glb`"));
    // 기준 커밋의 다른 줄은 차례 그대로 모두 있고, 그 사이에 더해진 줄은 기준 커밋에 없던 모델 파일의 표 줄(| `이름.glb` | 출처 | 라이선스 |)뿐이다
    const baseLines = others(base);
    const baseFiles = new Set([...base.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]));
    const added: string[] = [];
    let at = 0;
    for (const l of others(now)) {
      if (at < baseLines.length && l === baseLines[at]) at += 1;
      else added.push(l);
    }
    expect({ missingFromBase: baseLines.slice(at) }).toEqual({ missingFromBase: [] });
    // 113: 파일 칸이 새 나무 GLB 이름(`…WriteLoop_Tree_<A·B·C>_LOD<1·2>.glb`)으로 시작하는 표 줄도 새 모델 줄로 본다
    const isTreeRow = (l: string) => /^\| `[^`]*WriteLoop_Tree_[ABC]_LOD[12]\.glb`[^|]*\|[^|]*\S[^|]*\|[^|]*\S[^|]*\|$/.test(l);
    const notNewModelRow = added.filter((l) => {
      if (isTreeRow(l)) return false;
      const m = /^\| `([^`]+\.(?:glb|gltf))` \|[^|]*\S[^|]*\|[^|]*\S[^|]*\|$/.exec(l);
      return !m || baseFiles.has(m[1]);
    });
    expect(notNewModelRow).toEqual([]);
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

  it("S2 배치 파일에서 106이 바꾸는 건물·길·나무와 집 땅(rect) 말고는 기준 커밋과 같다(집의 id·이름·층수·모델·문, 가구점의 id·이름·땅·층수, 분수·가로등·풍차·마을 크기 등)", () => {
    type Layout = typeof LAYOUT & { _comment?: string };
    const strip = (layout: Layout) => {
      // 114: 벤치의 rot은 보지 않는다(벤치 자리는 본다). 115: 풍차·경계 원 열쇠를 빼고 바위는 원 안의 것만 본다
      const { buildings, paths: _p, trees: _t, ...rest } = withoutBoundary115(withoutBenchRot(layout));
      const home = buildings.find((b) => b.id === "home");
      const shop = buildings.find((b) => b.id === "furnitureShop");
      return {
        rest,
        home: home ? { ...home, rect: "home-rect" } : null,
        shop: shop ? { id: shop.id, label: shop.label, rect: shop.rect, floors: shop.floors } : null
      };
    };
    const base = JSON.parse(baseText(LAYOUT_PATH)) as Layout;
    const now = strip(LAYOUT as Layout);
    const before = strip(base);
    expect({ ...now, rest: { ...now.rest, _comment: undefined } }).toEqual({ ...before, rest: { ...before.rest, _comment: undefined } });
  });

  it("S3 막힌 칸 가운데 106이 바꾸는 곳(옛 라룹이 집·카페·도서관·옷집 땅, 옮긴 나무) 밖은 바뀌지 않는다: 개수 587과 목록의 sha256이 기준 커밋 값과 같다", () => {
    expect(VILLAGE_SOLID_TILES.size).toBeGreaterThan(0);
    // 114: 벤치가 바꿀 수 있는 곳도 빼고 견준다(587개 목록에서 지금 벤치 칸 12개를 뺀 575개)
    // 115: 원 밖·사각형 가장자리 줄·빠지는 나무·바위 칸도 빼고 견준다(115 전 기대값 { count: 575, sha256: "354f2cce…" })
    expect(solidOutsideChanged115([...BENCH_TILE_RECTS])).toEqual(SOLID_OUTSIDE_CHANGED_115);
  });
});
