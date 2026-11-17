// [spec] qa 테스트(작업 101 마을 땅 무늬, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature·VillageModel)에서 본 꽃·풀 장식(3D 모델)과 풀 자국.
// 기대값은 명세(private 작업 폴더 101-2026-11-17-마을-땅-무늬/01-main-spec.md)와 03 결정(01의 1·3을 바꿈)에서만 가져온다.
// 그대로 둘 동작(K8)은 기준 커밋 25e9cc7의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, useFrame으로 계절·가리기를 바꾸는 것,
// 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): S1~S6. 그대로 둘 동작(구현 전·뒤 통과): K8.
//
// 어떻게 보나:
// - react-three-fiber만 가짜로 둔다. 불러오는 방식에 묶이지 않게(03 결정) 가짜 불러오기는 tests/__fixtures__/village-scene-101.ts를 쓴다:
//   마을 모델에는 진짜 glb를 풀어 만든 장면, 그림에는 빈 THREE.Texture, 그 밖의 모델에는 어떤 이름으로 찾아도 작은 상자 메시가 나오는 가짜 모델을 준다.
//   Jest가 읽지 못하는 자산(.glb 등)은 파일마다 "파일 이름" 글자로 바꾼 뒤 마을 그리기 모듈을 require한다.
// - VillageNature와 VillageModel을 마을 화면(lobby3d-canvas의 VillageLayer)처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
//   장식과 자국을 어느 쪽이 그리는지는 가리지 않는다.
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 delta 0.1초로 모두 부른다.
// - "그려진다" = 메시와 그 위 모든 부모의 visible이 true다(인스턴스 메시는 찍는 수가 0이 아니어야 한다).
// - 장식과 자국은 인스턴스로 그린다(명세 3, 03 결정 1). 그래서 마을 모델(glb)의 도형이 아닌 인스턴스 메시 가운데,
//   찍은 자리(세계 변환의 옮김 x, z)가 모두 장식 자리 함수(villageDecorSpots)의 자리와 0.001칸 안에서 맞고 모양에 높이가 있는(0.01칸 넘는) 것을 "장식 메시",
//   모두 자국 자리 함수(villageGrassMarks)의 자리와 맞고 납작한(높이 0.01칸 이하) 것을 "자국 메시"로 본다. 자리 함수의 모양은 village-decor-101.ts 머리말.
//   (큰 얼룩처럼 이 둘에 들지 않는 인스턴스 메시는 보지 않는다.)
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { daylightAt, type Season } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE_START } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { decorModule, type VillageDecorSpot, type VillageGrassMark } from "../__fixtures__/village-decor-101";
import {
  allObjects,
  drawnVisible,
  instanceHeight,
  instanceWorldMatrices,
  loaderState,
  mockUnreadableAssets,
  resetFakeLoader,
  sceneFromGlb,
  sourceGeometries
} from "../__fixtures__/village-scene-101";

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
  const fake = (loader: unknown, input: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("../__fixtures__/village-scene-101") as typeof import("../__fixtures__/village-scene-101")).fakeUseLoader(loader, input);
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

type Sim = { x: number; z: number; reduceMotion: boolean };
type Drawn = { roots: THREE.Object3D[]; pick: MutableRefObject<THREE.Object3D[]>; light: Light; source: THREE.Object3D; sim: Sim };

