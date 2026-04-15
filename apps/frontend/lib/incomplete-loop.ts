import type { DailyDifficulty, HomeDraftSnapshot, Prompt, WritingDraftType } from "./types";

export type IncompleteLoopStep = "answer" | "feedback" | "rewrite";

export interface IncompleteLoopPromptSnapshot {
  topic: string;
  questionEn: string;
  questionKo: string;
}

export interface IncompleteLoopState {
  promptId: string;
  difficulty: DailyDifficulty;
  step: IncompleteLoopStep;
  draftType?: WritingDraftType | null;
  sessionId?: string;
  updatedAt: string;
  promptSnapshot: IncompleteLoopPromptSnapshot;
  snapshot?: HomeDraftSnapshot | null;
}

const INCOMPLETE_LOOP_KEY = "writeloop_incomplete_loop";

function buildIncompleteLoopKey(ownerId?: number | null) {
  const ownerScope =
    typeof ownerId === "number" && Number.isFinite(ownerId) && ownerId > 0
      ? `user:${ownerId}`
      : "guest";
  return `${INCOMPLETE_LOOP_KEY}:${ownerScope}`;
}

export function buildIncompleteLoopPromptSnapshot(prompt: Prompt): IncompleteLoopPromptSnapshot {
  return {
    topic: prompt.topic,
    questionEn: prompt.questionEn,
    questionKo: prompt.questionKo
  };
}

export function saveIncompleteLoop(state: IncompleteLoopState, ownerId?: number | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildIncompleteLoopKey(ownerId), JSON.stringify(state));
}

export function getIncompleteLoop(ownerId?: number | null): IncompleteLoopState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(buildIncompleteLoopKey(ownerId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as IncompleteLoopState;
  } catch {
    window.localStorage.removeItem(buildIncompleteLoopKey(ownerId));
    return null;
  }
}

export function clearIncompleteLoop(ownerId?: number | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(buildIncompleteLoopKey(ownerId));
}

export function clearAllIncompleteLoops() {
  if (typeof window === "undefined") {
    return;
  }

  const keysToDelete: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(`${INCOMPLETE_LOOP_KEY}:`)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

export function clearIncompleteLoopForPrompt(
  promptId: string,
  step?: IncompleteLoopStep,
  ownerId?: number | null
) {
  const currentState = getIncompleteLoop(ownerId);
  if (!currentState || currentState.promptId !== promptId) {
    return;
  }

  if (step && currentState.step !== step) {
    return;
  }

  clearIncompleteLoop(ownerId);
}
