// [spec] qa 테스트(작업 108 건물 옅게 디더링, 기능 변경, 모바일): 라룹이를 가리는 마을 건물이 옅어지는 방식.
// 기대값은 명세(private 작업 폴더 108-2026-11-18-건물-옅게-디더링/01-main-spec.md)의 바뀌는 동작 1·2와 그대로여야 할 동작에서만 가져온다.
// 그대로 둘 동작의 값(옅어지는 빠르기, 유리 불투명도·불빛 세기)은 기준 커밋 753d340의 지금 동작(lobby3d-village.tsx의 FADED_OPACITY 0.35,
// FADE_SECONDS 0.25, GLASS_DAY_OPACITY 0.3, GLASS_NIGHT_OPACITY 0.8, GLASS_NIGHT_GLOW 0.85)에서 가져왔다.
// 구현 코드는 부르는 방법(VillageModel 속성 sim·daylight·pickTargets, 모델을 require해 react-three-fiber useLoader(GLTFLoader)로 읽는 것,
// 프레임마다 useFrame으로 가리기·불빛을 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 어떻게 보나(106 qa 테스트 lobby3d-village-shops-glass.spec.test.tsx와 같은 방법에 꼭짓점 색 알파와 그림 형식을 더했다):
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 저장소의 진짜 마을 모델(lobby-village.glb)을 이 테스트가 직접 풀어 만든 장면을 준다.
//   재질은 GLTFLoader처럼 이름, 바탕색, 바탕색 알파(opacity), 알파 방식 BLEND이면 transparent·depthWrite false, 색 그림 유무를 옮긴다.
//   색 그림은 픽셀을 풀지 않고 빈 THREE.Texture로 두되, glb에 적힌 그림 형식(mimeType)을 그림의 userData.mimeType에 적어 둔다.
//   꼭짓점 색(COLOR_0)은 glb의 값을 그대로(정규화해서) 옮긴다(알파가 점무늬에 들어가므로).
// - 가짜 useFrame은 마지막으로 받은 프레임 함수를 적어 두고, 테스트가 delta 0.1초로 부른다. 낮 = 천장 조명(ceiling) 0, 밤 = 1.
// - "건물 재질" = 그린 장면 뿌리의 bld-* 묶음 아래 메시 가운데 유리가 아닌 메시의 재질. "유리" = 도형이 모델의 유리 재질(이름이 glass로 시작) 메시와 같은 메시.
// - "셰이더가 바뀐다" = three.js가 재질의 셰이더를 다시 고르는 때. 재질의 version이 오르면(needsUpdate, alphaTest가 0을 넘나듦 등) 다시 고르고,
//   transparent·alphaHash 값이 셰이더를 가른다. 그래서 프레임마다 transparent·alphaHash·version이 그대로인지 본다.
// - 명세 2 "불투명도 1일 때는 점이 빠지지 않는다": three.js의 alphaHash는 바탕 알파(재질 opacity × 꼭짓점 색 알파(vertexColors이고 색이 4성분일 때)
//   × 색 그림 알파 × alphaMap)가 0보다 크고 1 이하인 문턱보다 작은 점을 버린다. 그래서 불투명도 1일 때 바탕 알파가 모든 점에서 1이면 점이 빠지지 않는다.
//   색 그림 알파는 그림 형식이 JPEG(알파 없음)이면 1로 보고, 그 밖의 형식이면 잴 수 없어 실패로 둔다. alphaMap이 있으면 잴 수 없어 실패로 둔다.
//
// 바뀔 동작(구현 전 실패): D1, D2, D3. 그대로 둘 동작(구현 전·뒤 통과): D4, D5, D6.
// 명세의 "그 때문에 고칠 기존 테스트"는 lobby3d-village-home-model.spec.test.tsx R4와 lobby3d-village-shops-glass.spec.test.tsx G3을 고쳤다(바뀔 동작).
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import { VillageModel } from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_BUILDINGS, VILLAGE_START, occludingBuildings } from "@/lib/lobby3d/village";
import { accessorValues, nowVillageGlb, sceneRoots, type Glb } from "../__fixtures__/village-glb-098";
import { GLASS_MATERIAL, clothingId } from "../__fixtures__/village-shops-106";

