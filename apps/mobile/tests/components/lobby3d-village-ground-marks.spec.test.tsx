// [spec] qa 테스트(작업 101 마을 땅 무늬, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature·VillageModel)에서 본 꽃·풀 장식(3D 모델)과 풀 자국.
// 기대값은 명세(private 작업 폴더 101-2026-11-17-마을-땅-무늬/01-main-spec.md)와 03 결정(01의 1·3을 바꿈)에서만 가져온다.
// 그대로 둘 동작(K8)은 기준 커밋 25e9cc7의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, useFrame으로 계절·가리기를 바꾸는 것,
// 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): S1~S6. 그대로 둘 동작(구현 전·뒤 통과): K8.
//
// 어떻게 보나:
// - react-three-fiber만 가짜로 둔다. 불러오는 방식에 묶이지 않게(03 결정) 가짜 불러오기는 tests/__fixtures__/village-scene-101.ts를 쓴다:
//   마을 모델에는 진짜 glb를 풀어 만든 장면, 그림에는 빈 THREE.Texture, 그 밖의 모델에는 어떤 이름으로 찾아도 작은 상자 메시가 나오는 가짜 모델을 준다.
//   Jest가 읽지 못하는 자산(.glb 등)은 파일마다 "파일 이름" 글자로 바꾼 뒤 마을 그리기 모듈을 require한다.
// - VillageNature와 VillageModel을 마을 화면(lobby3d-canvas의 VillageLayer)처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
//   장식과 자국을 어느 쪽이 그리는지는 가리지 않는다.
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 delta 0.1초로 모두 부른다.
// - "그려진다" = 메시와 그 위 모든 부모의 visible이 true다(인스턴스 메시는 찍는 수가 0이 아니어야 한다).
// - 장식과 자국은 인스턴스로 그린다(명세 3, 03 결정 1). 그래서 마을 모델(glb)의 도형이 아닌 인스턴스 메시 가운데,
//   찍은 자리(세계 변환의 옮김 x, z)가 모두 장식 자리 함수(villageDecorSpots)의 자리와 0.001칸 안에서 맞고 모양에 높이가 있는(0.01칸 넘는) 것을 "장식 메시",
//   모두 자국 자리 함수(villageGrassMarks)의 자리와 맞고 납작한(높이 0.01칸 이하) 것을 "자국 메시"로 본다. 자리 함수의 모양은 village-decor-101.ts 머리말.
//   (큰 얼룩처럼 이 둘에 들지 않는 인스턴스 메시는 보지 않는다.)
//
// 작업 103(마을 흩뿌림·흙길) 명세의 "그 때문에 고칠 기존 테스트"(사용자 2026-11-18 "진행해": 101 qa 테스트 중 풀 자국을 보는 것)로 qa가 고쳤다.
// 103은 풀 자국(계절 색을 곱한 회색 그림 판) 대신 계절마다 다른 색칠된 흩뿌림 조각(가을 낙엽, 봄 꽃잎, 여름 초록 잎, 겨울 없음)을 흩고, 계절 색을 곱하지 않는다.
// - "자국 자리 함수"는 계절마다 villageSeasonScatter(season)이다(모양은 tests/__fixtures__/village-ground-103.ts 머리말). 자국 메시 찾기는 그대로다.
// - S3: 가을·봄·여름마다 그 계절의 조각 자리를 본다(단언은 그대로). S4: "자국 색이 계절 색을 따른다" 대신 "조각 재질 색은 회색이고 계절이 바뀌어도 같으며,
//   인스턴스 색도 회색이다. 겨울에는 조각이 그려지지 않는다". S5·S6: 풀 자국 대신 가을 조각으로 본다(단언은 그대로).
// - 계절을 바꾸면 조각 메시를 새로 만들어도 되지만, 그린 장면의 뿌리(<primitive object>)와 장식 메시는 그대로여야 한다(S2가 같은 메시의 보임을 본다).
//   그래서 S3·S4는 계절을 바꿀 때마다 조각 메시를 다시 찾는다. S1·S2(장식)는 단언·입력이 그대로다.
//
// 작업 106(마을 가게 넣기) 명세의 "그 때문에 고칠 기존 테스트"와 바뀌는 동작 3(옷집 땅 안의 나무 [45.7, 19.2] 한 그루를 근처 빈 풀밭으로 옮긴다. 나무 수 그대로,
// 그대로여야 할 동작: 옮기는 한 그루 말고 나무)으로 qa가 K8을 고쳤다(106 qa 보고 02-qa-tests.md): 옮기는 나무의 옛 자리와 새 자리에 찍힌 그루를 빼고
// 나머지 그루의 찍은 수·자리·계절 색을 견준다. 그 값은 106 기준 커밋 c728f00에서 이 테스트로 잰 값이다(25e9cc7 뒤로 나무는 바뀌지 않았다).
//
// 작업 113(새 나무 모델 넣기) 명세의 "고칠 기존 테스트"(K8의 나무 sha256)로 qa가 K8을 고쳤다(113 qa 보고 02-qa-tests.md): 마을 나무는 Kenney 나무 틀 대신
// 새 나무 모델(WriteLoop_Tree_<A·B·C>_LOD<1·2>.glb)로 그리고, 종류·배율이 바뀌며 그루마다 계절 잎 색을 입히던 것은 없앤다(113 바뀌는 동작 1·2·3·5).
// 나무 자리 계산과 그루 수는 그대로다(113 그대로여야 할 동작). 그래서 K8은 "나무 틀 메시마다 찍은 변환·계절 색" 대신 "새 나무 모델의 잎·줄기 그루 자리(x, y, z)"를
// 옮기는 한 그루(106)를 빼고 견준다. 그 값은 113 기준 커밋 3b11555에서 같은 방법(나무 틀의 잎·줄기 그루 자리)으로 잰 값이다.
// 새 나무 파일은 가짜 불러오기가 앱 자산 폴더의 그 파일을 푼 모델로 준다(tests/__fixtures__/village-trees-113.ts). 장식·흩뿌림(S1~S6)의 단언·입력은 그대로다.
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
import { decorModule, type VillageDecorSpot } from "../__fixtures__/village-decor-101";
import { SCATTER_SEASONS, scatterModule, type VillageScatterPiece } from "../__fixtures__/village-ground-103";
import { MOVED_TREE, newTrees } from "../__fixtures__/village-shops-106";
import {
  allObjects,
  drawnVisible,
  instanceHeight,
  instanceWorldMatrices,
  loaderState,
  mockUnreadableAssets,
  resetFakeLoader,
  sceneFromGlb,
  sourceGeometries
} from "../__fixtures__/village-scene-101";
import { allTreeFilesPresent, resetTreeLoader, treePartOf } from "../__fixtures__/village-trees-113";

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
  // 113: 새 나무 파일은 그 파일을 푼 모델, 그 밖은 101의 가짜
  const fake = (loader: unknown, input: unknown) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const trees = require("../__fixtures__/village-trees-113") as typeof import("../__fixtures__/village-trees-113");
    const scene101 = require("../__fixtures__/village-scene-101") as typeof import("../__fixtures__/village-scene-101");
    /* eslint-enable @typescript-eslint/no-require-imports */
    return trees.treeUseLoader(loader, input, scene101.fakeUseLoader);
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
type Drawn = { roots: THREE.Object3D[]; pick: MutableRefObject<THREE.Object3D[]>; light: Light; source: THREE.Object3D; sim: Sim };

