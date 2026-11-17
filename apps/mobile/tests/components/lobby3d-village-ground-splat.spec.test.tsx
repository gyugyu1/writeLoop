// [spec] qa 테스트(작업 102 마을 땅 무늬 섞기, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature·VillageModel)에서 본 풀밭 바탕.
// 기대값은 명세(private 작업 폴더 102-2026-11-17-마을-땅-무늬-섞기/01-main-spec.md)와 03 결정(겨울에는 맨땅도 눈으로 덮는다)에서만 가져온다. 그대로 둘 동작은 기준 커밋 bfbee1a의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, 그림·모델을 require해
// react-three-fiber useLoader로 읽는 것, useFrame으로 계절을 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): R1~R8. 그대로 둘 동작(구현 전·뒤 통과): K10·K11.
//
// 어떻게 보나(02-qa-tests.md "관찰하는 방법"):
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader(village-splat-102.ts의 splatUseLoader)는 그림에 빈 THREE.Texture를 주며 어느 파일인지 적어 두고,
//   그 밖(마을 모델·꽃 모델)은 작업 101의 가짜 불러오기(village-scene-101.ts)에 넘긴다. 자산 폴더의 그림 파일은 "저장소 기준 경로" 글자로 바꿔 둔다.
// - VillageNature와 VillageModel을 마을 화면처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다. 가짜 useFrame은 테스트가 delta 0.1초로 부른다.
// - "풀밭 판" = 099 K3와 같다: 인스턴스가 아닌 메시 가운데 모든 점이 y −0.02이고 가로로 마을보다 넓은(0 미만 ~ 마을 폭 초과) 것.
// - 섞기는 셰이더 안 계산이라 화면 색은 보지 않는다. 풀밭 재질의 onBeforeCompile을 Lambert 셰이더 글로 불러, 셰이더에 넘기는 값(이름은 village-splat-102.ts 머리말)과
//   고친 조각 셰이더 글에 그 이름이 나오는지를 본다.
// - "그려진다" = 메시와 그 위 모든 부모의 visible이 true다(인스턴스 메시는 찍는 수가 0이 아니어야 한다).
import { act, render } from "@testing-library/react-native";
import { type MutableRefObject } from "react";
import type { TestInstance } from "test-renderer";
import * as THREE from "three";
import type * as VillageModule from "@/components/lobby3d/lobby3d-village";
import type { DaylightState } from "@/components/lobby3d/lobby3d-daylight";
import { SEASON_COLORS } from "@/components/lobby3d/lobby3d-outdoor";
import { daylightAt, type Season } from "@/lib/lobby3d/daylight";
import type { LobbySim } from "@/lib/lobby3d/engine";
import { VILLAGE, VILLAGE_START } from "@/lib/lobby3d/village";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { decorModule } from "../__fixtures__/village-decor-101";
import { allObjects, drawnVisible, instanceWorldMatrices, loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb, sourceGeometries } from "../__fixtures__/village-scene-101";
import {
  GROUND_LAYERS,
  SPLAT_UNIFORMS,
  imageDimsOf,
  mockImagesAsPaths,
  newImageFiles,
  numbers,
  readSplat,
  splatLoader,
  splatModule,
  type SplatRead
} from "../__fixtures__/village-splat-102";

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
    const splat = require("../__fixtures__/village-splat-102") as typeof import("../__fixtures__/village-splat-102");
    const scene101 = require("../__fixtures__/village-scene-101") as typeof import("../__fixtures__/village-scene-101");
    /* eslint-enable @typescript-eslint/no-require-imports */
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
  splatLoader.newImages = new Set(newImageFiles());
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

function theGround(drawn: Drawn): THREE.Mesh {
  const found = groundPlates(drawn);
  expect(found.length).toBe(1);
  return found[0];
}

