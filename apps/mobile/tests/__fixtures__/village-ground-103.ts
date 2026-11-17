// qa 테스트 도우미(작업 103 마을 흩뿌림·흙길): 계절 흩뿌림 자리 함수의 모양, 흩뿌림 조각을 그린 메시의 그림 칸, 길 판 재질이 셰이더에 넘기는 값의 이름,
// 기준 커밋과 견주는 자산 계산, 길 판의 흙 불투명도 계산.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). 작업 103의 qa 테스트와, 103이 고친 101 테스트(lobby3d-village-decor·lobby3d-village-ground-marks)가 함께 쓴다.
//
// ---- 계절 흩뿌림 자리 함수의 모양(qa가 정했다. 구현은 이 모양에 맞춘다. 02-qa-tests.md "부르는 방법") ----
//   모듈 @/lib/lobby3d/village-decor (apps/mobile/src/lib/lobby3d/village-decor.ts, 101 장식 자리와 같은 모듈). 3D(three)를 쓰지 않는다.
//   export interface VillageScatterPiece { kind: number; x: number; z: number; turn: number; size: number; shade: number }
//   export function villageSeasonScatter(season: Season): VillageScatterPiece[]   // Season은 @/lib/lobby3d/daylight의 "spring" | "summer" | "autumn" | "winter"
//   - 정해진 씨앗값으로 늘 같은 결과다(계절마다). 겨울에는 빈 목록이다.
//   - kind: 조각 그림 모음(4×4 칸)의 칸 번호 0~15. 왼쪽 위부터 줄마다: 줄 = floor(kind / 4)(0 = 그림 모음 1줄), 칸 = kind % 4(0 = 왼쪽).
//     가을은 1·2줄(0~7), 봄은 3줄(8~11), 여름은 4줄(12~15)만 쓴다.
//   - x, z: 마을 칸 좌표(village.ts와 같다). 그리기는 그 자리를 인스턴스의 원점(세계 변환의 옮김 x, z)으로 찍는다.
//   - turn: 세로축 둘레 돌림(라디안). size: 조각 판의 한 변(칸). shade: 밝기 배율(1 = 그림 그대로. 회색으로만 곱한다).
//   - 101의 villageGrassMarks()는 더 쓰지 않는다(남겨 두든 지우든 구현이 정한다. 테스트는 부르지 않는다).
//
// ---- 흩뿌림 조각을 그리는 방법(장면 테스트의 가정) ----
//   - 조각은 인스턴스 메시로 찍는다. 마을 모델(glb) 도형이 아니고 납작하다(높이 0.01칸 이하).
//   - 메시 하나는 한 가지 kind만 찍는다. 그 kind의 그림 칸은 도형의 uv로 고른다(지금 풀 자국처럼). 그림의 offset·repeat·center를 써도 되지만
//     rotation은 0이어야 한다. 테스트는 uv × 그림 변환(offset·repeat·center)이 덮는 범위가 그 kind의 칸 안인지 본다.
//     그림의 flipY가 참이면 그림 맨 위 줄이 v 0.75~1, 거짓이면 v 0~0.25다.
//   - 재질 map은 조각 그림 모음이다. 재질 색은 회색(r = g = b)이고 계절이 바뀌어도 같다(계절 색을 곱하지 않는다). 인스턴스 색이 있으면 회색이다.
//   - 지금 계절이 아닌 조각은 그려지지 않는다(숨기거나, 찍는 수 0이거나, 장면에서 뗀다). 계절이 바뀔 때 메시를 새로 만들어도 된다
//     (장면 테스트는 계절을 바꾼 뒤 그린 장면을 다시 훑는다).
//
// ---- 길 판 재질이 셰이더에 넘기는 값(qa가 정했다) ----
//   "길 판"은 099 테스트와 같다: 인스턴스가 아니고 마을 모델 도형이 아니며, 모든 점이 y −0.0199 초과 0.1 이하이고 가로·깊이가 마을 안인 그려지는 메시.
//   길 판 재질은 지금처럼 MeshLambertMaterial이고, map은 지금처럼 흙 a 그림(가로·세로 RepeatWrapping)이다(099 P2 그대로).
//   흙이 풀로 바래는 바탕은 지금처럼 꼭짓점 색의 알파(색 4성분, vertexColors, transparent)로 만든다(099 P3·P4가 이것으로 불투명도를 계산한다).
//   섞기와 바래는 정도의 잡음은 재질의 onBeforeCompile에서 셰이더를 고쳐 더한다. 그때 shader.uniforms에 아래 이름의 값을 넣는다({ value }).
//   - pathDirtMaps: THREE.Texture 세 장의 배열. 순서는 잔잔한 흙(a), 자갈 많은 흙(b), 다져진 맨땅. 모두 가로·세로 RepeatWrapping.
//     a는 기준 커밋 070ef33의 앱 자산 흙 a 그림(apps/mobile/assets/textures/village/dirt.jpg)과 내용이 같은 파일,
//     맨땅은 기준 커밋의 맨땅 그림(apps/mobile/assets/textures/village/ground-bare.jpg)과 내용이 같은 파일, b는 기준 커밋 뒤에 새로 넣은 그림 파일에서 불러온다.
//   - pathDirtTiles: 수 셋(배열이나 Float32Array). 무늬마다 그림 한 장이 덮는 칸 수. 순서는 위와 같다.
//   - pathNoiseMap: THREE.Texture. 섞을 곳과 바래는 정도를 정하는 부드러운 잡음 그림(파일이든 코드로 만든 그림이든, 풀밭의 잡음 그림을 같이 써도 된다). 선형 거르기.
//   - pathEdgeNoise: 수 하나(0보다 큼). 바래는 정도를 잡음으로 흔드는 세기. 투명한(바래는) 길 판 재질에 넣는다.
//   - 이 이름들은 고친 조각 셰이더 글에 나온다. 값은 계절과 관계없이 같다(길은 계절과 관계없이 같은 색).
//   테스트는 THREE.ShaderLib.lambert의 셰이더 글과 uniforms 복사본으로 onBeforeCompile을 불러(village-splat-102.ts의 readSplat) 값과 셰이더 글을 본다.
//   셰이더 안의 계산(섞는 몫, 가운데를 밝게 하는지, 잡음으로 흔든 불투명도)은 보지 않는다.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import type * as THREE from "three";
import type { Season } from "@/lib/lobby3d/daylight";
import { ASSETS_REL, REPO_DIR, nowAssets } from "./village-splat-102";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const three = () => require("three") as typeof THREE;

