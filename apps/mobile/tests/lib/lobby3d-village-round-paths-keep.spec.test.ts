/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 099 마을 길 둥글게, 기능 변경, 모바일): 길을 둥글게 그려도 그대로여야 할 마을 데이터와 파일.
// 기대값은 명세(private 작업 폴더 099-2026-11-17-마을-길-둥글게/01-main-spec.md "그대로여야 할 동작"과 바뀌는 동작 1·3)에서 가져오고,
// 값은 기준 커밋 1144c47의 지금 값이다(막힌 칸 목록의 sha256은 기준 커밋에서 이 테스트의 계산으로 잰 값).
// 구현 코드는 부르는 방법(village.ts의 VILLAGE·VILLAGE_SOLID_TILES·VILLAGE_PLACES·VILLAGE_START)을 알려고만 읽었다.
// 모두 그대로 둘 동작이다(구현 전·뒤 통과): K4~K7.
// K7은 작업 100(마을 각진 집) 02 결정(사용자 2026-11-17 "진행해": 명세의 "그 때문에 고칠 기존 테스트")으로 qa가 고쳤다. 작업 100은 마을 모델의
// 라룹이 집(bld-home)과 build-village.py 머리말을 일부러 바꾸므로, 파일 전체가 같은지 대신 099의 뜻(둥근 길 작업이 마을 모델의 집 밖 묶음과
// 스크립트 코드를 바꾸지 않음)만 본다: 집 밖 묶음의 메시와 머리말 뒤의 스크립트 코드가 기준 커밋과 같다.
// 작업 106(마을 가게 넣기) 명세의 "그 때문에 고칠 기존 테스트"(카페·도서관 건물·장소·길, 가구점 문 x·모델 방식을 보는 테스트)로 qa가 K4~K7을 고쳤다
// (106 qa 보고 02-qa-tests.md). 106은 카페·도서관과 그 길을 빼고, 옷집을 넣고, 가구점 문을 옮기고, 라룹이 집 땅을 줄이고, 나무 한 그루를 옮기며,
// 마을 모델의 건물을 모델로 바꾸고 스크립트를 고친다. 그래서 099의 뜻(둥근 길 작업이 걷기·장소·길 칸·마을 모델을 바꾸지 않음)을 106이 바꾸지 않는 곳에서만 본다:
// - K4: 막힌 칸 전체 → 106이 바꾸는 곳(옛 라룹이 집·카페·도서관·옷집 땅, 옮긴 나무) 밖의 막힌 칸(106 기준 커밋 c728f00에서 잰 개수·sha256).
// - K5: 장소 넷 → 라룹이 집 장소 전체와, 가구점 장소의 x(문 x, 106이 옮긴다) 밖 값. 카페·도서관 장소는 뺐다.
// - K6: paths 전체 → 106이 빼는 길 칸 밖의 길 칸이 기준 커밋과 같다.
// - K7: 집 밖 묶음 → 106이 바꾸는 묶음(건물 bld-*, 창 불빛 판, 옛 길 조각 paths) 밖의 묶음. 스크립트 코드가 같은지는 뺐다(106이 스크립트를 고친다).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VILLAGE, VILLAGE_PLACES, VILLAGE_SOLID_TILES, VILLAGE_START } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { meshNodesUnder, parseGlb, sceneRoots, worldMatrices, worldPoints, type Glb } from "../__fixtures__/village-glb-098";
import { REMOVED_PATH_RECTS, changedBy106, rectTiles, solidOutsideChanged, type Rect } from "../__fixtures__/village-shops-106";

