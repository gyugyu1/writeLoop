import type { DailyDifficulty, PromptDifficulty } from "./types";

export function getDifficultyLabel(difficulty: DailyDifficulty | PromptDifficulty): string {
  switch (difficulty) {
    case "A":
      return "EASY";
    case "B":
      return "MEDIUM";
    case "C":
      return "HARD";
    default:
      return difficulty;
  }
}
