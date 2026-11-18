/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 114 마을 벤치 모델, 기능 변경, 모바일): 마을의 두 벤치를 새 벤치 모델(WriteLoop 제작)로 바꾸고, 배치 파일의 벤치 방향과
// 벤치가 막는 칸을 새 모양에 맞춘다.
// 기대값은 명세(private 작업 폴더 114-2026-11-18-마을-벤치-모델/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 d256ff4의 지금 값이다.
// 구현 전(기준 커밋)에 쓴 테스트다. 구현 코드는 부르는 방법(village.ts의 VILLAGE_SOLID_TILES, village-layout.json의 benches, build-village.py가 벤치를
// props 묶음에 놓고 묶음마다 메시 하나로 합치는 것, 머리말의 --model 줄)을 알려고만 읽었다.
// 새 벤치 모델에서 잰 값과 도우미는 tests/__fixtures__/village-bench-114.ts(머리말). 저장소 밖 모델 파일은 읽지 않는다.
//
// 바뀔 동작(구현 전 실패): B1~B8. 그대로 둘 동작(구현 전·뒤 통과): K1~K4.
// 가정(02-qa-tests.md "가정"):
// - B1: 명세 2는 rot 값을 적지 않았다. 두 벤치가 같은 방향(앞을 봄)이고 가로(x)로 기니, 두 rot이 같고 90의 홀수 배가 아니다(0 또는 ±180)로 본다
//   (village.ts·build-village.py의 rot: ±90이면 가로세로가 바뀐다).
// - B3: 새 벤치 그림이 마을 모델에 바이트 그대로 실린다고 본다(작업 100 N1: Blender 내보내기가 넣은 모델의 그림을 그대로 싣는다).
// - B8: 출처 줄에서 Kenney 부품 목록은 "Fantasy Town Kit" 뒤부터 처음 나오는 `scripts/lobby3d/build-village.py` 앞까지의 글로 본다(지금 줄의 짜임).
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(풍차, 마을 나무·바위 수와 자리, 사각형 가장자리 막힌 칸, 마을 모델 묶음)로 qa가 K2~K4를 고쳤다
// (115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md). 경계·풍차·빠지는 나무·바위 말고 다른 것의 기대는 그대로다(도우미·값은 tests/__fixtures__/village-boundary-115.ts):
// - K2: 배치 파일을 견줄 때 양쪽에서 풍차와 경계 원 열쇠를 빼고, 나무는 원 가운데까지 24.5 안, 바위는 원 안의 것만 둔다(withoutBoundary115).
// - K3: 견주는 칸에서 115가 바꾸는 곳(원 밖, 사각형 가장자리 줄, 빠지는 나무·바위 칸)도 뺀다. 기대값은 115 기준 커밋 de49aef에서 잰 값(231개).
// - K4: 장면 뿌리 이름에서 빠지는 묶음(생울타리·울타리·풍차·풍차 날개)을 빼고, 소품 묶음에서 빠지는 바위 다섯의 삼각형을 뺀 뒤 견준다(withoutBoundaryGlb115).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE_SOLID_TILES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { REPO, boxOf, imageBytes, imageSize, nowVillageGlb, parseGlb, type Glb } from "../__fixtures__/village-glb-098";
import { describeGroups, gitShow, VILLAGE_GLB_PATH_106 } from "../__fixtures__/village-shops-106";
import {
  BACKREST_BEHIND,
  BACKREST_Y,
  BASE_114,
  BENCH_MODEL,
  BENCH_MODEL_PATH,
  BENCH_NEW_TILES,
  BENCH_OLD_ONLY_TILES,
  BENCH_SIZE,
  BENCH_SPOTS,
  BENCH_TOL,
  CREDITS_PATH_114,
  SCRIPT_PATH_114,
  baseLayout114,
  inBenchArea,
  primitiveImage,
  propsPrimitives,
  sha256,
  solidOutsideBench,
  withoutBenchPrimitives,
  withoutBenchRot,
  type Layout,
  type PropsPrimitive
} from "../__fixtures__/village-bench-114";
import { SOLID_OUTSIDE_BENCH_115, inKeepRegion115, rootNamesKept115, withoutBoundary115, withoutBoundaryGlb115 } from "../__fixtures__/village-boundary-115";
import { withoutFountainGlb118 } from "../__fixtures__/village-fountain-118";

