/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 101 마을 땅 무늬, 기능 변경, 모바일): 새로 넣는 그림·모델 자산과, 그대로여야 할 마을 모델 파일.
// 기대값은 명세(private 작업 폴더 101-2026-11-17-마을-땅-무늬/01-main-spec.md의 4와 "그대로여야 할 동작")와 03 결정(4: 그림과 모델을 합쳐 약 1MB 안,
// 3: 꽃·풀 장식은 3D 모델)에서만 가져온다. 견주는 기준은 명세 첫 줄의 기준 커밋 25e9cc7이다.
// 바뀔 동작(구현 전 실패): A1·A2. 그대로 둘 동작(구현 전·뒤 통과): A3·K9.
// "약 1MB 안"은 qa가 1,100,000바이트 이하로 정했다(04-qa-tests.md "가정"). 그림 크기는 PNG·JPEG 머리에서 읽는다(그 밖의 형식이면 실패로 알린다).
// 작업 106(마을 가게 넣기) 명세의 "그 때문에 고칠 기존 테스트"(마을 모델 파일 크기가 두 가게 모델 약 0.6MB씩 늘어난다, 마을 모델 묶음)로 qa가 고쳤다
// (106 qa 보고 02-qa-tests.md). 106은 마을 모델(lobby-village.glb)을 다시 구워 건물을 모델로 바꾼다.
// - A3: 자산 폴더 크기 증가에서 마을 모델 파일(lobby-village.glb)은 뺀다(그 파일은 106이 키운다). 1,100,000바이트 한도는 그대로다.
// - K9: 마을 모델 파일이 바이트까지 같다 → 106이 바꾸는 묶음(건물 bld-*, 창 불빛 판, 옛 길 조각 paths) 밖 묶음의 메시가 기준 커밋과 같다(098 K5와 같은 방법).
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { imageSize, parseGlb } from "../__fixtures__/village-glb-098";
import { VILLAGE_GLB_PATH_106, changedBy106, describeGroups } from "../__fixtures__/village-shops-106";

const MOBILE = join(__dirname, "..", "..");
const REPO = join(MOBILE, "..", "..");
const ASSETS = "apps/mobile/assets";
/** 작업 101의 기준 커밋(명세 첫 줄). */
const BASE = "25e9cc7";
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MODEL_EXTS = new Set([".glb", ".gltf"]);
const LIMIT_BYTES = 1_100_000;

/** 기준 커밋의 자산 파일(저장소 기준 경로 → 크기). */
function baseAssets(): Map<string, number> {
  const out = execFileSync("git", ["ls-tree", "-r", "-l", BASE, "--", ASSETS], { cwd: REPO, maxBuffer: 16 * 1024 * 1024 }).toString("utf8");
  const map = new Map<string, number>();
  for (const line of out.split("\n")) {
    const m = /^\d+ blob [0-9a-f]+\s+(\d+)\t(.+)$/.exec(line.trim());
    if (m) map.set(m[2], Number(m[1]));
  }
  return map;
}

/** 지금 자산 파일(git이 아는 파일, 저장소 기준 경로 → 작업 폴더의 크기). */
function nowAssets(): Map<string, number> {
  const out = execFileSync("git", ["ls-files", "--", ASSETS], { cwd: REPO, maxBuffer: 16 * 1024 * 1024 }).toString("utf8");
  const map = new Map<string, number>();
  for (const path of out.split("\n").map((l) => l.trim()).filter(Boolean)) map.set(path, statSync(join(REPO, path)).size);
  return map;
}

function newFiles(): string[] {
  const base = baseAssets();
  return [...nowAssets().keys()].filter((p) => !base.has(p)).sort();
}

describe("[spec] 101 바뀔 동작: 그림·모델 자산(01의 4, 03 결정 3·4)", () => {
  it("A1 고른 그림과 아스트라가 만든 3D 모델을 앱 자산(apps/mobile/assets 아래)으로 넣었다: 새 그림 파일과 새 모델 파일(.glb/.gltf)이 하나 이상씩 있다", () => {
    const added = newFiles();
    const images = added.filter((p) => IMAGE_EXTS.has(extname(p).toLowerCase()));
    const models = added.filter((p) => MODEL_EXTS.has(extname(p).toLowerCase()));
    expect({ images: images.length > 0, models: models.length > 0, added }).toEqual({ images: true, models: true, added });
  });

  it("A2 그림 크기: 새 그림은 모두 한 변이 1024 이하이고, 흙길 무늬로 쓸 512~1024 크기(가로·세로 모두) 그림이 하나 이상 있다", () => {
    const images = newFiles().filter((p) => IMAGE_EXTS.has(extname(p).toLowerCase()));
    expect(images.length).toBeGreaterThan(0);
    const sizes = images.map((p) => ({ path: p, size: imageSize(readFileSync(join(REPO, p))) }));
    const unreadable = sizes.filter((s) => s.size === null).map((s) => s.path);
    expect({ unreadable }).toEqual({ unreadable: [] });
    const tooBig = sizes.filter((s) => s.size!.width > 1024 || s.size!.height > 1024).map((s) => `${s.path} ${s.size!.width}x${s.size!.height}`);
    expect(tooBig).toEqual([]);
    const pattern = sizes.filter((s) => [s.size!.width, s.size!.height].every((v) => v >= 512 && v <= 1024));
    expect(pattern.length).toBeGreaterThan(0);
  });
});

describe("[spec] 101 그대로 둘 동작: 앱 크기와 마을 모델 파일", () => {
  it("A3 앱 자산 폴더(apps/mobile/assets)의 크기 증가가 기준 커밋보다 1,100,000바이트 이하다(그림과 모델을 합쳐 약 1MB 안. 106이 키우는 마을 모델 파일은 뺀다)", () => {
    const sum = (m: Map<string, number>) => [...m.entries()].filter(([path]) => path !== VILLAGE_GLB_PATH_106).reduce((a, [, b]) => a + b, 0);
    const base = baseAssets();
    expect(base.size).toBeGreaterThan(0);
    const growth = sum(nowAssets()) - sum(base);
    expect({ growth, within: growth <= LIMIT_BYTES }).toEqual({ growth, within: true });
  });

  it("K9 마을 모델 파일(lobby-village.glb)에서 106이 바꾸는 묶음(건물 bld-*, 창 불빛 판, 옛 길 조각 paths) 밖 묶음의 메시가 기준 커밋과 같다(01 그대로: 마을 모델 파일)", () => {
    const path = `${ASSETS}/models/lobby-village.glb`;
    const base = parseGlb(execFileSync("git", ["show", `${BASE}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));
    const now = parseGlb(readFileSync(join(REPO, path)));
    const keep = (name: string) => !changedBy106(name);
    const baseMeshes = describeGroups(base, keep);
    expect(Object.keys(baseMeshes).length).toBeGreaterThan(0);
    expect({ path: relative(REPO, join(REPO, path)).replace(/\\/g, "/"), meshes: describeGroups(now, keep) }).toEqual({ path, meshes: baseMeshes });
  });
});
