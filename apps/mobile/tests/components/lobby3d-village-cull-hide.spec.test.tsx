// [spec] qa 테스트(작업 112-② 시야 고르기 가볍게, 기능 변경, 모바일): 카메라가 있을 때 고른 인스턴스가 0인 마을 나무·꽃·풀 장식 메시를 숨기고(visible false),
// 다시 고르면 보이게 하는 것. 그리고 구역 단위 판정으로 바꿔도 그리는 인스턴스가 111 명세의 기준 그대로인지.
// 바뀌는 동작의 기대값은 명세(private 작업 폴더 112-2026-11-18-마을-그리기-JS-줄이기/02-시야-고르기-가볍게/01-main-spec.md)에서만 가져온다.
// 그대로 둘 동작의 값은 기준 커밋 3057afe의 지금 동작(카메라 없이 처음 그린 인스턴스 자리·순서·계절 색)에서 이 테스트로 잰 값이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets,
// useFrame으로 프레임마다 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 어떻게 보나(111 qa 테스트 lobby3d-village-frustum-cull.spec.test.tsx와 같은 가짜 환경과 같은 정의):
// - react-three-fiber만 가짜로 둔다. 가짜 불러오기는 tests/__fixtures__/village-scene-101.ts(마을 모델은 진짜 glb를 푼 장면, 장식 모델은 작은 상자 메시).
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 delta 0.1초로 모두 부른다. 프레임 상태는 {}(카메라 없음), { camera: null },
//   { camera: 테스트가 만든 PerspectiveCamera } 가운데 테스트가 고른다.
// - "그려지는 인스턴스" = 메시와 그 위 모든 부모가 visible이면 0번부터 count-1번까지의 인스턴스(행렬, 있으면 색). 보이지 않으면 하나도 없다.
// - "인스턴스의 공" = 그 메시 도형의 boundingSphere를 (메시의 세계 변환 × 그 인스턴스의 행렬)로 옮긴 것.
//   공이 여섯 면 모두에서 안쪽으로 1e-3칸 넘게 걸치면 "분명히 든다(in)", 어느 한 면에서 바깥으로 1e-3칸 넘게 벗어나면 "분명히 안 든다(out)",
//   그 사이는 "경계(edge)"로 보고 보지 않는다.
// - "고른 수가 0인 메시" = 그 메시의 모든 인스턴스가 out인 메시. 숨겨져야 한다(mesh.visible === false).
//   in인 인스턴스가 하나라도 있는 메시는 보여야 한다(mesh.visible === true). out과 edge만 있는 메시는 보지 않는다(경계 판정이 갈릴 수 있다).
//
// 바뀔 동작(구현 전 실패): C1, C2, C3.
// 그대로 둘 동작(구현 전·뒤 통과): R1~R5. R5는 명세의 "바뀌는 동작"인 구역 단위 판정의 결과가 111 기준과 같아야 한다는 것으로, 지금 코드도 만족한다.
//
// 작업 113(새 나무 모델 넣기) 명세의 "고칠 기존 테스트"(112 qa 테스트의 나무 틀 찾기)로 qa가 고쳤다(113 qa 보고 02-qa-tests.md):
// 113은 마을 나무를 Kenney 나무 틀 대신 새 나무 모델(WriteLoop_Tree_<A·Pine>_LOD<1·2>.glb(116: 113의 A·B·C에서 바뀜))로 종류 × 단계 × 부품마다 인스턴스 메시 하나로 그리고,
// 그루마다 계절 잎 색을 입히던 것을 없애며, 겨울에는 고른 수와 관계없이 잎 메시를 숨긴다(113 바뀌는 동작 1·4·5·6). 시야 고르기·숨기기는 그대로 받는다. 그래서:
// - "나무 메시"는 나무 틀 도형 대신 새 나무 모델의 메시 도형으로 찍은 인스턴스 메시로 찾는다(tests/__fixtures__/village-trees-113.ts의 treePartOf).
//   이름표는 <종류>-LOD<단계>-leaf(잎) / -trunk(줄기)다. 가짜 불러오기는 새 나무 파일에 앱 자산 폴더의 그 파일을 푼 모델을 준다.
// - R1·R2: 겨울에 "나무는 111 기준대로 그려진다"를 줄기 메시에만 두고, 잎 메시는 그려지는 그루가 0이다(R2는 숨겨져 있다).
// - R3: "여름 색과 가을 색이 다른 잎이 있다" 대신, 다시 보일 때 잎 메시가 가을 칸(glTF UV + (0, 0.5))을 그리는지 본다(113 바뀌는 동작 4).
// 작업 116(나무 A·Pine 세트) 명세의 "고칠 기존 테스트"(겨울 잎 숨기기)로 qa가 고쳤다(116 qa 보고 02-qa-tests.md): 겨울에는 A 잎 메시만 숨고 Pine 잎 메시는 시야 고르기대로 그려진다.
// - R1·R2: 겨울에 "111 기준대로 그려진다"를 줄기와 Pine 잎 메시에 두고, A 잎 메시만 그려지는 그루가 0이다(R2는 숨겨져 있다). Pine 잎의 겨울 기준 색은 baseline이 잰 값이다.
// 장식에 대한 단언과 입력은 그대로다.
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

