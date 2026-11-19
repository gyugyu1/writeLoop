// [spec] qa 테스트(작업 127 마을 노점 없애기, 기능 변경, 모바일). 기대값은 명세(private/work/127-2026-11-19-마을-노점-없애기/01-main-spec.md)와
// 기준 커밋 e17b97c의 지금 값에서만 가져온다. 노점 자리는 명세가 적은 두 곳(x 27.5·z 29.5, x 43.5·z 29.5)이다.
// 구현 코드는 부르는 방법(village-layout.json, engine.ts의 applyArea·isFree·findPath, village.ts의 VILLAGE_SOLID_TILES)을 알려고만 읽었다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyArea, findPath, isFree } from "@/lib/lobby3d/engine";
import { VILLAGE_PLACES } from "@/lib/lobby3d/village";
import LAYOUT from "@/lib/lobby3d/village-layout.json";
import {
  CREDITS_PATH,
  REPO,
  VILLAGE_GLB_PATH,
  accessorValues,
  meshNodesUnder,
  nowVillageGlb,
  parseGlb,
  rootIndex,
  sceneRoots,
  worldMatrices,
  type Glb
} from "../__fixtures__/village-glb-098";

const BASE_127 = "e17b97c";
const SCRIPT = "scripts/lobby3d/build-village.py";
const STALLS: readonly (readonly [number, number])[] = [
  [27.5, 29.5],
  [43.5, 29.5]
];

