// [spec] qa 테스트(작업 113 새 나무 모델 넣기, 기능 변경, 모바일): 새 나무 GLB 여섯을 앱 자산에 넣고 자산 출처에 적는 것.
// 기대값은 명세(private 작업 폴더 113-2026-11-18-새-나무-모델-넣기/01-main-spec.md)의 "새 나무 모델" 표와 불러오기 11·13에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// - 명세 11은 "apps/mobile/assets/models/ 아래"에 넣는다고만 해서 하위 폴더는 보지 않고 이름으로 찾는다.
// - 명세가 가리킨 파일(C:\WriteLoop-asset\나무\3d\계절\의 GLB 6개)의 sha256은 qa가 그 폴더에서 잰 값이다(CI에는 그 폴더가 없어 테스트가 읽지 않는다).
// - 자산 출처(CREDITS.md)는 표의 줄(| `파일` | 출처 | 라이선스 |)로 읽는다. 기준 커밋 3b11555의 줄은 그대로 차례대로 남아 있어야 한다(명세에 없는 바꿈이 없다).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accessorValues, parseGlb } from "../__fixtures__/village-glb-098";
import { MODELS_DIR, TREE_FILES, findTreeFiles } from "../__fixtures__/village-trees-113";

// 도우미가 three를 읽는다(앱의 다른 테스트처럼 node의 three를 쓴다)
jest.mock("three", () => {
  const nodeModule = (process as unknown as { getBuiltinModule: (id: string) => typeof import("module") }).getBuiltinModule("module");
  const file = require.resolve("three");
  return nodeModule.createRequire(file)(file);
});

const REPO = join(__dirname, "..", "..", "..", "..");
const CREDITS_PATH = "apps/mobile/assets/models/CREDITS.md";
const BASE = "3b11555";

/** 명세가 가리킨 GLB 6개의 sha256(qa가 C:\WriteLoop-asset\나무\3d\계절\에서 잼). */
const SOURCE_SHA256: Record<string, string> = {
  "WriteLoop_Tree_A_LOD1.glb": "70e1a022324d44b065c741a1db67a3f337682ee109c4eb79986131d5836bf3c1",
  "WriteLoop_Tree_A_LOD2.glb": "71ddbef5d41304f710cf40a5c40c59719b06c073b0d88a19ac4d0faae39c0a47",
  "WriteLoop_Tree_B_LOD1.glb": "626479b1148b4ce3784b2ee1f8fc40d6268f5380d2f027fe1219f01c3b7cfbf0",
  "WriteLoop_Tree_B_LOD2.glb": "79ab70710ceb2d7d7e40734c345d79630dd76af401e017dc239e68904676c64b",
  "WriteLoop_Tree_C_LOD1.glb": "d0569c4051bc99998bdb0d459a15dcf4926931e3f2a3fe4cfd6fbaba989496ae",
  "WriteLoop_Tree_C_LOD2.glb": "44775b702c052e7be56abe8746149acf39768f6ed9d377819b4241eb8dad6c0e"
};

/** 명세 "새 나무 모델" 표: 파일마다 삼각형 수와, LOD1의 높이. */
const TRIANGLES: Record<string, number> = {
  "WriteLoop_Tree_A_LOD1.glb": 2907,
  "WriteLoop_Tree_A_LOD2.glb": 692,
  "WriteLoop_Tree_B_LOD1.glb": 2907,
  "WriteLoop_Tree_B_LOD2.glb": 692,
  "WriteLoop_Tree_C_LOD1.glb": 2907,
  "WriteLoop_Tree_C_LOD2.glb": 676
};
const LOD1_HEIGHT: Record<string, number> = { "WriteLoop_Tree_A_LOD1.glb": 2.6, "WriteLoop_Tree_B_LOD1.glb": 2.45, "WriteLoop_Tree_C_LOD1.glb": 3.1 };

