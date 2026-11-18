// [spec] qa 테스트(작업 112 ③ 물체 합치기, 기능 변경, 모바일): 계절 흩뿌림을 계절마다 인스턴스 메시 하나로, 마을 모델의 한 묶음 안에서 앱이 바꿔 끼우는 재질이
// 같은 메시를 하나로 합친다. 그림(자리·칸·색·보이는 계절)과 누르기·얼리기는 그대로다.
// 기대값은 명세(private 작업 폴더 112-2026-11-18-마을-그리기-JS-줄이기/04-물체-합치기/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 bbc227e의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, 그림·모델을 require해
// react-three-fiber useLoader로 읽는 것, useFrame으로 계절·불빛·풍차를 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): M1·M2(흩뿌림), M3·M4(재질 합치기). 그대로 둘 동작(구현 전·뒤 통과): K1~K5.
//
// 어떻게 보나(02-qa-tests.md "관찰하는 방법", 도우미는 tests/__fixtures__/village-merge-112.ts):
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 103 테스트와 같다(그림은 빈 THREE.Texture에 불러온 파일을 적어 두고, 꽃 모델은 101의 가짜 모델).
//   마을 모델은 진짜 lobby-village.glb를 GLTFLoader 모양대로 푼 장면(sceneFromGlbFull: 법선·그림 좌표·정점색 포함, colormap 그림 한 장을 함께 씀)이나,
//   같은 재질의 정의를 가르는 작은 합성 모델(syntheticVillage112)이다.
// - VillageNature와 VillageModel을 마을 화면처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다. 마을 모델 뿌리 = 그 가운데 windmill-rotor가 든 것.
//   가짜 useFrame은 테스트가 delta 0.1초, 카메라 없이 부른다.
// - "그려진다" = 메시와 그 위 모든 부모가 visible(인스턴스 메시는 찍는 수 > 0).
// - 합치기 전 삼각형은 그리기 전에 넘길 장면에서 미리 모은다(앱이 도형을 바꿔도 기대값이 흔들리지 않게). 그린 메시의 묶음은 삼각형 자리로 정한다.
// - "흩뿌림 메시" = 103 테스트와 같다: 그려지는 인스턴스 메시 가운데 마을 모델 도형이 아니고 납작한(인스턴스마다 높이 0.01칸 이하) 것.
// 명세에 수가 없어 qa가 정한 값(02-qa-tests.md "가정"): 자리 1e-4칸, 법선 2e-3, 그림 좌표 1e-5, 정점색 1e-4, 인스턴스 색 1e-5, 누른 자리 1e-4칸.
//
// 작업 113(새 나무 모델 넣기) 명세의 "고칠 기존 테스트"(112-③ K3의 "나무 틀 10개")로 qa가 K3를 고쳤다(113 qa 보고 02-qa-tests.md):
// 113은 마을 나무를 Kenney 나무 틀 대신 새 나무 모델(WriteLoop_Tree_<A·B·C>_LOD<1·2>.glb)로 종류 × 단계 × 부품마다 인스턴스 메시 하나로 그린다(113 바뀌는 동작 1·6).
// 그래서 K3의 "나무는 틀마다 인스턴스로 그려진다(틀 도형 수 = 그려지는 나무 도형 수)"를 "나무 틀 도형으로 그리는 인스턴스는 없고, 새 나무 모델의
// 종류·단계·부품 12가지가 하나씩 인스턴스로 그려진다"로 바꿨다. 가짜 불러오기는 새 나무 파일에 앱 자산 폴더의 그 파일을 푼 모델을 준다. 나머지 단언·입력은 그대로다.
// 작업 114(마을 벤치 모델) 명세의 "고칠 기존 테스트"(마을 모델 안 벤치 모양·재질 수)로 qa가 M3을 고쳤다(114 qa 보고 02-qa-tests.md):
// 114는 Kenney 벤치(colormap 그림) 대신 자기 그림(Village_Bench_Painted_Timber 재질)을 쓰는 새 벤치 모델을 소품 묶음에 넣고, 명세 "그대로여야 할 동작"이
// "새 벤치 재질은 소품의 다른 재질과 합쳐지지 않고 따로 하나가 된다"다. 그래서 M3의 소품 그려지는 메시를 둘(colormap·정점색, 그림 없음·정점색)에서
// 셋(그 둘과 새 벤치 그림·정점색. 소품은 지금처럼 구석 어둠 정점색을 함께 굽는다)으로 바꾸고, colormap 그림은 소품에서 새 벤치 재질이 아닌 첫 그림으로 찾는다.
// 풍차 탑(colormap 하나)과 "그려지는 메시는 모두 한 묶음의 삼각형만 갖는다"는 그대로다.
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(생울타리·울타리·풍차: 마을 모델 안 묶음, 날개 돌기)로 qa가 고쳤다
// (115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md). 115는 마을 모델에서 생울타리(hedges)·울타리(fences)·풍차(windmill, windmill-rotor)를 빼고,
// 앱 코드에서 풍차를 뺀다(명세 3·4). 풍차·생울타리·울타리 말고 다른 것의 기대는 그대로다:
// - 그린 장면에서 마을 모델 뿌리를 "windmill-rotor가 든 것" 대신 "소품 묶음(props)이 든 것"으로 찾는다(진짜 모델·합성 모델 모두 props가 있다).
// - M3: 풍차 탑(windmill)의 그려지는 메시 기대를 뺐다. 소품 셋은 그대로다.
// - M4: 합성 모델에서 풍차 탑·날개 묶음을 떼고(앱이 풍차 묶음을 따로 다루지 않게 되어도 나머지 합치기 규칙만 보도록) 풍차 탑 2 → 1, 날개 따로의 기대를 뺐다.
//   소품 7 → 5, 유리·불빛 판·옛 길 조각, 삼각형 같음, 누르기는 그대로다.
// - K1: 소품·풍차 탑 → 소품. K3: 견주는 묶음에서 생울타리·울타리·풍차 날개를 빼고 날개 돌기를 뺐다. 건물·유리·불빛 판·옛 길·나무 틀·나무·유리 재질은 그대로다.
// - K4: "풍차 날개 메시 말고 모두 얼린다" → 마을 모델에 풍차 날개 묶음이 없고 모두 얼린다(바뀔 동작). 소품의 세계 행렬은 그대로 본다.
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt, type Season } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_START } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { newImageFiles103, scatterModule, type VillageScatterPiece } from "../__fixtures__/village-ground-103";
import {
  TriBank,
  cellAttribute,
  classOf,
  compareTriangles,
  drawnClass,
  instanceCell,
  instanceLocalUvs,
  labelOfMesh,
  sceneFromGlbFull,
  sourceTriangles,
  syntheticVillage112,
  trianglesOf,
  vertexShaderUses,
  type Tri
} from "../__fixtures__/village-merge-112";
import { allObjects, drawnVisible, instanceHeight, instanceWorldMatrices, loaderState, mockUnreadableAssets, resetFakeLoader, sourceGeometries } from "../__fixtures__/village-scene-101";
import { GLASS_MATERIAL } from "../__fixtures__/village-shops-106";
import { mockImagesAsPaths, splatLoader } from "../__fixtures__/village-splat-102";
import { TREE_KINDS, TREE_LODS, TREE_PARTS, resetTreeLoader, treePartOf } from "../__fixtures__/village-trees-113";
import { isFountainMesh118 } from "../__fixtures__/village-fountain-118";