type FramePart = (state: unknown, delta: number) => void;

const mockFrame: { current: FramePart | null } = { current: null };
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
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const loader = { clear: () => {} };
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => ({ camera: null, scene: null, size: { width: 400, height: 800 } }),
    useFrame: (callback: FramePart) => {
      mockFrame.current = callback;
    },
    useLoader: Object.assign(() => mockGltf.value, loader)
  };
});

// ---------- 진짜 마을 모델을 장면으로 ----------

type GltfMaterial = {
  name?: string;
  alphaMode?: string;
  emissiveFactor?: number[];
  pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } };
};
type GltfAccessor = { componentType: number; normalized?: boolean };

/** 정규화한 accessor 값(GLTFLoader처럼 normalized 정수는 0~1로). */
function normalizedValues(glb: Glb, index: number): number[][] {
  const accessor = glb.json.accessors[index] as unknown as GltfAccessor;
  const raw = accessorValues(glb, index);
  if (!accessor.normalized) return raw;
  const max: Record<number, number> = { 5121: 255, 5123: 65535, 5125: 4294967295, 5120: 127, 5122: 32767 };
  return raw.map((item) => item.map((v) => Math.max(v / max[accessor.componentType], -1)));
}

function sceneFromGlb(glb: Glb): THREE.Group {
  const textures = new Map<number, THREE.Texture>();
  const json = glb.json;
  const materials = ((json.materials ?? []) as GltfMaterial[]).map((m) => {
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
      if (!textures.has(ref.index)) {
        const texture = new THREE.Texture();
        const source = json.textures?.[ref.index]?.source;
        texture.userData.mimeType = source !== undefined ? json.images?.[source]?.mimeType ?? "" : "";
        textures.set(ref.index, texture);
      }
      material.map = textures.get(ref.index)!;
    }
    return material;
  });
  const build = (index: number): THREE.Object3D => {
    const node = json.nodes[index];
    let object: THREE.Object3D;
    if (node.mesh !== undefined) {
      const mesh = json.meshes[node.mesh];
      const parts = mesh.primitives.map((p) => {
        const geometry = new THREE.BufferGeometry();
        const points = accessorValues(glb, p.attributes.POSITION);
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flat(), 3));
        if (p.attributes.COLOR_0 !== undefined) {
          const colors = normalizedValues(glb, p.attributes.COLOR_0);
          geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors.flat(), colors[0]?.length ?? 4));
        }
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

type Drawn = { root: THREE.Object3D; sim: { x: number; z: number; reduceMotion: boolean }; light: { ceiling: number; target: { season: string } } };

async function draw(at: { x: number; z: number }, ceiling = 0): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const simState = { x: at.x, z: at.z, reduceMotion: true };
  const light = { ceiling, target: { season: "summer" } };
  const view = await render(<VillageModel sim={simState as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />);
  const primitives = view.container.queryAll((instance: TestInstance) => instance.type === "primitive");
  expect(primitives).toHaveLength(1);
  const root = (primitives[0].props as { object: THREE.Object3D }).object;
  return { root, sim: simState, light };
}

async function frames(count: number, each?: () => void) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) {
      mockFrame.current!({}, 0.1);
      each?.();
    }
  });
}

function moveTo(view: Drawn, at: { x: number; z: number }) {
  view.sim.x = at.x;
  view.sim.z = at.z;
}

const materialsOf = (meshes: THREE.Mesh[]) => meshes.flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]));

/** 모델의 유리 재질 메시의 도형(그린 장면은 원본을 복제해 도형을 함께 쓴다). */
function glassGeometries(): Set<THREE.BufferGeometry> {
  const out = new Set<THREE.BufferGeometry>();
  (mockGltf.value as { scene: THREE.Object3D }).scene.traverse((o) => {
    if (o instanceof THREE.Mesh && GLASS_MATERIAL.test((o.material as THREE.Material).name)) out.add(o.geometry);
  });
  return out;
}

