/**
 * @jest-environment node
 */
// [spec] qa 테스트. 처음 쓴 것: 작업 059(3D 로비 캐릭터를 확정 3D 모델로 바꾼다).
// 작업 060 ①(기능 변경: 모델만 바꿔 끼울 수 있게)에서 명세의 "고칠 기존 테스트"대로 고쳤다.
// - 확정본 지문(sha256) 테스트를 지웠다(사용자 결정 2026-11-06, 부모 명세).
// - 모델 파일은 "약속"만 본다. 기대값은 060 ① 명세(private 작업 폴더 02-모델-교체-쉽게/01-main-spec.md)의 약속 목록에서만 가져온다.
//   - glTF 2 바이너리
//   - 키 1.0(±0.02), 발밑이 원점(바닥 높이 ±0.02)
//   - 앱이 쓰는 클립 8개(idle walk wave jump hop point look_around poke), 3단계에서 쓸 클립 3개(sit_down sit_idle stand_up)
//   - 앱이 쓰는 뼈 head, hips
//   - 외곽선 속성은 있어도 되고 없어도 된다
// - 약속보다 좁아 뺀 단언(명세가 뺄 것으로 든 것): 규격 뼈 17개와 thumb_r·부모, 뼈대가 하나뿐임, 클립이 정확히 11개임,
//   클립 길이, 외곽선 속성이 반드시 있음. 단언별 판단은 02-모델-교체-쉽게/02-qa-tests.md.
// - "앞쪽 +Z"는 약속의 뼈(head, hips)만으로는 파일에서 가려낼 수 없어 이 테스트가 보지 않는다(02-qa-tests.md).
// - 검사가 약속보다 좁지도 넓지도 않은지 보려고, 약속을 지키지만 확정본과 다른 가짜 모델과 약속을 어긴 가짜 모델에도 같은 검사를 돌린다.
// - Metro가 .glb를 자산으로 받는지: metro.config.js를 불러 resolver.assetExts를 본다(059에서 그대로).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..", "..");
const MODEL = join(MOBILE, "assets", "models", "writeloop.glb");

const APP_CLIPS = ["idle", "walk", "wave", "jump", "hop", "point", "look_around", "poke"];
const SIT_CLIPS = ["sit_down", "sit_idle", "stand_up"];
const APP_BONES = ["head", "hips"];
const TOLERANCE = 0.02;
const EPS = 1e-9;

type GltfNode = { name?: string; children?: number[]; mesh?: number; skin?: number };
type Gltf = {
  nodes?: GltfNode[];
  skins?: { joints: number[] }[];
  meshes?: { name?: string; primitives: { attributes: Record<string, number> }[] }[];
  accessors?: { min?: number[]; max?: number[] }[];
  animations?: { name: string; samplers: { input: number }[] }[];
};

/** 모델 파일이 앱과의 약속을 어긴 곳. 지키면 빈 목록. */
function brokenPromises(buffer: Buffer): string[] {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "glTF") return ["glTF 바이너리가 아니다"];
  const header: string[] = [];
  if (buffer.readUInt32LE(4) !== 2) header.push("glTF 2가 아니다");
  if (buffer.readUInt32LE(8) !== buffer.length) header.push("머리의 길이가 파일 크기와 다르다");
  if (buffer.toString("ascii", 16, 20) !== "JSON") header.push("첫 덩어리가 JSON이 아니다");
  if (header.length) return header;
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12))) as Gltf;

  const problems: string[] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  (gltf.meshes ?? []).forEach((mesh) =>
    mesh.primitives.forEach((primitive) => {
      const accessor = gltf.accessors?.[primitive.attributes.POSITION];
      if (accessor?.min && accessor.max) {
        minY = Math.min(minY, accessor.min[1]);
        maxY = Math.max(maxY, accessor.max[1]);
      }
    })
  );
  if (!Number.isFinite(minY)) problems.push("메시가 없다");
  else {
    if (Math.abs(maxY - minY - 1) > TOLERANCE + EPS) problems.push("키가 1.0±0.02가 아니다");
    if (Math.abs(minY) > TOLERANCE + EPS) problems.push("발밑이 원점(바닥 높이 ±0.02)이 아니다");
  }

  const clips = new Set((gltf.animations ?? []).map((a) => a.name));
  [...APP_CLIPS, ...SIT_CLIPS].forEach((name) => {
    if (!clips.has(name)) problems.push(`클립 없음: ${name}`);
  });

  const joints = new Set((gltf.skins ?? []).flatMap((skin) => skin.joints.map((i) => gltf.nodes?.[i]?.name)));
  APP_BONES.forEach((name) => {
    if (!joints.has(name)) problems.push(`뼈 없음: ${name}`);
  });
  return problems;
}

/** 시험용 가짜 glb(JSON 덩어리만). */
function fakeGlb(gltf: Gltf, override?: { magic?: string; version?: number; length?: number; chunkType?: string }): Buffer {
  let json = JSON.stringify({ asset: { version: "2.0" }, ...gltf });
  while (Buffer.byteLength(json) % 4 !== 0) json += " ";
  const body = Buffer.from(json, "utf8");
  const buffer = Buffer.alloc(20 + body.length);
  buffer.write(override?.magic ?? "glTF", 0, "ascii");
  buffer.writeUInt32LE(override?.version ?? 2, 4);
  buffer.writeUInt32LE(override?.length ?? buffer.length, 8);
  buffer.writeUInt32LE(body.length, 12);
  buffer.write(override?.chunkType ?? "JSON", 16, "ascii");
  body.copy(buffer, 20);
  return buffer;
}

