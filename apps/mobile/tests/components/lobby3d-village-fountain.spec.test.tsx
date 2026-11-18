// [spec] qa 테스트(작업 118 마을 분수대 교체, 기능 변경, 모바일): 바깥 마을(lobby3d-village)이 새 분수 모델(village-fountain.glb)을 따로 읽어 광장에 하나 그리고, 물이 흐르는 것.
// 기대값은 명세(private 작업 폴더 118-2026-11-19-마을-분수대-교체/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 0f80ab1의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, VillageModelErrorBoundary,
// 모델을 react-three-fiber useLoader(GLTFLoader)로 읽는 것, useFrame으로 프레임마다 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// 어떻게 보나(작업 113 qa 테스트 lobby3d-village-new-trees.spec.test.tsx와 같은 가짜 환경):
// - react-three-fiber만 가짜로 둔다. 가짜 불러오기는 분수 모델 파일(이름 village-fountain.glb)에는 앱 자산 폴더의 그 파일을 GLTFLoader가 푼 모양으로 만든 모델
//   (tests/__fixtures__/village-fountain-model-118.ts: 석재·물 메시, 모프 타깃, Fountain_Flow 클립)을, 마을 모델에는 진짜 lobby-village.glb를 푼 장면을,
//   그 밖에는 101의 가짜를 준다. Jest가 읽지 못하는 자산(.glb 등)은 파일 이름 글자로 바꾼 뒤(mockUnreadableAssets) 마을 그리기 모듈을 require한다.
// - VillageNature와 VillageModel을 마을 화면(lobby3d-canvas의 VillageLayer)처럼 함께 그린다(모델 오류 경계 > Suspense > 모델). 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
//   분수를 둘 중 어느 쪽이 그리는지는 가리지 않는다(가정: VillageLayer가 그리는 것은 이 둘뿐이다. 02-qa-tests.md "가정").
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 프레임마다 delta를 주어 모두 부른다. 프레임 상태는 {}(카메라 없음)이다.
// - "분수 메시" = 그린 장면의 메시 가운데 도형의 삼각형 수가 석재 1534개(또는 물 1186개)인 것. 물의 가중치 = 물 메시의 morphTargetInfluences.
// - "믹서가 한 프레임에 한 번" = THREE.AnimationMixer.prototype.update가 그 프레임에 한 번 불리고 인자가 그 프레임의 delta다.
// - 물 흐름의 기대값은 모델 파일의 Fountain_Flow 키에서 센다(명세 4: 첫 키를 0초로 당긴 길이 2초 되풀이, 키 사이는 LINEAR).
//   참고: 명세 "새 모델"의 "1/24초 간격"은 파일의 실제 키 간격(1/12초: 첫 키 0.0417초, 끝 키 2.0417초, 25개)과 달라, 파일의 값을 따랐다(02-qa-tests.md "판단이 필요한 것").
import { act, render } from "@testing-library/react-native";
import { Suspense, type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_START } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { allObjects, loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb } from "../__fixtures__/village-scene-101";
import {
  FOUNTAIN_ASSET_NAME,
  FOUNTAIN_HALF_WIDTH,
  FOUNTAIN_LAYOUT,
  FOUNTAIN_SCALE,
  MODEL_SIZE,
  STONE_TRIANGLES,
  WATER_TRIANGLES,
  expectedWeightsAt,
  flowKeys,
  fountainAssetExists,
  isFountainUrl
} from "../__fixtures__/village-fountain-118";
import { buildFountainGltf, type FountainGltf } from "../__fixtures__/village-fountain-model-118";
import { resetTreeLoader } from "../__fixtures__/village-trees-113";

type FramePart = (state: unknown, delta: number) => void;

