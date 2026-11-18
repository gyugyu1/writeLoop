// [spec] qa 테스트(작업 113 새 나무 모델 넣기, 기능 변경, 모바일): 바깥 마을(lobby3d-village)의 나무를 새 나무 모델(WriteLoop_Tree_<A·B·C>_LOD<1·2>.glb)로 그리는 것.
// 기대값은 명세(private 작업 폴더 113-2026-11-18-새-나무-모델-넣기/01-main-spec.md)에서만 가져온다. 그대로 둘 동작(N8·N9)의 값은 기준 커밋 3b11555의
// 지금 동작(카메라 없이 처음 그린 나무 인스턴스의 자리)에서 이 테스트와 같은 방법으로 잰 값이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, VillageModelErrorBoundary 속성 onFailed,
// 모델을 react-three-fiber useLoader로 읽는 것, useFrame으로 프레임마다 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// 어떻게 보나(111·112-② qa 테스트 lobby3d-village-frustum-cull·cull-hide와 같은 가짜 환경에 새 나무 불러오기를 더했다):
// - react-three-fiber만 가짜로 둔다. 가짜 불러오기는 tests/__fixtures__/village-trees-113.ts의 treeUseLoader: 나무 파일(이름이 WriteLoop_Tree_<종류>_LOD<단계>.glb)에는
//   앱 자산 폴더의 그 파일을 GLTFLoader 모양으로 푼 모델을, 그 밖에는 101의 가짜(마을 모델은 진짜 glb를 푼 장면, 장식 모델은 작은 상자)를 준다.
//   Jest가 읽지 못하는 자산(.glb 등)은 파일 이름 글자로 바꾼 뒤(mockUnreadableAssets) 마을 그리기 모듈을 require한다.
// - VillageNature와 VillageModel을 마을 화면(lobby3d-canvas의 VillageLayer)처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
//   나무를 어느 쪽이 그리는지는 가리지 않는다.
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 delta 0.1초로 모두 부른다. 프레임 상태는 {}(카메라 없음) 또는 { camera }(테스트가 만든 원근 카메라),
//   N6-f만 { gl, camera, scene }(가짜 그리개)다.
// - "나무 메시" = 그린 장면의 인스턴스 메시 가운데 도형이 새 나무 모델의 메시 도형인 것(점 자리로 알아본다). 종류·단계·부품(잎 Tree_Foliage, 줄기 Tree_Wood)은 그 도형의 파일·메시다.
//   "그루" = 나무 메시 인스턴스의 세계 변환(메시 세계 변환 × 인스턴스 행렬). 자리는 그 옮김 x·z.
// - "그려지는 인스턴스" = 메시와 그 위 모든 부모가 visible이면 0번부터 count-1번까지. 아니면 하나도 없다.
// - "마을 안 그루" = 자리가 VILLAGE_TREES의 자리와 0.001칸 안에서 맞는 그루. 그 밖은 "둘레 숲 그루".
// - "그리는 계절 칸" = 메시 도형의 uv를 재질 그림(map)의 변환 행렬(three.js가 그릴 때처럼 offset·repeat 등으로 만든 것)로 옮긴 그림 좌표가 원래 glTF UV + 그 계절 값인지.
//   (가정: 계절 칸은 그림 변환이나 도형 uv로 나타낸다. 셰이더를 고쳐 따로 더하는 방식이면 이 테스트로 볼 수 없다. 02-qa-tests.md "가정")
// - "시야에 든다"는 111 테스트와 같다: 인스턴스의 공(도형 boundingSphere를 그 그루의 세계 변환으로 옮긴 것)이 여섯 면 모두에서 1e-3칸 넘게 안쪽에 걸치면 in,
//   어느 한 면 밖으로 1e-3칸 넘게 벗어나면 out, 그 사이는 보지 않는다.
// - 명세에 수가 없어 qa가 정한 허용치(02-qa-tests.md "가정"): "고르게"(마을 안 70그루) = 종류마다 14~32그루, "대략 A 45%, C 45%, B 10%"(둘레 숲 300그루) =
//   A·C 각각 114~156그루(38~52%), B 15~45그루(5~15%). 배율·밝기 범위는 1e-4, 그림 좌표는 1e-5 안이면 맞다고 본다.
import { act, render } from "@testing-library/react-native";
import { Suspense, type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt, type Season } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_START, VILLAGE_TREES } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { allObjects, loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb, sourceGeometries } from "../__fixtures__/village-scene-101";
import {
  FOLIAGE_OFFSET,
  TREE_KINDS,
  TREE_LODS,
  TREE_PARTS,
  allTreeFilesPresent,
  imageKeyOf,
  imageKeyOfMaterial,
  resetTreeLoader,
  treeLoader,
  treePartOf,
  uvShiftError,
  woodOffset,
  type TreeKind,
  type TreePartInfo
} from "../__fixtures__/village-trees-113";

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

// 07 결정 뒤(qa): 단언이 실패해도 그 테스트가 그린 화면을 치운다(실패가 뒤 테스트로 번지지 않게). 단언·입력은 바꾸지 않는다
const mounted: (() => void)[] = [];

/** 한 번만 치우는 unmount를 적어 두고 돌려준다. */
function track(unmount: () => void): () => void {
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    unmount();
  };
  mounted.push(once);
  return once;
}

