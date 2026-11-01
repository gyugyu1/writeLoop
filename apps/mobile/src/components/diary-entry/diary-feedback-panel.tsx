import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  buildInlineFeedbackSegments,
  type RenderedInlineFeedbackSegment
} from "@/lib/inline-feedback";
import type {
  DiaryCorrectionPoint,
  DiaryExpression,
  DiaryFeedback,
  DiaryRewriteIdea
} from "@/lib/types";
import {
  trimText,
  firstText,
  normalizeExpressionKey,
  getNextFlowSuggestion,
  formatConnectionTipSuggestion,
  getDiaryFeedbackHeadline
} from "./diary-entry-helpers";
import { styles } from "./diary-entry-styles";

// 영어일기 피드백 패널과 그 안의 바뀐 곳 표시·표현 저장 아이콘 그리기.
export function renderDiaryDiffSegment(
  segment: RenderedInlineFeedbackSegment,
  mode: "original" | "revised",
  index: number
) {
  switch (segment.kind) {
    case "equal":
      return <Text key={`${mode}-equal-${index}`}>{segment.text}</Text>;
    case "replace":
      return mode === "original" ? (
        <Text key={`${mode}-replace-${index}`} style={styles.diaryRemovedText}>
          {segment.removed}
        </Text>
      ) : (
        <Text key={`${mode}-replace-${index}`} style={styles.diaryAddedText}>
          {segment.added}
        </Text>
      );
    case "remove":
      return mode === "original" ? (
        <Text key={`${mode}-remove-${index}`} style={styles.diaryRemovedText}>
          {segment.text}
        </Text>
      ) : null;
    case "add":
      return mode === "revised" ? (
        <Text key={`${mode}-add-${index}`} style={styles.diaryAddedText}>
          {segment.text}
        </Text>
      ) : null;
    default:
      return null;
  }
}

export function renderDiaryFixDiffText(original: string, revised: string, mode: "original" | "revised") {
  if (original && revised && original !== revised) {
    const segments = buildInlineFeedbackSegments(original, revised, null);
    if (segments.length > 0) {
      return segments.map((segment, index) => renderDiaryDiffSegment(segment, mode, index));
    }
  }

  return mode === "original" ? original : revised;
}

