// [spec] qa 테스트(작업 120 마을 가로등 교체, 기능 변경, 모바일): 바깥 마을(lobby3d-village)이 새 가로등 모델(village-streetlamp.glb)을 따로 읽어 광장에 네 그루(인스턴스 메시 하나)로 그리고, 낮밤 점등이 천장 조명(daylight.ceiling)을 따르는 것.
// 기대값은 명세(private 작업 폴더 120-2026-11-19-마을-가로등-교체/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 703bef8의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, VillageModelErrorBoundary,
// 모델을 react-three-fiber useLoader(GLTFLoader)로 읽는 것, useFrame으로 프레임마다 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// 어떻게 보나(118의 lobby3d-village-fountain.spec.test.tsx와 같은 가짜 환경):
// - react-three-fiber만 가짜로 둔다. 가짜 불러오기는 가로등 모델 파일(이름 village-streetlamp.glb)에는 앱 자산 폴더의 그 파일을 GLTFLoader가 푼 모양으로 만든 모델
//   (tests/__fixtures__/village-streetlamp-model-120.ts: 메시 하나, 재질 하나)을, 분수 파일에는 분수 모델을, 마을 모델에는 진짜 lobby-village.glb를 푼 장면을, 그 밖에는 101의 가짜를 준다.
// - VillageNature와 VillageModel을 마을 화면(lobby3d-canvas의 VillageLayer)처럼 함께 그린다(모델 오류 경계 > Suspense > 모델). 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
//   가로등을 둘 중 어느 쪽이 그리는지는 가리지 않는다(가정: VillageLayer가 그리는 것은 이 둘뿐이다).
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 프레임마다 delta를 주어 모두 부른다. 프레임 상태는 {}(카메라 없음)이다.
// - "가로등 메시" = 그린 장면의 메시 가운데 도형의 삼각형 수가 930개이고 재질 이름에 lamp가 든 것(isLampMesh120). 명세 3대로 인스턴스 메시 하나(count 4)여야 한다.
// - 점등 = 가로등 재질의 emissiveIntensity. 낮(daylight.ceiling 0)에는 0, 그 밖에는 ceiling에 비례한다(명세 4: "daylight.ceiling(0~1)을 따라 바꾼다").
//   비례 상수는 명세에 없어(밤에 유리색이 알아보일 정도) 정하지 않고, ceiling 1에서 잰 값을 기준으로 비례하는지만 본다.
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
  LAMP_ASSET_NAME,
  LAMP_MODEL_SIZE,
  LAMP_ROUGHNESS,
  LAMP_SCALE,
  LAMP_TRIANGLES,
  LANTERNS,
  isLampMesh120,
  isLampUrl,
  lampAssetExists
} from "../__fixtures__/village-streetlamp-120";
import { buildLampGltf, type LampGltf } from "../__fixtures__/village-streetlamp-model-120";
import { resetTreeLoader } from "../__fixtures__/village-trees-113";

type FramePart = (state: unknown, delta: number) => void;

const mockFrames: FramePart[] = [];
const mockScene: { background: unknown } = { background: null };
/** 가짜 불러오기가 받은 요청(입력 그대로). */
const mockCalls: { loader: unknown; input: unknown }[] = [];
/** 가짜 불러오기가 가로등 모델 파일에 주는 모델(react-three-fiber useLoader의 캐시처럼 같은 객체). */
const lampSource: { gltf: LampGltf | null } = { gltf: null };

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
    const fountainModel = require("../__fixtures__/village-fountain-model-118") as typeof import("../__fixtures__/village-fountain-model-118");
    const lamp = require("../__fixtures__/village-streetlamp-120") as typeof import("../__fixtures__/village-streetlamp-120");
    const scene101 = require("../__fixtures__/village-scene-101") as typeof import("../__fixtures__/village-scene-101");
    const trees = require("../__fixtures__/village-trees-113") as typeof import("../__fixtures__/village-trees-113");
    /* eslint-enable @typescript-eslint/no-require-imports */
    mockCalls.push({ loader, input });
    if (lamp.isLampUrl(input)) return lampSource.gltf;
    if (fountain.isFountainUrl(input)) return fountainModel.sharedFountainGltf();
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
  lampSource.gltf = lampAssetExists() ? buildLampGltf() : null;
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

