// [spec] qa 테스트(작업 099 마을 길 둥글게, 기능 변경, 모바일): 바깥 마을 그리기(VillageNature·VillageModel)에서 본 길.
// 기대값은 명세(private 작업 폴더 099-2026-11-17-마을-길-둥글게/01-main-spec.md)에서만 가져온다. 그대로 둘 동작은 기준 커밋 1144c47의 지금 동작이다.
// 구현 코드는 부르는 방법(lobby3d-village.tsx의 VillageNature 속성 daylight, VillageModel 속성 sim·daylight·pickTargets, 모델을 require해
// react-three-fiber useLoader(GLTFLoader)로 읽는 것, useFrame으로 계절·가리기·불빛을 바꾸는 것, 장면을 <primitive object>로 넘기는 것)을 알려고만 읽었다.
//
// 바뀔 동작(구현 전 실패): P1~P5. 그대로 둘 동작(구현 전·뒤 통과): K1~K3.
//
// 작업 101(마을 땅 무늬) 02 결정(사용자 2026-11-17 "진행": 명세의 "그 때문에 고칠 기존 테스트")으로 qa가 고쳤다. 작업 101은 둥근 길의 안쪽에
// 한 가지 흙색 대신 흙 무늬 그림을 입히고, 짙은 가장자리 띠 대신 흙이 풀로 부드럽게 바래는 경계로 바꾼다(길 모양과 계절과 관계없는 색은 그대로).
// - P2: "색 그림 없는 불투명 재질" 대신 "흙 무늬 그림(map)을 반복으로 입힌 Lambert 재질". P3: 판이 덮는 곳을 "흙이 보이는 정도(불투명도)"로 보고,
//   부드러운 가장자리 몫으로 경계 양쪽 0.5칸은 보지 않는다. P4: "#dcbd8e 한 가지와 짙은 띠" 대신 "가장자리는 짙어지지 않고 불투명도가 바랜다".
//   P5: 계절마다 같은지 보는 값에 불투명도와 그림을 더했다. 도우미 vertexColors의 "색 그림이 없어야 한다" 단언은 뺐다(그림은 P2가 본다).
// - 작업 101은 그림·모델을 불러오는 방식을 구현이 정한다(03 결정). 그래서 가짜 불러오기를 tests/__fixtures__/village-scene-101.ts로 바꾸고,
//   마을 그리기 모듈은 Jest가 읽지 못하는 자산(.glb 등)을 가짜로 바꾼 뒤 require한다. P1·K1~K3의 단언·입력은 바꾸지 않았다.
//
// 어떻게 보나:
// - react-three-fiber만 가짜로 둔다. 가짜 useLoader는 저장소의 진짜 마을 모델(lobby-village.glb)을 이 테스트가 직접 풀어 만든 장면을 준다
//   (098 테스트 lobby3d-village-home-model.spec.test.tsx와 같은 방법. 그림 픽셀은 풀지 않고 빈 THREE.Texture로 둔다). 그 밖의 그림에는 빈 THREE.Texture를 준다.
// - VillageNature와 VillageModel을 마을 화면(lobby3d-canvas의 VillageLayer)처럼 함께 그리고, 둘이 넘긴 <primitive object> 전부를 그린 장면으로 본다.
//   둥근 길을 어느 쪽이 그리는지는 명세가 정하지 않아 가리지 않는다.
// - 가짜 useFrame은 받은 프레임 함수를 모두 적어 두고, 테스트가 delta 0.1초로 모두 부른다.
// - "그려진다" = 메시와 그 위 모든 부모의 visible이 true다(떼어 내 장면에 없으면 그려지지 않는다).
// - "둥근 길 판" = 그린 장면의 메시(인스턴스 메시 빼고) 가운데 마을 모델에서 온 모양(glb 메시의 도형)이 아니고, 모든 점이 땅 높이
//   (풀밭 y −0.02보다 위, 0.1 이하)에 있으며, 가로·깊이로 마을 안(0~70, 0~60)에 드는 것. 풀밭 판(y −0.02, 마을보다 넓다)과 나무·풍차 날개는 여기에 들지 않는다.
// - 판 한 점의 "색 배율" = 재질 색 × 꼭짓점 색(재질이 vertexColors이고 도형에 color가 있을 때). 그림(map)은 이 배율에 곱해져 보인다.
// - 판 한 점의 "불투명도" = 재질이 transparent이면 재질 opacity × 꼭짓점 알파(재질이 vertexColors이고 color가 4성분일 때), 아니면 1.
//   alphaTest보다 작으면 0. 판 재질에 알파 그림(alphaMap)이 있으면 이 테스트가 계산할 수 없어 실패한다(04-qa-tests.md 가정).
//   작업 103(마을 흩뿌림·흙길) 명세의 "그 때문에 고칠 기존 테스트"(P3·P4)로 qa가 고쳤다: 103은 길 판에 흙 무늬 셋을 잡음으로 섞고 바래는 정도를 잡음으로
//   살짝 흔드는 셰이더 고침(onBeforeCompile)을 더한다. 그래서 셰이더 고침이 있으면 실패하던 조건을 빼고, 꼭짓점 알파로 만든 바탕 불투명도만 계산한다
//   (셰이더가 흔드는 몫은 보지 않는다. 셰이더에 넘기는 값은 103 테스트 lobby3d-village-scatter-paths.spec.test.tsx가 본다).
//   P3·P4의 0.5칸은 그대로다(103의 바래는 폭 약 0.45칸 < 0.5칸).
//   한 점에 판이 여럿 겹치면 흙이 보이는 정도 = 1 − Π(1 − 판마다 불투명도).
// - 부드러운 가장자리: 둥근 경계에서 안쪽 0.5칸은 불투명도 1(흙만 보임), 바깥 0.5칸은 0(흙 없음)이고, 그 사이에서 바깥으로 갈수록 줄어들며(0.01까지 봐줌),
//   0.02~0.98 사이 값이 있고, 둥근 경계 바로 안(0.04칸)이 0.98보다 작거나 바로 밖(0.04칸)이 0.02보다 크다(경계가 바래는 곳 안에 있다).
//   바래는 곳에서 보이는 판(위 판들에 가려지지 않은 판)의 색 배율은 그 자리에서 0.5칸 안쪽의 맨 위 판 색 배율보다 짙지 않다
//   (밝기 0.99배 이상, 어느 채널도 0.004 넘게 어둡지 않음). 0.5칸은 qa가 정한 값이다.
//
// 작업 106(마을 가게 넣기) 바뀌는 동작 5(가게 유리는 누르기 대상이 아니다)로 qa가 K2를 고쳤다(106 qa 보고 02-qa-tests.md): 누르기 판정 대상으로 받는 건물 메시에서
// 모델의 유리 재질(이름이 glass로 시작)을 쓰는 메시는 뺀다. 나머지 단언(건물·소품 메시뿐이고 그 밖의 물체는 그 아래에도 없다)은 그대로다.
// 작업 115 ①(마을 경계를 원으로) 명세의 "고칠 기존 테스트"(생울타리)로 qa가 K3을 고쳤다(115 ① qa 보고 02-경계와-마을-모델/02-qa-tests.md):
// 115는 마을 모델에서 생울타리(hedges)를 뺀다(명세 4). 그래서 K3에서 생울타리 계절 색을 보는 부분을 뺐다. 풀밭 판의 계절 색은 그대로 본다.
// K1(마을 모델의 다른 묶음이 그대로 그려진다)은 모델에 있는 묶음을 돌며 보므로 생울타리·울타리·풍차가 빠져도 그대로 둔다.
//
// 작업 112 ③ 물체 합치기(private 작업 폴더 112-2026-11-18-마을-그리기-JS-줄이기/04-물체-합치기/01-main-spec.md)의 "고칠 기존 테스트"로 qa가 K1·K2를 고쳤다:
// 112 ③은 마을 모델의 한 묶음 안에서 앱이 바꿔 끼우는 재질이 같은 메시(소품·풍차 탑의 primitive들)를 앱이 불러올 때 하나로 합친다(모양은 그대로).
// 그래서 소품·풍차 메시를 모델의 원본 도형·메시 이름과 같은 것으로 찾지 않고, 삼각형 자리로 본다(tests/__fixtures__/village-merge-112.ts):
// - K1: 묶음마다 "같은 메시 이름들" 대신 "그 묶음 아래 그려지는 메시들의 삼각형 세계 자리가 모델의 그 묶음 삼각형과 같다"(불빛 판은 하나도 그려지지 않고, 장면에 있는 메시들의 삼각형이 같다).
// - K2: "모델 도형이 건물·소품의 것인 메시" 대신 "삼각형이 모두 건물(유리 빼고)·소품 삼각형인 그려지는 메시"를 누르기 대상으로 기대하고, 대상의 삼각형이 건물·소품 삼각형을 모두 덮는지 더 본다.
// 기대값은 그리기에 넘긴 장면과 따로 푼 같은 모델에서 모은다. 묶음 이름·그려짐·누르기 대상의 뜻과 나무 틀 단언은 그대로다.
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
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import { GLASS_MATERIAL } from "../__fixtures__/village-shops-106";
import { nowVillageGlb } from "../__fixtures__/village-glb-098";
import { shapeIndex, tilesOf, type PathShape, type Rect, type RoundedPathShapes } from "../__fixtures__/village-paths-099";
import { TriBank, compareTriangles, labelOfMesh, sourceTriangles, trianglesOf as meshTriangles } from "../__fixtures__/village-merge-112";
import { loaderState, mockUnreadableAssets, resetFakeLoader, sceneFromGlb } from "../__fixtures__/village-scene-101";

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
jest.mock("@/assets/models/lobby-village.glb", () => "lobby-village.glb");
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

