// [spec] qa 테스트(작업 111 마을 보이는 것만 그리기, 기능 변경, 모바일): 마을 나무(나무 틀 tpl-<종류>-leaf/trunk로 찍은 인스턴스 메시)와
// 3D 꽃·풀 장식(village-flowers.glb의 종류별 메시로 찍은 인스턴스 메시)을 카메라 시야에 드는 인스턴스만 그리는 것.
// 바뀌는 동작의 기대값은 명세(private 작업 폴더 111-2026-11-18-마을-보이는-것만-그리기/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작의 값(카메라 없을 때 그려지는 나무·장식의 자리·계절 색, 메시 수)은 기준 커밋 1d07fa9의 지금 동작에서 이 테스트로 잰 값이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets,
// useFrame으로 프레임마다 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 어떻게 보나(101 qa 테스트 lobby3d-village-ground-marks.spec.test.tsx와 같은 가짜 환경):
// - react-three-fiber만 가짜로 둔다. 가짜 불러오기는 tests/__fixtures__/village-scene-101.ts(마을 모델은 진짜 glb를 푼 장면, 장식 모델은 작은 상자 메시).
// - VillageNature와 VillageModel을 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 delta 0.1초로 모두 부른다. 프레임 함수가 받는 상태는 테스트가 고른다:
//   카메라 없음({} 또는 { camera: null })이거나 { camera: 테스트가 만든 PerspectiveCamera }. 테스트는 카메라 자리·방향·투영을 바꾼 뒤
//   updateProjectionMatrix()와 updateMatrixWorld(true)를 불러 두어, 자리·방향(position·quaternion)과 행렬이 같은 값을 갖게 한다.
// - "그려지는 인스턴스" = three.js가 인스턴스 메시를 그리는 방법 그대로: 메시와 그 위 모든 부모가 visible이면 0번부터 count-1번까지의 인스턴스
//   (그 자리의 instanceMatrix 행렬, 있으면 instanceColor 색). 보이지 않으면 하나도 없다. 인스턴스 순서는 보지 않는다(명세: 순서는 바뀌어도 된다).
//   인스턴스는 행렬(소수 다섯째 자리)로 알아본다.
// - "인스턴스의 공" = 그 메시 도형의 boundingSphere를 (메시의 세계 변환 × 그 인스턴스의 행렬)로 옮긴 것(명세 '시야에 든다'의 기준).
//   카메라 시야 = THREE.Frustum.setFromProjectionMatrix(카메라 projectionMatrix × matrixWorldInverse).
//   공이 여섯 면 모두에서 안쪽으로 1e-3칸 넘게 걸치면 "분명히 든다", 어느 한 면에서 바깥으로 1e-3칸 넘게 벗어나면 "분명히 안 든다"로 본다.
//   그 사이(경계에 거의 닿는 것)는 계산 오차로 갈릴 수 있어 보지 않는다.
// - 기준 자료: 같은 테스트에서 먼저 카메라 없이 계절마다 그려 둔 인스턴스(행렬 → 계절 색). 카메라가 없을 때 그려지는 것이 지금과 같은지는 K1이 본다.
//
// 바뀔 동작(구현 전 실패): S1, S2, S3, S4, S5.
// 그대로 둘 동작(구현 전·뒤 통과): K1~K5. 그중 K4·K5는 명세의 "바뀌는 동작"에 적힌 제약(메시 boundingSphere, 같은 카메라면 다시 쓰지 않음,
// 카메라가 없어지면 모두 그림)이지만 지금 코드도 이미 만족하므로 구현 전에도 통과해야 한다.
//
// 작업 113(새 나무 모델 넣기) 명세의 "고칠 기존 테스트"(111 qa 테스트의 나무 틀 찾기)로 qa가 고쳤다(113 qa 보고 02-qa-tests.md):
// 113은 마을 나무를 Kenney 나무 틀 대신 새 나무 모델(WriteLoop_Tree_<A·Pine>_LOD<1·2>.glb(116: 113의 A·B·C에서 바뀜))로 종류 × 단계 × 부품마다 인스턴스 메시 하나로 그리고(12개),
// 그루마다 계절 잎 색을 입히던 것을 없애며(잎은 그루마다 계절과 관계없는 밝기), 계절은 그림 칸으로 보이고 겨울에는 잎을 그리지 않는다(113 바뀌는 동작 1·4·5·6).
// 시야 고르기(111·112-①)는 그대로 받는다. 그래서:
// - "나무 메시"는 나무 틀 도형 대신 새 나무 모델의 메시 도형으로 찍은 인스턴스 메시로 찾는다(tests/__fixtures__/village-trees-113.ts의 treePartOf).
//   이름표는 <종류>-LOD<단계>-leaf(잎 Tree_Foliage) / -trunk(줄기 Tree_Wood)다. 가짜 불러오기는 새 나무 파일에 앱 자산 폴더의 그 파일을 푼 모델을 준다.
// - S5: "여름 색과 가을 색이 다른 잎이 있다" 대신, 가을로 바뀐 뒤 그려지는 잎 메시가 가을 칸(glTF UV + (0, 0.5))을 그리는지 본다(113 바뀌는 동작 4).
// - K1: 나무는 메시 12개이고 계절마다 모든 그루를 그리되 겨울에는 잎을 그리지 않는지(113 바뀌는 동작 4·6)를 보고, 기준 sha256은 장식만으로 다시 쟀다
//   (113 기준 커밋 3b11555. 장식은 113이 바꾸지 않는다).
// 작업 116(나무 A·Pine 세트) 명세의 "고칠 기존 테스트"(메시 수, 겨울 잎 숨기기)로 qa가 고쳤다(116 qa 보고 02-qa-tests.md):
// - K1: 나무 메시는 8개(종류 A·Pine × 단계 × 부품)이고, 겨울에는 A 잎 메시만 그리지 않고 Pine 잎 메시는 모든 그루를 그린다. 기준 sha256은 그대로다(장식만이다).
// - K3: 흩뿌림을 가려낼 때 나무 메시도 뺀다(나무 틀 도형은 마을 모델 도형이라 빠졌으나 새 나무 도형은 아니다).
// - K5: "계절이 바뀌면 잎 메시의 instanceColor version이 늘고 새 계절 색" 대신 "계절이 바뀌어도 잎 색은 기준 그대로"(113 바뀌는 동작 5)만 본다.
// 장식·흩뿌림에 대한 단언과 입력은 그대로다.
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(마을 나무 수와 자리, 사각형 가장자리 막힌 칸)로 qa가 K1·S2를 고쳤다(115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md):
// - K1: 장식만으로 잰 sha256을 새 값으로 바꿨다. 115는 원 밖 칸을 막아 장식 자리가 따라 바뀐다(명세 "그대로여야 할 동작": 장식은 막힌 칸을 피하고, 그 때문에
//   장식 자리가 바뀌는 것은 허용). 새 값은 115 기준 커밋 de49aef의 장식 자리 계산에 115의 막힌 칸만 넣어 잰 값이다. 메시 수·블록 수는 그대로다.
// - S2: "옮김(반대쪽)" 카메라를 FAR_SIDE(60, 10) 대신 마을 오른쪽 바깥 둘레 숲을 보는 S2_FAR_SIDE로 바꿨다. 115에서 FAR_SIDE 둘레의 마을 나무가
//   빠져(원 밖) 그 자리에서 시야각 14로 좁힌 뒤 가로세로비를 바꿔도 분명히 드는 인스턴스 수가 그대로라, "바꾼 것이 실제로 시야를 바꾸는지" 전제가 서지 않는다.
//   둘레 숲은 ①에서 그대로라 S2_FAR_SIDE는 115 전·뒤 모두 전제가 선다. 단언(바꾼 바로 그 프레임 뒤 새 시야를 따른다)은 그대로다.
// 작업 115 ②(숲과 땅 꾸밈) 명세의 "고칠 기존 테스트"(둘레 숲의 자리)로 qa가 S2를 다시 고쳤다(115 ② qa 보고 03-숲과-땅-꾸밈/02-qa-tests.md):
// - S2: S2_FAR_SIDE를 (74, 20) 대신 마을 뒤쪽 바깥 (29, −4)로 옮겼다. 115 ②가 둘레 숲을 원 둘레 바깥에 새로 심어(카메라가 보여 줄 수 있는 곳까지)
//   마을 오른쪽 멀리 (74, 20)에는 숲이 남지 않을 수 있다. (29, −4)는 지금 숲(옛 사각형 뒤끝 밖)에도, 115 ② 숲(원 밖이면서 카메라가 보여 줄 수 있는 땅)에도 든다.
//   단언은 그대로다. K1(장식 sha256)은 115 ②에서 장식 자리가 바뀌지 않아(지금 장식은 모두 원 안) 고치지 않았다.
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
import { decorModule } from "../__fixtures__/village-decor-101";
import { scatterModule } from "../__fixtures__/village-ground-103";
import { allObjects, instanceHeight, loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb, sourceGeometries } from "../__fixtures__/village-scene-101";
import { FOLIAGE_OFFSET, resetTreeLoader, treePartOf, uvShiftError } from "../__fixtures__/village-trees-113";

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