const baseText = (path: string) => execFileSync("git", ["show", `${BASE_127}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
const nowText = (path: string) => readFileSync(join(REPO, path), "utf8");
const codeLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

/** 소품 묶음(props)의 삼각형 가운데 세 점이 모두 (x, z)에서 1.2칸 안에 있는 것의 수(노점은 2×2칸). */
function propsTrianglesAround(glb: Glb, x: number, z: number): number {
  const root = rootIndex(glb, "props");
  if (root < 0) return 0;
  const matrices = worldMatrices(glb);
  let count = 0;
  for (const node of meshNodesUnder(glb, root)) {
    const m = matrices.get(node)!;
    for (const prim of glb.json.meshes[glb.json.nodes[node].mesh!].primitives) {
      const world = accessorValues(glb, prim.attributes.POSITION).map(([a, b, c]) => [m[0] * a + m[4] * b + m[8] * c + m[12], m[1] * a + m[5] * b + m[9] * c + m[13], m[2] * a + m[6] * b + m[10] * c + m[14]]);
      const index = prim.indices !== undefined ? accessorValues(glb, prim.indices).map((v) => v[0]) : [...world.keys()];
      for (let i = 0; i + 2 < index.length; i += 3) {
        const inside = [index[i], index[i + 1], index[i + 2]].every((v) => Math.abs(world[v][0] - x) <= 1.2 && Math.abs(world[v][2] - z) <= 1.2);
        if (inside) count += 1;
      }
    }
  }
  return count;
}

describe("[spec] 127 마을에 노점이 없다(명세 1)", () => {
  it("[바뀔] N1 배치 파일(village-layout.json)에 stalls 열쇠가 없다(기준 커밋에는 노점 둘이 있었다)", () => {
    const base = JSON.parse(baseText("apps/mobile/src/lib/lobby3d/village-layout.json")) as Record<string, unknown>;
    expect((base.stalls as unknown[]).length).toBe(2);
    expect("stalls" in (LAYOUT as unknown as Record<string, unknown>)).toBe(false);
  });

  it("[그대로] N2 배치 파일의 다른 열쇠는 기준 커밋과 같다(건물 셋, 분수, 가로등 넷, 벤치 둘, 바위, 길, 나무, 경계 원). 설명(_comment)은 보지 않는다", () => {
    const strip = (layout: Record<string, unknown>) => {
      const { _comment: _c, stalls: _s, ...rest } = layout;
      return rest;
    };
    const base = JSON.parse(baseText("apps/mobile/src/lib/lobby3d/village-layout.json")) as Record<string, unknown>;
    expect(strip(LAYOUT as unknown as Record<string, unknown>)).toEqual(strip(base));
  });
});

describe("[spec] 127 노점이 있던 자리는 걸을 수 있다(명세 3)", () => {
  beforeAll(() => applyArea("village"));

  it("[바뀔] N3 노점 자리 가운데(27.5, 29.5)·(43.5, 29.5)에 설 수 있다", () => {
    for (const [x, z] of STALLS) expect({ x, z, free: isFree(x, z) }).toEqual({ x, z, free: true });
  });

  it("[바뀔] N4 그 자리를 누르면 그 자리로 걸어간다: 집 문 앞에서 길을 찾으면 끝이 노점 자리 가운데다", () => {
    const start = VILLAGE_PLACES.home.approach[0];
    for (const [x, z] of STALLS) {
      const path = findPath(start, [{ x, z }]);
      expect({ x, z, found: path !== null }).toEqual({ x, z, found: true });
      expect(path![path!.length - 1]).toEqual({ x, z });
    }
  });
});

describe("[spec] 127 마을 모델과 만드는 스크립트(명세 2, 2-1)", () => {
  it("[바뀔] G1 마을 모델의 소품 묶음(props)에서 노점 자리 둘레에 삼각형이 없다(기준 커밋 모델에는 있었다)", () => {
    const base = parseGlb(execFileSync("git", ["show", `${BASE_127}:${VILLAGE_GLB_PATH}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));
    const now = nowVillageGlb();
    for (const [x, z] of STALLS) {
      expect({ x, z, base: propsTrianglesAround(base, x, z) > 0 }).toEqual({ x, z, base: true });
      expect({ x, z, now: propsTrianglesAround(now, x, z) }).toEqual({ x, z, now: 0 });
    }
  });

  it("[그대로] G2 마을 모델의 장면 뿌리 묶음 이름이 기준 커밋과 같다(bld-<id>, glow-*, props, paths, tpl-*)", () => {
    const names = (glb: Glb) => sceneRoots(glb).map((i) => glb.json.nodes[i].name ?? "").sort();
    const base = parseGlb(execFileSync("git", ["show", `${BASE_127}:${VILLAGE_GLB_PATH}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }));
    expect(names(nowVillageGlb())).toEqual(names(base));
  });

  it("[바뀔] S1 build-village.py에 노점 코드(stall-red·stall-green·LAYOUT[\"stalls\"])가 없다(기준 커밋에는 있었다)", () => {
    const stall = (l: string) => /stall|LAYOUT\["stalls"\]/.test(l);
    expect(codeLines(baseText(SCRIPT)).some(stall)).toBe(true);
    expect(codeLines(nowText(SCRIPT)).filter(stall)).toEqual([]);
  });

  it("[바뀔] S2 build-village.py는 노점 줄 밖의 코드 줄이 기준 커밋과 같고 노점 놓기 반복문과 그 안의 줄만 빠진다", () => {
    const base = codeLines(baseText(SCRIPT));
    const from = base.findIndex((l) => l.includes('LAYOUT["stalls"]'));
    expect(from).toBeGreaterThanOrEqual(0);
    // 반복문 줄과 바로 뒤 들여쓴 본문 한 줄(stall-red·stall-green을 놓는 줄)을 뺀다
    const without = base.filter((_, i) => i !== from && i !== from + 1);
    expect(codeLines(nowText(SCRIPT))).toEqual(without);
  });

  it("[바뀔] S3 스크립트 머리말과 앱 막힌 칸 코드의 설명에 노점이 없다(village.ts, build-village.py)", () => {
    expect(nowText(SCRIPT)).not.toContain("노점");
    expect(nowText("apps/mobile/src/lib/lobby3d/village.ts")).not.toContain("노점");
    expect(nowText("apps/mobile/src/lib/lobby3d/village.ts")).not.toContain("stalls");
  });
});

describe("[spec] 127 출처 기록(명세 4)", () => {
  const villageLine = (text: string) => text.split(/\r?\n/).filter((l) => l.includes("`lobby-village.glb`"))[0];
  const parts = (line: string) => line.slice(line.indexOf("Fantasy Town Kit"), line.indexOf("`scripts/lobby3d/build-village.py`", line.indexOf("Fantasy Town Kit")));

  it("[바뀔] C1 CREDITS.md 마을 모델 줄의 Kenney 부품 목록에서 노점이 빠지고, 바위·길은 남는다", () => {
    const now = parts(villageLine(nowText(CREDITS_PATH)));
    expect(parts(villageLine(baseText(CREDITS_PATH))).includes("노점")).toBe(true);
    expect({ now, stall: now.includes("노점"), missing: ["바위", "길"].filter((w) => !now.includes(w)) }).toEqual({ now, stall: false, missing: [] });
  });

  it("[그대로] C2 CREDITS.md의 다른 줄(마을 모델 줄 밖)과 마을 모델 줄의 Kenney 부품 목록 밖의 글은 기준 커밋과 같다", () => {
    const others = (text: string) => text.split(/\r?\n/).filter((l) => !l.includes("`lobby-village.glb`") && !l.startsWith("| `shop/")); // 128(가구점 실내, 03 결정 2): 가구점 모델 줄(`shop/…`)은 양쪽에서 뺀다
    expect(others(nowText(CREDITS_PATH))).toEqual(others(baseText(CREDITS_PATH)));
    const rest = (text: string) => {
      const line = villageLine(text);
      return line.slice(0, line.indexOf("Fantasy Town Kit")) + line.slice(line.indexOf("`scripts/lobby3d/build-village.py`", line.indexOf("Fantasy Town Kit")));
    };
    expect(rest(nowText(CREDITS_PATH))).toBe(rest(baseText(CREDITS_PATH)));
  });
});
