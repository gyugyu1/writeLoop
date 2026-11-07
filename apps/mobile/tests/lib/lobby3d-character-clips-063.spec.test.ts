/**
 * @jest-environment node
 */
// [spec] qa 테스트(작업 063, 기능 변경: 모바일 로비 '들어가기' 때 동작. 라이트루프 모델에 동작 클립을 더한다).
// 기대값은 명세(private 작업 폴더 063-2026-11-08-모바일-로비-들어가기-동작/01-main-spec.md)의 "바뀌는 동작 6"과 "그대로여야 할 동작"에서만 가져온다.
// - 바뀔 동작(고치기 전에는 실패해야 한다): M19. 클립은 11개에서 19개가 된다.
// - 그대로 둘 동작(고치기 전에도 통과해야 한다): M-SKEL(뼈대는 그대로), M-OLD(기존 클립 11개의 모양과 길이).
//   기준값은 기준 커밋 f5964c4의 모델에서 뽑아 __fixtures__/lobby3d-character-clips-before-063.json에 두었다
//   (뽑은 방법: __fixtures__/gltf-clip-sampler.spec-helper.ts. 클립마다 키 시각 중 고르게 9개, 뼈 18개 × 위치·회전·크기).
// 허용 오차(명세에 숫자가 없어 qa가 정함, 02-qa-tests.md): 길이 ±0.001초, 회전 0.01라디안(약 0.6도), 위치·크기 ±0.001(키 1 기준).
// Blender로 다시 내보내며 생기는 반올림 차이는 이보다 훨씬 작고, 클립 계산식을 바꾸면 이보다 크게 달라진다고 본다.
// 새 클립 8개의 이름은 명세에 없어 보지 않는다(개수와, 옛 이름 11개가 그대로 있는지만 본다).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PATHS,
  clipDuration,
  clipNames,
  parseGlb,
  rotationAngle,
  sampleChannel,
  skeleton,
  type TrsPath
} from "./__fixtures__/gltf-clip-sampler.spec-helper";

const MODEL = join(__dirname, "..", "..", "assets", "models", "writeloop.glb");
const BEFORE = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "lobby3d-character-clips-before-063.json"), "utf8")) as {
  skeleton: { name: string; parent: string | null }[];
  clips: Record<string, { duration: number; times: number[]; channels: Record<string, number[][]> }>;
};

const OLD_CLIPS = ["idle", "walk", "wave", "jump", "hop", "point", "look_around", "poke", "sit_down", "sit_idle", "stand_up"];
const DURATION_TOLERANCE = 0.001;
const ROTATION_TOLERANCE = 0.01;
const VALUE_TOLERANCE = 0.001;

const parsed = parseGlb(readFileSync(MODEL));

describe("[spec] 작업 063 바뀔 동작: 새 동작 클립(명세 6)", () => {
  it("M19: 모델의 클립은 19개이고 이름이 서로 다르며, 기존 클립 11개의 이름이 모두 그대로 있다", () => {
    const names = clipNames(parsed);
    expect({ count: names.length, unique: new Set(names).size, missingOld: OLD_CLIPS.filter((name) => !names.includes(name)) }).toEqual({
      count: 19,
      unique: 19,
      missingOld: []
    });
  });
});

describe("[spec] 작업 063 그대로 둘 동작: 뼈대와 기존 클립 11개(명세 6, 그대로여야 할 동작)", () => {
  it("M-SKEL: 뼈대는 그대로다(뼈 18개의 이름·순서·부모가 기준 커밋과 같다)", () => {
    expect(skeleton(parsed)).toEqual(BEFORE.skeleton);
  });

  it("M-OLD 기준값: 기준값에 기존 클립 11개가 모두 있다(기준값 파일이 맞는지)", () => {
    expect(Object.keys(BEFORE.clips).sort()).toEqual([...OLD_CLIPS].sort());
  });

  it.each(OLD_CLIPS)("M-OLD: 기존 클립 %s의 길이와 모양(뼈마다 위치·회전·크기)이 기준 커밋과 같다", (name) => {
    const before = BEFORE.clips[name];
    const problems: string[] = [];
    const duration = clipDuration(parsed, name);
    if (Math.abs(duration - before.duration) > DURATION_TOLERANCE) problems.push(`길이 ${before.duration} → ${duration}`);
    for (const bone of BEFORE.skeleton) {
      for (const path of PATHS) {
        const expected = before.channels[`${bone.name}.${path}`];
        before.times.forEach((t, index) => {
          const want = expected.length === 1 ? expected[0] : expected[index];
          const got = sampleChannel(parsed, name, bone.name, path as TrsPath, t);
          const off =
            path === "rotation" ? rotationAngle(got, want) : Math.max(...got.map((value, i) => Math.abs(value - want[i])));
          const limit = path === "rotation" ? ROTATION_TOLERANCE : VALUE_TOLERANCE;
          if (!(off <= limit)) problems.push(`${bone.name}.${path} t=${t}: ${JSON.stringify(want)} → ${JSON.stringify(got.map((v) => +v.toFixed(5)))}`);
        });
      }
    }
    expect(problems).toEqual([]);
  });
});
