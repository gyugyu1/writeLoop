/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 134 ① 플레이어 교체, 기능 변경, 모바일): 앱에 넣을 사람형 모델 파일과, 남겨 두는 라룹이 파일.
// 기대값은 명세(private 작업 폴더 134-2026-11-22-사람형-플레이어-교체/02-플레이어-교체/01-main-spec.md)에서만 가져온다.
// 테스트 이름 앞의 [바뀔]은 구현 전에 실패해야 하는 테스트, [그대로]는 구현 전·뒤 모두 통과해야 하는 테스트다(02-qa-tests.md의 분류와 같다).
// - 파일: apps/mobile/assets/models/player-human.glb, sha256 ee27e4c9…9fa6(명세 바뀌는 동작 1)
// - 앱과의 약속(063 13 결정 2와 같은 약속 + 명세 4·5): 키 1.0(±0.02), 발밑이 원점(±0.02), 앱이 쓰는 클립, 뼈 head·hips·hand_r·hand_l,
//   메시 열한 개(몸·머리·눈·눈썹·입·머리카락·티셔츠·반바지·양말·운동화 두 짝)가 모두 뼈대로 휘는 껍질이다.
// - 첫 그릴 때부터 팔을 내린 idle: idle 클립의 첫 키가 두 팔 뼈(arm_l·arm_r)를 쉬는 자세(T자)에서 크게 돌려 둔다(명세 4).
// - 라룹이 writeloop.glb와 라룹이 고글 wear-goggles.glb는 지우지 않고 그대로다(명세 1). 바이트 지문은 기준 커밋 1fdf49d의 것이다.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..", "..");
const MODELS = join(MOBILE, "assets", "models");
const PLAYER = join(MODELS, "player-human.glb");

const PLAYER_SHA256 = "ee27e4c94ad485e67b624615af50c0f1a2b77f62e56a610a2ca3c09be5449fa6";
/** 기준 커밋 1fdf49d의 라룹이 파일 지문(명세 "지우지 않고 남긴다"). */
const BASE_SHA256 = {
  "writeloop.glb": "21426202ad440788f55b399b18f84be9fcba3019f8aa2d30646f3e4f8f30cf54",
  "wear-goggles.glb": "6b03823f93a7d7ba645b43cd7888ce2bc902a3941d0e99c053bda2f5e5604f3e"
};

/** 지금 동작 상태(character-clips)가 쓰는 클립. 새 클립(sleep·surprised·talk)은 앱이 쓰지 않아도 된다. */
const APP_CLIPS = [
  "idle", "walk", "wave", "hop", "jump", "sit_down", "sit_idle", "stand_up", "chair_sit_down", "chair_sit_idle", "chair_stand_up",
  "book_take", "book_put", "look_around", "point", "poke", "think_in", "think_idle", "think_out"
];
const APP_BONES = ["head", "hips", "hand_r", "hand_l"];
const TOLERANCE = 0.02;

type Node = { name?: string; mesh?: number; skin?: number; rotation?: number[] };
type Gltf = {
  nodes: Node[];
  skins: { joints: number[] }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string; min?: number[]; max?: number[] }[];
  bufferViews: { byteOffset?: number }[];
  animations: { name: string; channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { input: number; output: number }[] }[];
};

function parse(buffer: Buffer): { gltf: Gltf; floats: (accessor: number) => number[] } {
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)) as Gltf;
  const binStart = 20 + jsonLength + 8;
  const floats = (index: number) => {
    const accessor = gltf.accessors[index];
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type as "SCALAR" | "VEC3" | "VEC4"];
    const start = binStart + (gltf.bufferViews[accessor.bufferView].byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    return Array.from(new Float32Array(buffer.buffer.slice(buffer.byteOffset + start, buffer.byteOffset + start + accessor.count * width * 4)));
  };
  return { gltf, floats };
}

const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

