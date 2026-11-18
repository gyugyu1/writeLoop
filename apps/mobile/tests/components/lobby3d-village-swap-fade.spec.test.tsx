// [spec] qa 테스트(작업 109 건물 옅게 재질 교체, 기능 변경, 모바일): 라룹이를 가리는 마을 건물을 미리 만든 반투명 재질로 바꿔 끼워 옅게 하는 방식.
// 기대값은 명세(private 작업 폴더 109-2026-11-18-건물-옅게-재질교체/01-main-spec.md)의 바뀌는 동작 2·3과 그대로여야 할 동작에서만 가져온다.
// 그대로 둘 동작의 값(옅어지는 빠르기)은 기준 커밋 4bad985의 지금 동작(lobby3d-village.tsx의 FADED_OPACITY 0.35, FADE_SECONDS 0.25)에서 가져왔다.
// 구현 코드는 부르는 방법(VillageModel 속성 sim·daylight·pickTargets, 모델을 react-three-fiber useLoader(GLTFLoader)로 읽어 복제하는 것,
// 프레임마다 useFrame으로 가리기를 바꾸는 것, 장면을 <primitive object>로 넘기는 것)과 저장소가 셰이더를 미리 만드는 방법
// (lobby3d-canvas.tsx warmUpScenes의 gl.compile)을 알려고만 읽었다.
//
// 어떻게 보나(108 qa 테스트 lobby3d-village-dither-fade.spec.test.tsx와 같은 방법에 가짜 그리개(renderer)를 더했다):
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 저장소의 진짜 마을 모델(lobby-village.glb)을 이 테스트가 직접 풀어 만든 장면을 준다(108 qa 테스트와 같은 풀기).
// - 가짜 useThree와 프레임 상태는 같은 상태 { gl, camera, scene, size }를 준다(useThree(선택 함수)도 받는다). gl은 가짜 그리개로,
//   three.js가 셰이더를 미리 만드는 compile(scene, camera, targetScene)·compileAsync(같은 인자)를 부르면 그때 넘긴 장면 아래 메시마다
//   (재질, 꼭짓점 색 성분 수(없으면 0))를 적어 둔다. three.js compile은 넘긴 장면 아래 메시의 재질을 모두 준비하고, 빛·안개는 targetScene(없으면 넘긴 장면)에서 모은다.
//   진짜 앱에서는 마을 뿌리가 react-three-fiber 장면 안에 들어 있으므로, 넘긴 장면이 그 장면(state.scene)이면 마을 모델을 복제한 뿌리도 그 아래로 보고 함께 적는다.
// - 가짜 useFrame은 마지막으로 받은 프레임 함수를 적어 두고, 테스트가 delta 0.1초로 부른다.
// - "건물 메시" = 그린 장면 뿌리의 bld-* 묶음 아래 메시 가운데 유리가 아닌 메시. "유리" = 도형이 모델의 유리 재질(이름이 glass로 시작) 메시와 같은 메시.
// - "불투명 재질" = 라룹이를 가리지 않는 자리에서 첫 프레임 뒤 건물 메시가 가진 재질. "반투명 재질" = 옅어질 때 그 메시에 바꿔 끼운 재질.
// - "보이는 불투명도" = 그 프레임에 메시가 가진 재질의 opacity.
//
// 바뀔 동작(구현 전 실패): S1, S2, P1, P2. 그대로 둘 동작(구현 전·뒤 통과): K1, K2, K3.
// 명세의 "그 때문에 고칠 기존 테스트"는 lobby3d-village-dither-fade.spec.test.tsx D1~D3, lobby3d-village-home-model.spec.test.tsx R4,
// lobby3d-village-shops-glass.spec.test.tsx G3을 고쳤다(바뀔 동작).
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
type CompilePair = { material: THREE.Material; colorSize: number };
type CompileCall = { method: string; target: unknown; pairs: CompilePair[] };

const mockFrame: { current: FramePart | null } = { current: null };
const mockGltf: { value: unknown } = { value: null };
const mockThree: { state: Record<string, unknown> } = { state: {} };

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
    useThree: (select?: (state: unknown) => unknown) => (select ? select(mockThree.state) : mockThree.state),
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


// ---------- 가짜 그리개 ----------

