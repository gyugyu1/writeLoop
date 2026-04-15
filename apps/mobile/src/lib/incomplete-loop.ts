import * as SecureStore from "expo-secure-store";
import { getActiveStorageOwnerScope, isGuestStorageOwnerScope } from "./storage-owner";
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

type StoredIncompleteLoopState = {
  ownerScope: string;
  state: IncompleteLoopState;
};

export function buildIncompleteLoopPromptSnapshot(prompt: Prompt): IncompleteLoopPromptSnapshot {
  return {
    topic: prompt.topic,
    questionEn: prompt.questionEn,
    questionKo: prompt.questionKo
  };
}

export async function saveIncompleteLoop(state: IncompleteLoopState) {
  const ownerScope = await getActiveStorageOwnerScope();
  await SecureStore.setItemAsync(
    INCOMPLETE_LOOP_KEY,
    JSON.stringify({
      ownerScope,
      state
    } satisfies StoredIncompleteLoopState)
  );
}

export async function getIncompleteLoop(): Promise<IncompleteLoopState | null> {
  const ownerScope = await getActiveStorageOwnerScope();
  const rawValue = await SecureStore.getItemAsync(INCOMPLETE_LOOP_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StoredIncompleteLoopState | IncompleteLoopState;
    if ("state" in parsedValue && typeof parsedValue.ownerScope === "string") {
      return parsedValue.ownerScope === ownerScope ? parsedValue.state : null;
    }

    return isGuestStorageOwnerScope(ownerScope) ? (parsedValue as IncompleteLoopState) : null;
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
