import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import type {
  Feedback,
  FeedbackFixPoint,
  FeedbackInlineSegment,
  FeedbackModelAnswerVariant,
  FeedbackRewriteIdea,
  FeedbackSecondaryLearningPoint
} from "@/lib/types";

type FixCard = {
  key: string;
  reasonLines: string[];
  original: string;
  revised: string;
};

type RewritePracticeCard = {
  title: string;
  starter: string;
  starterKo: string;
  instruction: string;
  original: string;
  revised: string;
  hasSwapPair: boolean;
  optionalTone: boolean;
};

type RewriteSuggestionCard = {
  key: string;
  english: string;
  korean: string;
  note: string;
};

type RewriteIdeaCard = {
  key: string;
  title: string;
  english: string;
  korean: string;
  note: string;
  original: string;
  revised: string;
  hasSwapPair: boolean;
  optionalTone: boolean;
};

type ModelAnswerVariantCard = {
  key: string;
  label: string;
  answer: string;
  answerKo: string;
  reasonKo: string;
};

export type FeedbackTabKey = "feedback" | "improve";

type PracticeFeedbackContentProps = {
  feedbackState: PracticeFeedbackState;
  showCompletionSummary?: boolean;
  style?: StyleProp<ViewStyle>;
  activeTab?: FeedbackTabKey;
  onActiveTabChange?: (tab: FeedbackTabKey) => void;
  onTabBarLayout?: (y: number) => void;
};

function trimText(value?: string | null) {
  return value?.trim() ?? "";
}

function pickFirstNonEmpty(...values: (string | null | undefined)[]) {
  for (const value of values) {
    const trimmed = trimText(value);
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

const REWRITE_PLACEHOLDER_PATTERN = /(?:_{3,}|\.{3,})/;
const REWRITE_CONNECTOR_WORDS = new Set([
  "because",
  "and",
  "but",
  "so",
  "or",
  "to",
  "for",
  "with",
  "in",
  "on",
  "at",
  "about",
  "after",
  "before",
  "if",
  "when",
  "that"
]);
const REWRITE_OVERLAP_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "because",
  "been",
  "being",
  "but",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "she",
  "so",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "us",
  "was",
  "we",
  "were",
  "with",
  "you",
  "your"
]);

function looksLikeEnglishText(value?: string | null) {
  const text = trimText(value);
  if (!text) {
    return false;
  }

  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  const hangulCount = (text.match(/[가-힣]/g) ?? []).length;
  return latinCount > 0 && latinCount >= hangulCount;
}

function hasHangulText(value?: string | null) {
  const text = trimText(value);
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
}

function looksLikeEnglishSentence(value?: string | null) {
  const text = trimText(value);
  if (!text || !looksLikeEnglishText(text)) {
    return false;
  }
  if (/[.!?]/.test(text) || text.includes(",")) {
    return true;
  }
  return text.split(/\s+/).length >= 5;
}

function extractRewriteComparisonTokens(value?: string | null) {
  const text = trimText(value).toLowerCase();
  return (
    text.match(/[a-z]+(?:'[a-z]+)?/g)?.filter((token) => !REWRITE_OVERLAP_STOP_WORDS.has(token)) ??
    []
  );
}

function canSuggestionFillRewriteStarter(english: string, starter?: string | null) {
  const normalizedStarter = trimText(starter);
  if (!normalizedStarter || !REWRITE_PLACEHOLDER_PATTERN.test(normalizedStarter)) {
    return true;
  }

  const cleanedEnglish = stripRewriteSuggestionTerminalPunctuation(english);
  if (!cleanedEnglish) {
    return false;
  }

  const wordCount = cleanedEnglish.split(/\s+/).filter(Boolean).length;
  if (wordCount > 10) {
    return false;
  }

  const cleanedLower = cleanedEnglish.toLowerCase();
  if (REWRITE_CONNECTOR_WORDS.has(cleanedLower) && wordCount === 1) {
    return true;
  }

  const starterTokens = extractRewriteComparisonTokens(normalizedStarter);
  if (starterTokens.length === 0) {
    return true;
  }

  const englishTokens = extractRewriteComparisonTokens(cleanedEnglish);
  if (englishTokens.length === 0) {
    return false;
  }

  return englishTokens.some((token) => !starterTokens.includes(token));
}

function getFixLabel(type: FeedbackInlineSegment["type"]) {
  switch (type) {
    case "ADD":
      return "추가하면 더 자연스러워요";
    case "REMOVE":
      return "빼면 더 자연스러워요";
    case "REPLACE":
    default:
      return "이 부분을 다듬어 보세요";
  }
}

function normalizeReasonLines(...values: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const lines: string[] = [];

  values.forEach((value) => {
    trimText(value)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const dedupeKey = line.replace(/\s+/g, " ").toLowerCase();
        if (seen.has(dedupeKey)) {
          return;
        }

        seen.add(dedupeKey);
        lines.push(line);
      });
  });

  return lines;
}

