// [spec] qa 테스트(작업 124 마을 누르기 판정 가속, 버그 수정(성능), 모바일): 건물·합친 소품 메시의 광선 판정이 삼각형을 하나씩 검사하지 않고
// 가속 구조(BVH, three-mesh-bvh)를 쓴다. 판정 결과(맞은 물체, 자리, 거리 순서)는 그대로다.
// 기대값은 명세(private 작업 폴더 124-2026-11-19-마을-누르기-판정-가속/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 eaeb75d의 지금 동작이다.
//
// 재현(구현 전 실패): P1·P2. 그대로 둘 동작(구현 전·뒤 통과): K1·K2·K3.
// 어떻게 보나: 가속 구조의 이름·모양에 기대지 않고, 광선 하나를 쏠 때 THREE.Ray.prototype.intersectTriangle(three 기본 판정이 삼각형마다 한 번 부른다)이
// 몇 번 불리는지로 "삼각형을 하나씩 검사하는가"를 본다. three-mesh-bvh의 판정은 자기 삼각형 검사를 쓰므로 이 호출이 거의 없다.
// 판정 결과는 이 파일을 불러올 때 붙잡아 둔 THREE.Mesh.prototype.raycast(three 기본 판정, 가속 구조를 쓰지 않는다)와 견준다.
// qa가 정한 값(명세에 수 없음): "삼각형을 하나씩 검사하지 않는다" = 광선 하나당 intersectTriangle 호출 64번 이하. 자리·거리 오차 1e-4.
import { render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_START } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { newImageFiles103 } from "../__fixtures__/village-ground-103";
import { sceneFromGlbFull } from "../__fixtures__/village-merge-112";
import { loaderState, mockUnreadableAssets } from "../__fixtures__/village-scene-101";
import { mockImagesAsPaths, splatLoader } from "../__fixtures__/village-splat-102";

// three 기본 광선 판정(이 파일을 불러올 때 붙잡는다. 마을 코드를 불러오기 전이다)
const plainRaycast = THREE.Mesh.prototype.raycast;

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
    const trees = require("../__fixtures__/village-trees-113") as typeof import("../__fixtures__/village-trees-113");
    /* eslint-enable @typescript-eslint/no-require-imports */
    return trees.treeUseLoader(loader, input, (l, i) => splat.splatUseLoader(l, i, scene101.fakeUseLoader));
  };
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => ({ camera: null, scene: { background: null }, size: { width: 400, height: 800 }, gl: { capabilities: { getMaxAnisotropy: () => 1 } } }),
    useFrame: () => {},
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

const TOL = 1e-4;
const MAX_TRIANGLE_CHECKS_PER_RAY = 64;

async function drawVillage() {
  loaderState.village = { scene: sceneFromGlbFull(nowVillageGlb()) };
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const d = daylightAt(new Date(2026, 5, 21, 12, 30));
  const light = { ambience: d.ambience, ceiling: 0, target: d };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
  const view = await render(
    <village.VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
  );
  const roots = view.container
    .queryAll((i: TestInstance) => i.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  roots.forEach((r) => r.updateMatrixWorld(true));
  return { pick, view, roots };
}

const triCount = (m: THREE.Mesh) => (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;

const isPlain = (o: THREE.Object3D): o is THREE.Mesh =>
  o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && !o.geometry.morphAttributes.position;

/** 건물·소품(모프·인스턴스가 아닌 보통 메시) 가운데 삼각형이 많은 것부터. */
function plainTargets(pick: THREE.Object3D[]): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const t of pick) t.traverse((o) => (isPlain(o) ? out.push(o) : undefined));
  return out.sort((a, b) => triCount(b) - triCount(a));
}

/** 메시의 삼각형 가운데 고르게 n개를 겨눈 광선(삼각형 바깥쪽 2칸에서 안쪽으로). */
function raysAtTriangles(mesh: THREE.Mesh, n: number): THREE.Ray[] {
  const pos = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.index;
  const total = triCount(mesh);
  const rays: THREE.Ray[] = [];
  const vertex = (t: number, k: number) => {
    const i = index ? index.getX(t * 3 + k) : t * 3 + k;
    return new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
  };
  for (let s = 0; s < n; s += 1) {
    const t = Math.floor((s * total) / n);
    const a = vertex(t, 0);
    const b = vertex(t, 1);
    const c = vertex(t, 2);
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (normal.lengthSq() < 1e-12) continue;
    normal.normalize();
    const center = a.clone().add(b).add(c).divideScalar(3);
    rays.push(new THREE.Ray(center.clone().addScaledVector(normal, 2), normal.clone().negate()));
  }
  return rays;
}

