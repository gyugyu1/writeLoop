// [spec] qa 테스트(작업 106 마을 가게 넣기, 기능 변경, 모바일): 마을 모델을 그리는 VillageModel이 두 가게(가구점·옷집)의 통유리와 건물을 다루는 방식.
// 기대값은 명세(private 작업 폴더 106-2026-11-18-마을-가게-넣기/01-main-spec.md)의 바뀌는 동작 5(통유리)·6(라룹이를 가리는 건물 반투명)과
// 그대로여야 할 동작(장소 누르기 방식)에서만 가져온다. 구현 전(기준 커밋 c728f00)에 쓴 테스트다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageModel 속성 sim·daylight·pickTargets, 모델을 require해 react-three-fiber useLoader(GLTFLoader)로 읽는 것,
// 프레임마다 useFrame으로 가리기·불빛을 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 어떻게 보나(098 qa 테스트 lobby3d-village-home-model.spec.test.tsx와 같은 방법에 유리 재질 값을 더했다):
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 저장소의 진짜 마을 모델(lobby-village.glb)을 이 테스트가 직접 풀어 만든 장면을 준다.
//   재질은 GLTFLoader처럼 이름, 바탕색, 바탕색 알파(opacity), 알파 방식 BLEND이면 transparent·depthWrite false, 발광색(emissiveFactor), 색 그림 유무를 옮긴다
//   (그림 픽셀은 풀지 않고 빈 THREE.Texture로 둔다). 프리미티브가 둘 이상인 메시 노드는 그 이름의 묶음 아래 메시 여럿이다.
// - 가짜 useFrame은 마지막으로 받은 프레임 함수를 적어 두고, 테스트가 delta 0.1초로 부른다. 낮 = 천장 조명(ceiling) 0, 밤 = 1.
// - "유리 메시" = 그린 장면의 가게 묶음(bld-furnitureShop, bld-<옷집 id>) 아래 메시 가운데 도형이 모델의 유리 재질(이름이 glass로 시작) 메시와 같은 것
//   (그린 장면은 원본을 복제해 도형을 함께 쓴다). "건물 메시" = 그 밖의 가게 메시.
// - "반투명" = 재질이 transparent이고 opacity가 0보다 크고 1보다 작다(보인다).
// - 밤 불빛(명세 5 "밤에는 유리가 따뜻한 안쪽 불빛 색으로 밝아진다"): 불을 켜는 방법은 명세에 없어 가리지 않는다. 그린 장면의 메시 가운데 유리 자리
//   (유리 메시의 세계 크기 상자를 0.15칸 넓힌 곳)에 크기 상자 가운데가 드는 보이는 메시(유리 메시 자신, 더한 불빛 판 등)의 "스스로 내는 빛"
//   = 발광색 × 발광 세기(발광색이 있는 재질) + 색 × 불투명도(MeshBasicMaterial: 빛을 받지 않고 그 색으로 보인다)를 잰다. 가장 밝은 것의 밝기
//   (0.2126R+0.7152G+0.0722B)가 밤에 낮보다 0.1 넘게 크고, 밤의 그 색이 따뜻하다(R이 B보다 0.1 넘게 크다).
// - 유리는 누르기 대상이 아니다(명세 5): 유리 삼각형(판)마다 그 가운데로 광선을 쏜다. 방향은 카메라 쪽(위 42도, 앞)에서 내려다보는 방향이고,
//   그 방향이 판과 거의 나란하면(옆 유리처럼, 판의 법선과 이루는 |cos| 0.2 이하) 판의 법선 방향으로 쏜다. 광선이 그 판을 정말 지나는지 먼저 확인하고(양면으로 잰다),
//   누르기 판정 대상(pickTargets, 그 아래 포함)과의 맞닿음에 유리 메시가 없는지 본다.
//   106 03 결정(사용자 2026-11-18 "qa가 유리판마다 쏘게 고침 (추천)")으로 고쳤다: 처음에는 유리 메시 전체의 크기 상자 가운데로 쏘았는데, 가구점 유리 15장이
//   한 메시라 그 가운데가 건물 한복판이어서 광선이 어느 판에도 닿지 않아 구현과 상관없이 실패했다. 단언은 그대로다.
//
// 바뀔 동작(구현 전 실패): G1~G4. 그대로 둘 동작은 이 파일에 없다(가게 건물 메시를 누르기 대상에 넣는 것은 G4가 새 옷집과 함께 본다).
//
// 작업 108(건물 옅게 디더링, 기능 변경) 명세의 "그 때문에 고칠 기존 테스트"와 바뀌는 동작 1(건물 재질은 처음부터 디더링(alphaHash)을 켠 불투명 재질이고,
// 가리면 불투명도만 1→0.35로 바꾸며 transparent는 켜고 끄지 않는다)로 qa가 G3을 고쳤다(108 qa 보고):
// - 가게 건물 메시 재질의 상태에 alphaHash를 더하고, 옅어진 건물 { opacity 0.35, transparent true } → { opacity 0.35, transparent false, alphaHash true },
//   옅어지지 않은 건물 { opacity 1, transparent false } → { opacity 1, transparent false, alphaHash true }.
//   가리는 자리, 프레임 수, 불투명도 값, 유리가 반투명 그대로인지 보는 단언은 그대로다.
//
// 작업 109(건물 옅게 재질 교체, 기능 변경) 명세의 "그 때문에 고칠 기존 테스트"와 바뀌는 동작 1·2(건물은 평소 디더링 없는 불투명 재질로 그리고, 가리면
// 미리 만든 반투명 재질(transparent)로 바꿔 끼워 불투명도를 0.35까지 낮추며, 벗어나면 불투명 재질로 되돌린다)로 qa가 G3을 고쳤다(109 qa 보고):
// - 재질을 바꿔 끼우므로 처음 꺼낸 재질을 들고 보지 않고, 단계마다 가게 건물 메시가 그때 가진 재질을 다시 꺼내 본다.
// - 옅어진 건물 { opacity 0.35, transparent false, alphaHash true } → { opacity 0.35, transparent true, alphaHash false },
//   옅어지지 않은 건물 { opacity 1, transparent false, alphaHash true } → { opacity 1, transparent false, alphaHash false }.
//   가리는 자리, 프레임 수, 불투명도 값, 유리가 반투명 그대로인지 보는 단언은 그대로다.
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import { VillageModel } from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_START, occludingBuildings } from "@/lib/lobby3d/village";
import { accessorValues, nowVillageGlb, sceneRoots, type Glb } from "../__fixtures__/village-glb-098";
import { GLASS_MATERIAL, clothingId } from "../__fixtures__/village-shops-106";