export function renderExpressionSaveIcon(saved: boolean, saving: boolean) {
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

export type DiaryFeedbackPanelProps = {
  feedback: DiaryFeedback;
  onSaveDiaryExpression?: (
    expression: string,
    meaningKo?: string | null,
    exampleEn?: string | null,
    usageTip?: string | null,
    tags?: string[] | null
  ) => void;
  isDiaryExpressionSaved?: (expression: string) => boolean;
  isSavingDiaryExpression?: (expression: string) => boolean;
};

export function DiaryFeedbackPanel({
  feedback,
  onSaveDiaryExpression,
  isDiaryExpressionSaved,
  isSavingDiaryExpression
}: DiaryFeedbackPanelProps) {
  const fixPoints = (feedback.fixPoints ?? []).filter(
    (point): point is DiaryCorrectionPoint => Boolean(point?.title || point?.reasonKo)
  );
  const rewriteIdeas = (feedback.rewriteIdeas ?? []).filter(
    (idea): idea is DiaryRewriteIdea =>
      Boolean(idea?.title || idea?.meaningKo || idea?.noteKo || idea?.exampleEn)
  );
  const diaryExpressions = [
    ...(feedback.usedDiaryExpressions ?? []),
    ...(feedback.diaryExpressions ?? [])
  ].filter((item): item is DiaryExpression => Boolean(item?.expression))
    .filter((item, index, items) => {
      const normalizedExpression = normalizeExpressionKey(item.expression);
      if (!normalizedExpression) {
        return true;
      }

      return items.findIndex((candidate) =>
        normalizeExpressionKey(candidate.expression) === normalizedExpression
      ) === index;
    });
  const summary = firstText(feedback.summaryKo, feedback.diaryFlow?.commentKo);
  const missionText = firstText(
    feedback.nextDiaryMission?.instructionKo,
    feedback.nextDiaryMission?.titleKo
  );
  const diaryFlow = feedback.diaryFlow;
  const goodFlowItems = [
    { label: "시간 흐름", value: diaryFlow?.timeFlow },
    { label: "디테일", value: diaryFlow?.detail }
  ].filter((item) => Boolean(trimText(item.value)));
  const nextFlowItems = [
    { label: "감정 더하기", value: getNextFlowSuggestion("emotion", diaryFlow?.emotion) },
    { label: "마무리 더하기", value: getNextFlowSuggestion("reflection", diaryFlow?.reflection) },
    {
      label: "연결 표현",
      value: formatConnectionTipSuggestion(diaryFlow?.connectionTips)
    }
  ].filter((item) => Boolean(trimText(item.value)));
  const hasDiaryFlow = goodFlowItems.length > 0 || nextFlowItems.length > 0;

  return (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackHeaderCopy}>
          <Text style={styles.feedbackTitle}>{getDiaryFeedbackHeadline(feedback)}</Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>{feedback.score}</Text>
        </View>
      </View>

      {summary ? <Text style={styles.feedbackSummary}>{summary}</Text> : null}

      {feedback.strengths?.length ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>좋았던 점</Text>
          </View>
          <View style={styles.bulletList}>
            {feedback.strengths.slice(0, 3).map((strength, index) => (
              <Text key={`${strength}-${index}`} style={styles.bulletText}>
                • {strength}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {fixPoints.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>고치면 더 자연스러운 부분</Text>
          </View>
          {fixPoints.slice(0, 5).map((point, index) => {
            const title = firstText(point.title, `포인트 ${index + 1}`);
            const originalText = trimText(point.originalText);
            const revisedText = trimText(point.revisedText);
            const supportText = firstText(point.reasonKo);

            return (
              <View
                key={`${title}-${index}`}
                style={[styles.fixPointCard, index > 0 && styles.innerDivider]}
              >
                <Text style={styles.fixPointTitle}>{title}</Text>
                {originalText || revisedText ? (
                  <View style={styles.repairBox}>
                    {originalText ? (
                      <Text style={styles.originalText}>
                        {renderDiaryFixDiffText(originalText, revisedText, "original")}
                      </Text>
                    ) : null}
                    {revisedText ? (
                      <Text style={styles.revisedText}>
                        {renderDiaryFixDiffText(originalText, revisedText, "revised")}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {supportText ? <Text style={styles.fixPointSupport}>{supportText}</Text> : null}
                {point.exampleEn ? <Text style={styles.exampleText}>{point.exampleEn}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {hasDiaryFlow ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>일기 흐름 코칭</Text>
          </View>
          <View style={styles.flowGrid}>
            {goodFlowItems.length > 0 ? (
              <View style={styles.flowSubCard}>
                <Text style={styles.flowSubTitle}>좋았던 흐름</Text>
                {goodFlowItems.map((item) => (
                  <Text key={item.label} style={styles.flowItemText}>
                    <Text style={styles.flowItemLabel}>{item.label}: </Text>
                    {item.value}
                  </Text>
                ))}
              </View>
            ) : null}
            {nextFlowItems.length > 0 ? (
              <View style={[styles.flowSubCard, goodFlowItems.length > 0 && styles.innerDivider]}>
                <Text style={styles.flowSubTitle}>다음에 더 붙이면 좋을 흐름</Text>
                {nextFlowItems.map((item) => (
                  <Text key={item.label} style={styles.flowItemText}>
                    <Text style={styles.flowItemLabel}>{item.label}: </Text>
                    {item.value}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {diaryExpressions.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>일기에 써볼 표현</Text>
          </View>
          <View style={styles.expressionList}>
            {diaryExpressions.slice(0, 6).map((item, index) => (
              <View
                key={`${normalizeExpressionKey(item.expression)}-${index}`}
                style={[styles.expressionChip, index > 0 && styles.innerDivider]}
              >
                <View style={styles.expressionHeaderRow}>
                  <Text style={styles.expressionText}>{item.expression}</Text>
                  {onSaveDiaryExpression ? (
                    <Pressable
                      style={[
                        styles.expressionSaveButton,
                        isDiaryExpressionSaved?.(item.expression) && styles.expressionSaveButtonSaved
                      ]}
                      onPress={() =>
                        onSaveDiaryExpression(
                          item.expression,
                          item.meaningKo || undefined,
                          item.exampleEn || undefined,
                          item.usageTipKo || undefined,
                          item.tags
                        )
                      }
                      disabled={Boolean(isSavingDiaryExpression?.(item.expression))}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isDiaryExpressionSaved?.(item.expression) ? "표현 저장 취소" : "표현 저장"
                      }
                    >
                      {renderExpressionSaveIcon(
                        Boolean(isDiaryExpressionSaved?.(item.expression)),
                        Boolean(isSavingDiaryExpression?.(item.expression))
                      )}
                    </Pressable>
                  ) : null}
                </View>
                {item.meaningKo ? <Text style={styles.expressionMeaning}>{item.meaningKo}</Text> : null}
                {item.exampleEn ? <Text style={styles.expressionMeaning}>{item.exampleEn}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {rewriteIdeas.length > 0 ? (
        <View style={styles.feedbackSection}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionHeadingBar} />
            <Text style={styles.sectionHeadingText}>다시 쓸 때 붙여볼 아이디어</Text>
          </View>
          {rewriteIdeas.slice(0, 5).map((idea, index) => {
            const translation = firstText(idea.meaningKo, `아이디어 ${index + 1}`);
            const note = firstText(idea.noteKo);
            const example = firstText(idea.exampleEn);

            return (
              <View
                key={`${translation}-${example}-${index}`}
                style={[styles.ideaCard, index > 0 && styles.innerDivider]}
              >
                <Text style={styles.ideaTitle}>{translation}</Text>
                {note ? <Text style={styles.ideaNote}>{note}</Text> : null}
                {example ? <Text style={styles.exampleText}>{example}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {missionText ? (
        <View style={styles.challengeCard}>
          <Text style={styles.challengeLabel}>다시 써보기 미션</Text>
          <Text style={styles.challengeText}>{missionText}</Text>
          {feedback.nextDiaryMission?.starterEn ? (
            <Text style={styles.exampleText}>{feedback.nextDiaryMission.starterEn}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
