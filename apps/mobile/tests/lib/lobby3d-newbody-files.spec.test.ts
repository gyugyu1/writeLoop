/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 089 ⑤ 새 몸 넣기, 새 기능, 모바일): 새 라룹이 몸 파일(시나리오 NM1~NM7), 앱에 든 고글 착용 모델(NG1~NG3),
// 서버 옷 모델 파일 교체(NF1~NF5), 그림(NI1·NI2), 스크립트(NS1~NS4).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/07-아이템-늘리기/23-qa-scenarios.md의 NM·NG·NF·NI·NS)와
// 24-main-decision.md(3: build-wearables.py가 같은 이름으로 새 스크립트가 되고 add-goggles-toggle.py·build-extra-wearables.py·split-wearables.py는
// 지운다, 4: 고글 파일은 apps/mobile/assets/models/wear-goggles.glb)에서만 가져온다.
// 구현 커밋 d6338fa·057a534·cbc43b9에서 읽은 것은 파일 자리와 이름뿐이다.
// "B"는 시나리오 "용어와 가정"대로 정했다: 64a30ab 뒤로 다른 작업(창문 붙박이)이 catalog/items.json을 바꿨으므로 이 단계 첫 구현 커밋(d6338fa)의
// 바로 앞 커밋 7f74c06이다(writeloop.glb·goggles.png·catalog/files/는 64a30ab와 같다).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..", "..");
const REPO = join(MOBILE, "..", "..");
const BODY = join(MOBILE, "assets", "models", "writeloop.glb");
const GOGGLES = join(MOBILE, "assets", "models", "wear-goggles.glb");
const GOGGLES_ICON_DIR = join(MOBILE, "assets", "icons", "wearables");
const SERVER_CATALOG = join(REPO, "apps", "backend", "src", "main", "resources", "catalog");
const SERVER_FILES = join(SERVER_CATALOG, "files");
const SCRIPTS = join(REPO, "scripts", "lobby3d");
const B = "7f74c06";
const rel = (...parts: string[]) => parts.join("/");
const BODY_PATH = rel("apps", "mobile", "assets", "models", "writeloop.glb");
const GOGGLES_ICON_PATH = rel("apps", "mobile", "assets", "icons", "wearables", "goggles.png");
const SERVER_FILES_PATH = rel("apps", "backend", "src", "main", "resources", "catalog", "files");
const ITEMS_PATH = rel("apps", "backend", "src", "main", "resources", "catalog", "items.json");

/** 시나리오 "11옷". */
const ELEVEN = [
  "wear-backpack.glb", "wear-bottom.glb", "wear-hat.glb", "wear-hat-blue.glb", "wear-hat-green.glb", "wear-muffler.glb",
  "wear-necklace.glb", "wear-shoe.glb", "wear-sunglasses.glb", "wear-top.glb", "wear-vest.glb"
];
/** 시나리오 "옷 그림 열일곱"(열여섯 + 조끼). */
const SEVENTEEN = [
  "capOrange", "capBlue", "capGreen", "tshirtOrange", "tshirtWhite", "tshirtYellow", "shortsNavy", "shortsBrown",
  "shortsRed", "shoesBrown", "shoesRed", "shoesWhite", "sunglassesBlack", "backpackRed", "mufflerRed", "necklaceGold", "vestGreen"
];
/** 시나리오 "뼈 열여덟". */
const BONES = [
  "root", "hips", "leg_l", "foot_l", "leg_r", "foot_r", "spine", "arm_l", "hand_l", "arm_r", "hand_r", "thumb_r",
  "head", "ear_l", "ear_r", "tail_1", "tail_2", "tail_3"
];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------- glTF 읽기 ----------