type FramePart = (state: unknown, delta: number) => void;

const mockFrame: { current: FramePart | null } = { current: null };
// 118: 분수도 프레임 함수를 더한다(분수 믹서). 받은 프레임 함수를 모두 적어 두고 한 번에 부른다(마을 모델 프레임 함수의 동작은 그대로다)
const mockFrameEntries: { current: FramePart }[] = [];
const mockFrameAll: FramePart = (state, delta) => {
  for (const entry of [...mockFrameEntries]) entry.current(state, delta);
};
const mockGltf: { value: unknown } = { value: null };

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
jest.mock("@/assets/models/lobby-village.glb", () => "lobby-village.glb");
// 118: 새 분수 모델 파일(village-fountain.glb)도 마을·미리 읽기가 읽으므로 파일 이름 글자로 가짜로 바꾼다(파일이 아직 없어도 되는 가상 모듈이다. 단언은 그대로다)
jest.mock("../../assets/models/village-fountain.glb", () => "village-fountain.glb", { virtual: true });
// 120: 새 가로등 모델 파일(village-streetlamp.glb)도 마을·미리 읽기가 읽으므로 파일 이름 글자로 가짜로 바꾼다(파일이 아직 없어도 되는 가상 모듈이다. 단언은 그대로다)
jest.mock("../../assets/models/village-streetlamp.glb", () => "village-streetlamp.glb", { virtual: true });
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const loader = { clear: () => {} };
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => ({ camera: null, scene: null, size: { width: 400, height: 800 } }),
    useFrame: (callback: FramePart) => {
      const entry = React.useRef(callback);
      entry.current = callback;
      React.useEffect(() => {
        mockFrameEntries.push(entry);
        return () => {
          const at = mockFrameEntries.indexOf(entry);
          if (at >= 0) mockFrameEntries.splice(at, 1);
        };
      }, []);
      mockFrame.current = mockFrameAll;
    },
    useLoader: Object.assign((_loader: unknown, url: unknown) => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const fountain = require("../__fixtures__/village-fountain-118") as typeof import("../__fixtures__/village-fountain-118");
      const model = require("../__fixtures__/village-fountain-model-118") as typeof import("../__fixtures__/village-fountain-model-118");
      const lamp = require("../__fixtures__/village-streetlamp-120") as typeof import("../__fixtures__/village-streetlamp-120");
      const lampModel = require("../__fixtures__/village-streetlamp-model-120") as typeof import("../__fixtures__/village-streetlamp-model-120");
      /* eslint-enable @typescript-eslint/no-require-imports */
      // 118: 분수 모델 파일에는 그 파일을 GLTFLoader처럼 푼 모양을 준다(마을 모델 장면이 아니다)
      // 120: 가로등 모델 파일에는 그 파일을 GLTFLoader처럼 푼 모양을 준다(마을 모델 장면이 아니다)
      if (lamp.isLampUrl(url)) return lampModel.sharedLampGltf();
      return fountain.isFountainUrl(url) ? model.sharedFountainGltf() : mockGltf.value;
    }, loader)
  };
});