/** 지금 코드의 판정(plain=false) 또는 기준(plain=true: 보통 메시는 three 기본 판정, 나머지는 지금 그대로). */
function cast(ray: THREE.Ray, targets: THREE.Object3D[], plain: boolean): THREE.Intersection[] {
  const raycaster = new THREE.Raycaster();
  raycaster.ray.copy(ray);
  if (!plain) return raycaster.intersectObjects(targets, true);
  const hits: THREE.Intersection[] = [];
  for (const t of targets) {
    t.traverse((o) => {
      if (isPlain(o)) plainRaycast.call(o, raycaster, hits);
      else if (o instanceof THREE.Mesh) o.raycast(raycaster, hits);
    });
  }
  return hits.sort((a, b) => a.distance - b.distance);
}

function groundRays(): THREE.Ray[] {
  const rays: THREE.Ray[] = [];
  for (let x = -60; x <= 60; x += 3) for (let z = -60; z <= 60; z += 3) rays.push(new THREE.Ray(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0)));
  return rays;
}

function expectSameHits(got: THREE.Intersection[], want: THREE.Intersection[]) {
  expect(got.map((h) => h.object)).toEqual(want.map((h) => h.object));
  got.forEach((h, i) => {
    expect(Math.abs(h.distance - want[i].distance)).toBeLessThan(TOL);
    expect(h.point.distanceTo(want[i].point)).toBeLessThan(TOL);
  });
}

describe("마을 누르기 판정 가속 (124)", () => {
  it("P1 건물 위를 겨눈 광선은 삼각형을 하나씩 검사하지 않는다(재현)", async () => {
    const { pick } = await drawVillage();
    const building = plainTargets(pick.current)[0];
    expect(triCount(building)).toBeGreaterThan(1000);
    const spy = jest.spyOn(THREE.Ray.prototype, "intersectTriangle");
    const raycaster = new THREE.Raycaster();
    let worst = 0;
    let hitRays = 0;
    for (const ray of raysAtTriangles(building, 30)) {
      raycaster.ray.copy(ray);
      spy.mockClear();
      if (raycaster.intersectObjects(pick.current, true).length > 0) hitRays += 1;
      worst = Math.max(worst, spy.mock.calls.length);
    }
    spy.mockRestore();
    expect(hitRays).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(MAX_TRIANGLE_CHECKS_PER_RAY);
  });

  it("P2 마을 위에서 아래로 쏜 광선(합친 소품 메시의 경계 구를 지나 맞지 않는 광선 포함)도 삼각형을 하나씩 검사하지 않는다(재현)", async () => {
    const { pick } = await drawVillage();
    const spy = jest.spyOn(THREE.Ray.prototype, "intersectTriangle");
    const raycaster = new THREE.Raycaster();
    let worst = 0;
    for (const ray of groundRays()) {
      raycaster.ray.copy(ray);
      spy.mockClear();
      raycaster.intersectObjects(pick.current, true);
      worst = Math.max(worst, spy.mock.calls.length);
    }
    spy.mockRestore();
    expect(worst).toBeLessThanOrEqual(MAX_TRIANGLE_CHECKS_PER_RAY);
  });

  it("K1 건물·소품 삼각형을 겨눈 광선의 판정 결과(맞은 물체, 자리, 거리 순서)가 three 기본 판정과 같다(그대로)", async () => {
    const { pick } = await drawVillage();
    let checked = 0;
    for (const mesh of plainTargets(pick.current).slice(0, 4)) {
      for (const ray of raysAtTriangles(mesh, 25)) {
        const want = cast(ray, pick.current, true);
        expectSameHits(cast(ray, pick.current, false), want);
        checked += want.length;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("K2 마을 위에서 아래로 쏜 격자 광선의 판정 결과가 three 기본 판정과 같다(그대로)", async () => {
    const { pick } = await drawVillage();
    let hitsSeen = 0;
    for (const ray of groundRays()) {
      const want = cast(ray, pick.current, true);
      expectSameHits(cast(ray, pick.current, false), want);
      hitsSeen += want.length;
    }
    expect(hitsSeen).toBeGreaterThan(0);
  });

  it("K3 마을을 나가면 누르기 대상 목록을 비우고 만든 가속 구조를 버린다(그대로)", async () => {
    const { pick, view } = await drawVillage();
    const meshes = plainTargets(pick.current);
    expect(meshes.length).toBeGreaterThan(0);
    await view.unmount();
    expect(pick.current).toEqual([]);
    for (const m of meshes) expect((m.geometry as THREE.BufferGeometry & { boundsTree?: unknown }).boundsTree).toBeUndefined();
  });
});