type Light = { ambience: unknown; ceiling: number; target: unknown };
type Drawn = { roots: THREE.Object3D[]; pick: MutableRefObject<THREE.Object3D[]>; light: Light; unmount: () => Promise<void> };

async function frames(count: number, delta = 1 / 60) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f({}, delta);
  });
}

/** 마을을 그린다(VillageLayer 모양). 프레임은 돌리지 않는다. ceiling은 마을 점등에 쓰는 천장 조명(0 낮 ~ 1 밤). */
async function draw(ceiling = 0): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
  const d = daylightAt(new Date(2026, 5, 21, 12, 30));
  const light: Light = { ambience: d.ambience, ceiling, target: d };
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
    light,
    unmount: async () => {
      await act(async () => {
        done();
      });
    }
  };
}

function shownChain(o: THREE.Object3D, roots: THREE.Object3D[]): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if (roots.includes(n)) return true;
  }
  return false;
}

/** 그린 장면에서 보이는 가로등 메시(모델의 메시: 930 삼각형·재질 이름 lamp). */
function lampMeshes(roots: THREE.Object3D[]): THREE.Mesh[] {
  return allObjects(roots).filter((o): o is THREE.Mesh => isLampMesh120(o) && shownChain(o, roots));
}

/** 가로등 인스턴스 메시 하나가 있어야 아래를 볼 수 있다(구현 전에는 여기서 실패한다). */
function needLamps(drawn: Drawn): THREE.InstancedMesh {
  const meshes = lampMeshes(drawn.roots);
  expect({ meshes: meshes.length, instanced: meshes.map((m) => m instanceof THREE.InstancedMesh), counts: meshes.map((m) => (m as THREE.InstancedMesh).count) }).toEqual({
    meshes: 1,
    instanced: [true],
    counts: [4]
  });
  return meshes[0] as THREE.InstancedMesh;
}

const material = (mesh: THREE.Mesh) => mesh.material as THREE.MeshStandardMaterial;

const round = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;

/** 인스턴스마다 월드 상자(메시의 월드 행렬 × 인스턴스 행렬로 모델의 모든 꼭짓점을 옮긴다). */
function instanceBoxes(mesh: THREE.InstancedMesh, roots: THREE.Object3D[]): THREE.Box3[] {
  for (const r of roots) r.updateMatrixWorld(true);
  const position = mesh.geometry.getAttribute("position");
  const instance = new THREE.Matrix4();
  const full = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const boxes: THREE.Box3[] = [];
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, instance);
    full.multiplyMatrices(mesh.matrixWorld, instance);
    const box = new THREE.Box3();
    for (let p = 0; p < position.count; p += 1) box.expandByPoint(v.fromBufferAttribute(position, p).applyMatrix4(full));
    boxes.push(box);
  }
  return boxes;
}

