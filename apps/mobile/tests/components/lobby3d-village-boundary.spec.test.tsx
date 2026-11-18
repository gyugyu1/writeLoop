// [spec] qa 테스트(작업 115 ① 경계와 마을 모델, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature·VillageModel)에서 본 마을 나무·둘레 숲·풍차 묶음.
// 배치 파일·막힌 칸·카메라 범위·마을 모델 파일은 lobby3d-village-boundary.spec.test.ts가 본다.
// 기대값은 명세(private 작업 폴더 115-2026-11-18-마을-동그란-숲-경계/02-경계와-마을-모델/01-main-spec.md)에서만 가져온다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, 모델을 react-three-fiber
// useLoader로 읽는 것, useFrame으로 프레임마다 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): G1~G3. 그대로 둘 동작(지금도 통과): G4.
// 어떻게 보나(113 qa 테스트 lobby3d-village-new-trees.spec.test.tsx와 같은 가짜 환경):
// - react-three-fiber만 가짜로 둔다. 가짜 불러오기는 tests/__fixtures__/village-trees-113.ts의 treeUseLoader(나무 파일은 앱 자산 폴더의 새 나무 모델,
//   그 밖은 101의 가짜: 마을 모델은 진짜 lobby-village.glb를 푼 장면)다. Jest가 읽지 못하는 자산은 파일 이름 글자로 바꾼 뒤 마을 그리기 모듈을 require한다.
// - "그루" = 새 나무 모델의 메시 도형으로 찍은 인스턴스 메시의 잎(foliage) 인스턴스 세계 변환. 단계(LOD)는 그 도형의 파일에서 읽는다.
//   마을 안 그루는 LOD1, 둘레 숲 그루는 LOD2다(113 명세 1, 그대로).
// 가정(02-qa-tests.md "가정"):
// - G1: "둘레 숲에서 풍차 둘레를 비우던 규칙도 없앤다"(명세 3)를, 지금 비우던 곳(옛 풍차 (62.5, −3.5)에서 가로·깊이 6.5칸 안)에 둘레 숲 그루가 생기는 것으로 본다.
//   그곳은 둘레 숲 격자(2.7칸 간격, 사각형 바깥 여백 9칸) 안이라 규칙이 없어지면 그루가 선다.
// - G4: "앱은 풍차 날개가 없어도 돈다"(명세 3)를, 풍차·풍차 날개(와 생울타리·울타리) 묶음을 뗀 마을 모델 장면으로 그리고 동작 줄이기를 끈 채 프레임을
//   돌려도 오류 없이 건물·소품이 그려지고 누르기 대상이 생기는 것으로 본다.
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_START } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { allObjects, drawnVisible, loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb } from "../__fixtures__/village-scene-101";
import { allTreeFilesPresent, resetTreeLoader, treePartOf } from "../__fixtures__/village-trees-113";
import { OLD_MILL_CLEAR_115, OLD_WINDMILL_115, REMOVED_GROUPS_115, TREES_KEPT_115, baseLayout115, inOldMillClear115, keptTree115 } from "../__fixtures__/village-boundary-115";

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

const mounted: (() => void)[] = [];

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  resetTreeLoader();
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
});

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

type Drawn = { roots: THREE.Object3D[]; pick: MutableRefObject<THREE.Object3D[]> };

async function frames(count: number) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f({}, 0.1);
  });
}

/** 마을을 그린다(마을 화면처럼 VillageNature와 VillageModel을 함께). 여름 한낮, 카메라 없음. */
async function draw(reduceMotion = true): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion };
  const d = daylightAt(new Date(2026, 5, 21, 12, 30));
  const light = { ambience: d.ambience, ceiling: 0, target: d };
  const view = await render(
    <>
      <village.VillageNature daylight={light as unknown as DaylightState} />
      <village.VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
    </>
  );
  mounted.push(() => view.unmount());
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  expect(roots.length).toBeGreaterThan(0);
  await frames(2);
  return { roots, pick };
}

