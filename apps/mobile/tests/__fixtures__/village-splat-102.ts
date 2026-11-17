// qa 테스트 도우미(작업 102 마을 땅 무늬 섞기): 섞을 자리 지도(맨땅·이끼) 함수의 모양, 풀밭 재질이 셰이더에 넘기는 값의 이름, 가짜 불러오기와 계산.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). lobby3d-village-ground-splat.spec.test.ts와 lobby3d-village-ground-splat.spec.test.tsx가 함께 쓴다.
//
// ---- 자리 지도 함수의 모양(qa가 정했다. 구현은 이 모양에 맞춘다. 02-qa-tests.md "부르는 방법") ----
//   모듈 @/lib/lobby3d/village-ground-splat (apps/mobile/src/lib/lobby3d/village-ground-splat.ts). 3D(three)를 쓰지 않는다.
//   export interface VillageGroundPlaceMap {
//     x0: number; z0: number; x1: number; z1: number;  // 지도가 덮는 땅(마을 칸 좌표, x0 < x1, z0 < z1)
//     width: number; height: number;                    // 픽셀 수(양의 정수)
//     data: Uint8Array;                                 // 길이 width × height × 4. RGBA 8비트
//   }
//   export function villageGroundPlaceMap(): VillageGroundPlaceMap   // 인자 없음. 늘 같은 결과
//   - 픽셀 (i, j)는 data[(j × width + i) × 4 + 채널]이다. i는 x 방향(0 = x0 쪽), j는 z 방향(0 = z0 쪽).
//     픽셀 가운데는 x = x0 + (i + 0.5) × (x1 − x0) / width, z = z0 + (j + 0.5) × (z1 − z0) / height.
//   - R = 맨땅을 섞을 몫(0~255 = 0~1), G = 이끼를 섞을 몫(0~255). B·A는 구현이 정한다(테스트가 보지 않는다).
//   - 짧은 풀·무성한 풀·클로버를 얼마나 섞을지는 셰이더가 잡음 그림으로 정한다(이 지도에 없다).
//
// ---- 풀밭 재질이 셰이더에 넘기는 값(qa가 정했다) ----
//   풀밭 판(y −0.02 판 하나)의 재질은 지금처럼 MeshLambertMaterial이고 color는 계절 색이다(099 K3).
//   섞기는 재질의 onBeforeCompile에서 셰이더를 고쳐 더한다. 그때 shader.uniforms에 아래 이름의 값을 넣는다({ value }).
//   - groundLayerMaps: THREE.Texture 다섯 장의 배열. 순서는 GROUND_LAYERS(짧은 풀, 무성한 풀, 클로버, 이끼, 맨땅).
//   - groundLayerTiles: 수 다섯(배열이나 Float32Array). 무늬마다 그림 한 장이 덮는 칸 수(되풀이 크기). 순서는 위와 같다.
//   - groundLayerTint: 수 다섯. 1 = 그 무늬에 계절 색(재질 color)을 곱한다, 0 = 곱하지 않는다(제 색). 순서는 위와 같다. 계절과 관계없이 [1, 1, 1, 1, 0]이다.
//   - groundNoiseMap: THREE.Texture. 풀 무늬를 섞는 부드러운 잡음 그림(파일이든 코드로 만든 그림이든).
//   - groundPlaceMap: THREE.Texture. image.width·height·data가 villageGroundPlaceMap()의 width·height·data와 같다(R·G 채널을 견준다).
//   - groundBareAmount: 수 하나. 맨땅을 드러내는 정도(자리 지도의 맨땅 몫에 곱한다). 봄·여름·가을 1, 겨울 0(03 결정: 겨울에는 맨땅도 눈으로 덮인다.
//     맨땅 몫이 0이 된 곳은 풀 무늬가 덮고, 풀 무늬는 겨울 계절 색을 곱해 흰 눈밭이 된다). 셰이더가 컴파일된 뒤에도 계절을 따라야 하므로,
//     onBeforeCompile이 넣은 그 { value } 객체의 value가 계절이 바뀔 때 바뀐다(새로 컴파일하지 않아도).
//   테스트는 THREE.ShaderLib.lambert의 셰이더 글과 uniforms 복사본으로 onBeforeCompile을 불러 이 값과, 고친 조각 셰이더 글에 이름이 나오는지를 본다.
//   그림을 못 불러오면 섞기를 하지 않는다: onBeforeCompile이 기본 그대로이거나, 불러도 셰이더 글이 그대로이고 위 이름의 값이 없다.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type * as THREE from "three";

