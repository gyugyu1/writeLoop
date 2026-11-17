// [spec] qa 테스트(작업 099 마을 길 둥글게, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature·VillageModel)에서 본 길.
// 기대값은 명세(private 작업 폴더 099-2026-11-17-마을-길-둥글게/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 1144c47의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, 모델을 require해
// react-three-fiber useLoader(GLTFLoader)로 읽는 것, useFrame으로 계절·가리기·불빛을 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): P1~P5. 그대로 둘 동작(구현 전·뒤 통과): K1~K3.
//
// 어떻게 보나:
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 저장소의 진짜 마을 모델(lobby-village.glb)을 이 테스트가 직접 풀어 만든 장면을 준다
//   (098 테스트 lobby3d-village-home-model.spec.test.tsx와 같은 방법. 그림 픽셀은 풀지 않고 빈 THREE.Texture로 둔다).
// - VillageNature와 VillageModel을 마을 화면(lobby3d-canvas의 VillageLayer)처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
//   둥근 길을 어느 쪽이 그리는지는 명세가 정하지 않아 가리지 않는다.
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 delta 0.1초로 모두 부른다.
// - "그려진다" = 메시와 그 위 모든 부모의 visible이 true다(떼어 내 장면에 없으면 그려지지 않는다).
// - "둥근 길 판" = 그린 장면의 메시(인스턴스 메시 빼고) 가운데 마을 모델에서 온 모양(glb 메시의 도형)이 아니고, 모든 점이 땅 높이
//   (풀밭 y −0.02보다 위, 0.1 이하)에 있으며, 가로·깊이로 마을 안(0~70, 0~60)에 드는 것. 풀밭 판(y −0.02, 마을보다 넓다)과 나무·풍차 날개는 여기에 들지 않는다.
// - 길 색: 지금 길(Kenney 길 조각 road)의 윗면은 마을 모델의 색 그림 writeloop-village-colormap(UV 0.156, 0.625)의 #dcbd8e를 꼭짓점 색 1.0(흰색)으로
//   곱한 Lambert 재질이다(기준 커밋의 glb에서 잰 값: 윗면 꼭짓점 1169개 중 689개가 1.0, 나머지는 돌 틈 그늘). 그래서 "같은 흙색"을
//   Lambert 재질로 칠한 #dcbd8e로 본다. 판의 색은 재질 색 × 꼭짓점 색(재질이 vertexColors이고 도형에 color가 있을 때)으로 계산한다.
//   무늬 그림을 넣지 않으므로(명세 2) 판 재질에 색 그림(map)이 없어야 한다.
// - 한 자리에 판이 여럿 겹치면 renderOrder가 큰 것, 같으면 그 자리 높이(y)가 높은 것이 보이는 것으로 본다.
// - 가장자리 띠(약 0.15칸, 조금 짙게): 둥근 경계에서 0.05칸 안쪽까지는 가운데 색보다 짙고(밝기 0.99배 미만, 0.5배 이상, 어느 채널도 더 밝지 않음),
//   경계에서 0.3칸 넘게 안쪽은 #dcbd8e다. "조금"의 아래 끝 0.5배는 qa가 정한 값이다(02-qa-tests.md 가정).
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import { VillageModel, VillageNature } from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { SEASON_COLORS } from "@/components/lobby3d/lobby3d-outdoor";
import { daylightAt, type Season } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_START } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { accessorValues, nowVillageGlb, sceneRoots, type Glb } from "../__fixtures__/village-glb-098";
import { shapeIndex, tilesOf, type PathShape, type Rect, type RoundedPathShapes } from "../__fixtures__/village-paths-099";

type FramePart = (state: unknown, delta: number) => void;

const mockFrames: FramePart[] = [];
const mockGltf: { value: unknown } = { value: null };
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
jest.mock("@/assets/models/lobby-village.glb", () => "lobby-village.glb");
jest.mock("@react-three/fiber/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const loader = { clear: () => {} };
  return {
    Canvas: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useThree: () => ({ camera: null, scene: mockScene, size: { width: 400, height: 800 } }),
    useFrame: (callback: FramePart) => {
      React.useEffect(() => {
        mockFrames.push(callback);
        return () => {
          const at = mockFrames.indexOf(callback);
          if (at >= 0) mockFrames.splice(at, 1);
        };
      });
    },
    useLoader: Object.assign(() => mockGltf.value, loader)
  };
});

// ---------- 진짜 마을 모델을 장면으로(098 테스트와 같은 방법) ----------

