/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 089 ① 착용 기술 시험, 새 기능, 모바일): 착용 모델 파일(M1~M7)과 상의·하의 색(T3의 파일 쪽).
// 기대값은 시나리오(private 작업 폴더 089-2026-11-13-캐릭터-꾸미기/02-착용-기술-시험/03-qa-scenarios.md)에서만 가져온다.
// 구현 커밋 fbaec64에서 읽은 것은 모델 안 이름뿐이다(모자 wear-hat, 신발 wear-shoe-*, 상의 wear-top, 하의 wear-bottom).
// 기존 CREDITS 네 줄이 그대로인지는 이번 작업 전 CREDITS.md(기준 커밋 ffaded8)의 줄과 글자까지 같게 본다.
// M6의 원본(저장소 밖 애셋 폴더의 야구모자)이 없는 컴퓨터에서는 M6을 건너뛴다(통과가 아니다. 보고에 미확인으로 적는다).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..", "..");
const REPO = join(MOBILE, "..", "..");
const MODELS = join(MOBILE, "assets", "models");
const WEARABLES = join(MODELS, "lobby-wearables.glb");
const CHARACTER = join(MODELS, "writeloop.glb");
const CAP_SOURCE = "C:\\WriteLoop-asset\\캡모자\\baseball cap 3d model.glb";

type GltfNode = { name?: string; mesh?: number; skin?: number; children?: number[] };
type Gltf = {
  nodes?: GltfNode[];
  meshes?: { name?: string; primitives: { attributes: Record<string, number>; material?: number }[] }[];
  skins?: { joints: number[] }[];
  accessors?: { count: number }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[]; baseColorTexture?: unknown } }[];
};

function readGltf(file: string): Gltf {
  const buf = readFileSync(file);
  const length = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + length).toString("utf8")) as Gltf;
}

/** 이름이 맞는, 메시를 가진 노드들. */
function meshNodes(gltf: Gltf, match: (name: string) => boolean): GltfNode[] {
  return (gltf.nodes ?? []).filter((n) => n.mesh !== undefined && match(n.name ?? ""));
}

/** 메시의 점 수(프리미티브마다 POSITION count 합). */
function pointCount(gltf: Gltf, meshIndex: number): number {
  return gltf.meshes![meshIndex].primitives.reduce((sum, p) => sum + gltf.accessors![p.attributes.POSITION].count, 0);
}

function boneNames(gltf: Gltf): Set<string> {
  const names = new Set<string>();
  for (const skin of gltf.skins ?? []) for (const j of skin.joints) names.add(gltf.nodes![j].name ?? "");
  return names;
}

