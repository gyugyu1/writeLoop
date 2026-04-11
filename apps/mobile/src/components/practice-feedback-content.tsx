import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import type { PracticeFeedbackState } from "@/lib/practice-feedback-state";
import type { Feedback, FeedbackFixPoint, FeedbackInlineSegment } from "@/lib/types";

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

type PracticeFeedbackContentProps = {
  feedbackState: PracticeFeedbackState;
  showCompletionSummary?: boolean;
  style?: StyleProp<ViewStyle>;
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
  );

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

function buildRewriteSuggestions(feedback: Feedback): RewriteSuggestionCard[] {
  const seen = new Set<string>();

  return (
    feedback.ui?.rewriteSuggestions
      ?.map((suggestion, index) => {
        const english = stripRewriteSuggestionTerminalPunctuation(suggestion?.english ?? "");
        if (!english) {
          return null;
        }

        const dedupeKey = english.toLowerCase();
        if (seen.has(dedupeKey)) {
          return null;
        }

        seen.add(dedupeKey);
        return {
          key: `${dedupeKey}-${index}`,
          english,
          korean: trimText(suggestion?.meaningKo),
          note: trimText(suggestion?.noteKo)
        };
      })
      .filter((item): item is RewriteSuggestionCard => Boolean(item))
      .slice(0, 3) ?? []
  );
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
  style
}: PracticeFeedbackContentProps) {
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
  const rewritePractice = useMemo(
    () => buildRewritePractice(feedbackState.feedback),
    [feedbackState]
  );
  const rewriteSuggestions = useMemo(
    () => buildRewriteSuggestions(feedbackState.feedback),
    [feedbackState]
  );
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

  return (
    <View style={[styles.content, style]}>
      <View style={styles.attemptMetaRow}>
        <Text style={styles.attemptMetaOnly}>{`${feedbackState.feedback.attemptNo}번째 시도`}</Text>
      </View>

      <View style={styles.promptCard}>
        <Text style={styles.promptQuestionEn}>{feedbackState.prompt.questionEn}</Text>
        <Text style={styles.promptQuestionKo}>{feedbackState.prompt.questionKo}</Text>
      </View>

      {hasComparison ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.sectionTitle}>내 답변 VS {comparisonLabel}</Text>
          <View style={styles.comparisonStack}>
            <View style={[styles.answerCard, styles.answerCardOriginal]}>
              <Text style={styles.answerLabel}>내 답변</Text>
              <Text style={styles.answerText}>
                {comparisonSegments.map((segment, index) =>
                  renderDiffSegment(segment, "original", index)
                )}
              </Text>
            </View>
            <View style={[styles.answerCard, styles.answerCardRevised]}>
              <Text style={[styles.answerLabel, styles.answerLabelPrimary]}>{comparisonLabel}</Text>
              <Text style={[styles.answerText, styles.answerTextPrimary]}>
                {comparisonSegments.map((segment, index) =>
                  renderDiffSegment(segment, "revised", index)
                )}
              </Text>
              {trimText(feedbackState.feedback.modelAnswerKo) ? (
                <Text style={styles.answerTranslation}>
                  {`해석: ${feedbackState.feedback.modelAnswerKo}`}
                </Text>
              ) : null}
            </View>
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
                    <Text style={[styles.fixSentenceLabel, styles.fixSentenceLabelOriginal]}>
                      원문 :
                    </Text>
                    <Text style={[styles.fixSentenceText, styles.fixSentenceTextOriginal]}>
                      {renderFixDiffText(item.original, item.revised, "original")}
                    </Text>
                  </View>
                ) : null}
                {item.revised ? (
                  <View style={[styles.fixSentenceCard, styles.fixSentenceCardRevised]}>
                    <Text style={[styles.fixSentenceLabel, styles.fixSentenceLabelRevised]}>
                      수정문 :
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

      {rewritePractice || rewriteSuggestions.length > 0 ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.sectionHeading}>추가하면 좋을 점</Text>
          <View
            style={[
              styles.rewriteGuideCard,
              rewritePractice?.optionalTone && styles.rewriteGuideCardOptional
            ]}
          >
            {rewritePractice ? (
              <View
                style={[
                  styles.rewriteGuideHero,
                  rewritePractice.optionalTone && styles.rewriteGuideHeroOptional
                ]}
              >
                {rewritePractice.hasSwapPair ? (
                  <View style={styles.rewriteGuideSwapStack}>
                    <View style={[styles.fixSentenceCard, styles.fixSentenceCardOriginal]}>
                      <Text style={[styles.fixSentenceLabel, styles.fixSentenceLabelOriginal]}>
                        원문 :
                      </Text>
                      <Text style={[styles.fixSentenceText, styles.fixSentenceTextOriginal]}>
                        {renderFixDiffText(rewritePractice.original, rewritePractice.revised, "original")}
                      </Text>
                    </View>
                    <Text style={styles.rewriteGuideArrow}>→</Text>
                    <View style={[styles.fixSentenceCard, styles.fixSentenceCardRevised]}>
                      <Text style={[styles.fixSentenceLabel, styles.fixSentenceLabelRevised]}>
                        추가 문장 :
                      </Text>
                      <Text style={[styles.fixSentenceText, styles.fixSentenceTextRevised]}>
                        {renderFixDiffText(rewritePractice.original, rewritePractice.revised, "revised")}
                      </Text>
                    </View>
                  </View>
                ) : rewritePractice.starter ? (
                  <>
                    <Text style={styles.rewriteGuideStarter}>{rewritePractice.starter}</Text>
                    {rewritePractice.starterKo ? (
                      <Text style={styles.rewriteGuideTranslation}>{rewritePractice.starterKo}</Text>
                    ) : null}
                  </>
                ) : null}

                {rewritePractice.instruction ? (
                  <Text style={styles.rewriteGuideInstruction}>{rewritePractice.instruction}</Text>
                ) : null}
              </View>
            ) : null}

            {rewriteSuggestions.length > 0 ? (
              <View style={styles.rewriteSuggestionBlock}>
                <Text style={styles.rewriteSuggestionTitle}>이런 표현으로 이어 써볼 수 있어요</Text>
                <View style={styles.rewriteSuggestionList}>
                  {rewriteSuggestions.map((suggestion) => (
                    <View key={suggestion.key} style={styles.rewriteSuggestionCard}>
                      <Text style={styles.rewriteSuggestionEnglish}>{suggestion.english}</Text>
                      {suggestion.korean ? (
                        <Text style={styles.rewriteSuggestionKorean}>{suggestion.korean}</Text>
                      ) : null}
                      {suggestion.note ? (
                        <Text style={styles.rewriteSuggestionNote}>{suggestion.note}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

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
  answerLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    color: "#9A651F"
  },
  answerLabelPrimary: {
    color: "#315C9C"
  },
  answerText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#4C4134"
  },
  answerTextPrimary: {
    color: "#223654"
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
    borderTopColor: "rgba(177, 172, 168, 0.24)"
  },
  fixReasonLine: {
    fontSize: 15,
    lineHeight: 26,
    color: "#5C4B39",
    fontWeight: "700"
  },
  fixSentenceCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6
  },
  fixSentenceCardOriginal: {
    backgroundColor: "#FFF1EE"
  },
  fixSentenceCardRevised: {
    backgroundColor: "#FFF4E6"
  },
  fixSentenceLabel: {
    fontSize: 13,
    fontWeight: "900"
  },
  fixSentenceLabelOriginal: {
    color: "#CC4D2D"
  },
  fixSentenceLabelRevised: {
    color: "#B06E12"
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
    backgroundColor: "#FFF7EA",
    borderWidth: 1,
    borderColor: "#EACFA9",
    padding: 16,
    gap: 12
  },
  rewriteGuideHeroOptional: {
    backgroundColor: "#FFF9F1"
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
  rewriteGuideArrow: {
    alignSelf: "center",
    fontSize: 18,
    fontWeight: "900",
    color: "#B07B36"
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
