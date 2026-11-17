// [spec] qa 테스트(작업 103 마을 흩뿌림·흙길, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature·VillageModel)에서 본 계절 흩뿌림 조각과 흙길.
// 기대값은 명세(private 작업 폴더 103-2026-11-18-마을-흩뿌림-흙길/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 070ef33의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, 그림·모델을 require해
// react-three-fiber useLoader로 읽는 것, useFrame으로 계절을 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): F1·F2(흩뿌림 조각), P6~P9(흙길). 그대로 둘 동작(구현 전·뒤 통과): K12.
//
// 어떻게 보나(02-qa-tests.md "관찰하는 방법", 계약은 tests/__fixtures__/village-ground-103.ts 머리말):
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 작업 102의 것(village-splat-102.ts의 splatUseLoader)이다: 그림에는 빈 THREE.Texture를 주며 어느 파일인지 적어 두고,
//   그 밖(마을 모델·꽃 모델)은 작업 101의 가짜 불러오기에 넘긴다. 자산 폴더의 그림 파일은 "저장소 기준 경로" 글자로 바꿔 둔다. 불러온 파일 이름은 모두 적어 둔다.
// - VillageNature와 VillageModel을 마을 화면처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다. 가짜 useFrame은 테스트가 delta 0.1초로 부른다.
// - "흩뿌림 메시" = 그려지는(메시와 모든 부모가 visible, 찍는 수 > 0) 인스턴스 메시 가운데 마을 모델 도형이 아니고 납작한(높이 0.01칸 이하) 것.
//   (나무는 마을 모델의 나무 틀 도형, 3D 꽃·풀 장식은 높이가 있어 들지 않는다.)
// - "길 판" = 099 테스트와 같다: 인스턴스가 아니고 마을 모델 도형이 아니며, 모든 점이 y −0.0199 초과 0.1 이하이고 가로·깊이가 마을 안인 그려지는 메시.
// - 흙길 섞기와 바래는 정도의 잡음은 셰이더 안 계산이라 화면 색은 보지 않는다. 길 판 재질의 onBeforeCompile을 Lambert 셰이더 글로 불러, 셰이더에 넘기는 값과
//   고친 조각 셰이더 글에 그 이름이 나오는지를 본다. 바래는 폭은 꼭짓점 알파로 만든 바탕 불투명도로 잰다(셰이더가 흔드는 몫은 빼고).
// 명세에 수가 없어 qa가 정한 값(02-qa-tests.md "가정"):
// - 바래는 폭 "경계 안팎 약 0.45칸" = 0.4칸보다 넓고 0.5칸 안: 경계를 가로지르는 줄마다 안쪽 0.4칸 불투명도 < 0.999, 바깥 0.4칸 > 0.001, 안쪽 0.5칸 ≥ 0.999, 바깥 0.5칸 ≤ 0.001.
//   "안팎"(경계를 가운데로) = 안쪽 0.1칸 ≥ 0.5, 바깥 0.1칸 ≤ 0.5.
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt, type Season } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_START } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import {
  BARE_REL,
  DIRT_A_REL,
  GRASS_MARKS_REL,
  SCATTER_SEASONS,
  baseFileSha,
  coveredBy,
  drawnCell,
  fileSha,
  newImageFiles103,
  opacityField,
  scatterModule,
  type PathPt,
  type VillageScatterPiece
} from "../__fixtures__/village-ground-103";
import { shapeIndex, tilesOf, type PathShape, type Rect, type RoundedPathShapes } from "../__fixtures__/village-paths-099";
import { allObjects, drawnVisible, instanceHeight, instanceWorldMatrices, loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb, sourceGeometries } from "../__fixtures__/village-scene-101";
import { mockImagesAsPaths, numbers, readSplat, splatLoader, type SplatRead } from "../__fixtures__/village-splat-102";

type FramePart = (state: unknown, delta: number) => void;