afterEach(async () => {
  const pending = mounted.splice(0);
  await act(async () => {
    for (const unmount of pending) {
      try {
        unmount();
      } catch {
        // 이미 치운 화면은 넘어간다
      }
    }
  });
  mockFrames.length = 0;
  jest.restoreAllMocks();
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

type FrameState = { camera?: THREE.Camera | null; gl?: unknown; scene?: THREE.Scene };
type Tree = { mesh: THREE.InstancedMesh; info: TreePartInfo; label: string };
type Drawn = { roots: THREE.Object3D[]; light: Light; source: THREE.Object3D; pick: MutableRefObject<THREE.Object3D[]>; unmount: () => void };

async function frames(count: number, state: FrameState = {}) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f(state, 0.1);
  });
}

async function setSeason(drawn: Drawn, season: Season, state: FrameState = {}, count = 1) {
  const next = lightAt(season);
  drawn.light.ambience = next.ambience;
  drawn.light.target = next.target;
  await frames(count, state);
}

/** 마을을 그린다. layer면 lobby3d-canvas의 VillageLayer와 같은 모양(모델 오류 경계 > Suspense > 모델)으로 그린다. firstFrame은 처음 두 프레임의 상태. */
async function draw(season: Season = "summer", opts: { layer?: boolean; onFailed?: () => void; firstFrame?: FrameState } = {}): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
  const light = lightAt(season);
  const source = (loaderState.village as { scene: THREE.Object3D }).scene;
  const model = <village.VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />;
  const view = await render(
    <>
      <village.VillageNature daylight={light as unknown as DaylightState} />
      {opts.layer ? (
        <village.VillageModelErrorBoundary onFailed={opts.onFailed}>
          <Suspense fallback={null}>{model}</Suspense>
        </village.VillageModelErrorBoundary>
      ) : (
        model
      )}
    </>
  );
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  expect(roots.length).toBeGreaterThan(0);
  await frames(2, opts.firstFrame ?? {});
  return { roots, light, source, pick, unmount: track(() => view.unmount()) };
}

/** 그린 장면의 나무 메시(머리말). */
function treesOf(roots: THREE.Object3D[]): Tree[] {
  const out: Tree[] = [];
  for (const o of allObjects(roots)) {
    if (!(o instanceof THREE.InstancedMesh)) continue;
    const info = treePartOf(o.geometry);
    if (info) out.push({ mesh: o, info, label: `${info.kind}-LOD${info.lod}-${info.part}` });
  }
  return out;
}

/** 새 나무 파일이 모두 있고 나무 메시가 있어야 아래를 볼 수 있다. */
function needTrees(drawn: Drawn): Tree[] {
  expect({ treeFilesInApp: allTreeFilesPresent() }).toEqual({ treeFilesInApp: true });
  const trees = treesOf(drawn.roots);
  expect(trees.length).toBeGreaterThan(0);
  return trees;
}

/** 마을 모델의 Kenney 나무 틀(tree-templates) 도형을 쓰는, 그려지는 메시(인스턴스 포함). */
function drawnTemplateMeshes(drawn: Drawn): string[] {
  const templates = sourceGeometries(drawn.source).byGroup.get("tree-templates") ?? new Set<THREE.BufferGeometry>();
  return allObjects(drawn.roots)
    .filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && templates.has(o.geometry) && shownChain(o, drawn.roots) && (!(o instanceof THREE.InstancedMesh) || o.count > 0))
    .map((o) => o.name || o.type);
}

function shownChain(o: THREE.Object3D, roots: THREE.Object3D[]): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if (roots.includes(n)) return true;
  }
  return false;
}

type Inst = { key: string; world: THREE.Matrix4; x: number; z: number; color: THREE.Color | null };

const keyOf = (m: THREE.Matrix4) => m.elements.map((v) => (Math.abs(v) < 5e-6 ? 0 : v).toFixed(5)).join(",");

/** 메시가 보이는지와 상관없이 0번~count-1번 인스턴스. */
function slots(mesh: THREE.InstancedMesh): Inst[] {
  mesh.updateWorldMatrix(true, false);
  const m = new THREE.Matrix4();
  const out: Inst[] = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, m);
    const world = new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld, m);
    let color: THREE.Color | null = null;
    if (mesh.instanceColor) {
      color = new THREE.Color();
      mesh.getColorAt(i, color);
    }
    out.push({ key: keyOf(world), world, x: world.elements[12], z: world.elements[14], color });
  }
  return out;
}

/** 지금 그려지는 인스턴스. */
function drawnInstances(mesh: THREE.InstancedMesh, roots: THREE.Object3D[]): Inst[] {
  for (const r of roots) r.updateMatrixWorld(true);
  return shownChain(mesh, roots) ? slots(mesh) : [];
}

const isInterior = (x: number, z: number) => VILLAGE_TREES.some(([tx, tz]) => Math.abs(tx - x) < 1e-3 && Math.abs(tz - z) < 1e-3);

// ---------- 카메라와 시야(111·112-② 테스트와 같다) ----------

const PITCH = (42 * Math.PI) / 180;