const compiles: CompileCall[] = [];
const clones: THREE.Object3D[] = [];
const matsOf = (o: THREE.Mesh) => (Array.isArray(o.material) ? o.material : [o.material]);
const colorSize = (mesh: THREE.Mesh) => mesh.geometry.getAttribute("color")?.itemSize ?? 0;

function fakeRenderer(scene: THREE.Scene) {
  const record = (method: string) => (target: THREE.Object3D, _camera: unknown, targetScene: THREE.Object3D | null = null) => {
    const pairs: CompilePair[] = [];
    const visit = (from: THREE.Object3D) =>
      from.traverse((o) => {
        if (o instanceof THREE.Mesh) for (const m of matsOf(o)) pairs.push({ material: m, colorSize: colorSize(o) });
      });
    visit(target);
    // 진짜 앱에서는 마을 뿌리가 react-three-fiber 장면 안에 있다(머리말)
    if (target === scene) for (const c of clones) if (c.parent === null) visit(c);
    compiles.push({ method, target: targetScene ?? target, pairs });
    return method === "compileAsync" ? Promise.resolve(target) : new Set(pairs.map((p) => p.material));
  };
  return {
    compile: jest.fn(record("compile")),
    compileAsync: jest.fn(record("compileAsync")),
    initTexture: jest.fn(),
    capabilities: { getMaxAnisotropy: () => 1 }
  };
}

// ---------- 그리기 ----------

type Drawn = { root: THREE.Object3D; pick: MutableRefObject<THREE.Object3D[]>; sim: { x: number; z: number; reduceMotion: boolean } };

async function draw(at: { x: number; z: number }): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const simState = { x: at.x, z: at.z, reduceMotion: true };
  const light = { ceiling: 0, target: { season: "summer" } };
  const view = await render(<VillageModel sim={simState as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />);
  const primitives = view.container.queryAll((instance: TestInstance) => instance.type === "primitive");
  expect(primitives).toHaveLength(1);
  const root = (primitives[0].props as { object: THREE.Object3D }).object;
  return { root, pick, sim: simState };
}

async function frames(count: number, each?: () => void) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) {
      mockFrame.current!(mockThree.state, 0.1);
      each?.();
    }
  });
}

function moveTo(view: Drawn, at: { x: number; z: number }) {
  view.sim.x = at.x;
  view.sim.z = at.z;
}

/** 모델의 유리 재질 메시의 도형(그린 장면은 원본을 복제해 도형을 함께 쓴다). */
function glassGeometries(): Set<THREE.BufferGeometry> {
  const out = new Set<THREE.BufferGeometry>();
  (mockGltf.value as { scene: THREE.Object3D }).scene.traverse((o) => {
    if (o instanceof THREE.Mesh && GLASS_MATERIAL.test((o.material as THREE.Material).name)) out.add(o.geometry);
  });
  return out;
}

const HOME = "bld-home";
const FURNITURE = "bld-furnitureShop";
const CLOTHING = () => `bld-${clothingId()}`;
const BUILDING_GROUPS = () => [HOME, FURNITURE, CLOTHING()];

/** 그린 장면 뿌리의 bld-* 묶음마다 유리 메시와 건물 메시. 집·가구점·옷집 묶음이 모두 있어야 하고, 건물 메시는 재질을 하나씩 가진다. */
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
    expect({ name, building: building.length > 0, oneMaterialEach: building.every((m) => !Array.isArray(m.material)) }).toEqual({ name, building: true, oneMaterialEach: true });
    out.set(name, { glass, building });
  }
  return out;
}

/** 물체가 든 bld-* 묶음 이름(없으면 null). */
function groupNameOf(o: THREE.Object3D): string | null {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n.name.startsWith("bld-") && !n.name.endsWith("-mesh")) return n.name;
  return null;
}

const home = () => VILLAGE_BUILDINGS.find((b) => b.id === "home")!;
/** 집 바로 뒤(뒷면에서 0.5칸): 098 qa R4와 같은 자리. */
const behindHome = () => ({ x: home().doorX, z: home().rect[1] - 0.5 });
/** 106 qa G3과 같은 자리. */
const BEHIND_FURNITURE = { x: 11, z: 24.5 };
const BEHIND_CLOTHING = { x: 47, z: 15.5 };
const behind = (): [{ x: number; z: number }, string][] => [
  [behindHome(), HOME],
  [BEHIND_FURNITURE, FURNITURE],
  [BEHIND_CLOTHING, CLOTHING()]
];

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const shaderValues = (m: THREE.Material) => ({ transparent: m.transparent, alphaHash: m.alphaHash, version: m.version });

