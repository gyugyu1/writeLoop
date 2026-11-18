// qa 테스트 도우미(작업 113 새 나무 모델 넣기): 새 나무 GLB 여섯(WriteLoop_Tree_<A·B·C>_LOD<1·2>.glb)의 이름·자리와, 앱 코드가 그 파일을 require할 때의 가짜.
// 이 파일은 테스트가 아니다(testMatch는 *.test.ts만 돈다). three를 읽지 않아 어느 테스트에서도 쓸 수 있다. 나무 모델 풀기는 village-trees-113.ts에 있다.
//
// - 나무 파일은 앱 자산 폴더(apps/mobile/assets/models 아래 어디든)에서 이름으로 찾는다. 명세 11은 "apps/mobile/assets/models/ 아래"만 정해서
//   하위 폴더는 정하지 않았다. 파일이 아직 없으면(구현 전) assets/models/trees/<이름>으로 가정한다.
//   CI에는 C:\WriteLoop-asset이 없으므로 그 폴더는 읽지 않는다.
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

export const MODELS_DIR = join(__dirname, "..", "..", "assets", "models");
export const TREE_KINDS = ["A", "B", "C"] as const;
export const TREE_LODS = [1, 2] as const;
export type TreeKind = (typeof TREE_KINDS)[number];
export type TreeLod = (typeof TREE_LODS)[number];

export const treeFileName = (kind: TreeKind, lod: TreeLod) => `WriteLoop_Tree_${kind}_LOD${lod}.glb`;
export const TREE_FILES = TREE_KINDS.flatMap((kind) => TREE_LODS.map((lod) => treeFileName(kind, lod)));
export const TREE_FILE_RE = /^WriteLoop_Tree_([ABC])_LOD([12])\.glb$/;

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/** 앱 자산 폴더(assets/models 아래)에서 나무 파일 이름마다 찾은 경로들. */
export function findTreeFiles(): Map<string, string[]> {
  const out = new Map<string, string[]>(TREE_FILES.map((n) => [n, []]));
  for (const file of listFiles(MODELS_DIR)) {
    const name = basename(file);
    if (out.has(name)) out.get(name)!.push(file);
  }
  return out;
}

/** 나무 파일의 경로(찾았으면 그 경로, 없으면 가정한 assets/models/trees/<이름>). */
export function treeAssetPath(name: string): string {
  return findTreeFiles().get(name)?.[0] ?? join(MODELS_DIR, "trees", name);
}

/** 나무 파일의 assets/models에서의 상대 경로(/로 잇는다). */
export function treeAssetRel(name: string): string {
  return relative(MODELS_DIR, treeAssetPath(name)).split("\\").join("/");
}

/** 앱 코드가 나무 파일을 require하면 valueOf(파일 이름, assets/models에서의 상대 경로)를 주게 한다. 파일이 아직 없어도 된다(가상 모듈). */
export function mockTreeAssets(valueOf: (name: string, rel: string) => unknown): void {
  for (const name of TREE_FILES) {
    const rel = treeAssetRel(name);
    jest.doMock(treeAssetPath(name), () => valueOf(name, rel), { virtual: true });
  }
}

export function isTreeUrl(url: unknown): url is string {
  return typeof url === "string" && TREE_FILE_RE.test(basename(url));
}
