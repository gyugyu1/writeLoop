// [spec] qa 테스트(작업 098 마을 라룹이 집 교체, 기능 변경, 모바일): 마을 모델을 그리는 VillageModel이 라룹이 집(bld-home)을 다루는 방식.
// 기대값은 명세(private 작업 폴더 098-2026-11-17-마을-라룹이-집-교체/01-main-spec.md)의 "7. 그리기"와 "그대로여야 할 동작"에서만 가져온다.
// 모두 그대로 둘 동작이다(구현 전·뒤 통과): 지금 2층 집도 같은 방식으로 그려지고, 새 집도 묶음 이름 bld-home 그대로 같은 방식이어야 한다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageModel 속성 sim·daylight·pickTargets, 모델을 require해 react-three-fiber useLoader(GLTFLoader)로
// 읽는 것, 프레임마다 useFrame으로 가리기·불빛을 바꾸는 것)을 알려고만 읽었다.
//
// 어떻게 보나:
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 저장소의 진짜 마을 모델(apps/mobile/assets/models/lobby-village.glb)을 이 테스트가 직접 풀어
//   만든 장면을 준다(노드 이름·부모 자식·변환·점 자리·재질 색·색 그림 유무를 glb 그대로. 그림 픽셀은 풀지 않고 빈 THREE.Texture로 둔다.
//   GLTFLoader처럼 프리미티브가 둘 이상인 메시 노드는 그 이름의 묶음 아래 메시 여럿, 하나면 그 이름의 메시 하나로 만든다).
// - 가짜 useFrame은 마지막으로 받은 프레임 함수를 적어 두고, 테스트가 delta 0.1초로 부른다.
// - "집의 메시" = 장면 뿌리의 bld-home 묶음 아래 메시. "다른 건물" = bld-furnitureShop·bld-cafe·bld-library 아래 메시.
//
// 작업 106(마을 가게 넣기) 명세의 "그 때문에 고칠 기존 테스트"(카페·도서관 건물, 마을 모델 묶음 이름)와 바뀌는 동작 5(가게 유리는 반투명, 누르기 대상이 아님)로
// qa가 고쳤다(106 qa 보고 02-qa-tests.md):
// - "다른 건물": bld-furnitureShop·bld-cafe·bld-library → bld-furnitureShop·bld-<옷집 id>(옷집 id는 명세에 없어 이름 "옷집"으로 찾는다).
// - R2·R4에서 다른 건물의 메시 가운데 모델의 유리 재질(이름이 glass로 시작)을 쓰는 메시는 뺀다(유리는 106 명세 5로 반투명하게 그린다. 유리는 106 qa 테스트
//   lobby3d-village-shops-glass.spec.test.tsx가 본다). 집과 다른 건물의 나머지 메시에 대한 단언은 그대로다.
//
// 작업 108(건물 옅게 디더링, 기능 변경) 명세의 "그 때문에 고칠 기존 테스트"와 바뀌는 동작 1(건물 재질은 처음부터 디더링(alphaHash)을 켠 불투명 재질이고,
// 가리면 불투명도만 1→0.35로 바꾸며 transparent는 켜고 끄지 않는다)로 qa가 R4를 고쳤다(108 qa 보고):
// - 옅어진 집: { opacity 0.35, transparent true } → { opacity 0.35, transparent false, alphaHash true }.
// - 다른 건물과 돌아온 집: { opacity 1, transparent false } → { opacity 1, transparent false, alphaHash true }.
//   가리는 자리, 프레임 수, 불투명도 값은 그대로다.
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
const mockLoads: { loader: unknown; url: string }[] = [];
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
    useLoader: Object.assign((loaderClass: unknown, url: unknown) => {
      mockLoads.push({ loader: loaderClass, url: String(url) });
      return mockGltf.value;
    }, loader)
  };
});

// ---------- 진짜 마을 모델을 장면으로 ----------

/** glb에서 색 그림이 있는 재질이 받은 그림(테스트가 만든 빈 그림)들. */
const glbTextures = new Set<THREE.Texture>();

