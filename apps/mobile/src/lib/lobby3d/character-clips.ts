import {
  ACTION_SECONDS,
  BOOK_TURN_BACK_SECONDS,
  SCENE_OUT_SECONDS,
  SIT_DOWN_SECONDS,
  STAND_UP_SECONDS,
  type ActionType,
  type PostureKind,
  type SceneState
} from "./engine";
import { PLAYER_SCALE } from "./player";

// 시뮬레이션 상태(속도, 동작)를 라이트루프 모델의 클립 재생으로 옮기는 규칙.
// 모델(docs/guides/character-3d-model-spec.ko.md)의 클립을 쓰고, 움직임은 도형 캐릭터 시험본과 같게 맞춘다.

/** 동작을 재생할 클립. spin은 클립이 없고 몸 전체를 돌린다. */
export const ACTION_CLIPS: Record<Exclude<ActionType, "spin">, string> = {
  wave: "wave",
  jump: "jump",
  hop: "hop",
  point: "point",
  look: "look_around",
  poke: "poke"
};

export interface CharacterClipInput {
  /** 바닥에서 움직이는 속력(칸/초). */
  speed: number;
  action: { type: ActionType; t: number } | null;
  /** 앉기 자세. 있으면 동작보다 먼저 보인다(일어난 뒤에 동작한다). */
  posture?: { kind: PostureKind; t: number } | null;
  /** 장소에서 '들어가기'를 누른 뒤의 동작. 있으면 다른 것보다 먼저 보인다. */
  scene?: SceneState | null;
}

/** 들어가기 동작 클립 길이(초). 모델(finalize_rig.py)과 같다. */
const THINK_IN_SECONDS = 0.6;
const THINK_IDLE_SECONDS = 2;
const CHAIR_STEP_SECONDS = 0.4;
const CHAIR_SIT_SECONDS = 0.6;
const CHAIR_IDLE_SECONDS = 2;
const BOOK_TAKE_SECONDS = 1;

/** 들어가기 동작에서 재생할 클립과 그 시간. 클립 없이 걷거나 서 있는 때는 null. */
export function sceneClip(scene: SceneState): { clip: string; time: number } | null {
  const { kind, phase, t } = scene;
  if (kind === "think") {
    if (phase === "in") return t < THINK_IN_SECONDS ? { clip: "think_in", time: t } : { clip: "think_idle", time: (t - THINK_IN_SECONDS) % THINK_IDLE_SECONDS };
    if (phase === "hold") return { clip: "think_idle", time: t % THINK_IDLE_SECONDS };
    return { clip: "think_out", time: t };
  }
  if (kind === "chair") {
    if (phase === "in") {
      if (t < CHAIR_STEP_SECONDS) return null;
      const sit = t - CHAIR_STEP_SECONDS;
      return sit < CHAIR_SIT_SECONDS ? { clip: "chair_sit_down", time: sit } : { clip: "chair_sit_idle", time: (sit - CHAIR_SIT_SECONDS) % CHAIR_IDLE_SECONDS };
    }
    if (phase === "hold") return { clip: "chair_sit_idle", time: t % CHAIR_IDLE_SECONDS };
    return t < CHAIR_SIT_SECONDS ? { clip: "chair_stand_up", time: t } : null;
  }
  if (phase === "in") return { clip: "book_take", time: Math.min(t, BOOK_TAKE_SECONDS) };
  if (phase === "hold") return { clip: "book_take", time: BOOK_TAKE_SECONDS };
  return t < BOOK_TURN_BACK_SECONDS ? { clip: "book_take", time: BOOK_TAKE_SECONDS } : { clip: "book_put", time: t - BOOK_TURN_BACK_SECONDS };
}

/** 들어가기 동작 클립을 섞는 무게. 시작 0.2초 동안 들어오고, 돌아오는 끝 0.2초 동안 빠진다. */
function sceneWeight(scene: SceneState, clip: string): number {
  const { kind, phase, t } = scene;
  if (phase === "in" && kind !== "chair") return Math.min(1, t / 0.2);
  if (phase === "in" && clip === "chair_sit_down") return Math.min(1, (t - CHAIR_STEP_SECONDS) / 0.2);
  if (phase === "out") {
    const end = kind === "chair" ? CHAIR_SIT_SECONDS : SCENE_OUT_SECONDS[kind];
    return Math.min(1, Math.max(0, end - t) / 0.2);
  }
  return 1;
}

/** 앉기 자세마다 재생할 클립. */
export const POSTURE_CLIPS: Record<PostureKind, string> = {
  "sitting-down": "sit_down",
  sitting: "sit_idle",
  "standing-up": "stand_up"
};
/** sit_idle 클립 길이(초). 반복한다. */
const SIT_IDLE_SECONDS = 2;

export interface CharacterClipState {
  idleWeight: number;
  walkWeight: number;
  walkTimeScale: number;
  /** 달리기(run 클립) 무게. 속력 2.4~3.6에서 걷기와, 3.6~5.0에서 빠른 달리기와 섞는다. */
  runWeight: number;
  /** 빠른 달리기(sprint 클립) 무게. */
  sprintWeight: number;
  /** run 클립을 혼자 틀 때 발이 미끄러지지 않는 배속. */
  runTimeScale: number;
  /** sprint 클립을 혼자 틀 때 발이 미끄러지지 않는 배속. */
  sprintTimeScale: number;
  /** 한 번 하는 동작 클립 이름. 없으면 null. */
  actionClip: string | null;
  /** 그 클립 안의 시간(초) = 동작이 시작된 뒤 지난 시간. */
  actionTime: number;
  /** 그 클립을 섞는 무게(시작 0.2초 동안 들어오고 끝나기 0.25초 전부터 빠진다). */
  actionWeight: number;
  /** spin으로 몸 전체를 더 돌릴 각도(라디안). */
  spinAngle: number;
  /** spin으로 몸 전체를 들어 올릴 높이(칸). */
  spinLift: number;
}