const mockFrames: FramePart[] = [];
const mockScene: { background: unknown } = { background: null };
const mockLoadedUrls = new Set<string>();

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
    /* eslint-enable @typescript-eslint/no-require-imports */
    for (const url of Array.isArray(input) ? input : [input]) mockLoadedUrls.add(String(url));
    return splat.splatUseLoader(loader, input, scene101.fakeUseLoader);
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
  mockImagesAsPaths();
  splatLoader.newImages = new Set(newImageFiles103());
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  village = require("@/components/lobby3d/lobby3d-village") as typeof VillageModule;
});

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

type Drawn = { roots: THREE.Object3D[]; light: Light; source: THREE.Object3D };

async function draw(season: Season = "summer"): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
  const light = lightAt(season);
  const source = (loaderState.village as { scene: THREE.Object3D }).scene;
  const view = await render(
    <>
      <village.VillageNature daylight={light as unknown as DaylightState} />
      <village.VillageModel sim={sim as unknown as LobbySim} daylight={light as unknown as DaylightState} pickTargets={pick} />
    </>
  );
  const roots = view.container
    .queryAll((instance: TestInstance) => instance.type === "primitive")
    .map((p) => (p.props as { object: THREE.Object3D }).object);
  expect(roots.length).toBeGreaterThan(0);
  await frames(2);
  return { roots, light, source };
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

function worldPositions(mesh: THREE.Mesh): THREE.Vector3[] {
  const pos = mesh.geometry.getAttribute("position");
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += 1) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  return out;
}

const materialOf = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshLambertMaterial;

/** 흩뿌림 메시(머리말의 정의). */
function scatterMeshes(drawn: Drawn): THREE.InstancedMesh[] {
  const fromModel = sourceGeometries(drawn.source).all;
  return allObjects(drawn.roots).filter((o): o is THREE.InstancedMesh => {
    if (!(o instanceof THREE.InstancedMesh) || fromModel.has(o.geometry) || !drawnVisible(o, drawn.roots)) return false;
    return Math.max(...instanceWorldMatrices(o).map((w) => instanceHeight(o, w))) <= 0.01;
  });
}

/** 길 판(099와 같은 정의). */
function pathPlates(drawn: Drawn): THREE.Mesh[] {
  const fromModel = sourceGeometries(drawn.source).all;
  return allObjects(drawn.roots).filter((o): o is THREE.Mesh => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return false;
    if (fromModel.has(o.geometry) || !drawnVisible(o, drawn.roots)) return false;
    const points = worldPositions(o);
    if (points.length === 0) return false;
    return points.every((p) => p.y > -0.0199 && p.y <= 0.1 && p.x >= 0 && p.x <= VILLAGE.width && p.z >= 0 && p.z <= VILLAGE.depth);
  });
}

/** 풀밭 판(099 K3와 같은 정의): 그려지는 것만. */
function groundPlates(drawn: Drawn): THREE.Mesh[] {
  return allObjects(drawn.roots).filter((o): o is THREE.Mesh => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh) return false;
    const pts = worldPositions(o);
    return (
      pts.length > 0 &&
      pts.every((p) => Math.abs(p.y + 0.02) < 1e-6) &&
      Math.min(...pts.map((p) => p.x)) < 0 &&
      Math.max(...pts.map((p) => p.x)) > VILLAGE.width &&
      drawnVisible(o, drawn.roots)
    );
  });
}

function loadShapes(): PathShape[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/lib/lobby3d/village-paths") as { roundedPathShapes: RoundedPathShapes };
  return mod.roundedPathShapes(LAYOUT.paths as unknown as Rect[]);
}

/** 경계를 가로지르는 줄들: 경계 점마다 안쪽 법선을 따라 안(+)·밖(−)으로 PROFILE_STEPS칸 떨어진 점들. 점마다 경계까지 거리가 맞는 줄만 쓴다(099 P4와 같은 방법). */
const PROFILE_STEPS = [0.5, 0.4, 0.3, 0.2, 0.1, -0.1, -0.2, -0.3, -0.4, -0.5];