function sceneFromGlb(glb: Glb): THREE.Group {
  const textures = new Map<number, THREE.Texture>();
  const materials = (glb.json.materials ?? []).map((m) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = m.name ?? "";
    const factor = m.pbrMetallicRoughness?.baseColorFactor;
    if (factor) material.color.setRGB(factor[0], factor[1], factor[2]);
    const ref = m.pbrMetallicRoughness?.baseColorTexture;
    if (ref) {
      if (!textures.has(ref.index)) {
        const texture = new THREE.Texture();
        textures.set(ref.index, texture);
        glbTextures.add(texture);
      }
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

// VillageModel은 프레임마다 sim의 자리(x, z)와 daylight의 천장 조명(ceiling)을 읽는다. 그래서 다시 그리지 않고 이 두 물체의 값을 바꿔 프레임을 돌린다.
type Drawn = { root: THREE.Object3D; pick: MutableRefObject<THREE.Object3D[]>; sim: { x: number; z: number; reduceMotion: boolean }; light: { ceiling: number; target: { season: string } } };

async function draw(at: { x: number; z: number }, ceiling = 0): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const simState = { x: at.x, z: at.z, reduceMotion: true };
  const light = { ceiling, target: { season: "summer" } };
  const view = await render(<VillageModel sim={simState as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />);
  const primitives = view.container.queryAll((instance: TestInstance) => instance.type === "primitive");
  expect(primitives).toHaveLength(1);
  const root = (primitives[0].props as { object: THREE.Object3D }).object;
  return { root, pick, sim: simState, light };
}

async function frames(count: number) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) mockFrame.current!({}, 0.1);
  });
}

/** 그린 장면 뿌리에서 이름이 name인 묶음 아래 메시들. */
function meshesUnder(root: THREE.Object3D, name: string): THREE.Mesh[] {
  const group = root.children.find((c) => c.name === name);
  expect({ name, found: group !== undefined }).toEqual({ name, found: true });
  const out: THREE.Mesh[] = [];
  group!.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

const materialsOf = (meshes: THREE.Mesh[]) => meshes.flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]));
const OTHER_BUILDINGS = ["bld-furnitureShop", `bld-${clothingId()}`];

/** 모델의 유리 재질(이름이 glass로 시작)을 쓰는 원본 메시의 도형(그린 장면은 원본을 복제해 도형을 함께 쓴다). */
function glassGeometries(): Set<THREE.BufferGeometry> {
  const out = new Set<THREE.BufferGeometry>();
  (mockGltf.value as { scene: THREE.Object3D }).scene.traverse((o) => {
    if (o instanceof THREE.Mesh && GLASS_MATERIAL.test((o.material as THREE.Material).name)) out.add(o.geometry);
  });
  return out;
}
const notGlass = (meshes: THREE.Mesh[]) => {
  const glass = glassGeometries();
  return meshes.filter((m) => !glass.has(m.geometry));
};

beforeEach(() => {
  mockFrame.current = null;
  mockLoads.length = 0;
  glbTextures.clear();
  mockGltf.value = { scene: sceneFromGlb(nowVillageGlb()) };
});