function sceneFromGlb(glb: Glb): THREE.Group {
  const textures = new Map<number, THREE.Texture>();
  const materials = (glb.json.materials ?? []).map((m) => {
    const material = new THREE.MeshStandardMaterial();
    material.name = m.name ?? "";
    const factor = m.pbrMetallicRoughness?.baseColorFactor;
    if (factor) material.color.setRGB(factor[0], factor[1], factor[2]);
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

type Drawn = { roots: THREE.Object3D[]; pick: MutableRefObject<THREE.Object3D[]>; light: Light; source: THREE.Object3D };

async function draw(season: Season = "summer"): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
  const light = lightAt(season);
  const source = (mockGltf.value as { scene: THREE.Object3D }).scene;
  const view = await render(
    <>
      <VillageNature daylight={light as unknown as DaylightState} />
      <VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
    </>
  );
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  expect(roots.length).toBeGreaterThan(0);
  await frames(2);
  return { roots, pick, light, source };
}

async function frames(count: number) {
  await act(async () => {
    for (let i = 0; i < count; i += 1) for (const f of [...mockFrames]) f({}, 0.1);
  });
}

async function setSeason(drawn: Drawn, season: Season) {
  const next = lightAt(season);
  drawn.light.ambience = next.ambience;
  drawn.light.target = next.target;
  await frames(2);
}

function allObjects(roots: THREE.Object3D[]): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  for (const r of roots) {
    r.updateMatrixWorld(true);
    r.traverse((o) => out.push(o));
  }
  return out;
}

/** 메시와 그 위 모든 부모가 보이는가(뿌리는 그린 장면의 primitive). */
function drawnVisible(o: THREE.Object3D, roots: THREE.Object3D[]): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (!n.visible) return false;
    if (roots.includes(n)) return true;
  }
  return false;
}

/** 마을 모델(glb)에서 온 도형들과, 묶음 이름별 도형. */
function sourceGeometries(source: THREE.Object3D) {
  const all = new Set<THREE.BufferGeometry>();
  const byGroup = new Map<string, Set<THREE.BufferGeometry>>();
  for (const top of source.children) {
    const set = new Set<THREE.BufferGeometry>();
    top.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        set.add(o.geometry);
        all.add(o.geometry);
      }
    });
    byGroup.set(top.name, set);
  }
  return { all, byGroup };
}

function worldPositions(mesh: THREE.Mesh): THREE.Vector3[] {
  const pos = mesh.geometry.getAttribute("position");
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += 1) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  return out;
}

/** 둥근 길 판(머리말의 정의). */
function plates(drawn: Drawn): THREE.Mesh[] {
  const fromModel = sourceGeometries(drawn.source).all;
  return allObjects(drawn.roots).filter((o): o is THREE.Mesh => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return false;
    if (fromModel.has(o.geometry) || !drawnVisible(o, drawn.roots)) return false;
    const points = worldPositions(o);
    if (points.length === 0) return false;
    return points.every((p) => p.y > -0.0199 && p.y <= 0.1 && p.x >= 0 && p.x <= VILLAGE.width && p.z >= 0 && p.z <= VILLAGE.depth);
  });
}

type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; ca: THREE.Color; cb: THREE.Color; cc: THREE.Color; order: number };

/** 꼭짓점의 보이는 색(선형): 재질 색 × 꼭짓점 색. 색 그림이 있으면 이 테스트가 계산할 수 없어 실패한다. */
function vertexColors(mesh: THREE.Mesh): THREE.Color[] {
  const material = mesh.material as THREE.MeshLambertMaterial;
  expect({ map: material.map ?? null }).toEqual({ map: null });
  const colorAttr = material.vertexColors ? mesh.geometry.getAttribute("color") : undefined;
  const count = mesh.geometry.getAttribute("position").count;
  const out: THREE.Color[] = [];
  for (let i = 0; i < count; i += 1) {
    const c = material.color.clone();
    if (colorAttr) c.multiply(new THREE.Color(colorAttr.getX(i), colorAttr.getY(i), colorAttr.getZ(i)));
    out.push(c);
  }
  return out;
}

function trianglesOf(meshes: THREE.Mesh[]): Tri[] {
  const out: Tri[] = [];
  for (const mesh of meshes) {
    const points = worldPositions(mesh);
    const colors = vertexColors(mesh);
    const index = mesh.geometry.getIndex();
    const ids = index ? Array.from({ length: index.count }, (_, i) => index.getX(i)) : points.map((_, i) => i);
    for (let i = 0; i + 2 < ids.length; i += 3) {
      const [ia, ib, ic] = [ids[i], ids[i + 1], ids[i + 2]];
      out.push({ a: points[ia], b: points[ib], c: points[ic], ca: colors[ia], cb: colors[ib], cc: colors[ic], order: mesh.renderOrder });
    }
  }
  return out;
}