/** 표의 줄(| ... |)을 칸으로 나눈다(머리줄과 구분줄은 뺀다). */
function tableRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| `"))
    .map((line) =>
      line
        .slice(1, -1)
        .split(" | ")
        .map((cell) => cell.trim())
    );
}

describe("[spec] 113 불러오기 11·13: 새 나무 GLB를 앱 자산에 넣고 출처에 적는다", () => {
  it("[바뀔] A1 명세가 가리킨 새 나무 GLB 6개가 apps/mobile/assets/models 아래에 같은 이름으로 하나씩, 내용 그대로(sha256 같음) 들어 있다", () => {
    const found = findTreeFiles();
    const rows = TREE_FILES.map((name) => {
      const paths = found.get(name) ?? [];
      return { name, count: paths.length, sha256: paths.length === 1 ? createHash("sha256").update(readFileSync(paths[0])).digest("hex") : null };
    });
    expect(rows).toEqual(TREE_FILES.map((name) => ({ name, count: 1, sha256: SOURCE_SHA256[name] })));
  });

  it("[바뀔] A2 넣은 파일마다 메시 Tree_Foliage(재질 Foliage, 양면 알파 마스크 0.5)와 Tree_Wood(재질 Bark)이 있고, 삼각형 수와 LOD1 높이가 명세 표와 같다", () => {
    const found = findTreeFiles();
    const rows = TREE_FILES.map((name) => {
      const path = found.get(name)?.[0];
      if (!path) return { name, missing: true };
      const glb = parseGlb(readFileSync(path));
      const json = glb.json as typeof glb.json & { materials?: { name?: string; alphaMode?: string; alphaCutoff?: number; doubleSided?: boolean }[] };
      const meshes = json.nodes.filter((n) => n.mesh !== undefined).map((n) => {
        const prim = json.meshes[n.mesh!].primitives[0];
        const material = json.materials![prim.material!];
        return { node: n.name, material: material.name, mask: material.alphaMode === "MASK" ? material.alphaCutoff : null, doubleSided: material.doubleSided ?? false };
      });
      const triangles = json.nodes
        .filter((n) => n.mesh !== undefined)
        .reduce((sum, n) => sum + json.accessors[json.meshes[n.mesh!].primitives[0].indices!].count / 3, 0);
      const height = Math.max(
        ...json.nodes.filter((n) => n.mesh !== undefined).flatMap((n) => accessorValues(glb, json.meshes[n.mesh!].primitives[0].attributes.POSITION).map((p) => p[1]))
      );
      return { name, meshes, triangles, ...(LOD1_HEIGHT[name] !== undefined ? { heightOk: Math.abs(height - LOD1_HEIGHT[name]) <= 0.01 } : {}) };
    });
    expect(rows).toEqual(
      TREE_FILES.map((name) => ({
        name,
        meshes: [
          { node: "Tree_Foliage", material: "Foliage", mask: 0.5, doubleSided: true },
          { node: "Tree_Wood", material: "Bark", mask: null, doubleSided: false }
        ],
        triangles: TRIANGLES[name],
        ...(LOD1_HEIGHT[name] !== undefined ? { heightOk: true } : {})
      }))
    );
  });

  it("[바뀔] A3 자산 출처(CREDITS.md)에 새 나무 줄이 있다: 파일 칸에 WriteLoop_Tree가 든 줄이 하나 이상이고, 그 줄마다 출처 칸에 WriteLoop 제작과 지시서 기반이 적혀 있다", () => {
    const rows = tableRows(readFileSync(join(MODELS_DIR, "CREDITS.md"), "utf8"));
    const trees = rows.filter((cells) => cells[0].includes("WriteLoop_Tree"));
    expect(trees.length).toBeGreaterThan(0);
    expect(trees.map((cells) => ({ file: cells[0], writeloop: cells[1]?.includes("WriteLoop") ?? false, brief: cells[1]?.includes("지시서") ?? false }))).toEqual(
      trees.map((cells) => ({ file: cells[0], writeloop: true, brief: true }))
    );
  });

  it("[그대로] A4 자산 출처의 다른 모델 줄은 기준 커밋과 같고 차례도 같다(나무 줄을 더하기만 한다)", () => {
    const now = tableRows(readFileSync(join(MODELS_DIR, "CREDITS.md"), "utf8")).map((cells) => cells.join(" | "));
    const base = tableRows(execFileSync("git", ["show", `${BASE}:${CREDITS_PATH}`], { cwd: REPO }).toString("utf8")).map((cells) => cells.join(" | "));
    expect(base.length).toBeGreaterThan(0);
    expect(now.filter((row) => base.includes(row))).toEqual(base);
  });
});
