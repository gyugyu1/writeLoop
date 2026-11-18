// [spec] qa 테스트(작업 115 ② 숲과 땅 꾸밈, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature)에서 본 둘레 숲 그루의 자리.
// 흩뿌림·장식·풀밭 무늬·출처·설명은 lobby3d-village-forest.spec.test.ts가 본다.
// 기대값은 명세(private 작업 폴더 115-2026-11-18-마을-동그란-숲-경계/03-숲과-땅-꾸밈/01-main-spec.md "바뀌는 동작" 1)에서만 가져온다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, 나무 모델을 react-three-fiber useLoader로 읽는 것,
// useFrame으로 프레임마다 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): F2, F3, F4. F1은 명세 1의 "숲 그루는 원 안에 서지 않는다"인데, 지금 숲(옛 사각형 바깥)도 모두 원 밖이라 지금도 통과한다.
// 종류·단계·크기·방향·밝기 규칙과 늘 같은 결과는 113 qa 테스트(lobby3d-village-new-trees.spec.test.tsx N1~N5)가 그대로 본다.
// 어떻게 보나(115 ① qa 테스트 lobby3d-village-boundary.spec.test.tsx와 같은 가짜 환경):
// - react-three-fiber만 가짜로 둔다. 가짜 불러오기는 tests/__fixtures__/village-trees-113.ts의 treeUseLoader(나무 파일은 앱 자산 폴더의 새 나무 모델,
//   그 밖은 101의 가짜)다. Jest가 읽지 못하는 자산은 파일 이름 글자로 바꾼 뒤 마을 그리기 모듈을 require한다.
// - "숲 그루" = 새 나무 모델의 메시 도형으로 찍은 인스턴스 메시 가운데 LOD2 잎(foliage) 인스턴스의 세계 변환 옮김 x·z(밑동 자리).
//   둘레 숲은 LOD2, 마을 안 나무는 LOD1이다(113 명세 1, 115 ② 명세 1 "단계(LOD2) 그대로").
// 가정(02-qa-tests.md "가정", 값은 tests/__fixtures__/village-forest-115-2.ts 머리말):
// - F2 "안쪽 가장자리는 원을 따라가되 대략 반지름 + 0 ~ + 2칸": 원 가운데에서 본 각도 15도 부채꼴 24개마다 가장 가까운 숲 그루가 26 넘고 30 이하
//   (가장자리 28 + 한 간격 2). 들쭉날쭉함이 자연스러운지는 폰에서 본다.
// - F3 "약 2칸 간격": 카메라가 보여 줄 수 있는 땅 가운데 원 가운데에서 29칸 넘는 곳의 넓이 ÷ 그곳의 숲 그루 수의 제곱근이 1.6~2.4칸.
// - F4 "마을 카메라가 보여 줄 수 있는 곳까지 채워진다, 어디서 보아도 숲 너머가 빈 땅으로 보이지 않을 만큼": 카메라가 보여 줄 수 있는 땅 가운데 원 가운데에서
//   28.5칸 넘는 곳(0.5칸 격자)의 모든 점에서 가장 가까운 숲 그루까지 3칸 이하.
import { act, render } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt } from "@/lib/lobby3d/daylight";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { allObjects, loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb } from "../__fixtures__/village-scene-101";
import { allTreeFilesPresent, resetTreeLoader, treePartOf } from "../__fixtures__/village-trees-113";
import { CIRCLE_115_2, EDGE_MAX_115_2, SPACING_115_2, VIEW_CELL_115_2, centerDistance115b, nearestFinder, visibleGround115b } from "../__fixtures__/village-forest-115-2";

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

type Spot = { x: number; z: number };
let forestCache: Spot[] | null = null;

/** 마을 풀밭·나무(VillageNature)를 여름 한낮, 카메라 없이 그리고 숲 그루(LOD2 잎 인스턴스) 자리를 모은다. 한 번 그린 것을 테스트마다 쓴다. */
async function forestSpots(): Promise<Spot[]> {
  if (forestCache) return forestCache;
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  resetTreeLoader();
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
  const d = daylightAt(new Date(2026, 5, 21, 12, 30));
  const light = { ambience: d.ambience, ceiling: 0, target: d };
  const view = await render(<village.VillageNature daylight={light as unknown as DaylightState} />);
  await act(async () => {
    for (let i = 0; i < 2; i += 1) for (const f of [...mockFrames]) f({}, 0.1);
  });
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  expect({ treeFilesInApp: allTreeFilesPresent() }).toEqual({ treeFilesInApp: true });
  const out: Spot[] = [];
  const m = new THREE.Matrix4();
  for (const o of allObjects(roots)) {
    if (!(o instanceof THREE.InstancedMesh)) continue;
    const info = treePartOf(o.geometry);
    if (!info || info.part !== "foliage" || info.lod !== 2) continue;
    o.updateWorldMatrix(true, false);
    for (let i = 0; i < o.count; i += 1) {
      o.getMatrixAt(i, m);
      const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m);
      out.push({ x: w.elements[12], z: w.elements[14] });
    }
  }
  await act(async () => view.unmount());
  mockFrames.length = 0;
  expect(out.length).toBeGreaterThan(0);
  forestCache = out;
  return out;
}

