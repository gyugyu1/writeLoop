import * as SecureStore from "expo-secure-store";
import type { DailyDifficulty, Feedback, Prompt } from "./types";

export type PracticeFeedbackState = {
  difficulty: DailyDifficulty;
  prompt: Prompt;
  answer: string;
  feedback: Feedback;
};

const PRACTICE_FEEDBACK_STATE_KEY = "writeloop_practice_feedback_state";

let practiceFeedbackState: PracticeFeedbackState | null = null;

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
  void SecureStore.setItemAsync(PRACTICE_FEEDBACK_STATE_KEY, JSON.stringify(nextState));
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

  const rawValue = await SecureStore.getItemAsync(PRACTICE_FEEDBACK_STATE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as PracticeFeedbackState;
    practiceFeedbackState = parsedValue;
    return matchesRequestedState(parsedValue, difficulty, promptId) ? parsedValue : null;
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