describe("[spec] 착용 모델 파일(M1~M7)", () => {
  it("M1: lobby-wearables.glb가 있고 glTF 2 바이너리다", () => {
    expect(existsSync(WEARABLES)).toBe(true);
    const head = readFileSync(WEARABLES).subarray(0, 8);
    expect(head.subarray(0, 4).toString("ascii")).toBe("glTF");
    expect(head.readUInt32LE(4)).toBe(2);
  });

  it("M2: 만드는 스크립트 scripts/lobby3d/build-wearables.py가 있다", () => {
    expect(existsSync(join(REPO, "scripts", "lobby3d", "build-wearables.py"))).toBe(true);
  });

  it("M3: 모자·상의 껍질·하의 껍질·신발이 하나씩 있고, 신발은 한 짝만 있다", () => {
    const gltf = readGltf(WEARABLES);
    expect({
      hat: meshNodes(gltf, (n) => n === "wear-hat").length,
      top: meshNodes(gltf, (n) => n === "wear-top").length,
      bottom: meshNodes(gltf, (n) => n === "wear-bottom").length,
      shoe: meshNodes(gltf, (n) => n.startsWith("wear-shoe")).length
    }).toEqual({ hat: 1, top: 1, bottom: 1, shoe: 1 });
  });

  it("M4: 상의·하의 껍질은 skin이 있는 메시이고, skin의 뼈 이름이 모두 writeloop.glb 뼈대에 있다", () => {
    const gltf = readGltf(WEARABLES);
    const characterBones = boneNames(readGltf(CHARACTER));
    for (const name of ["wear-top", "wear-bottom"]) {
      const nodes = meshNodes(gltf, (n) => n === name);
      expect(nodes).toHaveLength(1);
      const skin = nodes[0].skin;
      expect(skin).toBeDefined();
      const joints = gltf.skins![skin!].joints.map((j) => gltf.nodes![j].name ?? "");
      expect(joints.length).toBeGreaterThan(0);
      expect(joints.filter((j) => !characterBones.has(j))).toEqual([]);
    }
  });

  it("M5: 모자와 신발은 skin이 없는 메시다", () => {
    const gltf = readGltf(WEARABLES);
    const rigid = meshNodes(gltf, (n) => n === "wear-hat" || n.startsWith("wear-shoe"));
    expect(rigid.length).toBeGreaterThan(0);
    expect(rigid.filter((n) => n.skin !== undefined).map((n) => n.name)).toEqual([]);
  });

  (existsSync(CAP_SOURCE) ? it : it.skip)("M6: 모자의 점 수가 원본 야구모자보다 적다", () => {
    const source = readGltf(CAP_SOURCE);
    const sourceCount = (source.meshes ?? []).reduce((sum, _m, i) => sum + pointCount(source, i), 0);
    const gltf = readGltf(WEARABLES);
    const hats = meshNodes(gltf, (n) => n === "wear-hat");
    expect(hats).toHaveLength(1);
    expect(pointCount(gltf, hats[0].mesh!)).toBeLessThan(sourceCount);
  });

  it("M7: CREDITS.md에 lobby-wearables.glb 줄이 하나 있고 Tripo와 WriteLoop이 들어 있으며, 기존 네 줄은 그대로다", () => {
    const lines = readFileSync(join(MODELS, "CREDITS.md"), "utf8").split(/\r?\n/);
    const wear = lines.filter((line) => line.includes("`lobby-wearables.glb`"));
    expect(wear).toHaveLength(1);
    expect(wear[0]).toContain("Tripo");
    expect(wear[0]).toContain("WriteLoop");
    // 090-② 05 결정 3(사용자 2026-11-13 "qa가 새 동작에 맞게 고침"): 가구 묶음을 가구마다 나눠 앱·서버에 두게 되어 lobby-furniture.glb 줄에
    // 그 설명이 더해질 수 있다. 그 줄이 하나이고, 기존 줄의 글(출처·만든 스크립트·라이선스)이 앞뒤 그대로인지 본다.
    const furnitureLines = lines.filter((line) => line.includes("`lobby-furniture.glb`"));
    expect(furnitureLines).toHaveLength(1);
    expect(furnitureLines[0].startsWith(
      "| `lobby-furniture.glb` | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) 2.0의 가구(책상, 의자, 책장, 닫힌 책장, 러그, 책, 미닫이 창, 둥근 탁상 스탠드, 1인 침대, 협탁, 둥근 바닥 스탠드, 화분, 작은 화분)를 `scripts/lobby3d/build-furniture.py`로 골라 크기·모서리를 다듬고 한 파일로 묶었다. "
    )).toBe(true);
    expect(furnitureLines[0].endsWith(" 게시판·창틀·액자는 같은 모양새로 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |")).toBe(true);
    expect(lines).toContain(
      "| `lobby-village.glb` | [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) 2.0의 벽·문·창·지붕(건물 넷으로 조립), 분수, 가로등, 노점, 벤치, 바위, 길, 생울타리, 나무 울타리를 `scripts/lobby3d/build-village.py`로 골라 배치하고 한 파일로 묶었다(색 그림의 회벽·벽 아래 띠 색을 바꿨다). 밤 불빛 판은 새로 만들었다 | CC0 1.0(출처 표기 의무 없음) |"
    );
    expect(lines).toContain("| `lobby-room.glb` | WriteLoop이 `scripts/lobby3d/bake-room.py`로 만들었다 | 저장소와 같다 |");
    // 작업 089 ⑤ 24-main-decision.md(사용자 결정 "qa가 새 동작에 맞게 고침", 답 2): 22 결정으로 라룹이 몸을 Tripo 웹으로 만든 고글 없는 새 몸으로
    // 바꿔 writeloop.glb 줄이 새 몸 설명이 되었다. 그 줄이 하나이고 앞(파일 이름·"WriteLoop 캐릭터 모델")과 끝(라이선스)이 그대로이며 새 몸 설명(Tripo, 고글 없는 몸)이 있는지 본다.
    const characterLines = lines.filter((line) => line.includes("`writeloop.glb`"));
    expect(characterLines).toHaveLength(1);
    expect(characterLines[0].startsWith("| `writeloop.glb` | WriteLoop 캐릭터 모델")).toBe(true);
    expect(characterLines[0].endsWith(" | 저장소와 같다 |")).toBe(true);
    expect(characterLines[0]).toContain("Tripo");
    expect(characterLines[0]).toContain("고글 없는 몸");
  });
});

describe("[spec] 상의·하의 색(T3, 파일)", () => {
  it("T3: 상의 껍질과 하의 껍질은 각각 그림 없이 한 가지 색이고, 두 색이 다르다", () => {
    const gltf = readGltf(WEARABLES);
    const colorOf = (name: string) => {
      const nodes = meshNodes(gltf, (n) => n === name);
      expect(nodes).toHaveLength(1);
      const materials = new Set(gltf.meshes![nodes[0].mesh!].primitives.map((p) => p.material));
      expect(materials.size).toBe(1);
      const material = gltf.materials![[...materials][0]!];
      expect(material.pbrMetallicRoughness?.baseColorTexture).toBeUndefined();
      return (material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]).slice(0, 3);
    };
    expect(colorOf("wear-top")).not.toEqual(colorOf("wear-bottom"));
  });
});
