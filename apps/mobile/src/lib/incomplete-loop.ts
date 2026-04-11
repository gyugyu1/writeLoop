import * as SecureStore from "expo-secure-store";
import type { DailyDifficulty, Prompt, WritingDraftType } from "./types";

export type IncompleteLoopStep = "answer" | "feedback" | "rewrite";

export type IncompleteLoopPromptSnapshot = {
  topic: string;
  questionEn: string;
  questionKo: string;
};

export type IncompleteLoopState = {
  promptId: string;
  difficulty: DailyDifficulty;
  step: IncompleteLoopStep;
  draftType?: WritingDraftType | null;
  sessionId?: string;
  updatedAt: string;
  promptSnapshot: IncompleteLoopPromptSnapshot;
};

const INCOMPLETE_LOOP_KEY = "writeloop_incomplete_loop";

export function buildIncompleteLoopPromptSnapshot(prompt: Prompt): IncompleteLoopPromptSnapshot {
  return {
    topic: prompt.topic,
    questionEn: prompt.questionEn,
    questionKo: prompt.questionKo
  };
}

export async function saveIncompleteLoop(state: IncompleteLoopState) {
  await SecureStore.setItemAsync(INCOMPLETE_LOOP_KEY, JSON.stringify(state));
}

export async function getIncompleteLoop(): Promise<IncompleteLoopState | null> {
  const rawValue = await SecureStore.getItemAsync(INCOMPLETE_LOOP_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as IncompleteLoopState;
  } catch {
    await clearIncompleteLoop();
    return null;
  }
}

export async function clearIncompleteLoop() {
  await SecureStore.deleteItemAsync(INCOMPLETE_LOOP_KEY);
}

export async function clearIncompleteLoopForPrompt(promptId: string, step?: IncompleteLoopStep) {
  const currentState = await getIncompleteLoop();
  if (!currentState || currentState.promptId !== promptId) {
    return;
  }

  if (step && currentState.step !== step) {
    return;
  }

  await clearIncompleteLoop();
}