const mockFrames: FramePart[] = [];
const mockScene: { background: unknown } = { background: null };
/** 가짜 불러오기가 받은 요청(입력 그대로). */
const mockCalls: { loader: unknown; input: unknown }[] = [];
/** 가짜 불러오기가 분수 모델 파일에 주는 모델(react-three-fiber useLoader의 캐시처럼 같은 객체). */
const fountainSource: { gltf: FountainGltf | null } = { gltf: null };

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
jest.mock("three/examples/jsm/utils/SkeletonUtils.js", () => ({
  clone: (object: { clone: (recursive: boolean) => unknown }) => object.clone(true)
}));
jest.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class MockGLTFLoader {}
}));
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const fake = (loader: unknown, input: unknown) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const fountain = require("../__fixtures__/village-fountain-118") as typeof import("../__fixtures__/village-fountain-118");
    const scene101 = require("../__fixtures__/village-scene-101") as typeof import("../__fixtures__/village-scene-101");
    const trees = require("../__fixtures__/village-trees-113") as typeof import("../__fixtures__/village-trees-113");
    /* eslint-enable @typescript-eslint/no-require-imports */
    mockCalls.push({ loader, input });
    if (fountain.isFountainUrl(input)) return fountainSource.gltf;
    // 나무 파일에는 나무 모델(113 도우미), 그 밖에는 101의 가짜
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
  mockCalls.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  resetTreeLoader();
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
  fountainSource.gltf = fountainAssetExists() ? buildFountainGltf() : null;
});

// 단언이 실패해도 그린 화면을 치운다(실패가 뒤 테스트로 번지지 않게)
const mounted: (() => void)[] = [];

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

type Drawn = { roots: THREE.Object3D[]; pick: MutableRefObject<THREE.Object3D[]>; unmount: () => Promise<void> };

async function frames(count: number, delta: number) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f({}, delta);
  });
}

/** 마을을 그린다(VillageLayer 모양). 프레임은 돌리지 않는다. */
async function draw(): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
  const d = daylightAt(new Date(2026, 5, 21, 12, 30));
  const light = { ambience: d.ambience, ceiling: 0, target: d };
  const view = await render(
    <>
      <village.VillageNature daylight={light as unknown as DaylightState} />
      <village.VillageModelErrorBoundary>
        <Suspense fallback={null}>
          <village.VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
        </Suspense>
      </village.VillageModelErrorBoundary>
    </>
  );
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  expect(roots.length).toBeGreaterThan(0);
  const done = track(() => view.unmount());
  return {
    roots,
    pick,
    unmount: async () => {
      await act(async () => {
        done();
      });
    }
  };
}

const triangles = (m: THREE.Mesh) => (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position").count) / 3;

function shownChain(o: THREE.Object3D, roots: THREE.Object3D[]): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if (roots.includes(n)) return true;
  }
  return false;
}

/** 그린 장면에서 보이는, 도형의 삼각형 수가 맞는 일반 메시(인스턴스 메시는 뺀다). */
function meshesWith(roots: THREE.Object3D[], count: number): THREE.Mesh[] {
  return allObjects(roots).filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && triangles(o) === count && shownChain(o, roots));
}

function fountainMeshes(roots: THREE.Object3D[]): { stone: THREE.Mesh[]; water: THREE.Mesh[] } {
  return { stone: meshesWith(roots, STONE_TRIANGLES), water: meshesWith(roots, WATER_TRIANGLES) };
}

/** 분수가 있어야 아래를 볼 수 있다(구현 전에는 여기서 실패한다). */
function needFountain(drawn: Drawn): { stone: THREE.Mesh; water: THREE.Mesh } {
  const { stone, water } = fountainMeshes(drawn.roots);
  expect({ stone: stone.length, water: water.length }).toEqual({ stone: 1, water: 1 });
  return { stone: stone[0], water: water[0] };
}

const weightsOf = (water: THREE.Mesh) => [...(water.morphTargetInfluences ?? [])];

function expectWeights(actual: number[], expected: number[], label: string) {
  expect({ label, length: actual.length }).toEqual({ label, length: 3 });
  actual.forEach((v, i) => expect({ label, i, v: Math.round(v * 1e4) / 1e4 }).toEqual({ label, i, v: Math.round(expected[i] * 1e4) / 1e4 }));
}