describe("[spec] 134-① 넣을 사람형 모델 파일", () => {
  it("[바뀔] apps/mobile/assets/models/player-human.glb가 있다", () => {
    expect(existsSync(PLAYER)).toBe(true);
  });

  it("[바뀔] player-human.glb의 sha256이 원본(ee27e4c9…9fa6)과 같다", () => {
    expect(sha256(PLAYER)).toBe(PLAYER_SHA256);
  });

  it("[바뀔] glTF 2 바이너리이고, 키 1.0±0.02, 발밑이 원점(±0.02)이다", () => {
    const buffer = readFileSync(PLAYER);
    expect(buffer.toString("ascii", 0, 4)).toBe("glTF");
    expect(buffer.readUInt32LE(4)).toBe(2);
    const { gltf } = parse(buffer);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const mesh of gltf.meshes) {
      for (const primitive of mesh.primitives) {
        const accessor = gltf.accessors[primitive.attributes.POSITION];
        minY = Math.min(minY, accessor.min![1]);
        maxY = Math.max(maxY, accessor.max![1]);
      }
    }
    expect(Math.abs(maxY - minY - 1)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(minY)).toBeLessThanOrEqual(TOLERANCE);
  });

  it("[바뀔] 앱이 쓰는 클립 19개가 모두 있다", () => {
    const names = new Set(parse(readFileSync(PLAYER)).gltf.animations.map((a) => a.name));
    expect(APP_CLIPS.filter((name) => !names.has(name))).toEqual([]);
  });

  it("[바뀔] 앱이 쓰는 뼈 head·hips·hand_r·hand_l이 뼈대(skin)의 뼈다", () => {
    const { gltf } = parse(readFileSync(PLAYER));
    const joints = new Set(gltf.skins.flatMap((skin) => skin.joints.map((i) => gltf.nodes[i].name)));
    expect(APP_BONES.filter((name) => !joints.has(name))).toEqual([]);
  });

  it("[바뀔] 메시가 열한 개(몸·머리·눈·눈썹·입·머리카락·티셔츠·반바지·양말·운동화 두 짝)이고 모두 뼈대로 휘는 껍질이다", () => {
    const { gltf } = parse(readFileSync(PLAYER));
    const meshNodes = gltf.nodes.filter((node) => node.mesh !== undefined);
    expect(meshNodes).toHaveLength(11);
    expect(meshNodes.filter((node) => node.skin === undefined)).toEqual([]);
  });

  it("[바뀔] idle 클립의 첫 키는 두 팔 뼈를 쉬는 자세(T자)에서 45도 넘게 돌려 팔을 내린다(처음부터 T포즈가 아니다)", () => {
    const { gltf, floats } = parse(readFileSync(PLAYER));
    const idle = gltf.animations.find((a) => a.name === "idle")!;
    for (const bone of ["arm_l", "arm_r"]) {
      const index = gltf.nodes.findIndex((node) => node.name === bone);
      const channel = idle.channels.find((c) => c.target.node === index && c.target.path === "rotation")!;
      expect(channel).toBeDefined();
      const first = floats(idle.samplers[channel.sampler].output).slice(0, 4);
      const rest = gltf.nodes[index].rotation!;
      const dot = Math.abs(first.reduce((sum, v, k) => sum + v * rest[k], 0));
      const angleDeg = (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
      expect({ bone, over45: angleDeg > 45 }).toEqual({ bone, over45: true });
    }
  });
});

describe("[spec] 134-① 라룹이 파일은 지우지 않고 남긴다", () => {
  it.each(Object.entries(BASE_SHA256))("[그대로] %s가 있고 기준 커밋과 같은 파일이다", (name, expected) => {
    expect(existsSync(join(MODELS, name))).toBe(true);
    expect(sha256(join(MODELS, name))).toBe(expected);
  });
});

describe("[spec] 134-① Metro 설정", () => {
  it("[그대로] metro.config.js의 assetExts에 glb가 있다", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(join(MOBILE, "metro.config.js")) as { resolver?: { assetExts?: string[] } };
    expect(config.resolver?.assetExts).toContain("glb");
  });
});