/** 그린 장면의 나무 잎 그루: 단계와 자리(인스턴스가 보이는지와 상관없이 0번~count-1번). */
function foliageSpots(roots: THREE.Object3D[]): { lod: number; x: number; z: number }[] {
  expect({ treeFilesInApp: allTreeFilesPresent() }).toEqual({ treeFilesInApp: true });
  const out: { lod: number; x: number; z: number }[] = [];
  const m = new THREE.Matrix4();
  for (const o of allObjects(roots)) {
    if (!(o instanceof THREE.InstancedMesh)) continue;
    const info = treePartOf(o.geometry);
    if (!info || info.part !== "foliage") continue;
    o.updateWorldMatrix(true, false);
    for (let i = 0; i < o.count; i += 1) {
      o.getMatrixAt(i, m);
      const w = new THREE.Matrix4().multiplyMatrices(o.matrixWorld, m);
      out.push({ lod: info.lod, x: w.elements[12], z: w.elements[14] });
    }
  }
  expect(out.length).toBeGreaterThan(0);
  return out;
}

const isRemovedGroupName = (name: string) => REMOVED_GROUPS_115.some((g) => name === g || name.startsWith(`${g}-`));

describe("[spec] 115 ① 바뀔 동작: 마을 나무·둘레 숲·풍차 묶음(그리기)", () => {
  it(`G1 둘레 숲(명세 3 "풍차 둘레를 비우던 규칙도 없앤다"): 옛 풍차 (${OLD_WINDMILL_115.x}, ${OLD_WINDMILL_115.z}) 둘레(가로·깊이 ${OLD_MILL_CLEAR_115}칸 안)에 둘레 숲 그루(LOD2)가 선다`, async () => {
    const drawn = await draw();
    const near = foliageSpots(drawn.roots).filter((s) => s.lod === 2 && inOldMillClear115(s.x, s.z));
    expect({ forestNearOldMill: near.length > 0 }).toEqual({ forestNearOldMill: true });
  });

  it("G2 마을 나무(명세 3): 마을 안 그루(LOD1)는 원 가운데까지 24.5 안에 남는 28그루이고, 자리가 기준 커밋 배치의 그 28자리와 같다", async () => {
    const drawn = await draw();
    const key = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;
    const interior = foliageSpots(drawn.roots)
      .filter((s) => s.lod === 1)
      .map((s) => key(s.x, s.z))
      .sort();
    const kept = baseLayout115()
      .trees.filter(keptTree115)
      .map(([x, z]) => key(x, z))
      .sort();
    expect(kept).toHaveLength(TREES_KEPT_115);
    expect(interior).toEqual(kept);
  });

  it("G3 마을 모델(명세 4): 그린 장면에 생울타리(hedges)·울타리(fences)·풍차(windmill)·풍차 날개(windmill-rotor) 묶음이 없고, 건물·소품은 그려진다", async () => {
    const drawn = await draw();
    const objects = allObjects(drawn.roots);
    expect(objects.filter((o) => isRemovedGroupName(o.name)).map((o) => o.name)).toEqual([]);
    const shownUnder = (prefix: string) =>
      objects.filter((o) => {
        if (!(o instanceof THREE.Mesh) || !drawnVisible(o, drawn.roots)) return false;
        for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n.name.startsWith(prefix)) return true;
        return false;
      }).length;
    expect({ buildings: shownUnder("bld-") > 0, props: shownUnder("props") > 0 }).toEqual({ buildings: true, props: true });
  });
});

describe("[spec] 115 ① 그대로 둘 동작(지금도 통과): 풍차 날개가 없어도 마을이 돈다", () => {
  it("G4 명세 3 '앱은 풍차 날개가 없어도 돈다': 풍차·풍차 날개·생울타리·울타리 묶음을 뗀 마을 모델로, 동작 줄이기를 끈 채 여러 프레임 돌려도 오류 없이 건물·소품이 그려지고 누르기 대상이 있다", async () => {
    const scene = sceneFromGlb(nowVillageGlb());
    for (const name of REMOVED_GROUPS_115) scene.getObjectByName(name)?.removeFromParent();
    expect(REMOVED_GROUPS_115.map((name) => scene.getObjectByName(name))).toEqual(REMOVED_GROUPS_115.map(() => undefined));
    loaderState.village = { scene };
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    const drawn = await draw(false);
    await frames(5);
    const objects = allObjects(drawn.roots);
    const shownBuildings = objects.filter((o) => o instanceof THREE.Mesh && drawnVisible(o, drawn.roots) && /^bld-/.test(o.parent?.name ?? "")).length;
    expect({ errors: errors.mock.calls.length, buildings: shownBuildings > 0, pick: drawn.pick.current.length > 0 }).toEqual({ errors: 0, buildings: true, pick: true });
  });
});