/** 월드 점들의 상자. */
function worldBox(mesh: THREE.Mesh, roots: THREE.Object3D[]) {
  for (const r of roots) r.updateMatrixWorld(true);
  const position = mesh.geometry.getAttribute("position");
  const v = new THREE.Vector3();
  const box = new THREE.Box3();
  for (let i = 0; i < position.count; i += 1) box.expandByPoint(v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  return box;
}

describe("[spec] 118 마을의 새 분수(명세 2·3)", () => {
  it("[바뀔] V1 분수 모델 파일(village-fountain.glb)을 마을 모델과 따로, GLTFLoader로 한 파일씩 읽는다(목록으로 묶어 읽지 않는다)", async () => {
    await draw();
    const { GLTFLoader } = jest.requireMock<{ GLTFLoader: unknown }>("three/examples/jsm/loaders/GLTFLoader.js");
    const fountain = mockCalls.filter((c) => isFountainUrl(Array.isArray(c.input) ? undefined : c.input) || (Array.isArray(c.input) && c.input.some(isFountainUrl)));
    expect(fountain.length).toBeGreaterThan(0);
    expect(fountain.every((c) => c.loader === GLTFLoader && c.input === FOUNTAIN_ASSET_NAME)).toBe(true);
    const village = mockCalls.filter((c) => c.input === "lobby-village.glb" || (Array.isArray(c.input) && c.input.includes("lobby-village.glb")));
    expect(village.length).toBeGreaterThan(0);
    expect(village.every((c) => c.input === "lobby-village.glb")).toBe(true);
  });

  it("[바뀔] V2 마을에는 분수가 하나만 그려진다: 석재 메시 하나(1534 삼각형), 물 메시 하나(1186 삼각형)이고, 옛 분수 메시는 없다", async () => {
    const drawn = await draw();
    needFountain(drawn);
    // 옛 분수는 마을 모델 소품 묶음이었다: 그린 장면의 소품에서 옛 분수 자리의 삼각형이 없어야 하므로 분수 자리에 드는 큰 메시는 이 둘뿐이다
    const near = allObjects(drawn.roots).filter((o): o is THREE.Mesh => {
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || !shownChain(o, drawn.roots)) return false;
      const box = worldBox(o, drawn.roots);
      return box.min.y >= -0.05 && box.max.y > 0.5 && box.max.y < 1.5 && box.min.x >= FOUNTAIN_LAYOUT.x - 1.7 && box.max.x <= FOUNTAIN_LAYOUT.x + 1.7 && box.min.z >= FOUNTAIN_LAYOUT.z - 1.7 && box.max.z <= FOUNTAIN_LAYOUT.z + 1.7;
    });
    expect(near.map((m) => triangles(m)).sort((a, b) => a - b)).toEqual([WATER_TRIANGLES, STONE_TRIANGLES]);
  });

  it("[바뀔] V3 자리와 크기: 석재 받침 밑면이 땅(y 0)에 닿고, 가운데가 배치 파일의 fountain x·z이며, 균일 배율이 반지름 ÷ 모델의 바깥 반폭(1.6 ÷ 1.232 ≈ 1.30)이다", async () => {
    const drawn = await draw();
    const { stone } = needFountain(drawn);
    const box = worldBox(stone, drawn.roots);
    const s = FOUNTAIN_SCALE;
    expect(s).toBeCloseTo(1.2987, 3);
    const got = {
      minY: Math.round(box.min.y * 1e3) / 1e3,
      centerX: Math.round(((box.min.x + box.max.x) / 2) * 1e3) / 1e3,
      centerZ: Math.round(((box.min.z + box.max.z) / 2) * 1e3) / 1e3,
      sizeX: Math.round((box.max.x - box.min.x) * 1e3) / 1e3,
      sizeY: Math.round((box.max.y - box.min.y) * 1e3) / 1e3,
      sizeZ: Math.round((box.max.z - box.min.z) * 1e3) / 1e3
    };
    // 모델 크기(명세 "새 모델": x ±1.223, y 0~0.987, z ±1.232)에 균일 배율을 곱한 값. 모델 크기는 소수 셋째 자리까지 적힌 값이라 0.01칸 안에서 맞으면 된다
    const want = {
      minY: 0,
      centerX: FOUNTAIN_LAYOUT.x,
      centerZ: FOUNTAIN_LAYOUT.z,
      sizeX: (MODEL_SIZE.maxX - MODEL_SIZE.minX) * s,
      sizeY: (MODEL_SIZE.maxY - MODEL_SIZE.minY) * s,
      sizeZ: (MODEL_SIZE.maxZ - MODEL_SIZE.minZ) * s
    };
    for (const key of Object.keys(want) as (keyof typeof want)[]) expect({ key, near: Math.abs(got[key] - want[key]) <= 0.01 }).toEqual({ key, near: true });
    // 바깥 반폭은 충돌 반지름과 같다(2 × 1.6 = 3.2 안팎)
    expect(Math.abs(got.sizeZ / 2 - FOUNTAIN_LAYOUT.radius)).toBeLessThanOrEqual(0.01);
    expect(FOUNTAIN_HALF_WIDTH * s).toBeCloseTo(FOUNTAIN_LAYOUT.radius, 6);
  });

  it("[바뀔] V4 재질과 모프 타깃은 모델 원본 그대로다: 석재·물 재질의 종류·이름·거칠기·금속성·반사 세기·색 그림·정점색이 같고, 물 도형은 모프 타깃 셋과 영향값 셋을 가진다", async () => {
    const drawn = await draw();
    const { stone, water } = needFountain(drawn);
    const source = fountainSource.gltf!;
    const sourceStone = source.scene.children.find((c) => (c as THREE.Mesh).isMesh && triangles(c as THREE.Mesh) === STONE_TRIANGLES) as THREE.Mesh;
    const sourceWater = source.scene.children.find((c) => (c as THREE.Mesh).isMesh && triangles(c as THREE.Mesh) === WATER_TRIANGLES) as THREE.Mesh;
    const look = (m: THREE.Material) => {
      const p = m as THREE.MeshPhysicalMaterial;
      return { type: p.type, name: p.name, color: p.color.getHex(), roughness: p.roughness, metalness: p.metalness, specularIntensity: p.specularIntensity, vertexColors: p.vertexColors, hasMap: !!p.map, map: p.map, transparent: p.transparent, opacity: p.opacity };
    };
    expect(Array.isArray(stone.material)).toBe(false);
    expect(Array.isArray(water.material)).toBe(false);
    expect(look(stone.material as THREE.Material)).toEqual(look(sourceStone.material as THREE.Material));
    expect(look(water.material as THREE.Material)).toEqual(look(sourceWater.material as THREE.Material));
    expect(water.geometry.morphAttributes.position?.length).toBe(3);
    expect(water.geometry.morphTargetsRelative).toBe(true);
    expect(water.morphTargetInfluences?.length).toBe(3);
    expect(weightsOf(water)).toEqual([0, 0, 0]);
    expect(water.morphTargetDictionary).toEqual(sourceWater.morphTargetDictionary);
  });

  it("[바뀔] V5 따로 만든 물줄기·물방울·파티클을 넣지 않는다: 그린 장면에 Points·Sprite가 없다", async () => {
    const drawn = await draw();
    needFountain(drawn);
    const particles = allObjects(drawn.roots).filter((o) => o instanceof THREE.Points || o instanceof THREE.Sprite || (o as { isPoints?: boolean }).isPoints);
    expect(particles.map((o) => o.name || o.type)).toEqual([]);
  });

  it("[바뀔] V6 분수 메시는 누르기 대상이다: 누르기 판정 대상 목록에 석재 메시가 있고, 분수 가장자리 위에서 아래로 쏜 광선이 그 목록의 분수 메시에 맞는다", async () => {
    const drawn = await draw();
    const { stone, water } = needFountain(drawn);
    // 프레임 한 번 뒤 목록이 채워질 수도 있다(건물처럼 효과로 채우는 구현)
    await frames(1, 1 / 60);
    for (const r of drawn.roots) r.updateMatrixWorld(true);
    expect({ stoneInPickTargets: drawn.pick.current.includes(stone), count: drawn.pick.current.length }).toMatchObject({ stoneInPickTargets: true });
    // 분수 자리 위에서 아래로 격자로 쏜 광선 가운데 석재에 맞는 것이 있고, 맞은 것은 모두 누르기 판정 대상 목록의 물체다(분수 메시가 누르기 대상이다)
    const hitObjects = new Set<THREE.Object3D>();
    for (let i = -8; i <= 8; i += 1) {
      for (let j = -8; j <= 8; j += 1) {
        const ray = new THREE.Raycaster(new THREE.Vector3(FOUNTAIN_LAYOUT.x + i * 0.19, 5, FOUNTAIN_LAYOUT.z + j * 0.19), new THREE.Vector3(0, -1, 0));
        for (const hit of ray.intersectObjects(drawn.pick.current, true)) hitObjects.add(hit.object);
      }
    }
    expect({ stoneHit: hitObjects.has(stone), onlyFountain: [...hitObjects].every((o) => o === stone || o === water) }).toEqual({ stoneHit: true, onlyFountain: true });
  });
});