type FramePart = (state: unknown, delta: number) => void;

const mockFrames: FramePart[] = [];
const mockScene: { background: unknown } = { background: null };

jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/utils/BufferGeometryUtils.js", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const nodePath = (process as unknown as { getBuiltinModule: (id: string) => typeof import("path") }).getBuiltinModule("path");
  const file = nodePath.join(nodePath.dirname(require.resolve("three")), "..", "examples", "jsm", "utils", "BufferGeometryUtils.js");
  return nodeModule.createRequire(file)(file);
});
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class MockGLTFLoader {}
}));
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const fake = (loader: unknown, input: unknown) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const splat = require("../__fixtures__/village-splat-102") as typeof import("../__fixtures__/village-splat-102");
    const scene101 = require("../__fixtures__/village-scene-101") as typeof import("../__fixtures__/village-scene-101");
    // 113: 새 나무 파일은 그 파일을 푼 모델(tests/__fixtures__/village-trees-113.ts), 그 밖은 지금 가짜
    const trees = require("../__fixtures__/village-trees-113") as typeof import("../__fixtures__/village-trees-113");
    /* eslint-enable @typescript-eslint/no-require-imports */
    return trees.treeUseLoader(loader, input, (l, i) => splat.splatUseLoader(l, i, scene101.fakeUseLoader));
  };
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => ({ camera: null, scene: mockScene, size: { width: 400, height: 800 }, gl: { capabilities: { getMaxAnisotropy: () => 1 } } }),
    useFrame: (callback: FramePart) => {
      React.useEffect(() => {
        mockFrames.push(callback);
        return () => {
          const at = mockFrames.indexOf(callback);
          if (at >= 0) mockFrames.splice(at, 1);
        };
      });
    },
    useLoader: Object.assign(fake, { clear: () => {}, preload: () => {} })
  };
});

let village: typeof VillageModule;

beforeAll(() => {
  mockUnreadableAssets();
  mockImagesAsPaths();
  splatLoader.newImages = new Set(newImageFiles103());
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  village = require("@/components/lobby3d/lobby3d-village") as typeof VillageModule;
});

const SEASON_DATES: Record<Season, Date> = {
  spring: new Date(2026, 3, 15, 12, 30),
  summer: new Date(2026, 5, 21, 12, 30),
  autumn: new Date(2026, 9, 15, 12, 30),
  winter: new Date(2026, 0, 15, 12, 30)
};

type Light = { ambience: unknown; ceiling: number; target: { season: Season } };

function lightAt(season: Season): Light {
  const d = daylightAt(SEASON_DATES[season]);
  expect(d.season).toBe(season);
  return { ambience: d.ambience, ceiling: 0, target: d };
}

type Sim = { x: number; z: number; reduceMotion: boolean };
type Drawn = { roots: THREE.Object3D[]; model: THREE.Object3D; pick: MutableRefObject<THREE.Object3D[]>; light: Light; sim: Sim; source: THREE.Object3D };