describe("[spec] 120 마을의 새 가로등(명세 2·3)", () => {
  it("[바뀔] V1 가로등 모델 파일(village-streetlamp.glb)을 마을 모델과 따로, GLTFLoader로 한 파일씩 읽는다(목록으로 묶어 읽지 않는다)", async () => {
    await draw();
    const { GLTFLoader } = jest.requireMock<{ GLTFLoader: unknown }>("three/examples/jsm/loaders/GLTFLoader.js");
    const lampCalls = mockCalls.filter((c) => isLampUrl(Array.isArray(c.input) ? undefined : c.input) || (Array.isArray(c.input) && c.input.some(isLampUrl)));
    expect(lampCalls.length).toBeGreaterThan(0);
    expect(lampCalls.every((c) => c.loader === GLTFLoader && c.input === LAMP_ASSET_NAME)).toBe(true);
    const villageCalls = mockCalls.filter((c) => c.input === "lobby-village.glb" || (Array.isArray(c.input) && c.input.includes("lobby-village.glb")));
    expect(villageCalls.length).toBeGreaterThan(0);
    expect(villageCalls.every((c) => c.input === "lobby-village.glb")).toBe(true);
  });

  it("[바뀔] V2 광장에 가로등이 정확히 네 그루이고 인스턴스 메시 하나로 그린다: 가로등 메시는 하나(930 삼각형, 인스턴스 4개)이고, 한 모양·한 재질을 함께 쓰며, 일반 메시로 따로 그린 가로등은 없다", async () => {
    const drawn = await draw();
    const lamp = needLamps(drawn);
    expect(lamp.geometry.getAttribute("position").count).toBeGreaterThan(0);
    expect((lamp.geometry.index ? lamp.geometry.index.count : lamp.geometry.getAttribute("position").count) / 3).toBe(LAMP_TRIANGLES);
    expect(Array.isArray(lamp.material)).toBe(false);
    // 가로등 모델의 메시가 인스턴스 아닌 일반 메시로 그려진 것은 없다(장면 전체, 보이지 않는 것까지)
    const plain = allObjects(drawn.roots).filter((o) => isLampMesh120(o) && !(o instanceof THREE.InstancedMesh));
    expect(plain.map((o) => o.name)).toEqual([]);
    expect(LANTERNS).toHaveLength(4);
  });

  it("[바뀔] V3 자리와 크기: 배치 파일 lanterns의 자리마다 가운데가 그 x·z이고, 밑면이 땅(y 0)에 닿고, 균일 배율 1.30(지붕 폭 약 0.76, 높이 약 3.34)이다", async () => {
    const drawn = await draw();
    const lamp = needLamps(drawn);
    const boxes = instanceBoxes(lamp, drawn.roots);
    const got = boxes.map((b) => ({
      cx: round((b.min.x + b.max.x) / 2),
      cz: round((b.min.z + b.max.z) / 2),
      minY: round(b.min.y),
      sizeX: round(b.max.x - b.min.x, 2),
      sizeY: round(b.max.y - b.min.y, 2),
      sizeZ: round(b.max.z - b.min.z, 2)
    }));
    const want = LANTERNS.map(([x, z]) => ({
      cx: x,
      cz: z,
      minY: 0,
      sizeX: round(LAMP_MODEL_SIZE.half * 2 * LAMP_SCALE, 2),
      sizeY: round(LAMP_MODEL_SIZE.height * LAMP_SCALE, 2),
      sizeZ: round(LAMP_MODEL_SIZE.half * 2 * LAMP_SCALE, 2)
    }));
    // 자리 순서는 보지 않는다(모두 다른 네 자리여야 한다). 모델 크기는 소수 셋째 자리까지 적힌 값이라 0.01칸 안에서 맞으면 된다
    const key = (o: { cx: number; cz: number }) => `${o.cx},${o.cz}`;
    expect(got.map(key).sort()).toEqual(want.map(key).sort());
    for (const g of got) {
      const w = want.find((x) => key(x) === key(g))!;
      for (const k of ["minY", "sizeX", "sizeY", "sizeZ"] as const) expect({ at: key(g), k, near: Math.abs(g[k] - w[k]) <= 0.011 }).toEqual({ at: key(g), k, near: true });
    }
    // 꼭대기 약 3.34, 유리창 아래쪽(모델 약 1.88)은 약 2.44. 배율 1.3 한 번만(1.6이나 1.3×1.3이 아니다)
    expect(Math.max(...got.map((g) => g.sizeY))).toBeLessThan(3.4);
    expect(Math.min(...got.map((g) => g.sizeY))).toBeGreaterThan(3.3);
  });

  it("[바뀔] V4 재질은 모델 원본이다: 가로등 재질 하나가 이름·색(흰색)·거칠기 0.7·금속 0·발광색(1, 1, 1)·색 그림·발광 그림이 모델과 같고, 불투명하다", async () => {
    const drawn = await draw();
    const lamp = needLamps(drawn);
    const source = lampSource.gltf!.scene.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh;
    const sourceMaterial = source.material as THREE.MeshStandardMaterial;
    const m = material(lamp);
    expect({ name: m.name, color: m.color.getHex(), roughness: m.roughness, metalness: m.metalness, emissive: m.emissive.getHex(), transparent: m.transparent, opacity: m.opacity }).toEqual({
      name: sourceMaterial.name,
      color: 0xffffff,
      roughness: sourceMaterial.roughness,
      metalness: 0,
      emissive: 0xffffff,
      transparent: false,
      opacity: 1
    });
    // 모델 파일의 거칠기 0.7(32비트 소수라 0.69999999…로 읽힌다)
    expect(Math.abs(m.roughness - LAMP_ROUGHNESS)).toBeLessThan(1e-6);
    expect(m.map).toBe(sourceMaterial.map);
    expect(m.emissiveMap).toBe(sourceMaterial.emissiveMap);
    expect(m.map).not.toBeNull();
    expect(m.emissiveMap).not.toBeNull();
  });

  it("[바뀔] V5 빛과 그림자를 더하지 않는다: 가로등마다 PointLight·SpotLight가 없고, 가로등 메시는 그림자를 만들지도 받지도 않는다", async () => {
    const drawn = await draw(1);
    const lamp = needLamps(drawn);
    await frames(2);
    // 기존 마을 조명(반구광·해)은 그대로 있어도 되고, 가로등마다 점·스포트 조명을 더하지 않으며, 어떤 조명도 그림자를 만들지 않는다(명세 4: 실시간 그림자를 더하지 않는다)
    const lights = allObjects(drawn.roots).filter((o) => (o as THREE.Light).isLight);
    expect(lights.filter((o) => ["PointLight", "SpotLight", "RectAreaLight"].includes(o.type)).map((o) => o.type)).toEqual([]);
    expect(lights.filter((o) => (o as THREE.Light).castShadow).map((o) => o.type)).toEqual([]);
    expect({ cast: lamp.castShadow, receive: lamp.receiveShadow }).toEqual({ cast: false, receive: false });
  });

  it("[바뀔] V6 가로등은 누르기 대상이다: 누르기 판정 대상 목록에 가로등 메시가 있고, 가로등 위에서 아래로 쏜 광선이 그 목록의 가로등 메시에 맞는다(예전에 소품 묶음이 받던 누르기처럼)", async () => {
    const drawn = await draw();
    const lamp = needLamps(drawn);
    await frames(1);
    for (const r of drawn.roots) r.updateMatrixWorld(true);
    expect(drawn.pick.current.includes(lamp)).toBe(true);
    for (const [x, z] of LANTERNS) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 6, z), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObjects(drawn.pick.current, true);
      expect({ at: `${x},${z}`, hit: hits.length > 0 && hits[0].object === lamp }).toEqual({ at: `${x},${z}`, hit: true });
    }
  });

  it("[바뀔] V7 마을 모델 장면에서 옛 가로등 불빛 판(glow-lamp-0~3)은 그려지지 않는다(예전 불빛 잔상이 없다): 밤(천장 조명 1)에도 이름이 glow-lamp로 시작하는 물체가 없다", async () => {
    const drawn = await draw(1);
    await frames(2);
    const old = allObjects(drawn.roots).filter((o) => o.name.startsWith("glow-lamp"));
    expect(old.map((o) => o.name)).toEqual([]);
  });
});

