// [spec] qa 테스트(작업 116 나무 A·Pine 세트, 04 결정 3, 기능 변경, 모바일): 가을 낙엽(가을 흩뿌림)은 A 그루 둘레에만 놓인다.
// 기대값은 04-main-decision.md 3에서만 가져온다: 가을 낙엽 조각은 A 그루(마을 안·둘레 숲 모두) 밑동에서 수관 반폭 × 배율 × 1.6 안에만 있고(명세가 "약"이라 qa가 10% 여유를 둔다),
// 밑동에 가까울수록 빽빽하다. Pine 둘레와 나무에서 먼 땅에는 없다. 길·건물 땅 위·경계 원 밖에는 두지 않고, 조각 크기(0.3~0.55칸)는 그대로다. 봄·여름은 그대로, 겨울은 없다.
// 어떻게 보나: lobby3d-village-new-trees.spec.test.tsx와 같은 가짜 환경에서 마을을 그리고, 그린 장면에서 조각 메시(도형에 scatterCell 속성이 있는 인스턴스 메시)의 그려진 조각 자리를
// A 잎 그루 자리·배율과 견준다. 구현 방법(lib 함수가 그루 자리를 받는지, 그리는 쪽이 거르는지)과 관계없이 그린 결과만 본다.
// - A 수관 반폭 0.92(수관 폭 1.84 ÷ 2, LOD1·LOD2 같음).
import { act, render } from "@testing-library/react-native";
import { Suspense, type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt, type Season } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_BOUNDARY, VILLAGE_BUILDINGS, VILLAGE_START } from "@/lib/lobby3d/village";
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

/** 116: 마을 안 그루 = 밑동이 마을 경계 원 안인 그루(둘레 숲 그루 밑동은 늘 원 밖이다. 115). */
const isInterior = (x: number, z: number) => Math.hypot(x - VILLAGE_BOUNDARY.x, z - VILLAGE_BOUNDARY.z) < VILLAGE_BOUNDARY.radius;

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


const A_HALF = 0.92;
const REACH = 1.6;
const SLACK = 1.1;

type Piece = { x: number; z: number; size: number };

/** 그려지는 조각 메시(도형에 scatterCell 속성이 있는 인스턴스 메시)의 조각들. 보이는 메시만. */
function drawnScatter(roots: THREE.Object3D[]): Piece[] {
  const out: Piece[] = [];
  for (const r of roots) r.updateMatrixWorld(true);
  for (const o of allObjects(roots)) {
    if (!(o instanceof THREE.InstancedMesh) || !o.geometry.getAttribute("scatterCell")) continue;
    let shown = true;
    for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) shown = false;
    if (!shown) continue;
    const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i += 1) {
      o.getMatrixAt(i, m);
      const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m);
      out.push({ x: w.elements[12], z: w.elements[14], size: Math.hypot(w.elements[0], w.elements[1], w.elements[2]) });
    }
  }
  return out;
}

async function drawSeason(season: Season) {
  const drawn = await draw(season);
  await setSeason(drawn, season, {}, 2);
  const trees = needTrees(drawn);
  const a = rowsOf(trees).filter((r) => r.part === "foliage" && r.kind === "A").map((r) => ({ x: r.x, z: r.z, reach: A_HALF * r.scale[1] * REACH, scale: r.scale[1] }));
  return { drawn, a, pieces: drawnScatter(drawn.roots) };
}

describe("[spec] 116 04 결정 3: 가을 낙엽은 A 그루 둘레에만", () => {
  it("[바뀔] D1 가을 낙엽 조각이 있고, 모든 조각이 어떤 A 그루(마을 안·둘레 숲)의 밑동에서 수관 반폭 × 배율 × 1.6(+10%) 안이다. Pine 둘레나 나무에서 먼 땅의 조각은 없다", async () => {
    const { a, pieces } = await drawSeason("autumn");
    expect(a.some((t) => isInterior(t.x, t.z))).toBe(true);
    expect(a.some((t) => !isInterior(t.x, t.z))).toBe(true);
    expect(pieces.length).toBeGreaterThan(0);
    const far = pieces.filter((p) => !a.some((t) => Math.hypot(p.x - t.x, p.z - t.z) <= t.reach * SLACK));
    expect({ pieces: pieces.length > 0, far: far.length, first: far.slice(0, 5).map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`) }).toEqual({ pieces: true, far: 0, first: [] });
  });

  it("[바뀔] D2 A 그루 둘레에 실제로 놓인다: 마을 안 A 그루의 절반 넘게가 둘레(범위 안)에 조각을 하나 이상 가진다", async () => {
    const { a, pieces } = await drawSeason("autumn");
    const inner = a.filter((t) => isInterior(t.x, t.z));
    const withPiece = inner.filter((t) => pieces.some((p) => Math.hypot(p.x - t.x, p.z - t.z) <= t.reach * SLACK));
    expect({ inner: inner.length, share: withPiece.length / inner.length > 0.5 }).toEqual({ inner: inner.length, share: true });
  });

  it("[바뀔] D3 밑동에 가까울수록 빽빽하다: 마을 안 A 그루 둘레에서 범위 절반 안쪽 원의 단위 넓이당 조각 수가 바깥 고리(절반~범위)보다 많다", async () => {
    const { a, pieces } = await drawSeason("autumn");
    let inner = 0;
    let outer = 0;
    let innerArea = 0;
    let outerArea = 0;
    for (const t of a.filter((x) => isInterior(x.x, x.z))) {
      const r = t.reach;
      innerArea += Math.PI * (r / 2) ** 2;
      outerArea += Math.PI * (r * r - (r / 2) ** 2);
      for (const p of pieces) {
        const d = Math.hypot(p.x - t.x, p.z - t.z);
        if (d <= r / 2) inner += 1;
        else if (d <= r) outer += 1;
      }
    }
    expect({ innerCount: inner > 0, denser: inner / innerArea > outer / outerArea }).toEqual({ innerCount: true, denser: true });
  });

  it("[그대로] D4 길·건물 땅 위와 경계 원 밖에는 두지 않고, 조각 크기는 0.3~0.55칸이다", async () => {
    const { pieces } = await drawSeason("autumn");
    expect(pieces.length).toBeGreaterThan(0);
    const bad = pieces.filter((p) => !isInterior(p.x, p.z) || inBuildingRect(p.x, p.z) || p.size < 0.3 - 1e-3 || p.size > 0.55 + 1e-3);
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it("[그대로] D5 겨울에는 조각이 없고, 봄·여름에는 그대로 있다(A 둘레로 줄이지 않는다): 봄·여름 조각이 A 그루에서 먼 곳에도 있다", async () => {
    const winter = await drawSeason("winter");
    expect(winter.pieces).toEqual([]);
    await act(async () => winter.drawn.unmount());
    for (const season of ["spring", "summer"] as const) {
      const { a, pieces, drawn } = await drawSeason(season);
      const far = pieces.filter((p) => !a.some((t) => Math.hypot(p.x - t.x, p.z - t.z) <= t.reach * SLACK));
      expect({ season, some: pieces.length > 0, farFromA: far.length > 0 }).toEqual({ season, some: true, farFromA: true });
      await act(async () => drawn.unmount());
    }
  });
});

function inBuildingRect(x: number, z: number): boolean {
  return VILLAGE_BUILDINGS.some((b) => x >= b.rect[0] && x <= b.rect[2] && z >= b.rect[1] && z <= b.rect[3]);
}