/** 그 장면을 마을 모델로 넘겨 마을을 그린다(첫 프레임 둘까지). */
async function draw(scene: THREE.Object3D, season: Season = "summer", reduceMotion = true): Promise<Drawn> {
  loaderState.village = { scene };
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim: Sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion };
  const light = lightAt(season);
  const view = await render(
    <>
      <village.VillageNature daylight={light as unknown as DaylightState} />
      <village.VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
    </>
  );
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  // 115: 마을 모델 뿌리 = 소품 묶음(props)이 든 것(풍차 날개가 빠진다)
  const models = roots.filter((r) => r.getObjectByName("props") !== undefined);
  expect(models.length).toBe(1);
  await frames(2);
  return { roots, model: models[0], pick, light, sim, source: scene };
}

async function frames(count: number) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f({}, 0.1);
  });
}

async function setSeason(drawn: Drawn, season: Season) {
  const next = lightAt(season);
  drawn.light.ambience = next.ambience;
  drawn.light.target = next.target;
  await frames(2);
}

/** 마을 모델 뿌리 아래의 메시(인스턴스 빼고). shownOnly면 그려지는 것만. matrixWorld를 맞춘다. */
function modelMeshes(drawn: Drawn, shownOnly = true): THREE.Mesh[] {
  drawn.model.updateMatrixWorld(true);
  const out: THREE.Mesh[] = [];
  drawn.model.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && (!shownOnly || drawnVisible(o, [drawn.model]))) out.push(o);
  });
  return out;
}

/** 묶음 이름 → 그 묶음의 그린 메시(삼각형 자리로 정함). 여러 묶음에 걸치거나 모델에 없는 삼각형이 있는 메시는 따로 모은다. */
function byLabel(meshes: THREE.Mesh[], bank: TriBank): { groups: Map<string, THREE.Mesh[]>; strange: string[] } {
  const groups = new Map<string, THREE.Mesh[]>();
  const strange: string[] = [];
  for (const m of meshes) {
    const label = labelOfMesh(m, bank);
    if (label.startsWith("여러 묶음")) {
      strange.push(`${m.name || m.uuid.slice(0, 8)}: ${label}`);
      continue;
    }
    groups.set(label, [...(groups.get(label) ?? []), m]);
  }
  return { groups, strange };
}

const drawnTris = (meshes: THREE.Mesh[], label: string): Tri[] => meshes.flatMap((m) => trianglesOf(m, label, drawnClass(m)));

/** 흩뿌림 메시(머리말의 정의). */
function scatterMeshes(drawn: Drawn): THREE.InstancedMesh[] {
  const fromModel = sourceGeometries(drawn.source).all;
  return allObjects(drawn.roots).filter((o): o is THREE.InstancedMesh => {
    if (!(o instanceof THREE.InstancedMesh) || fromModel.has(o.geometry) || !drawnVisible(o, drawn.roots)) return false;
    return Math.max(...instanceWorldMatrices(o).map((w) => instanceHeight(o, w))) <= 0.01;
  });
}

/** 누르기 대상과 기대 목록이 같은 물체들인가(같은 물체인지로 견준다). */
function samePick(pick: THREE.Object3D[], allowed: THREE.Object3D[]): { notAllowed: string[]; notPicked: string[] } {
  const name = (o: THREE.Object3D) => o.name || o.uuid.slice(0, 8);
  return {
    notAllowed: pick.filter((o) => !allowed.includes(o)).map(name),
    notPicked: allowed.filter((o) => !pick.includes(o)).map(name)
  };
}

const materialOf = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshLambertMaterial;

/** 114: 새 벤치 재질 이름(새 벤치 모델에서 잰 값, tests/__fixtures__/village-bench-114.ts). Blender가 이름 뒤에 .001을 붙일 수 있어 앞머리로 본다. */
const isBenchMaterial114 = (name: string) => name.startsWith("Village_Bench_Painted_Timber");

/** 진짜 마을 모델의 colormap 그림(소품에서 새 벤치 재질이 아닌 첫 primitive의 그림. 114에서 새 벤치 재질을 건너뛰게 고침). */
function colormapOf(scene: THREE.Object3D): THREE.Texture {
  let map: THREE.Texture | null = null;
  scene.getObjectByName("props")!.traverse((o) => {
    const m = o instanceof THREE.Mesh && !isBenchMaterial114(materialOf(o).name) ? (materialOf(o) as unknown as THREE.MeshStandardMaterial).map : null;
    if (!map && m) map = m;
  });
  expect(map).not.toBeNull();
  return map!;
}

/** 114: 진짜 마을 모델의 새 벤치 그림(소품에서 새 벤치 재질의 그림). 없으면 null. */
function benchMapOf(scene: THREE.Object3D): THREE.Texture | null {
  let map: THREE.Texture | null = null;
  scene.getObjectByName("props")!.traverse((o) => {
    const m = o instanceof THREE.Mesh && isBenchMaterial114(materialOf(o).name) ? (materialOf(o) as unknown as THREE.MeshStandardMaterial).map : null;
    if (!map && m) map = m;
  });
  return map;
}

jest.setTimeout(300000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  resetTreeLoader();
  splatLoader.failNew = false;
});

const SCATTER_Y = -0.016;
const SCATTERED: Season[] = ["autumn", "spring", "summer"];

// ---------- 바뀔 동작: 계절 흩뿌림 ----------