function profiles(shapes: PathShape[]): PathPt[][] {
  const index = shapeIndex(shapes);
  const out: PathPt[][] = [];
  for (const ring of shapes.flatMap((s) => [s.outer, ...s.holes])) {
    for (let i = 0; i < ring.length; i += 7) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-6) continue;
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      let n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
      if (!index.inside({ x: mid.x + n.x * 0.04, z: mid.z + n.z * 0.04 })) n = { x: -n.x, z: -n.z };
      const line = PROFILE_STEPS.map((d) => ({ x: mid.x + n.x * d, z: mid.z + n.z * d }));
      const ok = line.every((p, k) => {
        const d = PROFILE_STEPS[k];
        return index.inside(p) === d > 0 && Math.abs(index.distance(p) - Math.abs(d)) < 0.02;
      });
      if (ok) out.push(line);
    }
  }
  return out;
}

/** 조각 자리 찾기: (x, z)에서 0.001칸 안의 조각 번호들. */
function pieceFinder(pieces: VillageScatterPiece[]) {
  const cells = new Map<string, number[]>();
  pieces.forEach((s, i) => {
    const k = `${Math.floor(s.x)},${Math.floor(s.z)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(i);
  });
  return (x: number, z: number): number[] => {
    const out: number[] = [];
    for (let c = Math.floor(x) - 1; c <= Math.floor(x) + 1; c += 1) {
      for (let r = Math.floor(z) - 1; r <= Math.floor(z) + 1; r += 1) {
        for (const i of cells.get(`${c},${r}`) ?? []) if (Math.abs(pieces[i].x - x) <= 1e-3 && Math.abs(pieces[i].z - z) <= 1e-3) out.push(i);
      }
    }
    return out;
  };
}

const LINEAR_MIN = new Set<THREE.TextureFilter>([THREE.LinearFilter, THREE.LinearMipmapNearestFilter, THREE.LinearMipmapLinearFilter]);
const fileOf = (t: unknown) => (t instanceof THREE.Texture ? (splatLoader.urlOf.get(t) ?? "불러온 파일 아님") : "그림 아님");

jest.setTimeout(180000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  splatLoader.failNew = false;
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
});

// ---------- 바뀔 동작: 계절 흩뿌림 ----------

describe("[spec] 103 바뀔 동작: 계절 흩뿌림 조각 그리기(명세 1·4)", () => {
  it.each(SCATTER_SEASONS)("F1 %s: 그려지는 납작한 인스턴스 메시는 모두 그 계절의 흩뿌림 조각이다. 메시마다 그림 모음의 한 칸을 그리고, 찍은 자리마다 그 자리 조각의 칸과 같으며, 그 계절 조각이 모두 찍힌다(풀 자국은 남지 않는다)", async (season) => {
    const pieces = scatterModule().villageSeasonScatter(season);
    expect(pieces.length).toBeGreaterThan(0);
    const find = pieceFinder(pieces);
    const drawn = await draw("summer");
    if (season !== "summer") await setSeason(drawn, season);
    const meshes = scatterMeshes(drawn);
    expect(meshes.length).toBeGreaterThan(0);
    const matched = new Set<number>();
    const wrong: string[] = [];
    for (const mesh of meshes) {
      const cell = drawnCell(mesh);
      if (typeof cell !== "number") {
        wrong.push(`${mesh.name || "이름 없음"}: ${cell}`);
        continue;
      }
      instanceWorldMatrices(mesh).forEach((w, i) => {
        const p = new THREE.Vector3().setFromMatrixPosition(w);
        const hit = find(p.x, p.z).filter((k) => pieces[k].kind === cell);
        if (hit.length === 0) wrong.push(`${mesh.name || "이름 없음"} 칸 ${cell} 인스턴스 ${i} (${p.x.toFixed(2)}, ${p.z.toFixed(2)}): 그 자리에 칸 ${cell} 조각 없음`);
        hit.forEach((k) => matched.add(k));
      });
    }
    expect(wrong.slice(0, 20)).toEqual([]);
    const missing = pieces.filter((_, i) => !matched.has(i)).map((p) => `칸 ${p.kind} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
    expect({ missingCount: missing.length, missing: missing.slice(0, 20) }).toEqual({ missingCount: 0, missing: [] });
  });

  it("F2 조각 그림(명세 1·4): 가을·봄·여름의 흩뿌림 메시는 모두 같은 그림 파일을 쓰고, 그 파일은 기준 커밋 뒤에 새로 넣은 그림이다. 101 풀 자국 그림(기준 커밋의 grass-marks.png와 내용이 같은 파일)은 불러오지 않는다", async () => {
    mockLoadedUrls.clear();
    const drawn = await draw("summer");
    const files = new Set<string>();
    for (const season of SCATTER_SEASONS) {
      await setSeason(drawn, season);
      const meshes = scatterMeshes(drawn);
      expect({ season, meshes: meshes.length > 0 }).toEqual({ season, meshes: true });
      for (const m of meshes) files.add(fileOf(materialOf(m).map));
    }
    const fresh = new Set(newImageFiles103());
    expect([...files].map((f) => ({ file: f, isNew: fresh.has(f) }))).toEqual([...files].map((f) => ({ file: f, isNew: true })));
    expect(files.size).toBe(1);
    const marksSha = baseFileSha(GRASS_MARKS_REL);
    const loadedMarks = [...mockLoadedUrls].filter((u) => u.startsWith("apps/") && fileSha(u) === marksSha);
    expect(loadedMarks).toEqual([]);
  });
});