/** three는 쓰는 때에 읽는다(node 환경의 자리 지도·자산 테스트는 three를 읽지 않는다. 장면 테스트는 three를 CommonJS로 가짜 바꿈한다). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const three = () => require("three") as typeof THREE;

export const MOBILE_DIR = join(__dirname, "..", "..");
export const REPO_DIR = join(MOBILE_DIR, "..", "..");
export const ASSETS_REL = "apps/mobile/assets";
/** 작업 102의 기준 커밋(명세 첫 줄). */
export const BASE_102 = "bfbee1a";

export const GROUND_LAYERS = ["shortGrass", "lushGrass", "clover", "moss", "bare"] as const;
export const SPLAT_UNIFORMS = ["groundLayerMaps", "groundLayerTiles", "groundLayerTint", "groundNoiseMap", "groundPlaceMap", "groundBareAmount"] as const;

export interface VillageGroundPlaceMap {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  width: number;
  height: number;
  data: Uint8Array;
}
type SplatModule = { villageGroundPlaceMap: () => VillageGroundPlaceMap };

export function splatModule(): SplatModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/lib/lobby3d/village-ground-splat") as SplatModule;
}

/** 모듈을 새로 읽어(모듈 상태와 관계없이) 부른 결과. */
export function freshSplatModule(): SplatModule {
  let mod: SplatModule | null = null;
  jest.isolateModules(() => {
    mod = splatModule();
  });
  return mod!;
}

/** 지도의 한 채널(0 = R 맨땅, 1 = G 이끼)을 점 (x, z)에서 이웃 네 픽셀로 고르게 읽은 값(0~1). 지도 밖이면 가장자리 픽셀을 쓴다. 그래픽 카드의 선형 거르기와 같다. */
export function sampleMap(map: VillageGroundPlaceMap, channel: 0 | 1, x: number, z: number): number {
  const fx = ((x - map.x0) / (map.x1 - map.x0)) * map.width - 0.5;
  const fz = ((z - map.z0) / (map.z1 - map.z0)) * map.height - 0.5;
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fz);
  const tx = fx - i0;
  const tz = fz - j0;
  const at = (i: number, j: number) => {
    const ci = Math.min(map.width - 1, Math.max(0, i));
    const cj = Math.min(map.height - 1, Math.max(0, j));
    return map.data[(cj * map.width + ci) * 4 + channel] / 255;
  };
  const top = at(i0, j0) * (1 - tx) + at(i0 + 1, j0) * tx;
  const bottom = at(i0, j0 + 1) * (1 - tx) + at(i0 + 1, j0 + 1) * tx;
  return top * (1 - tz) + bottom * tz;
}

/** 점에서 사각형([x0, z0, x1, z1])들까지의 가장 짧은 거리(안이면 0). */
export function rectsDistance(rects: readonly (readonly [number, number, number, number])[], p: { x: number; z: number }): number {
  let best = Infinity;
  for (const [x0, z0, x1, z1] of rects) {
    const dx = Math.max(x0 - p.x, 0, p.x - x1);
    const dz = Math.max(z0 - p.z, 0, p.z - z1);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/** 앱 자산 폴더의 그림 파일(절대 경로). */
export function assetImageFiles(): string[] {
  return listFiles(join(REPO_DIR, ASSETS_REL)).filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()));
}

export const repoRel = (file: string) => relative(REPO_DIR, file).replace(/\\/g, "/");

/** 기준 커밋의 자산 파일(저장소 기준 경로 → 크기). */
export function baseAssets(): Map<string, number> {
  const out = execFileSync("git", ["ls-tree", "-r", "-l", BASE_102, "--", ASSETS_REL], { cwd: REPO_DIR, maxBuffer: 16 * 1024 * 1024 }).toString("utf8");
  const map = new Map<string, number>();
  for (const line of out.split("\n")) {
    const m = /^\d+ blob [0-9a-f]+\s+(\d+)\t(.+)$/.exec(line.trim());
    if (m) map.set(m[2], Number(m[1]));
  }
  return map;
}

/** 지금 자산 파일(git이 아는 파일, 저장소 기준 경로 → 작업 폴더의 크기). */
export function nowAssets(): Map<string, number> {
  const out = execFileSync("git", ["ls-files", "--", ASSETS_REL], { cwd: REPO_DIR, maxBuffer: 16 * 1024 * 1024 }).toString("utf8");
  const map = new Map<string, number>();
  for (const path of out.split("\n").map((l) => l.trim()).filter(Boolean)) map.set(path, statSync(join(REPO_DIR, path)).size);
  return map;
}