describe("[spec] 112 ③ 바뀔 동작: 계절 흩뿌림은 계절마다 인스턴스 메시 하나(명세 바뀌는 동작 1)", () => {
  it("M1 봄·여름·가을에는 그려지는 흩뿌림 메시가 하나이고 그 계절 조각 수만큼 찍으며, 세 계절의 메시는 서로 다른 메시 셋이다. 겨울에는 흩뿌림 메시가 그려지지 않는다", async () => {
    const drawn = await draw(sceneFromGlbFull(nowVillageGlb()), "summer");
    const seen = new Map<Season, THREE.InstancedMesh>();
    for (const season of ["summer", "autumn", "winter", "spring", "summer"] as Season[]) {
      await setSeason(drawn, season);
      const meshes = scatterMeshes(drawn);
      if (season === "winter") {
        expect({ season, meshes: meshes.map((m) => `${m.name || "이름 없음"} ${m.count}개`) }).toEqual({ season, meshes: [] });
        continue;
      }
      const pieces = scatterModule().villageSeasonScatter(season);
      expect({ season, meshes: meshes.length, counts: meshes.map((m) => m.count) }).toEqual({ season, meshes: 1, counts: [pieces.length] });
      seen.set(season, meshes[0]);
    }
    expect(new Set(SCATTERED.map((s) => seen.get(s))).size).toBe(3);
  });

  it("M2 인스턴스마다 그 조각의 그림 칸을 갖는다(관찰하는 방법의 계약): 흩뿌림 메시 도형에 인스턴스마다 값이 하나인 칸 속성(InstancedBufferAttribute, 크기 1 또는 2)이 하나 있고 찍는 수만큼 값이 있으며, 재질의 셰이더 고침(onBeforeCompile)이 꼭짓점 셰이더에 그 속성을 선언하고 쓴다", async () => {
    const drawn = await draw(sceneFromGlbFull(nowVillageGlb()), "summer");
    for (const season of SCATTERED) {
      await setSeason(drawn, season);
      const meshes = scatterMeshes(drawn);
      expect({ season, meshes: meshes.length > 0 }).toEqual({ season, meshes: true });
      for (const mesh of meshes) {
        const cell = cellAttribute(mesh);
        const found = cell === null ? "칸 속성 없음" : typeof cell === "string" ? cell : `크기 ${cell.attr.itemSize}, 값 ${cell.attr.count}개 / 찍는 수 ${mesh.count}`;
        expect({ season, cell: cell !== null && typeof cell !== "string" && (cell.attr.itemSize === 1 || cell.attr.itemSize === 2) && cell.attr.count >= mesh.count, found }).toEqual({ season, cell: true, found });
        const named = cell as { name: string };
        expect({ season, shader: vertexShaderUses(materialOf(mesh), named.name) }).toEqual({ season, shader: { custom: true, declared: true, used: true } });
      }
    }
  });
});

// ---------- 바뀔 동작: 마을 모델의 재질 합치기 ----------

