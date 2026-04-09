import type { DailyDifficulty, PromptDifficulty } from "./types";

export function getDifficultyLabel(difficulty: DailyDifficulty | PromptDifficulty): string {
  switch (difficulty) {
    case "A":
      return "쉬움";
    case "B":
      return "보통";
    case "C":
      return "어려움";
    default:
      return difficulty;
  }
}