const REPO = join(__dirname, "..", "..", "..", "..");
/** 작업 099의 기준 커밋(명세 첫 줄). */
const BASE = "1144c47";
const baseFile = (path: string) => execFileSync("git", ["show", `${BASE}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

describe("[spec] 099 그대로 둘 동작: 마을 데이터와 파일", () => {
  it("K4 걸어갈 수 없는 칸 가운데 106이 바꾸는 곳 밖이 기준 커밋과 같다(마을 크기 70×60, 그 칸 587개와 목록의 sha256). 길은 걷기에 영향을 주지 않는다", () => {
    expect({ width: VILLAGE.width, depth: VILLAGE.depth }).toEqual({ width: 70, depth: 60 });
    expect(VILLAGE_SOLID_TILES.size).toBeGreaterThan(0);
    expect(solidOutsideChanged()).toEqual({
      count: 587,
      sha256: "a261d8ba50c1bf7ef47178706c1f74c5d952842b04c545454301b92038299651"
    });
  });

  it("K5 라룹이 집 장소(문 앞 자리·바라볼 곳·이름표 자리)와 라룹이가 나타나는 자리, 가구점 장소의 x(문 x, 106이 옮긴다) 밖 값이 기준 커밋과 같다", () => {
    const places = JSON.parse(JSON.stringify(VILLAGE_PLACES)) as Record<string, { faceTo: { x: number; z: number } }>;
    expect(places.home).toEqual({ id: "home", label: "라룹이 집", faceTo: { x: 35.5, z: 12 }, approach: [{ x: 35.5, z: 12.9 }], labelPoint: { x: 35.5, y: 2.7600000000000002, z: 12.2 } });
    const shop = places.furnitureShop;
    expect(shop).toBeDefined();
    const x = shop.faceTo.x;
    expect(shop).toEqual({ id: "furnitureShop", label: "가구점", faceTo: { x, z: 31 }, approach: [{ x, z: 31.9 }], labelPoint: { x, y: 2.7600000000000002, z: 31.2 } });
    expect({ ...VILLAGE_START }).toEqual({ x: 35.5, z: 12.9, heading: 0 });
  });

  it("K6 길 칸은 지금처럼 배치 파일의 paths 사각형들에서 나온다: 106이 빼는 길 칸 밖의 길 칸이 기준 커밋과 같다", () => {
    const base = JSON.parse(baseFile("apps/mobile/src/lib/lobby3d/village-layout.json").toString("utf8")) as { paths: number[][] };
    const removed = rectTiles(REMOVED_PATH_RECTS);
    const kept = (paths: number[][]) => [...rectTiles(paths as unknown as Rect[])].filter((t) => !removed.has(t)).sort();
    expect(kept(base.paths).length).toBeGreaterThan(0);
    expect(kept(LAYOUT.paths as unknown as number[][])).toEqual(kept(base.paths));
  });

  // 같은 이름의 메시 노드마다 프리미티브의 삼각형 수와, 겹치지 않는 점 자리(세계 좌표, 소수 넷째 자리) 목록의 sha256을 견준다.
  // 점 수와 재질 번호는 보지 않는다: 구석 어둠(꼭짓점 색)을 새 집과 함께 다시 구우면 집 둘레 점의 색이 바뀌어 내보내기가 점을 나누는 수가
  // 달라질 수 있고, 집 재질이 바뀌면 재질 번호가 밀릴 수 있다(098 qa 테스트 K5와 같은 방식).
  it("K7 마을 모델 파일(lobby-village.glb)에서 106이 바꾸는 묶음(건물 bld-*, 창 불빛 판, 옛 길 조각 paths) 밖 묶음의 메시가 기준 커밋과 같다(그 묶음들의 장면 뿌리 이름도 같다)", () => {
    const glb = "apps/mobile/assets/models/lobby-village.glb";
    const now = parseGlb(readFileSync(join(REPO, glb)));
    const base = parseGlb(baseFile(glb));
    const rootNames = (g: Glb) => sceneRoots(g).map((i) => g.json.nodes[i].name ?? "").filter((name) => !changedBy106(name)).sort();
    expect(rootNames(now)).toEqual(rootNames(base));
    const describeMeshes = (g: Glb) => {
      const m = worldMatrices(g);
      const out: Record<string, { triangles: number[]; points: number; pointsSha256: string }> = {};
      for (const root of sceneRoots(g)) {
        const rootName = g.json.nodes[root].name ?? "";
        if (changedBy106(rootName)) continue;
        for (const i of meshNodesUnder(g, root)) {
          const node = g.json.nodes[i];
          const triangles = g.json.meshes[node.mesh!].primitives
            .map((p) => (p.indices !== undefined ? g.json.accessors[p.indices].count : g.json.accessors[p.attributes.POSITION].count) / 3)
            .sort((a, b) => a - b);
          const points = [...new Set(worldPoints(g, i, m).map((v) => v.map((n) => (Math.round(n * 1e4) / 1e4).toFixed(4)).join(",")))].sort();
          out[`${rootName} > ${node.name ?? i}`] = { triangles, points: points.length, pointsSha256: sha256(points.join("\n")) };
        }
      }
      return out;
    };
    const baseMeshes = describeMeshes(base);
    expect(Object.keys(baseMeshes).length).toBeGreaterThan(0);
    expect(describeMeshes(now)).toEqual(baseMeshes);
  });
});