/** 기준 커밋 뒤에 새로 넣은 그림 파일(저장소 기준 경로). */
export function newImageFiles(): string[] {
  const base = baseAssets();
  return [...nowAssets().keys()].filter((p) => !base.has(p) && IMAGE_EXTS.has(extname(p).toLowerCase())).sort();
}

/** PNG·JPEG·WebP 머리에서 그림 크기를 읽는다(못 읽으면 null). */
export function imageDims(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o + 4 <= bytes.length) {
      if (bytes[o] !== 0xff) return null;
      const marker = bytes[o + 1];
      const length = bytes.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: bytes.readUInt16BE(o + 7), height: bytes.readUInt16BE(o + 5) };
      }
      o += 2 + length;
    }
    return null;
  }
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const kind = bytes.toString("ascii", 12, 16);
    if (kind === "VP8 ") return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") {
      const b = bytes.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  return null;
}

export function imageDimsOf(rel: string) {
  return imageDims(readFileSync(join(REPO_DIR, rel)));
}

/** 자산 폴더의 그림 파일을 "저장소 기준 경로" 글자로 바꿔 둔다(어느 그림을 불러왔는지 알려고). 마을 그리기 모듈을 require하기 전에 부른다. */
export function mockImagesAsPaths(): void {
  for (const file of assetImageFiles()) {
    const rel = repoRel(file);
    jest.doMock(file, () => rel);
  }
}

// ---- 가짜 불러오기 ----

/** failNew가 참이면 기준 커밋 뒤에 새로 넣은 그림을 불러올 때 오류를 던진다. urlOf는 가짜 그림 → 불러온 파일(저장소 기준 경로). */
export const splatLoader = {
  failNew: false,
  newImages: new Set<string>(),
  urlOf: new WeakMap<THREE.Texture, string>()
};

function isTextureLoader(loader: unknown): boolean {
  if (typeof loader !== "function") return false;
  const ctor = loader as { name?: string; prototype?: unknown };
  return ctor === three().TextureLoader || ctor.prototype instanceof three().TextureLoader || /texture/i.test(ctor.name ?? "");
}

/**
 * 가짜 useLoader. 그림 로더면 빈 THREE.Texture를 주고 어느 파일인지 적어 둔다(failNew면 새 그림에서 오류).
 * 그 밖(마을 모델·꽃 모델)은 작업 101의 가짜 불러오기(village-scene-101.ts의 fakeUseLoader)에 넘긴다.
 */
export function splatUseLoader(loader: unknown, input: unknown, fallback: (loader: unknown, input: unknown) => unknown): unknown {
  const one = (url: unknown): unknown => {
    if (isTextureLoader(loader)) {
      const key = String(url);
      if (splatLoader.failNew && splatLoader.newImages.has(key)) throw new Error(`가짜 불러오기 실패(시험): ${key}`);
      const texture = new (three().Texture)();
      splatLoader.urlOf.set(texture, key);
      return texture;
    }
    return fallback(loader, url);
  };
  return Array.isArray(input) ? input.map(one) : one(input);
}

// ---- 셰이더 값 읽기 ----

export type SplatRead = {
  /** onBeforeCompile이 기본(THREE.Material.prototype의 것)과 다른가. */
  custom: boolean;
  uniforms: Record<string, { value: unknown }>;
  fragmentBefore: string;
  fragmentAfter: string;
  vertexAfter: string;
};

/** 재질의 onBeforeCompile을 Lambert 셰이더 글과 uniforms 복사본으로 불러, 넣은 값과 고친 셰이더 글을 읽는다. */
export function readSplat(material: THREE.Material): SplatRead {
  const T = three();
  const lib = T.ShaderLib.lambert;
  const shader = {
    name: "MeshLambertMaterial",
    uniforms: T.UniformsUtils.clone(lib.uniforms) as Record<string, { value: unknown }>,
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    defines: {} as Record<string, unknown>
  };
  const custom = material.onBeforeCompile !== T.Material.prototype.onBeforeCompile;
  if (custom) material.onBeforeCompile(shader as never, {} as never);
  return { custom, uniforms: shader.uniforms, fragmentBefore: lib.fragmentShader, fragmentAfter: shader.fragmentShader, vertexAfter: shader.vertexShader };
}

export const numbers = (v: unknown): number[] => (v && typeof (v as ArrayLike<number>).length === "number" ? Array.from(v as ArrayLike<number>) : []);
