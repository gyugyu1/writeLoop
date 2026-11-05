/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 059, 기능 변경: 3D 로비 캐릭터를 확정 3D 모델로 바꾼다). 바뀔 동작("넣을 모델").
// 기대값은 명세(private 작업 폴더 01-main-spec.md)의 "넣을 모델"과 그 규격 문서 docs/guides/character-3d-model-spec.ko.md에서 가져온다.
// - 확정본을 그대로 복사했는지: 확정본 파일(저장소 밖)의 sha256을 1단계에서 재어 적었다(02-qa-tests.md).
// - 규격: 키 1.0, 뼈 17개 + thumb_r(부모는 규격 표), 클립 11개(규격 5절의 클립 중 "(나중)"인 sleep을 뺀 것),
//   꼭짓점 속성 _OUTLINE_NORMAL·_OUTLINE_BIAS, 앱이 쓰는 클립 길이(규격 5절).
// - Metro가 .glb를 자산으로 받는지: metro.config.js를 불러 resolver.assetExts를 본다.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MOBILE = join(__dirname, "..", "..");
const MODEL = join(MOBILE, "assets", "models", "writeloop.glb");
const CONFIRMED_SHA256 = "d5ea1cfb967bd1238f39b5ed87c752d82e197f41b02ccb2fa9df04f4de72d385";

type GltfNode = { name?: string; children?: number[]; mesh?: number; skin?: number };
type Gltf = {
  nodes: GltfNode[];
  skins: { joints: number[] }[];
  meshes: { name?: string; primitives: { attributes: Record<string, number> }[] }[];
  accessors: { min?: number[]; max?: number[] }[];
  animations: { name: string; samplers: { input: number }[] }[];
};

function readGlbJson(buffer: Buffer): Gltf {
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength)) as Gltf;
}

describe("[spec] 넣을 모델 파일", () => {
  it("[spec] apps/mobile/assets/models/writeloop.glb가 있다", () => {
    expect(existsSync(MODEL)).toBe(true);
  });

  it("[spec] 확정본을 그대로 복사했다(sha256이 확정본과 같다)", () => {
    const sha = createHash("sha256").update(readFileSync(MODEL)).digest("hex");
    expect(sha).toBe(CONFIRMED_SHA256);
  });

  describe("[spec] 규격", () => {
    const load = () => {
      const buffer = readFileSync(MODEL);
      return { buffer, gltf: readGlbJson(buffer) };
    };

    it("[spec] glTF 2 바이너리이고 머리의 길이가 파일 크기와 같으며, 첫 덩어리가 JSON이다", () => {
      const { buffer } = load();
      expect(buffer.toString("ascii", 0, 4)).toBe("glTF");
      expect(buffer.readUInt32LE(4)).toBe(2);
      expect(buffer.readUInt32LE(8)).toBe(buffer.length);
      expect(buffer.toString("ascii", 16, 20)).toBe("JSON");
    });

    it("[spec] 뼈는 규격 17개와 thumb_r, 부모가 규격 표와 같다", () => {
      const { gltf } = load();
      expect(gltf.skins).toHaveLength(1);
      const parentOf = new Map<number, number>();
      gltf.nodes.forEach((node, index) => node.children?.forEach((child) => parentOf.set(child, index)));
      const joints = gltf.skins[0].joints;
      const names = joints.map((i) => gltf.nodes[i].name);
      expect([...names].sort()).toEqual(
        [
          "root", "hips", "spine", "head", "ear_l", "ear_r", "arm_l", "arm_r", "hand_l", "hand_r",
          "leg_l", "leg_r", "foot_l", "foot_r", "tail_1", "tail_2", "tail_3", "thumb_r"
        ].sort()
      );
      const parent = (name: string) => {
        const index = joints.find((i) => gltf.nodes[i].name === name)!;
        const p = parentOf.get(index);
        return p === undefined ? undefined : gltf.nodes[p].name;
      };
      const EXPECTED_PARENT: Record<string, string> = {
        hips: "root",
        spine: "hips",
        head: "spine",
        ear_l: "head",
        ear_r: "head",
        arm_l: "spine",
        arm_r: "spine",
        hand_l: "arm_l",
        hand_r: "arm_r",
        leg_l: "hips",
        leg_r: "hips",
        foot_l: "leg_l",
        foot_r: "leg_r",
        tail_1: "hips",
        tail_2: "tail_1",
        tail_3: "tail_2",
        thumb_r: "hand_r"
      };
      Object.entries(EXPECTED_PARENT).forEach(([bone, expected]) => {
        expect({ bone, parent: parent(bone) }).toEqual({ bone, parent: expected });
      });
      // root는 뼈 중 부모가 없다(부모가 있어도 뼈가 아니다).
      const rootParent = parent("root");
      expect(rootParent === undefined || !names.includes(rootParent)).toBe(true);
    });

    it("[spec] 클립은 11개다(규격 5절의 클립 중 sleep을 뺀 것)", () => {
      const { gltf } = load();
      expect(gltf.animations.map((a) => a.name).sort()).toEqual(
        ["idle", "walk", "wave", "jump", "hop", "point", "look_around", "poke", "sit_down", "sit_idle", "stand_up"].sort()
      );
    });

    it.each([
      ["walk", 0.8],
      ["wave", 2.4],
      ["jump", 1.6],
      ["hop", 1.8],
      ["point", 2.2],
      ["look_around", 2.6],
      ["poke", 0.8]
    ])("[spec] 앱이 쓰는 클립 %s의 길이는 %s초다", (name, seconds) => {
      const { gltf } = load();
      const clip = gltf.animations.find((a) => a.name === name);
      expect(clip).toBeDefined();
      const end = Math.max(...clip!.samplers.map((s) => gltf.accessors[s.input].max?.[0] ?? 0));
      expect(end).toBeCloseTo(seconds, 3);
    });

    it("[spec] 키 1.0이고 원점 아래로 내려가지 않는다", () => {
      const { gltf } = load();
      let minY = Infinity;
      let maxY = -Infinity;
      gltf.meshes.forEach((mesh) =>
        mesh.primitives.forEach((primitive) => {
          const accessor = gltf.accessors[primitive.attributes.POSITION];
          minY = Math.min(minY, accessor.min![1]);
          maxY = Math.max(maxY, accessor.max![1]);
        })
      );
      expect(maxY).toBeCloseTo(1.0, 3);
      expect(minY).toBeGreaterThan(-0.001);
    });

    it("[spec] 뼈대를 쓰는 메시의 모든 조각에 _OUTLINE_NORMAL·_OUTLINE_BIAS가 있다", () => {
      const { gltf } = load();
      const skinned = gltf.nodes.filter((n) => n.mesh !== undefined && n.skin !== undefined);
      expect(skinned.length).toBeGreaterThan(0);
      skinned.forEach((node) =>
        gltf.meshes[node.mesh!].primitives.forEach((primitive) => {
          expect(Object.keys(primitive.attributes)).toEqual(expect.arrayContaining(["_OUTLINE_NORMAL", "_OUTLINE_BIAS"]));
        })
      );
    });
  });
});

describe("[spec] Metro 설정", () => {
  it("[spec] metro.config.js의 assetExts에 glb가 있다", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(join(MOBILE, "metro.config.js")) as { resolver?: { assetExts?: string[] } };
    expect(config.resolver?.assetExts).toContain("glb");
  });
});
