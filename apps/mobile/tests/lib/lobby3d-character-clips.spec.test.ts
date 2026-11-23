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

// 최종 모델(Codex 16차) walk: 디딘 발 속도 0.689999 모델 단위/초 × PLAYER_SCALE 2.27(18 결정).
const STANCE_SPEED = 0.689999 * 2.27;
const walkScale = (speed: number) => speed / STANCE_SPEED;
const SPIN_PEAK = 0.35 * 1.25;

describe("[spec] 서 있기·걷기 클립 섞기", () => {
  it("[spec] 속도 0: walk 무게 0, idle 무게 1, walk 재생 속도 0 ÷ (0.689999 × 2.27)", () => {
    const s = characterClipState({ speed: 0, action: null });
    expect(s.walkWeight).toBeCloseTo(0, 10);
    expect(s.idleWeight).toBeCloseTo(1, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(0), 10);
    expect(s.walkTimeScale).toBeCloseTo(0, 5);
  });

  it("[spec] 속도 0.8: 걷는 정도 0.5라 walk 0.5, idle 0.5, walk 재생 속도 0.8 ÷ (0.689999 × 2.27)", () => {
    const s = characterClipState({ speed: 0.8, action: null });
    expect(s.walkWeight).toBeCloseTo(0.5, 10);
    expect(s.idleWeight).toBeCloseTo(0.5, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(0.8), 10);
    expect(s.walkTimeScale).toBeCloseTo(0.510759, 5);
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

  // 작업 137 명세 2·"고칠 기존 테스트": 옛 속도 2.6은 걷기와 run이 섞이기 시작하는 2.4를 넘으므로, 기본 걷는 속도 2.4로 고쳤다.
  it("[spec] 속도 2.4(기본 걷는 속도): 걷는 정도는 1을 넘지 않고, walk 재생 속도는 속도를 따라 2.4 ÷ (0.689999 × 2.27)", () => {
    const s = characterClipState({ speed: 2.4, action: null });
    expect(s.walkWeight).toBeCloseTo(1, 10);
    expect(s.idleWeight).toBeCloseTo(0, 10);
    expect(s.walkTimeScale).toBeCloseTo(walkScale(2.4), 10);
    expect(s.walkTimeScale).toBeCloseTo(1.532275, 5);
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
    const s = characterClipState({ speed: 2.4, action: { type: "poke", t: 0.4 } });
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

// ---- 작업 137 명세 2: 동작 섞기는 실제 속도로 정한다(바뀔 동작) ----
// 서 있기 ↔ 걷기는 지금처럼(0~1.6), 걷기 ↔ run은 2.4~3.6, run ↔ sprint는 3.6~5.0에서 고르게 섞는다.
// 각 클립의 재생 속도는 디딘 발 속도가 이동 속도와 같게: 속도 ÷ (클립의 디딘 발 속도 × 2.27).
// 디딘 발 속도(03 결정 표, 모델 단위/초): walk 0.689999, run 1.189421, sprint 1.223790.
// 가정한 부르는 방법: characterClipState의 결과에 runWeight, sprintWeight, runTimeScale, sprintTimeScale를 더한다.
const RUN_SCALE = (speed: number) => speed / (1.189421 * 2.27);
const SPRINT_SCALE = (speed: number) => speed / (1.22379 * 2.27);

type Mix = { idleWeight: number; walkWeight: number; runWeight: number; sprintWeight: number; runTimeScale: number; sprintTimeScale: number };
const mix = (speed: number) => characterClipState({ speed, action: null }) as unknown as ReturnType<typeof characterClipState> & Mix;

describe("[spec] 137 걷기 ↔ run ↔ sprint 섞기(바뀔 동작)", () => {
  // [속도, idle, walk, run, sprint]
  const WEIGHTS: [number, number, number, number, number][] = [
    [0, 1, 0, 0, 0],
    [0.8, 0.5, 0.5, 0, 0],
    [1.6, 0, 1, 0, 0],
    [2.0, 0, 1, 0, 0],
    [2.4, 0, 1, 0, 0],
    [3.0, 0, 0.5, 0.5, 0],
    [3.6, 0, 0, 1, 0],
    [4.3, 0, 0, 0.5, 0.5],
    [5.0, 0, 0, 0, 1],
    [6.0, 0, 0, 0, 1]
  ];

  it.each(WEIGHTS)("[spec] 속도 %s: idle %s, walk %s, run %s, sprint %s", (speed, idle, walk, run, sprint) => {
    const s = mix(speed);
    expect(s.idleWeight).toBeCloseTo(idle, 10);
    expect(s.walkWeight).toBeCloseTo(walk, 10);
    expect(s.runWeight).toBeCloseTo(run, 10);
    expect(s.sprintWeight).toBeCloseTo(sprint, 10);
  });

  it("[spec] 2.4~3.6에서 walk 무게는 고르게 줄고 run 무게는 고르게 는다(2.7: walk 0.75, run 0.25)", () => {
    const s = mix(2.7);
    expect(s.walkWeight).toBeCloseTo(0.75, 10);
    expect(s.runWeight).toBeCloseTo(0.25, 10);
  });

  it("[spec] 3.6~5.0에서 run ↔ sprint는 고르게 섞는다(4.0: run 0.714286…, sprint 0.285714…)", () => {
    const s = mix(4.0);
    expect(s.runWeight).toBeCloseTo(1 - 0.4 / 1.4, 10);
    expect(s.sprintWeight).toBeCloseTo(0.4 / 1.4, 10);
  });

  it("[spec] 어느 속도에서도 무게의 합은 1이다", () => {
    for (let speed = 0; speed <= 6; speed += 0.1) {
      const s = mix(speed);
      expect(s.idleWeight + s.walkWeight + s.runWeight + s.sprintWeight).toBeCloseTo(1, 10);
    }
  });

  it("[spec] run 재생 속도는 속도 ÷ (1.189421 × 2.27), sprint는 속도 ÷ (1.223790 × 2.27)이다", () => {
    expect(mix(3.6).runTimeScale).toBeCloseTo(RUN_SCALE(3.6), 10);
    expect(mix(3.0).runTimeScale).toBeCloseTo(RUN_SCALE(3.0), 10);
    expect(mix(5.0).sprintTimeScale).toBeCloseTo(SPRINT_SCALE(5.0), 10);
    expect(mix(4.3).sprintTimeScale).toBeCloseTo(SPRINT_SCALE(4.3), 10);
  });

  it("[spec] 걷기 재생 속도 식은 그대로다(3.0에서도 속도 ÷ (0.689999 × 2.27))", () => {
    expect(mix(3.0).walkTimeScale).toBeCloseTo(walkScale(3.0), 10);
  });

  it("[spec] 3.6에서 run 재생 속도 ≈ 1.33334, 5.0에서 sprint 재생 속도 ≈ 1.79985", () => {
    expect(mix(3.6).runTimeScale).toBeCloseTo(1.33334, 4);
    expect(mix(5.0).sprintTimeScale).toBeCloseTo(1.79985, 4);
  });
});