async function draw(season: Season = "summer"): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim: Sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
  const light = lightAt(season);
  const source = (loaderState.village as { scene: THREE.Object3D }).scene;
  const view = await render(
    <>
      <village.VillageNature daylight={light as unknown as DaylightState} />
      <village.VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
    </>
  );
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  expect(roots.length).toBeGreaterThan(0);
  await frames(2);
  return { roots, pick, light, source, sim };
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

// ---------- 장식·자국 메시 찾기 ----------

type Spot = { x: number; z: number };

function spotFinder(spots: Spot[]) {
  const cells = new Map<string, number[]>();
  spots.forEach((s, i) => {
    const k = `${Math.floor(s.x)},${Math.floor(s.z)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(i);
  });
  return (x: number, z: number): number | null => {
    for (let c = Math.floor(x) - 1; c <= Math.floor(x) + 1; c += 1) {
      for (let r = Math.floor(z) - 1; r <= Math.floor(z) + 1; r += 1) {
        for (const i of cells.get(`${c},${r}`) ?? []) if (Math.abs(spots[i].x - x) <= 1e-3 && Math.abs(spots[i].z - z) <= 1e-3) return i;
      }
    }
    return null;
  };
}

type Found = { meshes: THREE.InstancedMesh[]; matched: Set<number> };

/** 그린 장면에서 장식 메시와 자국 메시(머리말의 정의)를 찾는다. 찍은 자리가 맞은 자리 번호도 모은다. */
function findDecorAndMarks(drawn: Drawn, decor: VillageDecorSpot[], marks: VillageScatterPiece[]): { decor: Found; marks: Found } {
  const fromModel = sourceGeometries(drawn.source).all;
  const findDecor = spotFinder(decor);
  const findMark = spotFinder(marks);
  const out = { decor: { meshes: [], matched: new Set<number>() } as Found, marks: { meshes: [], matched: new Set<number>() } as Found };
  for (const o of allObjects(drawn.roots)) {
    if (!(o instanceof THREE.InstancedMesh) || fromModel.has(o.geometry) || o.count === 0) continue;
    const worlds = instanceWorldMatrices(o);
    const points = worlds.map((w) => new THREE.Vector3().setFromMatrixPosition(w));
    const height = Math.max(...worlds.map((w) => instanceHeight(o, w)));
    const decorHits = points.map((p) => findDecor(p.x, p.z));
    const markHits = points.map((p) => findMark(p.x, p.z));
    if (height > 0.01 && decorHits.every((h) => h !== null)) {
      out.decor.meshes.push(o);
      decorHits.forEach((h) => out.decor.matched.add(h!));
    } else if (height <= 0.01 && markHits.every((h) => h !== null)) {
      out.marks.meshes.push(o);
      markHits.forEach((h) => out.marks.matched.add(h!));
    }
  }
  return out;
}

/** 장식 자리와, 계절을 주면 그 계절의 흩뿌림 조각 자리(103: 풀 자국 대신). 장식만 보는 S1·S2는 계절을 주지 않는다(조각 자리 없음). */
function spots(season?: Season) {
  return { decor: decorModule().villageDecorSpots(), marks: season ? scatterModule().villageSeasonScatter(season) : [] };
}

const materialsOf = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]);

const isGray = (c: THREE.Color) => Math.abs(c.r - c.g) < 1e-6 && Math.abs(c.g - c.b) < 1e-6;

/** 그린 장면에서 그려지는 납작한 인스턴스 메시(마을 모델 도형이 아닌 것). 겨울에 조각이 남았는지 볼 때 쓴다. */
function drawnFlatInstances(drawn: Drawn): THREE.InstancedMesh[] {
  const fromModel = sourceGeometries(drawn.source).all;
  return allObjects(drawn.roots).filter((o): o is THREE.InstancedMesh => {
    if (!(o instanceof THREE.InstancedMesh) || fromModel.has(o.geometry) || !drawnVisible(o, drawn.roots)) return false;
    return Math.max(...instanceWorldMatrices(o).map((w) => instanceHeight(o, w))) <= 0.01;
  });
}

const matrixKey = (mesh: THREE.InstancedMesh) => instanceWorldMatrices(mesh).map((m) => m.elements.map((v) => v.toFixed(5)).join(",")).join(";");

const nodeCrypto = (process as unknown as { getBuiltinModule: (id: string) => typeof import("crypto") }).getBuiltinModule("crypto");

jest.setTimeout(180000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  resetTreeLoader();
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
});

// ---------- 바뀔 동작 ----------

describe("[spec] 101 바뀔 동작: 꽃·풀 장식(3D 모델)과 풀 자국 그리기", () => {
  it("S1 장식(01의 3, 03 결정 3): 장식 자리마다 3D 모델(높이가 있는 모양)이 인스턴스로 찍혀 그려지고(여름), 메시 하나가 평균 5개 이상을 찍는다", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const found = findDecorAndMarks(drawn, decor, marks).decor;
    expect(found.meshes.length).toBeGreaterThan(0);
    const missing = decor.filter((_, i) => !found.matched.has(i)).map((s) => `${s.kind} ${s.x.toFixed(2)},${s.z.toFixed(2)}`);
    expect(missing.slice(0, 20)).toEqual([]);
    expect(found.meshes.map((m) => drawnVisible(m, drawn.roots))).toEqual(found.meshes.map(() => true));
    const instances = found.meshes.reduce((sum, m) => sum + m.count, 0);
    expect(instances / found.meshes.length).toBeGreaterThanOrEqual(5);
  });

  it("S2 장식은 겨울에 보이지 않고(눈), 봄·가을에는 다시 보인다(01의 3)", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const meshes = findDecorAndMarks(drawn, decor, marks).decor.meshes;
    expect(meshes.length).toBeGreaterThan(0);
    for (const season of ["winter", "spring", "winter", "autumn"] as Season[]) {
      await setSeason(drawn, season);
      const shown = meshes.map((m) => drawnVisible(m, drawn.roots));
      expect({ season, shown }).toEqual({ season, shown: meshes.map(() => season !== "winter") });
    }
  });

  it.each(SCATTER_SEASONS)("S3 풀 자국(03 결정 1. 103에서 %s 흩뿌림 조각으로 바꿈): 자국 자리마다 그림을 입힌 납작한 판이 인스턴스로 찍혀 그려지고, 판 재질에 그림(map)이 있고 그림의 빈 곳이 비친다(transparent 또는 alphaTest), 메시 하나가 평균 5개 이상을 찍는다", async (season) => {
    const { decor, marks } = spots(season);
    const drawn = await draw("summer");
    if (season !== "summer") await setSeason(drawn, season);
    const found = findDecorAndMarks(drawn, decor, marks).marks;
    expect(found.meshes.length).toBeGreaterThan(0);
    const missing = marks.filter((_, i) => !found.matched.has(i)).map((m) => `${m.x.toFixed(2)},${m.z.toFixed(2)}`);
    expect({ missingCount: missing.length, missing: missing.slice(0, 20) }).toEqual({ missingCount: 0, missing: [] });
    expect(found.meshes.map((m) => drawnVisible(m, drawn.roots))).toEqual(found.meshes.map(() => true));
    for (const mesh of found.meshes) {
      for (const mat of materialsOf(mesh)) {
        const m = mat as THREE.MeshLambertMaterial;
        expect({ map: m.map instanceof THREE.Texture, seeThrough: m.transparent || m.alphaTest > 0 }).toEqual({ map: true, seeThrough: true });
      }
    }
    const instances = found.meshes.reduce((sum, m) => sum + m.count, 0);
    expect(instances / found.meshes.length).toBeGreaterThanOrEqual(5);
  });

  it("S4 흩뿌림 조각은 계절 색을 곱하지 않는다(103 명세 1. 101의 '자국 색은 계절 색을 따른다'를 바꿈): 가을·봄·여름의 조각 재질 색은 모두 같은 회색(r = g = b)이고 인스턴스 색도 회색이다. 겨울에는 조각(납작한 인스턴스)이 그려지지 않는다", async () => {
    const drawn = await draw("summer");
    const colors: string[] = [];
    for (const season of ["summer", "autumn", "spring", "winter", "summer"] as Season[]) {
      await setSeason(drawn, season);
      if (season === "winter") {
        expect({ season, drawn: drawnFlatInstances(drawn).map((m) => `${m.name || "이름 없음"} ${m.count}개`) }).toEqual({ season, drawn: [] });
        continue;
      }
      const { decor, marks } = spots(season);
      const meshes = findDecorAndMarks(drawn, decor, marks).marks.meshes;
      expect({ season, meshes: meshes.length > 0 }).toEqual({ season, meshes: true });
      const notGray: string[] = [];
      for (const mesh of meshes) {
        for (const mat of materialsOf(mesh)) {
          const c = (mat as THREE.MeshLambertMaterial).color;
          colors.push(c.getHexString());
          if (!isGray(c)) notGray.push(`재질 ${c.getHexString()}`);
        }
        if (mesh.instanceColor) {
          const ic = new THREE.Color();
          for (let i = 0; i < mesh.count; i += 1) {
            mesh.getColorAt(i, ic);
            if (!isGray(ic)) notGray.push(`인스턴스 ${i} ${ic.getHexString()}`);
          }
        }
      }
      expect({ season, notGray: notGray.slice(0, 10) }).toEqual({ season, notGray: [] });
    }
    expect([...new Set(colors)].length).toBe(1);
  });

  it("S5 장식과 자국은 누르기 대상이 아니다(01의 3, 03 결정 1. 103에서 자국 대신 가을 흩뿌림 조각): 누르기 판정 목록에 없고, 목록의 물체 아래에도 위에도 없다", async () => {
    const { decor, marks } = spots("autumn");
    const drawn = await draw("autumn");
    const found = findDecorAndMarks(drawn, decor, marks);
    const ours = [...found.decor.meshes, ...found.marks.meshes];
    expect(ours.length).toBeGreaterThan(0);
    const tangled: string[] = [];
    for (const target of drawn.pick.current) {
      for (const mesh of ours) {
        let related = mesh === target;
        target.traverse((o) => {
          if (o === mesh) related = true;
        });
        mesh.traverseAncestors((a) => {
          if (a === target) related = true;
        });
        if (related) tangled.push(`${target.name || target.type} ↔ ${mesh.name || mesh.type}`);
      }
    }
    expect(tangled).toEqual([]);
  });

  it("S6 라룹이가 지나가도 장식과 자국은 그대로다(01의 3. 103에서 자국 대신 가을 흩뿌림 조각): 라룹이를 장식 자리와 자국 자리에 세우고 프레임을 돌려도 찍은 자리와 보임이 같다", async () => {
    const { decor, marks } = spots("autumn");
    const drawn = await draw("autumn");
    const found = findDecorAndMarks(drawn, decor, marks);
    const ours = [...found.decor.meshes, ...found.marks.meshes];
    expect(found.decor.meshes.length > 0 && found.marks.meshes.length > 0).toBe(true);
    const before = ours.map((m) => ({ at: matrixKey(m), shown: drawnVisible(m, drawn.roots) }));
    for (const p of [decor[0], decor[Math.floor(decor.length / 2)], marks[0], marks[Math.floor(marks.length / 2)]]) {
      drawn.sim.x = p.x;
      drawn.sim.z = p.z;
      await frames(3);
      const after = ours.map((m) => ({ at: matrixKey(m), shown: drawnVisible(m, drawn.roots) }));
      expect(after).toEqual(before);
    }
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 101 그대로 둘 동작: 나무(113에서 고침)", () => {
  // 나무 = 새 나무 모델(113)의 메시 도형으로 찍은 인스턴스 메시(tests/__fixtures__/village-trees-113.ts의 treePartOf). 잎(Tree_Foliage)과 줄기(Tree_Wood)마다
  // 카메라 없이 그린 그루 자리(세계 변환의 옮김 x, y, z, 소수 셋째 자리)를 정렬해 줄로 이은 글의 sha256을 113 기준 커밋 3b11555에서 같은 방법으로 잰 값과 견준다.
  // 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(마을 나무 수와 자리)로 qa가 K8의 기대값을 고쳤다(115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md).
  // 115는 마을 나무 70그루 가운데 원(가운데 (29, 26), 반지름 26) 가운데까지 24.5 넘게 먼 42그루를 빼고, 둘레 숲에서 풍차 둘레를 비우던 규칙을 없앤다.
  // 둘레 숲 자리는 같은 씨앗 수열을 마을 나무 다음에 쓰므로 모두 새 자리가 된다. 새 그루 수·sha256은 115 기준 커밋 de49aef의 나무 자리 계산에
  // 115의 바뀜(마을 나무 28그루, 풍차 둘레 비우기 없앰)만 넣어 같은 방법으로 잰 값이다. 단언 방법(옮기는 한 그루 빼기, 잎·줄기 그루 자리)은 그대로다.
  it("K8 나무 자리가 기준 커밋과 같다(01 그대로: 나무. 106: 옮기는 한 그루는 옛 자리·새 자리 모두 뺀다. 113: 새 나무 모델의 잎·줄기 그루 자리로 보고 계절 잎 색은 보지 않는다. 115: 원 밖 나무를 빼고 풍차 둘레를 채운 새 자리)", async () => {
    const drawn = await draw("summer");
    expect({ treeFilesInApp: allTreeFilesPresent() }).toEqual({ treeFilesInApp: true });
    const trees = allObjects(drawn.roots).filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && treePartOf(o.geometry) !== null);
    expect(trees.length).toBeGreaterThan(0);
    // 106이 옮기는 나무(옛 자리와 새 자리)에 찍힌 그루는 뺀다
    const moved = [MOVED_TREE, ...newTrees()];
    const rows = (["foliage", "wood"] as const).map((part) => {
      const spots = trees
        .filter((m) => treePartOf(m.geometry)!.part === part)
        .flatMap((m) => instanceWorldMatrices(m))
        .filter((w) => !moved.some(([x, z]) => Math.abs(w.elements[12] - x) < 0.01 && Math.abs(w.elements[14] - z) < 0.01))
        .map((w) => `${w.elements[12].toFixed(3)},${w.elements[13].toFixed(3)},${w.elements[14].toFixed(3)}`)
        .sort();
      return { part, count: spots.length, digest: nodeCrypto.createHash("sha256").update(spots.join("\n")).digest("hex") };
    });
    expect(rows).toEqual([
      { part: "foliage", count: K8_TREES, digest: K8_DIGEST },
      { part: "wood", count: K8_TREES, digest: K8_DIGEST }
    ]);
  });
});

/** 113 기준 커밋 3b11555에서 잰 값(옮기는 한 그루를 뺀 그루 수와 자리 글의 sha256). 115 전 값: 369, "b05d9abc8108350c10a722ce8f36038e0f337c93a0bf2484e0fb487e3f56841c". */
// 115: 마을 안 28 + 둘레 숲 287 − 옮긴 한 그루 = 314(K8 위 설명)
const K8_TREES = 314;
const K8_DIGEST = "6330fbb501a07ebc437d965b861bb6b09748f197aebeb68159852243ab5d39a3";