/** 마을 모델(glb) 재질이 쓰는 그림들. */
function sourceTextures(source: THREE.Object3D): Set<THREE.Texture> {
  const out = new Set<THREE.Texture>();
  source.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const map = (m as THREE.MeshStandardMaterial).map;
      if (map) out.add(map);
    }
  });
  return out;
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

type Tri = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  ca: THREE.Color;
  cb: THREE.Color;
  cc: THREE.Color;
  aa: number;
  ab: number;
  ac: number;
  order: number;
  mesh: number;
  map: string;
  test: number;
};

/** 꼭짓점의 색 배율(선형)과 불투명도(머리말의 정의). 알파 그림이 있으면 이 테스트가 계산할 수 없어 실패한다. 셰이더 고침이 흔드는 몫은 계산하지 않는다(103). */
function vertexLooks(mesh: THREE.Mesh): { colors: THREE.Color[]; alphas: number[] } {
  const material = mesh.material as THREE.MeshLambertMaterial;
  expect({ alphaMap: material.alphaMap ?? null }).toEqual({ alphaMap: null });
  const colorAttr = material.vertexColors ? mesh.geometry.getAttribute("color") : undefined;
  const count = mesh.geometry.getAttribute("position").count;
  const colors: THREE.Color[] = [];
  const alphas: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const c = material.color.clone();
    if (colorAttr) c.multiply(new THREE.Color(colorAttr.getX(i), colorAttr.getY(i), colorAttr.getZ(i)));
    colors.push(c);
    let a = 1;
    if (material.transparent) {
      a = material.opacity * (colorAttr && colorAttr.itemSize === 4 ? colorAttr.getW(i) : 1);
    }
    alphas.push(a);
  }
  return { colors, alphas };
}