function villageCamera(look: { x: number; z: number }, viewWidth = 9): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(30, 0.5, 1, 200);
  const tanH = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
  const dist = viewWidth / (2 * tanH);
  camera.position.set(look.x, dist * Math.sin(PITCH), look.z + dist * Math.cos(PITCH));
  camera.lookAt(look.x, 0, look.z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function emptyCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(30, 0.5, 1, 200);
  camera.position.set(1000, 10, 1000);
  camera.lookAt(1100, 10, 1000);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

const CORNER = { x: 6, z: 52 };
/**
 * 07 결정(사용자 2026-11-18 "qa가 카메라 자리를 고침"): N1의 "가까이(폭 5)" 시야는 라룹이 집 문 앞(VILLAGE_START) 대신, 집 문 앞에서 가장 가까운
 * 마을 안 나무 자리(지금 배치로 (42.2, 9.8))를 본다. 집 문 앞 폭 5 시야에는 나무 공이 분명히 드는 그루가 없었다.
 * qa가 새 나무 LOD1 도형의 boundingSphere로 계산해 보니, 마을 안 나무 자리 70곳 어디를 이 카메라로 보아도 그 자리 그루는 종류 A·B·C × 배율 1.7·2.05 ×
 * 방향 36가지 모두에서 잎·줄기 공이 여섯 면 안쪽으로 3.2칸 넘게 들어 있다.
 */
const NEAR_TREE = (() => {
  const [x, z] = [...VILLAGE_TREES].sort((a, b) => Math.hypot(a[0] - VILLAGE_START.x, a[1] - VILLAGE_START.z) - Math.hypot(b[0] - VILLAGE_START.x, b[1] - VILLAGE_START.z))[0];
  return { x, z };
})();
const FAR_SIDE = { x: 60, z: 10 };
const MIDDLE = { x: 35, z: 30 };
const EPS = 1e-3;

function classify(mesh: THREE.InstancedMesh, world: THREE.Matrix4, camera: THREE.Camera): "in" | "out" | "edge" {
  camera.updateMatrixWorld(true);
  const geometry = mesh.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere!.clone().applyMatrix4(world);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let least = Infinity;
  for (const plane of frustum.planes) least = Math.min(least, plane.distanceToPoint(sphere.center) + sphere.radius);
  if (least < -EPS) return "out";
  if (least > EPS) return "in";
  return "edge";
}

type Check = { mesh: string; unknown: number; duplicated: number; missingIn: number; drawnOut: number; visible: boolean | "보지 않음" };

/** 나무 메시마다: 그려지는 그루가 카메라 없을 때의 그루이고 겹치지 않으며, in은 모두 그려지고 out은 그려지지 않는다. 모두 out이면 숨고, in이 있으면 보인다. */
function checkView(trees: Tree[], base: Map<Tree, Map<string, THREE.Matrix4>>, roots: THREE.Object3D[], camera: THREE.Camera): { checks: Check[]; want: Check[]; inSeen: number; outSeen: number } {
  let inSeen = 0;
  let outSeen = 0;
  const checks: Check[] = [];
  const want: Check[] = [];
  for (const t of trees) {
    const table = base.get(t)!;
    const list = drawnInstances(t.mesh, roots);
    const seen = new Map<string, number>();
    let unknown = 0;
    for (const i of list) {
      seen.set(i.key, (seen.get(i.key) ?? 0) + 1);
      if (!table.has(i.key)) unknown += 1;
    }
    let missingIn = 0;
    let drawnOut = 0;
    let ins = 0;
    let edges = 0;
    for (const [key, world] of table) {
      const c = classify(t.mesh, world, camera);
      if (c === "in") ins += 1;
      if (c === "edge") edges += 1;
      if (c === "in" && !seen.has(key)) missingIn += 1;
      if (c === "out" && seen.has(key)) drawnOut += 1;
    }
    inSeen += ins;
    outSeen += table.size - ins - edges;
    const wantVisible: boolean | "보지 않음" = ins > 0 ? true : edges === 0 ? false : "보지 않음";
    const duplicated = [...seen.values()].filter((n) => n > 1).length;
    checks.push({ mesh: t.label, unknown, duplicated, missingIn, drawnOut, visible: wantVisible === "보지 않음" ? "보지 않음" : t.mesh.visible });
    want.push({ mesh: t.label, unknown: 0, duplicated: 0, missingIn: 0, drawnOut: 0, visible: wantVisible });
  }
  return { checks, want, inSeen, outSeen };
}

/** 카메라 없이 그린 그루(메시마다 키 → 세계 변환). */
function baselineOf(trees: Tree[]): Map<Tree, Map<string, THREE.Matrix4>> {
  return new Map(trees.map((t) => [t, new Map(slots(t.mesh).map((i) => [i.key, i.world]))]));
}

// ---------- 그루 표 ----------

type Row = { kind: TreeKind; lod: number; part: string; x: number; z: number; scale: [number, number, number]; quat: THREE.Quaternion; y: number; brightness: number | null; color: THREE.Color | null };

function rowsOf(trees: Tree[]): Row[] {
  const rows: Row[] = [];
  for (const t of trees) {
    for (const i of slots(t.mesh)) {
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      i.world.decompose(pos, quat, scale);
      rows.push({ kind: t.info.kind, lod: t.info.lod, part: t.info.part, x: pos.x, z: pos.z, y: pos.y, scale: [scale.x, scale.y, scale.z], quat, brightness: i.color ? i.color.r : null, color: i.color });
    }
  }
  return rows;
}

const spotKey = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;

/** 그루마다(잎 기준) 종류·단계·배율·방향·밝기 표(자리 → 글). 같은 결과인지 견줄 때 쓴다. */
function treeTable(trees: Tree[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rowsOf(trees)) {
    const k = `${r.part} ${spotKey(r.x, r.z)}`;
    out.set(k, `${r.kind} LOD${r.lod} s${r.scale.map((v) => v.toFixed(4)).join("/")} q${[r.quat.x, r.quat.y, r.quat.z, r.quat.w].map((v) => v.toFixed(4)).join("/")} b${r.brightness?.toFixed(4) ?? "-"}`);
  }
  return out;
}

// 기준 커밋 3b11555에서 잰 값(머리말): 나무 수와, 카메라 없이 처음 그린 잎(줄기) 인스턴스 자리 "x,y,z"(소수 셋째 자리)를 정렬해 줄로 이은 글의 sha256
const INTERIOR_TREES = 70;
const FOREST_TREES = 300;
const TREE_POSITIONS_DIGEST = "51fd2a5c12806120485adec49829e8633628148e8412c005f05eccc78fbe17b8";
const FOREST_POSITIONS_DIGEST = "a3505b7e76b3dedb7a123171705daaa5964269327624d00f1c178606a515b0de";

const nodeCrypto = (process as unknown as { getBuiltinModule: (id: string) => typeof import("crypto") }).getBuiltinModule("crypto");
const sha256 = (s: string) => nodeCrypto.createHash("sha256").update(s).digest("hex");

/** 시드로 정해지는 수열(Math.random 대신 넣는다). */
function sequence(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 48271) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---------- 바뀔 동작 ----------

describe("[spec] 113 바뀔 동작: 마을 나무를 새 모델로 그린다(명세 1~6)", () => {
  it("[바뀔] N1 새 모델·단계(명세 1): 마을 나무는 새 나무 모델로 그리고 Kenney 나무 틀은 그리지 않는다. 마을 안 그루(VILLAGE_TREES 자리 70)는 LOD1, 둘레 숲 그루(300)는 LOD2이고, 자리마다 잎·줄기가 같은 종류·같은 변환으로 하나씩 있다. 카메라를 가까이·멀리 옮겨도 그루의 단계는 바뀌지 않는다", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    expect(drawnTemplateMeshes(drawn)).toEqual([]);
    const rows = rowsOf(trees);
    for (const part of TREE_PARTS) {
      const mine = rows.filter((r) => r.part === part);
      const wrongLod = mine.filter((r) => (isInterior(r.x, r.z) ? r.lod !== 1 : r.lod !== 2)).map((r) => `LOD${r.lod} ${spotKey(r.x, r.z)}`);
      const perSpot = VILLAGE_TREES.map(([x, z]) => mine.filter((r) => Math.abs(r.x - x) < 1e-3 && Math.abs(r.z - z) < 1e-3).length);
      expect({ part, wrongLod: wrongLod.slice(0, 10), spotsNotOnce: perSpot.filter((n) => n !== 1).length, forest: mine.filter((r) => !isInterior(r.x, r.z)).length }).toEqual({
        part,
        wrongLod: [],
        spotsNotOnce: 0,
        forest: FOREST_TREES
      });
    }
    // 같은 그루의 잎과 줄기: (종류, 단계, 세계 변환)이 짝지어진다
    const tag = (part: string) =>
      trees
        .filter((t) => t.info.part === part)
        .flatMap((t) => slots(t.mesh).map((i) => `${t.info.kind} LOD${t.info.lod} ${i.key}`))
        .sort();
    expect(tag("foliage")).toEqual(tag("wood"));
    // 카메라 거리와 관계없이: 가까운 시야·먼 시야·구석에서 그려지는 LOD1 그루는 모두 마을 안, LOD2 그루는 모두 둘레 숲이고 메시의 도형은 처음 그대로다
    const geometryAtStart = new Map(trees.map((t) => [t.mesh, t.mesh.geometry]));
    for (const [name, camera] of [
      ["가까이(폭 5)", villageCamera(NEAR_TREE, 5)],
      ["멀리(폭 40)", villageCamera(MIDDLE, 40)],
      ["구석", villageCamera(CORNER)]
    ] as const) {
      await frames(1, { camera });
      const wrong: string[] = [];
      let seen = 0;
      for (const t of treesOf(drawn.roots)) {
        if (geometryAtStart.get(t.mesh) !== t.mesh.geometry) wrong.push(`${t.label} 도형 바뀜`);
        for (const i of drawnInstances(t.mesh, drawn.roots)) {
          seen += 1;
          if ((t.info.lod === 1) !== isInterior(i.x, i.z)) wrong.push(`${t.label} ${spotKey(i.x, i.z)}`);
        }
      }
      expect({ name, seen: seen > 0, wrong: wrong.slice(0, 10) }).toEqual({ name, seen: true, wrong: [] });
    }
  });

  it("[바뀔] N2 종류(명세 2): 마을 안은 A·B·C를 고르게(종류마다 14~32그루), 둘레 숲은 A·C 위주로 B는 조금(A·C 각각 114~156그루, B 15~45그루) 섞는다. 다시 그려도(Math.random이 다른 값을 주어도) 그루마다 종류·단계·배율·방향·밝기가 같다", async () => {
    let seq = sequence(7);
    jest.spyOn(Math, "random").mockImplementation(() => seq());
    const first = await draw("summer");
    const trees = needTrees(first);
    const leaves = rowsOf(trees).filter((r) => r.part === "foliage");
    const count = (group: Row[], kind: TreeKind) => group.filter((r) => r.kind === kind).length;
    const inside = leaves.filter((r) => isInterior(r.x, r.z));
    const forest = leaves.filter((r) => !isInterior(r.x, r.z));
    const insideCounts = Object.fromEntries(TREE_KINDS.map((k) => [k, count(inside, k)]));
    const forestCounts = Object.fromEntries(TREE_KINDS.map((k) => [k, count(forest, k)]));
    const between = (n: number, lo: number, hi: number) => n >= lo && n <= hi;
    expect({
      inside: insideCounts,
      insideTotal: inside.length,
      insideEven: TREE_KINDS.every((k) => between(insideCounts[k], 14, 32)),
      forest: forestCounts,
      forestTotal: forest.length,
      forestA: between(forestCounts.A, 114, 156),
      forestC: between(forestCounts.C, 114, 156),
      forestB: between(forestCounts.B, 15, 45)
    }).toEqual({
      inside: insideCounts,
      insideTotal: INTERIOR_TREES,
      insideEven: true,
      forest: forestCounts,
      forestTotal: FOREST_TREES,
      forestA: true,
      forestC: true,
      forestB: true
    });
    const table1 = treeTable(trees);
    await act(async () => first.unmount());
    mockFrames.length = 0;
    resetFakeLoader();
    resetTreeLoader();
    loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
    seq = sequence(99991);
    const second = await draw("summer");
    const table2 = treeTable(needTrees(second));
    const differ = [...table1.keys()].filter((k) => table1.get(k) !== table2.get(k)).map((k) => `${k}: ${table1.get(k)} → ${table2.get(k) ?? "없음"}`);
    expect({ size: table2.size, differ: differ.slice(0, 10) }).toEqual({ size: table1.size, differ: [] });
  });

  it("[바뀔] N3 크기·방향(명세 3): 그루마다 새 모델 원본에 고르게 곱한 배율이 마을 안 1.7~2.05, 둘레 숲 1.6~2.1이고, 돌림은 y축 돌림뿐이며 밑은 y = 0이다. 배율과 방향은 그루마다 다르다", async () => {
    const drawn = await draw("summer");
    const rows = rowsOf(needTrees(drawn));
    const bad: string[] = [];
    for (const r of rows) {
      const [sx, sy, sz] = r.scale;
      const [lo, hi] = isInterior(r.x, r.z) ? [1.7, 2.05] : [1.6, 2.1];
      if (Math.abs(sx - sy) > 1e-4 || Math.abs(sy - sz) > 1e-4) bad.push(`고르지 않은 배율 ${r.part} ${spotKey(r.x, r.z)} ${r.scale.map((v) => v.toFixed(4)).join("/")}`);
      if (sy < lo - 1e-4 || sy > hi + 1e-4) bad.push(`배율 밖 ${r.part} ${spotKey(r.x, r.z)} ${sy.toFixed(4)} (${lo}~${hi})`);
      if (Math.abs(r.quat.x) > 1e-5 || Math.abs(r.quat.z) > 1e-5) bad.push(`y축 말고 돌림 ${r.part} ${spotKey(r.x, r.z)}`);
      if (Math.abs(r.y) > 1e-4) bad.push(`밑 높이 ${r.part} ${spotKey(r.x, r.z)} ${r.y.toFixed(4)}`);
    }
    expect(bad.slice(0, 20)).toEqual([]);
    const leaves = rows.filter((r) => r.part === "foliage");
    const distinct = (group: Row[], f: (r: Row) => string) => new Set(group.map(f)).size;
    const inside = leaves.filter((r) => isInterior(r.x, r.z));
    const forest = leaves.filter((r) => !isInterior(r.x, r.z));
    expect({
      insideScales: distinct(inside, (r) => r.scale[1].toFixed(3)) > 10,
      forestScales: distinct(forest, (r) => r.scale[1].toFixed(3)) > 10,
      turns: distinct(leaves, (r) => Math.atan2(r.quat.y, r.quat.w).toFixed(3)) > 10
    }).toEqual({ insideScales: true, forestScales: true, turns: true });
  });

  it("[바뀔] N4 계절(명세 4): 잎은 그 계절 칸(glTF UV + 봄 (0,0)·여름 (0.5,0)·가을 (0,0.5))을 그리고, 겨울에는 잎이 그려지지 않으며 줄기는 눈 칸(+ (0.5,0)), 겨울이 아니면 줄기는 평소 칸(+ (0,0))이다. 계절이 바뀐 그 프레임에 따른다(카메라가 없을 때와 나무를 보는 카메라일 때 모두)", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    for (const [state, name] of [
      [{} as FrameState, "카메라 없음"],
      [{ camera: villageCamera(VILLAGE_START) } as FrameState, "라룹이 집 앞 카메라"]
    ] as const) {
      for (const season of ["summer", "autumn", "winter", "spring", "winter", "summer"] as Season[]) {
        await setSeason(drawn, season, state, 1);
        const got = trees.map((t) => {
          const drawnCount = drawnInstances(t.mesh, drawn.roots).length;
          const offset = t.info.part === "foliage" ? FOLIAGE_OFFSET[season] : woodOffset(season);
          const hiddenFoliage = t.info.part === "foliage" && season === "winter";
          return { name, season, mesh: t.label, drawnNone: drawnCount === 0, cellOk: hiddenFoliage ? "보지 않음" : uvShiftError(t.mesh, t.info, offset) <= 1e-5 };
        });
        const want = trees.map((t) => {
          const hiddenFoliage = t.info.part === "foliage" && season === "winter";
          // 카메라 없으면 모두 그린다. 카메라가 있으면 그려지는지는 시야를 따르므로 겨울 잎만 본다
          const drawnNone = hiddenFoliage ? true : state.camera ? got.find((g) => g.mesh === t.label)!.drawnNone : false;
          return { name, season, mesh: t.label, drawnNone, cellOk: hiddenFoliage ? "보지 않음" : true };
        });
        expect(got).toEqual(want);
      }
    }
    // 이 카메라 시야에서 잎과 줄기가 실제로 그려졌어야(겨울이 아닐 때) 뜻이 있다
    const camera = villageCamera(VILLAGE_START);
    await setSeason(drawn, "spring", { camera }, 1);
    expect({
      foliage: trees.some((t) => t.info.part === "foliage" && drawnInstances(t.mesh, drawn.roots).length > 0),
      wood: trees.some((t) => t.info.part === "wood" && drawnInstances(t.mesh, drawn.roots).length > 0)
    }).toEqual({ foliage: true, wood: true });
  });

  it("[바뀔] N5 그루 밝기(명세 5): 잎 인스턴스 색은 그루마다 회색 밝기 0.9~1.05이고 계절이 바뀌어도 같다(계절 색을 입히지 않는다). 줄기는 곱하지 않는다(인스턴스 색이 없거나 모두 흰색). 잎·줄기 재질 색은 흰색이다. 밝기는 그루마다 다르다", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    const foliage = trees.filter((t) => t.info.part === "foliage");
    const wood = trees.filter((t) => t.info.part === "wood");
    const brightness = () => {
      const out = new Map<string, string>();
      const bad: string[] = [];
      for (const t of foliage) {
        if (!t.mesh.instanceColor) bad.push(`${t.label} 인스턴스 색 없음`);
        for (const i of slots(t.mesh)) {
          const c = i.color ?? new THREE.Color(1, 1, 1);
          if (Math.abs(c.r - c.g) > 1e-5 || Math.abs(c.g - c.b) > 1e-5) bad.push(`${t.label} ${spotKey(i.x, i.z)} 회색 아님 ${c.getHexString()}`);
          if (c.r < 0.9 - 1e-4 || c.r > 1.05 + 1e-4) bad.push(`${t.label} ${spotKey(i.x, i.z)} 밝기 ${c.r.toFixed(4)}`);
          out.set(`${t.label} ${i.key}`, c.r.toFixed(4));
        }
      }
      return { out, bad };
    };
    const summer = brightness();
    expect(summer.bad.slice(0, 10)).toEqual([]);
    expect(new Set(summer.out.values()).size).toBeGreaterThan(10);
    for (const season of ["autumn", "winter", "spring", "summer"] as Season[]) {
      await setSeason(drawn, season, {}, 1);
      if (season === "winter") continue;
      const now = brightness();
      const changed = [...summer.out.keys()].filter((k) => now.out.get(k) !== summer.out.get(k)).length;
      expect({ season, bad: now.bad.slice(0, 5), changed }).toEqual({ season, bad: [], changed: 0 });
    }
    const woodColors = wood.flatMap((t) => (t.mesh.instanceColor ? slots(t.mesh).filter((i) => i.color && (i.color.r !== 1 || i.color.g !== 1 || i.color.b !== 1)).map((i) => `${t.label} ${spotKey(i.x, i.z)}`) : []));
    expect(woodColors.slice(0, 10)).toEqual([]);
    const materialColors = trees.map((t) => ({ mesh: t.label, color: ((Array.isArray(t.mesh.material) ? t.mesh.material[0] : t.mesh.material) as THREE.MeshStandardMaterial).color.getHex() }));
    expect(materialColors).toEqual(trees.map((t) => ({ mesh: t.label, color: 0xffffff })));
  });

  it("[바뀔] N6-a 그리기 구조(명세 6): 나무 메시는 종류 × 단계 × 부품마다 하나씩 12개다", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    const labels = trees.map((t) => t.label).sort();
    const want = TREE_KINDS.flatMap((k) => TREE_LODS.flatMap((l) => TREE_PARTS.map((p) => `${k}-LOD${l}-${p}`))).sort();
    expect(labels).toEqual(want);
  });

  it("[바뀔] N6-b 재질과 같은 그림(명세 새 나무 모델·11): 잎은 그림이 있고 양면·알파 잘라내기 0.5, 줄기는 그림이 있다. 같은 단계의 잎 그림은 A·B·C가 하나(같은 그림 원본)를 함께 쓰고, 줄기 그림은 A·B가 하나를 함께 쓰며 C는 따로다. 그림은 그 파일의 그 그림이다", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    const mat = (t: Tree) => (Array.isArray(t.mesh.material) ? t.mesh.material[0] : t.mesh.material) as THREE.MeshStandardMaterial;
    expect(
      trees.map((t) => ({
        mesh: t.label,
        map: mat(t).map instanceof THREE.Texture,
        ...(t.info.part === "foliage" ? { alphaTest: mat(t).alphaTest, side: mat(t).side } : {}),
        image: imageKeyOfMaterial(t.mesh) === imageKeyOf(t.info.kind, t.info.lod, t.info.part)
      }))
    ).toEqual(
      trees.map((t) => ({
        mesh: t.label,
        map: true,
        ...(t.info.part === "foliage" ? { alphaTest: 0.5, side: THREE.DoubleSide } : {}),
        image: true
      }))
    );
    const sourceOf = (kind: TreeKind, lod: number, part: string) => mat(trees.find((t) => t.info.kind === kind && t.info.lod === lod && t.info.part === part)!).map!.source;
    for (const lod of TREE_LODS) {
      expect({
        lod,
        foliageAB: sourceOf("A", lod, "foliage") === sourceOf("B", lod, "foliage"),
        foliageAC: sourceOf("A", lod, "foliage") === sourceOf("C", lod, "foliage"),
        woodAB: sourceOf("A", lod, "wood") === sourceOf("B", lod, "wood"),
        woodAC: sourceOf("A", lod, "wood") === sourceOf("C", lod, "wood")
      }).toEqual({ lod, foliageAB: true, foliageAC: true, woodAB: true, woodAC: false });
    }
  });

  it("[바뀔] N6-c 시야 고르기(명세 6, 112-①): 카메라를 주면 나무 메시마다 시야에 분명히 드는 그루는 모두, 분명히 안 드는 그루는 하나도 그려지지 않고, 모두 시야 밖인 메시는 숨고 시야에 드는 그루가 있는 메시는 보인다. 나무가 하나도 안 보이는 시야면 나무 메시가 모두 숨고, 다시 마을을 보면 그 프레임에 따른다", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    const base = baselineOf(trees);
    let inSeen = 0;
    let outSeen = 0;
    for (const look of [VILLAGE_START, CORNER, FAR_SIDE, MIDDLE]) {
      const camera = villageCamera(look);
      await frames(1, { camera });
      const view = checkView(trees, base, drawn.roots, camera);
      inSeen += view.inSeen;
      outSeen += view.outSeen;
      expect({ look, checks: view.checks }).toEqual({ look, checks: view.want });
    }
    expect({ inSeen: inSeen > 0, outSeen: outSeen > 0 }).toEqual({ inSeen: true, outSeen: true });
    await frames(1, { camera: emptyCamera() });
    expect(trees.map((t) => ({ mesh: t.label, visible: t.mesh.visible, drawn: drawnInstances(t.mesh, drawn.roots).length }))).toEqual(trees.map((t) => ({ mesh: t.label, visible: false, drawn: 0 })));
    const back = villageCamera(VILLAGE_START);
    await frames(1, { camera: back });
    const view = checkView(trees, base, drawn.roots, back);
    expect(view.checks).toEqual(view.want);
  });

  it("[바뀔] N6-d 겨울 잎 숨기기와 시야 고르기(명세 6): 겨울 동안은 시야에 드는 그루가 있어도 잎 메시가 모두 숨는다. 빈 시야에서 겨울 → 봄이 되면 잎 메시는 숨은 채이고, 그 뒤 마을을 보면 그 프레임에 시야에 드는 잎이 있는 메시가 보인다. 마을을 보며 겨울 → 봄이 되면 그 프레임에 시야대로 그린다", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    const foliage = trees.filter((t) => t.info.part === "foliage");
    const base = baselineOf(trees);
    const looking = villageCamera(VILLAGE_START);
    await setSeason(drawn, "winter", { camera: looking }, 1);
    for (const camera of [looking, villageCamera(CORNER), villageCamera(MIDDLE, 30)]) {
      await frames(1, { camera });
      expect(foliage.map((t) => ({ mesh: t.label, drawn: drawnInstances(t.mesh, drawn.roots).length }))).toEqual(foliage.map((t) => ({ mesh: t.label, drawn: 0 })));
    }
    await frames(1, { camera: looking });
    await setSeason(drawn, "spring", { camera: looking }, 1);
    let view = checkView(trees, base, drawn.roots, looking);
    expect(view.checks).toEqual(view.want);
    expect(foliage.some((t) => drawnInstances(t.mesh, drawn.roots).length > 0)).toBe(true);
    const empty = emptyCamera();
    await setSeason(drawn, "winter", { camera: empty }, 1);
    await setSeason(drawn, "spring", { camera: empty }, 1);
    expect(foliage.map((t) => ({ mesh: t.label, visible: t.mesh.visible }))).toEqual(foliage.map((t) => ({ mesh: t.label, visible: false })));
    await frames(1, { camera: looking });
    view = checkView(trees, base, drawn.roots, looking);
    expect(view.checks).toEqual(view.want);
  });

  it("[바뀔] N6-e 셰이더 미리 준비(명세 6, 112-①): 나무가 하나도 안 보이는 시야로 그린 첫 프레임에, 나무 메시마다 같은 도형·재질의 인스턴스 메시(인스턴스 색이 있으면 그것도)를 three.js 미리 컴파일(compile·compileAsync)에 넘긴다", async () => {
    const compiled: THREE.Object3D[] = [];
    const scene = new THREE.Scene();
    let roots: THREE.Object3D[] = [];
    const record = (method: string) => (target: THREE.Object3D) => {
      // three.js compile은 보이는 것만 훑는다. 진짜 앱에서는 마을 뿌리가 react-three-fiber 장면 안에 있다
      target.traverseVisible((o) => compiled.push(o));
      if (target === scene) for (const r of roots) r.traverseVisible((o) => compiled.push(o));
      return method === "compileAsync" ? Promise.resolve(target) : new Set();
    };
    const gl = { compile: jest.fn(record("compile")), compileAsync: jest.fn(record("compileAsync")), initTexture: jest.fn(), capabilities: { getMaxAnisotropy: () => 1 } };
    const camera = emptyCamera();
    const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
    const light = lightAt("summer");
    const view = await render(
      <>
        <village.VillageNature daylight={light as unknown as DaylightState} />
        <village.VillageModel sim={{ x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true } as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
      </>
    );
    const unmount = track(() => view.unmount());
    roots = view.container.queryAll((instance: TestInstance) => instance.type === "primitive").map((p) => (p.props as { object: THREE.Object3D }).object);
    await frames(1, { gl, camera, scene });
    const trees = needTrees({ roots, light, source: (loaderState.village as { scene: THREE.Object3D }).scene, pick, unmount });
    expect(
      trees.map((t) => ({
        mesh: t.label,
        warmed: compiled.some((o) => o instanceof THREE.InstancedMesh && o.geometry === t.mesh.geometry && o.material === t.mesh.material && !!o.instanceColor === !!t.mesh.instanceColor)
      }))
    ).toEqual(trees.map((t) => ({ mesh: t.label, warmed: true })));
  });

  it("[바뀔] N6-f 위치 행렬 얼리기(명세 6, 112-②): 그린 뒤 나무 메시와 그 위 묶음은 위치 행렬을 프레임마다 다시 계산하지 않고(matrixAutoUpdate false), 세계 행렬은 자리·방향·크기로 다시 계산한 값과 같다", async () => {
    const drawn = await draw("summer");
    const trees = needTrees(drawn);
    await frames(2, { camera: villageCamera(VILLAGE_START) });
    const rows = trees.map((t) => {
      const auto: string[] = [];
      const expected = new THREE.Matrix4();
      const chain: THREE.Object3D[] = [];
      for (let n: THREE.Object3D | null = t.mesh; n; n = n.parent) {
        chain.unshift(n);
        if (n.matrixAutoUpdate) auto.push(n.name || n.type);
        if (drawn.roots.includes(n)) break;
      }
      for (const n of chain) expected.multiply(new THREE.Matrix4().compose(n.position, n.quaternion, n.scale));
      const worst = t.mesh.matrixWorld.elements.reduce((w, v, i) => Math.max(w, Math.abs(v - expected.elements[i])), 0);
      return { mesh: t.label, auto, matrixWorldOk: worst <= 1e-6 };
    });
    expect(rows).toEqual(trees.map((t) => ({ mesh: t.label, auto: [], matrixWorldOk: true })));
  });

  it("[바뀔] N7 나무 모델을 읽지 못하면(명세 12): 마을 화면(VillageLayer 모양)이 멈추지 않고 나무만 빼고 그린다. 건물·풀밭·땅 꾸밈은 그려지고 마을 모델 실패 알림(onFailed)은 오지 않으며, 그 오류를 개발 콘솔에 남긴다([lobby3d]로 시작하는 console.warn에 그 오류)", async () => {
    const failure = new Error("나무 모델을 읽지 못함(시험)");
    treeLoader.fail = failure;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    const onFailed = jest.fn();
    const drawn = await draw("summer", { layer: true, onFailed });
    await frames(3, { camera: villageCamera(VILLAGE_START) });
    await frames(2);
    const objects = allObjects(drawn.roots);
    const underBuilding = (o: THREE.Object3D) => {
      for (let n: THREE.Object3D | null = o; n; n = n.parent) if (/^bld-/.test(n.name)) return true;
      return false;
    };
    const buildings = objects.filter((o) => o instanceof THREE.Mesh && shownChain(o, drawn.roots) && underBuilding(o));
    expect({
      triedTrees: treeLoader.calls.length > 0,
      onFailed: onFailed.mock.calls.length,
      model: drawn.roots.some((r) => r.getObjectByName("windmill-rotor") !== undefined),
      buildings: buildings.length > 0,
      ground: objects.some((o) => o instanceof THREE.HemisphereLight),
      groundDecor: objects.some((o) => o.name === "village-ground"),
      newTrees: treesOf(drawn.roots).length,
      kenneyTrees: drawnTemplateMeshes(drawn),
      warned: warn.mock.calls.some((call) => typeof call[0] === "string" && call[0].startsWith("[lobby3d]") && call.includes(failure))
    }).toEqual({ triedTrees: true, onFailed: 0, model: true, buildings: true, ground: true, groundDecor: true, newTrees: 0, kenneyTrees: [], warned: true });
  });
});

