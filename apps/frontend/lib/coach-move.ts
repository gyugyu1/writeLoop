// 피드백의 코치 미션(coachMove)을 보여 줄지, 고친 문장을 비교 표시할 수 있는지 판단한다.
import { trimNullable } from "./text";
import type { FeedbackCoachMove } from "./types";

export const COACH_MOVE_DIFF_MAX_CHARS = 700;

export const COACH_MOVE_DIFF_MAX_TOKENS = 140;

export function normalizeSuggestedPhrase(value: unknown) {
  if (typeof value === "string") {
    const phrase = trimNullable(value);
    return phrase ? { phrase, meaningKo: "" } : null;
  }

  if (value && typeof value === "object") {
    const candidate = value as { phrase?: unknown; meaningKo?: unknown };
    const phrase = typeof candidate.phrase === "string" ? trimNullable(candidate.phrase) : null;
    const meaningKo = typeof candidate.meaningKo === "string" ? trimNullable(candidate.meaningKo) : "";
    return phrase ? { phrase, meaningKo } : null;
  }

  return null;
}

export function hasCoachMove(coachMove?: FeedbackCoachMove | null) {
  return Boolean(
    trimNullable(coachMove?.focus) ||
      trimNullable(coachMove?.why) ||
      trimNullable(coachMove?.before) ||
      trimNullable(coachMove?.after) ||
      trimNullable(coachMove?.instruction) ||
      trimNullable(coachMove?.skeletonEn) ||
      (Array.isArray(coachMove?.languageCorrections) &&
        coachMove.languageCorrections.length > 0) ||
      (Array.isArray(coachMove?.suggestedPhrases) &&
        coachMove.suggestedPhrases.some((phrase) => normalizeSuggestedPhrase(phrase)))
  );
}

export function isCoachMoveComparison(coachMove?: FeedbackCoachMove | null) {
  const before = trimNullable(coachMove?.before);
  const after = trimNullable(coachMove?.after);
  if (!before || !after) {
    return false;
  }

  const focusType = trimNullable(coachMove?.focusType)?.toUpperCase();
  if (!focusType) {
    return true;
  }

  return [
    "MICRO_FIX",
    "LANGUAGE_FIX",
    "STRUCTURE_FIX",
    "GRAMMAR",
    "GRAMMAR_FIX",
    "LOCAL_GRAMMAR",
    "FIX_LOCAL_GRAMMAR",
    "BLOCKING_GRAMMAR",
    "FIX_BLOCKING_GRAMMAR",
    "EXPRESSION",
    "EXPRESSION_POLISH"
  ].includes(focusType);
}

export function isDirectCorrectionCoachMove(coachMove?: FeedbackCoachMove | null) {
  const focusType = trimNullable(coachMove?.focusType)?.toUpperCase();
  return [
    "MICRO_FIX",
    "LANGUAGE_FIX",
    "STRUCTURE_FIX",
    "GRAMMAR",
    "GRAMMAR_FIX",
    "LOCAL_GRAMMAR",
    "FIX_LOCAL_GRAMMAR",
    "BLOCKING_GRAMMAR",
    "FIX_BLOCKING_GRAMMAR",
    "EXPRESSION",
    "EXPRESSION_POLISH"
  ].includes(focusType ?? "");
}

export function countDiffTokens(text: string) {
  return text.match(/[A-Za-z0-9']+|[^\sA-Za-z0-9']+|\s+/g)?.length ?? 0;
}

export function countComparableWords(text: string) {
  return text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g)?.length ?? 0;
}

export function isCoachMoveDiffScopeAligned(original: string, revised: string) {
  const originalWords = countComparableWords(original);
  const revisedWords = countComparableWords(revised);
  if (!originalWords || !revisedWords) {
    return true;
  }

  const shorter = Math.min(originalWords, revisedWords);
  const longer = Math.max(originalWords, revisedWords);
  const wordDelta = longer - shorter;

  // Phrase-vs-sentence comparisons create misleading highlights.
  return wordDelta <= 3 || longer / shorter <= 1.45;
}

export function canBuildCoachMoveDiff(original: string, revised: string) {
  return (
    original.length + revised.length <= COACH_MOVE_DIFF_MAX_CHARS &&
    countDiffTokens(original) + countDiffTokens(revised) <= COACH_MOVE_DIFF_MAX_TOKENS &&
    isCoachMoveDiffScopeAligned(original, revised)
  );
}