const nowText = (path: string) => readFileSync(join(REPO, path), "utf8").replace(/\r\n/g, "\n");
const isBenchMaterial = (name: string) => name.startsWith(BENCH_MODEL.materialName);
const baseVillageGlb114 = (): Glb => parseGlb(gitShow(BASE_114, VILLAGE_GLB_PATH_106));

/** 소품 묶음의 새 벤치 재질 조각들. */
function benchPrimitives(glb: Glb): PropsPrimitive[] {
  return propsPrimitives(glb).filter((p) => isBenchMaterial(p.material));
}

/** 새 벤치 재질 조각의 삼각형을 무게중심 x로 두 벤치(분수 왼쪽 32, 오른쪽 39)에 나눈 점들과 삼각형 수. */
function benchesByTriangle(glb: Glb): { points: [number, number, number][]; triangles: number }[] {
  const split = (BENCH_SPOTS[0].x + BENCH_SPOTS[1].x) / 2;
  const out = BENCH_SPOTS.map(() => ({ points: [] as [number, number, number][], triangles: 0 }));
  for (const p of benchPrimitives(glb)) {
    for (const tri of p.triangles) {
      const pts = tri.map((i) => p.points[i]);
      const side = pts.reduce((s, q) => s + q[0], 0) / 3 < split ? 0 : 1;
      out[side].triangles += 1;
      out[side].points.push(...pts);
    }
  }
  return out;
}

/** 스크립트 머리말(맨 앞의 # 줄들)과 그 뒤 코드. */
function splitScript(text: string) {
  const lines = text.split("\n");
  const firstCode = lines.findIndex((line) => !line.startsWith("#"));
  return { header: lines.slice(0, firstCode).join("\n"), code: lines.slice(firstCode).join("\n") };
}

describe("[spec] 114 바뀔 동작: 배치 파일의 벤치 방향과 막히는 칸(명세 2·3)", () => {
  it("B1 배치 파일의 두 벤치 rot이 새 방향에 맞다: 두 벤치가 같은 방향(앉는 쪽이 앞)이라 rot이 같고, 가로(x)로 길어 90의 홀수 배가 아니다", () => {
    const rots = LAYOUT.benches.map((b) => b.rot);
    expect(rots).toHaveLength(2);
    const horizontal = rots.map((r) => Math.abs(r) % 180 === 0);
    expect({ rots, same: rots[0] === rots[1], horizontal }).toEqual({ rots, same: true, horizontal: [true, true] });
  });

  it("B2 막히는 칸이 새 벤치 모양(벤치 가운데에서 가로 약 2.3 × 세로 약 0.9)을 따른다: x 30~33·37~40의 z 22 칸이 막히고, 지금 벤치만 막던 z 21·23 칸(x 31·32·38·39)은 막히지 않는다", () => {
    const notSolid = BENCH_NEW_TILES.filter((t) => !VILLAGE_SOLID_TILES.has(t));
    const stillSolid = BENCH_OLD_ONLY_TILES.filter((t) => VILLAGE_SOLID_TILES.has(t));
    expect({ notSolid, stillSolid }).toEqual({ notSolid: [], stillSolid: [] });
  });
});

