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
// 작업 116(나무 A·Pine 세트) 명세의 "고칠 기존 테스트"(A·B·C 전제의 GLB 목록·해시·삼각형·높이, CREDITS 나무 줄, 가을 초록 없음 검사는 A에만)로 qa가 고쳤다:
// - 앱 자산의 나무 GLB는 A·Pine 넷(LOD1·2)이고, sha256·삼각형 수(수관+목재)·높이는 명세 "새 모델" 표와 같다(sha256은 qa가 C:\WriteLoop-asset\나무\3d\계절\마을세트\에서 잰 값).
// - A5는 A의 잎 그림에만 적용한다. A5b를 더했다: Pine 잎 그림은 가을 칸에도 초록 잎이 있고, 겨울 칸에 눈(흰색)과 초록이 함께 있다. A5c: A 잎 그림의 겨울 칸은 비어 있다(A는 겨울에 수관을 숨긴다).
// - A3: CREDITS 나무 줄을 A·Pine 4개 기준으로 본다(B·C 이름·"다섯"이 없고, 넷이 모두 적혀 있다). 지시서 기반이라는 말은 명세가 정하지 않아 더 보지 않는다.
// 작업 114(마을 벤치 모델) 03-main-decision.md(사용자 2026-11-18 "qa가 고침"): 114가 CREDITS의 마을 모델(`lobby-village.glb`) 줄을 고친다(벤치는 WriteLoop 제작).
// 그래서 A4는 양쪽에서 파일 칸이 `lobby-village.glb`인 줄만 빼고 견준다(그 줄은 100 N6·098 C10·088 F3·wearables·114 B8이 따로 본다). 나머지 단언은 그대로다.
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