/** 삼각형들을 1칸 격자로 묶는다(찾기 빠르게). */
function bucketed(tris: Tri[]) {
  const map = new Map<string, Tri[]>();
  for (const t of tris) {
    const minX = Math.floor(Math.min(t.a.x, t.b.x, t.c.x));
    const maxX = Math.floor(Math.max(t.a.x, t.b.x, t.c.x));
    const minZ = Math.floor(Math.min(t.a.z, t.b.z, t.c.z));
    const maxZ = Math.floor(Math.max(t.a.z, t.b.z, t.c.z));
    for (let x = minX; x <= maxX; x += 1) for (let z = minZ; z <= maxZ; z += 1) {
      const k = `${x},${z}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
  }
  return (px: number, pz: number) => map.get(`${Math.floor(px)},${Math.floor(pz)}`) ?? [];
}

/** 점 (x, z)에서 보이는 판의 색(선형)과 높이. 판이 없으면 null. */
function plateAt(find: (x: number, z: number) => Tri[], x: number, z: number): { color: THREE.Color; y: number; order: number } | null {
  let best: { color: THREE.Color; y: number; order: number } | null = null;
  for (const t of find(x, z)) {
    const d = (t.b.z - t.c.z) * (t.a.x - t.c.x) + (t.c.x - t.b.x) * (t.a.z - t.c.z);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / d;
    const v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / d;
    const w = 1 - u - v;
    if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
    const y = u * t.a.y + v * t.b.y + w * t.c.y;
    if (best && (t.order < best.order || (t.order === best.order && y <= best.y))) continue;
    const color = new THREE.Color(u * t.ca.r + v * t.cb.r + w * t.cc.r, u * t.ca.g + v * t.cb.g + w * t.cc.g, u * t.ca.b + v * t.cb.b + w * t.cc.b);
    best = { color, y, order: t.order };
  }
  return best;
}

function loadShapes(): PathShape[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/lobby3d/village-paths") as { roundedPathShapes: RoundedPathShapes };
  return mod.roundedPathShapes(LAYOUT.paths as unknown as Rect[]);
}

/** 선형 색 → 화면 색(0~255 정수 셋). */
const srgb255 = (c: THREE.Color) => {
  const s = c.clone().convertLinearToSRGB();
  return [s.r, s.g, s.b].map((v) => Math.round(v * 255));
};
const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const DIRT = new THREE.Color(0xdcbd8e); // set이 화면 색을 선형으로 바꾼다
const DIRT_255 = [0xdc, 0xbd, 0x8e];
const near = (a: number[], b: number[], tol: number) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

/** 길 안의 점들: 경계에서 0.3칸 넘게 안쪽인 칸 가운데(가운데 색)와, 경계 점마다 0.04칸 안쪽 점(띠 색). */
function samplePoints(shapes: PathShape[]) {
  const index = shapeIndex(shapes);
  const inner: { x: number; z: number }[] = [];
  for (const t of tilesOf(LAYOUT.paths as unknown as Rect[])) {
    const [c, r] = t.split(",").map(Number);
    const p = { x: c + 0.5, z: r + 0.5 };
    if (index.inside(p) && index.distance(p) > 0.3) inner.push(p);
  }
  const edge: { x: number; z: number }[] = [];
  const rings = shapes.flatMap((s) => [s.outer, ...s.holes]);
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 7) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-6) continue;
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      for (const sign of [1, -1]) {
        const p = { x: mid.x + (sign * -(b.z - a.z) * 0.04) / len, z: mid.z + (sign * (b.x - a.x) * 0.04) / len };
        const d = index.distance(p);
        if (index.inside(p) && d >= 0.02 && d <= 0.05) edge.push(p);
      }
    }
  }
  return { inner, edge };
}

jest.setTimeout(180000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  mockGltf.value = { scene: sceneFromGlb(nowVillageGlb()) };
});

// ---------- 바뀔 동작 ----------

describe("[spec] 099 바뀔 동작: 둥근 길 그리기(명세 1~3)", () => {
  it("P1 옛 길 숨기기(명세 3): 마을 모델의 묶음 paths(Kenney 길 조각) 메시는 그려지지 않는다", async () => {
    const drawn = await draw();
    const oldPaths = sourceGeometries(drawn.source).byGroup.get("paths");
    expect(oldPaths && oldPaths.size > 0).toBe(true);
    const shown = allObjects(drawn.roots).filter((o) => o instanceof THREE.Mesh && oldPaths!.has(o.geometry) && drawnVisible(o, drawn.roots));
    expect(shown.map((o) => o.name)).toEqual([]);
  });

  it("P2 둥근 길 판(명세 1·2): 땅 위 판이 있고, 판의 재질은 색 그림 없는 불투명 Lambert 재질이다", async () => {
    const drawn = await draw();
    const found = plates(drawn);
    expect(found.length).toBeGreaterThan(0);
    for (const m of found) {
      const materials = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of materials) {
        expect({
          lambert: mat instanceof THREE.MeshLambertMaterial,
          map: (mat as THREE.MeshLambertMaterial).map ?? null,
          opaque: !mat.transparent && mat.opacity === 1
        }).toEqual({ lambert: true, map: null, opaque: true });
      }
    }
  });

  it("P3 판의 모양(명세 1): 판이 덮는 곳이 배치 파일 paths로 계산한 둥근 경계(roundedPathShapes)의 안과 같다(경계에서 0.05칸 안의 점은 빼고, 0.2칸 간격으로 본다)", async () => {
    const drawn = await draw();
    const find = bucketed(trianglesOf(plates(drawn)));
    const index = shapeIndex(loadShapes());
    const missing: string[] = [];
    const extra: string[] = [];
    for (let x = 10.1; x < 61; x += 0.2) {
      for (let z = 10.1; z < 52; z += 0.2) {
        const p = { x, z };
        if (index.distance(p) < 0.05) continue;
        const want = index.inside(p);
        const got = plateAt(find, x, z) !== null;
        if (want && !got) missing.push(`${x.toFixed(1)},${z.toFixed(1)}`);
        if (!want && got) extra.push(`${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
    expect({ missing: missing.slice(0, 20), missingCount: missing.length, extra: extra.slice(0, 20), extraCount: extra.length }).toEqual({
      missing: [],
      missingCount: 0,
      extra: [],
      extraCount: 0
    });
  });

  it("P4 길 색(명세 2): 경계에서 0.3칸 넘게 안쪽은 지금 길과 같은 흙색 #dcbd8e이고, 경계에서 0.05칸 안쪽까지의 띠는 그보다 조금 짙다", async () => {
    const drawn = await draw();
    const find = bucketed(trianglesOf(plates(drawn)));
    const { inner, edge } = samplePoints(loadShapes());
    expect(inner.length).toBeGreaterThan(50);
    expect(edge.length).toBeGreaterThan(50);
    const wrongInner = inner
      .map((p) => ({ p, hit: plateAt(find, p.x, p.z) }))
      .filter(({ hit }) => !hit || !near(srgb255(hit.color), DIRT_255, 2))
      .map(({ p, hit }) => `${p.x.toFixed(2)},${p.z.toFixed(2)} ${hit ? srgb255(hit.color).join("/") : "판 없음"}`);
    expect(wrongInner.slice(0, 10)).toEqual([]);
    const dirtLum = luminance(DIRT);
    const wrongEdge = edge
      .map((p) => ({ p, hit: plateAt(find, p.x, p.z) }))
      .filter(({ hit }) => {
        if (!hit) return true;
        const lum = luminance(hit.color);
        const notBrighter = hit.color.r <= DIRT.r + 1e-3 && hit.color.g <= DIRT.g + 1e-3 && hit.color.b <= DIRT.b + 1e-3;
        return !(lum < dirtLum * 0.99 && lum >= dirtLum * 0.5 && notBrighter);
      })
      .map(({ p, hit }) => `${p.x.toFixed(2)},${p.z.toFixed(2)} ${hit ? srgb255(hit.color).join("/") : "판 없음"}`);
    expect(wrongEdge.slice(0, 10)).toEqual([]);
  });

  it("P5 길 색은 계절과 관계없이 같다(명세 2): 봄·여름·가을·겨울에 같은 자리의 판 색이 같다", async () => {
    const drawn = await draw("summer");
    const { inner, edge } = samplePoints(loadShapes());
    const points = [...inner.slice(0, 40), ...edge.slice(0, 40)];
    const colorsNow = () => {
      const find = bucketed(trianglesOf(plates(drawn)));
      return points.map((p) => {
        const hit = plateAt(find, p.x, p.z);
        return hit ? srgb255(hit.color).join("/") : "판 없음";
      });
    };
    const summer = colorsNow();
    expect(summer.filter((c) => c === "판 없음")).toEqual([]);
    for (const season of ["autumn", "winter", "spring"] as Season[]) {
      await setSeason(drawn, season);
      expect({ season, colors: colorsNow() }).toEqual({ season, colors: summer });
    }
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 099 그대로 둘 동작: 길 말고는 마을 그리기가 같다", () => {
  it("K1 마을 모델의 다른 묶음(건물·불빛 판·소품·생울타리·울타리·풍차)의 메시는 모두 그대로 장면에 있고, 불빛 판 말고는 그려진다(낮). 나무 틀은 장면에서 떼어 둔다", async () => {
    const drawn = await draw();
    const { byGroup } = sourceGeometries(drawn.source);
    const objects = allObjects(drawn.roots);
    const meshNames = (top: THREE.Object3D) => {
      const out: string[] = [];
      top.traverse((o) => {
        if (o instanceof THREE.Mesh) out.push(o.name);
      });
      return out.sort();
    };
    for (const top of drawn.source.children) {
      const name = top.name;
      if (name === "paths" || name === "tree-templates") continue;
      // 그린 장면에서 같은 이름의 묶음(풍차 날개는 그리기가 도형을 복제해 옮기므로 도형이 아니라 이름으로 찾는다)
      const drawnTops = objects.filter((o) => o.name === name && o.parent !== null && drawn.roots.includes(o.parent));
      expect({ name, found: drawnTops.length }).toEqual({ name, found: 1 });
      expect({ name, meshes: meshNames(drawnTops[0]) }).toEqual({ name, meshes: meshNames(top) });
      const meshes: THREE.Mesh[] = [];
      drawnTops[0].traverse((o) => {
        if (o instanceof THREE.Mesh) meshes.push(o);
      });
      const shouldShow = !name.startsWith("glow");
      expect({ name, shown: meshes.map((m) => drawnVisible(m, drawn.roots)) }).toEqual({ name, shown: meshes.map(() => shouldShow) });
    }
    const templates = byGroup.get("tree-templates")!;
    expect(objects.filter((o) => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && templates.has(o.geometry))).toEqual([]);
  });

  it("K2 누르기(그대로): 누르기 판정 대상은 건물(bld-*)과 소품(props)의 메시뿐이고, 그 밖의 물체(길 포함)는 그 아래에도 없다", async () => {
    const drawn = await draw();
    const { byGroup } = sourceGeometries(drawn.source);
    const allowed = new Set<THREE.BufferGeometry>();
    for (const [name, geometries] of byGroup) if (name.startsWith("bld-") || name === "props") geometries.forEach((g) => allowed.add(g));
    const objects = allObjects(drawn.roots);
    const expected = objects.filter((o) => o instanceof THREE.Mesh && allowed.has(o.geometry));
    expect(drawn.pick.current.length).toBe(expected.length);
    expect(new Set(drawn.pick.current)).toEqual(new Set(expected));
    const strangers: string[] = [];
    for (const target of drawn.pick.current) {
      target.traverse((o) => {
        if (o !== target && o instanceof THREE.Mesh && !allowed.has(o.geometry)) strangers.push(o.name || o.type);
      });
    }
    expect(strangers).toEqual([]);
  });

  it("K3 풀밭과 생울타리의 계절 색(그대로): 계절마다 풀밭 판은 SEASON_COLORS의 ground, 생울타리는 bushes[0]이다", async () => {
    const drawn = await draw("summer");
    const hedges = sourceGeometries(drawn.source).byGroup.get("hedges")!;
    for (const season of ["summer", "autumn", "winter", "spring"] as Season[]) {
      if (season !== "summer") await setSeason(drawn, season);
      const objects = allObjects(drawn.roots);
      // 풀밭 판: 마을 모델에서 오지 않은, 마을보다 넓은 y −0.02의 판
      const ground = objects.filter((o): o is THREE.Mesh => {
        if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return false;
        const pts = worldPositions(o);
        return pts.length > 0 && pts.every((p) => Math.abs(p.y + 0.02) < 1e-6) && Math.min(...pts.map((p) => p.x)) < 0 && Math.max(...pts.map((p) => p.x)) > VILLAGE.width;
      });
      expect({ season, grounds: ground.length }).toEqual({ season, grounds: 1 });
      expect({ season, ground: (ground[0].material as THREE.MeshLambertMaterial).color.getHex() }).toEqual({
        season,
        ground: new THREE.Color(SEASON_COLORS[season].ground).getHex()
      });
      const hedgeMeshes = objects.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh && hedges.has(o.geometry));
      expect(hedgeMeshes.length).toBeGreaterThan(0);
      for (const m of hedgeMeshes) {
        expect({ season, hedge: (m.material as THREE.MeshLambertMaterial).color.getHex() }).toEqual({
          season,
          hedge: new THREE.Color(SEASON_COLORS[season].bushes[0]).getHex()
        });
      }
    }
  });
});
