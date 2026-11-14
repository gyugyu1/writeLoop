// [spec] qa 테스트(작업 059, 기능 변경: 3D 로비 캐릭터를 확정 3D 모델로 바꾼다). 바뀔 동작.
// 기대값은 명세(private 작업 폴더 01-main-spec.md)의 "움직임(클립 재생)"과 "테스트로 볼 것"에서만 가져온다.
// 명세가 새 파일 src/lib/lobby3d/character-clips.ts의 순수 함수로 떼라고 한 규칙을 본다.
// 가정한 부르는 방법(02-qa-tests.md에 적음):
//   characterClipState({ speed, action }) → { idleWeight, walkWeight, walkTimeScale,
//                                            actionClip, actionTime, actionWeight, spinAngle, spinLift }
//   입력은 LobbySnapshot의 speed(= hypot(vx, vz))와 action({ type, t } | null)과 같은 모양이다.
//   spinLift는 바닥 칸 단위다(명세: 최고 0.35 × 1.25칸).
import { characterClipState } from "@/lib/lobby3d/character-clips";
import type { ActionType } from "@/lib/lobby3d/engine";

const CYCLE = (2 * Math.PI) / 0.8;
const walkScale = (speed: number) => (3 + 3.2 * speed) / CYCLE;
const SPIN_PEAK = 0.35 * 1.25;

describe("[spec] 서 있기·걷기 클립 섞기", () => {
  it("[spec] 속도 0: walk 무게 0, idle 무게 1, walk 재생 속도 3 ÷ (2π/0.8)", () => {
    const s = characterClipState({ speed: 0, action: null });
    expect(s.walkWeight).toBeCloseTo(0, 10);
    expect(s.idleWeight).toBeCloseTo(1, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(0), 10);
    expect(s.walkTimeScale).toBeCloseTo(0.381972, 5);
  });

  it("[spec] 속도 0.8: 걷는 정도 0.5라 walk 0.5, idle 0.5, walk 재생 속도 (3 + 3.2×0.8) ÷ (2π/0.8)", () => {
    const s = characterClipState({ speed: 0.8, action: null });
    expect(s.walkWeight).toBeCloseTo(0.5, 10);
    expect(s.idleWeight).toBeCloseTo(0.5, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(0.8), 10);
    expect(s.walkTimeScale).toBeCloseTo(0.707921, 5);
  });

  it("[spec] 속도 0.4: walk 0.25, idle 0.75", () => {
    const s = characterClipState({ speed: 0.4, action: null });
    expect(s.walkWeight).toBeCloseTo(0.25, 10);
    expect(s.idleWeight).toBeCloseTo(0.75, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(0.4), 10);
  });

  it("[spec] 속도 1.6: 걷는 정도 1이라 walk 1, idle 0", () => {
    const s = characterClipState({ speed: 1.6, action: null });
    expect(s.walkWeight).toBeCloseTo(1, 10);
    expect(s.idleWeight).toBeCloseTo(0, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(1.6), 10);
  });

  it("[spec] 속도 2.6(기본 걷는 속도): 걷는 정도는 1을 넘지 않고, walk 재생 속도는 속도를 따라 (3 + 3.2×2.6) ÷ (2π/0.8)", () => {
    const s = characterClipState({ speed: 2.6, action: null });
    expect(s.walkWeight).toBeCloseTo(1, 10);
    expect(s.idleWeight).toBeCloseTo(0, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(2.6), 10);
    expect(s.walkTimeScale).toBeCloseTo(1.441307, 5);
  });

  it("[spec] 동작이 없으면 재생할 동작 클립이 없고 돌리기·들어 올리기도 없다", () => {
    const s = characterClipState({ speed: 0, action: null });
    expect(s.actionClip).toBeNull();
    expect(s.actionWeight).toBeCloseTo(0, 10);
    expect(s.spinAngle).toBeCloseTo(0, 10);
    expect(s.spinLift).toBeCloseTo(0, 10);
  });
});