beforeEach(() => {
  mockFrame.current = null;
  compiles.length = 0;
  clones.length = 0;
  const source = sceneFromGlb(nowVillageGlb());
  // 마을 모델을 복제한 뿌리를 적어 둔다(가짜 그리개가 react-three-fiber 장면 안의 마을 뿌리로 본다)
  source.clone = ((recursive?: boolean) => {
    const copy = THREE.Group.prototype.clone.call(source, recursive);
    clones.push(copy);
    return copy;
  }) as typeof source.clone;
  mockGltf.value = { scene: source };
  const scene = new THREE.Scene();
  mockThree.state = { gl: fakeRenderer(scene), camera: new THREE.PerspectiveCamera(), scene, size: { width: 400, height: 800 } };
});

describe("[spec] 109 바뀔 동작: 건물은 미리 만든 반투명 재질로 바꿔 끼워 옅어진다(명세 2·3)", () => {
  it("S1 바꿔 끼우기(명세 2): 가리지 않는 자리에서 첫 프레임 뒤 집 뒤로 가면, 0.1초 프레임마다 집 건물 메시는 불투명 재질이 아닌 반투명 재질(transparent true)을 갖고 보이는 불투명도가 0.74 → 0.48 → 0.35 → 0.35로 내려간다. 벗어나면 반투명 재질인 채 0.61 → 0.87로 올라 1에 닿고, 그다음 프레임부터는 불투명 재질(같은 재질, transparent false, 불투명도 1)로 돌아와 있다", async () => {
    expect(occludingBuildings(VILLAGE_START)).toEqual([]);
    expect(occludingBuildings(behindHome())).toEqual(["home"]);
    const view = await draw(VILLAGE_START);
    await frames(1);
    const homeMeshes = buildingGroups(view.root).get(HOME)!.building;
    const opaque = new Map(homeMeshes.map((m) => [m, m.material as THREE.Material]));
    const rows: { swapped: boolean; transparent: boolean; opacity: number }[][] = [];
    const record = () =>
      rows.push(
        homeMeshes.map((m) => {
          const now = m.material as THREE.Material;
          return { swapped: now !== opaque.get(m), transparent: now.transparent, opacity: round(now.opacity) };
        })
      );
    moveTo(view, behindHome());
    await frames(4, record);
    moveTo(view, VILLAGE_START);
    await frames(5, record);
    const faded = (opacity: number) => homeMeshes.map(() => ({ swapped: true, transparent: true, opacity }));
    const back = homeMeshes.map(() => ({ swapped: false, transparent: false, opacity: 1 }));
    expect(rows.slice(0, 6)).toEqual([faded(0.74), faded(0.48), faded(0.35), faded(0.35), faded(0.61), faded(0.87)]);
    // 1에 닿는 프레임: 보이는 불투명도는 1이다(그 프레임에 되돌리는지 다음 프레임에 되돌리는지는 명세에 없어 보지 않는다)
    expect(rows[6].map((r) => r.opacity)).toEqual(homeMeshes.map(() => 1));
    expect(rows.slice(7)).toEqual([back, back]);
  });

  it("S2 미리 하나(명세 2): 집이 두 번 옅어져도 같은 반투명 재질을 다시 쓰고, 그 사이 반투명 재질의 transparent(true)·alphaHash(false)·version이 그대로다. 불투명 재질도 끝까지 transparent(false)·alphaHash(false)·version이 첫 프레임 그대로이고 돌아오면 그 재질이다. 집·가구점·옷집의 반투명 재질은 건물끼리 서로 다르고, 불투명 재질·유리 재질과도 다르다", async () => {
    const view = await draw(VILLAGE_START);
    await frames(1);
    const groups = buildingGroups(view.root);
    const entries = [...groups].flatMap(([name, { building }]) => building.map((mesh) => ({ name, mesh, opaque: mesh.material as THREE.Material })));
    const opaqueFirst = new Map(entries.map((e) => [e.opaque, shaderValues(e.opaque)]));
    const glass = new Set([...groups.values()].flatMap((g) => g.glass.flatMap(matsOf)));
    const nowOf = (name: string) => groups.get(name)!.building.map((m) => m.material as THREE.Material);

    moveTo(view, behindHome());
    await frames(10);
    const homeFirst = nowOf(HOME);
    const homeFirstValues = homeFirst.map(shaderValues);
    expect(homeFirstValues.map((v) => ({ transparent: v.transparent, alphaHash: v.alphaHash }))).toEqual(homeFirst.map(() => ({ transparent: true, alphaHash: false })));
    moveTo(view, VILLAGE_START);
    await frames(10);
    moveTo(view, behindHome());
    await frames(10);
    const homeSecond = nowOf(HOME);
    expect(homeSecond.map((m, i) => ({ same: m === homeFirst[i], ...shaderValues(m) }))).toEqual(homeFirstValues.map((v) => ({ same: true, ...v })));

    const twins = new Map<string, THREE.Material[]>([[HOME, homeFirst]]);
    for (const [at, name] of behind().slice(1)) {
      moveTo(view, at);
      await frames(10);
      twins.set(name, nowOf(name));
    }
    moveTo(view, VILLAGE_START);
    await frames(10);
    for (const e of entries) {
      expect({ name: e.name, back: e.mesh.material === e.opaque, ...shaderValues(e.opaque) }).toEqual({
        name: e.name,
        back: true,
        transparent: false,
        alphaHash: false,
        version: opaqueFirst.get(e.opaque)!.version
      });
    }
    const owner = new Map<THREE.Material, Set<string>>();
    for (const [name, ms] of twins) for (const m of ms) owner.set(m, (owner.get(m) ?? new Set()).add(name));
    for (const [m, names] of owner) {
      expect({ owners: [...names], isOpaque: opaqueFirst.has(m), isGlass: glass.has(m) }).toEqual({ owners: [...names].slice(0, 1), isOpaque: false, isGlass: false });
    }
  });

  it("P1 미리 컴파일(명세 3): 마을을 처음 그릴 때(그린 뒤 첫 프레임까지) 그리개의 compile이나 compileAsync가 불리고, 집·가구점·옷집이 옅어질 때 바꿔 끼우는 반투명 재질이 모두 그때 넘긴 장면 안에 들어 있다", async () => {
    const view = await draw(VILLAGE_START);
    await frames(1);
    expect(compiles.length).toBeGreaterThan(0);
    const early = new Set(compiles.flatMap((c) => c.pairs.map((p) => p.material)));
    for (const [at, name] of behind()) {
      moveTo(view, at);
      await frames(10);
      for (const mesh of buildingGroups(view.root).get(name)!.building) {
        const m = mesh.material as THREE.Material;
        expect({ name, mesh: mesh.name, transparent: m.transparent, compiledAtFirstDraw: early.has(m) }).toEqual({ name, mesh: mesh.name, transparent: true, compiledAtFirstDraw: true });
      }
      moveTo(view, VILLAGE_START);
      await frames(10);
    }
  });

  it("P2 미리 만든 셰이더가 옅어질 때 쓰는 것과 같다(명세 3 '처음 옅어질 때 컴파일로 끊기지 않게'): 처음 그릴 때의 compile·compileAsync 가운데 빛·안개를 마을이 그려지는 장면(state.scene)에서 모으는 부름(targetScene, 없으면 넘긴 장면이 그 장면)에, 반투명 재질이 그 메시와 같은 꼭짓점 색 성분 수로 들어 있다", async () => {
    const view = await draw(VILLAGE_START);
    await frames(1);
    const scene = mockThree.state.scene;
    const early = compiles.filter((c) => c.target === scene).flatMap((c) => c.pairs);
    for (const [at, name] of behind()) {
      moveTo(view, at);
      await frames(10);
      for (const mesh of buildingGroups(view.root).get(name)!.building) {
        const m = mesh.material as THREE.Material;
        const size = colorSize(mesh);
        expect({ name, mesh: mesh.name, transparent: m.transparent, colorSize: size, compiledLikeDrawn: early.some((p) => p.material === m && p.colorSize === size) }).toEqual({
          name,
          mesh: mesh.name,
          transparent: true,
          colorSize: size,
          compiledLikeDrawn: true
        });
      }
      moveTo(view, VILLAGE_START);
      await frames(10);
    }
  });
});

