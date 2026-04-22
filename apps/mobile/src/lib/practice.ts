import type { DailyDifficulty, Prompt } from "./types";

export const validDifficulties: DailyDifficulty[] = ["I", "A", "B", "C"];

export function isDailyDifficulty(value: string): value is DailyDifficulty {
  return validDifficulties.includes(value as DailyDifficulty);
}

export function normalizeDailyDifficulty(
  value: string | null | undefined,
  fallback: DailyDifficulty = "I"
): DailyDifficulty {
  const normalizedDifficulty = typeof value === "string" ? value.trim().toUpperCase() : "";
  const nextDifficulty = normalizedDifficulty === "INTRO" ? "I" : normalizedDifficulty;
  return isDailyDifficulty(nextDifficulty) ? nextDifficulty : fallback;
}

export function isPromptCompatibleWithDailyDifficulty(
  promptDifficulty: string | null | undefined,
  selectedDifficulty: DailyDifficulty
) {
  return normalizeDailyDifficulty(promptDifficulty, selectedDifficulty) === selectedDifficulty;
}

export function resolvePracticeDifficulty(
  selectedDifficulty: DailyDifficulty,
  promptDifficulty: string | null | undefined
): DailyDifficulty {
  return normalizeDailyDifficulty(promptDifficulty, selectedDifficulty);
}

export function getQuestionLabel(index: number) {
  return `QUESTION ${String(index + 1).padStart(2, "0")}`;
}

export function getPromptCategoryKey(prompt: Prompt | null | undefined) {
  const category = prompt?.topicCategory?.trim();
  if (category) {
    return category.toUpperCase();
  }

  const topic = prompt?.topic?.trim();
  if (topic) {
    return topic.toUpperCase();
  }

  return prompt?.id ?? "";
}

export function countDistinctPromptCategories(prompts: Prompt[]) {
  return new Set(
    prompts
      .map((prompt) => getPromptCategoryKey(prompt))
      .filter((categoryKey) => categoryKey !== "")
  ).size;
}

export function buildDistinctCategoryPromptSelection(
  primaryCandidates: Prompt[],
  fallbackCandidates: Prompt[],
  desiredCount: number
) {
  if (desiredCount <= 0) {
    return [];
  }

  const selected: Prompt[] = [];
  const selectedIds = new Set<string>();
  const selectedCategoryKeys = new Set<string>();

  const appendCandidates = (candidates: Prompt[], allowCategoryRepeat = false) => {
    for (const prompt of candidates) {
      if (selected.length >= desiredCount || selectedIds.has(prompt.id)) {
        continue;
      }

      const categoryKey = getPromptCategoryKey(prompt);
      if (!allowCategoryRepeat && categoryKey && selectedCategoryKeys.has(categoryKey)) {
        continue;
      }

      selected.push(prompt);
      selectedIds.add(prompt.id);

      if (categoryKey) {
        selectedCategoryKeys.add(categoryKey);
      }
    }
  };

  appendCandidates(primaryCandidates);
  appendCandidates(fallbackCandidates);
  appendCandidates(primaryCandidates, true);
  appendCandidates(fallbackCandidates, true);

  return selected;
}
