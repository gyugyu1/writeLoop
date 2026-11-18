// [spec] qa 테스트(작업 113 새 나무 모델 넣기, 기능 변경, 모바일): 새 나무 GLB 여섯을 앱 자산에 넣고 자산 출처에 적는 것.
// 기대값은 명세(private 작업 폴더 113-2026-11-18-새-나무-모델-넣기/01-main-spec.md)의 "새 나무 모델" 표와 불러오기 11·13에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
//
// - 명세 11은 "apps/mobile/assets/models/ 아래"에 넣는다고만 해서 하위 폴더는 보지 않고 이름으로 찾는다.
// - 명세가 가리킨 파일(C:\WriteLoop-asset\나무\3d\계절\의 GLB 6개)의 sha256은 qa가 그 폴더에서 잰 값이다(CI에는 그 폴더가 없어 테스트가 읽지 않는다).
// - 자산 출처(CREDITS.md)는 표의 줄(| `파일` | 출처 | 라이선스 |)로 읽는다. 기준 커밋 3b11555의 줄은 그대로 차례대로 남아 있어야 한다(명세에 없는 바꿈이 없다).
//
// 15-main-decision.md 결정 2(사용자 2026-11-18 "qa가 값을 바꿈"): 가을 잎 칸에 초록·올리브 잎이 섞여 있어, 가을 칸만 다시 칠한 새 파일
// (C:\WriteLoop-asset\나무\3d\계절-가을고침\output\의 GLB 6개)로 바꾼다.
// - A1의 sha256을 새 파일 값으로 바꿨다(qa가 그 폴더에서 잰 값. 테스트는 그 폴더를 읽지 않는다). 단언은 그대로다.
// - A5를 더했다: 앱 자산의 나무 GLB마다 안에 든 잎 그림(Tree_Foliage 재질의 기본 색 그림, PNG)의 가을 칸에, 알파 잘라내기(0.5)를 넘는 픽셀 가운데
//   초록빛 픽셀(HSV 색상 60°~170°, 채도 0.15 초과)이 하나도 없다. 가을 칸은 glTF UV에 (0, 0.5)를 더한 칸이라 그림의 왼쪽 아래 4분의 1이다
//   (glTF UV는 그림 왼쪽 위가 원점이고 v가 아래로 는다). A1·A5는 새 파일을 넣기 전에는 실패해야 한다(바뀔 동작).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accessorValues, imageBytes, parseGlb } from "../__fixtures__/village-glb-098";
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

/** 가을 칸을 다시 칠한 GLB 6개의 sha256(15 결정 2. qa가 C:\WriteLoop-asset\나무\3d\계절-가을고침\output\에서 잼). */
const SOURCE_SHA256: Record<string, string> = {
  "WriteLoop_Tree_A_LOD1.glb": "535189b9cfb8c513564a35d9367c4da2ce175b887933dc79e12735b0f1e9397b",
  "WriteLoop_Tree_A_LOD2.glb": "b9a072850b12e769c05807e56a96203c16c24019126afa59b14eab28f7a59a8d",
  "WriteLoop_Tree_B_LOD1.glb": "c3b31a4166313bc956cc7815a4a650d58a789828070afcf54fc7cc64789a1a36",
  "WriteLoop_Tree_B_LOD2.glb": "fe16501b72f6a15dbd84b482ed7597e6be27ef0a047f78ffadffc41ac377580e",
  "WriteLoop_Tree_C_LOD1.glb": "4442384d4d411c6f3139cade300c5a368f458605036f3f038b5c290b32f3426f",
  "WriteLoop_Tree_C_LOD2.glb": "70e708e9c7187c4a9fa6425a67edceaa7648585ab163b11e766e59b2b36a7e77"
};