function normalizeCompactDiffText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`"'“”‘’.,!?()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isRedundantReplacementSummaryLine(line: string, original: string, revised: string) {
  if (!original || !revised) {
    return false;
  }

  const normalizedLine = normalizeCompactDiffText(line);
  const normalizedOriginal = normalizeCompactDiffText(original);
  const normalizedRevised = normalizeCompactDiffText(revised);
  const hasArrowPattern = /(?:->|=>|→|⟶|➜)/.test(normalizedLine);

  return Boolean(
    hasArrowPattern &&
      normalizedOriginal &&
      normalizedRevised &&
      normalizedLine.includes(normalizedOriginal) &&
      normalizedLine.includes(normalizedRevised)
  );
}

function normalizeFixPoint(point: FeedbackFixPoint, index: number): FixCard | null {
  if (!point || point.kind === "EXPRESSION") {
    return null;
  }

  const original = trimText(point.originalText);
  const revised = trimText(point.revisedText);
  const fallbackLead = pickFirstNonEmpty(point.supportText, point.meaningKo, point.guidanceKo);
  const headlineCandidate = pickFirstNonEmpty(point.headline, point.title);
  const reasonLines = normalizeReasonLines(
    fallbackLead,
    headlineCandidate !== original && headlineCandidate !== revised ? headlineCandidate : ""
  ).filter((line) => !isRedundantReplacementSummaryLine(line, original, revised));

  if (reasonLines.length === 0 && !original && !revised) {
    return null;
  }

  return {
    key: `${original || revised || reasonLines.join("-") || index}`,
    reasonLines,
    original,
    revised
  };
}

function buildFallbackFixItems(answer: string, feedback: Feedback): FixCard[] {
  const items =
    feedback.inlineFeedback
      ?.filter((item) => item.type !== "KEEP")
      .map((item, index) => ({
        key: `${item.type}-${item.originalText}-${item.revisedText}-${index}`,
        reasonLines: [getFixLabel(item.type)],
        original: trimText(item.originalText),
        revised: trimText(item.revisedText)
      }))
      .filter((item) => item.original || item.revised) ?? [];

  if (items.length > 0) {
    return items;
  }

  const correctedAnswer = trimText(feedback.correctedAnswer);
  if (correctedAnswer && correctedAnswer !== trimText(answer)) {
    return [
      {
        key: "corrected-answer",
        reasonLines: ["이렇게 다듬어 볼 수 있어요"],
        original: trimText(answer),
        revised: correctedAnswer
      }
    ];
  }

  return [];
}

function buildFixItems(answer: string, feedback: Feedback): FixCard[] {
  const uiFixPoints =
    feedback.ui?.fixPoints
      ?.map((point, index) => normalizeFixPoint(point, index))
      .filter((item): item is FixCard => Boolean(item)) ?? [];

  if (uiFixPoints.length > 0) {
    return uiFixPoints;
  }

  return buildFallbackFixItems(answer, feedback);
}

function stripRewriteSuggestionTerminalPunctuation(value: string) {
  return value.replace(/[.!?]+$/g, "").trim();
}

function normalizeRewriteIdeaAnchor(value?: string | null) {
  const text = trimText(value);
  if (!text) {
    return "";
  }

  return stripRewriteSuggestionTerminalPunctuation(text)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildRewritePractice(feedback: Feedback): RewritePracticeCard | null {
  const nextStepPractice = feedback.ui?.nextStepPractice;
  if (!nextStepPractice) {
    return null;
  }

  const rawTitle = trimText(nextStepPractice.title);
  const title =
    rawTitle &&
    !["한번 더 써보기", "한 번 더 써보기", "원하면 한 번 더 다듬어 보세요"].includes(rawTitle)
      ? rawTitle
      : "추가하면 좋을 점";
  const starter = pickFirstNonEmpty(
    nextStepPractice.revisedText,
    nextStepPractice.headline,
    nextStepPractice.exampleEn
  );
  const starterKo = pickFirstNonEmpty(nextStepPractice.exampleKo, nextStepPractice.meaningKo);
  const instruction = pickFirstNonEmpty(
    nextStepPractice.supportText,
    nextStepPractice.guidanceKo,
    nextStepPractice.meaningKo
  );
  const original = trimText(nextStepPractice.originalText);
  const revised = trimText(nextStepPractice.revisedText);
  const hasSwapPair = Boolean(original && revised && original !== revised);

  if (!starter && !instruction && !hasSwapPair) {
    return null;
  }

  return {
    title,
    starter,
    starterKo,
    instruction,
    original,
    revised,
    hasSwapPair,
    optionalTone: Boolean(nextStepPractice.optionalTone ?? feedback.loopComplete)
  };
}

function resolveSecondaryLearningPoints(feedback: Feedback): FeedbackSecondaryLearningPoint[] {
  const uiPoints =
    feedback.ui?.secondaryLearningPoints?.filter((point) => {
      if (!point) {
        return false;
      }

      return Boolean(
        trimText(point.headline) ||
          trimText(point.originalText) ||
          trimText(point.revisedText) ||
          trimText(point.exampleEn)
      );
    }) ?? [];

  if (uiPoints.length > 0) {
    return uiPoints;
  }

  const fallback: FeedbackSecondaryLearningPoint[] = [];
  const microTip = feedback.ui?.microTip;
  if (
    trimText(microTip?.originalText) &&
    trimText(microTip?.revisedText) &&
    trimText(microTip?.reasonKo)
  ) {
    fallback.push({
      kind: "GRAMMAR",
      title: microTip?.title || "작은 표현 다듬기",
      originalText: microTip?.originalText,
      revisedText: microTip?.revisedText,
      supportText: microTip?.reasonKo
    });
  }

  (feedback.refinementExpressions ?? [])
    .filter((expression) => expression?.displayable !== false && trimText(expression?.expression))
    .forEach((expression) => {
      fallback.push({
        kind: "EXPRESSION",
        title: "써보면 좋은 표현",
        headline: expression.expression,
        meaningKo: expression.meaningKo,
        guidanceKo: expression.guidanceKo,
        exampleEn: expression.exampleEn,
        exampleKo: expression.exampleKo
      });
    });

  return fallback;
}

function resolveLearningPointLead(point: FeedbackSecondaryLearningPoint) {
  const headline = trimText(point.headline);
  const exampleEn = trimText(point.exampleEn);
  if (looksLikeEnglishText(headline)) {
    return headline;
  }
  if (looksLikeEnglishText(exampleEn)) {
    return exampleEn;
  }
  return pickFirstNonEmpty(headline, point.revisedText, point.originalText, exampleEn);
}

function resolveLearningPointMeaning(point: FeedbackSecondaryLearningPoint, lead: string) {
  const headline = trimText(point.headline);
  const meaningKo = trimText(point.meaningKo);
  const exampleKo = trimText(point.exampleKo);
  if (meaningKo) {
    if (looksLikeEnglishSentence(lead) && exampleKo) {
      return "";
    }
    return meaningKo;
  }
  if (headline && headline !== lead && !looksLikeEnglishText(headline)) {
    return headline;
  }
  return "";
}

function resolveLearningPointGuidance(point: FeedbackSecondaryLearningPoint) {
  return trimText(point.guidanceKo);
}

function resolveLearningPointSupport(point: FeedbackSecondaryLearningPoint) {
  return trimText(point.supportText);
}

function buildRewriteSuggestions(
  feedback: Feedback,
  starter?: string | null
): RewriteSuggestionCard[] {
  const seen = new Set<string>();
  const uiSuggestions = feedback.ui?.rewriteSuggestions ?? [];

  const suggestions = uiSuggestions
    .map((suggestion, index) => {
      const english = stripRewriteSuggestionTerminalPunctuation(suggestion?.english ?? "");
      if (!english || !canSuggestionFillRewriteStarter(english, starter)) {
        return null;
      }

      const dedupeKey = english.toLowerCase();
      if (seen.has(dedupeKey)) {
        return null;
      }

      seen.add(dedupeKey);
      return {
        key: `ui-${dedupeKey}-${index}`,
        english,
        korean: trimText(suggestion?.meaningKo),
        note: trimText(suggestion?.noteKo)
      };
    })
    .filter((item): item is RewriteSuggestionCard => Boolean(item));

  if (suggestions.length > 0) {
    return suggestions.slice(0, 3);
  }

  return resolveSecondaryLearningPoints(feedback)
    .filter((point) => point.kind === "EXPRESSION")
    .map((point, index) => {
      const lead = resolveLearningPointLead(point);
      const english = stripRewriteSuggestionTerminalPunctuation(lead);
      if (!english || !looksLikeEnglishText(english) || !canSuggestionFillRewriteStarter(english, starter)) {
        return null;
      }

      const dedupeKey = english.toLowerCase();
      if (seen.has(dedupeKey)) {
        return null;
      }

      seen.add(dedupeKey);
      return {
        key: `point-${dedupeKey}-${index}`,
        english,
        korean: resolveLearningPointMeaning(point, lead) || trimText(point.exampleKo),
        note: pickFirstNonEmpty(resolveLearningPointGuidance(point), resolveLearningPointSupport(point))
      };
    })
    .filter((item): item is RewriteSuggestionCard => Boolean(item))
    .slice(0, 3);
}

void buildRewritePractice;
void buildRewriteSuggestions;

function normalizeRewriteIdeaCard(
  idea: FeedbackRewriteIdea,
  index: number
): RewriteIdeaCard | null {
  const original = trimText(idea.originalText);
  const revised = trimText(idea.revisedText);
  const hasSwapPair = Boolean(original && revised && original !== revised);
  const englishSource = pickFirstNonEmpty(idea.english, revised);
  const english = hasSwapPair
    ? englishSource
    : stripRewriteSuggestionTerminalPunctuation(englishSource);
  const korean = trimText(idea.meaningKo);
  const note = pickFirstNonEmpty(idea.noteKo, idea.title);

  if (!english && !note && !hasSwapPair) {
    return null;
  }

  return {
    key: `idea-${english || revised || original || index}`,
    title: trimText(idea.title),
    english,
    korean,
    note,
    original,
    revised,
    hasSwapPair,
    optionalTone: Boolean(idea.optionalTone)
  };
}

function buildRewriteIdeas(feedback: Feedback): RewriteIdeaCard[] {
  const merged: RewriteIdeaCard[] = [];
  const seen = new Set<string>();

  const pushCard = (card: RewriteIdeaCard | null) => {
    if (!card) {
      return;
    }

    const englishAnchor = normalizeRewriteIdeaAnchor(card.english || card.revised);
    const dedupeKey = englishAnchor
      ? englishAnchor
      : [
          normalizeRewriteIdeaAnchor(card.original),
          normalizeRewriteIdeaAnchor(card.revised)
        ].join("|");

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    merged.push(card);
  };

  (feedback.ui?.rewriteIdeas ?? []).forEach((idea, index) => {
    if (!idea) {
      return;
    }
    pushCard(normalizeRewriteIdeaCard(idea, index));
  });

  if (merged.length > 0) {
    return merged;
  }

  resolveSecondaryLearningPoints(feedback)
    .filter((point) => point.kind === "EXPRESSION")
    .forEach((point, index) => {
      const lead = resolveLearningPointLead(point);
      const english = stripRewriteSuggestionTerminalPunctuation(lead);
      if (!english || !looksLikeEnglishText(english)) {
        return;
      }

      pushCard({
        key: `point-${english.toLowerCase()}-${index}`,
        title: "",
        english,
        korean: resolveLearningPointMeaning(point, lead) || trimText(point.exampleKo),
        note: pickFirstNonEmpty(resolveLearningPointGuidance(point), resolveLearningPointSupport(point)),
        original: "",
        revised: "",
        hasSwapPair: false,
        optionalTone: false
      });
    });

  return merged;
}

function getModelAnswerVariantLabel(kind?: string | null) {
  switch (trimText(kind).toUpperCase()) {
    case "NATURAL_POLISH":
      return "더 자연스럽게 쓴 버전";
    case "RICHER_DETAIL":
      return "더 풍부하게 쓴 버전";
    default:
      return "다른 버전";
  }
}

function normalizeModelAnswerVariantCard(
  variant: FeedbackModelAnswerVariant,
  index: number
): ModelAnswerVariantCard | null {
  const answer = trimText(variant.answer);
  if (!answer) {
    return null;
  }

  return {
    key: `variant-${trimText(variant.kind) || index}-${answer}`,
    label: getModelAnswerVariantLabel(variant.kind),
    answer,
    answerKo: trimText(variant.answerKo),
    reasonKo: trimText(variant.reasonKo)
  };
}

function buildModelAnswerVariants(
  feedback: Feedback,
  baseAnswer?: string | null
): ModelAnswerVariantCard[] {
  const merged: ModelAnswerVariantCard[] = [];
  const seen = new Set<string>();
  const baseAnchor = normalizeRewriteIdeaAnchor(baseAnswer);

  if (baseAnchor) {
    seen.add(baseAnchor);
  }

  (feedback.ui?.modelAnswerVariants ?? []).forEach((variant, index) => {
    if (!variant) {
      return;
    }

    const normalized = normalizeModelAnswerVariantCard(variant, index);
    if (!normalized) {
      return;
    }

    const answerAnchor = normalizeRewriteIdeaAnchor(normalized.answer);
    if (!answerAnchor || seen.has(answerAnchor)) {
      return;
    }

    seen.add(answerAnchor);
    merged.push(normalized);
  });

  return merged;
}

function renderDiffSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number,
  variant: "comparison" | "fix" = "comparison"
) {
  const removedStyle = variant === "fix" ? styles.fixRemovedText : styles.diffRemovedText;
  const addedStyle = variant === "fix" ? styles.fixAddedText : styles.diffAddedText;

  switch (segment.kind) {
    case "equal":
      return <Text key={`${mode}-equal-${index}`}>{segment.text}</Text>;
    case "replace":
      return mode === "original" ? (
        <Text key={`${mode}-replace-${index}`} style={removedStyle}>
          {segment.removed}
        </Text>
      ) : (
        <Text key={`${mode}-replace-${index}`} style={addedStyle}>
          {segment.added}
        </Text>
      );
    case "remove":
      return mode === "original" ? (
        <Text key={`${mode}-remove-${index}`} style={removedStyle}>
          {segment.text}
        </Text>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <Text key={`${mode}-add-${index}`} style={addedStyle}>
          {segment.text}
        </Text>
      ) : null;
    default:
      return null;
  }
}

function renderFixDiffText(original: string, revised: string, mode: "original" | "revised") {
  if (original && revised && original !== revised) {
    const segments = buildInlineFeedbackSegments(original, revised, null);
    if (segments.length > 0) {
      return segments.map((segment, index) => renderDiffSegment(segment, mode, index, "fix"));
    }
  }

  return mode === "original" ? original : revised;
}

export function PracticeFeedbackContent({
  feedbackState,
  showCompletionSummary = true,
  style,
  activeTab,
  onActiveTabChange,
  onTabBarLayout
}: PracticeFeedbackContentProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<FeedbackTabKey>("feedback");
  const [contentLayoutY, setContentLayoutY] = useState<number | null>(null);
  const [tabLayoutY, setTabLayoutY] = useState<number | null>(null);
  const resolvedActiveTab = activeTab ?? internalActiveTab;
  function handleTabChange(nextTab: FeedbackTabKey) {
    if (activeTab === undefined) {
      setInternalActiveTab(nextTab);
    }

    onActiveTabChange?.(nextTab);
  }

  useEffect(() => {
    if (contentLayoutY === null || tabLayoutY === null) {
      return;
    }

    onTabBarLayout?.(contentLayoutY + tabLayoutY);
  }, [contentLayoutY, onTabBarLayout, tabLayoutY]);
  const fixItems = useMemo(
    () => buildFixItems(feedbackState.answer, feedbackState.feedback),
    [feedbackState]
  );

  const strengths = useMemo(
    () => feedbackState.feedback.strengths.filter((item) => trimText(item)),
    [feedbackState]
  );

  const usedExpressions = useMemo(
    () =>
      Array.from(
        new Set(
          (feedbackState.feedback.usedExpressions ?? [])
            .map((item) => trimText(item.expression))
            .filter(Boolean)
        )
      ),
    [feedbackState]
  );

  const keepStrengths = useMemo(() => strengths.slice(0, 1), [strengths]);
  const keepExpressions = useMemo(() => usedExpressions.slice(0, 2), [usedExpressions]);
  const rewriteIdeas = useMemo(() => buildRewriteIdeas(feedbackState.feedback), [feedbackState]);
  const completionHeadline = useMemo(
    () =>
      pickFirstNonEmpty(
        feedbackState.feedback.ui?.loopStatus?.headline,
        feedbackState.feedback.completionMessage,
        feedbackState.feedback.summary
      ),
    [feedbackState]
  );
  const completionSupport = trimText(feedbackState.feedback.ui?.loopStatus?.supportText);
  const hasCompletionMessage = Boolean(completionHeadline || completionSupport);

  const comparisonTarget = useMemo(
    () =>
      pickFirstNonEmpty(
        feedbackState.feedback.modelAnswer,
        feedbackState.feedback.correctedAnswer
      ),
    [feedbackState]
  );

  const comparisonLabel = feedbackState.feedback.modelAnswer?.trim() ? "모범 답안" : "다듬은 답안";
  const hasAnswerSection = Boolean(trimText(feedbackState.answer));
  const hasComparison = Boolean(
    comparisonTarget && comparisonTarget !== trimText(feedbackState.answer)
  );

  const comparisonSegments = useMemo(
    () =>
      hasComparison
        ? buildInlineFeedbackSegments(
            feedbackState.answer,
            comparisonTarget,
            feedbackState.feedback.inlineFeedback
          )
        : [],
    [comparisonTarget, feedbackState, hasComparison]
  );
  const modelAnswerVariants = useMemo(
    () => buildModelAnswerVariants(feedbackState.feedback, comparisonTarget),
    [comparisonTarget, feedbackState]
  );
  const hasImproveContent = rewriteIdeas.length > 0;

  return (
    <View
      style={[styles.content, style]}
      onLayout={(event) => setContentLayoutY(event.nativeEvent.layout.y)}
    >
      <View style={styles.attemptMetaRow}>
        <Text style={styles.attemptMetaOnly}>{`${feedbackState.feedback.attemptNo}번째 시도`}</Text>
      </View>

      <View style={styles.promptCard}>
        <Text style={styles.promptQuestionEn}>{feedbackState.prompt.questionEn}</Text>
        <Text style={styles.promptQuestionKo}>{feedbackState.prompt.questionKo}</Text>
      </View>

      <View
        style={styles.tabBar}
        onLayout={(event) => setTabLayoutY(event.nativeEvent.layout.y)}
      >
        <Pressable
          style={[
            styles.tabButton,
            resolvedActiveTab === "feedback" && styles.tabButtonActive
          ]}
          onPress={() => handleTabChange("feedback")}
        >
          <Text
            style={[
              styles.tabButtonText,
              resolvedActiveTab === "feedback" && styles.tabButtonTextActive
            ]}
          >
            피드백
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tabButton,
            resolvedActiveTab === "improve" && styles.tabButtonActive
          ]}
          onPress={() => handleTabChange("improve")}
        >
          <Text
            style={[
              styles.tabButtonText,
              resolvedActiveTab === "improve" && styles.tabButtonTextActive
            ]}
          >
            표현 더하기
          </Text>
        </Pressable>
      </View>

      {resolvedActiveTab === "feedback" ? (
        <>
          {hasAnswerSection ? (
            <View style={styles.feedbackCard}>
              <Text style={styles.sectionTitle}>
                {hasComparison ? `내 답변 VS ${comparisonLabel}` : "내 답변"}
              </Text>
              <View style={styles.comparisonStack}>
                <View style={[styles.answerCard, styles.answerCardOriginal]}>
                  <Text style={styles.answerLabel}>내 답변</Text>
                  <Text style={styles.answerText}>
                    {hasComparison
                      ? comparisonSegments.map((segment, index) =>
                          renderDiffSegment(segment, "original", index)
                        )
                      : feedbackState.answer}
                  </Text>
                </View>
                {hasComparison ? (
                  <>
                    <View style={[styles.answerCard, styles.answerCardRevised]}>
                      <Text style={[styles.answerLabel, styles.answerLabelPrimary]}>
                        {comparisonLabel}
                      </Text>
                      <Text style={[styles.answerText, styles.answerTextPrimary]}>
                        {comparisonSegments.map((segment, index) =>
                          renderDiffSegment(segment, "revised", index)
                        )}
                      </Text>
                      {hasHangulText(feedbackState.feedback.modelAnswerKo) ? (
                        <Text style={styles.answerTranslation}>
                          {feedbackState.feedback.modelAnswerKo}
                        </Text>
                      ) : null}
                    </View>
                    {modelAnswerVariants.map((variant) => (
                      <View key={variant.key} style={[styles.answerCard, styles.answerCardVariant]}>
                        <Text style={[styles.answerLabel, styles.answerLabelVariant]}>
                          {variant.label}
                        </Text>
                        <Text style={[styles.answerText, styles.answerTextVariant]}>
                          {variant.answer}
                        </Text>
                        {hasHangulText(variant.answerKo) ? (
                          <Text style={styles.answerTranslation}>{variant.answerKo}</Text>
                        ) : null}
                        {variant.reasonKo ? (
                          <Text style={styles.answerVariantReason}>{variant.reasonKo}</Text>
                        ) : null}
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            </View>
          ) : null}

          {keepStrengths.length > 0 || keepExpressions.length > 0 ? (
            <View style={styles.feedbackCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingKeep]}>유지할 점</Text>
              {keepStrengths.map((item) => (
                <Text key={item} style={styles.bulletLine}>
                  {`\u2022 ${item}`}
                </Text>
              ))}
              {keepExpressions.length ? (
                <View style={styles.expressionSection}>
                  <Text style={styles.expressionSectionLabel}>잘 쓴 표현</Text>
                  <View style={styles.expressionWrap}>
                    {keepExpressions.map((item) => (
                      <View key={item} style={styles.expressionChip}>
                        <Text style={styles.expressionChipText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {fixItems.length > 0 ? (
            <View style={styles.feedbackCard}>
              <Text style={[styles.sectionHeading, styles.sectionHeadingFix]}>고쳐볼 점</Text>
              <View style={styles.fixStack}>
                {fixItems.map((item, index) => (
                  <View
                    key={item.key}
                    style={[styles.fixItem, index > 0 && styles.fixItemDivider]}
                  >
                    {item.reasonLines.map((line) => (
                      <Text key={`${item.key}-${line}`} style={styles.fixReasonLine}>
                        {`\u2022 ${line}`}
                      </Text>
                    ))}
                    {item.original ? (
                      <View style={[styles.fixSentenceCard, styles.fixSentenceCardOriginal]}>
                        <Text style={[styles.fixSentenceBadge, styles.fixSentenceBadgeOriginal]}>
                          원문
                        </Text>
                        <Text style={[styles.fixSentenceText, styles.fixSentenceTextOriginal]}>
                          {renderFixDiffText(item.original, item.revised, "original")}
                        </Text>
                      </View>
                    ) : null}
                    {item.revised ? (
                      <View style={[styles.fixSentenceCard, styles.fixSentenceCardRevised]}>
                        <Text style={[styles.fixSentenceBadge, styles.fixSentenceBadgeRevised]}>
                          수정문
                        </Text>
                        <Text style={[styles.fixSentenceText, styles.fixSentenceTextRevised]}>
                          {renderFixDiffText(item.original, item.revised, "revised")}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.feedbackCard}>
          <Text style={styles.sectionHeading}>표현 더하기</Text>
          {hasImproveContent ? (
            <View style={styles.rewriteSuggestionList}>
              {rewriteIdeas.map((idea) =>
                idea.hasSwapPair ? (
                  <View
                    key={idea.key}
                    style={[
                      styles.rewriteGuideHero,
                      idea.optionalTone && styles.rewriteGuideHeroOptional
                    ]}
                  >
                    {idea.hasSwapPair ? (
                      <View style={styles.rewriteGuideSwapStack}>
                        <View style={[styles.fixSentenceCard, styles.fixSentenceCardOriginal]}>
                          <Text style={[styles.fixSentenceBadge, styles.fixSentenceBadgeOriginal]}>
                            원문
                          </Text>
                          <Text style={[styles.fixSentenceText, styles.fixSentenceTextOriginal]}>
                            {renderFixDiffText(idea.original, idea.revised, "original")}
                          </Text>
                        </View>
                        <View style={[styles.fixSentenceCard, styles.fixSentenceCardRevised]}>
                          <Text style={[styles.fixSentenceBadge, styles.fixSentenceBadgeRevised]}>
                            수정문
                          </Text>
                          <Text style={[styles.fixSentenceText, styles.fixSentenceTextRevised]}>
                            {renderFixDiffText(idea.original, idea.revised, "revised")}
                          </Text>
                        </View>
                      </View>
                    ) : idea.english ? (
                      <>
                        <Text style={styles.rewriteGuideStarter}>{idea.english}</Text>
                        {idea.korean ? (
                          <Text style={styles.rewriteGuideTranslation}>{idea.korean}</Text>
                        ) : null}
                      </>
                    ) : null}

                    {idea.note ? (
                      <Text style={styles.rewriteGuideInstruction}>{idea.note}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View key={idea.key} style={styles.rewriteSuggestionCard}>
                    <Text style={styles.rewriteSuggestionEnglish}>{idea.english}</Text>
                    {idea.korean ? (
                      <Text style={styles.rewriteSuggestionKorean}>{idea.korean}</Text>
                    ) : null}
                    {idea.note ? (
                      <Text style={styles.rewriteSuggestionNote}>{idea.note}</Text>
                    ) : null}
                  </View>
                )
              )}
            </View>
          ) : (
            <View style={styles.tabEmptyState}>
              <Text style={styles.tabEmptyStateText}>
                이번 피드백에는 추가 표현 제안이 아직 없어요.
              </Text>
            </View>
          )}
        </View>
      )}

      {showCompletionSummary && hasCompletionMessage ? (
        <View style={styles.completionSection}>
          <View style={styles.completionBubble}>
            {completionHeadline ? (
              <Text style={styles.completionHeadline}>{completionHeadline}</Text>
            ) : null}
            {completionSupport ? (
              <Text style={styles.completionBody}>{completionSupport}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16
  },
  attemptMetaRow: {
    alignItems: "flex-end",
    marginBottom: -4
  },
  attemptMetaOnly: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7A7672"
  },
  promptCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 10
  },
  promptQuestionEn: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    color: "#2B2620"
  },
  promptQuestionKo: {
    fontSize: 15,
    lineHeight: 22,
    color: "#756757"
  },
  feedbackCard: {
    backgroundColor: "#FFFEFC",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8DACB",
    gap: 10
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#232128"
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
    color: "#2F312D"
  },
  sectionHeadingKeep: {
    color: "#2F7A46"
  },
  sectionHeadingFix: {
    color: "#C84B31"
  },
  tabBar: {
    flexDirection: "row",
    gap: 10
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2D4C3",
    backgroundColor: "#FFF8EF",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  tabButtonActive: {
    backgroundColor: "#F2A14A",
    borderColor: "#E09128"
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#7A6244"
  },
  tabButtonTextActive: {
    color: "#2E2416"
  },
  comparisonStack: {
    gap: 12
  },
  answerCard: {
    borderRadius: 22,
    padding: 16,
    gap: 8
  },
  answerCardOriginal: {
    backgroundColor: "#FFF7EA",
    borderWidth: 1,
    borderColor: "#EACFA9"
  },
  answerCardRevised: {
    backgroundColor: "#F3F7FF",
    borderWidth: 1,
    borderColor: "#C8D6F3"
  },
  answerCardVariant: {
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: "#E8DACB"
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#9A651F"
  },
  answerLabelPrimary: {
    color: "#315C9C"
  },
  answerLabelVariant: {
    color: "#8A5A1E"
  },
  answerText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#4C4134"
  },
  answerTextPrimary: {
    color: "#223654"
  },
  answerTextVariant: {
    color: "#3E3428"
  },
  diffRemovedText: {
    color: "#8C5549",
    backgroundColor: "#F8DED7",
    textDecorationLine: "line-through"
  },
  diffAddedText: {
    color: "#244F7A",
    backgroundColor: "#DCE8FF"
  },
  answerTranslation: {
    fontSize: 13,
    lineHeight: 20,
    color: "#5B7196"
  },
  answerVariantReason: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7B624B"
  },
  fixStack: {
    gap: 0
  },
  fixItem: {
    gap: 12
  },
  fixItemDivider: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: "rgba(177, 172, 168, 0.36)"
  },
  fixReasonLine: {
    fontSize: 15,
    lineHeight: 26,
    color: "#5C4B39",
    fontWeight: "700"
  },
  fixSentenceCard: {
    gap: 8
  },
  fixSentenceCardOriginal: {
    backgroundColor: "transparent"
  },
  fixSentenceCardRevised: {
    backgroundColor: "transparent"
  },
  fixSentenceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden"
  },
  fixSentenceBadgeOriginal: {
    backgroundColor: "#FFD7CD",
    color: "#B04328"
  },
  fixSentenceBadgeRevised: {
    backgroundColor: "#FBE4B7",
    color: "#8D5B16"
  },
  fixSentenceText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "800"
  },
  fixSentenceTextOriginal: {
    color: "#B04328"
  },
  fixSentenceTextRevised: {
    color: "#6D4B1D"
  },
  fixRemovedText: {
    color: "#B23A22",
    backgroundColor: "#FFD9D2",
    borderRadius: 6,
    paddingHorizontal: 2,
    textDecorationLine: "line-through"
  },
  fixAddedText: {
    color: "#9A651F",
    backgroundColor: "#FBE4B7",
    borderRadius: 6,
    paddingHorizontal: 2
  },
  bulletLine: {
    fontSize: 15,
    lineHeight: 25,
    color: "#52483C"
  },
  expressionSection: {
    gap: 10
  },
  expressionSectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7B4A1E"
  },
  expressionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  expressionChip: {
    borderRadius: 999,
    backgroundColor: "#FFF0D7",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  expressionChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#A76518"
  },
  rewriteGuideCard: {
    gap: 14
  },
  rewriteGuideCardOptional: {
    opacity: 0.96
  },
  rewriteGuideHero: {
    borderRadius: 22,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#EACFA9",
    padding: 16,
    gap: 12
  },
  rewriteGuideHeroOptional: {
    backgroundColor: "#FFFEFC"
  },
  rewriteGuideStarter: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "900",
    color: "#6A4B1D"
  },
  rewriteGuideInstruction: {
    fontSize: 15,
    lineHeight: 23,
    color: "#5A4C3D"
  },
  rewriteGuideTranslation: {
    fontSize: 14,
    lineHeight: 21,
    color: "#876B47"
  },
  rewriteGuideSwapStack: {
    gap: 10
  },
  rewriteSuggestionBlock: {
    gap: 10
  },
  rewriteSuggestionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900",
    color: "#7B4A1E"
  },
  rewriteSuggestionList: {
    gap: 10
  },
  rewriteSuggestionCard: {
    borderRadius: 18,
    backgroundColor: "#FFFEFC",
    borderWidth: 1,
    borderColor: "#E8DACB",
    padding: 14,
    gap: 6
  },
  rewriteSuggestionEnglish: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "900",
    color: "#2D261E"
  },
  rewriteSuggestionKorean: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A6247"
  },
  rewriteSuggestionNote: {
    fontSize: 13,
    lineHeight: 20,
    color: "#8D745B"
  },
  tabEmptyState: {
    borderRadius: 20,
    backgroundColor: "#FFF9F2",
    borderWidth: 1,
    borderColor: "#E8DACB",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  tabEmptyStateText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#7A6853"
  },
  completionSection: {
    paddingTop: 6
  },
  completionBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#F2994A",
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 8
  },
  completionHeadline: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "900",
    color: "#2F312D"
  },
  completionBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6A5E50"
  }
});