type GltfNode = { name?: string; mesh?: number; skin?: number; children?: number[] };
type Primitive = { attributes: Record<string, number>; indices?: number; material?: number; targets?: unknown[] };
type Gltf = {
  asset?: { version?: string };
  nodes: GltfNode[];
  meshes: { name?: string; primitives: Primitive[]; extras?: { targetNames?: string[] } }[];
  skins?: { joints: number[]; inverseBindMatrices?: number }[];
  accessors: { bufferView?: number; byteOffset?: number; count: number; componentType: number; type: string; min?: number[]; max?: number[] }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[];
  textures?: { source: number }[];
  images?: { name?: string; bufferView: number; mimeType: string }[];
  animations?: { name?: string }[];
};
type Glb = { json: Gltf; bin: Buffer };

function isGlb2(buf: Buffer): boolean {
  return buf.length >= 20 && buf.toString("ascii", 0, 4) === "glTF" && buf.readUInt32LE(4) === 2 && buf.readUInt32LE(8) === buf.length;
}

function parseGlb(buf: Buffer): Glb {
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength + 8;
  return { json, bin: buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLength)) };
}

function baseFile(path: string): Buffer {
  return execFileSync("git", ["show", `${B}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function floats(glb: Glb, accessorIndex: number): number[] {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView ?? 0];
  const size = COMPONENTS[accessor.type];
  const stride = view.byteStride ?? size * 4;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const out: number[] = [];
  for (let i = 0; i < accessor.count; i += 1) for (let k = 0; k < size; k += 1) out.push(glb.bin.readFloatLE(start + i * stride + k * 4));
  return out;
}

const meshNodes = (glb: Glb) => glb.json.nodes.filter((n) => n.mesh !== undefined);
const meshNodeNames = (glb: Glb) => meshNodes(glb).map((n) => n.name ?? "");

/** 메시의 삼각형 수(인덱스가 없으면 점 셋마다 하나). */
function triangles(glb: Glb, meshIndex: number): number {
  return glb.json.meshes[meshIndex].primitives.reduce(
    (sum, p) => sum + (p.indices !== undefined ? glb.json.accessors[p.indices].count : glb.json.accessors[p.attributes.POSITION].count) / 3,
    0
  );
}

function imageBytes(glb: Glb, imageIndex: number): Buffer {
  const image = glb.json.images![imageIndex];
  const view = glb.json.bufferViews[image.bufferView];
  return glb.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
}

/** 노드 메시의 첫 재질 바탕색 그림 바이트(없으면 null). */
function baseColorImage(glb: Glb, node: GltfNode): Buffer | null {
  const primitive = glb.json.meshes[node.mesh!].primitives[0];
  const texture = glb.json.materials?.[primitive.material ?? -1]?.pbrMetallicRoughness?.baseColorTexture;
  if (!texture) return null;
  return imageBytes(glb, glb.json.textures![texture.index].source);
}

/** 그림의 가로·세로(PNG·JPEG). */
function imageSize(bytes: Buffer, mimeType: string): { width: number; height: number } {
  if (mimeType === "image/png") return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  expect({ jpeg: bytes[0] === 0xff && bytes[1] === 0xd8 }).toEqual({ jpeg: true });
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    // SOF0~SOF15(DHT C4·JPG C8·DAC CC 빼고)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG 크기를 찾지 못했다");
}

/** 노드의 skin: 뼈 이름과 뼈마다 묶음 역행렬(16개씩). */
function skinOf(glb: Glb, node: GltfNode): { joints: string[]; inverse: Map<string, number[]> } {
  const skin = glb.json.skins![node.skin!];
  const all = skin.inverseBindMatrices === undefined ? [] : floats(glb, skin.inverseBindMatrices);
  const joints = skin.joints.map((j) => glb.json.nodes[j].name ?? "");
  return { joints, inverse: new Map(joints.map((name, i) => [name, all.slice(i * 16, i * 16 + 16)])) };
}

// ---------- PNG ----------

function pngInfo(png: Buffer): { png: boolean; alpha: boolean } {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) return { png: false, alpha: false };
  let offset = 8;
  let colorType = -1;
  let trns = false;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const kind = png.toString("ascii", offset + 4, offset + 8);
    if (kind === "IHDR") colorType = png[offset + 8 + 9];
    if (kind === "tRNS") trns = true;
    if (kind === "IEND") break;
    offset += 12 + length;
  }
  return { png: true, alpha: colorType === 4 || colorType === 6 || trns };
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** 디렉터리 아래 파일(하위 폴더 포함)의 내용에 글이 들어 있는 파일들. */
function filesContaining(dir: string, words: string[]): string[] {
  const found: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      if (name === "node_modules" || name === "__pycache__") continue;
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else {
        const text = readFileSync(path).toString("utf8");
        for (const word of words) if (text.includes(word)) found.push(`${path} : ${word}`);
      }
    }
  };
  walk(dir);
  return found;
}

// ---------- NM. 새 몸 모델 파일 ----------

describe("[spec] 089-⑤ 23 NM: 새 몸 모델 파일(writeloop.glb)", () => {
  const body = () => parseGlb(readFileSync(BODY));

  it("NM1 writeloop.glb는 B의 같은 파일과 바이트가 다르다", () => {
    expect(readFileSync(BODY).equals(baseFile(BODY_PATH))).toBe(false);
  });

  it("NM2 모양 변형(targets)·noGoggles가 없고, writeloop_nogoggles 노드·메시와 writeloop_body_nogoggles 재질·그림이 없으며, 메시가 있는 노드는 뼈대로 휘는 몸 하나뿐이다", () => {
    const glb = body();
    expect(glb.json.meshes.flatMap((m, i) => m.primitives.filter((p) => p.targets !== undefined).map(() => i))).toEqual([]);
    expect(glb.json.meshes.flatMap((m) => m.extras?.targetNames ?? [])).not.toContain("noGoggles");
    expect(glb.json.nodes.filter((n) => n.name === "writeloop_nogoggles").length).toBe(0);
    expect(glb.json.meshes.filter((m) => m.name === "writeloop_nogoggles").length).toBe(0);
    expect((glb.json.materials ?? []).filter((m) => m.name === "writeloop_body_nogoggles").length).toBe(0);
    expect((glb.json.images ?? []).filter((m) => m.name === "writeloop_body_nogoggles").length).toBe(0);
    const nodes = meshNodes(glb);
    expect(nodes.length).toBe(1);
    expect(nodes[0].skin !== undefined).toBe(true);
  });

  it("NM3 glTF 2 바이너리이고 키 1.0±0.02, 발밑이 원점±0.02이며 뼈 head·hips·hand_r·hand_l이 뼈대에 있다", () => {
    const buf = readFileSync(BODY);
    expect(isGlb2(buf)).toBe(true);
    const glb = parseGlb(buf);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const mesh of glb.json.meshes) {
      for (const p of mesh.primitives) {
        const accessor = glb.json.accessors[p.attributes.POSITION];
        minY = Math.min(minY, accessor.min![1]);
        maxY = Math.max(maxY, accessor.max![1]);
      }
    }
    expect(Math.abs(maxY - minY - 1)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(minY)).toBeLessThanOrEqual(0.02);
    const joints = new Set((glb.json.skins ?? []).flatMap((s) => s.joints.map((j) => glb.json.nodes[j].name)));
    for (const name of ["head", "hips", "hand_r", "hand_l"]) expect({ name, has: joints.has(name) }).toEqual({ name, has: true });
  });

  it("NM4 몸 메시의 skin이 하나이고 뼈 이름 집합이 뼈 열여덟과 같다", () => {
    const glb = body();
    expect((glb.json.skins ?? []).length).toBe(1);
    const node = meshNodes(glb)[0];
    expect(skinOf(glb, node).joints.slice().sort()).toEqual(BONES.slice().sort());
  });

  it("NM5 동작 클립이 열아홉이고 이름 집합이 B 파일의 클립 열아홉과 같다", () => {
    const now = (body().json.animations ?? []).map((a) => a.name ?? "");
    const before = (parseGlb(baseFile(BODY_PATH)).json.animations ?? []).map((a) => a.name ?? "");
    expect(before.length).toBe(19);
    expect(now.length).toBe(19);
    expect(now.slice().sort()).toEqual(before.slice().sort());
  });

  it("NM6 몸 메시에 외곽선 속성 _OUTLINE_NORMAL과 _OUTLINE_BIAS가 모두 있다", () => {
    const glb = body();
    const node = meshNodes(glb)[0];
    for (const p of glb.json.meshes[node.mesh!].primitives) {
      expect(Object.keys(p.attributes)).toEqual(expect.arrayContaining(["_OUTLINE_NORMAL", "_OUTLINE_BIAS"]));
    }
  });

  it("NM7 파일 안 그림이 하나이고 몸 메시의 삼각형 수가 15,000 미만이다", () => {
    const glb = body();
    expect((glb.json.images ?? []).length).toBe(1);
    expect(triangles(glb, meshNodes(glb)[0].mesh!)).toBeLessThan(15000);
  });
});

// ---------- NG. 고글 착용 모델 ----------

describe("[spec] 089-⑤ 23 NG: 앱에 든 고글 착용 모델(wear-goggles.glb)", () => {
  it("NG1 고글 모델 파일이 앱 폴더에 있고 glTF 2 바이너리이며, 앱 코드(src)가 이 파일을 require한다", () => {
    expect(existsSync(GOGGLES)).toBe(true);
    expect(isGlb2(readFileSync(GOGGLES))).toBe(true);
    const requires = filesContaining(join(MOBILE, "src"), ["wear-goggles.glb"]).filter((line) => {
      const file = line.slice(0, line.lastIndexOf(" : "));
      return /require\(\s*["'][^"']*assets\/models\/wear-goggles\.glb["']\s*\)/.test(readFileSync(file, "utf8"));
    });
    expect(requires.length).toBeGreaterThan(0);
  });

  it("NG2 메시가 있는 노드는 wear-goggles 하나이고 skin이 없다", () => {
    const glb = parseGlb(readFileSync(GOGGLES));
    expect(meshNodeNames(glb)).toEqual(["wear-goggles"]);
    expect(meshNodes(glb)[0].skin).toBeUndefined();
    expect((glb.json.skins ?? []).length).toBe(0);
  });

  it("NG3 고글 메시의 삼각형 수가 2,000 이상 2,500 이하이고, 그림이 하나이며 가로·세로가 각각 512 이상 1024 이하다", () => {
    const glb = parseGlb(readFileSync(GOGGLES));
    const count = triangles(glb, meshNodes(glb)[0].mesh!);
    expect(count).toBeGreaterThanOrEqual(2000);
    expect(count).toBeLessThanOrEqual(2500);
    expect((glb.json.images ?? []).length).toBe(1);
    const { width, height } = imageSize(imageBytes(glb, 0), glb.json.images![0].mimeType);
    for (const [label, v] of [["width", width], ["height", height]] as const) {
      expect({ label, inRange: v >= 512 && v <= 1024 }).toEqual({ label, inRange: true });
    }
  });
});

// ---------- NF. 옷 모델 파일 교체 ----------

describe("[spec] 089-⑤ 23 NF1~NF5: 서버 옷 모델 파일 교체", () => {
  const now = (file: string) => readFileSync(join(SERVER_FILES, file));
  const before = (file: string) => baseFile(`${SERVER_FILES_PATH}/${file}`);

  it("NF1 11옷 모두 있고 각각 B의 파일과 바이트가 다르며, 서버 파일 폴더의 wear-*.glb는 이 열하나뿐이다", () => {
    for (const file of ELEVEN) {
      expect({ file, exists: existsSync(join(SERVER_FILES, file)) }).toEqual({ file, exists: true });
      expect({ file, same: now(file).equals(before(file)) }).toEqual({ file, same: false });
    }
    expect(readdirSync(SERVER_FILES).filter((f) => /^wear-.*\.glb$/.test(f)).sort()).toEqual(ELEVEN.slice().sort());
  });

  it("NF2 목록 파일의 옷 열일곱은 slot·draw(attach·bone·mirror·color·body)·files.model·files.icon이 B와 같고, 모든 옷의 draw.body가 1이다", () => {
    type Item = { id: string; kind: string; slot?: string; draw?: Record<string, unknown>; files?: { model?: string; icon?: string } };
    const pick = (items: Item[]) =>
      Object.fromEntries(
        items
          .filter((item) => item.kind === "wearable" && item.id !== "goggles")
          .map((item) => [
            item.id,
            {
              slot: item.slot,
              draw: item.draw ? { attach: item.draw.attach, bone: item.draw.bone, mirror: item.draw.mirror, color: item.draw.color, body: item.draw.body } : null,
              model: item.files?.model,
              icon: item.files?.icon
            }
          ])
      );
    const nowItems = (JSON.parse(readFileSync(join(SERVER_CATALOG, "items.json"), "utf8")) as { items: Item[] }).items;
    const beforeItems = (JSON.parse(baseFile(ITEMS_PATH).toString("utf8")) as { items: Item[] }).items;
    const nowWear = pick(nowItems);
    expect(Object.keys(nowWear).sort()).toEqual(SEVENTEEN.slice().sort());
    expect(nowWear).toEqual(pick(beforeItems));
    for (const [id, value] of Object.entries(nowWear)) expect({ id, body: value.draw?.body }).toEqual({ id, body: 1 });
  });

  it("NF3 11옷마다 메시가 있는 노드 이름 목록과 skin 여부가 B와 같고, skin은 top·bottom·vest만 있다", () => {
    for (const file of ELEVEN) {
      const a = parseGlb(now(file));
      const b = parseGlb(before(file));
      expect({ file, nodes: meshNodeNames(a) }).toEqual({ file, nodes: meshNodeNames(b) });
      const skinned = (g: Glb) => meshNodes(g).map((n) => n.skin !== undefined);
      expect({ file, skinned: skinned(a) }).toEqual({ file, skinned: skinned(b) });
      const expected = ["wear-top.glb", "wear-bottom.glb", "wear-vest.glb"].includes(file);
      expect({ file, anySkin: skinned(a).some(Boolean) }).toEqual({ file, anySkin: expected });
    }
  });

  it("NF4 top·bottom·vest의 skin 뼈 이름은 모두 뼈 열여덟에 있고, 뼈마다 묶음 역행렬이 새 몸의 같은 이름 뼈와 같다(오차 1e-3)", () => {
    const bodyGlb = parseGlb(readFileSync(BODY));
    const bodySkin = skinOf(bodyGlb, meshNodes(bodyGlb)[0]);
    for (const file of ["wear-top.glb", "wear-bottom.glb", "wear-vest.glb"]) {
      const glb = parseGlb(now(file));
      for (const node of meshNodes(glb)) {
        const skin = skinOf(glb, node);
        expect({ file, missing: skin.joints.filter((name) => !BONES.includes(name)) }).toEqual({ file, missing: [] });
        for (const name of skin.joints) {
          const mine = skin.inverse.get(name)!;
          const theirs = bodySkin.inverse.get(name)!;
          const diff = mine.reduce((max, v, i) => Math.max(max, Math.abs(v - theirs[i])), 0);
          expect({ file, bone: name, close: diff <= 1e-3 }).toEqual({ file, bone: name, close: true });
        }
      }
    }
  });

  it("NF5 모자 셋(wear-hat, wear-hat-blue, wear-hat-green)의 바탕색 그림이 서로 다르다", () => {
    const shas = ["wear-hat.glb", "wear-hat-blue.glb", "wear-hat-green.glb"].map((file) => {
      const glb = parseGlb(now(file));
      const image = baseColorImage(glb, meshNodes(glb)[0]);
      expect({ file, hasImage: image !== null }).toEqual({ file, hasImage: true });
      return sha256(image!);
    });
    expect(new Set(shas).size).toBe(3);
  });
});

// ---------- NI. 그림 ----------

describe("[spec] 089-⑤ 23 NI1·NI2: 그림", () => {
  it("NI1 앱의 goggles.png가 있고 PNG이며 투명 채널이 있고 B 파일과 바이트가 다르다. 그 폴더의 파일은 goggles.png 하나뿐이다", () => {
    const file = join(GOGGLES_ICON_DIR, "goggles.png");
    expect(existsSync(file)).toBe(true);
    expect(pngInfo(readFileSync(file))).toEqual({ png: true, alpha: true });
    expect(readFileSync(file).equals(baseFile(GOGGLES_ICON_PATH))).toBe(false);
    expect(readdirSync(GOGGLES_ICON_DIR)).toEqual(["goggles.png"]);
  });

  it("NI2 옷 그림 열일곱 모두 PNG이며 투명 채널이 있고 각각 B 파일과 바이트가 다르며, 열일곱과 고글 그림 열여덟의 내용이 서로 다르다", () => {
    const contents: string[] = [];
    for (const id of SEVENTEEN) {
      const bytes = readFileSync(join(SERVER_FILES, `${id}.png`));
      expect({ id, info: pngInfo(bytes) }).toEqual({ id, info: { png: true, alpha: true } });
      expect({ id, same: bytes.equals(baseFile(`${SERVER_FILES_PATH}/${id}.png`)) }).toEqual({ id, same: false });
      contents.push(sha256(bytes));
    }
    contents.push(sha256(readFileSync(join(GOGGLES_ICON_DIR, "goggles.png"))));
    expect(new Set(contents).size).toBe(18);
  });
});

// ---------- NS. 스크립트 ----------

describe("[spec] 089-⑤ 23 NS: 스크립트와 걷어 낸 코드", () => {
  it("NS1 scripts/lobby3d/add-goggles-toggle.py가 없다", () => {
    expect(existsSync(join(SCRIPTS, "add-goggles-toggle.py"))).toBe(false);
  });

  it("NS2 앱 코드(apps/mobile/src)와 scripts/lobby3d 어디에도 noGoggles·writeloop_nogoggles·writeloop_body_nogoggles라는 글이 없다", () => {
    const words = ["noGoggles", "writeloop_nogoggles", "writeloop_body_nogoggles"];
    expect(filesContaining(join(MOBILE, "src"), words)).toEqual([]);
    expect(filesContaining(SCRIPTS, words)).toEqual([]);
  });

  // 시나리오는 이름을 build-wearables-newbody.py로 가정했다. 24-3: build-wearables.py가 같은 이름으로 새 스크립트가 되고,
  // build-extra-wearables.py·split-wearables.py는 지운다.
  it("NS3 옷을 만드는 새 스크립트 build-wearables.py가 있고 B의 같은 파일과 내용이 다르며, build-extra-wearables.py·split-wearables.py는 없다", () => {
    const file = join(SCRIPTS, "build-wearables.py");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).equals(baseFile("scripts/lobby3d/build-wearables.py"))).toBe(false);
    expect(existsSync(join(SCRIPTS, "build-extra-wearables.py"))).toBe(false);
    expect(existsSync(join(SCRIPTS, "split-wearables.py"))).toBe(false);
  });

  it("NS4 scripts/lobby3d/render-wearable-icons.py가 있다", () => {
    expect(existsSync(join(SCRIPTS, "render-wearable-icons.py"))).toBe(true);
  });
});
