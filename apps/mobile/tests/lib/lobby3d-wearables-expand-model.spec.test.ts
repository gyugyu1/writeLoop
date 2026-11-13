/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 089 ⑤ 아이템 늘리기, 새 기능, 모바일): 착용 모델 파일과 칸 그림 파일(시나리오 F1~F5), 파일에서만 볼 수 있는 모양·색
// (R2의 파랑·초록 모자가 주황 모자와 같은 모양, R3의 새 넷 색 이름, R4의 모자 셋이 서로 다름, R5 모자 무늬의 주황 부분만 바뀜).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/03-qa-scenarios.md의 F, R2·R3·R5, "용어와 가정"의 색 이름 판정)와
// 04-main-decision.md B(A-5 모델 안 이름, B-3 머플러는 단단히, B-4 파랑·초록 모자는 그림의 주황 부분 색상을 파랑 212°·초록 128°로,
// B-6 그림을 비교할 수 있으면 테스트로)에서만 가져온다.
// 구현 커밋 cb62c3b에서 읽은 것은 모델 안 이름뿐이다(wear-hat-blue, wear-hat-green, wear-sunglasses, wear-backpack, wear-muffler, wear-necklace).
// "이미 있는 넷 그대로"(F3)와 "라룹이 모델 그대로"(F4)는 이번 작업 전 기준 커밋 6e2f069의 파일과 견준다(git show).
// 색 이름 판정은 시나리오 "용어와 가정"의 HSV 기준이고, glTF 재질 색(선형)을 sRGB로 바꿔 본다.
// R5의 "주황인 점"은 시나리오의 주황 판정(색상 15°~45°, 채도 ≥ 0.5)에 명도 ≥ 0.35를 둔 뚜렷한 주황이고, "주황이 아닌 점"은 채도 < 0.2이거나
// 색상 70°~330°(채도 ≥ 0.2)인 뚜렷하게 다른 색이다. 둘 사이의 경계 점은 보지 않는다. 바뀐 색상은 04 결정 B-4의 값에서 ±12° 안이다.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const MOBILE = join(__dirname, "..", "..");
const REPO = join(MOBILE, "..", "..");
const WEARABLES = join(MOBILE, "assets", "models", "lobby-wearables.glb");
const CHARACTER = join(MOBILE, "assets", "models", "writeloop.glb");
// 090-③ 옷 내려받기(05-main-decision 2, 사용자 결정): 옷 칸 그림은 앱에서 빠지고 서버 아이템 목록 폴더로 옮겼다. F5는 그 폴더에서 본다(단언은 그대로)
const ICONS = join(REPO, "apps", "backend", "src", "main", "resources", "catalog", "files");
const BASE_COMMIT = "6e2f069";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TYPES = [
  "capOrange", "capBlue", "capGreen", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shortsNavy", "shortsBrown",
  "shortsRed", "shoesBrown", "shoesRed", "shoesWhite", "sunglassesBlack", "backpackRed", "mufflerRed", "necklaceGold"
];

// ---------- glTF 읽기 ----------

type GltfNode = { name?: string; mesh?: number; skin?: number; children?: number[] };
type Gltf = {
  nodes: GltfNode[];
  meshes: { primitives: { attributes: Record<string, number>; material?: number }[] }[];
  accessors: { bufferView?: number; byteOffset?: number; count: number; componentType: number; type: string }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  materials: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: { index: number } } }[];
  textures?: { source: number }[];
  images?: { bufferView: number; mimeType: string }[];
};
type Glb = { json: Gltf; bin: Buffer };

function parseGlb(buf: Buffer): Glb {
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength + 8;
  const binLength = buf.readUInt32LE(20 + jsonLength);
  return { json, bin: buf.subarray(binStart, binStart + binLength) };
}