/** 작업 103의 기준 커밋(명세 첫 줄). */
export const BASE_103 = "070ef33";
export const DIRT_A_REL = "apps/mobile/assets/textures/village/dirt.jpg";
export const BARE_REL = "apps/mobile/assets/textures/village/ground-bare.jpg";
export const GRASS_MARKS_REL = "apps/mobile/assets/textures/village/grass-marks.png";

export const PATH_UNIFORMS = ["pathDirtMaps", "pathDirtTiles", "pathNoiseMap", "pathEdgeNoise"] as const;

// ---- 계절 흩뿌림 자리 ----

export interface VillageScatterPiece {
  kind: number;
  x: number;
  z: number;
  turn: number;
  size: number;
  shade: number;
}
type ScatterModule = { villageSeasonScatter: (season: Season) => VillageScatterPiece[] };

export function scatterModule(): ScatterModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/lobby3d/village-decor") as ScatterModule;
}

/** 모듈을 새로 읽어(모듈 상태와 관계없이) 부른 결과. */
export function freshScatterModule(): ScatterModule {
  let mod: ScatterModule | null = null;
  jest.isolateModules(() => {
    mod = scatterModule();
  });
  return mod!;
}

/** 흩뿌림 조각이 있는 계절과, 계절마다 쓰는 그림 칸(명세 1: 가을 1·2줄 8가지, 봄 3줄 4가지, 여름 4줄 4가지, 겨울 없음). */
export const SCATTER_SEASONS = ["autumn", "spring", "summer"] as const;
export const SEASON_KINDS: Record<Season, number[]> = {
  autumn: [0, 1, 2, 3, 4, 5, 6, 7],
  spring: [8, 9, 10, 11],
  summer: [12, 13, 14, 15],
  winter: []
};