/**
 * 약속은 지키지만 확정본과 다른 가짜 모델: 뼈는 root·hips·head뿐(뼈대 둘로 나눔), 외곽선 속성 없음,
 * 규격 밖 클립(sleep, extra)이 더 있고 클립 길이가 다르다.
 */
function keepingModel(options?: { minY?: number; maxY?: number; clips?: string[]; bones?: string[] }): Gltf {
  const bones = options?.bones ?? ["root", "hips", "head"];
  const clips = options?.clips ?? [...APP_CLIPS, ...SIT_CLIPS, "sleep", "extra"];
  return {
    nodes: [{ name: "body", mesh: 0, skin: 0 }, ...bones.map((name) => ({ name }))],
    skins: bones.length > 1 ? [{ joints: [1] }, { joints: bones.slice(1).map((_, i) => i + 2) }] : [{ joints: bones.map((_, i) => i + 1) }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 } }] }],
    accessors: [
      { min: [-0.4, options?.minY ?? 0, -0.3], max: [0.4, options?.maxY ?? 1, 0.3] },
      { min: [-1, -1, -1], max: [1, 1, 1] },
      { min: [0], max: [5] }
    ],
    animations: clips.map((name) => ({ name, samplers: [{ input: 2 }] }))
  };
}

describe("[spec] 넣을 모델 파일", () => {
  it("[spec] apps/mobile/assets/models/writeloop.glb가 있다", () => {
    expect(existsSync(MODEL)).toBe(true);
  });

  it("[spec] 앱과의 약속을 지킨다(glTF 2 바이너리, 키 1.0±0.02, 발밑이 원점±0.02, 클립 8+3개, 뼈 head·hips)", () => {
    expect(brokenPromises(readFileSync(MODEL))).toEqual([]);
  });
});

describe("[spec] 약속 검사는 약속만 본다(확정본을 바꿔도 약속을 지키면 통과한다)", () => {
  it("[spec] 규격 뼈 일부가 없고 뼈대가 둘이며, 외곽선 속성이 없고, 클립이 더 있고 길이가 달라도 통과한다", () => {
    expect(brokenPromises(fakeGlb(keepingModel()))).toEqual([]);
  });

  it.each([
    ["키 0.98", 0, 0.98],
    ["키 1.02", 0, 1.02],
    ["발밑 -0.02(키 1.0)", -0.02, 0.98],
    ["발밑 +0.02(키 1.0)", 0.02, 1.02]
  ])("[spec] 경계 안(%s)은 통과한다", (_label, minY, maxY) => {
    expect(brokenPromises(fakeGlb(keepingModel({ minY, maxY })))).toEqual([]);
  });

  it.each([
    ["키 0.97", 0, 0.97, ["키가 1.0±0.02가 아니다"]],
    ["키 1.03", 0, 1.03, ["키가 1.0±0.02가 아니다"]],
    ["발밑 +0.03(키 1.0)", 0.03, 1.03, ["발밑이 원점(바닥 높이 ±0.02)이 아니다"]],
    ["발밑 -0.03(키 1.0)", -0.03, 0.97, ["발밑이 원점(바닥 높이 ±0.02)이 아니다"]]
  ])("[spec] 경계 밖(%s)은 그 약속을 어긴 것으로 잡는다", (_label, minY, maxY, expected) => {
    expect(brokenPromises(fakeGlb(keepingModel({ minY, maxY })))).toEqual(expected);
  });

  it.each([...APP_CLIPS, ...SIT_CLIPS])("[spec] 클립 %s가 없으면 잡는다", (missing) => {
    const clips = [...APP_CLIPS, ...SIT_CLIPS].filter((c) => c !== missing);
    expect(brokenPromises(fakeGlb(keepingModel({ clips })))).toEqual([`클립 없음: ${missing}`]);
  });

  it.each(APP_BONES)("[spec] 뼈 %s가 없으면 잡는다", (missing) => {
    const bones = ["root", "hips", "head"].filter((b) => b !== missing);
    expect(brokenPromises(fakeGlb(keepingModel({ bones })))).toEqual([`뼈 없음: ${missing}`]);
  });

  it("[spec] 뼈 이름의 노드가 있어도 뼈대(skin)의 뼈가 아니면 잡는다", () => {
    const model = keepingModel();
    model.skins = [{ joints: [1] }]; // root만 뼈, hips·head는 노드로만 있다
    expect(brokenPromises(fakeGlb(model))).toEqual(["뼈 없음: head", "뼈 없음: hips"]);
  });

  it.each([
    ["glTF 머리가 아니면", { magic: "abcd" }, ["glTF 바이너리가 아니다"]],
    ["glTF 1이면", { version: 1 }, ["glTF 2가 아니다"]],
    ["머리의 길이가 파일 크기와 다르면", { length: 12 }, ["머리의 길이가 파일 크기와 다르다"]],
    ["첫 덩어리가 JSON이 아니면", { chunkType: "BIN\u0000" }, ["첫 덩어리가 JSON이 아니다"]]
  ])("[spec] %s 잡는다", (_label, override, expected) => {
    expect(brokenPromises(fakeGlb(keepingModel(), override))).toEqual(expected);
  });
});

describe("[spec] Metro 설정", () => {
  it("[spec] metro.config.js의 assetExts에 glb가 있다", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(join(MOBILE, "metro.config.js")) as { resolver?: { assetExts?: string[] } };
    expect(config.resolver?.assetExts).toContain("glb");
  });
});