/** walk 클립(0.8초, 두 걸음)을 배속 1로 틀 때 디딘 발이 뒤로 가는 속도(키 1.0 모델 단위/초). player-human.glb 원본 측정값. */
const WALK_STRIDE_SPEED = 0.689999;
/** run 클립(16/30초, 두 걸음)의 같은 값. */
const RUN_STRIDE_SPEED = 1.189421;
/** sprint 클립(0.6초, 두 걸음)의 같은 값. */
const SPRINT_STRIDE_SPEED = 1.22379;
/** 세 클립의 길이(초). 셋 다 왼발 디딤이 위상 0, 오른발 디딤이 0.5다. */
const WALK_SECONDS = 0.8;
const RUN_SECONDS = 16 / 30;
const SPRINT_SECONDS = 0.6;
/** 걷기 → 달리기, 달리기 → 빠른 달리기로 섞는 속력 구간(칸/초). engine의 걷기 2.4·RUN_SPEED·SPRINT_SPEED와 같다. */
const WALK_RUN_FROM = 2.4;
const RUN_FULL = 3.6;
const SPRINT_FULL = 5.0;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 걷기·달리기·빠른 달리기를 같은 걸음 위상으로 함께 돌릴 때, 위상(한 바퀴 = 1)이 1초에 나아가는 양.
 * 이동한 거리를 무게로 섞은 한 바퀴 거리(디딘 발 속도 × 클립 길이)로 나눈다. 한 클립만 쓰면 그 클립의 배속 ÷ 길이와 같아
 * 발이 미끄러지지 않고, 섞는 동안에는 위상 하나로 세 클립을 꺼내 다리·팔이 엇갈리지 않는다.
 */
export function locomotionPhaseRate(speed: number, state: Pick<CharacterClipState, "walkWeight" | "runWeight" | "sprintWeight">): number {
  const total = state.walkWeight + state.runWeight + state.sprintWeight;
  if (total <= 1e-6 || speed <= 0) return 0;
  const cycle =
    (state.walkWeight * WALK_STRIDE_SPEED * WALK_SECONDS +
      state.runWeight * RUN_STRIDE_SPEED * RUN_SECONDS +
      state.sprintWeight * SPRINT_STRIDE_SPEED * SPRINT_SECONDS) /
    total;
  return speed / PLAYER_SCALE / cycle;
}
/** 도형 캐릭터에서 spin으로 들어 올린 최고 높이(0.35)를 바닥 칸으로(캐릭터 배율 1.25). */
const SPIN_PEAK = 0.35 * 1.25;

export function characterClipState({ speed, action, posture, scene }: CharacterClipInput): CharacterClipState {
  const move = Math.min(1, speed / 1.6);
  // 움직이는 몫(move)을 속력에 따라 걷기 → 달리기 → 빠른 달리기로 나눈다
  const toRun = clamp01((speed - WALK_RUN_FROM) / (RUN_FULL - WALK_RUN_FROM));
  const toSprint = clamp01((speed - RUN_FULL) / (SPRINT_FULL - RUN_FULL));
  const state: CharacterClipState = {
    idleWeight: 1 - move,
    walkWeight: move * (1 - toRun),
    // 디딘 발이 뒤로 가는 속도가 이동 속도와 같게(발이 미끄러지지 않게).
    walkTimeScale: speed / (WALK_STRIDE_SPEED * PLAYER_SCALE),
    runWeight: move * toRun * (1 - toSprint),
    sprintWeight: move * toSprint,
    runTimeScale: speed / (RUN_STRIDE_SPEED * PLAYER_SCALE),
    sprintTimeScale: speed / (SPRINT_STRIDE_SPEED * PLAYER_SCALE),
    actionClip: null,
    actionTime: 0,
    actionWeight: 0,
    spinAngle: 0,
    spinLift: 0
  };
  if (scene) {
    const shot = sceneClip(scene);
    if (shot) {
      state.actionClip = shot.clip;
      state.actionTime = shot.time;
      state.actionWeight = sceneWeight(scene, shot.clip);
    }
    return state;
  }
  if (posture) {
    // 앉는 중은 서 있기에서 0.2초 동안 넘어가고, 일어나는 중은 끝나기 0.2초 전부터 서 있기로 돌아간다
    state.actionClip = POSTURE_CLIPS[posture.kind];
    state.actionTime = posture.kind === "sitting" ? posture.t % SIT_IDLE_SECONDS : posture.t;
    state.actionWeight =
      posture.kind === "sitting-down"
        ? Math.min(1, posture.t / 0.2)
        : posture.kind === "standing-up"
          ? Math.min(1, Math.max(0, STAND_UP_SECONDS - posture.t) / 0.2)
          : 1;
    if (posture.kind === "sitting-down") state.actionTime = Math.min(posture.t, SIT_DOWN_SECONDS);
    return state;
  }
  if (!action) return state;
  const length = ACTION_SECONDS[action.type];
  if (action.type === "spin") {
    const k = Math.min(1, action.t / length);
    state.spinAngle = Math.PI * 2 * k;
    state.spinLift = Math.sin(Math.PI * k) * SPIN_PEAK;
    return state;
  }
  state.actionClip = ACTION_CLIPS[action.type];
  state.actionTime = action.t;
  state.actionWeight = Math.min(1, action.t / 0.2) * Math.min(1, Math.max(0, length - action.t) / 0.25);
  return state;
}
