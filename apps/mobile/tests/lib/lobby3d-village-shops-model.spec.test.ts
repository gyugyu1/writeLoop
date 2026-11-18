/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 106 마을 가게 넣기, 기능 변경, 모바일): 마을 모델 파일(lobby-village.glb)에서 본 건물(카페·도서관 빼기, 가구점·옷집 모델).
// 기대값은 명세(private 작업 폴더 106-2026-11-18-마을-가게-넣기/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 c728f00의 지금 값이다.
// 구현 전(기준 커밋)에 쓴 테스트다. 구현 코드는 부르는 방법(build-village.py가 만드는 묶음 이름 bld-<건물 id>, place_model이 모델을 땅에 맞춰 놓는 방법)을 알려고만 읽었다.
// 넣을 모델에서 잰 값(삼각형 수, 색 그림 sha256)은 tests/__fixtures__/village-shops-106.ts 머리말에 있다. 마을 모델 안 같은 색 그림 바이트를 찾는 것은
// 작업 100 qa 테스트 N1과 같다(Blender 내보내기가 JPEG를 그대로 싣는다).
// 가정: 명세 2·3의 "땅에 놓는다"는 라룹이 집과 같은 방법(place_model: 벽 둘레 = 바닥에서 높이 1/4 아래 점, 벽 가로를 땅 가로에 맞춰 고르게 키우고
// 벽 가로 가운데를 땅 가운데에, 벽 앞면을 땅 앞에 둔다. 명세 3-1 "모델은 벽 가로를 땅 가로에 맞추므로")로 본다(02-qa-tests.md "가정").
// 유리 재질은 이름이 glass로 시작하는 재질이다(Blender가 같은 이름의 둘째 재질을 glass.001로 바꿀 수 있다).
//
// 바뀔 동작(구현 전 실패): M1~M3, M5. M4는 명세 2의 바뀌는 동작(가구점을 모델로 바꿈)의 자리를 보지만 지금 조립한 가구점도 벽 가로 6·가운데 x 11·앞면 z 31이라
// 구현 전에도 통과한다(구현 뒤에도 통과해야 한다). 그대로 둘 동작(구현 전·뒤 통과): K5.
// 작업 114(마을 벤치 모델) 명세의 "고칠 기존 테스트"(마을 모델 안 벤치 모양)로 qa가 K5를 고쳤다(114 qa 보고 02-qa-tests.md):
// 소품 묶음에서 벤치 조각(점이 모두 벤치 둘레 상자 안인 프리미티브, tests/__fixtures__/village-bench-114.ts)만 빼고 견준다. 묶음 이름과 다른 묶음은 그대로 본다.
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(마을 모델 묶음, 바위)로 qa가 K5를 고쳤다(115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md):
// 장면 뿌리 이름에서 빠지는 묶음(생울타리·울타리·풍차·풍차 날개)을 빼고, 소품 묶음에서 빠지는 바위 다섯의 삼각형을 뺀 뒤 견준다
// (tests/__fixtures__/village-boundary-115.ts의 withoutBoundaryGlb115). 그 밖의 묶음은 그대로 본다.
import {
  boxOf,
  imageBytes,
  meshNodesUnder,
  nowVillageGlb,
  parseGlb,
  rootIndex,
  worldMatrices,
  worldPoints,
  type Glb
} from "../__fixtures__/village-glb-098";
import {
  BASE_106,
  CLOTHING_RECT,
  CLOTHING_SHOP_MODEL,
  FURNITURE_RECT,
  FURNITURE_SHOP_MODEL,
  GLASS_MATERIAL,
  VILLAGE_GLB_PATH_106,
  changedBy106,
  clothingId,
  describeGroups,
  gitShow,
  rootNames,
  sha256,
  type Rect
} from "../__fixtures__/village-shops-106";
import { withoutBenchPrimitives } from "../__fixtures__/village-bench-114";
import { REMOVED_GROUPS_115, withoutBoundaryGlb115 } from "../__fixtures__/village-boundary-115";
import { withoutFountainGlb118 } from "../__fixtures__/village-fountain-118";

/** 묶음 아래 메시의 프리미티브를 유리(재질 이름 glass…)와 그 밖으로 나눠 삼각형 수와 그 밖이 쓰는 색 그림(이미지 번호)을 센다. */
function buildingParts(glb: Glb, group: string) {
  const root = rootIndex(glb, group);
  expect({ group, found: root >= 0 }).toEqual({ group, found: true });
  let glassTriangles = 0;
  let otherTriangles = 0;
  const images = new Set<number>();
  const untextured: string[] = [];
  for (const i of meshNodesUnder(glb, root)) {
    for (const p of glb.json.meshes[glb.json.nodes[i].mesh!].primitives) {
      const tris = (p.indices !== undefined ? glb.json.accessors[p.indices].count : glb.json.accessors[p.attributes.POSITION].count) / 3;
      const material = p.material !== undefined ? glb.json.materials![p.material] : undefined;
      if (GLASS_MATERIAL.test(material?.name ?? "")) {
        glassTriangles += tris;
        continue;
      }
      otherTriangles += tris;
      const texture = material?.pbrMetallicRoughness?.baseColorTexture;
      if (texture === undefined) untextured.push(material?.name ?? "(재질 없음)");
      else images.add(glb.json.textures![texture.index].source!);
    }
  }
  return { glassTriangles, otherTriangles, images: [...images].map((img) => sha256(imageBytes(glb, img))), untextured };
}

