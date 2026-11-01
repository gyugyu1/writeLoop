import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Text } from "react-native";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import type { FeedbackCoachMove, RefinementExpression } from "@/lib/types";
import { styles } from "./feedback-styles";

// 피드백 화면의 상수와 순수 함수·그리기 도우미.
export const COACH_MOVE_DIFF_MAX_CHARS = 700;
export const COACH_MOVE_DIFF_MAX_TOKENS = 140;
export const REWRITE_FEEDBACK_BUTTON_LABEL = "다시 피드백 받아보기";
export const REWRITE_OPEN_BUTTON_LABEL = "다시 다듬어 보기";
export const COMPLETION_READY_HEADLINE = "좋아요! 원하면 표현 하나만 더해 보세요.";

export function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

export function normalizeSuggestedPhrase(value: unknown) {
  if (typeof value === "string") {
    const phrase = trimText(value);
    return phrase ? { phrase, meaningKo: "" } : null;
  }
  if (value && typeof value === "object") {
    const candidate = value as { phrase?: unknown; meaningKo?: unknown };
    const phrase = typeof candidate.phrase === "string" ? trimText(candidate.phrase) : "";
    const meaningKo = typeof candidate.meaningKo === "string" ? trimText(candidate.meaningKo) : "";
    return phrase ? { phrase, meaningKo } : null;
  }
  return null;
}

export function normalizeCompletionRefinementPhrase(value?: RefinementExpression | null) {
  if (!value || value.displayable === false) {
    return null;
  }

  const phrase = trimText(value.expression);
  if (!phrase) {
    return null;
  }

  return {
    phrase,
    meaningKo: trimText(value.meaningKo),
    guidanceKo: trimText(value.guidanceKo),
    exampleEn: trimText(value.exampleEn)
  };
}

export function buildCompletionRefinementPhrases(expressions?: RefinementExpression[] | null) {
  if (!Array.isArray(expressions)) {
    return [];
  }

  const seen = new Set<string>();
  const phrases: NonNullable<ReturnType<typeof normalizeCompletionRefinementPhrase>>[] = [];

  for (const expression of expressions) {
    const phrase = normalizeCompletionRefinementPhrase(expression);
    if (!phrase) {
      continue;
    }

    const key = normalizeExpressionKey(phrase.phrase);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    phrases.push(phrase);
  }

  return phrases;
}

export function renderFeedbackExpressionSaveIcon(saved: boolean, saving: boolean) {
  if (saving) {
    return <ActivityIndicator color="#8A5A1E" size="small" />;
  }

  return (
    <SymbolView
      name={{
        ios: saved ? "bookmark.fill" : "bookmark",
        android: saved ? "bookmark" : "bookmark_border",
        web: saved ? "bookmark" : "bookmark_border"
      }}
      size={16}
      weight="semibold"
      tintColor={saved ? "#2F7A46" : "#8A5A1E"}
      type="hierarchical"
    />
  );
}

export function pickFirstNonEmpty(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = trimText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

export function normalizeExpressionKey(expression: string) {
  return expression.trim().replace(/\s+/g, " ").toLowerCase();
}

export function hasCoachMove(coachMove?: FeedbackCoachMove | null) {
  return Boolean(
    trimText(coachMove?.focus) ||
      trimText(coachMove?.why) ||
      trimText(coachMove?.before) ||
      trimText(coachMove?.after) ||
      trimText(coachMove?.instruction) ||
      trimText(coachMove?.skeletonEn) ||
      (Array.isArray(coachMove?.languageCorrections) &&
        coachMove.languageCorrections.length > 0) ||
      (Array.isArray(coachMove?.suggestedPhrases) &&
        coachMove.suggestedPhrases.some((phrase) => normalizeSuggestedPhrase(phrase)))
  );
}

export function isCoachMoveComparison(coachMove?: FeedbackCoachMove | null) {
  const before = trimText(coachMove?.before);
  const after = trimText(coachMove?.after);
  if (!before || !after) {
    return false;
  }

  const focusType = trimText(coachMove?.focusType).toUpperCase();
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
  const focusType = trimText(coachMove?.focusType).toUpperCase();
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

export function renderCoachMoveDiffSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number
) {
  switch (segment.kind) {
    case "equal":
      return <Text key={`${mode}-equal-${index}`}>{segment.text}</Text>;
    case "replace":
      return mode === "original" ? (
        <Text key={`${mode}-replace-${index}`} style={styles.coachMoveBeforeHighlight}>
          {segment.removed}
        </Text>
      ) : (
        <Text key={`${mode}-replace-${index}`} style={styles.coachMoveAfterHighlight}>
          {segment.added}
        </Text>
      );
    case "remove":
      return mode === "original" ? (
        <Text key={`${mode}-remove-${index}`} style={styles.coachMoveBeforeHighlight}>
          {segment.text}
        </Text>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <Text key={`${mode}-add-${index}`} style={styles.coachMoveAfterHighlight}>
          {segment.text}
        </Text>
      ) : null;
    default:
      return null;
  }
}

export function renderCoachMoveDiffText(original: string, revised: string, mode: "original" | "revised") {
  if (original && revised && original !== revised && canBuildCoachMoveDiff(original, revised)) {
    const segments = buildInlineFeedbackSegments(original, revised, null);
    if (segments.some((segment) => segment.kind !== "equal")) {
      return segments.map((segment, index) => renderCoachMoveDiffSegment(segment, mode, index));
    }
  }

  return mode === "original" ? original : revised;
}

export function buildSavedExpressionIdMap(
  expressions: { id: number; expression: string }[]
): Record<string, number> {
  return expressions.reduce<Record<string, number>>((map, expression) => {
    const normalizedKey = normalizeExpressionKey(expression.expression);
    if (!normalizedKey) {
      return map;
    }

    map[normalizedKey] = expression.id;
    return map;
  }, {});
}