/** PNG(8비트, 겹치지 않음, 색 형식 RGBA 6 또는 RGB 2)를 RGBA 픽셀로 푼다. 그 밖의 형식이면 던진다. */
function decodePng(bytes: Buffer): { width: number; height: number; rgba: Uint8Array } {
  const zlib = (process as unknown as { getBuiltinModule: (id: string) => typeof import("zlib") }).getBuiltinModule("zlib");
  if (!bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new Error("PNG가 아님");
  let o = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  while (o < bytes.length) {
    const length = bytes.readUInt32BE(o);
    const type = bytes.toString("latin1", o + 4, o + 8);
    const data = bytes.subarray(o + 8, o + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      colorType = data[9];
      if (depth !== 8 || (colorType !== 6 && colorType !== 2) || data[12] !== 0) throw new Error(`풀 수 없는 PNG 형식(깊이 ${depth}, 색 형식 ${colorType}, 겹침 ${data[12]})`);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    o += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`모르는 PNG 줄 필터 ${filter}`);
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      out.set([cur[x * channels], cur[x * channels + 1], cur[x * channels + 2], channels === 4 ? cur[x * channels + 3] : 255], (y * width + x) * 4);
    }
    prev.set(cur);
  }
  return { width, height, rgba: out };
}

/** HSV 색상(도)과 채도. */
function hueSat(r: number, g: number, b: number): { hue: number; sat: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const sat = max === 0 ? 0 : d / max;
  if (d === 0) return { hue: 0, sat };
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / d) % 6);
  else if (max === g) hue = 60 * ((b - r) / d + 2);
  else hue = 60 * ((r - g) / d + 4);
  if (hue < 0) hue += 360;
  return { hue, sat };
}

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

  it("[바뀔] A5 가을 잎에 초록 없음(15 결정 2): 앱 자산의 나무 GLB마다 잎 그림(Tree_Foliage 재질의 그림)의 가을 칸(그림 왼쪽 아래 4분의 1)에서 알파 0.5 이상인 픽셀 가운데 HSV 색상 60°~170°이고 채도가 0.15보다 큰 초록빛 픽셀이 0개다", () => {
    const found = findTreeFiles();
    const rows = TREE_FILES.map((name) => {
      const path = found.get(name)?.[0];
      if (!path) return { name, missing: true };
      const glb = parseGlb(readFileSync(path));
      const json = glb.json as typeof glb.json & { materials?: { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[] };
      const node = json.nodes.find((n) => n.name === "Tree_Foliage");
      const material = json.materials![json.meshes[node!.mesh!].primitives[0].material!];
      const imageIndex = json.textures![material.pbrMetallicRoughness!.baseColorTexture!.index].source!;
      const { width, height, rgba } = decodePng(imageBytes(glb, imageIndex));
      let opaque = 0;
      let greenish = 0;
      for (let y = Math.floor(height / 2); y < height; y += 1) {
        for (let x = 0; x < Math.floor(width / 2); x += 1) {
          const k = (y * width + x) * 4;
          if (rgba[k + 3] < 128) continue;
          opaque += 1;
          const { hue, sat } = hueSat(rgba[k], rgba[k + 1], rgba[k + 2]);
          if (hue >= 60 && hue <= 170 && sat > 0.15) greenish += 1;
        }
      }
      return { name, autumnHasLeaves: opaque > 0, greenish };
    });
    expect(rows).toEqual(TREE_FILES.map((name) => ({ name, autumnHasLeaves: true, greenish: 0 })));
  });

  it("[그대로] A4 자산 출처의 다른 모델 줄은 기준 커밋과 같고 차례도 같다(나무 줄을 더하기만 한다)", () => {
    const now = tableRows(readFileSync(join(MODELS_DIR, "CREDITS.md"), "utf8")).map((cells) => cells.join(" | "));
    const base = tableRows(execFileSync("git", ["show", `${BASE}:${CREDITS_PATH}`], { cwd: REPO }).toString("utf8")).map((cells) => cells.join(" | "));
    expect(base.length).toBeGreaterThan(0);
    expect(now.filter((row) => base.includes(row))).toEqual(base);
  });
});