jest.setTimeout(240000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  resetTreeLoader();
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
});

// ---------- 그리기 ----------

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

type Kind = "leaf" | "trunk" | "decor" | "scatter";
type Tracked = { mesh: THREE.InstancedMesh; kind: Kind; label: string };
type Drawn = { roots: THREE.Object3D[]; light: Light; source: THREE.Object3D; trees: Tracked[]; decor: Tracked[] };

/** 프레임 상태. 카메라 없음은 {}(상태에 카메라 없음) 또는 { camera: null }. */
type FrameState = { camera?: THREE.Camera | null };

async function frames(count: number, state: FrameState = {}) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f(state, 0.1);
  });
}

async function setSeason(drawn: Drawn, season: Season, state: FrameState = {}) {
  const next = lightAt(season);
  drawn.light.ambience = next.ambience;
  drawn.light.target = next.target;
  await frames(2, state);
}

/** 나무 메시(113: 새 나무 모델의 메시 도형으로 찍은 인스턴스 메시. 이름표는 <종류>-LOD<단계>-leaf/trunk)와 장식 메시(모델 도형이 아니고 높이가 있으며 찍은 자리가 모두 장식 자리인 인스턴스 메시). 카메라 없이 처음 그린 뒤 찾는다. */
function findTracked(roots: THREE.Object3D[], source: THREE.Object3D): { trees: Tracked[]; decor: Tracked[] } {
  const treeName = (geometry: THREE.BufferGeometry) => {
    const info = treePartOf(geometry);
    return info ? `${info.kind}-LOD${info.lod}-${info.part === "foliage" ? "leaf" : "trunk"}` : undefined;
  };
  const fromModel = sourceGeometries(source).all;
  const decorSpots = decorModule().villageDecorSpots();
  const isDecorSpot = (x: number, z: number) => decorSpots.some((s) => Math.abs(s.x - x) <= 1e-3 && Math.abs(s.z - z) <= 1e-3);
  const trees: Tracked[] = [];
  const decor: Tracked[] = [];
  for (const o of allObjects(roots)) {
    if (!(o instanceof THREE.InstancedMesh)) continue;
    const name = treeName(o.geometry);
    if (name) {
      expect({ name, part: /-(leaf|trunk)$/.test(name) }).toEqual({ name, part: true });
      trees.push({ mesh: o, kind: name.endsWith("-leaf") ? "leaf" : "trunk", label: name });
      continue;
    }
    if (fromModel.has(o.geometry) || o.count === 0) continue;
    const worlds = instanceWorld(o);
    const height = Math.max(...worlds.map((w) => instanceHeight(o, w)));
    if (height > 0.01 && worlds.every((w) => isDecorSpot(w.elements[12], w.elements[14]))) decor.push({ mesh: o, kind: "decor", label: `decor-${decor.length}` });
  }
  return { trees, decor };
}

