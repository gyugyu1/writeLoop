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

export function buildIncompleteLoopPromptSnapshot(prompt: Prompt): IncompleteLoopPromptSnapshot {
  return {
    topic: prompt.topic,
    questionEn: prompt.questionEn,
    questionKo: prompt.questionKo
  };
}

export function saveIncompleteLoop(state: IncompleteLoopState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(INCOMPLETE_LOOP_KEY, JSON.stringify(state));
}

export function getIncompleteLoop(): IncompleteLoopState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(INCOMPLETE_LOOP_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as IncompleteLoopState;
  } catch {
    window.localStorage.removeItem(INCOMPLETE_LOOP_KEY);
    return null;
  }
}

export function clearIncompleteLoop() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(INCOMPLETE_LOOP_KEY);
}

export function clearIncompleteLoopForPrompt(promptId: string, step?: IncompleteLoopStep) {
  const currentState = getIncompleteLoop();
  if (!currentState || currentState.promptId !== promptId) {
    return;
  }

  if (step && currentState.step !== step) {
    return;
  }

  clearIncompleteLoop();
}
