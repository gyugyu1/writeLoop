import * as SecureStore from "expo-secure-store";
import { getActiveStorageOwnerScope, isGuestStorageOwnerScope } from "./storage-owner";
import type { DailyDifficulty, Feedback, Prompt } from "./types";

export type PracticeFeedbackState = {
  difficulty: DailyDifficulty;
  prompt: Prompt;
  answer: string;
  feedback: Feedback;
};

const PRACTICE_FEEDBACK_STATE_KEY = "writeloop_practice_feedback_state";

let practiceFeedbackState: PracticeFeedbackState | null = null;

type StoredPracticeFeedbackState = {
  ownerScope: string;
  state: PracticeFeedbackState;
};

function matchesRequestedState(
  state: PracticeFeedbackState | null,
  difficulty?: DailyDifficulty,
  promptId?: string
) {
  if (!state) {
    return false;
  }

  if (difficulty && state.difficulty !== difficulty) {
    return false;
  }

  if (promptId && state.prompt.id !== promptId) {
    return false;
  }

  return true;
}

export function savePracticeFeedbackState(nextState: PracticeFeedbackState) {
  practiceFeedbackState = nextState;
  void (async () => {
    const ownerScope = await getActiveStorageOwnerScope();
    await SecureStore.setItemAsync(
      PRACTICE_FEEDBACK_STATE_KEY,
      JSON.stringify({
        ownerScope,
        state: nextState
      } satisfies StoredPracticeFeedbackState)
    );
  })();
}

export function getPracticeFeedbackState(
  difficulty?: DailyDifficulty,
  promptId?: string
) {
  return matchesRequestedState(practiceFeedbackState, difficulty, promptId)
    ? practiceFeedbackState
    : null;
}

export async function hydratePracticeFeedbackState(
  difficulty?: DailyDifficulty,
  promptId?: string
): Promise<PracticeFeedbackState | null> {
  if (matchesRequestedState(practiceFeedbackState, difficulty, promptId)) {
    return practiceFeedbackState;
  }

  const ownerScope = await getActiveStorageOwnerScope();
  const rawValue = await SecureStore.getItemAsync(PRACTICE_FEEDBACK_STATE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StoredPracticeFeedbackState | PracticeFeedbackState;
    const resolvedState =
      "state" in parsedValue && typeof parsedValue.ownerScope === "string"
        ? parsedValue.ownerScope === ownerScope
          ? parsedValue.state
          : null
        : isGuestStorageOwnerScope(ownerScope)
          ? (parsedValue as PracticeFeedbackState)
          : null;

    practiceFeedbackState = resolvedState;
    return matchesRequestedState(resolvedState, difficulty, promptId) ? resolvedState : null;
  } catch {
    practiceFeedbackState = null;
    await SecureStore.deleteItemAsync(PRACTICE_FEEDBACK_STATE_KEY);
    return null;
  }
}

export function clearPracticeFeedbackState() {
  practiceFeedbackState = null;
  void SecureStore.deleteItemAsync(PRACTICE_FEEDBACK_STATE_KEY);
}