describe("[spec] 동작 클립", () => {
  const MAPPING: [ActionType, string, number][] = [
    ["wave", "wave", 2.4],
    ["jump", "jump", 1.6],
    ["hop", "hop", 1.8],
    ["point", "point", 2.2],
    ["look", "look_around", 2.6],
    ["poke", "poke", 0.8]
  ];

  it.each(MAPPING)("[spec] %s 동작은 %s 클립을, 지난 시간 그대로의 시간으로 재생한다", (type, clip, length) => {
    const t = length / 2;
    const s = characterClipState({ speed: 0, action: { type, t } });
    expect(s.actionClip).toBe(clip);
    expect(s.actionTime).toBeCloseTo(t, 10);
    expect(s.actionWeight).toBeCloseTo(1, 10);
  });

  it("[spec] 클립 안의 시간은 action.t를 그대로 따른다(look t=1.234 → look_around 1.234초)", () => {
    const s = characterClipState({ speed: 0, action: { type: "look", t: 1.234 } });
    expect(s.actionClip).toBe("look_around");
    expect(s.actionTime).toBeCloseTo(1.234, 10);
  });

  it.each(MAPPING)("[spec] %s: 클립 동작에는 앱이 따로 돌리거나 들어 올리지 않는다", (type, _clip, length) => {
    const s = characterClipState({ speed: 0, action: { type, t: length / 2 } });
    expect(s.spinAngle).toBeCloseTo(0, 10);
    expect(s.spinLift).toBeCloseTo(0, 10);
  });

  // 섞는 무게 = min(1, t/0.2) × min(1, max(0, 길이 − t)/0.25). 길이는 ACTION_SECONDS(명세의 "지금 도형 캐릭터의 env").
  const ENV: [ActionType, number, number][] = [
    ["wave", 0, 0],
    ["wave", 0.05, 0.25],
    ["wave", 0.1, 0.5],
    ["wave", 0.2, 1],
    ["wave", 1.2, 1],
    ["wave", 2.15, 1],
    ["wave", 2.275, 0.5],
    ["wave", 2.35, 0.2],
    ["jump", 1.5, 0.4],
    ["hop", 0.15, 0.75],
    ["point", 2.0, 0.8],
    ["look", 2.5, 0.4],
    ["poke", 0.1, 0.5],
    ["poke", 0.65, 0.6],
    ["poke", 0.7, 0.4]
  ];

  it.each(ENV)("[spec] %s t=%s: 섞는 무게 %s(0.2초 들어오고 끝나기 0.25초 전부터 빠짐)", (type, t, weight) => {
    const s = characterClipState({ speed: 0, action: { type, t } });
    expect(s.actionWeight).toBeCloseTo(weight, 10);
  });

  it("[spec] 걸으면서 poke를 받아도 동작 클립은 poke다", () => {
    const s = characterClipState({ speed: 2.6, action: { type: "poke", t: 0.4 } });
    expect(s.actionClip).toBe("poke");
    expect(s.actionTime).toBeCloseTo(0.4, 10);
    expect(s.actionWeight).toBeCloseTo(1, 10);
  });
});

describe("[spec] spin(클립 없음)", () => {
  it("[spec] spin은 재생할 클립이 없다", () => {
    const s = characterClipState({ speed: 0, action: { type: "spin", t: 0.3 } });
    expect(s.actionClip).toBeNull();
  });

  const SPIN: [number, number, number][] = [
    [0, 0, 0],
    [0.225, Math.PI / 2, Math.sin(Math.PI / 4) * SPIN_PEAK],
    [0.45, Math.PI, SPIN_PEAK],
    [0.675, (3 * Math.PI) / 2, Math.sin((3 * Math.PI) / 4) * SPIN_PEAK]
  ];

  it.each(SPIN)("[spec] t=%s: 0.9초에 한 바퀴라 회전 %s, 사인 모양으로 들어 올려 높이 %s칸", (t, angle, lift) => {
    const s = characterClipState({ speed: 0, action: { type: "spin", t } });
    expect(s.spinAngle).toBeCloseTo(angle, 10);
    expect(s.spinLift).toBeCloseTo(lift, 10);
  });

  it("[spec] 가장 높이 들 때 0.35 × 1.25 = 0.4375칸", () => {
    const s = characterClipState({ speed: 0, action: { type: "spin", t: 0.45 } });
    expect(s.spinLift).toBeCloseTo(0.4375, 10);
  });
});