async function draw(season: Season = "summer"): Promise<Drawn> {
  const pick: MutableRefObject<THREE.Object3D[]> = { current: [] };
  const sim: Sim = { x: VILLAGE_START.x, z: VILLAGE_START.z, reduceMotion: true };
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
  return { roots, pick, light, source, sim };
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

// ---------- 장식·자국 메시 찾기 ----------

type Spot = { x: number; z: number };

function spotFinder(spots: Spot[]) {
  const cells = new Map<string, number[]>();
  spots.forEach((s, i) => {
    const k = `${Math.floor(s.x)},${Math.floor(s.z)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(i);
  });
  return (x: number, z: number): number | null => {
    for (let c = Math.floor(x) - 1; c <= Math.floor(x) + 1; c += 1) {
      for (let r = Math.floor(z) - 1; r <= Math.floor(z) + 1; r += 1) {
        for (const i of cells.get(`${c},${r}`) ?? []) if (Math.abs(spots[i].x - x) <= 1e-3 && Math.abs(spots[i].z - z) <= 1e-3) return i;
      }
    }
    return null;
  };
}

type Found = { meshes: THREE.InstancedMesh[]; matched: Set<number> };

/** 그린 장면에서 장식 메시와 자국 메시(머리말의 정의)를 찾는다. 찍은 자리가 맞은 자리 번호도 모은다. */
function findDecorAndMarks(drawn: Drawn, decor: VillageDecorSpot[], marks: VillageGrassMark[]): { decor: Found; marks: Found } {
  const fromModel = sourceGeometries(drawn.source).all;
  const findDecor = spotFinder(decor);
  const findMark = spotFinder(marks);
  const out = { decor: { meshes: [], matched: new Set<number>() } as Found, marks: { meshes: [], matched: new Set<number>() } as Found };
  for (const o of allObjects(drawn.roots)) {
    if (!(o instanceof THREE.InstancedMesh) || fromModel.has(o.geometry) || o.count === 0) continue;
    const worlds = instanceWorldMatrices(o);
    const points = worlds.map((w) => new THREE.Vector3().setFromMatrixPosition(w));
    const height = Math.max(...worlds.map((w) => instanceHeight(o, w)));
    const decorHits = points.map((p) => findDecor(p.x, p.z));
    const markHits = points.map((p) => findMark(p.x, p.z));
    if (height > 0.01 && decorHits.every((h) => h !== null)) {
      out.decor.meshes.push(o);
      decorHits.forEach((h) => out.decor.matched.add(h!));
    } else if (height <= 0.01 && markHits.every((h) => h !== null)) {
      out.marks.meshes.push(o);
      markHits.forEach((h) => out.marks.matched.add(h!));
    }
  }
  return out;
}

function spots() {
  const mod = decorModule();
  return { decor: mod.villageDecorSpots(), marks: mod.villageGrassMarks() };
}

const materialsOf = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material : [m.material]);

/** 자국 메시들의 보이는 색 평균(선형): 재질 색 × 인스턴스 색(있으면). */
function meanMarkColor(meshes: THREE.InstancedMesh[]): THREE.Color {
  const sum = new THREE.Color(0, 0, 0);
  let n = 0;
  const c = new THREE.Color();
  for (const mesh of meshes) {
    const base = (materialsOf(mesh)[0] as THREE.MeshLambertMaterial).color ?? new THREE.Color(1, 1, 1);
    for (let i = 0; i < mesh.count; i += 1) {
      c.copy(base);
      if (mesh.instanceColor) {
        const ic = new THREE.Color();
        mesh.getColorAt(i, ic);
        c.multiply(ic);
      }
      sum.r += c.r;
      sum.g += c.g;
      sum.b += c.b;
      n += 1;
    }
  }
  return new THREE.Color(sum.r / n, sum.g / n, sum.b / n);
}

const srgb255 = (c: THREE.Color) => {
  const s = c.clone().convertLinearToSRGB();
  return [s.r, s.g, s.b].map((v) => Math.round(v * 255));
};
const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

const matrixKey = (mesh: THREE.InstancedMesh) => instanceWorldMatrices(mesh).map((m) => m.elements.map((v) => v.toFixed(5)).join(",")).join(";");

const nodeCrypto = (process as unknown as { getBuiltinModule: (id: string) => typeof import("crypto") }).getBuiltinModule("crypto");

jest.setTimeout(180000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
});

// ---------- 바뀔 동작 ----------

describe("[spec] 101 바뀔 동작: 꽃·풀 장식(3D 모델)과 풀 자국 그리기", () => {
  it("S1 장식(01의 3, 03 결정 3): 장식 자리마다 3D 모델(높이가 있는 모양)이 인스턴스로 찍혀 그려지고(여름), 메시 하나가 평균 5개 이상을 찍는다", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const found = findDecorAndMarks(drawn, decor, marks).decor;
    expect(found.meshes.length).toBeGreaterThan(0);
    const missing = decor.filter((_, i) => !found.matched.has(i)).map((s) => `${s.kind} ${s.x.toFixed(2)},${s.z.toFixed(2)}`);
    expect(missing.slice(0, 20)).toEqual([]);
    expect(found.meshes.map((m) => drawnVisible(m, drawn.roots))).toEqual(found.meshes.map(() => true));
    const instances = found.meshes.reduce((sum, m) => sum + m.count, 0);
    expect(instances / found.meshes.length).toBeGreaterThanOrEqual(5);
  });

  it("S2 장식은 겨울에 보이지 않고(눈), 봄·가을에는 다시 보인다(01의 3)", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const meshes = findDecorAndMarks(drawn, decor, marks).decor.meshes;
    expect(meshes.length).toBeGreaterThan(0);
    for (const season of ["winter", "spring", "winter", "autumn"] as Season[]) {
      await setSeason(drawn, season);
      const shown = meshes.map((m) => drawnVisible(m, drawn.roots));
      expect({ season, shown }).toEqual({ season, shown: meshes.map(() => season !== "winter") });
    }
  });

  it("S3 풀 자국(03 결정 1): 자국 자리마다 그림을 입힌 납작한 판이 인스턴스로 찍혀 그려지고, 판 재질에 그림(map)이 있고 그림의 빈 곳이 비친다(transparent 또는 alphaTest), 메시 하나가 평균 5개 이상을 찍는다", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const found = findDecorAndMarks(drawn, decor, marks).marks;
    expect(found.meshes.length).toBeGreaterThan(0);
    const missing = marks.filter((_, i) => !found.matched.has(i)).map((m) => `${m.x.toFixed(2)},${m.z.toFixed(2)}`);
    expect({ missingCount: missing.length, missing: missing.slice(0, 20) }).toEqual({ missingCount: 0, missing: [] });
    expect(found.meshes.map((m) => drawnVisible(m, drawn.roots))).toEqual(found.meshes.map(() => true));
    for (const mesh of found.meshes) {
      for (const mat of materialsOf(mesh)) {
        const m = mat as THREE.MeshLambertMaterial;
        expect({ map: m.map instanceof THREE.Texture, seeThrough: m.transparent || m.alphaTest > 0 }).toEqual({ map: true, seeThrough: true });
      }
    }
    const instances = found.meshes.reduce((sum, m) => sum + m.count, 0);
    expect(instances / found.meshes.length).toBeGreaterThanOrEqual(5);
  });

  it("S4 자국 색은 계절 색을 따른다(03 결정 1): 봄·여름·가을의 자국 색(재질 색 × 인스턴스 색의 평균)이 서로 다르고, 겨울에는 자국이 숨거나 여름보다 옅다(밝다)", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const meshes = findDecorAndMarks(drawn, decor, marks).marks.meshes;
    expect(meshes.length).toBeGreaterThan(0);
    const colors = new Map<Season, THREE.Color>();
    for (const season of ["summer", "autumn", "spring", "winter"] as Season[]) {
      if (season !== "summer") await setSeason(drawn, season);
      colors.set(season, meanMarkColor(meshes));
      if (season === "winter") {
        const hidden = meshes.every((m) => !drawnVisible(m, drawn.roots));
        const lighter = luminance(colors.get("winter")!) > luminance(colors.get("summer")!);
        expect({ hiddenOrLighter: hidden || lighter }).toEqual({ hiddenOrLighter: true });
      }
    }
    const [sp, su, au] = (["spring", "summer", "autumn"] as Season[]).map((s) => srgb255(colors.get(s)!).join("/"));
    expect({ springVsSummer: sp !== su, summerVsAutumn: su !== au, springVsAutumn: sp !== au }).toEqual({
      springVsSummer: true,
      summerVsAutumn: true,
      springVsAutumn: true
    });
  });

  it("S5 장식과 자국은 누르기 대상이 아니다(01의 3, 03 결정 1): 누르기 판정 목록에 없고, 목록의 물체 아래에도 위에도 없다", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const found = findDecorAndMarks(drawn, decor, marks);
    const ours = [...found.decor.meshes, ...found.marks.meshes];
    expect(ours.length).toBeGreaterThan(0);
    const tangled: string[] = [];
    for (const target of drawn.pick.current) {
      for (const mesh of ours) {
        let related = mesh === target;
        target.traverse((o) => {
          if (o === mesh) related = true;
        });
        mesh.traverseAncestors((a) => {
          if (a === target) related = true;
        });
        if (related) tangled.push(`${target.name || target.type} ↔ ${mesh.name || mesh.type}`);
      }
    }
    expect(tangled).toEqual([]);
  });

  it("S6 라룹이가 지나가도 장식과 자국은 그대로다(01의 3): 라룹이를 장식 자리와 자국 자리에 세우고 프레임을 돌려도 찍은 자리와 보임이 같다", async () => {
    const { decor, marks } = spots();
    const drawn = await draw("summer");
    const found = findDecorAndMarks(drawn, decor, marks);
    const ours = [...found.decor.meshes, ...found.marks.meshes];
    expect(found.decor.meshes.length > 0 && found.marks.meshes.length > 0).toBe(true);
    const before = ours.map((m) => ({ at: matrixKey(m), shown: drawnVisible(m, drawn.roots) }));
    for (const p of [decor[0], decor[Math.floor(decor.length / 2)], marks[0], marks[Math.floor(marks.length / 2)]]) {
      drawn.sim.x = p.x;
      drawn.sim.z = p.z;
      await frames(3);
      const after = ours.map((m) => ({ at: matrixKey(m), shown: drawnVisible(m, drawn.roots) }));
      expect(after).toEqual(before);
    }
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 101 그대로 둘 동작: 나무", () => {
  // 나무 = 마을 모델의 나무 틀 도형으로 찍은 인스턴스 메시. 메시마다 찍은 수, 찍은 자리(세계 변환, 소수 넷째 자리), 계절마다 그루별 색(16진)을 적어
  // 그 글의 sha256을 기준 커밋 25e9cc7에서 이 테스트로 잰 값과 견준다.
  it("K8 나무 자리와 계절에 따른 잎 색이 기준 커밋과 같다(01 그대로: 나무, 계절에 따른 나무 색)", async () => {
    const drawn = await draw("summer");
    const templates = sourceGeometries(drawn.source).byGroup.get("tree-templates")!;
    const trees = allObjects(drawn.roots).filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh && templates.has(o.geometry));
    expect(trees.length).toBeGreaterThan(0);
    const lines: string[] = trees.map((m) => `${m.count} ${instanceWorldMatrices(m).map((w) => w.elements.map((v) => (Object.is(v, -0) ? 0 : v).toFixed(4)).join(",")).join(";")}`);
    for (const season of ["summer", "autumn", "winter", "spring"] as Season[]) {
      if (season !== "summer") await setSeason(drawn, season);
      for (const m of trees) {
        const colors: string[] = [];
        const c = new THREE.Color();
        for (let i = 0; i < m.count; i += 1) {
          if (m.instanceColor) {
            m.getColorAt(i, c);
            colors.push(c.getHexString());
          }
        }
        lines.push(`${season} ${colors.join(",")}`);
      }
    }
    const digest = nodeCrypto.createHash("sha256").update(lines.join("\n")).digest("hex");
    expect({ trees: trees.length, digest }).toEqual({ trees: K8_TREES, digest: K8_DIGEST });
  });
});

/** 기준 커밋 25e9cc7에서 K8로 잰 값. */
const K8_TREES = 10;
const K8_DIGEST = "93cd31438187c856ec03b635addd6ad78af5dd807c7b46dc129466e779eedf37";