// ---------- 진짜 마을 모델을 장면으로(GLTFLoader처럼 재질의 알파·발광을 옮긴다) ----------

type GltfMaterial = {
  name?: string;
  alphaMode?: string;
  emissiveFactor?: number[];
  pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } };
};

function sceneFromGlb(glb: Glb): THREE.Group {
  const textures = new Map<number, THREE.Texture>();
  const materials = ((glb.json.materials ?? []) as GltfMaterial[]).map((m) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = m.name ?? "";
    const factor = m.pbrMetallicRoughness?.baseColorFactor;
    if (factor) {
      material.color.setRGB(factor[0], factor[1], factor[2]);
      material.opacity = factor[3] ?? 1;
    }
    if (m.alphaMode === "BLEND") {
      material.transparent = true;
      material.depthWrite = false;
    }
    if (m.emissiveFactor) material.emissive.setRGB(m.emissiveFactor[0], m.emissiveFactor[1], m.emissiveFactor[2]);
    const ref = m.pbrMetallicRoughness?.baseColorTexture;
    if (ref) {
      if (!textures.has(ref.index)) textures.set(ref.index, new THREE.Texture());
      material.map = textures.get(ref.index)!;
    }
    return material;
  });
  const build = (index: number): THREE.Object3D => {
    const node = glb.json.nodes[index];
    let object: THREE.Object3D;
    if (node.mesh !== undefined) {
      const mesh = glb.json.meshes[node.mesh];
      const parts = mesh.primitives.map((p) => {
        const geometry = new THREE.BufferGeometry();
        const points = accessorValues(glb, p.attributes.POSITION);
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
        if (p.attributes.COLOR_0 !== undefined) geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array(points.length * 4).fill(1), 4));
        if (p.indices !== undefined) geometry.setIndex(accessorValues(glb, p.indices).flat());
        return new THREE.Mesh(geometry, p.material !== undefined ? materials[p.material] : new THREE.MeshStandardMaterial());
      });
      if (parts.length === 1) object = parts[0];
      else {
        object = new THREE.Group();
        parts.forEach((part, i) => {
          part.name = `${mesh.name ?? node.name}_${i}`;
          object.add(part);
        });
      }
    } else object = new THREE.Group();
    object.name = node.name ?? "";
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    (node.children ?? []).forEach((c) => object.add(build(c)));
    return object;
  };
  const scene = new THREE.Group();
  scene.name = "Scene";
  sceneRoots(glb).forEach((r) => scene.add(build(r)));
  return scene;
}