// ---------- 바뀔 동작: 흙길 ----------

function pathSplats(drawn: Drawn): { mesh: THREE.Mesh; material: THREE.MeshLambertMaterial; splat: SplatRead }[] {
  const plates = pathPlates(drawn);
  expect(plates.length).toBeGreaterThan(0);
  return plates.map((mesh) => {
    const material = materialOf(mesh);
    return { mesh, material, splat: readSplat(material) };
  });
}

describe("[spec] 103 바뀔 동작: 흙길 무늬 섞기와 부드러운 가장자리(명세 2·3·4)", () => {
  it("P6 흙길 무늬 섞기(명세 2·4): 길 판마다 재질의 onBeforeCompile이 셰이더를 고쳐 pathDirtMaps(잔잔한 흙 a·자갈 많은 흙 b·다져진 맨땅 세 장, 모두 되풀이)·pathDirtTiles(양수 셋)·pathNoiseMap(선형 거르기 잡음 그림)을 넣고, 고친 조각 셰이더 글에 그 이름이 나온다. a는 기준 커밋의 흙 a 그림, 맨땅은 기준 커밋의 맨땅 그림과 내용이 같고, b는 새로 넣은 다른 그림이다", async () => {
    const drawn = await draw("summer");
    const dirtSha = baseFileSha(DIRT_A_REL);
    const bareSha = baseFileSha(BARE_REL);
    const fresh = new Set(newImageFiles103());
    for (const { mesh, splat } of pathSplats(drawn)) {
      const at = mesh.name || mesh.uuid.slice(0, 8);
      expect({ at, custom: splat.custom, changed: splat.fragmentAfter !== splat.fragmentBefore }).toEqual({ at, custom: true, changed: true });
      const names = ["pathDirtMaps", "pathDirtTiles", "pathNoiseMap"];
      expect({ at, has: names.map((n) => [n, splat.uniforms[n] !== undefined, splat.fragmentAfter.includes(n)]) }).toEqual({ at, has: names.map((n) => [n, true, true]) });
      const maps = splat.uniforms.pathDirtMaps.value as unknown[];
      expect({ at, count: Array.isArray(maps) ? maps.length : null }).toEqual({ at, count: 3 });
      const textures = maps as THREE.Texture[];
      expect({ at, textures: textures.map((t) => t instanceof THREE.Texture && t.wrapS === THREE.RepeatWrapping && t.wrapT === THREE.RepeatWrapping) }).toEqual({ at, textures: [true, true, true] });
      const files = textures.map(fileOf);
      const shas = files.map((f) => (f.startsWith("apps/") ? fileSha(f) : f));
      expect({ at, a: shas[0] === dirtSha, bare: shas[2] === bareSha, bNew: fresh.has(files[1]), bOther: shas[1] !== dirtSha && shas[1] !== bareSha, files }).toEqual({
        at,
        a: true,
        bare: true,
        bNew: true,
        bOther: true,
        files
      });
      const tiles = numbers(splat.uniforms.pathDirtTiles.value);
      expect({ at, tiles: tiles.length === 3 && tiles.every((v) => Number.isFinite(v) && v > 0), values: tiles }).toEqual({ at, tiles: true, values: tiles });
      const noise = splat.uniforms.pathNoiseMap.value as THREE.Texture | undefined;
      expect({ at, noise: noise instanceof THREE.Texture }).toEqual({ at, noise: true });
      expect({ at, mag: noise!.magFilter === THREE.LinearFilter, min: LINEAR_MIN.has(noise!.minFilter) }).toEqual({ at, mag: true, min: true });
      if (!splatLoader.urlOf.has(noise!)) expect({ at, ready: noise!.version > 0 }).toEqual({ at, ready: true });
    }
  });

  it("P7 바래는 정도를 자리마다 살짝 달리한다(명세 3): 투명한(바래는) 길 판이 있고, 그 재질마다 셰이더 고침이 pathEdgeNoise(0보다 큰 수)와 pathNoiseMap을 넣으며 고친 조각 셰이더 글에 둘 다 나온다", async () => {
    const drawn = await draw("summer");
    const fading = pathSplats(drawn).filter((p) => p.material.transparent);
    expect(fading.length).toBeGreaterThan(0);
    for (const { mesh, splat } of fading) {
      const at = mesh.name || mesh.uuid.slice(0, 8);
      const amount = splat.uniforms.pathEdgeNoise?.value;
      expect({
        at,
        custom: splat.custom,
        amount: typeof amount === "number" && amount > 0,
        noise: splat.uniforms.pathNoiseMap?.value instanceof THREE.Texture,
        inFragment: ["pathEdgeNoise", "pathNoiseMap"].map((n) => splat.fragmentAfter.includes(n))
      }).toEqual({ at, custom: true, amount: true, noise: true, inFragment: [true, true] });
    }
  });

  it("P8 흙이 풀로 바래는 폭은 경계 안팎 약 0.45칸이다(명세 3, 지금 0.25): 경계를 가로지르는 줄마다 바탕 불투명도가 안쪽 0.5칸 1·바깥 0.5칸 0이고, 안쪽 0.4칸은 1보다 작고 바깥 0.4칸은 0보다 크며, 안쪽 0.1칸 ≥ 0.5·바깥 0.1칸 ≤ 0.5다", async () => {
    const drawn = await draw("summer");
    const opacity = opacityField(pathPlates(drawn));
    const lines = profiles(loadShapes());
    expect(lines.length).toBeGreaterThan(50);
    const at = (d: number) => PROFILE_STEPS.indexOf(d);
    const wrong: string[] = [];
    for (const line of lines) {
      const o = line.map((p) => opacity(p.x, p.z));
      const where = `${line[0].x.toFixed(2)},${line[0].z.toFixed(2)}`;
      const problems: string[] = [];
      if (o[at(0.5)] < 0.999) problems.push(`안 0.5 ${o[at(0.5)].toFixed(3)}`);
      if (o[at(-0.5)] > 0.001) problems.push(`밖 0.5 ${o[at(-0.5)].toFixed(3)}`);
      if (o[at(0.4)] >= 0.999) problems.push(`안 0.4 ${o[at(0.4)].toFixed(3)}(바래지 않음)`);
      if (o[at(-0.4)] <= 0.001) problems.push(`밖 0.4 ${o[at(-0.4)].toFixed(3)}(흙 없음)`);
      if (o[at(0.1)] < 0.5) problems.push(`안 0.1 ${o[at(0.1)].toFixed(3)} < 0.5`);
      if (o[at(-0.1)] > 0.5) problems.push(`밖 0.1 ${o[at(-0.1)].toFixed(3)} > 0.5`);
      if (problems.length) wrong.push(`${where}: ${problems.join(", ")}`);
    }
    expect({ lines: lines.length, wrongCount: wrong.length, wrong: wrong.slice(0, 15) }).toEqual({ lines: lines.length, wrongCount: 0, wrong: [] });
  });

  it("P9 흙길 섞기는 계절과 관계없이 같다(명세 2): 봄·여름·가을·겨울마다 길 판의 셰이더 값(그림 셋의 파일, 되풀이 크기, 잡음 그림, 바래는 잡음 세기)이 같다", async () => {
    const drawn = await draw("summer");
    const look = () =>
      pathSplats(drawn).map(({ splat }) => {
        const maps = (splat.uniforms.pathDirtMaps?.value as unknown[] | undefined) ?? [];
        const noise = splat.uniforms.pathNoiseMap?.value;
        return {
          maps: maps.map((t) => `${fileOf(t)}:${t instanceof THREE.Texture ? t.uuid : ""}`).join(","),
          tiles: numbers(splat.uniforms.pathDirtTiles?.value).join(","),
          noise: noise instanceof THREE.Texture ? noise.uuid : "없음",
          edge: String(splat.uniforms.pathEdgeNoise?.value ?? "없음")
        };
      });
    const summer = look();
    expect(summer.every((l) => l.maps.split(",").length === 3 && l.noise !== "없음")).toBe(true);
    for (const season of ["autumn", "winter", "spring", "summer"] as Season[]) {
      await setSeason(drawn, season);
      expect({ season, look: look() }).toEqual({ season, look: summer });
    }
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 103 그대로 둘 동작: 그림을 불러오지 못할 때", () => {
  it("K12 그림을 불러오지 못하면 땅 꾸밈만 빠지고 풀밭·길은 보인다(명세 그대로): 기준 커밋 뒤에 새로 넣은 그림을 불러오다 오류가 나도 화면이 그려지고, 풀밭 판이 하나 그려지며, 길 판이 그려져 길 칸 가운데(경계에서 0.5칸 넘게 안쪽)를 모두 덮는다. 마을 건물은 그대로 그려진다", async () => {
    splatLoader.failNew = true;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const drawn = await draw("summer");
      for (const season of ["summer", "autumn", "winter", "spring"] as Season[]) {
        if (season !== "summer") await setSeason(drawn, season);
        expect({ season, grounds: groundPlates(drawn).length }).toEqual({ season, grounds: 1 });
        const plates = pathPlates(drawn);
        expect({ season, plates: plates.length > 0 }).toEqual({ season, plates: true });
        const covered = coveredBy(plates);
        const index = shapeIndex(loadShapes());
        const uncovered: string[] = [];
        for (const t of tilesOf(LAYOUT.paths as unknown as Rect[])) {
          const [c, r] = t.split(",").map(Number);
          const p = { x: c + 0.5, z: r + 0.5 };
          if (index.inside(p) && index.distance(p) > 0.5 && !covered(p.x, p.z)) uncovered.push(t);
        }
        expect({ season, uncovered: uncovered.slice(0, 20) }).toEqual({ season, uncovered: [] });
      }
      const buildings = [...sourceGeometries(drawn.source).byGroup.entries()].filter(([name]) => name.startsWith("bld-")).flatMap(([, set]) => [...set]);
      expect(buildings.length).toBeGreaterThan(0);
      const shown = allObjects(drawn.roots).filter((o) => o instanceof THREE.Mesh && buildings.includes(o.geometry) && drawnVisible(o, drawn.roots));
      expect(shown.length).toBe(buildings.length);
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});