const BUILDING_GROUPS = () => ["bld-home", "bld-furnitureShop", `bld-${clothingId()}`];

/** 그린 장면 뿌리의 bld-* 묶음마다 유리 메시와 건물 메시. 집·가구점·옷집 묶음이 모두 있어야 한다. */
function buildingGroups(root: THREE.Object3D): Map<string, { glass: THREE.Mesh[]; building: THREE.Mesh[] }> {
  const names = root.children.filter((c) => c.name.startsWith("bld-")).map((c) => c.name);
  expect(BUILDING_GROUPS().every((n) => names.includes(n))).toBe(true);
  const glassSet = glassGeometries();
  const out = new Map<string, { glass: THREE.Mesh[]; building: THREE.Mesh[] }>();
  for (const name of names) {
    const glass: THREE.Mesh[] = [];
    const building: THREE.Mesh[] = [];
    root.children.find((c) => c.name === name)!.traverse((o) => {
      if (o instanceof THREE.Mesh) (glassSet.has(o.geometry) ? glass : building).push(o);
    });
    expect({ name, building: building.length > 0 }).toEqual({ name, building: true });
    out.set(name, { glass, building });
  }
  return out;
}

const buildingMaterials = (root: THREE.Object3D) => [...buildingGroups(root).values()].flatMap((g) => materialsOf(g.building));
const glassMaterials = (root: THREE.Object3D, name: string) => materialsOf(buildingGroups(root).get(name)!.glass);

/** bld-* 묶음 밖의 메시(소품·생울타리·울타리·풍차·나무·불빛 판·옛 길 조각). */
function otherMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const child of root.children) {
    if (child.name.startsWith("bld-")) continue;
    child.traverse((o) => {
      if (o instanceof THREE.Mesh) out.push(o);
    });
  }
  return out;
}

const home = () => VILLAGE_BUILDINGS.find((b) => b.id === "home")!;
/** 집 바로 뒤(뒷면에서 0.5칸): 098 qa R4와 같은 자리. */
const behindHome = () => ({ x: home().doorX, z: home().rect[1] - 0.5 });
/** 106 qa G3과 같은 자리. */
const BEHIND_FURNITURE = { x: 11, z: 24.5 };
const BEHIND_CLOTHING = { x: 47, z: 15.5 };

const round = (v: number) => Math.round(v * 1e6) / 1e6;

beforeEach(() => {
  mockFrame.current = null;
  mockGltf.value = { scene: sceneFromGlb(nowVillageGlb()) };
});