// ---------- 그리기 ----------

type Drawn = { root: THREE.Object3D; pick: MutableRefObject<THREE.Object3D[]>; sim: { x: number; z: number; reduceMotion: boolean }; light: { ceiling: number; target: { season: string } } };

async function draw(at: { x: number; z: number }, ceiling = 0): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const simState = { x: at.x, z: at.z, reduceMotion: true };
  const light = { ceiling, target: { season: "summer" } };
  const view = await render(<VillageModel sim={simState as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />);
  const primitives = view.container.queryAll((instance: TestInstance) => instance.type === "primitive").filter(
    // 118: 분수를 따로 그리는 구현이면 분수 모델의 그림 조각도 있다. 마을 모델의 뿌리(건물 bld-home이 든 것)만 본다
    (p) => !!(p.props as { object: THREE.Object3D }).object.getObjectByName("bld-home")
  );
  expect(primitives).toHaveLength(1);
  const root = (primitives[0].props as { object: THREE.Object3D }).object;
  return { root, pick, sim: simState, light };
}

async function frames(count: number) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) mockFrame.current!({}, 0.1);
  });
}

const SHOPS = () => ["bld-furnitureShop", `bld-${clothingId()}`];

/** 모델의 유리 재질 메시의 도형. */
function glassGeometries(): Set<THREE.BufferGeometry> {
  const out = new Set<THREE.BufferGeometry>();
  (mockGltf.value as { scene: THREE.Object3D }).scene.traverse((o) => {
    if (o instanceof THREE.Mesh && GLASS_MATERIAL.test((o.material as THREE.Material).name)) out.add(o.geometry);
  });
  return out;
}

/** 그린 장면의 가게 묶음 아래 메시를 유리와 건물로 나눈다(묶음과 유리가 있어야 한다). */
function shopMeshes(root: THREE.Object3D, name: string): { glass: THREE.Mesh[]; building: THREE.Mesh[] } {
  const group = root.children.find((c) => c.name === name);
  expect({ name, found: group !== undefined }).toEqual({ name, found: true });
  const glassSet = glassGeometries();
  const glass: THREE.Mesh[] = [];
  const building: THREE.Mesh[] = [];
  group!.traverse((o) => {
    if (o instanceof THREE.Mesh) (glassSet.has(o.geometry) ? glass : building).push(o);
  });
  expect({ name, glass: glass.length > 0, building: building.length > 0 }).toEqual({ name, glass: true, building: true });
  return { glass, building };
}

const materialsOf = (meshes: THREE.Mesh[]) => meshes.flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]));

function shown(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/** 메시가 스스로 내는 빛(머리말). 보이지 않으면 검정. */
function selfLight(mesh: THREE.Mesh): THREE.Color {
  const out = new THREE.Color(0, 0, 0);
  if (!shown(mesh)) return out;
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    if (!m.visible) continue;
    const emissive = (m as THREE.MeshLambertMaterial).emissive;
    if (emissive instanceof THREE.Color) out.add(emissive.clone().multiplyScalar((m as THREE.MeshLambertMaterial).emissiveIntensity ?? 1));
    if (m instanceof THREE.MeshBasicMaterial) out.add(m.color.clone().multiplyScalar(m.transparent ? m.opacity : 1));
  }
  return out;
}