function trianglesOf(meshes: THREE.Mesh[]): Tri[] {
  const out: Tri[] = [];
  meshes.forEach((mesh, meshIndex) => {
    const points = worldPositions(mesh);
    const { colors, alphas } = vertexLooks(mesh);
    const map = (mesh.material as THREE.MeshLambertMaterial).map?.uuid ?? "그림 없음";
    const index = mesh.geometry.getIndex();
    const ids = index ? Array.from({ length: index.count }, (_, i) => index.getX(i)) : points.map((_, i) => i);
    for (let i = 0; i + 2 < ids.length; i += 3) {
      const [ia, ib, ic] = [ids[i], ids[i + 1], ids[i + 2]];
      out.push({
        a: points[ia],
        b: points[ib],
        c: points[ic],
        ca: colors[ia],
        cb: colors[ib],
        cc: colors[ic],
        aa: alphas[ia],
        ab: alphas[ib],
        ac: alphas[ic],
        order: mesh.renderOrder,
        mesh: meshIndex,
        map,
        test: (mesh.material as THREE.Material).alphaTest
      });
    }
  });
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

type Hit = { color: THREE.Color; alpha: number; y: number; order: number; map: string };

/** 점 (x, z)를 덮는 판마다(판 하나에 한 번) 색 배율·불투명도(alphaTest보다 작으면 0)·높이. */
function hitsAt(find: (x: number, z: number) => Tri[], x: number, z: number): Hit[] {
  const byMesh = new Map<number, Hit>();
  for (const t of find(x, z)) {
    if (byMesh.has(t.mesh)) continue;
    const d = (t.b.z - t.c.z) * (t.a.x - t.c.x) + (t.c.x - t.b.x) * (t.a.z - t.c.z);
    if (Math.abs(d) < 1e-12) continue;
    const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / d;
    const v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / d;
    const w = 1 - u - v;
    if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
    const y = u * t.a.y + v * t.b.y + w * t.c.y;
    const color = new THREE.Color(u * t.ca.r + v * t.cb.r + w * t.cc.r, u * t.ca.g + v * t.cb.g + w * t.cc.g, u * t.ca.b + v * t.cb.b + w * t.cc.b);
    const alpha = u * t.aa + v * t.ab + w * t.ac;
    byMesh.set(t.mesh, { color, alpha: alpha < t.test ? 0 : alpha, y, order: t.order, map: t.map });
  }
  return [...byMesh.values()];
}

/** 흙이 보이는 정도: 1 − Π(1 − 판마다 불투명도). */
function opacityOf(hits: Hit[]): number {
  return 1 - hits.reduce((keep, h) => keep * (1 - Math.min(1, Math.max(0, h.alpha))), 1);
}

/** 맨 위에 보이는 판(renderOrder가 큰 것, 같으면 높은 것). */
function topHit(hits: Hit[]): Hit | null {
  let best: Hit | null = null;
  for (const h of hits) if (!best || h.order > best.order || (h.order === best.order && h.y > best.y)) best = h;
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

/** 길 안의 점들: 경계에서 0.5칸 넘게 안쪽인 칸 가운데(가운데)와, 경계 점마다 0.04칸 안쪽 점(가장자리). */
function samplePoints(shapes: PathShape[]) {
  const index = shapeIndex(shapes);
  const inner: { x: number; z: number }[] = [];
  for (const t of tilesOf(LAYOUT.paths as unknown as Rect[])) {
    const [c, r] = t.split(",").map(Number);
    const p = { x: c + 0.5, z: r + 0.5 };
    if (index.inside(p) && index.distance(p) > 0.5) inner.push(p);
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

/** 경계를 가로지르는 줄들: 경계 점마다 안쪽 법선을 따라 안(+)·밖(−)으로 PROFILE_STEPS칸 떨어진 점들. 점마다 경계까지 거리가 맞는 줄만 쓴다. */
const PROFILE_STEPS = [0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.07, 0.04, 0.02, -0.02, -0.04, -0.07, -0.1, -0.15, -0.2, -0.25, -0.3, -0.4, -0.5];

function profiles(shapes: PathShape[]): { x: number; z: number }[][] {
  const index = shapeIndex(shapes);
  const out: { x: number; z: number }[][] = [];
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

jest.setTimeout(180000);

beforeEach(() => {
  mockFrames.length = 0;
  mockScene.background = null;
  resetFakeLoader();
  loaderState.village = { scene: sceneFromGlb(nowVillageGlb()) };
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

  it("P2 둥근 길 판(명세 1·2, 101 명세 2): 땅 위 판이 있고, 판의 재질은 Lambert 재질이며 모두 같은 흙 무늬 그림(map, 마을 모델의 그림이 아님)을 가로·세로 반복(RepeatWrapping)으로 입혀 판 전체에서 두 번 넘게 되풀이된다", async () => {
    const drawn = await draw();
    const found = plates(drawn);
    expect(found.length).toBeGreaterThan(0);
    const modelTextures = sourceTextures(drawn.source);
    const maps = new Set<THREE.Texture | null>();
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const m of found) {
      const materials = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of materials) {
        const map = (mat as THREE.MeshLambertMaterial).map ?? null;
        maps.add(map);
        expect({
          lambert: mat instanceof THREE.MeshLambertMaterial,
          map: map instanceof THREE.Texture,
          fromModel: map ? modelTextures.has(map) : false,
          repeat: map ? map.wrapS === THREE.RepeatWrapping && map.wrapT === THREE.RepeatWrapping : false
        }).toEqual({ lambert: true, map: true, fromModel: false, repeat: true });
      }
      const uv = m.geometry.getAttribute("uv");
      expect(uv ? uv.count : 0).toBe(m.geometry.getAttribute("position").count);
      const map = (m.material as THREE.MeshLambertMaterial).map!;
      for (let i = 0; i < uv.count; i += 1) {
        const u = uv.getX(i) * map.repeat.x;
        const v = uv.getY(i) * map.repeat.y;
        uMin = Math.min(uMin, u);
        uMax = Math.max(uMax, u);
        vMin = Math.min(vMin, v);
        vMax = Math.max(vMax, v);
      }
    }
    expect(maps.size).toBe(1);
    expect({ uSpan: uMax - uMin > 2, vSpan: vMax - vMin > 2 }).toEqual({ uSpan: true, vSpan: true });
  });

  it("P3 판의 모양(명세 1): 흙이 보이는 곳이 배치 파일 paths로 계산한 둥근 경계(roundedPathShapes)의 안과 같다(경계 안쪽 0.5칸 넘게는 불투명도 1, 바깥 0.5칸 넘게는 0. 0.2칸 간격으로 본다)", async () => {
    const drawn = await draw();
    const find = bucketed(trianglesOf(plates(drawn)));
    const index = shapeIndex(loadShapes());
    const missing: string[] = [];
    const extra: string[] = [];
    for (let x = 10.1; x < 61; x += 0.2) {
      for (let z = 10.1; z < 52; z += 0.2) {
        const p = { x, z };
        if (index.distance(p) <= 0.5) continue;
        const want = index.inside(p);
        const opacity = opacityOf(hitsAt(find, x, z));
        if (want && opacity < 0.999) missing.push(`${x.toFixed(1)},${z.toFixed(1)} ${opacity.toFixed(3)}`);
        if (!want && opacity > 0.001) extra.push(`${x.toFixed(1)},${z.toFixed(1)} ${opacity.toFixed(3)}`);
      }
    }
    expect({ missing: missing.slice(0, 20), missingCount: missing.length, extra: extra.slice(0, 20), extraCount: extra.length }).toEqual({
      missing: [],
      missingCount: 0,
      extra: [],
      extraCount: 0
    });
  });

  it("P4 부드러운 가장자리(101 명세 2): 경계를 가로지르면 흙의 불투명도가 안쪽 1에서 바깥 0으로 서서히 바래고(경계가 바래는 곳 안에 있다), 바래는 곳은 안쪽보다 짙지 않다(짙은 띠 없음)", async () => {
    const drawn = await draw();
    const find = bucketed(trianglesOf(plates(drawn)));
    const lines = profiles(loadShapes());
    expect(lines.length).toBeGreaterThan(50);
    const wrong: string[] = [];
    for (const line of lines) {
      const hits = line.map((p) => hitsAt(find, p.x, p.z));
      const opacity = hits.map((h) => opacityOf(h));
      const at = `${line[0].x.toFixed(2)},${line[0].z.toFixed(2)}`;
      const ref = topHit(hits[0]);
      if (!ref || opacity[0] < 0.999) {
        wrong.push(`${at} 안쪽 0.5칸 불투명도 ${opacity[0].toFixed(3)}`);
        continue;
      }
      if (opacity[opacity.length - 1] > 0.001) wrong.push(`${at} 바깥 0.5칸 불투명도 ${opacity[opacity.length - 1].toFixed(3)}`);
      for (let k = 1; k < opacity.length; k += 1) {
        if (opacity[k] > opacity[k - 1] + 0.01) wrong.push(`${at} 바깥으로 가며 짙어짐 ${PROFILE_STEPS[k]} ${opacity[k - 1].toFixed(3)}→${opacity[k].toFixed(3)}`);
      }
      if (!opacity.some((o) => o > 0.02 && o < 0.98)) wrong.push(`${at} 바래는 값 없음 ${opacity.map((o) => o.toFixed(2)).join(" ")}`);
      const justIn = opacity[PROFILE_STEPS.indexOf(0.04)];
      const justOut = opacity[PROFILE_STEPS.indexOf(-0.04)];
      if (!(justIn < 0.98 || justOut > 0.02)) wrong.push(`${at} 경계가 딱 끊김 안 ${justIn.toFixed(3)} 밖 ${justOut.toFixed(3)}`);
      const refLum = luminance(ref.color);
      hits.forEach((list, k) => {
        // 위에서부터 차례로 보고, 위 판들에 가려 거의 보이지 않는 판(위 판들을 지난 빛이 0.01 이하)은 보지 않는다
        let through = 1;
        for (const h of [...list].sort((p, q) => q.order - p.order || q.y - p.y)) {
          const seen = through > 0.01;
          through *= 1 - Math.min(1, Math.max(0, h.alpha));
          if (!seen || h.alpha <= 0.02) continue;
          const darker = luminance(h.color) < refLum * 0.99 || h.color.r < ref.color.r - 0.004 || h.color.g < ref.color.g - 0.004 || h.color.b < ref.color.b - 0.004;
          if (darker) wrong.push(`${at} ${PROFILE_STEPS[k]}칸 짙음 ${srgb255(h.color).join("/")} < ${srgb255(ref.color).join("/")}`);
        }
      });
    }
    expect(wrong.slice(0, 15)).toEqual([]);
  });

  it("P5 길 색은 계절과 관계없이 같다(명세 2): 봄·여름·가을·겨울에 같은 자리의 판 색 배율·흙 불투명도·그림이 같다", async () => {
    const drawn = await draw("summer");
    const { inner, edge } = samplePoints(loadShapes());
    expect(inner.length).toBeGreaterThan(50);
    expect(edge.length).toBeGreaterThan(50);
    const points = [...inner.slice(0, 40), ...edge.slice(0, 40)];
    const looksNow = () => {
      const find = bucketed(trianglesOf(plates(drawn)));
      return points.map((p) => {
        const hits = hitsAt(find, p.x, p.z);
        const top = topHit(hits);
        return top ? `${srgb255(top.color).join("/")} ${opacityOf(hits).toFixed(3)} ${top.map}` : "판 없음";
      });
    };
    const summer = looksNow();
    expect(summer.filter((c) => c === "판 없음")).toEqual([]);
    for (const season of ["autumn", "winter", "spring"] as Season[]) {
      await setSeason(drawn, season);
      expect({ season, looks: looksNow() }).toEqual({ season, looks: summer });
    }
  });
});

// ---------- 그대로 둘 동작 ----------

describe("[spec] 099 그대로 둘 동작: 길 말고는 마을 그리기가 같다", () => {
  it("K1 마을 모델의 다른 묶음(건물·불빛 판·소품·생울타리·울타리·풍차)의 삼각형은 모두 그대로 장면의 같은 이름 묶음 아래에 있고, 불빛 판 말고는 그려진다(낮). 나무 틀은 장면에서 떼어 둔다(112 ③에서 고침: 메시 이름 대신 삼각형 자리로 본다)", async () => {
    const drawn = await draw();
    const { byGroup } = sourceGeometries(drawn.source);
    const objects = allObjects(drawn.roots);
    // 기대값: 그리기에 넘긴 장면과 따로 푼 같은 모델의 묶음별 삼각형(세계 자리)
    const expected = sourceTriangles(sceneFromGlb(nowVillageGlb()));
    for (const top of drawn.source.children) {
      const name = top.name;
      if (name === "paths" || name === "tree-templates") continue;
      // 그린 장면에서 같은 이름의 묶음(풍차 날개는 그리기가 도형을 복제해 옮기므로 도형이 아니라 이름으로 찾는다)
      const drawnTops = objects.filter((o) => o.name === name && o.parent !== null && drawn.roots.includes(o.parent));
      expect({ name, found: drawnTops.length }).toEqual({ name, found: 1 });
      const meshes: THREE.Mesh[] = [];
      drawnTops[0].traverse((o) => {
        if (o instanceof THREE.Mesh) meshes.push(o);
      });
      const shouldShow = !name.startsWith("glow");
      const shown = meshes.filter((m) => drawnVisible(m, drawn.roots));
      // 불빛 판 말고는 그려지는 메시들이, 불빛 판은 장면에 있는 메시들이 모델의 그 묶음 삼각형을 그대로 갖는다. 불빛 판은 하나도 그려지지 않는다
      const got = compareTriangles(
        expected.filter((t) => t.label === name),
        (shouldShow ? shown : meshes).flatMap((m) => meshTriangles(m, name, "")),
        "shape"
      );
      expect({ name, missing: got.missing, extra: got.extra, examples: got.examples, shown: shouldShow || shown.length === 0 }).toEqual({
        name,
        missing: 0,
        extra: 0,
        examples: [],
        shown: true
      });
    }
    const templates = byGroup.get("tree-templates")!;
    expect(objects.filter((o) => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && templates.has(o.geometry))).toEqual([]);
  });

  it("K2 누르기(그대로, 106: 유리 빼고. 112 ③에서 고침: 모델 도형과 같은 물체 대신 삼각형이 건물·소품의 것인 메시로 본다): 누르기 판정 대상은 건물(bld-*, 유리 재질 메시 빼고)과 소품(props)의 메시뿐이고 그 삼각형을 모두 덮으며, 그 밖의 물체(길 포함)는 그 아래에도 없다", async () => {
    const drawn = await draw();
    // 기대값: 그리기에 넘긴 장면과 따로 푼 같은 모델의 삼각형(묶음 이름, 유리 재질 메시는 ":glass"를 붙임)
    const sourceTris = sourceTriangles(sceneFromGlb(nowVillageGlb()), { glass: GLASS_MATERIAL });
    const bank = new TriBank(sourceTris);
    const isAllowed = (label: string) => (label.startsWith("bld-") && !label.endsWith(":glass")) || label === "props";
    const objects = allObjects(drawn.roots);
    const labels = new Map<THREE.Object3D, string>();
    const labelFor = (o: THREE.Object3D) => {
      if (!labels.has(o)) labels.set(o, o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) ? labelOfMesh(o, bank) : "메시 아님");
      return labels.get(o)!;
    };
    const expected = objects.filter((o) => o instanceof THREE.Mesh && drawnVisible(o, drawn.roots) && isAllowed(labelFor(o)));
    expect(drawn.pick.current.length).toBe(expected.length);
    expect(new Set(drawn.pick.current)).toEqual(new Set(expected));
    const strangers: string[] = [];
    for (const target of drawn.pick.current) {
      target.traverse((o) => {
        if (o !== target && o instanceof THREE.Mesh && !isAllowed(labelFor(o))) strangers.push(o.name || o.type);
      });
    }
    expect(strangers).toEqual([]);
    const got = compareTriangles(
      sourceTris.filter((t) => isAllowed(t.label)),
      (drawn.pick.current as THREE.Mesh[]).flatMap((m) => meshTriangles(m, "", "")),
      "shape"
    );
    expect({ missing: got.missing, extra: got.extra, examples: got.examples }).toEqual({ missing: 0, extra: 0, examples: [] });
  });

  it("K3 풀밭의 계절 색(그대로): 계절마다 풀밭 판은 SEASON_COLORS의 ground다(115: 생울타리는 마을 모델에서 빠져 뺐다)", async () => {
    const drawn = await draw("summer");
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
    }
  });
});