/** 묶음 아래 모든 점(세계 좌표)의 벽 둘레(바닥에서 높이 1/4 아래 점) 상자. */
function wallBox(glb: Glb, group: string) {
  const root = rootIndex(glb, group);
  expect({ group, found: root >= 0 }).toEqual({ group, found: true });
  const m = worldMatrices(glb);
  const points = meshNodesUnder(glb, root).flatMap((i) => worldPoints(glb, i, m));
  const box = boxOf(points);
  return boxOf(points.filter(([, y]) => y - box.minY < (box.maxY - box.minY) / 4));
}

function expectFitted(group: string, rect: Rect) {
  const wall = wallBox(nowVillageGlb(), group);
  const [x0, , x1, z1] = rect;
  const width = wall.maxX - wall.minX;
  const centerX = (wall.minX + wall.maxX) / 2;
  expect({ group, width, centerX, front: wall.maxZ, ok: Math.abs(width - (x1 - x0)) <= 0.01 && Math.abs(centerX - (x0 + x1) / 2) <= 0.01 && Math.abs(wall.maxZ - z1) <= 0.01 }).toEqual({
    group,
    width,
    centerX,
    front: wall.maxZ,
    ok: true
  });
}

describe("[spec] 106 바뀔 동작: 마을 모델의 건물", () => {
  it("M1 건물 묶음(명세 1·3): 마을 모델의 건물 묶음은 bld-home·bld-furnitureShop·bld-<옷집 id> 셋이고, bld-cafe·bld-library는 없다", () => {
    const buildings = rootNames(nowVillageGlb()).filter((n) => n.startsWith("bld-"));
    expect(buildings).toEqual(["bld-furnitureShop", "bld-home", `bld-${clothingId()}`].sort());
  });

  it("M2 가구점 모델(명세 2): bld-furnitureShop은 가구점 모델이다. 유리 재질 삼각형 30개, 그 밖 10000개이고, 그 밖은 모두 색 그림을 쓰며 그 그림 한 장의 바이트가 모델의 색 그림과 같다", () => {
    expect(buildingParts(nowVillageGlb(), "bld-furnitureShop")).toEqual({
      glassTriangles: FURNITURE_SHOP_MODEL.glassTriangles,
      otherTriangles: FURNITURE_SHOP_MODEL.buildingTriangles,
      images: [FURNITURE_SHOP_MODEL.colorMapSha256],
      untextured: []
    });
  });

  it("M3 옷집 모델(명세 3): bld-<옷집 id>는 옷집 모델이다. 유리 재질 삼각형 16개, 그 밖 7242개이고, 그 밖은 모두 색 그림을 쓰며 그 그림 한 장의 바이트가 모델의 색 그림과 같다", () => {
    expect(buildingParts(nowVillageGlb(), `bld-${clothingId()}`)).toEqual({
      glassTriangles: CLOTHING_SHOP_MODEL.glassTriangles,
      otherTriangles: CLOTHING_SHOP_MODEL.buildingTriangles,
      images: [CLOTHING_SHOP_MODEL.colorMapSha256],
      untextured: []
    });
  });

  it("M4 가구점 자리(명세 2 \"지금 땅 [8,25,14,31]에 놓는다\"): 마을 모델 안 가구점의 벽 가로가 땅 가로 6칸(±0.01)이고, 벽 가로 가운데가 x 11(±0.01), 벽 앞면이 z 31(±0.01)이다", () => {
    expectFitted("bld-furnitureShop", FURNITURE_RECT);
  });

  it("M5 옷집 자리(명세 3 \"땅 [44,16,50,22]에 놓는다\"): 마을 모델 안 옷집의 벽 가로가 땅 가로 6칸(±0.01)이고, 벽 가로 가운데가 x 47(±0.01), 벽 앞면이 z 22(±0.01)이다", () => {
    expectFitted(`bld-${clothingId()}`, CLOTHING_RECT);
  });
});

describe("[spec] 106 그대로 둘 동작: 마을 모델의 건물 밖 묶음", () => {
  it("K5 106이 바꾸는 묶음(건물 bld-*, 창 불빛 판, 옛 길 조각 paths) 밖 묶음(소품, 생울타리, 울타리, 풍차, 풍차 날개, 나무 틀, 가로등 불빛)의 이름과 메시가 기준 커밋과 같다", () => {
    const now = nowVillageGlb();
    const base = parseGlb(gitShow(BASE_106, VILLAGE_GLB_PATH_106));
    // 115: 빠지는 묶음(생울타리·울타리·풍차·풍차 날개)은 양쪽에서 뺀다
    const keep = (name: string) => !changedBy106(name) && !REMOVED_GROUPS_115.includes(name);
    expect(rootNames(now).filter(keep)).toEqual(rootNames(base).filter(keep));
    // 114: 소품 묶음의 벤치 조각만 빼고 견준다. 115: 소품의 빠지는 바위 삼각형도 뺀다
    // 118: 마을 모델에서 옛 Kenney 분수가 빠진다(명세 바뀌는 동작 1). 양쪽에서 옛 분수 삼각형(소품 묶음, 가운데에서 1.7칸 안)을 뺀 뒤 견준다
    const baseMeshes = describeGroups(withoutFountainGlb118(withoutBenchPrimitives(withoutBoundaryGlb115(base))), keep);
    expect(Object.keys(baseMeshes).length).toBeGreaterThan(0);
    expect(describeGroups(withoutFountainGlb118(withoutBenchPrimitives(withoutBoundaryGlb115(now))), keep)).toEqual(baseMeshes);
  });
});