const materialOf = (m: THREE.Mesh) => (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshLambertMaterial;

function splatOf(drawn: Drawn): SplatRead {
  return readSplat(materialOf(theGround(drawn)));
}

const LINEAR_MIN = new Set<THREE.TextureFilter>([THREE.LinearFilter, THREE.LinearMipmapNearestFilter, THREE.LinearMipmapLinearFilter]);

type Spot = { x: number; z: number };

function spotFinder(spots: Spot[]) {
  const cells = new Map<string, number[]>();
  spots.forEach((s, i) => {
    const k = `${Math.floor(s.x)},${Math.floor(s.z)}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(i);
  });
  return (x: number, z: number): boolean => {
    for (let c = Math.floor(x) - 1; c <= Math.floor(x) + 1; c += 1) {
      for (let r = Math.floor(z) - 1; r <= Math.floor(z) + 1; r += 1) {
        for (const i of cells.get(`${c},${r}`) ?? []) if (Math.abs(spots[i].x - x) <= 1e-3 && Math.abs(spots[i].z - z) <= 1e-3) return true;
      }
    }
    return false;
  };
}

/** 인스턴스 메시의 찍은 자리가 모두 주어진 자리 목록에 있는가. */
function allAt(mesh: THREE.InstancedMesh, has: (x: number, z: number) => boolean): boolean {
  return instanceWorldMatrices(mesh).every((w) => {
    const p = new THREE.Vector3().setFromMatrixPosition(w);
    return has(p.x, p.z);
  });
}

jest.setTimeout(180000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  splatLoader.failNew = false;
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
});

// ---------- 바뀔 동작 ----------

describe("[spec] 102 바뀔 동작: 풀밭 바탕을 여러 무늬의 섞임으로(명세 1~3)", () => {
  it("R1 땅 판 하나에서 섞는다(명세 1, 03 결정): 풀밭 판은 하나이고, 재질의 onBeforeCompile이 셰이더를 고쳐 섞을 값 여섯(groundLayerMaps·groundLayerTiles·groundLayerTint·groundNoiseMap·groundPlaceMap·groundBareAmount)을 넣으며, 고친 조각 셰이더 글에 그 이름이 모두 나온다", async () => {
    const drawn = await draw("summer");
    const splat = splatOf(drawn);
    expect(splat.custom).toBe(true);
    expect(SPLAT_UNIFORMS.map((name) => ({ name, has: splat.uniforms[name] !== undefined }))).toEqual(SPLAT_UNIFORMS.map((name) => ({ name, has: true })));
    expect(splat.fragmentAfter === splat.fragmentBefore).toBe(false);
    expect(SPLAT_UNIFORMS.map((name) => ({ name, inFragment: splat.fragmentAfter.includes(name) }))).toEqual(SPLAT_UNIFORMS.map((name) => ({ name, inFragment: true })));
  });

  it("R2 섞을 무늬 그림(명세 1·3): groundLayerMaps는 서로 다른 그림 다섯 장이고 모두 가로·세로 되풀이(RepeatWrapping)다. 풀 무늬 넷(짧은 풀·무성한 풀·클로버·이끼)은 기준 커밋 뒤에 새로 넣은 서로 다른 그림 파일 넷에서, 맨땅은 그 넷이 아닌 그림 파일에서 불러왔고, 다섯 그림 모두 가로·세로 384~768(512 안팎)이다", async () => {
    const drawn = await draw("summer");
    const maps = splatOf(drawn).uniforms.groundLayerMaps?.value as unknown[] | undefined;
    expect(Array.isArray(maps) ? maps.length : null).toBe(5);
    const textures = maps as THREE.Texture[];
    expect(textures.map((t) => t instanceof THREE.Texture)).toEqual([true, true, true, true, true]);
    expect(new Set(textures).size).toBe(5);
    expect(textures.map((t, k) => ({ layer: GROUND_LAYERS[k], repeat: t.wrapS === THREE.RepeatWrapping && t.wrapT === THREE.RepeatWrapping }))).toEqual(
      GROUND_LAYERS.map((layer) => ({ layer, repeat: true }))
    );
    const files = textures.map((t) => splatLoader.urlOf.get(t) ?? "불러온 파일 아님");
    const grass = files.slice(0, 4);
    const fresh = new Set(newImageFiles());
    expect({ grass: grass.map((f) => ({ file: f, isNew: fresh.has(f) })), distinct: new Set(grass).size }).toEqual({
      grass: grass.map((f) => ({ file: f, isNew: true })),
      distinct: 4
    });
    expect({ bare: files[4], fromFile: files[4] !== "불러온 파일 아님", notGrass: !grass.includes(files[4]) }).toEqual({ bare: files[4], fromFile: true, notGrass: true });
    const sizes = files.map((f) => ({ file: f, size: imageDimsOf(f) }));
    expect(sizes.filter((s) => s.size === null).map((s) => s.file)).toEqual([]);
    const off = sizes.filter((s) => ![s.size!.width, s.size!.height].every((v) => v >= 384 && v <= 768)).map((s) => `${s.file} ${s.size!.width}x${s.size!.height}`);
    expect(off).toEqual([]);
  });

  it("R3 계절 색을 곱하는 무늬(명세 1, 03 결정): groundLayerTint가 [1, 1, 1, 1, 0]이다(풀 무늬 넷은 계절 색을 곱하고 맨땅은 제 색 그대로. 겨울의 맨땅은 곱하기가 아니라 R8의 groundBareAmount로 눈에 덮인다)", async () => {
    const drawn = await draw("summer");
    expect(numbers(splatOf(drawn).uniforms.groundLayerTint?.value)).toEqual([1, 1, 1, 1, 0]);
  });

  it("R4 반복이 티 나지 않게(명세 1): groundLayerTiles는 양수 다섯이고 무늬마다 되풀이 크기가 모두 다르다", async () => {
    const drawn = await draw("summer");
    const tiles = numbers(splatOf(drawn).uniforms.groundLayerTiles?.value);
    expect({ count: tiles.length, positive: tiles.every((v) => Number.isFinite(v) && v > 0), distinct: new Set(tiles).size }).toEqual({ count: 5, positive: true, distinct: 5 });
  });

  it("R5 섞는 자리와 잡음(명세 1): groundPlaceMap의 크기와 R·G 픽셀이 villageGroundPlaceMap()과 같고 올려 보낼 준비가 됐으며(version > 0), 지도가 풀밭 판 전체(마을 밖 둘레 포함)를 덮는다. groundPlaceMap과 groundNoiseMap은 선형 거르기(경계가 부드럽게)다", async () => {
    const drawn = await draw("summer");
    const ground = theGround(drawn);
    const splat = readSplat(materialOf(ground));
    const want = splatModule().villageGroundPlaceMap();
    const place = splat.uniforms.groundPlaceMap?.value as THREE.Texture | undefined;
    expect(place instanceof THREE.Texture).toBe(true);
    const image = place!.image as { width: number; height: number; data: ArrayLike<number> };
    expect({ width: image.width, height: image.height, length: image.data.length }).toEqual({ width: want.width, height: want.height, length: want.data.length });
    let diff = 0;
    for (let k = 0; k < want.width * want.height; k += 1) {
      if (image.data[k * 4] !== want.data[k * 4] || image.data[k * 4 + 1] !== want.data[k * 4 + 1]) diff += 1;
    }
    expect(diff).toBe(0);
    expect(place!.version > 0).toBe(true);
    const pts = worldPositions(ground);
    const bounds = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), z0: Math.min(...pts.map((p) => p.z)), z1: Math.max(...pts.map((p) => p.z)) };
    expect({ x0: want.x0 <= bounds.x0 + 1e-6, x1: want.x1 >= bounds.x1 - 1e-6, z0: want.z0 <= bounds.z0 + 1e-6, z1: want.z1 >= bounds.z1 - 1e-6 }).toEqual({ x0: true, x1: true, z0: true, z1: true });
    const noise = splat.uniforms.groundNoiseMap?.value as THREE.Texture | undefined;
    expect(noise instanceof THREE.Texture).toBe(true);
    const filters = (t: THREE.Texture) => ({ mag: t.magFilter === THREE.LinearFilter, min: LINEAR_MIN.has(t.minFilter) });
    expect({ place: filters(place!), noise: filters(noise!) }).toEqual({ place: { mag: true, min: true }, noise: { mag: true, min: true } });
    // 코드로 만든 잡음 그림이면 올려 보낼 준비가 돼야 한다(파일에서 불러온 그림은 불러오기가 맡는다)
    if (!splatLoader.urlOf.has(noise!)) expect(noise!.version > 0).toBe(true);
  });

  it("R6 계절이 바뀌어도 섞기는 그대로이고 재질 색만 계절 색이다(명세 1, 099 K3): 봄·여름·가을·겨울마다 풀밭 판이 하나이고 color가 SEASON_COLORS의 ground이며, 섞을 그림·되풀이 크기·곱하기 값(겨울에도 [1, 1, 1, 1, 0])·자리 지도가 같다", async () => {
    const drawn = await draw("summer");
    const look = () => {
      const splat = splatOf(drawn);
      const maps = (splat.uniforms.groundLayerMaps?.value as THREE.Texture[] | undefined) ?? [];
      return {
        maps: maps.map((t) => t.uuid).join(","),
        tiles: numbers(splat.uniforms.groundLayerTiles?.value).join(","),
        tint: numbers(splat.uniforms.groundLayerTint?.value).join(","),
        place: (splat.uniforms.groundPlaceMap?.value as THREE.Texture | undefined)?.uuid ?? "없음"
      };
    };
    const summer = look();
    expect(summer.maps.split(",").length).toBe(5);
    for (const season of ["summer", "autumn", "winter", "spring"] as Season[]) {
      if (season !== "summer") await setSeason(drawn, season);
      const ground = theGround(drawn);
      expect({ season, color: materialOf(ground).color.getHex() }).toEqual({ season, color: new THREE.Color(SEASON_COLORS[season].ground).getHex() });
      expect({ season, look: look() }).toEqual({ season, look: summer });
    }
  });

  it("R7 큰 얼룩 없애기(명세 2): 그린 장면의 인스턴스 메시는 나무(마을 모델의 나무 틀 도형)·3D 꽃·풀 장식(장식 자리)·풀 자국(자국 자리)뿐이고, 땅 높이(y −0.05~0)의 납작한 덮개는 풀밭 판 하나뿐이다(자국과 길은 빼고 본다)", async () => {
    const drawn = await draw("summer");
    const { all: fromModel, byGroup } = sourceGeometries(drawn.source);
    const templates = byGroup.get("tree-templates")!;
    const mod = decorModule();
    const atDecor = spotFinder(mod.villageDecorSpots());
    const atMark = spotFinder(mod.villageGrassMarks());
    const objects = allObjects(drawn.roots);
    const strangers: string[] = [];
    const markMeshes = new Set<THREE.Object3D>();
    for (const o of objects) {
      if (!(o instanceof THREE.InstancedMesh) || o.count === 0 || !drawnVisible(o, drawn.roots)) continue;
      if (templates.has(o.geometry)) continue;
      if (allAt(o, atMark)) {
        markMeshes.add(o);
        continue;
      }
      if (allAt(o, atDecor)) continue;
      strangers.push(`${o.name || "이름 없음"} 인스턴스 ${o.count}개 y ${new THREE.Vector3().setFromMatrixPosition(instanceWorldMatrices(o)[0]).y.toFixed(4)}`);
    }
    expect(strangers).toEqual([]);
    // 땅 높이의 납작한 덮개: 마을 모델에서 오지 않은 그려지는 메시(인스턴스 아님) 가운데 모든 점이 y −0.05~0인 것
    const covers = objects.filter((o): o is THREE.Mesh => {
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || fromModel.has(o.geometry) || !drawnVisible(o, drawn.roots)) return false;
      const pts = worldPositions(o);
      return pts.length > 0 && pts.every((p) => p.y >= -0.05 && p.y <= 0);
    });
    const ground = theGround(drawn);
    expect(covers.map((m) => (m === ground ? "풀밭 판" : `${m.name || m.type} ${worldPositions(m)[0].y.toFixed(4)}`))).toEqual(["풀밭 판"]);
  });

  it("R8 겨울에는 맨땅도 눈으로 덮인다(03 결정): groundBareAmount가 봄·여름·가을 1, 겨울 0이다. 처음 컴파일 때 넣은 그 값 객체도 계절을 따라 바뀐다(다시 컴파일하지 않아도)", async () => {
    const drawn = await draw("summer");
    const first = splatOf(drawn).uniforms.groundBareAmount as { value: unknown } | undefined;
    expect(first !== undefined && typeof first.value === "number").toBe(true);
    const order: Season[] = ["summer", "winter", "spring", "winter", "autumn"];
    for (const [k, season] of order.entries()) {
      if (k > 0) await setSeason(drawn, season);
      const want = season === "winter" ? 0 : 1;
      const fresh = splatOf(drawn).uniforms.groundBareAmount?.value;
      expect({ season, compiled: first!.value, fresh }).toEqual({ season, compiled: want, fresh: want });
    }
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 102 그대로 둘 동작: 풀밭 판과 그림을 못 불러올 때", () => {
  it("K10 풀밭 판은 y −0.02의 판 하나이고 빛을 받는 Lambert 재질이며 불투명하다(밤·어스름에 함께 어두워진다. 099 K3·101 고침 그대로)", async () => {
    const drawn = await draw("summer");
    const material = materialOf(theGround(drawn));
    expect({ lambert: material instanceof THREE.MeshLambertMaterial, transparent: material.transparent }).toEqual({ lambert: true, transparent: false });
  });

  it("K11 그림을 불러오지 못하면 지금처럼 계절 색 한 가지 풀밭(명세 그대로): 새로 넣은 그림을 불러오다 오류가 나도 화면이 그려지고, 풀밭 판은 하나·Lambert·그림(map) 없음·섞기 없음이며 계절마다 color가 SEASON_COLORS의 ground다. 마을 건물은 그대로 그려진다", async () => {
    splatLoader.failNew = true;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const drawn = await draw("summer");
      for (const season of ["summer", "autumn", "winter", "spring"] as Season[]) {
        if (season !== "summer") await setSeason(drawn, season);
        const material = materialOf(theGround(drawn));
        const splat = readSplat(material);
        const noSplat = !splat.custom || (splat.fragmentAfter === splat.fragmentBefore && SPLAT_UNIFORMS.every((name) => splat.uniforms[name] === undefined));
        expect({ season, lambert: material instanceof THREE.MeshLambertMaterial, map: material.map ?? null, noSplat, color: material.color.getHex() }).toEqual({
          season,
          lambert: true,
          map: null,
          noSplat: true,
          color: new THREE.Color(SEASON_COLORS[season].ground).getHex()
        });
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