describe("[spec] 118 물 흐름(명세 4)", () => {
  it("[바뀔] W1 Fountain_Flow를 끝없이 되풀이한다: 프레임 delta만큼 진행해, 시작 0초 · 0.02초 · 1초 · 2초(= 끝 키 = 첫 키) · 2.5초 · 4.5초에 물 가중치가 모델 키의 선형 보간 값과 같다(첫 키를 0초로 당기고 길이 2초)", async () => {
    const drawn = await draw();
    const { water } = needFountain(drawn);
    const keys = flowKeys();
    // 명세 4: 클립은 첫 키(0.0417초)를 0초로 당겨 쓴다. 그래서 0.02초 뒤 값은 첫 두 키 사이다(당기지 않으면 첫 키 값 (0, 0, 0)에 머문다)
    expect(expectedWeightsAt(keys, 0.02).some((v) => Math.abs(v) > 1e-3)).toBe(true);
    expectWeights(weightsOf(water), expectedWeightsAt(keys, 0), "0초");
    const step = 1 / 60;
    let elapsed = 0;
    const checkpoints = new Map<number, string>([
      [1, "0.0167초"],
      [60, "1초"],
      [120, "2초"],
      [150, "2.5초"],
      [270, "4.5초"]
    ]);
    for (let n = 1; n <= 270; n += 1) {
      await frames(1, step);
      elapsed += step;
      // 매 프레임 기대값과 같다: 되풀이 경계(2초)에서도 값이 튀지 않는다
      expectWeights(weightsOf(water), expectedWeightsAt(keys, elapsed), `${n}프레임 ${checkpoints.get(n) ?? ""}`);
    }
  });

  it("[바뀔] W2 되풀이 경계에서 튀지 않는다: 2초 앞뒤 프레임 사이 가중치 변화가 보통 프레임 사이 변화보다 크지 않다(한 프레임 멈추거나 건너뛰지 않는다)", async () => {
    const drawn = await draw();
    const { water } = needFountain(drawn);
    const step = 1 / 60;
    const series: number[][] = [weightsOf(water)];
    for (let n = 0; n < 300; n += 1) {
      await frames(1, step);
      series.push(weightsOf(water));
    }
    const jump = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const jumps = series.slice(1).map((w, i) => jump(series[i], w));
    // 클립 키 사이 가장 가파른 변화: 키 간격 1/12초에 가중치가 최대 1 바뀐다 → 1/60초에 0.2 안팎. 경계(120번 앞뒤)가 그보다 크지 않아야 한다
    const around = jumps.slice(112, 128);
    expect(Math.max(...around)).toBeLessThanOrEqual(0.25);
    // 경계 앞뒤에 멈춘 프레임(변화 0)이 연이어 없다: 물은 늘 흐른다(키가 0인 시작 구간 한 프레임 빼고)
    const stalled = around.filter((v) => v < 1e-9).length;
    expect(stalled).toBeLessThanOrEqual(1);
  });

  it("[바뀔] W3 분수마다 믹서 하나가 한 프레임에 한 번, 그 프레임의 delta만큼만 진행한다", async () => {
    const update = jest.spyOn(THREE.AnimationMixer.prototype, "update");
    const drawn = await draw();
    needFountain(drawn);
    update.mockClear();
    await frames(1, 0.05);
    expect(update.mock.calls.map((c) => Math.round((c[0] as number) * 1e6) / 1e6)).toEqual([0.05]);
    update.mockClear();
    await frames(3, 0.02);
    expect(update.mock.calls.map((c) => Math.round((c[0] as number) * 1e6) / 1e6)).toEqual([0.02, 0.02, 0.02]);
  });
});