const fmt = (p: Spot) => `${p.x.toFixed(2)},${p.z.toFixed(2)} (가운데에서 ${centerDistance115b(p.x, p.z).toFixed(2)})`;

/** 117 명세 2: 가장자리 띠는 3.3칸 격자(흔들기 ±0.5)라 부채꼴의 가장 가까운 그루는 가장자리(반지름 + 2) + 3.3 + 0.5 이하다(117 전: 반지름 + 2 + 2칸). */
const BAND_EDGE_MAX_117 = EDGE_MAX_115_2 + 3.8;

describe("[spec] 115 ② 둘레 숲(명세 1)", () => {
  it(`[그대로·명세 1] F1 숲 그루는 걸을 수 있는 땅(원 안)에 서지 않는다: 숲 그루마다 밑동이 원 가운데 (${CIRCLE_115_2.x}, ${CIRCLE_115_2.z})에서 ${CIRCLE_115_2.radius} 넘게 떨어져 있다`, async () => {
    const forest = await forestSpots();
    const inside = forest.filter((p) => centerDistance115b(p.x, p.z) <= CIRCLE_115_2.radius);
    expect({ count: inside.length, first: inside.slice(0, 10).map(fmt) }).toEqual({ count: 0, first: [] });
  });

  it(`[바뀔] F2 숲의 안쪽 가장자리는 원을 따라간다(반지름 + 0 ~ + 2칸, 그루 간격 약 ${SPACING_115_2}칸): 원 가운데에서 본 15도 부채꼴 24개마다 가장 가까운 숲 그루가 가운데에서 ${CIRCLE_115_2.radius} 넘고 ${BAND_EDGE_MAX_117} 이하다(117: 띠가 3.3칸 격자라 가장 가까운 그루가 가장자리보다 조금 더 바깥일 수 있다. 117 전: ${EDGE_MAX_115_2 + SPACING_115_2})`, async () => {
    const forest = await forestSpots();
    const sectors = 24;
    const rows = Array.from({ length: sectors }, (_, k) => {
      const mine = forest.filter((p) => {
        const a = (Math.atan2(p.z - CIRCLE_115_2.z, p.x - CIRCLE_115_2.x) * 180) / Math.PI;
        const deg = (a + 360) % 360;
        return deg >= k * (360 / sectors) && deg < (k + 1) * (360 / sectors);
      });
      const nearest = mine.length ? Math.min(...mine.map((p) => centerDistance115b(p.x, p.z))) : Infinity;
      return { sector: `${k * 15}~${(k + 1) * 15}도`, nearest: Number(nearest.toFixed(2)) };
    });
    const wrong = rows.filter((r) => !(r.nearest > CIRCLE_115_2.radius && r.nearest <= BAND_EDGE_MAX_117));
    expect(wrong).toEqual([]);
  });

  it(`[바뀔] F3 그루 사이는 약 ${SPACING_115_2}칸이다: 카메라가 보여 줄 수 있는 땅 가운데 원 가운데에서 29칸 넘는 곳의 넓이 ÷ 그곳에 선 숲 그루 수의 제곱근이 1.8~2.8칸이다(117: 가장자리 띠가 3.3칸 격자라 2칸보다 넓다. 117 전: 1.6~2.4칸)`, async () => {
    const forest = await forestSpots();
    const cells = visibleGround115b().filter((p) => centerDistance115b(p.x, p.z) > 29);
    const cellKeys = new Set(cells.map((p) => `${Math.floor(p.x / VIEW_CELL_115_2)},${Math.floor(p.z / VIEW_CELL_115_2)}`));
    const area = cells.length * VIEW_CELL_115_2 * VIEW_CELL_115_2;
    const trees = forest.filter((p) => centerDistance115b(p.x, p.z) > 29 && cellKeys.has(`${Math.floor(p.x / VIEW_CELL_115_2)},${Math.floor(p.z / VIEW_CELL_115_2)}`)).length;
    const spacing = trees > 0 ? Math.sqrt(area / trees) : Infinity;
    expect({ area: area > 500, trees, spacing: Number(spacing.toFixed(3)), about2: spacing >= 1.8 && spacing <= 2.8 }).toEqual({
      area: true,
      trees,
      spacing: Number(spacing.toFixed(3)),
      about2: true
    });
  });

  it("[바뀔] F4 숲은 마을 카메라가 보여 줄 수 있는 곳까지 채워진다: 카메라가 보여 줄 수 있는 땅 가운데 원 가운데에서 28.5칸 넘는 곳의 모든 점(0.5칸 격자)에서 가장 가까운 숲 그루까지 3칸 이하다", async () => {
    const forest = await forestSpots();
    const near = nearestFinder(forest);
    const points = visibleGround115b().filter((p) => centerDistance115b(p.x, p.z) > EDGE_MAX_115_2 + 0.5);
    expect(points.length).toBeGreaterThan(1000);
    const bare = points.filter((p) => near(p.x, p.z, 3) > 3);
    expect({ count: bare.length, first: bare.slice(0, 10).map(fmt) }).toEqual({ count: 0, first: [] });
  });
});