async function draw(season: Season = "summer"): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
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
  const found = findTracked(roots, source);
  expect(found.trees.length).toBeGreaterThan(0);
  expect(found.decor.length).toBeGreaterThan(0);
  return { roots, light, source, ...found };
}

// ---------- 그려지는 인스턴스 ----------

function instanceWorld(mesh: THREE.InstancedMesh, upTo = mesh.count): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  for (let i = 0; i < upTo; i += 1) {
    mesh.getMatrixAt(i, m);
    out.push(new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, m));
  }
  return out;
}

function shownChain(o: THREE.Object3D, roots: THREE.Object3D[]): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if (roots.includes(n)) return true;
  }
  return false;
}

const keyOf = (m: THREE.Matrix4) => m.elements.map((v) => (Math.abs(v) < 5e-6 ? 0 : v).toFixed(5)).join(",");

type Inst = { key: string; world: THREE.Matrix4; color: string | null };

/** 지금 그려지는 인스턴스(머리말 정의). */
function drawnInstances(t: Tracked, roots: THREE.Object3D[]): Inst[] {
  for (const r of roots) r.updateMatrixWorld(true);
  if (!shownChain(t.mesh, roots)) return [];
  const c = new THREE.Color();
  return instanceWorld(t.mesh).map((world, i) => {
    let color: string | null = null;
    if (t.mesh.instanceColor) {
      t.mesh.getColorAt(i, c);
      color = c.getHexString();
    }
    return { key: keyOf(world), world, color };
  });
}

/** 카메라 없이 계절마다 그려 둔 기준 자료: 메시마다 행렬 → { 세계 행렬, 계절별 색 }. */
type Baseline = Map<Tracked, Map<string, { world: THREE.Matrix4; colors: Partial<Record<Season, string | null>> }>>;

async function baseline(drawn: Drawn, seasons: Season[]): Promise<Baseline> {
  const out: Baseline = new Map();
  const all = [...drawn.trees, ...drawn.decor];
  for (const season of seasons) {
    await setSeason(drawn, season, {});
    for (const t of all) {
      const list = drawnInstances(t, drawn.roots);
      if (season === seasons[0]) {
        const keys = new Set(list.map((i) => i.key));
        // 행렬로 인스턴스를 알아보려면 한 메시 안에서 행렬이 겹치지 않아야 한다
        expect({ mesh: t.label, unique: keys.size === list.length, all: list.length === t.mesh.count }).toEqual({ mesh: t.label, unique: true, all: true });
        out.set(t, new Map(list.map((i) => [i.key, { world: i.world, colors: {} }])));
      }
      const table = out.get(t)!;
      for (const i of list) {
        const row = table.get(i.key);
        if (row) row.colors[season] = i.color;
      }
    }
  }
  return out;
}

// ---------- 카메라와 시야 ----------

const PITCH = (42 * Math.PI) / 180;

/** 마을 카메라처럼 앞(+z) 위에서 42도로 내려다보는 원근 카메라. look = 보는 바닥 점, viewWidth = 보는 점 깊이에서 화면 가로에 보이는 폭(칸). */
function villageCamera(look: { x: number; z: number }, viewWidth = 9, fov = 30, aspect = 0.5): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 1, 200);
  aimCamera(camera, look, viewWidth);
  return camera;
}

