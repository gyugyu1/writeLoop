import { ACTION_SECONDS, SIT_DOWN_SECONDS, STAND_UP_SECONDS, type ActionType, type PostureKind } from "./engine";

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

/** walk 클립 길이(초). 두 걸음. */
const WALK_SECONDS = 0.8;
/** 도형 캐릭터에서 spin으로 들어 올린 최고 높이(0.35)를 바닥 칸으로(캐릭터 배율 1.25). */
const SPIN_PEAK = 0.35 * 1.25;

export function characterClipState({ speed, action, posture }: CharacterClipInput): CharacterClipState {
  const walk = Math.min(1, speed / 1.6);
  const state: CharacterClipState = {
    idleWeight: 1 - walk,
    walkWeight: walk,
    // 걸음 주기가 도형 캐릭터(초당 3 + 3.2 × 속도 라디안)와 같게.
    walkTimeScale: (3 + 3.2 * speed) / ((2 * Math.PI) / WALK_SECONDS),
    actionClip: null,
    actionTime: 0,
    actionWeight: 0,
    spinAngle: 0,
    spinLift: 0
  };
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
