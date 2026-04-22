import type { DailyDifficulty, PromptDifficulty } from "./types";

export function normalizeDailyDifficulty(
  value: string | null | undefined,
  fallback: DailyDifficulty = "I"
): DailyDifficulty {
  const normalizedDifficulty = typeof value === "string" ? value.trim().toUpperCase() : "";
  const nextDifficulty = normalizedDifficulty === "INTRO" ? "I" : normalizedDifficulty;
  return nextDifficulty === "I" ||
    nextDifficulty === "A" ||
    nextDifficulty === "B" ||
    nextDifficulty === "C"
    ? nextDifficulty
    : fallback;
}

export function getDifficultyLabel(difficulty: DailyDifficulty | PromptDifficulty): string {
  switch (difficulty) {
    case "I":
      return "입문";
    case "A":
      return "쉬움";
    case "B":
      return "보통";
    case "C":
      return "도전";
    default:
      return difficulty;
  }
}

export function isPromptCompatibleWithDailyDifficulty(
  promptDifficulty: PromptDifficulty | null | undefined,
  selectedDifficulty: DailyDifficulty
) {
  return normalizeDailyDifficulty(promptDifficulty, selectedDifficulty) === selectedDifficulty;
}

export function resolvePracticeDifficulty(
  selectedDifficulty: DailyDifficulty,
  promptDifficulty: PromptDifficulty | null | undefined
): DailyDifficulty {
  return normalizeDailyDifficulty(promptDifficulty, selectedDifficulty);
}