/**
 * 메시가 그리는 그림 칸(0~15). 도형 uv에 재질 그림의 변환(offset·repeat·center, rotation 0)을 더한 범위가 한 칸 안이면 그 칸 번호, 아니면 이유 글.
 * flipY가 참이면 그림 맨 위 줄이 v 0.75~1이다.
 */
export function drawnCell(mesh: THREE.Mesh): number | string {
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshLambertMaterial;
  const map = material.map;
  if (!map) return "그림 없음";
  if (map.rotation !== 0) return `그림 rotation ${map.rotation}`;
  const uv = mesh.geometry.getAttribute("uv");
  if (!uv || uv.count === 0) return "uv 없음";
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (let i = 0; i < uv.count; i += 1) {
    const u = map.repeat.x * (uv.getX(i) - map.center.x) + map.center.x + map.offset.x;
    const v = map.repeat.y * (uv.getY(i) - map.center.y) + map.center.y + map.offset.y;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  const eps = 1e-6;
  const col = Math.floor((u0 + eps) * 4);
  const band = Math.floor((v0 + eps) * 4);
  if (u1 > (col + 1) / 4 + eps || v1 > (band + 1) / 4 + eps || col < 0 || col > 3 || band < 0 || band > 3) {
    return `한 칸 밖 u ${u0.toFixed(3)}~${u1.toFixed(3)} v ${v0.toFixed(3)}~${v1.toFixed(3)}`;
  }
  const row = map.flipY ? 3 - band : band;
  return row * 4 + col;
}

// ---- 자산(기준 커밋 070ef33과 견줌) ----

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

/** 기준 커밋의 자산 파일 경로들. */
export function baseAssetPaths103(): Set<string> {
  const out = execFileSync("git", ["ls-tree", "-r", "--name-only", BASE_103, "--", ASSETS_REL], { cwd: REPO_DIR, maxBuffer: 16 * 1024 * 1024 }).toString("utf8");
  return new Set(out.split("\n").map((l) => l.trim()).filter(Boolean));
}

/** 기준 커밋 뒤에 새로 넣은 그림 파일(저장소 기준 경로). */
export function newImageFiles103(): string[] {
  const base = baseAssetPaths103();
  return [...nowAssets().keys()].filter((p) => !base.has(p) && IMAGE_EXTS.has(extname(p).toLowerCase())).sort();
}

/** 기준 커밋에 있던 파일 내용의 sha256. */
export function baseFileSha(rel: string): string {
  return sha256(execFileSync("git", ["show", `${BASE_103}:${rel}`], { cwd: REPO_DIR, maxBuffer: 64 * 1024 * 1024 }));
}

/** 작업 폴더의 파일 내용 sha256(없으면 "파일 없음"). */
export function fileSha(rel: string): string {
  try {
    return sha256(readFileSync(join(REPO_DIR, rel)));
  } catch {
    return "파일 없음";
  }
}

// ---- 길 판의 흙 불투명도(099 테스트의 계산과 같다. 셰이더가 잡음으로 흔드는 몫은 계산하지 않는다) ----

export type PathPt = { x: number; z: number };

type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; aa: number; ab: number; ac: number; mesh: number; test: number };

function worldPositions(mesh: THREE.Mesh): THREE.Vector3[] {
  const T = three();
  const pos = mesh.geometry.getAttribute("position");
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i += 1) out.push(new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  return out;
}