// ---------- 그대로 둘 동작 ----------

/** 나무로 보는 메시: 새 나무 모델 도형이거나(구현 뒤) Kenney 나무 틀 도형(구현 전)인 인스턴스 메시. 부품은 잎(foliage·leaf)과 줄기. */
function anyTrees(drawn: Drawn): { mesh: THREE.InstancedMesh; part: "foliage" | "wood" }[] {
  const names = new Map<THREE.BufferGeometry, string>();
  drawn.source.getObjectByName("tree-templates")?.traverse((o) => {
    if (o instanceof THREE.Mesh) names.set(o.geometry, o.name);
  });
  const out: { mesh: THREE.InstancedMesh; part: "foliage" | "wood" }[] = [];
  for (const o of allObjects(drawn.roots)) {
    if (!(o instanceof THREE.InstancedMesh)) continue;
    const info = treePartOf(o.geometry);
    if (info) out.push({ mesh: o, part: info.part });
    else if (names.has(o.geometry)) out.push({ mesh: o, part: names.get(o.geometry)!.endsWith("-leaf") ? "foliage" : "wood" });
  }
  return out;
}

describe("[spec] 113 그대로 둘 동작: 나무 자리와 그루 수, 누르기", () => {
  it("[그대로] N8 나무 자리 계산과 그루 수(그대로여야 할 동작): 카메라 없이 그린 잎과 줄기의 그루 자리가 기준 커밋과 같다(마을 안 70그루는 VILLAGE_TREES 자리, 둘레 숲 300그루는 같은 자리)", async () => {
    const drawn = await draw("summer");
    const trees = anyTrees(drawn);
    expect(trees.length).toBeGreaterThan(0);
    for (const part of ["foliage", "wood"] as const) {
      const spots = trees
        .filter((t) => t.part === part)
        .flatMap((t) => slots(t.mesh))
        .map((i) => `${i.x.toFixed(3)},${i.world.elements[13].toFixed(3)},${i.z.toFixed(3)}`);
      const forest = spots.filter((s) => {
        const [x, , z] = s.split(",").map(Number);
        return !isInterior(x, z);
      });
      expect({ part, count: spots.length, interior: spots.length - forest.length, digest: sha256([...spots].sort().join("\n")), forestDigest: sha256([...forest].sort().join("\n")) }).toEqual({
        part,
        count: INTERIOR_TREES + FOREST_TREES,
        interior: INTERIOR_TREES,
        digest: TREE_POSITIONS_DIGEST,
        forestDigest: FOREST_POSITIONS_DIGEST
      });
    }
  });

  it("[그대로] N9 나무는 누르기 대상이 아니다(그대로여야 할 동작): 누르기 판정 목록에 나무 메시가 없고, 목록의 물체 아래에도 위에도 없다", async () => {
    const drawn = await draw("summer");
    const trees = anyTrees(drawn).map((t) => t.mesh);
    expect(trees.length).toBeGreaterThan(0);
    expect(drawn.pick.current.length).toBeGreaterThan(0);
    const tangled: string[] = [];
    for (const target of drawn.pick.current) {
      for (const mesh of trees) {
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
});