/** 116 마을세트 GLB 4개의 sha256(qa가 C:\WriteLoop-asset\나무\3d\계절\마을세트\에서 잼). */
const SOURCE_SHA256: Record<string, string> = {
  "WriteLoop_Tree_A_LOD1.glb": "66e7ad0ec6d54c115e53ab088e46cc7993c31a56812022cdc45272ccc32c1041",
  "WriteLoop_Tree_A_LOD2.glb": "acbc0b1bb4558258425a91a13869f84300d92b54e7a148941887738e93382347",
  "WriteLoop_Tree_Pine_LOD1.glb": "0f93b7d65b694b2c870003ccbffd935961ac7800a78b4e43dc7eac78ccb3fb1a",
  "WriteLoop_Tree_Pine_LOD2.glb": "c359ed9600c5c158cab5c922134d380942916d075f1bc13b59a98c6255c8f417"
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

/** 116 명세 "새 모델" 표: 파일마다 삼각형 수(수관+목재)와 높이. */
const TRIANGLES: Record<string, number> = {
  "WriteLoop_Tree_A_LOD1.glb": 2284 + 532,
  "WriteLoop_Tree_A_LOD2.glb": 416 + 212,
  "WriteLoop_Tree_Pine_LOD1.glb": 2184 + 360,
  "WriteLoop_Tree_Pine_LOD2.glb": 624 + 72
};
const HEIGHT: Record<string, number> = {
  "WriteLoop_Tree_A_LOD1.glb": 2.99,
  "WriteLoop_Tree_A_LOD2.glb": 2.99,
  "WriteLoop_Tree_Pine_LOD1.glb": 3.25,
  "WriteLoop_Tree_Pine_LOD2.glb": 3.25
};

const A_FILES = TREE_FILES.filter((name) => name.includes("_A_"));
const PINE_FILES = TREE_FILES.filter((name) => name.includes("_Pine_"));

/** 잎 그림(Tree_Foliage 재질의 그림)의 계절 칸(봄 왼쪽 위, 여름 오른쪽 위, 가을 왼쪽 아래, 겨울 오른쪽 아래)에서 알파 0.5 이상 픽셀 수·초록빛 픽셀 수·흰색 픽셀 수(채도 0.1 미만, 밝기 0.85 초과). */
function foliageCells(name: string): Record<"spring" | "summer" | "autumn" | "winter", { opaque: number; greenish: number; white: number }> {
  const path = findTreeFiles().get(name)?.[0];
  if (!path) throw new Error(`나무 파일이 앱 자산 폴더에 없음: ${name}`);
  const glb = parseGlb(readFileSync(path));
  const json = glb.json as typeof glb.json & { materials?: { pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[] };
  const node = json.nodes.find((n) => n.name === "Tree_Foliage");
  const material = json.materials![json.meshes[node!.mesh!].primitives[0].material!];
  const imageIndex = json.textures![material.pbrMetallicRoughness!.baseColorTexture!.index].source!;
  const { width, height, rgba } = decodePng(imageBytes(glb, imageIndex));
  const cell = (cx: number, cy: number) => {
    let opaque = 0;
    let greenish = 0;
    let white = 0;
    for (let y = (cy * height) / 2; y < ((cy + 1) * height) / 2; y += 1) {
      for (let x = (cx * width) / 2; x < ((cx + 1) * width) / 2; x += 1) {
        const k = (y * width + x) * 4;
        if (rgba[k + 3] < 128) continue;
        opaque += 1;
        const { hue, sat } = hueSat(rgba[k], rgba[k + 1], rgba[k + 2]);
        if (hue >= 60 && hue <= 170 && sat > 0.15) greenish += 1;
        if (sat < 0.1 && Math.max(rgba[k], rgba[k + 1], rgba[k + 2]) / 255 > 0.85) white += 1;
      }
    }
    return { opaque, greenish, white };
  };
  return { spring: cell(0, 0), summer: cell(1, 0), autumn: cell(0, 1), winter: cell(1, 1) };
}

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
  it("[바뀔] A1 명세가 가리킨 나무 GLB 4개(A·Pine × LOD1·LOD2)가 apps/mobile/assets/models 아래에 같은 이름으로 하나씩, 내용 그대로(sha256 같음) 들어 있다", () => {
    const found = findTreeFiles();
    const rows = TREE_FILES.map((name) => {
      const paths = found.get(name) ?? [];
      return { name, count: paths.length, sha256: paths.length === 1 ? createHash("sha256").update(readFileSync(paths[0])).digest("hex") : null };
    });
    expect(rows).toEqual(TREE_FILES.map((name) => ({ name, count: 1, sha256: SOURCE_SHA256[name] })));
  });

  it("[바뀔] A2 넣은 파일마다 메시 Tree_Foliage(재질 Foliage, 양면 알파 마스크 0.5)와 Tree_Wood(재질 Bark)이 있고, 삼각형 수와 높이가 명세 표와 같다", () => {
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
      return { name, meshes, triangles, ...(HEIGHT[name] !== undefined ? { heightOk: Math.abs(height - HEIGHT[name]) <= 0.01 } : {}) };
    });
    expect(rows).toEqual(
      TREE_FILES.map((name) => ({
        name,
        meshes: [
          { node: "Tree_Foliage", material: "Foliage", mask: 0.5, doubleSided: true },
          { node: "Tree_Wood", material: "Bark", mask: null, doubleSided: false }
        ],
        triangles: TRIANGLES[name],
        ...(HEIGHT[name] !== undefined ? { heightOk: true } : {})
      }))
    );
  });

  it("[바뀔] A3 자산 출처(CREDITS.md)의 나무 줄은 A·Pine 4개 기준이다(116 명세 5): 파일 칸에 WriteLoop_Tree가 든 줄의 글에 B·C 이름과 '다섯'이 없고, 4개 파일이 모두 적혀 있으며(한 줄이 첫 파일 '외 셋'으로 묶어도 된다) 출처 칸에 WriteLoop 제작이 적혀 있다", () => {
    const rows = tableRows(readFileSync(join(MODELS_DIR, "CREDITS.md"), "utf8"));
    const trees = rows.filter((cells) => cells[0].includes("WriteLoop_Tree"));
    expect(trees.length).toBeGreaterThan(0);
    const fileCells = trees.map((cells) => cells[0]).join(" ");
    const listed = TREE_FILES.filter((name) => fileCells.includes(name));
    const grouped = listed.length === 1 && fileCells.includes("외 셋");
    expect({
      allFour: listed.length === TREE_FILES.length || grouped,
      mentionsPine: trees.some((cells) => cells[0].includes("Pine")),
      oldKinds: trees.filter((cells) => /Tree_[BC]_|·B|B·|·C|C·|다섯|여섯|그늘형|휘어/.test(cells.join(" "))).map((cells) => cells[0]),
      writeloop: trees.map((cells) => cells[1]?.includes("WriteLoop") ?? false)
    }).toEqual({ allFour: true, mentionsPine: true, oldKinds: [], writeloop: trees.map(() => true) });
  });

  it("[바뀔] A5 가을 잎에 초록 없음(15 결정 2. 116: A에만): 앱 자산의 A 나무 GLB(LOD1·LOD2)마다 잎 그림(Tree_Foliage 재질의 그림)의 가을 칸(그림 왼쪽 아래 4분의 1)에서 알파 0.5 이상인 픽셀 가운데 HSV 색상 60°~170°이고 채도가 0.15보다 큰 초록빛 픽셀이 0개다", () => {
    const found = findTreeFiles();
    const rows = A_FILES.map((name) => {
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
    expect(rows).toEqual(A_FILES.map((name) => ({ name, autumnHasLeaves: true, greenish: 0 })));
  });

  it("[바뀔] A5b Pine 잎은 가을에도 초록이다(116 명세 4): Pine LOD1·LOD2 잎 그림의 가을 칸에 알파 0.5 이상 픽셀 가운데 초록빛(HSV 색상 60°~170°, 채도 0.15 초과) 픽셀이 있고, 겨울 칸에는 눈(흰색) 픽셀과 초록빛 픽셀이 함께 있다", () => {
    expect(PINE_FILES).toHaveLength(2);
    const rows = PINE_FILES.map((name) => {
      const cells = foliageCells(name);
      return { name, autumnGreen: cells.autumn.greenish > 0, winterSnow: cells.winter.white > 0, winterGreen: cells.winter.greenish > 0 };
    });
    expect(rows).toEqual(PINE_FILES.map((name) => ({ name, autumnGreen: true, winterSnow: true, winterGreen: true })));
  });

  it("[바뀔] A5c A 잎 그림의 겨울 칸에는 그려지는 잎이 없다(116 명세 4 '겨울에는 A의 잎만 숨긴다'의 바탕): A LOD1·LOD2 잎 그림의 겨울 칸에서 알파 0.5 이상 픽셀이 0개이고 봄·여름·가을 칸에는 있다", () => {
    expect(A_FILES).toHaveLength(2);
    const rows = A_FILES.map((name) => {
      const c = foliageCells(name);
      return { name, winterOpaque: c.winter.opaque, others: [c.spring.opaque, c.summer.opaque, c.autumn.opaque].every((n) => n > 0) };
    });
    expect(rows).toEqual(A_FILES.map((name) => ({ name, winterOpaque: 0, others: true })));
  });

  it("[그대로] A4 자산 출처의 다른 모델 줄은 기준 커밋과 같고 차례도 같다(나무 줄을 더하기만 한다)", () => {
    // 114: 마을 모델(`lobby-village.glb`) 줄은 양쪽에서 뺀다
    // 134 ①(사용자 결정 12): 사람형 플레이어(player-human.glb) 줄 추가와 라룹이(writeloop.glb) 줄 변경도 양쪽에서 뺀다.
    // 134 ②(사용자 결정 04): 사람형 고글(wear-goggles-human.glb) 줄 추가도 양쪽에서 뺀다
    const notVillage = (cells: string[]) => cells[0] !== "`lobby-village.glb`" && cells[0] !== "`player-human.glb`" && cells[0] !== "`wear-goggles-human.glb`" && cells[0] !== "`writeloop.glb`";
    const now = tableRows(readFileSync(join(MODELS_DIR, "CREDITS.md"), "utf8")).filter(notVillage).map((cells) => cells.join(" | "));
    const base = tableRows(execFileSync("git", ["show", `${BASE}:${CREDITS_PATH}`], { cwd: REPO }).toString("utf8")).filter(notVillage).map((cells) => cells.join(" | "));
    expect(base.length).toBeGreaterThan(0);
    expect(now.filter((row) => base.includes(row))).toEqual(base);
  });
});