function aimCamera(camera: THREE.PerspectiveCamera, look: { x: number; z: number }, viewWidth = 9) {
  const tanH = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
  const dist = viewWidth / (2 * tanH);
  camera.position.set(look.x, dist * Math.sin(PITCH), look.z + dist * Math.cos(PITCH));
  camera.lookAt(look.x, 0, look.z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

const EPS = 1e-3;

/** 인스턴스의 공이 시야에 "in"(분명히 든다), "out"(분명히 안 든다), "edge"(경계). */
function classify(t: Tracked, world: THREE.Matrix4, camera: THREE.Camera): "in" | "out" | "edge" {
  const geometry = t.mesh.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!.clone().applyMatrix4(world);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let least = Infinity;
  for (const plane of frustum.planes) least = Math.min(least, plane.distanceToPoint(sphere.center) + sphere.radius);
  if (least < -EPS) return "out";
  if (least > EPS) return "in";
  return "edge";
}

type Check = { mesh: string; unknown: number; duplicated: number; missingIn: number; drawnOut: number; wrongColor: number };

/** 메시마다: 그려지는 인스턴스가 기준 자료의 행렬이고(겹치지 않고), 분명히 드는 것은 모두 그려지고, 분명히 안 드는 것은 그려지지 않으며, 색이 그 계절 기준 색이다. */
function checkView(drawn: Drawn, base: Baseline, camera: THREE.Camera, season: Season, meshes: Tracked[]): { checks: Check[]; counts: Record<"in" | "out" | "edge", number> } {
  const counts = { in: 0, out: 0, edge: 0 };
  const checks = meshes.map((t) => {
    const table = base.get(t)!;
    const list = drawnInstances(t, drawn.roots);
    const seen = new Map<string, number>();
    let unknown = 0;
    let wrongColor = 0;
    for (const i of list) {
      seen.set(i.key, (seen.get(i.key) ?? 0) + 1);
      const row = table.get(i.key);
      if (!row) unknown += 1;
      else if (row.colors[season] !== undefined && row.colors[season] !== i.color) wrongColor += 1;
    }
    let missingIn = 0;
    let drawnOut = 0;
    for (const [key, row] of table) {
      const c = classify(t, row.world, camera);
      counts[c] += 1;
      if (c === "in" && !seen.has(key)) missingIn += 1;
      if (c === "out" && seen.has(key)) drawnOut += 1;
    }
    const duplicated = [...seen.values()].filter((n) => n > 1).length;
    return { mesh: t.label, unknown, duplicated, missingIn, drawnOut, wrongColor };
  });
  return { checks, counts };
}

const clean = (checks: Check[]) => checks.map((c) => ({ mesh: c.mesh, unknown: 0, duplicated: 0, missingIn: 0, drawnOut: 0, wrongColor: 0 }));

/** 라룹이 집 문 앞을 보는 카메라(마을 가운데쯤). */
const cameraAtStart = () => villageCamera(VILLAGE_START);
/** 마을 왼쪽 앞 구석(둘레 숲)을 보는 카메라. */
const CORNER = { x: 6, z: 52 };
/** 마을 오른쪽 뒤를 보는 카메라. */
const FAR_SIDE = { x: 60, z: 10 };
/**
 * 115: S2의 "옮김(반대쪽)" 카메라. 마을 바깥 둘레 숲을 본다. 115 ① 값은 마을 오른쪽 바깥 (74, 20)이었다.
 * 115 ②: 둘레 숲을 원 둘레에 새로 심어 (74, 20) 둘레에 숲이 남는다고 할 수 없다(명세는 카메라가 보여 줄 수 있는 곳까지 채운다고만 한다).
 * 그래서 115 ② 전·뒤 모두 숲이 서는 마을 뒤쪽 바깥(원 가운데에서 30칸, 카메라가 보여 줄 수 있는 땅 z −6 안쪽, 옛 사각형 뒤끝 밖)으로 옮겼다.
 */
const S2_FAR_SIDE = { x: 29, z: -4 };
/** 장식이 모인 곳을 보는 카메라(첫 장식 자리를 본다). */
const decorLook = () => {
  const d = decorModule().villageDecorSpots()[0];
  return { x: d.x, z: d.z };
};
/** 마을에서 멀리 떨어져 마을 반대쪽을 보는 카메라(시야에 나무·장식이 하나도 없다). */
function emptyCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(30, 0.5, 1, 200);
  camera.position.set(1000, 10, 1000);
  camera.lookAt(1100, 10, 1000);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

// ---------- 바뀔 동작 ----------

describe("[spec] 111 바뀔 동작: 나무·꽃풀 장식은 카메라 시야에 드는 인스턴스만 그린다", () => {
  it("S1 시야에 드는 것만(명세 바뀌는 동작 1·2·3): 마을 카메라를 프레임 상태로 주면, 나무(잎·줄기)·장식 메시마다 공이 시야에 분명히 드는 인스턴스는 모두 그려지고 분명히 안 드는 인스턴스는 그려지지 않으며, 그려지는 인스턴스는 카메라 없을 때와 같은 행렬과 지금 계절 색이다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    const looks = [VILLAGE_START, CORNER, FAR_SIDE, decorLook()];
    // 이 시야들이 실제로 무언가를 가르는지(나무는 시야마다, 장식은 장식을 보는 시야에서 분명히 드는 것과 분명히 안 드는 것이 모두 있는지)
    for (const look of looks) {
      const trees = checkView(drawn, base, villageCamera(look), "summer", drawn.trees).counts;
      expect({ look, treeIn: trees.in > 0, treeOut: trees.out > 0 }).toEqual({ look, treeIn: true, treeOut: true });
    }
    const decorCounts = checkView(drawn, base, villageCamera(decorLook()), "summer", drawn.decor).counts;
    expect({ decorIn: decorCounts.in > 0, decorOut: decorCounts.out > 0 }).toEqual({ decorIn: true, decorOut: true });
    for (const look of looks) {
      const camera = villageCamera(look);
      await frames(2, { camera });
      const view = checkView(drawn, base, camera, "summer", [...drawn.trees, ...drawn.decor]);
      expect({ look, checks: view.checks }).toEqual({ look, checks: clean(view.checks) });
    }
  });

  it("S2 그 프레임의 카메라 값(명세 바뀌는 동작 1 '그 프레임에 카메라에 들어 있는 값'): 같은 카메라 물체의 자리·방향을 옮기거나 투영(시야각)을 바꾸면, 바꾼 바로 그 프레임 뒤에 그려지는 인스턴스가 새 시야를 따른다(S1과 같은 기준)", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    const camera = villageCamera(VILLAGE_START);
    const all = [...drawn.trees, ...drawn.decor];
    await frames(2, { camera });
    const steps: [string, () => void][] = [
      ["옮김(구석)", () => aimCamera(camera, CORNER)],
      ["옮김(반대쪽)", () => aimCamera(camera, S2_FAR_SIDE)],
      [
        "투영(시야각 30 → 14)",
        () => {
          camera.fov = 14;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);
        }
      ],
      [
        "투영(가로세로비 0.5 → 1.2)",
        () => {
          camera.aspect = 1.2;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);
        }
      ]
    ];
    // 바꾼 것이 실제로 시야를 바꾸는지(분명히 드는 인스턴스 수가 달라졌는지): 같은 바꿈을 먼저 차례로 해 보고 되돌린다
    const start = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov, aspect: camera.aspect };
    for (const [step, change] of steps) {
      const before = checkView(drawn, base, camera, "summer", all).counts;
      change();
      const after = checkView(drawn, base, camera, "summer", all).counts;
      expect({ step, changed: after.in !== before.in }).toEqual({ step, changed: true });
    }
    camera.position.copy(start.position);
    camera.quaternion.copy(start.quaternion);
    camera.fov = start.fov;
    camera.aspect = start.aspect;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    await frames(2, { camera });
    for (const [step, change] of steps) {
      change();
      await frames(1, { camera });
      const now = checkView(drawn, base, camera, "summer", all);
      expect({ step, checks: now.checks }).toEqual({ step, checks: clean(now.checks) });
    }
  });

  it("S3 그릴 것이 없는 메시(명세 바뀌는 동작 4): 시야에 나무·장식이 하나도 없는 카메라면 나무·장식 메시마다 그려지는 인스턴스가 0개다. 다시 마을을 보면 S1 기준대로 그려진다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    const all = [...drawn.trees, ...drawn.decor];
    const camera = emptyCamera();
    // 이 카메라 시야에는 분명히 안 드는 인스턴스만 있다
    expect(checkView(drawn, base, camera, "summer", all).counts).toEqual({ in: 0, out: all.reduce((n, t) => n + base.get(t)!.size, 0), edge: 0 });
    await frames(2, { camera });
    expect(all.map((t) => ({ mesh: t.label, drawn: drawnInstances(t, drawn.roots).length }))).toEqual(all.map((t) => ({ mesh: t.label, drawn: 0 })));
    const back = cameraAtStart();
    await frames(1, { camera: back });
    const view = checkView(drawn, base, back, "summer", all);
    expect(view.checks).toEqual(clean(view.checks));
  });

  it("S4 잎과 줄기는 따로(명세 바뀌는 동작 2 '나무의 잎과 줄기는 부품마다 따로 판단한다'): 한 그루의 잎 공은 시야에 분명히 들고 줄기 공은 분명히 안 들면(또는 그 반대) 그 그루의 잎만(줄기만) 그려진다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    // 같은 종류의 잎·줄기 메시 짝. 그루는 자리·방향·크기 행렬이 같은 것끼리 짝짓는다(잎·줄기는 같은 행렬로 찍는다: 카메라 없을 때 기준 자료로 확인)
    const byKind = new Map<string, { leaf?: Tracked; trunk?: Tracked }>();
    for (const t of drawn.trees) {
      const kind = t.label.replace(/^tpl-/, "").replace(/-(leaf|trunk)$/, "");
      const pair = byKind.get(kind) ?? {};
      pair[t.kind as "leaf" | "trunk"] = t;
      byKind.set(kind, pair);
    }
    const looks = [VILLAGE_START, CORNER, FAR_SIDE, { x: 35, z: 30 }, { x: 20, z: 40 }, { x: 50, z: 45 }];
    const rows: { got: unknown; want: unknown }[] = [];
    for (const look of looks) {
      const camera = villageCamera(look);
      await frames(1, { camera });
      for (const [kind, { leaf, trunk }] of byKind) {
        if (!leaf || !trunk) continue;
        const leafDrawn = new Set(drawnInstances(leaf, drawn.roots).map((i) => i.key));
        const trunkDrawn = new Set(drawnInstances(trunk, drawn.roots).map((i) => i.key));
        for (const [key, row] of base.get(leaf)!) {
          if (!base.get(trunk)!.has(key)) continue;
          const l = classify(leaf, row.world, camera);
          const t = classify(trunk, row.world, camera);
          if (!((l === "in" && t === "out") || (l === "out" && t === "in"))) continue;
          rows.push({
            got: { look, kind, leaf: l, trunk: t, leafDrawn: leafDrawn.has(key), trunkDrawn: trunkDrawn.has(key) },
            want: { look, kind, leaf: l, trunk: t, leafDrawn: l === "in", trunkDrawn: t === "in" }
          });
        }
      }
    }
    // 이 시야들에 잎·줄기가 갈리는 그루가 실제로 있어야 이 테스트가 뜻이 있다
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.got)).toEqual(rows.map((r) => r.want));
  });

  it("S5 계절이 바뀐 뒤 시야에 들어온 그루(명세 바뀌는 동작 3. 113에서 고침: 가을 색 대신 가을 칸): 여름에 마을 가운데를 보다가 그대로 가을로 바뀐 뒤 구석으로 옮기면, 그때 그려지는 잎은 가을 모습(잎 메시가 가을 칸, 색은 기준 그대로)이다(가을로 바뀔 때 시야 밖이던 그루 포함). 그려지는 인스턴스는 S1 기준을 따른다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["autumn", "summer"]);
    const camera = cameraAtStart();
    // 가을로 바뀔 때 시야에 분명히 안 들었다가 구석 시야에 분명히 드는 잎이 있어야 한다
    const corner = villageCamera(CORNER);
    let newcomers = 0;
    for (const t of drawn.trees.filter((x) => x.kind === "leaf")) {
      for (const row of base.get(t)!.values()) if (classify(t, row.world, camera) === "out" && classify(t, row.world, corner) === "in") newcomers += 1;
    }
    expect(newcomers).toBeGreaterThan(0);
    await frames(2, { camera });
    await setSeason(drawn, "autumn", { camera });
    const atStart = checkView(drawn, base, camera, "autumn", drawn.trees);
    expect(atStart.checks).toEqual(clean(atStart.checks));
    aimCamera(camera, CORNER);
    await frames(1, { camera });
    const atCorner = checkView(drawn, base, camera, "autumn", drawn.trees);
    expect(atCorner.checks).toEqual(clean(atCorner.checks));
    // 113: 그려지는 잎이 있는 잎 메시는 가을 칸을 그린다
    const leafDrawn = drawn.trees.filter((t) => t.kind === "leaf" && drawnInstances(t, drawn.roots).length > 0);
    expect(leafDrawn.length).toBeGreaterThan(0);
    expect(leafDrawn.map((t) => ({ mesh: t.label, autumnCell: uvShiftError(t.mesh, treePartOf(t.mesh.geometry)!, FOLIAGE_OFFSET.autumn) <= 1e-5 }))).toEqual(
      leafDrawn.map((t) => ({ mesh: t.label, autumnCell: true }))
    );
  });
});