describe("[spec] 109 그대로 둘 동작: 누르기, 옅어지는 빠르기, 가게 유리", () => {
  it("K1 누르기(재질을 바꿔도 누르기 대상은 그대로): 집·가구점·옷집이 옅어진 동안과 돌아온 뒤에도 누르기 대상(pickTargets)은 첫 프레임과 같은 물체가 같은 순서로 들어 있고, 옅어진 건물 한가운데 위에서 내리쏜 광선은 누르기 대상 가운데 그 건물에 처음 닿는다", async () => {
    const view = await draw(VILLAGE_START);
    await frames(1);
    const first = [...view.pick.current];
    expect(first.length).toBeGreaterThan(0);
    const same = () => view.pick.current.length === first.length && view.pick.current.every((o, i) => o === first[i]);
    const groups = buildingGroups(view.root);
    for (const [at, name] of behind()) {
      moveTo(view, at);
      await frames(10);
      view.root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const m of groups.get(name)!.building) box.expandByObject(m);
      const center = box.getCenter(new THREE.Vector3());
      const ray = new THREE.Raycaster(new THREE.Vector3(center.x, box.max.y + 5, center.z), new THREE.Vector3(0, -1, 0));
      const hits = ray.intersectObjects(view.pick.current, true);
      expect({ name, samePick: same(), firstHit: hits.length > 0 ? groupNameOf(hits[0].object) : null }).toEqual({ name, samePick: true, firstHit: name });
    }
    moveTo(view, VILLAGE_START);
    await frames(10);
    expect(same()).toBe(true);
  });

  it("K2 빠르기(0.25초에 걸쳐 0.35까지, 같은 빠르기로 돌아옴): 집 뒤에서 그리면 0.1초 프레임마다 집 건물 메시의 보이는 불투명도가 0.74 → 0.48 → 0.35 → 0.35, 벗어나면 0.61 → 0.87 → 1 → 1이고, 그동안 다른 건물의 보이는 불투명도는 1이다", async () => {
    const view = await draw(behindHome());
    const groups = buildingGroups(view.root);
    const homeMeshes = groups.get(HOME)!.building;
    const others = BUILDING_GROUPS()
      .filter((n) => n !== HOME)
      .flatMap((n) => groups.get(n)!.building);
    const seen: number[][] = [];
    const otherSeen: number[] = [];
    const record = () => {
      seen.push(homeMeshes.map((m) => round((m.material as THREE.Material).opacity)));
      otherSeen.push(...others.map((m) => (m.material as THREE.Material).opacity));
    };
    await frames(4, record);
    moveTo(view, VILLAGE_START);
    await frames(4, record);
    expect(seen).toEqual([0.74, 0.48, 0.35, 0.35, 0.61, 0.87, 1, 1].map((v) => homeMeshes.map(() => v)));
    expect(otherSeen.every((v) => v === 1)).toBe(true);
  });

  it("K3 가게 유리(명세 1 '가게 유리는 빼고', 그대로여야 할 동작): 가구점·옷집이 옅어졌다 돌아오는 동안 유리 메시는 첫 프레임의 유리 재질을 그대로 갖고(바꿔 끼우지 않는다) 반투명(transparent)이며, 낮에 그 건물이 옅어지면 유리 불투명도는 0.3 × 0.35, 돌아오면 0.3이다", async () => {
    const view = await draw(VILLAGE_START);
    await frames(1);
    const groups = buildingGroups(view.root);
    for (const [at, name] of behind().slice(1)) {
      const glass = groups.get(name)!.glass;
      expect({ name, glass: glass.length > 0 }).toEqual({ name, glass: true });
      const firstMats = glass.map((m) => m.material);
      const state = () => glass.map((m, i) => ({ same: m.material === firstMats[i], transparent: (m.material as THREE.Material).transparent, opacity: round((m.material as THREE.Material).opacity) }));
      moveTo(view, at);
      await frames(10);
      expect({ name, glass: state() }).toEqual({ name, glass: glass.map(() => ({ same: true, transparent: true, opacity: round(0.3 * 0.35) })) });
      moveTo(view, VILLAGE_START);
      await frames(10);
      expect({ name, glass: state() }).toEqual({ name, glass: glass.map(() => ({ same: true, transparent: true, opacity: 0.3 })) });
    }
  });
});