describe("[spec] 098 그대로 둘 동작: 마을 모델 그리기와 라룹이 집(bld-home)", () => {
  it("R1 마을 모델 파일 이름과 앱이 불러오는 방식 그대로: GLTFLoader로 lobby-village.glb 하나를 읽는다", async () => {
    await draw(VILLAGE_START);
    const { GLTFLoader } = jest.requireMock<{ GLTFLoader: unknown }>("three/examples/jsm/loaders/GLTFLoader.js");
    expect(mockLoads.length).toBeGreaterThan(0);
    expect(mockLoads.every((l) => l.loader === GLTFLoader && l.url === "lobby-village.glb")).toBe(true);
  });

  it("R2 그리기(명세 7): 집의 메시는 다른 건물처럼 모델의 색 그림을 그대로 쓰는 Lambert 재질이고, 모델 바탕색 곱은 쓰지 않으며(재질 색 흰색), 외곽선 메시를 더하지 않는다", async () => {
    const sourceHomeMeshes = meshesUnder((mockGltf.value as { scene: THREE.Object3D }).scene, "bld-home").length;
    const { root } = await draw(VILLAGE_START);
    const home = meshesUnder(root, "bld-home");
    expect(home.length).toBe(sourceHomeMeshes);
    const look = (m: THREE.Material) => ({
      lambert: m instanceof THREE.MeshLambertMaterial,
      colorMapFromModel: glbTextures.has((m as THREE.MeshLambertMaterial).map as THREE.Texture),
      color: (m as THREE.MeshLambertMaterial).color?.getHex(),
      side: m.side
    });
    const want = { lambert: true, colorMapFromModel: true, color: 0xffffff, side: THREE.FrontSide };
    for (const m of materialsOf(home)) expect(look(m)).toEqual(want);
    for (const name of OTHER_BUILDINGS) for (const m of materialsOf(notGlass(meshesUnder(root, name)))) expect({ name, ...look(m) }).toEqual({ name, ...want });
  });

  it("R3 집을 누르면: 집의 메시가 모두 누르기 판정 대상(pickTargets)에 들어 있다", async () => {
    const { root, pick } = await draw(VILLAGE_START);
    const home = meshesUnder(root, "bld-home");
    expect(home.length).toBeGreaterThan(0);
    expect(home.every((m) => pick.current.includes(m))).toBe(true);
  });

  it("R4 라룹이를 가리면 집이 점무늬(디더링, alphaHash)로 옅어진다(불투명도 0.35까지 옅어지고, 벗어나면 돌아온다. transparent는 켜지 않는다). 다른 건물은 불투명도 1 그대로다(108에서 고침)", async () => {
    const home = VILLAGE_BUILDINGS.find((b) => b.id === "home")!;
    // 집 바로 뒤(뒷면에서 0.5칸): 데이터로 가리는 건물이 집인 자리
    const behind = { x: home.doorX, z: home.rect[1] - 0.5 };
    expect(occludingBuildings(behind)).toEqual(["home"]);
    expect(occludingBuildings(VILLAGE_START)).toEqual([]);
    const view = await draw(behind);
    await frames(10);
    const homeMaterials = materialsOf(meshesUnder(view.root, "bld-home"));
    expect(homeMaterials.length).toBeGreaterThan(0);
    for (const m of homeMaterials) expect({ opacity: m.opacity, transparent: m.transparent, alphaHash: m.alphaHash }).toEqual({ opacity: 0.35, transparent: false, alphaHash: true });
    for (const name of OTHER_BUILDINGS) for (const m of materialsOf(notGlass(meshesUnder(view.root, name)))) expect({ name, opacity: m.opacity, transparent: m.transparent, alphaHash: m.alphaHash }).toEqual({ name, opacity: 1, transparent: false, alphaHash: true });
    view.sim.x = VILLAGE_START.x;
    view.sim.z = VILLAGE_START.z;
    await frames(10);
    for (const m of homeMaterials) expect({ opacity: m.opacity, transparent: m.transparent, alphaHash: m.alphaHash }).toEqual({ opacity: 1, transparent: false, alphaHash: true });
  });

  it("R5 밤 불빛(명세 6, 가로등 불빛 그대로): 가로등 불빛 넷(glow-lamp-0~3)은 밤(천장 조명 1)에 보이고 낮(0)에는 보이지 않는다", async () => {
    const night = await draw(VILLAGE_START, 1);
    await frames(1);
    const lamps = [0, 1, 2, 3].flatMap((i) => meshesUnder(night.root, `glow-lamp-${i}`));
    expect(lamps.length).toBeGreaterThanOrEqual(4);
    expect(lamps.map((m) => m.visible)).toEqual(lamps.map(() => true));
    night.light.ceiling = 0;
    await frames(1);
    expect(lamps.map((m) => m.visible)).toEqual(lamps.map(() => false));
  });
});