describe("[spec] 114 바뀔 동작: 마을 모델의 새 벤치(명세 1·4)", () => {
  it("B3 소품 묶음(props)에 새 벤치 재질(Village_Bench_Painted_Timber) 조각이 있고, 그 삼각형이 벤치 둘 몫(2110 × 2)이며 벤치마다 2110개다. 그 재질의 그림은 새 벤치 그림(PNG 1024×1024, 바이트 그대로)이다", () => {
    const glb = nowVillageGlb();
    const prims = benchPrimitives(glb);
    expect({ materials: prims.map((p) => p.material) }).toEqual({ materials: expect.arrayContaining([expect.stringMatching(/^Village_Bench_Painted_Timber/)]) });
    const total = prims.reduce((s, p) => s + p.triangles.length, 0);
    expect({ total, perBench: benchesByTriangle(glb).map((b) => b.triangles) }).toEqual({ total: BENCH_MODEL.triangles * 2, perBench: [BENCH_MODEL.triangles, BENCH_MODEL.triangles] });
    const images = [...new Set(prims.map((p) => primitiveImage(glb, p.prim)))];
    expect(images).toHaveLength(1);
    const bytes = imageBytes(glb, images[0]);
    expect({ mimeType: glb.json.images![images[0]].mimeType, size: imageSize(bytes), sha256: sha256(bytes) }).toEqual({
      mimeType: BENCH_MODEL.atlas.mimeType,
      size: { width: BENCH_MODEL.atlas.width, height: BENCH_MODEL.atlas.height },
      sha256: BENCH_MODEL.atlasSha256
    });
  });

  it("B4 Kenney 벤치는 쓰지 않는다: 소품 묶음에서 벤치 둘레(벤치 가운데에서 x ±1.4, z ±0.8)에 세 점이 모두 드는 삼각형은 모두 새 벤치 재질이다", () => {
    const glb = nowVillageGlb();
    const others: Record<string, number> = {};
    for (const p of propsPrimitives(glb)) {
      if (isBenchMaterial(p.material)) continue;
      const inside = p.triangles.filter((tri) => tri.every((i) => inBenchArea(p.points[i]))).length;
      if (inside > 0) others[p.material || "(재질 없음)"] = inside;
    }
    expect(others).toEqual({});
  });

  it("B5 벤치마다 자리·크기(명세 1): 가로(x)로 길게 놓여 길이 약 2.22(1.3배)·깊이 약 0.9·등받이 꼭대기 약 1.28이고, 바닥에 닿으며(y 0), 자리는 그대로 (32, 22.5)·(39, 22.5)다", () => {
    const benches = benchesByTriangle(nowVillageGlb());
    BENCH_SPOTS.forEach((spot, i) => {
      expect({ spot, points: benches[i].points.length > 0 }).toEqual({ spot, points: true });
      const box = boxOf(benches[i].points);
      const got = {
        length: +(box.maxX - box.minX).toFixed(4),
        depth: +(box.maxZ - box.minZ).toFixed(4),
        top: +box.maxY.toFixed(4),
        floor: +box.minY.toFixed(4),
        centerX: +((box.minX + box.maxX) / 2).toFixed(4),
        centerZ: +((box.minZ + box.maxZ) / 2).toFixed(4)
      };
      const ok = {
        length: Math.abs(got.length - BENCH_SIZE.length) <= BENCH_TOL.size,
        depth: Math.abs(got.depth - BENCH_SIZE.depth) <= BENCH_TOL.size,
        top: Math.abs(got.top - BENCH_SIZE.height) <= BENCH_TOL.height,
        floor: Math.abs(got.floor) <= BENCH_TOL.floor,
        centerX: Math.abs(got.centerX - spot.x) <= BENCH_TOL.x,
        centerZ: Math.abs(got.centerZ - spot.z) <= BENCH_TOL.z
      };
      expect({ spot, got, ok }).toEqual({ spot, got, ok: { length: true, depth: true, top: true, floor: true, centerX: true, centerZ: true } });
    });
  });

  it("B6 벤치마다 방향(명세 1): 앉는 쪽이 화면 쪽(+z, 앞)을 보고 등받이가 뒤(-z)다: 높이 0.91(원본 0.7의 1.3배) 넘는 점(등받이 윗부분)이 모두 그 벤치 크기 상자 가운데보다 0.15칸 넘게 뒤에 있다", () => {
    const benches = benchesByTriangle(nowVillageGlb());
    BENCH_SPOTS.forEach((spot, i) => {
      const box = boxOf(benches[i].points);
      const centerZ = (box.minZ + box.maxZ) / 2;
      const high = benches[i].points.filter(([, y]) => y > BACKREST_Y);
      const frontMost = high.length ? Math.max(...high.map(([, , z]) => z)) : null;
      expect({ spot, high: high.length > 0, behind: frontMost !== null && frontMost < centerZ - BACKREST_BEHIND, frontMost, centerZ }).toEqual({
        spot,
        high: true,
        behind: true,
        frontMost,
        centerZ
      });
    });
  });

  it("B7 마을 모델 스크립트(명세 4): 머리말에 벤치 모델 줄(bench=저장소 밖 경로)이 있고, 코드는 Kenney 벤치(stall-bench)를 놓지 않는다", () => {
    const { header, code } = splitScript(nowText(SCRIPT_PATH_114));
    expect({ header: header.includes(`bench=${BENCH_MODEL_PATH}`) }).toEqual({ header: true });
    expect({ kenneyBench: code.includes("stall-bench") }).toEqual({ kenneyBench: false });
  });

  it("B8 자산 출처(명세 5): CREDITS.md의 lobby-village.glb 줄이 하나이고, Kenney 부품 목록에 벤치가 없으며, 벤치는 WriteLoop 제작 모델로 적혀 있다(줄에 벤치와 WriteLoop이 있다)", () => {
    const lines = nowText(CREDITS_PATH_114).split("\n").filter((l) => l.includes("`lobby-village.glb`"));
    expect(lines).toHaveLength(1);
    const line = lines[0];
    const from = line.indexOf("Fantasy Town Kit");
    const to = line.indexOf("`scripts/lobby3d/build-village.py`", from);
    expect({ from: from >= 0, to: to > from }).toEqual({ from: true, to: true });
    const kenneyParts = line.slice(from, to);
    const rest = line.slice(0, from) + line.slice(to);
    expect({ kenneyParts, benchInKenney: kenneyParts.includes("벤치"), benchElsewhere: rest.includes("벤치"), writeLoop: rest.includes("WriteLoop") }).toEqual({
      kenneyParts,
      benchInKenney: false,
      benchElsewhere: true,
      writeLoop: true
    });
  });
});