const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** 유리 자리(유리 메시 세계 크기 상자를 0.15칸 넓힌 곳)에 크기 상자 가운데가 드는 메시 가운데 가장 밝게 스스로 빛나는 것의 색. */
function brightestAtGlass(root: THREE.Object3D, glass: THREE.Mesh[]): THREE.Color {
  root.updateMatrixWorld(true);
  const areas = glass.map((g) => new THREE.Box3().setFromObject(g).expandByScalar(0.15));
  let best = new THREE.Color(0, 0, 0);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return;
    const center = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    if (!areas.some((a) => a.containsPoint(center))) return;
    const c = selfLight(o);
    if (luminance(c) > luminance(best)) best = c;
  });
  return best;
}

beforeEach(() => {
  mockFrame.current = null;
  mockFrameEntries.length = 0;
  mockGltf.value = { scene: sceneFromGlb(nowVillageGlb()) };
});

describe("[spec] 106 바뀔 동작: 두 가게의 통유리와 건물(명세 5·6)", () => {
  it("G1 통유리 낮(명세 5): 낮(천장 조명 0)에 가구점·옷집의 유리 메시는 보이고, 재질이 반투명(transparent, 0 < opacity < 1)이다", async () => {
    const view = await draw(VILLAGE_START, 0);
    await frames(2);
    for (const name of SHOPS()) {
      const { glass } = shopMeshes(view.root, name);
      for (const m of glass) expect({ name, mesh: m.name, shown: shown(m) }).toEqual({ name, mesh: m.name, shown: true });
      for (const m of materialsOf(glass)) {
        expect({ name, transparent: m.transparent, translucent: m.opacity > 0 && m.opacity < 1, opacity: m.opacity }).toEqual({ name, transparent: true, translucent: true, opacity: m.opacity });
      }
    }
  });

  it("G2 통유리 밤(명세 5): 밤(천장 조명 1)에는 가게마다 유리 자리에서 스스로 내는 빛이 낮보다 밝아지고(밝기 차 0.1 넘게), 그 색이 따뜻하다(R > B + 0.1)", async () => {
    const view = await draw(VILLAGE_START, 0);
    await frames(2);
    const day = new Map(SHOPS().map((name) => [name, brightestAtGlass(view.root, shopMeshes(view.root, name).glass)]));
    view.light.ceiling = 1;
    await frames(2);
    for (const name of SHOPS()) {
      const night = brightestAtGlass(view.root, shopMeshes(view.root, name).glass);
      const before = day.get(name)!;
      expect({ name, brighter: luminance(night) > luminance(before) + 0.1, warm: night.r > night.b + 0.1, day: before.getHexString(), night: night.getHexString() }).toEqual({
        name,
        brighter: true,
        warm: true,
        day: before.getHexString(),
        night: night.getHexString()
      });
    }
  });

  it("G3 가리기(명세 6, 109에서 고침): 옷집 바로 뒤에 서면 옷집 건물 메시가 반투명 재질(transparent)로 0.35까지 옅어지고(가구점은 불투명 재질로 불투명도 1 그대로, 디더링(alphaHash)은 둘 다 쓰지 않는다), 가구점 바로 뒤에 서면 가구점이 옅어지며, 벗어나면 둘 다 불투명 재질로 돌아온다. 그 뒤에도 유리는 반투명이다(명세 5)", async () => {
    const id = clothingId();
    const behindClothing = { x: 47, z: 15.5 };
    const behindFurniture = { x: 11, z: 24.5 };
    expect(occludingBuildings(behindClothing)).toEqual([id]);
    expect(occludingBuildings(behindFurniture)).toEqual(["furnitureShop"]);
    const view = await draw(behindClothing);
    await frames(10);
    // 재질을 바꿔 끼우므로 단계마다 그때 메시가 가진 재질을 다시 꺼낸다(109)
    const clothing = () => materialsOf(shopMeshes(view.root, `bld-${id}`).building);
    const furniture = () => materialsOf(shopMeshes(view.root, "bld-furnitureShop").building);
    const state = (ms: THREE.Material[]) => ms.map((m) => ({ opacity: m.opacity, transparent: m.transparent, alphaHash: m.alphaHash }));
    expect(state(clothing())).toEqual(clothing().map(() => ({ opacity: 0.35, transparent: true, alphaHash: false })));
    expect(state(furniture())).toEqual(furniture().map(() => ({ opacity: 1, transparent: false, alphaHash: false })));
    view.sim.x = behindFurniture.x;
    view.sim.z = behindFurniture.z;
    await frames(10);
    expect(state(furniture())).toEqual(furniture().map(() => ({ opacity: 0.35, transparent: true, alphaHash: false })));
    expect(state(clothing())).toEqual(clothing().map(() => ({ opacity: 1, transparent: false, alphaHash: false })));
    view.sim.x = VILLAGE_START.x;
    view.sim.z = VILLAGE_START.z;
    await frames(10);
    expect(state([...clothing(), ...furniture()])).toEqual([...clothing(), ...furniture()].map(() => ({ opacity: 1, transparent: false, alphaHash: false })));
    // 옅어졌다 돌아온 뒤에도 유리는 반투명 그대로다(명세 5)
    for (const name of SHOPS()) {
      for (const m of materialsOf(shopMeshes(view.root, name).glass)) {
        expect({ name, transparent: m.transparent, translucent: m.opacity > 0 && m.opacity < 1 }).toEqual({ name, transparent: true, translucent: true });
      }
    }
  });

  it("G4 누르기(명세 5, 장소 누르기 방식 그대로): 가게 건물 메시는 모두 누르기 판정 대상에 있고, 유리는 누르기 대상이 아니다(유리 판마다 그 가운데로 쏜 광선이 판정 대상 가운데 유리에 닿지 않는다)", async () => {
    const view = await draw(VILLAGE_START);
    view.root.updateMatrixWorld(true);
    const pitch = (42 * Math.PI) / 180;
    const toward = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch));
    for (const name of SHOPS()) {
      const { glass, building } = shopMeshes(view.root, name);
      expect({ name, inPick: building.every((m) => view.pick.current.includes(m)) }).toEqual({ name, inPick: true });
      for (const g of glass) {
        const position = g.geometry.getAttribute("position");
        const index = g.geometry.getIndex();
        const triangles = (index ? index.count : position.count) / 3;
        expect({ name, mesh: g.name, triangles: triangles > 0 }).toEqual({ name, mesh: g.name, triangles: true });
        const probe = new THREE.Mesh(g.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        probe.matrixWorld.copy(g.matrixWorld);
        const missed: number[] = [];
        const glassHits: number[] = [];
        for (let t = 0; t < triangles; t += 1) {
          const corner = (k: number) => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k).applyMatrix4(g.matrixWorld);
          const [a, b, c] = [corner(0), corner(1), corner(2)];
          const center = a.clone().add(b).add(c).divideScalar(3);
          const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
          const direction = Math.abs(normal.dot(toward)) > 0.2 ? toward.clone() : normal.clone().negate();
          const raycaster = new THREE.Raycaster(center.clone().addScaledVector(direction, -30), direction);
          // 광선이 정말 이 판을 지나는지(양면으로 잰다)
          const through: THREE.Intersection[] = [];
          THREE.Mesh.prototype.raycast.call(probe, raycaster, through);
          if (!through.some((h) => h.faceIndex === t)) missed.push(t);
          if (raycaster.intersectObjects(view.pick.current, true).some((h) => glass.includes(h.object as THREE.Mesh))) glassHits.push(t);
        }
        expect({ name, mesh: g.name, missed }).toEqual({ name, mesh: g.name, missed: [] });
        expect({ name, mesh: g.name, glassHits: glassHits.length }).toEqual({ name, mesh: g.name, glassHits: 0 });
      }
    }
  });
});