// ---------- 그대로 둘 동작 ----------

const nodeCrypto = (process as unknown as { getBuiltinModule: (id: string) => typeof import("crypto") }).getBuiltinModule("crypto");

/**
 * 그려지는 장식을 순서와 관계없이 적은 글의 sha256. 메시마다 계절별로 그려지는 인스턴스의 행렬·색을 정렬해 적는다.
 * 113: 나무는 글에 넣지 않고, 계절마다 나무 메시별로 그려지는 그루 수를 따로 돌려준다.
 */
async function drawnDigest(drawn: Drawn, state: FrameState): Promise<{ lines: number; digest: string; treeCounts: { season: Season; mesh: string; drawn: number }[] }> {
  const blocks: string[] = [];
  const treeCounts: { season: Season; mesh: string; drawn: number }[] = [];
  for (const season of ["summer", "autumn", "winter", "spring"] as Season[]) {
    await setSeason(drawn, season, state);
    for (const t of drawn.trees) treeCounts.push({ season, mesh: t.label, drawn: drawnInstances(t, drawn.roots).length });
    for (const t of drawn.decor) {
      const rows = drawnInstances(t, drawn.roots)
        .map((i) => `${i.key}|${i.color ?? "-"}`)
        .sort();
      blocks.push(`${season} ${t.kind === "decor" ? "decor" : t.label} ${rows.length}\n${rows.join("\n")}`);
    }
  }
  blocks.sort();
  return { lines: blocks.length, digest: nodeCrypto.createHash("sha256").update(blocks.join("\n")).digest("hex"), treeCounts };
}