describe("[spec] 114 그대로 둘 동작: 벤치 자리, 배치 파일, 다른 막힌 칸, 마을 모델의 다른 것", () => {
  it("K1 벤치는 둘이고 자리가 그대로다: (32, 22.5)·(39, 22.5)(분수 좌우)", () => {
    expect(LAYOUT.benches.map((b) => ({ x: b.x, z: b.z }))).toEqual(BENCH_SPOTS);
  });

  it("K2 배치 파일에서 벤치의 rot(과 설명 _comment) 말고는 기준 커밋과 같다(마을 크기, 건물, 분수, 가로등, 노점, 벤치 자리, 나무, 풍차, 바위, 길)", () => {
    const strip = (layout: Layout) => {
      // 115: 풍차·경계 원 열쇠를 빼고 나무·바위는 남는 것만 본다
      const { _comment: _c, ...rest } = withoutBoundary115(withoutBenchRot(layout));
      return rest;
    };
    expect(strip(LAYOUT as Layout)).toEqual(strip(baseLayout114()));
  });

  it("K3 막힌 칸 가운데 벤치가 바꿀 수 있는 곳(지금 벤치 칸과 새 벤치 칸) 밖은 기준 커밋과 같다(개수와 목록의 sha256)", () => {
    // 115: 115가 바꾸는 곳 밖(inKeepRegion115)만 본다(115 전 기대값 { count: 637, sha256: "b5de6266…" })
    const outside = solidOutsideBench().filter(inKeepRegion115);
    expect({ count: outside.length, sha256: sha256(outside.join("\n")) }).toEqual(SOLID_OUTSIDE_BENCH_115);
  });

  // 묶음마다 메시 노드의 프리미티브(삼각형 수/겹치지 않는 점 자리 수/점 자리 sha256)를 견준다(106 도우미 describeGroups). 소품에서는 벤치 조각만 뺀다.
  // 점 수는 겹치지 않는 자리로 센다: 구석 어둠(꼭짓점 색)을 다시 구우면 내보내기가 점을 나누는 수가 달라질 수 있다.
  it("K4 마을 모델의 장면 뿌리 묶음 이름이 기준 커밋과 같고, 벤치 조각 말고 모든 묶음(건물·유리·불빛·소품의 분수·가로등·노점·바위·길·생울타리·울타리·풍차·옛 나무 틀)의 메시가 기준 커밋과 같다(115: 빠지는 생울타리·울타리·풍차와 원 밖 바위는 뺀다)", () => {
    const now = nowVillageGlb();
    const base = baseVillageGlb114();
    // 115: 빠지는 묶음(생울타리·울타리·풍차·풍차 날개)은 양쪽에서 빼고, 소품 묶음의 빠지는 바위 삼각형도 뺀다
    expect(rootNamesKept115(now)).toEqual(rootNamesKept115(base));
    const all = () => true;
    // 118: 마을 모델에서 옛 Kenney 분수가 빠진다(명세 바뀌는 동작 1). 양쪽에서 옛 분수 삼각형(소품 묶음, 가운데에서 1.7칸 안)을 뺀 뒤 견준다
    const baseMeshes = describeGroups(withoutFountainGlb118(withoutBenchPrimitives(withoutBoundaryGlb115(base))), all);
    expect(Object.keys(baseMeshes).length).toBeGreaterThan(0);
    expect(describeGroups(withoutFountainGlb118(withoutBenchPrimitives(withoutBoundaryGlb115(now))), all)).toEqual(baseMeshes);
  });
});