/** 꼭짓점마다 바탕 불투명도: 재질이 transparent이면 opacity × 꼭짓점 알파(vertexColors이고 color가 4성분일 때), 아니면 1. 알파 그림(alphaMap)이 있으면 계산할 수 없다. */
function baseAlphas(mesh: THREE.Mesh): number[] {
  const material = mesh.material as THREE.MeshLambertMaterial;
  expect({ alphaMap: material.alphaMap ?? null }).toEqual({ alphaMap: null });
  const colorAttr = material.vertexColors ? mesh.geometry.getAttribute("color") : undefined;
  const count = mesh.geometry.getAttribute("position").count;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) out.push(material.transparent ? material.opacity * (colorAttr && colorAttr.itemSize === 4 ? colorAttr.getW(i) : 1) : 1);
  return out;
}

/** 길 판들의 삼각형을 1칸 격자로 묶어, 점의 흙 불투명도(1 − Π(1 − 판마다 불투명도), alphaTest보다 작으면 0)를 주는 함수. */
export function opacityField(meshes: THREE.Mesh[]): (x: number, z: number) => number {
  const tris: Tri[] = [];
  meshes.forEach((mesh, meshIndex) => {
    const points = worldPositions(mesh);
    const alphas = baseAlphas(mesh);
    const index = mesh.geometry.getIndex();
    const ids = index ? Array.from({ length: index.count }, (_, i) => index.getX(i)) : points.map((_, i) => i);
    for (let i = 0; i + 2 < ids.length; i += 3) {
      const [ia, ib, ic] = [ids[i], ids[i + 1], ids[i + 2]];
      tris.push({ a: points[ia], b: points[ib], c: points[ic], aa: alphas[ia], ab: alphas[ib], ac: alphas[ic], mesh: meshIndex, test: (mesh.material as THREE.Material).alphaTest });
    }
  });
  const grid = new Map<string, Tri[]>();
  for (const t of tris) {
    for (let x = Math.floor(Math.min(t.a.x, t.b.x, t.c.x)); x <= Math.floor(Math.max(t.a.x, t.b.x, t.c.x)); x += 1) {
      for (let z = Math.floor(Math.min(t.a.z, t.b.z, t.c.z)); z <= Math.floor(Math.max(t.a.z, t.b.z, t.c.z)); z += 1) {
        const k = `${x},${z}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(t);
      }
    }
  }
  return (x, z) => {
    const byMesh = new Map<number, number>();
    for (const t of grid.get(`${Math.floor(x)},${Math.floor(z)}`) ?? []) {
      if (byMesh.has(t.mesh)) continue;
      const d = (t.b.z - t.c.z) * (t.a.x - t.c.x) + (t.c.x - t.b.x) * (t.a.z - t.c.z);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / d;
      const v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / d;
      const w = 1 - u - v;
      if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
      const alpha = u * t.aa + v * t.ab + w * t.ac;
      byMesh.set(t.mesh, alpha < t.test ? 0 : alpha);
    }
    return 1 - [...byMesh.values()].reduce((keep, a) => keep * (1 - Math.min(1, Math.max(0, a))), 1);
  };
}

/** 점이 길 판의 삼각형 어느 하나 안에 드는가(불투명도와 관계없이). */
export function coveredBy(meshes: THREE.Mesh[]): (x: number, z: number) => boolean {
  const tris: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3 }[] = [];
  for (const mesh of meshes) {
    const points = worldPositions(mesh);
    const index = mesh.geometry.getIndex();
    const ids = index ? Array.from({ length: index.count }, (_, i) => index.getX(i)) : points.map((_, i) => i);
    for (let i = 0; i + 2 < ids.length; i += 3) tris.push({ a: points[ids[i]], b: points[ids[i + 1]], c: points[ids[i + 2]] });
  }
  return (x, z) =>
    tris.some((t) => {
      const d = (t.b.z - t.c.z) * (t.a.x - t.c.x) + (t.c.x - t.b.x) * (t.a.z - t.c.z);
      if (Math.abs(d) < 1e-12) return false;
      const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / d;
      const v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / d;
      return u >= -1e-9 && v >= -1e-9 && 1 - u - v >= -1e-9;
    });
}