describe("[spec] 111 그대로 둘 동작: 카메라가 없을 때, 메시, 겨울 장식, 흩뿌림", () => {
  it.each([
    ["상태에 카메라 없음({})", {} as FrameState],
    ["카메라 null", { camera: null } as FrameState]
  ])("K1 카메라가 없으면 모두 그린다(명세 그대로 2, 바뀌는 동작 7. 113에서 고침: 나무는 그루 수로, 겨울 잎은 그리지 않음): %s일 때 계절마다 그려지는 장식(메시마다 인스턴스 행렬·계절 색, 겨울 장식 숨김 포함)이 기준 커밋과 같고(순서는 보지 않는다), 나무 메시 8개는 계절마다 모든 그루를 그리되 겨울에는 A 잎 메시만 그리지 않는다(116)", async (_name, state) => {
    const drawn = await draw("summer");
    for (const t of [...drawn.trees, ...drawn.decor]) expect({ mesh: t.label, drawn: drawnInstances(t, drawn.roots).length }).toEqual({ mesh: t.label, drawn: t.mesh.instanceMatrix.count });
    const { treeCounts, ...got } = await drawnDigest(drawn, state);
    expect({ trees: drawn.trees.length, decor: drawn.decor.length, ...got }).toEqual({ trees: K1_TREE_MESHES, decor: K1_DECOR_MESHES, lines: K1_LINES, digest: K1_DIGEST });
    expect(treeCounts).toEqual(
      treeCounts.map((c) => {
        const t = drawn.trees.find((x) => x.label === c.mesh)!;
        return { season: c.season, mesh: c.mesh, drawn: c.season === "winter" && t.kind === "leaf" && t.label.startsWith("A-") ? 0 : t.mesh.instanceMatrix.count };
      })
    );
  });

  it("K2 메시는 그대로(명세 그대로 1): 카메라를 주고 여러 시야·계절로 그려도 그린 장면의 인스턴스 메시들(나무·장식·흩뿌림)은 카메라 없이 처음 그린 것과 같은 물체·같은 수이고, 메시마다 도형과 재질이 처음 그대로다", async () => {
    const drawn = await draw("summer");
    const snapshot = () =>
      allObjects(drawn.roots)
        .filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh)
        .map((m) => ({ mesh: m, geometry: m.geometry, material: m.material }));
    const first = snapshot();
    for (const [look, season] of [
      [VILLAGE_START, "summer"],
      [CORNER, "autumn"],
      [FAR_SIDE, "winter"],
      [VILLAGE_START, "spring"]
    ] as const) {
      const camera = villageCamera(look);
      await setSeason(drawn, season, { camera });
      const now = snapshot();
      expect({ season, count: now.length }).toEqual({ season, count: first.length });
      expect(now.map((n, i) => ({ season, same: n.mesh === first[i].mesh, geometry: n.geometry === first[i].geometry, material: n.material === first[i].material }))).toEqual(
        first.map(() => ({ season, same: true, geometry: true, material: true }))
      );
    }
    const emptied = emptyCamera();
    await frames(2, { camera: emptied });
    expect(snapshot().map((n) => n.mesh)).toEqual(first.map((n) => n.mesh));
  });

  it("K3 겨울 장식 숨김(명세 그대로 3 '시야와 관계없이')과 흩뿌림(명세 그대로 4 '바꾸지 않는다'): 카메라를 주어도 겨울에는 장식이 하나도 그려지지 않고, 봄·여름·가을에는 그 계절 흩뿌림 조각이 카메라 시야와 관계없이 모두 같은 자리에 그려진다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    const camera = villageCamera(decorLook());
    // 이 시야에는 분명히 드는 장식이 있다(그래도 겨울에는 그리지 않는다)
    expect(checkView(drawn, base, camera, "summer", drawn.decor).counts.in).toBeGreaterThan(0);
    await setSeason(drawn, "winter", { camera });
    expect(drawn.decor.map((t) => ({ mesh: t.label, drawn: drawnInstances(t, drawn.roots).length }))).toEqual(drawn.decor.map((t) => ({ mesh: t.label, drawn: 0 })));
    const fromModel = sourceGeometries(drawn.source).all;
    const decorMeshes = new Set(drawn.decor.map((t) => t.mesh));
    const treeMeshes = new Set<THREE.Object3D>(drawn.trees.map((t) => t.mesh));
    for (const season of ["spring", "summer", "autumn"] as Season[]) {
      const pieces = scatterModule().villageSeasonScatter(season);
      for (const [label, state] of [
        ["카메라 없음", {} as FrameState],
        ["장식을 보는 카메라", { camera } as FrameState],
        ["빈 시야 카메라", { camera: emptyCamera() } as FrameState]
      ] as const) {
        await setSeason(drawn, season, state);
        // 흩뿌림 = 마을 모델 도형도 장식도 나무도 아닌, 그려지는 납작한 인스턴스 메시. 찍은 자리가 그 계절 조각 자리와 하나씩 맞는다(113: 나무 메시도 뺀다)
        const flat = allObjects(drawn.roots).filter(
          (o): o is THREE.InstancedMesh =>
            o instanceof THREE.InstancedMesh && !fromModel.has(o.geometry) && !decorMeshes.has(o) && !treeMeshes.has(o) && shownChain(o, drawn.roots) && o.count > 0
        );
        // 행렬은 Float32로 담기므로 자리는 0.001칸 안에서 맞춘다(조각 하나에 찍힌 자리 하나)
        const points = flat.flatMap((m) => instanceWorld(m).map((w) => ({ x: w.elements[12], z: w.elements[14] })));
        const cells = new Map<string, number[]>();
        pieces.forEach((p, i) => {
          const k = `${Math.floor(p.x)},${Math.floor(p.z)}`;
          cells.set(k, [...(cells.get(k) ?? []), i]);
        });
        const used = new Set<number>();
        let unmatched = 0;
        for (const p of points) {
          let hit = -1;
          for (let c = Math.floor(p.x) - 1; c <= Math.floor(p.x) + 1 && hit < 0; c += 1) {
            for (let r = Math.floor(p.z) - 1; r <= Math.floor(p.z) + 1 && hit < 0; r += 1) {
              for (const i of cells.get(`${c},${r}`) ?? []) {
                if (!used.has(i) && Math.abs(pieces[i].x - p.x) <= 1e-3 && Math.abs(pieces[i].z - p.z) <= 1e-3) {
                  hit = i;
                  break;
                }
              }
            }
          }
          if (hit < 0) unmatched += 1;
          else used.add(hit);
        }
        expect({ season, label, count: points.length, unmatched }).toEqual({ season, label, count: pieces.length, unmatched: 0 });
      }
    }
  });

  it("K4 메시 단위 시야 판정에서 빠지지 않는다(명세 바뀌는 동작 5. 지금도 성립): 시야를 옮길 때마다, 그려지는 인스턴스가 있는 나무·장식 메시는 frustumCulled가 꺼져 있거나, 메시의 boundingSphere(없으면 three.js처럼 계산한 것)를 세계로 옮긴 공이 그려지는 인스턴스의 공을 모두 감싸고 three.js 시야 판정(Frustum.intersectsObject)을 통과한다", async () => {
    const drawn = await draw("summer");
    const all = [...drawn.trees, ...drawn.decor];
    for (const look of [VILLAGE_START, CORNER, FAR_SIDE, decorLook(), VILLAGE_START]) {
      const camera = villageCamera(look);
      await frames(1, { camera });
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (const t of all) {
        const list = drawnInstances(t, drawn.roots);
        if (list.length === 0 || !t.mesh.frustumCulled) continue;
        if (t.mesh.boundingSphere === null) t.mesh.computeBoundingSphere();
        const meshSphere = t.mesh.boundingSphere!.clone().applyMatrix4(t.mesh.matrixWorld);
        if (!t.mesh.geometry.boundingSphere) t.mesh.geometry.computeBoundingSphere();
        const outside = list.filter((i) => {
          const s = t.mesh.geometry.boundingSphere!.clone().applyMatrix4(i.world);
          return s.center.distanceTo(meshSphere.center) + s.radius > meshSphere.radius + EPS;
        }).length;
        // 그려지는 인스턴스 가운데 시야에 분명히 드는 것이 있으면 메시도 three.js 시야 판정을 통과해야 한다
        const seen = list.some((i) => classify(t, i.world, camera) === "in");
        expect({ look, mesh: t.label, outside, passes: seen ? frustum.intersectsObject(t.mesh) : "보지 않음" }).toEqual({ look, mesh: t.label, outside: 0, passes: seen ? true : "보지 않음" });
      }
    }
  });

  it("K5 같은 카메라면 다시 쓰지 않고(명세 바뀌는 동작 6. 지금도 성립), 카메라가 없어지면 다시 모두 그린다(명세 바뀌는 동작 7): 카메라를 그대로 두고 프레임을 더 돌리면 나무·장식 메시의 instanceMatrix·instanceColor version이 늘지 않는다. 계절이 바뀌어도 그려지는 잎의 색은 기준 그대로다(113에서 고침: 계절 잎 색을 없앴다). 그 뒤 카메라 없는 프레임이면 모든 인스턴스가 기준 행렬·색으로 그려진다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["autumn", "summer"]);
    const all = [...drawn.trees, ...drawn.decor];
    const camera = cameraAtStart();
    await frames(2, { camera });
    const versions = () => all.map((t) => ({ mesh: t.label, matrix: t.mesh.instanceMatrix.version, color: t.mesh.instanceColor?.version ?? null }));
    const before = versions();
    await frames(3, { camera });
    expect(versions()).toEqual(before);
    const leafDrawn = drawn.trees.filter((t) => t.kind === "leaf" && drawnInstances(t, drawn.roots).length > 0);
    expect(leafDrawn.length).toBeGreaterThan(0);
    await setSeason(drawn, "autumn", { camera });
    const wrong = leafDrawn.map((t) => ({
      mesh: t.label,
      wrong: drawnInstances(t, drawn.roots).filter((i) => base.get(t)!.get(i.key)?.colors.autumn !== i.color).length
    }));
    expect(wrong).toEqual(leafDrawn.map((t) => ({ mesh: t.label, wrong: 0 })));
    await frames(1, { camera: null });
    for (const t of all) {
      const list = drawnInstances(t, drawn.roots);
      const table = base.get(t)!;
      const keys = new Set(list.map((i) => i.key));
      const badColor = list.filter((i) => table.get(i.key)?.colors.autumn !== i.color).length;
      expect({ mesh: t.label, drawn: list.length, allKnown: [...table.keys()].every((k) => keys.has(k)), badColor }).toEqual({ mesh: t.label, drawn: table.size, allKnown: true, badColor: 0 });
    }
  });
});

/** K1의 기대값. 나무 메시 수는 113 명세(116: 종류 A·Pine × 단계 × 부품 = 8), 장식 메시 수·적은 블록 수·sha256은 113 기준 커밋 3b11555에서 장식만으로 잰 값(장식 메시 수는 1d07fa9와 같다). */
const K1_TREE_MESHES = 8;
const K1_DECOR_MESHES = 6;
const K1_LINES = 24;
// 115 전 값 "35d966b6997baa368dc7dd2b97335b57fafb92b56f3c5e5474d9b23adde2435f". 115: 원 밖 칸이 막혀 장식 자리가 따라 바뀐 값(머리말)
const K1_DIGEST = "5c9d0f82a9a1a94f8b22649f4cc672bc39b2e67cb97edb6bbe9a491df353c701";