describe("[spec] 108 바뀔 동작: 건물은 디더링(alphaHash)으로 옅어진다(명세 1·2)", () => {
  it("D1 처음부터(명세 1): 라룹이를 가리지 않는 자리에서 그리면 집·가구점·옷집의 건물 재질은 모두 alphaHash가 켜진 불투명 재질(transparent false)이고 불투명도는 1이다", async () => {
    expect(occludingBuildings(VILLAGE_START)).toEqual([]);
    const view = await draw(VILLAGE_START);
    await frames(1);
    for (const [name, { building }] of buildingGroups(view.root)) {
      for (const m of materialsOf(building)) {
        expect({ name, alphaHash: m.alphaHash, transparent: m.transparent, opacity: m.opacity }).toEqual({ name, alphaHash: true, transparent: false, opacity: 1 });
      }
    }
  });

  it("D2 셰이더가 바뀌지 않는다(명세 1): 집·가구점·옷집 뒤를 차례로 오가며 옅어졌다 돌아오는 동안 프레임마다 모든 건물 재질의 transparent(false)·alphaHash(true)·version이 첫 프레임 그대로이고, 불투명도만 0.35까지 내려갔다 1로 돌아온다", async () => {
    expect(occludingBuildings(behindHome())).toEqual(["home"]);
    expect(occludingBuildings(BEHIND_FURNITURE)).toEqual(["furnitureShop"]);
    expect(occludingBuildings(BEHIND_CLOTHING)).toEqual([clothingId()]);
    const view = await draw(VILLAGE_START);
    await frames(1);
    const all = buildingMaterials(view.root);
    expect(all.length).toBeGreaterThan(0);
    const groupOf = new Map<THREE.Material, string>();
    for (const [name, { building }] of buildingGroups(view.root)) for (const m of materialsOf(building)) groupOf.set(m, name);
    const firstVersion = new Map(all.map((m) => [m, m.version]));
    const broken: { frame: number; material: string; transparent: boolean; alphaHash: boolean; versionChanged: boolean }[] = [];
    let frame = 1;
    const check = () => {
      frame += 1;
      for (const m of all) {
        const versionChanged = m.version !== firstVersion.get(m);
        if (m.transparent !== false || m.alphaHash !== true || versionChanged) broken.push({ frame, material: groupOf.get(m) ?? m.uuid, transparent: m.transparent, alphaHash: m.alphaHash, versionChanged });
      }
    };
    const lowest = new Map(all.map((m) => [m, m.opacity]));
    const track = () => {
      check();
      for (const m of all) lowest.set(m, Math.min(lowest.get(m)!, m.opacity));
    };
    for (const at of [behindHome(), VILLAGE_START, BEHIND_FURNITURE, BEHIND_CLOTHING, VILLAGE_START]) {
      moveTo(view, at);
      await frames(10, track);
    }
    expect(broken.slice(0, 5)).toEqual([]);
    expect(broken.length).toBe(0);
    // 셋 다 한 번씩 0.35까지 옅어졌고, 끝에는 모두 1로 돌아왔다
    for (const [name, { building }] of buildingGroups(view.root)) {
      if (!BUILDING_GROUPS().includes(name)) continue;
      for (const m of materialsOf(building)) expect({ name, lowest: round(lowest.get(m)!), now: m.opacity }).toEqual({ name, lowest: 0.35, now: 1 });
    }
  });

  it("D3 불투명도 1이면 점이 빠지지 않는다(명세 2): 가리지 않을 때 건물 재질마다 alphaHash가 켜져 있고, 바탕 알파(불투명도 × 꼭짓점 색 알파 × 색 그림 알파)가 모든 점에서 1이며 alphaMap이 없다", async () => {
    const view = await draw(VILLAGE_START);
    await frames(1);
    for (const [name, { building }] of buildingGroups(view.root)) {
      for (const mesh of building) {
        for (const m of materialsOf([mesh])) {
          const lambertish = m as THREE.MeshLambertMaterial;
          const color = mesh.geometry.getAttribute("color");
          let vertexAlpha = 1;
          if (lambertish.vertexColors && color && color.itemSize === 4) for (let i = 0; i < color.count; i += 1) vertexAlpha = Math.min(vertexAlpha, color.getW(i));
          const map = lambertish.map;
          const mapAlpha = !map ? 1 : map.userData?.mimeType === "image/jpeg" ? 1 : NaN;
          expect({ name, mesh: mesh.name, alphaHash: m.alphaHash, lowestAlpha: m.opacity * vertexAlpha * mapAlpha, alphaMap: lambertish.alphaMap ?? null }).toEqual({
            name,
            mesh: mesh.name,
            alphaHash: true,
            lowestAlpha: 1,
            alphaMap: null
          });
        }
      }
    }
  });
});