function baseFile(path: string): Buffer {
  return execFileSync("git", ["show", `${BASE_COMMIT}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
}

function nodesNamed(glb: Glb, test: (name: string) => boolean): GltfNode[] {
  return glb.json.nodes.filter((n) => test(n.name ?? ""));
}

function oneNode(glb: Glb, name: string): GltfNode {
  const nodes = nodesNamed(glb, (n) => n === name);
  expect({ name, count: nodes.length }).toEqual({ name, count: 1 });
  return nodes[0];
}

/** 노드와 그 자손의 메시 번호들(여러 재질이면 자식 메시로 나뉠 수 있다). */
function meshIndices(glb: Glb, node: GltfNode): number[] {
  const list: number[] = [];
  const walk = (n: GltfNode) => {
    if (n.mesh !== undefined) list.push(n.mesh);
    for (const child of n.children ?? []) walk(glb.json.nodes[child]);
  };
  walk(node);
  return list;
}

function nodesUnder(glb: Glb, node: GltfNode): GltfNode[] {
  const list: GltfNode[] = [];
  const walk = (n: GltfNode) => {
    list.push(n);
    for (const child of n.children ?? []) walk(glb.json.nodes[child]);
  };
  walk(node);
  return list;
}

/** 실수(float) 접근자의 값. */
function floats(glb: Glb, accessorIndex: number): number[] {
  const accessor = glb.json.accessors[accessorIndex];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type as "SCALAR" | "VEC2" | "VEC3" | "VEC4"];
  const view = glb.json.bufferViews[accessor.bufferView!];
  const stride = view.byteStride ?? width * 4;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out: number[] = [];
  for (let i = 0; i < accessor.count; i += 1) for (let k = 0; k < width; k += 1) out.push(glb.bin.readFloatLE(start + i * stride + k * 4));
  return out;
}

/** 노드 아래 메시들의 점 자리(프리미티브 순서대로). */
function positionsOf(glb: Glb, node: GltfNode): number[] {
  return meshIndices(glb, node).flatMap((m) => glb.json.meshes[m].primitives.flatMap((p) => floats(glb, p.attributes.POSITION)));
}

function materialsOf(glb: Glb, node: GltfNode) {
  return meshIndices(glb, node).flatMap((m) => glb.json.meshes[m].primitives.map((p) => glb.json.materials[p.material ?? -1]));
}

function imageBytes(glb: Glb, imageIndex: number): Buffer {
  const image = glb.json.images![imageIndex];
  const view = glb.json.bufferViews[image.bufferView];
  return glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}

/** 노드의 겉 그림(첫 재질의 색 그림) 바이트. */
function textureOf(glb: Glb, node: GltfNode): Buffer {
  const material = materialsOf(glb, node)[0];
  const texture = material?.pbrMetallicRoughness?.baseColorTexture;
  expect(texture !== undefined).toBe(true);
  return imageBytes(glb, glb.json.textures![texture!.index].source);
}

// ---------- PNG 풀기(8비트, 인터레이스 없음) ----------

function decodePng(png: Buffer): { width: number; height: number; channels: number; data: Buffer } {
  expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const kind = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (kind === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      colorType = data[9];
      expect(data[12]).toBe(0);
    }
    if (kind === "IDAT") idat.push(data);
    if (kind === "IEND") break;
    offset += 12 + length;
  }
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v = raw[p++];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, channels, data: out };
}

function hasAlpha(png: Buffer): boolean {
  const colorType = png[25];
  if (colorType === 4 || colorType === 6) return true;
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const kind = png.toString("ascii", offset + 4, offset + 8);
    if (kind === "tRNS") return true;
    if (kind === "IEND") break;
    offset += 12 + length;
  }
  return false;
}

// ---------- 색 이름 판정(시나리오 "용어와 가정") ----------

function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max > 0 ? d / max : 0, max];
}

const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function colorNames(srgb: [number, number, number]): string[] {
  const [h, s, v] = hsv(...srgb);
  const names: string[] = [];
  if (s < 0.15 && v > 0.8) names.push("흰");
  if (v < 0.25) names.push("검정");
  if ((h >= 345 || h <= 15) && s >= 0.5 && v >= 0.35) names.push("빨강");
  if (h >= 35 && h <= 60 && s >= 0.4 && v >= 0.5) names.push("금");
  return names;
}

/** 재질 색(선형)의 sRGB. */
function materialSrgb(material: Gltf["materials"][number]): [number, number, number] {
  const factor = material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
  return [toSrgb(factor[0]), toSrgb(factor[1]), toSrgb(factor[2])];
}

const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

// ---------- 테스트 ----------

describe("[spec] 089-⑤ F: 착용 모델 파일과 칸 그림 파일", () => {
  const glb = parseGlb(readFileSync(WEARABLES));
  const base = parseGlb(baseFile("apps/mobile/assets/models/lobby-wearables.glb"));

  it("F1·F2 선글라스·백팩·머플러·목걸이 모델이 하나씩 있고, 넷 모두 skin이 없는(단단히 붙이는) 메시다", () => {
    for (const name of ["wear-sunglasses", "wear-backpack", "wear-muffler", "wear-necklace"]) {
      const node = oneNode(glb, name);
      expect({ name, meshes: meshIndices(glb, node).length > 0 }).toEqual({ name, meshes: true });
      expect({ name, skinned: nodesUnder(glb, node).filter((n) => n.skin !== undefined).length }).toEqual({ name, skinned: 0 });
    }
  });

  it("F3 이미 있는 넷(wear-hat, wear-top, wear-bottom, wear-shoe-l)이 하나씩 있고, 점 수·점 자리·재질 색·모자 그림이 기준 커밋과 같다", () => {
    for (const name of ["wear-hat", "wear-top", "wear-bottom", "wear-shoe-l"]) {
      const now = oneNode(glb, name);
      const before = oneNode(base, name);
      expect({ name, positions: positionsOf(glb, now) }).toEqual({ name, positions: positionsOf(base, before) });
      const colors = (g: Glb, n: GltfNode) => materialsOf(g, n).map((m) => m?.pbrMetallicRoughness?.baseColorFactor ?? null);
      expect({ name, colors: colors(glb, now) }).toEqual({ name, colors: colors(base, before) });
    }
    const hatNow = decodePng(textureOf(glb, oneNode(glb, "wear-hat")));
    const hatBefore = decodePng(textureOf(base, oneNode(base, "wear-hat")));
    expect(hatNow.width).toBe(hatBefore.width);
    expect(hatNow.height).toBe(hatBefore.height);
    expect(hatNow.data.equals(hatBefore.data)).toBe(true);
    expect(nodesNamed(glb, (n) => n.startsWith("wear-shoe")).length).toBe(1);
  });

  it("F4 라룹이 모델(writeloop.glb)은 기준 커밋과 바이트가 같다", () => {
    expect(readFileSync(CHARACTER).equals(baseFile("apps/mobile/assets/models/writeloop.glb"))).toBe(true);
  });

  it("F5 열여섯 칸 그림이 모두 있고, PNG이며 투명 채널이 있고, 내용이 서로 다르다", () => {
    const seen = TYPES.map((type) => {
      const path = join(ICONS, `${type}.png`);
      if (!existsSync(path)) return { type, exists: false, png: false, alpha: false, hash: "" };
      const data = readFileSync(path);
      return { type, exists: true, png: data.subarray(0, 8).equals(PNG_SIGNATURE), alpha: hasAlpha(data), hash: createHash("sha256").update(data).digest("hex") };
    });
    expect(seen.map(({ type, exists, png, alpha }) => ({ type, exists, png, alpha }))).toEqual(TYPES.map((type) => ({ type, exists: true, png: true, alpha: true })));
    expect(new Set(seen.map((s) => s.hash)).size).toBe(16);
  });
});

describe("[spec] 089-⑤ R2·R3·R4·R5(파일): 모자 셋의 모양·그림, 새 넷의 색", () => {
  const glb = parseGlb(readFileSync(WEARABLES));

  it("R2 파랑·초록 모자는 주황 모자와 점 수·점 자리가 같고 skin이 없다", () => {
    const orange = positionsOf(glb, oneNode(glb, "wear-hat"));
    for (const name of ["wear-hat-blue", "wear-hat-green"]) {
      const node = oneNode(glb, name);
      const positions = positionsOf(glb, node);
      expect({ name, count: positions.length }).toEqual({ name, count: orange.length });
      const diff = Math.max(...positions.map((v, i) => Math.abs(v - orange[i])));
      expect({ name, same: diff < 1e-6 }).toEqual({ name, same: true });
      expect({ name, skinned: nodesUnder(glb, node).filter((n) => n.skin !== undefined).length }).toEqual({ name, skinned: 0 });
    }
  });

  it.each([
    ["wear-sunglasses", "검정"],
    ["wear-backpack", "빨강"],
    ["wear-muffler", "빨강"],
    ["wear-necklace", "금"]
  ])("R3 %s의 재질 색은 모두 '%s'이다(그림 없는 한 가지 색)", (name, color) => {
    const materials = materialsOf(glb, oneNode(glb, name));
    expect(materials.length).toBeGreaterThan(0);
    for (const material of materials) {
      expect({ name, texture: material?.pbrMetallicRoughness?.baseColorTexture }).toEqual({ name, texture: undefined });
      expect({ name, material: material?.name, names: colorNames(materialSrgb(material)).includes(color) }).toEqual({
        name,
        material: material?.name,
        names: true
      });
    }
  });

  it("R4·R5 모자 그림: 주황 모자에서 뚜렷한 주황인 점은 파랑 모자에서 색상 212°±12°, 초록 모자에서 128°±12°이고, 뚜렷하게 주황이 아닌 점은 셋이 같다", () => {
    const orange = decodePng(textureOf(glb, oneNode(glb, "wear-hat")));
    const blue = decodePng(textureOf(glb, oneNode(glb, "wear-hat-blue")));
    const green = decodePng(textureOf(glb, oneNode(glb, "wear-hat-green")));
    for (const other of [blue, green]) {
      expect([other.width, other.height, other.channels]).toEqual([orange.width, orange.height, orange.channels]);
    }
    const n = orange.channels;
    let orangeCount = 0;
    let otherCount = 0;
    const badOrange: string[] = [];
    const badOther: string[] = [];
    for (let i = 0; i < orange.width * orange.height; i += 1) {
      const k = i * n;
      const rgb = (img: typeof orange): [number, number, number] => [img.data[k] / 255, img.data[k + 1] / 255, img.data[k + 2] / 255];
      const [h, s, v] = hsv(...rgb(orange));
      const isOrange = h >= 15 && h <= 45 && s >= 0.5 && v >= 0.35;
      const isOther = s < 0.2 || (h >= 70 && h <= 330);
      if (isOrange) {
        orangeCount += 1;
        const hb = hsv(...rgb(blue))[0];
        const hg = hsv(...rgb(green))[0];
        if ((hueDistance(hb, 212) > 12 || hueDistance(hg, 128) > 12) && badOrange.length < 5) badOrange.push(`${i}: 파랑 ${hb.toFixed(0)}° 초록 ${hg.toFixed(0)}°`);
      } else if (isOther) {
        otherCount += 1;
        let same = true;
        for (let c = 0; c < 3; c += 1) if (Math.abs(orange.data[k + c] - blue.data[k + c]) > 2 || Math.abs(orange.data[k + c] - green.data[k + c]) > 2) same = false;
        if (!same && badOther.length < 5) badOther.push(String(i));
      }
    }
    // 그림에 주황 부분과 아닌 부분이 실제로 있다
    expect(orangeCount).toBeGreaterThan(0);
    expect(otherCount).toBeGreaterThan(0);
    expect(badOrange).toEqual([]);
    expect(badOther).toEqual([]);
  });
});