describe("[spec] 112 ③ 바뀔 동작: 마을 모델은 묶음 안에서 같은 재질끼리 메시 하나로 합친다(명세 바뀌는 동작 2)", () => {
  it("M3 진짜 마을 모델(colormap 그림 한 장을 함께 씀): 소품(props)은 그려지는 메시 셋(colormap 그림·정점색, 그림 없음·정점색 = 물, 114 새 벤치 그림·정점색)이다(115: 풍차 탑 기대는 뺐다). 그려지는 메시는 모두 한 묶음의 삼각형만 갖는다", async () => {
    const scene = sceneFromGlbFull(nowVillageGlb());
    const colormap = colormapOf(scene);
    const benchMap = benchMapOf(scene);
    expect({ benchMap: benchMap !== null, sameAsColormap: benchMap !== null && benchMap.source === colormap.source }).toEqual({ benchMap: true, sameAsColormap: false });
    const bank = new TriBank(sourceTriangles(scene, { glass: GLASS_MATERIAL }));
    const drawn = await draw(scene, "summer");
    const { groups, strange } = byLabel(modelMeshes(drawn), bank);
    expect(strange).toEqual([]);
    const classes = (label: string) => (groups.get(label) ?? []).map(drawnClass).sort();
    expect({ props: classes("props") }).toEqual({
      // 118: 그림 없음·정점색(물) 메시는 옛 Kenney 분수의 물이었다. 옛 분수가 마을 모델에서 빠져 소품은 그림 둘(colormap, 새 벤치)이다
      props: [classOf(colormap, true), classOf(benchMap, true)].sort()
    });
  });

  it("M4 같은 재질의 정의(합성 모델): 같은 그림 원본(다른 THREE.Texture라도) 또는 둘 다 그림 없음이고 정점색 유무가 같으면 한 메시로 합친다(소품 7 → 5). 유리 둘·불빛 판 둘·옛 길 조각 둘은 합치지 않으며, 합친 메시의 삼각형(세계 자리·법선·그림 좌표·정점색·재질 종류)은 합치기 전과 같다(115: 합성 모델의 풍차 탑·날개를 뗐다)", async () => {
    const { scene, propsClasses } = syntheticVillage112();
    // 115: 풍차 탑·날개 묶음을 뗀다(115가 마을 모델과 앱 코드에서 풍차를 뺀다)
    for (const name of ["windmill", "windmill-rotor"]) scene.getObjectByName(name)?.removeFromParent();
    expect(["windmill", "windmill-rotor"].map((name) => scene.getObjectByName(name))).toEqual([undefined, undefined]);
    const expected = sourceTriangles(scene, { glass: GLASS_MATERIAL });
    const bank = new TriBank(expected);
    const drawn = await draw(scene, "summer");
    // 밤(천장 조명 1): 불빛 판도 그려진다
    drawn.light.ceiling = 1;
    await frames(1);
    const shown = byLabel(modelMeshes(drawn), bank);
    const every = byLabel(modelMeshes(drawn, false), bank);
    expect({ strange: shown.strange, strangeAll: every.strange }).toEqual({ strange: [], strangeAll: [] });
    const g = shown.groups;
    expect({
      props: (g.get("props") ?? []).map(drawnClass).sort(),
      body: (g.get("bld-home") ?? []).length,
      glass: (g.get("bld-home:glass") ?? []).length,
      glow: (g.get("glow-lamp-0") ?? []).length,
      pathsDrawn: (g.get("paths") ?? []).length,
      pathsInScene: (every.groups.get("paths") ?? []).length
    }).toEqual({ props: propsClasses, body: 1, glass: 2, glow: 2, pathsDrawn: 0, pathsInScene: 2 });
    for (const label of ["props", "bld-home", "bld-home:glass", "glow-lamp-0"]) {
      const mode = label === "props" ? "full+cls" : "full";
      const want = expected.filter((t) => t.label === label);
      const got = compareTriangles(want, drawnTris(g.get(label) ?? [], label), mode);
      expect({ label, missing: got.missing, extra: got.extra, examples: got.examples }).toEqual({ label, missing: 0, extra: 0, examples: [] });
    }
    // 소품은 누르기 대상(합친 메시가 받는다), 유리·불빛 판·옛 길은 아니다
    const allowed = [...(g.get("props") ?? []), ...(g.get("bld-home") ?? [])];
    // 118: 새 분수 메시(석재·물)도 누르기 대상이다. 마을 모델의 묶음이 아니므로 허용 목록에 더한다(없어도 된다: 분수 메시가 목록에 있는지는 118 qa 테스트가 본다)
    const fountainPick118 = drawn.pick.current.filter(isFountainMesh118);
    expect(samePick(drawn.pick.current, [...allowed, ...fountainPick118])).toEqual({ notAllowed: [], notPicked: [] });
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 112 ③ 그대로 둘 동작: 진짜 마을 모델의 모양·누르기·얼리기(명세 바뀌는 동작 2의 '모양은 같다'·'누르기', 그대로여야 할 동작)", () => {
  it("K1 소품의 그려지는 메시들을 모은 삼각형(세계 자리·법선·그림 좌표·정점색·재질 종류)이 합치기 전 메시들을 모은 것과 같다(115: 풍차 탑은 뺐다)", async () => {
    const scene = sceneFromGlbFull(nowVillageGlb());
    const expected = sourceTriangles(scene, { glass: GLASS_MATERIAL });
    const bank = new TriBank(expected);
    const drawn = await draw(scene, "summer");
    const { groups, strange } = byLabel(modelMeshes(drawn), bank);
    expect(strange).toEqual([]);
    for (const label of ["props"]) {
      const want = expected.filter((t) => t.label === label);
      expect(want.length).toBeGreaterThan(0);
      const got = compareTriangles(want, drawnTris(groups.get(label) ?? [], label), "full+cls");
      expect({ label, missing: got.missing, extra: got.extra, examples: got.examples }).toEqual({ label, missing: 0, extra: 0, examples: [] });
    }
  });

  it("K2 누르기: 누르기 판정 대상은 건물(bld-*, 유리 빼고)과 소품의 그려지는 메시이고 그 아래에 다른 메시가 없으며, 대상의 삼각형이 건물·소품 삼각형과 같다. 소품·건물 삼각형을 겨눈 광선마다 맨 앞에 맞는 자리와 묶음이 합치기 전 모델과 같다", async () => {
    const scene = sceneFromGlbFull(nowVillageGlb());
    const expected = sourceTriangles(scene, { glass: GLASS_MATERIAL });
    const bank = new TriBank(expected);
    const isPickLabel = (label: string) => (label.startsWith("bld-") && !label.endsWith(":glass")) || label === "props";
    // 합치기 전 모델의 누르기 대상(그리기 전에 도형을 복사해 둔다)
    scene.updateMatrixWorld(true);
    const probes: THREE.Mesh[] = [];
    const probeLabel = new Map<THREE.Object3D, string>();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      let top: THREE.Object3D = o;
      while (top.parent && top.parent !== scene) top = top.parent;
      const label = `${top.name}${GLASS_MATERIAL.test(materialOf(o).name) ? ":glass" : ""}`;
      if (!isPickLabel(label)) return;
      const probe = new THREE.Mesh(o.geometry.clone(), new THREE.MeshBasicMaterial());
      probe.matrixAutoUpdate = false;
      probe.matrix.copy(o.matrixWorld);
      probe.matrixWorld.copy(o.matrixWorld);
      probes.push(probe);
      probeLabel.set(probe, top.name);
    });
    const drawn = await draw(scene, "summer");
    const { groups, strange } = byLabel(modelMeshes(drawn), bank);
    expect(strange).toEqual([]);
    const allowed = [...groups.entries()].filter(([label]) => isPickLabel(label)).flatMap(([, meshes]) => meshes);
    // 118: 새 분수 메시(석재·물)도 누르기 대상이다. 마을 모델의 묶음이 아니므로 허용 목록에 더하고, 삼각형 견주기에서는 뺀다(분수 메시가 목록에 있는지는 118 qa 테스트가 본다)
    const fountainPick118 = drawn.pick.current.filter(isFountainMesh118);
    expect(samePick(drawn.pick.current, [...allowed, ...fountainPick118])).toEqual({ notAllowed: [], notPicked: [] });
    const strangers: string[] = [];
    for (const target of drawn.pick.current) {
      target.traverse((o) => {
        if (o !== target && o instanceof THREE.Mesh && !allowed.includes(o) && !fountainPick118.includes(o)) strangers.push(o.name || o.type);
      });
    }
    expect(strangers).toEqual([]);
    const want = expected.filter((t) => isPickLabel(t.label));
    const got = compareTriangles(want, (drawn.pick.current.filter((m) => !fountainPick118.includes(m)) as THREE.Mesh[]).flatMap((m) => trianglesOf(m, "", "")), "shape");
    expect({ missing: got.missing, extra: got.extra, examples: got.examples }).toEqual({ missing: 0, extra: 0, examples: [] });
    // 광선: 위 앞쪽에서 비스듬히 내려다보며(마을 카메라처럼) 앞을 향한 삼각형의 무게중심을 겨눈다
    const dir = new THREE.Vector3(0, -0.8, -0.6).normalize();
    const labelOfDrawn = new Map<THREE.Object3D, string>();
    for (const [label, meshes] of groups) for (const m of meshes) labelOfDrawn.set(m, label.replace(/:glass$/, ""));
    const raycaster = new THREE.Raycaster();
    const wrong: string[] = [];
    let aimed = 0;
    for (const [label, step] of [["props", 20], ["bld-", 120]] as const) {
      const tris = want.filter((t) => (label === "props" ? t.label === "props" : t.label.startsWith(label)));
      for (let i = 0; i < tris.length; i += step) {
        const t = tris[i];
        const a = new THREE.Vector3(t.pos[0], t.pos[1], t.pos[2]);
        const b = new THREE.Vector3(t.pos[3], t.pos[4], t.pos[5]);
        const c = new THREE.Vector3(t.pos[6], t.pos[7], t.pos[8]);
        const face = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
        if (face.lengthSq() < 1e-12 || face.normalize().dot(dir) > -0.2) continue;
        aimed += 1;
        const center = a.add(b).add(c).multiplyScalar(1 / 3);
        raycaster.set(center.clone().addScaledVector(dir, -60), dir);
        const before = raycaster.intersectObjects(probes, false)[0];
        const after = raycaster.intersectObjects(drawn.pick.current, true)[0];
        const say = (h: THREE.Intersection | undefined, names: Map<THREE.Object3D, string>) =>
          h ? `${names.get(h.object) ?? "?"} (${h.point.x.toFixed(4)}, ${h.point.y.toFixed(4)}, ${h.point.z.toFixed(4)})` : "맞지 않음";
        const same = Boolean(before) === Boolean(after) && (!before || (before.point.distanceTo(after!.point) <= 1e-4 && probeLabel.get(before.object) === labelOfDrawn.get(after!.object)));
        if (!same) wrong.push(`${t.label} ${i}: 전 ${say(before, probeLabel)} / 뒤 ${say(after, labelOfDrawn)}`);
      }
    }
    expect(aimed).toBeGreaterThan(100);
    expect(wrong.slice(0, 10)).toEqual([]);
  });

  it("K3 그 밖의 마을 모델: 건물(유리 포함)의 그려지는 메시 수와 삼각형이 합치기 전과 같고(115: 생울타리·울타리·풍차 날개는 뺐다), 불빛 판은 밤에만 그대로 그려지고, 옛 길 조각과 나무 틀은 그려지지 않으며, 나무는 새 나무 모델의 종류·단계·부품마다 인스턴스로 그려지고(113에서 고침), 유리는 반투명 재질이며 누르기 대상이 아니다", async () => {
    const scene = sceneFromGlbFull(nowVillageGlb());
    const expected = sourceTriangles(scene, { glass: GLASS_MATERIAL });
    const bank = new TriBank(expected);
    const templates = new Set<THREE.BufferGeometry>();
    scene.getObjectByName("tree-templates")!.traverse((o) => {
      if (o instanceof THREE.Mesh) templates.add(o.geometry);
    });
    const sourceCount = new Map<string, number>();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      let top: THREE.Object3D = o;
      while (top.parent && top.parent !== scene) top = top.parent;
      const label = `${top.name}${GLASS_MATERIAL.test(materialOf(o).name) ? ":glass" : ""}`;
      sourceCount.set(label, (sourceCount.get(label) ?? 0) + 1);
    });
    const drawn = await draw(scene, "summer", true);
    const day = byLabel(modelMeshes(drawn), bank);
    expect(day.strange).toEqual([]);
    // 115: 생울타리·울타리·풍차 날개는 견주는 묶음에서 뺀다
    const kept = [...sourceCount.keys()].filter((l) => l.startsWith("bld-")).sort();
    expect(kept).toEqual(expect.arrayContaining(["bld-clothingShop", "bld-clothingShop:glass", "bld-furnitureShop", "bld-furnitureShop:glass", "bld-home"]));
    for (const label of kept) {
      const meshes = day.groups.get(label) ?? [];
      const got = compareTriangles(expected.filter((t) => t.label === label), drawnTris(meshes, label), "full");
      expect({ label, meshes: meshes.length, missing: got.missing, extra: got.extra, examples: got.examples }).toEqual({ label, meshes: sourceCount.get(label), missing: 0, extra: 0, examples: [] });
    }
    const glows = [...sourceCount.keys()].filter((l) => l.startsWith("glow"));
    expect(glows.length).toBeGreaterThan(0);
    expect({ dayGlow: glows.flatMap((l) => day.groups.get(l) ?? []).length, paths: (day.groups.get("paths") ?? []).length, templates: (day.groups.get("tree-templates") ?? []).length }).toEqual({ dayGlow: 0, paths: 0, templates: 0 });
    const glassMeshes = [...day.groups.entries()].filter(([l]) => l.endsWith(":glass")).flatMap(([, m]) => m);
    expect(glassMeshes.map((m) => ({ transparent: materialOf(m).transparent, picked: drawn.pick.current.includes(m) }))).toEqual(glassMeshes.map(() => ({ transparent: true, picked: false })));
    // 113: 나무 틀 도형으로 그리는 인스턴스는 없고, 새 나무 모델의 종류·단계·부품 12가지가 하나씩 인스턴스로 그려진다
    const drawnInstanced = allObjects(drawn.roots).filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && o.count > 0 && drawnVisible(o, drawn.roots));
    expect(drawnInstanced.filter((o) => templates.has(o.geometry)).map((o) => o.name || o.type)).toEqual([]);
    const treeLabels = drawnInstanced
      .map((o) => treePartOf(o.geometry))
      .filter((info) => info !== null)
      .map((info) => `${info!.kind}-LOD${info!.lod}-${info!.part}`)
      .sort();
    expect(treeLabels).toEqual(TREE_KINDS.flatMap((k) => TREE_LODS.flatMap((l) => TREE_PARTS.map((p) => `${k}-LOD${l}-${p}`))).sort());
    // 밤: 불빛 판이 그대로 그려진다
    drawn.light.ceiling = 1;
    await frames(1);
    const night = byLabel(modelMeshes(drawn), bank);
    for (const label of glows) {
      const meshes = night.groups.get(label) ?? [];
      const got = compareTriangles(expected.filter((t) => t.label === label), drawnTris(meshes, label), "full");
      expect({ label, meshes: meshes.length, missing: got.missing, extra: got.extra }).toEqual({ label, meshes: sourceCount.get(label), missing: 0, extra: 0 });
    }
    // 115: 풍차 날개 돌기는 뺐다(115가 풍차를 뺀다)
  });

  it("K4 위치 행렬 얼리기(112-② 그대로, 합친 메시도 얼린다. 115에서 고침): 마을 모델에 풍차 날개 묶음(windmill-rotor)이 없고, 첫 프레임 뒤 마을 모델 뿌리 아래 모든 물체는 matrixAutoUpdate가 꺼져 있으며, 소품의 그려지는 메시의 세계 행렬이 자리·방향·크기로 계산한 값과 같다", async () => {
    const scene = sceneFromGlbFull(nowVillageGlb());
    const bank = new TriBank(sourceTriangles(scene, { glass: GLASS_MATERIAL }));
    const drawn = await draw(scene, "summer");
    const { groups } = byLabel(modelMeshes(drawn), bank);
    // 115: 풍차 날개가 없으니 날개 메시를 빼지 않고 모두 얼린다
    expect({ rotor: drawn.model.getObjectByName("windmill-rotor") !== undefined }).toEqual({ rotor: false });
    const thawed: string[] = [];
    drawn.model.traverse((o) => {
      if (o.matrixAutoUpdate) thawed.push(o.name || o.type);
    });
    expect(thawed).toEqual([]);
    const merged = [...(groups.get("props") ?? [])];
    expect(merged.length).toBeGreaterThan(0);
    for (const m of merged) {
      const want = new THREE.Matrix4();
      const chain: THREE.Object3D[] = [];
      for (let n: THREE.Object3D | null = m; n; n = n.parent) chain.unshift(n);
      for (const n of chain) want.multiply(new THREE.Matrix4().compose(n.position, n.quaternion, n.scale));
      const diff = Math.max(...want.elements.map((v, i) => Math.abs(v - m.matrixWorld.elements[i])));
      expect({ mesh: m.name || m.uuid.slice(0, 8), close: diff <= 1e-6 }).toEqual({ mesh: m.name || m.uuid.slice(0, 8), close: true });
    }
  });
});