jest.setTimeout(300000);

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

type Kind = "leaf" | "trunk" | "decor";
type Tracked = { mesh: THREE.InstancedMesh; kind: Kind; label: string };
type Drawn = { roots: THREE.Object3D[]; light: Light; source: THREE.Object3D; trees: Tracked[]; decor: Tracked[]; all: Tracked[] };

type FrameState = { camera?: THREE.Camera | null };

async function frames(count: number, state: FrameState = {}) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f(state, 0.1);
  });
}

/** 계절을 바꾸고 프레임을 count번 돌린다. */
async function setSeason(drawn: Drawn, season: Season, state: FrameState = {}, count = 2) {
  const next = lightAt(season);
  drawn.light.ambience = next.ambience;
  drawn.light.target = next.target;
  await frames(count, state);
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
  return { roots, light, source, ...found, all: [...found.trees, ...found.decor] };
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

/** 메시가 보이는지와 상관없이 0번~count-1번 인스턴스(순서대로). */
function slots(t: Tracked): Inst[] {
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

/** 지금 그려지는 인스턴스(머리말 정의). */
function drawnInstances(t: Tracked, roots: THREE.Object3D[]): Inst[] {
  for (const r of roots) r.updateMatrixWorld(true);
  if (!shownChain(t.mesh, roots)) return [];
  return slots(t);
}

/** 카메라 없이 계절마다 그려 둔 기준 자료: 메시마다 원래 순서의 행렬 목록과, 행렬 → { 세계 행렬, 계절별 색 }. */
type BaseRow = { world: THREE.Matrix4; colors: Partial<Record<Season, string | null>> };
type Baseline = Map<Tracked, { order: string[]; rows: Map<string, BaseRow> }>;

async function baseline(drawn: Drawn, seasons: Season[]): Promise<Baseline> {
  const out: Baseline = new Map();
  for (const season of seasons) {
    await setSeason(drawn, season, {});
    for (const t of drawn.all) {
      const list = slots(t);
      if (season === seasons[0]) {
        const keys = new Set(list.map((i) => i.key));
        expect({ mesh: t.label, unique: keys.size === list.length, all: list.length === t.mesh.count }).toEqual({ mesh: t.label, unique: true, all: true });
        out.set(t, { order: list.map((i) => i.key), rows: new Map(list.map((i) => [i.key, { world: i.world, colors: {} }])) });
      }
      const table = out.get(t)!.rows;
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

/** 마을 카메라처럼 위에서 pitch로 내려다보는 원근 카메라. look = 보는 바닥 점, viewWidth = 보는 점 깊이에서 화면 가로 폭(칸), yaw = 카메라가 보는 점 둘레로 돈 각(0이면 +z 쪽에서 본다). */
function villageCamera(look: { x: number; z: number }, viewWidth = 9, opts: { fov?: number; aspect?: number; yaw?: number; pitch?: number; far?: number } = {}): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 30, opts.aspect ?? 0.5, 1, opts.far ?? 200);
  aimCamera(camera, look, viewWidth, opts.yaw ?? 0, opts.pitch ?? PITCH);
  return camera;
}

function aimCamera(camera: THREE.PerspectiveCamera, look: { x: number; z: number }, viewWidth = 9, yaw = 0, pitch = PITCH) {
  const tanH = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
  const dist = viewWidth / (2 * tanH);
  const flat = dist * Math.cos(pitch);
  camera.position.set(look.x + flat * Math.sin(yaw), dist * Math.sin(pitch), look.z + flat * Math.cos(yaw));
  camera.lookAt(look.x, 0, look.z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/** 마을에서 멀리 떨어져 마을 반대쪽을 보는 카메라(시야에 나무·장식이 하나도 없다). */
function emptyCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(30, 0.5, 1, 200);
  camera.position.set(1000, 10, 1000);
  camera.lookAt(1100, 10, 1000);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

const CORNER = { x: 6, z: 52 };
const FAR_SIDE = { x: 60, z: 10 };

const EPS = 1e-3;

function frustumOf(camera: THREE.Camera): THREE.Frustum {
  camera.updateMatrixWorld(true);
  return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
}

function classify(t: Tracked, world: THREE.Matrix4, frustum: THREE.Frustum): "in" | "out" | "edge" {
  const geometry = t.mesh.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!.clone().applyMatrix4(world);
  let least = Infinity;
  for (const plane of frustum.planes) least = Math.min(least, plane.distanceToPoint(sphere.center) + sphere.radius);
  if (least < -EPS) return "out";
  if (least > EPS) return "in";
  return "edge";
}

type Counts = { in: number; out: number; edge: number };

function countsOf(t: Tracked, base: Baseline, frustum: THREE.Frustum): Counts {
  const counts = { in: 0, out: 0, edge: 0 };
  for (const row of base.get(t)!.rows.values()) counts[classify(t, row.world, frustum)] += 1;
  return counts;
}

/** 메시마다 보여야 하는지: in이 있으면 true, 모두 out이면 false, 그 밖(out과 edge만)은 null(보지 않음). */
function wantVisible(c: Counts): boolean | null {
  if (c.in > 0) return true;
  if (c.edge === 0) return false;
  return null;
}

type Check = { mesh: string; unknown: number; duplicated: number; missingIn: number; drawnOut: number; wrongColor: number };

/** 그려지는 인스턴스가 111 기준을 따르는지(기준 행렬이고 겹치지 않고, in은 모두 그려지고 out은 그려지지 않으며 색이 그 계절 기준 색). */
function checkSelection(drawn: Drawn, base: Baseline, camera: THREE.Camera, season: Season, meshes: Tracked[]): Check[] {
  const frustum = frustumOf(camera);
  return meshes.map((t) => {
    const table = base.get(t)!.rows;
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
      const c = classify(t, row.world, frustum);
      if (c === "in" && !seen.has(key)) missingIn += 1;
      if (c === "out" && seen.has(key)) drawnOut += 1;
    }
    const duplicated = [...seen.values()].filter((n) => n > 1).length;
    return { mesh: t.label, unknown, duplicated, missingIn, drawnOut, wrongColor };
  });
}

const clean = (checks: Check[]) => checks.map((c) => ({ mesh: c.mesh, unknown: 0, duplicated: 0, missingIn: 0, drawnOut: 0, wrongColor: 0 }));

/** 메시마다 보임 확인 줄: got은 지금 mesh.visible, want는 wantVisible. 보지 않는 메시는 뺀다. */
function visibilityRows(base: Baseline, camera: THREE.Camera, meshes: Tracked[], tag: unknown): { got: unknown[]; want: unknown[]; hidden: number; shown: number } {
  const frustum = frustumOf(camera);
  const got: unknown[] = [];
  const want: unknown[] = [];
  let hidden = 0;
  let shown = 0;
  for (const t of meshes) {
    const w = wantVisible(countsOf(t, base, frustum));
    if (w === null) continue;
    if (w) shown += 1;
    else hidden += 1;
    got.push({ tag, mesh: t.label, visible: t.mesh.visible });
    want.push({ tag, mesh: t.label, visible: w });
  }
  return { got, want, hidden, shown };
}

/** 장식 메시 가운데 in이 있는 것과 모두 out인 것이 함께 있는 시야(장식 자리를 차례로 본다). */
function mixedDecorLook(drawn: Drawn, base: Baseline): { x: number; z: number } {
  for (const d of decorModule().villageDecorSpots()) {
    const look = { x: d.x, z: d.z };
    const f = frustumOf(villageCamera(look));
    const ws = drawn.decor.map((t) => wantVisible(countsOf(t, base, f)));
    if (ws.includes(true) && ws.includes(false)) return look;
  }
  throw new Error("장식 메시가 갈리는 시야를 찾지 못함");
}

/** 나무 메시 가운데 in이 있는 것과 모두 out인 것이 함께 있는 시야(마을 안 여러 점을 본다). 없으면 null. */
function mixedTreeLook(drawn: Drawn, base: Baseline): { look: { x: number; z: number }; width: number } | null {
  for (const width of [5, 9])
    for (let x = 0; x <= 80; x += 4)
      for (let z = 0; z <= 70; z += 4) {
        const look = { x, z };
        const f = frustumOf(villageCamera(look, width));
        const ws = drawn.trees.map((t) => wantVisible(countsOf(t, base, f)));
        if (ws.includes(true) && ws.includes(false)) return { look, width };
      }
  return null;
}

// ---------- 바뀔 동작 ----------

describe("[spec] 112-② 바뀔 동작: 카메라가 있을 때 고른 인스턴스가 0인 나무·꽃풀 장식 메시는 숨기고, 다시 고르면 보인다", () => {
  it("C1 고른 수 0이면 숨긴다(명세 바뀌는 동작 1): 시야에 나무·장식이 하나도 없는 카메라, 장식 메시가 갈리는 카메라, 마을 여러 곳을 보는 카메라를 차례로 한 프레임씩 주면, 그 프레임 뒤 모든 인스턴스가 시야 밖인 메시는 visible이 false이고 시야에 드는 인스턴스가 있는 메시는 visible이 true다. 그려지는 인스턴스는 111 기준 그대로다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    const decorMixed = mixedDecorLook(drawn, base);
    const treeMixed = mixedTreeLook(drawn, base);
    const steps: [string, THREE.Camera][] = [
      ["빈 시야", emptyCamera()],
      ["장식이 갈리는 시야", villageCamera(decorMixed)],
      ["라룹이 집 앞", villageCamera(VILLAGE_START)],
      ["구석", villageCamera(CORNER)],
      ["반대쪽", villageCamera(FAR_SIDE)],
      ["좁은 시야(폭 5) 구석", villageCamera(CORNER, 5)]
    ];
    if (treeMixed) steps.push(["나무가 갈리는 시야", villageCamera(treeMixed.look, treeMixed.width)]);
    let hidden = 0;
    let shown = 0;
    for (const [step, camera] of steps) {
      await frames(1, { camera });
      const rows = visibilityRows(base, camera, drawn.all, step);
      hidden += rows.hidden;
      shown += rows.shown;
      expect(rows.got).toEqual(rows.want);
      const checks = checkSelection(drawn, base, camera, "summer", drawn.all);
      expect({ step, checks }).toEqual({ step, checks: clean(checks) });
    }
    // 숨겨야 할 메시와 보여야 할 메시가 실제로 모두 나왔어야 뜻이 있다(빈 시야에서는 모든 메시가 숨겨져야 한다)
    expect({ hiddenSeen: hidden >= drawn.all.length, shownSeen: shown > 0 }).toEqual({ hiddenSeen: true, shownSeen: true });
  });

  it("C2 다시 고르면 바로 그 프레임에 보이고, 다시 0이 되면 바로 그 프레임에 숨는다(명세 바뀌는 동작 1 '바꾼 그 프레임에 따른다'): 빈 시야 → 마을 → 빈 시야 → 장식이 갈리는 시야 → 빈 시야를 한 프레임씩 주면 프레임마다 메시의 visible이 그 시야의 고른 수를 따른다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    const decorMixed = mixedDecorLook(drawn, base);
    const steps: [string, THREE.Camera][] = [
      ["빈 시야 1", emptyCamera()],
      ["라룹이 집 앞", villageCamera(VILLAGE_START)],
      ["빈 시야 2", emptyCamera()],
      ["장식이 갈리는 시야", villageCamera(decorMixed)],
      ["빈 시야 3", emptyCamera()]
    ];
    for (const [step, camera] of steps) {
      await frames(1, { camera });
      const rows = visibilityRows(base, camera, drawn.all, step);
      expect(rows.got).toEqual(rows.want);
      if (step.startsWith("빈 시야")) {
        expect(drawn.all.map((t) => ({ step, mesh: t.label, visible: t.mesh.visible }))).toEqual(drawn.all.map((t) => ({ step, mesh: t.label, visible: false })));
      }
      const checks = checkSelection(drawn, base, camera, "summer", drawn.all);
      expect({ step, checks }).toEqual({ step, checks: clean(checks) });
    }
  });

  it("C3 겨울이 끝나면 그때 고른 수에 따라 보인다(명세 그대로 '겨울이 끝나면 그때 고른 수에 따라 보인다'와 바뀌는 동작 1): 장식이 갈리는 카메라로 겨울을 보다가 봄이 되면 그 프레임 뒤 시야에 드는 장식이 있는 메시만 보이고 모두 시야 밖인 장식 메시는 숨는다. 빈 시야 카메라로 겨울에서 봄이 되면 장식 메시가 모두 숨은 채다. 그 뒤 장식을 보는 시야로 옮기면 그 프레임에 보인다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["spring", "summer"]);
    const decorMixed = villageCamera(mixedDecorLook(drawn, base));
    await setSeason(drawn, "winter", { camera: decorMixed });
    expect(drawn.decor.map((t) => ({ mesh: t.label, drawn: drawnInstances(t, drawn.roots).length }))).toEqual(drawn.decor.map((t) => ({ mesh: t.label, drawn: 0 })));
    await setSeason(drawn, "spring", { camera: decorMixed }, 1);
    let rows = visibilityRows(base, decorMixed, drawn.decor, "겨울→봄(장식이 갈리는 시야) 첫 프레임");
    expect(rows.hidden > 0 && rows.shown > 0).toBe(true);
    expect(rows.got).toEqual(rows.want);
    let checks = checkSelection(drawn, base, decorMixed, "spring", drawn.decor);
    expect(checks).toEqual(clean(checks));
    await frames(2, { camera: decorMixed });
    rows = visibilityRows(base, decorMixed, drawn.decor, "겨울→봄(장식이 갈리는 시야) 두 프레임 더");
    expect(rows.got).toEqual(rows.want);

    const empty = emptyCamera();
    await setSeason(drawn, "winter", { camera: empty });
    await setSeason(drawn, "spring", { camera: empty }, 1);
    expect(drawn.decor.map((t) => ({ step: "겨울→봄(빈 시야) 첫 프레임", mesh: t.label, visible: t.mesh.visible }))).toEqual(
      drawn.decor.map((t) => ({ step: "겨울→봄(빈 시야) 첫 프레임", mesh: t.label, visible: false }))
    );
    await frames(2, { camera: empty });
    expect(drawn.decor.map((t) => ({ step: "겨울→봄(빈 시야) 두 프레임 더", mesh: t.label, visible: t.mesh.visible }))).toEqual(
      drawn.decor.map((t) => ({ step: "겨울→봄(빈 시야) 두 프레임 더", mesh: t.label, visible: false }))
    );
    await frames(1, { camera: decorMixed });
    rows = visibilityRows(base, decorMixed, drawn.decor, "봄, 빈 시야 → 장식이 갈리는 시야");
    expect(rows.got).toEqual(rows.want);
    checks = checkSelection(drawn, base, decorMixed, "spring", drawn.decor);
    expect(checks).toEqual(clean(checks));
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 112-② 그대로 둘 동작: 겨울 장식, 카메라가 없을 때, 숨은 동안의 계절 색, 같은 카메라, 그리는 인스턴스의 기준", () => {
  it("R1 겨울에는 시야·카메라와 관계없이 장식이 보이지 않는다(명세 그대로 '겨울 동안 고른 수가 생겨도 보이지 않는다'): 겨울에 빈 시야 → 장식이 갈리는 시야 → 장식 자리 여러 곳 → 라룹이 집 앞을 한 프레임씩 주면 프레임마다 장식 메시가 모두 visible false이고 그려지는 장식이 0개다. 나무 줄기는 그동안 111 기준대로 그려지고, 잎은 그려지지 않는다(113에서 고침: 겨울에는 잎을 숨긴다)", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["winter", "summer"]);
    const decorMixed = mixedDecorLook(drawn, base);
    await setSeason(drawn, "winter", { camera: emptyCamera() });
    const spots = decorModule().villageDecorSpots();
    const looks: [string, THREE.Camera][] = [
      ["빈 시야", emptyCamera()],
      ["장식이 갈리는 시야", villageCamera(decorMixed)],
      ...spots.slice(0, 40).filter((_, i) => i % 8 === 0).map((d, i) => [`장식 자리 ${i}`, villageCamera({ x: d.x, z: d.z })] as [string, THREE.Camera]),
      ["라룹이 집 앞", villageCamera(VILLAGE_START)]
    ];
    let decorInSeen = 0;
    for (const [step, camera] of looks) {
      await frames(1, { camera });
      const f = frustumOf(camera);
      decorInSeen += drawn.decor.reduce((n, t) => n + countsOf(t, base, f).in, 0);
      expect(drawn.decor.map((t) => ({ step, mesh: t.label, visible: t.mesh.visible, drawn: drawnInstances(t, drawn.roots).length }))).toEqual(
        drawn.decor.map((t) => ({ step, mesh: t.label, visible: false, drawn: 0 }))
      );
      // 113: 줄기는 111 기준대로, 잎은 시야와 관계없이 그려지지 않는다. 116: Pine 잎은 줄기처럼 111 기준대로, A 잎만 그려지지 않는다
      const trunks = drawn.trees.filter((t) => t.kind === "trunk" || t.label.startsWith("Pine-"));
      const leaves = drawn.trees.filter((t) => t.kind === "leaf" && t.label.startsWith("A-"));
      expect(leaves).toHaveLength(2);
      const checks = checkSelection(drawn, base, camera, "winter", trunks);
      expect({ step, checks }).toEqual({ step, checks: clean(checks) });
      expect(leaves.map((t) => ({ step, mesh: t.label, drawn: drawnInstances(t, drawn.roots).length }))).toEqual(leaves.map((t) => ({ step, mesh: t.label, drawn: 0 })));
    }
    // 겨울 동안 시야에 드는 장식이 실제로 있었어야 뜻이 있다
    expect(decorInSeen).toBeGreaterThan(0);
  });

  it("R2 카메라가 없으면 모든 인스턴스를 원래 순서로 그리고 메시는 보인다(겨울 장식은 빼고)(명세 그대로 '카메라가 없으면'): 빈 시야로 모두 숨긴 뒤 카메라 없는 프레임({} 또는 null)이면 그 프레임 뒤 나무·장식 메시가 모두 visible true이고 0번~끝 인스턴스가 카메라 없이 처음 그린 순서·행렬·색 그대로다. 겨울이면 나무 줄기는 그렇게 보이고 장식과 나무 잎은 숨은 채다(113에서 고침: 겨울에는 잎을 숨긴다)", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["winter", "summer"]);
    const orderRows = (season: Season, meshes: Tracked[], tag: string) => ({
      got: meshes.map((t) => {
        const list = drawnInstances(t, drawn.roots);
        return { tag, mesh: t.label, visible: t.mesh.visible, order: list.map((i) => i.key), colors: list.map((i) => i.color) };
      }),
      want: meshes.map((t) => {
        const b = base.get(t)!;
        return { tag, mesh: t.label, visible: true, order: b.order, colors: b.order.map((k) => b.rows.get(k)!.colors[season] ?? null) };
      })
    });
    for (const [name, state] of [
      ["상태에 카메라 없음({})", {} as FrameState],
      ["카메라 null", { camera: null } as FrameState]
    ] as const) {
      await frames(1, { camera: emptyCamera() });
      await frames(1, state);
      const rows = orderRows("summer", drawn.all, `여름 ${name}`);
      expect(rows.got).toEqual(rows.want);
    }
    await setSeason(drawn, "winter", { camera: emptyCamera() });
    for (const [name, state] of [
      ["상태에 카메라 없음({})", {} as FrameState],
      ["카메라 null", { camera: null } as FrameState]
    ] as const) {
      await frames(1, { camera: emptyCamera() });
      await frames(1, state);
      // 113: 겨울에는 줄기만 그렇게 보이고 잎 메시는 숨은 채다. 116: 줄기와 Pine 잎이 그렇게 보이고 A 잎 메시만 숨은 채다
      const rows = orderRows("winter", drawn.trees.filter((t) => t.kind === "trunk" || t.label.startsWith("Pine-")), `겨울 ${name}`);
      expect(rows.got).toEqual(rows.want);
      const leaves = drawn.trees.filter((t) => t.kind === "leaf" && t.label.startsWith("A-"));
      expect(leaves).toHaveLength(2);
      expect(leaves.map((t) => ({ name, mesh: t.label, visible: t.mesh.visible, drawn: drawnInstances(t, drawn.roots).length }))).toEqual(
        leaves.map((t) => ({ name, mesh: t.label, visible: false, drawn: 0 }))
      );
      expect(drawn.decor.map((t) => ({ name, mesh: t.label, visible: t.mesh.visible, drawn: drawnInstances(t, drawn.roots).length }))).toEqual(
        drawn.decor.map((t) => ({ name, mesh: t.label, visible: false, drawn: 0 }))
      );
    }
  });

  it("R3 숨어 있는 동안 계절이 바뀐 메시도 다시 보일 때 그때 계절 모습이다(명세 그대로 '시야 밖에서 계절이 바뀐 뒤 들어온 그루도 그때 계절 색'. 113에서 고침: 계절 색 대신 계절 칸): 빈 시야에서 여름 → 가을로 바뀐 뒤 마을을 보면 그려지는 잎이 기준 색이고, 그 뒤 카메라가 없어지면 모든 잎이 기준 색이며 잎 메시가 가을 칸을 그린다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["autumn", "summer"]);
    const empty = emptyCamera();
    await frames(2, { camera: empty });
    await setSeason(drawn, "autumn", { camera: empty });
    for (const look of [VILLAGE_START, CORNER, FAR_SIDE]) {
      const camera = villageCamera(look);
      await frames(1, { camera });
      const checks = checkSelection(drawn, base, camera, "autumn", drawn.all);
      expect({ look, checks }).toEqual({ look, checks: clean(checks) });
      await frames(1, { camera: empty });
      await setSeason(drawn, "summer", { camera: empty });
      await setSeason(drawn, "autumn", { camera: empty });
    }
    await frames(1, { camera: null });
    const wrong = drawn.trees.map((t) => {
      const table = base.get(t)!.rows;
      const list = drawnInstances(t, drawn.roots);
      return { mesh: t.label, drawn: list.length, wrong: list.filter((i) => table.get(i.key)?.colors.autumn !== i.color).length };
    });
    expect(wrong).toEqual(drawn.trees.map((t) => ({ mesh: t.label, drawn: base.get(t)!.rows.size, wrong: 0 })));
    // 113: 잎 메시는 가을 칸을 그린다
    const leaves = drawn.trees.filter((t) => t.kind === "leaf");
    expect(leaves.map((t) => ({ mesh: t.label, autumnCell: uvShiftError(t.mesh, treePartOf(t.mesh.geometry)!, FOLIAGE_OFFSET.autumn) <= 1e-5 }))).toEqual(
      leaves.map((t) => ({ mesh: t.label, autumnCell: true }))
    );
  });

  it("R4 같은 카메라면 다시 쓰지 않는다(명세 그대로 'instanceMatrix·instanceColor의 version이 늘지 않음'): 모두 숨는 빈 시야 카메라와 마을 카메라 각각을 그대로 두고 프레임을 더 돌리면 나무·장식 메시의 instanceMatrix·instanceColor version이 늘지 않는다", async () => {
    const drawn = await draw("summer");
    const versions = (tag: string) => drawn.all.map((t) => ({ tag, mesh: t.label, matrix: t.mesh.instanceMatrix.version, color: t.mesh.instanceColor?.version ?? null }));
    for (const [tag, camera] of [
      ["빈 시야", emptyCamera()],
      ["라룹이 집 앞", villageCamera(VILLAGE_START)],
      ["구석", villageCamera(CORNER)]
    ] as const) {
      await frames(2, { camera });
      const before = versions(tag);
      await frames(3, { camera });
      expect(versions(tag)).toEqual(before);
    }
  });

  it("R5 구역 단위로 판정해도 그리는 인스턴스는 111 기준 그대로다(명세 바뀌는 동작 2 '결과는 111 명세의 기준과 같아야 한다'): 마을 전체를 덮는 여러 바닥 점 × 시야 폭 3가지, 여러 방향에서 도는 카메라, 낮게 멀리 보는 카메라, 바로 위에서 보는 카메라를 한 프레임씩 주면 프레임마다 나무·장식 메시마다 시야에 분명히 드는 인스턴스는 모두, 분명히 안 드는 인스턴스는 하나도 그려지지 않고 행렬·색이 기준 그대로다", async () => {
    const drawn = await draw("summer");
    const base = await baseline(drawn, ["summer"]);
    // 나무·장식 자리의 범위
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const t of drawn.all)
      for (const row of base.get(t)!.rows.values()) {
        minX = Math.min(minX, row.world.elements[12]);
        maxX = Math.max(maxX, row.world.elements[12]);
        minZ = Math.min(minZ, row.world.elements[14]);
        maxZ = Math.max(maxZ, row.world.elements[14]);
      }
    const cameras: [string, THREE.Camera][] = [];
    const N = 6;
    for (let a = 0; a <= N; a += 1)
      for (let b = 0; b <= N; b += 1) {
        const look = { x: minX + ((maxX - minX) * a) / N, z: minZ + ((maxZ - minZ) * b) / N };
        for (const width of [5, 9, 13]) cameras.push([`바닥 ${look.x.toFixed(1)},${look.z.toFixed(1)} 폭 ${width}`, villageCamera(look, width)]);
      }
    const middle = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    for (const yaw of [0.6, 1.57, 2.4, 3.14, 4.2, 5.5])
      for (const look of [middle, { x: minX + 4, z: minZ + 4 }, { x: maxX - 4, z: maxZ - 4 }]) cameras.push([`돎 ${yaw} @ ${look.x.toFixed(1)},${look.z.toFixed(1)}`, villageCamera(look, 9, { yaw })]);
    cameras.push(["낮게 멀리(10도, 먼 면 200)", villageCamera(middle, 9, { pitch: (10 * Math.PI) / 180 })]);
    cameras.push(["낮게 멀리(5도, 먼 면 40)", villageCamera({ x: minX, z: middle.z }, 9, { pitch: (5 * Math.PI) / 180, yaw: -1.57, far: 40 })]);
    cameras.push(["넓은 시야각 90도, 가로세로비 2", villageCamera(middle, 30, { fov: 90, aspect: 2 })]);
    const top = new THREE.PerspectiveCamera(40, 0.5, 1, 200);
    top.position.set(middle.x, 40, middle.z);
    top.up.set(0, 0, -1);
    top.lookAt(middle.x, 0, middle.z);
    top.updateProjectionMatrix();
    top.updateMatrixWorld(true);
    cameras.push(["바로 위", top]);
    let inSeen = 0;
    let outSeen = 0;
    let mixedMeshes = 0;
    for (const [step, camera] of cameras) {
      const f = frustumOf(camera);
      for (const t of drawn.all) {
        const c = countsOf(t, base, f);
        inSeen += c.in;
        outSeen += c.out;
        if (c.in > 0 && c.out > 0) mixedMeshes += 1;
      }
      await frames(1, { camera });
      const checks = checkSelection(drawn, base, camera, "summer", drawn.all);
      expect({ step, checks }).toEqual({ step, checks: clean(checks) });
    }
    // 시야들이 실제로 인스턴스를 갈랐어야 뜻이 있다
    expect({ inSeen: inSeen > 0, outSeen: outSeen > 0, mixed: mixedMeshes > cameras.length }).toEqual({ inSeen: true, outSeen: true, mixed: true });
  });
});