describe("[spec] 118 마을을 나갔다 들어오기(명세 5)", () => {
  it("[바뀔] E1 마을 그리기가 빠지면 믹서를 멈추고 정리하며(stopAllAction·uncache 계열이 불린다), 프레임 함수가 하나도 남지 않는다", async () => {
    const update = jest.spyOn(THREE.AnimationMixer.prototype, "update");
    const stops = [
      jest.spyOn(THREE.AnimationMixer.prototype, "stopAllAction"),
      jest.spyOn(THREE.AnimationMixer.prototype, "uncacheRoot"),
      jest.spyOn(THREE.AnimationMixer.prototype, "uncacheClip"),
      jest.spyOn(THREE.AnimationMixer.prototype, "uncacheAction")
    ];
    const drawn = await draw();
    needFountain(drawn);
    await frames(2, 0.05);
    const leftover = [...mockFrames];
    expect(update).toHaveBeenCalled();
    // 믹서가 클립을 묶는 안쪽 일로 불리는 수와 구분하려고, 빠지기 전 수를 적어 두고 빠진 뒤 수가 느는지 본다
    const stopCalls = () => stops.reduce((n, spy) => n + spy.mock.calls.length, 0);
    const before = stopCalls();
    await drawn.unmount();
    expect(stopCalls()).toBeGreaterThan(before);
    // 빠진 뒤에는 프레임 함수가 하나도 남지 않는다(믹서를 진행하는 프레임 함수도 없다)
    expect({ leftover: leftover.length > 0, framesAfter: mockFrames.length }).toEqual({ leftover: true, framesAfter: 0 });
  });

  it("[바뀔] E2 나갔다 다시 들어오면 분수와 믹서가 하나씩 새로 생긴다: 분수 메시는 하나씩이고, 새 물은 0초부터 흐르며 한 프레임에 믹서가 한 번만 진행한다(옛 믹서가 남아 같이 돌지 않는다)", async () => {
    const update = jest.spyOn(THREE.AnimationMixer.prototype, "update");
    const keys = flowKeys();
    for (let round = 1; round <= 3; round += 1) {
      const drawn = await draw();
      const { water } = needFountain(drawn);
      expectWeights(weightsOf(water), expectedWeightsAt(keys, 0), `${round}번째 들어옴 처음`);
      update.mockClear();
      await frames(1, 0.1);
      expect({ round, updates: update.mock.calls.length }).toEqual({ round, updates: 1 });
      await frames(4, 0.1);
      expectWeights(weightsOf(water), expectedWeightsAt(keys, 0.5), `${round}번째 들어옴 0.5초`);
      await drawn.unmount();
      expect({ round, frameFunctionsLeft: mockFrames.length }).toEqual({ round, frameFunctionsLeft: 0 });
    }
  });
});