describe("[spec] 112 ③ 그대로 둘 동작: 계절 흩뿌림 조각의 자리·방향·크기·밝기·그림(명세 바뀌는 동작 1의 '지금과 같다', 그대로여야 할 동작)", () => {
  it("K5 봄·여름·가을마다 그려지는 흩뿌림의 찍은 조각이 그 계절 조각과 하나씩 맞고, 조각마다 네 모서리의 세계 자리와 칸 안 그림 방향이 지금 계산(판 1×1을 눕혀 (x, −0.016, z)·y축 turn·(size, 1, size))과 같으며 그 칸이 조각 칸이고, 인스턴스 색이 (shade, shade, shade)다. 재질은 season-scatter.png 그림에 alphaTest 0.4이고, 흩뿌림은 광선에 맞지 않고 누르기 대상과 엮이지 않는다", async () => {
    const drawn = await draw(sceneFromGlbFull(nowVillageGlb()), "summer");
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const planePos = plane.getAttribute("position");
    const planeUv = plane.getAttribute("uv");
    const up = new THREE.Vector3(0, 1, 0);
    for (const season of SCATTERED) {
      await setSeason(drawn, season);
      const pieces = scatterModule().villageSeasonScatter(season);
      const meshes = scatterMeshes(drawn);
      expect({ season, meshes: meshes.length > 0 }).toEqual({ season, meshes: true });
      const cells = new Map<string, number[]>();
      pieces.forEach((p, i) => {
        const k = `${Math.floor(p.x)},${Math.floor(p.z)}`;
        cells.set(k, [...(cells.get(k) ?? []), i]);
      });
      const used = new Uint8Array(pieces.length);
      const wrong: string[] = [];
      const findPiece = (x: number, z: number, kind: number): number => {
        for (let c = Math.floor(x) - 1; c <= Math.floor(x) + 1; c += 1) {
          for (let r = Math.floor(z) - 1; r <= Math.floor(z) + 1; r += 1) {
            for (const i of cells.get(`${c},${r}`) ?? []) if (!used[i] && pieces[i].kind === kind && Math.abs(pieces[i].x - x) <= 1e-3 && Math.abs(pieces[i].z - z) <= 1e-3) return i;
          }
        }
        return -1;
      };
      const expectedCorners = (p: VillageScatterPiece) => {
        const m4 = new THREE.Matrix4().compose(new THREE.Vector3(p.x, SCATTER_Y, p.z), new THREE.Quaternion().setFromAxisAngle(up, p.turn), new THREE.Vector3(p.size, 1, p.size));
        const out: { p: THREE.Vector3; u: number; v: number }[] = [];
        for (let k = 0; k < planePos.count; k += 1) out.push({ p: new THREE.Vector3().fromBufferAttribute(planePos, k).applyMatrix4(m4), u: planeUv.getX(k), v: planeUv.getY(k) });
        return out;
      };
      const color = new THREE.Color();
      for (const mesh of meshes) {
        const material = materialOf(mesh);
        expect({ season, alphaTest: material.alphaTest, file: material.map ? splatLoader.urlOf.get(material.map) : "그림 없음" }).toEqual({
          season,
          alphaTest: 0.4,
          file: "apps/mobile/assets/textures/village/season-scatter.png"
        });
        const pos = mesh.geometry.getAttribute("position");
        const worlds = instanceWorldMatrices(mesh);
        worlds.forEach((w, i) => {
          if (wrong.length >= 20) return;
          const corners: THREE.Vector3[] = [];
          for (let k = 0; k < pos.count; k += 1) corners.push(new THREE.Vector3().fromBufferAttribute(pos, k).applyMatrix4(w));
          const local = instanceLocalUvs(mesh, i);
          const cell = instanceCell(mesh, i);
          if (typeof local === "string" || typeof cell === "string") {
            wrong.push(`인스턴스 ${i}: ${typeof cell === "string" ? cell : local}`);
            return;
          }
          const mid = corners.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / corners.length);
          const at = findPiece(mid.x, mid.z, cell);
          if (at < 0) {
            wrong.push(`인스턴스 ${i} (${mid.x.toFixed(3)}, ${mid.z.toFixed(3)}) 칸 ${cell}: 그 자리에 남은 칸 ${cell} 조각 없음`);
            return;
          }
          used[at] = 1;
          const want = expectedCorners(pieces[at]);
          const matches = (a: { p: THREE.Vector3; u: number; v: number }, k: number) =>
            a.p.distanceTo(corners[k]) <= 1e-4 && Math.abs(a.u - (local as { u: number; v: number }[])[k].u) <= 1e-4 && Math.abs(a.v - (local as { u: number; v: number }[])[k].v) <= 1e-4;
          const lonelyWant = want.filter((a) => !corners.some((_, k) => matches(a, k)));
          const lonelyGot = corners.filter((_, k) => !want.some((a) => matches(a, k)));
          if (lonelyWant.length || lonelyGot.length) wrong.push(`인스턴스 ${i} 조각 ${at}: 모서리·그림 방향 다름(기대에만 ${lonelyWant.length}, 그린 것에만 ${lonelyGot.length})`);
          if (!mesh.instanceColor) wrong.push(`인스턴스 ${i}: 인스턴스 색 없음`);
          else {
            mesh.getColorAt(i, color);
            const s = pieces[at].shade;
            if (Math.abs(color.r - s) > 1e-5 || Math.abs(color.g - s) > 1e-5 || Math.abs(color.b - s) > 1e-5) wrong.push(`인스턴스 ${i}: 색 ${color.r.toFixed(4)},${color.g.toFixed(4)},${color.b.toFixed(4)} ≠ shade ${s.toFixed(4)}`);
          }
        });
        // 광선에 맞지 않는다(누르기·걷기 판정에 들지 않음)
        const p = pieces[0];
        const hits = new THREE.Raycaster(new THREE.Vector3(p.x, 5, p.z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh, false);
        expect({ season, hits: hits.length }).toEqual({ season, hits: 0 });
        const tangled = drawn.pick.current.some((t) => {
          let related = t === mesh;
          t.traverse((o) => {
            if (o === mesh) related = true;
          });
          mesh.traverseAncestors((a) => {
            if (a === t) related = true;
          });
          return related;
        });
        expect({ season, tangled }).toEqual({ season, tangled: false });
      }
      const missing = pieces.filter((_, i) => !used[i]).length;
      expect({ season, wrong, missing }).toEqual({ season, wrong: [], missing: 0 });
    }
  });
});