describe("[spec] 120 낮과 밤의 점등(명세 4)", () => {
  const intensity = (lamp: THREE.Mesh) => material(lamp).emissiveIntensity;

  it("[바뀔] L1 낮(천장 조명 0)에는 빛나지 않는다: 가로등 재질의 emissiveIntensity가 0이다", async () => {
    const drawn = await draw(0);
    const lamp = needLamps(drawn);
    await frames(2);
    expect(intensity(lamp)).toBe(0);
  });

  it("[바뀔] L2 밤(천장 조명 1)에는 켜지고, 천장 조명을 따라 서서히 켜진다: emissiveIntensity가 0보다 크고, 천장 조명 0.25·0.5·0.75에서 1일 때 값의 0.25·0.5·0.75배이며, 낮으로 돌아오면 다시 0이다", async () => {
    const drawn = await draw(0);
    const lamp = needLamps(drawn);
    await frames(1);
    drawn.light.ceiling = 1;
    await frames(1);
    const full = intensity(lamp);
    expect(full).toBeGreaterThan(0);
    for (const c of [0.25, 0.5, 0.75]) {
      drawn.light.ceiling = c;
      await frames(1);
      expect({ ceiling: c, ratio: round(intensity(lamp) / full, 4) }).toEqual({ ceiling: c, ratio: c });
    }
    drawn.light.ceiling = 0;
    await frames(1);
    expect(intensity(lamp)).toBe(0);
  });

  it("[바뀔] L3 점등은 가로등 재질의 emissiveIntensity만 바꾼다: 밤에도 발광색(1, 1, 1)·발광 그림·색 그림·거칠기·금속은 그대로이고, 재질은 하나다", async () => {
    const drawn = await draw(1);
    const lamp = needLamps(drawn);
    const m = material(lamp);
    const before = { emissive: m.emissive.getHex(), color: m.color.getHex(), roughness: m.roughness, metalness: m.metalness, map: m.map, emissiveMap: m.emissiveMap, transparent: m.transparent, opacity: m.opacity };
    await frames(1);
    drawn.light.ceiling = 0.4;
    await frames(1);
    drawn.light.ceiling = 1;
    await frames(1);
    expect(lamp.material).toBe(m);
    expect({ emissive: m.emissive.getHex(), color: m.color.getHex(), roughness: m.roughness, metalness: m.metalness, map: m.map, emissiveMap: m.emissiveMap, transparent: m.transparent, opacity: m.opacity }).toEqual(before);
    expect(m.emissiveIntensity).toBeGreaterThan(0);
  });
});