describe("[spec] 108 그대로 둘 동작: 옅어지는 조건·빠르기, 가게 유리, 그 밖의 마을 그리기", () => {
  it("D4 빠르기(0.25초에 걸쳐 0.35까지, 같은 빠르기로 돌아옴): 집 뒤에 서면 0.1초 프레임마다 집 건물 재질의 불투명도가 0.74 → 0.48 → 0.35 → 0.35, 벗어나면 0.61 → 0.87 → 1 → 1이고, 그동안 다른 건물은 1이다", async () => {
    const view = await draw(behindHome());
    const groups = buildingGroups(view.root);
    const homeMats = materialsOf(groups.get("bld-home")!.building);
    const others = BUILDING_GROUPS()
      .filter((n) => n !== "bld-home")
      .flatMap((n) => materialsOf(groups.get(n)!.building));
    const seen: number[][] = [];
    const otherSeen: number[] = [];
    const record = () => {
      seen.push(homeMats.map((m) => round(m.opacity)));
      otherSeen.push(...others.map((m) => m.opacity));
    };
    await frames(4, record);
    moveTo(view, VILLAGE_START);
    await frames(4, record);
    expect(seen).toEqual([0.74, 0.48, 0.35, 0.35, 0.61, 0.87, 1, 1].map((v) => homeMats.map(() => v)));
    expect(otherSeen.every((v) => v === 1)).toBe(true);
  });

  it("D5 가게 유리(106 c4b7693): 유리는 alphaHash 없이 반투명(transparent) 그대로이고, 가구점이 옅어지면 가구점 유리만 같은 비율로 옅어진다(낮 0.3×0.35, 밤 0.8×0.35, 밤 불빛 0.85×0.35). 돌아오면 낮 0.3·밤 0.8, 불빛 0.85다", async () => {
    const view = await draw(BEHIND_FURNITURE, 0);
    await frames(10);
    const furniture = glassMaterials(view.root, "bld-furnitureShop") as THREE.MeshLambertMaterial[];
    const clothing = glassMaterials(view.root, `bld-${clothingId()}`) as THREE.MeshLambertMaterial[];
    expect({ furniture: furniture.length > 0, clothing: clothing.length > 0 }).toEqual({ furniture: true, clothing: true });
    const state = (ms: THREE.MeshLambertMaterial[]) => ms.map((m) => ({ transparent: m.transparent, alphaHash: m.alphaHash, opacity: round(m.opacity), glow: round(m.emissiveIntensity) }));
    expect(state(furniture)).toEqual(furniture.map(() => ({ transparent: true, alphaHash: false, opacity: round(0.3 * 0.35), glow: 0 })));
    expect(state(clothing)).toEqual(clothing.map(() => ({ transparent: true, alphaHash: false, opacity: 0.3, glow: 0 })));
    view.light.ceiling = 1;
    await frames(1);
    expect(state(furniture)).toEqual(furniture.map(() => ({ transparent: true, alphaHash: false, opacity: round(0.8 * 0.35), glow: round(0.85 * 0.35) })));
    expect(state(clothing)).toEqual(clothing.map(() => ({ transparent: true, alphaHash: false, opacity: 0.8, glow: 0.85 })));
    moveTo(view, VILLAGE_START);
    await frames(10);
    expect(state([...furniture, ...clothing])).toEqual([...furniture, ...clothing].map(() => ({ transparent: true, alphaHash: false, opacity: 0.8, glow: 0.85 })));
    view.light.ceiling = 0;
    await frames(1);
    expect(state([...furniture, ...clothing])).toEqual([...furniture, ...clothing].map(() => ({ transparent: true, alphaHash: false, opacity: 0.3, glow: 0 })));
  });

  it("D6 그 밖의 마을 그리기: bld-* 묶음 밖의 메시(소품·생울타리·울타리·풍차·나무·불빛 판) 재질은 alphaHash를 켜지 않고, 건물이 옅어졌다 돌아오는 동안 transparent·불투명도·version이 첫 프레임 그대로다", async () => {
    const view = await draw(VILLAGE_START);
    await frames(1);
    const meshes = otherMeshes(view.root);
    expect(meshes.length).toBeGreaterThan(0);
    const mats = [...new Set(materialsOf(meshes))];
    const snap = () => mats.map((m) => ({ name: m.name, uuid: m.uuid, alphaHash: m.alphaHash, transparent: m.transparent, opacity: m.opacity, version: m.version }));
    const first = snap();
    expect(first.filter((s) => s.alphaHash)).toEqual([]);
    for (const at of [behindHome(), BEHIND_FURNITURE, BEHIND_CLOTHING, VILLAGE_START]) {
      moveTo(view, at);
      await frames(10);
      expect(snap()).toEqual(first);
    }
  });
});