describe("[spec] 120 마을을 나갔다 들어오기(명세 5)", () => {
  it("[바뀔] E1 마을 그리기가 빠지면 가로등용 재질을 버린다(dispose가 불린다)", async () => {
    const drawn = await draw(1);
    const lamp = needLamps(drawn);
    await frames(1);
    const dispose = jest.spyOn(material(lamp), "dispose");
    await drawn.unmount();
    expect(dispose).toHaveBeenCalled();
    expect({ framesLeft: mockFrames.length }).toEqual({ framesLeft: 0 });
  });

  it("[바뀔] E2 나갔다 다시 들어오면 가로등 넷과 재질 하나가 새로 생기고(메시 하나·인스턴스 4개, 옛 재질과 다른 재질), 그때의 천장 조명으로 점등한다", async () => {
    const first = await draw(1);
    const firstLamp = needLamps(first);
    await frames(1);
    const full = material(firstLamp).emissiveIntensity;
    expect(full).toBeGreaterThan(0);
    await first.unmount();
    let previous = material(firstLamp);
    for (const [round_, ceiling] of [
      [1, 0],
      [2, 0.6],
      [3, 1]
    ] as const) {
      const drawn = await draw(ceiling);
      const lamp = needLamps(drawn);
      await frames(1);
      expect({ round: round_, newMaterial: material(lamp) !== previous }).toEqual({ round: round_, newMaterial: true });
      expect({ round: round_, intensity: round(material(lamp).emissiveIntensity / full, 4) }).toEqual({ round: round_, intensity: ceiling });
      // 그린 가로등은 넷(합친 모든 인스턴스 메시의 인스턴스 합)이고, 옛 불빛이 남지 않았다
      const all = lampMeshes(drawn.roots);
      expect({ round: round_, instances: all.reduce((n, m) => n + (m as THREE.InstancedMesh).count, 0) }).toEqual({ round: round_, instances: 4 });
      previous = material(lamp);
      await drawn.unmount();
      expect({ round: round_, framesLeft: mockFrames.length }).toEqual({ round: round_, framesLeft: 0 });
    }
  });
});
